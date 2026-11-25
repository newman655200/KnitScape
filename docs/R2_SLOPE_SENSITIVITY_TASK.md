# R2 任务书：T1 横密斜率机制诊断（判据第 2、3 项 + 接触刚度比扫描）

> **给 Codex 的指令**：先读 `AGENTS.md`（含 §8 协作流程）、`docs/NEXT_TASK.md`、`docs/archive/t1-slope-closeout-2026-11-23/STEP3_DIAGNOSTICS.md` 和本文件全文。然后从第 6 节 R2-0 开始，按顺序逐步执行。每一步完成后按第 9 节写提交信息，推送 `origin main`。遇到第 8 节任一停止条件，立即停下回报，等待指示。不要跳步，也不要合并步骤。

- 起草：架构师（Claude），2026-11-25
- 执行：Codex
- 授权：用户于 2026-11-25 确认执行本研究方向（判据第 2、3 项，按架构师建议）
- 基线：`main` @ `35b9788`（R1 完成）。开工前核对实际 HEAD 与 `git status`；`docs/R2_SLOPE_SENSITIVITY_TASK.md` 本身及其 §10 的改动不计入“工作区干净”检查
- 仓库位置：`docs/R2_SLOPE_SENSITIVITY_TASK.md`（R2-0 时由 Codex 放入，若用户尚未放入）

---

## 0. 一句话目标

用模型自身的数值实验，检验 `STEP3_DIAGNOSTICS.md` 里“T1 纵行间距由接触决定，所以横密对纱长不敏感”这一推测，并量化接触与弯曲的刚度比对横密斜率的影响。

**这是诊断，不是标定。** 本任务的任何结果都不得用来选择、调整或推荐 `d_e`、`K`、`phi0` 等参数的取值，也不改默认值。

## 1. 背景（只读）

- T1 横密 ∝ l^-0.39，Hossain 2025 干放松实测 ∝ l^-2.05（`REFERENCE_DATA_HOSSAIN2025.md`）。
- 判据第 1 项已完成：W/d_e 的增幅是 l 增幅的 39%。但这只是已有横密趋势的另一种写法，不能区分机制。
- 架构师补充一个现象：三个 Hossain N64 平衡态里，接触能只占总能量的 2.1% 到 2.8%（例如 2.84 mm 时为 4.40e-4 / 2.12e-2），其余都是弯曲能，势垒能为 0。**能量占比小不等于刚度占比小**。判据第 3 项正是要测横向刚度里接触占多少，这一点要在报告里明确区分。
- R1 之后，`DofLayout.freeIndices({ locked })` 已经支持按分量锁定，所以这次只需在 `solveFabricCell` 上加一个很薄的入口，不用另写求解器。

## 2. 研究问题与预先登记的判读阈值

阈值由架构师在运行前登记。**运行后不得修改阈值、增减工况或改变计算口径**，只能如实报告。落在“不确定”区间也是有效结论。

### Q2：W 是否按接触长度尺度成比例变化（判据第 2 项）

固定 l = 2.84 mm，把接触长度尺度缩放 ±5%，计算

`ε_W = ln(W₊ / W₋) / ln(1.05 / 0.95)`，同理计算 `ε_H`。

| ε_W（变体 A，主判据） | 判读 |
|---|---|
| ≥ 0.7 | 与“纵行间距由接触长度决定”一致 |
| ≤ 0.3 | 与该推测矛盾，按 STEP3 规则改为“推测不成立” |
| 介于两者之间 | 不确定 |

变体 B 只作辅助解读，不参与判定。

### Q3：横向有效刚度主要来自哪一项（判据第 3 项）

固定 l，锁定 W = W*(1+δ)，让 H、S 和全部节点充分松弛，记录各项能量。用中心二阶差分

`k_X = [E_X(+δ) − 2E_X(0) + E_X(−δ)] / (δ·W*)²`，X ∈ {total, bending, contact, barrier}

由于 E_total 恒等于各项之和，所以 k_total = k_bending + k_contact + k_barrier（检查这个恒等式，作为一致性校验）。定义接触份额 `s_c = (k_contact + k_barrier) / k_total`。

