import { html } from "lit-html";
import { GLOBAL_STATE } from "../state.js";
import { t } from "../i18n/index.js";
import { NOT_SET } from "../simulation/yarnLengthSolver.js";
import { resolveYarnLengthInput } from "../domain/yarnLengthInput.js";

// Presentation joins current project facts to current results by assignment slot.
// Missing results never inherit the status of another Yarn on the same Feed.
export function getYarnLengthFeedbackRows(state) {
  return (state.singleJerseyCamProgram?.feeds ?? []).flatMap((feed, feedIndex) =>
    (feed.yarns ?? []).map((yarn, yarnIndex) => {
      const lengthInput = resolveYarnLengthInput(yarn);
      const target = lengthInput.effectiveTargetLengthCmPer100Needles;
      const result = target === null ? null : (state.yarnLengthSolverResults ?? []).find(candidate =>
        candidate.feedIndex === feedIndex && candidate.yarnIndex === yarnIndex &&
        candidate.targetLengthCmPer100Needles === target &&
        (candidate.lengthInput
          ? candidate.lengthInput.inputSignature === lengthInput.inputSignature
          : lengthInput.lengthInputMode === "directTarget"));
      return { feedIndex, yarnIndex, lengthInput, target, result: result ?? null };
    })
  );
}

function failureMessage(row, language) {
  if (row.lengthInput.status === "INCOMPLETE") return t("camProgram.lengthInputIncomplete", language);
  if (row.target === null) return t("yarnSolver.notSet", language);
  if (!row.result) return t("yarnSolver.noResult", language);
  if (row.result.appliedToSimulation) return "—";
  if (row.result.status === "ERROR") return t("yarnSolver.error", language,
    { message: row.result.errorMessage ?? "ERROR" });
  return t(`yarnSolver.reason.${row.result.failureReason ?? row.result.status}`, language);
}

const lengthText = length => Number.isFinite(length) ? length.toFixed(4) : "—";

export function yarnLengthSolverFeedback() {
  const language = GLOBAL_STATE.language;
  const rows = getYarnLengthFeedbackRows(GLOBAL_STATE);
  const validity = GLOBAL_STATE.previewValidity;
  return html`<section class="yarn-solver-feedback" aria-label=${t("yarnSolver.title", language)}
    @wheel=${event => event.stopPropagation()}>
    <div class="yarn-solver-summary" role="status" aria-live="polite" data-preview-validity=${validity}>
      <strong>${t("yarnSolver.title", language)} · ${validity}</strong>
      <div>${t(`yarnSolver.preview.${validity}`, language)}</div>
      <div>${t("yarnSolver.modelOnly", language)}</div>
    </div>
    ${rows.length ? html`<table>
      <caption>${t("camProgram.yarnLengthUnit", language)}</caption>
      <thead><tr>
        <th>Feed × Yarn</th><th>${t("camProgram.lengthInputMode", language)}</th>
        <th>${t("camProgram.relaxedLength", language)}</th><th>${t("camProgram.draftRatio", language)}</th>
        <th>${t("yarnSolver.target", language)}</th>
        <th>${t("yarnSolver.solved", language)}</th><th>${t("yarnSolver.status", language)}</th>
        <th>${t("yarnSolver.applied", language)}</th><th>${t("yarnSolver.reason", language)}</th>
      </tr></thead>
      <tbody>${rows.map(row => html`<tr data-solver-feed=${row.feedIndex} data-solver-yarn=${row.yarnIndex}>
        <td>Feed ${row.feedIndex + 1} · Yarn ${row.yarnIndex + 1}</td>
        <td class="solver-input-mode">${t(`camProgram.lengthMode.${row.lengthInput.lengthInputMode}`, language)}</td>
        <td class="solver-relaxed-length">${lengthText(row.lengthInput.relaxedLengthCmPer100Needles)}</td>
        <td class="solver-draft-ratio">${lengthText(row.lengthInput.draftRatio)}</td>
        <td class="solver-target">${lengthText(row.target)}</td>
        <td class="solver-length">${lengthText(row.result?.solvedLengthCmPer100Needles)}</td>
        <td class="solver-status">${row.lengthInput.status === "INCOMPLETE"
          ? t("camProgram.lengthInputIncomplete", language)
          : row.target === null ? NOT_SET : row.result?.status ?? t("yarnSolver.noCurrentStatus", language)}</td>
        <td class="solver-applied">${t(row.result?.appliedToSimulation ? "yarnSolver.yes" : "yarnSolver.no", language)}</td>
        <td class="solver-reason">${failureMessage(row, language)}
          ${row.result?.reachableRange ? html`<div class="solver-range">
            ${t("yarnSolver.range", language)}:
            ${lengthText(row.result.reachableRange.minLengthCmPer100Needles)}–${lengthText(row.result.reachableRange.maxLengthCmPer100Needles)}
          </div>` : ""}
        </td>
      </tr>`)}</tbody>
    </table>` : ""}
  </section>`;
}
