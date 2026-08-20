import assert from "node:assert/strict";
import { createServer } from "vite";
import {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_UNIT_HEIGHT,
  DEFAULT_UNIT_WIDTH,
  derivePatternBitmaps,
  tileUnitToCanvas,
} from "../src/patternDerivation.js";
import { Bimp } from "../src/lib/Bimp.js";

assert.deepEqual(
  [
    DEFAULT_CANVAS_WIDTH,
    DEFAULT_CANVAS_HEIGHT,
    DEFAULT_UNIT_WIDTH,
    DEFAULT_UNIT_HEIGHT,
  ],
  [60, 60, 8, 4]
);

const tiledUnit = new Bimp(2, 2, [0, 1, 2, 3]);
assert.deepEqual(tileUnitToCanvas(3, 5, tiledUnit).make2d(), [
  [2, 3, 2],
  [0, 1, 0],
  [2, 3, 2],
  [0, 1, 0],
  [2, 3, 2],
]);

function assertDerivedPatternBitmaps(state) {
  const expectedCamBitmap = tileUnitToCanvas(
    state.canvasWidth,
    state.canvasHeight,
    state.camUnitBitmap
  );
  const expectedNeedleBitmap = tileUnitToCanvas(
    state.canvasWidth,
    state.canvasHeight,
    state.needleUnitBitmap
  );

  assert.deepEqual(
    [state.camBitmap.width, state.camBitmap.height],
    [state.canvasWidth, state.canvasHeight]
  );
  assert.deepEqual(
    [state.needleBitmap.width, state.needleBitmap.height],
    [state.canvasWidth, state.canvasHeight]
  );
  assert.deepEqual(state.camBitmap.make2d(), expectedCamBitmap.make2d());
  assert.deepEqual(
    state.needleBitmap.make2d(),
    expectedNeedleBitmap.make2d()
  );
  assert.notEqual(state.camBitmap, state.camUnitBitmap);
  assert.notEqual(state.needleBitmap, state.needleUnitBitmap);
  assert.notEqual(state.camBitmap, state.needleBitmap);
}

const needleUnit = new Bimp(1, 3, [1, 2, 3]);
const derived = derivePatternBitmaps({
  canvasWidth: 7,
  canvasHeight: 9,
  camUnitBitmap: tiledUnit,
  needleUnitBitmap: needleUnit,
});
assertDerivedPatternBitmaps({
  canvasWidth: 7,
  canvasHeight: 9,
  camUnitBitmap: tiledUnit,
  needleUnitBitmap: needleUnit,
  ...derived,
});

globalThis.Path2D = class {
  constructor() {}
};

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const [state, constants, { Bimp: SsrBimp }] = await Promise.all([
    server.ssrLoadModule("/src/state.js"),
    server.ssrLoadModule("/src/constants.js"),
    server.ssrLoadModule("/src/lib/Bimp.js"),
  ]);

  assert.deepEqual(
    [
      state.GLOBAL_STATE.canvasWidth,
      state.GLOBAL_STATE.canvasHeight,
      state.GLOBAL_STATE.camUnitBitmap.width,
      state.GLOBAL_STATE.camUnitBitmap.height,
      state.GLOBAL_STATE.needleUnitBitmap.width,
      state.GLOBAL_STATE.needleUnitBitmap.height,
    ],
    [60, 60, 8, 4, 8, 4]
  );
  assertDerivedPatternBitmaps(state.GLOBAL_STATE);

  const observedChanges = [];
  state.StateMonitor.register([
    () => ({
      syncState(_nextState, changes) {
        observedChanges.push(changes);
      },
    }),
  ]);

  const loadedCamUnit = new SsrBimp(2, 2, [0, 1, 2, 3]);
  const loadedNeedleUnit = new SsrBimp(1, 1, [3]);
  state.loadWorkspace({
    canvasWidth: 3,
    canvasHeight: 5,
    camUnitBitmap: loadedCamUnit,
    needleUnitBitmap: loadedNeedleUnit,
  });
  assertDerivedPatternBitmaps(state.GLOBAL_STATE);

  const snapshotCamUnit = new SsrBimp(1, 2, [1, 2]);
  const snapshotNeedleUnit = new SsrBimp(1, 2, [3, 0]);
  state.dispatch({
    canvasWidth: 4,
    canvasHeight: 6,
    camUnitBitmap: snapshotCamUnit,
    needleUnitBitmap: snapshotNeedleUnit,
  });
  assert.equal(state.GLOBAL_STATE.snapshots.length, 1);
  assertDerivedPatternBitmaps(state.GLOBAL_STATE);
  assert.deepEqual(observedChanges.at(-1), [
    "canvasWidth",
    "canvasHeight",
    "camUnitBitmap",
    "needleUnitBitmap",
    "camBitmap",
    "needleBitmap",
  ]);

  state.dispatch({ lastSnapshot: Date.now() });
  const snapshotCount = state.GLOBAL_STATE.snapshots.length;
  const normalCamUnit = new SsrBimp(2, 1, [2, 1]);
  const normalNeedleUnit = new SsrBimp(2, 1, [0, 3]);
  state.dispatch({
    canvasWidth: 5,
    canvasHeight: 3,
    camUnitBitmap: normalCamUnit,
    needleUnitBitmap: normalNeedleUnit,
  });
  assert.equal(state.GLOBAL_STATE.snapshots.length, snapshotCount);
  assertDerivedPatternBitmaps(state.GLOBAL_STATE);
  assert.deepEqual(observedChanges.at(-1), [
    "canvasWidth",
    "canvasHeight",
    "camUnitBitmap",
    "needleUnitBitmap",
    "camBitmap",
    "needleBitmap",
  ]);
  assert.throws(
    () =>
      assertDerivedPatternBitmaps({
        ...state.GLOBAL_STATE,
        needleBitmap: state.GLOBAL_STATE.camBitmap,
      }),
    assert.AssertionError
  );

  state.undo();
  assert.deepEqual(
    [state.GLOBAL_STATE.canvasWidth, state.GLOBAL_STATE.canvasHeight],
    [3, 5]
  );
  assertDerivedPatternBitmaps(state.GLOBAL_STATE);
  for (const field of [
    "canvasWidth",
    "canvasHeight",
    "camUnitBitmap",
    "needleUnitBitmap",
    "camBitmap",
    "needleBitmap",
  ]) {
    assert.ok(observedChanges.at(-1).includes(field));
  }

  for (const sourceField of [
    "canvasWidth",
    "canvasHeight",
    "camUnitBitmap",
    "needleUnitBitmap",
  ]) {
    assert.ok(constants.SNAPSHOT_FIELDS.includes(sourceField));
  }
  for (const derivedField of ["camBitmap", "needleBitmap"]) {
    assert.equal(constants.SNAPSHOT_FIELDS.includes(derivedField), false);
  }
} finally {
  await server.close();
}

console.log("PASS: canvas charts are derived from repeat-unit state.");
