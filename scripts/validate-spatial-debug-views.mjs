import assert from 'node:assert/strict';
import { createYarnSpatialPreviewRenderer } from '../src/simulation/yarnSpatialPreviewRenderer.js';

// Recording GL verifies draw/resource contracts; browser pixels remain a separate acceptance gate.
function environment() {
  const buffers = new Set(), programs = new Set(), shaders = new Set(), listeners = new Map(), raf = new Map();
  const uploads = [], draws = [], calls = [], uniforms = new Map(), shaderSources = [];
  let bound = null, nextFrame = 0;
  const gl = Object.fromEntries(['VERTEX_SHADER', 'FRAGMENT_SHADER', 'COMPILE_STATUS', 'LINK_STATUS', 'ARRAY_BUFFER',
    'ELEMENT_ARRAY_BUFFER', 'STATIC_DRAW', 'FLOAT', 'UNSIGNED_SHORT', 'UNSIGNED_INT', 'TRIANGLES', 'LINES',
    'DEPTH_TEST', 'CULL_FACE', 'BACK', 'CCW', 'LEQUAL', 'BLEND', 'MAX_RENDERBUFFER_SIZE'].map((name, i) => [name, i + 1]));
  Object.assign(gl, { NO_ERROR: 0, COLOR_BUFFER_BIT: 0x4000, DEPTH_BUFFER_BIT: 0x100, lost: false,
    getExtension: () => null, isContextLost: () => gl.lost, getParameter: () => 8192, getError: () => 0,
    createBuffer() { const item = {}; buffers.add(item); return item; }, deleteBuffer(item) { assert.ok(buffers.delete(item)); },
    createProgram() { const item = {}; programs.add(item); return item; }, deleteProgram(item) { assert.ok(programs.delete(item)); },
    createShader() { const item = {}; shaders.add(item); return item; }, deleteShader(item) { assert.ok(shaders.delete(item)); },
    bindBuffer(_, item) { bound = item; }, bufferData(_, data) { uploads.push({ buffer: bound, data: Array.from(data) }); },
    shaderSource(_, source) { shaderSources.push(source); },
    getShaderParameter: () => true, getProgramParameter: () => true,
    getAttribLocation: (_, name) => ['a_position', 'a_normal', 'a_tangent', 'a_uv'].indexOf(name), getUniformLocation: (_, name) => name,
    uniformMatrix4fv(name, _, value) { uniforms.set(name, Array.from(value)); },
    uniform3fv(name, value) { uniforms.set(name, Array.from(value)); },
    uniform1f(name, value) { uniforms.set(name, value); }, uniform1i(name, value) { uniforms.set(name, value); },
    drawElements(mode, count, type) { draws.push({ mode, count, type, indices: bound,
      uniforms: Object.fromEntries(uniforms) }); },
  });
  for (const method of ['compileShader', 'attachShader', 'linkProgram', 'useProgram', 'enableVertexAttribArray',
    'vertexAttribPointer', 'enable', 'disable', 'depthMask', 'depthFunc', 'clearDepth', 'frontFace', 'cullFace',
    'clearColor', 'clear', 'viewport']) gl[method] = (...args) => calls.push([method, ...args]);
  const win = { devicePixelRatio: 1, requestAnimationFrame(fn) { raf.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame(id) { raf.delete(id); }, addEventListener() {}, removeEventListener() {},
    ResizeObserver: class { observe() {} disconnect() {} } };
  const canvas = { style: {}, setAttribute() {}, addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name) { listeners.delete(name); }, getContext: () => gl,
    remove() { container.childElementCount = 0; }, focus() {} };
  const container = { clientWidth: 640, clientHeight: 400, childElementCount: 0,
    ownerDocument: { defaultView: win, createElement: () => canvas }, appendChild() { this.childElementCount++; } };
  return { gl, buffers, programs, shaders, uploads, draws, calls, shaderSources, container, listeners, raf,
    flush() { const callbacks = [...raf.values()]; raf.clear(); callbacks.forEach(fn => fn()); },
    lose() { gl.lost = true; listeners.get('webglcontextlost')({ preventDefault() {} }); buffers.clear(); programs.clear(); shaders.clear(); },
    restore() { gl.lost = false; listeners.get('webglcontextrestored')(); } };
}

const triangle = z => ({ status: 'OK', unit: 'mm', positions: [0,0,z, 1,0,z, 0,1,z],
  normals: [0,0,1, 0,0,1, 0,0,1], tangents: [1,0,0, 1,0,0, 1,0,0], uv: [0,0, 1,0, 0,1],
  indices: [0,1,2], bounds: { min: [0,0,z], max: [1,1,z] } });
const scene = [0, 1].map(z => ({ id: `source-${z}`, geometry: triangle(z), material: { color: [.8,.4,.1] } }));
const sourceBefore = JSON.stringify(scene), env = environment(), renderer = createYarnSpatialPreviewRenderer();
renderer.mount(env.container); renderer.update({ scene, fit: true, batchOrder: 'material' }); renderer.render();
const ranges = renderer.getSourceRanges(), view = renderer.view, baseDraw = env.draws.at(-1);
assert.equal(renderer.getDiagnostics().debugMode, 'pbr', 'PBR must be the explicit default debug state.');
assert.equal(baseDraw.mode, env.gl.TRIANGLES); assert.equal(baseDraw.count, 6); assert.equal(env.buffers.size, 5);
assert.equal(env.uploads.length, 5, 'PBR allocates no debug buffers.');

