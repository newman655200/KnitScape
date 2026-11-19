# KnitScape P0-2：不可达纱长与用户反馈闭环

完成日期：2026-10-07。工作分支 `main`，HEAD `29b7e4bcfaee6c9b7f3df070b24c200b7aa56103`。未自动提交。

## 1. P0-1 核验与工作区保护

开工前执行 `git status --short`、`git rev-parse HEAD`、`git branch --show-current`，阅读 AGENTS.md、当前功能与算法文档、NEXT_TASK.md，并运行既有 P0-1 集成 validator。

既有 P0-1 验证通过：23、27 的 SolverResult 与实际 Canvas 接收的求解路径一致。Gauge、Cam、已确认的排针、Feed Yarn 变化在 150ms debounce 前立即清空结果并撤销 VALIDATED。排针输入草稿与已确认业务参数仍独立。

项目保存函数仍只导出项目事实；不导出 yarnLengthSolverResults 或 previewValidity。VALIDATED 仅代表模型几何求解及路径应用成功，不代表实机验证。

开工时全部 26 个既有未提交文件已做 SHA256 和副本记录，位于工作区外的 `p0-2-audit`。最终仅 6 个必要交叉文件新增 P0-2 修改，其余 20 个文件 SHA256 保持一致。没有 reset、checkout、stash、回滚或覆盖用户修改。

## 2. 原因与最终链路

P0-1 已具备不可达判定和逐 Yarn 基础路径回退，但没有用户反馈；模型可解范围仅有内部模型单位；仅 RangeError 被转换为 ERROR，其余 Solver 异常会中断模拟。

最终链路仍为：

`Feed Yarn 项目目标 → Cam + 已确认排针 → Machine Domain / 适配器 → runSimulation → Yarn Length Solver → 各 Yarn 路径应用或基础回退 → 当前 SolverResult + PreviewValidity → 只读反馈表`

没有第二套机器执行逻辑。失败候选保留在派生结果中用于说明原因，不进入最终模拟路径。成功 Yarn 与失败 Yarn 分别消费各自路径。

## 3. 修改文件与本次增量

下表相对于开工时工作区，而非相对于 HEAD；不含报告、截图和日志。

| 文件 | 修改 | + / − |
|---|---|---:|
| src/simulation/yarnLengthSolver.js | 添加 failureReason、Solver 提供的 cm/100针模型上下界；算法与默认边界未改 | 4 / 0 |
| src/simulation/yarnSimulation.js | Solver 范围内异常转 ERROR；未应用求解路径给出 PATH_NOT_APPLIED；不改变失败基础路径机制 | 6 / 3 |
| src/views/yarnLengthSolverFeedback.js（新增） | 按 Feed×Yarn 与当前目标关联结果，展示目标/候选/状态/应用/原因/范围；隔离滚轮缩放事件 | 66 / 0 |
| src/events/simulationPointerInteraction.js | 画布拖动入口忽略反馈区；点击仍传到原弹窗关闭入口 | 2 / 0 |
| src/components/runSimulation.js | 在最终预览标题后接入结果反馈 | 2 / 0 |
| src/views/yarnLengthReadout.js | 旧统计注明“基础预览统计，非目标求解值” | 1 / 0 |
| src/i18n/translations.js | 简体、繁体、英文、越南语反馈文本与模型限定说明 | 88 / 0 |
| styles.css | 仅新增反馈区域的有界滚动和表格基本样式；原选择器未改 | 22 / 0 |
| src/codeGuide/generatedLines.json | 更新移动后的 6 个代码指南锚点 | 6 / 6 |
| scripts/validate-yarn-length-failure-integration.mjs（新增） | 真实 runSimulation A–G、基础 Canvas 路径、异常、迭代上限、路径应用失败及缓存恢复 | 207 / 0 |
| scripts/browser-yarn-length-feedback.mjs（新增） | 可重跑的真实浏览器 A–G，原有控件逐项输入，DOM 反馈断言及阅读/弹窗关闭回归 | 93 / 0 |
| scripts/validate-single-jersey-execution-integration.mjs | 原边界测试为新增只读展示模块补 UI fixture；原机器断言保留 | 7 / 0 |
| package.json | 将失败路径集成 validator 加入现有 validate 集合 | 1 / 0 |

合计：13 个代码/配置/测试文件，505 行新增、9 行删除。

## 4. 实际派生结果

标准 G32、4×4 全 K、排针 1234、48×60 窗口，Feed 1 / Yarn 1 的 100 结果：

```json
{
  "feedIndex": 0,
  "yarnIndex": 0,
  "targetLengthCmPer100Needles": 100,
  "solvedLengthCmPer100Needles": 46.77216851308147,
  "errorCmPer100Needles": 53.227831486918525,
  "toleranceCmPer100Needles": 0.00079375,
  "status": "UNREACHABLE_TARGET",
  "failureReason": "UNREACHABLE_TARGET",
  "converged": false,
  "appliedToSimulation": false,
  "reachableRange": {
    "minLoopHeight": 0.05,
    "maxLoopHeight": 2,
    "minModelLengthPer100Needles": 176.80175653232146,
    "maxModelLengthPer100Needles": 589.2556663065383,
    "minLengthCmPer100Needles": 14.033639424753016,
    "maxLengthCmPer100Needles": 46.77216851308147
  }
}
```

原有模型长度、loopHeight、error、solvedPathByLink 等字段保留。以上 46.7722 是未应用的边界候选值，绝不是基础模拟的实测纱长。范围限定于当前模型、配置及 Solver 高度边界，不是实机工艺范围。

