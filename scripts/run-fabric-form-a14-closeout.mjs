import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createPlainJerseyTopology } from "../src/fabricForm/fabricFormTopology.js";
import { createFabricFormInitialGeometry } from "../src/fabricForm/fabricFormInitialGeometry.js";
import { solveFabricCell, evaluateFabricCell, defaultMemorySize } from "../src/fabricForm/solveFabricCell.js";
import { evaluateLengthConstraints, evaluateRodBending } from "../src/fabricForm/rodBending.js";
import { evaluateConstraintReaction } from "../src/fabricForm/constrainedOptimizer.js";
import { evaluatePeriodicContact } from "../src/fabricForm/periodicContact.js";
import { edgeEndpoints } from "../src/fabricForm/periodicCell.js";
import { describeRefinementGeometry } from "./lib/fabricFormRefinement.mjs";

const archive = "C:/Users/liuchen/Documents/KnitScape/archives/fabric-form-step1-2026-11-22";
const output = "C:/Users/liuchen/Documents/KnitScape/archives/fabric-form-step1-closeout-2026-11-22/a14";
const script = fileURLToPath(import.meta.url);
fs.mkdirSync(output, { recursive: true });
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const old = file => read(path.join(archive, file));
const maxAbs = values => Math.max(...Array.from(values, Math.abs));
const cases = { "2.6": "case-2.6.json", "3": "case-3.json", "3.5": "case-3.5.json", "4": "case-4.json", sop: "sop-reference.json" };

function scaledReference(length) {
  const cell = structuredClone(old("reference.json").cell);
  const scale = length / cell.topology.loopLengthMm;
  cell.positions = cell.positions.map(point => point.map(value => value * scale));
  for (const key of ["W", "H", "S"]) cell[key] *= scale;
  cell.topology.loopLengthMm = length;
  for (const edge of cell.topology.edges) { edge.restLength *= scale; edge.materialStart *= scale; }
  for (const yarn of cell.topology.yarns) yarn.materialLength *= scale;
  return cell;
}

/** Exact subdivision of the existing polygon and its material intervals. No smoothing/remapping. */
export function subdivideMaterialEdges(source, targetNodes) {
  assert.equal(source.topology.m, 1); assert.equal(source.topology.n, 1);
  assert.ok(Number.isInteger(targetNodes) && targetNodes > source.positions.length);
  const original = JSON.stringify(source);
  let parts = source.topology.edges.map((edge, parent) => {
    assert.equal(edge.from, parent);
    assert.equal(edge.to, (parent + 1) % source.positions.length);
    assert.equal(edge.p, parent === source.positions.length - 1 ? 1 : 0); assert.equal(edge.q, 0);
    return { parent, a: 0, b: 1, restLength: edge.restLength };
  });
  if (targetNodes === 2 * parts.length) parts = parts.flatMap(item => [
    { ...item, b: .5, restLength: item.restLength / 2 },
    { ...item, a: .5, restLength: item.restLength - item.restLength / 2 },
  ]);
  while (parts.length < targetNodes) {
    // Stable first maximum preserves deterministic material-order ties.
    let selected = 0;
    for (let i = 1; i < parts.length; i++) if (parts[i].restLength > parts[selected].restLength) selected = i;
    const item = parts[selected], middle = (item.a + item.b) / 2, first = item.restLength / 2;
    parts.splice(selected, 1, { ...item, b: middle, restLength: first },
      { ...item, a: middle, restLength: item.restLength - first });
  }
  const topology = createPlainJerseyTopology({ nodesPerLoop: targetNodes, loopLengthMm: source.topology.loopLengthMm });
  topology.loops[0].passesThrough = structuredClone(source.topology.loops[0].passesThrough);
  topology.crossingConvention = structuredClone(source.topology.crossingConvention);
  for (const key of ["lengthSource", "lengthConfidence"]) if (source.topology[key]) topology[key] = source.topology[key];
  const positions = parts.map((part, i) => {
    const edge = source.topology.edges[part.parent], [a, b] = edgeEndpoints(source, edge);
    topology.edges[i].restLength = part.restLength;
    topology.edges[i].materialStart = edge.materialStart + part.a * edge.restLength;
    return part.a === 0 ? a.slice() : a.map((v, k) => v + part.a * (b[k] - v));
  });
  const cell = { positions, topology, W: source.W, H: source.H, S: source.S };
  const parentSums = source.topology.edges.map((edge, parent) => parts.filter(p => p.parent === parent).reduce((s, p) => s + p.restLength, 0));
  assert.ok(parentSums.every((sum, i) => Math.abs(sum - source.topology.edges[i].restLength) <= 2e-15));
  assert.equal(JSON.stringify(source), original);
  cell.refinement = { method: "Nested linear material-arclength subdivision; all original nodes and material boundaries retained",
    sourceNodes: source.positions.length, targetNodes, sourceTotalReferenceLength: source.topology.edges.reduce((s, e) => s + e.restLength, 0),
    targetTotalReferenceLength: topology.edges.reduce((s, e) => s + e.restLength, 0),
    parentIntervals: parts, maxParentLengthError: Math.max(...parentSums.map((s, i) => Math.abs(s - source.topology.edges[i].restLength))),
    geometryUnchanged: true, parentStrainInherited: true, homotopyNeeded: false,
    note: "At a doubled polygon old corners retain turning angle with shorter dual length; initial bending energy can double. This is not an equilibrium branch comparison." };
  return cell;
}

function crossingSignature(cell) {
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0], subtract = (a, b) => a.map((v, i) => v - b[i]);
  const found = [];
  for (const a of cell.topology.edges) for (const b of cell.topology.edges) for (const p of [-1, 0, 1]) {
    const [a0, a1] = edgeEndpoints(cell, a), [b0, b1] = edgeEndpoints(cell, b, p, -1);
    const d = subtract(a1, a0), e = subtract(b1, b0), r = subtract(b0, a0), denominator = cross(d, e);
    if (Math.abs(denominator) < 1e-12) continue;
    const s = cross(r, e) / denominator, t = cross(r, d) / denominator;
    if (s > 0 && s < 1 && t > 0 && t < 1) found.push({ order: a.materialStart + s * a.restLength, p, q: -1,
      over: Math.sign(a0[2] + s * d[2] - b0[2] - t * e[2]), orientation: Math.sign(denominator) });
  }
  return found.sort((a, b) => a.order - b.order).map(({ order, ...v }) => v);
}

function identity(result) {
  return { directedTopology: result.cell.topology.loops[0].passesThrough, crossingSignatureXY: crossingSignature(result.cell),
    signatureScope: "Fixed XY projection diagnostic; not a complete topological invariant", shear: result.cell.S,
    shearOverWidth: result.cell.S / result.cell.W, rawShearSign: Math.sign(result.cell.S), energy: result.energy.total,
    trajectory: result.trajectory, geometry: describeRefinementGeometry(result.cell) };
}

