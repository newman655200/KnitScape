# KnitScape P0-1～P0-4 总体架构审计与真实用户验收

审计日期：2026-10-07。结论：**FAIL**。

审计使用当前 `main`，HEAD 为 `29b7e4bcfaee6c9b7f3df070b24c200b7aa56103`。没有切换分支、reset、checkout、stash、clean、自动提交或创建 tag。审计开始记录并备份的 252 个已有修改文件，经 SHA256 复核全部保持不变。本次仅新增审计脚本、报告、日志和浏览器证据；没有修改业务源码、项目 schema 或既有验证脚本。

1. **P0 总体结论**

   成功求解、不可达反馈、输入安全及常规批量原子提交链路通过。发现一个阻塞问题：批量 locator 把“位置和 Yarn asset 相同”误当成“同一个 Assignment 实例”，真实 UI 能误改未选择的 Yarn。当前不能建立 trusted workflow baseline。

2. **用户主流程结果**

   在同一个真实浏览器项目中依次完成 STEP 1–13：G32、4×4 全 K、排针 1234、四路 Feed，Feed 1 从开始即有第二个 Yarn 槽位。单项 23→27→100→23、非法输入保留旧结果、Explicit Clear、多 Yarn 隔离、精确批量、批量拒绝、批量不可达、不同 yarnId 的 stale 拒绝和零目标反馈均通过。随后独立执行删除重建与同 id 槽位左移流程，二者均复现误写。

   23 四路实际求解值：22.99985537891976、22.999856051617197、22.999856042155812、22.99985636579647；最大误差 0.00014462108023835185 cm/100针。

   27 四路实际求解值：26.999994326440053、26.999992639583088、26.999993319385176、26.99999467898935；最大误差 0.0000073604169134000584 cm/100针。两组均 CONVERGED、真正应用到最终路径、VALIDATED；G32 容差均为 0.00079375 cm/100针。

3. **架构一致性**

   当前真实链路为：输入草稿 → `validateYarnLengthInput` / batch preflight → Project facts 提交 → StateMonitor / runSimulation → Machine Domain → adapter → simulation input → yarnSimulation → yarnLengthSolver → 每根 Yarn 的求解路径应用 → SolverResult / derivePreviewValidity → feedback。

   Machine 规则仍由 `src/domain/singleJerseyMachine.js` 的 `resolveSingleJerseyOperations()` 计算，经 `src/adapters/singleJerseySimulationInput.js` 和 `src/components/singleJerseyExecutionInput.js` 适配。Simulation 消费机器矩阵，没有复制解释 Cam/排针的规则。Pattern 与排针保持独立，Cam 不改 Pattern。

   P0-1 integration 除检查元数据外，还将最终 arranged Canvas 的路径序列与 Solver 路径转换后的几何逐条比较，证明结果实际应用。缓存命中时也重新计算 appliedToSimulation，未信任旧 applied 标记。失败 Yarn 使用基础路径，成功的另一根 Yarn 独立使用求解路径。

4. **Project / Derived / UI State 边界**

   Project facts：Pattern/Repeat、Cam、确认的排针、Gauge、Yarn Library/assignment、`feed.yarns[].yarnLengthCmPer100Needles` 等用户配置。

   Derived：`yarnLengthMetrics`、`yarnLengthSolverResults`、`previewValidity` 和当前几何/求解缓存。结果不是项目权威数据。

   UI：selected、pending、workspaceMode、编辑草稿、反馈。batch selection 是 editor 模块局部 Map。物理上部分字段仍共处 GLOBAL_STATE，权威边界通过提交校验和导出白名单区分；本次没有重做 GLOBAL_STATE。

   非法单项和非法 batch 不 dispatch；integration 验证整个 state 对象及既有结果未变化。浏览器验证输入恢复原值，并保持旧反馈及 VALIDATED。

