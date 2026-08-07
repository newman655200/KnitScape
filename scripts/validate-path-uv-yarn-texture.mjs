import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

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

const leftBarSource = read("src/views/leftBar.js");
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
