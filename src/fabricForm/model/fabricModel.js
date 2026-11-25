import { createDofLayout } from "./dofLayout.js";

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
 * @property {function(object, Float64Array, number): number} [safeStep] Maximum safe step in physical coordinates.
 * @property {function(object): object} [diagnose] Read-only diagnostics, independent of objective evaluation.
 *
 * @typedef {Object} ConstraintEvaluation
 * @property {Float64Array} values Dimensionless constraint residuals, in registration order.
 * @property {Float64Array[]} jacobian Rows in the same order as values, each in layout order.
 * @property {number} maxStrain Maximum absolute material strain.
 *
 * @typedef {Object} Constraint
 * @property {string} id Unique constraint name within the model.
 * @property {function(object): ConstraintEvaluation} evaluate Pure cell constraint evaluation.
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
 * @property {function(object): ModelEvaluation} evaluate Evaluate every registered energy term.
 * @property {function(object): ConstraintEvaluation} constraintsAt Concatenate all registered constraints.
 * @property {function(object, Float64Array, number): number} safeStep Apply each registered step bound in order.
 * @property {function(object): Object<string, object>} diagnose Collect available term diagnostics by id.
 */

/**
 * Compose terms without changing their units, kernels, or arithmetic order.
 * Registries remain available so adding a term or constraint needs no solver edit.
 * @param {{id: string, terms: EnergyTerm[], constraints: Constraint[]}} registration
 * @returns {FabricModel}
 */
export function createFabricModel({ id, terms, constraints }) {
  return { id, terms, constraints,
    evaluate(cell) {
      const ctx = { layout: createDofLayout(cell) };
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
      const values = constraints.map(constraint => constraint.evaluate(cell));
      if (values.length === 1) return values[0];
      return { values: Float64Array.from(values.flatMap(value => Array.from(value.values))),
        jacobian: values.flatMap(value => value.jacobian),
        maxStrain: Math.max(0, ...values.map(value => value.maxStrain)) };
    },
    safeStep(cell, direction, limit) {
      let bound = limit;
      for (const term of terms) {
        if (term.safeStep) bound = Math.min(bound, term.safeStep(cell, direction, bound));
      }
      return bound;
    },
    diagnose(cell) {
      const diagnostics = {};
      for (const term of terms) {
        if (term.diagnose) diagnostics[term.id] = term.diagnose(cell);
      }
      return diagnostics;
    },
  };
}
