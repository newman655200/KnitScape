import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const viewSource = read("src/views/view.js");
const toolbarSource = read("src/views/chartEditorToolbar.js");
const editorSource = read("src/views/bitmapEditor.js");
const controlsSource = read("src/views/needleArrangementControls.js");
const rendererSource = read("src/components/drawBitmapEditor.js");
const interactionSource = read("src/events/bitmapPointerInteraction.js");
const indexSource = read("src/index.js");

assert.equal((viewSource.match(/chartEditorToolbar\(\)/g) || []).length, 1);
assert.match(viewSource, /bitmapEditor\(\{\s*field:\s*"camBitmap"/);
assert.match(viewSource, /bitmapEditor\(\{\s*field:\s*"needleBitmap"/);
assert.match(viewSource, /needleArrangementControls\(\)/);
assert.doesNotMatch(viewSource, /repeatTools|repeatCanvas/);

assert.match(editorSource, /export function bitmapEditor\(/);
assert.match(editorSource, /resizePatternBitmap\(field,/);
assert.match(editorSource, /data-pattern-field=/);
assert.match(editorSource, /type="number"/);
assert.match(editorSource, /min="1"/);
assert.match(editorSource, /max="500"/);

assert.match(controlsSource, /GLOBAL_STATE\.needleInputs\.map\(/);
assert.match(controlsSource, /startNeedleArrangement/);
assert.match(controlsSource, /applyNeedleArrangement/);
assert.match(controlsSource, /updateNeedleInput/);
assert.match(controlsSource, /fitChart\(\)/);
assert.match(controlsSource, /aria-invalid/);

assert.equal((toolbarSource.match(/data-code-guide-key="stitch\.symbol"/g) || []).length, 1);
assert.doesNotMatch(toolbarSource, /chart-size-controls|resizeChartArea/);

assert.match(rendererSource, /export function drawBitmapEditor\(/);
assert.match(rendererSource, /state\[field\]/);
assert.match(interactionSource, /export function bitmapPointerInteraction\(/);
assert.match(interactionSource, /dataset\.patternField/);
assert.match(interactionSource, /drawPatternLine\(/);

assert.match(
  indexSource,
  /Split\(\["#cam-editor-pane",\s*"#needle-editor-pane"\],\s*\{[\s\S]*?direction:\s*"vertical"/
);
assert.equal((indexSource.match(/drawBitmapEditor\(\{/g) || []).length, 2);
assert.equal((indexSource.match(/bitmapPointerInteraction\(/g) || []).length, 2);

console.log("PASS: reusable dual pattern editor is configured.");
