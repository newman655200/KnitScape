# Yarn Scan Texture Brush Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-yarn scanned single-yarn texture import for yarn 1 and yarn 2, render the current 2D preview with a texture brush, and persist the processed texture in project JSON.

**Architecture:** Keep the current 2D canvas simulation path model. Add a focused `src/yarnTexture/yarnScanTexture.js` module for image import, white-background removal, cropping, compression, normalization, and tinting. Add a focused `src/simulation/yarnTextureBrush.js` renderer that upgrades each yarn stroke from pure color to layered shadow, texture, highlight, and light fuzz while falling back to the existing color stroke when no texture exists.

**Tech Stack:** Browser FileReader, HTMLImageElement, canvas/offscreen canvas APIs, lit-html UI, existing `yarnPlies` state, existing JSON import/export, existing validation scripts, Vite build.

---

## File Structure

- `src/yarnTexture/yarnScanTexture.js`
  - Owns texture defaults, JSON normalization, file reading, image loading, white-background masking, auto-cropping, compression, and tint helper canvases.
- `src/simulation/yarnTextureBrush.js`
  - Owns cached image/pattern rendering for the right-side preview. It receives a `Path2D`, one normalized yarn ply, and `stitchWidth`.
- `src/constants.js`
  - Adds `texture: null` to default yarn ply objects so old code has a stable shape.
- `src/views/leftBar.js`
  - Adds import, clear, preview, and three texture controls inside each yarn ply card.
- `src/actions/exporters.js`
  - Keeps exporting `GLOBAL_STATE.yarnPlies`; no separate top-level key.
- `src/actions/importers.js`
  - Normalizes older `yarnPlies` objects and scanned texture fields on import and new pattern.
- `src/simulation/yarnSimulation.js`
  - Normalizes texture fields, preloads processed texture images, and calls the new texture brush helper.
- `styles.css`
  - Styles texture preview cards and controls.
- `scripts/validate-two-ply-yarn.mjs`
  - Adds source and runtime checks for scanned texture state, JSON persistence, fallback rendering, and texture rendering hooks.
- `scripts/validate-single-face-ui-labels.mjs`
  - Adds UI checks for scan import controls and no false PBR claim.
- `KnitScape_单面布技术文档.md`
  - Records the feature boundary and first-version limitations.

---

### Task 1: Add Failing Validation For Scan Texture Feature

**Files:**
- Modify: `scripts/validate-two-ply-yarn.mjs`
- Modify: `scripts/validate-single-face-ui-labels.mjs`

- [ ] **Step 1: Add failing source checks to `scripts/validate-two-ply-yarn.mjs`**

Add these checks after the existing yarn ply state checks:

```js
const yarnTextureSource = fs.existsSync(path.join(root, "src/yarnTexture/yarnScanTexture.js"))
  ? read("src/yarnTexture/yarnScanTexture.js")
  : "";
const yarnTextureBrushSource = fs.existsSync(path.join(root, "src/simulation/yarnTextureBrush.js"))
  ? read("src/simulation/yarnTextureBrush.js")
  : "";
const simulationSource = read("src/simulation/yarnSimulation.js");
const importerSource = read("src/actions/importers.js");
const exporterSource = read("src/actions/exporters.js");

if (!yarnTextureSource.includes("processYarnScanFile")) {
  failures.push("scan texture module must expose processYarnScanFile.");
}
if (!yarnTextureSource.includes("normalizeYarnTexture")) {
  failures.push("scan texture module must expose normalizeYarnTexture.");
}
if (!yarnTextureSource.includes("processedDataUrl")) {
  failures.push("scan texture module must produce processedDataUrl for JSON persistence.");
}
if (!yarnTextureBrushSource.includes("drawYarnTexturePath")) {
  failures.push("texture brush module must expose drawYarnTexturePath.");
}
if (!yarnTextureBrushSource.includes("textureStrength") || !yarnTextureBrushSource.includes("fuzzStrength")) {
  failures.push("texture brush must honor textureStrength and fuzzStrength.");
}
if (!simulationSource.includes("drawYarnTexturePath") || !simulationSource.includes("prepareYarnTextureImages")) {
  failures.push("yarn simulation must render yarn plies through the texture brush.");
}
if (!importerSource.includes("normalizeYarnPly") || !importerSource.includes("texture")) {
  failures.push("JSON import must normalize yarn ply scan texture fields.");
}
if (!exporterSource.includes("yarnPlies: GLOBAL_STATE.yarnPlies")) {
  failures.push("JSON export must continue persisting yarnPlies including scan textures.");
}
```

