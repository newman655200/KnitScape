export function normalizeNeedleArrangementInput(value) {
  const validDigits = String(value ?? "").replace(/[^1-4]/g, "");
  if (!validDigits) return "";

  const needleType = validDigits[0];
  return Array.from(validDigits)
    .filter((digit) => digit === needleType)
    .join("");
}

export function combineNeedleArrangementInputs(inputs) {
  return Array.from(inputs || [])
    .slice(0, 4)
    .map(normalizeNeedleArrangementInput)
    .join("");
}

export function isValidNeedleArrangement(value) {
  return /^[1-4]+$/.test(String(value ?? ""));
}

export function parseNeedleArrangement(value) {
  if (!isValidNeedleArrangement(value)) return [];
  return Array.from(String(value), Number);
}

export function getNeedleTypeAtPosition(arrangement, position) {
  if (
    !Array.isArray(arrangement) ||
    arrangement.length === 0 ||
    !Number.isInteger(position) ||
    position < 0
  ) {
    return null;
  }

  return arrangement[position % arrangement.length];
}
