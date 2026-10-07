import assert from "node:assert/strict";
import { createServer } from "vite";

// Browser surfaces/timers are fixtures; project actions, state, runner, solver,
// geometry and rendering path dispatch execute real production modules.
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
const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
globalThis.document = {
  createTreeWalker() { return {}; },
  getElementById(id) {
    if (id === "machine-execution-error") return { hidden: true, textContent: "" };
    if (id === "desktop" || id.includes("container")) return { getBoundingClientRect: () => ({ width: 320, height: 240 }) };
    return canvases.get(id);
  },
};
try {
  const [state, actions, runner, { Bimp }, { getProjectData }, { loadJSON }] = await Promise.all([
    server.ssrLoadModule("/src/state.js"), server.ssrLoadModule("/src/actions/singleJerseyCamProgram.js"),
    server.ssrLoadModule("/src/components/runSimulation.js"), server.ssrLoadModule("/src/lib/Bimp.js"),
    server.ssrLoadModule("/src/actions/exporters.js"),
    server.ssrLoadModule("/src/actions/importers.js"),
  ]);
  const chart = Bimp.empty(48, 60, 0);
  state.dispatch({ chart, machineGauge: 32, needleArrangement: [1, 2, 3, 4],
    yarnSequence: Bimp.empty(1, 60, 0), texturePerformanceMode: "solid" });
  actions.createSingleJerseyCamProgram(4, 4);
  state.StateMonitor.register([runner.runSimulation()]);
  const current = new Proxy({}, { get(_target, key) { return state.GLOBAL_STATE[key]; } });
  const target = (feed = 0, yarn = 0) => current.singleJerseyCamProgram.feeds[feed].yarns[yarn].yarnLengthCmPer100Needles;
  const results = [];
  function setAll(value) {
    for (let feed = 0; feed < 4; feed++) actions.setSingleJerseyFeedYarnLength(feed, 0, value);
    flushTimers();
  }
  function assertConverged(value) {
    assert.equal(current.previewValidity, "VALIDATED");
    current.yarnLengthSolverResults.forEach(result => {
      assert.equal(result.status, "CONVERGED");
      assert.equal(result.appliedToSimulation, true);
      assert.equal(result.targetLengthCmPer100Needles, value);
      assert.ok(Math.abs(result.solvedLengthCmPer100Needles - value) <= result.toleranceCmPer100Needles);
    });
  }
  setAll(23); assertConverged(23);
  for (const [testCase, value] of [["A", -1], ["B", "invalid"], ["C-NaN", NaN],
    ["C-Infinity", Infinity], ["C--Infinity", -Infinity], ["negative-string", "-1"],
    ["string-NaN", "NaN"], ["string-Infinity", "Infinity"], ["object", {}], ["boolean", true],
    ["typed-zero", 0], ["string-zero", "0"], ["empty-draft", ""], ["whitespace-draft", " "],
    ["null-draft", null], ["undefined-draft", undefined]]) {
    const before = state.GLOBAL_STATE;
    const beforePaths = [...canvases.values()].map(canvas => [...canvas.paths]);
    const timerCount = timers.size;
    const returned = actions.setSingleJerseyFeedYarnLength(0, 0, value);
    assert.equal(target(), 23, `${testCase}: reject must preserve the user's 23`);
    assert.deepEqual(returned, { ok: false, reason: "INVALID_YARN_LENGTH", previousValue: 23 });
    assert.equal(state.GLOBAL_STATE, before, `${testCase}: no dispatch, not even a replacement state object`);
    assert.equal(current.yarnLengthSolverResults, before.yarnLengthSolverResults);
    assert.equal(timers.size, timerCount, `${testCase}: no new solver timer`);
    assert.deepEqual([...canvases.values()].map(canvas => [...canvas.paths]), beforePaths);
    assertConverged(23);
    results.push({ testCase, returned, target: target(), previewValidity: current.previewValidity });
  }
  // The existing multi-Feed setter also shares the safety guard, without changing its workflow.
  const beforeBatch = state.GLOBAL_STATE;
  const batchSelection = { structureRevision: current.feedYarnStructureRevision, targets: [0, 1].map(feedIndex => ({ feedIndex, yarnIndex: 0,
    yarnId: current.singleJerseyCamProgram.feeds[feedIndex].yarns[0].yarnId })) };
  assert.equal(actions.setSingleJerseyFeedYarnLengths(batchSelection, -1).reason, "INVALID_YARN_LENGTH");
  assert.equal(state.GLOBAL_STATE, beforeBatch);
  assertConverged(23);
  for (const draft of [0, "", null, undefined]) {
    assert.equal(actions.setSingleJerseyFeedYarnLengths(batchSelection, draft).reason, "INVALID_YARN_LENGTH");
    assert.equal(state.GLOBAL_STATE, beforeBatch);
  }

  // D: explicit Clear commits the existing persisted zero representation.
  const cleared = actions.clearSingleJerseyFeedYarnLength(0, 0);
  assert.equal(cleared.ok, true);
  assert.equal(cleared.operation, "CLEAR");
  assert.equal(cleared.previousValue, 23);
  assert.equal(target(), 0);
  assert.deepEqual(current.yarnLengthSolverResults, []);
  flushTimers();
  assert.equal(current.yarnLengthSolverResults.length, 3);
  assert.equal(current.yarnLengthSolverResults.some(result => result.feedIndex === 0), false);
  assert.equal(current.previewValidity, "VALIDATED", "Remaining participating targets still converge");
  for (let feed = 1; feed < 4; feed++) actions.clearSingleJerseyFeedYarnLength(feed, 0);
  flushTimers();
  assert.equal(current.previewValidity, "DESIGN_PREVIEW");
  assert.deepEqual(current.yarnLengthSolverResults, []);
  results.push({ testCase: "D", target: target(), previewValidity: current.previewValidity });

  // E: valid changes invalidate only after committing and then solve the new facts.
  setAll(23);
  const changed = actions.setSingleJerseyFeedYarnLength(0, 0, "27");
  assert.equal(changed.ok, true);
  assert.equal(changed.operation, "SET");
  assert.equal(changed.previousValue, 23);
  assert.equal(target(), 27);
  assert.deepEqual(current.yarnLengthSolverResults, []);
  assert.equal(current.previewValidity, "DESIGN_PREVIEW");
  flushTimers();
  assert.equal(current.previewValidity, "VALIDATED");
  const solved27 = current.yarnLengthSolverResults.find(result => result.feedIndex === 0);
  assert.equal(solved27.status, "CONVERGED");
  assert.equal(solved27.targetLengthCmPer100Needles, 27);
  assert.ok(Math.abs(solved27.solvedLengthCmPer100Needles - 27) <= solved27.toleranceCmPer100Needles);
  results.push({ testCase: "E", target: target(), solved: solved27.solvedLengthCmPer100Needles });

  // Domain-valid values are independent of the model's reachable range.
  assert.equal(actions.setSingleJerseyFeedYarnLength(0, 0, 0.5).ok, true);
  assert.equal(target(), 0.5); flushTimers();
  assert.equal(current.yarnLengthSolverResults[0].status, "UNREACHABLE_TARGET");
  assert.equal(actions.setSingleJerseyFeedYarnLength(0, 0, 23.14).ok, true);
  assert.equal(target(), 23.14); flushTimers();
  assert.equal(current.yarnLengthSolverResults[0].status, "CONVERGED");

  // F: reject one Yarn without altering its sibling or any current result.
  setAll(23);
  actions.setSingleJerseyFeedYarns(0, [current.singleJerseyCamProgram.feeds[0].yarns[0],
    { ...current.singleJerseyCamProgram.feeds[0].yarns[0], yarnLengthCmPer100Needles: 18 }]);
  flushTimers();
  const beforePair = state.GLOBAL_STATE;
  assert.equal(actions.setSingleJerseyFeedYarnLength(0, 0, -1).ok, false);
  assert.equal(state.GLOBAL_STATE, beforePair);
  assert.equal(target(), 23); assert.equal(target(0, 1), 18);
  assert.equal(current.yarnLengthSolverResults.length, 5);
  assert.equal(current.previewValidity, "VALIDATED");
  results.push({ testCase: "F", targets: [target(), target(0, 1)], previewValidity: current.previewValidity });
  // Feed assignment replacement validates all entries before dispatch too.
  assert.throws(() => actions.setSingleJerseyFeedYarns(0, [
    { ...current.singleJerseyCamProgram.feeds[0].yarns[0], yarnLengthCmPer100Needles: 27 },
    { ...current.singleJerseyCamProgram.feeds[0].yarns[1], yarnLengthCmPer100Needles: -1 },
  ]), TypeError);
  assert.equal(state.GLOBAL_STATE, beforePair);

  // Normalization must validate raw values before coercion in replacement/import.
  for (const invalid of [[], true, {}, { valueOf() { throw new Error("Must not coerce invalid objects"); } }]) {
    assert.throws(() => actions.setSingleJerseyFeedYarns(0, [
      { ...current.singleJerseyCamProgram.feeds[0].yarns[0], yarnLengthCmPer100Needles: invalid },
    ]), TypeError);
    assert.equal(state.GLOBAL_STATE, beforePair, "Invalid replacement must not erase the current target/results");
  }
  for (const invalid of [[], true, {}, -1, "invalid", NaN, Infinity, undefined]) {
    const invalidProject = structuredClone(getProjectData());
    invalidProject.singleJerseyCamProgram.feeds[0].yarns[0].yarnLengthCmPer100Needles = invalid;
    assert.throws(() => loadJSON(invalidProject), TypeError);
    assert.equal(state.GLOBAL_STATE, beforePair, "Invalid project import must not commit any partial state");
  }
  for (const legacyValue of [23, "23.14", 0, "", null]) {
    const oldProject = structuredClone(getProjectData());
    oldProject.singleJerseyCamProgram.feeds[0].yarns[0].yarnLengthCmPer100Needles = legacyValue;
    assert.equal(loadJSON(oldProject), true);
    assert.equal(target(), Number(legacyValue));
    flushTimers();
  }
  results.push({ testCase: "replacement-import", rawTypeRejections: 4, importRejections: 8,
    compatibleImportValues: [23, "23.14", 0, "", null] });

  // Stored legacy values remain compatible; only explicit Clear edits to zero.
  assert.equal(actions.clearSingleJerseyFeedYarnLength(0, 0).operation, "CLEAR");
  assert.equal(target(), 0); flushTimers();
  actions.setSingleJerseyFeedYarns(0, [current.singleJerseyCamProgram.feeds[0].yarns[0]]);
  setAll(23); assertConverged(23);
  setAll(100);
  assert.equal(current.previewValidity, "INVALID");
  assert.ok(current.yarnLengthSolverResults.every(result => result.status === "UNREACHABLE_TARGET" && !result.appliedToSimulation));
  actions.setSingleJerseyFeedYarnLength(0, 0, 23); flushTimers();
  assert.equal(current.previewValidity, "PARTIAL");
  for (let feed = 0; feed < 4; feed++) actions.clearSingleJerseyFeedYarnLength(feed, 0);
  flushTimers();
  assert.equal(current.previewValidity, "DESIGN_PREVIEW");
  assert.equal(Object.hasOwn(getProjectData(), "previewValidity"), false);
  assert.deepEqual(Array.from(chart.pixels), Array(48 * 60).fill(0));
  runner.stopSimulation();
  results.forEach(result => console.log(JSON.stringify(result)));
  console.log("PASS: P0-3 A–F, atomic rejection/clear/commit, raw normalization/legacy imports, unchanged Solver state and P0-1/P0-2 regressions.");
} finally {
  await server.close();
}
