import { Bimp } from "../lib/Bimp.js";

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

export function applyNeedleArrangementOverlay(baseSimulation, arrangement) {
  if (!baseSimulation || !/^[1-4]+$/.test(arrangement || "")) {
    return baseSimulation;
  }

  const pixels = Array.from(
    { length: baseSimulation.width * baseSimulation.height },
    (_, index) => {
      const needleIndex = index % baseSimulation.width;
      return Number(arrangement[needleIndex % arrangement.length]) - 1;
    }
  );

  return new Bimp(baseSimulation.width, baseSimulation.height, pixels);
}
