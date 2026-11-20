import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";

// Side effects: in-memory package Blobs and Canvas traces only. Vite does not
// load project config, listen, or write a workspace cache/report/build output.
const rendererFile = "src/simulation/classic2dRenderer.js";
assert.ok(existsSync(rendererFile), "Step 3 requires an independent Classic Canvas 2D renderer.");
const source = readFileSync(rendererFile, "utf8");
assert.doesNotMatch(source, /^\s*import\s|\bimport\s*\(/m,
  "Classic must have zero runtime module dependencies, including the PBR renderer.");
assert.doesNotMatch(source, /computeYarnSimulation|solveFeedYarnLengths|GLOBAL_STATE|\bdispatch\s*\(|resolveYarnRenderItems|resolveFeedYarnPlies|courseToFeedIndex/,
  "Classic consumes shared decisions; it must not compute, solve, resolve assignments or publish state.");

const counters = { image: 0, imageDecode: 0, fileReaderImage: 0, bitmap: 0,
  webgl: 0, shader: 0, texture: 0, uvStrip: 0, pbrModule: 0,
  sample: 0, objectUrl: 0, assetRead: 0, assetRelease: 0 };
const zeroCounters = { ...counters };
let binaryFileReads = 0;
function forbidden(name) {
  counters[name]++;
  throw new Error(`Classic invoked forbidden resource operation: ${name}`);
}
globalThis.__classicPreviewDev = true;
globalThis.__classicComputations = 0;
globalThis.Path2D = class { constructor(data) { this.data = data; } };
globalThis.Image = class {
  constructor() { forbidden("image"); }
  decode() { forbidden("imageDecode"); }
};
globalThis.FileReader = class {
  readAsDataURL() { forbidden("fileReaderImage"); }
  // Reading a ZIP's binary data is allowed and is not image decoding.
  async readAsArrayBuffer(blob) {
    binaryFileReads++;
    try { this.result = await blob.arrayBuffer(); this.onload?.({ target: this }); }
    catch (error) { this.error = error; this.onerror?.({ target: this }); }
  }
};
globalThis.createImageBitmap = () => forbidden("bitmap");
globalThis.WebGLRenderingContext = class {
  compileShader() { forbidden("shader"); }
  createTexture() { forbidden("texture"); }
  texImage2D() { forbidden("texture"); }
};

const forbiddenModules = new Map([
  ["pbrPreviewRenderer.js", "pbrModule"], ["drawYarnSimulation.js", "pbrModule"],
  ["yarnTextureBrush.js", "pbrModule"], ["yarnUvWebglRenderer.js", "webgl"],
  ["yarnPathUvStrip.js", "uvStrip"],
]);
const server = await createServer({ configFile: false, appType: "custom", logLevel: "silent",
  cacheDir: process.env.KNITSCAPE_TEST_CACHE_DIR || path.join(os.tmpdir(), "knitscape-validation", "validation-cache", "classic-preview-vite"),
  server: { middlewareMode: true, hmr: { server: createHttpServer() } },
  plugins: [{ name: "classic-resource-boundary", enforce: "pre", transform(code, id) {
    const file = id.replaceAll("\\", "/");
    for (const [name, counter] of forbiddenModules) {
      if (file.endsWith(`/src/simulation/${name}`)) forbidden(counter);
    }
    if (file.endsWith("/src/simulation/classic2dRenderer.js")) {
      // Exercise both compile-time DEV branches without a second renderer path.
      return code.replaceAll("import.meta.env.DEV", "globalThis.__classicPreviewDev");
    }
    if (file.endsWith("/src/simulation/computeYarnSimulation.js")) {
      return code.replace("export function computeYarnSimulation(", "function observedComputation(") +
        "\nexport function computeYarnSimulation(options) { globalThis.__classicComputations++; return observedComputation(options); }";
    }
  } }],
});

const styleKeys = ["lineWidth", "strokeStyle", "lineCap", "lineJoin", "globalAlpha",
  "globalCompositeOperation", "shadowBlur", "shadowOffsetX", "shadowOffsetY"];
function canvasSet({ swapped = false } = {}) {
  const trace = [], elements = [];
  function canvas(label) {
    const stack = [];
    const context = { lineWidth: 7, strokeStyle: "#010203", lineCap: "butt", lineJoin: "miter",
      globalAlpha: .65, globalCompositeOperation: "source-over", shadowBlur: 3,
      shadowOffsetX: 2, shadowOffsetY: -1,
      clearRect(...box) { trace.push({ layer: label, clear: box }); },
      save() { stack.push(Object.fromEntries(styleKeys.map(key => [key, this[key]]))); },
      restore() { assert.ok(stack.length, "Canvas save/restore must balance."); Object.assign(this, stack.pop()); },
      stroke(p) { trace.push({ layer: label, path: p.data,
        ...Object.fromEntries(styleKeys.map(key => [key, this[key]])) }); },
      drawImage() { forbidden("sample"); }, createPattern() { forbidden("sample"); },
      getImageData() { forbidden("sample"); },
    };
    const initialStyle = Object.fromEntries(styleKeys.map(key => [key, context[key]]));
    const element = { width: 640, height: 480, style: { cssText: "host-owned" }, context,
      getContext(kind) { if (kind !== "2d") forbidden("webgl"); return context; },
      assertRestored() {
        assert.equal(stack.length, 0);
        assert.deepEqual(Object.fromEntries(styleKeys.map(key => [key, context[key]])), initialStyle);
      },
    };
    elements.push(element);
    return element;
  }
  const back = canvas("back"), mid = canvas("mid"), front = canvas("front");
  return { trace, elements, canvases: { backCanvas: swapped ? front : back,
    midCanvas: mid, frontCanvas: swapped ? back : front } };
}
globalThis.document = { createElement() { forbidden("sample"); } };

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value, (_, item) =>
    item instanceof Map ? { entries: [...item] } : item)).digest("hex");
}
function freezeRenderData(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeRenderData);
  return Object.freeze(value);
}

