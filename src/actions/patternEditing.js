import { DEFAULT_STITCH_SYMBOL_INDEX } from "../constants.js";
import {
  buildNeedleBitmap,
  cloneBitmap,
  validateNeedleInputs,
} from "../needleArrangement/transform.js";
import { GLOBAL_STATE, dispatch } from "../state.js";
import { resizeYarnSequenceToNeedleHeight } from "./yarnSequenceRows.js";

const PATTERN_FIELDS = new Set(["camBitmap", "needleBitmap"]);

function patternBitmap(field) {
  if (!PATTERN_FIELDS.has(field)) {
    throw new Error(`Unknown pattern bitmap field: ${field}`);
  }
  return GLOBAL_STATE[field];
}

function normalizedDimension(value) {
  return Math.max(1, Math.min(500, Math.floor(Number(value) || 1)));
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

export function resizePatternBitmap(field, width, height) {
  const bitmap = patternBitmap(field);
  const resized = bitmap.resize(
    normalizedDimension(width),
    normalizedDimension(height),
    DEFAULT_STITCH_SYMBOL_INDEX
  );
  const action = { [field]: resized };

  if (field === "needleBitmap") {
    action.yarnSequence = needleYarnSequence(resized.height);
  }

  dispatch(action);
}

export function drawPatternLine(field, startPos, endPos) {
  const bitmap = patternBitmap(field);
  dispatch({
    [field]: bitmap.line(startPos, endPos, GLOBAL_STATE.activeSymbol),
    patternEdit: { field, startPos, endPos },
  });
}

export function startNeedleArrangement() {
  const needleBitmap = cloneBitmap(GLOBAL_STATE.camBitmap);
  dispatch({
    needleBitmap,
    yarnSequence: needleYarnSequence(needleBitmap.height),
  });
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
    GLOBAL_STATE.camBitmap.height
  );

  if (!validation.valid) {
    dispatch({ needleInputErrors: validation.errors });
    return false;
  }

  const needleBitmap = buildNeedleBitmap(
    GLOBAL_STATE.camBitmap,
    validation.sequence
  );
  dispatch({
    needleBitmap,
    appliedNeedleInputs: [...GLOBAL_STATE.needleInputs],
    needleInputErrors: validation.errors,
    yarnSequence: needleYarnSequence(needleBitmap.height),
  });
  return true;
}
