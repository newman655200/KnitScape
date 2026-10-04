import { html } from "lit-html";

import {
  createSingleJerseyCamProgram,
  cycleSingleJerseyCamOperation,
  deleteSingleJerseyCamProgram,
  getSingleJerseyFeedIndices,
  resizeSingleJerseyCamProgram,
  setSingleJerseyFeedYarnLength,
  setSingleJerseyFeedYarnLengths,
} from "../actions/singleJerseyCamProgram.js";
import knitIconUrl from "../assets/symbols/knit.svg";
import slipIconUrl from "../assets/symbols/slip.svg";
import tuckIconUrl from "../assets/symbols/tuck.svg";
import { t } from "../i18n/index.js";
import { GLOBAL_STATE } from "../state.js";

const OPERATION_ORDER = ["K", "M", "T"];
const OPERATION_ICON_URLS = {
  K: knitIconUrl,
  T: tuckIconUrl,
  M: slipIconUrl,
};
const OPERATION_LABEL_KEYS = {
  K: "camProgram.knit",
  T: "camProgram.tuck",
  M: "camProgram.miss",
};

function resizeCamProgram(event, trackCount, feedCount) {
  const input = event.target;

  try {
    resizeSingleJerseyCamProgram(Number(trackCount), Number(feedCount));
  } catch (_error) {
    const camProgram = GLOBAL_STATE.singleJerseyCamProgram;
    input.value = String(
      input.name === "tracks"
        ? camProgram.tracks.length
        : camProgram.tracks[0].length
    );
  }
}

function displayYarnLength(value) {
  const length = Number(value);
  return Number.isFinite(length) && length > 0 ? length.toFixed(1) : "";
}

function commitYarnLength(event) {
  const input = event.currentTarget;
  setSingleJerseyFeedYarnLength(
    Number(input.dataset.feedIndex),
    Number(input.dataset.yarnIndex),
    input.value
  );
}

function finishYarnLengthOnEnter(event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  event.currentTarget.blur();
}

function applyBatchYarnLength(event, feedCount) {
  event.preventDefault();
  const form = event.currentTarget;
  const editor = form.closest("#single-jersey-cam-editor");
  const selectedFeedIndices = Array.from(
    editor.querySelectorAll('input[name="selected-feed"]:checked'),
    (input) => Number(input.value)
  );
  const feedIndices = getSingleJerseyFeedIndices(
    form.elements.scope.value,
    feedCount,
    selectedFeedIndices
  );
  setSingleJerseyFeedYarnLengths(feedIndices, form.elements.yarnLength.value);
}

function feedYarnLengthEditor(feed, feedIndex, language) {
  const yarns = Array.isArray(feed?.yarns) && feed.yarns.length
    ? feed.yarns
    : [{ yarnLengthCmPer100Needles: 0 }];
  return html`<div class="cam-feed-yarn-lengths">
    ${yarns.map((yarn, yarnIndex) => html`<label>
      <span>${yarns.length === 1
        ? t("camProgram.yarnLength", language)
        : t("camProgram.yarn", language, { number: yarnIndex + 1 })}</span>
      <input
        type="number"
        min="0"
        step="0.1"
        inputmode="decimal"
        data-feed-index=${feedIndex}
        data-yarn-index=${yarnIndex}
        .value=${displayYarnLength(yarn.yarnLengthCmPer100Needles)}
        @change=${commitYarnLength}
        @keydown=${finishYarnLengthOnEnter} />
    </label>`)}
    <span class="cam-yarn-length-unit">
      ${t("camProgram.yarnLengthUnit", language)}
    </span>
  </div>`;
}

function batchYarnLengthEditor(feedCount, language) {
  return html`<form
    class="cam-yarn-length-batch"
    @submit=${(event) => applyBatchYarnLength(event, feedCount)}>
    <span>${t("camProgram.batchYarnLength", language)}</span>
    <input
      name="yarnLength"
      type="number"
      min="0"
      step="0.1"
      inputmode="decimal"
      placeholder="23.0"
      aria-label=${t("camProgram.batchYarnLength", language)} />
    <span>${t("camProgram.yarnLengthUnit", language)}</span>
    <select name="scope">
      <option value="all">${t("camProgram.batchAll", language)}</option>
      <option value="odd">${t("camProgram.batchOdd", language)}</option>
      <option value="even">${t("camProgram.batchEven", language)}</option>
      <option value="selected">${t("camProgram.batchSelected", language)}</option>
    </select>
    <button type="submit" class="btn solid">
      ${t("camProgram.batchApply", language)}
    </button>
  </form>`;
}

