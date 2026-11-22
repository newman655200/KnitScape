import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createFabricFormParams } from "../../src/fabricForm/fabricFormParams.js";
import { createPlainJerseyTopology } from "../../src/fabricForm/fabricFormTopology.js";
import { replicatePeriodicCell } from "../../src/fabricForm/periodicCell.js";
import { integrateSegmentContact, integrateSegmentBarrier, segmentDistance } from "../../src/fabricForm/yarnContact.js";

const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b)), `${a} != ${b}`);
function moved(cell, direction, alpha) {
  const offset = 3 * cell.positions.length;
  return { ...cell, positions: cell.positions.map((point, i) => point.map((x, k) => x + alpha * direction[3 * i + k])),
    W: cell.W + alpha * direction[offset], H: cell.H + alpha * direction[offset + 1], S: cell.S + alpha * direction[offset + 2] };
}
function separateSegments(positions, W = 4, H = 4, S = 0) {
  return { positions, W, H, S, topology: {
    yarns: [{ id: 0, materialLength: 2 }, { id: 1, materialLength: 2 }],
    edges: [{ id: 0, from: 0, to: 1, p: 0, q: 0, yarnId: 0, materialStart: 0, restLength: 0.5 },
      { id: 1, from: 2, to: 3, p: 0, q: 0, yarnId: 1, materialStart: 0, restLength: 0.5 }],
  } };
}

// Independent ordered-pair sum with a generous fixed image window: no broad phase
// and no production deduplication or material-neighborhood helper.
function bruteContact(cell, params, pLimit, qLimit, order = 12) {
  const endpoints = (edge, p, q) => {
    const a = cell.positions[edge.from], b = cell.positions[edge.to];
    return [[a[0] + p * cell.W + q * cell.S, a[1] + q * cell.H, a[2]],
      [b[0] + (p + edge.p) * cell.W + (q + edge.q) * cell.S,
        b[1] + (q + edge.q) * cell.H, b[2]]];
  };
  let energy = 0, activePairs = 0, minDistance = Infinity;
  for (let i = 0; i < cell.topology.edges.length; i++) {
    const edgeA = cell.topology.edges[i], [a, b] = endpoints(edgeA, 0, 0);
    for (let j = 0; j < cell.topology.edges.length; j++) {
      const edgeB = cell.topology.edges[j];
      for (let p = -pLimit; p <= pLimit; p++) for (let q = -qLimit; q <= qLimit; q++) {
        if (i === j && p === 0 && q === 0) continue;
        if (edgeA.yarnId === edgeB.yarnId && q === 0) {
          const materialLength = cell.topology.yarns.find(yarn => yarn.id === edgeA.yarnId).materialLength;
          const startA = edgeA.materialStart, startB = edgeB.materialStart + p * materialLength;
          const gap = Math.max(0, startB - startA - edgeA.restLength, startA - startB - edgeB.restLength);
          if (gap < 2 * params.d_e) continue;
        }
        const [c, d] = endpoints(edgeB, p, q), distance = segmentDistance(a, b, c, d).distance;
        minDistance = Math.min(minDistance, distance);
        if (distance <= params.r_c) return { energy: Infinity, activePairs, minDistance, collision: { i, j, p, q, distance } };
        if (distance >= params.d_e) continue;
        activePairs++;
        energy += integrateSegmentContact(a, b, c, d, params, order).energy;
        energy += integrateSegmentBarrier(a, b, c, d, params, order).energy;
      }
    }
  }
  return { energy: energy / 2, activePairs: activePairs / 2, minDistance };
}

