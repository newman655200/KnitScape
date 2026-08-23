import { zoomViewportAtPoint } from "../chartViewport.js";
import { MAX_SCALE, MIN_SCALE } from "../constants.js";
import { GLOBAL_STATE, dispatch } from "../state.js";

const WHEEL_LINE_PIXELS = 40;
const WHEEL_STEP_PIXELS = 100;
const MAX_WHEEL_STEPS_PER_FRAME = 10;

function normalizedWheelDelta(event, pageHeight) {
  if (event.deltaMode === 1) return event.deltaY * WHEEL_LINE_PIXELS;
  if (event.deltaMode === 2) return event.deltaY * pageHeight;
  return event.deltaY;
}

export function chartPointerPanZoom(
  gridWindow,
  {
    requestFrame = (callback) => globalThis.requestAnimationFrame(callback),
  } = {}
) {
  let activePointerId = null;
  let wheelFramePending = false;
  let wheelDelta = 0;
  let wheelPoint = { x: 0, y: 0 };
  const pointerTarget = gridWindow.ownerDocument?.defaultView ?? gridWindow;

  const applyWheelZoom = () => {
    wheelFramePending = false;
    const direction = Math.sign(wheelDelta);
    const steps = Math.min(
      MAX_WHEEL_STEPS_PER_FRAME,
      Math.trunc(Math.abs(wheelDelta) / WHEEL_STEP_PIXELS)
    );
    if (steps === 0) return;

    wheelDelta -= direction * steps * WHEEL_STEP_PIXELS;
    const zoomDirection = direction < 0 ? 1 : -1;
    const scaleDirection = GLOBAL_STATE.reverseScroll
      ? -zoomDirection
      : zoomDirection;
    const nextScale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, GLOBAL_STATE.scale + steps * scaleDirection)
    );
    const viewport = zoomViewportAtPoint({
      pan: GLOBAL_STATE.chartPan,
      scale: GLOBAL_STATE.scale,
      nextScale,
      point: wheelPoint,
    });
    if (!Object.is(viewport.scale, GLOBAL_STATE.scale)) {
      dispatch({ scale: viewport.scale, chartPan: viewport.pan });
    }

    const reachedOutwardBoundary =
      (nextScale === MAX_SCALE && scaleDirection > 0) ||
      (nextScale === MIN_SCALE && scaleDirection < 0);
    if (reachedOutwardBoundary) wheelDelta = 0;

    if (Math.abs(wheelDelta) >= WHEEL_STEP_PIXELS) scheduleWheelFrame();
  };

  const scheduleWheelFrame = () => {
    if (wheelFramePending) return;
    wheelFramePending = true;
    requestFrame(applyWheelZoom);
  };

  gridWindow.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const bounds = gridWindow.getBoundingClientRect();
      const nextDelta = normalizedWheelDelta(event, bounds.height);
      const reversesSubthresholdResidue =
        wheelDelta !== 0 &&
        Math.abs(wheelDelta) < WHEEL_STEP_PIXELS &&
        nextDelta !== 0 &&
        Math.sign(nextDelta) !== Math.sign(wheelDelta);
      if (reversesSubthresholdResidue) wheelDelta = 0;
      wheelDelta += nextDelta;
      wheelPoint = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };
      if (wheelDelta !== 0) scheduleWheelFrame();
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

    try {
      gridWindow.setPointerCapture?.(pointerId);
    } catch {
      // Window-level listeners below keep panning usable without pointer capture.
    }

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
      pointerTarget.removeEventListener("pointermove", move);
      pointerTarget.removeEventListener("pointerup", end);
      pointerTarget.removeEventListener("pointercancel", end);
      gridWindow.removeEventListener("lostpointercapture", end);
      activePointerId = null;
      if (gridWindow.hasPointerCapture?.(pointerId)) {
        gridWindow.releasePointerCapture?.(pointerId);
      }
    };

    pointerTarget.addEventListener("pointermove", move);
    pointerTarget.addEventListener("pointerup", end);
    pointerTarget.addEventListener("pointercancel", end);
    gridWindow.addEventListener("lostpointercapture", end);
  });

  gridWindow.addEventListener("auxclick", (event) => {
    if (event.button === 1) event.preventDefault();
  });
}
