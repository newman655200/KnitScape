import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// Node checks exercise the real renderer with a recording WebGL boundary. They
// prove CPU transforms, uploads and ownership, not browser rasterization quality.
const rendererUrl = new URL("../src/simulation/yarnSpatialPreviewRenderer.js", import.meta.url);
const cameraUrl = new URL("../src/simulation/yarnSpatialCamera.js", import.meta.url);
assert.ok(existsSync(rendererUrl), "standalone XYZ renderer must exist");
assert.ok(existsSync(cameraUrl), "testable perspective/orbit camera must exist");
const { createYarnSpatialPreviewRenderer } = await import(rendererUrl);
const { buildYarnSpatialCamera, fitYarnSpatialView, resolveYarnSpatialView } = await import(cameraUrl);
const { buildSpatialPath } = await import("../src/simulation/yarnSpatialPath.js");
const { buildParallelTransportFrames } = await import("../src/simulation/yarnParallelTransport.js");
const { buildYarnTubeGeometry } = await import("../src/simulation/yarnTubeGeometry.js");
const ok = value => { assert.equal(value.status, "OK", JSON.stringify(value)); return value; };
const near = (a, b, eps = 1e-5) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const transform = (matrix, point) => Array.from({ length: 4 }, (_, row) =>
  point.reduce((sum, value, col) => sum + matrix[col * 4 + row] * value, 0));
const project = (camera, point) => {
  const clip = transform(camera.projection, transform(camera.view, [...point, 1]));
  return clip.slice(0, 3).map(value => value / clip[3]);
};
const bounds = { min: [-6, -1, -1], max: [6, 1, 1] };
const baseView = { target: [0, 0, 0], distance: 10, yaw: 0, pitch: 0, fovY: Math.PI / 3 };

// Independent near/far and world-to-eye checks catch row/column and sign errors.
const front = ok(buildYarnSpatialCamera(baseView, 2, bounds));
assert.deepEqual(front.eye, [0, 0, 10]);
near(transform(front.view, [0, 0, 0, 1])[2], -10);
near(project(front, [0, 0, 10 - front.near])[2], -1);
near(project(front, [0, 0, 10 - front.far])[2], 1);
assert.ok(project(front, [1, 0, 0])[0] > 0);
assert.ok(project(front, [1, 0, 1])[0] > project(front, [1, 0, -1])[0], "XYZ depth changes perspective scale");
const back = ok(buildYarnSpatialCamera({ ...baseView, yaw: Math.PI }, 2, bounds));
near(back.eye[2], -10);
assert.ok(project(back, [1, 0, 0])[0] < 0, "back orbit observes the same world from the other side");
for (const pitch of [-Math.PI / 2, Math.PI / 2]) {
  const pole = ok(buildYarnSpatialCamera({ ...baseView, pitch }, 1, bounds));
  assert.ok([...pole.view, ...pole.projection].every(Number.isFinite));
  near(project(pole, [0, 0, 0])[0], 0); near(project(pole, [0, 0, 0])[1], 0);
}
const close = ok(buildYarnSpatialCamera({ ...baseView, target: [6, 0, 0], distance: 1.4, yaw: Math.PI / 2 }, 1, bounds));
near(close.eye[0], 7.4); assert.ok(close.near < 0.05); assert.ok(close.far > 13);
for (const aspect of [0.25, 1, 4]) {
  const fitted = ok(fitYarnSpatialView(baseView, bounds, aspect)).view;
  const camera = ok(buildYarnSpatialCamera(fitted, aspect, bounds));
  for (const x of bounds.min.slice(0, 1).concat(bounds.max[0])) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const ndc = project(camera, [x, y, z]);
    assert.ok(ndc.every(value => value > -1 && value < 1), "fit encloses all bounds in either aspect");
  }
}
for (const patch of [{ distance: 0 }, { distance: Infinity }, { yaw: NaN }, { target: [0, 1] }, { fovY: Math.PI }, { pitch: 2 }]) {
  assert.equal(resolveYarnSpatialView(patch, baseView).status, "INVALID");
}
assert.equal(buildYarnSpatialCamera(baseView, 0, bounds).status, "INVALID");

function eventTarget(value = {}) {
  const listeners = new Map();
  return Object.assign(value, { listeners,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    fire(type, event = {}) {
      const e = { preventDefault() { this.defaultPrevented = true; }, ...event };
      for (const fn of [...(listeners.get(type) || [])]) fn(e);
      return e;
    },
    listenerCount() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); },
  });
}

