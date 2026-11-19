import assert from 'node:assert/strict';
import { interlockCellControls, interlockExpansionOffsets } from '../src/simulation/sopInterlockCurve.js';

const cases = [
  { operation: 'K', row: 21, releaseRow: 22, heldFromRow: 21, knitEntryRow: 20, knitExitRow: 22 },
  { operation: 'K', row: 22, releaseRow: 23, heldFromRow: 22, knitEntryRow: 21, knitExitRow: 23 },
  { operation: 'K', row: 21, releaseRow: 24, heldFromRow: 21, knitEntryRow: 20 },
  { operation: 'T', row: 22, releaseRow: 24, heldFromRow: 21 },
  { operation: 'T', row: 23, releaseRow: 24, heldFromRow: 21 },
  { operation: 'K', row: 24, releaseRow: 25, heldFromRow: 24, knitExitRow: 25 },
];
const all = [];
for (const yarnIndex of [0, 1]) for (const cell of cases) {
  const points = interlockCellControls({ ...cell, needle: 19, yarnIndex });
  assert.ok(points.flat().every(Number.isFinite));
  all.push(...points);
  const neighbour = interlockCellControls({ ...cell, needle: 20, yarnIndex });
  assert.deepEqual(points.at(-1), neighbour[0], 'Shared sinker must be identical');
  const offsets = interlockExpansionOffsets(points), crown = (points.length - 1) / 2;
  for (const index of [0, 2, 3, 4, 5, 6, crown - 4, crown - 3, crown - 2, crown])
    assert.deepEqual(offsets[index], [0, 0, 0], 'Length anchor moved');
}
const depths = all.map(p => p[2]);
for (const yarnIndex of [0, 1]) {
  const knit = interlockCellControls({ ...cases[1], needle: 19, yarnIndex });
  const tuck = interlockCellControls({ ...cases[3], needle: 20, yarnIndex });
  assert.deepEqual(knit.at(-1), tuck[0], 'K/T transition must share the same sinker');
}
const thickness = Math.max(...depths) - Math.min(...depths) + .07;
console.log(JSON.stringify({ thickness, unit: 'MODEL_NEEDLE_PITCH', measured: false }));
assert.ok(thickness < 1.05, 'Display layer must fit below 1.05 needle pitch including circular tube');
console.log('PASS: flat display thickness, shared sinkers, finite controls and length anchors');
