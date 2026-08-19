import { GLOBAL_STATE, dispatch } from "../state";
import { MIN_SIM_SCALE, MAX_SIM_SCALE } from "../constants";
import {
  beginTexturePreviewInteraction,
  endTexturePreviewInteraction,
} from "../actions/texturePerformance";

const SIM_WHEEL_IDLE_MS = 120;
let wheelPreviewTimer = null;
let wheelPreview = null;

function nextWheelScale(deltaY, currentScale) {
  const zoomIn = Math.sign(deltaY) < 0;

  if (zoomIn) {
    return GLOBAL_STATE.reverseScroll ? currentScale * 0.9 : currentScale * 1.1;
  }

  return GLOBAL_STATE.reverseScroll ? currentScale * 1.1 : currentScale * 0.9;
}

function zoomPreviewAtPoint(pt, base, nextScale) {
  const start = {
    x: (pt.x - base.pan.x) / base.scale,
    y: (pt.y - base.pan.y) / base.scale,
  };

  return {
    scale: nextScale,
    pan: {
      x: pt.x - start.x * nextScale,
      y: pt.y - start.y * nextScale,
    },
  };
}

function applyWheelPreviewTransform(preview) {
  dispatch({
    simPreviewScale: preview.scale,
    simPreviewPan: preview.pan,
  });
}

function commitWheelPreviewZoom() {
  if (!wheelPreview) return;

  const { scale, pan } = wheelPreview;
  wheelPreview = null;

  dispatch({
    simScale: scale,
    simPan: pan,
    simPreviewScale: null,
    simPreviewPan: null,
  });
  endTexturePreviewInteraction();
}

function pan(e, sim) {
  commitWheelPreviewZoom();

  const startPos = { x: e.clientX, y: e.clientY };
  const startPan = GLOBAL_STATE.simPan;
  beginTexturePreviewInteraction();
  sim.setPointerCapture?.(e.pointerId);

  function move(e) {
    if (e.buttons == 0) {
      end();
    } else {
      const dx = startPos.x - e.clientX;
      const dy = startPos.y - e.clientY;

      dispatch({ simPan: { x: startPan.x - dx, y: startPan.y - dy } });
    }
  }

  function end() {
    sim.removeEventListener("pointermove", move);
    sim.removeEventListener("pointerup", end);
    sim.removeEventListener("pointercancel", end);
    sim.removeEventListener("pointerleave", end);
    sim.releasePointerCapture?.(e.pointerId);
    endTexturePreviewInteraction();
  }

  sim.addEventListener("pointermove", move);
  sim.addEventListener("pointerup", end);
  sim.addEventListener("pointercancel", end);
  sim.addEventListener("pointerleave", end);
}

export function simulationPointerInteraction(simContainer) {
  simContainer.addEventListener("wheel", (e) => {
    e.preventDefault();
    beginTexturePreviewInteraction();

    const bounds = simContainer.getBoundingClientRect();
    const base = wheelPreview || {
      scale: GLOBAL_STATE.simScale,
      pan: GLOBAL_STATE.simPan,
    };
    const simScale = nextWheelScale(e.deltaY, base.scale);

    if (simScale < MIN_SIM_SCALE || simScale > MAX_SIM_SCALE) {
      endTexturePreviewInteraction();
      return;
    }

    wheelPreview = zoomPreviewAtPoint(
      {
        x: (e.clientX - bounds.left) / 2,
        y: (e.clientY - bounds.top) / 2,
      },
      base,
      simScale
    );

    applyWheelPreviewTransform(wheelPreview);
    window.clearTimeout(wheelPreviewTimer);
    wheelPreviewTimer = window.setTimeout(
      commitWheelPreviewZoom,
      SIM_WHEEL_IDLE_MS
    );
  }, { passive: false });

  simContainer.addEventListener("pointerdown", (e) => {

    if (e.button !== 0) return;
    e.preventDefault();
    pan(e, simContainer);
  });
}
