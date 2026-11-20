import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";
import { resolveSingleJerseyOperations } from "../src/domain/singleJerseyMachine.js";
globalThis.Path2D ??= class Path2D {};
globalThis.devicePixelRatio ??= 1;

const integrationPath = "src/components/singleJerseyExecutionInput.js";
const runSimulationPath = "src/components/runSimulation.js";

assert.ok(
  fs.existsSync(integrationPath),
  "single jersey execution integration helper must exist."
);

const { createSingleJerseyExecutionInput } = await import(
  `../${integrationPath}`
);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const arrangement = deepFreeze([1, 2, 2, 3, 4, 4]);

const allKnitProgram = deepFreeze({
  tracks: [["K"], ["K"], ["K"], ["K"]],
});
const caseA = createSingleJerseyExecutionInput(
  allKnitProgram,
  arrangement,
  12,
  4
);
assert.equal(caseA.width, 12);
assert.equal(caseA.height, 4);
assert.deepEqual(caseA.make2d(), [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
]);

const singleFeedProgram = deepFreeze({
  tracks: [["K"], ["T"], ["M"], ["K"]],
});
const caseB = createSingleJerseyExecutionInput(
  singleFeedProgram,
  arrangement,
  12,
  2
);
assert.equal(caseB.width, 12);
assert.equal(caseB.height, 2);
assert.deepEqual(caseB.make2d(), [
  [0, 3, 3, 2, 0, 0, 0, 3, 3, 2, 0, 0],
  [0, 3, 3, 2, 0, 0, 0, 3, 3, 2, 0, 0],
]);

const fourByFourProgram = deepFreeze({
  tracks: [
    ["K", "T", "M", "K"],
    ["T", "M", "K", "M"],
    ["M", "K", "T", "T"],
    ["K", "M", "T", "K"],
  ],
});
const caseC = createSingleJerseyExecutionInput(
  fourByFourProgram,
  arrangement,
  12,
  8
);
assert.equal(caseC.width, 12);
assert.equal(caseC.height, 8);
assert.deepEqual(caseC.make2d(), [
  [0, 3, 3, 2, 0, 0, 0, 3, 3, 2, 0, 0],
  [3, 2, 2, 0, 2, 2, 3, 2, 2, 0, 2, 2],
  [2, 0, 0, 3, 3, 3, 2, 0, 0, 3, 3, 3],
  [0, 2, 2, 3, 0, 0, 0, 2, 2, 3, 0, 0],
  [0, 3, 3, 2, 0, 0, 0, 3, 3, 2, 0, 0],
  [3, 2, 2, 0, 2, 2, 3, 2, 2, 0, 2, 2],
  [2, 0, 0, 3, 3, 3, 2, 0, 0, 3, 3, 3],
  [0, 2, 2, 3, 0, 0, 0, 2, 2, 3, 0, 0],
]);
for (let course = 0; course < 8; course += 1) {
  assert.deepEqual(
    caseC.make2d()[course],
    caseC.make2d()[course % 4],
    `course ${course} must map to Cam feed ${course % 4}.`
  );
}

const caseD = createSingleJerseyExecutionInput(
  singleFeedProgram,
  arrangement,
  18,
  1
);
assert.equal(caseD.width, 18);
assert.equal(caseD.height, 1);
assert.deepEqual(caseD.make2d(), [
  [0, 3, 3, 2, 0, 0, 0, 3, 3, 2, 0, 0, 0, 3, 3, 2, 0, 0],
]);

assert.equal(
  createSingleJerseyExecutionInput(null, arrangement, 0, 0),
  null,
  "a missing Cam Program must return before resolver dimension validation."
);
assert.equal(
  createSingleJerseyExecutionInput(allKnitProgram, [], 0, 0),
  null,
  "an empty arrangement must return before resolver dimension validation."
);

const threeTrackProgram = deepFreeze({
  tracks: [["K"], ["T"], ["M"]],
});
const mismatchMessage =
  "Needle Type 4 exceeds camProgram.tracks length 3.";
assert.throws(
  () =>
    resolveSingleJerseyOperations(
      threeTrackProgram,
      arrangement,
      12,
      4
    ),
  (error) => error instanceof RangeError && error.message === mismatchMessage
);
assert.throws(
  () =>
    createSingleJerseyExecutionInput(
      threeTrackProgram,
      arrangement,
      12,
      4
    ),
  (error) =>
    error instanceof RangeError &&
    error.message === mismatchMessage
);

