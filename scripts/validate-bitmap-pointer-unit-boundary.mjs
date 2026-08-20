import assert from "node:assert/strict";
import { createServer } from "vite";

globalThis.Path2D = class {
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  closePath() {}
  rect() {}
};

class MockCanvas {
  constructor(field) {
    this.dataset = { patternField: field };
    this.listeners = new Map();
    this.capturedPointers = new Set();
  }

  addEventListener(type, callback) {
    this.listeners.set(type, callback);
  }

  removeEventListener(type) {
    this.listeners.delete(type);
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 600, height: 600 };
  }

  setPointerCapture(pointerId) {
    this.capturedPointers.add(pointerId);
  }

  hasPointerCapture(pointerId) {
    return this.capturedPointers.has(pointerId);
  }

  releasePointerCapture(pointerId) {
    this.capturedPointers.delete(pointerId);
  }

  pointerdown(event) {
    this.listeners.get("pointerdown")(event);
  }

  pointerup(event) {
    this.listeners.get("pointerup")(event);
  }
}

function mousePointerEvent({ clientX, clientY, pointerId }) {
  return {
    button: 0,
    clientX,
    clientY,
    pointerId,
    pointerType: "mouse",
    preventDefault() {},
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
  const { bitmapPointerInteraction } = await server.ssrLoadModule(
    "/src/events/bitmapPointerInteraction.js"
  );

  state.loadWorkspace({
    activeTool: "brush",
    activeSymbol: 2,
    canvasWidth: 60,
    canvasHeight: 60,
    camUnitBitmap: Bimp.empty(8, 4, 1),
  });

  const insideCanvas = new MockCanvas("camBitmap");
  bitmapPointerInteraction(insideCanvas);
  assert.doesNotThrow(() =>
    insideCanvas.pointerdown(
      mousePointerEvent({ clientX: 5, clientY: 595, pointerId: 1 })
    )
  );
  assert.equal(state.GLOBAL_STATE.camUnitBitmap.pixel(0, 0), 2);
  assert.deepEqual(state.GLOBAL_STATE.patternEdit, {
    field: "camUnitBitmap",
    startPos: { x: 0, y: 0 },
    endPos: { x: 0, y: 0 },
  });
  insideCanvas.pointerup(mousePointerEvent({ clientX: 5, clientY: 595, pointerId: 1 }));

  const camUnitBeforeOutsidePointer = state.GLOBAL_STATE.camUnitBitmap;
  const patternEditBeforeOutsidePointer = state.GLOBAL_STATE.patternEdit;
  const outsideCanvas = new MockCanvas("camBitmap");
  bitmapPointerInteraction(outsideCanvas);
  assert.doesNotThrow(() =>
    outsideCanvas.pointerdown(
      mousePointerEvent({ clientX: 85, clientY: 595, pointerId: 2 })
    )
  );
  assert.equal(state.GLOBAL_STATE.camUnitBitmap, camUnitBeforeOutsidePointer);
  assert.equal(state.GLOBAL_STATE.patternEdit, patternEditBeforeOutsidePointer);
  assert.equal(state.GLOBAL_STATE.transforming, false);

  console.log("PASS: legacy bitmap pointer fields safely target repeat units.");
} finally {
  await server.close();
}
