import { GLOBAL_STATE, dispatch } from "../state";
import {
  beginTexturePreviewInteraction,
  endTexturePreviewInteraction,
} from "../actions/texturePerformance";
import { colorSequencePosAtCoords } from "../utils";

export function colorSequencePointerInteraction(canvas) {
  let activePointerId = null;

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.isPrimary === false || activePointerId !== null) return;

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
    canvas.setPointerCapture?.(strokePointerId);

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
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", end);
      canvas.removeEventListener("pointercancel", end);
      canvas.removeEventListener("lostpointercapture", end);
      activePointerId = null;
      dispatch({ transforming: false });
      endTexturePreviewInteraction();
      if (canvas.hasPointerCapture?.(strokePointerId)) {
        canvas.releasePointerCapture(strokePointerId);
      }
    };

    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("lostpointercapture", end);
  });
}
