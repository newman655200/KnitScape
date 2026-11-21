import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const fullSize = process.argv.includes('--full-boundaries');
const localKnitRelease = process.argv.includes('--local-knit-release');
// Audit segment i is the tube band from ring i to ring i + 1. Shared rings
// belong to both cells as points, but the outgoing band belongs only to the next cell.
const cellForSegment = (cells, segment) => cells.find(cell => cell.ringStart <= segment && segment < cell.ringEnd);
// Curvature of an actual cubic is |v x v'| / |v|^3. Its extrema are
// roots of N' S - 3 N S', with N=|v x v'|^2 and S=|v|^2. Degree <= 7.
// Checking those roots AND both one-sided segment endpoints catches peaks
// at Catmull joins that an arclength ring grid can completely straddle.
const polynomialAdd = (a, b) => Array.from({length: Math.max(a.length, b.length)}, (_, i) => (a[i] ?? 0) + (b[i] ?? 0));
const polynomialScale = (a, k) => a.map(value => k * value);
const polynomialMultiply = (a, b) => a.reduce((sum, value, i) => polynomialAdd(sum,
  [...Array(i).fill(0), ...b.map(other => value * other)]), []);
const polynomialDerivative = a => a.slice(1).map((value, i) => (i + 1) * value);
const polynomialValue = (a, u) => a.reduceRight((sum, value) => sum * u + value, 0);
function polynomialUnitRoots(input) {
  const a = [...input];
  while (a.length > 1 && Math.abs(a.at(-1)) < 1e-28) a.pop();
  const magnitude = Math.max(...a.map(Math.abs));
  if (!magnitude || a.length < 2) return [];
  const values = a.map(value => value / magnitude);
  if (values.length === 2) {
    const root = -values[0] / values[1];
    return root >= 0 && root <= 1 ? [root] : [];
  }
  const knots = [0, ...polynomialUnitRoots(polynomialDerivative(values)), 1];
  const roots = knots.filter(u => Math.abs(polynomialValue(values, u)) < 1e-13);
  for (let i = 1; i < knots.length; i++) {
    let low = knots[i - 1], high = knots[i], sign = polynomialValue(values, low);
    if (sign * polynomialValue(values, high) >= 0) continue;
    for (let iteration = 0; iteration < 56; iteration++) {
      const middle = (low + high) / 2, value = polynomialValue(values, middle);
      if (value * sign > 0) { low = middle; sign = value; } else high = middle;
    }
    roots.push((low + high) / 2);
  }
  return roots.sort((a, b) => a - b).filter((u, i, sorted) => !i || u - sorted[i - 1] > 1e-10);
}
function actualCubicCurvatureMaximum(segment) {
  const d0 = segment.derivative(0), dm = segment.derivative(.5), d1 = segment.derivative(1);
  const A = d0.map((value, axis) => 2 * (d1[axis] + value - 2 * dm[axis]));
  const B = d0.map((value, axis) => d1[axis] - value - A[axis]);
  const velocity = d0.map((value, axis) => [value, B[axis], A[axis]]);
  const acceleration = velocity.map(polynomialDerivative);
  const cross = [[1, 2], [2, 0], [0, 1]].map(([a, b]) => polynomialAdd(
    polynomialMultiply(velocity[a], acceleration[b]), polynomialScale(polynomialMultiply(velocity[b], acceleration[a]), -1)));
  const squared = vectors => vectors.reduce((sum, vector) => polynomialAdd(sum, polynomialMultiply(vector, vector)), []);
  const numerator = squared(cross), speedSquared = squared(velocity);
  const stationary = polynomialAdd(polynomialMultiply(polynomialDerivative(numerator), speedSquared),
    polynomialScale(polynomialMultiply(numerator, polynomialDerivative(speedSquared)), -3));
  let worst = {curvature: 0, u: 0, point: segment.point(0)};
  for (const u of [0, ...polynomialUnitRoots(stationary), 1]) {
    const speed = polynomialValue(speedSquared, u);
    const curvature = speed > 0 ? Math.sqrt(Math.max(0, polynomialValue(numerator, u))) / speed ** 1.5 : Infinity;
    if (curvature > worst.curvature) worst = {curvature, u, point: segment.point(u)};
  }
  return worst;
}
assert.ok(!(fullSize && localKnitRelease), '--local-knit-release cannot be combined with --full-boundaries');
const root = fileURLToPath(new URL('../', import.meta.url));
const bytes = await readFile(new URL('../public/current-SOP.knitscape', import.meta.url));
const digest = createHash('sha256').update(bytes).digest('hex');
assert.equal(digest, '5d63412da9ca4b8e95961d713af41beb614f27b6cc3647030861968b62cb6fb4');
const server = await createServer({root, configFile: false, appType: 'custom', logLevel: 'silent',
  cacheDir: fileURLToPath(new URL('../.vite-swatch-validation', import.meta.url)),
  server: { middlewareMode: true, hmr: { server: createHttpServer() } } });

