import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const moduleFile = new URL("./fabricFormR3aStudy.mjs", import.meta.url);
assert.ok(fs.existsSync(moduleFile), "R3a runner must provide testable stop guards before any real solve");
const { compareEquivalence, energyConsistency, analyzeChain, classifySlope, runStudy, parseArguments } = await import(moduleFile.href);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
assert.equal(parseArguments(["--part", "chain"]), "chain");
assert.equal(parseArguments(["--part", "chain", "--resume-interrupted"]), "chain");
assert.throws(() => parseArguments(["--part", "equivalence", "--resume-interrupted"]), /Usage/);
for (const args of [[], ["--part", "bad"], ["--part", "chain", "--max", "38"]])
  assert.throws(() => parseArguments(args), /Usage/);
const row = { W: 2, H: 3, S: 0, waleDensityPerCm: 5, courseDensityPerCm: 10 / 3,
  energy: { total: 3, bending: 2, contact: 1, barrier: 0, barrierFraction: 0 } };
const four = structuredClone(row);
for (const key of ["total", "bending", "contact", "barrier"]) four.energy[key] *= 4;
const eq = compareEquivalence(row, four);
assert.equal(eq.passed, true);
assert.equal(eq.energy.barrier.ratio, null);
assert.equal(eq.energy.barrier.relativeDifferenceFromFour, null);
assert.equal(eq.energy.barrier.absoluteResidual, 0);
assert.match(eq.energy.barrier.note, /zero/i);
four.energy.barrier = 1e-20;
assert.equal(compareEquivalence(row, four).passed, false);
four.energy.barrier = 0;
four.W = row.W * (1 + 2e-5);
assert.equal(compareEquivalence(row, four).passed, false);
assert.equal(energyConsistency(row.energy).passed, true);
assert.equal(energyConsistency({ total: 0, bending: 0, contact: 0, barrier: 0 }).passed, true);
assert.equal(energyConsistency({ total: 0, bending: 1, contact: 0, barrier: 0 }).passed, false);
assert.equal(energyConsistency({ total: null, bending: 0, contact: 0, barrier: 0 }).passed, false);
assert.equal(classifySlope(-0.9, false), "一致");
assert.equal(classifySlope(-0.6, false), "不足以解释");
assert.equal(classifySlope(-0.75, false), "不确定");
assert.equal(classifySlope(-1.1, true), "不确定（分支混合）");
const lengths = [2.77, 2.84, 2.9], scales = [2, 1, 0.5, 0.25, 0.125, 0.0625, 1 / 44];
const data = scales.flatMap(KScale => lengths.map(l => ({ l, KScale, status: "CONVERGED", shearBranch: false,
  waleDensityPerCm: 10 * l ** (-0.4 + 0.2 * Math.log(KScale)), courseDensityPerCm: 20 * l ** -1.5 })));
const analysis = analyzeChain(data);
assert.equal(analysis.fits.length, 7);
analysis.fits.forEach(fit => { near(fit.wale.sse, 0); near(fit.course.slope, -1.5); });
analysis.dbWaleDlnKIntervals.forEach(interval => near(interval.value, 0.2));
near(analysis.fits[1].dryRelaxedDeviation.walePercent, 100 * (data[4].waleDensityPerCm / (30.8 / 2.54) - 1));
data.at(-1).shearBranch = true;
assert.equal(analyzeChain(data).primary.interpretation, "不确定（分支混合）");

// No real solver import: exercise persistence and continuation with synthetic results.
const checkRoot = "C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-1/self-check";
fs.mkdirSync(checkRoot, { recursive: true });
const directory = fs.mkdtempSync(path.join(checkRoot, "synthetic-"));
const params = { K: 1, B: 1, E_f: 1, d_e: 1, r_c: 0.5, provenance: { K: {}, B: {} } };
const sources = Object.fromEntries(lengths.map(l => [l, { input: { params, l, topology: { nodesPerLoop: 64 },
  quadratureOrder: 12, maxIterations: 24000, innerIterations: 800, memorySize: 180 }, params,
  inputFile: `synthetic-source-${l}`, initialCellSourceFile: `synthetic-K0.5-${l}`,
  reference: { status: "CONVERGED", cell: { W: 2, H: 3, S: 0, seed: l } } }]));
