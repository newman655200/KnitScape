# R1 任务书：fabricForm 不改行为的结构重构

> **给 Codex 的指令**：先读 `AGENTS.md`、`docs/NEXT_TASK.md` 和本文件全文，然后从第 5 节 R1-0 开始，按顺序逐步执行。每一步完成后，按第 8 节的格式写提交信息，并推送到 GitHub（`origin main`）。遇到第 7 节的任一停止条件，立即停下，回报后等待指示。不要跳步，也不要合并步骤。

- 起草：架构师（Claude），2026-11-25
- 执行：Codex
- 授权：用户于 2026-11-25 确认先做本任务（不改行为的重构）
- 基线：`main` @ `62e9d1c`（2026-11-23 docs: add read-only width-to-diameter hypothesis check）；开工前按 AGENTS.md 重新核对实际 HEAD 与 `git status`
- 仓库位置：`docs/R1_REFACTOR_TASK.md`（R1-0 时由 Codex 放入）

---

## 0. 一句话目标

把 T1 求解器里写死的三件事拆成可扩展的结构：**组织拓扑**、**能量项和约束的组合**、**自由度布局**。改完后数值结果必须与改前**逐位一致**，为 T2 氨纶、T3 集圈和罗纹扩展铺路。

**本任务不改变任何物理、数值算法和默认值。** 只要有一个金标准结果不一致，就视为失败。

## 1. 为什么做（背景，只读）

阅读 `src/fabricForm/` 后确认了三处硬编码，它们会直接阻碍 T2、T3：

| 位置 | 现状 | 对后续的阻碍 |
|---|---|---|
| `fabricFormTopology.js::createPlainJerseyTopology()` | 调用了 `resolveSingleJerseyOperations()`，但只用它来拒绝 T/M。节点编排、交叉字 `[-1,-1,1,1]`、`passesThrough` 单对象、`+Z` 约定全部写死 | T3 的规则“成圈时新线圈穿过该针上自上次成圈以来累积的全部线圈与集圈弧”（ALGORITHM_DESIGN §3.1，FACT）没有地方表达；罗纹评估（`docs/design/rib1x1-feasibility.md`）也指出这里是主要重构点 |
| `solveFabricCell.js::evaluateFabricCell()` | `bending + contact` 写死 | T2 的氨纶拉伸、C1 的摩擦、可压缩截面变体无法插入，也无法并排比较模型变体（横密斜率问题需要这样比较） |
| `solveFabricCell.js` 的 `packFabricCell` / `freeIndices`（`i !== lattice+1`），以及 `periodicCell.js::accumulateEndpointGradient()` 的 `gradient.length - 3` | 用手算偏移定位 W/H/S | T2 要多一根纱，T3 要加材料坐标，一旦向量末尾追加新块，`length - 3` 会静默出错 |

`constrainedOptimizer.js` 已经是通用接口（evaluate、constraints、safeStep、freeIndices），**本任务不动它**。

## 2. 范围

### 2.1 允许修改或新增

- `src/fabricForm/` 下的文件，可以新增子目录 `src/fabricForm/model/` 和 `src/fabricForm/topology/`
- `scripts/` 下与 fabricForm 有关的检查和运行脚本
- `scripts/fixtures/fabric-form-golden/`（新建，存放金标准）
- `package.json` 的 `scripts` 字段（新增 validate 和 golden 命令）
- `docs/ARCHITECTURE.md`（补 fabricForm 一节）、`docs/R1_REFACTOR_TASK.md`（本文件，含末尾执行记录）、`AGENTS.md`（只追加附录 A 的一节）

### 2.2 禁止

