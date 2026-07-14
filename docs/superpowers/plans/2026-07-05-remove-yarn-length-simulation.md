# Remove Yarn-Length Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the current yarn-length preview button, request/snapshot pipeline, and curve-deformation algorithm while retaining the yarn-length sliders and `lengthScaleY` project data.

**Architecture:** Keep yarn-length as normalized, importable, exportable yarn-ply metadata, but make the renderer ignore it. Collapse `runSimulation()` back to a direct call to the ordinary simulation pipeline and add a repository guard that prevents the removed algorithm from lingering while protecting the retained parameter contract.

**Tech Stack:** JavaScript ES modules, lit-html, D3, Canvas 2D, Node validation scripts, Vite

**Dirty-worktree rule:** The target source files already contain substantial user changes. Do not create implementation commits unless the user explicitly requests one; committing whole files would mix unrelated work. Use `git diff --check`, scoped diffs, validators, and the production build as checkpoints.

---

### Task 1: Add a Failing Removal Guard

**Files:**
- Create: `scripts/validate-no-yarn-length-simulation.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create the guard before changing runtime code**

Create `scripts/validate-no-yarn-length-simulation.mjs` with this behavior:

```js
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const packageJSON = JSON.parse(read("package.json"));
const constants = read("src/constants.js");
const state = read("src/state.js");
const leftBar = read("src/views/leftBar.js");
const importers = read("src/actions/importers.js");
const exporters = read("src/actions/exporters.js");
const runSimulation = read("src/components/runSimulation.js");
const simulation = read("src/simulation/yarnSimulation.js");
const translations = read("src/i18n/translations.js");
const codeGuideDefinitions = read("src/codeGuide/codeGuideDefinitions.json");

assert.equal(
  packageJSON.scripts["validate:no-yarn-length-simulation"],
  "node scripts/validate-no-yarn-length-simulation.mjs"
);

for (const [source, pattern, message] of [
  [constants, /lengthScaleY:\s*1/, "yarn-length defaults must remain"],
  [leftBar, /data-code-guide-key="yarn\.ply-length"/, "yarn-length sliders must remain"],
  [leftBar, /lengthScaleY:\s*Number\(e\.target\.value\)/, "slider writes must remain"],
  [importers, /normalizeYarnPlies/, "JSON import normalization must remain"],
  [exporters, /yarnPlies:\s*GLOBAL_STATE\.yarnPlies/, "JSON export persistence must remain"],
  [codeGuideDefinitions, /"yarn\.ply-length"/, "parameter code-guide entry must remain"],
]) {
  assert.match(source, pattern, message);
}

const forbiddenRuntimePatterns = [
  /yarnLengthSimulationRequestId/,
  /createYarnLengthSimulationSnapshotController/,
  /yarn-length-sim-action/,
  /simulation\.yarnLength/,
  /yarnLengthSimulationEnabled/,
  /captureYarnLengthGeometry/,
  /yarnLengthGeometrySnapshot/,
  /createLengthGeometryDescriptor/,
  /deformYarnCurveForLength/,
  /solveSagittaForTargetLength/,
];

for (const [name, source] of [
  ["state", state],
  ["runSimulation", runSimulation],
  ["simulation", simulation],
  ["translations", translations],
  ["codeGuideDefinitions", codeGuideDefinitions],
]) {
  for (const pattern of forbiddenRuntimePatterns) {
    assert.doesNotMatch(source, pattern, `${name} retains ${pattern}`);
  }
}

for (const obsoletePath of [
  "src/actions/yarnLengthSimulationSnapshot.js",
  "scripts/validate-yarn-length-simulation-toggle.mjs",
  "scripts/validate-yarn-length-scaling.mjs",
]) {
  assert.equal(fs.existsSync(obsoletePath), false, `remove ${obsoletePath}`);
}

assert.equal(packageJSON.scripts["validate:yarn-length-toggle"], undefined);
assert.equal(packageJSON.scripts["validate:yarn-length-scaling"], undefined);
assert.equal(packageJSON.scripts["validate:yarn-length-parameters"] !== undefined, true);

