import {
  buildNeedleBitmap,
  cloneBitmap,
  validateNeedleInputs,
} from "../needleArrangement/transform.js";
import { GLOBAL_STATE, dispatch } from "../state.js";
import { resizeYarnSequenceToNeedleHeight } from "./yarnSequenceRows.js";

const PATTERN_FIELDS = new Set(["camUnitBitmap", "needleUnitBitmap"]);

function patternBitmap(field) {
  if (!PATTERN_FIELDS.has(field)) {
    throw new Error(`Unknown pattern bitmap field: ${field}`);
  }
  return GLOBAL_STATE[field];
}

export function normalizeCanvasDimension(value) {
  const dimension = Math.floor(Number(value));
  return Math.max(5, Math.min(500, Number.isFinite(dimension) ? dimension : 5));
}

function needleYarnSequence(height) {
  return resizeYarnSequenceToNeedleHeight(
    GLOBAL_STATE.yarnSequence,
    height,
    GLOBAL_STATE.activeYarn
  );
}

export function selectPatternSymbol(symbolIndex) {
  dispatch({
    activeSymbol: symbolIndex,
    activeTool: "brush",
  });
}

export function resizePatternCanvas(width, height) {
  const canvasWidth = normalizeCanvasDimension(width);
  const canvasHeight = normalizeCanvasDimension(height);
  dispatch({
    canvasWidth,
    canvasHeight,
    yarnSequence: needleYarnSequence(canvasHeight),
  });
}

function pointIsWithinBitmap(point, bitmap) {
  return (
    Number.isInteger(point?.x) &&
    Number.isInteger(point?.y) &&
    point.x >= 0 &&
    point.x < bitmap.width &&
    point.y >= 0 &&
    point.y < bitmap.height
  );
}

export function drawPatternLine(field, startPos, endPos) {
  const bitmap = patternBitmap(field);
  if (!pointIsWithinBitmap(startPos, bitmap) || !pointIsWithinBitmap(endPos, bitmap)) {
    return false;
  }

  dispatch({
    [field]: bitmap.line(startPos, endPos, GLOBAL_STATE.activeSymbol),
    patternEdit: {
      field,
      startPos: { ...startPos },
      endPos: { ...endPos },
    },
  });
  return true;
}

export function startNeedleArrangement() {
  dispatch({ needleUnitBitmap: cloneBitmap(GLOBAL_STATE.camUnitBitmap) });
}

export function updateNeedleInput(index, value) {
  if (!Number.isInteger(index) || index < 0 || index > 3) return;

  const needleInputs = [...GLOBAL_STATE.needleInputs];
  const needleInputErrors = [...GLOBAL_STATE.needleInputErrors];
  needleInputs[index] = String(value ?? "");
  needleInputErrors[index] = null;
  dispatch({ needleInputs, needleInputErrors });
}

export function applyNeedleArrangement() {
  const validation = validateNeedleInputs(
    GLOBAL_STATE.needleInputs,
    GLOBAL_STATE.camUnitBitmap.height
  );

  if (!validation.valid) {
    dispatch({ needleInputErrors: validation.errors });
    return false;
  }

  const needleUnitBitmap = buildNeedleBitmap(
    GLOBAL_STATE.camUnitBitmap,
    validation.sequence
  );
  dispatch({
    needleUnitBitmap,
    appliedNeedleInputs: [...GLOBAL_STATE.needleInputs],
    needleInputErrors: validation.errors,
  });
  return true;
}
