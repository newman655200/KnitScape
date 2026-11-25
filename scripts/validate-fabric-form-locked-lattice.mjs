import assert from "node:assert/strict";
import { createPlainJerseyTopology } from "../src/fabricForm/fabricFormTopology.js";
import { createFabricFormParams } from "../src/fabricForm/fabricFormParams.js";
import { createFabricFormInitialGeometry } from "../src/fabricForm/fabricFormInitialGeometry.js";
import { solveFabricCell } from "../src/fabricForm/solveFabricCell.js";

const started = performance.now();
const topology = createPlainJerseyTopology({ nodesPerLoop: 16, loopLengthMm: 3 });
const params = createFabricFormParams();
const initialCell = createFabricFormInitialGeometry(topology, params);
const input = { topology, params, initialCell };
const invalid = extra => solveFabricCell({ ...input, maxIterations: 1, ...extra });
assert.throws(() => invalid({ lockedDimensions: { W: 1, H: 1 }, lockedLattice: { W: 1 } }), TypeError);
for (const lockedLattice of [null, [], {}, { S: 1 }, { W: 1, S: 1 }]) {
  assert.throws(() => invalid({ lockedLattice }), TypeError);
}
for (const value of [-1, 0, NaN, Infinity, "1", undefined]) {
  assert.throws(() => invalid({ lockedLattice: { W: value } }), RangeError);
  assert.throws(() => invalid({ lockedLattice: { H: value } }), RangeError);
}
console.log("PASS lockedLattice input validation");

function run(id, extra = {}) {
  const result = solveFabricCell({ ...input, ...extra });
  console.log(JSON.stringify({ id, status: result.status, iterations: result.iterations,
    elapsedMs: result.diagnostics.elapsedMs, W: result.cell.W, H: result.cell.H, S: result.cell.S,
    energy: result.energy.total, F_W: result.equilibrium.F_W }));
  assert.equal(result.status, "CONVERGED", id);
  return result;
}
const free = run("free-N16");
const atEquilibrium = run("locked-W-star-N16", { initialCell: free.cell, lockedLattice: { W: free.cell.W } });
const energyRelativeDifference = Math.abs(atEquilibrium.energy.total / free.energy.total - 1);
const reactionRatio = Math.abs(atEquilibrium.equilibrium.F_W) * free.cell.W / atEquilibrium.energy.total;
console.log(JSON.stringify({ energyRelativeDifference, reactionRatio }));
assert.ok(energyRelativeDifference <= 1e-8, "STOP #2: locked W* energy differs from free solution");
assert.ok(reactionRatio <= 1e-6, "STOP #2: locked W* reaction exceeds equilibrium threshold");
assert.equal(atEquilibrium.cell.W, free.cell.W);
assert.equal(atEquilibrium.mode, "LOCKED_LATTICE");
assert.deepEqual(atEquilibrium.lockedComponents, ["W"]);
assert.ok(!("R_W" in atEquilibrium.equilibrium));
assert.ok("R_H" in atEquilibrium.equilibrium && "R_S" in atEquilibrium.equilibrium);

const dimensions = { W: initialCell.W, H: initialCell.H };
const legacy = run("locked-dimensions-N16", { lockedDimensions: dimensions });
const both = run("locked-WH-N16", { lockedLattice: dimensions });
for (const key of ["cell", "energy", "history", "iterations"]) {
  assert.deepEqual(both[key], legacy[key], `W/H lock preserves ${key} exactly`);
}
assert.deepEqual(both.lockedComponents, ["W", "H"]);
assert.equal(both.equilibrium.F_W, legacy.equilibrium.F_W);
assert.equal(both.equilibrium.F_H, legacy.equilibrium.F_H);
assert.ok("R_S" in both.equilibrium);

const width = run("locked-W-relax-N16", { lockedLattice: { W: initialCell.W } });
assert.equal(width.cell.W, initialCell.W);
assert.notEqual(width.cell.H, initialCell.H);
assert.notEqual(width.cell.S, initialCell.S);
// 0.9 / 3 * 3 is not bit-identical to 0.9: catch normalization drift in partial locks.
for (const component of ["W", "H"]) {
  const result = invalid({ lockedLattice: { [component]: 0.9 } });
  assert.equal(result.cell[component], 0.9);
  assert.equal(result.mode, "LOCKED_LATTICE");
}
const height = invalid({ lockedLattice: { H: initialCell.H } });
assert.equal(height.cell.H, initialCell.H);
assert.deepEqual(height.lockedComponents, ["H"]);
assert.ok("R_W" in height.equilibrium && "R_S" in height.equilibrium && "F_H" in height.equilibrium);
console.log(`PASS lockedLattice acceptance in ${((performance.now() - started) / 1000).toFixed(3)} s`);
