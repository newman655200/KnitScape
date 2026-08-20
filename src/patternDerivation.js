import { Bimp } from "./lib/Bimp.js";

export const DEFAULT_CANVAS_WIDTH = 60;
export const DEFAULT_CANVAS_HEIGHT = 60;
export const DEFAULT_UNIT_WIDTH = 8;
export const DEFAULT_UNIT_HEIGHT = 4;

export function tileUnitToCanvas(width, height, unit) {
  return Bimp.fromTile(width, height, unit.vFlip()).vFlip();
}

export function derivePatternBitmaps(state) {
  return {
    camBitmap: tileUnitToCanvas(
      state.canvasWidth,
      state.canvasHeight,
      state.camUnitBitmap
    ),
    needleBitmap: tileUnitToCanvas(
      state.canvasWidth,
      state.canvasHeight,
      state.needleUnitBitmap
    ),
  };
}

export function withDerivedPatternBitmaps(state) {
  return { ...state, ...derivePatternBitmaps(state) };
}
