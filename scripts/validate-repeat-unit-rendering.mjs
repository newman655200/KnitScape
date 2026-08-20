import assert from "node:assert/strict";
import { createServer } from "vite";

globalThis.Path2D = class {};
globalThis.devicePixelRatio = 2;

class CanvasContextDouble {
  constructor() {
    this.operations = [];
    this.resetDrawingState();
  }

  resetDrawingState() {
    this.fillStyle = "#000000";
    this.strokeStyle = "#000000";
    this.lineWidth = 1;
    this.transform = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
    this.stack = [];
  }

  resetTransform() {
    this.transform = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
    this.operations.push({ type: "resetTransform" });
  }

  clearRect(x, y, width, height) {
    this.operations.push({ type: "clearRect", x, y, width, height });
  }

  translate(x, y) {
    this.transform.x += x * this.transform.scaleX;
    this.transform.y += y * this.transform.scaleY;
    this.operations.push({ type: "translate", x, y });
  }

  save() {
    this.stack.push({
      transform: { ...this.transform },
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
    });
    this.operations.push({ type: "save" });
  }

  scale(scaleX, scaleY) {
    this.transform.scaleX *= scaleX;
    this.transform.scaleY *= scaleY;
    this.operations.push({ type: "scale", scaleX, scaleY });
  }

  fillRect(x, y, width, height) {
    this.operations.push({
      type: "fillRect",
      fillStyle: this.fillStyle,
      x: this.transform.x + x * this.transform.scaleX,
      y: this.transform.y + y * this.transform.scaleY,
      width: width * this.transform.scaleX,
      height: height * this.transform.scaleY,
    });
  }

  restore() {
    const state = this.stack.pop();
    this.transform = state.transform;
    this.fillStyle = state.fillStyle;
    this.strokeStyle = state.strokeStyle;
    this.lineWidth = state.lineWidth;
    this.operations.push({ type: "restore" });
  }

  beginPath() {
    this.operations.push({ type: "beginPath" });
  }

  moveTo(x, y) {
    this.operations.push({ type: "moveTo", x, y });
  }

  lineTo(x, y) {
    this.operations.push({ type: "lineTo", x, y });
  }

  stroke(path) {
    this.operations.push({
      type: "stroke",
      path,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      x: this.transform.x,
      y: this.transform.y,
      scaleX: this.transform.scaleX,
      scaleY: this.transform.scaleY,
    });
  }
}

class CanvasDouble {
  constructor() {
    this.context = new CanvasContextDouble();
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
    this.context.resetDrawingState();
  }

  get height() {
    return this._height;
  }

  set height(value) {
    this._height = value;
    this.sizeWrites += 1;
    this.context.resetDrawingState();
  }

  getContext(kind) {
    assert.equal(kind, "2d");
    return this.context;
  }
}

function fillOperations(canvas, start = 0) {
  return canvas.context.operations
    .slice(start)
    .filter(({ type }) => type === "fillRect");
}

function operationCount(canvases) {
  return canvases.map((canvas) => canvas.context.operations.length);
}

function operationAt(canvas, type, x, y) {
  return canvas.context.operations.find(
    (operation) =>
      operation.type === type && operation.x === x && operation.y === y
  );
}

