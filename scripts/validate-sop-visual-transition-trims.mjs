import assert from 'node:assert/strict';
import { withSopFixtureSnapshot } from './helpers/sopFixtureSnapshot.mjs';

await withSopFixtureSnapshot(async ({ snapshot, server }) => {
  const { buildSopTopology } = await server.ssrLoadModule('/src/simulation/sopTopologyAdapter.js');
  const { buildSopVisualSwatch, planAuditedVisualTransitionTrims, applyAuditedVisualTransitionTrims } =
    await server.ssrLoadModule('/src/simulation/sopSpatialHypothesis.js');
  const { auditYarnGeometry } = await server.ssrLoadModule('/src/simulation/yarnGeometryAudit.js');
  assert.equal(typeof applyAuditedVisualTransitionTrims, 'function', 'Evidence-gated visual trim entry point must exist');
  const full = buildSopVisualSwatch(buildSopTopology(snapshot, { window: 'full' }));
  const paths = full.paths.filter(p => p.row === 0 && (p.needle === 0 || p.needle === 1 && p.geometryRole === 'STITCH_VISUAL_TEMPLATE'));
  const ids = new Set(paths.map(p => p.id));
  const before = { ...full, paths, scene: full.scene.filter(p => ids.has(p.id)) };
  const serializedBefore = JSON.stringify(before), fast = { yieldControl: async () => {} };
  const audit = await auditYarnGeometry(before, fast);
  assert.equal(audit.status, 'COMPLETE');
  const plan = planAuditedVisualTransitionTrims(before, audit);
  assert.equal(plan.eligibleCount, 1, 'Only the second-yarn bridge has no unrelated UNKNOWN relationship');
  assert.equal(plan.skippedCount, 1);
  assert.equal(plan.skipped[0].reason, 'UNRELATED_UNKNOWN_RELATION');
  const changed = applyAuditedVisualTransitionTrims(before, audit);
  assert.equal(changed.status, 'APPLIED');
  assert.equal(changed.report.applied, 1);
  assert.equal(JSON.stringify(before), serializedBefore, 'Original geometry/source/audit input is unchanged');
  assert.deepEqual(changed.swatch.paths.map(p => p.id), before.paths.map(p => p.id));
  assert.deepEqual(changed.swatch.scene.map(p => p.id), before.scene.map(p => p.id));
  const correction = changed.report.corrections[0];
  const original = before.paths.find(p => p.id === correction.pathId);
  const corrected = changed.swatch.paths.find(p => p.id === correction.pathId);
  const originalItem = before.scene.find(p => p.id === correction.pathId);
  const correctedItem = changed.swatch.scene.find(p => p.id === correction.pathId);
  assert.equal(correction.originalCenterline, original.centerline);
  assert.equal(correction.originalGeometry, originalItem.geometry);
  assert.equal(corrected.provenance, original.provenance, 'Original source references stay intact');
  assert.equal(corrected.physicalContinuity, 'UNKNOWN');
  assert.equal(corrected.physicalLengthEligible, false);
  assert.ok(correction.deltaXYZArcMm < 0 && correction.correctedXYZArcMm > 0);
  assert.ok(correction.proof.leftClearanceMm > 0 && correction.proof.rightClearanceMm > 0);
  assert.equal(correction.classification, 'UNEXPECTED_INTERSECTION');
  assert.equal(correction.evidenceScope, 'VISUAL_ASSUMPTION_ENDPOINT_ATTACHMENT_ONLY');
  assert.equal(correction.physicalRelation, 'UNKNOWN');
  assert.equal(correctedItem.geometry.counts.triangles, originalItem.geometry.counts.triangles);
  const startTrim = corrected.centerline.points[0][0] - original.centerline.points[0][0];
  assert.ok(Math.abs(correctedItem.geometry.uv[0] - startTrim) < 1e-8, 'Retained texture starts at the original along-yarn coordinate');
  for (let i = 0; i < correctedItem.geometry.positions.length; i++) {
    if (i % 3) assert.equal(correctedItem.geometry.positions[i], originalItem.geometry.positions[i], 'Cross-section Y/Z and radial phase are unchanged');
    else assert.ok(correctedItem.geometry.positions[i] >= originalItem.geometry.bounds.min[0] && correctedItem.geometry.positions[i] <= originalItem.geometry.bounds.max[0], 'Retained straight surface is a subset of the original');
  }
  for (const path of before.paths.filter(p => p.id !== correction.pathId)) {
    assert.equal(changed.swatch.paths.find(p => p.id === path.id), path);
    assert.equal(changed.swatch.scene.find(p => p.id === path.id), before.scene.find(p => p.id === path.id));
  }
  const after = await auditYarnGeometry(changed.swatch, fast);
  assert.equal(after.status, 'COMPLETE');
  assert.equal(after.findings.filter(f => f.sourcePathIds.includes(correction.pathId) && f.geometryEvidence.kind === 'SURFACE_CROSSING').length, 0);
  const untouched = findings => findings.filter(f => !f.sourcePathIds.includes(correction.pathId)).map(f => [f.id, f.classification, f.geometryEvidence.kind]);
  assert.deepEqual(untouched(after.findings), untouched(audit.findings), 'Every unrelated UNKNOWN record remains unchanged');
  for (const [candidate, report] of [[before, JSON.parse(JSON.stringify(audit))], [{ ...before }, audit],
    [{ ...before, parameters: { ...before.parameters, radiusMm: .04 } }, audit],
    [before, { ...audit, complete: false }], [changed.swatch, audit]]) {
    assert.equal(planAuditedVisualTransitionTrims(candidate, report).status, 'REJECTED');
    assert.equal(applyAuditedVisualTransitionTrims(candidate, report).swatch, candidate);
  }
  assert.equal(planAuditedVisualTransitionTrims(changed.swatch, after).eligibleCount, 0, 'Completed visual correction is idempotent after re-audit');
  // This tests the repair veto for a declared protected relation, not knitting
  // legality. The independent detector validator supplies the linked-ring test.
  const remoteSource = before.paths.find(p => p.geometryRole === 'STITCH_VISUAL_TEMPLATE');
  const remoteItem = before.scene.find(p => p.id === remoteSource.id);
  const remoteId = 'TEST_ONLY_EXTERNAL_INTERLOCK_PROTECTION';
  const remotePath = { ...remoteSource, id: remoteId, needle: 100,
    centerline: { ...remoteSource.centerline, points: remoteSource.centerline.points.map(p => [p[0] + 100, p[1], p[2]]) } };
  const remoteGeometry = { ...remoteItem.geometry,
    positions: Array.from(remoteItem.geometry.positions, (v, i) => i % 3 ? v : v + 100) };
  const protectedSwatch = { ...before, paths: [...before.paths, remotePath], scene: [...before.scene, { ...remoteItem, id: remoteId, geometry: remoteGeometry }] };
  const protectedAudit = await auditYarnGeometry(protectedSwatch, { ...fast, evidence: [{ sourcePathIds: [correction.pathId, remoteId],
    relation: 'INTERLOCK', applicable: 'THIS_GEOMETRY', source: 'TEST_ONLY declared protected-relation repair-veto contract; not a physical knitting claim' }] });
  assert.ok(protectedAudit.findings.some(f => f.classification === 'VALID_INTERLOCK'));
  const protectedPlan = planAuditedVisualTransitionTrims(protectedSwatch, protectedAudit);
  assert.equal(protectedPlan.eligibleCount, 0);
  assert.ok(protectedPlan.skipped.some(p => p.pathId === correction.pathId && p.reason === 'PROTECTED_INTERLOCK_RELATION'));
  console.log('PASS: strict endpoint proof, unrelated UNKNOWN blocker, exact-reference stale rejection, immutable source/identity, surface subset, arc/radius evidence and before/after exact audit');
}, { archiveDir: process.env.KNITSCAPE_TEST_OUTPUT_DIR || 'C:/Users/liuchen/Documents/KnitScape/archives/round11-20261104/visual-trim-validation' });
