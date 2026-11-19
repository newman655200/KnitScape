import assert from "node:assert/strict";
import fs from "node:fs";
import { performance } from "node:perf_hooks";

const moduleUrl = new URL("../src/simulation/yarnSpatialRelaxation.js", import.meta.url);
assert.ok(fs.existsSync(moduleUrl), "TEST_ONLY constrained spatial relaxation module must exist");
const { relaxYarnSpatialPath } = await import(moduleUrl);
const { createSpatialCurve, buildSpatialPath } = await import("../src/simulation/yarnSpatialPath.js");
const { measureSpatialLength } = await import("../src/simulation/yarnSpatialLength.js");
const { buildParallelTransportFrames } = await import("../src/simulation/yarnParallelTransport.js");
const { buildYarnTubeGeometry } = await import("../src/simulation/yarnTubeGeometry.js");

// Artificial mm coordinates/targets; formula-defined, numerical confidence only,
// TEST_ONLY state. Neither the radii nor solver weights are measured properties.
const seed = Array.from({ length: 9 }, (_, i) => {
  const t = i / 8;
  return [-6 + 12 * t, i === 0 || i === 8 ? 0 : 1.2 * Math.sin(Math.PI * t),
    i === 0 || i === 8 ? 0 : 0.7 * Math.sin(2 * Math.PI * t)];
});
const input = (targetLengthMm, initialPoints = seed) => ({
  initialPoints, unit: "mm", targetLengthMm,
  anchors: [{ index: 0, position: [...initialPoints[0]] }, { index: initialPoints.length - 1, position: [...initialPoints.at(-1)] }],
  constraints: { maxControlDisplacementMm: 5 },
});
const ok = value => { assert.equal(value.status, "OK", JSON.stringify(value)); return value; };
const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${label}: ${actual} vs ${expected}, tolerance ${tolerance}`);
const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));
const independentEnergy = points => {
  const h = 1 / 8, q = points.map(point => [point[1] / 12, point[2] / 12]);
  let bending = 0, proximity = 0;
  for (let i = 1; i < 8; i++) for (let axis = 0; axis < 2; axis++) {
    bending += (q[i - 1][axis] - 2 * q[i][axis] + q[i + 1][axis]) ** 2;
    proximity += (q[i][axis] - seed[i][axis + 1] / 12) ** 2;
  }
  return 0.002 * bending / (2 * h ** 3) + h * proximity / 2;
};
const results = [];
const solved = new Map();
for (const targetLengthMm of [12.5, 14, 16]) {
  const request = input(targetLengthMm), before = JSON.stringify(request), started = performance.now();
  const result = relaxYarnSpatialPath(request);
  assert.equal(result.status, "CONVERGED", JSON.stringify(result));
  assert.equal(result.validationClass, "TEST_ONLY");
  assert.equal(JSON.stringify(request), before, "solver preserves inputs");
  assert.deepEqual(result.solvedPoints[0], request.anchors[0].position);
  assert.deepEqual(result.solvedPoints.at(-1), request.anchors[1].position);
  assert.deepEqual(result.curveConfig.points, result.solvedPoints);
  assert.ok(result.solvedPoints.every((point, i) => distance(point, seed[i]) <= 5 + 1e-10));
  const curve = ok(createSpatialCurve(result.curveConfig)).curve;
  assert.equal(curve.regular, true);
  assert.equal(curve.continuity.derivativeContinuous, true);
  const independent = ok(measureSpatialLength(curve, { absoluteTolerance: 1e-11, relativeTolerance: 1e-12, maxDepth: 24 }));
  near(independent.totalLength, targetLengthMm, targetLengthMm * 1e-5, "independent target equality");
  near(result.finalLengthMm, independent.totalLength, 1e-8, "shared integral authority");
  near(result.signedLengthResidualMm, result.finalLengthMm - targetLengthMm, 1e-13, "signed residual");
  assert.ok(Math.abs(result.relativeLengthResidual) <= 1e-5);
  assert.equal(result.residuals.maxAnchorDisplacementMm, 0);
  assert.ok(result.residuals.stationarity <= 1e-5, "constrained smooth-energy stationarity");
  assert.ok(result.residuals.maxDisplacementViolationMm <= 1e-10);
  assert.ok(result.numerical.maxSampledCurvaturePerMm > 0);
  assert.equal(result.numerical.curvatureIsCertifiedBound, false);
  assert.ok(result.numerical.maxSampledCurvaturePerMm < 1, "fixture remains smoothly bent without high-curvature spikes");
  assert.equal(result.integration.method, "adaptive-gauss-kronrod-15-speed-integral");
  assert.equal(result.integration.authority, "yarnSpatialLength.measureSpatialLength");
  // Independent numerical energy/length gradients check the reported smooth
  // constrained optimum, rather than trusting the solver's stationarity number.
  const energyGradient = [], lengthGradient = [], delta = 1e-5;
  for (let i = 1; i < 8; i++) for (const axis of [1, 2]) {
    const plus = result.solvedPoints.map(point => [...point]), minus = result.solvedPoints.map(point => [...point]);
    plus[i][axis] += delta; minus[i][axis] -= delta;
    energyGradient.push((independentEnergy(plus) - independentEnergy(minus)) / (2 * delta));
    const length = points => ok(measureSpatialLength(ok(createSpatialCurve({ ...result.curveConfig, points })).curve,
      { absoluteTolerance: 1e-11, relativeTolerance: 1e-12 })).totalLength;
    lengthGradient.push((length(plus) - length(minus)) / (2 * delta));
  }
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  const lambda = -dot(energyGradient, lengthGradient) / dot(lengthGradient, lengthGradient);
  const independentStationarityPerMm = Math.hypot(...energyGradient.map((value, i) => value + lambda * lengthGradient[i]));
  assert.ok(independentStationarityPerMm < 1e-6, `independent energy stationarity: ${independentStationarityPerMm}`);
  near(independentEnergy(result.solvedPoints), result.objective.finalEnergy, 1e-12, "objective definition");
  const path = ok(buildSpatialPath(result.curveConfig, { sampleCount: 129 }));
  const frames = ok(buildParallelTransportFrames(path));
  const tube = ok(buildYarnTubeGeometry({ path, frames, radiusA: 0.06, radiusB: 0.04,
    radialSegments: 12, uvRepeatLength: 2 }));
  assert.ok(tube.positions.every(Number.isFinite));
  assert.ok(tube.indices.length > 0);
  solved.set(targetLengthMm, result);
  results.push({ targetLengthMm, actualLengthMm: independent.totalLength,
    signedResidualMm: independent.totalLength - targetLengthMm,
    relativeResidual: (independent.totalLength - targetLengthMm) / targetLengthMm,
    minZMm: result.numerical.minZMm, maxZMm: result.numerical.maxZMm, zRangeMm: result.numerical.zRangeMm,
    maxSampledCurvaturePerMm: result.numerical.maxSampledCurvaturePerMm,
    maxAnchorDisplacementMm: result.residuals.maxAnchorDisplacementMm,
    stationarity: result.residuals.stationarity, iterations: result.iterations,
    independentStationarityPerMm,
    evaluations: result.evaluations, solverAndVerificationMilliseconds: performance.now() - started,
    integrationErrorEstimateMm: result.integration.errorEstimateMm });
}

const failureHasNoSolution = result => {
  assert.notEqual(result.status, "CONVERGED");
  assert.equal(result.solvedPoints, undefined, "failed result cannot be reused as a solved mesh");
  assert.equal(result.curveConfig, undefined, "failed result cannot be reused as a solved curve");
  inspectReadonlyPlain(result);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result, "complete failure output must retain finite plain JSON data");
};
const unreachable = [input(11.5), input(1000), input(1e307), { ...input(16), constraints: { maxControlDisplacementMm: 0.001 } }].map(request => {
  const result = relaxYarnSpatialPath(request);
  assert.equal(result.status, "UNREACHABLE", JSON.stringify(result));
  assert.ok(result.bounds.lowerLengthMm > request.targetLengthMm || result.bounds.upperLengthMm < request.targetLengthMm);
  assert.equal(result.bounds.proofClass, "ANALYTIC_INEQUALITY_WITH_FLOATING_POINT_GUARD");
  failureHasNoSolution(result);
  return { targetLengthMm: request.targetLengthMm, reason: result.reason, bounds: result.bounds };
});
const straight = relaxYarnSpatialPath(input(12));
assert.equal(straight.status, "CONVERGED", JSON.stringify(straight));
assert.equal(straight.reason, "UNIQUE_STRAIGHT_FEASIBLE_CURVE");
near(straight.finalLengthMm, 12, 1e-12, "exact chord");
assert.equal(straight.residuals.stationarity, null, "singular length constraint does not have a regular KKT test");
assert.equal(straight.residuals.stationarityApplicable, false);
straight.solvedPoints.forEach((point, i) => assert.deepEqual(point, [-6 + i * 1.5, 0, 0]));
const straightSeed = seed.map(point => [point[0], 0, 0]);
assert.equal(relaxYarnSpatialPath(input(12, straightSeed)).status, "CONVERGED");
const noPreferredDirection = relaxYarnSpatialPath(input(14, straightSeed));
assert.equal(noPreferredDirection.status, "INVALID");
assert.equal(noPreferredDirection.reason, "NONCOLLINEAR_SEED_REQUIRED");
failureHasNoSolution(noPreferredDirection);

for (const request of [null, {}, { ...input(14), unit: "cm" }, { ...input(14), unit: "px" },
  { ...input(14), unit: undefined }, { ...input(14), targetLengthMm: NaN }, { ...input(14), targetLengthMm: Infinity },
  { ...input(14), targetLengthMm: 0 }, { ...input(14), initialPoints: [[0, 0, 0], [1, 0, 0]] },
  { ...input(14), initialPoints: seed.map((p, i) => i === 3 ? [p[0], NaN, p[2]] : p) },
  { ...input(14), initialPoints: seed.map((p, i) => i === 3 ? [p[0], Infinity, p[2]] : p) },
  { ...input(14), initialPoints: seed.map((p, i) => i === 3 ? seed[2] : p) },
  { ...input(14), initialPoints: seed.map((p, i) => i === 3 ? [p[0] + 0.1, p[1], p[2]] : p) },
  { ...input(14), anchors: [...input(14).anchors, { index: 4, position: seed[4] }] },
  { ...input(14), anchors: [{ index: 0, position: [-7, 0, 0] }, input(14).anchors[1]] },
  { ...input(14), constraints: null }, { ...input(14), constraints: {} },
  { ...input(14), constraints: { maxControlDisplacementMm: 0 } },
  { ...input(14), constraints: { maxControlDisplacementMm: Infinity } },
  { ...input(14), constraints: { maxControlDisplacementMm: 5, worldUp: [0, 0, 1] } },
  { ...input(14), closed: true }, { ...input(14), solver: null },
  ...[{ maxIterations: -1 }, { maxIterations: 2.2 }, { maxIterations: Infinity }, { maxEvaluations: 0 },
    { shapeWeight: 0 }, { bendingWeight: NaN }, { relativeLengthTolerance: 0 }, { relativeLengthTolerance: 0.1 },
    { stationarityTolerance: NaN }, { finiteDifferenceStep: 0 }, { maxStepMm: -1 }, { typo: 1 }]
    .map(solver => ({ ...input(14), solver }))]) {
  const result = relaxYarnSpatialPath(request);
  assert.equal(result.status, "INVALID", `invalid request accepted: ${JSON.stringify(request)} => ${JSON.stringify(result)}`);
  failureHasNoSolution(result);
}

const limited = [{ maxIterations: 0 }, { maxIterations: 1 }, { maxEvaluations: 1 }].map(solver => {
  const result = relaxYarnSpatialPath({ ...input(14), solver });
  assert.equal(result.status, "NONCONVERGED", JSON.stringify(result));
  failureHasNoSolution(result);
  if (solver.maxIterations !== undefined) {
    assert.equal(result.reason, "ITERATION_LIMIT"); assert.ok(result.iterations <= solver.maxIterations);
  } else { assert.equal(result.reason, "EVALUATION_LIMIT"); assert.ok(result.evaluations <= solver.maxEvaluations); }
  return { solver, status: result.status, reason: result.reason };
});

function inspectReadonlyPlain(value) {
  if (value === null) return;
  if (typeof value === "number") { assert.ok(Number.isFinite(value)); return; }
  if (typeof value !== "object") { assert.ok(["string", "boolean"].includes(typeof value)); return; }
  assert.ok(Object.isFrozen(value), "every nested result object is frozen");
  assert.ok(Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype, "plain arrays/records only");
  Object.values(value).forEach(inspectReadonlyPlain);
}
for (const result of [...solved.values(), straight, noPreferredDirection]) {
  inspectReadonlyPlain(result);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
}
assert.throws(() => { solved.get(14).solvedPoints[3][2] = 100; }, TypeError);
assert.deepEqual(relaxYarnSpatialPath(input(14)), solved.get(14), "deterministic output including iteration counts");
const microscopicStraight = [[-6e-200, 0, 0], [0, 0, 0], [6e-200, 0, 0]];
const microscopicResult = relaxYarnSpatialPath(input(12e-200, microscopicStraight));
assert.equal(microscopicResult.status, "CONVERGED");
assert.equal(microscopicResult.numerical.maxSampledCurvaturePerMm, 0,
  "straight zero curvature must not become NaN by cubing a tiny speed");
inspectReadonlyPlain(microscopicResult);

const roundedChordRotations = [0.02, 0.6].map(angle => {
  const transform = point => [Math.cos(angle) * point[0] - Math.sin(angle) * point[1],
    Math.sin(angle) * point[0] + Math.cos(angle) * point[1], point[2]];
  const points = seed.map(transform), result = relaxYarnSpatialPath(input(12, points));
  assert.equal(result.status, "CONVERGED", `rotated minimum at ${angle}: ${JSON.stringify(result)}`);
  assert.equal(result.reason, "STRAIGHT_CURVE_WITHIN_CHORD_ROUNDOFF");
  assert.equal(result.iterations, 0, "minimum within coordinate roundoff uses the analytic chord");
  assert.equal(result.targetLengthMm, 12, "retain the actual requested target");
  assert.equal(result.signedLengthResidualMm, result.finalLengthMm - 12);
  assert.equal(result.relativeLengthResidual, (result.finalLengthMm - 12) / 12);
  assert.ok(result.bounds.chordGuardMm < 1e-12, "roundoff guard uses chord and target only");
  assert.ok(Math.abs(result.signedLengthResidualMm) <= result.bounds.chordGuardMm);
  assert.deepEqual(result.solvedPoints[0], points[0]);
  assert.deepEqual(result.solvedPoints.at(-1), points.at(-1));
  result.solvedPoints.forEach((point, i) => assert.ok(distance(point, transform([-6 + 1.5 * i, 0, 0])) < 1e-12));
  inspectReadonlyPlain(result);
  return { angleRadians: angle, chordLengthMm: distance(points[0], points.at(-1)),
    targetLengthMm: result.targetLengthMm, actualLengthMm: result.finalLengthMm,
    signedLengthResidualMm: result.signedLengthResidualMm, chordGuardMm: result.bounds.chordGuardMm };
});
const looseBoundBelowChord = relaxYarnSpatialPath({ ...input(11.5), constraints: { maxControlDisplacementMm: 1e12 } });
assert.equal(looseBoundBelowChord.status, "UNREACHABLE", "a large displacement allowance must not suppress the chord lower bound");
failureHasNoSolution(looseBoundBelowChord);
const nearButNotRounded = relaxYarnSpatialPath({ ...input(12 + 1e-5),
  constraints: { maxControlDisplacementMm: 1e12 }, solver: { maxIterations: 0 } });
assert.equal(nearButNotRounded.status, "NONCONVERGED", "ordinary target tolerance must not replace a roundoff-scale chord guard");
failureHasNoSolution(nearButNotRounded);
const roundoffBoundAmbiguity = relaxYarnSpatialPath({ ...input(12 + 12 * Number.EPSILON),
  constraints: { maxControlDisplacementMm: 0.001 } });
assert.equal(roundoffBoundAmbiguity.status, "NONCONVERGED", "near-chord is not an exact straight-curve infeasibility proof");
assert.equal(roundoffBoundAmbiguity.reason, "CHORD_ROUNDOFF_DISPLACEMENT_AMBIGUITY");
failureHasNoSolution(roundoffBoundAmbiguity);
const projectionBoundCases = [
  { points: [[0, 0, 0], [500000000000.5, 100000000000, 0], [1000000000000, 0, 0]],
    target: 1022350545388.2102, bound: 0.01 },
  { points: [[0, 0, 0], [6.000000000005, 1.2, 0], [12, 0, 0]], target: 12.268206544658522, bound: 1e-13 },
].map(({ points, target, bound }) => {
  const result = relaxYarnSpatialPath({ ...input(target, points), constraints: { maxControlDisplacementMm: bound } });
  assert.equal(result.status, "NONCONVERGED", `initial graph projection cannot exceed B: ${JSON.stringify(result)}`);
  assert.equal(result.reason, "INITIAL_PROJECTION_EXCEEDS_DISPLACEMENT_BOUND");
  failureHasNoSolution(result);
  return { boundMm: bound, status: result.status, reason: result.reason };
});
const endpointRoundoffCases = [
  { points: [[1, 0, 0], [0.5, 0, 0], [1e-17, 0, 0]], target: 1, bound: 1e-18 },
  { points: [[1e16, 0, 0], [5e15, 0, 0], [1, 0, 0]], target: 1e16, bound: 0.5 },
].map(({ points, target, bound }) => {
  const initialCurve = ok(createSpatialCurve({ type: "catmull-rom", unit: "mm", points })).curve;
  assert.equal(initialCurve.regular, true);
  near(ok(measureSpatialLength(initialCurve)).totalLength, target, (32 * Number.EPSILON) * target,
    "unchanged initial straight controls already meet the target within floating-point roundoff");
  const result = relaxYarnSpatialPath({ ...input(target, points), constraints: { maxControlDisplacementMm: bound } });
  assert.equal(result.status, "CONVERGED", `endpoint reconstruction roundoff is not control movement: ${JSON.stringify(result)}`);
  assert.deepEqual(result.solvedPoints, points);
  assert.equal(result.residuals.maxControlDisplacementMm, 0);
  assert.equal(result.residuals.maxDisplacementViolationMm, 0);
  assert.equal(result.targetLengthMm, target);
  assert.equal(result.signedLengthResidualMm, result.finalLengthMm - target);
  inspectReadonlyPlain(result);
  return { targetLengthMm: target, actualLengthMm: result.finalLengthMm, signedLengthResidualMm: result.signedLengthResidualMm,
    boundMm: bound, status: result.status,
    maxControlDisplacementMm: result.residuals.maxControlDisplacementMm };
});

const transforms = [
  point => [point[0], point[1], -point[2]],
  point => [-point[2] + 2, point[0] - 4, -point[1] + 7],
  point => { const c = Math.cos(0.73), s = Math.sin(0.73); return [c * point[0] - s * point[2] + 3, point[1] - 2, s * point[0] + c * point[2] + 1]; },
];
for (const transform of transforms) assert.equal(relaxYarnSpatialPath(input(12, seed.map(transform))).status, "CONVERGED",
  "chord equality remains analytic under rigid transforms despite coordinate roundoff");
const covariance = transforms.map((transform, index) => {
  const result = relaxYarnSpatialPath(input(14, seed.map(transform)));
  assert.equal(result.status, "CONVERGED", JSON.stringify(result));
  const error = Math.max(...result.solvedPoints.map((point, i) => distance(point, transform(solved.get(14).solvedPoints[i]))));
  assert.ok(error < 2e-5, `no world-axis forcing; transform ${index} error ${error}`);
  near(result.numerical.maxSampledCurvaturePerMm, solved.get(14).numerical.maxSampledCurvaturePerMm, 2e-6, "curvature covariance");
  return { transform: index, maxControlErrorMm: error };
});
const variedSeed = seed.map((point, i) => [point[0], point[1] + 0.25 * Math.sin(2 * Math.PI * i / 8), point[2]]);
const varied = relaxYarnSpatialPath(input(14, variedSeed));
assert.equal(varied.status, "CONVERGED", JSON.stringify(varied));
near(varied.finalLengthMm, 14, 14e-5, "varied seed equality");
assert.ok(varied.solvedPoints.some((point, i) => distance(point, solved.get(14).solvedPoints[i]) > 1e-3), "seed preference affects shape");
const transverseScale = solved.get(14).solvedPoints[4][1] / seed[4][1];
assert.ok(solved.get(14).solvedPoints.some((point, i) =>
  Math.hypot(point[1] - transverseScale * seed[i][1], point[2] - transverseScale * seed[i][2]) > 0.02),
"optimizes independent control DOFs instead of one global seed amplitude");

console.log(JSON.stringify({ validator: "yarn-spatial-relaxation", status: "PASS", results,
  unreachable, limited, covariance, roundedChordRotations, projectionBoundCases, endpointRoundoffCases, variedSeedLengthMm: varied.finalLengthMm,
  exactChordLengthMm: straight.finalLengthMm }, null, 2));
