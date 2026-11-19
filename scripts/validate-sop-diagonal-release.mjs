import assert from 'node:assert/strict';
import * as curve from '../src/simulation/sopInterlockCurve.js';
import { createSpatialCurve, buildSpatialPath } from '../src/simulation/yarnSpatialPath.js';
import { measureSpatialLength } from '../src/simulation/yarnSpatialLength.js';
import { buildParallelTransportFrames } from '../src/simulation/yarnParallelTransport.js';
import { buildYarnTubeGeometry } from '../src/simulation/yarnTubeGeometry.js';
const layout = curve.SOP_INTERLOCK_LAYOUT;
assert.ok(layout && layout.columnPitch < 1, 'Explicit compact display column spacing is required');
assert.equal(layout.columnPitch, .68, 'This clearance correction must preserve the column pitch');
assert.equal(layout.courseStep, .48, 'This clearance correction must preserve the course step');
const radiusMm = .035;
// Complete source columns continue through row 30; only their final K has no
// published releasing K. Cropping is performed after these dependencies exist.
function sourceFixture(holds = [{ needle: 16, row: 21, courses: 3, tucks: true },
  { needle: 20, row: 20, courses: 3, tucks: true }]) {
  const cells = [];
  for (let needle = 16; needle <= 20; needle++) {
    let heldFromRow = null;
    const column = [];
    for (let row = 20; row <= 30; row++) {
      const hold = holds.find(h => h.needle === needle && row > h.row && row < h.row + h.courses);
      if (hold && !hold.tucks) continue; // M preserves the K without adding a T path.
      const operation = hold ? 'T' : 'K';
      if (operation === 'K') heldFromRow = row;
      column.push({ row, needle, operation, heldFromRow, radiusMm });
    }
    for (const cell of column) {
      const releasing = column.find(c => c.row > cell.row && c.operation === 'K');
      cell.releaseRow = releasing?.row ?? 31;
      cell.releasingReleaseRow = releasing
        ? column.find(c => c.row > releasing.row && c.operation === 'K')?.row ?? 31 : null;
      cell.releaseBoundary = releasing ? null : 'OPEN_UPPER_SOURCE_EDGE';
      cell.releaseGroup = column.filter(c => c.row < cell.releaseRow &&
        c.row >= (column.filter(c => c.operation === 'K' && c.row < cell.releaseRow).at(-1)?.row ?? 20))
        .map(c => ({ row: c.row, operation: c.operation }));
    }
    cells.push(...column);
  }
  const layouts = curve.buildInterlockBaseLayouts(cells, radiusMm);
  const cellAt = (row, needle) => cells.find(c => c.row === row && c.needle === needle);
  const controls = (cell, yarnIndex) => curve.interlockCellControls({ ...cell, yarnIndex,
    commonLayout: layouts.get(cell.row + '/' + cell.needle) });
  return { cells, layouts, cellAt, controls };
}
const fixture = sourceFixture(), base = fixture.cellAt(21, 19);
const ordinaryOnly = sourceFixture([]), ordinaryOnlyCell = ordinaryOnly.cellAt(21, 19);
for (const slot of [0, 1]) {
  const common = ordinaryOnly.layouts.get('21/19');
  assert.equal(common.design.memberCount, 1, 'The all-K source fixture must have a one-member shared entry');
  assert.equal(ordinaryOnly.controls(ordinaryOnlyCell, slot).length, 75,
    'The fixed-radius one-member ordinary primitive retains its 75-point interface');
}
const cellRoles = (source, cell) => source.layouts.get(cell.row + '/' + cell.needle).roles;
// Reuse the actual complete source row, including both adjacent controls at
// the cell boundaries. Restrict its existing cubics; never refit samples.
function actualSourceCellCurve(source, cell, yarnIndex, override) {
  const controls = [], ranges = [];
  for (const other of source.cells.filter(value => value.row === cell.row).sort((a, b) => a.needle - b.needle)) {
    const points = other.needle === cell.needle && override ? override : source.controls(other, yarnIndex);
    const start = controls.length ? controls.length - 1 : 0;
    if (controls.length) assert.ok(Math.hypot(...controls.at(-1).map((value, axis) => value - points[0][axis])) < 1e-12,
      'Actual source row contains an unmodelled join');
    controls.push(...(controls.length ? points.slice(1) : points));
    ranges.push({needle: other.needle, start, end: controls.length - 1});
  }
  const actual = createSpatialCurve({type: 'catmull-rom', points: controls, closed: false, unit: 'mm'});
  assert.equal(actual.status, 'OK', 'Invalid actual source row for length-contract inspection');
  const {start, end} = ranges.find(value => value.needle === cell.needle), count = end - start, total = controls.length - 1;
  return {...actual, curve: {...actual.curve, segments: actual.curve.segments.slice(start, end),
    point: t => actual.curve.point((start + count * t) / total),
    derivative: t => actual.curve.derivative((start + count * t) / total).map(value => value * count / total)}};
}