function fakeGl(canvas, options) {
  const calls = [], buffers = new Set(), programs = new Set(), shaders = new Set();
  const uploads = [], uniformValues = new Map(), bound = new Map();
  const constants = ["VERTEX_SHADER", "FRAGMENT_SHADER", "COMPILE_STATUS", "LINK_STATUS", "ARRAY_BUFFER", "ELEMENT_ARRAY_BUFFER",
    "STATIC_DRAW", "FLOAT", "UNSIGNED_SHORT", "UNSIGNED_INT", "TRIANGLES", "DEPTH_TEST", "CULL_FACE", "BACK", "CCW", "LEQUAL", "BLEND", "MAX_RENDERBUFFER_SIZE"];
  const gl = Object.fromEntries(constants.map((name, i) => [name, i + 1]));
  Object.assign(gl, { canvas, calls, buffers, programs, shaders, uploads, uniformValues,
    COLOR_BUFFER_BIT: 0x4000, DEPTH_BUFFER_BIT: 0x0100, NO_ERROR: 0,
    lost: false, contextLosses: 0,
    getExtension(name) {
      calls.push(["getExtension", name]);
      if (name === "OES_element_index_uint") return options.uintIndices ? {} : null;
      if (name === "WEBGL_lose_context") return { loseContext() { gl.contextLosses++; gl.lost = true; } };
      return null;
    },
    isContextLost: () => gl.lost,
    getParameter(name) { assert.equal(name, gl.MAX_RENDERBUFFER_SIZE); return 8192; },
    getError: () => 0,
    createShader(type) { const shader = { type }; shaders.add(shader); return shader; },
    shaderSource(shader, source) { shader.source = source; calls.push(["shaderSource", shader.type, source]); },
    compileShader() {},
    getShaderParameter: shader => !(options.failShader === shader.type || options.failShader === true),
    getShaderInfoLog: () => "synthetic compile failure",
    deleteShader(shader) { assert.ok(shaders.delete(shader), "shader deleted exactly once"); },
    createProgram() { const program = {}; programs.add(program); return program; },
    attachShader() {}, linkProgram() {},
    getProgramParameter: () => !options.failLink,
    getProgramInfoLog: () => "synthetic link failure",
    deleteProgram(program) { assert.ok(programs.delete(program), "program deleted exactly once"); },
    createBuffer() { if (options.failBuffer && buffers.size === 2) return null; const buffer = {}; buffers.add(buffer); return buffer; },
    deleteBuffer(buffer) { assert.ok(buffers.delete(buffer), "buffer deleted exactly once"); },
    bindBuffer(target, buffer) { bound.set(target, buffer); },
    bufferData(target, data, usage) {
      assert.ok(buffers.has(bound.get(target))); assert.equal(usage, gl.STATIC_DRAW);
      uploads.push({ target, data: data.slice(), buffer: bound.get(target) });
    },
    getAttribLocation: (_, name) => ({ a_position: 0, a_normal: 1, a_tangent: 2, a_uv: 3 })[name],
    getUniformLocation: (_, name) => name,
    uniformMatrix4fv(name, transpose, value) { assert.equal(transpose, false); uniformValues.set(name, Array.from(value)); },
    uniform3fv(name, value) { uniformValues.set(name, Array.from(value)); },
    uniform1f(name, value) { assert.ok(Number.isFinite(value)); uniformValues.set(name, value); },
    uniform1i(name, value) { uniformValues.set(name, value); },
    drawElements(...args) { assert.ok(!gl.lost); calls.push(["drawElements", ...args]); },
  });
  for (const method of ["useProgram", "enableVertexAttribArray", "vertexAttribPointer", "enable", "disable", "depthMask", "depthFunc", "clearDepth", "frontFace", "cullFace", "clearColor", "clear", "viewport"]) {
    gl[method] = (...args) => calls.push([method, ...args]);
  }
  return gl;
}

