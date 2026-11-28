import { actualEdgeVector } from "../fabricForm/periodicCell.js";

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function periodicNode(centerline, index) {
  const count = centerline.nodes.length;
  const period = Math.floor(index / count);
  const point = centerline.nodes[index - period * count];
  return point.map((value, axis) => value + period * centerline.D[axis]);
}

/** Cubic Hermite coefficients equivalent to centripetal Catmull–Rom, alpha=0.5. */
function segmentData(centerline, index) {
  const p0 = periodicNode(centerline, index - 1);
  const p1 = periodicNode(centerline, index);
  const p2 = periodicNode(centerline, index + 1);
  const p3 = periodicNode(centerline, index + 2);
  const h0 = Math.sqrt(distance(p0, p1));
  const h1 = Math.sqrt(distance(p1, p2));
  const h2 = Math.sqrt(distance(p2, p3));
  if (!(h0 > 0 && h1 > 0 && h2 > 0)) {
    throw new RangeError("Centerline needs distinct consecutive periodic nodes.");
  }
  const m1 = p1.map((_, k) => h1 * ((p1[k] - p0[k]) / h0 -
    (p2[k] - p0[k]) / (h0 + h1) + (p2[k] - p1[k]) / h1));
  const m2 = p2.map((_, k) => h1 * ((p2[k] - p1[k]) / h1 -
    (p3[k] - p1[k]) / (h1 + h2) + (p3[k] - p2[k]) / h2));
  return { p1, p2, m1, m2 };
}

function evaluateSegment({ p1, p2, m1, m2 }, u) {
  // Return endpoints directly: this is interpolation, without a fit or a node shift.
  if (u === 0) return [...p1];
  if (u === 1) return [...p2];
  const u2 = u * u, u3 = u2 * u;
  return p1.map((value, k) => (2 * u3 - 3 * u2 + 1) * value +
    (u3 - 2 * u2 + u) * m1[k] + (-2 * u3 + 3 * u2) * p2[k] +
    (u3 - u2) * m2[k]);
}

function tangentSegment({ p1, p2, m1, m2 }, u) {
  const u2 = u * u;
  const tangent = p1.map((value, k) => (6 * u2 - 6 * u) * value +
    (3 * u2 - 4 * u + 1) * m1[k] + (-6 * u2 + 6 * u) * p2[k] +
    (3 * u2 - 2 * u) * m2[k]);
  const length = Math.hypot(...tangent);
  if (!(length > 0)) throw new RangeError("Centerline has a zero spline tangent.");
  return tangent.map(value => value / length);
}

/** Evaluate one original-node interval at u in [0,1]; coordinates are in mm. */
export function evaluateCenterlineSegment(centerline, segmentIndex, u) {
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0 ||
      segmentIndex >= centerline.nodes.length || !Number.isFinite(u) || u < 0 || u > 1) {
    throw new RangeError("Expected a centerline segment index and u in [0,1].");
  }
  return evaluateSegment(segmentData(centerline, segmentIndex), u);
}

function pointSegmentDistance(point, a, b) {
  const ab = b.map((value, k) => value - a[k]);
  const ap = point.map((value, k) => value - a[k]);
  const length2 = ab.reduce((sum, value) => sum + value * value, 0);
  const u = Math.max(0, Math.min(1, ap.reduce((sum, value, k) => sum + value * ab[k], 0) / length2));
  return Math.hypot(...ap.map((value, k) => value - u * ab[k]));
}

/**
 * Read a T1 cell without mutation and unfold its only yarn in material order.
 * nodes/nodeIds contain N original nodes (no duplicated endpoint); points contains
 * the N intervals' dense samples plus the endpoint nodes[0]+D. All positions,
 * lengths, W/H/S and radiusMm are mm. Tangents follow increasing material order.
 * nodeIndices holds the nearest original node ID, including periodic neighbors;
 * legNodes is a byte mask indexed by that ID for the middle 50% of the y extent.
 * The reported spline/polyline distance is the maximum over the dense samples.
 */
