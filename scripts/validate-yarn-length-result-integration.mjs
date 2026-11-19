import assert from "node:assert/strict";
import { createServer } from "vite";

// Only browser drawing surfaces/timers are fixtures. State, actions, runner,
// Machine Domain, geometry, solver and renderer all execute their real code.
globalThis.devicePixelRatio = 1;
globalThis.Path2D = class {
  constructor(data = "") { this.data = data; }
};
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
  const context = {
    clearRect() { paths.length = 0; },
    save() {}, restore() {},
    stroke(path) { paths.push(path.data); },
    createPattern() { return null; },
  };
  return [id, { width: 0, height: 0, style: {}, paths, getContext: () => context }];
}));
const errorElement = { hidden: true, textContent: "" };
const documentFixture = {
  createTreeWalker() { return {}; },
  getElementById(id) {
    if (id === "machine-execution-error") return errorElement;
    if (id.includes("container")) return { getBoundingClientRect: () => ({ width: 320, height: 240 }) };
    return canvases.get(id);
  },
};
const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
globalThis.document = documentFixture;

try {
  const { getYarnLengthFeedbackRows } = await server.ssrLoadModule("/src/views/yarnLengthSolverFeedback.js");
  const relaxedAssignment = { yarnId: 0, lengthInputMode: "relaxedWithDraft",
    relaxedLengthCmPer100Needles: 8, draftRatio: 3 };
  const feedbackState = assignment => ({
    singleJerseyCamProgram: { feeds: [{ yarns: [assignment] }] }, yarnLengthSolverResults: [],
  });
  const relaxedRow = getYarnLengthFeedbackRows(feedbackState(relaxedAssignment))[0];
  assert.equal(relaxedRow.target, 24, "Feedback must use the Domain-derived weaving reference.");
  assert.equal(relaxedRow.lengthInput.lengthInputMode, "relaxedWithDraft");
  assert.equal(relaxedRow.lengthInput.relaxedLengthCmPer100Needles, 8);
  assert.equal(relaxedRow.lengthInput.draftRatio, 3);
  const currentResult = { feedIndex: 0, yarnIndex: 0, targetLengthCmPer100Needles: 24,
    status: "CONVERGED", lengthInput: relaxedRow.lengthInput };
  const currentFeedback = feedbackState(relaxedAssignment);
  currentFeedback.yarnLengthSolverResults = [currentResult];
  assert.equal(getYarnLengthFeedbackRows(currentFeedback)[0].result, currentResult);
  currentFeedback.singleJerseyCamProgram.feeds[0].yarns[0] = {
    ...relaxedAssignment, relaxedLengthCmPer100Needles: 10, draftRatio: 2.4 };
  const equalTargetRow = getYarnLengthFeedbackRows(currentFeedback)[0];
  assert.equal(equalTargetRow.target, 24);
  assert.equal(equalTargetRow.result, null, "Equal effective targets cannot preserve stale process-source feedback.");
  assert.equal(equalTargetRow.lengthInput.relaxedLengthCmPer100Needles, 10);
  assert.equal(equalTargetRow.lengthInput.draftRatio, 2.4);
  const incompleteRow = getYarnLengthFeedbackRows(feedbackState({
    ...relaxedAssignment, draftRatio: null, yarnLengthCmPer100Needles: 24 }))[0];
  assert.equal(incompleteRow.target, null, "Incomplete relaxed input must never fall back to a direct target.");
  assert.equal(incompleteRow.lengthInput.status, "INCOMPLETE");
  const legacyResult = { feedIndex: 0, yarnIndex: 0, targetLengthCmPer100Needles: 24, status: "CONVERGED" };
  const legacyFeedback = feedbackState({ yarnId: 0, yarnLengthCmPer100Needles: 24 });
  legacyFeedback.yarnLengthSolverResults = [legacyResult];
  assert.equal(getYarnLengthFeedbackRows(legacyFeedback)[0].result, legacyResult,
    "Existing direct results without source metadata remain compatible.");
  currentFeedback.yarnLengthSolverResults = [legacyResult];
  assert.equal(getYarnLengthFeedbackRows(currentFeedback)[0].result, null,
    "Relaxed input results always require matching source metadata.");

  const [state, actions, runner, { Bimp }, { getProjectData }] = await Promise.all([
    server.ssrLoadModule("/src/state.js"),
    server.ssrLoadModule("/src/actions/singleJerseyCamProgram.js"),
    server.ssrLoadModule("/src/components/runSimulation.js"),
    server.ssrLoadModule("/src/lib/Bimp.js"),
    server.ssrLoadModule("/src/actions/exporters.js"),
  ]);
  // Match the existing user-audit reproduction's standard 48 × 60 preview.
  const chart = Bimp.empty(48, 60, 0);
  const patternBefore = Array.from(chart.pixels);
  state.dispatch({ chart, machineGauge: 32, needleArrangement: [1, 2, 3, 4],
    yarnSequence: Bimp.empty(1, chart.height, 0), texturePerformanceMode: "solid" });
  actions.createSingleJerseyCamProgram(4, 4);
  state.StateMonitor.register([runner.runSimulation()]);
  assert.equal(state.GLOBAL_STATE.previewValidity, "DESIGN_PREVIEW");
  assert.deepEqual(state.GLOBAL_STATE.yarnLengthSolverResults, []);

  const setAllLengths = length => {
    for (let feedIndex = 0; feedIndex < 4; feedIndex++) actions.setSingleJerseyFeedYarnLength(feedIndex, 0, length);
    flushTimers();
  };
  const readings = [];
  for (const target of [23, 27]) {
    setAllLengths(target);
    const current = state.GLOBAL_STATE;
    assert.ok(Array.isArray(current.yarnLengthSolverResults),
      "runSimulation must publish the final Feed Yarn SolverResults into current result state.");
    assert.equal(current.yarnLengthSolverResults.length, 4);
    assert.equal(current.previewValidity, "VALIDATED");
    current.yarnLengthSolverResults.forEach((result, feedIndex) => {
      assert.equal(current.singleJerseyCamProgram.feeds[feedIndex].yarns[0].yarnLengthCmPer100Needles, target);
      assert.equal(result.feedIndex, feedIndex);
      assert.equal(result.yarnIndex, 0);
      assert.equal(result.targetLengthCmPer100Needles, target);
      assert.equal(result.status, "CONVERGED");
      assert.equal(result.appliedToSimulation, true);
      assert.ok(Number.isFinite(result.solvedLengthCmPer100Needles));
      assert.ok(result.errorCmPer100Needles <= result.toleranceCmPer100Needles);
      assert.ok(Math.abs(result.solvedLengthCmPer100Needles - target) <= result.toleranceCmPer100Needles);
      assert.ok(result.solvedPathByLink.size > 0);
    });
    assert.deepEqual(Array.from(chart.pixels), patternBefore, "Pattern must remain unchanged.");
    assert.deepEqual(current.needleArrangement, [1, 2, 3, 4]);
    const project = getProjectData();
    assert.equal(Object.hasOwn(project, "yarnLengthSolverResults"), false);
    assert.equal(Object.hasOwn(project, "previewValidity"), false);
    assert.equal(project.singleJerseyCamProgram.feeds[0].yarns[0].yarnLengthCmPer100Needles, target);

    // Verify the final Canvas receives the solved model paths, not only metadata.
    const [{ Pattern }, { ProcessModel }, { YarnModel }, { buildYarnPathGeometry }, { createSingleJerseyExecutionInput }] = await Promise.all([
      server.ssrLoadModule("/src/simulation/Pattern.js"),
      server.ssrLoadModule("/src/simulation/ProcessModel.js"),
      server.ssrLoadModule("/src/simulation/YarnModel.js"),
      server.ssrLoadModule("/src/simulation/yarnPathGeometry.js"),
      server.ssrLoadModule("/src/components/singleJerseyExecutionInput.js"),
    ]);
    const machineInput = createSingleJerseyExecutionInput(current.singleJerseyCamProgram, current.needleArrangement, chart.width, chart.height);
    const stitchPattern = new Pattern(machineInput.pad(1, 0, 0));
    const geometry = buildYarnPathGeometry({ pattern: machineInput, stitchPattern,
      yarnGraph: new YarnModel(new ProcessModel(stitchPattern).cn), canvasWidth: 320, canvasHeight: 240,
      primaryLengthScaleY: 1, primaryYarnDiameter: 0.24, machineGauge: 32 });
    const solvedPaths = new Map(current.yarnLengthSolverResults.flatMap(result => [...result.solvedPathByLink]));
    const expectedPaths = geometry.resolveModelPathsForDisplay(solvedPaths);
    assert.notEqual(expectedPaths, geometry.resolvedPathByLink, "Solved geometry must be applicable to the preview.");
    for (const layer of ["back", "mid", "front"]) {
      // Shading strokes the same path more than once; compare the path sequence.
      const drawnPaths = canvases.get(`${layer}-arranged`).paths.filter((path, index, paths) =>
        index === 0 || path !== paths[index - 1]);
      assert.deepEqual(drawnPaths,
        geometry.yarnPathLinks.filter(link => link.layer === layer).map(link => expectedPaths.get(link.index)).filter(Boolean));
    }
    readings.push({ target, previewValidity: current.previewValidity,
      results: current.yarnLengthSolverResults.map(({ feedIndex, yarnIndex, targetLengthCmPer100Needles,
        solvedLengthCmPer100Needles, errorCmPer100Needles, toleranceCmPer100Needles, status, appliedToSimulation }) =>
        ({ feedIndex, yarnIndex, targetLengthCmPer100Needles, solvedLengthCmPer100Needles,
          errorCmPer100Needles, toleranceCmPer100Needles, status, appliedToSimulation })) });
  }

  // A new user fact must invalidate the previous preview before the debounce runs.
  actions.setSingleJerseyFeedYarnLength(0, 0, 23);
  assert.equal(state.GLOBAL_STATE.previewValidity, "DESIGN_PREVIEW");
  assert.deepEqual(state.GLOBAL_STATE.yarnLengthSolverResults, []);
  flushTimers();
  assert.equal(state.GLOBAL_STATE.previewValidity, "VALIDATED");
  assert.equal(state.GLOBAL_STATE.yarnLengthSolverResults[0].targetLengthCmPer100Needles, 23);
  assert.equal(state.GLOBAL_STATE.yarnLengthSolverResults[1].targetLengthCmPer100Needles, 27);

  const oldHeight = state.GLOBAL_STATE.yarnLengthSolverResults[0].solvedLoopHeight;
  state.dispatch({ machineGauge: 31 });
  assert.deepEqual(state.GLOBAL_STATE.yarnLengthSolverResults, []);
  flushTimers();
  assert.equal(state.GLOBAL_STATE.previewValidity, "VALIDATED");
  assert.notEqual(state.GLOBAL_STATE.yarnLengthSolverResults[0].solvedLoopHeight, oldHeight);
  state.dispatch({ needleArrangement: [4, 3, 2, 1], machineGauge: 32 });
  assert.equal(state.GLOBAL_STATE.previewValidity, "DESIGN_PREVIEW");
  flushTimers();
  assert.equal(state.GLOBAL_STATE.previewValidity, "VALIDATED");
  actions.setSingleJerseyCamOperation(0, 0, "M");
  assert.deepEqual(state.GLOBAL_STATE.yarnLengthSolverResults, []);
  actions.setSingleJerseyCamOperation(0, 0, "K");
  flushTimers();
  assert.equal(state.GLOBAL_STATE.previewValidity, "VALIDATED");

  state.dispatch({ needleArrangement: [5] });
  flushTimers();
  assert.equal(state.GLOBAL_STATE.previewValidity, "INVALID");
  assert.deepEqual(state.GLOBAL_STATE.yarnLengthSolverResults, []);
  assert.equal(errorElement.hidden, false);
  state.dispatch({ needleArrangement: [] });
  flushTimers();
  assert.equal(state.GLOBAL_STATE.previewValidity, "DESIGN_PREVIEW");
  assert.deepEqual(state.GLOBAL_STATE.yarnLengthSolverResults, []);
  state.dispatch({ needleArrangement: [1, 2, 3, 4] });
  flushTimers();
  for (let feedIndex = 0; feedIndex < 4; feedIndex++) actions.clearSingleJerseyFeedYarnLength(feedIndex, 0);
  flushTimers();
  assert.equal(state.GLOBAL_STATE.previewValidity, "DESIGN_PREVIEW");
  assert.deepEqual(state.GLOBAL_STATE.yarnLengthSolverResults, []);
  actions.deleteSingleJerseyCamProgram();
  flushTimers();
  assert.equal(state.GLOBAL_STATE.previewValidity, "DESIGN_PREVIEW");
  assert.deepEqual(state.GLOBAL_STATE.yarnLengthSolverResults, []);
  assert.deepEqual(Array.from(chart.pixels), patternBefore);
  runner.stopSimulation();

  // Minimal future failure contract, without extending unreachable/input UI work.
  const { derivePreviewValidity } = await server.ssrLoadModule("/src/simulation/previewValidity.js");
  const required = [0, 1].map(feedIndex => ({ feedIndex, yarnIndex: 0, targetLengthCmPer100Needles: 23 }));
  const successful = required.map(target => ({ ...target, status: "CONVERGED", converged: true,
    appliedToSimulation: true, solvedLengthCmPer100Needles: 23,
    errorCmPer100Needles: 0, toleranceCmPer100Needles: 0.00079375 }));
  assert.equal(derivePreviewValidity([], []), "DESIGN_PREVIEW");
  assert.equal(derivePreviewValidity(required, successful), "VALIDATED");
  assert.equal(derivePreviewValidity(required, [successful[0]]), "PARTIAL");
  assert.equal(derivePreviewValidity(required, [successful[0], successful[0]]), "PARTIAL",
    "Duplicate results cannot replace a missing Feed Yarn.");
  assert.equal(derivePreviewValidity(required, []), "INVALID");
  for (const status of ["NOT_SET", "UNREACHABLE_TARGET", "MAX_ITERATIONS", "ERROR"]) {
    assert.equal(derivePreviewValidity(required, successful.map(result => ({ ...result, status }))), "INVALID");
    assert.equal(derivePreviewValidity(required, [successful[0], { ...successful[1], status }]), "PARTIAL");
  }
  assert.equal(derivePreviewValidity(required, successful.map(result => ({ ...result, appliedToSimulation: false }))), "INVALID");
  assert.equal(derivePreviewValidity(required, successful.map(result => ({ ...result, targetLengthCmPer100Needles: 27 }))), "INVALID");
  assert.equal(derivePreviewValidity(required, successful.map(result => ({ ...result, solvedLengthCmPer100Needles: 27 }))), "INVALID");
  console.log(JSON.stringify(readings, null, 2));
  console.log("PASS: Project Feed targets flow through real runSimulation, Solver, rendered paths and current PreviewValidity.");
} finally {
  await server.close();
}
