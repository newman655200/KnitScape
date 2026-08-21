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
assert.match(editorSource, /tabindex="0"/);

class EventTargetDouble {
  constructor(rect = { left: 20, top: 40, width: 10, height: 60 }) {
    this.rect = rect;
    this.style = {};
    this.listeners = new Map();
    this.captured = new Set();
  }

  addEventListener(type, callback, options) {
    this.listeners.set(type, [
      ...(this.listeners.get(type) || []),
      { callback, options },
    ]);
  }

  removeEventListener(type, callback) {
    this.listeners.set(
      type,
      (this.listeners.get(type) || []).filter(
        (item) => item.callback !== callback
      )
    );
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
    for (const { callback } of [...(this.listeners.get(type) || [])]) {
      callback(event);
    }
    return { event, prevented: () => prevented };
  }

  listenerCount(type) { return (this.listeners.get(type) || []).length; }
  listenerOptions(type) {
    return (this.listeners.get(type) || []).map(({ options }) => options);
  }
  getBoundingClientRect() { return this.rect; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
}

class WindowDouble extends EventTargetDouble {
  constructor() {
    super({ left: 0, top: 0, width: 0, height: 0 });
    this.nextTimerId = 1;
    this.timers = new Map();
  }

  setTimeout(callback) {
    const id = this.nextTimerId++;
    this.timers.set(id, callback);
    return id;
  }

  clearTimeout(id) {
    this.timers.delete(id);
  }

  flushTimers() {
    const callbacks = [...this.timers.values()];
    this.timers.clear();
    callbacks.forEach((callback) => callback());
  }
}

class CanvasContextDouble {
  constructor() {
    this.fills = [];
    this.clears = [];
    this.operations = 0;
    this.fillStyle = "";
  }

