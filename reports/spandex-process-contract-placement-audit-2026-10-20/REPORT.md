# 裸氨纶工艺数据合同落位审计

日期：2026-10-20（Asia/Shanghai）。阶段：P0-C2，只读架构审计。

证据标签：**[事实]** 为当前源码、实际执行或用户提供的生产确认；**[推断]** 为有条件推论；**[未知]** 为缺少依据；**[设计决定]** 为本报告的推荐合同，尚未获实施、不代表已有功能。所有推荐字段、接口、模式和版本号均仅为候选设计。

## 1. 执行结论

1. **[事实]** 当前分支 `main`，HEAD `7ababf264d495f6b96d4d66652c529424938ac4d`。工作区有既有未提交实现；审计的是该 HEAD 上的当前工作区源码，不能称干净 HEAD。基线 validate 40/40、build、diff-check 通过。
2. **[事实]** `yarnLengthCmPer100Needles` 的可执行语义是“用户提交的当前模型求解目标”；其生产测量状态没有在字段中表达。不能全局改称放松实测长度，也不能称已经验证的织造长度。
3. **[设计决定]** 推荐方案 C：Assignment 显式选择长度输入语义；保留旧直接目标分支，新增互斥的“放松长度＋实际牵伸”分支。不靠纱名、第二槽、Asset category 或倍率是否存在自动切换。
4. **[推断→设计决定]** 同 Asset 可在不同 Feed 有不同长度和倍率，现有 Assignment 是合适的使用参数 owner。Asset 级单值无法表达已确认差异，除非再建覆盖系统；当前无此必要。
5. **[设计决定]** 在现有 `src/domain/yarnLengthInput.js` 增加纯解析/目标派生接口；Simulation、批量预检和反馈 UI 共用。`24=8×3` 不持久化，不让 Solver 识别氨纶。
6. **[事实]** 只改变 Solver 调用目标不够：`requiredTargets`、缓存键和结果面板仍读原字段。缺倍率若被当成普通 unset 跳过，还可能使其它成功目标导致整体 `VALIDATED`。实施必须统一这些消费者。
7. **[事实]** 旧归一化会静默删除新增字段；只加可选字段并继续写 version 2 不能保证新文件在旧应用中安全打开/再保存。当前包读取器具有版本拒绝点，旧原始 JSON 入口没有同等版本守卫。
8. **[设计决定]** 不需新 src 模块、材料类型体系或新 Store。现有模块可承载，但 Cam/Feed 当前不属于 Undo 快照；最小扩展保持该既有限制，不宣称参数自动支持 Undo。
9. **[设计决定] AUDIT GRADE = B：可以实施，但必须先确定一个项目格式或字段语义决策。** 推荐采用新模式文件的失败即拒绝版本策略，详见第14、22节。不是 Authority 不清或必须架构重建。本轮到报告停止。

## 2. 已确认生产事实

**[事实] 来源 P1**：本轮用户附件 `C:/Users/liuchen/.codex/attachments/773d9926-4ccf-40ed-8478-3105e4a0e281/已粘贴的文本.txt` 中的生产部门确认。没有另行现场测量。P0-C1 的结果是软件诊断证据，不是新的实物证据。

| 概念 | Value / Unit | 测量或推导原理、适用状态 | 来源与置信度 |
|---|---|---|---|
| 机器 | 润山单面，32 inch，32G，3216针 | 设备规格；不等于完整机台几何标定 | P1；生产确认 |
| 周期 | 8路最小完整工艺周期；96口=8×12 | 96个喂纱位置与三角座一一对应；仅本SOP | P1；生产确认 |
| 主纱 | N6/W(6040)，Feed1–8 | 每路均存在，允许各路参数不同 | P1；生产确认 |
| 主纱实测 | 23 cm/100机针 | 同布100针对应范围拆纱，松弛、不紧绷直接测量；放松态 | P1；实测事实的转录 |
| 氨纶 | 20D裸氨纶，Feed1–8，专用弹力送纱装置 | 同Feed共享K/T/M动作；未证明未来中心线重合 | P1；生产确认 |
| 氨纶实测 | 8 cm/100机针 | 与主纱来自同布，拆出放松测量；不是受力路径长度 | P1；实测事实的转录 |
| 实际牵伸 | 3.0，无量纲 | 织造态长度÷放松后长度；可随Feed/工艺/机器条件变化 | P1；当前工艺参数 |
| 织造态参考 | 24 cm/100机针 | 8×3.0；织造态参考，非直接测量 | P1；PROCESS-DERIVED VALUE |
| 常用/极限 | 2.8–3.2 / 3.6，无量纲 | 当前现场范围，不是所有氨纶的材料常数 | P1；不能升级成全局硬范围 |
| 张力 | 主纱5 cN、氨纶4 cN | 实测记录；`activeInGeometry=false` | P1；不推导长度、直径或弹性 |
| QC | ±2% | SOP-001正式抽样检验规则 | P1；不等于数值求解容差 |

**[事实]** 路别 `1.3` 是仅在Feed1、3存在；存在性由 Assignment 列表决定。新设备直接设定纱长，纱盘、齿轮、纱嘴深度只可作为旧设备记录。此次不建立97口逻辑。

**[事实]** [P0-C1结果](../spandex-length-semantics-2026-10-20/results.json)记录：主纱23全部收敛；氨纶直接8全部不可达；22.4、24、25.6、28.8分别八路收敛。24的Feed8 M1=24.00000471206136、M3=25.16408312477409。历史23/8逐路精确匹配。该轮结论为 `PARTIALLY_SUPPORTED`、实机验证 `PARTIAL`、氨纶物理模型未实现。本轮读取该证据，没有重写或冒称重新执行P0-C1诊断。

**[未知]** 真实纱径、放松静置时长、详细端部归属、仪器校准、弹性曲线及更多机台案例。有效直径0.24 / MODEL_NEEDLE_PITCH / LEGACY_PRIMARY仅为现有模型参数，不由20D推实测直径。

## 3. 当前源码事实

**[事实]** 下列定位均以本轮读取的工作区为准；行号用于审阅，链接指向现有文件。

