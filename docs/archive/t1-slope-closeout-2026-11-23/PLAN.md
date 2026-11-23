# T1 横密斜率诊断与收尾计划

日期：2026-11-23（Asia/Shanghai）。接手 main `267b240`，工作区干净。
按用户五步顺序执行，每步验收后单独提交；所有物理参数与容差保持原值。

1. `constrainedOptimizer.js` 增加 `stagnationWindow=3`：每个 INNER_LIMIT 工作段的末端梯度 L2 不小于起点，连续 K 段后强制走既有乘子/罚系数更新。改善、正常更新均重置窗口；总预算退出优先。`solveFabricCell.js` 透传并记录设置和计数。先复现停滞测试，再跑 optimizer、全量 validate、build、指定 case-4 N64，并比较归档 3067 次迭代及完整几何/指标。
2. closeout 恢复入口提取可测试的 memorySize 解析，显式输入优先，缺省使用分网格规则，检查与 checkpoint 已记录值的一致性；测试非默认值和不匹配拒绝；运行 validate/build。
3. 求解完成后只读计算方向诊断，保留段编号、周期像、方向分类依据、有效直径/压实距离、接触量与实际存在的力学量。接触为软势能，不把长度约束乘子冒称接触乘子。复用归档参数运行三个 Hossain N64，比较新增诊断前后的相同输入密度；运行 validate/build，归档表格。
4. 默认拓扑 N48，N32 仅预览，memorySize 规则不改。四工况沿既有平滑延拓生成 N48，和归档 N128 比较，超限如实记录；运行 validate/build。
5. 按用户提供数字修正文献记录与当前交接中错误的 kw 趋势描述，记录实际检查。此步仅文档，不将历史 npm 结果写成本轮执行。

报告记录每步文件、提交号、真实验证结果及限制。原始输入/结果 JSON 与日志保存在本目录。工作流采用 writing-plans、systematic-debugging、test-driven-development、verification-before-completion 与独立只读审查；用户已授权具体实现，无额外审批。
