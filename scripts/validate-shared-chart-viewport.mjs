import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

class EventTargetDouble {
  constructor(rect) {
    this.rect = rect;
    this.listeners = new Map();
    this.captured = new Set();
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
  dispatch(type, properties = {}) {
    let prevented = 0;
    const event = {
      type,
      button: 0,
      pointerId: 0,
      clientX: 0,
      clientY: 0,
      deltaY: 0,
      deltaMode: 0,
      ...properties,
      preventDefault() { prevented++; },
    };
    for (const { callback } of [...(this.listeners.get(type) || [])]) callback(event);
    return { prevented: () => prevented };
  }
  getBoundingClientRect() { return this.rect; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
  listenerOptions(type) { return (this.listeners.get(type) || []).map(({ options }) => options); }
  listenerCount(type) { return (this.listeners.get(type) || []).length; }
}

function editors(bitmapEditor) {
  return [
    bitmapEditor({ fullField: "camBitmap", unitField: "camUnitBitmap", prefix: "cam", titleKey: "cam.title" }),
    bitmapEditor({ fullField: "needleBitmap", unitField: "needleUnitBitmap", prefix: "needle", titleKey: "needle.title", showNeedleControls: true }),
  ];
}

const globals = [
  "window",
  "document",
  "Document",
  "Node",
  "HTMLElement",
  "customElements",
  "devicePixelRatio",
  "Path2D",
  "getComputedStyle",
];
const previous = new Map(
  globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
);
const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
let dom;

try {
  dom = new JSDOM("<!doctype html><body><main id='root'></main></body>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Document: dom.window.Document,
    Node: dom.window.Node,
    HTMLElement: dom.window.HTMLElement,
    customElements: dom.window.customElements,
    devicePixelRatio: 2,
    Path2D: class {},
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  });

  const { render } = await server.ssrLoadModule("/node_modules/lit-html/lit-html.js");
  const { bitmapEditor } = await server.ssrLoadModule("/src/views/bitmapEditor.js");
  const state = await server.ssrLoadModule("/src/state.js");
  const viewport = await server.ssrLoadModule("/src/chartViewport.js");
  const { chartPointerPanZoom } = await server.ssrLoadModule("/src/events/chartPointerPanZoom.js");
  const { fitChart } = await server.ssrLoadModule("/src/actions/zoomFit.js");
  const root = document.querySelector("#root");

  state.loadWorkspace({ canvasWidth: 60, canvasHeight: 60 });
  state.dispatch({ scale: 20, chartPan: { x: 10, y: 20 }, reverseScroll: false });
  render(editors(bitmapEditor), root);
  assert.deepEqual(
    [...root.querySelectorAll(".pattern-canvas-transform")].map((node) => node.style.transform),
    ["translate(10px, 20px)", "translate(10px, 20px)"]
  );
  assert.deepEqual(
    [...root.querySelectorAll(".yarn-sequence-track")].map((node) => node.style.transform),
    ["translateY(20px)", "translateY(20px)"]
  );

  assert.deepEqual(
    viewport.fitVisibleCells({ viewportWidth: 340, viewportHeight: 320, devicePixelRatio: 1 }),
    { scale: 20, pan: { x: 0, y: 0 } },
    "the default fit exposes 16 rows and 16 chart columns beside the gutter"
  );
  assert.deepEqual(
    viewport.zoomViewportAtPoint({
      pan: { x: 10, y: 20 },
      scale: 20,
      nextScale: 24,
      point: { x: 100, y: 120 },
      devicePixelRatio: 1,
    }),
    { scale: 24, pan: { x: -8, y: 0 } }
  );

  const camWindow = new EventTargetDouble({ left: 50, top: 60, width: 320, height: 300 });
  const needleWindow = new EventTargetDouble({ left: 400, top: 80, width: 300, height: 280 });
  const camFrames = [];
  const needleFrames = [];
  chartPointerPanZoom(camWindow, { requestFrame: (callback) => camFrames.push(callback) });
  chartPointerPanZoom(needleWindow, { requestFrame: (callback) => needleFrames.push(callback) });
  assert.deepEqual(camWindow.listenerOptions("wheel"), [{ passive: false }]);
  assert.deepEqual(needleWindow.listenerOptions("wheel"), [{ passive: false }]);

  state.dispatch({ scale: 20, chartPan: { x: 0, y: 0 } });
  const wheel = camWindow.dispatch("wheel", {
    clientX: 150,
    clientY: 180,
    deltaY: -100,
  });
  assert.equal(wheel.prevented(), 1);
  assert.equal(camFrames.length, 1);
  camFrames.shift()();
  assert.deepEqual(
    { scale: state.GLOBAL_STATE.scale, pan: state.GLOBAL_STATE.chartPan },
    { scale: 21, pan: { x: -5, y: -6 } }
  );
  render(editors(bitmapEditor), root);
  assert.deepEqual(
    [...root.querySelectorAll(".pattern-canvas-transform")].map((node) => node.style.transform),
    ["translate(-5px, -6px)", "translate(-5px, -6px)"]
  );

  const down = needleWindow.dispatch("pointerdown", {
    button: 1,
    pointerId: 7,
    clientX: 500,
    clientY: 200,
  });
  assert.equal(down.prevented(), 1);
  needleWindow.dispatch("pointermove", { pointerId: 7, clientX: 530, clientY: 190 });
  assert.deepEqual(state.GLOBAL_STATE.chartPan, { x: 25, y: -16 });
  needleWindow.dispatch("pointerup", { pointerId: 7 });
  assert.equal(needleWindow.captured.size, 0);
  assert.equal(needleWindow.listenerCount("pointermove"), 0);

  const captureFailure = new DOMException(
    "The pointer is no longer active.",
    "NotFoundError"
  );
  const pointerTarget = new EventTargetDouble({
    left: 0,
    top: 0,
    width: 800,
    height: 600,
  });
  const fallbackWindow = new EventTargetDouble({
    left: 50,
    top: 60,
    width: 320,
    height: 300,
  });
  fallbackWindow.ownerDocument = { defaultView: pointerTarget };
  fallbackWindow.setPointerCapture = () => {
    throw captureFailure;
  };
  chartPointerPanZoom(fallbackWindow, {
    requestFrame: (callback) => callback(),
  });
  state.dispatch({ chartPan: { x: 10, y: 20 } });
  const fallbackDown = fallbackWindow.dispatch("pointerdown", {
    button: 1,
    pointerId: 8,
    clientX: 100,
    clientY: 120,
  });
  assert.equal(fallbackDown.prevented(), 1);
  pointerTarget.dispatch("pointermove", {
    pointerId: 8,
    clientX: 135,
    clientY: 105,
  });
  assert.deepEqual(
    state.GLOBAL_STATE.chartPan,
    { x: 45, y: 5 },
    "middle-button panning survives pointer-capture failure"
  );
  pointerTarget.dispatch("pointerup", { pointerId: 8 });
  assert.equal(pointerTarget.listenerCount("pointermove"), 0);
  assert.equal(pointerTarget.listenerCount("pointerup"), 0);

  globalThis.devicePixelRatio = 1;
  globalThis.getComputedStyle = () => ({
    paddingLeft: "12px",
    paddingRight: "12px",
    paddingTop: "12px",
    paddingBottom: "12px",
  });
  const panes = [...root.querySelectorAll(".pattern-editor-viewport")];
  for (const [pane, [width, height]] of panes.map((pane, index) => [pane, index ? [347, 328] : [364, 344]])) {
    Object.defineProperties(pane, {
      clientWidth: { configurable: true, value: width },
      clientHeight: { configurable: true, value: height },
    });
    pane.getBoundingClientRect = () => ({ width, height });
  }
  fitChart();
  assert.deepEqual(
    { scale: state.GLOBAL_STATE.scale, pan: state.GLOBAL_STATE.chartPan },
    { scale: 19, pan: { x: 0, y: 0 } }
  );
} finally {
  await server.close();
  dom?.window.close();
  for (const [name, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}

console.log("PASS: both repeat editors share one 16x16 pan and zoom viewport.");