5. **重复业务规则审查**

   普通输入的有限正数规则唯一来源是 `src/domain/yarnLengthInput.js`；single、batch、草稿校验共用。legacy unset 和 Explicit Clear 通过同一函数的 allowUnset=true 进入。100 是合法输入，模型可达性属于 Solver。

   状态常量和 UNREACHABLE 判定来自 `yarnLengthSolver.js`；没有第二套可达范围上限。容差权威值为模型单位 0.01，再由 Solver 按 Gauge 换算到结果中的物理单位。

   `previewValidity.js` 是唯一完成态推导函数。它消费状态、converged、applied、目标匹配、有限 solved/error/tolerance 和容差检查；这是结果防御性消费，不是第二套容差定义。

   `yarnSimulation.js` 与 feedback 都有“有限正数才有目标”的投影筛选，当前一致，没有发现实际规则漂移。UI 的 failureMessage/i18n 映射是单一反馈入口；重复显示状态名称字符串不是第二套求解状态机。本次未进行去重重构。

6. **STEP 1–13 结果与最终验收矩阵**

   STEP 1–13 常规路径均 PASS。Clear 一个目标后，另外三个必要目标仍成功，所以整体仍是 VALIDATED；全部 Clear 后为 DESIGN_PREVIEW。这不表示被 Clear 的 Yarn 已应用目标。额外 locator 案例 FAIL，不能由常规 stale 测试代替。

| 用户行为 | Project State | SolverResult | PreviewValidity | 用户看到什么 | PASS/FAIL |
|---|---|---|---|---|---|
| STEP 1：四路 23 | 四路目标 23；第二槽 unset | 四路 CONVERGED，solved≈23，applied=true | VALIDATED | 目标/求解值/状态/已应用；仅模型几何 | PASS |
| STEP 2：23→27 | 仅对应目标变 27 | 旧结果清空；新 CONVERGED≈27 | DESIGN_PREVIEW→VALIDATED | 等待结果，随后 27 已应用 | PASS |
| STEP 3：27→100 | 保留 100 | UNREACHABLE_TARGET，候选≈46.7722，applied=false | PARTIAL（其他目标成功） | 目标超出模型可解范围、未应用、该纱线使用基础路径 | PASS |
| 四路全部 100 | 四路均保留 100 | 全部 UNREACHABLE_TARGET，applied=false | INVALID | 当前预览不是目标成功结果 | PASS |
| STEP 4：100→23 | 恢复目标 23 | CONVERGED≈23，applied=true | VALIDATED | 恢复成功结果 | PASS |
| STEP 5：-1 | 仍为 23 | 上一份合法结果完全保留 | VALIDATED | 未保存，原目标保持不变 | PASS |
| STEP 5：直接键入 0 | 仍为 23 | 上一份合法结果完全保留 | VALIDATED | 未保存，需明确 Clear | PASS |
| STEP 5：删除为空 | 仍为 23 | 上一份合法结果完全保留 | VALIDATED | 未保存，输入恢复 23 | PASS |
| STEP 5：abc | 仍为 23 | 上一份合法结果完全保留 | VALIDATED | 未保存、要求有限正数 | PASS |
| STEP 6：Explicit Clear | 仅该目标提交 legacy 0 | 对应 SolverResult 移除，反馈 NOT_SET | 其他必要目标成功时 VALIDATED | 目标已清除，该 Yarn 未应用目标 | PASS |
| 全部 Clear | 全部 legacy 0 | []；UI 每槽 NOT_SET | DESIGN_PREVIEW | 基础设计预览、没有目标验证 | PASS |
| STEP 7：同 Feed A23/B18 | 两个独立目标 | 两条独立关联的成功结果 | VALIDATED | 分别看到≈23与≈18 | PASS |
| STEP 8：single multi-yarn edit A→25 | A25；B18 不变 | 真实 Solver input B=18；B result≈18 | VALIDATED | A≈25，B≈18，分别已应用 | PASS |
| STEP 9：batch valid F1-A/F3-X→27 | 仅两个 Assignment 改变 | 两个新目标成功，其他目标不变 | VALIDATED | 将修改2根；已更新2根 | PASS |
| STEP 10：batch invalid -1 | 整个 Project State 不变 | 整份 Derived Result 不变 | VALIDATED | 未修改任何纱线：请输入有限正数 | PASS |
| STEP 11：batch 100 | preflight通过，选中目标写100 | 对应结果不可达、未应用 | PARTIAL；全部100为INVALID | 已更新目标；求解未应用，两阶段信息可区分 | PASS |
| STEP 12：stale target 换 yarnId | 替换保留；batch没有写入任何目标 | 替换后的合法结果保留 | VALIDATED | 目标已变化，请重新选择 | PASS |
| STEP 13：0 targets | 全部不变 | 全部不变 | VALIDATED | 将修改0根、请选择需要修改的纱线、应用禁用 | PASS |
| Gauge change G32→31 | Gauge=31 | 立即清空，再按新机号求解 | DESIGN_PREVIEW→VALIDATED | 新针距0.819mm；模型范围14.4863–48.2809 | PASS* |
| Cam change K→T | Cam动作改变，Pattern不变 | 清空后用新矩阵求解 | DESIGN_PREVIEW→VALIDATED | 当前模型范围与结果随Cam变化 | PASS* |
| Needle Arrangement change 1234→4321 | 确认排针改变，Pattern不变 | 清空后重新计算/匹配当前输入缓存 | DESIGN_PREVIEW→VALIDATED | 当前结果重新生成 | PASS* |
| Feed Yarn 真正变化 | Assignment变化/添加B18 | 清空后生成每槽关联结果 | DESIGN_PREVIEW→VALIDATED | 每根纱线独立反馈 | PASS* |
| 选B→删B→同slot同id加回→batch27 | 新建且未重新选择的槽位被写27 | 对错误选中的新槽位成功求解 | VALIDATED | 自动勾选新槽位并显示“已更新2根” | **FAIL** |
| 同id两槽：选A23→删除A→B18左移→batch27 | 原未选B被误改18→27 | B被按27真实求解 | VALIDATED | 自动勾选B并显示“已更新1根” | **FAIL** |

   *机器变化的 PASS 指 dispatch 返回时及真实渲染帧的状态；下一条详述同步内部快照的技术债，未将其隐藏。

