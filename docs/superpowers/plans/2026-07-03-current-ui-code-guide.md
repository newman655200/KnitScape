# Current UI Code Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `?codeGuide=1` mode to the current KnitScape application so every visible control opens an in-page source-location and modification guide without executing its normal action.

**Architecture:** Keep the current Lit UI as the only interface. A query-parameter gate selects normal mode or guide mode; guide mode skips normal input listener registration, captures remaining template events, and renders a Lit-based source drawer from a centralized key map. Source line numbers are generated from stable `data-code-guide-key` anchors and validated against the current repository.

**Tech Stack:** JavaScript ES modules, Lit HTML, Vite, Node.js validation scripts, existing CSS design tokens.

---

## File structure

**Create**

- `src/codeGuide/mode.js` — query-parameter gate with a testable pure input.
- `src/codeGuide/codeGuideState.js` — selected guide key only; no business-state coupling.
- `src/codeGuide/codeGuideDefinitions.json` — source files, anchors, symbols, descriptions, and modification instructions.
- `src/codeGuide/generatedLines.json` — generated exact line numbers committed with the feature.
- `src/codeGuide/codeGuideMap.js` — combines definitions and generated lines and builds VS Code links.
- `src/codeGuide/codeGuideEvents.js` — capture-phase guide-mode event interception.
- `src/codeGuide/codeGuideOverlay.js` — Lit badge, drawer, copy fallback, and close behavior.
- `scripts/generate-code-guide-lines.mjs` — scans stable anchors and writes current line numbers.
- `scripts/validate-code-guide.mjs` — verifies APIs, key coverage, anchors, lines, and normal-mode isolation.

**Modify**

- `src/index.js` — initialize either normal input listeners or guide listeners.
- `src/views/view.js` — render the guide overlay and mark central canvas regions.
- `src/views/taskbar.js` — mark current taskbar controls.
- `src/views/leftBar.js` — mark current yarn, texture, stitch, palette, and repeat controls.
- `src/views/repeatTools.js` — mark repeat edit controls.
- `src/views/repeatCanvas.js` — mark repeat canvases and visible area drag handles.
- `src/views/chartTools.js` — mark chart navigation controls.
- `src/components/runSimulation.js` — mark current preview and preview controls.
- `styles.css` — append isolated `.code-guide-*` styles.
- `package.json` — add generate and validate scripts.

Do not modify knitting simulation, yarn generation, export formats, or the existing user-owned changes outside these files.

### Task 1: Add the mode, guide state, metadata contract, and first failing validator

**Files:**

- Create: `scripts/validate-code-guide.mjs`
- Create: `src/codeGuide/mode.js`
- Create: `src/codeGuide/codeGuideState.js`
- Create: `src/codeGuide/codeGuideDefinitions.json`
- Create: `src/codeGuide/generatedLines.json`
- Create: `src/codeGuide/codeGuideMap.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing core validator**

Create `scripts/validate-code-guide.mjs` with these initial checks:

```js
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const requiredFiles = [
  "src/codeGuide/mode.js",
  "src/codeGuide/codeGuideState.js",
  "src/codeGuide/codeGuideDefinitions.json",
  "src/codeGuide/generatedLines.json",
  "src/codeGuide/codeGuideMap.js",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}

if (fs.existsSync(path.join(root, "src/codeGuide/mode.js"))) {
  const mode = read("src/codeGuide/mode.js");
  if (!mode.includes('params.get("codeGuide") === "1"')) {
    failures.push("mode must require codeGuide=1");
  }
}

