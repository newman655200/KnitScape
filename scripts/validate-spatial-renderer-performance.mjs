import assert from "node:assert/strict";
import {createYarnSpatialPreviewRenderer} from "../src/simulation/yarnSpatialPreviewRenderer.js";
function environment() {
  const listeners = new Map(), buffers = new Set(), textures = new Set(), programs = new Set(), shaders = new Set(), raf = new Map();
  const draws = [], uploads = [], uniforms = new Map(), calls = []; let nextFrame = 0, bound = null;
  const gl = Object.fromEntries(["VERTEX_SHADER", "FRAGMENT_SHADER", "COMPILE_STATUS", "LINK_STATUS", "ARRAY_BUFFER", "ELEMENT_ARRAY_BUFFER", "STATIC_DRAW", "FLOAT", "UNSIGNED_SHORT", "UNSIGNED_INT", "TRIANGLES", "DEPTH_TEST", "CULL_FACE", "BACK", "CCW", "LEQUAL", "BLEND", "MAX_RENDERBUFFER_SIZE", "MAX_TEXTURE_SIZE", "TEXTURE_2D", "RGBA", "UNSIGNED_BYTE", "TEXTURE_WRAP_S", "TEXTURE_WRAP_T", "CLAMP_TO_EDGE", "TEXTURE_MIN_FILTER", "TEXTURE_MAG_FILTER", "LINEAR", "TEXTURE0", "TEXTURE1", "UNPACK_FLIP_Y_WEBGL", "UNPACK_PREMULTIPLY_ALPHA_WEBGL", "UNPACK_COLORSPACE_CONVERSION_WEBGL", "NONE"].map((key, i) => [key, i + 1]));
  Object.assign(gl, { NO_ERROR: 0, COLOR_BUFFER_BIT: 0x4000, DEPTH_BUFFER_BIT: 0x100, lost: false,
    getExtension: () => null, isContextLost: () => gl.lost,
    getParameter: () => 8192, getError: () => 0,
    createShader() { const item = {}; shaders.add(item); return item; }, deleteShader(item) { assert.ok(shaders.delete(item)); },
    createProgram() { const item = {}; programs.add(item); return item; }, deleteProgram(item) { assert.ok(programs.delete(item)); },
    createBuffer() { const item = {}; buffers.add(item); return item; }, deleteBuffer(item) { assert.ok(buffers.delete(item)); },
    bindBuffer(target, item) { bound = item; }, bufferData(target, data) { uploads.push({ buffer: bound, data: Array.from(data) }); },
    createTexture() { const item = {}; textures.add(item); return item; }, deleteTexture(item) { assert.ok(textures.delete(item)); },
    getShaderParameter: () => true, getProgramParameter: () => true,
    getAttribLocation: (_, key) => ["a_position", "a_normal", "a_tangent", "a_uv"].indexOf(key), getUniformLocation: (_, key) => key,
    uniformMatrix4fv(key, _, data) { uniforms.set(key, Array.from(data)); }, uniform3fv(key, data) { uniforms.set(key, Array.from(data)); },
    uniform1f(key, value) { uniforms.set(key, value); }, uniform1i(key, value) { uniforms.set(key, value); },
    drawElements() { draws.push({ color: [...uniforms.get("u_color")], view: [...uniforms.get("u_view")], projection: [...uniforms.get("u_projection")], indices: bound }); },
  });
  for (const method of ["bindTexture", "activeTexture", "texImage2D", "texParameteri", "pixelStorei", "shaderSource", "compileShader", "attachShader", "linkProgram", "useProgram", "enableVertexAttribArray", "vertexAttribPointer", "enable", "disable", "depthMask", "depthFunc", "clearDepth", "frontFace", "cullFace", "clearColor", "clear", "viewport"]) gl[method] = (...args) => calls.push([method, ...args]);
  const win = { devicePixelRatio: 1, requestAnimationFrame(fn) { raf.set(++nextFrame, fn); return nextFrame; }, cancelAnimationFrame(id) { raf.delete(id); }, addEventListener() {}, removeEventListener() {}, ResizeObserver: class { observe() {} disconnect() {} } };
  const canvas = { style: {}, setAttribute() {}, addEventListener(key, fn) { listeners.set(key, fn); }, removeEventListener(key) { listeners.delete(key); }, getContext: () => gl, remove() { container.childElementCount = 0; }, focus() {} };
  const container = { clientWidth: 640, clientHeight: 400, childElementCount: 0, ownerDocument: { defaultView: win, createElement: () => canvas }, appendChild() { this.childElementCount++; } };
  return { gl, draws, uploads, calls, buffers, programs, textures, shaders, listeners, container, raf,
    flush() { const pending = [...raf.values()]; raf.clear(); pending.forEach(fn => fn()); },
    lose() { gl.lost = true; listeners.get("webglcontextlost")({ preventDefault() {} }); buffers.clear(); programs.clear(); textures.clear(); shaders.clear(); },
    restore() { gl.lost = false; listeners.get("webglcontextrestored")(); } };
}
const triangle = z => ({ status: "OK", unit: "mm", positions: [0, 0, z, 1, 0, z, 0, 1, z], normals: [0,0,1, 0,0,1, 0,0,1], tangents: [1,0,0, 1,0,0, 1,0,0], uv: [0,0, 1,0, 0,1], indices: [0,1,2], bounds: { min: [0,0,z], max: [1,1,z] } });


