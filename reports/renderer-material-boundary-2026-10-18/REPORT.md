# Renderer / Material Boundary

2026-10-18（Asia/Shanghai）。阶段：P0-C0 Correctness Preparation。开工分支 `main`，HEAD `7ababf264d495f6b96d4d66652c529424938ac4d`。开工已有大量未提交实现，见 [initial-status.txt](initial-status.txt) 和 [initial-file-hashes.json](initial-file-hashes.json)；不是干净 baseline。本轮未 commit/tag。

**Contract Decision = NEEDS_CLARIFICATION；RENDERER_MATERIAL_BOUNDARY = BLOCKED。** 审计、确定性测试和数值回归已完成；阻塞项是兼容模式/显示优先级的产品合同，不是测试执行或真实第二纱算法。本轮没有修生产行为。

## 1. Current Flow

| File / Function | Input | Output | Decision | Consumer |
|---|---|---|---|---|
| `actions/singleJerseyCamProgram.js:43` normalizeFeedYarn / normalizeFeed | feeds[f].yarns[y] | yarnId、target、tension、placement；保留槽位顺序 | 空 Feed 规范化为默认槽；显式用纱独立于材料 | State / runSimulation |
| `domain/yarnLibrary.js:15` normalizeYarnLibrary | Asset 列表 / Feed 引用 | 唯一 id、可选 color/diameter/PBR | 不从名称猜材料；缺引用可生成 metadata-only Asset | resolver / UI / 保存 |
| `components/runSimulation.js:203` runSimulation | 项目 chart、sequence、palette、plies、Cam、排针 | 两次 simulate 调用 | 排针前无 Feed/Library；排针后传 Feed/Library；两者传同一 sequence | yarnSimulation |
| `simulation/yarnTextureBrush.js:125` resolveFeedYarnPlies | Feed slot 的 yarnId、Library、primary | Map(feedIndex → 按 slot 排列的 ply[]) | String(id) 查 Asset；每槽调用 resolver；任一 ASSET source 设置 assetMaterial | simulation / draw |
| `domain/yarnMaterial.js:10` resolveYarnMaterial | Asset + legacy primary | color、diameter、pbr、texture、source、diameter provenance | 有效 Asset 字段优先；partial maps 中性补位，无 maps 则 legacy | resolveFeedYarnPlies |
| `simulation/yarnSimulation.js:32,103,152` normalizeYarnPlies / simulate | chart、Feed materials、legacy plies、sequence | strandCount、diameterProfiles、geometry、yarnStrands | active plies 是过滤 enabled 后的项目显示配置；strandCount 取最大 Feed slot 数，最少1；非全零 sequence 激活 mask | drawYarnSimulation |
| `simulation/drawYarnSimulation.js:43` rowYarnPly | course、active ply、slot index、Feed plies | row material 或 null | course→Feed；assetMaterial 或多槽抑制额外 legacy；assetMaterial 跳过 mask | Canvas / UV draw command |
| `simulation/drawYarnSimulation.js:67,152,180` forEachStrand / draw | yarnStrands / row materials | 实际 draw calls | primary 循环所有 strand；其他 active ply 仅复用 strand0；无额外 Machine 解释 | Canvas brush / WebGL |
| `simulation/yarnTextureBrush.js:195,218` drawYarnSequenceMaskPath / drawYarnTexturePath | row material、路径、宽度 | 基底描画与分批 mask | mask 使用 multiply、alpha=.38；宽度=stitchWidth×diameter | 2D context |
| `simulation/yarnUvWebglRenderer.js:311` drawStrip | strip / material | draw 与 shader uniforms | sequenceMaskColor 优先作为 tint；贴图缺失有 fallback | WebGL |

文件路径均相对于仓库。实际调用顺序为 assignment → lookup → resolver → material adapter → simulate 几何/strand → row material → draw。Machine 操作仍由 `resolveSingleJerseyOperations()` 和既有 adapter 产生；renderer 未重解释 Cam、Needle、K/T/M。

