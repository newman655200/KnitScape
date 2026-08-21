import { GLOBAL_STATE, dispatch } from "../state";
import {
  beginTexturePreviewInteraction,
  endTexturePreviewInteraction,
} from "../actions/texturePerformance";
import { colorSequencePosAtCoords } from "../utils";
import { claimYarnStroke, releaseYarnStroke } from "./yarnStrokeCoordinator";

export function colorSequencePointerInteraction(canvas) {
  let activePointerId = null;

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.isPrimary === false || activePointerId !== null) return;
    const stroke = {};
    if (!claimYarnStroke(stroke)) return;

    let position = colorSequencePosAtCoords(event, canvas);
    dispatch({
      yarnSequence: GLOBAL_STATE.yarnSequence.brush(position, GLOBAL_STATE.activeYarn),
      transforming: true,
    });
    event.preventDefault();
    beginTexturePreviewInteraction();

    activePointerId = event.pointerId;
    const strokePointerId = activePointerId;
    let ended = false;
    let captured = false;
    if (typeof canvas.setPointerCapture === "function") {
      try {
        canvas.setPointerCapture(strokePointerId);
        captured =
          typeof canvas.hasPointerCapture === "function"
            ? canvas.hasPointerCapture(strokePointerId)
            : true;
      } catch {
        captured = false;
      }
    }
    const fallbackTarget = globalThis.window;
    const eventTarget =
      captured || typeof fallbackTarget?.addEventListener !== "function"
        ? canvas
        : fallbackTarget;

    const move = (moveEvent) => {
      if (moveEvent.pointerId !== strokePointerId) return;
      const nextPosition = colorSequencePosAtCoords(moveEvent, canvas);
      if (nextPosition.x === position.x && nextPosition.y === position.y) return;
      dispatch({
        yarnSequence: GLOBAL_STATE.yarnSequence.line(
          position,
          nextPosition,
          GLOBAL_STATE.activeYarn
        ),
      });
      position = nextPosition;
    };

    const end = (endEvent) => {
      if (ended || endEvent.pointerId !== strokePointerId) return;
      ended = true;
      eventTarget.removeEventListener("pointermove", move);
      eventTarget.removeEventListener("pointerup", end);
      eventTarget.removeEventListener("pointercancel", end);
      if (captured) canvas.removeEventListener("lostpointercapture", end);
      else if (eventTarget === canvas) canvas.removeEventListener("pointerleave", end);
      activePointerId = null;
      if (releaseYarnStroke(stroke)) {
        dispatch({ transforming: false });
        endTexturePreviewInteraction();
      }
      if (canvas.hasPointerCapture?.(strokePointerId)) {
        canvas.releasePointerCapture(strokePointerId);
      }
    };

    eventTarget.addEventListener("pointermove", move);
    eventTarget.addEventListener("pointerup", end);
    eventTarget.addEventListener("pointercancel", end);
    if (captured) canvas.addEventListener("lostpointercapture", end);
    else if (eventTarget === canvas) canvas.addEventListener("pointerleave", end);
  });
}
