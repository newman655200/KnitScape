import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";

// Side effects: real modules run against in-memory Canvas/WebGL/Image adapters
// and synthetic registry Blobs. Vite has no project config, listening server,
// or project-local cache; this script writes no report/build/project state.
const rendererFile = "src/simulation/pbrPreviewRenderer.js";
assert.ok(existsSync(rendererFile), "Step 2 must expose an independent PBR preview lifecycle.");
const source = readFileSync(rendererFile, "utf8");
assert.doesNotMatch(source, /computeYarnSimulation|solveFeedYarnLengths|GLOBAL_STATE|\bdispatch\s*\(/,
  "A PBR renderer may consume snapshots but never compute, solve or publish state.");
assert.doesNotMatch(source, /resolveFeedYarnPlies|courseToFeedIndex|resolveYarnRenderItems/,
  "Assignment/material/visibility rules belong to the shared render-item resolver.");
const shaderSource = readFileSync("src/simulation/yarnUvWebglRenderer.js", "utf8");
for (const [name, expected] of Object.entries({
  VERTEX_SHADER: "4d5cd712dc53f89632318c9d3e2c00643f20dd87474981b3e790d51ba9393162",
  FRAGMENT_SHADER: "c1f1a70a30e9fad351ca21e0a7eeb3fc2c2c4b37e20d35c0798c9cc88014ce11",
})) {
  const shader = shaderSource.match(new RegExp("const " + name + " = `([\\s\\S]*?)`;"))?.[1];
  assert.ok(shader);
  assert.equal(createHash("sha256").update(shader.replaceAll("\r\n", "\n")).digest("hex"), expected,
    "Step 2 must keep every shader byte unchanged (excluding file line endings).");
}
const counters = { decodes: 0, aborts: 0, strips: 0, draws: 0 };
const observed = globalThis.__pbrPreviewLifecycle = { counters, frames: [] };
const hmrServer = createHttpServer();
const server = await createServer({ configFile: false, appType: "custom", logLevel: "silent",
  cacheDir: process.env.KNITSCAPE_TEST_CACHE_DIR || path.join(os.tmpdir(), "knitscape-validation", "pbr-preview-lifecycle"),
  server: { middlewareMode: true, hmr: { server: hmrServer } },
  plugins: [{ name: "observe-pbr-lifecycle", enforce: "pre", transform(code, id) {
    const file = id.replaceAll("\\", "/");
    if (file.endsWith("/src/simulation/drawYarnSimulation.js")) {
      return code.replace("export function drawYarnSimulation(", "function observedDraw(") +
        `\nexport function drawYarnSimulation(args) {
          globalThis.__pbrPreviewLifecycle.counters.draws++;
          globalThis.__pbrPreviewLifecycle.frames.push(args); return observedDraw(args);
        }`;
    }
    if (file.endsWith("/src/simulation/yarnPathUvStrip.js")) {
      return code.replace("export function buildYarnUvStrip(", "function observedStrip(") +
        `\nexport function buildYarnUvStrip(args) {
          globalThis.__pbrPreviewLifecycle.counters.strips++; return observedStrip(args);
        }`;
    }
  } }],
});
let blockDecode = false, webglEnabled = true, lossExtensionEnabled = true, failProgramLink = false;
const pendingImages = [], contexts = [], previews = [];
globalThis.Path2D = class { constructor(data) { this.data = data; } };
globalThis.Image = class {
  naturalWidth = 8; naturalHeight = 8;
  set src(value) {
    counters.decodes++; this.source = value;
    if (blockDecode) pendingImages.push(this);
    else queueMicrotask(() => this.onload?.());
  }
  removeAttribute(name) { assert.equal(name, "src"); counters.aborts++; this.source = ""; }
};
function canvas() {
  const context = { clearRect() {}, save() {}, restore() {}, stroke() {}, drawImage() {},
    createPattern: image => ({ image }), globalAlpha: 1, globalCompositeOperation: "source-over" };
  const element = { width: 200, height: 100, style: {}, getContext(kind) {
    if (kind === "2d") return context;
    if (kind !== "webgl" || !webglEnabled) return null;
    if (element.gl) return element.gl;
    const resources = { programs: new Set(), textures: new Set(), buffers: new Set(), uploads: 0,
      contextLosses: 0, extensionQueries: 0, lossExtensionEnabled, failProgramLink };
    const gl = new Proxy({ canvas: element, resources,
      getExtension(name) {
        assert.equal(name, "WEBGL_lose_context"); resources.extensionQueries++;
        return resources.lossExtensionEnabled ? { loseContext() { resources.contextLosses++; } } : null;
      },
      createProgram() { const value = {}; resources.programs.add(value); return value; },
      deleteProgram(value) { assert.ok(resources.programs.delete(value), "Programs dispose exactly once."); },
      createTexture() { const value = {}; resources.textures.add(value); return value; },
      deleteTexture(value) { assert.ok(resources.textures.delete(value), "Textures dispose exactly once."); },
      createBuffer() { const value = {}; resources.buffers.add(value); return value; },
      deleteBuffer(value) { assert.ok(resources.buffers.delete(value), "Buffers dispose exactly once."); },
      texImage2D(...args) { if (args.at(-1) instanceof Image) resources.uploads++; },
      getShaderParameter: () => true, getProgramParameter: () => !resources.failProgramLink,
      getAttribLocation: () => 0, getUniformLocation: (_, name) => name,
    }, { get(target, key) { return key in target ? target[key]
      : /^[A-Z_0-9]+$/.test(key) ? 1 : () => ({}); } });
    contexts.push(gl); element.gl = gl; return gl;
  } };
  return element;
}
globalThis.document = { createElement: tag => { assert.equal(tag, "canvas"); return canvas(); } };
const nextTurn = () => new Promise(resolve => setImmediate(resolve));
let registry;
try {
  const [pbr, brush, webgl, snapshots, resolver, scan] = await Promise.all([
    "/src/simulation/pbrPreviewRenderer.js", "/src/simulation/yarnTextureBrush.js",
    "/src/simulation/yarnUvWebglRenderer.js", "/src/simulation/simulationSnapshot.js",
    "/src/simulation/yarnRenderItems.js", "/src/yarnTexture/yarnScanTexture.js",
  ].map(file => server.ssrLoadModule(file)));
  registry = (await server.ssrLoadModule("/src/yarnTexture/yarnAssetRegistry.js")).yarnAssetRegistry;
  assert.equal(typeof pbr.createPbrPreviewRenderer, "function");
  // Factory-created contexts are preview-owned; direct constructor inputs are
  // caller-owned. Both release renderer resources without mixing those owners.
  const callerCanvas = canvas(), callerGl = callerCanvas.getContext("webgl");
  const callerRenderer = new webgl.YarnUvWebglRenderer(callerGl);
  callerRenderer.dispose(); callerRenderer.dispose();
  assert.deepEqual([callerCanvas.width, callerCanvas.height], [200, 100]);
  assert.equal(callerGl.resources.extensionQueries, 0, "A caller-owned context cannot be requested for context loss.");
  assert.equal(callerGl.resources.contextLosses, 0);

  const ownTarget = canvas(), owned = webgl.getWebglYarnRenderer(ownTarget), ownedGl = owned.gl;
  owned.clear(2048, 1024); owned.dispose(); owned.dispose();
  assert.deepEqual([ownedGl.canvas.width, ownedGl.canvas.height], [1, 1],
    "Disposal shrinks the renderer-owned offscreen drawing buffer immediately.");
  assert.equal(ownedGl.resources.contextLosses, 1, "An owned context is explicitly released exactly once.");
  assert.equal(ownedGl.resources.extensionQueries, 1);
  assert.equal(callerRenderer.gl, null, "Disposed renderer objects no longer retain their context.");
  assert.deepEqual([ownTarget.width, ownTarget.height], [200, 100], "The host's target Canvas is untouched.");
  assert.equal(owned.gl, null); assert.equal(owned.targetCanvas, null); assert.equal(owned.targetContext, null);

  lossExtensionEnabled = false;
  const noExtension = webgl.getWebglYarnRenderer(canvas()), noExtensionGl = noExtension.gl;
  noExtension.dispose(); noExtension.dispose(); lossExtensionEnabled = true;
  assert.deepEqual([noExtensionGl.canvas.width, noExtensionGl.canvas.height], [1, 1]);
  assert.equal(noExtensionGl.resources.contextLosses, 0, "Missing optional context-loss extension remains supported.");
  assert.equal(noExtensionGl.resources.extensionQueries, 1);

  const beforeNoTarget = contexts.length;
  assert.equal(webgl.getWebglYarnRenderer({ getContext: () => null }), null);
  assert.equal(contexts.length, beforeNoTarget, "A missing target context cannot allocate an unused offscreen context.");

  failProgramLink = true;
  const warnings = [], previousWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    assert.equal(webgl.getWebglYarnRenderer(canvas()), null, "Failed shader/program construction keeps the Canvas fallback.");
  } finally { console.warn = previousWarn; failProgramLink = false; }
  const failedContext = contexts.at(-1);
  assert.equal(warnings.length, 1, "The existing fallback diagnostic remains available.");
  assert.equal(failedContext.resources.contextLosses, 1, "A failed factory releases its offscreen context too.");
  assert.deepEqual([failedContext.canvas.width, failedContext.canvas.height], [1, 1]);

  const slots = ["baseColor", "normal", "roughness", "height", "ambientOcclusion", "metallic"];
  const primary = { color: "#123456", diameter: .24, texture: null, enabled: true };
  const material = (ref, slot = "baseColor") => ({ ...primary, assetMaterial: true,
    texture: { enabled: true, pbr: { [slot]: { assetRef: ref }, physicalRepeatLengthMm: 8 } } });
  function scene(materials, { double = false, visibleYarnId = null, snapshot = null } = {}) {
    if (!snapshot) {
      const links = materials.map((_, index) => ({ index, row: index, layer: "front" }));
      const maps = () => new Map(links.map(link => [link.index, `M ${link.index * 10} 0 L ${link.index * 10 + 10} 0`]));
      const strands = Array.from({ length: double ? 2 : 1 }, (_, yarnIndex) => ({
        yarnIndex, modelPathByLink: maps(), resolvedPathByLink: maps(),
      }));
      snapshot = snapshots.createSimulationSnapshot({ yarnPathLinks: links, yarnStrands: strands,
        activeYarnPlies: [primary], feedCount: materials.length,
        feedYarnPlies: new Map(materials.map((ply, index) => [index,
          double && index === 1 ? [ply, ply] : [ply]])),
        feedYarnIds: new Map(materials.map((_, index) => [index,
          double && index === 1 ? ["A", "B"] : ["A"]])),
        yarnLibrary: [], normalizedYarnSequence: { width: 1, height: materials.length, pixels: materials.map(() => 0) },
        palette: [primary.color], hasYarnSequenceMask: false, machineGauge: 32, stitchWidth: 1,
        canvasWidth: 200, canvasHeight: 100,
      });
    }
    return { snapshot, renderItems: resolver.resolveYarnRenderItems({ snapshot, visibleYarnId }),
      yarnPathLinks: snapshot.yarnPathLinks, yarnStrands: snapshot.yarnStrands,
      canvasWidth: 200, canvasHeight: 100, stitchWidth: 1, machineGauge: 32,
      texturePerformanceMode: "quality", texturePreviewInteractionActive: false, structureLineStyle: null };
  }
  function mounted(canvases = { backCanvas: canvas(), midCanvas: canvas(), frontCanvas: canvas() }) {
    const preview = pbr.createPbrPreviewRenderer(); previews.push(preview);
    assert.equal(preview.mount(canvases), preview); return { preview, canvases };
  }
  const blob = () => new Blob(["synthetic image bytes"], { type: "image/png" });
  let reads = 0;
  const ref = registry.register(() => { reads++; return blob(); });
  const input = scene([material(ref), material(ref), material(ref)], { double: true });
  const filtered = scene([], { snapshot: input.snapshot, visibleYarnId: "B" });
  assert.deepEqual(input.renderItems.strandLinks.map(links => links.map(link => link.index)), [[0, 1, 2], [1]],
    "The shared resolver owns active unfiltered per-strand links.");
  assert.deepEqual(filtered.renderItems.strandLinks, input.renderItems.strandLinks,
    "Visibility cannot change the per-strand accumulated UV domain.");
  const original = JSON.stringify(input.snapshot);
  const { preview, canvases } = mounted();
  const firstReady = preview.update(input);
  assert.equal(firstReady, preview.ready);
  await firstReady;
  assert.equal(preview.status.phase, "ready");
  assert.equal(preview.status.failedTextureCount, 0);
  assert.equal(reads, 1); assert.equal(counters.decodes, 1);
  const firstFrame = observed.frames.at(-1), firstStripCount = counters.strips;
  assert.equal(firstFrame.yarnStrands[1].uvOffsets.get(1), 0);
  assert.equal(input.snapshot.yarnStrands[0].uvOffsets, undefined,
    "PBR UV metadata must be renderer-local, never written into snapshots.");
  preview.update(filtered);
  const filterFrame = observed.frames.at(-1);
  assert.equal(filterFrame.uvStripCache, firstFrame.uvStripCache);
  assert.equal(filterFrame.yarnStrands, firstFrame.yarnStrands);
  assert.equal(counters.strips, firstStripCount);
  await preview.ready;
  await preview.update({ ...input, structureLineStyle: { colors: new Map([["A", "#ffffff"]]), lineWidth: 1 } });
  await preview.update(input);
  assert.equal(counters.strips, firstStripCount, "Filter and structure-line redraws reuse existing UV strips.");
  assert.equal(JSON.stringify(input.snapshot), original);
  const projected = input.yarnStrands.map(strand => ({ ...strand,
    resolvedPathByLink: new Map([...strand.resolvedPathByLink].map(([key, value]) => [key, value.replaceAll(" 0", " 3")])) }));
  const projectedInput = { ...input, yarnStrands: projected,
    renderItems: resolver.resolveYarnRenderItems({ snapshot: input.snapshot, yarnStrands: projected }) };
  await preview.update(projectedInput);
  assert.ok(counters.strips > firstStripCount, "Changed projected paths invalidate strips.");
  const second = mounted(); await second.preview.update(input);
  assert.equal(counters.decodes, 1, "Simultaneous renderers share one decode.");
  const oldGpu = webgl.getWebglYarnRenderer(canvases.frontCanvas);
  preview.dispose(); preview.dispose();
  assert.equal(preview.status.phase, "disposed");
  assert.ok(brush.getReadyYarnTextureImage({ assetRef: ref }), "Another renderer retains its shared decoded image.");
  const replacementGpu = webgl.getWebglYarnRenderer(canvases.frontCanvas);
  assert.notEqual(replacementGpu, oldGpu, "Disposal removes the WeakMap entry so re-entry constructs a live renderer.");
  replacementGpu.dispose();
  await second.preview.update(input); assert.equal(counters.decodes, 1);
  second.preview.dispose();
  assert.equal(brush.getReadyYarnTextureImage({ assetRef: ref }), null, "Last owner releases the decoded image.");
  assert.equal(registry.has(ref), true); assert.ok(await registry.getBlob(ref) instanceof Blob);
  const revived = mounted(); await revived.preview.update(input);
  assert.equal(reads, 1, "Registry keeps its project-owned binary/URL through mode changes.");
  assert.equal(counters.decodes, 2, "PBR re-entry decodes the retained project asset again.");
  revived.preview.dispose();

  // Fixed snapshot/model/display references isolate UV-material cache lifetime
  // from geometry invalidation. All values here are synthetic software inputs.
  const uvRef = registry.register(blob());
  const uvBase = scene([material(uvRef), material(uvRef), material(uvRef)], { double: true });
  const uvInputBefore = JSON.stringify(uvBase.snapshot), uvPreview = mounted();
  function uvAppearance({ repeat = 10, diameter = .24, gauge = 32, color = "#123456",
    mapRef = uvRef, visibleYarnId = null, hiddenRepeat = repeat } = {}) {
    const feedYarnPlies = new Map([...uvBase.renderItems.feedYarnPlies].map(([feed, plies]) =>
      [feed, plies.map(ply => ({ ...ply, color, diameter,
        texture: { ...ply.texture, pbr: { ...ply.texture.pbr,
          baseColor: { assetRef: mapRef }, physicalRepeatLengthMm: feed === 0 ? hiddenRepeat : repeat } },
      }))]));
    return { ...uvBase, machineGauge: gauge,
      renderItems: resolver.resolveYarnRenderItems({ snapshot: uvBase.snapshot, feedYarnPlies, visibleYarnId }) };
  }
  const stripBytes = cache => [...cache.values()].reduce((sum, strip) => sum +
    strip.positions.byteLength + strip.uvs.byteLength + strip.indices.byteLength, 0);
  let workingSize, workingBytes, initialPositions, lastStrip;
  for (let repeat = 1; repeat <= 10; repeat++) {
    await uvPreview.preview.update(uvAppearance({ repeat }));
    const frame = observed.frames.at(-1), strip = frame.uvStripCache.values().next().value;
    if (repeat === 1) {
      workingSize = frame.uvStripCache.size; workingBytes = stripBytes(frame.uvStripCache);
      initialPositions = strip.positions.slice();
      assert.equal(workingSize, 4, "Three primary links and one secondary link form this working strip set.");
    }
    assert.equal(frame.uvStripCache.size, workingSize,
      "Repeated physical-repeat edits retain only the current UV strip working set.");
    assert.equal(stripBytes(frame.uvStripCache), workingBytes,
      "UV TypedArray bytes cannot accumulate across physical-repeat edits on fixed paths.");
    assert.deepEqual(strip.positions, initialPositions, "Physical-repeat edits do not move rendered paths.");
    if (lastStrip) assert.notDeepEqual(strip.uvs, lastStrip.uvs, "The current material's physical U still changes.");
    lastStrip = strip;
  }
  for (const diameter of [.20, .21, .22, .23, .24]) {
    await uvPreview.preview.update(uvAppearance({ diameter }));
    assert.equal(observed.frames.at(-1).uvStripCache.size, workingSize, "Diameter edits release superseded ribbon widths.");
    assert.equal(stripBytes(observed.frames.at(-1).uvStripCache), workingBytes);
  }
  for (const gauge of [28, 36, 32]) {
    await uvPreview.preview.update(uvAppearance({ gauge }));
    assert.equal(observed.frames.at(-1).uvStripCache.size, workingSize, "Gauge edits release superseded physical U strips.");
    assert.equal(stripBytes(observed.frames.at(-1).uvStripCache), workingBytes);
  }
  const stableCache = observed.frames.at(-1).uvStripCache, stableStrips = [...stableCache.values()];
  const beforeAppearanceStrips = counters.strips, replacementRef = registry.register(blob());
  for (const input of [uvAppearance({ color: "#abcdef" }), uvAppearance({ mapRef: replacementRef }),
    uvAppearance({ mapRef: replacementRef, visibleYarnId: "B" }),
    { ...uvAppearance({ mapRef: replacementRef }), structureLineStyle: { colors: new Map(), lineWidth: 1 } },
    uvAppearance({ mapRef: replacementRef })]) {
    await uvPreview.preview.update(input);
    assert.equal(observed.frames.at(-1).uvStripCache, stableCache);
    assert.deepEqual([...stableCache.values()], stableStrips);
    [...stableCache.values()].forEach((strip, index) => assert.equal(strip, stableStrips[index]));
    assert.equal(counters.strips, beforeAppearanceStrips,
      "Colors, image replacement, visibility and structure-line changes keep usable UV strips.");
  }
  await uvPreview.preview.update(uvAppearance({ mapRef: replacementRef, visibleYarnId: "B", hiddenRepeat: 11 }));
  await uvPreview.preview.update(uvAppearance({ mapRef: replacementRef, hiddenRepeat: 11 }));
  assert.equal(stableCache.size, workingSize,
    "A hidden Yarn's UV-material edit is tracked through the unfiltered material set.");
  assert.equal(stripBytes(stableCache), workingBytes);
  assert.equal(JSON.stringify(uvBase.snapshot), uvInputBefore);
  console.log(`UV CACHE: ${workingSize} strips / ${workingBytes} bytes remain bounded across repeat, diameter and gauge edits.`);
  uvPreview.preview.dispose();

  let finishBinary;
  const pendingRef = registry.register(() => new Promise(resolve => { finishBinary = resolve; }));
  const pending = mounted(), decodeStart = counters.decodes;
  const pendingReady = pending.preview.update(scene([material(pendingRef)])); await nextTurn();
  assert.equal(typeof finishBinary, "function");
  pending.preview.dispose(); const stoppedDrawCount = counters.draws;
  finishBinary(blob()); await pendingReady;
  assert.equal(counters.decodes, decodeStart, "Disposed pending binary work must never start a later decode.");
  assert.equal(counters.draws, stoppedDrawCount, "Disposed async preparation cannot draw.");
  assert.equal(brush.getReadyYarnTextureImage({ assetRef: pendingRef }), null);
  assert.equal(registry.has(pendingRef), true);

  blockDecode = true;
  const decodeRef = registry.register(blob()), decoding = mounted();
  const decodingReady = decoding.preview.update(scene([material(decodeRef)])); await nextTurn();
  const abortStart = counters.aborts, beforeAbortDraw = counters.draws;
  assert.ok(pendingImages.length);
  decoding.preview.dispose(); await decodingReady;
  assert.equal(counters.aborts, abortStart + 1, "An in-flight preview decode is aborted on final-owner disposal.");
  pendingImages.splice(0).forEach(image => image.onload?.()); blockDecode = false;
  assert.equal(counters.draws, beforeAbortDraw);
  assert.equal(brush.getReadyYarnTextureImage({ assetRef: decodeRef }), null);

  let resumeBinary;
  const suspendRef = registry.register(() => new Promise(resolve => { resumeBinary = resolve; }));
  const suspended = mounted(), suspendInput = scene([material(suspendRef)]);
  const suspendedReady = suspended.preview.update(suspendInput); await nextTurn();
  suspended.preview.suspend(); const suspendedDraws = counters.draws;
  resumeBinary(blob()); await suspendedReady;
  assert.equal(counters.draws, suspendedDraws, "Suspend invalidates pending draws while preserving resources.");
  assert.equal(suspended.preview.status.phase, "suspended");
  const beforeResumeDecode = counters.decodes;
  await suspended.preview.update(suspendInput);
  assert.equal(counters.decodes, beforeResumeDecode); suspended.preview.dispose();

  let resolveOld;
  const oldRef = registry.register(() => new Promise(resolve => { resolveOld = resolve; }));
  const latestRef = registry.register(blob()), latest = mounted();
  const obsolete = latest.preview.update(scene([material(oldRef)])); await nextTurn();
  await latest.preview.update(scene([material(latestRef)]));
  const latestDraws = counters.draws, latestDecodes = counters.decodes;
  resolveOld(blob()); await obsolete;
  assert.equal(counters.draws, latestDraws); assert.equal(counters.decodes, latestDecodes);
  latest.preview.dispose();

  const largeRefs = Array.from({ length: 30 }, () => registry.register(blob()));
  const large = mounted(), largeInput = scene(largeRefs.map(value => material(value)));
  await large.preview.update(largeInput);
  const allDecodes = counters.decodes;
  const gpu = webgl.getWebglYarnRenderer(large.canvases.frontCanvas);
  assert.equal(gpu.textureCache.size, 30, "All active maps remain GPU-resident above the idle 24-map limit.");
  const allUploads = gpu.gl.resources.uploads;
  await large.preview.update(largeInput);
  assert.equal(counters.decodes, allDecodes); assert.equal(gpu.gl.resources.uploads, allUploads);
  large.preview.dispose();

  const failureRef = registry.register(() => { throw new Error("Expected fixture read failure"); });
  const failed = mounted(); await failed.preview.update(scene([material(failureRef, "normal")]));
  assert.equal(failed.preview.status.phase, "ready"); assert.equal(failed.preview.status.failedTextureCount, 1);
  failed.preview.dispose();
  webglEnabled = false;
  const fallback = mounted(); await fallback.preview.update(scene([material(registry.register(blob()))]));
  assert.equal(fallback.preview.status.phase, "ready"); fallback.preview.dispose(); webglEnabled = true;
  // Optional abort support never changes asset-import callers that omit it.
  const importImage = await scan.loadImageFromDataUrl("data:image/png;base64,fixture");
  assert.ok(importImage instanceof Image);
  for (const context of contexts) {
    assert.equal(context.resources.programs.size, 0);
    assert.equal(context.resources.textures.size, 0);
    assert.equal(context.resources.buffers.size, 0);
  }
  console.log("PASS: PBR mount/update/suspend/dispose, stale work, shared image ownership, re-entry, immutable UV inputs, shader bytes, active 30-map caches, failure and Canvas fallback.");
} finally {
  for (const preview of previews) preview.dispose();
  registry?.clear(); // Test-only project teardown; production renderer must never clear Registry.
  await server.close();
}
