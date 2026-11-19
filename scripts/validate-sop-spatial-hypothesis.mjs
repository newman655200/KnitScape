import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
const moduleUrl = new URL("../src/simulation/sopSpatialHypothesis.js", import.meta.url);
assert.ok(existsSync(moduleUrl), "SOP geometry adapter must exist before topology can be rendered");
const { buildSopSpatialHypothesis } = await import(moduleUrl);
const { withSopFixtureSnapshot } = await import("./helpers/sopFixtureSnapshot.mjs");
const { buildSopTopology } = await import("../src/simulation/sopTopologyAdapter.js");
await withSopFixtureSnapshot(async ({ snapshot, fixtureSha256, archiveDir }) => {
  const topology = buildSopTopology(snapshot), before = JSON.stringify(topology);
  const flat = buildSopSpatialHypothesis(topology);
  assert.equal(flat.status, "OK", JSON.stringify(flat.diagnostics)); assert.equal(flat.mode, "SOURCE_TOPOLOGY_VIEW");
  assert.equal(flat.scene.length, 0, "default source view never allocates a thick mesh");
  assert.equal(flat.paths.length, topology.links.length); assert.equal(new Set(flat.paths.map(path => path.id)).size, flat.paths.length);
  for (const path of flat.paths) {
    assert.ok(path.centerline.points.every(point => point[2] === 0), "disabled hypotheses keep source XY in model plane");
    assert.equal(path.mesh, null); assert.equal(path.frames, null);
    assert.equal(path.sourceXYLength.status, "OK"); assert.equal(path.xyzLength.status, "OK");
    assert.ok(Math.abs(path.deltaLengthMm) < 1e-9); assert.equal(path.xyzLength.unit, "mm");
    assert.ok(topology.links.some(link => link.id === path.linkId));
  }
  assert.equal(flat.scaleEvidence.needlePitchMm, 25.4 / 32); assert.equal(flat.scaleEvidence.physicalFabricScale, "UNKNOWN");
  assert.equal(flat.sectionEvidence.confidence, "TEST_ONLY"); assert.equal(flat.relaxationEligibility.status, "UNSUPPORTED_CONSTRAINTS");
  assert.ok(flat.spatialRelations.every(edge => edge.state === "UNKNOWN"));
  const lifted = buildSopSpatialHypothesis(topology, { enabled: true });
  assert.equal(lifted.status, "OK", JSON.stringify(lifted.diagnostics)); assert.equal(lifted.mode, "SPATIAL_HYPOTHESIS_TEST_ONLY");
  assert.equal(lifted.chainAudit?.status, "OK", "Round7 derives auditable chain measurements from classified continuity");
  assert.equal(lifted.chainAudit.counts.joinedMeshes, 0, "candidate evidence never silently welds the independent Round6 meshes");
  assert.equal(lifted.chainAudit.totals.comparisonTo23And24, "NOT_COMPARABLE");
  assert.equal(lifted.chainAudit.totals.normalizationDenominator, null);
  assert.equal(lifted.chainAudit.totals.transitionLengthMm, 0, "no invented transitions count toward length");
  assert.equal(lifted.chainAudit.physicalContinuity, "UNKNOWN");
  const uniqueChainIds = new Set(topology.continuity.chains.flatMap(chain => chain.linkIds));
  assert.equal(lifted.chainAudit.totals.uniqueLinkCount, uniqueChainIds.size);
  assert.equal(lifted.chainAudit.counts.unreferencedLinks, topology.links.length - uniqueChainIds.size);
  assert.ok(lifted.chainAudit.chains.every(chain => chain.closed === false && chain.mesh === null &&
    chain.evidenceStatus === "CANDIDATE_FROM_MODEL" && chain.physicalContinuity === "UNKNOWN"));
  assert.deepEqual(lifted.sourceMetrics, topology.metrics, "chain diagnostics retain the source M1/M3 records unchanged");
  assert.ok(Math.abs(lifted.chainAudit.totals.xyzMm - lifted.paths.filter(path => uniqueChainIds.has(path.linkId))
    .reduce((sum, path) => sum + path.xyzLength.value, 0)) < 1e-10);
  // Synthetic source segments isolate C0, G1, C1, frame and seam checks without
  // treating a geometric success as evidence about the actual SOP machine.
  function chainFixture(pathModels, evidenceStatus = "CANDIDATE_FROM_MODEL", linkIds) {
    const links = pathModels.map((pathModel, i) => ({ ...topology.links[0], id: `test-link:${i}`, index: i,
      pathModel, sourceOccurrenceId: `test-occ:${i}`, targetOccurrenceId: `test-occ:${i + 1}`,
      boundary: "INTERNAL", sourceBoundary: "IN_ROI", targetBoundary: "IN_ROI", crossFeed: false, crossRow: false }));
    const scope = { snapshotId: topology.identity.key, projectGeneration: topology.identity.projectGeneration,
      revision: topology.identity.feedYarnStructureRevision };
    const ids = linkIds ?? links.map(link => link.id);
    return { ...topology, scale: { ...topology.scale, needlePitchMm: 1 }, links,
      continuity: { status: "CLASSIFIED", ...scope, edges: [], physicalContinuity: "UNKNOWN", chains: [{
        id: "test-chain", ...scope, linkIds: ids, occurrenceIds: links.map(link => link.sourceOccurrenceId).concat(links.at(-1).targetOccurrenceId),
        edgeIds: [], evidenceStatus, evidenceSource: "SYNTHETIC_TEST_ONLY", feedIndex: links[0].feedIndex,
        yarnId: links[0].yarnId, yarnIndex: links[0].yarnIndex, closed: false, physicalContinuity: "UNKNOWN",
        startBoundary: { state: "ROI_CLIPPED" }, endBoundary: { state: "EXTERNAL_BOUNDARY" } }] } };
  }
  const straightFixture = chainFixture(["M0,0L1,0", "M1,0L2,0"]);
  const straight = buildSopSpatialHypothesis(straightFixture, { enabled: true, amplitudeMm: 0 });
  const straightChain = straight.chainAudit.chains[0], straightJoin = straightChain.joins[0];
  for (const key of ["c0", "g1", "c1", "frame", "seam", "caps"]) assert.equal(straightJoin[key].status, "PASS", key);
  assert.equal(straightChain.geometryStatus, "CANDIDATE_ONLY");
  assert.equal(straightChain.mesh, null); assert.equal(straightChain.closed, false);
  assert.ok(Math.abs(straightChain.lengths.sourceXYMm - 2) < 1e-12); assert.ok(Math.abs(straightChain.lengths.xyzMm - 2) < 1e-12);
  assert.equal(straightChain.lengths.ratio, 1); assert.equal(straightChain.lengths.transitionLengthMm, 0);
  assert.equal(straightJoin.seam.uvStatus, "LONGITUDINAL_U_RESTARTS_PER_LINK");
  assert.equal(straightJoin.caps.internalCapCount, 0);
  const softwareConfirmed = buildSopSpatialHypothesis(chainFixture(["M0,0L1,0", "M1,0L2,0"], "CONFIRMED_FROM_SOURCE"));
  assert.equal(softwareConfirmed.chainAudit.chains[0].geometryStatus, "SOURCE_SOFTWARE_ONLY");
  assert.equal(softwareConfirmed.chainAudit.chains[0].physicalContinuity, "UNKNOWN");
  assert.equal(softwareConfirmed.chainAudit.chains[0].mesh, null);
  const unequal = buildSopSpatialHypothesis(chainFixture(["M0,0L1,0", "M1,0L3,0"]), { enabled: true, amplitudeMm: 0 }).chainAudit.chains[0];
  assert.equal(unequal.joins[0].g1.status, "PASS"); assert.equal(unequal.joins[0].c1.status, "FAIL");
  assert.ok(Math.abs(unequal.joins[0].c1.derivativeScaleRatio - 2) < 1e-12, "G1 does not imply equal local-parameter derivative scales");
  const kink = buildSopSpatialHypothesis(chainFixture(["M0,0L1,0", "M1,0L1,1"]), { enabled: true, amplitudeMm: 0 }).chainAudit.chains[0];
  assert.equal(kink.joins[0].c0.status, "PASS"); assert.equal(kink.joins[0].g1.status, "FAIL");
  assert.equal(kink.joins[0].frame.status, "FAIL"); assert.equal(kink.joins[0].seam.status, "FAIL");
  assert.equal(kink.geometryStatus, "DISCONTINUITY"); assert.equal(kink.mesh, null);
  const gap = buildSopSpatialHypothesis(chainFixture(["M0,0L1,0", "M2,0L3,0"]), { enabled: true, amplitudeMm: 0 }).chainAudit.chains[0];
  assert.equal(gap.joins[0].c0.status, "FAIL"); assert.equal(gap.geometryStatus, "DISCONTINUITY");
  assert.ok(Math.abs(gap.lengths.xyzMm - 2) < 1e-12, "geometric gaps are reported, never replaced by invented transitions");
  const duplicate = buildSopSpatialHypothesis(chainFixture(["M0,0L1,0", "M1,0L2,0"], "CANDIDATE_FROM_MODEL", ["test-link:0", "test-link:1", "test-link:0"]));
  assert.ok(Math.abs(duplicate.chainAudit.chains[0].lengths.xyzMm - 2) < 1e-12, "a repeated link reference is integrated only once");
  assert.equal(duplicate.chainAudit.chains[0].geometryStatus, "REJECTED");
  assert.deepEqual(duplicate.chainAudit.chains[0].duplicateLinkIds, ["test-link:0"]);
  const overlappingChains = { ...straightFixture, continuity: { ...straightFixture.continuity,
    chains: [...straightFixture.continuity.chains, { ...straightFixture.continuity.chains[0], id: "overlapping-view" }] } };
  assert.ok(Math.abs(buildSopSpatialHypothesis(overlappingChains).chainAudit.totals.xyzMm - 2) < 1e-12, "derived overlapping views do not multiply aggregate length");
  const flatJoin = buildSopSpatialHypothesis(straightFixture).chainAudit.chains[0].joins[0];
  assert.equal(flatJoin.frame.status, "NOT_BUILT"); assert.equal(flatJoin.seam.status, "NOT_BUILT");
  for (const patch of [{ projectGeneration: -1 }, { revision: -1 }, { snapshotId: "old-snapshot" }]) {
    const stale = buildSopSpatialHypothesis({ ...straightFixture, continuity: { ...straightFixture.continuity, ...patch } });
    assert.equal(stale.chainAudit.status, "INVALID"); assert.deepEqual(stale.chainAudit.chains, []);
  }
  for (const patch of [{ linkIds: ["absent"] }, { closed: true }, { evidenceStatus: "UNKNOWN" }, { evidenceStatus: "REJECTED" }, { revision: -1 }]) {
    const invalid = buildSopSpatialHypothesis({ ...straightFixture, continuity: { ...straightFixture.continuity,
      chains: [{ ...straightFixture.continuity.chains[0], ...patch }] } });
    assert.equal(invalid.chainAudit.status, "INVALID"); assert.deepEqual(invalid.chainAudit.chains, []);
  }
  for (const patch of [{ crossFeed: true }, { crossRow: true }, { boundary: "CLIPPED" }, { yarnId: "different-yarn" }]) {
    const invalid = buildSopSpatialHypothesis({ ...straightFixture,
      links: [{ ...straightFixture.links[0], ...patch }, straightFixture.links[1]] });
    assert.equal(invalid.chainAudit.status, "INVALID"); assert.deepEqual(invalid.chainAudit.chains, []);
  }
  const legacy = buildSopSpatialHypothesis({ ...topology, continuity: undefined });
  assert.equal(legacy.status, "OK"); assert.equal(legacy.chainAudit.status, "UNAVAILABLE");
  assert.equal(legacy.paths.length, topology.links.length, "Round6 topology remains readable without invented classification");
  assert.ok(lifted.paths.some(path => path.centerline.points.some(point => Math.abs(point[2]) > .01)));
  for (const path of lifted.paths) {
    assert.equal(path.centerline.points[0][2], 0); assert.equal(path.centerline.points.at(-1)[2], 0);
    assert.ok(path.xyzLength.value >= path.sourceXYLength.value - 1e-8);
    assert.equal(path.provenance.heightRule.confidence, "ASSUMPTION_TEST_ONLY");
    assert.equal(path.centerline.tangents[0][2], 0); assert.equal(path.centerline.tangents.at(-1)[2], 0);
    const link = topology.links.find(link => link.id === path.linkId);
    const values = link.pathModel.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number).map(v => v * topology.scale.needlePitchMm);
    const controls = Array.from({length: 4}, (_, i) => values.slice(2*i, 2*i+2));
    function speed(t, lifted) {
      const derivative = [0,1].map(axis => 3*(1-t)**2*(controls[1][axis]-controls[0][axis])+6*(1-t)*t*(controls[2][axis]-controls[1][axis])+3*t*t*(controls[3][axis]-controls[2][axis]));
      return Math.hypot(...derivative, lifted ? 32*.3*t*(1-t)*(1-2*t) : 0);
    }
    function simpson(lifted) {
      const n=4096; let sum=speed(0,lifted)+speed(1,lifted);
      for(let i=1;i<n;i++) sum+=(i%2?4:2)*speed(i/n,lifted);
      return sum/(3*n);
    }
    assert.ok(Math.abs(path.xyzLength.value - simpson(true)) < 1e-8, "independent Simpson integral of exact source cubic + declared Z");
    assert.ok(Math.abs(path.sourceXYLength.value - simpson(false)) < 1e-8);
    path.centerline.parameters.forEach((t,i) => {
      for(const axis of [0,1]) {
        const expected=(1-t)**3*controls[0][axis]+3*(1-t)**2*t*controls[1][axis]+3*(1-t)*t*t*controls[2][axis]+t**3*controls[3][axis];
        assert.ok(Math.abs(path.centerline.points[i][axis] - expected)<1e-10, "XY is exact source cubic, not a resampled replacement");
      }
    });
    assert.ok(path.mesh.bounds.max[2] > path.mesh.bounds.min[2]);
  }
  assert.ok(new Set(lifted.paths.map(path => path.yarnId)).size === 2); assert.equal(lifted.scene.length, lifted.paths.length);
  assert.equal(JSON.stringify(topology), before, "geometry consumes topology without changing input"); assert.ok(Object.isFrozen(lifted.paths[0].centerline.points[0]));
  for (const patch of [{ amplitudeMm: NaN }, { radiusMm: 0 }, { sampleCount: 1 }, { enabled: "yes" }]) {
    const failed = buildSopSpatialHypothesis(topology, patch); assert.equal(failed.status, "INVALID"); assert.equal(failed.scene.length, 0);
  }
  for (const options of [null, [], "invalid"]) assert.equal(buildSopSpatialHypothesis(topology, options).status, "INVALID");
  for (const links of [[null], [topology.links[0], topology.links[0]], [{ ...topology.links[0], id: null }]]) {
    const failed = buildSopSpatialHypothesis({...topology, links}); assert.equal(failed.status, "INVALID"); assert.equal(failed.scene.length, 0);
  }
  const missing = buildSopSpatialHypothesis({ ...topology, links: [{ ...topology.links[0], pathModel: "M0,0Q1,1,2,2" }] });
  assert.equal(missing.status, "INVALID"); assert.equal(missing.scene.length, 0);
  const degenerate = buildSopSpatialHypothesis({ ...topology, links: [{ ...topology.links[0], pathModel: "M0,0L0,0" }] });
  assert.equal(degenerate.status, "INVALID"); assert.equal(degenerate.scene.length, 0);
  const cusp = buildSopSpatialHypothesis({ ...topology, links: [{ ...topology.links[0], pathModel: "M0,0C1,0,-1,0,0,0" }] }, {enabled:true});
  assert.equal(cusp.status, "INVALID"); assert.equal(cusp.scene.length, 0, "an actual nonregular source is rejected before lifting");
  const folded = buildSopSpatialHypothesis(topology, {enabled:true,radiusMm:.06});
  assert.equal(folded.status, "INVALID"); assert.equal(folded.scene.length, 0);
  assert.match(folded.diagnostics[0].message, /LOCAL_TUBE_FOLD/, "entered radius is rejected explicitly, never silently shrunk");
  const unavailable = buildSopSpatialHypothesis({ status: "UNAVAILABLE", reason: "NO_MACHINE_SNAPSHOT" }); assert.equal(unavailable.scene.length, 0); assert.equal(unavailable.status, "UNAVAILABLE");
  const result = { status: "PASS", fixtureSha256, links: topology.links.length, paths: lifted.paths.length,
    parameters: lifted.parameters, sourceXYMm: flat.lengths.sourceXYMm, xyzMm: lifted.lengths.xyzMm, deltaMm: lifted.lengths.deltaMm,
    chainAudit: lifted.chainAudit,
    checks: ["real applied source paths", "flat default / zero meshes", "explicit assumed Z and zero endpoint slope", "independent identity", "unknown physical relationships", "Round4 integral versus independent Simpson4096", "exact source XY retained", "readonly topology", "invalid/degenerate/cusp rejection", ".06mm radius fold rejection", "unique chain and union segment length", "C0/G1/C1 derivative scale checks", "independent frame and Float32 ring seam checks", "open caps and unjoined UV restart", "stale generation/revision/snapshot clears audit", "unknown/rejected/bad refs cannot authorize joining", "NOT_COMPARABLE without denominator"],
    perPath: lifted.paths.map(({id,feedIndex,yarnIndex,linkIndex,sourceXYLength,xyzLength,deltaLengthMm,mesh}) => ({id,feedIndex,yarnIndex,linkIndex,sourceXYLength,xyzLength,deltaLengthMm,meshCounts:mesh.counts,bounds:mesh.bounds})) };
  await writeFile(path.join(archiveDir, "geometry-result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({...result, perPath:undefined, chainAudit: { status: lifted.chainAudit.status,
    counts: lifted.chainAudit.counts, totals: lifted.chainAudit.totals }}, null, 2));
});