function environment(options = {}) {
  const raf = new Map(), observers = new Set(), contexts = [], canvases = [];
  let id = 0;
  const win = eventTarget({ devicePixelRatio: 1,
    requestAnimationFrame(fn) { raf.set(++id, fn); return id; },
    cancelAnimationFrame(key) { raf.delete(key); },
    ResizeObserver: class {
      constructor(fn) { this.fn = fn; }
      observe() { observers.add(this); }
      disconnect() { observers.delete(this); }
    },
  });
  const doc = { defaultView: win,
    createElement(tag) {
      assert.equal(tag, "canvas");
      const captures = new Set();
      const canvas = eventTarget({ ownerDocument: doc, style: {}, width: 300, height: 150, captures,
        setAttribute() {}, focus() {},
        setPointerCapture(pointerId) { captures.add(pointerId); },
        hasPointerCapture: pointerId => captures.has(pointerId),
        releasePointerCapture(pointerId) { captures.delete(pointerId); },
        getContext(type, attributes) {
          assert.equal(type, "webgl"); assert.equal(attributes.depth, true);
          if (options.unavailable) return null;
          if (!canvas.gl) { canvas.gl = fakeGl(canvas, options); contexts.push(canvas.gl); }
          return canvas.gl;
        },
        remove() { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); },
      });
      canvases.push(canvas); return canvas;
    },
  };
  const container = { ownerDocument: doc, clientWidth: 640, clientHeight: 400, children: [],
    get childElementCount() { return this.children.length; },
    appendChild(canvas) { this.children.push(canvas); canvas.parentNode = this; },
    removeChild(canvas) { this.children.splice(this.children.indexOf(canvas), 1); canvas.parentNode = null; },
    getBoundingClientRect() { return { width: this.clientWidth, height: this.clientHeight }; },
  };
  return { raf, observers, contexts, canvases, win, container, options,
    flush() {
      const batch = [...raf.values()]; raf.clear(); for (const fn of batch) fn(0);
      assert.equal(raf.size, 0, "demand-driven render leaves no idle animation loop");
    },
    resize(width, height) { container.clientWidth = width; container.clientHeight = height; for (const observer of observers) observer.fn([]); },
    lose() {
      const gl = contexts.at(-1); gl.lost = true;
      const e = canvases.at(-1).fire("webglcontextlost");
      assert.equal(e.defaultPrevented, true, "context restore is requested");
      // Real WebGL invalidates these objects on loss regardless of delete calls.
      gl.buffers.clear(); gl.programs.clear(); gl.shaders.clear();
    },
    restore() { contexts.at(-1).lost = false; canvases.at(-1).fire("webglcontextrestored"); },
  };
}

const scenes = [
  { type: "line", points: [[-6, 0, 0], [6, 0, 0]] },
  { type: "catmull-rom", points: [[-6, -1, 0], [-3, 2, -1], [0, 0, 1], [3, -2, 0], [6, 1, 1]] },
  { type: "helix", radius: 3, turns: 2, pitch: 2 },
  { type: "circle", radius: 3 },
];
const meshes = scenes.map(config => {
  const path = ok(buildSpatialPath({ ...config, unit: "mm" }, { sampleCount: 128 }));
  return ok(buildYarnTubeGeometry({ path, frames: ok(buildParallelTransportFrames(path)), radiusA: 0.28,
    radiusB: 0.28, radialSegments: 32, capEnds: true, uvRepeatLength: 2 }));
});
const geometry = meshes[1];
const env = environment(), views = [], statuses = [];
const renderer = createYarnSpatialPreviewRenderer({ onViewChange: view => views.push(view), onStatusChange: status => statuses.push(status) });
assert.equal(renderer.canvas, null); assert.equal(env.contexts.length, 0, "factory has no GPU effects");
renderer.update({ geometry });
assert.equal(env.contexts.length, 0, "pre-mount update stays CPU-only");
renderer.mount(env.container); renderer.update({ fit: true }); env.flush();
const gl = env.contexts[0], canvas = renderer.canvas;
assert.equal(env.container.children.length, 1); assert.equal(renderer.status.status, "OK");
assert.equal(gl.uploads.length, 5, "XYZ, normals, tangents, UV, and indices upload once");
assert.deepEqual(gl.uploads[0].data, geometry.positions, "mesh positions, including Z, reach the GPU unchanged");
assert.deepEqual(gl.uploads[1].data, geometry.normals); assert.deepEqual(gl.uploads[2].data, geometry.tangents);
assert.deepEqual(gl.uploads[3].data, geometry.uv);
assert.ok(gl.uploads[4].data instanceof Uint16Array, "small WebGL1 meshes use core Uint16 indices");
for (const expected of [["enable", gl.DEPTH_TEST], ["depthMask", true], ["clearDepth", 1], ["enable", gl.CULL_FACE], ["frontFace", gl.CCW], ["cullFace", gl.BACK]]) {
  assert.ok(gl.calls.some(call => JSON.stringify(call) === JSON.stringify(expected)), `${expected} is configured`);
}
assert.ok(gl.calls.some(call => call[0] === "clear" && (call[1] & gl.DEPTH_BUFFER_BIT) !== 0));
assert.ok(gl.calls.some(call => call[0] === "vertexAttribPointer" && call[1] === 0 && call[2] === 3), "position attribute is XYZ");
const firstProjection = [...gl.uniformValues.get("u_projection")];
renderer.setView({ yaw: Math.PI, pitch: 0 }); renderer.update({ material: { roughness: 0.4, anisotropy: 0.6, mode: "uv-reference" } });
env.flush(); assert.equal(gl.uploads.length, 5, "orbit and material edit reuse GPU mesh");
const priorViews = views.length; renderer.setView(renderer.view); env.flush(); assert.equal(views.length, priorViews, "same view cannot trigger callback recursion");
const returnedView = renderer.view;
assert.ok(Object.isFrozen(returnedView)); assert.ok(Object.isFrozen(returnedView.target));
renderer.update({ geometry }); env.flush(); assert.equal(gl.uploads.length, 5, "same identity never reuploads");
renderer.setView({ target: [6, 1, 1], distance: 1.4, yaw: Math.PI / 2, pitch: 0 }); env.flush();
near(gl.uniformValues.get("u_eye")[0], 7.4); assert.equal(gl.uploads.length, 5, "endpoint inspection moves the camera without changing the mesh");
env.resize(400, 640); env.flush(); assert.notDeepEqual(gl.uniformValues.get("u_projection"), firstProjection);
assert.equal(gl.uploads.length, 5, "resize changes projection only");

