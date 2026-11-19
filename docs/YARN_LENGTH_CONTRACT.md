# Yarn Length Measurement Contract

## SOP-001 生产确认补充 — 2026-10-20 / P0-C1

**PROCESS FACT**：来源为用户在2026-10-20提供的生产部门确认（任务附件 `df694446-3ebe-4997-b778-faac116ac107/已粘贴的文本.txt`）。本节更新SOP-001的工艺语义；下方2026-10-17的待确认说明保留为当时快照，不能覆盖本次已确认事实。完整输入、实验与限制见 [P0-C1诊断报告](../reports/spandex-length-semantics-2026-10-20/REPORT.md)。

| 概念 | Value / Unit | Source / Measurement or derivation principle | Confidence / Applicable state |
|---|---|---|---|
| A 主纱放松实测长度 | 23 cm/100机针，N6/W(6040) | 生产确认；从同一块织物100针对应范围拆出，松弛、不紧绷直接测量 | PROCESS MEASURED；拆出放松态 |
| B 裸氨纶放松实测长度 | 8 cm/100机针，20D裸氨纶 | 同上；不是织造受力状态几何长度 | PROCESS MEASURED；拆出放松态 |
| C 实际牵伸倍率 | 3.0，无量纲；正常2.8–3.2，极限3.6 | 生产确认定义：织造状态长度 ÷ 放松后长度 | PROCESS CONFIRMED PARAMETER；本SOP使用条件，极限不是默认 |
| D 氨纶织造态参考长度 | 24 cm/100机针 | B × C = 8 × 3.0 | PROCESS-DERIVED VALUE；织造态参考，非直接实测，未证明与当前几何函数等价 |
| 张力记录 | 主纱5 cN、氨纶4 cN | 生产确认的实测记录 | PROCESS MEASURED；activeInGeometry=false，不推导长度、直径或弹性 |
| 抽样QC | ±2% | 生产确认的正式抽样验收标准 | 适用于上述实测纱长；不替代Solver容差 |

**PROCESS FACT**：润山单面大圆机，32英寸、32G、3216针；96口与96个三角座、喂纱位置一一对应。1–8路是最小完整工艺周期，96=8×12。两纱均在1–8路存在，裸氨纶由专用弹力送纱装置供给。同Feed共存的纱共享该Feed的K/T/M动作拓扑；这不要求未来三维中心线完全重合。路别“1.3”表示仅Feed1、3存在该纱，存在性由Feed × Yarn Assignment决定。

**已确认需求 / 尚未实施的设计建议**：逐Feed × Yarn允许独立长度，批量输入只是快捷操作。未来YarnAsset保存身份、规格、材料及可选默认/推荐牵伸范围；实际牵伸倍率属于本次FeedYarnAssignment使用关系，可随Feed、工艺单和机器条件变化，不能只归属于YarnAsset。本轮没有新增正式状态字段或改变项目格式。

QC派生范围：主纱22.54–23.46、氨纶放松7.84–8.16；固定倍率3.0时织造态参考23.52–24.48 cm/100机针，均标记 **DERIVED FROM QC RANGE**，不用于Solver验收。新机器直接设定纱长，旧纱盘刻度、齿轮、纱嘴深度仅可保留旧设备记录，不建立新核心公式。97口=12×8+1仅为PROCESS NOTE，未增加算法。

**KNOWN LIMITATION**：真实纱径仍UNKNOWN；软件有效直径保持0.24 / MODEL_NEEDLE_PITCH / LEGACY_PRIMARY。放松时长、仪器校准、端部连接归属等进一步测量细节仍未提供，当前M1与M3测量窗口差异仍在。主纱23的放松实测语义也不自动证明其与织造几何等价；本轮仅保持既有主纱对照。`PROCESS_MEASUREMENT_CONTRACT=ESTABLISHED_FOR_SOP001` 指本节已确认语义；`REAL_MACHINE_VALIDATION=PARTIAL`，不是生产精度验收。

## 2026-10-17 历史合同快照

核对日期：2026-10-17。当前阶段 `P0-C0`。**SUBJECTIVE / DESIGN DECISION**：本文描述现有测量函数和未来契约骨架，不修改 Solver，不宣布 canonical production metric 已确定。统一证据等级与六项数据来源原则见 [PROCESS_VALIDATION.md](PROCESS_VALIDATION.md)。

## KNOWN — FACT

