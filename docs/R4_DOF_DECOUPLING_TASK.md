# R4 任务书：自由度布局与求解结果解耦（不改行为的重构）

> **给 Codex 的指令**：先读 `AGENTS.md`（含 §8）、`docs/NEXT_TASK.md`、`docs/R1_REFACTOR_TASK.md`、`docs/ARCHITECTURE.md` 的 “Layer 3：fabricForm” 一节和本文件全文。然后从第 6 节 R4-0 开始，按顺序逐步执行。每步完成后按第 9 节写提交信息，推送 `origin main`。遇到第 8 节任一停止条件，立即停下回报，等待指示。不要跳步，也不要合并步骤。

- 起草：架构师（Claude），2026-11-27
- 执行：Codex
- 授权：用户于 2026-11-27 确认（“R4 + 设计稿”）
- 基线：`main` @ `b852cf2`（R3b-4）。开工前核对 HEAD 与 `git status`；本任务书文件本身及其 §10 的改动不计入“工作区干净”检查
- 仓库位置：`docs/R4_DOF_DECOUPLING_TASK.md`（R4-0 时由 Codex 原样放入，若用户尚未放入）
- **本任务书是架构师意见的唯一版本。** 后续裁定经用户转达后，由 Codex 原文追加到 §10，再按其执行。

---

## 0. 一句话目标

处理 R1 遗留的第 1、2 项：

1. 状态向量可以**按名字**增加新的自由度块，物理内核一行逻辑都不用改；
2. 求解核心不再知道 `bending`、`contact`、`W`、`H`、`S` 这些名字。T1 专属的结果格式（能量分项、间隙、势垒、轨迹保护）移到 T1 模型旁边。

改完后，金标准结果必须与改前**逐位一致**。这是截面模型（每节点截面自由度，由架构师另行起草设计稿，不在仓库内，本任务不实现）和 T2 氨纶（第二根纱）的共同前置条件。

**本任务不改变任何物理、数值算法、默认值和结果结构。** 不新增任何生产用的自由度块。

## 1. 背景（只读）

### 1.1 现有的硬编码（`main @ b852cf2`）

| 位置 | 现状 | 加新块时会出什么问题 |
|---|---|---|
| `model/dofLayout.js` L17–21 | 构造时断言“只有 positions、lattice 两块，lattice 在最后且恰为 W/H/S” | 任何新块都会直接抛错 |
| `model/dofLayout.js` L35–50 | `pack`/`unpack` 写死 positions 和 W/H/S；`freeIndices` 用 `firstFree = 3` 假设 positions 在最前 | 新块无法打包；positions 不在最前时平移固定会错位 |
| `periodicCell.js` L18–31，`rodBending.js` L45/L51/L103，`periodicContact.js` L248–256 | 内核自己按 `3N+3` 分配梯度，用 `gradient.length − 3`、`3 * positions.length` 定位 W/H/S | 内核输出不能直接当作全局梯度、雅可比行或步长方向 |
| `model/t1PlainJerseyModel.js` L15–26 | 包装层把内核数组原样当作全局向量返回 | 同上 |
| `model/fabricModel.js` L53、L74–87 | 布局固定用 `createDofLayout(cell)`，模型不能声明自己的块；`constraintsAt`、`safeStep` 不传布局上下文 | 新块无处声明 |
| `solveFabricCell.js` L71、L98、L114、L118、L121 | 全部自由度统一乘或除 `loopLengthMm` | 无量纲的新块（如截面长短轴比）会被错误缩放 |
| `solveFabricCell.js` L105、L129 | 收敛判据只检查 positions 块残差，再加 lattice | **新块的残差不进入判据，会出现假收敛**（静默错误，最危险） |
| `solveFabricCell.js` L106–107、L132–134 | 共轭长度写死为 `[W, H, W]` 和 `component === "H" ? "H" : "W"`；锁定豁免写成 `component !== "S"`、`i < 2` | 语义散落在求解器里 |
| `solveFabricCell.js` L78、L82、L85、L95–96、L111–112、L136–162、L174 | 直接读 `details.bending`、`details.contact` | 换掉或改名接触项，求解器就坏；新能量项不进入结果 |

