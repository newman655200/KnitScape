import { html } from "lit-html";
import { GLOBAL_STATE, dispatch } from "../state";
import { MIN_SCALE, MAX_SCALE } from "../constants";
import { centerZoom, fitChart } from "../actions/zoomFit";
import { buttonIcon } from "./uiButton";
import { t } from "../i18n";

function chartExtent(axis) {
  const desktop = document.getElementById("desktop");
  if (!desktop) return { value: 0, max: 0 };

  const bounds = desktop.getBoundingClientRect();
  const viewport = axis == "x" ? bounds.width : bounds.height;
  const chartCells =
    axis == "x" ? GLOBAL_STATE.chart.width : GLOBAL_STATE.chart.height;
  const chartSize = (chartCells * GLOBAL_STATE.scale) / devicePixelRatio;
  const max = Math.max(0, chartSize - viewport);
  const current = axis == "x" ? GLOBAL_STATE.chartPan.x : GLOBAL_STATE.chartPan.y;
  const value = max == 0 ? 0 : Math.round((-current / max) * 100);

  return {
    max,
    value: Math.max(0, Math.min(100, value)),
  };
}

function setChartBlock(axis, value) {
  const { max } = chartExtent(axis);
  const nextPan = -max * (Number(value) / 100);

  dispatch({
    chartPan: {
      ...GLOBAL_STATE.chartPan,
      [axis]: nextPan,
    },
  });
}

export function chartTools() {
  const language = GLOBAL_STATE.language;
  const cols = chartExtent("x");
  const rows = chartExtent("y");

  return html` <div class="panzoom-controls">
    <button class="btn icon" data-code-guide-key="chart.zoom-out" @click=${() => centerZoom(GLOBAL_STATE.scale - 1)}>
      ${buttonIcon("zoomOut", t("chartTools.zoomOut", language))}
    </button>
    <input
      data-code-guide-key="chart.zoom-range"
      type="range"
      min=${MIN_SCALE}
      max=${MAX_SCALE}
      .value=${String(GLOBAL_STATE.scale)}
      @input=${(e) => centerZoom(Number(e.target.value))} />
    <button class="btn icon" data-code-guide-key="chart.zoom-in" @click=${() => centerZoom(GLOBAL_STATE.scale + 1)}>
      ${buttonIcon("zoomIn", t("chartTools.zoomIn", language))}
    </button>
    <button class="btn icon" data-code-guide-key="chart.fit" @click=${fitChart}>
      ${buttonIcon("fit", t("chartTools.fit", language))}
    </button>
    <label class="chart-block-slider" data-code-guide-key="chart.cols">
      <span>${t("chartTools.cols", language)}</span>
      <input
        type="range"
        min="0"
        max="100"
        .value=${String(cols.value)}
        ?disabled=${cols.max == 0}
        @input=${(e) => setChartBlock("x", e.target.value)} />
    </label>
    <label class="chart-block-slider" data-code-guide-key="chart.rows">
      <span>${t("chartTools.rows", language)}</span>
      <input
        type="range"
        min="0"
        max="100"
        .value=${String(rows.value)}
        ?disabled=${rows.max == 0}
        @input=${(e) => setChartBlock("y", e.target.value)} />
    </label>
  </div>`;
}
