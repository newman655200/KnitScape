import { html } from "lit-html";
import { dispatch, GLOBAL_STATE } from "../state";
import { t } from "../i18n";
import {
  combineNeedleArrangementInputs,
  hasFourColumnNeedleSource,
  normalizeNeedleArrangementInput,
} from "../simulation/needleArrangementOverlay.js";

function updateArrangementInput(index, value) {
  const normalizedValue = normalizeNeedleArrangementInput(value);
  const needleArrangementInputs = [...GLOBAL_STATE.needleArrangementInputs];
  needleArrangementInputs[index] = normalizedValue;
  dispatch({ needleArrangementInputs });
  return normalizedValue;
}

export function needleArrangementBar() {
  const language = GLOBAL_STATE.language;
  const combinedArrangement = combineNeedleArrangementInputs(
    GLOBAL_STATE.needleArrangementInputs
  );
  const sourceReady = hasFourColumnNeedleSource(GLOBAL_STATE.repeats);
  const canApplyArrangement = Boolean(combinedArrangement) && sourceReady;

  return html`<section id="needle-arrangement-bar">
    <h2>${t("needleArrangement.title", language)}</h2>
    <div class="needle-arrangement-inputs">
      ${GLOBAL_STATE.needleArrangementInputs.map(
        (value, index) => html`<input
          class="needle-arrangement-input"
          type="text"
          inputmode="numeric"
          pattern="[1-4]*"
          autocomplete="off"
          aria-label=${t("needleArrangement.input", language, {
            number: index + 1,
          })}
          .value=${value}
          @input=${(event) => {
            event.target.value = updateArrangementInput(
              index,
              event.target.value
            );
          }} />`
      )}
    </div>
    <input
      class="needle-arrangement-combined"
      type="text"
      aria-label=${t("needleArrangement.combined", language)}
      .value=${combinedArrangement}
      readonly />
    <button
      class="btn solid"
      type="button"
      ?disabled=${!canApplyArrangement}
      @click=${() => {
        if (!canApplyArrangement) return;
        dispatch({ needleArrangement: combinedArrangement });
      }}>
      ${t("needleArrangement.apply", language)}
    </button>
    <button
      class="btn solid"
      type="button"
      ?disabled=${!GLOBAL_STATE.needleArrangement}
      @click=${() => dispatch({ needleArrangement: "" })}>
      ${t("needleArrangement.withdraw", language)}
    </button>
    ${!sourceReady
      ? html`<span class="needle-arrangement-message" role="status">
          ${t("needleArrangement.requiresFourColumns", language)}
        </span>`
      : ""}
  </section>`;
}
