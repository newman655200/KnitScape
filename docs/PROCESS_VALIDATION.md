# Process Validation 与证据原则

阶段核对日期：2026-11-20（Asia/Shanghai）。**FACT**：2026-10-20 已收到 SOP-001 生产确认，PROCESS CONFIRMATION GATE 已对 SOP-001 打开（见下文 Q1–Q7 及 [YARN_LENGTH_CONTRACT](YARN_LENGTH_CONTRACT.md) 顶部）；16 槽纱长已收敛。**当前关口**：三维几何验收，未通过，条件见 [NEXT_TASK](NEXT_TASK.md)。本文下方“P0 BASELINE”“SOP-001 已知记录”等节保留 2026-10-17 的原始描述作为历史，凡与本段或 Q1–Q7 回答冲突的，以本段及 10-20 确认为准。

## 所有交接文档共用的证据分类

| 标签 | 使用要求 |
|---|---|
| FACT | 当前源码、文件或已记录实验直接证明；写明快照、条件、证据 |
| INFERENCE | 从事实推导；说明范围，不升级为实测事实 |
| PREDICTION | 对未来结果的预测；不作为当前验收依据 |
| SUBJECTIVE / DESIGN DECISION | 阶段命名、路线、接口骨架和取舍；不暗示已实现 |
| UNKNOWN / PENDING PROCESS CONFIRMATION | 信息缺失或等待工艺回答；保留未知，不代答 |

历史报告中的 HYPOTHESIS 在当前交接中归为待验证候选，按 UNKNOWN 管理；不是FACT。历史报告保留原文，冲突和适用时间见 [本轮审计](../reports/doc-alignment-2026-10-17/REPORT.md)。

## 四类验证不能互换

| 类别 | 能证明什么 | 当前证据与限制 |
|---|---|---|
| MODEL VALIDATION | 指定数学模型、参数、测量函数下的数值行为 | Solver确实优化其有限窗口函数；与完整repeat有已知差异；不能称模型已全面正确 |
| SOFTWARE REGRESSION | 输入、状态、目标隔离、失败反馈、应用及兼容行为的既有断言 | P0 Final Audit为CONDITIONAL PASS；历史36/36、后续37/37；不覆盖所有测量反例 |
| PROCESS VALIDATION | 软件定义是否符合工艺操作、取样、Feed与状态 | **SOP-001 测量语义已确认（2026-10-20）**；软件纱长目标已按“放松实测 × 牵伸倍率”对齐。三维弧长尚未与参考值对照，仍无生产等价性结论 |
| REAL MACHINE VALIDATION | 对明确机台、材料批次、测量程序与实物数据的对照 | 尚未建立真实23/8与当前模型一致的验证；不能由npm PASS替代 |

**FACT**：当前 `PreviewValidity.VALIDATED` 仅表示必要目标匹配当前结果、CONVERGED、converged=true、applied=true、有限误差在软件容差内；它没有独立复算最终repeat，没有核实SOP取样状态。[实现](../src/simulation/previewValidity.js)

`MODEL_CONVERGED` 与 `PROCESS_VALIDATED` 在本文是不同语义标签；前者对应软件模型收敛，后者必须有工艺验证证据。它们不是本轮新增的枚举或UI字段。禁止将两者互相改写。

## P0 BASELINE：完成了什么、没有证明什么

**FACT**：[P0 Final Audit](../reports/p0-final-audit/FINAL_REPORT.md) 与 [baseline报告](../reports/p0-baseline-20261007-210704/BASELINE_REPORT.md) 支持以下软件行为：

- `SolverResult` 与 `PreviewValidity` 派生、发布及结果应用标记；失败候选不会冒充当前已应用路径。
- 统一合法/非法输入保护、明确Clear、`UNREACHABLE_TARGET` 与失败反馈。
- Feed × Yarn 独立目标和批量目标修改的原子预检；不是把材质分配和长度批改当成同一个动作。
- `feedYarnStructureRevision` 保护删除重建、同ID槽位移动、完整项目重载后的旧选择；相关regression validators已存在。
- 项目事实的保存/恢复与运行时派生数据排除。

**FACT**：P0曾先有总体审计FAIL（旧批量选择身份问题），后有P0-4B修复及Final Audit的CONDITIONAL PASS；不能只挑一份旧报告描述当前阶段，也不能把CONDITIONAL PASS改成无条件生产通过。

**UNKNOWN**：P0没有证明工厂23cm/100针与当前Solver数学测量定义一致，没有证明20D LOW的8可由同一几何模型解释，没有完成真实机台或实物生产精度标定。后续语义反例没有抹去输入/状态保护的价值，也没有被P0回归全绿排除。

## SOP-001 已知记录 — FACT

证据：[工艺图副本](../reports/sop-001/with-cam/source-process-sheet.jpg)、[with-cam报告](../reports/sop-001/with-cam/REPORT.md)、[语义审计](../reports/yarn-length-semantics-audit-2026-10-16/REPORT.md)。下表是 2026-10-17 的资料转录及软件保存事实，不是重新做的实机测量；“待答/未知”处已由 10-20 确认更新，见括注及下文 Q1–Q7。

