import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const packageJSON = JSON.parse(read("package.json"));
assert.equal(
  packageJSON.scripts["validate:path-uv-yarn-texture"],
  "node --experimental-default-type=module scripts/validate-path-uv-yarn-texture.mjs",
  "package.json must expose validate:path-uv-yarn-texture."
);

const textureSource = read("src/yarnTexture/yarnScanTexture.js");
for (const name of [
  "baseColor",
  "normal",
  "roughness",
  "height",
  "ambientOcclusion",
]) {
  assert.match(
    textureSource,
    new RegExp(`${name}:`),
    `PBR map ${name} must be normalized.`
  );
}
assert.match(
  textureSource,
  /normalizePbrTextureMap/,
  "PBR map records must be normalized by a dedicated helper."
);
assert.match(
  textureSource,
  /processedDataUrl:\s*String\(map\.processedDataUrl \|\| map\.dataUrl \|\| ""\)/,
  "PBR map records must preserve processedDataUrl fallback behavior."
);

const sampler = await import("../src/simulation/yarnPathSampler.js");

const endpointOptions = { spacing: 0.3, curveSteps: 4, maxPoints: 64 };
const ordinaryCubic = "M 0 0 C 0 4 6 4 6 0";
// Frozen raw model paths from local-c04-2026-10-22.json, links 1836 and 1837.
// Keep the two fixtures here so this validator does not depend on audit reports.
const join1836 = "M7.599305,12.658012C7.71818,12.776886,7.567182,13.37241,7.599305,13.376229";
const join1837 = "M7.599305,13.376229C7.642279,13.381338,7.676237,12.303456,7.900695,12.126701";
const relativeRepeatedCubic = "m 2 3 c 0 4 6 4 6 0 0 -4 6 -4 6 0";
const separateCubics = "M 0 0 C 0 4 6 4 6 0 M 10 0 C 10 -4 16 -4 16 0";

// Captured before the endpoint-frame fix: every coordinate, U and interior
// frame must remain bit-for-bit unchanged, including sample count/capping.
for (const [name, pathData, count, expectedHash] of [
  ["ordinary C", ordinaryCubic, 33, "0a14c9e677edf0bbb4fcdc6371d337f5d2c5dd6747aa538f6d6027095c1eee5c"],
  ["link 1836", join1836, 4, "e97b9ec7c029bb329d6b2c2a234ad88c9148526513031a034e369b6a798b2823"],
  ["link 1837", join1837, 6, "eb75940c3b8b3ac8b95116305c7bf0e51f431b0c6c3d57255d5d3a2959033a00"],
  ["relative/repeated C", relativeRepeatedCubic, 64, "cbd562caa6c8e5d7b78f69c40811e3910b5105a2bc1d4a7bc6a4a7f284621c6d"],
  ["separate subpaths", separateCubics, 64, "b818a6ab082b4f54142c0ffc4e77ee8d81af80cfddd3bcdfc5b4be338e0fe752"],
]) {
  const samples = sampler.samplePathData(pathData, endpointOptions);
  assert.equal(samples.length, count, `${name}: sample count must not change.`);
  const stableSamples = samples.map((point, index) =>
    index === 0 || index === samples.length - 1
      ? { x: point.x, y: point.y, u: point.u } : point);
  assert.equal(createHash("sha256").update(JSON.stringify(stableSamples)).digest("hex"),
    expectedHash, `${name}: positions, U and interior frames must not change.`);
}

const assertFrame = (point, dx, dy, label) => {
  const length = Math.hypot(dx, dy);
  const expected = { tangentX: dx / length, tangentY: dy / length,
    normalX: -dy / length, normalY: dx / length };
  for (const [key, value] of Object.entries(expected)) {
    assert.ok(Math.abs(point[key] - value) < 1e-12,
      `${label}: ${key} must be ${value}, got ${point[key]}.`);
  }
};

for (const options of [endpointOptions,
  { spacing: 0.01, curveSteps: 24, maxPoints: 4 },
  { spacing: Infinity, curveSteps: 1 }]) {
  const points = sampler.samplePathData(ordinaryCubic, options);
  assertFrame(points[0], 0, 4, "C start must follow P0→P1 independently of sampling");
  assertFrame(points.at(-1), 0, -4, "C end must follow P2→P3 independently of sampling");
}

