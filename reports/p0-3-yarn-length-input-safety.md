# KnitScape P0-3：纱长输入安全与原子提交

开工基线：main，HEAD `29b7e4bcfaee6c9b7f3df070b24c200b7aa56103`。保留全部 P0-1、P0-2 与用户修改；开工时 54 个既有未提交文件已做副本和 SHA256 记录。

## 开工审查与实施计划

真实调用链：单项输入 change/Enter→ `setSingleJerseyFeedYarnLength()` → `editableYarnLength()` → dispatch Cam facts → runSimulation 清除派生结果 → debounce Solver → 当前结果与 PreviewValidity。

修改前 -1、NaN、Infinity、-Infinity、非数字字符串均被转成 0 并替换 State；空串、0、null、undefined 同样转成 0。所有调用没有结构化返回。23、27、0.5、23.14 可以写入。详细基线：`p0-3-input-audit-before.json`。

当前 Domain 定义为有限非负数，正值无业务上限；0 是 unset 持久化表示。HTML 单项 number/min=0/step=0.1 不能防护 action，step 又不匹配任意正小数；原生数字输入能将未完成的字符如 e 暴露为 value=""，必须避免误认成 Clear。

实施顺序：

1. 建立真实 action→state→runSimulation 集成回归，先确认 23→-1 测试失败。
2. 抽取最小共享纯 validator；非法输入在 dispatch 前结构化拒绝。普通值、拒绝、Clear 明确区分；旧输入 0/empty/unset 表示继续兼容。
3. 建立显式单项 Clear action。现有批量 action 只复用必要安全守卫，不改批量工作流。
4. 单项输入保留原始文本，用同一 validator 驱动 HTML custom validity；失败恢复原值并显示未保存；添加最小 Clear 控件。
5. 真实浏览器验证输入、拒绝、清除、27、双 Yarn；继续运行 P0-1/P0-2 回归及全量验证、构建、diff 检查。

范围外：P0-4 批量纱长、Undo/Redo、Yarn Library 重构、Legacy 删除、UI 重构、生产计算与持久化格式迁移。

## 完成报告

### 1. 修改前 -1 为什么会变成 0 / unset

`editableYarnLength()` 使用 `Number()` 后，仅保留有限且大于 0 的值，其余一律返回 0。setter 随即 dispatch 新 Cam；runner 正常把这次错误写入当成事实变更，清理有效 SolverResult。负数和非数字因此被误当作用户清除。修改前通过真实 action 逐项测得 -1、NaN、Infinity、-Infinity、"invalid" 都写入 0，State 对象被替换，且返回 undefined。基线读数见 `p0-3-input-audit-before.json`，浏览器见 `p0-3-browser/before-negative.json`。

### 2. 最终合法 / 非法 / Clear 语义

| 输入 | 结果 | Project State |
|---|---|---|
| 有限正数或可转换的数字字符串，如 23、27、0.5、23.14 | SET | 保存数值 |
| 负数、NaN、±Infinity、非数字字符串、非数字类型如 object/boolean | INVALID_YARN_LENGTH | 完全不变 |
| 0、空字符串或纯空白、null、undefined | CLEAR，兼容既有 unset | 保存 0 |
| 明确 Clear action / 按钮 | CLEAR | 保存 0 |

保留原有 `Number()` 数字字符串转换口径；没有新增工艺/求解上限。模型不可达仍属于 SolverResult，不能冒充输入非法。0.5 输入成功并返回 UNREACHABLE_TARGET，23.14 输入成功并收敛。项目 normalization 对原始值先使用共享 validator；保留数字、数字字符串、0、empty、null 的导入兼容，缺失/undefined 项目字段继续抛出原有 TypeError。

### 3. Domain validation 在哪里

`src/domain/yarnLengthInput.js -> validateYarnLengthInput()` 是最小纯函数。单项 setter 在任何 dispatch 前验证，非法返回 `{ ok: false, reason: "INVALID_YARN_LENGTH", previousValue: 23 }`；合法返回 `{ ok: true, value: 27, operation: "SET", previousValue: 23 }`。既有多 Feed setter 也复用最后防线，未改它的范围/选择/工作流；数组替换 action 先验证全数组再 dispatch。项目导入和整路替换使用同一原始值校验，保留既有 TypeError 错误方式。

### 4. UI validation 在哪里

`src/views/singleJerseyCamProgramEditor.js` 单项输入 `@input` 调用共享 validator 设置 HTML custom validity，仅处理草稿；`@change` / Enter blur 调用受保护 action。非法提交恢复原值，显示“未保存：请输入有限正数，或清除目标。原目标保持不变。”。每项添加“清除目标”按钮和局部 `role=status` 提示。没有调整视觉样式和布局。

