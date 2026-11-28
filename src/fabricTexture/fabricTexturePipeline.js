import { solveFabricCell } from "../fabricForm/solveFabricCell.js";
import { createPlainJerseyTopology } from "../fabricForm/fabricFormTopology.js";
import { createFabricFormParams } from "../fabricForm/fabricFormParams.js";
import { buildCenterline, createStraightYarnCenterline } from "./centerline.js";
import { bakeGeometry } from "./bakeGeometry.js";
import { computeAmbientOcclusion } from "./ambientOcclusion.js";
import { normalizeYarnMaterial } from "./yarnMaterial.js";
import { composeMaps } from "./composeMaps.js";
import { encodePng } from "./png.js";
import { createTextureMetadata, createYarnStripMetadata } from "./metadata.js";
import { normalizeFuzzParameters, generateYarnFibers, bakeYarnFuzz } from "./yarnFuzz.js";

/** Solve the documented shorthand, or pass a golden fixture's input through unchanged. */
export function solveTextureInput(input) {
  if (input.input) return solveFabricCell(input.input);
  const { loopLengthMm = 2.84, nodesPerLoop = 48, params = {} } = input;
  return solveFabricCell({ topology: createPlainJerseyTopology({ m: 1, n: 1, loopLengthMm, nodesPerLoop }),
    params: createFabricFormParams(params) });
}

/** Shared Worker/Node entry: solve once, then bake both faces and their AO. */
export function solveFabricTextureGeometry(solveInput, { pxPerMm = 200, onStage } = {}) {
  onStage?.("solve");
  const started = performance.now(), result = solveTextureInput(solveInput);
  const solveMs = performance.now() - started;
  onStage?.("geometry");
  const geometry = bakeFabricGeometry(result, { pxPerMm });
  return { result, geometry, timings: { solveMs, ...geometry.timings } };
}

/** Read-only geometry stage; never changes the solver cell. */
export function bakeFabricGeometry(result, { pxPerMm = 400 } = {}) {
  if (!result?.cell || !result.params || !result.metrics) throw new TypeError("A complete fabric-form result is required.");
  if (!Number.isFinite(pxPerMm) || pxPerMm <= 0) throw new RangeError("pxPerMm must be positive and finite.");
  const started = performance.now(), centerline = buildCenterline(result.cell, result.params.d_e);
  const timings = { centerlineMs: performance.now() - started }, faces = {}, ao = {};
  for (const face of ["technicalFace", "technicalBack"]) {
    const start = performance.now();
    faces[face] = bakeGeometry(centerline, { face, pxPerMm });
    timings[`${face}GeometryMs`] = performance.now() - start;
    const aoStart = performance.now();
    ao[face] = computeAmbientOcclusion(faces[face], result.params.d_e);
    timings[`${face}AoMs`] = performance.now() - aoStart;
  }
  return { centerline, faces, ao, timings };
}

/** Shared Node/browser composition and encoding, including the yarn's own fuzz.
 * Return Uint8Array files, separate JSON metadata and unquantized geometry/maps.
 * repeat counts copy the single cell; they never alter physical geometry or material UV.
 */
