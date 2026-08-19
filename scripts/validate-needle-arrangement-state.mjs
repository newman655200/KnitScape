import assert from "node:assert/strict";
import fs from "node:fs";

const stateSource = fs.readFileSync("src/state.js", "utf8");
const constantsSource = fs.readFileSync("src/constants.js", "utf8");
const actionsSource = fs.readFileSync("src/actions/patternEditing.js", "utf8");

for (const field of [
  "camBitmap",
  "needleBitmap",
  "needleInputs",
  "appliedNeedleInputs",
  "needleInputErrors",
]) {
  assert.match(stateSource, new RegExp(`\\b${field}\\s*:`));
}

assert.match(stateSource, /cloneBitmap\(defaultCamBitmap\)/);

for (const snapshotField of [
  "camBitmap",
  "needleBitmap",
  "needleInputs",
  "appliedNeedleInputs",
]) {
  assert.match(constantsSource, new RegExp(`"${snapshotField}"`));
}

for (const action of [
  "resizePatternBitmap",
  "drawPatternLine",
  "startNeedleArrangement",
  "updateNeedleInput",
  "applyNeedleArrangement",
]) {
  assert.match(actionsSource, new RegExp(`export function ${action}\\(`));
}

assert.match(actionsSource, /validateNeedleInputs\(/);
assert.match(actionsSource, /buildNeedleBitmap\(/);
assert.match(actionsSource, /resizeYarnSequenceToChartHeight\(/);

console.log("PASS: cam and needle state ownership is configured.");
