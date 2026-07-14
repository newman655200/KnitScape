# Path UV Yarn Texture Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 2.5D path-UV yarn texture preview so imported yarn scan/PBR maps follow the right-side yarn paths while preserving the existing solid Canvas fallback.

**Architecture:** Keep `yarnSimulation.js` as the source of yarn path topology and layer ordering. Add pure path sampling/UV strip builders, add cached PBR map normalization, and add a WebGL ribbon renderer that is selected only when texture preview is enabled and supported. Existing Canvas 2D drawing remains the fallback for solid mode, interaction mode, and unsupported browsers.

**Tech Stack:** JavaScript ES modules, Canvas 2D, WebGL 1-compatible shaders, Path2D fallback, lit-html, Node validation scripts, Vite

**Dirty-worktree rule:** Do not commit automatically. This repository already has substantial uncommitted user work; use scoped diffs and validators as checkpoints.

---

## File Structure

- Create: `src/simulation/yarnPathSampler.js`
  Parse and sample SVG path data into centerline points with cumulative length, tangent and normal.

- Create: `src/simulation/yarnPathUvStrip.js`
  Convert sampled centerlines into ribbon vertices, UVs, indices and draw batches.

- Create: `src/simulation/yarnUvWebglRenderer.js`
  Own WebGL program setup, texture upload/cache, shader uniforms, layer clearing and draw calls.

- Modify: `src/simulation/yarnSimulation.js`
  Build per-layer draw commands and choose WebGL UV rendering or existing Canvas 2D rendering.

- Modify: `src/simulation/yarnTextureBrush.js`
  Keep existing stroke fallback and expose small helpers for solid/color fallback.

- Modify: `src/yarnTexture/yarnScanTexture.js`
  Normalize map-specific PBR records while preserving old `processedDataUrl`.

- Modify: `src/views/leftBar.js`
  Add compact PBR map import controls under each yarn texture section.

- Modify: `src/i18n/translations.js`
  Add labels for Base Color, Normal, Roughness, Height and Ambient Occlusion imports.

- Modify: `src/constants.js`
  Add UV preview limits such as default repeat length, max texture size and max sample count.

- Create: `scripts/validate-path-uv-yarn-texture.mjs`
  Validate pure geometry behavior, source wiring and package script registration.

- Modify: `package.json`
  Add `validate:path-uv-yarn-texture`.

---

### Task 1: Normalize PBR Map Records

**Files:**
- Modify: `src/yarnTexture/yarnScanTexture.js`
- Modify: `scripts/validate-path-uv-yarn-texture.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing validator**

Create `scripts/validate-path-uv-yarn-texture.mjs` with these checks:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const packageJSON = JSON.parse(read("package.json"));
assert.equal(
  packageJSON.scripts["validate:path-uv-yarn-texture"],
  "node scripts/validate-path-uv-yarn-texture.mjs",
  "package.json must expose validate:path-uv-yarn-texture."
);

const textureSource = read("src/yarnTexture/yarnScanTexture.js");
for (const name of ["baseColor", "normal", "roughness", "height", "ambientOcclusion"]) {
  assert.match(textureSource, new RegExp(`${name}:`), `PBR map ${name} must be normalized.`);
}
assert.match(
  textureSource,
  /normalizePbrTextureMap/,
  "PBR map records must be normalized by a dedicated helper."
);
assert.match(
  textureSource,
  /processedDataUrl:\s*String\(map\.processedDataUrl \|\| map\.dataUrl \|\| ""\)/,
  "PBR map records must preserve processedDataUrl fallback behavior."
);
```

Run:

```bash
npm run validate:path-uv-yarn-texture
```

Expected: fail because the package script and helper are not present yet.

- [ ] **Step 2: Register the validator**

In `package.json`, add:

```json
"validate:path-uv-yarn-texture": "node scripts/validate-path-uv-yarn-texture.mjs"
```

Run:

```bash
npm run validate:path-uv-yarn-texture
```

Expected: fail because `normalizePbrTextureMap` is not implemented.

- [ ] **Step 3: Add normalized PBR map records**

In `src/yarnTexture/yarnScanTexture.js`, add:

