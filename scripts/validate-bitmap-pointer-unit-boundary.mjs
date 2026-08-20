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
    this.releaseCount = 0;
  }

  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }

  removeEventListener(type, callback) {
    const callbacks = this.listeners.get(type);
    callbacks?.delete(callback);
    if (callbacks?.size === 0) this.listeners.delete(type);
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
    this.releaseCount += 1;
    this.capturedPointers.delete(pointerId);
  }

  losePointerCapture(pointerId) {
    this.capturedPointers.delete(pointerId);
    this.emit("lostpointercapture", { pointerId });
  }

  emit(type, event) {
    for (const callback of [...(this.listeners.get(type) ?? [])]) {
      callback(event);
    }
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size ?? 0;
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

  const unitBeforeSecondDown = state.GLOBAL_STATE.camUnitBitmap;
  const fullBeforeSecondDown = state.GLOBAL_STATE.camBitmap;
  const editBeforeSecondDown = state.GLOBAL_STATE.patternEdit;
  const transformingBeforeSecondDown = state.GLOBAL_STATE.transforming;
  const secondDown = pointerEvent({
    clientX: 145,
    clientY: 55,
    pointerId: 6,
  });
  canvas.emit("pointerdown", secondDown);
  assert.equal(secondDown.prevented, false);
  assert.equal(
    state.GLOBAL_STATE.camUnitBitmap,
    unitBeforeSecondDown,
    "a second primary pointerdown cannot start another stroke"
  );
  assert.equal(state.GLOBAL_STATE.camBitmap, fullBeforeSecondDown);
  assert.equal(state.GLOBAL_STATE.patternEdit, editBeforeSecondDown);
  assert.equal(state.GLOBAL_STATE.transforming, transformingBeforeSecondDown);
  assert.equal(canvas.captureCount, 1);
  assert.deepEqual([...canvas.capturedPointers], [3]);

  assert.equal(canvas.listenerCount("pointermove"), 1);
  assert.equal(canvas.listenerCount("pointerup"), 1);
  assert.equal(canvas.listenerCount("pointercancel"), 1);
  assert.equal(canvas.listenerCount("lostpointercapture"), 1);
  const unitBeforeForeignPointer = state.GLOBAL_STATE.camUnitBitmap;
  const editBeforeForeignPointer = state.GLOBAL_STATE.patternEdit;
  canvas.emit(
    "pointermove",
    pointerEvent({ clientX: 145, clientY: 55, pointerId: 99 })
  );
  assert.equal(
    state.GLOBAL_STATE.camUnitBitmap,
    unitBeforeForeignPointer,
    "another pointer cannot extend the active stroke"
  );
  assert.equal(state.GLOBAL_STATE.patternEdit, editBeforeForeignPointer);

  for (const type of ["pointerup", "pointercancel"]) {
    canvas.emit(
      type,
      pointerEvent({ clientX: 145, clientY: 55, pointerId: 99 })
    );
    assert.equal(
      state.GLOBAL_STATE.transforming,
      true,
      `foreign ${type} cannot stop the active stroke`
    );
    assert.equal(canvas.listenerCount("pointermove"), 1);
    assert.equal(canvas.listenerCount("pointerup"), 1);
    assert.equal(canvas.listenerCount("pointercancel"), 1);
    assert.equal(canvas.listenerCount("lostpointercapture"), 1);
    assert.deepEqual([...canvas.capturedPointers], [3]);
    assert.equal(canvas.releaseCount, 0);
  }

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
  assert.equal(canvas.releaseCount, 1);
  assert.equal(canvas.listenerCount("pointermove"), 0);
  assert.equal(canvas.listenerCount("pointerup"), 0);
  assert.equal(canvas.listenerCount("pointercancel"), 0);
  assert.equal(canvas.listenerCount("lostpointercapture"), 0);

  canvas.emit(
    "pointerup",
    pointerEvent({ clientX: 175, clientY: 55, pointerId: 3 })
  );
  assert.equal(canvas.releaseCount, 1, "matching pointer cleanup runs exactly once");

  const restartedDown = pointerEvent({
    clientX: 125,
    clientY: 55,
    pointerId: 5,
  });
  canvas.emit("pointerdown", restartedDown);
  assert.equal(restartedDown.prevented, true);
  assert.equal(canvas.captureCount, 2, "a new stroke is accepted after cleanup");
  assert.equal(state.GLOBAL_STATE.transforming, true);
  assert.deepEqual([...canvas.capturedPointers], [5]);
  canvas.emit("lostpointercapture", { pointerId: 99 });
  assert.equal(state.GLOBAL_STATE.transforming, true);
  assert.equal(canvas.listenerCount("pointermove"), 1);
  canvas.losePointerCapture(5);
  assert.equal(
    state.GLOBAL_STATE.transforming,
    false,
    "losing the initiating pointer capture ends the stroke"
  );
  assert.equal(canvas.releaseCount, 1, "already-lost capture is not released again");
  assert.equal(canvas.listenerCount("pointermove"), 0);
  assert.equal(canvas.listenerCount("pointerup"), 0);
  assert.equal(canvas.listenerCount("pointercancel"), 0);
  assert.equal(canvas.listenerCount("lostpointercapture"), 0);

  console.log("PASS: pointer drawing is clipped to the direct editable repeat unit.");
} finally {
  await server.close();
}