function resultFor(input) {
  const scale = input.params.K / input.params.B, l = input.l;
  return { status: "CONVERGED", iterations: 1, cell: { W: 2, H: 3, S: 0, seed: scale },
    metrics: { waleDensityPerCm: 10 * l ** (-0.4 + 0.2 * Math.log(scale)), courseDensityPerCm: 20 * l ** -1.5,
      kw: 1, kc: 2 }, energy: { total: 3 * input.params.B, bending: 2 * input.params.B,
      contact: input.params.B, barrier: 0, barrierFraction: 0 },
    diagnostics: { contact: { minDistanceOverDe: 0.8, activePairs: 2,
      groups: { waleSpacing: { activePairs: 2, minDistanceOverDe: 0.8 } } } } };
}
const r2Rows = data.filter(r => r.KScale >= 0.5);
function options(name, solve) {
  const root = path.join(directory, name);
  return { archiveRoot: root, summaryDirectory: path.join(root, "summary"), sources, r2Rows, solve,
    head: "SYNTHETIC", environment: { node: process.version }, log: () => {} };
}
const calls = [];
const opts = options("happy", input => { calls.push(structuredClone(input)); return resultFor(input); });
const first = runStudy({ ...opts, part: "equivalence" });
assert.equal(first.status, "COMPLETE");
assert.equal(calls.length, 2);
assert.deepEqual(calls[0].initialCell, calls[1].initialCell);
assert.equal(calls[0].params.K, 0.25);
assert.equal(calls[1].params.K, 1);
assert.equal(calls[1].params.B, 4);
const second = runStudy({ ...opts, part: "chain" });
assert.equal(second.status, "COMPLETE");
assert.equal(calls.length, 13);
assert.equal(second.totalSolveCount, 13);
assert.equal(second.targets.length, 12);
assert.equal(second.runs.length, 11);
assert.equal(second.analysis.fits.length, 7);
assert.throws(() => runStudy({ ...opts, part: "chain" }), /overwrite/);
assert.equal(calls.length, 13);
for (const input of calls) {
  assert.equal(input.maxIterations, 24000);
  assert.equal(input.memorySize, 180);
}
// Check the geometric midpoint uses the preceding target seed, and retry uses its own terminal cell.
let retryCall = 0;
const retryInputs = [];
const midpoint = options("midpoint", input => {
  retryInputs.push(structuredClone(input));
  const result = resultFor(input);
  retryCall++;
  if (retryCall === 3 || retryCall === 4) result.status = "NOT_CONVERGED";
  return result;
});
runStudy({ ...midpoint, part: "equivalence" });
runStudy({ ...midpoint, part: "chain" });
near(retryInputs[3].params.K, Math.sqrt(0.5 * 0.25));
assert.deepEqual(retryInputs[3].initialCell, retryInputs[2].initialCell);
near(retryInputs[4].initialCell.seed, Math.sqrt(0.5 * 0.25));
let worstCalls = 0;
const worst = options("all-retries", input => {
  const result = resultFor(input);
  // Equivalence is two direct solves; each chain direct fails, then midpoint/retry pass.
  if (++worstCalls > 2 && (worstCalls - 3) % 3 === 0) result.status = "NOT_CONVERGED";
  return result;
});
const worstEq = runStudy({ ...worst, part: "equivalence" });
assert.equal(worstEq.runs.length, 2);
const worstChain = runStudy({ ...worst, part: "chain" });
assert.equal(worstChain.totalSolveCount, 35);
assert.equal(worstChain.targets.length, 12);
assert.equal(worstChain.status, "COMPLETE");

