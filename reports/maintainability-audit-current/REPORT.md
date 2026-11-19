# KnitScape Maintainability & Cross-Design Audit

日期：2026-10-17（Asia/Shanghai）。AUDIT ONLY。对象：C:/Users/liuchen/Desktop/knitscape当前工作区，同时核对HEAD差异，不将历史报告当现状。不修改业务源码、测试、package、锁文件或现有文档；不commit/tag/reset/checkout/stash/clean。

FACT=当前源码/文件/探针直接支持；INFERENCE=由事实推导；PREDICTION=未来可能性；SUBJECTIVE / DESIGN OPINION=维护性、风险与路线判断；UNKNOWN=证据不足。每项Finding的Type说明当前行为证据，Risk/grade为设计判断，不能把预测写成事实。

## 1. Executive Conclusion

What this repo does: KnitScape是浏览器端Pattern/Repeat编辑、Single Jersey排针/Cam到K/T/M执行，以及分层二维纱线路径/材质预览工具。负载假设为单人在本地浏览器操作局部窗口，不假设服务器并发、多用户协作或完整3216针三维物理模拟。

**Audit grade：C — MAINTAINABLE BUT DOMAIN COUPLING NEEDS CONSOLIDATION。**

**SUBJECTIVE / DESIGN OPINION**：当前可维护，适合有文档和针对性边界测试的新开发者接手；不建议现在全面重构。证据不支持“全仓很乱”“存在两套机器执行引擎”或“需要架构重做”。真正跨层风险集中于长度测量契约、Renderer内隐式Legacy strand策略，以及Pattern替换时UI/异步生命周期。最大Domain风险是“成功数值究竟测了什么”，不是文件长度或import数量。

**关键结论：YES_WITH_DOCUMENTATION。** 会JavaScript和基础Three.js的新开发者可以不依赖原作者口述，借助当前docs、本审计调用图和明确测试场景安全修改有定义的软件行为；不能自行定义生产纱长、第二纱路径或物性。Three.js并非当前技术栈，先读实际XY/Canvas/WebGL链。现有回归有一项文档标题失败，不能承诺接手时全绿。

Top 5 confirmed risks：MAINT-001长度窗口/契约；MAINT-002旧素材库请求覆盖新操作；MAINT-003失效activeYarn污染序列；MAINT-004材质字段影响可见strand数量；MAINT-005后端/缓存改变Legacy材质解释。详见第16节，另有PBR标尺生命周期与低风险维护债。

Top 5 healthy：唯一Machine Domain；唯一目标输入与统一校验；revision+batch原子保护；正式导出明确排除派生/runtime；当前材质优先级集中且直径profile接入几何/solver缓存。不能因存在Legacy或多个测量函数就抹去这些边界。

## 2. Repository Facts

| 项 | 开始前真实值 |
|---|---|
| branch | main |
| HEAD | 7ababf264d495f6b96d4d66652c529424938ac4d |
| git log -1 --oneline | 7ababf2 feat: establish trusted feed yarn length workflow |
| working tree | 原有17个tracked修改：4份MD+13份源码/脚本/package；另有原先untracked素材/docs/reports及yarnMaterial/validator等。未清理 |
| src | 101文件，其中94 JavaScript与7资产/JSON |
| scripts | 43文件；37项validate命令+1聚合器、4个browser助手、1生成器 |
| dependencies / devDependencies | 7 / 1；完整版本/用途见第12节及dependency-audit.md |
| build入口 | npm run build→vite build；index.html→src/index.js；vite.config.js的base为./ |
| directories | src/{actions,adapters,codeGuide,components,domain,events,i18n,lib,simulation,views,yarnTexture,assets}；scripts、docs、reports、examples、PBR；dist/node_modules为已有运行产物 |
| 初始保护 | 1334个Git可见已有文件的path/hash；index/refs/tracked diff也记录，见initial-state.json |

开始前执行了git branch --show-current、git rev-parse HEAD、git status --short、git log -1 --oneline。完整原始status、依赖、scripts和文件hash在 [initial-state.json](initial-state.json)。报告目录开工时不存在，因此使用指定目录，无覆盖历史报告。

**当前HEAD与工作区必须区分。** Asset color/diameter、resolveYarnMaterial、逐slot/course diameter profile、Metallic与相关tests是已有dirty修改，不在HEAD原样实现中。长度metrics/Solver/row model/sampler/UV/validity和两个长度UI相对HEAD无修改；dirty Geometry主要增加course diameter输入，未改测量窗口定义。两个已复现Pattern导入问题位于未改动的importers.js。

本轮检查：npm run validate **36/37，exit1**；npm run build **exit0，747 modules**；git diff --check **exit0**。失败精确归因见第15节，不为通过而修改测试或文档。[checks.json](checks.json)

## 3. Authority Map

以下为完整20项表，Evidence使用src内简称+当前行号；Machine Domain=domain/singleJerseyMachine，Cam=actions/singleJerseyCamProgram，geometry/Solver/Simulation/draw/UV均为simulation对应文件。更细来源和注释见 [authority-map.md](authority-map.md)。NONE表示范围内未发现authority冲突，不是无条件质量保证。