function checkRoles(points, roles) {
  assert.ok(roles && Number.isInteger(roles.crown) && roles.crown === (points.length - 1) / 2,
    'Canonical role metadata must match the mirrored controls');
  assert.ok(roles.entryStart < roles.entryEnd && roles.entryEnd <= roles.freeLegStart &&
    roles.freeLegStart < roles.freeLegEnd && roles.freeLegEnd < roles.shoulder && roles.shoulder < roles.crown,
    'Entry, free leg, shoulder and crown must retain their source curve ordering');
  const protectedIndices = new Set(roles.protectedIndices);
  assert.ok(Number.isInteger(roles.capStart) && roles.capStart > roles.freeLegStart && roles.capStart < roles.crown,
    'The retained cap must publish its actual first control in this source cell');
  for (let index = roles.capStart - 1; index <= roles.crown; index++) {
    assert.ok(protectedIndices.has(index) && protectedIndices.has(points.length - 1 - index),
      'The actual retained cap and its first cubic tangent context must remain protected');
  }
  const leftAnchors = [...roles.anchorIndices, ...(roles.contactAnchors ?? [])];
  const required = [...leftAnchors, ...leftAnchors.map(i => points.length - 1 - i)];
  for (const shoulder of [roles.shoulder, points.length - 1 - roles.shoulder])
    for (let index = shoulder - 2; index <= shoulder + 2; index++) required.push(index);
  for (const index of required) assert.ok(protectedIndices.has(index), 'Missing protected geometric role at ' + index);
}
let actualReferenceCount = 0, ghostReferenceCount = 0;
for (const cell of fixture.cells) {
  const current = fixture.layouts.get(cell.row + '/' + cell.needle), reference = current.releaseReference;
  assert.deepEqual(current.origin, [cell.needle * layout.columnPitch, cell.row * layout.courseStep, 0]);
  if (cell.releaseBoundary) {
    assert.equal(cell.row, 30, 'Only the actual last published source K may use an open upper boundary');
    assert.equal(reference.boundary, 'OPEN_UPPER_SOURCE_EDGE');
    assert.equal(reference.sourceLayout, null, 'An open boundary must not fabricate a releasing source identity');
    continue;
  }
  const target = fixture.layouts.get(cell.releaseRow + '/' + cell.needle);
  assert.equal(reference.sourceLayout, target, 'Release reference must retain the actual releasing layout identity');
  assert.equal(reference.sourceRow, cell.releaseRow);
  assert.equal(reference.boundary, null);
  const memberIndex = cell.releaseGroup.findIndex(member => member.row === cell.row);
  assert.equal(current.releaseStation.memberIndex, memberIndex, 'Release station order must come from the complete source group');
  const joint = current.releaseJoint;
  assert.ok(joint && joint.releaseRow === cell.releaseRow && joint.needle === cell.needle,
    'Every source member must retain its actual shared release owner');
  assert.deepEqual(joint.members.map(member => [member.row, member.operation]),
    cell.releaseGroup.map(member => [member.row, member.operation]), 'Release owner lost the full ordered source group');
  assert.deepEqual(current.releaseStation.offset, joint.caps[memberIndex].offset,
    'Published member station must equal the actual shared cap frame');
  // Check the generated geometry as well as its metadata. This suffix is the
  // exact retained cap in the release owner's frame, including true hold time.
  assert.ok(joint.capBase && joint.capCurve, 'Shared old returns require their explicit local cap owner');
  const cap = joint.capBase, capCount = cap.roles.crown - joint.terminal + 1;
  assert.equal(current.roles.capStart, current.roles.crown - (cap.roles.crown - joint.terminal),
    'The cap role must be derived from the actual retained suffix, not a legacy shoulder index');
  for (let step = 0; step < capCount; step++) {
    const expected = cap.guides[cap.roles.crown - step].map((value, axis) =>
      value + ((axis === 1 ? (cell.releaseRow - cell.row) * layout.courseStep : 0) + current.releaseStation.offset[axis]));
    assert.deepEqual(current.guides[current.roles.crown - step], expected,
      'Generated retained cap is detached from its shared release station');
  }
  const left = fixture.layouts.get(cell.releaseRow + '/' + (cell.needle - 1));
  const right = fixture.layouts.get(cell.releaseRow + '/' + (cell.needle + 1));
  assert.equal(reference.ghostControls, left ? 1 : 0, 'Entry context must use the actual preceding full-source needle');
  assert.deepEqual(reference.controls.slice(reference.ghostControls, reference.ghostControls + target.guides.length), target.guides,
    'Release reference must consume the complete actual canonical guides, not an independent entry proxy');
  assert.equal(reference.controls.length, target.guides.length + Number(Boolean(left)) + Number(Boolean(right)));
  if (left) {
    assert.deepEqual(reference.controls[0], left.guides.at(-2).map((value, axis) => value - (axis === 0 ? layout.columnPitch : 0)),
      'Left ghost must be the actual preceding needle control in this releasing cell frame');
    ghostReferenceCount++;
  }
  if (right) {
    assert.deepEqual(reference.controls.at(-1), right.guides[1].map((value, axis) => value + (axis === 0 ? layout.columnPitch : 0)),
      'Right ghost must be the actual following needle control in this releasing cell frame');
    ghostReferenceCount++;
  }
  for (let segment = reference.startSegment; segment < reference.endSegment; segment++) {
    const canonical = segment - reference.ghostControls;
    for (let index = canonical - 1; index <= canonical + 2; index++) {
      assert.ok(target.roles.protectedIndices.includes(index) && target.roles.protectedIndices.includes(target.guides.length - 1 - index),
        'Both plated sides must protect all four controls of the actual referenced entry cubic at ' + index);
    }
  }
  const actual = createSpatialCurve({ type: 'catmull-rom', points: reference.controls, closed: false, unit: 'mm' });
  assert.equal(actual.status, 'OK');
  assert.ok(reference.startSegment >= reference.ghostControls && reference.endSegment < actual.curve.segments.length);
  for (let segment = reference.startSegment; segment < reference.endSegment; segment++) {
    for (const u of [0, .37, 1]) {
      assert.deepEqual(reference.curve.segments[segment].point(u), actual.curve.segments[segment].point(u));
      assert.deepEqual(reference.curve.segments[segment].derivative(u), actual.curve.segments[segment].derivative(u));
    }
  }
  actualReferenceCount++;
}
const releaseGroupCells = [21, 22, 23].map(row => fixture.cellAt(row, 16));
const sharedReference = fixture.layouts.get('21/16').releaseReference;
for (const cell of releaseGroupCells) {
  assert.deepEqual(cell.releaseGroup, [{ row: 21, operation: 'K' }, { row: 22, operation: 'T' }, { row: 23, operation: 'T' }]);
  assert.equal(fixture.layouts.get(cell.row + '/16').releaseReference, sharedReference,
    'Old K and both T members must share one actual releasing reference object');
}
const croppedCells = fixture.cells.filter(c => c.row >= 22 && c.row <= 25);
for (const cell of croppedCells.filter(c => c.needle === 16 && c.operation === 'T')) {
  assert.equal(cell.heldFromRow, 21, 'Crop must retain the old K source before its first visible row');
  assert.ok(cell.releaseGroup.some(member => member.row === 21 && member.operation === 'K'));
  assert.equal(fixture.layouts.get(cell.row + '/16').releaseReference.sourceLayout, fixture.layouts.get('24/16'));
}
assert.throws(() => curve.buildInterlockBaseLayouts(fixture.cells.filter(c => !(c.row === 24 && c.needle === 16)), radiusMm),
  /Missing full-source releasing base/, 'Missing releasing K must not silently become an open boundary or proxy');
