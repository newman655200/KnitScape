import { html } from "lit-html";
import jscolor from "@eastdesire/jscolor";
import { GLOBAL_STATE, dispatch } from "../state";
import { Bimp } from "../lib/Bimp";
import { getRandomColor, shuffle } from "../utils";
import { updateYarnPaletteColor } from "../actions/yarnPaletteEditing";
import { buttonIcon, buttonIconSrc } from "./uiButton";
import { t } from "../i18n";

function deleteColor(index) {
  if (GLOBAL_STATE.yarnPalette.length == 1) {
    alert(t("alerts.needOneColor", GLOBAL_STATE.language));
    return;
  }
  const newPalette = GLOBAL_STATE.yarnPalette.filter((color, i) => i != index);
  const newBitmap = GLOBAL_STATE.yarnSequence.pixels.map((bit) => {
    if (bit == index) return 0;
    if (bit > index) return bit - 1;
    return bit;
  });

  dispatch({
    yarnPalette: newPalette,
    yarnSequence: new Bimp(
      GLOBAL_STATE.yarnSequence.width,
      GLOBAL_STATE.yarnSequence.height,
      newBitmap
    ),
  });
}

function editColor(index) {
  const target = document.getElementById(`color-${index}`);
  if (!target.jscolor) {
    const picker = new jscolor(target, {
      preset: "dark large",
      format: "hexa",
      value: GLOBAL_STATE.yarnPalette[index],
      onInput: () => {
        dispatch(
          updateYarnPaletteColor({
            yarnPalette: GLOBAL_STATE.yarnPalette,
            yarnSequence: GLOBAL_STATE.yarnSequence,
            index,
            color: picker.toRGBAString(),
          })
        );
      },
      previewElement: null,
    });
  }
  target.jscolor.show();
}

export function yarnPicker() {
  const language = GLOBAL_STATE.language;

  return html`<div id="yarn-picker">
    <h3>${t("yarns.title", language)}</h3>
    <div>
      <button
        data-code-guide-key="palette.edit"
        class="btn icon ${GLOBAL_STATE.editingPalette ? "selected" : ""}"
        @click=${() =>
          dispatch({ editingPalette: !GLOBAL_STATE.editingPalette })}>
        ${buttonIcon("pen", t("yarns.editPalette", language))}
      </button>
      <button
        data-code-guide-key="palette.add"
        class="btn icon"
        @click=${() => {
          let newPalette = [...GLOBAL_STATE.yarnPalette];
          newPalette.push(getRandomColor());
          dispatch({ yarnPalette: newPalette });
        }}>
        ${buttonIcon("add", t("yarns.addColor", language))}
      </button>
    </div>
    ${GLOBAL_STATE.yarnPalette.map(
      (hexa, index) =>
        html`<div
          class="btn solid color-select ${index == GLOBAL_STATE.activeYarn
            ? "selected"
            : ""}">
          <button
            data-code-guide-key="palette.label"
            type="button"
            class="color-label-button"
            @click=${() => dispatch({ activeYarn: index })}>
            <span class="color-label">${index + 1}</span>
          </button>
          <div
            class="color-preview"
            data-code-guide-key="palette.color"
            style="--current: ${hexa};">
            ${GLOBAL_STATE.editingPalette
              ? html`
                  <button
                    data-code-guide-key="palette.delete"
                    class="delete-color-button"
                    @click=${(e) => {
                      e.stopPropagation();
                      deleteColor(index);
                    }}>
                    ${buttonIcon("close", t("yarns.delete", language))}
                  </button>
                `
              : ""}
            <button
              id="color-${index}"
              class="edit-color-btn"
              @click=${(e) => {
                e.stopPropagation();
                dispatch({ activeYarn: index });
                editColor(index);
              }}></button>
            <div
              class="edit-color-icon"
              @click=${(e) => {
                e.stopPropagation();
                dispatch({ activeYarn: index });
                editColor(index);
              }}>
              <img
                class="button-image"
                src=${buttonIconSrc("pen")}
                alt=""
                aria-hidden="true" />
              <span>${t("yarns.edit", language)}</span>
            </div>
          </div>
        </div>`
    )}

    <div>
      <button
        data-code-guide-key="palette.shuffle"
        class="btn icon"
        @click=${() => {
          dispatch({
            yarnPalette: [...shuffle(GLOBAL_STATE.yarnPalette)],
          });
        }}>
        ${buttonIcon("shuffle", t("yarns.shuffle", language))}
      </button>
      <button
        data-code-guide-key="palette.randomize"
        class="btn icon"
        @click=${() => {
          dispatch({
            yarnPalette: Array.from(
              Array(GLOBAL_STATE.yarnPalette.length),
              () => getRandomColor()
            ),
          });
        }}>
        ${buttonIcon("dice", t("yarns.randomize", language))}
      </button>
    </div>
  </div>`;
}