### 1.2 架构决定：内核保留局部布局，模型层按名字映射

`docs/ARCHITECTURE.md` 现在写的是“将来必须先把这些内核改为从 layout 获取长度和偏移”。**本任务改用另一种做法**：

- 物理内核（`periodicCell.js`、`rodBending.js`、`periodicContact.js`、`yarnContact.js`）**逻辑不动**。它们的输入输出约定明确为“内核局部向量 = `[positions(3N)..., W, H, S]`”，这是内核自己的接口，不再要求全局状态向量也长这样。
- T1 能量项和约束的包装层，按块名把局部向量**散射**到全局梯度和雅可比行，并把全局步长方向**收集**成局部向量，再交给内核。这就是有限元里“单元局部 → 全局组装”的标准做法。

这样做的理由：

1. 物理内核零改动，逐位一致只依赖逐字节复制，风险最低；
2. 现有直接调用内核的脚本（golden-eval、各项检查、R2/R3 研究脚本）全部不受影响；
3. 将来的新能量项（截面压缩、氨纶拉伸）只需声明自己读写哪些块，不需要知道全局顺序。

代价是每次求值多一次 3N+3 长度的复制。相对接触积分，这个开销可以忽略，但仍按 §4.4 报告实测耗时。

### 1.3 不在本任务范围内

- R1 遗留第 3 项（金标准绑定 Node v20.17 / win32、重建基线流程）和第 4 项（金标准脚本默认归档路径写死）不处理。本任务跑 `golden:fabric-form-solve` 时一律用 `--archive-dir` 指定 R4 归档目录，不改脚本默认值。
- `constrainedOptimizer.js` 不动。

## 2. 范围

### 2.1 允许修改或新增

- `src/fabricForm/model/` 下的文件；可以新增模块（例如 `model/t1Reporting.js`），也可以新增子目录 `src/fabricForm/solve/` 放通用求解核心。
- `src/fabricForm/solveFabricCell.js`。
- `periodicCell.js`、`rodBending.js`、`periodicContact.js`：**只允许改注释**（写明内核局部布局约定），不得改动任何一行可执行代码。
- `scripts/lib/fabricFormDofLayoutChecks.mjs`、`scripts/lib/fabricFormModelChecks.mjs`：**只能新增检查**。现有断言一条都不删、不放宽。
- `scripts/validate-fabric-form-golden-eval.mjs`：只允许按 §4.2(e) 追加断言；不得改变 `row` 的结构、比较方式和基线文件。
- `docs/ARCHITECTURE.md`（Layer 3 一节）、`docs/NEXT_TASK.md`、本任务书（含 §10）。

### 2.2 禁止

1. 不改任何物理公式、材料推导、接触与势垒、收敛判据的数值门槛（`1e-6`、`1e-4` 等）、容差和默认值；不改 `constrainedOptimizer.js`。
2. 不改变 `solveFabricCell()`、`evaluateFabricCell()`、`packFabricCell()`、`unpackFabricCell()`、`createDofLayout(cell)`（单参数调用）、`createT1PlainJerseyModel(params, { quadratureOrder })` 的签名和返回结构。**返回对象的键顺序也属于结构**：金标准用保留键顺序的 `JSON.stringify` 比较。
3. 不改任何现有错误的类型和消息文本（`validate-fabric-form-locked-lattice` 等检查依赖它们）。
4. T1 生产模型的布局仍然只有 positions、lattice 两块，顺序不变。**不新增生产用的自由度块**，不写截面、氨纶或其他新物理。
5. 不移动、不重命名现有文件，不删除现有导出；`positions` 仍为数组的数组。
6. 不改金标准基线文件；金标准不一致时不得用更新基线来“修复”。
7. 不新增依赖；不改 Machine Domain、二维仿真、渲染、UI；不改 R2/R3 研究脚本和它们的 summary JSON。
8. 不增加 `validate:` 命令。新检查放进现有的 `validate:fabric-form-solver-math`（dofLayout、model 两组检查）和 golden-eval 中，validate 项数保持 50。

