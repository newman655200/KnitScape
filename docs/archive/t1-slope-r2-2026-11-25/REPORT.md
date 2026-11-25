# R2 T1 横密斜率机制诊断

日期：2026-11-25。任务依据：[R2 任务书](../../R2_SLOPE_SENSITIVITY_TASK.md)。Q2 已完成；Q3 按架构师裁定续跑后在 −2% 点触发新 #6(d) 停止，QC 与 R2-4 尚未执行。

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

## Q3：按架构师裁定续跑后停止

2026-11-25，架构师接受原 l=2.84、δ=+1% 点，裁定其纵行邻居脱离接触属于被测机制；裁定原文见任务书 §10。旧四点及原始 manifest 保留，未重新求解。旧四点继续参与 E/F_W/H 序列检查；新点级门槛仅适用于剩余点，纵行组接触数变化只记录。

**本次新增 1 点后按新停止条件 #6(d) 停止。** l=2.84、δ=−2% 已 CONVERGED，但横列组 109→76，变化 33/109=30.275229357798167%；斜向组 9→40，变化 31/9=344.44444444444446%，两者均超过 30%。纵行组 14→21（50%）仅记录，不构成停止理由。

截至停止：Q3 总计 5/10 点，全部已运行点均收敛。+2%、l=2.77/2.90 的 ±1% 共五点尚未运行；QC 和 R2-4 未执行。停止依据是裁定明确保留的新门槛，不自行放宽或替换。

### 基准与计算口径

每个锁定点从对应 after.json 终态独立出发，锁定 W=W*(1+δ)，H、S 和自由节点松弛；材料参数无覆盖。沿用 N64、q=12、maxIterations=24000、innerIterations=800、memorySize=180。δ=0 直接复用原 after.json，不重算。依据 R2-0（22764b6）的 N16 检查：W* 锁定的能量相对差 0，|F_W|W*/E=1.7222211633043253e-8；这是历史入口验收，不是本次新验证。

| l/mm | W*/mm | E_total/N·mm | E_bending/N·mm | E_contact/N·mm | E_barrier/N·mm | 接触能占比/% |
| --- | --- | --- | --- | --- | --- | --- |
| 2.77 | 0.745680584495 | 0.0224053295311 | 0.0217801416751 | 0.000625187855999 | 0 | 2.79035331809 |
| 2.84 | 0.753408372189 | 0.0212073096521 | 0.0207673970098 | 0.000439912642322 | 0 | 2.0743444102 |
| 2.9 | 0.759373526085 | 0.0203155965258 | 0.0199896226441 | 0.000325973881647 | 0 | 1.6045498897 |

原始基准的接触能占比为 1.60%–2.79%，任务背景的 2.1%–2.8% 未覆盖第三点；按 JSON 实值报告，任务原文保留。能量占比不等于有效刚度份额，不能相互替代。

### 五个已运行点

| 运行 | 本次处理 | δ | 状态 | 迭代 | 耗时/s | W/mm | H/mm | S/mm |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| q3-2.84-minus-0.005 | 复用旧结果 | -0.005 | CONVERGED | 3035 | 82.1669624 | 0.749641330328 | 0.503772594319 | -2.8566582299e-10 |
| q3-2.84-plus-0.005 | 复用旧结果 | 0.005 | CONVERGED | 3050 | 112.2733786 | 0.75717541405 | 0.501054586578 | 1.04747986742e-7 |
| q3-2.84-minus-0.01 | 复用旧结果 | -0.01 | CONVERGED | 3525 | 142.6351175 | 0.745874288467 | 0.504911478493 | 0.000954967660329 |
| q3-2.84-plus-0.01 | 复用旧结果 | 0.01 | CONVERGED | 2925 | 131.1240386 | 0.760942455911 | 0.499691690566 | 6.61289665051e-9 |
| q3-2.84-minus-0.02 | 本次新增 | -0.02 | CONVERGED | 4150 | 177.1584203 | 0.738340204745 | 0.505610880633 | 0.00343060692845 |

