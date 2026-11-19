import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
const out=new URL('./',import.meta.url);
globalThis.devicePixelRatio=1;
globalThis.Path2D=class {};
globalThis.window={location:{search:''}};
const server=await createServer({configFile:false,appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
globalThis.document={createTreeWalker:()=>({})};
try {
  const [{readProjectPackage},{createSingleJerseyExecutionInput},{Pattern},{ProcessModel},{YarnModel},{buildYarnPathGeometry},sampler,curves,actions,uv] = await Promise.all([
    '/src/actions/projectPackage.js','/src/components/singleJerseyExecutionInput.js','/src/simulation/Pattern.js','/src/simulation/ProcessModel.js',
    '/src/simulation/YarnModel.js','/src/simulation/yarnPathGeometry.js','/src/simulation/yarnPathSampler.js','/src/simulation/rowLengthLoopModel.js',
    '/src/actions/singleJerseyCamProgram.js','/src/simulation/yarnPathUvStrip.js'].map(p=>server.ssrLoadModule(p)));
  const project=(await readProjectPackage(new Blob([await fs.readFile('reports/sop-001/SOP-001-N6W6040-main-yarn-with-cam.knitscape')]))).project;
  const all=JSON.parse(await fs.readFile(new URL('results.json',out),'utf8'));
  const investigations={};
  for(const name of ['T1-23','T9-width32','T11-height48']) {
    const r=all.runs[name],pattern=createSingleJerseyExecutionInput(project.singleJerseyCamProgram,project.needleArrangement,r.width,r.height);
    const stitchPattern=new Pattern(pattern.pad(1,0,0));
    const graph=new YarnModel(new ProcessModel(stitchPattern).cn);
    const geometry=buildYarnPathGeometry({pattern,stitchPattern,yarnGraph:graph,canvasWidth:900,canvasHeight:900,
      primaryLengthScaleY:1,primaryYarnDiameter:0.24,machineGauge:32});
    const evaluate=geometry.createModelLengthEvaluator();
    investigations[name]=r.solver.map(s=>{
      const candidate=evaluate(s.solvedLoopHeight);
      const courses=[...candidate.measuredModelLengthPer100NeedlesByCourse].filter(([row])=>row%8===s.feedIndex).map(([row,length])=>({row,cm:length*25.4/32/10}));
      const interior=courses.filter(c=>c.row>=8&&c.row<r.height-8);
      return {feed:s.feedIndex+1,solvedLoopHeight:s.solvedLoopHeight,courses,meanCm:courses.reduce((a,c)=>a+c.cm,0)/courses.length,
        interiorMeanCm:interior.reduce((a,c)=>a+c.cm,0)/interior.length};
    });
  }
  const main=all.runs['T1-23'];
  const make=height=>{
    const pattern=createSingleJerseyExecutionInput(project.singleJerseyCamProgram,project.needleArrangement,32,height);
    const stitchPattern=new Pattern(pattern.pad(1,0,0));
    const yarnGraph=new YarnModel(new ProcessModel(stitchPattern).cn);
    const g=buildYarnPathGeometry({pattern,stitchPattern,yarnGraph,canvasWidth:900,canvasHeight:900,primaryLengthScaleY:1,primaryYarnDiameter:0.24,machineGauge:32});
    return {g,yarnGraph};
  };
  const {g,yarnGraph}=make(40);
  const candidate=g.createModelLengthEvaluator()(all.runs['T9-width32'].solver[7].solvedLoopHeight);
  const exactLengths=new Map([...candidate.modelPathByLink].map(([key,path])=>[key,sampler.samplePathData(path,{spacing:Infinity,curveSteps:1}).at(-1).u]));
  const points=yarnGraph.makeNice();
  const middle=[];
  for(const link of g.yarnPathLinks) {
    const needle=Math.floor(points[link.index].i/2);
    if(link.row!==23||needle<9||needle>=25)continue;
    middle.push({index:link.index,row:link.row,needle,linkType:link.linkType,length:exactLengths.get(link.index)});
  }
  const interior100=middle.reduce((n,l)=>n+l.length,0)/16*100*25.4/32/10;
  investigations.exactInteriorFeed8={row:23,needles:16,cmPer100Needles:interior100,reportedCm:all.runs['T9-width32'].solver[7].solvedLengthCmPer100Needles,
    method:'Exact integrated final candidate M/L/C centerlines; 16 interior needles = 4 complete arrangement repeats, outgoing-link ownership.',links:middle};
  assert(Math.abs(interior100-23)>0.1);
  // Confirm saved tension survives the action normalizer, not only raw ZIP JSON.
  const roundtrip=JSON.parse(await fs.readFile(new URL('tension-roundtrip.json',out),'utf8'));
  const normalized=actions.normalizeSingleJerseyCamProgram({...project.singleJerseyCamProgram,feeds:roundtrip.feeds});
  assert(normalized.feeds.every(f=>f.yarns[0].tensionCN===5&&f.yarns[1].tensionCN===4));
  investigations.tensionActionNormalizerPassed=true;
  const offsets=uv.buildYarnUvPathOffsets(g.yarnPathLinks,candidate.modelPathByLink);
  let maxUvError=0;
  for(const link of g.yarnPathLinks) {
    const strip=uv.buildYarnUvStrip({modelPathData:candidate.modelPathByLink.get(link.index),arcLengthOffset:offsets.get(link.index),
      yarnWidth:0.24,physicalRepeatLengthMm:22.987,machineGauge:32,sampleSpacing:0.03,maxPoints:1200});
    const expected=(offsets.get(link.index)+strip.totalModelLength)*(25.4/32)/22.987;
    maxUvError=Math.max(maxUvError,Math.abs(strip.uvs.at(-2)-expected));
  }
  assert(maxUvError<0.0001);
  investigations.physicalUv={repeatMm:22.987,gauge:32,calls:g.yarnPathLinks.length,maxFloat32Error:maxUvError};
  const loopCandidate=g.createModelLengthEvaluator()(all.runs['T9-width32'].solver[0].solvedLoopHeight);
  const loopLinks=g.yarnPathLinks.filter(l=>l.row===16&&Math.floor(points[l.index].i/2)===13&&Math.floor(points[l.index+1].i/2)===13);
  const loopPoints=loopLinks.flatMap(l=>curves.samplePathData(loopCandidate.modelPathByLink.get(l.index)));
  const bb={minX:Math.min(...loopPoints.map(p=>p.x)),maxX:Math.max(...loopPoints.map(p=>p.x)),minY:Math.min(...loopPoints.map(p=>p.y)),maxY:Math.max(...loopPoints.map(p=>p.y))};
  investigations.exampleNeedleLoop={rowZeroBased:16,physicalNeedleZeroBased:12,feed:1,type:1,linkTypes:loopLinks.map(l=>l.linkType),
    method:'24 samples per cubic, needle-internal links only, no outgoing sinker link; model XY bbox, not physical measurement.',
    widthModel:bb.maxX-bb.minX,heightModel:bb.maxY-bb.minY,widthMmEquivalent:(bb.maxX-bb.minX)*.79375,heightMmEquivalent:(bb.maxY-bb.minY)*.79375};
  await fs.writeFile(new URL('deep-probes.json',out),JSON.stringify(investigations,null,2));
  console.log(JSON.stringify({interior100,reported:all.runs['T9-width32'].solver[7].solvedLengthCmPer100Needles,
    courseValues:investigations['T9-width32'][7],height48:investigations['T11-height48'][7]},null,2));
} finally {await server.close();}