| Concept | Authoritative Source / Project State | Writers | Derived Functions | Consumers | Legacy / Fallback | Duplicate Authority? | Risk Level | Evidence（src简名:行） |
|---|---|---|---|---|---|---|---|---|
| Machine Configuration | State的Cam/arrangement/Gauge各自输入；没有统一Machine实体 | Cam actions、排针UI、Gauge UI/import | execution wrapper→Domain | runner、保存、UI | punchcard th860属独立旧导出域 | NO；旧punchcard不驱动Single Jersey | LOW | state:40–52; runSimulation:244–248; punchcard:5–17 |
| Gauge | GLOBAL_STATE.machineGauge | readout change；importers:60–63 | normalizeMachineGauge/gaugeToNeedlePitchMm | Solver、geometry、UV、UI | 默认32、clamp1–120 | NO公式双写；raw与normalized可不同 | LOW | yarnLengthMetrics:5–29; yarnLengthReadout:13–30 |
| Needle Count | 无真实总针数字段；chart.width仅输出窗口 | chart resize/import/New | Domain输出width；measurementWindow针数 | Machine执行/geometry/统计 | SOP3216仅资料；不得作30针分母 | NO；容易混淆机台总针/窗口/采样P | LOW | runSimulation:244–248; geometry:36–58,437–442 |
| Needle Arrangement | State.needleArrangement（已应用）；Inputs为独立草稿 | needleArrangementBar edit/apply/remove、import | parseNeedleArrangementInputs；Domain选Type | Machine wrapper、overlay、保存 | 空配置无机器预览 | NO；草稿≠已应用是明确设计 | NONE | needleArrangementBar:13–15,63–71; Domain:39–56,83–88 |
| Cam Program | State.singleJerseyCamProgram.tracks | create/resize/set/cycle/delete actions、import | normalize/buildCamProgram→Domain | editor、execution、保存 | 默认4×4全K仅草稿 | NO；action/domain重复校验未见漂移 | NONE | Cam actions:86–100,118–165,255–269 |
| K/T/M | resolveSingleJerseyOperations唯一规则 | 只改Cam/排针输入；不直接写执行矩阵 | tracks[type-1][feed%count] | Adapter→Simulation | Pattern可有P，但机器不输出P | NO；未发现第二解释器 | NONE | singleJerseyMachine:72–89; adapter:3–7,24–42 |
| Feed | Cam列+同索引feeds[] | Cam resize/setFeedYarns/import | courseToFeedIndex(row,count) | Solver/材质/Renderer | 软件cycle≠96实体口 | NO；与机台对应UNKNOWN | LOW | Cam:86–100; metrics:59–67 |
| YarnAsset | State.yarnLibrary id/元数据/可选材质 | yarnLibrary actions、import；normalize保留字段 | normalizeYarnLibrary；按id引用 | assignment、resolver、UI、package | 旧无字段asset可fallback primary | NO identity authority；材质兼容另列 | LOW | domain/yarnLibrary:12–50; actions/yarnLibrary:20–35 |
| FeedYarnAssignment | cam.feeds[f].yarns[y] | setSingleJerseyFeedYarns；assign/add/remove actions；import | identity revision、usedFeed过滤 | Solver/adapter/UI/保存 | Legacy companion仍有条件附加显示 | EXPLICIT关系唯一；可见strand还有隐式策略 | MEDIUM | actions/yarnLibrary:109–129; draw:43–53 |
| Yarn color | Asset有效color→primary→默认 | Asset导入；Legacy ply颜色UI；palette行色独立 | resolveYarnMaterial→row mask/tint | Canvas/WebGL | Legacy sequence mask、scan/original色 | 字段优先级唯一；后端显示解释不同 | MEDIUM | yarnMaterial:12–19; brush:195–215; WebGL:332–339 |
| Yarn diameter | Asset有效diameter→primary→.24 model | Asset导入/normalizer；Legacy滑条/包 | slot×course profile→normals/solver/ribbon | geometry、cachekey、offset、draw | 第二显式slot不自动取companion.14 | NO已发现竞争；多个消费者共用解析 | LOW | yarnMaterial:19; Simulation:153–175,198–206; draw:108–139 |
| Yarn PBR | Asset.pbr图组/registry原图 | importYarnPbr/clear、import | resolveYarnMaterial、materialMaps、decode | shader/Canvas降级、package | 无Asset maps才用Legacy整组 | NO图组混合authority；后端能力不同 | MEDIUM | yarnMaterial:20–28; brush:125–138; WebGL:132–144 |
| physicalRepeatLengthMm | Asset.pbr正数优先 | setYarnPbrPhysicalRepeatLength/import；整组replace会清除 | resolver→U累计model arc×pitch/repeat | UV renderer；保存 | 无Asset maps才继承Legacy；再/48 | 选择唯一；资源replace与标尺生命周期耦合 | MEDIUM | actions/yarnLibrary:54–78; yarnMaterial:29–36; UV:42–63 |
| Yarn Length Target | assignment.yarnLengthCmPer100Needles | single/Clear/batch action、import | 统一input validator→target model换算 | Solver、feedback、保存 | 0=unset；result.target仅副本 | NO；未发现第二个可编辑目标authority | NONE | domain/yarnLengthInput:5–17; Cam:207–252 |
| Yarn Length Measurement | 当前有限周期窗口F；其他metric另有明确用途 | 无用户写入；定义固化在函数 | periodicMeasurementPattern/measureRow/Feed mean/legacy stats | Solver、侧栏、UV、validators | finite sidebar、独立repeat diagnostic | 多种同单位口径；缺canonical契约 | HIGH | geometry:36–58,323–458; Solver:14–25; length-probe |
| SolverResult | Solver派生+Simulation实际应用标记 | solveFeedYarnLengths；simulate；runner dispatch | resultFromCandidate；applied复核 | validity/feedback；不正式保存 | 失败候选≠base显示路径 | NO；ownership分层明确 | NONE | Solver:71–104; Simulation:300–337; runner:277–280 |
| PreviewValidity | derivePreviewValidity聚合；生命周期清理 | simulate/runner；action失效清理 | target/slot/status/applied/error/tolerance检查 | feedback summary；不保存 | 缺输入DESIGN_PREVIEW；非法配置INVALID | NO；不是PROCESS_VALIDATED | NONE | previewValidity:12–25; runner:288–316 |
| Tension | assignment.tensionCN过程记录 | normalizer/import、setFeedYarns | 有限非负或null；无力学推导 | 保存/数据传递 | SOP5/4记录≠包中实际null | NO；不是ACTIVE SIMULATION PARAMETER | LOW | Cam:43–64; src中无geometry读取 |
| Simulation Geometry | buildYarnPathGeometry；ProcessModel/YarnModel输入 | 纯构建+Solver成功path map应用 | 逐profile/周期measurement视图 | display path、measure、Renderer | h=.6/lengthScaleY未标定模板 | NO第二引擎；measurement和summary耦合需注意 | MEDIUM | geometry:61–75,372–495; Simulation:153–175,300–337 |
| Renderer Material | resolver→resolveFeedYarnPlies→row view | 派生；brush/WebGL cache只缓存资源 | rowYarnPly/materialMaps/backend fallback | Canvas/WebGL | assetMaterial门控companion、mask、raw/tintedcache | 字段解析唯一；strand/颜色策略分散 | MEDIUM | draw:43–77,160–196; brush:66–101,160–182; WebGL:332–339 |

