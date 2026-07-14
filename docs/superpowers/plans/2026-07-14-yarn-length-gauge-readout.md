# Yarn Length Gauge Readout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the current fabric yarn length as `cm / 100 loops` immediately on open, driven by machine gauge / needle pitch, while updating the preview model so yarn length primarily changes loop height.

**Architecture:** Keep the chart as the source of effective stitch count and keep the right preview's left/right padding as visual-only boundary loops. Add pure yarn-length metric helpers, return computed metrics from the simulation, and display them in the left yarn panel. Rename chart size labels to stitch/row counts and add machine gauge input without changing the current import/export surface more than needed.

**Tech Stack:** JavaScript ES modules, lit-html, Vite SSR validation scripts, Canvas/WebGL yarn preview, existing package validators.

---

## Decisions From Discussion

- `横向针数` and `纵向行数` are effective chart stitch columns and rows.
- Right preview keeps one left and one right padding loop for continuity, so 20 effective stitches may display 22 loop positions.
- Padding loops follow yarn-length deformation visually but are not counted in yarn-length statistics.
- Machine gauge `G` means needles per inch. Needle pitch is calculated as `25.4 / G` millimeters per needle.
- Current yarn length is displayed as `cm / 100线圈`.
- First implementation focuses on live readout and corrected deformation direction. Direct target yarn-length solving in centimeters is a later phase.
- Yarn length changes should mainly alter Y/loop height and total fabric height. X changes should be a small compensation only.

---

## File Map

**Create**

- `src/simulation/yarnLengthMetrics.js`: pure gauge, needle-pitch, and yarn-length metric helpers.
- `scripts/validate-yarn-length-gauge.mjs`: validator for gauge conversion, metric math, UI wiring, and padding-exclusion source contracts.

**Modify**

- `package.json`: add `validate:yarn-length-gauge`.
- `src/constants.js`: add default machine gauge and machine gauge bounds.
- `src/state.js`: store `machineGauge` and `yarnLengthMetrics`.
- `src/simulation/rowLengthLoopModel.js`: make X compensation small and remove direct Y movement from neck-point compensation.
- `src/simulation/yarnSimulation.js`: scale row pitch primarily by `lengthScaleY`, calculate effective yarn-length metrics excluding X padding, and return metrics.
- `src/components/runSimulation.js`: pass `machineGauge` into simulation and dispatch returned metrics without triggering another simulation.
- `src/views/leftBar.js`: render machine gauge, computed needle pitch, and current yarn-length readout.
- `src/views/chartEditorToolbar.js`: keep behavior but use stitch/row wording.
- `src/i18n/translations.js`: add labels in zh-CN, zh-TW, en, vi.
- `src/codeGuide/codeGuideDefinitions.json`: update wording for chart dimensions and add yarn metric controls.
- `scripts/validate-code-guide.mjs`: include new code-guide keys.
- `scripts/validate-language-switching.mjs`: include new translation keys.
- `scripts/validate-yarn-length-parameters.mjs`: include machine-gauge state and readout contracts.
- `scripts/validate-row-length-loop-model.mjs`: update expected neck movement semantics.
- `KnitScape_单面布技术文档.md`: document the current yarn-length/gauge model.

---

### Task 1: Add Failing Gauge and Yarn-Length Validator

**Files:**

