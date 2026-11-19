# KnitScape P0 FINAL AUDIT

审计日期：2026-10-07。项目：`C:\Users\liuchen\Desktop\knitscape`。

## 1. 最终结论

**CONDITIONAL PASS。允许由用户后续明确指示建立 trusted yarn length baseline。**

没有发现可复现的 P0 用户正确性阻塞：未发生错误 Assignment 写入、非法输入清除合法目标、批量部分提交、不可达目标冒充已应用，或当前用户界面把旧结果配新参数标成成功。存在下文明确列出的非阻塞技术债和审计限制。

本轮没有修改任何业务源码、现有测试或配置；只新增本轮审计报告、探针、夹具和截图。开始时的 483 个已有 dirty/untracked 文件，结束时逐个 SHA256 核对，**0 个变化**。仍在 `main`，HEAD 仍为 `29b7e4bcfaee6c9b7f3df070b24c200b7aa56103`。没有 commit、tag、baseline、reset、checkout、stash、clean，也没有开始下一阶段。

## 2. 架构边界

| 边界 | 当前权威内容 | 持久化 |
|---|---|---|
| Project facts | Pattern/repeats、Cam、Arrangement、Gauge、Library/PBR、Feed Yarn assignment、target | 是 |
| Derived | SolverResult、PreviewValidity、Simulation 路径与运行结果 | 否 |
| UI/runtime | batch selection、captured revision、feedYarnStructureRevision、面板和反馈 | 否 |

运行时字段和项目事实仍共用 GLOBAL_STATE 容器，但项目出口是 `getProjectData()` 的字段白名单；这不等于把整个容器持久化。Selection 和 captured revision 保存在 editor 模块局部变量。Machine Domain、adapter 与 Simulation 边界保持独立，Pattern 没有被 Cam/Arrangement/纱长写回。

实际生产浏览器下载包已解包检查，manifest 仅包含 11 个事实字段及既有 `format/version`。没有 SolverResult、PreviewValidity、Batch Selection、feedYarnStructureRevision、selectedStructureRevision 或临时反馈。

## 3. Revision 语义

唯一递增权威是 `src/state.js -> prepareAction()`，与结构 mutation 在同一次 dispatch 中更新，并丢弃调用方输入的 revision。

| 必须递增 | 不递增 |
|---|---|
| add/delete assignment、replace yarnId、Feed 数量/槽位身份变化、完整 Feed assignments replacement、reorder/move replacement、完整含 Cam 项目 load/import | yarn length/Clear/batch length、tension、placement、PBR、color、metadata、SolverResult、PreviewValidity、Gauge、Cam 动作、Arrangement |

相同 ID 的完整替换仍通过 replacement intent 强制递增，不依赖 ID 序列比较来识别 ABA。当前 slot 再选相同 asset 是 no-op。全局 revision 采取保守失效，另一 Feed 结构变化也使旧批次无效。

旧 Pattern-only JSON 没有替换 Machine/Library，因此沿用已有兼容语义：保留当前 assignments，不制造一次身份替换。真正的完整 Cam 项目 load/import 即使 locator 完全相同也重建 generation。Revision 未进入导出包。

## 4. 用户完整流程和真实应用链

`Feed.yarns[].yarnLengthCmPer100Needles` → 输入校验/原子 action → Project facts → Machine Domain/adapter → `runSimulation` → 每个 Yarn strand 的 Solver → 该 strand 的模型和显示路径 → `appliedToSimulation` → SolverResult → 单一 PreviewValidity 聚合 → 用户反馈。

Batch 先校验 captured generation，再校验每个 locator/yarnId/editability，最后校验新值；全部成功才一次性构造 feeds 并 dispatch。拒绝路径不提交事实、不清合法 Derived Result。

成功必须同时满足 target 匹配、CONVERGED、有限 solved/error、现有 tolerance、实际路径已应用。失败会回退基础路径，candidate solved 不冒充当前已应用纱长。同 Feed 每个 Yarn 独立关联结果和路径；相同 yarnId 不共享可变结果。

## 5. 21 项真实用户流程结果与验收矩阵

本轮重新通过可见 UI 操作，未用浏览器隐藏状态注入来代替用户操作。标准项目为 G32、4×4 全 K、1234、4 Feed，并有一个 Feed 包含第二根 Yarn 18。身份破坏测试按步骤改变/恢复结构；后半程双 Yarn 所在 Feed 为 Feed 2。表中 Feed 为用户可见的一基编号。

