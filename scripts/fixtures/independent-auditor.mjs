// Diagnostics only: integrate final generated M/L/C paths without production metrics.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';

function cubicLength(p0,p1,p2,p3) {
  const speed=t=>{
    const q=1-t;
    return Math.hypot(3*q*q*(p1.x-p0.x)+6*q*t*(p2.x-p1.x)+3*t*t*(p3.x-p2.x),
      3*q*q*(p1.y-p0.y)+6*q*t*(p2.y-p1.y)+3*t*t*(p3.y-p2.y));
  };
  const simpson=(a,b,fa,fm,fb)=>(b-a)*(fa+4*fm+fb)/6;
  function refine(a,b,fa,fm,fb,whole,tolerance,depth) {
    const m=(a+b)/2,l=(a+m)/2,r=(m+b)/2,fl=speed(l),fr=speed(r);
    const left=simpson(a,m,fa,fl,fm),right=simpson(m,b,fm,fr,fb),delta=left+right-whole;
    if(depth===0||Math.abs(delta)<=15*tolerance)return left+right+delta/15;
    return refine(a,m,fa,fl,fm,left,tolerance/2,depth-1)+refine(m,b,fm,fr,fb,right,tolerance/2,depth-1);
  }
  const a=speed(0),m=speed(.5),b=speed(1);
  return refine(0,1,a,m,b,simpson(0,1,a,m,b),1e-10,24);
}

export function integrateGeneratedPath(data) {
  const tokens=String(data).match(/[MLC]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)||[];
  let i=0,current=null,length=0,segments=0;
  const point=()=>{
    const p={x:Number(tokens[i++]),y:Number(tokens[i++])};
    assert(Number.isFinite(p.x)&&Number.isFinite(p.y),'non-finite generated coordinate');return p;
  };
  while(i<tokens.length) {
    const command=tokens[i++];
    if(command==='M')current=point();
    else if(command==='L') {assert(current);const end=point();length+=Math.hypot(end.x-current.x,end.y-current.y);current=end;segments++;}
    else if(command==='C') {assert(current);const a=point(),b=point(),end=point();length+=cubicLength(current,a,b,end);current=end;segments++;}
    else throw new Error('Unsupported generated path command: '+command);
  }
  return {length,segments};
}

export function auditFinalYarnLength({geometry,feedIndex,yarnIndex,gauge=geometry.gauge,
  firstNeedle=4,needleCount=16,firstRow=8,lastRowExclusive=geometry.height-8,allVisible=false}) {
  assert(Number.isFinite(gauge)&&gauge>0);
  const paths=new Map(geometry.strands[yarnIndex].paths);
  const rows=Array.from({length:geometry.height},(_,i)=>i).filter(i=>i%geometry.feedCount===feedIndex&&i>=firstRow&&i<lastRowExclusive);
  const chosen=geometry.links.filter(l=>rows.includes(l.row)&&paths.has(l.index)&&
    (allVisible||(l.sourceNeedle>=firstNeedle&&l.sourceNeedle<firstNeedle+needleCount)));
  const byRow=new Map(rows.map(row=>[row,{row,rawModelLength:0,pathLinkCount:0,pathSegmentCount:0,repeatJunctionModelLength:0,boundaryModelLength:0,uniqueNeedles:new Set()}]));
  for(const l of chosen) {
    const p=integrateGeneratedPath(paths.get(l.index)),length=p.length/geometry.coordinateScale;
    const row=byRow.get(l.row);row.rawModelLength+=length;row.pathLinkCount++;row.pathSegmentCount+=p.segments;row.uniqueNeedles.add(l.sourceNeedle);
    if(l.crossesRepeatBoundary)row.repeatJunctionModelLength+=length;
    if(l.row<8||l.row>=geometry.height-8||l.sourceNeedle<0||l.sourceNeedle>=geometry.width||l.targetNeedle<0||l.targetNeedle>=geometry.width)row.boundaryModelLength+=length;
  }
  const rawModelLength=[...byRow.values()].reduce((s,r)=>s+r.rawModelLength,0),physicalMm=rawModelLength*25.4/gauge;
  const measuredNeedleCount=allVisible?null:needleCount*rows.length;
  const result={feedIndex,yarnIndex,gauge,coordinateKind:geometry.coordinateKind,
    interval:{firstNeedle,needleCount,rows,allVisible,ownership:'Whole outgoing link belongs to its source needle, including any wrap/period crossing.'},
    rawModelLength,physicalMm,physicalCm:physicalMm/10,measuredNeedleCount,
    countMeaning:'Sum of needle positions over selected passages of one Feed; not number of knit loops, links or physical needles added to the machine.',
    normalizedModelLengthPer100:measuredNeedleCount===null?null:rawModelLength*100/measuredNeedleCount,
    normalizedCmPer100Needles:measuredNeedleCount===null?null:physicalMm*10/measuredNeedleCount,
    pathLinkCount:chosen.length,pathSegmentCount:[...byRow.values()].reduce((s,r)=>s+r.pathSegmentCount,0),
    boundaryContributionModel:[...byRow.values()].reduce((s,r)=>s+r.boundaryModelLength,0),
    repeatContributionModel:[...byRow.values()].reduce((s,r)=>s+r.repeatJunctionModelLength,0),
    contributionMeaning:'Already included whole-link lengths; boundary = first/last 8-course guard band or source/target outside effective needles; repeat = link crossing a repeat boundary. Categories can overlap; no extra closure segment is invented.',
    perCourse:[...byRow.values()].map(r=>({...r,uniqueNeedles:[...r.uniqueNeedles].sort((a,b)=>a-b),
      measuredNeedleCount:allVisible?null:needleCount,normalizedCmPer100Needles:allVisible?null:r.rawModelLength*25.4/gauge*10/needleCount}))};
  return result;
}

export function selfCheck() {
  assert(Math.abs(integrateGeneratedPath('M 0 0 C .3333333333333333 0 .6666666666666666 0 1 0').length-1)<1e-12);
  const parabola=.5*Math.sqrt(5)+.25*Math.asinh(2);
  assert(Math.abs(integrateGeneratedPath('M 0 0 C .3333333333333333 0 .6666666666666666 .3333333333333333 1 1').length-parabola)<1e-10);
  assert.equal(integrateGeneratedPath('M 0 0 L 1 0 M 20 0 L 21 0').length,2);
  assert.equal(integrateGeneratedPath('M 10 7 L 13 11').length,5);
}
selfCheck();
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const file=process.argv[2];assert(file,'Usage: node independent-auditor.mjs geometry.json.gz Feed(1-based) Yarn(1-based)');
  const bytes=await fs.readFile(file),geometry=JSON.parse(file.endsWith('.gz')?gunzipSync(bytes):bytes);
  console.log(JSON.stringify(auditFinalYarnLength({geometry,feedIndex:Number(process.argv[3]||8)-1,yarnIndex:Number(process.argv[4]||1)-1}),null,2));
}
