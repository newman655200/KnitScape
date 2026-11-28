# KnitScape 当前架构与边界

核对日期：2026-11-25（Asia/Shanghai）。**FACT**：分支 `main`；本次代码核对基线为 R1-3 提交 `78ecf8f0758c98ffa038c69003f1d3037a7d88f4`。本文在随后 R1-4 文档提交中更新；历史报告的 HEAD、工作区状态和验收结果仍只代表各自记录时点。

**当前阶段（2026-11-25）**：SOP-001 工艺已确认，纱长已闭合（16 槽收敛）。2026-11-21 移除了此前的三维试验实现；随后建立了独立的 T1 普通纬平针周期求解器，并完成本轮 R1 结构重构。当前实现与扩展边界见下文“Layer 3：fabricForm”和 [NEXT_TASK](NEXT_TASK.md)。R1 保持既有物理模型、数值算法、默认值和结果结构，不表示 T2 氨纶、T3 集圈或罗纹几何已经实现。证据分类与物理数据来源原则统一见 [PROCESS_VALIDATION.md](PROCESS_VALIDATION.md)。

## 工艺权威与消费者

**SUBJECTIVE / DESIGN DECISION — 目标边界**：

```text
Machine / Process Truth（有来源、单位、状态的工艺事实）
    ↓ 明确转录与待确认项
Machine Domain（排针、Cam、K/T/M）
    ↓
Yarn Topology
    ↓
Geometry
    ↓
Renderer
```

2D / Machine Domain 承担软件中的离散工艺规则权威；3D Renderer 是消费者，不得重新定义排针、Cam、Feed 或长度规则。这里的“2D”指工艺组织与机器动作表达，不是把二维外观预览提升为实机真值。软件内部 K/T/M 一致，也不自动证明机台针踵起点、Feed 方向或两纱路径已验证。

## 二维仿真执行链 — FACT

```text
Pattern / Repeat → generateChart() → chart → 排针前 simulate()

Needle Arrangement + singleJerseyCamProgram.tracks
    ↓ createSingleJerseyExecutionInput() 调用
resolveSingleJerseyOperations()                 ← 唯一机器动作计算
    ↓ K/T/M 矩阵
createSingleJerseySimulationInput()             ← K/M/T → 0/2/3
    ↓
runSimulation() 调度排针后 simulate()
    ↓
Pattern / ProcessModel / YarnModel → XY 路径模板
    ↓ 每 Feed × Yarn 的有界 loopHeight 求解、成功路径应用
分层 ribbon / stroke → front / mid / back → Canvas / WebGL
```

入口与证据：[Machine Domain](../src/domain/singleJerseyMachine.js)、[调用包装](../src/components/singleJerseyExecutionInput.js)、[Adapter](../src/adapters/singleJerseySimulationInput.js)、[调度](../src/components/runSimulation.js)、[Simulation](../src/simulation/yarnSimulation.js)。调用包装先调用 Domain，再将其输出交给 Adapter；不能把文件依赖列表误读为第二套执行逻辑。

Pattern / Repeat、Needle Arrangement、Cam Program 保持独立。排针不改 Pattern；Cam 不向 Pattern 写机器结果。Simulation 消费 Adapter 输出，不解释 Cam/排针规则。软件 Feed 是 Cam 列的循环角色，course 按 `row % feedCount` 对应；与 SOP 的 96 个生产口如何对应仍待工艺确认。

## Layer 3：fabricForm

**FACT — R4 后的当前实现（2026-11-28）**：`fabricForm` 是独立的 T1 普通纬平针周期求解链。Machine Domain 负责从 Cam 和排针计算动作；二维仿真与 Layer 3 分别消费机器动作。R4 已将自由度块布局、通用求解核心与 T1 结果适配器分开；本轮没有改变物理模型、数值算法、二维渲染或 UI，也没有实现截面自由度、T2 氨纶或其他新物理。

```text
K/T/M 动作矩阵：resolveSingleJerseyOperations()   唯一机器动作权威
    ↓
topology/knitGraph.js::compileKnitGraph()        纯拓扑，无几何坐标
KnitGraph
    ↓
topology/discretize.js::discretizeKnitGraph()    消费 StitchTemplate
兼容既有接口的 topology 对象
    ↓
fabricFormInitialGeometry.js                   按模板 ID 关联种子曲线
Cell { positions, W, H, S, topology }
    ↓
solveFabricCell.js                             T1 校验、锁定、初值及报告选择
    ├─ model/t1PlainJerseyModel.js             T1 各项、约束与默认报告
    │    ├─ model/fabricModel.js               按登记顺序组合，提供 createLayout
    │    ├─ model/dofLayout.js                 块声明、缩放、平衡判据及命名索引
    │    └─ model/kernelView.js                内核局部向量 ↔ 全局布局
    ├─ solve/solveFabricModel.js               通用核心 ↔ constrainedOptimizer.js
    └─ model/t1Reporting.js                    将核心原始结果格式化为 T1 兼容结果
```