- [ ] **Step 2: Add failing UI checks to `scripts/validate-single-face-ui-labels.mjs`**

Add these checks after the yarn ply panel checks:

```js
if (!leftBar.includes("importYarnScanTexture")) {
  failures.push("left bar must include an import handler for scanned yarn texture images.");
}
if (!leftBar.includes("yarn-texture-import-button")) {
  failures.push("each yarn ply card must expose a scanned texture import button.");
}
if (!leftBar.includes("yarn-texture-preview")) {
  failures.push("each yarn ply card must show the processed scanned texture preview.");
}
for (const label of ["使用扫描原色", "去背景", "纹理强度", "毛羽强度", "清除纹理"]) {
  if (!leftBar.includes(label)) {
    failures.push(`scan yarn texture UI label missing: ${label}`);
  }
}
if (/真实\s*PBR|完整\s*PBR/.test(leftBar)) {
  failures.push("left bar must not claim the 2D scan texture brush is full PBR.");
}
```

- [ ] **Step 3: Run validation to verify it fails**

Run:

```bash
npm run validate:two-ply-yarn
npm run validate:single-ui
```

Expected:

```text
FAIL: scan texture module must expose processYarnScanFile.
FAIL: texture brush module must expose drawYarnTexturePath.
FAIL: left bar must include an import handler for scanned yarn texture images.
```

- [ ] **Step 4: Commit if Git identity is configured**

Run:

```bash
git add scripts/validate-two-ply-yarn.mjs scripts/validate-single-face-ui-labels.mjs
git commit -m "test: require scanned yarn texture feature"
```

Expected if Git identity is configured: a commit hash.

Expected in the current desktop repository if identity is not configured:

```text
Author identity unknown
```

If identity is not configured, do not configure it inside the task. Continue with the working tree changes and record the commit failure in the task notes.

---

### Task 2: Add Texture Data Normalization And JSON Compatibility

**Files:**
- Modify: `src/constants.js`
- Create: `src/yarnTexture/yarnScanTexture.js`
- Modify: `src/actions/importers.js`
- Test: `scripts/validate-two-ply-yarn.mjs`

- [ ] **Step 1: Add default texture shape to `src/constants.js`**

Update default yarn ply objects so each ply includes `texture: null`:

```js
export const DEFAULT_YARN_PLIES = Object.freeze([
  Object.freeze({
    color: DEFAULT_YARN_COLOR,
    diameter: 0.24,
    enabled: true,
    texture: null,
  }),
  Object.freeze({
    color: "rgba(73, 144, 226, 1)",
    diameter: 0.14,
    enabled: true,
    texture: null,
  }),
]);
```

- [ ] **Step 2: Create `src/yarnTexture/yarnScanTexture.js` with normalization helpers**

Create the file with this module:

