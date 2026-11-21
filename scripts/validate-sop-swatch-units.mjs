// Acceptance item 1 of docs/NEXT_TASK.md (three-dimensional geometry gate):
// the SOP interlock swatch publishes centerline coordinates, tube radii, arc
// lengths, audit tolerances and every interface label in one unit, mm.
// Runs on the real entry point (buildSopInterlockSwatch) with the repository SOP.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const bytes = await readFile(new URL('../public/current-SOP.knitscape', import.meta.url));
const digest = createHash('sha256').update(bytes).digest('hex');
assert.equal(digest, '5d63412da9ca4b8e95961d713af41beb614f27b6cc3647030861968b62cb6fb4');
const server = await createServer({ root, configFile: false, appType: 'custom', logLevel: 'silent',
  cacheDir: fileURLToPath(new URL('../.vite-swatch-validation', import.meta.url)),
  server: { middlewareMode: true, hmr: { server: createHttpServer() } } });

const relative = (a, b) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-300);
try {
  const load = file => server.ssrLoadModule('/src/' + file + '.js');
  const [{ readProjectPackage }, { createSingleJerseyExecutionInput }, { computeYarnSimulation },
    { buildSopTopology }, { auditYarnGeometry, AUDIT_DEFAULT_TOLERANCES_MM },
    { buildSopInterlockSwatch, SOP_INTERLOCK_DEFAULTS }, { SOP_INTERLOCK_LAYOUT, sopLayoutMmPerUnit }] = await Promise.all([
    'actions/projectPackage', 'components/singleJerseyExecutionInput', 'simulation/computeYarnSimulation',
    'simulation/sopTopologyAdapter', 'simulation/yarnGeometryAudit', 'simulation/sopInterlockSwatch',
    'simulation/sopInterlockCurve'].map(load));
  const { project } = await readProjectPackage(new Blob([bytes]));
  const feeds = project.singleJerseyCamProgram.feeds;
  const repeatWidth = project.needleArrangement.length, repeatHeight = feeds.length;
  const pattern = createSingleJerseyExecutionInput(project.singleJerseyCamProgram, project.needleArrangement, project.width, project.height);
  const topologyAt = machineGauge => {
    const snapshot = computeYarnSimulation({ pattern, feeds, scope: 'machine', machineGauge,
      yarnSequence: project.yarnSequence, palette: project.yarnPalette, yarnPlies: project.yarnPlies, yarnLibrary: project.yarnLibrary,
      canvasWidth: 640, canvasHeight: 480, inputSignature: digest + '/units/' + machineGauge });
    const topology = buildSopTopology(snapshot, { window: 'full' });
    assert.equal(topology.status, 'READY', topology.reason);
    return topology;
  };
  const options = { repeatWidth, repeatHeight, fullSize: false };

  // 1. Defaults: the only length input is the private layout radius; no mm option is accepted.
  assert.equal(SOP_INTERLOCK_LAYOUT.unit, 'SOP_LAYOUT_UNIT');
  assert.equal(SOP_INTERLOCK_DEFAULTS.radiusMm, undefined, 'radiusMm must be derived, not a default input');
  assert.ok(SOP_INTERLOCK_DEFAULTS.layoutRadius > 0);
  const topology = topologyAt(project.machineGauge);
  const needlePitchMm = 25.4 / project.machineGauge;
  assert.ok(relative(topology.scale.needlePitchMm, needlePitchMm) < 1e-15);
  const rejected = await buildSopInterlockSwatch(topology, { ...options, radiusMm: .035 });
  assert.equal(rejected.status, 'INVALID');
  assert.match(rejected.diagnostics[0].message, /radiusMm is derived/);

  // 2. Published parameters and labels.
  const swatch = await buildSopInterlockSwatch(topology, options);
  assert.equal(swatch.status, 'OK', JSON.stringify(swatch.diagnostics));
  const p = swatch.parameters, k = sopLayoutMmPerUnit(needlePitchMm);
  assert.ok(relative(p.mmPerLayoutUnit, needlePitchMm / SOP_INTERLOCK_LAYOUT.columnPitch) < 1e-15);
  assert.ok(relative(p.mmPerLayoutUnit, k) < 1e-15);
  assert.ok(relative(p.needlePitchMm, needlePitchMm) < 1e-15);
  assert.ok(relative(p.radiusMm, p.layoutRadius * k) < 1e-15);
  assert.deepEqual(p.units, { geometry: 'mm', centerline: 'mm', radius: 'mm', arcLength: 'mm', uvRepeat: 'mm', layoutRadius: 'SOP_LAYOUT_UNIT' });
  assert.equal(swatch.sectionEvidence.unit, 'mm');
  assert.ok(relative(swatch.sectionEvidence.value, p.radiusMm) < 1e-15);
  assert.equal(swatch.coverage.displayForm.layoutUnit, 'SOP_LAYOUT_UNIT');
  assert.ok(relative(swatch.coverage.displayForm.mmPerLayoutUnit, k) < 1e-15);
  const slotRadii = swatch.sectionEvidence.formedRadiiBySlot;
  assert.equal(slotRadii.length, 2);

  // 3. Every path: unit tags, swept radius measured on the actual mesh, arc integrals.
  const meshes = new Map(swatch.scene.map(item => [item.id, item.geometry]));
  let worstRadius = 0, vertexCount = 0;
  const feedYarnArc = new Map();
  for (const path of swatch.paths) {
    const mesh = meshes.get(path.id), centerline = path.centerline, section = path.provenance.section;
    assert.equal(centerline.unit, 'mm', path.id);
    assert.equal(mesh.unit, 'mm', path.id);
    assert.equal(section.unit, 'mm', path.id);
    assert.ok(relative(section.value, slotRadii[path.yarnIndex]) < 1e-15, path.id);
    assert.ok(section.value > 0 && section.value < needlePitchMm, 'Radius must be a fraction of one needle pitch in mm ' + path.id);
    const stride = mesh.counts.radialSegments + 1;
    for (let ring = 0; ring < centerline.points.length; ring++) {
      const c = centerline.points[ring];
      for (let j = 0; j < stride; j++) {
        const v = 3 * (ring * stride + j);
        const r = Math.hypot(mesh.positions[v] - c[0], mesh.positions[v + 1] - c[1], mesh.positions[v + 2] - c[2]);
        worstRadius = Math.max(worstRadius, relative(r, section.value));
        vertexCount++;
      }
    }
    assert.ok(Math.abs(centerline.totalLength - centerline.cumulativeLengths.at(-1)) <= 1e-9 * centerline.totalLength, path.id);
    const cellSum = path.cells.reduce((sum, cell) => sum + cell.arcLengthMm, 0);
    assert.ok(path.cells.every(cell => cell.arcLengthMm > 0 && cell.modelArcLength === undefined), path.id);
    const key = path.feedIndex + '/' + path.yarnIndex;
    feedYarnArc.set(key, (feedYarnArc.get(key) ?? 0) + cellSum);
  }
  // Tube vertices are Float32; a relative radius error of 1e-4 is far below one radius.
  assert.ok(worstRadius < 1e-4, 'Mesh vertices must sit at the published mm radius: ' + worstRadius);
  for (const summary of swatch.coverage.feedYarnLengths) {
    assert.equal(summary.modelArcLength, undefined);
    const own = feedYarnArc.get(summary.sourceFeed + '/' + summary.yarnIndex) ?? 0;
    assert.ok(Math.abs(summary.arcLengthMm - own) <= 1e-9 * Math.max(1, own), 'Feed × yarn arc sum in mm');
  }

  // 4. One conversion only: changing the published gauge scales every output
  //    length by the needle-pitch ratio exactly and changes nothing else.
  const otherGauge = project.machineGauge === 28 ? 24 : 28;
  const scaled = await buildSopInterlockSwatch(topologyAt(otherGauge), options);
  assert.equal(scaled.status, 'OK', JSON.stringify(scaled.diagnostics));
  const ratio = project.machineGauge / otherGauge;
  assert.ok(relative(scaled.parameters.radiusMm, p.radiusMm * ratio) < 1e-12);
  let worstPoint = 0, worstArc = 0;
  assert.equal(scaled.paths.length, swatch.paths.length);
  for (const [i, path] of swatch.paths.entries()) {
    const other = scaled.paths[i];
    assert.deepEqual([other.row, other.feedIndex, other.yarnIndex, other.cells.length], [path.row, path.feedIndex, path.yarnIndex, path.cells.length]);
    const extent = needlePitchMm * Math.max(project.width, project.height);
    path.centerline.points.forEach((point, j) => point.forEach((value, axis) => {
      worstPoint = Math.max(worstPoint, Math.abs(other.centerline.points[j][axis] - value * ratio) / extent);
    }));
    path.cells.forEach((cell, j) => { worstArc = Math.max(worstArc, relative(other.cells[j].arcLengthMm, cell.arcLengthMm * ratio)); });
    assert.ok(relative(other.provenance.section.value, path.provenance.section.value * ratio) < 1e-12);
  }
  assert.ok(worstPoint < 1e-11, 'Gauge change must be a pure uniform scale of the centerline: ' + worstPoint);
  assert.ok(worstArc < 1e-9, 'Gauge change must scale arc lengths exactly: ' + worstArc);

  // 5. Audit tolerances and labels are mm; non-mm inputs and unitless tolerance names are refused.
  assert.deepEqual({ ...AUDIT_DEFAULT_TOLERANCES_MM }, { epsilonMm: 1e-7, cellSizeMm: .25 });
  const firstRows = new Set([...new Set(swatch.paths.map(path => path.row))].sort((a, b) => a - b).slice(0, 3));
  const subset = ids => ({ ...swatch, paths: swatch.paths.filter(x => ids(x)), scene: swatch.scene.filter(item => ids(swatch.paths.find(x => x.id === item.id))) });
  const local = subset(path => firstRows.has(path.row));
  const fast = { yieldControl: () => Promise.resolve() };
  const report = await auditYarnGeometry(local, fast);
  assert.equal(report.status, 'COMPLETE');
  assert.equal(report.units.length, 'mm');
  assert.equal(report.units.epsilonMm, 1e-7);
  assert.equal(report.units.cellSizeMm, .25);
  assert.ok(report.findings.every(f => f.geometryEvidence.unit === undefined || f.geometryEvidence.unit === 'mm'));
  assert.ok(Object.values(report.sources).every(source => source.unit === 'mm' && source.section?.unit === 'mm'));
  const crossings = report.findings.filter(f => f.geometryEvidence.kind === 'SURFACE_CROSSING').length;
  for (const legacy of [{ epsilon: 1e-7 }, { cellSize: .25 }])
    assert.equal((await auditYarnGeometry(local, { ...fast, ...legacy })).status, 'INVALID', 'Unitless tolerance ' + Object.keys(legacy)[0]);
  const relabel = (field, unit) => {
    const [first, ...rest] = local.paths;
    const changed = field === 'centerline' ? { ...first, centerline: { ...first.centerline, unit } }
      : { ...first, provenance: { ...first.provenance, section: { ...first.provenance.section, unit } } };
    return { ...local, paths: [changed, ...rest] };
  };
  for (const field of ['centerline', 'section']) {
    const bad = await auditYarnGeometry(relabel(field, 'SOP_LAYOUT_UNIT'), fast);
    assert.equal(bad.status, 'INVALID', field);
    assert.ok(bad.findings.some(f => f.reason === 'LENGTH_UNIT_NOT_MM'), field);
  }
  // Same geometry at another gauge is a similar figure: crossing count must not change.
  const scaledLocal = { ...scaled, paths: scaled.paths.filter(x => firstRows.has(x.row)),
    scene: scaled.scene.filter(item => firstRows.has(scaled.paths.find(x => x.id === item.id).row)) };
  const scaledReport = await auditYarnGeometry(scaledLocal, { ...fast, cellSizeMm: .25 * ratio });
  assert.equal(scaledReport.status, 'COMPLETE');
  assert.deepEqual(scaledReport.counts.byClassification, report.counts.byClassification);

  console.log(JSON.stringify({ validator: 'sop-swatch-units', status: 'PASS', machineGauge: project.machineGauge,
    needlePitchMm, mmPerLayoutUnit: p.mmPerLayoutUnit, layoutRadius: p.layoutRadius, radiusMm: p.radiusMm, formedRadiiMm: slotRadii,
    meshVerticesChecked: vertexCount, worstRadiusRelativeError: worstRadius, gaugeScaleCheck: { otherGauge, ratio, worstPoint, worstArc },
    audit: { rows: [...firstRows], units: report.units, surfaceCrossings: crossings, byClassification: report.counts.byClassification },
    feedYarnArcLengthMm: swatch.coverage.feedYarnLengths.map(s => ({ feed: s.sourceFeed + 1, yarn: s.yarnIndex + 1, arcLengthMm: s.arcLengthMm, cells: s.eventCount })) }, null, 2));
} finally {
  await server.close();
}
