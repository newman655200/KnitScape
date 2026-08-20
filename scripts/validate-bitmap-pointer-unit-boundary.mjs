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

class MockCanvas {
  constructor(unitField) {
    this.dataset = { unitField };
    this.listeners = new Map();
    this.capturedPointers = new Set();
    this.captureCount = 0;
  }

  addEventListener(type, callback) {
    this.listeners.set(type, callback);
  }

  removeEventListener(type) {
    this.listeners.delete(type);
  }

  getBoundingClientRect() {
    return { left: 100, top: 50, width: 600, height: 600 };
  }

  setPointerCapture(pointerId) {
    this.captureCount += 1;
    this.capturedPointers.add(pointerId);
  }

  hasPointerCapture(pointerId) {
    return this.capturedPointers.has(pointerId);
  }

  releasePointerCapture(pointerId) {
    this.capturedPointers.delete(pointerId);
  }

  emit(type, event) {
    this.listeners.get(type)?.(event);
  }
}

function pointerEvent({
  clientX,
  clientY,
  pointerId,
  button = 0,
  pointerType = "mouse",
}) {
  return {
    button,
    clientX,
    clientY,
    pointerId,
    pointerType,
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
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
  const {
    bitmapPointerInteraction,
    positionInEditableUnit,
  } = await server.ssrLoadModule("/src/events/bitmapPointerInteraction.js");

  const unit = Bimp.empty(8, 4, 1);
  const canvas = new MockCanvas("camUnitBitmap");
  assert.deepEqual(
    positionInEditableUnit(
      canvas,
      { clientX: 105, clientY: 55 },
      unit,
      20,
      2
    ),
    { x: 0, y: 3 },
    "visual top-left maps to the unit's top Bimp row"
  );
  assert.deepEqual(
    positionInEditableUnit(
      canvas,
      { clientX: 175, clientY: 85 },
      unit,
      20,
      2
    ),
    { x: 7, y: 0 },
    "bottom-right unit cell maps without scaling the full canvas"
  );
  for (const point of [
    { clientX: 99, clientY: 55 },
    { clientX: 105, clientY: 49 },
    { clientX: 180, clientY: 55 },
    { clientX: 105, clientY: 90 },
  ]) {
    assert.equal(
      positionInEditableUnit(canvas, point, unit, 20, 2),
      null,
      "negative and gray-area positions are outside the editable unit"
    );
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

  const outside = pointerEvent({ clientX: 185, clientY: 55, pointerId: 1 });
  const unitBeforeOutside = state.GLOBAL_STATE.camUnitBitmap;
  const fullBeforeOutside = state.GLOBAL_STATE.camBitmap;
  const editBeforeOutside = state.GLOBAL_STATE.patternEdit;
  canvas.emit("pointerdown", outside);
  assert.equal(outside.prevented, false);
  assert.equal(canvas.captureCount, 0);
  assert.equal(state.GLOBAL_STATE.camUnitBitmap, unitBeforeOutside);
  assert.equal(state.GLOBAL_STATE.camBitmap, fullBeforeOutside);
  assert.equal(state.GLOBAL_STATE.patternEdit, editBeforeOutside);
  assert.equal(state.GLOBAL_STATE.transforming, false);

  const middle = pointerEvent({
    clientX: 105,
    clientY: 55,
    pointerId: 2,
    button: 1,
  });
  canvas.emit("pointerdown", middle);
  assert.equal(middle.prevented, false);
  assert.equal(canvas.captureCount, 0, "middle mouse is ignored until pan support exists");

  const penBarrel = pointerEvent({
    clientX: 105,
    clientY: 55,
    pointerId: 4,
    button: 2,
    pointerType: "pen",
  });
  canvas.emit("pointerdown", penBarrel);
  assert.equal(penBarrel.prevented, false);
  assert.equal(canvas.captureCount, 0, "non-primary pen buttons do not draw");

  const down = pointerEvent({ clientX: 105, clientY: 55, pointerId: 3 });
  canvas.emit("pointerdown", down);
  assert.equal(down.prevented, true);
  assert.equal(canvas.captureCount, 1);
  assert.equal(state.GLOBAL_STATE.transforming, true);
  assert.equal(state.GLOBAL_STATE.camUnitBitmap.pixel(0, 3), 2);
  assert.equal(state.GLOBAL_STATE.camBitmap.pixel(0, 59), 2, "unit edit updates the top-aligned derived full chart");
  assert.deepEqual(state.GLOBAL_STATE.patternEdit, {
    field: "camUnitBitmap",
    startPos: { x: 0, y: 3 },
    endPos: { x: 0, y: 3 },
  });

  canvas.emit(
    "pointermove",
    pointerEvent({ clientX: 115, clientY: 55, pointerId: 3 })
  );
  assert.equal(state.GLOBAL_STATE.camUnitBitmap.pixel(1, 3), 2);
  canvas.emit(
    "pointermove",
    pointerEvent({ clientX: 205, clientY: 55, pointerId: 3 })
  );
  canvas.emit(
    "pointermove",
    pointerEvent({ clientX: 175, clientY: 55, pointerId: 3 })
  );
  assert.equal(state.GLOBAL_STATE.camUnitBitmap.pixel(7, 3), 2);
  for (let x = 2; x < 7; x++) {
    assert.equal(
      state.GLOBAL_STATE.camUnitBitmap.pixel(x, 3),
      1,
      "re-entry starts a new segment instead of bridging across gray space"
    );
  }
  assert.deepEqual(state.GLOBAL_STATE.patternEdit, {
    field: "camUnitBitmap",
    startPos: { x: 7, y: 3 },
    endPos: { x: 7, y: 3 },
  });

  canvas.emit(
    "pointerup",
    pointerEvent({ clientX: 175, clientY: 55, pointerId: 3 })
  );
  assert.equal(state.GLOBAL_STATE.transforming, false);
  assert.equal(canvas.capturedPointers.size, 0);

  console.log("PASS: pointer drawing is clipped to the direct editable repeat unit.");
} finally {
  await server.close();
}
