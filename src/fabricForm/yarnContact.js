// Units: mm, N. The parallel-yarn model and Abel kernel are defined in T1 §3.
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const norm=a=>Math.hypot(...a);
const at=(a,u,t)=>[a[0]+t*u[0],a[1]+t*u[1],a[2]+t*u[2]];
const clamp=x=>Math.max(0,Math.min(1,x));
const quadratureCache=new Map();

export function gaussLegendre(order) {
  if(!Number.isInteger(order)||order<2||order>64) throw new RangeError("quadrature order must be 2..64");
  if(quadratureCache.has(order)) return quadratureCache.get(order);
  const nodes=[];
  for(let i=1;i<=order;i++) {
    let z=Math.cos(Math.PI*(i-.25)/(order+.5)),derivative;
    for(let iteration=0;iteration<40;iteration++) {
      let p0=1,p1=z;
      for(let j=2;j<=order;j++){const p=((2*j-1)*z*p1-(j-1)*p0)/j;p0=p1;p1=p;}
      derivative=order*(z*p1-p0)/(z*z-1);
      const step=p1/derivative;z-=step;if(Math.abs(step)<1e-15) break;
    }
    nodes.push([z,2/((1-z*z)*derivative*derivative)]);
  }
  quadratureCache.set(order,nodes);
  return nodes;
}

export function parallelContactEnergy(r,p) {
  const D=p.d_e;
  if(r>=D) return 0;
  if(!(r>0)) return Infinity;
  return p.K*p.E_f*p.phi0**3*D*(D**3/2*(1/r**2-1/D**2)-(D-r));
}

export function contactKernel(r,p) {
  const D=p.d_e;
  if(r>=D) return {energy:0,derivative:0};
  if(!(r>0)) return {energy:Infinity,derivative:-Infinity};
  const s=Math.sqrt(Math.max(0,D*D-r*r)),angle=Math.acos(Math.min(1,r/D));
  const factor=p.K*p.E_f*p.phi0**3*D/Math.PI;
  return {
    energy:Math.max(0,factor*(D**3*(s/(2*r*r*D*D)+angle/(2*r**3))-Math.acosh(D/r))),
    derivative:-factor*3*D/(2*r**4)*(r*s+D*D*angle),
  };
}

// Closest points on two closed segments; the envelope gradient uses s/t below.
export function segmentDistance(a,b,c,d) {
  const u=sub(b,a),v=sub(d,c),w=sub(a,c),uu=dot(u,u),vv=dot(v,v),uv=dot(u,v),uw=dot(u,w),vw=dot(v,w);
  const candidates=[[0,vv>0?clamp(vw/vv):0],[1,vv>0?clamp((uv+vw)/vv):0],
    [uu>0?clamp(-uw/uu):0,0],[uu>0?clamp((uv-uw)/uu):0,1]];
  // Cross-product denominator avoids cancellation for almost parallel lines.
  const normal=cross(u,v),denominator=dot(normal,normal);
  if(denominator>0) {
    const s=dot(cross(v,w),normal)/denominator,t=dot(cross(u,w),normal)/denominator;
    if(s>=0&&s<=1&&t>=0&&t<=1) candidates.unshift([s,t]);
  }
  let best;
  for(const [s,t] of candidates) {
    const difference=sub(at(a,u,s),at(c,v,t)),distance=norm(difference);
    if(!best||distance<best.distance) best={distance,s,t,difference};
  }
  return best;
}

function roots(a,b,c) {
  if(Math.abs(a)<1e-26) return Math.abs(b)<1e-26?[]:[-c/b];
  const disc=b*b-4*a*c;
  if(disc<=0) return [];
  const r=Math.sqrt(disc);
  return [(-b-r)/(2*a),(-b+r)/(2*a)];
}

export function integrateSegmentContact(a,b,c,d,p,order=12) {
  return integrateRadialSegments(a,b,c,d,p.d_e,r=>contactKernel(r,p),order,p.d_e/4);
}

// This consistent double-line energy is numerical protection, not a substitute
// for trajectory-wide CCD: the integral alone does not prove nonintersection.
export function integrateSegmentBarrier(a,b,c,d,p,order=12) {
  const width=.1*(p.d_e-p.r_c),support=p.r_c+width;
  const distance=segmentDistance(a,b,c,d).distance,gap=distance-p.r_c;
  if(gap<=0) return {energy:Infinity,gradient:Array.from({length:4},()=>[NaN,NaN,NaN])};
  if(distance>=support) return {energy:0,gradient:Array.from({length:4},()=>[0,0,0])};
  const factor=p.K*p.E_f/p.d_e;
  const kernel=r=>{
    const g=r-p.r_c;
    if(g>=width) return {energy:0,derivative:0};
    const delta=g-width,log=Math.log(g/width);
    return {energy:-factor*delta*delta*log,
      derivative:factor*(-2*delta*log-delta*delta/g)};
  };
  // Resolve the narrow activation band and the shorter near-compaction scale.
  const resolution=Math.min(width/2,Math.sqrt(gap*(2*p.r_c+gap))/2);
  return integrateRadialSegments(a,b,c,d,support,kernel,order,resolution);
}

