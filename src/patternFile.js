import { Bimp } from "./lib/Bimp.js";
import { cloneBitmap } from "./needleArrangement/transform.js";
import { withDerivedPatternBitmaps } from "./patternDerivation.js";

export const PATTERN_SCHEMA_VERSION = 3;
export const DEFAULT_NEEDLE_INPUTS = Object.freeze(["1", "2", "3", "4"]);
const MIN_CANVAS_DIMENSION = 5;
const MAX_CANVAS_DIMENSION = 500;

function positiveInteger(value, label) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
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

function canvasDimension(value, label) {
  const normalized = positiveInteger(value, label);
  if (
    normalized < MIN_CANVAS_DIMENSION ||
    normalized > MAX_CANVAS_DIMENSION
  ) {
    throw new Error(
      `${label} must be between ${MIN_CANVAS_DIMENSION} and ${MAX_CANVAS_DIMENSION}.`
    );
  }
  return normalized;
}

function normalizeMigratedInputs(value, label, fallback = DEFAULT_NEEDLE_INPUTS) {
  const inputs = value === undefined ? fallback : value;
  if (!Array.isArray(inputs) || inputs.length !== 4) {
    throw new Error(`${label} must contain four input strings.`);
  }
  return inputs.map((input) => String(input ?? ""));
}

function normalizeV3Inputs(value, label) {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    value.some((input) => typeof input !== "string")
  ) {
    throw new Error(`${label} must contain four input strings.`);
  }
  return [...value];
}

function deserializedPattern(pattern, source, normalizeInputs) {
  const needleInputs = normalizeInputs(pattern.needleInputs, "needleInputs");
  const appliedNeedleInputs = normalizeInputs(
    pattern.appliedNeedleInputs,
    "appliedNeedleInputs",
    needleInputs
  );

  return withDerivedPatternBitmaps({
    schemaVersion: PATTERN_SCHEMA_VERSION,
    ...source,
    needleInputs,
    appliedNeedleInputs,
    yarnPalette: pattern.yarnPalette,
    yarnSequence: pattern.yarnSequence,
    yarnPlies: pattern.yarnPlies,
  });
}

function deserializeV3(pattern) {
  return deserializedPattern(
    pattern,
    {
      canvasWidth: canvasDimension(pattern.canvasWidth, "canvasWidth"),
      canvasHeight: canvasDimension(pattern.canvasHeight, "canvasHeight"),
      camUnitBitmap: bitmapFromJSON(pattern.camUnitBitmap, "camUnitBitmap"),
      needleUnitBitmap: bitmapFromJSON(
        pattern.needleUnitBitmap,
        "needleUnitBitmap"
      ),
    },
    normalizeV3Inputs
  );
}

function migrateV2(pattern) {
  return deserializedPattern(
    pattern,
    {
      canvasWidth: 60,
      canvasHeight: 60,
      camUnitBitmap: bitmapFromJSON(pattern.camBitmap, "camBitmap"),
      needleUnitBitmap: bitmapFromJSON(pattern.needleBitmap, "needleBitmap"),
    },
    normalizeMigratedInputs
  );
}

function migrateLegacyRepeats(pattern) {
  if (pattern.repeats.length === 0) {
    throw new Error("Legacy pattern must contain at least one repeat.");
  }

  const camUnitBitmap = bitmapFromJSON(
    pattern.repeats[0]?.bitmap,
    "repeats[0].bitmap"
  );

  return deserializedPattern(
    pattern,
    {
      canvasWidth: canvasDimension(pattern.width, "width"),
      canvasHeight: canvasDimension(pattern.height, "height"),
      camUnitBitmap,
      needleUnitBitmap: cloneBitmap(camUnitBitmap),
    },
    normalizeMigratedInputs
  );
}

export function deserializePattern(pattern) {
  if (!pattern || typeof pattern !== "object") {
    throw new Error("Pattern file must contain an object.");
  }

  if (pattern.schemaVersion === 3) return deserializeV3(pattern);
  if (pattern.schemaVersion === 2) return migrateV2(pattern);
  if (pattern.schemaVersion === undefined && Array.isArray(pattern.repeats)) {
    return migrateLegacyRepeats(pattern);
  }
  throw new Error(`Unsupported pattern schema version ${pattern.schemaVersion}.`);
}

export function serializePattern(state) {
  return {
    schemaVersion: PATTERN_SCHEMA_VERSION,
    canvasWidth: state.canvasWidth,
    canvasHeight: state.canvasHeight,
    camUnitBitmap: state.camUnitBitmap.toJSON(),
    needleUnitBitmap: state.needleUnitBitmap.toJSON(),
    needleInputs: [...state.needleInputs],
    appliedNeedleInputs: [...state.appliedNeedleInputs],
    yarnPalette: state.yarnPalette,
    yarnSequence: state.yarnSequence.toJSON(),
    yarnPlies: state.yarnPlies,
  };
}