function canonicalCyclicSignature(signature) {
  if (!signature.length) return "[]";
  // Moving the material seam past a crossing lifts that crossing by one yarn period.
  const rotations = signature.map((_, start) => {
    const row = signature.slice(start).concat(signature.slice(0, start).map(item => ({ ...item, p: item.p + 1 })));
    const offset = row[0].p;
    return JSON.stringify(row.map(item => ({ ...item, p: item.p - offset })));
  });
  return rotations.sort()[0];
}

function quadrature(result) {
  const { cell, params } = result, low = evaluateFabricCell(cell, params, 12), high = evaluateFabricCell(cell, params, 24);
  const constraints = evaluateLengthConstraints(cell), count = cell.positions.length * 3;
  const reaction = evaluateConstraintReaction({ gradient: high.gradient, jacobian: constraints.jacobian,
    freeIndices: Array.from({ length: count }, (_, i) => i + 3) });
  return { orders: [12, 24], fixedGeometry: true, totalEnergyQ12: low.energy, totalEnergyQ24: high.energy,
    contactEnergyQ12: low.contact.contactEnergy, contactEnergyQ24: high.contact.contactEnergy,
    totalEnergyRelativeError: Math.abs(low.energy / high.energy - 1),
    contactEnergyRelativeError: Math.abs(low.contact.contactEnergy / high.contact.contactEnergy - 1),
    absoluteGradientError: maxAbs(high.gradient.map((v, i) => v - low.gradient[i])),
    relativeGradientError: maxAbs(high.gradient.map((v, i) => v - low.gradient[i])) / maxAbs(high.gradient),
    q24NodeRatio: maxAbs(reaction.fullResidual.slice(0, count)) / (high.energy / cell.topology.loopLengthMm),
    q24LatticeRatios: Array.from(reaction.fullResidual.slice(count), (v, i) => Math.abs(v) * [cell.W, cell.H, cell.W][i] / high.energy) };
}

function changes(coarse, fine) {
  return Object.fromEntries(["wale", "course"].map(k => [k, fine.metrics[k + "DensityPerCm"] / coarse.metrics[k + "DensityPerCm"] - 1]));
}
function assess(levels) {
  const deltas = levels.slice(1).map((r, i) => ({ from: levels[i].cell.topology.nodesPerLoop, to: r.cell.topology.nodesPerLoop, ...changes(levels[i], r),
    fineDenominator: Object.fromEntries(["wale", "course"].map(k => [k, r.metrics[k + "DensityPerCm"] === 0 ? null :
      1 - levels[i].metrics[k + "DensityPerCm"] / r.metrics[k + "DensityPerCm"]])) }));
  const last = deltas.at(-1), hasPair = !!last;
  const decreasing = deltas.length >= 2 && ["wale", "course"].every(k => deltas.slice(1).every((d, i) => Math.abs(d[k]) < Math.abs(deltas[i][k])));
  return { deltas, finestAdjacentWithinTolerance: hasPair && Math.abs(last.wale) <= .005 && Math.abs(last.course) <= .005,
    changesDecreaseAtEveryLevel: decreasing,
    convergenceEstablished: hasPair && decreasing && Math.abs(last.wale) <= .005 && Math.abs(last.course) <= .005,
    diagnosticLog2ChangeRatios: deltas.slice(1).map((d, i) => Object.fromEntries(["wale", "course"].map(k => [k, Math.log2(Math.abs(deltas[i][k] / d[k]))]))),
    orderNote: "24->32 is not a factor-two refinement; log2 change ratios involving it are descriptive, not asymptotic orders." };
}

async function child(args, stem, timeoutMs = 2 * 60 * 60 * 1000) {
  const logFile = path.join(output, stem + ".log"), log = fs.openSync(logFile, "a");
  const start = Date.now();
  const processHandle = spawn(process.execPath, [script, ...args], { stdio: ["ignore", log, log], windowsHide: true });
  write(path.join(output, stem + "-process-start.json"), { args, pid: processHandle.pid, startedAt: new Date(start).toISOString(), timeoutMs });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; processHandle.kill(); }, timeoutMs);
  const code = await new Promise((resolve, reject) => { processHandle.on("error", reject); processHandle.on("exit", resolve); });
  clearTimeout(timer); fs.closeSync(log);
  write(path.join(output, stem + "-process.json"), { args, startedAt: new Date(start).toISOString(), elapsedMs: Date.now() - start, exitCode: code, timedOut,
    residualNote: timedOut ? "Synchronous public solver exposes no in-run checkpoint; last residual unknown; input and all completed attempts retained." : undefined });
  return { code, timedOut };
}

function attempts(stem) {
  return fs.readdirSync(output).filter(f => new RegExp(`^${stem}-attempt[0-9]+\\.json$`).test(f)).sort((a, b) => Number(a.match(/attempt(\d+)/)[1]) - Number(b.match(/attempt(\d+)/)[1]));
}
async function run(stem, input, origin, resume = false, recovered = false) {
  const priorFiles = attempts(stem);
  if (priorFiles.length && !resume && !recovered) return read(path.join(output, priorFiles.at(-1)));
  const inputAttempts = fs.readdirSync(output).filter(f => new RegExp(`^${stem}-attempt[0-9]+(?:-|\\.)`).test(f))
    .map(f => Number(f.match(/attempt(\d+)/)[1]));
  // A timed-out child may have no terminal result. Preserve its input/log and do not silently rerun its seed.
  if (!resume && !recovered && inputAttempts.length && !priorFiles.length) return null;
  const attempt = Math.max(0, ...inputAttempts) + 1, basename = stem + "-attempt" + attempt;
  if (resume) {
    assert.ok(priorFiles.length, "Resume requires an accepted state from a saved attempt");
    const prior = read(path.join(output, priorFiles.at(-1)));
    input = { topology: prior.cell.topology, params: prior.params, initialCell: prior.cell, maxIterations: 24000, innerIterations: 3200,
      memorySize: defaultMemorySize(prior.cell.topology.nodesPerLoop) };
    origin = { ...prior.closeout?.origin, ...origin, resumeFrom: priorFiles.at(-1), priorElapsedMs: prior.closeout?.cumulativeElapsedMs ?? prior.diagnostics.elapsedMs,
      priorIterations: prior.closeout?.cumulativeIterations ?? prior.iterations,
      settings: `Continuation from saved accepted state; maxIterations=24000 and innerIterations=3200; memorySize=${input.memorySize}; tolerances unchanged`,
      mode: stem.includes("cold") ? "CONTINUED_PUBLIC_DEFAULT_COLD_PATH" : "CONTINUED_NESTED_BRANCH",
      rationale: `Explicit continuation of the same accepted state; memorySize=${input.memorySize}; unchanged tolerances and model`,
      iterationBudget: { maxIterations: 24000, innerIterations: 3200,
        reason: "Uniform continuation budgets approved: 6000-step truncation reset AL progress; subsequent 4mm strict N64 run exhausted 800-step inner limits in every late outer iteration with oscillating residual. More inner iterations use the existing algorithm and accepted state; original defaults retained in prior attempts", perRunTimeLimitMs: 7200000 } };
  }
  origin.interruptedAttemptsWithUnknownCost = fs.readdirSync(output).filter(f => new RegExp(`^${stem}-attempt[0-9]+-interruption\\.json$`).test(f));
  origin.cumulativeCostIsLowerBound = origin.interruptedAttemptsWithUnknownCost.length > 0;
  const inputFile = path.join(output, basename + "-input.json");
  write(inputFile, { input, origin, createdAt: new Date().toISOString() });
  console.log(JSON.stringify({ event: "START", basename, source: origin.source, resumeFrom: origin.resumeFrom, at: new Date().toISOString() }));
  const execution = await child(["--solve", inputFile, path.join(output, basename + ".json")], basename);
  if (execution.code !== 0) return null;
  const result = read(path.join(output, basename + ".json"));
  console.log(JSON.stringify({ event: "END", basename, status: result.status, nodeRatio: result.equilibrium.nodeRatio,
    iterations: result.iterations, seconds: result.diagnostics.elapsedMs / 1000, W: result.cell.W, H: result.cell.H }));
  return result;
}