- Create: `scripts/validate-yarn-length-gauge.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add the validator script**

Create a validator that imports future helpers and checks:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DEFAULT_MACHINE_GAUGE,
  cmPer100Loops,
  gaugeToNeedlePitchMm,
  normalizeMachineGauge,
} from "../src/simulation/yarnLengthMetrics.js";

const read = (file) => fs.readFileSync(file, "utf8");
const packageJSON = JSON.parse(read("package.json"));

assert.equal(
  packageJSON.scripts["validate:yarn-length-gauge"],
  "node --experimental-default-type=module scripts/validate-yarn-length-gauge.mjs"
);

assert.equal(DEFAULT_MACHINE_GAUGE, 32);
assert.equal(normalizeMachineGauge(64), 64);
assert.equal(normalizeMachineGauge("bad"), 32);
assert.ok(Math.abs(gaugeToNeedlePitchMm(32) - 0.79375) < 1e-6);
assert.ok(Math.abs(gaugeToNeedlePitchMm(64) - 0.396875) < 1e-6);
assert.ok(Math.abs(cmPer100Loops({ totalPathLengthStitchUnits: 420, effectiveLoopCount: 84, gauge: 32 }) - 39.6875) < 1e-6);

const stateSource = read("src/state.js");
assert.match(stateSource, /machineGauge:\s*DEFAULT_MACHINE_GAUGE/);
assert.match(stateSource, /yarnLengthMetrics:\s*null/);

const simulationSource = read("src/simulation/yarnSimulation.js");
assert.match(simulationSource, /machineGauge/);
assert.match(simulationSource, /effectiveLoopCount:\s*pattern\.width\s*\*\s*pattern\.height/);
assert.match(simulationSource, /X_PADDING/);
assert.match(simulationSource, /pointInEffectiveNeedles/);
assert.match(simulationSource, /stitchHeight\s*=\s*baseStitchHeight\s*\*\s*primaryLengthScaleY/);

const leftBarSource = read("src/views/leftBar.js");
for (const token of [
  "machine.gauge",
  "machine.needlePitch",
  "yarnLength.current",
  "yarnLength.cmPer100",
]) {
  assert.match(leftBarSource, new RegExp(token));
}

console.log("PASS: yarn length gauge readout is configured.");
```

- [ ] **Step 2: Register the command**

Add:

```json
"validate:yarn-length-gauge": "node --experimental-default-type=module scripts/validate-yarn-length-gauge.mjs"
```

- [ ] **Step 3: Run and verify red**

Run:

```powershell
npm run validate:yarn-length-gauge
```

Expected: failure because `src/simulation/yarnLengthMetrics.js` does not exist yet.

---

### Task 2: Implement Pure Gauge and Yarn-Length Math

**Files:**

- Create: `src/simulation/yarnLengthMetrics.js`
- Test: `scripts/validate-yarn-length-gauge.mjs`

- [ ] **Step 1: Implement helpers**

Create:

```js
export const DEFAULT_MACHINE_GAUGE = 32;
export const MIN_MACHINE_GAUGE = 1;
export const MAX_MACHINE_GAUGE = 120;

export function normalizeMachineGauge(value, fallback = DEFAULT_MACHINE_GAUGE) {
  const numeric = Number(value);
  const fallbackGauge = Number.isFinite(Number(fallback))
    ? Number(fallback)
    : DEFAULT_MACHINE_GAUGE;
  if (!Number.isFinite(numeric) || numeric <= 0) return fallbackGauge;
  return Math.max(MIN_MACHINE_GAUGE, Math.min(MAX_MACHINE_GAUGE, numeric));
}

export function gaugeToNeedlePitchMm(gauge) {
  return 25.4 / normalizeMachineGauge(gauge);
}

export function cmPer100Loops({
  totalPathLengthStitchUnits,
  effectiveLoopCount,
  gauge,
}) {
  const loopCount = Math.max(1, Number(effectiveLoopCount) || 1);
  const averageLoopLengthStitchUnits =
    Math.max(0, Number(totalPathLengthStitchUnits) || 0) / loopCount;
  return (averageLoopLengthStitchUnits * gaugeToNeedlePitchMm(gauge) * 100) / 10;
}
```

- [ ] **Step 2: Run and verify partial green/red**

Run:

```powershell
npm run validate:yarn-length-gauge
```

Expected: helper math passes, source wiring checks still fail.

---

### Task 3: Add State, Simulation Metrics, and Y-Primary Geometry

**Files:**

- Modify: `src/constants.js`
- Modify: `src/state.js`
- Modify: `src/simulation/rowLengthLoopModel.js`
- Modify: `src/simulation/yarnSimulation.js`
- Modify: `src/components/runSimulation.js`
- Modify: `scripts/validate-row-length-loop-model.mjs`

