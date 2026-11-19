# KnitScape P0-4：批量纱长原子修改 + 多 Yarn 隔离

开工 main，HEAD `29b7e4bcfaee6c9b7f3df070b24c200b7aa56103`。既有 P0-1/P0-2/P0-3 和其他用户未提交修改均保留副本与 SHA256；开工 git status 与 HEAD 记录在外部 `p0-4-audit/`。

## 修改前调用链与真实审查

`batch form submit -> scope + checked selected-feed -> getSingleJerseyFeedIndices -> setSingleJerseyFeedYarnLengths(feedIndices,value) -> normalize current Cam -> map feeds -> map all yarns -> one dispatch -> runSimulation immediately invalidates -> debounce solver -> SolverResults / PreviewValidity`。UI 忽略 action 的返回结果。

1. 全部 Feed：生成 0..feedCount-1。
2. 奇数 Feed：显示 Feed1/3…，内部偶数索引。
3. 偶数 Feed：显示 Feed2/4…，内部奇数索引。
4. 已选 Feed：将 checked selected-feed 集合与当前合法索引相交。
5. 一个命中的 Feed 下所有 Yarn 都被更新，没有 Yarn assignment 选择。
6. 没有目标返回 NO_FEEDS_SELECTED，UI 忽略，表现为无反应。
7. 正常批量一次 Cam dispatch；之后 runner 的派生结果更新独立发生。
8. 未循环调用单项 setter。
9. 当前值会先验证，但不存在具体 assignment 的完整 preflight；非法/失效 Feed 索引会被忽略，无法实现目标集合全部有效才提交。
10. 会隐式修改同 Feed 未明确选中的其他 Yarn。
11. 没有将修改 Yarn 数量，也没有操作反馈。
12. 输入只关联 Feed 索引；实际数据有 feedIndex/yarnIndex/yarnId，没有 assignmentId，也没有 yarnId stale 校验。

## 实施计划

先写 A–H 真 action/state/runner 集成回归；建立最小纯 preflight，复用 P0-3 validator。批量 API 改为明确 locator 集合 `{feedIndex,yarnIndex,yarnId}`，不保留隐藏“Feed内全部Yarn”路径；校验全部后构造一次 next Cam，保持非目标对象/字段。原子提交同时撤销旧派生验证，继续由现有 runner/solver/PreviewValidity 计算。

UI 保留范围筛选，添加每项显式选择、目标数量、空选择提示和成功/失败反馈；选择记录留在本地 UI，不进入项目主数据。按 selection-time yarnId 检查 stale，绝不在提交时根据位置自动换成新 Yarn。

最后真实浏览器 A–H/功能反馈验证、P0-1/P0-2/P0-3 回归、完整 validate/build/diff check、保留性与增量统计；不提交、不继续范围外开发。

## 完成报告（32 项）