| s_c（l = 2.84 mm，δ = 1%，主判据） | 判读 |
|---|---|
| ≥ 0.6 | 横向刚度以接触为主，与推测一致 |
| ≤ 0.4 | 横向刚度以弯曲为主，与推测矛盾 |
| 介于两者之间 | 不确定 |

δ = 0.5% 和 2% 用于检查结果对步长是否敏感：如果三个 δ 下的 s_c 跨越不同判读区间，最终判读记为“不确定（步长敏感）”。

### QC：接触与弯曲的刚度比如何影响横密斜率

能量对 E_f 整体缩放不变（ALGORITHM_DESIGN 的协变结果），所以在 B 不变时，`K` 是接触与弯曲刚度比的唯一独立旋钮。取 K × {0.5, 1, 2}，在三个 l 下求解，按与 Hossain 对照相同的口径（对 ln 横密 vs ln l 作含截距、等权最小二乘）得到斜率 b(K)，报告 `db / d ln K`。

QC **不设通过或失败**，只报告数据。可以附一个“若按对数线性外推，b = −2.05 所需的 K 倍数”，但必须标注为“外推，仅用于判断量级，不是标定，不得作为参数建议”。如果外推需要 K 改变 10 倍以上，或者 b 对 K 不单调，就直接写明。

## 3. 范围

### 3.1 允许修改或新增

- `src/fabricForm/solveFabricCell.js`：**只**新增第 4 节的 `lockedLattice` 入口
- `scripts/`：研究运行脚本、检查脚本，以及它们的 `scripts/lib/` 辅助模块
- `package.json` 的 `scripts` 字段：新增一条 validate 命令和一条研究运行命令
- 新建 `docs/archive/t1-slope-r2-2026-11-25/`：只放小体积的汇总 JSON 和 `REPORT.md`
- `docs/archive/t1-slope-closeout-2026-11-23/STEP3_DIAGNOSTICS.md`：只在末尾追加 R2 结论一节，以及更新“执行范围”一行的状态；不改已有内容
- `docs/NEXT_TASK.md`：追加 R2 完成记录
- `docs/R2_SLOPE_SENSITIVITY_TASK.md`：本文件（含 §10 执行记录）

### 3.2 禁止

1. 不改物理内核、优化器、`fabricFormParams.js` 推导链、默认参数、容差、默认网格。
2. 不改 `lockedDimensions` 的现有语义和结果字段。
3. 不改 R1 金标准文件，金标准不一致时不得更新基线。
4. 不新增依赖，不改 Machine Domain、二维仿真、渲染、UI。
5. 不加摩擦、截面模型或任何新的能量项。如果结果提示需要这些，只在报告里写“建议另立任务”。
6. 不根据结果调整阈值、工况或口径（见第 2 节）。
7. 研究里用到的覆盖参数只存在于研究输入和报告中，不写回任何默认值或 fixture。

## 4. 唯一的代码改动：`lockedLattice`

在 `solveFabricCell()` 上新增可选输入：

```js
lockedLattice?: { W?: number, H?: number }   // 至少一个分量；S 不可锁定
```

要求：

1. `lockedLattice` 和 `lockedDimensions` 同时给出时抛 `TypeError`。锁定值必须是正的有限数（单位 mm），否则抛 `RangeError`，消息风格与现有一致。
2. 被锁的分量在初值中设为给定值（与 `lockedDimensions` 现有做法相同：只替换 W/H，不改节点坐标）。通过 `layout.freeIndices({ locked: [...] })` 排除，收敛检查和平衡判定只跳过被锁的分量。
3. 返回值：`mode` 为 `"LOCKED_LATTICE"`，新增 `lockedComponents`（例如 `["W"]`）；`equilibrium` 中被锁分量报告为 `F_<分量>`（锁定方向的广义反力，即 `latticeResidual` 的对应项），未锁分量照旧报告为 `R_<分量>`。其余字段与自由模式相同。
4. 不传 `lockedLattice` 时，代码路径和结果与 R1 **逐位一致**（R1 金标准 7/7 必须通过）。
5. 新增检查 `validate:fabric-form-locked-lattice`（进 `npm run validate`，目标耗时 < 60 s，用 N16 或 N24 的小工况）：
   - `lockedLattice: {W, H}` 与 `lockedDimensions: {W, H}` 的 `cell`、`energy`、`history`、`iterations` 逐位一致（只有 mode 和反力字段名不同）。
   - `lockedLattice: {W}` 的结果中 W 严格等于锁定值，H 和 S 发生变化，状态为 CONVERGED。
   - 以自由解的 W* 锁定 W 后求解，能量与自由解的相对差 ≤ 1e-8，`|F_W|·W*/E` ≤ 1e-6。
   - 非法输入（两种入口同时给、锁 S、负值、NaN）按第 1 条报错。