// Clip both curve parameters to radial support; both kernels vanish at its
// boundary, so moving integration limits contribute no boundary force.
function integrateRadialSegments(a,b,c,d,D,kernelAt,order,resolution) {
  const gradient=Array.from({length:4},()=>[0,0,0]);
  const result={energy:0,gradient};
  const u=sub(b,a),v=sub(d,c),w=sub(a,c),lu=norm(u),lv=norm(v);
  if(!(lu>0&&lv>0)) throw new RangeError("contact segments must have positive length");
  if(segmentDistance(a,b,c,d).distance>=D) return result;
  const uu=dot(u,u),vv=dot(v,v),uv=dot(u,v),wv=dot(w,v),wu=dot(w,u),ww=dot(w,w);
  const breaks=[0,1];
  const push=(A,B,C)=>{for(const x of roots(A,B,C))if(x>0&&x<1)breaks.push(x);};
  push(uu,2*wu,ww-D*D);
  const wd=sub(w,v);push(uu,2*dot(wd,u),dot(wd,wd)-D*D);
  push(uu-uv*uv/vv,2*(wu-wv*uv/vv),ww-wv*wv/vv-D*D);
  breaks.sort((x,y)=>x-y);
  // Long segments still need spatial resolution after support clipping.
  const supportBreaks=breaks.slice();
  for(let i=1;i<supportBreaks.length;i++) {
    const low=supportBreaks[i-1],high=supportBreaks[i];
    const pieces=Math.ceil((high-low)*lu/(2*resolution));
    for(let j=1;j<pieces;j++) breaks.push(low+(high-low)*j/pieces);
  }
  breaks.sort((x,y)=>x-y);
  const quad=gaussLegendre(order);
  for(let part=1;part<breaks.length;part++) {
    const left=breaks[part-1],right=breaks[part],half=(right-left)/2,mid=(left+right)/2;
    if(half<1e-14) continue;
    for(const [xi,wi] of quad) {
      // Sine maps regularize the square-root kernel derivative at support ends.
      const s=mid+half*Math.sin(Math.PI*xi/2),sw=half*Math.PI/2*Math.cos(Math.PI*xi/2);
      const delta=at(w,u,s),projection=dot(delta,v)/vv;
      const radial2=dot(delta,delta)-dot(delta,v)**2/vv;
      if(radial2>=D*D) continue;
      const radius=Math.sqrt(Math.max(0,(D*D-radial2)/vv));
      const low=Math.max(0,projection-radius),high=Math.min(1,projection+radius);
      if(high<=low) continue;
      const tParts=Math.max(1,Math.ceil((high-low)*lv/resolution));
      for(let ti=0;ti<tParts;ti++) {
      const tleft=low+(high-low)*ti/tParts,tright=low+(high-low)*(ti+1)/tParts;
      const thalf=(tright-tleft)/2,tmid=(tleft+tright)/2;
      for(const [xj,wj] of quad) {
        const t=tmid+thalf*Math.sin(Math.PI*xj/2),tw=thalf*Math.PI/2*Math.cos(Math.PI*xj/2);
        const relative=sub(delta,v.map(x=>x*t)),r=norm(relative);
        const kernel=kernelAt(r),weight=sw*tw*wi*wj*lu*lv;
        result.energy+=weight*kernel.energy;
        const factor=weight*kernel.derivative/r;
        for(let k=0;k<3;k++) {
          const f=factor*relative[k];
          gradient[0][k]+=(1-s)*f;gradient[1][k]+=s*f;
          gradient[2][k]-=(1-t)*f;gradient[3][k]-=t*f;
        }
      }
      }
    }
  }
  // ds dt is physical arc length, not the unit-square parameter measure.
  for(let k=0;k<3;k++) {
    const du=result.energy*u[k]/uu,dv=result.energy*v[k]/vv;
    gradient[0][k]-=du;gradient[1][k]+=du;
    gradient[2][k]-=dv;gradient[3][k]+=dv;
  }
  return result;
}
