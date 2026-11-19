import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { withSopFixtureSnapshot } from './helpers/sopFixtureSnapshot.mjs';
import { createSopTopologyWorkbenchController } from '../src/components/sopTopologyWorkbenchController.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const serialize = value => JSON.stringify(value, (_, item) => item instanceof Map ? [...item] : item);
const cold = createSopTopologyWorkbenchController({ context: {} });
assert.equal(typeof cold.selectRound11JointCase, 'function', 'Round 11.1 requires explicit source-verified single-case selection.');
cold.dispose();

await withSopFixtureSnapshot(async ({ snapshot, project, server, archiveDir, fixtureSha256 }) => {
  const { buildSopVisualSwatch } = await server.ssrLoadModule('/src/simulation/sopSpatialHypothesis.js');
  const original = serialize(snapshot), persisted = serialize(project), jobs = [], trims = [], renderers = [];
  const context = { machineSnapshot: snapshot, projectGeneration: snapshot.projectGeneration,
    feedYarnStructureRevision: snapshot.feedYarnStructureRevision, workbenchMode: 'pbr25d', yarnLibrary: project.yarnLibrary };
  let built, missingIntent = false;
  const controller = createSopTopologyWorkbenchController({ context,
    buildSwatch(topology, options) {
      built = buildSopVisualSwatch(topology, options);
      if (missingIntent) built = { ...built, paths: built.paths.map(p => p.row === 22 && p.needle === 16 && p.yarnIndex === 1 &&
        p.geometryRole === 'VISUAL_TRANSITION' ? { ...p, provenance: { ...p.provenance, transitionToLinkIds: [] } } : p) };
      return built;
    },
    auditGeometry: async input => ({ status: 'COMPLETE', complete: true, findings: [], sources: {}, identity: input.identity }),
    planVisualCorrection: async () => ({ status: 'READY', counts: { eligible: 2820 } }),
    applyVisualCorrection() { throw Error('Legacy injection must not bypass the selected candidate builder or its source gate.'); },
    buildJointCandidate(input, audit, options) { const gate = deferred(); jobs.push({ input, audit, options, ...gate }); return gate.promise; },
    applyTrimDiagnostic(input, audit, options) { trims.push({ input, audit, options }); return { status: 'APPLIED',
      swatch: { ...input, scene: [...input.scene] }, report: { applied: 1, failure: 'KNOWN_DISCONNECTED_TRIM' } }; },
    createRenderer(callbacks) {
      const renderer = { status: { status: 'OK' }, scene: [], updates: [], mount() { return this.status; },
        update(patch) { this.updates.push(patch); if (patch.scene) this.scene = patch.scene; return this.status; },
        ready: async () => {}, setView(view) { callbacks.onViewChange(view); },
        profileOrbit: async () => ({ status: 'OK', fps: 140 }), dispose() {} };
      renderers.push(renderer); return renderer;
    } });
  try {
    controller.mount({}); controller.generateSwatch(); await controller.ready();
    const g0 = controller.model.derivedGeometry;
    assert.equal(controller.model.comparisonState, 'G0'); assert.equal(controller.model.comparisonStates.G0, g0);
    await controller.auditSwatch(); await controller.applyGeometryCorrection();
    assert.equal(jobs.length, 0, 'A complete audit cannot authorize an unselected or batch candidate.');
    assert.equal(controller.model.correctionReport, null, 'Legacy injection cannot bypass the same single-case guard.');
    const chosen = controller.selectRound11JointCase(); await controller.ready();
    assert.equal(chosen.status, 'READY'); assert.match(chosen.pathId, /\/visual:22:16:1:TRANSITION$/);
    assert.equal(renderers.at(-1).scene.length, g0.scene.length, 'Case selection keeps the complete neighborhood.');
    const targetId = chosen.pathId;
    await controller.createTrimDiagnostic(); await controller.ready();
    assert.deepEqual(trims[0].options.pathIds, [targetId]); assert.equal(trims[0].input, g0);
    assert.equal(controller.model.comparisonState, 'Gt');
    assert.equal(controller.model.auditReport, null); assert.equal(controller.model.comparisonStates.G0, g0);
    const gt = controller.model.derivedGeometry;
    controller.setComparisonState('G0'); await controller.ready(); await controller.auditSwatch();
    controller.setSelectionFilter({ row: 22 }); controller.setYarnFilter(g0.paths.find(p => p.id === targetId).yarnId);
    controller.setScanAxis('y'); controller.setDebugMode('normals'); controller.setView({ yaw: .7, pitch: .3, distance: 1 });
    await controller.ready(); await controller.profileSwatch();
    const beforeView = controller.model.view, beforeFilter = controller.model.selectionFilter;
    const pending = controller.applyGeometryCorrection(), job = jobs.at(-1);
    assert.equal(job.input, g0); assert.equal(job.options.pathId, targetId);
    const gn = { ...g0, scene: [...g0.scene] };
    job.resolve({ status: 'APPLIED', swatch: gn, report: { applied: 1, acceptance: 'CANDIDATE_ONLY' } });
    await pending; await controller.ready();
    assert.equal(controller.model.comparisonState, 'Gn'); assert.equal(controller.model.derivedGeometry, gn);
    assert.equal(controller.model.comparisonStates.Gt, gt); assert.equal(controller.model.comparisonStates.G0, g0);
    assert.equal(controller.model.view, beforeView); assert.equal(controller.model.selectionFilter, beforeFilter);
    assert.equal(controller.model.scanAxis, 'y'); assert.equal(controller.model.debugMode, 'normals');
    assert.equal(renderers.at(-1).updates.at(-1).debugMode, 'normals');
    assert.equal(controller.model.profileReport, null); assert.equal(controller.model.auditReport, null);
    await controller.auditSwatch();
    const exported = controller.exportGeometryAudit();
    assert.equal(exported.comparison.state, 'Gn'); assert.equal(exported.comparison.geometryVersion, controller.model.geometryVersion);
    assert.equal(exported.findings, controller.model.auditReport.findings, 'Export context cannot rewrite audit evidence.');
    assert.ok(!/comparisonState|jointTargetId|debugMode|geometryVersion|CANDIDATE_ONLY/.test(serialize(controller.exportSession())));
    controller.setComparisonState('G0'); await controller.ready(); await controller.auditSwatch();
    const cancelled = controller.applyGeometryCorrection(), old = jobs.at(-1);
    controller.cancelGeometryCorrection(); assert.equal(old.options.isCancelled(), true);
    old.resolve({ status: 'APPLIED', swatch: gn, report: { applied: 1 } }); await cancelled;
    assert.equal(controller.model.derivedGeometry, g0); assert.equal(controller.model.comparisonStates.Gn, null);
    const failed = controller.applyGeometryCorrection(); jobs.at(-1).resolve({ status: 'REJECTED', swatch: g0, report: { reason: 'FIXED_RADIUS_INFEASIBLE' } }); await failed;
    assert.equal(controller.model.derivedGeometry, g0); assert.equal(controller.model.comparisonStates.Gn, null);
    const stale = controller.applyGeometryCorrection(), obsolete = jobs.at(-1);
    controller.updateContext({ ...context, machineSnapshotPending: true });
    assert.equal(obsolete.options.isCancelled(), true);
    obsolete.resolve({ status: 'APPLIED', swatch: gn, report: { applied: 1 } }); await stale;
    assert.equal(controller.model.derivedGeometry, null); assert.equal(controller.model.comparisonStates.G0, null);
    assert.equal(controller.model.comparisonStates.Gt, null); assert.equal(controller.model.jointTargetId, null);
    missingIntent = true; controller.updateContext(context); await controller.ready();
    assert.equal(controller.selectRound11JointCase().status, 'REJECTED', 'Missing intended endpoint refs must reject selection.');
    assert.equal(controller.model.jointTargetId, null);
    assert.equal(serialize(snapshot), original); assert.equal(serialize(project), persisted);
    const report = { status: 'PASS', fixtureSha256, checks: ['G0 default', 'source-verified single case', 'full neighborhood',
      'explicit single Gt', 'immutable three states', 'camera/filter/PBR retained', 'audit/profile expiry', 'context export',
      'cancel/failure/revision stale protection', 'missing intent rejection', 'source and persistence unchanged'],
      limitation: 'Real SOP geometry/controller with injected audit/candidate and renderer; candidate numerical correctness is tested separately.' };
    await fs.writeFile(path.join(archiveDir, 'joint-lifecycle-result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { controller.dispose(); }
});
