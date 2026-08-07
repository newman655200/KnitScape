# Yarn Simulation Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `yarnSimulation.js` into a small orchestrator while preserving the current yarn paths, canvas layering, texture behavior, and yarn-length output exactly.

**Architecture:** Keep topology ownership in the existing `Pattern`, `ProcessModel`, and `YarnModel` classes. Extract path layout/resolution into `yarnPathGeometry.js` and three-layer drawing into `drawYarnSimulation.js`; the public `simulate(...)` signature and return value remain unchanged.

**Tech Stack:** Vanilla ES modules, d3 7, Canvas 2D, WebGL renderer, Vite SSR for characterization, existing Node validators.

---

### Task 1: Lock the Current Simulation Output

**Files:**
- Create: `scripts/validate-yarn-simulation-characterization.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add the current 4×8 knit fixture as a characterization test**

Create `scripts/validate-yarn-simulation-characterization.mjs`:

```js
import assert from "node:assert/strict";
import { createServer } from "vite";

globalThis.devicePixelRatio = 1;

const pathData = [];
globalThis.Path2D = class Path2D {
  constructor(data = "") {
    this.data = data;
    pathData.push(data);
  }
};

function createContext() {
  return {
    clearRect() {},
    save() {},
    restore() {},
    stroke() {},
    createPattern() {
      return null;
    },
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    lineCap: "round",
    lineJoin: "round",
    lineWidth: 1,
    strokeStyle: "#000",
  };
}

const canvases = new Map(
  ["back", "mid", "front"].map((id) => [
    id,
    {
      id,
      width: 0,
      height: 0,
      style: {},
      getContext: () => createContext(),
    },
  ])
);

globalThis.document = {
  getElementById(id) {
    if (id === "sim-container") {
      return { getBoundingClientRect: () => ({ width: 320, height: 240 }) };
    }
    return canvases.get(id);
  },
};

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const [{ simulate }, { Bimp }, constants] = await Promise.all([
    server.ssrLoadModule("/src/simulation/yarnSimulation.js"),
    server.ssrLoadModule("/src/lib/Bimp.js"),
    server.ssrLoadModule("/src/constants.js"),
  ]);

  const result = simulate(
    Bimp.empty(4, 8, 0),
    new Bimp(1, 8, Array(8).fill(0)),
    ["#cc3366"],
    1,
    constants.DEFAULT_YARN_PLIES,
    {
      machineGauge: 7,
      texturePerformanceMode: constants.TEXTURE_PERFORMANCE_MODES.SOLID,
    }
  );
  result.stopSim();

  assert.equal(result.yarnLengthMetrics.gauge, 7);
  assert.equal(
    result.yarnLengthMetrics.needlePitchMm,
    3.6285714285714286
  );
  assert.ok(
    Math.abs(
      result.yarnLengthMetrics.totalPathLengthStitchUnits -
        94.76508273180484
    ) < 1e-9
  );
  assert.equal(result.yarnLengthMetrics.effectiveLoopCount, 32);
  assert.ok(
    Math.abs(result.yarnLengthMetrics.cmPer100Loops - 107.45683488338587) <
      1e-9
  );
  assert.equal(pathData.length, 195);
  assert.equal(new Set(pathData.filter(Boolean)).size, 195);
  for (const canvas of canvases.values()) {
    assert.deepEqual([canvas.width, canvas.height], [320, 240]);
  }
} finally {
  await server.close();
}

console.log("PASS: yarn simulation matches the pre-refactor fixture.");
```

- [ ] **Step 2: Add the package command and run the baseline**

Add:

```json
"validate:yarn-simulation-characterization": "node scripts/validate-yarn-simulation-characterization.mjs"
```

Run:

```powershell
npm run validate:yarn-simulation-characterization
```

Expected: PASS with the current monolithic implementation. If a recorded number differs, stop and investigate the fixture rather than changing the expected value during extraction.

- [ ] **Step 3: Commit the characterization fixture**

```powershell
git add package.json scripts/validate-yarn-simulation-characterization.mjs
git commit -m "test: characterize yarn simulation output"
```

### Task 2: Extract Yarn Path Geometry

**Files:**
- Create: `src/simulation/yarnPathGeometry.js`
- Create: `scripts/validate-yarn-simulation-modules.mjs`
- Modify: `src/simulation/yarnSimulation.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing module-boundary validation**

