import { createSpatialCurve } from "./yarnSpatialPath.js";
import { measureSpatialLength } from "./yarnSpatialLength.js";
import { add, subtract, scale, dot, cross, magnitude, distance, normalize, finiteVector } from "./yarnSpatialMath.js";

const freeze = value => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const vectorDot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);

function factorPositiveMatrix(matrix) {
  const factor = matrix.map(row => row.map(() => 0));
  for (let i = 0; i < matrix.length; i++) for (let j = 0; j <= i; j++) {
    let value = matrix[i][j];
    for (let k = 0; k < j; k++) value -= factor[i][k] * factor[j][k];
    factor[i][j] = i === j ? Math.sqrt(value) : value / factor[j][j];
  }
  return vector => {
    const answer = [...vector], count = matrix.length;
    for (let axis = 0; axis < 2; axis++) {
      for (let i = 0; i < count; i++) {
        let value = vector[2 * i + axis];
        for (let j = 0; j < i; j++) value -= factor[i][j] * answer[2 * j + axis];
        answer[2 * i + axis] = value / factor[i][i];
      }
      for (let i = count - 1; i >= 0; i--) {
        let value = answer[2 * i + axis];
        for (let j = i + 1; j < count; j++) value -= factor[j][i] * answer[2 * j + axis];
        answer[2 * i + axis] = value / factor[i][i];
      }
    }
    return answer;
  };
}

function sampledGeometry(curve) {
  let minZMm = Infinity, maxZMm = -Infinity, maxSampledCurvaturePerMm = 0;
  // A cubic's velocity is quadratic. Recover its acceleration from Round4's
  // derivative, then sample curvature separately on both sides of C1 seams.
  for (const segment of curve.segments) {
    const v0 = segment.derivative(0), vm = segment.derivative(0.5), v1 = segment.derivative(1);
    const a = scale(add(subtract(v1, scale(vm, 2)), v0), 2);
    const b = subtract(subtract(v1, v0), a);
    for (let i = 0; i <= 64; i++) {
      const u = i / 64, point = segment.point(u), velocity = segment.derivative(u);
      minZMm = Math.min(minZMm, point[2]); maxZMm = Math.max(maxZMm, point[2]);
      const acceleration = add(scale(a, 2 * u), b);
      const speed = magnitude(velocity);
      maxSampledCurvaturePerMm = Math.max(maxSampledCurvaturePerMm,
        magnitude(cross(velocity.map(value => value / speed), acceleration.map(value => value / speed))) / speed);
    }
  }
  return { minZMm, maxZMm, zRangeMm: maxZMm - minZMm, maxSampledCurvaturePerMm,
    curvatureIsCertifiedBound: false, samplesPerSegment: 65,
    method: "sampled Round4 derivative and cubic acceleration; world-coordinate Z" };
}

/** TEST_ONLY numerical shape experiment. All coordinates/lengths are mm. It
 * minimizes dimensionless bending + proximity under a Round4 arc-length
 * equality. Weights are uncalibrated numerical choices, never material data.
 * The restricted graph model fixes longitudinal stations along the endpoint
 * chord; its uniform Catmull–Rom longitudinal derivative is strictly positive.
 * This guarantees a regular C1 injective centerline, not finite-radius contact.
 */
