import { html, svg } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { t } from "../i18n/index.js";
import { getNeedleTypeAtPosition } from "../simulation/needleArrangementOverlay.js";
import { courseToFeedIndex } from "../simulation/yarnLengthMetrics.js";

const OPERATION_LABELS = { K: "camProgram.knit", T: "camProgram.tuck", M: "camProgram.miss" };
const stopPropagation = event => event.stopPropagation();

function operationControls({ preview, camProgram, arrangement, language, onChange, onFocus }) {
  const { row, needle, width, height, operation, operations } = preview;
  const feedCount = camProgram.tracks[0].length;
  const feed = courseToFeedIndex(row, feedCount);
  const needleType = getNeedleTypeAtPosition(arrangement, needle);
  const matchingRows = Array.from({ length: height }, (_, index) => index)
    .filter(index => courseToFeedIndex(index, feedCount) === feed);
  const position = row * width + needle;
  const step = direction => {
    const next = Math.max(0, Math.min(width * height - 1, position + direction));
    onChange({ row: Math.floor(next / width), needle: next % width });
  };
  const nearbyNeedles = Array.from({ length: Math.min(width, 7) }, (_, index) =>
    Math.max(0, Math.min(needle - 3, width - 7)) + index);
  const selectedPathCount = preview.paths.filter(path => path.selected).length;

  return html`
    <div class="operation-demo-controls">
      <label for="operation-feed-select">Feed
        <select id="operation-feed-select" .value=${live(String(feed))}
          @change=${event => {
            const nextFeed = Number(event.target.value);
            const sameCycleRow = Math.floor(row / feedCount) * feedCount + nextFeed;
            onChange({ row: sameCycleRow < height ? sameCycleRow : nextFeed, needle });
          }}>
          ${Array.from({ length: feedCount }, (_, index) => html`
            <option value=${index} .selected=${live(index === feed)} ?disabled=${index >= height}>${index + 1}</option>`)}
        </select>
      </label>
      <label for="operation-row-select">${t("operationDemo.row", language)}
        <select id="operation-row-select" .value=${live(String(row))}
          @change=${event => onChange({ row: Number(event.target.value), needle })}>
          ${matchingRows.map(index => html`<option value=${index} .selected=${live(index === row)}>${index + 1}</option>`)}
        </select>
      </label>
      <label for="operation-needle-select">${t("operationDemo.needle", language)}
        <input id="operation-needle-select" type="number" min="1" max=${width} step="1"
          .value=${live(String(needle + 1))}
          @change=${event => {
            const next = Number(event.target.value) - 1;
            if (Number.isInteger(next)) onChange({ row, needle: next });
            event.target.value = String(needle + 1);
          }} />
      </label>
      <div class="operation-demo-step">
        <button id="operation-prev" class="btn" type="button" ?disabled=${position === 0}
          @click=${() => step(-1)}>${t("operationDemo.previous", language)}</button>
        <button id="operation-next" class="btn" type="button" ?disabled=${position === width * height - 1}
          @click=${() => step(1)}>${t("operationDemo.next", language)}</button>
        <button id="operation-focus" class="btn" type="button"
          ?disabled=${selectedPathCount === 0}
          @click=${onFocus}>${t("operationDemo.focus", language)}</button>
      </div>
    </div>
    <p id="operation-focus-status" class="operation-demo-unavailable" role="status"></p>
    <div class="operation-demo-readout" aria-live="polite" aria-atomic="true">
      <span>${t("operationDemo.current", language, { row: row + 1, needle: needle + 1, type: needleType })}</span>
      <strong class="operation-demo-action">${operation} · ${t(OPERATION_LABELS[operation], language)}</strong>
    </div>
    <div class="operation-demo-cam" aria-label=${t("operationDemo.cam", language, { feed: feed + 1 })}>
      <span>${t("operationDemo.cam", language, { feed: feed + 1 })}</span>
      ${camProgram.tracks.map((track, index) => html`
        <span class="operation-demo-chip ${index + 1 === needleType ? "is-current" : ""}">
          Type ${index + 1}: ${track[feed]}
        </span>`)}
    </div>
    <div class="operation-demo-neighbors" aria-label=${t("operationDemo.neighbors", language)}>
      <span>${t("operationDemo.neighbors", language)}</span>
      ${nearbyNeedles.map(index => html`
        <button type="button" class="operation-demo-chip ${index === needle ? "is-current" : ""}"
          aria-pressed=${index === needle}
          aria-label=${t("operationDemo.neighbor", language, {
            needle: index + 1, type: getNeedleTypeAtPosition(arrangement, index), operation: operations[index],
          })}
          @click=${() => onChange({ row, needle: index })}>
          <span>${index + 1}</span><span>Type ${getNeedleTypeAtPosition(arrangement, index)}</span>
          <strong>${operations[index]}</strong>
        </button>`)}
    </div>
    <p class="operation-demo-hint operation-demo-path-status">
      ${t("operationDemo.pathCount", language, { total: preview.paths.length, selected: selectedPathCount })}
      ${selectedPathCount === 0 ? t("operationDemo.noAssociatedPath", language) : null}
    </p>
    <p class="operation-demo-hint">${t("operationDemo.pathHint", language)}</p>
  `;
}

export function machineOperationDemo({ enabled, preview, camProgram, arrangement, language, onChange, onFocus }) {
  return html`<section id="machine-operation-demo"
    @pointerdown=${stopPropagation} @touchstart=${stopPropagation} @wheel=${stopPropagation}
    @keydown=${stopPropagation} @keyup=${stopPropagation}>
    <label class="operation-demo-toggle" for="operation-demo-toggle">
      <input id="operation-demo-toggle" type="checkbox" .checked=${live(enabled)}
        @change=${event => onChange({ enabled: event.target.checked })} />
      ${t("operationDemo.title", language)}
    </label>
    ${enabled ? html`
      <p class="operation-demo-hint">${t("operationDemo.logicalHint", language)}</p>
      ${preview ? operationControls({ preview, camProgram, arrangement, language, onChange, onFocus })
        : html`<p class="operation-demo-unavailable" role="status">${t("operationDemo.unavailable", language)}</p>`}
    ` : null}
  </section>`;
}

export function operationPreviewOverlay(preview) {
  if (!preview) return null;
  const { canvasWidth, canvasHeight, displayWidth, displayHeight, paths, structureLineStyle } = preview;
  const trialStyle = path => structureLineStyle
    ? `stroke: ${structureLineStyle.colors.get(path.yarnId) || "#fff"}; stroke-width: ${path.selected ? 1.5 : 0.6}; opacity: ${path.selected ? 1 : 0.4}`
    : "";
  return svg`<svg id="operation-preview-overlay" class="operation-preview-overlay"
    width=${displayWidth} height=${displayHeight}
    viewBox="0 0 ${canvasWidth} ${canvasHeight}" aria-hidden="true" focusable="false">
    ${paths.filter(path => !path.selected).map(path => svg`
      <path class="operation-preview-row" d=${path.pathData} style=${trialStyle(path)} fill="none" vector-effect="non-scaling-stroke" />`)}
    ${paths.filter(path => path.selected).map(path => svg`
      <path class="operation-preview-selected" d=${path.pathData} style=${trialStyle(path)} fill="none" vector-effect="non-scaling-stroke" />`)}
  </svg>`;
}