字段追踪：`yarnId` 在 adapter 用于 lookup 后不保留到 ply；slot index 通过数组位置/yarnIndex 保持；color、diameter、PBR maps、physicalRepeat 经 resolver 进入 ply；diameter 进入几何 profile 与 ribbon 宽，repeat 只供 UV 尺度；source 派生 assetMaterial；legacy primary 是字段 fallback；legacy companion 来自 active plies[1..]；sequence mask 由 palette slot 对应颜色派生。不得将 ply 对象引用相等视为 yarn identity 相同。

## 2. assetMaterial Definition

**FACT：定义是 B（Asset 有任意显式有效材料字段），被 renderer 额外用于 E（退出部分 legacy 显示行为的条件）。不是 A/C；D 不是一个已定义的独立 authority mode。**

`resolveFeedYarnPlies()` 的真实条件是 `Object.values(material.source).includes("ASSET")`。true 时返回 `{ ...primaryPly, ...material, assetMaterial: true }`；否则原样返回 primaryPly，同一对象可能在多个槽位重复。无字段 fallback 分支也丢弃了 resolver.source 视图；矩阵的 materialSource 来自同一 resolver 的独立调用，不伪称 runtime 已携带来源。

| Field | 足以触发的条件 | 不证明什么 |
|---|---|---|
| color | 非空、非全空白 string | 颜色有效性不证明完整材料 |
| diameter | finite number > 0，即使等于现有 fallback | 来源变化不一定是数值变化 |
| 任一 PBR map | 有 assetRef / processedDataUrl / dataUrl，且规范化后成为有效 map | 不要求图已加载、完整PBR或真实物性 |
| physicalRepeatLengthMm | Asset.pbr 内 finite number > 0；不要求 map | 不等于实测 diameter 或第二纱身份 |

**MATERIAL-PRESENCE SWITCH = OBSERVED。** 当前 HEAD 的旧源码没有 assetMaterial 或 companion 抑制/mask skip；这些来自开工已有未提交 material 实现。`git show HEAD:...` 与本轮前 diff 用于定位来源，未回滚既有代码。

## 3. Feed Assignment Authority

**YARN IDENTITY AUTHORITY = `singleJerseyCamProgram.feeds[f].yarns[y]` + `yarnId → yarnLibrary.id`。** 槽位数量不以 Asset 材料完整性判断。显式 identity cardinality 在本轮48例中保持；单槽=1、双槽=2。多个槽位可引用同一 Asset，现有 multi-yarn validator 另覆盖重复引用。

这里的 resolvedYarnCount 指该 Feed 的 runtime material entries 数量；geometryStrandCount 指 simulate 生成的 strand slots，不是不同中心线的去重数量，也不是场景三张 back/mid/front canvas 的数量。单 Feed 的测试避免把全局最大槽数误当成每个 Feed 的数量。

## 4. Legacy Companion

**FACT：RENDERER COMPATIBILITY SYNTHESIS。** 项目确实保存 yarnPlies/enabled 等显示配置，但 renderer 并未将它们转换为 explicit Feed assignment。normalizeYarnPlies 过滤禁用项，以第一 active ply 为 primary，其余启用项才是额外 legacy 绘制；没有另一个独立“真实第二纱”开关。

`rowYarnPly` 在当前 Feed `some(assetMaterial) || length > 1` 时返回 null 抑制额外层；否则 `forEachStrand` 给非 primary ply 固定 yarnIndex=0，再取 `yarnStrands[0]` 的已有路径。它没有独立身份、第二槽目标、独立中心线或工艺 placement。

单槽材料变化减少的是 **对同一 strand0 的一次兼容描画/strip submission**，不是删除一根已生成的 explicit yarn geometry。material appearance 会改变画面结构提示，但不应把这个证据称为 topology mutation。是否肉眼辨认出两根纱，本轮没有用 GPU 像素作证明。

## 5. Sequence Mask

**Project Contract 已明确：yarnSequence stores palette slot index。** 见 `actions/yarnSequenceRows.js` 的校验/按行循环、import/export 和 [reference integrity 报告](../yarn-sequence-reference-integrity-2026-10-18/REPORT.md)。它不是 YarnAsset ID，也不分配 Feed yarn。