1. 不改 `constrainedOptimizer.js` 的任何逻辑。
2. 不改任何物理公式、材料推导、收敛判据、容差和默认值，包括：`fabricFormParams.js` 的推导链、`rodBending.js` 的弯曲能、`yarnContact.js` 和 `periodicContact.js` 的接触与势垒、默认 N48、`defaultMemorySize` 规则、`maxIterations` / `innerIterations` / `initialPenalty` / `stagnationWindow`。
3. 不改变 `solveFabricCell()` 返回对象的结构和字段，新增字段也不行。金标准按完整 JSON 比较。
4. 不移动、不重命名现有文件，不删除现有导出。`scripts/` 里有 18 个文件依赖这些导出，旧入口只能改成包装新实现的薄壳。
5. 不把 `positions` 从数组的数组改成 `Float64Array`。这件事有性能收益，但另立任务。
6. 不写任何 T2、T3 物理代码：不加氨纶项，不加集圈几何，不让离散化接受 T/M。
7. 不改 `src/domain/`（Machine Domain）、二维仿真、渲染、UI。
8. 不新增 npm 依赖。
9. 金标准不一致时，**不得**通过更新金标准文件来“修复”。必须停下，按第 7 节报告。
10. 遵守 AGENTS.md §6：项目外的证据（完整日志、大文件）放到 `C:\Users\liuchen\Documents\KnitScape\archives\r1-refactor-2026-11-25\`；仓库内只放小体积的金标准摘要。

## 3. 目标结构

```text
K/T/M 动作矩阵（resolveSingleJerseyOperations，唯一权威，不动）
   │
   ▼ topology/knitGraph.js::compileKnitGraph()       纯拓扑，无坐标
KnitGraph
   │
   ▼ topology/discretize.js::discretizeKnitGraph()   需要 StitchTemplate
旧版 topology 对象（与现在 createPlainJerseyTopology 的输出深度相等）
   │
   ▼ fabricFormInitialGeometry.js（按模板取种子曲线，函数签名不变）
Cell { positions, W, H, S, topology }
   │
   ▼ model/t1PlainJerseyModel.js                       EnergyTerm[] + Constraint[]
   ▼ model/dofLayout.js                                pack / unpack / freeIndices
constrainedOptimizer（不动）
```

### 3.1 DofLayout（`src/fabricForm/model/dofLayout.js`）

职责：定义状态向量的分块顺序，以及按名字定位每一块。

最低要求：

- `createDofLayout(cell)` 返回的对象至少包含：`size`；有序分块 `blocks`（本任务只有 `positions`：offset 0，长度 3×nodeCount；`lattice`：长度 3，分量名 `W`、`H`、`S`）；`pack(cell)`；`unpack(x, template)`；`index(blockName, component)`；`freeIndices({ fixTranslation: true, locked: ["W","H"] | [] })`。
- 分块顺序必须与现在**完全相同**：`[positions..., W, H, S]`。这是逐位一致的前提。
- `solveFabricCell.js` 里 `lattice`、`lattice+1`、`lattice+i`、`x[lattice+(i===1?1:0)]` 等手算偏移，全部改成通过 layout 按名字取。
- `packFabricCell` / `unpackFabricCell` 保留导出，改为调用 layout。
- 物理内核 `periodicCell.js`（`accumulateEndpointGradient` 的 `gradient.length - 3`、`createCellGradient`）和 `periodicContact.js::safePeriodicStep`（`3 * cell.positions.length` 以及 `lattice + 1`、`lattice + 2`）内部也有偏移假设。**本任务不改这些内核。** 由 layout 在构造时断言“lattice 块是最后一块，且紧跟在 positions 之后”，并在 `docs/ARCHITECTURE.md` 中记录：将来追加新的自由度块之前（R2 或 T2），必须先把这些内核改成从 layout 取偏移。

### 3.2 EnergyTerm、Constraint、Model（`src/fabricForm/model/`）

```js
// 约定，字段名可以调整，但语义必须齐全并写进 JSDoc
EnergyTerm = {
  id: "bending" | "contact",
  evaluate(cell, ctx) → { energy, gradient /* 长度 = layout.size */, feasible /* 可选，默认 true */, details },
  safeStep?(cell, direction, limit) → number,   // 只有 contact 提供
  diagnose?(cell) → object,                     // 只有 contact 提供，只读
}
Constraint = { id: "segmentLength", evaluate(cell) → { values, jacobian, maxStrain } }
Model = { id: "T1_PLAIN_JERSEY", terms: EnergyTerm[], constraints: Constraint[],
          evaluate(cell), constraintsAt(cell), safeStep(cell, d, limit), diagnose(cell) }