const beforeJoin = sampler.samplePathData(join1836, { spacing: 0.03 });
const afterJoin = sampler.samplePathData(join1837, { spacing: 0.03 });
assert.deepEqual([beforeJoin.at(-1).x, beforeJoin.at(-1).y],
  [afterJoin[0].x, afterJoin[0].y], "1836→1837 must retain its shared raw endpoint.");
assertFrame(beforeJoin.at(-1), 7.599305 - 7.567182, 13.376229 - 13.37241,
  "real link 1836 end");
assertFrame(afterJoin[0], 7.642279 - 7.599305, 13.381338 - 13.376229,
  "real link 1837 start");

for (const [name, pathData, endpoint, dx, dy] of [
  ["start P0=P1 uses P0→P2", "M 0 0 C 0 0 0 4 6 0", 0, 0, 4],
  ["start P0=P1=P2 uses P0→P3", "M 0 0 C 0 0 0 0 3 4", 0, 3, 4],
  ["end P2=P3 uses P1→P3", "M 0 0 C 0 4 6 0 6 0", -1, 6, -4],
  ["end P1=P2=P3 uses P0→P3", "M 0 0 C 3 4 3 4 3 4", -1, 3, 4],
  ["start below epsilon skips P0→P1", "M 0 0 C 5e-7 5e-7 0 4 6 0", 0, 0, 4],
  ["start at epsilon skips P0→P1", "M 0 0 C 1e-6 0 0 4 6 0", 0, 0, 4],
  ["start above epsilon keeps P0→P1", "M 0 0 C 2e-6 0 0 4 6 0", 0, 1, 0],
  ["start skips both near-degenerate controls", "M 0 0 C 5e-7 5e-7 1e-6 0 3 4", 0, 3, 4],
  ["end below epsilon skips P2→P3", "M 0 6 C -4 0 -5e-7 -5e-7 0 0", -1, 4, 0],
  ["end at epsilon skips P2→P3", "M 6 0 C 0 -4 -1e-6 0 0 0", -1, 0, 4],
  ["end above epsilon keeps P2→P3", "M 6 0 C 0 -4 -2e-6 0 0 0", -1, 1, 0],
  ["end skips both near-degenerate controls", "M -3 -4 C -1e-6 0 -5e-7 -5e-7 0 0", -1, 3, 4],
]) {
  assertFrame(sampler.samplePathData(pathData, endpointOptions).at(endpoint), dx, dy, name);
}
const degenerateCubic = sampler.samplePathData("M 2 3 C 2 3 2 3 2 3", endpointOptions);
assert.equal(degenerateCubic.length, 1);
assert.deepEqual([degenerateCubic[0].x, degenerateCubic[0].y, degenerateCubic[0].u], [2, 3, 0]);
assertFrame(degenerateCubic[0], 1, 0, "all-degenerate C preserves the existing fallback");

for (const pathData of [relativeRepeatedCubic,
  "M 0 0 C 0 4 6 4 6 0 6 -4 12 -4 12 0", separateCubics]) {
  const points = sampler.samplePathData(pathData, endpointOptions);
  assertFrame(points[0], 0, 1, "first actual cubic start");
  assertFrame(points.at(-1), 0, 1, "last actual cubic end, including repeated arguments");
}
const returningCubic = sampler.samplePathData("M 0 0 C 4 0 4 4 0 0",
  { spacing: Infinity, curveSteps: 1 });
assert.equal(returningCubic.length, 2);
assert.deepEqual([returningCubic[0].x, returningCubic[0].y],
  [returningCubic.at(-1).x, returningCubic.at(-1).y]);
