# R2 T1 横密斜率机制诊断

日期：2026-11-25。任务依据：[R2 任务书](../../R2_SLOPE_SENSITIVITY_TASK.md)。Q2 已完成；Q3 已完成；QC 与 R2-4 尚未执行。

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

## Q3：锁定宽度刚度与剪切分支

第二次裁定已接受 −2% 点，并更正第一次未检查 S 的判断：l=2.84 mm 的 −1%、−2% 点处于压缩诱发的剪切分支。两次裁定与历史停止记录均保留在任务书 §10。旧五点只补充剪切标记，未重新求解；原始结果和历史 manifest 保留。

当前状态：**COMPLETE，10/10 点**。所有 Q3 点均 CONVERGED。 本轮新增 5 点。

### 基准与计算口径

各点独立以对应 after.json 终态为初值，锁定 W=W*(1+δ)，H、S 及自由节点松弛。N64、q=12、maxIterations=24000、innerIterations=800、memorySize=180 及全部材料参数保持原值。δ=0 直接复用 after.json。依据 R2-0（22764b6）历史 N16 验收：W* 锁定能量相对差 0，|F_W|W*/E=1.7222211633043253e-8；这不是本轮新验证。

| l/mm | W*/mm | H*/mm | S*/mm | shearBranch | E_total/N·mm | E_bending/N·mm | E_contact/N·mm | E_barrier/N·mm | 接触能占比/% |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.77 | 0.745680584495 | 0.482017502454 | 1.14003380267e-9 | false | 0.0224053295311 | 0.0217801416751 | 0.000625187855999 | 0 | 2.79035331809 |
| 2.84 | 0.753408372189 | 0.502415143779 | 2.41442306013e-10 | false | 0.0212073096521 | 0.0207673970098 | 0.000439912642322 | 0 | 2.0743444102 |
| 2.9 | 0.759373526085 | 0.519692433144 | -4.0938589441e-9 | false | 0.0203155965258 | 0.0199896226441 | 0.000325973881647 | 0 | 1.6045498897 |

基准接触能占比为 1.60%–2.79%；任务背景的 2.1%–2.8% 未覆盖第三点，此处按 JSON 实值报告。能量占比不等于有效刚度份额。剪切标记严格按 |S|/W > 1e-4 计算，等号处为 false，不更改主判读。

### 逐点结果

| 运行 | 本轮处理 | δ | 状态 | 迭代 | 耗时/s | W/mm | H/mm | S/mm | \|S\|/W | shearBranch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| q3-2.84-minus-0.005 | 复用 | -0.005 | CONVERGED | 3035 | 82.1669624 | 0.749641330328 | 0.503772594319 | -2.8566582299e-10 | 3.81070001656e-10 | false |
| q3-2.84-plus-0.005 | 复用 | 0.005 | CONVERGED | 3050 | 112.2733786 | 0.75717541405 | 0.501054586578 | 1.04747986742e-7 | 1.38340448988e-7 | false |
| q3-2.84-minus-0.01 | 复用 | -0.01 | CONVERGED | 3525 | 142.6351175 | 0.745874288467 | 0.504911478493 | 0.000954967660329 | 0.00128033326138 | true |
| q3-2.84-plus-0.01 | 复用 | 0.01 | CONVERGED | 2925 | 131.1240386 | 0.760942455911 | 0.499691690566 | 6.61289665051e-9 | 8.69040306418e-9 | false |
| q3-2.84-minus-0.02 | 复用 | -0.02 | CONVERGED | 4150 | 177.1584203 | 0.738340204745 | 0.505610880633 | 0.00343060692845 | 0.00464637697691 | true |
| q3-2.84-plus-0.02 | 新增 | 0.02 | CONVERGED | 4700 | 148.1759769 | 0.768476539632 | 0.496874389202 | -7.18416104267e-8 | 9.34857561963e-8 | false |
| q3-2.77-minus-0.01 | 新增 | -0.01 | CONVERGED | 3975 | 88.0698421 | 0.73822377865 | 0.484435179391 | 0.00034271782989 | 0.0004642465331 | true |
| q3-2.77-plus-0.01 | 新增 | 0.01 | CONVERGED | 2950 | 72.8440712 | 0.75313739034 | 0.479208775904 | 1.04552179051e-7 | 1.3882218622e-7 | false |
| q3-2.9-minus-0.01 | 新增 | -0.01 | CONVERGED | 3675 | 76.4892574 | 0.751779790824 | 0.522353694639 | -0.000124233019961 | 0.00016525187492 | true |
| q3-2.9-plus-0.01 | 新增 | 0.01 | CONVERGED | 2800 | 54.3417712 | 0.766967261346 | 0.517029448983 | 1.03607359534e-7 | 1.35087069235e-7 | false |

