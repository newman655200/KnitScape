import { cssCellSize } from "../chartViewport.js";

function pixelRatio() {
  const ratio = Number(globalThis.devicePixelRatio);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

export function yarnSequenceCanvas({ canvas }) {
  return ({ state }) => {
    let { scale, yarnSequence, yarnPalette } = state;
    let dpr = pixelRatio();

    let width = yarnSequence.width;
    let height = yarnSequence.height;
    let lastDrawn = null;

    function sizeCanvas() {
      canvas.width = scale * width;
      canvas.height = scale * height;
      canvas.style.width = `${cssCellSize(scale, dpr) * width}px`;
      canvas.style.height = `${cssCellSize(scale, dpr) * height}px`;
    }

    function drawYarnSequenceGrid(ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
      ctx.lineWidth = Math.max(1, Math.round(scale * 0.08));

      for (let y = 1; y < height; y++) {
        const lineY = y * scale;
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(width * scale, lineY);
        ctx.stroke();
      }

      ctx.restore();
    }

    function draw() {
      const ctx = canvas.getContext("2d");

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let paletteIndex = yarnSequence.pixel(x, height - y - 1);

          if (
            lastDrawn == null ||
            lastDrawn.pixel(x, height - y - 1) != paletteIndex
          ) {
            ctx.translate(x * scale, y * scale);

            ctx.fillStyle = yarnPalette[paletteIndex];

            ctx.clearRect(0, 0, scale, scale);
            ctx.fillRect(0, 0, scale, scale);

            ctx.setTransform(1, 0, 0, 1, 0, 0);
          }
        }
      }
      drawYarnSequenceGrid(ctx);
      lastDrawn = yarnSequence;
    }

    sizeCanvas();
    draw();

    return {
      syncState(state) {
        const nextDpr = pixelRatio();
        const dprChanged = dpr !== nextDpr;
        if (yarnPalette != state.yarnPalette) {
          yarnPalette = state.yarnPalette;
          lastDrawn = null;
        }

        if (
          scale != state.scale ||
          dprChanged ||
          width != state.yarnSequence.width ||
          height != state.yarnSequence.height
        ) {
          width = state.yarnSequence.width;
          height = state.yarnSequence.height;
          scale = state.scale;
          dpr = nextDpr;

          sizeCanvas();
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
