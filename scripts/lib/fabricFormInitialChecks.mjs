import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

function previousCourseCrossings(cell, loop) {
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  const subtract = (a, b) => a.map((value, axis) => value - b[axis]);
  const endpoints = (edge, p, q) => [
    cell.positions[edge.from].map((value, axis) => value + (axis === 0 ? p * cell.W + q * cell.S : axis === 1 ? q * cell.H : 0)),
    cell.positions[edge.to].map((value, axis) => value + (axis === 0 ? (p + edge.p) * cell.W + (q + edge.q) * cell.S : axis === 1 ? (q + edge.q) * cell.H : 0)),
  ];
  const crossings = [];
  const previousFeed = (loop.feed + cell.topology.n - 1) % cell.topology.n;
  const q = loop.feed === 0 ? -1 : 0;
  const previousEdges = cell.topology.yarns[previousFeed].edgeIndices.map(index => cell.topology.edges[index]);
  for (const edgeIndex of loop.edgeIndices) {
    const a = cell.topology.edges[edgeIndex];
    const [fromA, toA] = endpoints(a, 0, 0);
    for (const b of previousEdges) {
      for (let p = -1; p <= 1; p++) {
        const [fromB, toB] = endpoints(b, p, q);
        const d = subtract(toA, fromA), e = subtract(toB, fromB), r = subtract(fromB, fromA);
        const denominator = cross(d, e);
        if (Math.abs(denominator) < 1e-12) continue;
        const s = cross(r, e) / denominator, t = cross(r, d) / denominator;
        if (s > 0 && s < 1 && t > 0 && t < 1) crossings.push({
          materialOrder: a.order + s,
          loopId: Math.floor(b.from / cell.topology.nodesPerLoop), p, q,
          over: Math.sign(fromA[2] + s * d[2] - fromB[2] - t * e[2]),
          orientation: Math.sign(denominator),
        });
      }
    }
  }
  return crossings.sort((a, b) => a.materialOrder - b.materialOrder)
    .map(({ materialOrder, ...crossing }) => crossing);
}

