import { Bimp } from "./lib/Bimp.js";

export const DEFAULT_CANVAS_WIDTH = 60;
export const DEFAULT_CANVAS_HEIGHT = 60;
export const DEFAULT_UNIT_WIDTH = 8;
export const DEFAULT_UNIT_HEIGHT = 4;

export function tileUnitToCanvas(width, height, unit) {
  const rows = Array.from({ length: unit.height }, (_, unitY) => {
    const row = new Uint8ClampedArray(width);
    for (let x = 0; x < width; x++) {
      row[x] = unit.pixels[unitY * unit.width + (x % unit.width)];
    }
    return row;
  });
  const pixels = new Uint8ClampedArray(width * height);
  const yOffset = (unit.height - (height % unit.height)) % unit.height;
  for (let y = 0; y < height; y++) {
    pixels.set(rows[(y + yOffset) % unit.height], y * width);
  }
  return new Bimp(width, height, pixels);
}

const ALL_DERIVED_FIELDS = ["camBitmap", "needleBitmap"];

export function derivePatternBitmaps(state, fields = ALL_DERIVED_FIELDS) {
  const bitmaps = {};
  if (fields.includes("camBitmap")) {
    bitmaps.camBitmap = tileUnitToCanvas(
      state.canvasWidth,
      state.canvasHeight,
      state.camUnitBitmap
    );
  }
  if (fields.includes("needleBitmap")) {
    bitmaps.needleBitmap = tileUnitToCanvas(
      state.canvasWidth,
      state.canvasHeight,
      state.needleUnitBitmap
    );
  }
  return bitmaps;
}

export function withDerivedPatternBitmaps(state, fields) {
  return { ...state, ...derivePatternBitmaps(state, fields) };
}