const env=environment(), renderer=createYarnSpatialPreviewRenderer();
renderer.mount(env.container); renderer.update({geometry:triangle(0),fit:true});renderer.render();
assert.equal(typeof renderer.profileOrbit,"function","explicit opt-in profiler is required");
const original=renderer.view; const pending=renderer.profileOrbit({frames:8});
for(let i=0;i<10;i++)env.flush();
const result=await pending;
assert.equal(result.status,"OK");assert.equal(result.frames,8);assert.equal(result.gpu.status,"UNAVAILABLE");
assert.equal(result.gpu.samples,0);assert.equal(result.drawCalls,1);assert.equal(result.triangleCount,1);
assert.deepEqual(renderer.view,original,"profile restores original view");
assert.equal(env.uploads.length,5,"profile does not upload unchanged geometry");
const cancelled=renderer.profileOrbit({frames:8});renderer.update({geometry:null});
assert.equal((await cancelled).status,"CANCELLED");
renderer.update({geometry:triangle(0),fit:true});renderer.render();
const interrupted=renderer.profileOrbit({frames:8});renderer.setView({yaw:0.7});
assert.equal((await interrupted).status,"CANCELLED","user camera changes cancel profiling instead of fighting the user");
assert.equal(renderer.view.yaw,0.7);
renderer.dispose();assert.equal(env.buffers.size,0);
// GPU timings are supplied only by completed, non-disjoint queries, never CPU time.
for (const disjoint of [false,true]) {
  const gpuEnv=environment(), queries=new Set();let active=null;
  const ext={TIME_ELAPSED_EXT:100,QUERY_RESULT_AVAILABLE_EXT:101,QUERY_RESULT_EXT:102,GPU_DISJOINT_EXT:103,
    createQueryEXT(){const q={};queries.add(q);return q;},beginQueryEXT(_,q){assert.equal(active,null);active=q;},
    endQueryEXT(){assert.ok(active);active=null;},getQueryObjectEXT(_,key){return key===101?true:2500000;},
    deleteQueryEXT(q){assert.ok(queries.delete(q));}};
  gpuEnv.gl.getExtension=name=>name==='EXT_disjoint_timer_query'?ext:null;
  gpuEnv.gl.getParameter=key=>key===103?disjoint:8192;
  const r=createYarnSpatialPreviewRenderer();r.mount(gpuEnv.container);r.update({geometry:triangle(0),fit:true});r.render();
  const done=r.profileOrbit({frames:8});for(let i=0;i<12;i++)gpuEnv.flush();const value=await done;
  assert.equal(value.gpu.status,disjoint?'DISJOINT_DISCARDED':'AVAILABLE');
  assert.equal(value.gpu.samples,disjoint?0:8);assert.equal(value.gpu.mean,disjoint?null:2.5);
  assert.equal(queries.size,0);r.dispose();
}
// Lossless batches reduce submission while retaining each source mesh's index range.
const batchEnv=environment(), batched=createYarnSpatialPreviewRenderer();batched.mount(batchEnv.container);
const sources=Array.from({length:600},(_,i)=>({id:`occurrence-${i}`,geometry:triangle(i/100)}));
batched.update({scene:sources,fit:true});batched.render();
assert.equal(batched.getDiagnostics().drawCalls,1,"compatible source meshes share one draw");
assert.equal(batched.getDiagnostics().meshCount,600);assert.equal(batched.getDiagnostics().triangleCount,600);
const ranges=batched.getSourceRanges();assert.equal(ranges.length,600);
for(let i=0;i<600;i++){
  assert.equal(ranges[i].id,sources[i].id);assert.equal(ranges[i].indexOffset,i*3);assert.equal(ranges[i].indexCount,3);
}
assert.deepEqual(batchEnv.uploads[4].data,Array.from({length:1800},(_,i)=>i),"offset indices preserve every triangle");
for(const [i,name] of ["positions","normals","tangents","uv"].entries()) {
  assert.deepEqual(batchEnv.uploads[i].data, sources.flatMap(s=>Array.from(new Float32Array(s.geometry[name]))),`all original ${name} retained bit-exactly`);
}
const originalUploads=batchEnv.uploads.length;batched.setView({yaw:1});batched.render();assert.equal(batchEnv.uploads.length,originalUploads);
batched.update({scene:[sources[21]]});batched.render();assert.equal(batched.getDiagnostics().meshCount,1);
assert.equal(batched.getSourceRanges()[0].id,"occurrence-21","selection still maps to the original ID");
assert.equal(batched.getDiagnostics().geometryCacheMisses,600);assert.equal(batched.getDiagnostics().geometryCacheHits,1,"filtering reuses validated immutable source geometry");
const twelve=triangle(0);for(const name of ["positions","normals","tangents","uv"])twelve[name]=Array(4).fill(twelve[name]).flat();
twelve.indices=Array.from({length:12},(_,i)=>i);
batched.update({scene:Array.from({length:6000},(_,i)=>({id:`large-${i}`,geometry:twelve}))});batched.render();
assert.equal(batched.getDiagnostics().drawCalls,2,"72,000 vertices split into 16-bit chunks without requiring Uint32");
assert.equal(batched.getDiagnostics().triangleCount,24000);assert.equal(batched.getSourceRanges().length,6000);
assert.equal(batched.getDiagnostics().bufferBytes,72000*44+72000*2);
batched.dispose();assert.equal(batchEnv.buffers.size,0);
const orderEnv=environment(), ordered=createYarnSpatialPreviewRenderer();ordered.mount(orderEnv.container);
const tieScene=[{id:"red-a",geometry:triangle(0),material:{color:[1,0,0]}},{id:"blue",geometry:triangle(0),material:{color:[0,0,1]}},{id:"red-b",geometry:triangle(0),material:{color:[1,0,0]}}];
ordered.update({scene:tieScene});ordered.render();
assert.deepEqual(orderEnv.draws.map(d=>d.color),[[1,0,0],[0,0,1],[1,0,0]],"default batching preserves LEQUAL equal-depth source order");
ordered.update({batchOrder:"material"});ordered.render();
assert.equal(ordered.getDiagnostics().drawCalls,2,"material reordering is explicit opt-in");
assert.deepEqual(ordered.getSourceRanges().map(r=>r.id),["red-a","red-b","blue"]);
assert.equal(ordered.update({batchOrder:"unknown"}).status,"INVALID");
ordered.dispose();
console.log("PASS spatial profiler and lossless material batches");