assertFrame(returningCubic[0], 1, 0, "coincident C endpoints retain the start direction");
assertFrame(returningCubic.at(-1), -1, -1, "coincident C endpoints retain the end direction");
// Non-C endpoint frames retain their existing flattened-segment behavior.
// Empty or degenerate subpaths must not lend a cubic direction to another point.
for (const [name, pathData, endpoint, dx, dy] of [
  ["leading L", "M 0 0 L 2 0 C 2 4 6 4 6 0", 0, 1, 0],
  ["trailing L", `${ordinaryCubic} L 8 0`, -1, 1, 0],
  ["leading Q", "M 0 0 Q 0 4 4 4 C 6 4 8 4 8 0", 0, 1, 7],
  ["trailing Q", `${ordinaryCubic} Q 6 -4 10 -4`, -1, 7, -1],
  ["closing Z", `${ordinaryCubic} Z`, -1, -1, 0],
  ["leading duplicate L endpoint", "M 0 0 L 0 0 C 0 4 6 4 6 0", 0, 0, 1],
  ["trailing duplicate L endpoint", `${ordinaryCubic} L 6 0`, -1, 0, -1],
  ["leading empty subpath", "M 0 0 M 10 0 C 10 4 16 4 16 0", 0, 1, 0],
  ["trailing empty subpath", `${ordinaryCubic} M 20 20`, -1, 0, -1],
  ["leading degenerate subpath", "M 0 0 C 0 0 0 0 0 0 M 10 0 L 10 4", 0, 1, 0],
  ["trailing degenerate subpath", "M 0 0 L 0 4 M 10 4 C 10 4 10 4 10 4", -1, 0, 1],
]) {
  assertFrame(sampler.samplePathData(pathData, endpointOptions).at(endpoint), dx, dy,
    `${name} must use the segment at the sampled endpoint`);
}

const lineSamples = sampler.samplePathData("M 0 0 L 10 0", { spacing: 2 });
assert.equal(lineSamples[0].x, 0);
assert.equal(lineSamples[0].y, 0);
assert.equal(lineSamples.at(-1).x, 10);
assert.equal(lineSamples.at(-1).y, 0);
assert.ok(
  lineSamples.every(
    (point, index, points) => index === 0 || point.u >= points[index - 1].u
  )
);
assert.ok(Math.abs(lineSamples.at(-1).u - 10) < 0.001);
assert.ok(Math.abs(lineSamples[1].normalX) < 0.001);
assert.ok(Math.abs(Math.abs(lineSamples[1].normalY) - 1) < 0.001);

const constantsSource = read("src/constants.js");
for (const name of [
  "YARN_UV_TEXTURE_REPEAT_LENGTH",
  "YARN_UV_SAMPLE_SPACING",
  "YARN_UV_MAX_POINTS_PER_PATH",
]) {
  assert.match(
    constantsSource,
    new RegExp(`export const ${name}`),
    `constants.js must export ${name}.`
  );
}

const strip = await import("../src/simulation/yarnPathUvStrip.js");

const physicalLine = strip.buildYarnUvStrip({
  modelPathData: "M 0 0 L 10 0", arcLengthOffset: 7, yarnWidth: 4,
  machineGauge: 32, physicalRepeatLengthMm: 10,
});
assert.ok(Math.abs(physicalLine.uvs.at(-2) - 17 * 25.4 / 32 / 10) < 1e-6,
  "physical U must convert cumulative model length to mm using Gauge.");
const legacyOptions = { modelPathData: "M 0 0 C 1 3 2 -3 4 0 L 10 0",
  arcLengthOffset: 7, yarnWidth: 4, sampleSpacing: 0.03 };
const legacyUvs = strip.buildYarnUvStrip(legacyOptions).uvs;
for (const value of [undefined, null, 0, -1, NaN, "", Infinity, "12"]) {
  for (const machineGauge of [28, 32, 36]) {
    assert.deepEqual(strip.buildYarnUvStrip({ ...legacyOptions,
      physicalRepeatLengthMm: value, machineGauge }).uvs, legacyUvs,
    "missing/invalid metadata must preserve every legacy Float32 U exactly.");
  }
}
const physicalOptions = { ...legacyOptions, physicalRepeatLengthMm: 10, machineGauge: 32 };
const physicalUvs = strip.buildYarnUvStrip(physicalOptions).uvs;
for (const scale of [0.5, 1, 2, 4]) for (const flip of [-1, 1]) {
  assert.deepEqual(strip.buildYarnUvStrip({ ...physicalOptions,
    modelToCanvasPoint: point => ({ x: 120 + point.x * scale * flip,
      y: -90 + point.y * scale }), yarnWidth: 4 * scale }).uvs, physicalUvs,
  "display scale, DPR, pan and flip must leave physical U unchanged.");
}
assert.ok(Math.abs(strip.buildYarnUvStrip({ ...physicalOptions,
  modelPathData: "M 0 0 L 10 0", physicalRepeatLengthMm: 0.1 }).uvs.at(-2)
  - 17 * 25.4 / 32 / 0.1) < 1e-4, "small positive mm repeats must not be clamped to one model unit.");

const ribbon = strip.buildYarnUvStrip({
  pathData: "M 0 0 L 10 0",
  yarnWidth: 4,
  textureRepeatLength: 10,
  sampleSpacing: 2,
});

