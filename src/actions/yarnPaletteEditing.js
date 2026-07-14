import { Bimp } from "../lib/Bimp.js";

function normalizedPaletteIndex(index, paletteLength) {
  const number = Math.floor(Number(index));
  if (!Number.isFinite(number)) return 0;
  return Math.min(Math.max(number, 0), Math.max(0, paletteLength - 1));
}

function paletteIndexIsUsed(yarnSequence, index) {
  return Array.from(yarnSequence?.pixels || []).some((pixel) => pixel === index);
}

function preservedColorIndex(yarnPalette, editedIndex, previousColor) {
  const existingIndex = yarnPalette.findIndex(
    (color, index) => index !== editedIndex && color === previousColor
  );

  if (existingIndex >= 0) return existingIndex;
  return yarnPalette.length;
}

export function updateYarnPaletteColor({
  yarnPalette,
  yarnSequence,
  index,
  color,
}) {
  const sourcePalette = Array.isArray(yarnPalette) ? yarnPalette : [];
  const editedIndex = normalizedPaletteIndex(index, sourcePalette.length || 1);
  const previousColor = sourcePalette[editedIndex];
  const nextPalette = [...sourcePalette];
  nextPalette[editedIndex] = color;

  if (!yarnSequence || !paletteIndexIsUsed(yarnSequence, editedIndex)) {
    return {
      yarnPalette: nextPalette,
      yarnSequence,
      activeYarn: editedIndex,
    };
  }

  const legacyIndex = preservedColorIndex(
    nextPalette,
    editedIndex,
    previousColor
  );

  if (legacyIndex === nextPalette.length) {
    nextPalette.push(previousColor);
  }

  const nextPixels = Array.from(yarnSequence.pixels).map((pixel) =>
    pixel === editedIndex ? legacyIndex : pixel
  );

  return {
    yarnPalette: nextPalette,
    yarnSequence: new Bimp(yarnSequence.width, yarnSequence.height, nextPixels),
    activeYarn: editedIndex,
  };
}