```js
const EMPTY_PBR_TEXTURE_MAP = Object.freeze({
  fileName: "",
  dataUrl: "",
  processedDataUrl: "",
});

function normalizePbrTextureMap(map = null) {
  if (!map || typeof map !== "object") return null;

  return {
    fileName: String(map.fileName || ""),
    dataUrl: String(map.dataUrl || ""),
    processedDataUrl: String(map.processedDataUrl || map.dataUrl || ""),
  };
}

function normalizePbrTextureMaps(pbr = {}) {
  const source = pbr && typeof pbr === "object" ? pbr : {};

  return {
    baseColor: normalizePbrTextureMap(source.baseColor),
    normal: normalizePbrTextureMap(source.normal),
    roughness: normalizePbrTextureMap(source.roughness),
    height: normalizePbrTextureMap(source.height),
    ambientOcclusion: normalizePbrTextureMap(source.ambientOcclusion),
  };
}
```

Update `DEFAULT_YARN_SCAN_TEXTURE.pbr` to use the same keys with `null` values, and update `normalizeYarnTexture()`:

```js
pbr: normalizePbrTextureMaps(texture.pbr),
```

- [ ] **Step 4: Verify normalization**

Run:

```bash
npm run validate:path-uv-yarn-texture
```

Expected: pass for Task 1 checks.

---

### Task 2: Build a Pure Path Sampler

**Files:**
- Create: `src/simulation/yarnPathSampler.js`
- Modify: `scripts/validate-path-uv-yarn-texture.mjs`

- [ ] **Step 1: Extend the validator for sampling**

Add dynamic import checks:

```js
const sampler = await import("../src/simulation/yarnPathSampler.js");

const lineSamples = sampler.samplePathData("M 0 0 L 10 0", { spacing: 2 });
assert.equal(lineSamples[0].x, 0);
assert.equal(lineSamples[0].y, 0);
assert.equal(lineSamples.at(-1).x, 10);
assert.equal(lineSamples.at(-1).y, 0);
assert.ok(lineSamples.every((point, index, points) => index === 0 || point.u >= points[index - 1].u));
assert.ok(Math.abs(lineSamples.at(-1).u - 10) < 0.001);
assert.ok(Math.abs(lineSamples[1].normalX) < 0.001);
assert.ok(Math.abs(Math.abs(lineSamples[1].normalY) - 1) < 0.001);
```

Run:

```bash
npm run validate:path-uv-yarn-texture
```

Expected: fail because `yarnPathSampler.js` is missing.

- [ ] **Step 2: Implement uppercase SVG path token parsing**

Create `src/simulation/yarnPathSampler.js`:

```js
const TOKEN_RE = /[MLCQZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

function tokenizePathData(pathData) {
  return String(pathData || "").match(TOKEN_RE) || [];
}

function isCommand(token) {
  return /^[a-z]$/i.test(token);
}

function number(token) {
  const value = Number(token);
  return Number.isFinite(value) ? value : 0;
}
```

Support `M`, `L`, `C` and `Q`; ignore unsupported commands by ending the current sampling segment safely.

- [ ] **Step 3: Implement geometry sampling**

Add these exports:

```js
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function cubicPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return {
    x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
    y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y,
  };
}

export function quadraticPoint(p0, p1, p2, t) {
  const mt = 1 - t;
  return {
    x: mt ** 2 * p0.x + 2 * mt * t * p1.x + t ** 2 * p2.x,
    y: mt ** 2 * p0.y + 2 * mt * t * p1.y + t ** 2 * p2.y,
  };
}
```

Implement `samplePathData(pathData, { spacing = 3, curveSteps = 24 } = {})` so every returned point has:

```js
{
  x,
  y,
  u,
  tangentX,
  tangentY,
  normalX,
  normalY
}
```

- [ ] **Step 4: Verify sampler behavior**

Run:

```bash
npm run validate:path-uv-yarn-texture
```

Expected: pass all Task 1 and Task 2 checks.

---

### Task 3: Generate UV Ribbon Geometry

**Files:**
- Create: `src/simulation/yarnPathUvStrip.js`
- Modify: `scripts/validate-path-uv-yarn-texture.mjs`
- Modify: `src/constants.js`

- [ ] **Step 1: Add constants**

In `src/constants.js`, add:

```js
export const YARN_UV_TEXTURE_REPEAT_LENGTH = 48;
export const YARN_UV_SAMPLE_SPACING = 3;
export const YARN_UV_MAX_POINTS_PER_PATH = 1200;
```