try {
  const load = file => server.ssrLoadModule('/src/' + file + '.js');
  const [{ readProjectPackage }, { createSingleJerseyExecutionInput }, { computeYarnSimulation },
    { buildSopTopology }, { auditYarnGeometry }] = await Promise.all([
    'actions/projectPackage', 'components/singleJerseyExecutionInput', 'simulation/computeYarnSimulation',
    'simulation/sopTopologyAdapter', 'simulation/yarnGeometryAudit'].map(load));
  const { project } = await readProjectPackage(new Blob([bytes]));
  const feeds = project.singleJerseyCamProgram.feeds;
  const repeatWidth = project.needleArrangement.length, repeatHeight = feeds.length;
  const pattern = createSingleJerseyExecutionInput(project.singleJerseyCamProgram, project.needleArrangement, project.width, project.height);
  const snapshotWithFeeds = (feeds, signature) => computeYarnSimulation({ pattern, feeds, scope: 'machine', machineGauge: project.machineGauge,
    yarnSequence: project.yarnSequence, palette: project.yarnPalette, yarnPlies: project.yarnPlies, yarnLibrary: project.yarnLibrary,
    canvasWidth: 640, canvasHeight: 480, inputSignature: signature });
  const topology = buildSopTopology(snapshotWithFeeds(feeds, digest), { window: 'full' });
  assert.equal(topology.status, 'READY', topology.reason);
  const { buildSopInterlockSwatch } = await load('simulation/sopInterlockSwatch');
  const referenceRows = new Map();
  const recordReference = (_count, chainId, controls, ringParameters) => {
    assert.ok(chainId && controls?.length && ringParameters?.length, 'Missing actual pre-form row');
    assert.ok(!referenceRows.has(chainId), 'Repeated reference row ' + chainId);
    referenceRows.set(chainId, {controls, ringParameters});
    return true;
  };
  const options = {repeatWidth, repeatHeight, fullSize};
  const swatch = await buildSopInterlockSwatch(topology, options, localKnitRelease ? recordReference : undefined);
  assert.equal(swatch.status, 'OK', JSON.stringify(swatch.diagnostics ?? swatch.reason));

  // Membership is checked against the full machine snapshot, including cells on either side of the repeat seams.
  const operationAt = new Map(topology.operations.map(op => [op.row + '/' + op.needle, op]));
  const chainById = new Map(topology.continuity.chains.map(chain => [chain.id, chain]));
  const unique = new Set(), tubesById = new Map(swatch.scene.map(item => [item.id, item.geometry]));
  const counts = {}, rows = new Set(), needles = new Set();
  for (const p of swatch.paths) {
    assert.equal(p.centerline.closed, false);
    assert.equal(p.centerline.continuity?.regular, true, 'Final plated row must remain regular: ' + p.id);
    assert.equal(p.centerline.continuity?.tangentContinuous, true, 'Final plated row must join smoothly: ' + p.id);
    assert.ok(Array.isArray(p.centerline.controlPoints) && [-1, 1].includes(p.centerline.direction),
      'Final emitted controls and chain direction are required: ' + p.id);
    assert.equal(p.provenance.chainIds.length, 1, p.id);
    const chain = chainById.get(p.provenance.chainIds[0]);
    assert.ok(chain && p.yarnId === chain.yarnId && p.feedIndex === chain.feedIndex && p.yarnIndex === chain.yarnIndex, p.id);
    assert.ok(p.provenance.linkIds.length && p.provenance.linkIds.every(id => chain.linkIds.includes(id)), p.id);
    const mesh = tubesById.get(p.id);
    assert.ok(mesh && mesh.counts.rings === p.centerline.points.length && !mesh.counts.caps);
    assert.equal(p.cells[0].ringStart, 0);
    assert.equal(p.cells.at(-1).ringEnd, mesh.counts.rings - 1);
    assert.equal(p.cells[0].controlStart, 0);
    assert.equal(p.cells.at(-1).controlEnd, p.centerline.controlPoints.length - 1);
    p.cells.forEach((cell, index) => {
      const key = cell.row + '/' + cell.needle;
      const op = operationAt.get(key);
      assert.ok(op && cell.operation === op.operation && p.feedIndex === op.feedIndex, key);
      assert.equal(p.yarnId, feeds[op.feedIndex].yarns[p.yarnIndex].yarnId);
      assert.ok(cell.ringEnd > cell.ringStart);
      assert.ok(Number.isInteger(cell.controlStart) && Number.isInteger(cell.controlEnd) && cell.controlEnd > cell.controlStart);
      if (index) {
        assert.equal(cell.ringStart, p.cells[index - 1].ringEnd, 'missing shared ring ' + key);
        assert.equal(Math.abs(cell.needle - p.cells[index - 1].needle), 1, 'needle jump ' + key);
        assert.equal(cellForSegment(p.cells, cell.ringStart - 1), p.cells[index - 1], 'Incoming seam band source ' + key);
        assert.equal(cellForSegment(p.cells, cell.ringStart), cell, 'Outgoing seam band source ' + key);
        assert.equal(cell.controlStart, p.cells[index - 1].controlEnd, 'Missing shared control ' + key);
      }
      assert.ok(!unique.has(key + '/' + p.yarnIndex), 'duplicate cell ' + key);
      unique.add(key + '/' + p.yarnIndex);
      rows.add(cell.row);
      needles.add(cell.needle);
      counts[cell.operation] = (counts[cell.operation] ?? 0) + 1;
    });
  }
  assert.equal(rows.size, fullSize ? project.height : 2 * repeatHeight);
  assert.equal(needles.size, fullSize ? project.width : 2 * repeatWidth);
  assert.equal(unique.size, rows.size * needles.size * 2);

  const occurrences = new Map(topology.occurrences.map(o => [o.id, o]));
  const headAt = new Map(topology.occurrences.filter(o => o.cnType === 'FH')
    .map(o => [[o.row, o.needle, o.yarnIndex].join('/'), o]));
  const cellAt = new Map();
  const verticalSeam = Math.min(...rows) + repeatHeight;
  let heldOverSeam = 0, releaseGroupMembersOutsideCrop = 0;
  for (const path of swatch.paths) for (const cell of path.cells) {
    const key = [cell.row, cell.needle, path.yarnIndex].join('/');
    assert.equal(cell.releaseRow, headAt.get(key)?.j, 'head migration at ' + key);
    assert.equal(cell.releasingReleaseRow, headAt.get([cell.releaseRow, cell.needle, path.yarnIndex].join('/'))?.j ?? null,
      'Shared release zone must use the releasing K own source head migration');
    // Use the full source FH lookup, not the displayed cells or their group metadata.
    const expectedGroup = [...headAt.values()]
      .filter(head => head.needle === cell.needle && head.j === cell.releaseRow && head.yarnIndex === path.yarnIndex)
      .map(head => ({ row: head.row, operation: operationAt.get(head.row + '/' + cell.needle)?.operation }))
      .sort((a, b) => a.row - b.row);
    assert.ok(expectedGroup.length > 0 && expectedGroup.every(member => ['K', 'T'].includes(member.operation)),
      'Release group members must exist in the full operation source at ' + key);
    assert.deepEqual(cell.releaseGroup, expectedGroup, 'Release group must retain every source head, including outside the crop at ' + key);
    assert.equal(new Set(cell.releaseGroup.map(member => member.row)).size, cell.releaseGroup.length,
      'Duplicate release group row at ' + key);
    assert.ok(cell.releaseGroup.every((member, i, group) => !i || group[i - 1].row < member.row),
      'Release group rows must be strictly ordered at ' + key);
    assert.ok(cell.releaseGroup.some(member => member.row === cell.row && member.operation === cell.operation),
      'Cell is absent from its own release group at ' + key);
    releaseGroupMembersOutsideCrop += cell.releaseGroup.filter(member => !rows.has(member.row)).length;
    if (cell.operation === 'T') {
      let origin = cell.row - 1;
      while (origin >= 0 && operationAt.get(origin + '/' + cell.needle)?.operation !== 'K') origin--;
      assert.equal(cell.heldFromRow, origin >= 0 ? origin : null, 'held K source at ' + key);
    }
    const referencedEnds = [
      [cell.heldHeadIds, cell.operation === 'T' ? cell.heldFromRow : null, 'H'],
      [cell.releasingLegIds, cell.releaseRow < project.height ? cell.releaseRow : null, 'L'],
    ];
    for (const [ids, sourceRow, suffix] of referencedEnds) {
      assert.equal(ids.length, sourceRow === null ? 0 : 2, 'missing paired source at ' + key);
      if (ids.length) {
        const refs = ids.map(id => occurrences.get(id));
        assert.ok(refs.every(o => o && o.row === sourceRow && o.needle === cell.needle &&
          o.yarnIndex === path.yarnIndex && o.cnType.endsWith(suffix)), 'wrong source end at ' + key);
        assert.deepEqual(new Set(refs.map(o => o.finalCnIndex)), new Set(cell.cnIndices));
      }
    }
    if (cell.releaseRow >= verticalSeam && cell.row < verticalSeam &&
      cell.releaseRow - cell.row > 1) heldOverSeam++;
    const controls = path.centerline.controlPoints.slice(cell.controlStart, cell.controlEnd + 1);
    if (path.centerline.direction < 0) controls.reverse();
    cellAt.set(key, {cell, controls, points: path.centerline.points.slice(cell.ringStart, cell.ringEnd + 1)});
  }
  assert.ok(heldOverSeam > 0, 'No source-confirmed migrated heads across repeat seam');
  if (!fullSize) assert.ok(releaseGroupMembersOutsideCrop > 0, 'Fixture must exercise release membership outside the display crop');
  for (const {cell} of cellAt.values()) {
    const first = cellAt.get([cell.row, cell.needle, 0].join('/'))?.cell;
    const second = cellAt.get([cell.row, cell.needle, 1].join('/'))?.cell;
    assert.ok(first && second, 'Both yarn slots must exist for release group comparison');
    assert.deepEqual(first.releaseGroup, second.releaseGroup,
      'Both yarn slots must preserve the same ordered source release group at ' + cell.row + '/' + cell.needle);
  }

  const finalThroat = { scope: 'Pre-form plated Catmull; entryStart through mother phase 5 and mirror',
    requiredAxisDistance: swatch.parameters.layoutRadius + .005, checkedBranches: 0, worst: null, failures: [] };
  const finalCurvature = { method: 'Actual row cubics; 513 uniform parameter positions plus analytic derivative breakpoints per role segment',
    criterion: 'radius * curvature < 1', cases: [], failures: [] };
  const finalAllCurvature = {method: 'Every actual audited row cubic; both one-sided endpoints and all real curvature-extremum roots',
    criterion: 'radius * curvature < 1', checkedRows: [], checkedCubics: 0, worst: null, failures: []};
  const finalTubeSampling = { method: 'Actual row cubic segments restricted to the cell without refitting; existing sampler/transport/tube APIs',
    sampleCounts: [65, 513], cases: [], failures: [] };
  const formedChecks = { rows: 0, rings: 0, cellArcIntegrals: 0, editRoundTrips: [] };
  if (localKnitRelease) {
    const { interlockExpansionOffsets, SOP_INTERLOCK_LAYOUT } = await load('simulation/sopInterlockCurve');
    const { createSpatialCurve, buildSpatialPath } = await load('simulation/yarnSpatialPath');
    const { buildParallelTransportFrames } = await load('simulation/yarnParallelTransport');
    const { buildYarnTubeGeometry } = await load('simulation/yarnTubeGeometry');
    const { measureSpatialLength } = await load('simulation/yarnSpatialLength');
    assert.equal(referenceRows.size, swatch.paths.length);
    const nearestPhase = (roles, phase) => roles.phases.slice(0, roles.crown + 1)
      .reduce((best, value, i) => Math.abs(value - phase) < Math.abs(roles.phases[best] - phase) ? i : best, 0);
    const indicesBetween = (start, end) => Array.from({length: Math.max(0, end - start)}, (_, i) => start + i);
    const actualSegment = (path, cell, canonical) => path.centerline.direction > 0
      ? cell.controlStart + canonical : cell.controlEnd - canonical - 1;
    assert.deepEqual([swatch.coverage.needleStart, swatch.coverage.rowStart, needles.size, rows.size], [16, 16, 8, 16]);
    const endIds = (cell, suffix) => new Set(cell.occurrenceIds
      .filter(id => occurrences.get(id).cnType.endsWith(suffix)));
    for (const yarnIndex of [0, 1]) {
      const cells = [[21, 19], [22, 19], [21, 16], [22, 16], [23, 16], [24, 16]]
        .map(([row, needle]) => cellAt.get([row, needle, yarnIndex].join('/'))?.cell);
      assert.ok(cells.every(Boolean), 'Missing local K release or neighbouring T source cells');
      const [oldK, newK, heldK, firstT, secondT, releasingK] = cells;
      assert.deepEqual(oldK.releaseGroup, [{ row: 21, operation: 'K' }], 'Ordinary K must use its explicit one-member source group');
      const heldReleaseGroup = [{ row: 21, operation: 'K' }, { row: 22, operation: 'T' }, { row: 23, operation: 'T' }];
      for (const cell of [heldK, firstT, secondT]) assert.deepEqual(cell.releaseGroup, heldReleaseGroup,
        'Held K, T1 and T2 must receive the same explicit source group');
      assert.deepEqual([oldK.operation, newK.operation, oldK.releaseRow], ['K', 'K', 22],
        'Core must be K21/19 released by K22/19');
      assert.deepEqual(new Set(oldK.releasingLegIds), endIds(newK, 'L'),
        'K21/19 heads must reference both K22/19 legs');
      assert.deepEqual([oldK.knitExitRow, newK.knitEntryRow], [22, 21], 'Both ends must use the same ordinary K joint');
      for (const cell of cells) {
        const { controls } = cellAt.get([cell.row, cell.needle, yarnIndex].join('/'));
        const roles = cell.controlRoles, last = controls.length - 1;
        assert.ok(roles && controls.length % 2 === 1 && roles.crown === last / 2,
          'Final controls must retain explicit mirrored semantic roles');
        assert.equal(roles.phases.length, controls.length);
        assert.deepEqual(roles.phases, [...roles.phases].reverse(), 'Mother roles must mirror around the crown');
        assert.ok(roles.entryStart < roles.entryEnd && roles.freeLegStart < roles.freeLegEnd &&
          roles.freeLegEnd < roles.shoulder && roles.shoulder < roles.crown, 'Role ordering changed');
        assert.deepEqual(roles.protectedIndices, [...new Set(roles.protectedIndices)].sort((a, b) => a - b));
        assert.ok(roles.protectedIndices.every(i => Number.isInteger(i) && i >= 0 && i <= last));
        assert.ok(roles.protectedIndices.every(i => roles.protectedIndices.includes(last - i)),
          'Protected geometric roles must be mirrored');
        for (const index of [...roles.anchorIndices, 0, roles.crown]) {
          assert.ok(roles.protectedIndices.includes(index) && roles.protectedIndices.includes(last - index),
            'Fixed geometric anchors and their mirrors must be protected');
        }
        const offsets = interlockExpansionOffsets(controls, roles);
        for (const index of roles.protectedIndices) {
          assert.deepEqual(offsets[index], [0, 0, 0], 'Length ratio must not move final joint anchors');
        }
        assert.ok(offsets.some((offset, i) => !roles.protectedIndices.includes(i) && Math.hypot(...offset) > 1e-12),
          'Each final cell must retain a nonzero free bend for independent length response');
      }
      assert.deepEqual([heldK, firstT, secondT, releasingK].map(cell => cell.operation), ['K', 'T', 'T', 'K'],
        'Neighbour must be K21/16 -> T22/16 -> T23/16 -> K24/16');
      assert.equal(heldK.knitExitRow, null, 'Held K head must retain its stack shape');
      assert.equal(releasingK.knitEntryRow, null, 'A T stack release must retain its entry shape');
      for (const cell of [firstT, secondT]) assert.deepEqual([cell.knitEntryRow, cell.knitExitRow], [null, null]);
      for (const cell of [heldK, firstT, secondT]) {
        assert.equal(cell.releaseRow, 24, 'Neighbouring held and tuck heads must release at row24');
        assert.deepEqual(new Set(cell.releasingLegIds), endIds(releasingK, 'L'),
          'Neighbouring held and tuck heads must reference both K24/16 legs');
      }
      for (const cell of [firstT, secondT]) {
        assert.equal(cell.heldFromRow, 21);
        assert.deepEqual(new Set(cell.heldHeadIds), endIds(heldK, 'H'),
          'Both neighbouring tucks must reference K21/16 heads');
      }
    }
    for (const slot of [0, 1]) {
      const [k, t1, t2, release] = [21, 22, 23, 24].map(row => cellAt.get([row, 20, slot].join('/')).cell);
      assert.deepEqual([k, t1, t2, release].map(c => c.operation), ['K', 'T', 'T', 'K'], 'Needle 21');
      for (const tuck of [t1, t2]) {
        assert.equal(tuck.heldFromRow, k.row);
        assert.deepEqual(new Set(tuck.heldHeadIds), endIds(k, 'H'));
      }
      for (const old of [k, t1, t2]) {
        assert.equal(old.releaseRow, release.row);
        assert.deepEqual(new Set(old.releasingLegIds), endIds(release, 'L'));
      }
    }
    // Select all visible source rows whose actual cubics can reach the local
    // source-cell envelope. A held loop may begin before the five focus rows.
    // Both slots and complete rows stay present; mesh audit is never clipped.
    const curves = new Map(), boundsByPath = new Map();
    const emptyBounds = () => ({min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity]});
    const include = (bounds, point) => point.forEach((value, axis) => {
      bounds.min[axis] = Math.min(bounds.min[axis], value); bounds.max[axis] = Math.max(bounds.max[axis], value);
    });
    const focusBounds = emptyBounds();
    for (const path of swatch.paths) {
      const {controls, ringParameters} = referenceRows.get(path.provenance.chainIds[0]);
      const formed = createSpatialCurve({type: 'catmull-rom', points: path.centerline.controlPoints, closed: false, unit: 'mm'});
      assert.equal(formed.status, 'OK', path.id);
      const curve = formed.curve, integral = measureSpatialLength(curve);
      assert.ok(curve.regular && curve.continuity.tangentContinuous, 'Invalid formed Catmull ' + path.id);
      assert.equal(integral.status, 'OK', path.id);
      assert.equal(ringParameters.length, path.centerline.points.length);
      // Pre-form controls are SOP_LAYOUT_UNIT; formed controls are mm.
      assert.ok(controls.some((p, i) => Math.abs(p[1] * swatch.parameters.mmPerLayoutUnit - path.centerline.controlPoints[i][1]) > 1e-8),
        'Missing released-fabric deformation ' + path.id);
      for (const [i, t] of ringParameters.entries()) {
        const point = curve.point(t);
        assert.ok(point.every((v, k) => Math.abs(v - path.centerline.points[i][k]) < 1e-9), 'Formed ring parameter ' + path.id);
      }
      for (const cell of path.cells) {
        const arc = integral.cumulativeLengths[cell.controlEnd] - integral.cumulativeLengths[cell.controlStart];
        assert.ok(arc > 0 && Math.abs(arc - cell.arcLengthMm) < 1e-9, 'Formed cell arc ' + path.id);
      }
      const mesh = tubesById.get(path.id), lastRing = ringParameters.length - 1;
      const finalUv = mesh.uv[lastRing * (mesh.counts.radialSegments + 1) * 2];
      assert.ok(Math.abs(finalUv * swatch.parameters.uvRepeatLengthMm - integral.totalLength) < 1e-5,
        'End-ring UV distance must follow the formed integral ' + path.id);
      formedChecks.rows++;
      formedChecks.rings += ringParameters.length;
      formedChecks.cellArcIntegrals += path.cells.length;

      // Apply the original circular section constraints before the section is formed.
      const actual = createSpatialCurve({type: 'catmull-rom', points: controls, closed: false, unit: 'mm'});
      assert.equal(actual.status, 'OK', 'Invalid pre-form context row ' + path.id);
      curves.set(path.id, actual);
      const bounds = emptyBounds();
      for (const segment of actual.curve.segments) for (const u of [0, ...segment.integrationBreakpoints, 1]) include(bounds, segment.point(u));
      boundsByPath.set(path.id, bounds);
      if (path.row >= 20 && path.row <= 24) { include(focusBounds, bounds.min); include(focusBounds, bounds.max); }
    }
    const selectedRows = new Set(swatch.paths.filter(path => {
      const bounds = boundsByPath.get(path.id), padding = 2 * swatch.parameters.layoutRadius;
      return [0, 1, 2].every(axis => bounds.min[axis] <= focusBounds.max[axis] + padding && bounds.max[axis] >= focusBounds.min[axis] - padding);
    }).map(path => path.row));
    const localAuditPaths = swatch.paths.filter(path => selectedRows.has(path.row));
    assert.ok(localAuditPaths.some(path => path.row < 20) && localAuditPaths.some(path => path.row > 24),
      'Fixture must audit complete held-source and following-row context around the focus');
    finalAllCurvature.checkedRows = [...selectedRows].sort((a, b) => a - b);
    for (const path of localAuditPaths) {
      const actual = curves.get(path.id).curve;
      for (let segmentIndex = 0; segmentIndex < actual.segments.length; segmentIndex++) {
        const maximum = actualCubicCurvatureMaximum(actual.segments[segmentIndex]);
        // [controlStart, controlEnd): the same actual outgoing-band ownership
        // used by the strict mesh audit. Both derivative limits are still tested.
        const cell = path.cells.find(cell => cell.controlStart <= segmentIndex && segmentIndex < cell.controlEnd);
        assert.ok(cell, 'Actual curvature segment has no half-open source owner');
        const canonicalSegment = path.centerline.direction > 0 ? segmentIndex - cell.controlStart : cell.controlEnd - segmentIndex - 1;
        const result = {pathId: path.id, row: cell.row, needle: cell.needle, operation: cell.operation,
          yarnIndex: path.yarnIndex, segmentIndex, canonicalSegment,
          rowSegmentParameter: maximum.u, canonicalParameter: path.centerline.direction > 0 ? maximum.u : 1 - maximum.u,
          curvature: maximum.curvature, radiusTimesCurvature: swatch.parameters.layoutRadius * maximum.curvature,
          bendingRadius: maximum.curvature > 0 ? 1 / maximum.curvature : null, point: maximum.point};
        finalAllCurvature.checkedCubics++;
        if (!finalAllCurvature.worst || result.radiusTimesCurvature > finalAllCurvature.worst.radiusTimesCurvature)
          finalAllCurvature.worst = result;
        if (!(result.radiusTimesCurvature < 1)) finalAllCurvature.failures.push(result);
      }
    }

    for (const path of swatch.paths.filter(p => p.row >= 20 && p.row <= 24)) {
      // Recreate the exact emitted curve from its final controls. Do not fit a
      // second Catmull curve through the sampled centerline or rebuild the seed.
      const created = curves.get(path.id);
      assert.equal(created.status, 'OK', 'Invalid final plated row');
      assert.ok(created.curve.regular && created.curve.continuity.tangentContinuous, 'Non-smooth final plated row');
      for (const cell of path.cells) {
        const last = cell.controlEnd - cell.controlStart;
        const centerX = cell.needle * SOP_INTERLOCK_LAYOUT.columnPitch;
        const roles = cell.controlRoles;
        const throatSegments = indicesBetween(roles.entryStart, nearestPhase(roles, 5));
        assert.ok(throatSegments.length, 'Throat role must cover actual emitted segments');
        for (const [side, sign, segments] of path.yarnIndex === 1 ? [
          ['left', -1, throatSegments], ['right', 1, throatSegments.map(i => last - i - 1)]] : []) {
          let closest = { distanceFromAxis: Infinity };
          for (const canonicalSegment of segments) {
            const segmentIndex = actualSegment(path, cell, canonicalSegment);
            const segment = created.curve.segments[segmentIndex];
            for (const u of [0, ...segment.integrationBreakpoints, 1]) {
              const x = segment.point(u)[0] - centerX, distanceFromAxis = sign * x;
              if (distanceFromAxis < closest.distanceFromAxis)
                closest = { row: cell.row, needle: cell.needle, operation: cell.operation, yarnIndex: path.yarnIndex,
                  side, canonicalSegment, segmentIndex, u, x, distanceFromAxis };
            }
          }
          finalThroat.checkedBranches++;
          if (!finalThroat.worst || closest.distanceFromAxis < finalThroat.worst.distanceFromAxis) finalThroat.worst = closest;
          if (closest.distanceFromAxis < finalThroat.requiredAxisDistance - 1e-12) finalThroat.failures.push(closest);
        }
        const knownK = cell.operation === 'K' && ((cell.needle === 19 && [21, 22].includes(cell.row)) ||
          cell.needle === 16 && cell.row === 21);
        const secondT = cell.operation === 'T' && cell.needle === 16 && cell.row === 23;
        if (!knownK && !secondT) continue;
        const roleName = knownK ? 'K_VISIBLE_LEG_AND_SHOULDER' : 'SECOND_T_BIRTH_AND_CARRY_ENTRY';
        const leftSegments = indicesBetween(knownK ? Math.max(0, roles.freeLegStart - 1) : 0, knownK ? nearestPhase(roles, 9) : roles.freeLegStart + 2);
        for (const [side, segments] of [['left', leftSegments], ['right', leftSegments.map(i => last - i - 1)]]) {
          assert.ok(segments.length, 'Known curvature role must cover an actual segment');
          let worst = { radiusTimesCurvature: -Infinity };
          for (const canonicalSegment of segments) {
            const segmentIndex = actualSegment(path, cell, canonicalSegment), segment = created.curve.segments[segmentIndex];
            const d0 = segment.derivative(0), dm = segment.derivative(.5), d1 = segment.derivative(1);
            // A cubic's derivative is quadratic, so its second derivative is
            // recovered exactly from these three existing API evaluations.
            const A = d0.map((v, axis) => 2 * (d1[axis] + v - 2 * dm[axis]));
            const B = d0.map((v, axis) => d1[axis] - v - A[axis]);
            for (const u of [...Array.from({length: 513}, (_, i) => i / 512), ...segment.integrationBreakpoints]) {
              const v = segment.derivative(u), a = A.map((value, axis) => 2 * value * u + B[axis]);
              const cross = [v[1]*a[2]-v[2]*a[1], v[2]*a[0]-v[0]*a[2], v[0]*a[1]-v[1]*a[0]];
              const curvature = Math.hypot(...cross) / Math.hypot(...v) ** 3;
              const radiusTimesCurvature = swatch.parameters.layoutRadius * curvature;
              if (!Number.isFinite(radiusTimesCurvature) || radiusTimesCurvature > worst.radiusTimesCurvature)
                worst = { canonicalSegment, segmentIndex, u, curvature, radiusTimesCurvature };
            }
          }
          const result = { row: cell.row, needle: cell.needle, yarnIndex: path.yarnIndex, role: roleName, side, ...worst };
          finalCurvature.cases.push(result);
          if (!(worst.radiusTimesCurvature < 1)) finalCurvature.failures.push(result);
        }
        // Restrict the already emitted row cubics. Keeping their endpoint
        // derivatives retains the real neighbouring-cell context at both joins.
        const segments = created.curve.segments.slice(cell.controlStart, cell.controlEnd);
        const evaluate = (method, t) => {
          const j = Math.min(segments.length - 1, Math.floor(t * segments.length));
          const value = segments[j][method](t * segments.length - j);
          return method === 'derivative' ? value.map(v => v * segments.length) : value;
        };
        const cellCurve = { ...created.curve, segments,
          point: t => evaluate('point', t), derivative: t => evaluate('derivative', t) };
        for (const sampleCount of finalTubeSampling.sampleCounts) {
          const sampled = buildSpatialPath(cellCurve, {sampleCount});
          const frames = sampled.status === 'OK' ? buildParallelTransportFrames(sampled) : null;
          const tube = frames?.status === 'OK' ? buildYarnTubeGeometry({path: sampled, frames,
            radiusA: swatch.parameters.layoutRadius, radialSegments: swatch.parameters.radialSegments,
            capEnds: false, uvRepeatLength: 1}) : null;
          const result = {row: cell.row, needle: cell.needle, yarnIndex: path.yarnIndex, sampleCount,
            status: tube?.status ?? frames?.status ?? sampled.status,
            failureStage: sampled.status !== 'OK' ? 'sampling' : frames?.status !== 'OK' ? 'transport' : tube?.status !== 'OK' ? 'tube' : null,
            diagnostics: tube?.diagnostics ?? frames?.diagnostics ?? sampled.diagnostics};
          finalTubeSampling.cases.push(result);
          if (result.status !== 'OK') finalTubeSampling.failures.push(result);
        }
      }
    }
  }

  // Compare a released loop with the new K at its own needle. Signed depth
  // is sampled in the front projection only and has no machine-order authority.
  const depthSigns = { frontOnly: 0, rearOnly: 0, both: 0, noProjectionCrossing: 0 };
  for (const path of swatch.paths) for (const cell of path.cells) {
    if (localKnitRelease && (cell.row < 20 || cell.row > 23 || cell.releaseRow < 20 || cell.releaseRow > 24)) continue;
    const old = cellAt.get([cell.row, cell.needle, path.yarnIndex].join('/')).points;
    for (let slot = 0; slot < 2; slot++) {
      const incoming = cellAt.get([cell.releaseRow, cell.needle, slot].join('/'));
      if (!incoming || incoming.cell.operation !== 'K' || cell.releaseRow <= cell.row) continue;
      const next = incoming.points;
      let front = false, rear = false;
      for (let a = 1; a < old.length; a++) for (let b = 1; b < next.length; b++) {
        const p = old[a - 1], q = old[a], r = next[b - 1], s = next[b];
        const ux = q[0] - p[0], uy = q[1] - p[1], vx = s[0] - r[0], vy = s[1] - r[1];
        const det = ux * vy - uy * vx;
        if (Math.abs(det) < 1e-12) continue;
        const dx = r[0] - p[0], dy = r[1] - p[1];
        const t = (dx * vy - dy * vx) / det, u = (dx * uy - dy * ux) / det;
        if (t < 0 || t > 1 || u < 0 || u > 1) continue;
        const z = p[2] + t * (q[2] - p[2]) - r[2] - u * (s[2] - r[2]);
        if (z > 1e-7) front = true;
        if (z < -1e-7) rear = true;
      }
      const classification = front && rear ? 'both' : front ? 'frontOnly' : rear ? 'rearOnly' : 'noProjectionCrossing';
      depthSigns[classification]++;
    }
  }
  // Audit every emitted tube, in both the repeat window and the full design.
  // The full sheet used to keep only the two ends, leaving the central bulk
  // unproven; it is now audited in full (48x60: ~17.7M triangles, slow).
  const auditPaths = swatch.paths;
  const auditIds = new Set(auditPaths.map(p => p.id));
  const target = { ...swatch, paths: auditPaths, scene: swatch.scene.filter(item => auditIds.has(item.id)) };
  const audit = await auditYarnGeometry(target, { yieldControl: () => Promise.resolve() });
  const summary = {}, failures = [];
  const pathById = new Map(swatch.paths.map(p => [p.id, p]));
  for (const hit of audit.findings) {
    const {kind, segmentIndices, closestPoints} = hit.geometryEvidence;
    summary[kind] = (summary[kind] ?? 0) + hit.occurrenceCount;
    if (kind === 'SURFACE_CROSSING' || hit.relation === 'ABNORMAL_GEOMETRY') {
      const cells = hit.sourcePathIds.map((id, index) => {
        const p = pathById.get(id);
        const ring = segmentIndices?.[index];
        const cell = cellForSegment(p.cells, ring);
        return {row: p.row, yarn: p.yarnIndex, needle: cell?.needle, operation: cell?.operation, ring};
      });
      failures.push({kind, cells, closestPoints, bands: hit.occurrenceCount});
    }
  }
  if (localKnitRelease) {
    const describe = sample => new Map(sample.paths.map((path, i) => {
      const item = sample.scene[i];
      assert.equal(item.id, path.id);
      return [path.row + '/' + path.yarnIndex, { feed: path.feedIndex, slot: path.yarnIndex,
        yarnId: path.yarnId, needles: path.cells.map(c => c.needle),
        integral: path.cells.reduce((sum, c) => sum + c.arcLengthMm, 0),
        shape: createHash('sha256').update(item.geometry.positions).digest('hex') }];
    }));
    const original = describe(swatch);
    for (const [slot, field, value] of [[0, 'yarnLengthCmPer100Needles', 25], [1, 'relaxedLengthCmPer100Needles', 8.2]]) {
      const editedFeeds = structuredClone(feeds);
      editedFeeds[0].yarns[slot][field] = value;
      for (const restore of [false, true]) {
        if (restore) editedFeeds[0].yarns[slot][field] = feeds[0].yarns[slot][field];
        const source = buildSopTopology(snapshotWithFeeds(editedFeeds, digest + '/edit/' + slot + '/' + restore), {window: 'full'});
        assert.equal(source.status, 'READY');
        const sample = await buildSopInterlockSwatch(source, options);
        assert.equal(sample.status, 'OK', JSON.stringify(sample.diagnostics));
        const results = describe(sample), changedRows = [];
        assert.equal(results.size, original.size);
        for (const [key, record] of results) {
          const prior = original.get(key);
          assert.equal(record.feed, prior.feed);
          assert.equal(record.yarnId, prior.yarnId);
          assert.deepEqual(record.needles, prior.needles);
          if (!restore && prior.feed === 0 && prior.slot === slot) {
            assert.notEqual(record.shape, prior.shape, 'Requested formed row stayed fixed ' + key);
            assert.ok(Math.abs(record.integral - prior.integral) > 1e-9, 'Missing formed arc response ' + key);
            changedRows.push(key);
          } else assert.deepEqual(record, prior, 'Unrelated or restored formed row changed ' + key);
        }
        assert.equal(changedRows.length, restore ? 0 : 2);
        formedChecks.editRoundTrips.push({feed: 1, slot: slot + 1, restore, changedRows});
      }
    }
  }
  console.log(JSON.stringify({sopDigest: digest, repeat: [repeatWidth, repeatHeight],
    ...(localKnitRelease ? {auditScope: 'SMALL_FINAL_SWATCH_ALL_ROWS', preFormCircularChecks: { finalThroat, finalCurvature, finalAllCurvature, finalTubeSampling }, formedChecks} : {}),
    window: [needles.size, rows.size], paths: swatch.paths.length, dispositions: counts, heldOverSeam, releaseGroupMembersOutsideCrop, releasePairDepthSigns: depthSigns,
    auditedRows: [...new Set(auditPaths.map(p => p.row))], meshTriangles: audit.statistics.examinedMeshTriangles, auditStatus: audit.status, bandWitnesses: summary,
    failures: failures.slice(0, 12)}, null, 2));
  assert.equal(audit.status, 'COMPLETE');
  assert.ok(audit.statistics.examinedMeshTriangles === target.scene.reduce((n, item) => n + item.geometry.counts.triangles, 0));
  assert.deepEqual(finalThroat.failures, [], 'Pre-form plated Yarn 2 throat must remain at least radius + .005 from the needle axis on each side');
  assert.deepEqual(finalAllCurvature.failures, [], 'PRE_FORM_CURVATURE: every actual reference cubic must satisfy radius * curvature < 1, including narrow one-sided join peaks');
  assert.deepEqual(finalCurvature.failures, [], 'Pre-form plated visible leg/shoulder and second T birth/entry require radius * curvature < 1');
  assert.deepEqual(finalTubeSampling.failures, [], 'Pre-form actual cell cubics must pass existing tube construction at both 65 and 513 samples');
  assert.equal(failures.length, 0, 'Strict surface crossings or invalid mesh geometry on the displayed swatch');
  assert.ok(depthSigns.both > 0 && depthSigns.frontOnly + depthSigns.rearOnly + depthSigns.noProjectionCrossing === 0,
    'Released loops and incoming K must pass on both sides in the front projection of this SOP sample');
} finally {
  await server.close();
}




