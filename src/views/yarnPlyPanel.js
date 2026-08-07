import { html } from "lit-html";
import { GLOBAL_STATE, dispatch } from "../state";
import {
  TEXTURE_PERFORMANCE_MODES,
  YARN_TEXTURE_SIZES,
} from "../constants";
import jscolor from "@eastdesire/jscolor";
import { buttonIcon } from "./uiButton";
import {
  DEFAULT_YARN_SCAN_TEXTURE,
  normalizeYarnTexture,
  processYarnScanDataUrl,
  processYarnScanFile,
  readFileAsDataUrl,
} from "../yarnTexture/yarnScanTexture";
import { t } from "../i18n";
import { yarnLengthReadout } from "./yarnLengthReadout";

const YARN_PLY_LABELS = [
  {
    titleKey: "yarnPly.firstTitle",
    colorKey: "yarnPly.firstColor",
    diameterKey: "yarnPly.firstDiameter",
    lengthKey: "yarnPly.firstLength",
  },
  {
    titleKey: "yarnPly.secondTitle",
    colorKey: "yarnPly.secondColor",
    diameterKey: "yarnPly.secondDiameter",
  },
];

function updateYarnPly(index, patch) {
  const yarnPlies = GLOBAL_STATE.yarnPlies.map((ply, plyIndex) =>
    plyIndex == index ? { ...ply, ...patch } : { ...ply }
  );

  dispatch({ yarnPlies });
}

function editYarnPlyColor(index, target) {
  if (!target.jscolor) {
    const picker = new jscolor(target, {
      preset: "dark large",
      format: "hexa",
      value: GLOBAL_STATE.yarnPlies[index].color,
      onInput: () => {
        updateYarnPly(index, {
          color: picker.toRGBAString(),
        });
      },
      previewElement: null,
    });
  }

  target.jscolor.show();
}

function updateYarnPlyTexture(index, texturePatch) {
  const currentTexture = normalizeYarnTexture(
    GLOBAL_STATE.yarnPlies[index].texture
  );

  if (!currentTexture) return;

  updateYarnPly(index, {
    texture: normalizeYarnTexture({
      ...currentTexture,
      ...texturePatch,
    }),
  });
}

async function reprocessYarnScanTexture(index, texturePatch) {
  const currentTexture = normalizeYarnTexture(
    GLOBAL_STATE.yarnPlies[index].texture
  );

  if (!currentTexture?.dataUrl) return;

  const nextTexture = normalizeYarnTexture({
    ...currentTexture,
    ...texturePatch,
  });
  updateYarnPly(index, { texture: nextTexture });

  try {
    const processedDataUrl = await processYarnScanDataUrl(
      nextTexture.dataUrl,
      nextTexture
    );
    updateYarnPly(index, {
      texture: normalizeYarnTexture({
        ...nextTexture,
        processedDataUrl,
      }),
    });
  } catch (error) {
    console.error(error);
    alert(t("alerts.textureReprocessFailed", GLOBAL_STATE.language));
  }
}

function clearYarnScanTexture(index) {
  updateYarnPly(index, { texture: null });
}

function updateTexturePerformanceMode(value) {
  dispatch({
    texturePerformanceMode: value,
    texturePreviewInteractionActive: false,
  });
}

function defaultYarnTextureOptions() {
  return {
    enabled: false,
    useOriginalColor: false,
  };
}

async function importYarnScanTexture(index) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp";
  input.style.display = "none";

  input.addEventListener("change", async () => {
    const file = input.files?.[0];

    try {
      if (!file) return;

      const currentTexture = normalizeYarnTexture(
        GLOBAL_STATE.yarnPlies[index].texture
      );
      const defaultTextureOptions = defaultYarnTextureOptions(index);
      const texture = await processYarnScanFile(file, {
        backgroundThreshold: currentTexture?.backgroundThreshold ?? 0.92,
        enabled: currentTexture?.enabled ?? defaultTextureOptions.enabled,
        maxSize: currentTexture?.maxSize ?? 512,
        useOriginalColor:
          currentTexture?.useOriginalColor ??
          defaultTextureOptions.useOriginalColor,
        textureStrength: currentTexture?.textureStrength ?? 0.75,
        fuzzStrength: currentTexture?.fuzzStrength ?? 0.45,
      });

      updateYarnPly(index, { texture });
    } catch (error) {
      console.error(error);
      alert(t("alerts.textureImportFailed", GLOBAL_STATE.language));
    } finally {
      input.remove();
    }
  });

  document.body.appendChild(input);
  input.click();
}

