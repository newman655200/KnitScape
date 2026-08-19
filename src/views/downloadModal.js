import { html } from "lit-html";
import {
  downloadBMP,
  downloadSVG,
  downloadJSON,
  downloadSilverKnitTxt,
  downloadPNG,
  downloadKniterate,
  downloadPunchcard,
} from "../actions/exporters";

import { punchCardSVG } from "../punchcard";

import { GLOBAL_STATE, dispatch } from "../state";
import { buttonIcon } from "./uiButton";
import { t } from "../i18n";

export function downloadModal() {
  const language = GLOBAL_STATE.language;

  return html` <div class="modal">
    <h2>${t("download.title", language)}</h2>
    <div class="modal-content">
      <button class="btn solid" @click=${() => downloadJSON()}>
        ${buttonIcon("download", t("download.patternJson", language))}
      </button>
      <!-- <button class="btn solid" @click=${() =>
        downloadPNG()}>Chart PNG</button>
      <button class="btn solid" @click=${() => downloadSVG()}>
        Simulation SVG
      </button> -->
      <!-- <button class="btn solid" @click=${() => downloadBMP()}>
        Windows BMP (Silver Knit)
      </button> -->
      <button class="btn solid" @click=${() => downloadSilverKnitTxt()}>
        ${buttonIcon("download", t("download.silverKnit", language))}
      </button>
      <button class="btn solid" @click=${() => downloadKniterate()}>
        ${buttonIcon("download", t("download.kniterate", language))}
      </button>

      <h3>${t("download.punchcard", language)}</h3>

      <label class="form-control range">
        ${t("download.verticalRepeats", language)}
        <input
          type="range"
          name="line-width"
          min="1"
          max="10"
          .value=${String(GLOBAL_STATE.punchVerticalRepeats)}
          @input=${(e) =>
            dispatch({
              punchVerticalRepeats: Number(e.target.value),
            })} />
      </label>

      <button class="btn solid" @click=${() => downloadPunchcard()}>
        ${buttonIcon("download", t("download.punchcardSvg", language))}
      </button>

      <div class="punchcard-preview">${punchCardSVG()}</div>
    </div>
  </div>`;
}
