import { add, subtract, scale, dot, magnitude, distance, normalize, finiteVector,
  validUnit, clamp, invalid, diagnostic } from "./yarnSpatialMath.js";
import { measureSpatialLength, integrateSpatialSegment } from "./yarnSpatialLength.js";

// Isolate roots on monotone polynomial intervals, obtained recursively from the
// derivative. This catches narrow extrema that fixed quadrature nodes can miss.
function polynomialRootsInUnitInterval(input) {
  const coefficients = [...input];
  while (coefficients.length > 1 && coefficients[0] === 0) coefficients.shift();
  const size = Math.max(...coefficients.map(Math.abs));
  if (!Number.isFinite(size) || size === 0 || coefficients.length === 1) return [];
  const values = coefficients.map(value => value / size), degree = values.length - 1;
  if (degree === 1) {
    const root = -values[1] / values[0];
    return root >= 0 && root <= 1 ? [root] : [];
  }
  const evaluate = u => values.reduce((value, coefficient) => value * u + coefficient, 0);
  const knots = [0, ...polynomialRootsInUnitInterval(values.slice(0, -1).map((value, i) => value * (degree - i))), 1];
  const roots = knots.filter(u => Math.abs(evaluate(u)) <= 32 * Number.EPSILON);
  for (let i = 1; i < knots.length; i++) {
    let low = knots[i - 1], high = knots[i], lowValue = evaluate(low), highValue = evaluate(high);
    if (lowValue === 0 || highValue === 0 || (lowValue > 0) === (highValue > 0)) continue;
    for (let iteration = 0; iteration < 64; iteration++) {
      const middle = (low + high) / 2, value = evaluate(middle);
      if (middle === low || middle === high || value === 0) { low = high = middle; break; }
      if ((value > 0) === (lowValue > 0)) { low = middle; lowValue = value; }
      else { high = middle; highValue = value; }
    }
    roots.push((low + high) / 2);
  }
  return roots.sort((a, b) => a - b).filter((value, i, sorted) => !i || value - sorted[i - 1] > 1e-14);
}

function polynomialSegment(p0, p1, m0, m1) {
  const a = add(scale(subtract(p0, p1), 2), add(m0, m1));
  const b = subtract(scale(subtract(p1, p0), 3), add(scale(m0, 2), m1));
  const derivative = u => add(add(scale(a, 3 * u * u), scale(b, 2 * u)), m0);
  const point = u => add(p0, add(scale(m0, u), add(scale(b, u * u), scale(a, u * u * u))));
  const coefficients = [0, 1, 2].map(i => [3 * a[i], 2 * b[i], m0[i]]);
  const coefficientScale = Math.max(...coefficients.flat().map(Math.abs));
  const candidates = [0, 1, ...coefficients.flatMap(polynomialRootsInUnitInterval)];
  // With velocity A*u²+B*u+C, extrema of speed occur at roots of v·v'.
  // Normalize coefficients first so computing dot products does not square the coordinate scale.
  const [A, B, C] = [0, 1, 2].map(i => coefficients.map(component => component[i] / coefficientScale));
  candidates.push(...polynomialRootsInUnitInterval([2 * dot(A, A), 3 * dot(A, B),
    dot(B, B) + 2 * dot(A, C), dot(B, C)]));
  const integrationBreakpoints = candidates.filter(u => u > 0 && u < 1).sort((a, b) => a - b)
    .filter((value, i, sorted) => !i || value - sorted[i - 1] > 1e-14);
  // A cubic is nonregular only where all three quadratic derivatives vanish.
  const stationaryParameters = candidates.filter(u => u >= 0 && u <= 1 && magnitude(derivative(u)) <= coefficientScale * 1e-12);
  return { point, derivative, stationaryParameters, integrationBreakpoints };
}

/** Explicit XYZ coordinates and unit are required. Analytic references lie in XY,
 * with a helix's pitch measured along Z per turn. No material diameter is inferred. */
