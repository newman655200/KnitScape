# KnitScape 当前架构与边界

核对日期：2026-10-17（Asia/Shanghai）。**FACT**：当前分支 `main`，HEAD `7ababf264d495f6b96d4d66652c529424938ac4d`，另有开工前已存在的未提交材料解析改动。本文描述当前工作区，不把 HEAD、历史报告和未提交实现当成同一快照。

**当前阶段（2026-11-20）**：10-20 SOP-001 工艺已确认，纱长已闭合（16 槽收敛）；当前关口是**三维算法重新设计**（2026-11-21 三维代码已全部移除，旧实现见 `fc56f2b`），见 [NEXT_TASK](NEXT_TASK.md)。旧的 `P0-C0` 阶段已过时。P0 是软件工作流基线。证据分类、物理数据来源原则统一见 [PROCESS_VALIDATION.md](PROCESS_VALIDATION.md)。本轮只收敛文档，下面的未来层不表示已经开发。

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

## 当前真实执行链 — FACT

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

当前工作区已支持 Asset 可选 color/diameter、Metallic 和逐纱直径解析；这是开工前已有实现，不能只依据旧报告宣称仍完全缺失，也不能据此宣称迁移已验收。`source` 标记 `ASSET / LEGACY_FALLBACK / DEFAULT` 是运行时选择来源，不是物理测量 provenance。默认 `0.24` 是未标定模型单位，真实 yarn diameter 为 **UNKNOWN**。

证据：[resolver](../src/domain/yarnMaterial.js)、[资产规范化](../src/domain/yarnLibrary.js)、[材质适配](../src/simulation/yarnTextureBrush.js)、[逐纱几何](../src/simulation/yarnSimulation.js)。当前 Legacy 的精确适用条件见 [LEGACY_MAP.md](LEGACY_MAP.md)，不能直接删除 fallback。

## 当前能力上限 — FACT / UNKNOWN

- **FACT**：中心线是 XY，WebGL 顶点为 `vec2` 且 Z=0；翻面是层序/镜像展示。当前是 2D layered preview，不是真实 3D 物理织物模型。[shader](../src/simulation/yarnUvWebglRenderer.js)
- **FACT**：tensionCN 可记录/保存，但没有力学消费；placement 字符串也不选择独立 topology。当前没有受力、接触、摩擦、压缩或 relaxation 求解。
- **FACT**：Solver/UI 的周期化有限窗口平均，与完整 repeat 独立复算存在差异；`VALIDATED` 只检查当前软件结果与应用条件。[长度契约](YARN_LENGTH_CONTRACT.md)
- **UNKNOWN / PENDING PROCESS CONFIRMATION**：23/8 的具体取样方法、两纱实际路径与 Feed/负载关系；真实直径、材料曲线和实物标定数据。

## 未来边界 — SUBJECTIVE / DESIGN DECISION

工艺确认和 Canonical Yarn Length 之后，才按 [ROADMAP.md](ROADMAP.md) 推进：`Machine Domain → K/T/M → StitchTemplate → YarnSegment → YarnTopology → YarnPath → xyz Centerline → Yarn Mesh → Physical UV → PBR`。当前内部 ProcessModel/YarnModel 图不等于这个未来公共接口已经存在。

**PREDICTION**：未来有来源的材料和实物测量可能要求扩展几何表示；尚不能预测必须采用哪种物理求解器，也不能保证仅改材质或加 relaxation 就能复现真实布面。

取值、单位、来源、测量/推导原理、置信度、适用状态六项要求适用于以上全部物理输入；未知项保持 UNKNOWN。完整审计及文档冲突见 [本轮报告](../reports/doc-alignment-2026-10-17/REPORT.md)。
