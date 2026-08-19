import { html } from "lit-html";
import { GLOBAL_STATE } from "../state";
import { MIN_SCALE, MAX_SCALE } from "../constants";
import { centerZoom, fitChart } from "../actions/zoomFit";
import { buttonIcon } from "./uiButton";
import { t } from "../i18n";

export function chartTools() {
  const language = GLOBAL_STATE.language;

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
  </div>`;
}
