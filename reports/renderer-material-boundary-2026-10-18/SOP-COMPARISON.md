# SOP-001 Real Business Comparison

2026-10-18 · P0-C0 Correctness Preparation · FACT: main @ 7ababf264d495f6b96d4d66652c529424938ac4d，已有未提交改动。

**SOP001_COMPARISON_HARNESS = PASS**，仅表示对比与证据记录完成；fixture仍为 **FIXTURE_MISMATCH**，业务对比 **NOT_COMPARABLE**。

## 1. Source Evidence

- SOP_RECORDED：用户本轮完整SOP转录；原始单位保留，详细六项来源字段在 [results.json](results.json) 的 sop 中。
- FACT：通过当前 readProjectPackage 读取 [真实with-cam项目](../sop-001/SOP-001-N6W6040-main-yarn-with-cam.knitscape)，SHA-256 0d84dd7a3b7d408345015963279e5ea6548d501cbf84887d019a5f538b99eed8。
- FACT：Cam沿用 [with-cam报告§7](../sop-001/with-cam/REPORT.md) 和其 results 的既有转录；工艺图字节校验 true。本轮没有重新看图猜Cam。
- SOFTWARE_DERIVED：原样执行 [observability probe](../yarn-length-observability-2026-10-18/diagnostic.mjs)，保留所有原断言；M3调用既有 independent-auditor。仅在隔离子进程截获该probe写results的操作，历史结果文件不被覆盖。
- FACT：照片关联靠历史用户指定记录及SHA-256，不凭文件名。UNKNOWN：工厂测量契约、实际路径、负载、物性。
- FACT：results保存源文件指纹、48条Feed×Yarn当前计算记录、原probe日志和本轮验证输出。旧probe整对象基线比较也包含HEAD；未来HEAD/元数据变化会阻止运行，必须区分元数据差异与真实数值漂移，不能自动更新expected。

## 2. SOP Structured Data

以下均为 SOP_RECORDED，测量原理/适用状态 UNKNOWN，置信度为“资料转录，未经本轮实测”。

| Machine field | SOP value |
|---|---|
| Station / type | K01 / 巨登，单面 |
| Cylinder / Gauge / needles | 32 inch / 32G / 3216 |
| Material No / arrangement | NB2D0106-AA01AC / 1234 |

| Yarn field | N6/W(6040) | 20D LOW |
|---|---|---|
| Ratio / lot | 91.20% / Y38W9N60NW-Z | 8.80% / Z2704 |
| Feed record / mouths | 1.2.3.4.5.6.7.8 / 96 | 1.2.3.4.5.6.7.8 / 96 |
| Feeder depth | 3 cm | 5.6 cm |
| Plate scale / gear count | 30 / 36 | 124 / 36 |
| Tension record | 5 cN | 4 cN |
| Actual yarn length recorded | 23 cm / 100G | 8 cm / 100G |

SOP备注：纱长测试标准为织机100针长度；不等于已确认软件measurement contract。23/8的setpoint / actual measured / QC target角色均 PENDING_PROCESS_CONFIRMATION。

坯布幅宽56 inch，坯布克重264 G/Y。±2%仅为 **SOP_RECORDED_TOLERANCE**；23的22.54–23.46、8的7.84–8.16仅为 **INFERENCE / DERIVED_FROM_SOP_RECORDED_TOLERANCE**，未用于M1或任何软件PASS/FAIL。

## 3. Software Fixture

FACT：当前保存项目30×40，Gauge 32，排针 1234；8个Feed仅分配N6/W，每项target23、tension=null、placement=parallel。默认Yarn1留在库内但未被Feed选用；默认companion禁用。没有20D LOW资产/target8。

模型diameter=0.24（model needle pitch），来自Legacy primary fallback；lengthScaleY=1。均为FACT软件输入，真实直径UNKNOWN。N6/W四张PBR及22.987mm纹理U重复参数来自已有包，其条件性来源见results；solid诊断不渲染贴图。当前材质支持asset字段，不等于本包具有实测材料数据。

