import { Bimp } from "../lib/Bimp.js";
import { buildChartFromRepeats } from "../lib/buildChartFromRepeats.js";

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

export function hasFourColumnNeedleSource(repeats) {
  return repeats?.[0]?.bitmap?.width === 4;
}

export function arrangeNeedleRepeatBitmap(sourceBitmap, arrangement) {
  if (
    sourceBitmap?.width !== 4 ||
    !/^[1-4]+$/.test(arrangement || "")
  ) {
    return null;
  }

  const outputWidth = arrangement.length;
  const pixels = Array.from(
    { length: outputWidth * sourceBitmap.height },
    (_, index) => {
      const outputX = index % outputWidth;
      const sourceX = Number(arrangement[outputX]) - 1;
      const y = Math.floor(index / outputWidth);
      return sourceBitmap.pixel(sourceX, y);
    }
  );

  return new Bimp(outputWidth, sourceBitmap.height, pixels);
}

export function applyNeedleArrangementOverlay(
  baseSimulation,
  repeats,
  arrangement,
  emptyColor
) {
  if (
    !baseSimulation ||
    !hasFourColumnNeedleSource(repeats) ||
    !/^[1-4]+$/.test(arrangement || "")
  ) {
    return baseSimulation;
  }

  const arrangedRepeatBitmap = arrangeNeedleRepeatBitmap(
    repeats[0].bitmap,
    arrangement
  );
  const arrangedRepeats = repeats.map((repeat, index) =>
    index === 0 ? { ...repeat, bitmap: arrangedRepeatBitmap } : repeat
  );

  return buildChartFromRepeats({
    repeats: arrangedRepeats,
    width: baseSimulation.width,
    height: baseSimulation.height,
    emptyColor,
  });
}
