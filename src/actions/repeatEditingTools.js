import { GLOBAL_STATE, dispatch } from "../state";

function dispatchRepeatBitmap(repeatIndex, bitmap) {
  dispatch({
    repeats: [
      ...GLOBAL_STATE.repeats.slice(0, repeatIndex),
      {
        ...GLOBAL_STATE.repeats[repeatIndex],
        bitmap: bitmap,
      },
      ...GLOBAL_STATE.repeats.slice(repeatIndex + 1),
    ],
  });
}

function brush(repeatIndex, startPos) {
  function onMove(newPos) {
    const updated = GLOBAL_STATE.repeats[repeatIndex].bitmap.line(
      { x: startPos.x, y: startPos.y },
      { x: newPos.x, y: newPos.y },
      GLOBAL_STATE.activeSymbol
    );

    startPos = newPos;
    dispatchRepeatBitmap(repeatIndex, updated);
  }

  onMove(startPos);
  return onMove;
}

export const repeatEditingTools = { brush };
