# R3-a 刚度比延伸扫描

<!-- R3A-GENERATED:overview:START -->
## 结果总表

| 项目/K倍率 | 等价性/主判读 | b_wale | b_course | 分支/状态 |
| --- | --- | --- | --- | --- |
| 等价性 | 通过 | 未记录/不适用 | 未记录/不适用 | COMPLETE |
| K×2 | 仅描述 | -0.273959454665 | -1.78576248255 | 对称分支 |
| K×1 | 仅描述 | -0.397275881101 | -1.64152203848 | 对称分支 |
| K×0.5 | 仅描述 | -0.534149007172 | -1.46989656347 | 对称分支 |
| K×1/4 | 仅描述 | -0.669361147327 | -1.29642309021 | 对称分支 |
| K×1/8 | 仅描述 | -0.790144724022 | -1.15238261192 | 对称分支 |
| K×1/16 | 仅描述 | -1.24972096968 | -0.92172627943 | 对称分支 |
| K×1/44 | 一致 | -1.16950625859 | -0.847171074565 | 对称分支 |
| 主判据 | 一致 | -1.16950625859 | 未记录/不适用 | COMPLETE |

综合说明（只依据已记录结果）：

- 等价性状态 COMPLETE，比较结果通过。
- 累计实际求解 14/37；跨阶段去重复的已登记收敛目标 12/12。
- 主判据：一致。K×1/44 的 b_wale≤−0.9，符合预登记的“抗弯刚度口径足以把模型斜率拉到约 −1”条件，与“模型段可由 B 口径解释”一致；范围限于本模型与这些工况。
- K×1/44 分支混合记录：false；混合时斜率仅描述。
- K×1/44 求解斜率与预登记外推 −1.1 的差：-0.0695062585885。
- 横密斜率非单调：K×1/16 为 −1.2497209696777725，至 K×1/44 为 −1.1695062585885128；局部导数 −0.07929481889865535，只作描述。
- K×1/16 的横密 log SSE=0.000020058163583183742，高于其余档；完整残差保留，没有据此改变拟合或阈值。
- 判读只说明模型能否到达约 −1；真实面料斜率与充分放松态前提仍待 D0 检验。
<!-- R3A-GENERATED:overview:END -->

## 架构师审查补注（2026-11-26）

主判据“一致”按预登记规则成立，阈值不变。机制限定：K×1/44 的 −1.17 出现在纵行间接触完全脱开的状态里（三个 l 的 waleSpacing 激活段对数均为 0，最小间距 1.52~1.61 d_e，W 比 K×1/16 增大约 20%）。因此结论应理解为“抗弯刚度口径能让模型斜率到约 −1，但只能通过纵行间接触完全脱开这一状态转变实现”。K×1/16 的 −1.25 与高残差来自转变跨在三个 l 之间（2.90 已脱开，2.84 剩 4 对，2.77 剩 11 对），属于状态混合，只作描述。预登记守卫未覆盖接触状态转变，是任务书的遗漏；脱开后的平台与迟滞由 R3-b 检查。

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

运行中断记录（2026-11-26）：第 11 次尝试 `r3a-2.9-K0.125` 已写入 input/manifest，但进程结束且没有 result 文件；具体中断原因未知，不记为数值未收敛，迭代数、完整耗时和终态不填造。用户随后指示“继续”，按任务书 §10 显式恢复：保留中断尝试及其计数，以相同保存输入另起 `-resumed` 运行；已完成目标不重算。中断前 ledger/study/summary 快照放在 R3a-2/interruption-2026-11-26/，原逐点 manifest 保留 RUNNING 原状，后续恢复记录另行标明观察到的 INTERRUPTED 状态。数值设置、主阈值、数值失败时的中点重试规则及累计 37 次上限保持不变。

<!-- R3A-GENERATED:chain:START -->
### R3a-2 实际结果

R3a-2：COMPLETE；本阶段记录 12 次运行；截至该阶段累计实际求解 14/37 次。

本阶段 summary 已登记收敛目标 12/12；其中从等价性阶段复用 1 点。中点和失败尝试均列入运行表，复用点不增加求解次数。

完整精度及来源：[r3a-summary.json](r3a-summary.json)。

### 延续链全部新运行（含直接、中点与重试）

| 运行 | l/mm | K倍率 | B倍率 | 尝试/来源 | status | iter | 耗时/s | shearBranch | 势垒支撑区 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| r3a-2.77-K0.25 | 2.77 | 1/4 | 1 | direct | CONVERGED | 3800 | 294.1971142 | false | false |
| r3a-2.77-K0.125 | 2.77 | 1/8 | 1 | direct | CONVERGED | 4175 | 304.8980866 | false | false |
| r3a-2.77-K0.0625 | 2.77 | 1/16 | 1 | direct | CONVERGED | 3950 | 251.9243215 | false | false |
| r3a-2.77-K0.022727272727272728 | 2.77 | 1/44 | 1 | direct | CONVERGED | 4075 | 252.0282882 | false | false |
| r3a-2.84-K0.125 | 2.84 | 1/8 | 1 | direct | CONVERGED | 4000 | 278.79754 | false | false |
| r3a-2.84-K0.0625 | 2.84 | 1/16 | 1 | direct | CONVERGED | 4100 | 304.114744 | false | false |
| r3a-2.84-K0.022727272727272728 | 2.84 | 1/44 | 1 | direct | CONVERGED | 3950 | 231.3677699 | false | false |
| r3a-2.9-K0.25 | 2.9 | 1/4 | 1 | direct | CONVERGED | 4250 | 239.8814832 | false | false |
| r3a-2.9-K0.125 | 2.9 | 1/8 | 1 | direct | INTERRUPTED | 未记录/不适用 | 未记录/不适用 | 未记录/不适用 | 未记录/不适用 |
| r3a-2.9-K0.125-resumed | 2.9 | 1/8 | 1 | direct | CONVERGED | 3225 | 162.5228907 | false | false |
| r3a-2.9-K0.0625 | 2.9 | 1/16 | 1 | direct | CONVERGED | 4950 | 264.7050616 | false | false |
| r3a-2.9-K0.022727272727272728 | 2.9 | 1/44 | 1 | direct | CONVERGED | 4000 | 230.111951 | false | false |