export function relaxYarnSpatialPath(input = {}) {
  let iterations = 0, evaluations = 0, failureContext = {};
  const fail = (status, reason, details = {}) => freeze({ status, reason, validationClass: "TEST_ONLY", iterations, evaluations, ...failureContext, ...details });
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key =>
    !["initialPoints", "unit", "targetLengthMm", "anchors", "constraints", "solver"].includes(key))) return fail("INVALID", "INVALID_INPUT");
  const { initialPoints, targetLengthMm, anchors, constraints = {}, solver = {} } = input;
  if (input.unit !== "mm") return fail("INVALID", "INVALID_UNIT");
  if (!Array.isArray(initialPoints) || initialPoints.length < 3 || initialPoints.length > 33 ||
    !Array.from(initialPoints).every(point => finiteVector(point) && Array.from(point).every(Number.isFinite))) {
    return fail("INVALID", "INVALID_CONTROL_POINTS");
  }
  if (!Number.isFinite(targetLengthMm) || targetLengthMm <= 0) return fail("INVALID", "INVALID_TARGET_LENGTH");
  const count = initialPoints.length, interior = count - 2, h = 1 / (count - 1);
  if (!Array.isArray(anchors) || anchors.length !== 2 || anchors[0]?.index !== 0 || anchors[1]?.index !== count - 1 ||
    !anchors.every(anchor => finiteVector(anchor.position) && distance(anchor.position, initialPoints[anchor.index]) === 0)) {
    return fail("INVALID", "UNSUPPORTED_ANCHORS");
  }
  if (!constraints || typeof constraints !== "object" || Array.isArray(constraints) ||
    Object.keys(constraints).some(key => key !== "maxControlDisplacementMm")) return fail("INVALID", "INVALID_CONSTRAINTS");
  const displacementBoundMm = constraints.maxControlDisplacementMm;
  if (!Number.isFinite(displacementBoundMm) || displacementBoundMm <= 0) return fail("INVALID", "INVALID_DISPLACEMENT_BOUND");
  const start = [...anchors[0].position], end = [...anchors[1].position], chord = subtract(end, start), chordLengthMm = magnitude(chord);
  if (!Number.isFinite(chordLengthMm) || chordLengthMm <= 0) return fail("INVALID", "DEGENERATE_ANCHORS");
  const longitudinal = scale(chord, 1 / chordLengthMm);
  const offsets = initialPoints.map((point, i) => subtract(point, add(start, scale(chord, i * h))));
  if (!finiteVector(longitudinal) || !offsets.every(finiteVector) || !Number.isFinite(displacementBoundMm / chordLengthMm)) return fail("INVALID", "UNSUPPORTED_NUMERIC_RANGE");
  if (offsets.some(offset => Math.abs(dot(offset, longitudinal)) > chordLengthMm * 1e-12)) {
    return fail("INVALID", "NONUNIFORM_LONGITUDINAL_STATIONS");
  }
  const allowedSolver = ["bendingWeight", "shapeWeight", "maxIterations", "maxEvaluations", "relativeLengthTolerance",
    "stationarityTolerance", "finiteDifferenceStep", "maxStepMm"];
  if (!solver || typeof solver !== "object" || Array.isArray(solver) || Object.keys(solver).some(key => !allowedSolver.includes(key))) {
    return fail("INVALID", "INVALID_SOLVER_SETTINGS");
  }
  const settings = { bendingWeight: solver.bendingWeight ?? 0.002, shapeWeight: solver.shapeWeight ?? 1,
    maxIterations: solver.maxIterations ?? 200, maxEvaluations: solver.maxEvaluations ?? 18000,
    relativeLengthTolerance: solver.relativeLengthTolerance ?? 1e-7,
    stationarityTolerance: solver.stationarityTolerance ?? 1e-6,
    finiteDifferenceStep: solver.finiteDifferenceStep ?? 2e-6,
    maxStepMm: solver.maxStepMm ?? chordLengthMm * 0.08 };
  const positive = value => Number.isFinite(value) && value > 0;
  if (!Object.values(settings).every(Number.isFinite) || !Number.isInteger(settings.maxIterations) || settings.maxIterations < 0 || settings.maxIterations > 1000 ||
    !Number.isInteger(settings.maxEvaluations) || settings.maxEvaluations < 1 || settings.maxEvaluations > 100000 ||
    !positive(settings.bendingWeight) || !positive(settings.shapeWeight) || settings.bendingWeight > 1e4 || settings.shapeWeight > 1e4 ||
    settings.bendingWeight < 1e-8 || settings.shapeWeight < 1e-8 || !positive(settings.relativeLengthTolerance) || settings.relativeLengthTolerance > 1e-3 ||
    !positive(settings.stationarityTolerance) || settings.stationarityTolerance > 1e-3 ||
    settings.finiteDifferenceStep < 1e-8 || settings.finiteDifferenceStep > 1e-3 || !positive(settings.maxStepMm)) {
    return fail("INVALID", "INVALID_SOLVER_SETTINGS");
  }
  const integrationOptions = { absoluteTolerance: 1e-10, relativeTolerance: 1e-11, maxDepth: 20 };
  const measurePoints = points => {
    if (evaluations >= settings.maxEvaluations) return null;
    evaluations++;
    const curveConfig = { type: "catmull-rom", unit: "mm", closed: false, points: points.map(point => [...point]) };
    const created = createSpatialCurve(curveConfig);
    if (created.status !== "OK" || !created.curve.regular) return null;
    const measurement = measureSpatialLength(created.curve, integrationOptions);
    if (measurement.status !== "OK") return null;
    return { length: measurement.totalLength / chordLengthMm, measurement, curve: created.curve, curveConfig, points };
  };
  const initial = measurePoints(initialPoints);
  if (!initial) return fail("NONCONVERGED", "INTEGRATION_FAILED");
  // Cubic length is at most its Bezier control polygon. A control perturbation
  // bounded by B has |delta d| <= 2B, |delta m| <= 2B, hence each segment's
  // curve variation is <= 2B + (2/3)(2B+2B) = 14B/3. These are inequalities,
  // never a second length metric. The only measured length is the Round4 integral.
  const initialBezierUpperBoundMm = initial.curve.segments.reduce((sum, segment) => {
    const m0 = segment.derivative(0), m1 = segment.derivative(1), delta = subtract(segment.point(1), segment.point(0));
    return sum + magnitude(m0) / 3 + magnitude(subtract(delta, scale(add(m0, m1), 1 / 3))) + magnitude(m1) / 3;
  }, 0);
  const upperLengthMm = initialBezierUpperBoundMm + (14 / 3) * (count - 1) * displacementBoundMm;
  if (!Number.isFinite(upperLengthMm)) return fail("INVALID", "UNSUPPORTED_NUMERIC_RANGE");
  const boundGuardMm = (128 * Number.EPSILON) * Math.max(chordLengthMm, upperLengthMm, targetLengthMm);
  // Coordinate rotation can round D above or below an unchanged target. This
  // comparison uses only their floating-point scale, never B or solve tolerance.
  const chordGuardMm = (32 * Number.EPSILON) * Math.max(chordLengthMm, targetLengthMm);
  const bounds = { lowerLengthMm: chordLengthMm, upperLengthMm, initialBezierUpperBoundMm, guardMm: boundGuardMm, chordGuardMm,
    proofClass: "ANALYTIC_INEQUALITY_WITH_FLOATING_POINT_GUARD", method: "endpoint chord; initial Bezier polygon plus 14(n-1)B/3" };
  failureContext = { bounds };
  if (targetLengthMm < chordLengthMm - chordGuardMm) return fail("UNREACHABLE", "TARGET_BELOW_ANCHOR_CHORD");
  if (targetLengthMm > upperLengthMm + boundGuardMm) return fail("UNREACHABLE", "TARGET_ABOVE_DISPLACEMENT_BOUND");
  const bending = settings.bendingWeight / h ** 3, shape = settings.shapeWeight * h;
  const initialEnergy = offsets.slice(1, -1).reduce((sum, _, index) => {
    const i = index + 1, second = add(subtract(offsets[i - 1], scale(offsets[i], 2)), offsets[i + 1]);
    return sum + bending * (magnitude(second) / chordLengthMm) ** 2 / 2;
  }, 0);
  const success = (current, { reason, stationarity, energy, multiplier }) => {
    const signedLengthResidualMm = current.measurement.totalLength - targetLengthMm;
    const movement = Math.max(...current.points.map((point, i) => distance(point, initialPoints[i])));
    const numerical = sampledGeometry(current.curve);
    if (Object.values(numerical).some(value => typeof value === "number" && !Number.isFinite(value)) ||
      ![energy, initialEnergy, movement, signedLengthResidualMm / targetLengthMm].every(Number.isFinite)) {
      return fail("NONCONVERGED", "UNSUPPORTED_NUMERIC_RANGE");
    }
    if (movement > displacementBoundMm) return fail("NONCONVERGED", "DISPLACEMENT_BOUND_VIOLATION",
      { residuals: { maxControlDisplacementMm: movement, maxDisplacementViolationMm: movement - displacementBoundMm } });
    return freeze({ status: "CONVERGED", reason, validationClass: "TEST_ONLY", solvedPoints: current.points.map(point => [...point]),
      curveConfig: current.curveConfig, finalLengthMm: current.measurement.totalLength,
      targetLengthMm, signedLengthResidualMm, relativeLengthResidual: signedLengthResidualMm / targetLengthMm,
      iterations, evaluations, residuals: { maxAnchorDisplacementMm: 0, stationarity, stationarityApplicable: stationarity !== null,
        maxControlDisplacementMm: movement, maxDisplacementViolationMm: Math.max(0, movement - displacementBoundMm) },
      numerical, objective: { initialEnergy, finalEnergy: energy, multiplier,
        bendingWeight: settings.bendingWeight, shapeWeight: settings.shapeWeight, unit: "dimensionless", confidence: "UNCALIBRATED_NUMERICAL" },
      integration: { authority: "yarnSpatialLength.measureSpatialLength", method: current.measurement.method,
        errorEstimateMm: current.measurement.errorEstimate, ...integrationOptions },
      bounds, settings, constraints: { maxControlDisplacementMm: displacementBoundMm, fixedUniformLongitudinalStations: true,
        regularC1Graph: true, centerlineSelfIntersectionExcluded: true, finiteRadiusContactEvaluated: false } });
  };
  if (Math.abs(targetLengthMm - chordLengthMm) <= chordGuardMm) {
    const exactChord = targetLengthMm === chordLengthMm;
    const straightPoints = Array.from({ length: count }, (_, i) => i === 0 ? [...start] : i === count - 1 ? [...end] : add(start, scale(chord, i * h)));
    const movement = Math.max(...straightPoints.map((point, i) => distance(point, initialPoints[i])));
    if (movement > displacementBoundMm) return fail(exactChord ? "UNREACHABLE" : "NONCONVERGED",
      exactChord ? "STRAIGHT_CURVE_OUTSIDE_DISPLACEMENT_BOUND" : "CHORD_ROUNDOFF_DISPLACEMENT_AMBIGUITY",
      { minimumRequiredControlDisplacementMm: movement });
    const straight = measurePoints(straightPoints);
    if (!straight) return fail("NONCONVERGED", evaluations >= settings.maxEvaluations ? "EVALUATION_LIMIT" : "INTEGRATION_FAILED");
    if (Math.abs(straight.measurement.totalLength - targetLengthMm) > targetLengthMm * settings.relativeLengthTolerance) {
      return fail("NONCONVERGED", "CHORD_ROUNDOFF_TARGET_RESIDUAL", { finalLengthMm: straight.measurement.totalLength,
        signedLengthResidualMm: straight.measurement.totalLength - targetLengthMm,
        relativeLengthResidual: (straight.measurement.totalLength - targetLengthMm) / targetLengthMm });
    }
    return success(straight, { reason: exactChord ? "UNIQUE_STRAIGHT_FEASIBLE_CURVE" : "STRAIGHT_CURVE_WITHIN_CHORD_ROUNDOFF", stationarity: null, multiplier: null,
      energy: shape * offsets.reduce((sum, offset) => sum + (magnitude(offset) / chordLengthMm) ** 2, 0) / 2 });
  }
  const seedDirection = offsets.find(offset => magnitude(offset) > chordLengthMm * 1e-10);
  if (!seedDirection) return fail("INVALID", "NONCOLLINEAR_SEED_REQUIRED");
  const transverseA = normalize(subtract(seedDirection, scale(longitudinal, dot(seedDirection, longitudinal))));
  const transverseB = normalize(cross(longitudinal, transverseA));
  const q0 = offsets.slice(1, -1).flatMap(offset => [dot(offset, transverseA) / chordLengthMm, dot(offset, transverseB) / chordLengthMm]);
  const pointsFor = q => [start, ...Array.from({ length: interior }, (_, i) => add(add(start, scale(chord, (i + 1) * h)),
    scale(add(scale(transverseA, q[2 * i]), scale(transverseB, q[2 * i + 1])), chordLengthMm))), end].map(point => [...point]);
  const measure = q => measurePoints(pointsFor(q));
  const matrix = Array.from({ length: interior }, (_, i) => Array.from({ length: interior }, (_, j) => i === j ? shape : 0));
  for (let i = 1; i < count - 1; i++) {
    const stencil = [[i - 1, 1], [i, -2], [i + 1, 1]].filter(([index]) => index > 0 && index < count - 1);
    for (const [row, a] of stencil) for (const [column, b] of stencil) matrix[row - 1][column - 1] += bending * a * b;
  }
  const inverseHessian = factorPositiveMatrix(matrix);
  const objective = q => {
    const full = [0, 0, ...q, 0, 0];
    let energy = 0;
    for (let i = 1; i < count - 1; i++) for (let axis = 0; axis < 2; axis++) {
      const second = full[2 * (i - 1) + axis] - 2 * full[2 * i + axis] + full[2 * (i + 1) + axis];
      energy += bending * second * second / 2;
    }
    energy += shape * q.reduce((sum, value, i) => sum + (value - q0[i]) ** 2, 0) / 2;
    const gradient = q.map((_, index) => matrix[Math.floor(index / 2)].reduce((sum, value, j) => sum + value * q[2 * j + index % 2], 0) - shape * q0[index]);
    return { energy, gradient };
  };
  const maxMovement = q => Math.max(...pointsFor(q).map((point, i) => distance(point, initialPoints[i])));
  let q = [...q0], penalty = 1;
  const initialProjectionMovementMm = maxMovement(q);
  if (!Number.isFinite(initialProjectionMovementMm)) return fail("NONCONVERGED", "UNSUPPORTED_NUMERIC_RANGE");
  if (initialProjectionMovementMm > displacementBoundMm) return fail("NONCONVERGED", "INITIAL_PROJECTION_EXCEEDS_DISPLACEMENT_BOUND",
    { residuals: { maxControlDisplacementMm: initialProjectionMovementMm,
      maxDisplacementViolationMm: initialProjectionMovementMm - displacementBoundMm } });
  let current = measure(q);
  if (!current) return fail("NONCONVERGED", evaluations >= settings.maxEvaluations ? "EVALUATION_LIMIT" : "INTEGRATION_FAILED");
  const target = targetLengthMm / chordLengthMm;
  for (; iterations < settings.maxIterations; iterations++) {
    const { energy, gradient } = objective(q), residual = current.length - target;
    const lengthGradient = [];
    for (let i = 0; i < q.length; i++) {
      const plus = [...q], minus = [...q];
      plus[i] += settings.finiteDifferenceStep; minus[i] -= settings.finiteDifferenceStep;
      const a = measure(plus), b = measure(minus);
      if (!a || !b) return fail("NONCONVERGED", evaluations >= settings.maxEvaluations ? "EVALUATION_LIMIT" : "INTEGRATION_FAILED");
      lengthGradient.push((a.length - b.length) / (2 * settings.finiteDifferenceStep));
    }
    const inverseEnergy = inverseHessian(gradient), inverseLength = inverseHessian(lengthGradient);
    const denominator = vectorDot(lengthGradient, inverseLength);
    if (!Number.isFinite(denominator) || denominator < 1e-18) return fail("NONCONVERGED", "SINGULAR_LENGTH_GRADIENT");
    const multiplier = -vectorDot(lengthGradient, inverseEnergy) / denominator;
    const lagrangian = gradient.map((value, i) => value + multiplier * lengthGradient[i]);
    const stationarity = Math.sqrt(Math.max(0, vectorDot(lagrangian, inverseHessian(lagrangian)))) /
      Math.max(1, Math.sqrt(Math.max(0, vectorDot(gradient, inverseEnergy))));
    if (Math.abs(residual) <= target * settings.relativeLengthTolerance && stationarity <= settings.stationarityTolerance) {
      return success(current, { reason: "LENGTH_AND_STATIONARITY_SATISFIED", stationarity, energy, multiplier });
    }
    const coefficient = (vectorDot(lengthGradient, inverseEnergy) - residual) / denominator;
    let step = inverseEnergy.map((value, i) => -value + coefficient * inverseLength[i]);
    const stepSize = Math.max(...Array.from({ length: interior }, (_, i) => Math.hypot(step[2 * i], step[2 * i + 1]))) * chordLengthMm;
    if (stepSize > settings.maxStepMm) step = step.map(value => value * settings.maxStepMm / stepSize);
    penalty = Math.max(penalty, Math.abs(multiplier) + 1);
    const merit = energy + penalty * Math.abs(residual);
    const slope = vectorDot(gradient, step) - penalty * Math.abs(vectorDot(lengthGradient, step));
    let accepted = false;
    for (let attempt = 0, alpha = 1; attempt < 24; attempt++, alpha /= 2) {
      const candidate = q.map((value, i) => value + alpha * step[i]);
      if (maxMovement(candidate) > displacementBoundMm) continue;
      const measured = measure(candidate);
      if (!measured) return fail("NONCONVERGED", evaluations >= settings.maxEvaluations ? "EVALUATION_LIMIT" : "INTEGRATION_FAILED");
      const candidateMerit = objective(candidate).energy + penalty * Math.abs(measured.length - target);
      if (candidateMerit <= merit + 1e-4 * alpha * Math.min(slope, 0)) {
        q = candidate; current = measured; accepted = true; break;
      }
    }
    if (!accepted) return fail("NONCONVERGED", "LINE_SEARCH_STALLED", { finalLengthMm: current.measurement.totalLength });
  }
  return fail("NONCONVERGED", "ITERATION_LIMIT", { finalLengthMm: current.measurement.totalLength });
}
