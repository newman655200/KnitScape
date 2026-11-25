import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { packFabricCell, unpackFabricCell } from "../../src/fabricForm/solveFabricCell.js";
import { createCellGradient } from "../../src/fabricForm/periodicCell.js";

const bytes = values => Buffer.from(values.buffer, values.byteOffset, values.byteLength);

export async function runDofLayoutChecks() {
  const moduleUrl = new URL("../../src/fabricForm/model/dofLayout.js", import.meta.url);
  assert.ok(existsSync(moduleUrl), "R1-1 requires the DofLayout module");
  const { createDofLayout } = await import(moduleUrl);
  for (const count of [1, 2, 16, 48, 64]) {
    const cell = { positions: Array.from({ length: count }, (_, i) => [i === 0 ? -0 : i, -i - .25, i + .5]),
      W: 1.25, H: 2.5, S: -0, metadata: { retained: true } };
    const before = structuredClone(cell);
    const layout = createDofLayout(cell);
    const legacyPacked = Float64Array.from([...cell.positions.flat(), cell.W, cell.H, cell.S]);
    assert.equal(layout.size, legacyPacked.length);
    assert.equal(layout.size, createCellGradient(cell).length, "Unmodified kernels allocate the same vector shape");
    assert.deepEqual(layout.blocks.map(block => [block.name, block.offset, block.length]),
      [["positions", 0, 3 * count], ["lattice", 3 * count, 3]]);
    assert.deepEqual(layout.blocks.at(-1).components, ["W", "H", "S"]);
    assert.equal(layout.blocks.at(-1).offset, layout.blocks[0].offset + layout.blocks[0].length);
    for (const [component, index] of [["W", 3 * count], ["H", 3 * count + 1], ["S", 3 * count + 2]]) {
      assert.equal(layout.index("lattice", component), index);
    }
    assert.equal(layout.index("positions", 0), 0);
    assert.equal(layout.index("positions", 3 * count - 1), 3 * count - 1);
    assert.deepEqual(bytes(layout.pack(cell)), bytes(legacyPacked), "Packing preserves signed-zero IEEE-754 bytes");
    assert.deepEqual(bytes(packFabricCell(cell)), bytes(legacyPacked), "Existing pack export stays compatible");
    const unpacked = layout.unpack(legacyPacked, cell);
    assert.deepEqual(unpacked, cell);
    assert.deepEqual(unpackFabricCell(legacyPacked, cell), unpacked);
    assert.equal(unpacked.metadata, cell.metadata, "Unpack preserves non-coordinate template references");
    assert.notEqual(unpacked.positions, cell.positions);
    assert.ok(unpacked.positions.every((point, i) => Array.isArray(point) && point !== cell.positions[i]));
    assert.deepEqual(bytes(layout.pack(unpacked)), bytes(legacyPacked));
    const legacyFree = Array.from({ length: 3 * count }, (_, i) => i + 3);
    assert.deepEqual(layout.freeIndices({ fixTranslation: true, locked: [] }), legacyFree);
    assert.deepEqual(layout.freeIndices({ fixTranslation: true, locked: ["W", "H"] }),
      legacyFree.filter(i => i !== 3 * count && i !== 3 * count + 1));
    assert.deepEqual(layout.freeIndices({ fixTranslation: false, locked: [] }),
      Array.from({ length: layout.size }, (_, i) => i));
    assert.deepEqual(layout.freeIndices({ fixTranslation: false, locked: ["S"] }),
      Array.from({ length: layout.size - 1 }, (_, i) => i));
    assert.deepEqual(cell, before);
    // The constructor's tail-block contract must remain protected after creation.
    assert.throws(() => layout.blocks.push({ name: "extra", offset: layout.size, length: 1 }), TypeError);
    assert.throws(() => { layout.blocks.at(-1).offset = 0; }, TypeError);
    assert.throws(() => layout.blocks.at(-1).components.push("extra"), TypeError);
    assert.throws(() => { layout.size++; }, TypeError);
    assert.throws(() => layout.index("missing", 0), RangeError);
    assert.throws(() => layout.index("lattice", "Q"), RangeError);
    assert.throws(() => layout.index("positions", -1), RangeError);
    assert.throws(() => layout.freeIndices({ locked: ["Q"] }), RangeError);
  }
}
