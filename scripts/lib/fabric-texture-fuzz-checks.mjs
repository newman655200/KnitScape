import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { normalizeYarnMaterial, sampleYarnMaterial } from "../../src/fabricTexture/yarnMaterial.js";
import { normalizeFuzzParameters, generateYarnFibers, bakeYarnFuzz } from "../../src/fabricTexture/yarnFuzz.js";
import { bakeGeometry } from "../../src/fabricTexture/bakeGeometry.js";
import { composeMaps } from "../../src/fabricTexture/composeMaps.js";
import { bakeFabricTexture, bakeYarnStripFields } from "../../src/fabricTexture/fabricTexturePipeline.js";
import { createYarnStripMetadata } from "../../src/fabricTexture/metadata.js";
import { createStraightYarnCenterline } from "../../src/fabricTexture/centerline.js";
import { encodePng } from "../../src/fabricTexture/png.js";
import { identifyPbrMap } from "../../src/yarnTexture/yarnScanTexture.js";
import { decodePng } from "./fabric-texture-png.mjs";
import { assertNormalMap, assertNormalPng } from "./fabric-texture-normal-checks.mjs";
import { addYarnPreviewMetadata, findTextureVRange } from "./fabric-texture-material-input.mjs";

const report = (item, values = {}) => console.log(JSON.stringify({ item, status: "PASS", ...values }));
function image(width, height, channels, pixel) {
  const data = new Uint8Array(width * height * channels);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * channels);
  return { width, height, channels, data };
}
function normalChecks(composed, label) {
  return { unit: assertNormalMap(composed.unitMaps.normal, `(g) ${label} unit`),
    tiled: assertNormalMap(composed.maps.normal, `(g) ${label} tiled`) };
}
function shiftCurve(curve, x) {
  return { ...curve, nodes: curve.nodes.map(p => [p[0] + x, p[1], p[2]]),
    points: curve.points.map(p => [p[0] + x, p[1], p[2]]) };
}
function comparePeriodicMaps(original, shifted, label) {
  const diagnostics = {};
  for (const [name, a] of Object.entries(original)) {
    if (a.bitDepth !== 8) continue;
    const b = shifted[name];
    assert.equal(b.width, a.width, `${label} ${name} width`);
    assert.equal(b.height, a.height, `${label} ${name} height`);
    assert.equal(b.channels, a.channels, `${label} ${name} channels`);
    let maxDifference = 0, differingPixels = 0;
    for (let p = 0; p < a.width * a.height; p++) {
      let differs = false;
      for (let c = 0; c < a.channels; c++) {
        const offset = p * a.channels + c, delta = Math.abs(a.data[offset] - b.data[offset]);
        maxDifference = Math.max(maxDifference, delta);
        differs ||= delta !== 0;
      }
      differingPixels += Number(differs);
    }
    const differingFraction = differingPixels / (a.width * a.height);
    assert.ok(maxDifference <= 1, `${label} ${name}: max byte difference=${maxDifference}, limit=1`);
    assert.ok(differingFraction <= 0.001,
      `${label} ${name}: differing pixels=${differingPixels}/${a.width * a.height}, limit=0.1%`);
    diagnostics[name] = { maxDifference, differingPixels, differingFraction };
  }
  return diagnostics;
}
function boundaryDiagnostic(map) {
  let edge = 0, adjacent = 0;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) for (let c = 0; c < map.channels; c++) {
    const offset = (y * map.width + x) * map.channels + c;
    if (x === 0) edge += Math.abs(map.data[offset] - map.data[offset + (map.width - 1) * map.channels]);
    else adjacent += Math.abs(map.data[offset] - map.data[offset - map.channels]);
  }
  return { firstLastColumnsMean: edge / (map.height * map.channels),
    adjacentColumnsMean: adjacent / (map.height * (map.width - 1) * map.channels) };
}