function assertPngChecksums(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString("ascii", offset + 4, offset + 8);
    assert.ok(offset + length + 12 <= bytes.length, "PNG fixture chunks must be complete.");
    let crc = 0xffffffff;
    for (const byte of bytes.subarray(offset + 4, offset + 8 + length)) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    assert.equal((crc ^ 0xffffffff) >>> 0, bytes.readUInt32BE(offset + length + 8),
      `The ${type} PNG fixture chunk must have a valid checksum, without image decoding.`);
    offset += length + 12;
  }
}

// Frozen pre-split SOLID oracle, from the task's baseline-source copies of
// drawYarnSimulation.js and yarnTextureBrush.js (2026-11-01). Texture/UV branches
// are omitted because renderTextures=false. Keep the original rule traversal
// here so the test compares the shared resolver plus Classic against old output.
function originalSolidTrace(snapshot, target, { visibleYarnId = null, structureLineStyle = null,
  courseToFeedIndex, yarnIndexForSequenceRow } = {}) {
  const { activeYarnPlies, feedYarnPlies, feedYarnIds, yarnStrands, yarnPathLinks,
    feedCount, stitchWidth, palette, normalizedYarnSequence, hasYarnSequenceMask,
    canvasWidth, canvasHeight } = snapshot;
  const contexts = Object.fromEntries(["back", "mid", "front"].map(layer =>
    [layer, target.canvases[`${layer}Canvas`].getContext("2d")]));
  for (const layer of ["front", "mid", "back"]) contexts[layer].clearRect(0, 0, canvasWidth, canvasHeight);
  function rowPly(link, ply, yarnIndex) {
    if (visibleYarnId !== null && (ply !== activeYarnPlies[0] ||
      feedYarnIds.get(courseToFeedIndex(link.row, feedCount || 1))?.[yarnIndex] !== visibleYarnId)) return null;
    const assigned = feedYarnPlies.get(courseToFeedIndex(link.row, feedCount || 1));
    if (ply !== activeYarnPlies[0] && (assigned?.some(item => item.assetMaterial) || assigned?.length > 1)) return null;
    if (ply === activeYarnPlies[0] && feedCount) {
      const plies = feedYarnPlies.get(courseToFeedIndex(link.row, feedCount));
      if (plies) ply = plies[yarnIndex];
      else if (yarnIndex > 0) return null;
      if (!ply) return null;
    }
    if (!hasYarnSequenceMask || ply.assetMaterial) return ply;
    const paletteIndex = yarnIndexForSequenceRow(normalizedYarnSequence, link.row);
    const sequenceMaskColor = palette[paletteIndex] || activeYarnPlies[paletteIndex]?.color;
    return sequenceMaskColor ? { ...ply, sequenceMaskColor } : ply;
  }
  function stroke(context, p, width, color, alpha = 1) {
    context.lineWidth = width; context.strokeStyle = color; context.globalAlpha = alpha; context.stroke(p);
  }
  for (const layer of ["back", "front", "mid"]) {
    const links = yarnPathLinks.filter(link => link.layer === layer), context = contexts[layer];
    if (!links.length) continue;
    for (const ply of activeYarnPlies) {
      for (let yarnIndex = 0; yarnIndex < (ply === activeYarnPlies[0] ? yarnStrands.length : 1); yarnIndex++) {
        const masks = new Map();
        for (const link of links) {
          const material = rowPly(link, ply, yarnIndex), data = yarnStrands[yarnIndex].resolvedPathByLink.get(link.index);
          if (!material || !data) continue;
          const p = new Path2D(data), width = stitchWidth * material.diameter;
          context.save(); context.lineCap = "round"; context.lineJoin = "round";
          try {
            if (structureLineStyle) {
              const id = feedYarnIds.get(courseToFeedIndex(link.row, feedCount || 1))?.[yarnIndex];
              context.shadowBlur = context.shadowOffsetX = context.shadowOffsetY = 0;
              stroke(context, p, structureLineStyle.lineWidth, structureLineStyle.colors.get(id) || material.color);
            } else {
              stroke(context, p, width * 1.1, "rgba(0, 0, 0, 0.16)");
              stroke(context, p, width, material.color);
            }
          } finally { context.globalAlpha = 1; context.restore(); }
          if (structureLineStyle || !material.sequenceMaskColor) continue;
          const key = `${width}|${material.sequenceMaskColor}`;
          const batch = masks.get(key) || { width, color: material.sequenceMaskColor, paths: [] };
          batch.paths.push(data); masks.set(key, batch);
        }
        for (const batch of masks.values()) {
          context.save(); context.lineCap = "round"; context.lineJoin = "round";
          const previousComposite = context.globalCompositeOperation;
          try {
            context.globalCompositeOperation = "multiply";
            stroke(context, new Path2D(batch.paths.join(" ")), batch.width * 1.02, batch.color, .38);
            context.globalCompositeOperation = previousComposite || "source-over";
          } finally { context.globalAlpha = 1; context.restore(); }
        }
      }
    }
  }
  target.elements.forEach(element => element.assertRestored());
  return target.trace;
}