| 证据 | 文件与定位 | 核实内容 |
|---|---|---|
| S1 | [Cam actions](../../src/actions/singleJerseyCamProgram.js)，10–16、43–72、103–115、206–253行 | Assignment默认值、严格四字段返回、归一化、单路与批量提交 |
| S2 | [长度输入Domain](../../src/domain/yarnLengthInput.js)，1–18行 | 有限正数编辑；Clear/storage可归一化为0，无材料语义 |
| S3 | [结构Domain](../../src/domain/feedYarnStructure.js)，1–12行；[state](../../src/state.js)，178–194行 | revision由Feed/槽位/yarnId及显式替换意图控制 |
| S4 | [Asset Domain](../../src/domain/yarnLibrary.js)，3–47行；[material](../../src/domain/yarnMaterial.js)，7–44行 | 身份/分类/外观及有效直径；无长度和牵伸参数 |
| S5 | [Simulation](../../src/simulation/yarnSimulation.js)，178–296行 | 原目标→solverLengths、requiredTargets、缓存、Solver调用 |
| S6 | [Solver](../../src/simulation/yarnLengthSolver.js)，108–240行 | 读数值目标，求h；没有材料或倍率分支 |
| S7 | [结果反馈](../../src/views/yarnLengthSolverFeedback.js)，8–18、36–65行 | 以槽位＋原目标值匹配结果，原值null则NOT_SET |
| S8 | [预览有效性](../../src/simulation/previewValidity.js)，12–25行 | 对requiredTargets检查目标/收敛/应用/误差 |
| S9 | [runner](../../src/components/runSimulation.js)，266–279、288–316行 | 传原feeds；Cam变化清结果并150ms重算 |
| S10 | [importer](../../src/actions/importers.js)，38–67、88–151行 | 预验证后原子提交；完整/部分导入区别及资产staging |
| S11 | [exporter](../../src/actions/exporters.js)，136–151行；[package](../../src/actions/projectPackage.js)，9–11、60–81、137–141行 | 整个Cam深拷贝；包version固定2且读取严格等于2 |
| S12 | [批量Domain](../../src/domain/yarnLengthBatch.js)，7–46行 | revision、槽位、yarnId、可编辑性与单值预检 |
| S13 | [编辑器](../../src/views/singleJerseyCamProgramEditor.js)，60–96、99–190、194–282行 | 单值输入/显式Clear、本地批量选择与长度批改 |
| S14 | [Asset actions](../../src/actions/yarnLibrary.js)，100–130行 | 赋纱保留槽位参数、新槽0/null、删除后重建 |
| S15 | [常量](../../src/constants.js)，15–20行；[state](../../src/state.js)，127–175行 | Undo只含palette/sequence/plies/repeats，不含Cam |
| S16 | [材质适配](../../src/simulation/yarnTextureBrush.js)，125–140行；[geometry](../../src/simulation/yarnPathGeometry.js)，373行起 | 按yarnId解析材质；h evaluator不解释牵伸 |

**[事实] 只读探针**：通过当前Vite SSR加载上述真实函数，在内存中给一条旧目标8附加候选 `lengthInputMode`、`relaxedLengthCmPer100Needles=8`、`draftRatio=3`。未实现候选行为。观察并断言：

| 操作 | 当前结果 |
|---|---|
| `normalizeSingleJerseyCamProgram` | 三个未知字段全被删除，旧目标仍8 |
| `createProjectPackage → readProjectPackage` | version=2；原始包读回仍带三个字段 |
| 再经过Cam归一化 | 三个字段删除，只剩当前四字段；目标8 |
| 给Asset加material/draftRatio | `normalizeYarnLibrary`删除它们；保留category=OP |
| 只改倍率/长度、同yarnId | 结构比较false |
| 改yarnId | 结构比较true |

**[事实]** 探针首次因Node缺少Path2D浏览器对象未启动，补上与既有validator相同的桩后通过。仅写系统临时日志；没有改生产文件或写项目包。源码单独已足以复核上述行为，报告不依赖临时文件长期存在。

**[事实] 仓库记录**：开工执行 `git branch --show-current` / `git rev-parse HEAD` / `git status --short` / `git log -1 --oneline`；末条提交为 `7ababf2 feat: establish trusted feed yarn length workflow`。开工对1302个tracked及非忽略untracked文件记录SHA-256，采用不转义中文的Git路径列表；最终保护结果见第22节。

<details>
<summary>开工 git status --short（事实；保留的既有改动）</summary>

```text
 M AGENTS.md
 M KnitScape_当前功能与算法.md
 M NEXT_TASK.md
 M README.md
 M package.json
 M scripts/validate-code-guide.mjs
 M scripts/validate-row-length-loop-model.mjs
 M scripts/validate-single-jersey-execution-integration.mjs
 M scripts/validate-texture-cache-lifecycle.mjs
 M scripts/validate-two-ply-yarn.mjs
 M scripts/validate-yarn-length-gauge.mjs
 M scripts/validate-yarn-sequence-editor.mjs
 M src/actions/exporters.js
 M src/actions/importers.js
 M src/actions/repeatDimensions.js
 M src/actions/yarnSequenceRows.js
 M src/codeGuide/codeGuideDefinitions.json
 M src/codeGuide/codeGuideMap.js
 M src/codeGuide/generatedLines.json
 M src/components/runSimulation.js
 M src/constants.js
 M src/domain/yarnLibrary.js
 M src/events/colorSequencePointerInteraction.js
 M src/events/colorSequenceTouchInteraction.js
 M src/i18n/translations.js
 M src/simulation/drawYarnSimulation.js
 M src/simulation/yarnLengthMetrics.js
 M src/simulation/yarnLengthSolver.js
 M src/simulation/yarnPathGeometry.js
 M src/simulation/yarnSimulation.js
 M src/simulation/yarnTextureBrush.js
 M src/simulation/yarnUvWebglRenderer.js
 M src/state.js
 M src/views/yarnLengthReadout.js
 M src/views/yarnPicker.js
 M src/yarnTexture/yarnScanTexture.js
 M vite.config.js
?? docs/
?? reports/
?? scripts/validate-gauge-authority.mjs
?? scripts/validate-project-load-lifecycle.mjs
?? scripts/validate-renderer-material-boundary.mjs
?? scripts/validate-yarn-material-authority.mjs
?? src/domain/machineGauge.js
?? src/domain/yarnMaterial.js
?? 面料放大.jpg
```

</details>

## 4. 当前长度字段真实语义

**[事实]** 对题设A–F的回答：**执行语义为A，生产语义为E；没有证据统一认定B/C/D。**

| 检查层 | 当前证据 | 语义判断 |
|---|---|---|
| UI | 中文“纱长 / cm / 100针”；错误和Clear文案称“目标”，没有负载状态 | 用户输入目标，标签不足以证明实测 |
| 持久化 | Assignment原数值存入Cam；没有valueType/loadState/source | 数值被保存不等于状态已定义 |
| 输入校验 | 正有限number/string；0只能存储归一化或显式Clear | 合法性是软件输入规则，不是工厂可达区间 |
| Solver | `targetModelLengthPer100Needles(value,gauge)`直接换单位 | 当前二维模型目标 |
| 验证器 | 输入、结果、批量、结构测试要求结果target等于输入值 | 保证目标一致，不证明生产测量等价 |
| 原SOP fixture | 原包主纱23；氨纶8由诊断clone添加 | 主纱输入源为实际放松测量，不改变旧字段通用含义 |
| 普通纱/第二纱 | 任一槽同样直接传值，未按纱种区分 | 第二槽不等于弹性模式 |
| 批量 | 对选中槽统一覆写同一旧字段 | 是目标批改，不是measurement contract |
| 文档 | P0-C1补充区分23/8实测与24派生；旧章节保留历史状态 | 生产合同已进文档，未进正式模型 |

**[设计决定]** 旧字段继续表示直接模型目标，不改名、不将旧23/8批量重新标记为已验证放松/织造长度。新UI可把此分支明确标为“直接模型目标（原兼容输入）”，而不是“普通纱织造实测”。

## 5. FeedYarnAssignment职责

**[事实]** 当前没有独立Assignment类或assignmentId；真实对象是 `singleJerseyCamProgram.feeds[f].yarns[y]`：

```js
{
  yarnId: 0,
  yarnLengthCmPer100Needles: 0,
  tensionCN: null,
  placement: "parallel"
}
```

