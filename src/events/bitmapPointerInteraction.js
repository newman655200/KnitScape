import { drawPatternLine } from "../actions/patternEditing.js";
import { GLOBAL_STATE, dispatch } from "../state.js";

export function positionInEditableUnit(
  canvas,
  event,
  unit,
  scale,
  dpr = globalThis.devicePixelRatio
) {
  const bounds = canvas.getBoundingClientRect();
  const ratio = Number.isFinite(Number(dpr)) && Number(dpr) > 0 ? Number(dpr) : 1;
  const cellSize = Number(scale) / ratio;
  if (!Number.isFinite(cellSize) || cellSize <= 0) return null;

  const displayX = Math.floor((event.clientX - bounds.left) / cellSize);
  const displayY = Math.floor((event.clientY - bounds.top) / cellSize);

  if (
    displayX < 0 ||
    displayY < 0 ||
    displayX >= unit.width ||
    displayY >= unit.height
  ) {
    return null;
  }

  return {
    x: displayX,
    y: unit.height - displayY - 1,
  };
}

export function bitmapPointerInteraction(canvas) {
  canvas.addEventListener("pointerdown", (event) => {
    if (GLOBAL_STATE.activeTool !== "brush") return;
    if (event.button !== 0) return;

    const field = canvas.dataset.unitField;
    const unit = GLOBAL_STATE[field];
    let position = positionInEditableUnit(
      canvas,
      event,
      unit,
      GLOBAL_STATE.scale
    );
    if (position === null) return;
    if (!drawPatternLine(field, position, position)) return;

    event.preventDefault();
    dispatch({ transforming: true });
    const activePointerId = event.pointerId;
    canvas.setPointerCapture(activePointerId);
    let ended = false;

    const move = (moveEvent) => {
      if (moveEvent.pointerId !== activePointerId) return;

      const nextPosition = positionInEditableUnit(
        canvas,
        moveEvent,
        GLOBAL_STATE[field],
        GLOBAL_STATE.scale
      );
      if (nextPosition === null) {
        position = null;
        return;
      }
      if (position === null) {
        drawPatternLine(field, nextPosition, nextPosition);
        position = nextPosition;
        return;
      }
      if (nextPosition.x === position.x && nextPosition.y === position.y) return;
      drawPatternLine(field, position, nextPosition);
      position = nextPosition;
    };

    const end = (endEvent) => {
      if (endEvent.pointerId !== activePointerId || ended) return;

      ended = true;
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", end);
      canvas.removeEventListener("pointercancel", end);
      canvas.removeEventListener("lostpointercapture", end);
      dispatch({ transforming: false });
      if (canvas.hasPointerCapture(activePointerId)) {
        canvas.releasePointerCapture(activePointerId);
      }
    };

    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("lostpointercapture", end);
  });
}