async function runCase(key) {
  assert.ok(cases[key], "Unknown case");
  const production = old(cases[key]), length = production.cell.topology.loopLengthMm, params = production.params;
  const levels = key === "3" ? [old("reference.json"), old("refinement-32.json"), old("refinement-64.json")] : [];
  const archivedMinimumShapeChange = key === "3" ? Math.min(...levels.slice(1).flatMap((r, i) => Object.values(changes(levels[i], r)).map(Math.abs))) : null;
  if (key === "3") for (const level of levels) {
    const fixedGeometryQuadrature = quadrature(level);
    level.closeout = { reusedArchive: true, mainChainRecomputed: false, fixedGeometryQuadrature,
      integrationComparison: { shapeChange: archivedMinimumShapeChange, suggestedOneTenthThreshold: archivedMinimumShapeChange / 10,
        contactAndForceSmallComparedToShape: fixedGeometryQuadrature.contactEnergyRelativeError < archivedMinimumShapeChange / 10 && fixedGeometryQuadrature.relativeGradientError < archivedMinimumShapeChange / 10,
        note: "Read archived geometry and independently evaluate q12/q24; no relaxation or main-chain recomputation. Actual smallest adjacent density change is recorded separately." } };
    write(path.join(output, `case-3-N${level.cell.topology.nodesPerLoop}-fixed-quadrature.json`), fixedGeometryQuadrature);
  }
  const method = key === "3" ? "Reused archived Hermite smooth arclength remeshing; fine rest lengths reassigned with total length preserved; no main-chain rerun" :
    "New nested linear material-arclength subdivision preserving all parent material intervals and old nodes";
  const status = { case: key, lengthMm: length, method, productionFile: cases[key], materialSource: cases[key], levels: [], status: "RUNNING" };
  const saveStatus = () => {
    status.levels = levels.map(r => ({ nodes: r.cell.topology.nodesPerLoop, status: r.status, metrics: r.metrics, energy: r.energy,
      iterations: r.iterations, settings: r.settings,
      resultFile: key === "3" ? path.join(archive, ({ 24: "reference.json", 32: "refinement-32.json", 64: "refinement-64.json" })[r.cell.topology.nodesPerLoop]) :
        path.join(output, attempts(`case-${key}-N${r.cell.topology.nodesPerLoop}`).at(-1)),
      equilibrium: r.equilibrium, constraints: r.constraints, clearance: r.clearance, branch: identity(r), diagnostics: r.diagnostics,
      closeout: r.closeout ?? { reusedArchive: true } }));
    status.assessment = assess(levels.filter(r => r.status === "CONVERGED"));
    const fine = levels.filter(r => r.status === "CONVERGED").at(-1);
    if (fine && fine.cell.topology.nodesPerLoop > 32) status.productionN32RelativeError = Object.fromEntries(["wale", "course"].map(k =>
      [k, Math.abs(production.metrics[k + "DensityPerCm"] / fine.metrics[k + "DensityPerCm"] - 1)]));
    write(path.join(output, `case-${key}-summary.json`), status);
  };
  if (key !== "3") {
    for (const nodes of [24, 32, 64, 128, 256]) {
      if (nodes === 128) {
        const a = assess(levels);
        const ratio4 = a.deltas.length >= 2 && ["wale", "course"].some(k => Math.abs(a.deltas[0][k]) > 4 * Math.abs(a.deltas[1][k]));
        if (key === "sop" || key === "2.6" && a.convergenceEstablished && !ratio4 || key === "3.5" && a.convergenceEstablished) break;
      }
      if (nodes === 256 && (key !== "4" || assess(levels).convergenceEstablished)) break;
      const initialCell = nodes === 24 ? scaledReference(length) : subdivideMaterialEdges(levels.at(-1).cell, nodes);
      if (key === "sop") for (const field of ["lengthSource", "lengthConfidence"]) initialCell.topology[field] = production.cell.topology[field];
      const previous = levels.at(-1);
      const origin = { case: key, nodes, chain: "Nested material-preserving subdivision", source: nodes === 24 ? "Archived reference.json N24 normalized to case length, same source-connected branch rule" : `case-${key}-N${previous.cell.topology.nodesPerLoop}`,
        separateFromFrozenN32MaterialPartition: true, refinement: initialCell.refinement ?? null,
        initialBendingEnergy: evaluateRodBending(initialCell, params.B).energy,
        parentEquilibriumBendingEnergy: previous?.energy.bending ?? null,
        initialStrain: evaluateLengthConstraints(initialCell).maxStrain };
      const result = await run(`case-${key}-N${nodes}`, { topology: initialCell.topology, params, initialCell }, origin);
      if (!result) {
        const stopped = fs.readdirSync(output).filter(f => new RegExp(`^case-${key}-N${nodes}-attempt[0-9]+-stop\\.json$`).test(f));
        status.status = stopped.length ? "STAGNATION_STOP_INCOMPLETE" : "PROCESS_INCOMPLETE";
        status.stoppedAttemptFiles = stopped;
        saveStatus(); return;
      }
      levels.push(result); saveStatus();
      if (result.status !== "CONVERGED") { status.status = "NOT_CONVERGED_REVIEW_BEFORE_RESUME"; saveStatus(); return; }
      const q = result.closeout.fixedGeometryQuadrature;
      const delta = previous ? changes(previous, result) : null;
      const shapeChange = delta ? Math.min(Math.abs(delta.wale), Math.abs(delta.course)) : .005;
      result.closeout.integrationComparison = { shapeChange, suggestedOneTenthThreshold: shapeChange / 10,
        contactAndForceSmallComparedToShape: q.contactEnergyRelativeError <= shapeChange / 10 && q.relativeGradientError <= shapeChange / 10 };
      if (!result.closeout.integrationComparison.contactAndForceSmallComparedToShape) {
        status.status = "INTEGRATION_REQUIRES_REVIEW"; saveStatus(); return;
      }
      if (previous) {
        const before = crossingSignature(previous.cell), after = crossingSignature(result.cell);
        const rawEqual = JSON.stringify(before) === JSON.stringify(after);
        const cyclicEqual = canonicalCyclicSignature(before) === canonicalCyclicSignature(after);
        result.closeout.branchComparison = { rawBefore: before, rawAfter: after, rawEqual, cyclicEqual,
          periodicSeamShift: !rawEqual && cyclicEqual, protectedTrajectory: result.trajectory.passed,
          energyRelative: result.energy.total / previous.energy.total - 1,
          shearBefore: previous.cell.S / previous.cell.W, shearAfter: result.cell.S / result.cell.W,
          scope: "Projection seam diagnostic with protected continuous geometry; not a complete topological invariant or proof of branch uniqueness" };
        write(path.join(output, `case-${key}-N${nodes}-branch-assessment.json`), result.closeout.branchComparison);
        if (!cyclicEqual || !result.trajectory.passed) {
          status.status = "PROJECTION_SIGNATURE_CHANGED_REVIEW_BRANCH"; saveStatus(); return;
        }
      }
    }
  }
  status.status = key === "sop" ? "REPORT_ONLY" : assess(levels).convergenceEstablished ? "ROD_DENSITY_CRITERION_ESTABLISHED" : "CONVERGENCE_NOT_ESTABLISHED";
  saveStatus();
}

