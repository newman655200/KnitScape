# KnitScape 下一任务：三维几何验收

阶段核对日期：2026-11-20（Asia/Shanghai）。基线 HEAD `1b7c8ed`；最后一次功能提交 `7ababf2`。不要为对齐文档回退代码。

> 本文件 2026-10-17 版（`P0-C0 Correctness Preparation`、“七问全部 PENDING”）已过时，可用 `git show 23e71e7:NEXT_TASK.md`（当时位于仓库根目录） 查看。

## 已关闭的关口 — FACT

1. **工艺确认（2026-10-20）**：SOP-001 主纱 23 cm/100机针、氨纶 8 cm/100机针 均为拆纱放松实测；实际牵伸倍率 3.0（正常 2.8–3.2）；氨纶织造态参考 24 cm/100机针 = 8 × 3.0；张力 5/4 cN 只记录、不进几何；抽样 QC ±2%。见 [YARN_LENGTH_CONTRACT](YARN_LENGTH_CONTRACT.md) 顶部“SOP-001 生产确认补充”。
2. **纱长闭合**：指定 SOP 包 8 路双纱共 16 槽收敛；越界、清空、批量原子预检、结构 revision 均有回归保护。

这两项不再作为阻塞，也不再继续打磨。不要重新讨论 23/8 语义，不要再优化求解器。

## 当前关口：三维几何验收 — 未通过

### 范围（2026-11-20 决定）

- **只验收样布线**：[sopInterlockSwatch.js](../src/simulation/sopInterlockSwatch.js)（及 [sopInterlockCurve.js](../src/simulation/sopInterlockCurve.js)、[sopSwatchForm.js](../src/simulation/sopSwatchForm.js)），入口 `buildSopInterlockSwatch`，指定 SOP 包 `public/current-SOP.knitscape`。
- **桌面模板冻结**：[sopSpatialHypothesis.js](../src/simulation/sopSpatialHypothesis.js)（`buildSopSpatialHypothesis` / `buildSopVisualSwatch` / 修剪与接头候选）只作调试视图，不再降穿透、不再改单位；其 13,452 条 `SURFACE_CROSSING` 不计入本关口。

现状：

- 样布 8×16 repeat 窗口：同一审计器 `SURFACE_CROSSING` = 0（`CLOSE_ENVELOPES_NO_SURFACE_CROSSING` 51,564、`VISUAL_OVERLAP` 3,115 个带见证）；整布 48×60（`--full-boundaries`）全部 60 行审计 `SURFACE_CROSSING` = 0，见条件 2。
- 演示仍输出 `physicalLengthEligible:false`、`lengths:null`。
- 单位：见条件 1，已统一为 mm。

涉及代码：上述样布文件，以及共用的 [yarnSpatialPath.js](../src/simulation/yarnSpatialPath.js)、[yarnTubeGeometry.js](../src/simulation/yarnTubeGeometry.js)、[yarnGeometryAudit.js](../src/simulation/yarnGeometryAudit.js)。

### 验收条件（按顺序，一次一项）

1. **单位统一** — ✅ 2026-11-20 完成：中心线坐标、管面半径、审计容差和接口标签使用同一长度单位（mm），有针对性的 validator 覆盖。
   - 做法：样布内部构造仍在私有坐标系 `SOP_LAYOUT_UNIT`（`columnPitch .68` = 1 针距）中进行，`formSopYarnTube` 末尾**一次性均匀缩放** `mmPerLayoutUnit = needlePitchMm / 0.68`（`needlePitchMm = 25.4 / machineGauge`，E32 → 1.16728）。之后中心线、管面、`radiusMm`、`arcLengthMm`、UV 全部在 mm 中直接构建。均匀缩放不改变形状、`半径×曲率` 与穿透判定（8×16 审计计数与改动前逐项相同）。
   - 接口：`SOP_INTERLOCK_DEFAULTS.layoutRadius = .035`（SOP_LAYOUT_UNIT，唯一长度输入）；输出 `parameters.radiusMm`（E32 = 0.04085 mm；主纱槽 ×1.4 = 0.05720 mm）、`mmPerLayoutUnit`、`needlePitchMm`、`units`；`centerline.unit`、`section.unit`、`sectionEvidence.unit` 均为 `'mm'`；`cell.modelArcLength` → `cell.arcLengthMm`，`feedYarnLengths[].modelArcLength` → `arcLengthMm`。传入 `radiusMm` 会被拒绝。
   - 审计：容差改名 `epsilonMm`（1e-7）/ `cellSizeMm`（0.25），报告带 `units`；旧名 `epsilon`/`cellSize` 返回 INVALID；中心线或截面单位非 mm 记 `LENGTH_UNIT_NOT_MM`。
   - 验证：`validate:sop-swatch-units`（标签、实测网格半径、换机号纯缩放 ≤1e-11、审计单位与拒绝路径）。
   - 副作用：`uvRepeatLengthMm: 1` 现在是真 mm，纹理密度约为原来的 1.17 倍；纱径仍是模型值（VISUAL_ASSUMPTION），不是实测。courseStep 仍是显示常量，只随同一系数缩放。
2. **无穿透** — ✅ 2026-11-21 审计证据：在指定 SOP 包上，用同一检测器审计实际要显示的管面，`SURFACE_CROSSING` 为 0（或每条剩余记录都有书面理由并被用户认可）。只降数字不算通过。
   - 缺口：`--full-boundaries` 原先只审首 11 行和末 5 行，中部未审。现已改为整布全部行都审（`validate-sop-interlock-swatch.mjs` 的 `auditPaths = swatch.paths`）。
   - 结果（`public/current-SOP.knitscape`，48 针 × 60 行，120 条管，radialSegments 12，mm）：`auditYarnGeometry` 状态 COMPLETE，审过 17,694,720 个三角形 / 737,280 个环带，粗筛候选 9,916,293 对，`SURFACE_CROSSING` = 0，`ABNORMAL_GEOMETRY` = 0；`CLOSE_ENVELOPES_NO_SURFACE_CROSSING` 1,153,161、`VISUAL_OVERLAP` 73,920 个带见证。8×16 窗口不变（0；51,564 / 3,115）。整布构建时 `acceptsTubeLayout` 通过（2880 格）。
   - 做法：整布构建在沙箱约 22 分钟（布局验收约 230 s + 每条链约 9 s），超过单次 10 分钟上限，所以按行分 3 段（0–19 / 20–39 / 40–59）构建，管面合并后**一次**整体审计（78 s）。各链只依赖共享 `commonLayout`，彼此独立；另建 18–21 行一段做对照，8 条管逐字节相同。
   - 局限：开口管面审计只证明没有表面交叉，不排除包含；CLOSE_ENVELOPES 仍记 UNKNOWN（与 8×16 口径相同）。完整 `node scripts/validate-sop-interlock-swatch.mjs --full-boundaries`（含其余整布断言）还没有一次跑完，需在本机复跑（预计 10–25 分钟）。
   - 附带发现：整布构建 22 分钟，作为 app 里的整布预览不可用；性能不属本关口。
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

`1b7c8ed` 起 validator 自包含（夹具在 `scripts/fixtures/`）。已知 3 个失败（`sop-joint-lifecycle` / `sop-swatch-lifecycle` / `sop-topology-workbench`）来自 `23e71e7` 的 controller 改动，与单位无关，待决定改测试还是改源码。

## 本关口通过后

依次：Physical UV/PBR、Real Fabric Calibration、必要时 Relaxation/Contact，最后 Fuzz/High Fidelity。路线不承诺完成日期。