console.log(JSON.stringify({ actualReferenceCount, ghostReferenceCount, sourceCells: fixture.cells.length,
  sourceRows: [20, 30], displayedRows: [22, 25], sharedReleaseGroup: releaseGroupCells.map(c => [c.row, c.operation]) }, null, 2));

// A genuine open upper source edge has no releasing K. Keep the complete
// held group and test its three independent returns instead of inventing K3.
const openGroup = [{ row: 0, operation: 'K' }, { row: 1, operation: 'T' }, { row: 2, operation: 'T' }];
const openCells = openGroup.map(member => ({ ...member, needle: 16, heldFromRow: 0, releaseRow: 3,
  releasingReleaseRow: null, releaseBoundary: 'OPEN_UPPER_SOURCE_EDGE', releaseGroup: openGroup, radiusMm }));
const openLayouts = curve.buildInterlockBaseLayouts(openCells, radiusMm), openBoundaryResults = [];
const previousOpenPaths = [null, null];
let previousCommonTip = null;
for (const cell of openCells) {
  const common = openLayouts.get(cell.row + '/' + cell.needle);
  assert.equal(common.releaseReference.boundary, 'OPEN_UPPER_SOURCE_EDGE');
  assert.equal(common.releaseReference.sourceLayout, null, 'Open release must not fabricate K3 source identity');
  assert.equal(common.origin[1], cell.row * layout.courseStep, 'Open held group must retain its source-row origin');
  const commonTip = common.guides[common.roles.crown].map((value, axis) => value + common.origin[axis]);
  if (previousCommonTip) assert.ok(previousCommonTip[1] > commonTip[1], 'Open common K/T returns must be distinct and source-ordered');
  previousCommonTip = commonTip;
  let firstYarnPoints = null;
  for (const yarnIndex of [0, 1]) {
    const points = curve.interlockCellControls({ ...cell, yarnIndex, commonLayout: common });
    checkRoles(points, common.roles);
    const tip = points[common.roles.crown], previous = previousOpenPaths[yarnIndex];
    if (firstYarnPoints) {
      assert.notEqual(points, firstYarnPoints, 'Open yarn slots must retain independent control arrays');
      assert.notDeepEqual(tip, firstYarnPoints[common.roles.crown], 'Open yarn slots must retain distinct actual tips');
    } else firstYarnPoints = points;
    if (previous) {
      assert.notEqual(points, previous.points, 'Each open loop must own an independent yarn path');
      assert.notDeepEqual(points, previous.points, 'Open K/T loops must not collapse onto the same path');
      assert.ok(previous.tip[1] > tip[1], 'Plated open K/T tips must remain distinct and source-ordered');
    }
    previousOpenPaths[yarnIndex] = { points, tip };
    const sampled = buildSpatialPath({ type: 'catmull-rom', points, closed: false, unit: 'mm' }, { sampleCount: 513 });
    const label = `Open ${cell.operation}${cell.row} Yarn ${yarnIndex + 1}`;
    assert.equal(sampled.status, 'OK', `${label}: dense sampling failed ${JSON.stringify(sampled.diagnostics)}`);
    const frames = buildParallelTransportFrames(sampled);
    assert.equal(frames.status, 'OK', `${label}: transport failed ${JSON.stringify(frames.diagnostics)}`);
    const tube = buildYarnTubeGeometry({ path: sampled, frames, radiusA: radiusMm,
      radialSegments: 8, capEnds: false, uvRepeatLength: 1 });
    assert.equal(tube.status, 'OK', `${label}: dense original tube failed ${JSON.stringify(tube.diagnostics)}`);
    openBoundaryResults.push({ row: cell.row, operation: cell.operation, releaseRow: cell.releaseRow, yarnIndex,
      commonTip, tip, controls: points.length, rings: tube.counts.rings, status: tube.status });
  }
}
console.log(JSON.stringify({ openBoundaryMethod: 'Complete K0/T1/T2 source group released beyond the actual source at row3; no fabricated K3',
  openBoundaryResults }, null, 2));
