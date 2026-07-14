import { simulate } from "../simulation/yarnSimulation";
import { GLOBAL_STATE, dispatch } from "../state";
import { html } from "lit-html";
import { MIN_SIM_SCALE, MAX_SIM_SCALE } from "../constants";
import { centerZoomSimulation } from "../actions/zoomFit";
import {
  beginTexturePreviewInteraction,
  endTexturePreviewInteraction,
} from "../actions/texturePerformance";
import { buttonIcon } from "../views/uiButton";
import { t } from "../i18n";
let stopSim;

function runPreviewInteraction(action) {
  beginTexturePreviewInteraction();
  action();
  endTexturePreviewInteraction();
}

export function simulationView() {
  const language = GLOBAL_STATE.language;
  const previewScale = GLOBAL_STATE.simPreviewScale || GLOBAL_STATE.simScale;
  const previewPan = GLOBAL_STATE.simPreviewPan || GLOBAL_STATE.simPan;
  const previewRatio = previewScale / GLOBAL_STATE.simScale;

  return html`<div id="sim-pane">
    <div id="sim-container" data-code-guide-key="simulation.canvas">
      <div
        id="sim-transform-group"
        style="transform: translate(${previewPan.x}px, ${previewPan
          .y}px) scale(${previewRatio})"
        class=${GLOBAL_STATE.flipped ? "mirrored" : ""}>
        <canvas
          id="back"
          class=${GLOBAL_STATE.flipped ? "top" : "bottom"}></canvas>
        <canvas id="mid" class="mid"></canvas>
        <canvas
          id="front"
          class=${GLOBAL_STATE.flipped ? "bottom" : "top"}></canvas>
      </div>
    </div>
    <div id="sim-controls" class="panzoom-controls">
      <button
        data-code-guide-key="simulation.flip"
        @click=${() => dispatch({ flipped: !GLOBAL_STATE.flipped })}
        class="btn solid">
        ${buttonIcon("flip", t("simulation.flip", language))}
      </button>
      <button
        data-code-guide-key="simulation.zoom-out"
        class="btn icon"
        @click=${() =>
          runPreviewInteraction(() =>
            centerZoomSimulation(GLOBAL_STATE.simScale * 0.9)
          )}>
        ${buttonIcon("zoomOut", t("simulation.zoomOut", language))}
      </button>
      <input
        data-code-guide-key="simulation.zoom-range"
        type="range"
        min=${MIN_SIM_SCALE}
        max=${MAX_SIM_SCALE}
        step="0.1"
        .value=${String(GLOBAL_STATE.simScale)}
        @input=${(e) =>
          runPreviewInteraction(() =>
            centerZoomSimulation(Number(e.target.value))
          )} />
      <button
        data-code-guide-key="simulation.zoom-in"
        class="btn icon"
        @click=${() =>
          runPreviewInteraction(() =>
            centerZoomSimulation(GLOBAL_STATE.simScale * 1.1)
          )}>
        ${buttonIcon("zoomIn", t("simulation.zoomIn", language))}
      </button>
      <button
        data-code-guide-key="simulation.fit"
        @click=${() =>
          runPreviewInteraction(() =>
            dispatch({ simPan: { x: 0, y: 0 }, simScale: 1 })
          )}
        class="btn icon">
        ${buttonIcon("fit", t("simulation.fit", language))}
      </button>
    </div>
  </div>`;
}

const debounce = (callback, wait) => {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback.apply(null, args);
    }, wait);
  };
};

export function stopSimulation() {
  if (stopSim) stopSim();
}

export function runSimulation() {
  return ({ state }) => {
    let queueSim = false;

    function run() {
      queueSim = false;

      if (stopSim) stopSim();

      const simulationResult = simulate(
        GLOBAL_STATE.chart,
        GLOBAL_STATE.yarnSequence,
        GLOBAL_STATE.yarnPalette,
        GLOBAL_STATE.simScale,
        GLOBAL_STATE.yarnPlies,
        {
          machineGauge: GLOBAL_STATE.machineGauge,
          texturePerformanceMode: GLOBAL_STATE.texturePerformanceMode,
          texturePreviewInteractionActive:
            GLOBAL_STATE.texturePreviewInteractionActive,
        }
      );

      ({ stopSim } = simulationResult);
      dispatch({ yarnLengthMetrics: simulationResult.yarnLengthMetrics });
    }

    const debouncedRun = debounce(run, 150);

    run();

    return {
      syncState(state, changes) {
        const found = [
          "repeats",
          "yarnPalette",
          "yarnSequence",
          "yarnPlies",
          "texturePerformanceMode",
          "texturePreviewInteractionActive",
          "machineGauge",
          "chart",
        ].some((key) => changes.includes(key));

        if (found) {
          debouncedRun();
        }

        if (changes.includes("simScale")) {
          run();
        }
      },
    };
  };
}
