# KnitScape Single-Face-Only Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all double-face, spacer-air-layer, and Three.js functionality and artifacts while preserving the current single-face editor, simulation, imports, exports, localization, offline packaging, and existing in-progress changes.

**Architecture:** Collapse the current mode-switched application into one unconditional single-face path. Add a repository guard that fails while double-face runtime paths, state, dependencies, styles, or artifacts remain, then make it pass by deleting the isolated experiment and simplifying the shared entry points.

**Tech Stack:** JavaScript ES modules, Lit HTML, D3, Canvas 2D, Vite, Node.js validation scripts, PowerShell for verified local artifact removal.

---

## File Map

**Create**

- `scripts/validate-single-only.mjs`: fails when removed runtime paths, state keys, package entries, CSS, user-facing documentation, or generated artifacts return.

**Modify**

- `package.json`: replace the double-face validation command with `validate:single-only`; remove `three`.
- `package-lock.json`: remove the root `three` requirement and `node_modules/three` package record.
- `src/constants.js`: remove `FABRIC_MODES`.
- `src/state.js`: remove double-face initialization and mode state.
- `src/views/view.js`: render the single-face chart editor unconditionally.
- `src/views/taskbar.js`: remove the redundant one-option fabric-mode control.
- `src/components/runSimulation.js`: run only the single-face D3/Canvas simulation.
- `src/actions/importers.js`: stop writing a fabric mode when loading or creating projects.
- `src/i18n/translations.js`: remove the unused mode-control translation keys in all four languages.
- `styles.css`: remove the double-face editor and WebGL preview rules.
- `KnitScape_单面布技术文档.md`: describe a single application, without obsolete dual-project architecture.
- `docs/针织实验室_单面布功能需求文档.md`: remove obsolete exclusions and Three.js roadmap wording.

**Delete**

- `src/doubleFace/centerline.js`
- `src/doubleFace/constants.js`
- `src/doubleFace/index.js`
- `src/doubleFace/loopGraph.js`
- `src/doubleFace/pattern.js`
- `src/doubleFace/samples.js`
- `src/doubleFace/state.js`
- `src/doubleFace/traversal.js`
- `src/doubleFace/tubeGeometry.js`
- `src/views/doubleFaceEditor.js`
- `src/components/doubleFacePreview3d.js`
- `scripts/validate-double-face-foundation.mjs`
- `KnitScape_双面布技术文档.md`
- `outputs/`
- `.tmp-chrome-step42/`, `.tmp-chrome-step42-debug/`, `.tmp-chrome-step42-debug2/`
- `.tmp-chrome-step43/`, `.tmp-chrome-step44/`
- `.tmp-chrome-step45/`, `.tmp-chrome-step45-debug/`

### Task 1: Add the Single-Only Guard and Prove It Fails

**Files:**

- Create: `scripts/validate-single-only.mjs`
- Modify: `package.json`
- Test: `scripts/validate-single-only.mjs`

- [ ] **Step 1: Create the validation script**

Create `scripts/validate-single-only.mjs` with this complete content:

```js
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const resolve = (...parts) => path.join(root, ...parts);
const read = (file) => fs.readFileSync(resolve(file), "utf8");

const forbiddenPaths = [
  "src/doubleFace",
  "src/views/doubleFaceEditor.js",
  "src/components/doubleFacePreview3d.js",
  "scripts/validate-double-face-foundation.mjs",
  "KnitScape_双面布技术文档.md",
  "outputs",
];

for (const file of forbiddenPaths) {
  if (fs.existsSync(resolve(file))) failures.push(`remove obsolete path: ${file}`);
}

for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.isDirectory() && entry.name.startsWith(".tmp-chrome-step")) {
    failures.push(`remove obsolete browser profile: ${entry.name}`);
  }
}

const runtimeFiles = [
  "src/constants.js",
  "src/state.js",
  "src/views/view.js",
  "src/views/taskbar.js",
  "src/components/runSimulation.js",
  "src/actions/importers.js",
  "src/i18n/translations.js",
  "styles.css",
];
const runtimePattern =
  /doubleFace|double-face|FABRIC_MODES|fabricMode|renderDoubleFace|from\s+["']three["']/i;

for (const file of runtimeFiles) {
  if (runtimePattern.test(read(file))) {
    failures.push(`remove double-face runtime reference from ${file}`);
  }
}

const packageJson = JSON.parse(read("package.json"));
if (packageJson.dependencies?.three) failures.push("remove dependency: three");
if (packageJson.scripts?.["validate:double-face"]) {
  failures.push("remove npm script: validate:double-face");
}

for (const file of [
  "KnitScape_单面布技术文档.md",
  "docs/针织实验室_单面布功能需求文档.md",
]) {
  if (/双面布|空气层|Fraunhofer|Three\.js|double-face|fabricMode/i.test(read(file))) {
    failures.push(`remove obsolete double-face wording from ${file}`);
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}

console.log("PASS: repository contains only the single-face application.");
```

