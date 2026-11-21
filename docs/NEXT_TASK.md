# KnitScape 下一任务：重新设计“纱线组织 → 面料形态”算法

阶段核对日期：2026-11-21（Asia/Shanghai）。最后一次功能提交 `7ababf2`。

## 已关闭的关口 — FACT

1. **工艺确认（2026-10-20）**：SOP-001 主纱 23 cm/100机针、氨纶 8 cm/100机针 均为拆纱放松实测；实际牵伸倍率 3.0（正常 2.8–3.2）；氨纶织造态参考 24 cm/100机针 = 8 × 3.0；张力 5/4 cN 只记录、不进几何；抽样 QC ±2%。见 [YARN_LENGTH_CONTRACT](YARN_LENGTH_CONTRACT.md) 顶部“SOP-001 生产确认补充”。
2. **纱长闭合**：指定 SOP 包 8 路双纱共 16 槽收敛；越界、清空、批量原子预检、结构 revision 均有回归保护。

## 2026-11-21 决定：三维代码全部移除

用户决定删除所有三维几何代码，重新讨论从纱线组织到最终面料样式的算法。已移除：

- SOP 三维样布（“三维样布”按钮、`swatch.html`、`sopInterlockSwatch` / `sopInterlockCurve` / `sopSwatchForm`、桌面模板 `sopSpatialHypothesis`、`sopTopologyAdapter`、`yarnGeometryAudit`）；
- PBR 2.5D 页里的 TEST_ONLY 人工 XYZ 三维实验（`yarnSpatial*`、`yarnTubeGeometry`、`yarnParallelTransport`、三维渲染器与相机）；
- 纱线松弛工作台（`yarnRelaxation*`、`yarnSpatialRelaxation`）；
- 对应的 29 个 validator 与只被它们使用的夹具/helper。

保留：二维纱线仿真、PBR 2.5D 平面贴图预览、纱长求解与全部相关 validator（46/46 通过）。`public/current-SOP.knitscape` 作为样例数据保留。

旧实现可从 git 历史取回：`fc56f2b`（含条件 1 mm 统一、条件 2 整布 48×60 `SURFACE_CROSSING`=0 的未完成工作）。旧实现留下的经验：中心线弧长对 23/24 偏大约 +50~75%；courseStep 是显示常量，不由纱长驱动；整布构建约 22 分钟，不能作 app 预览。

## 当前任务

与用户讨论新算法（从纱线组织到面料形态），算法方案确认前不写三维代码。

## 仍未知 — UNKNOWN

真实纱径、弹性曲线、摩擦、压缩、relaxation、后整理状态；M1 与 M3 测量窗口差异。不得用默认值冒充实测。
