import { MAX_SCALE, MIN_SCALE } from "./constants.js";

function safeDevicePixelRatio(devicePixelRatio = globalThis.devicePixelRatio) {
  const ratio = Number(devicePixelRatio);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

export function cssCellSize(scale, devicePixelRatio = globalThis.devicePixelRatio) {
  return Number(scale) / safeDevicePixelRatio(devicePixelRatio);
}

export function clampChartScale(scale) {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, Number(scale)));
}

export function fitVisibleCells({
  viewportWidth,
  viewportHeight,
  visibleColumns = 16,
  visibleRows = 16,
  gutterColumns = 1,
  devicePixelRatio = globalThis.devicePixelRatio,
}) {
  const ratio = safeDevicePixelRatio(devicePixelRatio);
  const scale = Math.floor(
    Math.min(
      Number(viewportWidth) / (visibleColumns + gutterColumns),
      Number(viewportHeight) / visibleRows
    ) * ratio
  );

  return {
    scale: clampChartScale(scale),
    pan: { x: 0, y: 0 },
  };
}

export function zoomViewportAtPoint({
  pan,
  scale,
  nextScale,
  point,
  devicePixelRatio = globalThis.devicePixelRatio,
}) {
  if (nextScale < MIN_SCALE || nextScale > MAX_SCALE) {
    return { scale, pan };
  }

  const startCellSize = cssCellSize(scale, devicePixelRatio);
  const nextCellSize = cssCellSize(nextScale, devicePixelRatio);
  const chartPoint = {
    x: (point.x - pan.x) / startCellSize,
    y: (point.y - pan.y) / startCellSize,
  };

  return {
    scale: nextScale,
    pan: {
      x: point.x - chartPoint.x * nextCellSize,
      y: point.y - chartPoint.y * nextCellSize,
    },
  };
}
