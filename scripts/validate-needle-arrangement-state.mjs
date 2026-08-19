import assert from "node:assert/strict";
import fs from "node:fs";

const stateSource = fs.readFileSync("src/state.js", "utf8");
const constantsSource = fs.readFileSync("src/constants.js", "utf8");
const actionsSource = fs.readFileSync("src/actions/patternEditing.js", "utf8");
const importersSource = fs.readFileSync("src/actions/importers.js", "utf8");
const exportersSource = fs.readFileSync("src/actions/exporters.js", "utf8");
const punchcardSource = fs.readFileSync("src/punchcard.js", "utf8");
const downloadModalSource = fs.readFileSync("src/views/downloadModal.js", "utf8");

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

assert.match(importersSource, /deserializePattern\(/);
assert.match(importersSource, /camBitmap/);
assert.match(importersSource, /needleBitmap/);
assert.match(exportersSource, /serializePattern\(GLOBAL_STATE\)/);
assert.doesNotMatch(exportersSource, /GLOBAL_STATE\.repeats|GLOBAL_STATE\.chart/);
assert.match(punchcardSource, /GLOBAL_STATE\.needleBitmap/);
assert.doesNotMatch(punchcardSource, /GLOBAL_STATE\.repeats|GLOBAL_STATE\.chart/);
assert.match(downloadModalSource, /GLOBAL_STATE\.needleBitmap\.height/);

console.log("PASS: cam and needle state ownership is configured.");
