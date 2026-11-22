import assert from "node:assert/strict";
import { createFabricFormParams } from "../../src/fabricForm/fabricFormParams.js";
import { evaluateFabricCell, packFabricCell, unpackFabricCell } from "../../src/fabricForm/solveFabricCell.js";
import { evaluateLengthConstraints } from "../../src/fabricForm/rodBending.js";
import { actualEdgeVector, replicatePeriodicCell } from "../../src/fabricForm/periodicCell.js";
import { runBarrierSubdivisionChecks, runIntegratedBarrierChecks } from "./fabricFormPeriodicContactChecks.mjs";

const maximum = values => values.reduce((value, next) => Math.max(value, Math.abs(next)), 0);
function vectorDifference(actual, expected, floor = 1e-14) {
  assert.equal(actual.length, expected.length);
  const absolute = maximum(Array.from(actual, (value, i) => value - expected[i]));
  return { absolute, relative: absolute / Math.max(floor, maximum(actual), maximum(expected)) };
}
function requireVector(actual, expected, tolerance, label, floor) {
  const error = vectorDifference(actual, expected, floor);
  assert.ok(Number.isFinite(error.relative) && error.relative <= tolerance,
    `${label}: relative infinity-norm error ${error.relative} exceeds ${tolerance}`);
  return error;
}
function requireScalar(actual, expected, tolerance, label) {
  const error = Math.abs(actual - expected) / Math.max(1e-14, Math.abs(actual), Math.abs(expected));
  assert.ok(Number.isFinite(error) && error <= tolerance, `${label}: ${actual} versus ${expected}, error ${error}`);
  return error;
}
function materialInputs(params) {
  return Object.fromEntries(["tex", "densityGPerCm3", "fiberDiameterMm", "E_f", "K", "phi0"]
    .map(key => [key, params[key]]));
}
function pullBack(vector, repeated, sourceNodeCount) {
  const result = new Float64Array(3 * sourceNodeCount + 3);
  const sourceLattice = result.length - 3, targetLattice = vector.length - 3;
  const { sourceNodeIndices, sourceOffsets, copiesM, copiesN } = repeated.replication;
  sourceNodeIndices.forEach((source, index) => {
    const [a, b] = sourceOffsets[index];
    for (let axis = 0; axis < 3; axis++) result[3 * source + axis] += vector[3 * index + axis];
    result[sourceLattice] += a * vector[3 * index];
    result[sourceLattice + 1] += b * vector[3 * index + 1];
    result[sourceLattice + 2] += b * vector[3 * index];
  });
  result[sourceLattice] += copiesM * vector[targetLattice];
  result[sourceLattice + 1] += copiesN * vector[targetLattice + 1];
  result[sourceLattice + 2] += copiesN * vector[targetLattice + 2];
  return result;
}
function loopLengths(cell) {
  return cell.topology.loops.map(loop => loop.edgeIndices.reduce((total, index) =>
    total + Math.hypot(...actualEdgeVector(cell, cell.topology.edges[index])), 0));
}

