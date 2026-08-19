import { html, nothing } from "lit-html";

import { resizePatternBitmap } from "../actions/patternEditing.js";
import { fitChart } from "../actions/zoomFit.js";
import { t } from "../i18n/index.js";
import { GLOBAL_STATE } from "../state.js";

function resize(field, width, height) {
  resizePatternBitmap(field, width, height);
  fitChart();
}

export function bitmapEditor({ field, titleKey, showYarn = false }) {
  const bitmap = GLOBAL_STATE[field];
  const prefix = field === "camBitmap" ? "cam" : "needle";
  const symbolCanvasId = prefix === "needle" ? "symbol-canvas" : `${prefix}-symbol-canvas`;
  const gridCanvasId = prefix === "needle" ? "grid" : `${prefix}-grid`;
  const language = GLOBAL_STATE.language;

  return html`<section
    id="${prefix}-editor-pane"
    class="pattern-editor-pane"
    data-pattern-field=${field}>
    <header class="pattern-editor-header">
      <h2>${t(titleKey, language)}</h2>
      <div class="pattern-size-controls">
        <label>
          <span>${t("taskbar.width", language)}</span>
          <input
            data-code-guide-key="${prefix}.width"
            class="input"
            type="number"
            min="1"
            max="500"
            .value=${String(bitmap.width)}
            @change=${(event) =>
              resize(field, event.target.value, bitmap.height)} />
        </label>
        <label>
          <span>${t("taskbar.height", language)}</span>
          <input
            data-code-guide-key="${prefix}.height"
            class="input"
            type="number"
            min="1"
            max="500"
            .value=${String(bitmap.height)}
            @change=${(event) =>
              resize(field, bitmap.width, event.target.value)} />
        </label>
      </div>
    </header>
    <div class="pattern-editor-viewport">
      <div class="pattern-canvas-row">
        ${showYarn
          ? html`<div id="needle-yarn-sequence">
              <canvas
                id="yarn-sequence-canvas"
                data-code-guide-key="chart.yarn-sequence"></canvas>
            </div>`
          : nothing}
        <div class="pattern-canvas-stack">
          ${showYarn
            ? html`<canvas
                id="yarn-color-canvas"
                data-code-guide-key="chart.yarn-color"></canvas>`
            : nothing}
          <canvas
            id=${symbolCanvasId}
            class="pattern-symbol-canvas"
            data-code-guide-key="${prefix}.symbols"></canvas>
          <canvas
            id=${gridCanvasId}
            class="pattern-grid-canvas"
            data-code-guide-key="${prefix}.grid"></canvas>
          <canvas
            id="${prefix}-interaction-canvas"
            class="pattern-interaction-canvas"
            data-pattern-field=${field}
            aria-label=${t(titleKey, language)}></canvas>
        </div>
      </div>
    </div>
  </section>`;
}
