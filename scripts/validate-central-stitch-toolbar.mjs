import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

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
  const contents = fs.readFileSync(path.join(root, file));
  const actualHash = crypto.createHash("sha256").update(contents).digest("hex");
  if (actualHash !== expectedHash) {
    failures.push(`${file} changed; the four original stitch icons must remain byte-for-byte identical.`);
  }
}

const taskbar = read("src/views/taskbar.js");
const leftBar = read("src/views/leftBar.js");
const view = read("src/views/view.js");
const toolbarPath = path.join(root, "src/views/chartEditorToolbar.js");
const toolbar = fs.existsSync(toolbarPath) ? read("src/views/chartEditorToolbar.js") : "";
const styles = read("styles.css");
const translations = read("src/i18n/translations.js");
const state = read("src/state.js");
const repeatTools = read("src/views/repeatTools.js");
const repeatPointer = read("src/events/repeatPointerInteraction.js");
const repeatTouch = read("src/events/repeatTouchInteraction.js");

if (!view.includes("chartEditorToolbar")) {
  failures.push("the chart workspace must render the central stitch editor toolbar.");
}
if (!toolbar.includes("SYMBOL_ICON_URLS") || !toolbar.includes("applySelectedSymbol")) {
  failures.push("the central toolbar must use the original symbol assets and existing stitch action.");
}
for (const asset of ["knit.svg", "purl.svg", "slip.svg", "tuck.svg"]) {
  if (!toolbar.includes(asset)) {
    failures.push(`the central toolbar must import the original ${asset} asset.`);
  }
}
for (const key of ["taskbar.width", "taskbar.height", "stitch.symbol"]) {
  if (!toolbar.includes(`data-code-guide-key=\"${key}\"`)) {
    failures.push(`the central toolbar is missing ${key}.`);
  }
}
if (taskbar.includes("chart-size-controls") || taskbar.includes("resizeChartArea")) {
  failures.push("Width and Height controls must no longer live in the global taskbar.");
}
if (leftBar.includes("symbolPicker") || leftBar.includes("SYMBOL_ICON_URLS")) {
  failures.push("the stitch picker must no longer live in the left sidebar.");
}
if (!view.includes("chart-workspace")) {
  failures.push("the chart toolbar, repeat toolbar, canvas and zoom controls must share one central workspace.");
}
if (!styles.includes("--preview-background: #4a5055")) {
  failures.push("the yarn preview must use the approved darker #4A5055 background token.");
}
if (!styles.includes("--accent: #a96882")) {
  failures.push("the redesigned interface must use the approved #A96882 accent.");
}
for (const token of ["--app-background", "--panel-background", "--toolbar-background"]) {
  if (!new RegExp(`${token}:\\s*#4a5055`).test(styles)) {
    failures.push(`${token} must match the darker preview background.`);
  }
}
for (const label of ['"taskbar.width": "画布长"', '"taskbar.height": "画布高"']) {
  if (!translations.includes(label)) {
    failures.push(`Simplified Chinese canvas label missing: ${label}.`);
  }
}
if (!/activeTool:\s*null/.test(state)) {
  failures.push("the repeat brush must start unselected so its default button is white.");
}
if (!/editingRepeat:\s*-1,\s*activeTool:\s*null/s.test(repeatTools)) {
  failures.push("exiting repeat editing must clear the dark brush selection.");
}
if (!styles.includes("#chart-workspace > .tool-picker .btn.solid")) {
  failures.push("repeat toolbar buttons must define an explicit white default state.");
}
if (!styles.includes("background: var(--taskbar-background)")) {
  failures.push("the selected repeat brush must use the dark taskbar background.");
}
if (!/activeTool:\s*GLOBAL_STATE\.activeTool\s*==\s*toolName\s*\?\s*null\s*:\s*toolName/s.test(repeatTools)) {
  failures.push("clicking the selected repeat brush must toggle editing back off.");
}
for (const [file, source] of [
  ["src/events/repeatPointerInteraction.js", repeatPointer],
  ["src/events/repeatTouchInteraction.js", repeatTouch],
]) {
  if (/repeatEditingTools\[activeTool\]\s*\|\|\s*repeatEditingTools\.brush/.test(source)) {
    failures.push(`${file} must not silently enable the brush while editing is off.`);
  }
  if (!/const editTool = repeatEditingTools\[activeTool\];\s*if \(!editTool\) return;/s.test(source)) {
    failures.push(`${file} must ignore edit gestures until the brush is enabled.`);
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}

console.log("PASS: central stitch toolbar and original stitch icons are protected.");
