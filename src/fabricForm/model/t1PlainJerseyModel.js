import { evaluateRodBending, evaluateLengthConstraints } from "../rodBending.js";
import { evaluatePeriodicContact, safePeriodicStep, diagnosePeriodicContact } from "../periodicContact.js";
import { createFabricModel } from "./fabricModel.js";
import { createKernelView } from "./kernelView.js";
import { createT1Reporting } from "./t1Reporting.js";
export { T1_DOF_BLOCKS } from "./dofLayout.js";

const t1View = layout => createKernelView(layout, ["positions", "lattice"], { lattice: ["W", "H", "S"] });

/**
 * T1 model: bending, periodic contact, then segment-length equality constraints.
 * Wrappers retain the original kernel results as details for the default T1 reporting adapter.
 * @param {object} params Existing fabric material parameters, in kernel units.
 * @param {{quadratureOrder?: number}} [options] Existing contact quadrature order.
 * @returns {import("./fabricModel.js").FabricModel}
 */
export function createT1PlainJerseyModel(params, { quadratureOrder = 12 } = {}) {
  const model = createFabricModel({ id: "T1_PLAIN_JERSEY",
    terms: createT1Terms(params, { quadratureOrder }), constraints: createT1Constraints(),
  });
  model.reporting = createT1Reporting();
  return model;
}

/** Reusable ordered T1 energy terms for models with additional declared blocks.
 * Gradients are scattered to ctx.layout. details retain the original kernel
 * objects and their local [positions(3N), W, H, S] gradient/barrierGradient order.
 * Only the contact wrapper gathers the caller's global direction for its kernel.
 * Legacy numeric arrays are checked before conversion; invalid inputs delegate
 * to the original kernel so cell/parameter validation and error messages persist.
 * @param {object} params Existing material parameters, in kernel units.
 * @param {{quadratureOrder?: number}} [options] Contact quadrature order (default 12).
 * @returns {import("./fabricModel.js").EnergyTerm[]}
 */
export function createT1Terms(params, { quadratureOrder = 12 } = {}) {
  return [
    { id: "bending", evaluate(cell, { layout }) {
      const details = evaluateRodBending(cell, params.B);
      return { energy: details.energy, gradient: t1View(layout).scatter(details.gradient), details };
    } },
    { id: "contact", evaluate(cell, { layout }) {
      const details = evaluatePeriodicContact(cell, params, { quadratureOrder });
      return { energy: details.energy, gradient: t1View(layout).scatter(details.gradient), feasible: details.feasible, details };
    },
    safeStep(cell, direction, limit, ctx) {
      if (!Array.isArray(cell?.positions) || cell.positions.length === 0 || direction == null) {
        return safePeriodicStep(cell, direction, params, limit);
      }
      const { layout } = ctx;
      // A global length mismatch must also fail when its length happens to match the local kernel.
      if (direction.length !== layout.size) return safePeriodicStep(cell, [], params, limit);
      if (!Array.from(direction).every(Number.isFinite)) return safePeriodicStep(cell, direction, params, limit);
      const global = direction instanceof Float64Array ? direction : Float64Array.from(direction);
      return safePeriodicStep(cell, t1View(layout).gather(global), params, limit);
    },
    diagnose: cell => diagnosePeriodicContact(cell, params, { quadratureOrder }) },
  ];
}

/** Reusable T1 segment-length constraints, scattering each local Jacobian row.
 * Values, maxStrain and return-key order retain the kernel contract.
 * @returns {import("./fabricModel.js").Constraint[]}
 */
export function createT1Constraints() {
  return [{ id: "segmentLength", evaluate(cell, ctx) {
    const value = evaluateLengthConstraints(cell), view = t1View(ctx.layout);
    return { values: value.values, jacobian: value.jacobian.map(row => view.scatter(row)), maxStrain: value.maxStrain };
  } }];
}