| 环节 | 当前行为 [事实] | 对未来扩展的含义 [推断/设计决定] |
|---|---|---|
| 创建/default | buildCamProgram→normalizeFeed；缺/空yarns补一个默认槽 | 新模式默认不能推成氨纶或倍率3 |
| 归一化 | 私有normalizeFeedYarn只返回四字段；currentCamProgram及resize也调用 | 新字段须在该唯一保留点接入，否则普通编辑也会丢字段 |
| 校验 | yarnId非null/空串；旧长度缺undefined拒绝；null/空串/0可读为0；tension经Number后非负有限；placement仅默认 | 不把当前宽松tension/placement校验误写成物理合同 |
| 单值修改/Clear | SET只接受正有限，Clear写0；dispatch新的Cam | 新参数使用参数action，不能借完整替换action而误增revision |
| 批量 | 结构与值先全部预检，一次dispatch；同时清结果 | 应保留原子性及拒绝无副作用 |
| 赋纱/删除 | 新槽0/null；替换yarnId复制旧槽参数；至少保留一根；完整替换带意图 | 新测量证据不能因换Asset自动变成新纱的实测 |
| 保存/加载 | exporter深拷贝Cam；importer归一化；包读不是最终载入 | nested字段保留和导入解释必须一起处理 |
| 删除重建/重排 | 显式替换即使同ID也递增revision | 防止旧选中位置误命中新槽，保持现有规则 |
| 求解/缓存 | Simulation按每Feed/slot读长度；targets/profile进入复用key | 工艺参数派生后仍按同一槽位关联 |
| UI | 编辑器读旧长度；反馈读旧长度匹配结果 | 两处都必须消费同一语义解析结果 |
| Undo | Cam不在SNAPSHOT_FIELDS | 本次最小方案不新增Cam Undo；必须向后续实现者明示 |

**[推断]** Assignment承载“这根纱在这一路这次使用的参数”已有先例（长度/tension/placement）。生产确认每Feed可独立倍率，故将实际倍率置于Assignment是由现有职责和工艺共同支持的结论，不是预先接受P0-C1建议。

## 6. YarnAsset职责

**[事实]** Asset当前为 `id/name/category/createdAt/updatedAt`，可选 `color/diameter/pbr`；pbr含纹理与physicalRepeatLengthMm。id/name为身份，category仅用来创建、编辑、筛选和排序。现有枚举为 `T/CD/N/OP/OTHER`。源码没有将OP或纱名映射到牵伸、弹性或放松行为，不能从缩写自行补物理语义。没有独立material、物理弹性、推荐工艺范围或实际倍率字段；有效直径虽影响几何，也不等于真实纱径。

**[设计决定]** 不把实际倍率放入Asset。否则同Asset的Feed1倍率2.8、Feed2倍率3.2无法共存；再增加Assignment override只会产生两级默认/覆盖规则。可选推荐范围将来可作为有来源的建议，但当前案例不足以建立材料库规则。本次不新增NORMAL/SPANDEX枚举、不改YarnAsset。

| 识别候选 | Authority / 兼容与误判 | UI与字段成本 | 评价 |
|---|---|---|---|
| Asset材料类型 | 材料身份不能决定每次是否采用本测量/送纱合同；现有category无此保证 | 要扩材料类型及迁移，还得有每次使用参数 | **[设计决定] 不作为转换开关** |
| Assignment工艺输入模式 | 明确这次如何解释数据；缺模式走旧语义 | 一个局部选择，复用现有槽位 | **[设计决定] 推荐** |
| 倍率存在就转换 | 清空倍率会从放松8悄悄退回直接8；缺失状态不可表达 | 少一字段，但错误风险高 | **[设计决定] 拒绝** |
| 名称/第二槽/placement | 名称可改，任意槽可同Asset，placement目前不选物理路径 | 看似无字段，实际依赖猜测 | **[设计决定] 拒绝** |

## 7. 求解输入链

**[事实] 当前链路**：

```text
编辑器输入
 → validateYarnLengthInput
 → Cam action / normalizeFeedYarn
 → GLOBAL_STATE.singleJerseyCamProgram.feeds
 → runSimulation直接传feeds
 → yarnSimulation提取solverLengths
    ├ requiredTargets / solverInputKey / uniqueTargets
    └ solveFeedYarnLengths({ yarns: 原Assignment子集 })
       → targetModelLengthPer100Needles：cm→模型单位
       → h二分 / M1 / SolverResult
 → 最终路径应用 / derivePreviewValidity
 → runner发布 / Feedback以原Assignment目标匹配
```

**[事实]** Machine Domain只产生K/T/M；Simulation已拥有逐槽目标准备流程。Solver不读Asset、tension、placement、category或名称。

**[设计决定] 推荐链路**：

```text
项目事实（互斥输入分支）
 → yarnLengthInput内唯一纯解析器
    ├ 原直接分支：原值
    └ 放松牵伸分支：放松值 × 实际倍率
 → 临时solver目标视图（同Feed/slot）
 → 现有数值Solver → 现有M1/Geometry
```

**[设计决定]** 原Assignment保留给身份/材质消费者。仅在Solver调用的临时对象上放入派生数值，不写回项目旧字段。`requiredTargets`、复用key、错误反馈、结果目标匹配均从同一解析接口取值；UI绝不另写一次乘法。各入口可以重复调用纯函数，规则定义只能一处。

## 8. 数据方案比较

**[设计决定]** 以下评价不是当前功能事实。

| 方案 | 普通纱/旧项目 | Authority与Clear问题 | 持久化与代价 | 结论 |
|---|---|---|---|---|
| A：旧长度统一改为放松值＋可选倍率 | 无证据认定所有旧值是放松值；默认倍率1会把“无依据”伪装为状态等价 | 清倍率的含义含糊；旧8可再次被直传 | 改动看似少，但改变既有合同 | 拒绝全局重解释；加显式分支后已经是C |
| B：保留直接目标，同时加放松长度/倍率，靠纱种选择 | 可保留旧数字，但纱种来源不够 | 可能有direct=23、relaxed=8、draft=3三个矛盾输入；优先级隐藏 | 多Authority，需弃用/互斥规则 | 拒绝无显式互斥的B；加约束后采用C |
| C：显式长度输入模式＋互斥分支 | 无模式精确保留旧行为；新模式由用户选 | 每个槽只有一个有效输入合同；缺倍率不退回旧目标 | 多一个判别字段，需旧读取器拒绝策略 | **推荐** |
| Asset实际倍率＋Assignment覆盖 | 原系统没覆盖层；同Asset不同Feed需override | 两处同值及默认来源易混淆 | 扩模块和UI，仍不能消除长度状态问题 | 不推荐 |

**[设计决定] 评分**：1差、5好；同权重，规模项分高表示改动更小，测试项分高表示更易验证。这是审计判断，不是实测性能。C按第10节含来源元数据、第14节版本保护评分。

| 维度 | A | B（无互斥） | C |
|---|---:|---:|---:|
| 单一Authority | 3 | 1 | 5 |
| 旧项目兼容 | 1 | 3 | 5 |
| 代码改动规模 | 5 | 3 | 3 |
| 重复逻辑风险 | 3 | 2 | 5 |
| 用户理解成本 | 2 | 2 | 4 |
| 测试难度 | 2 | 2 | 4 |
| 未来YarnTopology兼容 | 3 | 3 | 5 |
| 数据可追溯性 | 2 | 3 | 4 |
| 合计 / 40 | 21 | 19 | 35 |

## 9. 推荐Authority设计

**[设计决定]** 下表是推荐所有权；“来源”区分工艺事实和用户输入，不自动把任意输入当实测。

