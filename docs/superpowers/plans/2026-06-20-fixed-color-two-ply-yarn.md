# Fixed Color Two-Ply Yarn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visual two-ply yarn preview for the single-face project, with fixed colors and independent diameter controls for yarn 1 and yarn 2.

**Architecture:** Keep the current single-face organization model unchanged: repeat units still generate one chart, and the simulation still computes one yarn path from that chart. Add visual ply settings to state, pass them into the single-face simulation renderer, and draw the same path once for yarn 1 and optionally again for yarn 2 on top.

**Tech Stack:** Vite, lit-html, vanilla JavaScript canvas rendering, existing `StateMonitor`, existing validation scripts, browser verification through local dev server.

---

## File Map

- Modify `src/constants.js`: add defaults for fixed two-ply colors and diameters.
- Modify `src/state.js`: add persisted `yarnPlies` state and snapshot coverage.
- Modify `src/actions/importers.js`: reset new patterns with the default two-ply state and safely load older JSON files.
- Modify `src/actions/exporters.js`: include `yarnPlies` in exported JSON.
- Modify `src/views/settingsModal.js`: add color pickers, diameter sliders, and second-yarn toggle.
- Modify `src/components/runSimulation.js`: pass `GLOBAL_STATE.yarnPlies` into `simulate()` and rerun on changes.
- Modify `src/simulation/yarnSimulation.js`: replace fixed `YARN_RATIO` rendering with per-ply fixed-color drawing.
- Modify `scripts/validate-single-face-ui-labels.mjs`: assert the new UI and removed old assumptions remain stable.
- Create `scripts/validate-two-ply-yarn.mjs`: assert state defaults, import/export compatibility, and renderer wiring.
- Modify `KnitScape_单面布技术文档.md`: update after each task is implemented and reviewed.

## Required Per-Task Flow

After each task:

1. Run the task-specific validation command.
2. Run `npm run validate:single-ui`.
3. Spawn an验收智能体 with the task scope and changed files.
4. Fix any Critical or Important issues before continuing.
5. Update `KnitScape_单面布技术文档.md` with the completed task result.
6. Run `npm run build` before moving to the next task if runtime code changed.

## Task 1: Add Two-Ply State And Validation

**Files:**
- Modify `src/constants.js`
- Modify `src/state.js`
- Modify `src/actions/importers.js`
- Modify `src/actions/exporters.js`
- Create `scripts/validate-two-ply-yarn.mjs`
- Modify `package.json`
- Modify `KnitScape_单面布技术文档.md`

- [ ] **Step 1: Write failing validation script**

Create `scripts/validate-two-ply-yarn.mjs` with assertions:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

const packageJSON = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(
  packageJSON.scripts["validate:two-ply-yarn"],
  "node scripts/validate-two-ply-yarn.mjs",
  "package.json must expose validate:two-ply-yarn."
);

const stateSource = fs.readFileSync("src/state.js", "utf8");
assert.match(stateSource, /yarnPlies/, "GLOBAL_STATE must include yarnPlies.");
assert.match(
  stateSource,
  /SNAPSHOT_FIELDS/,
  "state must continue to use SNAPSHOT_FIELDS."
);

const exporterSource = fs.readFileSync("src/actions/exporters.js", "utf8");
assert.match(exporterSource, /yarnPlies/, "JSON export must include yarnPlies.");

const importerSource = fs.readFileSync("src/actions/importers.js", "utf8");
assert.match(
  importerSource,
  /DEFAULT_YARN_PLIES/,
  "importer must fall back to DEFAULT_YARN_PLIES for older files."
);

