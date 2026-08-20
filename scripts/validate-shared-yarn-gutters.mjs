import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

const read = (file) => fs.readFileSync(file, "utf8");
const indexSource = read("src/index.js");
const editorSource = read("src/views/bitmapEditor.js");
globalThis.Path2D = class {};
globalThis.window = globalThis;

assert.match(indexSource, /getElementById\(\s*"cam-yarn-sequence-canvas"\s*\)/);
assert.match(indexSource, /getElementById\(\s*"needle-yarn-sequence-canvas"\s*\)/);
assert.match(
  indexSource,
  /const yarnSequenceCanvasElements\s*=\s*\[\s*camYarnSequenceCanvas\s*,\s*needleYarnSequenceCanvas\s*,?\s*\]/
);
assert.match(indexSource, /yarnSequenceCanvasElements\.forEach\(\s*colorSequencePointerInteraction\s*\)/);
assert.match(indexSource, /yarnSequenceCanvasElements\.forEach\(\s*colorSequenceTouchInteraction\s*\)/);
assert.equal((indexSource.match(/yarnSequenceCanvas\(\{ canvas:/g) || []).length, 2);
assert.match(editorSource, /data-code-guide-key="cam\.yarn-sequence"/);
assert.match(editorSource, /aria-label=/);

class EventTargetDouble {
  constructor(rect = { left: 20, top: 40, width: 10, height: 60 }) {
    this.rect = rect;
    this.style = {};
    this.listeners = new Map();
    this.captured = new Set();
  }

  addEventListener(type, callback) {
    this.listeners.set(type, [...(this.listeners.get(type) || []), callback]);
  }

  removeEventListener(type, callback) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== callback));
  }

  emit(type, properties = {}) {
    let prevented = 0;
    const event = {
      type,
      button: 0,
      pointerId: 1,
      isPrimary: true,
      clientX: this.rect.left + 1,
      clientY: this.rect.top + 1,
      preventDefault() { prevented += 1; },
      ...properties,
    };
    for (const listener of [...(this.listeners.get(type) || [])]) listener(event);
    return { event, prevented: () => prevented };
  }

  listenerCount(type) { return (this.listeners.get(type) || []).length; }
  getBoundingClientRect() { return this.rect; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
}

class CanvasContextDouble {
  constructor() {
    this.fills = [];
    this.operations = 0;
    this.fillStyle = "";
  }

  clearRect() { this.operations += 1; }
  translate(x, y) { this.operations += 1; this.x = x; this.y = y; }
  fillRect(x, y, width, height) {
    this.operations += 1;
    this.fills.push({ color: this.fillStyle, x: this.x + x, y: this.y + y, width, height });
  }
  setTransform() { this.operations += 1; this.x = 0; this.y = 0; }
  save() { this.operations += 1; }
  restore() { this.operations += 1; }
  beginPath() { this.operations += 1; }
  moveTo() { this.operations += 1; }
  lineTo() { this.operations += 1; }
  stroke() { this.operations += 1; }
}

class CanvasDouble extends EventTargetDouble {
  constructor(...args) {
    super(...args);
    this.context = new CanvasContextDouble();
    this._width = 0;
    this._height = 0;
    this.sizeWrites = 0;
  }

