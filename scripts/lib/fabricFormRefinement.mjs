import { createPlainJerseyTopology } from "../../src/fabricForm/fabricFormTopology.js";
import { actualEdgeVector } from "../../src/fabricForm/periodicCell.js";
import { evaluatePeriodicContact, safePeriodicStep } from "../../src/fabricForm/periodicContact.js";

/** DER curvature divided by its half-edge-sum dual length; this is a mesh diagnostic. */
export function describeRefinementGeometry(cell) {
  const vectors = cell.topology.edges.map(edge => actualEdgeVector(cell, edge));
  const lengths = vectors.map(vector => Math.hypot(...vector));
  let maxDiscreteCurvaturePerMm = 0, maxTurningAngleRadians = 0;
  for (const bend of cell.topology.bends) {
    const a = vectors[bend.prevEdge], b = vectors[bend.nextEdge];
    const la = lengths[bend.prevEdge], lb = lengths[bend.nextEdge];
    const cosine = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosine)));
    const curvature = 4 * Math.tan(angle / 2) / (la + lb);
    maxDiscreteCurvaturePerMm = Math.max(maxDiscreteCurvaturePerMm, curvature);
    maxTurningAngleRadians = Math.max(maxTurningAngleRadians, angle);
  }
  return { maxDiscreteCurvaturePerMm, maxTurningAngleRadians,
    minSegmentLengthMm: Math.min(...lengths), maxSegmentLengthMm: Math.max(...lengths) };
}

function interval(knots, u) {
  let low = 0, high = knots.length - 2;
  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2);
    if (knots[middle] <= u) low = middle;
    else high = middle - 1;
  }
  return low;
}

function linearPoint(points, knots, u) {
  const i = interval(knots, u);
  const t = (u - knots[i]) / (knots[i + 1] - knots[i]);
  return points[i].map((value, k) => value + t * (points[i + 1][k] - value));
}

function materialKnots(cell) {
  const knots = [0];
  const total = cell.topology.loopLengthMm;
  for (const edge of cell.topology.edges) knots.push(knots.at(-1) + edge.restLength / total);
  if (Math.abs(knots.at(-1) - 1) > 1e-10) throw new RangeError("Source material length does not match its target");
  knots[knots.length - 1] = 1;
  return knots;
}

function smoothSamples(source, knots, count) {
  const n = source.positions.length;
  const points = source.positions.map(point => point.slice());
  points.push([points[0][0] + source.W, points[0][1], points[0][2]]);
  const tangents = source.positions.map((point, i) => {
    const previous = i === 0 ? [points[n - 1][0] - source.W, points[n - 1][1], points[n - 1][2]] : points[i - 1];
    const before = i === 0 ? 1 - knots[n - 1] : knots[i] - knots[i - 1];
    const after = knots[i + 1] - knots[i];
    return point.map((value, axis) => (
      after * (value - previous[axis]) / before + before * (points[i + 1][axis] - value) / after
    ) / (before + after));
  });
  const at = u => {
    const i = interval(knots, u), h = knots[i + 1] - knots[i], t = (u - knots[i]) / h;
    const a = 2 * t ** 3 - 3 * t ** 2 + 1, b = t ** 3 - 2 * t ** 2 + t;
    const c = -2 * t ** 3 + 3 * t ** 2, d = t ** 3 - t ** 2;
    return points[i].map((value, k) => a * value + b * h * tangents[i][k]
      + c * points[i + 1][k] + d * h * tangents[(i + 1) % n][k]);
  };
  const denseU = [0], arc = [0];
  let last = at(0);
  for (let i = 0; i < n; i++) {
    for (let k = 1; k <= 64; k++) {
      const u = knots[i] + (knots[i + 1] - knots[i]) * k / 64;
      const point = at(u);
      denseU.push(u);
      arc.push(arc.at(-1) + Math.hypot(...point.map((value, axis) => value - last[axis])));
      last = point;
    }
  }
  const sampleU = [], samples = [];
  let atIndex = 1;
  for (let i = 0; i <= count; i++) {
    const target = arc.at(-1) * i / count;
    while (atIndex < arc.length - 1 && arc[atIndex] < target) atIndex++;
    const t = (target - arc[atIndex - 1]) / (arc[atIndex] - arc[atIndex - 1]);
    const u = i === count ? 1 : denseU[atIndex - 1] + t * (denseU[atIndex] - denseU[atIndex - 1]);
    sampleU.push(u);
    samples.push(at(u));
  }
  return { samples, sampleU, sourcePoints: points, smoothArcLength: arc.at(-1) };
}

