# 交给 Codex 的上下文压缩任务书

> 生成日期：2026-11-19。用途：让 Codex 通读仓库，产出一份"决策级"上下文包——目标是让任何后续接手者（人或 Agent）**仅凭这份包就能做出正确的开发决策**，而不只是知道项目长什么样。
> 本文件本身不是开发任务，不产生构建产物。

## 任务定义

目标仓库：`C:\Users\liuchen\Desktop\knitscape`

你在做"决策上下文压缩"，不是做开发、不是写项目介绍。判断标准只有一个：**读者读完这一份，是否知道下一步该做什么、不该做什么、怎么做会被验证、哪些问题无解**。

先读 `AGENTS.md` 和 `README.md`，遵守其中 FACT / INFERENCE / PREDICTION / SUBJECTIVE / UNKNOWN 标注约定，以及 `docs/PROCESS_VALIDATION.md` 中物理数据六项原则。全部结论性陈述必须带标注。

输出：

```text
C:\Users\liuchen\Documents\KnitScape\archives\context-pack-2026-11-19\CONTEXT_PACK.md
```

（目录不存在就建。按 AGENTS.md §6，不在桌面、不在仓库内新建目录。）

篇幅控制在 100K tokens 以内。超限时按各节标注的优先级取舍，削减写法而非删节。

## 一、目标与路线（优先级：必须完整）

1. **项目最终要达成什么**：区分"软件目标"（用户能用什么）与"物理正确性目标"（要证明什么生产事实）。以 README / ROADMAP / NEXT_TASK 为准，但用代码实际实现状态校验文档说法。
2. **当前阶段与关卡**：P0-C0 Correctness Preparation 具体卡在什么关口、过关判据是什么、判据写在哪个文件。
3. **路线历史与禁区**：列出被明确禁止的路线（V2/L0–L6、旧 needleExecution/arrangedChart 语义、`9b80ef8` 撤销的方向），每个禁区说明"为什么禁"，并指出代码里是否还残留相关内容（残留位置也要列出——这是后续接手者最容易踩的坑）。
4. **NEXT_TASK.md 全文结论**：当前可做项、禁令、确认后分支分别是什么。

## 二、git 实况与工作区（优先级：必须完整）

现场运行 `git branch --show-current`、`git log -1 --oneline --decorate`、`git status --short`、`git stash list`、`git log --oneline -20`，报告实际状态，不照抄文档。

- 逐个未提交文件：改了什么（diff 摘要）、意图一句话、FACT/INFERENCE 标注。这些改动是"既有资产"，后续接手者不得覆盖，必须知道它们的存在。
- 确认历史起点 `2a1efc1` 与文档所述 HEAD `7ababf2` 是否仍在历史中。
- 检查是否存在未合并分支、v2.* 标签残留。

## 三、机器执行链（优先级：最高，逐字原文）

全文逐字贴出，不要删减、不要改写：

- `src/domain/singleJerseyMachine.js`（`resolveSingleJerseyOperations()` 全文件）
- `src/components/runSimulation.js`
- `src/components/singleJerseyExecutionInput.js`
- `src/adapters/singleJerseySimulationInput.js`

每个文件标注行数。并回答：**这条链之外，代码里还有没有第二处实现或旁路调用同类逻辑**（AGENTS §3 禁"复制第二套"，请实际 grep 验证并给出证据）。

## 四、领域模型与数据结构契约（优先级：最高）

这是后续接手者改任何功能都要依赖的东西，必须从代码原文提取，不靠文档转述：

1. **Pattern / Repeat 的数据结构**：字段、单位、来源文件。
2. **Needle Arrangement**：Needle Type ID 循环的表示、输入入口、应用逻辑位置。
3. **Single Jersey Cam Program**：K/T/M 动作矩阵的表示、每个 Needle Type × Feed 的映射规则所在函数。
4. **Machine Execution 输出**：`resolveSingleJerseyOperations()` 的返回结构逐字段说明。
5. **Simulation 输入/输出**：`createSingleJerseySimulationInput()` 的入参与产物。
6. **项目包（.knitscape）schema 全文**：保存白名单/黑名单（哪些字段持久化、哪些不保存——README 提到 SolverResult/PreviewValidity/revision 不保存），版本字段与迁移逻辑位置。
7. **Yarn Library / PBR / Feed×Yarn 目标**的数据结构。
8. **revision 保护机制**：runtime revision 怎么生成、怎么校验、失效条件。
9. **术语表**：中文业务词 ↔ 代码标识符对照（如"排针"→NeedleArrangement、"三角"→Cam、"机号"→Gauge、"纱长"→yarn length 等），以代码为准。后续接手的 AI 对不上词就找不到代码。

## 五、模块地图（优先级：高）

为 `src/` 下**全部**子目录和文件列出：导出符号（函数/类型/常量）签名、一句话职责、输入输出、行数。不贴函数体。重点深挖：

