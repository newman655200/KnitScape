import assert from "node:assert/strict";
import { createServer } from "vite";

// Snapshot Maps intentionally reject intrinsic mutation and cannot be passed
// through structuredClone. Copy through their public readers for comparisons;
// retain real Maps/typed arrays and every existing value/identity assertion.
function copyObservedData(value, seen = new Map()) {
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  if (ArrayBuffer.isView(value)) return structuredClone(value);
  const copy = value instanceof Map ? new Map() : Array.isArray(value) ? [] : {};
  seen.set(value, copy);
  if (value instanceof Map) {
    value.forEach((item, key) => copy.set(copyObservedData(key, seen), copyObservedData(item, seen)));
  } else {
    for (const [key, item] of Object.entries(value)) copy[key] = copyObservedData(item, seen);
  }
  return copy;
}

globalThis.devicePixelRatio = 1;
globalThis.window = { location: { search: "" }, setTimeout, clearTimeout,
  btoa: value => Buffer.from(value, "binary").toString("base64") };
const canvasPaths = [];
globalThis.Path2D = class { constructor(data = "") { this.data = data; canvasPaths.push(data); } };
const draws = [], jobs = [], solverInputs = [];
const strokes = [];
const timings = { solverMs: 0, geometryMs: 0, renderMs: 0 };
const counters = { reads: 0, decodes: 0, creates: 0, uploads: 0 };
const observations = { geometryBuilds: 0, drawCalls: 0 };
let webglEnabled = true;
globalThis.__multiYarnDraws = draws;
globalThis.__multiYarnJobs = jobs;
globalThis.__multiYarnTimings = timings;
globalThis.__multiYarnSolverInputs = solverInputs;
globalThis.__multiYarnObservations = observations;
globalThis.__multiYarnStripOptions = new WeakMap();
const server = await createServer({ appType: "custom", logLevel: "silent",
  server: { middlewareMode: true }, plugins: [{ name: "observe-multi-yarn", enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/");
      if (file.endsWith("/src/simulation/yarnUvWebglRenderer.js")) {
        return source.replace("drawStrip(strip, material = {}) {",
          "drawStrip(strip, material = {}) { globalThis.__multiYarnDraws.push({ gl: this.gl, strip, material, options: globalThis.__multiYarnStripOptions.get(strip) });");
      }
      if (file.endsWith("/src/simulation/drawYarnSimulation.js")) {
        return source.replace("export function drawYarnSimulation(", "function observedDraw(") +
          `\nexport function drawYarnSimulation(args) {
            globalThis.__multiYarnObservations.drawCalls++;
            globalThis.__multiYarnDrawArgs = args; const start = performance.now();
            try { return observedDraw(args); }
            finally { globalThis.__multiYarnTimings.renderMs += performance.now() - start; }
          }`;
      }
      if (file.endsWith("/src/simulation/yarnPathUvStrip.js")) {
        return source.replace("export function buildYarnUvStrip(", "function observedStrip(") +
          `\nexport function buildYarnUvStrip(args) {
            const strip = observedStrip(args); globalThis.__multiYarnStripOptions.set(strip, args); return strip;
          }`;
      }
      if (file.endsWith("/src/simulation/yarnLengthSolver.js")) {
        return source.replace("export function solveFeedYarnLengths(", "function observedSolve(") +
          `\nexport function solveFeedYarnLengths(args) {
            globalThis.__multiYarnSolverInputs.push(args.feeds.flatMap(feed => feed.yarns.map(yarn => yarn.yarnLengthCmPer100Needles)));
            const start = performance.now();
            try { return observedSolve(args); }
            finally { globalThis.__multiYarnTimings.solverMs += performance.now() - start; }
          }`;
      }
      if (file.endsWith("/src/simulation/yarnPathGeometry.js")) {
        return source.replace("export function buildYarnPathGeometry(", "function observedGeometry(") +
          `\nexport function buildYarnPathGeometry(args) {
            globalThis.__multiYarnObservations.geometryBuilds++;
            const start = performance.now();
            try { return observedGeometry(args); }
            finally { if (!args.measurementWindow) globalThis.__multiYarnTimings.geometryMs += performance.now() - start; }
          }`;
      }
      if (file.endsWith("/src/simulation/yarnTextureBrush.js")) {
        return source.replace("export function prepareYarnTextureImages(", "function observedPrepare(") +
          `\nexport function prepareYarnTextureImages(...args) {
            const job = observedPrepare(...args); globalThis.__multiYarnJobs.push(job); return job;
          }`;
      }
    },
  }] });
