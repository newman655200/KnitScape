import { GLOBAL_STATE, dispatch } from "../state";
import {
  beginTexturePreviewInteraction,
  endTexturePreviewInteraction,
} from "../actions/texturePerformance";
import { colorSequencePosAtCoords } from "../utils";

function touchWithId(event, identifier) {
  return [...(event.touches || [])].find((touch) => touch.identifier === identifier);
}

function changedTouchWithId(event, identifier) {
  return [...(event.changedTouches || [])].find(
    (touch) => touch.identifier === identifier
  );
}

export function colorSequenceTouchInteraction(canvas) {
  let activeTouchId = null;

  canvas.addEventListener("touchstart", (event) => {
    if (activeTouchId !== null) return;
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    if (!touch) return;

    let position = colorSequencePosAtCoords(touch, canvas);
    dispatch({
      yarnSequence: GLOBAL_STATE.yarnSequence.brush(position, GLOBAL_STATE.activeYarn),
      transforming: true,
    });
    event.preventDefault();
    beginTexturePreviewInteraction();

    activeTouchId = touch.identifier;
    const strokeTouchId = activeTouchId;
    let ended = false;

    const move = (moveEvent) => {
      const nextTouch = touchWithId(moveEvent, strokeTouchId);
      if (!nextTouch) return;
      const nextPosition = colorSequencePosAtCoords(nextTouch, canvas);
      if (nextPosition.x === position.x && nextPosition.y === position.y) return;
      dispatch({
        yarnSequence: GLOBAL_STATE.yarnSequence.line(
          position,
          nextPosition,
          GLOBAL_STATE.activeYarn
        ),
      });
      position = nextPosition;
      moveEvent.preventDefault();
    };

    const end = (endEvent) => {
      if (ended || !changedTouchWithId(endEvent, strokeTouchId)) return;
      ended = true;
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchcancel", end);
      canvas.removeEventListener("touchend", end);
      activeTouchId = null;
      dispatch({ transforming: false });
      endTexturePreviewInteraction();
    };

    canvas.addEventListener("touchmove", move);
    canvas.addEventListener("touchcancel", end);
    canvas.addEventListener("touchend", end);
  });
}
