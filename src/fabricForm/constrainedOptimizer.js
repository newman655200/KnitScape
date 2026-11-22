import { Matrix, CholeskyDecomposition, SingularValueDecomposition } from "ml-matrix";

/* L-BFGS two-loop/history adapted from numopt-js 0.6.0, lbfgsUpdate.ts:
 * https://github.com/takuto-NA/numopt-js/tree/0410894bf2d452ff2e89eee25d073520bf859104
 * MIT License
 * Copyright (c) 2024 numopt-js contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const normInf = vector => vector.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
const finiteVector = vector => (Array.isArray(vector) || ArrayBuffer.isView(vector)) && Array.from(vector).every(Number.isFinite);

function checkedFreeIndices(dimension, freeIndices) {
  const free = freeIndices === undefined ? Array.from({ length: dimension }, (_, i) => i) : Array.from(freeIndices);
  if (new Set(free).size !== free.length || free.some(i => !Number.isInteger(i) || i < 0 || i >= dimension)) {
    throw new RangeError("Invalid freeIndices: expected unique coordinate indices");
  }
  return free;
}

function checkJacobian(jacobian, dimension) {
  if (!Array.isArray(jacobian) || jacobian.some(row => !finiteVector(row) || row.length !== dimension)) {
    throw new TypeError("Invalid constraint Jacobian dimensions or entries");
  }
}

/** Minimize only free-direction residual; fixed-direction reactions remain outputs. */
export function evaluateConstraintReaction({ gradient, jacobian, freeIndices }) {
  if (!finiteVector(gradient)) throw new TypeError("Invalid finite energy gradient");
  checkJacobian(jacobian, gradient.length);
  const free = checkedFreeIndices(gradient.length, freeIndices);
  let multipliers = new Float64Array(jacobian.length);
  let rank = 0;
  let threshold = 0;
  let method = "NONE";
  let conditionEstimate = 0;
  const fitSvd = () => {
    const freeTranspose = new Matrix(free.map(index => jacobian.map(row => row[index])));
    const svd = new SingularValueDecomposition(freeTranspose, { autoTranspose: true });
    multipliers = Float64Array.from(svd.solve(Matrix.columnVector(free.map(i => -gradient[i]))).to1DArray());
    rank = svd.rank;
    threshold = svd.threshold;
    method = "SVD";
  };
  const residualFromOriginalJacobian = () => {
    const residual = Float64Array.from(gradient);
    for (let i = 0; i < jacobian.length; i++) {
      for (let j = 0; j < residual.length; j++) residual[j] += jacobian[i][j] * multipliers[i];
    }
    return residual;
  };
  if (free.length > 0 && jacobian.length > 0) {
    const count = jacobian.length;
    conditionEstimate = Infinity;
    if (count <= free.length) {
      const columns = free.map(() => []), gram = Matrix.zeros(count, count), rhs = new Float64Array(count);
      for (let row = 0; row < count; row++) for (let k = 0; k < free.length; k++) {
        const value = jacobian[row][free[k]];
        if (value !== 0) {
          columns[k].push([row, value]);
          rhs[row] -= value * gradient[free[k]];
        }
      }
      // Rod rows touch only two endpoints and their lattice coordinates.
      for (const column of columns) for (let a = 0; a < column.length; a++) for (let b = 0; b <= a; b++) {
        const [i, x] = column[a], [j, y] = column[b], value = gram.get(i, j) + x * y;
        gram.set(i, j, value); gram.set(j, i, value);
      }
      const cholesky = new CholeskyDecomposition(gram);
      if (cholesky.isPositiveDefinite()) {
        let gramNorm = 0;
        for (let i = 0; i < count; i++) {
          let sum = 0;
          for (let j = 0; j < count; j++) sum += Math.abs(gram.get(i, j));
          gramNorm = Math.max(gramNorm, sum);
        }
        // Estimate the inverse 1-norm with repeated solves; Gram is symmetric.
        let probe = Array(count).fill(1 / count), inverseNorm = 0;
        for (let iteration = 0; iteration < 5; iteration++) {
          const y = cholesky.solve(Matrix.columnVector(probe)).to1DArray();
          const estimate = y.reduce((sum, value) => sum + Math.abs(value), 0);
          if (estimate <= inverseNorm) break;
          inverseNorm = estimate;
          const z = cholesky.solve(Matrix.columnVector(y.map(value => value >= 0 ? 1 : -1))).to1DArray();
          let largest = 0;
          for (let i = 1; i < count; i++) if (Math.abs(z[i]) > Math.abs(z[largest])) largest = i;
          if (Math.abs(z[largest]) <= dot(z, probe)) break;
          probe = Array(count).fill(0); probe[largest] = 1;
        }
        conditionEstimate = gramNorm * inverseNorm;
        // Normal equations square conditioning; leave sensitive fits to SVD.
        if (Number.isFinite(conditionEstimate) && conditionEstimate <= 1e6) {
          multipliers = Float64Array.from(cholesky.solve(Matrix.columnVector(rhs)).to1DArray());
          if (finiteVector(multipliers)) { rank = count; method = "CHOLESKY"; }
        }
      }
    }
    if (method !== "CHOLESKY") fitSvd();
  }
  let fullResidual = residualFromOriginalJacobian();
  if (method === "CHOLESKY") {
    const scale = Math.max(normInf(gradient), normInf(fullResidual), Number.MIN_VALUE);
    const inaccurate = jacobian.some(row => {
      let stationarity = 0, rowNorm = 0;
      for (const i of free) { stationarity += row[i] * fullResidual[i]; rowNorm += Math.abs(row[i]); }
      return !Number.isFinite(stationarity) || Math.abs(stationarity) > 1e-10 * rowNorm * scale;
    });
    if (inaccurate) { fitSvd(); fullResidual = residualFromOriginalJacobian(); }
  }
  const freeResidual = Float64Array.from(free, index => fullResidual[index]);
  return { fullResidual, freeResidual, multipliers, rank, multiplierSolveThreshold: threshold,
    multiplierSolveMethod: method, multiplierConditionEstimate: conditionEstimate,
    freeResidualNorm: normInf(freeResidual) };
}