- [ ] **Step 2: Register the validator**

In `package.json`, replace:

```json
"validate:double-face": "node --experimental-default-type=module scripts/validate-double-face-foundation.mjs",
```

with:

```json
"validate:single-only": "node scripts/validate-single-only.mjs",
```

- [ ] **Step 3: Run the validator and verify the red state**

Run:

```powershell
npm run validate:single-only
```

Expected: exit code `1`, with failures for `src/doubleFace`, `three`, double-face runtime references, the double-face document, `outputs`, and `.tmp-chrome-step*` profiles. A passing result is incorrect at this stage.

### Task 2: Collapse Runtime Code to the Single-Face Path

**Files:**

- Modify: `src/constants.js`
- Modify: `src/state.js`
- Modify: `src/views/view.js`
- Modify: `src/views/taskbar.js`
- Modify: `src/components/runSimulation.js`
- Modify: `src/actions/importers.js`
- Modify: `src/i18n/translations.js`
- Modify: `styles.css`
- Delete: `src/doubleFace/*.js`
- Delete: `src/views/doubleFaceEditor.js`
- Delete: `src/components/doubleFacePreview3d.js`

- [ ] **Step 1: Remove mode constants and state**

Delete `FABRIC_MODES` from `src/constants.js`. In `src/state.js`, delete the `createDefaultDoubleFaceState` import, remove `FABRIC_MODES` from the constants import, and delete these state fields:

```js
fabricMode: FABRIC_MODES.SINGLE,
doubleFaceState: createDefaultDoubleFaceState(),
```

- [ ] **Step 2: Render the chart editor unconditionally**

In `src/views/view.js`, remove the `FABRIC_MODES` and `doubleFaceEditor` imports. Replace the conditional contents of `#desktop` with:

```js
<div id="desktop">
  ${when(GLOBAL_STATE.editingRepeat > -1, repeatTools)}
  <div
    id="canvas-transform-group"
    style="transform: translate(${Math.floor(
      GLOBAL_STATE.chartPan.x
    )}px, ${Math.floor(GLOBAL_STATE.chartPan.y)}px);">
    <div id="yarn-sequence">
      <canvas id="yarn-sequence-canvas"></canvas>
    </div>
    <canvas id="yarn-color-canvas"></canvas>
    <canvas id="symbol-canvas"></canvas>
    <canvas id="grid" class="grid-canvas"></canvas>
    ${selectedChartCell()}
    ${repeatCanvas()}
  </div>
</div>
```

- [ ] **Step 3: Remove the redundant mode control**

In `src/views/taskbar.js`, remove the `FABRIC_MODES` import and the complete `fabric-mode-controls` block immediately between `site-brand` and `chart-size-controls`. Keep the product title `taskbar.title`, which already identifies the single-face application.

In each language block of `src/i18n/translations.js`, remove:

```text
"taskbar.fabricMode": "布种模式",
"taskbar.singleFace": "单面布",
"taskbar.fabricMode": "布種模式",
"taskbar.singleFace": "單面布",
"taskbar.fabricMode": "Fabric mode",
"taskbar.singleFace": "Single Jersey",
"taskbar.fabricMode": "Loại vải",
"taskbar.singleFace": "Vải một mặt",
```

- [ ] **Step 4: Make simulation unconditional**

In `src/components/runSimulation.js`:

- change the constants import to `import { MIN_SIM_SCALE, MAX_SIM_SCALE } from "../constants";`
- delete the `renderDoubleFacePreview3d` import
- replace `run()` with the existing contents of the former `FABRIC_MODES.SINGLE` branch, without its `if` wrapper or fallback canvas clearing
- remove `"fabricMode"` and `"doubleFaceState"` from the `found` change-key array
- remove `clearSimulationCanvases()`, which becomes unused

