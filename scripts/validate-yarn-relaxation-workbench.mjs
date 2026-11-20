import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { createServer } from "vite";

const experimentFile = "src/simulation/yarnRelaxationExperiment.js";
assert.ok(fs.existsSync(experimentFile), "Missing Round5 fixed-seed experiment builder.");
const { buildYarnRelaxationExperiment, RELAXATION_INPUT, RELAXATION_GEOMETRY, RELAXATION_TARGETS } =
  await import("../src/simulation/yarnRelaxationExperiment.js");
const context = { projectGeneration: 4, feedYarnStructureRevision: 7 };
const readonly = value => {
  assert.notEqual(typeof value, "function", "Public data must not expose curve closures.");
  if (!value || typeof value !== "object") return;
  assert.ok(Object.isFrozen(value));
  assert.ok(!ArrayBuffer.isView(value) && !(value instanceof Map) && !(value instanceof Set));
  Object.values(value).forEach(readonly);
};
const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${label}: ${actual} differs from ${expected}`);
const expectedSeed = Array.from({ length: 9 }, (_, i) => i === 0 ? [-6, 0, 0] : i === 8 ? [6, 0, 0] :
  [-6 + 12 * i / 8, 1.2 * Math.sin(Math.PI * i / 8), .7 * Math.sin(2 * Math.PI * i / 8)]);
assert.deepEqual(RELAXATION_INPUT.initialPoints, expectedSeed);
assert.deepEqual(RELAXATION_INPUT.anchors, [{ index: 0, position: [-6, 0, 0] }, { index: 8, position: [6, 0, 0] }]);
assert.deepEqual(RELAXATION_INPUT.constraints, { maxControlDisplacementMm: 5 });
assert.deepEqual(RELAXATION_INPUT.solver, {});
assert.deepEqual(RELAXATION_TARGETS, [12.5, 14, 16]);
assert.deepEqual(RELAXATION_GEOMETRY, { radiusMm: .18, radialSegments: 32, sampleCount: 128, uvRepeatLengthMm: 1.5 });
readonly(RELAXATION_INPUT);
const seedBefore = JSON.stringify(RELAXATION_INPUT);
const initial = buildYarnRelaxationExperiment({ initial: true }, context);
assert.equal(initial.status, "INITIAL");
assert.equal(initial.solverResult, null);
near(initial.xyzLength.value, 12.672754749550853, 1e-10, "Initial XYZ integral");
const cases = RELAXATION_TARGETS.map(targetLengthMm => buildYarnRelaxationExperiment({ targetLengthMm }, context));
for (const [index, result] of [initial, ...cases].entries()) {
  readonly(result);
  assert.equal(result.inputSource, "ARTIFICIAL_FIXED_SEED");
  assert.equal(result.validationClass, "TEST_ONLY");
  assert.equal(result.projectGeneration, 4); assert.equal(result.feedYarnStructureRevision, 7);
  assert.equal(result.units.length, "mm");
  assert.equal(result.provenance.confidence, "TEST_ONLY_UNCALIBRATED");
  assert.ok(result.provenance.source && result.provenance.derivationPrinciple && result.provenance.applicableState);
  assert.equal(result.selfContactStatus, "NOT_EVALUATED");
  assert.equal(result.frames.status, "OK"); assert.equal(result.mesh.status, "OK");
  assert.equal(result.mesh.counts.radialSegments, 32); assert.equal(result.mesh.counts.rings, 128);
  assert.equal(result.mesh.counts.caps, 2);
  for (const [sample, endpoint] of [[result.centerline.points[0], [-6, 0, 0]], [result.centerline.points.at(-1), [6, 0, 0]]])
    sample.forEach((value, axis) => near(value, endpoint[axis], 1e-12, "Round4 sampled endpoint roundoff"));
  assert.equal(result.xyzLength.authority, "yarnSpatialLength.measureSpatialLength");
  for (const ring of [0, 40, 127]) for (let j = 0; j < 32; j++) {
    const offset = (ring * 33 + j) * 3;
    const radial = result.mesh.positions.slice(offset, offset + 3).map((v, axis) => v - result.centerline.points[ring][axis]);
    near(Math.hypot(...radial), .18, 5e-7, "Target-independent circular radius");
  }
  if (index) {
    assert.equal(result.status, "CONVERGED");
    const solved = result.solverResult;
    near(result.xyzLength.value, RELAXATION_TARGETS[index - 1], 1e-6, "Solved integral");
    near(result.xyzLength.value, solved.finalLengthMm, 1e-8, "Builder reuses Round4 integral");
    assert.equal(solved.residuals.maxAnchorDisplacementMm, 0);
    assert.deepEqual(solved.solvedPoints[0], [-6, 0, 0]); assert.deepEqual(solved.solvedPoints.at(-1), [6, 0, 0]);
    assert.equal(solved.numerical.curvatureIsCertifiedBound, false);
    assert.equal(solved.numerical.samplesPerSegment, 65);
  }
}
assert.equal(JSON.stringify(RELAXATION_INPUT), seedBefore);
assert.ok(cases[0].solverResult.numerical.zRangeMm < cases[1].solverResult.numerical.zRangeMm);
assert.ok(cases[1].solverResult.numerical.zRangeMm < cases[2].solverResult.numerical.zRangeMm);
for (const targetLengthMm of [NaN, -1, 10, 1000]) {
  const failed = buildYarnRelaxationExperiment({ targetLengthMm }, context);
  assert.ok(["INVALID", "UNREACHABLE"].includes(failed.status));
  assert.ok(failed.reason); assert.equal(failed.mesh, null); assert.equal(failed.centerline, null);
  readonly(failed);
}
console.log("PASS fixed seed, initial/three integral results, immutable Round4 path/frame/tube, fixed radius, provenance, failures");

assert.ok(fs.existsSync("src/simulation/yarnRelaxationWorker.js"), "Missing Round5 worker protocol.");
const { processYarnRelaxationRequest } = await import("../src/simulation/yarnRelaxationWorker.js");
const job = { requestId: 1, ...context, targetLengthMm: 14, includeReferences: true };
const response = processYarnRelaxationRequest(job);
assert.equal(response.requestId, 1); assert.equal(response.projectGeneration, 4);
assert.equal(response.targetLengthMm, 14); assert.equal(response.result.status, "CONVERGED");
assert.equal(response.referenceCases.length, 3); assert.equal(response.initial.status, "INITIAL");
assert.deepEqual(response.referenceCases.map(item => item.targetLengthMm), [12.5, 14, 16]);
readonly(response);
const single = processYarnRelaxationRequest({ ...job, requestId: 2, targetLengthMm: 10, includeReferences: false });
assert.equal(single.result.status, "UNREACHABLE");
assert.equal(single.referenceCases, null); assert.equal(single.initial, null);
console.log("PASS worker processing computes fixed references once and exposes serializable request/context/target identity");

assert.ok(fs.existsSync("src/components/yarnRelaxationWorkbenchController.js"), "Missing cancellable relaxation controller.");
const { createYarnRelaxationWorkbenchController } = await import("../src/components/yarnRelaxationWorkbenchController.js");
const workers = [], renderers = [];
function createWorker() {
  const worker = { request: null, terminated: false,
    postMessage(request) { this.request = structuredClone(request); }, terminate() { this.terminated = true; },
    reply(data) { this.onmessage?.({ data }); } };
  workers.push(worker); return worker;
}
function createRenderer(callbacks) {
  let view = null;
  const renderer = { geometry: null, updates: [], disposed: false, rejectNextGeometry: false,
    status: { status: "OK" }, mount() { return this.status; },
    update(input) {
      this.updates.push(input);
      if (input.geometry && this.rejectNextGeometry) {
        this.rejectNextGeometry = false;
        return this.status = { status: "INVALID", diagnostic: "controlled atomic geometry rejection" };
      }
      if (Object.hasOwn(input, "geometry")) this.geometry = input.geometry;
      if (input.view) { view = { ...view, ...input.view }; callbacks.onViewChange(view); }
      callbacks.onStatusChange(this.status = { status: "OK" }); return this.status;
    },
    setView(patch) { return this.update({ view: patch }); },
    dispose() { this.disposed = true; this.geometry = null; },
    get view() { return view; }, callbacks };
  renderers.push(renderer); return renderer;
}
const replyFor = (worker, data = response) => ({ ...structuredClone(data),
  requestId: worker.request.requestId, projectGeneration: worker.request.projectGeneration,
  feedYarnStructureRevision: worker.request.feedYarnStructureRevision, targetLengthMm: worker.request.targetLengthMm });
const controller = createYarnRelaxationWorkbenchController({ context, createWorker, createRenderer });
assert.equal(workers.length, 0, "Construction is inert until mounted.");
controller.mount({ clientWidth: 800, clientHeight: 400 });
const renderer = renderers[0], first = workers[0];
const savedFirstCallback = first.onmessage;
assert.equal(controller.model.phase, "PENDING"); assert.equal(renderer.geometry, null);
controller.setTargetLength(16);
assert.ok(first.terminated); assert.equal(controller.model.result, null);
assert.equal(renderer.geometry, null); assert.equal(workers.length, 2);
first.reply(replyFor(first)); assert.equal(controller.model.phase, "PENDING", "Late successful job cannot publish.");
savedFirstCallback({ data: replyFor(first) }); assert.equal(controller.model.phase, "PENDING");
const second = workers[1];
second.onmessage({ data: { ...replyFor(second), targetLengthMm: 14 } });
second.onmessage({ data: { ...replyFor(second), feedYarnStructureRevision: 6 } });
second.onmessage({ data: { ...replyFor(second), projectGeneration: 3 } });
assert.equal(controller.model.phase, "PENDING", "Wrong target/revision/generation payloads cannot publish.");
const secondResponse = replyFor(second); secondResponse.result = structuredClone(cases[2]);
second.reply(secondResponse);
assert.equal(controller.model.result.targetLengthMm, 16); assert.equal(controller.model.phase, "CONVERGED");
assert.ok(second.terminated, "Completed worker releases its execution context.");
second.onerror({ message: "late error after completed job", preventDefault() {} });
assert.equal(controller.model.phase, "CONVERGED", "A queued callback from a completed worker cannot replace the result.");
readonly(controller.model.result); readonly(controller.exportSession());
secondResponse.result.mesh.positions[0] = 9000;
assert.notEqual(controller.model.result.mesh.positions[0], 9000, "Worker mutable data cannot alias public result.");
const fixedCamera = JSON.stringify(controller.model.view), jobCount = workers.length;
for (const target of [12.5, 14, 16]) {
  controller.setTargetLength(target);
  assert.equal(controller.model.result.targetLengthMm, target);
  assert.equal(JSON.stringify(controller.model.view), fixedCamera, "Target changes preserve camera.");
  controller.setDisplayMode("initial"); assert.equal(controller.model.derivedGeometry.status, "INITIAL");
  assert.equal(JSON.stringify(controller.model.view), fixedCamera);
  controller.setDisplayMode("solved");
}
controller.setView({ yaw: .8 }); controller.setMaterial({ roughness: .6 }); controller.fit(); controller.closeup();
assert.equal(workers.length, jobCount, "Cached cases, view, lighting and initial/solved do not solve again.");
controller.setTargetLength(15); const third = workers.at(-1);
assert.equal(renderer.geometry, null); assert.equal(controller.model.result, null);
assert.equal(third.request.includeReferences, false);
controller.setTargetLength(NaN);
assert.ok(third.terminated); assert.equal(controller.model.phase, "INVALID");
assert.equal(controller.model.derivedGeometry, null); assert.equal(renderer.geometry, null);
third.reply(replyFor(third)); assert.equal(controller.model.phase, "INVALID");
controller.setDisplayMode("initial"); controller.setMaterial({ ambient: .3 }); controller.fit();
assert.equal(renderer.geometry, null, "Failure cannot resurrect a cached initial shape.");
assert.match(controller.model.error.message, /target|目标/i);
controller.setTargetLength(14); controller.setDisplayMode("solved");
assert.ok(renderer.geometry);
controller.setTargetLength(10); const unreachableJob = workers.at(-1);
unreachableJob.reply(replyFor(unreachableJob, single));
assert.equal(controller.model.phase, "UNREACHABLE"); assert.equal(renderer.geometry, null);
controller.setView({ yaw: .1 }); assert.equal(controller.model.phase, "UNREACHABLE");
controller.setTargetLength(14); renderer.rejectNextGeometry = true; controller.setTargetLength(16);
assert.equal(renderer.geometry, null, "Atomic renderer rejection clears the previous scene in a separate update.");
assert.match(controller.model.geometryApplyError.diagnostic, /controlled atomic/);
controller.setDisplayMode("initial"); controller.setView({ yaw: .3 }); controller.setMaterial({ roughness: .7 }); controller.fit();
assert.equal(renderer.geometry, null); assert.match(controller.model.geometryApplyError.diagnostic, /controlled atomic/);
controller.setTargetLength(14); assert.equal(controller.model.geometryApplyError, null);
controller.updateContext({ ...context, feedYarnStructureRevision: 8 });
assert.equal(renderer.geometry, null); assert.equal(controller.model.referenceCases.length, 0);
const revisionJob = workers.at(-1); assert.equal(revisionJob.request.includeReferences, true);
controller.updateContext({ projectGeneration: 5, feedYarnStructureRevision: 9 });
assert.ok(revisionJob.terminated); assert.equal(controller.model.targetLengthMm, 14);
revisionJob.reply(replyFor(revisionJob)); assert.equal(controller.model.phase, "PENDING");
const generationJob = workers.at(-1);
const savedGenerationCallback = generationJob.onmessage;
controller.dispose(); assert.ok(generationJob.terminated); assert.ok(renderer.disposed);
savedGenerationCallback({ data: replyFor(generationJob) }); assert.equal(controller.model.result, null);
const startup = createYarnRelaxationWorkbenchController({ context, createWorker: () => { throw Error("worker startup failed"); }, createRenderer });
startup.mount({}); assert.equal(startup.model.phase, "ERROR"); assert.match(startup.model.error.message, /startup/); startup.dispose();
const runtime = createYarnRelaxationWorkbenchController({ context, createWorker, createRenderer }); runtime.mount({});
const runtimeJob = workers.at(-1); runtimeJob.onerror({ message: "worker runtime failed", preventDefault() {} });
assert.equal(runtime.model.phase, "ERROR"); assert.equal(runtime.model.result, null); assert.ok(runtimeJob.terminated); runtime.dispose();
console.log("PASS cancellation, stale callbacks, invalid input, failures, context teardown, immutable handoff, fixed camera, view-only operations");

assert.ok(fs.existsSync("src/views/yarnRelaxationWorkbench.js"), "Missing lazy relaxation view and projected anchors.");
const loaded = new Set(), calls = { compute: 0, solver: 0 };
globalThis.__relaxationCalls = calls;
const server = await createServer({ configFile: false, appType: "custom", logLevel: "silent",
  cacheDir: process.env.KNITSCAPE_TEST_CACHE_DIR || path.join(os.tmpdir(), "knitscape-validation", "knitscape-round5-20261103", "workbench-integration", "vite-cache"),
  server: { middlewareMode: true, hmr: { server: http.createServer() } },
  plugins: [{ name: "observe-relaxation-boundaries", enforce: "pre", transform(source, id) {
    const normalized = id.replaceAll("\\", "/"); loaded.add(normalized);
    if (/\/views\/yarn(?:Spatial|Relaxation)Workbench\.js$/.test(normalized))
      return source.replaceAll("render(", "globalThis.__relaxationRender(");
    for (const [name, marker, key] of [["computeYarnSimulation", "  if (scope !==", "compute"],
      ["yarnLengthSolver", "  gauge = normalizeMachineGauge(gauge);", "solver"]]) {
      if (normalized.endsWith(`/simulation/${name}.js`)) {
        assert.ok(source.includes(marker)); return source.replace(marker, `globalThis.__relaxationCalls.${key}++;\n${marker}`);
      }
    }
  } }] });
let runner;
const flatten = value => value?.strings ? value.strings.reduce((text, piece, i) => text + piece + flatten(value.values[i]), "") :
  Array.isArray(value) ? value.map(flatten).join("") : typeof value === "string" || typeof value === "number" ? String(value) : "";
const findTemplate = (value, predicate) => {
  if (value?.strings && predicate(value)) return value;
  for (const child of Array.isArray(value) ? value : value?.values ?? []) { const found = findTemplate(child, predicate); if (found) return found; }
  return null;
};
const handler = (template, event, label) => {
  const owner = findTemplate(template, item => item.strings.some((piece, index, parts) =>
    piece.trimEnd().endsWith(`@${event}=`) && (!label || parts[index + 1]?.includes(label))));
  const index = owner?.strings.findIndex((piece, i, parts) => piece.trimEnd().endsWith(`@${event}=`) && (!label || parts[i + 1]?.includes(label)));
  assert.ok(index >= 0, `Missing ${event} control ${label || ""}`); return owner.values[index];
};
try {
  const { createSpatialWorkbenchHost } = await server.ssrLoadModule("/src/components/spatialWorkbenchHost.js");
  const host = createSpatialWorkbenchHost({ getContext: () => ({ ...context, workbenchMode: "classic2d" }), getContainer: () => null });
  host.sync(); await host.ready(); host.dispose();
  assert.ok(![...loaded].some(id => /yarnRelaxation|yarnSpatialRelaxation/.test(id)), "Cold Classic loads no Round5 math, worker or GPU module.");
  globalThis.document = { createTreeWalker() { return {}; } };
  globalThis.__relaxationRender = (template, target) => { target.template = template; };
  const childModule = await server.ssrLoadModule("/src/views/yarnRelaxationWorkbench.js");
  const viewport = { clientWidth: 800, clientHeight: 400, ownerDocument: { defaultView: {} } };
  const childContainer = { querySelector: () => viewport };
  const widget = childModule.createYarnRelaxationWorkbench({ container: childContainer, context, createWorker, createRenderer });
  const widgetJob = workers.at(-1); widgetJob.reply(replyFor(widgetJob));
  let markup = flatten(childContainer.template);
  for (const label of ["纱线空间形变实验", "TEST_ONLY", "目标长度", "12.5", "14", "16", "初始形状", "求解形状", "共同边界",
    "A [-6, 0, 0]", "B [6, 0, 0]", "初始 XYZ 积分", "求解 XYZ 积分", "采样最大曲率", "采样最大 Z", "锚点偏移", "NOT_EVALUATED"])
    assert.ok(markup.includes(label), `Actual child template exposes ${label}`);
  handler(childContainer.template, "change")({ currentTarget: { value: "initial" } });
  assert.equal(widget.derivedGeometry.status, "INITIAL");
  const uiNumber = value => value.toLocaleString("en-US", { maximumFractionDigits: 9 });
  const initialDisplay = findTemplate(childContainer.template, item => item.values[0] === "当前显示 XYZ 积分 (mm)");
  assert.equal(initialDisplay.values[1], uiNumber(response.initial.xyzLength.value), "Initial mode displays the initial integral.");
  const retainedSolver = response.result.solverResult;
  for (const [label, expected] of [
    ["求解采样最大 Z (mm)", uiNumber(retainedSolver.numerical.maxZMm)],
    ["求解采样 Z 范围 (mm)", uiNumber(retainedSolver.numerical.zRangeMm)],
    ["求解采样最大曲率 (1/mm)", uiNumber(retainedSolver.numerical.maxSampledCurvaturePerMm)],
    ["求解锚点偏移 (mm)", retainedSolver.residuals.maxAnchorDisplacementMm.toExponential(3)],
    ["求解一阶驻点残差", retainedSolver.residuals.stationarity.toExponential(3)],
    ["求解迭代 / 评估", `${retainedSolver.iterations} / ${retainedSolver.evaluations}`],
  ]) {
    const diagnostic = findTemplate(childContainer.template, item => item.values[0] === label);
    assert.ok(diagnostic, `Initial mode explicitly identifies retained solver diagnostic: ${label}`);
    assert.equal(diagnostic.values[1], expected, `Retained solver value: ${label}`);
  }
  handler(childContainer.template, "change")({ currentTarget: { value: "solved" } });
  const targetTemplate = findTemplate(childContainer.template, item => item.strings.join("").includes('data-relaxation-target'));
  handler(targetTemplate, "input")({ currentTarget: { valueAsNumber: NaN } });
  markup = flatten(childContainer.template); assert.match(markup, /INVALID_TARGET_LENGTH/);
  assert.equal(renderers.at(-1).geometry, null);
  handler(targetTemplate, "input")({ currentTarget: { valueAsNumber: 14 } });
  const anchors = childModule.projectYarnRelaxationAnchors({ view: renderers.at(-1).view,
    derivedGeometry: response.result }, 800, 400);
  assert.equal(anchors.length, 2); assert.ok(anchors.every(anchor => anchor.visible && Number.isFinite(anchor.left) && Number.isFinite(anchor.top)));
  assert.notEqual(anchors[0].left, anchors[1].left);
  widget.dispose(); assert.ok(renderers.at(-1).disposed);
  console.log("PASS actual Lit controls, canonical @input invalid clearing, and camera-projected anchor labels");

  const { createYarnSpatialWorkbench } = await server.ssrLoadModule("/src/views/yarnSpatialWorkbench.js");
  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  const nativeViewport = { childElementCount: 0, clientWidth: 800, clientHeight: 400,
    appendChild() { this.childElementCount++; }, ownerDocument: { defaultView: {}, createElement() {
      return { style: {}, setAttribute() {}, addEventListener() {}, removeEventListener() {}, getContext() { return null; },
        remove() { nativeViewport.childElementCount--; } };
    } } };
  const lazySlot = { querySelector: () => viewport, isConnected: true };
  const parentContainer = { querySelector: selector => selector === "[data-spatial-viewport]" ? nativeViewport : lazySlot };
  const lazyImports = [];
  const parent = createYarnSpatialWorkbench({ container: parentContainer, context: { ...context, workbenchMode: "pbr25d" },
    loadRelaxationWorkbench: () => { const pending = deferred(); lazyImports.push(pending); return pending.promise; } });
  const toggle = () => handler(findTemplate(parentContainer.template, item => item.strings.join("").includes("data-relaxation-toggle")), "click")();
  assert.equal(lazyImports.length, 0, "Round4 remains independent until explicit child activation.");
  const jobsBeforeOpen = workers.length;
  toggle(); await Promise.resolve(); assert.equal(lazyImports.length, 1); assert.equal(workers.length, jobsBeforeOpen);
  toggle(); lazyImports[0].resolve(childModule); await parent.ready();
  assert.equal(workers.length, jobsBeforeOpen, "Closing while import is pending cannot mount a worker.");
  toggle(); await Promise.resolve();
  const injectedChild = { createYarnRelaxationWorkbench: options => childModule.createYarnRelaxationWorkbench({ ...options, createWorker, createRenderer }) };
  lazyImports[1].resolve(injectedChild); await parent.ready();
  assert.equal(workers.length, jobsBeforeOpen + 1); const activeChildJob = workers.at(-1);
  activeChildJob.reply(replyFor(activeChildJob));
  const inputTemplate = findTemplate(lazySlot.template, item => item.strings.join("").includes("data-relaxation-target"));
  handler(inputTemplate, "input")({ currentTarget: { valueAsNumber: 16 } });
  const saved = parent.exportSession(); assert.equal(saved.relaxation.session.targetLengthMm, 16);
  parent.updateContext({ ...context, workbenchMode: "pbr25d", feedYarnStructureRevision: 8 });
  assert.equal(workers.at(-1).request.feedYarnStructureRevision, 8);
  const revisionPending = workers.at(-1);
  parent.updateContext({ projectGeneration: 5, feedYarnStructureRevision: 9, workbenchMode: "pbr25d" });
  assert.ok(revisionPending.terminated); assert.equal(parent.exportSession().relaxation.active, false);
  toggle(); await Promise.resolve(); const disposedPending = lazyImports.at(-1); parent.dispose(); disposedPending.resolve(injectedChild); await parent.ready();
  assert.equal(nativeViewport.childElementCount, 0);
  assert.equal(workers.length, jobsBeforeOpen + 2, "Disposed import cannot create a late worker.");
  console.log("PASS lazy parent activation, stale import guards, child context propagation, session capture and teardown");

  // Execute the real app computation, old Solver, exporter and ZIP reader in
  // memory. Only browser canvas/window surfaces and the new worker are fixtures.
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
  globalThis.document = { title: "", documentElement: { lang: "" }, createTreeWalker() { return {}; }, getElementById: id => nodes.get(id) ?? null };
  const state = await server.ssrLoadModule("/src/state.js");
  const { Bimp } = await server.ssrLoadModule("/src/lib/Bimp.js");
  const { getProjectData } = await server.ssrLoadModule("/src/actions/exporters.js");
  const { createProjectPackage, readProjectPackage } = await server.ssrLoadModule("/src/actions/projectPackage.js");
  runner = await server.ssrLoadModule("/src/components/runSimulation.js");
  state.dispatch({ chart: Bimp.empty(6, 6, 0), repeats: [{ bitmap: Bimp.empty(2, 2, 0), pos: [0, 0], area: [6, 6] }],
    yarnSequence: Bimp.empty(1, 6, 0), yarnPalette: ["#445566"],
    yarnLibrary: [{ id: "A", name: "A", color: "#445566", diameter: .20 }, { id: "B", name: "B", color: "#ffaa22", diameter: .10 }]
      .map(asset => ({ ...asset, category: "OTHER", createdAt: "2026-11-03T00:00:00.000Z", updatedAt: "2026-11-03T00:00:00.000Z" })),
    needleArrangement: [1], singleJerseyCamProgram: { tracks: [["K", "T"]], feeds: [
      { yarns: [{ yarnId: "A", yarnLengthCmPer100Needles: 23 }, { yarnId: "B", yarnLengthCmPer100Needles: 8 }] },
      { yarns: [{ yarnId: "A", yarnLengthCmPer100Needles: 23 }] }] } });
  state.StateMonitor.register([runner.runSimulation()]); await runner.whenSimulationPreviewsReady();
  const snapshots = runner.getCurrentSimulationSnapshots(), coreCounts = { ...calls };
  assert.ok(coreCounts.compute > 0 && coreCounts.solver > 0, "Real original computation and Solver executed.");
  const baseline = state.GLOBAL_STATE, exported = JSON.stringify(getProjectData());
  const packageBefore = await readProjectPackage(await createProjectPackage(getProjectData()));
  const stableKeys = ["yarnLengthSolverResults", "yarnLengthMetrics", "previewValidity", "feedYarnStructureRevision", "projectGeneration",
    "yarnLibrary", "singleJerseyCamProgram", "chart", "repeats", "needleArrangement"];
  const unchanged = () => {
    stableKeys.forEach(key => assert.equal(state.GLOBAL_STATE[key], baseline[key], `Original ${key} identity preserved.`));
    assert.equal(runner.getCurrentSimulationSnapshots().machine, snapshots.machine, "Original M1/M3/CN/XYZ snapshot identity preserved.");
    assert.equal(runner.getCurrentSimulationSnapshots().pattern, snapshots.pattern);
    assert.equal(JSON.stringify(getProjectData()), exported, "Project facts/export unchanged.");
    assert.deepEqual(calls, coreCounts, "No original computation or Solver re-entry.");
  };
  const isolated = createYarnRelaxationWorkbenchController({ context: baseline, createWorker, createRenderer }); isolated.mount(viewport);
  const isolationJob = workers.at(-1); isolationJob.reply(replyFor(isolationJob)); unchanged();
  for (const target of [12.5, 16, NaN, 14, 10]) {
    isolated.setTargetLength(target); unchanged();
    isolated.setDisplayMode("initial"); isolated.setDisplayMode("solved"); unchanged();
    isolated.setMaterial({ roughness: .6 }); isolated.setView({ yaw: .6 }); isolated.fit(); unchanged();
  }
  for (const workbenchMode of ["pbr25d", "classic2d", "pbr25d", "classic2d"]) {
    state.dispatch({ workbenchMode }); await runner.whenSimulationPreviewsReady(); unchanged();
  }
  isolated.dispose(); unchanged();
  const packageAfter = await readProjectPackage(await createProjectPackage(getProjectData()));
  assert.deepEqual(packageAfter.project, packageBefore.project, "Actual ZIP manifest roundtrip preserves all pre-existing project facts.");
  assert.ok(!Object.keys(packageAfter.project).some(key => /relaxation|derivedGeometry|spatialExperiment/i.test(key)));
  packageBefore.registry.clear(); packageAfter.registry.clear();
  for (const file of ["src/simulation/yarnRelaxationExperiment.js", "src/simulation/yarnRelaxationWorker.js",
    "src/components/yarnRelaxationWorkbenchController.js", "src/views/yarnRelaxationWorkbench.js"]) {
    const source = fs.readFileSync(file, "utf8");
    assert.ok(!/GLOBAL_STATE|\bdispatch\s*\(|from\s+["'][^"']*(?:state|yarnLengthSolver|projectPackage|PhysicalUv)/.test(source), `No original state or Solver authority import: ${file}`);
  }
  const packageScripts = JSON.parse(fs.readFileSync("package.json", "utf8")).scripts;
  assert.equal(packageScripts["validate:yarn-spatial-relaxation"], "node scripts/validate-yarn-spatial-relaxation.mjs");
  assert.equal(packageScripts["validate:yarn-relaxation-workbench"], "node scripts/validate-yarn-relaxation-workbench.mjs");
  console.log("PASS original state/snapshots/M1-M3/Solver identity, mode isolation and actual in-memory project ZIP export/read preservation");
} finally {
  runner?.stopSimulation(); await server.close();
  delete globalThis.__relaxationRender; delete globalThis.__relaxationCalls;
}