1. **修改前 Batch 真实行为**：上面的 12 项审查在实施前记录。Feed 范围直接生成修改对象；action 遍历命中 Feed 中全部 Yarn，一次 dispatch。空范围/失败返回值未被 UI 消费，既没有 Yarn 级选择，也没有修改数量及操作反馈。
2. **误改同 Feed 其他 Yarn 的根因**：`feedIndices.includes(feedIndex)` 命中后直接 `feed.yarns.map(...)` 改写全部目标值，没有 assignment 集合。选择 Feed 隐含选择其全部 Yarn。
3. **最终修改对象**：明确的 Feed × Yarn assignment。Feed 的全部/奇数/偶数/已选范围只限制可勾选候选项；必须再主动勾选每根 Yarn。切换范围清空 assignment 选择，避免隐藏目标继续提交。
4. **标识方案**：使用临时 locator，没有引入 assignmentId，也没有迁移 Feed/Yarn 模型。
5. **locator 字段**：`{ feedIndex, yarnIndex, yarnId }`。UI 勾选时复制当前 yarnId；提交时不按最新位置重新绑定 ID。
6. **Preflight 规则**：复用 P0-3 `validateYarnLengthInput(value)`；目标必须是非空数组；locator 必须为对象，索引为非负整数，yarnId 为有效现有类型；不得有重复 Feed/slot；当前 feeds/yarns 必须为数组，Feed、slot 必须存在，当前 yarnId 严格匹配；当前纱长字段必须仍符合可编辑项目值结构。返回 INVALID_YARN_LENGTH、NO_TARGETS、INVALID_TARGET、DUPLICATE_TARGET、STALE_TARGET 或 TARGET_NOT_EDITABLE，并附 `updatedCount:0` 和适用的 `failedTargetIndex`。
7. **Atomic Commit**：全部校验完成后，按 locator 集合构造一次 next Cam，只替换目标 Yarn 的 `yarnLengthCmPer100Needles`。一次 dispatch 发布 Cam 与已失效的派生结果。没有循环调用单项 setter。整个 preflight→构造→dispatch 是同步过程，没有异步间隙。
8. **无部分提交的证据**：新集成测试在 runner 之前注册观察者，断言每次合法 batch 恰好一次 Cam 业务提交。失败断言 GLOBAL_STATE、SolverResults 的引用、PreviewValidity、定时器与实际绘制路径均保持。最后一个 target 被替换、slot 删除、Feed 删除、当前字段不可修改时，都断言前面的有效 target 没有被提前写入。重复/非法 locator 也整体拒绝。对非目标 Yarn 断言对象引用完全不变，并注入扩展字段验证它们没有被 normalization 丢失。
9. **stale 检测**：按选择时的 feedIndex/yarnIndex 查当前 slot，再严格比较 yarnId。浏览器实际通过 Yarn Library 的既有分配操作把 A 替换成 B，保留旧 locator；提交整批失败，包括提前选择的另一个有效 Feed。UI 在提交前显示目标变化提示，失败后清空待提交选择，要求重新选择。
10. **0 targets**：action 返回 NO_TARGETS、updatedCount 0，不 dispatch。UI 明确显示“将修改 0 根纱线 / 请选择需要修改的纱线”，禁用应用按钮；输入 27 也不会改变现有结果。
11. **非法 batch value**：-1、0、空、空白、NaN、Infinity、非法字符串、null/undefined 整体拒绝。UI 显示“未修改任何纱线：请输入有限正数。”并保留选择供重试。普通 0/空输入不能 Clear，明确单项 Clear 仍是提交 legacy unset=0 的入口。
12. **100cm 允许提交的原因**：它是有限正数，输入合法。Batch 不查询模型范围、不限制到约 14–47；提交后现有 Solver 判断可达性，UNREACHABLE_TARGET 的候选值不能标为已应用。
13. **Derived Result 失效时点**：同一次合法业务 dispatch 即包含 `yarnLengthSolverResults:[]`、`previewValidity:DESIGN_PREVIEW`，随后复用 runSimulation 的同步失效、debounce、Solver 与 PreviewValidity 推导。runner 之前的观察者也看不到“新目标 + 旧 VALIDATED”。非法操作不清结果、不改 validity。
14. **CASE A**：集成和真实浏览器通过。四路 23，只选 Feed1/3 第一根 → `[27,23,27,23]`；VALIDATED，UI“已更新 2 根纱线”。
15. **CASE B**：通过。Feed1 `[23,18]` 只选第一根 → `[25,18]`。第二根项目对象引用与其他字段不变，求解目标仍 18。浏览器求解显示约 24.9999、17.9994，均 CONVERGED；UI“已更新 1 根纱线”。
16. **CASE C**：通过。action NO_TARGETS；原 State/结果/validity 全不变。浏览器禁用应用并显示明确选择提示。
17. **CASE D**：通过。最后一个 locator 的 A 被 B 替换，返回 `{ok:false,reason:STALE_TARGET,updatedCount:0,failedTargetIndex:1}`。所有目标不写入。浏览器显示“未修改任何纱线：目标已变化，请重新选择。”；替换操作自身已经形成的有效结果保持 VALIDATED，失败 batch 不破坏它。
18. **CASE E**：通过。选 Feed1 的 A+B 后输入 -1，A=23、B=18，旧 SolverResults/VALIDATED 保持。浏览器另覆盖 0、空、NaN、Infinity、非法字符串，同样整体拒绝。
19. **CASE F**：通过。四路目标 27，四个 SolverResult 均 CONVERGED/appliedToSimulation=true，VALIDATED。集成 solved 分别为 26.999994326440053、26.999992639583088、26.999993319385176、26.99999467898935；最大误差 0.0000073604169134 cm，低于现有 0.00079375 cm 容差。浏览器显示 27.0000，UI“已更新 4 根纱线”。
20. **CASE G**：通过。四路第一根设置 100、Feed1 第二根保持 18 → PARTIAL；四个 100 均 UNREACHABLE_TARGET/未应用。再把第二根设为 100 → INVALID，五个目标保存为 100，全部未应用。浏览器显示候选 46.7722，并继续明确“模型可解范围（非实际工艺范围）”。
21. **CASE H**：通过。初始 `[[23,18],[23],[23],[23]]`，只选 Feed1-A、Feed2-C、Feed3-D 设 25 → `[[25,18],[25],[25],[23]]`，B 完全保留。应用前明确计数 3，成功“已更新 3 根纱线”。
22. **P0-1 回归**：真实 Project target→runSimulation→Solver→绘制路径→结果 State→PreviewValidity 的既有 integration 通过。23 solved 范围 22.99985537891976–22.99985636579647；27 范围 26.999992639583088–26.99999467898935。均保留用户目标、CONVERGED、已应用、VALIDATED，误差在容差内。
23. **P0-2 回归**：既有 failure integration A–G 和真实浏览器 A–G 均通过：100 不可达、VALIDATED/PARTIAL/INVALID/DESIGN_PREVIEW、Gauge/Cam/排针/Feed 变化后失效、100→23 恢复、同 Feed 一成功一失败。浏览器还验证结果点击不触发画布交互、保留已有设置弹窗外部点击行为。VALIDATED 继续仅代表模型几何求解；明确未经实机验证。旧左侧 24.87 指标继续标注为基础预览统计。
24. **P0-3 回归**：既有 input integration 与真实浏览器通过。23→-1/0/空/NaN/Infinity/非法字符串拒绝；0 和空均分别测失焦与 Enter；只有明确 Clear 提交 0。四路 Clear 后 DESIGN_PREVIEW；27、小数 23.14 正常保存；同 Feed 非法单项编辑保留 `[23,18]`。旧项目 0/空/null 兼容与原始类型/import 原子拒绝也通过。
25. **npm run validate**：退出 0，35/35 validators passed。新增 `validate:yarn-length-batch-integration` 已由总入口自动发现执行，没有删除旧 validator。完整日志 `reports/p0-4-validate.log`。仅既有 Lit 开发模式提示，无失败。
26. **npm run build**：退出 0，Vite 4.4.7，745 modules transformed，built in 3.29s。日志 `reports/p0-4-build.log`。
27. **git diff --check**：退出 0，无空白错误。普通运行仅 Git LF/CRLF 提示；另用 `git -c core.safecrlf=false diff --check` 确认退出 0。未通过改换行格式规避错误。
28. **新增/修改文件**：见下表。报告、完整日志、保留性/统计 JSON、真实浏览器 JSON/截图保存在 reports；已有 P0 报告/截图没有被覆盖。P0-4 开工的 138 个既有文件中，131 个 SHA256 完全一致；改变的 7 个都是下表内必要增量文件。未更改已有 PBR/其他用户修改。核对结果 `reports/p0-4-preservation.json`。
29. **本次增量 diff --stat**：以开工副本作基线，用 `git diff --no-index --numstat` 对每个文件统计（新文件比较 NUL）：10 个源码/脚本文件，577 insertions、53 deletions，见下表与 `reports/p0-4-incremental-stat.json`。包含新 untracked 文件，不把 P0-1/2/3 已有修改冒充本次工作。当前对 HEAD 的普通 `git diff --stat` 是累计已跟踪改动：20 files、588 insertions、161 deletions，未包含 untracked；两者口径不同。
30. **项目持久化格式**：未修改。selection/count/feedback 仅为本地 UI 状态；结果/validity 仍为派生。集成确认 exporter 不写 SolverResults 或 PreviewValidity，没有 schema migration。
31. **长期架构**：没有引入。仅新增 40 行纯 preflight 模块，在既有 action 上明确提交边界。继续复用 P0-3 validator、P0-1/2 Solver/PreviewValidity、原 Machine/Simulation 链路。
32. **遗留风险**：临时 locator 无法区分同一位置、同一 yarnId 的删除后重建或相同 ID 槽位交换，需要未来稳定 Assignment ID 才能完全识别；本任务未迁移。已产生的批量反馈文字在切换语言后保留原语言，直到下一次操作（计数/标签会更新）；记录为轻微体验问题。项目既有全局 `d` 快捷键在输入文本时会打开调试面板，真实浏览器第一次输入 `invalid` 暴露此既有行为，未修改快捷键系统；改用 `abc` 后完整自动回放通过。模型范围与实机工艺仍独立，VALIDATED 不表示生产实机验证。

