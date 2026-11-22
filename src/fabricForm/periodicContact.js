import { edgeEndpoints, createCellGradient, accumulateEndpointGradient } from "./periodicCell.js";
import { isLocalMaterialPair } from "./fabricFormTopology.js";
import { integrateSegmentContact, integrateSegmentBarrier, segmentDistance } from "./yarnContact.js";

const subtract = (a, b) => a.map((x, k) => x - b[k]);
const length = vector => Math.hypot(...vector);
const translate = (points, x, y) => points.map(point => [point[0] + x, point[1] + y, point[2]]);

function validate(cell, params) {
  if (!Number.isFinite(cell.W) || cell.W <= 0 || !Number.isFinite(cell.H) || cell.H <= 0 ||
      !Number.isFinite(cell.S)) throw new RangeError("Periodic contact requires a finite nondegenerate lattice.");
  if (!(params.d_e > params.r_c && params.r_c > 0) || !Number.isFinite(params.d_e) ||
      !Number.isFinite(params.K) || params.K <= 0 || !Number.isFinite(params.E_f) || params.E_f <= 0 ||
      !Number.isFinite(params.K * params.E_f) || !(params.phi0 > 0 && params.phi0 < 1)) {
    throw new RangeError("Contact parameters require finite d_e > r_c > 0, K > 0, E_f > 0 and 0 < phi0 < 1.");
  }
  if (!Array.isArray(cell.positions) || cell.positions.some(point => !Array.isArray(point) ||
      point.length !== 3 || point.some(value => !Number.isFinite(value)))) {
    throw new TypeError("Contact positions must be finite three-dimensional coordinates.");
  }
  if (!Array.isArray(cell.topology?.edges) || !Array.isArray(cell.topology?.yarns)) {
    throw new TypeError("Contact requires edges and material yarn identities.");
  }
  for (const edge of cell.topology.edges) {
    if (![edge.from, edge.to, edge.p, edge.q].every(Number.isInteger) || edge.from < 0 || edge.to < 0 ||
        edge.from >= cell.positions.length || edge.to >= cell.positions.length ||
        !Number.isFinite(edge.materialStart) || !Number.isFinite(edge.restLength) || edge.restLength <= 0) {
      throw new RangeError("Contact edge has invalid endpoints, image or material interval.");
    }
    const points = edgeEndpoints(cell, edge);
    if (!(length(subtract(points[1], points[0])) > 0)) throw new RangeError("Contact edge has zero length.");
  }
}

function bounds(points) {
  return { min: [0, 1, 2].map(k => Math.min(...points.map(point => point[k]))),
    max: [0, 1, 2].map(k => Math.max(...points.map(point => point[k]))) };
}

function boxesNear(a, b, range) {
  let distance2 = 0;
  for (let k = 0; k < 3; k++) {
    const gap = Math.max(0, a.min[k] - b.max[k], b.min[k] - a.max[k]);
    distance2 += gap * gap;
  }
  return distance2 <= range * range;
}

function gridBounds(box, spacing) {
  const low = box.min.map(x => Math.floor(x / spacing));
  const high = box.max.map(x => Math.floor(x / spacing));
  return { low, high, count: high.reduce((product, x, k) => product * (x - low[k] + 1), 1) };
}

function visitGrid({ low, high }, callback) {
  for (let x = low[0]; x <= high[0]; x++) for (let y = low[1]; y <= high[1]; y++) {
    for (let z = low[2]; z <= high[2]; z++) callback(`${x},${y},${z}`);
  }
}