## 4. Yarn Length

唯一可编辑target在assignment；SolverResult.target是副本，不是第二个项目事实。UI→统一input/batch预检→Cam action→State→runner→Machine Domain/adapter→simulate→geometry evaluator↔Solver→成功路径应用→PreviewValidity→feedback。Renderer另消费最终path做累计UV；base sidebar统计另有来源。

完整函数清单、每项输入/输出/单位/分母/边界/Feed/Yarn/消费者、换算公式见 [yarn-length-callgraph.md](yarn-length-callgraph.md)。这是审计表的一部分，不把仅引用结果表当成调用链核验。

**FACT：当前代码fresh复算**（不是只重读旧geometry）：

| 条件 / F8-Y1 | target | Solver cm/100针 | 内部4针repeat独立diagnostic | status |
|---|---:|---:|---:|---|
| 原30×40 | 23 | 22.999733873071612 | 24.077277996023074 | CONVERGED |
| 32×40 comparison | 23 | 22.999580039157998 | 23.701615834833124 | CONVERGED |

探针使用当前Machine/geometry/Solver，独立Simpson积分当前solved path；内部16针×3course=48次针位经过，168links，源针归属含完整outgoing连接。[length-probe.mjs](length-probe.mjs)、[probe-results.json](probe-results.json)

差异来源于横向P必须整除width（30→P30，32→P4）与有限纵向顶边进入Feed平均；不是Solver优化了另一函数，也不是统一漏连接或单位×8错误。存在相同cm/100针单位但不同数学区间，属HIGH风险；**不判断full-repeat为工厂正确答案**。侧栏cmPer100Loops实际分母width×height且排除两端不在窗的link，不能替代Feed目标验收；label与effectiveLoopCount名称有误读风险。

UNKNOWN / PENDING PROCESS CONFIRMATION：23/8真实取样、路径、Feed/负载/静置与数值类型。8不可达只说明当前模型/范围，七问前不改bound/分母/直径强行收敛。

## 5. Yarn Material

**FACT**：当前resolveYarnMaterial统一Asset/Legacy/default优先级；不是旧报告描述的“Asset永远没有color/diameter”。Feed3/Yarn2对应feeds[2].yarns[1].yarnId，按String(id)查Asset；指定SOP主纱版没有该第二槽，不能凭标签假定它是20D或companion。

color/diameter优先Asset，再primary；PBR有任一Asset map即整组使用Asset、缺图中性，无Asset maps才继承Legacy；repeat的有效Asset值独立优先，回退有条件。diameter进入每slot/course几何、Solver key、ribbon宽；color/maps/repeat不进入长度objective。

字段来源可唯一追踪，但最终显示还依赖mask、贴图、backend和cache。actual drawStrip+fake GL探针确认textureStrength=0被送成.75；Legacy原色/tint缓存和mask也有source-confirmed分叉。图组replacement移除repeat已由actual action+importer fixture复现。细节、条件和stub边界见 [material-callgraph.md](material-callgraph.md)。无真实GPU/视觉结果声明。

## 6. Feed × Yarn

显式Feed→Asset关联唯一，第二显式slot不会自动取yarnPlies[1]；目标与材质身份分开。显式多slot不被Legacy第二纱toggle关闭，未发现UI另写一套Feed yarnId映射。

但Renderer还有条件性Legacy附加strand：单slot且没有任何Asset材质字段时，enabled companion仍可画；加一个color/repeat就改变assetMaterial，抑制附加strand并改变mask处理。该兼容意图有代码/文档依据，不能称“永远叠一根”或要求删Legacy；维护风险是可见纱数策略藏在Renderer，不能仅从assignment数量推断全部画面。MAINT-004给出完整条件。

## 7. Simulation / Renderer Boundary