| 运行 | W/mm | H/mm | S/mm | 横密/cm⁻¹ | 纵密/cm⁻¹ | kw | kc |
| --- | --- | --- | --- | --- | --- | --- | --- |
| r3a-2.77-K0.25 | 0.711222851174 | 0.507781093467 | -3.87656075757e-9 | 14.0602906438 | 19.6935256721 | 3.89470050833 | 5.45510661117 |
| r3a-2.77-K0.125 | 0.699590009088 | 0.521193937566 | 2.67479602679e-8 | 14.2940863507 | 19.186715883 | 3.95946191915 | 5.31472029958 |
| r3a-2.77-K0.0625 | 0.70442884466 | 0.530954548055 | 1.32208890896e-8 | 14.1958979616 | 18.8340038458 | 3.93226373537 | 5.21701906528 |
| r3a-2.77-K0.022727272727272728 | 0.845854058663 | 0.512339861277 | 1.28038938955e-8 | 11.8223704167 | 19.5182939213 | 3.27479660543 | 5.4065674162 |
| r3a-2.84-K0.125 | 0.71356478795 | 0.536399847655 | -8.78845024654e-8 | 14.0141444321 | 18.6428091725 | 3.98001701872 | 5.29455780499 |
| r3a-2.84-K0.0625 | 0.722891728145 | 0.544269465182 | 1.16696652685e-7 | 13.8333302356 | 18.3732519271 | 3.9286657869 | 5.21800354729 |
| r3a-2.84-K0.022727272727272728 | 0.870825334765 | 0.523311010204 | 7.99323198905e-9 | 11.4833590627 | 19.1090953659 | 3.26127397381 | 5.42698308391 |
| r3a-2.9-K0.25 | 0.733386406719 | 0.538885579393 | -1.53751631323e-10 | 13.635376806 | 18.5568149945 | 3.95425927374 | 5.38147634841 |
| r3a-2.9-K0.125 | 未记录/不适用 | 未记录/不适用 | 未记录/不适用 | 未记录/不适用 | 未记录/不适用 | 未记录/不适用 | 未记录/不适用 |
| r3a-2.9-K0.125-resumed | 0.725404622646 | 0.549481189861 | 1.81207442691e-8 | 13.7854098083 | 18.1989851236 | 3.9977688444 | 5.27770568586 |
| r3a-2.9-K0.0625 | 0.746224354957 | 0.553821754603 | 8.26336945964e-9 | 13.4007955296 | 18.0563510135 | 3.88623070359 | 5.2363417939 |
| r3a-2.9-K0.022727272727272728 | 0.892467411321 | 0.532636721554 | -4.7841905985e-9 | 11.2048909273 | 18.7745222876 | 3.24941836891 | 5.4446114634 |

| 运行 | E_total/N·mm | E_bending/N·mm | E_contact/N·mm | E_barrier/N·mm | barrierFraction | 分项和相对差 | 分项和检查 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| r3a-2.77-K0.25 | 0.0213401156604 | 0.0204770643137 | 0.000863051346675 | 0 | 0 | 0 | 通过 |
| r3a-2.77-K0.125 | 0.0207368984147 | 0.0198675970801 | 0.000869301334613 | 0 | 0 | 0 | 通过 |
| r3a-2.77-K0.0625 | 0.0201347303079 | 0.0192519050424 | 0.00088282526545 | 0 | 0 | 0 | 通过 |
| r3a-2.77-K0.022727272727272728 | 0.0189825727467 | 0.0175575884024 | 0.00142498434435 | 0 | 0 | 0 | 通过 |
| r3a-2.84-K0.125 | 0.019957675155 | 0.0192606592595 | 0.000697015895517 | 0 | 0 | 0 | 通过 |
| r3a-2.84-K0.0625 | 0.0194596163956 | 0.0186973804037 | 0.000762235991908 | 0 | 0 | 0 | 通过 |
| r3a-2.84-K0.022727272727272728 | 0.0184010276779 | 0.0170757479449 | 0.00132527973309 | 0 | 0 | 0 | 通过 |
| r3a-2.9-K0.25 | 0.0197218100185 | 0.019204054584 | 0.000517755434514 | 0 | 0 | 0 | 通过 |
| r3a-2.9-K0.125 | 未记录/不适用 | 未记录/不适用 | 未记录/不适用 | 未记录/不适用 | 未记录/不适用 | 未记录/不适用 | 尚无比较结果 |
| r3a-2.9-K0.125-resumed | 0.0193418111531 | 0.0187662731412 | 0.000575538011924 | 0 | 0 | 0 | 通过 |
| r3a-2.9-K0.0625 | 0.0189149523698 | 0.0182098301225 | 0.000705122247338 | 0 | 0 | 0 | 通过 |
| r3a-2.9-K0.022727272727272728 | 0.0179268924033 | 0.0166805011501 | 0.00124639125322 | 0 | 0 | 0 | 通过 |

