import assert from "node:assert/strict";
import fs from "node:fs";

// TEST_ONLY analytic geometry in declared units; no process/measurement authority.
const moduleUrl = new URL("../src/simulation/yarnSpatialLength.js", import.meta.url);
assert.ok(fs.existsSync(moduleUrl), "spatial length module must exist");
const { measureSpatialLength, integrateSpatialSegment } = await import(moduleUrl);
const { createSpatialCurve, buildSpatialPath } = await import("../src/simulation/yarnSpatialPath.js");
const ok = value => { assert.equal(value.status, "OK", JSON.stringify(value.diagnostics)); return value; };
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${actual} differs from ${expected}, tolerance ${tolerance}`);
const measure = (config, options) => ok(measureSpatialLength(ok(createSpatialCurve(config)).curve, options));
function independentCompositeSimpson(speed, intervals) {
  let sum = speed(0) + speed(1), compensation = 0;
  for (let i = 1; i < intervals; i++) {
    const term = (i % 2 ? 4 : 2) * speed(i / intervals) - compensation;
    const next = sum + term;
    compensation = (next - sum) - term;
    sum = next;
  }
  return sum / (3 * intervals);
}
const line = measure({ type: "line", unit: "mm", points: [[1, -2, 7], [4, 2, 19]] });
near(line.totalLength, 13);
assert.deepEqual(line.segmentLengths, [13]);
assert.deepEqual(line.cumulativeLengths, [0, 13]);

const arcAngle = 1.7 * Math.PI;
const arc = measure({ type: "circle", unit: "cm", radius: 2.3, angle: arcAngle });
near(arc.totalLength, 2.3 * arcAngle);
const turns = 2.75, radius = 1.4, pitch = 0.8;
const helix = measure({ type: "helix", unit: "mm", radius, turns, pitch });
const helixExact = Math.abs(turns) * Math.hypot(2 * Math.PI * radius, pitch);
near(helix.totalLength, helixExact);
const reverse = measure({ type: "helix", unit: "mm", radius, turns: -turns, pitch });
near(reverse.totalLength, helixExact);

const controls = [[0, 0, 0], [0.1, 2.5, 1], [5, -2, 2], [5.2, 1.8, -1], [9, 0, 4]];
const spline = ok(createSpatialCurve({ type: "catmull-rom", unit: "mm", points: controls })).curve;
const tolerances = [1e-3, 1e-6, 1e-9];
const convergence = tolerances.map(tolerance => ok(measureSpatialLength(spline,
  { absoluteTolerance: tolerance, relativeTolerance: 0, maxDepth: 24 })));
// Independent composite Simpson reference (production uses Gauss–Kronrod).
// Integrate each cubic separately so no panel straddles an acceleration seam.
const intervals = 20000;
const independentSplineLength = count => spline.segments.reduce((sum, segment) => sum +
  independentCompositeSimpson(u => Math.hypot(...segment.derivative(u)), count), 0);
const reference = independentSplineLength(intervals), referenceCheck = independentSplineLength(intervals / 2);
near(reference, referenceCheck, 1e-11);
near(convergence.at(-1).totalLength, reference, 1e-10);
assert.ok(convergence.at(-1).errorEstimate < convergence[0].errorEstimate);
assert.ok(convergence.at(-1).evaluations > convergence[0].evaluations);
convergence.forEach((result, i) => {
  near(result.totalLength, reference, tolerances[i]);
  assert.ok(result.errorEstimate <= Math.max(result.absoluteTolerance, result.relativeTolerance * result.totalLength));
});
assert.ok(convergence.at(-1).errorEstimate <= 1e-9);
const coarse = ok(buildSpatialPath(spline, { sampleCount: 9 }));
const fine = ok(buildSpatialPath(spline, { sampleCount: 513 }));
near(coarse.totalLength, fine.totalLength, 1e-12);
const chordLength = path => path.points.slice(1).reduce((sum, point, i) =>
  sum + Math.hypot(...point.map((v, axis) => v - path.points[i][axis])), 0);
assert.ok(chordLength(coarse) < coarse.totalLength - 0.05, "coarse polyline is not length authority");
assert.ok(Math.abs(chordLength(fine) - fine.totalLength) < Math.abs(chordLength(coarse) - coarse.totalLength));
const nonconverged = measureSpatialLength(spline, { absoluteTolerance: 1e-16, relativeTolerance: 0, maxDepth: 0 });
assert.equal(nonconverged.status, "NONCONVERGED");
assert.ok(nonconverged.errorEstimate > 0);
assert.ok(nonconverged.diagnostics.some(item => item.code === "INTEGRATION_NONCONVERGENCE"));
const precisionLimited = measureSpatialLength(ok(createSpatialCurve({ type: "line", unit: "mm",
  points: [[0, 0, 0], [1, 0, 0]] })).curve, { absoluteTolerance: 1e-18, relativeTolerance: 0 });
assert.equal(precisionLimited.status, "NONCONVERGED");
assert.ok(precisionLimited.diagnostics.some(item => item.code === "INTEGRATION_ROUNDOFF_LIMIT"));
for (const options of [{ absoluteTolerance: -1 }, { relativeTolerance: NaN }, { maxDepth: -1 },
  { maxDepth: 2.5 }, { absoluteTolerance: 0, relativeTolerance: 0 }]) {
  assert.equal(measureSpatialLength(spline, options).status, "INVALID");
}
assert.equal(measureSpatialLength(null).status, "INVALID");
assert.equal(measureSpatialLength({ unit: "mm", segments: [{ derivative: () => [NaN, 0, 0] }] }).status, "INVALID");
const cm = measure({ type: "line", unit: "cm", points: [[0, 0, 0], [0, 0, 1.3]] });
const metres = measure({ type: "line", unit: "m", points: [[0, 0, 0], [0, 0, 0.013]] });
near(line.totalLength, cm.totalLength * 10);
near(line.totalLength, metres.totalLength * 1000);

// A regular cubic's narrow speed dip can be invisible at all five initial
// Simpson nodes. Its x-coordinate total variation is a rigorous length bound.
const aliasCurve = ok(createSpatialCurve({ type: "catmull-rom", unit: "mm",
  points: [[29 / 150, -1e-5, 0], [0, 0, 0], [67 / 300, 1e-5, 0], [1.53, 2e-5, 0]] })).curve;
assert.equal(aliasCurve.regular, true);
const aliasSegment = ok(integrateSpatialSegment(aliasCurve.segments[1], { absoluteTolerance: 1e-8 / 3, relativeTolerance: 1e-9 }));
assert.ok(aliasSegment.length >= 0.223375 - 1e-12, "integral must exceed the exact x total-variation lower bound");
const aliasReference = 0.22337502639326598;
near(aliasSegment.length, aliasReference, 1e-8 / 3);
const aliasPath = ok(buildSpatialPath(aliasCurve, { sampleCount: 65 }));
near(aliasPath.lengthMeasurement.segmentLengths[1], aliasReference, 1e-8 / 3);
const aliasLowDepth = integrateSpatialSegment(aliasCurve.segments[1], { absoluteTolerance: 1e-14, relativeTolerance: 0, maxDepth: 0 });
assert.equal(aliasLowDepth.status, "NONCONVERGED");
assert.ok(aliasCurve.segments[1].integrationBreakpoints?.some(u => Math.abs(u - 0.1) < 1e-10));
assert.ok(aliasCurve.segments[1].integrationBreakpoints?.some(u => Math.abs(u - 0.15) < 1e-10));
const wideSignedLength = 1 / 3 - 1 / 8 + 3 / 1250;
const wideCurve = ok(createSpatialCurve({ type: "catmull-rom", unit: "mm", points: [
  [wideSignedLength - 0.0048, -1e-5, 0], [0, 0, 0], [wideSignedLength, 1e-5, 0], [1.5048, 2e-5, 0],
] })).curve;
const wideSegment = ok(integrateSpatialSegment(wideCurve.segments[1], { absoluteTolerance: 1e-8 / 3, relativeTolerance: 0 }));
const wideReference = 0.21478900774441528;
near(wideSegment.length, wideReference, 1e-8 / 3);
assert.ok(Math.abs(wideSegment.length - wideReference) <= wideSegment.errorEstimate + 1e-13,
  "reported estimate must conservatively cover the independently measured wider-lobe error");
const widePath = ok(buildSpatialPath(wideCurve, { sampleCount: 65 }));
near(widePath.lengthMeasurement.segmentLengths[1], wideReference, 1e-8 / 3);
const nearReversalReferences = [100000, 200000, 400000].map(count =>
  independentCompositeSimpson(u => Math.hypot((u - 0.01) * (u - 0.24), 1e-5), count));
near(nearReversalReferences[1], nearReversalReferences[2], 2e-13);
const referenceForLadder = nearReversalReferences.at(-1);
const precisionLadder = [1e-5, 1e-7, 1e-9, 1e-11].map(tolerance => {
  const result = ok(integrateSpatialSegment(wideCurve.segments[1], { absoluteTolerance: tolerance, relativeTolerance: 0 }));
  const absoluteError = Math.abs(result.length - referenceForLadder);
  assert.ok(absoluteError <= tolerance);
  assert.ok(absoluteError <= result.errorEstimate + 2e-13);
  return { tolerance, length: result.length, errorEstimate: result.errorEstimate, absoluteError, evaluations: result.evaluations };
});
assert.ok(precisionLadder.at(-1).absoluteError < precisionLadder[0].absoluteError * 1e-3,
  "near-reversal precision ladder must improve independently measured accuracy");
const partialCurve = ok(createSpatialCurve({ type: "catmull-rom", unit: "m", closed: true,
  points: [[0, 0, 0], [2, 0, 1], [2, 2, 0], [0, 2, -1]] })).curve;
ok(integrateSpatialSegment(partialCurve.segments[1], { absoluteTolerance: 1e-10 }, 0, 0.5000000000000001));
const extremeCurve = ok(createSpatialCurve({ type: "line", unit: "mm", points: [[0, 0, 0], [1e308, 0, 0]] })).curve;
let extremeEvaluations = 0;
const observedExtreme = { ...extremeCurve, segments: extremeCurve.segments.map(segment => ({ ...segment, derivative: u => {
  extremeEvaluations++;
  if (extremeEvaluations > 1000) throw new Error("Validator stopped runaway quadrature subdivision");
  return segment.derivative(u);
} })) };
const extremeResult = measureSpatialLength(observedExtreme, { maxDepth: 30 });
assert.equal(extremeResult.status, "INVALID", "unsupported quadrature magnitude must fail explicitly");
assert.ok(extremeEvaluations <= 45, `nonfinite quadrature must fail before recursion, evaluated ${extremeEvaluations} times`);
console.log(JSON.stringify({ validator: "yarn-spatial-length", status: "PASS", line: line.totalLength,
  arcError: arc.totalLength - 2.3 * arcAngle, helixError: helix.totalLength - helixExact, reference, referenceCheck,
  convergence: convergence.map((result, i) => ({ tolerance: tolerances[i], length: result.totalLength,
    absoluteError: Math.abs(result.totalLength - reference), errorEstimate: result.errorEstimate })),
  coarseChordLength: chordLength(coarse), fineChordLength: chordLength(fine),
  nonconvergenceStatus: nonconverged.status, roundoffStatus: precisionLimited.status, aliasRegression: { length: aliasSegment.length,
    reference: aliasReference, absoluteError: Math.abs(aliasSegment.length - aliasReference),
    errorEstimate: aliasSegment.errorEstimate, evaluations: aliasSegment.evaluations,
    pathSegmentLength: aliasPath.lengthMeasurement.segmentLengths[1], lowDepthStatus: aliasLowDepth.status },
  widerLobeRegression: { length: wideSegment.length, reference: wideReference,
    absoluteError: Math.abs(wideSegment.length - wideReference), errorEstimate: wideSegment.errorEstimate,
    evaluations: wideSegment.evaluations, pathSegmentLength: widePath.lengthMeasurement.segmentLengths[1] },
  nearReversalReferences, precisionLadder, extremeMagnitude: { status: extremeResult.status, evaluations: extremeEvaluations } }));
