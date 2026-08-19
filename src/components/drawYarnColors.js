import { sizeCanvasToBitmap } from "../actions/zoomFit";

export function drawYarnColors(yarnColorCanvas) {
  return ({ state }) => {
    let { scale, yarnPalette, yarnSequence, needleBitmap } = state;

    let lastDrawn = null;
    let chartWidth = needleBitmap.width;
    let chartHeight = needleBitmap.height;

    let yarnHeight = yarnSequence.height;

    function draw() {
      // Draws only the pixels that have changed
      const ctx = yarnColorCanvas.getContext("2d");

      for (let y = 0; y < chartHeight; y++) {
        let paletteIndex = yarnSequence.pixel(
          0,
          (chartHeight - y - 1) % yarnHeight
        );

        if (
          lastDrawn == null ||
          lastDrawn.pixel(0, (chartHeight - y - 1) % yarnHeight) != paletteIndex
        ) {
          ctx.fillStyle = yarnPalette[paletteIndex];
          ctx.fillRect(0, y * scale, chartWidth * scale, scale);
        }
      }
      lastDrawn = yarnSequence;
    }

    lastDrawn = null;

    sizeCanvasToBitmap(yarnColorCanvas, chartWidth, chartHeight);
    draw();

    return {
      syncState(state) {
        yarnSequence = state.yarnSequence;

        if (
          chartWidth != state.needleBitmap.width ||
          chartHeight != state.needleBitmap.height ||
          yarnHeight != state.yarnSequence.height ||
          scale != state.scale
        ) {
          chartWidth = state.needleBitmap.width;
          chartHeight = state.needleBitmap.height;
          yarnHeight = state.yarnSequence.height;
          scale = state.scale;

          lastDrawn = null;
          sizeCanvasToBitmap(yarnColorCanvas, chartWidth, chartHeight);
        }

        if (yarnPalette != state.yarnPalette) {
          yarnPalette = state.yarnPalette;
          lastDrawn = null;
        }

        if (lastDrawn != state.yarnSequence) {
          yarnSequence = state.yarnSequence;
          draw();
        }
      },
    };
  };
}
