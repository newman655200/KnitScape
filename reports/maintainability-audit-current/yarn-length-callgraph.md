# Yarn Length — Definitions, Units, Consumers

FACT：当前源代码复核及fresh probe，非复制旧报告。目标项目authority只有`cam.feeds[f].yarns[y].yarnLengthCmPer100Needles`；结果里的target副本、基础preview、full-repeat diagnostic和UV累计弧长用途不同，不笼统称四套竞争输入。

```text
User Input (editor commit/Clear/batch draft)
  → validateYarnLengthInput / batch preflight
  → Cam action → State target
  → runSimulation invalidation + Machine Domain/adapter
  → simulate used Feed×Yarn + diameter profile/cache
  → solveFeedYarnLengths ↔ geometry.createModelLengthEvaluator(h)
      → periodic measurement per course → measuredLengthForFeed mean
      → status / solved paths / units / range
  → apply only converged paths → independently mark applied
  → derivePreviewValidity → Feedback UI
                    └→ actual final paths → draw / UV accumulated u

Base Pattern preview → buildYarnLengthMetrics → sidebar cmPer100Loops
Final generated centerline → independent internal-repeat diagnostic (audit only)
```

主要链路行号：editor:61–90；actions/singleJerseyCamProgram:207–252；runSimulation:213–280,288–316；yarnSimulation:178–291,300–337；previewValidity:12–25；feedback:8–19,53–56。所有这些路径均实际读取，不以变量名字推断调用。

## 函数完整清单与数学含义

文件简称M=`src/simulation/yarnLengthMetrics.js`，G=`yarnPathGeometry.js`，S=`yarnLengthSolver.js`，R=`rowLengthLoopModel.js`，P=`yarnPathSampler.js`，U=`yarnPathUvStrip.js`。单位中model=一针距单位，pixel=显示坐标，p=25.4/normalized Gauge mm/model。

| Function / Evidence | 输入→输出 / 单位 | 分母与边界 | Feed / Yarn | Solver / UI / Renderer / Validator使用 |
|---|---|---|---|---|
| M:5–17 normalizeMachineGauge | 任意数值→有效G，默认32/clamp1–120 | 无长度分母 | 全局 | S/U/UI/V |
| M:19–21 gaugeToNeedlePitchMm | G→25.4/G mm/model | 无 | 全局 | S/UI/U/V |
| M:23–29 modelLengthToMm | 非负model L→mm | 保留调用方区间 | 继承调用方 | S result/range/V |
| M:31–44 normalizeModelLengthPer100Needles | raw model L,N→100L/N model/100针 | N明确机针位置/经过次数 | 每course/slot上下文 | G/S/V |
| M:46–57 targetModelLengthPer100Needles | cm/100针→target×10/p model/100针 | 100是单位归一化，非总生成宽度 | 逐slot | S/V/旧diagnostic |
| M:59–67 courseToFeedIndex | course,count→course%count | 不是长度除Feed | Feed角色 | S/Simulation/Renderer/V |
| M:69–95 buildFeedYarnLengthDiagnostics | measured per100+feed targets→target/measured ratio | 调用方口径 | 同Feed各Yarn | 仅Gauge validator；不作正式验收 |
| M:97–107 cmPer100Loops | sampled model total/effectiveLoopCount×p×100/10→cm/100 | 实际width×height，不是K动作数 | 基础全窗，非Feed目标 | sidebar/V |
| G:36–58 periodicMeasurementPattern | bitmap/ops→最小整除宽度P、3P上下文 | 横向中间P针 | 共享模板、逐profile | evaluator/S/V |
| G:372–458 createModelLengthEvaluator / measureRow | h→每course model/100针 | 每个源针拥有完整outgoing link，含wrap；分母P；纵向有限顶边仍在 | 每course；simulation按Feed/slot提供视图 | S/V，不直接作为Renderer U |
| G:466–483 modelPathArcLength getter | 当前h所有finite links→model总/累计长 | 全finite，含其边界；非100针 | geometry视图 | diagnostic，生产无已发现结果消费者/V |
| G:323–361 buildYarnLengthMetrics | display sampled path/stitchWidth→model总及cm/100 | 两端都在effective窗才计；width×height | base Pattern preview | sidebar/V，非S objective |
| G:364–369 buildYarnPathArcLength | 所有display links拼接→sampled pixel总/累计 | 全finite，含其边界 | geometry视图 | diagnostic/V，非S objective |
| S:14–25 measuredLengthForFeed | 同Feed每course per100→算术平均 | 所有保留course，含顶边 | Feed；各slot调用隔离 | S objective / feedback经result |
| S:71–104 resultFromCandidate | candidate,target,G,tolerance→数值/paths/status | 继承F_f窗口，cm/100针 | 每Feed×Yarn | acceptance/UI/V；失败值为候选 |
| S:107–246 solveFeedYarnLengths | feeds,G,evaluator→每slot result | h[.05,2]、model tolerance.01、单调采样及二分 | 独立Feed×Yarn | Simulation/V；非工厂允许范围 |
| R:21–44 cubicArcLength | cubic坐标→直接数值积分弧长 | 单curve，默认积分容差1e-9；无100分母 | 数学工具 | S context / UV sampler / V |
| R:46–102 createPathLengthContext | D3 M/L/C→model弧长/端点 | 与生成坐标6位舍入相符 | 数学工具 | G evaluator/S/V |
| R:104–125 samplePathData（旧） | M/L/C→每cubic固定24弦点 | finite path | 数学工具 | legacy summary/V |
| R:127–142 polylineLength / polylineArcLength | 点列,unitScale→相邻距离/scale及累计 | finite点列，非100针 | 数学工具 | legacy summary/V |
| R:144–150 pathDataLength / pathDataArcLength | 旧sampled path→sampled L/cumulative | finite path | 数学工具 | G base metric/summary/V |
| R:152–190 pathEndpoints / assertContinuousRowPaths | path→端点/连续性判断 | tolerance1e-6，无业务分母 | course paths | G/display application/V；非长度目标acceptance |
| R:193–208 moveNeckPointX / lengthScaleToXCompensation / moveNeckPoint | point,coefficient→模板点位；x factor=1+(c−1)×.2 | 无量纲Legacy lengthScaleY参数 | 模板点 | G/V；不是送纱量比例标定 |
| R:210–229 solveSharedCoefficient | target,callback→scan/refine coefficient | callback定义测量 | callback作用域 | 当前仅row model validator；非第二生产Solver |
| P:100–244 samplePathData（UV） | M/L/Q/C/Z→frames及exact cubic累计u | 无100归一化；采样位置插值 | 当前strand path | Renderer/V，非target objective |
| U:8–18 buildYarnUvPathOffsets | final model links→每link累计offset | 跨link/layer累计 | 每strand | Renderer/V |
| U:20–80 buildYarnUvStrip | path,offset,width,G,repeat→positions/UV/index | U=(offset+u)×p/repeatMm；无repeat时/(48 model) | 每strand/course material | Renderer/V；不反定义业务长度 |
| previewValidity:12–25 derivePreviewValidity | 必要targets+results→validity | 检查同target/slot、误差/应用，不重新积分 | 全部必要Feed×Yarn聚合 | UI/V |

