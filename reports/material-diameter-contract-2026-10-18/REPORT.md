# Material Diameter Contract

2026-10-18 · P0-C0 Correctness Preparation · main @ 7ababf264d495f6b96d4d66652c529424938ac4d，开工前工作区不干净。

执行清单（沿用用户指定设计，直接执行，不提交）：

- [x] 读取当前交接文档、实际 HEAD/status；保存开工文件指纹。
- [x] 追踪来源、单位、优先级、第二纱、Geometry/Solver/Renderer/cache。
- [x] 在已有 material validator 增加来源/单位断言并确认 RED。
- [x] 在已有 resolver 添加最小派生元数据，不改数值选择。
- [x] 扩展既有 SOP harness 诊断并输出到新目录，不覆盖历史结果。
- [x] 更新既有 authority 文档并完成本报告。
- [x] 跑 targeted、SOP、full validate、build、diff-check，对照基线与文件指纹。

## 1. Current Data Flow

**FACT**：审计对象为当前 main 加开工已有未提交实现，不能把 HEAD 单独称为全部实现或干净 baseline。[before-sha256.json](before-sha256.json)保存开工时所有 Git 列出的 tracked / nonignored untracked 文件指纹；源码改动基于工作区，保留原实现。

```text
YarnAsset.diameter（可缺失） ─────────────────────────────────────┐
                                                              ↓
项目 yarnPlies → import normalizeYarnPly → simulation normalizeYarnPlies
                                         ↓ 第一项启用 ply      ↓
                              resolveFeedYarnPlies → resolveYarnMaterial
                                         ↓ effective diameter / per-Feed×Yarn profiles
                                         ↓ buildYarnPathGeometry
                                         ↓ model-length evaluator → solveFeedYarnLengths
                                         ↓ profile/target/loopHeight cache
                                         ↓ final/base paths → Canvas/WebGL ribbon
```

缓存实际在计算前查找、计算后保存；图是依赖关系，不暗示 Solver 之后才检查 cache。无 Feed 的设计预览直接使用 normalized primary geometry；legacy companion 可单独绘制，但不自动等于第二个 Feed Yarn。

下表 Unit 的 `MNP` 均为 **MODEL_NEEDLE_PITCH**（第3节证据）。`G/S/R` 分别表示 Geometry/Solver/Renderer 消费；“间接”表示经过解析或投影。

| File | Field | Default | Unit | Validation | Writer | Reader | Fallback | Persisted? | G/S/R |
|---|---|---|---|---|---|---|---|---|---|
| src/domain/yarnLibrary.js | YarnAsset.diameter | 不补字段 | MNP | optional；有限正number；无上限 | 现有项目字段/加载；createYarnAsset不填；当前Asset编辑动作仅名称/分类，没有直径控件 | normalizeYarnLibrary、resolveYarnMaterial | missing→primary | YES，显式字段随library保存/加载 | YES/YES/YES，经resolver |
| src/constants.js、src/state.js | DEFAULT_YARN_PLIES[0/1].diameter、state.yarnPlies | primary .24 / companion .14 | MNP | UI range .06–.5 step .01；不是物性校验 | 初始化、新建、load、yarnPlyPanel.updateYarnPly、Undo | 两个normalizer、Simulation、renderer | 各索引默认值 | YES，yarnPlies也在snapshot字段中 | primary YES/YES/YES；companion通常仅R，若成为第一启用ply则G/S也消费 |
| src/yarnTexture/yarnScanTexture.js、src/actions/importers.js | normalizeYarnPly().diameter | source→fallback→.24 | MNP | Number coercion后有限正数；接受数字字符串 | 导入cloneYarnPlies | state、Simulation | fallback按索引选DEFAULT_YARN_PLIES；越界用primary | YES，归一化后成为项目ply | 间接/间接/间接 |
| src/simulation/yarnSimulation.js | normalizeYarnPlies、YARN_RATIO | .24 | MNP | Number coercion、过滤enabled=false；空/全禁用恢复默认 | simulate / yarnMaterialGeometryKey | primary、Feed adapter、Geometry | 每个非法项替换.24；选第一启用项 | NO，局部视图 | YES/YES/YES |
| src/domain/yarnMaterial.js | material.diameter | .24 | MNP | Number.isFinite且>0，不coerce | resolveYarnMaterial | Feed adapter、SOP诊断 | Asset→有效primary context→.24 | NO，derived；源字段另保存 | YES/YES/YES，adapter保留数值 |
| src/simulation/yarnTextureBrush.js | resolved Feed plies[].diameter | primary | MNP | 使用resolver；无Asset字段保留primary对象身份 | resolveFeedYarnPlies | Simulation profiles、draw | 每个缺失slot继承primary；不是前一slot Asset | NO | YES/YES/YES |
| src/simulation/yarnSimulation.js、src/simulation/yarnPathGeometry.js | diameterProfiles、primaryYarnDiameter、yarnDiameterForCourse | profile首值或active primary | MNP | 消费已解析值；Geometry不是公开输入validator | simulate，Geometry evaluator沿用profile | centerline、Solver callback、cache | 某course不存在该slot则profile取该Feed第一slot；Geometry callback空值则primaryYarnDiameter | NO | YES/YES/YES，经模型路径 |
| src/simulation/drawYarnSimulation.js、yarnTextureBrush.js、yarnPathUvStrip.js | lineWidth / yarnWidth / halfWidth、normalOffsetModel | 从effective直径计算 | 宽度canvas units；offset MNP | halfWidth=max(0,Number(yarnWidth)||0)/2；正常入口用有效值 | draw command/strip | Canvas stroke、WebGL mesh | 非Asset legacy视图沿用旧绘制路径 | NO | 不反写G/S；YES R |