function operationLegend(language) {
  return html`<div class="cam-program-legend" aria-label=${t(
    "camProgram.operations",
    language
  )}>
    ${OPERATION_ORDER.map(
      (operation) => html`<span
        class="cam-operation-${operation.toLowerCase()}">
        <img
          class="symbol-preview-image"
          src=${OPERATION_ICON_URLS[operation]}
          alt=""
          aria-hidden="true"
          draggable="false" />
        ${t(OPERATION_LABEL_KEYS[operation], language)}
      </span>`
    )}
  </div>`;
}

function camProgramGrid(camProgram, language) {
  const feedCount = camProgram.tracks[0].length;

  return html`<div class="cam-program-grid-scroller">
    <table class="cam-program-grid">
      <thead>
        <tr>
          <th scope="col">${t("camProgram.tracks", language)}</th>
          ${Array.from(
            { length: feedCount },
            (_, feed) => html`<th scope="col" class="cam-feed-header">
              <label class="cam-feed-select">
                <input
                  type="checkbox"
                  name="selected-feed"
                  value=${feed}
                  aria-label=${t("camProgram.selectFeed", language, {
                    number: feed + 1,
                  })} />
                <span>${t("camProgram.feed", language, { number: feed + 1 })}</span>
              </label>
              ${feedYarnLengthEditor(camProgram.feeds?.[feed], feed, language)}
            </th>`
          )}
        </tr>
      </thead>
      <tbody>
        ${camProgram.tracks.map(
          (track, trackIndex) => html`<tr>
            <th scope="row">
              ${t("camProgram.type", language, { number: trackIndex + 1 })}
            </th>
            ${track.map(
              (operation, feedIndex) => html`<td>
                <button
                  type="button"
                  class="cam-program-cell cam-operation-${operation.toLowerCase()}"
                  title=${t(OPERATION_LABEL_KEYS[operation], language)}
                  aria-label=${t("camProgram.cell", language, {
                    type: trackIndex + 1,
                    feed: feedIndex + 1,
                    operation: t(OPERATION_LABEL_KEYS[operation], language),
                  })}
                  @click=${() =>
                    cycleSingleJerseyCamOperation(trackIndex, feedIndex)}>
                  <img
                    class="symbol-preview-image"
                    src=${OPERATION_ICON_URLS[operation]}
                    alt=${t(OPERATION_LABEL_KEYS[operation], language)}
                    draggable="false" />
                </button>
              </td>`
            )}
          </tr>`
        )}
      </tbody>
    </table>
  </div>`;
}

export function singleJerseyCamProgramEditor() {
  const language = GLOBAL_STATE.language;
  const camProgram = GLOBAL_STATE.singleJerseyCamProgram;

  if (camProgram === null) {
    return html`<section id="single-jersey-cam-editor" class="cam-program-empty">
      <div class="cam-program-header">
        <div>
          <h2>${t("camProgram.title", language)}</h2>
          <p>${t("camProgram.empty", language)}</p>
        </div>
        <button
          type="button"
          class="btn solid"
          @click=${() => createSingleJerseyCamProgram()}>
          ${t("camProgram.create", language)}
        </button>
      </div>
    </section>`;
  }

  const trackCount = camProgram.tracks.length;
  const feedCount = camProgram.tracks[0].length;

  return html`<section id="single-jersey-cam-editor">
    <div class="cam-program-header">
      <div>
        <h2>${t("camProgram.title", language)}</h2>
        <p>${t("camProgram.mapping", language)}</p>
      </div>
      <div class="cam-program-dimensions">
        <label>
          <span>${t("camProgram.tracks", language)}</span>
          <input
            name="tracks"
            type="number"
            min="1"
            step="1"
            .value=${String(trackCount)}
            @change=${(event) =>
              resizeCamProgram(event, event.target.value, feedCount)} />
        </label>
        <label>
          <span>${t("camProgram.feeds", language)}</span>
          <input
            name="feeds"
            type="number"
            min="1"
            step="1"
            .value=${String(feedCount)}
            @change=${(event) =>
              resizeCamProgram(event, trackCount, event.target.value)} />
        </label>
      </div>
      ${batchYarnLengthEditor(feedCount, language)}
      ${operationLegend(language)}
      <span class="cam-program-cycle-hint">
        ${t("camProgram.cycleHint", language)}
      </span>
      <button
        type="button"
        class="btn solid cam-program-delete"
        @click=${() => deleteSingleJerseyCamProgram()}>
        ${t("camProgram.delete", language)}
      </button>
    </div>
    ${camProgramGrid(camProgram, language)}
  </section>`;
}