The resulting `run()` body must retain this data flow unchanged:

```js
const simulationRequest = yarnLengthSnapshotController.consume(
  GLOBAL_STATE.yarnLengthSimulationRequestId
);
const storedSnapshot = simulationRequest.snapshot;
const simulationPattern = storedSnapshot
  ? Bimp.fromJSON(storedSnapshot.pattern)
  : GLOBAL_STATE.chart;
const simulationResult = simulate(
  simulationPattern,
  GLOBAL_STATE.yarnSequence,
  GLOBAL_STATE.yarnPalette,
  GLOBAL_STATE.simScale,
  GLOBAL_STATE.yarnPlies,
  {
    texturePerformanceMode: GLOBAL_STATE.texturePerformanceMode,
    texturePreviewInteractionActive:
      GLOBAL_STATE.texturePreviewInteractionActive,
    yarnLengthSimulationEnabled:
      simulationRequest.capture || Boolean(storedSnapshot),
    captureYarnLengthGeometry: simulationRequest.capture,
    yarnLengthGeometrySnapshot: storedSnapshot?.geometry || null,
  }
);
```

Keep snapshot storage and `({ stopSim, relax } = simulationResult);` exactly as in the current single-face branch.

- [ ] **Step 5: Stop import/new actions from writing mode state**

In `src/actions/importers.js`, remove `FABRIC_MODES` from the constants import and delete both occurrences of:

```js
fabricMode: FABRIC_MODES.SINGLE,
```

- [ ] **Step 6: Delete double-face runtime files**

Use `apply_patch` to delete the eleven isolated double-face JavaScript files listed in the File Map. After deletion, `src/doubleFace/` must no longer exist.

- [ ] **Step 7: Remove double-face CSS**

From `styles.css`, delete only:

- `#double-face-3d-preview` and its `canvas` rule
- the complete block from `#double-face-editor` through the `@media (max-width: 900px)` rule ending with `.double-face-bed-stack`

Retain the surrounding single-face `#back/#mid/#front`, edit pane, desktop, canvas, and repeat-canvas rules.

- [ ] **Step 8: Check runtime references**

Run:

```powershell
rg -n -i 'doubleFace|double-face|FABRIC_MODES|fabricMode|renderDoubleFace|from ["'']three["'']' src styles.css
```

Expected: no matches and `rg` exit code `1`.

### Task 3: Remove Dependency, Documents, Screenshots, and Temporary Profiles

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `KnitScape_单面布技术文档.md`
- Modify: `docs/针织实验室_单面布功能需求文档.md`
- Delete: `scripts/validate-double-face-foundation.mjs`
- Delete: `KnitScape_双面布技术文档.md`
- Delete: `outputs/`
- Delete: `.tmp-chrome-step*/`

- [ ] **Step 1: Remove Three.js package records**

Delete this `package.json` dependency:

```json
"three": "^0.184.0",
```

Delete the matching root dependency line and complete `node_modules/three` record from `package-lock.json`:

```json
"three": "^0.184.0",
```

```json
"node_modules/three": {
  "version": "0.184.0",
  "resolved": "https://registry.npmjs.org/three/-/three-0.184.0.tgz",
  "integrity": "sha512-wtTRjG92pM5eUg/KuUnHsqSAlPM296brTOcLgMRqEeylYTh/CdtvKUvCyyCQTzFuStieWxvZb8mVTMvdPyUpxg==",
  "license": "MIT"
},
```

Remove the installed package with:

```powershell
npm prune --ignore-scripts
```

Expected: exit code `0`; `npm ls three --depth=0` subsequently reports `(empty)` with nonzero status because `three` is no longer installed.

- [ ] **Step 2: Delete the dedicated validator and document**

Use `apply_patch` to delete:

```text
scripts/validate-double-face-foundation.mjs
KnitScape_双面布技术文档.md
```

- [ ] **Step 3: Rewrite obsolete single-face technical-document framing**

In `KnitScape_单面布技术文档.md`:

- change the opening positioning sentence to `单面布项目作为独立的针织图案编辑与纱线预览工具推进。`
- remove the sentence listing double-face, air-layer, and Fraunhofer exclusions
- remove `fabricMode: single` from the default contract
- replace the entire “单面布项目拆分约定” section with:

