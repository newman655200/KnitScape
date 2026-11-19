import { buildYarnSpatialCamera, fitYarnSpatialView, resolveYarnSpatialView } from "./yarnSpatialCamera.js";
import { finiteVector, normalize } from "./yarnSpatialMath.js";

const VERTEX_SHADER = `
precision highp float;
attribute vec3 a_position;
attribute vec3 a_normal;
attribute vec3 a_tangent;
attribute vec2 a_uv;
uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
varying mediump vec3 v_position;
varying mediump vec3 v_normal;
varying mediump vec3 v_tangent;
varying mediump vec2 v_uv;
void main() {
  vec4 world = u_model * vec4(a_position, 1.0);
  v_position = world.xyz;
  v_normal = mat3(u_model) * a_normal;
  v_tangent = mat3(u_model) * a_tangent;
  v_uv = a_uv;
  gl_Position = u_projection * u_view * world;
}`;

// TEST_ONLY nonmetallic anisotropic GGX prototype: geometry normals and supplied
// longitudinal tangents, fixed dielectric F0=0.04, no measured textile parameters.
// The identity model never scales normals. Only BaseColor and scalar Roughness
// are mapped; unverified scan normal/AO/height channels never affect geometry.
const FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying mediump vec3 v_position;
varying mediump vec3 v_normal;
varying mediump vec3 v_tangent;
varying mediump vec2 v_uv;
uniform vec3 u_eye;
uniform vec3 u_color;
uniform vec3 u_lightDirection;
uniform float u_roughness;
uniform float u_anisotropy;
uniform float u_ambient;
uniform float u_lightIntensity;
uniform bool u_swatchLighting;
uniform float u_scanHalfWidth;
uniform int u_debugMode;
uniform int u_uvReference;
uniform int u_hasBaseColor;
uniform int u_hasRoughness;
uniform int u_scanAxisY;
uniform sampler2D u_baseColorMap;
uniform sampler2D u_roughnessMap;
vec3 srgbToLinear(vec3 value) {
  return mix(value / 12.92, pow((value + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), value));
}
const float PI = 3.14159265359;
float lambdaGGX(vec3 w, vec3 t, vec3 b, vec3 n, float ax, float ay) {
  float wn = max(dot(w, n), 0.001);
  vec2 transverse = vec2(ax * dot(w, t), ay * dot(w, b));
  return 0.5 * (length(vec3(transverse, wn)) / wn - 1.0);
}
vec3 directLight(vec3 l, vec3 n, vec3 v, vec3 t, vec3 b, vec3 color, float roughness) {
  float nl = max(dot(n, l), 0.0);
  float nv = max(dot(n, v), 0.0);
  if (nl > 0.0 && nv > 0.0) {
    float halfLength = length(v + l);
    if (halfLength > 0.0001) {
      vec3 h = (v + l) / halfLength;
      float nh = max(dot(n, h), 0.0);
      float alpha = roughness * roughness;
      float aspect = sqrt(1.0 - 0.8 * abs(u_anisotropy));
      float ax = max(0.04, alpha / aspect);
      float ay = max(0.04, alpha * aspect);
      if (u_anisotropy < 0.0) { float swapAxis = ax; ax = ay; ay = swapAxis; }
      vec3 hn = vec3(dot(h, t) / ax, dot(h, b) / ay, nh);
      float reciprocal = 1.0 / max(dot(hn, hn), 0.0001);
      float d = (reciprocal / ax) * (reciprocal / ay) / PI;
      float g = 1.0 / (1.0 + lambdaGGX(v, t, b, n, ax, ay) + lambdaGGX(l, t, b, n, ax, ay));
      float fresnel = 0.04 + 0.96 * pow(1.0 - clamp(dot(v, h), 0.0, 1.0), 5.0);
      float specular = fresnel * d * g / max(4.0 * nv * nl, 0.0001);
      return nl * ((1.0 - fresnel) * color / PI + vec3(specular));
    }
  }
  return vec3(0.0);
}
void main() {
  vec3 n = normalize(v_normal);
  if (u_debugMode == 1) {
    gl_FragColor = vec4(u_color, 1.0);
    return;
  }
  if (u_debugMode == 2) {
    gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
    return;
  }
  vec3 t = normalize(v_tangent - n * dot(v_tangent, n));
  vec3 b = normalize(cross(n, t));
  vec3 v = normalize(u_eye - v_position);
  vec3 l = normalize(u_lightDirection);
  vec3 color = u_color;
  float roughness = u_roughness;
  // Mirror transverse scan coordinates so V=0 and V=1 have identical samples.
  // This is a visual scan projection, not a calibrated wrap of a real yarn scan.
  vec2 scanUv = vec2(fract(v_uv.x), 1.0 - abs(2.0 * fract(v_uv.y) - 1.0));
  // A mirrored half-turn of the display tube spans pi*r in the square SOP scans.
  // Keeping its scale relative to U avoids squeezing an entire image into a few pixels.
  scanUv.y = 0.5 + (scanUv.y - 0.5) * u_scanHalfWidth;
  if (u_scanAxisY == 1) scanUv = scanUv.yx;
  if (u_hasBaseColor == 1) {
    vec4 texel = texture2D(u_baseColorMap, scanUv);
    color = mix(color, srgbToLinear(texel.rgb), texel.a);
  }
  if (u_hasRoughness == 1) roughness = clamp(texture2D(u_roughnessMap, scanUv).r, 0.08, 1.0);
  if (u_uvReference == 1) {
    float checker = mod(floor(v_uv.x * 2.0) + floor(v_uv.y * 8.0), 2.0);
    color = mix(vec3(0.04, 0.27, 0.38), vec3(0.88, 0.57, 0.16), checker);
    float seam = step(0.96, fract(v_uv.y));
    color = mix(color, vec3(0.75, 0.04, 0.12), seam);
  }
  vec3 linearColor = color * u_ambient;
  if (u_swatchLighting) {
    // A small display roughness bias broadens the shinier scan highlights
    // while retaining the scalar map's variation and the two materials' contrast.
    roughness = mix(roughness, 0.58, 0.18);
  }
  linearColor += u_lightIntensity * directLight(l, n, v, t, b, color, roughness);
  if (u_swatchLighting) {
    // A softer reverse key reveals the back when orbiting this open fabric.
    vec3 reverseLight = normalize(vec3(0.52, 0.65, -0.83));
    linearColor += u_lightIntensity * 0.83 * directLight(reverseLight, n, v, t, b, color, roughness);
  }
  vec3 mapped = linearColor / (vec3(1.0) + linearColor);
  gl_FragColor = vec4(pow(mapped, vec3(1.0 / 2.2)), 1.0);
}`;

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const DEFAULT_MATERIAL = { color: [0.55, 0.17, 0.09], roughness: 0.42, anisotropy: 0.55,
  ambient: 0.22, lightIntensity: 3, lightDirection: [0.4, 0.7, 1], mode: "solid", pbr: null, scanAxis: "x" };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const sameView = (a, b) => a.distance === b.distance && a.yaw === b.yaw && a.pitch === b.pitch &&
  a.fovY === b.fovY && a.target.every((value, axis) => value === b.target[axis]);

function resolveMaterial(patch, current) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Material patch must be an object.");
  const result = { ...current, ...patch };
  if (!["x", "y"].includes(result.scanAxis) || (result.pbr !== null && (typeof result.pbr !== "object" || Array.isArray(result.pbr)))) {
    throw new Error("PBR requires existing map descriptors and scanAxis x or y (VISUAL_ASSUMPTION).");
  }
  for (const channel of ["baseColor", "roughness"]) {
    const map = result.pbr?.[channel];
    if (map != null && !(map.assetRef || map.processedDataUrl || map.dataUrl)) throw new Error(`PBR ${channel} requires an existing asset source.`);
  }
  if (!finiteVector(result.color) || !result.color.every(value => value >= 0 && value <= 1) ||
    !finiteVector(result.lightDirection) || Math.hypot(...result.lightDirection) === 0 ||
    !["solid", "uv-reference"].includes(result.mode)) throw new Error("Material requires RGB in [0,1], a nonzero finite light direction and solid or uv-reference mode.");
  for (const [key, min, max] of [["roughness", 0.08, 1], ["anisotropy", -0.85, 0.85], ["ambient", 0, 2], ["lightIntensity", 0, 10]]) {
    if (!Number.isFinite(result[key]) || result[key] < min || result[key] > max) throw new Error(`${key} must be finite within [${min}, ${max}].`);
  }
  return { ...result, color: [...result.color], lightDirection: normalize(result.lightDirection) };
}

function prepareGeometry(geometry) {
  if (!geometry || (geometry.status !== undefined && geometry.status !== "OK") || !["mm", "cm", "m"].includes(geometry.unit)) {
    throw new Error("Geometry requires valid XYZ data and explicit mm, cm, or m units; camera distances use that same unit.");
  }
  const arrays = {};
  for (const name of ["positions", "normals", "tangents", "uv", "indices"]) {
    const array = geometry[name];
    if ((!Array.isArray(array) && !ArrayBuffer.isView(array)) || typeof array.length !== "number" || !array.length) {
      throw new Error(`Geometry ${name} must be a nonempty numeric array.`);
    }
    for (const value of array) if (!Number.isFinite(value)) throw new Error(`Geometry ${name} contains a nonfinite value.`);
    if (name !== "indices") {
      arrays[name] = array instanceof Float32Array ? array : new Float32Array(array);
      if (!arrays[name].every(Number.isFinite)) throw new Error(`Geometry ${name} exceeds Float32 range.`);
    }
  }
  const vertices = arrays.positions.length / 3, triangleCount = geometry.indices.length / 3;
  if (!Number.isInteger(vertices) || vertices < 3 || vertices > 2000000 || !Number.isInteger(triangleCount) ||
    arrays.normals.length !== vertices * 3 || arrays.tangents.length !== vertices * 3 || arrays.uv.length !== vertices * 2 ||
    (geometry.counts && (geometry.counts.vertices !== vertices || geometry.counts.triangles !== triangleCount))) {
    throw new Error("Geometry attribute sizes, triangle indices and declared counts must agree (at most two million vertices).");
  }
  let maxIndex = 0;
  for (const index of geometry.indices) {
    if (!Number.isInteger(index) || index < 0 || index >= vertices) throw new Error("Geometry indices must be nonnegative integers within the vertex array.");
    maxIndex = Math.max(maxIndex, index);
  }
  if (!finiteVector(geometry.bounds?.min) || !finiteVector(geometry.bounds?.max) ||
    geometry.bounds.min.some((value, axis) => Math.abs(value) > 1e12 || Math.abs(geometry.bounds.max[axis]) > 1e12 || value > geometry.bounds.max[axis])) {
    throw new Error("Geometry bounds must be finite, ordered XYZ coordinates within the camera range.");
  }
  const bounds = { min: [...geometry.bounds.min], max: [...geometry.bounds.max] };
  for (let vertex = 0; vertex < vertices; vertex++) {
    const offset = vertex * 3;
    const n = arrays.normals.subarray(offset, offset + 3), t = arrays.tangents.subarray(offset, offset + 3);
    const nl = Math.hypot(...n), tl = Math.hypot(...t), nt = n[0] * t[0] + n[1] * t[1] + n[2] * t[2];
    if (nl < 1e-8 || tl < 1e-8 || Math.abs(nt / nl / tl) > 0.9999) throw new Error("Geometry needs nonzero normals and independent tangent directions.");
    for (let axis = 0; axis < 3; axis++) {
      const value = arrays.positions[offset + axis], tolerance = 1e-6 * Math.max(1, Math.abs(value));
      if (value < bounds.min[axis] - tolerance || value > bounds.max[axis] + tolerance) throw new Error("Geometry bounds do not enclose its XYZ positions.");
    }
  }
  arrays.indices = maxIndex <= 65535 ? new Uint16Array(geometry.indices) : new Uint32Array(geometry.indices);
  return { ...arrays, bounds, maxIndex };
}

function prepareScene(input, defaultMaterial, prepare = prepareGeometry) {
  if (input === null) return [];
  if (!Array.isArray(input) || input.length > 20000) throw new Error("Scene must contain at most 20000 independent meshes.");
  const ids = new Set(); let unit = null;
  return input.map(item => {
    if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id)) throw new Error("Scene mesh IDs must be nonempty and unique.");
    ids.add(item.id);
    const geometry = prepare(item.geometry);
    if (unit !== null && unit !== item.geometry.unit) throw new Error("All scene meshes must use the same explicit unit.");
    unit = item.geometry.unit;
    return { id: item.id, geometry, material: resolveMaterial(item.material ?? {}, defaultMaterial) };
  });
}

function sceneBounds(scene) {
  return { min: [0, 1, 2].map(axis => Math.min(...scene.map(item => item.geometry.bounds.min[axis]))),
    max: [0, 1, 2].map(axis => Math.max(...scene.map(item => item.geometry.bounds.max[axis]))) };
}

/** Owns one TEST_ONLY canvas/context. Immutable geometry identity is the upload
 * key; callers supply a new object when any vertex/index/UV data changes.
 * update({geometry:null}) clears; omitted geometry retains. Updates are atomic
 * on invalid input. View target/distance share geometry.unit; nothing is scaled.
 * update({scene:[{id,geometry,material}]}) draws independent meshes in one depth-tested
 * frame; scene null/[] or geometry:null clears. Scene and geometry are exclusive.
 * Scene entries own their materials; replace scene to change those materials.
 * Optional material.pbr uses existing asset references, only BaseColor/Roughness;
 * scanAxis x/y and the tube UV repeat are VISUAL_ASSUMPTION. ready() waits for
 * supported images and draws once; getDiagnostics() reports channels/resources.
 * Async image failures clear the scene. Invalid synchronous updates remain atomic.
 * All drawing is on demand. suspend preserves GPU data; resume restarts drawing.
 */
export function createYarnSpatialPreviewRenderer({ onViewChange, onStatusChange, swatchLighting = false, scanHalfWidth = 1 } = {}) {
  let container = null, canvas = null, win = null, gl = null, observer = null;
  let geometryIdentity = null, geometry = null, uploadedGeometry = null, buffers = [];
  let drawItems = [], batchOrder = "source", debugMode = "pbr";
  const geometryCache = new WeakMap();
  let geometryCacheHits = 0, geometryCacheMisses = 0;
  const prepareOwnedGeometry = source => {
    const cached = source && geometryCache.get(source);
    if (cached) { geometryCacheHits++; return cached; }
    const result = prepareGeometry(source); geometryCache.set(source, result); geometryCacheMisses++; return result;
  };
  let sceneIdentity = null, scene = null;
  let program = null, attributes = null, uniforms = null, frameId = null, generation = 0;
  let disposed = false, suspended = false, contextLost = false, failure = null, drag = null;
  let view = resolveYarnSpatialView().view, material = resolveMaterial({}, DEFAULT_MATERIAL);
  let status = Object.freeze({ status: "NOT_MOUNTED", diagnostic: "Mount a container to create the TEST_ONLY spatial canvas." });
  const listeners = [];
  const imageOwner = {}, textures = new Map();
  let textureGeneration = 0, imageTools = null, textureReady = Promise.resolve(), texturesLoading = false;
  let materialReports = [], bufferBytes = 0, lastDrawCalls = 0, frameCount = 0, drawCpuMs = 0;
  let previousFrameAt = null, activeFrameIntervals = [];
  let profile = null, uploadCpuMs = 0, submitCpuMs = 0;
  const mapKey = map => map?.assetRef ? `asset:${map.assetRef}` : map?.processedDataUrl || map?.dataUrl || "";
  const now = () => globalThis.performance?.now() ?? Date.now();
  const notify = (callback, value) => { try { callback?.(value); } catch { /* Host notifications cannot strand owned resources. */ } };
  const setStatus = (state, diagnostic = "") => {
    if (status.status !== state || status.diagnostic !== diagnostic) {
      status = Object.freeze({ status: state, diagnostic }); notify(onStatusChange, status);
    }
    return status;
  };
  const currentStatus = () => disposed ? setStatus("DISPOSED") : contextLost ? setStatus("CONTEXT_LOST", "WebGL context lost; waiting for restoration.") :
    failure ? setStatus("UNAVAILABLE", failure) : suspended ? setStatus("SUSPENDED") : !canvas ? setStatus("NOT_MOUNTED") :
      !geometry ? setStatus("EMPTY") : texturesLoading ? setStatus("LOADING_TEXTURES", "Preparing existing BaseColor and Roughness assets.") : setStatus("OK");
  const cancelFrame = () => { generation++; if (frameId !== null) win?.cancelAnimationFrame(frameId); frameId = null; };
  const releaseDrag = () => {
    const pointerId = drag?.pointerId; drag = null;
    if (pointerId !== undefined) try { if (canvas?.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId); } catch { /* Capture can end during teardown. */ }
  };
  const clearDebugBuffers = () => {
    for (const item of drawItems) if (item.wireBuffer) {
      if (gl && !contextLost) gl.deleteBuffer(item.wireBuffer);
      bufferBytes -= item.wireBytes;
      item.wireBuffer = null; item.wireBytes = 0;
    }
  };
  const clearBuffers = () => {
    clearDebugBuffers();
    if (gl && !contextLost) for (const buffer of buffers) gl.deleteBuffer(buffer);
    buffers = []; drawItems = []; uploadedGeometry = null; bufferBytes = 0; lastDrawCalls = 0;
  };
  const clearTextureGpu = () => {
    for (const entry of textures.values()) {
      if (gl && entry.texture && !contextLost) gl.deleteTexture(entry.texture);
      entry.texture = null;
    }
  };
  const clearGpu = () => {
    clearTextureGpu(); clearBuffers(); if (gl && program && !contextLost) gl.deleteProgram(program);
    program = null; attributes = uniforms = null;
  };
  const aspect = () => container?.clientWidth > 0 && container?.clientHeight > 0 ? container.clientWidth / container.clientHeight : 1;
  const applyView = next => { if (!sameView(view, next)) { view = next; notify(onViewChange, view); } };
  const schedule = () => {
    if (disposed || suspended || contextLost || failure || !gl || frameId !== null) return;
    const ticket = generation;
    frameId = win.requestAnimationFrame(() => { if (ticket !== generation || disposed) return; frameId = null; draw(); });
  };
  const listen = (target, event, handler, options) => { target.addEventListener(event, handler, options); listeners.push([target, event, handler, options]); };

  function finishProfile(state = "OK", reason = "") {
    if (!profile) return;
    const run = profile; profile = null;
    if (run.raf !== null) win?.cancelAnimationFrame(run.raf);
    if (!contextLost) for (const query of run.queries) run.timer?.deleteQueryEXT(query);
    const summarize = values => {
      const sorted = [...values].sort((a, b) => a - b);
      return { samples: values.length, mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
        p95: sorted.length ? sorted[Math.ceil(sorted.length * .95) - 1] : null };
    };
    const intervals = run.times.slice(1).map((value, i) => value - run.times[i]);
    const stats = api.getDiagnostics();
    view = run.view; notify(onViewChange, view);
    run.resolve({ status: state, reason, frames: run.cpu.length, requestedFrames: run.frames,
      fps: intervals.length ? 1000 * intervals.length / intervals.reduce((a, b) => a + b, 0) : null,
      frameMs: summarize(intervals), cpuDrawMs: summarize(run.cpu), cpuSubmitMs: summarize(run.submit), cpuUploadMs: summarize(run.upload),
      gpu: { status: !run.timer ? "UNAVAILABLE" : run.disjoint ? "DISJOINT_DISCARDED" : run.queries.length ? "TIMEOUT_PARTIAL" : "AVAILABLE",
        unit: "ms", ...summarize(run.gpu), reason: !run.timer ? "EXT_disjoint_timer_query unavailable; CPU timing is not GPU time." : "Asynchronous TIME_ELAPSED_EXT around mesh submission; excludes uploads." },
      capabilities: run.capabilities, viewport: [canvas?.width, canvas?.height], camera: run.view,
      meshCount: stats.meshCount, drawCalls: stats.drawCalls, batchOrder: stats.batchOrder, triangleCount: stats.triangleCount,
      debugMode: stats.debugMode,
      bufferCount: stats.bufferCount, bufferBytes: stats.bufferBytes, textureBytes: stats.textureBytes, gpuBytes: stats.gpuBytes,
      methodology: "One warm renderer frame per requestAnimationFrame, 360 degree orbit, no host UI notification per sample; restores original camera. No gl.finish or synchronous GPU wait." });
    schedule();
  }

  function pollProfileGpu() {
    if (!profile?.timer) return;
    const run = profile, ext = run.timer;
    if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
      run.disjoint = true; run.gpu.length = 0;
      for (const query of run.queries) ext.deleteQueryEXT(query);
      run.queries.length = 0; return;
    }
    while (run.queries.length && ext.getQueryObjectEXT(run.queries[0], ext.QUERY_RESULT_AVAILABLE_EXT)) {
      const query = run.queries.shift(), ns = ext.getQueryObjectEXT(query, ext.QUERY_RESULT_EXT);
      if (!run.disjoint && Number.isFinite(ns) && ns >= 0) run.gpu.push(ns / 1e6);
      ext.deleteQueryEXT(query);
    }
  }

  function releaseTextures(releaseImages = true) {
    textureGeneration++; texturesLoading = false; clearTextureGpu(); textures.clear(); materialReports = [];
    if (releaseImages) imageTools?.releaseYarnTextureImages(imageOwner);
  }

  function prepareTextures() {
    // Retain identical GPU images across filtering/material rebinding; the shared
    // asset owner below still updates its live source set and releases unused data.
    const previousTextures = new Map(textures);
    textureGeneration++; texturesLoading = false; textures.clear(); materialReports = [];
    const ticket = textureGeneration, items = scene ?? (geometry ? [{ material }] : []);
    const materialKeys = new Set(), textureMaterials = [];
    for (const item of items) {
      const pbr = item.material.pbr;
      const key = JSON.stringify([item.material.scanAxis, ...["baseColor", "roughness", "normal", "ambientOcclusion", "height", "metallic"].map(channel => mapKey(pbr?.[channel]))]);
      if (materialKeys.has(key)) continue;
      materialKeys.add(key);
      const channels = {};
      for (const channel of ["baseColor", "roughness"]) {
        const map = pbr?.[channel], sourceKey = mapKey(map);
        channels[channel] = { status: sourceKey ? "LOADING" : "NOT_ASSIGNED", fileName: map?.fileName || "", sourceKey,
          colorSpace: channel === "baseColor" ? "sRGB -> linear" : "linear scalar R" };
        if (sourceKey && !textures.has(sourceKey)) textures.set(sourceKey, previousTextures.get(sourceKey) ?? { map, image: null, texture: null, width: 0, height: 0, bytes: 0, levels: 0 });
      }
      for (const [channel, reason] of [["normal", "Scan TBN axis/handedness is unverified; geometry normals only."],
        ["ambientOcclusion", "2D scan AO is not 3D self-occlusion; disabled."], ["height", "No calibrated displacement scale; disabled."]]) {
        channels[channel] = { status: "UNSUPPORTED", assigned: Boolean(mapKey(pbr?.[channel])), reason };
      }
      channels.metallic = { status: "NONMETALLIC_BASELINE", assigned: Boolean(mapKey(pbr?.metallic)), value: 0, reason: "No metallic material evidence; input map disabled." };
      materialReports.push({ channels, mapping: { status: "VISUAL_ASSUMPTION", scanAxis: item.material.scanAxis,
        uv: "U = cumulative arc length / TEST_ONLY repeat; V = normalized circumference",
        transverse: "Mirrored V samples a centered scan strip; its width is relative to the axial texture repeat.",
        scanWidthFraction: scanHalfWidth,
        alpha: "BaseColor alpha composites onto fallback color; does not remove tube geometry.",
        minification: "POT maps use trilinear mipmaps; RGBA8 encoded-color averaging is a VISUAL_ASSUMPTION, not linear-light filtering. NPOT maps retain LINEAR. U fract derivatives and uncalibrated scan edges can still show repeat-boundary artifacts.",
        physicalScale: "NOT_CALIBRATED; project YarnAsset is unchanged." } });
      if (pbr?.baseColor || pbr?.roughness) textureMaterials.push({ texture: { pbr: { baseColor: pbr.baseColor, roughness: pbr.roughness } } });
    }
    for (const [key, entry] of previousTextures) if (!textures.has(key)) {
      if (entry.texture && gl && !contextLost) gl.deleteTexture(entry.texture);
      entry.texture = null;
    }
    if (!textures.size) { imageTools?.releaseYarnTextureImages(imageOwner); textureReady = Promise.resolve(); return; }
    texturesLoading = true;
    textureReady = (async () => {
      const helpers = await import("./yarnTextureBrush.js");
      if (ticket !== textureGeneration || disposed) return;
      imageTools = helpers; helpers.retainYarnAssetTextureImages(textureMaterials, imageOwner);
      const results = await helpers.prepareYarnTextureImages(textureMaterials);
      if (ticket !== textureGeneration || disposed) return;
      const rejected = results.find(result => result.status === "rejected");
      if (rejected) throw rejected.reason;
      for (const entry of textures.values()) {
        entry.image = helpers.getReadyYarnTextureImage(helpers.getYarnPbrMapSource(entry.map));
        entry.width = entry.image?.naturalWidth || entry.image?.width;
        entry.height = entry.image?.naturalHeight || entry.image?.height;
        if (!(entry.width > 0 && entry.height > 0)) throw new Error("PBR image has no decoded dimensions.");
      }
      for (const report of materialReports) for (const channel of ["baseColor", "roughness"]) {
        const entry = textures.get(report.channels[channel].sourceKey);
        if (entry) Object.assign(report.channels[channel], { status: "SUPPORTED_VISUAL", dimensions: [entry.width, entry.height] });
      }
      texturesLoading = false; currentStatus(); schedule();
    })().catch(error => {
      if (ticket !== textureGeneration || disposed) return;
      releaseTextures(); clearBuffers(); geometry = geometryIdentity = scene = sceneIdentity = null;
      failure = `PBR preparation failed: ${String(error.message || error)}`;
      if (gl && !contextLost) gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      currentStatus();
    });
  }

  function uploadTextures() {
    for (const entry of textures.values()) {
      if (!entry.image || entry.texture) continue;
      if (Math.max(entry.width, entry.height) > gl.getParameter(gl.MAX_TEXTURE_SIZE)) throw new Error("PBR image exceeds this GPU texture size limit.");
      entry.texture = gl.createTexture(); if (!entry.texture) throw new Error("WebGL could not allocate a PBR texture.");
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, entry.image);
      for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.CLAMP_TO_EDGE);
      const powerOfTwo = value => (value & (value - 1)) === 0;
      const mipmaps = powerOfTwo(entry.width) && powerOfTwo(entry.height);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      entry.levels = 1; entry.bytes = entry.width * entry.height * 4;
      if (mipmaps) {
        // A tube seen obliquely can cover many scan texels around its circumference
        // while retaining detail along the yarn. Filter those directions independently.
        const filter = swatchLighting && gl.getExtension("EXT_texture_filter_anisotropic");
        if (filter) {
          const limit = gl.getParameter(filter.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
          gl.texParameterf(gl.TEXTURE_2D, filter.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(limit, 4));
        }
        gl.generateMipmap(gl.TEXTURE_2D);
        let width = entry.width, height = entry.height;
        while (width > 1 || height > 1) {
          width = Math.max(1, width / 2); height = Math.max(1, height / 2);
          entry.bytes += width * height * 4; entry.levels++;
        }
      }
    }
  }

  function createProgram() {
    const shaders = [];
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX_SHADER], [gl.FRAGMENT_SHADER, FRAGMENT_SHADER]]) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("WebGL could not allocate a shader.");
        shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`Spatial shader failed: ${gl.getShaderInfoLog(shader)}`);
      }
      program = gl.createProgram(); if (!program) throw new Error("WebGL could not allocate a program.");
      for (const shader of shaders) gl.attachShader(program, shader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Spatial program failed: ${gl.getProgramInfoLog(program)}`);
      attributes = ["a_position", "a_normal", "a_tangent", "a_uv"].map(name => gl.getAttribLocation(program, name));
      if (attributes.some(location => location < 0)) throw new Error("Spatial shader is missing a geometry attribute.");
      uniforms = Object.fromEntries(["model", "view", "projection", "eye", "color", "lightDirection", "roughness", "anisotropy", "ambient", "lightIntensity", "swatchLighting", "scanHalfWidth", "debugMode", "uvReference", "hasBaseColor", "hasRoughness", "scanAxisY", "baseColorMap", "roughnessMap"]
        .map(name => [name, gl.getUniformLocation(program, `u_${name}`)]));
    } finally {
      for (const shader of shaders) gl.deleteShader(shader);
    }
  }

  function uploadGeometry() {
    clearBuffers();
    const items = scene ?? [{ id: "geometry", geometry, material }];
    if (items.some(item => item.geometry.maxIndex > 65535) && !gl.getExtension("OES_element_index_uint")) {
      throw new Error("This mesh requires OES_element_index_uint in WebGL1; reduce sampling or use a supporting device.");
    }
    // Default source order preserves LEQUAL ties. Visual swatches can explicitly
    // allow material sorting; tied fragments may then have a different winner.
    // No vertex/triangle changes; 16-bit chunks need no new WebGL extension.
    const groups = [], byMaterial = new Map();
    for (const item of items) {
      const m = item.material;
      const key = JSON.stringify([m.color, m.lightDirection, m.roughness, m.anisotropy, m.ambient, m.lightIntensity,
        m.mode, m.scanAxis, mapKey(m.pbr?.baseColor), mapKey(m.pbr?.roughness)]);
      let group = batchOrder === "material" ? byMaterial.get(key) : groups.at(-1)?.key === key ? groups.at(-1) : null;
      if (!group) { group = { key, items: [] }; groups.push(group); byMaterial.set(key, group); }
      group.items.push(item);
    }
    const upload = chunk => {
      const vertices = chunk.reduce((sum, item) => sum + item.geometry.positions.length / 3, 0);
      const count = chunk.reduce((sum, item) => sum + item.geometry.indices.length, 0);
      // Staging arrays exist only during upload; retained ranges refer to source IDs.
      const arrays = chunk.length === 1 ? chunk[0].geometry : {
        positions: new Float32Array(vertices * 3), normals: new Float32Array(vertices * 3), tangents: new Float32Array(vertices * 3),
        uv: new Float32Array(vertices * 2), indices: new Uint16Array(count), maxIndex: 0 };
      let vertexOffset = 0, indexOffset = 0;
      const ranges = [];
      for (const item of chunk) {
        const g = item.geometry;
        ranges.push({ id: item.id, batch: drawItems.length, indexOffset, indexCount: g.indices.length });
        if (chunk.length > 1) {
          for (const name of ["positions", "normals", "tangents", "uv"]) arrays[name].set(g[name], vertexOffset * (name === "uv" ? 2 : 3));
          for (let i = 0; i < g.indices.length; i++) arrays.indices[indexOffset + i] = g.indices[i] + vertexOffset;
          arrays.maxIndex = Math.max(arrays.maxIndex, g.maxIndex + vertexOffset);
        }
        vertexOffset += g.positions.length / 3; indexOffset += g.indices.length;
      }
      for (const [name, target] of [["positions", gl.ARRAY_BUFFER], ["normals", gl.ARRAY_BUFFER], ["tangents", gl.ARRAY_BUFFER], ["uv", gl.ARRAY_BUFFER], ["indices", gl.ELEMENT_ARRAY_BUFFER]]) {
        const buffer = gl.createBuffer(); if (!buffer) throw new Error("WebGL could not allocate a geometry buffer.");
        buffers.push(buffer); gl.bindBuffer(target, buffer); gl.bufferData(target, arrays[name], gl.STATIC_DRAW); bufferBytes += arrays[name].byteLength;
      }
      drawItems.push({ material: chunk[0].material, indexCount: count, maxIndex: arrays.maxIndex, ranges,
        wireSources: chunk.map(item => item.geometry), wireBuffer: null, wireBytes: 0 });
    };
    for (const { items: group } of groups) {
      let chunk = [], vertices = 0;
      for (const item of group) {
        const size = item.geometry.positions.length / 3;
        if (chunk.length && vertices + size > 65535) { upload(chunk); chunk = []; vertices = 0; }
        chunk.push(item); vertices += size;
      }
      if (chunk.length) upload(chunk);
    }
    uploadedGeometry = geometry;
  }

  function uploadWireframe() {
    for (const item of drawItems) {
      if (item.wireBuffer) continue;
      const indices = item.maxIndex <= 65535 ? new Uint16Array(item.indexCount * 2) : new Uint32Array(item.indexCount * 2);
      let cursor = 0, vertexOffset = 0;
      for (const source of item.wireSources) {
        for (let i = 0; i < source.indices.length; i += 3) {
          const a = source.indices[i] + vertexOffset, b = source.indices[i + 1] + vertexOffset, c = source.indices[i + 2] + vertexOffset;
          indices.set([a, b, b, c, c, a], cursor); cursor += 6;
        }
        vertexOffset += source.positions.length / 3;
      }
      item.wireBuffer = gl.createBuffer(); if (!item.wireBuffer) throw new Error("WebGL could not allocate wireframe indices.");
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, item.wireBuffer); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
      item.wireBytes = indices.byteLength; bufferBytes += item.wireBytes;
    }
  }

  function draw() {
    if (disposed || suspended || contextLost || failure || !gl) return currentStatus();
    const width = container.clientWidth, height = container.clientHeight;
    if (!(width > 0 && height > 0)) return setStatus("ZERO_SIZE", "Spatial canvas is waiting for a nonzero container size.");
    try {
      const startedAt = now();
      const pixelRatio = clamp(Number.isFinite(win.devicePixelRatio) ? win.devicePixelRatio : 1, 1, 2);
      const maxSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
      const scale = Math.min(pixelRatio, maxSize / width, maxSize / height);
      const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      gl.viewport(0, 0, w, h); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LEQUAL); gl.clearDepth(1);
      gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW); gl.disable(gl.BLEND);
      if (swatchLighting) gl.clearColor(0.80, 0.80, 0.78, 1);
      else gl.clearColor(0.035, 0.045, 0.065, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (!geometry) { lastDrawCalls = 0; return setStatus("EMPTY"); }
      if (texturesLoading) return currentStatus();
      const camera = buildYarnSpatialCamera(view, w / h, geometry.bounds);
      if (camera.status !== "OK") return setStatus("INVALID", camera.diagnostic);
      if (!program) createProgram();
      const uploadStarted = now();
      if (uploadedGeometry !== geometry) uploadGeometry();
      if (debugMode === "wireframe") uploadWireframe();
      uploadTextures(); gl.useProgram(program);
      uploadCpuMs = now() - uploadStarted;
      const submitStarted = now(), timer = profile?.timer;
      const query = timer && !profile.disjoint ? timer.createQueryEXT() : null;
      if (query) { timer.beginQueryEXT(timer.TIME_ELAPSED_EXT, query); profile.queries.push(query); profile.activeQuery = true; }
      for (const [name, matrix] of [["model", IDENTITY], ["view", camera.view], ["projection", camera.projection]]) gl.uniformMatrix4fv(uniforms[name], false, matrix);
      gl.uniform3fv(uniforms.eye, camera.eye);
      gl.uniform1i(uniforms.swatchLighting, swatchLighting ? 1 : 0);
      gl.uniform1f(uniforms.scanHalfWidth, scanHalfWidth);
      gl.uniform1i(uniforms.debugMode, debugMode === "pbr" ? 0 : debugMode === "normals" ? 2 : 1);
      const items = drawItems;
      for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
        const item = items[itemIndex], itemMaterial = scene === null ? material : item.material;
        for (let i = 0; i < 4; i++) {
          gl.bindBuffer(gl.ARRAY_BUFFER, buffers[itemIndex * 5 + i]); gl.enableVertexAttribArray(attributes[i]);
          gl.vertexAttribPointer(attributes[i], i === 3 ? 2 : 3, gl.FLOAT, false, 0, 0);
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, debugMode === "wireframe" ? item.wireBuffer : buffers[itemIndex * 5 + 4]);
        gl.uniform3fv(uniforms.color, itemMaterial.color); gl.uniform3fv(uniforms.lightDirection, itemMaterial.lightDirection);
        for (const name of ["roughness", "anisotropy", "ambient", "lightIntensity"]) gl.uniform1f(uniforms[name], itemMaterial[name]);
        gl.uniform1i(uniforms.uvReference, itemMaterial.mode === "uv-reference" ? 1 : 0);
        gl.uniform1i(uniforms.scanAxisY, itemMaterial.scanAxis === "y" ? 1 : 0);
        for (const [channel, flag, unit] of [["baseColor", "hasBaseColor", 0], ["roughness", "hasRoughness", 1]]) {
          const texture = textures.get(mapKey(itemMaterial.pbr?.[channel]))?.texture;
          gl.uniform1i(uniforms[flag], texture ? 1 : 0);
          gl.uniform1i(uniforms[`${channel}Map`], unit);
          if (texture) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture); }
        }
        gl.drawElements(debugMode === "wireframe" ? gl.LINES : gl.TRIANGLES,
          item.indexCount * (debugMode === "wireframe" ? 2 : 1), item.maxIndex <= 65535 ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT, 0);
      }
      if (query) { timer.endQueryEXT(timer.TIME_ELAPSED_EXT); profile.activeQuery = false; }
      submitCpuMs = now() - submitStarted;
      const error = gl.getError(); if (error !== gl.NO_ERROR) throw new Error(`WebGL draw failed (${error}).`);
      lastDrawCalls = items.length; frameCount++; drawCpuMs = now() - startedAt;
      if (previousFrameAt !== null && startedAt - previousFrameAt < 250 && startedAt > previousFrameAt) {
        activeFrameIntervals.push(startedAt - previousFrameAt); if (activeFrameIntervals.length > 60) activeFrameIntervals.shift();
      }
      previousFrameAt = startedAt;
      return setStatus("OK");
    } catch (error) {
      if (gl.isContextLost()) { onContextLost(); return status; }
      if (profile?.activeQuery) { profile.timer.endQueryEXT(profile.timer.TIME_ELAPSED_EXT); profile.activeQuery = false; }
      clearGpu(); releaseTextures(); geometry = geometryIdentity = scene = sceneIdentity = null;
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      failure = String(error.message || error); return setStatus("UNAVAILABLE", failure);
    }
  }

  function onContextLost(event) {
    if (disposed) return;
    event?.preventDefault(); contextLost = true; finishProfile("CANCELLED", "Context lost"); cancelFrame(); releaseDrag(); clearGpu(); currentStatus();
  }
  function onContextRestored() {
    if (disposed) return;
    contextLost = false; failure = null; currentStatus(); schedule();
  }
  function attachControls() {
    listen(canvas, "webglcontextlost", onContextLost);
    listen(canvas, "webglcontextrestored", onContextRestored);
    listen(canvas, "pointerdown", event => {
      if (suspended || contextLost || event.button !== 0 || drag) return;
      event.preventDefault(); canvas.focus();
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      try { canvas.setPointerCapture(event.pointerId); } catch { releaseDrag(); }
    });
    listen(canvas, "pointermove", event => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      drag.x = event.clientX; drag.y = event.clientY;
      api.setView({ yaw: view.yaw - dx * 0.008, pitch: clamp(view.pitch + dy * 0.008, -Math.PI / 2, Math.PI / 2) });
    });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) listen(canvas, event, value => {
      if (value.pointerId === drag?.pointerId) releaseDrag();
    });
    listen(canvas, "blur", releaseDrag);
    listen(canvas, "wheel", event => {
      if (suspended || contextLost || !Number.isFinite(event.deltaY)) return;
      event.preventDefault();
      const amount = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientHeight : 1);
      api.setView({ distance: clamp(view.distance * Math.exp(clamp(amount * 0.001, -1, 1)), 1e-6, 1e12) });
    }, { passive: false });
    listen(canvas, "keydown", event => {
      if (suspended || contextLost) return;
      const commands = {
        ArrowLeft: () => api.setView({ yaw: view.yaw + 0.1 }), ArrowRight: () => api.setView({ yaw: view.yaw - 0.1 }),
        ArrowUp: () => api.setView({ pitch: clamp(view.pitch + 0.1, -Math.PI / 2, Math.PI / 2) }),
        ArrowDown: () => api.setView({ pitch: clamp(view.pitch - 0.1, -Math.PI / 2, Math.PI / 2) }),
        "+": () => api.setView({ distance: Math.max(1e-6, view.distance / 1.1) }),
        "-": () => api.setView({ distance: Math.min(1e12, view.distance * 1.1) }), Home: () => api.fit(),
      };
      if (commands[event.key]) { event.preventDefault(); commands[event.key](); }
    });
  }

  const api = {
    get canvas() { return canvas; }, get view() { return view; }, get status() { return status; },
    getSourceRanges() { return drawItems.flatMap(item => item.ranges.map(range => ({ ...range }))); },
    async ready() { await textureReady; if (!disposed) api.render(); return status; },
    profileOrbit({ frames = 64 } = {}) {
      if (profile) return Promise.resolve({ status: "INVALID", reason: "A profile is already running." });
      if (!Number.isInteger(frames) || frames < 8 || frames > 240 || currentStatus().status !== "OK") {
        return Promise.resolve({ status: "INVALID", reason: "A ready scene and 8..240 frames are required." });
      }
      cancelFrame();
      const ext = gl.getExtension("EXT_disjoint_timer_query");
      const timer = ext && ["createQueryEXT", "beginQueryEXT", "endQueryEXT", "getQueryObjectEXT", "deleteQueryEXT"].every(key => typeof ext[key] === "function") ? ext : null;
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      const capabilities = { webgl: 1, timerQuery: Boolean(timer), vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : "UNAVAILABLE",
        renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "UNAVAILABLE" };
      return new Promise(resolve => {
        profile = { resolve, frames, view, timer, capabilities, queries: [], gpu: [], cpu: [], submit: [], upload: [], times: [], disjoint: false, raf: null, polls: 0 };
        const tick = () => {
          if (!profile) return;
          const run = profile; run.raf = null; pollProfileGpu();
          if (run.cpu.length < frames) {
            view = { ...run.view, yaw: run.view.yaw + 2 * Math.PI * run.cpu.length / frames };
            run.times.push(now()); draw();
            if (status.status !== "OK") { finishProfile("CANCELLED", status.status); return; }
            run.cpu.push(drawCpuMs); run.submit.push(submitCpuMs); run.upload.push(uploadCpuMs);
          } else if (!run.queries.length || ++run.polls >= 60) { finishProfile(); return; }
          run.raf = win.requestAnimationFrame(tick);
        };
        profile.raf = win.requestAnimationFrame(tick);
      });
    },
    getDiagnostics() {
      const items = scene ?? (geometry ? [{ geometry }] : []), uploadedTextures = [...textures.values()].filter(entry => entry.texture);
      return { meshCount: items.length, drawCalls: lastDrawCalls, batchCount: drawItems.length, batchOrder, debugMode,
        debugMeaning: "Display evidence only; unlit/wireframe use unchanged source colors without textures or lighting; normals map world geometry normals to RGB. Wireframe draws every triangle edge, not a boundary or manifold diagnosis.",
        debugLineCount: debugMode === "wireframe" ? drawItems.reduce((sum, item) => sum + item.indexCount, 0) : 0,
        batchOrderMeaning: batchOrder === "source" ? "Preserves source ordering, including equal-depth LEQUAL ties." : "VISUAL_ASSUMPTION: opaque materials sorted; equal-depth ties may select a different source. All source ranges and triangles retained.",
        geometryCacheHits, geometryCacheMisses,
        triangleCount: items.reduce((sum, item) => sum + item.geometry.indices.length / 3, 0),
        vertexCount: items.reduce((sum, item) => sum + item.geometry.positions.length / 3, 0),
        bufferCount: buffers.length + drawItems.filter(item => item.wireBuffer).length, bufferBytes, textureCount: uploadedTextures.length,
        textureLevel0Bytes: uploadedTextures.reduce((sum, entry) => sum + entry.width * entry.height * 4, 0),
        textureBytes: uploadedTextures.reduce((sum, entry) => sum + entry.bytes, 0),
        textureMipLevels: uploadedTextures.map(entry => entry.levels),
        gpuBytes: bufferBytes + uploadedTextures.reduce((sum, entry) => sum + entry.bytes, 0),
        gpuBytesMeaning: "Allocated buffer payload + RGBA8 textures including all mip levels; excludes browser/driver overhead and framebuffer.",
        frameCount, drawCpuMs, uploadCpuMs, submitCpuMs, profiling: Boolean(profile), activeFrameFps: activeFrameIntervals.length ? 1000 * activeFrameIntervals.length / activeFrameIntervals.reduce((a, b) => a + b, 0) : null,
        timingMeaning: "CPU draw submission and intervals between demand frames <250ms; not GPU execution timing.",
        materials: materialReports };
    },
    mount(target) {
      if (disposed) return currentStatus();
      if (container) return container === target ? api.resume() : setStatus("INVALID", "Dispose before mounting a different container.");
      if (!target?.ownerDocument || typeof target.appendChild !== "function" || target.childElementCount !== 0) {
        return setStatus("INVALID", "Mount requires an empty DOM container; the renderer creates and owns its canvas.");
      }
      container = target; win = container.ownerDocument.defaultView;
      canvas = container.ownerDocument.createElement("canvas");
      canvas.style.width = "100%"; canvas.style.height = "100%"; canvas.style.display = "block"; canvas.style.touchAction = "none";
      canvas.tabIndex = 0; canvas.setAttribute("aria-label", "TEST_ONLY spatial yarn preview. Drag or arrow keys to orbit; wheel or plus/minus to zoom; Home to fit.");
      container.appendChild(canvas); attachControls();
      try {
        gl = canvas.getContext("webgl", { alpha: false, depth: true, antialias: true, preserveDrawingBuffer: false });
        if (!gl) throw new Error("WebGL1 is unavailable for the spatial preview.");
        if (win.ResizeObserver) { observer = new win.ResizeObserver(schedule); observer.observe(container); }
        else listen(win, "resize", schedule);
        currentStatus(); schedule();
      } catch (error) { failure = String(error.message || error); setStatus("UNAVAILABLE", failure); }
      return status;
    },
    update(input = {}) {
      if (disposed) return currentStatus();
      if (!input || typeof input !== "object" || Array.isArray(input)) return setStatus("INVALID", "Scene update must be an object.");
      try {
        if (has(input, "scene") && has(input, "geometry")) throw new Error("Supply scene or geometry, not both.");
        const nextBatchOrder = has(input, "batchOrder") ? input.batchOrder : batchOrder;
        if (!["source", "material"].includes(nextBatchOrder)) throw new Error("batchOrder must be source or material.");
        const batchChanged = nextBatchOrder !== batchOrder;
        const nextDebugMode = has(input, "debugMode") ? input.debugMode : debugMode;
        if (!["pbr", "unlit", "normals", "wireframe"].includes(nextDebugMode)) throw new Error("debugMode must be pbr, unlit, normals, or wireframe.");
        const debugChanged = nextDebugMode !== debugMode;
        const nextMaterial = has(input, "material") ? resolveMaterial(input.material, material) : material;
        const sceneChanged = has(input, "scene") && (scene === null || input.scene !== sceneIdentity);
        const geometryChanged = has(input, "geometry") && (scene !== null || input.geometry !== geometryIdentity);
        const changed = sceneChanged || geometryChanged;
        const nextScene = sceneChanged ? prepareScene(input.scene, nextMaterial, prepareOwnedGeometry) : geometryChanged ? null : scene;
        const nextGeometry = sceneChanged ? (nextScene.length ? { bounds: sceneBounds(nextScene) } : null) :
          geometryChanged ? (input.geometry === null ? null : prepareOwnedGeometry(input.geometry)) : geometry;
        let nextView = has(input, "view") ? resolveYarnSpatialView(input.view, view) : { status: "OK", view };
        if (nextView.status !== "OK") throw new Error(nextView.diagnostic);
        if (input.fit && nextGeometry) nextView = fitYarnSpatialView(nextView.view, nextGeometry.bounds, aspect());
        if (nextView.status !== "OK") throw new Error(nextView.diagnostic);
        if (profile && (changed || batchChanged || debugChanged || has(input, "material") || has(input, "view") || input.fit)) finishProfile("CANCELLED", "Scene or user view changed");
        if (changed) {
          clearBuffers(); geometryIdentity = has(input, "geometry") ? input.geometry : null; geometry = nextGeometry;
          scene = nextScene; sceneIdentity = has(input, "scene") ? input.scene : null;
          if (gl && !contextLost) failure = null;
        } else if (batchChanged) clearBuffers();
        if (debugChanged && nextDebugMode !== "wireframe") clearDebugBuffers();
        debugMode = nextDebugMode;
        batchOrder = nextBatchOrder;
        material = nextMaterial; if (changed || (has(input, "material") && scene === null)) prepareTextures(); applyView(nextView.view); currentStatus(); schedule(); return status;
      } catch (error) { return setStatus("INVALID", String(error.message || error)); }
    },
    setView(patch) { return api.update({ view: patch }); },
    fit() { return api.update({ fit: true }); },
    render() { cancelFrame(); return draw(); },
    suspend() { if (!disposed) { suspended = true; finishProfile("CANCELLED", "Suspended"); cancelFrame(); releaseDrag(); } return currentStatus(); },
    resume() { if (!disposed) { suspended = false; currentStatus(); schedule(); } return status; },
    dispose() {
      if (disposed) return status;
      disposed = true; finishProfile("CANCELLED", "Disposed"); cancelFrame(); releaseDrag(); observer?.disconnect(); observer = null;
      for (const [target, event, handler, options] of listeners) target.removeEventListener(event, handler, options);
      listeners.length = 0; releaseTextures(); clearGpu();
      if (gl && !contextLost) gl.getExtension("WEBGL_lose_context")?.loseContext();
      if (canvas) { canvas.width = 1; canvas.height = 1; canvas.remove(); }
      canvas = container = win = gl = geometry = geometryIdentity = scene = sceneIdentity = null;
      return setStatus("DISPOSED");
    },
  };
  return api;
}