async function runCold(key) {
  const production = old(cases[key]);
  const topology = createPlainJerseyTopology({ nodesPerLoop: 64, loopLengthMm: production.cell.topology.loopLengthMm });
  const input = { topology, params: production.params, memorySize: defaultMemorySize(topology.nodesPerLoop) };
  const result = await run(`case-${key}-cold-N64`, input,
    { case: key, mode: "PUBLIC_DEFAULT_COLD", settings: `nodesPerLoop=${topology.nodesPerLoop}; memorySize=${input.memorySize}; no initialCell and other solver defaults unchanged` });
  if (result) write(path.join(output, `case-${key}-cold-summary.json`), { status: result.status, metrics: result.metrics, energy: result.energy,
    branch: identity(result), constraints: result.constraints, equilibrium: result.equilibrium, closeout: result.closeout });
}

function summarize() {
  const adjudicationFile = path.join(output, "adjudication.json");
  const adjudications = fs.existsSync(adjudicationFile) ? read(adjudicationFile).cases : {};
  const rows = ["2.6", "3", "3.5", "4", "sop"].map(key => {
    const file = path.join(output, `case-${key}-summary.json`), coldFile = path.join(output, `case-${key}-cold-summary.json`);
    const chain = fs.existsSync(file) ? read(file) : null, cold = fs.existsSync(coldFile) ? read(coldFile) : null;
    if (chain) for (const level of chain.levels) {
      level.resultFile ??= key === "3" ? path.join(archive, ({ 24: "reference.json", 32: "refinement-32.json", 64: "refinement-64.json" })[level.nodes]) :
        path.join(output, attempts(`case-${key}-N${level.nodes}`).at(-1));
      const saved = read(level.resultFile);
      level.iterations ??= saved.iterations;
      level.settings ??= saved.settings;
    }
    const eligible = chain?.levels.filter(r => r.status === "CONVERGED") ?? [], fine = eligible.at(-1), n64 = eligible.find(r => r.nodes === 64);
    const production = old(cases[key]);
    const withinB = metrics => ({ kw: metrics.kw >= 3.4 && metrics.kw <= 4.3,
      kc: metrics.kc >= 4.4 && metrics.kc <= 5.8, ratio: metrics.kcOverKw >= 1.15 && metrics.kcOverKw <= 1.5 });
    const comparison = n64 && cold ? { coldStatus: cold.status, continuationStatus: n64.status,
      sameProjectedCrossingSignature: JSON.stringify(n64.branch.crossingSignatureXY) === JSON.stringify(cold.branch.crossingSignatureXY),
      sameCyclicProjectedWord: canonicalCyclicSignature(n64.branch.crossingSignatureXY) === canonicalCyclicSignature(cold.branch.crossingSignatureXY),
      sameDirectedTopologyMetadata: JSON.stringify(n64.branch.directedTopology) === JSON.stringify(cold.branch.directedTopology),
      densityRelativeColdToContinuation: changes(n64, cold), energyRelativeColdToContinuation: cold.energy.total / n64.energy.total - 1,
      continuationShearOverWidth: n64.branch.shearOverWidth, coldShearOverWidth: cold.branch.shearOverWidth,
      note: "Different N64 material partitions remain explicit; signature, shear and energy diagnose branch consistency, not global uniqueness. Raw sign near zero alone is not a branch switch." } : null;
    const integrationVerified = eligible.length > 0 && eligible.every(level => {
      const q = level.closeout.fixedGeometryQuadrature;
      if (!q) return key === "3" ? null : false;
      const check = level.closeout.integrationComparison;
      return check?.contactAndForceSmallComparedToShape === true;
    });
    const requiredNodes = [24, 32, 64];
    if (key === "4") requiredNodes.push(128);
    const d64 = chain?.assessment?.deltas.find(d => d.to === 64), d32 = chain?.assessment?.deltas.find(d => d.to === 32);
    const at64 = eligible.some(level => level.nodes === 64) ? assess(eligible.filter(level => level.nodes <= 64).map(level => ({ ...level, cell: { topology: { nodesPerLoop: level.nodes } } }))) : null;
    if (key === "2.6" && at64 && (!at64.convergenceEstablished || d64 && d32 && ["wale", "course"].some(k => Math.abs(d32[k]) > 4 * Math.abs(d64[k])))) requiredNodes.push(128);
    if (key === "3.5" && at64 && !at64.convergenceEstablished) requiredNodes.push(128);
    const at128 = key === "4" && eligible.some(level => level.nodes === 128) ? assess(eligible.filter(level => level.nodes <= 128).map(level => ({ ...level, cell: { topology: { nodesPerLoop: level.nodes } } }))) : null;
    if (at128 && !at128.convergenceEstablished) requiredNodes.push(256);
    const requiredLevelsConverged = requiredNodes.every(n => eligible.some(level => level.nodes === n));
    const decision = adjudications?.[key];
    const currentColdFile = cold?.closeout?.resultFile ?? (attempts(`case-${key}-cold-N64`).at(-1) ?? "");
    const currentN64File = n64?.resultFile ?? "";
    const adjudicationCurrent = decision && path.basename(decision.coldResultFile ?? "") === path.basename(currentColdFile)
      && path.basename(decision.continuationN64File ?? "") === path.basename(currentN64File);
    const branchReviewCurrent = adjudicationCurrent && path.basename(decision.finestResultFile ?? "") === path.basename(fine?.resultFile ?? "");
    const branchReviewed = !!(branchReviewCurrent && decision.branchReviewed);
    const coldValidated = !!(adjudicationCurrent && decision.coldValidated && cold?.status === "CONVERGED" && n64?.status === "CONVERGED");
    return { case: key, lengthMm: production.cell.topology.loopLengthMm, tex: production.params.tex,
      method: chain?.method ?? (key === "3" ? "Reused archived smooth remeshing; not a nested-material chain" : "New nested linear subdivision"),
      chainStatus: chain?.status ?? "NOT_RUN", reportOnly: key === "sop", convergence: chain?.assessment ?? null,
      stoppedAttemptFiles: chain?.stoppedAttemptFiles ?? [],
      rodDensityCriterion: chain?.assessment?.convergenceEstablished ?? false, requiredNodes, requiredLevelsConverged, integrationVerified,
      integrationScope: "Converged main-chain levels only; unfinished levels have no terminal quadrature validation",
      unverifiedRequiredNodes: requiredNodes.filter(n => !eligible.some(level => level.nodes === n)),
      branchReviewed, coldValidated, adjudication: adjudicationCurrent ? decision : null,
      overallA14: key === "sop" ? "REPORT_ONLY" : !requiredLevelsConverged ? "INCOMPLETE_REQUIRED_LEVELS" : !chain?.assessment?.convergenceEstablished ? "NOT_ESTABLISHED_ROD_DENSITY_CRITERION" :
        !integrationVerified ? "NOT_ESTABLISHED_INTEGRATION_UNCONFIRMED" : !coldValidated ? "NOT_ESTABLISHED_COLD_PATH_UNCONFIRMED" :
          !branchReviewed ? "NOT_ESTABLISHED_BRANCH_UNREVIEWED" : "ESTABLISHED",
      adjudicationNote: "Density, quadrature and branch/cold evidence are independent. Final numerical/branch review is required; solver CONVERGED alone does not establish A14.",
      finestConvergedNodes: fine?.nodes ?? null, finestResultFile: fine?.resultFile ?? null, finestMetrics: fine?.metrics ?? null,
      productionN32RelativeError: chain?.productionN32RelativeError ?? null,
      productionN32WithinHalfPercent: chain?.productionN32RelativeError ? Object.values(chain.productionN32RelativeError).every(v => v <= .005) : null,
      productionB: withinB(production.metrics), finestB: fine ? withinB(fine.metrics) : null,
      coldComparison: comparison, coldStatus: cold?.status ?? "NOT_RUN", levels: chain?.levels ?? [] };
  });
  write(path.join(output, "closeout-summary.json"), { generatedAt: new Date().toISOString(), rows,
    materialPolicy: "Four new chains use nested old-node/material-boundary preserving linear subdivision. The authorized 3mm reuse is the archived smooth remeshing chain; methods are not conflated. Solver fixes each mesh's material intervals.",
    interpretation: "CONVERGED solver status and established mesh convergence are separate. Finest available converged level is not automatically a converged continuum reference." });
  console.log(JSON.stringify(rows.map(({ case: key, chainStatus, finestConvergedNodes, coldStatus }) => ({ case: key, chainStatus, finestConvergedNodes, coldStatus })), null, 2));
}

