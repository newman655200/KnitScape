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