Create `scripts/validate-yarn-simulation-modules.mjs`:

```js
import assert from "node:assert/strict";
import fs from "node:fs";

const exists = (file) => fs.existsSync(file);
const read = (file) => fs.readFileSync(file, "utf8");

assert.ok(
  exists("src/simulation/yarnPathGeometry.js"),
  "path geometry must live in its own module."
);
assert.ok(
  exists("src/simulation/drawYarnSimulation.js"),
  "canvas drawing must live in its own module."
);

const orchestrator = read("src/simulation/yarnSimulation.js");
assert.match(orchestrator, /buildYarnPathGeometry/);
assert.match(orchestrator, /drawYarnSimulation/);
assert.doesNotMatch(orchestrator, /function layoutNodes/);
assert.doesNotMatch(orchestrator, /function drawSegmentsToLayerUv/);
assert.doesNotMatch(orchestrator, /function buildYarnLengthMetrics/);

const geometry = read("src/simulation/yarnPathGeometry.js");
for (const symbol of [
  "layoutNodes",
  "updateNormals",
  "buildResolvedPathMap",
  "buildYarnLengthMetrics",
]) {
  assert.match(geometry, new RegExp(symbol));
}

const drawing = read("src/simulation/drawYarnSimulation.js");
for (const symbol of [
  "rowYarnPly",
  "drawSegmentsToLayerFallback",
  "drawSegmentsToLayerUv",
  "drawYarnSimulation",
]) {
  assert.match(drawing, new RegExp(symbol));
}

console.log("PASS: yarn simulation responsibilities are separated.");
```

Run:

```powershell
node scripts/validate-yarn-simulation-modules.mjs
```

Expected: FAIL because both extracted modules are missing.

- [ ] **Step 2: Create the geometry module with the existing math unchanged**

Move these concrete responsibilities from `simulate(...)` into `src/simulation/yarnPathGeometry.js`:

```text
Constants: X_PADDING, Y_PADDING, STITCH_RATIO, SPREAD
Functions: layoutNodes, unitNormal, updateNormals, getBasePointPosition,
           getYarnLinkCurvePoints, getSharedPointPosition, yarnCurve,
           rowSupportsLengthModel, buildRowCoefficients,
           buildResolvedPathMap, pointInEffectiveNeedles,
           linkInEffectiveNeedles, buildYarnLengthMetrics
```

Use these imports and public interface; copy the current function bodies without formula, condition, curve, or ordering changes:

```js
import * as d3 from "d3";
import {
  assertContinuousRowPaths,
  moveNeckPoint,
  pathDataLength,
} from "./rowLengthLoopModel";
import {
  cmPer100Loops,
  gaugeToNeedlePitchMm,
  normalizeMachineGauge,
} from "./yarnLengthMetrics.js";

export const X_PADDING = 1;
export const Y_PADDING = 0;

export function buildYarnPathGeometry({
  pattern,
  stitchPattern,
  yarnGraph,
  canvasWidth,
  canvasHeight,
  primaryLengthScaleY,
  primaryYarnDiameter,
  machineGauge,
}) {
  // The named functions above remain private inside this concrete operation.
  // Their bodies are moved unchanged from yarnSimulation.js.

  const nodes = layoutNodes(yarnGraph);
  const yarnPath = yarnGraph.makeNice();
  rowBoundaryIndices = new Map();
  yarnPath.forEach((point, pathIndex) => {
    point.pathIndex = pathIndex;
    const bounds = rowBoundaryIndices.get(point.row) || {
      first: pathIndex,
      last: pathIndex,
    };
    bounds.last = pathIndex;
    rowBoundaryIndices.set(point.row, bounds);
  });
  const yarnPathLinks = yarnGraph.yarnPathToLinks();
  updateNormals();
  const resolvedPathByLink = buildResolvedPathMap();

  return {
    stitchWidth,
    yarnPathLinks,
    resolvedPathByLink,
    yarnLengthMetrics: buildYarnLengthMetrics(),
  };
}
```

The moved implementation must preserve these exact inputs from the old closure:

```text
stitchPattern, pattern, canvasWidth, canvasHeight, primaryLengthScaleY,
primaryYarnDiameter, machineGauge, nodes, yarnPath, yarnPathLinks,
rowBoundaryIndices, stitchWidth, stitchHeight, halfStitch, yarnWidth, offsetX
```

