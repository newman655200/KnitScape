import assert from "node:assert/strict";
import fs from "node:fs";

const modulePath = "src/domain/singleJerseyMachine.js";
assert.ok(fs.existsSync(modulePath), "single jersey machine domain must exist.");

const { resolveSingleJerseyOperations } = await import(
  `../${modulePath}`
);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const arrangementCases = [
  [1, 2, 3, 4],
  [1, 2, 2, 3, 4, 4],
  [1, 1, 2, 2, 3, 3, 4, 4],
];
const singleFeedProgram = {
  tracks: [["K"], ["T"], ["M"], ["K"]],
};

for (const arrangement of arrangementCases) {
  const result = resolveSingleJerseyOperations(
    singleFeedProgram,
    arrangement,
    arrangement.length * 2,
    1
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].length, arrangement.length * 2);
}

const caseA = resolveSingleJerseyOperations(
  singleFeedProgram,
  [1, 2, 2, 3, 4, 4],
  12,
  1
);
assert.deepEqual(caseA, [
  ["K", "T", "T", "M", "K", "K", "K", "T", "T", "M", "K", "K"],
]);

const fourByFourProgram = deepFreeze({
  tracks: [
    ["K", "T", "M", "K"],
    ["T", "M", "K", "M"],
    ["M", "K", "T", "T"],
    ["K", "M", "T", "K"],
  ],
});
const caseBArrangement = deepFreeze([1, 2, 2, 3, 4, 4]);
const fourByFourSnapshot = JSON.stringify(fourByFourProgram);
const arrangementSnapshot = JSON.stringify(caseBArrangement);
const caseB = resolveSingleJerseyOperations(
  fourByFourProgram,
  caseBArrangement,
  12,
  6
);
assert.deepEqual(caseB, [
  ["K", "T", "T", "M", "K", "K", "K", "T", "T", "M", "K", "K"],
  ["T", "M", "M", "K", "M", "M", "T", "M", "M", "K", "M", "M"],
  ["M", "K", "K", "T", "T", "T", "M", "K", "K", "T", "T", "T"],
  ["K", "M", "M", "T", "K", "K", "K", "M", "M", "T", "K", "K"],
  ["K", "T", "T", "M", "K", "K", "K", "T", "T", "M", "K", "K"],
  ["T", "M", "M", "K", "M", "M", "T", "M", "M", "K", "M", "M"],
]);
assert.equal(JSON.stringify(fourByFourProgram), fourByFourSnapshot);
assert.equal(JSON.stringify(caseBArrangement), arrangementSnapshot);

assert.deepEqual(
  resolveSingleJerseyOperations(
    { tracks: [["K", "T"], ["T", "M"], ["M", "K"]] },
    [3, 1, 3, 2, 2],
    7,
    3
  ),
  [
    ["M", "K", "M", "T", "T", "M", "K"],
    ["K", "T", "K", "M", "M", "K", "T"],
    ["M", "K", "M", "T", "T", "M", "K"],
  ]
);

for (const invalidArrangement of [[], [0, 1], [-1, 1], [1, 2.5]]) {
  assert.throws(
    () =>
      resolveSingleJerseyOperations(
        singleFeedProgram,
        invalidArrangement,
        6,
        1
      ),
    /needleArrangement/
  );
}

assert.throws(
  () =>
    resolveSingleJerseyOperations(singleFeedProgram, [1, 5], 6, 1),
  /camProgram\.tracks/
);

for (const invalidOperation of ["P", "X", 0, null]) {
  assert.throws(
    () =>
      resolveSingleJerseyOperations(
        { tracks: [["K"], [invalidOperation]] },
        [1, 2],
        2,
        1
      ),
    /K, T, or M/
  );
}

for (const invalidProgram of [
  null,
  {},
  { tracks: [] },
  { tracks: [[]] },
  { tracks: [["K", "T"], ["M"]] },
]) {
  assert.throws(
    () => resolveSingleJerseyOperations(invalidProgram, [1], 1, 1),
    /camProgram/
  );
}

for (const [width, feeds] of [
  [0, 1],
  [-1, 1],
  [1, 0],
  [1, -1],
  [1.5, 1],
  [1, 1.5],
]) {
  assert.throws(
    () =>
      resolveSingleJerseyOperations(
        singleFeedProgram,
        [1, 2, 3, 4],
        width,
        feeds
      ),
    /width|feeds/
  );
}

const domainSource = fs.readFileSync(modulePath, "utf8");
assert.doesNotMatch(domainSource, /^\s*import\s/m);
for (const forbiddenDependency of [
  "Pattern",
  "Repeat",
  "bitmap",
  "GLOBAL_STATE",
  "document",
  "window",
  "Canvas",
  "WebGL",
  "Three",
  "needleExecution",
  "arrangedChart",
]) {
  assert.equal(
    domainSource.includes(forbiddenDependency),
    false,
    `machine domain must not depend on ${forbiddenDependency}.`
  );
}

const simulationSource = fs.readFileSync(
  "src/components/runSimulation.js",
  "utf8"
);
const executionIntegrationSource = fs.readFileSync(
  "src/components/singleJerseyExecutionInput.js",
  "utf8"
);
const coordinatorSource = fs.readFileSync("src/components/simulationCoordinator.js", "utf8");
const hostSource = fs.readFileSync("src/components/simulationPreviewHost.js", "utf8");
assert.equal(
  simulationSource.includes("singleJerseyMachine"),
  false,
  "runSimulation must not bypass the execution integration boundary."
);
assert.match(
  executionIntegrationSource,
  /import\s+\{\s*resolveSingleJerseyOperations\s*\}\s+from\s+"\.\.\/domain\/singleJerseyMachine\.js"/,
  "the approved execution helper must consume the Machine Domain."
);
assert.match(
  simulationSource,
  /import\s+\{\s*createSimulationCoordinator\s*\}\s+from\s+"\.\/simulationCoordinator\.js"/,
  "runSimulation must consume Machine Domain output through the shared coordinator."
);
assert.equal((simulationSource.match(/createSimulationCoordinator\(/g) || []).length, 1,
  "the app must create one computation coordinator.");
assert.match(coordinatorSource,
  /import\s+\{\s*createSingleJerseyExecutionInput\s*\}\s+from\s+"\.\/singleJerseyExecutionInput\.js"/,
  "the coordinator must use the approved execution helper.");
assert.equal((coordinatorSource.match(/createSingleJerseyExecutionInput\(/g) || []).length, 1,
  "the coordinator must have a single Machine Domain integration call.");
assert.doesNotMatch(coordinatorSource, /resolveSingleJerseyOperations|createSingleJerseySimulationInput|tracks\s*\[/,
  "the coordinator must not bypass or duplicate Machine Domain operation resolution.");
assert.doesNotMatch(
  simulationSource + hostSource,
  /createSingleJerseyExecutionInput|resolveSingleJerseyOperations|createSingleJerseySimulationInput|tracks\s*\[/,
  "runner and renderer host must not create a second machine execution path."
);

console.log(
  "PASS: Single Jersey Cam Program and Needle Arrangement resolve to independent K/T/M machine operations."
);