诊断复用原probe：30/32宽各跑saved-main-yarn及diagnostic-two-yarn，共4场景；第二纱仅为内存中的 **SYNTHETIC_DIAGNOSTIC_ONLY**（8 Feed、target8、parallel、未标定fallback）。未修改或另存comparison fixture，亦未宣称该分配为真实生产。

## 4. Input Match

| Field | SOP | Fixture | Status |
|---|---|---|---|
| Gauge | 32 | 32 | MATCH |
| Arrangement | 1234 | 1234 | MATCH |
| Cam | 历史真实4×8转录 | 逐格及Domain输出比对 | MATCH |
| Feed cycle | 1–8 | 8 Feeds | MATCH |
| N6/W mapping / target | 1–8 / 23 | 1–8 / 23 | INPUT_MATCH |
| 20D mapping / target | 1–8 / 8 | absent / null | FIXTURE_MISMATCH |
| N6/W tension | 5 cN | null, F1–8 | FIXTURE_MISMATCH |
| 20D tension | 4 cN | absent, F1–8 | FIXTURE_MISMATCH |
| Cylinder / machine needles | 32 inch / 3216 | null / null | NOT_MODELED |

FACT：所有差异逐Feed保存在inputComparison.fixtureMismatches，每条含field、SOP value、Fixture value、evidence；共25条。不把未建模字段填成MATCH，也不把主纱保存版的缺失称为已证明的录入错误。

FACT：Type1=KKKKKKTT、Type2=KKKKTTKK、Type3=KKTTKKKK、Type4=TTKKKKKK；24K/8T/0M。工艺来源 → 历史转录 → 当前包 → resolveSingleJerseyOperations → adapter比对；没有默认全K替换。实际针踵命名、方向及96口映射仍待工艺确认。

## 5. Yarn Length Comparison

下表全部为SOFTWARE_DERIVED；只摘Feed8，全部Feed与窗口/分母/单位在results.runs。M1为cm/100 needles；M2为历史cm/100 loops共享Pattern预览统计，**不是每纱读数**；M3为cm/100 needle passages最终路径诊断。

| Yarn | Window / Feed | SOP记录数值 | M1 | M2共享上下文 | M3最终路径 | Solver status | Comparison status |
|---|---|---:|---:|---:|---:|---|---|
| N6/W(6040) | 30×40/F8 | 23 | 22.999733873 | 24.792732968 | 24.077277996 | CONVERGED | SOFTWARE_DERIVED / NOT_COMPARABLE |
| N6/W(6040) | 32×40/F8 | 23 | 22.999580039 | 24.805103333 | 23.701615835 | CONVERGED | SOFTWARE_DERIVED / NOT_COMPARABLE |
| 20D LOW | 30×40/F8 | 8 | 13.208564709 | 24.792732968 | 27.065709704 | UNREACHABLE_TARGET | UNREACHABLE / NOT_COMPARABLE |
| 20D LOW | 32×40/F8 | 8 | 13.320235620 | 24.805103333 | 27.065709704 | UNREACHABLE_TARGET | UNREACHABLE / NOT_COMPARABLE |

FACT：Numeric regression=MATCH。Expected来自用户给出的历史近似值，M1/M2/M3比较1e-8、第二纱minimum比较1e-6仅用于舍入后的软件回归；与SOP ±2%无关。所有原probe精确基线断言也保留。

## 6. 23cm Analysis

SOFTWARE_DERIVED：主纱所有Feed均CONVERGED并应用。30宽M1积分周期30，32宽周期4；M1平均同Feed所有有限course（F8含顶边row39），M3选择内部完整重复course。M2来自排针前基础Pattern且与Feed/Yarn无关。窗口、边界及分母不同使M1/M2/M3不同；23接近M1只说明当前软件objective收敛。不能认定M1为工厂canonical metric，不能由M3不同判M3错误。32宽结果不冒充原30宽fixture。

