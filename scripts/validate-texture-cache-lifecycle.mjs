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
  const { YarnUvWebglRenderer } = await server.ssrLoadModule(
    "/src/simulation/yarnUvWebglRenderer.js"
  );
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
  /while \(this\.textureCache\.size > TEXTURE_CACHE_LIMIT\)/
);

console.log("PASS: yarn texture caches have bounded lifecycles.");
