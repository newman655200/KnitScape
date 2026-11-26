# R3-a 刚度比延伸扫描

日期：2026-11-26（Asia/Shanghai）。任务依据：[R3-a 任务书](../../R3A_STIFFNESS_RATIO_EXTENSION_TASK.md)。研究基线为 main @ 72435ba，R3a-0 文档收尾提交为 52699ef。报告初稿建立于 R3a-1；当前实际运行状态与判读见下列结果记录。

## 等价性检查

固定 l=2.84 mm，两次初值均为 R2-3 的 `qc-2.84-K0.5-result.json` 终态 cell。材料参数从原 `step3-hossain-2.84-input.json` 调用 `createFabricFormParams()` 重建，分别只覆盖 K×1/4 或 B×4；不以 K×0.5 的材料值作为倍数基准。前者属于延续链目标，后续直接复用。

W/H 相对差及 |ΔS|/W 以 K×1/4 解为分母，门槛为 1e-5。total、bending、contact、barrier 能量按 `abs(E_B4 - 4*E_Kquarter) <= abs(4*E_Kquarter)*1e-5` 判断；两边严格零时比值和相对差记 null，并单列零绝对残差，不把 0/0 写成比值 4。barrierFraction 是占比，不按能量分项乘四。密度比较和迭代数均报告，迭代数不同不构成失败。

<!-- R3A-GENERATED:equivalence:START -->
### R3a-1 实际结果

R3a-1：COMPLETE；本阶段记录 2 次运行；截至该阶段累计实际求解 2/37 次。

完整精度及来源：[equivalence-summary.json](equivalence-summary.json)。

| 运行 | l/mm | K倍率 | B倍率 | 尝试/来源 | status | iter | 耗时/s | shearBranch | 势垒支撑区 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| r3a-2.84-K0.25 | 2.84 | 1/4 | 1 | direct | CONVERGED | 2975 | 140.9223804 | false | false |
| equivalence-2.84-B4 | 2.84 | 1 | 4 | equivalence | CONVERGED | 2975 | 113.1351788 | false | false |

| 运行 | W/mm | H/mm | S/mm | 横密/cm⁻¹ | 纵密/cm⁻¹ | kw | kc |
| --- | --- | --- | --- | --- | --- | --- | --- |
| r3a-2.84-K0.25 | 0.7233501267 | 0.524526863108 | -1.36431883544e-8 | 13.8245638328 | 19.0648004961 | 3.92617612851 | 5.4144033409 |
| equivalence-2.84-B4 | 0.7233501267 | 0.524526863108 | -1.36431883544e-8 | 13.8245638328 | 19.0648004961 | 3.92617612851 | 5.4144033409 |

| 运行 | E_total/N·mm | E_bending/N·mm | E_contact/N·mm | E_barrier/N·mm | barrierFraction | 分项和相对差 | 分项和检查 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| r3a-2.84-K0.25 | 0.0204288762629 | 0.0197714022573 | 0.000657474005658 | 0 | 0 | 0 | 通过 |
| equivalence-2.84-B4 | 0.0817155050517 | 0.079085609029 | 0.00262989602263 | 0 | 0 | 0 | 通过 |

| 运行 | minDistanceOverDe | 总激活段对 | 势垒支撑区距离阈值 | 势垒支撑区 |
| --- | --- | --- | --- | --- |
| r3a-2.84-K0.25 | 0.902307755589 | 222 | 0.55 | false |
| equivalence-2.84-B4 | 0.902307755589 | 222 | 0.55 | false |

| 运行 | 接触组 | 激活段对 | minDistanceOverDe |
| --- | --- | --- | --- |
| r3a-2.84-K0.25 | waleSpacing | 18 | 0.911186250075 |
| r3a-2.84-K0.25 | courseSpacing | 167 | 0.902307755589 |
| r3a-2.84-K0.25 | diagonal | 19 | 0.934061077148 |
| r3a-2.84-K0.25 | sameLoop | 18 | 0.911186281218 |
| equivalence-2.84-B4 | waleSpacing | 18 | 0.911186250075 |
| equivalence-2.84-B4 | courseSpacing | 167 | 0.902307755589 |
| equivalence-2.84-B4 | diagonal | 19 | 0.934061077148 |
| equivalence-2.84-B4 | sameLoop | 18 | 0.911186281218 |