function report() {
  summarize();
  const summary = read(path.join(output, "closeout-summary.json"));
  const number = (value, digits = 6) => value == null ? "—" : Number(value).toFixed(digits);
  const sci = value => value == null ? "—" : Number(value).toExponential(3);
  const percent = value => value == null ? "—" : number(100 * value) + "%";
  const pair = value => value ? `${percent(value.wale)} / ${percent(value.course)}` : "—";
  const cumulativeSeconds = (value, incomplete) => (incomplete ? "≥" : "") + number(value / 1000, 3) + (incomplete ? "（中断成本未知）" : "");
  const table = (headers, rows) => ["| " + headers.join(" | ") + " |", "| " + headers.map(() => "---").join(" | ") + " |",
    ...rows.map(row => "| " + row.join(" | ") + " |")].join("\n");
  const lines = ["## (a) A14 杆离散补齐", "", "本节由完整输入/终态 JSON 汇总。求解器 CONVERGED、杆密度序列判据、积分精度和冷起步同支确认分别报告；最细已求得平衡解不自动等同已建立连续极限精度。五条首次默认公开N64调用均未在默认预算内收敛；下表的最终冷路径状态包含从已接受态继续的后续续算。", "",
    table(["工况 mm", "最细可用平衡 N", "最细相邻≤0.5%", "逐级变化递减", "严格序列判据", "生产 N32 横/纵误差（相对最细可用平衡级）", "积分核验", "公开冷起步路径（含续算）", "整体 A14"], summary.rows.map(r => [r.lengthMm, r.finestConvergedNodes ?? "—",
      r.convergence?.finestAdjacentWithinTolerance ? "是（已算级）" : "否", r.convergence?.changesDecreaseAtEveryLevel ? "是" : r.levels.length < 3 ? "级数不足" : "否",
      r.reportOnly ? "只报告" : r.rodDensityCriterion ? "满足密度子判据" : "尚未建立", pair(r.productionN32RelativeError), r.integrationVerified ? "已平衡级固定几何通过" : "未全部确认",
      r.coldStatus + (r.coldValidated ? "；同支一致诊断已确认" : "；同支尚未确认"), r.overallA14])), "",
    "相邻变化 Δ=(细级密度/粗级密度−1)，以粗级作分母；生产 N32 误差=|N32/最细可用平衡级−1|，以该平衡级作分母。它是有限网格间对照，不是连续极限误差：4mm必做N128尚未平衡，3mm虽N32对N64误差达标但严格逐级递减未成立。无高于N32的平衡参考时误差不作判定。下表另列相邻变化以细级作分母的数值，排除临界点歧义。log₂(Δ粗/Δ细)只作诊断；24→32与32→64倍率不同，不可将其当严格渐近阶数。", "",
    "3mm按旧报告只看最细相邻两级/生产N32对细级≤0.5%的解释仍达标；按本任务明确要求的相邻变化逐级递减，纵密变化0.435163%→0.439458%略增，因此严格收敛尚未建立。2.6mm、3.5mm及SOP停于主链N64未平衡；4mmN64已平衡，但必做N128停滞未完成，故未启动依赖N128平衡输入的N256。积分通过仅覆盖已平衡主链级，未完成的高N没有终态积分验证。", "",
    "3.0 mm 的24→32→64按授权只读复用旧存档，原方法为Hermite平滑弧长重采样并重新分配细网格restLength，总长保持；未重算这条主链。其余四条为本轮严格嵌套材料细分：N24沿旧3mm参考几何归一缩放；24→32确定性拆最长材料边，之后逐边二分，保留旧节点、旧材料边界以及父段参考长度和。两类方法不混称同一方法。各级求解期间段参考长度均固定。", "",
    "严格新链的N32与旧生产N32来自不同离散分段，两者分别保存。全二分保持初始折线几何，却使旧拐角双侧长度减半，所以初始离散弯曲能可加倍；该初值表示变化不直接判为平衡分支改变。子段继承旧应变，未宣称精确零应变。每个新网格重新检查非局部候选间隙，未假设几何相同就自动可行。", ""];
  lines.push("执行前复现了既有独立细化脚本的自检初值错误：默认拓扑已经是N32，却再次要求加密到N32。按任务先停止并报告，用户明确授权后仅把自检初值写成nodesPerLoop:24，自检通过；原细化helper、求解器、材料及模型均未因该错误修改。复现与修正核验见implementation-error.json、self-check-failure.log和self-check-approved-fix.log；新嵌套细分独立自检见nested-subdivision-self-check.json。", "");
  for (const row of summary.rows) {
    lines.push(`### ${row.lengthMm} mm${row.reportOnly ? "（SOP 反事实参考）" : ""}`, "", row.method, "");
    const deltas = row.convergence?.deltas ?? [], orders = row.convergence?.diagnosticLog2ChangeRatios ?? [];
    lines.push(table(["N", "状态", "横密 /cm", "纵密 /cm", "kw", "kc", "kc/kw", "S/W", "Δ横/纵（粗分母）", "Δ横/纵（细分母）", "log₂变化比 横/纵"], row.levels.map(level => {
      const i = deltas.findIndex(d => d.to === level.nodes), d = deltas[i], p = i > 0 ? orders[i - 1] : null;
      return [level.nodes, level.status, number(level.metrics.waleDensityPerCm), number(level.metrics.courseDensityPerCm), number(level.metrics.kw), number(level.metrics.kc), number(level.metrics.kcOverKw), sci(level.branch.shearOverWidth), pair(d), pair(d?.fineDenominator), p ? number(p.wale, 3) + " / " + number(p.course, 3) : "—"];
    })), "");
    lines.push(table(["N", "总能/弯曲/接触/势垒 N·mm", "A2最大段应变", "A4节点比", "自由格矢残差 W/H N", "格矢残差比 W/H/S", "r_min/r_c", "最大曲率 /mm", "接触段对", "累计迭代", "累计秒"], row.levels.map(level => [
      level.nodes, [level.energy.total, level.energy.bending, level.energy.contact, level.energy.barrier].map(sci).join(" / "), sci(level.constraints.maxSegmentStrain), sci(level.equilibrium.nodeRatio),
      [level.equilibrium.R_W ?? level.equilibrium.latticeResidual?.[0], level.equilibrium.R_H ?? level.equilibrium.latticeResidual?.[1]].map(sci).join(" / "),
      level.equilibrium.latticeRatios.map(sci).join(" / "),
      number(level.clearance.ratioToCompaction), number(level.branch.geometry.maxDiscreteCurvaturePerMm), level.clearance.activePairs,
      (level.closeout.cumulativeCostIsLowerBound ? "≥" : "") + (level.closeout.cumulativeIterations ?? level.diagnostics.cumulativeIterations ?? (row.case === "3" && level.nodes > 24 ? `未知（末次${level.iterations}）` : level.iterations)) +
        (level.closeout.cumulativeCostIsLowerBound ? "（中断步数未知）" : ""),
      cumulativeSeconds(level.closeout.cumulativeElapsedMs ?? level.diagnostics.cumulativeElapsedMs ?? level.diagnostics.elapsedMs,
        level.closeout.cumulativeCostIsLowerBound || row.case === "3" && level.nodes === 64)])), "");
    lines.push(table(["N", "q12→q24接触能相对差", "raw总梯度相对∞范数差", "q24节点比", "q24格矢比 W/H/S"], row.levels.map(level => {
      const q = level.closeout.fixedGeometryQuadrature;
      return [level.nodes, sci(q?.contactEnergyRelativeError), sci(q?.relativeGradientError), sci(q?.q24NodeRatio), q?.q24LatticeRatios.map(sci).join(" / ") ?? "—"];
    })), "");
    if (row.coldComparison) lines.push("N64冷起步与延拓的数值对照：密度相对差（冷/延拓−1）=" + pair(row.coldComparison.densityRelativeColdToContinuation) +
      "，能量相对差=" + percent(row.coldComparison.energyRelativeColdToContinuation) + "，S/W（延拓/冷）=" + sci(row.coldComparison.continuationShearOverWidth) + " / " + sci(row.coldComparison.coldShearOverWidth) +
      "；循环投影穿套字一致=" + row.coldComparison.sameCyclicProjectedWord + "。若冷路径尚未收敛，以上仅为未收敛终态诊断，不能确认同支。", "");
    if (row.adjudication?.review) lines.push("人工复核：" + row.adjudication.review, "");
  }
  lines.push("### 失败、续算与成本", "", "以下保留每次独立运行。续算只从同一已接受状态继续，未放宽容差、改变材料或修改模型；首次默认冷起步未收敛的事实不被后续续算覆盖。", "");
  const attemptRows = fs.readdirSync(output).filter(f => /^case-.*-attempt\d+\.json$/.test(f)).sort().map(file => {
    const r = read(path.join(output, file));
    return [file, r.status, r.optimizerStatus, `${r.settings.maxIterations}/${r.settings.innerIterations}/${r.settings.memorySize}`, r.iterations, sci(r.equilibrium.nodeRatio), sci(r.constraints.maxSegmentStrain), number(r.diagnostics.elapsedMs / 1000, 3), cumulativeSeconds(r.closeout.cumulativeElapsedMs, r.closeout.cumulativeCostIsLowerBound)];
  });
  lines.push(table(["结果文件", "状态", "终止原因", "总/内层预算/memorySize", "本次迭代", "节点残差比", "最大段应变", "本次秒", "该级累计秒"], attemptRows), "",
    "初次公开cold运行均保持默认maxIterations=6000、innerIterations=800。先因6000次截断重置AL进度，将后续续算总预算统一增至24000；4mm严格N64在此预算下末12层仍全部INNER_LIMIT、内层梯度振荡，随后批准把后续需要的续算内层预算统一增至3200。memorySize=60、原maxOuterIterations=60、容差和模型不变；已收敛级不重跑、运行中变量不改。每次input/settings记录实际采用的6000/800、24000/800或24000/3200，每个单次进程两小时上限。自 bf5f25d 起默认 memorySize 按 N 分配，见 settings。", "",
    "计算曾并发执行，环境恢复后的实际同时求解最多4个进程；各记录为对应进程的实际墙钟，包含竞争资源和只读调试开销，不作为独占机器性能基准。环境中断期间无法确认的求解时间未计入已知成本。", "",
    "2.6 mm严格N64的只读检查显示近势垒暂态：检查点距rc仅1.17549e-8 mm，一次固定几何总能量/力求值约43.377秒；反力CHOLESKY约16.7毫秒。五秒CPU采样主要在势垒的径向积分。线性细分初值满秩、间隙可行、势垒不激活，但曲率集中和较大初始反力乘子可能引发大应变暂态。此证据定位数值代价，不证明模型平衡错误或实现正确性bug，未因此修改初罚项、积分公式或初值。只读检查暂停及采样开销保留在求解墙钟耗时中，详见readonly-profiling-note.json及检查点文件。", "",
    "raw总梯度的相对∞范数差不是形态误差的严格上界；本次同时报告q24约束反力投影后的节点/格矢残差，以支持积分精度诊断。分支诊断保留原始固定XY投影穿套序列与周期切缝循环归一结果，并结合连续非局部间隙保护、能量及剪切；投影穿套字不是完整拓扑不变量，也不单独证明全局唯一分支。", "",
    "### 未完成级与整体门控", "", table(["工况", "必做节点", "必做级均收敛", "主链状态", "冷路径状态", "整体门控"], summary.rows.map(row => [row.lengthMm, row.requiredNodes.join("→"), row.requiredLevelsConverged, row.chainStatus, row.coldStatus, row.overallA14])), "",
    "各级完整输入、材料六字段来源、设置、初值可行性、段映射和所有终态diagnostics见同目录 *-input.json、*-initial-check.json、*-attempt*.json、*-branch-assessment.json 与 closeout-summary.json。本轮未修改src求解器或B暂定区间，未注册validator。", "");
  const interruptions = fs.readdirSync(output).filter(f => /-attempt\d+-interruption\.json$/.test(f)).map(f => read(path.join(output, f)));
  if (interruptions.length) lines.push("### 环境中断（不视为数值失败或超时）", "",
    "下列尝试没有完整result或正常process退出记录。环境恢复时未发现存活进程；终止时刻、已用求解时间与中断后的最后残差均未知，不能用环境空档替代CPU或求解耗时，也不能伪称触发两小时上限。表中checkpoint是更早已确认的接受态，未必是中断前最后一步。恢复仅指已接受几何/材料态重建并重新进入公开求解器，未恢复AL乘子、L-BFGS记忆等内部状态。相关续算的累计时间/迭代只列≥已知部分，原中断成本与额外步数仍未知。", "",
    table(["尝试", "状态", "已确认checkpoint", "已确认迭代", "已确认最大段应变", "终止时间/求解耗时"], interruptions.map(r => [r.attempt, r.status,
      r.knownCheckpoint?.file ?? "无", r.knownCheckpoint?.iterations ?? "未知", sci(r.knownCheckpoint?.maxConstraint), "未知 / 未知"])), "");
  const stopped = fs.readdirSync(output).filter(f => /-attempt\d+-stop\.json$/.test(f)).map(file => {
    const record = read(path.join(output, file)), stem = file.replace(/-stop\.json$/, "");
    const checkpoint = read(path.join(output, record.lastCheckpoint));
    const processFile = path.join(output, stem + "-process.json");
    return { file, ...record, checkpoint, process: fs.existsSync(processFile) ? read(processFile) : null };
  });
  if (stopped.length) lines.push("### 有明确停滞证据的提前停止", "",
    "以下尝试在单次两小时上限之前主动停止，状态为STAGNATION_STOP/未完成；不是超时，也不据此判定模型错误或实现bug。最近已确认的接受态、梯度、残差及停止原因均另存；检查点与实际停止之间可能仍有未保存步骤，检查点不冒充停止瞬间的完整终态。表中的墙钟与CPU是该次进程的已知成本，原环境中断尝试的成本和额外未知步数不补估。", "",
    table(["尝试", "停止时刻 UTC", "已确认迭代/评估", "能量", "最大段应变", "节点比", "本次墙钟秒", "本次CPU秒"], stopped.map(r => [
      r.file, r.stoppedAt, `${r.checkpoint.iterations}/${r.checkpoint.evaluations}`, sci(r.checkpoint.energy),
      sci(r.checkpoint.constraint), sci(r.checkpoint.currentPhysicalResidual.nodeRatio), number(r.process?.elapsedMs / 1000, 3), number(r.cpuSeconds, 3)])), "",
    ...stopped.flatMap(r => [`${r.file}：${r.reasonZh ?? r.reason}`, ""]));
  lines.push("### 供后续另行授权的建议", "",
    "若严格链仍未完成，可分别研究保留父材料区间的平滑弧长加密，或另行设计的内外层预算调度系统对照，区分初始离散反力/增广拉格朗日暂态与最终平衡模型问题。前者需证明旧材料映射、局部不可伸长、总长与非局部间隙保护；后者需记录计算成本及原容差下的结果一致性。本轮已根据实际停滞证据调整公开迭代预算；保材料平滑加密及另行设计的系统对照尚未实施，也未换初值以求通过。当前环境中断、停滞或未收敛证据不足以归咎于物理模型或确认现有代码正确性错误。", "");
  fs.writeFileSync(path.join(output, "A14-RESULTS.md"), lines.join("\n"));
}

