import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createFabricFormParams } from "../src/fabricForm/fabricFormParams.js";
import { solveFabricCell } from "../src/fabricForm/solveFabricCell.js";
import { currentHead, readJson, repositoryRoot, runtime } from "./lib/fabricFormGolden.mjs";
import { scalars } from "./lib/fabricFormR3aStudy.mjs";
import { contactSignature, lengths } from "./lib/fabricFormR3bAnalysis.mjs";
import { parseArguments, runStudy } from "./lib/fabricFormR3bStudy.mjs";

export const archiveRoot = "C:/Users/liuchen/Documents/KnitScape/archives/r3b-transition-2026-11-26";
export const summaryDirectory = path.join(repositoryRoot, "docs/archive/t1-slope-r3b-2026-11-26");

/** Read-only source loading: R3-a target paths are authoritative, including resumed IDs. */
export function loadStudyInputs(outputRoot = archiveRoot) {
  const sourceDirectory = "docs/archive/t1-slope-closeout-2026-11-23";
  const materialKeys = ["tex", "densityGPerCm3", "fiberDiameterMm", "E_f", "K", "phi0"];
  const sources = Object.fromEntries(lengths.map(l => {
    const inputFile = `${sourceDirectory}/step3-hossain-${l}-input.json`;
    const input = readJson(path.join(repositoryRoot, inputFile)).input;
    const params = createFabricFormParams({ ...Object.fromEntries(materialKeys.map(key => [key, input.params[key]])),
      provenance: input.params.provenance });
    assert.deepEqual(params, input.params, "Reconstruction must exactly preserve original material parameters");
    assert.equal(input.topology.nodesPerLoop, 64);
    assert.equal(input.quadratureOrder ?? 12, 12);
    assert.equal(input.maxIterations, 24000);
    assert.equal(input.innerIterations, 800);
    assert.equal(input.memorySize, 180);
    assert.ok(!input.lockedLattice && !input.lockedDimensions, "R3-b requires free W/H/S");
    return [l, { input, params, inputFile }];
  }));
  const r3aSummaryFile = path.join(repositoryRoot, "docs/archive/t1-slope-r3a-2026-11-26/r3a-summary.json");
  const prior = readJson(r3aSummaryFile);
  assert.equal(prior.status, "COMPLETE");
  const reusedR3aRows = [4, 8, 16, 44].flatMap(denominator => lengths.map(l => {
    const matches = prior.targets.filter(row => row.l === l && row.KScale === 1 / denominator);
    assert.equal(matches.length, 1, `One R3-a target required: l=${l}, K=1/${denominator}`);
    const target = matches[0];
    assert.equal(target.status, "CONVERGED");
    const resultFile = path.resolve(prior.archiveRoot, target.resultFile), result = readJson(resultFile);
    assert.equal(result.status, "CONVERGED");
    const values = scalars(result, sources[l].params);
    assert.deepEqual(Object.fromEntries(Object.keys(values).map(key => [key, target[key]])), values,
      `STOP #6: R3-a target ${target.id} differs from its recorded result`);
    assert.ok(values.energyConsistency.passed, `STOP #3: R3-a target ${target.id}: inconsistent energy sum`);
    return { ...target, id: `reused-${target.id}`, reusedFromId: target.id, direction: "forward", denominator,
      contactSignature: contactSignature(values.groups), newSolve: false,
      resultFile: path.relative(outputRoot, resultFile).replaceAll("\\", "/"),
      source: { kind: "REUSED_EXISTING_RESULT_NOT_A_NEW_SOLVE", file: resultFile, inputFile: sources[l].inputFile,
        summaryFile: r3aSummaryFile, r3aArchiveRoot: prior.archiveRoot } };
  }));
  return { sources, reusedR3aRows };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArguments(process.argv.slice(2));
  const summary = runStudy({ ...options, archiveRoot, summaryDirectory, ...loadStudyInputs(),
    solve: solveFabricCell, head: currentHead(), environment: runtime() });
  console.log(JSON.stringify({ part: options.part, status: summary.status, totalSolveCount: summary.totalSolveCount,
    totalInvocationCount: summary.totalInvocationCount, analysis: summary.analysis }, null, 2));
}
