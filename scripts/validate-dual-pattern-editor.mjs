import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

globalThis.Path2D = class {};
globalThis.devicePixelRatio = 1;

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
assert.doesNotMatch(
  viewSource,
  /import\s*\{\s*needleArrangementControls\s*\}\s*from/
);
assert.doesNotMatch(viewSource, /\$\{needleArrangementControls\(\)\}/);
assert.match(viewSource, /showNeedleControls:\s*true/);
assert.doesNotMatch(viewSource, /repeatTools|repeatCanvas/);

assert.match(editorSource, /export function bitmapEditor\(/);
assert.match(editorSource, /data-pattern-field=/);
assert.doesNotMatch(editorSource, /resizePatternBitmap|fitChart|type="number"|pattern-size-controls|taskbar\.width|taskbar\.height/);
assert.match(editorSource, /showNeedleControls\s*=\s*false/);
assert.match(editorSource, /showNeedleControls\s*\?\s*needleArrangementControls\(\)\s*:\s*nothing/);
assert.match(editorSource, /<header class="pattern-editor-header">[\s\S]*?<\/header>[\s\S]*?needleArrangementControls\(\)[\s\S]*?<div class="pattern-editor-viewport">/);

assert.match(controlsSource, /GLOBAL_STATE\.needleInputs\.map\(/);
assert.match(controlsSource, /startNeedleArrangement/);
assert.match(controlsSource, /applyNeedleArrangement/);
assert.match(controlsSource, /updateNeedleInput/);
assert.doesNotMatch(controlsSource, /fitChart|startAndFitNeedleArrangement|applyAndFitNeedleArrangement/);
assert.match(controlsSource, /@click=\$\{startNeedleArrangement\}/);
assert.match(controlsSource, /@click=\$\{applyNeedleArrangement\}/);
assert.match(controlsSource, /aria-invalid/);
assert.ok(
  controlsSource.indexOf('data-code-guide-key="needle.start"') <
    controlsSource.indexOf('class="needle-inputs"') &&
    controlsSource.indexOf('class="needle-inputs"') <
      controlsSource.indexOf('data-code-guide-key="needle.apply"'),
  "needle controls must render Start, inputs, Apply"
);

assert.equal((toolbarSource.match(/data-code-guide-key="stitch\.symbol"/g) || []).length, 1);
assert.match(toolbarSource, /chart-size-controls/);

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

class MockContext {
  constructor() {
    this.strokes = 0;
  }

  resetTransform() {}
  clearRect() {}
  translate() {}
  save() {}
  scale() {}
  fillRect() {}
  restore() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  stroke() {
    this.strokes += 1;
  }
}

class MockCanvas {
  constructor() {
    this.context = new MockContext();
    this.style = {};
    this.sizeWrites = 0;
    this._width = 0;
    this._height = 0;
  }

  get width() {
    return this._width;
  }

  set width(value) {
    this._width = value;
    this.sizeWrites += 1;
  }

  get height() {
    return this._height;
  }

  set height(value) {
    this._height = value;
    this.sizeWrites += 1;
  }

  getContext() {
    return this.context;
  }
}

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { Bimp } = await server.ssrLoadModule("/src/lib/Bimp.js");
  const { drawBitmapEditor } = await server.ssrLoadModule(
    "/src/components/drawBitmapEditor.js"
  );
  const symbolCanvas = new MockCanvas();
  const gridCanvas = new MockCanvas();
  const interactionCanvas = new MockCanvas();
  const initialBitmap = Bimp.empty(2, 2, 1);
  const initialState = {
    camBitmap: initialBitmap,
    scale: 20,
    symbolMap: ["knit", "purl", "slip", "tuck"],
    symbolLineWidth: 3,
    grid: true,
  };
  const component = drawBitmapEditor({
    field: "camBitmap",
    symbolCanvas,
    gridCanvas,
    interactionCanvas,
  })({ state: initialState });
  const initialSizeWrites = [symbolCanvas, gridCanvas, interactionCanvas]
    .reduce((sum, canvas) => sum + canvas.sizeWrites, 0);
  const initialStrokes = symbolCanvas.context.strokes;
  const startPos = { x: 0, y: 0 };
  const nextBitmap = initialBitmap.line(startPos, startPos, 0);

  component.syncState(
    {
      ...initialState,
      camBitmap: nextBitmap,
      patternEdit: { field: "camBitmap", startPos, endPos: startPos },
    },
    ["camBitmap", "patternEdit"]
  );

  assert.equal(
    [symbolCanvas, gridCanvas, interactionCanvas]
      .reduce((sum, canvas) => sum + canvas.sizeWrites, 0),
    initialSizeWrites,
    "drawing one cell must not resize the canvases"
  );
  assert.equal(
    symbolCanvas.context.strokes - initialStrokes,
    1,
    "drawing one cell must redraw only that cell"
  );
} finally {
  await server.close();
}

console.log("PASS: reusable dual pattern editor is configured.");