| 模块 | 职责与边界 |
|---|---|
| [compileKnitGraph](../src/fabricForm/topology/knitGraph.js) | 记录每路纱线的材料次序、K/T/M 动作、成圈与集圈弧，以及带整数周期偏移 `(p, q)` 的穿套引用。不含坐标、离散节点数或长度。 |
| [discretizeKnitGraph](../src/fabricForm/topology/discretize.js) | 消费图中的穿套关系和模板交叉签名，建立节点、边、弯曲连接及既有 topology 结构。当前仅接受全 K、每路单纱；T、M 和同路多纱仍抛出兼容的 `UNSUPPORTED_IN_STEP1` 错误。 |
| [StitchTemplate](../src/fabricForm/topology/stitchTemplates.js) | 保存 `stockinette-sabetta` 的交叉字 `[-1,-1,1,1]`、方向、相邻针偏移、交叉约定及种子出处。这些属于初值嵌入签名。 |
| [初始几何](../src/fabricForm/fabricFormInitialGeometry.js) | 以模板 ID 关联既有参考曲线，执行原有重采样与材料长度归一化。参考曲线数值和返回结构保持不变；种子仍须通过接触可行性检查。 |
| [FabricModel](../src/fabricForm/model/fabricModel.js) | `createFabricModel({ id, terms, constraints, blocks })` 按登记顺序组合能量项、约束、步长上界和只读诊断；通过同一 `createLayout(cell)` 向各回调提供布局上下文。梯度及 Jacobian 行须匹配全局布局长度；所有项均可行时，组合结果才可行。 |
| [T1 model](../src/fabricForm/model/t1PlainJerseyModel.js) | 依次登记 `bending`、`contact` 和 `segmentLength`，挂载默认 T1 报告适配器。导出 `T1_DOF_BLOCKS`、`createT1Terms()`、`createT1Constraints()` 供组合；包装层映射向量，原有物理内核保持不变。 |
| [DofLayout](../src/fabricForm/model/dofLayout.js) | `createDofLayout(cell, blocks = T1_DOF_BLOCKS)` 按声明顺序建立连续、有名字的块，校验长度、`scaleKind` 和平衡判据，提供 `pack`、`unpack`、`index`、`freeIndices`。默认仍为 positions、lattice 两块及 W/H/S 顺序；positions 仍为数组的数组。 |
| [solveFabricCell](../src/fabricForm/solveFabricCell.js) | T1 入口保留输入校验、锁定处理、初值和精确锁值回写；用 `model.createLayout(initial)` 与通用核心连接，选择 `model.reporting ?? createT1Reporting()` 格式化结果。省略 model 时创建默认 T1 model。 |
| [通用求解核心](../src/fabricForm/solve/solveFabricModel.js) | `solveFabricModel()` 按块缩放并检查全部块的收敛，调用未改动的优化器，返回终态、约束反力、各块平衡结果、步长保护计数及观察器状态。核心不读取 T1 项详情或 W/H/S；T1 报告保留原判据，并将额外块结果纳入最终状态。 |
| [内核视图](../src/fabricForm/model/kernelView.js) | `createKernelView(layout, blockNames, componentOrders)` 按块名和分量顺序校验映射；`scatter(local)` 将局部梯度或 Jacobian 行散射到全局，`gather(global)` 将全局方向收集为局部。使用 `set/subarray` 整块复制，保留 −0 和 NaN 字节，其余全局分量为 +0。 |
| [T1 结果适配器](../src/fabricForm/model/t1Reporting.js) | `createT1Reporting({ bendingTermId, contactTermId })` 提供 `createObserver(params)`、`formatInfeasible(raw, context)`、`formatResult(raw, context)`。按配置 id 读取项详情及诊断，保留 T1 能量分项、间隙、势垒、轨迹保护、返回键序和原算式。观察器记录可行初值及所有优化器试算，不记录终态重新求值。 |

**组织拓扑只在 `compileKnitGraph` 中解释。** 每根针持有自上次成圈以来累积的线圈与集圈弧；K 穿过全部持有项后重置为新线圈，T 追加集圈弧，M 保持持有项不变。离散化、初值、求解器和渲染不得各自重算这套规则。Cam 与排针如何产生 K/T/M，仍由 Machine Domain 唯一决定。