````markdown
## 单面布模块边界

项目保持以下独立闭环：

```text
单面布状态
单面图案编辑器
单面 preview renderer
单面 PBR exporter
颜色与图片处理工具
文件导入导出工具
yarn / material 通用定义
```
````

- remove historical lines and roadmap items that mention dual-project mode switching, `double-face app`, `fabricMode`, double-face, air-layer, Fraunhofer, or Three.js
- retain all descriptions of D3/Canvas simulation, scanned yarn texture, PBR export direction, localization, offline packaging, and single-face verification

In `docs/针织实验室_单面布功能需求文档.md`, remove the four obsolete lines containing `Three.js` or `双面布`; keep the surrounding single-face requirements grammatically complete.

- [ ] **Step 4: Verify artifact targets before recursive deletion**

Run this PowerShell safety check from the repository root:

```powershell
$repo = (Resolve-Path .).Path
$relativeTargets = @(
  'outputs',
  '.tmp-chrome-step42',
  '.tmp-chrome-step42-debug',
  '.tmp-chrome-step42-debug2',
  '.tmp-chrome-step43',
  '.tmp-chrome-step44',
  '.tmp-chrome-step45',
  '.tmp-chrome-step45-debug'
)
$targets = $relativeTargets | ForEach-Object { [IO.Path]::GetFullPath((Join-Path $repo $_)) }
$prefix = $repo.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
foreach ($target in $targets) {
  if (-not $target.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Unsafe deletion target: $target"
  }
  if (Test-Path -LiteralPath $target) { Write-Output $target }
}
```

Expected: every printed path is inside `C:\Users\liuchen\Desktop\GitHub\knitscape` and corresponds exactly to `outputs` or a `.tmp-chrome-step*` directory.

- [ ] **Step 5: Delete the verified artifacts in PowerShell only**

In the same PowerShell session, using the already verified `$targets`:

```powershell
foreach ($target in $targets) {
  if (Test-Path -LiteralPath $target) {
    Remove-Item -LiteralPath $target -Recurse -Force
  }
}
```

Do not delete `.vite-5181.pid`, `.vite-yarn-length-one-shot.pid`, or unrelated files.

- [ ] **Step 6: Run the single-only validator and verify green**

Run:

```powershell
npm run validate:single-only
```

Expected: exit code `0` and `PASS: repository contains only the single-face application.`

### Task 4: Run Full Single-Face Regression Verification

**Files:**

- Test: all retained `scripts/validate-*.mjs`
- Test: Vite production build

- [ ] **Step 1: Enumerate retained validation commands**

Run:

```powershell
$package = Get-Content -Raw package.json | ConvertFrom-Json
$package.scripts.PSObject.Properties |
  Where-Object Name -Like 'validate:*' |
  Select-Object -ExpandProperty Name
```

Expected: the list contains `validate:single-only` and all existing single-face validators, but not `validate:double-face`.

- [ ] **Step 2: Run every retained validator**

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

Expected: exit code `0`; every validator prints its PASS/success message.

- [ ] **Step 3: Build the production application**

Run:

```powershell
npm run build
```

Expected: exit code `0` and a generated `dist/` bundle. The existing Vite chunk-size warning is acceptable; errors are not.

- [ ] **Step 4: Perform the final source and artifact audit**

Run:

```powershell
npm run validate:single-only
rg -n -i 'doubleFace|double-face|FABRIC_MODES|fabricMode|renderDoubleFace|from ["'']three["'']' src styles.css package.json package-lock.json
Get-ChildItem -Force -Directory | Where-Object Name -Like '.tmp-chrome-step*'
Test-Path -LiteralPath outputs
npm ls three --depth=0
git diff --check
git status --short
```

Expected:

- the validator passes
- `rg` finds no maintained runtime/package references
- no `.tmp-chrome-step*` directory is listed
- `Test-Path outputs` prints `False`
- `npm ls three --depth=0` shows `(empty)`
- `git diff --check` exits `0`
- `git status --short` shows the preserved pre-existing work plus the intentional cleanup, with no unexpected files

- [ ] **Step 5: Preserve the dirty worktree boundary**

Do not create an implementation commit automatically. Several modified files predate this cleanup, so committing whole files would mix unrelated user work into the removal commit. Report the exact diff and verification results to the user; commit only if the user explicitly asks afterward.
