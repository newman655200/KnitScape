import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readJson, sha256, writeJson } from "./fabricFormGolden.mjs";
import { fitLogDensity } from "./fabricFormR2Analysis.mjs";
import { shearBranchFor } from "./fabricFormR2Continuation.mjs";

// Registered in R3-a §§2/4/8; the sole explicit interruption recovery is recorded in §10.
const lengths = [2.77, 2.84, 2.9];
const targetScales = [1 / 4, 1 / 8, 1 / 16, 1 / 44];
const energyKeys = ["total", "bending", "contact", "barrier"];
const thresholds = Object.freeze({ equivalence: 1e-5, energySum: 1e-6, maxSolves: 37,
  shearBranch: 1e-4, consistentSlope: -0.9, insufficientSlope: -0.6, extrapolatedSlope: -1.1 });

export function parseArguments(args) {
  const resume = args.length === 3 && args[1] === "chain" && args[2] === "--resume-interrupted";
  assert.ok((args.length === 2 || resume) && args[0] === "--part" && ["equivalence", "chain"].includes(args[1]),
    "Usage: npm run study:fabric-form-r3a -- --part equivalence|chain [--resume-interrupted only for the authorised chain interruption]");
  return args[1];
}

export function energyConsistency(energy) {
  if (!energyKeys.every(key => Number.isFinite(energy?.[key])))
    return { passed: false, sum: null, difference: null, relativeDifference: null, reason: "Non-finite/missing energy" };
  const sum = energy.bending + energy.contact + energy.barrier, difference = sum - energy.total;
  return { passed: Math.abs(difference) <= Math.abs(energy.total) * thresholds.energySum, sum, difference,
    relativeDifference: energy.total === 0 ? null : Math.abs(difference / energy.total), threshold: thresholds.energySum };
}

export function scalars(result, params) {
  const contact = result.diagnostics?.contact ?? {}, cell = result.cell ?? {}, metrics = result.metrics ?? {};
  const barrierSupportThreshold = params.r_c / params.d_e + 0.1 * (1 - params.r_c / params.d_e);
  const minDistanceOverDe = contact.minDistanceOverDe ?? null;
  return { status: result.status, iterations: result.iterations ?? null,
    W: cell.W ?? null, H: cell.H ?? null, S: cell.S ?? null,
    shearBranch: Number.isFinite(cell.W) && cell.W > 0 && Number.isFinite(cell.S) ? shearBranchFor(cell) : null,
    waleDensityPerCm: metrics.waleDensityPerCm ?? null, courseDensityPerCm: metrics.courseDensityPerCm ?? null,
    kw: metrics.kw ?? null, kc: metrics.kc ?? null,
    energy: Object.fromEntries([...energyKeys, "barrierFraction"].map(key => [key, result.energy?.[key] ?? null])),
    energyConsistency: energyConsistency(result.energy), minDistanceOverDe, activePairs: contact.activePairs ?? null,
    groups: Object.fromEntries(Object.entries(contact.groups ?? {}).map(([name, group]) => [name,
      { activePairs: group.activePairs ?? null, minDistanceOverDe: group.minDistanceOverDe ?? null }])),
    barrierSupportThreshold, barrierSupportFormula: "minDistanceOverDe < r_c/d_e + 0.1*(1-r_c/d_e) OR barrier > 0",
    barrierSupport: (minDistanceOverDe !== null && minDistanceOverDe < barrierSupportThreshold) || (result.energy?.barrier ?? 0) > 0 };
}

