import { sampleYarnFuzzMaterial } from "./yarnMaterial.js";

const clamp = (value, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, value));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (v, fallback = [0, 0, 1]) => {
  const length = Math.hypot(...v);
  return length > 1e-15 ? v.map(value => value / length) : [...fallback];
};
const hasGenerated = parameters => ["generated", "both"].includes(parameters.fuzzSource) && parameters.fuzzStrength > 0;

/** Resolve appearance-only yarn properties. No value here is a measured material
 * property. Explicit options override defaults derived from the yarn's strength;
 * zero strength disables generated fibers and halo, including manual overrides.
 */
export function normalizeFuzzParameters(sourceMaterial = {}, options = {}) {
  const image = sourceMaterial.baseColor ?? sourceMaterial.images?.baseColor;
  const hasAlpha = image?.channels === 2 || image?.channels === 4;
  const fuzzSource = options.fuzzSource ?? (hasAlpha ? "both" : "generated");
  if (!["off", "scan", "generated", "both"].includes(fuzzSource)) throw new RangeError("Unknown fuzzSource.");
  if (["scan", "both"].includes(fuzzSource) && !hasAlpha) throw new RangeError("Scanning fuzz requires baseColor alpha.");
  const fuzzStrength = options.fuzzStrength ?? sourceMaterial.fuzzStrength ?? 0.45;
  const parameters = { fuzzSource, fuzzStrength,
    hairinessIndex: options.hairinessIndex ?? 16 * fuzzStrength,
    meanHairLengthMm: options.meanHairLengthMm ?? 0.3,
    hairAngleDeg: options.hairAngleDeg ?? 30,
    maxCurvaturePerMm: options.maxCurvaturePerMm ?? 6,
    fiberOpacity: options.fiberOpacity ?? 0.45,
    haloStrength: options.haloStrength ?? fuzzStrength,
    haloWidthR: options.haloWidthR ?? 0.6,
    seed: options.seed ?? 1,
  };
  for (const [key, value] of Object.entries(parameters)) if (key !== "fuzzSource" && !Number.isFinite(value)) {
    throw new RangeError(`Fuzz parameter ${key} must be finite.`);
  }
  if ([fuzzStrength, parameters.fiberOpacity, parameters.haloStrength].some(value => value < 0 || value > 1) ||
      parameters.hairinessIndex < 0 || parameters.meanHairLengthMm <= 0 || parameters.haloWidthR <= 0 ||
      parameters.maxCurvaturePerMm < 0 || parameters.hairAngleDeg < 0 || parameters.hairAngleDeg > 90 ||
      !Number.isSafeInteger(parameters.seed)) throw new RangeError("Invalid fuzz parameter range.");
  if (fuzzStrength === 0) parameters.hairinessIndex = parameters.haloStrength = 0;
  const units = { fuzzStrength: "1", hairinessIndex: "1", meanHairLengthMm: "mm", hairAngleDeg: "deg",
    maxCurvaturePerMm: "1/mm", fiberOpacity: "1", haloStrength: "1", haloWidthR: "core radius", seed: "integer" };
  parameters.provenance = Object.fromEntries(Object.entries(units).map(([key, unit]) => [key, {
    value: parameters[key], unit, confidence: "ASSUMPTION", applicableState: "appearance only",
    source: options[key] !== undefined ? "MANUAL" : key === "fuzzStrength" && sourceMaterial.fuzzStrength !== undefined
      ? "YARN_FUZZ_STRENGTH" : ["hairinessIndex", "haloStrength"].includes(key) ? "DERIVED_FROM_FUZZ_STRENGTH" : "DEFAULT",
    principle: fuzzStrength === 0 && ["hairinessIndex", "haloStrength"].includes(key) ? "f=0 disables generated fuzz"
      : key === "hairinessIndex" && options[key] === undefined ? "16 * fuzzStrength"
        : key === "haloStrength" && options[key] === undefined ? "fuzzStrength" : "T6a appearance parameter",
  }]));
  parameters.classification = "ASSUMPTION";
  return parameters;
}

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function frame(tangent) {
  const reference = Math.abs(tangent[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  const u = normalize(cross(tangent, reference));
  return [u, normalize(cross(tangent, u))];
}

function rotate(vector, axis, angle) {
  const c = Math.cos(angle), s = Math.sin(angle), projection = dot(vector, axis), perpendicular = cross(axis, vector);
  return vector.map((value, k) => c * value + s * perpendicular[k] + (1 - c) * projection * axis[k]);
}

function pointAtArc(centerline, arc) {
  const { arcLengths, points, tangents } = centerline;
  let lo = 0, hi = arcLengths.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (arcLengths[mid] <= arc) lo = mid; else hi = mid;
  }
  const u = (arc - arcLengths[lo]) / (arcLengths[hi] - arcLengths[lo]);
  return { point: points[lo].map((value, k) => value + u * (points[hi][k] - value)),
    tangent: normalize(tangents[lo].map((value, k) => value + u * (tangents[hi][k] - value))) };
}

/** Generate material-space fibers once, independent of face or pixel grid.
 * Return an array of {id,rootArcLengthMm,lengthMm,brightness,points,tangents}.
 * Points are xyz millimeters; tangents are unit vectors along the fiber. A caller
 * may translate all points together when centering a nonperiodic-V yarn strip.
 */
export function generateYarnFibers(centerline, parameters, { fiberDiameterMm }) {
  if (!(Number.isFinite(fiberDiameterMm) && fiberDiameterMm > 0)) throw new RangeError("Positive fiberDiameterMm required.");
  if (!hasGenerated(parameters)) return [];
  const random = randomGenerator(parameters.seed);
  const normalRandom = () => Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, random()))) * Math.cos(2 * Math.PI * random());
  const count = Math.round(parameters.hairinessIndex * centerline.lengthMm / parameters.meanHairLengthMm);
  const fibers = [], step = fiberDiameterMm / 2;
  for (let id = 0; id < count; id++) {
    const rootArcLengthMm = random() * centerline.lengthMm;
    const { point, tangent } = pointAtArc(centerline, rootArcLengthMm), [u, v] = frame(tangent);
    const theta = 2 * Math.PI * random();
    const radial = u.map((value, k) => Math.cos(theta) * value + Math.sin(theta) * v[k]);
    const root = point.map((value, k) => value + centerline.radiusMm * radial[k]);
    const phi = clamp(parameters.hairAngleDeg + 12 * normalRandom(), 5, 80) * Math.PI / 180;
    const sign = random() < 0.5 ? -1 : 1;
    const initial = normalize(tangent.map((value, k) => sign * Math.cos(phi) * value + Math.sin(phi) * radial[k]));
    const lengthMm = Math.exp(Math.log(parameters.meanHairLengthMm) - 0.5 ** 2 / 2 + 0.5 * normalRandom());
    const curvature = parameters.maxCurvaturePerMm * random(), axisAngle = 2 * Math.PI * random();
    const [a, b] = frame(initial), axis = a.map((value, k) => Math.cos(axisAngle) * value + Math.sin(axisAngle) * b[k]);
    const points = [root], tangents = [initial];
    const steps = Math.ceil(lengthMm / step);
    for (let j = 0; j < steps; j++) {
      const from = j * step, distance = Math.min(step, lengthMm - from);
      const direction = rotate(initial, axis, curvature * (from + distance / 2));
      points.push(points.at(-1).map((value, k) => value + distance * direction[k]));
      tangents.push(normalize(rotate(initial, axis, curvature * (from + distance))));
    }
    fibers.push({ id, rootArcLengthMm, lengthMm, brightness: 0.85 + 0.3 * random(), points, tangents });
  }
  return fibers;
}

