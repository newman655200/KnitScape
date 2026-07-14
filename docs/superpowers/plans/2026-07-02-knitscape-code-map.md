# KnitScape Code Map Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, high-fidelity static HTML replica of `目标.png` where every visible control opens a code-location guide and can launch VS Code at the mapped file and line.

**Architecture:** Keep the KnitScape repository read-only during implementation. Generate one self-contained documentation page in the Codex `outputs` directory, copy only the reference image and installed Font Awesome SVG assets beside it, and embed a declarative code map plus one drawer controller in the HTML.

**Tech Stack:** HTML5, CSS Grid/Flexbox, vanilla JavaScript, local Font Awesome Free SVG assets, local `file:///` execution, VS Code URI links, Codex in-app browser for visual QA.

---

## Files

**Create**

- `C:/Users/liuchen/Documents/Codex/2026-07-02/d/outputs/knitscape-code-map.html`
- `C:/Users/liuchen/Documents/Codex/2026-07-02/d/outputs/knitscape-code-map-assets/reference.png`
- `C:/Users/liuchen/Documents/Codex/2026-07-02/d/outputs/knitscape-code-map-assets/*.svg`
- `C:/Users/liuchen/Documents/Codex/2026-07-02/d/work/validate-code-map.mjs`

**Read Only**

- `C:/Users/liuchen/Desktop/目标.png`
- `C:/Users/liuchen/Desktop/GitHub/knitscape/src/**`
- `C:/Users/liuchen/Desktop/GitHub/knitscape/node_modules/@fortawesome/fontawesome-free/svgs/**`

### Task 1: Freeze the Source Map and Add a Failing Contract Test

**Files:**

- Create: `C:/Users/liuchen/Documents/Codex/2026-07-02/d/work/validate-code-map.mjs`
- Test: `C:/Users/liuchen/Documents/Codex/2026-07-02/d/outputs/knitscape-code-map.html`

- [ ] **Step 1: Re-scan the current source lines**

Run from the KnitScape repository:

```powershell
rg -n 'function updateChartWidth|function updateChartHeight|export function taskbar|language-select|showDownload' src/views/taskbar.js
rg -n 'function updateYarnPly|function editYarnPlyColor|function importYarnScanTexture|function yarnScanTextureControls|applySelectedSymbol|export function leftBar' src/views/leftBar.js src/actions/selectedCell.js
rg -n 'export function repeatTools|function brush|function flood|function rect|function line' src/views/repeatTools.js src/actions/repeatEditingTools.js
rg -n 'function undo|export function simulationView|function pan|export function simulationPointerInteraction|centerZoomSimulation|export function download' src/state.js src/components/runSimulation.js src/events/simulationPointerInteraction.js src/actions/zoomFit.js src/actions/exporters.js
```

Expected: each identifier prints a real file and line. Use these current values in the HTML `CODE_MAP`; do not rely on stale line numbers from the design document.

- [ ] **Step 2: Write the validator before the page exists**

Create `work/validate-code-map.mjs` with:

```js
import fs from "node:fs";
import path from "node:path";

const root = "C:/Users/liuchen/Documents/Codex/2026-07-02/d";
const output = path.join(root, "outputs/knitscape-code-map.html");
const reference = path.join(
  root,
  "outputs/knitscape-code-map-assets/reference.png"
);
const failures = [];

if (!fs.existsSync(output)) failures.push("HTML deliverable is missing.");
if (!fs.existsSync(reference)) failures.push("Reference preview asset is missing.");

if (fs.existsSync(output)) {
  const html = fs.readFileSync(output, "utf8");
  const hotspotCount = (html.match(/data-code-key=/g) || []).length;
  const mapCount = (html.match(/status:\s*["'](?:implemented|missing)["']/g) || [])
    .length;

  if (!html.includes("const CODE_MAP")) failures.push("CODE_MAP is missing.");
  if (!html.includes("vscode://file/")) failures.push("VS Code links are missing.");
  if (!html.includes("navigator.clipboard")) failures.push("Copy action is missing.");
  if (!html.includes("当前未实现")) failures.push("Missing features are not labeled.");
  if (!html.includes("目标.png")) failures.push("Reference attribution is missing.");
  if (hotspotCount < 30) failures.push(`Expected at least 30 hotspots, got ${hotspotCount}.`);
  if (mapCount < 30) failures.push(`Expected at least 30 map entries, got ${mapCount}.`);
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}

console.log("PASS: KnitScape code-map deliverable contract is satisfied.");
```

