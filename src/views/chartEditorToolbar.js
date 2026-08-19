import { html } from "lit-html";
import { selectPatternSymbol } from "../actions/patternEditing.js";
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
    </div>
  </section>`;
}
