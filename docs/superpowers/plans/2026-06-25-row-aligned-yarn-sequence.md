# Row-Aligned Yarn Sequence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把色纱序列从左侧按钮式控件改成与中间织法图等高、逐行对齐的左侧小画布。用户修改 Width / Height 时，整体画布自动变更；色纱序列高度同步 chart.height；点击或拖动色纱序列某一行即可把该行指定为当前色纱。

**Architecture:** 继续使用现有 `Bimp` 作为 `GLOBAL_STATE.yarnSequence` 数据结构，但 Step 18 后将它规范为 `1 x chart.height`。尺寸同步放在 `resizeChartArea`、JSON 导入和新建图案路径中，渲染层只读取已经同步好的逐行序列。左侧面板删除“增加行 / 减少行”按钮，交互入口只保留贴在中间织法图左侧的 `yarn-sequence-canvas`。

**Tech Stack:** lit-html UI、现有 canvas 绘制、现有 pointer/touch 事件、现有 `Bimp` 模型、Vite、Node 验证脚本。

---

## Task 1: Add Failing Validation

**Files:**
- Modify: `scripts/validate-yarn-sequence-editor.mjs`

- [ ] 检查 `src/views/leftBar.js` 不再包含 `yarnSequenceControls`、`yarn-sequence-add-row`、`yarn-sequence-remove-row`。
- [ ] 检查 `src/actions/yarnSequenceRows.js` 提供 `resizeYarnSequenceToChartHeight`。
- [ ] 检查 helper 行为：扩高保留旧行并用当前 activeYarn 补齐；缩高截断；缺失旧序列按 chart.height 补 0；宽度大于 1 时只读取第一列。
- [ ] 检查 `src/actions/repeatDimensions.js` 在 `resizeChartArea` 中同步 `yarnSequence`。
- [ ] 检查 `src/actions/importers.js` 导入 JSON 时按 chart.height 归一化 `yarnSequence`。
- [ ] 检查 `src/state.js` 默认 `yarnSequence.height` 与默认 `chart.height` 一致。
- [ ] 运行 `npm run validate:yarn-sequence-editor`，预期先失败，证明测试能抓到当前不符合要求的地方。

## Task 2: Implement Yarn Sequence Height Helpers

**Files:**
- Modify: `src/actions/yarnSequenceRows.js`

- [ ] 新增 `resizeYarnSequenceToChartHeight(yarnSequence, chartHeight, fillYarn = 0)`。
- [ ] 更新 `normalizeYarnSequence(yarnSequence, { height, fillYarn } = {})`，让旧调用保持兼容，新调用可指定目标高度。
- [ ] 统一像素合法性：非数字、负数、非法色纱索引回退到 0。
- [ ] 保持 `yarnIndexForSequenceRow` 对旧数据的容错，但主路径不再依赖短序列循环。
- [ ] 运行 `npm run validate:yarn-sequence-editor`，预期 helper 相关失败消失，尺寸同步相关失败仍可能存在。

## Task 3: Sync Sequence Height With Chart Height

**Files:**
- Modify: `src/actions/repeatDimensions.js`
- Modify: `src/actions/importers.js`
- Modify: `src/state.js`

- [ ] 在 `resizeChartArea(width, height)` 中同时 dispatch 新的 `chart` 和同步后的 `yarnSequence`。
- [ ] 顶部 Height 输入改变时，新增加的色纱行用当前 `GLOBAL_STATE.activeYarn` 填充。
- [ ] JSON 导入时，缺失或旧版短 `yarnSequence` 统一补齐到导入后 `chart.height`，新增行填 0。
- [ ] 新建图案时创建 `1 x chart.height` 的全 0 色纱序列。
- [ ] 默认页面打开时，`GLOBAL_STATE.yarnSequence.height` 等于默认 `GLOBAL_STATE.chart.height`。
- [ ] 运行 `npm run validate:yarn-sequence-editor` 和 `npm run validate:repeat-dimensions`。

## Task 4: Remove Left-Side Button UI

