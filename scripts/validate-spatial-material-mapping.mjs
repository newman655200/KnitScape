import assert from "node:assert/strict";
import fs from "node:fs";
import { buildSpatialPath } from "../src/simulation/yarnSpatialPath.js";
import { buildParallelTransportFrames } from "../src/simulation/yarnParallelTransport.js";
import { buildYarnTubeGeometry } from "../src/simulation/yarnTubeGeometry.js";

// Synthetic geometry in mm. This checks the existing surface/texture convention,
// not a measured yarn radius, calibrated image scale, or material normal map.
const ok = result => { assert.equal(result.status, "OK", JSON.stringify(result.diagnostics)); return result; };
const vec = (array, index, size = 3) => Array.from(array.slice(index * size, (index + 1) * size));
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = v => v.map(x => x / Math.hypot(...v));
const near = (a, b, epsilon = 2e-6) => assert.ok(Math.abs(a-b) <= epsilon, `${a} != ${b}`);
const cases = [
  {name:"circular-line", curve:{type:"line",unit:"mm",points:[[0,0,0],[0,0,8]]}, samples:9, a:.2,b:.2},
  {name:"elliptical-line", curve:{type:"line",unit:"mm",points:[[0,0,0],[0,0,8]]}, samples:9, a:.2,b:.1},
  {name:"helix", curve:{type:"helix",unit:"mm",radius:3,pitch:2,turns:1}, samples:129, a:.1,b:.08},
];
const metrics = [];
for (const item of cases) {
  const path = ok(buildSpatialPath(item.curve, {sampleCount:item.samples}));
  const frames = ok(buildParallelTransportFrames(path));
  const mesh = ok(buildYarnTubeGeometry({path,frames,radiusA:item.a,radiusB:item.b,radialSegments:32,uvRepeatLength:2}));
  const stride = mesh.counts.radialSegments+1;
  let minHandedness = 1, maxHandedness = -1, maxTangentNormalDot = 0;
  for (let ring=0; ring<mesh.counts.rings; ring++) {
    const first=ring*stride, last=first+stride-1;
    for (const attribute of ["positions","normals","tangents"]) {
      assert.deepEqual(vec(mesh[attribute],first),vec(mesh[attribute],last),`${item.name}: circumference seam ${attribute}`);
    }
    assert.equal(mesh.uv[first*2+1],0); assert.equal(mesh.uv[last*2+1],1);
    near(mesh.uv[first*2],path.cumulativeLengths[ring]/2);
    for (let j=1; j<stride-1; j++) {
      const index=first+j, n=unit(vec(mesh.normals,index)), t=unit(vec(mesh.tangents,index));
      const increasingV=unit(sub(vec(mesh.positions,index+1),vec(mesh.positions,index-1)));
      const alignment=dot(unit(cross(n,t)),increasingV);
      minHandedness=Math.min(minHandedness,alignment);maxHandedness=Math.max(maxHandedness,alignment);
      maxTangentNormalDot=Math.max(maxTangentNormalDot,Math.abs(dot(n,t)));
      assert.ok(alignment < -.99,"side tube +V is opposite cross(N,T); do not assume positive tangent-space handedness");
      near(dot(n,t),0);
      assert.ok(mesh.uv[index*2+1]>mesh.uv[(index-1)*2+1],"circumference coordinates increase monotonically");
    }
  }
  metrics.push({name:item.name,vertices:mesh.counts.vertices,minHandedness,maxHandedness,maxTangentNormalDot});
}

const path=ok(buildSpatialPath(cases[0].curve,{sampleCount:9}));
const capped=ok(buildYarnTubeGeometry({path,frames:ok(buildParallelTransportFrames(path)),radiusA:.2,radialSegments:32,uvRepeatLength:2,capEnds:true}));
const sideCount=capped.counts.rings*33;
const capSigns=[];
for (const end of [0,1]) {
  const base=sideCount+end*34, n=vec(capped.normals,base),t=vec(capped.tangents,base);
  // Recover cap +V from its center to the UV=(.5,1) ring vertex.
  const vDirection=unit(sub(vec(capped.positions,base+8),vec(capped.positions,base+33)));
  const sign=dot(unit(cross(n,t)),vDirection);capSigns.push(sign);
  near(sign,end?1:-1);
}

const source=fs.readFileSync(new URL("../src/simulation/yarnSpatialPreviewRenderer.js",import.meta.url),"utf8");
const shader=source.match(/const FRAGMENT_SHADER = `([\s\S]*?)`;/)?.[1];
assert.ok(shader,"existing spatial shader remains the material owner");
assert.match(shader,/srgbToLinear\(texel\.rgb\)/,"BaseColor receives explicit sRGB decoding");
assert.match(shader,/value \/ 12\.92/); assert.match(shader,/0\.055/); assert.match(shader,/2\.4/);
assert.match(shader,/roughness = clamp\(texture2D\(u_roughnessMap, scanUv\)\.r, 0\.08, 1\.0\)/,"roughness uses linear R without colour decoding");
assert.doesNotMatch(shader,/sampler2D\s+u_(normal|height|ambientOcclusion|metallic)/,"unsupported maps cannot silently influence shading");
assert.match(source,/Scan TBN axis\/handedness is unverified/);

// Evaluate the actual scalar UV expression used by the shader. No copied
// alternate production mapper is introduced merely to make this test pass.
const expression=shader.match(/vec2 scanUv = (.*);/)?.[1];
assert.ok(expression);
const map=new Function("v_uv","fract","abs","vec2",`return ${expression};`);
const sample=(u,v,axis="x")=>{
  const result=map({x:u,y:v},x=>x-Math.floor(x),Math.abs,(a,b)=>[a,b]);
  return axis==="y"?[result[1],result[0]]:result;
};
assert.match(shader,/if \(u_scanAxisY == 1\) scanUv = scanUv\.yx/);
for (const axis of ["x","y"]) {
  for (const u of [-1.25,0,.125,.9,7.75]) {
    assert.deepEqual(sample(u,0,axis),sample(u,1,axis),"circumference seam samples match");
    assert.deepEqual(sample(u,.125,axis),sample(u,.875,axis),"opposite halves are intentionally mirrored");
    sample(u,.25,axis).forEach((value,i)=>near(value,sample(u+1,.25,axis)[i],1e-14));
  }
}
const epsilon=1e-5;
const derivative=v=>(sample(.25,v+epsilon)[1]-sample(.25,v-epsilon)[1])/(2*epsilon);
near(derivative(.25),2,1e-9);near(derivative(.75),-2,1e-9);
assert.notDeepEqual(sample(1-epsilon,.2),sample(1+epsilon,.2),"longitudinal repeat crosses image edges, whose colours are not guaranteed seamless");

console.log(JSON.stringify({status:"PASS",validator:"spatial-material-mapping",geometry:metrics,capHandedness:capSigns,
  transverseDerivative:[derivative(.25),derivative(.75)],normalMap:"UNSUPPORTED: side handedness -1; cap ends differ; mirrored half reverses; image scan axis/convention uncalibrated",
  baseColor:"sRGB decoding after RGBA8 filtering: visual approximation, not linear-light texture filtering",
  roughness:"linear R clamped .08..1",physicalScale:"NOT_CALIBRATED",gpuPixels:"Separate real-browser acceptance required"},null,2));
