import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createFabricFormParams } from "../../src/fabricForm/fabricFormParams.js";
import { buildCenterline } from "../../src/fabricTexture/centerline.js";
import { bakeGeometry } from "../../src/fabricTexture/bakeGeometry.js";
import { computeAmbientOcclusion } from "../../src/fabricTexture/ambientOcclusion.js";
import { normalizeYarnMaterial } from "../../src/fabricTexture/yarnMaterial.js";
import { normalizeFuzzParameters, bakeYarnFuzz } from "../../src/fabricTexture/yarnFuzz.js";
import { composeMaps } from "../../src/fabricTexture/composeMaps.js";
import { bakeYarnStrip } from "../../src/fabricTexture/fabricTexturePipeline.js";
import { decodePng } from "./fabric-texture-png.mjs";
import { assertNormalMap, assertNormalPng } from "./fabric-texture-normal-checks.mjs";
import { loadTextureMaterial } from "./fabric-texture-material-input.mjs";

const wrap = (index, size) => ((index % size) + size) % size;
const report = (item, values) => console.log(JSON.stringify({ item, status: "PASS", ...values }));
const fixtureUrl = name => new URL(`../../docs/archive/t1-slope-closeout-2026-11-23/${name}.json`, import.meta.url);
const reviewUrl = name => new URL(`../../docs/archive/t6a-fabric-texture-2026-11-28/${name}`, import.meta.url);

/** Frozen pre-T6a-3 horizontal-horizon AO, used only as the (t) test reference.
 * Keep its arithmetic and nearest-pixel sampling identical to T6a-2. There is
 * no legacy AO implementation or selectable legacy path in production code.
 */
export function computeLegacyAmbientOcclusion(geometry, diameterMm) {
  const { width, height, dx, dy, heights, coverage, heightMinMm } = geometry;
  const ao = new Float64Array(width * height);
  const step = Math.min(dx, dy), reach = 2 * diameterMm;
  const background = heightMinMm - diameterMm;
  const rays = Array.from({ length: 16 }, (_, direction) => {
    const angle = 2 * Math.PI * direction / 16;
    const samples = [];
    let previousX = 0, previousY = 0;
    for (let distance = step; distance <= reach; distance += step) {
      const ox = Math.round(distance * Math.cos(angle) / dx);
      const oy = -Math.round(distance * Math.sin(angle) / dy);
      if ((ox === 0 && oy === 0) || (ox === previousX && oy === previousY)) continue;
      previousX = ox;
      previousY = oy;
      samples.push([ox, oy, Math.hypot(ox * dx, oy * dy)]);
    }
    return samples;
  });
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const origin = row * width + column;
      if (!coverage[origin]) continue;
      let occlusion = 0;
      for (const ray of rays) {
        let maxSlope = 0;
        for (const [ox, oy, distance] of ray) {
          const inVerticalRange = geometry.periodicY !== false || (row + oy >= 0 && row + oy < height);
          const neighbor = wrap(row + oy, height) * width + wrap(column + ox, width);
          const z = inVerticalRange && coverage[neighbor] ? heights[neighbor] : background;
          maxSlope = Math.max(maxSlope, (z - heights[origin]) / distance);
        }
        occlusion += maxSlope / Math.hypot(1, maxSlope);
      }
      ao[origin] = 1 - occlusion / 16;
    }
  }
  return ao;
}

function checkComposedNormals(composed, label) {
  return { unit: assertNormalMap(composed.unitMaps.normal, `(g) ${label} unit`),
    tiled: assertNormalMap(composed.maps.normal, `(g) ${label} tiled`) };
}

function checkStripNormals(strip, prefix, label) {
  return { ...checkComposedNormals(strip.composed, label),
    exported: assertNormalMap(strip.maps.normal, `(g) ${label} export`),
    png: assertNormalPng(strip.files[`${prefix}_yarn_normal.png`], `(g) ${label} PNG`) };
}

/** Fixed (u) limits: every 8-bit channel differs by at most one; pixels with
 * any differing channel occupy at most 0.1%, both per map and across all maps.
 */
