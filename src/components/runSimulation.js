import { createSimulationCoordinator } from "./simulationCoordinator.js";
import { createSimulationPreviewHost } from "./simulationPreviewHost.js";
import { copySolverResults } from "../simulation/simulationSnapshot.js";
import { selectOperationPaths } from "../simulation/operationPreview.js";
import { PREVIEW_VALIDITY } from "../simulation/previewValidity.js";
import { GLOBAL_STATE, dispatch } from "../state";
import { html } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { MIN_SIM_SCALE, MAX_SIM_SCALE } from "../constants";
import { centerZoomSimulation } from "../actions/zoomFit";
import {
  beginTexturePreviewInteraction,
  endTexturePreviewInteraction,
} from "../actions/texturePerformance";
import { buttonIcon } from "../views/uiButton";
import { yarnLengthSolverFeedback } from "../views/yarnLengthSolverFeedback.js";
import { t } from "../i18n";
import { machineOperationDemo, operationPreviewOverlay } from "../views/machineOperationDemo.js";
let coordinator = null, previewHost = null, calculationTimer = null;
let machineExecutionError = null;
// Ephemeral view choice; never enters project state, undo or Solver inputs.
let machinePreview = null;
let visibleYarnId = null;
let operationDemoEnabled = false;
let operationCursor = { row: 0, needle: 0 };
let structureLineTrial = false;

function toggleStructureLineTrial() {
  if (!import.meta.env.DEV || !machinePreview) return;
  structureLineTrial = machinePreview.setStructureLineTrial(!structureLineTrial);
  dispatch({});
}

// Only the trial button owns this shortcut; editing controls keep their native keys.
function structureLineTrialKeydown(event) {
  event.stopPropagation();
  if (!import.meta.env.DEV || event.code !== "KeyL" || !event.altKey || !event.shiftKey ||
    event.ctrlKey || event.metaKey || event.repeat || event.isComposing || !machinePreview) return;
  event.preventDefault();
  toggleStructureLineTrial();
}

function focusOperationPreview(onlyIfOutside = false) {
  if (!window.requestAnimationFrame || GLOBAL_STATE.workbenchMode !== "classic2d") return;
  const generation = GLOBAL_STATE.projectGeneration, preview = machinePreview;
  window.requestAnimationFrame(() => {
    if (GLOBAL_STATE.workbenchMode !== "classic2d" || GLOBAL_STATE.projectGeneration !== generation || preview !== machinePreview) return;
    const overlay = document.getElementById("operation-preview-overlay");
    const viewport = document.getElementById("sim-after-container");
    const status = document.getElementById("operation-focus-status");
    if (status) status.textContent = "";
    if (!overlay || !viewport || !machinePreview) return;
    const paths = overlay.querySelectorAll(".operation-preview-selected");
    if (!paths.length) return;
    // Paths outside the existing Canvas buffer cannot be revealed by panning.
    const buffer = overlay.getBoundingClientRect();
    const boxes = [...paths].map(path => {
      const box = path.getBoundingClientRect();
      return { left: Math.max(box.left, buffer.left), right: Math.min(box.right, buffer.right),
        top: Math.max(box.top, buffer.top), bottom: Math.min(box.bottom, buffer.bottom) };
    }).filter(box => box.right >= box.left && box.bottom >= box.top);
    if (!boxes.length) {
      if (status) status.textContent = t("operationDemo.outsideCanvas", GLOBAL_STATE.language);
      return;
    }
    const left = Math.min(...boxes.map(box => box.left));
    const right = Math.max(...boxes.map(box => box.right));
    const top = Math.min(...boxes.map(box => box.top));
    const bottom = Math.max(...boxes.map(box => box.bottom));
    const bounds = viewport.getBoundingClientRect();
    if (onlyIfOutside && left >= bounds.left + 12 && right <= bounds.right - 12 &&
      top >= bounds.top + 12 && bottom <= bounds.bottom - 12) return;
    dispatch({ simPan: {
      x: GLOBAL_STATE.simPan.x + (bounds.left + bounds.right - left - right) / 2,
      y: GLOBAL_STATE.simPan.y + (bounds.top + bounds.bottom - top - bottom) / 2,
    } });
  });
}