function assertRenderedCell(canvas, { x, y, fillStyle, strokeStyle, path }) {
  const fill = operationAt(canvas, "fillRect", x, y);
  const stroke = operationAt(canvas, "stroke", x, y);
  assert.equal(fill?.fillStyle, fillStyle);
  assert.equal(stroke?.strokeStyle, strokeStyle);
  assert.equal(stroke?.path, path);
}

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { Bimp } = await server.ssrLoadModule("/src/lib/Bimp.js");
  const { SYMBOL_PATHS } = await server.ssrLoadModule("/src/constants.js");
  const { tileUnitToCanvas } = await server.ssrLoadModule(
    "/src/patternDerivation.js"
  );
  const { drawBitmapEditor } = await server.ssrLoadModule(
    "/src/components/drawBitmapEditor.js"
  );

  const fullSymbolCanvas = new CanvasDouble();
  const fullGridCanvas = new CanvasDouble();
  const unitSymbolCanvas = new CanvasDouble();
  const unitGridCanvas = new CanvasDouble();
  const interactionCanvas = new CanvasDouble();
  const canvases = [
    fullSymbolCanvas,
    fullGridCanvas,
    unitSymbolCanvas,
    unitGridCanvas,
    interactionCanvas,
  ];
  const unit = new Bimp(2, 2, [0, 1, 2, 3]);
  const full = tileUnitToCanvas(5, 4, unit);
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

  for (const canvas of [fullSymbolCanvas, fullGridCanvas, interactionCanvas]) {
    assert.deepEqual([canvas.width, canvas.height], [100, 80]);
    assert.deepEqual([canvas.style.width, canvas.style.height], ["50px", "40px"]);
  }
  for (const canvas of [unitSymbolCanvas, unitGridCanvas]) {
    assert.deepEqual([canvas.width, canvas.height], [40, 40]);
    assert.deepEqual([canvas.style.width, canvas.style.height], ["20px", "20px"]);
  }

  const fullFills = fillOperations(fullSymbolCanvas);
  const unitFills = fillOperations(unitSymbolCanvas);
  assert.equal(fullFills.length, full.width * full.height, "full layer fills every cell");
  assert.equal(unitFills.length, unit.width * unit.height, "unit layer fills every cell");
  assert.deepEqual(new Set(fullFills.map(({ fillStyle }) => fillStyle)), new Set(["#b9b9b9", "#f4f4f4"]));
  assert.deepEqual(new Set(unitFills.map(({ fillStyle }) => fillStyle)), new Set(["#050505", "#f2f2f2"]));
  assert.deepEqual(
    new Set(fullSymbolCanvas.context.operations.filter(({ type }) => type === "stroke").map(({ strokeStyle }) => strokeStyle)),
    new Set(["#2f3437"])
  );
  assert.deepEqual(
    new Set(unitSymbolCanvas.context.operations.filter(({ type }) => type === "stroke").map(({ strokeStyle }) => strokeStyle)),
    new Set(["#f7f7f7", "#111111"])
  );
  assert.equal(fullGridCanvas.context.operations.filter(({ type }) => type === "stroke").length, 1);
  assert.equal(unitGridCanvas.context.operations.filter(({ type }) => type === "stroke").length, 1);
  const fullGridStroke = fullGridCanvas.context.operations.find(
    ({ type }) => type === "stroke"
  );
  const unitGridStroke = unitGridCanvas.context.operations.find(
    ({ type }) => type === "stroke"
  );
  assert.deepEqual(
    [fullGridStroke.strokeStyle, fullGridStroke.lineWidth],
    ["#2f3437", 1]
  );
  assert.deepEqual(
    [unitGridStroke.strokeStyle, unitGridStroke.lineWidth],
    ["#2f3437", 1]
  );

  assertRenderedCell(fullSymbolCanvas, {
    x: 0,
    y: 0,
    fillStyle: "#f4f4f4",
    strokeStyle: "#2f3437",
    path: SYMBOL_PATHS.slip,
  });
  assertRenderedCell(fullSymbolCanvas, {
    x: 0,
    y: 60,
    fillStyle: "#b9b9b9",
    strokeStyle: "#2f3437",
    path: SYMBOL_PATHS.knit,
  });
  assertRenderedCell(unitSymbolCanvas, {
    x: 0,
    y: 0,
    fillStyle: "#f2f2f2",
    strokeStyle: "#111111",
    path: SYMBOL_PATHS.slip,
  });
  assertRenderedCell(unitSymbolCanvas, {
    x: 0,
    y: 20,
    fillStyle: "#050505",
    strokeStyle: "#f7f7f7",
    path: SYMBOL_PATHS.knit,
  });

  const initialSizeWrites = canvases.map((canvas) => canvas.sizeWrites);
  const beforeEditOps = operationCount(canvases);
  const editedUnit = unit.brush({ x: 0, y: 0 }, 2);
  const editedFull = tileUnitToCanvas(5, 4, editedUnit);
  component.syncState(
    { ...initialState, camBitmap: editedFull, camUnitBitmap: editedUnit },
    ["camUnitBitmap", "camBitmap", "patternEdit"]
  );
  assert.deepEqual(canvases.map((canvas) => canvas.sizeWrites), initialSizeWrites, "same-size edits never resize canvases");
  assert.ok(fullSymbolCanvas.context.operations.length > beforeEditOps[0], "unit edit redraws tiled full symbols");
  assert.ok(unitSymbolCanvas.context.operations.length > beforeEditOps[2], "unit edit redraws editable unit symbols");

  const beforePanOps = operationCount(canvases);
  component.syncState(
    { ...initialState, camBitmap: editedFull, camUnitBitmap: editedUnit, chartPan: { x: 8, y: 9 } },
    ["chartPan"]
  );
  assert.deepEqual(operationCount(canvases), beforePanOps, "pan-only state changes do not redraw");
  assert.deepEqual(canvases.map((canvas) => canvas.sizeWrites), initialSizeWrites, "pan-only state changes do not resize");

  const resizedUnit = new Bimp(1, 3, [0, 2, 1]);
  const sameGeometryFull = tileUnitToCanvas(5, 4, resizedUnit);
  const beforeUnitGeometryOps = operationCount(canvases);
  component.syncState(
    { ...initialState, camBitmap: sameGeometryFull, camUnitBitmap: resizedUnit },
    ["camUnitBitmap", "camBitmap"]
  );
  assert.deepEqual(
    [fullSymbolCanvas, fullGridCanvas, interactionCanvas].map((canvas) => canvas.sizeWrites),
    initialSizeWrites.slice(0, 2).concat(initialSizeWrites.slice(4)),
    "unit geometry does not resize full-size canvases"
  );
  assert.deepEqual([unitSymbolCanvas.width, unitSymbolCanvas.height], [20, 60]);
  assert.deepEqual([unitGridCanvas.width, unitGridCanvas.height], [20, 60]);
  assert.ok(fullSymbolCanvas.context.operations.length > beforeUnitGeometryOps[0], "unit geometry change redraws full result");
} finally {
  await server.close();
}

console.log("PASS: repeat units render as editable black overlays on gray tiled results.");