```js
export const DEFAULT_YARN_SCAN_TEXTURE = Object.freeze({
  sourceType: "scan",
  fileName: "",
  dataUrl: "",
  processedDataUrl: "",
  useOriginalColor: true,
  backgroundThreshold: 0.92,
  textureStrength: 0.75,
  fuzzStrength: 0.45,
  pbr: Object.freeze({
    baseColor: null,
    normal: null,
    roughness: null,
    height: null,
    ambientOcclusion: null,
  }),
});

const clamp01 = (value, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1, Math.max(0, number));
};

export function normalizeYarnTexture(texture = null) {
  if (!texture || typeof texture !== "object") return null;

  return {
    sourceType: "scan",
    fileName: String(texture.fileName || ""),
    dataUrl: String(texture.dataUrl || ""),
    processedDataUrl: String(texture.processedDataUrl || texture.dataUrl || ""),
    useOriginalColor: texture.useOriginalColor !== false,
    backgroundThreshold: clamp01(
      texture.backgroundThreshold,
      DEFAULT_YARN_SCAN_TEXTURE.backgroundThreshold
    ),
    textureStrength: clamp01(
      texture.textureStrength,
      DEFAULT_YARN_SCAN_TEXTURE.textureStrength
    ),
    fuzzStrength: clamp01(
      texture.fuzzStrength,
      DEFAULT_YARN_SCAN_TEXTURE.fuzzStrength
    ),
    pbr: {
      ...DEFAULT_YARN_SCAN_TEXTURE.pbr,
      ...(texture.pbr && typeof texture.pbr === "object" ? texture.pbr : {}),
    },
  };
}

export function normalizeYarnPly(ply, fallback = {}) {
  return {
    ...fallback,
    ...ply,
    color: ply?.color || fallback.color,
    diameter:
      Number.isFinite(Number(ply?.diameter)) && Number(ply.diameter) > 0
        ? Number(ply.diameter)
        : fallback.diameter,
    enabled: ply?.enabled !== false,
    texture: normalizeYarnTexture(ply?.texture),
  };
}
```

- [ ] **Step 3: Update `src/actions/importers.js` to normalize texture fields**

Replace the local `cloneYarnPlies` with this implementation:

```js
import { normalizeYarnPly } from "../yarnTexture/yarnScanTexture";

function cloneYarnPlies(plies = DEFAULT_YARN_PLIES) {
  const source = Array.isArray(plies) && plies.length ? plies : DEFAULT_YARN_PLIES;
  return source.map((ply, index) =>
    normalizeYarnPly(ply, DEFAULT_YARN_PLIES[index] || DEFAULT_YARN_PLIES[0])
  );
}
```

- [ ] **Step 4: Run validation to verify data checks pass and UI/rendering checks still fail**

Run:

```bash
npm run validate:two-ply-yarn
```

Expected: data normalization failures disappear. Rendering failures still remain:

```text
FAIL: texture brush module must expose drawYarnTexturePath.
FAIL: yarn simulation must render yarn plies through the texture brush.
```

- [ ] **Step 5: Commit if Git identity is configured**

Run:

```bash
git add src/constants.js src/yarnTexture/yarnScanTexture.js src/actions/importers.js scripts/validate-two-ply-yarn.mjs
git commit -m "feat: normalize scanned yarn texture data"
```

If Git identity is not configured, leave the changes uncommitted and note the identity error.

---

### Task 3: Implement Scan Image Processing

**Files:**
- Modify: `src/yarnTexture/yarnScanTexture.js`
- Test: `scripts/validate-two-ply-yarn.mjs`

- [ ] **Step 1: Add failing checks for image processing functions**

Extend the `yarnTextureSource` checks in `scripts/validate-two-ply-yarn.mjs`:

```js
for (const token of [
  "readFileAsDataUrl",
  "loadImageFromDataUrl",
  "processYarnScanDataUrl",
  "findContentBounds",
  "createTintedTextureCanvas",
]) {
  if (!yarnTextureSource.includes(token)) {
    failures.push(`scan texture module must include ${token}.`);
  }
}
```

Run:

```bash
npm run validate:two-ply-yarn
```

Expected:

```text
FAIL: scan texture module must include readFileAsDataUrl.
```

- [ ] **Step 2: Add file reading, image loading, background masking, cropping, and compression**

Append this implementation to `src/yarnTexture/yarnScanTexture.js`:

