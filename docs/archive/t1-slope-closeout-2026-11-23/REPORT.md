# T1 横密斜率诊断与遗留问题收尾

日期：2026-11-23（Asia/Shanghai）。接手 main `267b240`，当时工作区干净。按五步顺序验收并分别提交，未调整物理参数、接触公式、收敛容差或材料假设。

## 提交、文件与实际验证

| 步骤 | 提交 | 代码/文档文件（另含本目录对应证据） | npm run validate | npm run build |
|---|---|---|---|---|
| 1 乘子保护 | `4444898` | `src/fabricForm/constrainedOptimizer.js`、`src/fabricForm/solveFabricCell.js`、`scripts/lib/fabricFormOptimizerChecks.mjs`、`PLAN.md` | 47/47，退出 0 | 退出 0 |
| 2 memorySize | `64badcc` | `scripts/lib/fabricFormCloseoutSettings.mjs`、`scripts/lib/fabricFormInitialChecks.mjs`、`scripts/run-fabric-form-a14-closeout.mjs` | 47/47，退出 0 | 退出 0 |
| 3 接触诊断 | `57502ba` | `src/fabricForm/periodicContact.js`、`src/fabricForm/solveFabricCell.js`、`scripts/lib/fabricFormPeriodicContactChecks.mjs`、`scripts/run-t1-slope-diagnostics.mjs` | 47/47，退出 0 | 退出 0 |
| 4 默认 N48 | `68c0ff2` | `src/fabricForm/fabricFormTopology.js`、`scripts/lib/fabricFormTopologyChecks.mjs`、`scripts/lib/fabricFormReport.mjs`、`scripts/run-t1-slope-diagnostics.mjs`、`docs/NEXT_TASK.md`、`docs/T1_RESULT.md`、`docs/LAYER3_STEP1_TASK.md` | 47/47，退出 0 | 退出 0 |
| 5 文档更正 | 与本报告同次提交 | `docs/archive/t1-convergence-2026-11-23/REFERENCE_DATA_HOSSAIN2025.md`、`docs/NEXT_TASK.md`、本报告及 `step5-*` 检查记录 | 未运行（仅文档） | 未运行（仅文档） |

各步原始日志为 `step1/2/3/4-validate.log` 与 `step1/2/3/4-build.log`。每步针对性测试、输入、完整求解结果及比较 JSON 均在本目录。记录实际执行结果，不把历史通过计作本轮验证。工作期间另一任务单独提交了 `de51082`（罗纹评估文档），不属于本任务五步，也未被覆盖。

## 第 1 步

`stagnationWindow` 默认 3，可配置为正整数。每轮 INNER_LIMIT 工作段比较起点/终点的自由方向 AL 梯度二范数；连续 K 段末值不小于起值时强制进入既有乘子/罚系数更新路径。任何改善或 AL 更新均重置窗口。正常 INNER_LIMIT 保留 L-BFGS 记忆；发生真实或强制 AL 更新后目标改变，按原规则清空记忆。收敛和总预算退出优先。

停滞夹具先在旧代码失败、补丁后通过；另覆盖可配置 K、总预算退出优先和改善时不触发。指定 case-4 N64 使用原输入重跑，`CONVERGED`、3067 次迭代、强制触发 0 次；与归档 3067 次完全一致，完整 cell 与 metrics 逐位一致。见 [比较结果](step1-comparison.json) 和 [完整结果](step1-case-4-N64.json)。

## 第 2 步

恢复入口接受显式 memorySize；缺省按网格规则解析。检查点顶层或 settings 中记录的值均须一致，否则报错。resume 保留上次记录的设置，restart 保留原输入设置。

回归实际从保存几何以非默认 memorySize=7 进行一次公开求解器调用，结果保留 7；覆盖两种检查点记录位置的不匹配拒绝、缺省、旧检查点无字段和非法值。完整 CLI 的能量/几何恢复验证流水线未重跑；本轮自动验证范围为同一恢复设置函数加公开求解入口。

## 第 3 步

详表见 [接触诊断](STEP3_DIAGNOSTICS.md)，原始前后对照见 [comparison JSON](step3-comparison.json)。三个 Hossain N64 工况全部 CONVERGED，诊断前后横密/纵密相对差均为 0，完整几何逐位一致，强制乘子更新均为 0 次。

三个工况的纵行间接触均激活；min/d_e 随 l 增大为 0.925389、0.936970、0.946033；激活数 14、14、13，接触力总和及最大值下降。横列间接触也均激活。三工况势垒力均为 0。以上只描述输出，不据此确认斜率因果机制。

当前接触是软势能和数值势垒，没有接触约束乘子，故相关字段为 null，接触力另列。AL 乘子属于段长等式。d_e=0.1960864359761643 mm、d_s=0.13865404857744756 mm、r_c=0.09804321798808215 mm，均是沿用参数推导值，不是真实纱径实测；完整六字段来源随 JSON 保存。没有独立求解的可变有效直径。

方向分类基于材料线圈归属，纵行间与横列间之外的斜向、同线圈内非局部接触保留在 JSON。段对计数/力模总和依赖网格与胞大小，不是连续应力或整体向量合力。诊断运行在最终几何上；elapsedMs 为求解时间，不含诊断开销。

## 第 4 步

详表见 [N48 验收](STEP4_N48.md)，原始比较见 [comparison JSON](step4-comparison.json)。2.6/3.0/3.5/4.0 mm 均 CONVERGED，N48 实际默认 memorySize=180。相对归档 N128 的横密差分别 +0.189001%、+0.052258%、+0.045277%、+0.099004%；纵密差 +0.191497%、+0.212309%、+0.231430%、+0.241250%，全部 <0.5%。

四工况使用既有 N32 收敛分支及既有平滑延拓，本轮未重跑 N128，也未测量完整 N48 冷启动性能。N32 现在仅作预览；历史显式网格实验和旧运行记录保留其当时配置。

## 第 5 步

克重反算改为 +0.47% / +0.49% / +0.53%，约 0.5%；新增用户指定的计数分辨率、均值标准误、趋势、幂次与显著性说明，并区分 N128 文献趋势归档与本轮 N64 接触诊断。来源仍是用户提供数据，本轮未独立核验论文全文。

对 docs 下 Markdown 的错误 kw 下降 8% 表述检索无匹配，见 `step5-kw-search.log`。已运行文档数值/链接检查和 `git diff --check`；本步 npm validate/build 未运行。
