import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { Matrix, SingularValueDecomposition } from "ml-matrix";

const optimizerUrl = new URL("../../src/fabricForm/constrainedOptimizer.js", import.meta.url);

export async function runOptimizerChecks() {
  assert.ok(existsSync(optimizerUrl), "T1 requires a constrained optimizer and free-direction reaction solver");
  const { minimizeConstrained, evaluateConstraintReaction } = await import(optimizerUrl);
  const circleConstraints = x => ({
    values: [x[0] ** 2 + x[1] ** 2 - 1],
    jacobian: [[2 * x[0], 2 * x[1]]],
  });
  const circle = minimizeConstrained({
    x0: [0.2, 0.9], evaluate: x => ({ energy: x[0], gradient: [1, 0] }),
    constraints: circleConstraints, constraintTolerance: 1e-8, gradientTolerance: 1e-7,
  });
  assert.equal(circle.status, "CONVERGED", JSON.stringify(circle));
  assert.ok(Math.abs(circle.x[0] + 1) < 1e-6 && Math.abs(circle.x[1]) < 1e-5);
  assert.ok(circle.constraintNorm <= 1e-8 && circle.freeResidualNorm <= 1e-7);
  assert.equal(circle.rank, 1);
  assert.ok(circle.history.length > 0);
  assert.ok(circle.history.every(row => [row.energy, row.constraint, row.innerGrad, row.physicalResidual].every(Number.isFinite)));

  const surface = minimizeConstrained({
    x0: [0.5, -0.4, -0.5], evaluate: x => ({ energy: x[2], gradient: [0, 0, 1] }),
    constraints: x => ({ values: [x.reduce((sum, v) => sum + v * v, 0) - 1, x[0] + x[1]],
      jacobian: [[2 * x[0], 2 * x[1], 2 * x[2]], [1, 1, 0]] }),
    constraintTolerance: 1e-8, gradientTolerance: 1e-7,
  });
  assert.equal(surface.status, "CONVERGED", JSON.stringify(surface));
  assert.ok(Math.abs(surface.x[2] + 1) < 1e-6 && Math.hypot(surface.x[0], surface.x[1]) < 1e-5);
  assert.equal(surface.rank, 2);

  const reaction = evaluateConstraintReaction({ gradient: [2, 3], jacobian: [[1, -1]], freeIndices: [0] });
  assert.ok(Math.abs(reaction.multipliers[0] + 2) < 1e-12);
  assert.ok(Math.abs(reaction.freeResidual[0]) < 1e-12);
  assert.ok(Math.abs(reaction.fullResidual[1] - 5) < 1e-12,
    "fixed size reaction must not be minimized together with free equilibrium");
  for (const fixture of [
    { gradient: [2, 0.4, -0.7, 1.3], jacobian: [[1, 1, 1, 0], [-1, 0, 1, 1]],
      freeIndices: [1, 2, 3], method: "CHOLESKY" },
    { gradient: [1, 2, 3], jacobian: [[1, 1, 0], [2, 2, 0]],
      freeIndices: [0, 1, 2], method: "SVD" },
    { gradient: [2, 3, 1], jacobian: [[1, 0, 0], [1, 1e-5, 0]],
      freeIndices: [0, 1, 2], method: "SVD" },
  ]) {
    const fit = evaluateConstraintReaction(fixture);
    assert.equal(fit.multiplierSolveMethod, fixture.method,
      "use the fast fit only for well-conditioned independent constraint rows");
    const reference = new SingularValueDecomposition(new Matrix(fixture.freeIndices.map(i =>
      fixture.jacobian.map(row => row[i]))), { autoTranspose: true });
    const lambda = reference.solve(Matrix.columnVector(fixture.freeIndices.map(i => -fixture.gradient[i]))).to1DArray();
    const residual = fixture.gradient.map((g, i) => g + fixture.jacobian.reduce((sum, row, j) => sum + row[i] * lambda[j], 0));
    assert.equal(fit.rank, reference.rank);
    assert.ok(fit.multipliers.every((value, i) => Math.abs(value - lambda[i]) <= 1e-10 * Math.max(1, Math.abs(lambda[i]))));
    assert.ok(fit.fullResidual.every((value, i) => Math.abs(value - residual[i]) < 1e-10),
      "true full-coordinate residual and locked-direction reactions must match the SVD fit");
  }
  const locked = size => minimizeConstrained({
    x0: [1, size], freeIndices: [0],
    evaluate: x => ({ energy: 0.5 * x[0] ** 2 + 3 * x[1], gradient: [x[0], 3] }),
    constraints: x => ({ values: [x[0] - x[1]], jacobian: [[1, -1]] }),
    constraintTolerance: 1e-10, gradientTolerance: 1e-8,
  });
  const fixed = locked(2);
  assert.equal(fixed.status, "CONVERGED", JSON.stringify(fixed));
  assert.equal(fixed.x[1], 2, "fixed coordinates must remain bitwise unchanged");
  const h = 1e-3;
  const energyDerivative = (locked(2 + h).energy - locked(2 - h).energy) / (2 * h);
  assert.ok(Math.abs(fixed.fullResidual[1] - energyDerivative) < 1e-6);

  const redundant = minimizeConstrained({
    x0: [0.2, 0.9], evaluate: x => ({ energy: x[0], gradient: [1, 0] }),
    constraints: x => { const base = circleConstraints(x); return {
      values: [base.values[0], 2 * base.values[0]],
      jacobian: [base.jacobian[0], base.jacobian[0].map(v => 2 * v)],
    }; },
    constraintTolerance: 1e-8, gradientTolerance: 1e-7,
  });
  assert.equal(redundant.status, "CONVERGED", JSON.stringify(redundant));
  assert.equal(redundant.rank, 1);
  assert.ok(Math.abs(redundant.x[0] + 1) < 1e-6);

  let safeCalls = 0;
  let maximumAcceptedLimit = 0;
  const safe = minimizeConstrained({
    x0: [2], evaluate: x => {
      assert.ok(x[0] > 0.05, "safeStep must protect every evaluated trial");
      return { energy: 5 * (x[0] - 0.2) ** 2, gradient: [10 * (x[0] - 0.2)] };
    },
    constraints: () => ({ values: [], jacobian: [] }),
    safeStep: (x, d, limit) => {
      safeCalls++;
      const step = d[0] < 0 ? Math.min(limit, 0.9 * (x[0] - 0.05) / -d[0]) : limit;
      maximumAcceptedLimit = Math.max(maximumAcceptedLimit, step);
      return step;
    },
    gradientTolerance: 1e-8,
  });
  assert.equal(safe.status, "CONVERGED", JSON.stringify(safe));
  assert.ok(Math.abs(safe.x[0] - 0.2) < 1e-8 && safeCalls > 0);
  assert.ok(maximumAcceptedLimit <= 1);

  const quartic = minimizeConstrained({ x0: [0.4],
    evaluate: x => ({ energy: (x[0] - 2) ** 4, gradient: [4 * (x[0] - 2) ** 3] }),
    constraints: () => ({ values: [], jacobian: [] }), gradientTolerance: 1e-7 });
  assert.equal(quartic.status, "CONVERGED", "feasible iterates must still tighten stationarity tolerance");
  assert.ok(quartic.freeResidualNorm <= 1e-7);

  const cancellationEnergy = x => (1 + x) * 25 - 25 * x + 25 + 0.5 * (x - 1) ** 2;
  const cancellationStart = 1.00000005;
  assert.ok(cancellationEnergy(cancellationStart) < cancellationEnergy(1),
    "fixture must exhibit a rounded energy below the exact quadratic minimum");
  const cancellation = minimizeConstrained({ x0: [cancellationStart],
    evaluate: ([x]) => ({ energy: cancellationEnergy(x), gradient: [x - 1] }),
    constraints: () => ({ values: [], jacobian: [] }), gradientTolerance: 1e-12,
    maxIterations: 20, maxOuterIterations: 12, innerIterations: 2,
  });
  assert.equal(cancellation.status, "CONVERGED", "roundoff must not block a real gradient decrease");
  assert.equal(cancellation.x[0], 1);
  assert.equal(cancellation.freeResidualNorm, 0);

  const noMovement = minimizeConstrained({ x0: [1e16],
    evaluate: ([x]) => ({ energy: x, gradient: [1] }),
    constraints: () => ({ values: [], jacobian: [] }), maxOuterIterations: 1, maxIterations: 2,
  });
  assert.equal(noMovement.evaluations, 1, "bitwise unchanged candidates must stop before objective evaluation");
  assert.notEqual(noMovement.status, "CONVERGED", "representational stagnation is not equilibrium");

  const roundedPlateau = minimizeConstrained({ x0: [0.25],
    evaluate: ([x]) => ({ energy: 1e16 + x * x, gradient: [2 * x] }),
    constraints: () => ({ values: [], jacobian: [] }), maxIterations: 2, maxOuterIterations: 1,
  });
  assert.equal(roundedPlateau.status, "CONVERGED",
    "equal rounded energies need a strictly smaller gradient, rather than oscillation across the minimum");
  assert.equal(roundedPlateau.x[0], 0);
  assert.equal(roundedPlateau.iterations, 1, "do not accept the equal-gradient reflected point on a rounded plateau");

  const earlyPhysical = minimizeConstrained({ x0: [0],
    evaluate: ([x]) => ({ energy: Math.exp(x), gradient: [Math.exp(x)] }),
    constraints: () => ({ values: [], jacobian: [] }),
    safeStep: (_x, direction, limit) => Math.min(limit, 0.01 / Math.abs(direction[0])),
    convergenceCheck: ({ x }) => x[0] <= -0.249,
    innerIterations: 1200, maxIterations: 300, maxOuterIterations: 1,
  });
  assert.equal(earlyPhysical.status, "CONVERGED");
  assert.equal(earlyPhysical.iterations, 25, "check the unchanged physical criterion inside long feasible inner solves");

  let criterionCalls = 0;
  const custom = minimizeConstrained({ x0: [1e-4],
    evaluate: x => ({ energy: 0.5 * x[0] ** 2, gradient: [x[0]] }),
    constraints: () => ({ values: [], jacobian: [] }), gradientTolerance: 1e-12,
    convergenceCheck: ({ x, state, reaction }) => {
      criterionCalls++;
      assert.equal(x.length, 1);
      assert.equal(state.energy, 0.5 * x[0] ** 2);
      return reaction.freeResidualNorm <= 2e-4;
    },
  });
  assert.equal(custom.iterations, 0, "explicit physical criterion must control termination");
  assert.equal(custom.status, "CONVERGED");
  assert.ok(criterionCalls > 0);
  const alreadyFeasible = minimizeConstrained({ x0: [0],
    evaluate: x => ({ energy: Math.exp(x[0]), gradient: [Math.exp(x[0])] }),
    constraints: () => ({ values: [1e-8], jacobian: [[0]] }),
    constraintTolerance: 1e-4, gradientTolerance: 1e-30, initialPenalty: 10,
    maxIterations: 20, maxOuterIterations: 20, innerIterations: 1,
  });
  assert.equal(alreadyFeasible.penalty, 10, "feasible constraints must not escalate penalty on a gradient plateau");
  assert.notEqual(alreadyFeasible.status, "CONVERGED");

  let tangentStepChecked = false;
  minimizeConstrained({ x0: [1, 0], maxIterations: 1,
    evaluate: x => ({ energy: x[0] + x[1], gradient: [1, 1] }),
    constraints: circleConstraints,
    safeStep: (_x, direction, limit) => {
      assert.ok(Math.abs(direction[0]) < 1e-12,
        "initial LS multipliers must remove the normal force at an already feasible circle");
      tangentStepChecked = true;
      return limit;
    },
  });
  assert.ok(tangentStepChecked);

  const scale = 1e-5;
  const scaled = minimizeConstrained({ x0: [0.2, 0.9], energyScale: scale,
    evaluate: x => ({ energy: scale * x[0], gradient: [scale, 0] }),
    constraints: circleConstraints, constraintTolerance: 1e-8, gradientTolerance: 1e-7 });
  assert.equal(scaled.status, "CONVERGED");
  assert.ok(Math.hypot(...scaled.x.map((v, i) => v - circle.x[i])) < 1e-7);
  assert.ok(Math.abs(scaled.multipliers[0] / scale - circle.multipliers[0]) < 1e-7);

  const limited = minimizeConstrained({ x0: [0.2, 0.9], maxIterations: 1,
    evaluate: x => ({ energy: x[0], gradient: [1, 0] }), constraints: circleConstraints });
  assert.notEqual(limited.status, "CONVERGED");
  const impossible = minimizeConstrained({ x0: [0], maxIterations: 10,
    evaluate: x => ({ energy: x[0] ** 2, gradient: [2 * x[0]] }),
    constraints: () => ({ values: [1], jacobian: [[0]] }) });
  assert.notEqual(impossible.status, "CONVERGED");
  assert.equal(impossible.constraintNorm, 1);
  assert.throws(() => evaluateConstraintReaction({ gradient: [1], jacobian: [[1]], freeIndices: [1] }), /invalid|indices/i);

  const blockCount = 24;
  const dimension = 75;
  const initial = Array.from({ length: dimension }, (_, i) => i < 2 * blockCount ? (i % 2 ? 0.9 : 0.2) : 0.1);
  const many = minimizeConstrained({ x0: initial,
    evaluate: x => {
      let energy = 0;
      const gradient = new Float64Array(dimension);
      for (let i = 0; i < blockCount; i++) { energy += x[2 * i]; gradient[2 * i] = 1; }
      for (let i = 2 * blockCount; i < dimension; i++) {
        energy += 0.5 * (x[i] - 0.3) ** 2;
        gradient[i] = x[i] - 0.3;
      }
      return { energy, gradient };
    },
    constraints: x => {
      const values = new Float64Array(blockCount);
      const jacobian = Array.from({ length: blockCount }, () => new Float64Array(dimension));
      for (let i = 0; i < blockCount; i++) {
        values[i] = x[2 * i] ** 2 + x[2 * i + 1] ** 2 - 1;
        jacobian[i][2 * i] = 2 * x[2 * i];
        jacobian[i][2 * i + 1] = 2 * x[2 * i + 1];
      }
      return { values, jacobian };
    },
    gradientTolerance: 1e-7, constraintTolerance: 1e-8,
  });
  assert.equal(many.status, "CONVERGED", JSON.stringify(many));
  assert.equal(many.rank, blockCount);
  assert.deepEqual(initial, Array.from({ length: dimension }, (_, i) => i < 2 * blockCount ? (i % 2 ? 0.9 : 0.2) : 0.1),
    "optimizer must not mutate the initial coordinates");
  for (let i = 0; i < blockCount; i++) assert.ok(Math.abs(many.x[2 * i] + 1) < 1e-6);
  for (let i = 2 * blockCount; i < dimension; i++) assert.ok(Math.abs(many.x[i] - 0.3) < 1e-6);

  return { name: "optimizer", status: "PASS", circleIterations: circle.iterations,
    surfaceIterations: surface.iterations, rankDeficientIterations: redundant.iterations,
    circleConstraint: circle.constraintNorm, circleResidual: circle.freeResidualNorm,
    fixedReaction: fixed.fullResidual[1], finiteDifferenceReaction: energyDerivative, safeCalls,
    cancellationIterations: cancellation.iterations, cancellationEvaluations: cancellation.evaluations,
    unchangedCandidateEvaluations: noMovement.evaluations, physicalCheckIterations: earlyPhysical.iterations,
    dimension, constraintCount: blockCount, manyIterations: many.iterations };
}
