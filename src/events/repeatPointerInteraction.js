import { GLOBAL_STATE, dispatch } from "../state";
import { posAtCoords } from "../utils";

import { repeatEditingTools } from "../actions/repeatEditingTools";
import { chartResizeForRepeat } from "../actions/repeatDimensions";
import { selectRepeatCell } from "../actions/selectedCell";

function getRepeatIndex(elem) {
  elem = elem.parentNode;
  while (elem) {
    if (elem.hasAttribute("data-repeatindex"))
      return Number(elem.dataset.repeatindex);
    elem = elem.parentNode;
  }
  return null;
}

function editRepeat(repeatIndex, repeatCanvas, tool) {
  // tool onMove is not called unless pointer moves into another cell in the chart
  let pos = GLOBAL_STATE.repeatPos;
  dispatch({ transforming: true });

  let onMove = tool(repeatIndex, pos);
  if (!onMove) return;

  function move(moveEvent) {
    if (moveEvent.buttons == 0) {
      end();
    } else {
      let newPos = GLOBAL_STATE.repeatPos;
      if (newPos.x == pos.x && newPos.y == pos.y) return;
      onMove(newPos);
      pos = newPos;
    }
  }

  function end() {
    dispatch({ transforming: false });

    repeatCanvas.removeEventListener("pointermove", move);
    repeatCanvas.removeEventListener("pointerup", end);
    repeatCanvas.removeEventListener("pointerleave", end);
  }

  repeatCanvas.addEventListener("pointermove", move);
  repeatCanvas.addEventListener("pointerup", end);
  repeatCanvas.addEventListener("pointerleave", end);
}

function editRepeatArea(e, repeatIndex, direction) {
  const repeat = GLOBAL_STATE.repeats[repeatIndex];
  const startSize = direction == "x" ? repeat.area[0] : repeat.area[1];
  const startPos = [e.clientX, e.clientY];
  const moveDragger = e.target;

  dispatch({ transforming: true });

  document.body.classList.add("grabbing");
  moveDragger.classList.remove("grab");

  const end = () => {
    dispatch({ transforming: false });

    document.body.classList.remove("grabbing");

    window.removeEventListener("pointermove", onmove);
    window.removeEventListener("pointerup", end);

    moveDragger.classList.add("grab");
  };

  const onmove = (e) => {
    let newSize;
    let updated;

    if (direction == "x") {
      newSize =
        startSize -
        Math.floor(
          (startPos[0] - e.clientX) / (GLOBAL_STATE.scale / devicePixelRatio)
        );

      newSize = newSize < repeat.bitmap.width ? repeat.bitmap.width : newSize;

      updated = {
        ...GLOBAL_STATE.repeats[repeatIndex],
        area: [newSize, GLOBAL_STATE.repeats[repeatIndex].area[1]],
      };
    } else {
      newSize =
        startSize +
        Math.floor(
          (startPos[1] - e.clientY) / (GLOBAL_STATE.scale / devicePixelRatio)
        );

      newSize = newSize < repeat.bitmap.height ? repeat.bitmap.height : newSize;

      updated = {
        ...GLOBAL_STATE.repeats[repeatIndex],
        area: [GLOBAL_STATE.repeats[repeatIndex].area[0], newSize],
      };
    }

    dispatch({
      repeats: [
        ...GLOBAL_STATE.repeats.slice(0, repeatIndex),
        updated,
        ...GLOBAL_STATE.repeats.slice(repeatIndex + 1),
      ],
      ...chartResizeForRepeat(repeatIndex, updated.area),
    });
  };

  window.addEventListener("pointermove", onmove);
  window.addEventListener("pointerup", end);
}

export function repeatPointerInteraction(repeatContainer) {
  repeatContainer.addEventListener("pointerdown", (e) => {
    const repeatIndex = getRepeatIndex(e.target);
    let classList = e.target.classList;

    if (
      GLOBAL_STATE.editingRepeat != repeatIndex &&
      classList.contains("repeat-canvas")
    ) {
      // If we're not editing this repeat, begin editing it
      console.log("NOW EDITING REPEAT", repeatIndex);
      dispatch({ editingRepeat: repeatIndex });
      return;
    }

    if (classList.contains("repeat-area-dragger")) {
      if (classList.contains("x-axis")) {
        editRepeatArea(e, repeatIndex, "x");
      } else {
        editRepeatArea(e, repeatIndex, "y");
      }
    } else if (classList.contains("repeat-canvas")) {
      // interacting with canvas
      const repeatPos = posAtCoords(e, e.target);
      dispatch({ repeatPos });
      selectRepeatCell(repeatIndex, repeatPos);
      const activeTool = GLOBAL_STATE.activeTool;
      const editTool = repeatEditingTools[activeTool];
      if (!editTool) return;
      editRepeat(repeatIndex, e.target, editTool);
    }
  });

  repeatContainer.addEventListener("pointermove", (e) => {
    if (GLOBAL_STATE.editingRepeat < 0) {
      const { x, y } = posAtCoords(e, repeatContainer);

      if (GLOBAL_STATE.pos.x != x || GLOBAL_STATE.pos.y != y) {
        dispatch({ pos: { x, y } });
      }
    } else {
      const { x, y } = posAtCoords(e, e.target);

      if (GLOBAL_STATE.pos.x != x || GLOBAL_STATE.pos.y != y) {
        dispatch({ repeatPos: { x, y } });
      }
    }
  });
}