## 5. 研究设计

### 5.1 共同设置

- 工况来源：`docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-{2.77,2.84,2.9}-input.json`（材料、拓扑和数值设置）以及同目录 `step3-hossain-*-after.json`（收敛终态）。
- **初值一律取对应 l 的 after.json 终态 cell**（同一分支延续）。不要用 `createFabricFormInitialGeometry` 重新生成。
- 数值设置**原样沿用** input.json：N64、q = 12、`maxIterations` 24000、`innerIterations` 800、`memorySize` 180 等。不得为某个工况单独调整。
- 参数覆盖方式：先用 input.json 的参数调用 `createFabricFormParams()` 得到完整参数，再覆盖指定字段。被覆盖的字段及其派生字段，`provenance` 一律写为 `confidence: "DIAGNOSTIC_OVERRIDE"`，并写明 `source: "R2 task §5"`、`principle`（例如 “d_e and r_c scaled by 1.05 jointly; diagnostic only”）、`applicableState: "R2 mechanism diagnosis; not a material value"`。
- 每次运行生成 run manifest：输入 JSON 的 SHA-256、HEAD、Node 版本、平台、覆盖参数、初值来源文件、开始和结束时间、状态。

### 5.2 Q2：接触长度尺度（4 次求解）

l = 2.84 mm：

| 变体 | 覆盖 | 次数 |
|---|---|---|
| A（主判据） | `d_e` 和 `r_c` 同乘 s ∈ {0.95, 1.05}；`K`、`E_f`、`B`、`tex` 不变 | 2 |
| B（辅助） | 只有 `d_e` 乘 s ∈ {0.95, 1.05}；`r_c` 不变 | 2 |

基准点（s = 1）直接用 after.json，不重算。报告 W、H、S、横密、纵密、各项能量、最小间距与 d_e 的比值、ε_W、ε_H。

### 5.3 Q3：锁定宽度刚度（10 次求解）

| l | δ | 次数 |
|---|---|---|
| 2.84 | ±0.5%、±1%、±2% | 6 |
| 2.77、2.90 | ±1% | 4 |

W* 取各自 after.json 的 `cell.W`。δ = 0 的点直接用 after.json，不重算，但要在报告中引用 R2-0 检查里“以 W* 锁定 = 自由解”的结论来说明这样做的依据。

每点记录：E_total、E_bending、E_contact、E_barrier、H、S、F_W、F_W 按项分解（bending 梯度、contact 梯度在 W 分量上的值，以及约束项 `(Jᵀλ)_W`；按 `evaluateConstraintReaction` 的约定 `fullResidual = g + Jᵀλ`，三者之和应等于 F_W，报告差值）、最小间距与 d_e 之比、激活段对数。

按第 2 节公式计算三个 l 的 k_X 和 s_c，并给出两个一致性校验：一是 k_total 与各项之和的差；二是由 F_W 的中心差分 `[F_W(+δ) − F_W(−δ)]/(2δW*)` 估计的刚度与 k_total 的相对差。

### 5.4 QC：K 扫描（6 次求解）

K × {0.5, 2}，三个 l 各一次；K × 1 用 after.json。

**延续规则（预先规定）**：先从 after.json 直接求解。如果没有收敛（NOT_CONVERGED 或 INFEASIBLE），允许且只允许一次重试：分两步走，先 K × √2（或 1/√2）求解，再以其终态为初值求 K × 2（或 0.5）。两次尝试都要报告。重试仍失败就触发停止条件。

报告每个 K 的三点横密、纵密、各项能量，斜率 b_wale(K)、b_course(K)（含截距等权最小二乘，同时报告拟合残差），`db_wale / d ln K` 的有限差分估计，以及第 2 节允许的外推。

### 5.5 产出物