let registry, loadingRegistry, reopenedRegistry;
let guardAssets = false;
const nativeObjectUrl = URL.createObjectURL;
URL.createObjectURL = function (...args) {
  if (guardAssets) forbidden("objectUrl");
  return nativeObjectUrl.apply(this, args);
};
const renderers = [];
try {
  const [{ createClassic2dRenderer }, { computeYarnSimulation }, { resolveYarnRenderItems },
    { createProjectPackage, readProjectPackage }, registryModule, { Bimp },
    { resolveSingleJerseyOperations }, { createSingleJerseySimulationInput },
    { courseToFeedIndex }, { yarnIndexForSequenceRow }] = await Promise.all([
    "/src/simulation/classic2dRenderer.js", "/src/simulation/computeYarnSimulation.js",
    "/src/simulation/yarnRenderItems.js", "/src/actions/projectPackage.js",
    "/src/yarnTexture/yarnAssetRegistry.js", "/src/lib/Bimp.js",
    "/src/domain/singleJerseyMachine.js", "/src/adapters/singleJerseySimulationInput.js",
    "/src/simulation/yarnLengthMetrics.js", "/src/actions/yarnSequenceRows.js",
  ].map(file => server.ssrLoadModule(file)));
  assert.equal(typeof createClassic2dRenderer, "function");
  const { YarnAssetRegistry, yarnAssetRegistry } = registryModule;
  registry = yarnAssetRegistry;
  for (const [method, counter] of [["getBlob", "assetRead"], ["getObjectUrl", "objectUrl"],
    ["release", "assetRelease"], ["clear", "assetRelease"], ["retain", "assetRelease"]]) {
    const original = YarnAssetRegistry.prototype[method];
    YarnAssetRegistry.prototype[method] = function (...args) {
      if (guardAssets) forbidden(counter);
      return original.apply(this, args);
    };
  }
  const slots = ["baseColor", "normal", "roughness", "height", "ambientOcclusion", "metallic"];
  // Real PNG bytes, without invoking an image decoder in this acceptance test.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
  const originalPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  assertPngChecksums(png); assertPngChecksums(originalPng);
  function imageRef(bytes) {
    const blob = new Blob([bytes], { type: "image/png" });
    return { assetRef: registry.register(blob), mimeType: blob.type, byteLength: blob.size };
  }
  const primary = { color: "#445566", diameter: .24, enabled: true, texture: null };
  const companion = { color: "#aabbcc", diameter: .13, enabled: true, texture: null };
  const main = { yarnId: "main", yarnLengthCmPer100Needles: 23, tensionCN: null, placement: null };
  const spandex = { yarnId: "spandex", lengthInputMode: "relaxedWithDraft",
    relaxedLengthCmPer100Needles: 8, draftRatio: 3, tensionCN: null, placement: null };
  const project = { width: 12, height: 4, repeats: [], yarnPalette: [primary.color, companion.color],
    yarnSequence: { width: 1, height: 4, pixels: [0, 1, 1, 0] }, yarnPlies: [primary, companion],
    yarnLibrary: [{ id: "main", name: "Main", category: "N", color: "#123456", diameter: .24,
      pbr: { ...Object.fromEntries(slots.map(slot => [slot, { ...imageRef(png), fileName: `${slot}.png`,
        original: imageRef(originalPng) }])), physicalRepeatLengthMm: 12 } },
      { id: "spandex", name: "Spandex", category: "OP", color: "#c08040", diameter: .12 }],
    singleJerseyCamProgram: { tracks: [["K", "K"]], feeds: [{ yarns: [main, spandex] }, { yarns: [spandex, main] }] },
    needleArrangement: [1], needleArrangementInputs: ["1", "", "", ""], machineGauge: 32 };
  const packed = await createProjectPackage(project, registry);
  guardAssets = true;
  const opened = await readProjectPackage(packed);
  loadingRegistry = opened.registry;
  assert.deepEqual(counters, zeroCounters, "Opening the real six-map package must only read its manifest/directory.");
  guardAssets = false;
  registry.replaceWith(loadingRegistry);
  guardAssets = true;
  const loaded = opened.project;
  for (const slot of slots) {
    assert.ok(registry.has(loaded.yarnLibrary[0].pbr[slot].assetRef));
    assert.ok(registry.has(loaded.yarnLibrary[0].pbr[slot].original.assetRef));
  }
  assert.equal(loaded.yarnLibrary[0].pbr.physicalRepeatLengthMm, 12);
  const operations = resolveSingleJerseyOperations(loaded.singleJerseyCamProgram, loaded.needleArrangement,
    loaded.width, loaded.height);
  const snapshot = computeYarnSimulation({ pattern: createSingleJerseySimulationInput(operations),
    yarnSequence: loaded.yarnSequence, palette: loaded.yarnPalette, yarnPlies: loaded.yarnPlies,
    feeds: loaded.singleJerseyCamProgram.feeds, yarnLibrary: loaded.yarnLibrary, machineGauge: loaded.machineGauge,
    canvasWidth: 640, canvasHeight: 480, scope: "machine", inputSignature: "classic-six-map-fixture",
    projectGeneration: 17, feedYarnStructureRevision: 9 });
  assert.equal(snapshot.yarnStrands.length, 2);
  assert.equal(snapshot.originalSolverResults.length, 4);
  assert.deepEqual(snapshot.assignments.map(({ yarnId, yarnIndex }) => [yarnId, yarnIndex]),
    [["main", 0], ["spandex", 1], ["spandex", 0], ["main", 1]]);
  assert.notDeepEqual([...snapshot.yarnStrands[0].modelPathByLink], [...snapshot.yarnStrands[1].modelPathByLink],
    "Main and spandex must retain independent model paths.");
  for (const result of snapshot.originalSolverResults) {
    const id = snapshot.feedYarnIds.get(result.feedIndex)[result.yarnIndex];
    assert.equal(result.targetLengthCmPer100Needles, id === "main" ? 23 : 24);
  }
  const protectedDigest = digest({ snapshot, operations, loaded });
  const baseComputations = globalThis.__classicComputations;
  function sceneFor(value, overrides = {}) {
    const renderItems = freezeRenderData(resolveYarnRenderItems({ snapshot: value, ...overrides }));
    return Object.freeze({ snapshot: value, renderItems, canvasWidth: value.canvasWidth,
      canvasHeight: value.canvasHeight, stitchWidth: value.stitchWidth, ...overrides });
  }
  function mounted(target = canvasSet()) {
    const renderer = createClassic2dRenderer();
    renderers.push(renderer);
    assert.equal(renderer.status.phase, "unmounted");
    assert.ok(Object.isFrozen(renderer.status));
    assert.throws(() => renderer.update({}), /mount/i);
    assert.equal(renderer.mount(target.canvases), renderer);
    assert.equal(renderer.status.phase, "mounted");
    return { renderer, target };
  }
  const originalOptions = { courseToFeedIndex, yarnIndexForSequenceRow };
  async function compareOriginal(value, overrides = {}, targetOptions = {}) {
    const scene = sceneFor(value, overrides), { renderer, target } = mounted(canvasSet(targetOptions));
    const before = digest(value), expected = originalSolidTrace(value, canvasSet(targetOptions),
      { ...originalOptions, ...overrides });
    await renderer.update(scene);
    assert.deepEqual(target.trace, expected, "Classic trace must exactly equal the frozen original SOLID trace.");
    assert.equal(renderer.status.phase, "ready");
    assert.equal(await renderer.ready, renderer.status);
    assert.equal(renderer.status.failedTextureCount, 0);
    assert.equal(digest(value), before);
    target.elements.forEach(element => {
      element.assertRestored(); assert.equal(element.width, 640); assert.equal(element.height, 480);
      assert.equal(element.style.cssText, "host-owned", "Only the host owns Canvas sizing and CSS.");
    });
    return { scene, renderer, target };
  }
  const full = await compareOriginal(snapshot);
  assert.ok(full.scene.renderItems.items.every(item => item.plyIndex === 0 && !item.sequenceMaskColor));
  for (const id of ["main", "spandex"]) {
    const selected = await compareOriginal(snapshot, { visibleYarnId: id });
    assert.equal(selected.scene.renderItems.items.length, snapshot.yarnPathLinks.length);
    assert.deepEqual(new Set(selected.scene.renderItems.items.map(item => item.yarnIndex)), new Set([0, 1]),
      "Visibility follows actual Yarn ID across changing Feed slots.");
    assert.ok(selected.scene.renderItems.items.every(item => item.yarnId === id &&
      item.pathData === snapshot.yarnStrands[item.yarnIndex].resolvedPathByLink.get(item.link.index)));
  }
  const unknown = sceneFor(snapshot, { visibleYarnId: "absent" });
  assert.equal(unknown.renderItems.visibleYarnId, null);
  full.target.trace.length = 0;
  await full.renderer.update(unknown);
  assert.deepEqual(full.target.trace, originalSolidTrace(snapshot, canvasSet(), originalOptions));
  const flipped = await compareOriginal(snapshot, {}, { swapped: true });
  assert.ok(flipped.target.trace.some(event => event.layer === "front" &&
    event.path === full.scene.renderItems.groups.find(group => group.layer === "back").items[0].pathData));
  assert.deepEqual(snapshot.yarnPathLinks.map(link => link.layer), full.scene.renderItems.items
    .filter(item => item.yarnIndex === 0).sort((a, b) => a.link.index - b.link.index).map(item => item.layer),
  "Canvas mapping must not rewrite logical 2D layer labels.");

  const changedLibrary = loaded.yarnLibrary.map(asset => asset.id === "main" ? { ...asset, color: "#ffeedd" } : asset);
  const recolored = sceneFor(snapshot, { yarnLibrary: changedLibrary });
  assert.deepEqual(recolored.renderItems.items.map(item => item.pathData), full.scene.renderItems.items.map(item => item.pathData));
  full.target.trace.length = 0;
  await full.renderer.update(recolored);
  assert.ok(full.target.trace.some(event => event.strokeStyle === "#ffeedd"));
  assert.ok(full.target.trace.every(event => event.strokeStyle !== "#123456"));
  assert.equal(globalThis.__classicComputations, baseComputations, "Drawing, filtering, flipping and recoloring never compute.");
  assert.equal(digest({ snapshot, operations, loaded }), protectedDigest,
    "CN topology, both paths, targets, SolverResult, metrics, validity, revision and package fields must remain exact.");
  assert.throws(() => snapshot.yarnStrands[0].modelPathByLink.set(0, "mutated"), TypeError);
  assert.throws(() => { snapshot.contacts[0].st = -1; }, TypeError);

  const legacyOptions = { pattern: Bimp.empty(4, 8, 0), palette: project.yarnPalette,
    yarnSequence: project.yarnSequence, yarnPlies: [primary, companion], canvasWidth: 640, canvasHeight: 480,
    machineGauge: 32, feeds: null, yarnLibrary: [], scope: "pattern" };
  const legacy = computeYarnSimulation(legacyOptions);
  const old = await compareOriginal(legacy);
  assert.equal(old.scene.renderItems.items.length, legacy.yarnPathLinks.length * 2);
  const masks = old.target.trace.filter(event => event.globalCompositeOperation === "multiply");
  assert.ok(masks.length > 0 && masks.some(event => (event.path.match(/M/g) || []).length > 1),
    "Sequence masks must batch multiple paths rather than darken their crossings independently.");
  assert.ok(masks.every(event => event.globalAlpha === .38 && event.lineCap === "round" && event.lineJoin === "round"));
  const expectedMaskCount = old.scene.renderItems.groups.reduce((count, group) => count +
    new Set(group.items.filter(item => item.sequenceMaskColor).map(item =>
      `${legacy.stitchWidth * item.diameter}|${item.sequenceMaskColor}`)).size, 0);
  assert.equal(masks.length, expectedMaskCount, "Batches may not cross layer/ply/strand boundaries.");
  const firstItem = old.scene.renderItems.items[0], strokes = old.target.trace.filter(event => event.path);
  assert.equal(strokes[0].strokeStyle, "rgba(0, 0, 0, 0.16)");
  assert.equal(strokes[0].lineWidth, legacy.stitchWidth * firstItem.diameter * 1.1);
  assert.equal(strokes[1].strokeStyle, firstItem.color);
  assert.equal(strokes[1].lineWidth, legacy.stitchWidth * firstItem.diameter);
  assert.equal(strokes[0].globalAlpha, 1); assert.equal(strokes[1].globalAlpha, 1);
  for (const mask of masks) assert.ok(old.scene.renderItems.items.some(item =>
    mask.lineWidth === legacy.stitchWidth * item.diameter * 1.02 && mask.strokeStyle === item.sequenceMaskColor));

  const legacyFeed = computeYarnSimulation({ ...legacyOptions, scope: "machine",
    feeds: [{ yarns: [{ yarnId: "legacy", yarnLengthCmPer100Needles: 0 }] }] });
  assert.equal(legacyFeed.feedYarnPlies.get(0)[0], legacyFeed.activeYarnPlies[0]);
  assert.ok((await compareOriginal(legacyFeed)).scene.renderItems.items.some(item => item.legacyCompanion));
  const metadata = computeYarnSimulation({ ...legacyOptions, scope: "machine",
    feeds: [{ yarns: [{ yarnId: "metadata", yarnLengthCmPer100Needles: 0 }] }],
    yarnLibrary: [{ id: "metadata", pbr: { physicalRepeatLengthMm: 12 } }] });
  const meta = await compareOriginal(metadata);
  assert.equal(meta.scene.renderItems.items.length, metadata.yarnPathLinks.length);
  assert.ok(meta.scene.renderItems.items.every(item => !item.legacyCompanion && !item.sequenceMaskColor),
    "Metadata-only Asset ownership retains the old companion/mask suppression rule.");

  const trial = { colors: new Map([["main", "#36c7ff"], ["spandex", "#ff9854"]]), lineWidth: 2 };
  const trialFrame = await compareOriginal(snapshot, { structureLineStyle: trial });
  assert.equal(trialFrame.target.trace.filter(event => event.path).length, trialFrame.scene.renderItems.items.length);
  for (const event of trialFrame.target.trace.filter(event => event.path)) {
    assert.equal(event.lineWidth, 2); assert.equal(event.globalAlpha, 1);
    assert.equal(event.shadowBlur, 0); assert.equal(event.shadowOffsetX, 0); assert.equal(event.shadowOffsetY, 0);
    assert.ok(["#36c7ff", "#ff9854"].includes(event.strokeStyle));
    assert.equal(event.globalCompositeOperation, "source-over");
  }
  await compareOriginal(legacy, { structureLineStyle: trial }); // missing ID falls back to each ply color
  globalThis.__classicPreviewDev = false;
  trialFrame.target.trace.length = 0;
  await trialFrame.renderer.update(trialFrame.scene);
  assert.deepEqual(trialFrame.target.trace, originalSolidTrace(snapshot, canvasSet(), originalOptions),
    "Production ignores the DEV-only structure-line trial.");
  globalThis.__classicPreviewDev = true;

  const lifecycle = mounted();
  assert.throws(() => lifecycle.renderer.update({ snapshot }), /renderItems|groups/i,
    "Classic cannot silently resolve its own assignments when resolved data is missing.");
  assert.throws(() => lifecycle.renderer.mount(canvasSet().canvases), /dispose/i);
  await lifecycle.renderer.update(sceneFor(snapshot));
  const beforeSuspend = lifecycle.target.trace.length;
  lifecycle.renderer.suspend();
  assert.equal(lifecycle.renderer.status.phase, "suspended");
  assert.equal(await lifecycle.renderer.ready, lifecycle.renderer.status);
  assert.equal(lifecycle.target.trace.length, beforeSuspend);
  await lifecycle.renderer.update(sceneFor(snapshot));
  assert.equal(lifecycle.renderer.status.phase, "ready");
  const computationCount = globalThis.__classicComputations;
  for (const renderer of renderers) renderer.dispose();
  const disposedTrace = lifecycle.target.trace.slice();
  assert.deepEqual(disposedTrace.slice(-3).map(event => event.clear), Array(3).fill([0, 0, 640, 480]));
  lifecycle.renderer.dispose();
  await lifecycle.renderer.update(sceneFor(snapshot));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(lifecycle.renderer.status.phase, "disposed");
  assert.equal(await lifecycle.renderer.ready, lifecycle.renderer.status);
  assert.deepEqual(lifecycle.target.trace, disposedTrace, "Disposed or repeated cleanup cannot draw again.");
  assert.throws(() => lifecycle.renderer.mount(lifecycle.target.canvases), /disposed/i);
  assert.equal(globalThis.__classicComputations, computationCount);
  assert.equal(digest({ snapshot, operations, loaded }), protectedDigest);
  assert.deepEqual(counters, zeroCounters, "Complete package + core + shared resolver + Classic must perform zero PBR resource work.");

  // Persistence deliberately reads binary bytes after the protected draw phase;
  // byte reads are distinct from decoding, sampling, URLs or GPU work.
  guardAssets = false;
  const saved = await createProjectPackage(loaded, registry);
  const reopened = await readProjectPackage(saved);
  reopenedRegistry = reopened.registry;
  const withoutRefs = value => JSON.parse(JSON.stringify(value, (key, item) => key === "assetRef" ? "<registry-ref>" : item));
  assert.deepEqual(withoutRefs(reopened.project), withoutRefs(loaded));
  for (const slot of slots) {
    const map = reopened.project.yarnLibrary[0].pbr[slot];
    assert.equal(map.fileName, `${slot}.png`);
    assert.deepEqual(Buffer.from(await (await reopenedRegistry.getBlob(map.assetRef)).arrayBuffer()), png);
    assert.deepEqual(Buffer.from(await (await reopenedRegistry.getBlob(map.original.assetRef)).arrayBuffer()), originalPng);
    assert.ok(registry.has(loaded.yarnLibrary[0].pbr[slot].assetRef), "Classic disposal must retain project assets.");
    assert.ok(registry.has(loaded.yarnLibrary[0].pbr[slot].original.assetRef));
  }
  assert.deepEqual(counters, zeroCounters);
  console.log("PASS: original SOLID traces, widths/colors, group masks, legacy/Asset rules, actual Yarn ID filters, mapped front/back, DEV trial, latest colors and lifecycle.");
  console.log("PASS: immutable shared core paths/topology/SolverResult/metrics/validity/revision; six-map real package and original bytes survive Classic/save/reload.");
  console.log(JSON.stringify({ resourceCalls: counters, binaryFileReads, comparisons: "exact drawing traces and snapshot SHA-256" }));
} finally {
  guardAssets = false;
  renderers.forEach(renderer => renderer.dispose());
  registry?.clear(); loadingRegistry?.clear(); reopenedRegistry?.clear();
  URL.createObjectURL = nativeObjectUrl;
  await server.close();
  for (const key of ["__classicPreviewDev", "__classicComputations", "Path2D", "Image", "FileReader",
    "createImageBitmap", "WebGLRenderingContext", "document"]) delete globalThis[key];
}