| 业务概念 | 推荐Authority | 来源 | 单位 | 是否持久化 | 是否派生 | 消费者 |
|---|---|---|---|---|---|---|
| Yarn身份 | yarnLibrary Asset.id；Assignment.yarnId引用 | 用户资产定义 | ID | 是，已有 | 否 | 赋纱、材质、UI |
| 主纱/氨纶路别 | feeds[f].yarns列表 | SOP/用户逐路配置 | Feed/slot | 是，已有 | 否 | Machine结果对应、Simulation |
| 放松实测长度 | 对应Assignment的新放松长度输入＋证据 | P1的8或后续有来源测量 | cm/100机针 | 是，建议新增 | 否 | 长度解析器、编辑器 |
| 实际牵伸倍率 | 同Assignment | 本次Feed/工艺使用参数 | 无量纲 | 是，建议新增 | 否 | 长度解析器、编辑器 |
| 长度输入模式 | 同Assignment | 用户明确选择的解释合同 | 模式标识 | 新模式是；旧缺省不补物理事实 | 否 | 归一化、解析、批量、反馈 |
| 织造状态参考长度 | yarnLengthInput纯解析返回值 | 放松长度×倍率 | cm/100机针 | **否** | 是 | 临时Solver输入、只读UI |
| 张力 | Assignment.tensionCN，独立记录 | 实测/工艺记录；未知保留null | cN | 是，已有 | 否 | 记录/展示；不进入Geometry |
| 允许误差 | SOP-001检验规则/测量合同 | P1正式抽样标准 | 相对±2% | 当前保留文档，不加全局常量 | 否；区间另行派生 | 未来检验工具，不是Solver |
| 当前求解目标 | 解析器返回的临时target | 当前有效输入分支 | cm/100机针 | 否；直接分支的源数值仍保存 | 是 | solverLengths/requiredTargets/Solver |
| 求解结果 | Solver＋Simulation应用标记 | 当前几何与目标 | 各结果明示单位 | 否，已有runtime字段 | 是 | PreviewValidity/反馈 |
| 真实测量状态和来源 | Assignment输入证据记录；原始证据本身仍为sourceRef指向的记录 | 测量操作/生产确认 | 状态/来源/方法 | 建议随输入保存可选证据，缺失UNKNOWN | 否 | UI/审计，不改变数值求解 |

**[未知]** 当前没有正式SOP/检验规则对象；不能为了放置±2%顺带新建ProcessParameterStore。未来若需同一测量跨多个使用关系共享再设计记录身份；目前逐路参数已经足够，不杜撰一份测量自动代表所有Feed。

## 10. 推荐字段合同

**[设计决定]** 保留旧字段含义，新分支字段候选如下。名称可评审调整，互斥和缺失语义不可省略。只提出合同，未增加正式状态。

| 字段候选 | 所属对象/类型/单位 | 可选性与默认 | 清空/旧项目 | 校验及持久化 | Solver/UI |
|---|---|---|---|---|---|
| yarnLengthCmPer100Needles（已有） | Assignment；number；cm/100针 | 旧结构仍必备；默认0 | 0=直接目标unset；保留旧null/空串/string读取兼容 | 原规则；新牵伸分支必须为0，拒绝非零竞争目标；持久化 | 直接分支作为源值；牵伸分支不读它作目标 |
| lengthInputMode | Assignment；字符串模式 | 缺省解释DIRECT_MODEL_TARGET；不为旧文件强加字段 | 不以清倍率退出模式；模式改变是显式action | 仅识别直接/RELAXED_WITH_DRAFT候选；未知值拒绝；新分支保存 | 解析器读；UI选择；Solver不读 |
| relaxedLengthCmPer100Needles | Assignment；number或null；cm/100针 | 牵伸模式求解时必填；草稿null | 显式Clear→null，保留模式和倍率；旧项目无此字段 | SET有限正数；null可保存草稿；0/负值拒绝；新字段存number不存数字字符串 | 经解析派生；UI可编辑，不能直接传8 |
| draftRatio | Assignment；number或null；无量纲 | 牵伸模式求解时必填；默认null，绝不默认1或3 | 显式Clear→null，保留模式和放松长度 | SET正有限；草稿null；不硬编码2.8/3.2/3.6；持久化 | 经解析派生；UI可编辑 |
| lengthInputEvidence（建议可选） | Assignment；按relaxedLength/draftRatio分开的证据对象 | 缺省无记录→UNKNOWN | 修改某一数值使该项旧来源不再自动有效，另一项证据可保留；Clear去掉对应值关联 | 每项可含sourceRef、principle、confidence、applicableState；字符串/null，逐项校验；禁止标记为实测却无来源；随项目保存 | 不进Solver；UI可展开来源，未知明确显示 |
| knittingReferenceCmPer100Needles（仅返回值名） | 解析结果；number/null；cm/100针 | 无项目默认 | 输入不完整则null，无旧24 fallback | 乘积也须正有限，防溢出和下溢；不持久化 | Solver临时目标/只读展示 |

**[设计决定]** 新直接模式下不允许非null的draft/relaxed值作为隐藏后备目标；不同时保留两个可编辑分支。转为牵伸模式时，用户必须明确输入/确认放松值与倍率；不把旧23自动标记为实测，也不自动从旧8或23/8算倍率。提交一次原子更新，旧直接值置0。反向切换需明确输入直接目标，移除牵伸分支值；不自动把24复制成新的持久化目标。

**[设计决定]** `lengthInputEvidence`只是小型输入来源记录，不建立材料数据库或历史采样系统。单位由对应字段合同固定；Value在数值字段，Source/Principle/Confidence/Applicable state在证据项，六项信息可追溯。缺证据仍可作“用户输入、未验证”的模型诊断，不能显示“生产实测已确认”。P1确认只适用SOP-001，不能由纱名自动继承到所有项目。

**[设计决定] 合法性分层**：

- 数学：拒绝0、负值、NaN、±Infinity、布尔/数组/对象、不可解析文本；UI允许正数文本，经验证存number；新JSON数值必须number或明确null。
- 空值：编辑空白不是隐式Clear；沿用单独Clear动作。导入null表达草稿，缺模式时出现孤立倍率/放松字段应拒绝为歧义输入，不能猜模式。
- 未完成：有放松长度而倍率null→INCOMPLETE；不调用Solver、不回退8/默认倍率，保留8供补录。
- 显式清空长度：状态UNSET，没有目标；倍率和模式保留，UI显示“放松长度未设置”。这不同于已输入8却缺倍率。
- 工艺：2.8–3.2/3.6仅在有SOP-001依据时作为提示；大于3.6不因这个案例全局硬拒绝，小于1也不能未经普遍标准自动拒绝。当前SOP使用可警告偏离；硬拒绝需另有适用机台/材料的正式标准。
- 数值可达性：有效正目标可以不可达；保留现有UNREACHABLE_TARGET，不用QC或h范围限制输入合法性。

## 11. 织造状态参考长度派生位置

**[设计决定]** 推荐在现有 `src/domain/yarnLengthInput.js` 中扩展一个无副作用接口，例如 `resolveFeedYarnLengthInput(assignment)`，返回模式、输入完整性、canonical数值目标及输入签名。名称是候选；只需一个公共解析接口和现有输入校验，不创建Manager/Service层。该Domain现在没有State/DOM/Simulation依赖，新增后仍不依赖它们。