export function compareEquivalence(i, ii) {
  const geometry = Object.fromEntries(["W", "H"].map(key => [key,
    { relativeDifference: Math.abs(ii[key] - i[key]) / Math.abs(i[key]), denominator: i[key] }]));
  geometry.S = { absoluteDifferenceOverW: Math.abs(ii.S - i.S) / i.W, denominatorW: i.W };
  const density = Object.fromEntries(["waleDensityPerCm", "courseDensityPerCm"].map(key => [key,
    { i: i[key], ii: ii[key], relativeDifference: Math.abs(ii[key] - i[key]) / Math.abs(i[key]) }]));
  const energy = Object.fromEntries(energyKeys.map(key => {
    const first = i.energy[key], second = ii.energy[key], expected = 4 * first;
    const absoluteResidual = Math.abs(second - expected), finite = Number.isFinite(first) && Number.isFinite(second);
    return [key, { i: first, ii: second, expectedIi: expected,
      ratio: first === 0 ? null : second / first,
      absoluteResidual, relativeDifferenceFromFour: expected === 0 ? null : absoluteResidual / Math.abs(expected),
      passed: finite && absoluteResidual <= Math.abs(expected) * thresholds.equivalence,
      note: first === 0 && second === 0 ? "Both exactly zero: strictly satisfies the homogeneous equation 0 = 4*0; ratio and relative difference are undefined." :
        first === 0 ? "Zero to nonzero fails the homogeneous equation; ratio is undefined." : "abs(E_ii-4*E_i) <= abs(4*E_i)*1e-5" }];
  }));
  return { passed: geometry.W.relativeDifference <= thresholds.equivalence &&
    geometry.H.relativeDifference <= thresholds.equivalence && geometry.S.absoluteDifferenceOverW <= thresholds.equivalence &&
    Object.values(energy).every(item => item.passed), threshold: thresholds.equivalence, geometry, density, energy,
    barrierFraction: { i: i.energy.barrierFraction, ii: ii.energy.barrierFraction,
      note: "Dimensionless energy share; recorded, not multiplied by four or treated as an energy term" },
    iterations: { i: i.iterations, ii: ii.iterations }, iterationDifferenceIsFailure: false };
}

export function classifySlope(slope, mixedBranch) {
  return mixedBranch ? "不确定（分支混合）" : slope <= thresholds.consistentSlope ? "一致" :
    slope >= thresholds.insufficientSlope ? "不足以解释" : "不确定";
}

export function analyzeChain(rows) {
  const fits = [2, 1, 0.5, ...targetScales].map(KScale => {
    const data = lengths.map(l => {
      const matches = rows.filter(row => row.KScale === KScale && row.l === l && row.status === "CONVERGED");
      assert.equal(matches.length, 1, `One converged target required: K=${KScale}, l=${l}`);
      return matches[0];
    });
    const middle = data[1], mixedBranch = data.some(row => row.shearBranch);
    return { KScale, wale: fitLogDensity(data, "waleDensityPerCm"), course: fitLogDensity(data, "courseDensityPerCm"),
      mixedBranch, branchNote: mixedBranch ? "混合分支，仅描述" : "对称分支",
      dryRelaxedDeviation: { l: 2.84, state: "参照为干放松态", referenceWaleDensityPerCm: 30.8 / 2.54,
        referenceCourseDensityPerCm: 45.9 / 2.54, waleDensityPerCm: middle.waleDensityPerCm,
        courseDensityPerCm: middle.courseDensityPerCm,
        walePercent: 100 * (middle.waleDensityPerCm / (30.8 / 2.54) - 1),
        coursePercent: 100 * (middle.courseDensityPerCm / (45.9 / 2.54) - 1),
        formula: "100*(model / dry-relaxed observation - 1)" } };
  });
  const dbWaleDlnKIntervals = fits.slice(1).map((fit, index) => ({ fromKScale: fits[index].KScale, toKScale: fit.KScale,
    value: (fit.wale.slope - fits[index].wale.slope) / Math.log(fit.KScale / fits[index].KScale) }));
  const primary = fits.at(-1);
  return { fits, dbWaleDlnKIntervals,
    monotonicWaleSlope: dbWaleDlnKIntervals.every(row => row.value >= 0) || dbWaleDlnKIntervals.every(row => row.value <= 0),
    extrapolation: { extrapolatedSlope: thresholds.extrapolatedSlope, solvedSlope: primary.wale.slope,
      difference: primary.wale.slope - thresholds.extrapolatedSlope, purpose: "Descriptive difference, no pass/fail criterion" },
    primary: { KScale: 1 / 44, b_wale: primary.wale.slope, mixedBranch: primary.mixedBranch,
      interpretation: classifySlope(primary.wale.slope, primary.mixedBranch),
      premise: "充分放松态约 -1，待 D0 检验。本判读只说明模型能否到达 -1，不说明真实面料的斜率是多少。" },
    limitation: "诊断，不是标定；不得据此选择、调整或推荐 K、B 或其他参数。" };
}

