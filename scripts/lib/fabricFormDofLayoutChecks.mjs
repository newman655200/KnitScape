import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { packFabricCell, unpackFabricCell } from "../../src/fabricForm/solveFabricCell.js";
import { createCellGradient } from "../../src/fabricForm/periodicCell.js";
import { createPlainJerseyTopology } from "../../src/fabricForm/fabricFormTopology.js";
import { createFabricFormParams } from "../../src/fabricForm/fabricFormParams.js";
import { createFabricFormInitialGeometry } from "../../src/fabricForm/fabricFormInitialGeometry.js";

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
  await runExtendedDofLayoutChecks();
}

/** Compare raw IEEE-754 bytes and report the first differing scalar and byte. */
export function assertDofBytes(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label}: component count`);
  const a = bytes(actual), b = bytes(expected);
  if (a.equals(b)) return;
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i], b[i], `${label}: first differing component ${Math.floor(i / 8)}, byte ${i % 8}`);
  }
}

async function runExtendedDofLayoutChecks() {
  const { createDofLayout, T1_DOF_BLOCKS } = await import("../../src/fabricForm/model/dofLayout.js");
  const { createKernelView } = await import("../../src/fabricForm/model/kernelView.js");
  const topology = createPlainJerseyTopology({ nodesPerLoop: 24 });
  const cell = { ...createFabricFormInitialGeometry(topology, createFabricFormParams()), probe: [.25, -.5] };
  const probe = { name: "probe", length: () => 2, scaleKind: "dimensionless", equilibrium: { kind: "maxAbs" },
    read: state => state.probe, write: (target, values) => { target.probe = Array.from(values); } };
  const t1 = createDofLayout(cell), t1Values = t1.pack(cell);
  for (const insertion of [0, 1, 2]) {
    const specs = [...T1_DOF_BLOCKS];
    specs.splice(insertion, 0, probe);
    const layout = createDofLayout(cell, specs);
    const label = `R4-1(b) probe insertion ${insertion}`;
    let offset = 0;
    for (const block of layout.blocks) {
      assert.equal(block.offset, offset, `${label}: ${block.name} offset`);
      assert.equal(block.length, block.name === "probe" ? 2 : t1.blocks.find(item => item.name === block.name).length);
      for (let i = 0; i < block.length; i++) {
        assert.equal(layout.index(block.name, block.components?.[i] ?? i), offset + i, `${label}: named index ${i}`);
      }
      offset += block.length;
    }
    assert.equal(layout.size, offset);
    const packed = layout.pack(cell);
    const expected = new Float64Array(layout.size);
    for (const block of t1.blocks) expected.set(t1Values.subarray(block.offset, block.offset + block.length), layout.index(block.name, block.components?.[0] ?? 0));
    expected.set(cell.probe, layout.index("probe", 0));
    assertDofBytes(packed, expected, `${label}: pack`);
    const unpacked = layout.unpack(packed, cell);
    assertDofBytes(layout.pack(unpacked), packed, `${label}: pack/unpack round trip`);
    assertDofBytes(layout.pack(layout.unpack(Array.from(packed), cell)), packed, `${label}: legacy array unpack`);
    assert.deepEqual(Object.keys(unpacked), Object.keys(cell), `${label}: template key order`);
    assert.notEqual(unpacked.positions, cell.positions);
    assert.ok(unpacked.positions.every((point, i) => Array.isArray(point) && point !== cell.positions[i]));
    const mapped = index => {
      const block = t1.blocks.find(item => index >= item.offset && index < item.offset + item.length);
      return layout.index(block.name, block.components?.[index - block.offset] ?? index - block.offset);
    };
    for (const fixTranslation of [true, false]) for (const locked of [[], ["W", "H"], ["S"]]) {
      const expectedFree = [...t1.freeIndices({ fixTranslation, locked }).map(mapped), layout.index("probe", 0), layout.index("probe", 1)].sort((a, b) => a - b);
      assert.deepEqual(layout.freeIndices({ fixTranslation, locked }), expectedFree, `${label}: mapped free indices`);
    }
    for (const i of [0, 1, 2]) assert.ok(!layout.freeIndices().includes(layout.index("positions", i)), `${label}: actual translation index ${i}`);
    const view = createKernelView(layout, ["positions", "lattice"], { lattice: ["W", "H", "S"] });
    const local = new Float64Array(t1.size);
    local[0] = -0;
    new BigUint64Array(local.buffer)[1] = 0x7ff8000000000042n;
    const scattered = view.scatter(local);
    assertDofBytes(view.gather(scattered), local, `${label}: kernel view preserves signed zero and NaN payload`);
    assertDofBytes(scattered.subarray(layout.index("probe", 0), layout.index("probe", 0) + 2), new Float64Array(2), `${label}: scatter leaves probe at positive zero`);
  }
  const make = spec => createDofLayout(cell, [...T1_DOF_BLOCKS, spec]);
  assert.throws(() => make({ ...probe, name: "positions" }), /Duplicate/);
  for (const length of [0, -1, 1.5, NaN]) assert.throws(() => make({ ...probe, length: () => length }), /positive integer/);
  const { scaleKind, ...withoutScale } = probe;
  const { equilibrium, ...withoutEquilibrium } = probe;
  assert.throws(() => make(withoutScale), /scaleKind/);
  assert.throws(() => make(withoutEquilibrium), /equilibrium/);
  assert.throws(() => createKernelView(t1, ["missing"]), /Unknown/);
  assert.throws(() => createKernelView(t1, ["positions", "lattice"], { lattice: ["H", "W", "S"] }), /component order/);
}