assert.deepEqual(allKnitProgram, {
  tracks: [["K"], ["K"], ["K"], ["K"]],
});
assert.deepEqual(singleFeedProgram, {
  tracks: [["K"], ["T"], ["M"], ["K"]],
});
assert.deepEqual(arrangement, [1, 2, 2, 3, 4, 4]);

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const originalSimulateStub = globalThis.__singleJerseySimulateStub;
const originalRunnerState = globalThis.__singleJerseyRunnerState;
const originalDispatchStub = globalThis.__singleJerseyDispatchStub;
const simulationCalls = [];
const dispatchCalls = [];
const clearedCanvasIDs = [];
const machineExecutionErrorElement = {
  hidden: true,
  textContent: "",
};

const chart = { width: 12, height: 8 };
const previewFeeds = [21, 23, 27, 23].map((length) => ({
  yarns: [{ yarnId: 0, yarnLengthCmPer100Needles: length }, { yarnId: "thread-b" }],
}));
const runtimeState = {
  chart,
  needleArrangement: [1, 2, 2, 3, 4, 4],
  singleJerseyCamProgram: { ...fourByFourProgram, feeds: previewFeeds },
  yarnSequence: {},
  yarnPalette: [],
  simScale: 2,
  simPan: { x: 37, y: -19 },
  simPreviewScale: 2.5,
  simPreviewPan: { x: 41, y: -23 },
  flipped: true,
  yarnPlies: [],
  yarnLibrary: [
    { id: 0, name: "Assigned cotton" },
    { id: "thread-b", name: "Assigned elastic" },
    { id: "unused", name: "Unused library yarn" },
  ],
  machineGauge: 1,
  texturePerformanceMode: "solid",
  texturePreviewInteractionActive: false,
};

globalThis.__singleJerseyRunnerState = runtimeState;
globalThis.__singleJerseyDispatchStub = (action) => {
  dispatchCalls.push(action);
  Object.assign(runtimeState, action);
};
globalThis.__singleJerseySimulateStub = (options) => {
  const { pattern } = options;
  const record = { pattern, options, stopCount: 0, selections: [], trials: [] };
  const feedYarnIds = new Map((options.feeds ?? []).map((feed, index) =>
    [index, feed.yarns.map(yarn => String(yarn.yarnId))]));
  const yarnIds = [...new Set([...feedYarnIds.values()].flat())];
  const links = Array.from({ length: Math.max(1, options.feeds?.length ?? 0) }, (_, index) =>
    ({ index, row: index, layer: "front" }));
  const paths = new Map(links.map(link => [link.index, "M0,0L1,1"]));
  const snapshot = { ...options, pattern: { width: pattern.width, height: pattern.height },
    referenceViewport: { canvasWidth: options.canvasWidth, canvasHeight: options.canvasHeight },
    yarnIds, feedYarnIds, yarnPathLinks: links, feedCount: options.feeds?.length ?? 0,
    yarnStrands: Array.from({ length: Math.max(1, ...[...feedYarnIds.values()].map(ids => ids.length)) },
      () => ({ modelPathByLink: paths, resolvedPathByLink: paths })),
    primaryLengthScaleY: 1, primaryYarnDiameter: .24, stitchWidth: 24,
    stitchPattern: { width: pattern.width + 2, height: pattern.height },
    normalizedYarnSequence: { width: 1, height: pattern.height, pixels: Array(pattern.height).fill(0) },
    originalSolverResults: [{ status: "CONVERGED", source: pattern }],
    previewValidity: "VALIDATED", yarnLengthMetrics: { source: pattern } };
  record.snapshot = snapshot;
  simulationCalls.push(record);
  return snapshot;
};
// Observe the renderer boundary without mixing calculation and view ownership.
globalThis.__singleJerseyRenderer = () => {
  let previousRecord, previousVisible = null, previousTrial = false;
  return { mount() { return this; }, suspend() {}, ready: Promise.resolve(),
    update(scene) {
      const record = simulationCalls.find(call => call.snapshot === scene.snapshot);
      if (record !== previousRecord) { previousRecord = record; previousVisible = scene.renderItems.visibleYarnId; previousTrial = Boolean(scene.structureLineStyle); }
      else {
        if (scene.renderItems.visibleYarnId !== previousVisible) record.selections.push(scene.renderItems.visibleYarnId);
        if (Boolean(scene.structureLineStyle) !== previousTrial) record.trials.push(Boolean(scene.structureLineStyle));
        previousVisible = scene.renderItems.visibleYarnId; previousTrial = Boolean(scene.structureLineStyle);
      }
    },
    dispose() { if (previousRecord) previousRecord.stopCount++; },
  };
};

