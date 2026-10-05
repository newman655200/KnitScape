import assert from "node:assert/strict";
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
  let previousU = 0;
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