| 运行 | E_total/N·mm | E_bending/N·mm | E_contact/N·mm | E_barrier/N·mm | min/d_e | 纵行段对 | 横列段对 | 斜向段对 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| q3-2.84-minus-0.005 | 0.0212114580817 | 0.020724991878 | 0.000486466203747 | 0 | 0.930048239353 | 14 | 110 | 8 |
| q3-2.84-plus-0.005 | 0.0212113246492 | 0.0208111614465 | 0.000400163202768 | 0 | 0.944072983191 | 13 | 111 | 9 |
| q3-2.84-minus-0.01 | 0.0212240603946 | 0.0206952248786 | 0.00052883551603 | 0 | 0.925136169934 | 14 | 114 | 4 |
| q3-2.84-plus-0.01 | 0.0212231118142 | 0.0208562457588 | 0.000366866055435 | 0 | 0.951349855359 | 9 | 113 | 9 |
| q3-2.84-minus-0.02 | 0.0212559006209 | 0.0207252627747 | 0.000530637846165 | 0 | 0.927835714652 | 21 | 76 | 40 |

反力分解单位均为 N：F_W=g_bending,W+g_contact,W+(Jᵀλ)_W；contact 梯度已含势垒，不重复相加。

| 运行 | F_W | g_bending,W | g_contact,W（含势垒） | (Jᵀλ)_W | 三项和 | 三项和−F_W |
| --- | --- | --- | --- | --- | --- | --- |
| q3-2.84-minus-0.005 | -0.00222478080975 | -0.00272161461089 | -0.0126157106623 | 0.0131125444634 | -0.00222478080975 | 0 |
| q3-2.84-plus-0.005 | 0.00211386147324 | -0.00254224292732 | -0.00892006927788 | 0.0135761736784 | 0.00211386147324 | 0 |
| q3-2.84-minus-0.01 | -0.00412366502413 | -0.00487589320185 | -0.0134280005038 | 0.0141802286815 | -0.00412366502413 | 0 |
| q3-2.84-plus-0.01 | 0.00412725879242 | -0.00245674735054 | -0.00722759375313 | 0.0138115998961 | 0.00412725879242 | 0 |
| q3-2.84-minus-0.02 | -0.00429882353476 | -0.0116589533865 | 0.0055450536181 | 0.00181507623361 | -0.00429882353476 | 0 |

### 原主判据与一致性校验

中心差分口径不变：h=|δ|W*；k_X=[E_X(+δ)−2E_X(0)+E_X(−δ)]/h²；s_c=(k_contact+k_barrier)/k_total。k 单位为 N/mm。原 1% 点已被接受，因此本次计算其配对；2% 配对未完成，不补造另一侧或外推。

| l/mm | \|δ\| | k_total | k_bending | k_contact | k_barrier | s_c | 原阈值判读 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2.84 | 0.005 | 0.57526983549 | 0.0957890686329 | 0.479480766857 | 0 | 0.833488455811 | 横向刚度以接触为主，与推测一致 |
| 2.84 | 0.01 | 0.573493977177 | 0.293796819933 | 0.279697157244 | 0 | 0.487707226885 | 不确定 |

| \|δ\| | k_total−Σk_X / N/mm | 刚度和相对差 | 反力差分 k_F / N/mm | k_F−k_total / N/mm | 反力刚度相对差 |
| --- | --- | --- | --- | --- | --- |
| 0.005 | 1.26121335597e-13 | 2.19238569132e-13 | 0.575868605014 | 0.000598769524161 | 0.00104084985379 |
| 0.01 | 3.43058914609e-14 | 5.98190963221e-14 | 0.547573143671 | -0.0259208335059 | 0.0451980919373 |

两组完整配对的校验均未触发原停止 #5（刚度和相对差 >1e-6 或反力差分相对差 >20%）。1% 主点 s_c=0.48770722688527285，落在原 0.4<s_c<0.6 的“不确定”区间；0.5% 点属于接触为主，与 1% 已处于不同区间。三步长规则保持不变，但 2% 配对尚未完成，Q3 最终三步长判读仍未完成。

### 单侧描述性差分（不参与判读）

压缩：[E_X(−1%)−2E_X(−0.5%)+E_X(0)]/(0.005W*)²；拉伸使用 +1%、+0.5%。仅使用原四点及基准，没有新增工况。

| 侧别 | k_total / N/mm | k_bending / N/mm | k_contact / N/mm | k_barrier / N/mm | s_c |
| --- | --- | --- | --- | --- | --- |
| 压缩 | 0.595738077661 | 0.890598608601 | -0.29486053094 | 0 | -0.494949948637 |
| 拉伸 | 0.547698160067 | 0.0930105338639 | 0.454687626203 | 0 | 0.830179210658 |

这些分项二阶差分沿同一耦合松弛路径计算，不是独立材料刚度。负分项按公式原值保留；该描述性数据没有进入主判据或步长敏感性判定，也不形成参数建议。

### 新停止条件 #6 的实际检查