assert.ok(
  ribbon.positions.length >= 12,
  "ribbon must create left/right vertices."
);
assert.ok(ribbon.uvs.length >= 12, "ribbon must create uv pairs.");
assert.ok(ribbon.indices.length >= 6, "ribbon must create triangles.");
assert.equal(ribbon.uvs[1], 0);
assert.equal(ribbon.uvs[3], 1);
assert.ok(ribbon.uvs.at(-2) >= 1, "u coordinate must advance along the path.");

const modelLine = "M 0 0 L 10 0";
const projectedStrip = (scale, flipped = false) => strip.buildYarnUvStrip({
  pathData: `M 100 40 L ${100 + 10 * scale} 40`,
  modelPathData: modelLine,
  modelToCanvasPoint: point => ({
    x: 100 + point.x * scale * (flipped ? -1 : 1), y: 40 + point.y * scale,
  }),
  arcLengthOffset: 7,
  yarnWidth: 4,
  textureRepeatLength: 10,
  sampleSpacing: 2,
});
const modelStrip = projectedStrip(10);
assert.ok(Math.abs(modelStrip.uvs[0] - 0.7) < 1e-6,
  "a link must start at its cumulative model-space arc-length offset.");
assert.ok(Math.abs(modelStrip.uvs.at(-2) - 1.7) < 1e-6);
assert.equal(modelStrip.totalModelLength, 10);
assert.deepEqual(modelStrip.uvs, projectedStrip(20).uvs,
  "zoom and DPR may change positions, never model UV coordinates.");
assert.deepEqual(modelStrip.uvs, projectedStrip(10, true).uvs,
  "flipping display positions must preserve yarn UV coordinates.");
assert.notDeepEqual(modelStrip.positions, projectedStrip(20).positions);
assert.notDeepEqual(modelStrip.positions, projectedStrip(10, true).positions);
assert.equal(modelStrip.positions.at(-4), 200);
const capped = strip.buildYarnUvStrip({
  pathData: "M 0 0 L 1000 0", yarnWidth: 4, sampleSpacing: 1, maxPoints: 4,
});
assert.equal(capped.pointCount, 4);
assert.equal(capped.positions.at(-4), 1000,
  "the sample cap must resample the complete path, not discard its tail.");
assert.ok(Math.abs(capped.uvs.at(-2) - 1000 / 48) < 1e-5);
assert.equal(sampler.samplePathData("M 0 0 L 1 0 M 10 0 L 11 0").at(-1).u, 2,
  "move commands must not add fictitious yarn length between subpaths.");
assert.ok(sampler.samplePathData("M 0 0 C 4 0 4 4 0 0",
  { spacing: Infinity, curveSteps: 1 }).at(-1).u > 0,
  "length-only sampling must retain a curved path whose endpoints coincide.");
assert.equal(typeof strip.buildYarnUvPathOffsets, "function");
const server = await createServer({ appType: "custom", logLevel: "silent",
  server: { middlewareMode: true } });
