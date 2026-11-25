import { evaluateRodBending, evaluateLengthConstraints } from "../rodBending.js";
import { evaluatePeriodicContact, safePeriodicStep, diagnosePeriodicContact } from "../periodicContact.js";
import { createFabricModel } from "./fabricModel.js";

/**
 * T1 model: bending, periodic contact, then segment-length equality constraints.
 * Wrappers retain the original kernel results as details for legacy reporting.
 * @param {object} params Existing fabric material parameters, in kernel units.
 * @param {{quadratureOrder?: number}} [options] Existing contact quadrature order.
 * @returns {import("./fabricModel.js").FabricModel}
 */
export function createT1PlainJerseyModel(params, { quadratureOrder = 12 } = {}) {
  return createFabricModel({ id: "T1_PLAIN_JERSEY",
    terms: [
      { id: "bending", evaluate(cell) {
        const details = evaluateRodBending(cell, params.B);
        return { energy: details.energy, gradient: details.gradient, details };
      } },
      { id: "contact", evaluate(cell) {
        const details = evaluatePeriodicContact(cell, params, { quadratureOrder });
        return { energy: details.energy, gradient: details.gradient, feasible: details.feasible, details };
      },
      safeStep: (cell, direction, limit) => safePeriodicStep(cell, direction, params, limit),
      diagnose: cell => diagnosePeriodicContact(cell, params, { quadratureOrder }) },
    ],
    constraints: [{ id: "segmentLength", evaluate: evaluateLengthConstraints }],
  });
}
