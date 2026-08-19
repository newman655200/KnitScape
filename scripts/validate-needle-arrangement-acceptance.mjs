import assert from "node:assert/strict";
import fs from "node:fs";
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
  const state = await server.ssrLoadModule("/src/state.js");
  const { Bimp } = await server.ssrLoadModule("/src/lib/Bimp.js");
  const actions = await server.ssrLoadModule("/src/actions/patternEditing.js");

  const camBitmap = new Bimp(8, 4, [
    0, 0, 0, 0, 0, 0, 2, 2,
    0, 0, 0, 0, 2, 2, 0, 0,
    0, 0, 2, 2, 0, 0, 0, 0,
    2, 2, 0, 0, 0, 0, 0, 0,
  ]);
  state.loadWorkspace({
    camBitmap,
    needleBitmap: Bimp.empty(3, 2, 1),
    needleInputs: ["1", "2", "3", "4"],
    appliedNeedleInputs: ["1", "2", "3", "4"],
    needleInputErrors: [null, null, null, null],
  });

  assert.equal(actions.applyNeedleArrangement(), true);
  assert.deepEqual(
    [state.GLOBAL_STATE.needleBitmap.width, state.GLOBAL_STATE.needleBitmap.height],
    [4, 8]
  );

  const appliedBitmap = state.GLOBAL_STATE.needleBitmap;
  actions.updateNeedleInput(2, "5");
  assert.equal(actions.applyNeedleArrangement(), false);
  assert.equal(state.GLOBAL_STATE.needleBitmap, appliedBitmap);
  assert.deepEqual(state.GLOBAL_STATE.needleInputErrors, [null, null, "row", null]);

  actions.startNeedleArrangement();
  assert.notEqual(state.GLOBAL_STATE.needleBitmap, state.GLOBAL_STATE.camBitmap);
  assert.deepEqual(
    state.GLOBAL_STATE.needleBitmap.toJSON(),
    state.GLOBAL_STATE.camBitmap.toJSON()
  );

  state.undo();
  assert.deepEqual(
    [state.GLOBAL_STATE.camBitmap.width, state.GLOBAL_STATE.camBitmap.height],
    [8, 4]
  );
  assert.deepEqual(
    [state.GLOBAL_STATE.needleBitmap.width, state.GLOBAL_STATE.needleBitmap.height],
    [3, 2]
  );
  assert.deepEqual(state.GLOBAL_STATE.needleInputs, ["1", "2", "3", "4"]);
  assert.deepEqual(state.GLOBAL_STATE.appliedNeedleInputs, ["1", "2", "3", "4"]);

  const runSimulation = fs.readFileSync("src/components/runSimulation.js", "utf8");
  const drawYarnColors = fs.readFileSync("src/components/drawYarnColors.js", "utf8");
  assert.match(runSimulation, /GLOBAL_STATE\.needleBitmap/);
  assert.doesNotMatch(runSimulation, /GLOBAL_STATE\.camBitmap/);
  assert.match(drawYarnColors, /needleBitmap/);
  assert.doesNotMatch(drawYarnColors, /camBitmap/);

  console.log("PASS: needle arrangement acceptance flow is atomic and preview-owned.");
} finally {
  await server.close();
}
