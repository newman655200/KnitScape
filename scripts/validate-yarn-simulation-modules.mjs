import assert from "node:assert/strict";
import fs from "node:fs";

const exists = (file) => fs.existsSync(file);
const read = (file) => fs.readFileSync(file, "utf8");

assert.ok(
  exists("src/simulation/yarnPathGeometry.js"),
  "path geometry must live in its own module."
);
assert.ok(
  exists("src/simulation/drawYarnSimulation.js"),
  "canvas drawing must live in its own module."
);

const orchestrator = read("src/simulation/yarnSimulation.js");
assert.match(orchestrator, /computeYarnSimulation/);
const computation = read("src/simulation/computeYarnSimulation.js");
assert.match(computation, /buildYarnPathGeometry/);
assert.doesNotMatch(computation, /\b(?:document|window|devicePixelRatio|Image|WebGLRenderingContext)\b/);
assert.doesNotMatch(computation, /(?:yarnTextureBrush|drawYarnSimulation|yarnUvWebglRenderer)/);
assert.match(orchestrator, /createPbrPreviewRenderer/);
const pbrPreview = read("src/simulation/pbrPreviewRenderer.js");
assert.match(pbrPreview, /drawYarnSimulation/);
assert.doesNotMatch(pbrPreview, /computeYarnSimulation|solveFeedYarnLengths|GLOBAL_STATE/);
assert.doesNotMatch(orchestrator, /function layoutNodes/);
assert.doesNotMatch(orchestrator, /function drawSegmentsToLayerUv/);
assert.doesNotMatch(orchestrator, /function buildYarnLengthMetrics/);

const geometry = read("src/simulation/yarnPathGeometry.js");
for (const symbol of [
  "layoutNodes",
  "updateNormals",
  "buildResolvedPathMap",
  "buildYarnLengthMetrics",
]) {
  assert.match(geometry, new RegExp(symbol));
}

const drawing = read("src/simulation/drawYarnSimulation.js");
for (const symbol of [
  "drawSegmentsToLayerFallback",
  "drawSegmentsToLayerUv",
  "drawYarnSimulation",
]) {
  assert.match(drawing, new RegExp(symbol));
}

const items = read("src/simulation/yarnRenderItems.js");
assert.match(items, /rowYarnPly/);
assert.match(drawing, /resolveYarnRenderItems/);
assert.doesNotMatch(drawing, /function rowYarnPly/);

console.log("PASS: yarn simulation responsibilities are separated.");