function overrideParameters(base, { KScale, BScale = 1 }) {
  const params = structuredClone(base), overrides = BScale !== 1 ? { B: base.B * BScale } : { K: base.K * KScale };
  for (const [key, value] of Object.entries(overrides)) {
    params[key] = value;
    params.provenance[key] = { ...params.provenance[key], value, confidence: "DIAGNOSTIC_OVERRIDE",
      source: "R3-a task §4", principle: key === "K" ? `K scaled by ${KScale}; B unchanged; diagnostic only` :
        `B scaled by ${BScale}; K unchanged; diagnostic only`, applicableState: "R3-a stiffness-ratio diagnosis; not a material value" };
  }
  return { params, overrides };
}

// One accepted external interruption, not a general resume mechanism. Validate everything before mutation.
function interruptedRecovery({ ledger, equivalence, archiveRoot, summaryFile, studyFile, ledgerFile, sources, r2Rows, head, environment }) {
  assert.equal(ledger.status, "RUNNING", "Interrupted resume requires RUNNING, never STOPPED or COMPLETE");
  assert.equal(ledger.phases.equivalence.status, "COMPLETE");
  assert.equal(ledger.phases.chain.status, "RUNNING");
  assert.equal(ledger.maxSolves, 37);
  assert.equal(ledger.totalSolveCount, 11, "Only the registered 11-attempt interruption may resume");
  const completedChainIds = [...targetScales.map(scale => `r3a-2.77-K${scale}`),
    ...targetScales.slice(1).map(scale => `r3a-2.84-K${scale}`), "r3a-2.9-K0.25"];
  const ids = ["r3a-2.84-K0.25", "equivalence-2.84-B4", ...completedChainIds, "r3a-2.9-K0.125"];
  assert.deepEqual(ledger.attempts.map(row => row.id), ids, "Interrupted attempt IDs differ from the accepted snapshot");
  ledger.attempts.forEach((row, index) => {
    const prefix = index < 2 ? "R3a-1" : "R3a-2";
    assert.deepEqual(row, { id: ids[index], solveNumber: index + 1, part: index < 2 ? "equivalence" : "chain",
      inputFile: `${prefix}/${ids[index]}-input.json`, manifestFile: `${prefix}/${ids[index]}-manifest.json`,
      resultFile: `${prefix}/${ids[index]}-result.json`, status: index < 10 ? "CONVERGED" : "RUNNING" },
    "Interrupted ledger does not match the accepted snapshot");
  });
  const summary = readJson(summaryFile), study = readJson(studyFile);
  assert.equal(summary.status, "RUNNING");
  assert.equal(summary.part, "chain");
  assert.equal(summary.totalSolveCount, 11);
  assert.equal(summary.analysis, null);
  assert.ok(!summary.recovery && !summary.error && !summary.finishedAt, "No previous recovery or stop is accepted");
  assert.deepEqual(study, { ...summary, summaryFile }, "Interrupted study/summary snapshot mismatch");
  assert.deepEqual(summary.thresholds, thresholds);
  assert.deepEqual(summary.materialParameters, Object.fromEntries(Object.entries(sources).map(([l, source]) => [l, source.params])));
  assert.deepEqual(summary.reusedR2References, r2Rows);
  assert.deepEqual(summary.runs.map(row => row.id), completedChainIds);
  assert.deepEqual(summary.targets.map(row => row.id), [...targetScales.map(scale => `r3a-2.77-K${scale}`),
    ...targetScales.map(scale => `r3a-2.84-K${scale}`), "r3a-2.9-K0.25"]);
  const completed = [...equivalence.runs, ...summary.runs];
  assert.equal(completed.length, 10);
  completed.forEach((row, index) => {
    const attempt = ledger.attempts[index];
    assert.equal(row.id, attempt.id);
    assert.equal(row.status, "CONVERGED");
    assert.equal(row.resultFile, attempt.resultFile);
    assert.deepEqual(row.manifest, { ...readJson(path.join(archiveRoot, attempt.manifestFile)), file: attempt.manifestFile });
    assert.equal(row.manifest.solveNumber, index + 1);
    const result = readJson(path.join(archiveRoot, attempt.resultFile));
    assert.equal(result.status, "CONVERGED");
    const values = scalars(result, sources[row.l].params);
    assert.deepEqual(Object.fromEntries(Object.keys(values).map(key => [key, row[key]])), values,
      `Completed row ${row.id} differs from its saved result`);
  });
  for (const row of summary.targets) {
    const expected = row.id === "r3a-2.84-K0.25" ? { ...equivalence.targets[0], reusedFromPart: "equivalence", newSolve: false } :
      summary.runs.find(run => run.id === row.id);
    assert.deepEqual(row, expected, "Completed targets differ from saved runs");
  }
  const attempt = ledger.attempts[10], manifest = readJson(path.join(archiveRoot, attempt.manifestFile));
  for (const [key, value] of Object.entries({ id: ids[10], l: 2.9, KScale: 0.125, BScale: 1, target: true,
    attempt: "direct", solveNumber: 11, status: "RUNNING", inputFile: attempt.inputFile, resultFile: attempt.resultFile }))
    assert.equal(manifest[key], value, `Interrupted manifest ${key} mismatch`);
  assert.ok(!manifest.finishedAt && manifest.elapsedMs === undefined && !manifest.error);
  assert.ok(!fs.existsSync(path.join(archiveRoot, attempt.resultFile)), "Interrupted result already exists; refusing resume");
  const source = sources[2.9], initialFile = path.join(archiveRoot, "R3a-2/r3a-2.9-K0.25-result.json");
  assert.equal(manifest.initialCellSourceFile, initialFile);
  assert.equal(manifest.sourceInputFile, source.inputFile);
  const initialCell = readJson(initialFile).cell;
  const { params, overrides } = overrideParameters(source.params, { KScale: 0.125, BScale: 1 });
  const savedInput = readJson(path.join(archiveRoot, attempt.inputFile)).input;
  assert.deepEqual(savedInput, { ...source.input, params, initialCell }, "Interrupted input differs from the registered source and prior target cell");
  assert.deepEqual(manifest.overrides, overrides);
  assert.deepEqual(manifest.overrideProvenance, { K: params.provenance.K });
  const resumedId = `${attempt.id}-resumed`;
  for (const suffix of ["input", "manifest", "result"])
    assert.ok(!fs.existsSync(path.join(archiveRoot, `R3a-2/${resumedId}-${suffix}.json`)), "Resumed files already exist; refusing overwrite");
  const snapshotDirectory = path.join(archiveRoot, "R3a-2/interruption-2026-11-26");
  const snapshots = [[ledgerFile, "study-ledger.json"], [studyFile, "study-manifest.json"], [summaryFile, "r3a-summary.json"]];
  for (const [, name] of snapshots) assert.ok(!fs.existsSync(path.join(snapshotDirectory, name)), "Interruption snapshot already exists; refusing overwrite");
  fs.mkdirSync(snapshotDirectory, { recursive: true });
  for (const [file, name] of snapshots) fs.copyFileSync(file, path.join(snapshotDirectory, name), fs.constants.COPYFILE_EXCL);
  const recovery = { authorisedBy: "User explicit 继续 after process interruption; R3-a §10 (2026-11-26)",
    recordedAt: new Date().toISOString(), head, runtime: environment, snapshotDirectory,
    interruptedAttemptId: attempt.id, resumedAttemptId: resumedId, originalManifestStatus: manifest.status,
    originalManifestFile: attempt.manifestFile, resultFileExistsAtRecovery: false,
    note: "Original per-run input and RUNNING manifest preserved unchanged. No terminal geometry, iteration count or elapsed time is available." };
  Object.assign(attempt, { status: "INTERRUPTED", originalManifestStatus: manifest.status, resultFileExistsAtRecovery: false,
    recoverySnapshotDirectory: snapshotDirectory });
  summary.recovery = recovery;
  summary.runs.push({ id: attempt.id, l: 2.9, KScale: 0.125, BScale: 1, target: true, attempt: "direct",
    status: "INTERRUPTED", observedStatus: "INTERRUPTED", iterations: null, elapsedMs: null,
    W: null, H: null, S: null, shearBranch: null, waleDensityPerCm: null, courseDensityPerCm: null, kw: null, kc: null,
    energy: Object.fromEntries([...energyKeys, "barrierFraction"].map(key => [key, null])), energyConsistency: null,
    minDistanceOverDe: null, activePairs: null, groups: null, barrierSupport: null, barrierSupportThreshold: null,
    overrides, initialCellSourceFile: manifest.initialCellSourceFile, manifest: { ...manifest, file: attempt.manifestFile },
    resultFile: null, interruptionEvidence: recovery });
  ledger.phases.chain.recovery = recovery;
  return { summary, savedInput, resumedId };
}