/** Visit individual lattice images, then pixels. No wrapped-index bulk writes. */
function visitSegmentPixels(a, b, radius, grid, visit) {
  const { width, height, W, H, dx, dy, periodicY } = grid;
  const minX = Math.min(a[0], b[0]) - radius, maxX = Math.max(a[0], b[0]) + radius;
  const minY = Math.min(a[1], b[1]) - radius, maxY = Math.max(a[1], b[1]) + radius;
  const firstP = Math.ceil(-maxX / W), lastP = Math.floor((W - minX) / W);
  const firstQ = periodicY ? Math.ceil(-maxY / H) : 0, lastQ = periodicY ? Math.floor((H - minY) / H) : 0;
  for (let q = firstQ; q <= lastQ; q++) for (let p = firstP; p <= lastP; p++) {
    const ox = p * W, oy = q * H;
    const i0 = Math.max(0, Math.ceil((minX + ox) / dx - 0.5));
    const i1 = Math.min(width - 1, Math.floor((maxX + ox) / dx - 0.5));
    const j0 = Math.max(0, Math.ceil((minY + oy) / dy - 0.5));
    const j1 = Math.min(height - 1, Math.floor((maxY + oy) / dy - 0.5));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      visit((height - 1 - j) * width + i, (i + 0.5) * dx - ox, (j + 0.5) * dy - oy);
    }
  }
}