/** Fixed-geometry identities only. This never invokes solveFabricCell or starts relaxation. */
export async function runFixedGeometryAcceptance(referenceResult) {
  assert.ok(referenceResult?.cell && referenceResult?.params, "A reference cell and material parameters are required.");
  const { cell, params } = referenceResult;
  const snapshot = JSON.stringify(referenceResult);
  const base = evaluateFabricCell(cell, params, 24);
  assert.ok(base.contact.feasible && Number.isFinite(base.energy), "Fixed reference must be feasible.");
  const constraints = evaluateLengthConstraints(cell), lengths = loopLengths(cell);
  const variables = packFabricCell(cell), derivative = new Float64Array(variables.length);
  const step = cell.topology.loopLengthMm * 2e-7;
  for (let i = 0; i < variables.length; i++) {
    const plus = variables.slice(), minus = variables.slice();
    plus[i] += step; minus[i] -= step;
    const high = evaluateFabricCell(unpackFabricCell(plus, cell), params, 24);
    const low = evaluateFabricCell(unpackFabricCell(minus, cell), params, 24);
    assert.ok(high.contact.feasible && low.contact.feasible, `A1 perturbation ${i} is infeasible; no derivative result asserted.`);
    derivative[i] = (high.energy - low.energy) / (2 * step);
  }
  const A1 = { status: "PASS_FIXED_GEOMETRY", quadratureOrder: 24, finiteDifferenceStepMm: step,
    variablesChecked: variables.length, norm: "relative infinity norm; absolute error also reported",
    gradientError: requireVector(base.gradient, derivative, 1e-5, "A1 actual-cell node/W/H/S gradient") };

  const copies = [];
  for (const [copiesM, copiesN] of [[2, 2], [4, 8]]) {
    const repeated = replicatePeriodicCell(cell, copiesM, copiesN), count = copiesM * copiesN;
    const value = evaluateFabricCell(repeated, params, 24);
    assert.ok(value.contact.feasible, "A5 exact copy must preserve feasibility.");
    const repeatedConstraints = evaluateLengthConstraints(repeated), repeatedLengths = loopLengths(repeated);
    const energyError = requireScalar(value.energy / repeated.topology.loops.length,
      base.energy / cell.topology.loops.length, 1e-6, "A5 per-loop energy");
    const pulled = pullBack(value.gradient, repeated, cell.positions.length).map(x => x / count);
    const gradientError = requireVector(pulled, base.gradient, 1e-6, "A5 pulled-back energy gradient");
    let maxConstraintAbsoluteError = 0, maxConstraintGradientError = 0, maxLoopLengthRelativeError = 0;
    repeatedConstraints.values.forEach((value, index) => {
      const source = repeated.replication.sourceEdgeIndices[index];
      maxConstraintAbsoluteError = Math.max(maxConstraintAbsoluteError, Math.abs(value - constraints.values[source]));
      const row = pullBack(repeatedConstraints.jacobian[index], repeated, cell.positions.length);
      maxConstraintGradientError = Math.max(maxConstraintGradientError,
        requireVector(row, constraints.jacobian[source], 1e-6, "A5 constraint Jacobian pullback").relative);
    });
    repeated.topology.loops.forEach((loop, index) => {
      const source = (loop.feed % cell.topology.n) * cell.topology.m + loop.needle % cell.topology.m;
      maxLoopLengthRelativeError = Math.max(maxLoopLengthRelativeError,
        requireScalar(repeatedLengths[index], lengths[source], 1e-6, "A5 loop arclength"));
    });
    // Strains can be nearly zero at equilibrium, so their comparison uses an explicit absolute bound.
    assert.ok(maxConstraintAbsoluteError <= 1e-10, `A5 near-zero strain error ${maxConstraintAbsoluteError}`);
    copies.push({ copiesM, copiesN, resultingNeedles: repeated.topology.m, resultingFeeds: repeated.topology.n,
      energyPerLoop: value.energy / repeated.topology.loops.length, energyError, gradientError,
      maxConstraintAbsoluteError, maxConstraintGradientError, maxLoopLengthRelativeError });
  }
  const A5 = { status: "PASS_FIXED_GEOMETRY", copies,
    independentOptimization: "NOT_RUN: different cell sizes may have different equilibrium branches" };

  const scaled = structuredClone(cell);
  scaled.positions = scaled.positions.map(point => point.map(x => 2 * x));
  scaled.W *= 2; scaled.H *= 2; scaled.S *= 2;
  scaled.topology.loopLengthMm *= 2;
  for (const edge of scaled.topology.edges) { edge.restLength *= 2; edge.materialStart *= 2; }
  for (const yarn of scaled.topology.yarns) yarn.materialLength *= 2;
  const scaledParams = createFabricFormParams({ ...materialInputs(params), tex: 4 * params.tex,
    fiberDiameterMm: 2 * params.fiberDiameterMm });
  requireScalar(scaledParams.B, 16 * params.B, 1e-12, "A6 derived B");
  requireScalar(scaledParams.d_e, 2 * params.d_e, 1e-12, "A6 derived diameter");
  const scaledValue = evaluateFabricCell(scaled, scaledParams, 24);
  const A6 = { status: "PASS_FIXED_GEOMETRY", transformation: "geometry/l/fiber diameter x2, tex x4; rho/E_f/K/phi0 fixed",
    energyError: requireScalar(scaledValue.energy, 8 * base.energy, 1e-6, "A6 E scales by 8"),
    gradientError: requireVector(scaledValue.gradient, base.gradient.map(x => 4 * x), 1e-6, "A6 force scales by 4"),
    constraintError: requireVector(evaluateLengthConstraints(scaled).values, constraints.values, 1e-10,
      "A6 strains unchanged", 1),
    independentEquilibriumScaling: "NOT_RUN: dimensions were transformed, not re-optimized" };

  const stiffParams = createFabricFormParams({ ...materialInputs(params), E_f: 10 * params.E_f });
  requireScalar(stiffParams.B, 10 * params.B, 1e-12, "A7 derived B");
  const stiffValue = evaluateFabricCell(cell, stiffParams, 24);
  const A7 = { status: "PASS_FIXED_GEOMETRY", transformation: "E_f x10, hence B and K*E_f x10; geometry unchanged",
    energyError: requireScalar(stiffValue.energy, 10 * base.energy, 1e-6, "A7 energy scaling"),
    gradientError: requireVector(stiffValue.gradient, base.gradient.map(x => 10 * x), 1e-6, "A7 gradient scaling"),
    independentEquilibriumScaling: "NOT_RUN" };

  const mirrored = structuredClone(cell);
  mirrored.positions = mirrored.positions.map(([x, y, z]) => [x, y, -z]);
  let crossingMetadataCount = 0;
  for (const loop of mirrored.topology.loops) for (const crossing of loop.passesThrough.crossings ?? []) {
    assert.ok(crossing.over === 1 || crossing.over === -1, "A9 expects signed local over/under metadata.");
    crossing.over = -crossing.over;
    crossingMetadataCount++;
  }
  const mirroredValue = evaluateFabricCell(mirrored, params, 24);
  const expectedMirrorGradient = base.gradient.map((value, index) =>
    index < 3 * cell.positions.length && index % 3 === 2 ? -value : value);
  const A9 = { status: "PASS_FIXED_GEOMETRY_ENERGY_SYMMETRY", transformation: "z -> -z; W/H/S and XY directed connectivity unchanged",
    energyError: requireScalar(mirroredValue.energy, base.energy, 1e-6, "A9 mirror energy"),
    gradientError: requireVector(mirroredValue.gradient, expectedMirrorGradient, 1e-6, "A9 mirror gradient covariance"),
    constraintError: requireVector(evaluateLengthConstraints(mirrored).values, constraints.values, 1e-10, "A9 mirror strain", 1),
    crossingMetadata: { status: crossingMetadataCount ? "TRANSFORMED_LOCAL_FACE_CONVENTION" : "NOT_PRESENT_IN_REFERENCE",
      count: crossingMetadataCount, rule: "over=sign(z_self-z_target) changes sign; XY tangent orientation and loop/image targets do not",
      limitation: "This symmetry check does not re-establish the projected crossing word of an optimized configuration" },
    shear: { S: cell.S, absoluteRatio: Math.abs(cell.S) / cell.W,
      status: "DIAGNOSTIC_ONLY", note: "A z mirror preserves S; zero shear is not a universal equilibrium requirement" } };

  const q12 = evaluateFabricCell(cell, params, 12);
  const integrationEnergyError = requireScalar(q12.contact.energy, base.contact.energy, 1e-6, "A14 fixed-geometry q12/q24 contact energy");
  const integrationGradientError = requireVector(q12.contact.gradient, base.contact.gradient, 1e-5,
    "A14 fixed-geometry q12/q24 contact gradient", params.B / cell.topology.loopLengthMm ** 2 * 1e-12);
  const integratedBarrier = await runIntegratedBarrierChecks();
  const oldBarrierCandidates = runBarrierSubdivisionChecks();
  const A14 = { status: "PARTIAL_FIXED_GEOMETRY_ONLY",
    integration: { status: "PASS", quadratureOrders: [12, 24], integrationEnergyError, integrationGradientError,
      referenceBarrierEnergy: base.contact.barrierEnergy },
    integratedBarrier: { status: "PASS", cases: integratedBarrier.rows.length,
      maxEnergyError: integratedBarrier.maxEnergyError, maxDerivativeError: integratedBarrier.maxDerivativeError,
      rows: integratedBarrier.rows },
    retiredBarrierCounterexamples: { definition: oldBarrierCandidates.definition, phases: oldBarrierCandidates.phases },
    rodGridAndReoptimizedDensityConvergence: { status: "NOT_ESTABLISHED",
      reason: "Requires independent rod-node refinement on the same equilibrium branch; this helper never optimizes" } };
  assert.equal(JSON.stringify(referenceResult), snapshot, "Fixed-geometry acceptance must preserve the input reference result.");
  return { scope: "Fixed reference geometry only; no new equilibrium solves and no overall T1 acceptance claim",
    reference: { status: referenceResult.status ?? "UNSPECIFIED", nodeCount: cell.positions.length,
      needles: cell.topology.m, feeds: cell.topology.n, loopLengthMm: cell.topology.loopLengthMm,
      recomputedEnergy: base.energy, quadratureOrder: 24 }, A1, A5, A6, A7, A9, A14 };
}