console.log("PASS: yarn-length parameters remain without the removed simulation.");
```

- [ ] **Step 2: Register the new guard**

Add this package script without removing the old simulation scripts yet:

```json
"validate:no-yarn-length-simulation": "node scripts/validate-no-yarn-length-simulation.mjs"
```

- [ ] **Step 3: Run the guard and verify the red state**

Run:

```powershell
npm run validate:no-yarn-length-simulation
```

Expected: exit code `1`. The failure must name an existing yarn-length simulation marker or obsolete file. A passing result is incorrect before Tasks 2–4.

---

### Task 2: Remove the Button and Snapshot Orchestration

**Files:**
- Modify: `src/state.js`
- Modify: `src/components/runSimulation.js`
- Delete: `src/actions/yarnLengthSimulationSnapshot.js`
- Modify: `src/i18n/translations.js`
- Modify: `src/codeGuide/codeGuideDefinitions.json`
- Modify: `src/codeGuide/generatedLines.json`
- Modify: `scripts/validate-code-guide.mjs`

- [ ] **Step 1: Remove request state**

Delete this field from `GLOBAL_STATE` in `src/state.js`:

```js
yarnLengthSimulationRequestId: 0,
```

- [ ] **Step 2: Remove the preview button**

In `simulationView()` delete the complete button whose anchor/class are:

```html
data-code-guide-key="simulation.yarn-length"
class="btn solid yarn-length-sim-action"
```

Keep Relax, Flip, Zoom Out, the scale slider, Zoom In, and Fit unchanged. Remove the yarn-length request condition from Relax so it is disabled only by its ordinary conditions, if any remain.

- [ ] **Step 3: Simplify `runSimulation()` to direct rendering**

Delete the snapshot-controller import and construction. Replace the request consumption, stored pattern selection, snapshot options, and snapshot storage with the direct call:

```js
const simulationResult = simulate(
  GLOBAL_STATE.chart,
  GLOBAL_STATE.yarnSequence,
  GLOBAL_STATE.yarnPalette,
  GLOBAL_STATE.simScale,
  GLOBAL_STATE.yarnPlies,
  {
    texturePerformanceMode: GLOBAL_STATE.texturePerformanceMode,
    texturePreviewInteractionActive:
      GLOBAL_STATE.texturePreviewInteractionActive,
  }
);
({ stopSim, relax } = simulationResult);
```

Remove the special `changes.includes("yarnLengthSimulationRequestId")` branch. Preserve the existing redraw/debounce rules for chart, yarn, texture, scale, and viewport changes.

- [ ] **Step 4: Delete the controller and translations**

Delete `src/actions/yarnLengthSimulationSnapshot.js`. Remove only the four `"simulation.yarnLength"` entries from `src/i18n/translations.js`; retain the `yarnPly.firstLength` and `yarnPly.secondLength` labels.

- [ ] **Step 5: Remove the button from the code guide**

Delete `simulation.yarn-length` from `src/codeGuide/codeGuideDefinitions.json` and from `REQUIRED_KEYS` in `scripts/validate-code-guide.mjs`. Retain `yarn.ply-length`.

Regenerate line numbers:

```powershell
npm run generate:code-guide-lines
```

Expected: exit code `0`; `src/codeGuide/generatedLines.json` no longer contains `simulation.yarn-length`.

- [ ] **Step 6: Run focused checks**

Run:

```powershell
npm run validate:code-guide
npm run validate:yarn-length-parameters
npm run validate:no-yarn-length-simulation
```

Expected: the first two pass. The removal guard still fails because the renderer algorithm and obsolete validators remain.

---

### Task 3: Remove the Curve-Deformation Algorithm

**Files:**
- Modify: `src/simulation/yarnSimulation.js`

- [ ] **Step 1: Remove yarn-length constants and normalization from rendering**

Delete the `MIN_LENGTH_SCALE_Y`, `MAX_LENGTH_SCALE_Y`, all `LENGTH_SHAPE_*` constants, `normalizeLengthScaleY()`, and the local `clamp()` helper. Remove `lengthScaleY` from both objects produced by `normalizeYarnPlies()`. This does not change the stored `GLOBAL_STATE.yarnPlies`; it only makes the render copy ignore the preserved metadata.

- [ ] **Step 2: Remove simulation options and state**

Reduce the `simulate()` option object to:

```js
{
  texturePerformanceMode = TEXTURE_PERFORMANCE_MODES.AUTO,
  texturePreviewInteractionActive = false,
} = {}
```

Delete `isReplayingYarnLengthGeometry`, `activeLengthGeometrySnapshot`, `shouldApplyYarnLengthSimulation()`, and `currentLengthUnitStats`.

- [ ] **Step 3: Replace the deformation block with ordinary path generation**

Delete every yarn-length geometry helper from `getYarnCurvePointPosition()` through `deformYarnCurveForLength()`. Keep endpoint handling and use this path function:

```js
function getYarnLinkEndpointPosition(endpoint) {
  if (typeof endpoint === "object") return endpoint;
  return nodes[endpoint];
}

function getYarnLinkCurvePoints(yarnLink) {
  const index = yarnLink.index;
  return [
    yarnPath[index - 1],
    yarnPath[index],
    yarnPath[index + 1],
    yarnPath[index + 2],
  ];
}

