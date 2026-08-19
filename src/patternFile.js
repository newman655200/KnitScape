import { Bimp } from "./lib/Bimp.js";
import { cloneBitmap } from "./needleArrangement/transform.js";

export const PATTERN_SCHEMA_VERSION = 2;
export const DEFAULT_NEEDLE_INPUTS = Object.freeze(["1", "2", "3", "4"]);
const LEGACY_DEFAULT_STITCH_SYMBOL_INDEX = 1;

function positiveInteger(value, label) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return normalized;
}

function bitmapFromJSON(value, label) {
  if (!value || typeof value !== "object") {
    throw new Error(`${label} must be a bitmap object.`);
  }

  const width = positiveInteger(value.width, `${label}.width`);
  const height = positiveInteger(value.height, `${label}.height`);
  if (!Array.isArray(value.pixels) || value.pixels.length !== width * height) {
    throw new Error(`${label}.pixels must contain width × height values.`);
  }

  return new Bimp(width, height, value.pixels);
}

function normalizeInputs(value, label, fallback = DEFAULT_NEEDLE_INPUTS) {
  const inputs = value === undefined ? fallback : value;
  if (!Array.isArray(inputs) || inputs.length !== 4) {
    throw new Error(`${label} must contain four input strings.`);
  }
  return inputs.map((input) => String(input ?? ""));
}

export function expandLegacyRepeats(pattern) {
  const width = positiveInteger(pattern.width, "width");
  const height = positiveInteger(pattern.height, "height");
  if (!Array.isArray(pattern.repeats) || pattern.repeats.length === 0) {
    throw new Error("Legacy pattern must contain at least one repeat.");
  }

  let bitmap = Bimp.empty(
    width,
    height,
    LEGACY_DEFAULT_STITCH_SYMBOL_INDEX
  );

  pattern.repeats.forEach((repeat, index) => {
    const repeatBitmap = bitmapFromJSON(
      repeat?.bitmap,
      `repeats[${index}].bitmap`
    );
    if (!Array.isArray(repeat.area) || repeat.area.length !== 2) {
      throw new Error(`repeats[${index}].area must contain width and height.`);
    }
    if (!Array.isArray(repeat.pos) || repeat.pos.length !== 2) {
      throw new Error(`repeats[${index}].pos must contain x and y.`);
    }

    const areaWidth = positiveInteger(repeat.area[0], `repeats[${index}].area[0]`);
    const areaHeight = positiveInteger(repeat.area[1], `repeats[${index}].area[1]`);
    const pos = repeat.pos.map((coordinate, axis) => {
      const normalized = Number(coordinate);
      if (!Number.isInteger(normalized)) {
        throw new Error(`repeats[${index}].pos[${axis}] must be an integer.`);
      }
      return normalized;
    });

    const tiled = Bimp.fromTile(
      areaWidth,
      areaHeight,
      repeatBitmap.vFlip()
    ).vFlip();
    bitmap = bitmap.overlay(tiled, pos);
  });

  return bitmap;
}

export function deserializePattern(pattern) {
  if (!pattern || typeof pattern !== "object") {
    throw new Error("Pattern file must contain an object.");
  }

  if (
    pattern.schemaVersion !== undefined &&
    pattern.schemaVersion !== PATTERN_SCHEMA_VERSION
  ) {
    throw new Error(`Unsupported pattern schema version ${pattern.schemaVersion}.`);
  }

  let camBitmap;
  let needleBitmap;

  if (pattern.schemaVersion === PATTERN_SCHEMA_VERSION) {
    camBitmap = bitmapFromJSON(pattern.camBitmap, "camBitmap");
    needleBitmap = bitmapFromJSON(pattern.needleBitmap, "needleBitmap");
  } else {
    camBitmap = expandLegacyRepeats(pattern);
    needleBitmap = cloneBitmap(camBitmap);
  }

  const needleInputs = normalizeInputs(pattern.needleInputs, "needleInputs");
  const appliedNeedleInputs = normalizeInputs(
    pattern.appliedNeedleInputs,
    "appliedNeedleInputs",
    needleInputs
  );

  return {
    schemaVersion: PATTERN_SCHEMA_VERSION,
    camBitmap,
    needleBitmap,
    needleInputs,
    appliedNeedleInputs,
    yarnPalette: pattern.yarnPalette,
    yarnSequence: pattern.yarnSequence,
    yarnPlies: pattern.yarnPlies,
  };
}

export function serializePattern(state) {
  return {
    schemaVersion: PATTERN_SCHEMA_VERSION,
    camBitmap: state.camBitmap.toJSON(),
    needleBitmap: state.needleBitmap.toJSON(),
    needleInputs: [...state.needleInputs],
    appliedNeedleInputs: [...state.appliedNeedleInputs],
    yarnPalette: state.yarnPalette,
    yarnSequence: state.yarnSequence.toJSON(),
    yarnPlies: state.yarnPlies,
  };
}