export function compareEightBitMaps(original, changed, label) {
  const names = Object.keys(original).filter(name => original[name].bitDepth === 8);
  assert.deepEqual(Object.keys(changed).filter(name => changed[name].bitDepth === 8).sort(), [...names].sort(),
    `${label}: same 8-bit map set`);
  assert.ok(names.length > 0, `${label}: at least one 8-bit map`);
  const first = original[names[0]], pixelCount = first.width * first.height;
  const differingUnion = new Uint8Array(pixelCount), maps = {};
  for (const name of names) {
    const a = original[name], b = changed[name];
    assert.equal(a.width, first.width, `${label} ${name}: consistent width`);
    assert.equal(a.height, first.height, `${label} ${name}: consistent height`);
    for (const key of ["width", "height", "channels", "bitDepth"]) assert.equal(b[key], a[key], `${label} ${name}: ${key}`);
    assert.equal(a.data.length, pixelCount * a.channels, `${label} ${name}: original byte count`);
    assert.equal(b.data.length, a.data.length, `${label} ${name}: changed byte count`);
    let maxDifference = 0, differingPixels = 0, firstExcess = null;
    for (let pixel = 0; pixel < pixelCount; pixel++) {
      let differs = false;
      for (let channel = 0; channel < a.channels; channel++) {
        const offset = pixel * a.channels + channel;
        const delta = Math.abs(a.data[offset] - b.data[offset]);
        maxDifference = Math.max(maxDifference, delta);
        if (delta > 1 && !firstExcess) firstExcess = { pixel, channel, original: a.data[offset], changed: b.data[offset] };
        differs ||= delta !== 0;
      }
      if (differs) { differingPixels++; differingUnion[pixel] = 1; }
    }
    const differingFraction = differingPixels / pixelCount;
    assert.ok(maxDifference <= 1,
      `${label} ${name}: max byte difference=${maxDifference}, limit=1; first excess=${JSON.stringify(firstExcess)}`);
    assert.ok(differingFraction <= 0.001,
      `${label} ${name}: differing pixels=${differingPixels}/${pixelCount}, limit=0.1%`);
    maps[name] = { maxDifference, differingPixels, differingFraction };
  }
  const differingPixels = differingUnion.reduce((sum, value) => sum + value, 0);
  const differingFraction = differingPixels / pixelCount;
  assert.ok(differingFraction <= 0.001,
    `${label}: pixels differing in any 8-bit map=${differingPixels}/${pixelCount}, limit=0.1%`);
  return { maps, pixelCount, differingPixels, differingFraction };
}

function syntheticBlock() {
  const width = 96, height = 80, count = width * height;
  const heights = new Float64Array(count), normals = new Float64Array(3 * count);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    heights[i] = x >= 32 && x < 64 && y >= 24 && y < 56 ? 0.1 : 0;
    normals[3 * i + 2] = 1;
  }
  return { width, height, dx: 0.005, dy: 0.005, heights, normals,
    coverage: new Uint8Array(count).fill(1), heightMinMm: 0, periodicY: true };
}

/** The exact RGBA bands from (o): 1 x 10000, constant along U, no prefilter.
 * This new check deliberately leaves the accepted (o)-(s) helper untouched.
 */
function syntheticScanSource() {
  const data = new Uint8Array(10000 * 4);
  for (let y = 0; y < 10000; y++) data.set(y >= 4000 && y < 6000 ? [255, 255, 255, 255]
    : y >= 2000 && y < 8000 ? [128, 128, 128, 102] : [0, 0, 0, 0], 4 * y);
  return { baseColor: { width: 1, height: 10000, channels: 4, data }, fuzzBand: "fullScan" };
}

/** AO diagnostics only: no threshold on the six fabric means. */
export function compareCoreAo(geometry, diameterMm) {
  const current = computeAmbientOcclusion(geometry, diameterMm);
  const previous = computeLegacyAmbientOcclusion(geometry, diameterMm);
  let oldSum = 0, newSum = 0, corePixelCount = 0;
  for (let i = 0; i < geometry.coverage.length; i++) if (geometry.coverage[i]) {
    corePixelCount++; oldSum += previous[i]; newSum += current[i];
  }
  assert.ok(corePixelCount > 0, "(t) fabric AO comparison contains core pixels");
  return { corePixelCount, oldMean: oldSum / corePixelCount, newMean: newSum / corePixelCount };
}