| 运行 | minDistanceOverDe | 总激活段对 | 势垒支撑区距离阈值 | 势垒支撑区 |
| --- | --- | --- | --- | --- |
| r3a-2.77-K0.25 | 0.892224273369 | 240 | 0.55 | false |
| r3a-2.77-K0.125 | 0.847601931744 | 270 | 0.55 | false |
| r3a-2.77-K0.0625 | 0.788481820661 | 290 | 0.55 | false |
| r3a-2.77-K0.022727272727272728 | 0.61244976487 | 310 | 0.55 | false |
| r3a-2.84-K0.125 | 0.86092900424 | 252 | 0.55 | false |
| r3a-2.84-K0.0625 | 0.79998938582 | 266 | 0.55 | false |
| r3a-2.84-K0.022727272727272728 | 0.623860121519 | 300 | 0.55 | false |
| r3a-2.9-K0.25 | 0.910307023487 | 192 | 0.55 | false |
| r3a-2.9-K0.125 | 未记录/不适用 | 未记录/不适用 | 未记录/不适用 | 未记录/不适用 |
| r3a-2.9-K0.125-resumed | 0.869113232382 | 228 | 0.55 | false |
| r3a-2.9-K0.0625 | 0.80572084176 | 242 | 0.55 | false |
| r3a-2.9-K0.022727272727272728 | 0.633304565111 | 292 | 0.55 | false |

| 运行 | 接触组 | 激活段对 | minDistanceOverDe |
| --- | --- | --- | --- |
| r3a-2.77-K0.25 | waleSpacing | 19 | 0.897424926917 |
| r3a-2.77-K0.25 | courseSpacing | 166 | 0.892224273369 |
| r3a-2.77-K0.25 | diagonal | 36 | 0.894440285902 |
| r3a-2.77-K0.25 | sameLoop | 19 | 0.897424867136 |
| r3a-2.77-K0.125 | waleSpacing | 19 | 0.907737412504 |
| r3a-2.77-K0.125 | courseSpacing | 195 | 0.847601931744 |
| r3a-2.77-K0.125 | diagonal | 37 | 0.851463981329 |
| r3a-2.77-K0.125 | sameLoop | 19 | 0.907737655305 |
| r3a-2.77-K0.0625 | waleSpacing | 11 | 0.96236985733 |
| r3a-2.77-K0.0625 | courseSpacing | 225 | 0.788481820661 |
| r3a-2.77-K0.0625 | diagonal | 43 | 0.793190652634 |
| r3a-2.77-K0.0625 | sameLoop | 11 | 0.962370067267 |
| r3a-2.77-K0.022727272727272728 | waleSpacing | 0 | 1.51617246457 |
| r3a-2.77-K0.022727272727272728 | courseSpacing | 262 | 0.61244976487 |
| r3a-2.77-K0.022727272727272728 | diagonal | 48 | 0.632569238349 |
| r3a-2.77-K0.022727272727272728 | sameLoop | 0 | 1.51617221045 |
| r3a-2.84-K0.125 | waleSpacing | 18 | 0.925015066568 |
| r3a-2.84-K0.125 | courseSpacing | 187 | 0.86092900424 |
| r3a-2.84-K0.125 | diagonal | 29 | 0.871700969277 |
| r3a-2.84-K0.125 | sameLoop | 18 | 0.925014984899 |
| r3a-2.84-K0.0625 | waleSpacing | 4 | 0.992403070009 |
| r3a-2.84-K0.0625 | courseSpacing | 219 | 0.79998938582 |
| r3a-2.84-K0.0625 | diagonal | 39 | 0.80423526811 |
| r3a-2.84-K0.0625 | sameLoop | 4 | 0.992403974767 |
| r3a-2.84-K0.022727272727272728 | waleSpacing | 0 | 1.56740140983 |
| r3a-2.84-K0.022727272727272728 | courseSpacing | 254 | 0.623860121519 |
| r3a-2.84-K0.022727272727272728 | diagonal | 46 | 0.643201614482 |
| r3a-2.84-K0.022727272727272728 | sameLoop | 0 | 1.5674013656 |
| r3a-2.9-K0.25 | waleSpacing | 14 | 0.92809186426 |
| r3a-2.9-K0.25 | courseSpacing | 146 | 0.910307023487 |
| r3a-2.9-K0.25 | diagonal | 18 | 0.923761803862 |
| r3a-2.9-K0.25 | sameLoop | 14 | 0.928091859573 |
| r3a-2.9-K0.125-resumed | waleSpacing | 14 | 0.940574511384 |
| r3a-2.9-K0.125-resumed | courseSpacing | 172 | 0.869113232382 |
| r3a-2.9-K0.125-resumed | diagonal | 28 | 0.878477618156 |
| r3a-2.9-K0.125-resumed | sameLoop | 14 | 0.940574475407 |
| r3a-2.9-K0.0625 | waleSpacing | 0 | 1.04468912073 |
| r3a-2.9-K0.0625 | courseSpacing | 207 | 0.80572084176 |
| r3a-2.9-K0.0625 | diagonal | 35 | 0.810925010882 |
| r3a-2.9-K0.0625 | sameLoop | 0 | 1.04468900189 |
| r3a-2.9-K0.022727272727272728 | waleSpacing | 0 | 1.61241139656 |
| r3a-2.9-K0.022727272727272728 | courseSpacing | 248 | 0.633304565111 |
| r3a-2.9-K0.022727272727272728 | diagonal | 44 | 0.653012197929 |
| r3a-2.9-K0.022727272727272728 | sameLoop | 0 | 1.61241125534 |

下列新运行路径以 summary 中的 archiveRoot 为根；历史复用行没有新运行 manifest 或新初值记录。

