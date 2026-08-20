# Dual Repeat Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把三角座排列和排针排列恢复为“黑色循环单元编辑 + 灰色完整画布平铺”的双编辑器，默认完整画布为 60×60、循环单元为 8×4，并恢复固定共享色纱栏、同步缩放拖拽和稳定的尺寸输入。

**Architecture:** `camUnitBitmap` 与 `needleUnitBitmap` 是唯一可编辑针法数据；`camBitmap` 与 `needleBitmap` 由一个纯函数按 `canvasWidth × canvasHeight` 顶部对齐平铺得到，继续供模拟和导出读取。两个编辑器复用同一视图、渲染器和指针交互，使用共享的 `scale` 与 `chartPan`；色纱栏是画布窗口外的固定 gutter，只共享纵向变换和同一个 `yarnSequence`。

**Tech Stack:** Vite 4、原生 ES modules、lit-html、Canvas 2D、Split.js、Node `assert` 验证脚本、CSS。

---

## 执行进度（2026-08-20 午间暂停）

当前分支：`codex/one-shot-uniform-yarn-length`

最新业务代码提交：`a4fee38 fix: preserve repeat unit editing invariants`

工作树状态：干净，无未提交文件。

### 已完成并通过双阶段审查

- Task 1：循环单元派生层完成。`camUnitBitmap` / `needleUnitBitmap` 成为源数据，60×60 完整位图按顶部对齐方式派生；无关状态更新不会重建派生图。实现及修复提交：`465987a`、`7aa243f`、`44cd737`。
- Task 2：JSON v3、v2 迁移、旧 repeat 迁移完成。全部 15 个示例会动态参与验证，`loadJSON()` / `newPattern()` 有真实状态测试，导入色板不再与缓存 JSON 共用数组。实现及修复提交：`c52417d`、`c5f11d0`、`13bc582`。

### 已实现，下午先完成复审

- Task 3：尺寸、绘制、开始排针和应用排针已经改为操作循环单元源数据；`8×4 + 1/2/3/4` 生成 `4×8` 排针单元，完整画布尺寸不变；越界绘制不修改状态；撤销会同步恢复输入错误。实现及质量修复提交：`b37e50f`、`a4fee38`。
- Task 3 规格审查已通过。第一次代码质量审查提出的画笔字段中间态、撤销错误一致性、临时适配器校验、坐标别名和边界测试问题均已在 `a4fee38` 修复。
- 用户要求暂停时，Task 3 的代码质量复审正在运行，已经中止，尚未取得复审结论。

### 当前验证状态

- 开始实施前：`npm run build` 与当时全部 25 项 `validate:*` 均通过。
- Task 3 最新聚焦验证通过：`validate:bitmap-pointer-unit-boundary`、`validate:needle-arrangement-transform`、`validate:pattern-dimensions`、`validate:needle-arrangement-acceptance`、`validate:needle-arrangement-state`、`validate:dual-pattern-editor`、`validate:pattern-unit-derivation`、`validate:pattern-file-v3` 和 `npm run build`。
- `npm install` 报告仓库原有 7 个依赖审计提示（1 moderate、6 high）；本 UI 任务未擅自升级依赖。

### 下午恢复顺序

1. 重新进行 Task 3 代码质量复审，审查范围 `13bc582..a4fee38`；确认通过后将 Task 3 标记完成。
2. 从 Task 4 开始继续严格执行“实现 → 规格审查 → 代码质量审查”。
3. Task 4–8 完成前，页面仍不会完整呈现最终的顶部尺寸布局、黑色 8×4 单元、16×16 视角、同步缩放拖拽和双固定色纱栏；不要把当前浏览器外观当作最终结果。
4. Task 9 运行全部验证、生产构建和九项浏览器人工验收，然后进行整体代码审查与分支收尾。

## 实施约束

- 所有业务代码改动按测试驱动顺序完成：先补失败验证并确认失败，再写最小实现并确认通过。
- 不恢复旧版多 repeat、repeat 拖动/缩放边框、repeat 库等功能；旧提交 `d3e5a11` 只用于参考滚轮缩放、中键拖拽和黑色单元绘制方式。
- 不直接写 `camBitmap` 或 `needleBitmap`。状态层统一从完整画布尺寸和两个 unit 派生它们。
- 每完成一个任务，先运行该任务列出的验证，再提交该任务；不要把后续任务提前混入当前提交。
- 修改已有验证时，删除已失效的断言并替换为新架构断言；不得为了通过而弱化用户可见行为。

## Task 1: 建立循环单元到完整画布的纯派生层

**Files:**

- Create: `src/patternDerivation.js`
- Create: `scripts/validate-pattern-unit-derivation.mjs`
- Modify: `src/state.js`
- Modify: `src/constants.js`
- Modify: `package.json`
- Modify: `scripts/validate-needle-arrangement-state.mjs`

- [x] **Step 1: 写纯函数和默认状态的失败验证**

在 `scripts/validate-pattern-unit-derivation.mjs` 中覆盖以下事实：

```js
import assert from "node:assert/strict";
import { Bimp } from "../src/lib/Bimp.js";
import {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_UNIT_HEIGHT,
  DEFAULT_UNIT_WIDTH,
  derivePatternBitmaps,
  tileUnitToCanvas,
} from "../src/patternDerivation.js";

assert.deepEqual(
  [DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT, DEFAULT_UNIT_WIDTH, DEFAULT_UNIT_HEIGHT],
  [60, 60, 8, 4]
);

const unit = new Bimp(2, 2, [0, 1, 2, 3]);
const tiled = tileUnitToCanvas(3, 5, unit);
assert.deepEqual(tiled.make2d(), [
  [2, 3, 2],
  [0, 1, 0],
  [2, 3, 2],
  [0, 1, 0],
  [2, 3, 2],
]);

const derived = derivePatternBitmaps({
  canvasWidth: 5,
  canvasHeight: 3,
  camUnitBitmap: unit,
  needleUnitBitmap: new Bimp(1, 2, [3, 2]),
});
assert.deepEqual([derived.camBitmap.width, derived.camBitmap.height], [5, 3]);
assert.deepEqual([derived.needleBitmap.width, derived.needleBitmap.height], [5, 3]);
```