globalThis.Path2D = class {
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  closePath() {}
  rect() {}
};

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const constants = await server.ssrLoadModule("/src/constants.js");
  const state = await server.ssrLoadModule("/src/state.js");

  assert.deepEqual(state.GLOBAL_STATE.yarnPlies, constants.DEFAULT_YARN_PLIES);
  assert.equal(state.GLOBAL_STATE.yarnPlies.length, 2);
  assert.equal(state.GLOBAL_STATE.yarnPlies[0].enabled, true);
  assert.equal(state.GLOBAL_STATE.yarnPlies[1].enabled, true);
  assert.equal(typeof state.GLOBAL_STATE.yarnPlies[0].color, "string");
  assert.equal(typeof state.GLOBAL_STATE.yarnPlies[1].color, "string");
  assert.equal(typeof state.GLOBAL_STATE.yarnPlies[0].diameter, "number");
  assert.equal(typeof state.GLOBAL_STATE.yarnPlies[1].diameter, "number");
  assert.ok(state.GLOBAL_STATE.yarnPlies[0].diameter > 0);
  assert.ok(state.GLOBAL_STATE.yarnPlies[1].diameter > 0);

  console.log("PASS: two-ply yarn state and JSON wiring are configured.");
} finally {
  await server.close();
}
```

- [ ] **Step 2: Run validation to verify it fails**

Run: `node scripts/validate-two-ply-yarn.mjs`

Expected: FAIL because `validate:two-ply-yarn`, `DEFAULT_YARN_PLIES`, and `GLOBAL_STATE.yarnPlies` do not exist yet.

- [ ] **Step 3: Implement minimal state and JSON wiring**

Modify `src/constants.js`:

```js
export const DEFAULT_YARN_PLIES = [
  { name: "主纱", color: "rgba(190,190,190,1)", diameter: 0.24, enabled: true },
  { name: "副纱", color: "rgba(80,140,220,1)", diameter: 0.14, enabled: true },
];
```

Add `"yarnPlies"` to `SNAPSHOT_FIELDS`.

Modify `src/state.js`:

```js
import { DEFAULT_YARN_PLIES } from "./constants.js";

yarnPlies: DEFAULT_YARN_PLIES.map((ply) => ({ ...ply })),
```

Modify `src/actions/importers.js`:

```js
import { DEFAULT_YARN_PLIES } from "../constants";

yarnPlies: (patternJSON.yarnPlies ?? DEFAULT_YARN_PLIES).map((ply) => ({
  ...ply,
})),
```

Use the same default map in `newPattern()`.

Modify `src/actions/exporters.js`:

```js
yarnPlies: GLOBAL_STATE.yarnPlies,
```

Modify `package.json`:

```json
"validate:two-ply-yarn": "node scripts/validate-two-ply-yarn.mjs"
```

- [ ] **Step 4: Run validations**

Run:

```powershell
npm run validate:two-ply-yarn
npm run validate:single-ui
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Spawn验收智能体**

Reviewer prompt:

```text
你是本步骤的验收智能体。请只验收 Task 1: Add Two-Ply State And Validation。
项目目录：C:\Users\liuchen\Desktop\GitHub\knitscape
要求：
1. GLOBAL_STATE 有两个固定色纱线配置 yarnPlies。
2. 每根纱线都有 color、diameter、enabled。
3. newPattern 使用默认两根纱线。
4. JSON export/import 支持 yarnPlies，并兼容旧 JSON。
5. 不允许改模拟绘制逻辑和设置 UI，那是后续任务。
6. 运行 npm run validate:two-ply-yarn、npm run validate:single-ui、npm run build。
请给出 PASS/FAIL 和具体问题。
```

- [ ] **Step 6: Update MD**

Add a section to `KnitScape_单面布技术文档.md`:

```text
双纱视觉方案 Step 1 已完成：新增 yarnPlies 状态，包含主纱/副纱固定颜色、直径和启用状态；JSON 导入导出已支持该配置并兼容旧文件。
```

## Task 2: Add Settings UI For Fixed Colors And Diameters

**Files:**
- Modify `src/views/settingsModal.js`
- Modify `styles.css`
- Modify `scripts/validate-single-face-ui-labels.mjs`
- Modify `scripts/validate-two-ply-yarn.mjs`
- Modify `KnitScape_单面布技术文档.md`