健康：Renderer不解释Cam/排针，不决定K/T/M，没有第二Solver；UV sampler/shared cubic弧长是视觉累计长度，不是另一个业务target。parallel offset只改变显示位置，不回写Solver中心线或U。

交叉：draw中决定Legacy strand cardinality/mask；后端分别解释原色、strength和mask；Canvas是能力较低的降级，并不消费等价的物理repeat/Normal/Roughness/AO/Metallic。正常LOD/纹理就绪/shader中性默认不是业务authority，不能一概判为交叉设计错误。

当前XY中心线、ribbon/stroke、front/mid/back，WebGL Z=0。无真实3D、碰撞、摩擦、张力/relaxation；缺能力不等于已有模块不可维护。数据流和文件职责详见 [architecture-map.md](architecture-map.md)。

## 8. State Ownership

Project/Runtime/Derived/UI数据物理共用State，但官方导出getProjectData显式投影11个事实字段：width、height、repeats、yarnPalette、yarnSequence、yarnPlies、yarnLibrary、singleJerseyCamProgram、needleArrangement、needleArrangementInputs、machineGauge。SolverResult/validity/runtime revision和batch drafts不在正式保存中。没有发现正式路径把Renderer cache反写业务State。

**文档精度更正**：PROJECT_FIELDS在package是必需字段检查，不是过滤器；createProjectPackage会spread captured保留额外字段。官方调用先经过getProjectData仍安全；未来不能直接把GLOBAL_STATE当project参数。本轮仅指出既有文档“package白名单”简写不精确，不改文档或函数。

State prepareAction唯一生成revision，完整Cam项目替换声明replacement；旧Pattern-only合并保留Machine/Library，New不清空全项目是已文档化兼容语义，不能自动判“残留bug”。真正反例是失效activeYarn与library请求generation漏用。同步嵌套dispatch的原始snapshot还有旧derived的维护约束，当前UI在RAF回读并已规避，未证明当前false success。

## 9. Gauge / Unit / Physical Scale

生产25.4/G公式集中于yarnLengthMetrics；UI/目标/Solver/geometry/UV调用同一utility。model→mm、mm→cm、100L/N与target反变换没有发现隐藏×8或各层重写Gauge公式。reports独立复算有意不调用生产utility，不是第二authority。

不同定义不能强合并：legacy width×height有限窗、Solver中间P针+course平均、UV累计arc/repeat。measurement metadata外层报width而内部P不同，属观测语义风险，不是当前Solver分母错误。Gauge原始state与消费normalize的范围也要区分；SOP32G不触发此边界。

22.987mm只在原图未重采样且2400DPI真实采集前提下由2172px推导，用于纹理U；不是yarn diameter。默认.24是model unit，真实直径UNKNOWN；tension5/4cN是记录，未成为geometry force。所有物理输入仍需Value/Unit/Source/原理/Confidence/Applicable state，不从denier、图高、alpha或肉眼补默认。

## 10. Legacy

| 项 | 分类 | 当前消费者 / 为什么存在 | 移除前提 |
|---|---|---|---|
| primary ply color/diameter/texture/lengthScaleY | ACTIVE AUTHORITY（compat模型） | Pattern预览、无字段Asset fallback、旧包 | 逐字段迁移、旧包/无目标等价性；不能直接删 |
| companion enabled/color/diameter | ACTIVE AUTHORITY（条件显示） | 无显式完整材质的单slot及Pattern；不代表20D | 先明确strand/assignment迁移矩阵 |
| scan / old PBR / /48 repeat | COMPATIBILITY ONLY，仍活动 | 旧项目与Canvas/WebGL fallback | 颜色/物理标尺/后端兼容契约和真实旧包回归 |
| cmPer100Loops / 旧fixed24 sampler | DEPRECATED BUT USED（Legacy metric） | 侧栏基础统计/summary | 定义用途、命名/保留策略；不能盲合并UV sampler |
| solveSharedCoefficient / buildFeedYarnLengthDiagnostics | DEPRECATED BUT USED（test/reference） | 各自validator仍执行；非第二生产求解器 | 保留有价值数学断言后单独决定去留 |
| loadWorkspace | COMPATIBILITY ONLY / test入口 | State及sequence/structure tests | 查清外部caller/替换语义再改 |
| rowLengthLoopModel / ProcessModel / YarnModel | ACTIVE AUTHORITY（数学/拓扑） | 当前geometry、sampler、draw | 不是因名字旧就Legacy dead；没有移除证据 |
| th860 punchcard配置/导出 | ACTIVE AUTHORITY（独立旧导出域） | punchcard/settings/download | 与Single Jersey不是同一机器事实；需先确认产品范围 |
| queueSim局部值 | DEAD bookkeeping | 只有声明/赋false，没有读取；真正调度靠debounce | 独立最小清理即可，本轮不删 |
| drawRepeatLibrary / repeatLibraryDragInteraction | UNKNOWN / CANDIDATE inactive | src index注册均注释，静态入口不可达 | 查动态/外部消费者与保留意图；本轮不因rg无结果删除 |
| yarnScanTextureControls及私有导入控件 | UNKNOWN / CANDIDATE inactive UI subtree | 主panel不调用；guide/test仍引用符号/源码 | 区分隐藏UI与仍活动底层codec、旧包；不能成组删除纹理层 |

## 11. File Responsibilities

见 [architecture-map.md](architecture-map.md) 的23文件完整LOC/AST函数/Imports/ImportedBy/Responsibilities/Cohesion/Risk表；原始94模块图见inventory.json。

