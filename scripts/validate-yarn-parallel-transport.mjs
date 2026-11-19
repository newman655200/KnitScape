import assert from "node:assert/strict";
import fs from "node:fs";

// TEST_ONLY frame geometry, declared mm, analytically constructed and uncalibrated.
const moduleUrl = new URL("../src/simulation/yarnParallelTransport.js", import.meta.url);
assert.ok(fs.existsSync(moduleUrl), "parallel transport module must exist");
const { buildParallelTransportFrames } = await import(moduleUrl);
const { buildSpatialPath } = await import("../src/simulation/yarnSpatialPath.js");
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const ok = value => { assert.equal(value.status, "OK", JSON.stringify(value.diagnostics)); return value; };
const checked = config => {
  const path = ok(buildSpatialPath({ unit: "mm", ...config }, { sampleCount: 257 }));
  const result = ok(buildParallelTransportFrames(path));
  assert.equal(result.frames.length, path.points.length);
  let maxError = 0, minNormalDot = 1;
  result.frames.forEach((frame, i) => {
    const { tangent: t, normal: n, binormal: b } = frame;
    const error = Math.max(Math.abs(Math.hypot(...t) - 1), Math.abs(Math.hypot(...n) - 1),
      Math.abs(Math.hypot(...b) - 1), Math.abs(dot(t, n)), Math.abs(dot(t, b)), Math.abs(dot(n, b)),
      distance(cross(t, n), b), distance(t, path.tangents[i]));
    maxError = Math.max(maxError, error);
    if (i) minNormalDot = Math.min(minNormalDot, dot(n, result.frames[i - 1].normal));
  });
  assert.ok(maxError < 1e-12, `orthonormal error ${maxError}`);
  assert.ok(minNormalDot > 0.8, `unexpected normal flip ${minNormalDot}`);
  assert.deepEqual(buildParallelTransportFrames(path), result, "transport is deterministic");
  return { path, result, maxError, minNormalDot };
};
const straight = checked({ type: "line", points: [[0, 0, 0], [0, 0, 10]] });
for (const frame of straight.result.frames) assert.deepEqual(frame.normal, straight.result.frames[0].normal);
const inflection = checked({ type: "catmull-rom", points: [[0, 0, 0], [1, 1, 0], [2, 0, 0], [3, -1, 0], [4, 0, 0]] });
const helix = checked({ type: "helix", radius: 2, turns: 2.5, pitch: 1 });
const circle = checked({ type: "circle", radius: 2 });
const closed = checked({ type: "catmull-rom", closed: true,
  points: [[0, 0, 0], [4, 0, 1], [4, 3, -0.7], [1, 4, 2], [-1, 2, -1]] });
for (const fixture of [circle, closed]) {
  assert.ok(distance(fixture.result.frames[0].normal, fixture.result.frames.at(-1).normal) < 1e-12);
  assert.ok(distance(fixture.result.frames[0].binormal, fixture.result.frames.at(-1).binormal) < 1e-12);
  assert.ok(fixture.result.diagnostics.some(item => item.code === "CLOSED_SEAM_CORRECTED"));
}

const manual = tangents => ({ status: "OK", unit: "mm", closed: false,
  points: tangents.map((_, i) => [i, 0, 0]), tangents,
  cumulativeLengths: tangents.map((_, i) => i), totalLength: tangents.length - 1, diagnostics: [] });
const hugeFinite = ok(buildParallelTransportFrames(manual([[1.1e308, 1.1e308, 1.1e308], [1.1e308, 1.1e308, 1.1e308]])));
for (const frame of hugeFinite.frames) {
  for (const vector of [frame.tangent, frame.normal, frame.binormal]) {
    assert.ok(vector.every(Number.isFinite), "finite extreme inputs may not publish nonfinite frames");
    assert.ok(Math.abs(Math.hypot(...vector) - 1) < 1e-12, "finite extreme inputs still require unit frame vectors");
  }
}
const nearParallel = ok(buildParallelTransportFrames(manual([[1, 0, 0], [1, 1e-13, 0], [1, 2e-13, 0]])));
assert.ok(distance(nearParallel.frames[0].normal, nearParallel.frames.at(-1).normal) < 1e-10);
const almostOpposite = [-Math.cos(1e-5), Math.sin(1e-5), 0];
const reversal = ok(buildParallelTransportFrames(manual([[1, 0, 0], almostOpposite])));
assert.ok(reversal.diagnostics.some(item => item.code === "LARGE_TANGENT_TURN"));
assert.ok(distance(cross(reversal.frames[1].tangent, reversal.frames[1].normal), reversal.frames[1].binormal) < 1e-12);
assert.deepEqual(buildParallelTransportFrames(manual([[1, 0, 0], almostOpposite])), reversal);
const antiparallel = buildParallelTransportFrames(manual([[1, 0, 0], [-1, 0, 0]]));
assert.equal(antiparallel.status, "INVALID");
assert.ok(antiparallel.diagnostics.some(item => item.code === "ANTIPARALLEL_TANGENTS"));
for (const tangents of [[[0, 0, 0], [1, 0, 0]], [[NaN, 0, 0], [1, 0, 0]], [[Infinity, 0, 0], [1, 0, 0]]]) {
  assert.equal(buildParallelTransportFrames(manual(tangents)).status, "INVALID");
}
assert.equal(buildParallelTransportFrames({ ...straight.path, points: [] }).status, "INVALID");
assert.equal(buildParallelTransportFrames({ ...straight.path, closed: true }).status, "INVALID");
assert.equal(buildParallelTransportFrames({ ...straight.path, totalLength: 20 }).status, "INVALID");
console.log(JSON.stringify({ validator: "yarn-parallel-transport", status: "PASS",
  fixtures: { straight: straight.maxError, inflection: inflection.maxError, helix: helix.maxError,
    circle: circle.maxError, closedSpline: closed.maxError }, minNormalDot: helix.minNormalDot,
  closedSeamNormalError: distance(closed.result.frames[0].normal, closed.result.frames.at(-1).normal),
  seamCorrection: closed.result.diagnostics.find(item => item.code === "CLOSED_SEAM_CORRECTED"),
  antiparallelStatus: antiparallel.status }));