下列新运行路径以 summary 中的 archiveRoot 为根；历史复用行没有新运行 manifest 或新初值记录。

| 运行 | manifest | 完整 result | initial cell 来源 | 输入/原始输入 |
| --- | --- | --- | --- | --- |
| r3a-2.84-K0.25 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-1/r3a-2.84-K0.25-manifest.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-1/r3a-2.84-K0.25-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r2-slope-2026-11-25/R2-3/qc-2.84-K0.5-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-1/r3a-2.84-K0.25-input.json |
| equivalence-2.84-B4 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-1/equivalence-2.84-B4-manifest.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-1/equivalence-2.84-B4-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r2-slope-2026-11-25/R2-3/qc-2.84-K0.5-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-1/equivalence-2.84-B4-input.json |

汇总比较结果：**通过**；阈值 0.00001。运行 (i)=r3a-2.84-K0.25，(ii)=equivalence-2.84-B4。

| 几何量 | 相对差/归一化差 | 分母 | 口径 |
| --- | --- | --- | --- |
| W | 0 | 0.7233501267 | abs(W_ii−W_i)/abs(W_i) |
| H | 0 | 0.524526863108 | abs(H_ii−H_i)/abs(H_i) |
| S | 0 | 0.7233501267 | abs(S_ii−S_i)/W_i |

| 密度 | (i)/cm⁻¹ | (ii)/cm⁻¹ | 相对差（仅报告） |
| --- | --- | --- | --- |
| waleDensityPerCm | 13.8245638328 | 13.8245638328 | 0 |
| courseDensityPerCm | 19.0648004961 | 19.0648004961 | 0 |

| 能量 | (i)/N·mm | (ii)/N·mm | 4×(i)/N·mm | ii/i | 绝对残差/N·mm | 距4相对差 | 检查 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | 0.0204288762629 | 0.0817155050517 | 0.0817155050517 | 4 | 0 | 0 | 通过 |
| bending | 0.0197714022573 | 0.079085609029 | 0.079085609029 | 4 | 0 | 0 | 通过 |
| contact | 0.000657474005658 | 0.00262989602263 | 0.00262989602263 | 4 | 0 | 0 | 通过 |
| barrier | 0 | 0 | 0 | 未记录/不适用 | 0 | 未记录/不适用 | 通过 |

能量比或相对差为 null 时显示“未记录/不适用”；严格双零的比值未定义，检查依据绝对残差及 analysis.energy 各项的 passed。

| 能量 | 比较说明 |
| --- | --- |
| total | abs(E_ii-4*E_i) <= abs(4*E_i)*1e-5 |
| bending | abs(E_ii-4*E_i) <= abs(4*E_i)*1e-5 |
| contact | abs(E_ii-4*E_i) <= abs(4*E_i)*1e-5 |
| barrier | Both exactly zero: strictly satisfies the homogeneous equation 0 = 4*0; ratio and relative difference are undefined. |

barrierFraction：(i)=0，(ii)=0；占比不乘四。迭代数：(i)=2975，(ii)=2975；不同不构成失败。
<!-- R3A-GENERATED:equivalence:END -->

## 延续链

预登记三条链：l=2.77、2.84、2.90 mm，各从同一 l 的 R2 K×0.5 已收敛终态开始，依次 K×1/4 → 1/8 → 1/16 → 1/44。直接目标未收敛时，仅允许几何中点与一次目标重试；全部尝试保留。跨阶段总求解次数上限为 37，复用不重算。

## 判读

