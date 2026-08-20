// 作者：FEDZ_SuZhou_Liuchen
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const expectedIconHashes = {
  "src/assets/symbols/knit.svg":
    "9d4a80404ac5dc4c664cef37484116afdba383707c63fa5b0f5e57a771c147df",
  "src/assets/symbols/purl.svg":
    "6e5c9b8fb3d12d9083ff64c2599c55409c30313c8c239c3254b9121aaf3ceae6",
  "src/assets/symbols/slip.svg":
    "a4eaf85021f58ec6c666f8f523c3df786b78611fe2708379b3372f501adde769",
  "src/assets/symbols/tuck.svg":
    "d60a8e834c7a42f8534b25c55fc859269f36e4777a48963878357cdc418618ca",
};

for (const [file, expectedHash] of Object.entries(expectedIconHashes)) {
  const normalized = read(file).replace(/\r\n/g, "\n");
  const actualHash = crypto
    .createHash("sha256")
    .update(normalized, "utf8")
    .digest("hex");
  assert.equal(actualHash, expectedHash, `${file} must remain unchanged.`);
}

const toolbar = read("src/views/chartEditorToolbar.js");
const actions = read("src/actions/patternEditing.js");
const view = read("src/views/view.js");
const leftBar = read("src/views/leftBar.js");
const styles = read("styles.css");

assert.match(view, /chartEditorToolbar\(\)/);
assert.equal((toolbar.match(/data-code-guide-key="stitch\.symbol"/g) || []).length, 1);
assert.match(toolbar, /selectPatternSymbol\(index\)/);
assert.match(
  actions,
  /export function selectPatternSymbol[\s\S]*?activeSymbol:\s*symbolIndex,[\s\S]*?activeTool:\s*"brush"/
);
for (const asset of ["knit.svg", "purl.svg", "slip.svg", "tuck.svg"]) {
  assert.match(toolbar, new RegExp(asset.replace(".", "\\.")));
}
assert.match(toolbar, /import\s*\{[\s\S]*?resizePatternCanvas[\s\S]*?\}\s*from\s*["']\.\.\/actions\/patternEditing\.js["']/);
assert.match(toolbar, /function\s+commitDimension\s*\(\s*field\s*,\s*value\s*\)\s*\{[\s\S]*?resizePatternCanvas\([\s\S]*?GLOBAL_STATE\.canvasWidth[\s\S]*?GLOBAL_STATE\.canvasHeight/);
assert.match(toolbar, /class="chart-size-controls"/);
assert.equal((toolbar.match(/class="input pattern-dimension-input"/g) || []).length, 2);
for (const [field, label] of [
  ["width", "taskbar.width"],
  ["height", "taskbar.height"],
]) {
  assert.match(toolbar, new RegExp(`data-code-guide-key="canvas\\.${field}"`));
  assert.match(toolbar, new RegExp(`t\\("${label}", language\\)`));
  assert.match(
    toolbar,
    new RegExp(`commitDimension\\("${field}", event\\.target\\.value\\)`)
  );
}
assert.equal((toolbar.match(/type="number"/g) || []).length, 2);
assert.equal((toolbar.match(/min="5"/g) || []).length, 2);
assert.equal((toolbar.match(/max="500"/g) || []).length, 2);
assert.equal((toolbar.match(/step="1"/g) || []).length, 2);
assert.match(toolbar, /\.value=\$\{String\(GLOBAL_STATE\.canvasWidth\)\}/);
assert.match(toolbar, /\.value=\$\{String\(GLOBAL_STATE\.canvasHeight\)\}/);
assert.match(toolbar, /event\.key\s*===\s*["']Enter["'][\s\S]*?blur\(\)/);
const stitchButtonsEnd = toolbar.indexOf(
  "</div>",
  toolbar.indexOf("GLOBAL_STATE.symbolMap.map")
);
const sizeControlsStart = toolbar.indexOf('class="chart-size-controls"');
assert.ok(sizeControlsStart > toolbar.indexOf('class="chart-stitch-buttons"'));
assert.ok(sizeControlsStart > stitchButtonsEnd, "size controls must follow all stitch buttons");
assert.doesNotMatch(leftBar, /symbolPicker|SYMBOL_ICON_URLS|left\.addRepeat/);
assert.match(styles, /--preview-background:\s*#4a5055/);
assert.match(styles, /--accent:\s*#a96882/);
assert.match(styles, /\.chart-size-controls\s*\{[\s\S]*?display:\s*flex/);
assert.match(styles, /\.pattern-dimension-input\s*\{[\s\S]*?color:\s*#111/);
assert.match(styles, /\.pattern-dimension-input:focus[\s\S]*?color:\s*#111/);
assert.match(styles, /\.pattern-dimension-input:active[\s\S]*?color:\s*#111/);
assert.match(styles, /\.pattern-dimension-input:invalid[\s\S]*?color:\s*#111/);
assert.match(styles, /\.pattern-dimension-input::selection\s*\{[\s\S]*?color:\s*(?:#111|black)/);
assert.match(styles, /\.pattern-dimension-input\[type="number"\]\s*\{[\s\S]*?(?:-webkit-appearance:\s*auto|appearance:\s*auto)/);
assert.match(styles, /\.pattern-dimension-input\[type="number"\]::\-webkit-inner-spin-button,[\s\S]*?\.pattern-dimension-input\[type="number"\]::\-webkit-outer-spin-button\s*\{[\s\S]*?-webkit-appearance:\s*auto[\s\S]*?opacity:\s*1/);

console.log("PASS: the shared stitch toolbar and original icons are protected.");