搜索覆盖 src/scripts、现有SOP/probe及文档中的 diameter、yarnDiameter、primaryYarnDiameter、yarnWidth、YARN_RATIO、DEFAULT_YARN_PLIES、yarnPlies、YarnAsset、resolver、profile/cache。validator 中的 .20/.22/.30/.32/.40 等是合成测试输入，历史probe的 .24 是保存项目冻结输入说明，都不是新的真实材料来源。

## 2. 0.24 Source

**FACT**：四个当前定义点：`src/constants.js` 的 `DEFAULT_YARN_PLIES[0].diameter`；`src/simulation/yarnSimulation.js` 的 `YARN_RATIO`；`src/yarnTexture/yarnScanTexture.js` 的最终 normalization fallback；`src/domain/yarnMaterial.js` 的 resolver fallback。companion默认为 .14，默认禁用。

1. .24是primary默认及兼容几何比例，不是为N6/W或20D测得的材料字段。
2. 开工前这四个字面量旁没有mm注释；本轮只在resolver旁补模型单位解释。
3. `yarnPlyPanel.js`只显示“直径”和两位小数，没有mm/px标签。
4. Geometry用它作模型法线偏移直径；Renderer按stitchWidth缩放宽度。
5. 进入Geometry前不经过Gauge；模型路径长度进入Solver单位换算时才用Gauge。
6. 它属于针距归一化模型坐标单位，详见第3节。
7. 当前main祖先 `7cc649d`（2023-10-08）已定义 `YARN_RATIO=0.24`，历史代码以 `stitchWidth*YARN_RATIO` 使用；`c302933`（2026-07-14）加入DEFAULT_YARN_PLIES primary .24。只证明软件历史，不证明原作者选值的物理依据。
8. 开工validator有以.24作fixture的行为验证，SOP observability精确基线锁定该项目结果；本轮增加resolver默认精确等于.24的断言。
9. 在当前源码、交接文档及SOP证据中未找到实测来源：**0.24 = SIMULATION / LEGACY DEFAULT；is measured = NO**。

六项来源记录：Value=.24；Unit=MODEL_NEEDLE_PITCH；Source=软件默认/已保存legacy primary；Principle=历史模型比例及法线偏移；Confidence=软件值确认、物理未标定；Applicable state=software model only，真实负载/静置/finish状态UNKNOWN。

## 3. Unit

**DIAMETER UNIT = KNOWN(MODEL_NEEDLE_PITCH)**，不是猜测mm/px。

- `yarnPathGeometry.js:DEFAULT_YARN_MODEL_GEOMETRY.needlePitch=1`；`layoutNodes()`中`modelX=(i/2)*needlePitch`。
- `getBasePointPosition()`中的模型点偏移为 `x=modelX+(diameter/2)*normal[0]`，y同理。因此diameter和modelX/modelY在同一坐标尺度。
- `modelToCanvasPoint()`以`stitchWidth`投影模型点；绘制宽度`lineWidth=stitchWidth*diameter`，两条消费链一致。
- `yarnLengthMetrics.js:gaugeToNeedlePitchMm=25.4/Gauge`，`modelLengthToMm=L*(25.4/Gauge)`；`yarnLengthSolver.js:resultFromCandidate()`将模型长度换成mm，再除10输出cm。没有把diameter输入直接当mm。

