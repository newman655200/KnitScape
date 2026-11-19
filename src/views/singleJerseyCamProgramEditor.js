import { html } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { ref } from "lit-html/directives/ref.js";

import {
  createSingleJerseyCamProgram,
  cycleSingleJerseyCamOperation,
  deleteSingleJerseyCamProgram,
  getSingleJerseyFeedIndices,
  resizeSingleJerseyCamProgram,
  setSingleJerseyFeedYarnLength,
  setSingleJerseyFeedYarnLengths,
  clearSingleJerseyFeedYarnLength,
  setSingleJerseyFeedYarnLengthInputMode,
  setSingleJerseyFeedYarnDraftRatio,
  clearSingleJerseyFeedYarnDraftRatio,
} from "../actions/singleJerseyCamProgram.js";
import knitIconUrl from "../assets/symbols/knit.svg";
import slipIconUrl from "../assets/symbols/slip.svg";
import tuckIconUrl from "../assets/symbols/tuck.svg";
import { t } from "../i18n/index.js";
import { dispatch, GLOBAL_STATE } from "../state.js";
import { assignYarnToFeed, removeFeedYarnSlot } from "../actions/yarnLibrary.js";
import { yarnAssignmentNotice } from "./yarnLibrary.js";
import { validateYarnLengthInput } from "../domain/yarnLengthInput.js";
import { validateYarnLengthBatchSelection } from "../domain/yarnLengthBatch.js";
import { getYarnLengthFeedbackRows } from "./yarnLengthSolverFeedback.js";

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
  return Number.isFinite(length) && length > 0 ? String(length) : "";
}

function openYarnLibrary() {
  dispatch({ workspaceMode: "yarns" });
}

function commitYarnLength(event) {
  const input = event.currentTarget;
  const isDraftRatio = input.dataset.lengthField === "draftRatio";
  const result = (isDraftRatio ? setSingleJerseyFeedYarnDraftRatio : setSingleJerseyFeedYarnLength)(
    Number(isDraftRatio ? input.dataset.draftFeedIndex : input.dataset.feedIndex),
    Number(isDraftRatio ? input.dataset.draftYarnIndex : input.dataset.yarnIndex),
    input.value
  );
  if (!result.ok) input.value = displayYarnLength(result.previousValue);
  input.setCustomValidity("");
  setYarnLengthNotice(input, result.ok ? "" : t(input.dataset.lengthField === "directTarget"
    ? "camProgram.invalidYarnLength" : "camProgram.invalidLengthFact", GLOBAL_STATE.language));
  return result;
}

function setYarnLengthNotice(input, message) {
  input.closest(".cam-feed-yarn-slot").querySelector(".cam-yarn-length-feedback").textContent = message;
}

function validateYarnLengthDraft(event) {
  const input = event.currentTarget;
  const validation = validateYarnLengthInput(input.value);
  input.setCustomValidity(validation.ok ? "" : t(input.dataset.lengthField === "directTarget"
    ? "camProgram.invalidYarnLength" : "camProgram.invalidLengthFact", GLOBAL_STATE.language));
  setYarnLengthNotice(input, "");
}

function clearYarnLength(event, feedIndex, yarnIndex, field = "directTarget") {
  const isDraftRatio = field === "draftRatio";
  const result = (isDraftRatio ? clearSingleJerseyFeedYarnDraftRatio : clearSingleJerseyFeedYarnLength)(feedIndex, yarnIndex);
  const input = event.currentTarget.closest(".cam-feed-yarn-slot")
    .querySelector(isDraftRatio ? "input[data-draft-yarn-index]" : "input[data-yarn-index]");
  input.value = "";
  input.setCustomValidity("");
  setYarnLengthNotice(input, t(isDraftRatio ? "camProgram.draftRatioCleared"
    : field === "relaxedWithDraft" ? "camProgram.relaxedLengthCleared"
    : "camProgram.yarnLengthCleared", GLOBAL_STATE.language));
  return result;
}

function finishYarnLengthOnEnter(event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  event.currentTarget.blur();
}

// Local selection-time UI snapshots; none of this is project data.
const selectedBatchTargets = new Map();
let selectedStructureRevision = null;
const selectedFeedFilters = new Set();
let batchFeedScope = "all";
let batchFeedback = "";
const assignmentKey = (feed, yarn) => `${feed}:${yarn}`;
const batchSelection = () => ({ structureRevision: selectedStructureRevision, targets: [...selectedBatchTargets.values()] });
const batchStructureCurrent = () => selectedStructureRevision === GLOBAL_STATE.feedYarnStructureRevision;
function clearBatchSelection() {
  selectedBatchTargets.clear();
  selectedStructureRevision = null;
}