function changeOperationDemo({ enabled = operationDemoEnabled,
  row = operationCursor.row, needle = operationCursor.needle }) {
  operationDemoEnabled = enabled;
  operationCursor = {
    row: Math.max(0, Math.min(GLOBAL_STATE.chart.height - 1, Math.trunc(row))),
    needle: Math.max(0, Math.min(GLOBAL_STATE.chart.width - 1, Math.trunc(needle))),
  };
  // Only request a view refresh; this cursor is not project or simulation input.
  dispatch({});
  if (operationDemoEnabled) focusOperationPreview(true);
}

function setMachineExecutionError(message) {
  machineExecutionError = message;

  const errorElement = document.getElementById("machine-execution-error");
  if (!errorElement) return;

  errorElement.hidden = message === null;
  errorElement.textContent = message ?? "";
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
  const yarnIds = machinePreview?.yarnIds || [];
  const yarnNames = new Map((GLOBAL_STATE.yarnLibrary || []).map(yarn => [String(yarn.id), yarn.name]));
  const operationPreview = operationDemoEnabled
    ? machinePreview?.getOperationPreview?.(operationCursor.row, operationCursor.needle) ?? null : null;

  const showSwatch = GLOBAL_STATE.workbenchMode === "sop3d";
  return html`<div id="sim-pane" class=${showSwatch ? "swatch-preview-active" : ""}>
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
          <div class="simulation-yarn-view"
            @pointerdown=${e => e.stopPropagation()}
            @touchstart=${e => e.stopPropagation()}
            @wheel=${e => e.stopPropagation()}
            @keydown=${e => e.stopPropagation()}
            @keyup=${e => e.stopPropagation()}>
            <label for="simulation-yarn-select">${t("simulation.yarnView", language)}</label>
            <select id="simulation-yarn-select" ?disabled=${!yarnIds.length}
              .value=${live(visibleYarnId ?? "")}
              aria-describedby="simulation-yarn-hint"
              @change=${e => {
                visibleYarnId = machinePreview?.setVisibleYarnId(e.target.value || null) ?? null;
                e.target.value = visibleYarnId ?? "";
                if (operationDemoEnabled) {
                  dispatch({});
                  focusOperationPreview(true);
                }
              }}>
              <option value="" .selected=${visibleYarnId === null}>${t("simulation.allYarns", language)}</option>
              ${yarnIds.map(id => html`<option value=${id} .selected=${visibleYarnId === id}>${yarnNames.get(id) || id}</option>`)}
            </select>
            ${import.meta.env.DEV ? html`
              <button id="structure-line-trial-toggle" type="button"
                class=${structureLineTrial ? "btn solid" : "btn"}
                aria-label="结构线试验" aria-pressed=${structureLineTrial}
                aria-keyshortcuts="Alt+Shift+L" ?disabled=${!machinePreview}
                title="切换临时显示；此开关获得焦点时可按 Alt+Shift+L"
                @click=${toggleStructureLineTrial} @keydown=${structureLineTrialKeydown}>
                结构线试验：${structureLineTrial ? "开启" : "关闭"}
              </button>` : ""}
            <p id="simulation-yarn-hint">${t("yarnLibrary.rendererLimit", language)}</p>
          </div>
          ${yarnLengthSolverFeedback()}
          ${machineOperationDemo({ enabled: operationDemoEnabled, preview: operationPreview,
            camProgram: GLOBAL_STATE.singleJerseyCamProgram, arrangement: GLOBAL_STATE.needleArrangement,
            language, onChange: changeOperationDemo, onFocus: () => focusOperationPreview() })}
          <div id="sim-after-container" class="simulation-preview-canvas">
            ${import.meta.env.DEV && structureLineTrial ? html`
              <span role="status" style="position:absolute;top:4px;right:4px;z-index:4;pointer-events:none;background:#202020;color:#fff;padding:2px 6px;font-size:11px">
                结构线试验已开启
              </span>` : ""}
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
              ${operationDemoEnabled && operationPreview ? operationPreviewOverlay(operationPreview) : ""}
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
    ${showSwatch ? html`<section id="sop-swatch-workbench-slot" aria-label="三维样布预览"
      @keydown=${event => event.stopPropagation()} @keyup=${event => event.stopPropagation()}></section>` : null}
  </div>`;
}