export function buildCenterline(cell, diameterMm) {
  const topology = cell?.topology;
  if (!topology || topology.m !== 1 || topology.n !== 1 || topology.yarns?.length !== 1 ||
      topology.operations?.length !== 1 || topology.operations[0]?.length !== 1 ||
      topology.operations[0][0] !== "K") {
    throw new RangeError("Fabric texture supports only T1: one all-knit, single-yarn cell (m=n=1).");
  }
  if (![cell.W, cell.H, diameterMm].every(value => Number.isFinite(value) && value > 0) ||
      !Number.isFinite(cell.S) || cell.positions?.length !== topology.nodeCount ||
      !cell.positions.every(point => point.length === 3 && point.every(Number.isFinite))) {
    throw new RangeError("Centerline requires finite positions, positive W/H/diameter and finite S.");
  }
  const yarn = topology.yarns[0];
  if (!Array.isArray(yarn.edgeIndices) || yarn.edgeIndices.length < 3) {
    throw new RangeError("Centerline requires at least three ordered yarn edges.");
  }
  const first = topology.edges[yarn.edgeIndices[0]];
  if (!first) throw new RangeError("The first yarn edge is missing.");
  const nodes = [], nodeIds = [];
  let nextId = first.from, current = [...cell.positions[nextId]];
  let polygonLengthMm = 0, p = 0, q = 0;
  for (const edgeIndex of yarn.edgeIndices) {
    const edge = topology.edges[edgeIndex];
    if (!edge || edge.from !== nextId || !Number.isInteger(edge.p) || !Number.isInteger(edge.q)) {
      throw new RangeError("Yarn edges must be connected and ordered, with integer periodic offsets.");
    }
    nodes.push(current);
    nodeIds.push(edge.from);
    const vector = actualEdgeVector(cell, edge);
    const length = Math.hypot(...vector);
    if (!(length > 0) || !Number.isFinite(length)) throw new RangeError("Invalid centerline edge length.");
    polygonLengthMm += length;
    current = current.map((value, k) => value + vector[k]);
    nextId = edge.to;
    p += edge.p;
    q += edge.q;
  }
  if (nextId !== first.from || nodes.length !== topology.nodeCount || new Set(nodeIds).size !== nodes.length) {
    throw new RangeError("T1 yarn must visit every node once and close periodically.");
  }
  const D = current.map((value, k) => value - nodes[0][k]);
  const radiusMm = diameterMm / 2, maxSpacingMm = radiusMm / 12;
  const centerline = { nodes, nodeIds, D, radiusMm, W: cell.W, H: cell.H, S: cell.S };
  const points = [], tangents = [];
  for (let i = 0; i < nodes.length; i++) {
    const segment = segmentData(centerline, i);
    let divisions = Math.max(1, Math.ceil(distance(segment.p1, segment.p2) / maxSpacingMm));
    let samples;
    // Keep each interval uniformly parameterized; refine until every chord fits.
    for (;;) {
      samples = Array.from({ length: divisions + 1 }, (_, j) => evaluateSegment(segment, j / divisions));
      let longest = 0;
      for (let j = 1; j < samples.length; j++) longest = Math.max(longest, distance(samples[j - 1], samples[j]));
      if (longest <= maxSpacingMm) break;
      divisions = Math.max(divisions + 1, Math.ceil(divisions * longest / maxSpacingMm * (1 + 1e-12)));
    }
    for (let j = 0; j < divisions; j++) {
      points.push(samples[j]);
      tangents.push(tangentSegment(segment, j / divisions));
    }
  }
  points.push(periodicNode(centerline, nodes.length));
  tangents.push([...tangents[0]]);
  const arcLengths = new Float64Array(points.length);
  let maxSampleSpacingMm = 0;
  for (let i = 1; i < points.length; i++) {
    const spacing = distance(points[i - 1], points[i]);
    arcLengths[i] = arcLengths[i - 1] + spacing;
    maxSampleSpacingMm = Math.max(maxSampleSpacingMm, spacing);
  }
  const nodeIndices = new Int32Array(points.length);
  let maxSplinePolylineDistanceMm = 0;
  for (let i = 0; i < points.length; i++) {
    let nearestNodeDistance = Infinity, nearestLineDistance = Infinity;
    for (let j = -nodes.length; j < 2 * nodes.length; j++) {
      const a = periodicNode(centerline, j);
      const nodeDistance = distance(points[i], a);
      if (nodeDistance < nearestNodeDistance) {
        nearestNodeDistance = nodeDistance;
        nodeIndices[i] = nodeIds[((j % nodes.length) + nodes.length) % nodes.length];
      }
      nearestLineDistance = Math.min(nearestLineDistance,
        pointSegmentDistance(points[i], a, periodicNode(centerline, j + 1)));
    }
    maxSplinePolylineDistanceMm = Math.max(maxSplinePolylineDistanceMm, nearestLineDistance);
  }
  const minY = Math.min(...nodes.map(point => point[1])), maxY = Math.max(...nodes.map(point => point[1]));
  const legNodes = new Uint8Array(topology.nodeCount);
  for (let i = 0; i < nodes.length; i++) {
    legNodes[nodeIds[i]] = Number(nodes[i][1] >= minY + 0.25 * (maxY - minY) &&
      nodes[i][1] <= minY + 0.75 * (maxY - minY));
  }
  const lengthMm = arcLengths[arcLengths.length - 1];
  const materialLengthMm = yarn.materialLength;
  return { ...centerline, legNodes, points, tangents, arcLengths, nodeIndices, lengthMm, materialLengthMm,
    diagnostics: { interpolation: "centripetal Catmull-Rom alpha=0.5", polygonLengthMm,
      lengthRelativeDeviation: lengthMm / materialLengthMm - 1, maxSplinePolylineDistanceMm,
      maxSampleSpacingMm, samplingLimitMm: maxSpacingMm, periodicDisplacement: [...D],
      periodicLatticeOffset: [p, q] } };
}