| 运行 | E_total/N·mm | E_bending/N·mm | E_contact/N·mm | E_barrier/N·mm | min/d_e | 总段对 | 纵行段对 | 横列段对 | 斜向段对 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| q3-2.84-minus-0.005 | 0.0212114580817 | 0.020724991878 | 0.000486466203747 | 0 | 0.930048239353 | 146 | 14 | 110 | 8 |
| q3-2.84-plus-0.005 | 0.0212113246492 | 0.0208111614465 | 0.000400163202768 | 0 | 0.944072983191 | 146 | 13 | 111 | 9 |
| q3-2.84-minus-0.01 | 0.0212240603946 | 0.0206952248786 | 0.00052883551603 | 0 | 0.925136169934 | 146 | 14 | 114 | 4 |
| q3-2.84-plus-0.01 | 0.0212231118142 | 0.0208562457588 | 0.000366866055435 | 0 | 0.951349855359 | 140 | 9 | 113 | 9 |
| q3-2.84-minus-0.02 | 0.0212559006209 | 0.0207252627747 | 0.000530637846165 | 0 | 0.927835714652 | 146 | 21 | 76 | 40 |
| q3-2.84-plus-0.02 | 0.0212678396433 | 0.0209506154509 | 0.000317224192345 | 0 | 0.959306771749 | 130 | 7 | 104 | 12 |
| q3-2.77-minus-0.01 | 0.0224231788284 | 0.021693508603 | 0.000729670225332 | 0 | 0.914508313361 | 165 | 16 | 131 | 2 |
| q3-2.77-plus-0.01 | 0.0224225471198 | 0.0218933615827 | 0.000529185537144 | 0 | 0.939519180888 | 164 | 13 | 119 | 19 |
| q3-2.9-minus-0.01 | 0.0203312912197 | 0.0199267205443 | 0.000404570675383 | 0 | 0.935117551986 | 133 | 13 | 104 | 3 |
| q3-2.9-plus-0.01 | 0.020330373667 | 0.0200599678803 | 0.000270405786662 | 0 | 0.960682513549 | 120 | 9 | 96 | 6 |

所有接触组的计数及组内 min/d_e 保留在汇总 runs[*].groups；这些量均只记录，不用于停止。反力按 F_W=g_bending,W+g_contact,W+(Jᵀλ)_W 分解，contact 梯度已含势垒，不重复相加。下表单位均为 N。

| 运行 | F_W | g_bending,W | g_contact,W（含势垒） | (Jᵀλ)_W | 三项和 | 三项和−F_W |
| --- | --- | --- | --- | --- | --- | --- |
| q3-2.84-minus-0.005 | -0.00222478080975 | -0.00272161461089 | -0.0126157106623 | 0.0131125444634 | -0.00222478080975 | 0 |
| q3-2.84-plus-0.005 | 0.00211386147324 | -0.00254224292732 | -0.00892006927788 | 0.0135761736784 | 0.00211386147324 | 0 |
| q3-2.84-minus-0.01 | -0.00412366502413 | -0.00487589320185 | -0.0134280005038 | 0.0141802286815 | -0.00412366502413 | 0 |
| q3-2.84-plus-0.01 | 0.00412725879242 | -0.00245674735054 | -0.00722759375313 | 0.0138115998961 | 0.00412725879242 | 0 |
| q3-2.84-minus-0.02 | -0.00429882353476 | -0.0116589533865 | 0.0055450536181 | 0.00181507623361 | -0.00429882353476 | 0 |
| q3-2.84-plus-0.02 | 0.00762132418991 | -0.00141188941759 | -0.00441893314642 | 0.0134521467539 | 0.00762132418991 | 0 |
| q3-2.77-minus-0.01 | -0.00422601086645 | -0.00512684497956 | -0.0162688347392 | 0.0171696688523 | -0.00422601086645 | 0 |
| q3-2.77-plus-0.01 | 0.00454467581105 | -0.000427129215871 | -0.0095131518143 | 0.0144849568412 | 0.00454467581105 | 0 |
| q3-2.9-minus-0.01 | -0.00420906505228 | -0.00553330672664 | -0.0112891587341 | 0.0126134004085 | -0.00420906505228 | 0 |
| q3-2.9-plus-0.01 | 0.00379334939103 | -0.00297449424397 | -0.00521990370222 | 0.0119877473372 | 0.00379334939103 | 0 |