`createPlainJerseyTopology()` 保留原入口，内部依次调用机器动作计算、图编译和离散化；`replicatePeriodicCell()` 继续使用该入口。`evaluateFabricCell()`、`packFabricCell()` 和 `unpackFabricCell()` 的旧接口也保留。`solveFabricCell()` 的可选 model 可以组合 T1 各项、新块及新项，并提供自己的报告适配器；没有 reporting 时使用默认 T1 格式。**入口的参数校验、初值和锁定仍属于 T1**，默认报告仍要求配置 id 对应的 T1 项详情；通用核心解耦不等于入口已经支持任意无关物理模型。

后续扩展须有独立任务书，并遵守物理数据来源要求：

- **新增自由度块**：向 model 的 blocks 传入块声明，给出唯一 name、`length(cell)`、`read/write`，以及必填的 `scaleKind` 和 equilibrium；需要时声明 components、translation。`scaleKind` 为 length 或 dimensionless，平衡判据为 maxAbs 或带命名共轭映射的 conjugateLength。构造时拒绝未声明平衡判据的块；全部块进入优化器收敛及终态平衡检查，无须修改求解器或优化器。生产 T1 当前仍只有 positions、lattice 两块。
- **新增读写新块的能量项**：实现 `EnergyTerm` 并在 model.terms 登记，声明内核视图所需块名和分量顺序。局部梯度通过 scatter 进入全局布局；需要步长保护时，将全局方向 gather 后交给内核。`evaluate(cell, ctx)` 返回能量、长度为 `ctx.layout.size` 的梯度及 details，feasible 省略时为 true；能量和梯度仍按登记顺序累加。需要时提供 safeStep 和 diagnose，不复制已有 T1 各项。
- **新增结果格式**：给 model.reporting 提供 `createObserver(params)`、`formatInfeasible(raw, context)` 和 `formatResult(raw, context)`；观察器通过 observe 接收求值、通过 snapshot 提供状态。格式化使用核心返回的原始结果及各块平衡结果，不遗漏新增块的残差。T1 项仅改名时，可复用 `createT1Reporting({ bendingTermId, contactTermId })`。
- **新增约束**：实现并登记 `Constraint`，返回 values、jacobian 和 maxStrain。残差与 Jacobian 行按登记顺序拼接，局部行经内核视图 scatter 后遵循全局布局；当前 maxStrain 仍表示材料应变，扩展须遵守这些语义。
- **新增针法模板**：把交叉签名、约定和种子出处登记为模板，并关联所需种子曲线及相应离散、几何支持。当前离散器可以显式接收模板，但兼容入口和初始几何仍固定选择 `stockinette-sabetta`。模板接口本身不表示 T/M、多纱或罗纹几何已经可用。

**内核局部布局与模型全局布局约定**：`periodicCell.js`、`rodBending.js`、`periodicContact.js`、`yarnContact.js` 保留原有物理逻辑。内核向量约定为 `[positions(3N)..., W, H, S]`；其中 `3N+3` 长度、末尾 W/H/S 偏移是内核自身的接口，不限制 model 的全局块顺序。T1 包装层使用 `["positions", "lattice"]` 内核视图，散射梯度和每行 Jacobian、收集步长方向。details 保留原始内核对象及局部数组；因此报告中的 barrierGradient 按局部布局索引，约束反力按全局布局索引。新增块无需迁移或修改这些内核。

**R1 遗留项状态**：第 1 项“自由度布局硬编码”和第 2 项“求解器依赖 T1 详情”已由 R4 关闭；第 3 项“金标准绑定 Node v20.17 / win32 及重建基线流程”、第 4 项“金标准脚本默认归档路径写死”仍未处理。R4 使用显式 `--archive-dir`，没有修改金标准基线或默认路径。

验证入口包括 `validate:fabric-form-solver-math` 的 dofLayout/model 检查组、`validate:fabric-form-golden-eval`、`validate:fabric-form-topology-equivalence` 和单独执行的 `golden:fabric-form-solve`。完整求解比较仅排除 `diagnostics.elapsedMs` 和归档 runner 的顶层 closeout，其余完整 JSON 必须相同；任务范围、固定新增检查与停止条件见 [R4_DOF_DECOUPLING_TASK](R4_DOF_DECOUPLING_TASK.md)，历史重构任务见 [R1_REFACTOR_TASK](R1_REFACTOR_TASK.md)。

## 状态与持久化 — FACT

