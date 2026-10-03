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
import {
  createSingleJerseyExecutionInput,
} from "./singleJerseyExecutionInput.js";
let stopSims = [];
let machineExecutionError = null;

const BEFORE_SIMULATION_TARGET = {
  containerId: "sim-before-container",
  canvasIDs: ["back", "mid", "front"],
};
const AFTER_SIMULATION_TARGET = {
  containerId: "sim-after-container",
  canvasIDs: ["back-arranged", "mid-arranged", "front-arranged"],
};

function isMachineConfigurationError(error) {
  return (
    (error instanceof TypeError || error instanceof RangeError) &&
    /^(?:camProgram\.tracks|needleArrangement|Needle Type )/.test(
      error.message
    )
  );
}

function setMachineExecutionError(message) {
  machineExecutionError = message;

  const errorElement = document.getElementById("machine-execution-error");
  if (!errorElement) return;

  errorElement.hidden = message === null;
  errorElement.textContent = message ?? "";
}

function clearSimulationCanvases(canvasIDs) {
  canvasIDs.forEach((canvasID) => {
    const canvas = document.getElementById(canvasID);
    const context = canvas?.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
  });
}

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
  const showDesignComparison = GLOBAL_STATE.showDesignComparison;

  return html`<div id="sim-pane">
    <div id="sim-container" data-code-guide-key="simulation.canvas">
      <div class="simulation-preview-grid ${showDesignComparison
        ? "comparison-active"
        : ""}">
        <section
          class="simulation-preview-panel ${showDesignComparison
            ? ""
            : "comparison-hidden"}"
          aria-hidden=${!showDesignComparison}>
          <h2>${t("needleArrangement.before", language)}</h2>
          <div id="sim-before-container" class="simulation-preview-canvas">
            <div
              id="sim-transform-group"
              class="sim-transform-group ${GLOBAL_STATE.flipped ? "mirrored" : ""}"
              style="transform: translate(${previewPan.x}px, ${previewPan
                .y}px) scale(${previewRatio})">
              <canvas
                id="back"
                class=${GLOBAL_STATE.flipped ? "top" : "bottom"}></canvas>
              <canvas id="mid" class="mid"></canvas>
              <canvas
                id="front"
                class=${GLOBAL_STATE.flipped ? "bottom" : "top"}></canvas>
            </div>
          </div>
        </section>
        <section class="simulation-preview-panel">
          <h2>${t("needleArrangement.after", language)}</h2>
          <div id="sim-after-container" class="simulation-preview-canvas">
            <div
              id="sim-after-transform-group"
              class="sim-transform-group ${GLOBAL_STATE.flipped ? "mirrored" : ""}"
              style="transform: translate(${previewPan.x}px, ${previewPan
                .y}px) scale(${previewRatio})">
              <canvas
                id="back-arranged"
                class=${GLOBAL_STATE.flipped ? "top" : "bottom"}></canvas>
              <canvas id="mid-arranged" class="mid"></canvas>
              <canvas
                id="front-arranged"
                class=${GLOBAL_STATE.flipped ? "bottom" : "top"}></canvas>
            </div>
          </div>
          <div
            id="machine-execution-error"
            class="machine-execution-error"
            role="alert"
            aria-live="polite"
            hidden></div>
        </section>
      </div>
    </div>
    <div id="sim-controls" class="panzoom-controls">
      <label class="form-control toggle simulation-comparison-toggle">
        <input
          type="checkbox"
          ?checked=${showDesignComparison}
          @change=${(e) =>
            dispatch({ showDesignComparison: e.target.checked })} />
        ${t("simulation.compareDesign", language)}
      </label>
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
  stopSims.forEach((stopSim) => stopSim());
  stopSims = [];
}

export function runSimulation() {
  return ({ state }) => {
    let queueSim = false;

    function run() {
      queueSim = false;

      stopSimulation();

      const baseSimulation = GLOBAL_STATE.chart;
      const simulationOptions = {
        machineGauge: GLOBAL_STATE.machineGauge,
        texturePerformanceMode: GLOBAL_STATE.texturePerformanceMode,
        texturePreviewInteractionActive:
          GLOBAL_STATE.texturePreviewInteractionActive,
      };
      const simulationArguments = [
        GLOBAL_STATE.yarnSequence,
        GLOBAL_STATE.yarnPalette,
        GLOBAL_STATE.simScale,
        GLOBAL_STATE.yarnPlies,
      ];

      const baseSimulationResult = simulate(
        baseSimulation,
        ...simulationArguments,
        {
          ...simulationOptions,
          target: BEFORE_SIMULATION_TARGET,
        }
      );

      stopSims = [baseSimulationResult.stopSim];
      dispatch({
        yarnLengthMetrics: baseSimulationResult.yarnLengthMetrics,
      });

      clearSimulationCanvases(AFTER_SIMULATION_TARGET.canvasIDs);
      let machineSimulationInput;
      try {
        machineSimulationInput = createSingleJerseyExecutionInput(
          GLOBAL_STATE.singleJerseyCamProgram,
          GLOBAL_STATE.needleArrangement,
          baseSimulation.width,
          baseSimulation.height
        );
      } catch (error) {
        if (!isMachineConfigurationError(error)) throw error;

        setMachineExecutionError(error.message);
        return;
      }

      setMachineExecutionError(null);
      if (machineSimulationInput === null) return;

      const afterSimulationResult = simulate(
        machineSimulationInput,
        ...simulationArguments,
        {
          ...simulationOptions,
          target: AFTER_SIMULATION_TARGET,
          feeds: GLOBAL_STATE.singleJerseyCamProgram.feeds,
        }
      );
      stopSims.push(afterSimulationResult.stopSim);
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
          "showDesignComparison",
          "chart",
          "needleArrangement",
          "singleJerseyCamProgram",
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
