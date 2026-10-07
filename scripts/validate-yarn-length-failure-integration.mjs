import assert from "node:assert/strict";
import { createServer } from "vite";

// State, Machine Domain, solver, simulation and Canvas path dispatch are real.
// Only drawing surfaces/timers and an explicit solver fault are test fixtures.
globalThis.devicePixelRatio = 1;
globalThis.Path2D = class { constructor(data = "") { this.data = data; } };
const timers = new Map();
let nextTimer = 0;
globalThis.window = {
  clearTimeout(id) { timers.delete(id); },
  setTimeout(callback) { timers.set(++nextTimer, callback); return nextTimer; },
};
function flushTimers() {
  const pending = [...timers.values()];
  timers.clear();
  pending.forEach(callback => callback());
}
const canvases = new Map(["back", "mid", "front", "back-arranged", "mid-arranged", "front-arranged"].map(id => {
  const paths = [];
  const context = { clearRect() { paths.length = 0; }, save() {}, restore() {},
    stroke(path) { paths.push(path.data); }, createPattern() { return null; } };
  return [id, { width: 0, height: 0, style: {}, paths, getContext: () => context }];
}));
const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true },
  plugins: [{ name: "test-solver-failure", enforce: "pre", transform(source, id) {
    if (id.endsWith("/yarnPathGeometry.js")) return source.replace(
      "function resolveModelPathsForDisplay(solvedPathByLink) {",
      "function resolveModelPathsForDisplay(solvedPathByLink) { if (globalThis.pathNotAppliedForTest) return resolvedPathByLink;"
    );
    if (!id.endsWith("/yarnLengthSolver.js")) return;
    return source.replace("export function solveFeedYarnLengths(", "function realSolveFeedYarnLengths(") +
      '\nexport function solveFeedYarnLengths(options) { if (globalThis.solverFaultForTest) throw globalThis.solverFaultForTest; return realSolveFeedYarnLengths({ ...options, ...globalThis.solverOptionsForTest }); }';
  } }] });
globalThis.document = {
  createTreeWalker() { return {}; },
  getElementById(id) {
    if (id === "machine-execution-error") return { hidden: true, textContent: "" };
    if (id.includes("container")) return { getBoundingClientRect: () => ({ width: 320, height: 240 }) };
    return canvases.get(id);
  },
};

