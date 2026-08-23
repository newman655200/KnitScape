import "@fortawesome/fontawesome-free/css/all.min.css";
import { render } from "lit-html";
import Split from "split.js";

import { createChartFitScheduler, fitChart } from "./actions/zoomFit.js";
import { initCodeGuideEvents } from "./codeGuide/codeGuideEvents.js";
import { isCodeGuideMode } from "./codeGuide/mode.js";
import { subscribeCodeGuideState } from "./codeGuide/codeGuideState.js";
import { drawBitmapEditor } from "./components/drawBitmapEditor.js";
import { createAppRenderer } from "./components/renderApp.js";
import { runSimulation } from "./components/runSimulation.js";
import { yarnSequenceCanvas } from "./components/yarnSequenceCanvas.js";
import { bitmapPointerInteraction } from "./events/bitmapPointerInteraction.js";
import { chartPointerPanZoom } from "./events/chartPointerPanZoom.js";
import { closeModals } from "./events/closeModals.js";
import { colorSequencePointerInteraction } from "./events/colorSequencePointerInteraction.js";
import { colorSequenceTouchInteraction } from "./events/colorSequenceTouchInteraction.js";
import { addKeypressListeners } from "./events/keypressEvents.js";
import { simulationPointerInteraction } from "./events/simulationPointerInteraction.js";
import { simulationTouchInteraction } from "./events/simulationTouchInteraction.js";
import { StateMonitor } from "./state.js";
import { isMobile } from "./utils.js";
import { view } from "./views/view.js";

const appRenderer = createAppRenderer({
  renderView: () => render(view(), document.body),
});
const scheduleChartFit = createChartFitScheduler();

function initKeyboard(yarnSequenceCanvasElements, simContainer) {
  addKeypressListeners();
  yarnSequenceCanvasElements.forEach(colorSequencePointerInteraction);
  simulationPointerInteraction(simContainer);
  closeModals();
}

function initTouch(yarnSequenceCanvasElements, simContainer) {
  document.body.style.setProperty("--font-size", "1.1rem");
  yarnSequenceCanvasElements.forEach(colorSequenceTouchInteraction);
  simulationTouchInteraction(simContainer);
  closeModals();
}

function measureWindow() {
  document.documentElement.style.setProperty(
    "--vh",
    `${window.innerHeight * 0.01}px`
  );
  document.documentElement.style.setProperty(
    "--vw",
    `${window.innerWidth * 0.01}px`
  );
}

function init() {
  appRenderer.renderInitial();

  const camSymbolCanvas = document.getElementById("cam-symbol-canvas");
  const camGridCanvas = document.getElementById("cam-grid");
  const camUnitSymbolCanvas = document.getElementById("cam-unit-symbol-canvas");
  const camUnitGridCanvas = document.getElementById("cam-unit-grid");
  const camInteractionCanvas = document.getElementById(
    "cam-interaction-canvas"
  );
  const needleSymbolCanvas = document.getElementById("symbol-canvas");
  const needleGridCanvas = document.getElementById("grid");
  const needleUnitSymbolCanvas = document.getElementById(
    "needle-unit-symbol-canvas"
  );
  const needleUnitGridCanvas = document.getElementById("needle-unit-grid");
  const needleInteractionCanvas = document.getElementById(
    "needle-interaction-canvas"
  );
  const chartWindows = [
    ...document.querySelectorAll(".pattern-grid-window"),
  ];
  const camYarnSequenceCanvas = document.getElementById(
    "cam-yarn-sequence-canvas"
  );
  const needleYarnSequenceCanvas = document.getElementById(
    "needle-yarn-sequence-canvas"
  );
  const yarnSequenceCanvasElements = [
    camYarnSequenceCanvas,
    needleYarnSequenceCanvas,
  ];
  const simContainer = document.getElementById("sim-container");

  Split(["#chart-pane", "#sim-pane"], {
    sizes: [60, 40],
    minSize: 100,
    gutterSize: 11,
    onDragEnd: scheduleChartFit,
  });

  Split(["#cam-editor-pane", "#needle-editor-pane"], {
    sizes: [50, 50],
    minSize: 90,
    gutterSize: 9,
    direction: "vertical",
    onDragEnd: scheduleChartFit,
  });

  if (isCodeGuideMode()) {
    const unsubscribeCodeGuideState = subscribeCodeGuideState(
      appRenderer.syncState
    );
    window.addEventListener("pagehide", unsubscribeCodeGuideState, {
      once: true,
    });
    document
      .querySelector("#site > .gutter")
      ?.setAttribute("data-code-guide-key", "layout.split"); // data-code-guide-key="layout.split"
    document
      .querySelector("#pattern-editors > .gutter")
      ?.setAttribute("data-code-guide-key", "layout.editor-split"); // data-code-guide-key="layout.editor-split"
    initCodeGuideEvents();
  } else {
    chartWindows.forEach(chartPointerPanZoom);
    bitmapPointerInteraction(camInteractionCanvas);
    bitmapPointerInteraction(needleInteractionCanvas);
    isMobile()
      ? initTouch(yarnSequenceCanvasElements, simContainer)
      : initKeyboard(yarnSequenceCanvasElements, simContainer);
  }

  StateMonitor.register([
    () => appRenderer,
    yarnSequenceCanvas({ canvas: camYarnSequenceCanvas }),
    yarnSequenceCanvas({ canvas: needleYarnSequenceCanvas }),
    drawBitmapEditor({
      fullField: "camBitmap",
      unitField: "camUnitBitmap",
      fullSymbolCanvas: camSymbolCanvas,
      fullGridCanvas: camGridCanvas,
      unitSymbolCanvas: camUnitSymbolCanvas,
      unitGridCanvas: camUnitGridCanvas,
      interactionCanvas: camInteractionCanvas,
    }),
    drawBitmapEditor({
      fullField: "needleBitmap",
      unitField: "needleUnitBitmap",
      fullSymbolCanvas: needleSymbolCanvas,
      fullGridCanvas: needleGridCanvas,
      unitSymbolCanvas: needleUnitSymbolCanvas,
      unitGridCanvas: needleUnitGridCanvas,
      interactionCanvas: needleInteractionCanvas,
    }),
    runSimulation(),
  ]);

  measureWindow();
  fitChart();
}

window.onload = init;
window.onresize = () => {
  measureWindow();
  scheduleChartFit();
};
