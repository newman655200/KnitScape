# R2 T1 横密斜率机制诊断

日期：2026-11-25。任务依据：[R2 任务书](../../R2_SLOPE_SENSITIVITY_TASK.md)。本阶段完成 Q2；Q3 因 STOP #6: q3-2.84-plus-0.01: contact branch change exceeds registered guard 停止，QC 尚未运行。

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

## Q3：锁定宽度的有效刚度

运行状态：**STOPPED**；本步完成 4/10 个预登记求解。STOP #6: q3-2.84-plus-0.01: contact branch change exceeds registered guard

**停止依据：** `q3-2.84-plus-0.01` 已 CONVERGED，但纵行间激活段对数从同一 l 基准的 14 降至 9，绝对相对变化 `|9−14|/14=0.35714285714285715`（35.714285714285715%），超过预登记 30%。横列间为 109→113（3.669724770642202%）；全局 min/d_e 从 `0.9369700760699472` 到 `0.951349855358731`，差 `0.014379779288783756`，未超过 0.02。触发的是激活段对数门槛，不是未收敛。

按任务书立即停止，未运行剩余六个 Q3 点及全部 QC，未进入 R2-4。±1% 两个终态均已保存，但 +1% 触发分支停止保护后没有继续计算该配对刚度或给出主判读。以下仅报告停止前已完成并通过逐点检查的 ±0.5% 配对，以及四个已运行点的原始标量。停止阈值未调整；该现象提示需由架构师判断接触状态/分支，不能直接认定已证明分支跳变或因果机制。

固定 l，仅锁定 W=W*(1+δ)，H、S 及自由节点松弛。各点初值独立取对应 after.json，δ=0 直接复用该终态及能量。本步不重算基准。依据 R2-0（提交 22764b6）的 N16 检查：以自由终态 W* 锁定后能量相对差为 0，|F_W|W*/E=1.7222211633043253e-8；该检查不是本步 N64 的额外求解。
数值设置沿用原输入：N64、q=12、maxIterations=24000、innerIterations=800、memorySize=180；材料参数未覆盖。

### 基准能量与能量占比

| l/mm | W*/mm | E_total/N·mm | E_bending/N·mm | E_contact/N·mm | E_barrier/N·mm | 接触能占比/% |
| --- | --- | --- | --- | --- | --- | --- |
| 2.77 | 0.745680584495 | 0.0224053295311 | 0.0217801416751 | 0.000625187855999 | 0 | 2.79035331809 |
| 2.84 | 0.753408372189 | 0.0212073096521 | 0.0207673970098 | 0.000439912642322 | 0 | 2.0743444102 |
| 2.9 | 0.759373526085 | 0.0203155965258 | 0.0199896226441 | 0.000325973881647 | 0 | 1.6045498897 |

三个基准的接触能占比实际范围为 1.60%–2.79%，任务背景中的 2.1%–2.8% 未覆盖第三点；这里依据原始 JSON 报告，保留任务书原文。**能量占比小不等于刚度占比小。** 下方刚度份额来自沿充分松弛路径的分项二阶差分，不能把两种占比混用。

### 锁定点与反力

| 运行 | l/mm | δ | 状态 | 迭代 | 耗时/s | W/mm | H/mm | S/mm |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| q3-2.84-minus-0.005 | 2.84 | -0.005 | CONVERGED | 3035 | 82.1669624 | 0.749641330328 | 0.503772594319 | -2.8566582299e-10 |
| q3-2.84-plus-0.005 | 2.84 | 0.005 | CONVERGED | 3050 | 112.2733786 | 0.75717541405 | 0.501054586578 | 1.04747986742e-7 |
| q3-2.84-minus-0.01 | 2.84 | -0.01 | CONVERGED | 3525 | 142.6351175 | 0.745874288467 | 0.504911478493 | 0.000954967660329 |
| q3-2.84-plus-0.01 | 2.84 | 0.01 | CONVERGED | 2925 | 131.1240386 | 0.760942455911 | 0.499691690566 | 6.61289665051e-9 |

| 运行 | E_total/N·mm | E_bending/N·mm | E_contact/N·mm | E_barrier/N·mm | min/d_e | 纵行激活段对 | 横列激活段对 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| q3-2.84-minus-0.005 | 0.0212114580817 | 0.020724991878 | 0.000486466203747 | 0 | 0.930048239353 | 14 | 110 |
| q3-2.84-plus-0.005 | 0.0212113246492 | 0.0208111614465 | 0.000400163202768 | 0 | 0.944072983191 | 13 | 111 |
| q3-2.84-minus-0.01 | 0.0212240603946 | 0.0206952248786 | 0.00052883551603 | 0 | 0.925136169934 | 14 | 114 |
| q3-2.84-plus-0.01 | 0.0212231118142 | 0.0208562457588 | 0.000366866055435 | 0 | 0.951349855359 | 9 | 113 |

以下反力及分解单位均为 N。g_contact 已包含势垒贡献，不再重复相加。F_W=g_bending,W+g_contact,W+(Jᵀλ)_W。

| 运行 | F_W | g_bending,W | g_contact,W（含势垒） | (Jᵀλ)_W | 三项和 | 三项和−F_W |
| --- | --- | --- | --- | --- | --- | --- |
| q3-2.84-minus-0.005 | -0.00222478080975 | -0.00272161461089 | -0.0126157106623 | 0.0131125444634 | -0.00222478080975 | 0 |
| q3-2.84-plus-0.005 | 0.00211386147324 | -0.00254224292732 | -0.00892006927788 | 0.0135761736784 | 0.00211386147324 | 0 |
| q3-2.84-minus-0.01 | -0.00412366502413 | -0.00487589320185 | -0.0134280005038 | 0.0141802286815 | -0.00412366502413 | 0 |
| q3-2.84-plus-0.01 | 0.00412725879242 | -0.00245674735054 | -0.00722759375313 | 0.0138115998961 | 0.00412725879242 | 0 |

