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

for (const legacyField of [
  "chart",
  "repeats",
  "editingRepeat",
  "selectedChartCell",
  "selectedRepeatCell",
  "repeatLibrary",
  "showRepeatLibrary",
]) {
  assert.doesNotMatch(stateSource, new RegExp(`\\b${legacyField}\\s*:`));
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
assert.doesNotMatch(constantsSource, /"repeats"|toolData|LAYERS/);

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
assert.match(actionsSource, /resizeYarnSequenceToNeedleHeight\(/);

assert.match(importersSource, /deserializePattern\(/);
assert.match(importersSource, /camBitmap/);
assert.match(importersSource, /needleBitmap/);
assert.match(exportersSource, /serializePattern\(GLOBAL_STATE\)/);
assert.doesNotMatch(exportersSource, /GLOBAL_STATE\.repeats|GLOBAL_STATE\.chart/);
assert.match(punchcardSource, /GLOBAL_STATE\.needleBitmap/);
assert.doesNotMatch(punchcardSource, /GLOBAL_STATE\.repeats|GLOBAL_STATE\.chart/);
assert.match(downloadModalSource, /GLOBAL_STATE\.needleBitmap\.height/);

for (const obsoleteFile of [
  "src/components/generateChart.js",
  "src/components/drawRepeats.js",
  "src/components/drawSymbols.js",
  "src/components/drawGrid.js",
  "src/components/resizeCanvases.js",
  "src/components/drawRepeatLibrary.js",
  "src/views/repeatCanvas.js",
  "src/views/repeatTools.js",
  "src/actions/repeatDimensions.js",
  "src/actions/repeatEditingTools.js",
  "src/actions/selectedCell.js",
  "src/events/repeatPointerInteraction.js",
  "src/events/repeatTouchInteraction.js",
  "src/events/repeatLibraryDragInteraction.js",
  "src/events/desktopPointerPanZoom.js",
  "src/events/desktopTouchPanZoom.js",
]) {
  assert.equal(fs.existsSync(obsoleteFile), false, `remove ${obsoleteFile}`);
}

console.log("PASS: cam and needle state ownership is configured.");
