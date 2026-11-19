# P0-1 纱长成功路径审查与实施记录

开始日期：2026-10-06；最终验证日期：2026-10-07（Asia/Shanghai）。用户任务规格为本次设计与范围依据。
项目：`C:\Users\liuchen\Desktop\knitscape`。

## 修改前审查

- 分支：`main`。
- HEAD：`29b7e4bcfaee6c9b7f3df070b24c200b7aa56103`。
- 已阅读 `AGENTS.md`、`KnitScape_当前功能与算法.md`、`NEXT_TASK.md`。后两者描述旧基线；本任务以当前 main 源码和用户 P0-1 规格为准。
- 初始 `git status --short`：

```text
 M package.json
 M scripts/validate-feed-yarn-pbr-renderer.mjs
 M scripts/validate-yarn-simulation-characterization.mjs
 M src/i18n/translations.js
 M src/simulation/drawYarnSimulation.js
 M src/simulation/yarnPathUvStrip.js
 M src/simulation/yarnSimulation.js
 M src/simulation/yarnTextureBrush.js
?? reports/
?? scripts/validate-multi-yarn-renderer.mjs
```

初始改动保留。交叉文件只在现有内容上添加最小增量；其他初始文件保存 SHA256 供完成时比对。

## 真实调用链与数据边界

`singleJerseyCamProgramEditor` → `setSingleJerseyFeedYarnLength()` → `dispatch(singleJerseyCamProgram)` → `runSimulation.syncState()` → debounce → `createSingleJerseyExecutionInput()` → `resolveSingleJerseyOperations()` → simulation adapter → `simulate({feeds, machineGauge, yarnLibrary})` → `solveFeedYarnLengths()` → 收敛 Model Paths → Canvas/UV renderer。

Feed 项目事实为 `singleJerseyCamProgram.feeds[feedIndex].yarns[yarnIndex]`：

```js
{ yarnId, yarnLengthCmPer100Needles, tensionCN, placement }
```

目标由 Cam actions 写入，模拟消费；导入/导出已有这些字段。Gauge 由 state 默认值、读数面板 action 和项目导入写入，solver、geometry、UV renderer 消费。

`yarnLengthSolverResults` 原来仅在 `simulate()` 中生成/缓存/消费并返回，`runSimulation()` 丢弃排针后的返回结果。`GLOBAL_STATE` 没有该字段，也没有 PreviewValidity。

`yarnLengthMetrics` 由 `buildYarnPathGeometry()` 计算，`runSimulation()` 只发布排针前版本，`yarnLengthReadout()` 消费 `cmPer100Loops`。它不是 Feed × Yarn 的目标校验结果。

## 最小实施计划

- [x] 新增真实集成 validator，覆盖 actions/state → runSimulation → Machine Domain → solver → 绘制 → 运行时结果与 PreviewValidity；先确认缺失结果的失败。
- [x] 在现有 solver result 中增加带单位的 target/solved/error/tolerance，复用 CONVERGED、UNREACHABLE_TARGET、MAX_ITERATIONS，预留 NOT_SET/ERROR。
- [x] 新增 PreviewValidity 纯推导函数，验证当前参与纱线的结果完整性和路径实际应用情况。
- [x] simulate 返回有效性；runSimulation 发布排针后结果，变更时立即清除旧验证结果，缺配置为 DESIGN_PREVIEW，非法机器配置为 INVALID。
- [x] 增加 `npm run validate` 总入口，执行所有现有 validator 和新增集成 validator。
- [x] 运行相关 validators、完整 validate、build、diff --check，检查原有改动保留情况，记录 23/27 实测和限制。

不修改 UI、Machine Domain、Pattern、项目持久化格式或其他用户禁止的内容。目标、solver 结果、预览有效性各自保留其边界；派生结果不进入项目权威数据。

## 修复前验证

- 原有 `validate:yarn-simulation-characterization`：PASS，23 和 27 的真实 solver 已收敛。
- 原有 `validate:single-jersey-execution-integration`：PASS，但其中 simulate 为 stub，不能证明结果发布链路。
- 原有 `npm run validate`：失败，Missing script: validate。
- 沙箱内 Node 启动时 EPERM（lstat 用户目录）；自动审批后的正常运行可执行 validators。这是环境基线，发生在改代码前。

## 最终报告

### 1. 修改前真实调用链

Cam editor → Cam actions → `singleJerseyCamProgram.feeds[].yarns[]` → state 通知 → `runSimulation()` → Machine Domain / adapter → `simulate()` → `solveFeedYarnLengths()` → 收敛路径 → renderer。SolverResults 在 simulate 内生成和消费，返回后在 runSimulation 断开。

### 2. 根因

算法原本可以收敛，但排针后 SolverResults 未进入当前结果 state。现有 result 仅明确给出 model 单位，没有直接可消费的 cm / 100针结果和整体 PreviewValidity，也没有参数编辑时清除旧验证结论的机制。左侧 yarnLengthMetrics 属于排针前 cm / 100线圈统计，不能替代目标验收。

### 3. 最终架构

