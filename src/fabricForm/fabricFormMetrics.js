import { actualEdgeVector } from "./periodicCell.js";

/** Derived quantities keep their material/input dependencies, including assumptions. */
export function fabricFormMetrics(cell, params) {
  const {m,n,loopLengthMm:l}=cell.topology;
  const waleDensityPerCm=10*m/cell.W,courseDensityPerCm=10*n/cell.H;
  const targetLength=m*n*l;
  const actualLength=cell.topology.edges.reduce((sum,edge)=>sum+Math.hypot(...actualEdgeVector(cell,edge)),0);
  const loopLengthErrors=cell.topology.loops.map(loop=>{
    const length=loop.edgeIndices.reduce((sum,i)=>sum+Math.hypot(...actualEdgeVector(cell,cell.topology.edges[i])),0);
    return length/l-1;
  });
  const z=cell.positions.map(p=>p[2]);
  return {
    W:cell.W,H:cell.H,S:cell.S,
    waleDensityPerCm,courseDensityPerCm,
    averageNeedlePitchMm:cell.W/m,averageFeedPitchMm:cell.H/n,
    kw:waleDensityPerCm*l/10,kc:courseDensityPerCm*l/10,
    ks:waleDensityPerCm*courseDensityPerCm*l*l/100,
    kcOverKw:courseDensityPerCm/waleDensityPerCm,TF:Math.sqrt(params.tex)/l,
    gsm:targetLength*params.tex/(cell.W*cell.H),
    gsmFromDensities:waleDensityPerCm*courseDensityPerCm*l*params.tex/100,
    actualLengthMm:actualLength,targetLengthMm:targetLength,
    relativeLengthError:actualLength/targetLength-1,
    maxLoopLengthError:Math.max(...loopLengthErrors.map(Math.abs)),
    envelopeThicknessEstimateMm:Math.max(...z)-Math.min(...z)+params.d_e,
    provenance:{mode:"PREDICTED_WITH_INPUT_DEPENDENCIES",parameters:params.provenance,
      length:{value:l,unit:"mm/needle/feed",source:cell.topology.lengthSource??"T1 numerical reference case",
        principle:"Prescribed material length; not fitted to density",confidence:cell.topology.lengthConfidence??"ASSUMPTION",
        applicableState:"Given frictionless model; no physical relaxed-state equivalence asserted"},
      thickness:"z span + d_e assumes a uniform undeformed circular envelope; not pressure-measured thickness",
      gsm:"Material mass / predicted area; dependent on both density outputs, not a third shape observation"},
  };
}