| 运行 | manifest | 完整 result | initial cell 来源 | 输入/原始输入 |
| --- | --- | --- | --- | --- |
| r3a-2.77-K0.25 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.77-K0.25-manifest.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.77-K0.25-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r2-slope-2026-11-25/R2-3/qc-2.77-K0.5-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.77-K0.25-input.json |
| r3a-2.77-K0.125 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.77-K0.125-manifest.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.77-K0.125-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.77-K0.25-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.77-K0.125-input.json |
| r3a-2.77-K0.0625 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.77-K0.0625-manifest.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.77-K0.0625-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.77-K0.125-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.77-K0.0625-input.json |
| r3a-2.77-K0.022727272727272728 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.77-K0.022727272727272728-manifest.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.77-K0.022727272727272728-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.77-K0.0625-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.77-K0.022727272727272728-input.json |
| r3a-2.84-K0.125 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.84-K0.125-manifest.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.84-K0.125-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-1/r3a-2.84-K0.25-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.84-K0.125-input.json |
| r3a-2.84-K0.0625 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.84-K0.0625-manifest.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.84-K0.0625-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.84-K0.125-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.84-K0.0625-input.json |
| r3a-2.84-K0.022727272727272728 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.84-K0.022727272727272728-manifest.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.84-K0.022727272727272728-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.84-K0.0625-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.84-K0.022727272727272728-input.json |
| r3a-2.9-K0.25 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.9-K0.25-manifest.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.9-K0.25-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r2-slope-2026-11-25/R2-3/qc-2.9-K0.5-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.9-K0.25-input.json |
| r3a-2.9-K0.125 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.9-K0.125-manifest.json | 未记录/不适用 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.9-K0.25-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.9-K0.125-input.json |
| r3a-2.9-K0.125-resumed | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.9-K0.125-resumed-manifest.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.9-K0.125-resumed-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.9-K0.25-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.9-K0.125-resumed-input.json |
| r3a-2.9-K0.0625 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.9-K0.0625-manifest.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.9-K0.0625-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.9-K0.125-resumed-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.9-K0.0625-input.json |
| r3a-2.9-K0.022727272727272728 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.9-K0.022727272727272728-manifest.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.9-K0.022727272727272728-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.9-K0.0625-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/r3a-2.9-K0.022727272727272728-input.json |

### 延续链采用的目标点（指向上述运行或复用点，不再计为新求解）

| l/mm | K倍率 | 运行 | 来源 | 状态 | shearBranch | 势垒支撑区 |
| --- | --- | --- | --- | --- | --- | --- |
| 2.77 | 1/4 | r3a-2.77-K0.25 | direct | CONVERGED | false | false |
| 2.77 | 1/8 | r3a-2.77-K0.125 | direct | CONVERGED | false | false |
| 2.77 | 1/16 | r3a-2.77-K0.0625 | direct | CONVERGED | false | false |
| 2.77 | 1/44 | r3a-2.77-K0.022727272727272728 | direct | CONVERGED | false | false |
| 2.84 | 1/4 | r3a-2.84-K0.25 | 复用 equivalence | CONVERGED | false | false |
| 2.84 | 1/8 | r3a-2.84-K0.125 | direct | CONVERGED | false | false |
| 2.84 | 1/16 | r3a-2.84-K0.0625 | direct | CONVERGED | false | false |
| 2.84 | 1/44 | r3a-2.84-K0.022727272727272728 | direct | CONVERGED | false | false |
| 2.9 | 1/4 | r3a-2.9-K0.25 | direct | CONVERGED | false | false |
| 2.9 | 1/8 | r3a-2.9-K0.125-resumed | direct | CONVERGED | false | false |
| 2.9 | 1/16 | r3a-2.9-K0.0625 | direct | CONVERGED | false | false |
| 2.9 | 1/44 | r3a-2.9-K0.022727272727272728 | direct | CONVERGED | false | false |

### 直接复用的等价性点

| 运行 | l/mm | K倍率 | B倍率 | 尝试/来源 | status | iter | 耗时/s | shearBranch | 势垒支撑区 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| r3a-2.84-K0.25 | 2.84 | 1/4 | 1 | 复用 equivalence，不重算 | CONVERGED | 2975 | 140.9223804 | false | false |

| 运行 | W/mm | H/mm | S/mm | 横密/cm⁻¹ | 纵密/cm⁻¹ | kw | kc |
| --- | --- | --- | --- | --- | --- | --- | --- |
| r3a-2.84-K0.25 | 0.7233501267 | 0.524526863108 | -1.36431883544e-8 | 13.8245638328 | 19.0648004961 | 3.92617612851 | 5.4144033409 |

| 运行 | E_total/N·mm | E_bending/N·mm | E_contact/N·mm | E_barrier/N·mm | barrierFraction | 分项和相对差 | 分项和检查 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| r3a-2.84-K0.25 | 0.0204288762629 | 0.0197714022573 | 0.000657474005658 | 0 | 0 | 0 | 通过 |

| 运行 | minDistanceOverDe | 总激活段对 | 势垒支撑区距离阈值 | 势垒支撑区 |
| --- | --- | --- | --- | --- |
| r3a-2.84-K0.25 | 0.902307755589 | 222 | 0.55 | false |

| 运行 | 接触组 | 激活段对 | minDistanceOverDe |
| --- | --- | --- | --- |
| r3a-2.84-K0.25 | waleSpacing | 18 | 0.911186250075 |
| r3a-2.84-K0.25 | courseSpacing | 167 | 0.902307755589 |
| r3a-2.84-K0.25 | diagonal | 19 | 0.934061077148 |
| r3a-2.84-K0.25 | sameLoop | 18 | 0.911186281218 |

下列新运行路径以 summary 中的 archiveRoot 为根；历史复用行没有新运行 manifest 或新初值记录。

| 运行 | manifest | 完整 result | initial cell 来源 | 输入/原始输入 |
| --- | --- | --- | --- | --- |
| r3a-2.84-K0.25 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-1/r3a-2.84-K0.25-manifest.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-1/r3a-2.84-K0.25-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r2-slope-2026-11-25/R2-3/qc-2.84-K0.5-result.json | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-1/r3a-2.84-K0.25-input.json |

### R2 参照点（复用，不增加本任务求解计数）

