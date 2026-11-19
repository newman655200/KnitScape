# KnitScape P0-4B 完成报告

结论：**FIXED**。本次修复的两项 Assignment 身份阻塞问题均已通过真实浏览器与集成测试。未建立 baseline，未 commit，未 tag，未开始下一阶段。原总体审计 FAIL 报告保留为历史证据。

实际工作分支：`main`；开始及结束 HEAD：`29b7e4bcfaee6c9b7f3df070b24c200b7aa56103`。开始记录了 git status、HEAD 和分支，并保护原有 433 个 dirty/untracked 文件；另在修改前保护 workspace validator。434 个保护文件中，423 个逐字节不变，11 个仅在本任务范围内增量修改，无意外修改。

1. **原 locator 根因**：`{feedIndex,yarnIndex,yarnId}` 只证明当前位置资产 ID 相同。删除后重建同 ID（ABA）、同 ID 的另一个 Assignment 移入原位置，都能通过旧检查；后续 solver 正常收敛无法证明修改的是原选择对象。
2. **revision 名称**：唯一权威概念为 `feedYarnStructureRevision`。选择快照字段为 `structureRevision`，UI 局部变量为 `selectedStructureRevision`，它们是同一世代的捕获值。
3. **存放位置**：`src/state.js` 的运行时 GLOBAL_STATE 初始为 0；只由 `prepareAction()` 维护递增。UI 选择快照仅在 editor 模块局部 Map/变量中。
4. **持久化**：不持久化。实际 `getProjectData()` JSON 和生成的 `.knitscape` ZIP 内 `project.json` manifest 均已检查无 revision/selection revision。运行时容器中的字段不构成用户项目事实；导入字段不能覆盖当前 revision。
5. **递增 mutation**：添加/删除 Assignment、slot yarnId 变化、Feed 数量/槽位结构变化、Cam 删除；创建/重新创建 Cam、完整 Feed Yarn 替换（包括相同 ID 重排/整体替换）、完整项目 JSON/package 导入、`loadWorkspace` 替换 Cam 都明确递增。同一提交同时具有结构差异和替换标志时只递增一次。失败校验无递增。
6. **不递增 mutation**：普通单根/批量目标纱长提交、Explicit Clear 目标、保持槽位与 ID 的张力/placement 参数修改、Asset 名称/类别/PBR/颜色、Gauge/排针、Cam K/T/M、仅 Track 数量变化、SolverResult/PreviewValidity/UI 字段。给已使用同一个资产的现有槽位再次分配该资产是 no-op。
7. **选择捕获**：首次明确勾选 Assignment 时捕获当前 revision；后续普通参数修改保留捕获值。清空/成功提交/拒绝 stale 提交后清除快照。结构已失效时再次明确勾选，先清旧选择，再建立当前世代的新选择。
8. **Preflight**：action 必须传 `{structureRevision,targets}`。首先检查安全整数 revision 与当前值一致；不一致/缺失立即返回 `{ok:false,reason:'STALE_ASSIGNMENT_STRUCTURE',updatedCount:0}`。随后保留原 locator、yarnId、重复目标、目标可编辑性和值校验。旧裸数组不会在提交时隐式补 revision。
9. **UI 主动失效**：下一次正常 state render 即显示“纱线配置已变化，请重新选择。未修改任何纱线。”，全部旧 Assignment 勾选取消，禁止自动勾选新对象；保留 stale 快照让点击应用受到 Domain 防线明确拒绝。拒绝后计数为 0、应用按钮禁用。没有新增布局或 CSS。
10. **load/import**：在全部项目/资产校验通过后，导入 dispatch 明确声明完整结构替换，即使所有 ID/slot 都相同也递增；实际 JSON 导入、ZIP package 导入和旧 `loadWorkspace` 路径均通过。旧式仅 Pattern 导入保留现有机器结构和 revision。
11. **BLOCKER A**：PASS。原 A23/B18，选择 A，删除 A，再重建同 slot/同 ID 的 A23；旧 batch27 返回 STALE_ASSIGNMENT_STRUCTURE，新 A 保持 23。浏览器同样 PASS，并额外选择另一 Feed 证明整批未部分提交。
12. **BLOCKER B**：PASS。同 Feed A23/A18，选择原 slot1，删除 slot0，左移后 A 保持 18，旧 batch 拒绝。另覆盖原审计更强场景：选择 slot0 后删除它，未选择的同 ID 兄弟占据旧位置；仍拒绝，兄弟保持 18。
13. **BLOCKER C**：PASS。选择 Feed1/Feed3 后仅增加 Feed2 Assignment，整批拒绝；两个原选中目标均保持 23。这是有意采用的全局保守失效规则。
14. **BLOCKER D**：PASS。选择 A23，单根改为24，revision 不变；旧选择批量27成功。集成与真实浏览器均证明参数修改不无意义地失效选择。
15. **BLOCKER E**：PASS。Asset 名称/类别、PBR Clear、张力和 placement 改动保持 revision；旧选择 batch27成功。已有 PBR 渲染与持久化 validators 继续 PASS。
16. **BLOCKER F**：PASS。替换 slot yarnId 递增，旧批量整批拒绝；浏览器原 P0-4 D 再次通过。当前 revision 下伪造旧 yarnId 仍由 Layer 2 返回 STALE_TARGET，未删除旧防线。
17. **BLOCKER G**：PASS。同 locator/ID 的 JSON 项目与 `.knitscape` 项目重新加载后，旧选择均拒绝；输入项目中的旧 revision 无法恢复已失效选择。
18. **原 P0-4 A–H**：集成及浏览器 PASS。精确跨 Feed、多 Yarn 隔离、0 targets、ID stale、非法整批拒绝、四路27、100不可达、混合选择全部保留。既有测试只适配必需的选择契约/失效原因，并保留 Layer 2 与状态/路径不变断言。
19. **P0-1**：PASS。G32、4×4 全 K、1234，四路23求解 `[22.99985537891976,22.999856051617197,22.999856042155812,22.99985636579647]`，最大误差 `0.00014462108023835185`；四路27求解 `[26.999994326440053,26.999992639583088,26.999993319385176,26.99999467898935]`，最大误差 `0.0000073604169134000584`。均 CONVERGED/已应用/VALIDATED，容差 `0.00079375 cm/100针`。未以左侧24.87统计验收。
20. **P0-2**：PASS。100保留，UNREACHABLE_TARGET/未应用；全失败 INVALID、部分成功 PARTIAL、无目标 DESIGN_PREVIEW、成功 VALIDATED；100回23恢复，机器参数修改旧结果失效。VALIDATED 只代表模型几何求解成功，不代表实机验证。
21. **P0-3**：PASS。-1、0、empty、NaN、Infinity、非法字符串拒绝且不破坏合法结果；Explicit Clear 才提交 legacy unset0。浏览器键入0及用 Backspace 删除23为空后，目标和结果仍保持23；明确 Clear 所有目标后 DESIGN_PREVIEW，再输入23恢复。
22. **Browser E2E**：使用真实 CUA 浏览器、真实控件输入/点击/键盘激活；没有向页面注入业务状态。主验收24个 DOM/截图检查点，新增可复用 blocker 浏览器流程6个检查点，共30个，console error 为0。新增脚本首次立即读取删除后的 DOM 遇到 RAF 渲染时序，补了可见 stale 文案等待后重跑三条 blocker 流程 PASS。证据见 `reports/p0-4b-browser/results.json`、`helper-results.json` 及同目录截图。
23. **npm run validate**：最终 exit0，**36/36 PASS**。首轮35/36，失败为 workspace validator 静态正则把新导入存在性判断误认成 Machine 数据写入；已有实际状态保持断言通过。已补 legacy load revision 不变断言、将正则限定为字段写入形式并重跑全部通过。最终日志 `reports/p0-4b-validate.log`。
24. **npm run build**：exit0，PASS，746 modules transformed；日志 `reports/p0-4b-build.log`。实际耗时约1.99s，无构建错误。
25. **git diff --check**：exit0，PASS。只出现仓库原有 LF/CRLF 提示，无 whitespace error；记录 `reports/p0-4b-diff-check.log`。
26. **本次增量 diff stat**：源码/配置/测试共 **16 files，+341 / -44**；源码8 files +82/-24，package配置 +1，测试/浏览器7 files +258/-20。统计比较本任务开始时真实脏文件快照，而非把 P0-1～4 原有工作误算为此次改动；文档/报告/截图另列。机器可读统计 `reports/p0-4b-incremental-diff.json`。
27. **修改文件及职责**：详见下表。修改前全部已有报告、渲染、Simulation、Machine Domain、Pattern 等不相关改动保留。只读独立审查未发现阻塞问题。
28. **项目 Schema**：没有改变；不修改历史项目数据格式；未新增持久化字段。
29. **assignmentId**：没有引入持久化 assignmentId；locator 保留，接口未来可以增补稳定 Assignment ID。
30. **遗留风险/边界**：全局 revision 有意让任一 Feed 的结构变化失效全部旧批量选择；未来同 ID 重排/整体替换入口必须声明 `replaceFeedYarnStructure`，不能使用参数更新语义绕过身份边界。不存在当前仍可复现的 ABA/槽位左移误修改。queueSim、debug d、observer旧快照、文档过时等债务未处理；UI视觉、Undo、Yarn Library大改、Legacy双纱、Save/New增强、GSM/幅宽/耗纱/PBR新功能均未做。