FACT：最大translations为973行静态字典/0函数，未发现混入Solver/State职责；index140行/29imports是组合根；view93行/19imports亦为页面组合。state214行却有46个src入边，是修改影响面，而非仅按文件长度判断。geometry564行/59函数、simulate378行/50函数、editor438行/46函数分别有算法或流水线职责。没有一个已查文件同时独立定义Machine规则、求解、State事实和UI四套完整行为。

SUBJECTIVE / DESIGN OPINION：优先按可证伪契约收敛measurement、material backend与加载生命周期，不能先按行数拆成大量转发helper。未对所有算法做深度fuzz或浏览器性能benchmark。

## 12. Dependency Health

| 依赖 | 分类 | 真实用途 |
|---|---|---|
| @eastdesire/jscolor | REQUIRED | 两个活动调色UI |
| @fortawesome/fontawesome-free | REQUIRED | 本地离线CSS/图标 |
| @zip.js/zip.js | REQUIRED | 动态ZIP项目/原图保存读取 |
| d3 | REQUIRED | line/CatmullRom几何；测试path工具 |
| lit-html | REQUIRED | 模板/事件/live/ref/repeat等 |
| split.js | REQUIRED | index分栏交互 |
| vite | DEV_ONLY，位于dependencies | build/dev/preview/SSR测试；位置选择不构成现有故障 |
| gh-pages | DEV_ONLY | 既有deploy命令；本轮未部署 |

当前未发现可确认为UNUSED/OVERKILL/DUPLICATIVE的直接依赖，未建议删除依赖。替代与自写成本、bundle事实和限制见 [dependency-audit.md](dependency-audit.md)。没有Three.js依赖。没有做线上版本/CVE扫描，不能由本轮结果宣称依赖无漏洞。

## 13. Dead / Duplicate Candidates

inventory静态图未发现循环；index不可达模块仅旧repeat library两个文件。esbuild解析imports/exports、Acorn统计函数；import.meta.glob、HTML/CSS和外部消费者不在普通src边中。因此只作为候选，不等同dead证明。

同名samplePathData分别是旧固定弦采样与UV exact累计frame，不能盲合并。getNeedleTypeAtPosition只被arrangement测试调用，实际Domain内循环是当前authority；solveSharedCoefficient与lengthRatio helper是参考测试入口，不是第二活动Solver。utils.generateChart只简单overlay、活动components.generateChart调用buildChartFromRepeats做tile；名称接近但未发现两者同时驱动当前chart，属于旧export候选。

queueSim无读取已确认。buildYarnPathArcLength/modelPathArcLength两个全路径summary在每种diameter geometry主动算，返回后生产consumer未用、tests仍用；存在额外工作为FACT，影响帧时长/可节省多少为UNKNOWN，无性能数字。先记录诊断ownership/保留断言，不能据此大改或删整个数学模块。

全局debug d/Ctrl+A/数字快捷键有实际入口，**不是dead code**；问题是缺editable焦点边界（MAINT-010）。未找到当前重复的目标输入validator、完整机器解释器、preview聚合器或正式第二求解器。多函数本身不是重复authority。

## 14. New Developer Handoff Test

这是SUBJECTIVE / DESIGN OPINION的源码/文档接手模拟，不是真实新人计时实验，不编造分钟数。

| 问题 | 分类 | 可找到的唯一答案 / 歧义 |
|---|---|---|
| A 输入23→Geometry | HARD | editor61→action207→runner213/288→simulate178→Solver107↔evaluator372→应用300→draw；跨失效/cache/应用多个seam，但调用图可追踪 |
| B Feed3第二纱Asset | MODERATE | feeds[2].yarns[1].yarnId→library；明确asset身份唯一，不能用companion标签代替；无第二槽则不存在 |
| C Cam变化→K/T/M | EASY | action→runner→resolveSingleJerseyOperations72–89→Adapter；没有第二规则 |
| D 直径来源 | MODERATE | resolver Asset→primary→default；需懂slot/course profile及model unit，真实实测未知 |
| E PBR来源 | MODERATE | Asset map整组优先/Legacy整组fallback→registry/brush；最终backend采用需另观察 |
| F 谁决定CONVERGED | EASY | solveFeedYarnLengths；resultFromCandidate检查status/error；不是UI决定 |
| G 谁决定最终显示值 | AMBIGUOUS（必须先定义“值”） | feedback显示Solver候选；侧栏是base metric；实际几何是成功paths或base fallback；没有统一的“最终实际几何纱长”公开值 |
| H 保存哪些authority | MODERATE | getProjectData明确11字段；package只检查必需字段不滤额外键；旧Pattern-only合并与完整替换不同 |

结论仍为YES_WITH_DOCUMENTATION；当前docs已提供入口/问题边界，本报告补明旧source简称与容易误读的helper。工艺UNKNOWN需要工艺资料，不是依赖原作者私下解释的架构知识。无证据支持无条件YES或全仓不能接手的NO。

## 15. Test Coverage Semantics

完整37项逐项分类、运行方式、实际保护内容见 [validator-map.md](validator-map.md)：INPUT SAFETY、STATE CONSISTENCY、DOMAIN、SOLVER NUMERICS、PERSISTENCE、RENDERER、PBR、LEGACY COMPATIBILITY都有实际保护；真实BUSINESS SEMANTICS仍待工艺确认。不是只报37项的一个数字。

