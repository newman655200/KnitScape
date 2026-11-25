# R2 T1 横密斜率机制诊断

日期：2026-11-25。任务依据：[R2 任务书](../../R2_SLOPE_SENSITIVITY_TASK.md)。本阶段完成 Q2；Q3、QC 尚未运行。

l=2.77/2.84/2.90 mm 是原资料的给纱设定值，不是放松后复测值；原输入的 REPORTED_SETTING 来源标签保持不变。所有覆盖只用于诊断，不是材料标定，也不形成参数取值建议。

## Q2：接触长度尺度敏感性

固定 l=2.84 mm，A 同时缩放 d_e 与 r_c，B 仅缩放 d_e，s∈{0.95,1.05}；K、E_f、B、tex 保持原输入。初值均为对应 after.json 的终态，s=1 直接复用该文件。
数值设置沿用原输入：N64、q=12、maxIterations=24000、innerIterations=800、memorySize=180；模型参数覆盖仅用于本诊断。

| 运行 | 变体 | s | 状态 | 迭代 | 耗时/s | W/mm | H/mm | S/mm | 横密/cm⁻¹ | 纵密/cm⁻¹ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 基准 after.json（复用） | 基准 | 1 | CONVERGED | 3800 | 复用，未重算 | 0.753408372189 | 0.502415143779 | 2.41442306013e-10 | 13.2730141702 | 19.9038586393 |
| q2-A-0.95 | A | 0.95 | CONVERGED | 2675 | 86.7465883 | 0.726421278439 | 0.519690878189 | -9.44024488653e-9 | 13.7661165729 | 19.2422080504 |
| q2-A-1.05 | A | 1.05 | CONVERGED | 3700 | 175.1277045 | 0.779643193162 | 0.482454067642 | 5.56683922773e-8 | 12.8263801797 | 20.7273617753 |
| q2-B-0.95 | B | 0.95 | CONVERGED | 2725 | 95.9986359 | 0.726421277744 | 0.519690877981 | -1.23872451616e-7 | 13.766116586 | 19.2422080581 |
| q2-B-1.05 | B | 1.05 | CONVERGED | 3700 | 167.3658692 | 0.779643194231 | 0.482454067057 | 5.32847313748e-8 | 12.8263801621 | 20.7273618005 |

| 运行 | E_total/N·mm | E_bending/N·mm | E_contact/N·mm | E_barrier/N·mm | min/d_e | 总激活段对 | 纵行间激活段对 | 横列间激活段对 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 基准 after.json（复用） | 0.0212073096521 | 0.0207673970098 | 0.000439912642322 | 0 | 0.93697007607 | 146 | 14 | 109 |
| q2-A-0.95 | 0.0201361001644 | 0.0198929938315 | 0.00024310633284 | 0 | 0.954986334389 | 122 | 11 | 94 |
| q2-A-1.05 | 0.0227388409001 | 0.0219673470087 | 0.000771493891358 | 0 | 0.919213297098 | 182 | 18 | 134 |
| q2-B-0.95 | 0.0201361002294 | 0.0198929938384 | 0.000243106391022 | 0 | 0.954986312685 | 122 | 11 | 94 |
| q2-B-1.05 | 0.0227388409104 | 0.0219673470304 | 0.000771493880023 | 0 | 0.919213312341 | 182 | 18 | 134 |

ε_W = ln(W₊/W₋) / ln(1.05/0.95)，ε_H 同理。仅 A 为主判据；B 只作辅助解读。

| 变体 | ε_W | ε_H | 用途 / 判读 |
| --- | --- | --- | --- |
| A | 0.706472892884 | -0.742864517373 | 与推测一致 |
| B | 0.706472916146 | -0.742864525493 | 辅助，不参与判定 |

预登记阈值：A 的 ε_W ≥ 0.7 → 与推测一致；ε_W ≤ 0.3 → 推测不成立；0.3 < ε_W < 0.7 → 不确定。阈值含边界，不按显示舍入值判定。
本项判读：**与推测一致**。