export async function runPeriodicContactChecks() {
  assert.ok(existsSync(new URL("../../src/fabricForm/periodicContact.js", import.meta.url)),
    "Periodic contact and conservative trajectory step must be implemented.");
  const { evaluatePeriodicContact, safePeriodicStep } = await import("../../src/fabricForm/periodicContact.js");
  const params = createFabricFormParams();
  const results = [];

  // Contact exists only across the H/S lattice image, with active compaction protection.
  const fixture = separateSegments([[-0.25, 0.05, 0], [0.35, 0.06, 0.02],
    [-0.2, 0.55, 0.001], [0.3, 0.56, 0.04]], 1.7, 0.602, 0.13);
  fixture.positions[3][0] -= fixture.W;
  fixture.topology.edges[1].p = 1;
  assert.throws(() => evaluatePeriodicContact(fixture, { ...params, phi0: NaN }), /phi0|parameters/);
  const evaluated = evaluatePeriodicContact(fixture, params, { quadratureOrder: 32 });
  assert.ok(Number.isFinite(evaluated.energy) && evaluated.energy > 0);
  assert.ok(evaluated.barrierEnergy > 0 && evaluated.barrierPairs > 0);
  assert.ok(evaluated.gradient instanceof Float64Array);
  close(evaluated.energy, evaluated.contactEnergy + evaluated.barrierEnergy);
  const epsilon = 2e-7;
  let maxGradientError = 0, maxBarrierGradientError = 0;
  for (let i = 0; i < evaluated.gradient.length; i++) {
    const direction = new Float64Array(evaluated.gradient.length); direction[i] = 1;
    const plus = evaluatePeriodicContact(moved(fixture, direction, epsilon), params, { quadratureOrder: 32 });
    const minus = evaluatePeriodicContact(moved(fixture, direction, -epsilon), params, { quadratureOrder: 32 });
    const fd = (plus.energy - minus.energy) / (2 * epsilon);
    const error = Math.abs(fd - evaluated.gradient[i]) / Math.max(1e-5, Math.abs(fd), Math.abs(evaluated.gradient[i]));
    maxGradientError = Math.max(maxGradientError, error);
    close(evaluated.gradient[i], fd, 2e-6);
    const barrierFd = (plus.barrierEnergy - minus.barrierEnergy) / (2 * epsilon);
    const barrierError = Math.abs(barrierFd - evaluated.barrierGradient[i]) /
      Math.max(1e-8, Math.abs(barrierFd), Math.abs(evaluated.barrierGradient[i]));
    maxBarrierGradientError = Math.max(maxBarrierGradientError, barrierError);
    assert.ok(barrierError < 1e-5, `integrated barrier gradient ${i}: ${barrierError}`);
  }
  results.push({ name: "periodic contact plus barrier gradient including W/H/S", maxGradientError, maxBarrierGradientError });
  const lowOrder = evaluatePeriodicContact(fixture, params, { quadratureOrder: 12 });
  const lowOrderEnergyError = Math.abs(lowOrder.energy / evaluated.energy - 1);
  const lowOrderGradientError = Math.max(...lowOrder.gradient.map((value, i) => Math.abs(value - evaluated.gradient[i])));
  assert.ok(lowOrderEnergyError < 1e-6, "long-segment default integration must agree with the finer reference");
  assert.ok(lowOrderGradientError < 1e-6 * Math.max(...evaluated.gradient.map(Math.abs)));
  results.push({ name: "long-segment q12 vs q32 convergence diagnostic", lowOrderEnergyError, lowOrderGradientError });

  const topology = createPlainJerseyTopology({ nodesPerLoop: 8, loopLengthMm: 0.8 });
  const base = { W: 0.7, H: 0.108, S: 0.035, topology,
    positions: Array.from({ length: 8 }, (_, i) => [0.7 * i / 8,
      0.01 * Math.sin(2 * Math.PI * i / 8), 0.025 * Math.cos(2 * Math.PI * i / 8)]) };
  const original = evaluatePeriodicContact(base, params, { quadratureOrder: 12 });
  assert.ok(original.activePairs > 0, "nonzero self images must not all be excluded as local neighbors");
  assert.ok(original.barrierPairs > 0, "A5 must also exercise active barrier energy and derivatives");
  for (const [m, n] of [[2, 2], [3, 2]]) {
    const repeated = replicatePeriodicCell(base, m, n);
    const result = evaluatePeriodicContact(repeated, params, { quadratureOrder: 12 });
    close(result.energy / (m * n), original.energy, 2e-9);
    const pulled = new Float64Array(original.gradient.length);
    const size = original.gradient.length - 3, targetSize = result.gradient.length - 3;
    repeated.positions.forEach((_, index) => {
      const source = repeated.replication.sourceNodeIndices[index];
      const [a, b] = repeated.replication.sourceOffsets[index];
      for (let k = 0; k < 3; k++) pulled[3 * source + k] += result.gradient[3 * index + k];
      pulled[size] += a * result.gradient[3 * index];
      pulled[size + 1] += b * result.gradient[3 * index + 1];
      pulled[size + 2] += b * result.gradient[3 * index];
    });
    pulled[size] += m * result.gradient[targetSize];
    pulled[size + 1] += n * result.gradient[targetSize + 1];
    pulled[size + 2] += n * result.gradient[targetSize + 2];
    pulled.forEach((value, i) => close(value / (m * n), original.gradient[i], 2e-7));
  }
  results.push({ name: "A5 copied energy and pulled-back gradient; nonzero same-segment image" });

  const crossing = separateSegments([[-0.25, 0, 0], [0.25, 0, 0],
    [0, -0.25, 0.25], [0, 0.25, 0.25]]);
  const direction = new Float64Array(15); direction[8] = -0.5; direction[11] = -0.5;
  assert.ok(Number.isFinite(evaluatePeriodicContact(moved(crossing, direction, 1), params).energy));
  assert.equal(evaluatePeriodicContact(moved(crossing, direction, 0.5), params).energy, Infinity);
  const alpha = safePeriodicStep(crossing, direction, params);
  assert.ok(alpha > 0 && alpha < 0.31);
  for (let k = 0; k <= 20; k++) assert.ok(Number.isFinite(evaluatePeriodicContact(moved(crossing, direction, alpha * k / 20), params).energy));

  const movingImage = separateSegments([[-0.25, 0, 0], [0.25, 0, 0],
    [-0.2, 0.8, 0.01], [0.2, 0.8, 0.02]], 3, 1, 0);
  const latticeDirection = new Float64Array(15); latticeDirection[13] = -0.4;
  assert.ok(Number.isFinite(evaluatePeriodicContact(moved(movingImage, latticeDirection, 1), params).energy));
  assert.equal(evaluatePeriodicContact(moved(movingImage, latticeDirection, 0.5), params).energy, Infinity);
  const latticeAlpha = safePeriodicStep(movingImage, latticeDirection, params);
  assert.ok(latticeAlpha > 0 && latticeAlpha < 0.3);
  for (let k = 0; k <= 20; k++) assert.ok(Number.isFinite(evaluatePeriodicContact(moved(movingImage, latticeDirection, latticeAlpha * k / 20), params).energy));
  assert.equal(safePeriodicStep(crossing, new Float64Array(15), params), 1);
  assert.equal(safePeriodicStep(moved(crossing, direction, 0.5), direction, params), 0);
  results.push({ name: "trajectory-safe step rejects hidden crossings including moving lattice images", alpha, latticeAlpha });

  const farImage = separateSegments([[-0.1, 0, 0], [0.1, 0, 0],
    [4.9, 0.13, 0.01], [5.1, 0.14, 0.015]], 1, 2, 0);
  const far = evaluatePeriodicContact(farImage, params);
  assert.ok(far.activePairs > 0 && far.imageBounds.pMax >= 5);
  assert.ok(far.energy > 0 && Number.isFinite(far.energy));
  results.push({ name: "support-based image range covers contacts beyond +/-1" });

  const shearMotion = separateSegments([[-0.05, 0, 0], [0.05, 0, 0],
    [-0.05, 1, 0.01], [0.05, 1, 0.01]], 3, 1, 0.3);
  const shearDirection = new Float64Array(15); shearDirection[14] = -0.6;
  assert.ok(Number.isFinite(evaluatePeriodicContact(shearMotion, params).energy));
  assert.ok(Number.isFinite(evaluatePeriodicContact(moved(shearMotion, shearDirection, 1), params).energy));
  assert.equal(bruteContact(moved(shearMotion, shearDirection, 0.5), params, 2, 3).energy, Infinity);
  const shearAlpha = safePeriodicStep(shearMotion, shearDirection, params);
  assert.ok(shearAlpha > 0 && shearAlpha < 0.18);
  for (let k = 0; k <= 20; k++) {
    assert.ok(bruteContact(moved(shearMotion, shearDirection, shearAlpha * k / 20), params, 2, 3).minDistance > params.r_c);
  }
  const distantMotion = separateSegments([[-0.25, 0, 0], [0.25, 0, 0],
    [-0.2, 2.8, 0.01], [0.2, 2.8, 0.02]], 3, 1, 0);
  const distantDirection = new Float64Array(15); distantDirection[13] = -0.4 / 3;
  assert.equal(bruteContact(moved(distantMotion, distantDirection, 0.5), params, 2, 5).energy, Infinity);
  const distantAlpha = safePeriodicStep(distantMotion, distantDirection, params);
  assert.ok(distantAlpha > 0 && distantAlpha < 0.3);
  for (let k = 0; k <= 20; k++) {
    assert.ok(bruteContact(moved(distantMotion, distantDirection, distantAlpha * k / 20), params, 2, 5).minDistance > params.r_c);
  }
  results.push({ name: "pure shear and q=-3 moving-image crossings", shearAlpha, distantAlpha });
  const largeMotion = separateSegments([[0,0,0],[.1,0,0],[0,.3,0],[.1,.3,0]]);
  const largeDirection = new Float64Array(15); largeDirection[6] = 1e4;
  const boundedAlpha = safePeriodicStep(largeMotion, largeDirection, params);
  assert.ok(boundedAlpha > 0 && boundedAlpha <= params.d_e/1e4,
    "Locked lattice trials must limit physical displacement before swept-image enumeration");

  const sameYarn = separateSegments([[-0.1, 0, 0], [0.1, 0, 0],
    [-0.1, 0.13, 0.01], [0.1, 0.14, 0.015]]);
  sameYarn.topology.yarns = [{ id: 0, materialLength: 3 }];
  sameYarn.topology.edges[0].restLength = 0.125;
  Object.assign(sameYarn.topology.edges[1], { yarnId: 0, materialStart: 2.875, restLength: 0.125 });
  const nearByGeometry = evaluatePeriodicContact(sameYarn, params);
  assert.ok(nearByGeometry.activePairs > 0, "distant unfolded material must not be excluded by a modulo-shortest shortcut");
  let maxBruteEnergyError = 0;
  for (const candidate of [base, farImage, sameYarn, { ...base, S: base.S + 3 * base.W }]) {
    const measured = evaluatePeriodicContact(candidate, params);
    const brute = bruteContact(candidate, params, 16, 5);
    assert.equal(brute.energy < Infinity, measured.energy < Infinity, JSON.stringify({ S: candidate.S, brute, measured }));
    assert.equal(measured.activePairs, brute.activePairs);
    close(measured.minDistance, brute.minDistance, 1e-10);
    const error = Math.abs(measured.energy - brute.energy);
    maxBruteEnergyError = Math.max(maxBruteEnergyError, error);
    close(measured.energy, brute.energy, 2e-8);
  }
  results.push({ name: "independent ordered-pair brute force validates deduplication, shear image bounds and unfolded neighbors", maxBruteEnergyError });
  return results;
}

