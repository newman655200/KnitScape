import { fabricFormMetrics } from "../fabricFormMetrics.js";
import { createDofLayout } from "./dofLayout.js";

/**
 * T1 result formatting and trajectory observation, with configurable registered term ids.
 * Term details keep the kernels' local [positions(3N), W, H, S] order; physical
 * constraint reactions use the model's global layout. Return keys and arithmetic
 * retain the T1 compatibility contract.
 * @param {{bendingTermId?: string, contactTermId?: string}} [ids]
 * @returns {object} createObserver(params), formatInfeasible(raw, context), formatResult(raw, context).
 *   Context carries the T1 input, layout, timing and solver settings; raw is the core result.
 */
export function createT1Reporting({ bendingTermId = "bending", contactTermId = "contact" } = {}) {
  return {
    /** Assign the initial observation directly, then include every optimizer trial. */
    createObserver(params) {
      let observed = false, minimumEvaluatedDistance, maximumEvaluatedBarrierEnergy;
      return {
        observe(evaluation) {
          const contact = evaluation.details[contactTermId];
          if (!observed) {
            minimumEvaluatedDistance = contact.minDistance;
            maximumEvaluatedBarrierEnergy = contact.barrierEnergy;
            observed = true;
          } else {
            minimumEvaluatedDistance = Math.min(minimumEvaluatedDistance,contact.minDistance);
            maximumEvaluatedBarrierEnergy = Math.max(maximumEvaluatedBarrierEnergy,contact.barrierEnergy);
          }
        },
        snapshot() {
          return { minimumEvaluatedDistance, maximumEvaluatedBarrierEnergy,
            trajectoryPassed: minimumEvaluatedDistance > params.r_c };
        },
      };
    },
    /** Preserve the initial-geometry rejection result without starting observation. */
    formatInfeasible({ initialEvaluation, constraint }, { initial, params, topology, lockedComponents, lockedDimensions,
      quadratureOrder, maxIterations, innerIterations, memorySize, stagnationWindow, start }) {
      const contact=initialEvaluation.details[contactTermId];
      return {status:"INFEASIBLE_INITIAL_GEOMETRY",optimizerStatus:"NOT_STARTED",
        mode:lockedComponents?"LOCKED_LATTICE":lockedDimensions?"LOCKED_DIMENSIONS":"FREE",
        ...(lockedComponents ? { lockedComponents } : {}),cell:initial,params,metrics:fabricFormMetrics(initial,params),
        energy:{total:null,bending:initialEvaluation.details[bendingTermId].energy,contact:null,barrier:null,barrierFraction:null},
        constraints:{maxSegmentStrain:constraint.maxStrain,values:Array.from(constraint.values)},
        equilibrium:{passed:false,nodeRatio:null,latticeRatios:[null,null,null]},
        clearance:{feasible:false,minDistance:contact.minDistance,minGap:contact.minDistance-params.r_c,
          distanceScope:"First violating pair; not a global minimum or a proof that no feasible seed exists"},
        iterations:0,evaluations:1,history:[],trajectory:{passed:false,protection:"Optimization not started"},
        settings:{nodesPerLoop:topology.nodesPerLoop,quadratureOrder,maxIterations,innerIterations,memorySize,stagnationWindow},
        diagnostics:{elapsedMs:performance.now()-start,forcedMultiplierUpdate:0,
          reasons:Object.values(initialEvaluation.details).flatMap(details => details.diagnostics ?? []),
          contact:{available:false,reason:"Initial geometry is infeasible; no optimized final geometry exists"},
          interpretation:"Initial geometry is infeasible; returned geometry and metrics are unoptimized"}};
    },
    /** Format physical reactions globally and kernel-owned gradients locally. */
    formatResult({ optimized, cell, evaluation, constraint, reaction, blockEquilibrium,
      acceptedSafeBounds, minimumSafeBound, observerState }, { params, topology, layout, model, lockedComponents, lockedDimensions,
      quadratureOrder, maxIterations, innerIterations, memorySize, stagnationWindow, gradientTolerance, constraintTolerance, scale, start }) {
      const metrics = fabricFormMetrics(cell, params);
      const positionsBlock = layout.blocks.find(block => block.name === "positions");
      const latticeComponents = layout.blocks.find(block => block.name === "lattice").components;
      const latticeIndex = Object.fromEntries(latticeComponents.map(component => [component, layout.index("lattice", component)]));
      const localLayout = createDofLayout(cell);
      const { minimumEvaluatedDistance, maximumEvaluatedBarrierEnergy, trajectoryPassed } = observerState;
      const nodeResidual = Math.max(...Array.from(reaction.fullResidual.slice(positionsBlock.offset, positionsBlock.offset + positionsBlock.length), Math.abs));
      const latticeResidual = latticeComponents.map(component => reaction.fullResidual[latticeIndex[component]]);
      const nodeRatio = nodeResidual/(evaluation.energy/scale);
      const latticeRatios = latticeResidual.map((r,i) => Math.abs(r)*[cell.W,cell.H,cell.W][i]/evaluation.energy);
      const equilibriumPassed = nodeRatio <= 1e-6 && latticeRatios.every((r,i) =>
        (lockedComponents ? lockedComponents.includes(latticeComponents[i]) : lockedDimensions && i < 2) || r <= 1e-6) && blockEquilibrium.every(block => block.name === "positions" || block.name === "lattice" || block.passed);
      const lengthPassed = constraint.maxStrain <= 1e-4 && metrics.maxLoopLengthError <= 1e-4;
      const contact = evaluation.details[contactTermId];
      return { status: equilibriumPassed && lengthPassed && evaluation.feasible && trajectoryPassed ? "CONVERGED" : "NOT_CONVERGED",
        optimizerStatus: optimized.status, mode: lockedComponents ? "LOCKED_LATTICE" : lockedDimensions ? "LOCKED_DIMENSIONS" : "FREE",
        ...(lockedComponents ? { lockedComponents } : {}),
        cell, params, metrics, energy: { total: evaluation.energy, bending: evaluation.details[bendingTermId].energy,
          contact: contact.contactEnergy, barrier: contact.barrierEnergy, barrierFraction: contact.barrierEnergy/evaluation.energy },
        constraints: { maxSegmentStrain: constraint.maxStrain, maxLoopLengthError: metrics.maxLoopLengthError,
          values: Array.from(constraint.values), passed: lengthPassed },
        equilibrium: { passed: equilibriumPassed, nodeResidual, nodeRatio, latticeResidual, latticeRatios,
          freeResidual: Array.from(reaction.freeResidual), multipliers: Array.from(reaction.multipliers), rank: reaction.rank,
          multiplierSolveThreshold: reaction.multiplierSolveThreshold,
          multiplierSolveMethod: reaction.multiplierSolveMethod,
          multiplierConditionEstimate: reaction.multiplierConditionEstimate,
          ...(lockedComponents ? Object.fromEntries(latticeComponents.map((component, i) =>
            [`${lockedComponents.includes(component) ? "F" : "R"}_${component}`, latticeResidual[i]])) :
            lockedDimensions ? { F_W: latticeResidual[0], F_H: latticeResidual[1] } :
            { R_W: latticeResidual[0], R_H: latticeResidual[1], R_S: latticeResidual[2] }) },
        clearance: { feasible: contact.feasible, minDistance: contact.minDistance,
          minGap: contact.minDistance-params.r_c, ratioToCompaction: contact.minDistance/params.r_c,
          ratioToSolidDiameter: contact.minDistance/params.d_s, distanceScope: contact.distanceScope,
          imageBounds: contact.imageBounds, activePairs: contact.activePairs, barrierPairs: contact.barrierPairs },
        barrier: { maxGradient: Math.max(...Array.from(contact.barrierGradient, Math.abs)),
          latticeGradient: latticeComponents.map(component => contact.barrierGradient[localLayout.index("lattice", component)]), measure: "(K*E_f/d_e) integral integral b(distance-r_c) ds dt",
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
          contact: model.diagnose(cell)[contactTermId] },
      };
    },
  };
}

