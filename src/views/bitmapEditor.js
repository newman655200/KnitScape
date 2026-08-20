import { html, nothing } from "lit-html";

import { t } from "../i18n/index.js";
import { GLOBAL_STATE } from "../state.js";
import { needleArrangementControls } from "./needleArrangementControls.js";

export function bitmapEditor({
  fullField,
  unitField,
  prefix,
  titleKey,
  showYarn = false,
  showNeedleControls = false,
}) {
  const symbolCanvasId = prefix === "needle" ? "symbol-canvas" : `${prefix}-symbol-canvas`;
  const gridCanvasId = prefix === "needle" ? "grid" : `${prefix}-grid`;
  const language = GLOBAL_STATE.language;

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
      <div class="pattern-canvas-row">
        ${showYarn
          ? html`<div id="needle-yarn-sequence">
              <canvas
                id="yarn-sequence-canvas"
                data-code-guide-key="needle.yarn-sequence"></canvas>
            </div>`
          : nothing}
        <div class="pattern-canvas-stack">
          ${showYarn
            ? html`<canvas
                id="yarn-color-canvas"
                data-code-guide-key="needle.yarn-color"></canvas>`
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
            data-pattern-field=${fullField}
            data-unit-field=${unitField}
            aria-label=${t(titleKey, language)}></canvas>
        </div>
      </div>
    </div>
  </section>`;
}