- [ ] **Step 1: Extend validation first**

Update `scripts/validate-two-ply-yarn.mjs` to check:

```js
const settingsSource = fs.readFileSync("src/views/settingsModal.js", "utf8");
assert.match(settingsSource, /纱线设置/, "settings modal must show yarn settings.");
assert.match(settingsSource, /主纱颜色/, "settings modal must expose main yarn color.");
assert.match(settingsSource, /副纱颜色/, "settings modal must expose second yarn color.");
assert.match(settingsSource, /主纱直径/, "settings modal must expose main yarn diameter.");
assert.match(settingsSource, /副纱直径/, "settings modal must expose second yarn diameter.");
assert.match(settingsSource, /显示副纱/, "settings modal must expose second yarn toggle.");
assert.match(settingsSource, /updateYarnPly/, "settings modal must update yarnPlies immutably.");
```

- [ ] **Step 2: Run validation to verify it fails**

Run: `npm run validate:two-ply-yarn`

Expected: FAIL because the settings UI has not been added.

- [ ] **Step 3: Implement settings UI**

Add helper in `src/views/settingsModal.js`:

```js
function updateYarnPly(index, patch) {
  dispatch({
    yarnPlies: GLOBAL_STATE.yarnPlies.map((ply, plyIndex) =>
      plyIndex == index ? { ...ply, ...patch } : ply
    ),
  });
}
```

Add color picker helper:

```js
function editYarnPlyColor(index, target) {
  if (!target.jscolor) {
    const picker = new jscolor(target, {
      preset: "dark large",
      format: "hexa",
      value: GLOBAL_STATE.yarnPlies[index].color,
      onInput: () => updateYarnPly(index, { color: picker.toRGBAString() }),
      previewElement: null,
    });
  }
  target.jscolor.show();
}
```

Add UI under existing settings:

```js
<section class="settings-section yarn-ply-settings">
  <h3>纱线设置</h3>
  ${GLOBAL_STATE.yarnPlies.map(
    (ply, index) => html`
      <div class="yarn-ply-control">
        <div class="yarn-ply-title">${index == 0 ? "主纱" : "副纱"}</div>
        ${index == 1
          ? html`<label class="form-control toggle">
              <input
                type="checkbox"
                ?checked=${ply.enabled}
                @change=${(e) =>
                  updateYarnPly(index, { enabled: e.target.checked })} />
              显示副纱
            </label>`
          : ""}
        <button
          id="yarn-ply-color-${index}"
          class="btn solid yarn-ply-color-button"
          style="--current: ${ply.color};"
          @click=${(e) => editYarnPlyColor(index, e.currentTarget)}>
          ${index == 0 ? "主纱颜色" : "副纱颜色"}
        </button>
        <label class="form-control range">
          ${index == 0 ? "主纱直径" : "副纱直径"}
          <input
            type="range"
            min="0.06"
            max="0.5"
            step="0.01"
            .value=${String(ply.diameter)}
            @input=${(e) =>
              updateYarnPly(index, { diameter: Number(e.target.value) })} />
          <span>${ply.diameter.toFixed(2)}</span>
        </label>
      </div>
    `
  )}
</section>
```

Add restrained CSS for `.settings-section`, `.yarn-ply-control`, `.yarn-ply-color-button`.

- [ ] **Step 4: Run validations and browser check**

Run:

```powershell
npm run validate:two-ply-yarn
npm run validate:single-ui
npm run build
```

Browser check:

```js
// Settings modal should contain 纱线设置, 主纱颜色, 副纱颜色, 主纱直径, 副纱直径, 显示副纱.
```

- [ ] **Step 5: Spawn验收智能体**

Reviewer prompt:

```text
你是本步骤的验收智能体。请只验收 Task 2: Settings UI。
项目目录：C:\Users\liuchen\Desktop\GitHub\knitscape
要求：
1. 设置面板出现“纱线设置”。
2. 主纱/副纱都能设置固定颜色和直径。
3. 副纱有显示开关，主纱必须一直显示。
4. UI 使用现有 lit-html / jscolor / form-control 风格。
5. 不允许改模拟绘制逻辑，那是 Task 3。
6. 运行 npm run validate:two-ply-yarn、npm run validate:single-ui、npm run build。
请给出 PASS/FAIL 和具体问题。
```

- [ ] **Step 6: Update MD**

Add:

```text
双纱视觉方案 Step 2 已完成：设置面板新增纱线设置，可分别设置主纱/副纱固定颜色和直径，副纱可开关显示。
```

## Task 3: Render Fixed-Color Two-Ply Yarn

**Files:**
- Modify `src/components/runSimulation.js`
- Modify `src/simulation/yarnSimulation.js`
- Modify `scripts/validate-two-ply-yarn.mjs`
- Modify `KnitScape_单面布技术文档.md`

- [ ] **Step 1: Extend validation first**

Update `scripts/validate-two-ply-yarn.mjs`:

```js
const runSimulationSource = fs.readFileSync("src/components/runSimulation.js", "utf8");
assert.match(runSimulationSource, /GLOBAL_STATE\.yarnPlies/, "runSimulation must pass yarnPlies into simulate.");
assert.match(runSimulationSource, /"yarnPlies"/, "runSimulation must rerun when yarnPlies changes.");

const yarnSimulationSource = fs.readFileSync("src/simulation/yarnSimulation.js", "utf8");
assert.match(yarnSimulationSource, /function enabledYarnPlies/, "simulation must normalize enabled yarn plies.");
assert.match(yarnSimulationSource, /drawPlySegmentsToLayer/, "simulation must draw each ply independently.");
assert.doesNotMatch(yarnSimulationSource, /const YARN_RATIO = 0\.24/, "fixed YARN_RATIO must be replaced by per-ply diameter.");
```

- [ ] **Step 2: Run validation to verify it fails**

Run: `npm run validate:two-ply-yarn`

Expected: FAIL because renderer is still single-width.

- [ ] **Step 3: Pass yarnPlies into simulation**

Modify `src/components/runSimulation.js`:

```js
simulate(
  GLOBAL_STATE.chart,
  GLOBAL_STATE.yarnSequence.pixels,
  GLOBAL_STATE.yarnPalette,
  GLOBAL_STATE.simScale,
  GLOBAL_STATE.yarnPlies
)
```

Add `"yarnPlies"` to the `found` list in `syncState`.

- [ ] **Step 4: Draw each ply**

Modify `src/simulation/yarnSimulation.js`:

```js
const DEFAULT_RENDER_PLIES = [
  { color: "rgba(190,190,190,1)", diameter: 0.24, enabled: true },
];

function enabledYarnPlies(plies) {
  const normalized = (Array.isArray(plies) && plies.length ? plies : DEFAULT_RENDER_PLIES)
    .filter((ply, index) => index == 0 || ply.enabled !== false)
    .map((ply) => ({
      color: ply.color || "rgba(190,190,190,1)",
      diameter: Math.max(0.01, Number(ply.diameter) || 0.24),
    }));
  return normalized.length ? normalized : DEFAULT_RENDER_PLIES;
}
```

Change signature:

```js
export function simulate(pattern, yarnSequence, palette, scale, yarnPlies) {
```

Use max diameter for layout spacing:

```js
const renderPlies = enabledYarnPlies(yarnPlies);
const maxYarnDiameter = Math.max(...renderPlies.map((ply) => ply.diameter));
```

Replace fixed width:

```js
yarnWidth = stitchWidth * maxYarnDiameter;
```

Add draw helper:

```js
function drawPlySegmentsToLayer(context, layer, ply) {
  context.lineWidth = stitchWidth * ply.diameter;
  context.strokeStyle = ply.color;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.stroke(new Path2D(layer.paths.join(" ")));
}
```

