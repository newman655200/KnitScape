import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const rodModuleUrl = new URL("../../src/fabricForm/rodBending.js", import.meta.url);

function ringCell(count, totalLength) {
  const radius = totalLength / (2 * count * Math.sin(Math.PI / count));
  return {
    W: 3,
    H: 3,
    S: 0,
    positions: Array.from({ length: count }, (_, i) => [
      radius * Math.cos(2 * Math.PI * i / count),
      radius * Math.sin(2 * Math.PI * i / count),
      0,
    ]),
    topology: {
      edges: Array.from({ length: count }, (_, i) => ({
        from: i, to: (i + 1) % count, p: 0, q: 0,
        yarnId: "ring", order: i,
        restLength: totalLength / count, materialStart: totalLength * i / count,
      })),
      bends: Array.from({ length: count }, (_, i) => ({
        prevEdge: (i + count - 1) % count, nextEdge: i,
      })),
    },
  };
}

function periodicCell(seed) {
  let state = seed;
  const random = () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 2 ** 32);
  const positions = [[0, 0, 0], [0.6, 0.1, 0.2], [0.9, 0.6, -0.1], [0.3, 0.8, 0.3]]
    .map(point => point.map(value => value + 0.12 * (random() - 0.5)));
  const cell = { positions, W: 1.3, H: 1.1, S: 0.2 };
  cell.topology = {
    edges: positions.map((_, i) => {
      const to = (i + 1) % positions.length;
      const p = i === positions.length - 1 ? 1 : 0;
      const q = p;
      const vector = positions[to].map((value, axis) => value - positions[i][axis]);
      vector[0] += p * cell.W + q * cell.S;
      vector[1] += q * cell.H;
      return { from: i, to, p, q, yarnId: "periodic", order: i,
        restLength: Math.hypot(...vector), materialStart: i };
    }),
    bends: positions.map((_, i) => ({ prevEdge: (i + 3) % 4, nextEdge: i })),
  };
  return cell;
}

function displaced(cell, coordinate, amount) {
  const copy = structuredClone(cell);
  if (coordinate < 3 * cell.positions.length) {
    copy.positions[Math.floor(coordinate / 3)][coordinate % 3] += amount;
  } else {
    copy[["W", "H", "S"][coordinate - 3 * cell.positions.length]] += amount;
  }
  return copy;
}

function relativeVectorError(actual, expected) {
  let scale = 1e-12;
  let error = 0;
  for (let i = 0; i < actual.length; i++) {
    scale = Math.max(scale, Math.abs(actual[i]), Math.abs(expected[i]));
    error = Math.max(error, Math.abs(actual[i] - expected[i]));
  }
  return error / scale;
}