局限：能量占比小不等于刚度占比小；本项只检验接触长度尺度与 W 的响应，不能替代 Q3 横向刚度测量。B 独立保持 r_c，刻意偏离常规派生关系，属于诊断覆盖。四次求解同属 T1 无摩擦模型的分支延续，不证明因果、真实干放松状态或未知实物纱径；不得据此选择或推荐任何材料参数。Q2 不适用仅为 Q3 登记的接触状态跳变停止阈值。

### Q2 数据来源与复现

| 字段 | 记录 |
| --- | --- |
| Value | 上表及 q2-summary.json 的 runs/baselines 完整精度标量；表中数字显示为至多 12 位有效数字 |
| Unit | {"l":"mm","W":"mm","H":"mm","S":"mm","energy":"N*mm","F_W":"N","stiffness":"N/mm","waleDensityPerCm":"1/cm","courseDensityPerCm":"1/cm","sensitivity":"1","contactShare":"1"} |
| Source | R2 task §5 and the input/after files listed in each manifest |
| Measurement / derivation principle | W/H/S、能量和接触统计来自求解终态；横密=10m/W，纵密=10n/H，本组 m=n=1；ε 按上式中心对数差分；并非实物测量 |
| Confidence | MODEL_DERIVED_DIAGNOSTIC; not physical measurement or causal verification |
| Applicable state | T1 N64 frictionless plain-jersey branch; no material calibration |

HEAD：22764b600a786d6e65f57e5b478c7aa1d6d85938。完整结果归档：C:/Users/liuchen/Documents/KnitScape/archives/r2-slope-2026-11-25。输入哈希、初值哈希、运行环境和开始/结束时间见各 manifest；汇总包含脚本哈希。

| 运行 | 初值来源 | 输入 SHA-256 | manifest | 完整结果（运行相对归档根，基准相对仓库根） |
| --- | --- | --- | --- | --- |
| 基准 after.json（复用） | docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-2.84-after.json | 068b21392e10d3f001161f50909593953406207bd31f1e1b008d329f77f38414 | 基准复用，无新运行 manifest | docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-2.84-after.json |
| q2-A-0.95 | docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-2.84-after.json | 1ea14c69d9282468ccf6b8e199f0de767ba87b2a43f83084bd5d08bc01f15cf6 | R2-1/q2-A-0.95-manifest.json | R2-1/q2-A-0.95-result.json |
| q2-A-1.05 | docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-2.84-after.json | dd59b6c180eb4476b963f5b2d889478ec9c222e40b7835458efcf838bd7e48b4 | R2-1/q2-A-1.05-manifest.json | R2-1/q2-A-1.05-result.json |
| q2-B-0.95 | docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-2.84-after.json | 14c55a0e5d25086b7de0ea4f810135795e85e3a858b9903d4d5cd50130be0aae | R2-1/q2-B-0.95-manifest.json | R2-1/q2-B-0.95-result.json |
| q2-B-1.05 | docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-2.84-after.json | 682359976674712dd2b59cf02474a3ac0cf3cdf4e04e47ebffd1169f25c57473 | R2-1/q2-B-1.05-manifest.json | R2-1/q2-B-1.05-result.json |

物性沿用原输入标签；真实纱径与其他未知物性仍为 UNKNOWN，诊断覆盖不升级为实测。下表保留参数及覆盖的六项来源：

