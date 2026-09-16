import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";
import { resolveSingleJerseyOperations } from "../src/domain/singleJerseyMachine.js";

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
const clearedCanvasIDs = [];
const machineExecutionErrorElement = {
  hidden: true,
  textContent: "",
};

const chart = { width: 12, height: 8 };
const runtimeState = {
  chart,
  needleArrangement: [1, 2, 2, 3, 4, 4],
  singleJerseyCamProgram: fourByFourProgram,
  yarnSequence: {},
  yarnPalette: [],
  simScale: 1,
  yarnPlies: [],
  machineGauge: 1,
  texturePerformanceMode: "solid",
  texturePreviewInteractionActive: false,
};

globalThis.__singleJerseyRunnerState = runtimeState;
globalThis.__singleJerseyDispatchStub = (action) => {
  Object.assign(runtimeState, action);
};
globalThis.__singleJerseySimulateStub = (pattern, ...args) => {
  const record = {
    pattern,
    options: args.at(-1),
    stopCount: 0,
  };
  simulationCalls.push(record);
  return {
    stopSim() {
      record.stopCount += 1;
    },
    yarnLengthMetrics: { source: pattern },
  };
};

const virtualModules = new Map([
  [
    "../simulation/yarnSimulation",
    {
      id: "\0single-jersey-simulate-stub",
      code: `export const simulate = (...args) =>
        globalThis.__singleJerseySimulateStub(...args);`,
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
          .endsWith("/src/components/runSimulation.js");
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
  globalThis.window = {
    clearTimeout() {},
    setTimeout(callback) {
      callback();
      return 1;
    },
  };
  globalThis.document = {
    getElementById(elementID) {
      if (elementID === "machine-execution-error") {
        return machineExecutionErrorElement;
      }
      return {
        width: 640,
        height: 480,
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
    },
  };
  const { runSimulation, stopSimulation } = runnerModule;
  const runner = runSimulation()({ state: runtimeState });

  assert.equal(simulationCalls.length, 2);
  assert.equal(simulationCalls[0].pattern, chart);
  assert.deepEqual(simulationCalls[0].options.target, {
    containerId: "sim-before-container",
    canvasIDs: ["back", "mid", "front"],
  });
  assert.deepEqual(simulationCalls[1].options.target, {
    containerId: "sim-after-container",
    canvasIDs: ["back-arranged", "mid-arranged", "front-arranged"],
  });
  assert.equal(simulationCalls[1].pattern.width, 12);
  assert.equal(simulationCalls[1].pattern.height, 8);
  assert.deepEqual(simulationCalls[1].pattern.make2d(), caseC.make2d());
  assert.deepEqual(clearedCanvasIDs, [
    "back-arranged",
    "mid-arranged",
    "front-arranged",
  ]);

  runner.syncState(runtimeState, ["singleJerseyCamProgram"]);
  assert.equal(simulationCalls.length, 4);
  assert.equal(simulationCalls[0].stopCount, 1);
  assert.equal(simulationCalls[1].stopCount, 1);

  runner.syncState(runtimeState, ["needleArrangement"]);
  assert.equal(simulationCalls.length, 6);
  assert.equal(simulationCalls[2].stopCount, 1);
  assert.equal(simulationCalls[3].stopCount, 1);

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
  assert.equal(simulationCalls.length, 7);
  assert.equal(
    simulationCalls[6].options.target.containerId,
    "sim-before-container"
  );
  assert.equal(simulationCalls[4].stopCount, 1);
  assert.equal(simulationCalls[5].stopCount, 1);
  assert.deepEqual(clearedCanvasIDs.slice(-3), [
    "back-arranged",
    "mid-arranged",
    "front-arranged",
  ]);
  assert.equal(machineExecutionErrorElement.hidden, false);
  assert.equal(machineExecutionErrorElement.textContent, mismatchMessage);
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
  assert.equal(simulationCalls.length, 9);
  assert.equal(
    simulationCalls[7].options.target.containerId,
    "sim-before-container"
  );
  assert.equal(
    simulationCalls[8].options.target.containerId,
    "sim-after-container"
  );
  assert.deepEqual(simulationCalls[8].pattern.make2d(), caseC.make2d());
  assert.equal(machineExecutionErrorElement.hidden, true);
  assert.equal(machineExecutionErrorElement.textContent, "");

  // Case J: withdrawing the arrangement clears the mismatch without fallback.
  Object.assign(runtimeState, { singleJerseyCamProgram: threeTrackProgram });
  runner.syncState(runtimeState, ["singleJerseyCamProgram"]);
  assert.equal(simulationCalls.length, 10);
  assert.equal(simulationCalls[7].stopCount, 1);
  assert.equal(simulationCalls[8].stopCount, 1);
  assert.equal(machineExecutionErrorElement.textContent, mismatchMessage);
  Object.assign(runtimeState, { needleArrangement: [] });
  runner.syncState(runtimeState, ["needleArrangement"]);
  assert.equal(simulationCalls.length, 11);
  assert.equal(
    simulationCalls[10].options.target.containerId,
    "sim-before-container"
  );
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
  assert.equal(simulationCalls.length, 12);
  assert.equal(machineExecutionErrorElement.textContent, mismatchMessage);
  Object.assign(runtimeState, { singleJerseyCamProgram: null });
  runner.syncState(runtimeState, ["singleJerseyCamProgram"]);
  assert.equal(simulationCalls.length, 13);
  assert.equal(
    simulationCalls[12].options.target.containerId,
    "sim-before-container"
  );
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
  assert.equal(simulationCalls.length, 14);
  assert.equal(
    simulationCalls[13].options.target.containerId,
    "sim-before-container"
  );
  assert.equal(machineExecutionErrorElement.hidden, true);
  assert.equal(machineExecutionErrorElement.textContent, "");

  stopSimulation();
  assert.equal(simulationCalls[13].stopCount, 1);
} finally {
  await server.close();
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
  if (originalSimulateStub === undefined) {
    delete globalThis.__singleJerseySimulateStub;
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

assert.match(
  runSimulationSource,
  /import\s+\{\s*createSingleJerseyExecutionInput,?\s*\}\s+from\s+"\.\/singleJerseyExecutionInput\.js"/
);
assert.match(
  runSimulationSource,
  /const baseSimulation = GLOBAL_STATE\.chart/
);
assert.equal(
  (runSimulationSource.match(/simulate\(\s*baseSimulation,/g) || []).length,
  1,
  "the before preview must continue to simulate GLOBAL_STATE.chart exactly once."
);
assert.equal(
  (runSimulationSource.match(/simulate\(\s*machineSimulationInput,/g) || [])
    .length,
  1,
  "the after preview must simulate only machine-derived input."
);
assert.match(
  runSimulationSource,
  /createSingleJerseyExecutionInput\(\s*GLOBAL_STATE\.singleJerseyCamProgram,\s*GLOBAL_STATE\.needleArrangement,\s*baseSimulation\.width,\s*baseSimulation\.height\s*\)/s
);
assert.match(
  runSimulationSource,
  /if\s*\(machineSimulationInput\s*===\s*null\)\s*return;/
);
assert.ok(
  runSimulationSource.indexOf(
    "clearSimulationCanvases(AFTER_SIMULATION_TARGET.canvasIDs);"
  ) < runSimulationSource.indexOf("createSingleJerseyExecutionInput("),
  "an unavailable or invalid machine preview must clear stale output before execution."
);
assert.match(runSimulationSource, /id="machine-execution-error"/);
assert.match(runSimulationSource, /role="alert"/);
assert.match(runSimulationSource, /catch\s*\(error\)/);
assert.match(runSimulationSource, /throw error;/);
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
  "node --experimental-default-type=module scripts/validate-single-jersey-execution-integration.mjs"
);

console.log(
  "PASS: Single Jersey Cam Program and Needle Arrangement drive only the post-arrangement simulation preview."
);
