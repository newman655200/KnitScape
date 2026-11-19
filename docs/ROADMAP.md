# 当前阶段路线与关口

核对日期：2026-10-17。**FACT**：P0已形成软件工作流基线，后续审计发现测量口径差异，工艺定义未完整确认。**SUBJECTIVE / DESIGN DECISION**：以下是后续工作顺序，不是本轮实施清单；本轮只改Markdown，到文档交付即停止。证据、来源六项原则和关口定义见 [PROCESS_VALIDATION.md](PROCESS_VALIDATION.md)。

```text
P0 BASELINE（软件行为，不是生产标定）
    ↓
P0-C0 Correctness Preparation                ← 当前交接阶段
    ↓
PROCESS CONFIRMATION GATE（当前关闭）
    ↓
P0-C1 Canonical Yarn Length
    ↓ Correctness Gate
Architecture Consolidation
    ↓
Material Authority
    ↓
YarnTopology / YarnPath
    ↓
3D Geometry（xyz Centerline → Yarn Mesh）
    ↓
Physical UV / PBR
    ↓
Real Fabric Calibration
    ↓
Conditional Relaxation / Contact
    ↓
Fuzz / High Fidelity → Production-grade Fabric View
```

**PREDICTION**：末端的production-grade是目标，尚无日期或真实效果保证；是否需要relaxation及采用何种模型，要由前面阶段后剩余误差的证据决定。

## BEFORE PROCESS CONFIRMATION

### P0-C0 — Correctness Preparation

允许做以下准备，但都不能借此替工艺作答。未来涉及源码的准备工作需单独任务；本轮仅记录设计/证据。

