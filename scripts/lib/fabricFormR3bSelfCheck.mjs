import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createFabricFormParams } from "../../src/fabricForm/fabricFormParams.js";
import { readJson, writeJson } from "./fabricFormGolden.mjs";
import { energyConsistency, scalars } from "./fabricFormR3aStudy.mjs";
import { shearBranchFor } from "./fabricFormR2Continuation.mjs";
import { analyzeLevel, analyzeStudy, analyzeHysteresis, analyzePlatform, classifyPlatform, classifyHysteresis,
  contactGroups, contactSignature, lengths } from "./fabricFormR3bAnalysis.mjs";
import { assertBudget, overrideParameters, parseArguments, runStudy } from "./fabricFormR3bStudy.mjs";
import { renderR3bReport } from "./fabricFormR3bReport.mjs";

const baseParams = createFabricFormParams({ K: 0.01 });
function fakeResult(input, status = "CONVERGED") {
  const l = input.topology.loopLengthMm, KScale = input.params.K / baseParams.K;
  const W = l ** 1.1, H = l ** 0.8;
  const groups = Object.fromEntries(contactGroups.map(name => [name,
    { activePairs: name === "waleSpacing" ? Number(KScale >= 1 / 24) : 2, minDistanceOverDe: 0.9 }]));
  return { status, iterations: 4, cell: { W, H, S: 0, syntheticKScale: KScale, syntheticOnly: true },
    metrics: { waleDensityPerCm: 10 / W, courseDensityPerCm: 10 / H, kw: l / W, kc: l / H },
    energy: { total: 4, bending: 3, contact: 1, barrier: 0, barrierFraction: 0 },
    diagnostics: { contact: { minDistanceOverDe: 0.9, activePairs: Object.values(groups).reduce((sum, g) => sum + g.activePairs, 0), groups } } };
}

function harness(directory) {
  const archiveRoot = path.join(directory, "archive"), summaryDirectory = path.join(directory, "summary");
  const sources = Object.fromEntries(lengths.map(l => [l, { params: structuredClone(baseParams),
    inputFile: `SYNTHETIC-ONLY-${l}`, input: { params: structuredClone(baseParams), topology: { loopLengthMm: l, nodesPerLoop: 64 },
      maxIterations: 24000, innerIterations: 800, memorySize: 180, untouchedNumericsMarker: "SYNTHETIC ONLY" } }]));
  const reusedR3aRows = [4, 8, 16, 44].flatMap(denominator => lengths.map(l => {
    const result = fakeResult({ ...sources[l].input, params: overrideParameters(baseParams, 1 / denominator) });
    const file = path.join(directory, "synthetic-prior", `${l}-${denominator}.json`);
    writeJson(file, result, { exclusive: true });
    const values = scalars(result, baseParams);
    return { id: `synthetic-reused-${l}-${denominator}`, l, denominator, KScale: 1 / denominator,
      direction: "forward", ...values, contactSignature: contactSignature(values.groups),
      source: { file, kind: "SYNTHETIC_ONLY" }, resultFile: path.relative(archiveRoot, file) };
  }));
  return { archiveRoot, summaryDirectory, sources, reusedR3aRows, head: "SYNTHETIC_ONLY", environment: { test: true } };
}

