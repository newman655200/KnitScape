import assert from "node:assert/strict";
import { createServer } from "vite";

globalThis.Path2D = class {};
globalThis.devicePixelRatio = 2;

class ContextDouble {
  constructor() {
    this.operations = [];
    this.resetState();
  }

  resetState() {
    this.fillStyle = "#000000";
    this.strokeStyle = "#000000";
    this.lineWidth = 1;
    this.transform = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
    this.stack = [];
  }

  resetTransform() {
    this.transform = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
  }
  clearRect() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  translate(x, y) {
    this.transform.x += x * this.transform.scaleX;
    this.transform.y += y * this.transform.scaleY;
  }
  scale(scaleX, scaleY) {
    this.transform.scaleX *= scaleX;
    this.transform.scaleY *= scaleY;
  }
  save() {
    this.stack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      transform: { ...this.transform },
    });
  }
  restore() {
    const saved = this.stack.pop();
    Object.assign(this, saved);
  }
  fillRect(x, y, width, height) {
    this.operations.push({
      type: "fill",
      color: this.fillStyle,
      x: this.transform.x + x * this.transform.scaleX,
      y: this.transform.y + y * this.transform.scaleY,
      width: width * this.transform.scaleX,
      height: height * this.transform.scaleY,
    });
  }
  stroke(path) {
    this.operations.push({
      type: "stroke",
      color: this.strokeStyle,
      lineWidth: this.lineWidth,
      path,
      x: this.transform.x,
      y: this.transform.y,
    });
  }
}

class CanvasDouble {
  constructor() {
    this.context = new ContextDouble();
    this.style = {};
    this.sizeWrites = 0;
    this._width = 0;
    this._height = 0;
  }
  get width() { return this._width; }
  set width(value) {
    this._width = value;
    this.sizeWrites++;
    this.context.resetState();
  }
  get height() { return this._height; }
  set height(value) {
    this._height = value;
    this.sizeWrites++;
    this.context.resetState();
  }
  getContext(kind) {
    assert.equal(kind, "2d");
    return this.context;
  }
}

function cell(canvas, type, x, y) {
  return canvas.context.operations.find(
    (operation) => operation.type === type && operation.x === x && operation.y === y
  );
}

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { Bimp } = await server.ssrLoadModule("/src/lib/Bimp.js");
  const { SYMBOL_PATHS } = await server.ssrLoadModule("/src/constants.js");
  const { tileUnitToCanvas } = await server.ssrLoadModule("/src/patternDerivation.js");
  const { drawBitmapEditor } = await server.ssrLoadModule("/src/components/drawBitmapEditor.js");
  const canvases = Array.from({ length: 5 }, () => new CanvasDouble());
  const [fullSymbols, fullGrid, unitSymbols, unitGrid, interaction] = canvases;
  const unit = new Bimp(2, 2, [0, 1, 2, 3]);
  const full = tileUnitToCanvas(5, 4, unit);
  const state = {
    camBitmap: full,
    camUnitBitmap: unit,
    scale: 20,
    symbolMap: ["knit", "purl", "slip", "tuck"],
    symbolLineWidth: 3,
    grid: true,
  };

  const component = drawBitmapEditor({
    fullField: "camBitmap",
    unitField: "camUnitBitmap",
    fullSymbolCanvas: fullSymbols,
    fullGridCanvas: fullGrid,
    unitSymbolCanvas: unitSymbols,
    unitGridCanvas: unitGrid,
    interactionCanvas: interaction,
  })({ state });

  assert.deepEqual([fullSymbols.width, fullSymbols.height], [100, 80]);
  assert.deepEqual([fullSymbols.style.width, fullSymbols.style.height], ["50px", "40px"]);
  assert.deepEqual([unitSymbols.width, unitSymbols.height], [40, 40]);
  assert.deepEqual([unitSymbols.style.width, unitSymbols.style.height], ["20px", "20px"]);

  assert.deepEqual(
    [cell(fullSymbols, "fill", 0, 0)?.color, cell(fullSymbols, "stroke", 0, 0)?.path],
    ["#f4f4f4", SYMBOL_PATHS.slip]
  );
  assert.deepEqual(
    [cell(fullSymbols, "fill", 0, 60)?.color, cell(fullSymbols, "stroke", 0, 60)?.path],
    ["#b9b9b9", SYMBOL_PATHS.knit]
  );
  assert.deepEqual(
    [cell(unitSymbols, "fill", 0, 0)?.color, cell(unitSymbols, "stroke", 0, 0)?.color],
    ["#f2f2f2", "#111111"]
  );
  assert.deepEqual(
    [cell(unitSymbols, "fill", 0, 20)?.color, cell(unitSymbols, "stroke", 0, 20)?.color],
    ["#050505", "#f7f7f7"]
  );

  const sizeWrites = canvases.map((canvas) => canvas.sizeWrites);
  const operationCounts = canvases.map((canvas) => canvas.context.operations.length);
  const editedUnit = unit.brush({ x: 0, y: 0 }, 2);
  const editedFull = tileUnitToCanvas(5, 4, editedUnit);
  component.syncState(
    { ...state, camBitmap: editedFull, camUnitBitmap: editedUnit },
    ["camBitmap", "camUnitBitmap"]
  );
  assert.deepEqual(canvases.map((canvas) => canvas.sizeWrites), sizeWrites);
  assert.ok(fullSymbols.context.operations.length > operationCounts[0]);
  assert.ok(unitSymbols.context.operations.length > operationCounts[2]);

  const afterEdit = canvases.map((canvas) => canvas.context.operations.length);
  component.syncState(
    { ...state, camBitmap: editedFull, camUnitBitmap: editedUnit, chartPan: { x: 8, y: 9 } },
    ["chartPan"]
  );
  assert.deepEqual(canvases.map((canvas) => canvas.context.operations.length), afterEdit);
} finally {
  await server.close();
}

console.log("PASS: gray full charts and black repeat units render with the correct orientation.");