| 项目 | 资料值 / 当前保存事实 | 边界 |
|---|---|---|
| Machine | Single Jersey，32英寸，32G，3216 needles | 32英寸/3216为工艺记录；无完整圆筒机台几何 |
| Arrangement | 1234 | 已保存[1,2,3,4]；物理针踵基准仍宜确认 |
| Cam | 4 Needle Types × 8 Feed，24K/8T/0M | Type1=KKKKKKTT；Type2=KKKKTTKK；Type3=KKTTKKKK；Type4=TTKKKKKK |
| 主纱 | N6/W(6040)，23cm/100 machine needles | 保存包8个Feed各一项主纱23；（10-20：拆纱放松实测） |
| 第二纱 | 20D LOW，8cm/100 machine needles | 10-17 原包中无此Asset；（10-20：确认为20D裸氨纶，牵伸3.0；SOP-restored-23-8x3-retest 包已含 8 路双纱 16 槽） |
| Tension records | 主纱5cN，第二纱4cN | （10-20：张力实测记录，不是测量负荷，不进 geometry）；保存包实际tension=null |
| Feed关系 | 工艺两纱行均列组织编号1–8、96口 | （10-20：两纱均在 Feed1–8，同 Feed 共享 K/T/M 拓扑）；三维空间排布未知 |
| 局部预览 | 原项目30针×40行 | 不等于3216针整机或稳定完整生产循环 |

**FACT**：tensionCN可保存/规范化，当前Simulation、Solver、Geometry不读取为力学输入。分类为 **PROCESS RECORD**，不是 **ACTIVE SIMULATION PARAMETER**；携带整个feeds对象并不意味着每个字段都生效。[规范化](../src/actions/singleJerseyCamProgram.js)、[几何审计§G](../reports/real-sop-geometry-gap-audit-2026-10-16/REPORT.md)

## PROCESS QUESTIONS PENDING

（标题保留以免旧链接失效。）2026-10-20 生产部门已回答，来源见 [YARN_LENGTH_CONTRACT](YARN_LENGTH_CONTRACT.md) 顶部。Q1、Q2、Q4、Q5、Q7 已确认；Q3（静置标准）、Q6（三维空间排布）为部分确认。未回答的细节继续保留 UNKNOWN，不用程序默认值代答。

| 编号 | 问题 | 当前回答 |
|---|---|---|
| Q1 | **23cm / 100 needles实际怎么测？**请说明取样步骤、起止机针、从哪里取纱/读数及连接段处理。 | **CONFIRMED 2026-10-20**：从同一块织物 100 机针对应范围拆出，松弛、不紧绷直接测量。放松时长、仪器校准、端部连接归属未提供 |
| Q2 | **8cm / 100 needles实际怎么测？是否与23完全相同？**若有不同，逐项说明取样路径、边界、仪器与归一化。 | **CONFIRMED 2026-10-20**：与 23 同一方法；8 为 20D 裸氨纶拆纱放松长度，不是织造受力态长度 |
| Q3 | **测量时带负载、解除张力还是回缩后？是否有静置标准？**分别说明两纱；5/4cN是否测量负荷也需确认。 | **PARTIAL**：两纱都是拆出后放松、不紧绷测量；5/4 cN 是张力实测记录，不是测量负荷。静置标准未提供 |
| Q4 | **20D LOW真实纱种是什么？是否有弹性、预牵伸、送纱倍率？**需要材料来源与具体状态，不能只凭名称。 | **CONFIRMED 2026-10-20**：20D 裸氨纶（弹性纱），由专用弹力送纱装置供给；实际牵伸倍率 3.0（正常 2.8–3.2，极限 3.6） |
| Q5 | **N6/W与20D LOW是否都进入Feed1–8，还是部分Feed/独立Feed？**说明8路循环与96口的关系、方向/起点。 | **CONFIRMED 2026-10-20**：两纱都在 Feed1–8；1–8 路为最小完整工艺周期，96 = 8 × 12，96 口与三角座一一对应 |
| Q6 | **两纱是否走完全相同knitting path？**还是plating、laid-in、covering、partial needle path或other special feeding？请给路径或操作说明。 | **PARTIAL**：同 Feed 共存的纱共享该 Feed 的 K/T/M 动作拓扑；不要求三维中心线完全重合。具体空间排布（如添纱位置）未给出 |
| Q7 | **SOP的23和8分别属于machine setpoint、actual measured、QC target还是other？**两值可能类型不同；需要来源、阶段及允许误差依据。 | **CONFIRMED 2026-10-20**：23 与 8 均为 actual measured（拆纱放松态）；24 = 8 × 3.0 为织造态参考（派生值）；抽样 QC ±2% |

**SUBJECTIVE / DESIGN DECISION**：回答记录应附回答者/职责、日期、对应SOP版本/位置、示意或实际步骤、原始测量与适用状态；答案不完整时保留对应UNKNOWN，不能只勾“七问完成”。七问主要澄清测量语义、第二纱路径、Feed关系、负载/张力状态和数值类型；不会自动提供diameter、弹性曲线、摩擦、压缩、relaxation、finish后状态或PBR视觉参数。

