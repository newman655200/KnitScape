import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { createServer } from "vite";

for (const file of ["components/spatialWorkbenchHost", "components/yarnSpatialWorkbenchController",
  "simulation/yarnSpatialExperiment", "views/yarnSpatialWorkbench"])
  assert.ok(fs.existsSync(`src/${file}.js`), `Missing independent spatial experiment boundary: ${file}`);

const loaded = new Set(), calls = { path: 0, frames: 0, mesh: 0, compute: 0, solver: 0 };
globalThis.__spatialWorkbenchCalls = calls;
const markers = [
  ["yarnSpatialPath.js", "export function buildSpatialPath(input, options = {}) {", "path"],
  ["yarnParallelTransport.js", "export function buildParallelTransportFrames", "frames"],
  ["yarnTubeGeometry.js", "export function buildYarnTubeGeometry(options = {}) {", "mesh"],
  ["computeYarnSimulation.js", "  if (scope !==", "compute"],
  ["yarnLengthSolver.js", "  gauge = normalizeMachineGauge(gauge);", "solver"],
];
const server = await createServer({ configFile: false, appType: "custom", logLevel: "silent",
  cacheDir: process.env.KNITSCAPE_TEST_CACHE_DIR || path.join(os.tmpdir(), "knitscape-validation", "validation-cache", "spatial-workbench"), server: { middlewareMode: true, hmr: { server: http.createServer() } },
  plugins: [{ name: "observe-spatial-isolation", enforce: "pre",
    resolveId(id) { if (id === "virtual:spatial-lit") return id; },
    load(id) { if (id === "virtual:spatial-lit") return 'export { render, nothing } from "lit-html";'; },
    transform(source, id) {
    loaded.add(id.replaceAll("\\", "/"));
    // Capture the actual lit template; DOM painting is the only widget seam.
    if (id.replaceAll("\\", "/").endsWith("/views/yarnSpatialWorkbench.js"))
      return source.replaceAll("render(", "globalThis.__spatialTestRender(");
    for (const [file, marker, key] of markers) {
      if (!id.replaceAll("\\", "/").endsWith(`/simulation/${file}`)) continue;
      assert.ok(source.includes(marker), `Observer seam for ${file}`);
      if (key === "frames") return source.replace(/(export function buildParallelTransportFrames[^\n]+\{)/,
        "$1\n globalThis.__spatialWorkbenchCalls.frames++;");
      return source.replace(marker, key === "compute" || key === "solver"
        ? `globalThis.__spatialWorkbenchCalls.${key}++;\n${marker}`
        : `${marker}\n globalThis.__spatialWorkbenchCalls.${key}++;`);
    }
  } }],
});
const context = (mode = "pbr25d", projectGeneration = 4, feedYarnStructureRevision = 7) =>
  ({ workbenchMode: mode, projectGeneration, feedYarnStructureRevision });
// A minimal DOM surface for real Lit string rendering and host-owned nodes.
// Parent/sibling ownership is enforced so detached Lit root markers fail here.
class DomNode {
  constructor(nodeType, data = "") { Object.assign(this, { nodeType, data, parentNode: null, children: [], isConnected: true }); }
  get ownerDocument() { return hostDocument; }
  get nextSibling() { return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1] ?? null; }
  get childElementCount() { return this.children.filter(node => node.nodeType === 1).length; }
  get textContent() { return this.nodeType === 3 ? this.data : this.children.filter(node => node.nodeType !== 8).map(node => node.textContent).join(""); }
  set textContent(value) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    if (value) this.appendChild(new DomNode(3, String(value)));
  }
  insertBefore(node, before = null) {
    if (before !== null) assert.equal(before.parentNode, this, "DOM insertion reference must belong to its parent.");
    node.remove();
    const index = before === null ? this.children.length : this.children.indexOf(before);
    this.children.splice(index, 0, node); node.parentNode = this; return node;
  }
  appendChild(node) { return this.insertBefore(node); }
  removeChild(node) {
    assert.equal(node.parentNode, this); this.children.splice(this.children.indexOf(node), 1); node.parentNode = null; return node;
  }
  remove() { this.parentNode?.removeChild(this); }
  setAttribute() {}
}
const hostDocument = { createTreeWalker() { return {}; }, createComment: text => new DomNode(8, text),
  createTextNode: text => new DomNode(3, text), createElement: () => new DomNode(1) };
