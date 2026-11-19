# Domain Authority Map

核对日期：2026-10-17。**FACT** 基于 `main / 7ababf2` 加开工前已有工作区实现；未提交实现不代表已验收发布。物理数据和证据等级统一遵守 [PROCESS_VALIDATION.md](PROCESS_VALIDATION.md) 的六项来源原则。

## 标记定义 — SUBJECTIVE / DESIGN DECISION

| 标记 | 本文含义 |
|---|---|
| AUTHORITY | 当前软件指定输入/规则的唯一权威；不自动成为实机 authority |
| DERIVED | 必须由明确输入计算，不回写为原始事实 |
| LEGACY | 仍有消费者的兼容源；不能仅因名称旧而删除 |
| UI ONLY | 交互意图/草稿，不是项目或工艺事实 |
| RENDERER ONLY | 显示派生数据，不反定义工艺 |
| UNKNOWN | 缺乏权威证据，尤其工艺方法/真实物性 |

这些标记与 FACT / INFERENCE 等证据等级是两个维度；AUTHORITY 不是“已实机验证”。

## 当前权威表 — FACT（除明确 UNKNOWN / 设计项）

| Concept | Authority | Derived From | Consumers | Legacy Sources | Current Status | Evidence |
|---|---|---|---|---|---|---|
| Pattern / Repeat | repeats / chart 设计数据 | chart 由 repeats 平铺 | 编辑、排针前模拟 | Pattern-only JSON | AUTHORITY；不被机器结果改写 | [生成](../src/components/generateChart.js)、[导入](../src/actions/importers.js) |
| Gauge | `machineGauge` | `25.4/G` → 模型针距 mm | 长度换算、目标、UV | 软件默认32 | AUTHORITY（输入）；针距 DERIVED；非成品密度 | [metrics](../src/simulation/yarnLengthMetrics.js) |
| Needle Arrangement | 已应用 `needleArrangement` | 四个 inputs 解析为 Type ID 循环 | Machine Domain | 空配置兼容 | AUTHORITY；输入草稿不等于已应用 | [解析](../src/simulation/needleArrangementOverlay.js)、[入口](../src/components/singleJerseyExecutionInput.js) |
| Cam Program | `singleJerseyCamProgram.tracks` | Type × Feed 的 K/T/M 输入 | Machine Domain | 规范化补软件草稿 | AUTHORITY；不改 Pattern | [Cam actions](../src/actions/singleJerseyCamProgram.js) |
| Machine Domain | `resolveSingleJerseyOperations()` | Cam + 排针 + 输出尺寸 | Adapter / Simulation | 无第二套权威 | AUTHORITY（规则）；输出 DERIVED | [Domain](../src/domain/singleJerseyMachine.js) |
| K/T/M | Domain 输出动作矩阵 | `tracks[type-1][feed%count]` | K/M/T→0/2/3 Adapter | Pattern 内仍可有 Purl | DERIVED；机器输出不含P | [Adapter](../src/adapters/singleJerseySimulationInput.js) |
| Feed | Cam 列与对应 `feeds[]` | course 按 `row%feedCount` 取角色 | assignment / 求解 / 绘制 | 默认4路草稿 | AUTHORITY（循环配置）；与96口的实机映射 UNKNOWN | [Cam](../src/actions/singleJerseyCamProgram.js)、[metrics](../src/simulation/yarnLengthMetrics.js) |
| YarnAsset | `yarnLibrary` 内 id/元数据/可选材质字段 | 名称不推物性 | Feed 引用、材质解析、包保存 | 无属性 Asset 可 fallback | AUTHORITY（项目资产）；非公司级共享库 | [资产](../src/domain/yarnLibrary.js)、[包](../src/actions/projectPackage.js) |
| FeedYarnAssignment | `feeds[f].yarns[y]` | yarnId 引用 Asset；附带 target/tension/placement | Solver、材质适配、UI | 默认id0 / unset0 | AUTHORITY（使用配置）；非单独 assignmentId 实体 | [Cam](../src/actions/singleJerseyCamProgram.js)、[引用动作](../src/actions/yarnLibrary.js) |
| Yarn Length Target | assignment.`yarnLengthCmPer100Needles` | 用户提交，经统一输入校验 | Solver、结果展示、保存 | 0表示unset，需明确Clear | AUTHORITY（目标数值）；真实测量语义 UNKNOWN | [输入](../src/domain/yarnLengthInput.js)、[契约](YARN_LENGTH_CONTRACT.md) |
| SolverResult | `solveFeedYarnLengths()` 及 simulation 的应用标记 | 当前窗口函数与目标 | PreviewValidity / feedback | 旧 lengthRatio 诊断不是求解结果 | DERIVED；不保存，不是生产实测 | [Solver](../src/simulation/yarnLengthSolver.js)、[应用](../src/simulation/yarnSimulation.js) |
| Preview Validity | `derivePreviewValidity()` | 必要目标、结果、容差、应用标记 | 当前结果UI | 生命周期可置 DESIGN_PREVIEW/INVALID | DERIVED；VALIDATED仅模型工作流 | [聚合](../src/simulation/previewValidity.js) |
| Preview Metric | base `yarnLengthMetrics.cmPer100Loops` | 有限设计路径采样 / width×height | 左侧基础统计 | 旧名称仍在 | DERIVED + LEGACY；非目标验收 | [geometry](../src/simulation/yarnPathGeometry.js)、[readout](../src/views/yarnLengthReadout.js) |
| Full Repeat Diagnostic | 指定最终几何与窗口的独立积分 | 明确 Feed/Yarn、针/行区间、outgoing link归属 | 诊断报告 | 旧截断窗值不可替代 | DERIVED；非工厂authority | [独立积分器](../reports/yarn-length-semantics-audit-2026-10-16/independent-auditor.mjs) |
| Tension | assignment.`tensionCN`；SOP记录另留来源 | 不参与几何推导 | 规范化、持久化 | null合法；原SOP包仍null | AUTHORITY（记录）；PROCESS RECORD；非 ACTIVE SIMULATION PARAMETER | [规范化](../src/actions/singleJerseyCamProgram.js)、[张力证据](../reports/real-sop-geometry-gap-audit-2026-10-16/tension-roundtrip.json) |
| Diameter | 有效 Asset.diameter → Legacy primary → 软件0.24 | 当前单位为 model needle pitch | 中心线路径、Solver、ribbon宽与缓存 | primary / companion | AUTHORITY（模型参数）+ LEGACY fallback；真实直径 UNKNOWN | [resolver](../src/domain/yarnMaterial.js)、[geometry](../src/simulation/yarnPathGeometry.js) |
| Renderer Material | `resolveYarnMaterial()`→`resolveFeedYarnPlies()` | Asset、Legacy、默认值逐字段选择 | Canvas / WebGL | scan / 旧PBR | DERIVED + RENDERER ONLY（颜色/贴图视图）；diameter仍影响geometry | [适配](../src/simulation/yarnTextureBrush.js)、[绘制](../src/simulation/drawYarnSimulation.js) |
| PBR | `YarnAsset.pbr` 的资源引用 | 原图/registry；缺图用中性材质或整组fallback | texture / shader | Legacy texture、可选Height | AUTHORITY（资产内容）；渲染消费非完整物理BRDF | [registry](../src/yarnTexture/yarnAssetRegistry.js)、[shader](../src/simulation/yarnUvWebglRenderer.js) |
| Physical Repeat | `asset.pbr.physicalRepeatLengthMm` | 像素宽/真实采集DPI×25.4（有前提） | 沿路径累计弧长U | 缺失时48模型单位纹理周期 | AUTHORITY（纹理尺度记录）；非diameter | [UV](../src/simulation/yarnPathUvStrip.js)、[来源](PROCESS_VALIDATION.md) |
| pending / selection / batch draft | editor局部状态、`pendingYarnId` 等 | 用户交互意图 | 待分配、批量预检 | 旧控件生命周期 | UI ONLY；不能当作已分配事实 | [editor](../src/views/singleJerseyCamProgramEditor.js) |
| Structure Revision | State `prepareAction()` | assignment结构变化或显式整体替换 | stale batch拒绝 | `loadWorkspace`兼容入口 | DERIVED runtime；不保存；参数变化不等于身份变化 | [State](../src/state.js)、[batch](../src/domain/yarnLengthBatch.js) |
| Business Validation | 尚无正式生产验收权威实现 | 等待工艺回答、契约及实物证据 | 未来工艺验收 | 不能复用VALIDATED冒充 | UNKNOWN / PENDING PROCESS CONFIRMATION | [验证边界](PROCESS_VALIDATION.md) |

