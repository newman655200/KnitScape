# Left Sidebar Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `leftBar.js` a small composition module while preserving the rendered sidebar and every existing control behavior.

**Architecture:** Extract three concrete lit-html view modules: yarn-length readout, yarn-ply/material controls, and yarn palette controls. Keep repeat insertion in `leftBar.js`, delete the unused private motif-library template, and update validators/code-guide ownership to the files that now render each control.

**Tech Stack:** lit-html 2.7, existing global state/actions, jscolor, Node structural validators, existing code-guide generator.

---

### Task 1: Add the Sidebar Boundary Test

**Files:**
- Create: `scripts/validate-left-sidebar-modules.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing module-boundary validation**

Create `scripts/validate-left-sidebar-modules.mjs`:

```js
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const exists = (file) => fs.existsSync(file);

for (const file of [
  "src/views/yarnLengthReadout.js",
  "src/views/yarnPlyPanel.js",
  "src/views/yarnPicker.js",
]) {
  assert.ok(exists(file), `${file} must exist.`);
}

const leftBar = read("src/views/leftBar.js");
assert.match(leftBar, /import \{ yarnPlyPanel \} from "\.\/yarnPlyPanel"/);
assert.match(leftBar, /import \{ yarnPicker \} from "\.\/yarnPicker"/);
assert.match(leftBar, /\$\{yarnPlyPanel\(\)\}\s*\$\{yarnPicker\(\)\}/);
assert.doesNotMatch(leftBar, /function motifLibrary/);
assert.doesNotMatch(leftBar, /function yarnScanTextureControls/);
assert.doesNotMatch(leftBar, /function yarnPicker/);
assert.doesNotMatch(leftBar, /jscolor/);
assert.doesNotMatch(leftBar, /\bLAYERS\b/);

const readout = read("src/views/yarnLengthReadout.js");
for (const key of [
  "machine.gauge",
  "machine.needle-pitch",
  "yarn.length-current",
]) {
  assert.match(readout, new RegExp(key.replace(".", "\\.")));
}

const plyPanel = read("src/views/yarnPlyPanel.js");
assert.match(
  plyPanel,
  /import \{ yarnLengthReadout \} from "\.\/yarnLengthReadout"/
);
for (const symbol of [
  "yarnPlyPanel",
  "yarnScanTextureControls",
  "importYarnScanTexture",
  "texturePerformanceControls",
]) {
  assert.match(plyPanel, new RegExp(symbol));
}

const picker = read("src/views/yarnPicker.js");
for (const symbol of ["yarnPicker", "deleteColor", "editColor"]) {
  assert.match(picker, new RegExp(symbol));
}

console.log("PASS: left sidebar modules have concrete owners.");
```

- [ ] **Step 2: Add the package script and verify the intended failure**

Add:

```json
"validate:left-sidebar-modules": "node scripts/validate-left-sidebar-modules.mjs"
```

Run:

```powershell
npm run validate:left-sidebar-modules
```

Expected: FAIL because the three view modules do not exist.

- [ ] **Step 3: Commit the failing boundary test**

```powershell
git add package.json scripts/validate-left-sidebar-modules.mjs
git commit -m "test: define left sidebar module boundaries"
```

### Task 2: Extract the Yarn-Length Readout

**Files:**
- Create: `src/views/yarnLengthReadout.js`
- Modify: `src/views/leftBar.js`
- Modify: `src/views/yarnPlyPanel.js` in Task 4; until then import the readout back into `leftBar.js` only for wiring preparation.

- [ ] **Step 1: Create the focused readout module**

Create `src/views/yarnLengthReadout.js` with the current function body unchanged apart from exporting it:

```js
import { html } from "lit-html";
import { GLOBAL_STATE, dispatch } from "../state";
import {
  gaugeToNeedlePitchMm,
  normalizeMachineGauge,
} from "../simulation/yarnLengthMetrics";
import { t } from "../i18n";