try {
  const [{ Bimp }, { Pattern }, { ProcessModel }, { YarnModel },
    { buildYarnPathGeometry }, { solveFeedYarnLengths }] = await Promise.all([
    "/src/lib/Bimp.js", "/src/simulation/Pattern.js", "/src/simulation/ProcessModel.js",
    "/src/simulation/YarnModel.js", "/src/simulation/yarnPathGeometry.js",
    "/src/simulation/yarnLengthSolver.js",
  ].map(file => server.ssrLoadModule(file)));
  const makeGeometry = (pattern, width = 640) => {
    const stitchPattern = new Pattern(pattern.pad(1, 0, 0));
    return buildYarnPathGeometry({ pattern, stitchPattern,
      yarnGraph: new YarnModel(new ProcessModel(stitchPattern).cn),
      canvasWidth: width, canvasHeight: width * 0.75, primaryLengthScaleY: 1,
      primaryYarnDiameter: 0.24, machineGauge: 32 });
  };
  const projectPoint = geometry => point => {
    const coordinates = geometry.modelPathToCanvas(`M ${point.x} ${point.y}`)
      .match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number);
    return { x: coordinates[0], y: coordinates[1] };
  };
  const base = makeGeometry(Bimp.empty(12, 2, 0));
  const enlarged = makeGeometry(Bimp.empty(12, 2, 0), 1280);
  assert.deepEqual(base.modelPathByLink, enlarged.modelPathByLink);
  const offsets = strip.buildYarnUvPathOffsets(base.yarnPathLinks, base.modelPathByLink);
  let previousU = 0, previousPhysicalU = 0;
  for (const link of base.yarnPathLinks) {
    const makeStrip = geometry => strip.buildYarnUvStrip({
      pathData: geometry.resolvedPathByLink.get(link.index),
      modelPathData: geometry.modelPathByLink.get(link.index),
      modelToCanvasPoint: projectPoint(geometry), arcLengthOffset: offsets.get(link.index),
      yarnWidth: geometry.stitchWidth * 0.24, sampleSpacing: 0.03,
    });
    const actual = makeStrip(base);
    assert.ok(Math.abs(actual.uvs[0] - previousU) < 1e-6,
      `link ${link.index} must continue U across loops and front/back layers.`);
    assert.deepEqual(actual.uvs, makeStrip(enlarged).uvs);
    previousU = actual.uvs.at(-2);
    const physical = strip.buildYarnUvStrip({
      modelPathData: base.modelPathByLink.get(link.index),
      arcLengthOffset: offsets.get(link.index), yarnWidth: 4,
      physicalRepeatLengthMm: 10, machineGauge: 32, sampleSpacing: 0.03,
    });
    assert.equal(physical.uvs[0], previousPhysicalU,
      `physical U must continue across link ${link.index}, loops and layers.`);
    previousPhysicalU = physical.uvs.at(-2);
  }
  assert.ok(Math.abs(previousU * 48 - base.modelPathArcLength.totalModelLength) < 1e-4,
    "UV length must agree with the geometry's independently integrated model length.");
  const solverBase = makeGeometry(Bimp.empty(12, 1, 0));
  const evaluate = solverBase.createModelLengthEvaluator();
  const solverUvEnds = [];
  const solverHeights = [];
  for (const cm of [21, 23, 27]) {
    const [result] = solveFeedYarnLengths({
      feeds: [{ yarns: [{ yarnId: "primary", yarnLengthCmPer100Needles: cm }] }],
      gauge: 32, buildGeometry: evaluate,
    });
    assert.equal(result.converged, true);
    const solvedOffsets = strip.buildYarnUvPathOffsets(solverBase.yarnPathLinks,
      result.solvedPathByLink);
    let endU = 0;
    for (const link of solverBase.yarnPathLinks) {
      const actual = strip.buildYarnUvStrip({
        modelPathData: result.solvedPathByLink.get(link.index),
        modelToCanvasPoint: projectPoint(solverBase),
        arcLengthOffset: solvedOffsets.get(link.index), yarnWidth: 4, sampleSpacing: 0.03,
      });
      assert.ok(Math.abs(actual.uvs[0] - endU) < 1e-6,
        `${cm} cm geometry must retain continuous U between links.`);
      endU = actual.uvs.at(-2);
    }
    assert.ok(Math.abs(endU * 48 - evaluate(result.solvedLoopHeight)
      .modelPathArcLength.totalModelLength) < 1e-4);
    solverUvEnds.push(endU);
    solverHeights.push(result.solvedLoopHeight);
  }
  for (let index = 1; index < solverUvEnds.length; index++) {
    assert.ok(solverUvEnds[index] > solverUvEnds[index - 1],
      "21/23/27 cm Solver geometry must advance accumulated U as yarn length grows.");
    assert.ok(solverHeights[index] > solverHeights[index - 1]);
  }
  // Measure an actual 100-needle interior window, including outgoing wrap links.
  // Three copies supply curve neighbours without counting finite-row edge extras.
  for (const [machineGauge, cm] of [[28, 23], [32, 23], [36, 23], [32, 21], [32, 27]]) {
    const pattern = Bimp.empty(300, 1, 0);
    const stitchPattern = new Pattern(pattern.pad(1, 0, 0));
    const yarnGraph = new YarnModel(new ProcessModel(stitchPattern).cn);
    const periodic = buildYarnPathGeometry({ pattern, stitchPattern, yarnGraph,
      canvasWidth: 640, canvasHeight: 480, primaryLengthScaleY: 1,
      primaryYarnDiameter: 0.24, machineGauge, includeSummaryMetrics: false,
      includeDisplayPaths: false, measurementWindow: { firstNeedle: 101, needleCount: 100 } });
    const [result] = solveFeedYarnLengths({ gauge: machineGauge,
      feeds: [{ yarns: [{ yarnId: "primary", yarnLengthCmPer100Needles: cm }] }],
      buildGeometry: periodic.createModelLengthEvaluator() });
    assert.equal(result.converged, true);
    const solvedOffsets = strip.buildYarnUvPathOffsets(periodic.yarnPathLinks, result.solvedPathByLink);
    let repeats = 0, lastU = 0, countedLinks = 0;
    for (const link of periodic.yarnPathLinks) {
      const actual = strip.buildYarnUvStrip({
        modelPathData: result.solvedPathByLink.get(link.index),
        arcLengthOffset: solvedOffsets.get(link.index), yarnWidth: 4,
        machineGauge, physicalRepeatLengthMm: 10, sampleSpacing: Infinity,
      });
      assert.equal(actual.uvs[0], lastU, "solved physical U stays continuous across every link.");
      lastU = actual.uvs.at(-2);
      const needle = Math.floor(yarnGraph.yarnPath[link.index][0] / 2);
      if (needle >= 101 && needle < 201) {
        repeats += actual.uvs.at(-2) - actual.uvs[0];
        countedLinks++;
      }
    }
    assert.ok(countedLinks > 100);
    assert.ok(Math.abs(repeats - cm) < 0.005,
      `${machineGauge}G ${cm}cm/100 needles should produce ${cm} repeats, got ${repeats}.`);
    console.log(`PHYSICAL: ${machineGauge}G, ${cm}cm/100 needles, 10mm => ${repeats.toFixed(6)} repeats`);
  }
} finally { await server.close(); }

