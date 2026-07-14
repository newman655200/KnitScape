# Row-Length Loop Shape Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use Yarn 1's length ratio to move shared ordinary-loop neck nodes inward/outward, solve each row toward its target path length, and guarantee adjacent curve segments remain continuous.

**Architecture:** Add a pure bounded coefficient solver and path-length sampler. In `yarnSimulation.js`, generate every candidate curve from one shared node-position function: head/boundary anchors stay fixed, internal leg/neck nodes move horizontally around their stitch center and vertically relative to the fixed head so shorter targets are mathematically reachable, and all yarn plies reuse the final cached paths. Remove the non-physical D3 force relaxation path and rewrite the root technical document as a current-state reference.

**Tech Stack:** JavaScript ES modules, D3 Catmull–Rom curves, Canvas 2D/Path2D, lit-html, Node validation scripts, Vite

**Dirty-worktree rule:** Do not commit implementation files automatically. The repository already contains substantial uncommitted user work; use validators, scoped diffs, and the production build as checkpoints.

---

### Task 1: Add the Pure Coefficient Solver and Length Sampler

**Files:**
- Create: `src/simulation/rowLengthLoopModel.js`
- Create: `scripts/validate-row-length-loop-model.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing validator**

Create a validator that imports these future exports:

```js
import {
  moveNeckPointX,
  pathDataLength,
  solveSharedCoefficient,
} from "../src/simulation/rowLengthLoopModel.js";
```

It must assert:

```js
const centerX = 0;
const leftNeck = { x: -0.5, y: 0 };
assert.equal(moveNeckPointX(leftNeck, centerX, 0.8).x, -0.4);
assert.equal(moveNeckPointX(leftNeck, centerX, 1.2).x, -0.6);

const fixedTop = moveNeckPointX({ x: 0, y: -2 }, centerX, 0.8, false);
assert.deepEqual(fixedTop, { x: 0, y: -2 });

const baseline = 100;
const tight = solveSharedCoefficient({
  targetLength: 90,
  direction: "tight",
  measureLength: (coefficient) => baseline * coefficient,
});
const loose = solveSharedCoefficient({
  targetLength: 110,
  direction: "loose",
  measureLength: (coefficient) => baseline * coefficient,
});
assert.ok(tight.coefficient < 1);
assert.ok(loose.coefficient > 1);
assert.ok(tight.relativeError <= 0.001);
assert.ok(loose.relativeError <= 0.001);

assert.ok(pathDataLength("M 0 0 L 3 4") === 5);
```

Register:

```json
"validate:row-length-loop-model": "node --experimental-default-type=module scripts/validate-row-length-loop-model.mjs"
```

Run `npm run validate:row-length-loop-model` and verify it fails because the module is missing.

- [ ] **Step 2: Implement deterministic path sampling**

In `rowLengthLoopModel.js`, implement:

```js
export function samplePathData(pathData, samplesPerCurve = 24) {
  // Parse uppercase M/L/C tokens.
  // Add M and L endpoints directly.
  // Sample each cubic C segment at t = 1/samples ... 1.
  // Return finite {x, y} points in path order.
}

export function polylineLength(points, unitScale = 1) {
  return points.slice(1).reduce(
    (total, point, index) =>
      total +
      Math.hypot(
        point.x - points[index].x,
        point.y - points[index].y
      ) / unitScale,
    0
  );
}

export function pathDataLength(pathData, unitScale = 1) {
  return polylineLength(samplePathData(pathData), unitScale);
}
```

Use the standard cubic Bézier equation inside `samplePathData`; reject no valid current D3 `M/C/L` output and never return NaN.

- [ ] **Step 3: Implement neck movement and bounded search**

Implement:

```js
export function moveNeckPointX(point, centerX, coefficient, movable = true) {
  if (!movable) return { ...point };
  return {
    ...point,
    x: centerX + coefficient * (point.x - centerX),
  };
}