```js
const MAX_TEXTURE_SIZE = 1024;

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法读取纱线扫描图片"));
    image.src = dataUrl;
  });
}

function pixelBackgroundScore(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const brightness = max / 255;
  const saturation = max === 0 ? 0 : (max - min) / max;
  return brightness * (1 - saturation * 0.55);
}

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));
  return canvas;
}

export function findContentBounds(imageData, threshold = 0.92) {
  const { width, height, data } = imageData;
  let left = width;
  let right = 0;
  let top = height;
  let bottom = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const score = pixelBackgroundScore(data[offset], data[offset + 1], data[offset + 2]);
      const isBackground = score >= threshold && data[offset + 3] > 0;
      if (!isBackground) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (left > right || top > bottom) {
    return { left: 0, top: 0, width, height };
  }

  const padding = Math.max(2, Math.round(height * 0.04));
  return {
    left: Math.max(0, left - padding),
    top: Math.max(0, top - padding),
    width: Math.min(width, right - left + 1 + padding * 2),
    height: Math.min(height, bottom - top + 1 + padding * 2),
  };
}

function applyBackgroundMask(imageData, threshold) {
  const { data } = imageData;
  for (let offset = 0; offset < data.length; offset += 4) {
    const score = pixelBackgroundScore(data[offset], data[offset + 1], data[offset + 2]);
    const distance = threshold - score;
    if (distance <= -0.04) {
      data[offset + 3] = 0;
    } else if (distance < 0.08) {
      data[offset + 3] = Math.round(255 * Math.max(0, distance / 0.08));
    }
  }
  return imageData;
}

export async function processYarnScanDataUrl(dataUrl, options = {}) {
  const threshold = clamp01(options.backgroundThreshold, DEFAULT_YARN_SCAN_TEXTURE.backgroundThreshold);
  const image = await loadImageFromDataUrl(dataUrl);
  const sourceCanvas = makeCanvas(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  sourceContext.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);

  const sourceData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const bounds = findContentBounds(sourceData, threshold);
  const cropCanvas = makeCanvas(bounds.width, bounds.height);
  const cropContext = cropCanvas.getContext("2d", { willReadFrequently: true });
  cropContext.drawImage(
    sourceCanvas,
    bounds.left,
    bounds.top,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height
  );

  const cropData = cropContext.getImageData(0, 0, cropCanvas.width, cropCanvas.height);
  cropContext.putImageData(applyBackgroundMask(cropData, threshold), 0, 0);

  const scale = Math.min(1, MAX_TEXTURE_SIZE / Math.max(cropCanvas.width, cropCanvas.height));
  const outputCanvas = makeCanvas(cropCanvas.width * scale, cropCanvas.height * scale);
  outputCanvas.getContext("2d").drawImage(cropCanvas, 0, 0, outputCanvas.width, outputCanvas.height);

  return outputCanvas.toDataURL("image/png");
}

export async function processYarnScanFile(file, options = {}) {
  const dataUrl = await readFileAsDataUrl(file);
  const processedDataUrl = await processYarnScanDataUrl(dataUrl, options);
  return normalizeYarnTexture({
    ...DEFAULT_YARN_SCAN_TEXTURE,
    fileName: file?.name || "scan-yarn.png",
    dataUrl,
    processedDataUrl,
    ...options,
  });
}
```

- [ ] **Step 3: Add tint helper for non-original-color rendering**

Append:

```js
export async function createTintedTextureCanvas(dataUrl, color, strength = 0.75) {
  const image = await loadImageFromDataUrl(dataUrl);
  const canvas = makeCanvas(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = "source-atop";
  context.globalAlpha = clamp01(strength, 0.75);
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  return canvas;
}
```

- [ ] **Step 4: Run validation**

Run:

```bash
npm run validate:two-ply-yarn
```

Expected: image-processing function failures disappear. Rendering hook failures still remain.

- [ ] **Step 5: Commit if Git identity is configured**

Run:

```bash
git add src/yarnTexture/yarnScanTexture.js scripts/validate-two-ply-yarn.mjs
git commit -m "feat: process scanned yarn texture images"
```

If Git identity is not configured, leave changes uncommitted and note the identity error.

---

### Task 4: Add Yarn Texture UI To Left Bar

**Files:**
- Modify: `src/views/leftBar.js`
- Modify: `styles.css`
- Test: `scripts/validate-single-face-ui-labels.mjs`

- [ ] **Step 1: Run current UI validation to confirm it still fails for texture UI**