const originalDistance = renderer.view.distance;
canvas.fire("wheel", { deltaY: 50, deltaMode: 0 }); env.flush(); assert.ok(renderer.view.distance > originalDistance);
canvas.fire("pointerdown", { button: 0, pointerId: 7, clientX: 20, clientY: 20 });
const previousYaw = renderer.view.yaw;
canvas.fire("pointermove", { pointerId: 7, clientX: 60, clientY: 35 }); env.flush(); assert.notEqual(renderer.view.yaw, previousYaw);
assert.equal(canvas.captures.size, 1);
canvas.fire("pointercancel", { pointerId: 7 }); assert.equal(canvas.captures.size, 0);
canvas.fire("keydown", { key: "ArrowLeft" }); env.flush(); assert.notEqual(renderer.view.yaw, previousYaw);
const goodView = renderer.view;
assert.equal(renderer.setView({ distance: NaN }).status, "INVALID"); assert.deepEqual(renderer.view, goodView);
for (const material of [{ roughness: NaN }, { roughness: -1 }, { color: [1, 0, Infinity] }, { lightDirection: [0, 0, 0] }, { mode: "texture" }]) {
  assert.equal(renderer.update({ material }).status, "INVALID");
}
const draws = () => gl.calls.filter(call => call[0] === "drawElements").length;
let beforeDraws = draws();
env.resize(0, 0); env.flush(); assert.equal(draws(), beforeDraws, "zero-sized mount does not draw");
env.resize(640, 400); env.flush(); assert.ok(draws() > beforeDraws);
renderer.setView({ yaw: 0.2 }); assert.equal(env.raf.size, 1);
renderer.suspend(); assert.equal(env.raf.size, 0); beforeDraws = draws(); renderer.render(); assert.equal(draws(), beforeDraws);
renderer.update({ material: { lightIntensity: 2 } }); assert.equal(env.raf.size, 0);
renderer.resume(); env.flush(); assert.ok(draws() > beforeDraws); assert.equal(gl.uploads.length, 5);
for (const mesh of meshes) { renderer.update({ geometry: mesh, fit: true }); env.flush(); assert.equal(renderer.status.status, "OK"); }

