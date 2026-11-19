// Display construction only. CN owns source order and real release rows.
// Neither the display units nor relative yarn response are physical calibration.
import { add, clamp, cross, distance, normalize, scale, subtract } from './yarnSpatialMath.js';
import { createSpatialCurve } from './yarnSpatialPath.js';
import { segmentDistance } from './yarnGeometryAudit.js';
export const SOP_INTERLOCK_LAYOUT = Object.freeze({ columnPitch: .68, courseStep: .48 });
const {columnPitch,courseStep}=SOP_INTERLOCK_LAYOUT;
const sheetNormal=[0,0,1],sinkerY=-.18,throatY=.035;
const platingSlots=[
 {seat:.056,sinker:[.040,.065],leg:[.056,.040],tuckDepth:.040,crownLift:.034},
 {seat:-.056,sinker:[-.098,-.155],leg:[-.056,-.040],tuckDepth:-.040,crownLift:-.045}];
function smoothRise(a,b,x){const u=clamp((x-a)/(b-a),0,1);return u*u*(3-2*u);}

function plateCell({ guides, origin, needle, tuck, radiusMm, roles, guideTangents, plateRoleCoordinates, plateRoles }, yarnIndex) {
  roles = plateRoles ?? roles;
  const crownIndex = (guides.length - 1) / 2;
  const tipHeight = guides[crownIndex][1];
  return guides.map((point, i) => {
    const sideIndex = i <= crownIndex ? j => j : j => guides.length - 1 - j;
    const legMidY = roles?.legMidY ?? guides[sideIndex(6)][1], legEndY = roles?.legEndY ?? guides[sideIndex(crownIndex - 5)][1];
    const halfIndex = plateRoleCoordinates?.[i] ?? Math.min(i,guides.length-1-i);
    // Canonical left-to-right controls: both cells at a sinker use the
    // same tangent and slot, including when the source chain runs in reverse.
    const tangent = i === 0 || i === guides.length - 1
      ? [1, 0, 0] : guideTangents?.[i] ?? normalize(subtract(guides[i + 1], guides[i - 1]));
    const lateral = normalize(cross(sheetNormal, tangent));
    const normal = cross(tangent, lateral);
    const y = point[1];
    const sinker = roles ? 1-smoothRise(0,roles.entryEnd,halfIndex) : 1-smoothRise(sinkerY+.005,-.12,y);
    const leg = roles ? smoothRise(roles.entryStart,roles.entryEnd,halfIndex)
      * (1-smoothRise(roles.freeLegStart,roles.shoulder+(roles.crown-roles.shoulder)/2,halfIndex))
      : smoothRise(throatY,.13,y)*(1-smoothRise(legMidY,legEndY,y));
    // Lift/lower the tip, without widening each shoulder into the next needle.
    const crown = (roles ? smoothRise(roles.shoulder,roles.crown,halfIndex)
      : smoothRise(legEndY,tipHeight-.015,y)) * lateral[1] ** 2;
    const slots = platingSlots.map((slot, index) => {
      const across = slot.seat + sinker * (slot.sinker[0] - slot.seat)
        + leg * (slot.leg[0] - slot.seat) + crown * slot.crownLift;
      const seatDepth = (index === 0 ? 0.035 : -0.035) * normal[2]
        * Math.cos(Math.PI * (roles ? halfIndex/roles.crown : (y-sinkerY)/(tipHeight-sinkerY)));
      const above = seatDepth + sinker * (slot.sinker[1] - seatDepth)
        + leg * ((tuck ? slot.tuckDepth : slot.leg[1]) - seatDepth);
      return [across, above];
    });
    const delta = slots[0].map((value, axis) => value - slots[1][axis]);
    // DISPLAY_ONLY: leave bend/interpolation clearance; this is not a measured yarn diameter.
    const halfGap = radiusMm * 1.36;
    const side = yarnIndex === 0 ? 1 : -1;
    const [across, above] = delta.map((value, axis) =>
      (slots[0][axis] + slots[1][axis]) / 2 + side * halfGap * value / Math.hypot(...delta));
    const offset = add(scale(lateral, across), scale(normal, above));
    const placed = add(origin, add(point, offset));
    // Evaluate the shared half-needle once, avoiding different floating-point
    // rounding from origin+halfPitch versus neighbourOrigin-halfPitch.
    if (i === 0 || i === guides.length - 1) placed[0] = (needle + (i === 0 ? -0.5 : 0.5)) * columnPitch;
    return placed;
  });
}


