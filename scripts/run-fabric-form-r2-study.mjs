import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createFabricFormParams } from "../src/fabricForm/fabricFormParams.js";
import { solveFabricCell } from "../src/fabricForm/solveFabricCell.js";
import { createDofLayout } from "../src/fabricForm/model/dofLayout.js";
import { createT1PlainJerseyModel } from "../src/fabricForm/model/t1PlainJerseyModel.js";
import { evaluateConstraintReaction } from "../src/fabricForm/constrainedOptimizer.js";
import { currentHead, readJson, repositoryRoot, runtime, sha256, writeJson } from "./lib/fabricFormGolden.mjs";
import { analyzeQ2, analyzeQ3, analyzeQC } from "./lib/fabricFormR2Analysis.mjs";

// Registered in R2 §5: intentionally no command-line overrides for cases or settings.
const args = process.argv.slice(2);
assert.ok(args.length === 2 && args[0] === "--question" && ["q2", "q3", "qc"].includes(args[1]),
  "Usage: npm run study:fabric-form-r2 -- --question q2|q3|qc");
const question = args[1], step = { q2: "R2-1", q3: "R2-2", qc: "R2-3" }[question];
const archiveRoot = "C:/Users/liuchen/Documents/KnitScape/archives/r2-slope-2026-11-25";
const directory = path.join(archiveRoot, step);
const sourceDirectory = "docs/archive/t1-slope-closeout-2026-11-23";
const summaryFile = path.join(repositoryRoot, `docs/archive/t1-slope-r2-2026-11-25/${question}-summary.json`);
const studyFile = path.join(directory, "study-manifest.json");
assert.ok(!fs.existsSync(studyFile) && !fs.existsSync(summaryFile), "Refusing to overwrite an existing study or summary");
const hashFile = file => sha256(fs.readFileSync(file));
const materialKeys = ["tex", "densityGPerCm3", "fiberDiameterMm", "E_f", "K", "phi0"];
const head = currentHead(), environment = runtime();
const codeHashes = Object.fromEntries(["scripts/run-fabric-form-r2-study.mjs", "scripts/lib/fabricFormR2Analysis.mjs",
  "src/fabricForm/solveFabricCell.js"].map(file => [file, hashFile(path.join(repositoryRoot, file))]));
const sources = Object.fromEntries([2.77, 2.84, 2.9].map(l => {
  const inputFile = `${sourceDirectory}/step3-hossain-${l}-input.json`;
  const initialCellSourceFile = `${sourceDirectory}/step3-hossain-${l}-after.json`;
  const input = readJson(path.join(repositoryRoot, inputFile)).input;
  const reference = readJson(path.join(repositoryRoot, initialCellSourceFile));
  const params = createFabricFormParams({ ...Object.fromEntries(materialKeys.map(key => [key, input.params[key]])),
    provenance: input.params.provenance });
  assert.deepEqual(params, input.params, "Reconstructed material parameters must exactly preserve the registered input");
  assert.equal(reference.status, "CONVERGED");
  assert.equal(input.topology.nodesPerLoop, 64);
  assert.equal(input.quadratureOrder ?? 12, 12);
  assert.equal(input.maxIterations, 24000);
  assert.equal(input.innerIterations, 800);
  assert.equal(input.memorySize, 180);
  return [l, { input, reference, params, inputFile, inputSha256: hashFile(path.join(repositoryRoot, inputFile)),
    initialCellSourceFile, initialCellSourceSha256: hashFile(path.join(repositoryRoot, initialCellSourceFile)) }];
}));

function scalars(result) {
  const contact = result.diagnostics.contact;
  const groups = Object.fromEntries(Object.entries(contact.groups ?? {}).map(([key, group]) => [key,
    { activePairs: group.activePairs, minDistanceOverDe: group.minDistanceOverDe }]));
  return { status: result.status, iterations: result.iterations, W: result.cell.W, H: result.cell.H, S: result.cell.S,
    waleDensityPerCm: result.metrics.waleDensityPerCm, courseDensityPerCm: result.metrics.courseDensityPerCm,
    energy: result.energy, minDistanceOverDe: contact.minDistanceOverDe ?? null,
    activePairs: contact.activePairs ?? null, groups, F_W: result.equilibrium.F_W ?? null };
}
const baselines = Object.fromEntries(Object.entries(sources).map(([l, source]) => [l, {
  l: Number(l), KScale: 1, scale: 1, delta: 0, ...scalars(source.reference),
  source: { kind: "REUSED_AFTER_JSON_NOT_A_NEW_SOLVE", file: source.initialCellSourceFile,
    sha256: source.initialCellSourceSha256, inputFile: source.inputFile, inputSha256: source.inputSha256 },
}]));
const summary = { schemaVersion: 1, question, step, head, runtime: environment, codeHashes,
  startedAt: new Date().toISOString(), status: "RUNNING", archiveRoot,
  provenance: { values: "Each run and baseline row; unrounded JSON scalars", units: {
    l: "mm", W: "mm", H: "mm", S: "mm", energy: "N*mm", F_W: "N", stiffness: "N/mm",
    waleDensityPerCm: "1/cm", courseDensityPerCm: "1/cm", sensitivity: "1", contactShare: "1" },
    source: "R2 task §5 and the input/after files listed in each manifest",
    principle: "T1 equilibrium continuation; registered central differences and equal-weight log OLS",
    confidence: "MODEL_DERIVED_DIAGNOSTIC; not physical measurement or causal verification",
    applicableState: "T1 N64 frictionless plain-jersey branch; no material calibration" },
  baselines, materialParameters: Object.fromEntries(Object.entries(sources).map(([l, s]) => [l, s.params])), runs: [], analysis: null };
