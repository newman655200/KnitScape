import assert from 'node:assert/strict';
import { buildInterlockBaseLayouts, interlockCellControls, interlockExpansionOffsets } from '../src/simulation/sopInterlockCurve.js';

// interlockCellControls now requires a complete CN common layout (built from a
// full source column with release groups), so build the same 16..20 x 20..30
// source as validate-sop-diagonal-release instead of passing isolated cells.
const radiusMm = .035;
const holds = [{ needle: 16, row: 21, courses: 3 }, { needle: 20, row: 20, courses: 3 }];
const cells = [];
for (let needle = 16; needle <= 20; needle++) {
  let heldFromRow = null;
  const column = [];
  for (let row = 20; row <= 30; row++) {
    const hold = holds.find(h => h.needle === needle && row > h.row && row < h.row + h.courses);
    const operation = hold ? 'T' : 'K';
    if (operation === 'K') heldFromRow = row;
    column.push({ row, needle, operation, heldFromRow, radiusMm });
  }
  for (const cell of column) {
    const releasing = column.find(c => c.row > cell.row && c.operation === 'K');
    cell.releaseRow = releasing?.row ?? 31;
    cell.releaseBoundary = releasing ? null : 'OPEN_UPPER_SOURCE_EDGE';
    const lastKnit = column.filter(c => c.operation === 'K' && c.row < cell.releaseRow).at(-1)?.row ?? 20;
    cell.releaseGroup = column.filter(c => c.row < cell.releaseRow && c.row >= lastKnit)
      .map(c => ({ row: c.row, operation: c.operation }));
  }
  cells.push(...column);
}
const layouts = buildInterlockBaseLayouts(cells, radiusMm);
const cellAt = (row, needle) => cells.find(c => c.row === row && c.needle === needle);
const controls = (cell, yarnIndex) => interlockCellControls({ ...cell, yarnIndex,
  commonLayout: layouts.get(cell.row + '/' + cell.needle) });

const all = [];
let sharedSinkers = 0, anchorChecks = 0, knitTuckTransitions = 0;
for (const yarnIndex of [0, 1]) for (const cell of cells) {
  const points = controls(cell, yarnIndex);
  assert.ok(points.flat().every(Number.isFinite), 'Controls must be finite');
  all.push(...points);
  const neighbourCell = cellAt(cell.row, cell.needle + 1);
  if (neighbourCell) {
    const neighbour = controls(neighbourCell, yarnIndex);
    assert.deepEqual(points.at(-1), neighbour[0], 'Shared sinker must be identical');
    sharedSinkers++;
    if (cell.operation !== neighbourCell.operation) knitTuckTransitions++;
  }
  const roles = layouts.get(cell.row + '/' + cell.needle).roles;
  const offsets = interlockExpansionOffsets(points, roles);
  for (const index of roles.protectedIndices) {
    assert.deepEqual(offsets[index], [0, 0, 0], 'Length anchor moved');
    anchorChecks++;
  }
}
assert.ok(knitTuckTransitions > 0, 'Fixture must include K/T neighbours sharing a sinker');
const depths = all.map(p => p[2]);
const thickness = Math.max(...depths) - Math.min(...depths) + 2 * radiusMm;
console.log(JSON.stringify({ thickness, unit: 'MODEL_NEEDLE_PITCH', measured: false,
  cells: cells.length, sharedSinkers, knitTuckTransitions, anchorChecks }));
assert.ok(thickness < 1.05, 'Display layer must fit below 1.05 needle pitch including circular tube');
console.log('PASS: flat display thickness, shared sinkers, finite controls and length anchors');