## 材料数据不能混淆的三件事

**FACT**：当前 resolver 的 `source` 只回答“字段来自哪个软件对象”。它不记录测量仪器、负载状态或材料批次。因此 `source.diameter=ASSET` 也不能证明它是实测直径；需要另有可追溯证据。

**FACT**：`PBR/Yarn1` 有 Albedo、Normal、Roughness、AO、Metallic 五张 2172×724 PNG；原 SOP-001 with-cam 包内只有四张，Metallic 未进入该历史包。当前工作区已有 Metallic 通路，尚不能从“支持”推断历史包已升级。[PNG记录](../reports/sop-001/pbr-png-metadata.json)、[包manifest](../reports/sop-001/with-cam/project-export.manifest.json)

**UNKNOWN**：真实 yarn diameter。20D、图像高度、PBR透明前景宽度、肉眼均不能提供它。默认0.24模型单位按32G名义换算为0.1905mm，仅是模型尺度解释，不是实测。2400DPI来自用户扫描说明，PNG均无pHYs；22.987mm仅在原图未重采样且DPI为真实采集DPI时成立。

**SUBJECTIVE / DESIGN DECISION**：未来新增影响物理结果的数据，至少同时说明 Value、Unit、Source、Measurement/derivation principle、Confidence、Applicable state；未知项显式 UNKNOWN。现有软件默认值保留兼容身份，不补写成生产事实。

