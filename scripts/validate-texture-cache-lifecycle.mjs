import assert from "node:assert/strict";
import fs from "node:fs";

const brushSource = fs.readFileSync(
  "src/simulation/yarnTextureBrush.js",
  "utf8"
);

assert.match(brushSource, /const IMAGE_CACHE_LIMIT = 24;/);
assert.match(brushSource, /const TINTED_CACHE_LIMIT = 24;/);
assert.match(
  brushSource,
  /function rememberCacheRecord\(cache, key, record, limit\)/
);
assert.match(
  brushSource,
  /cache\.delete\(cache\.keys\(\)\.next\(\)\.value\)/,
  "oldest Canvas cache records must be evicted."
);
assert.match(
  brushSource,
  /rememberCacheRecord\(imageCache, dataUrl, record, IMAGE_CACHE_LIMIT\)/
);
assert.match(
  brushSource,
  /rememberCacheRecord\(tintedCache, key, record, TINTED_CACHE_LIMIT\)/
);

const { createServer } = await import("vite");
const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { YarnUvWebglRenderer, materialMaps, retainWebglYarnTextures } = await server.ssrLoadModule(
    "/src/simulation/yarnUvWebglRenderer.js"
  );
  const brush = await server.ssrLoadModule("/src/simulation/yarnTextureBrush.js");
  const deletedTextures = [];
  const renderer = Object.create(YarnUvWebglRenderer.prototype);
  renderer.gl = {
    deleteTexture(texture) {
      deletedTextures.push(texture);
    },
  };
  renderer.textureCache = new Map([
    ["oldest", { texture: "gpu-oldest" }],
    ["newest", { texture: "gpu-newest" }],
  ]);

  renderer.evictOldestTexture();
  assert.deepEqual(deletedTextures, ["gpu-oldest"]);
  assert.deepEqual([...renderer.textureCache.keys()], ["newest"]);

  assert.equal(typeof renderer.retainTextures, "function",
    "Renderer must release textures outside the complete active source set.");
  renderer.fallbackTexture = "gpu-fallback";
  const sharedKey = brush.getYarnTextureSourceKey({ assetRef: "shared-ref" });
  renderer.textureCache = new Map([
    [sharedKey, { texture: "gpu-shared" }],
    [brush.getYarnTextureSourceKey({ assetRef: "obsolete-ref" }), { texture: "gpu-obsolete" }],
    ["legacy-url", { texture: "gpu-legacy" }],
  ]);
  renderer.retainTextures([{ assetRef: "shared-ref" }, "legacy-url", { assetRef: "shared-ref" }]);
  assert.deepEqual([...renderer.textureCache.keys()], [sharedKey, "legacy-url"]);
  assert.deepEqual(deletedTextures, ["gpu-oldest", "gpu-obsolete"]);
  renderer.retainTextures([]);
  renderer.retainTextures([]);
  assert.deepEqual(deletedTextures, ["gpu-oldest", "gpu-obsolete", "gpu-shared", "gpu-legacy"]);
  assert.ok(!deletedTextures.includes(renderer.fallbackTexture));

  assert.equal(typeof materialMaps, "function", "Draw layers need the Renderer map sources.");
  const slots = ["baseColor", "normal", "roughness", "height", "ambientOcclusion", "metallic"];
  const pbr = Object.fromEntries(slots.map(slot => [slot, { assetRef: `${slot}-ref` }]));
  const sources = materialMaps({ texture: { pbr } });
  for (const slot of slots) assert.equal(sources[slot].assetRef, `${slot}-ref`);
  assert.deepEqual(materialMaps({ texture: { enabled: false, pbr, processedDataUrl: "scan-url" } }),
    Object.fromEntries(slots.map(slot => [slot, ""])), "Disabled textures must disable every PBR map.");
  assert.equal(materialMaps({ texture: { pbr: { baseColor: {
    dataUrl: "original-url", processedDataUrl: "processed-url",
  } } } }).baseColor, "processed-url", "Legacy processed images remain the preferred map source.");

  let imageLoads = 0, blobLoads = 0;
  const sampledCanvases = [];
  globalThis.Image = class {
    naturalWidth = 3;
    naturalHeight = 5;
    set src(value) { imageLoads++; this.source = value; queueMicrotask(() => this.onload()); }
  };
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, "canvas");
      const canvas = { width: 0, height: 0, getContext: () => ({ drawImage(...args) {
        sampledCanvases.push({ canvas, args });
      } }) };
      return canvas;
    },
  };
  const { yarnAssetRegistry } = await server.ssrLoadModule("/src/yarnTexture/yarnAssetRegistry.js");
  const ref = yarnAssetRegistry.register(() => {
    blobLoads++;
    return new Blob(["fixture"], { type: "image/png" });
  });
  const uploadedImages = [];
  let nextTexture = 0;
  renderer.gl = {
    createTexture: () => `texture-${++nextTexture}`,
    bindTexture() {}, texParameteri() {}, pixelStorei() {},
    texImage2D(...args) { uploadedImages.push(args.at(-1)); },
    deleteTexture(texture) { deletedTextures.push(texture); },
  };
  const source = { assetRef: ref };
  assert.equal(renderer.textureFromDataUrl(source), null);
  await Promise.resolve();
  assert.equal(blobLoads, 0, "Draw lookup must not start a registry read.");
  assert.equal(imageLoads, 0, "Draw lookup must not start image decoding.");
  await brush.prepareYarnTextureImages([{ texture: { pbr: { baseColor: source } } }]);
  const firstTexture = renderer.textureFromDataUrl(source);
  assert.ok(firstTexture);
  assert.equal(renderer.textureFromDataUrl({ assetRef: ref }), firstTexture,
    "Distinct source objects for the same Yarn must share the uploaded texture.");
  assert.equal(blobLoads, 1);
  assert.equal(imageLoads, 1);
  assert.equal(uploadedImages.length, 1);
  assert.equal(uploadedImages[0].width, 4, "NPOT widths must be resampled for WebGL1 repeating textures.");
  assert.equal(uploadedImages[0].height, 8);
  assert.equal(sampledCanvases.length, 1);
  assert.equal(sampledCanvases[0].args[0], brush.getReadyYarnTextureImage(source));
  assert.deepEqual(sampledCanvases[0].args.slice(1), [0, 0, 4, 8]);

  await brush.prepareYarnTextureImages([{ texture: { processedDataUrl: "legacy-pot-url" } }]);
  const legacyImage = brush.getReadyYarnTextureImage("legacy-pot-url");
  legacyImage.naturalWidth = 4;
  legacyImage.naturalHeight = 8;
  renderer.textureFromDataUrl("legacy-pot-url");
  assert.equal(uploadedImages[1], legacyImage, "Power-of-two legacy images should upload without resampling.");
  assert.equal(sampledCanvases.length, 1);
  renderer.retainTextures([source]);
  assert.equal(renderer.textureCache.size, 1);
  assert.equal(renderer.textureCache.get(brush.getYarnTextureSourceKey(source)).texture, firstTexture);
  renderer.retainTextures([]);
  assert.equal(renderer.textureCache.size, 0);
  yarnAssetRegistry.release(ref);

  const activeSources = Array.from({ length: 30 }, () => ({
    assetRef: yarnAssetRegistry.register(new Blob(["fixture"], { type: "image/png" })),
  }));
  renderer.retainTextures(activeSources);
  for (const activeSource of activeSources) {
    await brush.prepareYarnTextureImages([{ texture: { pbr: { baseColor: activeSource } } }]);
    assert.ok(renderer.textureFromDataUrl(activeSource));
  }
  assert.equal(renderer.textureCache.size, 30,
    "A complete active source set larger than the idle LRU limit must stay uploaded.");
  for (const activeSource of activeSources) {
    assert.ok(renderer.textureCache.has(brush.getYarnTextureSourceKey(activeSource)));
  }
  renderer.retainTextures([]);
  assert.equal(renderer.textureCache.size, 0, "Clearing the active materials still releases the complete working set.");
  for (const activeSource of activeSources) yarnAssetRegistry.release(activeSource.assetRef);

  assert.equal(typeof retainWebglYarnTextures, "function");
  let contextRequests = 0;
  retainWebglYarnTextures({ getContext() { contextRequests++; return null; } }, []);
  assert.equal(contextRequests, 0, "Retention must only inspect an existing renderer, without creating a context.");
} finally {
  await server.close();
}

const rendererSource = fs.readFileSync(
  "src/simulation/yarnUvWebglRenderer.js",
  "utf8"
);
assert.match(rendererSource, /const TEXTURE_CACHE_LIMIT = 24;/);
assert.match(
  rendererSource,
  /while \(this\.textureCache\.size > Math\.max\(TEXTURE_CACHE_LIMIT,/
);

console.log("PASS: yarn texture caches have bounded lifecycles.");