// This is the existing dimensionless plating-weight domain, not a second
// geometric template. Its numeric roles continue to locate sinker/leg/crown
// weights while actual control indices are remapped by the new construction.
function platingDomain() {
  return {...{"roles":{"entryStart":6,"entryEnd":12,"shoulder":28,"crown":40,"freeLegStart":16,"freeLegEnd":26,"anchorIndices":[0,6,9,12,14,16,28,31,33,35,40],"phases":[0,0.3808707390319419,0.7647600399950977,1.1420272647651135,1.4939300329720215,1.8167603467681699,2.115443331825227,2.400796923587632,2.686976341492812,2.985719762463736,3.304585676714054,3.643917291906531,4.0156241157216215,4.4510018675491025,4.966369989119837,5.526240518700217,6.018018676373378,6.134394100650397,6.247019889006713,6.350109020895087,6.442491139976819,6.529337941227426,6.61669679064152,6.702558914528494,6.796492267417802,6.903627685285977,6.982669030126254,7.3683743106375665,7.856741057910191,8.30489533828531,8.736091487082339,9.166759592508107,9.59664040020822,10.025536817707358,10.453328771599582,10.879977123367636,11.305525596679518,11.730093507756582,12.15386545253269,12.577077189053492,13,12.577077189053492,12.15386545253269,11.730093507756582,11.305525596679518,10.879977123367636,10.453328771599582,10.025536817707358,9.59664040020822,9.166759592508107,8.736091487082339,8.30489533828531,7.856741057910191,7.3683743106375665,6.982669030126254,6.903627685285977,6.796492267417802,6.702558914528494,6.61669679064152,6.529337941227426,6.442491139976819,6.350109020895087,6.247019889006713,6.134394100650397,6.018018676373378,5.526240518700217,4.966369989119837,4.4510018675491025,4.0156241157216215,3.643917291906531,3.304585676714054,2.985719762463736,2.686976341492812,2.400796923587632,2.115443331825227,1.8167603467681699,1.4939300329720215,1.1420272647651135,0.7647600399950977,0.3808707390319419,0],"entryEndY":0.0325,"legMidY":0.3415040556643697,"legEndY":0.48,"tipY":0.6360449935114869,"description":"Roles are geometric mother locations; resampled indices are not legacy C indices."},"design":{"pitch":0.68,"course":0.48,"B":0.08260000000000002,"width":0.2574,"headY":0.15604499351148696,"front":0.09912000000000003,"back":-0.09912000000000003,"shoulderY":0.48,"portalY":0.15604499351148693,"status":"DISPLAY_CONSTRUCTION_NOT_PHYSICAL_CALIBRATION"},"radiusMm":0.035},origin:[0,0,0],needle:0,tuck:false};
}
const {createSharedEntryPrimitive,createOrdinaryInterlockPrimitive}=(()=>{
// One shared course turn and complete oblique leg. Display design only.





const rise=u=>u*u*u*(10+u*(-15+6*u));
function createSharedEntryPrimitive(memberCount=1,holdCourses=1){
 if(!Number.isInteger(holdCourses)||holdCourses<1)throw Error('Positive source hold span required');
 if(!Number.isInteger(memberCount)||memberCount<1)throw Error('Explicit source group count required');
 const old=platingDomain(),r=old.radiusMm,W=old.design.width-.003,B=old.design.B,H=B+.012,D=4*r,front=4*r,back=front-(old.design.front-old.design.back)-(memberCount-1)*(2*r+.006),shoulderZ=front-(old.design.front-old.design.back)+D;
 // The row uses the lowest retained shoulder as its common course context.
 // Shortening the projected turn must retain its 3D bending radius.
 // The complete plated quarter needs a positive projected course clearance,
 // beyond its bundle envelope: 0.3r covers the actual contact witness's
 // required Y separation plus the existing .006 surface-gap target.
 const connectionGuard=.3*r,sinkerY=-(B+r+connectionGuard)-(memberCount-1)*r*1.36,throat=B+.001,R=H,spanX=.34-throat,spanY=H,end=[-W,.48*holdCourses,shoulderZ],bendY=end[1]-D,entryBendY=.48-D;
 const neckY=sinkerY+spanY,depthSpan=front-back,curveDepth=Math.sqrt(Math.max(0,spanX*R-spanY*spanY)),phaseDepth=4*spanY*depthSpan/(entryBendY-neckY+4*spanY),turnDepth=Math.max(curveDepth,phaseDepth),neck=[-throat,neckY,back+turnDepth],riseLength=4*(depthSpan-turnDepth)*spanY/turnDepth,frontY=neckY+riseLength;
 const legNeckY=-(B+r+connectionGuard)+H;
 const dx=W-throat,dy=end[1]-legNeckY,f=a=>(dx-2*R)*Math.cos(a)-dy*Math.sin(a)+2*R;
 let lo=0,hi=Math.PI/2;for(let i=0;i<64;i++){const m=(lo+hi)/2;if(f(m)>0)lo=m;else hi=m;}const alpha=(lo+hi)/2,L=(dy-2*R*Math.sin(alpha))/Math.cos(alpha);
 if(!(L>0))throw Error('No positive free oblique leg');
 const hermite=(a,b,ma,mb,u,h)=>(2*u**3-3*u*u+1)*a+(-2*u**3+3*u*u)*b+(u**3-2*u*u+u)*h*ma+(u**3-u*u)*h*mb;
 const zAt=y=>y<frontY?neck[2]+(front-neck[2])*(1-(1-(y-neckY)/riseLength)**4):y<bendY?front:hermite(front,shoulderZ,0,-D/H,(y-bendY)/D,D);
 const nodes=[];
 const turnRadius=Math.hypot(spanY,turnDepth),straight=spanX-turnRadius,turnArc=Math.PI*turnRadius/2,total=straight+turnArc;
 for(let j=0;j<=256;j++){const u=j/256;nodes.push({p:[-.34+straight*u,sinkerY,back],ref:old.roles.freeLegStart*straight*u/total});}
 for(let j=1;j<=512;j++){const u=j/512,a=Math.PI/2*u;nodes.push({p:[-.34+straight+turnRadius*Math.sin(a),sinkerY+spanY*(1-Math.cos(a)),back+turnDepth*(1-Math.cos(a))],ref:old.roles.freeLegStart*(straight+turnArc*u)/total});}
 if(memberCount>1)for(let j=1;j<=128;j++){const y=neckY+(legNeckY-neckY)*j/128;nodes.push({p:[-throat,y,zAt(y)],ref:old.roles.freeLegStart});}
 const leg=[];
 for(let j=0;j<=128;j++){const a=alpha*j/128,y=legNeckY+R*Math.sin(a);leg.push({p:[neck[0]-R*(1-Math.cos(a)),y,zAt(y)],ref:old.roles.entryEnd+(old.roles.freeLegStart-old.roles.entryEnd)*j/128});}
 const a=leg.at(-1).p,bowAmplitude=Math.min(r/2,L/20);
 for(let j=1;j<=256;j++){const u=j/256,bow=bowAmplitude*64*u**3*(1-u)**3,y=a[1]+L*u*Math.cos(alpha)-bow*Math.sin(alpha);leg.push({p:[a[0]-L*u*Math.sin(alpha)-bow*Math.cos(alpha),y,zAt(y)],ref:old.roles.freeLegStart+(old.roles.freeLegEnd-old.roles.freeLegStart)*u});}
 const b=leg.at(-1).p;
 for(let j=1;j<=128;j++){const a=alpha*(1-j/128),y=b[1]+R*(Math.sin(alpha)-Math.sin(a));leg.push({p:[b[0]-R*(Math.cos(a)-Math.cos(alpha)),y,zAt(y)],ref:old.roles.freeLegEnd+(old.roles.shoulder-old.roles.freeLegEnd)*j/128});}
 const legArc=[0];for(let j=1;j<leg.length;j++)legArc.push(legArc.at(-1)+distance(leg[j].p,leg[j-1].p));
 for(let j=1;j<leg.length;j++)nodes.push({...leg[j],ref:old.roles.freeLegStart+(old.roles.shoulder-old.roles.freeLegStart)*legArc[j]/legArc.at(-1)});
 for(let j=1;j<=256;j++){const a=Math.PI/2*j/256;nodes.push({p:[-W*Math.cos(a),end[1]+H*Math.sin(a),shoulderZ-D*Math.sin(a)],ref:old.roles.shoulder+(old.roles.crown-old.roles.shoulder)*j/256});}
 const arc=[0];for(let i=1;i<nodes.length;i++)arc.push(arc.at(-1)+distance(nodes[i].p,nodes[i-1].p));const count=Math.ceil(arc.at(-1)/r),left=[],refs=[];let k=1;
 for(let i=0;i<=count;i++){const target=arc.at(-1)*i/count;while(k<arc.length-1&&arc[k]<target)k++;const u=(target-arc[k-1])/(arc[k]-arc[k-1]);left.push(add(nodes[k-1].p,scale(subtract(nodes[k].p,nodes[k-1].p),u)));refs.push(nodes[k-1].ref+(nodes[k].ref-nodes[k-1].ref)*u);}
 const raw=left.map(p=>[...p]),stations=[0];for(let i=1;i<raw.length;i++)stations.push(stations.at(-1)+distance(raw[i],raw[i-1]));
 const courseCorner=[-.34+straight,sinkerY,back],cornerIndex=raw.reduce((best,p,i)=>distance(p,courseCorner)<distance(raw[best],courseCorner)?i:best,0);
 for(let j=1;j<left.length-1;j++){const shoulderWeight=rise(Math.max(0,1-Math.abs(raw[j][1]-end[1])/(3*r))),cornerWeight=rise(Math.max(0,1-Math.abs(stations[j]-stations[cornerIndex])/(3*r))),w=Math.max(shoulderWeight,cornerWeight),blendRadius=r,weights=raw.map((_,i)=>Math.exp(-(((stations[i]-stations[j])/blendRadius)**2)/2)),sum=weights.reduce((a,b)=>a+b,0);left[j]=raw[j].map((v,k)=>v+w*(raw.reduce((s,p,i)=>s+weights[i]*p[k],0)/sum-v));}
 const crown=left.length-1,guides=[...left,...left.slice(0,-1).reverse().map(p=>[-p[0],p[1],p[2]])],coordinates=[...refs,...refs.slice(0,-1).reverse()];
 // The shifted shared course crosses the old front terminal leg first.
 // Retain rear clearance there; do not reuse the opposite phase correction
 // of the former deep U entrance. This maps [back,front] to itself.
 for(const p of guides)if(p[1]<=frontY){const q=Math.max(0,Math.min(1,(p[2]-back)/depthSpan));p[2]-=2*r*q*(1-q);}
 const curve=createSpatialCurve({type:'catmull-rom',points:guides,unit:'mm'}).curve,canonical=old.roles;
 const nearest=ref=>refs.reduce((b,x,i)=>Math.abs(x-ref)<Math.abs(refs[b]-ref)?i:b,0),roles={...canonical,crown,entryStart:nearest(canonical.entryStart),entryEnd:nearest(canonical.entryEnd),freeLegStart:nearest(canonical.freeLegStart),freeLegEnd:nearest(canonical.freeLegEnd),shoulder:nearest(canonical.shoulder),anchorIndices:canonical.anchorIndices.map(nearest),phases:coordinates.map(x=>{const i=Math.min(canonical.phases.length-2,Math.floor(x)),u=x-i;return canonical.phases[i]*(1-u)+canonical.phases[i+1]*u;})};
 return {...old,guides,roles,plateRoles:canonical,plateRoleCoordinates:coordinates,guideTangents:guides.map((_,i)=>normalize(curve.derivative(i/(guides.length-1)))),design:{...old.design,width:W,front,back,headY:H,returnDepth:D,shoulderZ,sinkerY,neckY:neck[1],entryTurn:{spanX,spanY,turnDepth,frontY,analyticTurnRadius:turnRadius,projectedTurnHeight:spanY,actualSafety:'plated Catmull extrema',depthSpan:front-back},memberCount,holdCourses,shoulderY:end[1],entryDepthBack:back,defaultBow:{amplitude:bowAmplitude},legAngle:alpha*180/Math.PI,portalY:guides[crown][1]-.48*holdCourses,construction:'shared course turn from actual lowest retained shoulder, quarter-turn in XYZ, complete oblique leg, inclined return'}};
}
function createOrdinaryInterlockPrimitive(){return createSharedEntryPrimitive(1);}

return {createSharedEntryPrimitive,createOrdinaryInterlockPrimitive};
})();
const commonCells=(()=>{



const base=createOrdinaryInterlockPrimitive(),r=base.radiusMm,h=base.design.course,pitch=base.design.pitch;
const halfGap=r*1.36,gap=halfGap+.006,laneDepth=2*r+.006,sourceKey=c=>c.row+'/'+c.needle;
const rise=u=>{u=Math.max(0,Math.min(1,u));return u*u*u*(10+u*(-15+6*u));};
const curveOf=b=>createSpatialCurve({type:'catmull-rom',points:b.guides,unit:'mm'}).curve;
function jet(curve,index,offset=[0,0,0]){const N=curve.segments.length,p=curve.point(index/N),v=curve.derivative(index/N),i=Math.min(N-1,Math.floor(index)),u=index-i,s=curve.segments[i],a=s.derivative(0),b=s.derivative(.5),d=s.derivative(1),A=a.map((x,k)=>2*(d[k]+x-2*b[k])),B=a.map((x,k)=>d[k]-x-A[k]),acc=A.map((x,k)=>(2*x*u+B[k])*N*N);
 return {p:add(p,offset),d:v.map(x=>x/v[1]),dd:acc.map((x,k)=>(x*v[1]-v[k]*acc[1])/v[1]**3)};}
function bezier(a,b){const dx=Math.abs(b.p[0]-a.p[0]),handle=dx/(2*(Math.abs(a.d[0])+Math.abs(b.d[0]))+base.design.headY*(Math.abs(a.dd[0])+Math.abs(b.dd[0])));
 const P=[a.p,add(a.p,scale(a.d,handle)),add(add(a.p,scale(a.d,2*handle)),scale(a.dd,1.25*handle*handle)),add(add(b.p,scale(b.d,-2*handle)),scale(b.dd,1.25*handle*handle)),add(b.p,scale(b.d,-handle)),b.p];
 return u=>{let q=P.map(x=>[...x]);while(q.length>1)q=q.slice(1).map((p,j)=>add(scale(q[j],1-u),scale(p,u)));return q[0];};}
function completeLeg(a,b,spread=0,spreadEnd=b.p[1]){
 const length=b.p[1]-a.p[1],slope=b.p.map((v,k)=>(v-a.p[k])/length),curvature=Math.max(...a.dd.map(Math.abs),...b.dd.map(Math.abs)),support=Math.min(base.design.headY,length/3,Math.sqrt(r/Math.max(1e-12,curvature))),amplitude=Math.min(r/2,length/20);
 const spreadLength=spreadEnd-a.p[1];
 if(spread!==0&&!(spreadLength>0&&spreadEnd<=b.p[1]))throw Error('No positive source-owned carried-leg spread interval');
 const f=u=>u-6*u**3+8*u**4-3*u**5,g=u=>u*u*(1-u)**3/2;
 return t=>{const y=a.p[1]+length*t,p=add(a.p,scale(subtract(b.p,a.p),t)),u=(y-a.p[1])/support,v=(b.p[1]-y)/support;
  for(let k=0;k<3;k++){if(u<1)p[k]+=(a.d[k]-slope[k])*support*f(u)+a.dd[k]*support*support*g(u);if(v<1)p[k]-=(b.d[k]-slope[k])*support*f(v)-b.dd[k]*support*support*g(v);}
  p[0]-=amplitude*64*t**3*(1-t)**3;
  if(spread!==0){const s=(y-a.p[1])/spreadLength;if(s>0&&s<1)p[0]+=spread*64*s**3*(1-s)**3;}
  return p;
 };
}
function retainedCarryInterval(joint,cell){
 const terminalY=joint.capBase.guides[joint.terminal][1],earliest=(joint.releaseRow-cell.row-1)*h+terminalY-(joint.members.length-1)*gap,
  latestTurn=(joint.members.at(-1).row-cell.row)*h+joint.latestBirthTurnY,
  collapseSupport=Math.min(terminalY-joint.capBase.design.neckY,earliest-latestTurn-base.design.headY);
 if(!(collapseSupport>0))throw Error('No positive retained-depth collapse interval');
 return {terminalY,collapseSupport,collapseStart:earliest-collapseSupport};
}
function sharedOldDepth(joint,member,cell,end,a){
 const support=base.design.headY,spread=2*halfGap*.080/Math.hypot(.112,.080),{terminalY,collapseSupport,collapseStart}=retainedCarryInterval(joint,cell),
  baseEnd=jet(joint.capCurve,joint.terminal),f=u=>u-6*u**3+8*u**4-3*u**5,g=u=>u*u*(1-u)**3/2,
  raw=y=>{const q=y-((joint.releaseRow-cell.row-1)*h-member*gap),u=Math.max(0,Math.min(1,(q-(terminalY-support))/support)),collapse=rise((y-collapseStart)/collapseSupport);
   return base.design.front+(baseEnd.p[2]-base.design.front)*rise(u)-baseEnd.d[2]*support*f(1-u)+baseEnd.dd[2]*support*support*g(1-u)-member*laneDepth-member*spread*(1-collapse);};
 const initial=raw(a.p[1]);return y=>{const u=Math.max(0,Math.min(1,(y-a.p[1])/support));return raw(y)+(a.p[2]-initial)*(1-rise(u))+a.d[2]*support*f(u)+a.dd[2]*support*support*g(u);};
}
function jointPhase(joint,member,cell,y){
 const q=y-((joint.releaseRow-cell.row-1)*h-member*gap),b=joint.capBase,start=b.plateRoleCoordinates.findIndex(x=>x>=base.plateRoles.freeLegStart);
 if(q<=b.guides[start][1])return base.plateRoles.freeLegStart;
 let i=start;while(i<joint.terminal&&b.guides[i+1][1]<q)i++;const u=Math.max(0,Math.min(1,(q-b.guides[i][1])/(b.guides[i+1][1]-b.guides[i][1])));return b.plateRoleCoordinates[i]*(1-u)+b.plateRoleCoordinates[i+1]*u;
}
function appendResampled(nodes,left,refs,includeStart=false){const arc=[0];for(let i=1;i<nodes.length;i++)arc.push(arc.at(-1)+distance(nodes[i].p,nodes[i-1].p));const count=Math.ceil(arc.at(-1)/r);let k=1;
 for(let i=includeStart?0:1;i<count;i++){const target=arc.at(-1)*i/count;while(arc[k]<target)k++;const u=(target-arc[k-1])/(arc[k]-arc[k-1]);left.push(add(nodes[k-1].p,scale(subtract(nodes[k].p,nodes[k-1].p),u)));refs.push(nodes[k-1].ref+(nodes[k].ref-nodes[k-1].ref)*u);}}
function finish(left,refs,cell,extra={}){const crown=left.length-1,guides=[...left,...left.slice(0,-1).reverse().map(p=>[-p[0],p[1],p[2]])],coordinates=[...refs,...refs.slice(0,-1).reverse()],curve=createSpatialCurve({type:'catmull-rom',points:guides,unit:'mm'}).curve;
 const canonical=base.plateRoles,nearest=ref=>refs.reduce((b,x,i)=>Math.abs(x-ref)<Math.abs(refs[b]-ref)?i:b,0),roles={...base.roles,crown,entryStart:nearest(canonical.entryStart),entryEnd:nearest(canonical.entryEnd),freeLegStart:nearest(canonical.freeLegStart),freeLegEnd:nearest(canonical.freeLegEnd),shoulder:nearest(canonical.shoulder),anchorIndices:canonical.anchorIndices.map(nearest),phases:coordinates.map(x=>{const i=Math.min(canonical.phases.length-2,Math.floor(x)),u=x-i;return canonical.phases[i]*(1-u)+canonical.phases[i+1]*u;})};
 const shape={...base,guides,roles,plateRoles:canonical,plateRoleCoordinates:coordinates,origin:[cell.needle*pitch,cell.row*h,0],needle:cell.needle,tuck:cell.operation==='T',guideTangents:guides.map((_,i)=>normalize(curve.derivative(i/(guides.length-1)))),...extra};
 return {...shape,plated:[0,1].map(slot=>plateCell(shape,slot))};}
function createGroupEntry(memberCount,hold=1){return createSharedEntryPrimitive(memberCount,hold);}
function buildControls(cells,radius=.035){
 if(radius!==r)throw Error('Fixed display comparison radius');
 const source=new Map(cells.map(c=>[sourceKey(c),c])),jointMap=new Map(),rowCounts=new Map(),entries=new Map(),births=new Map();
 for(const cell of cells){rowCounts.set(cell.row,Math.max(rowCounts.get(cell.row)??1,Math.max(cell.incomingRowMemberCount??cell.incomingGroup?.length??1,cell.outgoingRowMemberCount??cell.releaseGroup?.length??1)));rowCounts.set(cell.releaseRow,Math.max(rowCounts.get(cell.releaseRow)??1,cell.releaseGroup?.length??1));}
 for(const [row,count] of rowCounts)entries.set(row,createGroupEntry(count));
 for(const cell of cells)if(cell.operation==='K')births.set(sourceKey(cell),createGroupEntry(rowCounts.get(cell.row),cell.releaseRow-cell.row));
 // One owner per real release. All old members and the new K consume this
 // shared entry and retained-cap context; open boundaries remain explicit.
 for(const cell of cells){const key=cell.releaseRow+'/'+cell.needle;if(jointMap.has(key))continue;
  const members=cell.releaseGroup?.length?cell.releaseGroup:[{row:cell.row,needle:cell.needle,operation:cell.operation}],releasing=source.get(key),count=members.length,entryBase=births.get(key)??entries.get(cell.releaseRow),capBase=entries.get(cell.releaseRow),terminal=Math.max(capBase.roles.freeLegStart+1,capBase.guides.findIndex(p=>p[1]>=capBase.design.shoulderY-capBase.design.headY)-1);
  const joint={key,releaseRow:cell.releaseRow,needle:cell.needle,members,releasing:releasing??null,releaseBoundary:cell.releaseBoundary??null,entryBase,entryCurve:curveOf(entryBase),capBase,capCurve:curveOf(capBase),terminal,
   entryContext:entryBase.guides.slice(0,entryBase.roles.freeLegStart+4),latestBirthTurnY:entries.get(members.at(-1).row).design.sinkerY+pitch/2-(base.design.B+.001+base.design.width)/2,caps:members.map((member,index)=>({member,index,offset:[0,-h-index*gap,-index*laneDepth]}))};jointMap.set(key,joint);
 }

 const output=new Map();
 for(const cell of cells){const joint=jointMap.get(cell.releaseRow+'/'+cell.needle),member=joint.members.findIndex(m=>m.row===cell.row),hold=cell.releaseRow-cell.row;if(member<0)throw Error('Source cell absent from its true release group');
  const outgoingCap=joint.caps[member],capBase=joint.capBase,terminal=cell.operation==='K'&&hold===1?Math.max(joint.terminal,joint.capBase.guides.findIndex(p=>p[1]>=joint.capBase.design.shoulderY-joint.capBase.design.returnDepth)-1):joint.terminal,capOffset=add([0,(cell.releaseRow-cell.row)*h,0],outgoingCap.offset),birth=births.get(sourceKey(cell))??entries.get(cell.row),origin=[cell.needle*pitch,cell.row*h,0];
  if(cell.operation==='K'&&hold===1&&member===0&&birth.design.memberCount===capBase.design.memberCount){const shape={...birth,origin,needle:cell.needle,releaseJointKey:joint.key};output.set(sourceKey(cell),{...shape,plated:[0,1].map(s=>plateCell(shape,s))});continue;}
  // DISPLAY lane allocation: separate held K/T bodies only while their depth
  // lanes remain distinct. This fraction is not a measured textile parameter.
  const {collapseStart}=retainedCarryInterval(joint,cell),spread=hold>1?(base.design.width-base.design.B)/(joint.members.length+1):0;
  const left=[],refs=[],end=jet(joint.capCurve,terminal,capOffset),refEnd=capBase.plateRoleCoordinates[terminal];
  if(cell.operation==='K'){
   const contextY=birth.design.portalY+birth.design.B,startIndex=Math.min(birth.roles.crown-1,birth.guides.findIndex(p=>p[1]>=contextY)+1),a=jet(curveOf(birth),startIndex),at=hold===1?bezier(a,end):completeLeg(a,end,-spread,collapseStart),refStart=birth.plateRoleCoordinates[startIndex];
   left.push(...birth.guides.slice(0,startIndex+1).map(p=>[...p]));refs.push(...birth.plateRoleCoordinates.slice(0,startIndex+1));
   const support=Math.min(base.design.headY,(end.p[1]-a.p[1])/3),depth=sharedOldDepth(joint,member,cell,end,a);
   appendResampled(Array.from({length:513},(_,j)=>{const p=at(j/512);if(hold>1)p[2]=depth(p[1]);const start=rise((p[1]-a.p[1])/support);return {p,ref:hold===1?refStart+(refEnd-refStart)*j/512:jointPhase(joint,member,cell,p[1])+(refStart-jointPhase(joint,member,cell,a.p[1]))*(1-start)};}),left,refs);
  }else if(cell.operation==='T'){
   const R=pitch/2-(base.design.B+.001+base.design.width)/2,sinkerY=birth.design.sinkerY,
    depthSpread=2*halfGap*.080/Math.hypot(.112,.080),bodyFront=base.design.front-member*(laneDepth+depthSpread),sharedBack=birth.design.back,
    turn={p:[-pitch/2+R,sinkerY+R,bodyFront],d:[0,1,0],dd:[-1/R,0,0]},refTurn=base.plateRoles.freeLegStart,nodes=[];
   for(let j=0;j<=256;j++){const u=j/256,a=Math.PI/2*u,y=sinkerY+R*(1-Math.cos(a));nodes.push({p:[-pitch/2+R*Math.sin(a),y,sharedBack+(bodyFront-sharedBack)*rise((y-sinkerY)/R)],ref:refTurn*u});}
   const at=completeLeg(turn,end,spread,collapseStart),depth=sharedOldDepth(joint,member,cell,end,turn);
   for(let j=1;j<=512;j++){const p=at(j/512);p[2]=depth(p[1]);nodes.push({p,ref:jointPhase(joint,member,cell,p[1])+(refTurn-jointPhase(joint,member,cell,turn.p[1]))*(1-rise((p[1]-turn.p[1])/base.design.headY))});}
   appendResampled(nodes,left,refs,true);
   // Local common-curve smoothing only where the actual T quarter meets its
   // complete carried leg. The support is measured in source arclength.
   const raw=left.map(p=>[...p]),stations=[0];for(let i=1;i<raw.length;i++)stations.push(stations.at(-1)+distance(raw[i],raw[i-1]));
   const corner=raw.reduce((best,p,i)=>distance(p,turn.p)<distance(raw[best],turn.p)?i:best,0);
   for(let j=1;j<left.length-2;j++){const w=rise(1-Math.abs(stations[j]-stations[corner])/(3*r));if(w===0)continue;const weights=raw.map((_,i)=>Math.exp(-(((stations[i]-stations[j])/r)**2)/2)),sum=weights.reduce((a,b)=>a+b,0);left[j]=raw[j].map((v,k)=>v+w*(raw.reduce((s,p,i)=>s+weights[i]*p[k],0)/sum-v));}

  }else throw Error('Unsupported retained source operation '+cell.operation);
  for(let i=terminal;i<=capBase.roles.crown;i++){left.push(add(capBase.guides[i],capOffset));refs.push(capBase.plateRoleCoordinates[i]);}
  output.set(sourceKey(cell),finish(left,refs,cell,{releaseJointKey:joint.key,member,hold}));
 }
 output.releaseJoints=jointMap;return output;
}

return buildControls;
})();
// Build the source-owned joint before either yarn is deformed for length.
// A T contributes another retained head; it never creates a K pull-through.
export function buildInterlockBaseLayouts(cells, radiusMm) {
  const source=new Map(cells.map(c=>[c.row+'/'+c.needle,c]));
  const incoming=new Map();
  for(const cell of cells) {
    if(!Number.isInteger(cell.releaseRow)||cell.releaseRow<=cell.row)
      throw new Error('A migrated forward release is required');
    if(!cell.releaseGroup?.some(member=>member.row===cell.row&&member.operation===cell.operation))
      throw new Error('Cell is absent from its complete CN release group');
    const key=cell.releaseRow+'/'+cell.needle;
    incoming.set(key,cell.releaseGroup);
    if(!source.has(key)&&!cell.releaseBoundary)
      throw new Error('Missing full-source releasing base '+key);
  }
  const contextual=cells.map(cell=>({...cell,
    incomingGroup:cell.incomingGroup??incoming.get(cell.row+'/'+cell.needle)??[]}));
  const layouts=commonCells(contextual,radiusMm),references=new Map();
  for(const cell of contextual) {
    const base=layouts.get(cell.row+'/'+cell.needle),key=cell.releaseRow+'/'+cell.needle;
    const memberIndex=cell.releaseGroup.findIndex(member=>member.row===cell.row);
    const joint=layouts.releaseJoints.get(key);
    if(!joint||joint.members[memberIndex].row!==cell.row)throw new Error('Missing joint owner');
    base.releaseStation={memberIndex,offset:[...joint.caps[memberIndex].offset]};
    base.releaseJoint=joint;
    base.roles={...base.roles};
    const roles=base.roles,last=base.guides.length-1;
    const half=new Set(roles.anchorIndices);
    // The owned cap's first Catmull cubic also uses the preceding carry
    // control. Preserve that support, not only the visible cap nodes.
    roles.capStart=roles.crown-(joint.capBase.roles.crown-joint.terminal);
    if(roles.capStart<1||roles.capStart>roles.crown)throw new Error('Invalid shared cap interval');
    for(let i=roles.capStart-1;i<=roles.crown;i++)half.add(i);
    for(let i=0;i<=roles.crown;i++) {
      // The final entrance cubic also depends on its next control. Protect
      // that context, rather than only its two endpoint controls.
      if(i<=roles.freeLegStart+3||i>=roles.freeLegEnd-2||Math.abs(i-roles.shoulder)<=2)half.add(i);
    }
    roles.protectedIndices=[...new Set([...half,...[...half].map(i=>last-i)])].sort((a,b)=>a-b);
    if(!references.has(key)) {
      const target=layouts.get(key);
      if(!target) {
        const ghost=createSharedEntryPrimitive(cell.releaseGroup.length);
        references.set(key,{sourceRow:cell.releaseRow,needle:cell.needle,
          sourceLayout:null,boundary:'OPEN_UPPER_SOURCE_EDGE',controls:ghost.guides,
          curve:createSpatialCurve({type:'catmull-rom',points:ghost.guides,unit:'mm'}).curve,
          ghostControls:0,startSegment:ghost.roles.entryStart,endSegment:ghost.roles.freeLegStart+2});
      } else {
        const points=target.guides.map(p=>[...p]);
        const left=layouts.get(cell.releaseRow+'/'+(cell.needle-1));
        const right=layouts.get(cell.releaseRow+'/'+(cell.needle+1));
        let ghostControls=0;
        if(left){points.unshift(add(left.guides.at(-2),[-columnPitch,0,0]));ghostControls=1;}
        if(right)points.push(add(right.guides[1],[columnPitch,0,0]));
        const actual=createSpatialCurve({type:'catmull-rom',points,unit:'mm'});
        if(actual.status!=='OK')throw new Error('Invalid actual common entry');
        references.set(key,{sourceRow:cell.releaseRow,needle:cell.needle,
          sourceLayout:target,boundary:null,controls:points,curve:actual.curve,ghostControls,
          startSegment:ghostControls+target.roles.entryStart,
          endSegment:ghostControls+target.roles.freeLegStart+2});
      }
    }
    base.releaseReference=references.get(key);
  }
  return layouts;
}

