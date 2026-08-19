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

try {
  const stateModule = await server.ssrLoadModule("/src/state.js");
  const {
    resizePatternBitmap,
    startNeedleArrangement,
  } = await server.ssrLoadModule("/src/actions/patternEditing.js");

  const initialNeedle = stateModule.GLOBAL_STATE.needleBitmap;
  resizePatternBitmap("camBitmap", 8, 4);
  assert.deepEqual(
    [stateModule.GLOBAL_STATE.camBitmap.width, stateModule.GLOBAL_STATE.camBitmap.height],
    [8, 4]
  );
  assert.equal(stateModule.GLOBAL_STATE.needleBitmap, initialNeedle);

  startNeedleArrangement();
  assert.deepEqual(
    [stateModule.GLOBAL_STATE.needleBitmap.width, stateModule.GLOBAL_STATE.needleBitmap.height],
    [8, 4]
  );
  assert.notEqual(stateModule.GLOBAL_STATE.needleBitmap, stateModule.GLOBAL_STATE.camBitmap);
  assert.deepEqual(
    Array.from(stateModule.GLOBAL_STATE.needleBitmap.pixels),
    Array.from(stateModule.GLOBAL_STATE.camBitmap.pixels)
  );

  resizePatternBitmap("needleBitmap", 5, 7);
  assert.deepEqual(
    [stateModule.GLOBAL_STATE.needleBitmap.width, stateModule.GLOBAL_STATE.needleBitmap.height],
    [5, 7]
  );
  assert.deepEqual(
    [stateModule.GLOBAL_STATE.camBitmap.width, stateModule.GLOBAL_STATE.camBitmap.height],
    [8, 4]
  );
  assert.equal(stateModule.GLOBAL_STATE.yarnSequence.height, 7);

  console.log("PASS: cam and needle dimensions remain independent.");
} finally {
  await server.close();
}
