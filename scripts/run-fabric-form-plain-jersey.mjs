import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { createFabricFormParams } from "../src/fabricForm/fabricFormParams.js";
import { createPlainJerseyTopology } from "../src/fabricForm/fabricFormTopology.js";
import { createFabricFormInitialGeometry } from "../src/fabricForm/fabricFormInitialGeometry.js";
import { evaluatePeriodicContact } from "../src/fabricForm/periodicContact.js";
import { replicatePeriodicCell } from "../src/fabricForm/periodicCell.js";
import { solveFabricCell, evaluateFabricCell } from "../src/fabricForm/solveFabricCell.js";
import { evaluateLengthConstraints } from "../src/fabricForm/rodBending.js";
import { writeFabricFormPlots } from "./lib/fabricFormPlots.mjs";
import { checkPlainJerseyCases } from "./validate-fabric-form-plain-jersey.mjs";

const directory=process.argv[3] ?? "C:/Users/liuchen/Documents/KnitScape/archives/fabric-form-step1-2026-11-22";
const phase=process.argv[2] ?? "reference";
fs.mkdirSync(directory,{recursive:true});
const save=(name,value)=>fs.writeFileSync(path.join(directory,`${name}.json`),JSON.stringify(value,null,2));
const read=name=>JSON.parse(fs.readFileSync(path.join(directory,`${name}.json`),"utf8"));
const params=createFabricFormParams();
function run(name,input) {
  console.log(`START ${name}`);
  const result=solveFabricCell(input);
  result.diagnostics.environment={node:process.version,cpu:os.cpus()[0]?.model,platform:process.platform};
  save(name,result);writeFabricFormPlots(result,path.join(directory,`${name}.svg`));
  console.log(JSON.stringify({name,status:result.status,N:result.settings.nodesPerLoop,
    W:result.metrics.W,H:result.metrics.H,S:result.metrics.S,energy:result.energy.total,
    strain:result.constraints.maxSegmentStrain,nodeRatio:result.equilibrium.nodeRatio,
    latticeRatios:result.equilibrium.latticeRatios,seconds:result.diagnostics.elapsedMs/1000}));
  return result;
}
const withoutDiagnostics=({diagnostics,...value})=>value;
function scaleCellLength(sourceCell,length) {
  const cell=structuredClone(sourceCell),factor=length/cell.topology.loopLengthMm;
  cell.positions=cell.positions.map(p=>p.map(x=>x*factor));
  for(const k of ["W","H","S"]) cell[k]*=factor;
  cell.topology.loopLengthMm=length;
  for(const edge of cell.topology.edges){edge.restLength*=factor;edge.materialStart*=factor;}
  for(const yarn of cell.topology.yarns)yarn.materialLength*=factor;
  delete cell.refinement;
  return cell;
}
if(phase==="reference") {
  run("reference",{topology:createPlainJerseyTopology({loopLengthMm:3,nodesPerLoop:24}),params});
} else if(phase==="branches") {
  const reference=read("reference"),results=[];
  assert.equal(reference.status,"CONVERGED","M5 begins with a converged single cell");
  for(const seed of [101,202,303,404,505]) {
    let state=seed;
    const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32;};
    const topology=createPlainJerseyTopology({loopLengthMm:3,nodesPerLoop:24});
    const initialCell=createFabricFormInitialGeometry(topology,params);
    const rotations=[];
    for(let i=1;i<initialCell.positions.length-1;i++) {
      const a=initialCell.positions[i-1],b=initialCell.positions[i+1],point=initialCell.positions[i];
      const axis=b.map((v,k)=>v-a[k]),axisLength=Math.hypot(...axis);
      axis.forEach((_,k)=>axis[k]/=axisLength);
      const v=point.map((x,k)=>x-a[k]),along=v.reduce((sum,x,k)=>sum+x*axis[k],0);
      const radius=Math.hypot(...v.map((x,k)=>x-along*axis[k]));
      const contact=evaluatePeriodicContact(initialCell,params);
      const gap=Math.min(contact.minDistance,params.d_e)-params.r_c;
      const angle=(2*random()-1)*Math.min(.08,gap/(8*Math.max(radius,1e-15)));
      const cross=[axis[1]*v[2]-axis[2]*v[1],axis[2]*v[0]-axis[0]*v[2],axis[0]*v[1]-axis[1]*v[0]];
      initialCell.positions[i]=v.map((x,k)=>a[k]+x*Math.cos(angle)+cross[k]*Math.sin(angle)+axis[k]*along*(1-Math.cos(angle)));
      rotations.push({node:i,angle,displacementBound:2*radius*Math.sin(Math.abs(angle)/2),gapLowerBound:gap});
    }
    assert.ok(evaluateLengthConstraints(initialCell).maxStrain<1e-12,"Crankshaft seeds retain the same material partition");
    const feasibility=evaluatePeriodicContact(initialCell,params);
    assert.ok(feasibility.feasible,"Recorded seed must start feasible");
    const input={topology,params,initialCell};
    const result=run(`seed-${seed}`,input);
    results.push({seed,rotations,initialMinDistance:feasibility.minDistance,result:`seed-${seed}.json`,status:result.status});
    if(seed===101) {
      const repeated=run("seed-101-repeat",input);
      assert.deepEqual(withoutDiagnostics(result),withoutDiagnostics(repeated),"A10 identical full solve must be bitwise reproducible");
    }
    save("branches",{rule:"Before B: choose the lowest energy converged admissible branch; never tune material per case",seeds:results});
  }
} else if(phase==="cell-sizes") {
  const reference=read("reference");
  for(const [m,n] of [[2,2],[4,8]]) {
    const initialCell=replicatePeriodicCell(reference.cell,m,n);
    // Deliberately retain the replicated stationary branch: all variables remain free.
    run(`free-${m}x${n}`,{topology:initialCell.topology,params,initialCell});
  }
} else if(phase==="cell-size-branches") {
  const reference=read("reference");
  for(const [m,n] of [[2,2],[4,8]]) {
    const initialCell=replicatePeriodicCell(reference.cell,m,n);
    // One out-of-plane crankshaft perturbation breaks replication symmetry without changing material lengths.
    const initialGap=Math.min(evaluatePeriodicContact(initialCell,params).minDistance,params.d_e)-params.r_c;
    const i=3,a=initialCell.positions[i-1],b=initialCell.positions[i+1],v=initialCell.positions[i].map((x,k)=>x-a[k]);
    const axis=b.map((x,k)=>x-a[k]),norm=Math.hypot(...axis);axis.forEach((_,k)=>axis[k]/=norm);
    const projection=v.reduce((s,x,k)=>s+x*axis[k],0),angle=.02;
    const displacementBound=2*Math.hypot(...v.map((x,k)=>x-axis[k]*projection))*Math.sin(angle/2);
    assert.ok(2*displacementBound<initialGap,"The complete seed rotation preserves nonlocal clearance");
    const cross=[axis[1]*v[2]-axis[2]*v[1],axis[2]*v[0]-axis[0]*v[2],axis[0]*v[1]-axis[1]*v[0]];
    initialCell.positions[i]=v.map((x,k)=>a[k]+x*Math.cos(angle)+cross[k]*Math.sin(angle)+axis[k]*projection*(1-Math.cos(angle)));
    assert.ok(evaluatePeriodicContact(initialCell,params).feasible);
    assert.ok(evaluateLengthConstraints(initialCell).maxStrain<1e-6);
    const result=run(`branch-${m}x${n}`,{topology:initialCell.topology,params,initialCell,
      maxIterations:1200,innerIterations:800,memorySize:60});
    result.diagnostics.branchScope="Unrestricted free optimization after a 0.02-radian single-vertex crankshaft perturbation; 1200-iteration diagnostic budget; no symmetry constraint";
    save(`branch-${m}x${n}`,result);
  }
} else if(phase==="covariance") {
  const reference=read("reference"),scaled=structuredClone(reference.cell);
  scaled.positions=scaled.positions.map(p=>p.map(x=>2*x));
  for(const k of ["W","H","S"]) scaled[k]*=2;
  scaled.topology.loopLengthMm*=2;
  for(const edge of scaled.topology.edges){edge.restLength*=2;edge.materialStart*=2;}
  for(const yarn of scaled.topology.yarns)yarn.materialLength*=2;
  const geometry=run("scale-equilibrium",{topology:scaled.topology,initialCell:scaled,
    params:createFabricFormParams({tex:params.tex*4,fiberDiameterMm:params.fiberDiameterMm*2})});
  const stiffness=run("stiffness-equilibrium",{topology:reference.cell.topology,initialCell:reference.cell,
    params:createFabricFormParams({E_f:params.E_f*10})});
  assert.equal(geometry.status,"CONVERGED");assert.equal(stiffness.status,"CONVERGED");
  assert.ok(Math.abs(geometry.metrics.W/reference.metrics.W-2)<.01&&Math.abs(geometry.metrics.H/reference.metrics.H-2)<.01);
  assert.ok(Math.abs(geometry.energy.total/reference.energy.total-8)<8e-5);
  assert.ok(Math.abs(stiffness.metrics.W/reference.metrics.W-1)<.001&&Math.abs(stiffness.metrics.H/reference.metrics.H-1)<.001);
  assert.ok(Math.abs(stiffness.energy.total/reference.energy.total-10)<1e-4);
} else if(phase==="reactions") {
  const reference=read("reference"),cell=reference.cell;
  const input={topology:cell.topology,params,initialCell:cell,innerIterations:800,memorySize:60};
  const locked={W:cell.W*.98,H:cell.H*1.02};
  const base=run("locked",{...input,lockedDimensions:locked});
  assert.equal(base.status,"CONVERGED");
  const differences={};
  for(const coordinate of ["W","H"]) {
    const h=locked[coordinate]*1e-4;
    const high=run(`locked-${coordinate}-plus`,{...input,initialCell:base.cell,lockedDimensions:{...locked,[coordinate]:locked[coordinate]+h}});
    const low=run(`locked-${coordinate}-minus`,{...input,initialCell:base.cell,lockedDimensions:{...locked,[coordinate]:locked[coordinate]-h}});
    assert.equal(high.status,"CONVERGED");assert.equal(low.status,"CONVERGED");
    const derivative=(high.energy.total-low.energy.total)/(2*h),reaction=base.equilibrium[`F_${coordinate}`];
    differences[coordinate]={derivative,reaction,absoluteError:Math.abs(derivative-reaction),relativeError:Math.abs(derivative/reaction-1)};
    assert.ok(Math.abs(derivative-reaction)<Math.max(1e-7,Math.abs(reaction)*1e-3),"Locked reaction must match relaxed energy derivative on the same branch");
  }
  save("locked-reaction-check",differences);
} else if(phase==="fixed-checks") {
  const {runFixedGeometryAcceptance}=await import("./lib/fabricFormAcceptanceChecks.mjs");
  save("fixed-acceptance",await runFixedGeometryAcceptance(read("reference")));
} else if(phase==="cases") {
  const refinement=read("refinement-summary"),fixed=read("fixed-acceptance"),branches=read("branches");
  assert.equal(refinement.convergenceEstablished,true,"M5 rod convergence must precede M6");
  for(const key of ["A1","A5","A6","A7","A9"]) assert.ok(fixed[key].status.startsWith("PASS"));
  assert.equal(branches.seeds.length,5,"M5 requires all five initial-condition records");
  read("locked-reaction-check");read("branch-2x2");read("branch-4x8");
  const fine=refinement.levels.at(-1),productionNodes=fine.nodes===64?32:64;
  const source=read(`refinement-${productionNodes}`);
  assert.equal(source.status,"CONVERGED");
  const settings={quadratureOrder:12,innerIterations:800,memorySize:60,maxIterations:6000};
  const freeze={params,settings,nodesPerLoop:productionNodes,fineReferenceNodes:fine.nodes,
    branchRule:"Use the source-connected plain-jersey branch established by the five same-material-grid seeds; every length starts from the same normalized converged geometry",
    source:`refinement-${productionNodes}.json`,lengthsMm:[2.6,3,3.5,4]};
  save("frozen-cases",freeze);
  const results=[];
  for(const length of freeze.lengthsMm) {
    const initialCell=scaleCellLength(source.cell,length);
    const result=run(`case-${length}`,{topology:initialCell.topology,params,initialCell,...settings});
    results.push(result);
    if(result.status!=="CONVERGED") throw new Error(`M6 numerical solve failed at l=${length}; diagnose before comparing B`);
  }
  const comparison=checkPlainJerseyCases(results);save("b-comparison",comparison);
  const sopParams=createFabricFormParams({tex:8,densityGPerCm3:1/(.6/1.14+.4/1.31),
    provenance:{tex:{confidence:"INFERRED",source:"docs/ALGORITHM_DESIGN.md section 7; SOP mass-ratio inference",
      principle:"(91.2/8.8)*0.8*2.22/2.3 approximately 8 tex; source mass ratio independence unknown",
      applicableState:"Counterfactual main-yarn-only plain jersey; not the measured plated K/T SOP fabric"},
      densityGPerCm3:{source:"docs/ALGORITHM_DESIGN.md section 6; unverified component densities",
        principle:"1/(0.6/1.14+0.4/1.31), assuming mass fractions and additive volumes",confidence:"ASSUMPTION",
        applicableState:"Uncalibrated N6/wool 60/40 surrogate"},
      fiberDiameterMm:{source:"T1 reference wool assumption, reused as an unmeasured blend surrogate",
        principle:"21 micrometre uniform-fiber assumption; no component diameter measurements",confidence:"ASSUMPTION",
        applicableState:"Counterfactual uncalibrated blend model"},
      E_f:{source:"T1 reference wool assumption, reused as an unmeasured blend surrogate",
        principle:"3000 N/mm^2 uniform-fiber assumption; no component modulus measurements",confidence:"ASSUMPTION",
        applicableState:"Counterfactual uncalibrated blend model"}}});
  const sopCell=scaleCellLength(source.cell,2.3);
  sopCell.topology.lengthSource="docs/YARN_LENGTH_CONTRACT.md; production confirmation 2026-10-20, 23 cm/100 needles";
  sopCell.topology.lengthConfidence="MEASURED_INPUT_FOR_COUNTERFACTUAL";
  run("sop-reference",{topology:sopCell.topology,params:sopParams,initialCell:sopCell,...settings});
  console.log(`B ${comparison.status}; provisional empirical comparison only. Stop after T1.`);
} else if(phase==="reproducibility") {
  const freeze=read("frozen-cases"),source=read(`refinement-${freeze.nodesPerLoop}`),original=read("case-2.6");
  const initialCell=scaleCellLength(source.cell,2.6);
  const repeated=run("case-2.6-repeat",{topology:initialCell.topology,params:freeze.params,initialCell,...freeze.settings});
  assert.deepEqual(withoutDiagnostics(original),withoutDiagnostics(repeated),"A10 final-version complete solve is bitwise reproducible");
  save("reproducibility",{status:"PASS",inputCase:"case-2.6",repeatedCase:"case-2.6-repeat",excludedField:"diagnostics",
    iterations:repeated.iterations,solverStatus:repeated.status});
} else if(phase==="case-integrals") {
  const rows=[];
  for(const name of ["case-2.6","case-3","case-3.5","case-4","sop-reference"]) {
    const result=read(name),coarse=evaluateFabricCell(result.cell,result.params,12),fine=evaluateFabricCell(result.cell,result.params,24);
    const gradientAbsolute=Math.max(...Array.from(coarse.gradient,(x,i)=>Math.abs(x-fine.gradient[i])));
    const gradientRelative=gradientAbsolute/Math.max(1e-14,...Array.from(fine.gradient,Math.abs));
    const energyRelative=Math.abs(coarse.energy/fine.energy-1);
    const contactRelative=Math.abs(coarse.contact.contactEnergy/fine.contact.contactEnergy-1);
    assert.ok(energyRelative<1e-6&&contactRelative<1e-3&&gradientRelative<1e-5,"Actual case quadrature must remain stable");
    rows.push({name,energyRelative,contactRelative,gradientAbsolute,gradientRelative,
      barrierFraction:result.energy.barrierFraction,barrierMaxGradient:result.barrier.maxGradient,
      widthSensitivity:result.barrier.widthSensitivity});
  }
  save("case-integrals",{status:"PASS",coarseOrder:12,fineOrder:24,rows});
} else if(phase==="report") {
  const {writeT1Report}=await import("./lib/fabricFormReport.mjs");
  console.log(writeT1Report(directory));
} else {
  throw new Error("Use reference, branches, cell-sizes, cell-size-branches, covariance, reactions, fixed-checks, cases, case-integrals, reproducibility or report. M6 is gated by numerical acceptance.");
}