| δ | E_total/N·mm | F_W/N | H/mm | min/d_e | Δ(min/d_e) | 纵行段对 | 横列段对 | 斜向段对 | 点级检查范围 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| -0.02 | 0.0212559006209 | -0.00429882353476 | 0.505610880633 | 0.927835714652 | -0.00913436141784 | 21 | 76 | 40 | 新点，执行全部新门槛 |
| -0.01 | 0.0212240603946 | -0.00412366502413 | 0.504911478493 | 0.925136169934 | -0.0118339061363 | 14 | 114 | 4 | 已接受旧点；仍参与序列检查 |
| -0.005 | 0.0212114580817 | -0.00222478080975 | 0.503772594319 | 0.930048239353 | -0.00692183671648 | 14 | 110 | 8 | 已接受旧点；仍参与序列检查 |
| 0 | 0.0212073096521 | -2.69951972234e-10 | 0.502415143779 | 0.93697007607 | 0 | 14 | 109 | 9 | 原基准 |
| 0.005 | 0.0212113246492 | 0.00211386147324 | 0.501054586578 | 0.944072983191 | 0.00710290712069 | 13 | 111 | 9 | 已接受旧点；仍参与序列检查 |
| 0.01 | 0.0212231118142 | 0.00412725879242 | 0.499691690566 | 0.951349855359 | 0.0143797792888 | 9 | 113 | 9 | 已接受旧点；仍参与序列检查 |

E 从 δ=0 向压缩侧、拉伸侧均单调上升：true / true；F_W 随 δ 单调递增：true；H 随 δ 单调递减：true。新点 min/d_e 差为 −0.009134361417839298，绝对值小于 0.02。因此仅新 #6(d) 的横列/斜向计数门槛触发。

这份停止记录不自行判定物理因果或是否分支跳变，后续由架构师裁定。

### 来源、归档与简化验证

| 字段 | 记录 |
| --- | --- |
| Value | 表中至多 12 位有效数字；q3-summary.json 保留原精度的 runs、analysis、descriptiveOneSided、continuationChecks |
| Unit | l/W/H/S：mm；E：N·mm；F_W及反力项：N；k：N/mm；δ、s_c、min/d_e及相对变化：无量纲；段对：计数 |
| Source | 原三份 input/after JSON、逐点 result/manifest；新增停止规则与单侧公式来源为任务书 §10 架构师裁定原文 |
| Measurement / derivation principle | 锁定宽度的受约束最小化；广义反力 g+Jᵀλ；冻结中心差分和附加单侧差分；不是实物测量 |
| Confidence | MODEL_DERIVED_DIAGNOSTIC；材料原有 ASSUMPTION/DERIVED 标签保留，非物理或因果验证 |
| Applicable state | T1 N64 无摩擦纬平针分支；l 是给纱设定值，放松后复测与真实纱径仍未知 |

续跑基线 HEAD：47b7980590bd83f10dddacaeaa466faa9e7bfc66；新增结果目录：C:/Users/liuchen/Documents/KnitScape/archives/r2-slope-2026-11-25/R2-2/continuation-2026-11-25/。原 R2-2 目录和旧四点 result/manifest 保留；prior-summary.json 保存本轮开始前汇总。
本次研究分析自检、续跑规则自检、脚本语法检查通过，build 退出 0。按裁定不跑金标准、不做性能基准、不计算文件哈希；全量 validate 含金标准，未运行。旧哈希字段仅作为历史记录保留；新 manifest 记录路径、HEAD、环境、参数、开始/结束时间和状态。

| 运行 | manifest（相对归档根） | result（相对归档根） |
| --- | --- | --- |
| q3-2.84-minus-0.005 | R2-2/q3-2.84-minus-0.005-manifest.json | R2-2/q3-2.84-minus-0.005-result.json |
| q3-2.84-plus-0.005 | R2-2/q3-2.84-plus-0.005-manifest.json | R2-2/q3-2.84-plus-0.005-result.json |
| q3-2.84-minus-0.01 | R2-2/q3-2.84-minus-0.01-manifest.json | R2-2/q3-2.84-minus-0.01-result.json |
| q3-2.84-plus-0.01 | R2-2/q3-2.84-plus-0.01-manifest.json | R2-2/q3-2.84-plus-0.01-result.json |
| q3-2.84-minus-0.02 | R2-2/continuation-2026-11-25/q3-2.84-minus-0.02-manifest.json | R2-2/continuation-2026-11-25/q3-2.84-minus-0.02-result.json |