// Inspect the existing lit-html stub's templates and invoke the real UI handlers.
function templates(value) {
  // Vite can externalize lit-html before the virtual stub is resolved.
  if (value?.strings && Array.isArray(value.values)) value = [value.strings, ...value.values];
  if (!Array.isArray(value)) return [];
  const current = Array.isArray(value[0]) && value[0].raw ? [value] : [];
  return current.concat(value.flatMap(templates));
}
function yarnSelect(view) {
  return templates(view).find(([strings]) => strings.join("").includes('id="simulation-yarn-select"'));
}
function binding(template, attribute, after = "") {
  const [strings, ...values] = template;
  let reached = !after;
  for (let index = 0; index < values.length; index++) {
    reached ||= strings[index].includes(after);
    if (reached && strings[index].trimEnd().endsWith(`${attribute}=`)) return values[index];
  }
}

const virtualModules = new Map([
  ["../simulation/classic2dRenderer.js", { id: "\0single-jersey-renderer-stub",
    code: "export const createClassic2dRenderer = () => globalThis.__singleJerseyRenderer();" }],
  [
    "../simulation/computeYarnSimulation.js",
    {
      id: "\0single-jersey-simulate-stub",
      code: `export const computeYarnSimulation = (...args) => globalThis.__singleJerseySimulateStub(...args);`,
    },
  ],
  [
    "../state",
    {
      id: "\0single-jersey-state-stub",
      code: `export const GLOBAL_STATE = globalThis.__singleJerseyRunnerState;
        export const dispatch = (action) =>
          globalThis.__singleJerseyDispatchStub(action);`,
    },
  ],
  [
    "lit-html",
    {
      id: "\0single-jersey-lit-stub",
      code: "export const html = (...values) => values;",
    },
  ],
  [
    "../constants",
    {
      id: "\0single-jersey-constants-stub",
      code: "export const MIN_SIM_SCALE = 0.1; export const MAX_SIM_SCALE = 4;",
    },
  ],
  [
    "../actions/zoomFit",
    {
      id: "\0single-jersey-zoom-stub",
      code: "export const centerZoomSimulation = () => {};",
    },
  ],
  [
    "../actions/texturePerformance",
    {
      id: "\0single-jersey-texture-stub",
      code: `export const beginTexturePreviewInteraction = () => {};
        export const endTexturePreviewInteraction = () => {};`,
    },
  ],
  [
    "../views/uiButton",
    {
      id: "\0single-jersey-button-stub",
      code: "export const buttonIcon = () => '';",
    },
  ],
  [
    "../views/yarnLengthSolverFeedback.js",
    {
      id: "\0single-jersey-feedback-stub",
      code: "export const yarnLengthSolverFeedback = () => '';",
    },
  ],
  [
    "../i18n",
    {
      id: "\0single-jersey-i18n-stub",
      code: "export const t = (key) => key;",
    },
  ],
]);
const virtualModuleByID = new Map(
  Array.from(virtualModules.values(), (virtualModule) => [
    virtualModule.id,
    virtualModule,
  ])
);

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
  plugins: [
    {
      name: "single-jersey-runner-boundaries",
      enforce: "pre",
      resolveId(source, importer) {
        const isRunnerImport = importer
          ?.replaceAll("\\", "/")
          .match(/\/src\/components\/(?:runSimulation|simulationCoordinator|simulationPreviewHost)\.js$/);
        return isRunnerImport ? virtualModules.get(source)?.id ?? null : null;
      },
      load(id) {
        return virtualModuleByID.get(id)?.code ?? null;
      },
    },
  ],
});

