import { SYMBOL_BITS, SYMBOL_PATHS } from "../constants.js";

function sizeCanvas(canvas, bitmap, scale) {
  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;
  canvas.style.width = `${(bitmap.width * scale) / devicePixelRatio}px`;
  canvas.style.height = `${(bitmap.height * scale) / devicePixelRatio}px`;
}

function prepareSymbolContext(context, symbolLineWidth) {
  context.resetTransform();
  context.lineWidth = 0.01 * symbolLineWidth;
}

function drawSymbolCell(context, bitmap, scale, symbolMap, x, y) {
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

function drawSymbols(canvas, bitmap, scale, symbolMap, symbolLineWidth) {
  const context = canvas.getContext("2d");
  prepareSymbolContext(context, symbolLineWidth);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.translate(-0.5, -0.5);

  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      drawSymbolCell(context, bitmap, scale, symbolMap, x, y);
    }
  }
}

function lineCells(from, to) {
  const cells = [];
  let start = { ...from };
  let end = { ...to };

  if (Math.abs(start.x - end.x) > Math.abs(start.y - end.y)) {
    if (start.x > end.x) [start, end] = [end, start];
    const slope = (end.y - start.y) / (end.x - start.x);
    for (let { x, y } = start; x <= end.x; x++) {
      cells.push({ x, y: Math.round(y) });
      y += slope;
    }
  } else {
    if (start.y > end.y) [start, end] = [end, start];
    const slope = (end.x - start.x) / (end.y - start.y);
    for (let { x, y } = start; y <= end.y; y++) {
      cells.push({ x: Math.round(x), y });
      x += slope;
    }
  }

  return cells;
}

function drawEditedSymbols(
  canvas,
  bitmap,
  scale,
  symbolMap,
  symbolLineWidth,
  edit
) {
  const context = canvas.getContext("2d");
  const cells = lineCells(edit.startPos, edit.endPos).filter(
    ({ x, y }) => x >= 0 && y >= 0 && x < bitmap.width && y < bitmap.height
  );
  prepareSymbolContext(context, symbolLineWidth);

  for (const { x, y } of cells) {
    context.clearRect(
      x * scale,
      (bitmap.height - y - 1) * scale,
      scale,
      scale
    );
  }

  context.translate(-0.5, -0.5);
  for (const { x, y } of cells) {
    drawSymbolCell(context, bitmap, scale, symbolMap, x, y);
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

    function resizeAndRedraw() {
      for (const canvas of [symbolCanvas, gridCanvas, interactionCanvas]) {
        sizeCanvas(canvas, bitmap, scale);
      }
      drawSymbols(symbolCanvas, bitmap, scale, symbolMap, symbolLineWidth);
      drawGrid(gridCanvas, bitmap, scale, grid);
    }

    resizeAndRedraw();

    return {
      syncState(nextState, changes = []) {
        const nextBitmap = nextState[field];
        const bitmapChanged = bitmap !== nextBitmap;
        const geometryChanged =
          bitmap.width !== nextBitmap.width ||
          bitmap.height !== nextBitmap.height ||
          scale !== nextState.scale;
        const symbolStyleChanged =
          symbolMap !== nextState.symbolMap ||
          symbolLineWidth !== nextState.symbolLineWidth;
        const gridChanged = grid !== nextState.grid;
        const patternEdit =
          changes.includes("patternEdit") &&
          nextState.patternEdit?.field === field
            ? nextState.patternEdit
            : null;

        bitmap = nextBitmap;
        scale = nextState.scale;
        symbolMap = nextState.symbolMap;
        symbolLineWidth = nextState.symbolLineWidth;
        grid = nextState.grid;

        if (geometryChanged) {
          resizeAndRedraw();
          return;
        }

        if (bitmapChanged || symbolStyleChanged) {
          if (patternEdit && !symbolStyleChanged) {
            drawEditedSymbols(
              symbolCanvas,
              bitmap,
              scale,
              symbolMap,
              symbolLineWidth,
              patternEdit
            );
          } else {
            drawSymbols(
              symbolCanvas,
              bitmap,
              scale,
              symbolMap,
              symbolLineWidth
            );
          }
        }

        if (gridChanged) {
          drawGrid(gridCanvas, bitmap, scale, grid);
        }
      },
    };
  };
}