/** Fixed T6a-2 checks (o)-(s). Inputs reuse already accepted T6a-1 geometry. */
export async function validateFuzzTexture({ params, center, straightGeometry, hossain, strongNormal }) {
  const diameterMm = params.d_e, r = diameterMm / 2;
  const geometryAo = new Float64Array(straightGeometry.width * straightGeometry.height).fill(1);
  // Fine rows make the prescribed sharp alpha bands resolved relative to the
  // output grid; this direct material call intentionally has no prefilter.
  const scanSource = { baseColor: image(1, 10000, 4, (_, y) => y >= 4000 && y < 6000 ? [255, 255, 255, 255]
    : y >= 2000 && y < 8000 ? [128, 128, 128, 102] : [0, 0, 0, 0]), fuzzBand: "fullScan" };
  const material = normalizeYarnMaterial(scanSource, { diameterMm, lengthMm: center.lengthMm });
  function render(source, curve = center, geometry = straightGeometry, mat = material, sourceMaterial = scanSource, fibers) {
    const parameters = normalizeFuzzParameters(sourceMaterial, source);
    fibers ??= generateYarnFibers(curve, parameters, { fiberDiameterMm: params.fiberDiameterMm });
    const fuzz = bakeYarnFuzz(curve, geometry, mat, { parameters, fibers, fiberDiameterMm: params.fiberDiameterMm,
      periodicY: geometry.periodicY ?? true });
    const composed = composeMaps(geometry, mat, geometryAo, { fuzz });
    const checked = normalChecks(composed, `${source.fuzzSource} seed=${parameters.seed}`);
    return { parameters, fibers, fuzz, composed, normalChecks: checked };
  }

  const scan = render({ fuzzSource: "scan" });
  let hairPixels = 0, maxScanAlphaError = 0;
  for (let y = 0; y < straightGeometry.height; y++) for (let x = 0; x < straightGeometry.width; x++) {
    const i = y * straightGeometry.width + x;
    const d = straightGeometry.H - (y + 0.5) * straightGeometry.dy - 0.5;
    const alpha = scan.composed.maps.opacity.data[i];
    if (straightGeometry.coverage[i]) assert.equal(alpha, 255, `(o) core pixel=${i}`);
    if (r < Math.abs(d) && Math.abs(d) <= 3 * r) {
      const error = Math.abs(alpha - Math.round(0.4 * 255));
      maxScanAlphaError = Math.max(maxScanAlphaError, error); hairPixels++;
      assert.ok(error <= 1, `(o) scan pixel=${i}, d=${d}, alpha=${alpha}, expected=102±1`);
    }
    if (Math.abs(d) > 3 * r + straightGeometry.dy) assert.equal(alpha, 0, `(o) exterior pixel=${i}`);
  }
  assert.ok(hairPixels > 0, "(o) synthetic test must contain scan pixels");
  report("o", { hairPixels, maxScanAlphaError, normalChecks: scan.normalChecks });

  const off = render({ fuzzSource: "off" });
  const offHeight = await encodePng(off.composed.maps.height);
  for (const fuzzSource of ["scan", "generated", "both"]) {
    const value = fuzzSource === "scan" ? scan : render({ fuzzSource });
    assert.deepEqual(await encodePng(value.composed.maps.height), offHeight, `(p) ${fuzzSource} height PNG unchanged`);
    report("p", { fuzzSource, normalChecks: value.normalChecks });
  }

  const pureMaterial = normalizeYarnMaterial({}, { diameterMm, lengthMm: center.lengthMm });
  for (const fuzzStrength of [0, 0.45, 1]) {
    const value = render({ fuzzSource: "generated", fuzzStrength }, center, straightGeometry, pureMaterial, {});
    assert.equal(value.parameters.hairinessIndex, 16 * fuzzStrength, "(q) hairiness follows strength");
    assert.equal(value.parameters.haloStrength, fuzzStrength, "(q) halo follows strength");
    assert.equal(value.fibers.length, Math.round(value.parameters.hairinessIndex * center.lengthMm / value.parameters.meanHairLengthMm),
      "(q) generated fiber count");
    if (fuzzStrength === 0) {
      assert.equal(value.fibers.length, 0, "(q) zero strength produces no fibers");
      assert.equal(value.fuzz.diagnostics.haloPixelCount, 0, "(q) zero strength produces no halo pixels");
    }
    report("q", { fuzzStrength, hairinessIndex: value.parameters.hairinessIndex,
      haloStrength: value.parameters.haloStrength, fiberCount: value.fibers.length, normalChecks: value.normalChecks });
  }
  const generate = (seed, curve = center, geometry = straightGeometry) =>
    render({ fuzzSource: "generated", seed }, curve, geometry, pureMaterial, {});
  const same1 = generate(37), same2 = generate(37), other = generate(38);
  for (const [name, map] of Object.entries(same1.composed.maps)) {
    assert.deepEqual(map.data, same2.composed.maps[name].data, `(q) same seed ${name}`);
  }
  assert.notDeepEqual(same1.composed.maps.opacity.data, other.composed.maps.opacity.data, "(q) different seed changes output");
  const shiftedCurve = shiftCurve(center, center.W);
  const shiftedGeometry = bakeGeometry(shiftedCurve, { face: "technicalBack", pxPerMm: 200 });
  const moved = generate(37, shiftedCurve, shiftedGeometry);
  const periodicity = comparePeriodicMaps(same1.composed.maps, moved.composed.maps, "(q) translated centerline");
  report("q", { seedDeterminism: true, seedSensitivity: true, periodicity });

  const blank = { ...straightGeometry, coverage: new Uint8Array(straightGeometry.coverage.length),
    heights: new Float64Array(straightGeometry.coverage.length).fill(-Infinity), periodicY: false };
  const row = Math.floor(blank.height / 2), fiberY = blank.H - (row + 0.5) * blank.dy;
  const fiber = { id: 0, brightness: 1, points: [[0, fiberY, 1], [blank.W, fiberY, 1]], tangents: [[1, 0, 0], [1, 0, 0]] };
  const single = render({ fuzzSource: "generated", hairinessIndex: 0, haloStrength: 0 }, center, blank, pureMaterial, {}, [fiber]);
  const alphaLimit = Math.round(single.parameters.fiberOpacity * 255);
  let maxFiberAlpha = 0;
  for (const alpha of single.composed.maps.opacity.data) {
    maxFiberAlpha = Math.max(maxFiberAlpha, alpha);
    assert.ok(alpha <= alphaLimit, `(q) one fiber self-overlap opacity=${alpha}, limit=${alphaLimit}`);
  }
  for (let x = 0; x < blank.width; x++) assert.ok(Math.abs(single.composed.maps.opacity.data[row * blank.width + x] - alphaLimit) <= 1,
    `(q) single fiber center x=${x}`);
  report("q", { singleFiber: { maxFiberAlpha, alphaLimit }, normalChecks: single.normalChecks });

  await checkStrips(params);

  const stripes = image(256, 64, 3, x => new Array(3).fill(x % 2 === 0 ? 255 : 0));
  const stripeSource = { baseColor: stripes, physicalRepeatLengthMm: 0.25 };
  const stripeOptions = { diameterMm, lengthMm: center.lengthMm };
  const filtered = normalizeYarnMaterial(stripeSource, { ...stripeOptions, pxPerMm: 200 });
  const unfiltered = normalizeYarnMaterial(stripeSource, stripeOptions);
  assert.equal(filtered.diagnostics.prefilter.maps.baseColor.f_U, 5, "(s) alternating-stripe f_U");
  const filteredMaps = composeMaps(straightGeometry, filtered, geometryAo);
  const unfilteredMaps = composeMaps(straightGeometry, unfiltered, geometryAo);
  let filteredMin = 255, filteredMax = 0, unfilteredMin = 255, unfilteredMax = 0, selectedPixels = 0;
  for (let i = 0; i < straightGeometry.coverage.length; i++) {
    if (!straightGeometry.coverage[i] || Math.abs(straightGeometry.transverse[i]) > 0.5) continue;
    selectedPixels++;
    for (let c = 0; c < 3; c++) {
      const a = filteredMaps.maps.baseColor.data[3 * i + c], b = unfilteredMaps.maps.baseColor.data[3 * i + c];
      filteredMin = Math.min(filteredMin, a); filteredMax = Math.max(filteredMax, a);
      unfilteredMin = Math.min(unfilteredMin, b); unfilteredMax = Math.max(unfilteredMax, b);
      assert.ok(a >= 0.35 * 255 && a <= 0.65 * 255, `(s) filtered pixel=${i} channel=${c}, value=${a}`);
    }
  }
  assert.ok(selectedPixels > 0, "(s) selected core pixels exist");
  assert.ok(unfilteredMax - unfilteredMin > 0.5 * 255, "(s) unfiltered control retains high contrast");
  report("s", { stripePrefilter: filtered.diagnostics.prefilter, filteredMin, filteredMax, unfilteredMin, unfilteredMax,
    normalChecks: { filtered: normalChecks(filteredMaps, "(s) filtered stripes"), unfiltered: normalChecks(unfilteredMaps, "(s) unfiltered stripes") } });

  const tiny = { baseColor: image(4, 2, 4, (x, y) => [40 + 40 * x, 80 + 40 * y, 130, 170 + 10 * x]),
    normal: image(4, 2, 3, (x, y) => [120 + x, 125 + y, 250]), roughness: image(4, 2, 1, x => [50 + x * 40]),
    ambientOcclusion: image(4, 2, 1, (x, y) => [100 + x + y]), metallic: image(4, 2, 1, x => [30 + x * 20]), physicalRepeatLengthMm: 0.25 };
  const identity = normalizeYarnMaterial(tiny, { ...stripeOptions, pxPerMm: 200 });
  const noFilter = normalizeYarnMaterial(tiny, stripeOptions);
  for (const diag of Object.values(identity.diagnostics.prefilter.maps)) {
    assert.equal(diag.f_U, 1, "(s) identity U window"); assert.equal(diag.f_V, 1, "(s) identity V window");
  }
  for (const s of [-0.2, 0, 0.1, 0.25, 0.999]) for (const w of [-1, -0.5, 0, 0.3, 1]) {
    assert.deepEqual(sampleYarnMaterial(identity, s, w), sampleYarnMaterial(noFilter, s, w), "(s) f=1 sampling bitwise unchanged");
  }
  const identityMaps = composeMaps(straightGeometry, identity, geometryAo), noFilterMaps = composeMaps(straightGeometry, noFilter, geometryAo);
  for (const [name, map] of Object.entries(identityMaps.maps)) assert.deepEqual(map.data, noFilterMaps.maps[name].data, `(s) f=1 ${name} bytes unchanged`);
  report("s", { identityPrefilter: identity.diagnostics.prefilter,
    normalChecks: { identity: normalChecks(identityMaps, "(s) f=1"), noFilter: normalChecks(noFilterMaps, "(s) omitted resolution") } });

  const strong = await bakeFabricTexture({ result: hossain.result, geometry: hossain.pipelineGeometry,
    material: { normal: strongNormal }, pxPerMm: 200, fuzzSource: "off", prefix: "prefilter-strong", generatorVersion: "validation" });
  const strongChecks = {};
  for (const [face, composed] of Object.entries(strong.composed)) strongChecks[face] = {
    ...normalChecks(composed, `(s) strong ${face}`),
    png: assertNormalPng(strong.files[`prefilter-strong_${face}_normal.png`], `(g) (s) strong ${face} PNG`),
  };
  report("s", { strongPrefilter: strong.material.diagnostics.prefilter,
    constrainedPixelCount: strong.composed.technicalFace.diagnostics.visibleHemisphere.constrainedPixelCount, normalChecks: strongChecks });
}