## 文件增量

| 文件 | 本次修改 | 增/删行 |
|---|---|---:|
| `src/domain/yarnLengthBatch.js`（新增） | 纯 locator/preflight；共享输入规则；stale/重复/可编辑性拒绝 | +40 / -0 |
| `src/actions/singleJerseyCamProgram.js` | 显式 targets；全量校验；一次业务提交；同步撤销派生验证；不归一化丢其他字段 | +21 / -24 |
| `src/views/singleJerseyCamProgramEditor.js` | Feed filter 与 Yarn 选择分离；选择时 ID；计数、空/成功/失败提示；重绘保留反馈 | +106 / -20 |
| `src/i18n/translations.js` | 简中/繁中/英文/越文 8 个必要功能文案 | +32 / -0 |
| `styles.css` | 新 checkbox 不继承纱长输入尺寸；计数/反馈允许换行 | +5 / -0 |
| `package.json` | 新 batch integration npm script | +1 / -0 |
| `scripts/validate-single-jersey-cam-editor.mjs` | 原 batch 回归改为明确 locator，验证未选择 sibling 保持 | +9 / -7 |
| `scripts/validate-yarn-length-input-integration.mjs` | 原非法 batch 测试适配明确 locator，保留原断言 | +4 / -2 |
| `scripts/validate-yarn-length-batch-integration.mjs`（新增） | A–H、一次 commit、先于 runner 的观察者、最后目标故障注入、非目标对象/字段保留、持久化边界 | +174 / -0 |
| `scripts/browser-yarn-length-batch.mjs`（新增） | CUA 真实控件自动回放 A–H/filters/非法值、只读 DOM、截图证据；等待新目标求解行，键盘激活被滚动隐藏的按钮 | +185 / -0 |