再通过 Vite SSR 载入 `src/state.js`，断言默认 `canvasWidth/canvasHeight` 为 60×60、两个 unit 为 8×4、两个派生 bitmap 为 60×60，并断言 `loadWorkspace()`、普通 `dispatch()` 和 `undo()` 后派生 bitmap 都与当前 unit/尺寸一致。

- [x] **Step 2: 运行验证，确认红灯**

Run: `node scripts/validate-pattern-unit-derivation.mjs`

Expected: 因 `src/patternDerivation.js` 不存在或新状态字段不存在而失败。

- [x] **Step 3: 实现顶部对齐的派生函数**

在 `src/patternDerivation.js` 中加入明确的唯一派生入口：

```js
import { Bimp } from "./lib/Bimp.js";

export const DEFAULT_CANVAS_WIDTH = 60;
export const DEFAULT_CANVAS_HEIGHT = 60;
export const DEFAULT_UNIT_WIDTH = 8;
export const DEFAULT_UNIT_HEIGHT = 4;

export function tileUnitToCanvas(width, height, unit) {
  return Bimp.fromTile(width, height, unit.vFlip()).vFlip();
}

export function derivePatternBitmaps(state) {
  return {
    camBitmap: tileUnitToCanvas(
      state.canvasWidth,
      state.canvasHeight,
      state.camUnitBitmap
    ),
    needleBitmap: tileUnitToCanvas(
      state.canvasWidth,
      state.canvasHeight,
      state.needleUnitBitmap
    ),
  };
}

export function withDerivedPatternBitmaps(state) {
  return { ...state, ...derivePatternBitmaps(state) };
}
```

`vFlip() -> fromTile() -> vFlip()` 保证视觉顶部第一行从 unit 的顶部第一行开始，即完整画布高度不是 unit 高度倍数时也不发生顶部错相。

- [x] **Step 4: 把状态所有权切换到 unit 和画布尺寸**

在 `src/state.js` 中：

- 以 8×4 的 `defaultCamUnitBitmap` 初始化 `camUnitBitmap`，深拷贝初始化 `needleUnitBitmap`；
- 增加 `canvasWidth: 60`、`canvasHeight: 60`、`chartPan: { x: 0, y: 0 }`；
- 使用 `withDerivedPatternBitmaps()` 初始化 `GLOBAL_STATE`；
- 让 `normalUpdate`、`snapshotUpdate`、`loadWorkspace`、`undo` 在源字段变化后重新派生两个完整 bitmap；
- 向组件报告派生字段也发生了变化，但绝不把派生字段放入撤销快照。

使用这一组源字段判断是否需要派生：

```js
const PATTERN_SOURCE_FIELDS = new Set([
  "canvasWidth",
  "canvasHeight",
  "camUnitBitmap",
  "needleUnitBitmap",
]);

function changesAffectPattern(changes) {
  return changes.some((field) => PATTERN_SOURCE_FIELDS.has(field));
}
```

`SNAPSHOT_FIELDS` 改为包含 `canvasWidth`、`canvasHeight`、`camUnitBitmap`、`needleUnitBitmap`，移除 `camBitmap`、`needleBitmap`。`dispatch()` 和 `undo()` 在源字段恢复后给 `StateMonitor.syncState` 的 changes 追加 `camBitmap`、`needleBitmap`。

- [x] **Step 5: 更新状态所有权验证与 npm 命令**

在 `scripts/validate-needle-arrangement-state.mjs` 中把旧的“不能有 repeats”断言保留，但将业务字段期望改为：

```js
for (const field of [
  "canvasWidth",
  "canvasHeight",
  "camUnitBitmap",
  "needleUnitBitmap",
  "needleInputs",
  "appliedNeedleInputs",
]) {
  assert.match(stateSource, new RegExp(`\\b${field}\\s*:`));
}
assert.doesNotMatch(constantsSource, /"camBitmap"|"needleBitmap"/);
assert.match(constantsSource, /"camUnitBitmap"/);
assert.match(constantsSource, /"needleUnitBitmap"/);
```

在 `package.json` 增加：

```json
"validate:pattern-unit-derivation": "node --experimental-default-type=module scripts/validate-pattern-unit-derivation.mjs"
```

- [x] **Step 6: 运行验证，确认绿灯**

Run: `npm run validate:pattern-unit-derivation && npm run validate:needle-arrangement-state`

Expected: 两条命令均输出 `PASS`。

- [x] **Step 7: 提交**

```bash
git add src/patternDerivation.js src/state.js src/constants.js scripts/validate-pattern-unit-derivation.mjs scripts/validate-needle-arrangement-state.mjs package.json
git commit -m "refactor: derive charts from repeat units"
```

## Task 2: 升级 JSON v3，并迁移 repeat 与 v2 文件

**Files:**

- Modify: `src/patternFile.js`
- Modify: `src/actions/importers.js`
- Create: `scripts/validate-pattern-file-v3.mjs`
- Delete: `scripts/validate-pattern-file-v2.mjs`
- Modify: `package.json`
- Modify: `examples/*.json` only if an example is intentionally re-saved; otherwise leave examples untouched and rely on migration

- [x] **Step 1: 写 JSON v3 往返与迁移失败验证**

将 v2 验证升级为 `scripts/validate-pattern-file-v3.mjs`，至少构造三份内存数据：

```js
const v3State = {
  canvasWidth: 60,
  canvasHeight: 60,
  camUnitBitmap: new Bimp(8, 4, Array(32).fill(1)),
  needleUnitBitmap: new Bimp(4, 8, Array(32).fill(2)),
  needleInputs: ["1", "2", "3", "4"],
  appliedNeedleInputs: ["1", "2", "3", "4"],
  yarnPalette: ["#abcdef"],
  yarnSequence: new Bimp(1, 60, Array(60).fill(0)),
  yarnPlies: [{ name: "main" }],
};
```

验证：

- v3 序列化只写 `canvasWidth/canvasHeight/camUnitBitmap/needleUnitBitmap`，不写两个派生 bitmap；
- v3 往返保持 60×60、8×4 与 4×8；
- v2 的 `camBitmap` 和 `needleBitmap` 分别成为对应 unit，完整画布默认为 60×60；
- repeat 旧格式采用第一个 repeat 的原始 bitmap 作为 cam unit，needle unit 是深拷贝，完整画布优先取旧 `width/height`；
- unit 像素数量错误、画布尺寸不在 5–500、输入不是四项时抛出带字段名的错误。