- 项目外归档（AGENTS.md §6）：`C:\Users\liuchen\Documents\KnitScape\archives\r2-slope-2026-11-25\`，放完整结果 JSON、日志、manifest。
- 仓库内 `docs/archive/t1-slope-r2-2026-11-25/`：
  - `q2-summary.json`、`q3-summary.json`、`qc-summary.json`：每次运行一行，包含上面要求的全部标量、状态、迭代数、耗时、manifest 摘要（含输入哈希），以及归档中完整结果的相对路径。不放坐标数组。
  - `REPORT.md`：每个问题一节，依次写出数据表、按预先登记阈值得到的判读、局限。六字段来源按仓库惯例写全。

## 6. 执行步骤（每步单独提交并推送）

**R2-0：`lockedLattice` 入口**
1. 核对 HEAD 和 `git status`，按开头说明豁免本任务书文件。如果用户还没放入任务书，就把本文件原样放到 `docs/R2_SLOPE_SENSITIVITY_TASK.md`。
2. 按第 4 节实现，加入 `validate:fabric-form-locked-lattice`。
3. 验收：`npm run validate` 全过（预期 50/50），`npm run build` 退出 0，`golden:fabric-form-solve` 7/7 逐位一致，求值级耗时按 R1 的同期配对口径（固定 9 对交替、取中位数）增加不超过 5%。

**R2-1：研究脚本与 Q2**
1. 新增研究运行脚本（建议 `scripts/run-fabric-form-r2-study.mjs`，命令 `study:fabric-form-r2`，不以 `validate:` 开头）。它按问题编号运行（例如 `--question q2`），写 manifest，拒绝覆盖已有结果。
2. 跑 Q2 的 4 次求解，生成 `q2-summary.json`，在 `REPORT.md` 写 Q2 一节。

**R2-2：Q3**：跑 10 次求解，生成 `q3-summary.json`，写 Q3 一节。

**R2-3：QC**：跑 6 次（至多 12 次，含重试）求解，生成 `qc-summary.json`，写 QC 一节。

**R2-4：结论与文档**
1. 在 `REPORT.md` 开头写一张总表：Q2、Q3 各自按阈值的判读，QC 的关键数字，加一段不超过 10 行的综合说明。综合说明只能陈述数据支持或不支持什么，不得提出参数取值建议。
2. 在 `STEP3_DIAGNOSTICS.md` 末尾追加“R2 结果（2026-11-25）”一节，链接 REPORT.md，并按判读更新推测状态：仍为“推测，待验证”，或改为“推测不成立”，或写“与数据一致（未证实因果）”。只能用这三种措辞之一。
3. 在 `docs/NEXT_TASK.md` 追加 R2 完成记录。
4. 不改其他文档。

R2-1 到 R2-4 都不改 `src/`，每步提交前仍须跑 `npm run validate` 和 `npm run build`。只有 R2-0 改动了 `src`，完整求解金标准在 R2-0 跑；R2-4 再跑一次确认。

## 7. 完成定义

- [ ] R2-0 到 R2-4 共 5 个提交，均已推送
- [ ] 不传 `lockedLattice` 时与 R1 逐位一致（R2-0 和 R2-4 各跑一次金标准，都是 7/7）
- [ ] Q2 全部 4 次、Q3 全部 10 次求解 CONVERGED；QC 全部收敛，或按延续规则重试后收敛
- [ ] 三份汇总 JSON 齐全，每行都能追溯到 manifest 和输入哈希
- [ ] Q3 的两项一致性校验都已报告实际数值
- [ ] REPORT.md 对 Q2、Q3 给出且仅给出按第 2 节阈值的判读；没有任何参数取值建议
- [ ] `git diff --stat 35b9788..HEAD` 中，`src/` 下只有 `solveFabricCell.js` 有改动

## 8. 停止条件

1. R1 金标准任一不一致。
2. `validate:fabric-form-locked-lattice` 中“以 W* 锁定 = 自由解”的检查失败。这说明锁定路径有问题，后面的 Q3 数据不可信。
3. Q2 或 Q3 任一求解未收敛或初值不可行。不允许改设置重跑。
4. QC 按延续规则重试后仍未收敛。
5. Q3 中 k_total 与各项之和的差超过 k_total 的 1e-6（说明能量记录有误），或者 F_W 中心差分刚度与 k_total 相对差超过 20%（说明不在线性区或分支有跳变）。
6. **仅 Q3**：任一锁定点的激活段对数（纵行间或横列间）相对同一 l 的基准点变化超过 30%，或最小间距与 d_e 之比相对基准点的变化超过 0.02。小扰动下这两个量应平滑变化，突变提示分支跳变，先停下由架构师判断。Q2 和 QC 的参数改动本身会改变接触状态，不适用此条，只在汇总里如实记录这两个量。
7. 为了完成任务不得不改第 3.2 节禁止的内容。
8. 发现现有代码有疑似缺陷：只记录，不修。

## 9. 回报格式（写进提交信息正文，并推送）

```text
refactor(fabric-form): R2-0 <内容>        ← R2-0 用 refactor
study(fabric-form): R2-x <内容>           ← R2-1 到 R2-4 用 study