### 主判据、步长敏感性与一致性

h=|δ|W*；k_X=[E_X(+δ)−2E_X(0)+E_X(−δ)]/h²；s_c=(k_contact+k_barrier)/k_total。1% 主点及 0.5%/2% 步长检查的计算口径和阈值均不变：s_c≥0.6 为接触为主，s_c≤0.4 为弯曲为主，之间为不确定。三个步长跨区间则最终为“不确定（步长敏感）”。

| l/mm | \|δ\| | k_total / N/mm | k_bending | k_contact | k_barrier | s_c | 原阈值判读 | 含剪切分支点 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.77 | 0.01 | 0.630654547411 | 0.478146497925 | 0.152508049486 | 0 | 0.241825021498 | 横向刚度以弯曲为主，与推测矛盾 | true |
| 2.84 | 0.005 | 0.57526983549 | 0.0957890686329 | 0.479480766857 | 0 | 0.833488455811 | 横向刚度以接触为主，与推测一致 | false |
| 2.84 | 0.01 | 0.573493977177 | 0.293796819933 | 0.279697157244 | 0 | 0.487707226885 | 不确定 | true |
| 2.84 | 0.02 | 0.480603912799 | 0.621380361048 | -0.14077644825 | 0 | -0.292915734768 | 横向刚度以弯曲为主，与推测矛盾 | true |
| 2.9 | 0.01 | 0.52843029168 | 0.129075873107 | 0.399354418573 | 0 | 0.755737180212 | 横向刚度以接触为主，与推测一致 | true |

| l/mm | \|δ\| | k_total−Σk_X / N/mm | 刚度和相对差 | k_F / N/mm | k_F−k_total / N/mm | 反力刚度相对差 |
| --- | --- | --- | --- | --- | --- | --- |
| 2.77 | 0.01 | -3.89688281643e-14 | 6.17910840797e-14 | 0.588099439618 | -0.0425551077935 | 0.0674776832549 |
| 2.84 | 0.005 | 1.26121335597e-13 | 2.19238569132e-13 | 0.575868605014 | 0.000598769524161 | 0.00104084985379 |
| 2.84 | 0.01 | 3.43058914609e-14 | 5.98190963221e-14 | 0.547573143671 | -0.0259208335059 | 0.0451980919373 |
| 2.84 | 0.02 | 1.14352971536e-14 | 2.37935997796e-14 | 0.395540724151 | -0.0850631886476 | 0.176992293201 |
| 2.9 | 0.01 | 5.26245713672e-14 | 9.95865910714e-14 | 0.526908969593 | -0.0015213220871 | 0.00287894564534 |

原停止 #5 仍按刚度和相对差 >1e-6 或反力刚度相对差 >20% 执行。实际检查：均未触发。1% 主点 s_c=0.48770722688527285，判为“不确定”。三步长最终判读：**不确定（步长敏感）**。按第二次裁定注明原因：压缩侧出现剪切分岔。

### 对称分支内的描述性数据

l=2.84 mm、δ=0.5%：s_c=0.8334884558106854，k_total=0.575269835490086、k_bending=0.09578906863286113、k_contact=0.47948076685709884 N/mm。两侧点的 shearBranch 均为 false。该值作为“对称分支内的描述性数据”单列，仍保留在原三步长比较中，不替代 1% 主判据或最终判读。

### 单侧二阶差分（仅描述，不参与判读）

压缩侧：[E_X(−1%)−2E_X(−0.5%)+E_X(0)]/(0.005W*)²；拉伸侧用 +1%、+0.5%。仅用已有点，不新增工况。