const rendererSource = read("src/simulation/yarnUvWebglRenderer.js");
assert.match(
  rendererSource,
  /attribute\s+vec2\s+a_position/,
  "vertex shader must accept positions."
);
assert.match(
  rendererSource,
  /attribute\s+vec2\s+a_uv/,
  "vertex shader must accept UV coordinates."
);
assert.match(
  rendererSource,
  /uniform\s+sampler2D\s+u_baseColorMap/,
  "fragment shader must sample base color."
);
assert.match(
  rendererSource,
  /uniform\s+sampler2D\s+u_normalMap/,
  "fragment shader must reserve normal map sampling."
);
assert.match(
  rendererSource,
  /drawElements/,
  "renderer must draw indexed ribbon triangles."
);
assert.match(
  rendererSource,
  /getWebglYarnRenderer/,
  "renderer must expose a cached factory."
);

const simulationSource = [
  "src/simulation/yarnSimulation.js",
  "src/simulation/pbrPreviewRenderer.js",
  "src/simulation/yarnPathGeometry.js",
  "src/simulation/drawYarnSimulation.js",
]
  .map(read)
  .join("\n");
assert.match(
  simulationSource,
  /buildYarnUvStrip/,
  "simulation must build UV strips."
);
assert.match(
  simulationSource,
  /getWebglYarnRenderer/,
  "simulation must use WebGL renderer factory."
);
assert.match(
  simulationSource,
  /renderUvTextures/,
  "simulation must gate UV rendering behind a named boolean."
);
assert.match(
  simulationSource,
  /drawSegmentsToLayerFallback/,
  "simulation must preserve Canvas fallback drawing."
);
assert.match(
  simulationSource,
  /texturePreviewInteractionActive/,
  "UV preview must respect interaction-active downgrades."
);
assert.match(
  simulationSource,
  /TEXTURE_PERFORMANCE_MODES\.SOLID/,
  "Solid mode must bypass UV texture rendering."
);

const leftBarSource = read("src/views/yarnPlyPanel.js");
for (const key of [
  "baseColor",
  "normal",
  "roughness",
  "height",
  "ambientOcclusion",
]) {
  assert.match(
    leftBarSource,
    new RegExp(`pbrMap-${key}`),
    `left bar must expose ${key} map import control.`
  );
}

const translationsSource = read("src/i18n/translations.js");
for (const key of [
  "yarnTexture.pbrBaseColor",
  "yarnTexture.pbrNormal",
  "yarnTexture.pbrRoughness",
  "yarnTexture.pbrHeight",
  "yarnTexture.pbrAmbientOcclusion",
]) {
  assert.match(
    translationsSource,
    new RegExp(`"${key}"`),
    `translations must include ${key}.`
  );
}

console.log("PASS: path UV yarn texture checks passed.");
