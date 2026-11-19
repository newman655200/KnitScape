import { GLOBAL_STATE, dispatch } from "../state";
import {
  beginTexturePreviewInteraction,
  endTexturePreviewInteraction,
} from "../actions/texturePerformance";
import { colorSequencePosAtCoords } from "../utils";
import { isValidYarnPaletteIndex } from "../actions/yarnSequenceRows";

function brushColor(e, colorCanvas) {
  let pos = colorSequencePosAtCoords(e.touches[0], colorCanvas);
  dispatch({
    yarnSequence: GLOBAL_STATE.yarnSequence.brush(
      { x: pos.x, y: pos.y },
      GLOBAL_STATE.activeYarn
    ),
  });

  function move(e) {
    if (!isValidYarnPaletteIndex(GLOBAL_STATE.activeYarn, GLOBAL_STATE.yarnPalette.length)) return;
    let newPos = colorSequencePosAtCoords(e.touches[0], colorCanvas);
    if (newPos.x == pos.x && newPos.y == pos.y) return;

    const updated = GLOBAL_STATE.yarnSequence.line(
      { x: pos.x, y: pos.y },
      { x: newPos.x, y: newPos.y },
      GLOBAL_STATE.activeYarn
    );

    dispatch({ yarnSequence: updated });

    pos = newPos;
  }

  function end() {
    dispatch({ transforming: false });
    endTexturePreviewInteraction();

    colorCanvas.removeEventListener("touchmove", move);
    colorCanvas.removeEventListener("touchcancel", end);
    colorCanvas.removeEventListener("touchend", end);
  }

  colorCanvas.addEventListener("touchmove", move);
  colorCanvas.addEventListener("touchcancel", end);
  colorCanvas.addEventListener("touchend", end);
}

export function colorSequenceTouchInteraction(canvas) {
  canvas.addEventListener("touchstart", (e) => {
    if (!isValidYarnPaletteIndex(GLOBAL_STATE.activeYarn, GLOBAL_STATE.yarnPalette.length)) return;
    dispatch({ transforming: true });
    beginTexturePreviewInteraction();

    brushColor(e, canvas);
  });
}
