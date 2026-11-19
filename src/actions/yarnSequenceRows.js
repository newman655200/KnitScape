import { Bimp } from "../lib/Bimp.js";

export function isValidYarnPaletteIndex(index, paletteLength) {
  return Number.isInteger(index) && index >= 0 && index < paletteLength;
}

export function assertValidYarnPaletteIndex(index, paletteLength) {
  if (!isValidYarnPaletteIndex(index, paletteLength)) {
    throw new RangeError(`Yarn sequence references invalid palette index ${String(index)} (palette length ${paletteLength}).`);
  }
}

export function assertValidYarnSequence(yarnSequence, paletteLength) {
  const pixels = Array.isArray(yarnSequence) || yarnSequence instanceof Uint8ClampedArray
    ? yarnSequence : yarnSequence?.pixels || [];
  for (const pixel of pixels) assertValidYarnPaletteIndex(pixel, paletteLength);
}

function normalizedYarnIndex(value) {
  const index = Math.floor(Number(value));
  return Number.isFinite(index) && index >= 0 ? index : 0;
}

function normalizedHeight(value, fallback = 1) {
  return Math.max(1, Math.floor(Number(value) || fallback));
}

export function normalizeYarnSequence(yarnSequence, options = {}) {
  const targetHeight = options.height
    ? normalizedHeight(options.height)
    : undefined;
  const fillColor = normalizedYarnIndex(options.fillYarn);

  if (Array.isArray(yarnSequence) || yarnSequence instanceof Uint8ClampedArray) {
    const pixels = Array.from(yarnSequence).map(normalizedYarnIndex);
    const height = targetHeight || Math.max(1, pixels.length);
    const normalizedPixels = [];

    for (let y = 0; y < height; y++) {
      normalizedPixels.push(pixels[y] ?? fillColor);
    }

    return new Bimp(1, height, normalizedPixels);
  }

  const sourceWidth = Math.max(1, Math.floor(Number(yarnSequence?.width) || 1));
  const sourceHeight = Math.max(1, Math.floor(Number(yarnSequence?.height) || 1));
  const height = targetHeight || sourceHeight;
  const sourcePixels = Array.from(yarnSequence?.pixels || []);
  const pixels = [];

  for (let y = 0; y < height; y++) {
    const sourceValue =
      y < sourceHeight ? sourcePixels[y * sourceWidth] : fillColor;
    pixels.push(normalizedYarnIndex(sourceValue ?? fillColor));
  }

  return new Bimp(1, height, pixels.length ? pixels : [fillColor]);
}

export function yarnIndexForSequenceRow(yarnSequence, row) {
  const sequence = normalizeYarnSequence(yarnSequence);
  const height = Math.max(1, sequence.height);
  const sequenceRow = ((Math.floor(Number(row) || 0) % height) + height) % height;
  return normalizedYarnIndex(sequence.pixel(0, sequenceRow));
}

export function resizeYarnSequenceToChartHeight(
  yarnSequence,
  chartHeight,
  activeYarn,
  paletteLength
) {
  assertValidYarnPaletteIndex(activeYarn, paletteLength);
  assertValidYarnSequence(yarnSequence, paletteLength);
  const nextHeight = normalizedHeight(chartHeight);
  const normalizedSequence = normalizeYarnSequence(yarnSequence, {
    height: Math.min(nextHeight, normalizedHeight(yarnSequence?.height)),
  });
  const width = 1;
  const previousPixels = Array.from(normalizedSequence.pixels);
  const previousHeight = normalizedSequence.height;
  const fillColor = activeYarn;
  const pixels = [];

  for (let y = 0; y < nextHeight; y++) {
    if (y < previousHeight) {
      pixels.push(previousPixels[y] ?? 0);
    } else {
      pixels.push(fillColor);
    }
  }

  return new Bimp(width, nextHeight, pixels);
}

export function resizeYarnSequenceRows(yarnSequence, requestedHeight, activeYarn, paletteLength) {
  return resizeYarnSequenceToChartHeight(
    yarnSequence,
    requestedHeight,
    activeYarn,
    paletteLength
  );
}
