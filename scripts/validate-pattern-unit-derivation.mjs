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

const derived = derivePatternBitmaps({
  canvasWidth: 7,
  canvasHeight: 9,
  camUnitBitmap: tiledUnit,
  needleUnitBitmap: new Bimp(1, 3, [1, 2, 3]),
});
assert.deepEqual(
  [derived.camBitmap.width, derived.camBitmap.height],
  [7, 9]
);
assert.deepEqual(
  [derived.needleBitmap.width, derived.needleBitmap.height],
  [7, 9]
);

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
      state.GLOBAL_STATE.camBitmap.width,
      state.GLOBAL_STATE.camBitmap.height,
      state.GLOBAL_STATE.needleBitmap.width,
      state.GLOBAL_STATE.needleBitmap.height,
    ],
    [60, 60, 8, 4, 8, 4, 60, 60, 60, 60]
  );

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
  assert.deepEqual(
    state.GLOBAL_STATE.camBitmap.make2d(),
    tileUnitToCanvas(3, 5, loadedCamUnit).make2d()
  );
  assert.deepEqual(
    state.GLOBAL_STATE.needleBitmap.make2d(),
    tileUnitToCanvas(3, 5, loadedNeedleUnit).make2d()
  );

  const dispatchedCamUnit = new SsrBimp(1, 2, [1, 2]);
  state.dispatch({
    canvasWidth: 4,
    canvasHeight: 6,
    camUnitBitmap: dispatchedCamUnit,
  });
  assert.deepEqual(
    [state.GLOBAL_STATE.camBitmap.width, state.GLOBAL_STATE.camBitmap.height],
    [4, 6]
  );
  assert.deepEqual(
    state.GLOBAL_STATE.camBitmap.make2d(),
    tileUnitToCanvas(4, 6, dispatchedCamUnit).make2d()
  );
  assert.deepEqual(observedChanges.at(-1), [
    "canvasWidth",
    "canvasHeight",
    "camUnitBitmap",
    "camBitmap",
    "needleBitmap",
  ]);

  state.undo();
  assert.deepEqual(
    [state.GLOBAL_STATE.canvasWidth, state.GLOBAL_STATE.canvasHeight],
    [3, 5]
  );
  assert.deepEqual(
    state.GLOBAL_STATE.camBitmap.make2d(),
    tileUnitToCanvas(3, 5, loadedCamUnit).make2d()
  );
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