**Renderer mask 是该正式数据的一种兼容显示消费。** simulate 的任一非零 sequence 像素启用 hasYarnSequenceMask；rowYarnPly 按 course 读 palette slot，颜色有效且 ply.assetMaterial 不为 true 才添加 sequenceMaskColor。全零序列走 neutral，不生成 mask。Canvas 为半透明 multiply overlay；WebGL 使用该颜色作 tint，二者并非已证明像素等价。

metadata-only → diameter-only 或 repeat-only 也会跳过 mask，虽然基础 color 仍来自 legacy。双槽可出现第一槽有 mask、第二槽无 mask，反之亦然；不存在一个统一的整 Feed mask 开关。

**SEQUENCE_MASK_CONTRACT = NEEDS_CLARIFICATION。** sequence 的存储/引用 authority 足够明确，但不自动证明它必须覆盖 Asset 材质。历史计划“Do not suppress explicit slots via ... palette mask”倾向保护 Asset 显示，而旧 legacy validator 要求 overlay；未找到 partial Asset 在两者之间的正式优先级。因此不能仅凭 Project 字段合法性选择强制 mask，也不把当前 skip 宣布为明确迁移合同。没有改 palette-slot Project Contract。

## 6. Material Metadata Matrix

测试固定同一 Feed、yarnId=`0`、slot0、4×4 K 操作、排针[1]、Gauge32、sequence 全1、相同 palette、启用 primary 与 companion。C/F 的显式直径特意等于 fallback .24，隔离“字段出现”与“有效数值改变”。所有 case 均执行真实 resolver/simulate/draw，Canvas 为实际 solid 分支，UV 用相同 draw inputs 强制调用已有分支并用 stub GL 接收；不加载图或比较像素。

| Case | Assignment | Resolved | Geometry strands | Legacy companion visible* | Sequence mask | Material source（Asset字段） | 每段绘制passes | 总draw calls Canvas/UV | Canvas mask batches |
|---|---:|---:|---:|---|---|---|---:|---:|---:|
| A metadata-only | 1 | 1 | 1 | yes | primary+companion | 无；color/diameter为legacy，其余default | 2 | 190/190 | 6 |
| B color-only | 1 | 1 | 1 | no | skipped | color | 1 | 95/95 | 0 |
| C diameter-only=.24 | 1 | 1 | 1 | no | skipped | diameter | 1 | 95/95 | 0 |
| D normal-map-only | 1 | 1 | 1 | no | skipped | normal | 1 | 95/95 | 0 |
| E repeat-only=12mm | 1 | 1 | 1 | no | skipped | physicalRepeatLengthMm | 1 | 95/95 | 0 |
| F full material | 1 | 1 | 1 | no | skipped | color/diameter/6 maps/repeat | 1 | 95/95 | 0 |

*visible 指存在实际 draw submission，不承诺最终像素可分辨性。三张遮挡 canvas 仍固定，不能把本表 passes 称为 canvas layer count。所有 case 的 topology hash、同有效直径的 geometry hash 和 preview metric 相等；输入前后序列化值相等。mask 决策逐 link/slot 比较 Canvas 与 UV，Canvas 另捕获真实 multiply stroke。无合同部分只记录行为，不断言“应该”保留或删除 companion。

[material-matrix.json](material-matrix.json) 包含48例的字段来源、数量、mask、哈希和指标；[targeted.log](targeted.log) 为本轮输出。

合成值来源：.24 primary/Asset 与 .14 companion 单位 MODEL_NEEDLE_PITCH，12 repeat 单位 mm；Source=本测试固定常数，Principle=控制变量隔离材料presence，Confidence=确定性软件fixture，Applicable state=4×4未标定模型。它们均不是实测输入。C 数值改变的正常 geometry 行为由已有 material authority validator 覆盖，本轮不修改该合同。

## 7. Explicit Two-Yarn Case

六种材料状态的笛卡尔积36例：assignment=2、resolved=2、geometry strand slots=2、每 link 两个显式槽位都 draw、legacy companion 一律不 draw。断言逐 link 的 yarnIndex 必须为 `[0,1]`，不是靠不同颜色猜两根纱。

