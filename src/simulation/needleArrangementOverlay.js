export function normalizeNeedleArrangementInput(value) {
  return String(value ?? "").replace(/[^\d,\s]/g, "");
}

export function parseNeedleArrangement(value) {
  const normalizedValue = normalizeNeedleArrangementInput(value).trim();
  if (!normalizedValue) return [];

  if (!/[,\s]/.test(normalizedValue)) {
    return Array.from(normalizedValue, Number);
  }

  if (!/^\d+(?:[,\s]+\d+)*[,\s]*$/.test(normalizedValue)) return [];

  return normalizedValue
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number);
}

export function parseNeedleArrangementInputs(inputs) {
  const arrangement = [];

  for (const input of Array.from(inputs || []).slice(0, 4)) {
    const normalizedInput = normalizeNeedleArrangementInput(input);
    if (!normalizedInput.trim()) continue;

    const parsedInput = parseNeedleArrangement(normalizedInput);
    if (parsedInput.length === 0) return [];
    arrangement.push(...parsedInput);
  }

  return arrangement;
}

export function formatNeedleArrangement(arrangement) {
  if (!Array.isArray(arrangement) || arrangement.length === 0) return "";
  return arrangement.every(
    (needleType) => Number.isInteger(needleType) && needleType <= 9
  )
    ? arrangement.join("")
    : arrangement.join(",");
}

export function combineNeedleArrangementInputs(inputs) {
  return formatNeedleArrangement(parseNeedleArrangementInputs(inputs));
}