function lbfgsDirection(gradient, memory) {
  const q = Float64Array.from(gradient);
  const alpha = new Float64Array(memory.length);
  for (let i = memory.length - 1; i >= 0; i--) {
    alpha[i] = memory[i].rho * dot(memory[i].s, q);
    for (let j = 0; j < q.length; j++) q[j] -= alpha[i] * memory[i].y[j];
  }
  const last = memory.at(-1);
  const scale = last ? dot(last.s, last.y) / dot(last.y, last.y) : 1;
  const direction = Float64Array.from(q, value => value * scale);
  for (let i = 0; i < memory.length; i++) {
    const beta = memory[i].rho * dot(memory[i].y, direction);
    for (let j = 0; j < direction.length; j++) direction[j] += memory[i].s[j] * (alpha[i] - beta);
  }
  for (let j = 0; j < direction.length; j++) direction[j] = -direction[j];
  if (!finiteVector(direction) || !(dot(gradient, direction) < 0)) {
    memory.length = 0;
    return Float64Array.from(gradient, value => -value);
  }
  return direction;
}

function rememberStep(memory, maximum, s, y) {
  const curvature = dot(s, y);
  if (!(curvature > 1e-10 * Math.sqrt(dot(s, s) * dot(y, y))) || !Number.isFinite(1 / curvature)) {
    memory.length = 0;
    return;
  }
  memory.push({ s, y, rho: 1 / curvature });
  if (memory.length > maximum) memory.shift();
}

