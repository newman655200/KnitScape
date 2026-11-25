import { createFabricFormInitialGeometry } from "./fabricFormInitialGeometry.js";
import { evaluateRodBending, evaluateLengthConstraints } from "./rodBending.js";
import { evaluatePeriodicContact, safePeriodicStep, diagnosePeriodicContact } from "./periodicContact.js";
import { minimizeConstrained, evaluateConstraintReaction } from "./constrainedOptimizer.js";
import { fabricFormMetrics } from "./fabricFormMetrics.js";
import { createDofLayout } from "./model/dofLayout.js";

export const packFabricCell = cell => createDofLayout(cell).pack(cell);
export function unpackFabricCell(values, template) {
  return createDofLayout(template).unpack(values, template);
}

export function evaluateFabricCell(cell, params, quadratureOrder = 12) {
  const bending = evaluateRodBending(cell, params.B);
  const contact = evaluatePeriodicContact(cell, params, { quadratureOrder });
  return { energy: bending.energy + contact.energy,
    gradient: Float64Array.from(bending.gradient, (value, i) => value + contact.gradient[i]),
    bendingEnergy: bending.energy, contact };
}

export function defaultMemorySize(nodesPerLoop) {
  return nodesPerLoop <= 32 ? 60 : nodesPerLoop <= 64 ? 180 : 384;
}

