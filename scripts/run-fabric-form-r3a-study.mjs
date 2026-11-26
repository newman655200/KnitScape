import assert from "node:assert/strict";
import path from "node:path";
import { createFabricFormParams } from "../src/fabricForm/fabricFormParams.js";
import { solveFabricCell } from "../src/fabricForm/solveFabricCell.js";
import { currentHead, readJson, repositoryRoot, runtime } from "./lib/fabricFormGolden.mjs";
import { parseArguments, runStudy, scalars } from "./lib/fabricFormR3aStudy.mjs";

const part = parseArguments(process.argv.slice(2));
const resumeInterrupted = process.argv.slice(2).includes("--resume-interrupted");
const archiveRoot = "C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26";
const r2Root = "C:/Users/liuchen/Documents/KnitScape/archives/r2-slope-2026-11-25";
const sourceDirectory = "docs/archive/t1-slope-closeout-2026-11-23";
const summaryDirectory = path.join(repositoryRoot, "docs/archive/t1-slope-r3a-2026-11-26");
const materialKeys = ["tex", "densityGPerCm3", "fiberDiameterMm", "E_f", "K", "phi0"];
const sources = Object.fromEntries([2.77, 2.84, 2.9].map(l => {
  const inputFile = `${sourceDirectory}/step3-hossain-${l}-input.json`;
  const input = readJson(path.join(repositoryRoot, inputFile)).input;
  // Rebuild from the ORIGINAL source; R2 K*0.5 supplies only its converged cell.
  const params = createFabricFormParams({ ...Object.fromEntries(materialKeys.map(key => [key, input.params[key]])),
    provenance: input.params.provenance });
  assert.deepEqual(params, input.params, "Reconstruction must exactly preserve original material parameters");
  assert.equal(input.topology.nodesPerLoop, 64);
  assert.equal(input.quadratureOrder ?? 12, 12);
  assert.equal(input.maxIterations, 24000);
  assert.equal(input.innerIterations, 800);
  assert.equal(input.memorySize, 180);
  assert.ok(!input.lockedLattice && !input.lockedDimensions, "R3-a requires free W/H/S");
  const initialCellSourceFile = path.join(r2Root, `R2-3/qc-${l}-K0.5-result.json`);
  const reference = readJson(initialCellSourceFile);
  assert.equal(reference.status, "CONVERGED");
  return [l, { input, params, inputFile, initialCellSourceFile, reference }];
}));
const r2Rows = part === "chain" ? [2, 1, 0.5].flatMap(KScale => [2.77, 2.84, 2.9].map(l => {
  const source = sources[l];
  const resultFile = KScale === 1 ? path.join(repositoryRoot, `${sourceDirectory}/step3-hossain-${l}-after.json`) :
    path.join(r2Root, `R2-3/qc-${l}-K${KScale}-result.json`);
  const result = readJson(resultFile);
  assert.equal(result.status, "CONVERGED");
  const row = { id: `reused-${l}-K${KScale}`, l, KScale, ...scalars(result, source.params), elapsedMs: null,
    resultFile: path.relative(archiveRoot, resultFile).replaceAll("\\", "/"),
    source: { kind: "REUSED_EXISTING_RESULT_NOT_A_NEW_SOLVE", file: resultFile, inputFile: source.inputFile } };
  assert.ok(row.energyConsistency.passed, `STOP #4: reused ${row.id}: inconsistent energy sum`);
  return row;
})) : [];
const summary = runStudy({ part, resumeInterrupted, archiveRoot, summaryDirectory, sources, r2Rows,
  solve: solveFabricCell, head: currentHead(), environment: runtime() });
console.log(JSON.stringify({ part, status: summary.status, totalSolveCount: summary.totalSolveCount, analysis: summary.analysis }, null, 2));