try {
  const runnerModule = await server.ssrLoadModule(
    "/src/components/runSimulation.js"
  );
  // Match the unminified directive used by Vite's development module transform.
  const { _$LH } = await import("../node_modules/lit-html/node/development/lit-html.js");
  globalThis.window = {
    clearTimeout() {},
    setTimeout(callback) {
      callback();
      return 1;
    },
  };
  const elementCache = new Map();
  globalThis.document = {
    getElementById(elementID) {
      if (elementID === "machine-execution-error") {
        return machineExecutionErrorElement;
      }
      if (elementCache.has(elementID)) return elementCache.get(elementID);
      const element = {
        width: 640, height: 480, style: {},
        getBoundingClientRect: () => ({ width: 320, height: 240 }),
        getContext(contextType) {
          assert.equal(contextType, "2d");
          return {
            clearRect(x, y, width, height) {
              assert.deepEqual([x, y, width, height], [0, 0, 640, 480]);
              clearedCanvasIDs.push(elementID);
            },
          };
        },
      };
      elementCache.set(elementID, element);
      return element;
    },
  };
  const { runSimulation, stopSimulation, simulationView } = runnerModule;
  let runner = runSimulation()({ state: runtimeState });

  assert.equal(simulationCalls.length, 2);
  assert.equal(simulationCalls[0].pattern, chart);
  assert.equal(simulationCalls[0].options.feeds, undefined);
  assert.equal(simulationCalls[0].options.yarnLibrary, undefined,
    "The design preview keeps the legacy Yarn material path.");
  assert.equal(simulationCalls[1].options.feeds, previewFeeds);
  assert.equal(simulationCalls[1].options.yarnLibrary, runtimeState.yarnLibrary,
    "Only the final fabric receives Yarn Library references.");
  assert.equal(simulationCalls[0].options.scope, "pattern");
  assert.equal(simulationCalls[1].options.scope, "machine");
  assert.ok(simulationCalls[0].options.inputSignature);
  assert.ok(simulationCalls[1].options.inputSignature);
  assert.equal(simulationCalls[1].pattern.width, 12);
  assert.equal(simulationCalls[1].pattern.height, 8);
  assert.deepEqual(simulationCalls[1].pattern.make2d(), caseC.make2d());


  const initialView = simulationView();
  const select = yarnSelect(initialView);
  assert.ok(select, "The product machine preview must expose a Yarn view selector.");
  const viewText = JSON.stringify(initialView);
  assert.ok(viewText.includes("Assigned cotton") && viewText.includes("Assigned elastic"),
    "View options use the actual participating Yarn IDs and library names.");
  assert.ok(!viewText.includes("Unused library yarn"), "Unassigned library yarns are not view options.");
  const changeYarn = binding(select, "@change", 'id="simulation-yarn-select"');
  assert.equal(typeof changeYarn, "function");
  const stateBeforeSelection = JSON.stringify(runtimeState);
  const dispatchesBeforeSelection = dispatchCalls.length;
  const resultsBeforeSelection = runtimeState.yarnLengthSolverResults;
  for (const id of ["0", "thread-b", "", "thread-b"]) {
    changeYarn({ target: { value: id } });
  }
  assert.deepEqual(simulationCalls[1].selections, ["0", "thread-b", null, "thread-b"]);
  assert.equal(simulationCalls.length, 2, "Changing Yarn view must not rerun either simulation.");
  assert.equal(dispatchCalls.length, dispatchesBeforeSelection,
    "Changing Yarn view must not dispatch project or simulation input changes.");
  assert.equal(JSON.stringify(runtimeState), stateBeforeSelection);
  assert.equal(runtimeState.yarnLengthSolverResults, resultsBeforeSelection);
  for (const eventName of ["pointerdown", "touchstart", "wheel", "keydown", "keyup"]) {
    const handler = templates(initialView).map(template => binding(template, `@${eventName}`))
      .find(value => typeof value === "function");
    assert.equal(typeof handler, "function", `${eventName} must not reach preview gestures or global shortcuts.`);
    let stopped = 0;
    handler({ stopPropagation() { stopped++; }, preventDefault() {
      assert.fail(`${eventName} must preserve the native selector's default behavior.`);
    } });
    assert.equal(stopped, 1);
  }

  const trialControl = () => templates(simulationView()).find(([strings]) =>
    strings.join("").includes('id="structure-line-trial-toggle"'));
  assert.ok(trialControl(), "A visible structure-line trial switch must sit beside the Yarn selector");
  const trialClick = binding(trialControl(), "@click");
  const trialKey = binding(trialControl(), "@keydown");
  assert.equal(typeof trialClick, "function");
  assert.equal(typeof trialKey, "function");
  assert.equal(binding(trialControl(), "?disabled"), false);
  function assertTrialState(enabled) {
    const control = trialControl();
    assert.equal(binding(control, "aria-pressed"), enabled, "The control reflects the shared trial state");
    assert.ok(control.includes(enabled ? "开启" : "关闭"), "The current state must be visibly named");
    assert.equal(JSON.stringify(simulationView()).includes("结构线试验已开启"), enabled,
      "The active canvas marker must disappear completely when closed");
    assert.equal(simulationCalls[1].trials.at(-1) ?? false, enabled,
      "The visible state and last applied renderer state must agree");
  }
  assertTrialState(false);
  const trialState = JSON.stringify(runtimeState);
  const beforeTrialCalls = simulationCalls.length;
  const beforeTrialDispatches = dispatchCalls.length;
  const trialEvent = { code: "KeyL", altKey: true, shiftKey: true, ctrlKey: false, metaKey: false,
    repeat: false, stopPropagation() {}, preventDefault() {} };
  for (const invalid of [{ repeat: true }, { altKey: false }, { shiftKey: false },
    { ctrlKey: true }, { metaKey: true }, { isComposing: true }, { code: "KeyK" }]) {
    trialKey({ ...trialEvent, ...invalid });
  }
  assert.deepEqual(simulationCalls[1].trials, [], "Only the deliberate trial shortcut may switch styles");
  for (const tagName of ["SELECT", "INPUT", "TEXTAREA", "BUTTON"]) {
    binding(select, "@keydown")({ ...trialEvent, target: { tagName },
      preventDefault() { assert.fail("Other controls retain their native keyboard behavior"); } });
  }
  assert.deepEqual(simulationCalls[1].trials, [], "Only the trial button owns the shortcut, not its parent or sibling controls");
  for (const id of ["0", "thread-b", ""]) {
    changeYarn({ target: { value: id } });
    const selections = [...simulationCalls[1].selections];
    const selectedValue = () => JSON.stringify(binding(yarnSelect(simulationView()), ".value", 'id="simulation-yarn-select"'));
    const beforeValue = selectedValue();
    for (const [enable, disable] of [[trialClick, trialClick], [trialKey, trialKey],
      [trialKey, trialClick], [trialClick, trialKey]]) {
      enable(trialEvent);
      assertTrialState(true);
      disable(trialEvent);
      assertTrialState(false);
    }
    assert.deepEqual(simulationCalls[1].selections, selections, "Trial toggles cannot change the selected Yarn");
    assert.equal(selectedValue(), beforeValue, "The native selector's view value is preserved");
  }
  assert.equal(simulationCalls.length, beforeTrialCalls, "Click and keyboard toggles cannot regenerate");
  assert.equal(JSON.stringify(runtimeState), trialState,
    "Toggles preserve zoom, pan, flip, preview transform, Solver, project and material state");
  assert.equal(runtimeState.yarnLengthSolverResults, resultsBeforeSelection);
  dispatchCalls.slice(beforeTrialDispatches).forEach(action => assert.deepEqual(action, {},
    "Trial changes only request a view refresh, never solve or apply"));
  changeYarn({ target: { value: "thread-b" } });

  const unchangedSnapshot = simulationCalls[1].snapshot;
  runner.syncState(runtimeState, ["singleJerseyCamProgram"]);
  runner.syncState(runtimeState, ["needleArrangement"]);
  assert.equal(simulationCalls.length, 2, "Unchanged input values must reuse the shared calculation.");
  assert.equal(runnerModule.getCurrentSimulationSnapshots().machine, unchangedSnapshot);
  for (const displayChange of ["simPan", "simPreviewPan", "simPreviewScale", "flipped"]) {
    runner.syncState(runtimeState, [displayChange]);
    assert.equal(simulationCalls.length, 2,
      `${displayChange} only changes display transform/layers, without recomputing.`);
  }

  // Case H: a user-reachable mismatch is contained after the base preview.
  const mismatchArrangement = deepFreeze([1, 2, 2, 3, 4, 4]);
  const threeTrackSnapshot = JSON.stringify(threeTrackProgram);
  const mismatchArrangementSnapshot = JSON.stringify(mismatchArrangement);
  Object.assign(runtimeState, {
    needleArrangement: mismatchArrangement,
    singleJerseyCamProgram: threeTrackProgram,
  });
  assert.doesNotThrow(() =>
    runner.syncState(runtimeState, ["singleJerseyCamProgram"])
  );
  assert.equal(simulationCalls.length, 2, "An invalid Machine does not recompute the unchanged Pattern.");
  assert.equal(simulationCalls[1].stopCount, 1, "Invalid execution disposes the machine renderer.");
  assert.deepEqual(clearedCanvasIDs.slice(-3), [
    "back-arranged",
    "mid-arranged",
    "front-arranged",
  ]);
  assert.equal(machineExecutionErrorElement.hidden, false);
  assert.equal(machineExecutionErrorElement.textContent, mismatchMessage);
  assert.ok(!JSON.stringify(simulationView()).includes("Assigned elastic"),
    "A failed machine preview must not expose stale Yarn choices.");
  assert.equal(runtimeState.singleJerseyCamProgram, threeTrackProgram);
  assert.equal(runtimeState.needleArrangement, mismatchArrangement);
  assert.equal(JSON.stringify(threeTrackProgram), threeTrackSnapshot);
  assert.equal(
    JSON.stringify(mismatchArrangement),
    mismatchArrangementSnapshot
  );

  // Case I: expanding the Cam to cover Type 4 clears the error and reruns.
  Object.assign(runtimeState, { singleJerseyCamProgram: fourByFourProgram });
  runner.syncState(runtimeState, ["singleJerseyCamProgram"]);
  assert.equal(simulationCalls.length, 3);
  assert.equal(simulationCalls[2].options.scope, "machine");
  assert.deepEqual(simulationCalls[2].pattern.make2d(), caseC.make2d());
  assert.equal(binding(yarnSelect(simulationView()), ".selected", '<option value=""'), true,
    "A failed preview clears the obsolete selection before recovery.");
  assert.equal(machineExecutionErrorElement.hidden, true);
  assert.equal(machineExecutionErrorElement.textContent, "");

  // Case J: withdrawing the arrangement clears the mismatch without fallback.
  Object.assign(runtimeState, { singleJerseyCamProgram: threeTrackProgram });
  runner.syncState(runtimeState, ["singleJerseyCamProgram"]);
  assert.equal(simulationCalls.length, 3);
  assert.equal(simulationCalls[2].stopCount, 1);
  assert.equal(machineExecutionErrorElement.textContent, mismatchMessage);
  Object.assign(runtimeState, { needleArrangement: [] });
  runner.syncState(runtimeState, ["needleArrangement"]);
  assert.equal(simulationCalls.length, 3);
  assert.equal(runnerModule.getCurrentSimulationSnapshots().machine, null);
  assert.equal(runnerModule.getCurrentSimulationSnapshots().pattern, simulationCalls[0].snapshot);
  assert.equal(machineExecutionErrorElement.hidden, true);
  assert.equal(machineExecutionErrorElement.textContent, "");

  // Case K: deleting the Cam clears the mismatch without creating a fallback.
  Object.assign(runtimeState, {
    needleArrangement: mismatchArrangement,
    singleJerseyCamProgram: threeTrackProgram,
  });
  runner.syncState(runtimeState, [
    "needleArrangement",
    "singleJerseyCamProgram",
  ]);
  assert.equal(simulationCalls.length, 3);
  assert.equal(machineExecutionErrorElement.textContent, mismatchMessage);
  Object.assign(runtimeState, { singleJerseyCamProgram: null });
  runner.syncState(runtimeState, ["singleJerseyCamProgram"]);
  assert.equal(simulationCalls.length, 3);
  assert.equal(runnerModule.getCurrentSimulationSnapshots().machine, null);
  assert.equal(runnerModule.getCurrentSimulationSnapshots().pattern, simulationCalls[0].snapshot);
  assert.equal(machineExecutionErrorElement.hidden, true);
  assert.equal(machineExecutionErrorElement.textContent, "");

  Object.assign(runtimeState, {
    chart: { width: 0, height: 8 },
    needleArrangement: mismatchArrangement,
    singleJerseyCamProgram: fourByFourProgram,
  });
  assert.throws(
    () => runner.syncState(runtimeState, ["chart"]),
    (error) =>
      error instanceof RangeError &&
      error.message === "width must be a positive integer."
  );
  assert.equal(simulationCalls.length, 4);
  assert.equal(simulationCalls[3].options.scope, "pattern");
  assert.equal(machineExecutionErrorElement.hidden, true);
  assert.equal(machineExecutionErrorElement.textContent, "");

  stopSimulation();
  assert.equal(simulationCalls[0].stopCount, 1, "Stopping disposes the surviving Pattern renderer.");

  // Removing an Assignment falls back to All without borrowing a Legacy identity.
  Object.assign(runtimeState, {
    chart,
    needleArrangement: arrangement,
    singleJerseyCamProgram: { ...fourByFourProgram, feeds: previewFeeds },
  });
  runner = runSimulation()({ state: runtimeState });
  binding(yarnSelect(simulationView()), "@change", 'id="simulation-yarn-select"')({ target: { value: "thread-b" } });
  runtimeState.singleJerseyCamProgram = { ...fourByFourProgram,
    feeds: previewFeeds.map(feed => ({ yarns: [feed.yarns[0]] })) };
  runner.syncState(runtimeState, ["singleJerseyCamProgram"]);
  const singleView = simulationView();
  assert.ok(!JSON.stringify(singleView).includes("Assigned elastic"));
  assert.ok(JSON.stringify(singleView).includes("Assigned cotton"));
  assert.equal(binding(yarnSelect(singleView), ".selected", '<option value=""'), true,
    "A removed Yarn ID falls back to All in the displayed selector.");
  // Exercise Lit's actual property cache after a native selection, with the
  // same option count/index reused for a replacement Yarn ID. No DOM library.
  const PropertyPart = _$LH._PropertyPart;
  const selectElement = { tagName: "SELECT", value: "" };
  const selectPart = new PropertyPart(selectElement, "value", ["", ""], { _$isConnected: true }, {});
  const initialValue = binding(select, ".value", 'id="simulation-yarn-select"');
  const fallbackValue = binding(yarnSelect(singleView), ".value", 'id="simulation-yarn-select"');
  selectPart._$setValue(initialValue ?? "");
  selectElement.value = "replacement-yarn";
  selectPart._$setValue(fallbackValue ?? "");
  assert.equal(selectElement.value, "",
    "All must be reflected in the live select after a native choice and same-slot Yarn replacement.");
  const singlePreview = simulationCalls.at(-1);
  const countBeforeSingleView = simulationCalls.length;
  binding(yarnSelect(singleView), "@change", 'id="simulation-yarn-select"')({ target: { value: "0" } });
  assert.deepEqual(singlePreview.selections, ["0"]);
  assert.equal(simulationCalls.length, countBeforeSingleView);
  stopSimulation();
} finally {
  await server.close();
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
  if (originalSimulateStub === undefined) {
    delete globalThis.__singleJerseySimulateStub;
    delete globalThis.__singleJerseyRenderer;
  } else {
    globalThis.__singleJerseySimulateStub = originalSimulateStub;
  }
  if (originalRunnerState === undefined) {
    delete globalThis.__singleJerseyRunnerState;
  } else {
    globalThis.__singleJerseyRunnerState = originalRunnerState;
  }
  if (originalDispatchStub === undefined) {
    delete globalThis.__singleJerseyDispatchStub;
  } else {
    globalThis.__singleJerseyDispatchStub = originalDispatchStub;
  }
}

