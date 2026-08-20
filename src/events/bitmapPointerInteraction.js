import { drawPatternLine } from "../actions/patternEditing.js";
import { GLOBAL_STATE, dispatch } from "../state.js";

const SOURCE_FIELDS = {
  camBitmap: "camUnitBitmap",
  needleBitmap: "needleUnitBitmap",
};

function positionAtPointer(canvas, event, bitmap) {
  const bounds = canvas.getBoundingClientRect();
  const displayX = Math.floor(
    ((event.clientX - bounds.left) / bounds.width) * bitmap.width
  );
  const displayY = Math.floor(
    ((event.clientY - bounds.top) / bounds.height) * bitmap.height
  );

  return {
    x: Math.max(0, Math.min(bitmap.width - 1, displayX)),
    y: Math.max(0, Math.min(bitmap.height - 1, bitmap.height - displayY - 1)),
  };
}

export function bitmapPointerInteraction(canvas) {
  canvas.addEventListener("pointerdown", (event) => {
    if (GLOBAL_STATE.activeTool !== "brush") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    const displayField = canvas.dataset.patternField;
    const field = SOURCE_FIELDS[displayField] || displayField;
    const bitmap = GLOBAL_STATE[displayField];
    let position = positionAtPointer(canvas, event, bitmap);
    if (!drawPatternLine(field, position, position)) return;
    dispatch({ transforming: true });
    canvas.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      const nextPosition = positionAtPointer(
        canvas,
        moveEvent,
        GLOBAL_STATE[displayField]
      );
      if (nextPosition.x === position.x && nextPosition.y === position.y) return;
      drawPatternLine(field, position, nextPosition);
      position = nextPosition;
    };

    const end = (endEvent) => {
      dispatch({ transforming: false });
      if (canvas.hasPointerCapture(endEvent.pointerId)) {
        canvas.releasePointerCapture(endEvent.pointerId);
      }
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", end);
      canvas.removeEventListener("pointercancel", end);
    };

    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
  });
}
