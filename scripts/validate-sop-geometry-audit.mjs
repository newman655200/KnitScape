import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { withSopFixtureSnapshot } from './helpers/sopFixtureSnapshot.mjs';

// Exact supplied SOP, production Machine -> snapshot -> existing Round9 swatch.
// Audit only; neither this check nor its report rewrites source/generated files.
await withSopFixtureSnapshot(async ({ snapshot, server, archiveDir, fixtureSha256 }) => {
  const { buildSopTopology } = await server.ssrLoadModule('/src/simulation/sopTopologyAdapter.js');
  const { buildSopVisualSwatch, planAuditedVisualTransitionTrims, applyAuditedVisualTransitionTrims } =
    await server.ssrLoadModule('/src/simulation/sopSpatialHypothesis.js');
  const { auditYarnGeometry } = await server.ssrLoadModule('/src/simulation/yarnGeometryAudit.js');
  const topology = buildSopTopology(snapshot, { window: 'full' });
  const geometry = buildSopVisualSwatch(topology);
  assert.equal(geometry.status, 'OK');
  assert.equal(geometry.coverage.generatedCells, 48 * 60);
  assert.equal(geometry.coverage.generatedAssignments, 48 * 60 * 2);
  const digest = () => {
    const hash = createHash('sha256');
    hash.update(JSON.stringify({ identity: geometry.identity, coverage: geometry.coverage,
      continuity: topology.continuity, paths: geometry.paths }));
    for (const item of geometry.scene) {
      hash.update(item.id);
      for (const key of ['positions', 'normals', 'tangents', 'uv', 'indices'])
        hash.update(Buffer.from(new Float64Array(item.geometry[key]).buffer));
    }
    return hash.digest('hex');
  };
  const before = digest(), memoryBefore = process.memoryUsage(), start = performance.now();
  let last = 0;
  const report = await auditYarnGeometry(geometry, { onProgress: progress => {
    if (performance.now() - last > 15000) { console.log(JSON.stringify(progress)); last = performance.now(); }
  } });
  const memoryAfter = process.memoryUsage(), after = digest();
  await fs.writeFile(`${archiveDir}/full-sop-audit.json`, JSON.stringify(report));
  const summary = { fixtureSha256, geometryDigestBefore: before, geometryDigestAfter: after,
    unchanged: before === after, status: report.status, complete: report.complete,
    counts: report.counts, statistics: report.statistics, limitations: report.limitations,
    fixtureCoverage: geometry.coverage, triangles: geometry.scene.reduce((s, item) => s + item.geometry.counts.triangles, 0),
    wallMs: performance.now() - start, memoryBefore, memoryAfter,
    memoryMeaning: 'Node process samples include geometry, audit, GC and Vite; not isolated retained audit memory.' };
  await fs.writeFile(`${archiveDir}/full-sop-audit-summary.json`, JSON.stringify(summary, null, 2));
  assert.equal(report.status, 'COMPLETE', 'Limits/cancellation/invalid geometry must not pass as complete');
  assert.equal(report.complete, true);
  assert.equal(before, after, 'Source, centerline, section and mesh arrays must remain byte-equivalent');
  assert.equal(report.counts.sourcePaths, geometry.paths.length);
  assert.equal(report.counts.byClassification.VALID_INTERLOCK, 0, 'Actual SOP provides no authority for physical interlock');
  assert.equal(report.statistics.examinedMeshTriangles, summary.triangles);
  assert.ok(report.statistics.narrowphaseTests > 0 && report.statistics.broadphaseCandidates > 0);
  const valid = new Set(['VALID_INTERLOCK', 'UNEXPECTED_INTERSECTION', 'VISUAL_OVERLAP', 'UNKNOWN_INTERSECTION']);
  const pathById = new Map(geometry.paths.map(path => [path.id, path]));
  for (const finding of report.findings) {
    assert.ok(valid.has(finding.classification));
    assert.ok(finding.sourcePathIds.length > 0);
    for (const id of finding.sourcePathIds) {
      const source = report.sources[id];
      assert.ok(source && source.occurrenceIds.length && source.linkIds.length && Array.isArray(source.chainIds));
      assert.deepEqual(source.chainIds, pathById.get(id).provenance.chainIds ?? [], 'No fabricated YarnChain identities');
      assert.ok(Number.isInteger(source.feedIndex) && source.yarnId);
      assert.equal(source.geometrySource, 'VISUAL_ASSUMPTION');
    }
  }
  console.log(JSON.stringify({ status: report.status, counts: report.counts, statistics: report.statistics, unchanged: before === after }));
  const plan = planAuditedVisualTransitionTrims(geometry, report);
  assert.equal(plan.eligibleCount, 2820, 'Only proof-backed second-yarn display attachments are eligible');
  assert.equal(plan.skippedCount, 2820, 'Main-yarn transitions with unrelated UNKNOWN stay untouched');
  const corrected = applyAuditedVisualTransitionTrims(geometry, report);
  assert.equal(corrected.status, 'APPLIED');
  assert.equal(corrected.report.applied, 2820);
  const changed = new Set(corrected.report.corrections.map(item => item.pathId));
  assert.deepEqual(corrected.swatch.paths.map(item => item.id), geometry.paths.map(item => item.id));
  assert.equal(corrected.swatch.evidenceScene, geometry.evidenceScene, 'All K/T/M/HELD source mesh objects stay unchanged');
  for (let i = 0; i < geometry.paths.length; i++) {
    const original = geometry.paths[i], result = corrected.swatch.paths[i];
    assert.equal(result.provenance, original.provenance);
    assert.equal(result.physicalContinuity, 'UNKNOWN');
    if (!changed.has(original.id)) {
      assert.equal(result, original);
      assert.equal(corrected.swatch.scene[i], geometry.scene[i]);
    } else {
      assert.equal(result.geometryRole, 'VISUAL_TRANSITION');
      assert.equal(result.yarnIndex, 1);
      assert.equal(result.visualCorrection.originalCenterline, original.centerline);
      assert.equal(result.visualCorrection.originalGeometry, geometry.scene[i].geometry);
      assert.ok(result.visualCorrection.deltaXYZArcMm < 0);
    }
  }
  last = performance.now();
  const afterAudit = await auditYarnGeometry(corrected.swatch, { onProgress: progress => {
    if (performance.now() - last > 15000) { console.log(JSON.stringify({ stage: 'AFTER_VISUAL_TRIM', ...progress })); last = performance.now(); }
  } });
  await fs.writeFile(`${archiveDir}/full-sop-after-trim-audit.json`, JSON.stringify(afterAudit));
  assert.equal(afterAudit.status, 'COMPLETE');
  const untouchedFindings = result => result.findings.filter(f => !f.sourcePathIds.some(id => changed.has(id)))
    .map(f => [f.id, f.classification, f.geometryEvidence.kind, f.occurrenceCount]).sort((a, b) => a[0].localeCompare(b[0]));
  assert.deepEqual(untouchedFindings(afterAudit), untouchedFindings(report), 'All unmodified and unrelated UNKNOWN findings remain identical');
  assert.equal(afterAudit.findings.filter(f => f.sourcePathIds.some(id => changed.has(id)) && f.geometryEvidence.kind === 'SURFACE_CROSSING').length, 0);
  assert.equal(digest(), before, 'Even correction leaves original baseline geometry intact');
  const crossings = result => result.findings.filter(f => f.geometryEvidence.kind === 'SURFACE_CROSSING').length;
  const correctionSummary = { applied: corrected.report.applied, skippedCount: corrected.report.skippedCount,
    policy: corrected.report.policy, physicalRelation: 'UNKNOWN', unchangedOriginal: true,
    before: { counts: report.counts, statistics: report.statistics, surfaceCrossings: crossings(report) },
    after: { counts: afterAudit.counts, statistics: afterAudit.statistics, surfaceCrossings: crossings(afterAudit) },
    allOtherFindingsUnchanged: true, sourceIdsUnchanged: true, originalSectionAndCenterlineRetained: true,
    corrections: corrected.report.corrections.map(({ originalGeometry, originalCenterline, correctedCenterline, ...record }) => record),
    memoryAfterAudit: process.memoryUsage() };
  await fs.writeFile(`${archiveDir}/full-sop-correction-summary.json`, JSON.stringify(correctionSummary, null, 2));
  console.log(JSON.stringify({ stage: 'AFTER_VISUAL_TRIM', applied: correctionSummary.applied,
    beforeCrossings: crossings(report), afterCrossings: crossings(afterAudit), allOtherFindingsUnchanged: true }));
});