export function createSpatialCurve(config = {}) {
  if (!validUnit(config?.unit)) return invalid("INVALID_UNIT", "Spatial coordinates require an explicit mm, cm, or m unit.");
  if (config.closed !== undefined && typeof config.closed !== "boolean") return invalid("INVALID_CLOSURE", "closed must be a boolean.");
  const type = config.type, segments = [], diagnostics = [];
  let closed = config.closed ?? false;
  if (["line", "polyline", "catmull-rom"].includes(type)) {
    if (!Array.isArray(config.points) || config.points.length < 2 || !config.points.every(finiteVector)) {
      return invalid("INVALID_CONTROL_POINTS", "At least two finite XYZ control points are required.");
    }
    const points = config.points.map(point => [...point]);
    if (closed && distance(points[0], points.at(-1)) === 0) {
      points.pop();
      diagnostics.push(diagnostic("DUPLICATE_CLOSURE_REMOVED", "The repeated final control point was removed before periodic interpolation."));
    }
    if ((closed && points.length < 3) || (type === "line" && (points.length !== 2 || closed))) {
      return invalid("INVALID_CONTROL_COUNT", "A line needs exactly two points; a closed curve needs at least three distinct controls.");
    }
    const count = closed ? points.length : points.length - 1;
    for (let i = 0; i < count; i++) {
      if (distance(points[i], points[(i + 1) % points.length]) === 0) {
        return invalid("DUPLICATE_CONTROL_POINTS", "Consecutive repeated controls make a zero-length segment.", { segmentIndex: i });
      }
    }
    const tangentAt = i => {
      if (closed) return scale(subtract(points[(i + 1) % points.length], points[(i + points.length - 1) % points.length]), 0.5);
      if (i === 0) return subtract(points[1], points[0]);
      if (i === points.length - 1) return subtract(points[i], points[i - 1]);
      return scale(subtract(points[i + 1], points[i - 1]), 0.5);
    };
    for (let i = 0; i < count; i++) {
      const p0 = points[i], p1 = points[(i + 1) % points.length], difference = subtract(p1, p0);
      segments.push(type === "catmull-rom" ? polynomialSegment(p0, p1, tangentAt(i), tangentAt((i + 1) % points.length)) :
        { point: u => add(p0, scale(difference, u)), derivative: () => [...difference], stationaryParameters: [], integrationBreakpoints: [] });
    }
  } else if (type === "hermite") {
    // Explicit endpoint derivatives reuse the same regularity analysis and cubic
    // polynomial as Catmull-Rom. This adds no independent curve/sampling engine.
    if (closed || !Array.isArray(config.points) || config.points.length !== 2 ||
      !config.points.every(finiteVector) || !Array.isArray(config.tangents) || config.tangents.length !== 2 ||
      !config.tangents.every(t => finiteVector(t) && magnitude(t) > 0) || distance(...config.points) === 0) {
      return invalid("INVALID_HERMITE_ENDPOINTS", "An open Hermite segment requires two distinct finite points and two nonzero endpoint derivatives.");
    }
    segments.push(polynomialSegment(...config.points.map(p => [...p]), ...config.tangents.map(t => [...t])));
  } else if (type === "circle" || type === "helix") {
    const center = config.center === undefined ? [0, 0, 0] : config.center;
    const radius = config.radius, startAngle = config.startAngle ?? 0;
    const angle = type === "circle" ? (config.angle ?? 2 * Math.PI) : config.turns * 2 * Math.PI;
    const rise = type === "helix" ? config.pitch * config.turns : 0;
    if (!finiteVector(center) || !Number.isFinite(radius) || radius <= 0 || !Number.isFinite(startAngle) ||
      !Number.isFinite(angle) || angle === 0 || !Number.isFinite(rise) || Math.abs(angle) > 2048 * Math.PI) {
      return invalid("INVALID_ANALYTIC_CURVE", "A finite center, positive radius, nonzero angle/turns, and finite pitch are required (up to 1024 turns).");
    }
    const copiedCenter = [...center];
    const integerTurns = Math.round(angle / (2 * Math.PI));
    const wholeTurn = integerTurns !== 0 && Math.abs(angle / (2 * Math.PI) - integerTurns) < 1e-12;
    closed = config.closed ?? (rise === 0 && wholeTurn);
    if (closed && (!wholeTurn || rise !== 0)) return invalid("INVALID_CLOSURE", "A closed analytic curve must end at its starting point and tangent.");
    // Keep local increments independent of a potentially huge starting phase.
    const cosine0 = Math.cos(startAngle), sine0 = Math.sin(startAngle);
    const orientation = localAngle => {
      const cosine = Math.cos(localAngle), sine = Math.sin(localAngle);
      return [cosine0 * cosine - sine0 * sine, sine0 * cosine + cosine0 * sine];
    };
    const count = Math.max(1, Math.ceil(Math.abs(angle) / (Math.PI / 2)));
    for (let i = 0; i < count; i++) {
      const localAngle = angle / count;
      segments.push({ point: u => {
        const t = (i + u) / count, [cosine, sine] = orientation(angle * t);
        return add(copiedCenter, [radius * cosine, radius * sine, rise * t]);
      }, derivative: u => {
        const [cosine, sine] = orientation(angle * (i + u) / count);
        return [-radius * localAngle * sine, radius * localAngle * cosine, rise / count];
      }, stationaryParameters: [], integrationBreakpoints: [] });
    }
  } else return invalid("UNKNOWN_CURVE_TYPE", "Supported types are line, polyline, catmull-rom, hermite, circle, and helix.");

  let regular = true, maxPositionGap = 0, maxDerivativeGap = 0, maxTangentAngleRadians = 0, scaleReference = 0;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    segment.t0 = i / segments.length;
    segment.t1 = (i + 1) / segments.length;
    if (![segment.point(0), segment.point(1), segment.derivative(0), segment.derivative(1)].every(finiteVector)) {
      return invalid("NONFINITE_CURVE", "Curve evaluation overflowed finite XYZ coordinates.");
    }
    scaleReference = Math.max(scaleReference, magnitude(segment.derivative(0)), magnitude(segment.derivative(1)));
    if (segment.stationaryParameters.length) {
      regular = false;
      diagnostics.push(diagnostic("NONREGULAR_CUSP", "The curve has a zero derivative; a unique transport frame is undefined.",
        { segmentIndex: i, localParameters: segment.stationaryParameters }));
    }
    if (i || closed) {
      const previous = segments[(i + segments.length - 1) % segments.length];
      const before = previous.derivative(1), after = segment.derivative(0);
      maxPositionGap = Math.max(maxPositionGap, distance(previous.point(1), segment.point(0)));
      maxDerivativeGap = Math.max(maxDerivativeGap, distance(before, after));
      if (magnitude(before) && magnitude(after)) {
        const cosine = clamp(dot(normalize(before), normalize(after)), -1, 1);
        maxTangentAngleRadians = Math.max(maxTangentAngleRadians, 2 * Math.asin(clamp(distance(normalize(before), normalize(after)) / 2, 0, 1)));
        if (cosine < 1 - 1e-12) diagnostics.push(diagnostic("TANGENT_DISCONTINUITY", "The centerline has a corner between segments.",
          { segmentIndex: i, angleRadians: Math.acos(cosine) }));
        if (cosine < -1 + 1e-12) {
          regular = false;
          diagnostics.push(diagnostic("NONREGULAR_CUSP", "Opposite one-sided tangents form a reversal cusp.", { segmentIndex: i }));
        }
      }
    }
  }
  const evaluate = (method, t) => {
    if (!Number.isFinite(t) || t < 0 || t > 1) throw new RangeError("Curve parameter must be within [0,1].");
    const index = Math.min(segments.length - 1, Math.floor(t * segments.length));
    const value = segments[index][method](t * segments.length - index);
    return method === "derivative" ? scale(value, segments.length) : value;
  };
  const continuity = { positionContinuous: maxPositionGap <= scaleReference * 1e-10,
    tangentContinuous: regular && maxTangentAngleRadians <= 1e-10,
    derivativeContinuous: regular && maxDerivativeGap <= scaleReference * 1e-10,
    maxPositionGap, maxDerivativeGap, maxTangentAngleRadians, regular };
  const curve = { type, unit: config.unit, closed, regular, segments, diagnostics, continuity,
    point: t => evaluate("point", t), derivative: t => evaluate("derivative", t) };
  return { status: "OK", curve, diagnostics };
}