/** Full acceptance only: scalar straight-line reference, never builds a large solver mesh. */
export function runBarrierSubdivisionChecks() {
  const params = createFabricFormParams();
  const periodLengthMm = 3;
  const activationWidthMm = 0.1 * (params.d_e - params.r_c);
  const separationMm = params.r_c + 0.5 * activationWidthMm;
  const support = Math.sqrt((params.r_c + activationWidthMm) ** 2 - separationMm ** 2);
  const stiffness = params.K * params.E_f;
  function potential(distance) {
    const gap = distance - params.r_c;
    if (gap >= activationWidthMm) return [0, 0];
    const delta = gap - activationWidthMm, log = Math.log(gap / activationWidthMm);
    return [-(delta ** 2) * log, -2 * delta * log - delta ** 2 / gap];
  }
  // Independent continuum double-line measure after translational invariance
  // reduces it to a single integral over relative longitudinal displacement.
  const steps = 32768, step = 2 * support / steps;
  let integralEnergy = 0, integralDerivative = 0;
  for (let i = 0; i <= steps; i++) {
    const tau = -support + i * step, distance = Math.hypot(separationMm, tau);
    const [value, derivative] = potential(distance);
    const factor = i === 0 || i === steps ? 1 : i % 2 ? 4 : 2;
    integralEnergy += factor * value;
    integralDerivative += factor * derivative * separationMm / distance;
  }
  const reference = {
    energyPerLength: stiffness / params.d_e * integralEnergy * step / 3,
    normalDerivativePerLength: stiffness / params.d_e * integralDerivative * step / 3,
    principle: "Independent Simpson integral over relative arclength; limit of li*lj/d_e weights",
    steps,
  };
  const rows = [];
  for (const phaseFraction of [0, 0.25, 0.5]) {
    for (const segments of [24, 48, 96, 192, 384, 768, 1536, 3072, 6144]) {
      const h = periodLengthMm / segments;
      const limit = Math.ceil(support / h) + 2;
      let sum = 0, normalSum = 0;
      // A single source interval [0,h] sees all expanded target intervals;
      // every source interval contributes identically, giving 1/h per unit length.
      for (let j = -limit; j <= limit; j++) {
        const targetStart = (j + phaseFraction) * h;
        const longitudinalGap = Math.max(0, targetStart - h, -targetStart - h);
        const distance = Math.hypot(separationMm, longitudinalGap);
        const [value, derivative] = potential(distance);
        sum += value;
        normalSum += derivative * separationMm / distance;
      }
      const oldEnergyPerLength = stiffness * sum;
      const newEnergyPerLength = stiffness * h / params.d_e * sum;
      const oldNormalDerivativePerLength = stiffness * normalSum;
      const newNormalDerivativePerLength = stiffness * h / params.d_e * normalSum;
      rows.push({ segments, segmentLengthMm: h, phaseFraction, oldEnergyPerLength, newEnergyPerLength,
        oldNormalDerivativePerLength, newNormalDerivativePerLength,
        newEnergyReferenceRelativeError: newEnergyPerLength / reference.energyPerLength - 1,
        newDerivativeReferenceRelativeError: newNormalDerivativePerLength / reference.normalDerivativePerLength - 1 });
    }
  }
  const phases = [0, 0.25, 0.5].map(phaseFraction => {
    const values = rows.filter(row => row.phaseFraction === phaseFraction);
    const last = values.at(-1), previous = values.at(-2);
    const oldEnergyGrowth = last.oldEnergyPerLength / previous.oldEnergyPerLength;
    const oldDerivativeGrowth = last.oldNormalDerivativePerLength / previous.oldNormalDerivativePerLength;
    assert.ok(oldEnergyGrowth > 1.8 && oldDerivativeGrowth > 1.8,
      "the old length-sum weight must expose its divergent refinement counterexample");
    assert.ok(last.newEnergyReferenceRelativeError > 0 && last.newEnergyReferenceRelativeError < 0.05);
    assert.ok(last.newDerivativeReferenceRelativeError > 0 && last.newDerivativeReferenceRelativeError < 0.05);
    for (let i = values.length - 3; i < values.length; i++) {
      assert.ok(values[i].newEnergyReferenceRelativeError < values[i - 1].newEnergyReferenceRelativeError);
      assert.ok(values[i].newDerivativeReferenceRelativeError < values[i - 1].newDerivativeReferenceRelativeError);
    }
    return { phaseFraction, oldEnergyGrowth, oldDerivativeGrowth,
      lastEnergyRelativeChange: Math.abs(last.newEnergyPerLength / previous.newEnergyPerLength - 1),
      lastDerivativeRelativeChange: Math.abs(last.newNormalDerivativePerLength / previous.newNormalDerivativePerLength - 1),
      finalEnergyReferenceRelativeError: last.newEnergyReferenceRelativeError,
      finalDerivativeReferenceRelativeError: last.newDerivativeReferenceRelativeError };
  });
  return { definition: "Archived nearest-distance candidate weights, not the production integral; actual stiffness included; dE/dr is signed",
    periodLengthMm, separationMm, activationWidthMm, params, reference, rows, phases,
    conclusion: "Old length-sum weights diverge. Product weights approach a finite limit, but 6144 segments still retain finite discretization error; this does not certify production rod resolution." };
}

