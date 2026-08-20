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
  chartPointerPanZoom(firstWindow);
  chartPointerPanZoom(secondWindow);
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
  const wheelIn = firstWindow.dispatch("wheel", {
    clientX: 150,
    clientY: 180,
    deltaY: -1,
  });
  assert.equal(wheelIn.preventDefaultCalls(), 1);
  assert.deepEqual(observedChanges.at(-1), {
    changes: ["scale", "chartPan"],
    scale: 21,
    pan: { x: -5, y: -6 },
  });
  assert.equal(stateModule.GLOBAL_STATE.scale, 21);
  assert.deepEqual(stateModule.GLOBAL_STATE.chartPan, { x: -5, y: -6 });

  stateModule.dispatch({ reverseScroll: true });
  observedChanges.length = 0;
  secondWindow.dispatch("wheel", {
    clientX: 550,
    clientY: 220,
    deltaY: -1,
  });
  assert.equal(stateModule.GLOBAL_STATE.scale, 20, "reverse scroll flips zoom direction");
  assert.deepEqual(observedChanges.at(-1).changes, ["scale", "chartPan"]);

  const maxPan = { x: 12, y: 15 };
  stateModule.dispatch({ scale: 100, chartPan: maxPan, reverseScroll: false });
  observedChanges.length = 0;
  const boundaryWheel = firstWindow.dispatch("wheel", {
    clientX: 130,
    clientY: 140,
    deltaY: -1,
  });
  assert.equal(boundaryWheel.preventDefaultCalls(), 1);
  assert.equal(observedChanges.length, 0, "wheel boundary is a dispatch-free no-op");
  assert.equal(stateModule.GLOBAL_STATE.chartPan, maxPan);

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
  const originalDocument = globalThis.document;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const viewports = [
    { clientWidth: 364, clientHeight: 344 },
    { clientWidth: 347, clientHeight: 328 },
  ].map((dimensions) => ({
    ...dimensions,
    getBoundingClientRect: () => ({ width: dimensions.clientWidth, height: dimensions.clientHeight }),
  }));
  globalThis.document = {
    querySelector(selector) {
      if (selector === ".pattern-grid-window") {
        return {
          getBoundingClientRect: () => ({ width: 200, height: 100 }),
        };
      }
      if (selector === "#cam-editor-pane .pattern-editor-viewport") {
        return viewports[0];
      }
      if (selector === "#needle-editor-pane .pattern-editor-viewport") {
        return viewports[1];
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
  stateModule.dispatch({ scale: 20, chartPan: { x: 10, y: 20 } });
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
assert.match(indexSource, /window\.onresize\s*=\s*\(\)\s*=>\s*\{\s*measureWindow\(\);\s*fitChart\(\);\s*\}/);
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
