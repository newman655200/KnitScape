import { GLOBAL_STATE, dispatch } from "../state";
import { devicePixelBoundingBox } from "../utils";
import {
  MIN_SCALE,
  MAX_SCALE,
  MIN_SIM_SCALE,
  MAX_SIM_SCALE,
} from "../constants";

export function toggleFullscreen() {
  var doc = window.document;
  var docEl = doc.documentElement;

  var requestFullScreen =
    docEl.requestFullscreen ||
    docEl.mozRequestFullScreen ||
    docEl.webkitRequestFullScreen ||
    docEl.msRequestFullscreen;
  var cancelFullScreen =
    doc.exitFullscreen ||
    doc.mozCancelFullScreen ||
    doc.webkitExitFullscreen ||
    doc.msExitFullscreen;

  if (
    !doc.fullscreenElement &&
    !doc.mozFullScreenElement &&
    !doc.webkitFullscreenElement &&
    !doc.msFullscreenElement
  ) {
    requestFullScreen.call(docEl);
  } else {
    cancelFullScreen.call(doc);
  }
}

export function centerZoom(scale) {
  dispatch({ scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale)) });
}

export function centerZoomSimulation(scale) {
  let bbox = document.getElementById("sim-container").getBoundingClientRect();

  zoomSimulationAtPoint({ x: bbox.width / 2, y: bbox.height / 2 }, scale);
}

export function zoomSimulationAtPoint(pt, simScale) {
  if (simScale < MIN_SIM_SCALE || simScale > MAX_SIM_SCALE) return;

  const start = {
    x: (pt.x - GLOBAL_STATE.simPan.x) / GLOBAL_STATE.simScale,
    y: (pt.y - GLOBAL_STATE.simPan.y) / GLOBAL_STATE.simScale,
  };

  dispatch({
    simScale,
    simPan: {
      x: pt.x - start.x * simScale,
      y: pt.y - start.y * simScale,
    },
  });
}

export function zoomAtPoint(pt, scale) {
  if (scale < MIN_SCALE || scale > MAX_SCALE) return;

  const start = {
    x: (pt.x - GLOBAL_STATE.chartPan.x) / GLOBAL_STATE.scale,
    y: (pt.y - GLOBAL_STATE.chartPan.y) / GLOBAL_STATE.scale,
  };

  dispatch({
    scale,
    chartPan: {
      x: pt.x - start.x * scale,
      y: pt.y - start.y * scale,
    },
  });
}

export function fitChart() {
  const editors = [
    [document.querySelector("#cam-editor-pane .pattern-editor-viewport"), GLOBAL_STATE.camBitmap],
    [document.querySelector("#needle-editor-pane .pattern-editor-viewport"), GLOBAL_STATE.needleBitmap],
  ];
  const fittedScales = editors
    .filter(([element]) => element)
    .map(([element, bitmap]) => {
      const { width, height } = devicePixelBoundingBox(element);
      return Math.floor(
        0.85 * Math.min(width / bitmap.width, height / bitmap.height)
      );
    });

  if (fittedScales.length === 0) return;
  dispatch({
    scale: Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, ...fittedScales)
    ),
  });
}

export function sizeCanvasToBitmap(canvas, bitmapWidth, bitmapHeight) {
  canvas.width = GLOBAL_STATE.scale * bitmapWidth;
  canvas.height = GLOBAL_STATE.scale * bitmapHeight;
  canvas.style.width = `${
    (GLOBAL_STATE.scale * bitmapWidth) / devicePixelRatio
  }px`;

  canvas.style.height = `${
    (GLOBAL_STATE.scale * bitmapHeight) / devicePixelRatio
  }px`;
}