| 运行 | l/mm | K倍率 | B倍率 | 尝试/来源 | status | iter | 耗时/s | shearBranch | 势垒支撑区 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| reused-2.77-K2 | 2.77 | 2 | 原参数（复用） | REUSED_EXISTING_RESULT_NOT_A_NEW_SOLVE | CONVERGED | 3400 | 未记录/不适用 | false | false |
| reused-2.84-K2 | 2.84 | 2 | 原参数（复用） | REUSED_EXISTING_RESULT_NOT_A_NEW_SOLVE | CONVERGED | 3275 | 未记录/不适用 | false | false |
| reused-2.9-K2 | 2.9 | 2 | 原参数（复用） | REUSED_EXISTING_RESULT_NOT_A_NEW_SOLVE | CONVERGED | 3214 | 未记录/不适用 | false | false |
| reused-2.77-K1 | 2.77 | 1 | 原参数（复用） | REUSED_EXISTING_RESULT_NOT_A_NEW_SOLVE | CONVERGED | 3746 | 未记录/不适用 | false | false |
| reused-2.84-K1 | 2.84 | 1 | 原参数（复用） | REUSED_EXISTING_RESULT_NOT_A_NEW_SOLVE | CONVERGED | 3800 | 未记录/不适用 | false | false |
| reused-2.9-K1 | 2.9 | 1 | 原参数（复用） | REUSED_EXISTING_RESULT_NOT_A_NEW_SOLVE | CONVERGED | 3575 | 未记录/不适用 | false | false |
| reused-2.77-K0.5 | 2.77 | 0.5 | 原参数（复用） | REUSED_EXISTING_RESULT_NOT_A_NEW_SOLVE | CONVERGED | 4350 | 未记录/不适用 | false | false |
| reused-2.84-K0.5 | 2.84 | 0.5 | 原参数（复用） | REUSED_EXISTING_RESULT_NOT_A_NEW_SOLVE | CONVERGED | 2867 | 未记录/不适用 | false | false |
| reused-2.9-K0.5 | 2.9 | 0.5 | 原参数（复用） | REUSED_EXISTING_RESULT_NOT_A_NEW_SOLVE | CONVERGED | 3075 | 未记录/不适用 | false | false |

| 运行 | W/mm | H/mm | S/mm | 横密/cm⁻¹ | 纵密/cm⁻¹ | kw | kc |
| --- | --- | --- | --- | --- | --- | --- | --- |
| reused-2.77-K2 | 0.759827832757 | 0.473012852764 | -6.48542624199e-10 | 13.1608761471 | 21.1410745851 | 3.64556269274 | 5.85607766008 |
| reused-2.84-K2 | 0.765297784297 | 0.49493931442 | -2.04115302094e-9 | 13.066809032 | 20.2044972154 | 3.71097376508 | 5.73807720917 |
| reused-2.9-K2 | 0.769419401921 | 0.513360584617 | 2.6215171013e-9 | 12.9968128891 | 19.4794853747 | 3.76907573784 | 5.64905075867 |
| reused-2.77-K1 | 0.745680584495 | 0.482017502454 | 1.14003380267e-9 | 13.4105677524 | 20.7461346301 | 3.71472726741 | 5.74667929255 |
| reused-2.84-K1 | 0.753408372189 | 0.502415143779 | 2.41442306013e-10 | 13.2730141702 | 19.9038586393 | 3.76953602433 | 5.65269585355 |
| reused-2.9-K1 | 0.759373526085 | 0.519692433144 | -4.0938589441e-9 | 13.1687498398 | 19.2421504764 | 3.81893745355 | 5.58022363815 |
| reused-2.77-K0.5 | 0.728416715736 | 0.493937553618 | 1.09172036037e-9 | 13.728405436 | 20.2454742037 | 3.80276830578 | 5.60799635442 |
| reused-2.84-K0.5 | 0.738415638732 | 0.512511543946 | -3.15361026169e-10 | 13.5425084132 | 19.5117556241 | 3.84607238936 | 5.54133859724 |
| reused-2.9-K0.5 | 0.746468051723 | 0.528376769451 | 2.76436181546e-8 | 13.3964206196 | 18.9258888319 | 3.88496197969 | 5.48850776126 |

| 运行 | E_total/N·mm | E_bending/N·mm | E_contact/N·mm | E_barrier/N·mm | barrierFraction | 分项和相对差 | 分项和检查 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| reused-2.77-K2 | 0.0227755829088 | 0.022331192388 | 0.000444390520807 | 0 | 0 | 0 | 通过 |
| reused-2.84-K2 | 0.0214648377462 | 0.0211574460008 | 0.000307391745408 | 0 | 0 | 0 | 通过 |
| reused-2.9-K2 | 0.0205053509036 | 0.0202800274127 | 0.000225323490925 | 0 | 0 | 0 | 通过 |
| reused-2.77-K1 | 0.0224053295311 | 0.0217801416751 | 0.000625187855999 | 0 | 0 | 0 | 通过 |
| reused-2.84-K1 | 0.0212073096521 | 0.0207673970098 | 0.000439912642322 | 0 | 0 | 0 | 通过 |
| reused-2.9-K1 | 0.0203155965258 | 0.0199896226441 | 0.000325973881647 | 0 | 0 | 0 | 通过 |
| reused-2.77-K0.5 | 0.0219150149395 | 0.0211330334601 | 0.0007819814794 | 0 | 0 | 0 | 通过 |
| reused-2.84-K0.5 | 0.0208567612168 | 0.0202888742229 | 0.000567886993847 | 0 | 0 | 0 | 通过 |
| reused-2.9-K0.5 | 0.0200528545488 | 0.0196216593867 | 0.000431195162096 | 0 | 0 | 0 | 通过 |

