import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildSpatialPath } from '../src/simulation/yarnSpatialPath.js';
import { buildParallelTransportFrames } from '../src/simulation/yarnParallelTransport.js';
import { buildYarnTubeGeometry } from '../src/simulation/yarnTubeGeometry.js';

assert.ok(await fs.access('src/simulation/yarnGeometryAudit.js').then(() => true, () => false), 'Read-only spatial audit must exist');
const { auditYarnGeometry, isAuditForGeometry, classifyTrianglePair } = await import('../src/simulation/yarnGeometryAudit.js');
const triangleA = [[-1, -1, 0], [1, -1, 0], [0, 1, 0]];
assert.equal(classifyTrianglePair(triangleA, [[0, 1, -1], [0, 1, 1], [0, 2, 0]]), 'TOUCH_OR_COPLANAR',
  'Strict plane straddling plus point-only interval contact is not a transverse surface crossing');
assert.equal(classifyTrianglePair(triangleA, [[0, 0, -1], [0, 0, 1], [0, 2, 0]]), 'SURFACE_CROSSING');
assert.equal(classifyTrianglePair(triangleA, triangleA), 'TOUCH_OR_COPLANAR');
assert.equal(classifyTrianglePair(triangleA, triangleA.map(p => [p[0], p[1], .1])), null);
function tube(id, config, radius = .04, transform = p => p, capEnds = false) {
  const sampled = buildSpatialPath({ unit: 'mm', ...config }, { sampleCount: config.auditSampleCount ?? (config.type === 'line' ? 5 : 129) });
  assert.equal(sampled.status, 'OK');
  const path = { ...sampled, points: sampled.points.map(transform), tangents: sampled.tangents.map(t => {
    const zero = transform([0, 0, 0]), end = transform(t); return end.map((x, i) => x - zero[i]);
  }) };
  const frames = buildParallelTransportFrames(path);
  const mesh = buildYarnTubeGeometry({ path, frames, radiusA: radius, radialSegments: 8, uvRepeatLength: 1, capEnds });
  assert.equal(mesh.status, 'OK', JSON.stringify(mesh.diagnostics));
  return { path: { id, centerline: path, yarnId: id, yarnIndex: id === 'a' ? 0 : 1, feedIndex: 0, row: 0, needle: 0,
    geometryRole: 'STITCH_VISUAL_TEMPLATE', evidenceStatus: 'VISUAL_ASSUMPTION',
    provenance: { occurrenceIds: [id + ':o'], linkIds: [id + ':l'], chainIds: [id + ':c'], section: { value: radius, unit: 'mm' } } },
    item: { id, geometry: mesh } };
}
const swatch = (...entries) => ({ status: 'OK', paths: entries.map(x => x.path), scene: entries.map(x => x.item) });
const fast = { yieldControl: async () => {} };
const almostA = tube('near-a', { type: 'line', points: [[0, 0, 0], [1e6, 0, 0]], auditSampleCount: 2 }, .001);
const almostB = tube('near-b', { type: 'line', points: [[0, -.01, 0], [1e6, .01, 0]], auditSampleCount: 2 }, .001);
const nearReport = await auditYarnGeometry(swatch(almostA, almostB), { ...fast, cellSize: 500000 });
assert.ok(nearReport.statistics.narrowphaseTests > 0, 'Ill-conditioned almost-parallel segment distance must not certify separation');
assert.equal(nearReport.counts.byClassification.VISUAL_OVERLAP, 0, 'Almost-parallel true crossing is not mere projected occlusion');
const a = tube('a', { type: 'line', points: [[-1, 0, 0], [1, 0, 0]] });
const b = tube('b', { type: 'line', points: [[0, -1, 0], [0, 1, 0]] });
const crossing = swatch(a, b), original = JSON.stringify(crossing);
const delimiterA = tube('a|b', { type: 'line', points: [[-1, 0, 0], [1, 0, 0]] });
const delimiterB = tube('c', { type: 'line', points: [[0, -1, 0], [0, 1, 0]] });
const delimiterC = tube('a', { type: 'line', points: [[9, 0, 0], [11, 0, 0]] });
const delimiterD = tube('b|c', { type: 'line', points: [[10, -1, 0], [10, 1, 0]] });
const delimiterReport = await auditYarnGeometry(swatch(delimiterA, delimiterB, delimiterC, delimiterD), fast);
assert.equal(new Set(delimiterReport.findings.filter(f => f.geometryEvidence.kind === 'SURFACE_CROSSING').flatMap(f => f.sourcePathIds)).size, 4,
  'Source IDs containing delimiters cannot merge unrelated pair evidence');