单项 number 改为 text + inputmode=decimal，以保留原始非法字符；避免浏览器把 `e` 暴露成空值后误清除。展示值使用 String，避免原来的 toFixed(1) 将 23.14 舍入成另一个目标。原有批量 UI 未重构。

### 5. 是否存在重复规则

单项 UI、两种 setter、Feed Yarn normalization 都使用同一纯 validator 检查数值合法性；没有建立第二套范围或 Validation Framework。现有批量表单 HTML 约束保留，批量 action 使用共享最后防线。UI 草稿和提示留在 DOM，不进入业务 State。

### 6. 非法输入是否修改 Project State

否。集成断言不只是目标仍为 23，还检查 GLOBAL_STATE 严格引用相等；无 dispatch、无局部替换。包括直接调用 Domain/action 的 NaN/±Infinity 和对双 Yarn 中 A 的非法提交。

### 7. 非法输入是否错误清理 Derived Result

否。严格断言 SolverResults 数组引用相同、原 Canvas 路径相同、无新 debounce timer、PreviewValidity 保持 VALIDATED。非法输入没有被送入 Solver，也没有生成新可信结果。

### 8. Clear 如何工作

显式 `clearSingleJerseyFeedYarnLength(feedIndex, yarnIndex)` 提交既有 0 表示；仅成功提交后 runner 清理旧派生结果并重新求解。单项清除从实际 SolverResults 移除对应项，反馈显示 NOT_SET / 未应用。其余目标仍成功时 VALIDATED；全部目标清除时 DESIGN_PREVIEW。这继续沿用“所有当前参与目标成功”的现有推导。

### 9. 23 → -1 实测

集成和真实浏览器均通过。返回 INVALID_YARN_LENGTH / previousValue=23；目标 23，Solver target=23，CONVERGED / 已应用，PreviewValidity=VALIDATED。四路初始求解 22.99985537891976 至 22.99985636579647，最大误差 0.00014462108023835185 cm，小于容差 0.00079375 cm。拒绝后原结果没有变化。

### 10. 23 → 非法字符串实测

集成的 "invalid"、浏览器的 "abc" 和 "e" 均拒绝。草稿 HTML validity=false，提交后恢复 23 并显示未保存；目标和全部当前求解反馈保持不变。

### 11. NaN / Infinity 实测

action 直接调用 NaN、Infinity、-Infinity 全部拒绝且 State 严格不变。浏览器输入 "NaN" / "Infinity" 也拒绝，维持 23 和 VALIDATED。集成还覆盖对应字符串、object、boolean。

### 12. 23 → Clear 实测

清除一个目标：该项 0 / unset，旧结果立即清空；重新求解后剩余 3 项 CONVERGED，VALIDATED。清除全部：目标均 0，SolverResults=[]，DESIGN_PREVIEW。浏览器四项为空、NOT_SET / 未应用，显示目标已清除。

### 13. 23 → 27 实测

返回成功 SET；目标保存 27。同步清理旧 SolverResults、暂为 DESIGN_PREVIEW，重新计算后 CONVERGED / 已应用 / VALIDATED。Feed 1 实测 26.999994326440053，误差约 0.00000567356 cm，小于现有容差。浏览器输入 27 和 23.14 均保持精度并收敛。

### 14. 同 Feed 双 Yarn 隔离测试

A=23、B=18；对 A 输入 -1 后，两者仍 23 / 18，五项 SolverResults 严格保留，VALIDATED。浏览器求解显示 A=22.9999、B=17.9994，两项均 CONVERGED / 已应用，A 显示未保存。数组替换含一个非法 Yarn 时，也在任何 dispatch 前抛出既有 TypeError，整个 State 保持不变。

审查补充了 4 项原始类型 replacement 和 8 项非法 import 原子性测试，防止 []、true、object 被 Number 转换成 0 或 1。包含自定义 valueOf 对象，证明不执行非法类型的数值转换。5 项数字/字符串/0/empty/null 旧值导入全部通过。

### 15. P0-1 / P0-2 回归

新集成及既有集成通过；既有真实浏览器 A–G 也在当前代码重新执行通过：23→VALIDATED；四路 100→UNREACHABLE_TARGET / 未应用 / INVALID，目标仍 100；混合→PARTIAL；无目标→DESIGN_PREVIEW；排针撤回后旧反馈消失，确认后恢复；100→23恢复；同 Feed 一成功一失败不会聚合为全部成功。原左侧统计仍明确标注基础预览统计。