| 运行 | minDistanceOverDe | 总激活段对 | 势垒支撑区距离阈值 | 势垒支撑区 |
| --- | --- | --- | --- | --- |
| reused-2.77-K2 | 0.944508532019 | 124 | 0.55 | false |
| reused-2.84-K2 | 0.953471726695 | 110 | 0.55 | false |
| reused-2.9-K2 | 0.960184446911 | 96 | 0.55 | false |
| reused-2.77-K1 | 0.925389489226 | 170 | 0.55 | false |
| reused-2.84-K1 | 0.93697007607 | 146 | 0.55 | false |
| reused-2.9-K1 | 0.94603318371 | 126 | 0.55 | false |
| reused-2.77-K0.5 | 0.907812608887 | 196 | 0.55 | false |
| reused-2.84-K0.5 | 0.920761708733 | 182 | 0.55 | false |
| reused-2.9-K0.5 | 0.931904496977 | 166 | 0.55 | false |

| 运行 | 接触组 | 激活段对 | minDistanceOverDe |
| --- | --- | --- | --- |
| reused-2.77-K2 | waleSpacing | 13 | 0.944508532019 |
| reused-2.77-K2 | courseSpacing | 86 | 0.971380883446 |
| reused-2.77-K2 | diagonal | 12 | 0.973823424455 |
| reused-2.77-K2 | sameLoop | 13 | 0.944508532035 |
| reused-2.84-K2 | waleSpacing | 9 | 0.953471726695 |
| reused-2.84-K2 | courseSpacing | 86 | 0.973943734549 |
| reused-2.84-K2 | diagonal | 6 | 0.976881184806 |
| reused-2.84-K2 | sameLoop | 9 | 0.953471732881 |
| reused-2.9-K2 | waleSpacing | 9 | 0.960184449593 |
| reused-2.9-K2 | courseSpacing | 74 | 0.976139031068 |
| reused-2.9-K2 | diagonal | 4 | 0.977981873781 |
| reused-2.9-K2 | sameLoop | 9 | 0.960184446911 |
| reused-2.77-K1 | waleSpacing | 14 | 0.925389489226 |
| reused-2.77-K1 | courseSpacing | 123 | 0.953550023977 |
| reused-2.77-K1 | diagonal | 19 | 0.962098143882 |
| reused-2.77-K1 | sameLoop | 14 | 0.925389491436 |
| reused-2.84-K1 | waleSpacing | 14 | 0.936970077105 |
| reused-2.84-K1 | courseSpacing | 109 | 0.958682133477 |
| reused-2.84-K1 | diagonal | 9 | 0.966719277989 |
| reused-2.84-K1 | sameLoop | 14 | 0.93697007607 |
| reused-2.9-K1 | waleSpacing | 13 | 0.946033189381 |
| reused-2.9-K1 | courseSpacing | 94 | 0.961487898385 |
| reused-2.9-K1 | diagonal | 6 | 0.97047677922 |
| reused-2.9-K1 | sameLoop | 13 | 0.94603318371 |
| reused-2.77-K0.5 | waleSpacing | 18 | 0.907812608887 |
| reused-2.77-K0.5 | courseSpacing | 137 | 0.927046107705 |
| reused-2.77-K0.5 | diagonal | 23 | 0.933096775276 |
| reused-2.77-K0.5 | sameLoop | 18 | 0.907812627675 |
| reused-2.84-K0.5 | waleSpacing | 14 | 0.920761708733 |
| reused-2.84-K0.5 | courseSpacing | 140 | 0.935672304097 |
| reused-2.84-K0.5 | diagonal | 14 | 0.957496910735 |
| reused-2.84-K0.5 | sameLoop | 14 | 0.920761713994 |
| reused-2.9-K0.5 | waleSpacing | 14 | 0.931904496977 |
| reused-2.9-K0.5 | courseSpacing | 126 | 0.94000032464 |
| reused-2.9-K0.5 | diagonal | 12 | 0.963783981025 |
| reused-2.9-K0.5 | sameLoop | 14 | 0.931904497762 |

下列新运行路径以 summary 中的 archiveRoot 为根；历史复用行没有新运行 manifest 或新初值记录。

| 运行 | manifest | 完整 result | initial cell 来源 | 输入/原始输入 |
| --- | --- | --- | --- | --- |
| reused-2.77-K2 | 未记录/不适用 | C:/Users/liuchen/Documents/KnitScape/archives/r2-slope-2026-11-25/R2-3/qc-2.77-K2-result.json | 未记录/不适用 | docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-2.77-input.json |
| reused-2.84-K2 | 未记录/不适用 | C:/Users/liuchen/Documents/KnitScape/archives/r2-slope-2026-11-25/R2-3/qc-2.84-K2-result.json | 未记录/不适用 | docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-2.84-input.json |
| reused-2.9-K2 | 未记录/不适用 | C:/Users/liuchen/Documents/KnitScape/archives/r2-slope-2026-11-25/R2-3/qc-2.9-K2-result.json | 未记录/不适用 | docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-2.9-input.json |
| reused-2.77-K1 | 未记录/不适用 | C:/Users/liuchen/Desktop/KnitScape/docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-2.77-after.json | 未记录/不适用 | docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-2.77-input.json |
| reused-2.84-K1 | 未记录/不适用 | C:/Users/liuchen/Desktop/KnitScape/docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-2.84-after.json | 未记录/不适用 | docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-2.84-input.json |
| reused-2.9-K1 | 未记录/不适用 | C:/Users/liuchen/Desktop/KnitScape/docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-2.9-after.json | 未记录/不适用 | docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-2.9-input.json |
| reused-2.77-K0.5 | 未记录/不适用 | C:/Users/liuchen/Documents/KnitScape/archives/r2-slope-2026-11-25/R2-3/qc-2.77-K0.5-result.json | 未记录/不适用 | docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-2.77-input.json |
| reused-2.84-K0.5 | 未记录/不适用 | C:/Users/liuchen/Documents/KnitScape/archives/r2-slope-2026-11-25/R2-3/qc-2.84-K0.5-result.json | 未记录/不适用 | docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-2.84-input.json |
| reused-2.9-K0.5 | 未记录/不适用 | C:/Users/liuchen/Documents/KnitScape/archives/r2-slope-2026-11-25/R2-3/qc-2.9-K0.5-result.json | 未记录/不适用 | docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-2.9-input.json |

