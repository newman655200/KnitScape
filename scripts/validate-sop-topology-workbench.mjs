import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createServer } from 'vite';
import { withSopFixtureSnapshot, SOP_FIXTURE_PATH } from './helpers/sopFixtureSnapshot.mjs';

const serialize = value => JSON.stringify(value, (_, item) => item instanceof Map ? { map: [...item] } : item instanceof Set ? { set: [...item] } : item);
const renderers = [];
const createRenderer = callbacks => {
  const renderer = { callbacks, scene: null, disposed: false, status: { status: 'READY' }, reject: false,
    mount() { return this.status; }, update(patch) { if (this.reject && patch.scene?.length) return { status: 'INVALID', diagnostic: 'controlled rejection' };
      if ('scene' in patch) this.scene = patch.scene; return this.status; },
    setView(view) { callbacks.onViewChange(view); }, fit() {}, dispose() { this.scene = null; this.disposed = true; } };
  renderers.push(renderer); return renderer;
};

assert.ok(fs.existsSync('src/components/sopTopologyWorkbenchController.js'), 'Round6 SOP controller must exist.');
const { createSopTopologyWorkbenchController } = await import('../src/components/sopTopologyWorkbenchController.js');
// Round9 is another view of the same published snapshot, never another computation owner.
await withSopFixtureSnapshot(async ({ snapshot, project }) => {
  const before = serialize(snapshot), context = { ...project, projectGeneration: snapshot.projectGeneration,
    feedYarnStructureRevision: snapshot.feedYarnStructureRevision, workbenchMode: 'pbr25d', machineSnapshot: snapshot };
  const controller = createSopTopologyWorkbenchController({ context, createRenderer });
  controller.mount({});
  assert.equal(typeof controller.generateSwatch, 'function', 'Round9 full-window generation is available in existing controller.');
  controller.generateSwatch(); await controller.ready();
  assert.equal(controller.model.mode, 'VISUAL_SWATCH_TEST_ONLY');
  assert.equal(controller.model.derivedGeometry?.status, 'OK');
  assert.equal(controller.model.topology.operations.length, project.width * project.height);
  const fullCount = renderers.at(-1).scene.length;
  const yarnId = snapshot.assignments[0].yarnId;
  controller.setYarnFilter(yarnId);
  assert.ok(renderers.at(-1).scene.length > 0 && renderers.at(-1).scene.length < fullCount);
  controller.setSelectionFilter({ row: 21, needle: 16, feedIndex: null });
  assert.ok(renderers.at(-1).scene.length > 0 && renderers.at(-1).scene.length < 20);
  controller.setEvidenceView(true);
  assert.ok(renderers.at(-1).scene.length > 0);
  assert.ok(renderers.at(-1).scene.every(item => item.geometryRole !== 'VISUAL_TRANSITION' && item.geometryRole !== 'HELD_LOOP_VISUAL'));
  controller.setMaterialBinding(yarnId, project.yarnLibrary[0].id);
  await controller.ready();
  assert.equal(controller.model.materialBindings[yarnId], project.yarnLibrary[0].id);
  controller.updateContext({ ...context, machineSnapshotPending: true });
  assert.equal(controller.model.derivedGeometry, null); assert.equal(controller.model.topology.status, 'UNAVAILABLE');
  controller.updateContext(context); await controller.ready();
  assert.ok(controller.model.derivedGeometry);
  controller.setOptions({ radiusMm: NaN }); await controller.ready();
  assert.equal(controller.model.derivedGeometry, null, 'Invalid visual geometry clears old swatch.');
  controller.updateContext({ ...context, projectGeneration: context.projectGeneration + 1 });
  assert.equal(controller.model.mode, 'SOURCE_TOPOLOGY_VIEW');
  assert.deepEqual(controller.model.materialBindings, {});
  controller.dispose(); assert.equal(serialize(snapshot), before);
  console.log('PASS Round9 full-window generation, evidence/yarn/cell filtering, material binding, invalid input and generation isolation');
});
renderers.length = 0;
await withSopFixtureSnapshot(async ({ snapshot }) => {
  const before = serialize(snapshot), context = { projectGeneration: snapshot.projectGeneration,
    feedYarnStructureRevision: snapshot.feedYarnStructureRevision, workbenchMode: 'pbr25d', machineSnapshot: snapshot };
  const controller = createSopTopologyWorkbenchController({ context, createRenderer });
  controller.mount({});
  assert.equal(renderers.length, 0, 'Source view must never instantiate experimental GPU.');
  assert.equal(controller.model.mode, 'SOURCE_TOPOLOGY_VIEW');
  assert.equal(controller.model.topology.status, 'READY');
  assert.deepEqual(controller.model.topology.operations.map(x => x.operation), ['K', 'T', 'T', 'K']);
  assert.equal(controller.model.derivedGeometry, null);
  controller.setHypothesisEnabled(true); await controller.ready();
  assert.equal(renderers.length, 1);
  assert.ok(controller.model.derivedGeometry?.paths.length > 0, 'Explicit enabled hypothesis produces geometry from actual fixture.');
  assert.ok(renderers[0].scene.length > 1, 'Independent mesh/material identities reach shared renderer.');
  assert.equal(controller.model.derivedGeometry.relaxationEligibility.status, 'UNSUPPORTED_CONSTRAINTS');
  controller.selectLink(controller.model.derivedGeometry.paths[0].id);
  controller.focusSelected();
  assert.deepEqual(controller.model.view.target, controller.model.derivedGeometry.paths[0].centerline.points[32]);
  assert.ok(controller.model.view.distance < .1, 'Radius-scaled closeup uses the existing camera.');
  controller.setOptions({ radiusMm: .06 }); await controller.ready();
  assert.equal(controller.model.derivedGeometry, null); assert.match(controller.model.error, /LOCAL_TUBE_FOLD/);
  assert.equal(controller.model.topology.status, 'READY');
  controller.setOptions({ radiusMm: .002 }); await controller.ready(); assert.ok(controller.model.derivedGeometry);
  controller.setHypothesisEnabled(false); assert.equal(controller.model.derivedGeometry, null); assert.ok(renderers[0].disposed);
  controller.setHypothesisEnabled(true); controller.setROI({ rowStart: NaN }); await controller.ready();
  assert.equal(controller.model.derivedGeometry, null); assert.notEqual(controller.model.topology.status, 'READY');
  controller.setROI({ rowStart: 21 }); await controller.ready();
  assert.ok(controller.model.derivedGeometry);
  controller.updateContext({ ...context, machineSnapshotPending: true });
  assert.equal(controller.model.derivedGeometry, null); assert.equal(controller.model.topology.status, 'UNAVAILABLE');
  assert.equal(controller.model.topology.continuity?.chains?.length ?? 0, 0, 'Pending snapshot clears old chains.');
  await controller.ready(); assert.equal(controller.model.derivedGeometry, null);
  controller.updateContext(context); await controller.ready(); assert.ok(controller.model.derivedGeometry);
  const oldCallbacks = renderers.at(-1).callbacks;
  controller.updateContext({ ...context, machineSnapshot: { ...snapshot, inputSignature: 'changed-signature' } });
  assert.equal(controller.model.derivedGeometry, null);
  oldCallbacks.onStatusChange({ status: 'READY' }); assert.equal(controller.model.derivedGeometry, null);
  await controller.ready(); assert.equal(controller.model.topology.identity.inputSignature, 'changed-signature');
  const previousSnapshotKey = controller.model.topology.identity.key;
  const previousChainIds = new Set(controller.model.topology.continuity.chains.map(chain => chain.id));
  controller.updateContext({ ...context, machineSnapshot: { ...snapshot, inputSignature: 'changed-signature' } });
  assert.ok(controller.model.derivedGeometry === null, 'A replacement snapshot with the same signature invalidates snapshot-local identities.');
  await controller.ready(); assert.notEqual(controller.model.topology.identity.key, previousSnapshotKey);
  assert.ok(controller.model.topology.continuity.chains.every(chain => !previousChainIds.has(chain.id)), 'Replacement snapshot invalidates every prior chain ID.');
  renderers.at(-1).reject = true; controller.setYarnFilter(snapshot.assignments[0].yarnId);
  assert.equal(controller.model.derivedGeometry, null); assert.deepEqual(renderers.at(-1).scene, []);
  controller.setView({ yaw: .5 }); controller.fit(); assert.equal(controller.model.derivedGeometry, null);
  controller.updateContext({ ...context, machineSnapshotError: 'machine rejected' });
  assert.equal(controller.model.topology.reason, 'MACHINE_SNAPSHOT_ERROR');
  controller.updateContext({ ...context, feedYarnStructureRevision: context.feedYarnStructureRevision + 1 });
  assert.equal(controller.model.derivedGeometry, null, 'Old snapshot cannot survive structure revision mismatch.');
  assert.equal(controller.model.topology.continuity?.chains?.length ?? 0, 0, 'Old evidence cannot survive revision mismatch.');
  controller.updateContext({ ...context, projectGeneration: context.projectGeneration + 1 });
  assert.equal(controller.model.mode, 'SOURCE_TOPOLOGY_VIEW'); assert.equal(controller.model.derivedGeometry, null);
  controller.updateContext(context); controller.setHypothesisEnabled(true); controller.dispose(); await controller.ready();
  assert.equal(controller.model.derivedGeometry, null); assert.ok(renderers.every(x => x.disposed));
  const saved = controller.exportSession();
  assert.ok(!/derivedGeometry|topology|machineSnapshot/.test(JSON.stringify(saved)), 'Session holds only view and ROI options.');
  assert.equal(serialize(snapshot), before, 'All source paths/CN/metrics including Map entries remain byte-identical.');
  console.log('PASS actual SOP source/default GPU isolation, explicit hypothesis, ROI/pending/revision/generation/stale teardown and source immutability');
});

