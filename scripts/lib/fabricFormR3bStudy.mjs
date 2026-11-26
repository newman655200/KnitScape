import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readJson, sha256, writeJson } from "./fabricFormGolden.mjs";
import { scalars } from "./fabricFormR3aStudy.mjs";
import { analyzeStudy, contactSignature, lengths, thresholds } from "./fabricFormR3bAnalysis.mjs";

export function parseArguments(args) {
  assert.ok((args.length === 2 || args.length === 3 && args[2] === "--resume-interrupted") &&
    args[0] === "--part" && ["forward", "reverse"].includes(args[1]),
  "Usage: npm run study:fabric-form-r3b -- --part forward|reverse [--resume-interrupted]");
  return { part: args[1], resumeInterrupted: args.length === 3 };
}

export function overrideParameters(base, KScale) {
  const params = structuredClone(base);
  params.K = base.K * KScale;
  params.provenance.K = { ...base.provenance.K, value: params.K, confidence: "DIAGNOSTIC_OVERRIDE",
    source: "R3-b task §4", principle: `K scaled by ${KScale}; B unchanged; diagnostic only`,
    applicableState: "R3-b contact-transition diagnosis; not a material value" };
  return params;
}

export function assertBudget(count) {
  assert.ok(Number.isInteger(count) && count >= 0);
  if (count >= thresholds.maxSolves) throw new Error("STOP #4: next solve would exceed 45 counted attempts");
}

function appendSuffix(id, suffix) {
  return id.endsWith("-reverse") ? `${id.slice(0, -8)}-${suffix}-reverse` : `${id}-${suffix}`;
}

function refuseExisting(files) {
  for (const file of files) assert.ok(!fs.existsSync(file), `Refusing overwrite: ${file}`);
}

function resultGuard(row) {
  if (row.status === "INFEASIBLE_INITIAL_GEOMETRY") throw new Error(`STOP #2: ${row.id}: initial geometry infeasible`);
  if (!row.energyConsistency?.passed) throw new Error(`STOP #3: ${row.id}: energy sum inconsistent or unavailable`);
  if (!["CONVERGED", "NOT_CONVERGED", "INFEASIBLE"].includes(row.status))
    throw new Error(`STOP #6: ${row.id}: unexpected solver status ${row.status}`);
  if (!Number.isFinite(row.W) || row.W <= 0 || !Number.isFinite(row.H) || row.H <= 0 || !Number.isFinite(row.S))
    throw new Error(`STOP #2: ${row.id}: no usable terminal cell for continuation`);
  assert.deepEqual(row.contactSignature, contactSignature(row.groups));
}