### 各 K 档拟合与干放松参照偏差

含截距、等权三点对数 OLS；残差=观测 ln(密度)−拟合 ln(密度)，SSE 为该残差平方和。分支标注来自未舍入 summary。

| K倍率 | b_wale | 横密截距 | 横密SSE | b_course | 纵密截距 | 纵密SSE | 分支 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | -0.273959454665 | 2.85626614554 | 8.01129187465e-8 | -1.78576248255 | 4.87040360967 | 3.94669606034e-7 | 对称分支 |
| 1 | -0.397275881101 | 3.00068270752 | 1.10911934152e-7 | -1.64152203848 | 4.70467019859 | 1.63009922676e-7 | 对称分支 |
| 0.5 | -0.534149007172 | 3.16358850158 | 6.51232790137e-8 | -1.46989656347 | 4.50545933015 | 3.76405699803e-8 | 对称分支 |
| 1/4 | -0.669361147327 | 3.32526796545 | 2.90943708054e-8 | -1.29642309021 | 4.30111840708 | 5.96960869288e-9 | 对称分支 |
| 1/8 | -0.790144724022 | 3.46486416314 | 2.49881793697e-9 | -1.15238261192 | 4.12832073638 | 2.98215114768e-12 | 对称分支 |
| 1/16 | -1.24972096968 | 3.92789268083 | 0.0000200581635832 | -0.92172627943 | 3.87420972657 | 0.00000220984985882 | 对称分支 |
| 1/44 | -1.16950625859 | 3.6615708056 | 6.06706296518e-9 | -0.847171074565 | 3.83447602216 | 1.44550503051e-9 | 对称分支 |

| K倍率 | 方向 | l/mm | ln密度残差 |
| --- | --- | --- | --- |
| 2 | wale | 2.77 | 0.000105210891963 |
| 2 | wale | 2.84 | -0.00023080325891 |
| 2 | wale | 2.9 | 0.000125592366946 |
| 2 | course | 2.77 | 0.000233521174493 |
| 2 | course | 2.84 | -0.000512280117503 |
| 2 | course | 2.9 | 0.00027875894301 |
| 1 | wale | 2.77 | 0.000123793706015 |
| 1 | wale | 2.84 | -0.00027156875346 |
| 1 | wale | 2.9 | 0.000147775047444 |
| 1 | course | 2.77 | 0.000150077796946 |
| 1 | course | 2.84 | -0.00032922869466 |
| 1 | course | 2.9 | 0.000179150897714 |
| 0.5 | wale | 2.77 | 0.0000948587844039 |
| 0.5 | wale | 2.84 | -0.000208093631449 |
| 0.5 | wale | 2.9 | 0.000113234847045 |
| 0.5 | course | 2.77 | 0.0000721169781817 |
| 0.5 | course | 2.84 | -0.000158204471766 |
| 0.5 | course | 2.9 | 0.0000860874935835 |
| 1/4 | wale | 2.77 | 0.0000634035989111 |
| 1/4 | wale | 2.84 | -0.000139089755654 |
| 1/4 | wale | 2.9 | 0.0000756861567428 |
| 1/4 | course | 2.77 | 0.0000287198625601 |
| 1/4 | course | 2.84 | -0.0000630033426257 |
| 1/4 | course | 2.9 | 0.0000342834800655 |
| 1/8 | wale | 2.77 | 0.0000185813272697 |
| 1/8 | wale | 2.84 | -0.0000407622329659 |
| 1/8 | wale | 2.9 | 0.0000221809056962 |
| 1/8 | course | 2.77 | -6.41910162358e-7 |
| 1/8 | course | 2.84 | 0.00000140817128802 |
| 1/8 | course | 2.9 | -7.66261126994e-7 |
| 1/16 | wale | 2.77 | -0.00166477294606 |
| 1/16 | wale | 2.84 | 0.00365204603939 |
| 1/16 | wale | 2.9 | -0.00198727309333 |
| 1/16 | course | 2.77 | 0.00055257446154 |
| 1/16 | course | 2.84 | -0.00121219375802 |
| 1/16 | course | 2.9 | 0.00065961929648 |
| 1/44 | wale | 2.77 | -0.0000289533403977 |
| 1/44 | wale | 2.84 | 0.0000635155276738 |
| 1/44 | wale | 2.9 | -0.0000345621872762 |
| 1/44 | course | 2.77 | 0.0000141325076397 |
| 1/44 | course | 2.84 | -0.0000310027674777 |
| 1/44 | course | 2.9 | 0.0000168702598393 |

下表均为 l=2.84 mm，参照为 Hossain 干放松态；偏差按 100×(模型/参照−1)，不作为独立标定目标。