### 刚度与一致性校验

h=|δ|W*；k_X=[E_X(+δ)−2E_X(0)+E_X(−δ)]/h²；s_c=(k_contact+k_barrier)/k_total。各 k 的单位为 N/mm，s_c 无量纲。

| l/mm | \|δ\| | h/mm | k_total | k_bending | k_contact | k_barrier | s_c | 分步判读 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.84 | 0.005 | 0.00376704186094 | 0.57526983549 | 0.0957890686329 | 0.479480766857 | 0 | 0.833488455811 | 横向刚度以接触为主，与推测一致 |

| l/mm | \|δ\| | k_total−Σk_X / N/mm | 刚度和绝对相对差 | k_F / N/mm | k_F−k_total / N/mm | 反力刚度绝对相对差 |
| --- | --- | --- | --- | --- | --- | --- |
| 2.84 | 0.005 | 1.26121335597e-13 | 2.19238569132e-13 | 0.575868605014 | 0.000598769524161 | 0.00104084985379 |

k_F=[F_W(+δ)−F_W(−δ)]/(2h)。停止 #5 的两个门槛保持为：刚度和绝对相对差 >1e-6，或反力刚度绝对相对差 >20%。每个完整配对后立即检查，未完成或触发分支停止的配对不继续计算。

### 接触状态连续性与预登记判读

| 运行 | 纵行激活数相对变化 | 横列激活数相对变化 | 全局 min/d_e 变化 |
| --- | --- | --- | --- |
| q3-2.84-minus-0.005 | 0 | 0.00917431192661 | -0.00692183671648 |
| q3-2.84-plus-0.005 | 0.0714285714286 | 0.0183486238532 | 0.00710290712069 |
| q3-2.84-minus-0.01 | 0 | 0.045871559633 | -0.0118339061363 |
| q3-2.84-plus-0.01 | 0.357142857143 | 0.0366972477064 | 0.0143797792888 |

停止 #6：任一锁定点的纵行/横列激活数相对基准变化 >30%，或全局 min/d_e 相对基准的绝对差 >0.02。分组最小间距仍完整保存在汇总中。
主点固定为 l=2.84 mm、|δ|=1%；s_c≥0.6 为横向刚度以接触为主、与推测一致，s_c≤0.4 为以弯曲为主、与推测矛盾，其间不确定。0.5%、1%、2% 若跨不同区间，最终为“不确定（步长敏感）”。
本项最终判读：**尚未完成，按停止条件等待指示**。

局限：分项二阶差分沿同一个耦合松弛路径计算，不能解释为相互独立的材料刚度，也不将分项值截断为非负。结果只适用于此 T1 N64 无摩擦分支；真实干放松态、纱径及其他物性仍有未知，不据此提出参数取值建议。

### Q3 数据来源与复现

| 字段 | 记录 |
| --- | --- |
| Value | 上述表及 q3-summary.json 中未舍入的 runs / baselines / analysis；表格显示至多 12 位有效数字 |
| Unit | l、W/H/S、h：mm；E：N·mm；反力：N；刚度：N/mm；s_c、δ、相对差、min/d_e：无量纲；段对：计数 |
| Source | R2 task §5.3；三份 step3-hossain-{l}-input.json / after.json；每个锁定点 manifest 与原始 result JSON |
| Measurement / derivation principle | 锁定宽度后受约束最小化；广义反力=g+Jᵀλ；中心二阶能量差分与中心反力差分；不是物理实测 |
| Confidence | MODEL_DERIVED_DIAGNOSTIC；原材料参数保留 ASSUMPTION/DERIVED 等原有标签；不是因果验证 |
| Applicable state | T1 N64 frictionless plain-jersey branch；l 是给纱设定值，放松后复测未知 |

HEAD：690b323c2854ace25f776ffbbe505b491e427388；完整归档：C:/Users/liuchen/Documents/KnitScape/archives/r2-slope-2026-11-25/R2-2/。材料参数及其六字段原始来源保留在 q3-summary.json 的 materialParameters；无覆盖。初值、输入、结果与代码哈希、环境及开始/结束时间保留于逐点 manifest。

| 运行 | 输入 SHA-256 | manifest（相对归档根） | 完整结果（相对归档根） |
| --- | --- | --- | --- |
| q3-2.84-minus-0.005 | 33539c6b8f77d91c227ee5b904f12b1c8489071775cf081b559344258356b58d | R2-2/q3-2.84-minus-0.005-manifest.json | R2-2/q3-2.84-minus-0.005-result.json |
| q3-2.84-plus-0.005 | 66324a519c165c9fc48ec3c485831e85cdb226e0d37b895ebe040067d574fb6b | R2-2/q3-2.84-plus-0.005-manifest.json | R2-2/q3-2.84-plus-0.005-result.json |
| q3-2.84-minus-0.01 | c79dfca99cbf3f2eaa56e1cfa64b99ae70fbde98a0d3c0e04638f916efbf3126 | R2-2/q3-2.84-minus-0.01-manifest.json | R2-2/q3-2.84-minus-0.01-result.json |
| q3-2.84-plus-0.01 | 2c6841d921fe50ae08a4d3af13cb619f94a169780885792b41e3614ad00a9693 | R2-2/q3-2.84-plus-0.01-manifest.json | R2-2/q3-2.84-plus-0.01-result.json |