- [x] **Step 2: 运行验证，确认红灯**

Run: `node --experimental-default-type=module scripts/validate-pattern-file-v3.mjs`

Expected: 当前 `PATTERN_SCHEMA_VERSION === 2`，因此版本、字段或迁移断言失败。

- [x] **Step 3: 实现 v3 格式**

把 `PATTERN_SCHEMA_VERSION` 改为 3。`serializePattern()` 返回：

```js
return {
  schemaVersion: PATTERN_SCHEMA_VERSION,
  canvasWidth: state.canvasWidth,
  canvasHeight: state.canvasHeight,
  camUnitBitmap: state.camUnitBitmap.toJSON(),
  needleUnitBitmap: state.needleUnitBitmap.toJSON(),
  needleInputs: [...state.needleInputs],
  appliedNeedleInputs: [...state.appliedNeedleInputs],
  yarnPalette: state.yarnPalette,
  yarnSequence: state.yarnSequence.toJSON(),
  yarnPlies: state.yarnPlies,
};
```

`deserializePattern()` 分成明确的三个分支：

```js
if (pattern.schemaVersion === 3) return deserializeV3(pattern);
if (pattern.schemaVersion === 2) return migrateV2(pattern);
if (pattern.schemaVersion === undefined && Array.isArray(pattern.repeats)) {
  return migrateLegacyRepeats(pattern);
}
throw new Error(`Unsupported pattern schema version ${pattern.schemaVersion}.`);
```

迁移 repeat 时不再把 repeat 展开后当成唯一数据；取 `repeats[0].bitmap` 为 unit。v2 的完整位图本身作为 unit 保存，不裁剪。所有分支最终返回 source fields，并调用统一派生函数生成兼容用的 `camBitmap/needleBitmap`。

- [x] **Step 4: 更新导入与新建项目**

`src/actions/importers.js` 的 `loadJSON()` 只 dispatch source fields；`yarnSequence` 规范到 `canvasHeight`。`newPattern()` 创建 60×60 画布、8×4 cam unit、其深拷贝 needle unit，并创建 60 行色纱：

```js
dispatch({
  canvasWidth: DEFAULT_CANVAS_WIDTH,
  canvasHeight: DEFAULT_CANVAS_HEIGHT,
  camUnitBitmap,
  needleUnitBitmap: cloneBitmap(camUnitBitmap),
  yarnSequence: normalizeYarnSequence(undefined, {
    height: DEFAULT_CANVAS_HEIGHT,
    fillYarn: 0,
  }),
  // palette、plies、inputs、errors 同现有重置逻辑
});
```

- [x] **Step 5: 替换 npm 命令并运行迁移回归**

将 `validate:pattern-file-v2` 替换为：

```json
"validate:pattern-file-v3": "node --experimental-default-type=module scripts/validate-pattern-file-v3.mjs"
```

Run: `npm run validate:pattern-file-v3 && npm run validate:yarn-sequence-editor`

Expected: 两条命令均输出 `PASS`，现有 examples 无需批量改写即可载入。

- [x] **Step 6: 提交**

```bash
git add src/patternFile.js src/actions/importers.js scripts/validate-pattern-file-v3.mjs scripts/validate-pattern-file-v2.mjs package.json
git commit -m "feat: migrate pattern files to repeat units"
```

## Task 3: 让尺寸、绘制、开始与应用动作只修改源数据

**Files:**

- Modify: `src/actions/patternEditing.js`
- Modify: `src/needleArrangement/transform.js`
- Modify: `scripts/validate-pattern-dimension-sync.mjs`
- Modify: `scripts/validate-needle-arrangement-acceptance.mjs`
- Modify: `scripts/validate-needle-arrangement-transform.mjs`

- [x] **Step 1: 把动作验收改成新行为并确认失败**

更新验证，明确断言：

```js
resizePatternCanvas(72, 81);
assert.deepEqual(
  [GLOBAL_STATE.canvasWidth, GLOBAL_STATE.canvasHeight],
  [72, 81]
);
assert.deepEqual(
  [GLOBAL_STATE.camUnitBitmap.width, GLOBAL_STATE.camUnitBitmap.height],
  [8, 4]
);
assert.deepEqual(
  [GLOBAL_STATE.camBitmap.width, GLOBAL_STATE.camBitmap.height],
  [72, 81]
);
assert.equal(GLOBAL_STATE.yarnSequence.height, 81);

startNeedleArrangement();
assert.deepEqual(
  [GLOBAL_STATE.needleUnitBitmap.width, GLOBAL_STATE.needleUnitBitmap.height],
  [8, 4]
);
assert.notEqual(GLOBAL_STATE.needleUnitBitmap, GLOBAL_STATE.camUnitBitmap);

assert.equal(applyNeedleArrangement(), true);
assert.deepEqual(
  [GLOBAL_STATE.needleUnitBitmap.width, GLOBAL_STATE.needleUnitBitmap.height],
  [4, 8]
);
assert.deepEqual(
  [GLOBAL_STATE.needleBitmap.width, GLOBAL_STATE.needleBitmap.height],
  [72, 81]
);
```

增加灰色区域不可编辑的动作级断言：传入 unit 范围外的坐标时不 dispatch 新 unit；无效排针输入不改变 `needleUnitBitmap`、派生完整 bitmap 或 `appliedNeedleInputs`。

Run: `npm run validate:pattern-dimensions && npm run validate:needle-arrangement-acceptance`

Expected: 当前动作仍直接 resize/写入完整 bitmap，因此失败。

- [x] **Step 2: 实现统一画布尺寸动作**

删除 `resizePatternBitmap(field, width, height)`，新增：

```js
export function normalizeCanvasDimension(value) {
  return Math.max(5, Math.min(500, Math.floor(Number(value) || 5)));
}

export function resizePatternCanvas(width, height) {
  const canvasWidth = normalizeCanvasDimension(width);
  const canvasHeight = normalizeCanvasDimension(height);
  dispatch({
    canvasWidth,
    canvasHeight,
    yarnSequence: resizeYarnSequenceToNeedleHeight(
      GLOBAL_STATE.yarnSequence,
      canvasHeight,
      GLOBAL_STATE.activeYarn
    ),
  });
}
```

