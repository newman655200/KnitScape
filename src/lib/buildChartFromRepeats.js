import { Bimp } from "./Bimp.js";

export function buildChartFromRepeats({
  repeats,
  width,
  height,
  emptyColor,
}) {
  let chart = Bimp.empty(width, height, emptyColor);

  for (const repeat of repeats) {
    const tiled = Bimp.fromTile(
      repeat.area[0],
      repeat.area[1],
      repeat.bitmap.vFlip()
    ).vFlip();
    chart = chart.overlay(tiled, repeat.pos);
  }

  return chart;
}