- [ ] **Step 1: Add state constants**

Import and re-export machine gauge defaults from `src/constants.js`, then initialize:

```js
machineGauge: DEFAULT_MACHINE_GAUGE,
yarnLengthMetrics: null,
```

- [ ] **Step 2: Make neck X compensation small**

Change `moveNeckPoint()` so it only applies a small X compensation and no direct Y shift:

```js
export function lengthScaleToXCompensation(coefficient, strength = 0.2) {
  return 1 + (coefficient - 1) * strength;
}

export function moveNeckPoint(point, centerX, coefficient, verticalSpan = 0, movable = true) {
  if (!movable) return { ...point };
  return moveNeckPointX(
    point,
    centerX,
    lengthScaleToXCompensation(coefficient)
  );
}
```

Update validator expectation:

```js
assert.deepEqual(
  moveNeckPoint({ x: -0.5, y: 0 }, 0, 0.8, 2),
  { x: -0.48, y: 0 }
);
```

- [ ] **Step 3: Scale row pitch by yarn length**

In `layoutNodes()`:

```js
const baseStitchHeight = stitchWidth / STITCH_RATIO;
stitchHeight = baseStitchHeight * primaryLengthScaleY;
```

Use `stitchHeight` for row positions and centering.

- [ ] **Step 4: Exclude padding from metrics**

Add helper checks in `yarnSimulation.js`:

```js
function pointInEffectiveNeedles(point) {
  const stitchColumn = Math.floor(point.i / 2);
  return (
    stitchColumn >= X_PADDING &&
    stitchColumn < X_PADDING + pattern.width
  );
}

function linkInEffectiveNeedles(link) {
  return (
    pointInEffectiveNeedles(yarnPath[link.index]) &&
    pointInEffectiveNeedles(yarnPath[link.index + 1])
  );
}
```

After resolved paths are built, sum only effective links:

```js
const totalPathLengthStitchUnits = yarnPathLinks.reduce((total, link) => {
  if (!linkInEffectiveNeedles(link)) return total;
  return total + pathDataLength(resolvedPathByLink.get(link.index), stitchWidth);
}, 0);
const effectiveLoopCount = pattern.width * pattern.height;
const yarnLengthMetrics = {
  gauge: normalizeMachineGauge(machineGauge),
  needlePitchMm: gaugeToNeedlePitchMm(machineGauge),
  totalPathLengthStitchUnits,
  effectiveLoopCount,
  cmPer100Loops: cmPer100Loops({
    totalPathLengthStitchUnits,
    effectiveLoopCount,
    gauge: machineGauge,
  }),
};
```

- [ ] **Step 5: Return and store metrics**

Return `yarnLengthMetrics` from `simulate()` and dispatch it in `runSimulation()`:

```js
dispatch({ yarnLengthMetrics: simulationResult.yarnLengthMetrics });
```

Do not include `yarnLengthMetrics` in the simulation-trigger change list.

- [ ] **Step 6: Verify**

Run:

```powershell
npm run validate:yarn-length-gauge
npm run validate:row-length-loop-model
```

Expected: both pass.

---

### Task 4: Add UI Readout and Rename Dimension Labels

**Files:**

- Modify: `src/views/leftBar.js`
- Modify: `src/views/chartEditorToolbar.js`
- Modify: `src/i18n/translations.js`
- Modify: `src/codeGuide/codeGuideDefinitions.json`
- Modify: `scripts/validate-code-guide.mjs`
- Modify: `scripts/validate-language-switching.mjs`
- Modify: `scripts/validate-yarn-length-parameters.mjs`
- Regenerate: `src/codeGuide/generatedLines.json`

- [ ] **Step 1: Render machine gauge and yarn-length readout**

Add a compact block above yarn ply cards:

