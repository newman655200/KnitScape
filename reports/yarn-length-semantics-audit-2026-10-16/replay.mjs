import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {auditFinalYarnLength,integrateGeneratedPath} from './independent-auditor.mjs';
const out=new URL('./',import.meta.url),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'});
const protectedNames=git('ls-files','-z','--cached','--others','--exclude-standard','src','scripts','package.json','package-lock.json','AGENTS.md','NEXT_TASK.md','KnitScape_当前功能与算法.md').split('\0').filter(Boolean);
const protectedHashes=Object.fromEntries(await Promise.all(protectedNames.map(async n=>[n,sha(await fs.readFile(n))])));
const initial={head:git('rev-parse','HEAD').trim(),branch:git('branch','--show-current').trim(),status:git('status','--short'),protectedHashes};
await fs.writeFile(new URL('initial-state.json',out),JSON.stringify(initial,null,2));
await fs.writeFile(new URL('baseline-working-tree.diff',out),git('diff','--no-ext-diff','7ababf264d495f6b96d4d66652c529424938ac4d'));
globalThis.devicePixelRatio=1;globalThis.Path2D=class{};globalThis.window={location:{search:''}};
globalThis.__semantics={draw:null,geometries:[],solverCalls:[],periods:[]};const obs=globalThis.__semantics;
const server=await createServer({configFile:false,appType:'custom',logLevel:'silent',optimizeDeps:{disabled:true},server:{middlewareMode:true},plugins:[{
  name:'read-only-semantics-observers',enforce:'pre',transform(source,id){const p=id.replaceAll('\\','/');
    if(p.endsWith('/src/simulation/drawYarnSimulation.js'))return 'export function drawYarnSimulation(args) { globalThis.__semantics.draw=args; }';
    if(p.endsWith('/src/simulation/yarnPathGeometry.js'))return source
      .replace('return { bitmap, period };','globalThis.__semantics.periods.push({width:pattern.width,height:pattern.height,period}); return { bitmap, period };')
      .replace('export function buildYarnPathGeometry(','function originalBuild(')+
      '\nexport function buildYarnPathGeometry(args) { const g=originalBuild(args); globalThis.__semantics.geometries.push({args,g}); return g; }';
    if(p.endsWith('/src/simulation/yarnLengthSolver.js'))return source.replace('export function solveFeedYarnLengths(','function originalSolve(')+
      '\nexport function solveFeedYarnLengths(args) { const result=originalSolve(args); globalThis.__semantics.solverCalls.push({args,result}); return result; }';
  }}]});
