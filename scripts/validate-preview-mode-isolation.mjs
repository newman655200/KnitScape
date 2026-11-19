import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { createServer } from "vite";

// Only browser surfaces and scheduling are fixtures. All calculation, state,
// project actions, material resolution and both renderers execute real code.
globalThis.devicePixelRatio = 1;
globalThis.Path2D = class { constructor(data = "") { this.data = data; } };
const timers = new Map(), windows = new Map();
let timerId = 0, dimensions = { width: 400, height: 300 };
globalThis.window = {
  location: { search: "" },
  setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
  clearTimeout(id) { timers.delete(id); },
  addEventListener(name, fn) { windows.set(name, fn); },
  removeEventListener(name, fn) { if (windows.get(name) === fn) windows.delete(name); },
};
function flush() { const jobs = [...timers.values()]; timers.clear(); jobs.forEach(fn => fn()); }
const contexts = new Map(), nodes = new Map();
function canvas(id) {
  const paths = [], context = { clearRect() { paths.length = 0; }, save() {}, restore() {},
    stroke(p) { paths.push(p.data); }, createPattern() { return null; }, drawImage() {} };
  contexts.set(id, { paths, context });
  return { id, width: 0, height: 0, style: {}, getContext(kind) {
    assert.equal(kind, "2d", "No texture-free scene needs WebGL."); return context;
  } };
}
for (const id of ["back", "mid", "front", "back-arranged", "mid-arranged", "front-arranged",
  "pbr-back", "pbr-mid", "pbr-front"]) nodes.set(id, canvas(id));
for (const id of ["sim-container", "sim-before-container", "sim-after-container", "pbr-preview-container", "desktop"])
  nodes.set(id, { getBoundingClientRect: () => ({ ...dimensions, left: 0, top: 0 }),
    addEventListener() {}, removeEventListener() {} });
nodes.set("machine-execution-error", { hidden: true, textContent: "" });
globalThis.document = { title: "", documentElement: { lang: "" }, createTreeWalker() { return {}; },
  getElementById: id => nodes.get(id) ?? null };
const observed = new Set();
globalThis.ResizeObserver = class { constructor(fn) { this.fn = fn; observed.add(this); }
  observe() {} disconnect() { observed.delete(this); } };
