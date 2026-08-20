import { SYMBOL_BITS, SYMBOL_PATHS } from "../constants.js";

const FULL_PALETTE = Object.freeze({
  ordinaryBackground: "#b9b9b9",
  bitBackground: "#f4f4f4",
  ordinarySymbol: "#2f3437",
  bitSymbol: "#2f3437",
});

const UNIT_PALETTE = Object.freeze({
  ordinaryBackground: "#050505",
  bitBackground: "#f2f2f2",
  ordinarySymbol: "#f7f7f7",
  bitSymbol: "#111111",
});

function pixelRatio() {
  const ratio = Number(globalThis.devicePixelRatio);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

function sizeCanvas(canvas, bitmap, scale) {
  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;
  canvas.style.width = `${(bitmap.width * scale) / pixelRatio()}px`;
  canvas.style.height = `${(bitmap.height * scale) / pixelRatio()}px`;
}

function drawSymbolCell(context, bitmap, scale, symbolMap, palette, x, y) {
  const symbol = symbolMap[bitmap.pixel(x, y)];
  const bit = Boolean(SYMBOL_BITS[symbol]);

  context.save();
  context.translate(x * scale, (bitmap.height - y - 1) * scale);
  context.fillStyle = bit ? palette.bitBackground : palette.ordinaryBackground;
  context.fillRect(0, 0, scale, scale);
  context.strokeStyle = bit ? palette.bitSymbol : palette.ordinarySymbol;
  context.scale(scale, scale);
  context.stroke(SYMBOL_PATHS[symbol]);
  context.restore();
}

function drawSymbols(canvas, bitmap, scale, symbolMap, symbolLineWidth, palette) {
  const context = canvas.getContext("2d");
  context.resetTransform();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = 0.01 * symbolLineWidth;

  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      drawSymbolCell(context, bitmap, scale, symbolMap, palette, x, y);
    }
  }
}

function drawGrid(canvas, bitmap, scale, enabled) {
  const context = canvas.getContext("2d");
  context.resetTransform();
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!enabled || scale < 15) return;

  context.strokeStyle = "#2f3437";
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

function bitmapGeometryChanged(previousBitmap, nextBitmap) {
  return (
    previousBitmap.width !== nextBitmap.width ||
    previousBitmap.height !== nextBitmap.height
  );
}

export function drawBitmapEditor({
  fullField,
  unitField,
  fullSymbolCanvas,
  fullGridCanvas,
  unitSymbolCanvas,
  unitGridCanvas,
  interactionCanvas,
}) {
  return ({ state }) => {
    let fullBitmap = state[fullField];
    let unitBitmap = state[unitField];
    let scale = state.scale;
    let dpr = pixelRatio();
    let symbolMap = state.symbolMap;
    let symbolLineWidth = state.symbolLineWidth;
    let grid = state.grid;

    function drawFullSymbols() {
      drawSymbols(
        fullSymbolCanvas,
        fullBitmap,
        scale,
        symbolMap,
        symbolLineWidth,
        FULL_PALETTE
      );
    }

    function drawUnitSymbols() {
      drawSymbols(
        unitSymbolCanvas,
        unitBitmap,
        scale,
        symbolMap,
        symbolLineWidth,
        UNIT_PALETTE
      );
    }

    for (const canvas of [fullSymbolCanvas, fullGridCanvas, interactionCanvas]) {
      sizeCanvas(canvas, fullBitmap, scale);
    }
    for (const canvas of [unitSymbolCanvas, unitGridCanvas]) {
      sizeCanvas(canvas, unitBitmap, scale);
    }
    drawFullSymbols();
    drawUnitSymbols();
    drawGrid(fullGridCanvas, fullBitmap, scale, grid);
    drawGrid(unitGridCanvas, unitBitmap, scale, grid);

    return {
      syncState(nextState) {
        const nextFullBitmap = nextState[fullField];
        const nextUnitBitmap = nextState[unitField];
        const scaleChanged = scale !== nextState.scale;
        const nextDpr = pixelRatio();
        const dprChanged = dpr !== nextDpr;
        const fullGeometryChanged = bitmapGeometryChanged(
          fullBitmap,
          nextFullBitmap
        );
        const unitGeometryChanged = bitmapGeometryChanged(
          unitBitmap,
          nextUnitBitmap
        );
        const fullBitmapChanged = fullBitmap !== nextFullBitmap;
        const unitBitmapChanged = unitBitmap !== nextUnitBitmap;
        const symbolStyleChanged =
          symbolMap !== nextState.symbolMap ||
          symbolLineWidth !== nextState.symbolLineWidth;
        const gridChanged = grid !== nextState.grid;

        fullBitmap = nextFullBitmap;
        unitBitmap = nextUnitBitmap;
        scale = nextState.scale;
        dpr = nextDpr;
        symbolMap = nextState.symbolMap;
        symbolLineWidth = nextState.symbolLineWidth;
        grid = nextState.grid;

        if (scaleChanged || dprChanged || fullGeometryChanged) {
          for (const canvas of [
            fullSymbolCanvas,
            fullGridCanvas,
            interactionCanvas,
          ]) {
            sizeCanvas(canvas, fullBitmap, scale);
          }
        }
        if (scaleChanged || dprChanged || unitGeometryChanged) {
          for (const canvas of [unitSymbolCanvas, unitGridCanvas]) {
            sizeCanvas(canvas, unitBitmap, scale);
          }
        }

        if (
          scaleChanged ||
          dprChanged ||
          fullGeometryChanged ||
          fullBitmapChanged ||
          symbolStyleChanged
        ) {
          drawFullSymbols();
        }
        if (
          scaleChanged ||
          dprChanged ||
          unitGeometryChanged ||
          unitBitmapChanged ||
          symbolStyleChanged
        ) {
          drawUnitSymbols();
        }
        if (scaleChanged || dprChanged || fullGeometryChanged || gridChanged) {
          drawGrid(fullGridCanvas, fullBitmap, scale, grid);
        }
        if (scaleChanged || dprChanged || unitGeometryChanged || gridChanged) {
          drawGrid(unitGridCanvas, unitBitmap, scale, grid);
        }
      },
    };
  };
}