## 统一物理数据来源原则 — SUBJECTIVE / DESIGN DECISION

任何影响物理结果的数据，在文档、fixture和未来契约中至少能回答六项；本轮不改现有项目schema：

| 必需项 | 要求 |
|---|---|
| Value | 原始值，未知显式UNKNOWN；不由fallback生成伪实测 |
| Unit | 原始单位和换算；区分cm/100机针、mm、cN、model unit、pixel |
| Source | SOP位置、文件/批次、回答者或测量记录；可追溯 |
| Measurement / derivation principle | 操作步骤、仪器/校准或推导公式与前提 |
| Confidence | 确认/转录/有条件推导/未确认；不编造概率 |
| Applicable state | 机上/带载/卸载/回缩/静置/finish后等及环境条件 |

合法的不完整记录例：`Value=23; Unit=cm/100 machine needles; Source=SOP-001主纱栏; Principle=PENDING; Confidence=资料转录确认、工艺等价性未确认; Applicable state=PENDING`。缺方法不等于可以猜方法。

| 数据 | 已知来源 / 原理 | 置信度与适用状态 |
|---|---|---|
| 32G → 0.79375mm针距 | SOP Gauge；当前软件25.4/G换算 | 代码换算已确认；模型机针标尺，非松弛布面wale距 |
| 23 / 8cm每100机针 | SOP对应两纱行及100针备注；2026-10-20 生产确认 | 拆纱放松实测（PROCESS MEASURED）；氨纶织造态参考 24 = 8 × 3.0；放松时长等细节仍缺 |
| 5 / 4cN | SOP张力记录栏；2026-10-20 确认为张力实测记录 | 不是测量负荷；不进 geometry（activeInGeometry=false） |
| 真实yarn diameter | 无有效实测记录 | **UNKNOWN**；不能由20D、图像高度、透明区域或肉眼推断 |
| 默认diameter=0.24 | 软件模型/保存项目Legacy primary | 软件值已确认；未标定；不等于真实mm直径 |
| PBR五图 | `PBR/Yarn1` Albedo/Normal/Roughness/AO/Metallic | 文件存在及2172×724尺寸已确认；不是材料物性测量 |
| 2400DPI | 既有SOP报告记录的用户扫描说明 | PNG没有pHYs，未由文件元数据独立证明；原始采集/未重采样前提仍需凭据 |
| physicalRepeatLengthMm=22.987 | 2172 / 2400 × 25.4 | **有条件推导**；原图未重采样且DPI为真实采集DPI时，指纹理横向物理重复长度，沿纱路径用于U |
| 弹性/摩擦/压缩/finish等 | 尚缺对应测量或材料资料 | **UNKNOWN**；七问回答不自动补全 |

**FACT**：五张PNG均为2172×724且无pHYs；原SOP with-cam包只含Albedo、Normal、Roughness、AO四图，Metallic为空。当前工作区已加入Metallic支持，不等于原包自动升级。[PNG证据](../reports/sop-001/pbr-png-metadata.json)、[manifest](../reports/sop-001/with-cam/project-export.manifest.json)、[当前map枚举](../src/yarnTexture/yarnScanTexture.js)

**INFERENCE（有条件）**：22.987mm只标定沿纱路径的纹理U重复；724像素的扫描高度、alpha前景宽度及GPU上传重采样尺寸均不能用来替代真实yarn diameter。PBR效果不能修复错误中心线或未应用的8cm目标。

## 两个关口 — SUBJECTIVE / DESIGN DECISION

**PROCESS CONFIRMATION GATE：对 SOP-001 已 OPEN（2026-10-20）。** 测量语义、牵伸倍率和 QC 标准已有可追溯答案（`PROCESS_MEASUREMENT_CONTRACT=ESTABLISHED_FOR_SOP001`）。Q3 静置时长、Q6 空间排布、真实纱径等仍为 UNKNOWN，不把这次确认当成所有物性已知。

**Correctness Gate：纱长部分已通过，三维几何部分 NOT PASSED（2026-11-20）。** 16 槽纱长按已确认语义收敛；剩余的是用最终三维几何独立验证，即 [NEXT_TASK](NEXT_TASK.md) 的四条验收。以下为原定义： P0-C1需要契约、Solver objective、最终几何独立验证、UI acceptance同义；SOP-001的Feed×Yarn/source/repeat边界及失败状态一致。未解决的内部repeat差异、未定义的第二纱路径/状态或被隐藏的8失败不能当作完整SOP成功。若只能验证有限范围，必须明确范围及剩余UNKNOWN，不能静默缩小“完整SOP”的含义。

通过软件正确性关口也不自动授予PROCESS_VALIDATED；后者须有同一契约和状态下的真实工艺/机台对照与验收记录。真实布面标定在后续另行收集材料与尺寸证据。路线、确认前允许项及禁止项见 [ROADMAP.md](ROADMAP.md)。
