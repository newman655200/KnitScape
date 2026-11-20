import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { withSopFixtureSnapshot, testOutputDir } from './helpers/sopFixtureSnapshot.mjs';

// Round9 has no existing full-window fixture check: this verifies only the new
// derived view, while the Round6/7 validators retain their numerical assertions.
await withSopFixtureSnapshot(async ({ snapshot, project, server, archiveDir, fixtureSha256 }) => {
  const { buildSopTopology } = await server.ssrLoadModule('/src/simulation/sopTopologyAdapter.js');
  const { buildSopVisualSwatch, SOP_VISUAL_SWATCH_DEFAULTS } = await server.ssrLoadModule('/src/simulation/sopSpatialHypothesis.js');
  assert.equal(typeof buildSopVisualSwatch, 'function', 'Full-window geometry entry point must exist');
  const serialize = value => JSON.stringify(value, (_, item) => item instanceof Map ? [...item] : item);
  const before = serialize(snapshot), started = performance.now();
  const local = buildSopTopology(snapshot), localBefore = serialize(local);
  const topology = buildSopTopology(snapshot, { window: 'full' });
  assert.equal(topology.status, 'READY', topology.reason);
  assert.equal(topology.operations.length, 48 * 60);
  assert.equal(new Set(topology.operations.map(item => `${item.row}:${item.needle}`)).size, 48 * 60);
  const continuityBefore = serialize(topology.continuity);
  const result = buildSopVisualSwatch(topology);
  assert.equal(result.status, 'OK', JSON.stringify(result.diagnostics));
  assert.equal(result.coverage.validCells, 2880);
  assert.equal(result.coverage.generatedCells, 2880);
  assert.equal(result.coverage.expectedAssignments, 5760);
  assert.equal(result.coverage.generatedAssignments, 5760);
  assert.deepEqual(result.coverage.ungeneratedCells, []);
  assert.equal(result.coverage.tiling, 'NONE');
  assert.equal(result.coverage.boundary, 'OPEN_DESIGN_WINDOW');
  assert.equal(result.lengths, null, 'Visual geometry must not become business or physical length');
  assert.equal(result.sectionEvidence.confidence, 'TEST_ONLY');
  assert.equal(result.sectionEvidence.value, SOP_VISUAL_SWATCH_DEFAULTS.radiusMm);
  const occurrences = new Set(topology.occurrences.map(item => item.id));
  topology.links.forEach(link => { occurrences.add(link.sourceOccurrenceId); occurrences.add(link.targetOccurrenceId); });
  const links = new Set(topology.links.map(item => item.id));
  const chains = new Set(topology.continuity.chains.map(item => item.id));
  const pathById = new Map(result.paths.map(item => [item.id, item]));
  assert.equal(pathById.size, result.paths.length);
  for (const item of result.scene) {
    const p = pathById.get(item.id);
    assert.ok(p);
    assert.equal(p.evidenceStatus, 'VISUAL_ASSUMPTION');
    assert.equal(p.physicalContinuity, 'UNKNOWN');
    assert.equal(p.physicalLengthEligible, false);
    assert.equal(item.geometry.status, 'OK');
    assert.ok(item.geometry.indices.length > 0);
    assert.ok(p.centerline.points.length >= 2);
    assert.ok(p.provenance.linkIds.length > 0);
    assert.ok(p.provenance.occurrenceIds.length > 0);
    assert.ok(p.provenance.cnIndices.length > 0);
    assert.ok(p.provenance.linkIds.every(id => links.has(id)));
    assert.ok(p.provenance.occurrenceIds.every(id => occurrences.has(id)));
    assert.ok(p.provenance.chainIds.every(id => chains.has(id)));
  }
  assert.ok(result.scene.some(item => item.geometryRole === 'VISUAL_TRANSITION'));
  assert.ok(result.paths.some(item => item.template === 'TUCK_WITH_HELD_LOOP'));
  assert.ok(result.paths.some(item => item.geometryRole === 'HELD_LOOP_VISUAL'));
  assert.ok(result.evidenceScene.every(item => item.geometryRole === 'STITCH_VISUAL_TEMPLATE'));
  assert.ok(result.evidenceScene.every(item => result.scene.includes(item)), 'Both views reuse one geometry');
  assert.equal(serialize(snapshot), before);
  assert.equal(serialize(local), localBefore);
  assert.equal(serialize(topology.continuity), continuityBefore);
  for (const options of [{ radiusMm: NaN }, { radiusMm: 1 }, { sampleCount: 1 }]) {
    const failed = buildSopVisualSwatch(topology, options);
    assert.equal(failed.status, 'INVALID');
    assert.deepEqual(failed.scene, []);
    assert.deepEqual(failed.paths, []);
  }
  assert.equal(buildSopVisualSwatch(local).status, 'INVALID');
  const stale = { ...topology, identity: { ...topology.identity, projectGeneration: 999 } };
  assert.equal(buildSopVisualSwatch(stale).status, 'INVALID');
  const invalidChain = { ...topology, continuity: { ...topology.continuity, chains: [
    { ...topology.continuity.chains[0], linkIds: ['unknown-source-link'] }] } };
  assert.equal(buildSopVisualSwatch(invalidChain).status, 'INVALID');
  // The supplied SOP has no M. Exercise real ProcessModel float provenance with
  // a separate synthetic K/T/M snapshot; never alter the SOP fixture or output.
  const { createSingleJerseyExecutionInput } = await server.ssrLoadModule('/src/components/singleJerseyExecutionInput.js');
  const { computeYarnSimulation } = await server.ssrLoadModule('/src/simulation/computeYarnSimulation.js');
  const syntheticProgram = { tracks: [['K', 'K', 'K', 'K'], ['K', 'T', 'M', 'K']] };
  const synthetic = computeYarnSimulation({
    pattern: createSingleJerseyExecutionInput(syntheticProgram, [1, 2, 1], 6, 8),
    yarnSequence: project.yarnSequence, palette: project.yarnPalette, yarnPlies: project.yarnPlies,
    machineGauge: project.machineGauge, feeds: project.singleJerseyCamProgram.feeds.slice(0, 4),
    yarnLibrary: project.yarnLibrary, canvasWidth: 640, canvasHeight: 480, scope: 'machine',
    inputSignature: 'TEST_ONLY_KTM_FIXTURE', projectGeneration: 6, feedYarnStructureRevision: 1,
  });
  const syntheticTopology = buildSopTopology(synthetic, { window: 'full' });
  assert.equal(syntheticTopology.status, 'READY', syntheticTopology.reason);
  const ktm = buildSopVisualSwatch(syntheticTopology);
  assert.equal(ktm.status, 'OK', JSON.stringify(ktm.diagnostics));
  assert.equal(ktm.coverage.generatedCells, 48);
  assert.ok(ktm.coverage.operations.M > 0);
  for (const float of ktm.paths.filter(item => item.template === 'MISS_FLOAT_NONZERO')) {
    const a = float.centerline.points[0], b = float.centerline.points.at(-1);
    assert.ok(Math.hypot(...a.map((value, axis) => value - b[axis])) > 0);
    assert.ok(float.provenance.linkIds.length && float.provenance.occurrenceIds.length);
    assert.equal(float.physicalLengthEligible, false);
  }
  const summary = { fixtureSha256, durationMs: performance.now() - started, coverage: result.coverage,
    counts: result.counts, sectionEvidence: result.sectionEvidence, templateEvidence: result.templateEvidence,
    triangles: result.scene.reduce((sum, item) => sum + item.geometry.counts.triangles, 0),
    syntheticKTM: ktm.coverage, regression: 'Snapshot, local ROI and Round7 continuity unchanged' };
  await fs.writeFile(`${archiveDir}/visual-swatch-validation.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log('PASS: full-window visual swatch coverage, provenance, assumption isolation, invalid input and snapshot preservation');
}, { archiveDir: process.env.KNITSCAPE_TEST_OUTPUT_DIR || testOutputDir('sop-visual-swatch') });
