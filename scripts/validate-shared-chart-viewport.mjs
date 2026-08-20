import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

const browserGlobals = [
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
const previousGlobals = new Map(
  browserGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
);

function renderEditors(render, bitmapEditor, host) {
  render(
    [
      bitmapEditor({
        fullField: "camBitmap",
        unitField: "camUnitBitmap",
        prefix: "cam",
        titleKey: "cam.title",
      }),
      bitmapEditor({
        fullField: "needleBitmap",
        unitField: "needleUnitBitmap",
        prefix: "needle",
        titleKey: "needle.title",
        showNeedleControls: true,
      }),
    ],
    host
  );
}

class EventTargetDouble {
  constructor(rect = { left: 0, top: 0, width: 320, height: 320 }) {
    this.rect = rect;
    this.listeners = new Map();
    this.capturedPointers = new Set();
    this.captureCalls = [];
    this.releaseCalls = [];
    this.removalCalls = [];
  }

  addEventListener(type, callback, options) {
    const listeners = this.listeners.get(type) || [];
    if (!listeners.some((listener) => listener.callback === callback)) {
      listeners.push({ callback, options });
    }
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, callback) {
    const listeners = this.listeners.get(type) || [];
    const next = listeners.filter((listener) => listener.callback !== callback);
    if (next.length !== listeners.length) this.removalCalls.push(type);
    this.listeners.set(type, next);
  }

  dispatch(type, properties = {}) {
    let preventDefaultCalls = 0;
    const event = {
      type,
      button: 0,
      buttons: 0,
      pointerId: 0,
      clientX: 0,
      clientY: 0,
      deltaY: 0,
      deltaMode: 0,
      ...properties,
      preventDefault() {
        preventDefaultCalls += 1;
      },
    };
    for (const { callback } of [...(this.listeners.get(type) || [])]) callback(event);
    return { event, preventDefaultCalls: () => preventDefaultCalls };
  }

  getBoundingClientRect() {
    return this.rect;
  }

  setPointerCapture(pointerId) {
    this.captureCalls.push(pointerId);
    this.capturedPointers.add(pointerId);
  }

  hasPointerCapture(pointerId) {
    return this.capturedPointers.has(pointerId);
  }

  releasePointerCapture(pointerId) {
    this.releaseCalls.push(pointerId);
    this.capturedPointers.delete(pointerId);
  }

  losePointerCapture(pointerId) {
    this.capturedPointers.delete(pointerId);
    return this.dispatch("lostpointercapture", { pointerId });
  }

  listenerOptions(type) {
    return (this.listeners.get(type) || []).map(({ options }) => options);
  }

  listenerCount(type) {
    return (this.listeners.get(type) || []).length;
  }
}

class RenderContextDouble {
  constructor() {
    this.operations = 0;
  }

  record() { this.operations += 1; }
  resetTransform() { this.record(); }
  clearRect() { this.record(); }
  translate() { this.record(); }
  save() { this.record(); }
  scale() { this.record(); }
  stroke() { this.record(); }
  restore() { this.record(); }
  beginPath() { this.record(); }
  moveTo() { this.record(); }
  lineTo() { this.record(); }
  setTransform() { this.record(); }
  fillRect() { this.record(); }
}

class RenderCanvasDouble {
  constructor() {
    this.context = new RenderContextDouble();
    this.style = {};
    this.sizeWrites = 0;
    this._width = 0;
    this._height = 0;
  }

  get width() { return this._width; }
  set width(value) { this._width = value; this.sizeWrites += 1; }
  get height() { return this._height; }
  set height(value) { this._height = value; this.sizeWrites += 1; }
  getContext() { return this.context; }
}

let server;
let dom;
try {
  server = await createServer({
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  dom = new JSDOM("<!doctype html><html><body></body></html>");
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

  const { render } = await server.ssrLoadModule(
    "/node_modules/lit-html/lit-html.js"
  );
  const { bitmapEditor } = await server.ssrLoadModule("/src/views/bitmapEditor.js");
  const stateModule = await server.ssrLoadModule("/src/state.js");
  const host = document.createElement("main");
  document.body.append(host);

  stateModule.dispatch({ scale: 20, chartPan: { x: 10, y: 20 } });
  renderEditors(render, bitmapEditor, host);
  const transforms = [...host.querySelectorAll(".pattern-canvas-transform")];
  const yarnTracks = [...host.querySelectorAll(".yarn-sequence-track")];
  assert.equal(transforms.length, 2);
  assert.equal(yarnTracks.length, 2);
  assert.deepEqual(
    transforms.map((element) => element.style.transform),
    ["translate(10px, 20px)", "translate(10px, 20px)"],
    "both chart transforms use the one global chart pan"
  );
  assert.deepEqual(
    yarnTracks.map((element) => element.style.transform),
    ["translateY(20px)", "translateY(20px)"],
    "both yarn tracks share vertical pan without horizontal chart pan"
  );
  const originalNodes = [
    ...host.querySelectorAll(".pattern-canvas-transform, .yarn-sequence-track"),
  ];
  stateModule.dispatch({ chartPan: { x: -7, y: 35 } });
  renderEditors(render, bitmapEditor, host);
  assert.deepEqual(
    [...host.querySelectorAll(".pattern-canvas-transform")].map(
      (element) => element.style.transform
    ),
    ["translate(-7px, 35px)", "translate(-7px, 35px)"]
  );
  assert.deepEqual(
    [...host.querySelectorAll(".yarn-sequence-track")].map(
      (element) => element.style.transform
    ),
    ["translateY(35px)", "translateY(35px)"]
  );
  assert.deepEqual(
    [...host.querySelectorAll(".pattern-canvas-transform, .yarn-sequence-track")],
    originalNodes,
    "stable Lit templates retain transform nodes across pan rerenders"
  );

  const { Bimp } = await server.ssrLoadModule("/src/lib/Bimp.js");
  const { drawBitmapEditor } = await server.ssrLoadModule(
    "/src/components/drawBitmapEditor.js"
  );
  const { yarnSequenceCanvas } = await server.ssrLoadModule(
    "/src/components/yarnSequenceCanvas.js"
  );
  globalThis.devicePixelRatio = 1;
  const bitmapCanvases = Array.from({ length: 5 }, () => new RenderCanvasDouble());
  const [
    fullSymbolCanvas,
    fullGridCanvas,
    unitSymbolCanvas,
    unitGridCanvas,
    interactionCanvas,
  ] = bitmapCanvases;
  const bitmap = Bimp.empty(2, 2, 1);
  const bitmapState = {
    camBitmap: bitmap,
    camUnitBitmap: bitmap,
    scale: 20,
    symbolMap: ["knit", "purl", "slip", "tuck"],
    symbolLineWidth: 3,
    grid: true,
  };
  const bitmapComponent = drawBitmapEditor({
    fullField: "camBitmap",
    unitField: "camUnitBitmap",
    fullSymbolCanvas,
    fullGridCanvas,
    unitSymbolCanvas,
    unitGridCanvas,
    interactionCanvas,
  })({ state: bitmapState });
  const bitmapWritesAtDpr1 = bitmapCanvases.map((canvas) => canvas.sizeWrites);
  const bitmapOperationsAtDpr1 = bitmapCanvases.map(
    (canvas) => canvas.context.operations
  );
  assert.equal(fullSymbolCanvas.style.width, "40px");
  globalThis.devicePixelRatio = 2;
  bitmapComponent.syncState(bitmapState, ["chartPan"]);
  assert.equal(fullSymbolCanvas.width, 40);
  assert.equal(fullSymbolCanvas.height, 40);
  assert.equal(fullSymbolCanvas.style.width, "20px");
  assert.deepEqual(
    bitmapCanvases.map((canvas) => canvas.sizeWrites),
    bitmapWritesAtDpr1.map((writes) => writes + 2),
    "same-scale DPR change resets all bitmap canvas dimensions"
  );
  for (const index of [0, 1, 2, 3]) {
    assert.ok(
      bitmapCanvases[index].context.operations > bitmapOperationsAtDpr1[index],
      "same-scale DPR change redraws full and unit bitmap layers"
    );
  }
  const stableBitmapWrites = bitmapCanvases.map((canvas) => canvas.sizeWrites);
  const stableBitmapOperations = bitmapCanvases.map(
    (canvas) => canvas.context.operations
  );
  bitmapComponent.syncState(bitmapState, ["chartPan"]);
  assert.deepEqual(bitmapCanvases.map((canvas) => canvas.sizeWrites), stableBitmapWrites);
  assert.deepEqual(
    bitmapCanvases.map((canvas) => canvas.context.operations),
    stableBitmapOperations,
    "pan-only bitmap sync stays fast when DPR is unchanged"
  );

  stateModule.dispatch({ scale: 20 });
  globalThis.devicePixelRatio = 1;
  const yarnCanvas = new RenderCanvasDouble();
  const yarnState = {
    scale: 20,
    yarnSequence: new Bimp(1, 2, [0, 0]),
    yarnPalette: ["#000000"],
  };
  const yarnComponent = yarnSequenceCanvas({ canvas: yarnCanvas })({
    state: yarnState,
  });
  const yarnWritesAtDpr1 = yarnCanvas.sizeWrites;
  const yarnOperationsAtDpr1 = yarnCanvas.context.operations;
  assert.equal(yarnCanvas.style.height, "40px");
  globalThis.devicePixelRatio = 2;
  yarnComponent.syncState(yarnState, ["chartPan"]);
  assert.equal(yarnCanvas.width, 20);
  assert.equal(yarnCanvas.height, 40);
  assert.equal(yarnCanvas.style.width, "10px");
  assert.equal(yarnCanvas.style.height, "20px");
  assert.equal(yarnCanvas.sizeWrites, yarnWritesAtDpr1 + 2);
  assert.ok(yarnCanvas.context.operations > yarnOperationsAtDpr1);
  const stableYarnWrites = yarnCanvas.sizeWrites;
  const stableYarnOperations = yarnCanvas.context.operations;
  yarnComponent.syncState(yarnState, ["chartPan"]);
  assert.equal(yarnCanvas.sizeWrites, stableYarnWrites);
  assert.equal(yarnCanvas.context.operations, stableYarnOperations);

  const viewport = await server.ssrLoadModule("/src/chartViewport.js");
  assert.equal(viewport.cssCellSize(20, 2), 10);
  assert.equal(viewport.cssCellSize(20, 0), 20);
  assert.equal(viewport.cssCellSize(20, Number.NaN), 20);
  assert.equal(viewport.cssCellSize(20), 10, "explicit globalThis DPR fallback is safe");
  delete globalThis.devicePixelRatio;
  assert.equal(viewport.cssCellSize(20), 20, "helper runs without a browser DPR global");
  globalThis.devicePixelRatio = 2;
  assert.equal(viewport.clampChartScale(-100), 5);
  assert.equal(viewport.clampChartScale(500), 100);
  assert.equal(viewport.clampChartScale(24), 24);
  assert.deepEqual(
    viewport.fitVisibleCells({
      viewportWidth: 340,
      viewportHeight: 320,
      devicePixelRatio: 1,
    }),
    { scale: 20, pan: { x: 0, y: 0 } }
  );
  assert.equal(
    viewport.fitVisibleCells({
      viewportWidth: 340,
      viewportHeight: 320,
      devicePixelRatio: 2,
    }).scale,
    40
  );
  const cssFirstFit = viewport.fitVisibleCells({
    viewportWidth: 350,
    viewportHeight: 336,
    devicePixelRatio: 2,
  });
  assert.equal(
    cssFirstFit.scale,
    40,
    "fit floors the 20.588px CSS cell before applying DPR"
  );
  const fractionalDprFit = viewport.fitVisibleCells({
    viewportWidth: 350,
    viewportHeight: 336,
    devicePixelRatio: 1.25,
  });
  assert.equal(fractionalDprFit.scale, 25);
  assert.equal(Number.isFinite(fractionalDprFit.scale), true);
  assert.equal(
    viewport.fitVisibleCells({
      viewportWidth: 17,
      viewportHeight: 16,
      devicePixelRatio: 1,
    }).scale,
    5,
    "fit clamps to the existing minimum"
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
  const boundaryPan = { x: 9, y: -4 };
  const boundaryZoom = viewport.zoomViewportAtPoint({
    pan: boundaryPan,
    scale: 100,
    nextScale: 101,
    point: { x: 140, y: 80 },
    devicePixelRatio: 1,
  });
  assert.equal(boundaryZoom.scale, 100);
  assert.equal(boundaryZoom.pan, boundaryPan, "out-of-range zoom preserves pan identity");
  for (const overrides of [
    { nextScale: Number.NaN },
    { nextScale: Number.POSITIVE_INFINITY },
    { scale: Number.NaN },
    { scale: Number.NEGATIVE_INFINITY },
    { pan: { x: Number.POSITIVE_INFINITY, y: 0 } },
    { point: { x: 0, y: Number.NaN } },
  ]) {
    const input = {
      pan: { x: 10, y: 20 },
      scale: 20,
      nextScale: 24,
      point: { x: 100, y: 120 },
      devicePixelRatio: 1,
      ...overrides,
    };
    const result = viewport.zoomViewportAtPoint(input);
    assert.equal(result.pan, input.pan, "invalid viewport input preserves pan identity");
    assert.equal(
      Object.is(result.scale, input.scale),
      true,
      "invalid viewport input preserves current scale"
    );
  }

  const { chartPointerPanZoom } = await server.ssrLoadModule(
    "/src/events/chartPointerPanZoom.js"
  );
  const firstWindow = new EventTargetDouble({
    left: 50,
    top: 60,
    width: 320,
    height: 300,
  });
  const secondWindow = new EventTargetDouble({
    left: 400,
    top: 80,
    width: 300,
    height: 280,
  });
  const firstWheelFrames = [];
  const secondWheelFrames = [];
  chartPointerPanZoom(firstWindow, {
    requestFrame: (callback) => firstWheelFrames.push(callback),
  });
  chartPointerPanZoom(secondWindow, {
    requestFrame: (callback) => secondWheelFrames.push(callback),
  });
  assert.deepEqual(firstWindow.listenerOptions("wheel"), [{ passive: false }]);
  assert.deepEqual(secondWindow.listenerOptions("wheel"), [{ passive: false }]);

  const observedChanges = [];
  stateModule.StateMonitor.register([
    () => ({
      syncState(state, changes) {
        observedChanges.push({
          changes,
          scale: state.scale,
          pan: state.chartPan,
        });
      },
    }),
  ]);
  stateModule.dispatch({
    scale: 20,
    chartPan: { x: 0, y: 0 },
    reverseScroll: false,
  });
  observedChanges.length = 0;
  for (let index = 0; index < 4; index++) {
    const tinyWheel = firstWindow.dispatch("wheel", {
      clientX: 150,
      clientY: 180,
      deltaY: -20,
    });
    assert.equal(tinyWheel.preventDefaultCalls(), 1);
  }
  assert.equal(observedChanges.length, 0, "tiny wheel events never dispatch synchronously");
  assert.equal(firstWheelFrames.length, 1, "tiny wheel events share one frame");
  firstWheelFrames.shift()();
  assert.equal(observedChanges.length, 0, "subthreshold wheel delta is retained");
  const thresholdWheel = firstWindow.dispatch("wheel", {
    clientX: 150,
    clientY: 180,
    deltaY: -20,
  });
  assert.equal(thresholdWheel.preventDefaultCalls(), 1);
  assert.equal(observedChanges.length, 0);
  assert.equal(firstWheelFrames.length, 1);
  firstWheelFrames.shift()();
  assert.deepEqual(observedChanges.at(-1), {
    changes: ["scale", "chartPan"],
    scale: 21,
    pan: { x: -5, y: -6 },
  });
  assert.equal(stateModule.GLOBAL_STATE.scale, 21);
  assert.deepEqual(stateModule.GLOBAL_STATE.chartPan, { x: -5, y: -6 });

  stateModule.dispatch({ scale: 20, chartPan: { x: 0, y: 0 }, reverseScroll: false });
  observedChanges.length = 0;
  firstWindow.dispatch("wheel", {
    clientX: 140,
    clientY: 170,
    deltaY: -160,
  });
  firstWindow.dispatch("wheel", {
    clientX: 150,
    clientY: 180,
    deltaY: -140,
  });
  assert.equal(firstWheelFrames.length, 1, "large wheel events coalesce per frame");
  assert.equal(observedChanges.length, 0);
  firstWheelFrames.shift()();
  assert.equal(observedChanges.length, 1, "one frame produces one wheel dispatch");
  assert.equal(stateModule.GLOBAL_STATE.scale, 23);

  stateModule.dispatch({ scale: 20, chartPan: { x: 0, y: 0 }, reverseScroll: false });
  observedChanges.length = 0;
  firstWindow.dispatch("wheel", {
    clientX: 150,
    clientY: 180,
    deltaY: -2.5,
    deltaMode: 1,
  });
  assert.equal(observedChanges.length, 0);
  firstWheelFrames.shift()();
  assert.equal(stateModule.GLOBAL_STATE.scale, 21, "line deltas normalize to pixels");

  stateModule.dispatch({ scale: 20, chartPan: { x: 0, y: 0 }, reverseScroll: false });
  observedChanges.length = 0;
  firstWindow.dispatch("wheel", {
    clientX: 150,
    clientY: 180,
    deltaY: 60,
  });
  firstWheelFrames.shift()();
  assert.equal(observedChanges.length, 0, "subthreshold residue does not dispatch");
  firstWindow.dispatch("wheel", {
    clientX: 150,
    clientY: 180,
    deltaY: -100,
  });
  firstWheelFrames.shift()();
  assert.equal(
    stateModule.GLOBAL_STATE.scale,
    21,
    "a reversed gesture discards the previous subthreshold residue"
  );

  stateModule.dispatch({ scale: 20, chartPan: { x: 0, y: 0 }, reverseScroll: false });
  observedChanges.length = 0;
  firstWindow.dispatch("wheel", {
    clientX: 150,
    clientY: 180,
    deltaY: -2500,
  });
  firstWheelFrames.shift()();
  assert.equal(stateModule.GLOBAL_STATE.scale, 30);
  assert.equal(firstWheelFrames.length, 1, "capped wheel residual schedules another frame");
  firstWheelFrames.shift()();
  assert.equal(stateModule.GLOBAL_STATE.scale, 40);
  assert.equal(firstWheelFrames.length, 1);
  firstWheelFrames.shift()();
  assert.equal(stateModule.GLOBAL_STATE.scale, 45);
  assert.equal(firstWheelFrames.length, 0, "wheel residual drains without another event");
  assert.equal(observedChanges.length, 3, "large gesture dispatches at most once per frame");

  stateModule.dispatch({ scale: 95, chartPan: { x: 0, y: 0 }, reverseScroll: false });
  observedChanges.length = 0;
  firstWindow.dispatch("wheel", {
    clientX: 150,
    clientY: 180,
    deltaY: -1000,
  });
  firstWheelFrames.shift()();
  assert.equal(stateModule.GLOBAL_STATE.scale, 100, "wheel overshoot reaches MAX_SCALE");
  assert.equal(observedChanges.length, 1);

  stateModule.dispatch({ scale: 7, chartPan: { x: 0, y: 0 }, reverseScroll: false });
  observedChanges.length = 0;
  firstWindow.dispatch("wheel", {
    clientX: 150,
    clientY: 180,
    deltaY: 1000,
  });
  firstWheelFrames.shift()();
  assert.equal(stateModule.GLOBAL_STATE.scale, 5, "wheel overshoot reaches MIN_SCALE");
  assert.equal(observedChanges.length, 1);

  stateModule.dispatch({ scale: 20, chartPan: { x: 0, y: 0 }, reverseScroll: true });
  observedChanges.length = 0;
  secondWindow.dispatch("wheel", {
    clientX: 550,
    clientY: 220,
    deltaY: -1,
    deltaMode: 2,
  });
  assert.equal(observedChanges.length, 0);
  secondWheelFrames.shift()();
  assert.equal(stateModule.GLOBAL_STATE.scale, 18, "page deltas and reverse scroll are honored");
  assert.deepEqual(observedChanges.at(-1).changes, ["scale", "chartPan"]);

  const maxPan = { x: 12, y: 15 };
  stateModule.dispatch({ scale: 100, chartPan: maxPan, reverseScroll: false });
  observedChanges.length = 0;
  const boundaryWheel = firstWindow.dispatch("wheel", {
    clientX: 130,
    clientY: 140,
    deltaY: -100,
  });
  assert.equal(boundaryWheel.preventDefaultCalls(), 1);
  assert.equal(observedChanges.length, 0);
  firstWheelFrames.shift()();
  assert.equal(observedChanges.length, 0, "wheel boundary is a dispatch-free no-op");
  assert.equal(stateModule.GLOBAL_STATE.chartPan, maxPan);

  stateModule.dispatch({ scale: 99, chartPan: { x: 0, y: 0 }, reverseScroll: false });
  firstWindow.dispatch("wheel", {
    clientX: 150,
    clientY: 180,
    deltaY: -1150,
  });
  firstWheelFrames.shift()();
  assert.equal(stateModule.GLOBAL_STATE.scale, 100);
  assert.equal(firstWheelFrames.length, 0, "MAX_SCALE discards an outward drain frame");

  stateModule.dispatch({ scale: 99, chartPan: { x: 0, y: 0 }, reverseScroll: false });
  observedChanges.length = 0;
  firstWindow.dispatch("wheel", {
    clientX: 150,
    clientY: 180,
    deltaY: -150,
  });
  firstWheelFrames.shift()();
  assert.equal(stateModule.GLOBAL_STATE.scale, 100);
  firstWindow.dispatch("wheel", {
    clientX: 150,
    clientY: 180,
    deltaY: 100,
  });
  firstWheelFrames.shift()();
  assert.equal(
    stateModule.GLOBAL_STATE.scale,
    99,
    "MAX_SCALE clears outward residue so reversal responds immediately"
  );

  stateModule.dispatch({ scale: 6, chartPan: { x: 0, y: 0 }, reverseScroll: false });
  firstWindow.dispatch("wheel", {
    clientX: 150,
    clientY: 180,
    deltaY: 1150,
  });
  firstWheelFrames.shift()();
  assert.equal(stateModule.GLOBAL_STATE.scale, 5);
  assert.equal(firstWheelFrames.length, 0, "MIN_SCALE discards an outward drain frame");

  stateModule.dispatch({ scale: 6, chartPan: { x: 0, y: 0 }, reverseScroll: false });
  observedChanges.length = 0;
  firstWindow.dispatch("wheel", {
    clientX: 150,
    clientY: 180,
    deltaY: 150,
  });
  firstWheelFrames.shift()();
  assert.equal(stateModule.GLOBAL_STATE.scale, 5);
  firstWindow.dispatch("wheel", {
    clientX: 150,
    clientY: 180,
    deltaY: -100,
  });
  firstWheelFrames.shift()();
  assert.equal(
    stateModule.GLOBAL_STATE.scale,
    6,
    "MIN_SCALE clears outward residue so reversal responds immediately"
  );

  stateModule.dispatch({ scale: 99, chartPan: { x: 0, y: 0 }, reverseScroll: true });
  secondWindow.dispatch("wheel", {
    clientX: 550,
    clientY: 220,
    deltaY: 1150,
  });
  secondWheelFrames.shift()();
  assert.equal(stateModule.GLOBAL_STATE.scale, 100);
  assert.equal(
    secondWheelFrames.length,
    0,
    "reverseScroll discards the mapped outward drain frame"
  );

  stateModule.dispatch({ scale: 99, chartPan: { x: 0, y: 0 }, reverseScroll: true });
  observedChanges.length = 0;
  secondWindow.dispatch("wheel", {
    clientX: 550,
    clientY: 220,
    deltaY: 150,
  });
  secondWheelFrames.shift()();
  assert.equal(stateModule.GLOBAL_STATE.scale, 100);
  secondWindow.dispatch("wheel", {
    clientX: 550,
    clientY: 220,
    deltaY: -100,
  });
  secondWheelFrames.shift()();
  assert.equal(
    stateModule.GLOBAL_STATE.scale,
    99,
    "reverseScroll clears the correct outward residue at MAX_SCALE"
  );

  const leftDown = firstWindow.dispatch("pointerdown", {
    button: 0,
    buttons: 1,
    pointerId: 4,
  });
  assert.equal(leftDown.preventDefaultCalls(), 0, "left pointer remains available to brush");
  assert.equal(firstWindow.captureCalls.includes(4), false);

  stateModule.dispatch({ chartPan: { x: 10, y: 20 } });
  observedChanges.length = 0;
  const middleDown = firstWindow.dispatch("pointerdown", {
    button: 1,
    buttons: 4,
    pointerId: 7,
    clientX: 100,
    clientY: 120,
  });
  assert.equal(middleDown.preventDefaultCalls(), 1);
  assert.equal(firstWindow.hasPointerCapture(7), true);
  assert.equal(firstWindow.listenerCount("pointermove"), 1);
  const secondDown = firstWindow.dispatch("pointerdown", {
    button: 1,
    buttons: 4,
    pointerId: 8,
    clientX: 200,
    clientY: 220,
  });
  assert.equal(secondDown.preventDefaultCalls(), 0, "a second pan pointer is ignored");
  assert.equal(firstWindow.hasPointerCapture(8), false);
  firstWindow.dispatch("pointermove", {
    pointerId: 8,
    clientX: 500,
    clientY: 500,
  });
  assert.equal(observedChanges.length, 0, "foreign pointer movement is ignored");
  firstWindow.dispatch("pointermove", {
    pointerId: 7,
    clientX: 130,
    clientY: 110,
  });
  assert.deepEqual(stateModule.GLOBAL_STATE.chartPan, { x: 40, y: 10 });
  assert.deepEqual(observedChanges.at(-1).changes, ["chartPan"]);
  firstWindow.dispatch("pointerup", { pointerId: 8 });
  assert.equal(firstWindow.hasPointerCapture(7), true, "foreign pointerup is ignored");
  firstWindow.dispatch("pointerup", { pointerId: 7 });
  assert.equal(firstWindow.hasPointerCapture(7), false);
  assert.equal(firstWindow.releaseCalls.filter((id) => id === 7).length, 1);
  for (const type of ["pointermove", "pointerup", "pointercancel", "lostpointercapture"]) {
    assert.equal(firstWindow.listenerCount(type), 0, `${type} listener is cleaned once`);
    assert.equal(firstWindow.removalCalls.filter((removed) => removed === type).length, 1);
  }
  firstWindow.dispatch("pointercancel", { pointerId: 7 });
  firstWindow.dispatch("lostpointercapture", { pointerId: 7 });
  assert.equal(firstWindow.releaseCalls.filter((id) => id === 7).length, 1);

  for (const endingType of ["pointercancel", "lostpointercapture"]) {
    const pointerId = endingType === "pointercancel" ? 9 : 10;
    firstWindow.dispatch("pointerdown", {
      button: 1,
      buttons: 4,
      pointerId,
      clientX: 20,
      clientY: 30,
    });
    if (endingType === "lostpointercapture") {
      firstWindow.losePointerCapture(pointerId);
    } else {
      firstWindow.dispatch(endingType, { pointerId });
    }
    assert.equal(firstWindow.listenerCount("pointermove"), 0);
    assert.equal(firstWindow.hasPointerCapture(pointerId), false);
  }
  const auxMiddle = firstWindow.dispatch("auxclick", { button: 1 });
  const auxLeft = firstWindow.dispatch("auxclick", { button: 0 });
  assert.equal(auxMiddle.preventDefaultCalls(), 1);
  assert.equal(auxLeft.preventDefaultCalls(), 0);

  const zoomFit = await server.ssrLoadModule("/src/actions/zoomFit.js");
  assert.equal(typeof zoomFit.createChartFitScheduler, "function");
  const fitFrames = [];
  let scheduledFits = 0;
  const scheduleChartFit = zoomFit.createChartFitScheduler({
    fit: () => {
      scheduledFits += 1;
    },
    requestFrame: (callback) => fitFrames.push(callback),
  });
  scheduleChartFit();
  scheduleChartFit();
  scheduleChartFit();
  assert.equal(fitFrames.length, 1, "fit requests coalesce into one frame");
  assert.equal(scheduledFits, 0);
  fitFrames.shift()();
  assert.equal(scheduledFits, 1, "one frame runs one chart fit");
  scheduleChartFit();
  assert.equal(fitFrames.length, 1, "scheduler accepts a later frame");
  const originalDocument = globalThis.document;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  function viewportDouble(clientWidth, clientHeight) {
    return {
      clientWidth,
      clientHeight,
      getBoundingClientRect: () => ({ width: clientWidth, height: clientHeight }),
    };
  }
  const viewports = [viewportDouble(364, 344), viewportDouble(347, 328)];
  let fitViewports = viewports;
  globalThis.document = {
    querySelector(selector) {
      if (selector === ".pattern-grid-window") {
        return {
          getBoundingClientRect: () => ({ width: 200, height: 100 }),
        };
      }
      if (selector === "#cam-editor-pane .pattern-editor-viewport") {
        return fitViewports[0];
      }
      if (selector === "#needle-editor-pane .pattern-editor-viewport") {
        return fitViewports[1];
      }
      assert.fail(`unexpected selector: ${selector}`);
    },
  };
  globalThis.getComputedStyle = () => ({
    paddingLeft: "12px",
    paddingRight: "12px",
    paddingTop: "12px",
    paddingBottom: "12px",
  });
  const centerPan = { x: 10, y: 20 };
  stateModule.dispatch({ scale: 20, chartPan: centerPan });
  observedChanges.length = 0;
  for (const invalidScale of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    zoomFit.centerZoom(invalidScale);
  }
  assert.equal(observedChanges.length, 0, "nonfinite center zoom never dispatches");
  assert.equal(stateModule.GLOBAL_STATE.scale, 20);
  assert.equal(stateModule.GLOBAL_STATE.chartPan, centerPan);
  zoomFit.centerZoom(101);
  assert.equal(observedChanges.length, 0, "zoom above MAX_SCALE does not dispatch");
  assert.equal(stateModule.GLOBAL_STATE.scale, 20);
  assert.equal(stateModule.GLOBAL_STATE.chartPan, centerPan);
  zoomFit.centerZoom(4);
  assert.equal(observedChanges.length, 0, "zoom below MIN_SCALE does not dispatch");
  assert.equal(stateModule.GLOBAL_STATE.scale, 20);
  assert.equal(stateModule.GLOBAL_STATE.chartPan, centerPan);
  observedChanges.length = 0;
  zoomFit.centerZoom(22);
  assert.deepEqual(observedChanges.at(-1), {
    changes: ["scale", "chartPan"],
    scale: 22,
    pan: { x: 1, y: 17 },
  });
  globalThis.devicePixelRatio = 1;
  observedChanges.length = 0;
  zoomFit.fitChart();
  assert.deepEqual(observedChanges.at(-1), {
    changes: ["scale", "chartPan"],
    scale: 19,
    pan: { x: 0, y: 0 },
  });
  fitViewports = [viewportDouble(364, 344), viewportDouble(0, 0)];
  observedChanges.length = 0;
  zoomFit.fitChart();
  assert.deepEqual(observedChanges.at(-1), {
    changes: ["scale", "chartPan"],
    scale: 20,
    pan: { x: 0, y: 0 },
  });
  const noFitPan = { x: 7, y: 9 };
  stateModule.dispatch({ scale: 20, chartPan: noFitPan });
  observedChanges.length = 0;
  fitViewports = [
    viewportDouble(0, 0),
    viewportDouble(Number.NaN, Number.POSITIVE_INFINITY),
  ];
  zoomFit.fitChart();
  assert.equal(observedChanges.length, 0, "no usable pane makes fit a no-op");
  assert.equal(stateModule.GLOBAL_STATE.scale, 20);
  assert.equal(stateModule.GLOBAL_STATE.chartPan, noFitPan);
  globalThis.document = originalDocument;
  globalThis.getComputedStyle = originalGetComputedStyle;
} finally {
  try {
    if (server) await server.close();
  } finally {
    try {
      if (dom) dom.window.close();
    } finally {
      for (const [name, descriptor] of previousGlobals) {
        if (descriptor) {
          Object.defineProperty(globalThis, name, descriptor);
        } else {
          delete globalThis[name];
        }
      }
    }
  }
}

const stateSource = fs.readFileSync("src/state.js", "utf8");
const editorSource = fs.readFileSync("src/views/bitmapEditor.js", "utf8");
const indexSource = fs.readFileSync("src/index.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");
assert.doesNotMatch(stateSource, /\b(?:chartScale|camPan|needlePan)\b/);
assert.doesNotMatch(editorSource, /\b(?:chartScale|camPan|needlePan)\b/);
assert.match(indexSource, /querySelectorAll\(\s*"\.pattern-grid-window"\s*\)/);
assert.match(indexSource, /chartWindows\.forEach\(\s*chartPointerPanZoom\s*\)/);
assert.equal(
  (indexSource.match(/onDragEnd:\s*scheduleChartFit/g) || []).length,
  2,
  "both Split instances schedule a fit after dragging"
);
assert.match(indexSource, /const scheduleChartFit\s*=\s*createChartFitScheduler\(\)/);
assert.match(indexSource, /window\.onresize\s*=\s*\(\)\s*=>\s*\{\s*measureWindow\(\);\s*scheduleChartFit\(\);\s*\}/);
assert.match(
  styles,
  /\.pattern-editor-stage\s*\{[\s\S]*?width:\s*min\(100%,\s*calc\(\(var\(--visible-cells\) \+ 1\) \* var\(--chart-cell-size\)\)\)[\s\S]*?height:\s*min\(100%,\s*calc\(var\(--visible-cells\) \* var\(--chart-cell-size\)\)\)/
);
for (const selector of [".yarn-sequence-track", ".pattern-canvas-transform"]) {
  assert.match(
    styles,
    new RegExp(`${selector.replace(".", "\\.")}\\s*\\{[\\s\\S]*?transform-origin:\\s*0 0`)
  );
}
assert.match(
  styles,
  /\.pattern-editor-viewport\s*\{[^}]*overflow:\s*hidden\b/
);
assert.doesNotMatch(
  styles.match(/\.pattern-editor-viewport\s*\{[^}]*\}/)?.[0] || "",
  /overflow:\s*(?:auto|scroll)/
);

console.log("PASS: both repeat editors share a 16x16 chart viewport and pan/zoom interaction.");