function closestProjection(a, b, x, y) {
  const ex = b[0] - a[0], ey = b[1] - a[1], length2 = ex * ex + ey * ey;
  const u = length2 > 1e-30 ? clamp(((x - a[0]) * ex + (y - a[1]) * ey) / length2) : Number(b[2] > a[2]);
  const vx = x - a[0] - u * ex, vy = y - a[1] - u * ey;
  return { u, distance: Math.hypot(vx, vy), signedDistance: (vx * ey - vy * ex < 0 ? -1 : 1) * Math.hypot(vx, vy),
    z: a[2] + u * (b[2] - a[2]) };
}

function noiseHash(x, y, seed) {
  let value = Math.imul(x ^ seed, 0x45d9f3b) ^ Math.imul(y, 0x27d4eb2d);
  value = Math.imul(value ^ value >>> 16, 0x45d9f3b);
  return ((value ^ value >>> 16) >>> 0) / 4294967295;
}

function haloNoise(s, transverse, length, fiberDiameter, seed) {
  const cells = Math.max(1, Math.round(length / fiberDiameter));
  const wrap = index => ((index % cells) + cells) % cells;
  const u = ((s / length % 1) + 1) % 1 * cells, v = transverse / 4;
  const x = Math.floor(u), y = Math.floor(v), smooth = t => t * t * (3 - 2 * t);
  const fx = smooth(u - x), fy = smooth(v - y);
  const a = noiseHash(wrap(x), y, seed) * (1 - fx) + noiseHash(wrap(x + 1), y, seed) * fx;
  const b = noiseHash(wrap(x), y + 1, seed) * (1 - fx) + noiseHash(wrap(x + 1), y + 1, seed) * fx;
  return a * (1 - fy) + b * fy;
}

/** Bake scans, fibers and halo into at most eight visible fragments per pixel.
 * Fragments carry {z,alpha,color,normal,roughness,metallic,kind}; colors/scalars
 * are unpremultiplied 0..1. Fiber closest-point selection is across the entire
 * polyline and every periodic image, giving at most one fragment per fiber.
 */