状态：完成 / 停止（停止条件 #n）
基线：<上一步提交号>
validate：xx/xx，build：退出 0
R1 金标准（R2-0、R2-4）：7/7 逐位一致 / 未运行（本步未改 src）
本步求解：<运行编号  状态  iter  耗时>，逐行列出
关键数字：<本步对应问题的 ε_W / s_c / b(K) 等>
按阈值判读：<一致 / 矛盾 / 不确定 / 不适用>
偏离任务书：<没有就写“无”>
发现未处理的问题：<没有就写“无”>
本地归档：C:\Users\liuchen\Documents\KnitScape\archives\r2-slope-2026-11-25\R2-x\
```

触发停止条件但没有可提交的代码时，把停止记录写进本文件 §10 并单独提交推送。

## 10. 执行记录（Codex 填写）

### R2-0（2026-11-25）：完成

- 基线：`main @ 35b9788ba2375d96cc17544e8fdfff461b1bd911`；开工时除本任务书外工作区干净，远端 main 与本地一致。
- 新增 `lockedLattice` W/H 分量锁定入口与 `validate:fabric-form-locked-lattice`。单分量在共用坐标还原入口保留输入值，双分量保留旧 `lockedDimensions` 的逐位兼容；S 始终自由。
- 本轮 `npm run validate` 50/50、`npm run build` 退出 0；新增检查耗时 58.888 s。W* 锁定的能量相对差为 0，`|F_W|W*/E = 1.7222211633043253e-8`。
- 本轮 `golden:fabric-form-solve` 7/7 全部 CONVERGED，完整结果逐位一致；未更新金标准。
- 同期固定九对交替求值：R1 完成态中位数 702.0252 ms，当前 704.0207 ms，增加 0.28424905544701673%，低于 5%。全部 18 个样本保留。
- 归档：`C:\Users\liuchen\Documents\KnitScape\archives\r2-slope-2026-11-25\R2-0\`。本步尚未执行 Q2/Q3/QC，未修改预登记阈值或研究工况。

### R2-1（2026-11-25）：完成

- 基线：`22764b600a786d6e65f57e5b478c7aa1d6d85938`，R2-0 已推送。新增固定工况研究入口 `study:fabric-form-r2 -- --question q2|q3|qc`、逐点 manifest 与标量分析模块；不改 src。
- Q2 四点全部 CONVERGED。A：`ε_W=0.7064728928841619`，`ε_H=-0.7428645173734277`，按原阈值 `ε_W≥0.7` 判为“与推测一致”；B：`ε_W=0.7064729161461576`，`ε_H=-0.7428645254929224`，仅辅助，不参与判定。
- 本轮 `npm run validate` 50/50、`npm run build` 退出 0；分析模块自检、四点输入/初值/结果/代码哈希核对及拒绝覆盖检查通过。完整求解金标准未重跑（本步未改 src）。
- 输出：[q2-summary.json](archive/t1-slope-r2-2026-11-25/q2-summary.json)、[REPORT.md](archive/t1-slope-r2-2026-11-25/REPORT.md)；完整证据位于 `C:\Users\liuchen\Documents\KnitScape\archives\r2-slope-2026-11-25\R2-1\`。
- 任务书口径差异记录（不影响 Q2）：§5.4 的直接失败后“中间 K + 目标 K”延续规则最坏为 18 次求解，§6 R2-3 写至多 12 次。脚本保留详细延续规则，在第 13 次之前触发停止 #7 并等待架构师澄清，不自行改变工况或重试。Q3/QC 尚未运行。