Keep layer sorting by front/back/mid, but store plain `paths` arrays per layer:

```js
const layers = {
  front: { paths: [] },
  back: { paths: [] },
  mid: { paths: [] },
};
```

Draw order:

```js
for (const ply of renderPlies) {
  drawPlySegmentsToLayer(backCtx, layers.back, ply);
}
for (const ply of renderPlies) {
  drawPlySegmentsToLayer(frontCtx, layers.front, ply);
}
for (const ply of renderPlies) {
  drawPlySegmentsToLayer(midCtx, layers.mid, ply);
}
```

This makes yarn 2 draw after yarn 1 on the same path and appear attached on top.

- [ ] **Step 5: Run validations and browser check**

Run:

```powershell
npm run validate:two-ply-yarn
npm run validate:single-ui
npm run validate:repeat-dimensions
npm run build
```

Browser check:

```js
// Change yarn 1 and yarn 2 diameters in settings, verify no console errors and preview canvas remains nonblank.
```

- [ ] **Step 6: Spawn验收智能体**

Reviewer prompt:

```text
你是本步骤的验收智能体。请只验收 Task 3: Simulation Rendering。
项目目录：C:\Users\liuchen\Desktop\GitHub\knitscape
要求：
1. 单面布组织算法不变。
2. 模拟器使用同一条路径绘制主纱和副纱。
3. 主纱和副纱使用 yarnPlies 中的固定颜色。
4. 主纱和副纱使用 yarnPlies 中的独立 diameter。
5. 副纱绘制在主纱之后，视觉上附着在上面。
6. 关闭副纱时只画主纱。
7. 运行 npm run validate:two-ply-yarn、npm run validate:single-ui、npm run validate:repeat-dimensions、npm run build。
请给出 PASS/FAIL 和具体问题。
```

- [ ] **Step 7: Update MD**

Add:

```text
双纱视觉方案 Step 3 已完成：右侧单面布模拟预览使用同一条组织路径绘制主纱和副纱，副纱叠绘在主纱上方，两根纱线使用各自固定颜色和直径。
```

## Task 4: End-To-End Verification And Documentation

**Files:**
- Modify `KnitScape_单面布技术文档.md`

- [ ] **Step 1: Run full verification**

Run:

```powershell
npm run validate:two-ply-yarn
npm run validate:single-ui
npm run validate:repeat-dimensions
npm run validate:intranet
npm run build
```

- [ ] **Step 2: Browser verification**

Use local dev server and verify:

```text
设置面板有纱线设置。
主纱颜色可改。
副纱颜色可改。
主纱直径滑块可改。
副纱直径滑块可改。
关闭副纱后预览仍显示主纱。
开启副纱后预览仍非空。
顶部 Width/Height 60 x 80 仍正常。
repeat 4 x 8 仍不被顶部 Width/Height 改动。
```

- [ ] **Step 3: Spawn final验收智能体**

Reviewer prompt:

```text
你是最终验收智能体。请验收整个固定颜色双纱视觉方案。
项目目录：C:\Users\liuchen\Desktop\GitHub\knitscape
要求：
1. 两根纱线固定颜色可设置。
2. 两根纱线直径可分别设置。
3. 副纱可开关显示。
4. 第二根纱线沿第一根路径叠绘，不改变组织算法。
5. 原有单面布 Width/Height、4x8 repeat、边界拖动、画笔/填充/画线/矩形/退出都不被破坏。
6. 文档已更新。
7. 运行全部验证命令。
请给出 PASS/FAIL 和具体问题。
```

- [ ] **Step 4: Final MD update**

Add final section:

```text
双纱视觉方案最终验收通过：单面布模拟支持主纱/副纱固定颜色、独立直径和副纱显示开关；该方案仅改变右侧视觉渲染，不改变单面布组织生成逻辑。
```
