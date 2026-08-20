import { html } from "lit-html";
import {
  resizePatternCanvas,
  selectPatternSymbol,
} from "../actions/patternEditing.js";
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

function commitDimension(field, value) {
  resizePatternCanvas(
    field === "width" ? value : GLOBAL_STATE.canvasWidth,
    field === "height" ? value : GLOBAL_STATE.canvasHeight
  );
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
            @click=${() => selectPatternSymbol(index)}>
            <img
              class="symbol-preview-image"
              src=${SYMBOL_ICON_URLS[symbolName]}
              alt=${t(`symbols.${symbolName}`, language)}
              draggable="false" />
            <span>${t(`symbols.${symbolName}`, language)}</span>
          </button>`
        )}
      </div>
      <div class="chart-size-controls">
        <label>
          <span>${t("taskbar.width", language)}</span>
          <input
            data-code-guide-key="canvas.width"
            class="input pattern-dimension-input"
            type="number"
            min="5"
            max="500"
            step="1"
            .value=${String(GLOBAL_STATE.canvasWidth)}
            @change=${(event) => commitDimension("width", event.target.value)}
            @keydown=${(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }} />
        </label>
        <label>
          <span>${t("taskbar.height", language)}</span>
          <input
            data-code-guide-key="canvas.height"
            class="input pattern-dimension-input"
            type="number"
            min="5"
            max="500"
            step="1"
            .value=${String(GLOBAL_STATE.canvasHeight)}
            @change=${(event) => commitDimension("height", event.target.value)}
            @keydown=${(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }} />
        </label>
      </div>
    </div>
  </section>`;
}
