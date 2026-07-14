import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DEFAULT_MACHINE_GAUGE,
  cmPer100Loops,
  gaugeToNeedlePitchMm,
  normalizeMachineGauge,
} from "../src/simulation/yarnLengthMetrics.js";

const read = (file) => fs.readFileSync(file, "utf8");
const packageJSON = JSON.parse(read("package.json"));

assert.equal(
  packageJSON.scripts["validate:yarn-length-gauge"],
  "node --experimental-default-type=module scripts/validate-yarn-length-gauge.mjs"
);

assert.equal(DEFAULT_MACHINE_GAUGE, 32);
assert.equal(normalizeMachineGauge(64), 64);
assert.equal(normalizeMachineGauge("bad"), 32);
assert.ok(Math.abs(gaugeToNeedlePitchMm(32) - 0.79375) < 1e-6);
assert.ok(Math.abs(gaugeToNeedlePitchMm(64) - 0.396875) < 1e-6);
assert.ok(
  Math.abs(
    cmPer100Loops({
      totalPathLengthStitchUnits: 420,
      effectiveLoopCount: 84,
      gauge: 32,
    }) - 39.6875
  ) < 1e-6
);

const stateSource = read("src/state.js");
assert.match(stateSource, /machineGauge:\s*DEFAULT_MACHINE_GAUGE/);
assert.match(stateSource, /yarnLengthMetrics:\s*null/);

const simulationSource = read("src/simulation/yarnSimulation.js");
assert.match(simulationSource, /machineGauge/);
assert.match(
  simulationSource,
  /effectiveLoopCount:\s*pattern\.width\s*\*\s*pattern\.height/
);
assert.match(simulationSource, /X_PADDING/);
assert.match(simulationSource, /pointInEffectiveNeedles/);
assert.match(
  simulationSource,
  /stitchHeight\s*=\s*baseStitchHeight\s*\*\s*primaryLengthScaleY/
);

const runSimulationSource = read("src/components/runSimulation.js");
assert.match(runSimulationSource, /yarnLengthMetrics/);
assert.match(runSimulationSource, /machineGauge:\s*GLOBAL_STATE\.machineGauge/);

const leftBarSource = read("src/views/leftBar.js");
for (const token of [
  "machine.gauge",
  "machine.needlePitch",
  "yarnLength.current",
  "yarnLength.cmPer100",
]) {
  assert.match(leftBarSource, new RegExp(token));
}

const translationsSource = read("src/i18n/translations.js");
for (const token of [
  "machine.gauge",
  "machine.needlePitch",
  "yarnLength.current",
  "yarnLength.cmPer100",
]) {
  assert.match(translationsSource, new RegExp(`"${token}"`));
}

console.log("PASS: yarn length gauge readout is configured.");