- [ ] **Step 2: Extend validator for ribbon generation**

Add:

```js
const strip = await import("../src/simulation/yarnPathUvStrip.js");

const ribbon = strip.buildYarnUvStrip({
  pathData: "M 0 0 L 10 0",
  yarnWidth: 4,
  textureRepeatLength: 10,
  sampleSpacing: 2,
});

assert.ok(ribbon.positions.length >= 12, "ribbon must create left/right vertices.");
assert.ok(ribbon.uvs.length >= 12, "ribbon must create uv pairs.");
assert.ok(ribbon.indices.length >= 6, "ribbon must create triangles.");
assert.equal(ribbon.uvs[1], 0);
assert.equal(ribbon.uvs[3], 1);
assert.ok(ribbon.uvs.at(-2) >= 1, "u coordinate must advance along the path.");
```

Run:

```bash
npm run validate:path-uv-yarn-texture
```

Expected: fail because `yarnPathUvStrip.js` is missing.

- [ ] **Step 3: Implement ribbon generation**

Create `src/simulation/yarnPathUvStrip.js`:

```js
import {
  YARN_UV_MAX_POINTS_PER_PATH,
  YARN_UV_SAMPLE_SPACING,
  YARN_UV_TEXTURE_REPEAT_LENGTH,
} from "../constants";
import { samplePathData } from "./yarnPathSampler";

export function buildYarnUvStrip({
  pathData,
  yarnWidth,
  textureRepeatLength = YARN_UV_TEXTURE_REPEAT_LENGTH,
  sampleSpacing = YARN_UV_SAMPLE_SPACING,
}) {
  const sampled = samplePathData(pathData, {
    spacing: sampleSpacing,
  }).slice(0, YARN_UV_MAX_POINTS_PER_PATH);

  const positions = [];
  const uvs = [];
  const indices = [];
  const halfWidth = yarnWidth / 2;
  const repeat = Math.max(1, textureRepeatLength);

  sampled.forEach((point) => {
    const leftX = point.x - point.normalX * halfWidth;
    const leftY = point.y - point.normalY * halfWidth;
    const rightX = point.x + point.normalX * halfWidth;
    const rightY = point.y + point.normalY * halfWidth;
    const u = point.u / repeat;

    positions.push(leftX, leftY, rightX, rightY);
    uvs.push(u, 0, u, 1);
  });

  for (let i = 0; i < sampled.length - 1; i += 1) {
    const base = i * 2;
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
    pointCount: sampled.length,
  };
}
```

- [ ] **Step 4: Verify ribbon geometry**

Run:

```bash
npm run validate:path-uv-yarn-texture
```

Expected: pass all pure geometry checks.

---

### Task 4: Add the WebGL UV Renderer

**Files:**
- Create: `src/simulation/yarnUvWebglRenderer.js`
- Modify: `scripts/validate-path-uv-yarn-texture.mjs`

- [ ] **Step 1: Add static renderer checks**

Add to validator:

```js
const rendererSource = read("src/simulation/yarnUvWebglRenderer.js");
assert.match(rendererSource, /attribute\s+vec2\s+a_position/, "vertex shader must accept positions.");
assert.match(rendererSource, /attribute\s+vec2\s+a_uv/, "vertex shader must accept UV coordinates.");
assert.match(rendererSource, /uniform\s+sampler2D\s+u_baseColorMap/, "fragment shader must sample base color.");
assert.match(rendererSource, /uniform\s+sampler2D\s+u_normalMap/, "fragment shader must reserve normal map sampling.");
assert.match(rendererSource, /drawElements/, "renderer must draw indexed ribbon triangles.");
assert.match(rendererSource, /getWebglYarnRenderer/, "renderer must expose a cached factory.");
```

Run:

```bash
npm run validate:path-uv-yarn-texture
```

Expected: fail because the renderer is missing.

- [ ] **Step 2: Implement the shader strings**

Create `src/simulation/yarnUvWebglRenderer.js` with:

```js
const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_uv;
uniform vec2 u_resolution;
varying vec2 v_uv;

void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 clip = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
  v_uv = a_uv;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D u_baseColorMap;
uniform sampler2D u_normalMap;
uniform sampler2D u_roughnessMap;
uniform sampler2D u_heightMap;
uniform sampler2D u_ambientOcclusionMap;
uniform vec4 u_tint;
uniform float u_textureStrength;
uniform float u_fuzzStrength;
uniform bool u_hasBaseColorMap;
uniform bool u_hasNormalMap;
uniform bool u_hasRoughnessMap;
uniform bool u_hasHeightMap;
uniform bool u_hasAmbientOcclusionMap;

varying vec2 v_uv;

void main() {
  vec4 base = u_tint;
  if (u_hasBaseColorMap) {
    base = mix(u_tint, texture2D(u_baseColorMap, v_uv), u_textureStrength);
  }

  float relief = 0.0;
  if (u_hasHeightMap) {
    relief += texture2D(u_heightMap, v_uv).r - 0.5;
  }
  if (u_hasNormalMap) {
    relief += texture2D(u_normalMap, v_uv).g - 0.5;
  }

  float roughness = u_hasRoughnessMap ? texture2D(u_roughnessMap, v_uv).r : 0.55;
  float ao = u_hasAmbientOcclusionMap ? texture2D(u_ambientOcclusionMap, v_uv).r : 1.0;
  float edge = smoothstep(0.0, 0.22, v_uv.y) * smoothstep(1.0, 0.78, v_uv.y);
  float highlight = max(0.0, relief * (1.0 - roughness));
  float alpha = base.a * mix(edge, 1.0, 1.0 - u_fuzzStrength * 0.35);

  gl_FragColor = vec4((base.rgb + highlight * 0.22) * ao, alpha);
}
`;
```

- [ ] **Step 3: Implement renderer factory**

The factory must return `null` if WebGL cannot be created:

```js
export function getWebglYarnRenderer(canvas) {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
  });
  if (!gl) return null;

  return new YarnUvWebglRenderer(gl);
}
```

The class must expose:

```js
clear(width, height)
drawStrip(strip, material)
dispose()
```

`drawStrip()` must upload `strip.positions`, `strip.uvs`, and `strip.indices`, bind map textures if present, set tint/strength uniforms, and call:

```js
gl.drawElements(gl.TRIANGLES, strip.indices.length, gl.UNSIGNED_SHORT, 0);
```

- [ ] **Step 4: Verify renderer source wiring**

Run:

```bash
npm run validate:path-uv-yarn-texture
```

Expected: pass static renderer checks.

---

### Task 5: Integrate UV Rendering into the Simulation

**Files:**
- Modify: `src/simulation/yarnSimulation.js`
- Modify: `src/simulation/yarnTextureBrush.js`
- Modify: `scripts/validate-path-uv-yarn-texture.mjs`

- [ ] **Step 1: Add integration checks**

Add:

```js
const simulationSource = read("src/simulation/yarnSimulation.js");
assert.match(simulationSource, /buildYarnUvStrip/, "simulation must build UV strips.");
assert.match(simulationSource, /getWebglYarnRenderer/, "simulation must use WebGL renderer factory.");
assert.match(simulationSource, /renderUvTextures/, "simulation must gate UV rendering behind a named boolean.");
assert.match(simulationSource, /drawSegmentsToLayerFallback/, "simulation must preserve Canvas fallback drawing.");
```

Run:

```bash
npm run validate:path-uv-yarn-texture
```

Expected: fail until integration is added.

- [ ] **Step 2: Import UV modules**

In `src/simulation/yarnSimulation.js`, add:

```js
import { buildYarnUvStrip } from "./yarnPathUvStrip";
import { getWebglYarnRenderer } from "./yarnUvWebglRenderer";
```

- [ ] **Step 3: Build render commands per segment**

Create a helper near `drawSegmentsToLayer`:

```js
function buildYarnDrawCommand(link, ply) {
  const rowPly = rowYarnPly(link, ply);
  const pathData = resolvedPathByLink.get(link.index);
  if (!pathData) return null;

  const lineWidth = stitchWidth * rowPly.diameter;
  return {
    link,
    ply: rowPly,
    pathData,
    lineWidth,
    strip: buildYarnUvStrip({
      pathData,
      yarnWidth: lineWidth,
    }),
  };
}
```

- [ ] **Step 4: Add fallback and UV draw paths**

Rename the current `drawSegmentsToLayer(context, layerLinks)` implementation to:

```js
function drawSegmentsToLayerFallback(context, layerLinks) {
  // current Canvas 2D implementation remains here
}
```

Add:

```js
function drawSegmentsToLayerUv(renderer, fallbackContext, layerLinks) {
  if (!renderer) {
    drawSegmentsToLayerFallback(fallbackContext, layerLinks);
    return;
  }

  activeYarnPlies.forEach((ply) => {
    layerLinks.forEach((link) => {
      const command = buildYarnDrawCommand(link, ply);
      if (!command?.strip?.indices.length) return;
      renderer.drawStrip(command.strip, command.ply);
    });
  });
}
```

- [ ] **Step 5: Gate UV rendering**

Inside `draw()`, use:

```js
const renderUvTextures =
  renderTextures &&
  activeYarnPlies.some((ply) => {
    const texture = normalizeYarnTexture(ply.texture);
    return texture?.enabled !== false && (texture?.processedDataUrl || texture?.pbr?.baseColor?.processedDataUrl);
  });
