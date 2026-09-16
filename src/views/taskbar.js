import { html } from "lit-html";
import { GLOBAL_STATE, dispatch, undo } from "../state";
import { toggleFullscreen } from "../actions/zoomFit";
import { newPattern, uploadFile } from "../actions/importers";
import { buttonIcon } from "./uiButton";
import companyLogo from "../assets/company-logo.jpg";
import { LANGUAGES } from "../i18n/languages";
import { setStoredLanguage, t } from "../i18n";

export function taskbar() {
  const language = GLOBAL_STATE.language;

  return html`<div id="taskbar">
    <div class="site-brand" data-code-guide-key="taskbar.brand">
      <img class="site-logo" src=${companyLogo} alt=${t("taskbar.logoAlt", language)} />
      <h1 class="site-title" data-code-guide-key="taskbar.title">${t("taskbar.title", language)}</h1>
    </div>
    <label class="language-control" data-code-guide-key="taskbar.language">
      <span>${t("taskbar.language", language)}</span>
      <select
        class="language-select"
        .value=${language}
        @change=${(e) => {
          const nextLanguage = setStoredLanguage(e.target.value);
          dispatch({ language: nextLanguage });
        }}>
        ${LANGUAGES.map(
          ({ code, label }) => html`<option
            value=${code}
            ?selected=${code === language}>
            ${label}
          </option>`
        )}
      </select>
    </label>
    <div class="taskbar-buttons">
      <button class="btn icon" data-code-guide-key="taskbar.undo" @click=${() => undo()}>
        ${buttonIcon("undo", t("taskbar.undo", language))}
      </button>
      <button class="btn icon" data-code-guide-key="taskbar.new" @click=${() => newPattern()}>
        ${buttonIcon("newFile", t("taskbar.new", language))}
      </button>
      <button class="btn icon" data-code-guide-key="taskbar.import" @click=${() => uploadFile()}>
        ${buttonIcon("import", t("taskbar.import", language))}
      </button>
      <button class="btn icon" data-code-guide-key="taskbar.export" @click=${() => dispatch({ showDownload: true })}>
        ${buttonIcon("download", t("taskbar.export", language))}
      </button>
      <button
        data-code-guide-key="taskbar.library"
        class="btn icon ${GLOBAL_STATE.showLibrary ? "open" : ""}"
        @click=${() => dispatch({ showLibrary: !GLOBAL_STATE.showLibrary })}>
        ${buttonIcon("library", t("taskbar.library", language))}
      </button>
      <button
        data-code-guide-key="taskbar.settings"
        class="btn icon ${GLOBAL_STATE.showSettings ? "open" : ""}"
        @click=${() => dispatch({ showSettings: !GLOBAL_STATE.showSettings })}>
        ${buttonIcon("settings", t("taskbar.settings", language))}
      </button>
      <button class="btn icon" data-code-guide-key="taskbar.fullscreen" @click=${() => toggleFullscreen()}>
        ${buttonIcon("fullscreen", t("taskbar.fullscreen", language))}
      </button>
    </div>
    <div
      class="fabric-mode-controls"
      role="group"
      aria-label=${t("workspace.navigation", language)}>
      <button
        type="button"
        class="btn ${GLOBAL_STATE.workspaceMode === "pattern" ? "selected" : ""}"
        aria-pressed=${GLOBAL_STATE.workspaceMode === "pattern"}
        @click=${() => dispatch({ workspaceMode: "pattern" })}>
        ${t("workspace.pattern", language)}
      </button>
      <button
        type="button"
        class="btn ${GLOBAL_STATE.workspaceMode === "machine" ? "selected" : ""}"
        aria-pressed=${GLOBAL_STATE.workspaceMode === "machine"}
        @click=${() => dispatch({ workspaceMode: "machine" })}>
        ${t("workspace.machine", language)}
      </button>
    </div>
  </div>`;
}