  get width() { return this._width; }
  set width(value) { this._width = value; this.sizeWrites += 1; }
  get height() { return this._height; }
  set height(value) { this._height = value; this.sizeWrites += 1; }
  getContext() { return this.context; }
}

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
try {
  globalThis.devicePixelRatio = 2;
  const { Bimp } = await server.ssrLoadModule("/src/lib/Bimp.js");
  const stateModule = await server.ssrLoadModule("/src/state.js");
  const { yarnSequenceCanvas } = await server.ssrLoadModule("/src/components/yarnSequenceCanvas.js");
  const { colorSequencePosAtCoords } = await server.ssrLoadModule("/src/utils.js");
  const { colorSequencePointerInteraction } = await server.ssrLoadModule("/src/events/colorSequencePointerInteraction.js");
  const { colorSequenceTouchInteraction } = await server.ssrLoadModule("/src/events/colorSequenceTouchInteraction.js");

  const sequence = new Bimp(1, 3, [0, 1, 0]);
  const state = {
    ...stateModule.GLOBAL_STATE,
    canvasHeight: 3,
    scale: 20,
    yarnSequence: sequence,
    yarnPalette: ["#111111", "#eeeeee"],
    chartPan: { x: 0, y: 0 },
  };
  stateModule.dispatch(state);
  const cam = new CanvasDouble({ left: 100, top: 200, width: 10, height: 40 });
  const needle = new CanvasDouble({ left: 400, top: 300, width: 10, height: 40 });
  const camRenderer = yarnSequenceCanvas({ canvas: cam })({ state });
  const needleRenderer = yarnSequenceCanvas({ canvas: needle })({ state });
  assert.deepEqual([cam.width, cam.height], [20, 60]);
  assert.deepEqual([needle.width, needle.height], [20, 60]);
  assert.deepEqual(
    cam.context.fills.map(({ color, y }) => [color, y]),
    needle.context.fills.map(({ color, y }) => [color, y]),
    "both gutters render the same palette rows"
  );
  assert.deepEqual(cam.context.fills.map(({ color }) => color), ["#111111", "#eeeeee", "#111111"]);

  const camSizeWrites = cam.sizeWrites;
  const camOperations = cam.context.operations;
  camRenderer.syncState({ ...state, chartPan: { x: 999, y: -50 } }, ["chartPan"]);
  assert.equal(cam.sizeWrites, camSizeWrites, "pan-only updates do not resize the gutter");
  assert.equal(cam.context.operations, camOperations, "pan-only updates do not redraw the gutter");

  const paletteState = { ...state, yarnPalette: ["#aa0000", "#00aa00"] };
  camRenderer.syncState(paletteState, ["yarnPalette"]);
  needleRenderer.syncState(paletteState, ["yarnPalette"]);
  assert.equal(cam.context.fills.at(-2).color, "#00aa00", "palette changes repaint existing sequence rows");
  assert.equal(needle.context.fills.at(-2).color, "#00aa00");
  const grown = new Bimp(1, 4, [0, 1, 0, 1]);
  const grownState = { ...paletteState, canvasHeight: 4, yarnSequence: grown, scale: 30 };
  camRenderer.syncState(grownState, ["canvasHeight", "yarnSequence", "scale"]);
  needleRenderer.syncState(grownState, ["canvasHeight", "yarnSequence", "scale"]);
  assert.deepEqual([cam.width, cam.height], [30, 120]);
  assert.deepEqual([needle.width, needle.height], [30, 120]);

  const sequenceOnlyOperations = cam.context.operations;
  const sequenceOnly = new Bimp(1, 4, [1, 1, 0, 1]);
  camRenderer.syncState({ ...grownState, yarnSequence: sequenceOnly }, ["yarnSequence"]);
  assert.ok(cam.context.operations > sequenceOnlyOperations, "sequence-only updates redraw the gutter");
  const dprSizeWrites = cam.sizeWrites;
  globalThis.devicePixelRatio = 1;
  camRenderer.syncState({ ...grownState, yarnSequence: sequenceOnly }, ["scale"]);
  assert.ok(cam.sizeWrites > dprSizeWrites, "DPR changes resize and redraw the gutter");
  globalThis.devicePixelRatio = 2;

  stateModule.dispatch({ yarnSequence: grown, activeYarn: 1, scale: 20 });
  const edge = colorSequencePosAtCoords({ clientX: 9999, clientY: -50 }, cam);
  assert.deepEqual(edge, { x: 0, y: 3 }, "transformed captured movement clamps to the top row");
  assert.deepEqual(
    colorSequencePosAtCoords({ clientX: cam.rect.left, clientY: cam.rect.top + 39 }, cam),
    { x: 0, y: 0 },
    "visual bottom maps to Bimp row zero"
  );

  colorSequencePointerInteraction(cam);
  assert.equal(cam.emit("pointerdown", { button: 1, pointerId: 3 }).prevented(), 0, "middle click does not paint");
  cam.emit("pointerdown", { button: 0, pointerId: 4, clientY: cam.rect.top + 1 });
  cam.emit("pointermove", { pointerId: 4, clientY: cam.rect.top + 39 });
  cam.emit("pointerup", { pointerId: 4 });
  assert.equal(stateModule.GLOBAL_STATE.yarnSequence.pixel(0, 3), 1);
  assert.equal(stateModule.GLOBAL_STATE.yarnSequence.pixel(0, 0), 1);
  assert.equal(stateModule.GLOBAL_STATE.transforming, false);
  for (const type of ["pointermove", "pointerup", "pointercancel", "lostpointercapture"]) {
    assert.equal(cam.listenerCount(type), 0, `${type} cleanup is balanced`);
  }

  colorSequenceTouchInteraction(needle);
  const touch = { identifier: 7, clientX: needle.rect.left + 1, clientY: needle.rect.top + 39 };
  needle.emit("touchstart", { touches: [touch], changedTouches: [touch] });
  needle.emit("touchend", { touches: [], changedTouches: [touch] });
  assert.equal(stateModule.GLOBAL_STATE.yarnSequence.pixel(0, 0), 1, "needle touch edits the shared sequence");
  assert.equal(stateModule.GLOBAL_STATE.transforming, false);

  const { resizePatternCanvas, applyNeedleArrangement } = await server.ssrLoadModule(
    "/src/actions/patternEditing.js"
  );
  const sixtyRows = new Bimp(1, 60, Array.from({ length: 60 }, (_, row) => row % 2));
  stateModule.dispatch({
    canvasHeight: 60,
    yarnSequence: sixtyRows,
    activeYarn: 1,
    camUnitBitmap: Bimp.empty(8, 4, 0),
    needleInputs: ["1", "1", "1", "1"],
  });
  resizePatternCanvas(60, 75);
  assert.equal(stateModule.GLOBAL_STATE.yarnSequence.height, 75);
  assert.deepEqual(Array.from(stateModule.GLOBAL_STATE.yarnSequence.pixels.slice(0, 60)), Array.from(sixtyRows.pixels));
  assert.deepEqual(Array.from(stateModule.GLOBAL_STATE.yarnSequence.pixels.slice(60)), Array(15).fill(1));
  const yarnAfterCanvasResize = stateModule.GLOBAL_STATE.yarnSequence;
  assert.equal(applyNeedleArrangement(), true);
  assert.equal(stateModule.GLOBAL_STATE.needleUnitBitmap.width, 4);
  assert.equal(stateModule.GLOBAL_STATE.needleUnitBitmap.height, 8);
  assert.equal(stateModule.GLOBAL_STATE.yarnSequence, yarnAfterCanvasResize, "unit transforms leave the full-canvas yarn rows untouched");
} finally {
  await server.close();
}

console.log("PASS: both fixed yarn gutters share one rendered and editable sequence.");
