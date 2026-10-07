import assert from "node:assert/strict";
import { createServer } from "vite";

// Only drawing surfaces and timers are fixtures. Actions/state/runner/solver are real.
globalThis.devicePixelRatio = 1;
globalThis.Path2D = class { constructor(data = "") { this.data = data; } };
const timers = new Map(); let nextTimer = 0;
globalThis.window = { clearTimeout(id) { timers.delete(id); },
  setTimeout(callback) { timers.set(++nextTimer, callback); return nextTimer; } };
function flush() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); }
const canvases = new Map(["back", "mid", "front", "back-arranged", "mid-arranged", "front-arranged"].map(id => {
  const paths = [];
  const context = { clearRect() { paths.length = 0; }, save() {}, restore() {},
    stroke(path) { paths.push(path.data); }, createPattern() { return null; } };
  return [id, { width: 0, height: 0, style: {}, paths, getContext: () => context }];
}));
const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
globalThis.document = { createTreeWalker() { return {}; }, getElementById(id) {
  if (id === "machine-execution-error") return { hidden: true, textContent: "" };
  if (id.includes("container")) return { getBoundingClientRect: () => ({ width: 320, height: 240 }) };
  return canvases.get(id);
} };
try {
  const [state, actions, runner, { Bimp }, { getProjectData }] = await Promise.all([
    server.ssrLoadModule("/src/state.js"), server.ssrLoadModule("/src/actions/singleJerseyCamProgram.js"),
    server.ssrLoadModule("/src/components/runSimulation.js"), server.ssrLoadModule("/src/lib/Bimp.js"),
    server.ssrLoadModule("/src/actions/exporters.js"),
  ]);
  const current = () => state.GLOBAL_STATE;
  const chart = Bimp.empty(48, 60, 0);
  state.dispatch({ chart, machineGauge: 32, needleArrangement: [1, 2, 3, 4],
    yarnSequence: Bimp.empty(1, 60, 0), texturePerformanceMode: "solid" });
  const mutations = [];
  // Observe BEFORE runner: even an early consumer must never receive new facts + old validation.
  state.StateMonitor.register([() => ({ syncState(snapshot, changes) {
    if (changes.includes("singleJerseyCamProgram")) mutations.push(snapshot);
  } }), runner.runSimulation()]);
  function prepare(pair = false) {
    actions.createSingleJerseyCamProgram(4, 4);
    ["A", "C", "D", "E"].forEach((yarnId, feed) => actions.setSingleJerseyFeedYarns(feed,
      [{ yarnId, yarnLengthCmPer100Needles: 23, tensionCN: 12 + feed, placement: "parallel" }]));
    if (pair) actions.setSingleJerseyFeedYarns(0, [current().singleJerseyCamProgram.feeds[0].yarns[0],
      { yarnId: "B", yarnLengthCmPer100Needles: 18, tensionCN: 19, placement: "parallel" }]);
    flush(); mutations.length = 0;
    assert.equal(current().previewValidity, "VALIDATED");
  }
  const locator = (feedIndex, yarnIndex = 0) => ({ feedIndex, yarnIndex,
    yarnId: current().singleJerseyCamProgram.feeds[feedIndex].yarns[yarnIndex].yarnId });
  const selection = targets => ({ structureRevision: current().feedYarnStructureRevision, targets });
  const lengths = () => current().singleJerseyCamProgram.feeds.map(feed => feed.yarns.map(yarn => yarn.yarnLengthCmPer100Needles));
  const readings = [];
  function reject(targets, value, reason, capturedSelection = selection(targets)) {
    const before = current(); const count = mutations.length; const timerCount = timers.size;
    const paths = [...canvases.values()].map(canvas => [...canvas.paths]);
    const result = actions.setSingleJerseyFeedYarnLengths(capturedSelection, value);
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
    assert.equal(result.updatedCount, 0);
    assert.equal(current(), before, "Failed preflight must not dispatch any partial state");
    assert.equal(current().yarnLengthSolverResults, before.yarnLengthSolverResults);
    assert.equal(current().previewValidity, before.previewValidity);
    assert.equal(mutations.length, count);
    assert.equal(timers.size, timerCount);
    assert.deepEqual([...canvases.values()].map(canvas => [...canvas.paths]), paths);
    return result;
  }
  function commit(targets, value) {
    const capturedSelection = selection(targets);
    const before = current(); const count = mutations.length;
    const result = actions.setSingleJerseyFeedYarnLengths(capturedSelection, value);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.updatedCount, targets.length);
    assert.equal(mutations.length, count + 1, "Exactly one business commit, never a loop of setters");
    assert.deepEqual(mutations.at(-1).yarnLengthSolverResults, []);
    assert.equal(mutations.at(-1).previewValidity, "DESIGN_PREVIEW", "No early observer sees old VALIDATED with new facts");
    assert.equal(current().previewValidity, "DESIGN_PREVIEW");
    assert.deepEqual(current().yarnLengthSolverResults, []);
    const nextCam = current().singleJerseyCamProgram;
    assert.equal(nextCam.tracks, before.singleJerseyCamProgram.tracks);
    for (const key of ["chart", "needleArrangement", "machineGauge", "yarnLibrary", "yarnPlies", "yarnSequence"]) {
      assert.equal(current()[key], before[key], `${key} must not change`);
    }
    before.singleJerseyCamProgram.feeds.forEach((feed, feedIndex) => feed.yarns.forEach((yarn, yarnIndex) => {
      const targeted = targets.some(target => target.feedIndex === feedIndex && target.yarnIndex === yarnIndex);
      const next = nextCam.feeds[feedIndex].yarns[yarnIndex];
      if (!targeted) assert.equal(next, yarn, "Untargeted assignment is unchanged, including all fields");
      else assert.deepEqual(next, { ...yarn, yarnLengthCmPer100Needles: Number(value) });
    }));
    flush();
    return result;
  }
  const assertSolved = (feed, yarn, target) => {
    const result = current().yarnLengthSolverResults.find(item => item.feedIndex === feed && item.yarnIndex === yarn);
    assert.equal(result.targetLengthCmPer100Needles, target);
    assert.equal(result.status, "CONVERGED"); assert.equal(result.appliedToSimulation, true);
    assert.ok(Math.abs(result.solvedLengthCmPer100Needles - target) <= result.toleranceCmPer100Needles);
    return result.solvedLengthCmPer100Needles;
  };
  const record = (testCase, details = {}) => readings.push({ testCase, lengths: lengths(),
    previewValidity: current().previewValidity, ...details });

  prepare();
  // A: real cross-Feed targets. Inject extension data to prove no normalization drops other facts.
  const cam = current().singleJerseyCamProgram;
  state.dispatch({ singleJerseyCamProgram: { ...cam, extension: { retained: true },
    feeds: cam.feeds.map((feed, index) => index === 0 ? { ...feed, extraFeedFact: "keep",
      yarns: [{ ...feed.yarns[0], extraAssignmentFact: { retained: true } }] } : feed) } });
  flush(); mutations.length = 0;
  const camBeforeA = current().singleJerseyCamProgram;
  commit([locator(0), locator(2)], 27);
  assert.deepEqual(lengths(), [[27], [23], [27], [23]]);
  assert.equal(current().singleJerseyCamProgram.extension, camBeforeA.extension);
  assert.equal(current().singleJerseyCamProgram.feeds[0].extraFeedFact, "keep");
  assertSolved(0, 0, 27); assertSolved(2, 0, 27); record("A");

  prepare(true); const bBefore = current().singleJerseyCamProgram.feeds[0].yarns[1];
  commit([locator(0)], 25);
  assert.deepEqual(lengths()[0], [25, 18]);
  assert.equal(current().singleJerseyCamProgram.feeds[0].yarns[1], bBefore);
  assertSolved(0, 1, 18); record("B");
  const noTargets = reject([], 27, "NO_TARGETS"); record("C", { result: noTargets });

  prepare(true); const stale = [locator(2), locator(0)]; const oldSelection = selection(stale);
  actions.setSingleJerseyFeedYarns(0, [{ ...current().singleJerseyCamProgram.feeds[0].yarns[0], yarnId: "Replacement" },
    current().singleJerseyCamProgram.feeds[0].yarns[1]]); flush();
  const staleResult = reject(stale, 27, "STALE_ASSIGNMENT_STRUCTURE", oldSelection);
  assert.equal(reject(stale, 27, "STALE_TARGET").failedTargetIndex, 1); // Layer 2 still rejects wrong IDs. record("D", { result: staleResult });

  prepare(true);
  for (const value of [-1, 0, "", " ", NaN, Infinity, -Infinity, "invalid", null, undefined]) {
    reject([locator(0), locator(0, 1)], value, "INVALID_YARN_LENGTH");
  }
  assert.deepEqual(lengths()[0], [23, 18]); record("E");
  for (const targets of [null, [null], [{ feedIndex: "0", yarnIndex: 0, yarnId: "A" }],
    [{ feedIndex: 0, yarnIndex: -1, yarnId: "A" }], [{ feedIndex: 0, yarnIndex: 0 }], [0, 1]]) {
    reject(targets, 27, "INVALID_TARGET");
  }
  reject([locator(0), locator(0)], 27, "DUPLICATE_TARGET");
  reject([locator(1), { feedIndex: 9, yarnIndex: 0, yarnId: "lost" }], 27, "STALE_TARGET");
  reject([locator(1), { feedIndex: 0, yarnIndex: 9, yarnId: "lost" }], 27, "STALE_TARGET");
  const removedSlot = [locator(1), locator(0, 1)]; const oldSlotSelection = selection(removedSlot);
  actions.setSingleJerseyFeedYarns(0, [current().singleJerseyCamProgram.feeds[0].yarns[0]]); flush();
  reject(removedSlot, 27, "STALE_ASSIGNMENT_STRUCTURE", oldSlotSelection);
  const removedFeed = [locator(0), locator(3)]; const oldFeedSelection = selection(removedFeed);
  actions.resizeSingleJerseyCamProgram(4, 3); flush();
  reject(removedFeed, 27, "STALE_ASSIGNMENT_STRUCTURE", oldFeedSelection);
  assert.equal(reject(removedFeed, 27, "STALE_TARGET").failedTargetIndex, 1);
  prepare(true);
  const uneditableCam = current().singleJerseyCamProgram;
  state.dispatch({ singleJerseyCamProgram: { ...uneditableCam,
    feeds: uneditableCam.feeds.map((feed, index) => index === 0 ? { ...feed,
      yarns: feed.yarns.map((yarn, slot) => slot === 1 ? { ...yarn, yarnLengthCmPer100Needles: -1 } : yarn) } : feed) } });
  flush();
  assert.equal(reject([locator(1), locator(0, 1)], 27, "TARGET_NOT_EDITABLE").failedTargetIndex, 1);

  prepare(); commit([0, 1, 2, 3].map(feed => locator(feed)), 27);
  assert.equal(current().previewValidity, "VALIDATED");
  record("F", { solved: [0, 1, 2, 3].map(feed => assertSolved(feed, 0, 27)) });

  prepare(true); commit([0, 1, 2, 3].map(feed => locator(feed)), 100);
  assert.equal(current().previewValidity, "PARTIAL");
  const unreachable = current().yarnLengthSolverResults.filter(result => result.yarnIndex === 0);
  assert.ok(unreachable.every(result => result.status === "UNREACHABLE_TARGET" && !result.appliedToSimulation));
  record("G-partial");
  commit([locator(0, 1)], 100);
  assert.equal(current().previewValidity, "INVALID"); record("G-invalid");

  prepare(true); commit([locator(0), locator(1), locator(2)], 25);
  assert.deepEqual(lengths(), [[25, 18], [25], [25], [23]]);
  assertSolved(0, 1, 18); record("H");
  assert.deepEqual(Array.from(chart.pixels), Array(48 * 60).fill(0));
  assert.equal(Object.hasOwn(getProjectData(), "yarnLengthSolverResults"), false);
  assert.equal(Object.hasOwn(getProjectData(), "previewValidity"), false);
  runner.stopSimulation();
  readings.forEach(reading => console.log(JSON.stringify(reading)));
  console.log("PASS: P0-4 A–H, one atomic commit, final-target failure injection, sibling isolation and unchanged rejected results.");
} finally { await server.close(); }