function candidateFeedIndices(feedCount) {
  return getSingleJerseyFeedIndices(batchFeedScope, feedCount, [...selectedFeedFilters]);
}

function batchFailureKey(reason) {
  return reason === "INVALID_YARN_LENGTH" ? "camProgram.batchInvalidValue"
    : reason === "STALE_ASSIGNMENT_STRUCTURE" ? "camProgram.batchStructureChanged"
    : reason === "MIXED_LENGTH_INPUT_MODES" ? "camProgram.batchMixedLengthModes"
    : reason === "STALE_LENGTH_INPUT_MODE" ? "camProgram.batchLengthModeChanged"
    : reason === "NO_TARGETS" ? "camProgram.batchNoTargets" : "camProgram.batchTargetsChanged";
}

function batchMessage() {
  const targets = [...selectedBatchTargets.values()];
  if (targets.length) {
    const checked = validateYarnLengthBatchSelection(GLOBAL_STATE.singleJerseyCamProgram, batchSelection(), GLOBAL_STATE.feedYarnStructureRevision);
    if (!checked.ok) return t(batchFailureKey(checked.reason), GLOBAL_STATE.language);
  }
  return batchFeedback || (targets.length ? "" : t("camProgram.batchNoTargets", GLOBAL_STATE.language));
}

function refreshBatchControls(form = document.querySelector(".cam-yarn-length-batch")) {
  if (!form) return;
  const count = selectedBatchTargets.size;
  form.querySelector(".cam-batch-target-count").textContent = t("camProgram.batchCount", GLOBAL_STATE.language, { count });
  form.querySelector(".cam-batch-feedback").textContent = batchMessage();
  form.querySelector('button[type="submit"]').disabled = count === 0;
  const feedCount = GLOBAL_STATE.singleJerseyCamProgram?.tracks[0]?.length;
  const candidates = feedCount ? candidateFeedIndices(feedCount) : [];
  form.closest("#single-jersey-cam-editor")?.querySelectorAll('input[name="selected-yarn"]').forEach(input => {
    const selected = selectedBatchTargets.get(assignmentKey(input.dataset.batchFeed, input.dataset.batchYarn));
    input.checked = batchStructureCurrent() && !!selected && String(selected.yarnId) === input.dataset.batchYarnId;
    input.disabled = !candidates.includes(Number(input.dataset.batchFeed));
  });
}

function selectBatchYarn(event, target) {
  const key = assignmentKey(target.feedIndex, target.yarnIndex);
  if (event.currentTarget.checked) {
    if (!batchStructureCurrent()) clearBatchSelection();
    if (!selectedBatchTargets.size) selectedStructureRevision = GLOBAL_STATE.feedYarnStructureRevision;
    selectedBatchTargets.set(key, { ...target });
  }
  else selectedBatchTargets.delete(key);
  if (!selectedBatchTargets.size) selectedStructureRevision = null;
  batchFeedback = "";
  refreshBatchControls();
}

function changeBatchScope(event) {
  batchFeedScope = event.currentTarget.value;
  clearBatchSelection();
  batchFeedback = "";
  refreshBatchControls(event.currentTarget.form);
}

function selectFeedFilter(event, feedIndex) {
  if (event.currentTarget.checked) selectedFeedFilters.add(feedIndex);
  else selectedFeedFilters.delete(feedIndex);
  if (batchFeedScope === "selected") {
    clearBatchSelection();
    batchFeedback = "";
    refreshBatchControls();
  }
}

function validateBatchDraft(event) {
  const input = event.currentTarget;
  const validation = validateYarnLengthInput(input.value);
  input.setCustomValidity(validation.ok ? "" : t("camProgram.batchInvalidValue", GLOBAL_STATE.language));
  batchFeedback = "";
  refreshBatchControls(input.form);
}

function applyBatchYarnLength(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const result = setSingleJerseyFeedYarnLengths(batchSelection(), form.elements.yarnLength.value);
  batchFeedback = result.ok ? t("camProgram.batchUpdated", GLOBAL_STATE.language, { count: result.updatedCount })
    : t(batchFailureKey(result.reason), GLOBAL_STATE.language);
  if (result.ok || result.reason !== "INVALID_YARN_LENGTH") clearBatchSelection();
  refreshBatchControls(form);
  return result;
}

