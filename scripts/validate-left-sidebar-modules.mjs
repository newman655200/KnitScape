import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const exists = (file) => fs.existsSync(file);

for (const file of [
  "src/views/yarnLengthReadout.js",
  "src/views/yarnPlyPanel.js",
  "src/views/yarnPicker.js",
]) {
  assert.ok(exists(file), `${file} must exist.`);
}

const leftBar = read("src/views/leftBar.js");
assert.match(leftBar, /import \{ yarnPlyPanel \} from "\.\/yarnPlyPanel"/);
assert.match(leftBar, /import \{ yarnPicker \} from "\.\/yarnPicker"/);
assert.match(leftBar, /\$\{yarnPlyPanel\(\)\}\s*\$\{yarnPicker\(\)\}/);
assert.doesNotMatch(leftBar, /function motifLibrary/);
assert.doesNotMatch(leftBar, /function yarnScanTextureControls/);
assert.doesNotMatch(leftBar, /function yarnPicker/);
assert.doesNotMatch(leftBar, /jscolor/);
assert.doesNotMatch(leftBar, /\bLAYERS\b/);

const readout = read("src/views/yarnLengthReadout.js");
for (const key of [
  "machine.gauge",
  "machine.needle-pitch",
  "yarn.length-current",
]) {
  assert.match(readout, new RegExp(key.replace(".", "\\.")));
}

const plyPanel = read("src/views/yarnPlyPanel.js");
assert.match(
  plyPanel,
  /import \{ yarnLengthReadout \} from "\.\/yarnLengthReadout"/
);
for (const symbol of [
  "yarnPlyPanel",
  "yarnScanTextureControls",
  "importYarnScanTexture",
  "texturePerformanceControls",
]) {
  assert.match(plyPanel, new RegExp(symbol));
}
assert.doesNotMatch(
  plyPanel,
  /\$\{yarnScanTextureControls\(index, ply\)\}/,
  "the legacy scanned-yarn texture controls must not render in the main sidebar."
);

const picker = read("src/views/yarnPicker.js");
for (const symbol of ["yarnPicker", "deleteColor", "editColor"]) {
  assert.match(picker, new RegExp(symbol));
}

console.log("PASS: left sidebar modules have concrete owners.");