export function yarnLengthReadout() {
  const language = GLOBAL_STATE.language;
  const metrics = GLOBAL_STATE.yarnLengthMetrics;
  const gauge = normalizeMachineGauge(GLOBAL_STATE.machineGauge);
  const needlePitchMm = metrics?.needlePitchMm ?? gaugeToNeedlePitchMm(gauge);
  const cmPer100 = metrics?.cmPer100Loops;

  return html`<section class="yarn-length-readout">
    <label
      class="form-control machine-gauge-control"
      data-code-guide-key="machine.gauge">
      <span>${t("machine.gauge", language)}</span>
      <input
        type="number"
        min="1"
        max="120"
        step="1"
        .value=${String(gauge)}
        @change=${(event) =>
          dispatch({
            machineGauge: normalizeMachineGauge(event.target.value),
          })} />
    </label>
    <div
      class="machine-needle-pitch"
      data-code-guide-key="machine.needle-pitch">
      ${t("machine.needlePitch", language)} ${needlePitchMm.toFixed(3)} mm
    </div>
    <div
      class="current-yarn-length"
      data-code-guide-key="yarn.length-current">
      ${t("yarnLength.current", language)}
      ${Number.isFinite(cmPer100) ? cmPer100.toFixed(2) : "--"}
      ${t("yarnLength.cmPer100", language)}
    </div>
  </section>`;
}
```

- [ ] **Step 2: Remove the original private function and its imports**

Delete `yarnLengthReadout()` from `leftBar.js`. Remove `gaugeToNeedlePitchMm` and `normalizeMachineGauge` from that file's imports. The call remains temporarily and will resolve through this import until Task 4 moves it with the ply panel:

```js
import { yarnLengthReadout } from "./yarnLengthReadout";
```

- [ ] **Step 3: Run yarn-length validations**

Update these validators to read `src/views/yarnLengthReadout.js` in addition to `leftBar.js` before running them:

```text
scripts/validate-yarn-length-gauge.mjs
scripts/validate-yarn-length-parameters.mjs
```

Use:

```js
const leftBarSource = [
  read("src/views/leftBar.js"),
  read("src/views/yarnLengthReadout.js"),
].join("\n");
```

Run:

```powershell
npm run validate:yarn-length-gauge
npm run validate:yarn-length-parameters
```

Expected: both commands print `PASS`.

- [ ] **Step 4: Commit the readout extraction**

```powershell
git add src/views/yarnLengthReadout.js src/views/leftBar.js scripts/validate-yarn-length-gauge.mjs scripts/validate-yarn-length-parameters.mjs
git commit -m "refactor: extract yarn length readout"
```

### Task 3: Extract Yarn Palette Controls

**Files:**
- Create: `src/views/yarnPicker.js`
- Modify: `src/views/leftBar.js`
- Modify: `scripts/validate-yarn-sequence-editor.mjs`

- [ ] **Step 1: Move palette behavior behind one view export**

Create `src/views/yarnPicker.js` with these imports:

```js
import { html } from "lit-html";
import jscolor from "@eastdesire/jscolor";
import { GLOBAL_STATE, dispatch } from "../state";
import { Bimp } from "../lib/Bimp";
import { getRandomColor, shuffle } from "../utils";
import { updateYarnPaletteColor } from "../actions/yarnPaletteEditing";
import { buttonIcon, buttonIconSrc } from "./uiButton";
import { t } from "../i18n";
```

Move the current `deleteColor(index)`, `editColor(index)`, and `yarnPicker()` bodies into that file without changing their dispatches, jscolor options, DOM ids, event propagation, or template structure. Change only the final declaration:

```js
export function yarnPicker() {
  // Existing yarnPicker body and template remain byte-for-byte equivalent.
}
```

- [ ] **Step 2: Wire the picker into the composition file**

In `leftBar.js`, import and call the extracted function:

```js
import { yarnPicker } from "./yarnPicker";
```

Delete the three moved functions and remove the imports now owned only by `yarnPicker.js`: `jscolor`, `getRandomColor`, `shuffle`, `updateYarnPaletteColor`, and `buttonIconSrc`. Keep `Bimp` because `addRepeat()` still uses it.

- [ ] **Step 3: Point the palette validator at its owner**

In `scripts/validate-yarn-sequence-editor.mjs`, replace:

```js
const leftBarSource = read("src/views/leftBar.js");
```

with:

```js
const leftBarSource = [
  read("src/views/leftBar.js"),
  read("src/views/yarnPicker.js"),
].join("\n");
```

Run:

```powershell
npm run validate:yarn-sequence-editor
```

Expected: PASS, including selection-versus-color-edit event assertions.

- [ ] **Step 4: Commit the palette extraction**

```powershell
git add src/views/yarnPicker.js src/views/leftBar.js scripts/validate-yarn-sequence-editor.mjs
git commit -m "refactor: extract yarn palette controls"
```

### Task 4: Extract Yarn Ply and Texture Controls

**Files:**
- Create: `src/views/yarnPlyPanel.js`
- Modify: `src/views/leftBar.js`

- [ ] **Step 1: Create the yarn-ply owner with existing dependencies**

Create `src/views/yarnPlyPanel.js` with these imports:

```js
import { html } from "lit-html";
import jscolor from "@eastdesire/jscolor";
import { GLOBAL_STATE, dispatch } from "../state";
import {
  TEXTURE_PERFORMANCE_MODES,
  YARN_TEXTURE_SIZES,
} from "../constants";
import { buttonIcon } from "./uiButton";
import {
  DEFAULT_YARN_SCAN_TEXTURE,
  normalizeYarnTexture,
  processYarnScanDataUrl,
  processYarnScanFile,
  readFileAsDataUrl,
} from "../yarnTexture/yarnScanTexture";
import { t } from "../i18n";
import { yarnLengthReadout } from "./yarnLengthReadout";
```

Move these current declarations into the new file without altering their bodies:

```text
YARN_PLY_LABELS
updateYarnPly
editYarnPlyColor
updateYarnPlyTexture
reprocessYarnScanTexture
clearYarnScanTexture
updateTexturePerformanceMode
defaultYarnTextureOptions
importYarnScanTexture
importPbrMap
yarnScanTextureControls
texturePerformanceControls
yarnPlyPanel
```

Export only the composition function:

```js
export function yarnPlyPanel() {
  const language = GLOBAL_STATE.language;

  return html`<section id="yarn-ply-panel" class="yarn-ply-panel">
    <h3>${t("left.yarnPlyPanel", language)}</h3>
    ${yarnLengthReadout()}
    ${texturePerformanceControls()}
    ${GLOBAL_STATE.yarnPlies.map((ply, index) => {
      // Keep the current yarn-ply card template unchanged.
    })}
  </section>`;
}
```

- [ ] **Step 2: Reduce `leftBar.js` to composition and repeat insertion**

The final imports in `leftBar.js` must be exactly the dependencies it owns:

```js
import { html } from "lit-html";
import { GLOBAL_STATE, dispatch } from "../state";
import { DEFAULT_STITCH_SYMBOL_INDEX } from "../constants";
import { Bimp } from "../lib/Bimp";
import { buttonIcon } from "./uiButton";
import { t } from "../i18n";
import { yarnPlyPanel } from "./yarnPlyPanel";
import { yarnPicker } from "./yarnPicker";
```

Keep only `addRepeat()` and:

```js
export function leftBar() {
  const language = GLOBAL_STATE.language;

  return html`<div id="left-bar" class="scroller">
    <button
      class="btn solid add-repeat"
      data-code-guide-key="left.add-repeat"
      @click=${() => addRepeat()}>
      ${buttonIcon("add", t("left.addRepeat", language))}
    </button>
    ${yarnPlyPanel()} ${yarnPicker()}
  </div>`;
}
```

Delete the unused `motifLibrary()` function and the already-unused `LAYERS` import. Do not create a motif module.

- [ ] **Step 3: Run the boundary validator**

Run:

```powershell
npm run validate:left-sidebar-modules
```

Expected: PASS. If it requires an unused import, fix the validator to check the readout call in `yarnPlyPanel.js`; do not keep dead code.

- [ ] **Step 4: Commit the ply-panel extraction**

```powershell
git add src/views/yarnPlyPanel.js src/views/leftBar.js
git commit -m "refactor: extract yarn ply controls"
```

### Task 5: Update Validator and Code-Guide Ownership

**Files:**
- Modify: `scripts/validate-language-switching.mjs`
- Modify: `scripts/validate-no-yarn-length-simulation.mjs`
- Modify: `scripts/validate-path-uv-yarn-texture.mjs`
- Modify: `scripts/validate-single-face-ui-labels.mjs`
- Modify: `scripts/validate-two-ply-yarn.mjs`
- Modify: `scripts/validate-yarn-length-gauge.mjs`
- Modify: `scripts/validate-yarn-length-parameters.mjs`
- Modify: `scripts/validate-yarn-sequence-editor.mjs`
- Modify: `src/codeGuide/codeGuideDefinitions.json`
- Modify: `src/codeGuide/generatedLines.json`

- [ ] **Step 1: Point each validator at the concrete view owner**

Use the following mapping and retain every existing assertion:

```text
machine.*, yarnLength.*        -> src/views/yarnLengthReadout.js
left.yarnPlyPanel, yarnPly.*,
yarnTexture.*, performance     -> src/views/yarnPlyPanel.js
yarns.*, palette markup        -> src/views/yarnPicker.js
left.addRepeat                 -> src/views/leftBar.js
```

For validators covering the whole sidebar, use:

```js
const leftBarSource = [
  "src/views/leftBar.js",
  "src/views/yarnLengthReadout.js",
  "src/views/yarnPlyPanel.js",
  "src/views/yarnPicker.js",
]
  .map(read)
  .join("\n");
