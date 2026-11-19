// Read-only execution of current production geometry/Solver; independent integration of its result.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import * as d3 from 'd3';
const cache=new Map();
const d3m=new vm.SyntheticModule(Object.keys(d3),function(){for(const k of Object.keys(d3))this.setExport(k,d3[k]);});
async function mod(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);
  const m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{identifier:file});cache.set(file,m);
  await m.link(async(spec,ref)=>{if(spec==='d3')return d3m;let f=path.resolve(path.dirname(ref.identifier),spec);if(!fs.existsSync(f))f+='.js';return mod(f);});return m;}
const files=['src/lib/Bimp.js','src/simulation/Pattern.js','src/simulation/ProcessModel.js','src/simulation/YarnModel.js','src/simulation/yarnPathGeometry.js','src/simulation/yarnLengthSolver.js','src/domain/singleJerseyMachine.js'];
const mods=[];for(const f of files){const m=await mod(f);if(m.status==='linked')await m.evaluate();mods.push(m.namespace);}
const [{Bimp},{Pattern},{ProcessModel},{YarnModel},{buildYarnPathGeometry},{solveFeedYarnLengths},{resolveSingleJerseyOperations}]=mods;
const auditor=await import(pathToFileURL(path.resolve('reports/yarn-length-semantics-audit-2026-10-16/independent-auditor.mjs')).href);
const manifest=JSON.parse(fs.readFileSync('reports/sop-001/with-cam/project-export.manifest.json','utf8'));
for(const width of [30,32]){
  const height=40,ops=resolveSingleJerseyOperations(manifest.singleJerseyCamProgram,manifest.needleArrangement,width,height);
  const bitmap=new Bimp(width,height,ops.flat().map(op=>({K:0,M:2,T:3}[op])));
  const sp=new Pattern(bitmap.pad(1,0,0)),graph=new YarnModel(new ProcessModel(sp).cn);
  const g=buildYarnPathGeometry({pattern:bitmap,stitchPattern:sp,yarnGraph:graph,canvasWidth:640,canvasHeight:480,primaryLengthScaleY:1,primaryYarnDiameter:.24,machineGauge:32});
  const results=solveFeedYarnLengths({feeds:manifest.singleJerseyCamProgram.feeds,gauge:32,buildGeometry:g.createModelLengthEvaluator()});
  const r=results[7],points=graph.makeNice(),rows=[15,23,31];let length=0,count=0;
  for(const link of g.yarnPathLinks){if(!rows.includes(link.row))continue;const needle=Math.floor(points[link.index].i/2);if(needle<5||needle>=21)continue;
    length+=auditor.integrateGeneratedPath(r.solvedPathByLink.get(link.index)).length;count++;}
  const diagnostic=length*25.4/32*10/(16*rows.length);
  assert.equal(r.status,'CONVERGED');assert(Math.abs(diagnostic-r.solvedLengthCmPer100Needles)>.5);
  console.log(JSON.stringify({width,height,feed:8,yarn:1,target:r.targetLengthCmPer100Needles,solver:r.solvedLengthCmPer100Needles,solvedLoopHeight:r.solvedLoopHeight,status:r.status,internalRepeatDiagnostic:diagnostic,unit:'cm/100 needle passages',selectedRows:rows,sourceNeedlePadded:[5,21],linkCount:count,denominator:48,windowNeedleCount:g.windowNeedleCountByCourse.get(7),integrationNeedleCount:g.integrationNeedleCount,meaning:'Diagnostic only; not factory authority; independent integration, same generated path, different window.'}));
}