// Exercise actual Lit templates and event closures, and the current app coordinator.
// The only substitutes are DOM painting, canvas surfaces and GPU allocation.
const loaded = new Set(), calls = { compute: 0, solver: 0, machine: 0 };
globalThis.__sopCalls = calls;
const server = await createServer({ configFile: false, appType: 'custom', logLevel: 'silent',
  cacheDir: process.env.KNITSCAPE_TEST_CACHE_DIR || path.join(os.tmpdir(), 'knitscape-validation', 'sop-topology-workbench', 'vite-cache'),
  server: { middlewareMode: true, hmr: { server: http.createServer() } },
  plugins: [{ name: 'sop-workbench-observation', enforce: 'pre', transform(source, id) {
    const file = id.replaceAll('\\', '/'); loaded.add(file);
    if (/\/views\/(?:sopTopology|yarnSpatial)Workbench\.js$/.test(file)) return source.replaceAll('render(', 'globalThis.__sopRender(');
    for (const [name, marker, key] of [['computeYarnSimulation', '  if (scope !==', 'compute'],
      ['yarnLengthSolver', '  gauge = normalizeMachineGauge(gauge);', 'solver']]) {
      if (file.endsWith(`/simulation/${name}.js`)) { assert.ok(source.includes(marker)); return source.replace(marker, `globalThis.__sopCalls.${key}++;\n${marker}`); }
    }
    if (file.endsWith('/domain/singleJerseyMachine.js')) {
      const marker = '  const camFeedCount = validateCamProgram(camProgram);';
      assert.ok(source.includes(marker)); return source.replace(marker, `globalThis.__sopCalls.machine++;\n${marker}`);
    }
  } }] });