const integrationSource = fs.readFileSync(integrationPath, "utf8");
const runSimulationSource = fs.readFileSync(runSimulationPath, "utf8");
const stateSource = fs.readFileSync("src/state.js", "utf8");
const coordinatorSource = fs.readFileSync("src/components/simulationCoordinator.js", "utf8");
const hostSource = fs.readFileSync("src/components/simulationPreviewHost.js", "utf8");

assert.match(
  integrationSource,
  /import\s+\{\s*resolveSingleJerseyOperations\s*\}\s+from\s+"\.\.\/domain\/singleJerseyMachine\.js"/
);
assert.match(
  integrationSource,
  /import\s+\{\s*createSingleJerseySimulationInput\s*\}\s+from\s+"\.\.\/adapters\/singleJerseySimulationInput\.js"/
);
assert.match(
  integrationSource,
  /camProgram\s*===\s*null\s*\|\|\s*needleArrangement\.length\s*===\s*0/
);
assert.match(
  integrationSource,
  /resolveSingleJerseyOperations\([\s\S]*camProgram,[\s\S]*needleArrangement,[\s\S]*outputWidth,[\s\S]*outputFeeds[\s\S]*\)/
);
assert.match(
  integrationSource,
  /createSingleJerseySimulationInput\(machineOperations\)/
);
for (const forbiddenTerm of [
  "GLOBAL_STATE",
  "document",
  "window",
  "repeats",
  "bitmap",
  "arrangedChart",
  "needleExecution",
  "Three",
]) {
  assert.equal(
    integrationSource.includes(forbiddenTerm),
    false,
    `execution integration helper must not depend on ${forbiddenTerm}.`
  );
}

