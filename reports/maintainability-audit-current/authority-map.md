# Authority Map — Current Source, Not Historical Assumptions

FACT：branch main，HEAD7ababf2，另有初始dirty材料实现；具体文件hash见initial-state.json。表中Risk是SUBJECTIVE / DESIGN OPINION，以明确case为依据；NONE表示范围内没有发现冲突，不保证全系统无bug。Value的原始工艺来源与软件owner是不同问题。

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

## 读表规则与交叉验证

- Project字段即存放authority输入；Derived Functions列是计算逻辑，不是第二个可编辑事实。相同目标复制入SolverResult不构成双authority。
- 排针草稿与已应用数组、Cam草稿默认与工艺图转录、软件Feed循环与96实体口、chart.width与3216总针数必须分别解释。
- Gauge UI用normalizeMachineGauge；importers:60–63仅检查有限正数，故原始state值超120时消费端会clamp120。这是规范化边界需明确，非多处25.4公式失配；未作为当前SOP32G故障。
- `getProjectData()`显式投影正式导出。`PROJECT_FIELDS`只是validateProjectFields的必需字段列表，package内部`{...captured}`不自动丢额外键。当前正式调用没有runtime泄露证据；文档把package本身称“白名单过滤器”不精确，新调用者不能直接传GLOBAL_STATE。参见exporters:135–149、projectPackage:60–81。
- 当前docs的主线与核心owner说明有用，但不代替逐函数核对：docs/ARCHITECTURE与DOMAIN_AUTHORITY关于package白名单的简写应按上条理解；本轮只报告，不改已有文档。
- tension保存在assignment但不进入geometry；parallel字段是记录，现有绘制未按任意placement选择topology。真实材料路径、负载与测量语义UNKNOWN / PENDING PROCESS CONFIRMATION。

AUTHORITY唯一性较好的部分：机器规则、目标写入、输入验证、revision、成功状态聚合。最明显的交叉是measurement contract与Renderer内的Legacy strand/mask策略，不是全仓存在第二套Machine Domain。
