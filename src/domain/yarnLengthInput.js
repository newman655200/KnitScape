export const INVALID_YARN_LENGTH = "INVALID_YARN_LENGTH";

// Editing accepts finite positive values without a model-reachability limit.
// Legacy unset values are accepted only for storage normalization or Clear.
export function validateYarnLengthInput(input, { allowUnset = false } = {}) {
  if (input == null || (typeof input === "string" && input.trim() === "")) {
    return allowUnset ? { ok: true, value: 0, operation: "CLEAR" }
      : { ok: false, reason: INVALID_YARN_LENGTH };
  }
  if (typeof input !== "number" && typeof input !== "string") {
    return { ok: false, reason: INVALID_YARN_LENGTH };
  }
  const value = Number(input);
  if (!Number.isFinite(value) || value < 0 || (!allowUnset && value === 0)) {
    return { ok: false, reason: INVALID_YARN_LENGTH };
  }
  return { ok: true, value: value === 0 ? 0 : value, operation: value === 0 ? "CLEAR" : "SET" };
}

const LENGTH_INPUT_MODES = ["directTarget", "relaxedWithDraft"];
const has = (assignment, field) => Object.hasOwn(assignment ?? {}, field);

// Runtime consumers share this one derivation; invalid/incomplete input never
// falls back to the inactive direct target or an assumed draft ratio.
export function resolveYarnLengthInput(assignment) {
  const lengthInputMode = has(assignment, "lengthInputMode") ? assignment.lengthInputMode : "directTarget";
  const positive = value => {
    const validation = validateYarnLengthInput(value);
    return validation.ok ? validation.value : null;
  };
  const directValidation = validateYarnLengthInput(assignment?.yarnLengthCmPer100Needles, { allowUnset: true });
  const directTargetLengthCmPer100Needles = lengthInputMode === "directTarget" &&
    has(assignment, "yarnLengthCmPer100Needles") && directValidation.ok ? directValidation.value : null;
  const relaxedLengthCmPer100Needles = lengthInputMode === "relaxedWithDraft"
    ? positive(assignment?.relaxedLengthCmPer100Needles) : null;
  const draftRatio = lengthInputMode === "relaxedWithDraft" ? positive(assignment?.draftRatio) : null;
  const candidate = lengthInputMode === "directTarget" ? directTargetLengthCmPer100Needles
    : lengthInputMode === "relaxedWithDraft" && relaxedLengthCmPer100Needles !== null && draftRatio !== null
      ? relaxedLengthCmPer100Needles * draftRatio : null;
  const effectiveTargetLengthCmPer100Needles = Number.isFinite(candidate) && candidate > 0 ? candidate : null;
  return {
    lengthInputMode, directTargetLengthCmPer100Needles, relaxedLengthCmPer100Needles, draftRatio,
    effectiveTargetLengthCmPer100Needles,
    status: effectiveTargetLengthCmPer100Needles !== null ? "READY"
      : lengthInputMode === "directTarget" ? "NOT_SET" : "INCOMPLETE",
    inputSignature: JSON.stringify([lengthInputMode, directTargetLengthCmPer100Needles,
      relaxedLengthCmPer100Needles, draftRatio]),
  };
}

// The persisted contract has one active set of facts; derived lengths never
// belong here. Missing mode retains the original project's exact field shape.
export function normalizeYarnLengthFields(assignment) {
  const explicitMode = has(assignment, "lengthInputMode");
  const lengthInputMode = explicitMode ? assignment.lengthInputMode : "directTarget";
  if (!LENGTH_INPUT_MODES.includes(lengthInputMode)) {
    throw new TypeError("lengthInputMode must be directTarget or relaxedWithDraft.");
  }
  const normalized = explicitMode ? { lengthInputMode } : {};
  for (const field of ["relaxedLengthCmPer100Needles", "draftRatio"]) {
    if (!has(assignment, field)) continue;
    const validation = validateYarnLengthInput(assignment[field]);
    if (!validation.ok) throw new TypeError(`${field} must be a finite positive number.`);
    if (lengthInputMode === "relaxedWithDraft") normalized[field] = validation.value;
  }
  if (has(assignment, "yarnLengthCmPer100Needles") || !explicitMode) {
    const validation = validateYarnLengthInput(assignment?.yarnLengthCmPer100Needles, { allowUnset: true });
    if (assignment?.yarnLengthCmPer100Needles === undefined || !validation.ok) {
      throw new TypeError("yarnLengthCmPer100Needles must be a non-negative number.");
    }
    if (lengthInputMode === "directTarget") normalized.yarnLengthCmPer100Needles = validation.value;
  }
  if (lengthInputMode === "relaxedWithDraft" && has(normalized, "relaxedLengthCmPer100Needles") &&
    has(normalized, "draftRatio") && resolveYarnLengthInput(normalized).status !== "READY") {
    throw new TypeError("The effective yarn length must be a finite positive number.");
  }
  return normalized;
}