async function checkStrips(params) {
    const baseColor = decodePng(await fs.readFile(new URL("../../public/materials/white-gray-yarn/yarn_basecolor_alpha.png", import.meta.url)));
    const roughness = decodePng(await fs.readFile(new URL("../../public/materials/white-gray-yarn/yarn_roughness.png", import.meta.url)));
    const whiteGray = { baseColor, roughness, vRange: await findTextureVRange(baseColor) };
    for (const [name, material, fuzzSource, fuzzStrength] of [["white-gray", whiteGray, "both", 0.5],
      ["solid-medium", {}, "generated", 0.5], ["solid-high", {}, "generated", 1]]) {
      // (r) retains its original sampling contract: use the same production
      // strip fields pipeline with material prepared without pxPerMm. Actual
      // exports and the (s) pipeline check always pass their output resolution.
      const normalized = normalizeYarnMaterial(material, { diameterMm: params.d_e, lengthMm: 4 });
      const fuzzParameters = normalizeFuzzParameters(material, { fuzzSource, fuzzStrength });
      const options = { params, material: normalized, fuzzParameters, pxPerMm: 200, stripLengthMm: 4 };
      const strip = bakeYarnStripFields(options);
      const files = Object.fromEntries(await Promise.all(Object.entries(strip.maps).map(async ([key, map]) =>
        [`${name}_yarn_${key}.png`, await encodePng(map)])));
      const decodedMaps = {};
      for (const [filename, bytes] of Object.entries(files)) {
        if (!filename.endsWith(".png")) continue;
        const expected = filename.slice(`${name}_yarn_`.length, -4);
        assert.equal(identifyPbrMap(filename), expected, `(r) filename ${filename}`);
        decodedMaps[expected] = decodePng(bytes);
        if (expected === "normal") assertNormalPng(bytes, `(g) (r) ${filename}`);
      }
      assert.equal(decodedMaps.baseColor.channels, 4, "(r) strip baseColor is RGBA");
      assert.equal(decodedMaps.height.bitDepth, 8, "(r) strip height uses 8 bits");
      const metadata = createYarnStripMetadata({ ...strip, ...options, sourceMaterial: material,
        generatorVersion: "validation", generatedAt: "validation" });
      await addYarnPreviewMetadata(metadata, decodedMaps.baseColor);
      const range = await findTextureVRange(decodedMaps.baseColor);
      assert.deepEqual(metadata.preview.vRange, range, "(r) metadata uses the actual existing V range detector");
      const fallback = range[0] === 0 && range[1] === 1;
      if (name !== "solid-high") {
        assert.equal(fallback, false, `(r) ${name} V range must find a single yarn band`);
        for (let y = 0; y < strip.geometry.height; y++) {
          if (!strip.geometry.coverage.subarray(y * strip.geometry.width, (y + 1) * strip.geometry.width).some(Boolean)) continue;
          assert.ok(y / strip.geometry.height >= range[0] && (y + 1) / strip.geometry.height <= range[1],
            `(r) ${name} core row=${y} outside V range ${range}`);
        }
      } else if (fallback) assert.ok(JSON.stringify(metadata).includes("二维预览将使用整张贴图高度"), "(r) high fuzz V range fallback note");
      const baseCurve = createStraightYarnCenterline({ lengthMm: 4, diameterMm: params.d_e });
      const shifted = bakeYarnStripFields({ ...options, centerline: shiftCurve(baseCurve, 4) });
      const shiftedMaps = {};
      for (const [key, map] of Object.entries(shifted.maps)) {
        const bytes = await encodePng(map);
        shiftedMaps[key] = decodePng(bytes);
        if (key === "normal") assertNormalPng(bytes, `(g) (r) shifted ${name} normal PNG`);
      }
      const periodicity = comparePeriodicMaps(decodedMaps, shiftedMaps, `(r) ${name} translated strip`);
      report("r", { name, vRange: range, fallback, prefilter: normalized.diagnostics.prefilter,
        boundaries: Object.fromEntries(Object.entries(decodedMaps).map(([key, map]) => [key, boundaryDiagnostic(map)])), periodicity,
        normalChecks: { original: normalChecks(strip.composed, `(r) ${name}`), shifted: normalChecks(shifted.composed, `(r) shifted ${name}`) } });
    }
}
