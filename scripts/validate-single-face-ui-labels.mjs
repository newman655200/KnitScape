import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const styles = read("styles.css");
const translations = read("src/i18n/translations.js");
const taskbar = read("src/views/taskbar.js");
const toolbar = read("src/views/chartEditorToolbar.js");
const controls = read("src/views/needleArrangementControls.js");
const bitmapEditor = read("src/views/bitmapEditor.js");
const view = read("src/views/view.js");
const leftBar = [
  "src/views/leftBar.js",
  "src/views/yarnLengthReadout.js",
  "src/views/yarnPlyPanel.js",
  "src/views/yarnPicker.js",
].map(read).join("\n");

assert.match(styles, /Microsoft YaHei/);
assert.match(taskbar, /companyLogo/);
assert.match(taskbar, /t\("taskbar\.title"/);
assert.doesNotMatch(taskbar, /github|源码|branchwelder/i);

for (const [key, label] of [
  ["taskbar.undo", "撤销"],
  ["taskbar.new", "新建"],
  ["taskbar.import", "导入"],
  ["taskbar.export", "导出"],
  ["taskbar.library", "图库"],
  ["taskbar.settings", "设置"],
  ["taskbar.fullscreen", "全屏"],
  ["cam.title", "三角座排列"],
  ["needle.title", "排针排列"],
  ["needle.start", "开始排针"],
  ["needle.apply", "应用排针"],
]) {
  assert.match(translations, new RegExp(`"${key}": "${label}`));
}

for (const key of ["symbols.knit", "symbols.purl", "symbols.slip", "symbols.tuck"]) {
  assert.match(translations, new RegExp(`"${key.replace(".", "\\.")}"`));
}
assert.match(toolbar, /symbols\.\$\{symbolName\}/);
assert.match(toolbar, /SYMBOL_ICON_URLS/);
assert.match(toolbar, /<img[\s\S]*class="symbol-preview-image"/);
assert.doesNotMatch(toolbar, /<canvas\s+class="symbol-preview"/);

for (const key of [
  "needle.start",
  "needle.input",
  "needle.apply",
  "needle.error.",
]) {
  assert.match(controls, new RegExp(key.replaceAll(".", "\\.")));
}
assert.match(`${bitmapEditor}\n${view}`, /camBitmap/);
assert.match(`${bitmapEditor}\n${view}`, /needleBitmap/);
assert.match(bitmapEditor, /pattern-size-controls/);

assert.match(leftBar, /importYarnScanTexture/);
assert.match(leftBar, /yarn-texture-import-button/);
assert.match(leftBar, /yarn-texture-preview/);
assert.doesNotMatch(leftBar, /left\.addRepeat/);

for (const asset of ["knit", "purl", "slip", "tuck"]) {
  const file = `src/assets/symbols/${asset}.svg`;
  assert.equal(fs.existsSync(file), true, `${file} must exist.`);
  assert.doesNotMatch(read(file), /<text\b/);
}
assert.equal(fs.existsSync("src/assets/company-logo.jpg"), true);

const state = read("src/state.js");
const simulationView = read("src/components/runSimulation.js");
const simulationPointer = read("src/events/simulationPointerInteraction.js");
assert.doesNotMatch(`${state}\n${simulationView}\n${simulationPointer}`, /simRotation/);
assert.doesNotMatch(simulationView, /rotate[XY]\(|perspective|preserve-3d/);
assert.doesNotMatch(simulationPointer, /rotatePreview|RIGHT_BUTTON_MASK|contextmenu/);
assert.match(simulationPointer, /e\.button\s*!={1,2}\s*0/);
assert.match(simulationPointer, /pan\(e, simContainer\)/);

const constants = read("src/constants.js");
assert.match(constants, /DEFAULT_STITCH_SYMBOL = "purl"/);
assert.match(constants, /DEFAULT_STITCH_SYMBOL_INDEX/);
for (const signature of [
  "M 0.25 0.75 L 0.5 0.25 L 0.75 0.75",
  "M 0.25 0.25 L 0.5 0.75 L 0.75 0.25",
  "M 0.2 0.5 L 0.8 0.5",
  "M 0.25 0.25 L 0.75 0.25 L 0.75 0.75 L 0.25 0.75 Z",
]) {
  assert.match(constants, new RegExp(signature.replaceAll(".", "\\.")));
}

console.log("PASS: single-face UI labels and dual editor images are configured.");
