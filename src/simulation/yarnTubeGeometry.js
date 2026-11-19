import { add, subtract, scale, dot, cross, magnitude, distance, normalize, finiteVector,
  validUnit, invalid, diagnostic } from "./yarnSpatialMath.js";

function circumferenceFractions(radiusA, radiusB, radialSegments) {
  const cumulative = [0];
  const speed = angle => Math.hypot(radiusA * Math.sin(angle), radiusB * Math.cos(angle));
  let total = 0;
  for (let ring = 0; ring < radialSegments; ring++) {
    // Composite Simpson on each angular interval keeps ellipse v proportional to
    // perimeter distance; it is unrelated to the centerline length authority.
    const start = 2 * Math.PI * ring / radialSegments, step = 2 * Math.PI / radialSegments / 16;
    let sum = speed(start) + speed(start + 16 * step);
    for (let j = 1; j < 16; j++) sum += (j % 2 ? 4 : 2) * speed(start + j * step);
    total += sum * step / 3;
    cumulative.push(total);
  }
  return cumulative.map(value => value / total);
}

/** Sweeps TEST_ONLY supplied radii in the path's declared unit. This is geometric
 * construction, with no material, load, collision, or manufacturing authority. */
export function buildYarnTubeGeometry(options = {}) {
  const { path, radiusA, radiusB = radiusA, uvRepeatLength } = options;
  const frames = Array.isArray(options.frames) ? options.frames : options.frames?.frames;
  const radialSegments = options.radialSegments ?? 16, capEnds = options.capEnds ?? false;
  const points = path?.points, lengths = path?.cumulativeLengths;
  if (path?.status !== "OK" || !validUnit(path.unit) || !Array.isArray(points) || points.length < 2 ||
    !points.every(finiteVector) || !Array.isArray(lengths) || lengths.length !== points.length ||
    lengths[0] !== 0 || !lengths.every((value, i) => Number.isFinite(value) && (!i || value > lengths[i - 1])) ||
    !Array.isArray(frames) || frames.length !== points.length ||
    (options.frames?.status && options.frames.status !== "OK") ||
    !Number.isFinite(radiusA) || radiusA <= 0 || !Number.isFinite(radiusB) || radiusB <= 0 ||
    !Number.isFinite(uvRepeatLength) || uvRepeatLength <= 0 ||
    !Number.isInteger(radialSegments) || radialSegments < 3 || radialSegments > 256 || typeof capEnds !== "boolean") {
    return invalid("INVALID_TUBE_INPUT", "Finite XYZ samples/frames, positive radii and UV repeat in the same unit, and 3–256 radial segments are required.");
  }
  if (path.diagnostics?.some(item => ["NONREGULAR_CUSP", "TANGENT_DISCONTINUITY"].includes(item.code))) {
    return invalid("NONSMOOTH_CENTERLINE", "A regular smooth centerline is required; corners must be resolved before tube construction.");
  }
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (![frame?.tangent, frame?.normal, frame?.binormal].every(finiteVector) ||
      Math.max(...[frame.tangent, frame.normal, frame.binormal].map(v => Math.abs(magnitude(v) - 1)),
        Math.abs(dot(frame.tangent, frame.normal)), Math.abs(dot(frame.tangent, frame.binormal)), Math.abs(dot(frame.normal, frame.binormal)),
        distance(cross(frame.tangent, frame.normal), frame.binormal)) > 1e-5) {
      return invalid("INVALID_TUBE_FRAME", "Every frame must be an orthonormal right-handed XYZ basis.", { sampleIndex: i });
    }
    if (i && distance(points[i], points[i - 1]) === 0) return invalid("DUPLICATE_PATH_SAMPLES", "Adjacent path samples coincide.", { sampleIndex: i });
    if (i) {
      const tangentChange = distance(frame.tangent, frames[i - 1].tangent);
      const chord = distance(points[i], points[i - 1]);
      if (dot(frame.tangent, frames[i - 1].tangent) <= 0 || Math.max(radiusA, radiusB) * tangentChange >= chord * (1 - 1e-6)) {
        return invalid("LOCAL_TUBE_FOLD", "Radius exceeds the sampled local bending radius, or a tangent turn needs finer sampling.", { sampleIndex: i });
      }
    }
  }
  if (path.closed && (distance(points[0], points.at(-1)) > lengths.at(-1) * 1e-9 ||
    distance(frames[0].normal, frames.at(-1).normal) > 1e-6 || distance(frames[0].tangent, frames.at(-1).tangent) > 1e-6)) {
    return invalid("INVALID_CLOSED_SEAM", "The final position and transported frame must close before tube construction.");
  }
  const rings = points.length, stride = radialSegments + 1, capped = capEnds && !path.closed;
  const sideVertices = rings * stride, vertexCount = sideVertices + (capped ? 2 * (stride + 1) : 0);
  if (vertexCount > 2000000) return invalid("MESH_LIMIT_EXCEEDED", "The experiment limits a tube to two million vertices.");
  const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3);
  const tangents = new Float32Array(vertexCount * 3), uv = new Float32Array(vertexCount * 2), indices = [];
  const fractions = circumferenceFractions(radiusA, radiusB, radialSegments);
  const ringPoints = points.map((point, i) => Array.from({ length: stride }, (_, j) => {
    const theta = 2 * Math.PI * (j === radialSegments ? 0 : j) / radialSegments;
    return add(point, add(scale(frames[i].normal, radiusA * Math.cos(theta)), scale(frames[i].binormal, radiusB * Math.sin(theta))));
  }));
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const setVertex = (index, point, normal, tangent, texture) => {
    positions.set(point, index * 3); normals.set(normal, index * 3); tangents.set(tangent, index * 3); uv.set(texture, index * 2);
    for (let axis = 0; axis < 3; axis++) {
      bounds.min[axis] = Math.min(bounds.min[axis], positions[index * 3 + axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], positions[index * 3 + axis]);
    }
  };
  for (let i = 0; i < rings; i++) {
    let previous = Math.max(0, i - 1), next = Math.min(rings - 1, i + 1);
    if (path.closed && (i === 0 || i === rings - 1)) { previous = rings - 2; next = 1; }
    for (let j = 0; j <= radialSegments; j++) {
      const theta = 2 * Math.PI * (j === radialSegments ? 0 : j) / radialSegments;
      const circumferential = add(scale(frames[i].normal, -radiusA * Math.sin(theta)), scale(frames[i].binormal, radiusB * Math.cos(theta)));
      const longitudinal = subtract(ringPoints[next][j], ringPoints[previous][j]);
      const outward = cross(circumferential, longitudinal);
      const expected = add(scale(frames[i].normal, Math.cos(theta) / radiusA), scale(frames[i].binormal, Math.sin(theta) / radiusB));
      if (magnitude(longitudinal) === 0 || magnitude(outward) === 0 || dot(outward, expected) <= 0) {
        return invalid("LOCAL_TUBE_FOLD", "The swept surface reverses or loses its outward orientation.", { sampleIndex: i, radialIndex: j });
      }
      setVertex(i * stride + j, ringPoints[i][j], normalize(outward), normalize(longitudinal), [lengths[i] / uvRepeatLength, fractions[j]]);
      if (i < rings - 1 && j < radialSegments) {
        const a = i * stride + j, b = a + stride;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  if (capped) for (const end of [0, 1]) {
    const ring = end ? rings - 1 : 0, base = sideVertices + end * (stride + 1), center = base + stride;
    const normal = scale(frames[ring].tangent, end ? 1 : -1);
    for (let j = 0; j <= radialSegments; j++) {
      const theta = 2 * Math.PI * j / radialSegments;
      setVertex(base + j, ringPoints[ring][j], normal, frames[ring].normal, [0.5 + 0.5 * Math.cos(theta), 0.5 + 0.5 * Math.sin(theta)]);
      if (j < radialSegments) indices.push(...(end ? [center, base + j, base + j + 1] : [center, base + j + 1, base + j]));
    }
    setVertex(center, points[ring], normal, frames[ring].normal, [0.5, 0.5]);
  }
  if (![positions, normals, tangents, uv].every(array => array.every(Number.isFinite))) {
    return invalid("NONFINITE_MESH", "Geometry exceeds the finite Float32 range.");
  }
  const get = (array, index) => Array.from(array.subarray(index * 3, index * 3 + 3));
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3);
    const normal = cross(subtract(get(positions, b), get(positions, a)), subtract(get(positions, c), get(positions, a)));
    const average = add(add(get(normals, a), get(normals, b)), get(normals, c));
    if (magnitude(normal) === 0 || dot(normal, average) <= 0) {
      return invalid("DEGENERATE_OR_INVERTED_TRIANGLE", "Float32 mesh contains a degenerate or inward triangle.", { triangleIndex: i / 3 });
    }
  }
  return { status: "OK", positions, normals, tangents, uv, indices: new Uint32Array(indices), bounds,
    counts: { vertices: vertexCount, triangles: indices.length / 3, rings, radialSegments, caps: capped ? 2 : 0 }, unit: path.unit,
    diagnostics: [diagnostic("GLOBAL_SELF_INTERSECTION_NOT_EVALUATED", "Local fold checks do not evaluate global self-contact or inter-yarn intersections."),
      diagnostic("TEST_ONLY_GEOMETRY", "Radii and UV repeat are supplied experimental geometry; no physical diameter or material calibration is inferred.")] };
}
