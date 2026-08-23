# Feature Scope Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变已验收页面行为的前提下，删除本轮产生的死状态、重复验证和审查过程代码。

**Architecture:** 保留现有双循环单元、共享视口和共享色纱的数据流，不增加新抽象。先用现有行为验证建立基线，再删除无消费者状态、压缩重复脚本，最后撤回与用户功能无关的源码说明生命周期加固。

**Tech Stack:** Vite 4、原生 ES modules、lit-html、Canvas 2D、Node `assert`。

---

### Task 1: 删除死状态与完全重复的验证

**Files:**
- Modify: `src/actions/patternEditing.js`
- Modify: `scripts/validate-bitmap-pointer-unit-boundary.mjs`
- Modify: `scripts/validate-pattern-dimension-sync.mjs`
- Modify: `scripts/validate-repeat-unit-rendering.mjs`
- Delete: `scripts/validate-dual-pattern-editor.mjs`
- Delete: `scripts/validate-needle-arrangement-state.mjs`
- Modify: `package.json`

- [ ] **Step 1: 记录精简前基线**

运行以下现有行为验证，预期全部输出 `PASS`：

```powershell
npm run validate:pattern-dimensions
npm run validate:needle-arrangement-acceptance
npm run validate:repeat-unit-rendering
npm run validate:bitmap-pointer-unit-boundary
npm run validate:shared-chart-viewport
npm run validate:shared-yarn-gutters
```

- [ ] **Step 2: 删除 `patternEdit`**

把 `drawPatternLine()` 的 dispatch 缩减为真实数据更新：

```js
dispatch({
  [field]: bitmap.line(startPos, endPos, GLOBAL_STATE.activeSymbol),
});
```

同时删除验证脚本中所有 `GLOBAL_STATE.patternEdit` 和 changes 数组里的 `"patternEdit"` 断言。

- [ ] **Step 3: 删除两个静态连线脚本**

删除 `validate-dual-pattern-editor.mjs` 和 `validate-needle-arrangement-state.mjs`，并从 `package.json` 移除对应命令。它们的可观察行为已经分别由布局、渲染、排针验收、文件 v3 和导出验证覆盖。

- [ ] **Step 4: 验证并提交**

```powershell
rg -n '\bpatternEdit\b' src scripts
npm run validate:pattern-dimensions
npm run validate:needle-arrangement-acceptance
npm run validate:repeat-unit-rendering
npm run validate:bitmap-pointer-unit-boundary
git diff --check
git add src/actions/patternEditing.js scripts package.json
git commit -m "refactor: remove repeat editor test state"
```

`rg` 预期无匹配，四项验证预期全部通过。

### Task 2: 收缩核心交互验证

**Files:**
- Modify: `scripts/validate-central-stitch-toolbar.mjs`
- Modify: `scripts/validate-repeat-editor-layout.mjs`
- Modify: `scripts/validate-repeat-unit-rendering.mjs`
- Modify: `scripts/validate-bitmap-pointer-unit-boundary.mjs`
- Modify: `scripts/validate-shared-chart-viewport.mjs`
- Modify: `scripts/validate-shared-yarn-gutters.mjs`

- [ ] **Step 1: 只保留用户契约**

各脚本保留以下最小行为：

```text
toolbar: 控件顺序、60×60、输入/步进、焦点期间黑字
layout: 两个编辑区、固定 gutter、黑色单元不被裁掉
rendering: 灰色完整平铺、黑色 8×4 单元、纵向方向
pointer: 灰区只读、黑区可画、拖过灰区不连线
viewport: 16×16 fit、一次滚轮同步缩放、一次中键同步拖拽
yarn: 两边同一行同一颜色、任一侧编辑后同时刷新、尺寸变化不交叉
```

删除源码全文正则、重复 DPR 组合、滚轮残差排列、第二指针竞争、BFCache、捕获失败回退及重复 Canvas 状态记录。生产代码在本任务中不得修改。

- [ ] **Step 2: 检查体量和行为**

```powershell
Get-ChildItem scripts\validate-*.mjs | Select-Object Name,@{Name='Lines';Expression={(Get-Content $_.FullName).Count}}
npm run validate:central-stitch-toolbar
npm run validate:repeat-editor-layout
npm run validate:repeat-unit-rendering
npm run validate:bitmap-pointer-unit-boundary
npm run validate:shared-chart-viewport
npm run validate:shared-yarn-gutters
```

六项验证必须通过；六个脚本合计行数必须低于精简前的 2,447 行。

- [ ] **Step 3: 提交**

```powershell
git add scripts
git commit -m "test: focus repeat editor acceptance coverage"
```

### Task 3: 撤回源码说明模式的范围扩张

**Files:**
- Modify: `src/codeGuide/codeGuideEvents.js`
- Modify: `src/codeGuide/codeGuideState.js`
- Modify: `src/index.js`
- Modify: `src/codeGuide/generatedLines.json`
- Modify: `scripts/validate-code-guide.mjs`

- [ ] **Step 1: 恢复最小生命周期**

`BLOCKED_EVENTS` 删除本轮额外增加的 `mousedown` 和 `touchstart`。`subscribeCodeGuideState()` 恢复为只注册/注销 listener，`index.js` 使用一次性 `pagehide` 监听释放订阅：

```js
const unsubscribeCodeGuideState = subscribeCodeGuideState(appRenderer.syncState);
window.addEventListener("pagehide", unsubscribeCodeGuideState, { once: true });
```

- [ ] **Step 2: 删除对应审查测试并重算行号**

从 `validate-code-guide.mjs` 删除 JSDOM drawer、BFCache 和 Split 触摸保护测试，保留新控件映射及 definitions 完整性检查。

```powershell
npm run generate:code-guide-lines
npm run validate:code-guide
```

预期代码说明验证通过。

- [ ] **Step 3: 提交**

```powershell
git add src/codeGuide src/index.js scripts/validate-code-guide.mjs
git commit -m "refactor: trim code guide lifecycle hardening"
```

### Task 4: 修正文案并完成回归

**Files:**
- Modify: `src/i18n/translations.js`
- Modify: `scripts/validate-central-stitch-toolbar.mjs`
- Modify: `KnitScape_当前功能与算法.md`

- [ ] **Step 1: 用现有验证制造文案红灯**

把简体中文高度标签期望改为 `纵向针数`，运行：

```powershell
npm run validate:central-stitch-toolbar
```

预期因为当前文本仍为 `纵向行数` 而失败。

- [ ] **Step 2: 最小修正文案并转绿**

只把简体中文 `canvas.height` 改为 `纵向针数`，不修改其他语言。

```powershell
npm run validate:central-stitch-toolbar
```

预期通过。

- [ ] **Step 3: 压缩状态文档**

在 `KnitScape_当前功能与算法.md` 删除提交记录、审查过程和固定验证数量，只保留当前功能、数据流、文件格式、源码职责和已知边界。

- [ ] **Step 4: 全量验证和提交**

```powershell
$package = Get-Content package.json -Raw | ConvertFrom-Json
$package.scripts.PSObject.Properties | Where-Object Name -like 'validate:*' | ForEach-Object { npm run $_.Name; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
npm run build
git diff --check
git status --short
git add src/i18n/translations.js scripts/validate-central-stitch-toolbar.mjs 'KnitScape_当前功能与算法.md'
git commit -m "docs: keep repeat editor guidance concise"
```

全部保留验证和生产构建必须通过；最终再在浏览器检查默认 60×60、两个 8×4、应用后 4×8、同步视角及双色纱。