| 侧别 | k_total / N/mm | k_bending | k_contact | k_barrier | s_c | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| 压缩 | 0.595738077661 | 0.890598608601 | -0.29486053094 | 0 | -0.494949948637 | 含剪切分支点，不代表对称分支刚度 |
| 拉伸 | 0.547698160067 | 0.0930105338639 | 0.454687626203 | 0 | 0.830179210658 | 所用点均无剪切标记 |

压缩侧含 −1% 剪切分支点：**含剪切分支点，不代表对称分支刚度**。这些分项沿耦合松弛路径计算，不是独立材料刚度；负分项按公式保留。

### 第二次裁定的停止条件 #6

只检查未收敛、E 从 δ=0 向两侧非递减、非零 δ 点的 F_W 与 δ 严格同号、H 随 δ 单调。F_W 的平台或非单调只记录；接触计数及最小间距均不用于停止。δ=0 的 F_W 列取原自由解 R_W，不要求其符号为零。

l=2.77 mm：压缩侧 E 非递减=true；拉伸侧 E 非递减=true；H 单调=true。

| δ | E_total/N·mm | F_W/N | H/mm | S/mm | shearBranch | min/d_e | Δ(min/d_e) | 纵行段对 | 横列段对 | 斜向段对 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| -0.01 | 0.0224231788284 | -0.00422601086645 | 0.484435179391 | 0.00034271782989 | true | 0.914508313361 | -0.0108811758649 | 16 | 131 | 2 |
| 0 | 0.0224053295311 | -1.5803952591e-10 | 0.482017502454 | 1.14003380267e-9 | false | 0.925389489226 | 0 | 14 | 123 | 19 |
| 0.01 | 0.0224225471198 | 0.00454467581105 | 0.479208775904 | 1.04552179051e-7 | false | 0.939519180888 | 0.0141296916622 | 13 | 119 | 19 |

l=2.84 mm：压缩侧 E 非递减=true；拉伸侧 E 非递减=true；H 单调=true。

| δ | E_total/N·mm | F_W/N | H/mm | S/mm | shearBranch | min/d_e | Δ(min/d_e) | 纵行段对 | 横列段对 | 斜向段对 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| -0.02 | 0.0212559006209 | -0.00429882353476 | 0.505610880633 | 0.00343060692845 | true | 0.927835714652 | -0.00913436141784 | 21 | 76 | 40 |
| -0.01 | 0.0212240603946 | -0.00412366502413 | 0.504911478493 | 0.000954967660329 | true | 0.925136169934 | -0.0118339061363 | 14 | 114 | 4 |
| -0.005 | 0.0212114580817 | -0.00222478080975 | 0.503772594319 | -2.8566582299e-10 | false | 0.930048239353 | -0.00692183671648 | 14 | 110 | 8 |
| 0 | 0.0212073096521 | -2.69951972234e-10 | 0.502415143779 | 2.41442306013e-10 | false | 0.93697007607 | 0 | 14 | 109 | 9 |
| 0.005 | 0.0212113246492 | 0.00211386147324 | 0.501054586578 | 1.04747986742e-7 | false | 0.944072983191 | 0.00710290712069 | 13 | 111 | 9 |
| 0.01 | 0.0212231118142 | 0.00412725879242 | 0.499691690566 | 6.61289665051e-9 | false | 0.951349855359 | 0.0143797792888 | 9 | 113 | 9 |
| 0.02 | 0.0212678396433 | 0.00762132418991 | 0.496874389202 | -7.18416104267e-8 | false | 0.959306771749 | 0.0223366956789 | 7 | 104 | 12 |

l=2.9 mm：压缩侧 E 非递减=true；拉伸侧 E 非递减=true；H 单调=true。

| δ | E_total/N·mm | F_W/N | H/mm | S/mm | shearBranch | min/d_e | Δ(min/d_e) | 纵行段对 | 横列段对 | 斜向段对 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| -0.01 | 0.0203312912197 | -0.00420906505228 | 0.522353694639 | -0.000124233019961 | true | 0.935117551986 | -0.0109156317242 | 13 | 104 | 3 |
| 0 | 0.0203155965258 | -1.84934506944e-10 | 0.519692433144 | -4.0938589441e-9 | false | 0.94603318371 | 0 | 13 | 94 | 6 |
| 0.01 | 0.020330373667 | 0.00379334939103 | 0.517029448983 | 1.03607359534e-7 | false | 0.960682513549 | 0.0146493298389 | 9 | 96 | 6 |

