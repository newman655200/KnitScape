# Yarn Length Observability

Date: 2026-10-18, Asia/Shanghai. Stage: P0-C0 Correctness Preparation.

## 1. Scope

**没有改变业务纱长定义。** 本轮只处理 observability 与 metadata semantics。M1/M2/M3 沿用原有实现；full-repeat 没有成为 canonical authority；23/8 的工艺角色和 CONVERGED 的数学条件没有改变。

开始时实际执行 `git branch --show-current`、`git rev-parse HEAD`、`git status --short`、`git log -1 --oneline`：`main @ 7ababf264d495f6b96d4d66652c529424938ac4d`，最新提交 `7ababf2 feat: establish trusted feed yarn length workflow`。工作区有已有未提交改动，详见 [baseline-status.txt](baseline-status.txt)，不是干净 baseline。旧文档的“2026-10-17仅Markdown”属于前次任务；本轮按用户明确授权进行 metadata 修改及 npm 验证。

Gauge Authority fix 仍存在：`machineGauge.js` 作为唯一 Gauge 校验/换算入口的既有改动保留；本轮修改前后全量 validate 中 `validate:gauge-authority` 均通过。开工实际 baseline 是 validate **38/39**、build **PASS**；不是引用历史通过记录。

执行顺序：先追踪消费者并捕获真实运行 baseline → 先写 width32/period4 回归并确认失败 → 重命名 metadata、更新消费者 → 比较全部诊断值 → 完整验证及报告。用户已明确设计、要求从 main 继续且禁止 commit，因此没有新建分支、提交或额外架构。

## 2. M1 Definition

调用链：`runSimulation` → `createSingleJerseyExecutionInput`（既有 Machine Domain/adapter）→ `simulate` → `buildYarnPathGeometry` → `periodicMeasurementPattern` → `createModelLengthEvaluator` → `solveFeedYarnLengths/measuredLengthForFeed` → `resultFromCandidate` → `simulate` 路径应用 → `derivePreviewValidity` → Solver feedback。

| Definition | M1 — Solver Metric |
|---|---|
| Metric ID / Name | M1 / Current Solver periodic course metric |
| Runtime / Authoritative | 是；仅当前软件 Solver objective，非生产 authority |
| Input geometry | 当前 strand 的 diameter profile、模型 loopHeight、K/T/M 生成路径；Gauge 只作模型长度换算 |
| Window | 在所有 course 上找能**整除 chart width**的最小精确水平操作周期 p；建立 3p 宽测量拓扑，选 padded source needle `[1+p, 1+2p)` |
| Boundary handling | 整条 outgoing link 归 source needle，包含跨区间 float；3份周期提供相邻曲线控制点；不额外添加闭合段；保留有限高度顶/底边行为 |
| Course handling | 每个 course 独立积分、按 p 归一化；同 Feed 的所有已测 courses 取算术平均。row 为零基，归属 `row % feedCount`；没有去掉顶边 |
| Needle span | 本 fixture 的30宽为p=30；32宽为p=4。不是排针数组长度直接作为分母 |
| Normalization denominator | 每 course 实际积分针位 p；`normalizeModelLengthPer100Needles(raw,p)`；结果单位基数100 |
| Unit | model units/100 needles → `modelLengthToMm(value,gauge)/10` → cm/100 needles |
| Feed-specific / Yarn-specific | 是 / 是；runtime 按 Feed×Yarn target 与 strand profile 求解；同 profile/target 可共用计算 |
| Used by Solver / UI / acceptance | 是 / Solver反馈是 / 是，另须路径已应用、目标匹配及误差在容差内 |
| Used by Renderer | 数值/count不直接供 Renderer；成功求得且应用的路径供绘制 |
| Production validated | 否；PENDING_PROCESS_CONFIRMATION |

当前 `CONVERGED` 仍由 model-space error ≤ tolerance 判断，默认 tolerance=0.01 model units/100 needles；32G下对应0.00079375 cm/100 needles。没有改成0.01cm，也没有改 solver bounds `0.05..2`。JSON 保留 runtime 的 error、tolerance、reachableRange、solvedLoopHeight、appliedToSimulation 与各 course 数值。