function yarnCurve(yarnLink) {
  const index = yarnLink.index;

  if (index == 0 || index > yarnPathLinks.length - 3) {
    const source = getYarnLinkEndpointPosition(yarnLink.source);
    const target = getYarnLinkEndpointPosition(yarnLink.target);
    if (!source || !target) return "";
    return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
  }

  return openYarnCurve(getYarnLinkCurvePoints(yarnLink));
}
```

Change the drawing call to `const pathData = yarnCurve(link);`; the selected yarn ply still controls color, diameter, texture, and sequence mask.

- [ ] **Step 4: Restore ordinary draw and relaxation behavior**

In `draw()`, remove all length snapshot initialization/replay branches. After `updateNormals()`, proceed directly to sorting and drawing layers.

Reduce `relax()` to start with:

```js
function relax() {
  if (relaxed) return;
```

Keep the existing D3 force configuration unchanged. Return only:

```js
return { relax, stopSim };
```

- [ ] **Step 5: Confirm algorithm identifiers are gone**

Run:

```powershell
rg -n "yarnLengthSimulation|YarnLengthGeometry|LengthShape|LengthGeometry|deformYarnCurveForLength|solveSagittaForTargetLength" src/simulation/yarnSimulation.js src/components/runSimulation.js src/state.js
```

Expected: no matches; `rg` exits `1`.

---

### Task 4: Remove Obsolete Simulation Validators

**Files:**
- Delete: `scripts/validate-yarn-length-simulation-toggle.mjs`
- Delete: `scripts/validate-yarn-length-scaling.mjs`
- Modify: `package.json`
- Test: `scripts/validate-yarn-length-parameters.mjs`
- Test: `scripts/validate-no-yarn-length-simulation.mjs`

- [ ] **Step 1: Delete tests for intentionally removed behavior**

Delete the toggle and scaling validator files. Remove these package scripts:

```json
"validate:yarn-length-scaling": "node scripts/validate-yarn-length-scaling.mjs",
"validate:yarn-length-toggle": "node scripts/validate-yarn-length-simulation-toggle.mjs"
```

Keep:

```json
"validate:yarn-length-parameters": "node scripts/validate-yarn-length-parameters.mjs",
"validate:no-yarn-length-simulation": "node scripts/validate-no-yarn-length-simulation.mjs"
```

- [ ] **Step 2: Verify green for the new contract**

Run:

```powershell
npm run validate:no-yarn-length-simulation
npm run validate:yarn-length-parameters
npm run validate:two-ply-yarn
npm run validate:code-guide
```

Expected: all four commands exit `0`. The first prints `PASS: yarn-length parameters remain without the removed simulation.`

---

### Task 5: Update Maintained Documentation and Run Full Verification

**Files:**
- Modify: `KnitScape_单面布技术文档.md`
- Test: all retained `scripts/validate-*.mjs`
- Test: Vite production build

- [ ] **Step 1: Replace the active Step 16 description**

Keep the Step 15 parameter-contract paragraphs. Replace the current Step 16 algorithm/toggle/snapshot implementation record with a concise dated status:

```markdown
Step 16 移除记录（2026-07-05）：现有纱长曲线形变模型不符合实际针织要求，已删除右侧“模拟”按钮、一次性请求与几何快照链路，以及 `yarnSimulation.js` 中的目标长度和曲线形变算法。左侧两根纱线的纱长滑块、`yarnPlies[index].lengthScaleY`、0.90 - 1.10 范围及 JSON 导入导出继续保留，作为后续新模型的数据接口；当前右侧预览不使用该参数。普通松弛、翻面、缩放、双纱颜色/直径和扫描纹理功能保持不变。
```

Remove current verification lists that name `validate:yarn-length-scaling` or `validate:yarn-length-toggle`; replace them with `validate:no-yarn-length-simulation` and `validate:yarn-length-parameters` where yarn-length verification is relevant. Historical specs/plans under `docs/superpowers/` remain unchanged.

- [ ] **Step 2: Audit the exact retained/removed boundary**

Run:

```powershell
rg -n "lengthScaleY|yarn\.ply-length|yarnPly\.(first|second)Length" src scripts/validate-yarn-length-parameters.mjs
rg -n "yarnLengthSimulationRequestId|yarn-length-sim-action|simulation\.yarnLength|yarnLengthSimulationEnabled|captureYarnLengthGeometry|yarnLengthGeometrySnapshot|deformYarnCurveForLength|solveSagittaForTargetLength" src package.json scripts
```

Expected: the first command finds the retained parameter path. The second command finds no runtime/package/script matches and exits `1`.

- [ ] **Step 3: Run every retained validator**

Run:

```powershell
$package = Get-Content -Raw package.json | ConvertFrom-Json
$validators = $package.scripts.PSObject.Properties |
  Where-Object Name -Like 'validate:*' |
  Select-Object -ExpandProperty Name
foreach ($validator in $validators) {
  npm run $validator
  if ($LASTEXITCODE -ne 0) { throw "Validation failed: $validator" }
}
```

Expected: exit code `0`; every retained validator passes.

- [ ] **Step 4: Build the production bundle**

Run:

```powershell
npm run build
```

Expected: exit code `0`. The existing Vite chunk-size warning is acceptable; build errors are not.

- [ ] **Step 5: Inspect the final scoped diff**

Run:

```powershell
git diff --check
git status --short
git diff -- package.json src/state.js src/components/runSimulation.js src/simulation/yarnSimulation.js src/i18n/translations.js src/codeGuide scripts KnitScape_单面布技术文档.md
```

Expected: no whitespace errors. The diff contains only removal-guard, yarn-length simulation removal, code-guide synchronization, and maintained documentation changes on top of the pre-existing dirty worktree. Do not commit implementation files automatically.