| Slot0 / Slot1 | 每段passes | companion | mask slot0 / slot1 |
|---|---:|---|---|
| metadata / metadata | 2 | no | true / true |
| metadata / full | 2 | no | true / false |
| full / metadata | 2 | no | false / true |
| full / full | 2 | no | false / false |

其余组合也全部保留两个 explicit slots。另覆盖 companion disabled 的 metadata/full 双槽，仍2次绘制。未发现 BRANCH A 所述“材料字段屏蔽明确 assignment”的软件bug。

## 8. Legacy-only Case

feeds=null：无 explicit assignment/material entries，simulate 保留1个 base geometry strand；两个 enabled legacy plies 每段 draw 两次。active sequence 有两层 mask（6批），neutral sequence 无 mask，draw 数均190。单 explicit metadata-only + companion disabled 每段只 draw1次且有mask（3批）。单 explicit metadata/full + neutral sequence 分别2/1次draw，但都无mask。

这里的 legacy-only 输入未经过 Cam 默认槽规范化；它代表当前排针前/无 Feed 的直接 simulation 入口，不能冒称“有一个真实Feed assignment”。

## 9. Contract Decision

**NEEDS_CLARIFICATION — 用户分类 C（兼容迁移意图与材料presence条件混合，当前合同不清楚）。**

| Evidence | 能证明 | 不能证明 |
|---|---|---|
| [P1-1历史计划](../../docs/superpowers/plans/2026-10-15-p1-1-material-authority.md) | preserve no-field legacy；suppress legacy second strand on explicitly assigned feeds；保护 explicit slots | 单槽metadata本身也显式assigned，为什么仅加某个字段才退出；条目仍为历史未勾选计划，不是当前批准合同 |
| `validate-yarn-material-authority.mjs:158` | 双显式材料槽不受legacy toggle影响；无字段仍fallback | 单槽四种partial字段与legacy层的产品边界 |
| `validate-two-ply-yarn.mjs:740` 附近 | legacy sequence保留基色并加overlay | Asset与sequence谁有最终显示优先级 |
| [LEGACY_MAP](../../docs/LEGACY_MAP.md) / 既有源码审计 | 如实记录当前抑制/跳过条件，要求先确认交互 | 记录当前实现不等于批准migration contract |
| 本轮48例 | presence改变绘制/mask；explicit cardinality未变 | 真实第二纱路径、正确的未来迁移策略 |

BRANCH A：未触发；BRANCH B：不足以标记 `LEGACY_MODE_SWITCH = EXPLICIT CONTRACT`；BRANCH C：只加测试/报告；BRANCH D：Project存储语义明确，显示优先级仍不足，NEEDS_CONTRACT。未确认可据合同修复的软件bug，不自选保留/删除companion，不修改sequence mask。

后续产品决定需要明确两点：单显式槽何种**结构状态**允许legacy companion，以及 explicit/partial Asset 与 project sequence 的**显示优先级**。这两点不能由20D LOW工艺猜测代答。

**LEGACY_COMPANION_CONTRACT = NEEDS_CLARIFICATION**

**SEQUENCE_MASK_CONTRACT = NEEDS_CLARIFICATION**

## 10. Changes

- 新增 `scripts/validate-renderer-material-boundary.mjs`：48例、实际绘制调用捕获、explicit槽位保留、输入不变、同有效直径几何不变；未知迁移策略仅characterization。
- `package.json`：只增加 `validate:renderer-material-boundary`，纳入既有全量runner。
- `docs/DOMAIN_AUTHORITY.md`：补 identity/material/placement兼容/sequence边界与待定合同。
- 本目录：报告、矩阵、日志、初始hash与保全证据、既有SOP harness本轮输出；不覆盖历史报告。

new src module=NO；new dependency=NO；Project format changed=NO；Machine Domain changed=NO；Material resolver changed=NO；Renderer changed=NO；Geometry/Solver/M1/M2/M3/YarnPath changed=NO。本轮没有生产实现补丁；测试transform只在独立Node进程的Vite加载期增加观测，不写src。

## 11. Regression

本轮按 `verification-before-completion` 重新执行，不引用历史PASS充当本轮验证。