## 3. 目标结构

字段名和函数名可以调整，但下面列出的语义必须齐全，并写进 JSDoc。

### 3.1 块声明与 DofLayout

`createDofLayout(cell, blocks = T1_DOF_BLOCKS)`，单参数调用的行为与现在完全相同。

每个块声明（block spec）至少包含：

| 字段 | 含义 | T1 positions | T1 lattice |
|---|---|---|---|
| `name` | 唯一块名 | `"positions"` | `"lattice"` |
| `length(cell)` | 该块的分量数 | `3 × nodeCount` | `3` |
| `components` | 可选，命名分量 | 无（按序号索引） | `["W","H","S"]` |
| `read(cell)` / `write(target, values)` | 从 cell 读出、写回 cell | positions 数组的数组 | `W`、`H`、`S` 字段 |
| `scaleKind` | 求解器坐标缩放类型：`"length"`（除以 loopLengthMm）或 `"dimensionless"`（缩放为 1） | `"length"` | `"length"` |
| `translation` | 可选，平移固定时排除的块内序号 | `[0, 1, 2]` | 无 |
| `equilibrium` | 平衡判据类型，见 3.3 | `maxAbs` | `conjugateLength`，共轭 `{ W:"W", H:"H", S:"W" }` |

布局构造时校验：块名唯一；长度为正整数；偏移从 0 开始、按声明顺序连续；每个块都声明了 `scaleKind` 和 `equilibrium`。**未声明平衡判据的块，构造时就抛错**——这是防止假收敛的关键守卫，替代现在 L17–21 的“只能两块”断言。

逐位一致要求：

- `pack` 输出的字节与现在相同（包括 −0）。
- `unpack` 先 `{ ...template }`，再按块顺序写字段。模板已有的键保持原位置，所以终态 `cell` 的 JSON 键顺序不变。positions 必须是新数组，每个点也是新数组（现有检查断言了这一点）。
- `freeIndices` 按全局下标升序返回；平移固定排除声明了 `translation` 的块的对应分量，不再假设 positions 在最前。
- 现有冻结行为保留：`layout.blocks`、块对象、`components` 不可修改（现有检查断言了这一点）。

### 3.2 内核视图与模型组合

- 新增“内核视图”：给定全局布局和块名列表（T1 内核为 `["positions", "lattice"]`），提供 `scatter(local) → 全局 Float64Array(layout.size)` 和 `gather(global) → 局部 Float64Array`。构造时校验所需块存在且分量顺序与内核约定一致，否则抛错。
- 复制**必须**用 `TypedArray.prototype.set` 加 `subarray` 按块整段复制，不得逐元素相加，以保证 −0 和 NaN 字节原样保留（内核在不可行时会把梯度填成 NaN）。新数组其余位置为 +0。
- T1 的三个包装（`bending`、`contact`、`segmentLength`）改为：梯度和每一行雅可比经 `scatter` 输出；`contact.safeStep` 收到全局方向后先 `gather` 再调用 `safePeriodicStep`。`details` 保持内核原始输出，按内核局部布局索引，并在 JSDoc 中写明。
- `createFabricModel({ id, terms, constraints, blocks })`：
  - 新增 `model.createLayout(cell)`，`blocks` 缺省为 T1 块；
  - `evaluate`、`constraintsAt`、`safeStep`、`diagnose` 都用同一个 `createLayout` 生成上下文 `ctx = { layout }`，分别以 `term.evaluate(cell, ctx)`、`constraint.evaluate(cell, ctx)`、`term.safeStep(cell, direction, limit, ctx)` 传入；
  - `safeStep` 传给各项的 `direction` 必须是调用方传入的**同一个对象**（现有检查断言了这一点）；
  - 现有的“梯度长度必须等于 layout.size”检查保留；对雅可比行新增同样的长度检查。
  - 能量和梯度的累加顺序、首项起步方式（`fabricModel.js` 现有 L61–68）不变。