**INFERENCE / DERIVED MODEL SCALE**：若仅解释该模型坐标在32G下的名义尺度，`.24*25.4/32=.1905 mm`。这是模型尺度换算，绝不等于真实纱线的测量直径；本轮未把该推导值写入Asset或改变Gauge。

## 4. Asset Explicit Diameter

**FACT**：`normalizeYarnLibrary()`已经存在validator，diameter optional。null/undefined被省略；0、负数、NaN、±Infinity、数字字符串均抛TypeError。合法范围是有限number且>0，无物理上限合同；UI的.06–.5不是Asset validator范围。

有效Asset值拥有最高优先级，即使primary改变也不影响它。若绕过library validator直接调用resolver，非法Asset值会fallback；这不意味着正常加载接受非法Asset。export/package/load保留显式diameter，缺失仍缺失。已有package roundtrip断言保留，新增派生元数据不得入包的断言。

Asset explicit 的单位由消费者合同确定为MNP；字段没有测量仪器、批次或负载证据，**ASSET_EXPLICIT ≠ MEASURED**。真实数值、方法和状态仍UNKNOWN。

## 5. Legacy Fallback

**FACT — resolver priority**：

1. `Number.isFinite(asset.diameter) && asset.diameter>0` → Asset值 / `ASSET_EXPLICIT`。Asset身份拥有材料的现有代码意图有注释证据。
2. 否则有效 `legacyContext.diameter` → `LEGACY_PRIMARY`。所有当前正式调用来自primary；保留旧项目/no-data preview与Solver几何。为什么所有slot都选primary而不是按slot选companion，没有工艺依据，标为 **UNSOURCED COMPATIBILITY BEHAVIOR**。
3. 否则 `.24` → `DEFAULT_COMPATIBILITY`。维持无数据时的可运行模型，不补“实测”。

**前置归一化**：导入 `normalizeYarnPly` 的source→按索引fallback→.24；simulation `normalizeYarnPlies` 先过滤disabled，再为非法/缺失值补.24，选择第一启用项作primary。若原第一项禁用，下一启用项可成为primary；无项/全禁用则构造.24。

因此`LEGACY_PRIMARY`只表示resolver的**直接**输入来源，不能区分该值是手动输入还是前置normalizer补成的。现有项目没有这种上游历史，不能根据“恰好等于.24”重建来源；文档明确默认本身的兼容身份。未新建持久化origin字段。

现有adapter在Asset完全没有任何材质字段时返回原primary对象以保持旧行为；不强行给这种view附加metadata。调用同一resolver即可获得诊断来源，SOP走此路径，避免改变renderer的对象身份判断。

## 6. Second Yarn Behavior

**FACT**：回归构造同Feed的A explicit .20、B missing；primary .28/.36、companion .14。B分别用.28/.36，不是A的.20，也不是companion .14。完整simulate测试另验证B缺失时其centerline/Solver随primary变化，而A的结果不变。

结论为 **CURRENT COMPATIBILITY BEHAVIOR**，不自动判BUG。没有“第二纱应该使用自己的legacy ply”的来源证据，采用用户决策树 **BRANCH C + D**：保留fallback和.24；补来源、单位、文档、验证。**SECOND_YARN_DIAMETER_FALLBACK = NEEDS_CONTRACT**。

## 7. Geometry / Solver Consumers

**FACT**：`resolveFeedYarnPlies`→`diameterProfiles`→`buildYarnPathGeometry(yarnDiameterForCourse)`→法线偏移→模型path及arc length→`createModelLengthEvaluator`→Solver `buildGeometry(loopHeight)`。Solver没有独立解释材料直径；输入几何已经携带逐Feed/逐纱直径。显式diameter导致不同中心线，既有测试和新增A/B变更测试均验证，不只是ribbon不同。

Canvas使用`stitchWidth*diameter`；WebGL strip使用该宽度及由各slot直径累计得到的parallel offset。No-Feed设计预览使用normalized primary；legacy companion的显示开关与真实第二纱assignment不是同一语义。未修改任何Geometry/Solver/Renderer公式、objective、loopHeight范围、Gauge或Machine Domain。

## 8. Cache Key Audit

**PASS，保留现有实现**：

