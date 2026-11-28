import { sampleYarnMaterial } from "./yarnMaterial.js";

const clamp01 = value => Math.max(0, Math.min(1, value));
const byte = value => Math.round(clamp01(value) * 255);

export const VISIBLE_NORMAL_Z_FLOOR = 2 / 255;

/** Constrain a final unit normal for visible-height-field output without mutating it. */
export function constrainVisibleHemisphere(normal) {
  if (normal[2] >= VISIBLE_NORMAL_Z_FLOOR) return normal;
  const horizontalLength = Math.hypot(normal[0], normal[1]);
  if (horizontalLength < 1e-12) return [0, 0, 1];
  const horizontalRadius = Math.sqrt(1 - VISIBLE_NORMAL_Z_FLOOR ** 2);
  return [horizontalRadius * normal[0] / horizontalLength,
    horizontalRadius * normal[1] / horizontalLength, VISIBLE_NORMAL_Z_FLOOR];
}

function normalize(vector, fallback = [0, 0, 1]) {
  const length = Math.hypot(...vector);
  return length > 1e-15 ? vector.map(value => value / length) : fallback.slice();
}

function shadeNormal(geometry, index, detail) {
  const offset = index * 3;
  const N = Array.from(geometry.normals.subarray(offset, offset + 3));
  const T = Array.from(geometry.tangents.subarray(offset, offset + 3));
  const b = normalize([T[1], -T[0], 0], [1, 0, 0]);
  const dotN = b[0] * N[0] + b[1] * N[1] + b[2] * N[2];
  const dotT = b[0] * T[0] + b[1] * T[1] + b[2] * T[2];
  const fallback = [T[1] * N[2] - T[2] * N[1], T[2] * N[0] - T[0] * N[2], T[0] * N[1] - T[1] * N[0]];
  const Bw = normalize(b.map((component, c) => component - dotN * N[c] - dotT * T[c]), normalize(fallback));
  // Image-up is -Bw. Preserve this intermediate shading normal even if a
  // strong detail rotates it below the image plane; constrain only final output.
  return normalize(N.map((component, c) => detail[0] * T[c] - detail[1] * Bw[c] + detail[2] * component));
}

function map(width, height, channels, bitDepth = 8) {
  return { width, height, channels, bitDepth, data: bitDepth === 16 ? new Uint16Array(width * height * channels) : new Uint8Array(width * height * channels) };
}

function tile(source, repeat) {
  if (repeat[0] === 1 && repeat[1] === 1) return source;
  const result = map(source.width * repeat[0], source.height * repeat[1], source.channels, source.bitDepth);
  const rowLength = source.width * source.channels;
  for (let y = 0; y < result.height; y++) {
    const row = source.data.subarray((y % source.height) * rowLength, (y % source.height + 1) * rowLength);
    for (let x = 0; x < repeat[0]; x++) result.data.set(row, y * result.width * result.channels + x * rowLength);
  }
  return result;
}

/**
 * Compose core maps and optional visible fuzz fragments from prepared material.
 * ao is the geometric AO Float64Array for one cell. Output maps may be tiled;
 * fields retain unquantized one-cell shading normals, output normals and AO.
 * Heights are millimeters and empty pixels never participate in their range.
 */