| 候选落点 | 适合承担 | 不适合承担 / 判断 |
|---|---|---|
| Assignment归一化 | 结构保留、数值类型、分支互斥、歧义拒绝；调用Domain校验 | 不把24写入旧字段，也不在每次normalize生成另一份持久化目标 |
| yarnSimulation输入准备 | 调用解析器，将有效数值映射到Solver现有参数 | 若在这里私有实现乘法，UI/批量还需重复，故不拥有转换公式 |
| yarnLengthInput | 输入合同、完整性、唯一派生与纯验证 | **推荐owner**；现有职责是长度输入合法性，扩展到其语义有直接关联 |
| yarnLengthMetrics | Gauge/单位换算、当前测量读数 | 不适合增加材料/工艺分支，避免所有单位调用都带业务解释 |
| yarnMaterial/YarnAsset | 解析材质、身份 | 不适合放每次使用参数或倍率公式 |
| runSimulation/UI | 调度或展示 | 不拥有乘法，否则直接simulate调用或其它消费者绕过 |

**[设计决定]** 解析输出至少区分READY、UNSET、INCOMPLETE、INVALID，这些是输入准备状态，不是新增Solver枚举。READY得到正有限target；原直接字段0或显式清空放松长度得到UNSET；放松值存在但倍率缺失得到INCOMPLETE。非法输入由编辑/import预检拒绝；运行时防御不得静默当作UNSET。

**[设计决定]** Simulation中的 `solverLengths`、`requiredTargets`、`solverInputKey`、uniqueTargets以及调用 `solveFeedYarnLengths` 的临时 `yarns` 必须来自同一解析结果。只改solverLengths而仍把原 `yarns[index]` 传入Solver，会造成key/显示为24、实际仍求旧0/8的错误，必须测试捕获。

## 12. 求解器边界

**[事实]** Solver输入为数值目标和buildGeometry；当前默认h范围0.05–2、模型容差0.01；求同Feed课程平均M1，再返回路径与误差。它没有测量证据或材料知识，知道Feed/slot仅为结果关联。

**[设计决定]** `yarnLengthSolver.js`可以保持不改，禁止添加 `if spandex`、读取draftRatio或在求解内部再乘一次。其现有 `yarnLengthCmPer100Needles` 参数名在临时Solver对象中继续表示直接数值目标，不是项目中有两个持久化Authority。

**[设计决定]** `yarnPathGeometry.js`、单位换算和M1/M2/M3定义都不改。24是工艺织造态参考映射到现有模型目标的数值相容性方案；不宣称M1等于实机耗纱。±2%、张力和真实直径缺口不能通过修改Solver容差来掩盖。

## 13. 旧项目兼容

**[设计决定]** 以下是方案C推荐矩阵，非当前已实现行为。新程序读取旧文件的兼容，与旧程序读取新文件的兼容，必须分别处理。

| 场景 | 解释 / 派生目标 | 是否改变旧行为 | 警告 / 拒绝 |
|---|---|---|---|
| 1 旧单普通纱，旧长度23 | 缺模式→直接模型目标23 | 否，原数值不变 | 显示测量状态未知；不自动标实测 |
| 2 旧同Feed多Yarn | 每槽原值独立直传 | 否 | 不按槽位序号判弹性 |
| 3 旧“第二纱”8，无倍率 | 仍按直接目标8，原不可达可继续出现 | 否；不能自动改为24 | 提示旧直接模型语义；需显式迁移，不能据名称判错 |
| 4 新普通纱 | 默认直接模型输入，未设置时0 | 延续旧软件语义 | 不声称放松=织造；其实际测量可另留工艺证据 |
| 5 新裸氨纶，选牵伸模式，8/3 | 唯一派生24；旧直接字段0 | 是显式新模式 | 只读显示24及来源，不可编辑24 |
| 6 牵伸模式有8，倍率缺失 | INCOMPLETE，无Solver目标 | 新行为 | 允许保存未完成配置；明确缺倍率；不得回退8/1/3 |
| 7 倍率非法 | SET/import拒绝，无新目标 | 不影响旧有效状态 | 编辑不dispatch，不清旧结果；导入原子失败 |
| 8 放松长度Clear | null，UNSET；保留模式/倍率，无目标 | 新Clear合同 | 明示未设置，清旧结果，不显示历史24 |
| 9 倍率Clear、仍有8 | null，INCOMPLETE，无目标 | 新Clear合同 | 保留8，停止该槽求解；不得退出模式 |
| 10 完整保存加载 | 保存模式、原始输入及证据；重派生、不存24 | 旧数据不变 | 新模式用版本保护；加载重建结构revision |
| 11 旧JSON导入 | 缺新模式→旧语义；Pattern-only仍保留现Cam/Library | 否 | 原旧合法值规范化保留；未知新模式拒绝 |
| 12 旧项目包导入 | v2仍支持；Cam正常归一化 | 否 | 不据旧23/8自动升级生产语义 |
| 13 新模式包被旧程序打开 | 推荐新包版本，让当前旧reader直接拒绝 | 不改变旧项目；不保证旧程序读新包 | 明确版本不支持，避免静默降级 |
| 14 手工抽出的新JSON给旧程序 | 旧loadJSON忽略version并丢未知字段 | 无法回溯修复已发布reader | 不提供“新模式JSON可被旧应用安全读取”的承诺 |
| 15 未知模式 / 同时正direct与放松分支 | 歧义；不选择优先级 | 不静默改数据 | 原子拒绝，提示冲突字段 |

**[推断]** 继续保留旧8不可达与禁止新弹性模式直接求8并不矛盾：前者是可追溯兼容行为，后者是用户明确选定新输入合同后的保证。若业务要求旧8自动转24，还需要逐条有来源的迁移映射，当前没有这种依据。

## 14. 导入导出

**[事实]** `getProjectData()`深拷贝整个Cam；PROJECT_FIELDS已含Cam，不是nested字段白名单。包writer给captured数据加 `format:"knitscape",version:2`；reader只接受2。Cam归一化才是新字段会被丢弃的实际位置。`migrateYarnLibraryAssets`只处理PBR资源，不是通用业务schema迁移器。

**[设计决定]** 新数值及模式在Assignment中持久化，导出不存24或SolverResult。Cam正常化显式保留/校验候选字段，所有入口（创建/resize/assignment替换/loadJSON）共用。exporter无需为nested字段逐个加顶层项；不新增顶层Store，也不把来源误塞进PBR迁移。

**[设计决定] 推荐版本策略**：

1. 无新合同数据的直接目标项目可继续输出v2；新程序同时读取v2和候选v3。
2. 只要含需要保留的新模式/输入证据（包括未完成草稿），输出候选v3；利用旧包reader的严格版本拒绝保护数据。不是因为“加字段就一律升级”，而是本次字段一旦丢失会改变解释或损失工艺事实。
3. 新importer对受支持format/version、新字段互斥及完整性进行预检，再进入现有staging/commit。新模式JSON若提供，应带明确版本；缺版本却带新合同字段作为歧义拒绝，不自动猜。合法null草稿不等于损坏。
4. 不提供默默降级v2导出：将24写进旧字段会丢失8/3/来源，将8写进旧字段会重现错误语义，写0也会在旧保存时丢失工艺事实。若未来需要降级，应单独定义明确的有损导出及告知，当前无业务授权需求。
5. 旧reader对原始JSON无版本守卫，不能用新增一个标志声称已经保护所有旧版本。当前产品正式保存是.knitscape，优先保护该路径；手工抽取JSON的旧程序前向兼容不作承诺。

