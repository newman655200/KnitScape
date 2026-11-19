import { finiteVector, magnitude, validUnit, invalid, diagnostic } from "./yarnSpatialMath.js";

// The standard 7/15 Gauss–Kronrod nodes/weights and variation-based error control
// follow QUADPACK dqk15: https://jacobwilliams.github.io/quadpack/proc/dqk15.html
const KRONROD_NODES = [0.9914553711208126, 0.9491079123427585, 0.8648644233597691,
  0.7415311855993945, 0.5860872354676911, 0.4058451513773972, 0.2077849550078985];
const KRONROD_WEIGHTS = [0.02293532201052922, 0.06309209262997855, 0.1047900103222502,
  0.1406532597155259, 0.1690047266392679, 0.1903505780647854, 0.2044329400752989, 0.2094821410847278];
const GAUSS_WEIGHTS = [0.1294849661688697, 0.2797053914892767, 0.3818300505051189, 0.4179591836734694];

function integrationOptions(options = {}) {
  const absoluteTolerance = options.absoluteTolerance ?? 1e-8;
  const relativeTolerance = options.relativeTolerance ?? 1e-9;
  const maxDepth = options.maxDepth ?? 20;
  if (!Number.isFinite(absoluteTolerance) || absoluteTolerance < 0 ||
    !Number.isFinite(relativeTolerance) || relativeTolerance < 0 ||
    absoluteTolerance + relativeTolerance <= 0 || !Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 30) return null;
  return { absoluteTolerance, relativeTolerance, maxDepth };
}

// Adaptive Gauss–Kronrod integration of ||dXYZ/du||. Segment u spans [0,1].
// The returned estimate is a numerical error estimate, not a physical tolerance.
export function integrateSpatialSegment(segment, options = {}, from = 0, to = 1) {
  const settings = integrationOptions(options);
  if (!settings || typeof segment?.derivative !== "function" || !Number.isFinite(from) ||
    !Number.isFinite(to) || from < 0 || to > 1 || from > to ||
    (segment.integrationBreakpoints !== undefined && (!Array.isArray(segment.integrationBreakpoints) ||
      !segment.integrationBreakpoints.every(value => Number.isFinite(value) && value > 0 && value < 1)))) {
    return invalid("INVALID_INTEGRATION_INPUT", "A derivative, ordered [0,1] interval, and finite tolerances are required.");
  }
  if (from === to) return { status: "OK", length: 0, errorEstimate: 0, evaluations: 0, diagnostics: [] };
  let evaluations = 0;
  const speed = u => {
    const derivative = segment.derivative(u);
    const value = finiteVector(derivative) ? magnitude(derivative) : NaN;
    if (!Number.isFinite(value)) throw new RangeError("Nonfinite spatial derivative");
    evaluations++;
    return value;
  };
  const requireFinite = values => {
    if (values.some(value => !Number.isFinite(value))) {
      const error = new RangeError("Spatial quadrature overflowed the finite numeric range");
      error.code = "NONFINITE_LENGTH";
      throw error;
    }
  };
  const quadrature = (start, end) => {
    const middle = (start + end) / 2, half = (end - start) / 2, center = speed(middle);
    const pairs = KRONROD_NODES.map(node => [speed(middle - half * node), speed(middle + half * node)]);
    let kronrod = center * KRONROD_WEIGHTS[7], gauss = center * GAUSS_WEIGHTS[3];
    for (let i = 0; i < pairs.length; i++) {
      const sum = pairs[i][0] + pairs[i][1];
      kronrod += KRONROD_WEIGHTS[i] * sum;
      if (i % 2 === 1) gauss += GAUSS_WEIGHTS[(i - 1) / 2] * sum;
    }
    const mean = kronrod / 2;
    let variation = KRONROD_WEIGHTS[7] * Math.abs(center - mean);
    for (let i = 0; i < pairs.length; i++) variation += KRONROD_WEIGHTS[i] *
      (Math.abs(pairs[i][0] - mean) + Math.abs(pairs[i][1] - mean));
    variation *= half;
    const length = kronrod * half, rawError = Math.abs((kronrod - gauss) * half);
    const roundoffFloor = 50 * Number.EPSILON * Math.abs(length);
    const scaledError = variation > 0 ? variation * Math.min(1, (200 * rawError / variation) ** 1.5) : rawError;
    const errorEstimate = Math.max(rawError, scaledError, roundoffFloor);
    requireFinite([length, errorEstimate, roundoffFloor]);
    return { length, errorEstimate, roundoffFloor };
  };
  try {
    const boundaries = [from, ...(segment.integrationBreakpoints || []).filter(value => value > from && value < to), to]
      .sort((a, b) => a - b).filter((value, i, sorted) => !i || value > sorted[i - 1]);
    const intervals = boundaries.slice(1).map((end, i) => {
      const start = boundaries[i];
      return { start, end, initial: quadrature(start, end) };
    });
    const initial = intervals.reduce((sum, interval) => sum + interval.initial.length, 0);
    const tolerance = Math.max(settings.absoluteTolerance, settings.relativeTolerance * initial);
    requireFinite([initial, tolerance]);
    let converged = true, roundoffLimited = false;
    const recurse = (start, end, estimate, allowance, depth) => {
      const middle = (start + end) / 2;
      if (middle === start || middle === end) {
        if (estimate.errorEstimate > allowance) { converged = false; roundoffLimited = true; }
        return estimate;
      }
      const left = quadrature(start, middle), right = quadrature(middle, end);
      const length = left.length + right.length;
      // Require agreement across both embedded orders AND interval bisection.
      // Fourfold error control avoids treating a fortunate order-pair agreement
      // near a steep speed minimum as high confidence.
      const roundoffFloor = 4 * (left.roundoffFloor + right.roundoffFloor);
      const errorEstimate = 4 * Math.max(left.errorEstimate + right.errorEstimate, Math.abs(length - estimate.length));
      requireFinite([length, errorEstimate, roundoffFloor]);
      if (errorEstimate <= allowance) return { length, errorEstimate };
      if (depth === 0 || (roundoffFloor > allowance && errorEstimate <= roundoffFloor)) {
        converged = false;
        if (roundoffFloor > allowance) roundoffLimited = true;
        return { length, errorEstimate };
      }
      const first = recurse(start, middle, left, allowance / 2, depth - 1);
      const second = recurse(middle, end, right, allowance / 2, depth - 1);
      return { length: first.length + second.length, errorEstimate: first.errorEstimate + second.errorEstimate };
    };
    const result = { length: 0, errorEstimate: 0 };
    for (const interval of intervals) {
      const part = recurse(interval.start, interval.end, interval.initial, tolerance / intervals.length, settings.maxDepth);
      result.length += part.length;
      result.errorEstimate += part.errorEstimate;
    }
    if (!Number.isFinite(result.length) || !Number.isFinite(result.errorEstimate)) {
      return invalid("NONFINITE_LENGTH", "Spatial integration overflowed.");
    }
    const diagnostics = segment.integrationBreakpoints ? [] : [diagnostic("UNSTRUCTURED_SPEED_INTEGRAL",
      "This supplied derivative has no critical-point metadata; the quadrature error estimate does not certify unresolved extrema.")];
    if (result.errorEstimate > Math.max(settings.absoluteTolerance, settings.relativeTolerance * result.length)) converged = false;
    if (!converged) diagnostics.push(diagnostic("INTEGRATION_NONCONVERGENCE", "Subdivision depth or numeric precision prevented the requested error tolerance."));
    if (roundoffLimited) diagnostics.push(diagnostic("INTEGRATION_ROUNDOFF_LIMIT", "The requested precision is below the floating-point error floor."));
    return { status: converged ? "OK" : "NONCONVERGED", ...result, evaluations, criticalSubintervals: intervals.length, diagnostics };
  } catch (error) {
    if (error.code === "NONFINITE_LENGTH") return invalid("NONFINITE_LENGTH", error.message, { evaluations });
    return invalid("NONFINITE_DERIVATIVE", "The spatial derivative could not be evaluated as finite XYZ.", { detail: String(error.message) });
  }
}