**Files:**
- Modify: `src/views/leftBar.js`
- Modify: `styles.css`

- [ ] 删除左侧面板中的 `updateYarnSequenceRows`、`yarnSequenceControls` 和对应模板输出。
- [ ] 删除或停用 `.yarn-sequence-controls`、`.yarn-sequence-row-buttons` 等只服务按钮式控件的样式。
- [ ] 保留中间织法图左侧的 `yarn-sequence-canvas`，作为唯一的逐行色纱编辑入口。
- [ ] 运行 `npm run validate:yarn-sequence-editor`，确认左侧按钮 UI 检查通过。

## Task 5: Confirm Canvas Row Alignment

**Files:**
- Modify if needed: `src/components/yarnSequenceCanvas.js`
- Modify if needed: `src/utils.js`
- Modify if needed: `src/events/colorSequencePointerInteraction.js`
- Modify if needed: `src/events/colorSequenceTouchInteraction.js`

- [ ] 确认 `yarn-sequence-canvas` 高度来自同步后的 `yarnSequence.height`，实际等于 `chart.height`。
- [ ] 确认每个色纱格高度与中间织法图单位行高一致。
- [ ] 确认点击单行只修改该行。
- [ ] 确认拖动经过多行时连续写入当前 activeYarn。
- [ ] 确认改变 Height 后 pointer / touch 坐标仍能落到正确行。

## Task 6: Documentation

**Files:**
- Modify: `KnitScape_单面布技术文档.md`

- [ ] 在技术文档中记录 Step 18：色纱序列改为与中间织法图等高的逐行编辑画布。
- [ ] 记录交互规则：点击或拖动色纱序列行写入当前色纱。
- [ ] 记录尺寸规则：Width / Height 是整体画布尺寸；Height 改变时色纱序列自动同步。
- [ ] 记录兼容规则：旧 JSON 导入会自动补齐或截断到 chart.height。

## Task 7: Verification And Agent Review

**Files:**
- Read-only review after implementation

- [ ] 运行 `npm run validate:yarn-sequence-editor`。
- [ ] 运行 `npm run validate:yarn-length-scaling`。
- [ ] 运行 `npm run validate:two-ply-yarn`。
- [ ] 运行 `npm run validate:repeat-dimensions`。
- [ ] 运行 `npm run validate:i18n`。
- [ ] 运行 `npm run validate:single-ui`。
- [ ] 运行 `npm run build`。
- [ ] 浏览器验证：默认打开时色纱序列高度等于织法图高度；把 Height 改成 80 后仍等高；点击某一行只改变该行颜色。
- [ ] 创建只读验收智能体复核文件、验证脚本和浏览器表现。

## Notes

- 本机 Git identity 当前未配置，前一次提交规格文档时出现 `Author identity unknown`。本轮按用户要求完成文件修改和验证，不在任务中配置 Git 身份。
- 本计划不恢复旧的左侧按钮形式，也不恢复左下角拖动边界按钮。

## Execution Status

- [x] Task 1: Added failing validation and watched `npm run validate:yarn-sequence-editor` fail for the expected missing Step 18 behavior.
- [x] Task 2: Added chart-height yarn sequence helpers.
- [x] Task 3: Synced yarnSequence height through Width / Height resize, JSON import, new pattern, and default state.
- [x] Task 4: Removed the left-side button-style yarn sequence UI.
- [x] Task 5: Confirmed the middle-left yarn sequence canvas stays equal-height with the center chart canvas.
- [x] Task 6: Updated `KnitScape_单面布技术文档.md` with Step 18.
- [x] Task 7: Local validation passed; read-only agent review was requested.
- [x] Follow-up: Read-only agent found repeat boundary drag was not covered. Added a failing validation check and moved yarnSequence synchronization into `chartResizeForRepeat`, so top Width / Height changes and manual boundary resizing share the same sync path.
- [x] Hardening: Upgraded `validate:yarn-sequence-editor` from source-only boundary checks to runtime assertions for `chartResizeForRepeat` grow, shrink, and non-primary-repeat behavior.
