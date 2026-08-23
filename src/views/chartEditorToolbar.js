import { html } from "lit-html";
import { fitChart } from "../actions/zoomFit";
import { resizeChartArea } from "../actions/repeatDimensions";
import { applySelectedSymbol } from "../actions/selectedCell";
import { GLOBAL_STATE } from "../state";
import knitIconUrl from "../assets/symbols/knit.svg";
import purlIconUrl from "../assets/symbols/purl.svg";
import slipIconUrl from "../assets/symbols/slip.svg";
import tuckIconUrl from "../assets/symbols/tuck.svg";
import { t } from "../i18n";

const SYMBOL_ICON_URLS = {
  knit: knitIconUrl,
  purl: purlIconUrl,
  slip: slipIconUrl,
  tuck: tuckIconUrl,
};

function updateChartWidth(newWidth) {
  const width = Math.max(5, Math.min(500, Math.floor(Number(newWidth) || 5)));
  resizeChartArea(width, GLOBAL_STATE.chart.height);
  fitChart();
}

function updateChartHeight(newHeight) {
  const height = Math.max(5, Math.min(500, Math.floor(Number(newHeight) || 5)));
  resizeChartArea(GLOBAL_STATE.chart.width, height);
  fitChart();
}

export function chartEditorToolbar() {
  const language = GLOBAL_STATE.language;

  return html`<section id="chart-editor-toolbar">
    <div class="chart-stitch-tools">
      <h2>${t("symbols.title", language)}</h2>
      <div class="chart-stitch-buttons">
        ${GLOBAL_STATE.symbolMap.map(
          (symbolName, index) => html`<button
            data-code-guide-key="stitch.symbol"
            class="btn chart-stitch-button ${GLOBAL_STATE.activeSymbol == index
              ? "current"
              : ""}"
            type="button"
            @click=${() => applySelectedSymbol(index)}>
            <img
              class="symbol-preview-image"
              src=${SYMBOL_ICON_URLS[symbolName]}
              alt=${t(`symbols.${symbolName}`, language)}
              draggable="false" />
            <span>${t(`symbols.${symbolName}`, language)}</span>
          </button>`
        )}
      </div>
    </div>
    <div id="chart-size-controls">
      <label>
        <span>${t("taskbar.width", language)}</span>
        <input
          data-code-guide-key="taskbar.width"
          class="input"
          type="number"
          .value=${GLOBAL_STATE.chart.width}
          @change=${(event) => updateChartWidth(event.target.value)}
          min="5"
          max="500" />
      </label>
      <label>
        <span>${t("taskbar.height", language)}</span>
        <input
          data-code-guide-key="taskbar.height"
          class="input"
          type="number"
          .value=${GLOBAL_STATE.chart.height}
          @change=${(event) => updateChartHeight(event.target.value)}
          min="5"
          max="500" />
      </label>
    </div>
  </section>`;
}