renderer.setView({ yaw: 0.3 }); env.lose(); assert.equal(env.raf.size, 0); assert.equal(renderer.status.status, "CONTEXT_LOST");
renderer.setView({ yaw: 0.4 }); assert.equal(env.raf.size, 0);
env.restore(); env.flush(); assert.equal(renderer.status.status, "OK"); assert.equal(gl.buffers.size, 5);
renderer.update({ geometry: null }); env.flush(); assert.equal(gl.buffers.size, 0); assert.equal(renderer.status.status, "EMPTY");
renderer.update({ geometry }); env.flush();
canvas.fire("pointerdown", { button: 0, pointerId: 8, clientX: 20, clientY: 20 });
renderer.setView({ yaw: 0.5 });
const lateFrames = [...env.raf.values()], lateResize = [...env.observers].map(observer => observer.fn);
renderer.dispose(); renderer.dispose();
assert.equal(renderer.canvas, null); assert.equal(renderer.status.status, "DISPOSED");
assert.equal(env.raf.size, 0); assert.equal(env.observers.size, 0); assert.equal(env.container.children.length, 0);
assert.equal(canvas.listenerCount(), 0); assert.equal(env.win.listenerCount(), 0); assert.equal(canvas.captures.size, 0);
assert.equal(gl.buffers.size + gl.programs.size + gl.shaders.size, 0); assert.equal(gl.contextLosses, 1);
for (const fn of [...lateFrames, ...lateResize]) fn();
renderer.mount(env.container); renderer.update({ geometry }); renderer.resume(); renderer.render(); canvas.fire("webglcontextrestored");
assert.equal(env.contexts.length, 1); assert.equal(env.raf.size, 0); assert.equal(env.container.children.length, 0, "disposed work cannot resurrect");

for (const mode of ["failShader", "failLink", "failBuffer"]) {
  const failure = environment({ [mode]: true });
  const preview = createYarnSpatialPreviewRenderer(); preview.mount(failure.container); preview.update({ geometry }); failure.flush();
  assert.equal(preview.status.status, "UNAVAILABLE");
  const ctx = failure.contexts[0]; assert.equal(ctx.buffers.size + ctx.programs.size + ctx.shaders.size, 0, `${mode} cleans partially allocated resources`);
  preview.dispose(); assert.equal(ctx.contextLosses, 1);
}
const unavailable = environment({ unavailable: true });
const noGpu = createYarnSpatialPreviewRenderer(); assert.equal(noGpu.mount(unavailable.container).status, "UNAVAILABLE"); noGpu.dispose();
assert.equal(unavailable.container.children.length, 0); assert.equal(unavailable.observers.size, 0);

// Supplied arrays are readonly and may be ordinary arrays; no input is mutated.
const plain = { ...geometry, positions: Object.freeze(Array.from(geometry.positions)), normals: Object.freeze(Array.from(geometry.normals)),
  tangents: Object.freeze(Array.from(geometry.tangents)), uv: Object.freeze(Array.from(geometry.uv)), indices: Object.freeze(Array.from(geometry.indices)) };
Object.freeze(plain);
for (let cycle = 0; cycle < 6; cycle++) {
  const fixture = environment(), preview = createYarnSpatialPreviewRenderer();
  preview.mount(fixture.container); preview.update({ geometry: plain }); fixture.flush(); assert.equal(preview.status.status, "OK");
  preview.dispose(); const ctx = fixture.contexts[0];
  assert.equal(ctx.buffers.size + ctx.programs.size + ctx.shaders.size, 0); assert.equal(fixture.observers.size + fixture.raf.size, 0);
}
for (const unit of ["mm", "cm", "m"]) {
  const fixture = environment(), preview = createYarnSpatialPreviewRenderer(); preview.mount(fixture.container);
  preview.update({ geometry: { ...geometry, unit }, view: baseView }); fixture.flush();
  assert.equal(preview.status.status, "OK"); assert.deepEqual(fixture.contexts[0].uploads[0].data, geometry.positions,
    "explicit declared units are not silently converted or scaled"); preview.dispose();
}

const invalidMeshes = [
  { ...geometry, indices: [0, 1, geometry.counts.vertices] },
  { ...geometry, indices: [0, 1, -1] }, { ...geometry, indices: [0, 1, 1.5] },
  { ...geometry, indices: [0, 1] }, { ...geometry, positions: [NaN, 0, 0] },
  { ...geometry, normals: Array(geometry.normals.length).fill(0) },
  { ...geometry, unit: "px" }, { ...geometry, uv: [0, 1] },
  { ...geometry, counts: { ...geometry.counts, vertices: 1 } },
  { ...geometry, bounds: { min: [0, 0, 0], max: [0, 0, 0] } },
];
for (const invalidGeometry of invalidMeshes) {
  const fixture = environment(), preview = createYarnSpatialPreviewRenderer(); preview.mount(fixture.container);
  assert.equal(preview.update({ geometry: invalidGeometry }).status, "INVALID");
  fixture.flush(); assert.equal(fixture.contexts[0].uploads.length, 0, "invalid meshes never upload"); preview.dispose();
}