for (const yarnIndex of [0, 1]) {
  const points = fixture.controls(base, yarnIndex);
  const roles = cellRoles(fixture, base);
  checkRoles(points, roles);
  const next = fixture.controls(fixture.cellAt(21, 20), yarnIndex);
  assert.ok(Math.hypot(...points.at(-1).map((v, axis) => v - next[0][axis])) < 1e-12, 'Mixed K/T shared sinker');
  const shifted = fixture.controls(fixture.cellAt(21, 18), yarnIndex);
  assert.ok(Math.abs(points[0][0] - shifted[0][0] - layout.columnPitch) < 1e-12);
  const offsets = curve.interlockExpansionOffsets(points, roles);
  for (const i of roles.protectedIndices)
    assert.deepEqual(offsets[i], [0, 0, 0], 'Length anchor roles must remain fixed');
  assert.ok(offsets.some(p => Math.hypot(...p) > 1e-5), 'Free bend must survive for lengthRatio response');
  assert.ok(points[roles.freeLegEnd][0] < points[roles.freeLegStart][0], 'Plated left leg must continue diagonally outward');
  const heldCell = fixture.cellAt(21, 16), held = fixture.controls(heldCell, yarnIndex);
  assert.equal(heldCell.releaseRow - heldCell.row, 3, 'Held K must preserve three-course release');
  assert.equal(fixture.layouts.get('21/16').releaseReference.sourceLayout.origin[1], 24 * layout.courseStep,
    'Held K must return to the actual releasing row geometry');
  const changedRelease = sourceFixture([{ needle: 19, row: 22, courses: 3, tucks: false }]);
  const changedCell = changedRelease.cellAt(21, 19), nextHeld = changedRelease.controls(changedCell, yarnIndex);
  checkRoles(nextHeld, cellRoles(changedRelease, changedCell));
  const changedReference = changedRelease.layouts.get('21/19').releaseReference;
  assert.equal(changedReference.sourceLayout, changedRelease.layouts.get('22/19'),
    'Changed releasing hold must still reference the actual new K layout');
  assert.deepEqual(changedReference.controls.slice(changedReference.ghostControls,
    changedReference.ghostControls + changedReference.sourceLayout.guides.length), changedReference.sourceLayout.guides,
    'A different releasing hold must not reintroduce a detached entry template');
  // A later hold changes the releasing K's upper stem. It does not by itself
  // imply its lower entry or the older cap must move; the shared joint owns them.
  for (const sample of [points, next, held, nextHeld]) assert.ok(sample.flat().every(Number.isFinite));
}

