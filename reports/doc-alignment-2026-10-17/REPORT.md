# 当前阶段对接文档收敛审计

日期：2026-10-17（Asia/Shanghai）。任务仅审计和Markdown收敛，不开发功能、不修Solver/Simulation/Renderer/State/UI，不修改package或锁文件，不删除现有文件，不commit/tag，不继续下一阶段。

证据类别采用 **FACT / INFERENCE / PREDICTION / SUBJECTIVE / DESIGN DECISION / UNKNOWN / PENDING PROCESS CONFIRMATION**，定义及物理数据六项来源原则见 [PROCESS_VALIDATION](../../docs/PROCESS_VALIDATION.md)。FACT必须带快照/来源；路线和接口骨架标为设计，未知工艺不代答。

## 1. 开始前仓库状态 — FACT

所有审计先于文档写入。原始命令：git branch、git rev-parse HEAD、git status --short、rg枚举Markdown/报告、源码与报告只读检查。未执行reset / checkout / stash / clean。

```text
cwd: C:/Users/liuchen/Desktop/knitscape
git branch:
* main
git rev-parse HEAD:
7ababf264d495f6b96d4d66652c529424938ac4d
git rev-parse main:
7ababf264d495f6b96d4d66652c529424938ac4d
git merge-base --is-ancestor 2a1efc16d94cdab548b0ea96e9c64c462cd7c3f5 main:
exit 0
```

开工 git status --short（关闭Git非ASCII路径转义，内容相同）：

```text
 M package.json
 M scripts/validate-single-jersey-execution-integration.mjs
 M scripts/validate-texture-cache-lifecycle.mjs
 M scripts/validate-two-ply-yarn.mjs
 M src/components/runSimulation.js
 M src/domain/yarnLibrary.js
 M src/i18n/translations.js
 M src/simulation/drawYarnSimulation.js
 M src/simulation/yarnPathGeometry.js
 M src/simulation/yarnSimulation.js
 M src/simulation/yarnTextureBrush.js
 M src/simulation/yarnUvWebglRenderer.js
 M src/yarnTexture/yarnScanTexture.js
?? PBR/
?? ai-manufacturing-strategy-deck/
?? docs/
?? img009.jpg
?? reports/
?? scripts/validate-yarn-material-authority.mjs
?? src/domain/yarnMaterial.js
?? 面料放大.jpg
```

开工tracked diff：**13 files changed, 142 insertions(+), 61 deletions(-)**。这些全部是已有改动，不属于本轮。docs/reports原本就为untracked目录，不能把目录内全部文件记成本轮新增。

保留校验：枚举git已跟踪及非忽略未跟踪文件，按路径排序并对内容SHA-256；开工有46个Markdown、1281个非Markdown文件。非Markdown聚合hash（有序JSON数组，每项file/sha256）：`db8a38ec7042b9c8987061fa567bee7782ed98a7f104c3d020d8320c175f1db4`。该保护包含已有源码、脚本、package、原项目、PNG与报告数据；排除.git、node_modules、dist等被Git忽略的运行产物。本轮未执行构建或安装以避免生成这些产物。

开工index记录hash：`e4e3e477abb25c5fd8df33c44f27a121d80b5b14dae81d5c8ce0fee0dd35e5f4`；refs记录hash：`be520cb21fbaa4b7f97750d2b54906470f17efd83876f4f7a0ac252d7f88e372`。这是工作区保护指纹，不是物理测量来源。

## 2. 审计证据范围 — FACT