| 用户操作 | Project State | SolverResult | PreviewValidity | Batch/Revision状态 | 用户看到什么 | PASS/FAIL |
|---|---|---|---|---|---|---|
| 1. 四路 23，第二根 18 | 23 保持，兄弟 18 | CONVERGED，solved≈23，applied=true | VALIDATED | 参数修改不递增 | 目标、求解值、已应用、模型限定 | PASS |
| 2. 23→27 | 四根主 Yarn 27，兄弟 18 | 旧结果失效，新 solved≈27 | VALIDATED（重算后） | revision 不变 | 27.0000 / 27.0000 / 已应用 | PASS |
| 3. 27→100 | 四根主 Yarn 保留 100 | 主 Yarn UNREACHABLE_TARGET，applied=false | PARTIAL（第二根 18 成功）；四路全失败集成为 INVALID | 输入有效，不伪造求解成功 | 未应用、失败原因、模型范围 | PASS |
| 4. 100→23 | 恢复 23 | CONVERGED / applied=true | VALIDATED | revision 不变 | 状态恢复 | PASS |
| 5. 23→-1 | 仍 23 | 旧合法结果完全保持 | VALIDATED | Reject / 不提交 | 有限正数错误 | PASS |
| 6. 普通输入 0 | 仍 23 | 完全保持 | VALIDATED | Reject / 不提交 | 错误且恢复 23 | PASS |
| 7. 删除为空 | 仍 23 | 完全保持 | VALIDATED | Reject / 不提交 | 错误且恢复 23 | PASS |
| 8. abc / NaN / Infinity | 三次均仍 23 | 三次均保持 | VALIDATED | Reject / 不提交 | 明确拒绝，无静默清除 | PASS |
| 9. Explicit Clear | 仅对应 target=legacy 0 | 旧成功清理；对应 NOT_SET / 未应用 | 其他参与目标成功则 VALIDATED；全无目标为 DESIGN_PREVIEW | 明确动作才允许 unset | 输入空白、NOT_SET | PASS |
| 10. 同 Feed A23/B18，A→25 | A25 / B18 | A≈25、B≈18，各自应用 | VALIDATED | 参数修改不改结构 | 兄弟目标和结果未变 | PASS |
| 11. batch Feed1-A / Feed3-C→27 | 只两根变为 27 | 对应两根重算，其他不改目标 | VALIDATED | 成功计数 2、清选择、不递增 | 已更新 2 根纱线 | PASS |
| 12. batch -1 | 整批不变 | 所有旧结果不变 | VALIDATED | 整批 Reject、保留选择 | 有限正数错误 | PASS |
| 13. batch 全部五根 100 | 全部保留 100 | 全部 UNREACHABLE_TARGET / 未应用 | INVALID | 输入通过，交给 Solver | 全部未应用，基础预览仍可见 | PASS |
| 14. 0 targets | 不变 | 不变 | INVALID（沿用上例） | 不提交、按钮禁用 | 请选择需要修改的纱线 | PASS |
| 15. stale yarnId | 替换后的合法配置保留 | 新合法结果保持 | VALIDATED | 结构 +1，旧批次整批拒绝 | 配置已变化，请重选；未修改任何纱线 | PASS |
| 16. 删除后同 slot / 同 ID 重建 | 新对象仍 23 | 新结果保持 | VALIDATED | generation 改变，旧 selection 无效 | 没有自动映射到新对象 | PASS |
| 17. 同 Feed 相同 ID，删第一根使第二根左移 | 左移对象仍 18 | 对应 18 的结果保持 | VALIDATED | generation 改变，旧批次 Reject | 未误改左移 Yarn | PASS |
| 18. 跨 Feed 选择，修改另一 Feed 结构 | 选中两根仍 23 | 当前合法结果保持 | VALIDATED | 全局保守失效、整批 Reject | 要求重选 | PASS |
| 19. 选择后仅 23→24，再 batch27 | 合法变 24 再 27 | 正确重算 | VALIDATED | generation 不变，选择仍合法 | 已更新 1 根纱线 | PASS |
| 20a. 选择后修改 metadata | 纱长不变；元数据按操作更新 | 当前结果可信 | VALIDATED | generation 不变，后续 batch 成功 | 选择保留 | PASS |
| 20b. 选择后实际导入 PBR、设置重复长度 | 目标不被 PBR 操作改变 | 当前结果可信 | VALIDATED | generation 不变，后续 batch 成功 | 选择保留，PBR 已设置 | PASS |
| 21. 完整项目重载，locator 完全相同 | 重载后的 23/18 不被旧 batch27 修改 | 重新求解并保持 | VALIDATED | generation 重建，旧批次整批拒绝 | 配置已变化，未修改任何纱线 | PASS |
| Gauge 32→31 | 新 Gauge 31，target 不变 | 立即清旧结果，范围变 14.4863–48.2809，重算成功 | DESIGN_PREVIEW→VALIDATED | generation 不变 | 新范围、求解值 | PASS |
| Cam K→T | 新 Cam，Pattern 不变 | 清旧结果；Feed1 范围变 13.2536–45.6991 | DESIGN_PREVIEW→VALIDATED | 非身份参数，不递增 | 当前动作及新模型范围 | PASS |
| Arrangement 1234→4321 | 新排针，Pattern 不变 | 清旧结果、重新调用 Solver | DESIGN_PREVIEW→VALIDATED | 不递增 | 新排针，当前结果收敛 | PASS |
| 影响求解的 Yarn diameter 0.24→0.25 | 新直径，target 保持 | 清旧结果、重新求解 | DESIGN_PREVIEW→VALIDATED | 不递增 | 新求解结果 | PASS |
| Feed target 23→24 | 仅对应目标 24 | 清旧结果、solved≈24 | DESIGN_PREVIEW→VALIDATED | 不递增 | 24 与已应用 | PASS |
| 无 target / legacy 0 | 所有目标 unset | NOT_SET / 未应用 | DESIGN_PREVIEW | 完整导入重建 generation | 基础设计预览 | PASS |