/** Injected solver and paths keep synthetic checks separate from the registered research. */
export function runStudy({ part, resumeInterrupted = false, archiveRoot, summaryDirectory, sources,
  reusedR3aRows, solve, head, environment, log = console.log }) {
  parseArguments(["--part", part, ...(resumeInterrupted ? ["--resume-interrupted"] : [])]);
  const step = part === "forward" ? "R3b-1" : "R3b-2";
  const ledgerFile = path.join(archiveRoot, "study-ledger.json");
  const studyFile = path.join(archiveRoot, step, "study-manifest.json");
  const summaryFile = path.join(summaryDirectory, "r3b-summary.json");
  const absolute = file => path.resolve(archiveRoot, file);
  for (const l of lengths) for (const denominator of [4, 8, 16, 44]) {
    const rows = reusedR3aRows.filter(row => row.l === l && row.KScale === 1 / denominator);
    assert.equal(rows.length, 1, "One original R3-a result required at every registered reused point");
    assert.equal(rows[0].direction, "forward");
    assert.equal(rows[0].status, "CONVERGED");
    resultGuard(rows[0]);
  }
  let ledger, summary;
  if (part === "forward" && !resumeInterrupted) {
    refuseExisting([ledgerFile, studyFile, summaryFile]);
    ledger = { schemaVersion: 1, status: "RUNNING", maxSolves: 45, totalSolveCount: 0, attempts: [], phases: {} };
    summary = { schemaVersion: 1, status: "RUNNING", part, step, head, runtime: environment, archiveRoot,
      startedAt: new Date().toISOString(), thresholds,
      totalSolveCount: 0, totalInvocationCount: 0, recovery: [],
      verificationPolicy: "Per-input SHA-256 only; no additional file hashes, duplicate solves or performance measurements",
      shearBranchDefinition: "abs(S)/W > 1e-4 (R2 helper)",
      provenance: { value: "Unrounded per-run scalars and analysis; original material provenance retained below",
        unit: { l: "mm", W: "mm", H: "mm", S: "mm", energy: "N*mm", density: "1/cm", kw: "1", kc: "1",
          elapsedMs: "ms", ratios: "1", slope: "1", activePairs: "count", deviation: "%" },
        source: "R3-b task §§2/4; original Hossain inputs; R3-a summary.targets result paths; per-run manifest",
        principle: "Free frictionless T1 continuation; equal-weight three-point log OLS; six forward/reverse geometry and signature pairs",
        confidence: "MODEL_DERIVED_DIAGNOSTIC; not a material measurement",
        applicableState: "T1 N64 frictionless plain jersey; dry-relaxed observations used only as labelled reference" },
      materialParameters: Object.fromEntries(Object.entries(sources).map(([l, source]) => [l, source.params])),
      reusedR3aReferences: reusedR3aRows, runs: [], targets: [], analysis: null, phases: {} };
  } else {
    ledger = readJson(ledgerFile);
    summary = readJson(summaryFile);
    assert.equal(ledger.maxSolves, 45);
    assert.equal(ledger.totalSolveCount, ledger.attempts.filter(attempt => attempt.status !== "INTERRUPTED").length);
    assert.equal(summary.totalSolveCount, ledger.totalSolveCount);
    assert.deepEqual(summary.thresholds, thresholds);
    assert.deepEqual(summary.materialParameters, Object.fromEntries(Object.entries(sources).map(([l, source]) => [l, source.params])));
    assert.deepEqual(summary.reusedR3aReferences, reusedR3aRows);
    assert.ok(![ledger.status, summary.status].includes("STOPPED"), "STOPPED study cannot be resumed automatically");
    if (resumeInterrupted) {
      assert.equal(ledger.status, "RUNNING", "Recovery requires RUNNING, never completed work");
      assert.equal(summary.status, "RUNNING");
      assert.equal(summary.part, part);
      assert.equal(ledger.phases[part]?.status, "RUNNING");
      assert.deepEqual(readJson(studyFile), { ...summary, summaryFile }, "Interruption snapshots disagree");
    } else {
      assert.equal(part, "reverse");
      assert.equal(ledger.status, "FORWARD_COMPLETE", "Forward must complete first; no automatic replay/resume");
      assert.equal(summary.status, "FORWARD_COMPLETE");
      assert.equal(ledger.phases.forward.status, "COMPLETE");
      assert.equal(summary.targets.length, 9);
      refuseExisting([studyFile]);
    }
    // No completed point may be repeated or silently altered during phase changes/recovery.
    for (const attempt of ledger.attempts.filter(item => !["RUNNING", "INTERRUPTED"].includes(item.status))) {
      const row = summary.runs.find(item => item.id === attempt.id);
      assert.ok(row, `Missing completed row ${attempt.id}`);
      const manifest = readJson(absolute(attempt.manifestFile));
      assert.deepEqual(row.manifest, { ...manifest, file: attempt.manifestFile });
      assert.equal(manifest.status, attempt.status);
      const result = readJson(absolute(attempt.resultFile));
      const values = scalars(result, readJson(absolute(attempt.inputFile)).input.params);
      assert.deepEqual(Object.fromEntries(Object.keys(values).map(key => [key, row[key]])), values);
      assert.deepEqual(row.contactSignature, contactSignature(row.groups));
      resultGuard(row);
    }
  }
  const save = () => {
    summary.totalSolveCount = ledger.totalSolveCount;
    summary.totalInvocationCount = ledger.attempts.length;
    summary.phases = structuredClone(ledger.phases);
    writeJson(summaryFile, summary);
    writeJson(studyFile, { ...summary, summaryFile });
    writeJson(ledgerFile, ledger);
  };
  let recoveryPending = null;
  if (resumeInterrupted) {
    const running = ledger.attempts.filter(attempt => attempt.status === "RUNNING");
    assert.equal(running.length, 1, "Recovery requires exactly one saved attempt without a terminal result");
    const attempt = running[0], manifest = readJson(absolute(attempt.manifestFile));
    assert.equal(attempt.part, part);
    assert.equal(manifest.status, "RUNNING");
    assert.equal(manifest.id, attempt.id);
    assert.ok(!manifest.finishedAt && !manifest.error && manifest.elapsedMs === undefined);
    assert.ok(!fs.existsSync(absolute(attempt.resultFile)), "Result exists; refusing to repeat a possibly completed solve");
    assert.ok(!summary.runs.some(row => row.id === attempt.id), "Interrupted row already recorded");
    const savedInput = readJson(absolute(attempt.inputFile)).input;
    const recoveryNumber = summary.recovery.length + 1;
    const resumedId = appendSuffix(attempt.operationKey, `resumed-${recoveryNumber}`);
    refuseExisting(["input", "result", "manifest"].map(suffix => absolute(`${step}/${resumedId}-${suffix}.json`)));
    const snapshotDirectory = absolute(`${step}/interruption-${recoveryNumber}`);
    const snapshots = [[ledgerFile, "study-ledger.json"], [studyFile, "study-manifest.json"], [summaryFile, "r3b-summary.json"]];
    refuseExisting(snapshots.map(([, name]) => path.join(snapshotDirectory, name)));
    fs.mkdirSync(snapshotDirectory, { recursive: true });
    for (const [file, name] of snapshots) fs.copyFileSync(file, path.join(snapshotDirectory, name), fs.constants.COPYFILE_EXCL);
    const recovery = { authority: "R3-b task §4.3; interrupted call with no terminal result is not a failed attempt",
      recordedAt: new Date().toISOString(), head, runtime: environment, snapshotDirectory,
      interruptedAttemptId: attempt.id, resumedAttemptId: resumedId, operationKey: attempt.operationKey,
      originalManifestFile: attempt.manifestFile, originalInputFile: attempt.inputFile,
      originalManifestStatus: "RUNNING", resultFileExistsAtRecovery: false, countedAgainstBudget: false,
      note: "Original input and RUNNING manifest remain unchanged; restart uses the saved input exactly; iteration and elapsed time unknown" };
    attempt.status = "INTERRUPTED";
    attempt.countedAgainstBudget = false;
    ledger.totalSolveCount--;
    summary.recovery.push(recovery);
    summary.runs.push({ id: attempt.id, operationKey: attempt.operationKey, l: manifest.l, direction: manifest.direction,
      KScale: manifest.KScale, target: manifest.target, attempt: manifest.attempt, status: "INTERRUPTED",
      iterations: null, elapsedMs: null, W: null, H: null, S: null, shearBranch: null, contactSignature: null,
      energy: null, energyConsistency: null, groups: null, resultFile: null,
      initialCellSourceFile: manifest.initialCellSourceFile, manifest: { ...manifest, file: attempt.manifestFile },
      interruptionEvidence: recovery });
    recoveryPending = { operationKey: attempt.operationKey, resumedId, savedInput, manifest };
    save();
  } else {
    summary.status = "RUNNING"; summary.part = part; summary.step = step;
    summary.head = head; summary.runtime = environment;
    delete summary.finishedAt;
    ledger.status = "RUNNING";
    ledger.phases[part] = { step, status: "RUNNING", head, startedAt: new Date().toISOString(), studyFile };
    writeJson(studyFile, { ...summary, summaryFile }, { exclusive: true });
    save();
  }
  const outcomeFor = row => ({ row, cell: readJson(absolute(row.resultFile)).cell, file: absolute(row.resultFile) });
  function run(scenario, initial) {
    const operationKey = scenario.id;
    const source = sources[scenario.l], params = overrideParameters(source.params, scenario.KScale);
    let input = { ...structuredClone(source.input), params, initialCell: structuredClone(initial.cell) };
    const completed = summary.runs.filter(row => row.operationKey === operationKey && row.status !== "INTERRUPTED");
    assert.ok(completed.length <= 1, `Duplicate completed operation ${operationKey}`);
    if (completed.length) {
      assert.ok(resumeInterrupted, `Refusing repeat of completed ${operationKey}`);
      assert.deepEqual(readJson(absolute(completed[0].manifest.inputFile)).input, input);
      resultGuard(completed[0]);
      return outcomeFor(completed[0]);
    }
    if (recoveryPending?.operationKey === operationKey) {
      assert.deepEqual(input, recoveryPending.savedInput, "Recovered input must exactly match the registered continuation");
      assert.equal(initial.file, recoveryPending.manifest.initialCellSourceFile);
      input = recoveryPending.savedInput;
      scenario = { ...scenario, id: recoveryPending.resumedId };
      recoveryPending = null;
    }
    assertBudget(ledger.totalSolveCount);
    const inputFile = `${step}/${scenario.id}-input.json`, resultFile = `${step}/${scenario.id}-result.json`;
    const manifestFile = `${step}/${scenario.id}-manifest.json`;
    refuseExisting([inputFile, resultFile, manifestFile].map(absolute));
    const inputText = JSON.stringify({ input }, null, 2) + "\n";
    fs.mkdirSync(path.dirname(absolute(inputFile)), { recursive: true });
    fs.writeFileSync(absolute(inputFile), inputText, { flag: "wx" });
    const manifest = { ...scenario, operationKey, head, runtime: environment, status: "RUNNING", startedAt: new Date().toISOString(),
      sourceInputFile: source.inputFile, initialCellSourceFile: initial.file, inputFile, inputSha256: sha256(inputText),
      resultFile, overrides: { K: params.K }, overrideProvenance: { K: params.provenance.K },
      lockedLattice: input.lockedLattice ?? null, solveNumber: ledger.totalSolveCount + 1,
      invocationNumber: ledger.attempts.length + 1, countedAgainstBudget: true };
    writeJson(absolute(manifestFile), manifest, { exclusive: true });
    const attempt = { id: scenario.id, operationKey, part, solveNumber: manifest.solveNumber,
      invocationNumber: manifest.invocationNumber, countedAgainstBudget: true,
      inputFile, manifestFile, resultFile, status: "RUNNING" };
    ledger.attempts.push(attempt); ledger.totalSolveCount++;
    save();
    log(`START ${scenario.id} direction=${part} solve=${ledger.totalSolveCount}/45`);
    const started = performance.now();
    let result;
    try {
      result = solve(input);
      manifest.elapsedMs = performance.now() - started;
      writeJson(absolute(resultFile), result, { exclusive: true });
    } catch (error) {
      manifest.status = "ERROR"; manifest.error = error.message;
      manifest.elapsedMs = performance.now() - started; manifest.finishedAt = new Date().toISOString();
      attempt.status = "ERROR";
      writeJson(absolute(manifestFile), manifest);
      summary.runs.push({ ...scenario, operationKey, status: "ERROR", iterations: null, elapsedMs: manifest.elapsedMs,
        error: error.message, contactSignature: null, initialCellSourceFile: initial.file,
        manifest: { ...manifest, file: manifestFile }, resultFile: null });
      save();
      throw new Error(`STOP #6: ${scenario.id}: solver exception: ${error.message}`);
    }
    manifest.finishedAt = new Date().toISOString(); manifest.status = result.status; attempt.status = result.status;
    const values = scalars(result, params);
    // Persist every terminal result even if its diagnostics are malformed; then apply stop rules.
    let signature = null;
    try { signature = contactSignature(values.groups); } catch { /* Guard below records the malformed terminal output. */ }
    manifest.contactSignature = signature;
    writeJson(absolute(manifestFile), manifest);
    const row = { ...scenario, operationKey, ...values, elapsedMs: manifest.elapsedMs, overrides: { K: params.K },
      contactSignature: signature, initialCellSourceFile: initial.file, manifest: { ...manifest, file: manifestFile }, resultFile };
    summary.runs.push(row); save();
    log(`DONE ${row.id} ${row.status} iter=${row.iterations} ${(row.elapsedMs / 1000).toFixed(3)}s walePairs=${row.groups.waleSpacing?.activePairs} signature=${JSON.stringify(signature)} shear=${row.shearBranch}`);
    resultGuard(row);
    return { row, cell: result.cell, file: absolute(resultFile) };
  }
  function target(l, denominator, previousDenominator, initial) {
    const KScale = 1 / denominator, previousKScale = 1 / previousDenominator;
    const id = `r3b-${l}-K${KScale}${part === "reverse" ? "-reverse" : ""}`;
    const common = { l, direction: part, KScale, denominator, previousKScale, targetKScale: KScale };
    let outcome = run({ ...common, id, target: true, attempt: "direct" }, initial);
    if (outcome.row.status !== "CONVERGED") {
      const middle = run({ ...common, id: appendSuffix(id, "midpoint"), KScale: Math.sqrt(previousKScale * KScale),
        denominator: null, target: false, attempt: "midpoint" }, initial);
      outcome = run({ ...common, id: appendSuffix(id, "retry"), target: true, attempt: "retry" }, middle);
      if (outcome.row.status !== "CONVERGED") throw new Error(`STOP #2: ${id}: target retry ${outcome.row.status}`);
    }
    const existing = summary.targets.find(row => row.l === l && row.KScale === KScale && row.direction === part);
    if (existing) assert.deepEqual(existing, outcome.row);
    else summary.targets.push(outcome.row);
    save();
    return outcome;
  }
  function original(l, denominator) {
    const row = reusedR3aRows.find(item => item.l === l && item.KScale === 1 / denominator);
    const file = row.source.file, result = readJson(file);
    assert.equal(result.status, "CONVERGED");
    return { cell: result.cell, file };
  }
  try {
    for (const l of lengths) {
      if (part === "forward") {
        const first = target(l, 24, 16, original(l, 16));
        target(l, 32, 24, first);
        target(l, 64, 44, original(l, 44));
      } else {
        const first = target(l, 24, 44, original(l, 44));
        target(l, 16, 24, first);
      }
    }
    assert.equal(recoveryPending, null, "Interrupted operation was not reached");
    summary.analysis = analyzeStudy([...reusedR3aRows, ...summary.targets], part === "reverse");
    summary.status = part === "forward" ? "FORWARD_COMPLETE" : "COMPLETE";
    summary.finishedAt = new Date().toISOString();
    ledger.status = summary.status;
    ledger.phases[part].status = "COMPLETE";
    ledger.phases[part].finishedAt = summary.finishedAt;
    save();
    return summary;
  } catch (error) {
    const message = /^STOP #\d:/.test(error.message) ? error.message : `STOP #6: ${error.message}`;
    summary.status = "STOPPED"; summary.error = message; summary.finishedAt = new Date().toISOString();
    ledger.status = "STOPPED"; ledger.error = message;
    ledger.phases[part].status = "STOPPED"; ledger.phases[part].finishedAt = summary.finishedAt;
    save();
    throw new Error(message, { cause: error });
  }
}