| 主题 | 已核对文件 / 结论用途 |
|---|---|
| 根入口 | AGENTS.md、README.md、KnitScape_当前功能与算法.md、NEXT_TASK.md；发现旧基线/持久化/路线过时 |
| P0输入/结果/失败 | [P0-1](../p0-1-yarn-length-trust.md)、[P0-2](../p0-2-yarn-length-feedback.md)、[P0-3](../p0-3-yarn-length-input-safety.md)、[明确Clear](../p0-3-explicit-clear.md) |
| P0批量/身份 | [P0-4](../p0-4-yarn-length-batch.md)、[早期总体FAIL](../p0-overall-audit.md)、[4B修复](../p0-4b-report.md)、[4B审查](../p0-4b-review.md)、[revision计划](../../docs/superpowers/plans/2026-10-07-feed-yarn-structure-revision.md) |
| P0基线 | [Final Audit](../p0-final-audit/FINAL_REPORT.md)、[代码审查](../p0-final-audit/code-review.md)、[baseline](../p0-baseline-20261007-210704/BASELINE_REPORT.md) |
| SOP-001 | [LATEST](../sop-001/LATEST.md)、[早期LEVEL1](../sop-001/REPORT.md)、[with-cam LEVEL2](../sop-001/with-cam/REPORT.md)、[manifest](../sop-001/with-cam/project-export.manifest.json)、工艺图副本及原项目 |
| geometry gap | [REPORT](../real-sop-geometry-gap-audit-2026-10-16/REPORT.md)、张力往返记录、相关数值证据；注意后续语义审计更正 |
| yarn semantics | [REPORT](../yarn-length-semantics-audit-2026-10-16/REPORT.md)、summary.json、geometry-A/CONTROL32、独立积分器及validator-exits.json |
| P1 audit | [2026-10-12 Final Report](../p1-yarn-feed-audit-20261012/FINAL_REPORT.md)；工作流与历史材质ownership建议 |
| material / PBR | [authority-before](../p1-1/authority-before.md)、[材料计划](../../docs/superpowers/plans/2026-10-15-p1-1-material-authority.md)、当前resolver/材质消费者、PBR五图IHDR/pHYs/hash、SOP PBR元数据 |

当前源码逐项核对：Machine Domain与调用包装/adapter；Cam normalizer/actions；export/import/package白名单；yarnLengthInput/Batch与State revision；yarnLengthSolver、previewValidity、yarnPathGeometry、yarnSimulation、readout/feedback；yarnLibrary/yarnMaterial、texture brush、draw、UV strip、WebGL shader。未以文件名或计划勾选状态代替实际消费者。

本轮还做了只读数值复核：调用已有independent-auditor读取已冻结geometry-A/CONTROL32；自校验及积分exit0，不加载或修改生产Solver。A为30×40/F8/Y1，内部16针×3course（rows15/23/31，N=48），得到 **24.077277996023653**；CONTROL32为32×40同选区，得到 **23.701615834835142**，单位cm/100机针。只是复算既有生成几何，不是重跑机台、浏览器或当前生产求解器。

## 3. 已确认与仍未知

### FACT

- P0是软件行为基线：SolverResult、PreviewValidity、输入安全、失败反馈、Feed×Yarn独立目标、批量原子预检、structure revision和regression validators。Final Audit为CONDITIONAL PASS，不是生产精度认证。
- 当前机器设置、Gauge、Library与Feed target已经进入项目持久化；派生结果和runtime revision排除。旧Pattern-only JSON保留当前Machine/Library是兼容语义。
- SOP记录Single Jersey、32英寸、32G、3216针、1234、4×8 Cam、N6/W(6040)23与20D LOW 8、张力记录5/4cN。保存项目只有主纱8路23，未保存20D，tension仍null。
- Solver/UI的周期化有限窗口平均与内部完整4针repeat诊断不同。原30×40约24.0773，23.7016属于32×40comparison。full-repeat是diagnostic，未获生产authority。
- 诊断fixture第二纱23/15八路收敛，10/8八路不可达；失败显示默认h=0.6，最近端点候选不是显示值。这只说明当前模型reachability。
- tensionCN是PROCESS RECORD，不是ACTIVE SIMULATION PARAMETER；placement字符串不定义独立工艺拓扑；当前绘制是XY分层，shader Z=0。
- 当前未提交实现已有Asset可选color/diameter、resolveYarnMaterial、逐纱diameter profile、Metallic通路及条件性Legacy strand抑制；本轮不续做验收。
- 五张PBR源图均2172×724、无pHYs；2400DPI来自报告记录的用户扫描说明；原SOP包只有四图。22.987mm的公式只在原始未重采样/真实采集DPI前提下解释纹理横向物理repeat，不能当直径。

### INFERENCE / PREDICTION / SUBJECTIVE / DESIGN DECISION

- INFERENCE：明确通道与连续100机针对应耗纱是工艺验收候选，尚不足以定canonical函数；保留Machine Domain等基础继续演进有依据，不要求全盘重写。
- PREDICTION：确认后的答案可能要求不同测量窗、独立第二纱路径或区分长度状态；未保证哪个方案足够，也无进度承诺。
- SUBJECTIVE / DESIGN DECISION：P0-C0/C1命名、六份文档分工、关口、MeasurementDefinition骨架、确认前准备及后续路线。没有据此新增运行时字段/schema。

