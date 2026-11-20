# KnitScape 下一任务：三维几何验收

阶段核对日期：2026-11-20（Asia/Shanghai）。当前 HEAD `23e71e7`；最后一次功能提交 `7ababf2`。工作区有未提交改动（大部分是 CRLF 行尾噪声），不要为对齐文档回退代码。

> 本文件 2026-10-17 版（`P0-C0 Correctness Preparation`、“七问全部 PENDING”）已过时，可用 `git show 23e71e7:NEXT_TASK.md`（当时位于仓库根目录） 查看。

## 已关闭的关口 — FACT

1. **工艺确认（2026-10-20）**：SOP-001 主纱 23 cm/100机针、氨纶 8 cm/100机针 均为拆纱放松实测；实际牵伸倍率 3.0（正常 2.8–3.2）；氨纶织造态参考 24 cm/100机针 = 8 × 3.0；张力 5/4 cN 只记录、不进几何；抽样 QC ±2%。见 [YARN_LENGTH_CONTRACT](YARN_LENGTH_CONTRACT.md) 顶部“SOP-001 生产确认补充”。
2. **纱长闭合**：指定 SOP 包 8 路双纱共 16 槽收敛；越界、清空、批量原子预检、结构 revision 均有回归保护。

这两项不再作为阻塞，也不再继续打磨。不要重新讨论 23/8 语义，不要再优化求解器。

## 当前关口：三维几何验收 — 未通过

现状（来源：[B-当前工程架构-20261118](archive/B-当前工程架构-20261118.md)）：

- 桌面模板 12,840 条路径的 `SURFACE_CROSSING` 诊断记录从 19,092 降到 13,452，仍大量穿透。
- 双纱样布演示的整布无穿透尚无证据；演示输出 `physicalLengthEligible:false`、`lengths:null`，即三维弧长还没有接到纱长上。
- 显示坐标与部分接口的 mm 单位标签不一致。

涉及代码：[yarnSpatialPath.js](../src/simulation/yarnSpatialPath.js)、[yarnTubeGeometry.js](../src/simulation/yarnTubeGeometry.js)、[yarnGeometryAudit.js](../src/simulation/yarnGeometryAudit.js)。

### 验收条件（按顺序，一次一项）

1. **单位统一**：中心线坐标、管面半径、审计容差和接口标签使用同一长度单位（mm），有针对性的 validator 覆盖。
2. **无穿透**：在指定 SOP 包上，用同一检测器审计实际要显示的管面，`SURFACE_CROSSING` 为 0（或每条剩余记录都有书面理由并被用户认可）。只降数字不算通过。
3. **三维弧长可用**：演示输出 `physicalLengthEligible:true`，每个 Feed × Yarn 槽给出三维中心线弧长（cm/100机针）。
4. **弧长对照**：每槽三维弧长与已确认参考值（主纱 23；氨纶织造态 24）并列给出，独立复算，不复制 Solver 读数。允许偏差由用户确认；在确认前只报告偏差，不写“通过”。

每项由实现者在实际入口亲自验收，达到预期后再做下一项。

### 当前禁止

- 在本关口通过前做报告、任务书、打包、合并、清理等元工作。
- 用 PBR、透明或视角掩盖穿透；只靠裁剪/过渡段让计数下降而不处理几何原因。
- 新建第二套 Renderer 或第二套 Machine 执行逻辑。
- 用 denier、图高或肉眼猜纱径并写成实测；真实直径仍为 UNKNOWN（当前有效直径 0.24 / MODEL_NEEDLE_PITCH），使用时标明是模型值。
- 把 `MODEL_CONVERGED` 写成 `PROCESS_VALIDATED`。

## 仍未知 — UNKNOWN

真实纱径、弹性曲线、摩擦、压缩、relaxation、后整理状态；M1 与 M3 测量窗口差异。这些不阻塞上面四项验收。

## 验证注意

部分 validator 依赖仓库外 SOP 包（`C:\Users\liuchen\Documents\KnitScape\archives\…\SOP-restored-23-8x3-retest.knitscape`）。`validate:sop-flat-layout` 在 2026-11-20 是真失败（测试调用 `interlockCellControls` 未传 `commonLayout`），与本关口相关时先修。

## 本关口通过后

依次：Physical UV/PBR、Real Fabric Calibration、必要时 Relaxation/Contact，最后 Fuzz/High Fidelity。路线不承诺完成日期。