// Exercise the WebGL1 extension boundary with a real 66k-vertex tube.
const longPath = ok(buildSpatialPath({ type: "line", unit: "mm", points: [[0, 0, 0], [0, 0, 100]] }, { sampleCount: 2000 }));
const large = ok(buildYarnTubeGeometry({ path: longPath, frames: ok(buildParallelTransportFrames(longPath)), radiusA: 0.28,
  radialSegments: 32, capEnds: true, uvRepeatLength: 2 }));
assert.ok(large.counts.vertices > 65536);
for (const uintIndices of [false, true]) {
  const fixture = environment({ uintIndices }), preview = createYarnSpatialPreviewRenderer(); preview.mount(fixture.container); preview.update({ geometry: large }); fixture.flush();
  const ctx = fixture.contexts[0];
  if (uintIndices) { assert.equal(preview.status.status, "OK"); assert.ok(ctx.uploads.at(-1).data instanceof Uint32Array); }
  else {
    assert.equal(preview.status.status, "UNAVAILABLE"); assert.equal(ctx.uploads.length, 0); assert.match(preview.status.diagnostic, /OES_element_index_uint/);
    preview.update({ geometry }); fixture.flush();
    assert.equal(preview.status.status, "OK", "selecting a smaller mesh recovers from unsupported Uint32 indices");
  }
  preview.dispose(); assert.equal(ctx.buffers.size + ctx.programs.size + ctx.shaders.size, 0);
}

const restoreFailure = environment(), recover = createYarnSpatialPreviewRenderer(); recover.mount(restoreFailure.container); recover.update({ geometry }); restoreFailure.flush();
restoreFailure.lose(); restoreFailure.options.failLink = true; restoreFailure.restore(); restoreFailure.flush();
assert.equal(recover.status.status, "UNAVAILABLE"); recover.dispose();
const duringLoss = environment(), lostPreview = createYarnSpatialPreviewRenderer(); lostPreview.mount(duringLoss.container); lostPreview.update({ geometry }); duringLoss.flush();
duringLoss.lose(); lostPreview.dispose(); duringLoss.restore(); duringLoss.flush(); assert.equal(lostPreview.status.status, "DISPOSED");
const sleeping = environment(), sleepPreview = createYarnSpatialPreviewRenderer(); sleepPreview.mount(sleeping.container); sleepPreview.update({ geometry }); sleeping.flush();
sleepPreview.suspend(); sleeping.lose(); sleeping.restore(); sleeping.flush();
assert.equal(sleeping.contexts[0].buffers.size, 0, "restoration while suspended does not allocate GPU work");
sleepPreview.resume(); sleeping.flush(); assert.equal(sleeping.contexts[0].buffers.size, 5); sleepPreview.dispose();

const source = readFileSync(rendererUrl, "utf8");
// Round9 explicitly adds PBR to this existing renderer. Keep the original
// machine/state/legacy-renderer boundary; only two audited channels may sample.
assert.doesNotMatch(source, /GLOBAL_STATE|solveFeedYarn|dispatch\(|yarnUvWebglRenderer/);
assert.deepEqual([...source.matchAll(/uniform sampler2D (\w+);/g)].map(match => match[1]).sort(), ["u_baseColorMap", "u_roughnessMap"]);
assert.match(source, /import\("\.\/yarnTextureBrush\.js"\)/, "reuse existing image owner/cache lazily");
assert.match(source, /u_projection\s*\*\s*u_view\s*\*\s*world/);
assert.match(source, /a_tangent/); assert.match(source, /v_uv/);
// Static guards are deliberately reported separately from GPU/browser execution.
assert.ok(/pow\(1\.0 - clamp\(dot\(v, h\), 0\.0, 1\.0\), 5\.0\)/.test(source), "Fresnel pow stays inside its finite domain");
assert.ok(/if \(nl > 0\.0 && nv > 0\.0\)/.test(source), "unlit/back-facing material uses ambient without evaluating GGX");
assert.ok(/if \(halfLength > 0\.0001\)/.test(source), "opposite view/light directions never normalize a zero half-vector");
assert.match(source, /TEST_ONLY/);
console.log(JSON.stringify({ status: "PASS", scenes: scenes.map(scene => scene.type), lifecycleCycles: 6,
  tested: ["camera near/far/poles/fit", "XYZ uploads/depth/winding", "geometry identity", "orbit/wheel/keyboard", "zero size/suspend",
    "null clear", "readonly arrays", "invalid data", "Uint32 extension", "context restore/failure", "allocation cleanup/disposal"],
  limitation: "Recording WebGL does not prove browser compilation, rasterization, screenshot appearance, or physical material accuracy." }, null, 2));