let budgetCalls = 0;
const capped = options("cap", input => { budgetCalls++; return resultFor(input); });
runStudy({ ...capped, part: "equivalence" });
const capLedgerFile = path.join(capped.archiveRoot, "study-ledger.json");
const capLedger = JSON.parse(fs.readFileSync(capLedgerFile));
capLedger.attempts = Array.from({ length: 37 }, (_, index) => ({ id: `synthetic-${index}`, status: "CONVERGED" }));
capLedger.totalSolveCount = 37;
fs.writeFileSync(capLedgerFile, JSON.stringify(capLedger));
assert.throws(() => runStudy({ ...capped, part: "chain" }), /STOP #5/);
assert.equal(budgetCalls, 2);
assert.equal(JSON.parse(fs.readFileSync(capLedgerFile)).status, "STOPPED");

for (const [name, failAt, status, error] of [["i-failed", 1, "NOT_CONVERGED", /STOP #3/],
  ["B4-failed", 2, "NOT_CONVERGED", /STOP #3/], ["B4-different", 2, "DIFFERENT_W", /STOP #3/]]) {
  let n = 0;
  const stopped = options(name, input => {
    const result = resultFor(input);
    n++;
    if (n === failAt) {
      if (status === "DIFFERENT_W") result.cell.W *= 1.01;
      else result.status = status;
    }
    return result;
  });
  assert.throws(() => runStudy({ ...stopped, part: "equivalence" }), error);
  assert.equal(n, failAt);
  assert.equal(JSON.parse(fs.readFileSync(path.join(stopped.archiveRoot, "study-ledger.json"))).status, "STOPPED");
}

for (const [name, status, expected] of [["initial", "INFEASIBLE_INITIAL_GEOMETRY", /STOP #2/],
  ["energy", "BAD_ENERGY", /STOP #4/], ["exception", "EXCEPTION", /synthetic exception/],
  ["retry", "NOT_CONVERGED", /STOP #2/], ["midpoint-initial", "INFEASIBLE_INITIAL_GEOMETRY", /STOP #2/]]) {
  let n = 0;
  const stopped = options(name, input => {
    n++;
    if (["retry", "midpoint-initial"].includes(name) && n <= 2) return resultFor(input);
    if (status === "EXCEPTION") throw new Error("synthetic exception");
    const result = resultFor(input);
    if (status === "BAD_ENERGY") result.energy.total = 99;
    else result.status = name === "midpoint-initial" && n === 3 ? "INFEASIBLE" : status;
    if (result.status === "INFEASIBLE_INITIAL_GEOMETRY") result.energy.total = null;
    return result;
  });
  const chainCase = ["retry", "midpoint-initial"].includes(name);
  if (chainCase) runStudy({ ...stopped, part: "equivalence" });
  assert.throws(() => runStudy({ ...stopped, part: chainCase ? "chain" : "equivalence" }), expected);
  const expectedCalls = name === "retry" ? 5 : name === "midpoint-initial" ? 4 : 1;
  assert.equal(n, expectedCalls);
  const ledger = JSON.parse(fs.readFileSync(path.join(stopped.archiveRoot, "study-ledger.json")));
  assert.equal(ledger.status, "STOPPED");
  assert.equal(ledger.totalSolveCount, n);
  assert.throws(() => runStudy({ ...stopped, part: "chain" }), /STOPPED|equivalence|overwrite/);
  assert.equal(n, expectedCalls);
}
// Capture exactly the state persisted before fake call 11, then restore those bytes to simulate process termination.
function interruptedOptions(name) {
  let n = 0, snapshot;
  const interrupted = options(name, input => {
    if (++n === 11) {
      const files = [path.join(interrupted.archiveRoot, "study-ledger.json"),
        path.join(interrupted.archiveRoot, "R3a-2/study-manifest.json"),
        path.join(interrupted.summaryDirectory, "r3a-summary.json"),
        path.join(interrupted.archiveRoot, "R3a-2/r3a-2.9-K0.125-manifest.json")];
      snapshot = files.map(file => ({ file, bytes: fs.readFileSync(file) }));
      throw new Error("SYNTHETIC_INTERRUPTION");
    }
    return resultFor(input);
  });
  runStudy({ ...interrupted, part: "equivalence" });
  assert.throws(() => runStudy({ ...interrupted, part: "chain" }), /SYNTHETIC_INTERRUPTION/);
  for (const { file, bytes } of snapshot) fs.writeFileSync(file, bytes);
  return { ...interrupted, snapshot };
}
const interrupted = interruptedOptions("resume");
const interruptedInputFile = path.join(interrupted.archiveRoot, "R3a-2/r3a-2.9-K0.125-input.json");
const interruptedInputBytes = fs.readFileSync(interruptedInputFile);
const interruptedInput = JSON.parse(interruptedInputBytes).input;
let resumeCalls = 0;
const resumed = runStudy({ ...interrupted, part: "chain", resumeInterrupted: true, solve: input => {
  if (resumeCalls++ === 0) assert.deepEqual(input, interruptedInput);
  return resultFor(input);
} });
assert.equal(resumeCalls, 3);
assert.equal(resumed.totalSolveCount, 14);
assert.equal(resumed.targets.length, 12);
assert.equal(resumed.runs.length, 12);
const interruptedRow = resumed.runs[8];
assert.equal(interruptedRow.status, "INTERRUPTED");
for (const key of ["W", "H", "S", "kw", "kc", "iterations", "elapsedMs", "shearBranch", "barrierSupport", "energyConsistency"])
  assert.equal(interruptedRow[key], null);
assert.ok(Object.values(interruptedRow.energy).every(value => value === null));
assert.equal(interruptedRow.manifest.status, "RUNNING");
assert.equal(interruptedRow.resultFile, null);
assert.equal(resumed.runs[9].id, "r3a-2.9-K0.125-resumed");
assert.equal(resumed.runs[9].manifest.solveNumber, 12);
assert.deepEqual(fs.readFileSync(interruptedInputFile), interruptedInputBytes);
assert.deepEqual(fs.readFileSync(interrupted.snapshot[3].file), interrupted.snapshot[3].bytes);
const snapshotNames = ["study-ledger.json", "study-manifest.json", "r3a-summary.json"];
for (let index = 0; index < 3; index++) assert.deepEqual(
  fs.readFileSync(path.join(interrupted.archiveRoot, "R3a-2/interruption-2026-11-26", snapshotNames[index])),
  interrupted.snapshot[index].bytes);
const resumedLedger = JSON.parse(fs.readFileSync(path.join(interrupted.archiveRoot, "study-ledger.json")));
assert.equal(resumedLedger.attempts[10].status, "INTERRUPTED");
assert.equal(resumedLedger.attempts[10].originalManifestStatus, "RUNNING");
assert.equal(resumedLedger.attempts[10].resultFileExistsAtRecovery, false);
assert.throws(() => runStudy({ ...interrupted, part: "chain", resumeInterrupted: true }), /RUNNING|snapshot|resume/);

for (const kind of ["STOPPED", "existing-result", "wrong-id", "summary-mismatch", "input-changed", "existing-snapshot", "no-flag"]) {
  const rejected = interruptedOptions(`reject-resume-${kind}`);
  const ledgerFile = path.join(rejected.archiveRoot, "study-ledger.json");
  const ledger = JSON.parse(fs.readFileSync(ledgerFile));
  if (kind === "STOPPED") { ledger.status = "STOPPED"; fs.writeFileSync(ledgerFile, JSON.stringify(ledger)); }
  if (kind === "wrong-id") { ledger.attempts[10].id = "different"; fs.writeFileSync(ledgerFile, JSON.stringify(ledger)); }
  if (kind === "existing-result") fs.writeFileSync(path.join(rejected.archiveRoot, ledger.attempts[10].resultFile), "{}");
  if (kind === "summary-mismatch") fs.writeFileSync(path.join(rejected.summaryDirectory, "r3a-summary.json"), "{}");
  if (kind === "input-changed") {
    const file = path.join(rejected.archiveRoot, ledger.attempts[10].inputFile), value = JSON.parse(fs.readFileSync(file));
    value.input.maxIterations = 24001;
    fs.writeFileSync(file, JSON.stringify(value));
  }
  if (kind === "existing-snapshot") {
    const folder = path.join(rejected.archiveRoot, "R3a-2/interruption-2026-11-26");
    fs.mkdirSync(folder); fs.writeFileSync(path.join(folder, "study-ledger.json"), "{}");
  }
  const before = fs.readFileSync(ledgerFile);
  let called = 0;
  assert.throws(() => runStudy({ ...rejected, part: "chain", resumeInterrupted: kind !== "no-flag", solve: () => { called++; } }));
  assert.equal(called, 0);
  assert.deepEqual(fs.readFileSync(ledgerFile), before);
}
const resumedRetry = interruptedOptions("resume-retry");
let retriedCalls = 0;
const retrySummary = runStudy({ ...resumedRetry, part: "chain", resumeInterrupted: true, solve: input => {
  const result = resultFor(input);
  if (++retriedCalls === 1) result.status = "NOT_CONVERGED";
  return result;
} });
assert.equal(retriedCalls, 5);
assert.equal(retrySummary.totalSolveCount, 16);
assert.deepEqual(retrySummary.runs.slice(9, 12).map(run => run.id),
  ["r3a-2.9-K0.125-resumed", "r3a-2.9-K0.125-resumed-midpoint", "r3a-2.9-K0.125-resumed-retry"]);
console.log(`R3a self-check PASS: analysis, two-part reuse, budget/retry/stop guards, exact interrupted snapshot recovery and rejected altered snapshots. Synthetic evidence: ${directory}`);
