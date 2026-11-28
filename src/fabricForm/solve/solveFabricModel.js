import { minimizeConstrained, evaluateConstraintReaction } from "../constrainedOptimizer.js";

/**
 * Solve a registered model in its declared block order, returning unformatted data.
 * Length blocks use scale; dimensionless blocks use 1. Every block participates
 * in optimizer convergence and exposes its final equilibrium result to reporting.
 * @param {object} input
 * @param {object} input.model Evaluation, constraint and step-bound callbacks.
 * @param {object} input.layout Named blocks, packing and unpacking.
 * @param {object} input.initial Initial physical cell.
 * @param {number[]} input.freeIndices Ascending free global indices.
 * @param {string[]} input.lockedComponents Same component list used to select free indices.
 * @param {number} input.scale Physical length per solver length coordinate.
 * @param {number} input.energyScale Optimizer energy normalization.
 * @param {object} input.settings Iteration, memory, stagnation and tolerance settings.
 * @param {{observe: function(object): void, snapshot: function(): object}} input.observer
 *   Observes the feasible initial evaluation and every optimizer evaluation, never the final reevaluation.
 * @param {function(object): void} input.restoreLockedValues Entry-specific exact-value writeback after unpacking.
 * @returns {object} Initial evaluation and constraints if infeasible; otherwise optimizer output,
 *   final cell, evaluation, constraints, physical reaction, block equilibrium, safety counts and observer state.
 */
export function solveFabricModel({ model, layout, initial, freeIndices, lockedComponents,
  scale, energyScale, settings, observer, restoreLockedValues }) {
  const scales = new Float64Array(layout.size);
  for (const block of layout.blocks) scales.fill(block.scaleKind === "length" ? scale : 1,
    block.offset, block.offset + block.length);
  const toCell = x => {
    const cell = layout.unpack(Float64Array.from(x, (value, i) => value*scales[i]), initial);
    restoreLockedValues(cell);
    return cell;
  };
  const blockPassed = (block, x, residual, energy) => {
    if (block.equilibrium.kind === "maxAbs") {
      if (Math.max(...Array.from(residual.slice(block.offset, block.offset + block.length), Math.abs)) > 1e-6*energy) return false;
      return true;
    }
    return block.components.every(component => lockedComponents.includes(component) ||
      Math.abs(residual[layout.index(block.name, component)])*x[layout.index(block.name, block.equilibrium.conjugates[component])] <= 1e-6*energy);
  };
  const initialEvaluation = model.evaluate(initial);
  if (!initialEvaluation.feasible) return { initialEvaluation, constraint: model.constraintsAt(initial) };
  let acceptedSafeBounds = 0, minimumSafeBound = 1;
  observer.observe(initialEvaluation);
  const { maxIterations, innerIterations, memorySize, stagnationWindow, gradientTolerance, constraintTolerance } = settings;
  const optimized = minimizeConstrained({
    x0: Float64Array.from(layout.pack(initial), (value, i) => value/scales[i]), freeIndices,
    energyScale, maxIterations, innerIterations, maxOuterIterations: 60,
    initialPenalty: 100, memorySize, stagnationWindow,
    gradientTolerance, constraintTolerance,
    convergenceCheck: ({ x, state, reaction }) => {
      if (Math.max(...Array.from(state.values, Math.abs)) > Math.min(1e-4,constraintTolerance)) return false;
      return layout.blocks.every(block => blockPassed(block, x, reaction.fullResidual, state.energy));
    },
    evaluate: x => {
      const value = model.evaluate(toCell(x));
      observer.observe(value);
      return { energy: value.feasible ? value.energy : Infinity,
        gradient: Float64Array.from(value.gradient, (v, i) => v*scales[i]) };
    },
    constraints: x => {
      const value = model.constraintsAt(toCell(x));
      return { values: value.values, jacobian: value.jacobian.map(row => Float64Array.from(row, (v, i) => v*scales[i])) };
    },
    safeStep: (x, direction, limit) => {
      const bound = model.safeStep(toCell(x), Float64Array.from(direction, (v, i) => v*scales[i]), limit);
      acceptedSafeBounds++; minimumSafeBound = Math.min(minimumSafeBound, bound);
      return bound;
    },
  });
  const cell = toCell(optimized.x), evaluation = model.evaluate(cell);
  const constraint = model.constraintsAt(cell);
  const reaction = evaluateConstraintReaction({ gradient: evaluation.gradient, jacobian: constraint.jacobian, freeIndices });
  const coordinates = Float64Array.from(layout.pack(cell), (value, i) => value/scales[i]);
  const residual = Float64Array.from(reaction.fullResidual, (value, i) => value*scales[i]);
  const blockEquilibrium = layout.blocks.map(block => ({ name: block.name,
    passed: blockPassed(block, coordinates, residual, evaluation.energy) }));
  return { initialEvaluation, optimized, cell, evaluation, constraint, reaction, blockEquilibrium,
    acceptedSafeBounds, minimumSafeBound, observerState: observer.snapshot() };
}