/** Broad phase for the entire linear motion, not only the final configuration. */
function candidatePairs(cell, params, finalCell = cell) {
  const range = params.d_e;
  const entries = cell.topology.edges.map((edge, index) => {
    const points = edgeEndpoints(cell, edge);
    const finalPoints = edgeEndpoints(finalCell, edge);
    return { edge, index, points, box: bounds([...points, ...finalPoints]), finalPoints };
  });
  if (!entries.length) throw new RangeError("Contact topology must contain at least one edge.");
  const envelope = bounds(entries.flatMap(entry => [entry.box.min, entry.box.max]));
  const minW = Math.min(cell.W, finalCell.W), minH = Math.min(cell.H, finalCell.H);
  const maxAbsS = Math.max(Math.abs(cell.S), Math.abs(finalCell.S));
  const qMax = Math.ceil((envelope.max[1] - envelope.min[1] + range) / minH);
  const pMax = Math.ceil((envelope.max[0] - envelope.min[0] + range + qMax * maxAbsS) / minW);
  if (!Number.isSafeInteger(pMax) || !Number.isSafeInteger(qMax)) {
    throw new RangeError("Periodic image bounds exceed the finite integer range.");
  }
  const imageBounds = { pMax, qMax, minW, minH, maxAbsS, range };
  const buckets = new Map(), largeBoxes = [];
  for (const entry of entries) {
    const grid = gridBounds(entry.box, range);
    // Large swept boxes use a direct AABB fallback; never truncate candidate coverage.
    if (grid.count > 4096) { largeBoxes.push(entry.index); continue; }
    visitGrid(grid, key => {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(entry.index);
    });
  }
  function forEach(callback) {
    let candidateCount = 0;
    for (let q = -qMax; q <= qMax; q++) for (let p = -pMax; p <= pMax; p++) {
      for (const target of entries) {
        const points = translate(target.points, p * cell.W + q * cell.S, q * cell.H);
        const finalPoints = translate(target.finalPoints, p * finalCell.W + q * finalCell.S, q * finalCell.H);
        const box = bounds([...points, ...finalPoints]);
        if (!boxesNear(envelope, box, range)) continue;
        const query = { min: box.min.map((x, k) => Math.max(x - range, envelope.min[k])),
          max: box.max.map((x, k) => Math.min(x + range, envelope.max[k])) };
        const grid = gridBounds(query, range);
        const indices = new Set(largeBoxes);
        if (grid.count > 100000) entries.forEach(entry => indices.add(entry.index));
        else visitGrid(grid, key => { for (const index of buckets.get(key) ?? []) indices.add(index); });
        for (const index of [...indices].sort((a, b) => a - b)) {
          if (index > target.index || (index === target.index && !(q > 0 || (q === 0 && p > 0)))) continue;
          const origin = entries[index];
          if (!boxesNear(origin.box, box, range) ||
              isLocalMaterialPair(cell.topology, origin.edge, target.edge, p, q, 2 * range)) continue;
          candidateCount++;
          if (callback(origin, target, p, q, points) === false) return candidateCount;
        }
      }
    }
    return candidateCount;
  }
  return { imageBounds, forEach };
}

