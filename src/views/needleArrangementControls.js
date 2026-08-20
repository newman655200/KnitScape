import { html, nothing } from "lit-html";

import {
  applyNeedleArrangement,
  startNeedleArrangement,
  updateNeedleInput,
} from "../actions/patternEditing.js";
import { t } from "../i18n/index.js";
import { GLOBAL_STATE } from "../state.js";

export function needleArrangementControls() {
  const language = GLOBAL_STATE.language;

  return html`<section id="needle-arrangement-controls">
    <button
      class="btn solid"
      data-code-guide-key="needle.start"
      type="button"
      @click=${startNeedleArrangement}>
      ${t("needle.start", language)}
    </button>
    <div class="needle-inputs">
      ${GLOBAL_STATE.needleInputs.map((value, index) => {
        const error = GLOBAL_STATE.needleInputErrors[index];
        return html`<label class=${error ? "invalid" : ""}>
          <span>${t("needle.input", language, { index: index + 1 })}</span>
          <input
            data-code-guide-key="needle.input"
            type="text"
            inputmode="numeric"
            pattern="[1-4]*"
            .value=${value}
            aria-invalid=${error ? "true" : "false"}
            @input=${(event) => updateNeedleInput(index, event.target.value)} />
          ${error
            ? html`<small>${t(`needle.error.${error}`, language)}</small>`
            : nothing}
        </label>`;
      })}
    </div>
    <button
      class="btn solid primary"
      data-code-guide-key="needle.apply"
      type="button"
      @click=${applyNeedleArrangement}>
      ${t("needle.apply", language)}
    </button>
  </section>`;
}
