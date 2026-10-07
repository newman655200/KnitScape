import { CONVERGED } from "./yarnLengthSolver.js";

export const PREVIEW_VALIDITY = Object.freeze({
  DESIGN_PREVIEW: "DESIGN_PREVIEW",
  VALIDATED: "VALIDATED",
  PARTIAL: "PARTIAL",
  INVALID: "INVALID",
});

// requiredTargets contains only Feed × Yarn assignments used by this simulation.
// The association currently uses feedIndex + yarnIndex, independently of Yarn IDs.
export function derivePreviewValidity(requiredTargets, solverResults) {
  if (!requiredTargets.length) return PREVIEW_VALIDITY.DESIGN_PREVIEW;
  const convergedCount = requiredTargets.filter(target => solverResults.some(result =>
    result.feedIndex === target.feedIndex && result.yarnIndex === target.yarnIndex &&
    result.targetLengthCmPer100Needles === target.targetLengthCmPer100Needles &&
    result.status === CONVERGED && result.converged && result.appliedToSimulation &&
    Number.isFinite(result.solvedLengthCmPer100Needles) &&
    Number.isFinite(result.errorCmPer100Needles) && result.errorCmPer100Needles >= 0 &&
    Number.isFinite(result.toleranceCmPer100Needles) && result.toleranceCmPer100Needles > 0 &&
    result.errorCmPer100Needles <= result.toleranceCmPer100Needles &&
    Math.abs(result.solvedLengthCmPer100Needles - target.targetLengthCmPer100Needles) <= result.toleranceCmPer100Needles
  )).length;
  if (convergedCount === requiredTargets.length) return PREVIEW_VALIDITY.VALIDATED;
  return convergedCount ? PREVIEW_VALIDITY.PARTIAL : PREVIEW_VALIDITY.INVALID;
}