- SOP记录 N6/W(6040)=23、20D LOW=8，单位 `cm / 100 machine needles`；资料有“纱长测试标准为织机100针的长度”备注。具体操作方法仍不完整。[语义审计§2、15](../reports/yarn-length-semantics-audit-2026-10-16/REPORT.md)
- 项目权威输入字段是 `singleJerseyCamProgram.feeds[f].yarns[y].yarnLengthCmPer100Needles`；`targetLengthCmPer100Needles` 是派生 SolverResult 内的目标副本，不能建成第二个项目输入。[Cam actions](../src/actions/singleJerseyCamProgram.js)
- 真实保存的 SOP-001 with-cam 项目为30×40，只分配主纱23到8路；没有20D LOW资产/assignment，tension仍null。双纱诊断不能反写成真实已保存配置。[manifest](../reports/sop-001/with-cam/project-export.manifest.json)
- 当前计算是二维生成路径的几何弧长，不是受力伸长、三维实纱弧长或工厂实测。

## UNKNOWN / PENDING PROCESS CONFIRMATION

23和8是否同取样边界、同路径、同Feed角色、同负载/回缩状态、同数值类型，均未确认。20D LOW的真实材料、弹性、预牵伸/送纱倍率以及各针/Feed参与方式仍未知。`placement=parallel` 的保存值不证明真实工艺已经建模。

真实直径、弹性曲线、摩擦、压缩、relaxation、finish后状态、视觉PBR参数不会因七问回答就自动获知；各自另需来源与测量方法。

## PENDING QUESTIONS