21 的第二次复核使用**生产浏览器真实下载的包**，而不是手工编写项目：locator 一致、旧 selection 被拒绝、所有 23/18 保持。截图和结构化结果共 **37 个本轮检查点**。

23 的集成实测：Feed1 solved=`22.99985537891976`，error=`0.00014462108023835185` cm/100针，tolerance=`0.00079375`。27 的集成实测：Feed1 solved=`26.999994326440053`，error=`0.0000056735599464374785`，同一 tolerance。四路分别 CONVERGED 且 applied=true。真实 UI 分别显示 22.9999 与 27.0000；它们不使用旧 24.87 指标验收。

## 6. 参数失效结果

浏览器确认 Gauge/Cam/Arrangement/target/diameter 改变后正确重算。另一个运行时探针执行真实 renderer 注册顺序、state、actions、runner 和 Solver，只有 Canvas/定时器/记录画面是夹具。

该探针证明：single 23→27、Gauge、Cam、Arrangement、Feed Yarn identity、batch mutation 在 **dispatch 返回与下一帧渲染读取时**，当前 GLOBAL_STATE 已是 `DESIGN_PREVIEW + results=[]`，再于 debounce 后成为与新配置匹配的 VALIDATED。没有以浏览器自动化中跨过 150ms 的快照冒充立即失效证据。

有一个确实存在的限制：排在 runner 前的同步 observer 可看到最初 action 的旧 Derived snapshot；当前 UI renderer 只安排 RAF，并在 RAF 读取最新 GLOBAL_STATE，其余当前同步组件不消费 SolverResult/PreviewValidity。因此不构成当前用户 False Success，但属于 MEDIUM 技术债。

## 7. 保存 / 加载边界

生产构建真实下载三次 `.knitscape`，复制到本轮报告目录后检查 ZIP：已有 format=`knitscape`、version=`2`，Gauge32、全 K、1234、targets `[[23],[23,18],[23],[23]]`、Library 和 PBR 二进制均正确。只包含 `project.json` 与 `assets/yarn/0/baseColor`；没有运行时字段。

实际重载恢复项目事实，并重新求解。Full load 不采纳输入中的 runtime generation；旧 selection 不能恢复。没有修改 Schema 或项目持久化格式。

## 8. 旧项目兼容