/** Equality AL + safeguarded L-BFGS. safeStep must cover the entire straight trial trajectory. */
export function minimizeConstrained({ x0, evaluate, constraints, safeStep = (_x, _d, limit) => limit,
  freeIndices, energyScale = 1, maxIterations = 2000, maxOuterIterations = 40,
  innerIterations = 100, initialPenalty = 10, memorySize = 10,
  constraintTolerance = 1e-4, gradientTolerance = 1e-6, convergenceCheck }) {
  if (!finiteVector(x0) || x0.length === 0 || typeof evaluate !== "function" || typeof constraints !== "function"
    || typeof safeStep !== "function") throw new TypeError("Invalid constrained optimizer inputs");
  if (convergenceCheck !== undefined && typeof convergenceCheck !== "function") {
    throw new TypeError("convergenceCheck must be a function");
  }
  for (const value of [energyScale, initialPenalty, constraintTolerance, gradientTolerance]) {
    if (!(value > 0) || !Number.isFinite(value)) throw new RangeError("Optimizer scales and tolerances must be positive finite values");
  }
  for (const value of [maxIterations, maxOuterIterations, innerIterations, memorySize]) {
    if (!Number.isInteger(value) || value < 1) throw new RangeError("Optimizer iteration limits must be positive integers");
  }
  const free = checkedFreeIndices(x0.length, freeIndices);
  let x = Float64Array.from(x0);
  let evaluations = 0;
  const readState = point => {
    evaluations++;
    const objective = evaluate(point);
    const constraint = constraints(point);
    if (!finiteVector(objective?.gradient) || objective.gradient.length !== x.length
      || !finiteVector(constraint?.values)) throw new TypeError("Invalid objective or constraint vector");
    checkJacobian(constraint.jacobian, x.length);
    if (constraint.values.length !== constraint.jacobian.length) throw new TypeError("Invalid constraint row count");
    if (!Number.isFinite(objective.energy)) throw new RangeError("Nonfinite trial energy");
    return { energy: objective.energy, gradient: Float64Array.from(objective.gradient),
      values: Float64Array.from(constraint.values), jacobian: constraint.jacobian };
  };
  let state = readState(x);
  const initialReaction = evaluateConstraintReaction({ gradient: state.gradient, jacobian: state.jacobian, freeIndices: free });
  const alMultipliers = Float64Array.from(initialReaction.multipliers, value => value / energyScale);
  let penalty = initialPenalty;
  let iterations = 0;
  let previousConstraint = Infinity;
  const history = [];
  const augmented = current => {
    let energy = current.energy / energyScale;
    const gradient = Float64Array.from(current.gradient, value => value / energyScale);
    for (let i = 0; i < current.values.length; i++) {
      const value = current.values[i];
      energy += alMultipliers[i] * value + 0.5 * penalty * value * value;
      const force = alMultipliers[i] + penalty * value;
      for (const j of free) gradient[j] += force * current.jacobian[i][j];
    }
    const projected = new Float64Array(x.length);
    for (const i of free) projected[i] = gradient[i];
    return { energy, gradient: projected };
  };
  let reaction;
  const assess = () => {
    reaction = evaluateConstraintReaction({ gradient: state.gradient, jacobian: state.jacobian, freeIndices: free });
    if (convergenceCheck) {
      // The caller owns the physical units and must check both feasibility and stationarity.
      const passed = convergenceCheck({ x, state, reaction, iterations, freeIndices: free });
      if (typeof passed !== "boolean") throw new TypeError("convergenceCheck must return a boolean");
      return passed;
    }
    return normInf(state.values) <= constraintTolerance && reaction.freeResidualNorm <= gradientTolerance * energyScale;
  };
  const finish = status => ({ x, energy: state.energy, gradient: state.gradient,
    constraintValues: state.values, constraintNorm: normInf(state.values), ...reaction,
    iterations, evaluations, status, history, penalty, energyScale, freeIndices: free });

  for (let outer = 0; outer < maxOuterIterations; outer++) {
    const memory = [];
    let current = augmented(state);
    if (assess()) {
      history.push({ outer, iterations, energy: state.energy, constraint: normInf(state.values),
        physicalResidual: reaction.freeResidualNorm, innerGrad: normInf(current.gradient), penalty, innerStatus: "CONVERGED" });
      return finish("CONVERGED");
    }
    let innerStatus = "INNER_LIMIT";
    const innerTarget = Math.max(gradientTolerance * 0.1, Math.min(0.05, 1 / penalty, 0.1 ** outer));
    for (let inner = 0; inner < innerIterations && iterations < maxIterations; inner++) {
      if (normInf(current.gradient) <= innerTarget) { innerStatus = "INNER_STATIONARY"; break; }
      iterations++;
      const direction = lbfgsDirection(current.gradient, memory);
      const slope = dot(current.gradient, direction);
      let step = safeStep(x, direction, 1);
      if (!Number.isFinite(step) || step < 0 || step > 1) throw new RangeError("safeStep must return a finite bound between zero and limit");
      if (step === 0) { innerStatus = "NO_SAFE_STEP"; break; }
      let candidate;
      let candidateState;
      let candidateAugmented;
      let accepted = false;
      for (let search = 0; search < 60 && step > 1e-16; search++) {
        candidate = Float64Array.from(x);
        for (const i of free) candidate[i] += step * direction[i];
        if (candidate.every((value, i) => value === x[i])) break;
        try {
          candidateState = readState(candidate);
          if (candidateState.values.length !== alMultipliers.length) throw new TypeError("Constraint count changed during optimization");
          candidateAugmented = augmented(candidateState);
          const energyChange = candidateAugmented.energy - current.energy;
          const roundoff = Math.max(Number.MIN_VALUE, 4 * Number.EPSILON
            * Math.max(Math.abs(current.energy), Math.abs(candidateAugmented.energy)));
          // At most eight ULPs of energy noise require a real augmented-gradient decrease.
          const sufficientDecrease = Math.abs(energyChange) <= roundoff
            ? normInf(candidateAugmented.gradient) < normInf(current.gradient)
            : candidateAugmented.energy <= current.energy + 1e-4 * step * slope;
          if (sufficientDecrease) {
            accepted = true;
            break;
          }
        } catch (error) {
          if (!(error instanceof RangeError)) throw error;
        }
        step *= 0.5;
      }
      if (!accepted) { innerStatus = "LINE_SEARCH_FAILED"; break; }
      const s = Float64Array.from(candidate, (value, i) => value - x[i]);
      const y = Float64Array.from(candidateAugmented.gradient, (value, i) => value - current.gradient[i]);
      rememberStep(memory, memorySize, s, y);
      x = candidate;
      state = candidateState;
      current = candidateAugmented;
      if (convergenceCheck && iterations % 25 === 0
        && normInf(state.values) <= constraintTolerance && assess()) {
        innerStatus = "CONVERGED";
        break;
      }
    }
    const converged = assess();
    const constraintNorm = normInf(state.values);
    history.push({ outer, iterations, energy: state.energy, constraint: constraintNorm,
      physicalResidual: reaction.freeResidualNorm, innerGrad: normInf(current.gradient), penalty, innerStatus });
    if (converged) return finish("CONVERGED");
    if (iterations >= maxIterations) return finish("MAX_ITERATIONS");
    if (innerStatus === "NO_SAFE_STEP") return finish("NO_SAFE_STEP");
    for (let i = 0; i < alMultipliers.length; i++) alMultipliers[i] += penalty * state.values[i];
    if (constraintNorm > constraintTolerance && constraintNorm > previousConstraint * 0.25) penalty *= 10;
    if (!Number.isFinite(penalty) || penalty > 1e12) return finish("PENALTY_LIMIT");
    previousConstraint = constraintNorm;
  }
  assess();
  return finish("MAX_OUTER_ITERATIONS");
}