export async function bakeFabricTexture({ result, solveInput, geometry, material: sourceMaterial = {},
  pxPerMm = 400, repeat = [1, 1], prefix = "fabric", fuzzSource, fuzzOptions = {},
  generatorVersion = "app", generatedAt = new Date().toISOString(), sourceResultFile = null, repositoryRoot }) {
  if (!Array.isArray(repeat) || repeat.length !== 2 || repeat.some(n => !Number.isSafeInteger(n) || n < 1)) {
    throw new RangeError("repeat must contain two positive integer counts.");
  }
  if (!/^[\w.-]+$/.test(prefix) || prefix === "." || prefix === "..") throw new RangeError("Invalid filename prefix.");
  if (!!result === !!solveInput) throw new TypeError("Provide exactly one of result and solveInput.");
  const timings = {};
  if (solveInput) {
    const start = performance.now(); result = solveTextureInput(solveInput); timings.solveMs = performance.now() - start;
  }
  geometry ??= bakeFabricGeometry(result, { pxPerMm });
  Object.assign(timings, geometry.timings);
  const materialStart = performance.now();
  const material = normalizeYarnMaterial(sourceMaterial, { diameterMm: result.params.d_e, lengthMm: geometry.centerline.lengthMm, pxPerMm });
  timings.materialMs = performance.now() - materialStart;
  const fuzzParameters = normalizeFuzzParameters(sourceMaterial, { ...fuzzOptions, fuzzSource });
  const fiberStart = performance.now();
  const fibers = generateYarnFibers(geometry.centerline, fuzzParameters, { fiberDiameterMm: result.params.fiberDiameterMm });
  timings.fibersMs = performance.now() - fiberStart;
  const files = {}, composed = {}, fuzz = {};
  for (const face of ["technicalFace", "technicalBack"]) {
    const fuzzStart = performance.now();
    fuzz[face] = bakeYarnFuzz(geometry.centerline, geometry.faces[face], material,
      { parameters: fuzzParameters, fibers, fiberDiameterMm: result.params.fiberDiameterMm });
    timings[`${face}FuzzMs`] = performance.now() - fuzzStart;
    const start = performance.now();
    composed[face] = composeMaps(geometry.faces[face], material, geometry.ao[face], { repeat, fuzz: fuzz[face] });
    Object.assign(fuzz[face].diagnostics, composed[face].diagnostics.fuzz);
    timings[`${face}ComposeMs`] = performance.now() - start;
    const encodeStart = performance.now();
    for (const [name, map] of Object.entries(composed[face].maps)) files[`${prefix}_${face}_${name}.png`] = await encodePng(map);
    timings[`${face}EncodeMs`] = performance.now() - encodeStart;
  }
  const metadata = createTextureMetadata({ result, geometry, composed, material, sourceMaterial, repeat,
    generatorVersion, generatedAt, sourceResultFile, fuzzParameters, fuzz, repositoryRoot });
  return { files, metadata, result, geometry, composed, material, fuzz, fibers, fuzzParameters, timings };
}

/** Straight yarn with the same material/fuzz/composition path as fabric.
 * U is periodic over stripLengthMm; V is not periodic. Optional centerline is a
 * straight +x curve of this length/radius, allowing a translated periodic input.
 * Export baseColor is RGBA, height is 8-bit; composed retains the common maps.
 */
export async function bakeYarnStrip({ params: suppliedParams = {}, material: sourceMaterial = {},
  pxPerMm = 400, stripLengthMm = 4, prefix = "fabric", fuzzSource, fuzzOptions = {}, centerline: suppliedCenterline,
  generatorVersion = "app", generatedAt = new Date().toISOString(), repositoryRoot } = {}) {
  if (![pxPerMm, stripLengthMm].every(value => Number.isFinite(value) && value > 0)) throw new RangeError("Strip length and resolution must be positive.");
  if (!/^[\w.-]+$/.test(prefix) || prefix === "." || prefix === "..") throw new RangeError("Invalid filename prefix.");
  const params = suppliedParams.d_e && suppliedParams.provenance ? suppliedParams : createFabricFormParams(suppliedParams);
  const timings = {}, materialStart = performance.now();
  const material = normalizeYarnMaterial(sourceMaterial, { diameterMm: params.d_e, lengthMm: stripLengthMm, pxPerMm });
  const fuzzParameters = normalizeFuzzParameters(sourceMaterial, { ...fuzzOptions, fuzzSource });
  timings.materialMs = performance.now() - materialStart;
  const fields = bakeYarnStripFields({ params, material, fuzzParameters, pxPerMm, stripLengthMm, centerline: suppliedCenterline });
  Object.assign(timings, fields.timings);
  const { geometry, composed, fuzz, maps, contentHeightMm } = fields;
  const encodeStart = performance.now(), files = {};
  for (const [name, map] of Object.entries(maps)) files[`${prefix}_yarn_${name}.png`] = await encodePng(map);
  timings.encodeMs = performance.now() - encodeStart;
  const metadata = createYarnStripMetadata({ params, geometry, composed, material, sourceMaterial, fuzzParameters, fuzz,
    stripLengthMm, contentHeightMm, generatorVersion, generatedAt, repositoryRoot });
  return { ...fields, files, metadata, params, material, fuzzParameters, timings };
}