const [mode, argument, extra] = process.argv.slice(2);
if (mode === "--solve") {
  const { input, origin } = read(argument);
  const initialCell = input.initialCell ?? createFabricFormInitialGeometry(input.topology, input.params);
  const initialContact = origin.checkpointRecoveryVerification ? read(path.join(output, origin.checkpointRecoveryVerification)) :
    evaluatePeriodicContact(initialCell, input.params, { quadratureOrder: 12 });
  write(extra.replace(/\.json$/, "-initial-check.json"), { feasible: initialContact.feasible, minDistance: initialContact.minDistance,
    diagnostics: initialContact.diagnostics, strain: evaluateLengthConstraints(initialCell).maxStrain,
    bendingEnergy: evaluateRodBending(initialCell, input.params.B).energy, signature: crossingSignature(initialCell) });
  const result = solveFabricCell(input);
  result.closeout = { origin, resultFile: extra, cumulativeElapsedMs: (origin.priorElapsedMs ?? 0) + result.diagnostics.elapsedMs,
    cumulativeIterations: (origin.priorIterations ?? 0) + result.iterations, cumulativeCostIsLowerBound: origin.cumulativeCostIsLowerBound,
    unknownCostAttempts: origin.interruptedAttemptsWithUnknownCost, branch: identity(result) };
  write(extra, result);
  if (result.clearance.feasible) {
    result.closeout.fixedGeometryQuadrature = quadrature(result);
    write(extra, result);
  }
  console.log(JSON.stringify({ status: result.status, nodeRatio: result.equilibrium.nodeRatio, elapsedMs: result.diagnostics.elapsedMs }));
} else if (mode === "--case") await runCase(argument);
else if (mode === "--cold") await runCold(argument);
else if (mode === "--summary") summarize();
else if (mode === "--report") report();
else if (mode === "--resume") {
  await run(argument, null, {}, true);
} else if (mode === "--recover") {
  const prepared = read(argument), verificationFile = argument.replace(/-input\.json$/, "-verification.json"), verified = read(verificationFile);
  assert.ok(verified.feasible && verified.relativeEnergyDifference < 1e-10 && verified.constraintDifference < 1e-12,
    "Recovery requires independent energy, material-constraint and gap verification");
  const original = read(path.join(output, verified.sourceInput)), checkpoint = read(path.join(output, verified.checkpoint));
  assert.deepEqual(prepared.input.params, original.input.params);
  assert.deepEqual(prepared.input.topology, original.input.initialCell.topology);
  const values = Object.values(checkpoint.x).map(v => v * prepared.input.topology.loopLengthMm);
  assert.deepEqual([...prepared.input.initialCell.positions.flat(), prepared.input.initialCell.W, prepared.input.initialCell.H, prepared.input.initialCell.S], values);
  assert.equal(prepared.input.maxIterations, 24000); assert.equal(prepared.input.innerIterations, 3200);
  if (prepared.input.memorySize === undefined) prepared.input.memorySize = defaultMemorySize(prepared.input.topology.nodesPerLoop);
  assert.equal(prepared.input.memorySize, defaultMemorySize(prepared.input.topology.nodesPerLoop));
  prepared.origin.checkpointRecoveryVerification = path.basename(verificationFile);
  prepared.origin.mode = "CONTINUED_VERIFIED_ACCEPTED_CHECKPOINT";
  prepared.origin.resumptionNote = "Environment interrupted the original process; accepted coordinates/material state recovered exactly, optimizer internal history restarts via the existing public entry";
  await run(`case-${prepared.origin.case}-N64`, prepared.input, prepared.origin, false, true);
} else if (mode === "--restart-interrupted") {
  const previousInput = read(argument), interruption = read(argument.replace(/-input\.json$/, "-interruption.json"));
  assert.equal(interruption.status, "ENVIRONMENT_INTERRUPTED");
  assert.equal(interruption.knownCheckpoint, null, "Use verified accepted-state recovery when a checkpoint exists");
  assert.ok(previousInput.input.initialCell, "This mode restarts the original refinement input, not a cold path");
  const stem = path.basename(argument).replace(/-attempt\d+-input\.json$/, "");
  const input = { ...previousInput.input, maxIterations: 24000, innerIterations: 3200,
    memorySize: previousInput.input.memorySize === undefined ? defaultMemorySize(previousInput.input.topology.nodesPerLoop) : previousInput.input.memorySize };
  await run(stem, input, { ...previousInput.origin, sourceInput: path.basename(argument),
    mode: "RESTART_ORIGINAL_INPUT_AFTER_ENVIRONMENT_INTERRUPTION", priorElapsedMs: 0, priorIterations: 0,
    priorElapsedIsUnknown: true, resumptionNote: "No accepted checkpoint exists; this is a new attempt from the identical original N32-refined geometry/material input, not restoration of the interrupted optimizer state",
    settings: `Uniform continuation budget maxIterations=24000, innerIterations=3200; memorySize=${input.memorySize}; model/material/tolerances unchanged` }, false, true);
} else if (mode === "--self-check") {
  const source = old("reference.json"), before = JSON.stringify(source.cell);
  const rows = [];
  let cell = source.cell;
  for (const count of [32, 64]) {
    const parent = cell; cell = subdivideMaterialEdges(parent, count);
    const strain = evaluateLengthConstraints(cell).maxStrain, priorStrain = evaluateLengthConstraints(parent).maxStrain;
    assert.ok(Math.abs(strain - priorStrain) < 1e-13);
    assert.ok(Math.abs(cell.refinement.targetTotalReferenceLength - 3) < 1e-13);
    assert.ok(parent.positions.every(point => cell.positions.some(other => JSON.stringify(other) === JSON.stringify(point))));
    const contact = evaluatePeriodicContact(cell, source.params);
    assert.ok(contact.feasible, "Reference subdivision remains feasible under the refined candidate set");
    rows.push({ count, strain, minDistance: contact.minDistance, bendingRatio: evaluateRodBending(cell, source.params.B).energy / evaluateRodBending(parent, source.params.B).energy,
      maxParentLengthError: cell.refinement.maxParentLengthError });
  }
  assert.equal(JSON.stringify(source.cell), before);
  write(path.join(output, "nested-subdivision-self-check.json"), { status: "PASS", rows });
  console.log(JSON.stringify({ status: "PASS", rows }, null, 2));
} else if (mode === "--all") {
  const queue = ["2.6", "3", "3.5", "4", "sop"].flatMap(key => [["--case", key], ["--cold", key]]);
  const worker = async () => { while (queue.length) { const task = queue.shift(); console.log("TASK " + task.join(" "));
    await child(task, task[0].slice(2) + "-" + task[1] + "-chain", 24 * 60 * 60 * 1000); } };
  await Promise.all([worker(), worker()]);
  summarize();
} else throw new Error("Use --self-check | --all | --summary | --case <2.6|3|3.5|4|sop> | --cold <case> | --resume <case-X-Nxx>");