- `t1PlainJerseyModel.js` 额外导出可单独组合的部件（例如 `T1_DOF_BLOCKS`、`createT1Terms(params, { quadratureOrder })`、`createT1Constraints()`），让后续模型可以“T1 各项 + 新项 + 新块”组合，而不复制代码。`createT1PlainJerseyModel` 的结果与现在完全相同，只是另外挂上 3.4 的默认报告适配器。

### 3.3 通用求解核心

把 `solveFabricCell` 拆成两层：

- **T1 入口**（仍是 `solveFabricCell`）：输入校验（错误消息不变）、锁定处理、初值构造、选择报告适配器、调用核心、格式化结果。
- **通用核心**（新模块）：接收 model、layout、初始 cell、自由下标、锁定分量列表、长度缩放值、能量缩放值、优化器设置和观察器，返回原始结果（优化器输出、终态 cell、终态求值、约束、约束反力、步长保护计数、观察器状态等）。

核心的要求：

1. **不出现以下任何名字**：`bending`、`contact`、`barrier`、`details`、`params`、`topology`、`r_c`、`d_e`、字符串 `"W"`/`"H"`/`"S"`、属性 `.W`/`.H`/`.S`。§4.2(f) 用源码静态检查验收，匹配规则固定为：标识符用 `\b(bending|contact|barrier|details|params|topology|r_c|d_e)\b`，字符串用 `["'\x60](W|H|S)["'\x60]`，属性用 `\.(W|H|S)\b`；注释也算在内。
2. 坐标缩放按块的 `scaleKind` 生成逐下标缩放向量；T1 两块都是 `"length"`，每个元素做的乘除与现在完全相同（`x[i] * s[i]` 与 `x[i] * scale` 在 `s[i] === scale` 时逐位相同）。
3. 收敛判据按布局顺序逐块检查，先检查约束值（现有 L103，不变），再依次检查每个块：
   - `maxAbs`：与现在 L105 完全相同，`Math.max(...|残差|) > 1e-6 * E` 判失败；
   - `conjugateLength`：与现在 L106–107 完全相同，`|残差_c| * x[共轭(c)] <= 1e-6 * E` 判通过，锁定分量豁免；
   - **保留两种写法各自的比较运算符**（一个用 `>` 判失败，一个用 `<=` 判通过），这样含 NaN 时的行为也不变。
4. 锁定豁免由入口传入一个分量列表：`lockedComponents ?? (lockedDimensions ? ["W", "H"] : [])`，与传给 `freeIndices` 的列表是同一个。它和现在的 `lockedDimensions && component !== "S"` 等价。
5. 观察器：核心在**初始求值可行之后**（现在 L95–96 的位置）和**优化器每次调用 evaluate 时**（L110–112）各调用一次 `observer.observe(evaluation)`；**最终的重新求值（L126）不调用**。这与现在 `minimumEvaluatedDistance` 的更新时机完全一致。
6. 步长保护计数（`acceptedSafeBounds`、`minimumSafeBound`）留在核心，它们与项无关。
7. 入口专属的锁定值回写（现在 L73：部分锁定时保留调用方给定的精确毫米值），作为钩子由入口传给核心，不写进核心。

### 3.4 T1 结果适配器

新增 `createT1Reporting({ bendingTermId = "bending", contactTermId = "contact" } = {})`（名称可调），提供：

- `createObserver(params)`：记录 `minimumEvaluatedDistance`、`maximumEvaluatedBarrierEnergy`，给出 `trajectoryPassed`；
- `formatInfeasible(...)`：生成现在 L79–92 的对象；
- `formatResult(...)`：生成现在 L138–175 的对象，包括 `status` 的判定。

要求：

