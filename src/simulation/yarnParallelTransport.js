import { subtract, scale, dot, cross, magnitude, distance, normalize, finiteVector,
  validUnit, clamp, rotate, perpendicular, invalid, diagnostic } from "./yarnSpatialMath.js";

/** Rotation-minimizing frames by the minimal rotation between adjacent tangents.
 * Exact reversals have no unique transport axis and are explicitly rejected. */
export function buildParallelTransportFrames(path) {
  const points = path?.points, tangents = path?.tangents, lengths = path?.cumulativeLengths;
  if (path?.status !== "OK" || !validUnit(path.unit) || !Array.isArray(points) || points.length < 2 ||
    !Array.isArray(tangents) || tangents.length !== points.length ||
    !Array.isArray(lengths) || lengths.length !== points.length || !Number.isFinite(path.totalLength) || path.totalLength <= 0 ||
    !points.every(finiteVector) || !tangents.every(t => finiteVector(t) && magnitude(t) > 0) ||
    lengths[0] !== 0 || !lengths.every((value, i) => Number.isFinite(value) && (!i || value > lengths[i - 1])) ||
    Math.abs(lengths.at(-1) - path.totalLength) > path.totalLength * 1e-10) {
    return invalid("INVALID_FRAME_INPUT", "A finite, regular sampled XYZ path with increasing arclength is required.");
  }
  if (path.diagnostics?.some(item => item.code === "NONREGULAR_CUSP")) {
    return invalid("NONREGULAR_CUSP", "Transport cannot cross a stationary point or a reversal cusp.");
  }
  const unitTangents = tangents.map(normalize), diagnostics = [], frames = [];
  if (path.closed && (distance(points[0], points.at(-1)) > path.totalLength * 1e-9 ||
    distance(unitTangents[0], unitTangents.at(-1)) > 1e-8)) {
    return invalid("INVALID_CLOSED_SEAM", "A closed path must repeat its endpoint and tangent.");
  }
  for (let i = 0; i < points.length; i++) {
    if (i && distance(points[i - 1], points[i]) === 0) {
      return invalid("DUPLICATE_PATH_SAMPLES", "Adjacent coincident samples cannot define a regular surface.", { sampleIndex: i });
    }
    const tangent = unitTangents[i];
    let normal;
    if (i === 0) normal = perpendicular(tangent);
    else {
      const previous = frames[i - 1], axis = cross(previous.tangent, tangent);
      const sine = magnitude(axis), cosine = clamp(dot(previous.tangent, tangent), -1, 1);
      if (sine <= 1e-12 && cosine < 0) return invalid("ANTIPARALLEL_TANGENTS",
        "Exact antiparallel tangents have no unique minimal rotation axis; refine or repair the cusp.", { sampleIndex: i });
      const angle = Math.atan2(sine, cosine);
      if (cosine < 0) diagnostics.push(diagnostic("LARGE_TANGENT_TURN", "A turn larger than 90 degrees is transported deterministically; refine sampling before meshing.",
        { sampleIndex: i, angleRadians: angle }));
      normal = sine > 1e-12 ? rotate(previous.normal, scale(axis, 1 / sine), angle) : previous.normal;
      normal = normalize(subtract(normal, scale(tangent, dot(normal, tangent))));
    }
    frames.push({ tangent, normal, binormal: normalize(cross(tangent, normal)) });
  }
  if (path.closed) {
    const first = frames[0], last = frames.at(-1);
    const correction = Math.atan2(dot(first.tangent, cross(last.normal, first.normal)), clamp(dot(last.normal, first.normal), -1, 1));
    for (let i = 1; i < frames.length; i++) {
      const frame = frames[i];
      frame.normal = normalize(rotate(frame.normal, frame.tangent, correction * lengths[i] / path.totalLength));
      frame.binormal = normalize(cross(frame.tangent, frame.normal));
    }
    frames[frames.length - 1] = { tangent: [...first.tangent], normal: [...first.normal], binormal: [...first.binormal] };
    diagnostics.push(diagnostic("CLOSED_SEAM_CORRECTED", "Residual frame twist was distributed by integrated arclength around the closed curve.",
      { correctionRadians: correction, seamNormalError: distance(first.normal, frames.at(-1).normal) }));
  }
  if (!frames.every(frame => [frame.tangent, frame.normal, frame.binormal]
    .every(vector => finiteVector(vector) && Math.abs(magnitude(vector) - 1) < 1e-10))) {
    return invalid("NONFINITE_FRAME", "Frame normalization exceeded the supported numeric range.");
  }
  return { status: "OK", frames, unit: path.unit, closed: path.closed, diagnostics };
}
