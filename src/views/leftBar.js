import { html } from "lit-html";
import { GLOBAL_STATE, dispatch } from "../state";
import { DEFAULT_STITCH_SYMBOL_INDEX } from "../constants";
import { Bimp } from "../lib/Bimp";
import { buttonIcon } from "./uiButton";
import { t } from "../i18n";
import { yarnPlyPanel } from "./yarnPlyPanel";
import { yarnPicker } from "./yarnPicker";

function addRepeat() {
  const newBitmap = Bimp.empty(2, 2, DEFAULT_STITCH_SYMBOL_INDEX);

  dispatch({
    repeats: [
      ...GLOBAL_STATE.repeats,
      {
        bitmap: newBitmap,
        area: [newBitmap.width, newBitmap.height],
        pos: [0, 0],
      },
    ],
    editingRepeat: GLOBAL_STATE.repeats.length,
  });
}

export function leftBar() {
  const language = GLOBAL_STATE.language;

  const addRepeatClass =
    GLOBAL_STATE.workspaceMode === "pattern" ? "" : "workspace-hidden";

  return html`<div id="left-bar" class="scroller">
    <button class="btn solid add-repeat ${addRepeatClass}" data-code-guide-key="left.add-repeat" @click=${() => addRepeat()}>
      ${buttonIcon("add", t("left.addRepeat", language))}
    </button>
    ${yarnPlyPanel()} ${yarnPicker()}
  </div>`;
}