/** Samples have equal integrated spatial arclength; sampleCount affects mesh
 * resolution, while lengthMeasurement retains a separate quadrature accuracy. */
export function buildSpatialPath(input, options = {}) {
  const sampleCount = options.sampleCount ?? input?.sampleCount ?? 128;
  if (!Number.isInteger(sampleCount) || sampleCount < 2 || sampleCount > 100000) {
    return invalid("INVALID_SAMPLE_COUNT", "sampleCount must be an integer between 2 and 100000.");
  }
  const created = input?.curve ? { status: "OK", curve: input.curve } : input?.segments ?
    { status: "OK", curve: input } : createSpatialCurve(input);
  if (created.status !== "OK") return created;
  const curve = created.curve;
  if (curve.regular === false) return { status: "INVALID", reason: "NONREGULAR_CUSP", diagnostics: [...curve.diagnostics] };
  if (curve.closed && sampleCount < 4) return invalid("INVALID_SAMPLE_COUNT", "A closed path requires at least four samples including closure.");
  const lengthMeasurement = measureSpatialLength(curve, options);
  if (lengthMeasurement.status !== "OK") return { ...lengthMeasurement, lengthMeasurement };
  const { totalLength, segmentLengths, cumulativeLengths: segmentCumulative } = lengthMeasurement;
  const points = [], tangents = [], parameters = [], cumulativeLengths = [], diagnostics = [...(curve.diagnostics || [])];
  const targetTolerance = Math.max(lengthMeasurement.absoluteTolerance * 0.1, totalLength * 1e-12);
  let segmentIndex = 0;
  for (let i = 0; i < sampleCount; i++) {
    const last = i === sampleCount - 1;
    const target = last ? totalLength : totalLength * (i / (sampleCount - 1));
    while (segmentIndex < segmentLengths.length - 1 && segmentCumulative[segmentIndex + 1] < target) segmentIndex++;
    if (last) segmentIndex = curve.segments.length - 1;
    const segment = curve.segments[segmentIndex], localTarget = target - segmentCumulative[segmentIndex];
    let u = clamp(localTarget / segmentLengths[segmentIndex], 0, 1), low = 0, high = 1, converged = i === 0 || i === sampleCount - 1;
    if (i === 0) u = 0;
    else if (i === sampleCount - 1) u = 1;
    else for (let attempt = 0; attempt < 48; attempt++) {
      const integral = integrateSpatialSegment(segment, { ...options, absoluteTolerance: targetTolerance * 0.1 }, 0, u);
      if (integral.status !== "OK") return { ...integral, reason: "RESAMPLING_INTEGRATION_FAILED" };
      const error = integral.length - localTarget;
      if (Math.abs(error) <= targetTolerance) { converged = true; break; }
      if (error < 0) low = u; else high = u;
      const speed = magnitude(segment.derivative(u));
      const newton = u - error / speed;
      u = newton > low && newton < high ? newton : (low + high) / 2;
    }
    if (!converged) return { status: "NONCONVERGED", reason: "RESAMPLING_NONCONVERGENCE",
      diagnostics: [diagnostic("RESAMPLING_NONCONVERGENCE", "Arc-length inversion did not reach tolerance.", { sampleIndex: i })] };
    const t = (segmentIndex + clamp(u, 0, 1)) / curve.segments.length;
    const point = curve.point(t), derivative = curve.derivative(t);
    if (!finiteVector(point) || !finiteVector(derivative) || magnitude(derivative) === 0) {
      return invalid("NONREGULAR_SAMPLE", "A sampled point or tangent is not finite and regular.", { sampleIndex: i });
    }
    const tangent = normalize(derivative);
    if (!finiteVector(tangent) || Math.abs(magnitude(tangent) - 1) > 1e-10) {
      return invalid("NONFINITE_TANGENT", "The normalized sample tangent is outside the supported numeric range.", { sampleIndex: i });
    }
    points.push(point); tangents.push(tangent); parameters.push(t); cumulativeLengths.push(target);
  }
  if (curve.closed) { points[points.length - 1] = [...points[0]]; tangents[tangents.length - 1] = [...tangents[0]]; }
  if (parameters[0] !== 0 || parameters.at(-1) !== 1 ||
    !parameters.every((value, i) => Number.isFinite(value) && (!i || value > parameters[i - 1])) ||
    !cumulativeLengths.every((value, i) => Number.isFinite(value) && (!i || value > cumulativeLengths[i - 1])) ||
    !points.every((point, i) => finiteVector(point) && (!i || distance(point, points[i - 1]) > 0))) {
    return invalid("SPATIAL_SAMPLING_PRECISION_LOSS", "Sample coordinates, parameters, or cumulative lengths cannot be represented as finite distinct values at this scale.");
  }
  return { status: "OK", curve, points, tangents, parameters, cumulativeLengths, totalLength,
    unit: curve.unit, closed: curve.closed, lengthMeasurement, continuity: curve.continuity, diagnostics };
}