**[未知 / 实施前决策 D1]** 用户是否接受“含新合同的文件由旧应用拒绝打开”，以及发布期间是否存在必须互开的旧客户端/外部JSON工具。这是B等级的具体原因。推荐选择上述失败即拒绝策略；若必须让旧应用继续可写新文件，就需要额外的有损兼容合同，不能在实现中悄悄选择。

**[设计决定] Undo**：新增值随Cam持久化，但不进入当前四字段Undo快照，保持现有Cam行为。不能只往SNAPSHOT_FIELDS添加Cam：`undo()`直接merge、不经过prepareAction，可能回滚结构而不更新revision。若后续要求Cam参数Undo，需要另定原子历史及revision策略，属于独立范围；不混入最小落位。

## 15. 批量设置与逐路差异

**[事实]** 当前批量只设置同一个旧长度值；选择记录 `{structureRevision, targets:[{feedIndex,yarnIndex,yarnId}]}`。先校验revision，再槽位、id、重复目标、当前可编辑性和新数值，最后一次dispatch同时清派生结果。一个失败目标使整批失败。

**[设计决定] 最小批量方案**：

- 首次实施保留现有批量面板，只批量“当前已选输入模式下的长度”。同批所有槽必须为同一模式；混选直接/放松模式整批拒绝并说明，避免同一“23”跨两种状态。
- DIRECT分支写旧字段；RELAXED分支写放松字段，使用各路原倍率。例如放松8，Feed1倍率2.8、Feed2倍率3.2，则分别派生22.4/25.6；不是一个全局倍率。
- 倍率先逐槽编辑，不增加一次批改两字段的复杂UI。独立批量倍率可后续按真实效率需求复用同一选中目标和原子预检；当前无证据要求同步上线。
- 批改放松值时，逐个合成候选Assignment并校验完整合同/乘积；不允许合法单值造成某槽乘积溢出。已有缺倍率可保留为INCOMPLETE草稿，但操作反馈需明示尚不能求解；不可称整批已收敛。
- 不保存整条旧Assignment到selection后再覆盖当前值；基于最新对象只改指定字段，避免覆盖逐路不同倍率。
- mode不属于结构身份。若选择后mode已变，选择项增加该次观察的 `lengthInputMode`（UI runtime）并在预检比较，返回目标语义已变；不要为此递增结构revision。长度/倍率值变化本身不令槽位身份失效。
- 非法SET不dispatch、不清结果；成功SET/Clear/模式切换同一次dispatch清 `yarnLengthSolverResults` 并置DESIGN_PREVIEW，随后runner重算。

**[设计决定]** 复用 `validateYarnLengthBatchSelection` 的结构校验以及逐目标原子流程；让TARGET_NOT_EDITABLE改为调用共享输入合同校验。不得再建一个SpandexBatchManager或绕过selection revision。

## 16. 缓存和结果失效

**[事实] 现有缓存**：

| 位置 | 当前key/生命周期 | 未来最小处理 [设计决定] |
|---|---|---|
| yarnSimulation模块级solverResultCache | 单条有界；pattern宽高/pixels、Gauge、lengthScaleY、有效直径profile、solverLengths | solverLengths改用canonical目标，并加模式/放松值/倍率的规范化输入签名；不把来源文案或tension塞进数值key |
| uniqueTargets / resultsByLength | 同Feed内target＋全直径profile相同才共享数值计算 | 用派生target；共享数值后仍逐slot复制结果，不共享Assignment身份 |
| geometryByProfile | 单次simulate内按diameter profile共享基础geometry | 倍率不影响profile，保持原样 |
| solverGeometryByHeight / evaluator | 单次simulate内按profile+h缓存，完成后clear | h变化自然生成对应几何；不加倍率到纯几何key |
| Solver内部geometryCache | 每次solve调用按h | 无需知道模式或倍率 |
| materialGeometryKey / resolveFeedYarnPlies | 解析有效直径/lengthScaleY；材质适配每次调用生成Map | 没有发现单独长期“工艺material profile cache”；不虚构新的失效层 |
| texture/UV caches | 图像、材质及本次绘图数据 | 与倍率语义无关，不改PBR或renderer生命周期 |

**[设计决定]** 即使8×3和12×2得到相同24，输入合同也变了；动作立即清旧结果，新增签名令旧slot结果不被当成同一工艺输入复用。若以后选择复用纯数值路径，必须另外重建当前证据关联；本次最小方案直接让签名不同，避免提前优化。

| 变化 | 结构变化？ | 清旧结果/重算？ | 处理 |
|---|---|---|---|
| 放松长度SET/Clear | 否 | 是 | canonical目标或UNSET改变 |
| 倍率SET/Clear | 否 | 是 | 目标改变或INCOMPLETE；绝不回退 |
| 输入模式变化 | 否 | 是 | 批量runtime语义快照另外检查 |
| Feed/slot增删、重排、换yarnId | 是 | 是 | 现有revision＋替换意图机制 |
| 同ID完整替换/删除重建 | 是（显式意图） | 是 | 保持已有防ABA行为 |
| Asset名称/category/颜色/PBR变化 | 否 | 通常只重绘，不改目标 | 不按名称/类型自动切换模式 |
| 同Asset有效直径改变 | 否 | 是 | 已有materialGeometryKey/profile使结果失效 |
| 换另一个Asset | 是 | 是 | DIRECT继续旧参数兼容；RELAXED清该旧纱的测量/倍率/证据为待录，保持模式，不冒用旧实测 |
| 非法输入被拒绝 | 否 | **否** | 保留原参数、结果、timer和画面 |
| 张力/来源文字 | 否 | 不应作为物理输入 | 当前Cam dispatch可能保守触发重算；不用本任务重构该生命周期 |

**[事实→设计决定]** 当前runner在Cam变动时已清结果；新actions仍建议原子清除，使注册在runner前的消费者也看不到旧VALIDATED状态，复用已有批量动作做法。无需因此修改state revision算法或runner调度。

**[设计决定] 未完成输入的可见性**：若本次实际使用的槽有8但缺倍率，Simulation不得把它简单滤除后宣布整体VALIDATED。数值计算可以继续其它合法槽；总状态对存在未完成输入的情况封顶PARTIAL，无任何合法成功时为INVALID；UI从共享解析结果显示“缺少倍率”。UNSET（显式Clear长度）仍按原“未设目标”处理。可在Simulation准备/汇总层做这个工艺完整性门控，`derivePreviewValidity`的数值成功定义和Solver状态不必修改；不以占位0/NaN目标欺骗现有函数。

## 17. 用户界面最小方案

**[设计决定]** 使用现有每路纱线编辑区域及结果面板，不另开大型材料配置页。

| 内容 | 编辑权限 | 出现条件 / 含义 |
|---|---|---|
| 长度输入模式 | 可选 | 槽位级；直接模型目标 / 放松长度＋牵伸；不是材料类型 |
| 直接模型目标 | 可编辑＋Clear | 仅DIRECT；旧23仍这样显示，状态UNKNOWN |
| 放松长度 | 可编辑＋Clear | 仅RELAXED；单位cm/100机针，依据不足时标“用户输入/未验证” |
| 实际倍率 | 可编辑＋Clear | 仅RELAXED；无默认3；本SOP推荐范围仅有来源提示 |
| 派生织造态参考 | **只读** | 仅输入完整时显示8×3=24；缺项显示原因，不显示上次24 |
| 数值求解目标/状态/是否应用 | 只读 | Feedback匹配canonical目标24；同时可看到来源8/3 |
| 来源、方法、状态、置信度 | 记录可编辑/摘要只读 | 小型折叠说明；未知明确UNKNOWN，不自动标生产验证 |

