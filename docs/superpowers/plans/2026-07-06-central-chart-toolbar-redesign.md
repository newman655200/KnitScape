# Central Chart Toolbar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 集中针法与画布尺寸控制，保留原针法图标，并完成统一深灰工作区和白色默认按钮改版。

**Architecture:** 新建独立 `chartEditorToolbar` 视图复用现有针法动作和尺寸动作；`view.js` 只负责把编辑栏、repeat 栏、画布与缩放工具组合为中央工作区。视觉变化集中在语义色彩变量和组件覆盖样式中，不改针织与预览算法。

**Tech Stack:** lit-html、现有 CSS、Vite、Node 验证脚本、浏览器视觉验收。

---

### Task 1: Protect the original stitch icons

- [x] 新增 `scripts/validate-central-stitch-toolbar.mjs`，固定四个 SVG 的 SHA-256。
- [x] 先运行验证并确认因中央编辑栏尚不存在而失败。

### Task 2: Move controls into the chart workspace

- [x] 新建 `src/views/chartEditorToolbar.js`，复用 `applySelectedSymbol()`、`resizeChartArea()` 和 `fitChart()`。
- [x] 从 `taskbar.js` 移除 Width / Height，从 `leftBar.js` 移除针法选择。
- [x] 在 `view.js` 中组合中央编辑栏、repeat 栏、画布和缩放工具。

### Task 3: Apply the approved visual system

- [x] 在 `styles.css` 中把主要工作区统一为 `#4A5055`，并保留白色按钮、输入框和局部选中态。
- [x] 让 repeat 画笔默认白色、第一次点击启用编辑并变深、第二次点击关闭编辑并恢复白色。
- [x] 删除鼠标与触控事件在未选工具时自动回退画笔的逻辑。
- [x] 保证 1080×720 不发生横向溢出。

### Task 4: Update mappings and documentation

- [x] 更新代码指南位置并重新生成行号。
- [x] 更新技术文档、需求文档和设计记录。

### Task 5: Verify

- [x] 运行中央编辑栏测试、单面 UI 测试、代码指南测试和生产构建。
- [x] 浏览器验证针法切换、画布尺寸修改、原始 SVG 引用、统一深灰背景、画笔状态和控制台错误。
- [x] 生成同屏设计对比并通过 `design-qa.md`。