- [ ] **Step 3: Wire geometry into the orchestrator**

Keep normalization, texture-mode selection, canvas lookup, model construction, asynchronous texture preparation, `stopSim`, and the public function signature in `yarnSimulation.js`. Replace the moved closure with:

```js
import {
  buildYarnPathGeometry,
  X_PADDING,
  Y_PADDING,
} from "./yarnPathGeometry.js";

const stitchPattern = new Pattern(pattern.pad(X_PADDING, Y_PADDING, 0));
const processModel = new ProcessModel(stitchPattern);
const yarnGraph = new YarnModel(processModel.cn);
const geometry = buildYarnPathGeometry({
  pattern,
  stitchPattern,
  yarnGraph,
  canvasWidth,
  canvasHeight,
  primaryLengthScaleY,
  primaryYarnDiameter: activeYarnPlies[0].diameter,
  machineGauge,
});
```

Do not change `normalizeYarnPlies`, texture mode selection, canvas sizing, or the returned `{ stopSim, yarnLengthMetrics }` contract.

- [ ] **Step 4: Run the characterization test**

Run:

```powershell
npm run validate:yarn-simulation-characterization
```

Expected: the exact recorded metrics, 195 path calls, and canvas dimensions still pass.

- [ ] **Step 5: Commit the geometry extraction**

```powershell
git add src/simulation/yarnPathGeometry.js src/simulation/yarnSimulation.js
git commit -m "refactor: extract yarn path geometry"
```

### Task 3: Extract Three-Layer Drawing

**Files:**
- Create: `src/simulation/drawYarnSimulation.js`
- Modify: `src/simulation/yarnSimulation.js`

- [ ] **Step 1: Run the module validator and observe the remaining failure**

Run:

```powershell
node scripts/validate-yarn-simulation-modules.mjs
```

Expected: FAIL because `drawYarnSimulation.js` is still missing and drawing helpers remain in the orchestrator.

- [ ] **Step 2: Create the drawing module**

Move these existing functions without changing their drawing order or material calculations:

```text
rowYarnPly, collectSequenceMaskPath, drawBatchedSequenceMasks,
buildYarnDrawCommand, drawSegmentsToLayerFallback,
drawSegmentsToLayerUv, draw
```

Rename the final private `draw` entry point to the exported `drawYarnSimulation` function and use this exact interface:

```js
import { buildYarnUvStrip } from "./yarnPathUvStrip.js";
import { getWebglYarnRenderer } from "./yarnUvWebglRenderer.js";
import {
  drawYarnSequenceMaskPath,
  drawYarnTexturePath,
} from "./yarnTextureBrush.js";
import { yarnIndexForSequenceRow } from "../actions/yarnSequenceRows.js";
import {
  YARN_UV_MAX_POINTS_PER_PATH,
  YARN_UV_SAMPLE_SPACING,
  YARN_UV_TEXTURE_REPEAT_LENGTH,
} from "../constants.js";

export function drawYarnSimulation({
  canvases,
  canvasWidth,
  canvasHeight,
  yarnPathLinks,
  resolvedPathByLink,
  stitchWidth,
  activeYarnPlies,
  normalizedYarnSequence,
  palette,
  hasYarnSequenceMask,
  renderTextures,
  renderUvTextures,
}) {
  const { backCanvas, midCanvas, frontCanvas } = canvases;
  const backCtx = backCanvas.getContext("2d");
  const midCtx = midCanvas.getContext("2d");
  const frontCtx = frontCanvas.getContext("2d");

  // Keep the moved row-material, batching, UV, and Canvas drawing bodies unchanged.
  // Clear layers, sort links by layer, then draw back, front, and middle in
  // the same order as the original implementation.
}
```

- [ ] **Step 3: Replace drawing closures with one explicit call**

In `yarnSimulation.js`, import `drawYarnSimulation` and build a local concrete redraw function:

```js
import { drawYarnSimulation } from "./drawYarnSimulation.js";

function draw() {
  drawYarnSimulation({
    canvases: { backCanvas, midCanvas, frontCanvas },
    canvasWidth,
    canvasHeight,
    yarnPathLinks: geometry.yarnPathLinks,
    resolvedPathByLink: geometry.resolvedPathByLink,
    stitchWidth: geometry.stitchWidth,
    activeYarnPlies,
    normalizedYarnSequence,
    palette,
    hasYarnSequenceMask,
    renderTextures,
    renderUvTextures,
  });
}
```