- 生产构建实际导入无 Yarn Length 的 Pattern-only JSON：正常打开、DESIGN_PREVIEW，无浏览器错误。
- 实际导入 legacy target=0 的 JSON，带 Yarn Library、嵌入 PBR JPEG、同 Feed 多 Yarn：正常迁移、五个目标显示空白、NOT_SET/未应用、DESIGN_PREVIEW。
- 实际加载已有二进制 PBR、多 Yarn 包：23/18 全部求解应用；PBR 已设置，Library 名称/分类正确。
- 真实下载包回读比对 PBR 原始 61694 字节完全相同；已有 10mm 参数保存/加载正确。
- 不带纱长、Legacy 第一/第二支纱线、PBR renderer/Canvas fallback、共享/替换资源的现有 validators 通过。

更换整组 PBR 会开始一组新的 PBR metadata，包括重复长度 unset，这是 HEAD 已有行为，不是本轮变更。审计首次错误要求“新 PBR 自动继承 10mm”的断言失败，原失败日志已保留；读取真实空白控件并核对 HEAD 后纠正夹具预期。**随后真实明确输入 10mm，再下载和解包，确认保存为 10mm**。没有改写 PBR 行为。

## 9. PreviewValidity 语义

唯一结果聚合权威为 `src/simulation/previewValidity.js -> derivePreviewValidity()`：无当前必要目标为 DESIGN_PREVIEW；全部必要目标匹配 target/slot、CONVERGED、converged=true、applied=true、有限 solved/error 且误差在 tolerance 内为 VALIDATED；一部分成功为 PARTIAL；有目标但零成功为 INVALID。机器配置错误在生命周期入口使用 INVALID；初始化/失效使用 DESIGN_PREVIEW，不另建聚合算法。

**VALIDATED 仅表示当前软件模型几何求解成功并应用。不是实机验证、生产工艺验证、品质确认或真实送纱精度保证。** UI 明确写出“仅模型几何求解，未经实机验证。未应用的求解值为候选值，不是当前模拟纱长。”

## 10. 旧统计状态

旧左侧“当前纱长 24.87 cm / 100线圈”仍是基础预览统计，已明确附注“基础预览统计，非目标求解值”。目标反馈独立标明 cm/100针、目标、模型求解值、状态、是否应用、原因/模型范围。不可达时明确未应用，范围明确“非实际工艺范围”。本轮未改旧统计算法，旧标题口径仍列为技术债。

## 11. 重复规则 / 消费者审查

未发现第二套可提交输入 validator、unset 规则、PreviewValidity 聚合、CONVERGED/UNREACHABLE_TARGET 转换或 batch stale 提交判断。输入校验统一使用 yarnLengthInput；允许 legacy unset 通过显式 allowUnset；普通编辑拒绝 0/empty。UI 对 generation 的比较只是选择展示，真实提交仍走 domain preflight。revision 只有 state 的单一写入入口。

新 domain/validity/feedback 均有真实运行消费者。逐 strand 应用状态和 fallback 没有用同 Feed 兄弟结果替代失败。queueSim 无读取、旧诊断仅 validator 消费均在 HEAD 已存在，并非新增未被消费的业务临时逻辑。未为审计重构。

## 12. Technical debt 评级

| 项 | 评级 | 当前影响 | 阻塞 baseline |
|---|---|---|---|
| A 全局保守 revision | LOW | 无关 Feed 结构变化也要求重选，避免部分提交 | 否 |
| B 同步 observer 旧 Derived snapshot | MEDIUM | 当前用户 renderer 不消费旧快照；未来同步结果消费者必须先统一失效边界 | 否 |
| C debug 快捷键 d | LOW | 输入 d 可切 debug UI；不改 Project target/assignment/结果 | 否 |
| D queueSim 无读取 | LOW | 历史遗留变量；实际 debounce 正常 | 否 |
| E 旧诊断仅 validator | LOW | 旧 lengthRatio 不参与真实求解、应用或反馈 | 否 |
| F 旧基础统计口径 | MEDIUM | 仍为 cm/100线圈；有明确附注，不能据此验收 target | 否 |

## 13. npm run validate

**PASS，exit 0，36/36 validators passed。** 包括 P0-1 result integration、P0-2 failure integration、P0-3 input integration、P0-4 batch integration、P0-4B structure blocker integration；同时涵盖 Machine、Arrangement、无纱长、Library、PBR persistence/renderer、多 Yarn renderer、UV、资源生命周期和旧特性回归。没有项目已有环境问题导致完整 validate 失败。

