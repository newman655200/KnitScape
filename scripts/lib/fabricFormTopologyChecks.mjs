import assert from "node:assert/strict";
import { existsSync } from "node:fs";

function near(actual, expected, tolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
    `${actual} must agree with ${expected}`);
}

export async function runFabricFormTopologyChecks() {
  for (const file of ["fabricFormParams.js", "fabricFormTopology.js", "periodicCell.js"]) {
    assert.ok(existsSync(new URL(`../../src/fabricForm/${file}`, import.meta.url)),
      `M1 requires ${file}`);
  }
  const { createFabricFormParams } = await import("../../src/fabricForm/fabricFormParams.js");
  const { createPlainJerseyTopology, unfoldedMaterialGap, isLocalMaterialPair } =
    await import("../../src/fabricForm/fabricFormTopology.js");
  const { actualEdgeVector, edgeEndpoints, createCellGradient, accumulateEndpointGradient,
    replicatePeriodicCell } = await import("../../src/fabricForm/periodicCell.js");
  const results = [];

  const params = createFabricFormParams();
  near(params.d_e, 0.1971738911486305);
  near(params.d_s ** 2 * Math.PI / 4, params.tex / (params.densityGPerCm3 * 1000));
  near(params.r_c, params.phi0 * params.d_e);
  near(params.B, params.E_f * params.tex / (params.densityGPerCm3 * 1000)
    * params.fiberDiameterMm ** 2 / 16);
  for (const [key, entry] of Object.entries(params.provenance)) {
    for (const field of ["value", "unit", "source", "principle", "confidence", "applicableState"]) {
      assert.ok(entry[field] !== undefined && entry[field] !== "", `${key} needs ${field}`);
    }
    assert.notEqual(entry.confidence, "MEASURED");
  }
  const scaled = createFabricFormParams({ tex: 80, fiberDiameterMm: 0.042 });
  near(scaled.d_e, 2 * params.d_e);
  near(scaled.B, 16 * params.B);
  near(scaled.N_f, params.N_f);
  assert.throws(() => createFabricFormParams({ phi0: 1 }), /phi0/);
  assert.throws(() => createFabricFormParams({ E_f: NaN }), /E_f/);
  assert.throws(() => createFabricFormParams({ tex: 0 }), /tex/);
  assert.throws(() => createFabricFormParams({ tex: null }), /tex/);
  assert.throws(() => createFabricFormParams({ provenance: { tex: { confidence: "MEASURED" } } }),
    /provenance/);
  const measured = createFabricFormParams({ tex: 21, provenance: {
    tex: { source: "sample A", principle: "mass / relaxed length", confidence: "MEASURED",
      applicableState: "relaxed, 20 C, 65% RH, 24 h" },
  } });
  assert.equal(measured.provenance.tex.value, 21);
  assert.equal(measured.provenance.tex.confidence, "MEASURED");
  assert.notEqual(measured.provenance.B.confidence, "MEASURED");
  results.push("material derivation, units, provenance and scale inputs");

  for (const [m, n] of [[1, 1], [2, 2], [4, 8]]) {
    const topology = createPlainJerseyTopology({ m, n, nodesPerLoop: 8 });
    assert.equal(topology.nodeCount, m * n * 8);
    assert.equal(topology.yarns.length, n);
    assert.equal(topology.edges.length, topology.nodeCount);
    assert.equal(topology.bends.length, topology.nodeCount);
    assert.equal(topology.loops.length, m * n);
    const incoming = new Array(m * n).fill(0);
    for (const loop of topology.loops) {
      const old = topology.loops[loop.passesThrough.loopId];
      incoming[old.id]++;
      assert.equal(old.needle, loop.needle);
      assert.equal(old.feed + loop.passesThrough.q * n, loop.feed - 1);
      assert.equal(loop.passesThrough.p, 0);
    }
    assert.ok(incoming.every(count => count === 1));
    for (const yarn of topology.yarns) {
      const edges = yarn.edgeIndices.map(index => topology.edges[index]);
      near(edges.reduce((sum, edge) => sum + edge.restLength, 0), m * 3);
      assert.equal(edges.reduce((sum, edge) => sum + edge.p, 0), 1);
      assert.equal(edges.reduce((sum, edge) => sum + edge.q, 0), 0);
      for (const bend of topology.bends.filter(b => edges.some(e => e.to === b.node))) {
        assert.equal(topology.edges[bend.prevEdge].to, topology.edges[bend.nextEdge].from);
      }
    }
  }
  for (const action of ["T", "M"]) {
    assert.throws(() => createPlainJerseyTopology({ m: 2, n: 2,
      camProgram: { tracks: [["K", action], ["K", "K"]] }, needleArrangement: [2, 1] }),
    error => error.code === "UNSUPPORTED_IN_STEP1");
  }
  assert.throws(() => createPlainJerseyTopology({ camProgram: { tracks: [["K"]] },
    needleArrangement: [2] }), /Needle Type/);
  assert.throws(() => createPlainJerseyTopology({ nodesPerLoop: 2 }), /nodesPerLoop/);
  const cam = { tracks: [["T", "M"], ["K", "K"]] };
  const snapshot = JSON.stringify(cam);
  assert.equal(createPlainJerseyTopology({ m: 2, n: 2, camProgram: cam,
    needleArrangement: [2] }).operations.flat().join(""), "KKKK");
  assert.equal(JSON.stringify(cam), snapshot);
  results.push("Machine Domain adaptation and periodic loop relations");

  const topology = createPlainJerseyTopology({ nodesPerLoop: 8 });
  const first = topology.edges[0];
  const last = topology.edges[7];
  near(unfoldedMaterialGap(topology, last, first, 1, 0), 0);
  near(unfoldedMaterialGap(topology, first, first, 1, 0), 3 - 3 / 8);
  assert.equal(unfoldedMaterialGap(topology, first, first, 0, 1), Infinity);
  assert.equal(isLocalMaterialPair(topology, first, first, 1, 0, 2 * params.d_e), false);
  assert.equal(isLocalMaterialPair(topology, last, first, 1, 0, 2 * params.d_e), true);
  results.push("unfolded material neighbors preserve nonzero image identity");

  const cell = { positions: [[0.2, 0.1, -0.1], [0.7, 0.4, 0.3]], W: 2, H: 3, S: 0.25 };
  const edge = { from: 0, to: 1, p: -1, q: 2 };
  assert.deepEqual(edgeEndpoints(cell, edge, 2, -1), [[3.95, -2.9, -0.1], [2.95, 3.4, 0.3]]);
  const vector = actualEdgeVector(cell, edge);
  [-1, 6.3, 0.4].forEach((value, i) => near(vector[i], value));
  const gradient = createCellGradient(cell);
  const left = [2, -3, 4], right = [-1, 5, -2];
  accumulateEndpointGradient(gradient, edge, left, right, 2, -1);
  const packed = [...cell.positions.flat(), cell.W, cell.H, cell.S];
  const objective = values => {
    const trial = { positions: [values.slice(0, 3), values.slice(3, 6)],
      W: values[6], H: values[7], S: values[8] };
    const [a, b] = edgeEndpoints(trial, edge, 2, -1);
    return a.reduce((sum, x, i) => sum + x * left[i] + b[i] * right[i], 0);
  };
  packed.forEach((value, index) => {
    const plus = packed.slice(), minus = packed.slice();
    plus[index] = value + 1e-6;
    minus[index] = value - 1e-6;
    near(gradient[index], (objective(plus) - objective(minus)) / 2e-6, 1e-8);
  });
  results.push("periodic endpoint positions and complete lattice gradient scatter");

  const base = { W: 0.8, H: 0.6, S: 0.13, topology,
    positions: Array.from({ length: 8 }, (_, k) => [0.1 * k,
      0.2 * Math.sin(2 * Math.PI * k / 8), 0.1 * Math.cos(2 * Math.PI * k / 8)]) };
  const baseSnapshot = JSON.stringify(base);
  for (const [copiesM, copiesN] of [[1, 1], [2, 2], [4, 8]]) {
    const repeated = replicatePeriodicCell(base, copiesM, copiesN);
    near(repeated.W, base.W * copiesM);
    near(repeated.H, base.H * copiesN);
    near(repeated.S, base.S * copiesN);
    assert.equal(repeated.topology.yarns.length, copiesN);
    assert.equal(repeated.topology.loops.length, copiesM * copiesN);
    for (const target of repeated.topology.edges) {
      const original = topology.edges[repeated.replication.sourceEdgeIndices[target.id]];
      const originalVector = actualEdgeVector(base, original);
      actualEdgeVector(repeated, target).forEach((x, k) => near(x, originalVector[k]));
      near(target.restLength, original.restLength);
    }
    if (copiesM > 1) {
      near(unfoldedMaterialGap(repeated.topology, repeated.topology.edges[7],
        repeated.topology.edges[8], 0, 0), 0);
    }
  }
  assert.equal(JSON.stringify(base), baseSnapshot);
  const nonuniform = structuredClone(base);
  let materialStart = 0;
  for (const edge of nonuniform.topology.edges) {
    edge.restLength *= edge.order % 2 ? 1.5 : 0.5;
    edge.materialStart = materialStart;
    materialStart += edge.restLength;
  }
  const repeatedNonuniform = replicatePeriodicCell(nonuniform, 2, 2);
  for (const edge of repeatedNonuniform.topology.edges) {
    const source = nonuniform.topology.edges[repeatedNonuniform.replication.sourceEdgeIndices[edge.id]];
    near(edge.restLength, source.restLength);
    const [a] = repeatedNonuniform.replication.sourceOffsets[edge.from];
    near(edge.materialStart, source.materialStart + a * nonuniform.topology.yarns[0].materialLength);
  }
  results.push("supercell replication preserves actual edges and material continuity");
  return results;
}