横向和纵向输入都调用这一动作；unit 尺寸永不随完整画布尺寸改变。

- [x] **Step 3: 将绘制和排针转换切换到 unit**

允许绘制的字段只包括 `camUnitBitmap`、`needleUnitBitmap`。`drawPatternLine()` 对越界点直接返回 `false`，合法绘制 dispatch unit 与 `patternEdit`：

```js
dispatch({
  [field]: unit.line(startPos, endPos, GLOBAL_STATE.activeSymbol),
  patternEdit: { field, startPos, endPos },
});
return true;
```

`startNeedleArrangement()` 深拷贝 `camUnitBitmap`；`applyNeedleArrangement()` 使用 `camUnitBitmap.height` 校验，并调用：

```js
const needleUnitBitmap = buildNeedleBitmap(
  GLOBAL_STATE.camUnitBitmap,
  validation.sequence
);
```

成功后只写 `needleUnitBitmap`、`appliedNeedleInputs` 和清空后的错误；不改完整画布尺寸与色纱高度。保持现有转换公式，使 8×4 + 1234 得到 4×8。

- [x] **Step 4: 运行动作与撤销回归**

Run: `npm run validate:needle-arrangement-transform && npm run validate:pattern-dimensions && npm run validate:needle-arrangement-acceptance && npm run validate:pattern-unit-derivation`

Expected: 四条命令均输出 `PASS`，撤销后 source fields 与派生 bitmap 一致。

- [x] **Step 5: 提交**

```bash
git add src/actions/patternEditing.js src/needleArrangement/transform.js scripts/validate-pattern-dimension-sync.mjs scripts/validate-needle-arrangement-acceptance.mjs scripts/validate-needle-arrangement-transform.mjs
git commit -m "feat: edit and transform repeat units"
```

## Task 4: 重排顶部尺寸输入与排针控件，并修复输入焦点问题

**Files:**

- Modify: `src/views/chartEditorToolbar.js`
- Modify: `src/views/bitmapEditor.js`
- Modify: `src/views/needleArrangementControls.js`
- Modify: `src/views/view.js`
- Modify: `src/events/keypressEvents.js`
- Modify: `styles.css`
- Modify: `base.css` only if the generic number-input rule cannot be safely overridden from `styles.css`
- Modify: `scripts/validate-central-stitch-toolbar.mjs`
- Modify: `scripts/validate-dual-pattern-editor.mjs`
- Create: `scripts/validate-dimension-input-focus.mjs`
- Modify: `package.json`

- [ ] **Step 1: 写布局与输入事件失败验证**

静态验证应断言：

- `chartEditorToolbar` 在四种针法按钮之后渲染唯一的横向/纵向输入；值分别来自 `canvasWidth/canvasHeight`，代码向导 key 为 `canvas.width`、`canvas.height`；
- 输入为 `type="number" min="5" max="500" step="1"`，使用 `@change` 和 Enter 提交；
- `bitmapEditor` 不再含尺寸输入；
- `needleArrangementControls()` 只出现在排针 pane 标题下方，不在两个 pane 上方；
- 排针控件顺序为开始、四输入、应用。

`scripts/validate-dimension-input-focus.mjs` 通过提取并测试导出的守卫函数验证：

```js
assert.equal(isEditableTarget({ tagName: "INPUT" }), true);
assert.equal(isEditableTarget({ tagName: "SELECT" }), true);
assert.equal(isEditableTarget({ tagName: "TEXTAREA" }), true);
assert.equal(isEditableTarget({ tagName: "DIV", isContentEditable: true }), true);
assert.equal(isEditableTarget({ tagName: "BUTTON" }), false);
```

Run: `npm run validate:central-stitch-toolbar && npm run validate:dual-pattern-editor && node scripts/validate-dimension-input-focus.mjs`

Expected: 旧布局和缺失守卫导致失败。

- [ ] **Step 2: 在顶部工具栏添加统一尺寸控件**

在 `chartEditorToolbar.js` 增加一个提交辅助函数，只在 change 或 Enter 时读取 DOM 值：

```js
function commitDimension(field, value) {
  const width = field === "canvasWidth" ? value : GLOBAL_STATE.canvasWidth;
  const height = field === "canvasHeight" ? value : GLOBAL_STATE.canvasHeight;
  resizePatternCanvas(width, height);
}
```

四个针法按钮后渲染 `.chart-size-controls`，两个 label 的 input 明确使用 `.input.pattern-dimension-input`、`min="5"`、`max="500"`、`step="1"`。`@keydown` 只在 Enter 时 `blur()` 或调用同一 `commitDimension`，避免每个字符都重绘。

- [ ] **Step 3: 把排针控件嵌入排针标题下方**

`bitmapEditor()` 改为按 `unitField`/`prefix` 接收配置；当 prefix 为 needle 时，在 header 后渲染 `needleArrangementControls()`。从 `view.js` 删除全局 `${needleArrangementControls()}`，两个调用改为：

```js
bitmapEditor({
  fullField: "camBitmap",
  unitField: "camUnitBitmap",
  titleKey: "cam.title",
  prefix: "cam",
});
bitmapEditor({
  fullField: "needleBitmap",
  unitField: "needleUnitBitmap",
  titleKey: "needle.title",
  prefix: "needle",
  showNeedleControls: true,
});
```

移除排针控件里 start/apply 后的 `fitChart()`，保证点击按钮不改变共享视角。

- [ ] **Step 4: 修复数字快捷键抢占输入**

在 `keypressEvents.js` 导出并使用：

```js
export function isEditableTarget(target) {
  const tagName = target?.tagName?.toUpperCase();
  return (
    tagName === "INPUT" ||
    tagName === "SELECT" ||
    tagName === "TEXTAREA" ||
    target?.isContentEditable === true
  );
}
```

`keydown` 回调的第一行在该函数为 true 时直接返回；`keyup` 仍安全清理 held keys，但不要触发数字针法快捷键。

- [ ] **Step 5: 恢复黑字和原生步进按钮**

在 `styles.css` 后置覆盖：