主判据仅取 K×1/44 的三个目标点：任何一点 |S|/W>1e-4，则为“不确定（分支混合）”；否则 b_wale≤−0.9 为“一致”，b_wale≥−0.6 为“不足以解释”，两者之间为“不确定”。阈值按未舍入数值执行。其他档有剪切点时，该档仅作混合分支描述。尚未完成目标求解时不作最终判读。

## 局限与数据来源

本任务是模型诊断，不是标定，不选择、调整或推荐材料参数。主判据以“充分放松态约 −1”为前提，该前提须由用户侧 D0 实物测量检验；本判读只说明模型能否到达 −1，不说明真实面料的斜率是多少。Hossain 对照为干放松态，不能与无摩擦模型平衡直接等同。三点拟合仅描述给定的窄长度区间，不是普适幂律。

原资料做过 HATRA 测量，但 2.77/2.84/2.90 mm 仍按原输入的给纱设定值使用，实测数值待 S1 File 核对；摘要 19.68 tex 与用户提供 19.78 tex 的差异也待核对，本任务原样沿用 19.78 tex。真实纱径及其他未知物性仍为 UNKNOWN。GSM 不作为独立观测或本任务判据。来源更正见 [Hossain 记录](../t1-convergence-2026-11-23/REFERENCE_DATA_HOSSAIN2025.md)。

| 字段 | 记录 |
| --- | --- |
| Value | 两份 summary 的未舍入逐次标量及原材料 provenance；表格只作显示舍入，不据此判定 |
| Unit | l/W/H/S：mm；横密/纵密：1/cm；能量：N·mm；B：N·mm²；K及倍率、kw/kc、barrierFraction、min/d_e、对数斜率：无量纲；激活段对：计数；耗时：ms或明确标为s |
| Source | R3-a 任务 §2、§4；三份 step3-hossain-*-input.json；R2-3 qc-*-K0.5-result.json；各次 input/result/manifest 与 summary |
| Measurement / derivation principle | T1 自由平衡；密度=10m/W、10n/H（本组 m=n=1），kw/kc=对应密度×l/10；含截距等权 ln(密度) 对 ln(l) OLS；偏差=100×(T1/干放松参照−1)；非新增实物测量 |
| Confidence | MODEL_DERIVED_DIAGNOSTIC；覆盖字段为 DIAGNOSTIC_OVERRIDE，不是材料测量或因果验证；原参数标签原样保留 |
| Applicable state | T1 N64 无摩擦普通纬平针自由平衡分支；数值设置沿用 q=12、maxIterations=24000、innerIterations=800、memorySize=180；不声称真实充分放松或干放松验证 |

完整结果、输入、日志及逐次 manifest 根目录：`C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/`。逐次 manifest 仅计算本次输入 SHA-256，保留 HEAD、环境、初值来源、参数覆盖及六字段 provenance。未运行完整求解金标准、额外性能测量或额外文件哈希。

<!-- R3A-GENERATED:verification:START -->
### 实际计数与验证证据位置

R3a-1：COMPLETE；本阶段记录 2 次运行；截至该阶段累计实际求解 2/37 次。

本报告渲染不执行验证或求解；截至 R3a-1 的既有日志仅按所在步骤列出，历史日志不算本步验收。

| 步骤 | 既有日志/记录 | 记录值/说明 |
| --- | --- | --- |
| R3a-0 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-0/build.log | 日志位置；存在不等于验收通过 |
| R3a-0 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-0/validate.log | 日志位置；存在不等于验收通过 |
| R3a-0 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-0/verification.json | {"validateExit":0,"buildExit":0} |
| R3a-1 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-1/build.log | 日志位置；存在不等于验收通过 |
| R3a-1 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-1/study.log | 日志位置；存在不等于验收通过 |
| R3a-1 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-1/validate.log | 日志位置；存在不等于验收通过 |
| R3a-1 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-1/verification.json | {"buildExit":0,"validateExit":0} |

全局求解计数来源：C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/study-ledger.json；阶段状态来源：各阶段 study-manifest.json 与两份 summary。
<!-- R3A-GENERATED:verification:END -->