assert.match(coordinatorSource, /import\s+\{\s*createSingleJerseyExecutionInput\s*\}\s+from\s+"\.\/singleJerseyExecutionInput\.js"/);
assert.match(coordinatorSource, /pattern:\s*state\.chart,\s*scope:\s*"pattern"/);
assert.match(coordinatorSource, /pattern:\s*machineInput,[\s\S]*scope:\s*"machine"/);
assert.equal((coordinatorSource.match(/computeYarnSimulation\(/g) || []).length, 2,
  "Pattern and machine each have one guarded shared-computation entry.");
assert.match(coordinatorSource, /createSingleJerseyExecutionInput\(state\.singleJerseyCamProgram,\s*state\.needleArrangement,\s*state\.chart\.width,\s*state\.chart\.height\)/);
assert.match(coordinatorSource, /machineInput === null \? null/);
assert.match(hostSource, /if \(!snapshot\) \{ release\(name\); return; \}/,
  "Unavailable Machine scenes dispose and clear their stale renderer.");
assert.match(hostSource, /pattern: \{ container: "sim-before-container", ids: \["back", "mid", "front"\]/);
assert.match(hostSource, /machine: \{ container: "sim-after-container", ids: \["back-arranged", "mid-arranged", "front-arranged"\]/);
assert.doesNotMatch(runSimulationSource, /\bsimulate\(/);
assert.match(runSimulationSource, /id="machine-execution-error"/);
assert.match(runSimulationSource, /role="alert"/);
const machineExecutionErrorTemplate = runSimulationSource.match(
  /<div\s+id="machine-execution-error"[\s\S]*?<\/div>/
)?.[0];
assert.ok(
  machineExecutionErrorTemplate,
  "the machine execution error must be rendered as a dedicated DOM-owned container."
);
assert.match(machineExecutionErrorTemplate, /aria-live="polite"/);
assert.doesNotMatch(
  machineExecutionErrorTemplate,
  /\$\{/,
  "Lit must not own child content inside the imperative machine error container."
);
assert.match(
  runSimulationSource,
  /function setMachineExecutionError\(message\)[\s\S]*?document\.getElementById\("machine-execution-error"\)[\s\S]*?errorElement\.hidden\s*=\s*message\s*===\s*null;[\s\S]*?errorElement\.textContent\s*=\s*message\s*\?\?\s*"";/,
  "setMachineExecutionError must remain the sole content owner for the machine error container."
);
assert.match(coordinatorSource, /catch\s*\(error\)/);
assert.match(coordinatorSource, /throw error;/);
assert.match(runSimulationSource, /"needleArrangement"/);
assert.match(runSimulationSource, /"singleJerseyCamProgram"/);
assert.doesNotMatch(
  runSimulationSource,
  /simulate\(\s*(?:GLOBAL_STATE\.chart|baseSimulation),[\s\S]*?containerId:\s*"sim-after-container"/
);
for (const rejectedTerm of [
  "arrangedChart",
  "needleExecution",
  "repeats[0]",
]) {
  assert.equal(runSimulationSource.includes(rejectedTerm), false);
}
assert.doesNotMatch(
  stateSource,
  /machineOperations\s*:|machineSimulationInput\s*:|machineExecutionError\s*:/
);

const packageJSON = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(
  packageJSON.scripts["validate:single-jersey-execution-integration"],
  "node scripts/validate-single-jersey-execution-integration.mjs"
);

console.log(
  "PASS: Single Jersey Cam Program and Needle Arrangement drive only the post-arrangement simulation preview."
);