```

- `bending` 包装 `evaluateRodBending`，`contact` 包装 `evaluatePeriodicContact` / `safePeriodicStep` / `diagnosePeriodicContact`，`segmentLength` 包装 `evaluateLengthConstraints`。**被包装的函数一行都不改。**
- 新增 `createT1PlainJerseyModel(params, { quadratureOrder })`。
- `evaluateFabricCell(cell, params, quadratureOrder)` 保留导出，返回结构不变（`energy`、`gradient`、`bendingEnergy`、`contact`），内部改为调用 model。
- `solveFabricCell()` 增加可选输入 `model`，缺省时用 `createT1PlainJerseyModel(params, { quadratureOrder })`。除此之外签名和返回值都不变。可行性判断从“`contact.feasible`”泛化为“所有项的 feasible 都为真”。

**逐位一致的关键是浮点求和顺序。** 必须保证：总能量为 `bending.energy + contact.energy`，按项的顺序累加；梯度逐分量为 `bending.gradient[i] + contact.gradient[i]`，顺序相同。用 `0` 起步再依次累加是允许的，因为 `0 + a === a`。不得改成其他结合顺序或使用 Kahan 求和。

### 3.3 KnitGraph 与离散化（`src/fabricForm/topology/`）

**`compileKnitGraph({ operations, m, n })`**

输入动作矩阵，输出纯拓扑图，不含坐标、节点数和长度。至少要表达：

- 每路的纱线：`yarnId`、`feed`、沿纱方向的材料次序。
- 每个针位、每路的动作 `K` / `T` / `M`，以及对应的成圈或集圈弧记录。
- **挂针累积规则**（ALGORITHM_DESIGN §3.1，FACT）：每根针维护一个“自上次成圈以来累积的线圈与集圈弧”列表。遇到 `K` 时，新线圈穿过该列表中的全部项，然后列表清空、只放入新线圈；遇到 `T` 时把集圈弧加入列表；遇到 `M` 时不变。
- 跨周期边界的引用必须带整数周期偏移 `(p, q)`，约定与现有拓扑相同：第 0 路引用上一循环最后一路时 `q = -1`。
- 规则对 K/T/M 通用实现。本任务只是在图层面输出 T/M，不进入离散化。

**`discretizeKnitGraph(graph, { nodesPerLoop, loopLengthMm, template })`**

把图转换成现在的 topology 对象。

- 全部为 K 且每路单纱时：输出与重构前 `createPlainJerseyTopology()` 的输出**深度相等**。这包括字段顺序无关的全部键值：`m`、`n`、`nodesPerLoop`、`loopLengthMm`、`nodeCount`、`operations`、`yarns`、`edges`、`bends`、`loops`（含 `passesThrough`，它仍然是单对象形状）、`crossingConvention`。
- 遇到 T、M 或多纱时，抛出与现在**相同的错误**（`error.code === "UNSUPPORTED_IN_STEP1"`，消息格式相同）。

**StitchTemplate（`topology/stitchTemplates.js`）**

交叉字 `[-1,-1,1,1]`、`orientation`、`crossingConvention` 的来源说明，以及种子曲线的出处（sabetta/stitch-by-stitch @ `0ed27f35…`），都属于“某一种初值嵌入的签名”，不属于拓扑。把它们收拢为一个模板 `stockinette-sabetta`。`discretizeKnitGraph` 从模板取交叉字。`fabricFormInitialGeometry.js` 的 `REFERENCE_CURVES` 可以留在原文件，但通过模板 id 关联。**不改动任何曲线数值。**

**入口兼容**

`createPlainJerseyTopology(opts)` 保留，内部改为三步：`resolveSingleJerseyOperations` → `compileKnitGraph` → `discretizeKnitGraph(..., template: stockinette-sabetta)`。`replicatePeriodicCell()` 继续调用它，不用改。

## 4. 金标准与验证分层

### 4.1 金标准来源（仓库内已有）

`docs/archive/t1-slope-closeout-2026-11-23/` 下有 7 组输入和结果，都是 CONVERGED：

| 组 | 输入 | 已归档结果 | 网格 | 历史耗时 |
|---|---|---|---|---|
| N48 四工况 | `step4-case-{2.6,3,3.5,4}-N48-input.json` | `step4-case-*-N48.json` | N48 | 约 35 s / 个（case-3） |
| Hossain 三点 | `step3-hossain-{2.77,2.84,2.9}-input.json` | `step3-hossain-*-after.json` | N64 | 约 100 s / 个 |

输入文件格式是 `{ input, origin }`。求解调用就是 `solveFabricCell(input)`，与 `scripts/run-fabric-form-a14-closeout.mjs --solve` 的主调用一致。

### 4.2 比较口径

“逐位一致”的定义：对 `solveFabricCell` 的返回值，删除 `diagnostics.elapsedMs`（以及 runner 追加的 `closeout` 键，如果从归档文件读入）后，`JSON.stringify` 的结果完全相同。JSON 对 double 的往返是精确的，所以这等价于全部数值逐位相等，包括 `history`、`iterations`、`evaluations` 和终态 `cell`。

### 4.3 三层验证

| 层 | 命令（新增） | 内容 | 耗时目标 | 是否进 `npm run validate` |
|---|---|---|---|---|
| 快速：求值级金标准 | `validate:fabric-form-golden-eval` | 对 7 组的初始 cell 和终态 cell，调用 `evaluateFabricCell`、`evaluateLengthConstraints`、`safePeriodicStep`（用固定的确定性方向，例如终态梯度取负）、`diagnosePeriodicContact`、`fabricFormMetrics`，对所有数值输出（Float64Array 按字节）计算 SHA-256，与 `scripts/fixtures/fabric-form-golden/eval-baseline.json` 比较 | < 60 s | 是 |
| 快速：拓扑等价 | `validate:fabric-form-topology-equivalence` | 对 m ∈ {1,2,3,4}、n ∈ {1,2,4,8}、N ∈ {16,24,32,48,64}，新旧 `createPlainJerseyTopology` 深度相等。旧实现先冻结为 `scripts/lib/legacyPlainJerseyTopology.mjs`（从 HEAD 原样复制，仅供对照）。另加 SOP-001 图不变量（见 4.4） | < 10 s | 是 |
| 慢速：求解级金标准 | `golden:fabric-form-solve`（不以 `validate:` 开头，避免进入 validate） | 7 组完整求解，按 4.2 的口径比较 | 约 10 分钟 | 否；每个阶段提交前手动跑 |

### 4.4 SOP-001 图不变量（只验证拓扑，不做几何）

用 ALGORITHM_DESIGN §2 和 §3.1 的组织（4 针 × 8 路，排针 1234，每针连续 2 路集圈，逐针斜向推进）构造动作矩阵。数据从 `scripts/fixtures/SOP-001-N6W6040-main-yarn-with-cam.knitscape` 读取：这是一个 zip 包，里面的 `project.json` 含有 `singleJerseyCamProgram.tracks`（4 条针道 × 8 路）和 `needleArrangement`（`[1,2,3,4]`）。用仓库已有的 `@zip.js/zip.js` 或现有项目包读取代码解包，再经 `resolveSingleJerseyOperations(camProgram, needleArrangement, 4, 8)` 得到矩阵。读不出来就停下报告，不要手写矩阵。然后检查：

1. 一个循环内 24 个 K、8 个 T，每路 3K + 1T，每针 6K + 2T。
2. 每根针在两次连续集圈之后的那次 K，新线圈恰好穿过 3 项（旧线圈 + 2 个集圈弧），并且全部指向正确的周期像。架构师按 fixture 核对过：针道 A 在第 7、8 路集圈，紧接着的 K 落在**下一循环的第 1 路**；针道 D 在第 1、2 路集圈，它持有的旧线圈来自**上一循环的第 8 路**。这两处都跨越周期边界，正好用来检验 `(p, q)` 偏移是否正确。
3. 其余 K 恰好穿过 1 项。
4. 所有引用都能解析到图中存在的项，没有悬空引用。

如果实际动作矩阵和以上描述不符，**不要改规则去迁就**，记录差异并在报告中提出。

## 5. 执行步骤（每步单独提交）

**R1-0 建立基线（不改 src）**

1. 核对 HEAD、`git status`。工作区不干净就停下报告，但豁免任务书文件 `docs/R1_REFACTOR_TASK.md` 本身（包括尚未跟踪或按用户指示更新的情况）；其他文件的已有未提交改动仍须停下报告。此豁免由用户于 2026-11-25 明确补充，仓库内本文件为执行依据。
2. 先做两件文档准备，和本步其余内容放在同一个提交里：
   - 把本文件原样放到 `docs/R1_REFACTOR_TASK.md`。
   - 在 `AGENTS.md` 末尾追加附录 A 的“§8 协作流程”整节，原文照抄。
3. 在 HEAD 上把 7 组完整求解各跑 **两次**，确认同一台机器上结果可复现（两次逐位相同）。不可复现就停下报告。
4. 与归档结果按 4.2 口径比较，把一致或不一致的情况写进报告（仅作信息记录，不阻塞）。
5. 以 HEAD 的运行结果作为金标准：生成 `scripts/fixtures/fabric-form-golden/` 下的求值级基线（`eval-baseline.json`）和求解级摘要（`solve-baseline.json`，内容为每组的规范化 JSON SHA-256、status、iterations、W、H、S、横密、纵密）。完整结果 JSON 放到项目外的归档目录。
6. 加入 4.3 的三条命令和 `legacyPlainJerseyTopology.mjs`。
7. 验收：`npm run validate` 全部通过（预期 47 + 2 = 49 项），`npm run build` 通过，`golden:fabric-form-solve` 通过。

**R1-1 DofLayout**：按 3.1 实现。验收三层全过、build 通过。

**R1-2 EnergyTerm / Constraint / Model**：按 3.2 实现。验收同上，另加一条：用一个“零能量假项”组成的三项 model 求值，能量和梯度与两项 model 逐位相同（证明组合机制不引入误差）。

**R1-3 KnitGraph + 离散化 + StitchTemplate**：按 3.3 实现，补上 4.4 的 SOP-001 不变量检查。验收同上。

**R1-4 文档**：
- 在 `docs/ARCHITECTURE.md` 中新增 “Layer 3：fabricForm” 一节，写明第 3 节的结构图、各模块职责、扩展点（新能量项、新约束、新自由度块、新针法模板分别怎么加），以及“组织拓扑只在 compileKnitGraph 中解释”这条边界。同时把文件开头过时的核对日期和 HEAD 更新为本轮实际值。
- 在 `docs/NEXT_TASK.md` 中追加 R1 完成记录。
- 不改其他文档。

每一步的提交信息按第 8 节模板书写，提交后推送。不要把多步合成一个提交。

## 6. 完成定义

- [ ] R1-0 到 R1-4 共 5 个提交，每个提交单独满足：`npm run validate` 全过、`npm run build` 退出 0、`golden:fabric-form-solve` 7/7 逐位一致
- [ ] `solveFabricCell`、`evaluateFabricCell`、`packFabricCell`、`unpackFabricCell`、`createPlainJerseyTopology`、`replicatePeriodicCell`、`defaultMemorySize` 等现有导出全部保留，签名兼容
- [ ] `solveFabricCell.js` 和新增的 `model/`、`topology/` 模块中不再有 `lattice+1` 这类手算偏移；物理内核中保留的偏移假设已由 layout 断言保护，并记录在 ARCHITECTURE.md
- [ ] 能量组合不再写死；新增一个能量项只需新建 EnergyTerm 并在 model 中登记，不改求解器
- [ ] 挂针累积规则只存在于 `compileKnitGraph` 一处
- [ ] 求值级金标准的耗时，与 R1-0 时相比增加不超过 5%（报告实测值）
- [ ] 未修改第 2.2 节禁止的任何内容（报告中附 `git diff --stat 62e9d1c..HEAD`）

## 7. 停止条件（遇到就停，按第 8 节回报并推送，不要自行变通）

1. 任一金标准不一致（求值级或求解级）。
2. R1-0 发现同机两次求解结果不同。
3. 为了逐位一致，不得不修改第 2.2 节禁止的内容。
4. SOP-001 动作矩阵与 4.4 的描述不符，或者三角座和排针无法从 fixture 读出。
5. 发现现有代码有疑似缺陷。只记录，**不修**，留给架构师判断是否另立任务。

## 8. 回报格式（写进提交信息，并推送 GitHub）

架构师不读你的本地日志，只从 GitHub 读取代码和提交信息。所以每一步的回报**写在该步提交信息的正文里**，提交后立即 `git push origin main`。不要强推，不要改写已推送的历史。

触发停止条件、但还没有可提交的代码时，提交一个只改 `docs/R1_REFACTOR_TASK.md` 末尾“执行记录”一节的文档提交，写明停在哪一步、什么原因，然后推送。

提交信息模板：

```text
refactor(fabric-form): R1-x <一句话内容>

