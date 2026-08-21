import { html, nothing } from "lit-html";

import { cssCellSize } from "../chartViewport.js";
import { t } from "../i18n/index.js";
import { GLOBAL_STATE } from "../state.js";
import { needleArrangementControls } from "./needleArrangementControls.js";

export function bitmapEditor({
  fullField,
  unitField,
  prefix,
  titleKey,
  showNeedleControls = false,
}) {
  const symbolCanvasId = prefix === "needle" ? "symbol-canvas" : `${prefix}-symbol-canvas`;
  const gridCanvasId = prefix === "needle" ? "grid" : `${prefix}-grid`;
  const language = GLOBAL_STATE.language;
  const chartCellSize = cssCellSize(GLOBAL_STATE.scale);
  const chartPan = GLOBAL_STATE.chartPan || { x: 0, y: 0 };

  return html`<section
    id="${prefix}-editor-pane"
    class="pattern-editor-pane"
    data-pattern-field=${fullField}
    data-unit-field=${unitField}>
    <header class="pattern-editor-header">
      <h2>${t(titleKey, language)}</h2>
    </header>
    ${showNeedleControls ? needleArrangementControls() : nothing}
    <div class="pattern-editor-viewport">
      <div
        class="pattern-editor-stage"
        style="--chart-cell-size: ${chartCellSize}px">
        <div class="yarn-sequence-gutter">
          <div
            class="yarn-sequence-track"
            style="transform: translateY(${chartPan.y}px)">
            <canvas
              id="${prefix}-yarn-sequence-canvas"
              class="yarn-sequence-canvas"
              tabindex="0"
              aria-label="${t(titleKey, language)} ${t("yarnSequence.title", language)}"
              ${prefix === "needle"
                ? html`data-code-guide-key="needle.yarn-sequence"`
                : html`data-code-guide-key="cam.yarn-sequence"`}></canvas>
          </div>
        </div>
        <div class="pattern-grid-window" data-editor-prefix=${prefix}>
          <div
            class="pattern-canvas-transform"
            style="transform: translate(${chartPan.x}px, ${chartPan.y}px)">
            <div class="pattern-canvas-stack">
              <canvas
                id=${symbolCanvasId}
                class="pattern-symbol-canvas"
                data-code-guide-key="${prefix}.symbols"></canvas>
              <canvas
                id=${gridCanvasId}
                class="pattern-grid-canvas"
                data-code-guide-key="${prefix}.grid"></canvas>
              <canvas
                id="${prefix}-unit-symbol-canvas"
                class="pattern-unit-symbol-canvas"></canvas>
              <canvas
                id="${prefix}-unit-grid"
                class="pattern-unit-grid-canvas"></canvas>
              <canvas
                id="${prefix}-interaction-canvas"
                class="pattern-interaction-canvas"
                data-full-field=${fullField}
                data-unit-field=${unitField}
                aria-label=${t(titleKey, language)}></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}
