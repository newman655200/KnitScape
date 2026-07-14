import { GLOBAL_STATE, dispatch } from "../state";

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export function chartCellToRepeatCell(repeats, chartCell) {
  if (
    !chartCell ||
    chartCell.x < 0 ||
    chartCell.y < 0 ||
    chartCell.x >= GLOBAL_STATE.chart.width ||
    chartCell.y >= GLOBAL_STATE.chart.height
  ) {
    return null;
  }

  const chartY = GLOBAL_STATE.chart.height - chartCell.y - 1;

  for (let repeatIndex = repeats.length - 1; repeatIndex >= 0; repeatIndex--) {
    const repeat = repeats[repeatIndex];
    const localChartX = chartCell.x - repeat.pos[0];
    const localChartY = chartY - repeat.pos[1];

    if (
      localChartX < 0 ||
      localChartY < 0 ||
      localChartX >= repeat.area[0] ||
      localChartY >= repeat.area[1]
    ) {
      continue;
    }

    return {
      repeatIndex,
      pos: {
        x: mod(localChartX, repeat.bitmap.width),
        y: repeat.bitmap.height - 1 - mod(localChartY, repeat.bitmap.height),
      },
    };
  }

  return null;
}

export function replaceRepeatCell(repeats, cell, symbolIndex) {
  if (!cell) return repeats;

  const repeat = repeats[cell.repeatIndex];
  if (!repeat) return repeats;

  return [
    ...repeats.slice(0, cell.repeatIndex),
    {
      ...repeat,
      bitmap: repeat.bitmap.draw([
        { x: cell.pos.x, y: cell.pos.y, color: symbolIndex },
      ]),
    },
    ...repeats.slice(cell.repeatIndex + 1),
  ];
}

export function selectChartCell(pos) {
  dispatch({
    selectedChartCell: pos,
    selectedRepeatCell: chartCellToRepeatCell(GLOBAL_STATE.repeats, pos),
  });
}

export function selectRepeatCell(repeatIndex, pos) {
  dispatch({
    selectedRepeatCell: { repeatIndex, pos },
  });
}

export function applySelectedSymbol(symbolIndex) {
  const selectedRepeatCell =
    GLOBAL_STATE.selectedRepeatCell ||
    chartCellToRepeatCell(GLOBAL_STATE.repeats, GLOBAL_STATE.selectedChartCell);

  if (!selectedRepeatCell) {
    dispatch({ activeSymbol: symbolIndex });
    return;
  }

  dispatch({
    activeSymbol: symbolIndex,
    repeats: replaceRepeatCell(
      GLOBAL_STATE.repeats,
      selectedRepeatCell,
      symbolIndex
    ),
    selectedRepeatCell,
  });
}
