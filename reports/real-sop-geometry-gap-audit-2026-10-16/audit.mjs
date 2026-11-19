// Read-only production replay. Observer transforms exist only in Vite's memory.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const root = process.cwd();
const out = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
async function fingerprints() {
  const names = [...new Set(git('ls-files', '-z', '--cached', '--others', '--exclude-standard', 'src', 'scripts', 'package.json', 'package-lock.json', 'AGENTS.md', 'NEXT_TASK.md', 'KnitScape_当前功能与算法.md').split('\0').filter(Boolean))];
  return Object.fromEntries(await Promise.all(names.map(async name => [name, hash(await fs.readFile(path.join(root, name)))])));
}
const initial = { head: git('rev-parse', 'HEAD').trim(), branch: git('branch', '--show-current').trim(),
  tagCommit: git('rev-parse', 'baseline-trusted-yarn-length').trim(), status: git('status', '--short'),
  baseline: '7ababf264d495f6b96d4d66652c529424938ac4d', files: await fingerprints() };
await fs.writeFile(path.join(out, 'initial-state.json'), JSON.stringify(initial, null, 2));
await fs.writeFile(path.join(out, 'baseline-working-tree.diff'), git('-c', 'core.quotepath=false', 'diff', '--no-ext-diff', initial.baseline));
globalThis.devicePixelRatio = 1;
globalThis.window = { location: { search: '' }, setTimeout, clearTimeout };
globalThis.Path2D = class { constructor(data='') { this.data = data; } };
globalThis.__gap = { draws: [], geometries: [], jobs: [], strips: [] };
const obs = globalThis.__gap;
let box = {width: 900, height: 900};
function canvas(id='') {
  const ctx = { clearRect(){}, save(){}, restore(){}, stroke(){}, drawImage(){}, createPattern(){return null;} };
  return { id, style: {}, getContext(kind) { return kind === '2d' ? ctx : null; } };
}
const canvases = new Map(['back','mid','front'].map(id => [id,canvas(id)]));
globalThis.document = { createTreeWalker: () => ({}), createElement: () => canvas(),
  getElementById: id => canvases.get(id) || {getBoundingClientRect: () => box} };
globalThis.Image = class { set src(url) { fetch(url).then(r=>r.arrayBuffer()).then(b=>{
  const p=Buffer.from(b); this.naturalWidth=p.readUInt32BE(16); this.naturalHeight=p.readUInt32BE(20); this.onload?.();
}).catch(()=>this.onerror?.()); } };
const server = await createServer({ configFile: false, appType: 'custom', logLevel: 'silent', server: {middlewareMode: true},
  plugins: [{name: 'gap-audit-memory-observers', enforce: 'pre', transform(source,id) {
    const file=id.replaceAll('\\','/');
    if(file.endsWith('/src/simulation/drawYarnSimulation.js')) return source.replace('export function drawYarnSimulation(', 'function originalDraw(') +
      '\nexport function drawYarnSimulation(args) { globalThis.__gap.draws.push(args); return originalDraw(args); }';
    if(file.endsWith('/src/simulation/yarnPathGeometry.js')) return source.replace('export function buildYarnPathGeometry(', 'function originalBuild(') +
      '\nexport function buildYarnPathGeometry(args) { const g=originalBuild(args); globalThis.__gap.geometries.push({args,g}); return g; }';
    if(file.endsWith('/src/simulation/yarnTextureBrush.js')) return source.replace('export function prepareYarnTextureImages(', 'function originalPrepare(') +
      '\nexport function prepareYarnTextureImages(...args) { const p=originalPrepare(...args); globalThis.__gap.jobs.push(p); return p; }';
    if(file.endsWith('/src/simulation/yarnPathUvStrip.js')) return source.replace('export function buildYarnUvStrip(', 'function originalStrip(') +
      '\nexport function buildYarnUvStrip(args) { const s=originalStrip(args); globalThis.__gap.strips.push({args,s}); return s; }';
  }}] });
