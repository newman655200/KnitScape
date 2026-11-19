import assert from "node:assert/strict";
import { createServer } from "vite";

globalThis.devicePixelRatio = 1;
globalThis.window = { location: { search: "" }, setTimeout, clearTimeout,
  btoa: value => Buffer.from(value, "binary").toString("base64") };
const canvasPaths = [];
globalThis.Path2D = class { constructor(data = "") { this.data = data; canvasPaths.push(data); } };
const draws = [], jobs = [], solverInputs = [];
const timings = { solverMs: 0, geometryMs: 0, renderMs: 0 };
const counters = { reads: 0, decodes: 0, creates: 0, uploads: 0 };
let webglEnabled = true;
globalThis.__multiYarnDraws = draws;
globalThis.__multiYarnJobs = jobs;
globalThis.__multiYarnTimings = timings;
globalThis.__multiYarnSolverInputs = solverInputs;
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
    "parallel placement must move the strip center along its model-space normal.");
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
    const context = { clearRect() {}, save() {}, restore() {}, drawImage() {}, stroke() {},
      createPattern: () => ({}), globalAlpha: 1, globalCompositeOperation: "source-over" };
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
    draws.length = 0; solverInputs.length = 0; canvasPaths.length = 0;
    for (const key of Object.keys(timings)) timings[key] = 0;
    const startCounters = { ...counters }, start = performance.now();
    const snapshot = structuredClone(feeds), assetSnapshot = structuredClone(library);
    const { width = 12, height = 4, scale = 1, plies = [primary], ...runtime } = options;
    const result = simulate(Bimp.empty(width, height, 0), Bimp.empty(1, height, 0), ["#999999"], scale,
      plies, { feeds, yarnLibrary: library, machineGauge: 32, texturePerformanceMode: "quality", ...runtime });
    while (jobs.length) await Promise.all(jobs.splice(0));
    await new Promise(resolve => setImmediate(resolve));
    result.stopSim();
    assert.deepEqual(feeds, snapshot); assert.deepEqual(library, assetSnapshot);
    return { result, args: globalThis.__multiYarnDrawArgs, draws: [...draws], paths: [...canvasPaths], solverInputs: [...solverInputs],
      stats: { ...timings, totalMs: performance.now() - start,
        ...Object.fromEntries(Object.keys(counters).map(key => [key, counters[key] - startCounters[key]])) } };
  }
  const duplicate = await render([feed(["A", 23], ["A", 23])]);
  assert.deepEqual(duplicate.solverInputs, [[23]], "identical targets in the same Feed must be solved once, then retain independent slot results.");
  assert.equal(duplicate.result.yarnLengthSolverResults.length, 2);
  assert.notEqual(duplicate.result.yarnLengthSolverResults[0].solvedPathByLink,
    duplicate.result.yarnLengthSolverResults[1].solvedPathByLink);
  const firstOptions = duplicate.draws[0].options;
  const sameLink = duplicate.draws.filter(draw => draw.options.modelPathData === firstOptions.modelPathData
    && draw.options.arcLengthOffset === firstOptions.arcLengthOffset);
  assert.equal(new Set(sameLink.map(draw => draw.strip.uvs)).size, 2,
    "even equal targets/materials must own separate slot UV buffers.");
  for (const pairs of [[["A", 23]], [["A", 23], ["B", 21]], [["A", 23], ["B", 21], ["C", 25]]]) {
    const scene = await render([feed(...pairs)]);
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
      const expectedOffset = (index - (pairs.length - 1) / 2) * primary.diameter;
      assert.equal(draw.options.normalOffsetModel, expectedOffset);
      const center = buildYarnUvStrip({ ...draw.options, normalOffsetModel: 0 });
      assert.deepEqual(draw.strip.uvs, center.uvs);
      assert.equal(draw.strip.totalModelLength, center.totalModelLength);
      const expectedU = (draw.options.arcLengthOffset + center.totalModelLength) * (25.4 / 32)
        / library[index].pbr.physicalRepeatLengthMm;
      assert.ok(Math.abs(draw.strip.uvs.at(-2) - expectedU) < 1e-5);
      if (expectedOffset !== 0) assert.notDeepEqual(draw.strip.positions, center.positions);
    }
    const orderByLayer = new Map();
    for (const draw of scene.draws) {
      const order = orderByLayer.get(draw.gl) ?? [];
      const index = Math.round(draw.options.normalOffsetModel / primary.diameter + (pairs.length - 1) / 2);
      if (order.at(-1) !== index) order.push(index);
      orderByLayer.set(draw.gl, order);
    }
    for (const order of orderByLayer.values()) order.forEach((index, position) =>
      assert.equal(index, position % pairs.length, "each layer draws stable slot order on every frame."));
  }
  const failed = await render([feed(["A", 23], ["B", 8])]);
  assert.equal(failed.result.yarnLengthSolverResults[0].converged, true);
  assert.equal(failed.result.yarnLengthSolverResults[1].status, "UNREACHABLE_TARGET");
  const base = await render([feed(["A", 0], ["B", 0])]);
  assert.deepEqual(failed.args.yarnStrands[1].modelPathByLink, base.args.yarnStrands[1].modelPathByLink);
  assert.notDeepEqual(failed.args.yarnStrands[0].modelPathByLink, base.args.yarnStrands[0].modelPathByLink);
  const firstFailed = await render([feed(["A", 8], ["B", 23])]);
  assert.equal(firstFailed.result.yarnLengthSolverResults[0].status, "UNREACHABLE_TARGET");
  assert.equal(firstFailed.result.yarnLengthSolverResults[1].converged, true);
  assert.deepEqual(firstFailed.args.yarnStrands[0].modelPathByLink, base.args.yarnStrands[0].modelPathByLink);
  assert.notDeepEqual(firstFailed.args.yarnStrands[1].modelPathByLink, base.args.yarnStrands[1].modelPathByLink);
  const reuseFeeds = [feed(["A", 23], ["B", 21]), feed(["A", 23], ["C", 25]), feed(["A", 23], ["B", 21])];
  const reusedLibrary = library.map(asset => ({ ...asset, pbr: { ...asset.pbr,
    ...Object.fromEntries(slots.map(slot => [slot, { ...asset.pbr[slot],
      assetRef: yarnAssetRegistry.register(async () => { counters.reads++; return new Blob([bytes], { type: "image/png" }); }),
    }])) } }));
  const cold = await render(reuseFeeds, { height: 6, yarnLibrary: reusedLibrary });
  assert.equal(cold.stats.reads, 15, "A+B/A+C/A+B reads each of A/B/C's five maps once.");
  assert.equal(cold.stats.decodes, 15, "duplicate Feed/slot assignments never duplicate image decoding.");
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
      { texturePerformanceMode, texturePreviewInteractionActive: true });
    assert.equal(solid.draws.length, 0);
    assert.equal(solid.args.yarnStrands.length, 3);
    assert.equal(solid.paths.length, solid.args.yarnPathLinks.length * 3,
      "Solid/Auto interaction must still draw all three parallel Yarn centerlines.");
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
  assert.equal(legacy.args.yarnStrands.length, 1);
  assert.equal(legacy.args.feedYarnPlies.get(0)[0], legacy.args.activeYarnPlies[0]);
  const legacyPlies = await render(null, { plies: library.slice(0, 2).map(asset => ({
    ...primary, texture: { pbr: asset.pbr, enabled: true },
  })) });
  assert.equal(legacyPlies.args.activeYarnPlies.length, 2);
  assert.deepEqual(new Set(legacyPlies.draws.map(draw => draw.material.texture.pbr.baseColor.assetRef)),
    new Set(library.slice(0, 2).map(asset => asset.pbr.baseColor.assetRef)), "legacy yarnPlies PBR remains active without Feed slots.");
  webglEnabled = false;
  for (const id of canvases.keys()) canvases.set(id, canvas());
  const canvasFallback = await render([feed(["A", 23], ["B", 21], ["C", 25])]);
  assert.equal(canvasFallback.draws.length, 0);
  assert.equal(canvasFallback.paths.length, canvasFallback.args.yarnPathLinks.length * 3 * 2,
    "WebGL-unavailable Canvas fallback must render every slot on both initial and ready-image frames.");
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
    { texturePerformanceMode: "solid" });
  assert.deepEqual(incomplete.solverInputs, [[23]]);
  assert.equal(incomplete.result.previewValidity, "PARTIAL", "incomplete relaxed assignment prevents false VALIDATED.");
  assert.equal(incomplete.result.yarnLengthSolverResults.length, 1);
  const allIncomplete = await render([{ yarns: [missingRatio] }], { texturePerformanceMode: "solid" });
  assert.equal(allIncomplete.result.previewValidity, "DESIGN_PREVIEW", "incomplete input alone has no effective solve target.");
  const direct24 = await render([feed(["A", 23], ["B", 24])], { texturePerformanceMode: "solid" });
  assert.deepEqual(direct24.result.yarnLengthSolverResults.map(result => result.solvedLengthCmPer100Needles),
    drafted.result.yarnLengthSolverResults.map(result => result.solvedLengthCmPer100Needles),
    "resolved target must have zero numerical drift against the existing direct solver input.");
  console.log("PASS: 1/2/3/N parallel Yarn geometry/material/UV, symmetric model placement, isolated Solver failure, duplicate target reuse, cache/transform/Solid regression.");
} finally {
  await server.close(); delete globalThis.__multiYarnDraws; delete globalThis.__multiYarnJobs;
  delete globalThis.__multiYarnTimings; delete globalThis.__multiYarnSolverInputs;
  delete globalThis.__multiYarnStripOptions; delete globalThis.__multiYarnDrawArgs;
}