| 文件 | 本次增量修改 |
|---|---|
| src/state.js | 单一运行期 revision，dispatch/loadWorkspace 原子维护，禁止外部覆盖 |
| src/domain/feedYarnStructure.js | 新增纯结构比较，忽略参数 |
| src/domain/yarnLengthBatch.js | revision 第一防线，保留 locator 第二防线 |
| src/actions/singleJerseyCamProgram.js | create/完整替换意图；batch要求选择快照 |
| src/actions/importers.js | 校验成功的完整结构导入失效旧选择 |
| src/actions/yarnLibrary.js | 同资产分配 no-op，避免无意义身份替换 |
| src/views/singleJerseyCamProgramEditor.js | 捕获 revision、立即 stale 提示、拒绝后清除、不自动重映射 |
| src/i18n/translations.js | 四语言结构变化反馈 |
| package.json | 将新结构集成 validator 纳入完整验证 |
| scripts/validate-yarn-length-structure-integration.mjs | 新增 BLOCKER A–G、额外误命中、mutation/persistence/load/atomicity 集成测试 |
| scripts/browser-yarn-length-structure.mjs | 新增真实控件 ABA/左移/占旧slot浏览器测试流程 |
| scripts/validate-yarn-length-batch-integration.mjs | 适配 captured revision；保留精确修改、拒绝不变与 Layer 2 断言 |
| scripts/validate-yarn-length-input-integration.mjs | 非法批量测试传入选择快照 |
| scripts/validate-single-jersey-cam-editor.mjs | 既有批量测试适配选择契约 |
| scripts/validate-workspace-mode.mjs | legacy Pattern load revision保持断言；修正受新存在性判断影响的静态检查 |
| scripts/browser-yarn-length-batch.mjs | 原 D 用例反馈更新为结构变化原因 |

计划文档：`docs/superpowers/plans/2026-10-07-feed-yarn-structure-revision.md`。保护与增量统计脚本：`reports/p0-4b-protect-and-diff.mjs`。本次全部证据使用独立 `p0-4b` 前缀，未覆盖历史审计报告。

最终：**FIXED**。完成后停止，等待下一条用户指令。
