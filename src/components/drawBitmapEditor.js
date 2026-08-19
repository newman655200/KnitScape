import { SYMBOL_BITS, SYMBOL_PATHS } from "../constants.js";

function sizeCanvas(canvas, bitmap, scale) {
  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;
  canvas.style.width = `${(bitmap.width * scale) / devicePixelRatio}px`;
  canvas.style.height = `${(bitmap.height * scale) / devicePixelRatio}px`;
}

function drawSymbols(canvas, bitmap, scale, symbolMap, symbolLineWidth) {
  const context = canvas.getContext("2d");
  context.resetTransform();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.translate(-0.5, -0.5);
  context.lineWidth = 0.01 * symbolLineWidth;

  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      const symbol = symbolMap[bitmap.pixel(x, y)];
      context.save();
      context.translate(x * scale, (bitmap.height - y - 1) * scale);
      context.scale(scale, scale);

      if (SYMBOL_BITS[symbol]) {
        context.fillStyle = "#fff";
        context.fillRect(0, 0, 1, 1);
      }
      context.stroke(SYMBOL_PATHS[symbol]);
      context.restore();
    }
  }
}

function drawGrid(canvas, bitmap, scale, enabled) {
  const context = canvas.getContext("2d");
  context.resetTransform();
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!enabled || scale < 15) return;

  context.translate(-0.5, -0.5);
  context.beginPath();
  for (let x = 0; x <= bitmap.width; x++) {
    context.moveTo(x * scale, 0);
    context.lineTo(x * scale, bitmap.height * scale);
  }
  for (let y = 0; y <= bitmap.height; y++) {
    context.moveTo(0, y * scale);
    context.lineTo(bitmap.width * scale, y * scale);
  }
  context.stroke();
}

export function drawBitmapEditor({
  field,
  symbolCanvas,
  gridCanvas,
  interactionCanvas,
}) {
  return ({ state }) => {
    let bitmap = state[field];
    let scale = state.scale;
    let symbolMap = state.symbolMap;
    let symbolLineWidth = state.symbolLineWidth;
    let grid = state.grid;

    function draw() {
      for (const canvas of [symbolCanvas, gridCanvas, interactionCanvas]) {
        sizeCanvas(canvas, bitmap, scale);
      }
      drawSymbols(symbolCanvas, bitmap, scale, symbolMap, symbolLineWidth);
      drawGrid(gridCanvas, bitmap, scale, grid);
    }

    draw();

    return {
      syncState(nextState) {
        if (
          bitmap !== nextState[field] ||
          scale !== nextState.scale ||
          symbolMap !== nextState.symbolMap ||
          symbolLineWidth !== nextState.symbolLineWidth ||
          grid !== nextState.grid
        ) {
          bitmap = nextState[field];
          scale = nextState.scale;
          symbolMap = nextState.symbolMap;
          symbolLineWidth = nextState.symbolLineWidth;
          grid = nextState.grid;
          draw();
        }
      },
    };
  };
}