export function getCurrentSimulationSnapshots() {
  return coordinator?.read() ?? Object.freeze({ pattern: null, machine: null, machineExecutionError: null, pending: false });
}
export function getSimulationPreviewStatus() { return previewHost?.status ?? { phase: "unmounted", derivedGeometry: null }; }
export function flushSimulationPreviews() { previewHost?.flush(); }
export function whenSimulationPreviewsReady() { return previewHost?.ready() ?? Promise.resolve(); }

function classicView() {
  const snapshot = coordinator?.read().machine;
  return { scale: GLOBAL_STATE.simScale, pan: GLOBAL_STATE.simPan, visibleYarnId,
    structureLineStyle: import.meta.env.DEV && structureLineTrial && snapshot ? {
      colors: new Map([...snapshot.yarnIds].sort().map((id, index) =>
        [id, ["#36c7ff", "#ff9854", "#bfa0ff", "#a8e063"][index % 4]])),
      lineWidth: globalThis.devicePixelRatio || 1,
    } : null };
}

function snapshotPreview(snapshot) {
  const normalizeId = id => id !== null && id !== undefined && snapshot.yarnIds.includes(String(id)) ? String(id) : null;
  visibleYarnId = normalizeId(visibleYarnId);
  return {
    snapshot, yarnIds: snapshot.yarnIds,
    get visibleYarnId() { return visibleYarnId; },
    setVisibleYarnId(id) { visibleYarnId = normalizeId(id); previewHost?.request(); return visibleYarnId; },
    setStructureLineTrial(enabled) {
      structureLineTrial = Boolean(import.meta.env.DEV && enabled);
      previewHost?.request(); return structureLineTrial;
    },
    getOperationPreview(row, needle) {
      if (coordinator?.read().pending || !Number.isInteger(row) || row < 0 || row >= snapshot.pattern.height ||
        !Number.isInteger(needle) || needle < 0 || needle >= snapshot.pattern.width) return null;
      const projection = previewHost?.projection("machine") ?? snapshot;
      const operations = Array.from({ length: snapshot.pattern.width }, (_, column) =>
        snapshot.stitchPattern.ops[column + snapshot.xPadding + row * snapshot.stitchPattern.width]);
      const dpi = globalThis.devicePixelRatio || 1;
      return { row, needle, width: snapshot.pattern.width, height: snapshot.pattern.height,
        operation: operations[needle], operations, canvasWidth: projection.canvasWidth, canvasHeight: projection.canvasHeight,
        displayWidth: projection.canvasWidth / dpi, displayHeight: projection.canvasHeight / dpi,
        structureLineStyle: classicView().structureLineStyle,
        paths: selectOperationPaths({ links: snapshot.yarnPathLinks, strands: projection.yarnStrands,
          paddedWidth: snapshot.stitchPattern.width, xPadding: snapshot.xPadding, row, needle,
          feedCount: snapshot.feedCount || 1, feedYarnIds: snapshot.feedYarnIds, visibleYarnId }) };
    },
  };
}

export function stopSimulation() {
  window.clearTimeout(calculationTimer); calculationTimer = null;
  const previousHost = previewHost;
  previewHost = null;
  previousHost?.dispose();
  machinePreview = null;
}

