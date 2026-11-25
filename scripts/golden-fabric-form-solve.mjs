import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { solveFabricCell } from "../src/fabricForm/solveFabricCell.js";
import { archiveRoot, assertCases, currentHead, goldenCases, inputHash, normalizedSolveJson,
  parseGoldenArguments, readInput, readJson, repositoryRoot, runtime, sha256,
  solveBaselineFile, writeJson } from "./lib/fabricFormGolden.mjs";

// Establish once before refactoring; all subsequent invocations only compare.
const options = parseGoldenArguments(process.argv.slice(2), ["--establish-baseline"]);
const establishing = Boolean(options["--establish-baseline"]);
if (establishing) assert.ok(!fs.existsSync(solveBaselineFile), "Refusing to overwrite the solve golden baseline");
const baseline = establishing ? null : readJson(solveBaselineFile);
if (baseline) assertCases(baseline);
const archiveDirectory = options.archiveDirectory ?? path.join(archiveRoot, "R1-0",
  establishing ? "baseline" : `solve-${new Date().toISOString().replace(/[:.]/g, "-")}`);
const report = { schemaVersion: 1, head: currentHead(), runtime: runtime(),
  mode: establishing ? "ESTABLISH_TWO_RUN_BASELINE" : "COMPARE_GOLDEN", archiveDirectory,
  startedAt: new Date().toISOString(), status: "RUNNING", cases: [] };
const reportFile = path.join(archiveDirectory, "solve-report.json");
// Do not reuse an output directory and accidentally replace preserved evidence.
assert.ok(!fs.existsSync(reportFile), `Report already exists: ${reportFile}`);
writeJson(reportFile, report, { exclusive: true });

function run(scenario, round) {
  const filename = path.join(`run-${round}`, `${scenario.id}.json`);
  assert.ok(!fs.existsSync(path.join(archiveDirectory, filename)), `Result already exists: ${filename}`);
  console.log(`START ${scenario.id} run=${round}`);
  const started = performance.now();
  const result = solveFabricCell(readInput(scenario));
  const elapsedMs = performance.now() - started;
  writeJson(path.join(archiveDirectory, filename), result, { exclusive: true });
  const json = normalizedSolveJson(result);
  const row = { resultFile: filename, sha256: sha256(json), status: result.status,
    iterations: result.iterations, evaluations: result.evaluations, elapsedMs,
    W: result.cell.W, H: result.cell.H, S: result.cell.S,
    waleDensityPerCm: result.metrics.waleDensityPerCm, courseDensityPerCm: result.metrics.courseDensityPerCm };
  console.log(`DONE ${scenario.id} run=${round} ${row.status} iter=${row.iterations} ${(elapsedMs / 1000).toFixed(3)}s sha256=${row.sha256}`);
  return { json, row };
}

try {
  for (const [index, scenario] of goldenCases.entries()) {
    const first = run(scenario, 1);
    const record = { id: scenario.id, inputFile: scenario.inputFile, inputSha256: inputHash(scenario), ...first.row };
    report.cases.push(record);
    writeJson(reportFile, report);
    assert.equal(first.row.status, "CONVERGED", `${scenario.id}: expected a converged golden case`);
    if (establishing) {
      const second = run(scenario, 2);
      record.secondRun = second.row;
      record.sameMachineReproducible = first.json === second.json;
      writeJson(reportFile, report);
      assert.ok(record.sameMachineReproducible, `STOP #2: ${scenario.id}: two same-machine solves differ`);
      const historicalJson = normalizedSolveJson(readJson(path.join(repositoryRoot, scenario.historicalResultFile)));
      record.historicalSha256 = sha256(historicalJson);
      record.historicalMatches = first.json === historicalJson;
      console.log(`REPRODUCIBLE ${scenario.id}; historicalMatches=${record.historicalMatches}`);
    } else {
      record.expectedSha256 = baseline.cases[index].sha256;
      record.goldenMatches = record.sha256 === record.expectedSha256;
      writeJson(reportFile, report);
      assert.ok(record.goldenMatches, `STOP #1: ${scenario.id}: solve golden mismatch; do not update the baseline`);
      console.log(`MATCH ${scenario.id}`);
    }
    writeJson(reportFile, report);
  }
  report.status = "PASS";
  report.finishedAt = new Date().toISOString();
  writeJson(reportFile, report);
  if (establishing) {
    writeJson(solveBaselineFile, { schemaVersion: 1, sourceHead: report.head, runtime: report.runtime,
      comparison: "JSON.stringify after removing diagnostics.elapsedMs and top-level closeout",
      archiveDirectory, cases: report.cases }, { exclusive: true });
  }
  console.log(`${report.cases.length}/${goldenCases.length} solve goldens ${establishing ? "reproduced twice and established" : "match"}. Report: ${reportFile}`);
} catch (error) {
  report.status = "FAIL";
  report.error = error.message;
  report.finishedAt = new Date().toISOString();
  writeJson(reportFile, report);
  throw error;
}
