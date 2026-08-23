import { GLOBAL_STATE, dispatch } from "../state";
import { resizeYarnSequenceToChartHeight } from "./yarnSequenceRows";

export function fitAreaDimension(areaDimension, unitDimension) {
  const unit = Math.max(1, Math.floor(Number(unitDimension) || 1));
  const area = Math.max(unit, Math.floor(Number(areaDimension) || unit));
  return Math.max(unit, Math.floor(area / unit) * unit);
}

export function fitRepeatAreaToUnit(area, width, height) {
  return [fitAreaDimension(area[0], width), fitAreaDimension(area[1], height)];
}

function scaledAreaDimension(areaDimension, oldUnitDimension, newUnitDimension) {
  const oldUnit = Math.max(1, Math.floor(Number(oldUnitDimension) || 1));
  const newUnit = Math.max(1, Math.floor(Number(newUnitDimension) || 1));
  const area = Math.max(oldUnit, Math.floor(Number(areaDimension) || oldUnit));
  const unitCount = Math.max(1, Math.floor(area / oldUnit));
  return unitCount * newUnit;
}

export function scaleRepeatAreaToUnit(repeat, width, height) {
  return [
    scaledAreaDimension(repeat.area[0], repeat.bitmap.width, width),
    scaledAreaDimension(repeat.area[1], repeat.bitmap.height, height),
  ];
}

export function chartResizeForRepeat(repeatIndex, area) {
  if (repeatIndex !== 0) return {};

  if (
    GLOBAL_STATE.chart.width == area[0] &&
    GLOBAL_STATE.chart.height == area[1]
  ) {
    return {};
  }

  return {
    chart: GLOBAL_STATE.chart.resize(area[0], area[1]),
    yarnSequence: resizeYarnSequenceToChartHeight(
      GLOBAL_STATE.yarnSequence,
      area[1],
      GLOBAL_STATE.activeYarn
    ),
  };
}

export function resizeChartArea(width, height) {
  const nextWidth = Math.max(1, Math.floor(Number(width) || 1));
  const nextHeight = Math.max(1, Math.floor(Number(height) || 1));
  const repeat = GLOBAL_STATE.repeats[0];
  if (!repeat) return;

  const area = [nextWidth, nextHeight];

  dispatch({
    repeats: [
      {
        ...repeat,
        area,
      },
      ...GLOBAL_STATE.repeats.slice(1),
    ],
    ...chartResizeForRepeat(0, area),
  });
}

export function resizeRepeatBitmap(repeatIndex, width, height) {
  const repeat = GLOBAL_STATE.repeats[repeatIndex];
  if (!repeat) return;

  const nextWidth = Math.max(1, Math.floor(Number(width) || 1));
  const nextHeight = Math.max(1, Math.floor(Number(height) || 1));

  dispatch({
    repeats: [
      ...GLOBAL_STATE.repeats.slice(0, repeatIndex),
      {
        ...repeat,
        bitmap: repeat.bitmap.vFlip().resize(nextWidth, nextHeight).vFlip(),
      },
      ...GLOBAL_STATE.repeats.slice(repeatIndex + 1),
    ],
  });
}