const slot = () => new DomNode(1);
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject }; };
let runner;
try {
  const { createSpatialWorkbenchHost } = await server.ssrLoadModule("/src/components/spatialWorkbenchHost.js");
  let live = context("classic2d"), container = slot(), loads = 0, mounts = 0, disposals = 0, sessions = [];
  const pending = [];
  const module = { createYarnSpatialWorkbench({ context: source, session }) {
    mounts++; sessions.push({ source, session });
    return { updateContext(next) { sessions.at(-1).source = next; },
      exportSession: () => ({ parameters: { preset: "helix" } }), dispose() { disposals++; } };
  } };
  const host = createSpatialWorkbenchHost({ getContext: () => live, getContainer: () => container,
    loadWorkbench: () => { loads++; const work = deferred(); pending.push(work); return work.promise; } });
  host.sync(); await host.ready();
  assert.equal(loads, 0); assert.equal(mounts, 0);
  assert.ok(![...loaded].some(id => /yarnSpatial(?:Path|Experiment|PreviewRenderer)|yarnTubeGeometry|yarnParallelTransport/.test(id)),
    "Cold Classic loads only the bridge, no experiment math or renderer.");
  assert.deepEqual(calls, { path: 0, frames: 0, mesh: 0, compute: 0, solver: 0 });

  live = context(); host.sync();
  assert.equal(loads, 1);
  live = context("classic2d"); // State changed before the next DOM/RAF host sync.
  pending[0].resolve(module); await host.ready();
  assert.equal(mounts, 0, "A pending import must read live mode before any GPU/widget initialization.");
  host.sync(); live = context(); host.sync();
  pending.at(-1).resolve(module); await host.ready();
  assert.equal(mounts, 1);
  live = context("classic2d"); host.sync();
  assert.equal(disposals, 1);
  live = context(); host.sync(); pending.at(-1).resolve(module); await host.ready();
  assert.equal(mounts, 2); assert.equal(sessions.at(-1).session.parameters.preset, "helix");
  live = context("pbr25d", 5, 8); host.sync(); pending.at(-1).resolve(module); await host.ready();
  assert.equal(disposals, 2); assert.equal(sessions.at(-1).session, null, "New project resets experiment session.");
  assert.equal(sessions.at(-1).source.projectGeneration, 5);
  live = context("pbr25d", 5, 9); host.sync();
  assert.equal(sessions.at(-1).source.feedYarnStructureRevision, 9);
  host.dispose(); assert.equal(disposals, 3);

  const generationImport = deferred(); live = context();
  const stale = createSpatialWorkbenchHost({ getContext: () => live, getContainer: () => container,
    loadWorkbench: () => generationImport.promise });
  stale.sync(); live = context("pbr25d", 6, 10); generationImport.resolve(module); await stale.ready();
  assert.equal(mounts, 3, "Fresh generation rejects old asynchronous initialization.");
  stale.dispose();
  const failure = createSpatialWorkbenchHost({ getContext: () => live, getContainer: () => container,
    loadWorkbench: async () => { throw Error("controlled lazy import failure"); } });
  failure.sync(); await failure.ready();
  assert.match(container.textContent, /controlled lazy import failure/);
  assert.equal(failure.status.phase, "error"); failure.dispose();
  let recoveryLoads = 0;
  const recovering = createSpatialWorkbenchHost({ getContext: () => live, getContainer: () => container,
    loadWorkbench: async () => { if (++recoveryLoads === 1) throw Error("first generation unavailable"); return module; } });
  recovering.sync(); await recovering.ready(); recovering.sync();
  assert.equal(recoveryLoads, 1, "A failed identity does not retry indefinitely on ordinary redraws.");
  live = context("pbr25d", 7, 11); recovering.sync(); await recovering.ready();
  assert.equal(recovering.status.phase, "ready", "Loading a new project in PBR recovers a failed experiment host.");
  assert.equal(recoveryLoads, 2); recovering.dispose();

  const previousDocument = globalThis.document; globalThis.document = hostDocument;
  const { render: realLitRender, nothing: litNothing } = await server.ssrLoadModule("virtual:spatial-lit");
  const hostRecoveryFailures = [];
  for (const afterFirstRender of [false, true]) {
    const domSlot = slot(); let attempts = 0, rootMarker;
    let domContext = context("pbr25d", 20);
    const domHost = createSpatialWorkbenchHost({ getContext: () => domContext, getContainer: () => domSlot,
      loadWorkbench: async () => {
        attempts++;
        if (attempts === 1 && !afterFirstRender) throw Error("controlled import failure");
        return { createYarnSpatialWorkbench({ container: target }) {
          realLitRender("RECOVERED_WIDGET", target);
          rootMarker ??= target.children.find(node => node.nodeType === 8);
          if (attempts === 1) { realLitRender(litNothing, target); throw Error("controlled initialization failure after first render"); }
          return { updateContext() { realLitRender("UPDATED_WIDGET", target); }, exportSession: () => ({}),
            dispose() { realLitRender(litNothing, target); } };
        } };
      } });
    try {
      domHost.sync(); await domHost.ready();
      assert.equal(domHost.status.phase, "error"); assert.match(domSlot.textContent, /controlled .* failure/);
      if (afterFirstRender) assert.equal(rootMarker.parentNode, domSlot, "Initialization failure must preserve Lit's existing root marker.");
      domContext = context("pbr25d", 21); domHost.sync(); await domHost.ready();
      assert.equal(domHost.status.phase, "ready");
      assert.equal(domSlot.textContent, "RECOVERED_WIDGET", "Same-slot new-project recovery must remove the owned load error.");
      domHost.sync(); assert.equal(domSlot.textContent, "UPDATED_WIDGET", "Recovered Lit root remains usable.");
      domHost.dispose(); assert.equal(domSlot.textContent, "", "Teardown leaves no owned error or widget text.");
    } catch (error) { hostRecoveryFailures.push(`${afterFirstRender ? "after first render" : "before first render"}: ${error.message}`); }
    finally { domHost.dispose(); }
  }
  globalThis.document = previousDocument;
  assert.deepEqual(hostRecoveryFailures, [], "Real Lit host recovery failures.");

  const { buildYarnSpatialExperiment, DEFAULT_SPATIAL_PARAMETERS } =
    await server.ssrLoadModule("/src/simulation/yarnSpatialExperiment.js");
  const inspectReadonlyData = value => {
    assert.notEqual(typeof value, "function", "Public experiment result contains no functions, including inherited preset values.");
    if (!value || typeof value !== "object") return;
    assert.ok(Object.isFrozen(value)); assert.ok(!ArrayBuffer.isView(value), "No mutable typed-array buffer escapes.");
    assert.ok(!(value instanceof Map) && !(value instanceof Set), "Public experiment data exposes no Map or Set.");
    for (const item of Object.values(value)) inspectReadonlyData(item);
  };
  const built = {};
  for (const preset of ["line", "s-curve", "helix", "ring"]) {
    const result = buildYarnSpatialExperiment({ ...DEFAULT_SPATIAL_PARAMETERS, preset }, context()); built[preset] = result;
    assert.equal(result.status, "OK", `${preset}: ${JSON.stringify(result.diagnostics)}`);
    assert.equal(result.inputSource, "TEST_ONLY"); assert.equal(result.units.length, "mm");
    assert.equal(result.geometryType, "Tube");
    assert.equal(result.projectGeneration, 4); assert.equal(result.feedYarnStructureRevision, 7);
    assert.ok(result.ruleVersion && result.inputSignature);
    assert.equal(result.centerline.points.length, 128); assert.equal(result.mesh.counts.radialSegments, 32);
    assert.ok(Number.isFinite(result.xyzLength.value) && result.xyzLength.value > 0);
    assert.ok(Number.isFinite(result.xyzLength.errorEstimate)); assert.ok(result.xyzLength.segmentLengths.length);
    assert.equal(result.selfContactStatus, "NOT_EVALUATED"); assert.equal(result.physicsStatus, "NOT_IMPLEMENTED");
    assert.equal(result.mesh.counts.caps, preset === "ring" ? 0 : 2);
    assert.ok(result.mesh.positions.every(Number.isFinite));
    assert.equal(result.testUVRepeatLengthMm, preset === "ring" ? result.xyzLength.value / 8 : 1.5);
    inspectReadonlyData(result);
    assert.throws(() => { result.mesh.positions[0] = 999; }, TypeError);
    assert.throws(() => { result.centerline.points[0][0] = 999; }, TypeError);
  }
  assert.equal(built.line.xyzLength.value, 12);
  assert.ok(Math.abs(built.ring.xyzLength.value - 6 * Math.PI) < 1e-9);
  assert.ok(Math.abs(built.helix.xyzLength.value - Math.hypot(12 * Math.PI, 4)) < 1e-9);
  const ellipse = buildYarnSpatialExperiment({ ...DEFAULT_SPATIAL_PARAMETERS, section: "ellipse", radiusA: .45, radiusB: .15 }, context());
  assert.equal(ellipse.status, "OK");
  assert.equal(ellipse.geometryType, "Elliptical Tube");
  assert.equal(ellipse.xyzLength.value, built.line.xyzLength.value, "Cross section cannot change centerline length.");
  const extents = ellipse.mesh.bounds.max.map((value, i) => value - ellipse.mesh.bounds.min[i]);
  assert.ok(Math.abs(extents[1] - extents[2]) > .4, "Ellipse axes create distinct physical mesh extents.");
  for (const patch of [{ radiusA: -1 }, { radiusA: NaN }, { sampleCount: 2.5 }, { sampleCount: 50000 },
    { radialSegments: 2 }, { preset: "unknown" }, { section: "square" }, { preset: "ring", radiusA: 5 }]) {
    const result = buildYarnSpatialExperiment({ ...DEFAULT_SPATIAL_PARAMETERS, ...patch }, context());
    assert.equal(result.status, "INVALID"); assert.ok(result.diagnostics.length);
  }
  for (const preset of Object.getOwnPropertyNames(Object.prototype)) {
    const result = buildYarnSpatialExperiment({ preset }, context());
    assert.equal(result.status, "INVALID"); inspectReadonlyData(result);
    assert.equal(result.provenance.value.centerline, null, `Inherited preset ${preset} is rejected before provenance construction.`);
    assert.equal(result.diagnostics[0].code, "INVALID_EXPERIMENT_INPUT");
  }
  let coercionCalls = 0;
  const coercible = { toString() { coercionCalls++; return "line"; }, toJSON() { coercionCalls++; return "line"; } };
  const unsafeInputs = [
    ["preset", coercible], ["preset", () => "line"], ["preset", new String("line")],
    ["section", { valueOf: () => "circle" }], ["radiusA", new Map([["x", { a: 1 }]])],
    ["radiusA", "0.28"], ["radiusB", new Set([.28])], ["radiusB", () => .28],
    ["sampleCount", new Uint32Array([128])], ["sampleCount", 128n],
    ["radialSegments", [32]], ["radialSegments", Symbol("32")],
  ];
  const boundaryFailures = [], beforeUnsafeInputs = { ...calls };
  for (const [field, value] of unsafeInputs) {
    try {
      const result = buildYarnSpatialExperiment({ [field]: value }, context());
      assert.equal(result.status, "INVALID"); inspectReadonlyData(result);
      assert.equal(result.parameters[field], null, "A rejected value is explicitly unavailable, never replaced with a valid default.");
      assert.ok(result.diagnostics.some(item => item.field === field));
      assert.equal(result.provenance.value.centerline, null); assert.equal(result.mesh, null);
    } catch (error) { boundaryFailures.push(`${field} (${typeof value}): ${error.message}`); }
  }
  for (const field of ["projectGeneration", "feedYarnStructureRevision"]) {
    for (const value of [() => 1, new Map([["value", 1]]), [1]]) {
      try {
        const result = buildYarnSpatialExperiment({}, { ...context(), [field]: value });
        assert.equal(result.status, "INVALID"); inspectReadonlyData(result);
        assert.equal(result[field], null); assert.ok(result.diagnostics.some(item => item.field === field));
        assert.equal(result.mesh, null);
      } catch (error) { boundaryFailures.push(`context.${field} (${typeof value}): ${error.message}`); }
    }
  }
  for (const value of [null, [], new Map(), () => ({})]) {
    try {
      const result = buildYarnSpatialExperiment(value, context());
      assert.equal(result.status, "INVALID"); inspectReadonlyData(result); assert.equal(result.mesh, null);
    } catch (error) { boundaryFailures.push(`input (${typeof value}): ${error.message}`); }
  }
  assert.deepEqual(boundaryFailures, [], "Invalid input must return safe readonly diagnostic data.");
  assert.equal(coercionCalls, 0, "Rejected objects must not execute toString or toJSON during preset lookup/signature construction.");
  assert.deepEqual(calls, beforeUnsafeInputs, "Invalid field types never enter path/frame/mesh computation.");
  const scalarNaN = buildYarnSpatialExperiment({ radiusA: NaN }, context());
  assert.equal(scalarNaN.status, "INVALID"); assert.ok(Number.isNaN(scalarNaN.parameters.radiusA));
  inspectReadonlyData(scalarNaN);
  const scalarInfinity = buildYarnSpatialExperiment({ radiusA: Infinity }, context());
  assert.equal(scalarInfinity.status, "INVALID"); assert.equal(scalarInfinity.parameters.radiusA, Infinity);
  assert.notEqual(scalarInfinity.inputSignature, scalarNaN.inputSignature, "Distinct numerical errors remain distinguishable without clamping.");
  inspectReadonlyData(scalarInfinity);
  const beforeOversized = { ...calls };
  const oversized = buildYarnSpatialExperiment({ ...DEFAULT_SPATIAL_PARAMETERS, sampleCount: 2048, radialSegments: 256 }, context());
  assert.equal(oversized.status, "INVALID", "Combined mesh workload is bounded before path or typed-array allocation.");
  assert.deepEqual(calls, beforeOversized);

  const { createYarnSpatialWorkbenchController } = await server.ssrLoadModule("/src/components/yarnSpatialWorkbenchController.js");
  const scenes = [], views = []; let disposed = 0;
  const rendererFactory = ({ onViewChange, onStatusChange }) => {
    let view = { target: [0, 0, 0], distance: 20, yaw: 0, pitch: 0, fovY: Math.PI / 4 };
    return { get view() { return view; }, get status() { return { status: "READY", diagnostic: null }; },
      mount() {}, update(scene) { scenes.push(scene); if (scene.view) this.setView(scene.view); },
      setView(patch) { view = { ...view, ...patch }; views.push(view); onViewChange(view); },
      fit() { views.push("fit"); }, dispose() { disposed++; onStatusChange({ status: "DISPOSED" }); } };
  };
  const controller = createYarnSpatialWorkbenchController({ context: context(), createRenderer: rendererFactory });
  controller.mount({});
  const builtCounts = { ...calls }, firstDerived = controller.model.derivedGeometry;
  assert.ok(calls.path > 0 && calls.frames > 0 && calls.mesh > 0, "Observers cover real builder calls.");
  controller.setMaterial({ roughness: .8, anisotropy: -.5, lightDirection: [-1, 1, 2], mode: "uv-reference" });
  controller.setView({ yaw: Math.PI }); controller.fit(); controller.closeup();
  assert.deepEqual(calls, builtCounts, "Camera and lighting do not rebuild path/frames/mesh or integrate length.");
  assert.equal(controller.model.derivedGeometry, firstDerived);
  assert.deepEqual(views.at(-1).target, [6, 0, 0]);
  assert.equal(views.at(-1).yaw, Math.PI / 2); assert.equal(views.at(-1).pitch, 0);
  assert.equal(views.at(-1).distance, 1.4000000000000001);
  controller.setParameters({ preset: "helix", section: "ellipse", radiusA: .35, radiusB: .15 });
  assert.equal(controller.model.derivedGeometry.status, "OK");
  controller.setParameters({ radiusA: -2 });
  assert.equal(controller.model.parameters.radiusA, -2, "Invalid input is reported without silent clamping.");
  assert.equal(controller.model.derivedGeometry.status, "INVALID");
  const geometryScene = () => scenes.filter(scene => Object.hasOwn(scene, "geometry")).at(-1);
  assert.equal(geometryScene().geometry, null, "Invalid geometry explicitly clears the last successful canvas.");
  controller.setMaterial({ roughness: NaN }); controller.setParameters({ radiusA: -3 });
  assert.equal(geometryScene().geometry, null);
  assert.equal(Object.hasOwn(geometryScene(), "material"), false,
    "A geometry clear is independent of invalid material; atomic renderer rejection must not retain a stale mesh.");
  controller.setParameters({ preset: "line", radiusA: .35 });
  assert.equal(geometryScene().geometry, controller.model.derivedGeometry.mesh);
  assert.equal(Object.hasOwn(geometryScene(), "material"), false,
    "A new valid geometry is applied independently of an invalid material, keeping metrics and mesh consistent.");
  controller.setParameters({ preset: "helix" });
  controller.setMaterial({ roughness: .8 });
  controller.setParameters({ radiusA: .35 });
  controller.updateContext(context("pbr25d", 4, 10));
  assert.equal(controller.model.derivedGeometry.feedYarnStructureRevision, 10);
  const session = controller.exportSession(); controller.dispose(); assert.equal(disposed, 1);
  const resumed = createYarnSpatialWorkbenchController({ context: context(), session, createRenderer: rendererFactory });
  resumed.mount({}); assert.equal(resumed.model.parameters.preset, "helix");
  assert.deepEqual(resumed.model.view, session.view); resumed.dispose();
  const throwing = createYarnSpatialWorkbenchController({ context: context(), createRenderer: rendererFactory,
    buildExperiment: () => { throw Error("controlled geometry failure"); } });
  throwing.mount({}); assert.equal(throwing.model.derivedGeometry.status, "ERROR");
  assert.equal(geometryScene().geometry, null); throwing.dispose();
  const renderFailure = createYarnSpatialWorkbenchController({ context: context(),
    createRenderer: () => ({ mount() { throw Error("controlled GPU failure"); }, dispose() { disposed++; } }) });
  renderFailure.mount({}); assert.equal(renderFailure.model.rendererStatus.status, "ERROR");
  assert.match(renderFailure.model.rendererStatus.diagnostic, /controlled GPU failure/); renderFailure.dispose();

  // Reuse the existing recording-GL boundary in memory without changing the
  // renderer validator or copying its graphics fixture into a second owner.
  const rendererValidation = fs.readFileSync("scripts/validate-yarn-spatial-renderer.mjs", "utf8");
  const fixtureStart = rendererValidation.indexOf("function eventTarget("), fixtureEnd = rendererValidation.indexOf("const scenes = [");
  assert.ok(fixtureStart >= 0 && fixtureEnd > fixtureStart, "Recording-GL helper boundaries are available.");
  const recordingEnvironment = new Function("assert", `${rendererValidation.slice(fixtureStart, fixtureEnd)}\nreturn environment;`)(assert);
  const { createYarnSpatialPreviewRenderer } = await server.ssrLoadModule("/src/simulation/yarnSpatialPreviewRenderer.js");
  const recorded = recordingEnvironment(); let realRenderer;
  const realController = createYarnSpatialWorkbenchController({ context: context(), createRenderer: callbacks =>
    (realRenderer = createYarnSpatialPreviewRenderer(callbacks)) });
  realController.mount(recorded.container); recorded.flush();
  const recordedGl = recorded.contexts[0];
  assert.equal(recordedGl.buffers.size, 5); assert.equal(recordedGl.uploads.length, 5);
  const drawCount = () => recordedGl.calls.filter(([name]) => name === "drawElements").length;
  const drawsBeforeRejection = drawCount();
  realController.setParameters({ radiusA: 1e13 });
  assert.equal(realController.model.parameters.radiusA, 1e13, "Renderer rejection must not silently clamp the input.");
  assert.equal(realController.model.derivedGeometry.status, "OK", "The pure geometry result remains distinct from application success.");
  assert.equal(recordedGl.buffers.size, 0, "Rejected geometry must clear the previous GPU mesh instead of retaining stale .28 mm geometry.");
  const geometryApplyError = realController.model.geometryApplyError;
  assert.equal(geometryApplyError.status, "INVALID"); assert.match(geometryApplyError.diagnostic, /camera range/);
  assert.equal(realController.model.rendererStatus.status, "EMPTY");
  realController.setMaterial({ roughness: NaN });
  assert.match(realController.model.materialError, /roughness/);
  realController.setView({ yaw: .4 }); realController.fit(); recorded.flush(); realRenderer.render();
  assert.equal(realController.model.geometryApplyError, geometryApplyError,
    "Material, camera and draw status changes must not erase the geometry application failure.");
  assert.equal(drawCount(), drawsBeforeRejection, "No old mesh is redrawn after rejection.");
  assert.equal(recordedGl.buffers.size, 0); assert.equal(recordedGl.uploads.length, 5);
  realController.setParameters({ radiusA: -1 });
  assert.equal(realController.model.geometryApplyError, geometryApplyError, "Only a successfully applied geometry clears its application failure.");
  realController.setParameters({ radiusA: .35 }); recorded.flush();
  assert.equal(realController.model.geometryApplyError, null); assert.equal(recordedGl.buffers.size, 5);
  assert.equal(recordedGl.uploads.length, 10); assert.equal(drawCount(), drawsBeforeRejection + 1);
  assert.match(realController.model.materialError, /roughness/, "Geometry recovery must preserve the independent invalid material diagnostic.");
  realController.setView({ yaw: .8 }); realRenderer.render();
  assert.match(realController.model.materialError, /roughness/);
  realController.setMaterial({ roughness: .4 }); assert.equal(realController.model.materialError, null);
  realController.dispose(); assert.equal(recordedGl.buffers.size, 0);

  // Existing computation, state, exporter and original 2D renderers execute real code;
  // only browser DOM/Canvas and the separate WebGL widget surface are fixtures.
  globalThis.devicePixelRatio = 1;
  globalThis.Path2D = class { constructor(data = "") { this.data = data; } };
  const timers = new Map(); let timerId = 0;
  globalThis.window = { location: { search: "" }, setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); }, addEventListener() {}, removeEventListener() {} };
  const nodes = new Map();
  for (const id of ["back", "mid", "front", "back-arranged", "mid-arranged", "front-arranged", "pbr-back", "pbr-mid", "pbr-front"])
    nodes.set(id, { id, width: 0, height: 0, style: {}, getContext(kind) {
      assert.equal(kind, "2d"); return { clearRect() {}, save() {}, restore() {}, stroke() {}, createPattern() { return null; }, drawImage() {} };
    } });
  for (const id of ["sim-container", "sim-before-container", "sim-after-container", "pbr-preview-container", "desktop"])
    nodes.set(id, { getBoundingClientRect: () => ({ width: 400, height: 300, left: 0, top: 0 }), addEventListener() {}, removeEventListener() {} });
  nodes.set("machine-execution-error", { hidden: true, textContent: "" });
  globalThis.document = { title: "", documentElement: { lang: "" }, createTreeWalker() { return {}; },
    getElementById: id => nodes.get(id) ?? null };
  const state = await server.ssrLoadModule("/src/state.js");
  const { Bimp } = await server.ssrLoadModule("/src/lib/Bimp.js");
  const { getProjectData } = await server.ssrLoadModule("/src/actions/exporters.js");
  runner = await server.ssrLoadModule("/src/components/runSimulation.js");
  state.dispatch({ chart: Bimp.empty(6, 6, 0), repeats: [{ bitmap: Bimp.empty(2, 2, 0), pos: [0, 0], area: [6, 6] }],
    yarnSequence: Bimp.empty(1, 6, 0), yarnPalette: ["#445566"],
    yarnLibrary: [{ id: "A", name: "A", color: "#445566", diameter: .20 }, { id: "B", name: "B", color: "#ffaa22", diameter: .10 }],
    needleArrangement: [1], singleJerseyCamProgram: { tracks: [["K", "T"]], feeds: [
      { yarns: [{ yarnId: "A", yarnLengthCmPer100Needles: 23 }, { yarnId: "B", yarnLengthCmPer100Needles: 8 }] },
      { yarns: [{ yarnId: "A", yarnLengthCmPer100Needles: 23 }] }] } });
  state.StateMonitor.register([runner.runSimulation()]); await runner.whenSimulationPreviewsReady();
  const snapshots = runner.getCurrentSimulationSnapshots(), coreCounts = { compute: calls.compute, solver: calls.solver };
  assert.ok(coreCounts.compute > 0 && coreCounts.solver > 0);
  const baseline = state.GLOBAL_STATE, exported = JSON.stringify(getProjectData());
  const stable = ["yarnLengthSolverResults", "yarnLengthMetrics", "previewValidity", "feedYarnStructureRevision",
    "yarnLibrary", "singleJerseyCamProgram", "chart", "repeats", "needleArrangement"];
  const isolated = createYarnSpatialWorkbenchController({ context: baseline, createRenderer: rendererFactory }); isolated.mount({});
  const assertOriginal = () => {
    for (const key of stable) assert.equal(state.GLOBAL_STATE[key], baseline[key], `Original ${key} identity is unchanged.`);
    assert.equal(runner.getCurrentSimulationSnapshots().machine, snapshots.machine, "Original M1/M3/model path snapshot identity is unchanged.");
    assert.equal(runner.getCurrentSimulationSnapshots().pattern, snapshots.pattern);
    assert.equal(JSON.stringify(getProjectData()), exported, "Targets/assets/package facts unchanged.");
    assert.deepEqual({ compute: calls.compute, solver: calls.solver }, coreCounts);
  };
  for (const patch of [{ preset: "s-curve" }, { preset: "ring", section: "ellipse", radiusA: .5, radiusB: .2 },
    { radiusB: NaN }, { radiusB: .2 }]) { isolated.setParameters(patch); assertOriginal(); }
  for (const workbenchMode of ["pbr25d", "classic2d", "pbr25d", "classic2d"]) {
    state.dispatch({ workbenchMode }); await runner.whenSimulationPreviewsReady(); assertOriginal();
  }
  isolated.setMaterial({ roughness: .9 }); isolated.setView({ yaw: 1 }); assertOriginal(); isolated.dispose();
  const { pbrWorkbench } = await server.ssrLoadModule("/src/views/pbrWorkbench.js");
  const flatten = value => value?.strings ? value.strings.reduce((text, piece, i) => text + piece + flatten(value.values[i]), "")
    : Array.isArray(value) ? value.map(flatten).join("") : typeof value === "string" ? value : "";
  assert.ok(!flatten(pbrWorkbench()).includes('id="yarn-spatial-workbench-slot"'), "Classic has no owned spatial slot.");
  state.dispatch({ workbenchMode: "pbr25d" }); await runner.whenSimulationPreviewsReady();
  const markup = flatten(pbrWorkbench());
  assert.ok(markup.includes('id="yarn-spatial-workbench-slot"'));
  assert.ok(markup.includes('id="pbr-preview-container"')); assert.ok(markup.includes("Feed × Yarn"));
  assert.match(markup, /人工 XYZ 几何.*TEST_ONLY/); assertOriginal();
  const index = fs.readFileSync("src/index.js", "utf8");
  assert.match(index, /flushSimulationPreviews\(\);\s*spatialWorkbench\.sync\(\)/);
  assert.ok(!index.includes("yarnSpatialExperiment") && !index.includes("yarnSpatialPreviewRenderer"));

  const nativeListeners = new Map(); let webglRequests = 0, nativeCanvas;
  const nativeViewport = { childElementCount: 0, clientWidth: 600, clientHeight: 360,
    appendChild(canvas) { nativeCanvas = canvas; this.childElementCount++; },
    ownerDocument: { defaultView: {}, createElement(tag) {
      assert.equal(tag, "canvas");
      return { style: {}, setAttribute() {}, addEventListener(name, fn) { nativeListeners.set(name, fn); },
        removeEventListener(name, fn) { if (nativeListeners.get(name) === fn) nativeListeners.delete(name); },
        getContext(kind) { assert.equal(kind, "webgl"); webglRequests++; return null; },
        remove() { nativeViewport.childElementCount--; } };
    } } };
  const widgetSlot = { ...slot(), querySelector: () => nativeViewport };
  globalThis.__spatialTestRender = (template, target) => { target.template = template; };
  const actualHost = createSpatialWorkbenchHost({ getContext: () => state.GLOBAL_STATE, getContainer: () => widgetSlot });
  actualHost.sync(); await actualHost.ready();
  assert.equal(actualHost.status.phase, "ready"); assert.equal(webglRequests, 1);
  assert.equal(actualHost.status.derivedGeometry.status, "OK");
  const widgetMarkup = flatten(widgetSlot.template);
  for (const label of ["GeometryType", "Tube", "XYZLength", "12 mm", "CenterlinePoints", "RadialSegments", "VertexCount", "TriangleCount",
    "FrameStatus", "MeshStatus", "GeometrySource", "UNAVAILABLE", "WebGL1 is unavailable", "NOT_EVALUATED", "NOT_IMPLEMENTED",
    "TEST_ONLY", "Physical UV", "末端截面特写", "半轴 B", "粗糙度", "各向异性", "UV 参考格"])
    assert.ok(widgetMarkup.includes(label), `Actual widget template exposes ${label}`);
  assert.ok(nativeListeners.size > 0); assert.equal(nativeViewport.childElementCount, 1);
  const findTemplate = (value, predicate) => {
    if (value?.strings && predicate(value)) return value;
    for (const child of Array.isArray(value) ? value : value?.values ?? []) {
      const found = findTemplate(child, predicate); if (found) return found;
    }
    return null;
  };
  const roughnessControl = findTemplate(widgetSlot.template, template => template.values[0] === "粗糙度");
  const changeMaterial = roughnessControl.values[roughnessControl.strings.findIndex(text => text.trimEnd().endsWith("@change="))];
  changeMaterial({ currentTarget: { valueAsNumber: NaN } });
  assert.match(flatten(widgetSlot.template), /MaterialInputStatus：INVALID/);
  const fitIndex = widgetSlot.template.strings.findIndex((text, i, parts) =>
    text.trimEnd().endsWith("@click=") && parts[i + 1]?.includes(">适配</button>"));
  widgetSlot.template.values[fitIndex]();
  assert.match(flatten(widgetSlot.template), /MaterialInputStatus：INVALID/,
    "Camera/render status changes cannot erase the current material input error.");
  const radiusControl = findTemplate(widgetSlot.template, template => template.values[0] === "半径 R (mm)");
  const changeRadius = radiusControl.values[radiusControl.strings.findIndex(text => text.trimEnd().endsWith("@change="))];
  changeRadius({ currentTarget: { valueAsNumber: 1e13 } });
  assert.equal(actualHost.status.derivedGeometry.status, "OK");
  assert.match(flatten(widgetSlot.template), /GeometryApplyStatus：INVALID.*camera range/,
    "The visible widget distinguishes valid pure geometry from a rejected renderer application.");
  widgetSlot.template.values[fitIndex]();
  changeMaterial({ currentTarget: { valueAsNumber: .4 } });
  assert.match(flatten(widgetSlot.template), /GeometryApplyStatus：INVALID.*camera range/);
  assert.ok(!flatten(widgetSlot.template).includes("MaterialInputStatus：INVALID"));
  changeRadius({ currentTarget: { valueAsNumber: .35 } });
  assert.ok(!flatten(widgetSlot.template).includes("GeometryApplyStatus：INVALID"));
  assertOriginal(); // Even real native renderer mount failure is local to the experiment.
  state.dispatch({ workbenchMode: "classic2d" }); actualHost.sync();
  assert.equal(nativeListeners.size, 0); assert.equal(nativeViewport.childElementCount, 0);
  assert.equal(nativeCanvas.width, 1); actualHost.dispose();
  console.log("Spatial workbench isolation PASS: lazy Classic; stale mode/generation; teardown/reset; readonly presets; local failures; no view/light rebuild; original results/targets/state/save preserved.");
} finally {
  runner?.stopSimulation(); await server.close(); delete globalThis.__spatialWorkbenchCalls;
  delete globalThis.__spatialTestRender;
}