/** Fixed R3-a workflow; injectable solve and output paths permit synthetic checks without physical solves. */
export function runStudy({ part, resumeInterrupted = false, archiveRoot, summaryDirectory, sources, r2Rows, solve, head, environment, log = console.log }) {
  parseArguments(["--part", part, ...(resumeInterrupted ? ["--resume-interrupted"] : [])]);
  const step = part === "equivalence" ? "R3a-1" : "R3a-2";
  const ledgerFile = path.join(archiveRoot, "study-ledger.json");
  const studyFile = path.join(archiveRoot, step, "study-manifest.json");
  const summaryFile = path.join(summaryDirectory, part === "equivalence" ? "equivalence-summary.json" : "r3a-summary.json");
  if (!resumeInterrupted) for (const file of [studyFile, summaryFile]) assert.ok(!fs.existsSync(file), `Refusing overwrite: ${file}`);
  let ledger, equivalence;
  if (part === "equivalence") {
    assert.ok(!fs.existsSync(ledgerFile), `Refusing overwrite: ${ledgerFile}; no automatic resume`);
    ledger = { schemaVersion: 1, status: "RUNNING", maxSolves: thresholds.maxSolves, totalSolveCount: 0, attempts: [], phases: {} };
  } else {
    ledger = readJson(ledgerFile);
    if (!resumeInterrupted) assert.equal(ledger.status, "EQUIVALENCE_COMPLETE", `Cannot start chain: ledger ${ledger.status}; no automatic resume`);
    equivalence = readJson(path.join(summaryDirectory, "equivalence-summary.json"));
    assert.ok(equivalence.status === "COMPLETE" && equivalence.analysis?.passed, "Successful equivalence required before chain");
    assert.equal(ledger.totalSolveCount, ledger.attempts.length, "Ledger count mismatch; do not resume");
  }
  const recovery = resumeInterrupted ? interruptedRecovery({ ledger, equivalence, archiveRoot, summaryFile, studyFile, ledgerFile,
    sources, r2Rows, head, environment }) : null;
  const summary = recovery?.summary ?? { schemaVersion: 1, part, step, head, runtime: environment, archiveRoot,
    startedAt: new Date().toISOString(), status: "RUNNING", thresholds, totalSolveCount: ledger.totalSolveCount,
    verificationPolicy: "Only each new input JSON receives SHA-256; no extra file hashes, duplicate solves or performance study",
    shearBranchDefinition: "abs(S)/W > 1e-4 (R2 helper)",
    provenance: { values: "Unrounded per-run scalars and analysis; original material provenance retained below",
      units: { l: "mm", W: "mm", H: "mm", S: "mm", energy: "N*mm", density: "1/cm", kw: "1", kc: "1",
        elapsedMs: "ms", ratios: "1", slope: "1", activePairs: "count", deviation: "%" },
      source: "R3-a task §§2/4; per-run source inputs and R2 QC result files",
      principle: "Free frictionless T1 continuation; equal-weight three-point log OLS; diagnostic overrides only",
      confidence: "MODEL_DERIVED_DIAGNOSTIC; not a material measurement",
      applicableState: "T1 N64 frictionless plain jersey; dry-relaxed observations used only as labelled reference" },
    materialParameters: Object.fromEntries(Object.entries(sources).map(([l, source]) => [l, source.params])),
    reusedR2References: part === "chain" ? r2Rows : [], runs: [], targets: [], analysis: null };
  if (!recovery) {
    writeJson(studyFile, { ...summary, summaryFile }, { exclusive: true });
    writeJson(summaryFile, summary, { exclusive: true });
    ledger.status = "RUNNING";
    ledger.phases[part] = { step, status: "RUNNING", studyFile, summaryFile, head, startedAt: summary.startedAt };
    writeJson(ledgerFile, ledger, { exclusive: part === "equivalence" });
  }
  const save = () => {
    summary.totalSolveCount = ledger.totalSolveCount;
    writeJson(summaryFile, summary);
    writeJson(studyFile, { ...summary, summaryFile });
    writeJson(ledgerFile, ledger);
  };
  if (recovery) save();
  function run(scenario, initial) {
    if (ledger.totalSolveCount >= thresholds.maxSolves) throw new Error("STOP #5: next solve would exceed 37 cumulative attempts");
    const source = sources[scenario.l], { params, overrides } = overrideParameters(source.params, scenario);
    const input = { ...structuredClone(source.input), params, initialCell: structuredClone(initial.cell) };
    if (recovery && scenario.id === recovery.resumedId)
      assert.deepEqual(input, recovery.savedInput, "Resumed solve must use exactly the interrupted input");
    const inputFile = `${step}/${scenario.id}-input.json`, resultFile = `${step}/${scenario.id}-result.json`;
    const manifestFile = `${step}/${scenario.id}-manifest.json`;
    for (const file of [inputFile, resultFile, manifestFile])
      assert.ok(!fs.existsSync(path.join(archiveRoot, file)), `Refusing overwrite: ${file}`);
    const inputText = JSON.stringify({ input }, null, 2) + "\n";
    fs.mkdirSync(path.dirname(path.join(archiveRoot, inputFile)), { recursive: true });
    fs.writeFileSync(path.join(archiveRoot, inputFile), inputText, { flag: "wx" });
    const manifest = { ...scenario, head, runtime: environment, status: "RUNNING", startedAt: new Date().toISOString(),
      sourceInputFile: source.inputFile, initialCellSourceFile: initial.file, inputFile, inputSha256: sha256(inputText),
      resultFile, overrides, overrideProvenance: Object.fromEntries(Object.keys(overrides).map(key => [key, params.provenance[key]])),
      lockedLattice: input.lockedLattice ?? null, solveNumber: ledger.totalSolveCount + 1 };
    writeJson(path.join(archiveRoot, manifestFile), manifest, { exclusive: true });
    // Persist the attempted call BEFORE entering the solver; exceptions and interruptions retain this count.
    const attempt = { id: scenario.id, solveNumber: manifest.solveNumber, part, inputFile, manifestFile, resultFile, status: "RUNNING" };
    ledger.attempts.push(attempt);
    ledger.totalSolveCount++;
    save();
    log(`START ${scenario.id} solve=${ledger.totalSolveCount}/37`);
    const started = performance.now();
    let result;
    try {
      result = solve(input);
      manifest.elapsedMs = performance.now() - started;
      writeJson(path.join(archiveRoot, resultFile), result, { exclusive: true });
    } catch (error) {
      manifest.status = "ERROR"; manifest.error = error.message;
      manifest.elapsedMs = performance.now() - started; manifest.finishedAt = new Date().toISOString();
      attempt.status = "ERROR";
      writeJson(path.join(archiveRoot, manifestFile), manifest);
      summary.runs.push({ ...scenario, status: "ERROR", iterations: null, elapsedMs: manifest.elapsedMs,
        error: error.message, initialCellSourceFile: initial.file, manifest: { ...manifest, file: manifestFile }, resultFile: null });
      save();
      throw error;
    }
    manifest.finishedAt = new Date().toISOString(); manifest.status = result.status; attempt.status = result.status;
    writeJson(path.join(archiveRoot, manifestFile), manifest);
    const row = { ...scenario, ...scalars(result, params), elapsedMs: manifest.elapsedMs, overrides,
      initialCellSourceFile: initial.file, manifest: { ...manifest, file: manifestFile }, resultFile };
    summary.runs.push(row);
    save();
    log(`DONE ${scenario.id} ${row.status} iter=${row.iterations} ${(row.elapsedMs / 1000).toFixed(3)}s shear=${row.shearBranch} barrierSupport=${row.barrierSupport}`);
    if (row.status === "INFEASIBLE_INITIAL_GEOMETRY") throw new Error(`STOP #2: ${scenario.id}: initial geometry infeasible`);
    if (!row.energyConsistency.passed) throw new Error(`STOP #4: ${scenario.id}: energy sum inconsistent or unavailable`);
    return { result, row, cell: result.cell, file: path.join(archiveRoot, resultFile) };
  }
  function target(l, KScale, previousScale, initial, id = `r3a-${l}-K${KScale}`) {
    let outcome = run({ id, l, KScale, BScale: 1, target: true, attempt: "direct" }, initial);
    if (outcome.row.status !== "CONVERGED") {
      if (!["NOT_CONVERGED", "INFEASIBLE"].includes(outcome.row.status))
        throw new Error(`STOP #2: ${id}: unsupported failure status ${outcome.row.status}`);
      const middle = run({ id: `${id}-midpoint`, l, KScale: Math.sqrt(previousScale * KScale), BScale: 1,
        target: false, attempt: "midpoint", previousKScale: previousScale, targetKScale: KScale }, initial);
      outcome = run({ id: `${id}-retry`, l, KScale, BScale: 1, target: true, attempt: "retry" }, middle);
      if (outcome.row.status !== "CONVERGED") throw new Error(`STOP #2: ${id}: retry ${outcome.row.status}`);
    }
    summary.targets.push(outcome.row);
    save();
    return outcome;
  }
  try {
    if (part === "equivalence") {
      const source = sources[2.84], initial = { cell: source.reference.cell, file: source.initialCellSourceFile };
      const i = run({ id: "r3a-2.84-K0.25", l: 2.84, KScale: 0.25, BScale: 1,
        target: true, attempt: "direct" }, initial);
      if (i.row.status !== "CONVERGED")
        throw new Error(`STOP #3: K/4 equivalence solve ${i.row.status}; the registered common initial cell forbids substituting a midpoint retry`);
      summary.targets.push(i.row);
      save();
      const ii = run({ id: "equivalence-2.84-B4", l: 2.84, KScale: 1, BScale: 4, target: false, attempt: "equivalence" }, initial);
      if (ii.row.status !== "CONVERGED") throw new Error(`STOP #3: B*4 equivalence solve ${ii.row.status}; no retry authorised`);
      summary.analysis = compareEquivalence(i.row, ii.row);
      summary.analysis.runIds = { i: i.row.id, ii: ii.row.id };
      save();
      if (!summary.analysis.passed) throw new Error("STOP #3: B*4 and K/4 equivalence check failed");
    } else {
      const reused = equivalence.targets.find(row => row.l === 2.84 && row.KScale === 0.25 && row.status === "CONVERGED");
      assert.ok(reused, "Missing converged equivalence target");
      for (const l of lengths) {
        const source = sources[l];
        let initial = { cell: source.reference.cell, file: source.initialCellSourceFile }, previousScale = 0.5;
        for (const KScale of targetScales) {
          const completed = recovery && summary.targets.find(row => row.l === l && row.KScale === KScale);
          if (completed) {
            const file = path.join(archiveRoot, completed.resultFile);
            initial = { cell: readJson(file).cell, file };
            log(`REUSE ${completed.id}; completed before interruption, no solve`);
          } else if (l === 2.84 && KScale === 0.25) {
            summary.targets.push({ ...reused, reusedFromPart: "equivalence", newSolve: false });
            const file = path.join(archiveRoot, reused.resultFile);
            const result = readJson(file);
            assert.equal(result.status, "CONVERGED");
            initial = { cell: result.cell, file };
            log(`REUSE ${reused.id}; no solve`);
            save();
          } else initial = target(l, KScale, previousScale, initial,
            recovery && l === 2.9 && KScale === 0.125 ? recovery.resumedId : undefined);
          previousScale = KScale;
        }
      }
      summary.analysis = analyzeChain([...r2Rows, ...summary.targets]);
    }
    summary.status = "COMPLETE"; summary.finishedAt = new Date().toISOString();
    ledger.status = part === "equivalence" ? "EQUIVALENCE_COMPLETE" : "COMPLETE";
    ledger.phases[part].status = "COMPLETE";
    ledger.phases[part].finishedAt = summary.finishedAt;
    save();
    return summary;
  } catch (error) {
    summary.status = "STOPPED"; summary.error = error.message; summary.finishedAt = new Date().toISOString();
    ledger.status = "STOPPED"; ledger.error = error.message;
    ledger.phases[part].status = "STOPPED"; ledger.phases[part].finishedAt = summary.finishedAt;
    save();
    throw error;
  }
}