| 参数 / 运行 | Value | Unit | Source | Measurement / derivation principle | Confidence | Applicable state |
| --- | --- | --- | --- | --- | --- | --- |
| tex | 19.78 | tex | Hossain et al.2025 PLOS ONE e0323572; table supplied by user | Measured yarn linear density reported by user from study; no fitting | REPORTED_MEASUREMENT | Combed cotton single yarn; fabric dry-relaxed48h at22C/67%RH |
| densityGPerCm3 | 1.31 | g/cm^3 | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| fiberDiameterMm | 0.021 | mm | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| E_f | 3000 | N/mm^2 | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| K | 0.01 | 1 | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| phi0 | 0.5 | 1 | docs/LAYER3_STEP1_TASK.md section 2 | Model reference assumption; no material measurement asserted | ASSUMPTION | Uncalibrated T1 model reference; physical specimen state unknown |
| d_s | 0.13865404857744756 | mm | Derived from tex, densityGPerCm3 | sqrt(4 * tex / (pi * densityGPerCm3 * 1000)) | DERIVED | Inherits the states and uncertainty of all dependencies |
| fiberTex | 0.4537323729763399 | tex | Derived from densityGPerCm3, fiberDiameterMm | densityGPerCm3 * 1000 * pi * fiberDiameterMm^2 / 4 | DERIVED | Inherits the states and uncertainty of all dependencies |
| d_e | 0.1960864359761643 | mm | Derived from d_s, phi0 | d_s / sqrt(phi0) | DERIVED | Inherits the states and uncertainty of all dependencies |
| r_c | 0.09804321798808215 | mm | Derived from phi0, d_e | phi0 * d_e; uniaxial compaction model | DERIVED | Inherits the states and uncertainty of all dependencies |
| N_f | 43.59398001568523 | 1 | Derived from tex, fiberTex | tex / fiberTex; continuum fiber count estimate | DERIVED | Inherits the states and uncertainty of all dependencies |
| B | 0.0012485181297709927 | N*mm^2 | Derived from N_f, E_f, fiberDiameterMm | N_f * E_f * pi * fiberDiameterMm^4 / 64; freely sliding fibers | DERIVED | Inherits the states and uncertainty of all dependencies |
| q2-A-0.95 d_e | 0.18628211417735607 | mm | R2 task §5 | d_e and r_c scaled by 0.95 jointly; diagnostic only | DIAGNOSTIC_OVERRIDE | R2 mechanism diagnosis; not a material value |
| q2-A-0.95 r_c | 0.09314105708867804 | mm | R2 task §5 | d_e and r_c scaled by 0.95 jointly; diagnostic only | DIAGNOSTIC_OVERRIDE | R2 mechanism diagnosis; not a material value |
| q2-A-1.05 d_e | 0.2058907577749725 | mm | R2 task §5 | d_e and r_c scaled by 1.05 jointly; diagnostic only | DIAGNOSTIC_OVERRIDE | R2 mechanism diagnosis; not a material value |
| q2-A-1.05 r_c | 0.10294537888748626 | mm | R2 task §5 | d_e and r_c scaled by 1.05 jointly; diagnostic only | DIAGNOSTIC_OVERRIDE | R2 mechanism diagnosis; not a material value |
| q2-B-0.95 d_e | 0.18628211417735607 | mm | R2 task §5 | d_e scaled by 0.95; r_c held at baseline, overriding its d_e derivation; diagnostic only | DIAGNOSTIC_OVERRIDE | R2 mechanism diagnosis; not a material value |
| q2-B-0.95 r_c | 0.09804321798808215 | mm | R2 task §5 | d_e scaled by 0.95; r_c held at baseline, overriding its d_e derivation; diagnostic only | DIAGNOSTIC_OVERRIDE | R2 mechanism diagnosis; not a material value |
| q2-B-1.05 d_e | 0.2058907577749725 | mm | R2 task §5 | d_e scaled by 1.05; r_c held at baseline, overriding its d_e derivation; diagnostic only | DIAGNOSTIC_OVERRIDE | R2 mechanism diagnosis; not a material value |
| q2-B-1.05 r_c | 0.09804321798808215 | mm | R2 task §5 | d_e scaled by 1.05; r_c held at baseline, overriding its d_e derivation; diagnostic only | DIAGNOSTIC_OVERRIDE | R2 mechanism diagnosis; not a material value |