**本轮validate=36/37，exit1**，唯一失败为row-length-loop-model里的文档标题regex。该MD调整在本轮初始快照中已存在，来自上一轮文档收敛；测试未改，HEAD旧文档可匹配。数学/行为assert与文档精确结构混绑，是维护债，不能直接把失败说成Solver回归。本轮按规则不修改源码、测试或已有文档让它通过。

validate.log还原样保留Vite/esbuild teardown阶段build canceled/on-resolve stderr；聚合器仅将上述断言计为失败，独立build成功，不删日志、不据未复现stderr断言另一个业务bug。build exit0（747 modules，3.06s Vite部分）；diff-check exit0。[validate.log](validate.log)、[build.log](build.log)、[diff-check.log](diff-check.log)

TEST PASS ≠ PHYSICAL CORRECTNESS；SOLVER CONVERGED ≠ PROCESS VALIDATED；NO CYCLIC IMPORT ≠ GOOD DOMAIN DESIGN；SMALL FILE ≠ MAINTAINABLE；LARGE FILE ≠ UNMAINTAINABLE；LEGACY ≠ DEAD CODE；MULTIPLE FUNCTIONS ≠ DUPLICATE AUTHORITY。

## 16. Ranked Risks

CRITICAL：**没有发现**。以下2 HIGH、4 MEDIUM、4 LOW；排序是设计判断，当前行为证据和替代解释逐项列出。所有建议均只登记C0契约/fixture/观测，未实施修复。

### MAINT-001 — Yarn Length Measurement / Acceptance

**Finding ID:** MAINT-001

**Type:** FACT

**Area:** Yarn Length Measurement / Acceptance

**Evidence:** `src/simulation/yarnPathGeometry.js:36-58,372-458,521-535`；`src/simulation/yarnLengthSolver.js:14-25,84-104`；`src/simulation/previewValidity.js:12-25`；`reports/maintainability-audit-current/length-probe.log`

**Current Behavior:** 当前源码原30×40/F8目标23，Solver=22.999733873且CONVERGED；对相同已求解路径的内部完整4针repeat独立积分=24.077277996 cm/100针。32×40对照为22.999580039 vs 23.701615835。结果未携带window/measurement-contract identity。

**Why It Matters:** 同单位不等于同业务区间；新增消费者仅凭solved/error/VALIDATED无法知道含顶边平均与内部repeat差异。风险来自测量契约缺失，不是另一个可编辑target或已证明生产数值错误。

**Risk:** HIGH

**Alternative Explanation:** Solver忠实优化当前有限周期函数；full-repeat不是已经确认的工厂authority，差异不能证明SOP错误。

**Recommendation:** P0-C0冻结当前两个窗口反例、记录basis/针区间/Feed/Yarn/边界/状态，设计observability；待工艺确认才决定canonical与实现。

**Confidence:** HIGH

### MAINT-002 — Pattern async load lifecycle

**Finding ID:** MAINT-002

**Type:** FACT

**Area:** Pattern async load lifecycle

**Evidence:** `src/actions/importers.js:127-140,148-166`；`src/actions/importers.js:164-166`；`reports/maintainability-audit-current/state-probe.log`

**Current Behavior:** loadProjectFile有projectLoadRequest generation检查；loadLibraryPattern只在promise完成后loadJSON。延迟库请求开始后执行New得到30×40，旧promise随后把chart覆盖为2×2，已用实际函数源码复现。

**Why It Matters:** 较旧的加载意图可以覆盖较新的设计/打开结果；同一项目替换业务存在两种异步提交规则。

**Risk:** HIGH

**Alternative Explanation:** 缓存的动态import经常很快，窄时序可能不明显；首次加载/慢网络仍是合法输入时序，不需要并发用户。

**Recommendation:** P0-C0保存deferred-promise场景及统一请求归属契约；后续独立小任务复用既有generation保护，不全面重构加载。

**Confidence:** HIGH

### MAINT-003 — UI state leaks into Project yarnSequence

**Finding ID:** MAINT-003

**Type:** FACT

**Area:** UI state leaks into Project yarnSequence

**Evidence:** `src/actions/importers.js:101-110,148-159`；`src/actions/repeatDimensions.js:41-44`；`src/actions/yarnSequenceRows.js:64-71`；`src/events/colorSequencePointerInteraction.js:11-13`；`src/components/yarnSequenceCanvas.js:33-44`；`reports/maintainability-audit-current/state-probe.log`

**Current Behavior:** activeYarn=2时New或加载单颜色Pattern后仍为2；新增行和brush可把索引2写入只有1个颜色的yarnSequence，palette[2]为undefined。

**Why It Matters:** UI选择未随被替换的palette约束，污染后续持久化项目数据；不同绘制路径会出现各自fallback。

**Risk:** MEDIUM

**Alternative Explanation:** 保留用户选择可以是设计，但新palette中不存在的索引不是合法可保留选择。

**Recommendation:** P0-C0记录palette替换/删除/resize的有效索引不变量与反例，后续限定在边界修复；不重写GLOBAL_STATE。

**Confidence:** HIGH

### MAINT-004 — Renderer / implicit Legacy strand policy

**Finding ID:** MAINT-004

**Type:** FACT

**Area:** Renderer / implicit Legacy strand policy

**Evidence:** `src/simulation/yarnTextureBrush.js:125-138`；`src/simulation/drawYarnSimulation.js:43-77`；`docs/LEGACY_MAP.md`

**Current Behavior:** 一个无材质字段的显式slot仍可额外画enabled Legacy companion；只给该Asset加color/diameter/repeat/map任一字段就使assetMaterial=true，Renderer抑制companion并绕过该ply sequence mask。多slot时显式槽位仍独立。