用户目标仍留在原 Feed Yarn 项目事实中。既有 solver 对当前 Machine Domain 产生的执行输入求解，并返回带单位的派生结果。simulate 在当前预览中重新判断收敛路径是否已用于最终 geometry，推导 PreviewValidity；runSimulation 将排针后结果和有效性发布到 GLOBAL_STATE。相关输入变更后立即清空旧结果，debounce 重算后发布新结论。

### 4. 修改文件

本次共 11 个文件，逐项修改见第 5 项。两个交叉文件是在用户现有修改上做增量，另外 15 个初始已有修改/未跟踪文件的 SHA256 完全保持一致。没有 reset、checkout、stash、删除、提交或切换分支。

### 5. 每个文件修改

| 文件 | 本次修改 |
|---|---|
| `src/simulation/yarnLengthSolver.js` | 增加 cm target/solved/error/tolerance，导出原容差常量，保留成熟状态并预留 NOT_SET/ERROR；不改求解算法。 |
| `src/simulation/previewValidity.js` | 新增纯推导函数，匹配当前 Feed × Yarn 目标、结果完整性、容差和路径应用情况。 |
| `src/simulation/yarnSimulation.js` | 关联当前参与的目标，保留 solver 错误结果，标记路径是否实际用于模拟，返回有效性；缓存命中也重新判断应用情况。 |
| `src/components/runSimulation.js` | 发布排针后结果，编辑时清除过期结论；缺机器配置为 DESIGN_PREVIEW，机器配置错误为 INVALID。 |
| `src/state.js` | 初始化两个派生运行时字段；不改 state 更新机制或项目模型。 |
| `scripts/validate-yarn-length-result-integration.mjs` | 新增真实链路集成验证及 PreviewValidity 契约验证。 |
| `scripts/validate.mjs` | 执行所有注册的 validate:* 脚本，任一失败即整体非零退出。 |
| `scripts/validate-yarn-length-solver.mjs` | 精确限定静态禁止模式，允许消费 SolverResults，继续禁止 renderer/runner 直接引入或调用 solver。 |
| `package.json` | 新增 validate 总入口和集成 validator；保留已有 multi-yarn validator。 |
| `src/codeGuide/generatedLines.json` | 由既有生成器同步 6 个因 import 新增而偏移的源码锚点；没有 UI 变更。 |
| `reports/p0-1-yarn-length-trust.md` | 保存工作区基线、调用链、计划、实际结果和最终报告。 |

### 6. SolverResult 实际结构

成功路径新增的可消费字段（Feed 1 / Yarn 1 实测）：

```js
{
  feedIndex: 0,
  yarnIndex: 0,
  targetLengthCmPer100Needles: 23,
  solvedLengthCmPer100Needles: 22.99985537891976,
  errorCmPer100Needles: 0.00014462108023835185,
  toleranceCmPer100Needles: 0.00079375,
  status: "CONVERGED",
  converged: true,
  appliedToSimulation: true
}
```

同一结果还保留 `targetModelLengthPer100Needles`、`solvedModelLengthPer100Needles`、`solvedLoopHeight`、`error`（model 单位）、`reachableRange`（包含 min/max loopHeight 和 min/max ModelLengthPer100Needles）、`solvedPathByLink`（Map）。关联仍为 feedIndex + yarnIndex。

状态复用 CONVERGED / UNREACHABLE_TARGET / MAX_ITERATIONS；新增 NOT_SET / ERROR。NOT_SET 为预留状态，旧 unset 流程仍返回空数组。现有 RangeError fallback 产生 ERROR 结果，solved/error 为 null、converged/applied 为 false，保留 errorMessage，不将错误伪装成求解成功。

### 7. PreviewValidity 推导规则

- DESIGN_PREVIEW：没有当前参与求解的正目标，或机器配置尚未齐备；参数变化后的重算间隔也撤销旧验证结论。
- VALIDATED：所有当前需要求解并参与最终模拟的目标均有匹配的 CONVERGED 结果，solved 和 error 在容差内，且收敛路径实际用于当前 geometry。
- PARTIAL：上述必要目标中仅一部分满足成功条件。
- INVALID：必要目标全部未成功，或 Machine Domain 配置校验失败。

缺结果、重复其他关联键、旧目标、不一致 solved 值、未应用路径均不能充当成功结果。未设置目标的旧流程不新增失败处理。状态完全派生，不持久化。

### 8. 23cm 实测结果

条件：G32、4×4 全 K Cam、排针 1234、4 路各 23 cm / 100针，预览输入 48×60（与既有用户审查标准复现一致）。

| 路数 | target | solved（cm / 100针） | error（cm / 100针） | status | applied |
|---|---:|---:|---:|---|---|
| 1 | 23 | 22.99985537891976 | 0.00014462108023835185 | CONVERGED | true |
| 2 | 23 | 22.999856051617197 | 0.00014394838280168187 | CONVERGED | true |
| 3 | 23 | 22.999856042155812 | 0.0001439578441862821 | CONVERGED | true |
| 4 | 23 | 22.99985636579647 | 0.00014363420352733413 | CONVERGED | true |

