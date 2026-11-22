import { createPlainJerseyTopology } from "./fabricFormTopology.js";

export function edgeEndpoints(cell, edge, p = 0, q = 0) {
  const from = cell.positions[edge.from], to = cell.positions[edge.to];
  return [
    [from[0] + p * cell.W + q * cell.S, from[1] + q * cell.H, from[2]],
    [to[0] + (p + edge.p) * cell.W + (q + edge.q) * cell.S,
      to[1] + (q + edge.q) * cell.H, to[2]],
  ];
}

export function actualEdgeVector(cell, edge) {
  const from = cell.positions[edge.from], to = cell.positions[edge.to];
  return [to[0] + edge.p * cell.W + edge.q * cell.S - from[0],
    to[1] + edge.q * cell.H - from[1], to[2] - from[2]];
}

export function createCellGradient(cell) {
  return new Float64Array(3 * cell.positions.length + 3);
}

/** Scatter gradients of translated endpoints, including both moving lattice images. */
export function accumulateEndpointGradient(gradient, edge, fromGradient, toGradient, p = 0, q = 0) {
  for (let k = 0; k < 3; k++) {
    gradient[3 * edge.from + k] += fromGradient[k];
    gradient[3 * edge.to + k] += toGradient[k];
  }
  const lattice = gradient.length - 3;
  gradient[lattice] += p * fromGradient[0] + (p + edge.p) * toGradient[0];
  gradient[lattice + 1] += q * fromGradient[1] + (q + edge.q) * toGradient[1];
  gradient[lattice + 2] += q * fromGradient[0] + (q + edge.q) * toGradient[0];
  return gradient;
}

/** Copy the same plain-jersey geometry; no independent relaxation or resampling. */
export function replicatePeriodicCell(cell, copiesM, copiesN) {
  if (!Number.isInteger(copiesM) || copiesM < 1 || !Number.isInteger(copiesN) || copiesN < 1) {
    throw new RangeError("Cell copy counts must be positive integers.");
  }
  const source = cell.topology;
  if (cell.positions.length !== source.nodeCount || !Number.isFinite(cell.W) || cell.W <= 0 ||
      !Number.isFinite(cell.H) || cell.H <= 0 || !Number.isFinite(cell.S)) {
    throw new RangeError("Periodic cell needs matching positions and nondegenerate finite lattice.");
  }
  const topology = createPlainJerseyTopology({ m: source.m * copiesM, n: source.n * copiesN,
    nodesPerLoop: source.nodesPerLoop, loopLengthMm: source.loopLengthMm });
  const positions = new Array(topology.nodeCount);
  const sourceNodeIndices = new Array(topology.nodeCount);
  const sourceEdgeIndices = new Array(topology.edges.length);
  const sourceOffsets = new Array(topology.nodeCount);
  const rowNodes = source.m * source.nodesPerLoop;
  const newRowNodes = rowNodes * copiesM;
  for (let b = 0; b < copiesN; b++) {
    for (let a = 0; a < copiesM; a++) {
      for (let feed = 0; feed < source.n; feed++) {
        for (let order = 0; order < rowNodes; order++) {
          const original = feed * rowNodes + order;
          const target = (b * source.n + feed) * newRowNodes + a * rowNodes + order;
          const point = cell.positions[original];
          positions[target] = [point[0] + a * cell.W + b * cell.S, point[1] + b * cell.H, point[2]];
          sourceNodeIndices[target] = original;
          sourceEdgeIndices[target] = original;
          sourceOffsets[target] = [a, b];
          const sourceEdge = source.edges[original];
          topology.edges[target].restLength = sourceEdge.restLength;
          topology.edges[target].materialStart = sourceEdge.materialStart + a * source.yarns[feed].materialLength;
        }
      }
    }
  }
  for (const yarn of topology.yarns) {
    yarn.materialLength = copiesM * source.yarns[yarn.feed % source.n].materialLength;
  }
  return { positions, W: copiesM * cell.W, H: copiesN * cell.H, S: copiesN * cell.S,
    topology, replication: { copiesM, copiesN, sourceNodeIndices, sourceEdgeIndices, sourceOffsets } };
}