- 对象构造**逐字搬移**：键的顺序、每个算式的写法和结合顺序都不变（例如 `Math.abs(r)*[cell.W,cell.H,cell.W][i]/evaluation.energy`、`.2*(Math.min(minimumEvaluatedDistance,params.d_e)-params.r_c)`）。适配器本来就是 T1 专属的，可以保留 W/H/S 和 `bending`/`contact` 字面量；但**读取 `details` 和 `model.diagnose()` 的结果时，项 id 必须来自配置参数**（例如现在 L174 的 `model.diagnose(cell).contact` 改为按 `contactTermId` 取），不得写死。
- `solveFabricCell` 使用 `model.reporting ?? createT1Reporting()`。调用方传入不带 `reporting` 的自定义模型时，行为与现在相同。
- `evaluateFabricCell` 兼容导出保持不变。

## 4. 验证

### 4.1 每个改代码的步骤（R4-1、R4-2）

- 全量 `npm run validate`（50 项，含 `validate:fabric-form-golden-eval`）和 `npm run build`；
- `golden:fabric-form-solve` 跑**一次**，7/7 逐位一致。命令：`npm run golden:fabric-form-solve -- --archive-dir C:\Users\liuchen\Documents\KnitScape\archives\r4-dof-decoupling-2026-11-27\R4-x\golden-solve`；
- 不做同机重复双跑，不做额外文件哈希。

### 4.2 新增检查（全部为硬性验收，放进 dofLayout / model 检查组）

用 N24 默认拓扑、默认参数、`quadratureOrder = 4`，与现有 model 检查相同。“探针块”（probe）指一个长度为 2、`scaleKind: "dimensionless"`、`equilibrium: maxAbs` 的块，没有任何能量项或约束读写它，初值取 `[0.25, -0.5]`。

**R4-1 加入：**

- (a) 现有 dofLayout、model 检查全部原样通过。
- (b) 探针块分别放在 positions 之前、positions 与 lattice 之间、lattice 之后，三种布局都检查：偏移和命名索引正确；`pack`/`unpack` 往返逐字节相同；`freeIndices` 等于“T1 自由下标按名字映射后，再按升序并入探针下标”；平移固定排除的是 positions 前三个分量的实际全局下标。
- (c) 用“T1 各项 + T1 约束 + 探针块”组合模型，对三种布局分别检查：
  - 能量逐字节等于 T1；梯度在探针处为 +0，其余分量按名字收集后逐字节等于 T1；
  - 约束值逐字节相同；每一行雅可比在探针处为 0，其余逐字节相同；
  - `safeStep`：把 T1 方向散射到探针布局，并在探针分量填入非零值（如 1e3），结果严格等于 T1 的 `safeStep`；
  - `diagnose` 深度相等。
- (d) 布局构造的错误路径：块名重复、长度非正整数、缺 `scaleKind`、缺 `equilibrium`，都抛错。
- (e) golden-eval 追加断言：对 7 组的初始和终态 cell（共 14 个），T1 模型路径的 `constraintsAt`、`safeStep`（同一方向、limit=1）与直接调用内核逐字节相同。断言失败按 STOP #3 处理。不改 `row`、不改基线。

**R4-2 加入：**

- (f) 源码静态检查：读取通用核心模块的源码文本，断言不含 §3.3 第 1 条列出的任何名字。
- (g) 改名检查：把 T1 的两个能量项以 id `bendingRenamed`、`contactRenamed` 重新登记，并用 `createT1Reporting({ bendingTermId: "bendingRenamed", contactTermId: "contactRenamed" })` 作为报告适配器。用同一输入（`maxIterations: 200`）分别求解默认模型和改名模型，去掉 `diagnostics.elapsedMs` 后的 `JSON.stringify` 必须完全相同。默认模型这次求解须实际迭代（`iterations ≥ 20`），避免比较空跑。
- (h) 探针块求解：探针分别放在 positions 与 lattice 之间、lattice 之后，用同一输入（`maxIterations: 200`）求解，与默认模型比较：
  - `status`、`optimizerStatus`、`iterations`、`evaluations`、`history`、`energy`、`constraints`、`clearance`、`barrier`、`trajectory`、`settings` 的 JSON 完全相同；
  - 终态 `cell` 的 positions、W、H、S 逐字节相同；探针值与初值逐字节相同；
  - `equilibrium` 中除 `freeResidual` 外的字段 JSON 相同；`freeResidual` 去掉探针对应的分量后相同，探针分量全为 0（±0 均可）。