export function interlockCellControls(cell) {
  if(!cell.commonLayout)throw new Error('A complete CN common layout is required');
  return plateCell(cell.commonLayout,cell.yarnIndex);
}

export function buildInterlockReleaseLayout(cells,radiusMm,acceptsTubeLayout) {
  const layouts=buildInterlockBaseLayouts(cells,radiusMm);
  if(acceptsTubeLayout&&!acceptsTubeLayout(layouts))
    throw new Error('The source joint cannot retain a regular emitted tube: '+acceptsTubeLayout.lastFailure);
  return {cells:layouts,diagnostics:{method:'CN_SHARED_ACTUAL_ENTRY_AND_RETURN',
    lengthIndependent:true,cellCount:layouts.size,refinementSteps:0,
    stage:'GEOMETRY_REPAIR_VISUAL_REVIEW_PENDING',
    acceptance:'REQUIRES_EMITTED_TUBE_AND_FOUR_VIEW_AUDIT'}};
}

const {interlockExpansionOffsets,buildMonotoneLengthFamily,interlockCurvatureMaximum}=(()=>{
// Browser-pure deterministic length family. Display coordinates, no physical
// yarn-length closure. No neighbour is edited; frozen neighbours only bound
// the admissible amplitude of this yarn's own continuous clamped bend.


const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),scale=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),mag=a=>Math.hypot(...a),norm=a=>scale(a,1/mag(a));
const pad=(a,n)=>Array.from({length:n},(_,i)=>a[i]??0),polyAdd=(a,b)=>pad(a,Math.max(a.length,b.length)).map((v,i)=>v+(b[i]??0)),polyScale=(a,s)=>a.map(v=>v*s),mul=(a,b)=>a.reduce((s,v,i)=>polyAdd(s,[...Array(i).fill(0),...b.map(w=>v*w)]),[]),der=a=>a.slice(1).map((v,i)=>v*(i+1)),evalP=(a,x)=>a.reduceRight((s,v)=>s*x+v,0);
function roots(a){a=[...a];while(a.length>1&&Math.abs(a.at(-1))<1e-28)a.pop();const m=Math.max(...a.map(Math.abs));if(!m||a.length<2)return[];a=a.map(v=>v/m);if(a.length===2){const x=-a[0]/a[1];return x>=0&&x<=1?[x]:[];}const knots=[0,...roots(der(a)),1],out=knots.filter(x=>Math.abs(evalP(a,x))<1e-13);for(let i=1;i<knots.length;i++){let l=knots[i-1],h=knots[i],f=evalP(a,l),g=evalP(a,h);if(f*g>=0)continue;for(let j=0;j<56;j++){const m=(l+h)/2,q=evalP(a,m);if(q*f>0){l=m;f=q;}else h=m;}out.push((l+h)/2);}return out.sort((a,b)=>a-b).filter((x,i,a)=>!i||x-a[i-1]>1e-10);}
function curvatureMaximum(points,sourceCurve=null){const result=sourceCurve?{status:'OK',curve:sourceCurve}:createSpatialCurve({type:'catmull-rom',points,unit:'mm'});if(result.status!=='OK'||result.curve.regular===false)throw Error('A regular actual Catmull curve is required');const curve=result.curve;let worst={curvature:0};for(let i=0;i<curve.segments.length;i++){const c=curve.segments[i],a=c.derivative(0),b=c.derivative(.5),d=c.derivative(1),A=a.map((v,k)=>2*(d[k]+v-2*b[k])),B=a.map((v,k)=>d[k]-v-A[k]),v=a.map((x,k)=>[x,B[k],A[k]]),acc=v.map(der),cross=[polyAdd(mul(v[1],acc[2]),polyScale(mul(v[2],acc[1]),-1)),polyAdd(mul(v[2],acc[0]),polyScale(mul(v[0],acc[2]),-1)),polyAdd(mul(v[0],acc[1]),polyScale(mul(v[1],acc[0]),-1))],N=cross.reduce((a,p)=>polyAdd(a,mul(p,p)),[]),S=v.reduce((a,p)=>polyAdd(a,mul(p,p)),[]),F=polyAdd(mul(der(N),S),polyScale(mul(N,der(S)),-3));for(const u of [0,...roots(F),1]){const k=Math.sqrt(Math.max(0,evalP(N,u)))/evalP(S,u)**1.5;if(k>worst.curvature)worst={curvature:k,radius:1/k,segment:i,u,point:c.point(u)};}}return worst;}
const makeCurve=points=>createSpatialCurve({type:'catmull-rom',points,unit:'mm'}).curve;
function scalarSegments(w){const last=w.length-1,t=i=>i===0?w[1]-w[0]:i===last?w[last]-w[last-1]:(w[i+1]-w[i-1])/2;return w.slice(0,-1).map((p,i)=>{const q=w[i+1],a=3*(2*p-2*q+t(i)+t(i+1)),b=2*(-3*p+3*q-2*t(i)-t(i+1));return Object.assign(u=>a*u*u+b*u+t(i),{second:u=>2*a*u+b});});}
function simpson(f){const count=64;let sum=f(0)+f(1);for(let i=1;i<count;i++)sum+=(i%2?4:2)*f(i/count);return sum/(3*count);}
function deltaDerivatives(offsets){return [0,1,2].map(k=>scalarSegments(offsets.map(p=>p[k])));}
function derivativeLength(curve,D,amplitude){let sum=0;for(let i=0;i<curve.segments.length;i++){if(D.every(axis=>[0,.5,1].every(u=>axis[i](u)===0)))continue;sum+=simpson(u=>{const d=D.map(axis=>axis[i](u)),v=add(curve.segments[i].derivative(u),scale(d,amplitude));return dot(v,d)/mag(v);});}return sum;}
function pieces(curve,allowed=null){const result=[],n=16;curve.segments.forEach((s,index)=>{if(allowed&&!allowed.has(index))return;const a=s.derivative(0),b=s.derivative(.5),d=s.derivative(1),A=a.map((v,k)=>2*(d[k]+v-2*b[k])),B=a.map((v,k)=>d[k]-v-A[k]);for(let i=0;i<n;i++){const from=i/n,to=(i+1)/n,p=s.point(from),q=s.point(to),error=Math.max(mag(A.map((v,k)=>2*v*from+B[k])),mag(A.map((v,k)=>2*v*to+B[k])))/(8*n*n);result.push({p,q,index,from,to,error});}});return result;}
function actualClearanceBound(curve,affected,frozen,crown){
 const source=pieces(curve,affected);let best={lower:Infinity},samePathOppositeBranch={lower:Infinity};
 const contexts=[...frozen,{id:'SAME_PATH_OPPOSITE_BRANCH',curve,selfOpposite:true}];
 for(const other of contexts){const actual=other.curve??makeCurve(other.points);let included=other.segmentIndices?new Set(other.segmentIndices):null;
  if(other.excludeSegments){const excluded=new Set(other.excludeSegments);included=new Set((included?[...included]:actual.segments.map((_,i)=>i)).filter(i=>!excluded.has(i)));}
  const target=pieces(actual,included);for(const a of source)for(const b of target){
  if(other.selfOpposite&&(a.index<crown)===(b.index<crown))continue;
  const gap=(other.selfOpposite?samePathOppositeBranch.lower:best.lower)+a.error+b.error;
  if(a.p.some((v,k)=>Math.min(v,a.q[k])>Math.max(b.p[k],b.q[k])+gap||Math.max(v,a.q[k])<Math.min(b.p[k],b.q[k])-gap))continue;
  const d=segmentDistance(a.p,a.q,b.p,b.q),lower=d.distance-a.error-b.error;
  const record={lower,polylineDistance:d.distance,error:a.error+b.error,other:other.id,sourceSegment:a.index,otherSegment:b.index,first:d.first,second:d.second};
  if(other.selfOpposite&&lower<samePathOppositeBranch.lower)samePathOppositeBranch=record;
  if(lower<best.lower)best=record;
 }}return{...best,samePathOppositeBranch};
}
// Certify every amplitude in [fromAmplitude,toAmplitude], not only its end.
// Velocity is degree (t=2,A=1), v x a is degree (t=2,A=2). Their Bernstein
// coefficients bound the entire parameter/amplitude rectangle. A conservative
// unresolved rectangle fails the certificate; it is never treated as safe.
function certifyCurvatureInterval(curve,offsets,affected,fromAmplitude,toAmplitude,limit){
 const D=deltaDerivatives(offsets),cross=(v,a)=>[v[1]*a[2]-v[2]*a[1],v[2]*a[0]-v[0]*a[2],v[0]*a[1]-v[1]*a[0]];
 let boxes=0,maxCertifiedBound=0,failed=null;
 for(const index of affected){
  const segment=curve.segments[index],d0=segment.derivative(0),dm=segment.derivative(.5),d1=segment.derivative(1),AA=d0.map((v,k)=>2*(d1[k]+v-2*dm[k])),BB=d0.map((v,k)=>d1[k]-v-AA[k]);
  const velocity=(t,A)=>add(segment.derivative(t),scale(D.map(axis=>axis[index](t)),A));
  const acceleration=(t,A)=>add(AA.map((v,k)=>2*v*t+BB[k]),scale(D.map(axis=>axis[index].second(t)),A));
  const middle=(a,m,b)=>sub(scale(m,2),scale(add(a,b),.5));
  const stack=[[0,1,fromAmplitude,toAmplitude,0]];
  while(stack.length){const [lo,hi,lower,upper,depth]=stack.pop(),mid=(lo+hi)/2,am=(lower+upper)/2;boxes++;
   const V=[];for(const A of[lower,upper]){const p=velocity(lo,A),q=velocity(hi,A);V.push(p,middle(p,velocity(mid,A),q),q);}
   const minimum=[0,1,2].map(k=>Math.min(...V.map(v=>v[k]))-64*Number.EPSILON),maximum=[0,1,2].map(k=>Math.max(...V.map(v=>v[k]))+64*Number.EPSILON);
   const minimumSpeed=mag(minimum.map((v,k)=>v>0?v:maximum[k]<0?maximum[k]:0));
   const qt=[lower,am,upper].map(A=>{const p=cross(velocity(lo,A),acceleration(lo,A)),m=cross(velocity(mid,A),acceleration(mid,A)),q=cross(velocity(hi,A),acceleration(hi,A));return[p,middle(p,m,q),q];});
   const Q=[];for(let k=0;k<3;k++)Q.push(qt[0][k],middle(qt[0][k],qt[1][k],qt[2][k]),qt[2][k]);
   const bound=minimumSpeed>0?(Math.max(...Q.map(mag))+128*Number.EPSILON)/minimumSpeed**3:Infinity;
   if(bound<=limit){maxCertifiedBound=Math.max(maxCertifiedBound,bound);continue;}
   if(depth>=18){failed={index,parameter:[lo,hi],amplitude:[lower,upper],bound,limit};return{passed:false,boxes,maxCertifiedBound,failed};}
   const tVariation=mag(sub(velocity(lo,am),velocity(hi,am))),aVariation=mag(sub(velocity(mid,lower),velocity(mid,upper)));
   if((tVariation>=aVariation&&hi-lo>1e-8)||upper-lower<1e-12){stack.push([lo,mid,lower,upper,depth+1],[mid,hi,lower,upper,depth+1]);}
   else stack.push([lo,hi,lower,am,depth+1],[lo,hi,am,upper,depth+1]);
  }
 }
 return{passed:true,boxes,maxCertifiedBound,failed:null};
}
// Dimensionless unit-amplitude basis, not the former unbounded gain scale.
// The factory applies a display-coordinate amplitude after certification.
// The C2 mother bump does not claim every Catmull anchor tangent is fixed:
// unchanged entry/shoulder cubics are those with all four protected supports.
function interlockExpansionOffsets(points,roles,{details=false,sourceCurve=null}={}){
 const last=points.length-1,anchors=[...roles.protectedIndices].sort((a,b)=>a-b),curve=sourceCurve??makeCurve(points),offsets=points.map(()=>[0,0,0]),spans=[];
 for(let k=1;k<anchors.length;k++){const a=anchors[k-1],b=anchors[k];if(b-a<=1)continue;const arc=[0];for(let i=a+1;i<=b;i++)arc.push(arc.at(-1)+mag(sub(points[i],points[i-1])));const w=points.map(()=>0);for(let i=a+1;i<b;i++){const u=arc[i-a]/arc.at(-1);w[i]=64*u**3*(1-u)**3;}const dw=scalarSegments(w),gradient=[0,1,2].map(axis=>curve.segments.reduce((sum,s,i)=>sum+simpson(u=>s.derivative(u)[axis]/mag(s.derivative(u))*dw[i](u)),0));const chord=norm(sub(points[b],points[a])),projected=sub(gradient,scale(chord,dot(gradient,chord)));if(mag(projected)<1e-10)throw Error('No default free-bend reserve: fixed straight anchors cannot supply a two-sided length response');const n=norm(projected);for(let i=a+1;i<b;i++)offsets[i]=scale(n,w[i]);spans.push({a,b,freeControls:b-a-1,spanLength:arc.at(-1),firstVariation:dot(gradient,n),direction:n});}
 if(!spans.length)throw Error('No unlocked free bend remains between the actual protected cubic supports');
 return details?{offsets,spans}:offsets;
}
// Build lazily only when ratio != 1, and cache against the immutable source
// geometry plus its frozen context. atRatio performs no search or relayout.
function buildMonotoneLengthFamily(points,roles,{radius=.035,frozen=[],sourceCurve=null}={}){
 if(!frozen.length)throw Error('Frozen actual neighbouring yarn context is required for a length amplitude budget');
 points=points.map(p=>[...p]);
 const last=points.length-1,curve=sourceCurve??makeCurve(points);
 if(curve.segments.length!==last)throw Error('sourceCurve must contain the actual cell segments in canonical direction, with row neighbour context retained');
 const {offsets,spans}=interlockExpansionOffsets(points,roles,{details:true,sourceCurve:curve});
 const D=deltaDerivatives(offsets),changed=A=>points.map((p,i)=>add(p,scale(offsets[i],A))),base=curvatureMaximum(points,curve);
 if(!(base.curvature*radius<1))throw Error('Base curve already exceeds circular-tube curvature budget');
 const affected=new Set();for(let i=0;i<last;i++)if([i-1,i,i+1,i+2].some(j=>j>=0&&j<=last&&mag(offsets[j])>0))affected.add(i);
 // Preserve half of the measured base curvature reserve. This is a display
 // safety policy, not a measured physical property or a new contact solve.
 const curvatureLimit=(base.curvature+1/radius)/2;
 const certifies=(sign,A)=>certifyCurvatureInterval(curve,offsets,affected,sign<0?-A:0,sign>0?A:0,curvatureLimit).passed;
 const bound=sign=>{if(certifies(sign,radius))return radius;let lo=0,hi=radius;for(let i=0;i<28;i++){const m=(lo+hi)/2;if(certifies(sign,m))lo=m;else hi=m;}return lo;};
 let positive=bound(1),negative=bound(-1);
 // L(A)=sum integral |v0+A v1| is convex. Its derivative is monotone;
 // never cross its unique minimum on the shortening branch.
 let shorteningMinimum=null;if(derivativeLength(curve,D,-radius)<0){let lo=-radius,hi=0;for(let i=0;i<48;i++){const m=(lo+hi)/2;if(derivativeLength(curve,D,m)<0)lo=m;else hi=m;}shorteningMinimum=(lo+hi)/2;negative=Math.min(negative,-shorteningMinimum);}
 const clearance=frozen.length?actualClearanceBound(curve,affected,frozen,roles.crown):null;
 // Catmull is a cubic Bezier on each segment; its offset norm is bounded by
 // the four Bezier-control norms. A frozen curve cannot approach faster than
 // that displacement. Retain half the independently bounded surface gap.
 const tangent=i=>i===0?sub(offsets[1],offsets[0]):i===last?sub(offsets[last],offsets[last-1]):scale(sub(offsets[i+1],offsets[i-1]),.5);
 let displacementBound=0;for(const i of affected)for(const p of[offsets[i],add(offsets[i],scale(tangent(i),1/3)),sub(offsets[i+1],scale(tangent(i+1),1/3)),offsets[i+1]])displacementBound=Math.max(displacementBound,mag(p));
 if(clearance){if(!(clearance.lower>2*radius))throw Error('Frozen neighbour already violates the free-bend clearance bound');const cap=(clearance.lower-2*radius)/(2*displacementBound);positive=Math.min(positive,cap);negative=Math.min(negative,cap);}
 const curvatureCertificate={positive:certifyCurvatureInterval(curve,offsets,affected,0,positive,curvatureLimit),negative:certifyCurvatureInterval(curve,offsets,affected,-negative,0,curvatureLimit)};
 curvatureCertificate.passed=curvatureCertificate.positive.passed&&curvatureCertificate.negative.passed;
 if(!curvatureCertificate.passed)throw Error('Signed curvature intervals are not certified: '+JSON.stringify(curvatureCertificate));
 return{points,roles,offsets,spans,curvatureCertificate,clearancePolicy:'Each mutable region spends at most half the frozen base surface gap. This also covers same-path opposite branches and two adjacent cells edited together.',positiveLimit:positive,negativeLimit:negative,shorteningMinimum,baseCurvature:base,curvatureLimit,clearance,displacementBound,radius,
  atRatio(ratio){if(!(ratio>0))throw Error('Positive relative yarn length required');const drive=3*radius*Math.log(ratio),limit=drive>=0?positive:negative,A=drive===0?0:limit*Math.tanh(drive/limit);const output=A===0?points.map(p=>[...p]):changed(A);return{amplitude:A,points:output};}};
}