```css
.pattern-dimension-input,
.pattern-dimension-input:focus,
.pattern-dimension-input:active {
  color: #111;
  -moz-appearance: auto;
  appearance: auto;
}

.pattern-dimension-input::-webkit-inner-spin-button,
.pattern-dimension-input::-webkit-outer-spin-button {
  -webkit-appearance: auto;
  margin: 0;
  opacity: 1;
}

.pattern-dimension-input::selection {
  color: #111;
}
```

如果 `base.css` 的隐藏规则仍覆盖，再把它限定到不含 `.pattern-dimension-input` 的 number input；不能影响其他输入。

- [ ] **Step 6: 运行布局与输入验证**

在 `package.json` 增加：

```json
"validate:dimension-input-focus": "node scripts/validate-dimension-input-focus.mjs"
```

Run: `npm run validate:central-stitch-toolbar && npm run validate:dual-pattern-editor && npm run validate:dimension-input-focus && npm run validate:single-ui && npm run validate:i18n`

Expected: 全部输出 `PASS`。

- [ ] **Step 7: 提交**

```bash
git add src/views/chartEditorToolbar.js src/views/bitmapEditor.js src/views/needleArrangementControls.js src/views/view.js src/events/keypressEvents.js styles.css base.css scripts/validate-central-stitch-toolbar.mjs scripts/validate-dual-pattern-editor.mjs scripts/validate-dimension-input-focus.mjs package.json
git commit -m "feat: move dimensions and needle controls"
```

## Task 5: 构建固定 gutter 与裁剪画布的双编辑器 DOM

**Files:**

- Modify: `src/views/bitmapEditor.js`
- Modify: `styles.css`
- Modify: `scripts/validate-dual-pattern-editor.mjs`
- Create: `scripts/validate-repeat-editor-layout.mjs`
- Modify: `package.json`

- [ ] **Step 1: 写 DOM/CSS 结构失败验证**

验证每个 editor 都包含：

- `.pattern-editor-stage`：裁剪后的 16×16 显示区域；
- `.yarn-sequence-gutter`：stage 的独立左列；
- `.pattern-grid-window`：右侧灰色画布窗口；
- `.pattern-canvas-transform`：只承载可平移的完整画布；
- full symbol、full grid、unit symbol、unit grid、interaction 五层 canvas；
- cam/needle 两个唯一色纱 canvas ID；
- gutter 与 grid window 是 CSS grid 的相邻列，不使用负 margin 或 absolute 让它们叠加。

核心 CSS 断言应包含 `overflow: hidden`、gutter 的固定列宽以及 transform 层。

Run: `node scripts/validate-repeat-editor-layout.mjs`

Expected: 当前只有 needle 色纱栏且 viewport 使用滚动布局，因此失败。

- [ ] **Step 2: 重建可复用 editor 模板**

`bitmapEditor()` 输出如下层级，并为两个 pane 生成不同 ID：

```html
<div class="pattern-editor-stage">
  <div class="yarn-sequence-gutter">
    <div class="yarn-sequence-track">
      <canvas id="cam-yarn-sequence-canvas"></canvas>
    </div>
  </div>
  <div class="pattern-grid-window" data-editor-prefix="cam">
    <div class="pattern-canvas-transform">
      <div class="pattern-canvas-stack">
        <canvas class="pattern-full-symbol-canvas"></canvas>
        <canvas class="pattern-full-grid-canvas"></canvas>
        <canvas class="pattern-unit-symbol-canvas"></canvas>
        <canvas class="pattern-unit-grid-canvas"></canvas>
        <canvas class="pattern-interaction-canvas"></canvas>
      </div>
    </div>
  </div>
</div>
```

needle 使用同结构和 `needle-yarn-sequence-canvas`。实际 lit 模板中的 IDs 继续保留 `cam-symbol-canvas`、`symbol-canvas`、`cam-grid`、`grid` 以减少代码向导和现有验证迁移量；新 unit canvas 使用 `${prefix}-unit-symbol-canvas` 和 `${prefix}-unit-grid`。

- [ ] **Step 3: 用 CSS 保证永不交叉**

实现以下布局规则：

```css
.pattern-editor-stage {
  --visible-cells: 16;
  display: grid;
  grid-template-columns: var(--chart-cell-size) minmax(0, 1fr);
  width: min(100%, calc(var(--chart-cell-size) * 17));
  height: min(100%, calc(var(--chart-cell-size) * 16));
  overflow: hidden;
}

.yarn-sequence-gutter,
.pattern-grid-window {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.yarn-sequence-gutter {
  z-index: 5;
  width: var(--chart-cell-size);
  background: #fff;
  border-right: 2px solid #2f3437;
}

.pattern-canvas-transform,
.yarn-sequence-track {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
}
```

`.pattern-canvas-transform` 使用 x/y 共享 transform；`.yarn-sequence-track` 只使用 y transform。不要让任何色纱元素 absolute 到 `.pattern-grid-window` 内。

- [ ] **Step 4: 运行结构验证**

在 `package.json` 增加：

```json
"validate:repeat-editor-layout": "node scripts/validate-repeat-editor-layout.mjs"
```

Run: `npm run validate:repeat-editor-layout && npm run validate:dual-pattern-editor`

Expected: 两条命令均输出 `PASS`。

- [ ] **Step 5: 提交**

```bash
git add src/views/bitmapEditor.js styles.css scripts/validate-repeat-editor-layout.mjs scripts/validate-dual-pattern-editor.mjs package.json
git commit -m "feat: add clipped repeat editor layout"
```

## Task 6: 绘制灰色平铺结果和黑色可编辑单元

**Files:**

- Modify: `src/components/drawBitmapEditor.js`
- Modify: `src/events/bitmapPointerInteraction.js`
- Modify: `src/index.js`
- Modify: `styles.css`
- Modify: `scripts/validate-dual-pattern-editor.mjs`
- Create: `scripts/validate-repeat-unit-rendering.mjs`
- Modify: `package.json`

- [ ] **Step 1: 写渲染和命中区域失败验证**

扩展 MockCanvas/MockContext，使其记录 `fillStyle`、`fillRect`、`strokeStyle`。验证：

- full canvas 尺寸为 60×60 cells，背景采用灰色语义；
- unit canvas 尺寸为 8×4，普通成圈格为黑底白线，半针/平针等 bit 格按现有符号规则保持可辨识；
- unit 变更会重新绘制派生 full canvas 和 unit canvas；
- `positionInEditableUnit()` 对 unit 内返回 Bimp 坐标，对灰色范围返回 `null`；
- 在灰色范围 pointerdown 不调用 `drawPatternLine()`。

