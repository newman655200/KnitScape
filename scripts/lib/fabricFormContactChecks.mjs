import assert from "node:assert/strict";

export async function runContactChecks() {
  const api = await import("../../src/fabricForm/yarnContact.js").catch(() => null);
  assert.ok(api, "M3 requires the contact module");
  const { parallelContactEnergy, contactKernel, segmentDistance, integrateSegmentContact } = api;
  const d_e = Math.sqrt(80 / (Math.PI * 1310)) / Math.sqrt(0.5);
  const params = { d_e, r_c: d_e / 2, phi0: 0.5, K: 0.01, E_f: 3000 };
  let maxAbelError = 0, maxDerivativeError = 0, maxParallelDerivativeError = 0;
  for (const ratio of [0.55, 0.65, 0.75, 0.85, 0.95]) {
    const r = ratio * d_e, h = d_e * 1e-6;
    const force=params.K*params.E_f*((params.phi0*d_e/r)**3-params.phi0**3)*d_e;
    const eDerivative=(parallelContactEnergy(r+h,params)-parallelContactEnergy(r-h,params))/(2*h);
    maxParallelDerivativeError=Math.max(maxParallelDerivativeError,Math.abs(eDerivative/(-force)-1));
    const derivative = (contactKernel(r+h, params).energy-contactKernel(r-h, params).energy)/(2*h);
    maxDerivativeError = Math.max(maxDerivativeError, Math.abs(derivative/contactKernel(r, params).derivative-1));
    const extent = Math.sqrt(d_e*d_e-r*r), N=10000;
    let sum=0;
    for(let i=0;i<=N;i++) sum+=(i===0||i===N?1:i%2?4:2)*contactKernel(Math.hypot(r,extent*i/N),params).energy;
    const integral=2*sum*extent/(3*N), exact=parallelContactEnergy(r,params);
    maxAbelError=Math.max(maxAbelError,Math.abs(integral/exact-1));
  }
  assert.ok(maxAbelError<1e-6, `Abel error ${maxAbelError}`);
  assert.ok(maxDerivativeError<1e-6, `kernel derivative ${maxDerivativeError}`);
  assert.ok(maxParallelDerivativeError<1e-6,`e derivative = -force: ${maxParallelDerivativeError}`);
  const distance=segmentDistance([0,0,0],[1,0,0],[.5,-1,.2],[.5,1,.2]);
  assert.ok(Math.abs(distance.distance-.2)<1e-14);
  const nearParallel=segmentDistance([0,0,0],[.125,0,0],[0,params.r_c+3e-9,0],[.125,params.r_c-3e-9,0]);
  assert.ok(nearParallel.distance<params.r_c,"near-parallel approaching endpoint must not be missed");
  const interior=segmentDistance([0,0,0],[1,0,0],[0,-1e-9,.1],[1,1e-9,.1]);
  assert.ok(Math.abs(interior.s-.5)<1e-9 && Math.abs(interior.t-.5)<1e-9,"near-parallel interior closest points");
  const points=[[0,0,0],[.125,.01,0],[.03,.15,.01],[.155,.14,.02]];
  const evaluated=integrateSegmentContact(...points,params,12);
  let maxGradientError=0;
  for(let i=0;i<4;i++) for(let k=0;k<3;k++) {
    const hi=points.map(x=>x.slice()),lo=points.map(x=>x.slice()),h=1e-6;
    hi[i][k]+=h;lo[i][k]-=h;
    const fd=(integrateSegmentContact(...hi,params,20).energy-integrateSegmentContact(...lo,params,20).energy)/(2*h);
    const exact=evaluated.gradient[i][k];
    maxGradientError=Math.max(maxGradientError,Math.abs(fd-exact)/Math.max(1e-8,Math.abs(fd),Math.abs(exact)));
  }
  assert.ok(maxGradientError<1e-5,`segment integral gradient ${maxGradientError}`);
  const cases=[];
  for(const N of [12,24,48,96]) for(const phase of [0,.25,.5]) for(const ratio of [.55,.65,.75,.85,.95]) {
    const L=3,h=L/N,r=ratio*d_e;
    let sum=0,derivative=0;
    // Translation invariance: one segment against the expanded other straight yarn.
    const imageSegments=Math.ceil(d_e/h)+2;
    for(let j=-imageSegments;j<=imageSegments;j++) {
      const value=integrateSegmentContact([0,0,0],[h,0,0],[(j+phase)*h,r,0],[(j+phase+1)*h,r,0],params,8);
      sum+=value.energy;derivative+=value.gradient[2][1]+value.gradient[3][1];
    }
    const error=sum/h/parallelContactEnergy(r,params)-1;
    const force=params.K*params.E_f*((params.phi0*d_e/r)**3-params.phi0**3)*d_e;
    cases.push({N,phase,ratio,error,forceError:derivative/h/(-force)-1});
  }
  const maxSegmentError=Math.max(...cases.map(x=>Math.abs(x.error)));
  assert.ok(maxSegmentError<1e-3,`support-split parallel integral ${maxSegmentError}`);
  const maxForceError=Math.max(...cases.map(x=>Math.abs(x.forceError)));
  assert.ok(maxForceError<1e-3,`support-split parallel force ${maxForceError}`);
  return {maxAbelError,maxDerivativeError,maxParallelDerivativeError,maxGradientError,maxSegmentError,maxForceError,cases};
}
