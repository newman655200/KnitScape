import { zoomViewportAtPoint } from "../chartViewport.js";
import { GLOBAL_STATE, dispatch } from "../state.js";

function wheelScale(deltaY, scale, reverseScroll) {
  if (deltaY === 0) return scale;
  const zoomIn = deltaY < 0;
  return scale + (zoomIn !== reverseScroll ? 1 : -1);
}

export function chartPointerPanZoom(gridWindow) {
  let activePointerId = null;

  gridWindow.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const nextScale = wheelScale(
        event.deltaY,
        GLOBAL_STATE.scale,
        GLOBAL_STATE.reverseScroll
      );
      if (nextScale === GLOBAL_STATE.scale) return;

      const bounds = gridWindow.getBoundingClientRect();
      const viewport = zoomViewportAtPoint({
        pan: GLOBAL_STATE.chartPan,
        scale: GLOBAL_STATE.scale,
        nextScale,
        point: {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        },
      });
      if (viewport.scale === GLOBAL_STATE.scale) return;

      dispatch({ scale: viewport.scale, chartPan: viewport.pan });
    },
    { passive: false }
  );

  gridWindow.addEventListener("pointerdown", (event) => {
    if (event.button !== 1 || activePointerId !== null) return;

    event.preventDefault();
    activePointerId = event.pointerId;
    const pointerId = activePointerId;
    const startPoint = { x: event.clientX, y: event.clientY };
    const startPan = GLOBAL_STATE.chartPan;
    let ended = false;

    gridWindow.setPointerCapture(pointerId);

    const move = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      dispatch({
        chartPan: {
          x: startPan.x + moveEvent.clientX - startPoint.x,
          y: startPan.y + moveEvent.clientY - startPoint.y,
        },
      });
    };

    const end = (endEvent) => {
      if (endEvent.pointerId !== pointerId || ended) return;
      ended = true;
      gridWindow.removeEventListener("pointermove", move);
      gridWindow.removeEventListener("pointerup", end);
      gridWindow.removeEventListener("pointercancel", end);
      gridWindow.removeEventListener("lostpointercapture", end);
      activePointerId = null;
      if (gridWindow.hasPointerCapture(pointerId)) {
        gridWindow.releasePointerCapture(pointerId);
      }
    };

    gridWindow.addEventListener("pointermove", move);
    gridWindow.addEventListener("pointerup", end);
    gridWindow.addEventListener("pointercancel", end);
    gridWindow.addEventListener("lostpointercapture", end);
  });

  gridWindow.addEventListener("auxclick", (event) => {
    if (event.button === 1) event.preventDefault();
  });
}
