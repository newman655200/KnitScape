# 合并后验收任务（交给 Codex）

> 生成：2026-11-20。前置：Claude 已在真实仓库完成 `demo-swatch-20261119` 快进合并到 `main`。
> 本任务只做验收与诊断，**不修改任何源码**；如需修复，先出结论等用户决定。

## 一、已完成的动作（FACT，请现场复核）

1. 合并前 `main@24c51b9`，工作区干净（仅两个既有未跟踪项：`.vite-swatch-validation/deps_temp_e89481d9/package.json`、`CODEX_BRIEF.md`）。
2. `git merge --ff-only demo-swatch-20261119` 成功，快进，零冲突。
3. 合并后 `main@23e71e7`（原 demo 提交 `chore: import sop-repeat-swatch demo sources as of 2026-11-19 (unreviewed)`）。
4. 合并带入 24 个文件、+2729/−168：新增 `swatch.html`、`src/swatchPreview.js`、`src/simulation/sopInterlockCurve.js`、`sopInterlockSwatch.js`、`sopSwatchForm.js`、`src/components/drawRepeatLibrary.js`、`src/events/repeatLibraryDragInteraction.js`、`src/views/sopSwatch.css`、`public/current-SOP.knitscape`、`public/materials/white-gray-yarn/*.png`，修改 `vite.config.js`（新增 swatch 构建入口）、`src/index.js`、`runSimulation.js`、`taskbar.js`、`sopTopologyWorkbenchController.js` 等，新增 3 个验证脚本（`validate-sop-diagonal-release`、`validate-sop-flat-layout`、`validate-sop-interlock-swatch`）。
5. `demo-swatch-20261119` 分支保留未删，是否删除等用户决定。

## 二、Claude 在 Linux 隔离副本中的预验结果

- 用 `git archive HEAD` 导出到独立目录、`npm ci` 后 `npx vite build`：**退出 0**，产出 `dist/index.html` 与 `dist/swatch.html`，`public/current-SOP.knitscape` 与 `materials/` 已复制进 dist。
- `npm run validate`：**60/74 通过，14 失败**。失败清单：

```
validate:sop-flat-layout            validate:code-guide
validate:sop-visual-joint           validate:pbr-preview-lifecycle
validate:sop-joint-lifecycle        validate:sop-topology-adapter
validate:sop-geometry-audit         validate:sop-spatial-hypothesis
validate:sop-geometry-audit-lifecycle  validate:sop-topology-workbench
validate:sop-visual-transition-trims   validate:sop-swatch-profile
validate:sop-visual-swatch
validate:sop-swatch-lifecycle
```

观察到的三类报错（沙箱环境可能放大）：

- `ENOENT ... Documents/KnitScape/archives/knitscape-sop-retest-2026-10-29/browser-continuation/SOP-restored-23-8x3-retest.knitscape`——沙箱内该外部夹具路径不存在；Windows 上应存在，请确认。
- `Error: Test artifacts must be outside the checkout.`——脚本要求测试产物位于 checkout 之外，沙箱以 `/tmp` 运行副本可能触发的路径判定问题。
- `Error: A complete CN common layout is required`——疑似真实问题（i18n/布局），请优先定位。

## 三、你要做的事

1. **在真实 Windows 仓库**（`C:\Users\liuchen\Desktop\knitscape`，当前应在 `23e71e7`）现场运行：
   ```text
   git branch --show-current
   git log -1 --oneline --decorate
   git status --short -uall
   npm run build
   npm run validate
   ```
   先记录出口码与逐项红绿。
2. **逐项分类上面 14 个失败**：环境/外部夹具缺失 / 路径判定 / 合并引入的真实回归 / 合并前就红。每项给出：真实 Windows 下的退出码、首个断言或异常、判定依据、是否与本合并的 24 个文件相关。注意 3 个新增脚本（`validate-sop-diagonal-release`、`validate-sop-flat-layout`、`validate-sop-interlock-swatch`）若红，重点查它们与 demo 源码的一致性。
3. **核对合并完整性**：`swatch.html` 与 `src/swatchPreview.js` 入口可加载；`sopInterlockCurve/Swatch/Form` 三模块被谁引用；`vite.config.js` 双入口构建；`package.json` 的 3 条新 script 与 `scripts/validate.mjs` 注册顺序一致；原始 main 的 71 项脚本是否全部仍注册（总数应为 74）。
4. **只出结论，不改代码。** 如发现真实回归，写明最小修复方案与涉及文件，等用户选择。

## 四、产出

写入：`C:\Users\liuchen\Documents\KnitScape\archives\merge-verify-2026-11-20\MERGE_VERIFY.md`（目录不存在就建，不在桌面或仓库内建报告目录）。

内容：现场命令结果、74 项逐项红绿表（绿可合并成段并注明段内数量）、14 个失败项的逐项分类与证据、合并完整性核对结果、真实回归的修复建议清单。所有结论带 FACT / INFERENCE / UNKNOWN 标注；未运行的项标"未跑"。

权限边界：不修改 `src/`、`scripts/`、`package.json`；不删除 `demo-swatch-20261119` 分支；不在桌面仓库生成 `dist` 以外的目录（构建产物按 `npm run build` 常规生成即可，报告与日志一律放 archives）。