## Yarn Diameter Contract — 2026-10-18

**FACT**：Yarn Diameter 是 simulation geometry parameter。必须分开：真实测量直径（需要来源）、Asset explicit diameter（显式软件输入）、effective simulation diameter（实际消费值）、legacy/default compatibility fallback（兼容仿真值）。Asset explicit 不自动成为真实材料数据。

`resolveYarnMaterial()` 保留原数值选择与 `source`，额外暴露派生 `diameterSource`、`diameterUnit=MODEL_NEEDLE_PITCH`。优先级为有效 Asset number > 0（`ASSET_EXPLICIT`）→ 有效 legacy primary number > 0（`LEGACY_PRIMARY`）→ `0.24`（`DEFAULT_COMPATIBILITY`）。来源标记表示当前 resolver 的直接输入来源，不追认其测量历史。元数据只属于 runtime material view / diagnostic；不写入项目、用户输入或 Undo。

**FACT**：runtime primary 是 `normalizeYarnPlies()` 过滤禁用项后的第一项，通常为 `yarnPlies[0]`；若第一项禁用，可能是后面的启用项。此 normalizer 会将缺失/非法值先替换为 0.24，因此 resolver 看到的 `LEGACY_PRIMARY` 也可能已经由默认值补成。导入会按索引以 DEFAULT_YARN_PLIES 补值（primary 0.24、companion 0.14）。当前项目没有保存上游补值历史，不能把规范化后的 0.24 标记成实测。

**FACT**：DIAMETER UNIT = **KNOWN(MODEL_NEEDLE_PITCH)**。证据是 `yarnPathGeometry.js` 的 `needlePitch=1`、`node.modelX=(i/2)*needlePitch`、`point=node.model+(diameter/2)*normal`；绘制宽度为 `stitchWidth*diameter`。直径进入 Geometry 前没有乘 Gauge；路径长度之后由 `modelLengthToMm=L*25.4/Gauge` 换算。0.24 不是 0.24 mm，按32G作模型尺度解释才是 0.1905 mm，也不是实测。

Asset `diameter` optional；null/undefined 视为缺失，0/负数/NaN/Infinity/字符串会被 library validator 拒绝。只有有限正 number 合法，当前没有上限。直接调用 resolver 绕过 validator 时非法值走 fallback。Legacy ply normalizer 允许数字字符串；UI 0.06–0.5/步长0.01是控件范围，不能冒充 Asset validator 范围，UI 当前未标物理单位。

**FACT**：所有 Feed slot 缺显式直径时继承同一个 primary，包括第二纱；不会继承第一纱 Asset 的 explicit diameter，也不会自动对应 legacy companion。这是 **CURRENT COMPATIBILITY BEHAVIOR**；选 primary 的工艺理由为 **UNSOURCED COMPATIBILITY BEHAVIOR**。**SECOND_YARN_DIAMETER_FALLBACK = NEEDS_CONTRACT**，本轮不代选 primary/secondary 的未来合同。