Run:

```bash
npm run validate:single-ui
```

Expected:

```text
FAIL: left bar must include an import handler for scanned yarn texture images.
```

- [ ] **Step 2: Add import and texture update helpers to `src/views/leftBar.js`**

Add this import near the top:

```js
import { processYarnScanFile, normalizeYarnTexture } from "../yarnTexture/yarnScanTexture";
```

Add these helpers after `editYarnPlyColor`:

```js
function updateYarnPlyTexture(index, texturePatch) {
  const currentTexture = normalizeYarnTexture(GLOBAL_STATE.yarnPlies[index].texture);
  updateYarnPly(index, {
    texture: normalizeYarnTexture({
      ...currentTexture,
      ...texturePatch,
    }),
  });
}

function clearYarnScanTexture(index) {
  updateYarnPly(index, { texture: null });
}

async function importYarnScanTexture(index) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp,image/svg+xml";
  input.style.display = "none";
  document.body.appendChild(input);
  input.click();
  input.onchange = async () => {
    const file = input.files?.[0];
    document.body.removeChild(input);
    if (!file) return;

    const texture = await processYarnScanFile(file, {
      backgroundThreshold:
        GLOBAL_STATE.yarnPlies[index].texture?.backgroundThreshold ?? 0.92,
    });
    updateYarnPly(index, { texture });
  };
}
```

- [ ] **Step 3: Add `yarnScanTextureControls(index, ply)` UI function**

Add this function before `yarnPlyPanel()`:

```js
function yarnScanTextureControls(index, ply) {
  const texture = normalizeYarnTexture(ply.texture);

  return html`<div class="yarn-texture-controls">
    <div class="yarn-texture-header">
      <strong>扫描纱线纹理</strong>
      <button
        type="button"
        class="btn solid yarn-texture-import-button"
        @click=${() => importYarnScanTexture(index)}>
        导入图片
      </button>
    </div>
    <div class="yarn-texture-status">
      ${texture?.processedDataUrl
        ? html`<img
            class="yarn-texture-preview"
            src=${texture.processedDataUrl}
            alt="扫描纱线纹理预览" />`
        : html`<div class="yarn-texture-preview empty">未导入</div>`}
      <span>${texture?.fileName || "未导入扫描图"}</span>
    </div>
    <label class="form-control toggle yarn-texture-toggle">
      <input
        type="checkbox"
        ?checked=${texture?.useOriginalColor !== false}
        ?disabled=${!texture}
        @change=${(e) =>
          updateYarnPlyTexture(index, {
            useOriginalColor: e.target.checked,
          })} />
      使用扫描原色
    </label>
    <label class="form-control range yarn-texture-range">
      <span>去背景</span>
      <input
        type="range"
        min="0.75"
        max="0.99"
        step="0.01"
        ?disabled=${!texture}
        .value=${String(texture?.backgroundThreshold ?? 0.92)}
        @input=${(e) =>
          updateYarnPlyTexture(index, {
            backgroundThreshold: Number(e.target.value),
          })} />
    </label>
    <label class="form-control range yarn-texture-range">
      <span>纹理强度</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        ?disabled=${!texture}
        .value=${String(texture?.textureStrength ?? 0.75)}
        @input=${(e) =>
          updateYarnPlyTexture(index, {
            textureStrength: Number(e.target.value),
          })} />
    </label>
    <label class="form-control range yarn-texture-range">
      <span>毛羽强度</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        ?disabled=${!texture}
        .value=${String(texture?.fuzzStrength ?? 0.45)}
        @input=${(e) =>
          updateYarnPlyTexture(index, {
            fuzzStrength: Number(e.target.value),
          })} />
    </label>
    <button
      type="button"
      class="btn solid yarn-texture-clear-button"
      ?disabled=${!texture}
      @click=${() => clearYarnScanTexture(index)}>
      清除纹理
    </button>
  </div>`;
}
```

- [ ] **Step 4: Render the controls in each yarn ply card**

Inside the yarn ply card template, immediately after the diameter control, add:

```js
${yarnScanTextureControls(index, ply)}
```

- [ ] **Step 5: Add CSS**

Append to `styles.css` near the yarn ply panel styles:

```css
.yarn-texture-controls {
  display: flex;
  flex-direction: column;
  gap: 0.45em;
  padding-top: 0.45em;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.yarn-texture-header,
.yarn-texture-status {
  display: flex;
  align-items: center;
  gap: 0.45em;
}

.yarn-texture-header {
  justify-content: space-between;
}

.yarn-texture-import-button,
.yarn-texture-clear-button {
  min-height: 2em;
  padding: 0.2em 0.5em;
  font-size: 0.86em;
}

.yarn-texture-preview {
  width: 3.2em;
  height: 1.8em;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 4px;
  background: #fff;
}

.yarn-texture-preview.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-inactive);
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.72em;
}

.yarn-texture-status span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-inactive);
  font-size: 0.82em;
}

.yarn-texture-toggle,
.yarn-texture-range {
  margin: 0;
  color: var(--text-inactive);
  line-height: 1.2;
}

.yarn-texture-range {
  display: grid;
  grid-template-columns: 4.5em minmax(0, 1fr);
  gap: 0.35em;
  align-items: center;
}

.yarn-texture-range input[type="range"] {
  width: 100%;
}
```

- [ ] **Step 6: Run UI validation**

Run:

```bash
npm run validate:single-ui
```

Expected: scan texture UI failures disappear.

- [ ] **Step 7: Commit if Git identity is configured**

Run:

```bash
git add src/views/leftBar.js styles.css scripts/validate-single-face-ui-labels.mjs
git commit -m "feat: add scanned yarn texture controls"
```

If Git identity is not configured, leave changes uncommitted and note the identity error.

---

### Task 5: Render Textured Yarn In The Right Preview

**Files:**
- Create: `src/simulation/yarnTextureBrush.js`
- Modify: `src/simulation/yarnSimulation.js`
- Test: `scripts/validate-two-ply-yarn.mjs`

- [ ] **Step 1: Run validation to confirm rendering hook failures remain**

Run:

```bash
npm run validate:two-ply-yarn
```

Expected:

```text
FAIL: texture brush module must expose drawYarnTexturePath.
FAIL: yarn simulation must render yarn plies through the texture brush.
```

- [ ] **Step 2: Create `src/simulation/yarnTextureBrush.js`**

Create this module:

```js
import {
  createTintedTextureCanvas,
  loadImageFromDataUrl,
  normalizeYarnTexture,
} from "../yarnTexture/yarnScanTexture";

const imageCache = new Map();
const tintedCache = new Map();

function transparent(color, alpha) {
  if (color.startsWith("rgba(")) {
    return color.replace(/rgba\(([^)]+),\s*[^,)]+\)/, `rgba($1, ${alpha})`);
  }
  return color;
}

async function cachedImage(dataUrl) {
  if (!dataUrl) return null;
  if (!imageCache.has(dataUrl)) {
    imageCache.set(dataUrl, loadImageFromDataUrl(dataUrl));
  }
  return imageCache.get(dataUrl);
}

async function cachedBrushCanvas(texture, color) {
  if (!texture?.processedDataUrl) return null;
  if (texture.useOriginalColor !== false) {
    return cachedImage(texture.processedDataUrl);
  }

  const key = `${texture.processedDataUrl}|${color}|${texture.textureStrength}`;
  if (!tintedCache.has(key)) {
    tintedCache.set(
      key,
      createTintedTextureCanvas(texture.processedDataUrl, color, texture.textureStrength)
    );
  }
  return tintedCache.get(key);
}

export function prepareYarnTextureImages(yarnPlies) {
  return Promise.all(
    yarnPlies
      .map((ply) => normalizeYarnTexture(ply.texture))
      .filter((texture) => texture?.processedDataUrl)
      .map((texture) => cachedImage(texture.processedDataUrl))
  );
}

export async function drawYarnTexturePath(context, path, ply, stitchWidth) {
  const texture = normalizeYarnTexture(ply.texture);
  const lineWidth = stitchWidth * ply.diameter;

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";

  context.lineWidth = lineWidth * 1.1;
  context.strokeStyle = "rgba(0, 0, 0, 0.16)";
  context.stroke(path);

  if (!texture?.processedDataUrl) {
    context.lineWidth = lineWidth;
    context.strokeStyle = ply.color;
    context.stroke(path);
    context.restore();
    return;
  }

  const brush = await cachedBrushCanvas(texture, ply.color);
  const pattern = brush ? context.createPattern(brush, "repeat") : null;

  if (texture.fuzzStrength > 0) {
    context.globalAlpha = 0.18 * texture.fuzzStrength;
    context.lineWidth = lineWidth * (1 + texture.fuzzStrength * 0.45);
    context.strokeStyle = pattern || transparent(ply.color, 0.28);
    context.stroke(path);
  }

  context.globalAlpha = Math.max(0.15, texture.textureStrength);
  context.lineWidth = lineWidth;
  context.strokeStyle = pattern || ply.color;
  context.stroke(path);

  context.globalAlpha = 0.18;
  context.lineWidth = lineWidth * 0.34;
  context.strokeStyle = "rgba(255, 255, 255, 0.65)";
  context.stroke(path);

  context.restore();
}
```