export function solveSharedCoefficient({
  targetLength,
  direction,
  measureLength,
  minCoefficient = 0.4,
  maxCoefficient = 1.8,
  scanSteps = 80,
  refinementSteps = 28,
  relativeTolerance = 0.001,
}) {
  // Restrict candidates to [min, 1] for tight and [1, max] for loose.
  // Scan deterministically, keep the coefficient with smallest absolute error.
  // Refine repeatedly around the best adjacent scan interval.
  // Return coefficient, actualLength, targetLength, relativeError, limited.
}
```

Do not assume the rendered row length is globally monotonic; select the closest bounded candidate. Set `limited: true` when the final relative error remains above tolerance at a search boundary.

- [ ] **Step 4: Run the validator green**

Run `npm run validate:row-length-loop-model`.

Expected: exit `0` and a PASS message for neck direction, length sampling, and bounded coefficient solving.

---

### Task 2: Integrate Shared-Node Row Geometry Without Gaps

**Files:**
- Modify: `scripts/validate-row-length-loop-model.mjs`
- Modify: `src/simulation/yarnSimulation.js`
- Modify: `scripts/validate-two-ply-yarn.mjs`

- [ ] **Step 1: Add failing integration and continuity assertions**

The validator must require these runtime symbols:

```text
primaryLengthScaleY
rowSupportsLengthModel
buildRowCoefficients
getSharedPointPosition
buildResolvedPathMap
assertContinuousRowPaths
```

Add a pure continuity assertion using exported `pathEndpoints()`:

```js
const connected = ["M 0 0 L 1 1", "M 1 1 L 2 0"];
assert.equal(assertContinuousRowPaths(connected, 1e-6), true);
const broken = ["M 0 0 L 1 1", "M 1.01 1 L 2 0"];
assert.equal(assertContinuousRowPaths(broken, 1e-6), false);
```

Run the validator and verify red.

- [ ] **Step 2: Build one shared position for every yarn-path node**

In `yarnSimulation.js`:

```js
const primaryLengthScaleY = Math.min(
  1.1,
  Math.max(0.9, Number(yarnPlies?.[0]?.lengthScaleY) || 1)
);
```

Record the first and last `yarnPath` index for each row. Implement `getSharedPointPosition(point, coefficientByRow)` so that:

- `FH` / `LH` head nodes remain unchanged;
- the first and last path point in each row remain unchanged;
- internal `FL` / `LL` leg/neck nodes move symmetrically in X and adjust their effective loop height in Y;
- the stitch center is the midpoint of the two contact-grid columns for `Math.floor(point.i / 2)`;
- a given `yarnPath` point always returns the same coordinate for all links that reference it.

Do not deform each link independently.

- [ ] **Step 3: Generate candidate curves from shared points**

Change `yarnCurve(link)` to accept `coefficientByRow`. For its four Catmull–Rom points, call `getSharedPointPosition()` and pass the resulting `{x, y}` values into one D3 line generator. Edge links use the same shared positions for their straight segment.

Group links by `link.row`. A row is supported only when every `Pattern.op(x, row)` is `K` or `P`; unsupported slip/tuck rows keep coefficient `1`.

- [ ] **Step 4: Solve row coefficients and rebuild until stable**

Implement `buildRowCoefficients()`:

1. Start every supported row at coefficient `1`.
2. Measure each row's baseline from the actual candidate D3 paths, divided by `stitchWidth`.
3. Set `target = baseline * primaryLengthScaleY`.
4. For up to five deterministic passes, solve each row while other row coefficients retain their latest values.
5. Stop early when every supported row is within `0.1%` or boundary-limited.

This iteration accounts for neighboring Catmull control points while keeping shared-node coordinates consistent.

- [ ] **Step 5: Cache final paths once and verify continuity**

`buildResolvedPathMap()` must generate every link path once from the final coefficient map. Before drawing, group final paths by row and call `assertContinuousRowPaths(paths, stitchWidth * 1e-6)`. If a row fails, fall back that entire row to coefficient `1`; never draw disconnected calculated segments.

Store final strings in `resolvedPathByLink` outside the yarn-ply loop. Every ply reads:

```js
const pathData = resolvedPathByLink.get(link.index);
```

- [ ] **Step 6: Prove all yarn plies reuse identical paths**

Extend `validate-two-ply-yarn.mjs` to collect solid-color stroke path strings for Yarn 1 and Yarn 2 and assert `deepEqual` between both arrays.

Run:

```powershell
npm run validate:row-length-loop-model
npm run validate:two-ply-yarn
```

Expected: both pass, including the no-gap and identical-path assertions.

---

### Task 3: Make Yarn 1 the Only Editable Geometry Length

**Files:**
- Modify: `scripts/validate-yarn-length-parameters.mjs`
- Modify: `src/views/leftBar.js`
- Modify: `src/i18n/translations.js`
- Modify: `src/codeGuide/codeGuideDefinitions.json`
- Regenerate: `src/codeGuide/generatedLines.json`

- [ ] **Step 1: Change the validator to require one slider**

Require `name="yarn-ply-length-0"`, `updateYarnPly(0, { lengthScaleY: ... })`, and `yarnPly.followsFirst`. Forbid the old interpolated `name="yarn-ply-length-${index}"`. Preserve runtime JSON assertions for every imported `lengthScaleY` field.

- [ ] **Step 2: Change the UI**

Render the existing range input only when `isFirst`. For every later yarn render read-only text `t("yarnPly.followsFirst", language)`. Remove `yarnPly.secondLength`; add `yarnPly.followsFirst` in Simplified Chinese, Traditional Chinese, English, and Vietnamese.

- [ ] **Step 3: Update code guide and verify**

Document that Yarn 1 controls geometry and every later yarn inherits the cached path. Regenerate line numbers, then run:

```powershell
npm run validate:yarn-length-parameters
npm run validate:i18n
npm run validate:code-guide
```

Expected: all pass.

---

### Task 4: Delete Non-Physical Relaxation

**Files:**
- Modify: `scripts/validate-row-length-loop-model.mjs`
- Modify: `src/components/runSimulation.js`
- Modify: `src/simulation/yarnSimulation.js`
- Delete: `src/simulation/YarnForce.js`
- Modify: `src/i18n/translations.js`
- Modify: `src/views/uiButton.js`
- Modify: `src/codeGuide/codeGuideDefinitions.json`
- Modify: `scripts/validate-code-guide.mjs`
- Regenerate: `src/codeGuide/generatedLines.json`

- [ ] **Step 1: Add failing absence assertions**

Require no `simulation.relax`, `yarnLinkForce`, `d3.forceSimulation`, `function relax`, or `YarnForce.js`.

- [ ] **Step 2: Remove runtime and UI**

Delete the Relax button, callback, force constants, `relax()` and YarnForce import/file. Keep D3 for `line()` and `curveCatmullRomOpen`. Keep `stopSim` only to suppress obsolete async texture redraws after a simulation instance is replaced.

- [ ] **Step 3: Remove metadata and verify**

Remove relax translations, icon, code-guide definition and required key. Regenerate code-guide lines. Run the model, code-guide, and wheel-performance validators; all must pass.

---

### Task 5: Rewrite the Root Technical Document

**Files:**
- Modify: `scripts/validate-row-length-loop-model.mjs`
- Rewrite: `KnitScape_单面布技术文档.md`

- [ ] **Step 1: Add a failing document contract**

Require headings for 项目定位、当前架构、核心数据模型、编辑与预览、按行纱长线圈模型、多纱路径复用、文件与部署、验证与发布、当前限制. Forbid Step 16A–E, old snapshot/force fields, PBR roadmap and stale validation commands.

- [ ] **Step 2: Rewrite as current-state documentation**

Describe only current files and behavior. The yarn-model section must state:

- target row length is baseline times Yarn 1 ratio;
- top and outer row anchors stay fixed;
- internal X-axis neck nodes move symmetrically;
- curves share node coordinates and must have endpoint gaps <= `1e-6` stitch units;
- supported knit/purl rows use bounded numerical search;
- slip/tuck rows safely retain baseline geometry;
- every later yarn reuses Yarn 1 paths;
- no Simulate or Relax control exists.

Delete chronological Step 1–24 history, abandoned algorithms, PBR roadmap and unrelated future directions. Keep current editing, textures, import/export, offline deployment, validation and the future machine-controlled upper-anchor direction.

- [ ] **Step 3: Run the document contract green**

Run the model validator and an `rg` audit for stale terms. Both must confirm the concise current document.

---

### Task 6: Full Verification and Visual Acceptance

**Files:**
- Test: all retained `scripts/validate-*.mjs`
- Test: production build
- Inspect: browser preview

- [ ] **Step 1: Run all validators**

Enumerate every `validate:*` package script and run each sequentially, stopping on any nonzero exit.

- [ ] **Step 2: Run `npm run build`**

Expected: Vite exit `0`; non-fatal bundle-size warnings are acceptable.

- [ ] **Step 3: Browser acceptance on `http://127.0.0.1:4173/`**

Run:

```powershell
npm run dev -- --host 127.0.0.1 --port 4173
```

Verify:

1. `0.90` moves both necks inward and looks tighter.
2. `1.10` moves both necks outward and looks looser.
3. Top points and outer row anchors remain fixed.
4. Every adjacent segment meets exactly; zoomed inspection shows no gaps.
5. Repeated loops in one row remain uniform.
6. Yarn 2 uses the identical geometry.
7. Slip/tuck rows remain stable.
8. Simulate and Relax buttons are absent; console has no errors.

- [ ] **Step 4: Final source audit**

Run `git diff --check`, removed-runtime searches, retained-model searches, and `git status --short`. Do not commit implementation files automatically.
