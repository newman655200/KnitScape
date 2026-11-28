import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCenterline, evaluateCenterlineSegment } from "../src/fabricTexture/centerline.js";
import { bakeGeometry } from "../src/fabricTexture/bakeGeometry.js";
import { computeAmbientOcclusion } from "../src/fabricTexture/ambientOcclusion.js";
import { normalizeYarnMaterial, sampleYarnMaterial } from "../src/fabricTexture/yarnMaterial.js";
import { composeMaps, constrainVisibleHemisphere, VISIBLE_NORMAL_Z_FLOOR } from "../src/fabricTexture/composeMaps.js";
import { bakeFabricTexture } from "../src/fabricTexture/fabricTexturePipeline.js";
import { createFabricFormParams } from "../src/fabricForm/fabricFormParams.js";
import { createPlainJerseyTopology } from "../src/fabricForm/fabricFormTopology.js";
import { decodePng } from "./lib/fabric-texture-png.mjs";
import { validatePngCodec } from "./lib/fabric-texture-png-checks.mjs";
import { assertNormalMap, assertNormalPng } from "./lib/fabric-texture-normal-checks.mjs";
import { validateFuzzTexture } from "./lib/fabric-texture-fuzz-checks.mjs";
import { validateTangentPassageTexture } from "./lib/fabric-texture-tangent-passage-checks.mjs";