推荐将坐标纯函数导出后直接测试：

```js
assert.deepEqual(
  positionInEditableUnit({ displayX: 0, displayY: 0 }, unit),
  { x: 0, y: unit.height - 1 }
);
assert.equal(
  positionInEditableUnit({ displayX: unit.width, displayY: 0 }, unit),
  null
);
```

Run: `node scripts/validate-repeat-unit-rendering.mjs`

Expected: 当前 renderer 只有完整白色画布且交互允许整张图绘制，因此失败。

- [ ] **Step 2: 将 renderer 参数改成 full + unit 两套画布**

`drawBitmapEditor()` 接受：

```js
{
  fullField,
  unitField,
  fullSymbolCanvas,
  fullGridCanvas,
  unitSymbolCanvas,
  unitGridCanvas,
  interactionCanvas,
}
```

full 层按 `state[fullField]` 绘制为灰色只读结果；unit 层按 `state[unitField]` 绘制黑底/白线。interaction canvas 尺寸跟 full bitmap 一致。unit canvas 左上角绝对定位，不接受自己的独立 transform。

使用明确 palette，而不是依赖页面背景：

```js
const FULL_CELL_FILL = "#b9b9b9";
const FULL_BIT_FILL = "#f4f4f4";
const FULL_STROKE = "#2f3437";
const UNIT_CELL_FILL = "#050505";
const UNIT_BIT_FILL = "#f7f7f7";
const UNIT_DARK_STROKE = "#111";
const UNIT_LIGHT_STROKE = "#f2f2f2";
```

unit 更新时允许完整重画 60×60 full 层和 8×4 unit 层；不得在每次 `chartPan` 变化时重设 canvas width/height 或重画像素，平移只由 DOM transform 完成。

- [ ] **Step 3: 把左键绘制限制在黑色 unit**

`bitmapPointerInteraction(canvas)` 读取 `data-unit-field`。先根据 canvas 的 transformed bounding rect 和 `scale/devicePixelRatio` 得到从顶部计算的 display cell，再映射为 unit 的 Bimp y：

```js
const x = Math.floor((event.clientX - bounds.left) / cellSize);
const displayY = Math.floor((event.clientY - bounds.top) / cellSize);
if (x < 0 || displayY < 0 || x >= unit.width || displayY >= unit.height) {
  return null;
}
return { x, y: unit.height - displayY - 1 };
```

左键只有得到非 null 坐标才开始 pointer capture 和 line 绘制。中键留给 Task 7 的平移分支。

- [ ] **Step 4: 在入口注册新的画布引用**

`src/index.js` 为 cam 和 needle 各查询 full/unit/grid/interaction 画布，并分别注册一次 `drawBitmapEditor` 与 `bitmapPointerInteraction`。删除 `drawYarnColors(yarnColorCanvas)` 注册和旧 `yarn-color-canvas` 查询，保证灰色 full 层不再被单边色纱背景覆盖。

- [ ] **Step 5: 运行渲染与交互验证**

在 `package.json` 增加：

```json
"validate:repeat-unit-rendering": "node scripts/validate-repeat-unit-rendering.mjs"
```

Run: `npm run validate:repeat-unit-rendering && npm run validate:dual-pattern-editor && npm run validate:event-driven-render`

Expected: 全部输出 `PASS`；最后一项确认 pan 变化不触发昂贵重绘，unit 编辑会正确刷新派生结果。

- [ ] **Step 6: 提交**

```bash
git add src/components/drawBitmapEditor.js src/events/bitmapPointerInteraction.js src/index.js styles.css scripts/validate-dual-pattern-editor.mjs scripts/validate-repeat-unit-rendering.mjs package.json
git commit -m "feat: render editable black repeat units"
```

## Task 7: 恢复共享滚轮缩放、中键拖拽和默认 16×16 视角

**Files:**

- Create: `src/chartViewport.js`
- Create: `src/events/chartPointerPanZoom.js`
- Modify: `src/actions/zoomFit.js`
- Modify: `src/views/bitmapEditor.js`
- Modify: `src/events/bitmapPointerInteraction.js`
- Modify: `src/index.js`
- Modify: `styles.css`
- Create: `scripts/validate-shared-chart-viewport.mjs`
- Modify: `package.json`

- [ ] **Step 1: 写共享视口数学与事件失败验证**

`scripts/validate-shared-chart-viewport.mjs` 直接测试纯函数：

```js
const fitted = fitVisibleCells({
  viewportWidth: 340,
  viewportHeight: 320,
  visibleColumns: 16,
  visibleRows: 16,
  gutterColumns: 1,
  devicePixelRatio: 1,
});
assert.equal(fitted.scale, 20);
assert.deepEqual(fitted.pan, { x: 0, y: 0 });

const zoomed = zoomViewportAtPoint({
  pan: { x: 10, y: 20 },
  scale: 20,
  nextScale: 24,
  point: { x: 100, y: 120 },
  devicePixelRatio: 1,
});
assert.deepEqual(zoomed.pan, { x: -8, y: 0 });
```

静态验证两个 `.pattern-grid-window` 都注册同一个 `chartPointerPanZoom`，且事件只 dispatch 全局 `scale/chartPan`，没有 per-editor pan/scale 字段。验证 wheel 与中键都 `preventDefault()`，左键仍交给 unit brush。

Run: `node scripts/validate-shared-chart-viewport.mjs`

Expected: 新模块和共享 `chartPan` 行为不存在，因此失败。

- [ ] **Step 2: 实现无 DOM 的视口数学**

在 `src/chartViewport.js` 导出：

