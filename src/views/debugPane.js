import { html } from "lit-html";
import { map } from "lit-html/directives/map.js";

import { GLOBAL_STATE, dispatch } from "../state";
import { buttonIcon } from "./uiButton";
import { t } from "../i18n";

const styles = html`<style>
  #debug-pane {
    display: flex;
    flex-direction: column;
  }
  #debug-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: #1a1919;
    padding: 4px;
  }

  #debug-header > h3 {
    margin: 0;
  }

  #debug-header > button {
    display: flex;
    padding: 0;
    border: 0;
    outline: 0;
    background-color: transparent;
    color: #939292;
    font-size: large;
    cursor: pointer;
  }

  #debug-header > button:hover {
    color: red;
  }

  #debug-content {
    display: grid;
    grid-template-columns: auto auto;
    gap: 1px;
    background-color: #1a1919;
    color: #dadada;
    flex-basis: 350px;
    overflow-y: auto;
  }

  #debug-content > * {
    background-color: #2c2c2c;
    padding: 5px;
  }

  #debug-content > h4 {
    margin: 0;
    text-align: right;
    white-space: nowrap;
  }

  .chip-container {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .chip {
    font-weight: bold;
    padding: 4px;
    border-radius: 5px;
    background: #5e5e5e;
    paint-order: stroke fill;
    text-shadow: 1px 0 0 black, 0 1px 0 black, -1px 0 0 black, 0 -1px 0 black;
    box-shadow: 0 0 2px black;
  }

  .number-field {
    font-size: large;
    font-weight: bold;
    font-family: monospace;
  }

  .bool-field {
    font-size: large;
    font-weight: bold;
    font-family: monospace;
    background-color: rgba(177, 211, 111, 1);
  }
</style>`;

export function debugPane() {
  const language = GLOBAL_STATE.language;

  return html`${styles}
    <div id="debug-pane">
      <div id="debug-header">
        <h3>${t("debug.title", language)}</h3>
        <button @click=${() => dispatch({ debug: false })}>
          ${buttonIcon("close", t("debug.close", language))}
        </button>
      </div>
      <div id="debug-content">
        <h4>${t("debug.scale", language)}</h4>
        <span>
          <span class="number-field">${GLOBAL_STATE.scale}</span>
          ${t("debug.pixelsPerPixel", language)}
        </span>
        <h4>${t("debug.xPos", language)}</h4>
        <span class="number-field">${GLOBAL_STATE.pos.x}</span>
        <h4>${t("debug.yPos", language)}</h4>
        <span class="number-field">${GLOBAL_STATE.pos.y}</span>
        <h4>${t("debug.activeTool", language)}</h4>
        <span class="text-field">${GLOBAL_STATE.activeTool}</span>
        <h4>${t("debug.activeColor", language)}</h4>
        <span class="number-field">${GLOBAL_STATE.activeColor}</span>
        <h4>${t("debug.devicePixelRatio", language)}</h4>
        <span>
          <span class="number-field">${devicePixelRatio}</span>
          ${t("debug.devicePixelsPerCssPixel", language)}
        </span>
        <h4>${t("debug.colorPalette", language)}</h4>
        <div class="chip-container">
          ${map(
            GLOBAL_STATE.yarnPalette,
            (rgba) =>
              html`<code class="chip" style="background:${rgba};"
                >${rgba}</code
              >`
          )}
        </div>
        <h4>${t("debug.snapshotLength", language)}</h4>
        <span class="number-field">${GLOBAL_STATE.snapshots.length}</span>
        <h4>${t("debug.heldKeys", language)}</h4>
        <div class="chip-container">
          ${GLOBAL_STATE.heldKeys.size > 0
            ? map(
                GLOBAL_STATE.heldKeys,
                (key) => html`<span class="chip">${key}</span>`
              )
            : html`<span class="chip">${t("debug.none", language)}</span>`}
        </div>
        <h4>${t("debug.grid", language)}</h4>
        <div class="chip-container">
          <span
            class="chip"
            style="background:${GLOBAL_STATE.grid
              ? "rgb(79 161 50)"
              : "rgb(194 55 68)"};"
            >${GLOBAL_STATE.grid}</span
          >
        </div>
        <h4>${t("debug.editingPalette", language)}</h4>
        <div class="chip-container">
          <span
            class="chip"
            style="background:${GLOBAL_STATE.editingPalette
              ? "rgb(79 161 50)"
              : "rgb(194 55 68)"};"
            >${GLOBAL_STATE.editingPalette}</span
          >
        </div>
        <h4>${t("debug.showSettings", language)}</h4>
        <div class="chip-container">
          <span
            class="chip"
            style="background:${GLOBAL_STATE.showSettings
              ? "rgb(79 161 50)"
              : "rgb(194 55 68)"};"
            >${GLOBAL_STATE.showSettings}</span
          >
        </div>
        <h4>${t("debug.showDownload", language)}</h4>
        <div class="chip-container">
          <span
            class="chip"
            style="background:${GLOBAL_STATE.showDownload
              ? "rgb(79 161 50)"
              : "rgb(194 55 68)"};"
            >${GLOBAL_STATE.showDownload}</span
          >
        </div>
        <h4>${t("debug.showDebug", language)}</h4>
        <div class="chip-container">
          <span
            class="chip"
            style="background:${GLOBAL_STATE.debug
              ? "rgb(79 161 50)"
              : "rgb(194 55 68)"};"
            >${GLOBAL_STATE.debug}</span
          >
        </div>
      </div>
    </div>`;
}