旧项目/JSON/.knitscape/PBR 导入导出兼容验证通过。项目 schema 与 exporter/importer 未改，PreviewValidity / SolverResult 继续不作为项目事实持久化。VALIDATED 仍仅表示模型几何求解成功，未经实机验证。Pattern、排针、Cam Machine Domain 均未修改。

### 16. npm run validate

退出码 0，34/34 validators 通过，包含新增 `validate:yarn-length-input-integration`，以及 yarn-length units/solver/result/failure、Cam editor、机器集成、Yarn Library/旧项目/.knitscape/PBR、UV、1/2/3/N Yarn renderer 等相关验证。日志：`p0-3-validate.log`。Lit dev mode 提示属于 validator 使用开发 SSR 时的提示；没有失败。

新增测试先在旧实现运行：A 断言实际 0 != 23，失败；实现后通过 A–F。新增浏览器重放脚本按可见控件操作，不注入 app state；13 个 P0-3 截图/读数和 7 个 P0-1/P0-2 回归读数见 `p0-3-browser/`，浏览器错误日志为空。

独立审查发现原始类型被 normalization 的 Number 提前转换的遗漏；新增测试在修复前报 Missing expected TypeError，修复后通过。审查者复验确认无 Critical / Important / Minor 遗留项，独立 integration 通过；另外真实浏览器 Enter 提交/拒绝、非法草稿直接 Clear 均通过。最终修改后全量 validators、build 及 P0-3 浏览器重新运行通过。

### 17. npm run build

退出码 0，741 modules transformed，构建成功（2.30 s）。日志：`p0-3-build.log`。

### 18. git diff --check

退出码 0，无 whitespace error。仅现有 Windows Git LF→CRLF 提示；没有批量转换换行。日志：`p0-3-diff-check.log`。

### 19. git diff --stat

当前完整 tracked 工作区（包含此前用户及 P0-1/P0-2 修改，排除所有 untracked）：20 files changed, 410 insertions(+), 114 deletions(-)。

本次 P0-3 源码/配置/测试增量按开工副本与原本 clean 文件统计，包含新增三个文件：8 files changed, 397 insertions(+), 19 deletions(-)。报告、日志、JSON 与截图不计入此增量。

### 20. 修改文件清单

| 文件 | 本次内容 |
|---|---|
| src/domain/yarnLengthInput.js（新增） | 最小共享输入纯 validator，SET/CLEAR/reject |
| src/actions/singleJerseyCamProgram.js | dispatch 前校验、结构化结果、显式 Clear、复用既有 normalization 守卫 |
| src/views/singleJerseyCamProgramEditor.js | 草稿校验、拒绝提示/恢复、单项 Clear，保留完整数值文本 |
| src/i18n/translations.js | 4 种语言各追加 4 个反馈/清除翻译键 |
| scripts/validate-yarn-length-input-integration.mjs（新增） | 真 action/state/runner/solver 链 A–F，raw replacement/import 原子拒绝及旧值导入兼容回归 |
| scripts/browser-yarn-length-input.mjs（新增） | 真实浏览器 P0-3 控件重放与断言 |
| scripts/validate-single-jersey-cam-editor.mjs | 原非法回退断言改为原有效目标保留及结构化拒绝 |
| package.json | 注册新增 integration validator |

额外审计/证据：本报告、`p0-3-input-audit.mjs`、`p0-3-input-audit-before.json`、`p0-3-preservation-check.json`、三项命令日志、`p0-3-browser/`。开工副本/初始 SHA256 在外部可写 audit 目录。54 个开工未提交文件中 52 个 SHA256 完全一致；另 2 个 package/translations 只新增 1/16 行，没有删除既有修改。当前 HEAD 未变，无提交、reset、checkout、stash 或删除。

### 21. 遗留风险

沿用 0/empty/nullish 的兼容清除语义；没有为本任务迁移成新的项目格式或限制正数上限。模型范围仍不是实际工艺范围；实际 GPU/PBR 像素未新增视觉比对，已有 renderer/PBR validators 与浏览器实际预览回归通过。批量 UI 的精度/操作反馈沿用原行为，P0-4 未处理；批量 action 仅补必要非法输入保护。

原本宽松转换会接受项目字段中的数组/布尔值/对象，最终明确拒绝这些非法类型；有效旧格式数字/数字字符串/0/empty/null 已经真实导入验证。没有新增自动修复非法项目文件的流程。

没有顺手处理 Undo/Redo、Yarn Library 重构、Legacy 双纱删除、UI 视觉/布局重构、GSM/幅宽/耗纱、PBR 新能力、Command Bus、Event Sourcing、GLOBAL_STATE 或项目 schema 大迁移。完成后停止，等待下一条指令。