function renderScanPassages(cell, params, source) {
  // Reconstruct the curve for each edge order; no shifted cached geometry.
  const centerline = buildCenterline(cell, params.d_e);
  const geometry = bakeGeometry(centerline, { face: "technicalFace", pxPerMm: 200 });
  const material = normalizeYarnMaterial(source, { diameterMm: params.d_e, lengthMm: centerline.lengthMm });
  const parameters = normalizeFuzzParameters(source, { fuzzSource: "scan" });
  const fuzz = bakeYarnFuzz(centerline, geometry, material, { parameters, fiberDiameterMm: params.fiberDiameterMm });
  const composed = composeMaps(geometry, material, computeAmbientOcclusion(geometry, params.d_e), { fuzz });
  return { centerline, geometry, fuzz, composed };
}

/** T6a-3 part 0 fixed checks (t), (u). Importing this helper runs no checks.
 * Accepted (a)-(s) geometries may be reused for the six AO means; parameters
 * and all material/fuzz inputs retain the task's original measurement context.
 */
export async function validateTangentPassageTexture({ baked = [] } = {}) {
  const t = {}, u = {}, params = createFabricFormParams();
  const block = syntheticBlock(), oldBlock = computeLegacyAmbientOcclusion(block, params.d_e);
  const newBlock = computeAmbientOcclusion(block, params.d_e);
  assert.deepEqual(new Uint8Array(newBlock.buffer), new Uint8Array(oldBlock.buffer),
    "(t1) all +z normals: flat ground with raised block has bitwise identical AO");
  t.plane = { bitwiseIdentical: true, pixels: block.width * block.height,
    minAo: Math.min(...newBlock), maxAo: Math.max(...newBlock) };
  report("t1", t.plane);

  const isolatedPrefix = "t-isolated";
  const isolated = await bakeYarnStrip({ params, material: {}, fuzzSource: "off", pxPerMm: 200,
    prefix: isolatedPrefix, generatorVersion: "validation" });
  const oldIsolated = computeLegacyAmbientOcclusion(isolated.geometry, params.d_e);
  let minAo = Infinity, oldMinAo = Infinity, selectedPixels = 0;
  for (let i = 0; i < isolated.geometry.coverage.length; i++) {
    if (!isolated.geometry.coverage[i] || Math.abs(isolated.geometry.transverse[i]) > 0.8) continue;
    selectedPixels++;
    minAo = Math.min(minAo, isolated.composed.fields.ambientOcclusion[i]);
    oldMinAo = Math.min(oldMinAo, oldIsolated[i]);
  }
  assert.ok(selectedPixels > 0, "(t2) isolated yarn contains core pixels with |w| <= 0.8");
  assert.ok(minAo >= 0.85, `(t2) isolated yarn min AO=${minAo}, limit>=0.85`);
  t.isolatedYarn = { pxPerMm: 200, diameterMm: params.d_e, fuzzSource: "off", selectedPixels,
    minAo, oldMinAo, normalChecks: checkStripNormals(isolated, isolatedPrefix, "(t2) isolated yarn") };
  report("t2", t.isolatedYarn);

  const descriptions = [["hossain-2.84", "step3-hossain-2.84-after"],
    ["case-3-N48", "step4-case-3-N48"], ["case-4-N48", "step4-case-4-N48"]];
  const cases = await Promise.all(descriptions.map(async ([name, file]) => {
    const existing = baked.find(entry => entry.name === file);
    const result = existing?.result ?? JSON.parse(await fs.readFile(fixtureUrl(file), "utf8"));
    const curve = existing?.curve ?? buildCenterline(result.cell, result.params.d_e);
    return { name, result, front: existing?.front ?? bakeGeometry(curve, { face: "technicalFace", pxPerMm: 200 }),
      back: existing?.back ?? bakeGeometry(curve, { face: "technicalBack", pxPerMm: 200 }) };
  }));
  t.fabricMeans = [];
  for (const { name, result, front, back } of cases) for (const geometry of [front, back]) {
    const values = { name, face: geometry.face, ...compareCoreAo(geometry, result.params.d_e) };
    t.fabricMeans.push(values);
    report("t3", values);
  }

  const case3 = cases.find(entry => entry.name === "case-3-N48").result;
  const scanSource = syntheticScanSource(), shiftedCell = structuredClone(case3.cell);
  const edgeIndices = shiftedCell.topology.yarns[0].edgeIndices;
  const halfLoop = shiftedCell.topology.nodesPerLoop / 2;
  assert.ok(Number.isSafeInteger(halfLoop) && halfLoop > 0, "(u1) half a loop is an integral number of nodes");
  shiftedCell.topology.yarns[0].edgeIndices = [...edgeIndices.slice(halfLoop), ...edgeIndices.slice(0, halfLoop)];
  const original = renderScanPassages(case3.cell, case3.params, scanSource);
  const shifted = renderScanPassages(shiftedCell, case3.params, scanSource);
  const normalChecks = { original: checkComposedNormals(original.composed, "(u1) original start"),
    shifted: checkComposedNormals(shifted.composed, "(u1) shifted start") };
  u.startInvariance = { name: "case-3-N48", face: "technicalFace", fuzzSource: "scan", pxPerMm: 200,
    shiftedEdges: halfLoop, ...compareEightBitMaps(original.composed.maps, shifted.composed.maps, "(u1) half-loop start shift"), normalChecks };
  report("u1", u.startInvariance);
  const { multiPassagePixelCount, scanMultiPassagePixelCount, haloMultiPassagePixelCount } = original.fuzz.diagnostics;
  assert.ok(Number.isSafeInteger(multiPassagePixelCount) && multiPassagePixelCount > 0,
    `(u2) pixels retaining >=2 scan or >=2 halo passages=${multiPassagePixelCount}, expected>0`);
  u.multiplePassages = { multiPassagePixelCount, scanMultiPassagePixelCount, haloMultiPassagePixelCount };
  report("u2", u.multiplePassages);

  const material = await loadTextureMaterial({ files: {
    baseColor: fileURLToPath(new URL("../../public/materials/white-gray-yarn/yarn_basecolor_alpha.png", import.meta.url)),
    roughness: fileURLToPath(new URL("../../public/materials/white-gray-yarn/yarn_roughness.png", import.meta.url)),
  } });
  // T6a-2 review used the Hossain result's params, not the default material;
  // use the export pipeline so its 200 px/mm box prefilter remains in force.
  const hossain = cases.find(entry => entry.name === "hossain-2.84").result;
  const prefix = "strip_scan-both-medium";
  const strip = await bakeYarnStrip({ params: hossain.params, material, pxPerMm: 200, stripLengthMm: 4,
    fuzzSource: "both", fuzzOptions: { fuzzStrength: 0.5 }, prefix, generatorVersion: "validation" });
  const mapNames = ["baseColor", "normal", "roughness", "height"];
  const previousMaps = Object.fromEntries(await Promise.all(mapNames.map(async name =>
    [name, decodePng(await fs.readFile(reviewUrl(`${prefix}_yarn_${name}.png`)))])));
  const currentMaps = Object.fromEntries(mapNames.map(name => [name, decodePng(strip.files[`${prefix}_yarn_${name}.png`])]));
  const stripNormalChecks = { current: checkStripNormals(strip, prefix, "(u3) white-gray both medium"),
    previous: assertNormalMap(previousMaps.normal, "(g) (u3) T6a-2 archived normal") };
  u.singlePassage = { prefix, pxPerMm: 200, stripLengthMm: 4, diameterMm: hossain.params.d_e,
    fuzzSource: "both", fuzzStrength: 0.5, prefilter: strip.material.diagnostics.prefilter,
    ...compareEightBitMaps(previousMaps, currentMaps, "(u3) T6a-2 single-yarn PNG comparison"), normalChecks: stripNormalChecks };
  report("u3", u.singlePassage);
  return { t, u };
}
