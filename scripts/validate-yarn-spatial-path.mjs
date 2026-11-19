import assert from "node:assert/strict";
import fs from "node:fs";

// TEST_ONLY: XYZ controls in mm/cm/m, analytically constructed, mathematical
// confidence only; unloaded synthetic geometry, never measured yarn properties.
const moduleUrl = new URL("../src/simulation/yarnSpatialPath.js", import.meta.url);
assert.ok(fs.existsSync(moduleUrl), "spatial path module must exist");
const { createSpatialCurve, buildSpatialPath } = await import(moduleUrl);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${actual} differs from ${expected} by more than ${tolerance}`);
const ok = value => { assert.equal(value.status, "OK", JSON.stringify(value.diagnostics)); return value; };
const invalid = value => { assert.equal(value.status, "INVALID"); assert.ok(value.diagnostics.length); };

const lineConfig = { type: "line", points: [[1, 2, 3], [4, 6, 15]], unit: "mm" };
const lineCurve = ok(createSpatialCurve(lineConfig)).curve;
assert.deepEqual(lineCurve.point(0), [1, 2, 3]);
assert.deepEqual(lineCurve.point(1), [4, 6, 15]);
assert.deepEqual(lineCurve.derivative(0.4), [3, 4, 12]);
const line = ok(buildSpatialPath(lineConfig, { sampleCount: 14 }));
assert.equal(line.points.length, 14);
near(line.totalLength, 13);
line.points.forEach((point, i) => {
  near(line.cumulativeLengths[i], i);
  near(distance(point, line.points[0]), i);
  near(Math.hypot(...line.tangents[i]), 1);
});
assert.equal(line.unit, "mm");
assert.equal(line.closed, false);
assert.equal("document" in globalThis, false);
const subnormalLine = ok(buildSpatialPath({ type: "line", unit: "mm", points: [[0, 0, 0], [1e-310, 0, 0]] }, { sampleCount: 2 }));
assert.ok(subnormalLine.tangents.flat().every(Number.isFinite), "subnormal finite XYZ may not publish nonfinite tangents");
assert.deepEqual(subnormalLine.tangents[0], [1, 0, 0]);
const largeLine = ok(buildSpatialPath({ type: "line", unit: "mm", points: [[0, 0, 0], [1e307, 0, 0]] }, { sampleCount: 19 }));
assert.ok(largeLine.cumulativeLengths.every(Number.isFinite), "finite total length must not publish overflowing cumulative samples");
assert.ok(largeLine.parameters.every(Number.isFinite));
assert.ok(largeLine.cumulativeLengths.every((length, i, lengths) => !i || length > lengths[i - 1]));
assert.equal(largeLine.cumulativeLengths.at(-1), largeLine.totalLength);
assert.equal(largeLine.parameters.at(-1), 1);
const inputSnapshot = structuredClone(lineConfig);
lineConfig.points[0][0] = 900;
assert.deepEqual(lineCurve.point(0), inputSnapshot.points[0], "curves own copies of control points");

const arc = ok(buildSpatialPath({ type: "circle", center: [3, -2, 4], radius: 2,
  angle: Math.PI / 2, unit: "cm" }, { sampleCount: 25 }));
near(arc.totalLength, Math.PI);
near(distance(arc.points[0], [5, -2, 4]), 0);
near(distance(arc.points.at(-1), [3, 0, 4]), 0);
near(arc.parameters[12], 0.5);
assert.equal(arc.unit, "cm");

const circle = ok(buildSpatialPath({ type: "circle", center: [0, 0, 0], radius: 3,
  unit: "mm" }, { sampleCount: 65 }));
assert.equal(circle.closed, true);
near(distance(circle.points[0], circle.points.at(-1)), 0);
near(distance(circle.tangents[0], circle.tangents.at(-1)), 0);
assert.equal(circle.parameters.at(-1), 1);
assert.ok(circle.cumulativeLengths.at(-1) > circle.cumulativeLengths.at(-2));
const tinyArcConfig = { type: "circle", radius: 1, angle: 1e-13, unit: "mm" };
const tinyArc = ok(buildSpatialPath(tinyArcConfig, { sampleCount: 5 }));
assert.equal(tinyArc.closed, false, "an angle near zero is not a completed turn");
assert.ok(tinyArc.points.at(-1)[1] > 0);
invalid(createSpatialCurve({ ...tinyArcConfig, closed: true }));
const hugePhase = ok(buildSpatialPath({ type: "circle", radius: 1, startAngle: 1e20, unit: "mm" }, { sampleCount: 5 }));
near(distance(hugePhase.points[0], [Math.cos(1e20), Math.sin(1e20), 0]), 0);
assert.ok(distance(hugePhase.points[0], hugePhase.points[1]) > 1, "local angular increments must survive a huge finite starting phase");
assert.equal(buildSpatialPath({ type: "polyline", unit: "mm", points: [[0, 0, 0], [1e16, 0, 0], [1e16, 1, 0]] },
  { sampleCount: 5 }).status, "INVALID", "a positive segment that disappears from cumulative length must fail explicitly");

const controls = [[0, 0, 0], [0.2, 2, 0.5], [3.5, -1, 2], [4, 1, 3], [8, 0, 4]];
const spline = ok(createSpatialCurve({ type: "catmull-rom", points: controls, unit: "mm" })).curve;
controls.forEach((point, i) => near(distance(spline.point(i / (controls.length - 1)), point), 0));
for (let i = 1; i < spline.segments.length; i++) {
  near(distance(spline.segments[i - 1].point(1), spline.segments[i].point(0)), 0);
  near(distance(spline.segments[i - 1].derivative(1), spline.segments[i].derivative(0)), 0);
}
const sPath = ok(buildSpatialPath(spline, { sampleCount: 161 }));
const step = sPath.totalLength / 160;
for (let i = 1; i < sPath.points.length; i++) near(sPath.cumulativeLengths[i] - sPath.cumulativeLengths[i - 1], step, 1e-7);
let maxResamplingError = 0;
for (let i = 1; i < sPath.points.length; i++) {
  let actualLength = 0;
  const width = (sPath.parameters[i] - sPath.parameters[i - 1]) / 200;
  for (let j = 0; j < 200; j++) actualLength += Math.hypot(...spline.derivative(sPath.parameters[i - 1] + (j + 0.5) * width)) * width;
  maxResamplingError = Math.max(maxResamplingError, Math.abs(actualLength - step));
}
assert.ok(maxResamplingError < 2e-7, `independent interval arc-length error ${maxResamplingError}`);
assert.equal(sPath.continuity?.positionContinuous, true);
assert.equal(sPath.continuity?.tangentContinuous, true);
assert.ok(sPath.parameters[40] < 0.4 && sPath.parameters[40] > 0.15);
assert.ok(sPath.points.some(point => Math.abs(point[2]) > 1));
const closedSpline = ok(buildSpatialPath({ type: "catmull-rom", unit: "m", closed: true,
  points: [[0, 0, 0], [2, 0, 1], [2, 2, 0], [0, 2, -1], [0, 0, 0]] }, { sampleCount: 65 }));
assert.ok(closedSpline.diagnostics.some(item => item.code === "DUPLICATE_CLOSURE_REMOVED"));
near(distance(closedSpline.points[0], closedSpline.points.at(-1)), 0);
near(distance(closedSpline.tangents[0], closedSpline.tangents.at(-1)), 0);

const corner = ok(buildSpatialPath({ type: "polyline", unit: "mm",
  points: [[0, 0, 0], [1, 0, 0], [1, 2, 0]] }, { sampleCount: 13 }));
near(corner.totalLength, 3);
assert.ok(corner.diagnostics.some(item => item.code === "TANGENT_DISCONTINUITY"));
assert.equal(corner.continuity?.tangentContinuous, false);
for (const config of [
  {}, { ...inputSnapshot, unit: "px" }, { ...inputSnapshot, unit: undefined },
  { ...inputSnapshot, points: [[0, 0], [1, 2, 3]] },
  { ...inputSnapshot, points: [[0, 0, 0], [0, 0, 0]] },
  { ...inputSnapshot, points: [[0, 0, 0], [NaN, 0, 0]] },
  { ...inputSnapshot, points: [[0, 0, 0], [Infinity, 0, 0]] },
  { type: "catmull-rom", unit: "mm", points: [[0, 0, 0], [1, 0, 0], [1, 0, 0]] },
  { type: "circle", unit: "mm", radius: 0 },
  { type: "circle", unit: "mm", radius: 1, angle: 0 },
  { type: "circle", unit: "mm", radius: 1, angle: Math.PI, closed: true },
  { type: "helix", unit: "mm", radius: 1, turns: NaN, pitch: 2 },
  { type: "helix", unit: "mm", radius: 1, turns: 2, pitch: Infinity },
]) invalid(createSpatialCurve(config));
for (const sampleCount of [0, 1, 2.5, NaN, Infinity]) invalid(buildSpatialPath(inputSnapshot, { sampleCount }));
invalid(buildSpatialPath({ type: "catmull-rom", unit: "mm",
  points: [[0, 0, 0], [1, 0, 0], [0, 0, 0]] }, { sampleCount: 32 }));
invalid(buildSpatialPath({ type: "polyline", unit: "mm",
  points: [[0, 0, 0], [1, 0, 0], [0, 0, 0]] }, { sampleCount: 33 }));

console.log(JSON.stringify({ validator: "yarn-spatial-path", status: "PASS", lineLength: line.totalLength,
  arcLength: arc.totalLength, closedLength: circle.totalLength, sCurveLength: sPath.totalLength,
  equalArcStep: step, maxResamplingError, nonuniformParameterAtQuarter: sPath.parameters[40], units: [line.unit, arc.unit, closedSpline.unit] }));
