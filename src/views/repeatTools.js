import { html } from "lit-html";
import { dispatch, GLOBAL_STATE } from "../state";
import { repeatEditingTools } from "../actions/repeatEditingTools";
import { resizeRepeatBitmap } from "../actions/repeatDimensions";
import { buttonIcon } from "./uiButton";
import { t } from "../i18n";

const repeatToolButtons = {
  brush: { icon: "brush", labelKey: "repeatTools.brush" },
};

export function repeatTools() {
  const language = GLOBAL_STATE.language;

  return html` <div class="tool-picker">
    <label class="repeat-dimension-input" data-code-guide-key="repeat.width">
      <input
        type="number"
        min="1"
        .value=${String(
          GLOBAL_STATE.repeats[GLOBAL_STATE.editingRepeat].bitmap.width
        )}
        @input=${(e) =>
          resizeRepeatBitmap(
            GLOBAL_STATE.editingRepeat,
            e.target.value,
            GLOBAL_STATE.repeats[GLOBAL_STATE.editingRepeat].bitmap.height
          )} />
    </label>
    <span class="repeat-dimension-separator">x</span>
    <label class="repeat-dimension-input" data-code-guide-key="repeat.height">
      <input
        type="number"
        min="1"
        .value=${String(
          GLOBAL_STATE.repeats[GLOBAL_STATE.editingRepeat].bitmap.height
        )}
        @input=${(e) =>
          resizeRepeatBitmap(
            GLOBAL_STATE.editingRepeat,
            GLOBAL_STATE.repeats[GLOBAL_STATE.editingRepeat].bitmap.width,
            e.target.value
          )} />
    </label>
    ${Object.keys(repeatEditingTools).map(
      (toolName) => html`<button
        data-code-guide-key="repeat.tool"
        class="btn solid ${GLOBAL_STATE.activeTool == toolName
          ? "current"
          : ""}"
        @click=${() =>
          dispatch({
            activeTool:
              GLOBAL_STATE.activeTool == toolName ? null : toolName,
          })}>
        ${buttonIcon(
          repeatToolButtons[toolName].icon,
          t(repeatToolButtons[toolName].labelKey, language)
        )}
      </button>`
    )}
    <button
      data-code-guide-key="repeat.exit"
      class="btn"
      @click=${() =>
        dispatch({
          editingRepeat: -1,
          activeTool: null,
        })}>
      ${buttonIcon("close", t("repeatTools.exit", language))}
    </button>
  </div>`;
}