## 当前复算结果 — FACT

`length-probe.mjs`运行当前源文件与SOP manifest，不借用旧冻结geometry。current solved paths由独立Simpson积分器解析；padded source needles[5,21)、rows15/23/31、分母48次针位经过，168links，包含所选源针全部outgoing link。

| width×height / Feed8-Yarn1 | Solver cm/100针 | 内部完整4针repeat diagnostic cm/100针 | h / status |
|---|---:|---:|---|
| 原30×40 | 22.999733873071612 | 24.077277996023074 | .470611572265625 / CONVERGED |
| 32×40 comparison | 22.999580039157998 | 23.701615834833124 | .45442504882812507 / CONVERGED |

相同生成几何的不同窗口定义造成差异：30针截断被P=30周期化；32针识别P=4；有限顶边也进入Feed平均。Solver确实优化其报告函数，不能笼统说“优化和报告不一致”或“所有连接都漏算”。也不能把23.7016归到原30×40。

**MAINT-001 / HIGH**：同为cm/100针，数值目标成功不代表内部完整repeat同值，结果不携带measurement contract identity/window定义。**UNKNOWN**：哪个定义对应工厂取样；full-repeat保持diagnostic。侧栏又是合法但不同的基础统计，不是第二个可编辑target；其loops标签与width×height分母仍需解释。

## Gauge / Unit / Physical Scale 专项

| 公式/位置 | 分类 | 结论 |
|---|---|---|
| p=25.4/normalizeGauge；M:19–29 | A：统一utility | UI、Solver、geometry、UV均调用，不存在各自独立的25.4生产公式 |
| target cm×10/p；M:46–57 | A：单位反变换 | 与model→mm→cm数学等价 |
| 100L/N；M:31–44 vs M:97–107 | 不同业务metric，共用尺度 | 前者按指定机针区间，后者legacy finite统计；不能因相似代数强合并 |
| Solver model结果/误差/容差÷10；S:84–100 | A：mm→cm，调用modelLengthToMm | tolerance是model .01，不是QC工艺误差 |
| U=(offset+u)×p/repeatMm；U:60–63 | A：统一pitch utility | 是纹理相位/尺度，不是目标验收，不是总针数归一化 |
| center pixel=model×stitchWidth；G display / U:52–57 | 显示变换 | 不是Gauge物理标尺；zoom不应变model长度 |
| ribbon width=stitchWidth×diameter；draw:108 | 模型宽度→pixel | .24不是mm；不能由denier/PBR图高推实测直径 |
| 2172/2400×25.4=22.987mm；SOP记录 | 条件性数据推导 | 原图未重采样且DPI为真实采集才成立；不是diameter，亦非自动生产规则 |
| 本报告独立auditor的25.4/G | B：有意独立复算 | 不调用生产换算utility以交叉验证；reports脚本不产生另一业务authority |

没有发现生产各层各写一份mm=model×25.4/G并相互漂移；真正差异在窗口/路径/分母含义。`measuredNeedleCountByCourse`外层记width而实际内部P，当前数值仍用P正确归一化，但诊断元数据易误读（MAINT-009）。

## Validation的边界

Solver validator有独立dense参考积分、窗口宽度对照及重新测solved h，不是纯粹读回result；但参考仍沿用当前周期/有限course定义。结果/失败integration验证State/action/Runner/Solver/实际应用与fallback，UV验证累计弧长与缩放不变量。它们不证明工厂测量语义、真实3D/张力或材料物性。

当前相关metrics/Solver/row model/sampler/UV/validity/UI文件相对HEAD无改动；dirty Geometry仅增加course diameter输入，未修窗口语义。完整测试分类见 [validator-map.md](validator-map.md)；本轮完整validate36/37，失败为已有文档标题断言，不改测试。
