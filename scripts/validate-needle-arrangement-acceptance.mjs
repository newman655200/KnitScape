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
  const punchcard = await server.ssrLoadModule("/src/punchcard.js");

  const camUnitBitmap = new Bimp(8, 4, [
    0, 0, 0, 0, 0, 0, 2, 2,
    0, 0, 0, 0, 2, 2, 0, 0,
    0, 0, 2, 2, 0, 0, 0, 0,
    2, 2, 0, 0, 0, 0, 0, 0,
  ]);
  const yarnSequence = new Bimp(1, 81, Array.from({ length: 81 }, (_, row) => row % 4));
  state.loadWorkspace({
    canvasWidth: 72,
    canvasHeight: 81,
    camUnitBitmap,
    needleUnitBitmap: Bimp.empty(3, 2, 1),
    yarnSequence,
    needleInputs: ["1", "2", "3", "4"],
    appliedNeedleInputs: ["1", "2", "3", "4"],
    needleInputErrors: [null, null, null, null],
    punchVerticalRepeats: 5,
  });

  assert.equal(punchcard.punchcardRowCount(), 405);

  assert.equal(actions.applyNeedleArrangement(), true);
  assert.deepEqual(
    [state.GLOBAL_STATE.needleUnitBitmap.width, state.GLOBAL_STATE.needleUnitBitmap.height],
    [4, 8]
  );
  assert.deepEqual(
    [state.GLOBAL_STATE.needleBitmap.width, state.GLOBAL_STATE.needleBitmap.height],
    [72, 81]
  );
  assert.equal(state.GLOBAL_STATE.yarnSequence, yarnSequence);
  assert.equal(punchcard.punchcardRowCount(), 405);

  const appliedUnit = state.GLOBAL_STATE.needleUnitBitmap;
  const appliedBitmap = state.GLOBAL_STATE.needleBitmap;
  actions.updateNeedleInput(2, "5");
  assert.equal(actions.applyNeedleArrangement(), false);
  assert.equal(state.GLOBAL_STATE.needleUnitBitmap, appliedUnit);
  assert.equal(state.GLOBAL_STATE.needleBitmap, appliedBitmap);
  assert.deepEqual(state.GLOBAL_STATE.needleInputErrors, [null, null, "row", null]);
  assert.equal(state.GLOBAL_STATE.yarnSequence, yarnSequence);
  assert.equal(punchcard.punchcardRowCount(), 405);

  state.undo();
  assert.deepEqual(
    [state.GLOBAL_STATE.camUnitBitmap.width, state.GLOBAL_STATE.camUnitBitmap.height],
    [8, 4]
  );
  assert.deepEqual(
    [state.GLOBAL_STATE.needleUnitBitmap.width, state.GLOBAL_STATE.needleUnitBitmap.height],
    [3, 2]
  );
  assert.deepEqual(
    [state.GLOBAL_STATE.needleBitmap.width, state.GLOBAL_STATE.needleBitmap.height],
    [72, 81]
  );
  assert.deepEqual(state.GLOBAL_STATE.needleInputs, ["1", "2", "3", "4"]);
  assert.deepEqual(state.GLOBAL_STATE.appliedNeedleInputs, ["1", "2", "3", "4"]);
  assert.deepEqual(state.GLOBAL_STATE.needleInputErrors, [null, null, null, null]);

  actions.startNeedleArrangement();
  assert.notEqual(state.GLOBAL_STATE.needleUnitBitmap, state.GLOBAL_STATE.camUnitBitmap);
  assert.deepEqual(
    state.GLOBAL_STATE.needleUnitBitmap.toJSON(),
    state.GLOBAL_STATE.camUnitBitmap.toJSON()
  );
  assert.deepEqual(
    [state.GLOBAL_STATE.needleBitmap.width, state.GLOBAL_STATE.needleBitmap.height],
    [72, 81]
  );
  assert.deepEqual(state.GLOBAL_STATE.appliedNeedleInputs, ["1", "2", "3", "4"]);
  assert.deepEqual(state.GLOBAL_STATE.needleInputErrors, [null, null, null, null]);
  assert.equal(punchcard.punchcardRowCount(), 405);

  const runSimulation = fs.readFileSync("src/components/runSimulation.js", "utf8");
  const drawYarnColors = fs.readFileSync("src/components/drawYarnColors.js", "utf8");
  assert.match(runSimulation, /GLOBAL_STATE\.needleBitmap/);
  assert.doesNotMatch(runSimulation, /GLOBAL_STATE\.camBitmap/);
  assert.match(drawYarnColors, /needleBitmap/);
  assert.doesNotMatch(drawYarnColors, /camBitmap/);

  console.log("PASS: needle arrangement updates its repeat unit while preview remains canvas-derived.");
} finally {
  await server.close();
}