## 14. npm run build

**PASS，exit 0，746 modules，2.19s。** 后续生产浏览器验收使用这次 dist，而非只测试 dev 源码。

## 15. git diff --check

**PASS，exit 0。** Git 输出 LF→CRLF 预告，不是 whitespace error。开始与结束 tracked diff 相同；已有 483 文件 hash 相同，HEAD/main 不变。

## 16. Browser E2E 与证据限制

21 主流程重新通过，37 记录/截图检查点，含 abc/NaN/Infinity 分开拒绝、metadata/PBR 分开检查、真实下载包再重载、机器参数和生产旧项目兼容。实际使用原始用户控件、文件上传、导出下载；没有浏览器隐藏 GLOBAL_STATE 注入。运行时/包边界探针另列，不冒充真实浏览器。

开发页面首次导出曾等待下载超时并遇到 alert；当时未保留错误文本，**原因未确定，不能宣称已修复或断言就是 Vite 问题**。随后临时服务器只在内存添加日志，观察到含 PBR 的 Blob 成功生成、触发下载。生产构建实际下载三个文件（63845 字节的首次含 PBR 包及直接上传 PBR/明确重复长度的包），无 alert/error，真实解包/再导入通过。因此该首次异常未复现为当前生产 P0 blocker，作为明确审计限制保留。

浏览器自动化中另外出现两个错误选择器和一次 3s CDP 调用超时；根据当前 DOM 修正/重试后通过。PBR metadata 检查的错误预期见第 8 项。上述调查没有导致业务补丁；npm validate/build 的成功结果没有隐藏失败。最终业务验收矩阵全部 PASS。

主要证据（绝对路径）：

- [37 个浏览器记录](C:/Users/liuchen/Desktop/knitscape/reports/p0-final-audit/browser/results.json)
- [真实下载包字段和字节检查](C:/Users/liuchen/Desktop/knitscape/reports/p0-final-audit/actual-browser-export-check.json)
- [直接 PBR 上传并明确 10mm 后的包检查](C:/Users/liuchen/Desktop/knitscape/reports/p0-final-audit/direct-PBR-with-repeat-browser-export-check.json)
- [立即失效与下一帧消费者探针](C:/Users/liuchen/Desktop/knitscape/reports/p0-final-audit/renderer-probe.json)
- [独立只读代码审查](C:/Users/liuchen/Desktop/knitscape/reports/p0-final-audit/code-review.md)
- [validate 日志](C:/Users/liuchen/Desktop/knitscape/reports/p0-final-audit/validate.log)
- [build 日志](C:/Users/liuchen/Desktop/knitscape/reports/p0-final-audit/build.log)
- [保护文件 hash 对比](C:/Users/liuchen/Desktop/knitscape/reports/p0-final-audit/protected-files-check.json)

## 17. 当前总 diff stat

`git diff --stat`：**23 tracked files，641 insertions(+)，170 deletions(-)**。该命令不统计 untracked，不能将它误称为全部 P0 代码数量。

另有 **16 个 untracked P0 源码/测试文件，共 1856 行**。正式功能代码/测试/config 累计合计为 **39 个文件、2497 新增行、170 删除行**（新文件全部视为新增），不含 docs、历史 reports、本轮 audit、截图/夹具。另有一个既有 untracked P0-4B 计划文档。

本轮业务 source/config/test 增量为 **0**；本轮新增内容只在 `reports/p0-final-audit/`。

[tracked 完整统计](C:/Users/liuchen/Desktop/knitscape/reports/p0-final-audit/git-diff-stat-after.txt)；[untracked 逐文件行数](C:/Users/liuchen/Desktop/knitscape/reports/p0-final-audit/new-source-stat.json)；[完整当前 status](C:/Users/liuchen/Desktop/knitscape/reports/p0-final-audit/git-status-after.txt)。

## 18. 阻塞问题

**无当前可复现的 P0 用户正确性阻塞。** 没有实施最小业务修复，因为没有达到用户规定的“新的、可复现的 P0 阻塞缺陷”门槛。

## 19. 非阻塞问题

第 12 项 A–F；第 16 项首次 dev 导出异常原因未确定；第 8 项 HEAD 已有更换 PBR 时新组 metadata unset 行为，明确提交新参数后可正确保存。均未造成 P0 流程的 target/assignment 误写、False Success 或当前可信结果误导。本轮不扩大范围处理。

