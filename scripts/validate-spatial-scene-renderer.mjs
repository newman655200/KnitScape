import assert from "node:assert/strict";
import { createYarnSpatialPreviewRenderer } from "../src/simulation/yarnSpatialPreviewRenderer.js";

// Recording boundary tests resource ownership and draw commands, not browser pixels.
function environment() {
  const listeners = new Map(), buffers = new Set(), programs = new Set(), shaders = new Set(), raf = new Map();
  const draws = [], uploads = [], uniforms = new Map(), calls = []; let nextFrame = 0, bound = null;
  const gl = Object.fromEntries(["VERTEX_SHADER", "FRAGMENT_SHADER", "COMPILE_STATUS", "LINK_STATUS", "ARRAY_BUFFER", "ELEMENT_ARRAY_BUFFER", "STATIC_DRAW", "FLOAT", "UNSIGNED_SHORT", "UNSIGNED_INT", "TRIANGLES", "DEPTH_TEST", "CULL_FACE", "BACK", "CCW", "LEQUAL", "BLEND", "MAX_RENDERBUFFER_SIZE"].map((key, i) => [key, i + 1]));
  Object.assign(gl, { NO_ERROR: 0, COLOR_BUFFER_BIT: 0x4000, DEPTH_BUFFER_BIT: 0x100, lost: false,
    getExtension: () => ({ loseContext() { gl.lost = true; } }), isContextLost: () => gl.lost,
    getParameter: () => 8192, getError: () => 0,
    createShader() { const item = {}; shaders.add(item); return item; }, deleteShader(item) { assert.ok(shaders.delete(item)); },
    createProgram() { const item = {}; programs.add(item); return item; }, deleteProgram(item) { assert.ok(programs.delete(item)); },
    createBuffer() { const item = {}; buffers.add(item); return item; }, deleteBuffer(item) { assert.ok(buffers.delete(item)); },
    bindBuffer(target, item) { bound = item; }, bufferData(target, data) { uploads.push({ buffer: bound, data: Array.from(data) }); },
    getShaderParameter: () => true, getProgramParameter: () => true,
    getAttribLocation: (_, key) => ["a_position", "a_normal", "a_tangent", "a_uv"].indexOf(key), getUniformLocation: (_, key) => key,
    uniformMatrix4fv(key, _, data) { uniforms.set(key, Array.from(data)); }, uniform3fv(key, data) { uniforms.set(key, Array.from(data)); },
    uniform1f(key, value) { uniforms.set(key, value); }, uniform1i(key, value) { uniforms.set(key, value); },
    drawElements() { draws.push({ color: [...uniforms.get("u_color")], view: [...uniforms.get("u_view")], projection: [...uniforms.get("u_projection")], indices: bound }); },
  });
  for (const method of ["shaderSource", "compileShader", "attachShader", "linkProgram", "useProgram", "enableVertexAttribArray", "vertexAttribPointer", "enable", "disable", "depthMask", "depthFunc", "clearDepth", "frontFace", "cullFace", "clearColor", "clear", "viewport"]) gl[method] = (...args) => calls.push([method, ...args]);
  const win = { devicePixelRatio: 1, requestAnimationFrame(fn) { raf.set(++nextFrame, fn); return nextFrame; }, cancelAnimationFrame(id) { raf.delete(id); }, addEventListener() {}, removeEventListener() {}, ResizeObserver: class { observe() {} disconnect() {} } };
  const canvas = { style: {}, setAttribute() {}, addEventListener(key, fn) { listeners.set(key, fn); }, removeEventListener(key) { listeners.delete(key); }, getContext: () => gl, remove() { container.childElementCount = 0; }, focus() {} };
  const container = { clientWidth: 640, clientHeight: 400, childElementCount: 0, ownerDocument: { defaultView: win, createElement: () => canvas }, appendChild() { this.childElementCount++; } };
  return { gl, draws, uploads, calls, buffers, programs, shaders, listeners, container, raf,
    flush() { const pending = [...raf.values()]; raf.clear(); pending.forEach(fn => fn()); },
    lose() { gl.lost = true; listeners.get("webglcontextlost")({ preventDefault() {} }); buffers.clear(); programs.clear(); shaders.clear(); },
    restore() { gl.lost = false; listeners.get("webglcontextrestored")(); } };
}
const triangle = z => ({ status: "OK", unit: "mm", positions: [0, 0, z, 1, 0, z, 0, 1, z], normals: [0,0,1, 0,0,1, 0,0,1], tangents: [1,0,0, 1,0,0, 1,0,0], uv: [0,0, 1,0, 0,1], indices: [0,1,2], bounds: { min: [0,0,z], max: [1,1,z] } });
const scene = [{ id: "main", geometry: triangle(0), material: { color: [1,0,0] } }, { id: "spandex", geometry: triangle(2), material: { color: [0,1,0] } }];
const env = environment(), renderer = createYarnSpatialPreviewRenderer(); renderer.mount(env.container);
assert.equal(renderer.update({ scene, fit: true }).status, "OK", "a multi-mesh scene is accepted"); env.flush();
assert.equal(env.draws.length, 2, "both independent meshes draw in one frame");
assert.deepEqual(env.draws.map(item => item.color), [[1,0,0], [0,1,0]]);
assert.deepEqual(env.draws[0].view, env.draws[1].view); assert.deepEqual(env.draws[0].projection, env.draws[1].projection);
assert.equal(env.buffers.size, 10); assert.equal(env.programs.size, 1); assert.notEqual(env.draws[0].indices, env.draws[1].indices);
assert.ok(env.calls.some(call => call[0] === "enable" && call[1] === env.gl.DEPTH_TEST));
const uploads = env.uploads.length; renderer.update({ scene }); renderer.setView({ yaw: .5 }); env.flush(); assert.equal(env.uploads.length, uploads);
const originalView = renderer.view;
for (const invalid of [
  [{ ...scene[0], geometry: { ...scene[0].geometry, positions: [NaN,0,0] } }],
  [scene[0], { ...scene[1], id: "main" }],
  [scene[0], { ...scene[1], geometry: { ...scene[1].geometry, unit: "cm" } }],
  [scene[0], { ...scene[1], material: { color: [NaN,0,0] } }],
]) {
  assert.equal(renderer.update({ scene: invalid, view: { yaw: 1.5 } }).status, "INVALID"); assert.deepEqual(renderer.view, originalView);
  const before = env.draws.length; renderer.render(); assert.equal(env.draws.length - before, 2, "invalid update atomically retains both prior meshes"); assert.equal(env.buffers.size, 10);
}
assert.equal(renderer.update({ scene, geometry: scene[0].geometry }).status, "INVALID", "ambiguous scene/geometry rejected");
renderer.update({ scene: [] }); env.flush(); assert.equal(renderer.status.status, "EMPTY"); assert.equal(env.buffers.size, 0);
renderer.update({ geometry: scene[0].geometry, material: { color: [.2,.3,.4] } }); env.flush(); assert.equal(env.buffers.size, 5); assert.deepEqual(env.draws.at(-1).color, [.2,.3,.4]);
renderer.update({ scene }); env.flush(); assert.equal(env.buffers.size, 10); env.lose(); env.restore(); env.flush(); assert.equal(env.buffers.size, 10);
renderer.update({ geometry: null }); env.flush(); assert.equal(env.buffers.size, 0); assert.equal(renderer.status.status, "EMPTY", "legacy null clears scenes too");
renderer.update({ scene }); env.flush(); renderer.dispose(); renderer.dispose(); assert.equal(env.buffers.size + env.programs.size + env.shaders.size, 0); assert.equal(env.listeners.size + env.raf.size, 0);
console.log(JSON.stringify({ status: "PASS", checks: ["independent buffers/materials", "common camera/depth", "atomic validation", "unit compatibility", "identity caching", "legacy transition/clear", "loss/restore/disposal"], limitation: "Recording GL; browser rasterization is a separate check." }, null, 2));
