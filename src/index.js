import "@fortawesome/fontawesome-free/css/all.min.css";
import { render } from "lit-html";
import Split from "split.js";

import { fitChart } from "./actions/zoomFit.js";
import { initCodeGuideEvents } from "./codeGuide/codeGuideEvents.js";
import { isCodeGuideMode } from "./codeGuide/mode.js";
import { drawBitmapEditor } from "./components/drawBitmapEditor.js";
import { drawYarnColors } from "./components/drawYarnColors.js";
import { createAppRenderer } from "./components/renderApp.js";
import { runSimulation } from "./components/runSimulation.js";
import { yarnSequenceCanvas } from "./components/yarnSequenceCanvas.js";
import { bitmapPointerInteraction } from "./events/bitmapPointerInteraction.js";
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

function initKeyboard(yarnSequenceCanvasElement, simContainer) {
  addKeypressListeners();
  colorSequencePointerInteraction(yarnSequenceCanvasElement);
  simulationPointerInteraction(simContainer);
  closeModals();
}

function initTouch(yarnSequenceCanvasElement, simContainer) {
  document.body.style.setProperty("--font-size", "1.1rem");
  colorSequenceTouchInteraction(yarnSequenceCanvasElement);
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
  const camInteractionCanvas = document.getElementById(
    "cam-interaction-canvas"
  );
  const needleSymbolCanvas = document.getElementById("symbol-canvas");
  const needleGridCanvas = document.getElementById("grid");
  const needleInteractionCanvas = document.getElementById(
    "needle-interaction-canvas"
  );
  const yarnColorCanvas = document.getElementById("yarn-color-canvas");
  const yarnSequenceCanvasElement = document.getElementById(
    "needle-yarn-sequence-canvas"
  );
  const simContainer = document.getElementById("sim-container");

  Split(["#chart-pane", "#sim-pane"], {
    sizes: [60, 40],
    minSize: 100,
    gutterSize: 11,
  });

  Split(["#cam-editor-pane", "#needle-editor-pane"], {
    sizes: [50, 50],
    minSize: 90,
    gutterSize: 9,
    direction: "vertical",
  });

  if (isCodeGuideMode()) {
    document
      .querySelector("#site > .gutter")
      ?.setAttribute("data-code-guide-key", "layout.split"); // data-code-guide-key="layout.split"
    document
      .querySelector("#pattern-editors > .gutter")
      ?.setAttribute("data-code-guide-key", "layout.editor-split"); // data-code-guide-key="layout.editor-split"
    initCodeGuideEvents();
  } else {
    bitmapPointerInteraction(camInteractionCanvas);
    bitmapPointerInteraction(needleInteractionCanvas);
    isMobile()
      ? initTouch(yarnSequenceCanvasElement, simContainer)
      : initKeyboard(yarnSequenceCanvasElement, simContainer);
  }

  StateMonitor.register([
    () => appRenderer,
    yarnSequenceCanvas({ canvas: yarnSequenceCanvasElement }),
    drawYarnColors(yarnColorCanvas),
    drawBitmapEditor({
      field: "camBitmap",
      symbolCanvas: camSymbolCanvas,
      gridCanvas: camGridCanvas,
      interactionCanvas: camInteractionCanvas,
    }),
    drawBitmapEditor({
      field: "needleBitmap",
      symbolCanvas: needleSymbolCanvas,
      gridCanvas: needleGridCanvas,
      interactionCanvas: needleInteractionCanvas,
    }),
    runSimulation(),
  ]);

  measureWindow();
  fitChart();
}

window.onload = init;
window.onresize = measureWindow;
