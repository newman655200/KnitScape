import { solveFabricCell } from "../fabricForm/solveFabricCell.js";
import { createPlainJerseyTopology } from "../fabricForm/fabricFormTopology.js";
import { createFabricFormParams } from "../fabricForm/fabricFormParams.js";
import { buildCenterline } from "./centerline.js";
import { bakeGeometry } from "./bakeGeometry.js";
import { computeAmbientOcclusion } from "./ambientOcclusion.js";
import { normalizeYarnMaterial } from "./yarnMaterial.js";
import { composeMaps } from "./composeMaps.js";
import { encodePng } from "./png.js";
import { createTextureMetadata } from "./metadata.js";

/** Solve the documented shorthand, or pass a golden fixture's input through unchanged. */
export function solveTextureInput(input) {
  if (input.input) return solveFabricCell(input.input);
  const { loopLengthMm = 2.84, nodesPerLoop = 48, params = {} } = input;
  return solveFabricCell({ topology: createPlainJerseyTopology({ m: 1, n: 1, loopLengthMm, nodesPerLoop }),
    params: createFabricFormParams(params) });
}

/** Read-only geometry stage. Suitable for a future Worker; never changes the solver cell. */
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

/** Shared Node/browser composition and encoding. T6a-1 only supports fuzzSource=off.
 * Return Uint8Array files, separate JSON metadata and unquantized geometry/maps.
 * repeat counts copy the single cell; they never alter physical geometry or material UV.
 */
export async function bakeFabricTexture({ result, solveInput, geometry, material: sourceMaterial = {},
  pxPerMm = 400, repeat = [1, 1], prefix = "fabric", fuzzSource = "off",
  generatorVersion = "app", generatedAt = new Date().toISOString(), sourceResultFile = null }) {
  if (fuzzSource !== "off") throw new RangeError("T6a-1 supports fuzzSource=off only.");
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
  const material = normalizeYarnMaterial(sourceMaterial, { diameterMm: result.params.d_e, lengthMm: geometry.centerline.lengthMm });
  timings.materialMs = performance.now() - materialStart;
  const files = {}, composed = {};
  for (const face of ["technicalFace", "technicalBack"]) {
    const start = performance.now();
    composed[face] = composeMaps(geometry.faces[face], material, geometry.ao[face], { repeat });
    timings[`${face}ComposeMs`] = performance.now() - start;
    const encodeStart = performance.now();
    for (const [name, map] of Object.entries(composed[face].maps)) files[`${prefix}_${face}_${name}.png`] = await encodePng(map);
    timings[`${face}EncodeMs`] = performance.now() - encodeStart;
  }
  const metadata = createTextureMetadata({ result, geometry, composed, material, sourceMaterial, repeat,
    generatorVersion, generatedAt, sourceResultFile });
  return { files, metadata, result, geometry, composed, material, timings };
}