```

In `validate-language-switching.mjs`, replace the one old source expectation with:

```js
["src/views/yarnPlyPanel.js", ["left.yarnPlyPanel", "yarnTexture.import"]],
["src/views/yarnPicker.js", ["yarns.title"]],
["src/views/yarnLengthReadout.js", ["machine.gauge", "yarnLength.current"]],
```

- [ ] **Step 2: Move code-guide entries to their new files**

In `src/codeGuide/codeGuideDefinitions.json`, update only each entry's `file` and any now-stale `changeHint` path:

```text
machine.gauge, machine.needle-pitch, yarn.length-current
  -> src/views/yarnLengthReadout.js

yarn.ply-color through yarn.performance
  -> src/views/yarnPlyPanel.js

palette.edit through palette.randomize
  -> src/views/yarnPicker.js
```

Keep `left.add-repeat` in `src/views/leftBar.js`. Update yarn geometry hints from `src/simulation/yarnSimulation.js` to `src/simulation/yarnPathGeometry.js` and drawing hints to `src/simulation/drawYarnSimulation.js` where applicable.

- [ ] **Step 3: Regenerate source line numbers**

Run:

```powershell
npm run generate:code-guide-lines
npm run validate:code-guide
```

Expected: the generator reports all definitions found and the code-guide validator passes.

- [ ] **Step 4: Run all sidebar-related validators**

Run:

```powershell
npm run validate:left-sidebar-modules
npm run validate:i18n
npm run validate:no-yarn-length-simulation
npm run validate:path-uv-yarn-texture
npm run validate:single-ui
npm run validate:two-ply-yarn
npm run validate:yarn-length-gauge
npm run validate:yarn-length-parameters
npm run validate:yarn-sequence-editor
npm run validate:central-stitch-toolbar
```

Expected: every command prints `PASS` and exits 0.

- [ ] **Step 5: Commit ownership metadata and validators**

```powershell
git add scripts/validate-language-switching.mjs scripts/validate-no-yarn-length-simulation.mjs scripts/validate-path-uv-yarn-texture.mjs scripts/validate-single-face-ui-labels.mjs scripts/validate-two-ply-yarn.mjs scripts/validate-yarn-length-gauge.mjs scripts/validate-yarn-length-parameters.mjs scripts/validate-yarn-sequence-editor.mjs src/codeGuide/codeGuideDefinitions.json src/codeGuide/generatedLines.json
git commit -m "test: follow modular sidebar ownership"
```

### Task 6: Verify the Sidebar Sub-Project

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

- [ ] **Step 3: Confirm no dead extraction imports remain**

Run:

```powershell
rg -n "motifLibrary|\bLAYERS\b|yarnLengthReadout" src/views/leftBar.js
git diff --check
```

Expected: `motifLibrary` and `LAYERS` have no matches; `leftBar.js` does not retain an unused `yarnLengthReadout` import; `git diff --check` reports no errors.