#6 停止理由：无。

### 来源、归档与简化验证

| 字段 | 记录 |
| --- | --- |
| Value | 上表至多 12 位有效数字；q3-summary.json 保留完整精度的全部标量、中心/单侧差分及逐项停止检查 |
| Unit | l/W/H/S：mm；能量：N·mm；F_W及分项：N；刚度：N/mm；δ、s_c、\|S\|/W、min/d_e：无量纲；接触段对：计数；shearBranch：布尔值 |
| Source | 原三份 input/after.json；逐点 result/manifest；新增分支判定与停止规则来源为任务书 §10 第二次裁定 |
| Measurement / derivation principle | 锁定宽度受约束最小化；反力 g+Jᵀλ；冻结中心差分与单侧差分；shearBranch=(abs(S)/W>1e-4) |
| Confidence | MODEL_DERIVED_DIAGNOSTIC；原材料 ASSUMPTION/DERIVED 来源标签保留；非实物测量或因果验证 |
| Applicable state | T1 N64 无摩擦纬平针模型，包含表中标记的剪切分支；l 为给纱设定值，放松后复测和真实纱径仍未知 |

本轮续跑基线 HEAD：505afdaac357add731ca6f63e11284aa2f032fae；新增归档：C:/Users/liuchen/Documents/KnitScape/archives/r2-slope-2026-11-25/R2-2/continuation-2-2026-11-25/。prior-summary.json 保存续跑前五点汇总；两次原停止归档不覆盖。
简化验证采用研究分析自检、续跑规则自检、语法检查、结果核对和 npm run build。未运行金标准、性能基准或文件哈希；全量 validate 包含金标准，未运行。运行耗时是每次求解记录，不是性能测量。旧哈希仅为历史记录，新 manifest 记录路径、HEAD、环境、参数、时间和状态。实际退出码见本轮 verification.json。

| 运行 | manifest（相对归档根） | result（相对归档根） |
| --- | --- | --- |
| q3-2.84-minus-0.005 | R2-2/q3-2.84-minus-0.005-manifest.json | R2-2/q3-2.84-minus-0.005-result.json |
| q3-2.84-plus-0.005 | R2-2/q3-2.84-plus-0.005-manifest.json | R2-2/q3-2.84-plus-0.005-result.json |
| q3-2.84-minus-0.01 | R2-2/q3-2.84-minus-0.01-manifest.json | R2-2/q3-2.84-minus-0.01-result.json |
| q3-2.84-plus-0.01 | R2-2/q3-2.84-plus-0.01-manifest.json | R2-2/q3-2.84-plus-0.01-result.json |
| q3-2.84-minus-0.02 | R2-2/continuation-2026-11-25/q3-2.84-minus-0.02-manifest.json | R2-2/continuation-2026-11-25/q3-2.84-minus-0.02-result.json |
| q3-2.84-plus-0.02 | R2-2/continuation-2-2026-11-25/q3-2.84-plus-0.02-manifest.json | R2-2/continuation-2-2026-11-25/q3-2.84-plus-0.02-result.json |
| q3-2.77-minus-0.01 | R2-2/continuation-2-2026-11-25/q3-2.77-minus-0.01-manifest.json | R2-2/continuation-2-2026-11-25/q3-2.77-minus-0.01-result.json |
| q3-2.77-plus-0.01 | R2-2/continuation-2-2026-11-25/q3-2.77-plus-0.01-manifest.json | R2-2/continuation-2-2026-11-25/q3-2.77-plus-0.01-result.json |
| q3-2.9-minus-0.01 | R2-2/continuation-2-2026-11-25/q3-2.9-minus-0.01-manifest.json | R2-2/continuation-2-2026-11-25/q3-2.9-minus-0.01-result.json |
| q3-2.9-plus-0.01 | R2-2/continuation-2-2026-11-25/q3-2.9-plus-0.01-manifest.json | R2-2/continuation-2-2026-11-25/q3-2.9-plus-0.01-result.json |