7. **Gauge / Cam / Arrangement / Feed Yarn 失效结果**

   `runSimulation.syncState` 对实际依赖项停止旧模拟，同步清空 SolverResult、置 DESIGN_PREVIEW，再 debounce 求解。batch 在同一个事实提交中直接清派生。

   `reports/p0-overall-renderer-probe.mjs` 使用真实 createAppRenderer、state/actions/runner/geometry/solver，按生产顺序把 appRenderer 注册在 runner 前；Canvas、计时器和 renderView 记录器是测试设施。六种变化在 debounce 前的实际渲染帧均为 DESIGN_PREVIEW + []，之后为 VALIDATED，结果目标均匹配新事实。根代理独立重跑退出0。

   严格检查内部同步窗口后发现：非 batch 的事实先进入 GLOBAL_STATE，runner 随后 nested dispatch 清结果，因此一个注册在 runner 前的同步 observer 可以收到新事实+旧VALIDATED的原始快照。这不是完全原子化的 StateMonitor 通知。目前真实 renderer 通过 requestAnimationFrame 读取最新 GLOBAL_STATE，不会把这个同步快照渲染给用户。列为未来同步消费者风险，不能宣称该窗口在内部绝对不存在。

   缓存探针：zoom/color 各0次新求解；Gauge、primary diameter、primary lengthScaleY、target、Cam bitmap各4次新求解。当前模型依赖未发现缓存遗漏。Feed身份改变先失效，几何等价时允许重用求解缓存，但 applied 会重新判断。

8. **保存边界**

   `src/actions/exporters.js:getProjectData()` 使用11字段白名单：width、height、repeats、yarnPalette、yarnSequence、yarnPlies、yarnLibrary、singleJerseyCamProgram、needleArrangement、needleArrangementInputs、machineGauge。

   SolverResult、PreviewValidity、yarnLengthMetrics、selected/pending、batch selection不进入现有导出。importers只组装授权字段，不信任导入的结果/UI字段。`.knitscape` package writer 会 spread传入project；当前生产入口始终传白名单结果，没有泄漏，但它本身不是第二道过滤器。本次未修改持久化格式或扩大Save/Load。

