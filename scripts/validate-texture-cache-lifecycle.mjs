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

console.log("PASS: yarn texture caches have bounded lifecycles.");