| 工作 | 可交付内容 | 边界 / 完成标准 |
|---|---|---|
| A. Maintainability Audit | Domain authority、duplicate formulas、Legacy paths、state ownership、renderer fallback、dependency / dead-code清单 | 只审查，不改行为、不全面重构；指出真实消费者和证据，不能据文件名删代码 |
| B. Domain Authority Map | [DOMAIN_AUTHORITY.md](DOMAIN_AUTHORITY.md) | 已覆盖排针、Cam、Machine Domain、K/T/M、FeedYarnAssignment、YarnAsset、Length Target、SolverResult、Preview Metric、Renderer Material、PBR；逐项区分AUTHORITY/DERIVED/LEGACY/UI ONLY/RENDERER ONLY/UNKNOWN |
| C. Yarn Length Observability | 同一份诊断中区分User Target、Current Solver Metric、Full Repeat Diagnostic、Preview Window Metric、Solver Status、Business Validation Status | 目标是看清差异，不是修Solver；业务验证始终PENDING/UNKNOWN。当前UI没有统一展示六项，不冒称已实现 |
| D. Fixture Freeze | 给合成fixture与真实SOP fixture分别标身份、来源、窗口、单位、假设和期望状态 | 冻结已知值及反例，不冻结错误结论；保留文件/hash，不把diagnostic升为production authority |
| E. Measurement Contract Skeleton | [YarnLengthMeasurementDefinition骨架](YARN_LENGTH_CONTRACT.md#target-future-contract--subjective--design-decision) | basis/needleSpan/yarnId/feedScope/pathScope/loadState/startBoundary/endBoundary/normalization/valueType/source/unit/evidence；未知允许UNKNOWN；不改项目schema |
| F. YarnTopology Spike | `MachineDomain → K/T/M → StitchTemplate → YarnSegment → YarnPath` 的接口/数据流架构验证 | 只能验证表达边界；不替换Simulation、不改正式Renderer、不用23/8校准3D、不强迫8收敛；不是新长期运行路径 |

### Fixture Freeze 规则

**FACT — Synthetic Fixture**：P0全K等合成项目、合成PBR图及A–G人工构造的第二纱assignment，用于验证input、solver behavior、unreachable handling、多目标隔离、regression。即使使用真实SOP的Cam，脚本补出的20D分配也仍是诊断假设，不能称生产标定。[P0报告](../reports/p0-final-audit/FINAL_REPORT.md)、[A–G](../reports/yarn-length-semantics-audit-2026-10-16/REPORT.md)

**FACT — Real SOP Fixture / SOP-001**：保存已知机台记录、1234、真实4×8 Cam、原项目30×40、8路主纱23、PBR四图/22.987及源文件。原包无20D、tension为null，不允许文档声称已经填5/4。原包SHA-256：`0d84dd7a3b7d408345015963279e5ea6548d501cbf84887d019a5f538b99eed8`。[项目](../reports/sop-001/SOP-001-N6W6040-main-yarn-with-cam.knitscape)

**SUBJECTIVE / DESIGN DECISION — fixture旁注应允许**：`measurementSemantics=UNKNOWN`、`secondYarnPathSemantics=UNKNOWN`、`loadState=UNKNOWN`。这是未来fixture元数据设计，不表示这些字段已进入现有包。记录100针备注时仍保留具体边界/方法UNKNOWN。

### DO NOT DO YET

以下禁令适用于工艺确认前；来源/单位/原理不完整时，不能通过默认值绕过：

1. 不降低loopHeight bound只是为了让8收敛。
2. 不把5cN / 4cN直接变成geometry force。
3. 不做production relaxation calibration。
4. 不假设20D LOW是Spandex / high-elastic yarn。
5. 不从denier推直径，也不由图像高度、PBR透明区域或肉眼补直径。
6. 不用PBR去掩盖错误centerline。
7. 不把full-repeat自动定义为工厂authority。
8. 不把MODEL_CONVERGED或当前VALIDATED写成PROCESS_VALIDATED。
9. 不新增第二套Renderer。
10. 不全面重构项目，不复制Machine Domain或建立另一套长期Simulation执行路径。

## AFTER PROCESS CONFIRMATION

### 阶段一：P0-C1 — Canonical Yarn Length

先把可追溯的工艺回答和取样资料转成正式 `YarnLengthMeasurementContract`，处理未知项及适用范围，再让下列链条代表**同一个业务定义**：

```text
User Target
    ↓
Canonical Measurement
    ↓
Solver Objective
    ↓
Independent Verification（相同契约、独立实现）
    ↓
UI Acceptance
```

先建立测量窗口/边界反例及独立验证标准，再改有证据需要变更的测量/目标实现；保留P0输入、批量、revision、失败状态回归。工厂容差须有来源，不沿用软件数值容差冒充QC标准。未知物性仍不能补默认“实测”。

### 阶段二：根据答案选择分支

| 分支 | 触发证据 | 后续动作与禁止越界 |
|---|---|---|
| Branch A | 23和8确认同路径、同测量、同状态，canonical定义下8仍不可达 | 先写 **CURRENT SECOND-YARN GEOMETRY MODEL MAY BE INSUFFICIENT**，再设计/验证第二纱geometry model；不能把当前模型局限改写成SOP错误 |
| Branch B | 工艺确认第二纱走不同路径 | 进入 **Independent Second-Yarn Path / Placement Model**；不要共用主纱topology，不仅加一个parallel偏移 |
| Branch C | 工艺确认有预牵伸/回缩 | 区分 **Feed Length / Loaded Length / Relaxed Length**；收集转换关系与测量依据，不能只用一个loopHeight解释 |

这些是条件设计，不能现在代选。B与C可能同时成立；若答案揭示其他机制，记录证据后补充设计，不把所有情况硬塞入某一分支。

### 阶段三：重新跑SOP-001

要求 canonical length、independent verification、Feed × Yarn关联、failure state、source mapping、repeat boundary全部一致；明确主/副纱是否已真正录入并生效。独立复算必须测最终实际应用的几何，失败slot候选不当作显示值。工艺/机台验证另以同状态真实记录判断，不以UI的VALIDATED代替。

Correctness Gate未通过前不跳到主路线。完整SOP不能用“主纱通过、第二纱失败但画面存在”验收；若仅交付受限模型范围，需显式记录范围和未解决项。[关口定义](PROCESS_VALIDATION.md#两个关口--subjective--design-decision)

## 通过Correctness Gate后的主路线

以下均为 **SUBJECTIVE / DESIGN DECISION**，不是当前能力声明。Architecture Consolidation只做有证据的边界收敛，保持单一Machine authority，不做全仓重写。

| 顺序 | 阶段 | 进入/完成要求 |
|---|---|---|
| 1 | Material Authority | 明确YarnAsset / FeedYarnAssignment ownership；审查当前未提交resolver与Legacy兼容，字段来源可见；不把材料属性和使用参数混放 |
| 2 | YarnTopology / YarnPath | `Machine Domain → K/T/M → StitchTemplate → YarnSegment → YarnTopology → YarnPath`；明确主/第二纱路径及稳定身份，Renderer不解释工艺 |
| 3 | 3D Centerline | 真正xyz yarn path；含可核验的连接与空间关系，不把XY分层称3D |
| 4 | Yarn Mesh | 基于centerline与有来源的直径/截面生成厚度mesh；UNKNOWN参数不得伪装实测 |
| 5 | Physical UV | 依据物理路径累计长度计算U；明确长度参考状态、纹理repeat来源与单位 |
| 6 | PBR | Albedo、Normal、Roughness、AO、Metallic(optional)；资源就绪/采用与metadata区分；不遮盖几何错误 |
| 7 | Real Fabric Calibration | 使用有来源的Gauge、real dimensions、yarn diameter、fabric measurements；控制材料批次、负载/静置、finish后状态和尺度 |
| 8 | Relaxation / Contact（条件性） | 前面正确且仍有明确证据需要时才加入；先有材料曲线/接触与测量约束，不直接把张力记录当力学边界 |
| 9 | Fuzz / High Fidelity Rendering | 最后做；用规定尺度、光照与实物对照验证外观，再讨论production-grade表现 |

**INFERENCE**：当前Machine Domain、项目资产与Feed数据提供可继续演进的基础，现有证据不要求全盘推倒；也没有证据保证只补PBR或relaxation足够。当前未提交的Material Authority工作不得因为路线重新排序而回滚或覆盖，须留待后续明确任务复核。