| K倍率 | 模型横密/cm⁻¹ | 干放松横密/cm⁻¹ | 横密偏差/% | 模型纵密/cm⁻¹ | 干放松纵密/cm⁻¹ | 纵密偏差/% |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 13.066809032 | 12.125984252 | 7.75874980911 | 20.2044972154 | 18.0708661417 | 11.8070216277 |
| 1 | 13.2730141702 | 12.125984252 | 9.45927270221 | 19.9038586393 | 18.0708661417 | 10.1433571758 |
| 0.5 | 13.5425084132 | 12.125984252 | 11.6817252261 | 19.5117556241 | 18.0708661417 | 7.97354964098 |
| 1/4 | 13.8245638328 | 12.125984252 | 14.0077666728 | 19.0648004961 | 18.0708661417 | 5.50020318114 |
| 1/8 | 14.0141444321 | 12.125984252 | 15.5711910959 | 18.6428091725 | 18.0708661417 | 3.16500064959 |
| 1/16 | 13.8333302356 | 12.125984252 | 14.0800610337 | 18.3732519271 | 18.0708661417 | 1.67333310404 |
| 1/44 | 11.4833590627 | 12.125984252 | -5.29957136606 | 19.1090953659 | 18.0708661417 | 5.74532076109 |

| 起始K倍率 | 终止K倍率 | 局部 db_wale/dlnK |
| --- | --- | --- |
| 2 | 1 | 0.17790799688 |
| 1 | 0.5 | 0.197466180213 |
| 0.5 | 1/4 | 0.195069884069 |
| 1/4 | 1/8 | 0.174253867119 |
| 1/8 | 1/16 | 0.663028370518 |
| 1/16 | 1/44 | -0.0792948188987 |

横密斜率单调性记录：false。K×1/44 的已求解 b_wale=-1.16950625859；预先外推值=-1.1；差（求解−外推）=-0.0695062585885。均只描述，不另设通过/失败。
<!-- R3A-GENERATED:chain:END -->

## 判读

主判据仅取 K×1/44 的三个目标点：任何一点 |S|/W>1e-4，则为“不确定（分支混合）”；否则 b_wale≤−0.9 为“一致”，b_wale≥−0.6 为“不足以解释”，两者之间为“不确定”。阈值按未舍入数值执行。其他档有剪切点时，该档仅作混合分支描述。尚未完成目标求解时不作最终判读。

<!-- R3A-GENERATED:interpretation:START -->
### R3a-3 按预登记阈值判读

**一致**。

主判据 b_wale=-1.16950625859；mixedBranch=false。充分放松态约 -1，待 D0 检验。本判读只说明模型能否到达 -1，不说明真实面料的斜率是多少。
<!-- R3A-GENERATED:interpretation:END -->

## 局限与数据来源

本任务是模型诊断，不是标定，不选择、调整或推荐材料参数。主判据以“充分放松态约 −1”为前提，该前提须由用户侧 D0 实物测量检验；本判读只说明模型能否到达 −1，不说明真实面料的斜率是多少。Hossain 对照为干放松态，不能与无摩擦模型平衡直接等同。三点拟合仅描述给定的窄长度区间，不是普适幂律。

原资料做过 HATRA 测量，但 2.77/2.84/2.90 mm 仍按原输入的给纱设定值使用，实测数值待 S1 File 核对；摘要 19.68 tex 与用户提供 19.78 tex 的差异也待核对，本任务原样沿用 19.78 tex。真实纱径及其他未知物性仍为 UNKNOWN。GSM 不作为独立观测或本任务判据。来源更正见 [Hossain 记录](../t1-convergence-2026-11-23/REFERENCE_DATA_HOSSAIN2025.md)。

l=2.84 mm 的干放松参照来自上述 Hossain 记录中用户提供的原始计数：每2.54 cm为30.8纵行、45.9横列；分别除以2.54得到12.125984251968504纵行/cm、18.07086614173228横列/cm。使用未舍入值计算偏差，不将用户提供的论文摘录升级为本轮实物测量。

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

R3a-2：COMPLETE；本阶段记录 12 次运行；截至该阶段累计实际求解 14/37 次。

本报告渲染不执行验证或求解；截至 R3a-3 的既有日志仅按所在步骤列出，历史日志不算本步验收。

| 步骤 | 既有日志/记录 | 记录值/说明 |
| --- | --- | --- |
| R3a-0 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-0/build.log | 日志位置；存在不等于验收通过 |
| R3a-0 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-0/validate.log | 日志位置；存在不等于验收通过 |
| R3a-0 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-0/verification.json | {"validateExit":0,"buildExit":0} |
| R3a-1 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-1/build.log | 日志位置；存在不等于验收通过 |
| R3a-1 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-1/study.log | 日志位置；存在不等于验收通过 |
| R3a-1 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-1/validate.log | 日志位置；存在不等于验收通过 |
| R3a-1 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-1/verification.json | {"buildExit":0,"validateExit":0} |
| R3a-2 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/build.log | 日志位置；存在不等于验收通过 |
| R3a-2 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/study.log | 日志位置；存在不等于验收通过 |
| R3a-2 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/validate.log | 日志位置；存在不等于验收通过 |
| R3a-2 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/verification.json | {"validateExit":0,"buildExit":0} |
| R3a-2 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/resumption-2026-11-26/build.log | 日志位置；存在不等于验收通过 |
| R3a-2 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/resumption-2026-11-26/self-check.log | 日志位置；存在不等于验收通过 |
| R3a-2 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/resumption-2026-11-26/study.log | 日志位置；存在不等于验收通过 |
| R3a-2 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/resumption-2026-11-26/validate.log | 日志位置；存在不等于验收通过 |
| R3a-2 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-2/resumption-2026-11-26/verification.json | {"validateExit":0,"buildExit":0} |
| R3a-3 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-3/build.log | 日志位置；存在不等于验收通过 |
| R3a-3 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-3/validate.log | 日志位置；存在不等于验收通过 |
| R3a-3 | C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/R3a-3/verification.json | {"validateExit":0,"buildExit":0} |

全局求解计数来源：C:/Users/liuchen/Documents/KnitScape/archives/r3a-stiffness-2026-11-26/study-ledger.json；阶段状态来源：各阶段 study-manifest.json 与两份 summary。
<!-- R3A-GENERATED:verification:END -->
