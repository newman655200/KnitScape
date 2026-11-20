import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { createServer } from "vite";
import { createServer as createHttpServer } from "node:http";
const server = await createServer({ configFile:false, logLevel:"silent", cacheDir:path.join(os.tmpdir(),"knitscape-validation","spatial-pbr-renderer"), server:{middlewareMode:true,hmr:{server:createHttpServer()}} });
let loaded = 0;
let imageWidth = 4, imageHeight = 2;
const pendingImages = [];
let holdImages = false;
globalThis.Image = class {
  naturalWidth = imageWidth; naturalHeight = imageHeight; width = imageWidth; height = imageHeight;
  set src(value) { loaded++; const finish = () => this.onload?.(); if (holdImages) pendingImages.push(finish); else queueMicrotask(finish); }
  removeAttribute() {}
};
try {
const { createYarnSpatialPreviewRenderer } = await server.ssrLoadModule("/src/simulation/yarnSpatialPreviewRenderer.js");
const { yarnAssetRegistry } = await server.ssrLoadModule("/src/yarnTexture/yarnAssetRegistry.js");
function environment() {
  const listeners = new Map(), buffers = new Set(), textures = new Set(), programs = new Set(), shaders = new Set(), raf = new Map();
  const draws = [], uploads = [], uniforms = new Map(), calls = []; let nextFrame = 0, bound = null;
  const gl = Object.fromEntries(["VERTEX_SHADER", "FRAGMENT_SHADER", "COMPILE_STATUS", "LINK_STATUS", "ARRAY_BUFFER", "ELEMENT_ARRAY_BUFFER", "STATIC_DRAW", "FLOAT", "UNSIGNED_SHORT", "UNSIGNED_INT", "TRIANGLES", "DEPTH_TEST", "CULL_FACE", "BACK", "CCW", "LEQUAL", "BLEND", "MAX_RENDERBUFFER_SIZE", "MAX_TEXTURE_SIZE", "TEXTURE_2D", "RGBA", "UNSIGNED_BYTE", "TEXTURE_WRAP_S", "TEXTURE_WRAP_T", "CLAMP_TO_EDGE", "TEXTURE_MIN_FILTER", "TEXTURE_MAG_FILTER", "LINEAR", "TEXTURE0", "TEXTURE1", "LINEAR_MIPMAP_LINEAR", "UNPACK_FLIP_Y_WEBGL", "UNPACK_PREMULTIPLY_ALPHA_WEBGL", "UNPACK_COLORSPACE_CONVERSION_WEBGL", "NONE"].map((key, i) => [key, i + 1]));
  Object.assign(gl, { NO_ERROR: 0, COLOR_BUFFER_BIT: 0x4000, DEPTH_BUFFER_BIT: 0x100, lost: false,
    getExtension: () => ({ loseContext() { gl.lost = true; } }), isContextLost: () => gl.lost,
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
  for (const method of ["generateMipmap", "bindTexture", "activeTexture", "texImage2D", "texParameteri", "pixelStorei", "shaderSource", "compileShader", "attachShader", "linkProgram", "useProgram", "enableVertexAttribArray", "vertexAttribPointer", "enable", "disable", "depthMask", "depthFunc", "clearDepth", "frontFace", "cullFace", "clearColor", "clear", "viewport"]) gl[method] = (...args) => calls.push([method, ...args]);
  const win = { devicePixelRatio: 1, requestAnimationFrame(fn) { raf.set(++nextFrame, fn); return nextFrame; }, cancelAnimationFrame(id) { raf.delete(id); }, addEventListener() {}, removeEventListener() {}, ResizeObserver: class { observe() {} disconnect() {} } };
  const canvas = { style: {}, setAttribute() {}, addEventListener(key, fn) { listeners.set(key, fn); }, removeEventListener(key) { listeners.delete(key); }, getContext: () => gl, remove() { container.childElementCount = 0; }, focus() {} };
  const container = { clientWidth: 640, clientHeight: 400, childElementCount: 0, ownerDocument: { defaultView: win, createElement: () => canvas }, appendChild() { this.childElementCount++; } };
  return { gl, draws, uploads, calls, buffers, programs, textures, shaders, listeners, container, raf,
    flush() { const pending = [...raf.values()]; raf.clear(); pending.forEach(fn => fn()); },
    lose() { gl.lost = true; listeners.get("webglcontextlost")({ preventDefault() {} }); buffers.clear(); programs.clear(); textures.clear(); shaders.clear(); },
    restore() { gl.lost = false; listeners.get("webglcontextrestored")(); } };
}
const triangle = z => ({ status: "OK", unit: "mm", positions: [0, 0, z, 1, 0, z, 0, 1, z], normals: [0,0,1, 0,0,1, 0,0,1], tangents: [1,0,0, 1,0,0, 1,0,0], uv: [0,0, 1,0, 0,1], indices: [0,1,2], bounds: { min: [0,0,z], max: [1,1,z] } });

const env = environment(), renderer = createYarnSpatialPreviewRenderer();
renderer.mount(env.container);
assert.equal(typeof renderer.ready, "function", "Round9 awaits PBR preparation");
const ref = () => ({assetRef:yarnAssetRegistry.register(new Blob(["image bytes"], {type:"image/png"})),fileName:"test.png"});
const baseColor=ref(), roughness=ref(), unsupported=ref();
const pbr={baseColor,roughness,normal:unsupported,height:unsupported,ambientOcclusion:unsupported,metallic:unsupported};
const scene=[{id:"main",geometry:triangle(0),material:{pbr,color:[.2,.3,.4],scanAxis:"x"}}, {id:"second",geometry:triangle(2),material:{pbr,color:[.8,.3,.1],scanAxis:"y"}}];
renderer.update({scene,fit:true}); await renderer.ready(); env.flush();
assert.equal(renderer.status.status,"OK");
assert.equal(loaded,2,"only supported BaseColor/Roughness decode; shared material assets decode once");
assert.equal(env.textures.size,2,"same PBR sources share this renderer's GPU textures");
const diag=renderer.getDiagnostics();
assert.equal(diag.meshCount,2); assert.equal(diag.drawCalls,2); assert.equal(diag.triangleCount,2);
assert.equal(diag.textureCount,2); assert.equal(diag.textureLevel0Bytes,4*2*4*2); assert.equal(diag.bufferCount,10);
assert.ok(diag.bufferBytes>0); assert.equal(diag.materials.length,2);
assert.equal(diag.materials[0].channels.baseColor.status,"SUPPORTED_VISUAL");
assert.deepEqual(diag.materials[0].channels.baseColor.dimensions,[4,2]);
assert.equal(diag.materials[0].channels.baseColor.colorSpace,"sRGB -> linear");
assert.equal(diag.materials[0].channels.roughness.colorSpace,"linear scalar R");
for (const channel of ["normal","height","ambientOcclusion"]) assert.equal(diag.materials[0].channels[channel].status,"UNSUPPORTED");
assert.equal(diag.materials[0].channels.metallic.value,0);
assert.match(diag.materials[0].mapping.status,/VISUAL_ASSUMPTION/);
assert.ok(env.calls.some(c=>c[0]==="pixelStorei"&&c[1]===env.gl.UNPACK_COLORSPACE_CONVERSION_WEBGL&&c[2]===env.gl.NONE));
const fragment=env.calls.find(c=>c[0]==="shaderSource"&&c[2].includes("lambdaGGX"))[2];
assert.match(fragment,/srgbToLinear/); assert.match(fragment,/texture2D\(u_roughnessMap/);
assert.match(fragment,/fract\(/,"explicit repeat works for non-power-of-two images");
assert.equal(env.calls.filter(c=>c[0]==="generateMipmap").length,2,"POT maps generate minification mipmaps once");
assert.ok(env.calls.some(c=>c[0]==="texParameteri"&&c[2]===env.gl.TEXTURE_MIN_FILTER&&c[3]===env.gl.LINEAR_MIPMAP_LINEAR));
assert.equal(diag.textureBytes,(4*2+2*1+1)*4*2,"memory includes every mip level");
const uploads=env.uploads.length, textures=env.textures.size;
renderer.setView({yaw:Math.PI}); renderer.render(); assert.equal(env.uploads.length,uploads); assert.equal(env.textures.size,textures);
const textureUploads=env.calls.filter(c=>c[0]==="texImage2D").length;
renderer.update({scene:[scene[0]]});await renderer.ready();
assert.equal(env.calls.filter(c=>c[0]==="texImage2D").length,textureUploads,"filtering retains the same GPU texture sources");
renderer.update({scene});await renderer.ready();
env.lose();env.restore();await renderer.ready();env.flush();assert.equal(env.textures.size,2,"context restoration reuploads retained source images");
renderer.update({scene:Array.from({length:600},(_,i)=>({id:`mesh-${i}`,geometry:triangle(i/100)}))});await renderer.ready();renderer.render();
assert.equal(renderer.getDiagnostics().meshCount,600,"full-window scenes exceed legacy 256 diagnostic limit");
assert.equal(renderer.getDiagnostics().drawCalls,1,"600 compatible source meshes batch without losing source identity");
assert.equal(renderer.getSourceRanges().length,600);assert.equal(new Set(renderer.getSourceRanges().map(range=>range.id)).size,600);
assert.equal(env.textures.size,0,"replacing PBR scene releases owned GPU textures");
const oldScene=[{id:"held",geometry:triangle(0),material:{pbr:{baseColor:ref()}}}]; holdImages=true;
renderer.update({scene:oldScene});const waiting=renderer.ready();await new Promise(resolve=>setTimeout(resolve,20));renderer.update({scene:[]});pendingImages.splice(0).forEach(fn=>fn());await waiting;
assert.equal(renderer.status.status,"EMPTY");assert.equal(renderer.getDiagnostics().textureCount,0,"late image completion cannot resurrect cleared scene");
holdImages=false;renderer.update({scene:[{id:"broken",geometry:triangle(0),material:{pbr:{baseColor:{assetRef:"missing-ref"}}}}]});await renderer.ready();
assert.equal(renderer.status.status,"UNAVAILABLE"); assert.equal(renderer.getDiagnostics().meshCount,0,"asynchronous PBR failure clears swatch");assert.equal(env.buffers.size,0);
renderer.update({scene});await renderer.ready();renderer.render();assert.equal(renderer.status.status,"OK","valid replacement recovers failure");
imageWidth=3;imageHeight=5;
const priorMips=env.calls.filter(c=>c[0]==="generateMipmap").length;
renderer.update({scene:[{id:"npot",geometry:triangle(0),material:{pbr:{baseColor:ref()}}}]});await renderer.ready();
assert.equal(env.calls.filter(c=>c[0]==="generateMipmap").length,priorMips,"NPOT remains complete without illegal WebGL1 mip generation");
assert.equal(renderer.getDiagnostics().textureBytes,3*5*4);assert.deepEqual(renderer.getDiagnostics().textureMipLevels,[1]);
renderer.dispose();assert.equal(env.buffers.size+env.programs.size+env.textures.size,0);assert.equal(renderer.getDiagnostics().textureBytes,0);
yarnAssetRegistry.clear();
console.log(JSON.stringify({status:"PASS",checks:["supported channels and metadata","shared asset decode/GPU ownership","sRGB/linear shader sampling","scene size and GPU stats","orbit without geometry upload","context restore","stale async cancellation","failed material clears scene","disposal"],limitation:"Recording GL and synthetic image boundary; real PBR pixels and interaction FPS require browser verification."},null,2));
} finally { delete globalThis.Image; await server.close(); }