来源：[yarnPathGeometry.js](../../src/simulation/yarnPathGeometry.js)、[yarnLengthSolver.js](../../src/simulation/yarnLengthSolver.js)、[yarnSimulation.js](../../src/simulation/yarnSimulation.js)、[previewValidity.js](../../src/simulation/previewValidity.js)。

## 3. M2 Definition

调用链：Pattern chart → `simulate` → `buildYarnPathGeometry/buildYarnLengthMetrics` → `pathDataLength` → `cmPer100Loops` → `runSimulation` 写入 `GLOBAL_STATE.yarnLengthMetrics` → `yarnLengthReadout`。

| Definition | M2 — Legacy Preview Metric |
|---|---|
| Metric ID / Name | M2 / Base preview statistic |
| Runtime / Authoritative | 是；仅历史预览读数，非目标求解或生产 authority |
| Input geometry | Solver前的基础 display path；按 stitchWidth 去除画布比例 |
| Window | 有限 width×height chart；M/L/C路径，每 cubic 默认24段采样折线 |
| Boundary handling | 仅 source **且** target 均在有效针位内的 link；外侧 link 被排除，不采用 M1 的 source-only periodic ownership |
| Course handling | 全窗口求和，不按 Feed 平均；包含有限高度边界 |
| Needle span | 有效 chart width；没有独立的 periodic integration denominator |
| Normalization denominator | `effectiveLoopCount = width * height`，包含 K/T/M 等所有 chart cells，不是真实 knit-loop 计数 |
| Unit | 现有字段 `cmPer100Loops` / UI `cm / 100线圈`（英文 cm / 100 loops）；保持历史标签 |
| Feed-specific / Yarn-specific | 否 / 否；不是 Feed×Yarn 目标结果 |
| Used by Solver / UI / acceptance / Renderer | 否 / 是 / 否 / metric数值否；与 Renderer 共用基础路径来源 |
| Production validated | 否 |

**当前 UI 的 M2 来自排针前 Pattern，不能说它是排针后 Feed×Yarn 纱长。** `runSimulation` 只将 `baseSimulationResult.yarnLengthMetrics` 写入全局读数，排针后仅写 SolverResult/PreviewValidity。排针后 `simulate` 也返回一个 first-strand base M2，但未写入该 UI 字段。

JSON 的 `m2.value` 是 UI 来源，`m2.feedIndex/yarnIndex/yarnId=null` 表示无这些维度，按每条诊断附带共享上下文；`m2.machinePreview` 单独保留排针后基础 M2，明确 `usedByUI=false`。二者调用相同现有 M2 实现，没有添加第四套公式。改变 Feed target 不会把 M2 变成求解值。

来源：[runSimulation.js](../../src/components/runSimulation.js)、[yarnLengthMetrics.js](../../src/simulation/yarnLengthMetrics.js)、[rowLengthLoopModel.js](../../src/simulation/rowLengthLoopModel.js)、[yarnLengthReadout.js](../../src/views/yarnLengthReadout.js)。

## 4. M3 Definition

调用链：`simulate` 的最终 strand model paths（从绘制入口只读捕获）→ 已有 `auditFinalYarnLength` → `integrateGeneratedPath` → report JSON。原独立 auditor 的公式和自检均未修改，也没有复制积分器。

| Definition | M3 — Full-repeat Diagnostic |
|---|---|
| Metric ID / Name | M3 / Internal complete-repeat diagnostic |
| Runtime / Authoritative | 否 / 否；report-only independent diagnostic |
| Input geometry | 最终生成的 model-space M/L/C中心线；独立 adaptive Simpson 积分 cubic，直线用原 auditor 的长度 |
| Window | 本fixture有效零基source针位 `[4,20)`，16针=4个1234循环；row在 `[8,32)` 且归属所选Feed |
| Boundary handling | 整条 outgoing link归source针位，包括跨重复边界link；不添加闭合段；排除首尾各8个course的guard band |
| Course handling | Feed f 的零基rows `[8+f,16+f,24+f]`，每个16针；Feed8为 `[15,23,31]` |
| Needle span | 每course16针，3个passages；不是30/32宽，也不是全机3216针 |
| Normalization denominator | 16×3=48 needle passages，换算到100；不是48个knit loops/links |
| Unit | cm/100 needle passages |
| Feed-specific / Yarn-specific | 是 / 是 |
| Used by Solver / UI / acceptance / Renderer | 全部否；只读 Renderer入口的model paths，无渲染修改 |
| Production validated | 否 |