(c)、(e)、(g)、(h) 任一项不一致，按 STOP #3 处理：报告第一个不一致的字段或下标，**不得调整检查口径**。

### 4.3 兼容性

R2、R3-a、R3-b 研究脚本不跑，但它们使用的导入（`createDofLayout`、`createT1PlainJerseyModel`、`solveFabricCell` 等）必须不改调用即可工作。用 `node --check` 或导入级冒烟确认能加载即可，不跑求解。

### 4.4 性能（只报告）

R4-2 的提交信息里，报告 golden-solve 每组和 7 组合计的耗时，与 `scripts/fixtures/fabric-form-golden/solve-baseline.json` 中的 `elapsedMs`（合计约 443 s）对比。不做额外测量，不重复运行。合计增幅超过 +15% 时，写进“发现未处理的问题”，**不停止**，由架构师判断是否需要成对测量。

## 5. 验证口径（固定写法）

- **每步都跑全量 `npm run validate`（含 `validate:fabric-form-golden-eval`，它只比对求值输出、不跑求解，是常规项，必须跑）和 `npm run build`。**
- `golden:fabric-form-solve` 只在改动 `src/` 的 R4-1、R4-2 各跑一次；R4-0、R4-3 是纯文档步骤，不跑。
- 不做性能测量（§4.4 只是读取已有输出里的耗时），不做额外文件哈希，不做同机双跑。

## 6. 执行步骤（每步单独提交并推送）

**R4-0：立项（纯文档）**

1. 核对 HEAD 为 `b852cf2`、`git status` 干净（本文件除外）；若用户尚未放入，把本文件原样放到 `docs/R4_DOF_DECOUPLING_TASK.md`。
2. `docs/NEXT_TASK.md` 追加一行：“R4 立项：R1 遗留 1、2 的不改行为重构（自由度布局与求解结果解耦），见 R4_DOF_DECOUPLING_TASK。”
3. 验收：全量 validate、build 通过。

**R4-1：块声明、DofLayout 与内核视图**

1. 按 3.1、3.2 实现；`dofLayout.js` 顶部“Migrate those kernels…”的注释改为新的约定说明；三个内核文件只补注释。
2. 加入 §4.2 (a)–(e)。
3. 验收：§4.1 全部通过。本步不要求 `solveFabricCell` 支持额外块（那是 R4-2 的事），T1 求解路径照常走新布局。

**R4-2：通用求解核心与 T1 结果适配器**

1. 按 3.3、3.4 实现。
2. 加入 §4.2 (f)–(h)，完成 §4.3 兼容性确认。
3. 验收：§4.1 全部通过；按 §4.4 报告耗时。

**R4-3：文档与交接（纯文档）**

1. `docs/ARCHITECTURE.md` Layer 3 一节：
   - 用 §1.2 的新约定替换“自由度扩展前必须处理的内核假设”一段；
   - 更新 DofLayout、FabricModel、solveFabricCell 三行的职责说明，新增通用核心、内核视图、T1 结果适配器三行；
   - 扩展点改写为：新增自由度块（写块声明，必须给出 `scaleKind` 和平衡判据）、新增读写新块的能量项（声明内核视图所需块）、新增结果格式（提供报告适配器）；
   - 写明 R1 遗留 1、2 已由 R4 关闭，3、4 仍未处理。
2. `docs/NEXT_TASK.md` 追加 R4 完成记录。不改其他文档。
3. 验收：全量 validate、build 通过。