## 7. 8cm Analysis

SOFTWARE_DERIVED：原fixture没有第二纱；既有人工诊断的全部Feed为 **UNREACHABLE_TARGET**，8未应用到最终Geometry。

| Window | Target | F8 reachable minimum / failed M1 candidate | Candidate M3 | Candidate loopHeight | candidateApplied | Final geometry M3 |
|---|---:|---:|---:|---:|---|---:|
| 30×40 | 8 | 13.208564709 | 13.440442339 | 0.05 | false | 27.065709704 |
| 32×40 | 8 | 13.320235620 | 13.440442339 | 0.05 | false | 27.065709704 |

candidateMinimum只是当前模型/参数/bounds下的M1可达最小值，不是实机最低值或最终软件纱长。失败candidate保留用于诊断，最终仍是base fallback path；M3最终路径与candidate M3分列。未应用target8不证明SOP错误，20D名称也不证明弹力或预牵伸。

## 8. Material / Tension Gap

FACT：tension记录在本报告的SOP中recorded=true，历史fixture recordedInFixture=false，activeInGeometry=false；源码tensionCN只在数据规范化/赋值出现，不进入Solver/Geometry。没有tensionMatch=PASS。

FACT：当前resolveYarnMaterial可解析asset颜色/直径/PBR；此fixture的asset无实测直径，实际走Legacy 0.24 fallback。第二纱诊断同样继承0.24，不是禁用companion的0.14。parallel是软件几何排列，不是已确认工艺路径。材料力学 NOT_MODELED，真实材料身份、diameter、density、elasticity、draft、friction、compression、relaxation均UNKNOWN。

| Yarn | Effective diameter | Source | Unit | Measured diameter | Scope |
|---|---:|---|---|---|---|
| N6/W(6040) | 0.24 | LEGACY_PRIMARY | MODEL_NEEDLE_PITCH | UNKNOWN | SAVED_MAIN_YARN |
| 20D LOW | 0.24 | LEGACY_PRIMARY | MODEL_NEEDLE_PITCH | UNKNOWN | SYNTHETIC_DIAGNOSTIC_ONLY; absent from saved fixture |

**SAME EFFECTIVE VALUE ≠ SAME REAL DIAMETER**。这些来源是派生软件元数据，不写入项目/Undo；Asset explicit也不自动等于实测。SECOND_YARN_DIAMETER_FALLBACK = NEEDS_CONTRACT；保留当前primary兼容行为。

SOP比例、批号、导纱深度、盘刻度、齿数和96口记录未成为经过验证的Geometry输入，不由比例推导几何或从照片校准。

## 9. Fabric-Level Data

SOP_RECORDED：56 inch、264 G/Y。当前布面幅宽模型、坯布重量模型均 **NOT_MODELED**，软件值null；未换算GSM。30×40/32×40 chart不是幅宽，也不是3216针整机圆筒。

## 10. Visual Reference

FACT：visualReference=REAL_FABRIC_VISUAL_REFERENCE；路径 [面料放大.jpg](../../面料放大.jpg)，SHA-256 f1b88a5bbdb5f19d8e6a3a33ed44786a64ab065373b84b8ff625f8854b58fe75。历史用户明确指定img007.jpg；几何审计记录其与现文件字节一致，本轮核对哈希并目视检查。

FACT / VISUAL_OBSERVATION：可见编织线圈、表面毛羽、交叉和遮挡。只作视觉基准/后续入口；无尺度标定，不推导diameter、wale/course spacing mm、density、elastic recovery、relaxation coefficient、friction或physical scale，未生成替代图。

## 11. Confirmed Matches

FACT：32G、1234、既有Cam转录的32格及Machine Domain K/T/M、8 Feed cycle。N6/W名称/Feed记录及target23仅INPUT_MATCH。照片内容身份有哈希证据。任何上述匹配均不证明工厂测量契约。