async function importPbrMap(index, mapKey) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp";
  input.style.display = "none";

  input.addEventListener("change", async () => {
    const file = input.files?.[0];

    try {
      if (!file) return;

      const dataUrl = await readFileAsDataUrl(file);
      const currentTexture =
        normalizeYarnTexture(GLOBAL_STATE.yarnPlies[index].texture) ||
        normalizeYarnTexture({
          ...DEFAULT_YARN_SCAN_TEXTURE,
          ...defaultYarnTextureOptions(index),
        });

      updateYarnPly(index, {
        texture: normalizeYarnTexture({
          ...currentTexture,
          enabled: true,
          pbr: {
            ...currentTexture.pbr,
            [mapKey]: {
              fileName: file.name || `${mapKey}.png`,
              dataUrl,
              processedDataUrl: dataUrl,
            },
          },
        }),
      });
    } catch (error) {
      console.error(error);
      alert(t("alerts.textureImportFailed", GLOBAL_STATE.language));
    } finally {
      input.remove();
    }
  });

  document.body.appendChild(input);
  input.click();
}

function yarnScanTextureControls(index, ply) {
  const language = GLOBAL_STATE.language;
  const texture = normalizeYarnTexture(ply.texture);
  const defaultTextureOptions = defaultYarnTextureOptions(index);
  const textureEnabled = texture
    ? texture.enabled !== false
    : defaultTextureOptions.enabled;
  const useOriginalColor = texture
    ? texture.useOriginalColor !== false
    : defaultTextureOptions.useOriginalColor;
  const pbrMaps = [
    ["baseColor", "yarnTexture.pbrBaseColor", "pbrMap-baseColor"],
    ["normal", "yarnTexture.pbrNormal", "pbrMap-normal"],
    ["roughness", "yarnTexture.pbrRoughness", "pbrMap-roughness"],
    ["height", "yarnTexture.pbrHeight", "pbrMap-height"],
    [
      "ambientOcclusion",
      "yarnTexture.pbrAmbientOcclusion",
      "pbrMap-ambientOcclusion",
    ],
  ];

  return html`<div class="yarn-texture-controls">
    <div class="yarn-texture-header">
      <strong>${t("yarnTexture.title", language)}</strong>
      <button
        data-code-guide-key="yarn.texture-import"
        type="button"
        class="btn solid yarn-texture-import-button"
        @click=${() => importYarnScanTexture(index)}>
        ${t("yarnTexture.import", language)}
      </button>
    </div>
    <div class="yarn-texture-status">
      ${texture?.processedDataUrl
        ? html`<img
            class="yarn-texture-preview"
            src=${texture.processedDataUrl}
            alt=${t("yarnTexture.previewAlt", language)} />`
        : html`<div class="yarn-texture-preview empty">
            ${t("yarnTexture.empty", language)}
          </div>`}
      <span>${texture?.fileName || t("yarnTexture.noFile", language)}</span>
    </div>
    <div class="yarn-pbr-map-grid">
      ${pbrMaps.map(
        ([mapKey, labelKey, className]) => html`<button
          type="button"
          class="btn solid yarn-pbr-map-button ${className}"
          @click=${() => importPbrMap(index, mapKey)}>
          ${t(labelKey, language)}
        </button>`
      )}
    </div>
    <label class="form-control toggle yarn-texture-toggle" data-code-guide-key="yarn.texture-enable">
      <input
        type="checkbox"
        ?checked=${textureEnabled}
        ?disabled=${!texture}
        @change=${(e) =>
          updateYarnPlyTexture(index, {
            enabled: e.target.checked,
          })} />
      ${t("yarnTexture.enable", language)}
    </label>
    <label class="form-control toggle yarn-texture-toggle" data-code-guide-key="yarn.texture-original-color">
      <input
        type="checkbox"
        ?checked=${useOriginalColor}
        ?disabled=${!texture}
        @change=${(e) =>
          updateYarnPlyTexture(index, {
            useOriginalColor: e.target.checked,
          })} />
      ${t("yarnTexture.useOriginalColor", language)}
    </label>
    <label class="form-control yarn-texture-select-control" data-code-guide-key="yarn.texture-size">
      <span>${t("yarnTexture.size", language)}</span>
      <select
        ?disabled=${!texture}
        .value=${String(texture?.maxSize ?? 512)}
        @change=${(e) =>
          reprocessYarnScanTexture(index, {
            maxSize: Number(e.target.value),
          })}>
        ${YARN_TEXTURE_SIZES.map(
          (size) => html`<option
            value=${String(size)}
            ?selected=${size === (texture?.maxSize ?? 512)}>
            ${size}
          </option>`
        )}
      </select>
    </label>
    <label class="form-control range yarn-texture-range" data-code-guide-key="yarn.texture-background">
      <span>${t("yarnTexture.background", language)}</span>
      <input
        type="range"
        min="0.75"
        max="0.99"
        step="0.01"
        ?disabled=${!texture}
        .value=${String(texture?.backgroundThreshold ?? 0.92)}
        @change=${(e) =>
          reprocessYarnScanTexture(index, {
            backgroundThreshold: Number(e.target.value),
          })} />
    </label>
    <label class="form-control range yarn-texture-range" data-code-guide-key="yarn.texture-strength">
      <span>${t("yarnTexture.textureStrength", language)}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        ?disabled=${!texture}
        .value=${String(texture?.textureStrength ?? 0.75)}
        @input=${(e) =>
          updateYarnPlyTexture(index, {
            textureStrength: Number(e.target.value),
          })} />
    </label>
    <label class="form-control range yarn-texture-range" data-code-guide-key="yarn.texture-fuzz">
      <span>${t("yarnTexture.fuzzStrength", language)}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        ?disabled=${!texture}
        .value=${String(texture?.fuzzStrength ?? 0.45)}
        @input=${(e) =>
          updateYarnPlyTexture(index, {
            fuzzStrength: Number(e.target.value),
          })} />
    </label>
    <button
      data-code-guide-key="yarn.texture-clear"
      type="button"
      class="btn solid yarn-texture-clear-button"
      ?disabled=${!texture}
      @click=${() => clearYarnScanTexture(index)}>
      ${t("yarnTexture.clear", language)}
    </button>
  </div>`;
}