9. **旧项目兼容**

   当前完整 validators 和导入 integration 通过：Pattern-only旧项目、tracks-only无目标Cam、legacy 0/empty/null、既有Yarn Library/PBR，及`.knitscape`元数据/二进制往返、旧资产迁移、lazy读/释放和PBR renderer。

   既有边界保留：Pattern-only导入会保留当前Machine/Library；显式Feed/Yarn槽若缺少纱长字段会被拒绝，HEAD基线已如此，不是本次P0新增回归。没有声称所有未知旧schema都兼容。

10. **PreviewValidity语义**

    VALIDATED仅表示所有实际参与当前模拟的必要目标，均CONVERGED、误差在Solver容差内且求解路径真正应用。部分成功为PARTIAL；没有必要目标为DESIGN_PREVIEW；必要目标全部失败或机器配置无效为INVALID。

    UI明确写“仅模型几何求解，未经实机验证。未应用的求解值为候选值，不是当前模拟纱长。”没有实机、实际工艺、实物品质或生产确认的承诺。

11. **旧纱长统计风险**

    左侧24.87等仍显示cm/100线圈，并紧邻“基础预览统计，非目标求解值”；目标表标cm/100针，分别列目标、模型求解值、状态、是否应用。当前功能文案区分成立；旧统计口径问题仍存在，本次未重写算法，未将24.87作为验收依据。

12. **locator风险评级：HIGH**

    A：形成选择后，真实UI可以删除已选槽位。

    B：pending同Yarn保留，+Yarn可在原尾slot重建相同id。

    C：旧Map按feedIndex:yarnIndex索引并只匹配yarnId；重建后checkbox自动勾选，preflight通过。实测原B18删除→新B unset→旧batch27写入新B，提示已更新2根。

    另有更短实际路径：Feed1两槽共用同一Yarn asset，选第一槽23，删除第一槽；原未选第二槽18左移到0，自动继承选择；batch27误写第二槽并提示已更新1根。它无需重建或改id，因此提升为HIGH，属于可复现的用户事实误写阻塞，不只是不可达的理论ABA。

    直接关联代码：`src/views/singleJerseyCamProgramEditor.js:101`选择Map、`:188`checkbox投影、`:204`删除handler；`src/actions/yarnLibrary.js:109`assignment写入、`:122`删除slot；`src/domain/yarnLengthBatch.js:22`位置/id校验。

    最小建议：在既有Assignment增删/替换、Feed结构变化的成功提交入口统一使批量选择失效，提示“目标已变化，请重新选择”，要求再次明确选择；目标值单纯变更不等于Assignment实例变更。为覆盖快速连续变更/非UI入口，可用仅运行时的selection generation并在preflight比较。无需先迁移assignmentId，不写项目格式。按用户“不要先改”，本次没有实施。

13. **debug快捷键风险：LOW，非阻塞**

    `src/events/keypressEvents.js:31`的d全局快捷键无DEV gate、无input过滤。真实纱长输入框中键入d会打开调试面板。面板只读、可关闭；核验项目目标和求解结果未被d修改，仍VALIDATED。它影响普通输入/交互体验。已有Ctrl+A也被全局处理，本次删空验收使用真实End/Backspace，未改debug系统。

14. **死代码/重复代码事实**

    `runSimulation.js:205`的queueSim只有声明和赋值，无读取，是明确无效局部变量。

    `yarnLengthMetrics.js:69`的buildFeedYarnLengthDiagnostics目前只有gauge validator调用，没有生产消费者；不是完全无调用的函数，也不是当前目标应用链的证明，应后续确认是否保留测试/参考用途。

    两处positive-target投影当前一致，未发现第二个PreviewValidity推导或另一套Solver状态/容差规则。未清理既有辅助函数、Legacy路径或测试。