“Full-repeat”在此仅指**内部完整水平重复区间**，不是整个chart或工厂canonical测量。对未收敛第二纱，`m3.value` 测的是实际保留的base fallback path；`solverCandidateValue` 使用同一auditor另读失败候选路径，`solverCandidateApplied=false`。不能拿失败候选值冒充实际应用值。

来源：[independent-auditor.mjs](../yarn-length-semantics-audit-2026-10-16/independent-auditor.mjs)、[既有length-probe](../maintainability-audit-current/length-probe.mjs)。

## 5. Needle Count Semantics

| 概念 | 表达 | width32 / period4 |
|---|---|---:|
| 外层chart/window有效宽度 | `windowNeedleCountByCourse.get(row)` | 32 |
| 实际每course积分分母 | `integrationNeedleCount` | 4 |
| 已归一化结果的单位基数 | `measuredModelLengthPer100NeedlesByCourse` 的 Per100；JSON `normalizationBasis` | 100 |

显式 `measurementWindow` 的内部几何中，window map表示所选区间宽度，因此为4；内部拓扑宽12由probe的真实geometry参数记录，不能把12称为分母。对外层periodic geometry，window map保持原先的chart宽度32。`integrationNeedleCount` 在同一geometry各course相同，故仅需一个标量。

没有保留误导性的旧字段alias，没有增加四个近义字段；100已由Per100字段名表示，不再给runtime添加重复常量。M3 auditor自己的 `measuredNeedleCount` 表示真实累计needle passages，语义正确，未改动；`normalizeModelLengthPer100Needles` 的参数 `measuredNeedleCount` 是真实分母，也不属本次问题。

## 6. measuredNeedleCount Root Cause

`createModelLengthEvaluator` 的outer periodic分支接收内部已按period归一化的course长度，但将 `pattern.width` 写入旧count map；显式measurement分支则记录 `measurementWindow.needleCount`。旧名让这两个层级容易被误认为同一积分分母。它原先在公开外层结果表示effective chart window width；所以不能仅把32改为4。

| Consumer类别 | 查找结果与处理 |
|---|---|
| Solver | 不读count；`measuredLengthForFeed`仅读已归一化course map；无需修改 |
| UI / acceptance | 不读count；无需修改 |
| export / Project format | 不保存该派生geometry字段；无需修改 |
| Renderer | 不读count；无需修改 |
| validator | `validate-yarn-length-gauge.mjs`原来断言width；更正名称、说明并增加真实span断言 |
| report / debug | `maintainability-audit-current/length-probe.mjs`及`real-sop-geometry-gap-audit-2026-10-16/audit.mjs`读取旧map；同步字段读取，不重写历史输出 |
| 其他 | 仓库JS/MJS搜索未找到其他旧map消费者 |

这是诊断metadata合同问题，**不是Solver结果错8倍**。字段重命名不会改变任何归一化计算、求解输入或目标。

## 7. Code Changes

本轮已有文件只修改四个；其开工前已有改动保留：

1. `src/simulation/yarnPathGeometry.js`：旧map改名 `windowNeedleCountByCourse`；增加从实际period/window直接取得的 `integrationNeedleCount`，在初始geometry及候选结果透出。没有新增计算公式。
2. `scripts/validate-yarn-length-gauge.mjs`：更新名称；width32、period4、不同loopHeight候选的回归；K、K-M、M-K、K-M-M-M、K-T多宽度用例也断言真实period。
3. `reports/maintainability-audit-current/length-probe.mjs`：读取新window map并输出真实span。
4. `reports/real-sop-geometry-gap-audit-2026-10-16/audit.mjs`：同步旧map读取/输出键，防止report脚本因rename崩溃；其他逻辑不动。

