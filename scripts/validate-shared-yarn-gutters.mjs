import assert from "node:assert/strict";
import { createServer } from "vite";

class CanvasDouble {
  constructor(rect) {
    this.rect = rect;
    this.listeners = new Map();
    this.captured = new Set();
    this.context = {
      fills: [],
      fillStyle: "",
      setTransform() {},
      clearRect() {},
      save() {},
      restore() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      fillRect: (x, y, width, height) => {
        this.context.fills.push({ color: this.context.fillStyle, x, y, width, height });
      },
    };
    this.style = {};
    this.width = 0;
    this.height = 0;
  }
  addEventListener(type, callback, options) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push({ callback, options });
  }
  removeEventListener(type, callback) {
    this.listeners.set(
      type,
      (this.listeners.get(type) || []).filter((item) => item.callback !== callback)
    );
  }
  emit(type, properties = {}) {
    let prevented = 0;
    const event = {
      button: 0,
      pointerId: 0,
      touches: [],
      changedTouches: [],
      ...properties,
      preventDefault() { prevented++; },
    };
    for (const { callback } of [...(this.listeners.get(type) || [])]) callback(event);
    return prevented;
  }
  getContext() { return this.context; }
  getBoundingClientRect() { return this.rect; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
}

function latestFill(canvas, y, start = 0) {
  return canvas.context.fills
    .slice(start)
    .filter((fill) => fill.x === 0 && fill.y === y)
    .at(-1);
}

const previousWindow = globalThis.window;
const previousDpr = globalThis.devicePixelRatio;
const previousPath2D = globalThis.Path2D;
let timerId = 0;
globalThis.window = {
  clearTimeout() {},
  setTimeout() { return ++timerId; },
};
globalThis.devicePixelRatio = 2;
globalThis.Path2D = class {};

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { Bimp } = await server.ssrLoadModule("/src/lib/Bimp.js");
  const state = await server.ssrLoadModule("/src/state.js");
  const { yarnSequenceCanvas } = await server.ssrLoadModule("/src/components/yarnSequenceCanvas.js");
  const { colorSequencePointerInteraction } = await server.ssrLoadModule("/src/events/colorSequencePointerInteraction.js");
  const { colorSequenceTouchInteraction } = await server.ssrLoadModule("/src/events/colorSequenceTouchInteraction.js");
  const { resizePatternCanvas, applyNeedleArrangement } =
    await server.ssrLoadModule("/src/actions/patternEditing.js");

  state.dispatch({
    scale: 20,
    canvasHeight: 4,
    yarnPalette: ["#aa0000", "#00aa00"],
    yarnSequence: new Bimp(1, 4, [0, 0, 0, 0]),
    activeYarn: 1,
  });
  const cam = new CanvasDouble({ left: 100, top: 200, width: 10, height: 40 });
  const needle = new CanvasDouble({ left: 400, top: 300, width: 10, height: 40 });
  state.StateMonitor.register([
    yarnSequenceCanvas({ canvas: cam }),
    yarnSequenceCanvas({ canvas: needle }),
  ]);
  assert.deepEqual([cam.width, cam.height, cam.style.width, cam.style.height], [20, 80, "10px", "40px"]);
  assert.deepEqual([needle.width, needle.height], [20, 80]);

  colorSequencePointerInteraction(cam);
  const camStart = cam.context.fills.length;
  const needleStart = needle.context.fills.length;
  assert.equal(cam.emit("pointerdown", {
    button: 0,
    pointerId: 4,
    clientX: 101,
    clientY: 201,
  }), 1);
  cam.emit("pointerup", { pointerId: 4 });
  assert.equal(state.GLOBAL_STATE.yarnSequence.pixel(0, 3), 1);
  assert.deepEqual(latestFill(cam, 0, camStart), {
    color: "#00aa00", x: 0, y: 0, width: 20, height: 20,
  });
  assert.deepEqual(latestFill(needle, 0, needleStart), {
    color: "#00aa00", x: 0, y: 0, width: 20, height: 20,
  });

  state.dispatch({ activeYarn: 0 });
  colorSequenceTouchInteraction(needle);
  const camTouchStart = cam.context.fills.length;
  const needleTouchStart = needle.context.fills.length;
  const touch = { identifier: 7, clientX: 401, clientY: 339 };
  assert.equal(needle.emit("touchstart", {
    touches: [touch],
    changedTouches: [touch],
  }), 1);
  needle.emit("touchend", { touches: [], changedTouches: [touch] });
  assert.equal(state.GLOBAL_STATE.yarnSequence.pixel(0, 0), 0);
  assert.deepEqual(latestFill(cam, 60, camTouchStart), {
    color: "#aa0000", x: 0, y: 60, width: 20, height: 20,
  });
  assert.deepEqual(latestFill(needle, 60, needleTouchStart), {
    color: "#aa0000", x: 0, y: 60, width: 20, height: 20,
  });

  resizePatternCanvas(80, 75);
  const resizedSequence = state.GLOBAL_STATE.yarnSequence;
  assert.equal(resizedSequence.height, 75);
  assert.deepEqual([cam.height, needle.height], [1500, 1500]);
  assert.equal(applyNeedleArrangement(), true);
  assert.equal(state.GLOBAL_STATE.yarnSequence, resizedSequence);
  assert.deepEqual([cam.height, needle.height], [1500, 1500]);
} finally {
  await server.close();
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
  if (previousDpr === undefined) delete globalThis.devicePixelRatio;
  else globalThis.devicePixelRatio = previousDpr;
  if (previousPath2D === undefined) delete globalThis.Path2D;
  else globalThis.Path2D = previousPath2D;
}

console.log("PASS: both fixed yarn gutters display and edit one shared sequence.");