| Cache / reuse | Key的有效直径部分 | 证明 |
|---|---|---|
| runner invalidation | yarnMaterialGeometryKey中的逐Feed×Yarn diameters；无Feed时primary | 已有runner变更diameter使结果失效，颜色/PBR不失效的集成测试 |
| geometryByProfile | JSON.stringify(profile) | 不同纱径profile不共用中心线 |
| solverResultCache | primaryYarnDiameter + diameterProfiles（另含pattern/gauge/targets等） | Asset或fallback primary变化触发solve；结果路径实际变化 |
| 同target复用 / groups | [target, diameterProfile] / diameterProfile | 目标相同但直径不同不错误共享 |
| solverGeometryByHeight | [diameterProfile, loopHeight] | profile变化不能复用其它直径的候选 |
| UV strip / mask batch | lineWidth；strip另含normalOffsetModel、slot/link、UV尺度 | lineWidth=stitchWidth*diameter；每次simulate建新strip Map |
| texture image / tint / GPU image cache | 图像source、tint等，不含diameter | 缓存图像而非几何，不应因直径重新加载图像 |

新增断言还确认：LEGACY_PRIMARY .30→ASSET_EXPLICIT .30时有效输入相同，Solver不重跑、数值结果完全相等。provenance无需进入数值cache key。

## 9. SOP-001 Effective Diameters

当前 [SOP-COMPARISON.md](SOP-COMPARISON.md)、[results.json](results.json) 由原harness生成；旧comparison REPORT/results、原probe和baseline未改写。运行：

```powershell
node reports/sop-001-business-comparison-2026-10-18/comparison.mjs --output-dir=reports/material-diameter-contract-2026-10-18
```

| Yarn | Effective | Unit | Direct source | Measured | Applicable state |
|---|---:|---|---|---|---|
| N6/W(6040) | .24 | MODEL_NEEDLE_PITCH | LEGACY_PRIMARY | UNKNOWN / null | 原保存主纱fixture |
| 20D LOW | .24 | MODEL_NEEDLE_PITCH | LEGACY_PRIMARY | UNKNOWN / null | SYNTHETIC_DIAGNOSTIC_ONLY；原保存包没有该Asset/assignment |

Source为当前resolver；principle为primary兼容几何偏移；confidence为软件值确认/物理未验证。**SAME EFFECTIVE VALUE ≠ SAME REAL DIAMETER**。

**NO NUMERIC DRIFT**：原probe对4场景48条记录执行精确deepEqual，所有值、状态、course、reachable range与基线完全一致；expected未修改。[sop-comparison.log](sop-comparison.log)及results.replay.logs保留证据。以下只摘Feed8：

| 场景 | M1主纱 | M2共享预览 | M3主纱最终 | 第二纱candidate minimum | 第二纱最终M3 |
|---|---:|---:|---:|---:|---:|
| 30×40 | 22.999733873071612 | 24.792732967754105 | 24.077277996023067 | 13.208564709238436 | 27.065709703853738 |
| 32×40 | 22.999580039157998 | 24.805103332682666 | 23.701615834833103 | 13.320235619565775 | 27.065709703853738 |

M1/M3和candidate minimum为各自既有窗口下cm/100 needles；M2为共享cm/100 loops，非每纱测量。23/8目标保持；第二纱仍UNREACHABLE_TARGET且候选不应用。业务对比仍NOT_COMPARABLE。

## 10. Changes

本轮仅改四个已有文件，另增本报告目录：

- `src/domain/yarnMaterial.js`：新增diameterSource和diameterUnit两个runtime字段，原数值field()、source枚举、PBR/颜色逻辑不动。`hasAssetFields`仍只读material.source，额外字段不改变其分支。
- `scripts/validate-yarn-material-authority.mjs`：扩展现有验证，不新增src module/validator架构。
- `reports/sop-001-business-comparison-2026-10-18/comparison.mjs`：现有resolver诊断加逐纱effective/source/unit/measured状态；增加可选新输出目录，保留原计算与expected。
- `docs/DOMAIN_AUTHORITY.md`：追加直径合同及证据。

new src module=NO；new dependency=NO；Project format changed=NO；new material architecture=NO；Geometry formula/numerical behavior changed=NO；Solver objective/numerical behavior changed=NO。Derived provenance不写入state/Undo/.knitscape；原source输入未突变。

未修改其它Material字段、Machine Domain、测量语义、真实物性、PBR physicalRepeatLengthMm、第二纱模型或YarnTopology。无commit/tag。

[preservation.json](preservation.json)对照开工1231个已有文件：只上述4个文件改变；unexpectedChanges=[]，新报告目录外新增文件=[]；历史results/baseline/probe/.knitscape保持原SHA-256。HEAD和main不变。不能用普通git diff把开工已有未提交内容算作本轮新增。

## 11. Regression