本目录新增 `diagnostic.mjs`、`REPORT.md`、`results.json`、修改前 `baseline-results.json` 及验证证据。CLI沿用已有Vite memory-observer方式；只替换draw sink，不运行GPU/浏览器，不冒称浏览器视觉验证。复用真实 `simulate`、Machine adapter、geometry、Solver、M2及旧M3 auditor。四个固定SOP场景，不是Comparison Harness，不接受任意工厂输入或新schema系统。

| 最小diff检查 | 结果 |
|---|---|
| 新增src模块 / 新业务公式 / 复制length calculation | NO / NO / NO |
| 修改Solver objective / M1-M2-M3数学定义 | NO / NO |
| 修改Project format / Machine Domain / UI / Renderer / PBR / Material Authority | 全部NO |
| Solver数值变化 | NO；48条记录完整对象与修改前逐项deepEqual |

复跑（仓库根目录）：

```powershell
node reports/yarn-length-observability-2026-10-18/diagnostic.mjs
npm run validate:yarn-length-gauge
npm run validate:yarn-length-solver
npm run validate
npm run build
git diff --check
```

`--baseline` 仅用于本轮修改前取证，后续正常复跑不要用它覆盖冻结证据。JSON包含fixture SHA256、branch/HEAD、输入来源、测量id、source function、window、denominator、unit、Feed/Yarn identity、状态及UNKNOWN。

## 8. SOP Fixture Results

实际读取保存的 `SOP-001-N6W6040-main-yarn-with-cam.knitscape`，32G、1234、真实4×8 Cam。原包仅有N6/W主纱；双纱情景沿用既有geometry-gap audit的 `audit-low` 人工诊断分配，**不是SOP已确认的20D分配**。原包及所有已有输出文件未覆盖。

以下摘录Feed8；JSON完整包含四个场景、48条Feed×Yarn记录。主纱加入第二纱前后的数值一致。

| Window | Feed/Yarn | Target | M1 | M2 UI共享上下文 | M3最终路径 | M1 Status | M1 span / M3 denominator |
|---|---|---:|---:|---:|---:|---|---|
| 30×40 | 8 / N6/W | 23 | 22.999733873 | 24.792732968 | 24.077277996 | CONVERGED | 30 / 48 passages |
| 32×40 | 8 / N6/W | 23 | 22.999580039 | 24.805103333 | 23.701615835 | CONVERGED | 4 / 48 passages |
| 30×40 | 8 / 20D诊断分配 | 8 | 13.208564709 | 24.792732968 | 27.065709704 | UNREACHABLE_TARGET | 30 / 48 passages |
| 32×40 | 8 / 20D诊断分配 | 8 | 13.320235620 | 24.805103333 | 27.065709704 | UNREACHABLE_TARGET | 4 / 48 passages |

M1和Target单位cm/100 needles，M2单位为历史cm/100 loops，M3单位cm/100 needle passages，不能忽略定义直接横向判真伪。排针后基础M2另为30宽 **25.288055260**、32宽 **25.296370701**，不是UI读数。

第二纱各Feed全部UNREACHABLE_TARGET。Feed8模型可达范围：30宽 **13.208564709..55.658397610**，32宽 **13.320235620..56.650444167** cm/100 needles；不是机台工艺可达范围。选中候选loopHeight=0.05，其独立M3为 **13.440442339**，但没有应用；实际基础path的M3为 **27.065709704**。主纱场景PreviewValidity=VALIDATED、双纱场景=PARTIAL，均仅指软件状态。

物理输入来源六项：

| Value | Unit | Source | Measurement / derivation principle | Confidence | Applicable state |
|---|---|---|---|---|---|
| 32 | needles/inch | SOP保存包machineGauge | 现有25.4/G换算，0.79375mm/model针距 | SOP转录，软件换算确认 | 机针标尺，非松弛布面 |
| 23 / 8 | cm/100 needles | SOP记录；23在保存包，8由既有诊断分配加入 | 工厂测量步骤与值角色PENDING | 数值转录；工艺等价性未确认 | UNKNOWN |
| 0.24 | model needle pitch | 保存包primary ply；两纱当前runtime fallback | 既有geometry曲线offset参数 | 未标定软件值 | model-only；真实物理直径UNKNOWN |
| 1 | ratio | 保存包lengthScaleY | 既有模板height scale | 软件输入确认 | model-only |
| tension=null | cN字段 | 保存包/既有诊断分配 | 未用SOP 5/4cN改geometry | UNKNOWN | UNKNOWN |