## 7. 完成定义

- [ ] R4-0 到 R4-3 共 4 个提交，均已推送
- [ ] 每步全量 validate 50/50、build 退出 0；R4-1、R4-2 各一次 `golden:fabric-form-solve` 7/7 逐位一致；提交信息里写实际数字
- [ ] §4.2 (a)–(h) 全部通过；现有检查无删减、无放宽
- [ ] 通用核心源码不含 §3.3 第 1 条列出的名字；读取 `details` 的地方只剩 T1 报告适配器（按配置的 id）和保持不变的 `evaluateFabricCell` 兼容导出
- [ ] 加一个新块只需写块声明；加一个读写新块的能量项只需声明内核视图；求解器和优化器都不用改
- [ ] `git diff --stat b852cf2..HEAD` 中，三个内核文件只有注释改动，`constrainedOptimizer.js`、金标准基线、R2/R3 研究脚本与 summary 无改动

## 8. 停止条件

1. 任一金标准不一致（求值级或求解级）。不得更新基线。
2. 为了逐位一致，不得不修改 §2.2 禁止的内容（包括内核可执行代码、优化器、结果键顺序）。
3. §4.2 (c)、(e)、(g)、(h) 任一项不一致：报告第一个不一致的字段或下标，不调整检查口径。
4. 现有脚本必须改调用才能加载或运行（§4.3）。
5. validate 或 build 出现与本步改动无关的失败（在基线提交上同样失败）：只记录，不修。
6. 发现现有代码有疑似缺陷：只记录，不修。

以下情况**只记录、不停止**：§4.4 耗时增幅超过 +15%。

## 9. 回报格式（写进提交信息正文，并推送）

```text
docs(fabric-form): R4-0 <内容>            ← R4-0、R4-3 用 docs
refactor(fabric-form): R4-x <内容>        ← R4-1、R4-2 用 refactor

状态：完成 / 停止（停止条件 #n）
基线：<上一步提交号>
validate：50/50（含 golden-eval 7/7），build：退出 0
golden:fabric-form-solve：<未运行（纯文档）> 或：
  case-2.6-N48   CONVERGED  iter=…  逐位一致  …s
  case-3-N48     …
  case-3.5-N48   …
  case-4-N48     …
  hossain-2.77   …
  hossain-2.84   …
  hossain-2.9    …
  合计 …s（基线 …s，…%）            ← 仅 R4-2 必填
新增检查：<(a)–(h) 中本步加入的各项：通过 / 不一致（首个差异）>
公开接口变化：<新增或改动的函数及签名；没有就写“无”>
偏离任务书：<没有就写“无”>
发现未处理的问题：<没有就写“无”>
本地归档：C:\Users\liuchen\Documents\KnitScape\archives\r4-dof-decoupling-2026-11-27\R4-x\
```

触发停止条件、但没有可提交的代码时，把停止记录写进本文件 §10，单独提交并推送。

## 10. 执行记录（Codex 填写；架构师后续裁定也原文追加在此）

（暂无）

### R4-0（2026-11-27）：完成

- 基线 main @ b852cf23d3887216ad6387e95577ac7b6bbb69ff，与 origin main 一致；排除本任务书后工作区干净。用户已放入任务书，原文保留，仅在 §10 追加执行记录；收到的原文件副本留在本步归档。
- 已读 AGENTS.md（含 §8）、NEXT_TASK、R1 任务书、当前功能与算法、ARCHITECTURE 的 Layer 3 及本任务书全文；NEXT_TASK 已追加指定立项行。
- 本轮全量 npm run validate 50/50（含 golden-eval 7/7），npm run build 退出 0。纯文档步骤，未运行 golden:fabric-form-solve、额外性能测量或额外文件哈希。
- 公开接口变化：无。偏离任务书：无。发现未处理的问题：无。
- 本地归档：C:/Users/liuchen/Documents/KnitScape/archives/r4-dof-decoupling-2026-11-27/R4-0/。