/** Only numerical continuation of an already solved 1x1 branch; no material/model fitting. */
export function createRefinedFabricCell(source, count, params) {
  const topology = source.topology;
  if (topology.m !== 1 || topology.n !== 1 || !Number.isInteger(count) || count <= topology.nodesPerLoop
    || topology.edges.some((edge, i) => edge.from !== i || edge.to !== (i + 1) % topology.nodeCount
      || edge.p !== (i === topology.nodeCount - 1 ? 1 : 0) || edge.q !== 0)) {
    throw new RangeError("Smooth refinement requires an ordered 1x1 periodic yarn and an increased node count");
  }
  const knots = materialKnots(source);
  const { samples, sampleU, sourcePoints, smoothArcLength } = smoothSamples(source, knots, count);
  const polygonLength = samples.slice(0, -1).reduce((sum, point, i) => sum
    + Math.hypot(...point.map((value, k) => samples[i + 1][k] - value)), 0);
  const factor = topology.loopLengthMm / polygonLength;
  const origin = source.positions[0];
  const targetPoints = samples.map(point => point.map((value, k) => origin[k] + factor * (value - origin[k])));
  const refined = { positions: targetPoints.slice(0, -1), W: source.W * factor,
    H: source.H * factor, S: source.S * factor,
    topology: createPlainJerseyTopology({ nodesPerLoop: count, loopLengthMm: topology.loopLengthMm }) };
  let materialStart = 0;
  for (const edge of refined.topology.edges) {
    edge.restLength = Math.hypot(...actualEdgeVector(refined, edge));
    edge.materialStart = materialStart;
    materialStart += edge.restLength;
  }
  refined.topology.yarns[0].materialLength = topology.loopLengthMm;
  refined.topology.loops[0].passesThrough = structuredClone(topology.loops[0].passesThrough);
  if (topology.crossingConvention) refined.topology.crossingConvention = structuredClone(topology.crossingConvention);

  // A common subdivision represents BOTH endpoint polylines exactly, so CCD covers
  // the full interpolation trajectory, rather than relying on endpoint sampling.
  const union = [...knots, ...sampleU].sort((a, b) => a - b)
    .filter((value, i, all) => i === 0 || value - all[i - 1] > 1e-12);
  const pathTopology = createPlainJerseyTopology({ nodesPerLoop: union.length - 1, loopLengthMm: topology.loopLengthMm });
  pathTopology.edges.forEach((edge, i) => {
    edge.restLength = (union[i + 1] - union[i]) * topology.loopLengthMm;
    edge.materialStart = union[i] * topology.loopLengthMm;
  });
  const startPoints = union.slice(0, -1).map(u => linearPoint(sourcePoints, knots, u));
  const endPoints = union.slice(0, -1).map(u => linearPoint(targetPoints, sampleU, u));
  const difference = Float64Array.from([...startPoints.flatMap((point, i) => point.map((value, k) => endPoints[i][k] - value)),
    refined.W - source.W, refined.H - source.H, refined.S - source.S]);
  let progress = 0, continuationSteps = 0;
  while (progress < 1 && continuationSteps < 1000) {
    const cell = { topology: pathTopology,
      positions: startPoints.map((point, i) => point.map((value, k) => value + progress * difference[3 * i + k])),
      W: source.W + progress * (refined.W - source.W),
      H: source.H + progress * (refined.H - source.H), S: source.S + progress * (refined.S - source.S) };
    const step = safePeriodicStep(cell, difference, params, 1 - progress);
    if (!(step > 1e-12)) throw new RangeError("Refinement continuation has no safe nonlocal-gap step");
    progress += step;
    continuationSteps++;
  }
  if (progress < 1) throw new RangeError("Refinement continuation did not reach its endpoint");
  const contact = evaluatePeriodicContact(refined, params, { quadratureOrder: 12 });
  if (!contact.feasible) throw new RangeError("Refined periodic geometry has an infeasible nonlocal gap");
  refined.refinement = { sourceNodes: topology.nodesPerLoop, targetNodes: count,
    method: "C1 periodic cubic Hermite, arclength resampling, exact polygonal material-length normalization",
    numericalContinuationOnly: true, smoothArcLength, lengthNormalization: factor,
    targetMaterialLength: topology.loopLengthMm, continuationComplete: true, continuationSteps,
    homotopyNodes: union.length - 1, finalFeasible: true, finalMinDistance: contact.minDistance,
    topologyEvidence: "Unchanged directed periodic topology plus continuous nonlocal-gap protected polyline homotopy; no surface claim" };
  return refined;
}