- `src/simulation/`（48 万字节，最大且最缺文档）：额外说明模块间调用关系和数据流，旗舰文件 `sopSpatialHypothesis.js`、`sopInterlockCurve.js`、`yarnSpatialPreviewRenderer.js`、`sopTopologyAdapter.js` 要给出内部主要函数列表（不贴体）。
- `src/domain/`、`src/adapters/`：权威逻辑所在，逐个说明"为什么它是权威"。
- `src/actions/`、`src/events/`、`src/views/`、`src/components/`：从入口到 domain 的调用路径，至少画出 3 条主要用户流（打开项目→改排针→看预览→保存）。
- `src/lib/`、`src/yarnTexture/`、`src/i18n/`、`src/codeGuide/`：简述职责即可。
- 标注每个文件的"被谁引用"（入度），指出高耦合热点和疑似死代码。

## 六、当前能力边界：文档 vs 代码实况（优先级：高）

逐项对照 README「当前产品链路」列出的能力，**以代码为准**判定：已实现 / 部分实现 / 仅有 UI 无逻辑 / 未实现。每项给代码出处（文件+函数）。特别核实：

- 排针前/排针后双预览是否真走两条路径；
- 二维路径纱长估算的实际算法与精度声明；
- WebGL UV 纹理预览与 PBR 的关系；
- Simulation 是"二维分层路径预览"这一说法的代码依据。

## 七、文档冲突与决策记录（优先级：高）

1. README、AGENTS.md、NEXT_TASK.md、`KnitScape_当前功能与算法.md`、`docs/*.md` 之间的事实性不一致：逐条给冲突内容、双方出处（文件+行号）、哪方更可信及依据（代码优先于文档）。已知线索：`reports/doc-alignment-2026-10-17/REPORT.md`，须核实哪些已消解、哪些仍在。
2. 从 `reports/` 与文档中提取**设计决策记录**：每个重要 DESIGN DECISION 是什么、为什么这样决定、谁在何时决定、后来是否被推翻。

## 八、reports/ 结论时间线（优先级：中）

把 `reports/` 下每个报告目录压缩成结论条目，按日期排序。每条：结论、日期、是否已被后续报告推翻/收窄/取代（指出哪一份）。**禁止粘贴 results.json 内容**，只允许引用结论性数字并注明出处文件与字段路径。

## 九、验证体系（优先级：高）

1. `package.json` 全部 `validate:*` 脚本台账：各自守护什么不变量、对应哪个模块。
2. **实际运行全部验证与 `npm run build`**，如实记录红/绿/未跑及失败详情。没跑必须标"未跑"，不得默认成功。
3. 指出**验证覆盖不到的盲区**：哪些逻辑没有脚本守护（这是后续改动最容易静默出错的地方，逐一列出）。
4. 验证脚本本身的可信度：有没有脚本是靠自证常量通过的（假绿），抽样检查并报告。

## 十、已知问题、失败尝试与阻塞（优先级：高）

1. AGENTS §4 七个工艺问题逐项状态：UNKNOWN / 已确认（结论记在哪）/ 已有测量数据。不得用默认值补成工艺事实。
2. 历史失败尝试：哪些方案试过、为什么放弃（从 reports/、git log、文档中提取）。防止后续接手重复踩坑。
3. 当前已知 bug / 未解决问题清单（从 TODO/FIXME、reports 未决项、验证失败中汇总）。
4. Solver → UI 的权威性问题：Solver 窗口与完整 repeat 诊断口径差异的具体内容与代码位置。

## 十一、协作与工程约定（优先级：中）

汇总 AGENTS.md §5/§7 与项目中的实际工程约定，写成可执行的检查清单（例如：改动前核对 HEAD、新增纯函数+验证脚本、完成标准是本人验收通过、报告存到 `Documents\KnitScape\archives` 等）。这些是后续接手者必须遵守的行为约束。

## 十二、自评（优先级：高）

诚实回答，禁止鼓励式空话：

1. 你实际读了多少？（文件数、行数、跳过了什么、为什么）
2. 本包里逐字核实 vs 推断的比例，给出估算依据。
3. 哪几节最没把握，可能出什么错，后续接手者如何独立验证。
4. 按现状（P0-C0 未完成、工艺问题 UNKNOWN、工作区不干净），单靠这份包，后续接手者能达成什么：可达成（有验证兜底的软件层）/ 有风险（依赖二手信息、验证盲区）/ 不可达成（需工艺确认或实测数据，明确列出是哪几个）。
5. 若只能留一句话给后续接手者，说什么。

## 附加要求

- `src/` 全量文件附带行数（`wc -l`），供估算读取成本。
- 禁止：贴 node_modules、图片、构建产物、整份 results.json；用摘要代替导出签名；编造未验证的结论。
- 文件末尾附"未覆盖范围"：因篇幅/权限/时间没读的东西，逐条列出。