```js
function yarnLengthReadout() {
  const language = GLOBAL_STATE.language;
  const metrics = GLOBAL_STATE.yarnLengthMetrics;
  const gauge = normalizeMachineGauge(GLOBAL_STATE.machineGauge);
  const needlePitchMm = metrics?.needlePitchMm ?? gaugeToNeedlePitchMm(gauge);
  const cmPer100 = metrics?.cmPer100Loops;

  return html`<section class="yarn-length-readout">
    <label class="form-control machine-gauge-control" data-code-guide-key="machine.gauge">
      <span>${t("machine.gauge", language)}</span>
      <input
        type="number"
        min="1"
        max="120"
        step="1"
        .value=${String(gauge)}
        @change=${(event) =>
          dispatch({ machineGauge: normalizeMachineGauge(event.target.value) })} />
    </label>
    <div class="machine-needle-pitch" data-code-guide-key="machine.needle-pitch">
      ${t("machine.needlePitch", language)} ${needlePitchMm.toFixed(3)} mm
    </div>
    <div class="current-yarn-length" data-code-guide-key="yarn.length-current">
      ${t("yarnLength.current", language)}
      ${Number.isFinite(cmPer100) ? cmPer100.toFixed(2) : "--"}
      ${t("yarnLength.cmPer100", language)}
    </div>
  </section>`;
}
```

- [ ] **Step 2: Rename chart dimensions**

Change translation values for `taskbar.width` and `taskbar.height` to mean `横向针数` and `纵向行数`.

- [ ] **Step 3: Add i18n and code-guide keys**

Add keys:

```text
machine.gauge
machine.needlePitch
yarnLength.current
yarnLength.cmPer100
```

Add code-guide keys:

```text
machine.gauge
machine.needle-pitch
yarn.length-current
```

- [ ] **Step 4: Verify UI contracts**

Run:

```powershell
npm run generate:code-guide-lines
npm run validate:yarn-length-gauge
npm run validate:yarn-length-parameters
npm run validate:i18n
npm run validate:code-guide
```

Expected: all pass.

---

### Task 5: Update Documentation and Run Full Verification

**Files:**

- Modify: `KnitScape_单面布技术文档.md`
- Test: all validators and production build

- [ ] **Step 1: Update documentation**

Add a section describing:

```text
当前纱长 = cm / 100线圈
机号 G = 每英寸针数
针距 mm = 25.4 / G
左右 padding 边界圈参与视觉但不参与统计
纱长变长时 Y 向为主、总高度变高；变短时 Y 向变矮、布片更密
```

- [ ] **Step 2: Full verification**

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
npm run build
git diff --check
git status --short --branch
```

Expected:

- all validators pass
- production build exits 0
- diff check exits 0
- status preserves unrelated `README.md` deletion and local untracked directories unless the user separately decides their fate

- [ ] **Step 3: Commit**

Commit only files changed for this feature:

```powershell
git add package.json scripts/validate-yarn-length-gauge.mjs src/simulation/yarnLengthMetrics.js src/constants.js src/state.js src/simulation/rowLengthLoopModel.js src/simulation/yarnSimulation.js src/components/runSimulation.js src/views/leftBar.js src/views/chartEditorToolbar.js src/i18n/translations.js src/codeGuide/codeGuideDefinitions.json src/codeGuide/generatedLines.json scripts/validate-code-guide.mjs scripts/validate-language-switching.mjs scripts/validate-yarn-length-parameters.mjs scripts/validate-row-length-loop-model.mjs "KnitScape_单面布技术文档.md" docs/superpowers/plans/2026-07-14-yarn-length-gauge-readout.md
git commit -m "feat: show gauge-based yarn length readout"
```

---

## Self-Review

- Spec coverage: The plan covers live yarn-length readout, machine gauge conversion, padding exclusion, Y-primary loop deformation, chart label renaming, documentation, and verification.
- Placeholder scan: No `TBD`, `TODO`, or unspecified test commands remain.
- Scope control: Direct target yarn-length solving in centimeters is intentionally deferred so the first version can calibrate the readout against现场数据.