function bounds(points) {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of points) {minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
  return {minX,minY,maxX,maxY,width:maxX-minX,height:maxY-minY};
}
function pointDiff(a,b) {
  assert.equal(a.length,b.length); let changed=0,maxDelta=0,maxDx=0,maxDy=0;
  a.forEach((p,i)=>{const dx=Math.abs(p.x-b[i].x),dy=Math.abs(p.y-b[i].y);if(dx||dy)changed++;maxDx=Math.max(dx,maxDx);maxDy=Math.max(dy,maxDy);maxDelta=Math.max(maxDelta,Math.hypot(dx,dy));});
  return {points:a.length,changed,maxDelta,maxDx,maxDy};
}
function mapHash(map) {return hash(JSON.stringify([...map]));}
try {
  const [{readProjectPackage,writeProjectPackage},{yarnAssetRegistry},{createSingleJerseyExecutionInput},{simulate},{Bimp},curves,uv,metrics,domain,adapter] = await Promise.all([
    '/src/actions/projectPackage.js','/src/yarnTexture/yarnAssetRegistry.js','/src/components/singleJerseyExecutionInput.js','/src/simulation/yarnSimulation.js',
    '/src/lib/Bimp.js','/src/simulation/rowLengthLoopModel.js','/src/simulation/yarnPathUvStrip.js','/src/simulation/yarnLengthMetrics.js',
    '/src/domain/singleJerseyMachine.js','/src/adapters/singleJerseySimulationInput.js'].map(p=>server.ssrLoadModule(p)));
  const source='reports/sop-001/SOP-001-N6W6040-main-yarn-with-cam.knitscape';
  const opened=await readProjectPackage(new Blob([await fs.readFile(source)]));
  yarnAssetRegistry.replaceWith(opened.registry);
  const p=opened.project;
  const mainId=p.singleJerseyCamProgram.feeds[0].yarns[0].yarnId;
  const cleanAsset={id:'audit-low',name:'20D LOW (diagnostic assignment)',category:'OTHER',pbr:null};
  const sourceSummary={file:source,sha256:hash(await fs.readFile(source)),width:p.width,height:p.height,gauge:p.machineGauge,
    arrangement:p.needleArrangement,tracks:p.singleJerseyCamProgram.tracks,feeds:p.singleJerseyCamProgram.feeds,
    yarnPlies:p.yarnPlies.map(x=>({...x,texture:x.texture?'present':null})),
    yarnLibrary:p.yarnLibrary.map(x=>({id:x.id,name:x.name,color:x.color,diameter:x.diameter,repeat:x.pbr?.physicalRepeatLengthMm,maps:x.pbr?Object.keys(x.pbr):[]}))};
  await fs.writeFile(path.join(out,'source-project-summary.json'),JSON.stringify(sourceSummary,null,2));
  const runs={};
  const raw={};
  async function run(name, lengths, options={}) {
    const project=structuredClone(p); project.width=options.width??p.width; project.height=options.height??p.height;
    project.machineGauge=options.gauge??p.machineGauge;
    project.yarnLibrary.push(structuredClone(cleanAsset));
    if(options.secondDiameter!==undefined) project.yarnLibrary.at(-1).diameter=options.secondDiameter;
    if(options.diameter!==undefined) project.yarnPlies[0].diameter=options.diameter;
    if(options.assetDiameter!==undefined) project.yarnLibrary.find(x=>x.id===mainId).diameter=options.assetDiameter;
    project.singleJerseyCamProgram.feeds.forEach((f,feed)=>{f.yarns=lengths.map((length,i)=>({
      yarnId: i===0 && !options.lowOnly ? mainId : cleanAsset.id,
      yarnLengthCmPer100Needles:length,tensionCN:options.tension?.[i]??null,placement:'parallel'}));});
    const input=createSingleJerseyExecutionInput(project.singleJerseyCamProgram,project.needleArrangement,project.width,project.height);
    obs.draws.length=0;obs.geometries.length=0;obs.strips.length=0;
    box={width:900,height:900};
    const r=simulate(input,Bimp.fromJSON(project.yarnSequence),project.yarnPalette,options.scale??1,project.yarnPlies,{
      machineGauge:project.machineGauge,texturePerformanceMode:options.textured?'quality':'solid',
      feeds:project.singleJerseyCamProgram.feeds,yarnLibrary:project.yarnLibrary});
    while(obs.jobs.length) await Promise.all(obs.jobs.splice(0));
    const draw=obs.draws.at(-1);
    const sourceGeometry=obs.geometries.filter(x=>!x.args.measurementWindow);
    const points=draw.yarnStrands.map(strand=>[...strand.resolvedPathByLink.values()].flatMap(d=>curves.samplePathData(d)));
    const modelPoints=draw.yarnStrands.map(strand=>[...strand.modelPathByLink.values()].flatMap(d=>curves.samplePathData(d)));
    const final=[];
    const stripInputs=[];
    for(let index=0;index<draw.yarnStrands.length;index++) {
      const strand=draw.yarnStrands[index]; const vertices=[]; const center=[];
      for(const link of draw.yarnPathLinks) {
        const mats=draw.feedYarnPlies.get(link.row%draw.feedCount);const mat=mats[index];if(!mat)continue;
        const modelPathData=strand.modelPathByLink.get(link.index),display=strand.resolvedPathByLink.get(link.index);
        const start=curves.pathEndpoints(modelPathData).start,ds=curves.pathEndpoints(display).start;
        const total=mats.reduce((sum,m)=>sum+m.diameter,0);
        const offset=mats.slice(0,index).reduce((sum,m)=>sum+m.diameter,0)+mat.diameter/2-total/2;
        const args={modelPathData,modelToCanvasPoint:q=>({x:ds.x+(q.x-start.x)*draw.stitchWidth,y:ds.y+(q.y-start.y)*draw.stitchWidth}),
          arcLengthOffset:strand.uvOffsets?.get(link.index),normalOffsetModel:offset,yarnWidth:draw.stitchWidth*mat.diameter,
          textureRepeatLength:48,physicalRepeatLengthMm:mat.texture?.pbr?.physicalRepeatLengthMm,machineGauge:project.machineGauge,sampleSpacing:0.03,maxPoints:1200};
        const s=uv.buildYarnUvStrip(args);
        for(let j=0;j<s.positions.length;j+=4){ vertices.push({x:s.positions[j],y:s.positions[j+1]},{x:s.positions[j+2],y:s.positions[j+3]});center.push({x:(s.positions[j]+s.positions[j+2])/2,y:(s.positions[j+1]+s.positions[j+3])/2}); }
        stripInputs.push({index,link,positions:Array.from(s.positions),uvs:Array.from(s.uvs),indices:Array.from(s.indices)});
      }
      final.push({vertices,center});
    }
    const solver=r.yarnLengthSolverResults.map(({solvedPathByLink,...rest})=>({...rest,solvedPathCount:solvedPathByLink.size}));
    const byCourse=draw.yarnStrands.map(strand=>Array.from({length:project.height},(_,row)=>{
      const links=draw.yarnPathLinks.filter(l=>l.row===row);
      const paths=links.map(l=>strand.resolvedPathByLink.get(l.index));
      const pts=paths.flatMap(d=>curves.samplePathData(d));
      return {row,feed:row%8,bounds:bounds(pts),lengthModel:paths.reduce((s,d)=>s+curves.pathDataLength(d,draw.stitchWidth),0),
        start:curves.pathEndpoints(paths[0])?.start,end:curves.pathEndpoints(paths.at(-1))?.end};
    }));
    runs[name]={lengths,width:project.width,height:project.height,gauge:project.machineGauge,previewValidity:r.previewValidity,
      method:'Production simulate + production draw; drawing surfaces are doubles. Rebuilt final strips with production buildYarnUvStrip, not a GPU capture.',
      solver,stitchWidth:draw.stitchWidth,diameters:[...draw.feedYarnPlies.values()][0].map(m=>({diameter:m.diameter,source:m.source?.diameter??'LEGACY_FALLBACK',mmEquivalent:m.diameter*25.4/project.machineGauge})),
      strandCount:draw.yarnStrands.length,modelBounds:modelPoints.map(bounds),displayCenterlineBounds:points.map(bounds),renderedStripBounds:final.map(x=>bounds(x.vertices)),
      modelHashes:draw.yarnStrands.map(s=>mapHash(s.modelPathByLink)),displayHashes:draw.yarnStrands.map(s=>mapHash(s.resolvedPathByLink)),
      totalCenterlineLengthModel:draw.yarnStrands.map(s=>[...s.modelPathByLink.values()].reduce((n,d)=>n+curves.pathDataLength(d),0)),
      perCourse:byCourse,baseMeasurements:sourceGeometry.map(x=>({modelGeometry:x.g.modelGeometry,windowNeedleCountByCourse:[...x.g.windowNeedleCountByCourse],measuredModelLengthPer100NeedlesByCourse:[...x.g.measuredModelLengthPer100NeedlesByCourse]})),
    };
    raw[name]={draw,points,modelPoints,final,sourceGeometry,project};
    if(['T1-23','T2-8','T3-23+8','T4-23+23','T5-diameter036'].includes(name)) {
      await fs.writeFile(path.join(out,name+'-strips.json'),JSON.stringify(stripInputs));
      const polys=stripInputs.map(s=>{const pos=s.positions;const left=[],right=[];for(let i=0;i<pos.length;i+=4){left.push(`${pos[i]},${pos[i+1]}`);right.unshift(`${pos[i+2]},${pos[i+3]}`);}return `<polygon fill="${s.index===0?'#ededdf':'#5896d6'}" points="${[...left,...right].join(' ')}"/>`;});
      await fs.writeFile(path.join(out,name+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900"><rect width="900" height="900" fill="#41464c"/>${polys.join('')}</svg>`);
    }
    r.stopSim();
    console.log(name,r.previewValidity,solver.map(s=>`${s.feedIndex+1}/${s.yarnIndex+1}:${s.status}:${s.solvedLoopHeight}`).join(' '));
    return r;
  }
  await run('T1-23',[23]);
  await run('T2-8',[8],{lowOnly:true});
  await run('T3-23+8',[23,8]);
  await run('T4-23+23',[23,23]);
  await run('T5-diameter036',[23],{diameter:0.36});
  await run('T5-secondDiameter014',[23,8],{secondDiameter:0.14});
  await run('T7-tension5-4',[23,8],{tension:[5,4]});
  await run('T8-base-unset',[0]);
  await run('T9-width32',[23],{width:32});
  await run('T10-width28',[23],{width:28});
  await run('T11-height48',[23],{width:32,height:48});
  await run('T12-gauge28',[23],{gauge:28});
  await run('T13-scale15',[23],{scale:1.5});
  await run('T14-pbr',[23],{textured:true});
  const comparisons={
    firstYarnAddedSecond:{modelIdentical:runs['T1-23'].modelHashes[0]===runs['T3-23+8'].modelHashes[0],displayPathIdentical:runs['T1-23'].displayHashes[0]===runs['T3-23+8'].displayHashes[0],
      model:pointDiff(raw['T1-23'].modelPoints[0],raw['T3-23+8'].modelPoints[0]),renderedVertices:pointDiff(raw['T1-23'].final[0].vertices,raw['T3-23+8'].final[0].vertices)},
    firstYarnSecond8vs23:{model:pointDiff(raw['T3-23+8'].modelPoints[0],raw['T4-23+23'].modelPoints[0]),renderedVertices:pointDiff(raw['T3-23+8'].final[0].vertices,raw['T4-23+23'].final[0].vertices)},
    second8vsUnset:{modelIdentical:runs['T2-8'].modelHashes[0]===runs['T8-base-unset'].modelHashes[0]},
    tension:{modelIdentical:runs['T3-23+8'].modelHashes.join()===runs['T7-tension5-4'].modelHashes.join(),renderedVertices:raw['T3-23+8'].final.map((f,i)=>pointDiff(f.vertices,raw['T7-tension5-4'].final[i].vertices))},
    diameter:{model:pointDiff(raw['T1-23'].modelPoints[0],raw['T5-diameter036'].modelPoints[0])},
    pbr:{modelIdentical:runs['T1-23'].modelHashes[0]===runs['T14-pbr'].modelHashes[0],displayIdentical:runs['T1-23'].displayHashes[0]===runs['T14-pbr'].displayHashes[0]},
    zoom:{modelIdentical:runs['T1-23'].modelHashes[0]===runs['T13-scale15'].modelHashes[0]},
  };
  assert(comparisons.firstYarnAddedSecond.modelIdentical);
  assert.equal(comparisons.firstYarnSecond8vs23.renderedVertices.changed,0);
  assert(comparisons.tension.modelIdentical);
  assert(runs['T2-8'].solver.every(s=>s.status==='UNREACHABLE_TARGET'&&!s.appliedToSimulation));
  assert(comparisons.diameter.model.changed>0);
  // Asymmetric real Cam: compare every machine output pixel, preserving rows.
  const ops=domain.resolveSingleJerseyOperations(p.singleJerseyCamProgram,p.needleArrangement,32,40);
  const bitmap=adapter.createSingleJerseySimulationInput(ops);
  for(let row=0;row<40;row++)for(let x=0;x<32;x++)assert.equal(bitmap.pixels[row*32+x],{K:0,T:3,M:2}[p.singleJerseyCamProgram.tracks[x%4][row%8]]);
  const topology={operationsFirstRepeat:ops.slice(0,8).map(row=>row.slice(0,4)),all1280PixelsMatched:true,
    layers:raw['T1-23'].draw.yarnPathLinks.reduce((o,l)=>(o[l.layer]=(o[l.layer]||0)+1,o),{})};
  await fs.writeFile(path.join(out,'results.json'),JSON.stringify({sourceSummary,runs,comparisons,topology},null,2));
  // Persist tension through the actual ZIP codec with an in-memory fixture.
  const mod=await server.ssrLoadModule('/src/actions/projectPackage.js');
  const tensionProject=raw['T7-tension5-4'].project;
  const tensionZip=await mod.createProjectPackage(tensionProject);
  const reloaded=await mod.readProjectPackage(tensionZip);
  assert.deepEqual(reloaded.project.singleJerseyCamProgram.feeds,tensionProject.singleJerseyCamProgram.feeds);
  await fs.writeFile(path.join(out,'tension-roundtrip.json'),JSON.stringify({passed:true,feeds:reloaded.project.singleJerseyCamProgram.feeds},null,2));
  reloaded.registry.clear();
  await fs.writeFile(path.join(out,'summary.json'),JSON.stringify({comparisons,topology,cases:Object.fromEntries(Object.entries(runs).map(([k,v])=>[k,{previewValidity:v.previewValidity,heights:v.solver.map(s=>s.solvedLoopHeight),range:v.solver.map(s=>s.reachableRange),bounds:v.renderedStripBounds}]))},null,2));
  const finalFiles=await fingerprints();
  const changes=Object.keys(initial.files).filter(k=>initial.files[k]!==finalFiles[k]);
  assert.deepEqual(changes,[]);
  await fs.writeFile(path.join(out,'preservation.json'),JSON.stringify({sourceFilesCompared:Object.keys(initial.files).length,changes,headUnchanged:git('rev-parse','HEAD').trim()===initial.head,branch:git('branch','--show-current').trim()},null,2));
} finally {await server.close();}