export function evaluatePeriodicContact(cell, params, { quadratureOrder = 12 } = {}) {
  validate(cell, params);
  if (!Number.isInteger(quadratureOrder) || quadratureOrder < 2 || quadratureOrder > 64) {
    throw new RangeError("quadratureOrder must be an integer from 2 to 64.");
  }
  const gradient = createCellGradient(cell), barrierGradient = createCellGradient(cell);
  const candidates = candidatePairs(cell, params);
  const result = { energy: 0, contactEnergy: 0, barrierEnergy: 0, gradient, barrierGradient,
    minDistance: Infinity, activePairs: 0, barrierPairs: 0, imageBounds: candidates.imageBounds,
    distanceScope: "support-AABB candidates; distances outside d_e are only bounded below by d_e",
    feasible: true, diagnostics: [] };
  result.candidatePairs = candidates.forEach((origin, target, p, q, points) => {
    const [a, b] = origin.points, [c, d] = points;
    const closest = segmentDistance(a, b, c, d);
    result.minDistance = Math.min(result.minDistance, closest.distance);
    if (closest.distance <= params.r_c) {
      result.feasible = false;
      result.energy = Infinity;
      result.diagnostics.push({ code: "INFEASIBLE_NONLOCAL_GAP", edgeA: origin.index, edgeB: target.index,
        p, q, distance: closest.distance, required: params.r_c });
      return false;
    }
    if (closest.distance >= params.d_e) return;
    result.activePairs++;
    const contact = integrateSegmentContact(a, b, c, d, params, quadratureOrder);
    result.contactEnergy += contact.energy;
    accumulateEndpointGradient(gradient, origin.edge, contact.gradient[0], contact.gradient[1]);
    accumulateEndpointGradient(gradient, target.edge, contact.gradient[2], contact.gradient[3], p, q);
    const barrier = integrateSegmentBarrier(a, b, c, d, params, quadratureOrder);
    if (barrier.energy > 0) {
      result.barrierPairs++;
      result.barrierEnergy += barrier.energy;
      accumulateEndpointGradient(barrierGradient, origin.edge, barrier.gradient[0], barrier.gradient[1]);
      accumulateEndpointGradient(barrierGradient, target.edge, barrier.gradient[2], barrier.gradient[3], p, q);
    }
  });
  if (result.feasible) {
    result.energy = result.contactEnergy + result.barrierEnergy;
    gradient.forEach((_, index) => { gradient[index] += barrierGradient[index]; });
  } else {
    gradient.fill(NaN);
    barrierGradient.fill(NaN);
  }
  return result;
}

/** Distance Lipschitz bound using all four relative endpoint velocities. */
export function safePeriodicStep(cell, direction, params, maxStep = 1) {
  validate(cell, params);
  const lattice = 3 * cell.positions.length;
  if (direction.length !== lattice + 3 || !Array.from(direction).every(Number.isFinite) ||
      !Number.isFinite(maxStep) || maxStep < 0) throw new RangeError("Invalid finite step direction or maxStep.");
  let alpha = maxStep;
  if (direction[lattice] < 0) alpha = Math.min(alpha, -0.5 * cell.W / direction[lattice]);
  if (direction[lattice + 1] < 0) alpha = Math.min(alpha, -0.5 * cell.H / direction[lattice + 1]);
  if (alpha === 0) return 0;
  const velocities = { positions: cell.positions.map((_, i) => Array.from(direction.slice(3 * i, 3 * i + 3))),
    W: direction[lattice], H: direction[lattice + 1], S: direction[lattice + 2] };
  // Bound the trial displacement before enumerating its swept images; CCD still supplies the safety proof.
  const motion = Math.max(Math.abs(velocities.W), Math.abs(velocities.H), Math.abs(velocities.S),
    ...cell.topology.edges.flatMap(edge => edgeEndpoints(velocities, edge).map(length)));
  if (motion > 0) alpha = Math.min(alpha, params.d_e / motion);
  const finalCell = { ...cell,
    positions: cell.positions.map((point, i) => point.map((x, k) => x + alpha * velocities.positions[i][k])),
    W: cell.W + alpha * velocities.W, H: cell.H + alpha * velocities.H, S: cell.S + alpha * velocities.S };
  if (![finalCell.W, finalCell.H, finalCell.S, ...finalCell.positions.flat()].every(Number.isFinite)) {
    throw new RangeError("Step trajectory has nonfinite coordinates.");
  }
  const candidates = candidatePairs(cell, params, finalCell);
  candidates.forEach((origin, target, p, q, points) => {
    const closest = segmentDistance(...origin.points, ...points);
    if (closest.distance <= params.r_c) { alpha = 0; return false; }
    const aVelocity = edgeEndpoints(velocities, origin.edge);
    const bVelocity = edgeEndpoints(velocities, target.edge, p, q);
    const speed = Math.max(...aVelocity.flatMap(a => bVelocity.map(b => length(subtract(a, b)))));
    if (speed > 0) alpha = Math.min(alpha, 0.8 * (closest.distance - params.r_c) / speed);
  });
  return alpha;
}
