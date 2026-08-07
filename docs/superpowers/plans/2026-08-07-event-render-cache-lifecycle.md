# Event-Driven Rendering and Texture Cache Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop idle root rendering and bound retained Canvas/WebGL yarn texture resources without changing rendered output or controls.

**Architecture:** A concrete `renderApp` component will render once at startup and coalesce later state-driven renders into one animation frame. Canvas and WebGL caches remain in their owning renderer modules and use fixed local limits with oldest-entry eviction; no shared cache framework or settings layer is introduced.

**Tech Stack:** Vanilla ES modules, lit-html 2.7, existing `StateMonitor`, WebGL 1, Node validation scripts, Vite 4.

---

### Task 1: Replace the Permanent Root Render Loop

**Files:**
- Create: `src/components/renderApp.js`
- Create: `scripts/validate-event-driven-render.mjs`
- Modify: `src/index.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing render lifecycle validation**

Create `scripts/validate-event-driven-render.mjs`:

```js
import assert from "node:assert/strict";
import fs from "node:fs";

const indexSource = fs.readFileSync("src/index.js", "utf8");
assert.doesNotMatch(
  indexSource,
  /requestAnimationFrame\(r\)/,
  "index.js must not keep a permanent render loop."
);
assert.match(
  indexSource,
  /createAppRenderer\(\{/,
  "index.js must create the state-driven application renderer."
);

const { createAppRenderer } = await import(
  "../src/components/renderApp.js"
);
const queuedFrames = [];
let renderCount = 0;
const renderer = createAppRenderer({
  renderView: () => {
    renderCount += 1;
  },
  requestFrame: (callback) => {
    queuedFrames.push(callback);
    return queuedFrames.length;
  },
});

renderer.renderInitial();
assert.equal(renderCount, 1, "startup must render synchronously once.");

renderer.syncState({}, ["chart"]);
renderer.syncState({}, ["yarnPalette"]);
assert.equal(queuedFrames.length, 1, "state bursts must share one frame.");
assert.equal(renderCount, 1, "queued rendering must not run synchronously.");

queuedFrames.shift()();
assert.equal(renderCount, 2, "the queued frame must render once.");

renderer.syncState({}, ["language"]);
assert.equal(queuedFrames.length, 1, "a later change must queue a new frame.");

console.log("PASS: root rendering is state-driven and frame-coalesced.");
```

- [ ] **Step 2: Run the validation and confirm the intended failure**

Run:

```powershell
node --experimental-default-type=module scripts/validate-event-driven-render.mjs
```

Expected: FAIL because `requestAnimationFrame(r)` still exists and `src/components/renderApp.js` does not exist.

- [ ] **Step 3: Implement the concrete application renderer**

Create `src/components/renderApp.js`:

```js
export function createAppRenderer({
  renderView,
  requestFrame = (callback) => window.requestAnimationFrame(callback),
}) {
  let framePending = false;

  function renderInitial() {
    renderView();
  }

  function renderQueuedFrame() {
    framePending = false;
    renderView();
  }

  function syncState() {
    if (framePending) return;
    framePending = true;
    requestFrame(renderQueuedFrame);
  }

  return { renderInitial, syncState };
}
```

Modify `src/index.js`:

```js
import { createAppRenderer } from "./components/renderApp";

const appRenderer = createAppRenderer({
  renderView: () => render(view(), document.body),
});

function init() {
  appRenderer.renderInitial();
}
```

Keep the existing `render` and `view` imports, delete only `function r()`, replace the `r()` call at the start of `init()` with `appRenderer.renderInitial()`, and insert `() => appRenderer` as the first factory in the existing `StateMonitor.register([...])` array. Do not reorder any other factory.

Add the package script:

```json
"validate:event-driven-render": "node --experimental-default-type=module scripts/validate-event-driven-render.mjs"
```

- [ ] **Step 4: Run focused and existing interaction validations**

Run:

```powershell
npm run validate:event-driven-render
npm run validate:sim-wheel-performance
npm run validate:central-stitch-toolbar
```

Expected: all three commands print `PASS` and exit 0.

- [ ] **Step 5: Commit the render lifecycle change**

```powershell
git add package.json scripts/validate-event-driven-render.mjs src/components/renderApp.js src/index.js
git commit -m "perf: render the application only after state changes"
```

### Task 2: Bound Canvas Yarn Texture Records

**Files:**
- Create: `scripts/validate-texture-cache-lifecycle.mjs`
- Modify: `src/simulation/yarnTextureBrush.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing Canvas cache validation**

Create `scripts/validate-texture-cache-lifecycle.mjs` with the Canvas assertions first:

```js
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
```

- [ ] **Step 2: Run the validation and confirm it fails**

Run:

```powershell
node --experimental-default-type=module scripts/validate-texture-cache-lifecycle.mjs
```

Expected: FAIL because the cache limits and eviction helper do not exist.

- [ ] **Step 3: Add local least-recently-used retention**

At the top of `src/simulation/yarnTextureBrush.js`, directly after the two maps, add:

```js
const IMAGE_CACHE_LIMIT = 24;
const TINTED_CACHE_LIMIT = 24;

function cachedRecord(cache, key) {
  const record = cache.get(key);
  if (!record) return null;
  cache.delete(key);
  cache.set(key, record);
  return record;
}

function rememberCacheRecord(cache, key, record, limit) {
  cache.set(key, record);
  while (cache.size > limit) {
    cache.delete(cache.keys().next().value);
  }
}
```

Replace the two cache-queue functions with:

```js
function queueImage(dataUrl) {
  if (!dataUrl) return null;

  const cached = cachedRecord(imageCache, dataUrl);
  if (cached) return cached;

  const record = { image: null, promise: null };
  record.promise = loadImageFromDataUrl(dataUrl)
    .then((image) => {
      record.image = image;
      return image;
    })
    .catch((error) => {
      imageCache.delete(dataUrl);
      throw error;
    });

  rememberCacheRecord(imageCache, dataUrl, record, IMAGE_CACHE_LIMIT);
  return record;
}
```

```js
function queueTintedBrush(texture, color) {
  if (!texture?.processedDataUrl) return null;

  const key = `${texture.processedDataUrl}|${color}|${texture.textureStrength}`;
  const cached = cachedRecord(tintedCache, key);
  if (cached) return cached;

  const record = { canvas: null, promise: null };
  record.promise = createTintedTextureCanvas(
    texture.processedDataUrl,
    color,
    texture.textureStrength
  )
    .then((canvas) => {
      record.canvas = canvas;
      return canvas;
    })
    .catch((error) => {
      tintedCache.delete(key);
      throw error;
    });

  rememberCacheRecord(tintedCache, key, record, TINTED_CACHE_LIMIT);
  return record;
}
```

- [ ] **Step 4: Expose the validation script and run it**

Add to `package.json`:

```json
"validate:texture-cache-lifecycle": "node --experimental-default-type=module scripts/validate-texture-cache-lifecycle.mjs"
```

Run:

```powershell
npm run validate:texture-cache-lifecycle
npm run validate:path-uv-yarn-texture
```

Expected: both commands print `PASS` and exit 0.

- [ ] **Step 5: Commit the Canvas cache change**

```powershell
git add package.json scripts/validate-texture-cache-lifecycle.mjs src/simulation/yarnTextureBrush.js
git commit -m "perf: bound canvas yarn texture caches"
```

### Task 3: Release Evicted WebGL Textures

**Files:**
- Modify: `scripts/validate-texture-cache-lifecycle.mjs`
- Modify: `src/simulation/yarnUvWebglRenderer.js`

- [ ] **Step 1: Extend the validation with functional GPU eviction coverage**

Append before the final `console.log` in `scripts/validate-texture-cache-lifecycle.mjs`:

```js
const { createServer } = await import("vite");
const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
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
await server.close();

const rendererSource = fs.readFileSync(
  "src/simulation/yarnUvWebglRenderer.js",
  "utf8"
);
assert.match(rendererSource, /const TEXTURE_CACHE_LIMIT = 24;/);
assert.match(rendererSource, /while \(this\.textureCache\.size > TEXTURE_CACHE_LIMIT\)/);
```

- [ ] **Step 2: Run the validation and confirm it fails**

Run:

```powershell
npm run validate:texture-cache-lifecycle
```

Expected: FAIL with `renderer.evictOldestTexture is not a function`.

- [ ] **Step 3: Add WebGL cache recency and disposal**

In `src/simulation/yarnUvWebglRenderer.js`, add the module-local limit near `rendererCache`:

```js
const TEXTURE_CACHE_LIMIT = 24;
```

Add this method to `YarnUvWebglRenderer` before `textureFromDataUrl`:

```js
evictOldestTexture() {
  const oldestKey = this.textureCache.keys().next().value;
  if (oldestKey === undefined) return;
  const record = this.textureCache.get(oldestKey);
  this.gl.deleteTexture(record.texture);
  this.textureCache.delete(oldestKey);
}
```

Update the cache hit and insertion in `textureFromDataUrl`:

```js
const cached = this.textureCache.get(dataUrl);
if (cached) {
  this.textureCache.delete(dataUrl);
  this.textureCache.set(dataUrl, cached);
  return cached.texture;
}

// Keep existing image upload code unchanged.
this.textureCache.set(dataUrl, { texture });
while (this.textureCache.size > TEXTURE_CACHE_LIMIT) {
  this.evictOldestTexture();
}
return texture;
```

- [ ] **Step 4: Run cache and renderer validations**

Run:

```powershell
npm run validate:texture-cache-lifecycle
npm run validate:path-uv-yarn-texture
```

Expected: both commands print `PASS` and exit 0.

- [ ] **Step 5: Commit the WebGL lifecycle change**

```powershell
git add scripts/validate-texture-cache-lifecycle.mjs src/simulation/yarnUvWebglRenderer.js
git commit -m "perf: release evicted webgl yarn textures"
```

### Task 4: Verify the Runtime Performance Sub-Project

**Files:**
- No source changes expected.

- [ ] **Step 1: Run every repository validation script**

Run:

```powershell
$package = Get-Content package.json | ConvertFrom-Json
$package.scripts.PSObject.Properties |
  Where-Object Name -Like 'validate:*' |
  ForEach-Object {
    npm run $_.Name
    if ($LASTEXITCODE -ne 0) { throw "Validation failed: $($_.Name)" }
  }
```

Expected: every `validate:*` script exits 0.

- [ ] **Step 2: Run the production build**

Run:

```powershell
npm run build
```

Expected: Vite completes successfully and emits `dist` without build errors.

- [ ] **Step 3: Confirm the working diff is scoped**

Run:

```powershell
git status --short
git diff --check
```

Expected: no whitespace errors; only planned files or pre-existing user changes are listed.