```

When `renderUvTextures` is true, use WebGL renderers for each layer. Otherwise, call the fallback function.

- [ ] **Step 6: Verify integration**

Run:

```bash
npm run validate:path-uv-yarn-texture
npm run build
```

Expected: both commands pass.

---

### Task 6: Add PBR Map Import Controls

**Files:**
- Modify: `src/views/leftBar.js`
- Modify: `src/i18n/translations.js`
- Modify: `src/yarnTexture/yarnScanTexture.js`
- Modify: `scripts/validate-path-uv-yarn-texture.mjs`

- [ ] **Step 1: Add UI validation checks**

Add:

```js
const leftBarSource = read("src/views/leftBar.js");
for (const key of ["baseColor", "normal", "roughness", "height", "ambientOcclusion"]) {
  assert.match(leftBarSource, new RegExp(`pbrMap-${key}`), `left bar must expose ${key} map import control.`);
}

const translationsSource = read("src/i18n/translations.js");
for (const key of [
  "yarnTexture.pbrBaseColor",
  "yarnTexture.pbrNormal",
  "yarnTexture.pbrRoughness",
  "yarnTexture.pbrHeight",
  "yarnTexture.pbrAmbientOcclusion",
]) {
  assert.match(translationsSource, new RegExp(`"${key}"`), `translations must include ${key}.`);
}
```

- [ ] **Step 2: Add map import helper**

In `src/views/leftBar.js`, add:

```js
async function importPbrMap(index, mapKey) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp";
  input.style.display = "none";

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    try {
      if (!file) return;
      const dataUrl = await readFileAsDataUrl(file);
      const currentTexture = normalizeYarnTexture(GLOBAL_STATE.yarnPlies[index].texture) || {
        ...DEFAULT_YARN_SCAN_TEXTURE,
      };
      updateYarnPly(index, {
        texture: normalizeYarnTexture({
          ...currentTexture,
          pbr: {
            ...currentTexture.pbr,
            [mapKey]: {
              fileName: file.name || `${mapKey}.png`,
              dataUrl,
              processedDataUrl: dataUrl,
            },
          },
        }),
      });
    } catch (error) {
      console.error(error);
      alert(t("alerts.textureImportFailed", GLOBAL_STATE.language));
    } finally {
      input.remove();
    }
  });

  document.body.appendChild(input);
  input.click();
}
```

Import `readFileAsDataUrl` and `DEFAULT_YARN_SCAN_TEXTURE` at the top of the file.

- [ ] **Step 3: Render compact PBR controls**

Inside `yarnScanTextureControls(index, ply)`, after the existing scan import controls, add:

```js
const pbrMaps = [
  ["baseColor", "yarnTexture.pbrBaseColor"],
  ["normal", "yarnTexture.pbrNormal"],
  ["roughness", "yarnTexture.pbrRoughness"],
  ["height", "yarnTexture.pbrHeight"],
  ["ambientOcclusion", "yarnTexture.pbrAmbientOcclusion"],
];
```

Render buttons:

```js
<div class="yarn-pbr-map-grid">
  ${pbrMaps.map(
    ([mapKey, labelKey]) => html`<button
      type="button"
      class="btn solid yarn-pbr-map-button pbrMap-${mapKey}"
      @click=${() => importPbrMap(index, mapKey)}>
      ${t(labelKey, language)}
    </button>`
  )}
