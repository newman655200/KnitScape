import {
  actualEdgeVector,
  accumulateEndpointGradient,
  createCellGradient,
} from "./periodicCell.js";

/** Gradients and constraint Jacobian rows use kernel-local [positions(3N), W, H, S]
 * order. T1 model wrappers scatter them to the model's global layout. */

function evaluatedEdges(cell) {
  if (!Array.isArray(cell?.positions) || cell.positions.length === 0
    || cell.positions.some(point => !Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite))) {
    throw new TypeError("Invalid rod positions: expected finite 3D points");
  }
  if (!(cell.W > 0) || !(cell.H > 0) || ![cell.W, cell.H, cell.S].every(Number.isFinite)) {
    throw new RangeError("Invalid rod cell: W and H must be positive and W/H/S finite");
  }
  const edges = cell.topology?.edges;
  if (!Array.isArray(edges) || edges.length === 0) {
    throw new TypeError("Invalid rod topology: expected nonempty edges");
  }
  return edges.map(edge => {
    if (!edge || !Number.isInteger(edge.from) || !Number.isInteger(edge.to)
      || edge.from < 0 || edge.to < 0 || edge.from >= cell.positions.length || edge.to >= cell.positions.length
      || !Number.isSafeInteger(edge.p) || !Number.isSafeInteger(edge.q)) {
      throw new TypeError("Invalid rod edge indices or integer periodic offsets");
    }
    if (!(edge.restLength > 0) || !Number.isFinite(edge.restLength)) {
      throw new RangeError("Rod reference lengths must be finite and positive");
    }
    const vector = actualEdgeVector(cell, edge);
    const length = Math.hypot(...vector);
    if (!(length > 0) || !Number.isFinite(length)) {
      throw new RangeError("Invalid rod edge: zero or nonfinite length");
    }
    return { vector, length };
  });
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function scatterEdgeGradient(gradient, edge, derivative) {
  accumulateEndpointGradient(gradient, edge, derivative.map(value => -value), derivative);
}

/** B is in N·mm²; energy in N·mm. Flat gradient ends with W, H, S. */
export function evaluateRodBending(cell, B) {
  if (!Number.isFinite(B) || B < 0) throw new RangeError("B must be finite and nonnegative");
  const geometry = evaluatedEdges(cell);
  const edges = cell.topology.edges;
  if (!Array.isArray(cell.topology.bends)) throw new TypeError("Invalid rod topology: expected bends");
  const gradient = createCellGradient(cell);
  let energy = 0;
  for (const bend of cell.topology.bends) {
    const previous = bend?.prevEdge;
    const next = bend?.nextEdge;
    if (!Number.isInteger(previous) || !Number.isInteger(next)
      || previous < 0 || next < 0 || previous >= edges.length || next >= edges.length) {
      throw new TypeError("Invalid rod bend edge indices");
    }
    if (edges[previous].to !== edges[next].from || edges[previous].yarnId !== edges[next].yarnId) {
      throw new TypeError("Rod bend edges must be connected in the same directed yarn");
    }
    const { vector: a, length: la } = geometry[previous];
    const { vector: b, length: lb } = geometry[next];
    const c = cross(a, b);
    const c2 = c[0] ** 2 + c[1] ** 2 + c[2] ** 2;
    const denominator = la * lb + a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    if (!(denominator > 64 * Number.EPSILON * la * lb)) {
      throw new RangeError("Invalid rod bend: antiparallel or numerically unresolved tangents");
    }
    const sumLength = la + lb;
    // The denominator is the sum of both full edges, not the half-length Voronoi cell.
    const factor = 4 * B / (denominator ** 2 * sumLength);
    const bendEnergy = factor * c2;
    energy += bendEnergy;
    const cDerivativeA = cross(b, c);
    const cDerivativeB = cross(c, a);
    const derivativeA = a.map((value, axis) => factor * (
      2 * cDerivativeA[axis] - c2 * (2 * (lb * value / la + b[axis]) / denominator + value / (la * sumLength))
    ));
    const derivativeB = b.map((value, axis) => factor * (
      2 * cDerivativeB[axis] - c2 * (2 * (la * value / lb + a[axis]) / denominator + value / (lb * sumLength))
    ));
    if (!Number.isFinite(energy) || !derivativeA.every(Number.isFinite) || !derivativeB.every(Number.isFinite)) {
      throw new RangeError("Invalid rod bend: energy or gradient is not finite");
    }
    scatterEdgeGradient(gradient, edges[previous], derivativeA);
    scatterEdgeGradient(gradient, edges[next], derivativeB);
  }
  return { energy, gradient };
}

/** Dimensionless material strain constraints g_e = length_e / restLength_e - 1. */
export function evaluateLengthConstraints(cell) {
  const geometry = evaluatedEdges(cell);
  const values = new Float64Array(geometry.length);
  const jacobian = [];
  let maxStrain = 0;
  for (let i = 0; i < geometry.length; i++) {
    const { vector, length } = geometry[i];
    const edge = cell.topology.edges[i];
    values[i] = length / edge.restLength - 1;
    const row = createCellGradient(cell);
    const derivative = vector.map(value => value / length / edge.restLength);
    if (!Number.isFinite(values[i]) || !derivative.every(Number.isFinite)) {
      throw new RangeError("Invalid rod length constraint: strain or gradient is not finite");
    }
    scatterEdgeGradient(row, edge, derivative);
    jacobian.push(row);
    maxStrain = Math.max(maxStrain, Math.abs(values[i]));
  }
  return { values, jacobian, maxStrain };
}