| 层 | 当前内容 | 保存边界 |
|---|---|---|
| Project facts | Pattern/repeats、palette/sequence/plies、YarnAsset、Cam/Feed assignments/targets、排针、Gauge | `getProjectData()` 与 package 字段白名单 |
| Derived | Machine operations、几何、SolverResult、PreviewValidity、统计与缓存 | 不作为项目事实保存 |
| UI / runtime | pending Yarn、搜索、批量选择/草稿、`feedYarnStructureRevision`、面板状态 | 不作为项目事实保存 |

上述数据部分仍共处 `GLOBAL_STATE`；逻辑 ownership 不等于已经物理拆分 State。项目包已有 `format=knitscape, version=2`，机器字段已可保存/导入。旧 Pattern-only JSON 的兼容加载会保留现有 Machine/Library；`newPattern()` 也不等于清空整个项目。不得未经设计改动这些兼容行为。

证据：[export 白名单](../src/actions/exporters.js)、[package](../src/actions/projectPackage.js)、[import / newPattern](../src/actions/importers.js)、[State revision](../src/state.js)。完整含 Cam 项目替换会重建运行时 revision，不能从导入文件恢复旧批量选择身份。

## 材质是另一条输入链 — FACT

```text
Feed.yarns[slot].yarnId → 项目 YarnAsset
    ↓ resolveYarnMaterial({ yarnAsset, legacyContext })
Asset 字段 / 明确 Legacy fallback / 软件默认值
    ↓ resolveFeedYarnPlies()
逐纱 diameter profile → 几何与 Solver
color / PBR / physicalRepeatLengthMm → 绘制与 UV
```

二维工作流已有 Asset 可选 color/diameter、Metallic 和逐纱直径解析；不能只依据旧报告宣称这些能力仍完全缺失，也不能据此宣称物理标定已验收。`source` 标记 `ASSET / LEGACY_FALLBACK / DEFAULT` 是运行时选择来源，不是物理测量 provenance。默认 `0.24` 是未标定模型单位，真实 yarn diameter 为 **UNKNOWN**。

证据：[resolver](../src/domain/yarnMaterial.js)、[资产规范化](../src/domain/yarnLibrary.js)、[材质适配](../src/simulation/yarnTextureBrush.js)、[逐纱几何](../src/simulation/yarnSimulation.js)。当前 Legacy 的精确适用条件见 [LEGACY_MAP.md](LEGACY_MAP.md)，不能直接删除 fallback。

## 当前能力上限 — FACT / UNKNOWN

- **FACT**：二维工作台的中心线是 XY，WebGL 顶点为 `vec2` 且 Z=0；翻面是层序/镜像展示。该工作台是 2D layered preview。[shader](../src/simulation/yarnUvWebglRenderer.js)
- **FACT**：二维工作台中的 tensionCN 可记录/保存，placement 字符串不选择独立 topology。独立 T1 `fabricForm` 已有弯曲、周期接触、段长约束和周期平衡求解；本轮未增加氨纶、集圈几何、摩擦模型或二维 UI 到该求解器的新入口。
- **FACT**：Solver/UI 的周期化有限窗口平均，与完整 repeat 独立复算存在差异；`VALIDATED` 只检查当前软件结果与应用条件。[长度契约](YARN_LENGTH_CONTRACT.md)
- **FACT**：SOP-001 的 23/8 cm/100机针已确认是拆纱放松实测，牵伸倍率为 3.0；见 [长度契约](YARN_LENGTH_CONTRACT.md) 顶部生产确认。**UNKNOWN**：真实纱径、材料曲线、两纱实际路径与尚未确认的 Feed/负载关系及实物标定数据。

## 后续边界 — SUBJECTIVE / DESIGN DECISION

上文 Layer 3 是当前已经实现的 T1 计算链。更完整的 YarnSegment / YarnPath、Yarn Mesh、Physical UV 与 PBR 消费链仍属于后续设计，不能把二维内部 ProcessModel/YarnModel 图或本轮模板接口等同于完整公共接口已经实现。后续方向以 [NEXT_TASK](NEXT_TASK.md) 和相应任务书为准。

**PREDICTION**：有来源的材料与实物测量可能要求扩展模型和几何表示；当前 T1 平衡不预设等同于真实干燥放松状态，也不能保证只改材质或增加一个能量项就能复现实物布面。

取值、单位、来源、测量/推导原理、置信度、适用状态六项要求适用于全部物理输入；未知项保持 UNKNOWN。2026-10-17 的文档审计属于历史快照，见 [历史提交中的报告](https://github.com/newman655200/KnitScape/blob/24c51b908b00f0386c61b068f4242e1f5898bc6a/reports/doc-alignment-2026-10-17/REPORT.md)。
