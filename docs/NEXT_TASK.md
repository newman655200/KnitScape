# KnitScape 下一任务：重新设计“纱线组织 → 面料形态”算法

阶段核对日期：2026-11-22（Asia/Shanghai）。T1 接手路径 `C:\Users\liuchen\Desktop\knitscape`，分支 `main`，HEAD 与用户指定文档基线均为 `4e68850414432898cafb5bb7d078eb52722955a8`；接手时工作区干净，相对该基线无差异。T0 接手时的非干净状态属于历史记录，不沿用为本轮状态。

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

当前关口是**三维算法重新设计**。2026-11-22 获授权的 T1 独立普通纬平针周期单元求解器已完成实现与 M0–M6 结果报告交付；当前任务是审阅 **A14 部分通过、B FAIL 和 A12 性能限制**，停止于 T1，不进入 T2–T8。实现不接入现有 UI、二维仿真或 PBR 2.5D。

四个冻结工况与 SOP 反事实参考已用最终优化器重跑并实际收敛。2.6 mm 的 N32→N64 双方向密度变化为 −0.33737% / −0.41930%，但 kc 与 kc/kw 仍超暂定区间；4.0 mm 的变化为 −0.11009% / −0.66917%，纵密超过 0.5% 杆精度门槛，且 kc/kw 仍超界。因此不能将 l=3 mm 的离散通过结论推广为全域精度，4.0 mm 的杆精度尚未建立。本轮未运行 N128，不逐工况调整材料参数，也不把 B 偏差全部归因于物理模型。

A12 仍未普遍达到 30 s：最终 2.6 mm 为 48.21 s，M5 参考冷启动记录为 56.95 s；3.0 mm 的 0.031 s 是复用收敛状态的复核。A13 本轮完整 `npm run validate`（47/47）与 `npm run build` 已通过；最后优化器与输出字段补充后的再次外层结果，以归档 [REPORT.md](C:/Users/liuchen/Documents/KnitScape/archives/fabric-form-step1-2026-11-22/REPORT.md) 和 [final-regression.json](C:/Users/liuchen/Documents/KnitScape/archives/fabric-form-step1-2026-11-22/final-regression.json) 为准。原 M6 记录保存在 `before-roundoff-fix/`，失败尝试与续算成本均保留，不充当从头性能。

- [ALGORITHM_DESIGN](ALGORITHM_DESIGN.md)：上位定义、模型边界、数据来源与公开参考；第 10 节汇总本轮 T1 的实际结果、限制与停止条件。
- [LAYER3_STEP1_TASK](LAYER3_STEP1_TASK.md)：本轮 T1 普通纬平针周期求解器的详细任务书。
- [TECH_VALIDATION_PLAN](TECH_VALIDATION_PLAN.md)：T0–T8、D/C 数据及条件任务、依赖与验收；T0 当轮记录写在其中。

未来顺序保留为单纱全成圈 → 加氨纶 → 加集圈 → 未标定预测与质量核对 → 单参数标定 → 未参与开发工况验证。模型平衡不预设等同于真实干燥放松状态。数值检查、经验对照和实物验收分别报告，后续实现须另行获得用户确认。

2026-11-22 按 `66392a8` 执行 T1 收尾的 (a) A14 补齐、(b) 按紧度与放松状态的文献对照；本轮逐工况真实结果、未通过/未完成项及外层验证见 [仓库外收尾报告](C:/Users/liuchen/Documents/KnitScape/archives/fabric-form-step1-closeout-2026-11-22/REPORT.md)，用户可直接审阅 [内嵌图表副本](T1_CLOSEOUT_REVIEW.html)。收敛序列判据与 N32 精度分别报告；原始文献点保留三步换算链，Knapton 1971 全文与紧度覆盖仍未知。除用户批准的 N24 自检初值修正外，仅新增独立收尾脚本与记录；不改变模型、材料、分支规则和 B 类暂定区间。下一步是用户审阅收尾证据并选择后续方向，当前仍停止于 T1，不进入 T2–T8。

## 仍未知 — UNKNOWN

真实纱径、主纱实际 tex、原料比是否独立测量、氨纶曲线有效范围及自然长度适用状态、摩擦、压缩、静置与后整理条件；M1 与 M3 测量窗口差异。D2 工艺路密、D5 展开幅宽口径与 D11 容差等前置见总计划。约 8 tex 与 44.5 路/cm 保留推断标签，不得用默认值冒充实测。
