import { html } from "lit-html";
import { loadLibraryPattern } from "../actions/importers";
import { GLOBAL_STATE } from "../state";
import { buttonIcon } from "./uiButton";
import { t } from "../i18n";

export function libraryModal() {
  const language = GLOBAL_STATE.language;

  return html` <div id="library-modal" class="modal">
    <h2>${t("library.title", language)}</h2>
    <div class="modal-content">
      ${Object.entries(GLOBAL_STATE.patternLibrary).map(
        ([path, _]) =>
          html`<div class="library-item">
            <span>${path.split("/").at(-1).split(".")[0]}</span>
            <button class="btn solid" @click=${() => loadLibraryPattern(path)}>
              ${buttonIcon("import", t("library.load", language))}
            </button>
          </div>`
      )}
    </div>
  </div>`;
}
