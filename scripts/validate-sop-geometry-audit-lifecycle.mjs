import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { withSopFixtureSnapshot } from './helpers/sopFixtureSnapshot.mjs';
import { createSopTopologyWorkbenchController } from '../src/components/sopTopologyWorkbenchController.js';
import { buildSopVisualSwatch } from '../src/simulation/sopSpatialHypothesis.js';

const cold = createSopTopologyWorkbenchController({ context: {} });
assert.equal(typeof cold.auditSwatch, 'function', 'The existing controller must expose on-demand geometry audit.');
assert.equal(typeof cold.applyGeometryCorrection, 'function', 'A proven visual correction requires a separate explicit action.');
cold.dispose();
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject }; };
const serialize = value => JSON.stringify(value, (_, item) => item instanceof Map ? [...item] : item);
const records = [];

// Actual SOP source, tiny derived scene and controlled async auditor: tests the
// publication boundary, not detector numerics or browser performance.
await withSopFixtureSnapshot(async ({ snapshot, project, fixtureSha256, archiveDir }) => {
  const before = serialize(snapshot), projectBefore = serialize(project);
  const context = { machineSnapshot: snapshot, projectGeneration: snapshot.projectGeneration,
    feedYarnStructureRevision: snapshot.feedYarnStructureRevision, workbenchMode: 'pbr25d', yarnLibrary: project.yarnLibrary };
  const jobs = [], corrections = [], renderers = [];
  let eligibleCount = 1;
  const controller = createSopTopologyWorkbenchController({ context,
    auditGeometry(input, options) { const gate = deferred(); jobs.push({ input, options, ...gate }); return gate.promise; },
    planVisualCorrection() { return { status: 'READY', counts: { eligible: eligibleCount, skipped: 2 } }; },
    applyVisualCorrection(input, report) { const gate = deferred(); corrections.push({ input, report, ...gate }); return gate.promise; },
    buildSwatch(topology) {
      const full = buildSopVisualSwatch(topology);
      const paths = full.paths.filter(p => p.row === 22 && p.yarnIndex === 1 &&
        (p.needle === 16 && ['STITCH_VISUAL_TEMPLATE', 'VISUAL_TRANSITION'].includes(p.geometryRole) ||
          p.needle === 17 && p.geometryRole === 'STITCH_VISUAL_TEMPLATE'));
      const ids = new Set(paths.map(p => p.id)), scene = full.scene.filter(item => ids.has(item.id));
      return { ...full, paths, scene, evidenceScene: scene.slice(0, 1) };
    },
    createRenderer(callbacks) {
      const renderer = { status: { status: 'OK' }, scene: [], views: [], updates: 0,
        mount() { return this.status; }, update(patch) { this.updates++; if ('scene' in patch) this.scene = patch.scene; return this.status; },
        ready() { return Promise.resolve(); }, setView(view) { this.views.push(view); callbacks.onViewChange(view); },
        dispose() { this.scene = []; } };
      renderers.push(renderer); return renderer;
    } });
  const renderer = () => renderers.at(-1), job = () => jobs.at(-1);
  const result = (input, status = 'COMPLETE') => ({ status, complete: status === 'COMPLETE',
    findings: [{ id: 'finding-1', classification: 'UNKNOWN_INTERSECTION', sourcePathIds: input.paths.slice(0, 2).map(p => p.id),
      reason: 'Unknown relation is retained', geometryEvidence: { kind: 'SURFACE_CROSSING', closestPoints: [[2, 3, 4], [2, 3, 4]] } }],
    counts: { byClassification: { UNKNOWN_INTERSECTION: 1 } }, statistics: { durationMs: 1 }, sources: {}, limitations: [] });
  async function check(name, action) {
    await action();
    assert.equal(serialize(snapshot), before); assert.equal(serialize(project), projectBefore);
    assert.ok(!/auditReport|auditProgress|auditRunning|sourcePathIds|correctionReport|correctionPlan|correctionRunning/.test(serialize(controller.exportSession())));
    records.push({ name, status: 'PASS' });
  }
  try {
    await check('cold audit does not create geometry, renderer or detector', async () => {
      controller.mount({}); await controller.auditSwatch(); assert.equal(jobs.length, 0); assert.equal(renderers.length, 0);
    });
    controller.generateSwatch(); await controller.ready();
    await check('explicit full-geometry audit publishes progress and preserves rendering', async () => {
      const geometry = controller.model.derivedGeometry, count = renderer().updates;
      controller.setYarnFilter(geometry.paths[0].yarnId); await controller.ready();
      const filteredCount = renderer().updates;
      const run = controller.auditSwatch(); assert.equal(controller.model.auditRunning, true);
      assert.equal(job().input, geometry, 'Audit receives complete swatch, not visible filtered scene.');
      job().options.onProgress({ phase: 'NARROW', done: 3 });
      assert.equal(controller.model.auditProgress.phase, 'NARROW');
      await controller.auditSwatch(); assert.equal(jobs.length, 1);
      const report = result(geometry); job().resolve(report); await run;
      assert.equal(controller.model.auditReport, report); assert.equal(controller.model.auditRunning, false);
      assert.equal(renderer().updates, filteredCount); assert.ok(filteredCount > count);
    });
    await check('camera, filter and PBR changes retain report; same geometry uses cached result', async () => {
      const report = controller.model.auditReport;
      controller.setView({ yaw: 1 }); controller.setScanAxis('y'); controller.setEvidenceView(true);
      controller.setMaterialBinding(controller.model.derivedGeometry.paths[0].yarnId, project.yarnLibrary[0].id);
      controller.setSelectionFilter({ row: 999 }); await controller.ready(); await controller.auditSwatch();
      assert.equal(jobs.length, 1); assert.equal(controller.model.auditReport, report);
    });
    await check('finding navigation shows both original sources and keeps UNKNOWN unchanged', async () => {
      const report = controller.model.auditReport;
      controller.selectAuditFinding('finding-1'); await controller.ready();
      assert.deepEqual(renderer().scene.map(x => x.id), report.findings[0].sourcePathIds);
      assert.equal(controller.model.yarnFilter, 'all'); assert.equal(controller.model.evidenceView, false);
      assert.equal(controller.model.selectedLinkId, report.findings[0].sourcePathIds[0]);
      assert.equal(controller.model.auditReport, report); assert.ok(renderer().views.length > 0);
      assert.deepEqual(renderer().views.at(-1).target, [2, 3, 4], 'Focus uses the geometric witness, not a potentially distant path midpoint.');
      controller.clearAuditSelection(); await controller.ready(); assert.equal(renderer().scene.length, 3);
      controller.selectAuditFinding('unknown-id'); assert.equal(renderer().scene.length, 3);
    });
    await check('cancel ignores late progress and result without clearing geometry', async () => {
      controller.generateSwatch(); await controller.ready();
      const geometry = controller.model.derivedGeometry, run = controller.auditSwatch(), old = job();
      controller.cancelGeometryAudit(); assert.equal(old.options.isCancelled(), true);
      old.options.onProgress({ phase: 'STALE' }); old.resolve(result(geometry)); await run;
      assert.equal(controller.model.auditRunning, false); assert.equal(controller.model.auditReport, null);
      assert.notEqual(controller.model.auditProgress?.phase, 'STALE'); assert.equal(controller.model.derivedGeometry, geometry);
    });
    await check('old finally cannot stop a newer audit after geometry replacement', async () => {
      const oldRun = controller.auditSwatch(), old = job();
      controller.setOptions({ radiusMm: .03 }); await controller.ready();
      assert.equal(old.options.isCancelled(), true); const newRun = controller.auditSwatch(), current = job();
      old.reject(Error('old failure')); await oldRun;
      assert.equal(controller.model.auditRunning, true); assert.equal(controller.model.auditReport, null);
      current.resolve(result(current.input)); await newRun; assert.equal(controller.model.auditReport.status, 'COMPLETE');
    });
    await check('failed or incomplete audit is never cached or treated as complete', async () => {
      controller.generateSwatch(); await controller.ready();
      const run = controller.auditSwatch(); job().reject(Error('controlled audit failure')); await run;
      assert.equal(controller.model.auditReport.status, 'FAILED'); assert.ok(controller.model.derivedGeometry);
      const partial = controller.auditSwatch(); job().resolve(result(job().input, 'LIMIT_REACHED')); await partial;
      assert.equal(controller.model.auditReport.complete, false);
      const retry = controller.auditSwatch(); assert.equal(controller.model.auditRunning, true);
      job().resolve(result(job().input)); await retry;
    });
    await check('revision, snapshot identity and project generation invalidate in-flight results', async () => {
      for (const patch of [{ feedYarnStructureRevision: context.feedYarnStructureRevision + 1 },
        { machineSnapshot: { ...snapshot } }, { projectGeneration: context.projectGeneration + 1 }]) {
        controller.generateSwatch(); await controller.ready(); const run = controller.auditSwatch(), old = job();
        controller.updateContext({ ...context, ...patch }); assert.equal(old.options.isCancelled(), true);
        old.resolve(result(old.input)); await run; assert.equal(controller.model.auditReport, null);
        controller.updateContext(context); await controller.ready();
      }
    });
    await check('visual correction is explicit and invalidates audit while retaining renderer/source identities', async () => {
      controller.generateSwatch(); await controller.ready(); const run = controller.auditSwatch();
      job().resolve(result(job().input)); await run;
      assert.equal(corrections.length, 0, 'A complete audit cannot automatically apply a correction.');
      assert.equal(controller.model.correctionPlan.counts.eligible, 1);
      assert.equal(controller.selectRound11JointCase().status, 'READY');
      controller.setSelectionFilter({ row: 22 }); await controller.ready();
      const retainedFilter = controller.model.selectionFilter, retainedView = controller.model.view;
      const geometry = controller.model.derivedGeometry, target = renderer(), report = controller.model.auditReport;
      const edit = controller.applyGeometryCorrection(), correction = corrections.at(-1);
      await controller.applyGeometryCorrection(); assert.equal(corrections.length, 1);
      assert.equal(correction.input, geometry); assert.equal(correction.report, report);
      const revised = { ...geometry, scene: [...geometry.scene] };
      correction.resolve({ status: 'APPLIED', swatch: revised, report: { applied: 1, counts: { eligible: 1, skipped: 2 } } });
      await edit; await controller.ready();
      assert.equal(controller.model.derivedGeometry, revised); assert.equal(renderer(), target);
      assert.deepEqual(renderer().scene.map(item => item.id), geometry.scene.map(item => item.id));
      assert.equal(controller.model.auditReport, null); assert.equal(controller.model.correctionPlan, null);
      assert.equal(controller.model.correctionReport.applied, 1); assert.equal(controller.model.correctionRunning, false);
      assert.equal(controller.model.selectionFilter, retainedFilter, 'Single-candidate publication preserves the comparison filter.');
      assert.equal(controller.model.view, retainedView, 'Single-candidate publication preserves the camera.');
      const fresh = controller.auditSwatch(); assert.equal(job().input, revised);
      job().resolve(result(revised)); await fresh;
    });
    await check('failed or late correction cannot clear or replace current geometry', async () => {
      controller.setComparisonState('G0'); await controller.ready(); await controller.auditSwatch();
      const geometry = controller.model.derivedGeometry, failed = controller.applyGeometryCorrection();
      corrections.at(-1).reject(Error('controlled correction failure')); await failed;
      assert.equal(controller.model.derivedGeometry, geometry); assert.equal(controller.model.correctionReport.status, 'FAILED');
      const stale = controller.applyGeometryCorrection(), old = corrections.at(-1);
      controller.setOptions({ radiusMm: .04 }); await controller.ready(); const current = controller.model.derivedGeometry;
      old.resolve({ status: 'APPLIED', swatch: { ...geometry }, report: { applied: 1 } }); await stale;
      assert.equal(controller.model.derivedGeometry, current); assert.equal(controller.model.correctionReport, null);
    });
    await check('no selected single-case target cannot allocate or mutate geometry even after a complete audit', async () => {
      eligibleCount = 0; const run = controller.auditSwatch(); job().resolve(result(job().input)); await run;
      assert.equal(controller.model.jointTargetId, null);
      const count = corrections.length, geometry = controller.model.derivedGeometry;
      await controller.applyGeometryCorrection(); assert.equal(corrections.length, count);
      assert.equal(controller.model.derivedGeometry, geometry); eligibleCount = 1;
    });
    await check('source invalidation and disposal prevent late publication', async () => {
      controller.generateSwatch(); await controller.ready(); const run = controller.auditSwatch(), old = job();
      controller.updateContext({ ...context, machineSnapshotPending: true });
      old.resolve(result(old.input)); await run; assert.equal(controller.model.auditReport, null);
      controller.updateContext(context); await controller.ready(); const run2 = controller.auditSwatch(), old2 = job();
      controller.dispose(); old2.resolve(result(old2.input)); await run2;
      assert.equal(controller.model.auditReport, null); assert.equal(controller.model.auditRunning, false);
    });
  } finally { controller.dispose(); }
  const report = { fixtureSha256, passed: records.length, records, limitation: 'Controller lifecycle with stub detector; geometric accuracy separately validated.' };
  await fs.writeFile(path.join(archiveDir, 'audit-controller-result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
});