唯一问题清单和待填回答位于 [PROCESS QUESTIONS PENDING — Q1至Q7](PROCESS_VALIDATION.md#process-questions-pending)。当前全部为 **UNKNOWN / PENDING PROCESS CONFIRMATION**。不在本文猜答案或按23/8比值补倍率。

## CURRENT MODEL METRICS — FACT

### 软件目标函数

来源：[periodicMeasurementPattern / createModelLengthEvaluator](../src/simulation/yarnPathGeometry.js)、[measuredLengthForFeed](../src/simulation/yarnLengthSolver.js)、[单位换算](../src/simulation/yarnLengthMetrics.js)。

```text
p = 25.4 / Gauge                  // mm / model needle pitch
L100_cm = 100 × L_model × p / (10 × N)
target100_model = target_cm100 × 10 / p

每course：测周期化上下文中间P针，包含这些源针拥有的完整outgoing links
M_r(h) = 100 × L_r(h) / P
每Feed：F_f(h) = 同Feed所有保留course的 M_r(h) 等权平均
```

32G时p=0.79375mm。横向周期P必须整除输入宽度；周期上下文复制3份再取中间P针。32针窗口能识别P=4；原30针窗口为P=30，相当于重复截断窗，不能称为完整1234周期。每course分母是机针位置数，不是K数、link数或Feed数量；没有把8路耗纱加总为一根目标。

纵向 `Y_PADDING=0`，顶边course也进入平均。Solver确实优化自己报告的F，不是只在UI显示环节出现差异。横向repeat连接已计入，不能把问题概括成“全部漏了连接段”。当前h默认0.6，求解范围[0.05,2]，模型容差0.01；32G换算为0.00079375cm/100针，**不是工厂允许误差**。

### 必须分开呈现的读数

| 名称 | 当前定义 / 状态 | 能否作为工厂验收 |
|---|---|---|
| User Target | assignment输入数值；有单位，具体测量语义未完整 | 不能单凭输入证明 |
| Current Solver Metric | 当前F_f(h)，有限高度平均、横向周期化 | 未建立工艺等价性 |
| Full Repeat Diagnostic | 对指定最终生成中心线、内部完整repeat独立积分 | diagnostic，不能自动成为authority |
| Preview Window Metric | 侧栏基础设计有限路径采样，名义width×height分母，`cmPer100Loops` | 非Feed目标验收；与前三者不同 |
| Solver Status | CONVERGED / UNREACHABLE_TARGET等、applied标记 | 只描述模型数值与应用 |
| Business Validation Status | 当前应记 PENDING / UNKNOWN；非现有正式UI字段 | 等待工艺契约与实际验证证据 |

侧栏由排针前base结果发布；不能用24.79等旧读数替代右侧Feed目标结果。[readout](../src/views/yarnLengthReadout.js)、[feedback](../src/views/yarnLengthSolverFeedback.js)、[调度](../src/components/runSimulation.js)

### 独立诊断数值与适用窗口

**FACT**：本轮只读重算既有geometry-A / CONTROL32文件，再次得到下表内部repeat值；未重跑或改写生产Solver。独立积分器直接解析M/L/C最终路径，不读取Solver的solved值。

| 案例 | Solver/UI cm/100针 | 独立内部完整4针循环 cm/100针 | 条件 |
|---|---:|---:|---|
| 原SOP 30×40，主纱Feed8 | 22.999733873 | 24.077277996 | h=0.470611572265625；内部16针×3course，N=48次针位经过 |
| 32×40 comparison，Feed8 | 22.999580039 | 23.701615835 | 完整横向4针周期对照；不是原30×40项目 |

32×40另生成108针、中部连续100针的历史控制值为23.701615589；微小差异来自所取路径/数值表示，不改变窗口差异结论。原30×40旧报告中的23.675983仍属于30针周期化上下文，不代表最终内部4针循环。数据和定义详见 [语义审计§6、11–14](../reports/yarn-length-semantics-audit-2026-10-16/REPORT.md)、[summary](../reports/yarn-length-semantics-audit-2026-10-16/summary.json)、[独立积分器](../reports/yarn-length-semantics-audit-2026-10-16/independent-auditor.mjs)。

**INFERENCE**：明确通道、连续100机针区间的全部对应耗纱，是值得交工艺核对的候选；尚不足以将完整repeat直接定为生产canonical函数。

### 第二纱可达性

**FACT**：固定SOP Cam/1234/G32/模型直径0.24、30×40、当前测量及h范围的诊断fixture：

| 目标 | 第二纱8路结果 | 预览整体状态 |
|---|---|---|
| 23+23 | 第二纱23全部CONVERGED并应用 | VALIDATED |
| 23+15 | 第二纱15全部CONVERGED并应用 | VALIDATED |
| 23+10 | 第二纱10全部UNREACHABLE_TARGET | PARTIAL |
| 23+8 | 第二纱8全部UNREACHABLE_TARGET | PARTIAL |

失败槽使用默认h=0.6的显示几何；Solver报告的最近端点候选约12.84–13.56不是实际显示纱长。23/15的数值成功也没有消除内部repeat测量差异。证据：[语义审计§7–14](../reports/yarn-length-semantics-audit-2026-10-16/REPORT.md)。

**UNKNOWN**：不可达的真实工艺原因。不同第二纱路径、测量状态、预牵伸/回缩、Feed映射、几何能力或长度定义都仍需证据；不得据此说SOP的8错误，不降低bound、改分母或调直径强行让8成功。

## TARGET FUTURE CONTRACT — SUBJECTIVE / DESIGN DECISION

现在只设计 `YarnLengthMeasurementDefinition` 骨架；不是已实现的JSON schema或本轮迁移：

| 字段 | 需要回答什么 | 当前允许值 |
|---|---|---|
| basis | 测什么业务量、以何为基准 | UNKNOWN |
| needleSpan | 明确机针区间/次数、连续性与方向 | 100机针标题已知；具体边界UNKNOWN |
| yarnId | 被测纱及批次/项目ID对应 | 已知主纱ID；20D映射UNKNOWN |
| feedScope | 软件循环角色与实体喂纱通道 | UNKNOWN |
| pathScope | 包含哪些needle/sinker/float/连接段 | UNKNOWN |
| loadState | 带载、卸载、回缩、静置条件 | UNKNOWN |
| startBoundary | 起点与跨边界连接的归属 | UNKNOWN |
| endBoundary | 终点及端部/完整repeat处理 | UNKNOWN |
| normalization | 原始长度/机针区间如何归一化 | 当前软件公式可记录；生产规则UNKNOWN |
| valueType | machine setpoint / actual measured / QC target / other | UNKNOWN |
| source | SOP页/位置、回答者、日期、测量记录 | 可追溯引用；缺失UNKNOWN |
| unit | 原始单位与换算后的单位 | 当前记录cm/100 machine needles |
| evidence | 步骤、示意、原始数据、仪器/校准凭据 | 不足时UNKNOWN |

记录还需包含 Confidence 与 Applicable state，遵守统一六项原则。UNKNOWN必须可表达且不得被fallback假装补齐；不要求现在给现有数值字段写入字符串UNKNOWN。

七问与证据确认后形成正式 `YarnLengthMeasurementContract`，再让 `User Target → Canonical Measurement → Solver Objective → Independent Verification → UI Acceptance` 对应同一业务定义。独立验证须采用相同契约、独立实现，不能复制Solver读数充当验证。契约应可追溯版本、来源及适用范围，防止把旧窗口的结果用于新定义。

**PREDICTION**：确认后的契约可能要求改测量窗口，也可能要求独立第二纱路径或区分Feed/Loaded/Relaxed Length；现在不能预选结果。[确认后的分支与验收顺序](ROADMAP.md#after-process-confirmation)
