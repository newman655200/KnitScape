import assert from "node:assert/strict";
import { createServer } from "vite";

globalThis.devicePixelRatio = 1;
globalThis.Path2D = class Path2D {
  constructor(data = "") { this.data = data; }
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  closePath() {}
  rect() {}
};

const preparationJobs = [];
globalThis.__feedYarnPbrPreparationJobs = preparationJobs;
const server = await createServer({
  appType: "custom", logLevel: "silent", server: { middlewareMode: true },
  plugins: [{
    name: "observe-real-pbr-preparation",
    enforce: "pre",
    transform(source, id) {
      if (!id.replaceAll("\\", "/").endsWith("/src/simulation/yarnTextureBrush.js")) return;
      return source.replace(/export (async )?function prepareYarnTextureImages\(/,
        (_, asyncKeyword = "") => `${asyncKeyword}function observedPrepareYarnTextureImages(`) +
        `\nexport function prepareYarnTextureImages(...args) {
          const job = observedPrepareYarnTextureImages(...args);
          globalThis.__feedYarnPbrPreparationJobs.push(Promise.resolve(job));
          return job;
        }\n`;
    },
  }],
});

try {
  globalThis.window = { location: { search: "" }, setTimeout, clearTimeout,
    btoa: value => Buffer.from(value, "binary").toString("base64") };
  const [brush, { simulate }, { Bimp }, { yarnAssetRegistry }, scan, domain,
    state, actions, exporters, importers, codec, runnerModule] = await Promise.all([
    server.ssrLoadModule("/src/simulation/yarnTextureBrush.js"),
    server.ssrLoadModule("/src/simulation/yarnSimulation.js"),
    server.ssrLoadModule("/src/lib/Bimp.js"),
    server.ssrLoadModule("/src/yarnTexture/yarnAssetRegistry.js"),
    server.ssrLoadModule("/src/yarnTexture/yarnScanTexture.js"),
    server.ssrLoadModule("/src/domain/yarnLibrary.js"),
    server.ssrLoadModule("/src/state.js"),
    server.ssrLoadModule("/src/actions/yarnLibrary.js"),
    server.ssrLoadModule("/src/actions/exporters.js"),
    server.ssrLoadModule("/src/actions/importers.js"),
    server.ssrLoadModule("/src/actions/projectPackage.js"),
    server.ssrLoadModule("/src/components/runSimulation.js"),
  ]);
  assert.equal(typeof brush.resolveFeedYarnPlies, "function",
    "First Feed Yarn PBR must resolve into the existing renderer material.");

  const slots = ["baseColor", "normal", "roughness", "height", "ambientOcclusion"];
  const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  const pixelBytes = Buffer.from(pixel.split(",")[1], "base64");
  const byteReads = [];
  const imageSources = [];
  const uploads = [];
  const draws = [];
  let textureCreations = 0;
  const patterns = [];
  const urlRefs = new Map();
  const originalGetObjectUrl = yarnAssetRegistry.getObjectUrl.bind(yarnAssetRegistry);
  yarnAssetRegistry.getObjectUrl = async ref => {
    const url = await originalGetObjectUrl(ref);
    urlRefs.set(url, ref);
    return url;
  };

  globalThis.Image = class FakeImage {
    naturalWidth = 8;
    naturalHeight = 8;
    set src(source) {
      this.source = source;
      imageSources.push(source);
      fetch(source).then(response => response.arrayBuffer()).then(bytes => {
        if (!Buffer.from(bytes).equals(pixelBytes)) throw new Error("Invalid test image.");
        this.onload();
      }).catch(() => this.onerror());
    }
  };

  function createFakeGl(canvas) {
    let activeUnit = 0;
    let boundTexture = null;
    const bindings = new Map();
    const uniforms = new Map();
    let arrayBuffers = [];
    let gl;
    const implementation = {
      canvas, createShader: () => ({}), createProgram: () => ({}),
      createBuffer: () => ({}), createTexture: () => { textureCreations++; return {}; },
      getShaderParameter: () => true, getProgramParameter: () => true,
      getAttribLocation: () => 0, getUniformLocation: (_, name) => name,
      activeTexture(unit) { activeUnit = unit - gl.TEXTURE0; },
      bindTexture(_, texture) { boundTexture = texture; bindings.set(activeUnit, texture); },
      uniform1i(name, value) { uniforms.set(name, value); },
      uniform4fv(name, value) { uniforms.set(name, Array.from(value)); },
      bufferData(_, data) {
        if (data instanceof Float32Array) arrayBuffers.push(data.slice());
      },
      texImage2D(...args) {
        const image = args.at(-1);
        if (!(image instanceof Image)) return; // Exclude the 1x1 fallback texture.
        const ref = urlRefs.get(image.source) ?? image.source;
        boundTexture.sourceRef = ref;
        uploads.push({ gl, ref });
      },
      drawElements() {
        const maps = Object.fromEntries(slots.map((slot, index) => {
          const uniform = "u_has" + slot[0].toUpperCase() + slot.slice(1) + "Map";
          return [slot, uniforms.get(uniform) ? bindings.get(index)?.sourceRef : null];
        }));
        draws.push({ gl, maps, tint: uniforms.get("u_tint"),
          positions: arrayBuffers[0], uvs: arrayBuffers[1] });
        arrayBuffers = [];
      },
    };
    gl = new Proxy(implementation, { get(target, name) {
      if (name in target) return target[name];
      return /^[A-Z_0-9]+$/.test(String(name)) ? 1 : () => {};
    } });
    return gl;
  }

  const strokes = [];
  let webglEnabled = true;
  function createCanvas(id = "") {
    const context = { clearRect() {}, save() {}, restore() {}, drawImage() {},
      createPattern(image) {
        const pattern = { ref: urlRefs.get(image.source) ?? image.source };
        patterns.push(pattern);
        return pattern;
      }, stroke() { strokes.push(this.strokeStyle); },
      globalAlpha: 1, globalCompositeOperation: "source-over" };
    const canvas = { id, width: 320, height: 240, style: {},
      getContext(type) {
        if (type === "2d") return context;
        if (type === "webgl") return webglEnabled ? this.gl ??= createFakeGl(this) : null;
        return null;
      }, toDataURL: () => pixel };
    return canvas;
  }
  const canvases = new Map(["back", "mid", "front"].map(id => [id, createCanvas(id)]));
  globalThis.document = {
    createElement: () => createCanvas(),
    getElementById(id) {
      if (["sim-container", "sim-before-container", "sim-after-container", "desktop"].includes(id)) {
        return { getBoundingClientRect: () => ({ width: 320, height: 240 }) };
      }
      if (id === "machine-execution-error") return null;
      if (!canvases.has(id)) canvases.set(id, createCanvas(id));
      return canvases.get(id);
    },
  };

  const primaryPly = { name: "main", color: "#123456", diameter: 0.24,
    lengthScaleY: 1, enabled: true, texture: null };
  const feed = (first, second = "second-only") => ({ yarns: [first, second].map(yarnId =>
    ({ yarnId, yarnLengthCmPer100Needles: 0, tensionCN: null, placement: "parallel" })) });
  const asset = (id, selectedSlots = slots, loader = null) => {
    const pbr = Object.fromEntries(selectedSlots.map(slot => {
      const ref = yarnAssetRegistry.register(async () => {
        byteReads.push(ref);
        return loader ? loader() : new Blob([pixelBytes], { type: "image/png" });
      });
      return [slot, { assetRef: ref, fileName: id + "_" + slot + ".png",
        mimeType: "image/png", byteLength: pixelBytes.length }];
    }));
    return { ...domain.createYarnAsset(id, id), ...(selectedSlots.length ? { pbr } : {}) };
  };
  const refs = yarn => slots.flatMap(slot => yarn.pbr?.[slot]?.assetRef ? [yarn.pbr[slot].assetRef] : []);
  const counts = () => ({ reads: byteReads.length, decodes: imageSources.length, uploads: uploads.length });
  const difference = start => Object.fromEntries(Object.entries(counts()).map(([key, value]) => [key, value - start[key]]));
  const assertNoWork = (start, message) => assert.deepEqual(difference(start),
    { reads: 0, decodes: 0, uploads: 0 }, message);
  async function settlePreparation() {
    while (preparationJobs.length) await Promise.all(preparationJobs.splice(0));
    await new Promise(resolve => setImmediate(resolve));
  }
  async function render(feeds, yarnLibrary, scale = 1, ply = primaryPly, options = {}) {
    const { height = 8, ...runtimeOptions } = options;
    const result = simulate(Bimp.empty(4, height, 0), new Bimp(1, height, Array(height).fill(0)),
      [primaryPly.color], scale, [ply], { feeds, yarnLibrary,
        texturePerformanceMode: "quality", ...runtimeOptions });
    await settlePreparation();
    result.stopSim();
    return result;
  }
  const uploadedRefs = start => new Set(uploads.slice(start.uploads).map(upload => upload.ref));
  function assertOneUploadPerContext(start) {
    const pairs = new Map();
    for (const upload of uploads.slice(start.uploads)) {
      const seen = pairs.get(upload.gl) ?? new Set();
      assert.equal(seen.has(upload.ref), false, "A ready map uploads only once per WebGL context.");
      seen.add(upload.ref); pairs.set(upload.gl, seen);
    }
  }

  const fullA = asset("A"), partialB = asset("B", ["baseColor"]);
  const partialC = asset("C", ["baseColor", "normal", "roughness"]);
  const noPbr = asset("none", []), secondOnly = asset("second-only");
  const library = [fullA, partialB, partialC, noPbr, secondOnly,
    ...Array.from({ length: 95 }, (_, index) => asset("unused-" + index))];
  const feeds = [feed("A"), feed("B"), feed("C"), feed("none")];
  const unchangedLibrary = structuredClone(library);
  const unchangedFeeds = structuredClone(feeds);
  const start = counts();
  domain.queryYarnLibrary(library);
  const resolved = brush.resolveFeedYarnPlies(feeds, library, primaryPly);
  assert.ok(resolved instanceof Map);
  assert.deepEqual([...resolved.keys()], [0, 1, 2, 3]);
  assert.equal(resolved.get(0).texture.pbr.normal.assetRef, fullA.pbr.normal.assetRef);
  assert.equal(resolved.get(3), primaryPly, "An Asset without PBR preserves the old primary ply.");
  assert.deepEqual(scan.normalizeYarnTexture(resolved.get(0).texture).pbr.normal.assetRef,
    fullA.pbr.normal.assetRef, "Runtime texture normalization must preserve Registry refs.");
  for (const yarn of library) for (const ref of refs(yarn)) {
    assert.equal(brush.getReadyYarnTextureImage({ assetRef: ref }), null);
  }
  assertNoWork(start, "Listing/resolving/checking a 100 Asset library reads and decodes zero maps.");
  assert.deepEqual(library, unchangedLibrary);
  assert.deepEqual(feeds, unchangedFeeds);

  const before = counts();
  await render(null, library);
  assertNoWork(before, "Pattern preview without Feed assignment does not consume Yarn Library PBR.");
  await render(feeds, library, 1, primaryPly, { texturePerformanceMode: "solid" });
  assertNoWork(before, "Solid mode does not read, decode or upload a newly assigned PBR group.");
  await render(feeds, library, 1, primaryPly,
    { texturePerformanceMode: "auto", texturePreviewInteractionActive: true });
  assertNoWork(before, "Auto interaction mode does not read, decode or upload a new PBR group.");
  await render(feeds, library);
  assert.equal(difference(start).reads, 9, "First Feed Yarns read exactly 5+1+3+0 maps.");
  assert.equal(difference(start).decodes, 9, "First Feed Yarns decode exactly 5+1+3+0 maps.");
  const expectedRefs = new Set([...refs(fullA), ...refs(partialB), ...refs(partialC)]);
  assert.deepEqual(uploadedRefs(start), expectedRefs, "Existing WebGL renderer receives every selected map.");
  assert.ok(draws.some(draw => draw.maps.normal === fullA.pbr.normal.assetRef));
  assert.ok(refs(secondOnly).every(ref => !byteReads.includes(ref)), "Second Feed Yarns never read their maps.");
  assertOneUploadPerContext(start);
  const zoomStart = counts();
  await render(feeds, library); await render(feeds, library, 1.5);
  assertNoWork(zoomStart, "Repeated simulation and zoom reuse reads, decodes and per-context GPU uploads.");

  yarnAssetRegistry.clear();
  const sharedA = asset("shared-A"), sharedB = asset("shared-B", ["baseColor"]);
  const sharedNone = asset("shared-none", []), sharedSecond = asset("second-only");
  const sharedLibrary = [sharedA, sharedB, sharedNone, sharedSecond];
  const sharedFeeds = [feed("shared-A"), feed("shared-B"), feed("shared-A"), feed("shared-none")];
  const sharedStart = counts();
  await render(sharedFeeds, sharedLibrary);
  assert.equal(difference(sharedStart).reads, 6, "The same Asset assigned twice reads 5+1 maps once.");
  assert.equal(difference(sharedStart).decodes, 6, "The same Asset assigned twice decodes 5+1 maps once.");
  assert.deepEqual(uploadedRefs(sharedStart), new Set([...refs(sharedA), ...refs(sharedB)]));
  assertOneUploadPerContext(sharedStart);
  const sharedRepeat = counts(); await render(sharedFeeds, sharedLibrary, 0.8);
  assertNoWork(sharedRepeat, "Shared Feed assignments stay cached during zoom.");

  const sharedC = asset("shared-C", ["baseColor", "normal", "roughness"]);
  const abacFeeds = [feed(sharedA.id), feed(sharedB.id), feed(sharedA.id), feed(sharedC.id)];
  const abacLibrary = [...sharedLibrary, sharedC];
  const abacStart = counts(), abacDrawStart = draws.length;
  await render(abacFeeds, abacLibrary);
  assert.equal(difference(abacStart).reads, 3, "A/B/A/C reads only C's three new maps; both A Feeds and B stay cached.");
  assert.equal(difference(abacStart).decodes, 3, "A/B/A/C decodes C once without decoding the shared A again.");
  assert.deepEqual(uploadedRefs(abacStart), new Set(refs(sharedC)));
  assert.ok(draws.slice(abacDrawStart).some(draw => draw.maps.normal === sharedC.pbr.normal.assetRef),
    "The fourth A/B/A/C Feed draws C's own material through the real renderer.");
  assert.ok(draws.slice(abacDrawStart).some(draw => draw.maps.baseColor === sharedA.pbr.baseColor.assetRef));
  assertOneUploadPerContext(abacStart);
  const abacRepeat = counts(); await render(abacFeeds, abacLibrary, 1.3);
  assertNoWork(abacRepeat, "A/B/A/C repeats and zoom reuse the shared A and independent B/C materials.");

  // Different Assets may share the very same binary image while owning their own UV scale.
  const materialA = { ...sharedA, pbr: { baseColor: sharedA.pbr.baseColor, physicalRepeatLengthMm: 8 } };
  const materialB = { ...sharedB, pbr: { baseColor: sharedA.pbr.baseColor, physicalRepeatLengthMm: 15 } };
  const scaleLibrary = [materialA, materialB, sharedSecond];
  const scaleFeeds = [feed(materialA.id), feed(materialB.id)];
  const independent = brush.resolveFeedYarnPlies(scaleFeeds, scaleLibrary, primaryPly);
  assert.equal(independent.get(0).texture.pbr.physicalRepeatLengthMm, 8);
  assert.equal(independent.get(1).texture.pbr.physicalRepeatLengthMm, 15);
  assert.equal(independent.get(0).texture.pbr.baseColor.assetRef,
    independent.get(1).texture.pbr.baseColor.assetRef);
  state.dispatch({ yarnLibrary: scaleLibrary });
  const baselineLibrary = scaleLibrary.map(yarn => {
    if (!yarn.pbr) return yarn;
    const { physicalRepeatLengthMm, ...pbr } = yarn.pbr;
    return { ...yarn, pbr };
  });
  let drawStart = draws.length;
  await render(scaleFeeds, baselineLibrary);
  const legacyFrame = draws.slice(drawStart);
  const scaleStart = counts(), createStart = textureCreations;
  drawStart = draws.length;
  await render(scaleFeeds, scaleLibrary);
  const scaleFrame = draws.slice(drawStart);
  assert.equal(scaleFrame.length, legacyFrame.length);
  const factors = new Set();
  for (let index = 0; index < scaleFrame.length; index++) {
    const actual = scaleFrame[index], legacy = legacyFrame[index];
    assert.deepEqual(actual.positions, legacy.positions, "physical scale cannot change Solver or geometry positions.");
    if (legacy.uvs.at(-2) === legacy.uvs[0]) continue;
    const factor = actual.uvs.at(-2) / legacy.uvs.at(-2);
    const repeat = Math.abs(factor - 48 * 25.4 / 32 / 8) < 1e-5 ? 8 : 15;
    factors.add(repeat);
    for (let i = 0; i < actual.uvs.length; i += 2) {
      assert.ok(Math.abs(actual.uvs[i] - legacy.uvs[i] * 48 * 25.4 / 32 / repeat) < 1e-5,
        "every drawn U uses its own Yarn's physical repeat even with a shared BaseColor.");
    }
  }
  assert.deepEqual(factors, new Set([8, 15]));
  for (const machineGauge of [28, 36]) {
    drawStart = draws.length;
    await render(scaleFeeds, scaleLibrary, 1, primaryPly, { machineGauge });
    const gaugeFrame = draws.slice(drawStart);
    assert.equal(gaugeFrame.length, scaleFrame.length);
    for (let index = 0; index < gaugeFrame.length; index++) {
      const actual = gaugeFrame[index], reference = scaleFrame[index];
      assert.deepEqual(actual.positions, reference.positions);
      for (let i = 0; i < actual.uvs.length; i += 2) {
        assert.ok(Math.abs(actual.uvs[i] - reference.uvs[i] * 32 / machineGauge) < 1e-5,
          "simulation must forward Machine Gauge into each rendered physical strip.");
      }
    }
  }
  actions.setYarnPbrPhysicalRepeatLength(materialA.id, 10);
  drawStart = draws.length;
  await render(scaleFeeds, state.GLOBAL_STATE.yarnLibrary);
  const updatedFrame = draws.slice(drawStart);
  assert.ok(updatedFrame.some((draw, index) => draw.uvs.at(-2) !== scaleFrame[index].uvs.at(-2)),
    "a repeat-only action rebuilds UV for the assigned Yarn.");
  for (let index = 0; index < updatedFrame.length; index++) {
    assert.deepEqual(updatedFrame[index].positions, scaleFrame[index].positions);
  }
  assertNoWork(scaleStart, "repeat-only metadata edits read/decode/upload zero images.");
  assert.equal(textureCreations, createStart, "repeat-only edits create zero GPU textures.");
  actions.setYarnPbrPhysicalRepeatLength(materialA.id, "");
  actions.setYarnPbrPhysicalRepeatLength(materialB.id, "");
  drawStart = draws.length;
  await render(scaleFeeds, state.GLOBAL_STATE.yarnLibrary);
  assert.deepEqual(draws.slice(drawStart).map(draw => draw.uvs), legacyFrame.map(draw => draw.uvs),
    "clearing repeat mm restores the entire legacy frame exactly.");

  const fourFull = Array.from({ length: 4 }, (_, index) => asset("full-" + index));
  const fourFullLibrary = [...fourFull, secondOnly];
  const fourFullFeeds = fourFull.map(yarn => feed(yarn.id));
  const fourFullStart = counts();
  await render(fourFullFeeds, fourFullLibrary);
  assert.equal(difference(fourFullStart).reads, 20, "Four complete first-Yarn PBR groups read exactly 20 maps.");
  assert.equal(difference(fourFullStart).decodes, 20, "Four complete first-Yarn PBR groups decode exactly 20 maps.");
  assert.deepEqual(uploadedRefs(fourFullStart), new Set(fourFull.flatMap(refs)));
  assertOneUploadPerContext(fourFullStart);
  const fullRepeat = counts();
  await render(fourFullFeeds, fourFullLibrary); await render(fourFullFeeds, fourFullLibrary, 1.4);
  assertNoWork(fullRepeat, "Four full PBR groups fit the current caches and reuse them during zoom.");

  const sixFull = Array.from({ length: 6 }, (_, index) => asset("six-full-" + index));
  const sixFullFeeds = sixFull.map(yarn => feed(yarn.id));
  const sixFullStart = counts();
  await render(sixFullFeeds, sixFull, 1, primaryPly, { height: 12 });
  assert.equal(difference(sixFullStart).reads, 30, "Six complete first-Yarn PBR groups read exactly 30 maps.");
  assert.equal(difference(sixFullStart).decodes, 30, "Six complete first-Yarn PBR groups decode exactly 30 maps.");
  assert.deepEqual(uploadedRefs(sixFullStart), new Set(sixFull.flatMap(refs)),
    "Every live map must reach the renderer even when the active set exceeds the old 24-map cache.");
  assertOneUploadPerContext(sixFullStart);
  const sixFullRepeat = counts();
  await render(sixFullFeeds, sixFull, 1, primaryPly, { height: 12 });
  await render(sixFullFeeds, sixFull, 1.5, primaryPly, { height: 12 });
  assertNoWork(sixFullRepeat, "A live 30-map set cannot churn reads, image decodes or GPU uploads during zoom.");

  const hidden = asset("hidden-feed"), visible = asset("visible-feed", ["baseColor"]);
  const hiddenFeeds = [feed(visible.id), feed(hidden.id)];
  const visibleMaterials = brush.resolveFeedYarnPlies(hiddenFeeds, [visible, hidden], primaryPly, new Set([0]));
  assert.deepEqual([...visibleMaterials.keys()], [0]);
  const hiddenStart = counts();
  await render(hiddenFeeds, [visible, hidden], 1, primaryPly, { height: 1 });
  assert.equal(difference(hiddenStart).reads, 1); assert.equal(difference(hiddenStart).decodes, 1);
  assert.deepEqual(uploadedRefs(hiddenStart), new Set(refs(visible)));
  assert.ok(refs(hidden).every(ref => !byteReads.includes(ref)),
    "A Feed absent from actual geometry reads zero maps through the integrated simulation.");

  const legacyTexture = { processedDataUrl: pixel, dataUrl: pixel, enabled: true,
    useOriginalColor: true, textureStrength: 0.75, fuzzStrength: 0, pbr: {} };
  const legacyPly = { ...primaryPly, texture: legacyTexture };
  const fallbackFeeds = [feed("missing"), { yarns: [] }, feed("shared-none"), feed("")];
  const fallback = brush.resolveFeedYarnPlies(fallbackFeeds, sharedLibrary, legacyPly);
  for (const ply of fallback.values()) assert.equal(ply, legacyPly);
  const selected = brush.resolveFeedYarnPlies(sharedFeeds, sharedLibrary, legacyPly, new Set([1]));
  assert.deepEqual([...selected.keys()], [1], "Unused Feeds do not receive render materials.");
  assert.equal(selected.get(1).texture.pbr.baseColor.assetRef, sharedB.pbr.baseColor.assetRef);
  assert.equal(selected.get(1).texture.processedDataUrl || "", "", "Valid Asset PBR takes priority over legacy texture.");
  const legacyStart = counts();
  assert.equal(brush.getReadyYarnTextureImage(pixel), null);
  assertNoWork(legacyStart, "A legacy ready-image getter also never starts loading.");
  await render(fallbackFeeds, sharedLibrary, 1, legacyPly);
  assert.equal(difference(legacyStart).reads, 0);
  assert.equal(difference(legacyStart).decodes, 1, "Legacy embedded scan texture still decodes once.");
  assert.ok(uploadedRefs(legacyStart).has(pixel));
  const legacyRepeat = counts(); await render(fallbackFeeds, sharedLibrary, 1.2, legacyPly);
  assertNoWork(legacyRepeat, "Legacy data URL rendering retains its cache behavior.");

  const normalOnly = asset("normal-only", ["normal"]);
  const normalStart = counts();
  await render([feed(normalOnly.id)], [normalOnly]);
  assert.equal(difference(normalStart).reads, 1); assert.equal(difference(normalStart).decodes, 1);
  assert.ok(draws.some(draw => draw.maps.normal === normalOnly.pbr.normal.assetRef && !draw.maps.baseColor),
    "Normal-only PBR reaches the same UV renderer using the existing tint.");
  const failed = asset("failed", ["normal"], () => { throw new Error("Fixture binary read failed."); });
  const failedStart = counts();
  const failedDrawStart = draws.length;
  await render([feed(failed.id)], [failed]);
  assert.equal(difference(failedStart).reads, 1); assert.equal(difference(failedStart).decodes, 0);
  assert.equal(difference(failedStart).uploads, 0, "A failed map falls back without uploading a bad texture.");
  assert.equal(brush.getReadyYarnTextureImage({ assetRef: failed.pbr.normal.assetRef }), null);
  const failedDraws = draws.slice(failedDrawStart);
  assert.ok(failedDraws.length > 0, "A failed map still produces actual renderer draws.");
  for (const draw of failedDraws) {
    assert.ok(Object.values(draw.maps).every(map => map === null));
    assert.deepEqual(draw.tint, [0x12 / 255, 0x34 / 255, 0x56 / 255, 1],
      "Failed image loading preserves the original material color.");
  }
  const badImage = asset("decode-failed", ["baseColor"],
    () => new Blob(["invalid image bytes"], { type: "image/png" }));
  const badImageStart = counts(), badImageDrawStart = draws.length;
  await render([feed(badImage.id)], [badImage]);
  assert.equal(difference(badImageStart).reads, 1); assert.equal(difference(badImageStart).decodes, 1);
  assert.equal(difference(badImageStart).uploads, 0);
  assert.ok(draws.slice(badImageDrawStart).every(draw =>
    Object.values(draw.maps).every(map => map === null)), "Decode errors cannot leave a ready or uploaded map.");

  const canvasOnly = asset("canvas-fallback", ["baseColor"]);
  const originalCanvases = [...canvases];
  webglEnabled = false;
  for (const id of canvases.keys()) canvases.set(id, createCanvas(id));
  const canvasStart = counts(), patternStart = patterns.length;
  try {
    await render([feed(canvasOnly.id)], [canvasOnly]);
    assert.equal(difference(canvasStart).reads, 1); assert.equal(difference(canvasStart).decodes, 1);
    assert.equal(difference(canvasStart).uploads, 0);
    assert.ok(patterns.slice(patternStart).some(pattern => pattern.ref === canvasOnly.pbr.baseColor.assetRef),
      "When WebGL is unavailable, the existing Canvas brush consumes the selected BaseColor image.");
    const canvasRepeat = counts(); await render([feed(canvasOnly.id)], [canvasOnly], 1.3);
    assertNoWork(canvasRepeat, "Canvas fallback zoom reuses the ready BaseColor image.");
  } finally {
    webglEnabled = true;
    for (const [id, canvas] of originalCanvases) canvases.set(id, canvas);
  }

  let resolvePending;
  const pending = asset("stopped-pending", ["baseColor"],
    () => new Promise(resolve => { resolvePending = resolve; }));
  const stopped = simulate(Bimp.empty(4, 8, 0), new Bimp(1, 8, Array(8).fill(0)),
    [primaryPly.color], 1, [primaryPly], { feeds: [feed(pending.id)],
      yarnLibrary: [pending], texturePerformanceMode: "quality" });
  stopped.stopSim();
  for (let turn = 0; turn < 10 && !resolvePending; turn++) await Promise.resolve();
  assert.equal(typeof resolvePending, "function", "The stopped simulation must have a real in-flight binary read.");
  const stoppedDrawCount = draws.length, stoppedStrokeCount = strokes.length, stoppedUploadCount = uploads.length;
  resolvePending(new Blob([pixelBytes], { type: "image/png" }));
  await settlePreparation();
  assert.equal(draws.length, stoppedDrawCount, "A completed old preload never redraws a stopped simulation.");
  assert.equal(strokes.length, stoppedStrokeCount);
  assert.equal(uploads.length, stoppedUploadCount, "Stopped asynchronous work never uploads textures to the canvas.");

  state.dispatch({ yarnLibrary: [normalOnly], singleJerseyCamProgram: null });
  await render([feed(normalOnly.id)], [normalOnly]);
  const oldRef = normalOnly.pbr.normal.assetRef;
  assert.ok(brush.getReadyYarnTextureImage({ assetRef: oldRef }), "The replaced image must actually be cached before release.");
  const oldUrl = await yarnAssetRegistry.getObjectUrl(oldRef);
  await actions.importYarnPbr(normalOnly.id, [new File([pixelBytes], "replacement_Normal.png", { type: "image/png" })]);
  const replacement = state.GLOBAL_STATE.yarnLibrary[0];
  assert.notEqual(replacement.pbr.normal.assetRef, oldRef, "Replacement retains the Yarn id but changes binary identity.");
  assert.equal(yarnAssetRegistry.has(oldRef), false);
  assert.equal(brush.getReadyYarnTextureImage({ assetRef: oldRef }), null, "Released maps are not returned from image cache.");
  await assert.rejects(fetch(oldUrl), "Replacement revokes its previous object URL.");
  const replacementStart = counts(); await render([feed(normalOnly.id)], [replacement]);
  assert.equal(difference(replacementStart).reads, 0, "An imported Blob needs no lazy loader read.");
  assert.equal(difference(replacementStart).decodes, 1);
  assert.deepEqual(uploadedRefs(replacementStart), new Set([replacement.pbr.normal.assetRef]));
  const packageBlob = await codec.createProjectPackage(exporters.getProjectData());
  const replacementRef = replacement.pbr.normal.assetRef;
  assert.ok(brush.getReadyYarnTextureImage({ assetRef: replacementRef }), "The cleared image must actually be cached before release.");
  actions.clearYarnPbr(normalOnly.id);
  assert.equal(brush.getReadyYarnTextureImage({ assetRef: replacementRef }), null);
  const clearedStart = counts(); await render([feed(normalOnly.id)], state.GLOBAL_STATE.yarnLibrary);
  assertNoWork(clearedStart, "Clearing PBR restores the old material without any map work.");
  assert.ok(strokes.includes(primaryPly.color));
  const reopenStart = counts();
  await importers.loadProjectFile(new File([packageBlob], "renderer-roundtrip.knitscape"));
  assertNoWork(reopenStart, "Opening a project keeps image entries lazy until rendering.");
  const reopened = state.GLOBAL_STATE.yarnLibrary[0];
  assert.notEqual(reopened.pbr.normal.assetRef, replacementRef);
  await render([feed(normalOnly.id)], [reopened]);
  assert.equal(difference(reopenStart).decodes, 1, "Reopened binaries decode once under their new Registry identity.");
  assert.deepEqual(uploadedRefs(reopenStart), new Set([reopened.pbr.normal.assetRef]));
  assert.doesNotMatch(JSON.stringify(state.GLOBAL_STATE.yarnLibrary), /"dataUrl"|"processedDataUrl"|blob:/,
    "Full Asset PBR remains binary metadata outside GLOBAL_STATE after rendering.");

  // Keep the real 150ms runner debounce pending so this catches its stale-draw window.
  const previewTimers = new Map();
  let nextPreviewTimer = 0;
  window.setTimeout = callback => {
    const timer = ++nextPreviewTimer; previewTimers.set(timer, callback); return timer;
  };
  window.clearTimeout = timer => previewTimers.delete(timer);
  let runnerRegistered = false;
  for (const change of ["chart", "texturePerformanceMode", "needleArrangement", "newPattern", "legacyPattern"]) {
    let completeRunnerMap;
    const runnerAsset = asset("runner-pending-" + change, ["normal"],
      () => new Promise(resolve => { completeRunnerMap = resolve; }));
    state.dispatch({ chart: Bimp.empty(4, 8, 0), yarnSequence: new Bimp(1, 8, Array(8).fill(0)),
      yarnPlies: [primaryPly], yarnLibrary: [runnerAsset], simScale: 1,
      singleJerseyCamProgram: { tracks: [["K"]], feeds: [feed(runnerAsset.id)] },
      needleArrangement: [1], texturePerformanceMode: "quality" });
    if (!runnerRegistered) {
      state.StateMonitor.register([runnerModule.runSimulation()]);
      runnerRegistered = true;
    } else {
      const callbacks = [...previewTimers.values()]; previewTimers.clear();
      callbacks.forEach(callback => callback());
    }
    for (let turn = 0; turn < 10 && !completeRunnerMap; turn++) await Promise.resolve();
    assert.equal(typeof completeRunnerMap, "function", `${change}: real runner must start its after-preview lazy read.`);
    if (change === "newPattern") importers.newPattern();
    else if (change === "legacyPattern") {
      const legacyProject = exporters.getProjectData();
      for (const key of ["yarnLibrary", "singleJerseyCamProgram", "needleArrangement", "needleArrangementInputs", "machineGauge"]) {
        delete legacyProject[key];
      }
      importers.loadJSON(legacyProject);
    } else {
      state.dispatch({ [change]: change === "chart" ? Bimp.empty(5, 8, 0)
        : change === "texturePerformanceMode" ? "solid" : [1, 1] });
    }
    assert.ok(previewTimers.size > 0, `${change}: replacement render remains in the real debounce window.`);
    const previousDraws = draws.length, previousStrokes = strokes.length, previousUploads = uploads.length;
    completeRunnerMap(new Blob([pixelBytes], { type: "image/png" }));
    await settlePreparation();
    assert.equal(draws.length, previousDraws, `${change}: pending old runner may not draw before its debounced replacement.`);
    assert.equal(strokes.length, previousStrokes);
    assert.equal(uploads.length, previousUploads, `${change}: old quality work may not upload after a state change.`);
  }
  runnerModule.stopSimulation();
  previewTimers.clear();

  yarnAssetRegistry.clear();
  console.log("PASS: first Feed Yarn PBR uses the existing UV renderer; 100 Assets stay lazy, selected 9/shared 6/full 20 and 30 maps decode once, zoom reuses GPU uploads, Solid/Auto/hidden/stopped work stays inactive, and Canvas/legacy/partial/failure/replacement/clear/reopen remain compatible.");
} finally {
  await server.close();
  delete globalThis.__feedYarnPbrPreparationJobs;
}
