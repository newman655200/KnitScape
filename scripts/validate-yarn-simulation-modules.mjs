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
assert.match(orchestrator, /buildYarnPathGeometry/);
assert.match(orchestrator, /drawYarnSimulation/);
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
  "rowYarnPly",
  "drawSegmentsToLayerFallback",
  "drawSegmentsToLayerUv",
  "drawYarnSimulation",
]) {
  assert.match(drawing, new RegExp(symbol));
}

console.log("PASS: yarn simulation responsibilities are separated.");