let report = await auditYarnGeometry(crossing, fast);
assert.equal(report.status, 'COMPLETE');
assert.ok(isAuditForGeometry(report, crossing));
assert.throws(() => { report.findings.splice(0); }, TypeError, 'Completed report findings cannot be removed before correction planning');
assert.throws(() => { report.findings[0].geometryEvidence.kind = 'SURFACE_CROSSING'; }, TypeError, 'Geometry evidence is immutable');
assert.throws(() => { report.findings[0].sourcePathIds[0] = 'forged'; }, TypeError, 'Finding source authority is immutable');
assert.equal(Object.isFrozen(crossing.paths[0].provenance), false, 'Report protection must not freeze or mutate the source input');
assert.equal(isAuditForGeometry(JSON.parse(JSON.stringify(report)), crossing), false, 'Imported JSON cannot authorize a visual correction');
assert.equal(isAuditForGeometry(report, { ...crossing }), false, 'Replaced derived geometry invalidates the old report');
assert.ok(report.findings.some(f => f.classification === 'UNKNOWN_INTERSECTION' && f.geometryEvidence.kind === 'SURFACE_CROSSING'), 'Unknown dual-yarn order is not silently repaired');
assert.equal(JSON.stringify(crossing), original, 'Detection cannot mutate source geometry');
report = await auditYarnGeometry(crossing, { ...fast, evidence: [{ sourcePathIds: ['a', 'b'], relation: 'NONCONTACT', source: 'TEST_ONLY independent solids fixture', applicable: 'THIS_GEOMETRY' }] });
assert.ok(report.findings.some(f => f.classification === 'UNEXPECTED_INTERSECTION'));
report = await auditYarnGeometry(crossing, { ...fast, evidence: [{ sourcePathIds: ['a', 'b'], relation: 'NONCONTACT', source: 'stale', applicable: 'OTHER_GEOMETRY' }] });
assert.equal(report.counts.byClassification.UNEXPECTED_INTERSECTION, 0, 'Stale relation evidence must not classify present geometry');
const cap = tube('cap', { type: 'line', points: [[-1, 0, 0], [1, 0, 0]] }, .10, p => p, true);
const capProbe = tube('probe', { type: 'line', points: [[1.007, -.025, 0], [1.007, .025, 0]] }, .02);
report = await auditYarnGeometry(swatch(cap, capProbe), fast);
assert.ok(report.findings.some(f => f.geometryEvidence.kind === 'SURFACE_CROSSING' &&
  f.geometryEvidence.segmentIndices.includes(cap.path.centerline.points.length - 1)), 'Distal end cap is indexed at the actual terminal ring');
const raised = tube('b', { type: 'line', points: [[0, -1, .4], [0, 1, .4]] });
report = await auditYarnGeometry(swatch(a, raised), fast);
assert.ok(report.findings.some(f => f.classification === 'VISUAL_OVERLAP'));
assert.equal(report.counts.byClassification.UNEXPECTED_INTERSECTION, 0);
const figure = Array.from({ length: 32 }, (_, i) => { const t = i / 32 * Math.PI * 2; return [Math.sin(t), Math.sin(2 * t), 0]; });
const self = tube('self', { type: 'catmull-rom', points: figure, closed: true }, .008);
report = await auditYarnGeometry(swatch(self), fast);
assert.ok(report.findings.some(f => f.relation === 'SELF_NONADJACENT' && f.classification === 'UNEXPECTED_INTERSECTION'), 'Actual nonadjacent figure-eight tube self crossing');
const c1 = tube('a', { type: 'circle', radius: 1, closed: true });
const c2 = tube('b', { type: 'circle', radius: 1, closed: true }, .04, p => [1 + p[0], p[2], p[1]]);
report = await auditYarnGeometry(swatch(c1, c2), { ...fast, evidence: [{ sourcePathIds: ['a', 'b'], relation: 'INTERLOCK', source: 'TEST_ONLY Hopf-link analytic fixture; one disk crossing', applicable: 'THIS_GEOMETRY' }] });
assert.ok(report.findings.some(f => f.classification === 'VALID_INTERLOCK'), 'Linked but disjoint tubes must not be labelled collision errors');
assert.equal(report.counts.byClassification.UNEXPECTED_INTERSECTION, 0);
assert.equal(report.statistics.skippedLocalAdjacency, 2 * (c1.path.centerline.points.length - 1), 'Closed seam excludes only actually adjacent ring bands');
const touching = tube('b', { type: 'line', points: [[1, 0, 0], [2, 0, 0]] });
report = await auditYarnGeometry(swatch(a, touching), fast);
assert.equal(report.counts.byClassification.UNEXPECTED_INTERSECTION, 0, 'Shared endpoint contact is not proven penetration');
const enclosing = tube('b', { type: 'line', points: [[-1, 0, 0], [1, 0, 0]] }, .10);
report = await auditYarnGeometry(swatch(a, enclosing), fast);
assert.ok(report.findings.some(f => f.classification === 'UNKNOWN_INTERSECTION'), 'Open tube containment ambiguity cannot be declared clear');
const bad = swatch(a); bad.scene = [{ ...a.item, geometry: { ...a.item.geometry, positions: [...a.item.geometry.positions] } }]; bad.scene[0].geometry.positions[0] = NaN;
report = await auditYarnGeometry(bad, fast); assert.equal(report.complete, false); assert.ok(report.findings.some(f => f.relation === 'ABNORMAL_GEOMETRY'));
const badNormals = swatch(a); badNormals.scene = [{ ...a.item, geometry: { ...a.item.geometry, normals: [...a.item.geometry.normals] } }]; badNormals.scene[0].geometry.normals[0] = NaN;
report = await auditYarnGeometry(badNormals, fast); assert.equal(report.complete, false, 'Nonfinite shading normals must invalidate orientation diagnostics');
report = await auditYarnGeometry(swatch(a, a), fast); assert.equal(report.status, 'INVALID', 'Duplicate path IDs cannot silently overwrite provenance');
let ticks = 0;
report = await auditYarnGeometry(swatch(c1, c2), { yieldControl: async () => { ticks++; }, isCancelled: () => ticks > 0 });
assert.equal(report.status, 'CANCELLED');
assert.equal(report.complete, false);
assert.equal(isAuditForGeometry(report, swatch(c1, c2)), false);
console.log('PASS actual tube self-cross, inter-yarn crossing, unknown relation, Hopf interlock, visual occlusion, endpoint touch, containment ambiguity, abnormal input, read-only and cancellation');