| Check | Result | Evidence |
|---|---|---|
| targeted renderer/material validator | PASS，48例 | [targeted.log](targeted.log) |
| 修改前 npm run validate | 38/39；exit1，仅已知row-length-loop-model | [baseline-validate.log](baseline-validate.log) |
| 修改后 npm run validate | 39/40；exit1，仅同一已知失败；新增validator通过 | [final-validate.log](final-validate.log) |
| material authority / sequence / gauge / Solver / Yarn Length | PASS，本轮全量runner实际执行 | [final-validate.log](final-validate.log) |
| multi-yarn / Feed-PBR / two-ply renderer | PASS，本轮全量runner实际执行 | [final-validate.log](final-validate.log) |
| npm run build | PASS，exit0 | [build.log](build.log) |
| git diff --check | PASS，exit0；仅既有LF/CRLF提示 | [diff-check.log](diff-check.log) |

**Known baseline failures：validate:row-length-loop-model；New failures：0；Numeric drift：NO。** 已知失败是当前功能文档旧标题正则断言，不修改 Markdown heading，也不改断言掩盖失败。38/39→39/40是新增1个通过的validator，不是旧失败已解决。

[preservation-and-verification.json](preservation-and-verification.json) 对开工1246个文件逐个SHA-256核对：只有 package.json 与 DOMAIN_AUTHORITY.md 两个既有文件变化；去掉本轮新增命令/附录后分别与开工hash精确相同。报告目录外只新增一个validator；所有src、既有脚本、SOP包、历史报告、lockfile均保持开工字节。HEAD/branch不变。ignored构建产物不纳入源码保全范围。

## 12. SOP Numeric Protection

已执行既有命令 `node reports/sop-001-business-comparison-2026-10-18/comparison.mjs --output-dir=reports/renderer-material-boundary-2026-10-18`，exit0，**SOP001_COMPARISON_HARNESS=PASS，numericStatus=MATCH**。本轮SOP输出：[results.json](results.json)、[SOP-COMPARISON.md](SOP-COMPARISON.md)、[sop-comparison.log](sop-comparison.log)。未传 --verify，harness内 verification 标为 NOT_RUN；本任务单独执行的验证在§11，不混淆两个范围。

与开工既有 `reports/material-diameter-contract-2026-10-18/results.json` 的 `softwareInputs`、`geometryInputs`、`runs`、`numericChecks` 作 deepStrictEqual，全部精确相等，见 [numeric-protection.json](numeric-protection.json)。包括四场景全部 Feed/Yarn 的M1/M2/M3与Solver状态；Gauge32、Cam、Arrangement1234不变。14条历史近似数值断言同样MATCH，未改expected/tolerance。

| 主纱场景 | Feed8 M1 | shared M2 | Feed8 M3 |
|---|---:|---:|---:|
| 保存30×40 | 22.999733873071612 | 24.792732967754105 | 24.077277996023067 |
| 对照32×40 | 22.999580039157998 | 24.805103332682666 | 23.701615834833103 |

单位cm/100针；Source=既有软件probe本轮复算，Principle=M1当前Solver窗口/M2共享预览/M3既有完整repeat诊断，Confidence=软件回归精确一致，Applicable state=历史fixture与既有模型参数；不证明实际生产测量等价。人工双纱诊断也未漂移；不能将其认作原SOP正式第二纱分配。原保存包仍只有主纱。

## 13. What Is NOT Proven

没有确认20D真实路径、同路径/plating/laid-in/special feeding、预牵伸或真实placement。没有引入YarnTopology，没有证明生产纱长、真实直径或full-repeat的工厂authority。没有GPU截图/pixel compare或真实浏览器视觉验收；调用矩阵不证明像素可见性，也不证明Canvas/WebGL像素等价。SOP harness生成的历史视觉描述不是本轮新增目视审图证据。

已证明材料presence会改变兼容draw/mask行为；未证明这是批准的迁移合同或可自行修复的错误。explicit槽位保留测试PASS不能替代两个待定合同。

**RENDERER_MATERIAL_BOUNDARY = BLOCKED**