**Why It Matters:** 可见strand数量和行色策略依赖材质provenance，而非仅依赖Feed assignment；新人只改材料字段可能改变显示纱数。

**Risk:** MEDIUM

**Alternative Explanation:** 这是已有且部分文档化的兼容策略，保护旧项目并避免显式多纱重复；不等于工厂实际纱数已被证明错误。

**Recommendation:** P0-C0冻结单slot/多slot/有无Asset字段/companion/mask矩阵，说明显示策略owner；不删除Legacy或另建Renderer。

**Confidence:** HIGH

### MAINT-005 — Renderer material semantics differ by backend/cache

**Finding ID:** MAINT-005

**Type:** FACT

**Area:** Renderer material semantics differ by backend/cache

**Evidence:** `src/simulation/yarnUvWebglRenderer.js:132-144,235-247,332-339`；`src/simulation/yarnTextureBrush.js:66-101,160-182,195-215`；`src/simulation/drawYarnSimulation.js:160-196`；`src/views/yarnPlyPanel.js:386-458`；`reports/maintainability-audit-current/material-probe.log`

**Current Behavior:** 合法Legacy textureStrength=0在实际drawStrip中被||.75变为uniform .75；useOriginalColor=false仅准备tintedCache而WebGL仍读raw imageCache，冷/热缓存行为不同。Legacy非零sequence mask在Canvas是multiply/.38，在WebGL直接替换tint。

**Why It Matters:** 同一材料记录可随backend或cache历史产生不同可见结果，resolver的唯一字段source并不足以回答最终颜色。

**Risk:** MEDIUM

**Alternative Explanation:** Canvas允许降级且不必完整PBR等价；但把有效0改为.75是确定参数语义差异。旧scan控件当前隐藏，问题仍适用于导入的Legacy记录，不声称现在有活动slider入口。

**Recommendation:** P0-C0记录后端能力/颜色/参数矩阵、零值与冷缓存反例和显示来源；后续最小修复复用现有Renderer，不以PBR掩盖中心线。

**Confidence:** HIGH

### MAINT-006 — PBR replacement / physical scale ownership

**Finding ID:** MAINT-006

**Type:** FACT

**Area:** PBR replacement / physical scale ownership

**Evidence:** `src/actions/yarnLibrary.js:54-78`；`src/yarnTexture/yarnScanTexture.js:263-264`；`src/simulation/yarnPathUvStrip.js:42-63`；`scripts/validate-yarn-material-authority.mjs:164-173`；`reports/maintainability-audit-current/material-probe.log`

**Current Behavior:** importPbrFiles输出maps/preview，importYarnPbr整组替换pbr，连已有22.987mm repeat也移除；随后UV使用/48模型单位fallback。实际action+importer fixture已复现属性移除。

**Why It Matters:** 图像组替换同时改变物理纹理标尺，当前缺少明确的保留/清除验收契约；现有测试在替换前检查repeat，替换后未锁定该政策。

**Risk:** MEDIUM

**Alternative Explanation:** 换图时清除旧标尺可能是正确策略，因为新图尺度不同；不能直接保留旧repeat，更不能猜新默认值。是否应保留属UNKNOWN产品策略。

**Recommendation:** P0-C0明确replacement对maps、repeat、证据来源和反馈的契约，记录无标尺状态；不改PBR或给新图自动套22.987。

**Confidence:** HIGH

### MAINT-007 — Validator coupling to documentation/implementation shape

**Finding ID:** MAINT-007

**Type:** FACT

**Area:** Validator coupling to documentation/implementation shape

**Evidence:** `scripts/validate-row-length-loop-model.mjs:277-312`；`KnitScape_当前功能与算法.md:232`；`reports/maintainability-audit-current/validate.log`；`reports/maintainability-audit-current/checks.json`

**Current Behavior:** 37项完整validate仅row-length-loop-model失败：要求文档标题为当前验证结果，而现有标题为软件基线与验证边界。该标题改动在本轮初始hash中已存在；测试本身相对HEAD未改。另有regex固定eager summary具体写法。

**Why It Matters:** 数学验证与无关标题/实现形状绑在一起，合法文档/保持行为的维护改动也能让整套回归失败，降低新人对测试失败语义的判断效率。

**Risk:** LOW

**Alternative Explanation:** 检查技术文档结构和必需观测能力有价值；问题是绑定精确标题/表达式而非所需契约，不是所有静态测试都无效。

**Recommendation:** P0-C0登记失败归因和所保护的真实断言；单独确定后续测试职责拆分。本轮保留失败，不改源码、测试或旧文档让它变绿。

**Confidence:** HIGH

### MAINT-008 — Developer code-guide portability

**Finding ID:** MAINT-008

**Type:** FACT

**Area:** Developer code-guide portability

**Evidence:** `src/codeGuide/codeGuideMap.js:4,19-24`；`src/codeGuide/codeGuideOverlay.js:212`；`scripts/validate-code-guide.mjs:704-713`

**Current Behavior:** Code Guide生成VS Code链接的根路径硬编码为C:/Users/liuchen/Desktop/GitHub/knitscape；实际仓库在Desktop/knitscape，当前对应runSimulation文件在硬编码位置不存在。validator固定断言旧根路径。

**Why It Matters:** 新人沿界面源码定位会跳到错误位置，源码与通过的guide测试共同保留了机器本地假设。

**Risk:** LOW