writeJson(studyFile, { ...summary, summaryFile }, { exclusive: true });
const save = () => { writeJson(summaryFile, summary); writeJson(studyFile, { ...summary, summaryFile }); };

function overrideParameters(base, scenario) {
  const params = structuredClone(base), overrides = {};
  if (question === "q2") {
    overrides.d_e = base.d_e * scenario.scale;
    // Variant B deliberately breaks the usual r_c derivation; mark its held value as diagnostic too.
    overrides.r_c = scenario.variant === "A" ? base.r_c * scenario.scale : base.r_c;
  }
  if (question === "qc") overrides.K = base.K * scenario.KScale;
  for (const [key, value] of Object.entries(overrides)) {
    params[key] = value;
    params.provenance[key] = { ...params.provenance[key], value, confidence: "DIAGNOSTIC_OVERRIDE",
      source: "R2 task §5", principle: question === "qc" ? `K scaled by ${scenario.KScale}; B unchanged; diagnostic only` :
        scenario.variant === "A" ? `d_e and r_c scaled by ${scenario.scale} jointly; diagnostic only` :
          `d_e scaled by ${scenario.scale}; r_c held at baseline, overriding its d_e derivation; diagnostic only`,
      applicableState: "R2 mechanism diagnosis; not a material value" };
  }
  for (const key of ["B", "E_f", "tex"]) assert.equal(params[key], base[key]);
  return { params, overrides };
}

function reactionDecomposition(result, input) {
  const layout = createDofLayout(result.cell), index = layout.index("lattice", "W");
  const model = createT1PlainJerseyModel(input.params, { quadratureOrder: input.quadratureOrder ?? 12 });
  const evaluation = model.evaluate(result.cell), constraint = model.constraintsAt(result.cell);
  const reaction = evaluateConstraintReaction({ gradient: evaluation.gradient, jacobian: constraint.jacobian,
    freeIndices: layout.freeIndices({ locked: ["W"] }) });
  const bending = evaluation.details.bending.gradient[index];
  const contact = evaluation.details.contact.gradient[index]; // Includes barrier, as in the model contact term.
  let constraintReaction = 0;
  for (let i = 0; i < constraint.jacobian.length; i++) constraintReaction += constraint.jacobian[i][index] * reaction.multipliers[i];
  return { bending, contact, barrierIncludedInContact: evaluation.details.contact.barrierGradient[index],
    constraintReaction, sum: bending + contact + constraintReaction,
    differenceFromFW: bending + contact + constraintReaction - result.equilibrium.F_W,
    convention: "F_W = g_bending,W + g_contact(including barrier),W + (J^T lambda)_W; N" };
}

function checkContactBranch(row) {
  const base = baselines[row.l], changes = {};
  for (const name of ["waleSpacing", "courseSpacing"]) {
    const count = base.groups[name].activePairs;
    changes[name] = { activePairsRelativeChange: Math.abs(row.groups[name].activePairs - count) / count,
      minDistanceOverDeChange: row.groups[name].minDistanceOverDe - base.groups[name].minDistanceOverDe };
  }
  row.branchChanges = { groups: changes, minDistanceOverDeChange: row.minDistanceOverDe - base.minDistanceOverDe };
  if (Object.values(changes).some(c => c.activePairsRelativeChange > 0.30) ||
      Math.abs(row.branchChanges.minDistanceOverDeChange) > 0.02) {
    throw new Error(`STOP #6: ${row.id}: contact branch change exceeds registered guard`);
  }
}