```js
export function cssCellSize(scale, dpr = devicePixelRatio) {
  return scale / dpr;
}

export function fitVisibleCells({
  viewportWidth,
  viewportHeight,
  visibleColumns = 16,
  visibleRows = 16,
  gutterColumns = 1,
  devicePixelRatio: dpr = devicePixelRatio,
}) {
  const cssSize = Math.floor(
    Math.min(
      viewportWidth / (visibleColumns + gutterColumns),
      viewportHeight / visibleRows
    )
  );
  return {
    scale: clampScale(cssSize * dpr),
    pan: { x: 0, y: 0 },
  };
}

export function zoomViewportAtPoint({ pan, scale, nextScale, point, devicePixelRatio: dpr = devicePixelRatio }) {
  const oldCell = cssCellSize(scale, dpr);
  const newCell = cssCellSize(clampScale(nextScale), dpr);
  const chartPoint = {
    x: (point.x - pan.x) / oldCell,
    y: (point.y - pan.y) / oldCell,
  };
  return {
    scale: clampScale(nextScale),
    pan: {
      x: point.x - chartPoint.x * newCell,
      y: point.y - chartPoint.y * newCell,
    },
  };
}
```

`clampScale` 使用现有 `MIN_SCALE/MAX_SCALE`。如果缩放请求已越界，返回当前 state，而不是改变锚点。

- [ ] **Step 3: 实现滚轮和中键事件**

`chartPointerPanZoom(windowElement)`：

- wheel 读取指针相对 window 的位置，按 `reverseScroll` 选择 `scale ± 1`，调用 `zoomViewportAtPoint`，dispatch 同一 `scale/chartPan`；
- `pointerdown` 仅 `button === 1` 开始拖动；保存起始 pointer 与起始 pan，move 时 dispatch `{ chartPan: { x: start.x + dx, y: start.y + dy } }`；
- 设置/release pointer capture；处理 pointerup/pointercancel；auxclick 阻止浏览器自动滚屏；
- 使用 `{ passive: false }` 注册 wheel 并调用 `preventDefault()`。

不要从旧版复制 `selectChartCell` 或空白区左键拖动逻辑。

- [ ] **Step 4: 让两个 editor 使用同一 transform**

`bitmapEditor()` 根据 `GLOBAL_STATE.scale/devicePixelRatio` 设置 `--chart-cell-size`，并设置：

```js
const canvasTransform = `translate(${GLOBAL_STATE.chartPan.x}px, ${GLOBAL_STATE.chartPan.y}px)`;
const yarnTransform = `translateY(${GLOBAL_STATE.chartPan.y}px)`;
```

两个 editor 都读取相同状态。色纱 track 只应用 `yarnTransform`，不读取 pan.x。

- [ ] **Step 5: 将 fitChart 改成 16×16 初始视角**

`fitChart()` 查询两个 `.pattern-editor-viewport` 外框的可用尺寸，按 16 个画布列 + 1 个 gutter 列、16 个画布行计算各自 scale，取两个 pane 中更小的 scale，dispatch `chartPan: {0,0}`。它不再根据完整 bitmap 60×60 缩到全图，也不能用当前 `.pattern-grid-window` 的尺寸反推 scale，避免和 CSS cell size 形成循环。初始 load/new/upload 后调用；window resize 先 `measureWindow()`，再 `fitChart()`。

标准桌面下 `.pattern-editor-stage` 的右侧窗口尺寸等于 `16 * cssCellSize`，因此只显示 16×16；空间不足时 scale 下调，仍不显示超过 16×16。

- [ ] **Step 6: 运行共享视口验证**

在 `package.json` 增加：

```json
"validate:shared-chart-viewport": "node --experimental-default-type=module scripts/validate-shared-chart-viewport.mjs"
```

Run: `npm run validate:shared-chart-viewport && npm run validate:repeat-editor-layout && npm run validate:repeat-unit-rendering`

Expected: 全部输出 `PASS`。

- [ ] **Step 7: 提交**

```bash
git add src/chartViewport.js src/events/chartPointerPanZoom.js src/actions/zoomFit.js src/views/bitmapEditor.js src/events/bitmapPointerInteraction.js src/index.js styles.css scripts/validate-shared-chart-viewport.mjs package.json
git commit -m "feat: synchronize repeat editor pan and zoom"
```

## Task 8: 将共享色纱序列接到两个固定 gutter

**Files:**

- Modify: `src/components/yarnSequenceCanvas.js`
- Modify: `src/events/colorSequencePointerInteraction.js`
- Modify: `src/events/colorSequenceTouchInteraction.js`
- Modify: `src/actions/yarnSequenceRows.js`
- Modify: `src/index.js`
- Modify: `src/utils.js`
- Modify: `scripts/validate-yarn-sequence-editor.mjs`
- Create: `scripts/validate-shared-yarn-gutters.mjs`
- Modify: `package.json`

- [ ] **Step 1: 写双 gutter 共享行为失败验证**

验证入口注册两个 `yarnSequenceCanvas` 实例、两个 pointer/touch 交互目标，但所有事件只 dispatch 同一个 `yarnSequence`。Mock 两个 canvas 后：

```js
const first = yarnSequenceCanvas({ canvas: camCanvas })({ state });
const second = yarnSequenceCanvas({ canvas: needleCanvas })({ state });
const next = { ...state, yarnSequence: state.yarnSequence.brush({ x: 0, y: 12 }, 1) };
first.syncState(next);
second.syncState(next);
assert.equal(camCanvas.context.lastFillByRow.get(47), palette[1]);
assert.equal(needleCanvas.context.lastFillByRow.get(47), palette[1]);
```

再断言 resize 完整画布高度从 60 到 75 时色纱变成 75 行，应用 1234 使 needle unit 变 4×8 时色纱仍为 75 行。

Run: `node scripts/validate-shared-yarn-gutters.mjs`

Expected: 当前只注册一个 needle 色纱 canvas，因此失败。

- [ ] **Step 2: 让 yarn renderer 支持两个实例和纯纵向对齐**

`yarnSequenceCanvas({ canvas })` 保持无 editor 私有状态；两个实例都读取相同 `state.yarnSequence/yarnPalette/scale`。canvas 本身保持完整 `canvasHeight` 高度，CSS track 使用 Task 7 的 `chartPan.y`；renderer 不写横向 transform。

修正 `syncState()`：palette、sequence、scale 或高度任一变化时两边都能刷新；pan-only 变化不 resize canvas。

- [ ] **Step 3: 注册两边相同色纱交互**

把 `initKeyboard`/`initTouch` 参数改为 yarn canvas 数组：

```js
function initKeyboard(yarnCanvases, simContainer) {
  addKeypressListeners();
  yarnCanvases.forEach(colorSequencePointerInteraction);
  simulationPointerInteraction(simContainer);
  closeModals();
}
```

