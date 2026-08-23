import assert from "node:assert/strict";
import { createServer } from "vite";

globalThis.Path2D = class {
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  closePath() {}
  rect() {}
};
globalThis.devicePixelRatio = 2;

class CanvasDouble {
  constructor(unitField) {
    this.dataset = { unitField };
    this.listeners = new Map();
    this.captured = new Set();
  }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) {
    this.listeners.get(type)?.delete(callback);
  }
  emit(type, event) {
    for (const callback of [...(this.listeners.get(type) || [])]) callback(event);
  }
  listenerCount(type) { return this.listeners.get(type)?.size || 0; }
  getBoundingClientRect() { return { left: 100, top: 50, width: 600, height: 600 }; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
}

function pointer(clientX, clientY, pointerId, button = 0) {
  return {
    button,
    clientX,
    clientY,
    pointerId,
    prevented: false,
    preventDefault() { this.prevented = true; },
  };
}

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const state = await server.ssrLoadModule("/src/state.js");
  const { Bimp } = await server.ssrLoadModule("/src/lib/Bimp.js");
  const { bitmapPointerInteraction, positionInEditableUnit } =
    await server.ssrLoadModule("/src/events/bitmapPointerInteraction.js");
  const unit = Bimp.empty(8, 4, 1);
  const canvas = new CanvasDouble("camUnitBitmap");

  assert.deepEqual(
    positionInEditableUnit(canvas, { clientX: 105, clientY: 55 }, unit, 20, 2),
    { x: 0, y: 3 }
  );
  assert.deepEqual(
    positionInEditableUnit(canvas, { clientX: 175, clientY: 85 }, unit, 20, 2),
    { x: 7, y: 0 }
  );
  for (const point of [
    { clientX: 99, clientY: 55 },
    { clientX: 105, clientY: 49 },
    { clientX: 180, clientY: 55 },
    { clientX: 105, clientY: 90 },
  ]) {
    assert.equal(positionInEditableUnit(canvas, point, unit, 20, 2), null);
  }

  state.loadWorkspace({
    activeTool: "brush",
    activeSymbol: 2,
    canvasWidth: 60,
    canvasHeight: 60,
    scale: 20,
    transforming: false,
    camUnitBitmap: unit,
  });
  bitmapPointerInteraction(canvas);

  const outside = pointer(185, 55, 1);
  const beforeOutside = state.GLOBAL_STATE.camUnitBitmap;
  canvas.emit("pointerdown", outside);
  assert.equal(outside.prevented, false);
  assert.equal(state.GLOBAL_STATE.camUnitBitmap, beforeOutside, "gray area stays read-only");

  const middle = pointer(105, 55, 2, 1);
  canvas.emit("pointerdown", middle);
  assert.equal(middle.prevented, false, "middle button remains available for pan");

  const down = pointer(105, 55, 3);
  canvas.emit("pointerdown", down);
  assert.equal(down.prevented, true);
  assert.equal(state.GLOBAL_STATE.camUnitBitmap.pixel(0, 3), 2);
  assert.equal(state.GLOBAL_STATE.camBitmap.pixel(0, 59), 2);
  assert.equal(state.GLOBAL_STATE.transforming, true);

  canvas.emit("pointermove", pointer(115, 55, 3));
  canvas.emit("pointermove", pointer(205, 55, 3));
  canvas.emit("pointermove", pointer(175, 55, 3));
  assert.equal(state.GLOBAL_STATE.camUnitBitmap.pixel(1, 3), 2);
  assert.equal(state.GLOBAL_STATE.camUnitBitmap.pixel(7, 3), 2);
  for (let x = 2; x < 7; x++) {
    assert.equal(state.GLOBAL_STATE.camUnitBitmap.pixel(x, 3), 1, "gray gap is never bridged");
  }

  canvas.emit("pointerup", pointer(175, 55, 3));
  assert.equal(state.GLOBAL_STATE.transforming, false);
  assert.equal(canvas.captured.size, 0);
  for (const type of ["pointermove", "pointerup", "pointercancel", "lostpointercapture"]) {
    assert.equal(canvas.listenerCount(type), 0);
  }
} finally {
  await server.close();
}

console.log("PASS: pointer drawing is limited to the black repeat unit.");