**Alternative Explanation:** 可能曾服务原作者另一checkout；在当前仓库与其他开发机上不是可移植位置。只在guide模式影响开发导航，不影响K/T/M。

**Recommendation:** P0-C0记录当前根路径与guide约定，交接使用仓库相对路径；后续单独处理导航配置，不扩成新框架。

**Confidence:** HIGH

### MAINT-009 — Measurement metadata observability

**Finding ID:** MAINT-009

**Type:** FACT

**Area:** Measurement metadata observability

**Evidence:** `src/simulation/yarnPathGeometry.js:437-442`；`scripts/validate-yarn-length-gauge.mjs:212-230`；`reports/maintainability-audit-current/length-probe.log`

**Current Behavior:** 周期内部实际按P针归一化，外层measuredNeedleCountByCourse却记pattern.width。32针4周期对照字段显示32，实际周期窗口P=4；纯K时P可为1。

**Why It Matters:** 名为measuredNeedleCount的值不能还原真实采样窗口，后续diagnostic/contract消费者容易误读；现有测试把width当预期。

**Risk:** LOW

**Alternative Explanation:** 该字段可解释为等效输入窗口标签；目前未发现它被Solver当错误分母，当前归一化结果仍按P计算。

**Recommendation:** P0-C0在观测契约分开标有效width、实际P、区间、course次数；先文档化兼容含义，不改分母迎合目标。

**Confidence:** HIGH

### MAINT-010 — Global shortcut / editable focus boundary

**Finding ID:** MAINT-010

**Type:** FACT

**Area:** Global shortcut / editable focus boundary

**Evidence:** `src/events/keypressEvents.js:4-7,31-35,41-59`；`src/index.js:56-65`

**Current Behavior:** 全局keydown不检查input/textarea/contenteditable；在编辑框按Ctrl+A会preventDefault并只console.log，键入d可切debug，数字键可改activeSymbol。

**Why It Matters:** 表单编辑与全局工具行为交叉；新人调输入行为会碰到看似无关的事件层，用户的普通选择文本动作受影响。

**Risk:** LOW

**Alternative Explanation:** 全局快捷键是设计意图，但editable焦点是否应例外没有契约；debug存在不等于死代码。这里是source/event条件证明，未冒充本轮浏览器交互。

**Recommendation:** P0-C0记录键盘焦点矩阵与输入场景，后续局部事件边界任务处理；不为此重构UI或删除调试工具。

**Confidence:** HIGH

## 17. What NOT To Refactor Yet

- 不重写Machine Domain/Adapter、Pattern/排针/Cam边界；它们有单一入口和有价值回归。
- 不合并所有长度函数或删一个sampler就宣称canonical；不同区间/单位/精度目的需先说明，七问前不选生产定义。
- 不因Legacy存在删除primary/companion/scan/旧JSON；兼容条件已有真实消费者。旧helper先查tests/动态引用。
- 不重写GLOBAL_STATE、引入Command Bus/Event Sourcing/全仓assignmentId或第二Renderer/Simulation。确认的加载边界漏洞不需要这种规模。
- 不因translations973行、D3 namespace、字体/ZIP体积就拆文件或删依赖；没有性能/职责失衡证据支持。
- 不改Solver bounds/tension/diameter/PBR来让8收敛，不启动Material迁移、YarnTopology/3D/relaxation、UI重构或P1/P2。
- 不修现有测试/文档标题来粉饰本轮validate失败；明确归因后停止。

## 18. Recommended Next Actions

仅P0-C0：

1. 复核本报告20项authority，特别是正式export投影与package必需字段检查的区别；用当前源码条件更新接手知识，保留HEAD/dirty快照区分。
2. 冻结本轮length/state/material反例及stub边界；把测量basis/window/P/Feed/Yarn/状态、后端/缓存和加载generation纳入可观察清单，不修Solver。
3. 为Legacy strand/mask、PBR replacement标尺和palette有效索引明确行为契约；区分已有兼容决定与真实bug，后续修复单独授权小范围任务。
4. 记录validator中数学/状态断言与实现形状/文档结构检查的职责，不修改现有测试使本轮通过；保留现有37项保护价值。
5. 继续收集七个工艺问题的答案；未答前Business Validation=PENDING/UNKNOWN。不得因本轮结构审计而开启canonical实现或生产校准。

Verdict：可维护，主要需要局部Domain/生命周期契约收敛；**不建议全面重构**。没有足够证据量化可删代码/依赖数量，不虚报Lean节省。

Not checked：真实浏览器/GPU/移动设备矩阵、旧checkbox同页Load复验、真实机台/材料物理、CVE安全审计、所有数学算法深度fuzz与性能benchmark。核心活动路径已逐函数追踪，94个JS做静态图/函数库存；其余资产/旧导出并未逐分支证明无缺陷。

**最终范围核验：PASS。** [preservation.json](preservation.json)确认开工前1334个Git可见文件内容均不变，无删除或新增到报告目录之外的Git可见文件；HEAD、branch、index、refs及tracked diff均保持，git diff --check exit0。git diff --stat仍是原有17 tracked files、250 insertions、168 deletions，本轮新增untracked报告不在该统计中。明确允许的npm build重建了忽略的dist；未声称dist字节保持。

**business source changed = NO**。未修改现有测试、package/lock或已有MD；未stage/commit/tag，未开始P1/P2、Material迁移、Topology/3D、Solver/PBR/UI修复。所有新脚本、报告、数据和日志均在本目录。工作到此停止。