export function bakeYarnFuzz(centerline, geometry, material,
  { parameters, fibers, fiberDiameterMm, periodicY = geometry.periodicY ?? true }) {
  if (!(Number.isFinite(fiberDiameterMm) && fiberDiameterMm > 0)) throw new RangeError("Positive fiberDiameterMm required.");
  const count = geometry.width * geometry.height, fragments = new Array(count);
  const generated = hasGenerated(parameters), scan = ["scan", "both"].includes(parameters.fuzzSource);
  if (scan && !material.diagnostics.hasAlpha) throw new RangeError("Scanning fuzz requires baseColor alpha.");
  fibers ??= generateYarnFibers(centerline, parameters, { fiberDiameterMm });
  const haloEnabled = generated && parameters.haloStrength > 0;
  const diagnostics = { fiberCount: generated ? fibers.length : 0, fiberDiameterMm, fuzzPixelCount: 0,
    fuzzPixelFraction: 0, scanPixelCount: 0, haloPixelCount: 0, haloEnabled };
  if (parameters.fuzzSource === "off") return { fragments, diagnostics };
  const grid = { ...geometry, periodicY }, sign = geometry.face === "technicalFace" ? -1 : 1;
  const transform = point => [sign * point[0], point[1], sign * point[2]];
  const radius = centerline.radiusMm;
  const add = (index, fragment) => {
    if (fragment.alpha <= 0 || (geometry.coverage[index] && fragment.z <= geometry.heights[index])) return;
    const list = fragments[index] ??= [];
    list.push(fragment);
    list.sort((a, b) => b.z - a.z);
    if (list.length > 8) list.length = 8;
  };
  const keepHighest = (target, index, candidate, distance) => {
    const old = target[index];
    if (!old || candidate.z > old.z || (candidate.z === old.z && distance < old.distance)) target[index] = { ...candidate, distance };
  };
  if (scan || haloEnabled) {
    const scanLayer = new Array(count), haloLayer = new Array(count);
    const scanRadius = scan ? material.rho * radius : 0;
    const haloRadius = haloEnabled ? radius * (1 + 4 * parameters.haloWidthR) : 0;
    const points = centerline.points.map(transform);
    for (let segment = 0; segment < points.length - 1; segment++) {
      const a = points[segment], b = points[segment + 1];
      const arc = centerline.arcLengths[segment], arcLength = centerline.arcLengths[segment + 1] - arc;
      visitSegmentPixels(a, b, Math.max(scanRadius, haloRadius), grid, (index, x, y) => {
        const closest = closestProjection(a, b, x, y), distance = closest.distance;
        if (distance <= radius || (geometry.coverage[index] && closest.z <= geometry.heights[index])) return;
        const s = arc + closest.u * arcLength, w = closest.signedDistance / radius;
        if (scan && distance <= scanRadius) {
          const sample = sampleYarnFuzzMaterial(material, s, w);
          if (sample.alpha >= 1 / 255) keepHighest(scanLayer, index,
            { ...sample, z: closest.z, normal: [0, 0, 1], kind: "scan" }, distance);
        }
        if (haloEnabled && distance < haloRadius) {
          const alpha = parameters.haloStrength * Math.exp(-(distance - radius) / (parameters.haloWidthR * radius)) *
            (0.4 + 0.6 * haloNoise(s, w, centerline.lengthMm, fiberDiameterMm, parameters.seed));
          keepHighest(haloLayer, index, { z: closest.z, alpha, normal: [0, 0, 1], color: material.averageColor,
            roughness: material.averageRoughness, metallic: material.averageMetallic, kind: "halo" }, distance);
        }
      });
    }
    for (let i = 0; i < count; i++) {
      if (scanLayer[i]) { add(i, scanLayer[i]); diagnostics.scanPixelCount++; }
      if (haloLayer[i]) { add(i, haloLayer[i]); diagnostics.haloPixelCount++; }
    }
  }
  if (generated) for (const fiber of fibers) {
    const closestPixels = new Map(), points = fiber.points.map(transform), rf = fiberDiameterMm / 2;
    const color = material.averageColor.map(value => value * (fiber.brightness ?? 1));
    for (let segment = 0; segment < points.length - 1; segment++) {
      const a = points[segment], b = points[segment + 1], direction = normalize(b.map((value, k) => value - a[k]));
      const t0 = fiber.tangents ? transform(fiber.tangents[segment]) : direction;
      const t1 = fiber.tangents ? transform(fiber.tangents[segment + 1]) : direction;
      visitSegmentPixels(a, b, 3 * rf, grid, (index, x, y) => {
        const closest = closestProjection(a, b, x, y);
        if (closest.distance > 3 * rf) return;
        const old = closestPixels.get(index);
        if (old && (old.distance < closest.distance || (old.distance === closest.distance && old.z >= closest.z))) return;
        const tangent = normalize(t0.map((value, k) => value + closest.u * (t1[k] - value)));
        const projectedNormal = [-tangent[2] * tangent[0], -tangent[2] * tangent[1], 1 - tangent[2] ** 2];
        closestPixels.set(index, { ...closest, normal: Math.hypot(...projectedNormal) < 1e-6 ? [0, 0, 1] : normalize(projectedNormal) });
      });
    }
    for (const [index, closest] of closestPixels) add(index, { z: closest.z,
      alpha: parameters.fiberOpacity * Math.exp(-0.5 * (closest.distance / (0.8 * rf)) ** 2),
      color, normal: closest.normal, roughness: material.averageRoughness, metallic: material.averageMetallic, kind: "fiber" });
  }
  for (const list of fragments) if (list?.length) diagnostics.fuzzPixelCount++;
  diagnostics.fuzzPixelFraction = diagnostics.fuzzPixelCount / count;
  return { fragments, diagnostics };
}