export async function runFabricFormInitialChecks() {
  const initialUrl = new URL("../../src/fabricForm/fabricFormInitialGeometry.js", import.meta.url);
  assert.ok(existsSync(initialUrl), "Initial geometry implementation is required for material-length and periodic-closure checks");
  const { createFabricFormInitialGeometry } = await import(initialUrl);
  const { createPlainJerseyTopology } = await import("../../src/fabricForm/fabricFormTopology.js");
  const { createFabricFormParams } = await import("../../src/fabricForm/fabricFormParams.js");
  const { solveFabricCell } = await import("../../src/fabricForm/solveFabricCell.js");
  const infeasible = solveFabricCell({topology:createPlainJerseyTopology({loopLengthMm:.5}),params:createFabricFormParams()});
  assert.equal(infeasible.status,"INFEASIBLE_INITIAL_GEOMETRY");
  assert.equal(infeasible.iterations,0);
  assert.equal(infeasible.equilibrium.passed,false);
  assert.ok(infeasible.diagnostics.reasons.length>0);
  const diagnostic = solveFabricCell({topology:createPlainJerseyTopology(),params:createFabricFormParams(),maxIterations:1});
  assert.ok(["CHOLESKY","SVD"].includes(diagnostic.equilibrium.multiplierSolveMethod),
    "the solver result exposes the multiplier fit method");
  assert.ok(Number.isFinite(diagnostic.equilibrium.multiplierSolveThreshold));
  assert.ok(Number.isFinite(diagnostic.equilibrium.multiplierConditionEstimate));
  assert.throws(() => solveFabricCell({topology:createPlainJerseyTopology({nodesPerLoop:24}),
    params:createFabricFormParams(),initialCell:diagnostic.cell,maxIterations:1}),
  /Initial cell and input topology disagree/, "reject mislabeled rod discretization at the input boundary");
  const { replicatePeriodicCell } = await import("../../src/fabricForm/periodicCell.js");
  const results = [];
  for (const [m, n] of [[1, 1], [2, 2], [4, 8]]) {
    for (const nodesPerLoop of [24, 32, 64]) {
      const topology = createPlainJerseyTopology({ m, n, nodesPerLoop, loopLengthMm: 3 });
      const before = JSON.stringify(topology);
      const cell = createFabricFormInitialGeometry(topology, { loopLengthMm: 3 });
      assert.equal(JSON.stringify(topology), before, "initialization must preserve the caller's material topology");
      assert.equal(cell.positions.length, m * n * nodesPerLoop);
      assert.ok(cell.W > 0 && cell.H > 0 && cell.S === 0);
      const totals = Array.from({ length: m * n }, () => 0);
      for (const edge of cell.topology.edges) {
        const a = cell.positions[edge.from], b = cell.positions[edge.to];
        const vector = [b[0] + edge.p * cell.W + edge.q * cell.S - a[0], b[1] + edge.q * cell.H - a[1], b[2] - a[2]];
        const length = Math.hypot(...vector);
        assert.ok(Math.abs(length / edge.restLength - 1) < 1e-12, "every material edge starts without strain");
        totals[Math.floor(edge.from / nodesPerLoop)] += length;
      }
      assert.ok(totals.every(length => Math.abs(length - 3) < 1e-12), "every loop has the specified material length, including the periodic closing edge");
      for (let feed = 1; feed < n; feed++) {
        for (let node = 0; node < m * nodesPerLoop; node++) {
          const a = cell.positions[node], b = cell.positions[feed * m * nodesPerLoop + node];
          assert.ok(Math.abs(b[0] - a[0]) < 1e-12 && Math.abs(b[1] - a[1] - feed * cell.H / n) < 1e-12 && Math.abs(b[2] - a[2]) < 1e-12, "feed copies use the vertical lattice translation");
        }
      }
      assert.deepEqual(cell, createFabricFormInitialGeometry(topology, { loopLengthMm: 3 }), "initial geometry is deterministic");
      assert.equal(cell.topology.crossingConvention?.projection, "XY");
      assert.equal(cell.topology.crossingConvention?.order, "increasing-material-order");
      for (const loop of cell.topology.loops) {
        assert.deepEqual(previousCourseCrossings(cell, loop), loop.passesThrough.crossings,
          "directed crossing order, local over/under, target loop and periodic image match the source geometry");
      }
      if (m === 1 && n === 1) {
        // This fixed-projection seed signature is not an invariant of every
        // collision-free deformation and is not a general topological proof.
        const mirrored = { ...cell, positions: cell.positions.map(([x, y, z]) => [x, y, -z]) };
        const crossings = previousCourseCrossings(mirrored, mirrored.topology.loops[0]);
        assert.deepEqual(crossings, cell.topology.loops[0].passesThrough.crossings
          .map(crossing => ({ ...crossing, over: -crossing.over })),
        "the geometric check detects a reversed local face while preserving in-plane tangent orientation");
        const repeated = replicatePeriodicCell(cell, 2, 2);
        for (const loop of repeated.topology.loops) {
          assert.deepEqual(previousCourseCrossings(repeated, loop), loop.passesThrough.crossings,
            "replication remaps crossing target identities and images at internal and periodic seams");
        }
        const doubled = createFabricFormInitialGeometry(createPlainJerseyTopology({ m, n, nodesPerLoop, loopLengthMm: 6 }), { loopLengthMm: 6 });
        assert.ok(Math.abs(doubled.W / cell.W - 2) < 1e-12 && Math.abs(doubled.H / cell.H - 2) < 1e-12, "uniform material scaling changes all seed dimensions consistently");
      }
      results.push({ m, n, nodesPerLoop, W: cell.W, H: cell.H, materialLengthMm: totals[0] });
    }
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await runFabricFormInitialChecks(), null, 2));
}