for (const [mode, uniform] of [['unlit', 1], ['normals', 2]]) {
  assert.equal(renderer.update({ debugMode: mode }).status, 'OK'); renderer.render();
  const draw = env.draws.at(-1);
  assert.equal(draw.uniforms.u_debugMode, uniform); assert.equal(draw.mode, env.gl.TRIANGLES);
  assert.deepEqual(draw.uniforms.u_color, baseDraw.uniforms.u_color, 'Debug leaves source colors unchanged.');
  assert.deepEqual(draw.uniforms.u_lightDirection, baseDraw.uniforms.u_lightDirection);
  assert.deepEqual(draw.uniforms.u_view, baseDraw.uniforms.u_view);
  assert.equal(env.uploads.length, 5, 'Shader debug modes reuse all existing source buffers.');
}
const shader = env.shaderSources.find(source => source.includes('u_debugMode'));
const branch = shader.slice(shader.indexOf('void main()'), shader.indexOf('vec3 t ='));
assert.match(branch, /u_debugMode == 1[\s\S]*gl_FragColor = vec4\(u_color, 1\.0\);[\s\S]*return;/);
assert.match(branch, /u_debugMode == 2[\s\S]*vec4\(n \* 0\.5 \+ 0\.5, 1\.0\);[\s\S]*return;/);
assert.ok(shader.indexOf('texture2D(') > shader.indexOf('vec3 t ='), 'Debug returns before texture sampling and GGX.');

renderer.update({ debugMode: 'wireframe' }); renderer.render();
assert.equal(env.draws.at(-1).mode, env.gl.LINES); assert.equal(env.draws.at(-1).count, 12);
assert.deepEqual(env.uploads.at(-1).data, [0,1,1,2,2,0, 3,4,4,5,5,3], 'Wire indices retain all triangle edges and batch offsets.');
assert.equal(env.uploads.length, 6); assert.equal(env.buffers.size, 6);
assert.equal(renderer.getDiagnostics().debugLineCount, 6);
assert.equal(renderer.getDiagnostics().bufferCount, 6);
renderer.render(); assert.equal(env.uploads.length, 6, 'Wire indices upload once per scene.');
assert.deepEqual(renderer.getSourceRanges(), ranges, 'Source triangle ranges remain available in every debug mode.');
assert.deepEqual(renderer.view, view);
assert.equal(renderer.update({ debugMode: 'hidden-surface', view: { yaw: 2 } }).status, 'INVALID');
assert.equal(renderer.getDiagnostics().debugMode, 'wireframe'); assert.deepEqual(renderer.view, view);
assert.ok(!env.calls.some(([name, value]) => name === 'disable' && [env.gl.DEPTH_TEST, env.gl.CULL_FACE].includes(value)));

env.lose(); env.restore(); renderer.render();
assert.equal(renderer.status.status, 'OK'); assert.equal(env.buffers.size, 6, 'Context restoration rebuilds only current debug resources.');
renderer.update({ debugMode: 'pbr' }); renderer.render();
assert.equal(env.buffers.size, 5, 'Returning to PBR releases auxiliary debug buffers.');
assert.equal(env.draws.at(-1).mode, env.gl.TRIANGLES); assert.equal(env.draws.at(-1).count, 6);
assert.equal(renderer.getDiagnostics().debugLineCount, 0);
const profile = renderer.profileOrbit({ frames: 8 }); for (let i = 0; i < 10; i++) env.flush();
const profileReport = await profile;
assert.equal(profileReport.status, 'OK'); assert.equal(profileReport.drawCalls, 1); assert.equal(profileReport.triangleCount, 2);
assert.equal(profileReport.debugMode, 'pbr'); assert.deepEqual(renderer.view, view);
const interrupted = renderer.profileOrbit({ frames: 8 }); renderer.update({ debugMode: 'unlit' });
assert.equal((await interrupted).status, 'CANCELLED', 'Changing evidence view cannot mix modes within a profile.');
renderer.update({ debugMode: 'wireframe' }); renderer.render(); renderer.update({ scene: [] });
assert.equal(env.buffers.size, 0); assert.equal(renderer.getDiagnostics().bufferBytes, 0);
renderer.update({ scene }); renderer.render(); renderer.dispose();
assert.equal(env.buffers.size + env.programs.size + env.shaders.size, 0);
assert.equal(env.listeners.size + env.raf.size, 0);
assert.equal(JSON.stringify(scene), sourceBefore, 'Debug never changes source geometry/material assets.');
console.log(JSON.stringify({ status: 'PASS', checks: ['PBR default', 'unlit and normal shader branches',
  'lazy batched wire edges', 'source ranges and camera preserved', 'atomic validation', 'depth and cull retained',
  'context loss / clear / disposal', 'profile isolation'], limitation: 'Recording GL; actual shader rasterization requires browser acceptance.' }, null, 2));