/** Independent T1 entry. Material reference lengths belong to initialCell.topology. */
export function solveFabricCell({ topology, params, initialCell, lockedDimensions,
  quadratureOrder = 12, maxIterations = 6000, innerIterations = 800, memorySize, stagnationWindow = 3,
  gradientTolerance = 1e-6, constraintTolerance = 1e-6 }) {
  if (!topology || !params) throw new TypeError("topology and material params are required");
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
  const start = performance.now(), scale = topology.loopLengthMm;
  const layout = createDofLayout(initial);
  const positionsBlock = layout.blocks.find(block => block.name === "positions");
  const latticeComponents = layout.blocks.find(block => block.name === "lattice").components;
  const latticeIndex = Object.fromEntries(latticeComponents.map(component => [component, layout.index("lattice", component)]));
  // Remove translation. W/H are excluded from the multiplier fit when locked.
  const freeIndices = layout.freeIndices({ fixTranslation: true, locked: lockedDimensions ? ["W", "H"] : [] });
  const toCell = x => layout.unpack(Float64Array.from(x, value => value*scale), initial);
  const initialEvaluation = evaluateFabricCell(initial, params, quadratureOrder);
  if (!initialEvaluation.contact.feasible) {
    const contact=initialEvaluation.contact,constraint=evaluateLengthConstraints(initial);
    return {status:"INFEASIBLE_INITIAL_GEOMETRY",optimizerStatus:"NOT_STARTED",
      mode:lockedDimensions?"LOCKED_DIMENSIONS":"FREE",cell:initial,params,metrics:fabricFormMetrics(initial,params),
      energy:{total:null,bending:initialEvaluation.bendingEnergy,contact:null,barrier:null,barrierFraction:null},
      constraints:{maxSegmentStrain:constraint.maxStrain,values:Array.from(constraint.values)},
      equilibrium:{passed:false,nodeRatio:null,latticeRatios:[null,null,null]},
      clearance:{feasible:false,minDistance:contact.minDistance,minGap:contact.minDistance-params.r_c,
        distanceScope:"First violating pair; not a global minimum or a proof that no feasible seed exists"},
      iterations:0,evaluations:1,history:[],trajectory:{passed:false,protection:"Optimization not started"},
      settings:{nodesPerLoop:topology.nodesPerLoop,quadratureOrder,maxIterations,innerIterations,memorySize,stagnationWindow},
      diagnostics:{elapsedMs:performance.now()-start,forcedMultiplierUpdate:0,reasons:contact.diagnostics,
        contact:{available:false,reason:"Initial geometry is infeasible; no optimized final geometry exists"},
        interpretation:"Initial geometry is infeasible; returned geometry and metrics are unoptimized"}};
  }
  let acceptedSafeBounds = 0, minimumSafeBound = 1;
  let minimumEvaluatedDistance = initialEvaluation.contact.minDistance;
  let maximumEvaluatedBarrierEnergy = initialEvaluation.contact.barrierEnergy;
  const optimized = minimizeConstrained({
    x0: Float64Array.from(layout.pack(initial), value => value/scale), freeIndices,
    energyScale: params.B/scale, maxIterations, innerIterations, maxOuterIterations: 60,
    initialPenalty: 100, memorySize, stagnationWindow,
    gradientTolerance, constraintTolerance,
    convergenceCheck: ({ x, state, reaction }) => {
      if (Math.max(...Array.from(state.values, Math.abs)) > Math.min(1e-4,constraintTolerance)) return false;
      const residual = reaction.fullResidual;
      if (Math.max(...Array.from(residual.slice(positionsBlock.offset, positionsBlock.offset + positionsBlock.length), Math.abs)) > 1e-6*state.energy) return false;
      return latticeComponents.every(component => lockedDimensions && component !== "S" ||
        Math.abs(residual[latticeIndex[component]])*x[latticeIndex[component === "H" ? "H" : "W"]] <= 1e-6*state.energy);
    },
    evaluate: x => {
      const value = evaluateFabricCell(toCell(x), params, quadratureOrder);
      minimumEvaluatedDistance = Math.min(minimumEvaluatedDistance,value.contact.minDistance);
      maximumEvaluatedBarrierEnergy = Math.max(maximumEvaluatedBarrierEnergy,value.contact.barrierEnergy);
      return { energy: value.energy, gradient: Float64Array.from(value.gradient, v => v*scale) };
    },
    constraints: x => {
      const value = evaluateLengthConstraints(toCell(x));
      return { values: value.values, jacobian: value.jacobian.map(row => Float64Array.from(row, v => v*scale)) };
    },
    safeStep: (x, direction, limit) => {
      const bound = safePeriodicStep(toCell(x), Float64Array.from(direction, v => v*scale), params, limit);
      acceptedSafeBounds++; minimumSafeBound = Math.min(minimumSafeBound, bound);
      return bound;
    },
  });
  const cell = toCell(optimized.x), evaluation = evaluateFabricCell(cell, params, quadratureOrder);
  const constraint = evaluateLengthConstraints(cell), metrics = fabricFormMetrics(cell, params);
  const reaction = evaluateConstraintReaction({ gradient: evaluation.gradient, jacobian: constraint.jacobian, freeIndices });
  const nodeResidual = Math.max(...Array.from(reaction.fullResidual.slice(positionsBlock.offset, positionsBlock.offset + positionsBlock.length), Math.abs));
  const latticeResidual = latticeComponents.map(component => reaction.fullResidual[latticeIndex[component]]);
  const nodeRatio = nodeResidual/(evaluation.energy/scale);
  const latticeRatios = latticeResidual.map((r,i) => Math.abs(r)*[cell.W,cell.H,cell.W][i]/evaluation.energy);
  const equilibriumPassed = nodeRatio <= 1e-6 && latticeRatios.every((r,i) => lockedDimensions && i < 2 || r <= 1e-6);
  const lengthPassed = constraint.maxStrain <= 1e-4 && metrics.maxLoopLengthError <= 1e-4;
  const contact = evaluation.contact;
  const trajectoryPassed = minimumEvaluatedDistance > params.r_c;
  return { status: equilibriumPassed && lengthPassed && contact.feasible && trajectoryPassed ? "CONVERGED" : "NOT_CONVERGED",
    optimizerStatus: optimized.status, mode: lockedDimensions ? "LOCKED_DIMENSIONS" : "FREE",
    cell, params, metrics, energy: { total: evaluation.energy, bending: evaluation.bendingEnergy,
      contact: contact.contactEnergy, barrier: contact.barrierEnergy, barrierFraction: contact.barrierEnergy/evaluation.energy },
    constraints: { maxSegmentStrain: constraint.maxStrain, maxLoopLengthError: metrics.maxLoopLengthError,
      values: Array.from(constraint.values), passed: lengthPassed },
    equilibrium: { passed: equilibriumPassed, nodeResidual, nodeRatio, latticeResidual, latticeRatios,
      freeResidual: Array.from(reaction.freeResidual), multipliers: Array.from(reaction.multipliers), rank: reaction.rank,
      multiplierSolveThreshold: reaction.multiplierSolveThreshold,
      multiplierSolveMethod: reaction.multiplierSolveMethod,
      multiplierConditionEstimate: reaction.multiplierConditionEstimate,
      ...(lockedDimensions ? { F_W: latticeResidual[0], F_H: latticeResidual[1] } :
        { R_W: latticeResidual[0], R_H: latticeResidual[1], R_S: latticeResidual[2] }) },
    clearance: { feasible: contact.feasible, minDistance: contact.minDistance,
      minGap: contact.minDistance-params.r_c, ratioToCompaction: contact.minDistance/params.r_c,
      ratioToSolidDiameter: contact.minDistance/params.d_s, distanceScope: contact.distanceScope,
      imageBounds: contact.imageBounds, activePairs: contact.activePairs, barrierPairs: contact.barrierPairs },
    barrier: { maxGradient: Math.max(...Array.from(contact.barrierGradient, Math.abs)),
      latticeGradient: latticeComponents.map(component => contact.barrierGradient[latticeIndex[component]]), measure: "(K*E_f/d_e) integral integral b(distance-r_c) ds dt",
      activationWidth: .1*(params.d_e-params.r_c),
      widthSensitivity: {multipliers:[.5,1,2],inactiveAtAllWidths:contact.minDistance>params.r_c+.2*(params.d_e-params.r_c),
        scope:"If inactive at all widths, energy and force remain exactly zero at this branch; no claim about other equilibria"} },
    iterations: optimized.iterations, evaluations: optimized.evaluations, history: optimized.history,
    settings: { nodesPerLoop: topology.nodesPerLoop, quadratureOrder, gradientTolerance, constraintTolerance,
      maxIterations, innerIterations, initialPenalty: 100, memorySize, stagnationWindow,
      initialMultipliers: "Free-direction least-squares physical reaction / energy scale",
      coordinateScale: scale, energyScale: params.B/scale },
    trajectory: { protection: "Swept periodic AABBs and segment-distance Lipschitz bound", acceptedSafeBounds, minimumSafeBound,
      passed: trajectoryPassed,
      minimumEvaluatedDistance, maximumEvaluatedBarrierEnergy,
      conservativeGapLowerBound:.2*(Math.min(minimumEvaluatedDistance,params.d_e)-params.r_c),
      scope:"All trial evaluations, including rejected backtracks; trajectory gap lower bound uses the 0.8 safety factor and full swept-image coverage" },
    diagnostics: { elapsedMs: performance.now()-start, forcedMultiplierUpdate: optimized.forcedMultiplierUpdate,
      contact: diagnosePeriodicContact(cell, params, { quadratureOrder }) },
  };
}