15. **validate结果**

    最终 `npm run validate` 退出0，35/35。覆盖P0-1 result integration、P0-2 failure integration、P0-3 input integration、P0-4 batch integration；包括真实最终绘制路径、异常/不可达/未应用、原子拒绝和多Yarn。

    P0-2 browser 7检查点；P0-3 browser 17检查点；P0-4 browser 19检查点通过。当前附加locator流程明确FAIL，既有测试没有覆盖该实例身份缺口。

    浏览器恢复执行时，CUA工具的本地模块import出现EPERM且不支持data URI；这是测试工具加载限制。剩余P0-3 E/F与P0-4既有操作/断言在同一CUA浏览器API中直接重放并全部通过；未修改旧脚本或注入页面隐藏state。浏览器console error为空。没有把工具加载失败说成原模块加载成功。

16. **build结果**

    最终 `npm run build` 退出0，745 modules transformed，生产构建成功。未因本次审计改变构建或PBR功能。

17. **diff check结果**

    `git diff --check` 退出0，没有空白错误。Git的LF/CRLF提示属于现有工作区换行转换提示，不是diff check失败。

18. **当前总diff stat**

    标准 `git diff --stat`：20个tracked文件，+588/-161。明细见`reports/p0-overall-git-diff-stat.txt`。

    Git标准stat不包含未跟踪文件：另有13个未跟踪src/scripts文件，共1603行。将这些代码一起计入，当前源码/脚本/配置差异涉及33个文件，+2191/-161。文档、截图、JSON、日志和本次reports审计脚本不计入这个代码行统计。

    这是对HEAD的整个已有工作区统计，包含预先存在的PBR/renderer等改动，不能全部归因为本次审计或单一P0阶段。本次对业务/既有测试文件的增量为0。

19. **阻塞问题**

    一个根因、两条实际误写路径：locator不能识别Assignment实例失效；删除重建或同id左移后，未重新选择/原未选择的Yarn被batch改写，UI返回成功。该问题污染用户目标事实，符合用户定义的FAIL标准。

20. **非阻塞technical debt**

    非batch同步StateMonitor原始快照仍可能含旧派生结果；当前实际renderer已避免用户可见窗口。全局d/Ctrl+A未隔离输入框。queueSim无读、诊断辅助函数仅测试消费。positive-target两处投影需随以后unset策略变化同步核验。package writer没有第二道白名单。AGENTS/NEXT_TASK的旧持久化缺口描述与当前源码不一致，后续维护文档时更新。本次均未顺手处理。

21. **最终结论：FAIL**

    当前P0-1～P0-4不能建立新baseline。测试通过不覆盖已经实测的误写阻塞。等待下一条指令；没有扩大任务到其他功能。

22. **建议commit message**

    当前FAIL，暂不建议提交trusted workflow baseline。阻塞修复并重新验收通过后，再考虑用户给出的`feat: establish trusted feed yarn length workflow`；本次没有提交。

23. **建议tag**

    当前不建议创建tag。重新验收通过后才考虑`baseline-trusted-yarn-length`；本次没有创建tag。

证据索引：`reports/p0-overall-browser/overall-sequence.json`、`locator-defects.json`、`p02-regression.json`、`p03-regression.json`、`p04-regression.json`；`reports/p0-overall-renderer-probe.mjs/.json/.log`；`p0-overall-solved-measurements.json`；`p0-overall-preservation.json`；`p0-overall-validate.log`、`p0-overall-build.log`、`p0-overall-diff-check.log`。外部备份目录：`C:/Users/liuchen/.codex/visualizations/2026/10/06/01a11150-f0b8-77f2-bc9f-aea30fbc8046/p0-overall-audit`。

误写前：原未选择的第二槽左移后目标仍18，却已继承批量勾选。

![删除后原未选槽位自动继承选择](C:/Users/liuchen/Desktop/knitscape/reports/p0-overall-browser/SHIFT-after-delete.jpg)

误写后：同一槽位被写27，显示已更新1根。

![批量误写为27并返回成功](C:/Users/liuchen/Desktop/knitscape/reports/p0-overall-browser/SHIFT-applied.jpg)

范围确认：未开发Yarn Library重构、Undo/Redo、Save/New增强、UI重构、Legacy迁移、Command Bus、Event Sourcing、GSM、幅宽、耗纱或PBR新增功能。