真实浏览器证据：`reports/p0-4-browser/results.json`（A–H 共 19 个检查点）、`regression-P02-results.json`、`regression-P03-results.json`；对应逐 case JSON/JPG。`explicit-selection.jpg` 在展示页面后确认提交前的 3 根选择计数；`final-feedback.jpg` 记录成功反馈，对应只读 DOM 记录 firstFeed `[25,18]` 见 `final-feedback.json`。浏览器控制台 error 列表为空。后台嵌入浏览器截图曾未及时刷新空元素的新文字；短暂展示浏览器核实计数真实可见后恢复原显示设置，没有为截图改变生产布局。快速展示页面回放中曾读到 debounce 的 DESIGN_PREVIEW，测试已补强等待新目标的最终求解行，并验证同一次读取 validity 正确。缩窄面板后已存在的网格水平滚动会让按钮移出视口，测试改用真实键盘激活新增/分配按钮。最终自动 A–H 完整通过。回放未注入项目 State、未调用页面内部 action、未保存/导出测试项目。

只读代码审查与独立 batch integration 通过，没有阻塞或重要缺陷；上述语言提示缓存记录为 Minor。

明确确认：未做 UI 视觉重构、Undo、Yarn Library 架构改动、Legacy 删除、assignmentId 全项目迁移、Command Bus、Event Sourcing、GLOBAL_STATE 大重构、生产计算新功能、PBR 新能力、Simulation 新算法或 Machine Domain 语义修改。未自动提交代码。当前仍 main，HEAD 未变；不再继续开发，等待下一条指令。