  clearRect(x, y, width, height) {
    this.operations += 1;
    this.clears.push({ x, y, width, height });
  }
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

function fillAtVisualRow(canvas, fillStart, visualY) {
  return canvas.context.fills
    .slice(fillStart)
    .filter((fill) => fill.x === 0 && fill.y === visualY)
    .at(-1);
}

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
const originalWindow = globalThis.window;
const testWindow = new WindowDouble();
try {
  globalThis.devicePixelRatio = 2;
  const { Bimp } = await server.ssrLoadModule("/src/lib/Bimp.js");
  const stateModule = await server.ssrLoadModule("/src/state.js");
  const { yarnSequenceCanvas } = await server.ssrLoadModule("/src/components/yarnSequenceCanvas.js");
  const { colorSequencePosAtCoords } = await server.ssrLoadModule("/src/utils.js");
  const { colorSequencePointerInteraction } = await server.ssrLoadModule("/src/events/colorSequencePointerInteraction.js");
  const { colorSequenceTouchInteraction } = await server.ssrLoadModule("/src/events/colorSequenceTouchInteraction.js");
  globalThis.window = testWindow;

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
  stateModule.StateMonitor.register([
    yarnSequenceCanvas({ canvas: cam }),
    yarnSequenceCanvas({ canvas: needle }),
  ]);
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
  stateModule.dispatch({ chartPan: { x: 999, y: -50 } });
  assert.equal(cam.sizeWrites, camSizeWrites, "pan-only updates do not resize the gutter");
  assert.equal(cam.context.operations, camOperations, "pan-only updates do not redraw the gutter");

  stateModule.dispatch({ yarnPalette: ["#aa0000", "#00aa00"] });
  assert.equal(cam.context.fills.at(-2).color, "#00aa00", "palette changes repaint existing sequence rows");
  assert.equal(needle.context.fills.at(-2).color, "#00aa00");
  const grown = new Bimp(1, 4, [0, 1, 0, 1]);
  stateModule.dispatch({ canvasHeight: 4, yarnSequence: grown, scale: 30 });
  assert.deepEqual([cam.width, cam.height], [30, 120]);
  assert.deepEqual([needle.width, needle.height], [30, 120]);

  const sequenceOnlyOperations = cam.context.operations;
  const sequenceOnlyClears = cam.context.clears.length;
  const sequenceOnly = new Bimp(1, 4, [1, 1, 0, 1]);
  stateModule.dispatch({ yarnSequence: sequenceOnly });
  assert.ok(cam.context.operations > sequenceOnlyOperations, "sequence-only updates redraw the gutter");
  assert.deepEqual(
    cam.context.clears.slice(sequenceOnlyClears),
    [{ x: 0, y: 0, width: cam.width, height: cam.height }],
    "each redraw clears the whole gutter before repainting its translucent grid"
  );
  const repeatedClears = cam.context.clears.length;
  stateModule.dispatch({ yarnSequence: grown });
  assert.deepEqual(
    cam.context.clears.slice(repeatedClears),
    [{ x: 0, y: 0, width: cam.width, height: cam.height }],
    "repeated sequence updates cannot accumulate grid alpha"
  );
  const dprSizeWrites = cam.sizeWrites;
  globalThis.devicePixelRatio = 1;
  stateModule.dispatch({ chartPan: { x: 998, y: -50 } });
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
  const camFillStart = cam.context.fills.length;
  const needleFillStart = needle.context.fills.length;
  cam.emit("pointerdown", { button: 0, pointerId: 4, clientY: cam.rect.top + 1 });
  cam.emit("pointermove", { pointerId: 4, clientY: cam.rect.top + 39 });
  cam.emit("pointerup", { pointerId: 4 });
  assert.equal(stateModule.GLOBAL_STATE.yarnSequence.pixel(0, 3), 1);
  assert.equal(stateModule.GLOBAL_STATE.yarnSequence.pixel(0, 0), 1);
  assert.equal(stateModule.GLOBAL_STATE.transforming, false);
  assert.deepEqual(
    fillAtVisualRow(cam, camFillStart, 60),
    { color: "#00aa00", x: 0, y: 60, width: 20, height: 20 },
    "CAM editing repaints its shared bottom row"
  );
  assert.deepEqual(
    fillAtVisualRow(needle, needleFillStart, 60),
    { color: "#00aa00", x: 0, y: 60, width: 20, height: 20 },
    "CAM editing repaints the same bottom row in NEEDLE"
  );
  for (const type of ["pointermove", "pointerup", "pointercancel", "lostpointercapture"]) {
    assert.equal(cam.listenerCount(type), 0, `${type} cleanup is balanced`);
  }

  colorSequenceTouchInteraction(needle);
  assert.deepEqual(
    needle.listenerOptions("touchstart"),
    [{ passive: false }],
    "touch painting must opt out of passive listeners so preventDefault is effective"
  );
  stateModule.dispatch({ activeYarn: 0 });
  const camTouchFillStart = cam.context.fills.length;
  const needleTouchFillStart = needle.context.fills.length;
  const touch = { identifier: 7, clientX: needle.rect.left + 1, clientY: needle.rect.top + 39 };
  needle.emit("touchstart", { touches: [touch], changedTouches: [touch] });
  assert.deepEqual(
    needle.listenerOptions("touchmove"),
    [{ passive: false }],
    "active touch movement must be registered as non-passive"
  );
  needle.emit("touchend", { touches: [], changedTouches: [touch] });
  assert.equal(stateModule.GLOBAL_STATE.yarnSequence.pixel(0, 0), 0, "needle touch edits the shared sequence");
  assert.equal(stateModule.GLOBAL_STATE.transforming, false);
  assert.deepEqual(
    fillAtVisualRow(needle, needleTouchFillStart, 60),
    { color: "#aa0000", x: 0, y: 60, width: 20, height: 20 },
    "NEEDLE editing repaints its shared bottom row"
  );
  assert.deepEqual(
    fillAtVisualRow(cam, camTouchFillStart, 60),
    { color: "#aa0000", x: 0, y: 60, width: 20, height: 20 },
    "NEEDLE editing repaints the same bottom row in CAM"
  );

  colorSequencePointerInteraction(needle);
  stateModule.dispatch({
    activeYarn: 1,
    yarnSequence: Bimp.empty(1, 4, 0),
  });
  const firstStart = cam.emit("pointerdown", {
    button: 0,
    pointerId: 20,
    clientY: cam.rect.top + 1,
  });
  assert.equal(firstStart.prevented(), 1);
  assert.equal(stateModule.GLOBAL_STATE.transforming, true);
  assert.equal(stateModule.GLOBAL_STATE.texturePreviewInteractionActive, true);
  assert.equal(testWindow.timers.size, 0, "starting a stroke clears the prior preview end timer");
  const activeStrokeSequence = stateModule.GLOBAL_STATE.yarnSequence;

  const rejectedPointer = needle.emit("pointerdown", {
    button: 0,
    pointerId: 21,
    clientY: needle.rect.top + 39,
  });
  assert.equal(rejectedPointer.prevented(), 0, "a second gutter pointer stroke is rejected");
  assert.equal(needle.captured.has(21), false, "a rejected pointer is not captured");
  assert.equal(
    stateModule.GLOBAL_STATE.yarnSequence,
    activeStrokeSequence,
    "a rejected pointer cannot mutate the shared yarn sequence"
  );

  const rejectedTouch = {
    identifier: 22,
    clientX: needle.rect.left + 1,
    clientY: needle.rect.top + 39,
  };
  const rejectedTouchStart = needle.emit("touchstart", {
    touches: [rejectedTouch],
    changedTouches: [rejectedTouch],
  });
  assert.equal(rejectedTouchStart.prevented(), 0, "a cross-input second stroke is rejected");
  assert.equal(needle.listenerCount("touchmove"), 0);
  assert.equal(stateModule.GLOBAL_STATE.yarnSequence, activeStrokeSequence);
  assert.equal(testWindow.timers.size, 0, "rejected starts do not end the active preview");

  cam.emit("lostpointercapture", { pointerId: 20 });
  assert.equal(stateModule.GLOBAL_STATE.transforming, false);
  assert.equal(testWindow.timers.size, 1, "lost capture ends exactly one preview interaction");

  stateModule.dispatch({ activeYarn: 0 });
  const acceptedTouch = {
    identifier: 23,
    clientX: needle.rect.left + 1,
    clientY: needle.rect.top + 1,
  };
  const acceptedTouchStart = needle.emit("touchstart", {
    touches: [acceptedTouch],
    changedTouches: [acceptedTouch],
  });
  assert.equal(acceptedTouchStart.prevented(), 1, "cleanup allows the other gutter to restart");
  assert.equal(stateModule.GLOBAL_STATE.transforming, true);
  assert.equal(testWindow.timers.size, 0);
  const touchStrokeSequence = stateModule.GLOBAL_STATE.yarnSequence;
  const foreignTouch = {
    identifier: 99,
    clientX: needle.rect.left + 1,
    clientY: needle.rect.top + 39,
  };
  needle.emit("touchmove", { touches: [foreignTouch], changedTouches: [foreignTouch] });
  needle.emit("touchend", { touches: [], changedTouches: [foreignTouch] });
  assert.equal(stateModule.GLOBAL_STATE.yarnSequence, touchStrokeSequence);
  assert.equal(stateModule.GLOBAL_STATE.transforming, true, "a foreign touch cannot end the stroke");
  needle.emit("touchcancel", { touches: [], changedTouches: [acceptedTouch] });
  assert.equal(stateModule.GLOBAL_STATE.transforming, false);
  assert.equal(testWindow.timers.size, 1, "touch cancel balances the restarted preview");
  for (const type of ["touchmove", "touchend", "touchcancel"]) {
    assert.equal(needle.listenerCount(type), 0, `${type} cleanup is balanced`);
  }
  testWindow.flushTimers();
  assert.equal(stateModule.GLOBAL_STATE.texturePreviewInteractionActive, false);

  const fallbackCanvas = new CanvasDouble({
    left: 600,
    top: 100,
    width: 10,
    height: 40,
  });
  fallbackCanvas.setPointerCapture = () => {
    throw new Error("pointer capture unavailable");
  };
  colorSequencePointerInteraction(fallbackCanvas);
  stateModule.dispatch({ activeYarn: 1 });
  fallbackCanvas.emit("pointerdown", {
    pointerId: 30,
    clientY: fallbackCanvas.rect.top + 39,
  });
  assert.equal(testWindow.listenerCount("pointermove"), 1);
  assert.equal(testWindow.listenerCount("pointercancel"), 1);
  testWindow.emit("pointercancel", { pointerId: 30 });
  assert.equal(stateModule.GLOBAL_STATE.transforming, false);
  assert.equal(testWindow.listenerCount("pointermove"), 0);
  assert.equal(testWindow.listenerCount("pointercancel"), 0);
  assert.equal(testWindow.timers.size, 1, "fallback cancellation ends one preview");
  testWindow.flushTimers();
  assert.equal(stateModule.GLOBAL_STATE.texturePreviewInteractionActive, false);

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
  globalThis.window = originalWindow;
  await server.close();
}

console.log("PASS: both fixed yarn gutters share one rendered and editable sequence.");