/** Full acceptance of the production double-line barrier, separate from old weight counterexamples. */
export async function runIntegratedBarrierChecks() {
  const { integrateSegmentBarrier } = await import("../../src/fabricForm/yarnContact.js");
  assert.equal(typeof integrateSegmentBarrier, "function", "Production barrier must integrate the double-line measure.");
  const params = createFabricFormParams(), periodLengthMm = 3;
  const width = 0.1 * (params.d_e - params.r_c), supportRadius = params.r_c + width;
  const rows = [];
  for (const gapFraction of [0.25, 0.5, 0.75]) {
    const r = params.r_c + gapFraction * width;
    const extent = Math.sqrt(supportRadius ** 2 - r ** 2), steps = 16384, step = extent / steps;
    let referenceEnergy = 0, referenceDerivative = 0;
    for (let i = 0; i <= steps; i++) {
      const distance = Math.hypot(r, i * step), gap = distance - params.r_c;
      const delta = gap - width, log = Math.log(gap / width);
      const factor = i === 0 || i === steps ? 1 : i % 2 ? 4 : 2;
      referenceEnergy += factor * (-(delta ** 2) * log);
      referenceDerivative += factor * (-2 * delta * log - delta ** 2 / gap) * r / distance;
    }
    referenceEnergy *= 2 * step / 3 * params.K * params.E_f / params.d_e;
    referenceDerivative *= 2 * step / 3 * params.K * params.E_f / params.d_e;
    for (const segments of [24, 48, 96, 192]) for (const phaseFraction of [0, 0.25, 0.5]) {
      const h = periodLengthMm / segments, limit = Math.ceil(extent / h) + 2;
      let energy = 0, derivative = 0;
      for (let j = -limit; j <= limit; j++) {
        const result = integrateSegmentBarrier([0, 0, 0], [h, 0, 0],
          [(j + phaseFraction) * h, r, 0], [(j + phaseFraction + 1) * h, r, 0], params, 12);
        energy += result.energy;
        derivative += result.gradient[2][1] + result.gradient[3][1];
      }
      energy /= h; derivative /= h;
      const energyError = energy / referenceEnergy - 1, derivativeError = derivative / referenceDerivative - 1;
      assert.ok(Math.abs(energyError) < 1e-3, `integrated barrier energy N${segments}, phase${phaseFraction}: ${energyError}`);
      assert.ok(Math.abs(derivativeError) < 1e-3, `integrated barrier normal derivative N${segments}, phase${phaseFraction}: ${derivativeError}`);
      rows.push({ segments, phaseFraction, gapFraction, energyPerLength: energy,
        normalDerivativePerLength: derivative, referenceEnergy, referenceDerivative, energyError, derivativeError });
    }
  }
  const invalid = integrateSegmentBarrier([0, 0, 0], [0.1, 0, 0],
    [0, params.r_c / 2, 0], [0.1, params.r_c / 2, 0], params);
  assert.equal(invalid.energy, Infinity);
  return { definition: "Production kappa/d_e double-line integral; fixed parallel geometry and independent Simpson reference",
    units: { energyPerLength: "N", normalDerivativePerLength: "N/mm" }, periodLengthMm, rows,
    maxEnergyError: Math.max(...rows.map(row => Math.abs(row.energyError))),
    maxDerivativeError: Math.max(...rows.map(row => Math.abs(row.derivativeError))) };
}