function feedYarnLengthEditor(feed, feedIndex, language, feedbackRows) {
  const yarns = Array.isArray(feed?.yarns) && feed.yarns.length
    ? feed.yarns
    : [{ yarnId: 0, yarnLengthCmPer100Needles: 0 }];
  return html`<div class="cam-feed-yarn-lengths">
    ${yarns.map((yarn, yarnIndex) => {
      const row = feedbackRows.find(row => row.feedIndex === feedIndex && row.yarnIndex === yarnIndex);
      const input = row.lengthInput;
      const relaxed = input.lengthInputMode === "relaxedWithDraft";
      return html`<div class="cam-feed-yarn-slot">
      <label>
        <input type="checkbox" name="selected-yarn"
          data-batch-feed=${feedIndex} data-batch-yarn=${yarnIndex} data-batch-yarn-id=${yarn.yarnId}
          .checked=${live(batchStructureCurrent() && selectedBatchTargets.get(assignmentKey(feedIndex, yarnIndex))?.yarnId === yarn.yarnId)}
          ?disabled=${!candidateFeedIndices(GLOBAL_STATE.singleJerseyCamProgram.tracks[0].length).includes(feedIndex)}
          aria-label=${t("camProgram.batchSelectAssignment", language, { feed: feedIndex + 1, yarn: yarnIndex + 1,
            name: GLOBAL_STATE.yarnLibrary.find(asset => String(asset.id) === String(yarn.yarnId))?.name ?? String(yarn.yarnId) })}
          @change=${event => selectBatchYarn(event, { feedIndex, yarnIndex, yarnId: yarn.yarnId,
            lengthInputMode: input.lengthInputMode })} />
        <span>${t("camProgram.batchSelect", language)}</span>
      </label>
      <div class="cam-feed-yarn-assignment">
        <button type="button" class="cam-feed-yarn-name"
          title=${GLOBAL_STATE.yarnLibrary.find(asset => String(asset.id) === String(yarn.yarnId))?.name ?? ""}
          @click=${() => GLOBAL_STATE.pendingYarnId === null
            ? openYarnLibrary()
            : assignYarnToFeed(feedIndex, yarnIndex)}>
          ${t("camProgram.yarn", language, { number: yarnIndex + 1 })} ·
          ${GLOBAL_STATE.yarnLibrary.find(asset => String(asset.id) === String(yarn.yarnId))?.name ?? "—"}
        </button>
        <button type="button" class="btn cam-feed-yarn-remove" ?disabled=${yarns.length === 1}
          aria-label=${t("yarnLibrary.removeSlot", language, { number: yarnIndex + 1 })}
          @click=${() => removeFeedYarnSlot(feedIndex, yarnIndex)}>×</button>
      </div>
      <label class="cam-yarn-length-mode">
        <span>${t("camProgram.lengthInputMode", language)}</span>
        <select data-length-mode-feed=${feedIndex} data-length-mode-yarn=${yarnIndex}
          .value=${live(input.lengthInputMode)}
          @change=${event => setSingleJerseyFeedYarnLengthInputMode(feedIndex, yarnIndex, event.currentTarget.value)}>
          <option value="directTarget">${t("camProgram.lengthMode.directTarget", language)}</option>
          <option value="relaxedWithDraft">${t("camProgram.lengthMode.relaxedWithDraft", language)}</option>
        </select>
      </label>
      <label>
      <span>${t(relaxed ? "camProgram.relaxedLength" : "camProgram.directTargetLength", language)}</span>
      <input
        type="text"
        inputmode="decimal"
        data-feed-index=${feedIndex}
        data-yarn-index=${yarnIndex}
        data-length-field=${input.lengthInputMode}
        .value=${displayYarnLength(relaxed ? input.relaxedLengthCmPer100Needles : input.directTargetLengthCmPer100Needles)}
        @input=${validateYarnLengthDraft}
        @change=${commitYarnLength}
        @keydown=${finishYarnLengthOnEnter} />
      </label>
      <button type="button" class="btn cam-yarn-length-clear"
        aria-label=${t(relaxed ? "camProgram.clearRelaxedLengthForYarn" : "camProgram.clearYarnLengthForYarn",
          language, { feed: feedIndex + 1, yarn: yarnIndex + 1 })}
        @click=${event => clearYarnLength(event, feedIndex, yarnIndex, input.lengthInputMode)}>
        ${t(relaxed ? "camProgram.clearRelaxedLength" : "camProgram.clearYarnLength", language)}</button>
      ${relaxed ? html`
        <label>
          <span>${t("camProgram.draftRatio", language)}（${t("camProgram.draftRatioUnit", language)}）</span>
          <input type="text" inputmode="decimal" data-length-field="draftRatio"
            data-draft-feed-index=${feedIndex} data-draft-yarn-index=${yarnIndex}
            .value=${displayYarnLength(input.draftRatio)}
            @input=${validateYarnLengthDraft} @change=${commitYarnLength} @keydown=${finishYarnLengthOnEnter} />
        </label>
        <button type="button" class="btn cam-yarn-draft-clear"
          aria-label=${t("camProgram.clearDraftRatioForYarn", language, { feed: feedIndex + 1, yarn: yarnIndex + 1 })}
          @click=${event => clearYarnLength(event, feedIndex, yarnIndex, "draftRatio")}>
          ${t("camProgram.clearDraftRatio", language)}</button>
        <div class="cam-yarn-derived-length">
          <span>${t("camProgram.weavingReferenceLength", language)}</span>
          <output data-derived-feed=${feedIndex} data-derived-yarn=${yarnIndex}>
            ${input.status === "READY"
              ? `${input.relaxedLengthCmPer100Needles} × ${Number.isInteger(input.draftRatio) ? input.draftRatio.toFixed(1) : input.draftRatio} = ${input.effectiveTargetLengthCmPer100Needles}`
              : t("camProgram.lengthInputIncomplete", language)}
          </output>
        </div>` : ""}
      <small class="cam-yarn-solver-status" role="status">
        ${input.status === "INCOMPLETE" ? t("camProgram.lengthInputIncomplete", language)
          : input.status === "NOT_SET" ? t("yarnSolver.notSet", language)
          : row.result?.status ?? t("yarnSolver.noCurrentStatus", language)}
      </small>
      <small class="cam-yarn-length-feedback" role="status" aria-live="polite"></small>
    </div>`; })}
    <span class="cam-yarn-length-unit">
      ${t("camProgram.yarnLengthUnit", language)}
    </span>
    <button class="btn cam-feed-yarn-add" type="button"
      @click=${() => GLOBAL_STATE.pendingYarnId === null
        ? openYarnLibrary()
        : assignYarnToFeed(feedIndex, yarns.length)}>${t("yarnLibrary.addSlot", language)}</button>
  </div>`;
}

