import assert from "node:assert/strict";
import { createServer } from "vite";

globalThis.Path2D = class {
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  closePath() {}
  rect() {}
};

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

function dimensions(bitmap) {
  return [bitmap.width, bitmap.height];
}

function bitmapJSON(bitmap) {
  return bitmap.toJSON();
}

try {
  const state = await server.ssrLoadModule("/src/state.js");
  const { Bimp } = await server.ssrLoadModule("/src/lib/Bimp.js");
  const {
    applyNeedleArrangement,
    drawPatternLine,
    normalizeCanvasDimension,
    resizePatternCanvas,
    startNeedleArrangement,
    updateNeedleInput,
  } = await server.ssrLoadModule("/src/actions/patternEditing.js");

  const camUnitBitmap = new Bimp(8, 4, [
    0, 1, 2, 3, 0, 1, 2, 3,
    3, 2, 1, 0, 3, 2, 1, 0,
    1, 1, 2, 2, 3, 3, 0, 0,
    2, 0, 3, 1, 2, 0, 3, 1,
  ]);
  const needleUnitBitmap = new Bimp(2, 3, [3, 2, 1, 0, 3, 2]);
  const yarnSequence = new Bimp(1, 2, [2, 1]);
  state.loadWorkspace({
    canvasWidth: 60,
    canvasHeight: 60,
    camUnitBitmap,
    needleUnitBitmap,
    yarnSequence,
    activeYarn: 3,
    activeSymbol: 2,
    needleInputs: ["1", "2", "3", "4"],
    appliedNeedleInputs: ["4", "3", "2", "1"],
    needleInputErrors: ["row", null, "characters", "empty"],
  });

  const camUnitBeforeResize = bitmapJSON(state.GLOBAL_STATE.camUnitBitmap);
  const needleUnitBeforeResize = bitmapJSON(state.GLOBAL_STATE.needleUnitBitmap);
  resizePatternCanvas(72, 81);
  assert.deepEqual(
    [state.GLOBAL_STATE.canvasWidth, state.GLOBAL_STATE.canvasHeight],
    [72, 81]
  );
  assert.deepEqual(bitmapJSON(state.GLOBAL_STATE.camUnitBitmap), camUnitBeforeResize);
  assert.deepEqual(
    bitmapJSON(state.GLOBAL_STATE.needleUnitBitmap),
    needleUnitBeforeResize
  );
  assert.deepEqual(dimensions(state.GLOBAL_STATE.camBitmap), [72, 81]);
  assert.deepEqual(dimensions(state.GLOBAL_STATE.needleBitmap), [72, 81]);
  assert.deepEqual(Array.from(state.GLOBAL_STATE.yarnSequence.pixels), [
    2,
    1,
    ...Array(79).fill(3),
  ]);

  assert.equal(normalizeCanvasDimension("72"), 72);
  assert.equal(normalizeCanvasDimension(81), 81);
  assert.equal(normalizeCanvasDimension("0"), 5);
  assert.equal(normalizeCanvasDimension("501"), 500);
  assert.equal(normalizeCanvasDimension("4.9"), 5);
  assert.equal(normalizeCanvasDimension("499.9"), 499);
  assert.equal(normalizeCanvasDimension("999"), 500);
  assert.equal(normalizeCanvasDimension(""), 5);
  assert.equal(normalizeCanvasDimension(Number.NaN), 5);
  resizePatternCanvas("4", "999");
  assert.deepEqual(
    [state.GLOBAL_STATE.canvasWidth, state.GLOBAL_STATE.canvasHeight],
    [5, 500]
  );
  resizePatternCanvas(72, 81);

  const camUnitBeforeInvalidDraw = state.GLOBAL_STATE.camUnitBitmap;
  const camBitmapBeforeInvalidDraw = state.GLOBAL_STATE.camBitmap;
  const patternEditBeforeInvalidDraw = state.GLOBAL_STATE.patternEdit;
  for (const [startPos, endPos] of [
    [{ x: -1, y: 0 }, { x: 0, y: 0 }],
    [{ x: 8, y: 0 }, { x: 0, y: 0 }],
    [{ x: 0, y: 4 }, { x: 0, y: 0 }],
    [{ x: 0, y: 0 }, { x: 8, y: 0 }],
    [{ x: 0, y: 0 }, { x: 0, y: 4 }],
    [{ x: 0.5, y: 0 }, { x: 0, y: 0 }],
    [{ x: 0, y: 0 }, { x: Number.NaN, y: 0 }],
  ]) {
    assert.equal(drawPatternLine("camUnitBitmap", startPos, endPos), false);
    assert.equal(state.GLOBAL_STATE.camUnitBitmap, camUnitBeforeInvalidDraw);
    assert.equal(state.GLOBAL_STATE.camBitmap, camBitmapBeforeInvalidDraw);
    assert.equal(state.GLOBAL_STATE.patternEdit, patternEditBeforeInvalidDraw);
  }
  assert.throws(
    () => drawPatternLine("camBitmap", { x: 0, y: 0 }, { x: 0, y: 0 }),
    /Unknown pattern bitmap field/
  );
  assert.throws(
    () => drawPatternLine("unknownBitmap", { x: 0, y: 0 }, { x: 0, y: 0 }),
    /Unknown pattern bitmap field/
  );

  const camBitmapBeforeDraw = state.GLOBAL_STATE.camBitmap;
  const legalStart = { x: 0, y: 0 };
  const legalEnd = { x: 0, y: 0 };
  assert.equal(drawPatternLine("camUnitBitmap", legalStart, legalEnd), true);
  assert.notEqual(state.GLOBAL_STATE.camUnitBitmap, camUnitBeforeInvalidDraw);
  assert.notEqual(state.GLOBAL_STATE.camBitmap, camBitmapBeforeDraw);
  assert.equal(state.GLOBAL_STATE.camUnitBitmap.pixel(0, 0), 2);
  assert.equal(state.GLOBAL_STATE.camBitmap.pixel(0, 0), 2);
  assert.notEqual(state.GLOBAL_STATE.patternEdit.startPos, legalStart);
  assert.notEqual(state.GLOBAL_STATE.patternEdit.endPos, legalEnd);

  const needleBitmapBeforeDraw = state.GLOBAL_STATE.needleBitmap;
  assert.equal(
    drawPatternLine("needleUnitBitmap", { x: 1, y: 2 }, { x: 1, y: 2 }),
    true
  );
  assert.notEqual(state.GLOBAL_STATE.needleBitmap, needleBitmapBeforeDraw);
  assert.equal(state.GLOBAL_STATE.needleUnitBitmap.pixel(1, 2), 2);

  const needleInputsBeforeStart = [...state.GLOBAL_STATE.needleInputs];
  const appliedInputsBeforeStart = [...state.GLOBAL_STATE.appliedNeedleInputs];
  const errorsBeforeStart = [...state.GLOBAL_STATE.needleInputErrors];
  const yarnSequenceBeforeStart = state.GLOBAL_STATE.yarnSequence;
  startNeedleArrangement();
  assert.deepEqual(dimensions(state.GLOBAL_STATE.needleUnitBitmap), [8, 4]);
  assert.notEqual(state.GLOBAL_STATE.needleUnitBitmap, state.GLOBAL_STATE.camUnitBitmap);
  assert.deepEqual(
    bitmapJSON(state.GLOBAL_STATE.needleUnitBitmap),
    bitmapJSON(state.GLOBAL_STATE.camUnitBitmap)
  );
  assert.deepEqual(dimensions(state.GLOBAL_STATE.camBitmap), [72, 81]);
  assert.deepEqual(dimensions(state.GLOBAL_STATE.needleBitmap), [72, 81]);
  assert.deepEqual(state.GLOBAL_STATE.needleInputs, needleInputsBeforeStart);
  assert.deepEqual(state.GLOBAL_STATE.appliedNeedleInputs, appliedInputsBeforeStart);
  assert.deepEqual(state.GLOBAL_STATE.needleInputErrors, errorsBeforeStart);
  assert.equal(state.GLOBAL_STATE.yarnSequence, yarnSequenceBeforeStart);

  const yarnSequenceBeforeApply = state.GLOBAL_STATE.yarnSequence;
  assert.equal(applyNeedleArrangement(), true);
  assert.deepEqual(dimensions(state.GLOBAL_STATE.needleUnitBitmap), [4, 8]);
  assert.deepEqual(dimensions(state.GLOBAL_STATE.needleBitmap), [72, 81]);
  assert.equal(state.GLOBAL_STATE.yarnSequence, yarnSequenceBeforeApply);
  assert.deepEqual(state.GLOBAL_STATE.appliedNeedleInputs, ["1", "2", "3", "4"]);
  assert.deepEqual(state.GLOBAL_STATE.needleInputErrors, [null, null, null, null]);

  updateNeedleInput(2, "5");
  const needleUnitBeforeInvalidApply = state.GLOBAL_STATE.needleUnitBitmap;
  const needleBitmapBeforeInvalidApply = state.GLOBAL_STATE.needleBitmap;
  const appliedInputsBeforeInvalidApply = [...state.GLOBAL_STATE.appliedNeedleInputs];
  const canvasBeforeInvalidApply = [
    state.GLOBAL_STATE.canvasWidth,
    state.GLOBAL_STATE.canvasHeight,
  ];
  const yarnBeforeInvalidApply = state.GLOBAL_STATE.yarnSequence;
  assert.equal(applyNeedleArrangement(), false);
  assert.equal(state.GLOBAL_STATE.needleUnitBitmap, needleUnitBeforeInvalidApply);
  assert.equal(state.GLOBAL_STATE.needleBitmap, needleBitmapBeforeInvalidApply);
  assert.deepEqual(state.GLOBAL_STATE.appliedNeedleInputs, appliedInputsBeforeInvalidApply);
  assert.deepEqual(
    [state.GLOBAL_STATE.canvasWidth, state.GLOBAL_STATE.canvasHeight],
    canvasBeforeInvalidApply
  );
  assert.equal(state.GLOBAL_STATE.yarnSequence, yarnBeforeInvalidApply);
  assert.deepEqual(state.GLOBAL_STATE.needleInputErrors, [null, null, "row", null]);

  state.dispatch({ lastSnapshot: 0 });
  const camUnitBeforeUndo = state.GLOBAL_STATE.camUnitBitmap;
  const needleUnitBeforeUndo = state.GLOBAL_STATE.needleUnitBitmap;
  const canvasBeforeUndo = [state.GLOBAL_STATE.canvasWidth, state.GLOBAL_STATE.canvasHeight];
  assert.equal(drawPatternLine("camUnitBitmap", { x: 1, y: 1 }, { x: 1, y: 1 }), true);
  state.undo();
  assert.equal(state.GLOBAL_STATE.camUnitBitmap, camUnitBeforeUndo);
  assert.equal(state.GLOBAL_STATE.needleUnitBitmap, needleUnitBeforeUndo);
  assert.deepEqual(
    [state.GLOBAL_STATE.canvasWidth, state.GLOBAL_STATE.canvasHeight],
    canvasBeforeUndo
  );
  assert.deepEqual(dimensions(state.GLOBAL_STATE.camBitmap), canvasBeforeUndo);
  assert.deepEqual(dimensions(state.GLOBAL_STATE.needleBitmap), canvasBeforeUndo);

  state.loadWorkspace({
    camUnitBitmap: Bimp.empty(8, 3, 1),
    needleInputs: ["4", "4", "4", "4"],
    needleInputErrors: [null, null, null, null],
  });
  assert.equal(
    applyNeedleArrangement(),
    false,
    "needle input rows must be checked against the cam repeat-unit height"
  );
  assert.deepEqual(state.GLOBAL_STATE.needleInputErrors, ["row", "row", "row", "row"]);

  console.log("PASS: pattern actions mutate repeat units and canvas dimensions only.");
} finally {
  await server.close();
}