try {
  const { buildYarnUvStrip } = await server.ssrLoadModule("/src/simulation/yarnPathUvStrip.js");
  const offsetStrip = buildYarnUvStrip({ modelPathData: "M 0 0 L 10 0",
    yarnWidth: 0.24, normalOffsetModel: 0.12 });
  assert.ok(Math.abs((offsetStrip.positions[1] + offsetStrip.positions[3]) / 2 - 0.12) < 1e-7,
    "the low-level strip builder must retain explicit nonzero normal offsets.");
  const curvedOptions = { modelPathData: "M 0 0 C 1 3 2 -3 4 0", yarnWidth: 0.24,
    physicalRepeatLengthMm: 8, machineGauge: 32, sampleSpacing: 0.03 };
  const centered = buildYarnUvStrip(curvedOptions);
  for (const normalOffsetModel of [-0.24, -0.12, 0, 0.12, 0.24]) {
    const placed = buildYarnUvStrip({ ...curvedOptions, normalOffsetModel });
    assert.deepEqual(placed.uvs, centered.uvs, "placement cannot change centerline arc length or U.");
    assert.equal(placed.totalModelLength, centered.totalModelLength);
    for (const scale of [0.5, 2, 4]) for (const flip of [-1, 1]) {
      const projected = buildYarnUvStrip({ ...curvedOptions, normalOffsetModel, yarnWidth: 0.24 * scale,
        modelToCanvasPoint: point => ({ x: 70 + point.x * scale * flip, y: -40 + point.y * scale }) });
      assert.deepEqual(projected.uvs, placed.uvs);
      for (let i = 0; i < placed.positions.length; i += 4) {
        const centerX = (placed.positions[i] + placed.positions[i + 2]) / 2;
        const centerY = (placed.positions[i + 1] + placed.positions[i + 3]) / 2;
        assert.ok(Math.abs((projected.positions[i] + projected.positions[i + 2]) / 2 - (70 + centerX * scale * flip)) < 1e-5);
        assert.ok(Math.abs((projected.positions[i + 1] + projected.positions[i + 3]) / 2 - (-40 + centerY * scale)) < 1e-5);
      }
    }
  }
  const [{ simulate }, { Bimp }, { yarnAssetRegistry }, { createYarnAsset }] = await Promise.all([
    "/src/simulation/yarnSimulation.js", "/src/lib/Bimp.js",
    "/src/yarnTexture/yarnAssetRegistry.js", "/src/domain/yarnLibrary.js",
  ].map(file => server.ssrLoadModule(file)));
  const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
  globalThis.Image = class {
    naturalWidth = 8; naturalHeight = 8;
    set src(value) { counters.decodes++; fetch(value).then(response => response.arrayBuffer()).then(() => this.onload()); }
  };
  function canvas() {
    const saved = [];
    const context = { clearRect() {},
      save() { saved.push({ ...this }); }, restore() { Object.assign(this, saved.pop()); }, drawImage() {},
      stroke(path) { strokes.push({ path: path.data, color: this.strokeStyle, width: this.lineWidth,
        alpha: this.globalAlpha, shadow: this.shadowBlur, shadowColor: this.shadowColor,
        shadowX: this.shadowOffsetX, shadowY: this.shadowOffsetY,
        composite: this.globalCompositeOperation, lineCap: this.lineCap, lineJoin: this.lineJoin }); },
      createPattern: () => ({}), globalAlpha: 1, globalCompositeOperation: "source-over",
      shadowBlur: 3, shadowColor: "rgba(1,2,3,0.4)", shadowOffsetX: 2, shadowOffsetY: -1,
      strokeStyle: "#000", lineWidth: 1,
      lineCap: "butt", lineJoin: "miter" };
    const element = { width: 640, height: 480, style: {}, getContext(type) {
      if (type === "2d") return context;
      if (!webglEnabled) return null;
      return element.gl ??= new Proxy({ canvas: element, createShader: () => ({}), createProgram: () => ({}),
        createBuffer: () => ({}), createTexture: () => { counters.creates++; return {}; },
        texImage2D(...args) { if (args.at(-1) instanceof Image) counters.uploads++; }, getShaderParameter: () => true,
        getProgramParameter: () => true, getAttribLocation: () => 0, getUniformLocation: () => 0 },
      { get(target, key) { return key in target ? target[key] : /^[A-Z_0-9]+$/.test(key) ? 1 : () => {}; } });
    } };
    return element;
  }
  const canvases = new Map(["back", "mid", "front"].map(id => [id, canvas()]));
  globalThis.document = { createElement: canvas, getElementById(id) {
    return id === "sim-container" ? { getBoundingClientRect: () => ({ width: 640, height: 480 }) } : canvases.get(id);
  } };
  const slots = ["baseColor", "normal", "roughness", "height", "ambientOcclusion"];
  const library = ["A", "B", "C"].map((id, index) => ({ ...createYarnAsset(id, id), pbr: {
    ...Object.fromEntries(slots.map(slot => [slot, {
      assetRef: yarnAssetRegistry.register(async () => { counters.reads++; return new Blob([bytes], { type: "image/png" }); }),
      fileName: id + "_" + slot + ".png", mimeType: "image/png", byteLength: bytes.length,
    }])), physicalRepeatLengthMm: [8, 15, 10][index],
  } }));
  const feed = (...pairs) => ({ yarns: pairs.map(([yarnId, length]) => ({ yarnId,
    yarnLengthCmPer100Needles: length, tensionCN: null, placement: "parallel" })) });
  const primary = { color: "#999999", diameter: 0.24, enabled: true, texture: null };
  async function render(feeds, options = {}) {
    draws.length = 0; solverInputs.length = 0; canvasPaths.length = 0; strokes.length = 0;
    for (const key of Object.keys(timings)) timings[key] = 0;
    const startCounters = { ...counters }, startDrawCalls = observations.drawCalls, start = performance.now();
    const snapshot = structuredClone(feeds), assetSnapshot = structuredClone(library);
    const { width = 12, height = 4, scale = 1, plies = [primary], keepRunning = false, ...runtime } = options;
    const result = simulate(Bimp.empty(width, height, 0), Bimp.empty(1, height, 0), ["#999999"], scale,
      plies, { feeds, yarnLibrary: library, machineGauge: 32, texturePerformanceMode: "quality", ...runtime });
    while (jobs.length) await Promise.all(jobs.splice(0));
    await new Promise(resolve => setImmediate(resolve));
    if (!keepRunning) result.stopSim();
    assert.deepEqual(feeds, snapshot); assert.deepEqual(library, assetSnapshot);
    return { result, args: globalThis.__multiYarnDrawArgs, draws: [...draws], paths: [...canvasPaths], solverInputs: [...solverInputs],
      frames: observations.drawCalls - startDrawCalls, inputs: { feeds, library: runtime.yarnLibrary ?? library },
      stats: { ...timings, totalMs: performance.now() - start,
        ...Object.fromEntries(Object.keys(counters).map(key => [key, counters[key] - startCounters[key]])) } };
  }
  function assertCanvasCenterlines(scene, frames = 1) {
    const expectedFrame = ["back", "front", "mid"].flatMap(layer =>
      scene.args.yarnStrands.flatMap(strand => scene.args.yarnPathLinks
        .filter(link => link.layer === layer)
        .map(link => strand.resolvedPathByLink.get(link.index))));
    assert.deepEqual(scene.paths, Array.from({ length: frames }, () => expectedFrame).flat(),
      "Canvas must draw each Assignment's own resolvedPath directly, in stable layer/slot order.");
  }
  function assertVisibilitySwitches(scene) {
    const { result, args } = scene;
    assert.equal(result.visibleYarnId, null);
    const allDraws = scene.draws.slice(0, scene.draws.length / scene.frames);
    const allPaths = scene.paths.slice(0, scene.paths.length / scene.frames);
    const stripKeys = new Map([...args.uvStripCache].map(([key, strip]) => [strip, key.split("|").map(Number)]));
    const linksByIndex = new Map(args.yarnPathLinks.map(link => [link.index, link]));
    const fixed = copyObservedData({ inputs: scene.inputs, strands: args.yarnStrands,
      results: result.yarnLengthSolverResults, metrics: result.yarnLengthMetrics,
      materials: args.feedYarnPlies, cache: args.uvStripCache });
    const geometryBuilds = observations.geometryBuilds, solverCalls = solverInputs.length;
    const drawRefs = new Map(allDraws.map(draw => [draw.strip, draw.material]));
    const belongs = (link, slot, id) => args.feedYarnIds.get(link.row % args.feedCount)?.[slot] === id;
    for (const requested of [...result.yarnIds, "not-an-assigned-yarn"]) {
      const selected = result.yarnIds.includes(requested) ? requested : null;
      draws.length = 0; canvasPaths.length = 0;
      assert.equal(result.setVisibleYarnId(requested), selected);
      assert.equal(result.visibleYarnId, selected);
      const current = globalThis.__multiYarnDrawArgs;
      assert.equal(current.visibleYarnId, selected);
      assert.equal(current.yarnStrands, args.yarnStrands, "visibility must retain the captured strand objects.");
      assert.equal(current.feedYarnPlies, args.feedYarnPlies, "visibility must retain material binding identities.");
      assert.equal(current.uvStripCache, args.uvStripCache);
      const expectedDraws = selected === null ? allDraws : allDraws.filter(draw => {
        const [slot, index] = stripKeys.get(draw.strip);
        return belongs(linksByIndex.get(index), slot, selected);
      });
      assert.deepEqual(draws.map(draw => draw.strip), expectedDraws.map(draw => draw.strip),
        "WebGL must draw all and only the selected Yarn ID's existing Feed/slot buffers.");
      draws.forEach((draw, index) => {
        assert.equal(draw.strip, expectedDraws[index].strip, "selection must reuse the same UV strip buffer.");
        assert.equal(draw.material, drawRefs.get(draw.strip), "selection cannot rebind materials.");
      });
      const expectedPaths = selected === null ? allPaths : allDraws.length ? [] : ["back", "front", "mid"].flatMap(layer =>
        args.yarnStrands.flatMap((strand, slot) => args.yarnPathLinks
          .filter(link => link.layer === layer && belongs(link, slot, selected))
          .map(link => strand.resolvedPathByLink.get(link.index))));
      assert.deepEqual(canvasPaths, expectedPaths,
        "Canvas must draw the selected Assignment's own resolved paths, including every matching Feed/slot.");
      assert.equal(observations.geometryBuilds, geometryBuilds, "visibility cannot rebuild geometry.");
      assert.equal(solverInputs.length, solverCalls, "visibility cannot invoke the Solver.");
      assert.deepEqual(copyObservedData({ inputs: scene.inputs, strands: args.yarnStrands,
        results: result.yarnLengthSolverResults, metrics: result.yarnLengthMetrics,
        materials: args.feedYarnPlies, cache: args.uvStripCache }), fixed,
      "visibility cannot mutate inputs, results, model/display paths, UV offsets/buffers or materials.");
    }
    result.stopSim();
    const stoppedDrawCalls = observations.drawCalls;
    result.setVisibleYarnId(result.yarnIds[0] ?? null);
    assert.equal(observations.drawCalls, stoppedDrawCalls, "a stopped preview cannot draw again through its selection setter.");
  }
  // Software checks for the temporary display branch; these do not establish visual readability.
  for (const texturePerformanceMode of ["solid", "quality"]) {
    const scene = await render([feed(["A", 23], ["B", 24]), feed(["B", 24], ["A", 23])],
      { texturePerformanceMode, keepRunning: true });
    const { result, args } = scene;
    assert.equal(typeof result.setStructureLineTrial, "function", "The trial needs a redraw-only switch");
    assert.equal(args.structureLineStyle, null, "The trial is off by default");
    const snapshot = () => copyObservedData({ inputs: scene.inputs, strands: args.yarnStrands,
      links: args.yarnPathLinks, results: result.yarnLengthSolverResults, metrics: result.yarnLengthMetrics,
      validity: result.previewValidity, materials: args.feedYarnPlies, uv: args.uvStripCache });
    const before = snapshot(), builds = observations.geometryBuilds, solves = solverInputs.length;
    const colorsById = new Map();
    for (const id of [null, "A", "B", null]) {
      result.setVisibleYarnId(id);
      strokes.length = 0; draws.length = 0;
      result.setStructureLineTrial(false);
      const normalStrokes = [...strokes], normalDraws = draws.map(draw => draw.strip);
      const preview = result.getOperationPreview(0, 1);
      strokes.length = 0; draws.length = 0;
      assert.equal(result.setStructureLineTrial(true), true);
      const current = globalThis.__multiYarnDrawArgs;
      assert.equal(current.yarnStrands, args.yarnStrands, "Style switches retain the exact resolved paths");
      assert.equal(draws.length, 0, "Trial draws Canvas centerlines, not a new UV representation");
      const expected = ["back", "front", "mid"].flatMap(layer => args.yarnStrands.flatMap((strand, slot) =>
        args.yarnPathLinks.filter(link => link.layer === layer &&
          (id === null || args.feedYarnIds.get(link.row % args.feedCount)[slot] === id))
          .map(link => ({ path: strand.resolvedPathByLink.get(link.index),
            id: args.feedYarnIds.get(link.row % args.feedCount)[slot] }))));
      assert.deepEqual(strokes.map(stroke => stroke.path), expected.map(item => item.path),
        "All visible Assignment paths retain their original order and exact coordinates");
      strokes.forEach((stroke, index) => {
        const yarnId = expected[index].id;
        if (colorsById.has(yarnId)) assert.equal(stroke.color, colorsById.get(yarnId));
        colorsById.set(yarnId, stroke.color);
        assert.equal(stroke.width, devicePixelRatio);
        assert.equal(stroke.alpha, 1); assert.equal(stroke.shadow, 0);
      });
      const highlighted = result.getOperationPreview(0, 1);
      assert.deepEqual(highlighted.paths, preview.paths, "The existing selection and path associations stay intact");
      assert.deepEqual(highlighted.structureLineStyle.colors, colorsById.size === 2
        ? colorsById : current.structureLineStyle.colors);
      strokes.length = 0; draws.length = 0;
      assert.equal(result.setStructureLineTrial(false), false);
      assert.deepEqual(strokes, normalStrokes,
        "Closing restores color, width, alpha, shadow, compositing, line caps/joins and draw order");
      assert.equal(result.getOperationPreview(0, 1).structureLineStyle, null,
        "Closing also removes the temporary highlight style");
      assert.equal(result.visibleYarnId, id);
      assert.deepEqual(draws.map(draw => draw.strip), normalDraws, "Original PBR buffers are reused");
      assert.deepEqual(snapshot(), before, "Paths, U, metrics, Solver, inputs and materials are unchanged");
      assert.equal(observations.geometryBuilds, builds); assert.equal(solverInputs.length, solves);
    }
    assert.equal(new Set(colorsById.values()).size, 2, "Cross-slot Yarn IDs retain distinct colors");
    result.stopSim();
    const drawCount = observations.drawCalls;
    result.setStructureLineTrial(true);
    assert.equal(observations.drawCalls, drawCount, "Stopped previews cannot be redrawn by the trial");
  }
  const duplicate = await render([feed(["A", 23], ["A", 23])], { keepRunning: true });
  assert.deepEqual(duplicate.result.yarnIds, ["A"], "the view choices must deduplicate actual Assignment Yarn IDs.");
  assert.deepEqual(duplicate.solverInputs, [[23]], "identical targets in the same Feed must be solved once, then retain independent slot results.");
  assert.equal(duplicate.result.yarnLengthSolverResults.length, 2);
  assert.notEqual(duplicate.result.yarnLengthSolverResults[0].solvedPathByLink,
    duplicate.result.yarnLengthSolverResults[1].solvedPathByLink);
  const firstOptions = duplicate.draws[0].options;
  const sameLink = duplicate.draws.filter(draw => draw.options.modelPathData === firstOptions.modelPathData
    && draw.options.arcLengthOffset === firstOptions.arcLengthOffset);
  assert.equal(new Set(sameLink.map(draw => draw.strip.uvs)).size, 2,
    "even equal targets/materials must own separate slot UV buffers.");
  assertVisibilitySwitches(duplicate);
  for (const pairs of [[["A", 23]], [["A", 23], ["B", 21]], [["A", 23], ["B", 21], ["C", 25]]]) {
    const scene = await render([feed(...pairs)], { keepRunning: true });
    assert.deepEqual(scene.result.yarnIds, pairs.map(([id]) => id));
    assert.equal(scene.args.yarnStrands.length, pairs.length);
    const refs = new Set(pairs.map(([id]) => library.find(yarn => yarn.id === id).pbr.baseColor.assetRef));
    assert.deepEqual(new Set(scene.draws.map(draw => draw.material.texture.pbr.baseColor.assetRef)), refs);
    const results = scene.result.yarnLengthSolverResults;
    assert.equal(results.length, pairs.length);
    assert.ok(results.every(result => result.converged));
    assert.equal(new Set(results.map(result => result.solvedLoopHeight)).size, pairs.length);
    for (const result of results) {
      const track = scene.args.yarnStrands[result.yarnIndex];
      for (const [index, path] of result.solvedPathByLink) assert.equal(track.modelPathByLink.get(index), path);
    }
    for (const draw of scene.draws) {
      const index = library.findIndex(yarn => yarn.pbr.baseColor.assetRef === draw.material.texture.pbr.baseColor.assetRef);
      const slot = scene.args.feedYarnPlies.get(0).indexOf(draw.material);
      assert.ok(slot >= 0, "each draw must retain its assigned material identity.");
      assert.ok([...scene.args.yarnStrands[slot].modelPathByLink.values()].includes(draw.options.modelPathData),
        "each Assignment must render its own model centerline.");
      assert.equal(draw.options.normalOffsetModel, 0,
        "explicit Assignments must have zero slot-dependent normal offset.");
      const center = buildYarnUvStrip({ ...draw.options, normalOffsetModel: 0 });
      assert.deepEqual(draw.strip.uvs, center.uvs);
      assert.equal(draw.strip.totalModelLength, center.totalModelLength);
      assert.deepEqual(draw.strip.positions, center.positions,
        "Assignment strip positions must use the unshifted model centerline.");
      const expectedU = (draw.options.arcLengthOffset + center.totalModelLength) * (25.4 / 32)
        / library[index].pbr.physicalRepeatLengthMm;
      assert.ok(Math.abs(draw.strip.uvs.at(-2) - expectedU) < 1e-5);
    }
    const orderByLayer = new Map();
    for (const draw of scene.draws) {
      const order = orderByLayer.get(draw.gl) ?? [];
      const index = scene.args.feedYarnPlies.get(0).indexOf(draw.material);
      if (order.at(-1) !== index) order.push(index);
      orderByLayer.set(draw.gl, order);
    }
    for (const order of orderByLayer.values()) order.forEach((index, position) =>
      assert.equal(index, position % pairs.length, "each layer draws stable slot order on every frame."));
    assertVisibilitySwitches(scene);
  }
  const failed = await render([feed(["A", 23], ["B", 8])], { keepRunning: true });
  assert.equal(failed.result.yarnLengthSolverResults[0].converged, true);
  assert.equal(failed.result.yarnLengthSolverResults[1].status, "UNREACHABLE_TARGET");
  assertVisibilitySwitches(failed);
  const base = await render([feed(["A", 0], ["B", 0])], { keepRunning: true });
  assert.deepEqual(copyObservedData(failed.args.yarnStrands[1].modelPathByLink), copyObservedData(base.args.yarnStrands[1].modelPathByLink));
  assert.notDeepEqual(copyObservedData(failed.args.yarnStrands[0].modelPathByLink), copyObservedData(base.args.yarnStrands[0].modelPathByLink));
  assertVisibilitySwitches(base);
  const firstFailed = await render([feed(["A", 8], ["B", 23])]);
  assert.equal(firstFailed.result.yarnLengthSolverResults[0].status, "UNREACHABLE_TARGET");
  assert.equal(firstFailed.result.yarnLengthSolverResults[1].converged, true);
  assert.deepEqual(copyObservedData(firstFailed.args.yarnStrands[0].modelPathByLink), copyObservedData(base.args.yarnStrands[0].modelPathByLink));
  assert.notDeepEqual(copyObservedData(firstFailed.args.yarnStrands[1].modelPathByLink), copyObservedData(base.args.yarnStrands[1].modelPathByLink));
  const reuseFeeds = [feed(["A", 23], ["B", 21]), feed(["C", 25], ["A", 23]), feed(["A", 23], ["B", 21])];
  const reusedLibrary = library.map(asset => ({ ...asset, pbr: { ...asset.pbr,
    ...Object.fromEntries(slots.map(slot => [slot, { ...asset.pbr[slot],
      assetRef: yarnAssetRegistry.register(async () => { counters.reads++; return new Blob([bytes], { type: "image/png" }); }),
    }])) } }));
  const cold = await render(reuseFeeds, { height: 6, yarnLibrary: reusedLibrary, keepRunning: true });
  assert.equal(cold.stats.reads, 15, "A+B/C+A/A+B reads each of A/B/C's five maps once.");
  assert.equal(cold.stats.decodes, 15, "duplicate Feed/slot assignments never duplicate image decoding.");
  assert.deepEqual(cold.result.yarnIds, ["A", "B", "C"]);
  assertVisibilitySwitches(cold);
  const repeated = await render(reuseFeeds, { height: 6, scale: 2, yarnLibrary: reusedLibrary });
  for (const key of ["reads", "decodes", "creates", "uploads"]) assert.equal(repeated.stats[key], 0, key);
  assert.deepEqual(repeated.solverInputs, [], "zoom reuses all per-slot Solver results.");
  // Cache liveness includes every slot, with release based on the complete source set.
  const brush = await server.ssrLoadModule("/src/simulation/yarnTextureBrush.js");
  for (const asset of reusedLibrary) for (const slot of slots) assert.ok(brush.getReadyYarnTextureImage({ assetRef: asset.pbr[slot].assetRef }));
  const removed = await render([feed(["A", 23]), feed(["A", 23], ["C", 25]), feed(["A", 23])],
    { height: 6, yarnLibrary: reusedLibrary });
  assert.equal(removed.stats.reads, 0); assert.equal(removed.stats.decodes, 0);
  for (const slot of slots) {
    assert.equal(brush.getReadyYarnTextureImage({ assetRef: reusedLibrary[1].pbr[slot].assetRef }), null);
    for (const index of [0, 2]) assert.ok(brush.getReadyYarnTextureImage({ assetRef: reusedLibrary[index].pbr[slot].assetRef }));
  }
  for (const texturePerformanceMode of ["solid", "auto"]) {
    const solid = await render([feed(["A", 23], ["B", 21], ["C", 25])],
      { texturePerformanceMode, texturePreviewInteractionActive: true, keepRunning: true });
    assert.equal(solid.draws.length, 0);
    assert.equal(solid.args.yarnStrands.length, 3);
    assert.equal(solid.paths.length, solid.args.yarnPathLinks.length * 3,
      "Solid/Auto interaction must still draw all three Assignment centerlines.");
    assertCanvasCenterlines(solid);
    assertVisibilitySwitches(solid);
  }
  const asymmetric = await render([feed(["A", 23]), feed(["A", 23], ["B", 21], ["C", 25])]);
  assert.equal(asymmetric.args.feedYarnPlies.get(0).length, 1);
  assert.equal(asymmetric.args.feedYarnPlies.get(1).length, 3);
  const firstSecondaryLink = asymmetric.args.yarnPathLinks.find(link => link.row % 2 === 1);
  assert.equal(asymmetric.args.yarnStrands[1].uvOffsets.get(firstSecondaryLink.index), 0,
    "an absent slot must not contribute fictitious length to that Yarn's cumulative U.");
  const extra = await render([feed(["A", 23], ["B", 21], ["C", 25], ["A", 23], ["B", 21])]);
  assert.equal(extra.args.yarnStrands.length, 5, "N must not be capped to two or three.");
  assert.deepEqual(extra.solverInputs, [[23, 21, 25]]);
  const { normalizeSingleJerseyCamProgram } = await server.ssrLoadModule("/src/actions/singleJerseyCamProgram.js");
  const oldCam = normalizeSingleJerseyCamProgram({ tracks: [["K"]] });
  const legacy = await render(oldCam.feeds);
  assert.deepEqual(legacy.result.yarnIds, [String(oldCam.feeds[0].yarns[0].yarnId)],
    "normalized old projects retain their actual default Assignment ID, including numeric zero.");
  assert.equal(legacy.args.yarnStrands.length, 1);
  assert.equal(legacy.args.feedYarnPlies.get(0)[0], legacy.args.activeYarnPlies[0]);
  assertCanvasCenterlines(legacy, 2);
  const patternPreview = await render(null, { texturePerformanceMode: "solid" });
  assert.equal(patternPreview.args.feedYarnPlies.size, 0);
  assert.equal(patternPreview.args.yarnStrands.length, 1);
  assert.equal(patternPreview.result.yarnLengthSolverResults.length, 0);
  assert.equal(patternPreview.result.previewValidity, "DESIGN_PREVIEW");
  assertCanvasCenterlines(patternPreview);
  assert.deepEqual(patternPreview.result.yarnIds, [], "pre-arrangement preview must not infer choices from the material library.");
  const legacyPlies = await render(null, { plies: library.slice(0, 2).map(asset => ({
    ...primary, texture: { pbr: asset.pbr, enabled: true },
  })) });
  assert.equal(legacyPlies.args.activeYarnPlies.length, 2);
  assert.deepEqual(legacyPlies.result.yarnIds, [], "Legacy additional plies cannot become Assignment choices.");
  assert.deepEqual(new Set(legacyPlies.draws.map(draw => draw.material.texture.pbr.baseColor.assetRef)),
    new Set(library.slice(0, 2).map(asset => asset.pbr.baseColor.assetRef)), "legacy yarnPlies PBR remains active without Feed slots.");
  assert.ok(legacyPlies.draws.every(draw => draw.options.normalOffsetModel === 0),
    "legacy plies without Feed Assignments keep their existing unshifted centerline.");
  const legacyWithId = await render([feed(["A", 0])], { yarnLibrary: [],
    plies: [primary, { ...primary, color: "#ff0000" }], texturePerformanceMode: "solid", keepRunning: true });
  assert.deepEqual(legacyWithId.result.yarnIds, ["A"]);
  assert.equal(legacyWithId.paths.length, legacyWithId.args.yarnPathLinks.length * 2,
    "all-yarn view preserves compatible Legacy additional plies.");
  assertVisibilitySwitches(legacyWithId);
  const unusedFeed = await render([feed(["A", 0]), feed(["B", 0]), feed(["C", 0])],
    { height: 1, texturePerformanceMode: "solid", keepRunning: true });
  assert.deepEqual(unusedFeed.result.yarnIds, ["A"], "unused Feed IDs cannot appear among actual drawing choices.");
  assertVisibilitySwitches(unusedFeed);
  webglEnabled = false;
  for (const id of canvases.keys()) canvases.set(id, canvas());
  const canvasFallback = await render([feed(["A", 23], ["B", 21], ["C", 25])], { keepRunning: true });
  assert.equal(canvasFallback.draws.length, 0);
  assert.equal(canvasFallback.paths.length, canvasFallback.args.yarnPathLinks.length * 3 * 2,
    "WebGL-unavailable Canvas fallback must render every slot on both initial and ready-image frames.");
  assertCanvasCenterlines(canvasFallback, 2);
  assertVisibilitySwitches(canvasFallback);
  const relaxed = (length = 8, ratio = 3) => ({ yarnId: "B", lengthInputMode: "relaxedWithDraft",
    relaxedLengthCmPer100Needles: length, draftRatio: ratio, tensionCN: 4, placement: "parallel" });
  const processFeeds = [{ yarns: [feed(["A", 23]).yarns[0], relaxed()] }];
  const drafted = await render(processFeeds, { texturePerformanceMode: "solid" });
  assert.deepEqual(drafted.solverInputs, [[23, 24]], "Solver receives only the resolved numerical targets.");
  assert.equal(drafted.result.previewValidity, "VALIDATED");
  const draftedResult = drafted.result.yarnLengthSolverResults[1];
  assert.equal(draftedResult.status, "CONVERGED");
  assert.equal(draftedResult.lengthInput.relaxedLengthCmPer100Needles, 8);
  assert.equal(draftedResult.lengthInput.draftRatio, 3);
  assert.equal(draftedResult.lengthInput.effectiveTargetLengthCmPer100Needles, 24);
  const reusedDraft = await render(processFeeds, { scale: 2, texturePerformanceMode: "solid" });
  assert.deepEqual(reusedDraft.solverInputs, [], "identical facts may reuse the existing bounded cache.");
  const equalProduct = await render([{ yarns: [processFeeds[0].yarns[0], relaxed(10, 2.4)] }],
    { texturePerformanceMode: "solid" });
  assert.deepEqual(equalProduct.solverInputs, [[23, 24]], "equal product with changed facts invalidates cache.");
  const changedSource = equalProduct.result.yarnLengthSolverResults[1].lengthInput;
  assert.equal(changedSource.relaxedLengthCmPer100Needles, 10);
  assert.equal(changedSource.draftRatio, 2.4);
  assert.notEqual(changedSource.inputSignature, draftedResult.lengthInput.inputSignature);
  const { draftRatio: unusedRatio, ...missingRatio } = relaxed();
  const incomplete = await render([{ yarns: [processFeeds[0].yarns[0], missingRatio] }],
    { texturePerformanceMode: "solid", keepRunning: true });
  assert.deepEqual(incomplete.solverInputs, [[23]]);
  assert.equal(incomplete.result.previewValidity, "PARTIAL", "incomplete relaxed assignment prevents false VALIDATED.");
  assert.equal(incomplete.result.yarnLengthSolverResults.length, 1);
  assert.equal(incomplete.args.yarnStrands.length, 2,
    "an Assignment without an effective target still retains its own preview centerline.");
  assertCanvasCenterlines(incomplete);
  assertVisibilitySwitches(incomplete);
  const allIncomplete = await render([{ yarns: [missingRatio] }], { texturePerformanceMode: "solid" });
  assert.equal(allIncomplete.result.previewValidity, "DESIGN_PREVIEW", "incomplete input alone has no effective solve target.");
  const direct24 = await render([feed(["A", 23], ["B", 24])], { texturePerformanceMode: "solid", visibleYarnId: "B" });
  assert.equal(direct24.result.visibleYarnId, "B", "a redraw may retain an existing selection without changing solve input.");
  assert.deepEqual(direct24.paths, ["back", "front", "mid"].flatMap(layer => direct24.args.yarnPathLinks
    .filter(link => link.layer === layer).map(link => direct24.args.yarnStrands[1].resolvedPathByLink.get(link.index))));
  assert.deepEqual(direct24.result.yarnLengthSolverResults.map(result => result.solvedLengthCmPer100Needles),
    drafted.result.yarnLengthSolverResults.map(result => result.solvedLengthCmPer100Needles),
    "resolved target must have zero numerical drift against the existing direct solver input.");
  console.log("PASS: 1/2/3/N Assignment geometry/material/UV, zero slot offsets, Canvas/WebGL Yarn ID selection without re-solving/rebuilding, own paths/buffers, duplicate/cross-slot/unused IDs, no-target/PARTIAL/Legacy, failure/cache/transform regressions.");
} finally {
  await server.close(); delete globalThis.__multiYarnDraws; delete globalThis.__multiYarnJobs;
  delete globalThis.__multiYarnTimings; delete globalThis.__multiYarnSolverInputs;
  delete globalThis.__multiYarnObservations;
  delete globalThis.__multiYarnStripOptions; delete globalThis.__multiYarnDrawArgs;
}
