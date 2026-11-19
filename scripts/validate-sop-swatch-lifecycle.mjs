import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { withSopFixtureSnapshot } from './helpers/sopFixtureSnapshot.mjs';
import { createSopTopologyWorkbenchController } from '../src/components/sopTopologyWorkbenchController.js';

// Focused controller tests: real SOP snapshot/topology, tiny derived scene, and
// controllable renderer readiness. Numerical geometry and real GPU/PBR behavior
// remain the responsibility of their existing validators and browser acceptance.
const serialize = value => JSON.stringify(value, (_, item) => item instanceof Map ? { map: [...item] }
  : item instanceof Set ? { set: [...item] } : item);
const tick = async () => { for (let n = 0; n < 6; n++) await Promise.resolve(); };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const records = [];

await withSopFixtureSnapshot(async ({ snapshot, project, archiveDir, fixtureSha256 }) => {
  const originalSnapshot = serialize(snapshot), originalProject = serialize(project);
  const yarnIds = [...new Set(snapshot.assignments.map(item => item.yarnId))];
  assert.ok(yarnIds.length >= 2, 'Actual fixture must retain independent main/second Yarn IDs.');
  const assets = yarnIds.map((id, index) => ({ id, pbr: { baseColor: `fixture-color-${index}` } }));
  const baseContext = { machineSnapshot: snapshot, projectGeneration: snapshot.projectGeneration,
    feedYarnStructureRevision: snapshot.feedYarnStructureRevision, workbenchMode: 'pbr25d', yarnLibrary: assets };
  function harness(context = baseContext) {
    const renderers = [], buildCalls = [], queuedReady = [];
    const buildSwatch = topology => {
      buildCalls.push(topology);
      const first = topology.links.filter(link => link.yarnId === yarnIds[0]).slice(0, 12);
      const second = topology.links.find(link => link.yarnId === yarnIds[1]);
      assert.ok(first.length >= 11 && second);
      const paths = [...first, second].map(link => ({ id: link.id, row: link.row, needle: link.needle,
        feedIndex: link.feedIndex, yarnIndex: link.yarnIndex, yarnId: link.yarnId,
        centerline: { points: [[0, 0, 0], [1, 0, 0]] },
        provenance: { occurrenceIds: [link.sourceOccurrenceId, link.targetOccurrenceId], linkIds: [link.id] } }));
      const scene = paths.map(item => ({ id: item.id, geometry: { fixture: true }, material: {} }));
      return { status: 'OK', paths, scene, evidenceScene: scene.filter((_, index) => index % 2 === 0),
        identity: topology.identity };
    };
    const createRenderer = callbacks => {
      const item = { callbacks, scene: [], updates: [], disposed: false, status: { status: 'READY' }, waiting: null,
        mount() { return this.status; },
        update(patch) {
          if ('scene' in patch) {
            this.scene = patch.scene; this.updates.push(patch.scene);
            if (patch.scene.length) this.waiting = queuedReady.shift()?.promise ?? Promise.resolve();
            if (!patch.scene.length && this.resetStatusOnClear) this.status = { status: 'EMPTY' };
          }
          return this.status;
        },
        ready() { return this.waiting ?? Promise.resolve(); },
        setView(view) { callbacks.onViewChange(view); }, fit() {},
        dispose() { this.scene = []; this.disposed = true; },
      };
      renderers.push(item); return item;
    };
    const controller = createSopTopologyWorkbenchController({ context, buildSwatch, createRenderer });
    controller.mount({});
    return { controller, renderers, buildCalls, queuedReady,
      get renderer() { return renderers.at(-1); },
      async generate() { controller.generateSwatch(); await controller.ready(); return controller.model.derivedGeometry; } };
  }
  async function check(name, run) {
    const h = harness();
    try {
      await run(h);
      assert.equal(serialize(snapshot), originalSnapshot, 'Source snapshot, Solver results and all Map paths must stay unchanged.');
      assert.equal(serialize(project), originalProject, 'SOP project/save facts must stay unchanged.');
      records.push({ name, status: 'PASS' });
    } catch (error) { records.push({ name, status: 'FAIL', message: error.message, stack: error.stack }); }
    finally { h.controller.dispose(); }
  }

  await check('cold source view allocates no renderer', async h => {
    assert.equal(h.renderers.length, 0); assert.equal(h.buildCalls.length, 0);
    assert.equal(h.controller.model.derivedGeometry, null);
  });
  for (const [name, patch] of [
    ['revision mismatch', { feedYarnStructureRevision: baseContext.feedYarnStructureRevision + 1 }],
    ['pending source', { machineSnapshotPending: true }],
    ['source error', { machineSnapshotError: 'controlled machine input rejection' }],
  ]) await check(`${name} clears current and late texture completion`, async h => {
    const gate = deferred(); h.queuedReady.push(gate); h.controller.generateSwatch();
    await tick(); assert.ok(h.renderer.scene.length);
    const prior = h.renderer;
    h.controller.updateContext({ ...baseContext, ...patch });
    assert.equal(h.controller.model.derivedGeometry, null); assert.equal(h.controller.model.topology.status, 'UNAVAILABLE');
    assert.deepEqual(prior.scene, []); assert.equal(prior.disposed, true);
    gate.resolve(); await tick();
    assert.equal(h.controller.model.derivedGeometry, null); assert.deepEqual(prior.scene, []);
  });
  await check('changed input signature supersedes in-flight texture rejection', async h => {
    const old = deferred(); h.queuedReady.push(old); h.controller.generateSwatch(); await tick();
    const prior = h.renderer;
    const replacement = { ...snapshot, inputSignature: `${snapshot.inputSignature}:replacement` };
    h.controller.updateContext({ ...baseContext, machineSnapshot: replacement }); await h.controller.ready();
    const current = h.controller.model.derivedGeometry;
    assert.ok(current); assert.equal(current.identity.inputSignature, replacement.inputSignature);
    old.reject(Error('obsolete texture failure')); await tick();
    assert.equal(h.controller.model.derivedGeometry, current); assert.equal(h.controller.model.error, null);
    assert.equal(prior.disposed, true); assert.ok(h.renderer.scene.length);
  });
  await check('new project clears bindings and refuses late completion', async h => {
    const gate = deferred(); h.queuedReady.push(gate); h.controller.generateSwatch(); await tick();
    h.controller.setMaterialBinding(yarnIds[0], yarnIds[1]);
    h.controller.updateContext({ ...baseContext, projectGeneration: baseContext.projectGeneration + 1 });
    gate.resolve(); await tick();
    assert.equal(h.controller.model.mode, 'SOURCE_TOPOLOGY_VIEW');
    assert.equal(h.controller.model.derivedGeometry, null); assert.deepEqual(h.controller.model.materialBindings, {});
    assert.ok(h.renderers.every(item => item.disposed));
  });
  await check('disposed workbench ignores late texture completion', async h => {
    const gate = deferred(); h.queuedReady.push(gate); h.controller.generateSwatch(); await tick();
    h.controller.dispose(); gate.resolve(); await tick();
    assert.equal(h.controller.model.derivedGeometry, null); assert.ok(h.renderers.every(item => item.disposed));
  });
  await check('current texture failure clears previous visible swatch', async h => {
    await h.generate(); assert.ok(h.renderer.scene.length);
    const gate = deferred(); h.queuedReady.push(gate); h.controller.setMaterialBinding(yarnIds[0], yarnIds[1]);
    gate.reject(Error('current texture decode failed')); await h.controller.ready();
    assert.equal(h.controller.model.derivedGeometry, null); assert.deepEqual(h.renderer.scene, []);
    assert.match(h.controller.model.error, /current texture decode failed/);
    h.controller.setView({ yaw: 1 }); h.controller.fit(); assert.deepEqual(h.renderer.scene, []);
  });
  await check('renderer status error cannot resurrect pending initial geometry after scene clear', async h => {
    const gate = deferred(); h.queuedReady.push(gate); h.controller.generateSwatch(); await tick();
    const failed = h.renderer;
    // Production renderer.update({scene:[]}) clears its failure and becomes EMPTY.
    // The controller must retain the failed generation even if ready() then resolves.
    failed.resetStatusOnClear = true;
    failed.status = { status: 'UNAVAILABLE', diagnostic: 'PBR preparation failed: controlled image decode' };
    failed.callbacks.onStatusChange(failed.status);
    assert.deepEqual(failed.scene, []); assert.equal(h.controller.model.derivedGeometry, null);
    gate.resolve(); await h.controller.ready();
    assert.equal(h.controller.model.derivedGeometry, null,
      'A failed initial texture generation must never republish geometry after clear resets renderer status.');
    assert.deepEqual(failed.scene, []); assert.match(h.controller.model.error, /controlled image decode/);
  });
  await check('obsolete material readiness rejection cannot clear newer applied scene', async h => {
    const geometry = await h.generate();
    const old = deferred(), latest = deferred(); h.queuedReady.push(old, latest);
    h.controller.setMaterialBinding(yarnIds[0], yarnIds[1]);
    h.controller.setMaterialBinding(yarnIds[0], yarnIds[0]);
    latest.resolve(); await h.controller.ready(); old.reject(Error('superseded texture decode')); await tick();
    assert.equal(h.controller.model.derivedGeometry, geometry); assert.equal(h.controller.model.error, null);
    assert.ok(h.renderer.scene.length); assert.equal(h.renderer.scene[0].material.pbr, assets[0].pbr);
  });
  await check('filters changed during first texture load apply before geometry publication', async h => {
    const gate = deferred(); h.queuedReady.push(gate); h.controller.generateSwatch(); await tick();
    h.controller.setYarnFilter(yarnIds[1]); h.controller.setEvidenceView(true);
    gate.resolve(); await h.controller.ready();
    const model = h.controller.model, allowed = new Set(model.derivedGeometry.evidenceScene.map(item => item.id));
    const byId = new Map(model.derivedGeometry.paths.map(item => [item.id, item]));
    assert.ok(h.renderer.scene.length, 'Fixture includes second Yarn in evidence scene.');
    assert.ok(h.renderer.scene.every(item => byId.get(item.id).yarnId === yarnIds[1] && allowed.has(item.id)),
      'First published scene must reflect filters changed while renderer readiness was pending.');
  });
  await check('appearance-only library change updates materials without geometry rebuild', async h => {
    const geometry = await h.generate(), calls = h.buildCalls.length;
    const replacementAssets = assets.map(item => ({ ...item, pbr: { baseColor: `${item.id}-replacement` } }));
    h.controller.updateContext({ ...baseContext, yarnLibrary: replacementAssets }); await h.controller.ready();
    assert.equal(h.buildCalls.length, calls); assert.equal(h.controller.model.derivedGeometry, geometry);
    assert.equal(h.renderer.scene[0].material.pbr, replacementAssets[0].pbr);
  });
  await check('evidence and exact occurrence selection keep snapshot and geometry identity', async h => {
    const geometry = await h.generate(), calls = h.buildCalls.length;
    const occurrenceId = geometry.paths[0].provenance.occurrenceIds[1];
    h.controller.setSelectionFilter({ occurrenceId }); await h.controller.ready();
    const expected = geometry.paths.filter(item => item.provenance.occurrenceIds.includes(occurrenceId)).map(item => item.id);
    assert.deepEqual(h.renderer.scene.map(item => item.id), expected,
      'Occurrence selection is exact identity membership, not substring matching (1 must not select 10/11).');
    const prefix = occurrenceId.slice(0, -1);
    h.controller.setSelectionFilter({ occurrenceId: prefix }); await h.controller.ready();
    assert.deepEqual(h.renderer.scene.map(item => item.id), geometry.paths.filter(item =>
      item.provenance.occurrenceIds.includes(prefix)).map(item => item.id),
    'An incomplete occurrence ID must not select every occurrence sharing its string prefix.');
    h.controller.setSelectionFilter({ occurrenceId: '' }); h.controller.setEvidenceView(true); await h.controller.ready();
    assert.deepEqual(h.renderer.scene.map(item => item.id), geometry.evidenceScene.map(item => item.id));
    assert.equal(h.buildCalls.length, calls); assert.equal(h.controller.model.derivedGeometry, geometry);
    const session = serialize(h.controller.exportSession());
    assert.ok(!/derivedGeometry|originalSolverResults|yarnPathLinks|machineSnapshot/.test(session));
  });
  const report = { validator: 'sop-swatch-lifecycle', fixtureSha256,
    passed: records.filter(item => item.status === 'PASS').length, failed: records.filter(item => item.status === 'FAIL').length,
    limitation: 'Real snapshot/controller with controlled small geometry and renderer readiness; does not validate GPU rasterization or physical accuracy.', records };
  await fs.writeFile(path.join(archiveDir, 'lifecycle-result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.failed) process.exitCode = 1;
});