touch 同理。`colorSequencePosAtCoords()` 使用 canvas 的 transformed bounding rect 与 `scale/devicePixelRatio`，clamp 到 `0..yarnSequence.height - 1`，使两边修改同一行。任何一边 brush 后，StateMonitor 同步两个 renderer。

- [ ] **Step 4: 运行色纱与尺寸回归**

在 `package.json` 增加：

```json
"validate:shared-yarn-gutters": "node --experimental-default-type=module scripts/validate-shared-yarn-gutters.mjs"
```

Run: `npm run validate:shared-yarn-gutters && npm run validate:yarn-sequence-editor && npm run validate:pattern-dimensions && npm run validate:needle-arrangement-acceptance`

Expected: 全部输出 `PASS`。

- [ ] **Step 5: 提交**

```bash
git add src/components/yarnSequenceCanvas.js src/events/colorSequencePointerInteraction.js src/events/colorSequenceTouchInteraction.js src/actions/yarnSequenceRows.js src/index.js src/utils.js scripts/validate-yarn-sequence-editor.mjs scripts/validate-shared-yarn-gutters.mjs package.json
git commit -m "feat: share fixed yarn gutters across editors"
```

## Task 9: 更新代码向导、文档和全量验收

**Files:**

- Modify: `src/codeGuide/codeGuideDefinitions.json`
- Modify: `src/codeGuide/codeGuideMap.js`
- Modify: `src/codeGuide/generatedLines.json` via generator
- Modify: `src/i18n/translations.js` only if labels need correction; reuse existing `taskbar.width/height`, `needle.*`, `cam.title`, `needle.title` keys where possible
- Modify: `KnitScape_当前功能与算法.md`
- Modify: existing `scripts/validate-*.mjs` files whose old full-bitmap ownership assertions are obsolete
- Modify: `package.json` only if the final aggregate script is added

- [ ] **Step 1: 先运行全量验证，记录旧断言失败清单**

PowerShell：

```powershell
$package = Get-Content package.json | ConvertFrom-Json
$package.scripts.PSObject.Properties |
  Where-Object Name -like 'validate:*' |
  ForEach-Object {
    Write-Host "RUN $($_.Name)"
    npm run $_.Name
    if ($LASTEXITCODE -ne 0) { throw "FAILED $($_.Name)" }
  }
```

Expected: 新验证应已通过；仍引用旧尺寸控件、单色纱 canvas、v2 字段或直接 bitmap 所有权的旧验证会明确失败。逐个把断言更新为已批准设计，不删除与多语言、双纱、纹理、纱长、模拟性能有关的覆盖。

- [ ] **Step 2: 更新代码向导映射**

保留现有 key 语义，确保实际 DOM 上存在：

```text
stitch.symbol
canvas.width
canvas.height
needle.start
needle.input
needle.apply
cam.yarn-sequence
needle.yarn-sequence
cam.symbols
needle.symbols
```

尺寸 key 统一使用 `canvas.width` 与 `canvas.height`，同时更新 definitions/map/验证。运行：

Run: `npm run generate:code-guide-lines && npm run validate:code-guide`

Expected: 生成文件无手工漂移，代码向导验证输出 `PASS`。

- [ ] **Step 3: 更新项目功能文档**

在 `KnitScape_当前功能与算法.md` 记录：

- 完整画布默认 60×60；
- 双 8×4 循环单元与顶部对齐平铺；
- 开始排针保持 8×4，应用 1234 后 unit 为 4×8；
- 黑色 unit 可编辑、灰色派生区只读；
- 上下共享 scale/pan，默认 16×16；
- 两个固定 gutter 共享 60 行色纱；
- JSON v3 与 repeat/v2 迁移。

- [ ] **Step 4: 运行全部自动验证与生产构建**

Run: `npm run build`

Expected: Vite production build 成功，无 unresolved import。

再运行全部 `validate:*` 脚本。Expected: 每项输出 `PASS`，PowerShell 循环退出码为 0。

- [ ] **Step 5: 浏览器人工验收**

Run: `npm run dev -- --host 127.0.0.1`

在桌面浏览器逐项确认：

1. 首次打开时顶部四个针法后是 60、60；两框可直接输入、原生上下箭头可点击、输入和选择时始终黑字。
2. 三角座标题下没有尺寸框；排针标题下依次显示开始、1、2、3、4、应用。
3. 上下初始可见范围各为 16×16，黑色 unit 都为 8×4，其余为灰色平铺。
4. 左键点击灰色区无变化；黑色区绘制后，同一个格在灰色平铺中同步更新。
5. 点击开始后排针仍为 8×4；点击应用后才变为 4×8；顶部仍为 60×60。
6. 在任一编辑器滚轮缩放，另一边同步；在任一编辑器按中键拖动，另一边同步；浏览器不出现自动滚屏图标。
7. 两条色纱栏始终固定在灰色区左侧，不因 60×60 改成 80×75、缩放或横向拖动而交叉；修改任一边色纱行，另一边立即一致。
8. 右侧模拟、JSON、BMP、SilverKnit、Kniterate、打孔卡使用 60×60 的完整排针派生结果。
9. 刷新页面并重新导入刚导出的 JSON v3，尺寸、两个 unit、排针输入和色纱一致。

如需截图，保存到仓库外临时目录，不提交浏览器截图或 Vite 产物。

- [ ] **Step 6: 检查 diff 和提交最终集成**

Run: `git status --short && git diff --check && git diff --stat`

Expected: 无尾随空格；只有本计划范围内文件；`dist/`、截图和临时文件未跟踪。

```bash
git add src/codeGuide src/i18n/translations.js scripts package.json KnitScape_当前功能与算法.md
git commit -m "docs: document dual repeat editor workflow"
```

如果 `src/i18n/translations.js` 或 `package.json` 在本任务没有实际变化，不要为了匹配命令而触碰它们；只 add 实际修改文件。

## 最终完成标准

- [ ] `git status --short` 为空。
- [ ] 所有 `validate:*` 命令通过。
- [ ] `npm run build` 通过。
- [ ] 浏览器九项人工验收完成。
- [ ] 提交历史按任务分离，无旧 repeat 多块功能、临时产物或派生 bitmap 业务写入。