export function composeMaps(geometry, material, ao, { repeat = [1, 1], fuzz } = {}) {
  if (!Array.isArray(repeat) || repeat.length !== 2 || !repeat.every(value => Number.isSafeInteger(value) && value > 0)) {
    throw new RangeError("repeat must be two positive integers");
  }
  const { width, height, coverage, heights } = geometry, count = width * height;
  if (ao !== undefined && ao.length !== count) throw new RangeError("Geometric AO size does not match geometry");
  if (fuzz && fuzz.fragments.length !== count) throw new RangeError("Fuzz size does not match geometry");
  let heightMinMm = Infinity, heightMaxMm = -Infinity;
  for (let i = 0; i < count; i++) if (coverage[i]) {
    heightMinMm = Math.min(heightMinMm, heights[i]);
    heightMaxMm = Math.max(heightMaxMm, heights[i]);
  }
  if (!Number.isFinite(heightMinMm)) heightMinMm = heightMaxMm = 0;
  const range = heightMaxMm - heightMinMm;
  const maps = {
    baseColor: map(width, height, 3), opacity: map(width, height, 1), normal: map(width, height, 3),
    height: map(width, height, 1, 16), ambientOcclusion: map(width, height, 1), roughness: map(width, height, 1),
  };
  if (material.hasMetallic) maps.metallic = map(width, height, 1);
  const fields = { normals: new Float64Array(3 * count), outputNormals: new Float64Array(3 * count),
    ambientOcclusion: new Float64Array(count) };
  let corePixelCount = 0, fuzzPixelCount = 0;
  const constrainedAnglesDeg = [];
  maps.roughness.data.fill(255);
  for (let i = 0; i < count; i++) {
    // Reject occluded fragments even for caller-supplied fuzz; the top eight
    // are composited back-to-front. The input fragment lists are never mutated.
    const layers = fuzz?.fragments[i]?.filter(fragment => fragment.alpha > 0 && (!coverage[i] || fragment.z > heights[i]))
      .sort((a, b) => b.z - a.z).slice(0, 8) ?? [];
    if (!coverage[i] && layers.length === 0) {
      maps.normal.data.set([128, 128, 255], 3 * i);
      fields.normals[3 * i + 2] = 1;
      fields.outputNormals[3 * i + 2] = 1;
      continue;
    }
    let color = [0, 0, 0], normal = [0, 0, 0], opacity = 0, ambientOcclusion = 0, roughness = 0, metallic = 0;
    if (coverage[i]) {
      corePixelCount++;
      const sample = sampleYarnMaterial(material, geometry.arcLengths[i], geometry.transverse[i]);
      color = sample.color;
      normal = shadeNormal(geometry, i, sample.normalDetail);
      ambientOcclusion = (ao === undefined ? 1 : ao[i]) * sample.ambientOcclusion;
      roughness = sample.roughness;
      metallic = sample.metallic;
      opacity = 1;
      // Only the core contributes to height, independently of overlaid fuzz.
      maps.height.data[i] = range > 0 ? Math.round(clamp01((heights[i] - heightMinMm) / range) * 65535) : 0;
    }
    if (layers.length) {
      fuzzPixelCount++;
      // These accumulators carry premultiplied channels while layering. Normal
      // is normalized once after all alpha-weighted vectors have been combined.
      for (let j = layers.length - 1; j >= 0; j--) {
        const layer = layers[j], alpha = clamp01(layer.alpha), remaining = 1 - alpha;
        color = color.map((value, c) => alpha * layer.color[c] + remaining * value);
        normal = normal.map((value, c) => alpha * layer.normal[c] + remaining * value);
        roughness = alpha * layer.roughness + remaining * roughness;
        metallic = alpha * layer.metallic + remaining * metallic;
        ambientOcclusion = alpha + remaining * ambientOcclusion;
        opacity = alpha + remaining * opacity;
      }
      color = color.map(value => value / opacity);
      roughness /= opacity;
      metallic /= opacity;
      ambientOcclusion /= opacity;
      normal = normalize(normal);
    }
    const outputNormal = constrainVisibleHemisphere(normal);
    if (normal[2] < VISIBLE_NORMAL_Z_FLOOR) {
      const dot = normal[0] * outputNormal[0] + normal[1] * outputNormal[1] + normal[2] * outputNormal[2];
      constrainedAnglesDeg.push(Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI);
    }
    fields.normals.set(normal, 3 * i);
    fields.outputNormals.set(outputNormal, 3 * i);
    fields.ambientOcclusion[i] = ambientOcclusion;
    for (let c = 0; c < 3; c++) {
      maps.baseColor.data[3 * i + c] = byte(color[c]);
      maps.normal.data[3 * i + c] = byte(0.5 * outputNormal[c] + 0.5);
    }
    maps.opacity.data[i] = byte(opacity);
    maps.ambientOcclusion.data[i] = byte(ambientOcclusion);
    maps.roughness.data[i] = byte(roughness);
    if (maps.metallic) maps.metallic.data[i] = byte(metallic);
  }
  constrainedAnglesDeg.sort((a, b) => a - b);
  const constrainedPixelCount = constrainedAnglesDeg.length;
  const middle = Math.floor(constrainedPixelCount / 2);
  const visibleHemisphere = {
    constrainedPixelCount,
    corePixelCount,
    constrainedCoreFraction: corePixelCount ? constrainedPixelCount / corePixelCount : 0,
    maxAngleDeg: constrainedPixelCount ? constrainedAnglesDeg[constrainedPixelCount - 1] : 0,
    medianAngleDeg: constrainedPixelCount ? (constrainedPixelCount % 2
      ? constrainedAnglesDeg[middle] : (constrainedAnglesDeg[middle - 1] + constrainedAnglesDeg[middle]) / 2) : 0,
  };
  return { maps: Object.fromEntries(Object.entries(maps).map(([key, value]) => [key, tile(value, repeat)])),
    unitMaps: maps, heightMinMm, heightMaxMm, fields,
    diagnostics: { visibleHemisphere, fuzz: { fuzzPixelCount, fuzzPixelFraction: fuzzPixelCount / count } } };
}