export function runSimulation() {
  return () => {
    stopSimulation();
    coordinator = createSimulationCoordinator();
    const ownedCoordinator = coordinator;
    previewHost = createSimulationPreviewHost({ getState: () => GLOBAL_STATE,
      getSnapshots: () => ownedCoordinator.read(), getClassicView: classicView,
      onViewportChange: () => { if (operationDemoEnabled) dispatch({}); } });
    const ownedHost = previewHost;
    function run() {
      calculationTimer = null;
      if (coordinator !== ownedCoordinator || previewHost !== ownedHost) return;
      const bounds = document.getElementById("sim-before-container")?.getBoundingClientRect();
      // Classic DOM stays measurable even when the advanced workbench is open.
      const dpi = globalThis.devicePixelRatio || 1;
      const wasPending = ownedCoordinator.read().pending;
      const result = ownedCoordinator.compute(GLOBAL_STATE, {
        canvasWidth: Math.max(1, (bounds?.width || 1) * dpi * GLOBAL_STATE.simScale),
        canvasHeight: Math.max(1, (bounds?.height || 1) * dpi * GLOBAL_STATE.simScale),
      });
      setMachineExecutionError(result.machineExecutionError);
      if (result.machineChanged) {
        machinePreview = result.machine ? snapshotPreview(result.machine) : null;
        if (!result.machine) visibleYarnId = null;
      }
      const outputs = {};
      if (result.patternChanged) outputs.yarnLengthMetrics = result.pattern.yarnLengthMetrics;
      if (result.machineChanged) Object.assign(outputs, {
        yarnLengthSolverResults: result.machine ? copySolverResults(result.machine) : [],
        previewValidity: result.machineExecutionError ? PREVIEW_VALIDITY.INVALID
          : result.machine?.previewValidity ?? PREVIEW_VALIDITY.DESIGN_PREVIEW,
      });
      if (Object.keys(outputs).length || wasPending) dispatch(outputs);
      ownedHost.sync();
      if (operationDemoEnabled) focusOperationPreview(true);
    }
    run();
    return {
      syncState(state, changes) {
        if (previewHost !== ownedHost) return;
        if (changes.includes("language") && operationDemoEnabled) focusOperationPreview(true);
        if (["chart", "repeats", "needleArrangement", "singleJerseyCamProgram"].some(key => changes.includes(key)))
          operationCursor = { row: 0, needle: 0 };
        const calculationInputChanged = ["chart", "yarnSequence", "yarnPalette", "yarnPlies", "yarnLibrary",
          "machineGauge", "needleArrangement", "singleJerseyCamProgram", "projectGeneration", "feedYarnStructureRevision"]
          .some(key => changes.includes(key));
        if (calculationInputChanged && ownedCoordinator.invalidate(state)) {
          ownedHost.invalidate();
          if (ownedCoordinator.read().pendingMachine &&
            (GLOBAL_STATE.yarnLengthSolverResults.length || GLOBAL_STATE.previewValidity !== PREVIEW_VALIDITY.DESIGN_PREVIEW))
            dispatch({ yarnLengthSolverResults: [], previewValidity: PREVIEW_VALIDITY.DESIGN_PREVIEW });
          window.clearTimeout(calculationTimer);
          calculationTimer = window.setTimeout(run, 150);
        }
        // Any appearance update supersedes a pending image draw immediately,
        // even when the next DOM render is queued for a later animation frame.
        if (changes.some(key => ["workbenchMode", "projectGeneration", "simScale", "pbrView",
          "showDesignComparison", "workspaceMode", "chart", "yarnSequence", "yarnPalette", "yarnPlies", "yarnLibrary",
          "machineGauge", "needleArrangement", "singleJerseyCamProgram", "feedYarnStructureRevision",
          "texturePerformanceMode", "texturePreviewInteractionActive"].includes(key))) ownedHost.sync();
      },
    };
  };
}
