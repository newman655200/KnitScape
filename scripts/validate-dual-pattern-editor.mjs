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
assert.match(viewSource, /bitmapEditor\(\{\s*fullField:\s*"camBitmap",\s*unitField:\s*"camUnitBitmap",\s*prefix:\s*"cam"/);
assert.match(viewSource, /bitmapEditor\(\{\s*fullField:\s*"needleBitmap",\s*unitField:\s*"needleUnitBitmap",\s*prefix:\s*"needle"/);
assert.doesNotMatch(
  viewSource,
  /import\s*\{\s*needleArrangementControls\s*\}\s*from/
);
assert.doesNotMatch(viewSource, /\$\{needleArrangementControls\(\)\}/);
assert.match(viewSource, /showNeedleControls:\s*true/);
assert.doesNotMatch(viewSource, /repeatTools|repeatCanvas/);

assert.match(editorSource, /export function bitmapEditor\(/);
assert.match(editorSource, /data-unit-field=\$\{unitField\}/);
for (const suffix of ["unit-symbol-canvas", "unit-grid", "interaction-canvas"]) {
  assert.match(editorSource, new RegExp(`id="\\$\\{prefix\\}-${suffix}"`));
}
assert.doesNotMatch(editorSource, /yarn-color-canvas/);
assert.doesNotMatch(editorSource, /resizePatternBitmap|fitChart|type="number"|pattern-size-controls|taskbar\.width|taskbar\.height/);
assert.match(editorSource, /showNeedleControls\s*=\s*false/);
assert.match(editorSource, /showNeedleControls\s*\?\s*needleArrangementControls\(\)\s*:\s*nothing/);

assert.match(controlsSource, /GLOBAL_STATE\.needleInputs\.map\(/);
assert.match(controlsSource, /startNeedleArrangement/);
assert.match(controlsSource, /applyNeedleArrangement/);
assert.match(controlsSource, /updateNeedleInput/);
assert.doesNotMatch(controlsSource, /fitChart|startAndFitNeedleArrangement|applyAndFitNeedleArrangement/);
assert.match(controlsSource, /@click=\$\{startNeedleArrangement\}/);
assert.match(controlsSource, /@click=\$\{applyNeedleArrangement\}/);
assert.match(controlsSource, /aria-invalid/);

assert.equal((toolbarSource.match(/data-code-guide-key="stitch\.symbol"/g) || []).length, 1);
assert.match(toolbarSource, /chart-size-controls/);

for (const name of [
  "fullField",
  "unitField",
  "fullSymbolCanvas",
  "fullGridCanvas",
  "unitSymbolCanvas",
  "unitGridCanvas",
  "interactionCanvas",
]) {
  assert.match(rendererSource, new RegExp(`\\b${name}\\b`));
}
assert.match(interactionSource, /export function positionInEditableUnit\(/);
assert.match(interactionSource, /dataset\.unitField/);
assert.doesNotMatch(interactionSource, /dataset\.patternField|SOURCE_FIELDS/);

assert.match(
  indexSource,
  /Split\(\["#cam-editor-pane",\s*"#needle-editor-pane"\],\s*\{[\s\S]*?direction:\s*"vertical"/
);
assert.equal((indexSource.match(/drawBitmapEditor\(\{/g) || []).length, 2);
assert.equal((indexSource.match(/bitmapPointerInteraction\(/g) || []).length, 2);
for (const id of [
  "cam-unit-symbol-canvas",
  "cam-unit-grid",
  "needle-unit-symbol-canvas",
  "needle-unit-grid",
]) {
  assert.match(indexSource, new RegExp(`getElementById\\(\\s*"${id}"`));
}
assert.doesNotMatch(indexSource, /drawYarnColors|yarn-color-canvas/);

class MockContext {
  constructor() {
    this.operations = 0;
  }

  record() {
    this.operations += 1;
  }

  resetTransform() { this.record(); }
  clearRect() { this.record(); }
  translate() { this.record(); }
  save() { this.record(); }
  scale() { this.record(); }
  fillRect() { this.record(); }
  restore() { this.record(); }
  beginPath() { this.record(); }
  moveTo() { this.record(); }
  lineTo() { this.record(); }
  stroke() { this.record(); }
}

class MockCanvas {
  constructor() {
    this.context = new MockContext();
    this.style = {};
    this.sizeWrites = 0;
    this._width = 0;
    this._height = 0;
  }

  get width() { return this._width; }
  set width(value) { this._width = value; this.sizeWrites += 1; }
  get height() { return this._height; }
  set height(value) { this._height = value; this.sizeWrites += 1; }
  getContext() { return this.context; }
}

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { Bimp } = await server.ssrLoadModule("/src/lib/Bimp.js");
  const { tileUnitToCanvas } = await server.ssrLoadModule("/src/patternDerivation.js");
  const { drawBitmapEditor } = await server.ssrLoadModule(
    "/src/components/drawBitmapEditor.js"
  );
  const fullSymbolCanvas = new MockCanvas();
  const fullGridCanvas = new MockCanvas();
  const unitSymbolCanvas = new MockCanvas();
  const unitGridCanvas = new MockCanvas();
  const interactionCanvas = new MockCanvas();
  const canvases = [
    fullSymbolCanvas,
    fullGridCanvas,
    unitSymbolCanvas,
    unitGridCanvas,
    interactionCanvas,
  ];
  const unit = Bimp.empty(2, 2, 1);
  const full = tileUnitToCanvas(4, 4, unit);
  const initialState = {
    camBitmap: full,
    camUnitBitmap: unit,
    scale: 20,
    symbolMap: ["knit", "purl", "slip", "tuck"],
    symbolLineWidth: 3,
    grid: true,
    chartPan: { x: 0, y: 0 },
  };
  const component = drawBitmapEditor({
    fullField: "camBitmap",
    unitField: "camUnitBitmap",
    fullSymbolCanvas,
    fullGridCanvas,
    unitSymbolCanvas,
    unitGridCanvas,
    interactionCanvas,
  })({ state: initialState });
  const initialSizeWrites = canvases.map((canvas) => canvas.sizeWrites);
  const initialOperations = canvases.map((canvas) => canvas.context.operations);
  const editedUnit = unit.brush({ x: 0, y: 0 }, 2);
  const editedFull = tileUnitToCanvas(4, 4, editedUnit);

  component.syncState(
    { ...initialState, camBitmap: editedFull, camUnitBitmap: editedUnit },
    ["camUnitBitmap", "camBitmap", "patternEdit"]
  );
  assert.deepEqual(
    canvases.map((canvas) => canvas.sizeWrites),
    initialSizeWrites,
    "same-size unit edits do not resize any canvas"
  );
  assert.ok(fullSymbolCanvas.context.operations > initialOperations[0]);
  assert.ok(unitSymbolCanvas.context.operations > initialOperations[2]);

  const editedOperations = canvases.map((canvas) => canvas.context.operations);
  component.syncState(
    {
      ...initialState,
      camBitmap: editedFull,
      camUnitBitmap: editedUnit,
      chartPan: { x: 10, y: 20 },
    },
    ["chartPan"]
  );
  assert.deepEqual(
    canvases.map((canvas) => canvas.context.operations),
    editedOperations,
    "pan-only updates do not redraw bitmap canvases"
  );
} finally {
  await server.close();
}

console.log("PASS: reusable dual pattern editors render full and editable unit layers.");