/** Shared straight-yarn calculation for an already prepared material. This keeps
 * material preparation separate from geometry/composition without a second path.
 * The export pipeline above always prepares at its own output resolution.
 */
export function bakeYarnStripFields({ params, material, fuzzParameters, pxPerMm = 400,
  stripLengthMm = 4, centerline: suppliedCenterline }) {
  const timings = {};
  const initial = suppliedCenterline ?? createStraightYarnCenterline({ lengthMm: stripLengthMm, diameterMm: params.d_e });
  const axisY = initial.points[0][1], axisZ = initial.points[0][2];
  if (initial.lengthMm !== stripLengthMm || initial.radiusMm !== params.d_e / 2 ||
      initial.points.some(point => point[1] !== axisY || point[2] !== axisZ) ||
      initial.tangents.some(tangent => tangent[0] !== 1 || tangent[1] !== 0 || tangent[2] !== 0)) {
    throw new RangeError("A strip centerline must be a straight +x yarn with the requested length and radius.");
  }
  const fiberStart = performance.now();
  const initialFibers = generateYarnFibers(initial, fuzzParameters, { fiberDiameterMm: params.fiberDiameterMm });
  timings.fibersMs = performance.now() - fiberStart;
  const scan = ["scan", "both"].includes(fuzzParameters.fuzzSource);
  const generated = ["generated", "both"].includes(fuzzParameters.fuzzSource);
  let extent = Math.max(scan ? material.rho * initial.radiusMm : 0,
    generated && fuzzParameters.haloStrength > 0 ? initial.radiusMm * (1 + 4 * fuzzParameters.haloWidthR) : 0);
  for (const fiber of initialFibers) for (const point of fiber.points) {
    extent = Math.max(extent, Math.abs(point[1] - axisY) + 3 * params.fiberDiameterMm / 2);
  }
  const contentHeightMm = params.d_e + 2 * extent + 2 / pxPerMm, heightMm = 3 * contentHeightMm;
  const shiftPoint = point => [point[0], point[1] - axisY + heightMm / 2, point[2] - axisZ];
  const centerline = { ...initial, H: heightMm, S: 0, nodes: initial.nodes.map(shiftPoint), points: initial.points.map(shiftPoint) };
  const fibers = initialFibers.map(fiber => ({ ...fiber, points: fiber.points.map(shiftPoint) }));
  const geometryStart = performance.now();
  const geometry = bakeGeometry(centerline, { face: "technicalBack", pxPerMm, periodicY: false });
  timings.geometryMs = performance.now() - geometryStart;
  const aoStart = performance.now(), ao = computeAmbientOcclusion(geometry, params.d_e);
  timings.aoMs = performance.now() - aoStart;
  const fuzzStart = performance.now();
  const fuzz = bakeYarnFuzz(centerline, geometry, material, { parameters: fuzzParameters, fibers,
    fiberDiameterMm: params.fiberDiameterMm, periodicY: false });
  timings.fuzzMs = performance.now() - fuzzStart;
  const composeStart = performance.now(), composed = composeMaps(geometry, material, ao, { fuzz });
  Object.assign(fuzz.diagnostics, composed.diagnostics.fuzz);
  timings.composeMs = performance.now() - composeStart;
  const count = geometry.width * geometry.height, rgba = new Uint8Array(4 * count), height = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    rgba.set(composed.unitMaps.baseColor.data.subarray(3 * i, 3 * i + 3), 4 * i);
    rgba[4 * i + 3] = composed.unitMaps.opacity.data[i];
    height[i] = Math.round(composed.unitMaps.height.data[i] * 255 / 65535);
  }
  const { opacity: _opacity, ...maps } = composed.unitMaps;
  maps.baseColor = { width: geometry.width, height: geometry.height, channels: 4, bitDepth: 8, data: rgba };
  maps.height = { width: geometry.width, height: geometry.height, channels: 1, bitDepth: 8, data: height };
  return { centerline, geometry, composed, fuzz, fibers, timings, maps, contentHeightMm };
}