**FACT / UNKNOWN**：0.24 是 **SIMULATION / LEGACY DEFAULT**，真实来源/测量方法/适用负载状态均 UNKNOWN。Denier ≠ diameter；PBR visible width ≠ diameter。SOP主纱和人工第二纱诊断同为0.24/LEGACY_PRIMARY，仅表示 **SAME EFFECTIVE VALUE ≠ SAME REAL DIAMETER**。第二纱在原保存包中仍缺失；真实直径 **UNKNOWN / NOT_ESTABLISHED**。

Geometry、Solver profile/reuse 和 ribbon cache 已包含有效直径，本轮不改公式或缓存键。完整字段来源表、历史定位、数值无漂移与验证边界见 [Material Diameter Contract](../reports/material-diameter-contract-2026-10-18/REPORT.md)。

## Renderer / Material Boundary — 2026-10-18

**FACT — Yarn Identity Authority**：显式用纱身份是 `singleJerseyCamProgram.feeds[f].yarns[y]` 的槽位顺序与 `yarnId → yarnLibrary.id` 引用。重复引用同一 Asset 仍可占两个槽位。材质适配器保持槽位数量，但 runtime ply 不携带 yarnId；消费者按 Feed/slot 索引对应，不能从颜色、ply 对象相等或绘制次数反推身份。

**FACT — Material Appearance Authority**：`resolveYarnMaterial()` 按字段输出 Asset → legacy primary → default 的解析结果；PBR 有 Asset map 时缺图走中性值，无 Asset map 时保留 legacy texture。`resolveFeedYarnPlies()` 用 `Object.values(material.source).includes("ASSET")` 派生 `assetMaterial:true`；任意有效 color、diameter、map 或正 physicalRepeat 即足够。它不是 Asset 存在、材料完整或实测有效的证明。

**FACT — Legacy Visual Compatibility**：启用的 `yarnPlies` 经 normalize 后，第一项作为 primary，其余项在 renderer 复用 strand 0 路径绘制。当前 Feed 任一 ply 有 assetMaterial，或 Feed 槽位数大于 1，就抑制这些额外绘制。这是 **MATERIAL-PRESENCE SWITCH** 与槽位条件的组合；legacy companion 是 renderer 的兼容绘制合成，不是 FeedYarnAssignment Authority，也不等于 Feed 第二槽或真实20D LOW。项目保存了 legacy 显示配置，不表示它保存了第二根真实纱的 placement 语义。

**FACT — Sequence**：`yarnSequence` 正式保存 palette slot index，既不保存 YarnAsset ID，也不决定 Feed slot 数。非全零 sequence 在 renderer 生成逐行颜色 mask；当前 `ply.assetMaterial` 会跳过该 mask。Canvas 用 multiply/alpha overlay，WebGL 消费 sequenceMaskColor 作为 tint。Project 数据 authority 与 renderer 的 mask 优先级必须分开，不能用其中之一推定另一个。

**FACT / CONTRACT GAP**：48 个确定性用例表明，单槽位 metadata-only → 任一有效材料字段会使每段绘制 2→1、mask 应用→跳过，而 assignment=1、geometry strand=1 不变；双显式槽位的36种材料组合始终绘制两个槽位。历史计划有“保留无字段兼容”和“抑制显式 assignment 上的 legacy 第二层”的意图，但没有解释单槽位仅加 color/diameter/map/repeat 时的退出边界。旧审计描述实现，不构成产品批准。当前未发现足够证据将此认定为明确迁移合同，亦未证明显式身份被删除。

**LEGACY_COMPANION_CONTRACT = NEEDS_CLARIFICATION**；**SEQUENCE_MASK_CONTRACT = NEEDS_CLARIFICATION**（待明确 Asset 与 project sequence 的显示优先级，palette-slot 存储合同不待定）。本轮保留行为，仅加 characterization 与已明确的槽位保留断言，不自选保留/删除 companion 或强制 mask。完整证据、矩阵与验证见 [Renderer / Material Boundary](../reports/renderer-material-boundary-2026-10-18/REPORT.md)。