### UNKNOWN / PENDING PROCESS CONFIRMATION

Q1–Q7完整清单及回答位于 [PROCESS_VALIDATION](../../docs/PROCESS_VALIDATION.md#process-questions-pending)，当前全部未答：23/8如何测、状态/静置、20D身份与预牵伸、Feed/96口对应、路径、setpoint/measured/QC类型。真实直径、弹性、摩擦、压缩、relaxation、finish后状态及PBR标定另缺来源；2400DPI真实采集与未重采样凭据仍有条件。旧P1 UI问题本轮未复验，不宣称修复。

## 4. 文档 / 源码 / 报告冲突登记

| 冲突 | 证据与区分 | 本轮处理 |
|---|---|---|
| 根文档把2a1efc1称当前唯一有效快照 | 当前main=7ababf2且包含该历史起点；还有已有dirty改动 | 更新四个根入口，保留主线限制；不回退到旧commit |
| AGENTS/NEXT_TASK/功能说明称机器字段尚未保存 | 当前getProjectData、PROJECT_FIELDS、import校验与SOP真实包相反 | 删除“下一任务是首次持久化”的当前指令，记录其历史来源；不再开第二schema |
| 旧功能说明P0持久化→P1差异检查→P2参数 | 其P0编号与后来可信纱长工作流P0不是同一交付范围 | 统一至P0 BASELINE→C0→工艺关口→C1路线，明确旧编号已过时 |
| p0-overall-audit为FAIL，后续Final Audit为CONDITIONAL PASS | 前者记录身份漏洞，4B后复验；不是同一快照的相反结果 | 保留全部历史，当前软件基线采用后续结果及限制；不扩大成生产PASS |
| 早期SOP LEVEL1 vs with-cam LEVEL2 | 前者未获Cam，后者补图后主纱续验，仍PARTIAL SOP | 说明LATEST仅指SOP阶段文件，不能覆盖后来的测量审计；不改历史报告 |
| 旧SOP/P1/authority-before写Asset无diameter、Metallic不支持 | 当前工作区normalizer/resolver/map/shader已支持；旧SOP实际包仍无Metallic | 分开写历史包、现有能力、未提交验收状态；不默改原包或宣称五图已全录入 |
| P1旧报告认为Legacy第二根额外叠加、所有Library变化均失效 | 当前draw已有assetMaterial/多slot抑制条件；runner按geometry key区分material-only变化 | 当前authority/legacy表按源码写，不用旧报告推断全部行为；未重跑浏览器不声称体验问题解决 |
| geometry gap旧值23.675983被外推为原项目内部完整repeat | 后续semantics审计与本轮独立重算为24.077277996；23.675983仍属P=30上下文 | 明确更正条件，不“平均调和”数值；23.7016只归32×40comparison |
| geometry gap建议把内部repeat作生产验收，旧P1又写不重开P0语义 | 后续semantics审计要求先确认工艺；本轮用户也明确禁止直接升authority | 当前路线以待确认契约为关口，full-repeat保持diagnostic；旧建议保留作历史 |
| SOP表格100针标题被误读成方法/状态全确定 | 语义审计仅证实标题，取样程序、路径、负载和值类型未补齐 | Q1–Q7全部UNKNOWN，不由名称或比值替答 |
| “5cN记录已明确”被误读成已填或已驱动几何 | SOP保存包tension=null；normalizer支持记录，几何无读取 | 区分PROCESS RECORD、实际保存值和ACTIVE SIMULATION PARAMETER |
| 源图DPI/高度被误读成嵌入DPI或diameter | PNG无pHYs；2400为用户来源；2172/2400×25.4仅条件性repeat | 记录前提与原理；真实diameter=UNKNOWN，拒绝denier/透明区/肉眼推导 |

README和旧NEXT_TASK/功能说明路线确已过时，本轮已更新。docs/superpowers/plans与历史reports继续保留；其中勾选状态、旧READY_FOR_P1_IMPLEMENTATION和旧建议不是当前开发授权或验收结论。

## 5. 修改 / 新增Markdown及职责

| 文件 | 操作 | 解决问题 |
|---|---|---|
| AGENTS.md | 更新 | 当前main事实、已完成持久化、当前关口；保留领域和主线约束 |
| README.md | 更新 | 新接手统一入口、P0限制及当前阶段 |
| KnitScape_当前功能与算法.md | 更新 | 修正持久化/验证/路线过时信息，补当前长度/材质边界 |
| NEXT_TASK.md | 更新 | 确认前允许/禁止项与确认后顺序，防重复开发持久化 |
| docs/ARCHITECTURE.md | 新增 | 真实链路与未来边界分离，Renderer为消费者 |
| docs/DOMAIN_AUTHORITY.md | 新增 | 每概念authority/derived/legacy/UI/renderer/unknown及证据 |
| docs/YARN_LENGTH_CONTRACT.md | 新增 | 已知/未知、不同metric、未来测量骨架 |
| docs/PROCESS_VALIDATION.md | 新增 | 七问、四类验证、来源六项原则和关口 |
| docs/ROADMAP.md | 新增 | P0-C0/C1、条件分支、Correctness Gate后九步 |
| docs/LEGACY_MAP.md | 新增 | 当前消费者、compatibility与移除前提，不删Legacy |
| reports/doc-alignment-2026-10-17/REPORT.md | 新增 | 本轮审计、初始状态/清单、冲突、最终验证与范围 |

选择docs/统一存放六份当前交接文档；原docs仅有专项实施计划，没有同类当前架构/契约/工艺/路线入口，因此不另建同义系统。reports保留历史实验/本轮审计，不改旧报告事实。

## 6. 初始Markdown完整清单 — FACT

下列为写文档前的46个项目Markdown；用rg含隐藏文件枚举，排除.git/node_modules/dist，并与Git可见文件hash清单交叉核对。演示稿目录及其.previous副本只作库存保留，不作为KnitScape工艺/架构权威。

- `AGENTS.md`
- `KnitScape_当前功能与算法.md`
- `NEXT_TASK.md`
- `README.md`
- `ai-manufacturing-strategy-deck/.previous/before-chapter-cover-repair/README.md`
- `ai-manufacturing-strategy-deck/.previous/before-chapter-cover-repair/content-and-speaker-notes.md`
- `ai-manufacturing-strategy-deck/.previous/before-chapter-cover-repair/material-inventory.md`
- `ai-manufacturing-strategy-deck/.previous/before-chapter-cover-repair/presentation_notes.md`
- `ai-manufacturing-strategy-deck/.previous/before-chapter-cover-repair/quality_audit.md`
- `ai-manufacturing-strategy-deck/.previous/before-final-design-repair/README.md`
- `ai-manufacturing-strategy-deck/.previous/before-final-design-repair/content-and-speaker-notes.md`
- `ai-manufacturing-strategy-deck/.previous/before-final-design-repair/material-inventory.md`
- `ai-manufacturing-strategy-deck/.previous/before-final-design-repair/presentation_notes.md`
- `ai-manufacturing-strategy-deck/.previous/before-final-design-repair/quality_audit.md`
- `ai-manufacturing-strategy-deck/.previous/before-toc-insertion/README.md`
- `ai-manufacturing-strategy-deck/.previous/before-toc-insertion/content-and-speaker-notes.md`
- `ai-manufacturing-strategy-deck/.previous/before-toc-insertion/material-inventory.md`
- `ai-manufacturing-strategy-deck/.previous/before-toc-insertion/presentation_notes.md`
- `ai-manufacturing-strategy-deck/.previous/before-toc-insertion/quality_audit.md`
- `ai-manufacturing-strategy-deck/README.md`
- `ai-manufacturing-strategy-deck/content-and-speaker-notes.md`
- `ai-manufacturing-strategy-deck/material-inventory.md`
- `ai-manufacturing-strategy-deck/presentation_notes.md`
- `ai-manufacturing-strategy-deck/quality_audit.md`
- `docs/superpowers/plans/2026-10-07-feed-yarn-structure-revision.md`
- `docs/superpowers/plans/2026-10-15-p1-1-material-authority.md`
- `reports/p0-1-yarn-length-trust.md`
- `reports/p0-2-yarn-length-feedback.md`
- `reports/p0-3-explicit-clear.md`
- `reports/p0-3-yarn-length-input-safety.md`
- `reports/p0-4-yarn-length-batch.md`
- `reports/p0-4b-report.md`
- `reports/p0-4b-review.md`
- `reports/p0-baseline-20261007-210704/BASELINE_REPORT.md`
- `reports/p0-final-audit/FINAL_REPORT.md`
- `reports/p0-final-audit/code-review.md`
- `reports/p0-overall-audit.md`
- `reports/p1-1/authority-before.md`
- `reports/p1-yarn-feed-audit-20261012/FINAL_REPORT.md`
- `reports/real-sop-geometry-gap-audit-2026-10-16/REPORT.md`
- `reports/sop-001/LATEST.md`
- `reports/sop-001/REPORT.md`
- `reports/sop-001/operation-log.md`
- `reports/sop-001/with-cam/REPORT.md`
- `reports/sop-001/with-cam/operation-log.md`
- `reports/yarn-length-semantics-audit-2026-10-16/REPORT.md`

## 7. 最终核验

**FACT — 本轮检查结果**：

| 检查 | 结果 |
|---|---|
| git diff --check | PASS，exit0，stdout为空；Git可能有LF/CRLF预告，不是whitespace error |
| 11份修改/新增MD的本地链接及标题锚点 | 185项，0缺失 |
| 新增MD尾随空格检查 | PASS；同时用git diff --check检查tracked增量 |
| 七问、四类验证、六项来源、C0/C1、metric、fixture与分支必需项检查 | PASS；结合逐项内容复核，不以关键词代替事实审计 |
| 已有1281个非Markdown文件 | 数量与有序内容hash均不变，包含package、源码、脚本、项目和素材 |
| 已有Markdown | 仅4份根入口发生预期更新，其他42份hash不变；无文件删除 |
| 新增Markdown | 6份docs与本报告，共7份；没有非Markdown新增 |
| HEAD / main / refs / index | 均与开工相同；仍在main；未stage、commit、tag |
| 已冻生成几何的独立只读复算 | exit0；仅支持第2节的生成路径数值，不是当前Solver/实机验收 |

检查使用一次性内存脚本及Git命令，没有向仓库写验证脚本/JSON/log。未执行npm validate/build、安装依赖、真实浏览器或机台验收；本轮没有功能源码变更，历史npm通过只按历史记录引用。

`git diff --stat`（整个tracked工作区，**包含开工前13份源码/配置改动**）：

```text
 AGENTS.md                                          |  27 +++---
 KnitScape_当前功能与算法.md                        |  69 +++++++------
 NEXT_TASK.md                                       |  87 ++++++-----------
 README.md                                          |  32 ++++--
 package.json                                       |   1 +
 ...alidate-single-jersey-execution-integration.mjs |   5 +-
 scripts/validate-texture-cache-lifecycle.mjs       |   2 +-
 scripts/validate-two-ply-yarn.mjs                  |   1 +
 src/components/runSimulation.js                    |  18 +++-
 src/domain/yarnLibrary.js                          |   8 ++
 src/i18n/translations.js                           |   8 +-
 src/simulation/drawYarnSimulation.js               |  12 ++-
 src/simulation/yarnPathGeometry.js                 |   7 +-
 src/simulation/yarnSimulation.js                   | 108 ++++++++++++++-------
 src/simulation/yarnTextureBrush.js                 |  14 ++-
 src/simulation/yarnUvWebglRenderer.js              |  14 ++-
 src/yarnTexture/yarnScanTexture.js                 |   5 +-
 17 files changed, 250 insertions(+), 168 deletions(-)
```

其中本轮tracked文档增量为 **4 files changed, 108 insertions(+), 107 deletions(-)**；另新增7份untracked Markdown，普通git diff --stat不统计它们。本轮合计11份MD，不能把17个tracked文件或所有untracked目录算成本轮修改范围。

## 8. 交接结论

**DOC_ALIGNMENT_STATUS = READY**。

READY只表示当前事实、未知、历史冲突和后续关口已可交接；不表示PROCESS CONFIRMATION GATE已打开、Correctness Gate已通过或生产验证已完成。缺失工艺信息已明确保留在Q1–Q7及物性/来源表中，不需要为交付文档而猜答案。

本轮是否修改业务源码：**NO**。package.json / package-lock.json是否由本轮修改：**NO**。是否删除文件：**NO**。是否commit/tag：**NO**。是否开始下一阶段开发：**NO**。工作到此停止。
