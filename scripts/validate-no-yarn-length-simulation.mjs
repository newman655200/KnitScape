import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const packageJSON = JSON.parse(read("package.json"));
const constants = read("src/constants.js");
const state = read("src/state.js");
const leftBar = [
  "src/views/leftBar.js",
  "src/views/yarnLengthReadout.js",
  "src/views/yarnPlyPanel.js",
  "src/views/yarnPicker.js",
]
  .map(read)
  .join("\n");
const importers = read("src/actions/importers.js");
const exporters = read("src/actions/exporters.js");
const runSimulation = read("src/components/runSimulation.js");
const simulation = [
  "src/simulation/yarnSimulation.js",
  "src/simulation/yarnPathGeometry.js",
  "src/simulation/drawYarnSimulation.js",
]
  .map(read)
  .join("\n");
const translations = read("src/i18n/translations.js");
const codeGuideDefinitions = read("src/codeGuide/codeGuideDefinitions.json");

assert.equal(
  packageJSON.scripts["validate:no-yarn-length-simulation"],
  "node scripts/validate-no-yarn-length-simulation.mjs"
);

for (const [source, pattern, message] of [
  [constants, /lengthScaleY:\s*1/, "yarn-length defaults must remain"],
  [
    leftBar,
    /data-code-guide-key="yarn\.ply-length"/,
    "yarn-length sliders must remain",
  ],
  [
    leftBar,
    /lengthScaleY:\s*Number\(e\.target\.value\)/,
    "slider writes must remain",
  ],
  [importers, /normalizeYarnPly/, "JSON import normalization must remain"],
  [
    exporters,
    /yarnPlies:\s*GLOBAL_STATE\.yarnPlies/,
    "JSON export persistence must remain",
  ],
  [
    codeGuideDefinitions,
    /"yarn\.ply-length"/,
    "parameter code-guide entry must remain",
  ],
]) {
  assert.match(source, pattern, message);
}

const forbiddenRuntimePatterns = [
  /yarnLengthSimulationRequestId/,
  /createYarnLengthSimulationSnapshotController/,
  /yarn-length-sim-action/,
  /simulation\.yarnLength/,
  /yarnLengthSimulationEnabled/,
  /captureYarnLengthGeometry/,
  /yarnLengthGeometrySnapshot/,
  /createLengthGeometryDescriptor/,
  /deformYarnCurveForLength/,
  /solveSagittaForTargetLength/,
];

for (const [name, source] of [
  ["state", state],
  ["runSimulation", runSimulation],
  ["simulation", simulation],
  ["translations", translations],
  ["codeGuideDefinitions", codeGuideDefinitions],
]) {
  for (const pattern of forbiddenRuntimePatterns) {
    assert.doesNotMatch(source, pattern, `${name} retains ${pattern}`);
  }
}

for (const obsoletePath of [
  "src/actions/yarnLengthSimulationSnapshot.js",
  "scripts/validate-yarn-length-simulation-toggle.mjs",
  "scripts/validate-yarn-length-scaling.mjs",
]) {
  assert.equal(fs.existsSync(obsoletePath), false, `remove ${obsoletePath}`);
}

assert.equal(packageJSON.scripts["validate:yarn-length-toggle"], undefined);
assert.equal(packageJSON.scripts["validate:yarn-length-scaling"], undefined);
assert.equal(
  packageJSON.scripts["validate:yarn-length-parameters"] !== undefined,
  true
);

console.log("PASS: yarn-length parameters remain without the removed simulation.");