## 9. 30×40 vs 32×40

30不是4的整数倍，`periodicMeasurementPattern`要求周期整除chart width；本例选p=30，三副本宽90，选padded针位 `[31,61)`。32宽选p=4，三副本宽12，选 `[5,9)`。这使M1的水平周期拼接语境不同，而不是32/4计数误用于乘除。各course值在JSON中保留，Feed8还包括顶边row39。

32宽Feed8的5个course是7、15、23、31、39；M3只选15、23、31。即使水平period=4，M1仍平均有限高度全部course，M3只测内部course，因此不会自动相同。30宽还叠加不同水平拼接语境。求解出的loopHeight随当前M1窗口变化，使相同M3内部16针区间的最终path值也变化。

M2两种宽度的变化来自有限chart边界、采样sum和width×height分母。这里没有进行工艺判定；23.701615835明确只属于32×40 comparison。

## 10. Production Meaning

**MODEL MEASUREMENT ≠ FACTORY MEASUREMENT。** M1是当前Solver的软件目标口径；M2是基础预览统计；M3是完整内部重复诊断。不能由本轮结果得出“M1错误”或“M3正确”。没有将full-repeat升级为canonical authority，没有让8强行收敛，没有改变23/8工艺语义。

**CANONICAL_FACTORY_MEASUREMENT = PENDING_PROCESS_CONFIRMATION**。

## 11. Remaining Unknowns

- 真实100针测量方法：端点、ownership、cut/clamp/loop/needle passages及边界处理。
- 第二纱路径：真实Feed分配、parallel/plating关系、是否预牵伸；人工probe不代答。
- load state：带载、卸载、回缩、静置、整理后状态及真实张力作用。
- 23/8 value role：目标值、实测值、工艺设定或验收值及各自容差。
- 真实直径及其他物性；0.24仅模型fallback，不能当作实测毫米值。

七个工艺问题仍以 [PROCESS_VALIDATION.md](../../docs/PROCESS_VALIDATION.md) 为准。本轮未进入Comparison Harness、Palette修复或后续架构任务。

## 12. Verification

| Check | Baseline / Final | Evidence |
|---|---|---|
| `npm run validate` | 38/39 → 38/39，exit1；相同已知失败，New failures=0 | [baseline-validate.log](baseline-validate.log)、[validate.log](validate.log) |
| `npm run build` | PASS → PASS，exit0 | [baseline-build.log](baseline-build.log)、[build.log](build.log) |
| targeted gauge metadata regression | RED：`undefined !== 4` → PASS | [regression-red.log](regression-red.log)、[targeted.log](targeted.log) |
| `validate:yarn-length-solver` | PASS，保留既有独立4096采样reference对照 | [targeted.log](targeted.log) |
| actual SOP diagnostic replay | 4场景、48条记录；修改前后整对象精确相等 | [baseline-probe.log](baseline-probe.log)、[probe.log](probe.log)、[results.json](results.json) |
| historical length probe | PASS；新window字段30/32、integration字段30/4 | [legacy-probe.log](legacy-probe.log) |
| historical geometry-gap audit | `node --check` PASS；仅rename，未重跑会覆盖历史输出的整套audit | 修改前后单行diff核对 |
| `git diff --check` | PASS，exit0；无whitespace error | [diff-check.log](diff-check.log) |

已知baseline failure为 `validate:row-length-loop-model` 对 `KnitScape_当前功能与算法.md` 标题的 `/## \d+\. 当前验证结果/` 断言；本轮未修该Markdown或降低断言。Gauge fix验证仍通过，新增metadata用例先红后绿。已有工作区改动未回滚，未commit、未tag。

**YARN_LENGTH_OBSERVABILITY = PASS**（本任务的软件诊断与metadata目标；不表示全量validate全绿）。

**CANONICAL_FACTORY_MEASUREMENT = PENDING_PROCESS_CONFIRMATION**。