容差：原 solver 的 0.01 model 单位 / 100针，换算到 G32 为 0.00079375 cm / 100针。四路目标保持 23；PreviewValidity = VALIDATED。

### 9. 27cm 实测结果

其余条件相同，四路目标保持 27。

| 路数 | target | solved（cm / 100针） | error（cm / 100针） | status | applied |
|---|---:|---:|---:|---|---|
| 1 | 27 | 26.999994326440053 | 0.0000056735599464374785 | CONVERGED | true |
| 2 | 27 | 26.999992639583088 | 0.0000073604169134000584 | CONVERGED | true |
| 3 | 27 | 26.999993319385176 | 0.00000668061482610227 | CONVERGED | true |
| 4 | 27 | 26.99999467898935 | 0.000005321010651506696 | CONVERGED | true |

全部在同一容差内；PreviewValidity = VALIDATED。结果来自真实 runSimulation 链路，不采用旧的 cm / 100线圈读数。

### 10. 项目持久化格式

未修改 JSON / .knitscape 格式、导入器、导出器或 package schema。集成测试直接调用实际 getProjectData()，确认目标值保留且 SolverResults / PreviewValidity 不在项目数据中。

### 11. 旧项目兼容

0 / empty / unset 成功运行，结果数组为空且为 DESIGN_PREVIEW。旧 JSON 参数兼容和 .knitscape / PBR 往返 validators 通过。原无纱长 simulation、PBR、多纱 renderer validators 通过。Pattern pixels 未改变，Needle Arrangement 与 Pattern 保持独立。

### 12. 新增测试

`npm run validate:yarn-length-result-integration`：真实 actions、state、runner、Machine Domain、adapter、geometry、solver、renderer；仅浏览器 DOM / Path2D / timers 为测试替身。覆盖 23/27、实际 Canvas 路径、目标不被写回、派生结果不导出、参数变化立即撤销旧验证、Gauge 重算、Cam/排针变化、缺配置、机器配置错误、0/empty/unset 和有效性矩阵。

红绿证据：修改前失败于“runSimulation must publish the final Feed Yarn SolverResults into current result state”；修改后通过。既有 solver 的独立高精度 reference validator 继续通过。

独立只读复核：通过，未发现范围内阻塞或重要问题。复核独立运行本集成 validator 并确认目标、结果、路径应用和有效性链。浏览器 GPU/PBR 像素画质不属于本新增 validator 的验收内容；既有 PBR/多纱回归脚本由完整 validate 执行并通过。

### 13. npm run validate

最终 exit 0，32/32 validators passed。包括全部原有 31 项和新增 1 项。开发模式 Lit 提示为已有日志。

首次完整运行的两项失败由本次源码变化触发：生成源码行号过期、旧正则将 SolverResults 字段误判为直接调用 solver。已分别通过既有生成器和更精确的边界检查修复，未删除测试或关闭断言。

### 14. npm run build

最终 exit 0，Vite 4.4.7 生产构建通过，739 modules transformed。

### 15. git diff --check

exit 0，无 whitespace error；另对 4 个新增未跟踪文件检查，也没有 whitespace error。Git 提示 LF 将来可能按已有配置转换为 CRLF，不是检查失败。

### 16. git diff --stat

当前工作区（包含用户初始修改；不包含未跟踪文件）：

```text
 package.json                                       |  3 +
 scripts/validate-feed-yarn-pbr-renderer.mjs        | 26 +++---
 scripts/validate-yarn-length-solver.mjs            |  3 +-
 .../validate-yarn-simulation-characterization.mjs  |  8 +-
 src/codeGuide/generatedLines.json                  | 12 +--
 src/components/runSimulation.js                    | 10 +++
 src/i18n/translations.js                           |  8 +-
 src/simulation/drawYarnSimulation.js               | 72 +++++++++++-----
 src/simulation/yarnLengthSolver.js                 | 16 +++-
 src/simulation/yarnPathUvStrip.js                  | 11 ++-
 src/simulation/yarnSimulation.js                   | 96 +++++++++++++++-------
 src/simulation/yarnTextureBrush.js                 | 20 +++--
 src/state.js                                       |  4 +
 13 files changed, 196 insertions(+), 93 deletions(-)
```

本次两个交叉文件相对于初始快照的增量：yarnSimulation +29/-7，package +2/-0。其他未修改的初始文件 SHA256 一致。新增未跟踪文件为 previewValidity、integration validator、validate 总入口和本报告；未进行 git add。

### 17. 尚未解决的问题

旧左侧 cm / 100线圈统计口径保留。100cm UNREACHABLE 的完整用户处理、非法 -1 输入、批量纱长、Undo、Yarn Library 和 UI 留待下一任务。当前仅完成成功链和承载后续失败结果所需的最小结构。

### 18. 非本任务内容确认

没有 UI 视觉重构、GLOBAL_STATE 重做、Command Bus、Event Sourcing、Yarn Library 大迁移、Legacy 第一根/第二根纱逻辑删除、GSM、幅宽、耗纱或 PBR 新功能。没有复制机器执行算法，没有改 Pattern，没有硬编码 23，没有持久化派生结果。现有用户 PBR/多纱修改保留。本任务完成后停下。
