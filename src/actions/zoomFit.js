import { GLOBAL_STATE, dispatch } from "../state";
import {
  cssCellSize,
  fitVisibleCells,
  zoomViewportAtPoint,
} from "../chartViewport.js";
import {
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
  const nextScale = Number(scale);
  if (nextScale === GLOBAL_STATE.scale) return;

  const gridWindow = document.querySelector(".pattern-grid-window");
  if (!gridWindow) return;
  const bounds = gridWindow.getBoundingClientRect();
  const viewport = zoomViewportAtPoint({
    pan: GLOBAL_STATE.chartPan,
    scale: GLOBAL_STATE.scale,
    nextScale,
    point: { x: bounds.width / 2, y: bounds.height / 2 },
  });
  if (viewport.scale === GLOBAL_STATE.scale) return;
  dispatch({ scale: viewport.scale, chartPan: viewport.pan });
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

export function fitChart() {
  const editorViewports = [
    document.querySelector("#cam-editor-pane .pattern-editor-viewport"),
    document.querySelector("#needle-editor-pane .pattern-editor-viewport"),
  ].filter(Boolean);
  const fittedScales = editorViewports
    .map((element) => {
      const bounds = element.getBoundingClientRect();
      const style = globalThis.getComputedStyle?.(element);
      const horizontalPadding =
        Number.parseFloat(style?.paddingLeft || 0) +
        Number.parseFloat(style?.paddingRight || 0);
      const verticalPadding =
        Number.parseFloat(style?.paddingTop || 0) +
        Number.parseFloat(style?.paddingBottom || 0);
      const width = (Number(element.clientWidth) || bounds.width) - horizontalPadding;
      const height = (Number(element.clientHeight) || bounds.height) - verticalPadding;

      return fitVisibleCells({
        viewportWidth: Math.max(0, width),
        viewportHeight: Math.max(0, height),
      }).scale;
    });

  if (fittedScales.length === 0) return;
  dispatch({
    scale: Math.min(...fittedScales),
    chartPan: { x: 0, y: 0 },
  });
}

export function sizeCanvasToBitmap(canvas, bitmapWidth, bitmapHeight) {
  canvas.width = GLOBAL_STATE.scale * bitmapWidth;
  canvas.height = GLOBAL_STATE.scale * bitmapHeight;
  canvas.style.width = `${cssCellSize(GLOBAL_STATE.scale) * bitmapWidth}px`;

  canvas.style.height = `${cssCellSize(GLOBAL_STATE.scale) * bitmapHeight}px`;
}