Keep the first `draw()` call and the existing guarded redraw after `prepareYarnTextureImages(activeYarnPlies)`.

- [ ] **Step 4: Expose and run the module validation**

Add to `package.json`:

```json
"validate:yarn-simulation-modules": "node scripts/validate-yarn-simulation-modules.mjs"
```

Run:

```powershell
npm run validate:yarn-simulation-modules
npm run validate:yarn-simulation-characterization
```

Expected: both commands print `PASS` and exit 0.

- [ ] **Step 5: Commit the drawing extraction**

```powershell
git add package.json scripts/validate-yarn-simulation-modules.mjs src/simulation/drawYarnSimulation.js src/simulation/yarnSimulation.js
git commit -m "refactor: extract yarn simulation drawing"
```

### Task 4: Point Existing Validators at the New Owners

**Files:**
- Modify: `scripts/validate-no-yarn-length-simulation.mjs`
- Modify: `scripts/validate-path-uv-yarn-texture.mjs`
- Modify: `scripts/validate-row-length-loop-model.mjs`
- Modify: `scripts/validate-two-ply-yarn.mjs`
- Modify: `scripts/validate-yarn-length-gauge.mjs`
- Modify: `scripts/validate-yarn-sequence-editor.mjs`

- [ ] **Step 1: Run the affected validators and record structural failures**

Run:

```powershell
npm run validate:no-yarn-length-simulation
npm run validate:path-uv-yarn-texture
npm run validate:row-length-loop-model
npm run validate:two-ply-yarn
npm run validate:yarn-length-gauge
npm run validate:yarn-sequence-editor
```

Expected: behavioral imports still work, while assertions that search only `yarnSimulation.js` fail for moved symbols.

- [ ] **Step 2: Make each validator inspect the complete concrete subsystem**

Where a validator currently reads only `src/simulation/yarnSimulation.js`, replace that assignment with the same joined source:

```js
const simulationSource = [
  "src/simulation/yarnSimulation.js",
  "src/simulation/yarnPathGeometry.js",
  "src/simulation/drawYarnSimulation.js",
]
  .map(read)
  .join("\n");
```

For validators that use `fs.readFileSync` directly rather than a `read` helper, use:

```js
const simulationSource = [
  "src/simulation/yarnSimulation.js",
  "src/simulation/yarnPathGeometry.js",
  "src/simulation/drawYarnSimulation.js",
]
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
```

Keep every existing positive and forbidden-pattern assertion unchanged. In `validate-yarn-sequence-editor.mjs`, point its row-material assertions specifically at `drawYarnSimulation.js`; in `validate-yarn-length-gauge.mjs`, point effective-needle assertions specifically at `yarnPathGeometry.js`.

- [ ] **Step 3: Run the six validators and both new validators**

Run the six commands from Step 1, then:

```powershell
npm run validate:yarn-simulation-modules
npm run validate:yarn-simulation-characterization
```

Expected: all eight commands print `PASS` and exit 0.

- [ ] **Step 4: Commit validator ownership updates**

```powershell
git add scripts/validate-no-yarn-length-simulation.mjs scripts/validate-path-uv-yarn-texture.mjs scripts/validate-row-length-loop-model.mjs scripts/validate-two-ply-yarn.mjs scripts/validate-yarn-length-gauge.mjs scripts/validate-yarn-sequence-editor.mjs
git commit -m "test: follow modular yarn simulation ownership"
```

### Task 5: Verify the Simulation Sub-Project

**Files:**
- No source changes expected.

- [ ] **Step 1: Run every validation script**

```powershell
$package = Get-Content package.json | ConvertFrom-Json
$package.scripts.PSObject.Properties |
  Where-Object Name -Like 'validate:*' |
  ForEach-Object {
    npm run $_.Name
    if ($LASTEXITCODE -ne 0) { throw "Validation failed: $($_.Name)" }
  }
```

Expected: every validation exits 0.

- [ ] **Step 2: Build production assets**

```powershell
npm run build
```

Expected: Vite build exits 0.

- [ ] **Step 3: Check scope and whitespace**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors and no unrelated tracked files added to commits.