</div>
```

- [ ] **Step 4: Add translations**

Add these keys to all four language blocks in `src/i18n/translations.js`:

```js
"yarnTexture.pbrBaseColor": "Base Color",
"yarnTexture.pbrNormal": "Normal",
"yarnTexture.pbrRoughness": "Roughness",
"yarnTexture.pbrHeight": "Height",
"yarnTexture.pbrAmbientOcclusion": "AO",
```

Use localized Chinese labels in `zh-CN` and `zh-TW`.

- [ ] **Step 5: Verify UI wiring**

Run:

```bash
npm run validate:path-uv-yarn-texture
npm run validate:i18n
npm run build
```

Expected: all pass.

---

### Task 7: Preserve Performance Modes and Fallbacks

**Files:**
- Modify: `src/simulation/yarnSimulation.js`
- Modify: `src/actions/texturePerformance.js`
- Modify: `scripts/validate-path-uv-yarn-texture.mjs`

- [ ] **Step 1: Add performance validator checks**

Add:

```js
assert.match(
  simulationSource,
  /texturePreviewInteractionActive/,
  "UV preview must respect interaction-active downgrades."
);
assert.match(
  simulationSource,
  /TEXTURE_PERFORMANCE_MODES\.SOLID/,
  "Solid mode must bypass UV texture rendering."
);
assert.match(
  simulationSource,
  /drawSegmentsToLayerFallback/,
  "Fallback drawing must remain available."
);
```

- [ ] **Step 2: Keep interaction downgrade behavior**

Confirm `shouldRenderTextures()` remains:

```js
function shouldRenderTextures({
  texturePerformanceMode = TEXTURE_PERFORMANCE_MODES.AUTO,
  texturePreviewInteractionActive = false,
} = {}) {
  if (texturePerformanceMode === TEXTURE_PERFORMANCE_MODES.SOLID) return false;
  if (texturePerformanceMode === TEXTURE_PERFORMANCE_MODES.AUTO) {
    return !texturePreviewInteractionActive;
  }
  return true;
}
```

Do not regenerate UV strips while only `simPan`, `simPreviewPan`, `simPreviewScale` or `flipped` changes.

- [ ] **Step 3: Verify performance gates**

Run:

```bash
npm run validate:path-uv-yarn-texture
npm run validate:sim-wheel-performance
npm run build
```

Expected: all pass.

---

### Task 8: Browser QA and Documentation Update

**Files:**
- Modify: `KnitScape_单面布技术文档.md`
- Modify: `design-qa.md`

- [ ] **Step 1: Run automated validations**

Run:

```bash
npm run validate:path-uv-yarn-texture
npm run validate:yarn-sequence-editor
npm run validate:no-yarn-length-simulation
npm run validate:central-stitch-toolbar
npm run build
```

Expected: all commands pass.

- [ ] **Step 2: Manual browser checks**

Run:

```bash
npm run dev
```

Check in Chrome or Edge:

```text
1. Default preview still appears.
2. Solid mode remains responsive.
3. Import a base color/scan map and confirm the texture follows yarn loops.
4. Import normal/height map and confirm relief changes without breaking alpha.
5. Pan and zoom the right preview; Auto mode should temporarily use fast preview.
6. Flip front/back; UV texture orientation remains attached to yarn paths.
7. Export JSON and re-import it; PBR map records remain present.
8. Open an older JSON without pbr maps; preview still works.
```

- [ ] **Step 3: Update technical documentation**

In `KnitScape_单面布技术文档.md`, add a section describing:

```text
Path UV yarn texture preview
WebGL UV ribbon renderer
Canvas fallback
Auto / Quality / Solid performance behavior
PBR map fields and first-version limitations
```

In `design-qa.md`, add browser evidence:

```text
Viewport
Texture maps tested
Performance mode tested
Console errors
Known visual limits
```

- [ ] **Step 4: Final verification**

Run:

```bash
npm run validate:path-uv-yarn-texture
npm run build
git diff --check
```

Expected:

```text
validators pass
build succeeds
git diff --check emits no whitespace errors
```

---

## Self-Review

- Spec coverage: The tasks cover map normalization, path sampling, UV strip geometry, WebGL rendering, simulation integration, UI imports, performance fallback, and documentation.
- Placeholder scan: No unresolved implementation markers are intentionally left in this plan.
- Type consistency: PBR keys are consistently named `baseColor`, `normal`, `roughness`, `height`, and `ambientOcclusion`; UV geometry consistently uses `positions`, `uvs`, and `indices`.
