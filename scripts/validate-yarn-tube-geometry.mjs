import assert from "node:assert/strict";
import fs from "node:fs";

// TEST_ONLY radii (mm) and UV repeats: analytical construction, numerical
// verification only, synthetic state; these are not measured physical diameters.
const moduleUrl = new URL("../src/simulation/yarnTubeGeometry.js", import.meta.url);
assert.ok(fs.existsSync(moduleUrl), "tube geometry module must exist");
const { buildYarnTubeGeometry } = await import(moduleUrl);
const { buildSpatialPath } = await import("../src/simulation/yarnSpatialPath.js");
const { buildParallelTransportFrames } = await import("../src/simulation/yarnParallelTransport.js");
const ok = value => { assert.equal(value.status, "OK", JSON.stringify(value.diagnostics)); return value; };
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vec = (array, i) => Array.from(array.slice(i * 3, i * 3 + 3));
const near = (a, b, tolerance = 2e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const path = ok(buildSpatialPath({ type: "line", unit: "mm", points: [[0, 0, 0], [0, 0, 10]] }, { sampleCount: 11 }));
const frames = ok(buildParallelTransportFrames(path));
const config = { path, frames, radiusA: 0.4, radiusB: 0.2, radialSegments: 32, capEnds: false, uvRepeatLength: 2 };
const mesh = ok(buildYarnTubeGeometry(config));
assert.ok(mesh.positions instanceof Float32Array);
assert.ok(mesh.normals instanceof Float32Array);
assert.ok(mesh.tangents instanceof Float32Array);
assert.ok(mesh.uv instanceof Float32Array);
assert.ok(mesh.indices instanceof Uint32Array || mesh.indices instanceof Uint16Array);
assert.equal(mesh.counts.vertices, 11 * 33);
assert.equal(mesh.counts.triangles, 10 * 32 * 2);
assert.equal(mesh.positions.length, mesh.counts.vertices * 3);
assert.equal(mesh.normals.length, mesh.positions.length);
assert.equal(mesh.tangents.length, mesh.positions.length);
assert.equal(mesh.uv.length, mesh.counts.vertices * 2);
assert.equal(mesh.indices.length, mesh.counts.triangles * 3);
for (const array of [mesh.positions, mesh.normals, mesh.tangents, mesh.uv]) assert.ok(array.every(Number.isFinite));
near(mesh.bounds.min[0], -0.4); near(mesh.bounds.max[0], 0.4);
near(mesh.bounds.min[1], -0.2); near(mesh.bounds.max[1], 0.2);
near(mesh.bounds.min[2], 0); near(mesh.bounds.max[2], 10);
assert.equal(mesh.unit, "mm");
for (let i = 0; i < path.points.length; i++) {
  const first = i * 33, last = first + 32;
  near(Math.hypot(...sub(vec(mesh.positions, first), vec(mesh.positions, last))), 0);
  near(Math.hypot(...sub(vec(mesh.normals, first), vec(mesh.normals, last))), 0);
  near(mesh.uv[first * 2], path.cumulativeLengths[i] / 2);
  near(mesh.uv[last * 2], path.cumulativeLengths[i] / 2);
  near(mesh.uv[first * 2 + 1], 0); near(mesh.uv[last * 2 + 1], 1);
}
assert.ok(Math.abs(mesh.uv[4 * 2 + 1] - 4 / 32) > 0.01, "ellipse v tracks circumference distance, not angle fraction");
for (let i = 0; i < mesh.counts.vertices; i++) {
  const p = vec(mesh.positions, i), n = vec(mesh.normals, i), t = vec(mesh.tangents, i);
  const gradient = [p[0] / 0.4 ** 2, p[1] / 0.2 ** 2, 0];
  near(dot(n, gradient) / Math.hypot(...gradient), 1);
  near(Math.hypot(...n), 1); near(Math.hypot(...t), 1); near(dot(n, t), 0);
}
function inspectTriangles(value) {
  let minDoubleArea = Infinity, minWindingDot = Infinity;
  for (let i = 0; i < value.indices.length; i += 3) {
    const [a, b, c] = value.indices.slice(i, i + 3);
    assert.ok(a < value.counts.vertices && b < value.counts.vertices && c < value.counts.vertices);
    assert.ok(a !== b && b !== c && c !== a);
    const normal = cross(sub(vec(value.positions, b), vec(value.positions, a)), sub(vec(value.positions, c), vec(value.positions, a)));
    const area = Math.hypot(...normal);
    const average = vec(value.normals, a).map((v, axis) => v + vec(value.normals, b)[axis] + vec(value.normals, c)[axis]);
    const winding = dot(normal, average) / (area * Math.hypot(...average));
    minDoubleArea = Math.min(minDoubleArea, area); minWindingDot = Math.min(minWindingDot, winding);
    assert.ok(area > 1e-10, `degenerate triangle ${i / 3}`);
    assert.ok(winding > 0.5, `inward triangle ${i / 3}: ${winding}`);
  }
  return { minDoubleArea, minWindingDot };
}
const openTriangles = inspectTriangles(mesh);
const capped = ok(buildYarnTubeGeometry({ ...config, capEnds: true }));
const capTriangles = inspectTriangles(capped);
assert.equal(capped.counts.triangles, mesh.counts.triangles + 64);
function weldedEdges(value) {
  const vertices = new Map(), weld = [];
  for (let i = 0; i < value.counts.vertices; i++) {
    const key = vec(value.positions, i).map(v => Math.round(v * 1e5)).join(",");
    if (!vertices.has(key)) vertices.set(key, vertices.size);
    weld[i] = vertices.get(key);
  }
  const edges = new Map();
  for (let i = 0; i < value.indices.length; i += 3) {
    const tri = Array.from(value.indices.slice(i, i + 3), index => weld[index]);
    for (let j = 0; j < 3; j++) {
      const key = [tri[j], tri[(j + 1) % 3]].sort((a, b) => a - b).join(":");
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  return [...edges.values()];
}
assert.equal(weldedEdges(mesh).filter(count => count === 1).length, 64);
assert.ok(weldedEdges(capped).every(count => count === 2), "closed capped tube is manifold after UV/normal seam welding");
const closedPath = ok(buildSpatialPath({ type: "circle", unit: "mm", radius: 3 }, { sampleCount: 129 }));
const torus = ok(buildYarnTubeGeometry({ ...config, path: closedPath, frames: ok(buildParallelTransportFrames(closedPath)), radiusB: 0.4 }));
const torusTriangles = inspectTriangles(torus);
assert.ok(weldedEdges(torus).every(count => count === 2));
assert.ok(torus.diagnostics.some(item => item.code === "GLOBAL_SELF_INTERSECTION_NOT_EVALUATED"));
const helixPath = ok(buildSpatialPath({ type: "helix", unit: "mm", radius: 3, pitch: 2, turns: 2 }, { sampleCount: 193 }));
const helixMesh = ok(buildYarnTubeGeometry({ ...config, path: helixPath, frames: buildParallelTransportFrames(helixPath),
  radiusA: 0.28, radiusB: 0.14, capEnds: true }));
const helixTriangles = inspectTriangles(helixMesh);
assert.ok(weldedEdges(helixMesh).every(count => count === 2));
const closedSpline = ok(buildSpatialPath({ type: "catmull-rom", closed: true, unit: "mm",
  points: [[0, 0, 0], [4, 0, 1], [4, 3, -0.7], [1, 4, 2], [-1, 2, -1]] }, { sampleCount: 257 }));
const twistedEllipse = ok(buildYarnTubeGeometry({ ...config, path: closedSpline, frames: buildParallelTransportFrames(closedSpline),
  radiusA: 0.08, radiusB: 0.04 }));
inspectTriangles(twistedEllipse);
assert.ok(weldedEdges(twistedEllipse).every(count => count === 2));
for (const change of [{ radiusA: 0 }, { radiusB: NaN }, { radiusA: -1 }, { radiusB: Infinity },
  { radialSegments: 2 }, { radialSegments: 5.5 }, { uvRepeatLength: 0 }, { uvRepeatLength: Infinity },
  { frames: [] }, { path: { ...path, unit: "px" } }]) {
  assert.equal(buildYarnTubeGeometry({ ...config, ...change }).status, "INVALID");
}
const folded = buildYarnTubeGeometry({ ...config, path: closedPath, frames: buildParallelTransportFrames(closedPath), radiusA: 4, radiusB: 4 });
assert.equal(folded.status, "INVALID");
assert.ok(folded.diagnostics.some(item => item.code === "LOCAL_TUBE_FOLD"));
const badFrames = frames.frames.map(frame => ({ ...frame, normal: [0, 0, 0] }));
assert.equal(buildYarnTubeGeometry({ ...config, frames: badFrames }).status, "INVALID");
console.log(JSON.stringify({ validator: "yarn-tube-geometry", status: "PASS", open: mesh.counts,
  capped: capped.counts, torus: torus.counts, bounds: mesh.bounds, openTriangles, capTriangles, torusTriangles,
  helixTriangles, ellipseEighthCircumferenceV: mesh.uv[4 * 2 + 1], maxU: mesh.uv.at(-2), localFoldStatus: folded.status }));
