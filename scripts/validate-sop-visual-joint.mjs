import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { withSopFixtureSnapshot } from './helpers/sopFixtureSnapshot.mjs';

await withSopFixtureSnapshot(async ({ snapshot, server, archiveDir }) => {
  const { buildSopTopology } = await server.ssrLoadModule('/src/simulation/sopTopologyAdapter.js');
  const api = await server.ssrLoadModule('/src/simulation/sopSpatialHypothesis.js');
  const { auditYarnGeometry } = await server.ssrLoadModule('/src/simulation/yarnGeometryAudit.js');
  const { buildSpatialPath } = await server.ssrLoadModule('/src/simulation/yarnSpatialPath.js');
  const { buildParallelTransportFrames } = await server.ssrLoadModule('/src/simulation/yarnParallelTransport.js');
  const { buildYarnTubeGeometry } = await server.ssrLoadModule('/src/simulation/yarnTubeGeometry.js');
  const hermite = buildSpatialPath({ type: 'hermite', points: [[0, 0, 0], [1, 0, 0]],
    tangents: [[1, 0, 0], [1, 0, 0]], unit: 'mm', closed: false }, { sampleCount: 16 });
  assert.equal(hermite.status, 'OK', 'Existing polynomialSegment must support explicit endpoint Hermite derivatives');
  assert.ok(Math.abs(hermite.totalLength - 1) < 1e-9);
  assert.equal(buildSpatialPath({ type: 'hermite', points: [[0, 0, 0], [1, 0, 0]], tangents: [[0, 0, 0], [1, 0, 0]], unit: 'mm' }).status, 'INVALID');
  const controlTube = pts => {
    const line = buildSpatialPath({ type: 'line', points: pts, unit: 'mm', closed: false }, { sampleCount: 4 });
    return buildYarnTubeGeometry({ path: line, frames: buildParallelTransportFrames(line), radiusA: .035, radialSegments: 8, uvRepeatLength: 1 });
  };
  const ca = controlTube([[0, 0, 0], [1, 0, 0]]), cb = controlTube([[1, 0, 0], [2, 0, 0]]);
  assert.deepEqual(Array.from(ca.positions.slice(-27)), Array.from(cb.positions.slice(0, 27)), 'Synthetic straight control has exact rings; this is not claimed as a gap-free SOP example');
  const full = api.buildSopVisualSwatch(buildSopTopology(snapshot, { window: 'full' }));
  const paths = full.paths.filter(p => p.row >= 20 && p.row <= 24 && p.needle >= 14 && p.needle <= 19);
  const ids = new Set(paths.map(p => p.id));
  const G0 = { ...full, paths, scene: full.scene.filter(p => ids.has(p.id)), evidenceScene: full.evidenceScene.filter(p => ids.has(p.id)) };
  const target = paths.find(p => p.id.endsWith('/visual:22:16:1:TRANSITION'));
  const fast = { yieldControl: async () => {} };
  const audit = await auditYarnGeometry(G0, fast);
  const trimmed = api.applyAuditedVisualTransitionTrims(G0, audit);
  const GtPath = trimmed.swatch.paths.find(p => p.id === target.id);
  assert.ok(GtPath.visualCorrection, 'Historical target really reproduces the failed trim');
  assert.ok(GtPath.centerline.points[0][0] - target.centerline.points[0][0] > .02, 'RED fixture: actual left gap exceeds .02 mm');
  assert.equal(typeof api.buildAuditedVisualJointCandidate, 'function', 'Missing measured endpoint-preserving visual joint candidate');
  const result = await api.buildAuditedVisualJointCandidate(G0, audit, { pathId: target.id, ...fast });
  assert.equal(result.status, 'APPLIED', JSON.stringify(result.report));
  assert.equal(result.report.interfaces.left.maxRingErrorMm, 0);
  assert.equal(result.report.interfaces.right.maxRingErrorMm, 0);
  assert.ok(result.report.interfaces.left.tangentAngleDegrees <= .001);
  assert.ok(result.report.interfaces.right.tangentAngleDegrees <= .001);
  assert.equal(result.report.meshIntegrity.unexplainedBoundaryEdges, 0);
  assert.equal(result.report.meshIntegrity.nonManifoldEdges, 0);
  assert.equal(result.report.meshIntegrity.internalCaps, 0);
  assert.equal(result.report.intersections.afterTargetStrictCrossings, 0);
  assert.equal(result.report.intersections.newRelatedStrictCrossings, 0);
  assert.equal(result.report.section.value, .035);
  assert.equal(result.report.interfaces.left.maxNormalError, 0);
  assert.equal(result.report.interfaces.right.maxNormalError, 0);
  assert.equal(result.report.interfaces.left.maxMaterialTangentError, 0);
  assert.equal(result.report.interfaces.right.maxMaterialTangentError, 0);
  assert.equal(result.report.interfaces.left.uv.maxVError, 0);
  assert.equal(result.report.interfaces.right.uv.maxVError, 0);
  assert.ok(result.report.arcLengthMm > .15875);
  const changed = result.swatch.paths.find(p => p.id === target.id);
  assert.equal(changed.provenance, target.provenance);
  assert.equal(changed.physicalLengthEligible, false);
  for (const p of G0.paths.filter(p => p.id !== target.id)) {
    assert.equal(result.swatch.paths.find(q => q.id === p.id), p);
    assert.equal(result.swatch.scene.find(q => q.id === p.id), G0.scene.find(q => q.id === p.id));
  }
  const singleTrim = api.applyAuditedVisualTransitionTrims(G0, audit, { pathIds: [target.id] });
  assert.equal(singleTrim.report.applied, 1);
  const measureRingError = (first, firstEnd, second, secondEnd) => {
    const start = (m, end) => (end ? m.counts.rings - 1 : 0) * (m.counts.radialSegments + 1) * 3;
    const a = start(first, firstEnd), b = start(second, secondEnd);
    return Math.max(...Array.from({ length: 9 }, (_, k) => Math.hypot(...[0, 1, 2].map(axis => first.positions[a + k * 3 + axis] - second.positions[b + k * 3 + axis]))));
  };
  const leftPath = paths.find(p => p.id.endsWith('/visual:22:16:1:T'));
  const rightPath = paths.find(p => p.id.endsWith('/visual:22:17:1:K'));
  const getMesh = (s, id) => s.scene.find(p => p.id === id).geometry;
  const gtError = measureRingError(getMesh(G0, leftPath.id), true, getMesh(singleTrim.swatch, target.id), false);
  const gtVerdict = { state: 'Gt', maximumRingErrorMm: gtError, toleranceMm: 1e-5, continuity: gtError <= 1e-5 ? 'PASS' : 'FAIL' };
  assert.equal(gtVerdict.continuity, 'FAIL', 'The original trim must never be considered continuous');
  await fs.writeFile(path.join(archiveDir, 'gt-continuity-red.json'), JSON.stringify(gtVerdict, null, 2));
  if (process.env.KNITSCAPE_EXPECT_GT_CONTINUITY === '1') assert.ok(gtError <= 1e-5, `Gt continuity RED: ${gtError} mm exceeds fixed 0.00001 mm`);
  const edit = (id, updatePath, updateMesh) => ({ ...G0,
    paths: G0.paths.map(p => p.id === id ? updatePath(p) : p),
    scene: G0.scene.map(item => item.id === id ? { ...item, geometry: updateMesh(item.geometry) } : item) });
  const verifyReject = async (candidate, reason) => {
    const report = await auditYarnGeometry(candidate, fast);
    const rejected = await api.buildAuditedVisualJointCandidate(candidate, report, { pathId: target.id, ...fast });
    assert.equal(rejected.status, 'REJECTED', reason);
    assert.equal(rejected.swatch, candidate);
    assert.equal(rejected.report.reason, reason);
  };
  await verifyReject(edit(target.id, p => ({ ...p, provenance: { ...p.provenance, transitionToOccurrenceIds: leftPath.provenance.occurrenceIds } }), m => m), 'UNPROVEN_OR_ALREADY_CHANGED_VISUAL_CONNECTION');
  await verifyReject(edit(rightPath.id, p => ({ ...p, yarnId: 'UNRELATED_YARN_WITH_SHARED_CN' }), m => m), 'OUTSIDE_SINGLE_MEASURED_TK_CASE');
  const capPath = buildSpatialPath({ type: 'line', points: [target.centerline.points[0], target.centerline.points.at(-1)], unit: 'mm' }, { sampleCount: 4 });
  const capped = buildYarnTubeGeometry({ path: capPath, frames: buildParallelTransportFrames(capPath), radiusA: .035, radialSegments: 8, capEnds: true, uvRepeatLength: 1 });
  await verifyReject(edit(target.id, p => p, () => capped), 'OPEN_EQUAL_SECTION_INTERFACES_REQUIRED');
  await verifyReject(edit(rightPath.id, p => ({ ...p, centerline: { ...p.centerline, tangents: p.centerline.tangents.map((v, i) => i ? v : v.map(x => -x)) } }), m => m), 'FIXED_RADIUS_ENDPOINT_CONDITION_INFEASIBLE');
  const phaseShifted = edit(rightPath.id, p => p, m => {
    const changed = { ...m };
    for (const field of ['positions', 'normals', 'tangents']) changed[field] = Array.from(m[field], (_, index) => {
      const vertex = Math.floor(index / 3), ring = Math.floor(vertex / 9), radial = vertex % 9;
      return m[field][(ring * 9 + (radial + 1) % 8) * 3 + index % 3];
    });
    return changed;
  });
  const phaseAudit = await auditYarnGeometry(phaseShifted, fast);
  const phaseResult = await api.buildAuditedVisualJointCandidate(phaseShifted, phaseAudit, { pathId: target.id, ...fast });
  assert.equal(phaseResult.status, 'APPLIED', JSON.stringify(phaseResult.report));
  assert.equal(phaseResult.report.interfaces.right.maxRingErrorMm, 0, 'A radial index phase shift matches the explicitly declared ring mapping');
  let yields = 0;
  const cancelled = await api.buildAuditedVisualJointCandidate(G0, audit, { pathId: target.id,
    yieldControl: async () => { yields++; }, isCancelled: () => yields > 0 });
  assert.equal(cancelled.status, 'CANCELLED'); assert.equal(cancelled.swatch, G0);
  for (const [swatch, report, options, expected] of [
    [G0, JSON.parse(JSON.stringify(audit)), { pathId: target.id }, 'REJECTED'],
    [{ ...G0 }, audit, { pathId: target.id }, 'REJECTED'],
    [G0, audit, { pathId: target.id, isCancelled: () => true }, 'CANCELLED'],
    [G0, audit, { pathId: target.id.replace(':1:TRANSITION', ':0:TRANSITION') }, 'REJECTED'],
    [G0, audit, { pathId: paths.find(p => p.geometryRole === 'HELD_LOOP_VISUAL').id }, 'REJECTED'],
  ]) {
    const rejected = await api.buildAuditedVisualJointCandidate(swatch, report, { ...options, ...fast });
    assert.equal(rejected.status, expected);
    assert.equal(rejected.swatch, swatch);
  }
  await fs.writeFile(path.join(archiveDir, 'joint-validation.json'), JSON.stringify(result.report, null, 2));
  console.log('PASS: actual Gt gap reproduced; exact shared rings, G1, frame, UV seam, open boundary, no caps/folds/new crossings, immutable identities, cancellation and stale report rejection');
}, { archiveDir: process.env.KNITSCAPE_TEST_OUTPUT_DIR || 'C:/Users/liuchen/Documents/KnitScape/archives/round11-1-20261105/joint-validation' });