| Case | 断言 / 实际结果 |
|---|---|
| 1 explicit | ASSET_EXPLICIT / MODEL_NEEDLE_PITCH；实际中心线和ribbon均使用Asset值 |
| 2 missing | LEGACY_PRIMARY；无合法context则DEFAULT_COMPATIBILITY=.24 |
| 3 primary变更 | missing Asset的effective与Solver路径对应变更；cache失效 |
| 4 explicit隔离 | primary变更不改变explicit Asset结果 |
| 5 second missing | 继承primary，保留无字段adapter identity；不使用companion或A的explicit |
| 6 invalid | library拒绝0/负/NaN/±Infinity/string；null/undefined为missing；绕过validator的invalid Asset/primary仍与.24正常几何完全相等，结果有限正数且path无NaN/Infinity |
| 7 SOP | 4场景/48记录精确baseline equality，全部M1/M2/M3和范围无漂移 |
| cache与持久化 | 同值改来源不重算；项目包及可Undo的state plies不含派生字段 |

RED：新增ASSET_EXPLICIT断言得到undefined，exit1，[material-red.log](material-red.log)。GREEN：补元数据后通过，扩展invalid集成断言后再次通过，[material-green.log](material-green.log)。

开工full validate：38/39，exit1；唯一失败 `validate:row-length-loop-model`，既有当前功能文档缺少其regex期待的 `## 数字. 当前验证结果` 标题，[baseline-validate.log](baseline-validate.log)。不改标题迎合测试、不把基线失败隐藏成全绿。

| 本轮命令 | Exit | 结果/证据 |
|---|---:|---|
| npm run validate:yarn-material-authority | 0 | PASS，[material-green.log](material-green.log) |
| npm run validate:yarn-length-gauge | 0 | PASS，[yarn-length-gauge.log](yarn-length-gauge.log) |
| npm run validate:yarn-length-solver | 0 | PASS，[yarn-length-solver.log](yarn-length-solver.log) |
| SOP comparison（上述新输出目录命令） | 0 | PASS / MATCH，4场景48记录精确相等 |
| npm run validate（开工） | 1 | 38/39，仅既有row-length-loop-model标题断言 |
| npm run validate（最终） | 1 | 38/39，同一失败，[final-validate.log](final-validate.log)；New failures=0 |
| npm run build | 0 | PASS，[build.log](build.log) |
| git diff --check | 0 | PASS，[diff-check.log](diff-check.log)；另对4个任务文件和新MD做空白检查 |

Known baseline failure=`validate:row-length-loop-model`（文档标题regex）；New failures=0；Numeric drift=NO。完整验证不是全绿。Node/Lit开发模式提示、Git已有LF/CRLF提示不是新增测试失败。无测试断言被削弱。

SOP results.verification.mode=NOT_RUN只表示此次harness命令未加--verify，独立本轮测试日志在本目录；其preservation是“重跑harness期间”文件不变，不代表整个本任务没有源码改动。

## 12. What Is NOT Proven

**REAL_YARN_DIAMETER_VALIDATION = NOT_ESTABLISHED**。未证明任何真实纱径、两纱同径、0.24有物理来源、第二纱primary fallback符合工艺、M1/M2/M3哪一个是工厂authority，亦未证明23/8与软件窗口同义。软件回归PASS不能替代PROCESS/REAL MACHINE VALIDATION。

未从20D/denier、PBR图宽/alpha、照片、比例91.2/8.8或LOW名称推物性；未为了照片相似度调参。未做新的浏览器视觉验收或实机测量；renderer集成断言使用DOM/Canvas/WebGL doubles，数值计算用正式实现。Asset validator无upper bound的现状被记录，本轮不发明物理范围。

## 13. Remaining Data Needed

需要分别为两纱提供：材料/批次身份；真实Value与原Unit；可追溯Source；测量仪器、校准、截面/毛羽口径、取样数与推导方法；Confidence/不确定度；Applicable state（机上/带载/卸载/回缩/静置/finish、环境及负荷）。这些数据未齐时real diameter仍UNKNOWN。

还需产品/工艺确定第二纱缺数据时应采用primary、其自身legacy、独立默认或其它策略，及显式物理直径如何有据转换为当前MNP输入。当前不代做此决策，**SECOND_YARN_DIAMETER_FALLBACK = NEEDS_CONTRACT**。

**MATERIAL_DIAMETER_CONTRACT = PASS**（本轮软件来源/单位/兼容诊断合同；包含明确列出的既有suite失败，不是实物验证）。

**REAL_YARN_DIAMETER_VALIDATION = NOT_ESTABLISHED**

**SECOND_YARN_DIAMETER_FALLBACK = NEEDS_CONTRACT**
