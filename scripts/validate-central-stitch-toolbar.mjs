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
assert.doesNotMatch(toolbar, /taskbar\.width|taskbar\.height/);
assert.doesNotMatch(leftBar, /symbolPicker|SYMBOL_ICON_URLS|left\.addRepeat/);
assert.match(styles, /--preview-background:\s*#4a5055/);
assert.match(styles, /--accent:\s*#a96882/);

console.log("PASS: the shared stitch toolbar and original icons are protected.");