// Fixed T6a §4.1 acceptance thresholds. A failed item stops this script immediately.
const cases = ["step3-hossain-2.84-after", "step4-case-4-N48"].map(name => ({
  name, result: JSON.parse(fs.readFileSync(new URL(`../docs/archive/t1-slope-closeout-2026-11-23/${name}.json`, import.meta.url))),
}));
const distance = (a, b) => Math.hypot(...a.map((v, k) => v - b[k]));
const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${label}: actual=${actual}, expected=${expected}, tolerance=${tolerance}`);
const report = (item, values = {}) => console.log(JSON.stringify({ item, status: "PASS", ...values }));
function image(width, height, channels, pixel) {
  const data = new Uint8Array(width * height * channels);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * channels);
  return { width, height, channels, data };
}
function checkComposedNormals(composed, label) {
  return {
    unit: assertNormalMap(composed.unitMaps.normal, `(g) ${label} unit map`),
    tiled: assertNormalMap(composed.maps.normal, `(g) ${label} tiled map`),
  };
}
function checkTextureNormals(texture, prefix, label) {
  return Object.fromEntries(Object.entries(texture.composed).map(([face, composed]) => [face, {
    ...checkComposedNormals(composed, `${label} ${face}`),
    png: assertNormalPng(texture.files[`${prefix}_${face}_normal.png`], `(g) ${label} ${face} PNG`),
  }]));
}
const params = createFabricFormParams();
const topology = createPlainJerseyTopology({ m: 1, n: 1, nodesPerLoop: 48, loopLengthMm: 1 });
const straight = { W: 1, H: 1, S: 0, topology, positions: Array.from({ length: 48 }, (_, i) => [i / 48, 0.5, 0]) };
const center = buildCenterline(straight, params.d_e);
const straightGeometry = bakeGeometry(center, { face: "technicalBack", pxPerMm: 200 });
const baked = [];

for (const { name, result } of cases) {
  const curve = buildCenterline(result.cell, result.params.d_e);
  let nodeError = 0, maxSpacing = 0;
  let nodeP = 0, nodeQ = 0;
  for (let i = 0; i < curve.nodes.length; i++) {
    const edge = result.cell.topology.edges[result.cell.topology.yarns[0].edgeIndices[i]];
    const source = result.cell.positions[edge.from];
    const expected = [source[0] + nodeP * result.cell.W + nodeQ * result.cell.S, source[1] + nodeQ * result.cell.H, source[2]];
    nodeError = Math.max(nodeError, distance(evaluateCenterlineSegment(curve, i, 0), expected));
    nodeP += edge.p; nodeQ += edge.q;
  }
  for (let i = 1; i < curve.points.length; i++) maxSpacing = Math.max(maxSpacing, distance(curve.points[i], curve.points[i - 1]));
  near(nodeError, 0, 1e-12, `(a) ${name} node interpolation`);
  assert.ok(maxSpacing <= result.params.d_e / 24, `(a) spacing=${maxSpacing}, limit=${result.params.d_e / 24}`);
  const q = Math.round(curve.D[1] / result.cell.H), p = Math.round((curve.D[0] - q * result.cell.S) / result.cell.W);
  near(distance(curve.D, [p * result.cell.W + q * result.cell.S, q * result.cell.H, 0]), 0, 1e-12, "(a) lattice displacement");
  report("a", { name, nodeError, maxSpacing, D: curve.D });
  baked.push({ name, result, curve, front: bakeGeometry(curve, { face: "technicalFace", pxPerMm: 200 }),
    back: bakeGeometry(curve, { face: "technicalBack", pxPerMm: 200 }) });
}

let maxHeightError = 0, maxNormalError = 0;
const r = params.d_e / 2;
for (let y = 0; y < straightGeometry.height; y++) for (let x = 0; x < straightGeometry.width; x++) {
  const i = y * straightGeometry.width + x, d = 1 - (y + 0.5) / straightGeometry.height - 0.5;
  if (Math.abs(d) <= 0.999 * r) {
    assert.equal(straightGeometry.coverage[i], 1, "(b) analytic covered pixel");
    const z = Math.sqrt(r * r - d * d);
    maxHeightError = Math.max(maxHeightError, Math.abs(straightGeometry.heights[i] - z));
    maxNormalError = Math.max(maxNormalError, distance(Array.from(straightGeometry.normals.subarray(i * 3, i * 3 + 3)), [0, d / r, z / r]));
  } else if (Math.abs(d) > r) assert.equal(straightGeometry.coverage[i], 0, "(b) outside cylinder");
}
near(maxHeightError, 0, 1e-9 * r, "(b) height"); near(maxNormalError, 0, 1e-9, "(b) normal");
report("b", { maxHeightError, maxNormalError });

for (const entry of baked) {
  const { name, result, front, back } = entry;
  for (const shift of [[result.cell.W, 0, 0], [0, result.cell.H, 0]]) {
    const moved = { ...result.cell, positions: result.cell.positions.map(p => p.map((v, k) => v + shift[k])) };
    const curve = buildCenterline(moved, result.params.d_e);
    for (const original of [front, back]) {
      const shifted = bakeGeometry(curve, { face: original.face, pxPerMm: 200 });
      assert.deepEqual(shifted.coverage, original.coverage, `(c) ${name} coverage`);
      let dh = 0, dn = 0;
      for (let i = 0; i < original.coverage.length; i++) if (original.coverage[i]) {
        dh = Math.max(dh, Math.abs(shifted.heights[i] - original.heights[i]));
        dn = Math.max(dn, distance(Array.from(shifted.normals.subarray(3 * i, 3 * i + 3)), Array.from(original.normals.subarray(3 * i, 3 * i + 3))));
      }
      near(dh, 0, 1e-9, `(c) ${name} height`); near(dn, 0, 1e-9, `(c) ${name} normal`);
      report("c", { name, face: original.face, shift, maxHeightDifference: dh, maxNormalDifference: dn });
    }
  }
  assert.ok(front.diagnostics.legFraction > back.diagnostics.legFraction + 0.2,
    `(d) ${name}: face=${front.diagnostics.legFraction}, back=${back.diagnostics.legFraction}, required difference>0.2`);
  report("d", { name, frontLegFraction: front.diagnostics.legFraction, backLegFraction: back.diagnostics.legFraction });
}

const pngChecks = await validatePngCodec();
report("e", pngChecks.e); report("n", pngChecks.n);

assert.equal(VISIBLE_NORMAL_Z_FLOOR, 2 / 255, "(g1) fixed visible hemisphere floor");
const zFloor = VISIBLE_NORMAL_Z_FLOOR;
const unchangedNormals = [[0, 0, 1], [0.6, 0, 0.8], [Math.sqrt(1 - zFloor ** 2), 0, zFloor]];
for (const normal of unchangedNormals) {
  const before = normal.slice();
  assert.deepEqual(constrainVisibleHemisphere(normal), before, "(g1) visible normal unchanged bit for bit");
  assert.deepEqual(normal, before, "(g1) input is not mutated");
}
const belowFloorNormals = [[1, 0, 0], [-Math.sqrt(0.75), 0, -0.5], [0, 0.8, -0.6],
  [Math.sqrt((1 - (zFloor / 2) ** 2) / 2), -Math.sqrt((1 - (zFloor / 2) ** 2) / 2), zFloor / 2]];
for (const normal of belowFloorNormals) {
  const before = normal.slice(), constrained = constrainVisibleHemisphere(normal);
  assert.equal(constrained[2], zFloor, "(g1) constrained z equals floor");
  near(Math.hypot(...constrained), 1, 1e-12, "(g1) constrained unit normal");
  near(constrained[0] * normal[1] - constrained[1] * normal[0], 0, 1e-12, "(g1) horizontal cross product");
  assert.ok(constrained[0] * normal[0] + constrained[1] * normal[1] > 0, "(g1) horizontal direction preserved");
  assert.deepEqual(normal, before, "(g1) input is not mutated");
}
assert.deepEqual(constrainVisibleHemisphere([0, 0, -1]), [0, 0, 1], "(g1) antipodal fallback");
report("g1", { unchangedCases: unchangedNormals.length, constrainedCases: belowFloorNormals.length, zFloor });

for (const entry of baked) {
  const options = { result: entry.result, pxPerMm: 200, prefix: "test", generatorVersion: "validation", repeat: [2, 3], fuzzSource: "off" };
  const first = await bakeFabricTexture(options);
  const firstNormalChecks = checkTextureNormals(first, "test", `${entry.name} first`);
  const second = await bakeFabricTexture(options);
  const secondNormalChecks = checkTextureNormals(second, "test", `${entry.name} second`);
  entry.pipelineGeometry = first.geometry;
  for (const [file, bytes] of Object.entries(first.files)) assert.deepEqual(bytes, second.files[file], `(f) PNG ${file}`);
  const clean = metadata => { const copy = structuredClone(metadata); delete copy.generatedAt; return copy; };
  assert.deepEqual(clean(first.metadata), clean(second.metadata), "(f) metadata");
  report("f", { name: entry.name, pngCount: Object.keys(first.files).length });
  for (const face of ["technicalFace", "technicalBack"]) {
    const geometry = first.geometry.faces[face];
    const height = decodePng(first.files[`test_${face}_height.png`]);
    const normError = firstNormalChecks[face].png.maxLengthError;
    let heightError = 0;
    for (let y = 0; y < height.height; y++) for (let x = 0; x < height.width; x++) {
      const i = y * height.width + x, j = (y % geometry.height) * geometry.width + x % geometry.width;
      if (geometry.coverage[j]) heightError = Math.max(heightError, Math.abs(
        geometry.heightMinMm + height.data[i] / 65535 * (geometry.heightMaxMm - geometry.heightMinMm) - geometry.heights[j]));
    }
    near(normError, 0, 2 / 255, "(g) unit normal");
    const md = first.metadata.faces[face];
    assert.equal(md.heightMinMm, geometry.heightMinMm); assert.equal(md.heightMaxMm, geometry.heightMaxMm);
    near(heightError, 0, (geometry.heightMaxMm - geometry.heightMinMm) / 65535, "(h) height");
    report("g/h", { name: entry.name, face, normError, heightError,
      first: firstNormalChecks[face], second: secondNormalChecks[face] });
  }
  near(first.metadata.solver.waleDensityPerCm / (10 * entry.result.cell.topology.m / entry.result.cell.W), 1, 1e-12, "(j) wale");
  near(first.metadata.solver.courseDensityPerCm / (10 * entry.result.cell.topology.n / entry.result.cell.H), 1, 1e-12, "(j) course");
  assert.deepEqual(first.metadata.texture.physicalSizeMm, [2 * entry.result.cell.W, 3 * entry.result.cell.H]);
  report("j", { name: entry.name });
}

const rgbaYarn = image(32, 16, 4, (x, y) => [80 + x, 120, 160,
  y >= 5 && y < 11 ? 255 : y >= 2 && y < 14 ? 48 : 0]);
for (const fuzzBand of ["fullScan", "vRange"]) {
  const texture = await bakeFabricTexture({ result: baked[0].result, geometry: baked[0].pipelineGeometry,
    material: { baseColor: rgbaYarn, fuzzBand, vRange: [0.25, 0.75] }, pxPerMm: 200,
    prefix: "bands", generatorVersion: "validation", fuzzSource: "off" });
  const normalChecks = checkTextureNormals(texture, "bands", `(j) ${fuzzBand}`);
  const diagnostics = texture.material.diagnostics;
  assert.equal(diagnostics.hairBandMode, fuzzBand, "(j) requested hair band mode is used");
  assert.equal(texture.metadata.yarn.fuzzBandMode, diagnostics.hairBandMode, "(j) metadata hair band mode matches actual diagnostics");
  assert.deepEqual(texture.metadata.yarn.fuzzBand, diagnostics.hairBand, "(j) metadata hair band matches actual diagnostics");
  assert.deepEqual(diagnostics.hairBand, fuzzBand === "fullScan" ? [0.125, 0.875] : [0.25, 0.75], "(j) synthetic RGBA hair band");
  report("j", { fuzzBandMode: texture.metadata.yarn.fuzzBandMode, fuzzBand: texture.metadata.yarn.fuzzBand, normalChecks });
}

const pattern = image(256, 64, 3, x => [Math.round(127 + 100 * Math.cos(2 * Math.PI * (x + 0.5) / 256)), 80, 40]);
for (const physicalRepeatLengthMm of [undefined, 0.37]) {
  const mat = normalizeYarnMaterial({ baseColor: pattern, physicalRepeatLengthMm }, { diameterMm: params.d_e, lengthMm: center.lengthMm });
  near(center.lengthMm / mat.adjustedRepeatLengthMm, Math.round(center.lengthMm / mat.adjustedRepeatLengthMm), 1e-9, "(i) repeat count");
  assert.equal(mat.repeatSource, physicalRepeatLengthMm ? "ASSET" : "DERIVED_FROM_ASPECT");
  near(mat.repeatLengthMm, physicalRepeatLengthMm ?? params.d_e * 256 / 64, 1e-12, "(i) repeat source");
  near(distance(sampleYarnMaterial(mat, -1e-12, 0).color, sampleYarnMaterial(mat, center.lengthMm + 1e-12, 0).color), 0, 1e-9, "(i) seam continuity");
}
report("i");

const g = bakeGeometry(center, { face: "technicalBack", pxPerMm: 201 });
const ao = computeAmbientOcclusion(g, params.d_e), mid = 100 * 201 + 100;
const encodeNormal = values => values.map(v => Math.round((0.5 * v + 0.5) * 255));
const strongNormal = image(256, 64, 3, x => {
  const angle = 1.2 * Math.cos(2 * Math.PI * (x + 0.5) / 256);
  return encodeNormal([0, Math.sin(angle), Math.cos(angle)]);
});
const hossain = baked[0];
const strongMaterial = normalizeYarnMaterial({ normal: strongNormal },
  { diameterMm: hossain.result.params.d_e, lengthMm: hossain.curve.lengthMm });
const strongComposed = composeMaps(hossain.front, strongMaterial, hossain.pipelineGeometry.ao.technicalFace);
assert.ok(strongComposed.diagnostics.visibleHemisphere.constrainedPixelCount > 0, "(g2) strong detail triggers visible hemisphere constraint");
report("g2", { ...strongComposed.diagnostics.visibleHemisphere,
  normalChecks: checkComposedNormals(strongComposed, "strong detail hossain-2.84 technicalFace") });
for (const channel of [0, 1]) {
  const normal = image(256, 64, 3, x => {
    const angle = 0.3 * Math.cos(2 * Math.PI * (x + 0.5) / 256);
    return encodeNormal(channel === 0 ? [Math.sin(angle), 0, Math.cos(angle)] : [0, Math.sin(angle), Math.cos(angle)]);
  });
  const mat = normalizeYarnMaterial({ normal, physicalRepeatLengthMm: 0.5 }, { diameterMm: params.d_e, lengthMm: center.lengthMm });
  const composed = composeMaps(g, mat, ao);
  const normalChecks = checkComposedNormals(composed, `(l) channel=${channel}`);
  const actual = Array.from(composed.fields.normals.subarray(mid * 3, mid * 3 + 3));
  const expected = channel === 0 ? [Math.sin(0.3), 0, Math.cos(0.3)] : [0, Math.sin(0.3), Math.cos(0.3)];
  near(distance(actual, expected), 0, 0.02, `(l) channel=${channel}`);
  report("l", { channel, actual, expected, normalChecks });
}
const sectionNormal = image(256, 64, 3, (_, y) => encodeNormal([0, Math.sin((y / 63 - 0.5) * 2), Math.cos((y / 63 - 0.5) * 2)]));
const sectionAo = image(256, 64, 1, (_, y) => [80 + y]);
const base = composeMaps(g, normalizeYarnMaterial({}, { diameterMm: params.d_e, lengthMm: center.lengthMm }), ao);
const baseNormalChecks = checkComposedNormals(base, "(m) base");
const withSection = composeMaps(g, normalizeYarnMaterial({ normal: sectionNormal, ambientOcclusion: sectionAo }, { diameterMm: params.d_e, lengthMm: center.lengthMm }), ao);
const sectionNormalChecks = checkComposedNormals(withSection, "(m) with section");
let sectionNormalError = 0, sectionAoError = 0;
for (let i = 0; i < g.coverage.length; i++) if (g.coverage[i]) {
  sectionNormalError = Math.max(sectionNormalError, distance(Array.from(base.fields.normals.subarray(i * 3, i * 3 + 3)), Array.from(withSection.fields.normals.subarray(i * 3, i * 3 + 3))));
  sectionAoError = Math.max(sectionAoError, Math.abs(base.fields.ambientOcclusion[i] - withSection.fields.ambientOcclusion[i]));
}
near(sectionNormalError, 0, 1e-6, "(m) normal cross-section removal"); near(sectionAoError, 0, 1e-6, "(m) AO cross-section removal");
report("m", { sectionNormalError, sectionAoError, baseNormalChecks, sectionNormalChecks });
await validateFuzzTexture({ params, center, straightGeometry, hossain, strongNormal });
const t6a3Part0 = await validateTangentPassageTexture({ baked });
console.log("T6A3_PART0_CHECKS_JSON " + JSON.stringify(t6a3Part0));
console.log("fabric-texture: all T6a-1/T6a-2/T6a-3 part 0 checks (a)-(j), (l)-(u) passed.");