const flatten = value => value?.strings ? value.strings.reduce((text, piece, i) => text + piece + flatten(value.values[i]), '') :
  Array.isArray(value) ? value.map(flatten).join('') : typeof value === 'string' || typeof value === 'number' ? String(value) : '';
function templates(value, predicate) {
  const found = value?.strings && predicate(value) ? [value] : [];
  return found.concat((Array.isArray(value) ? value : value?.values ?? []).flatMap(child => templates(child, predicate)));
}
const eventFor = (template, marker, event = 'change') => {
  const owner = templates(template, item => item.strings.join('').includes(marker))[0];
  assert.ok(owner, `Missing actual template control ${marker}`);
  const markerIndex = owner.strings.findIndex(piece => piece.includes(marker));
  const index = owner.strings.findIndex((piece, index) => index >= markerIndex && piece.trimEnd().endsWith(`@${event}=`));
  assert.ok(index >= 0); return owner.values[index];
};
let runner, opened;
try {
  const { createSpatialWorkbenchHost } = await server.ssrLoadModule('/src/components/spatialWorkbenchHost.js');
  const cold = createSpatialWorkbenchHost({ getContext: () => ({ workbenchMode: 'classic2d', projectGeneration: 0 }), getContainer: () => null });
  cold.sync(); await cold.ready(); cold.dispose();
  assert.ok(![...loaded].some(id => /sopTopology|sopSpatial|yarnSpatialPreviewRenderer|yarnRelaxation/.test(id)), 'Cold Classic loads no experiment implementation.');
  assert.deepEqual(calls, { compute: 0, solver: 0, machine: 0 });
  globalThis.devicePixelRatio = 1;
  globalThis.Path2D = class { constructor(data = '') { this.data = data; } };
  const timers = new Map(); let timerId = 0;
  globalThis.window = { location: { search: '' }, setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); }, addEventListener() {}, removeEventListener() {} };
  const nodes = new Map();
  for (const id of ['back', 'mid', 'front', 'back-arranged', 'mid-arranged', 'front-arranged', 'pbr-back', 'pbr-mid', 'pbr-front'])
    nodes.set(id, { id, width: 0, height: 0, style: {}, getContext(kind) {
      assert.equal(kind, '2d'); return { clearRect() {}, save() {}, restore() {}, stroke() {}, createPattern() { return null; }, drawImage() {} };
    } });
  for (const id of ['sim-container', 'sim-before-container', 'sim-after-container', 'pbr-preview-container', 'desktop'])
    nodes.set(id, { getBoundingClientRect: () => ({ width: 640, height: 480, left: 0, top: 0 }), addEventListener() {}, removeEventListener() {} });
  nodes.set('machine-execution-error', { hidden: true, textContent: '' });
  globalThis.document = { title: '', documentElement: { lang: '' }, createTreeWalker() { return {}; }, getElementById: id => nodes.get(id) ?? null };
  globalThis.__sopRender = (template, container) => { container.template = template; };
  const state = await server.ssrLoadModule('/src/state.js');
  const { loadJSON } = await server.ssrLoadModule('/src/actions/importers.js');
  const { buildChartFromRepeats } = await server.ssrLoadModule('/src/lib/buildChartFromRepeats.js');
  const { getProjectData } = await server.ssrLoadModule('/src/actions/exporters.js');
  const { createProjectPackage, readProjectPackage } = await server.ssrLoadModule('/src/actions/projectPackage.js');
  opened = await readProjectPackage(new Blob([fs.readFileSync(process.env.KNITSCAPE_SOP_FIXTURE || SOP_FIXTURE_PATH)]));
  loadJSON(opened.project, opened.registry);
  state.dispatch({ chart: buildChartFromRepeats({ repeats: state.GLOBAL_STATE.repeats, width: opened.project.width, height: opened.project.height, emptyColor: 0 }) });
  runner = await server.ssrLoadModule('/src/components/runSimulation.js');
  state.StateMonitor.register([runner.runSimulation()]); await runner.whenSimulationPreviewsReady();
  const baseline = state.GLOBAL_STATE, snapshots = runner.getCurrentSimulationSnapshots(), counts = { ...calls };
  assert.ok(counts.compute > 0 && counts.solver > 0 && counts.machine > 0, 'Real machine/CN/Solver executed from fixture.');
  assert.equal(snapshots.machine.occurrences.length, 10560); assert.equal(snapshots.machine.yarnPathLinks.length, 10559);
  assert.equal(snapshots.machine.originalSolverResults.length, 16);
  const snapshotBytes = serialize(snapshots), projectBytes = serialize(getProjectData());
  const packageBefore = await readProjectPackage(await createProjectPackage(getProjectData()));
  const unchanged = () => {
    for (const key of ['yarnLengthSolverResults', 'yarnLengthMetrics', 'previewValidity', 'feedYarnStructureRevision', 'projectGeneration',
      'yarnLibrary', 'singleJerseyCamProgram', 'chart', 'repeats', 'needleArrangement']) assert.equal(state.GLOBAL_STATE[key], baseline[key], `Original ${key} identity preserved`);
    assert.equal(runner.getCurrentSimulationSnapshots().machine, snapshots.machine);
    assert.equal(serialize(runner.getCurrentSimulationSnapshots()), snapshotBytes, 'CN, links, occurrences, applied/base paths, UV and metrics remain byte-identical.');
    assert.equal(serialize(getProjectData()), projectBytes); assert.deepEqual(calls, counts, 'No Machine/CN/Solver re-entry.');
  };
  const context = { ...baseline, workbenchMode: 'pbr25d', machineSnapshot: snapshots.machine };
  const { createSopTopologyWorkbench } = await server.ssrLoadModule('/src/views/sopTopologyWorkbench.js');
  const viewport = {}, container = { querySelector: selector => selector === '[data-sop-viewport]' ? viewport : null };
  const beforeRenderers = renderers.length;
  const widget = createSopTopologyWorkbench({ container, context, createRenderer });
  unchanged(); assert.equal(renderers.length, beforeRenderers);
  let markup = flatten(container.template);
  const mechanismRows = () => templates(container.template, item => item.strings.join('').includes('<tr data-sop-mechanism-operation'));
  assert.equal(mechanismRows().length, 3, 'Round8 shows K/T/M definitions even when the ROI contains no M.');
  for (const row of mechanismRows()) {
    const text = flatten(row);
    for (const label of ['SOURCE_CONFIRMED', 'LITERATURE_REFERENCE_ONLY', 'GENERAL_REFERENCE_ONLY',
      'data-machine-evidence=UNKNOWN', '适用条件', '未知原因', '空间建模影响', 'https://www.acimit.it/']) {
      assert.ok(text.includes(label), `Round8 separates software, general reference and unknown machine evidence: ${label}`);
    }
    assert.ok(!/data-machine-evidence=(?:MACHINE_DOCUMENT_CONFIRMED|OBSERVED_ON_MACHINE)/.test(text), 'Literature must never be shown as this machine confirmed.');
  }
  assert.ok(markup.includes('Round 8 · K/T/M 机器机制证据'));
  assert.ok(markup.includes('舌针'), 'Needle-structure condition remains visible, not an unconditional event.');
  for (const label of ['连续性证据', 'YarnChain', 'CONFIRMED_FROM_SOURCE', 'CANDIDATE_FROM_MODEL',
    '物理连续性：UNKNOWN', 'data-sop-continuity', 'NOT_COMPARABLE']) {
    assert.ok(markup.includes(label), `Round7 actual Lit exposes ${label}`);
  }
  const continuityPaths = () => templates(container.template, item => item.strings.join('').includes('data-sop-continuity-edge'));
  assert.ok(continuityPaths().length > 0, 'Evidence view consumes current adapter relations.');
  const candidatePaths = continuityPaths().filter(item => flatten(item).includes('CANDIDATE_FROM_MODEL'));
  const softwarePaths = continuityPaths().filter(item => flatten(item).includes('MODEL_PATH_ADJACENCY'));
  assert.ok(candidatePaths.length > 0 && softwarePaths.length > 0, 'Candidate and software evidence are both visible with explicit status.');
  assert.ok(candidatePaths.every(item => flatten(item).includes('7 4')), 'Candidate relations use a distinct dashed stroke.');
  assert.ok(softwarePaths.every(item => flatten(item).includes('none')), 'Software facts use solid strokes, not physical confirmation.');
  for (const label of ['SOURCE_TOPOLOGY_VIEW', '润山', 'UNKNOWN', 'CN_REFERENCE', 'SPATIAL_ORDER', 'CONTACT', 'TEST_ONLY',
    '2234', '2334', '2434', '2534', 'NOT_AVAILABLE_IN_SNAPSHOT', 'CLIPPED', 'MODEL_NEEDLE_PITCH']) assert.ok(markup.includes(label), `Actual Lit exposes ${label}`);
  const rows = () => templates(container.template, item => item.strings.join('').includes('<tr data-sop-occurrence'));
  assert.equal(rows().length, 24);
  const yarnIds = [...new Set(snapshots.machine.assignments.map(item => item.yarnId))];
  for (const yarn of yarnIds) {
    eventFor(container.template, 'data-sop-yarn')({ currentTarget: { value: yarn } }); assert.equal(rows().length, 12); unchanged();
  }
  eventFor(container.template, 'data-sop-yarn')({ currentTarget: { value: 'all' } });
  const pathTemplate = templates(container.template, item => item.strings.join('').includes('<path d='))[0];
  assert.ok(pathTemplate.values.some(value => typeof value === 'string' && value.startsWith('M')), 'Actual applied source curve is the SVG d attribute.');
  const clickIndex = pathTemplate.strings.findIndex(piece => piece.endsWith('@click=')); pathTemplate.values[clickIndex]();
  assert.ok(flatten(container.template).includes('sourceOccurrenceId')); unchanged();
  eventFor(container.template, 'data-sop-enable')({ currentTarget: { checked: true } }); await widget.ready();
  assert.ok(widget.derivedGeometry?.scene.length); unchanged();
  assert.ok(flatten(container.template).includes('data-sop-chain-lengths'), 'Enabled view shows current per-chain length/join audit.');
  assert.ok(flatten(container.template).includes('UNSUPPORTED_CONSTRAINTS'));
  for (const field of ['data-sop-amplitude', 'data-sop-radius']) {
    eventFor(container.template, field, 'input')({ currentTarget: { valueAsNumber: NaN } }); await widget.ready();
    assert.equal(widget.derivedGeometry, null); assert.ok(flatten(container.template).includes('候选已清除')); unchanged();
    assert.ok(!flatten(container.template).includes('data-sop-chain-lengths'), 'Failed geometry clears old chain length candidates.');
    eventFor(container.template, field, 'input')({ currentTarget: { valueAsNumber: field.endsWith('amplitude') ? .3 : .002 } }); await widget.ready();
  }
  eventFor(container.template, 'data-sop-enable')({ currentTarget: { checked: false } }); unchanged();
  for (const mode of ['pbr25d', 'classic2d', 'pbr25d', 'classic2d']) {
    state.dispatch({ workbenchMode: mode }); await runner.whenSimulationPreviewsReady(); unchanged();
  }
  widget.updateContext({ ...context, machineSnapshotPending: true });
  assert.equal(mechanismRows().length, 0, 'Pending source clears mechanism claims along with source topology.');
  widget.updateContext(context);
  assert.equal(mechanismRows().length, 3); unchanged();
  widget.dispose(); unchanged();
  const { createYarnSpatialWorkbench } = await server.ssrLoadModule('/src/views/yarnSpatialWorkbench.js');
  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  const nativeViewport = { childElementCount: 0, clientWidth: 800, clientHeight: 400,
    appendChild() { this.childElementCount++; }, ownerDocument: { defaultView: {}, createElement() {
      return { style: {}, setAttribute() {}, addEventListener() {}, removeEventListener() {}, getContext() { return null; },
        remove() { nativeViewport.childElementCount--; } };
    } } };
  const lazySlot = { querySelector: selector => selector === '[data-sop-viewport]' ? viewport : null, isConnected: true };
  const parentContainer = { querySelector: selector => selector === '[data-spatial-viewport]' ? nativeViewport : lazySlot };
  const lazyImports = [];
  const parent = createYarnSpatialWorkbench({ container: parentContainer, context,
    loadSopWorkbench: () => { const work = deferred(); lazyImports.push(work); return work.promise; } });
  const toggle = () => eventFor(parentContainer.template, 'data-sop-toggle', 'click')();
  const childModule = { createSopTopologyWorkbench: options => createSopTopologyWorkbench({ ...options, createRenderer }) };
  assert.equal(lazyImports.length, 0, 'SOP module remains lazy inside Round4.');
  toggle(); await Promise.resolve(); assert.equal(lazyImports.length, 1);
  toggle(); lazyImports[0].resolve(childModule); await parent.ready();
  assert.equal(parent.exportSession().sop.active, false); unchanged();
  toggle(); await Promise.resolve(); lazyImports[1].resolve(childModule); await parent.ready();
  assert.equal(rows().length, 0); // The first disposed widget released its template.
  assert.equal(templates(lazySlot.template, item => item.strings.join('').includes('<tr data-sop-occurrence')).length, 24);
  const start = renderers.length;
  parent.updateContext({ ...context, machineSnapshotPending: true });
  assert.ok(flatten(lazySlot.template).includes('MACHINE_SNAPSHOT_PENDING'));
  parent.updateContext(context); assert.ok(flatten(lazySlot.template).includes('SOURCE_TOPOLOGY_VIEW'));
  assert.equal(renderers.length, start, 'Source child never creates a GPU, including context propagation.');
  parent.updateContext({ ...context, projectGeneration: context.projectGeneration + 1 });
  assert.equal(parent.exportSession().sop.active, false); assert.equal(parent.exportSession().sop.session, null);
  toggle(); await Promise.resolve(); const late = lazyImports.at(-1); parent.dispose(); late.resolve(childModule); await parent.ready();
  assert.equal(nativeViewport.childElementCount, 0); assert.equal(renderers.length, start); unchanged();
  console.log('PASS lazy SOP child toggle, pending import cancellation, live snapshot context, project reset and stale teardown');
  const packageAfter = await readProjectPackage(await createProjectPackage(getProjectData()));
  assert.deepEqual(packageAfter.project, packageBefore.project);
  assert.ok(!Object.keys(packageAfter.project).some(key => /sopTopology|derivedGeometry|hypothesis/i.test(key)));
  packageBefore.registry.clear(); packageAfter.registry.clear();
  console.log('PASS actual SOP Lit paths/provenance/24 occurrences/yarn filters/hypothesis/failure controls; original Machine/CN/Solver counts, state, Map paths, UV, snapshots and ZIP facts preserved');
} finally {
  runner?.stopSimulation(); await server.close(); delete globalThis.__sopRender; delete globalThis.__sopCalls;
}