const canvas={style:{}};globalThis.document={createTreeWalker:()=>({}),getElementById:id=>['back','mid','front'].includes(id)?canvas:{getBoundingClientRect:()=>({width:900,height:900})}};
try {
  const [{readProjectPackage},{createSingleJerseyExecutionInput},{simulate},{Bimp},{Pattern},{ProcessModel},{YarnModel},{buildYarnPathGeometry}] = await Promise.all([
    '/src/actions/projectPackage.js','/src/components/singleJerseyExecutionInput.js','/src/simulation/yarnSimulation.js','/src/lib/Bimp.js',
    '/src/simulation/Pattern.js','/src/simulation/ProcessModel.js','/src/simulation/YarnModel.js','/src/simulation/yarnPathGeometry.js'].map(p=>server.ssrLoadModule(p)));
  const source='reports/sop-001/SOP-001-N6W6040-main-yarn-with-cam.knitscape';
  const p=(await readProjectPackage(new Blob([await fs.readFile(source)]))).project;
  const sourceSnapshot={file:source,sha256:sha(await fs.readFile(source)),width:p.width,height:p.height,gauge:p.machineGauge,cam:p.singleJerseyCamProgram,arrangement:p.needleArrangement,
    yarnLibrary:p.yarnLibrary.map(({id,name,diameter})=>({id,name,diameter})),yarnPlies:p.yarnPlies.map(({diameter,enabled,lengthScaleY})=>({diameter,enabled,lengthScaleY}))};
  await fs.writeFile(new URL('source-project.json',out),JSON.stringify(sourceSnapshot,null,2));
  const sourceId=p.singleJerseyCamProgram.feeds[0].yarns[0].yarnId;
  const cases={},geometries={};
  function metadata(g,args,repeatPeriod=4) {
    const points=args.yarnGraph.makeNice();
    return g.yarnPathLinks.map(l=>{
      const sourceNeedle=Math.floor(points[l.index].i/2)-1,targetNeedle=Math.floor(points[l.index+1].i/2)-1;
      return {index:l.index,row:l.row,sourceNeedle,targetNeedle,linkType:l.linkType,
        crossesRepeatBoundary:Math.floor(sourceNeedle/repeatPeriod)!==Math.floor(targetNeedle/repeatPeriod)};
    });
  }
  const hashPaths=paths=>sha(JSON.stringify(paths));
  async function run(name,lengths,width=p.width,height=p.height) {
    obs.geometries=[];obs.solverCalls=[];obs.periods=[];
    const project=structuredClone(p);project.width=width;project.height=height;
    project.yarnLibrary.push({id:'semantics-second',name:'20D LOW diagnostic fixture',category:'OTHER'});
    project.singleJerseyCamProgram.feeds.forEach(f=>f.yarns=lengths.map((target,i)=>({yarnId:(i===0&&name!=='B')?sourceId:'semantics-second',
      yarnLengthCmPer100Needles:target,tensionCN:null,placement:'parallel'})));
    const input=createSingleJerseyExecutionInput(project.singleJerseyCamProgram,project.needleArrangement,width,height);
    const result=simulate(input,Bimp.fromJSON(project.yarnSequence),project.yarnPalette,1,project.yarnPlies,{machineGauge:p.machineGauge,texturePerformanceMode:'solid',
      feeds:project.singleJerseyCamProgram.feeds,yarnLibrary:project.yarnLibrary});
    const draw=obs.draw,base=obs.geometries.find(x=>!x.args.measurementWindow);
    const geometry={coordinateKind:'Final generated display centerline before renderer parallel placement; no tube edges',coordinateScale:draw.stitchWidth,
      width,height,gauge:p.machineGauge,feedCount:8,links:metadata(base.g,base.args),strands:draw.yarnStrands.map(s=>({paths:[...s.resolvedPathByLink],modelPaths:[...s.modelPathByLink]}))};
    const evaluations=[];
    for(let yarnIndex=0;yarnIndex<lengths.length;yarnIndex++)for(let feedIndex=0;feedIndex<8;feedIndex++) {
      const r=result.yarnLengthSolverResults.find(r=>r.feedIndex===feedIndex&&r.yarnIndex===yarnIndex);
      const common={geometry,feedIndex,yarnIndex};
      const interior=auditFinalYarnLength(common);
      const sameWindowAllRows=auditFinalYarnLength({...common,firstRow:0,lastRowExclusive:height});
      const effectiveFinite=auditFinalYarnLength({...common,firstNeedle:0,needleCount:width,firstRow:0,lastRowExclusive:height});
      const visibleAll=auditFinalYarnLength({...common,firstRow:0,lastRowExclusive:height,allVisible:true});
      const perRows=sameWindowAllRows.perCourse;
      const {solvedPathByLink,...solver}=r;
      const modelPaths=geometry.strands[yarnIndex].modelPaths.filter(([i])=>geometry.links[i]?.row%8===feedIndex);
      const inputGeometry={...geometry,coordinateKind:'Final generated model centerline before display translation/parallel placement',coordinateScale:1,
        strands:geometry.strands.map(s=>({paths:s.modelPaths}))};
      const modelCheck=auditFinalYarnLength({...common,geometry:inputGeometry});
      const modelDisplayDeltaCm=Math.abs(modelCheck.normalizedCmPer100Needles-interior.normalizedCmPer100Needles);
      assert(modelDisplayDeltaCm<0.00005,`model/display rounding difference ${modelDisplayDeltaCm}`);
      const productionMeasurement=obs.solverCalls.find(c=>c.result.some(x=>x.targetLengthCmPer100Needles===lengths[yarnIndex]&&
        [...x.solvedPathByLink.keys()].some(i=>geometry.links[i]?.row%8===feedIndex)));
      const productionRows=productionMeasurement?[...productionMeasurement.args.buildGeometry(r.solvedLoopHeight).measuredModelLengthPer100NeedlesByCourse]
        .map(([row,length])=>({row,modelLengthPer100:length,cmPer100:length*25.4/p.machineGauge/10})):[];
      evaluations.push({feedIndex,yarnIndex,target:lengths[yarnIndex],solver,geometryPathHash:hashPaths(modelPaths),interior,sameWindowAllRows,effectiveFinite,visibleAll,
        solverMinusInterior:solver.solvedLengthCmPer100Needles-interior.normalizedCmPer100Needles,
        interiorMinusTarget:interior.normalizedCmPer100Needles-lengths[yarnIndex],productionRows,modelDisplayDeltaCm,
        topVsInterior:perRows.filter(x=>x.row>=height-8).map(x=>({topRow:x.row,cm:x.normalizedCmPer100Needles}))});
    }
    cases[name]={lengths,width,height,previewValidity:result.previewValidity,assignment:project.singleJerseyCamProgram.feeds,
      detectedPeriods:obs.periods.slice(0,lengths.length),evaluations};geometries[name]=geometry;
    await fs.writeFile(new URL('geometry-'+name+'.json.gz',out),gzipSync(JSON.stringify(geometry)));
    result.stopSim();console.log(name,result.previewValidity,evaluations.filter(e=>e.yarnIndex===lengths.length-1).map(e=>
      `${e.feedIndex+1}:${e.solver.status}:${e.solver.solvedLengthCmPer100Needles.toFixed(6)}/${e.interior.normalizedCmPer100Needles.toFixed(6)}`).join(' '));
  }
  for(const [name,lengths] of [['A',[23]],['B',[8]],['C',[23,8]],['D',[23,23]],['E',[23,15]],['F',[23,10]],['G',[23,8]]])await run(name,lengths);
  await run('CONTROL32',[23],32,40);
  await run('CONTROL48',[23],32,48);
  // Generate constant-h candidates independently of Solver; current material/Cam unchanged.
  const rangeHeights=[.000001,.001,.01,.025,.05,.1,.6,2],ranges=[];
  for(const height of rangeHeights) {
    const pattern=createSingleJerseyExecutionInput(p.singleJerseyCamProgram,p.needleArrangement,p.width,p.height),stitchPattern=new Pattern(pattern.pad(1,0,0));
    const args={pattern,stitchPattern,yarnGraph:new YarnModel(new ProcessModel(stitchPattern).cn),canvasWidth:900,canvasHeight:900,
      primaryLengthScaleY:1,primaryYarnDiameter:p.yarnPlies[0].diameter,machineGauge:p.machineGauge,modelLoopHeight:height};
    const g=buildYarnPathGeometry(args),geometry={width:p.width,height:p.height,gauge:p.machineGauge,feedCount:8,coordinateScale:1,
      coordinateKind:'Constant-h generated model path, range probe only; no Solver or business-range change',links:metadata(g,args),strands:[{paths:[...g.modelPathByLink]}]};
    const rows=Array.from({length:8},(_,feedIndex)=>({feedIndex,interior:auditFinalYarnLength({geometry,feedIndex,yarnIndex:0}),
      allRows:auditFinalYarnLength({geometry,feedIndex,yarnIndex:0,firstRow:0,lastRowExclusive:p.height}),
      productionMean:[...g.measuredModelLengthPer100NeedlesByCourse].filter(([r])=>r%8===feedIndex).reduce((s,[,x])=>s+x,0)/5*25.4/p.machineGauge/10}));
    ranges.push({loopHeight:height,rows});
  }
  const control=cases.CONTROL32.evaluations.find(e=>e.feedIndex===7),h=control.solver.solvedLoopHeight;
  const pattern=createSingleJerseyExecutionInput(p.singleJerseyCamProgram,p.needleArrangement,108,40),stitchPattern=new Pattern(pattern.pad(1,0,0));
  const args={pattern,stitchPattern,yarnGraph:new YarnModel(new ProcessModel(stitchPattern).cn),canvasWidth:900,canvasHeight:900,primaryLengthScaleY:1,
    primaryYarnDiameter:p.yarnPlies[0].diameter,machineGauge:p.machineGauge,modelLoopHeight:h};
  const g=buildYarnPathGeometry(args),hundredGeometry={width:108,height:40,gauge:32,feedCount:8,coordinateScale:1,coordinateKind:'Generated same-h centerline over 108 machine needles',
    links:metadata(g,args),strands:[{paths:[...g.modelPathByLink]}]};
  const hundredNeedles=auditFinalYarnLength({geometry:hundredGeometry,feedIndex:7,yarnIndex:0,firstNeedle:4,needleCount:100,firstRow:23,lastRowExclusive:24});
  assert(Math.abs(hundredNeedles.normalizedCmPer100Needles-23.701615588574)<1e-7);
  const sourcePattern=createSingleJerseyExecutionInput(p.singleJerseyCamProgram,p.needleArrangement,p.width,p.height);
  const periodicSolverChecks=[];
  for(const [label,height]of [['MIN',.05],['MAX',2],['A_FEED8',cases.A.evaluations.find(e=>e.feedIndex===7).solver.solvedLoopHeight],
    ['E_FEED8',cases.E.evaluations.find(e=>e.feedIndex===7&&e.yarnIndex===1).solver.solvedLoopHeight]]) {
    const bitmap=Bimp.fromTile(p.width*3,p.height,sourcePattern),stitches=new Pattern(bitmap.pad(1,0,0));
    const args={pattern:bitmap,stitchPattern:stitches,yarnGraph:new YarnModel(new ProcessModel(stitches).cn),canvasWidth:900,canvasHeight:900,
      primaryLengthScaleY:1,primaryYarnDiameter:p.yarnPlies[0].diameter,machineGauge:p.machineGauge,modelLoopHeight:height};
    const g=buildYarnPathGeometry(args),geometry={width:bitmap.width,height:p.height,gauge:p.machineGauge,feedCount:8,coordinateScale:1,
      coordinateKind:'Independent integration of generated triple-copy 30-needle Solver-context centerlines',links:metadata(g,args,p.width),strands:[{paths:[...g.modelPathByLink]}]};
    const feeds=Array.from({length:8},(_,feedIndex)=>auditFinalYarnLength({geometry,feedIndex,yarnIndex:0,firstNeedle:p.width,needleCount:p.width,firstRow:0,lastRowExclusive:p.height}));
    periodicSolverChecks.push({label,loopHeight:height,feeds});
    if(label==='A_FEED8')assert(Math.abs(feeds[7].normalizedCmPer100Needles-cases.A.evaluations.find(e=>e.feedIndex===7).solver.solvedLengthCmPer100Needles)<1e-7);
    if(label==='MIN'||label==='MAX')feeds.forEach((f,i)=>assert(Math.abs(f.normalizedCmPer100Needles-cases.C.evaluations.find(e=>e.feedIndex===i&&e.yarnIndex===1).solver.reachableRange[label==='MIN'?'minLengthCmPer100Needles':'maxLengthCmPer100Needles'])<1e-7));
  }
  const sourceH=cases.A.evaluations.find(e=>e.feedIndex===7).solver.solvedLoopHeight;
  const sourceArgs={...args,yarnGraph:new YarnModel(new ProcessModel(stitchPattern).cn),modelLoopHeight:sourceH};
  const sourceHundred=buildYarnPathGeometry(sourceArgs);
  const hundredNeedlesSource30=auditFinalYarnLength({geometry:{...hundredGeometry,links:metadata(sourceHundred,sourceArgs),strands:[{paths:[...sourceHundred.modelPathByLink]}]},
    feedIndex:7,yarnIndex:0,firstNeedle:4,needleCount:100,firstRow:23,lastRowExclusive:24});
  assert.equal(cases.C.evaluations.find(e=>e.feedIndex===0&&e.yarnIndex===1).geometryPathHash,cases.G.evaluations.find(e=>e.feedIndex===0&&e.yarnIndex===1).geometryPathHash);
  const comparisons={};
  for(const name of ['D','E','F','G'])comparisons[name]=Array.from({length:8},(_,feedIndex)=>{
    const before=cases.C.evaluations.find(e=>e.feedIndex===feedIndex&&e.yarnIndex===1),after=cases[name].evaluations.find(e=>e.feedIndex===feedIndex&&e.yarnIndex===1);
    return {feedIndex,secondGeometryChangedVs8:before.geometryPathHash!==after.geometryPathHash,
      firstGeometryChangedVsC:cases.C.evaluations.find(e=>e.feedIndex===feedIndex&&e.yarnIndex===0).geometryPathHash!==cases[name].evaluations.find(e=>e.feedIndex===feedIndex&&e.yarnIndex===0).geometryPathHash};
  });
  await fs.writeFile(new URL('results.json',out),JSON.stringify({sourceSnapshot,cases,ranges,hundredNeedles,hundredNeedlesSource30,periodicSolverChecks,comparisons},null,2));
  const summary=Object.fromEntries(Object.entries(cases).map(([name,c])=>[name,{lengths:c.lengths,previewValidity:c.previewValidity,
    rows:c.evaluations.map(e=>({feed:e.feedIndex+1,yarn:e.yarnIndex+1,target:e.target,status:e.solver.status,applied:e.solver.appliedToSimulation,
      solver:e.solver.solvedLengthCmPer100Needles,independent:e.interior.normalizedCmPer100Needles,errorToTarget:e.interiorMinusTarget,
      allRows:e.sameWindowAllRows.normalizedCmPer100Needles,effectiveFinite:e.effectiveFinite.normalizedCmPer100Needles,
      rawModel:e.interior.rawModelLength,needles:e.interior.measuredNeedleCount,segments:e.interior.pathSegmentCount}))}]));
  await fs.writeFile(new URL('summary.json',out),JSON.stringify({cases:summary,hundredNeedles,hundredNeedlesSource30,comparisons},null,2));
  const changed=[];for(const [name,h]of Object.entries(protectedHashes))if(sha(await fs.readFile(name))!==h)changed.push(name);
  assert.deepEqual(changed,[]);assert.equal(git('rev-parse','HEAD').trim(),initial.head);
  await fs.writeFile(new URL('preservation.json',out),JSON.stringify({filesCompared:protectedNames.length,changed,headUnchanged:true,sourceProjectSha256:sha(await fs.readFile(source))},null,2));
} finally {await server.close();}