const throatCases = [
  { name: 'ordinary K', ...base },
  { name: 'held K', ...fixture.cellAt(21, 16) },
  { name: 'T1', ...fixture.cellAt(22, 16) },
  { name: 'T2', ...fixture.cellAt(23, 16) },
];
const throatMargin = .005, throatResults = [], lengthResponseResults = [], denseTubeResults = [];
for (const cell of throatCases) {
  for (const yarnIndex of [0, 1]) {
    const points = fixture.controls(cell, yarnIndex);
    const roles = cellRoles(fixture, cell), last = points.length - 1;
    checkRoles(points, roles);
    if (cell.operation === 'K' && cell.releaseRow - cell.row === 1) {
      const common = fixture.layouts.get(cell.row + '/' + cell.needle);
      assert.equal(common.design.memberCount, 3, 'This ordinary K shares a source row with a three-member release context');
      assert.equal(points.length, 83, 'The current row-owned three-member entry has 83 mirrored controls even for a one-course K');
      assert.equal(points.length, common.guides.length, 'Plating must preserve the actual shared-entry control interface');
    }
    const offsets = curve.interlockExpansionOffsets(points, roles);
    for (const index of roles.protectedIndices)
      assert.deepEqual(offsets[index], [0, 0, 0], `${cell.name} Yarn ${yarnIndex + 1}: lengthRatio must leave anchor C${index} fixed`);
    assert.ok(offsets.some(point => Math.hypot(...point) > 1e-5), `${cell.name}: independent lengthRatio must retain a free bend`);

    const created = actualSourceCellCurve(fixture, cell, yarnIndex, points);
    assert.equal(created.status, 'OK', `${cell.name}: invalid plated curve`);
    assert.ok(created.curve.regular, `${cell.name}: nonregular plated curve`);
    assert.equal(typeof curve.interlockLengthControls, 'function', 'Use the bounded runtime family, not unit basis times the old gain');
    const key = cell.row + '/' + cell.needle;
    const changed = curve.interlockLengthControls(fixture.layouts, key, yarnIndex, 25 / 23, radiusMm);
    const shortened = curve.interlockLengthControls(fixture.layouts, key, yarnIndex, 21 / 23, radiusMm);
    const edited = actualSourceCellCurve(fixture, cell, yarnIndex, changed);
    const shorter = actualSourceCellCurve(fixture, cell, yarnIndex, shortened);
    assert.equal(edited.status, 'OK', `${cell.name}: invalid 25-state plated curve`);
    assert.ok(edited.curve.regular, `${cell.name}: nonregular 25-state plated curve`);
    for (const [setting, tested] of [[21, shorter], [23, created], [25, edited]]) {
      const label = `${cell.name} Yarn ${yarnIndex + 1} setting ${setting}`;
      const testedPoints = setting === 21 ? shortened : setting === 25 ? changed : points;
      const exactCurvature = curve.interlockCurvatureMaximum(testedPoints, tested.curve);
      assert.ok(radiusMm * exactCurvature.curvature < 1, `${label}: actual complete-row cubic curvature exceeds the circular tube radius ${JSON.stringify(exactCurvature)}`);
      const sampled = buildSpatialPath({ curve: tested.curve }, { sampleCount: 513 });
      assert.equal(sampled.status, 'OK', `${label}: dense sampling failed ${JSON.stringify(sampled.diagnostics)}`);
      const frames = buildParallelTransportFrames(sampled);
      assert.equal(frames.status, 'OK', `${label}: transport failed ${JSON.stringify(frames.diagnostics)}`);
      const tube = buildYarnTubeGeometry({ path: sampled, frames, radiusA: radiusMm,
        radialSegments: 8, capEnds: false, uvRepeatLength: 1 });
      if (tube.status !== 'OK') {
        const failure = tube.diagnostics.find(item => Number.isInteger(item.sampleIndex));
        const sampleIndex = failure?.sampleIndex, parameter = sampled.parameters?.[sampleIndex];
        const controlCoordinate = Number.isFinite(parameter) ? parameter * (points.length - 1) : null;
        const lower = controlCoordinate === null ? null : Math.floor(controlCoordinate);
        console.log(JSON.stringify({label, geometryFailure: tube.diagnostics, parameter, controlCoordinate,
          controlInterval: lower === null ? null : [lower, lower + 1],
          finalControls: lower === null ? null : testedPoints.slice(Math.max(0, lower - 1), lower + 3),
          baseControls: lower === null ? null : points.slice(Math.max(0, lower - 1), lower + 3),
          protected: lower === null ? null : Array.from({length: 4}, (_, i) => lower - 1 + i).map(i => [i, roles.protectedIndices.includes(i)])}, null, 2));
      }
      assert.equal(tube.status, 'OK', `${label}: dense original tube failed ${JSON.stringify(tube.diagnostics)}`);
      denseTubeResults.push({ case: cell.name, yarnIndex, setting, controls: points.length,
        rings: tube.counts.rings, triangles: tube.counts.triangles, status: tube.status, exactCurvature });
    }
    for (const index of roles.protectedIndices) {
      assert.deepEqual(changed[index], points[index], '25 edit moved a protected role');
      assert.deepEqual(shortened[index], points[index], '21 edit moved a protected role');
    }
    for (const shoulder of [roles.shoulder, last - roles.shoulder]) {
      for (const segment of [shoulder - 1, shoulder]) for (const u of [0, .25, .5, .75, 1]) {
        assert.deepEqual(edited.curve.segments[segment].point(u), created.curve.segments[segment].point(u),
          '25 edit changed a protected shoulder span');
        assert.deepEqual(edited.curve.segments[segment].derivative(u), created.curve.segments[segment].derivative(u),
          '25 edit changed a protected shoulder derivative');
      }
    }
    for (const [setting, tested] of [[21, shorter], [25, edited]]) {
      for (const segment of [roles.capStart, last - roles.capStart - 1]) {
        for (const u of [0, .25, .5, .75, 1]) {
          assert.deepEqual(tested.curve.segments[segment].point(u), created.curve.segments[segment].point(u),
            `${setting} edit changed the actual retained cap's first cubic`);
          assert.deepEqual(tested.curve.segments[segment].derivative(u), created.curve.segments[segment].derivative(u),
            `${setting} edit changed the actual retained cap's initial tangent`);
        }
      }
    }
    const beforeLength = measureSpatialLength(created.curve), changedLength = measureSpatialLength(edited.curve), shorterLength = measureSpatialLength(shorter.curve);
    assert.equal(beforeLength.status, 'OK'); assert.equal(changedLength.status, 'OK'); assert.equal(shorterLength.status, 'OK');
    for (const [side, start, end] of [['left', roles.freeLegStart, roles.freeLegEnd],
      ['right', last - roles.freeLegEnd, last - roles.freeLegStart]]) {
      const maximumDisplacement = Math.max(...changed.slice(start + 1, end).map((point, local) => Math.hypot(...point.map((value, axis) => value - points[start + 1 + local][axis]))));
      const shorterDisplacement = Math.max(...shortened.slice(start + 1, end).map((point, local) => Math.hypot(...point.map((value, axis) => value - points[start + 1 + local][axis]))));
      const originalLength = beforeLength.segmentLengths.slice(start, end).reduce((sum, value) => sum + value, 0);
      const editedLength = changedLength.segmentLengths.slice(start, end).reduce((sum, value) => sum + value, 0);
      const decreasedLength = shorterLength.segmentLengths.slice(start, end).reduce((sum, value) => sum + value, 0);
      assert.ok(maximumDisplacement > 1e-8, `${cell.name} Yarn ${yarnIndex + 1}: ${side} free leg has no actual 23 to 25 response`);
      assert.ok(editedLength > originalLength + 1e-10, `${cell.name} Yarn ${yarnIndex + 1}: ${side} free-leg arclength did not increase`);
      assert.ok(shorterDisplacement > 1e-8 && decreasedLength < originalLength - 1e-10, `${cell.name} Yarn ${yarnIndex + 1}: ${side} 21-state must shorten the actual free leg`);
      lengthResponseResults.push({ case: cell.name, yarnIndex, side, maximumDisplacement, shorterDisplacement, originalLength, editedLength, decreasedLength,
        lengthIncrease: editedLength - originalLength });
    }
    const restored = curve.interlockLengthControls(fixture.layouts, key, yarnIndex, 1, radiusMm);
    assert.deepEqual(restored, points, '23-state controls did not restore exactly');
    assert.deepEqual(fixture.controls(cell, yarnIndex), points, 'Length deformation mutated the shared base');
    if (yarnIndex !== 1) continue;
    const centerX = cell.needle * layout.columnPitch;
    const end = roles.phases.slice(0, roles.crown + 1).reduce((best, phase, index) =>
      Math.abs(phase - 5) < Math.abs(roles.phases[best] - 5) ? index : best, 0);
    const leftSegments = Array.from({ length: end - roles.entryStart }, (_, index) => roles.entryStart + index);
    for (const [setting, tested] of [[21, shorter], [23, created], [25, edited]])
      for (const [side, sign, segments] of [['left', -1, leftSegments], ['right', 1, leftSegments.map(index => last - index - 1)]]) {
      let closest = { distanceFromAxis: Infinity };
      for (const index of segments) {
        const segment = tested.curve.segments[index];
        // Existing cubic breakpoints include all analytic X-derivative roots;
        // testing endpoints and this superset also catches between-control overshoot.
        for (const u of [0, ...segment.integrationBreakpoints, 1]) {
          const x = segment.point(u)[0] - centerX;
          const distanceFromAxis = sign * x;
          if (distanceFromAxis < closest.distanceFromAxis) closest = { distanceFromAxis, segment: index, u, x };
        }
      }
      throatResults.push({ case: cell.name, setting, yarnIndex, side, ...closest, required: cell.radiusMm + throatMargin });
    }
  }
}
console.log(JSON.stringify({ throatMethod: 'Uniform Catmull-Rom: endpoints plus all analytic cubic X extrema; plated Yarn 2 semantic entryStart..phase5 and mirror',
  radius: .035, margin: throatMargin, throatResults, lengthResponseMethod: 'Actual runtime bounded family and complete source-row cubic context; 21 < 23 < 25 plus exact 23 restore; no UI claim',
  lengthResponseResults, denseTubeMethod: 'Original path, parallel transport and circular tube APIs; 513 rings per full plated cell; global crossing not audited here',
  denseTubeResults }, null, 2));