return {interlockExpansionOffsets,buildMonotoneLengthFamily,interlockCurvatureMaximum:curvatureMaximum};
})();
export {interlockExpansionOffsets,interlockCurvatureMaximum};
const getLengthControls=(()=>{
// Runtime adapter for the existing source-owned base cache. No length edit
// changes a neighbour or runs the common geometric construction again.


const contexts=new WeakMap();
const bbox=segments=>{
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const s of segments){const a=s.point(0),b=s.point(1),u=s.derivative(0),v=s.derivative(1);
  for(const p of[a,a.map((x,k)=>x+u[k]/3),b.map((x,k)=>x-v[k]/3),b])p.forEach((x,k)=>{min[k]=Math.min(min[k],x);max[k]=Math.max(max[k],x);});}
 return{min,max};
};
const boxDistance=(a,b)=>Math.hypot(...[0,1,2].map(k=>Math.max(0,a.min[k]-b.max[k],b.min[k]-a.max[k])));
function restrict(curve,start,end){
 const segments=curve.segments.slice(start,end),count=segments.length;
 const evaluate=(method,t)=>{const i=Math.min(count-1,Math.floor(t*count)),value=segments[i][method](t*count-i);return method==='point'?value:value.map(v=>v*count);};
 return{...curve,segments,point:t=>evaluate('point',t),derivative:t=>evaluate('derivative',t)};
}
function makeContext(layouts,plate){
 const rows=new Map();
 for(const [key,base]of layouts){const [row,needle]=key.split('/').map(Number);if(!rows.has(row))rows.set(row,[]);rows.get(row).push({key,base,needle});}
 const paths=[],owners=new Map();
 for(const [row,cells]of rows){cells.sort((a,b)=>a.needle-b.needle);
  for(const slot of[0,1]){
   const controls=[],ranges=[];
   for(const {key,base}of cells){const points=plate(base,slot),start=controls.length?controls.length-1:0;
    if(controls.length&&Math.hypot(...controls.at(-1).map((v,k)=>v-points[0][k]))>1e-8)throw Error('Length context has a broken source join');
    controls.push(...(controls.length?points.slice(1):points));ranges.push({key,start,end:controls.length-1,points,base});}
   const created=createSpatialCurve({type:'catmull-rom',points:controls,unit:'mm'});
   if(created.status!=='OK')throw Error('Invalid complete source row in length context');
   const record={id:row+'/'+slot,row,slot,curve:created.curve,bounds:bbox(created.curve.segments)};
   paths.push(record);
   for(const range of ranges)owners.set(range.key+'/'+slot,{...range,path:record,family:null});
  }
 }
 return{paths,owners};
}
function getLengthControls(layouts,key,slot,ratio,plate,radius=.035){
 const base=layouts.get(key);
 if(ratio===null||ratio===1)return{points:plate(base,slot),amplitude:0};
 if(!contexts.has(layouts))contexts.set(layouts,makeContext(layouts,plate));
 const context=contexts.get(layouts),owner=context.owners.get(key+'/'+slot);
 if(!owner)throw Error('Length edit has no actual source owner');
 if(!owner.family){
  const sourceCurve=restrict(owner.path.curve,owner.start,owner.end),bounds=bbox(sourceCurve.segments);
  // Unit basis controls have norm <= 1, but a Catmull cubic's Bezier
  // controls can reach 1 + (1 + 1) / 6 = 4/3. Each family's amplitude
  // is <= r, so two mutable curves can approach by at most 8r/3.
  // A frozen hull gap > 2r + 8r/3 = 14r/3 therefore cannot become a
  // two-radius collision. The 4r cutoff would incorrectly omit context.
  const contextReach=(2+2*4/3)*radius;
  const frozen=context.paths.filter(path=>boxDistance(bounds,path.bounds)<=contextReach+1e-10).map(path=>({
   id:path.id,curve:path.curve,...(path===owner.path?{excludeSegments:new Set(Array.from({length:owner.end-owner.start},(_,i)=>owner.start+i))}:{})
  })).filter(path=>path.excludeSegments?.size!==path.curve.segments.length);
  owner.family=buildMonotoneLengthFamily(owner.points,base.roles,{radius,frozen,sourceCurve});
 }
 return owner.family.atRatio(ratio);
}

return getLengthControls;
})();
export function interlockLengthControls(layouts,key,slot,ratio,radiusMm) { return getLengthControls(layouts,key,slot,ratio,plateCell,radiusMm).points; }
