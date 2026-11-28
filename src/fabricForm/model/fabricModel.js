import { createDofLayout, T1_DOF_BLOCKS } from "./dofLayout.js";

/**
 * @typedef {Object} ModelContext
 * @property {ReturnType<typeof createDofLayout>} layout Named DOF layout of the evaluated cell.
 *
 * @typedef {Object} EnergyTermEvaluation
 * @property {number} energy Energy in N·mm, before solver scaling.
 * @property {Float64Array} gradient Derivatives in layout order; length must equal layout.size.
 * @property {boolean} [feasible=true] Whether this term admits the evaluated cell.
 * @property {object} details Term-specific unscaled results, retained under the term id.
 *
 * @typedef {Object} EnergyTerm
 * @property {string} id Unique term name within the model.
 * @property {function(object, ModelContext): EnergyTermEvaluation} evaluate Pure cell evaluation.
 * @property {function(object, Float64Array, number, ModelContext): number} [safeStep] Maximum safe step; receives the caller's original direction object.
 * @property {function(object, ModelContext): object} [diagnose] Read-only diagnostics, independent of objective evaluation.
 *
 * @typedef {Object} ConstraintEvaluation
 * @property {Float64Array} values Dimensionless constraint residuals, in registration order.
 * @property {Float64Array[]} jacobian Rows in the same order as values, each in layout order.
 * @property {number} maxStrain Maximum absolute material strain.
 *
 * @typedef {Object} Constraint
 * @property {string} id Unique constraint name within the model.
 * @property {function(object, ModelContext): ConstraintEvaluation} evaluate Pure cell constraint evaluation.
 *
 * @typedef {Object} ModelEvaluation
 * @property {number} energy Sum of term energies in registration order.
 * @property {Float64Array} gradient Sum of term gradients in registration order.
 * @property {boolean} feasible True only when every term is feasible (omission means true).
 * @property {Object<string, object>} details Term details keyed by id.
 *
 * @typedef {Object} FabricModel
 * @property {string} id Model identifier.
 * @property {EnergyTerm[]} terms Ordered registry; append terms before solving.
 * @property {Constraint[]} constraints Ordered registry; append constraints before solving.
 * @property {function(object): ReturnType<typeof createDofLayout>} createLayout Build the model's declared layout for a cell.
 * @property {function(object): ModelEvaluation} evaluate Evaluate every registered energy term.
 * @property {function(object): ConstraintEvaluation} constraintsAt Concatenate all registered constraints.
 * @property {function(object, Float64Array, number): number} safeStep Apply each registered step bound in order.
 * @property {function(object): Object<string, object>} diagnose Collect available term diagnostics by id.
 * @property {object} [reporting] Optional result adapter with createObserver, formatInfeasible and formatResult.
 */

/**
 * Compose terms without changing their units, kernels, or arithmetic order.
 * Registries remain available so adding a term or constraint needs no solver edit.
 * Every evaluation, constraint, safety and diagnostic entry builds its context
 * with the same createLayout function. Kernels own any local vector mapping.
 * Constraint, safety and diagnostic contexts resolve layout lazily, once per call, so a
 * kernel's existing cell/parameter errors retain priority over layout validation.
 * @param {{id: string, terms: EnergyTerm[], constraints: Constraint[], blocks?: ReadonlyArray<import("./dofLayout.js").DofBlockSpec>}} registration
 * @returns {FabricModel}
 */
export function createFabricModel({ id, terms, constraints, blocks = T1_DOF_BLOCKS }) {
  const createLayout = cell => createDofLayout(cell, blocks);
  const deferredContext = cell => {
    let layout;
    return { get layout() { return layout ??= createLayout(cell); } };
  };
  return { id, terms, constraints, createLayout,
    evaluate(cell) {
      const ctx = { layout: createLayout(cell) };
      let energy = 0, gradient, feasible = true;
      const details = {};
      for (const term of terms) {
        const value = term.evaluate(cell, ctx);
        if (value.gradient.length !== ctx.layout.size) {
          throw new RangeError(`Energy term ${term.id} gradient must match layout.size`);
        }
        if (gradient === undefined) {
          // Seed from the first term: adding an initial +0 could erase a signed zero.
          energy = value.energy;
          gradient = Float64Array.from(value.gradient);
        } else {
          energy += value.energy;
          for (let i = 0; i < gradient.length; i++) gradient[i] += value.gradient[i];
        }
        if (value.feasible === false) feasible = false;
        details[term.id] = value.details;
      }
      return { energy, gradient: gradient ?? new Float64Array(ctx.layout.size), feasible, details };
    },
    constraintsAt(cell) {
      const ctx = deferredContext(cell);
      const values = constraints.map(constraint => {
        const value = constraint.evaluate(cell, ctx);
        for (const row of value.jacobian) if (row.length !== ctx.layout.size) {
          throw new RangeError(`Constraint ${constraint.id} jacobian row must match layout.size`);
        }
        return value;
      });
      if (values.length === 1) return values[0];
      return { values: Float64Array.from(values.flatMap(value => Array.from(value.values))),
        jacobian: values.flatMap(value => value.jacobian),
        maxStrain: Math.max(0, ...values.map(value => value.maxStrain)) };
    },
    safeStep(cell, direction, limit) {
      const ctx = deferredContext(cell);
      let bound = limit;
      for (const term of terms) {
        if (term.safeStep) bound = Math.min(bound, term.safeStep(cell, direction, bound, ctx));
      }
      return bound;
    },
    diagnose(cell) {
      const ctx = deferredContext(cell);
      const diagnostics = {};
      for (const term of terms) {
        if (term.diagnose) diagnostics[term.id] = term.diagnose(cell, ctx);
      }
      return diagnostics;
    },
  };
}
