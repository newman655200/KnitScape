import { createFabricFormInitialGeometry } from "./fabricFormInitialGeometry.js";
import { createDofLayout } from "./model/dofLayout.js";
import { createT1PlainJerseyModel } from "./model/t1PlainJerseyModel.js";
import { createT1Reporting } from "./model/t1Reporting.js";
import { solveFabricModel } from "./solve/solveFabricModel.js";

export const packFabricCell = cell => createDofLayout(cell).pack(cell);
export function unpackFabricCell(values, template) {
  return createDofLayout(template).unpack(values, template);
}

export function evaluateFabricCell(cell, params, quadratureOrder = 12) {
  const value = createT1PlainJerseyModel(params, { quadratureOrder }).evaluate(cell);
  return { energy: value.energy, gradient: value.gradient,
    bendingEnergy: value.details.bending.energy, contact: value.details.contact };
}

export function defaultMemorySize(nodesPerLoop) {
  return nodesPerLoop <= 32 ? 60 : nodesPerLoop <= 64 ? 180 : 384;
}

/**
 * Independent T1 entry. Material reference lengths belong to initialCell.topology.
 * An optional FabricModel declares its blocks and may provide a reporting adapter.
 * Models without one retain the default T1 result and physical diagnostic fields.
 */
export function solveFabricCell({ topology, params, initialCell, lockedDimensions, lockedLattice, model,
  quadratureOrder = 12, maxIterations = 6000, innerIterations = 800, memorySize, stagnationWindow = 3,
  gradientTolerance = 1e-6, constraintTolerance = 1e-6 }) {
  if (!topology || !params) throw new TypeError("topology and material params are required");
  if (lockedLattice !== undefined && lockedDimensions !== undefined) {
    throw new TypeError("lockedLattice and lockedDimensions cannot be combined");
  }
  let lockedComponents;
  if (lockedLattice !== undefined) {
    if (!lockedLattice || typeof lockedLattice !== "object" || Array.isArray(lockedLattice) ||
        !Object.keys(lockedLattice).length || Object.keys(lockedLattice).some(key => key !== "W" && key !== "H")) {
      throw new TypeError("lockedLattice must contain W and/or H only; S cannot be locked");
    }
    lockedComponents = ["W", "H"].filter(component => Object.hasOwn(lockedLattice, component));
    if (lockedComponents.some(component => !Number.isFinite(lockedLattice[component]) || lockedLattice[component] <= 0)) {
      throw new RangeError("Locked W/H must be positive finite mm");
    }
  }
  if (memorySize === undefined) {
    memorySize = defaultMemorySize(topology.nodesPerLoop);
  }
  if (!Number.isInteger(quadratureOrder) || quadratureOrder < 2 || quadratureOrder > 64) {
    throw new RangeError("quadratureOrder must be an integer from 2 to 64");
  }
  let initial = initialCell ?? createFabricFormInitialGeometry(topology, params);
  if (initial.topology.m !== topology.m || initial.topology.n !== topology.n ||
      initial.topology.nodesPerLoop !== topology.nodesPerLoop || initial.topology.nodeCount !== topology.nodeCount ||
      initial.topology.loopLengthMm !== topology.loopLengthMm) throw new RangeError("Initial cell and input topology disagree");
  if (lockedDimensions !== undefined) {
    if (!(lockedDimensions.W > 0 && lockedDimensions.H > 0) ||
        !Number.isFinite(lockedDimensions.W + lockedDimensions.H)) throw new RangeError("Locked W/H must be positive finite mm");
    initial = { ...initial, W: lockedDimensions.W, H: lockedDimensions.H };
  }
  if (lockedComponents) initial = { ...initial,
    ...Object.fromEntries(lockedComponents.map(component => [component, lockedLattice[component]])) };
  const start = performance.now(), scale = topology.loopLengthMm;
  model ??= createT1PlainJerseyModel(params, { quadratureOrder });
  const layout = model.createLayout(initial);
  // Remove translation. W/H are excluded from the multiplier fit when locked.
  const locked = lockedComponents ?? (lockedDimensions ? ["W", "H"] : []);
  const freeIndices = layout.freeIndices({ fixTranslation: true, locked });
  const reporting = model.reporting ?? createT1Reporting();
  const raw = solveFabricModel({ model, layout, initial, freeIndices, lockedComponents: locked,
    scale, energyScale: params.B/scale,
    settings: { maxIterations, innerIterations, memorySize, stagnationWindow, gradientTolerance, constraintTolerance },
    observer: reporting.createObserver(params),
    restoreLockedValues(cell) {
      // Partial locks retain the exact supplied mm value; W/H locks preserve the legacy round trip.
      if (lockedComponents?.length === 1) cell[lockedComponents[0]] = lockedLattice[lockedComponents[0]];
    },
  });
  const context = { initial, params, topology, layout, model, lockedComponents, lockedDimensions,
    quadratureOrder, maxIterations, innerIterations, memorySize, stagnationWindow, gradientTolerance, constraintTolerance, scale, start };
  return raw.initialEvaluation.feasible ? reporting.formatResult(raw, context) : reporting.formatInfeasible(raw, context);
}