## 20. 是否允许 baseline

**允许。唯一结论仍为 CONDITIONAL PASS。** 只给建议，不执行。Baseline 应表述为软件模型内可信 Feed Yarn target→Solver→应用工作流，不应承诺实机生产验证。B/F 债务和审计限制应保留在验收记录中。

## 21. 建议 commit message

`feat: establish trusted feed yarn length workflow`

## 22. 建议 tag

`baseline-trusted-yarn-length`

## 23. 建议纳入 commit 的文件

以下均为已有累计 P0 source/test/config，**本轮没有修改它们**。不应只提交 tracked 部分而遗漏新 domain/validity/feedback/validators。渲染相关文件负责实际多 Yarn 路径/材质隔离，属于可信应用链；generatedLines 与对应 source 一起提交。

Tracked（23）：

```text
package.json
scripts/validate-feed-yarn-pbr-renderer.mjs
scripts/validate-single-jersey-cam-editor.mjs
scripts/validate-single-jersey-execution-integration.mjs
scripts/validate-workspace-mode.mjs
scripts/validate-yarn-length-solver.mjs
scripts/validate-yarn-simulation-characterization.mjs
src/actions/importers.js
src/actions/singleJerseyCamProgram.js
src/actions/yarnLibrary.js
src/codeGuide/generatedLines.json
src/components/runSimulation.js
src/events/simulationPointerInteraction.js
src/i18n/translations.js
src/simulation/drawYarnSimulation.js
src/simulation/yarnLengthSolver.js
src/simulation/yarnPathUvStrip.js
src/simulation/yarnSimulation.js
src/simulation/yarnTextureBrush.js
src/state.js
src/views/singleJerseyCamProgramEditor.js
src/views/yarnLengthReadout.js
styles.css
```

Untracked 必须纳入的 P0 source/test（16）：

```text
scripts/browser-yarn-length-batch.mjs
scripts/browser-yarn-length-feedback.mjs
scripts/browser-yarn-length-input.mjs
scripts/browser-yarn-length-structure.mjs
scripts/validate-multi-yarn-renderer.mjs
scripts/validate-yarn-length-batch-integration.mjs
scripts/validate-yarn-length-failure-integration.mjs
scripts/validate-yarn-length-input-integration.mjs
scripts/validate-yarn-length-result-integration.mjs
scripts/validate-yarn-length-structure-integration.mjs
scripts/validate.mjs
src/domain/feedYarnStructure.js
src/domain/yarnLengthBatch.js
src/domain/yarnLengthInput.js
src/simulation/previewValidity.js
src/views/yarnLengthSolverFeedback.js
```

以上代码块路径均相对本报告开头的项目绝对路径。精确可机读文件清单见第 17 项 status/逐文件统计。

文档建议：保留 [P0-4B 计划](C:/Users/liuchen/Desktop/knitscape/docs/superpowers/plans/2026-10-07-feed-yarn-structure-revision.md)。正式 baseline 的审计文档可只纳入本 FINAL_REPORT.md 和 code-review.md；报告中的大型外部证据保存在本地审计目录，不要求与功能代码同一 commit。历史阶段报告可另行作为审计档案提交，**不必为了功能运行全部纳入**。

## 24. 建议不纳入正式代码 commit 的报告 / 截图

不要执行 `git add reports/`。不默认纳入：历史 `reports/` 下整套 PNG/JPG、录屏、bulk JSON/log、测试 `.knitscape`/旧项目夹具、复制的 PBR 图片；本轮 browser/ 的 37 张截图及原始 results；下载包及解包 manifest；hash/status/diff 原始输出；audit 临时 diagnostic/preview server 和一次性 probe 脚本。它们全部保留在工作区，可作为独立验收附件，不删除。

历史 FAIL/阶段报告也保留，不能回滚或覆盖；本 FINAL_REPORT 明确是修复组合后的新验收结果，不把历史失败冒充当前结论。只需将必要简明报告作为文档选择性纳入，不把证据二进制默认提交。

停止状态：本轮验收完成。未继续处理 Undo、Yarn Library 改造、UI 重构、GSM/幅宽/耗纱、Command Bus、Event Sourcing、额外生产计算、Legacy 删除、旧统计算法或其他非任务设计。