状态：完成 / 停止（停止条件 #n）
基线：<上一步提交号>
validate：49/49，build：退出 0
金标准（求解级）：
  case-2.6-N48   CONVERGED  iter=…  逐位一致  …s
  case-3-N48     …
  case-3.5-N48   …
  case-4-N48     …
  hossain-2.77   …
  hossain-2.84   …
  hossain-2.9    …
求值级金标准耗时：R1-0 …s → 本步 …s（+…%）
公开接口变化：<新增或改动的函数及签名；没有就写“无”>
偏离任务书：<没有就写“无”>
发现未处理的问题：<没有就写“无”>
本地归档：C:\Users\liuchen\Documents\KnitScape\archives\r1-refactor-2026-11-25\R1-x\
```

R1-0 另外要写：同机两次运行是否逐位相同，以及 HEAD 结果与 `docs/archive` 归档结果的比较情况。

## 9. 执行记录（Codex 填写）

只在触发停止条件且没有代码可提交时使用；正常完成的步骤以提交信息为准。

### 2026-11-25：R1-0 开工检查停止

- 状态：停止于 §5 R1-0 第 1 项“工作区不干净就停下报告”；不是 §7 的金标准失败，尚未进行数值验证。
- 实际分支：`main`；接手 HEAD：`6f96eb873f88de201c3252d01c9b8a493397682d`。
- 接手时 `git status --porcelain=v1 --untracked-files=all` 唯一输出为 `?? docs/R1_REFACTOR_TASK.md`。已跟踪文件的暂存区与工作区均无修改，但任务书本身尚未纳入 Git，因此未满足工作区干净的前置条件。
- 任务书 R1-0 第 2 项要求把本文件纳入提交，但第 1 项没有声明任务书未跟踪可豁免；本轮没有自行放宽检查，按 §8 仅记录并提交推送停止回报，等待用户或架构师指示。
- 远端核对：`git ls-remote origin refs/heads/main` 返回 `62e9d1c6e0de58176e4f5e2152fa0526d99256b4`。本地已有文档提交 `6f96eb8` 位于其后；正常推送停止回报时会一并同步此已有提交，不改写历史。
- validate、build、7 组各两次求解、归档结果比较、求值级与求解级金标准：均未执行，不能报告通过或逐位一致。
- 本轮未修改 `src/`、`scripts/`、`package.json`、`AGENTS.md`；R1-0 文档准备及基线建立尚未完成，R1-1 至 R1-4 尚未开始。
- 本地归档：`C:\Users\liuchen\Documents\KnitScape\archives\r1-refactor-2026-11-25\R1-0\`，包含收到的任务书原文及开工检查记录。

## 附录 A：追加到 AGENTS.md 的内容（R1-0 时原文照抄）

```markdown
## 8. 协作流程（2026-11-25 用户要求）

- 分工：架构师（Claude）负责架构设计、编写任务书、审查提交；执行工程师（Codex）按任务书实现、验证、提交；用户决定方向和优先级。
- 每个开发任务都有一份任务书，放在 `docs/` 下（例如 `docs/R1_REFACTOR_TASK.md`）。任务书写明范围、禁止事项、验收、停止条件和回报格式，执行时以任务书为准。没有任务书的功能开发不开工。
- 任务书里的每一步单独提交，回报写在提交信息正文里，提交后立即推送 `origin main`。架构师只从 GitHub 读取代码和提交信息。
- 遇到任务书列出的停止条件，停下并用文档提交回报，等待架构师或用户的指示，不自行变通。
- 完整日志和大体积证据仍按 §6 放在 `C:\Users\liuchen\Documents\KnitScape\archives\`，提交信息中写明路径。
```