## 12. Confirmed Software Gaps

- FACT：Saved fixture lacks 20D LOW asset and all target8 assignments
- FACT：Saved fixture tension null versus SOP 5/4 cN; tension not active in Geometry
- FACT：Existing diagnostic second-yarn target8 is unreachable on all Feeds; failed candidate unapplied
- FACT：Cylinder diameter, full machine needle count, greige width and weight not modeled
- FACT：M1/M2/M3 use different measurement scopes; factory contract unresolved

## 13. Unknowns Blocking Factory Validation

- **Q1 — UNKNOWN / PENDING_PROCESS_CONFIRMATION**：23的实际测量路径、步骤、起始针/结束针、连接段处理？
- **Q2 — UNKNOWN / PENDING_PROCESS_CONFIRMATION**：8的实际测量路径是什么，是否与23完全相同方法、边界、仪器及归一化？
- **Q3 — UNKNOWN / PENDING_PROCESS_CONFIRMATION**：两纱测量时loaded / unloaded / relaxed？是否回缩/静置？5/4cN是否测量负荷？
- **Q4 — UNKNOWN / PENDING_PROCESS_CONFIRMATION**：20D LOW真实材料是什么，是否弹性、预牵伸、送纱倍率？
- **Q5 — UNKNOWN / PENDING_PROCESS_CONFIRMATION**：测量对应哪个Feed？两纱真实同口/独立口分配及1–8循环与96口关系？
- **Q6 — UNKNOWN / PENDING_PROCESS_CONFIRMATION**：两纱是否完全相同knitting path，还是plating/laid-in/covering/部分针路径？
- **Q7 — UNKNOWN / PENDING_PROCESS_CONFIRMATION**：23/8各为setpoint / actual measured / QC target？容差适用阶段及业务合同？

另有真实直径、density、弹性曲线、摩擦、压缩、relaxation与finish后状态UNKNOWN。原始23/8栏名保留，不替工艺确认其value type。

## 14. Next Decision

需要工艺人员提供Q1–Q7可追溯答案（回答者、日期、SOP版本、取样示意/步骤、起止针、Feed、负载/回缩状态、数值角色及容差依据），才可选择下一步契约或模型工作。本轮停止，不修Solver、不开发第二纱模型或YarnTopology。

FACT：运行方式：

```powershell
node reports/sop-001-business-comparison-2026-10-18/comparison.mjs --verify
```

省略--verify仅重跑comparison，verification明确NOT_RUN，不沿用旧验证成功。失败会写BLOCKED并exit1；fixture不完整或UNKNOWN本身不会被隐藏，也不自动把成功的对比记录判作工厂失败。运行依赖现有工作区依赖和历史probe，其计算断言均未削弱。

可加 --output-dir=reports/<新目录> 保存新的 results.json 和 SOP-COMPARISON.md，保留原历史结果。本轮输出目录：reports/renderer-material-boundary-2026-10-18/。

| Current-run check | Result |
|---|---|


FACT：Known baseline failures=NOT_RUN；New failures=NOT_RUN。已知validate:row-length-loop-model为当前功能文档标题断言；未修标题迎合suite。完整stdout/stderr、exit code均在results.verification.checks。

FACT：1246个既有文件前后SHA-256核对；目录外改变=[]。src changed=false；package.json changed=false；package-lock changed=false；Project format changed=false；algorithms changed=false。Solver/Geometry/M1/M2/M3业务源码及既有probe未改。无commit/tag；build正常生成的ignored产物不纳入源码保全断言。

**SOP001_COMPARISON_HARNESS = PASS**

**CANONICAL_FACTORY_MEASUREMENT = PENDING_PROCESS_CONFIRMATION**

**REAL_MACHINE_VALIDATION = NOT_YET_ESTABLISHED**