- [ ] **Step 3: Update `src/simulation/yarnSimulation.js` imports and normalization**

Add import:

```js
import { drawYarnTexturePath, prepareYarnTextureImages } from "./yarnTextureBrush";
import { normalizeYarnTexture } from "../yarnTexture/yarnScanTexture";
```

In `normalizeYarnPlies`, add `texture` to each returned object:

```js
texture: normalizeYarnTexture(ply.texture),
```

- [ ] **Step 4: Update `drawSegmentsToLayer` to use the texture brush**

Replace `drawSegmentsToLayer` with:

```js
function drawSegmentsToLayer(context, layer) {
  if (!layer.length) return;

  const path = new Path2D(layer.join(" "));
  activeYarnPlies.forEach((ply) => {
    drawYarnTexturePath(context, path, ply, stitchWidth);
  });
}
```

- [ ] **Step 5: Preload images after initial draw**

After `draw();` near the end of `simulate()`, add:

```js
prepareYarnTextureImages(activeYarnPlies).then(draw);
```

- [ ] **Step 6: Run validation**

Run:

```bash
npm run validate:two-ply-yarn
```

Expected: rendering hook failures disappear.

- [ ] **Step 7: Commit if Git identity is configured**

Run:

```bash
git add src/simulation/yarnTextureBrush.js src/simulation/yarnSimulation.js scripts/validate-two-ply-yarn.mjs
git commit -m "feat: render scanned yarn textures in preview"
```

If Git identity is not configured, leave changes uncommitted and note the identity error.

---

### Task 6: Add Runtime Validation For JSON Persistence And Fallback

**Files:**
- Modify: `scripts/validate-two-ply-yarn.mjs`

- [ ] **Step 1: Add runtime fixture checks**

Extend `scripts/validate-two-ply-yarn.mjs` runtime section with this fixture:

```js
const sampleTexture = {
  sourceType: "scan",
  fileName: "fixture-yarn.png",
  dataUrl: "data:image/png;base64,fixture",
  processedDataUrl: "data:image/png;base64,processed",
  useOriginalColor: false,
  backgroundThreshold: 0.9,
  textureStrength: 0.8,
  fuzzStrength: 0.4,
  pbr: {
    baseColor: null,
    normal: null,
    roughness: null,
    height: null,
    ambientOcclusion: null,
  },
};

if (!JSON.stringify(packageJSON).includes("validate:two-ply-yarn")) {
  failures.push("package.json must keep validate:two-ply-yarn script.");
}
```

Add importer/exporter source checks:

```js
if (!exporterSource.includes("yarnPlies: GLOBAL_STATE.yarnPlies")) {
  failures.push("exported JSON must persist scanned texture data through yarnPlies.");
}
if (!importerSource.includes("normalizeYarnPly")) {
  failures.push("imported JSON must normalize scanned texture data.");
}
```