function texturePerformanceControls() {
  const language = GLOBAL_STATE.language;

  return html`<label class="form-control yarn-performance-control" data-code-guide-key="yarn.performance">
    <span>${t("texturePerformance.label", language)}</span>
    <select
      .value=${GLOBAL_STATE.texturePerformanceMode ||
      TEXTURE_PERFORMANCE_MODES.AUTO}
      @change=${(e) => updateTexturePerformanceMode(e.target.value)}>
      <option
        value=${TEXTURE_PERFORMANCE_MODES.AUTO}
        ?selected=${(GLOBAL_STATE.texturePerformanceMode ||
          TEXTURE_PERFORMANCE_MODES.AUTO) === TEXTURE_PERFORMANCE_MODES.AUTO}>
        ${t("texturePerformance.auto", language)}
      </option>
      <option
        value=${TEXTURE_PERFORMANCE_MODES.QUALITY}
        ?selected=${GLOBAL_STATE.texturePerformanceMode ===
        TEXTURE_PERFORMANCE_MODES.QUALITY}>
        ${t("texturePerformance.quality", language)}
      </option>
      <option
        value=${TEXTURE_PERFORMANCE_MODES.SOLID}
        ?selected=${GLOBAL_STATE.texturePerformanceMode ===
        TEXTURE_PERFORMANCE_MODES.SOLID}>
        ${t("texturePerformance.solid", language)}
      </option>
    </select>
  </label>`;
}

export function yarnPlyPanel() {
  const language = GLOBAL_STATE.language;

  return html`<section id="yarn-ply-panel" class="yarn-ply-panel">
    <h3>${t("left.yarnPlyPanel", language)}</h3>
    ${yarnLengthReadout()}
    ${texturePerformanceControls()}
    ${GLOBAL_STATE.yarnPlies.map((ply, index) => {
      const isFirst = index == 0;
      const labels = YARN_PLY_LABELS[index] || YARN_PLY_LABELS[0];

      return html`<div class="yarn-ply-card">
        <div class="yarn-ply-card-title">${t(labels.titleKey, language)}</div>
        <button
          data-code-guide-key="yarn.ply-color"
          id="yarn-ply-color-${index}"
          class="yarn-ply-color-button"
          type="button"
          @click=${(e) => editYarnPlyColor(index, e.currentTarget)}>
          <span
            class="yarn-ply-swatch"
            style="--current: ${ply.color};"></span>
          <span>${t(labels.colorKey, language)}</span>
        </button>
        ${isFirst
          ? ""
          : html`<label class="form-control toggle yarn-ply-toggle" data-code-guide-key="yarn.ply-visible">
              <input
                type="checkbox"
                name="yarn-ply-enabled-${index}"
                ?checked=${ply.enabled}
                @change=${(e) =>
                  updateYarnPly(index, { enabled: e.target.checked })} />
              ${t("yarnPly.showSecond", language)}
            </label>`}
        <label class="form-control range yarn-ply-diameter-control" data-code-guide-key="yarn.ply-diameter">
          <span>${t(labels.diameterKey, language)}</span>
          <input
            type="range"
            name="yarn-ply-diameter-${index}"
            min="0.06"
            max="0.5"
            step="0.01"
            .value=${String(ply.diameter)}
            @input=${(e) =>
              updateYarnPly(index, {
                diameter: Number(e.target.value),
              })} />
          <span class="range-value">${ply.diameter.toFixed(2)}</span>
        </label>
        ${isFirst
          ? html`<label class="form-control range yarn-ply-length-control" data-code-guide-key="yarn.ply-length">
              <span>${t("yarnPly.firstLength", language)}</span>
              <input
                type="range"
                name="yarn-ply-length-0"
                min="0.90"
                max="1.10"
                step="0.01"
                .value=${String(ply.lengthScaleY ?? 1)}
                @input=${(e) =>
                  updateYarnPly(0, {
                    lengthScaleY: Number(e.target.value),
                  })} />
              <span class="range-value">${(ply.lengthScaleY ?? 1).toFixed(2)}</span>
            </label>`
          : html`<div class="yarn-ply-length-inherited">
              ${t("yarnPly.followsFirst", language)}
            </div>`}
        ${yarnScanTextureControls(index, ply)}
      </div>`;
    })}
  </section>`;
}
