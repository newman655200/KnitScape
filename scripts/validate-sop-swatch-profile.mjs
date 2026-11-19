import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { withSopFixtureSnapshot } from './helpers/sopFixtureSnapshot.mjs';

// A selectable archived module permits a red check without replacing live work.
const controllerUrl = process.env.KNITSCAPE_PROFILE_CONTROLLER
  ? pathToFileURL(path.resolve(process.env.KNITSCAPE_PROFILE_CONTROLLER))
  : new URL('../src/components/sopTopologyWorkbenchController.js', import.meta.url);
const { createSopTopologyWorkbenchController } = await import(controllerUrl.href);
const cold = createSopTopologyWorkbenchController({ context: {} });
assert.equal(typeof cold.profileSwatch, 'function', 'Controller must expose the transient profileSwatch action.');
cold.dispose();

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const serialize = value => JSON.stringify(value, (_, item) => item instanceof Map ? [...item]
  : item instanceof Set ? [...item] : item);
const records = [];

// Real SOP computation/topology, but only two fake meshes: this checks controller
// publication/isolation, never substitutes for real browser CPU/GPU measurement.
await withSopFixtureSnapshot(async ({ snapshot, project, fixtureSha256, archiveDir }) => {
  const sourceBefore = serialize(snapshot), projectBefore = serialize(project);
  const context = { machineSnapshot: snapshot, projectGeneration: snapshot.projectGeneration,
    feedYarnStructureRevision: snapshot.feedYarnStructureRevision, workbenchMode: 'pbr25d',
    yarnLibrary: project.yarnLibrary };
  const renderers = [];
  const controller = createSopTopologyWorkbenchController({ context,
    buildSwatch(topology) {
      const links = [...new Map(topology.links.map(link => [link.yarnId, link])).values()].slice(0, 2);
      assert.equal(links.length, 2, 'Real fixture must retain both independent yarns.');
      const paths = links.map(link => ({ id: link.id, yarnId: link.yarnId, row: link.row, needle: link.needle,
        provenance: { occurrenceIds: [link.sourceOccurrenceId, link.targetOccurrenceId], linkIds: [link.id] } }));
      const scene = paths.map(item => ({ id: item.id, geometry: { fixture: true }, material: {} }));
      return { status: 'OK', identity: topology.identity, paths, scene, evidenceScene: scene };
    },
    createRenderer() {
      const renderer = { status: { status: 'OK' }, scene: [], profiles: [], disposed: false,
        mount() { return this.status; },
        update(patch) { if ('scene' in patch) this.scene = patch.scene; return this.status; },
        ready() { return Promise.resolve(); },
        profileOrbit(options) { const gate = deferred(); this.profiles.push({ options, ...gate }); return gate.promise; },
        dispose() { this.scene = []; this.disposed = true; } };
      renderers.push(renderer); return renderer;
    } });
  const renderer = () => renderers.at(-1);
  const start = () => { const promise = controller.profileSwatch(); return { promise, gate: renderer().profiles.at(-1) }; };
  async function check(name, run) {
    await run();
    assert.equal(serialize(snapshot), sourceBefore, 'Profiling must not change source/CN/Solver snapshot.');
    assert.equal(serialize(project), projectBefore, 'Profiling must not change persisted project facts.');
    assert.ok(!/profileRunning|profileReport|fps|gpuMs/.test(serialize(controller.exportSession())),
      'Performance samples are transient and must not enter the session export.');
    records.push({ name, status: 'PASS' });
  }
  try {
    await check('cold profiling is a no-op without allocating a renderer', async () => {
      controller.mount({}); await controller.profileSwatch();
      assert.equal(renderers.length, 0);
      assert.equal(controller.model.profileRunning, false); assert.equal(controller.model.profileReport, null);
    });
    controller.generateSwatch(); await controller.ready();
    const geometry = controller.model.derivedGeometry;
    assert.ok(geometry); assert.equal(renderer().scene.length, 2);

    await check('120-frame request publishes one report; concurrent request is ignored', async () => {
      const first = start();
      assert.deepEqual(first.gate.options, { frames: 120 });
      assert.equal(controller.model.profileRunning, true); assert.equal(controller.model.profileReport, null);
      await controller.profileSwatch(); assert.equal(renderer().profiles.length, 1);
      const report = { status: 'OK', frames: 120, fps: 48, gpuMs: null };
      first.gate.resolve(report); await first.promise;
      assert.equal(controller.model.profileReport, report); assert.equal(controller.model.profileRunning, false);
      assert.equal(controller.model.derivedGeometry, geometry);
    });
    await check('failed profiling reports error without clearing valid geometry', async () => {
      const next = start(); assert.equal(controller.model.profileReport, null);
      next.gate.reject(Error('controlled timer failure')); await next.promise;
      assert.deepEqual(controller.model.profileReport, { status: 'FAILED', reason: 'controlled timer failure' });
      assert.equal(controller.model.profileRunning, false); assert.equal(controller.model.derivedGeometry, geometry);
      assert.equal(renderer().scene.length, 2);
    });
    await check('scene filter change discards old result and old finally cannot stop newer profile', async () => {
      const old = start(); controller.setYarnFilter(geometry.paths[0].yarnId); await controller.ready();
      assert.equal(controller.model.profileRunning, false); assert.equal(controller.model.profileReport, null);
      assert.equal(renderer().scene.length, 1);
      const current = start(); old.gate.resolve({ status: 'OK', stale: true }); await old.promise;
      assert.equal(controller.model.profileReport, null); assert.equal(controller.model.profileRunning, true);
      current.gate.resolve({ status: 'OK', filtered: true }); await current.promise;
      assert.deepEqual(controller.model.profileReport, { status: 'OK', filtered: true });
    });
    await check('renderer replacement discards old rejection without cancelling new profile', async () => {
      const oldRenderer = renderer(), old = start(); controller.generateSwatch(); await controller.ready();
      assert.notEqual(renderer(), oldRenderer); assert.equal(oldRenderer.disposed, true);
      assert.equal(controller.model.profileReport, null);
      const current = start(); old.gate.reject(Error('obsolete renderer timer failure')); await old.promise;
      assert.equal(controller.model.profileReport, null); assert.equal(controller.model.profileRunning, true);
      current.gate.resolve({ status: 'OK', replacement: true }); await current.promise;
      assert.deepEqual(controller.model.profileReport, { status: 'OK', replacement: true });
    });
    await check('source invalidation clears report/running and discards late result', async () => {
      const old = start(); controller.updateContext({ ...context, machineSnapshotPending: true });
      assert.equal(controller.model.profileRunning, false); assert.equal(controller.model.profileReport, null);
      assert.equal(controller.model.derivedGeometry, null); assert.equal(renderer().disposed, true);
      old.gate.resolve({ status: 'OK', stale: true }); await old.promise;
      assert.equal(controller.model.profileReport, null); assert.equal(controller.model.profileRunning, false);
    });
    controller.updateContext(context); await controller.ready();
    await check('dispose ignores late completion and clears transient state', async () => {
      const old = start(); controller.dispose(); old.gate.resolve({ status: 'OK', stale: true }); await old.promise;
      assert.equal(controller.model.profileReport, null); assert.equal(controller.model.profileRunning, false);
      assert.equal(controller.model.derivedGeometry, null); assert.equal(renderer().disposed, true);
    });
  } finally { controller.dispose(); }
  const report = { validator: 'sop-swatch-profile', fixtureSha256, passed: records.length, records,
    limitation: 'Controller state/race validation with real SOP snapshot and two stub meshes, not a performance benchmark.' };
  await fs.writeFile(path.join(archiveDir, 'profile-controller-result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
});