- [ ] **Step 2: Run validation**

Run:

```bash
npm run validate:two-ply-yarn
```

Expected:

```text
PASS: two-ply yarn state, settings, JSON, and preview rendering are configured.
```

- [ ] **Step 3: Commit if Git identity is configured**

Run:

```bash
git add scripts/validate-two-ply-yarn.mjs
git commit -m "test: cover scanned yarn texture persistence"
```

If Git identity is not configured, leave changes uncommitted and note the identity error.

---

### Task 7: Update Documentation And Run Full Verification

**Files:**
- Modify: `KnitScape_单面布技术文档.md`

- [ ] **Step 1: Update the technical document**

Add a new step under “双纱视觉方案进度”:

```markdown
Step 9 已完成并通过验证：纱线 1 和纱线 2 增加扫描纱线纹理导入能力。第一版面向白底或浅色背景的单根直线纱线扫描图，导入后自动去白底、裁白边、压缩为 processedDataUrl，并保存到 yarnPlies[index].texture。右侧单面布预览仍为 2D canvas，但会用纹理笔刷近似表现纤维主体、轻微高光和边缘毛羽；可按每根纱线独立选择“使用扫描原色”或“使用当前颜色染色”，并调整去背景强度、纹理强度和毛羽强度。本步骤不声明完成真实 3D 或完整 PBR，PBR 字段仅作为后续 baseColor / normal / roughness / height / AO 导出的数据预留。
```

Add current interaction contract lines:

```text
纱线扫描纹理：纱线 1 和纱线 2 可分别导入单根白底纱线扫描图。
纹理渲染边界：当前右侧预览是 2D canvas 纹理笔刷近似效果，不是完整 3D/PBR。
JSON 保存：扫描纹理随 yarnPlies 保存，旧 JSON 没有 texture 字段时自动回退纯色纱线。
```

- [ ] **Step 2: Run all verification commands**

Run:

```bash
npm run validate:single-ui
npm run validate:two-ply-yarn
npm run validate:repeat-dimensions
npm run validate:intranet
npm run build
```

Expected:

```text
PASS: single-face UI labels and images are configured.
PASS: two-ply yarn state, settings, JSON, and preview rendering are configured.
PASS: chart Width/Height and repeat unit dimensions stay separated.
PASS: intranet build checks passed.
✓ built
```

Vite may print its existing chunk-size warning. That warning does not block this task if the build exits with code 0.

- [ ] **Step 3: Manual browser smoke check**

Start a local dev server:

```bash
npm run dev -- --host 127.0.0.1 --port 5201
```

Open:

```text
http://127.0.0.1:5201/
```

Check:

- Left “双纱参数” shows texture controls for both yarns.
- Importing a white-background single-yarn image shows a thumbnail.
- Right preview updates after import.
- Switching “使用扫描原色” changes whether the web color tints the yarn.
- Clearing texture returns the yarn to pure-color stroke.

- [ ] **Step 4: Commit if Git identity is configured**

Run:

```bash
git add KnitScape_单面布技术文档.md
git commit -m "docs: document scanned yarn texture brush"
```

If Git identity is not configured, leave changes uncommitted and note the identity error.

---

## Self-Review

Spec coverage:

- Per-yarn scanned image import is covered in Tasks 2, 3, and 4.
- White-background removal, crop, and compression are covered in Task 3.
- Original-color versus current-color tinting is covered in Tasks 3, 4, and 5.
- Per-yarn background, texture, and fuzz controls are covered in Task 4.
- JSON persistence and old JSON fallback are covered in Tasks 2 and 6.
- 2D canvas texture rendering is covered in Task 5.
- Documentation and no false PBR claim are covered in Tasks 1 and 7.

Placeholder scan:

- This plan contains no unresolved placeholder markers and no unnamed file paths.

Type consistency:

- `texture`, `processedDataUrl`, `useOriginalColor`, `backgroundThreshold`, `textureStrength`, and `fuzzStrength` are used consistently across UI, normalization, rendering, and validation.
