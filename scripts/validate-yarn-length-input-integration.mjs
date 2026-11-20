import assert from "node:assert/strict";
import fs from "node:fs/promises";
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
const machineError = { hidden: true, textContent: "" };
globalThis.document = {
  createTreeWalker() { return {}; },
  getElementById(id) {
    if (id === "machine-execution-error") return machineError;
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

  // P0-C2: one runtime derivation, strict persisted facts, and atomic active-mode edits.
  const lengthInput = await server.ssrLoadModule("/src/domain/yarnLengthInput.js");
  assert.equal(typeof lengthInput.resolveYarnLengthInput, "function", "P0-C2 needs one shared target resolver");
  const { normalizeYarnLengthFields, resolveYarnLengthInput } = lengthInput;
  const relaxed = (length = 8, draftRatio = 3) => ({
    lengthInputMode: "relaxedWithDraft", relaxedLengthCmPer100Needles: length, draftRatio,
  });
  assert.deepEqual(normalizeYarnLengthFields({ yarnLengthCmPer100Needles: null }), { yarnLengthCmPer100Needles: 0 });
  assert.deepEqual(normalizeYarnLengthFields({ lengthInputMode: "directTarget" }), { lengthInputMode: "directTarget" });
  assert.deepEqual(normalizeYarnLengthFields({ ...relaxed(), yarnLengthCmPer100Needles: 23 }), relaxed());
  assert.deepEqual(normalizeYarnLengthFields({ lengthInputMode: "directTarget", yarnLengthCmPer100Needles: 23,
    relaxedLengthCmPer100Needles: 8, draftRatio: 3 }), { lengthInputMode: "directTarget", yarnLengthCmPer100Needles: 23 });
  for (const mode of ["future-mode", "", null, undefined]) {
    assert.throws(() => normalizeYarnLengthFields({ lengthInputMode: mode, yarnLengthCmPer100Needles: 23 }), TypeError);
  }
  for (const field of ["relaxedLengthCmPer100Needles", "draftRatio"]) {
    for (const value of [-1, 0, "", " ", "invalid", NaN, Infinity, null, undefined, {}, true, []]) {
      assert.throws(() => normalizeYarnLengthFields({ ...relaxed(), [field]: value }), TypeError);
      assert.throws(() => normalizeYarnLengthFields({ yarnLengthCmPer100Needles: 23, [field]: value }), TypeError,
        "Inactive but present invalid new facts must not be silently discarded");
    }
  }
  assert.equal(resolveYarnLengthInput({ yarnLengthCmPer100Needles: 23 }).effectiveTargetLengthCmPer100Needles, 23);
  assert.equal(resolveYarnLengthInput({ yarnLengthCmPer100Needles: 0 }).status, "NOT_SET");
  assert.equal(resolveYarnLengthInput({ lengthInputMode: "directTarget" }).status, "NOT_SET");
  for (const [length, draftRatio] of [[8, 2.8], [8, 3], [8, 3.2], [10, 2.4], [5, 4]]) {
    const resolved = resolveYarnLengthInput({ ...relaxed(length, draftRatio), tensionCN: 400 });
    assert.equal(resolved.status, "READY");
    assert.equal(resolved.effectiveTargetLengthCmPer100Needles, length * draftRatio);
    assert.equal(resolved.relaxedLengthCmPer100Needles, length);
    assert.equal(resolved.draftRatio, draftRatio);
    assert.equal(resolved.directTargetLengthCmPer100Needles, null);
  }
  assert.notEqual(resolveYarnLengthInput(relaxed()).inputSignature,
    resolveYarnLengthInput(relaxed(10, 2.4)).inputSignature, "Equal products retain distinct process sources");
  for (const incomplete of [{ lengthInputMode: "relaxedWithDraft" },
    { lengthInputMode: "relaxedWithDraft", relaxedLengthCmPer100Needles: 8 },
    { lengthInputMode: "relaxedWithDraft", draftRatio: 3 },
    { ...relaxed(), draftRatio: -1 }]) {
    const resolved = resolveYarnLengthInput({ ...incomplete, yarnLengthCmPer100Needles: 24 });
    assert.equal(resolved.status, "INCOMPLETE");
    assert.equal(resolved.effectiveTargetLengthCmPer100Needles, null, "No fallback to an inactive direct target");
  }
  for (const invalidProduct of [relaxed(Number.MAX_VALUE, 2), relaxed(Number.MIN_VALUE, 0.5)]) {
    assert.throws(() => normalizeYarnLengthFields(invalidProduct), TypeError);
    assert.equal(resolveYarnLengthInput(invalidProduct).effectiveTargetLengthCmPer100Needles, null);
  }
  setAll(23);
  const parameterRevision = current.feedYarnStructureRevision;
  const parameterCommits = [];
  state.StateMonitor.register([() => ({ syncState(snapshot, changes) {
    if (changes.includes("singleJerseyCamProgram")) parameterCommits.push(snapshot);
  } })]);
  const assignment = () => current.singleJerseyCamProgram.feeds[0].yarns[0];
  assert.equal(actions.setSingleJerseyFeedYarnLengthInputMode(0, 0, "relaxedWithDraft").ok, true);
  assert.equal(Object.hasOwn(assignment(), "yarnLengthCmPer100Needles"), false);
  assert.equal(Object.hasOwn(assignment(), "relaxedLengthCmPer100Needles"), false);
  assert.equal(Object.hasOwn(assignment(), "draftRatio"), false);
  assert.equal(resolveYarnLengthInput(assignment()).status, "INCOMPLETE");
  assert.deepEqual(current.yarnLengthSolverResults, []);
  assert.equal(current.previewValidity, "DESIGN_PREVIEW");
  assert.equal(current.feedYarnStructureRevision, parameterRevision);
  assert.equal(actions.setSingleJerseyFeedYarnLength(0, 0, "8").ok, true);
  assert.equal(actions.setSingleJerseyFeedYarnDraftRatio(0, 0, "3.0").ok, true);
  assert.equal(resolveYarnLengthInput(assignment()).effectiveTargetLengthCmPer100Needles, 24);
  flushTimers();
  const result24 = current.yarnLengthSolverResults.find(result => result.feedIndex === 0);
  assert.equal(result24.status, "CONVERGED");
  assert.equal(result24.targetLengthCmPer100Needles, 24);
  assert.equal(result24.lengthInput.relaxedLengthCmPer100Needles, 8);
  assert.equal(result24.lengthInput.draftRatio, 3);
  for (const [setter, field, reason] of [
    [actions.setSingleJerseyFeedYarnLength, "relaxedLengthCmPer100Needles", "INVALID_YARN_LENGTH"],
    [actions.setSingleJerseyFeedYarnDraftRatio, "draftRatio", "INVALID_DRAFT_RATIO"],
  ]) {
    for (const value of [-1, 0, "", " ", "invalid", NaN, Infinity, null, undefined, {}, true]) {
      const before = state.GLOBAL_STATE;
      const beforeTimers = timers.size;
      assert.deepEqual(setter(0, 0, value), { ok: false, reason, previousValue: assignment()[field] });
      assert.equal(state.GLOBAL_STATE, before);
      assert.equal(current.yarnLengthSolverResults, before.yarnLengthSolverResults);
      assert.equal(timers.size, beforeTimers);
    }
  }
  const beforeOverflow = state.GLOBAL_STATE;
  assert.equal(actions.setSingleJerseyFeedYarnDraftRatio(0, 0, Number.MAX_VALUE).reason, "INVALID_EFFECTIVE_YARN_LENGTH");
  assert.equal(state.GLOBAL_STATE, beforeOverflow);
  actions.setSingleJerseyFeedYarnLength(0, 0, 10);
  actions.setSingleJerseyFeedYarnDraftRatio(0, 0, 2.4);
  assert.equal(resolveYarnLengthInput(assignment()).effectiveTargetLengthCmPer100Needles, 24);
  assert.equal(current.feedYarnStructureRevision, parameterRevision);
  assert.deepEqual(current.yarnLengthSolverResults, []);
  flushTimers();
  const equalProductResult = current.yarnLengthSolverResults.find(result => result.feedIndex === 0);
  assert.equal(equalProductResult.status, "CONVERGED");
  assert.equal(equalProductResult.targetLengthCmPer100Needles, 24);
  assert.equal(equalProductResult.lengthInput.relaxedLengthCmPer100Needles, 10);
  assert.equal(equalProductResult.lengthInput.draftRatio, 2.4);
  assert.notEqual(equalProductResult.lengthInput.inputSignature, result24.lengthInput.inputSignature);
  assert.equal(actions.clearSingleJerseyFeedYarnLength(0, 0).operation, "CLEAR");
  assert.equal(Object.hasOwn(assignment(), "relaxedLengthCmPer100Needles"), false);
  assert.equal(assignment().draftRatio, 2.4);
  assert.equal(resolveYarnLengthInput(assignment()).status, "INCOMPLETE");
  actions.setSingleJerseyFeedYarnLength(0, 0, 8);
  assert.equal(actions.clearSingleJerseyFeedYarnDraftRatio(0, 0).operation, "CLEAR");
  assert.equal(Object.hasOwn(assignment(), "draftRatio"), false);
  assert.equal(assignment().relaxedLengthCmPer100Needles, 8);
  actions.setSingleJerseyFeedYarnDraftRatio(0, 0, 3);
  assert.equal(actions.setSingleJerseyFeedYarnLengthInputMode(0, 0, "directTarget").ok, true);
  assert.deepEqual(normalizeYarnLengthFields(assignment()), { lengthInputMode: "directTarget" });
  assert.equal(resolveYarnLengthInput(assignment()).status, "NOT_SET");
  assert.equal(current.feedYarnStructureRevision, parameterRevision);
  const beforeInvalidMode = state.GLOBAL_STATE;
  assert.equal(actions.setSingleJerseyFeedYarnLengthInputMode(0, 0, "future").ok, false);
  assert.equal(actions.setSingleJerseyFeedYarnDraftRatio(0, 0, 3).ok, false);
  assert.equal(state.GLOBAL_STATE, beforeInvalidMode);
  assert.ok(parameterCommits.every(snapshot => snapshot.yarnLengthSolverResults.length === 0 &&
    snapshot.previewValidity === "DESIGN_PREVIEW"), "Every parameter commit invalidates derived results atomically");
  results.push({ testCase: "P0-C2", normalizedModes: ["directTarget", "relaxedWithDraft"],
    sopTarget: 24, parameterRevisionUnchanged: true, invalidInputsPreserveState: true });

  // Replay the actual P0-C2 unset-length regression through import, actions and
  // the registered runner. Assertions run AFTER the debounce, not just invalidation.
  const { readProjectPackage } = await server.ssrLoadModule("/src/actions/projectPackage.js");
  const { createSingleJerseyExecutionInput } = await server.ssrLoadModule("/src/components/singleJerseyExecutionInput.js");
  const { getYarnLengthFeedbackRows } = await server.ssrLoadModule("/src/views/yarnLengthSolverFeedback.js");
  const opened = await readProjectPackage(new Blob([await fs.readFile(
    "scripts/fixtures/SOP-001-N6W6040-bare-spandex.knitscape")]));
  const sop = opened.project;
  const unset = structuredClone(sop);
  unset.singleJerseyCamProgram.feeds.forEach(feed => {
    delete feed.yarns[0].yarnLengthCmPer100Needles;
    delete feed.yarns[1].relaxedLengthCmPer100Needles;
  });
  assert.equal(loadJSON(unset, opened.registry), true);
  flushTimers();
  const forFeeds = callback => current.singleJerseyCamProgram.feeds.forEach((_feed, index) => callback(index));
  const inputs = () => current.singleJerseyCamProgram.feeds.flatMap(feed => feed.yarns.map(resolveYarnLengthInput));
  const observe = testCase => {
    const reading = { testCase, previewValidity: current.previewValidity,
      inputs: inputs().map(input => [input.status, input.effectiveTargetLengthCmPer100Needles]),
      results: current.yarnLengthSolverResults.map(result => [result.feedIndex, result.yarnIndex, result.status]),
      machineError: machineError.textContent };
    results.push(reading);
    console.log(JSON.stringify(reading));
  };
  const assertBasePreview = testCase => {
    assert.ok(inputs().every(input => input.effectiveTargetLengthCmPer100Needles === null));
    assert.deepEqual(current.yarnLengthSolverResults, [], "No missing target may produce a failed or stale SolverResult");
    assert.ok(getYarnLengthFeedbackRows(current).every(row => row.target === null && row.result === null));
    assert.equal(machineError.hidden, true);
    observe(testCase);
    assert.equal(current.previewValidity, "DESIGN_PREVIEW", `${testCase}: no effective targets must retain the base design preview`);
  };
  assert.deepEqual([current.chart.width, current.chart.height, current.machineGauge], [30, 40, 32]);
  assert.deepEqual(current.needleArrangement, [1, 2, 3, 4]);
  assert.ok(createSingleJerseyExecutionInput(current.singleJerseyCamProgram, current.needleArrangement, 30, 40));
  assert.equal(current.singleJerseyCamProgram.feeds.length, 8);
  assert.ok(current.singleJerseyCamProgram.feeds.every(feed => feed.yarns.length === 2 &&
    feed.yarns.every(yarn => current.yarnLibrary.some(asset => asset.id === yarn.yarnId))));
  assertBasePreview("unset-original-A / D-ratio-only");

  // A: legacy direct zero; B/C/D: legal missing facts, never fabricated targets.
  forFeeds(feed => actions.setSingleJerseyFeedYarns(feed,
    current.singleJerseyCamProgram.feeds[feed].yarns.map(yarn => ({
      yarnId: yarn.yarnId, yarnLengthCmPer100Needles: 0, tensionCN: yarn.tensionCN, placement: yarn.placement,
    }))));
  flushTimers(); assertBasePreview("A-legacy-direct-unset");
  forFeeds(feed => actions.setSingleJerseyFeedYarnLengthInputMode(feed, 1, "relaxedWithDraft"));
  flushTimers(); assertBasePreview("B-relaxed-both-unset");
  const sopRevision = current.feedYarnStructureRevision;
  forFeeds(feed => actions.setSingleJerseyFeedYarnLength(feed, 1, 8));
  flushTimers(); assertBasePreview("C-relaxed-only");
  assert.ok(inputs().filter(input => input.lengthInputMode === "relaxedWithDraft").every(input => input.status === "INCOMPLETE"));
  const incompleteProject = structuredClone(getProjectData());

  // F preserves the existing new-mode mixed contract; direct unset slots are
  // still excluded (covered above by the original single-Clear regression).
  forFeeds(feed => actions.setSingleJerseyFeedYarnLength(feed, 0, 23));
  flushTimers();
  assert.equal(current.previewValidity, "PARTIAL");
  assert.equal(current.yarnLengthSolverResults.length, 8);
  assert.ok(current.yarnLengthSolverResults.every(result => result.yarnIndex === 0 && result.status === "CONVERGED"));
  observe("F-main-23-relaxed-incomplete");
  forFeeds(feed => actions.clearSingleJerseyFeedYarnLength(feed, 1));
  flushTimers();
  assert.equal(current.previewValidity, "PARTIAL");
  assert.equal(current.yarnLengthSolverResults.length, 8);
  forFeeds(feed => actions.setSingleJerseyFeedYarnDraftRatio(feed, 1, "3.0"));
  flushTimers();
  assert.equal(current.previewValidity, "PARTIAL");
  assert.equal(current.yarnLengthSolverResults.length, 8);
  observe("F-main-23-ratio-only");
  forFeeds(feed => actions.setSingleJerseyFeedYarnLength(feed, 1, 8));
  flushTimers();
  assert.equal(current.previewValidity, "VALIDATED");
  assert.equal(current.yarnLengthSolverResults.length, 16);
  const frozen = JSON.parse(await fs.readFile(
    "scripts/fixtures/root-cause-regression.json", "utf8"))
    .summaries.find(summary => summary.label === "current" && summary.scene === "C").results;
  const numericFields = ["targetLengthCmPer100Needles", "solvedLengthCmPer100Needles",
    "errorCmPer100Needles", "solvedLoopHeight", "status", "appliedToSimulation"];
  current.yarnLengthSolverResults.forEach(result => {
    const old = frozen.find(row => row.feedIndex === result.feedIndex && row.yarnIndex === result.yarnIndex);
    assert.deepEqual(numericFields.map(field => result[field]), numericFields.map(field => old[field]), "SOP numeric drift must be exactly zero");
    assert.equal(result.lengthInput.effectiveTargetLengthCmPer100Needles, result.yarnIndex === 0 ? 23 : 24);
  });
  assert.equal(current.feedYarnStructureRevision, sopRevision);
  observe("G / K-complete-23-and-8-times-3");

  // J: invalid persisted new-mode facts must fail atomically, just like edits.
  for (const bad of [{ lengthInputMode: "unknown" }, { relaxedLengthCmPer100Needles: -1 },
    { draftRatio: Infinity }, { relaxedLengthCmPer100Needles: NaN }]) {
    const before = state.GLOBAL_STATE;
    const badProject = structuredClone(getProjectData());
    Object.assign(badProject.singleJerseyCamProgram.feeds[0].yarns[1], bad);
    assert.throws(() => loadJSON(badProject), TypeError);
    assert.equal(state.GLOBAL_STATE, before);
    assert.equal(timers.size, 0);
  }

  // E: explicit Clear revokes results and their input provenance immediately.
  forFeeds(feed => {
    assert.equal(actions.clearSingleJerseyFeedYarnLength(feed, 0).operation, "CLEAR");
    assert.equal(actions.clearSingleJerseyFeedYarnLength(feed, 1).operation, "CLEAR");
  });
  assert.deepEqual(current.yarnLengthSolverResults, []);
  flushTimers(); assertBasePreview("E-clear-success / D-ratio-only");
  forFeeds(feed => assert.equal(actions.clearSingleJerseyFeedYarnDraftRatio(feed, 1).operation, "CLEAR"));
  flushTimers(); assertBasePreview("E-clear-both-facts");

  // H/I: absence of targets must not hide actual solve or machine errors.
  forFeeds(feed => actions.setSingleJerseyFeedYarnLength(feed, 0, 0.5));
  flushTimers();
  assert.equal(current.previewValidity, "INVALID");
  assert.equal(current.yarnLengthSolverResults.length, 8);
  assert.ok(current.yarnLengthSolverResults.every(result => result.status === "UNREACHABLE_TARGET" && !result.appliedToSimulation));
  observe("H-unreachable");
  forFeeds(feed => actions.clearSingleJerseyFeedYarnLength(feed, 0));
  flushTimers(); assertBasePreview("H-clear-unreachable");
  actions.resizeSingleJerseyCamProgram(3, 8);
  flushTimers();
  assert.equal(current.previewValidity, "INVALID");
  assert.equal(machineError.hidden, false);
  assert.match(machineError.textContent, /Needle Type 4/);
  assert.deepEqual(current.yarnLengthSolverResults, []);
  observe("I-invalid-machine-with-no-targets");

  // L: imports and active-mode switches remove old results/errors through the
  // production lifecycle, including incomplete -> ready and ready -> unset.
  assert.equal(loadJSON(incompleteProject), true);
  flushTimers(); assertBasePreview("L-reload-incomplete-after-machine-error");
  forFeeds(feed => actions.setSingleJerseyFeedYarnDraftRatio(feed, 1, 3));
  flushTimers();
  assert.equal(current.previewValidity, "VALIDATED");
  assert.equal(current.yarnLengthSolverResults.length, 8);
  assert.ok(current.yarnLengthSolverResults.every(result => result.yarnIndex === 1 && result.status === "CONVERGED"));
  forFeeds(feed => actions.setSingleJerseyFeedYarnLengthInputMode(feed, 1, "directTarget"));
  flushTimers(); assertBasePreview("L-switch-to-direct-unset");
  assert.equal(loadJSON(sop), true);
  flushTimers();
  assert.equal(current.previewValidity, "VALIDATED");
  assert.equal(current.yarnLengthSolverResults.length, 16);
  assert.equal(loadJSON(unset), true);
  flushTimers(); assertBasePreview("L-reload-original-unset");
  // A positive target on an unused Feed must not turn participating incomplete
  // assignments into failures. This 40-course fixture cannot use Feed 48.
  actions.resizeSingleJerseyCamProgram(4, 48);
  assert.equal(actions.setSingleJerseyFeedYarnLength(47, 0, 23).ok, true);
  flushTimers();
  assert.equal(current.previewValidity, "DESIGN_PREVIEW");
  assert.deepEqual(current.yarnLengthSolverResults, []);
  assert.equal(machineError.hidden, true);
  observe("unused-feed-target");
  runner.stopSimulation();
  results.forEach(result => console.log(JSON.stringify(result)));
  console.log("PASS: P0-3 A–F, atomic rejection/clear/commit, raw normalization/legacy imports, unchanged Solver state and P0-1/P0-2 regressions.");
} finally {
  await server.close();
}
