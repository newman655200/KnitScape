import assert from "node:assert/strict";
import fs from "node:fs";

const adapterPath = "src/adapters/singleJerseySimulationInput.js";
assert.ok(
  fs.existsSync(adapterPath),
  "single jersey simulation input adapter must exist."
);

const [{ createSingleJerseySimulationInput }, { Bimp }] = await Promise.all([
  import(`../${adapterPath}`),
  import("../src/lib/Bimp.js"),
]);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const caseAOperations = [["K", "T", "T", "M", "K", "K"]];
const caseA = createSingleJerseySimulationInput(caseAOperations);
assert.ok(caseA instanceof Bimp);
assert.equal(caseA.width, 6);
assert.equal(caseA.height, 1);
assert.deepEqual(caseA.make2d(), [[0, 3, 3, 2, 0, 0]]);

const caseBOperations = [
  ["K", "T", "T", "M", "K", "K"],
  ["T", "M", "M", "K", "M", "M"],
];
const caseBExpected = [
  [0, 3, 3, 2, 0, 0],
  [3, 2, 2, 0, 2, 2],
];
const caseB = createSingleJerseySimulationInput(caseBOperations);
assert.equal(caseB.width, 6);
assert.equal(caseB.height, 2);
assert.deepEqual(caseB.make2d(), caseBExpected);
caseBExpected.forEach((row, y) =>
  row.forEach((pixel, x) => assert.equal(caseB.pixel(x, y), pixel))
);

const caseCOperations = deepFreeze([
  ["K", "T", "T", "M", "K", "K", "K", "T", "T", "M", "K", "K"],
  ["T", "M", "M", "K", "M", "M", "T", "M", "M", "K", "M", "M"],
  ["M", "K", "K", "T", "T", "T", "M", "K", "K", "T", "T", "T"],
  ["K", "M", "M", "T", "K", "K", "K", "M", "M", "T", "K", "K"],
]);
const caseCExpected = [
  [0, 3, 3, 2, 0, 0, 0, 3, 3, 2, 0, 0],
  [3, 2, 2, 0, 2, 2, 3, 2, 2, 0, 2, 2],
  [2, 0, 0, 3, 3, 3, 2, 0, 0, 3, 3, 3],
  [0, 2, 2, 3, 0, 0, 0, 2, 2, 3, 0, 0],
];
const caseCBefore = JSON.stringify(caseCOperations);
const caseC = createSingleJerseySimulationInput(caseCOperations);
assert.equal(caseC.width, 12);
assert.equal(caseC.height, 4);
assert.deepEqual(caseC.make2d(), caseCExpected);
caseCExpected.forEach((row, feed) =>
  row.forEach((pixel, position) =>
    assert.equal(
      caseC.pixel(position, feed),
      pixel,
      `feed ${feed} must map to y=${feed}, position ${position} must map to x=${position}.`
    )
  )
);
assert.equal(JSON.stringify(caseCOperations), caseCBefore);

for (const invalidOperations of [
  [],
  [[]],
  [["K"], ["K", "T"]],
  [["P"]],
  [["X"]],
  null,
  [[null]],
]) {
  assert.throws(() => createSingleJerseySimulationInput(invalidOperations));
}

const adapterSource = fs.readFileSync(adapterPath, "utf8");
const machineSource = fs.readFileSync(
  "src/domain/singleJerseyMachine.js",
  "utf8"
);
const processSource = fs.readFileSync("src/simulation/ProcessModel.js", "utf8");
const yarnSource = fs.readFileSync("src/simulation/YarnModel.js", "utf8");
const stateSource = fs.readFileSync("src/state.js", "utf8");
const runSimulationSource = fs.readFileSync(
  "src/components/runSimulation.js",
  "utf8"
);
const executionIntegrationSource = fs.readFileSync(
  "src/components/singleJerseyExecutionInput.js",
  "utf8"
);

assert.match(adapterSource, /import\s+\{\s*Bimp\s*\}\s+from\s+"\.\.\/lib\/Bimp\.js"/);
assert.equal((adapterSource.match(/^\s*import\s/gm) || []).length, 1);
for (const forbiddenDependency of [
  "GLOBAL_STATE",
  "document",
  "window",
  "Canvas",
  "WebGL",
  "Three",
  "Repeat",
  "repeats[0]",
  "bitmap",
  "arrangedChart",
  "needleExecution",
]) {
  assert.equal(
    adapterSource.includes(forbiddenDependency),
    false,
    `simulation input adapter must not depend on ${forbiddenDependency}.`
  );
}

assert.doesNotMatch(machineSource, /simulation|adapters|Bimp/);
assert.doesNotMatch(processSource, /singleJerseyMachine|singleJerseySimulationInput/);
assert.doesNotMatch(yarnSource, /singleJerseyMachine|singleJerseySimulationInput/);
assert.match(stateSource, /singleJerseyCamProgram:\s*null/);
assert.equal(
  runSimulationSource.includes("singleJerseySimulationInput"),
  false,
  "runSimulation must not bypass the execution integration boundary."
);
assert.match(
  executionIntegrationSource,
  /import\s+\{\s*createSingleJerseySimulationInput\s*\}\s+from\s+"\.\.\/adapters\/singleJerseySimulationInput\.js"/,
  "the approved execution helper must consume the simulation adapter."
);
assert.match(
  runSimulationSource,
  /createSingleJerseyExecutionInput/,
  "the post-arrangement preview must consume adapter output through the approved helper."
);
assert.equal(
  fs.existsSync("src/simulation/needleExecution.js"),
  false,
  "the rejected needle execution module must remain absent."
);

const packageJSON = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(
  packageJSON.scripts["validate:single-jersey-simulation-input"],
  "node --experimental-default-type=module scripts/validate-single-jersey-simulation-input.mjs"
);

console.log(
  "PASS: machine feed rows map directly to simulation courses without transposition or flipping."
);