- [ ] **Step 3: Verify the red state**

Run:

```powershell
node work/validate-code-map.mjs
```

Expected: exit code `1` with `HTML deliverable is missing` and `Reference preview asset is missing`.

### Task 2: Prepare Real Visual Assets

**Files:**

- Create: `outputs/knitscape-code-map-assets/reference.png`
- Create: local SVG icons under `outputs/knitscape-code-map-assets/`

- [ ] **Step 1: Create the output asset directory**

Run from the Codex task directory:

```powershell
New-Item -ItemType Directory -Force -Path 'outputs\knitscape-code-map-assets' | Out-Null
```

- [ ] **Step 2: Copy the supplied reference without altering it**

Run:

```powershell
Copy-Item -LiteralPath 'C:\Users\liuchen\Desktop\目标.png' -Destination 'outputs\knitscape-code-map-assets\reference.png'
```

- [ ] **Step 3: Copy installed Font Awesome icons**

Copy these real library assets from the KnitScape installation into the output asset directory:

```powershell
$fa='C:\Users\liuchen\Desktop\GitHub\knitscape\node_modules\@fortawesome\fontawesome-free\svgs\solid'
$icons=@(
  'arrow-pointer','chevron-down','code','copy','download','ellipsis','eraser',
  'expand','globe','grip-vertical','hand','magnifying-glass-minus',
  'magnifying-glass-plus','minus','plus','rotate-left','rotate-right','square',
  'trash','upload'
)
foreach($icon in $icons){
  Copy-Item -LiteralPath (Join-Path $fa "$icon.svg") `
    -Destination (Join-Path 'outputs\knitscape-code-map-assets' "$icon.svg")
}
Copy-Item -LiteralPath `
  'C:\Users\liuchen\Desktop\GitHub\knitscape\node_modules\@fortawesome\fontawesome-free\svgs\regular\circle.svg' `
  -Destination 'outputs\knitscape-code-map-assets\circle.svg'
```

Expected: 21 SVG files plus `reference.png`; no generated or handcrafted icons.

### Task 3: Build the High-Fidelity Static Page

**Files:**

- Create: `outputs/knitscape-code-map.html`

- [ ] **Step 1: Build the visual shell**

Create a single HTML document with these top-level regions and dimensions at 1536 x 1024:

```html
<body>
  <header class="taskbar"></header>
  <main class="workspace">
    <aside class="left-panel"></aside>
    <section class="chart-panel"></section>
    <aside class="preview-panel"></aside>
  </main>
  <div class="drawer-backdrop" hidden></div>
  <aside class="code-drawer" aria-hidden="true"></aside>
</body>
```

Use these layout tokens:

```css
:root {
  --accent: #098d87;
  --accent-soft: #eaf7f6;
  --ink: #171c23;
  --muted: #69727f;
  --border: #dfe4e9;
  --surface: #ffffff;
  --canvas: #f7f9fa;
  --radius: 7px;
  --taskbar-height: 87px;
}