globalThis.__previewCounts = { compute: 0, execution: 0, geometry: 0, solver: 0 };
globalThis.__previewLifecycle = [];
globalThis.__previewScenes = [];
const instruments = [
  ["/simulation/computeYarnSimulation.js", "  if (scope !==", "compute"],
  ["/components/singleJerseyExecutionInput.js", "  if (", "execution"],
  ["/simulation/yarnPathGeometry.js", "  machineGauge = normalizeMachineGauge", "geometry"],
  ["/simulation/yarnLengthSolver.js", "  gauge = normalizeMachineGauge(gauge);", "solver"],
];
const server = await createServer({ configFile: false, appType: "custom", logLevel: "silent",
  cacheDir: process.env.KNITSCAPE_TEST_CACHE_DIR || path.join(os.homedir(), "Documents", "KnitScape",
    "archives", "validation-cache", "preview-mode-isolation"),
  server: { middlewareMode: true, hmr: { server: http.createServer() } },
  plugins: [{ name: "observe-calculation-boundaries", enforce: "pre", transform(source, id) {
    const renderer = id.replaceAll("\\", "/").endsWith("/simulation/pbrPreviewRenderer.js") ? "pbr"
      : id.replaceAll("\\", "/").endsWith("/simulation/classic2dRenderer.js") ? "classic" : null;
    if (renderer) return source.replace("mount(nextCanvases) {",
      `mount(nextCanvases) { globalThis.__previewLifecycle.push(["${renderer}", "mount"]);`)
      .replace("dispose() {", `dispose() { globalThis.__previewLifecycle.push(["${renderer}", "dispose"]);`)
      .replace("update(scene) {", `update(scene) { globalThis.__previewScenes.push({
        scope: scene.snapshot.scope, target: canvases.frontCanvas.id, trial: Boolean(scene.structureLineStyle) });`);
    for (const [suffix, marker, counter] of instruments) {
      if (!id.replaceAll("\\", "/").endsWith(suffix)) continue;
      assert.ok(source.includes(marker), `Calculation observer seam: ${suffix}`);
      return source.replace(marker, `  globalThis.__previewCounts.${counter}++;\n${marker}`);
    }
  } }],
});
let runner;
try {
  const stateModule = await server.ssrLoadModule("/src/state.js");
  const current = () => stateModule.GLOBAL_STATE;
  assert.equal(current().workbenchMode, "classic2d", "Classic is the default independent workbench.");
  assert.equal(current().workspaceMode, "pattern");
  runner = await server.ssrLoadModule("/src/components/runSimulation.js");
  const { Bimp } = await server.ssrLoadModule("/src/lib/Bimp.js");
  const actions = await server.ssrLoadModule("/src/actions/singleJerseyCamProgram.js");
  const importer = await server.ssrLoadModule("/src/actions/importers.js");
  const { getProjectData } = await server.ssrLoadModule("/src/actions/exporters.js");
  const { updateYarnAssetColor } = await server.ssrLoadModule("/src/actions/yarnLibrary.js");
  const { projectSimulationViewport } = await server.ssrLoadModule("/src/simulation/simulationViewport.js");
  const chart = Bimp.empty(6, 6, 0);
  stateModule.dispatch({ chart, repeats: [{ bitmap: Bimp.empty(2, 2, 0), pos: [0, 0], area: [6, 6] }],
    yarnSequence: Bimp.empty(1, 6, 0), yarnPalette: ["#445566"],
    yarnLibrary: [{ id: "A", name: "A", color: "#445566", diameter: .20 },
      { id: "B", name: "B", color: "#ff8822", diameter: .10 }],
    needleArrangement: [1], singleJerseyCamProgram: { tracks: [["K", "T"]], feeds: [
      { yarns: [{ yarnId: "A", yarnLengthCmPer100Needles: 23 }, { yarnId: "B", lengthInputMode: "relaxedWithDraft", relaxedLengthCmPer100Needles: 8, draftRatio: 3 }] },
      { yarns: [{ yarnId: "A", yarnLengthCmPer100Needles: 23 }] },
    ] } });
  stateModule.StateMonitor.register([runner.runSimulation()]);
  await runner.whenSimulationPreviewsReady();
  const original = runner.getCurrentSimulationSnapshots();
  assert.ok(original.pattern && original.machine);
  assert.equal(original.pending, false);
  assert.equal(original.machine.scope, "machine");
  assert.ok(original.machine.inputSignature);
  assert.equal(original.machine.projectGeneration, current().projectGeneration);
  assert.equal(original.machine.feedYarnStructureRevision, current().feedYarnStructureRevision);
  assert.equal(globalThis.__previewCounts.compute, 2);
  assert.equal(globalThis.__previewCounts.execution, 1);
  assert.ok(globalThis.__previewCounts.geometry >= 3);
  assert.ok(globalThis.__previewCounts.solver > 0, "Observe real Solver calls before asserting zero additional calls.");
  const counts = () => ({ ...globalThis.__previewCounts });
  const results = current().yarnLengthSolverResults, metrics = current().yarnLengthMetrics;
  const validity = current().previewValidity, revision = current().feedYarnStructureRevision;
  const assertUnchanged = label => {
    const next = runner.getCurrentSimulationSnapshots();
    assert.equal(next.pattern, original.pattern, label);
    assert.equal(next.machine, original.machine, label);
    assert.equal(current().yarnLengthSolverResults, results, label);
    assert.equal(current().yarnLengthMetrics, metrics, label);
    assert.equal(current().previewValidity, validity, label);
    assert.equal(current().feedYarnStructureRevision, revision, label);
  };
  const before = counts();
  // A Pattern edit reverted before debounce reuses both snapshots, but its
  // settled pending state still has to reach the real event-driven app renderer.
  const { createAppRenderer } = await server.ssrLoadModule("/src/components/renderApp.js");
  const appFrames = [], appRenders = [], regressions = [];
  const appRenderer = createAppRenderer({
    renderView: () => appRenders.push(runner.getCurrentSimulationSnapshots().pending),
    requestFrame: callback => appFrames.push(callback),
  });
  const flushAppFrames = () => appFrames.splice(0).forEach(callback => callback());
  stateModule.StateMonitor.register([() => appRenderer]);
  appRenderer.renderInitial();
  stateModule.dispatch({ chart: new Bimp(chart.width, chart.height,
    Array.from(chart.pixels, (value, index) => index === 0 ? 3 : value)) });
  flushAppFrames();
  assert.equal(appRenders.at(-1), true);
  stateModule.dispatch({ chart });
  flushAppFrames();
  assert.equal(appRenders.at(-1), true);
  const pendingRenders = appRenders.length;
  flush(); flushAppFrames();
  assert.equal(runner.getCurrentSimulationSnapshots().pending, false);
  assertUnchanged("Pattern edit reverted during debounce");
  assert.deepEqual(counts(), before, "The settled Pattern revert must reuse calculations.");
  if (appRenders.at(-1) !== false || appRenders.length !== pendingRenders + 1)
    regressions.push("Settling a cached Pattern input must refresh the app exactly once with pending=false.");

  function findTemplate(value, id) {
    if (value?.strings?.join("").includes(id)) return value;
    for (const child of Array.isArray(value) ? value : value?.values ?? []) {
      const found = findTemplate(child, id); if (found) return found;
    }
    return null;
  }
  const trialTemplate = findTemplate(runner.simulationView(), 'id="structure-line-trial-toggle"');
  assert.ok(trialTemplate);
  const trialClick = trialTemplate.values[trialTemplate.strings.findIndex(text => text.trimEnd().endsWith("@click="))];
  assert.equal(typeof trialClick, "function");
  const sceneStart = globalThis.__previewScenes.length;
  trialClick();
  const trialScenes = globalThis.__previewScenes.slice(sceneStart);
  const patternTrial = trialScenes.find(scene => scene.target === "front");
  const machineTrial = trialScenes.find(scene => scene.target === "front-arranged");
  assert.ok(patternTrial && machineTrial, "Observe both real Classic target updates.");
  assert.equal(machineTrial.scope, "machine");
  assert.equal(machineTrial.trial, true);
  assert.equal(patternTrial.scope, "pattern");
  if (patternTrial.trial !== false)
    regressions.push("The Machine structure-line trial must leave the Pattern comparison in its original solid style.");
  trialClick(); flushAppFrames();
  assertUnchanged("Machine-only structure-line trial");
  assert.deepEqual(counts(), before);
  assert.deepEqual(regressions, [], "Quality-review regression cases");

  for (const mode of ["pbr25d", "classic2d", "pbr25d", "classic2d"]) {
    stateModule.dispatch({ workbenchMode: mode }); await runner.whenSimulationPreviewsReady();
    assertUnchanged(mode); assert.deepEqual(counts(), before);
  }
  for (const patch of [ { simScale: 1.2, simPan: { x: 3, y: -9 } }, { flipped: true },
    { pbrView: { scale: 1.8, pan: { x: 8, y: 3 }, flipped: true, visibleYarnId: "B" } },
    { showDesignComparison: true }, { texturePerformanceMode: "solid" },
    { yarnPalette: ["#112233"] }, { yarnPlies: current().yarnPlies.map(p => ({ ...p, color: "#778899" })) } ]) {
    stateModule.dispatch(patch); await runner.whenSimulationPreviewsReady(); assertUnchanged(JSON.stringify(patch));
  }
  updateYarnAssetColor("A", "#123456");
  stateModule.dispatch({ yarnLibrary: current().yarnLibrary.map(y => ({ ...y, name: y.name + " renamed",
    pbr: { physicalRepeatLengthMm: 4 } })) });
  await runner.whenSimulationPreviewsReady(); assertUnchanged("appearance metadata");
  dimensions = { width: 500, height: 350 }; devicePixelRatio = 2;
  windows.get("resize")?.(); for (const observer of observed) observer.fn();
  await runner.whenSimulationPreviewsReady(); assertUnchanged("viewport / DPR");
  assert.deepEqual(counts(), before, "Every appearance and viewport action has zero core computation.");
  const identity = projectSimulationViewport(original.machine, original.machine.referenceViewport);
  assert.equal(identity.yarnStrands, original.machine.yarnStrands);
  const projected = projectSimulationViewport(original.machine, { canvasWidth: 900, canvasHeight: 700 });
  assert.equal(projected.yarnStrands[0].modelPathByLink, original.machine.yarnStrands[0].modelPathByLink);
  assert.notEqual(projected.yarnStrands[0].resolvedPathByLink, original.machine.yarnStrands[0].resolvedPathByLink);
  assert.deepEqual(counts(), before, "Projection never calls geometry or the solver.");
  assert.equal(runner.getSimulationPreviewStatus().derivedGeometry, null,
    "Future spatial output is separate and currently absent; planar labels are not XYZ.");
  for (const key of ["workbenchMode", "pbrView", "projectGeneration"])
    assert.equal(Object.hasOwn(getProjectData(), key), false, `${key} is runtime only.`);

  // A mode change during the calculation debounce cannot republish stale results.
  actions.setSingleJerseyFeedYarnLength(0, 0, 25);
  assert.equal(runner.getCurrentSimulationSnapshots().pending, true);
  assert.deepEqual(current().yarnLengthSolverResults, []);
  stateModule.dispatch({ workbenchMode: "pbr25d", yarnPalette: ["#abcdef"] });
  await runner.whenSimulationPreviewsReady();
  assert.deepEqual(current().yarnLengthSolverResults, []);
  assert.equal(runner.getSimulationPreviewStatus().phase, "pending");
  assert.deepEqual(counts(), before);
  flush(); await runner.whenSimulationPreviewsReady();
  assert.equal(runner.getCurrentSimulationSnapshots().pattern, original.pattern);
  assert.notEqual(runner.getCurrentSimulationSnapshots().machine, original.machine);
  assert.equal(counts().compute, before.compute + 1, "Only the Machine scope recomputes for a target.");
  assert.equal(counts().execution, before.execution, "Target edits reuse Machine Execution.");
  const targetSnapshot = runner.getCurrentSimulationSnapshots().machine;
  const targetResults = current().yarnLengthSolverResults;
  const beforeRevert = counts();
  actions.setSingleJerseyFeedYarnLength(0, 0, 26);
  actions.setSingleJerseyFeedYarnLength(0, 0, 25);
  assert.deepEqual(current().yarnLengthSolverResults, []);
  assert.equal(runner.getCurrentSimulationSnapshots().pending, true);
  flush();
  assert.equal(runner.getCurrentSimulationSnapshots().machine, targetSnapshot);
  assert.deepEqual(current().yarnLengthSolverResults, targetResults,
    "Returning to the cached input during debounce republishes its valid results only at flush.");
  assert.deepEqual(counts(), beforeRevert);

  let dependencyCounts = counts();
  stateModule.dispatch({ machineGauge: 31 }); flush();
  assert.equal(counts().compute, dependencyCounts.compute + 2, "Gauge updates both numerical scopes once.");
  assert.equal(counts().execution, dependencyCounts.execution, "Gauge does not rebuild discrete machine operations.");
  dependencyCounts = counts();
  const unaffectedPattern = runner.getCurrentSimulationSnapshots().pattern;
  stateModule.dispatch({ yarnLibrary: current().yarnLibrary.map(yarn => yarn.id === "B" ? { ...yarn, diameter: .13 } : yarn) });
  flush();
  assert.equal(counts().compute, dependencyCounts.compute + 1, "An assigned Asset diameter only recomputes Machine geometry.");
  assert.equal(runner.getCurrentSimulationSnapshots().pattern, unaffectedPattern);
  assert.equal(counts().execution, dependencyCounts.execution);
  dependencyCounts = counts();
  actions.setSingleJerseyCamOperation(0, 1, "K"); flush();
  assert.equal(counts().compute, dependencyCounts.compute + 1);
  assert.equal(counts().execution, dependencyCounts.execution + 1, "Cam edits use the sole machine domain adapter.");
  dependencyCounts = counts();
  stateModule.dispatch({ needleArrangement: [1, 1] }); flush();
  assert.equal(counts().compute, dependencyCounts.compute + 1);
  assert.equal(counts().execution, dependencyCounts.execution + 1);

  const generation = current().projectGeneration;
  stateModule.dispatch({ projectGeneration: 999 });
  assert.equal(current().projectGeneration, generation, "Untrusted actions cannot forge generation.");
  assert.throws(() => importer.loadJSON({ width: -1 }));
  assert.equal(current().projectGeneration, generation, "Failed loads keep generation.");
  const exported = getProjectData();
  importer.loadJSON(exported);
  assert.equal(current().projectGeneration, generation + 1);
  assert.equal(runner.getSimulationPreviewStatus().phase, "pending");
  assert.deepEqual(current().yarnLengthSolverResults, []);
  flush(); await runner.whenSimulationPreviewsReady();
  assert.equal(runner.getCurrentSimulationSnapshots().machine.projectGeneration, generation + 1);
  stateModule.dispatch({ needleArrangement: [999] }); flush();
  await runner.whenSimulationPreviewsReady();
  assert.equal(current().previewValidity, "INVALID");
  assert.equal(runner.getCurrentSimulationSnapshots().machine, null);
  assert.ok(runner.getCurrentSimulationSnapshots().machineExecutionError);
  assert.equal(runner.getSimulationPreviewStatus().sceneScope, null, "Invalid Machine cannot masquerade as Pattern.");
  stateModule.dispatch({ needleArrangement: [] }); flush(); await runner.whenSimulationPreviewsReady();
  assert.equal(current().previewValidity, "DESIGN_PREVIEW");
  assert.equal(runner.getSimulationPreviewStatus().sceneScope, "pattern");
  stateModule.dispatch({ needleArrangement: [1] }); flush(); await runner.whenSimulationPreviewsReady();
  assert.equal(runner.getSimulationPreviewStatus().sceneScope, "machine");
  const pbrDisposals = () => globalThis.__previewLifecycle.filter(([kind, operation]) => kind === "pbr" && operation === "dispose").length;
  const beforeWithdrawal = pbrDisposals();
  stateModule.dispatch({ needleArrangement: [] }); flush(); await runner.whenSimulationPreviewsReady();
  assert.equal(pbrDisposals(), beforeWithdrawal + 1,
    "Withdrawing Machine explicitly disposes its PBR instance before a labeled Pattern fallback.");
  const beforeWorkspaceLoad = current().projectGeneration;
  stateModule.loadWorkspace({ yarnPalette: ["#112244"] });
  assert.equal(current().projectGeneration, beforeWorkspaceLoad + 1);
  assert.equal(runner.getCurrentSimulationSnapshots().pending, true);
  flush(); await runner.whenSimulationPreviewsReady();
  // Window / observer updates stay display-only and teardown rejects queued frames.
  const frames = new Map(); let frameId = 0;
  window.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  window.cancelAnimationFrame = id => frames.delete(id);
  const beforeFrames = counts();
  stateModule.dispatch({ workbenchMode: "classic2d" });
  stateModule.dispatch({ workbenchMode: "pbr25d" });
  stateModule.dispatch({ workbenchMode: "classic2d" });
  assert.equal(frames.size, 1, "Mode changes coalesce into one bounded preview frame.");
  runner.flushSimulationPreviews();
  assert.equal(runner.getSimulationPreviewStatus().sceneScope, "pattern");
  assert.deepEqual(counts(), beforeFrames);
  const queuedFrames = [...frames.values()];
  runner.stopSimulation();
  assert.equal(windows.has("resize"), false);
  assert.equal(observed.size, 0);
  for (const frame of queuedFrames) frame();
  assert.deepEqual(counts(), beforeFrames);

  // A different viewport must agree numerically with the original display
  // layout, while preserving exact original strings at the reference viewport.
  const { computeYarnSimulation } = await server.ssrLoadModule("/src/simulation/computeYarnSimulation.js");
  const alternate = computeYarnSimulation({ pattern: chart, yarnSequence: Bimp.empty(1, 6, 0),
    palette: ["#445566"], yarnPlies: [{ diameter: .24, enabled: true, lengthScaleY: 1 }],
    canvasWidth: 913, canvasHeight: 617, machineGauge: 32 });
  const base = computeYarnSimulation({ pattern: chart, yarnSequence: Bimp.empty(1, 6, 0),
    palette: ["#445566"], yarnPlies: [{ diameter: .24, enabled: true, lengthScaleY: 1 }],
    canvasWidth: 400, canvasHeight: 300, machineGauge: 32 });
  const alternateProjection = projectSimulationViewport(base, { canvasWidth: 913, canvasHeight: 617 });
  const numbers = data => data.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number);
  for (const [id, data] of alternate.yarnStrands[0].resolvedPathByLink) {
    const expected = numbers(data), actual = numbers(alternateProjection.yarnStrands[0].resolvedPathByLink.get(id));
    assert.equal(actual.length, expected.length);
    actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 0.000004,
      "Affine projection differs only by the legacy six-digit display rounding."));
  }
  const source = fs.readFileSync("src/components/runSimulation.js", "utf8");
  assert.doesNotMatch(source, /from\s+["'][^"']*(?:yarnSimulation|yarnTextureBrush|yarnUvWebglRenderer)/,
    "The app runner never imports the legacy PBR facade.");
  const classicLibrary = fs.readFileSync("src/views/view.js", "utf8");
  assert.match(classicLibrary, /yarnLibraryWorkspace\(\)/, "Classic keeps its metadata library.");
  const { pbrWorkbench } = await server.ssrLoadModule("/src/views/pbrWorkbench.js");
  const pbrTemplate = pbrWorkbench();
  for (const eventName of ["keydown", "keyup"]) {
    const index = pbrTemplate.strings.findIndex(text => text.trimEnd().endsWith(`@${eventName}=`));
    const handler = pbrTemplate.values[index];
    assert.equal(typeof handler, "function", `Advanced native controls must isolate ${eventName} from Classic shortcuts.`);
    const prior = current(); let stopped = 0;
    handler({ target: { tagName: "INPUT" }, stopPropagation() { stopped++; },
      preventDefault() { assert.fail("Native color/repeat editing and Ctrl+Z must keep their default action."); } });
    assert.equal(stopped, 1); assert.equal(current(), prior);
  }
  console.log("PASS: independent workbenches share immutable calculations; pending inputs, project identity, viewport and appearance stay isolated.");
} finally { runner?.stopSimulation(); assert.equal(observed.size, 0); await server.close(); }