function batchYarnLengthEditor(language) {
  return html`<form
    class="cam-yarn-length-batch"
    novalidate
    ${ref(form => { if (form) refreshBatchControls(form); })}
    @submit=${applyBatchYarnLength}>
    <span>${t("camProgram.batchYarnLength", language)}</span>
    <input
      name="yarnLength"
      type="text"
      inputmode="decimal"
      placeholder="23.0"
      @input=${validateBatchDraft}
      aria-label=${t("camProgram.batchYarnLength", language)} />
    <span>${t("camProgram.yarnLengthUnit", language)}</span>
    <select name="scope" aria-label=${t("camProgram.batchFilter", language)}
      .value=${live(batchFeedScope)} @change=${changeBatchScope}>
      <option value="all">${t("camProgram.batchAll", language)}</option>
      <option value="odd">${t("camProgram.batchOdd", language)}</option>
      <option value="even">${t("camProgram.batchEven", language)}</option>
      <option value="selected">${t("camProgram.batchSelected", language)}</option>
    </select>
    <button type="submit" class="btn solid" ?disabled=${selectedBatchTargets.size === 0}>
      ${t("camProgram.batchApply", language)}
    </button>
    <span class="cam-batch-target-count" role="status" aria-live="polite"></span>
    <small class="cam-batch-feedback" role="status" aria-live="polite"></small>
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
  const feedbackRows = getYarnLengthFeedbackRows(GLOBAL_STATE);

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
                  .checked=${live(selectedFeedFilters.has(feed))}
                  @change=${event => selectFeedFilter(event, feed)}
                  aria-label=${t("camProgram.selectFeed", language, {
                    number: feed + 1,
                  })} />
                <span>${t("camProgram.feed", language, { number: feed + 1 })}</span>
              </label>
              ${feedYarnLengthEditor(camProgram.feeds?.[feed], feed, language, feedbackRows)}
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
    clearBatchSelection();
    selectedFeedFilters.clear();
    batchFeedScope = "all";
    batchFeedback = "";
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
      ${yarnAssignmentNotice()}
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
      ${batchYarnLengthEditor(language)}
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
    ${yarnAssignmentNotice()}
    ${camProgramGrid(camProgram, language)}
  </section>`;
}