ERROR 提供 errorMessage，求解值为 null、appliedToSimulation=false。MAX_ITERATIONS 不应用。CONVERGED 但路径未应用时 failureReason=PATH_NOT_APPLIED，不能验证目标。成功且应用时 failureReason=null。

## 5. PreviewValidity 与用户反馈

未改变 P0-1 推导规则：无参与目标为 DESIGN_PREVIEW；所有参与目标均匹配当前目标、CONVERGED、误差在容差内且路径实际应用，才是 VALIDATED；一部分成功为 PARTIAL；全部未成功为 INVALID。机器配置错误仍为 INVALID，配置缺失为 DESIGN_PREVIEW。

反馈逐项显示 Feed×Yarn、目标、模型求解值、Solver 状态、是否应用、失败原因和模型范围。未设置目标显示 NOT_SET；当前没有结果时显示“尚无当前结果 / 目标未应用”，不沿用另一根 Yarn 的状态。

始终标注“仅模型几何求解，未经实机验证”。失败时基础预览可继续显示，但明确目标未应用。旧左侧 24.87 等数值仍保留其原统计口径，新增限定说明，不用它验收目标纱长。

结果反馈放在画布上方，避免原浮动预览控件遮挡。画布拖动入口忽略来自反馈区的 pointerdown；反馈内 wheel 不冒泡到画布。真实浏览器已复现并修复“阅读结果触发画布拖动，暂时失效”问题，同时保留原外部点击关闭设置弹窗的行为。原画布拖动/缩放计算未改。

## 6. 实测与测试

| Case | 条件 | 当前结果 | 验证 |
|---|---|---|---|
| A | 四路 23 | 四项 CONVERGED、已应用；VALIDATED | 集成 + 真实浏览器 |
| B | 四路 100 | 四项 UNREACHABLE_TARGET、未应用；INVALID；输入仍为 100 | 集成 + 真实浏览器 |
| C | 23 / 100 / 23 / 100 | 两项成功，两项失败；PARTIAL | 集成 + 真实浏览器 |
| D | 无目标（兼容 0 / empty / unset） | DESIGN_PREVIEW | 集成 + 真实浏览器 |
| E | 修改 Gauge / Cam / 已确认排针 / Feed | debounce 前立即撤销旧结果；重算当前配置 | 集成；浏览器撤回/恢复排针 |
| F | 100 改回 23 | 恢复 CONVERGED、已应用、VALIDATED | 集成 + 真实浏览器 |
| G | Feed 1 两根 Yarn：23 / 100；其他路 23 | 5 个独立结果，其中一项未应用；PARTIAL | 集成 + 真实浏览器 |

四路 23 求解值分别为 22.99985537891976、22.999856051617197、22.999856042155812、22.99985636579647。最大误差 0.00014462108023835185，小于 G32 的 0.00079375 容差。

四路 100 最近候选约 46.77216851308147，误差约 53.227831486918525；每根均不可达、未应用。集成测试逐层比较实际最终 Canvas 路径与基础几何，证明失败候选没有用于最终绘制。

既有 P0-1 的 27 回归继续通过：求解约 26.9999926–26.9999947，全部应用、VALIDATED。

新增集成还覆盖：普通 Error 转 ERROR、错误文本、MAX_ITERATIONS、CONVERGED 但 PATH_NOT_APPLIED、缓存复用后应用恢复。真实浏览器脚本只使用页面控件和只读 DOM；不注入应用隐藏状态、不调用业务 action、不保存测试项目。

浏览器脚本需要 Codex computer-use 的现有 Tab；不是独立 npm/CI 浏览器运行器。执行方式见脚本顶部。最终结果与截图存于 `reports/p0-2-browser/`，汇总为 `browser-results.json`，没有浏览器控制台 error。

## 7. 最终验证

- `npm run validate`：33/33 通过，退出码 0，完整日志 `reports/p0-2-validate.log`。
- `npm run build`：740 模块，退出码 0，完整日志 `reports/p0-2-build.log`。
- `git diff --check`：退出码 0；Git 仅提示既有 LF/CRLF 转换，没有空白错误。
- 独立只读审查：未发现 Critical / Important 问题；指出的两条失败反馈分支已补集成覆盖。

首次全量验证为 31/33：本次插入导致代码指南行号过期，以及旧模拟边界 fixture 未隔离新增展示模块的浏览器依赖。均已修正后重跑通过，不是已有环境问题，也未隐藏失败。Lit 开发模式提示属于现有 validator 环境提示。

`git diff --stat`（包括用户修改及 P0-1，且不含未跟踪文件）：

```text
17 files changed, 328 insertions(+), 95 deletions(-)
```

不能把这个原始统计当作本次独有增量。本次独有增量见第 3 节。

## 8. 边界与遗留风险

未改项目持久化格式；SolverResult、PreviewValidity、failureReason 和模型范围均为运行时派生数据。旧项目、无目标流程、旧纱线逻辑及 PBR 回归 validators 通过。Pattern 未改，排针与 Pattern 保持独立；Machine Domain 未加入 UI 状态。

模型范围仍受现有 loopHeight 0.05–2 及单调性假设限制，不能解释为真实工艺可生产范围。旧左侧纱长统计口径问题仍未修复，现已明确限定。结果关联继续使用现有 feedIndex+yarnIndex；没有做 assignment ID 迁移。真实浏览器测试覆盖功能反馈，未做跨浏览器/GPU 像素一致性验收。

没有 UI 视觉重构、批量纱长修改、非法输入处理、Undo、Yarn Library 大改、Legacy 删除、Command Bus、Event Sourcing、GSM、幅宽、耗纱或新增 PBR/生产计算功能。工作区现有修改全部保留；未提交。任务完成后停止，等待下一条指令。