**[设计决定]** 不允许8、3、24三个数都可编辑。缺倍率不是UNREACHABLE；输入未完成与数值不可达要区分。`VALIDATED`保持模型含义，生产±2%不能换成绿色数值验收提示。模式退出/Asset替换涉及丢弃旧工艺输入时应明确告知用户，但这不是本轮要求执行任何UI变更。

## 18. 模块复用与新增模块判断

**[设计决定] NEW_SRC_MODULE = NO**。当前不满足“现有模块均不合理”这一新增条件，其他条件即使成立也不构成新建理由。

| 候选职责 | 复用现有模块 | 理由与边界 |
|---|---|---|
| 数值合法性、模式解释、唯一目标派生 | domain/yarnLengthInput.js | 纯函数，零State/DOM依赖；actions/UI/simulation均可调用，避免重复 |
| Assignment字段保留、默认与更新 | actions/singleJerseyCamProgram.js | 这里已是创建/normalize/resize/提交汇合点，调用Domain，不再内嵌一份乘法 |
| 批量预检 | domain/yarnLengthBatch.js | 复用selection/revision/原子校验；调整值字段和模式守卫 |
| Solver适配、缓存和完整性门控 | simulation/yarnSimulation.js | 这里已负责目标表、按profile分组和路径应用；只消费Domain输出 |
| 字段导入/版本拒绝/包版本选择 | actions/importers.js、actions/projectPackage.js | 复用现有原子导入和格式入口，不建迁移Service |
| 保存状态拷贝 | actions/exporters.js | 已包含整个Cam；原则上无需改 |
| 编辑和结果呈现 | views/singleJerseyCamProgramEditor.js、views/yarnLengthSolverFeedback.js | 复用当前每槽UI与反馈，无新组件体系 |
| 验证 | 现有长度/批量/结构/package/material validators | 扩展现有断言，package.json无需增加入口 |

**[推断]** `yarnLengthInput`扩展仍处理单一问题“这个槽的长度输入是否合法、表示什么、向数值求解提供什么”，不是把无关物理职责塞进去。它不负责张力物理、Asset查找、QC验收、保存或调度。依赖应保持 `UI/actions/simulation → yarnLengthInput`，Domain不反向import这些调用者，不引入循环。

**[设计决定]** 未来只有该合同出现独立大规模规则、现有模块不再合理且多个消费者确需复用时，才重新评估纯模块提取。本次禁止SpandexManager/Service/DraftEngine/平行Solver或空壳转发层。

## 19. 文件级实施计划

**[设计决定]** 以下是未来按推荐C及版本保护实施时的最小范围，**本轮一个都未改**。预计10个业务源码文件；测试/文档另列。不以文件数替代完整性。

| 文件 | 现有职责 | 建议修改 / 为什么必要 | 是否可避免 | 风险 |
|---|---|---|---|---|
| `src/domain/yarnLengthInput.js` | 长度校验 | 增语义解析、倍率/乘积校验、互斥合同和输入签名 | 否 | 默认/缺失误解释，重复公式 |
| `src/actions/singleJerseyCamProgram.js` | Cam/Assignment归一化及提交 | 显式保留新字段；单槽模式/长度/倍率动作，Clear与原子失效；调用共同合同 | 否 | currentCamProgram/resize丢字段；非法值清旧结果 |
| `src/domain/yarnLengthBatch.js` | selection/值预检 | 同模式/选择时模式守卫，逐目标候选校验，保留revision原子性 | 否（新模式参与现有批量） | 跨模式混写、覆盖逐路倍率 |
| `src/actions/yarnLibrary.js` | 赋纱/槽位 | 新模式换Asset时清旧测量证据/值；原DIRECT换纱兼容保持 | 对安全换纱不可避免 | 旧实测附着到新纱；不能误改普通纱旧测试 |
| `src/simulation/yarnSimulation.js` | 目标准备与数值调用 | canonical目标贯穿key/requiredTargets/临时Solver对象，输入不完整门控 | 否 | key为24实际仍传8/0，或漏掉未完成槽 |
| `src/views/singleJerseyCamProgramEditor.js` | 单路/批量UI | 模式、放松值、倍率、只读派生/来源；同模式批量 | 否 | 可编辑24形成多Authority、Clear静默退出 |
| `src/views/yarnLengthSolverFeedback.js` | 目标/结果连接 | 用共同解析目标匹配；区分UNSET/INCOMPLETE/数值失败，展示来源 | 否 | 用8匹配24导致“无结果” |
| `src/i18n/translations.js` | 多语言文案 | 精确状态、测量语义、只读派生和版本提示 | 否 | 仍把所有值称纱长/实测 |
| `src/actions/projectPackage.js` | 包写读/PBR迁移 | 推荐按新合同存在性选择v3，兼容读取v2；未知版本拒绝 | 取决D1；安全版本策略下必要 | 新程序不能读旧包、旧程序静默丢事实 |
| `src/actions/importers.js` | JSON/包统一加载 | 在既有原子提交前检查新合同版本/字段歧义；复用Cam归一化 | 推荐策略下必要 | 原JSON仍绕过版本和模式检查；不能破坏staging生命周期 |

**[设计决定] 明确不应修改**：

- `src/simulation/yarnLengthSolver.js`、`yarnPathGeometry.js`、`yarnLengthMetrics.js`及历史M3独立积分器：数值算法/测量定义不变。
- `src/domain/singleJerseyMachine.js`、`src/components/singleJerseyExecutionInput.js`、`src/adapters/singleJerseySimulationInput.js`：K/T/M与排针authority不变。
- `src/domain/yarnLibrary.js`、`src/domain/yarnMaterial.js`、`src/simulation/yarnTextureBrush.js`及Canvas/WebGL/PBR模块：无新增材料类型或物理关系。
- `src/state.js`、`src/domain/feedYarnStructure.js`、`src/constants.js`：不新增Store、结构revision规则或Undo范围。
- `src/components/runSimulation.js`：现有Cam变更已触发重算，新的action主动清结果；不新增生命周期层。
- `src/simulation/previewValidity.js`：保留其当前数值成功规则；工艺输入未完成由准备层明确门控。
- `src/actions/exporters.js`：已有Cam深拷贝，无需为nested字段逐个加白名单。
- package.json、package-lock.json：不增依赖/验证入口；不改历史fixture/结果文件。

**[设计决定]** 若实施中发现这些“不改文件”必须改，先给具体反例重新审阅范围，不能为了凑10个文件绕过错误。尤其完整Cam Undo和旧版本可写兼容不在本最小方案里。

## 20. 测试计划

**[设计决定]** 以下只设计，未新增或实施测试。复用现有validator入口；本轮运行的旧测试不能证明这些未来功能已通过。