export async function runRodChecks() {
  assert.ok(existsSync(rodModuleUrl), "M2 requires the rod bending/constraint implementation");
  const { evaluateRodBending, evaluateLengthConstraints } = await import(rodModuleUrl);
  assert.equal(typeof evaluateRodBending, "function");
  assert.equal(typeof evaluateLengthConstraints, "function");
  const B = 0.017;
  const L = 3;
  const ring = ringCell(32, L);
  const before = JSON.stringify(ring);
  const ringResult = evaluateRodBending(ring, B);
  const discreteEnergy = 2 * B * 32 ** 2 * Math.tan(Math.PI / 32) ** 2 / L;
  const continuousEnergy = 2 * Math.PI ** 2 * B / L;
  assert.ok(Math.abs(ringResult.energy / discreteEnergy - 1) < 1e-12,
    "32-node ring must match its discrete analytic energy");
  const ringContinuousError = ringResult.energy / continuousEnergy - 1;
  assert.ok(Math.abs(ringContinuousError) < 0.01, "32-node ring continuous error must be below 1%");
  assert.ok(ringResult.gradient instanceof Float64Array);
  assert.equal(ringResult.gradient.length, 3 * ring.positions.length + 3);
  const ringLengths = evaluateLengthConstraints(ring);
  assert.ok(ringLengths.values instanceof Float64Array);
  assert.ok(ringLengths.jacobian.every(row => row instanceof Float64Array));
  assert.ok(ringLengths.maxStrain < 1e-14);
  assert.equal(JSON.stringify(ring), before, "rod evaluation must not mutate input");

  let maximumGradientError = 0;
  let maximumJacobianError = 0;
  for (const seed of [1, 29, 617, 104729, 987654]) {
    const cell = periodicCell(seed);
    const result = evaluateRodBending(cell, B);
    const constraints = evaluateLengthConstraints(cell);
    assert.ok(constraints.maxStrain < 1e-14);
    const dimension = result.gradient.length;
    const numericalGradient = new Float64Array(dimension);
    const numericalJacobian = constraints.jacobian.map(() => new Float64Array(dimension));
    for (let k = 0; k < dimension; k++) {
      const h = 2e-6;
      const plus = displaced(cell, k, h);
      const minus = displaced(cell, k, -h);
      numericalGradient[k] = (evaluateRodBending(plus, B).energy - evaluateRodBending(minus, B).energy) / (2 * h);
      const plusValues = evaluateLengthConstraints(plus).values;
      const minusValues = evaluateLengthConstraints(minus).values;
      for (let i = 0; i < plusValues.length; i++) {
        numericalJacobian[i][k] = (plusValues[i] - minusValues[i]) / (2 * h);
      }
    }
    maximumGradientError = Math.max(maximumGradientError, relativeVectorError(result.gradient, numericalGradient));
    for (let i = 0; i < constraints.values.length; i++) {
      maximumJacobianError = Math.max(maximumJacobianError,
        relativeVectorError(constraints.jacobian[i], numericalJacobian[i]));
    }
    assert.ok(Math.abs(result.gradient[dimension - 3]) > 1e-5, "fixture must exercise W");
    assert.ok(Math.abs(result.gradient[dimension - 2]) > 1e-5, "fixture must exercise H");
    assert.ok(Math.abs(result.gradient[dimension - 1]) > 1e-5, "fixture must exercise S");
    const zero = evaluateRodBending(cell, 0);
    assert.equal(zero.energy, 0);
    assert.ok(zero.gradient.every(value => value === 0));
    const translated = structuredClone(cell);
    translated.positions = translated.positions.map(p => [p[0] + 8, p[1] - 5, p[2] + 2]);
    assert.ok(Math.abs(evaluateRodBending(translated, B).energy / result.energy - 1) < 1e-12);
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Math.abs(cell.positions.reduce((sum, _, i) => sum + result.gradient[3 * i + axis], 0)) < 1e-12);
    }
  }
  assert.ok(maximumGradientError < 1e-5, `bending gradient error ${maximumGradientError}`);
  assert.ok(maximumJacobianError < 1e-7, `length Jacobian error ${maximumJacobianError}`);

  const malformed = (change, evaluator = evaluateRodBending) => {
    const cell = periodicCell(1);
    change(cell);
    assert.throws(() => evaluator(cell, B), /invalid|finite|positive|zero|antiparallel|connected|integer/i);
  };
  assert.throws(() => evaluateRodBending(ring, -1), /B|stiffness|positive|nonnegative/i);
  malformed(cell => { cell.positions[1][2] = NaN; });
  malformed(cell => { cell.W = 0; });
  malformed(cell => { cell.topology.edges[0].to = 99; });
  malformed(cell => { cell.topology.edges[0].p = 0.5; });
  malformed(cell => { cell.topology.bends[0].nextEdge = 99; });
  malformed(cell => { cell.topology.bends[0].nextEdge = 2; });
  malformed(cell => { cell.positions[1] = [...cell.positions[0]]; });
  malformed(cell => { cell.positions[0] = [0, 0, 0]; cell.positions[1] = [1, 0, 0]; cell.positions[2] = [0, 0, 0]; });
  malformed(cell => { cell.topology.edges[0].restLength = 0; }, evaluateLengthConstraints);
  malformed(cell => { cell.positions[1] = [...cell.positions[0]]; }, evaluateLengthConstraints);

  return { name: "rod", status: "PASS", cases: 5, ringNodes: 32,
    ringEnergy: ringResult.energy, discreteEnergy, ringContinuousError,
    maximumGradientError, maximumJacobianError };
}