assert.deepEqual(throatResults.filter(result => result.distanceFromAxis < result.required - 1e-12), [],
  'Plated Yarn 2 throat must keep its full interpolated curve at least radius + .005 from the needle axis on each side');

// Isolate the seed's shoulder condition from the joint layout. Doubling the
// source hold must lengthen the stem without amplifying its out-of-plane bend.
// Inspect the actual plated cubic, including between-control Z extrema.
const heldDepthResults = [], interpolationTolerance = .015;
for (const yarnIndex of [0, 1]) {
  const ranges = [];
  for (const holdCourses of [3, 6]) {
    const heldSource = sourceFixture([{ needle: 19, row: base.row, courses: holdCourses, tucks: false }]);
    const heldCell = heldSource.cellAt(base.row, 19), points = heldSource.controls(heldCell, yarnIndex), roles = cellRoles(heldSource, heldCell);
    checkRoles(points, roles);
    assert.ok(points.length > fixture.controls(base, yarnIndex).length && points.length % 2 === 1,
      'Held K must retain mirrored control roles and subdivide its longer source span beyond an ordinary K');
    const offsets = curve.interlockExpansionOffsets(points, roles);
    for (const index of roles.protectedIndices)
      assert.deepEqual(offsets[index], [0, 0, 0], 'Long held K lengthRatio anchor moved');
    const created = createSpatialCurve({ type: 'catmull-rom', points, closed: false, unit: 'mm' });
    assert.equal(created.status, 'OK', 'Invalid plated long held K seed');
    assert.ok(created.curve.regular, 'Nonregular plated long held K seed');
    let minZ = Infinity, maxZ = -Infinity;
    for (const segment of created.curve.segments) {
      // integrationBreakpoints includes every analytic XYZ derivative root.
      for (const u of [0, ...segment.integrationBreakpoints, 1]) {
        const z = segment.point(u)[2];
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      }
    }
    const result = { yarnIndex, holdCourses, controlCount: points.length, minZ, maxZ, depth: maxZ - minZ };
    ranges.push(result); heldDepthResults.push(result);
  }
  assert.ok(ranges[1].controlCount > ranges[0].controlCount,
    'Doubling the held source span must add leg subdivisions while retaining the mirrored return roles');
  assert.ok(ranges[1].maxZ <= ranges[0].maxZ + interpolationTolerance,
    'Long held K shoulder correction must not amplify the forward bulge with stem length');
  assert.ok(ranges[1].minZ >= ranges[0].minZ - interpolationTolerance,
    'Long held K must not move the amplified bulge behind the cloth');
  assert.ok(ranges[1].depth <= ranges[0].depth + interpolationTolerance,
    'Long held K seed depth must remain bounded when the source hold doubles');
}
console.log(JSON.stringify({ heldDepthMethod: 'Plated seed Catmull-Rom endpoints and analytic Z extrema; no commonLayout optimization',
  interpolationTolerance, heldDepthResults }, null, 2));
console.log('PASS: actual source-referenced base interface, semantic K/T controls, fixed pitch, K/T joins, held duration, protected roles, free-leg length response, analytic plated base throat clearance and bounded long-hold base depth; joint layout and final tubes are audited separately');



