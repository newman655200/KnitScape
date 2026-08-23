import { GLOBAL_STATE } from "../state";
import { html } from "lit-html";
import { when } from "lit-html/directives/when.js";
import { t } from "../i18n";

function xPos(repeat) {
  return Math.floor((repeat.pos[0] * GLOBAL_STATE.scale) / devicePixelRatio);
}

function yPos(repeat) {
  return Math.floor(
    ((GLOBAL_STATE.chart.height - repeat.area[1] - repeat.pos[1]) *
      GLOBAL_STATE.scale) /
      devicePixelRatio
  );
}

function selectedRepeatCell(index) {
  const selected = GLOBAL_STATE.selectedRepeatCell;
  if (!selected || selected.repeatIndex != index) return null;

  const cellSize = GLOBAL_STATE.scale / devicePixelRatio;
  return html`<div
    class="selected-repeat-cell"
    style="left:${selected.pos.x * cellSize}px; top:${selected.pos.y *
    cellSize}px; width:${cellSize}px; height:${cellSize}px;"></div>`;
}

export function repeatCanvas() {
  const language = GLOBAL_STATE.language;

  return html` <div id="repeat-container" data-code-guide-key="chart.repeat">
    ${GLOBAL_STATE.repeats.map(
      (repeat, index) =>
        html`<div
          data-repeatindex=${index}
          class="repeat-canvas-container"
          style="transform: translate(${xPos(repeat)}px, ${yPos(
            repeat
          )}px); ${GLOBAL_STATE.editingRepeat == index
            ? "z-index: 3"
            : "z-index: 1"}"
          id="repeat-${index}-container">
          <div
            class="repeat-bounds"
            style="width: ${(repeat.area[0] * GLOBAL_STATE.scale) /
            devicePixelRatio}px; height: ${(repeat.area[1] *
              GLOBAL_STATE.scale) /
            devicePixelRatio}px;">
            ${when(
              GLOBAL_STATE.editingRepeat == index,
              () => html`<button
                  data-code-guide-key="repeat.area-height"
                  class="repeat-area-dragger y-axis grab"
                  aria-label=${t("repeatCanvas.adjustHeight", language)}></button
                ><button
                  data-code-guide-key="repeat.area-width"
                  class="repeat-area-dragger x-axis grab"
                  aria-label=${t("repeatCanvas.adjustWidth", language)}></button>`
            )}
          </div>
          <canvas id="repeat-${index}" class="repeat-canvas"></canvas>
          <canvas id="repeat-${index}-grid" class="grid-canvas"></canvas>
          <canvas id="repeat-${index}-outline" class="outline-canvas"></canvas>
          ${selectedRepeatCell(index)}
        </div>`
    )}
  </div>`;
}
