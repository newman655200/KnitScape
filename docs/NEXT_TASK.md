# KnitScape 下一任务：重新设计“纱线组织 → 面料形态”算法

阶段核对日期：2026-11-23（Asia/Shanghai）。本轮接手仓库 C:/Users/liuchen/Desktop/KnitScape，分支 main，接手工作区干净；本轮代码与文档修改尚未提交。历史接手状态不沿用为本轮状态。

## 已关闭的关口 — FACT

1. **工艺确认（2026-10-20）**：SOP-001 主纱 23 cm/100机针、氨纶 8 cm/100机针 均为拆纱放松实测；实际牵伸倍率 3.0（正常 2.8–3.2）；氨纶织造态参考 24 cm/100机针 = 8 × 3.0；张力 5/4 cN 只记录、不进几何；抽样 QC ±2%。见 [YARN_LENGTH_CONTRACT](YARN_LENGTH_CONTRACT.md) 顶部“SOP-001 生产确认补充”。
2. **纱长闭合**：指定 SOP 包 8 路双纱共 16 槽收敛；越界、清空、批量原子预检、结构 revision 均有回归保护。

## 2026-11-21 决定：三维代码全部移除

用户决定删除所有三维几何代码，重新讨论从纱线组织到最终面料样式的算法。已移除：

- SOP 三维样布（“三维样布”按钮、`swatch.html`、`sopInterlockSwatch` / `sopInterlockCurve` / `sopSwatchForm`、桌面模板 `sopSpatialHypothesis`、`sopTopologyAdapter`、`yarnGeometryAudit`）；
- PBR 2.5D 页里的 TEST_ONLY 人工 XYZ 三维实验（`yarnSpatial*`、`yarnTubeGeometry`、`yarnParallelTransport`、三维渲染器与相机）；
- 纱线松弛工作台（`yarnRelaxation*`、`yarnSpatialRelaxation`）；
- 对应的 29 个 validator 与只被它们使用的夹具/helper。

保留：二维纱线仿真、PBR 2.5D 平面贴图预览、纱长求解与全部相关 validator（移除时记录为 46/46，不充当本轮结果）。`public/current-SOP.knitscape` 作为样例数据保留。

旧实现可从 git 历史取回：`fc56f2b`（含条件 1 mm 统一、条件 2 整布 48×60 `SURFACE_CROSSING`=0 的未完成工作）。旧实现留下的经验：中心线弧长对 23/24 偏大约 +50~75%；courseStep 是显示常量，不由纱长驱动；整布构建约 22 分钟，不能作 app 预览。

## 当前任务

2026-11-23：本轮 T1 收敛修复与实测对照已完成，停止于 T1。已复现并修复内层截断时过早更新 AL/丢弃曲率历史，以及舍入窗口内按最大梯度分量拒绝有效步的问题；复用既有平滑延拓和 L-BFGS 设置，未改变物理模型、材料假设、收敛容差或 B 类区间。

2.6 / 3.0 / 3.5 / 4.0 mm 的 N64、N128 均已收敛，全部终态经最终代码与 Q24 复核。本轮指定的 N64→N128 双方向密度变化均 ≤0.5%（最大横密 0.0907%、纵密 0.1077%）。N32 相对 N128 的纵密误差依次为 +0.5221%、+0.5465%、+0.4891%、+0.7084%，不能把细网格通过等同于 N32 全域达到 0.5%。

tex=19.78、l=2.77 / 2.84 / 2.90 mm 的 Hossain 正常样对应工况均以 N128 收敛，并完成逐点横密、纵密、kw、kc、GSM 偏差比较。数据由用户提供，未调参；干放松实测与无摩擦平衡分开解释，给纱设定长度的放松后复测仍未知。

本轮 npm run validate（47/47）与 npm run build 均通过。默认 3 mm/N32 单次冷启动 24.56 s；N128 延拓仍需 240.75–974.87 s，不宣称性能普遍达标。简要结果见 [T1_RESULT](T1_RESULT.md)，原始输入、终态、失败/中止记录及验证日志位于 C:/Users/liuchen/Documents/KnitScape/archives/t1-convergence-2026-11-23。

- [ALGORITHM_DESIGN](ALGORITHM_DESIGN.md)：上位定义、模型边界、数据来源与公开参考；第 10 节汇总本轮 T1 的实际结果、限制与停止条件。
- [LAYER3_STEP1_TASK](LAYER3_STEP1_TASK.md)：本轮 T1 普通纬平针周期求解器的详细任务书。
- [TECH_VALIDATION_PLAN](TECH_VALIDATION_PLAN.md)：T0–T8、D/C 数据及条件任务、依赖与验收；T0 当轮记录写在其中。

未来顺序保留为单纱全成圈 → 加氨纶 → 加集圈 → 未标定预测与质量核对 → 单参数标定 → 未参与开发工况验证。模型平衡不预设等同于真实干燥放松状态。数值检查、经验对照和实物验收分别报告，后续实现须另行获得用户确认。

## 仍未知 — UNKNOWN

真实纱径、主纱实际 tex、原料比是否独立测量、氨纶曲线有效范围及自然长度适用状态、摩擦、压缩、静置与后整理条件；M1 与 M3 测量窗口差异。D2 工艺路密、D5 展开幅宽口径与 D11 容差等前置见总计划。约 8 tex 与 44.5 路/cm 保留推断标签，不得用默认值冒充实测。