| 测试 | 关键断言 | 优先扩展现有脚本 |
|---|---|---|
| 1 普通纱旧项目 | 无模式的23输入/输出/M1/M3不变，无自动状态等价推断 | validate-yarn-length-result-integration、validate-yarn-length-gauge |
| 2 8×3 | 解析输出24；传给真实Solver的临时字段24；项目仍保存8/3 | validate-yarn-length-input-integration、validate-yarn-length-solver |
| 3 每Feed不同倍率 | 同Asset Feed1=2.8、Feed2=3.2得到22.4/25.6；其它槽无变化 | validate-yarn-length-parameters |
| 4 倍率变动失效 | 同一次提交旧结果清空、runner后结果匹配；8×3→12×2同积也刷新签名 | validate-yarn-length-result-integration、validate-multi-yarn-renderer |
| 5 批量原子性 | 最后目标非法/混模式/选后模式变化时零提交；合法批改保留各路倍率 | validate-yarn-length-batch-integration |
| 6 非法倍率 | 0/负/NaN/Infinity/布尔/对象/非数拒绝，旧参数/结果/timers不动；乘积溢出也拒绝 | validate-yarn-length-input-integration |
| 7 Clear | 长度Clear→UNSET；倍率Clear但有8→INCOMPLETE；无旧24/直接8 fallback | validate-yarn-length-input-integration、validate-yarn-length-failure-integration |
| 8 保存加载 | facts、模式、每项证据保留；不存派生24；null草稿保留模式；失败导入原状态不变 | validate-pbr-persistence、validate-project-load-lifecycle |
| 9 旧兼容及版本 | 旧JSON/v2完整/部分加载不变；未知模式与冲突字段拒绝；旧v2reader拒绝新v3包 | validate-pbr-persistence、validate-yarn-library |
| 10 主纱无漂移 | P0-C1真实fixture主纱8路所有已有指标精确一致 | 现有SOP comparison/观测诊断（隔离输出） |
| 11 氨纶24可达 | 真实8路均调用当前Solver，检查CONVERGED+applied及数值误差 | P0-C1诊断或现有集成validator扩展 |
| 12 新模式8不直传 | 不完整模式不能漏进direct路径；旧模式8仍保留历史不可达 | validate-yarn-length-input-integration |
| 13 QC分离 | ±2%不改DEFAULT_SOLVER_TOLERANCE，也不把M3差异藏掉 | validate-yarn-length-solver |
| 14 张力独立 | 改5/4cN不改canonical目标或几何公式；与draft不同 | validate-yarn-material-authority、validate-yarn-length-parameters |
| 15 无重复持久化24 | 包/JSON项目树中没有新增派生target字段；旧direct在RELAXED为0 | validate-pbr-persistence |
| 16 结构revision | 倍率/模式/长度均不递增；删除重建、重排、换Asset递增，旧selection拒绝 | validate-yarn-length-structure-integration |
| 17 归一化全部入口 | normalize/currentCamProgram/resize/setFeedYarns/delete重建均按合同保留/清除字段 | validate-single-jersey-cam-editor |
| 18 反馈一致 | UI显示8/3/24，结果按24匹配；缺倍率不让整体假VALIDATED | validate-yarn-length-result-integration |
| 19 换Asset | DIRECT旧行为不变；RELAXED不把旧实测/倍率来源自动迁给新Asset | validate-yarn-library、validate-yarn-material-authority |
| 20 Undo边界 | Cam参数仍不进入四字段快照；New/full load原边界不变 | validate-project-load-lifecycle |

**[设计决定]** 部署前同时检查有效直径、zoom/material缓存复用、原23/8历史结果及全部validate/build；不以新合成8×3单元测试替代真实SOP全Feed重放。

## 21. 风险与未知

| 项目 | 标签 | 影响 / 处理 |
|---|---|---|
| M1≠M3，几何未实机标定 | [事实/未知] | 字段落位可做，生产精度不能验收；24收敛不改变此限制 |
| 旧归一化静默丢新语义 | [事实] | 不可将“包能保存额外JSON”当兼容成功；需D1版本策略 |
| 原字段全局改名/默认倍率1 | [推断] | 会伪造普通纱放松=织造、旧测量状态；拒绝 |
| 仅在Solver前乘一次 | [事实→推断] | 原targets/key/UI链路失配；必须统一准备和消费接口 |
| 缺倍率作为null目标直接过滤 | [事实→推断] | 其它槽成功可导致整体VALIDATED；必须完整性门控 |
| 新字段被currentCamProgram丢弃 | [事实→推断] | 普通Cam编辑也可能丢工艺事实；归一化和所有入口测试必要 |
| Asset替换复制旧工艺实测 | [事实→推断] | 旧行为保留参数；新实测证据不能自动跟随新身份 |
| Undo支持误承诺 | [事实] | Cam不在快照；本次不扩历史范围 |
| 同SOP8个Feed是否每路都有独立原始测量记录 | [未知] | 用户确认各路配置/可差异不等于提供逐路原始日志，来源不得虚构 |
| 测量时长/端部/仪器/真实直径 | [未知] | 后续物理与测量等价验证需补；不默认“实测” |
| 24人工覆盖/例外 | [未知，无需求证据] | 当前不提供覆盖；需要直接目标时显式切换分支，不同时保留两个authority |
| 审计快照是否需长期项目内历史 | [未知，无需求证据] | 当前报告已可保存一次运行证据；不将派生24写回编辑项目 |
| 旧客户端互开需求、外部JSON消费 | [未知，D1] | 决定新模式包版本保护与发布兼容；这是进入实施前需明确的信息 |
| 2.8–3.2/3.6适用范围 | [事实] | SOP-001现场数据，不能全局硬编码；其它项目合法性只用数学规则 |

**[事实]** tensionCN与draftRatio是两个独立工艺参数；仅draft按已确认定义参与长度参考派生，tension仍是记录。没有把两者和长度组合为弹性物理模型。±2%属于SOP-001检验规则，尚无全局生产标准依据。

## 22. 是否可进入实施

**[设计决定] 最终等级：B。SPANDEx_PROCESS_CONTRACT_PLACEMENT_AUDIT = NEEDS_DECISION。**

现有模块足以承载推荐C，无需先改Machine Domain、Solver或全面重构。进入实施前需要明确D1：**是否采用“旧项目照常读取；含新合同的项目包使用新版本并由旧应用拒绝；不承诺旧应用读写新模式原始JSON”的策略。** 本报告推荐采用；若业务要求相反，必须另定明确的有损降级合同，不能继续悄悄使用v2。

这项决策与“是否支持氨纶物理模型”无关；即使接受字段/版本方案，也只能实施可追溯的输入语义转换，不能宣布真实机器物理验证通过。普通纱默认直接模型语义、互斥分支、不持久化24、Clear不退出模式是本推荐方案的组成部分。

**[事实] 本轮验证与文件保护：**

| 检查 | 开工 | 完成报告后 |
|---|---|---|
| npm run validate | PASS，40/40，exit0 | PASS，40/40，exit0 |
| npm run build | PASS，exit0 | PASS，exit0 |
| git diff --check | PASS，exit0 | PASS，exit0；只有既有LF/CRLF提示 |
| src / Solver / Geometry / 项目格式 | 开工哈希已记录 | 1302个既有文件全部SHA-256相等，0个变化 |

**[事实]** 本轮只创建本REPORT.md；未改src、依赖、正式文档、历史报告或fixture，未实施未来测试，未commit/tag。终验结果已填入上表。开工与完成后文件清单汇总SHA-256均为 519918fe1f3f1f2d04fe93dc198536d1976b78ae2471e5e8a91098b6647da76a（按path排序，逐项path:SHA256，以LF连接）；范围排除ignored构建产物和缓存。唯一新增文件为本报告，branch/HEAD保持不变。报告22节齐全，源码相对链接检查无缺失。