if (fs.existsSync(path.join(root, "src/codeGuide/codeGuideMap.js"))) {
  const map = read("src/codeGuide/codeGuideMap.js");
  for (const token of ["CODE_GUIDE_MAP", "getCodeGuideEntry", "createVSCodeHref"]) {
    if (!map.includes(token)) failures.push(`map API missing ${token}`);
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}

console.log("PASS: code guide core contract is present.");
```

- [ ] **Step 2: Run the validator and verify RED**

Run: `node scripts/validate-code-guide.mjs`

Expected: exit 1 with missing `src/codeGuide/*` files.

- [ ] **Step 3: Implement the mode and isolated state**

Create `src/codeGuide/mode.js`:

```js
export function isCodeGuideMode(search) {
  const source = search ?? window.location.search;
  const params = new URLSearchParams(source);
  return params.get("codeGuide") === "1";
}
```

Create `src/codeGuide/codeGuideState.js`:

```js
let activeCodeGuideKey = null;

export function getActiveCodeGuideKey() {
  return activeCodeGuideKey;
}

export function setActiveCodeGuideKey(key) {
  activeCodeGuideKey = key;
}

export function clearActiveCodeGuideKey() {
  activeCodeGuideKey = null;
}
```

- [ ] **Step 4: Add the metadata files and map API**

Create `src/codeGuide/generatedLines.json` initially as:

```json
{}
```

Create `src/codeGuide/codeGuideDefinitions.json` with an empty object for the core test; Task 4 replaces it with the exact current-UI definitions:

```json
{}
```

Create `src/codeGuide/codeGuideMap.js`:

```js
import definitions from "./codeGuideDefinitions.json";
import generatedLines from "./generatedLines.json";

export const PROJECT_ROOT = "C:/Users/liuchen/Desktop/GitHub/knitscape";

export const CODE_GUIDE_MAP = Object.freeze(
  Object.fromEntries(
    Object.entries(definitions).map(([key, definition]) => [
      key,
      { ...definition, line: generatedLines[key] ?? null },
    ])
  )
);

export function getCodeGuideEntry(key) {
  return CODE_GUIDE_MAP[key] ?? null;
}

export function absoluteCodeGuidePath(entry) {
  return `${PROJECT_ROOT}/${entry.file}`;
}

export function createVSCodeHref(entry) {
  return `vscode://file/${absoluteCodeGuidePath(entry)}:${entry.line}`;
}
```

- [ ] **Step 5: Add the npm validation command**

Add to `package.json` scripts:

```json
"validate:code-guide": "node scripts/validate-code-guide.mjs"
```

- [ ] **Step 6: Run the validator and verify GREEN**

Run: `npm run validate:code-guide`

Expected: `PASS: code guide core contract is present.`

- [ ] **Step 7: Commit the core**

```bash
git add package.json scripts/validate-code-guide.mjs src/codeGuide
git commit -m "feat: add code guide core"
```

### Task 2: Render the source badge and drawer inside the current Lit UI

**Files:**

- Modify: `scripts/validate-code-guide.mjs`
- Create: `src/codeGuide/codeGuideOverlay.js`
- Modify: `src/views/view.js:1-64`
- Modify: `styles.css` (append code-guide section)

- [ ] **Step 1: Extend the validator for the overlay and styles**

Append checks before the failure block:

```js
const overlayFile = "src/codeGuide/codeGuideOverlay.js";
if (!fs.existsSync(path.join(root, overlayFile))) {
  failures.push(`missing ${overlayFile}`);
} else {
  const overlay = read(overlayFile);
  for (const token of [
    "codeGuideOverlay",
    "data-code-guide-ui",
    "createVSCodeHref",
    "复制位置",
    "当前未实现",
  ]) {
    if (!overlay.includes(token)) failures.push(`overlay missing ${token}`);
  }
}

const view = read("src/views/view.js");
if (!view.includes("codeGuideOverlay()")) failures.push("view must render code guide overlay");
const styles = read("styles.css");
if (!styles.includes(".code-guide-drawer")) failures.push("drawer styles missing");
```

- [ ] **Step 2: Run the validator and verify RED**

Run: `npm run validate:code-guide`

Expected: exit 1 with missing overlay, view render, and drawer style messages.

- [ ] **Step 3: Implement the Lit overlay**

Create `src/codeGuide/codeGuideOverlay.js` with these exported behaviors:

```js
import { html, nothing } from "lit-html";
import { isCodeGuideMode } from "./mode";
import {
  clearActiveCodeGuideKey,
  getActiveCodeGuideKey,
} from "./codeGuideState";
import {
  absoluteCodeGuidePath,
  createVSCodeHref,
  getCodeGuideEntry,
} from "./codeGuideMap";

let copyLabel = "复制位置";
let previousKey = null;

function selectionCopy(value) {
  const input = document.createElement("textarea");
  input.value = value;
  input.readOnly = true;
  input.className = "code-guide-copy-source";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  return copied;
}

async function nativeCopy(value) {
  if (!navigator.clipboard) return false;
  return Promise.race([
    navigator.clipboard.writeText(value).then(() => true).catch(() => false),
    new Promise((resolve) => window.setTimeout(() => resolve(false), 500)),
  ]);
}

async function copyLocation(entry) {
  const value = `${absoluteCodeGuidePath(entry)}:${entry.line}`;
  const copied = selectionCopy(value) || (await nativeCopy(value));
  copyLabel = copied ? "已复制" : "请手动复制上方路径";
}

export function codeGuideOverlay() {
  if (!isCodeGuideMode()) return nothing;
  const key = getActiveCodeGuideKey();
  if (key !== previousKey) {
    copyLabel = "复制位置";
    previousKey = key;
  }
  const entry = key
    ? getCodeGuideEntry(key) ?? {
        title: "尚未建立源码说明",
        file: "src/codeGuide/codeGuideDefinitions.json",
        line: 1,
        symbol: key,
        status: "missing",
        description: "这个界面入口还没有对应的源码说明。",
        changeHint: "请在 codeGuideDefinitions.json 中为该 key 补充映射。",
      }
    : null;

  return html`
    <div class="code-guide-badge" data-code-guide-ui>源码说明模式</div>
    ${entry
      ? html`<div class="code-guide-backdrop" data-code-guide-ui></div>
          <aside class="code-guide-drawer" data-code-guide-ui>
            <header>
              <div>
                <small>CODE GUIDE</small>
                <h2>${entry.title}</h2>
              </div>
              <button @click=${clearActiveCodeGuideKey} aria-label="关闭">×</button>
            </header>
            <div class="code-guide-body">
              <span class="code-guide-status ${entry.status}">
                ${entry.status === "implemented" ? "当前已实现" : "当前未实现"}
              </span>
              <p>${entry.description}</p>
              <dl>
                <dt>文件</dt><dd>${absoluteCodeGuidePath(entry)}</dd>
                <dt>行号</dt><dd>第 ${entry.line} 行</dd>
                <dt>函数 / 标识符</dt><dd>${entry.symbol}</dd>
              </dl>
              <div class="code-guide-hint">${entry.changeHint}</div>
              <div class="code-guide-actions">
                <button @click=${() => copyLocation(entry)}>${copyLabel}</button>
                <a href=${createVSCodeHref(entry)}>在 VS Code 中打开</a>
              </div>
            </div>
          </aside>`
      : nothing}
  `;
}
```

- [ ] **Step 4: Render the overlay from the existing view**

In `src/views/view.js`, import the overlay:

```js
import { codeGuideOverlay } from "../codeGuide/codeGuideOverlay";
```

Append it at the end of the existing `view()` template, after the debug pane expression:

```js
${when(GLOBAL_STATE.debug, debugPane)} ${codeGuideOverlay()}
```

- [ ] **Step 5: Append isolated drawer styles**

Append a `CODE GUIDE` section to `styles.css`. Use the existing variables and these required layout rules:

```css
.code-guide-badge {
  position: fixed;
  z-index: 1200;
  top: 0.75rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.45rem 0.8rem;
  border: 1px solid var(--accent);
  border-radius: 999px;
  color: var(--accent);
  background: var(--base1);
  font-weight: 700;
  pointer-events: none;
}

.code-guide-backdrop {
  position: fixed;
  z-index: 1201;
  inset: 0;
  background: rgb(0 0 0 / 28%);
}

.code-guide-drawer {
  position: fixed;
  z-index: 1202;
  top: 0;
  right: 0;
  width: min(460px, calc(100vw - 24px));
  height: 100vh;
  overflow: auto;
  color: var(--text);
  background: var(--base1);
  box-shadow: -12px 0 30px rgb(0 0 0 / 24%);
}

.code-guide-drawer header,
.code-guide-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.code-guide-drawer header,
.code-guide-body {
  padding: 1rem 1.25rem;
}

.code-guide-drawer dl {
  padding: 0.75rem;
  border: 1px solid var(--base2);
  border-radius: 0.5rem;
}

.code-guide-drawer dd {
  margin: 0.2rem 0 0.8rem;
  overflow-wrap: anywhere;
  font-family: monospace;
}

.code-guide-hint {
  margin: 1rem 0;
  padding: 0.8rem;
  border-left: 3px solid var(--accent);
  background: var(--base2);
}

.code-guide-actions > * {
  flex: 1;
  padding: 0.65rem;
  text-align: center;
}

.code-guide-copy-source {
  position: fixed;
  opacity: 0;
  pointer-events: none;
}
```

- [ ] **Step 6: Run validation and build**

Run:

```bash
npm run validate:code-guide
npm run build
```

Expected: core/overlay validator passes; Vite build exits 0.

- [ ] **Step 7: Commit the overlay**

```bash
git add scripts/validate-code-guide.mjs src/codeGuide/codeGuideOverlay.js src/views/view.js styles.css
git commit -m "feat: render code guide drawer"
```

### Task 3: Intercept guide-mode events and isolate normal mode

**Files:**

- Modify: `scripts/validate-code-guide.mjs`
- Create: `src/codeGuide/codeGuideEvents.js`
- Modify: `src/index.js:47-101`

- [ ] **Step 1: Extend the validator for event isolation**

Add:

```js
const eventsFile = "src/codeGuide/codeGuideEvents.js";
if (!fs.existsSync(path.join(root, eventsFile))) {
  failures.push(`missing ${eventsFile}`);
} else {
  const events = read(eventsFile);
  for (const token of [
    "initCodeGuideEvents",
    "data-code-guide-key",
    "data-code-guide-ui",
    "stopImmediatePropagation",
    "setActiveCodeGuideKey",
  ]) {
    if (!events.includes(token)) failures.push(`events missing ${token}`);
  }
}

const index = read("src/index.js");
if (!index.includes("isCodeGuideMode()")) failures.push("index mode gate missing");
if (!index.includes("initCodeGuideEvents")) failures.push("guide event init missing");
```

- [ ] **Step 2: Run the validator and verify RED**

Run: `npm run validate:code-guide`

Expected: exit 1 with missing event module and index gate.

- [ ] **Step 3: Implement capture-phase interception**

Create `src/codeGuide/codeGuideEvents.js`:

```js
import { setActiveCodeGuideKey } from "./codeGuideState";

const BLOCKED_EVENTS = [
  "pointerdown",
  "pointerup",
  "click",
  "input",
  "change",
  "wheel",
  "contextmenu",
];

function guideTarget(event) {
  if (!(event.target instanceof Element)) return null;
  if (event.target.closest("[data-code-guide-ui]")) return null;
  return event.target.closest("[data-code-guide-key]");
}

function blockGuideEvent(event) {
  const target = guideTarget(event);
  if (!target) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  setActiveCodeGuideKey(target.dataset.codeGuideKey);
}

function blockGuideKeyboard(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  blockGuideEvent(event);
}

export function initCodeGuideEvents(documentTarget = document) {
  for (const type of BLOCKED_EVENTS) {
    documentTarget.addEventListener(type, blockGuideEvent, {
      capture: true,
      passive: false,
    });
  }
  documentTarget.addEventListener("keydown", blockGuideKeyboard, true);
}
```

- [ ] **Step 4: Gate normal interaction initialization in `src/index.js`**

Add imports:

```js
import { isCodeGuideMode } from "./codeGuide/mode";
import { initCodeGuideEvents } from "./codeGuide/codeGuideEvents";
```

Replace the unconditional normal-input initialization inside `init()`:

```js
if (isCodeGuideMode()) {
  initCodeGuideEvents();
} else {
  isMobile() ? initTouch() : initKeyboard();
}
```

Keep `Split`, `StateMonitor`, `measureWindow`, and `fitChart` running so the current application still renders fully in guide mode.

- [ ] **Step 5: Run validation and build**

Run:

```bash
npm run validate:code-guide
npm run build
```

Expected: both exit 0.

- [ ] **Step 6: Commit event isolation**

```bash
git add scripts/validate-code-guide.mjs src/codeGuide/codeGuideEvents.js src/index.js
git commit -m "feat: isolate code guide interactions"
```

### Task 4: Mark every current visible control and generate exact line numbers

**Files:**

- Modify: `scripts/validate-code-guide.mjs`
- Create: `scripts/generate-code-guide-lines.mjs`
- Modify: `src/codeGuide/codeGuideDefinitions.json`
- Modify: `src/codeGuide/generatedLines.json`
- Modify: `src/views/taskbar.js:28-95`
- Modify: `src/views/leftBar.js:188-620`
- Modify: `src/views/repeatTools.js:18-84`
- Modify: `src/views/repeatCanvas.js:29-72`
- Modify: `src/views/chartTools.js:44-80`
- Modify: `src/components/runSimulation.js:28-101`
- Modify: `src/views/view.js:37-61`
- Modify: `src/index.js` after `Split(...)`
- Modify: `package.json`

- [ ] **Step 1: Define the exact required current-UI keys in the validator**

Add this list to `scripts/validate-code-guide.mjs`:

```js
const REQUIRED_KEYS = [
  "taskbar.brand",
  "taskbar.title",
  "taskbar.width",
  "taskbar.height",
  "taskbar.language",
  "taskbar.undo",
  "taskbar.new",
  "taskbar.import",
  "taskbar.export",
  "taskbar.library",
  "taskbar.settings",
  "taskbar.fullscreen",
  "left.add-repeat",
  "yarn.ply-color",
  "yarn.ply-visible",
  "yarn.ply-diameter",
  "yarn.ply-length",
  "yarn.texture-import",
  "yarn.texture-original-color",
  "yarn.texture-enable",
  "yarn.texture-background",
  "yarn.texture-size",
  "yarn.texture-strength",
  "yarn.texture-fuzz",
  "yarn.texture-clear",
  "yarn.performance",
  "stitch.symbol",
  "palette.edit",
  "palette.add",
  "palette.label",
  "palette.delete",
  "palette.color",
  "palette.shuffle",
  "palette.randomize",
  "repeat.delete",
  "repeat.width",
  "repeat.height",
  "repeat.tool",
  "repeat.exit",
  "repeat.area-width",
  "repeat.area-height",
  "chart.zoom-out",
  "chart.zoom-range",
  "chart.zoom-in",
  "chart.fit",
  "chart.cols",
  "chart.rows",
  "chart.yarn-sequence",
  "chart.yarn-color",
  "chart.symbols",
  "chart.grid",
  "chart.repeat",
  "layout.split",
  "simulation.canvas",
  "simulation.relax",
  "simulation.flip",
  "simulation.yarn-length",
  "simulation.zoom-out",
  "simulation.zoom-range",
  "simulation.zoom-in",
  "simulation.fit",
];
```

Read definitions and generated lines, then validate every key:

```js
const definitionsPath = path.join(root, "src/codeGuide/codeGuideDefinitions.json");
const linesPath = path.join(root, "src/codeGuide/generatedLines.json");
const definitions = JSON.parse(fs.readFileSync(definitionsPath, "utf8"));
const generatedLines = JSON.parse(fs.readFileSync(linesPath, "utf8"));

for (const key of REQUIRED_KEYS) {
  const entry = definitions[key];
  if (!entry) {
    failures.push(`definition missing ${key}`);
    continue;
  }
  const sourcePath = path.join(root, entry.file);
  if (!fs.existsSync(sourcePath)) {
    failures.push(`source missing for ${key}: ${entry.file}`);
    continue;
  }
  const sourceLines = fs.readFileSync(sourcePath, "utf8").split(/\r?\n/);
  const actualLine = sourceLines.findIndex((line) => line.includes(entry.anchor)) + 1;
  if (actualLine < 1) failures.push(`anchor missing for ${key}: ${entry.anchor}`);
  if (generatedLines[key] !== actualLine) {
    failures.push(`line stale for ${key}: ${generatedLines[key]} != ${actualLine}`);
  }
}
```

- [ ] **Step 2: Run the validator and verify RED**

Run: `npm run validate:code-guide`

Expected: exit 1 listing missing definitions beginning with `taskbar.brand`.

- [ ] **Step 3: Add stable attributes to the current templates**

For every key above, add the literal attribute to the existing element that owns the behavior. Examples that establish the required pattern:

```js
<input data-code-guide-key="taskbar.width" ... />
<button data-code-guide-key="taskbar.export" ...>...</button>
<label data-code-guide-key="yarn.ply-diameter" ...>...</label>
<button data-code-guide-key="stitch.symbol" ...>...</button>
<button data-code-guide-key="repeat.tool" ...>...</button>
<button data-code-guide-key="repeat.area-width" ...>...</button>
<canvas data-code-guide-key="chart.grid" id="grid" ...></canvas>
<div data-code-guide-key="simulation.canvas" id="sim-container">...</div>
```

Use one shared key for repeated controls whose implementation is the same, such as two yarn ply diameter sliders or four stitch buttons. Use separate keys when handler functions differ, such as width versus height and zoom-in versus zoom-out.

After `Split(["#chart-pane", "#sim-pane"], ...)`, mark the inserted gutter in guide mode:

```js
if (isCodeGuideMode()) {
  document
    .querySelector(".gutter")
    ?.setAttribute("data-code-guide-key", "layout.split");
}
```

- [ ] **Step 4: Populate current-source definitions**

For each `REQUIRED_KEYS` entry, add one JSON object with this exact schema:

```json
{
  "title": "导出",
  "file": "src/views/taskbar.js",
  "anchor": "data-code-guide-key=\"taskbar.export\"",
  "symbol": "dispatch({ showDownload: true })",
  "status": "implemented",
  "description": "打开当前项目的导出格式弹窗。",
  "changeHint": "修改入口外观请编辑 taskbar.js；修改导出格式请继续查看 src/views/downloadModal.js 和 src/actions/exporters.js。"
}
```

Use `status: "implemented"` for all listed current controls. Descriptions must name the current behavior, and `changeHint` must identify the next implementation file when the visible template delegates to an action module.

Use this ownership table when writing the definitions; it fixes the file and symbol wording for every key group:

| Keys | File | Symbol / next modification target |
| --- | --- | --- |
| `taskbar.brand`, `taskbar.title` | `src/views/taskbar.js` | `taskbar()`; text continues in `src/i18n/translations.js` |
| `taskbar.width` | `src/views/taskbar.js` | `updateChartWidth()` → `src/actions/repeatDimensions.js` |
| `taskbar.height` | `src/views/taskbar.js` | `updateChartHeight()` → `src/actions/repeatDimensions.js` |
| `taskbar.language` | `src/views/taskbar.js` | `setStoredLanguage()` and `dispatch()` |
| `taskbar.undo` | `src/views/taskbar.js` | `undo()` in `src/state.js` |
| `taskbar.new`, `taskbar.import` | `src/views/taskbar.js` | `newPattern()` / `uploadFile()` in `src/actions/importers.js` |
| `taskbar.export` | `src/views/taskbar.js` | download modal dispatch → `src/views/downloadModal.js`, `src/actions/exporters.js` |
| `taskbar.library`, `taskbar.settings` | `src/views/taskbar.js` | modal visibility dispatch → corresponding modal view |
| `taskbar.fullscreen` | `src/views/taskbar.js` | `toggleFullscreen()` in `src/actions/zoomFit.js` |
| `left.add-repeat` | `src/views/leftBar.js` | `addRepeat()` |
| `yarn.ply-color` | `src/views/leftBar.js` | `editYarnPlyColor()` |
| `yarn.ply-visible`, `yarn.ply-diameter`, `yarn.ply-length` | `src/views/leftBar.js` | `updateYarnPly()` |
| `yarn.texture-import` | `src/views/leftBar.js` | `importYarnScanTexture()` → `src/yarnTexture/yarnScanTexture.js` |
| `yarn.texture-original-color`, `yarn.texture-enable`, `yarn.texture-strength`, `yarn.texture-fuzz` | `src/views/leftBar.js` | `updateYarnPlyTexture()` |
| `yarn.texture-size`, `yarn.texture-background` | `src/views/leftBar.js` | `reprocessYarnScanTexture()` |
| `yarn.texture-clear` | `src/views/leftBar.js` | `clearYarnScanTexture()` |
| `yarn.performance` | `src/views/leftBar.js` | `updateTexturePerformanceMode()` → `src/actions/texturePerformance.js` |
| `stitch.symbol` | `src/views/leftBar.js` | `applySelectedSymbol()` in `src/actions/selectedCell.js` |
| `palette.edit`, `palette.add`, `palette.label`, `palette.delete`, `palette.color`, `palette.shuffle`, `palette.randomize` | `src/views/leftBar.js` | current `yarnPicker()` handler; color propagation continues in `src/actions/yarnPaletteEditing.js` |
| `repeat.delete`, `repeat.width`, `repeat.height`, `repeat.tool`, `repeat.exit` | `src/views/repeatTools.js` | `repeatTools()`; drawing actions continue in `src/actions/repeatEditingTools.js` and dimensions in `src/actions/repeatDimensions.js` |
| `repeat.area-width`, `repeat.area-height`, `chart.repeat` | `src/views/repeatCanvas.js` | `repeatCanvas()`; pointer behavior continues in `src/events/repeatPointerInteraction.js` |
| `chart.zoom-out`, `chart.zoom-range`, `chart.zoom-in`, `chart.fit`, `chart.cols`, `chart.rows` | `src/views/chartTools.js` | `centerZoom()`, `fitChart()`, `setChartBlock()` |
| `chart.yarn-sequence`, `chart.yarn-color`, `chart.symbols`, `chart.grid` | `src/views/view.js` | current canvas element; renderer continues in the matching `src/components/draw*.js` module |
| `layout.split` | `src/index.js` | `Split(["#chart-pane", "#sim-pane"], ...)` |
| `simulation.canvas` | `src/components/runSimulation.js` | `simulationView()` and `runSimulation()` |
| `simulation.relax`, `simulation.flip`, `simulation.yarn-length` | `src/components/runSimulation.js` | current button handler; simulation engine continues in `src/simulation/yarnSimulation.js` |
| `simulation.zoom-out`, `simulation.zoom-range`, `simulation.zoom-in`, `simulation.fit` | `src/components/runSimulation.js` | `runPreviewInteraction()` and `centerZoomSimulation()` |

- [ ] **Step 5: Create the line generator**

Create `scripts/generate-code-guide-lines.mjs`:

```js
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const definitionsPath = path.join(root, "src/codeGuide/codeGuideDefinitions.json");
const outputPath = path.join(root, "src/codeGuide/generatedLines.json");
const definitions = JSON.parse(fs.readFileSync(definitionsPath, "utf8"));
const lines = {};

for (const [key, entry] of Object.entries(definitions)) {
  const sourcePath = path.join(root, entry.file);
  if (!fs.existsSync(sourcePath)) throw new Error(`Missing source for ${key}: ${entry.file}`);
  const sourceLines = fs.readFileSync(sourcePath, "utf8").split(/\r?\n/);
  const line = sourceLines.findIndex((sourceLine) => sourceLine.includes(entry.anchor)) + 1;
  if (line < 1) throw new Error(`Missing anchor for ${key}: ${entry.anchor}`);
  lines[key] = line;
}

fs.writeFileSync(outputPath, `${JSON.stringify(lines, null, 2)}\n`);
console.log(`Generated ${Object.keys(lines).length} code guide line numbers.`);
```

Add the npm command:

```json
"generate:code-guide-lines": "node scripts/generate-code-guide-lines.mjs"
```

- [ ] **Step 6: Generate lines and verify GREEN**

Run:

```bash
npm run generate:code-guide-lines
npm run validate:code-guide
```

Expected: generator reports the same count as `REQUIRED_KEYS`; validator passes.

- [ ] **Step 7: Build and run current project validators**

Run:

```bash
npm run build
npm run validate:single-only
npm run validate:single-ui
npm run validate:i18n
npm run validate:intranet
```

Expected: every command exits 0.

- [ ] **Step 8: Commit current UI mappings**

```bash
git add package.json scripts/generate-code-guide-lines.mjs scripts/validate-code-guide.mjs src/codeGuide src/index.js src/views/taskbar.js src/views/leftBar.js src/views/repeatTools.js src/views/repeatCanvas.js src/views/chartTools.js src/components/runSimulation.js src/views/view.js
git commit -m "feat: map current UI to source guidance"
```

### Task 5: Browser verification for normal mode and guide mode

**Files:**

- Modify if verification finds a scoped defect: files from Tasks 2–4 only

- [ ] **Step 1: Start the existing Vite application**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite prints a local URL and serves the current KnitScape interface.

- [ ] **Step 2: Verify normal mode remains functional**

Open the plain local URL without `codeGuide=1` and verify:

- `.code-guide-badge` count is 0.
- Width input changes chart width through `updateChartWidth`.
- A taskbar button such as settings opens its current modal.
- Simulation pan/zoom controls still update the current preview.

- [ ] **Step 3: Verify guide mode uses the same current interface**

Open the same URL with `?codeGuide=1` and verify:

- `.code-guide-badge` count is 1.
- Current taskbar, left bar, editor canvases, chart tools, split gutter, and simulation controls are visible.
- There is no static target-image mockup.

- [ ] **Step 4: Verify source drawer behavior**

Click one control in each area and assert the drawer contents:

- taskbar width → `src/views/taskbar.js` and `updateChartWidth`.
- yarn diameter → `src/views/leftBar.js` and its diameter dispatch.
- stitch button → `src/actions/selectedCell.js` or the current symbol application entry.
- repeat tool → `src/actions/repeatEditingTools.js` guidance.
- chart grid → `src/views/view.js` plus drawing module guidance.
- simulation zoom → `src/components/runSimulation.js` and `centerZoomSimulation`.

For each click, confirm the original value/state does not change.

- [ ] **Step 5: Verify drawer-only interactions**

Confirm:

- Close removes the drawer.
- Copy reports `已复制` or `请手动复制上方路径` within 600 ms and never hangs.
- VS Code link starts with `vscode://file/C:/Users/liuchen/Desktop/GitHub/knitscape/` and ends with a positive line number.
- Reopening a different control replaces all drawer fields.

- [ ] **Step 6: Run fresh final verification**

Run:

```bash
npm run generate:code-guide-lines
npm run validate:code-guide
npm run validate:single-only
npm run validate:single-ui
npm run validate:i18n
npm run validate:repeat-dimensions
npm run validate:two-ply-yarn
npm run validate:sim-wheel-performance
npm run validate:yarn-length-parameters
npm run validate:yarn-length-scaling
npm run validate:yarn-length-toggle
npm run validate:yarn-sequence-editor
npm run validate:intranet
npm run build
```

Expected: every command exits 0 with no validation failures.

- [ ] **Step 7: Review the scoped diff**

Run:

```bash
git status --short
git diff --check
git diff -- src/codeGuide scripts/validate-code-guide.mjs scripts/generate-code-guide-lines.mjs src/index.js src/views/view.js src/views/taskbar.js src/views/leftBar.js src/views/repeatTools.js src/views/repeatCanvas.js src/views/chartTools.js src/components/runSimulation.js styles.css package.json
```

Confirm no unrelated user changes were overwritten or staged.

- [ ] **Step 8: Commit final verification fixes if any were required**

```bash
git add package.json scripts/generate-code-guide-lines.mjs scripts/validate-code-guide.mjs src/codeGuide src/index.js src/views/view.js src/views/taskbar.js src/views/leftBar.js src/views/repeatTools.js src/views/repeatCanvas.js src/views/chartTools.js src/components/runSimulation.js styles.css
git commit -m "test: verify current UI code guide mode"
```

Skip this commit when browser verification required no changes.