export function measureSpatialLength(curve, options = {}) {
  const settings = integrationOptions(options);
  if (!settings || !validUnit(curve?.unit) || !Array.isArray(curve?.segments) || !curve.segments.length) {
    return invalid("INVALID_LENGTH_INPUT", "A spatial curve with explicit mm/cm/m unit and valid tolerances is required.");
  }
  const segmentLengths = [], cumulativeLengths = [0], diagnostics = [];
  let totalLength = 0, errorEstimate = 0, evaluations = 0, status = "OK";
  for (let index = 0; index < curve.segments.length; index++) {
    const result = integrateSpatialSegment(curve.segments[index], { ...settings,
      absoluteTolerance: settings.absoluteTolerance / curve.segments.length });
    if (result.status === "INVALID") return result;
    if (result.status !== "OK") status = "NONCONVERGED";
    const nextLength = totalLength + result.length;
    if (!Number.isFinite(nextLength)) return invalid("NONFINITE_LENGTH", "Accumulated centerline length exceeds the finite numeric range.", { segmentIndex: index });
    if (result.length > 0 && nextLength <= totalLength) {
      return invalid("CUMULATIVE_LENGTH_PRECISION_LOSS", "A positive segment cannot be represented in the cumulative length at this coordinate scale.", { segmentIndex: index });
    }
    segmentLengths.push(result.length);
    totalLength = nextLength;
    cumulativeLengths.push(totalLength);
    errorEstimate += result.errorEstimate;
    evaluations += result.evaluations;
    diagnostics.push(...result.diagnostics.map(item => ({ ...item, segmentIndex: index })));
  }
  if (!Number.isFinite(totalLength) || totalLength <= 0) return invalid("DEGENERATE_LENGTH", "Centerline length must be finite and positive.");
  if (errorEstimate > Math.max(settings.absoluteTolerance, settings.relativeTolerance * totalLength)) {
    status = "NONCONVERGED";
    diagnostics.push(diagnostic("INTEGRATION_NONCONVERGENCE", "The accumulated curve error estimate exceeds the requested whole-curve tolerance."));
  }
  return { status, totalLength, segmentLengths, cumulativeLengths, errorEstimate, evaluations,
    unit: curve.unit, method: "adaptive-gauss-kronrod-15-speed-integral", ...settings, diagnostics };
}
