import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer } from "vite";

// Read-only production audit: only this report's JSON output is written.
// Drawing surfaces/timers/renderView are fixtures. The renderer, actions,
// state, runner, Machine Domain, geometry and solver execute their real code.
// Solver instrumentation is an in-memory Vite transform, never a source edit.
globalThis.devicePixelRatio = 1;
globalThis.Path2D = class { constructor(data = "") { this.data = data; } };
const timers = new Map(); let timerId = 0;
globalThis.window = {
  clearTimeout(id) { timers.delete(id); },
  setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
};
function flushTimers() {
  const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback());
}
const canvases = new Map(["back", "mid", "front", "back-arranged", "mid-arranged", "front-arranged"].map(id => {
  const context = { clearRect() {}, save() {}, restore() {}, stroke() {}, createPattern() { return null; } };
  return [id, { width: 0, height: 0, style: {}, getContext: () => context }];
}));
const documentFixture = {
  createTreeWalker() { return {}; },
  getElementById(id) {
    if (id === "machine-execution-error") return { hidden: true, textContent: "" };
    if (id.includes("container")) return { getBoundingClientRect: () => ({ width: 320, height: 240 }) };
    return canvases.get(id);
  },
};
globalThis.__p0AuditSolverCalls = [];
const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true },
  plugins: [{ name: "p0-audit-memory-only-solver-input", enforce: "pre", transform(code, id) {
    if (!id.replaceAll("\\", "/").split("?")[0].endsWith("/src/simulation/yarnLengthSolver.js")) return;
    assert.ok(code.includes("export function solveFeedYarnLengths("));
    return code.replace("export function solveFeedYarnLengths(", "function auditOriginalSolveFeedYarnLengths(") + `
export function solveFeedYarnLengths(input) {
  globalThis.__p0AuditSolverCalls.push({ gauge: input.gauge, feeds: structuredClone(input.feeds) });
  return auditOriginalSolveFeedYarnLengths(input);
}
`;
  } }],
});
globalThis.document = documentFixture;
const report = { passed: false, fixtureScope: "Real appRenderer and runner registration order; renderView records current state. Canvas/timers are fixtures. No browser UI claim.", renderer: [], cache: [], singleMultiYarn: null };
try {
  const [state, actions, runner, { Bimp }, { createAppRenderer }] = await Promise.all([
    server.ssrLoadModule("/src/state.js"), server.ssrLoadModule("/src/actions/singleJerseyCamProgram.js"),
    server.ssrLoadModule("/src/components/runSimulation.js"), server.ssrLoadModule("/src/lib/Bimp.js"),
    server.ssrLoadModule("/src/components/renderApp.js"),
  ]);
  const current = () => state.GLOBAL_STATE;
  const results = () => current().yarnLengthSolverResults.map(({ feedIndex, yarnIndex, targetLengthCmPer100Needles,
    solvedLengthCmPer100Needles, errorCmPer100Needles, toleranceCmPer100Needles, status, converged, appliedToSimulation }) =>
    ({ feedIndex, yarnIndex, targetLengthCmPer100Needles, solvedLengthCmPer100Needles,
      errorCmPer100Needles, toleranceCmPer100Needles, status, converged, appliedToSimulation }));
  const lengths = () => current().singleJerseyCamProgram.feeds.map(feed => feed.yarns.map(yarn => yarn.yarnLengthCmPer100Needles));
  const frames = []; const pendingFrames = [];
  const appRenderer = createAppRenderer({ requestFrame: callback => pendingFrames.push(callback), renderView() {
    frames.push({ previewValidity: current().previewValidity, lengths: lengths(), results: results() });
  } });
  const drainFrames = () => { const pending = pendingFrames.splice(0); pending.forEach(callback => callback()); };
  const earlyObserver = []; let activeCase = "setup";
  state.dispatch({ chart: Bimp.empty(48, 60, 0), machineGauge: 32, needleArrangement: [1, 2, 3, 4],
    yarnSequence: Bimp.empty(1, 60, 0), texturePerformanceMode: "solid" });
  function prepare(pair = false) {
    actions.createSingleJerseyCamProgram(4, 4);
    ["A", "C", "D", "E"].forEach((yarnId, feedIndex) => actions.setSingleJerseyFeedYarns(feedIndex,
      [{ yarnId, yarnLengthCmPer100Needles: 23, tensionCN: 12 + feedIndex, placement: "parallel" }]));
    if (pair) actions.setSingleJerseyFeedYarns(0, [current().singleJerseyCamProgram.feeds[0].yarns[0],
      { yarnId: "B", yarnLengthCmPer100Needles: 18, tensionCN: 19, placement: "parallel" }]);
    flushTimers(); drainFrames();
  }
  prepare();
  // index.js registers appRenderer before runSimulation. Intermediate production
  // canvas consumers do not read SolverResult/PreviewValidity and are omitted.
  state.StateMonitor.register([() => appRenderer, () => ({ syncState(snapshot, changes) {
    if (["singleJerseyCamProgram", "machineGauge", "needleArrangement"].some(key => changes.includes(key))) {
      earlyObserver.push({ testCase: activeCase, previewValidity: snapshot.previewValidity,
        resultCount: snapshot.yarnLengthSolverResults.length });
    }
  } }), runner.runSimulation()]);
  drainFrames();
  assert.equal(current().previewValidity, "VALIDATED");
  function timing(testCase, edit) {
    activeCase = testCase;
    assert.equal(current().previewValidity, "VALIDATED");
    edit();
    assert.equal(current().previewValidity, "DESIGN_PREVIEW");
    assert.deepEqual(current().yarnLengthSolverResults, []);
    drainFrames();
    const beforeDebounce = frames.at(-1);
    assert.equal(beforeDebounce.previewValidity, "DESIGN_PREVIEW");
    assert.deepEqual(beforeDebounce.results, []);
    flushTimers(); drainFrames();
    const afterDebounce = frames.at(-1);
    assert.equal(afterDebounce.previewValidity, "VALIDATED");
    afterDebounce.results.forEach(result => assert.equal(result.targetLengthCmPer100Needles,
      afterDebounce.lengths[result.feedIndex][result.yarnIndex]));
    report.renderer.push({ testCase, beforeDebounce, afterDebounce });
  }
  timing("single 23 to 27", () => actions.setSingleJerseyFeedYarnLength(0, 0, 27));
  timing("Gauge 32 to 31", () => state.dispatch({ machineGauge: 31 }));
  timing("Cam K to T", () => actions.setSingleJerseyCamOperation(0, 0, "T"));
  timing("Arrangement 1234 to 4321", () => state.dispatch({ needleArrangement: [4, 3, 2, 1] }));
  timing("Feed Yarn identity", () => actions.setSingleJerseyFeedYarns(0,
    [{ ...current().singleJerseyCamProgram.feeds[0].yarns[0], yarnId: "Replacement" }]));
  timing("batch exact targets", () => {
    const targets = [0, 2].map(feedIndex => ({ feedIndex, yarnIndex: 0,
      yarnId: current().singleJerseyCamProgram.feeds[feedIndex].yarns[0].yarnId }));
    assert.equal(actions.setSingleJerseyFeedYarnLengths(targets, 23).ok, true);
  });
  report.earlySynchronousObserver = earlyObserver.filter(item => item.testCase !== "setup");
  report.earlyObserverNote = "A synchronous consumer before runner can see the original dispatch snapshot with old VALIDATED for non-batch edits. Real renderer queues RAF and reads latest GLOBAL_STATE, so recorded user-visible frames cannot show this combination. Batch clears results in the same fact dispatch.";

  activeCase = "setup";
  state.dispatch({ machineGauge: 32, needleArrangement: [1, 2, 3, 4] }); prepare();
  function cacheCase(testCase, expectedCalls, edit) {
    const start = globalThis.__p0AuditSolverCalls.length;
    edit(); flushTimers(); drainFrames();
    const solverCalls = globalThis.__p0AuditSolverCalls.length - start;
    if (expectedCalls === 0) assert.equal(solverCalls, 0);
    else assert.equal(solverCalls, 4);
    assert.equal(current().previewValidity, "VALIDATED");
    report.cache.push({ testCase, solverCalls, previewValidity: current().previewValidity });
  }
  cacheCase("zoom", 0, () => state.dispatch({ simScale: current().simScale + 0.1 }));
  cacheCase("color", 0, () => state.dispatch({ yarnPalette: ["#123456"] }));
  cacheCase("Gauge", 4, () => state.dispatch({ machineGauge: 31 }));
  cacheCase("primary diameter", 4, () => state.dispatch({ yarnPlies: current().yarnPlies.map((ply, index) =>
    index === 0 ? { ...ply, diameter: ply.diameter * 1.05 } : ply) }));
  cacheCase("primary lengthScaleY", 4, () => state.dispatch({ yarnPlies: current().yarnPlies.map((ply, index) =>
    index === 0 ? { ...ply, lengthScaleY: 1.05 } : ply) }));
  cacheCase("target", 4, () => actions.setSingleJerseyFeedYarnLength(0, 0, 27));
  cacheCase("Cam operation bitmap", 4, () => actions.setSingleJerseyCamOperation(0, 0, "T"));

  state.dispatch({ machineGauge: 32, needleArrangement: [1, 2, 3, 4] }); prepare(true);
  const bBefore = structuredClone(current().singleJerseyCamProgram.feeds[0].yarns[1]);
  const start = globalThis.__p0AuditSolverCalls.length;
  actions.setSingleJerseyFeedYarnLength(0, 0, 25); flushTimers(); drainFrames();
  const actualSolverInputs = globalThis.__p0AuditSolverCalls.slice(start);
  const pairInput = actualSolverInputs.find(call => call.feeds[0].yarns.some(yarn => yarn.yarnId === "B"));
  assert.ok(pairInput, "Capture real Solver invocation, not only state/UI");
  assert.deepEqual(pairInput.feeds[0].yarns.map(yarn => [yarn.yarnId, yarn.yarnLengthCmPer100Needles]), [["A", 25], ["B", 18]]);
  assert.deepEqual(current().singleJerseyCamProgram.feeds[0].yarns[1], bBefore);
  const bResult = results().find(result => result.feedIndex === 0 && result.yarnIndex === 1);
  assert.equal(bResult.targetLengthCmPer100Needles, 18);
  assert.equal(bResult.status, "CONVERGED"); assert.equal(bResult.appliedToSimulation, true);
  assert.ok(Math.abs(bResult.solvedLengthCmPer100Needles - 18) <= bResult.toleranceCmPer100Needles);
  assert.equal(current().previewValidity, "VALIDATED");
  report.singleMultiYarn = { edit: "A23 to 25; B18 unchanged", projectFeed0: current().singleJerseyCamProgram.feeds[0],
    actualSolverInputs, resultsFeed0: results().filter(result => result.feedIndex === 0), previewValidity: current().previewValidity };
  report.sourceHashes = Object.fromEntries(await Promise.all([
    "src/components/renderApp.js", "src/index.js", "src/state.js", "src/components/runSimulation.js",
    "src/simulation/yarnSimulation.js", "src/simulation/yarnLengthSolver.js", "src/actions/singleJerseyCamProgram.js",
  ].map(async path => [path, createHash("sha256").update(await readFile(new URL(`../${path}`, import.meta.url))).digest("hex")])));
  report.passed = true;
  await writeFile(new URL("p0-overall-renderer-probe.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ passed: true, rendererCases: report.renderer.length, cacheCases: report.cache,
    pairSolverInput: pairInput, bResult, report: "reports/p0-overall-renderer-probe.json" }, null, 2));
} finally {
  const runner = await server.ssrLoadModule("/src/components/runSimulation.js");
  runner.stopSimulation();
  await server.close();
}