.workspace {
  height: calc(100vh - var(--taskbar-height));
  display: grid;
  grid-template-columns: minmax(390px, 31.6%) minmax(520px, 1fr) minmax(330px, 24.1%);
  gap: 13px;
  padding: 14px 20px 20px;
}
```

Match the reference exactly: white cards, one-pixel borders, restrained shadows, teal active states, fine central grid, left vertical scrolling, and right preview aspect ratio.

- [ ] **Step 2: Populate at least 30 code-map hotspots**

Every control uses `data-code-key`. Include at minimum:

```text
brand, title, single-face-tag, width, height, language, export,
add-yarn, yarn-1-card, yarn-1-visible, yarn-1-color, yarn-1-diameter,
yarn-1-length, yarn-1-texture, yarn-2-card, yarn-2-visible,
yarn-2-color, yarn-2-diameter, yarn-2-length, yarn-2-texture,
stitch-knit, stitch-purl, stitch-slip, stitch-tuck,
tool-pointer, tool-line, tool-circle, tool-dot, tool-rect, tool-eraser,
undo, redo, delete, chart-zoom, chart-fullscreen, chart-grid,
preview-image, preview-pan, preview-zoom-out, preview-zoom-in,
preview-scale, preview-fullscreen
```

For target controls that are not current KnitScape features (`add-yarn` beyond the fixed plies, `tool-circle`, `tool-dot`, `redo`), set `status: "missing"` and label them `当前未实现`.

- [ ] **Step 3: Embed the declarative mapping model**

Each `CODE_MAP` entry uses this exact shape:

```js
{
  label: "画布宽度",
  status: "implemented",
  file: "src/views/taskbar.js",
  line: 11,
  identifier: "updateChartWidth",
  description: "修改画布宽度输入、范围限制和尺寸同步入口。"
}
```

Missing features use:

```js
{
  label: "重做",
  status: "missing",
  file: "src/state.js",
  line: 140,
  identifier: "undo / snapshots",
  description: "当前只有撤销栈。建议在这里增加 redoSnapshots 和 redo()。"
}
```

Use the fresh line scan from Task 1 for all implemented entries.

- [ ] **Step 4: Reproduce the right preview from the supplied source**

Place the reference image inside an overflow-hidden preview viewport. At the reference size, use the measured crop:

```css
.preview-visual { position: relative; overflow: hidden; aspect-ratio: 346 / 754; }
.preview-source {
  position: absolute;
  width: 443.93%;
  max-width: none;
  left: -334.68%;
  top: -22.15%;
}
```

The image `alt` text must identify it as a crop from `目标.png`.

### Task 4: Implement the Only Allowed Interaction

**Files:**

- Modify: `outputs/knitscape-code-map.html`
- Test: `work/validate-code-map.mjs`

- [ ] **Step 1: Add the drawer controller**

Use one delegated click listener:

```js
document.addEventListener("click", (event) => {
  const hotspot = event.target.closest("[data-code-key]");
  if (!hotspot) return;
  event.preventDefault();
  openCodeDrawer(hotspot.dataset.codeKey);
});
```

`openCodeDrawer(key)` reads `CODE_MAP[key]`, renders the status, file, line, identifier, description, absolute path, and buttons, then opens the drawer. It must not change any knitting value.

- [ ] **Step 2: Add robust copy behavior**

Use `navigator.clipboard.writeText()` and a textarea fallback:

```js
async function copyPath(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  copyFeedback.textContent = "已复制代码位置";
}
```

- [ ] **Step 3: Form the VS Code URI**

Build the button URL from the absolute repository root, normalized with forward slashes:

```js
const REPO_ROOT = "C:/Users/liuchen/Desktop/GitHub/knitscape";
const absolutePath = `${REPO_ROOT}/${entry.file}`;
openCode.href = `vscode://file/${absolutePath}:${entry.line}`;
```

The drawer remains useful when the external protocol is unavailable.

- [ ] **Step 4: Verify the contract turns green**

Run:

```powershell
node work/validate-code-map.mjs
```

Expected: exit code `0` and `PASS: KnitScape code-map deliverable contract is satisfied.`

### Task 5: Visual and Interaction QA

**Files:**

- Modify if needed: `outputs/knitscape-code-map.html`
- Test: rendered page at 1536 x 1024

- [ ] **Step 1: Open the local HTML in the Codex in-app browser**

Load:

```text
file:///C:/Users/liuchen/Documents/Codex/2026-07-02/d/outputs/knitscape-code-map.html
```

- [ ] **Step 2: Capture the implementation at the reference viewport**

Set the page viewport to 1536 x 1024 and capture a screenshot. Compare it together with `C:/Users/liuchen/Desktop/目标.png`, checking taskbar height, three-column widths, card padding, control density, preview crop, borders, radii, and typography.

- [ ] **Step 3: Fix visible mismatches and compare again**

Apply only measured visual corrections. Repeat the paired comparison until no major layout, crop, overflow, spacing, or typography discrepancy remains.

- [ ] **Step 4: Exercise every hotspot**

In the browser, enumerate all `[data-code-key]` elements. Click each one and verify:

- the drawer opens
- the key exists in `CODE_MAP`
- implemented entries show a real file and line
- missing entries show `当前未实现`
- the copy button returns visible success feedback
- the VS Code link begins with `vscode://file/`

- [ ] **Step 5: Run final verification**

Run:

```powershell
node work/validate-code-map.mjs
Get-Item 'outputs\knitscape-code-map.html'
Get-ChildItem 'outputs\knitscape-code-map-assets'
git -C 'C:\Users\liuchen\Desktop\GitHub\knitscape' status --short
```

Expected: validator passes, deliverable and assets exist, and the KnitScape worktree has no changes caused by this implementation.