function analysisChecks() {
  assert.equal(classifyPlatform(0.15), "脱开后存在稳定平台");
  assert.equal(classifyPlatform(0.30), "脱开后无稳定平台");
  assert.equal(classifyPlatform(0.1500000001), "不确定");
  assert.equal(classifyPlatform(0.2999999999), "不确定");
  assert.equal(classifyPlatform(0.1, false), "不确定（状态混合）");
  const pairs = Array.from({ length: 6 }, () => ({ relativeW: 1e-4, relativeH: 1e-4, sameSignature: true }));
  assert.equal(classifyHysteresis(pairs), "无迟滞（同一平衡）");
  pairs[0].relativeW = 1e-2;
  assert.equal(classifyHysteresis(pairs), "存在迟滞或多解");
  pairs[0].relativeW = 1e-4; pairs[0].relativeH = 0.02;
  assert.equal(classifyHysteresis(pairs), "不确定", "H-only large difference is not a positive hysteresis criterion");
  pairs[0].sameSignature = false;
  assert.equal(classifyHysteresis(pairs), "存在迟滞或多解");
  assert.throws(() => classifyHysteresis(pairs.slice(1)), /six/);
  assert.equal(shearBranchFor({ W: 1, S: 1e-4 }), false);
  assert.equal(shearBranchFor({ W: 1, S: 1.00001e-4 }), true);
  assert.ok(energyConsistency({ total: 1, bending: 1e-6, contact: 1, barrier: 0 }).passed);
  assert.ok(!energyConsistency({ total: 1, bending: 1.001e-6, contact: 1, barrier: 0 }).passed);
  assert.ok(energyConsistency({ total: 0, bending: 0, contact: 0, barrier: 0 }).passed);
  assert.ok(!energyConsistency({ total: 0, bending: 1, contact: 0, barrier: 0 }).passed);
  assertBudget(44); assert.throws(() => assertBudget(45), /STOP #4/);
  assert.deepEqual(parseArguments(["--part", "reverse", "--resume-interrupted"]), { part: "reverse", resumeInterrupted: true });
  assert.throws(() => parseArguments(["--part", "other"]), /Usage/);
}

export function selfCheck(root) {
  fs.mkdirSync(root, { recursive: true });
  analysisChecks();
  const quiet = { log: () => {} };
  const normal = harness(path.join(root, "normal"));
  const calls = [];
  const solve = input => { calls.push(structuredClone(input)); return fakeResult(input); };
  const forward = runStudy({ ...normal, ...quiet, part: "forward", solve });
  assert.equal(forward.status, "FORWARD_COMPLETE");
  assert.equal(forward.totalSolveCount, 9);
  assert.equal(forward.targets.length, 9);
  assert.deepEqual(calls.map(input => input.initialCell.syntheticKScale), lengths.flatMap(() => [1 / 16, 1 / 24, 1 / 44]));
  assert.throws(() => runStudy({ ...normal, ...quiet, part: "forward", solve }), /Refusing overwrite/);
  assert.equal(calls.length, 9);
  const finished = runStudy({ ...normal, ...quiet, part: "reverse", solve });
  assert.equal(finished.totalSolveCount, 15);
  assert.equal(finished.targets.length, 15);
  assert.equal(finished.analysis.hysteresis.pairs.length, 6);
  assert.equal(finished.analysis.hysteresis.interpretation, "无迟滞（同一平衡）");
  const forwardReport = renderR3bReport(forward);
  assert.ok(forwardReport.includes("反向研究尚未完成"));
  const finalReport = renderR3bReport(finished, { includeJudgments: true, includeOverview: true });
  for (const fragment of ["## 1. 正向链", "## 2. 反向链与迟滞对照", "## 3. 判读", "## 4. 局限与来源",
    "无迟滞（同一平衡）", "Applicable state", "Measurement / derivation principle", "DIAGNOSTIC_OVERRIDE"])
    assert.ok(finalReport.includes(fragment), `Missing report text ${fragment}`);
  writeJson(path.join(root, "report-check.json"), { status: "PASS", syntheticOnly: true,
    forwardCharacters: forwardReport.length, finalCharacters: finalReport.length }, { exclusive: true });
  assert.deepEqual(calls.slice(9).map(input => input.initialCell.syntheticKScale), lengths.flatMap(() => [1 / 44, 1 / 24]));
  assert.ok(finished.runs.filter(row => row.direction === "reverse").every(row => row.id.endsWith("-reverse")));
  for (const input of calls) {
    const l = input.topology.loopLengthMm, base = normal.sources[l].input;
    assert.deepEqual({ ...input, params: base.params, initialCell: undefined }, { ...base, initialCell: undefined });
    assert.deepEqual({ ...input.params, K: baseParams.K, provenance: baseParams.provenance }, baseParams);
    for (const key of ["value", "unit", "source", "principle", "confidence", "applicableState"])
      assert.ok(input.params.provenance.K[key] !== undefined);
  }
  assert.throws(() => runStudy({ ...normal, ...quiet, part: "reverse", solve }), /Forward must complete first/);
  assert.throws(() => runStudy({ ...normal, ...quiet, part: "reverse", resumeInterrupted: true, solve }), /Recovery requires RUNNING/);
  const rows = [...finished.reusedR3aReferences, ...finished.targets];
  const mixed = structuredClone(rows);
  mixed.find(row => row.direction === "forward" && row.denominator === 32).groups.sameLoop.activePairs = 0;
  assert.equal(analyzeStudy(mixed, true).platform.interpretation, "不确定（状态混合）");
  assert.equal(analyzeLevel(mixed, 32, "forward").descriptiveOnly, true);
  const shear = structuredClone(rows);
  shear.find(row => row.direction === "forward" && row.denominator === 64).shearBranch = true;
  assert.equal(analyzeStudy(shear, true).platform.interpretation, "不确定（状态混合）");
  assert.equal(analyzeHysteresis(shear).pairs.length, 6);
  const changed = structuredClone(rows);
  const reverse = changed.find(row => row.direction === "reverse" && row.denominator === 24);
  reverse.groups.sameLoop.activePairs = 0;
  reverse.energy.total = 5;
  const hysteresis = analyzeHysteresis(changed);
  assert.equal(hysteresis.interpretation, "存在迟滞或多解");
  assert.equal(hysteresis.pairs[0].energy.lower, "forward");
  assert.equal(analyzeStudy(changed, true).transitions.reverse.length, 3);
  const fit = finished.analysis.fits.find(row => row.denominator === 44);
  assert.ok(Math.abs(fit.wale.slope + 1.1) < 1e-12 && Math.abs(fit.course.slope + 0.8) < 1e-12);
  assert.ok(fit.wale.sse < 1e-24);
  const unstable = structuredClone(finished.analysis.fits);
  unstable.find(row => row.denominator === 64).wale.slope += 0.5;
  assert.equal(analyzePlatform(unstable).interpretation, "脱开后无稳定平台");

  const retries = harness(path.join(root, "all-retries"));
  let count = 0;
  const retryInputs = [];
  const retrySolve = input => {
    retryInputs.push(structuredClone(input));
    return fakeResult(input, ++count % 3 === 0 ? "CONVERGED" : count % 3 === 1 ? "INFEASIBLE" : "NOT_CONVERGED");
  };
  runStudy({ ...retries, ...quiet, part: "forward", solve: retrySolve });
  const retried = runStudy({ ...retries, ...quiet, part: "reverse", solve: retrySolve });
  assert.equal(count, 45); assert.equal(retried.totalSolveCount, 45);
  assert.equal(retried.targets.length, 15);
  assert.equal(retryInputs[1].params.K, baseParams.K * Math.sqrt(1 / 16 * (1 / 24)));
  assert.equal(retryInputs[2].initialCell.syntheticKScale, retryInputs[1].params.K / baseParams.K);
  assert.ok(retried.runs.filter(row => row.direction === "reverse").every(row => row.id.endsWith("-reverse")));

  for (const mode of ["retry-failure", "initial-infeasible", "bad-energy", "exception"]) {
    const options = harness(path.join(root, mode));
    let n = 0;
    const failedSolve = input => {
      n++;
      if (mode === "exception") throw new Error("synthetic exception");
      const result = fakeResult(input, mode === "retry-failure" ? "NOT_CONVERGED" :
        mode === "initial-infeasible" ? "INFEASIBLE_INITIAL_GEOMETRY" : "CONVERGED");
      if (mode === "bad-energy") result.energy.total += 1;
      if (mode === "initial-infeasible") { result.energy = null; result.cell = null; }
      return result;
    };
    const expected = mode === "bad-energy" ? /STOP #3/ : mode === "exception" ? /STOP #6/ : /STOP #2/;
    assert.throws(() => runStudy({ ...options, ...quiet, part: "forward", solve: failedSolve }), expected);
    assert.equal(n, mode === "retry-failure" ? 3 : 1);
    assert.throws(() => runStudy({ ...options, ...quiet, part: "forward", resumeInterrupted: true, solve }), /STOPPED/);
  }

  // Actual child-process exits exercise persistence without invoking the physical solver.
  for (const mode of ["direct", "midpoint", "retry", "reverse"]) {
    const options = harness(path.join(root, `interrupt-${mode}`));
    const part = mode === "reverse" ? "reverse" : "forward";
    if (part === "reverse") runStudy({ ...options, ...quiet, part: "forward", solve: fakeResult });
    const optionsFile = path.join(root, `interrupt-${mode}`, "options.json");
    writeJson(optionsFile, options, { exclusive: true });
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--interrupt-child", optionsFile, mode], { encoding: "utf8" });
    assert.equal(child.status, 75, child.stderr);
    const ledgerFile = path.join(options.archiveRoot, "study-ledger.json");
    const before = readJson(ledgerFile), interrupted = before.attempts.find(row => row.status === "RUNNING");
    assert.ok(interrupted);
    const manifestPath = path.join(options.archiveRoot, interrupted.manifestFile);
    const originalManifest = fs.readFileSync(manifestPath, "utf8");
    const originalInput = readJson(path.join(options.archiveRoot, interrupted.inputFile)).input;
    const completedFiles = before.attempts.filter(row => row.status === "CONVERGED")
      .map(row => [path.join(options.archiveRoot, row.resultFile), fs.readFileSync(path.join(options.archiveRoot, row.resultFile), "utf8")]);
    const resumedInputs = [];
    const recovered = runStudy({ ...options, ...quiet, part, resumeInterrupted: true,
      solve: input => { resumedInputs.push(structuredClone(input)); return fakeResult(input); } });
    assert.deepEqual(resumedInputs[0], originalInput);
    assert.equal(fs.readFileSync(manifestPath, "utf8"), originalManifest);
    for (const [file, value] of completedFiles) assert.equal(fs.readFileSync(file, "utf8"), value);
    assert.equal(recovered.recovery.length, 1);
    assert.equal(recovered.totalInvocationCount, recovered.totalSolveCount + 1);
    assert.ok(fs.existsSync(path.join(recovered.recovery[0].snapshotDirectory, "r3b-summary.json")));
    assert.equal(recovered.runs.filter(row => row.status === "INTERRUPTED").length, 1);
    if (part === "reverse") assert.ok(recovered.recovery[0].resumedAttemptId.endsWith("-reverse"));
    const completedBefore = before.attempts.filter(row => !["RUNNING", "INTERRUPTED"].includes(row.status)).length;
    assert.equal(resumedInputs.length, recovered.totalSolveCount - completedBefore);
  }
  const evidence = { status: "PASS", syntheticOnly: true, physicalSolverCalls: 0,
    checks: ["inclusive platform/hysteresis thresholds", "H-only positive criterion exclusion", "four-group contact signatures",
      "mixed-state/shear slope exclusion", "all six hysteresis pairs and energy", "log OLS and transitions",
      "registered forward/reverse initial sources", "K-only six-field override and numeric preservation",
      "direct failures, unconverged midpoint and single retry", "45 counted attempts", "stop #2/#3/#4/#6",
      "overwrite/STOPPED/completed replay rejection", "real process interruption at direct/midpoint/retry/reverse",
      "saved-input recovery, original manifest and completed results preserved, interruption budget exemption",
      "four-section report, phased output and six-field provenance"],
    outputDirectory: root };
  writeJson(path.join(root, "self-check-result.json"), evidence, { exclusive: true });
  console.log(JSON.stringify(evidence, null, 2));
  return evidence;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === "--interrupt-child") {
    const options = readJson(process.argv[3]), mode = process.argv[4];
    let count = 0;
    runStudy({ ...options, part: mode === "reverse" ? "reverse" : "forward", log: () => {}, solve: input => {
      count++;
      if (count === (mode === "retry" ? 3 : 2)) process.exit(75);
      return fakeResult(input, ["midpoint", "retry"].includes(mode) ? "NOT_CONVERGED" : "CONVERGED");
    } });
  } else {
    assert.ok(process.argv.length === 3, "Usage: node scripts/lib/fabricFormR3bSelfCheck.mjs <new output directory>");
    selfCheck(path.resolve(process.argv[2]));
  }
}