function run(scenario, initialOverride) {
  if (question === "qc" && summary.runs.length >= 12) {
    throw new Error("STOP #7: QC continuation would exceed the 12-solve ceiling in R2 §6; §5.4 can require 18; architect clarification required");
  }
  const source = sources[scenario.l], { params, overrides } = overrideParameters(source.params, scenario);
  const input = { ...source.input, params, initialCell: initialOverride?.cell ?? source.reference.cell };
  if (question === "q3") input.lockedLattice = { W: source.reference.cell.W * (1 + scenario.delta) };
  const inputFile = `${step}/${scenario.id}-input.json`, resultFile = `${step}/${scenario.id}-result.json`;
  const manifestFile = `${step}/${scenario.id}-manifest.json`;
  for (const file of [inputFile, resultFile, manifestFile]) assert.ok(!fs.existsSync(path.join(archiveRoot, file)), `Refusing overwrite: ${file}`);
  writeJson(path.join(archiveRoot, inputFile), { input }, { exclusive: true });
  const manifest = { id: scenario.id, question, ...scenario, head, runtime: environment, codeHashes,
    sourceInputFile: source.inputFile, sourceInputSha256: source.inputSha256,
    inputFile, inputSha256: hashFile(path.join(archiveRoot, inputFile)),
    initialCellSourceFile: initialOverride?.file ?? source.initialCellSourceFile,
    initialCellSourceSha256: initialOverride ? hashFile(path.join(archiveRoot, initialOverride.file)) : source.initialCellSourceSha256,
    overrides, overrideProvenance: Object.fromEntries(Object.keys(overrides).map(key => [key, params.provenance[key]])),
    lockedLattice: input.lockedLattice ?? null, resultFile, startedAt: new Date().toISOString(), status: "RUNNING" };
  writeJson(path.join(archiveRoot, manifestFile), manifest, { exclusive: true });
  console.log(`START ${scenario.id}`);
  const started = performance.now();
  let result;
  try {
    result = solveFabricCell(input);
    manifest.elapsedMs = performance.now() - started;
    manifest.status = result.status;
    manifest.finishedAt = new Date().toISOString();
    writeJson(path.join(archiveRoot, resultFile), result, { exclusive: true });
    manifest.resultSha256 = hashFile(path.join(archiveRoot, resultFile));
  } catch (error) {
    manifest.status = "ERROR"; manifest.error = error.message; manifest.finishedAt = new Date().toISOString();
    manifest.elapsedMs = performance.now() - started;
    writeJson(path.join(archiveRoot, manifestFile), manifest);
    summary.runs.push({ ...scenario, status: "ERROR", iterations: null, elapsedMs: manifest.elapsedMs,
      overrides, error: error.message, manifest: { ...manifest, file: manifestFile },
      resultFile: fs.existsSync(path.join(archiveRoot, resultFile)) ? resultFile : null });
    save();
    throw error;
  }
  writeJson(path.join(archiveRoot, manifestFile), manifest);
  const row = { ...scenario, ...scalars(result), elapsedMs: manifest.elapsedMs, overrides,
    manifest: { ...manifest, file: manifestFile }, resultFile };
  summary.runs.push(row);
  save();
  console.log(`DONE ${scenario.id} ${row.status} iter=${row.iterations} ${(row.elapsedMs / 1000).toFixed(3)}s`);
  if (question !== "qc" && result.status !== "CONVERGED") throw new Error(`STOP #3: ${scenario.id} ${result.status}`);
  if (question === "q3") {
    row.reactionDecomposition = reactionDecomposition(result, input);
    checkContactBranch(row);
    save();
  }
  return { result, row };
}

try {
  if (question === "q2") {
    for (const variant of ["A", "B"]) for (const scale of [0.95, 1.05]) run({ id: `q2-${variant}-${scale}`, l: 2.84, variant, scale });
    summary.analysis = analyzeQ2(summary.runs);
  } else if (question === "q3") {
    for (const [l, deltas] of [[2.84, [0.005, 0.01, 0.02]], [2.77, [0.01]], [2.9, [0.01]]]) {
      for (const magnitude of deltas) {
        for (const sign of [-1, 1]) run({ id: `q3-${l}-${sign < 0 ? "minus" : "plus"}-${magnitude}`, l, delta: sign * magnitude });
        summary.analysis = analyzeQ3(summary.runs, baselines);
        save();
        if (summary.analysis.stopReasons?.length) throw new Error(`STOP #5: ${summary.analysis.stopReasons.join("; ")}`);
      }
    }
  } else {
    for (const KScale of [0.5, 2]) for (const l of [2.77, 2.84, 2.9]) {
      const id = `qc-${l}-K${KScale}`;
      const direct = run({ id, l, KScale, attempt: "direct", target: true });
      if (direct.result.status === "CONVERGED") continue;
      const middle = run({ id: `${id}-continuation`, l, KScale: Math.sqrt(KScale), attempt: "continuation", target: false });
      const retry = run({ id: `${id}-retry`, l, KScale, attempt: "retry", target: true },
        { cell: middle.result.cell, file: middle.row.resultFile });
      if (retry.result.status !== "CONVERGED") throw new Error(`STOP #4: ${retry.row.id} ${retry.result.status}`);
    }
    summary.analysis = analyzeQC(summary.runs.filter(row => row.target && row.status === "CONVERGED"), baselines);
  }
  summary.status = "COMPLETE";
  summary.finishedAt = new Date().toISOString();
  save();
  console.log(JSON.stringify(summary.analysis, null, 2));
} catch (error) {
  summary.status = "STOPPED"; summary.error = error.message; summary.finishedAt = new Date().toISOString();
  save();
  throw error;
}