try {
  const [state, actions, runner, { Bimp }, { getProjectData }] = await Promise.all([
    server.ssrLoadModule("/src/state.js"), server.ssrLoadModule("/src/actions/singleJerseyCamProgram.js"),
    server.ssrLoadModule("/src/components/runSimulation.js"), server.ssrLoadModule("/src/lib/Bimp.js"),
    server.ssrLoadModule("/src/actions/exporters.js"),
  ]);
  const chart = Bimp.empty(48, 60, 0);
  const pixelsBefore = Array.from(chart.pixels);
  state.dispatch({ chart, machineGauge: 32, needleArrangement: [1, 2, 3, 4],
    yarnSequence: Bimp.empty(1, 60, 0), texturePerformanceMode: "solid" });
  actions.createSingleJerseyCamProgram(4, 4);
  state.StateMonitor.register([runner.runSimulation()]);
  // dispatch replaces the top-level state; always inspect its current snapshot.
  const current = new Proxy({}, { get(_target, key) { return state.GLOBAL_STATE[key]; } });
  const setLengths = lengths => {
    lengths.forEach((target, index) => actions.setSingleJerseyFeedYarnLength(index, 0, target));
    flushTimers();
  };
  const readings = [];
  function record(testCase) {
    readings.push({ testCase, previewValidity: current.previewValidity,
      results: current.yarnLengthSolverResults.map(({ feedIndex, yarnIndex, targetLengthCmPer100Needles,
        solvedLengthCmPer100Needles, errorCmPer100Needles, status, appliedToSimulation, failureReason, reachableRange }) =>
        ({ feedIndex, yarnIndex, targetLengthCmPer100Needles, solvedLengthCmPer100Needles,
          errorCmPer100Needles, status, appliedToSimulation, failureReason,
          modelRangeCmPer100Needles: [reachableRange?.minLengthCmPer100Needles, reachableRange?.maxLengthCmPer100Needles] })) });
  }
  function assertApplied(result, target) {
    assert.equal(result.targetLengthCmPer100Needles, target);
    assert.equal(result.status, "CONVERGED");
    assert.equal(result.appliedToSimulation, true);
    assert.ok(Math.abs(result.solvedLengthCmPer100Needles - target) <= result.toleranceCmPer100Needles);
  }
  setLengths([23, 23, 23, 23]);
  assert.equal(current.previewValidity, "VALIDATED", "A: four 23 targets");
  current.yarnLengthSolverResults.forEach(result => assertApplied(result, 23));
  record("A");
  setLengths([100, 100, 100, 100]);
  assert.equal(current.previewValidity, "INVALID", "B: four unreachable targets");
  assert.equal(current.yarnLengthSolverResults.length, 4);
  current.yarnLengthSolverResults.forEach(result => {
    assert.equal(current.singleJerseyCamProgram.feeds[result.feedIndex].yarns[result.yarnIndex].yarnLengthCmPer100Needles, 100);
    assert.equal(result.status, "UNREACHABLE_TARGET");
    assert.equal(result.appliedToSimulation, false);
    assert.equal(result.converged, false);
  });
  record("B");
  // A failed candidate must never reach the final Canvas as an applied path.
  const [{ Pattern }, { ProcessModel }, { YarnModel }, { buildYarnPathGeometry }, { createSingleJerseyExecutionInput }] = await Promise.all([
    server.ssrLoadModule("/src/simulation/Pattern.js"), server.ssrLoadModule("/src/simulation/ProcessModel.js"),
    server.ssrLoadModule("/src/simulation/YarnModel.js"), server.ssrLoadModule("/src/simulation/yarnPathGeometry.js"),
    server.ssrLoadModule("/src/components/singleJerseyExecutionInput.js"),
  ]);
  const input = createSingleJerseyExecutionInput(current.singleJerseyCamProgram, current.needleArrangement, 48, 60);
  const pattern = new Pattern(input.pad(1, 0, 0));
  const geometry = buildYarnPathGeometry({ pattern: input, stitchPattern: pattern,
    yarnGraph: new YarnModel(new ProcessModel(pattern).cn), canvasWidth: 320, canvasHeight: 240,
    primaryLengthScaleY: 1, primaryYarnDiameter: 0.24, machineGauge: 32 });
  for (const layer of ["back", "mid", "front"]) {
    const drawn = canvases.get(`${layer}-arranged`).paths.filter((path, index, paths) => index === 0 || path !== paths[index - 1]);
    assert.deepEqual(drawn, geometry.yarnPathLinks.filter(link => link.layer === layer)
      .map(link => geometry.resolvedPathByLink.get(link.index)).filter(Boolean));
  }
  setLengths([23, 100, 23, 100]);
  assert.equal(current.previewValidity, "PARTIAL", "C: mixed Feed targets");
  assert.equal(current.yarnLengthSolverResults.filter(result => result.appliedToSimulation).length, 2);
  record("C");
  for (let feed = 0; feed < 4; feed++) actions.clearSingleJerseyFeedYarnLength(feed, 0);
  flushTimers();
  assert.equal(current.previewValidity, "DESIGN_PREVIEW", "D: no targets");
  assert.deepEqual(current.yarnLengthSolverResults, []);
  record("D");
  setLengths([23, 23, 23, 23]);
  const assertInvalidated = () => {
    assert.equal(current.previewValidity, "DESIGN_PREVIEW", "E: invalidate before debounce");
    assert.deepEqual(current.yarnLengthSolverResults, []);
  };
  state.dispatch({ machineGauge: 31 }); assertInvalidated(); flushTimers();
  state.dispatch({ machineGauge: 32, needleArrangement: [4, 3, 2, 1] }); assertInvalidated(); flushTimers();
  actions.setSingleJerseyCamOperation(0, 0, "M"); assertInvalidated();
  actions.setSingleJerseyCamOperation(0, 0, "K"); flushTimers();
  actions.setSingleJerseyFeedYarnLength(0, 0, 100); assertInvalidated(); flushTimers();
  assert.equal(current.previewValidity, "PARTIAL");
  record("E");
  setLengths([100, 100, 100, 100]);
  setLengths([23, 23, 23, 23]);
  assert.equal(current.previewValidity, "VALIDATED", "F: recover 100 -> 23");
  current.yarnLengthSolverResults.forEach(result => assertApplied(result, 23));
  record("F");
  // Use existing Feed assignment facts, with two distinct targets on Feed 1.
  const cam = structuredClone(current.singleJerseyCamProgram);
  cam.feeds[0].yarns.push({ ...cam.feeds[0].yarns[0], yarnLengthCmPer100Needles: 100 });
  state.dispatch({ singleJerseyCamProgram: cam }); assertInvalidated(); flushTimers();
  assert.equal(current.previewValidity, "PARTIAL", "G: same Feed, one Yarn succeeds, one fails");
  const feedOneResults = current.yarnLengthSolverResults.filter(result => result.feedIndex === 0);
  assert.equal(feedOneResults.length, 2);
  assertApplied(feedOneResults.find(result => result.yarnIndex === 0), 23);
  assert.equal(feedOneResults.find(result => result.yarnIndex === 1).status, "UNREACHABLE_TARGET");
  assert.equal(feedOneResults.find(result => result.yarnIndex === 1).appliedToSimulation, false);
  record("G");
  const project = getProjectData();
  assert.equal(project.singleJerseyCamProgram.feeds[0].yarns[1].yarnLengthCmPer100Needles, 100);
  assert.equal(Object.hasOwn(project, "previewValidity"), false);
  assert.equal(Object.hasOwn(project, "yarnLengthSolverResults"), false);
  assert.deepEqual(Array.from(chart.pixels), pixelsBefore);

  // New failure diagnostics must be solver data in physical units, not a UI range calculation.
  feedOneResults.filter(result => !result.appliedToSimulation).forEach(result => {
    assert.equal(result.failureReason, "UNREACHABLE_TARGET");
    assert.ok(result.reachableRange.maxLengthCmPer100Needles < 100);
    assert.ok(result.reachableRange.minLengthCmPer100Needles > 0);
  });
  const { getYarnLengthFeedbackRows, yarnLengthSolverFeedback } = await server.ssrLoadModule("/src/views/yarnLengthSolverFeedback.js");
  const rows = getYarnLengthFeedbackRows(current);
  assert.equal(rows.length, 5);
  assert.equal(rows.find(row => row.feedIndex === 0 && row.yarnIndex === 1).result.appliedToSimulation, false);
  // Inspect actual Lit template text for failure types unreachable from ordinary UI parameters.
  const templateText = value => Array.isArray(value) ? value.map(templateText).join("") :
    value?.strings ? value.strings.map((text, index) => text + templateText(value.values[index] ?? "")).join("") : String(value ?? "");
  globalThis.solverFaultForTest = new Error("solver integration fault");
  actions.setSingleJerseyFeedYarnLength(0, 0, 24); flushTimers();
  assert.equal(current.previewValidity, "INVALID", "Unexpected solver errors are visible, never validated");
  current.yarnLengthSolverResults.forEach(result => {
    assert.equal(result.status, "ERROR");
    assert.equal(result.appliedToSimulation, false);
    assert.equal(result.failureReason, "ERROR");
    assert.equal(result.errorMessage, "solver integration fault");
  });
  assert.ok(templateText(yarnLengthSolverFeedback()).includes("求解失败：solver integration fault"));
  globalThis.solverFaultForTest = null;
  actions.setSingleJerseyFeedYarnLength(0, 0, 23); flushTimers();
  assert.equal(current.previewValidity, "PARTIAL", "Solver error -> normal computation recovers");
  globalThis.solverOptionsForTest = { maxIterations: 1 };
  setLengths([24, 24, 24, 24]);
  assert.equal(current.previewValidity, "INVALID", "Iteration limit cannot validate targets");
  current.yarnLengthSolverResults.filter(result => result.yarnIndex === 0).forEach(result => {
    assert.equal(result.status, "MAX_ITERATIONS");
    assert.equal(result.appliedToSimulation, false);
    assert.equal(result.failureReason, "MAX_ITERATIONS");
  });
  assert.ok(templateText(yarnLengthSolverFeedback()).includes("达到迭代上限，未在容差内收敛"));
  delete globalThis.solverOptionsForTest;
  globalThis.pathNotAppliedForTest = true;
  setLengths([23, 23, 23, 23]);
  assert.equal(current.previewValidity, "INVALID", "Convergence alone cannot prove path application");
  current.yarnLengthSolverResults.filter(result => result.yarnIndex === 0).forEach(result => {
    assert.equal(result.status, "CONVERGED");
    assert.equal(result.appliedToSimulation, false);
    assert.equal(result.failureReason, "PATH_NOT_APPLIED");
  });
  assert.ok(templateText(yarnLengthSolverFeedback()).includes("求解路径未能应用到当前预览"));
  delete globalThis.pathNotAppliedForTest;
  // Application must be re-evaluated even when the solver result cache is reused.
  state.dispatch({ simScale: 1.1 });
  assert.equal(current.previewValidity, "PARTIAL");
  current.yarnLengthSolverResults.filter(result => result.yarnIndex === 0).forEach(result => assertApplied(result, 23));
  runner.stopSimulation();
  readings.forEach(reading => console.log(JSON.stringify(reading)));
  console.log("PASS: A–G, base path fallback, solver diagnostics, failure and recovery through real runSimulation.");
} finally {
  delete globalThis.solverFaultForTest;
  delete globalThis.solverOptionsForTest;
  delete globalThis.pathNotAppliedForTest;
  await server.close();
}
