# Current Architecture / Ownership — Audit Map

2026-10-17。FACT基于main `7ababf2` 加开工前dirty实现；不是只读HEAD源码的替代快照。按单人浏览器端设计工具判断负载，不假设多租户服务。全量源文件图见 [inventory.json](inventory.json)；没有因大文件或多import自动判坏。

```text
index.html → src/index.js → lit-html view + StateMonitor subscribers
                                    ↓ 用户事件
editor / view → actions → GLOBAL_STATE → StateMonitor
                 │           ├→ generateChart → buildChartFromRepeats → chart
                 │           ├→ runSimulation → base Pattern preview / sidebar metric
                 │           └→ runSimulation → createSingleJerseyExecutionInput
                 │                                  ↓
                 │                      resolveSingleJerseyOperations
                 │                                  ↓ K/T/M
                 │                      singleJerseySimulationInput adapter
                 │                                  ↓
                 │                       simulate → ProcessModel/YarnModel
                 │                                  ↓
                 │                       geometry / length evaluator
                 │                                  ↔ bounded length Solver
                 │                                  ↓ applied paths / result
                 │                       PreviewValidity / feedback
                 │                                  ↓
                 │                    drawYarnSimulation → UV strips / Canvas stroke
                 │                                  ↓
                 │                          WebGL shader / Canvas fallback
                 │
                 └→ getProjectData → createProjectPackage → project + original map assets

Feed assignment.yarnId → YarnAsset → resolveYarnMaterial → runtime material
                                             ├→ diameter profile → geometry / solver key
                                             └→ color / maps / repeat → renderer
```

## FACT：清楚的边界

- K/T/M规则只有 `singleJerseyMachine.js:72–89`；Renderer没有Cam或排针解释器。Adapter只做K/M/T→0/2/3，Pattern不因机器结果被写回。
- `getProjectData()` 是正式导出的项目事实投影；SolverResult/validity/revision/drafts不在其中。
- `prepareAction()` 独占revision生成，batch提交有统一结构/locator/值预检；不是多处独立生成assignment身份。
- Renderer资源cache没有向业务State反写；图片异步完成受stopped检查，求解缓存命中后重新计算applied标记。
- 当前只有XY/ribbon/layers，shader Z=0；Three.js不在package依赖或源import内。会Three.js不等于理解本项目的实际几何链。

## FACT：真实交叉点与风险

| 交叉点 | 当前实际决定 | 风险 |
|---|---|---|
| `drawYarnSimulation.rowYarnPly()` | 根据assetMaterial/slot数量决定是否额外绘制Legacy companion、是否使用sequence mask | Renderer参与可见strand数量策略，而不只是消费固定topology；MAINT-004 |
| `yarnSimulation()` | 组织图、逐纱profile、目标过滤/分组、solver cache、路径应用、异步绘制生命周期 | 同一流水线协调多事，但有清楚依赖；不能因378行就要求拆引擎 |
| `runSimulation()` | HTML预览容器/错误展示、几何失效key、调度、结果发布 | 生命周期与展示耦合；应先记录失效契约，不是复制machine authority |
| `yarnPathGeometry()` | 路径模板、坐标转换、基础统计、周期窗口evaluator、诊断summary | 测量定义缺独立契约；不同summary与目标不等义，MAINT-001/009/010 |
| `importers()` | 项目事实替换 + 部分UI reset + 多种异步加载 | New/Load activeYarn与library请求缺边界保护，MAINT-002/003 |

## State分层

| 层 | 实际位置 | 结论 |
|---|---|---|
| Project | State的Pattern/Repeat/plies/library/Cam/arrangement/Gauge | 共处容器不等于重复authority；正式出口明确 |
| Derived | chart、results、validity、路径与stats | results/validity不保存；chart设计尺寸保存，内容由repeats重建 |
| Runtime | revision、load request、solver cache、preview stop closure | 生命周期入口有保护，但library加载未用同一generation |
| UI draft | editor模块selection/filter/batch draft；State的pending/query/activeYarn等 | 不应反写成项目事实；activeYarn越界已有反例 |
| Renderer cache | brush image/tint cache、registry object URL、WebGL texture cache | 无业务反写；不同后端cache对legacy scan有差异 |

同步StateMonitor存在嵌套dispatch：早订阅者收到的原始snapshot可能仍带旧derived，后续runner才清理。当前UI在RAF回读GLOBAL_STATE，未发现因此向当前UI发布false success；未来同步derived消费者须注意，属INFERENCE维护风险，不冒充已发生的当前bug。

## 文件职责统计与判断

LOC为物理行，Imports为解析到的import/re-export边，Imported By仅src直接入边；函数数由Node自带Acorn AST计算，含嵌套callback/method。不能用这些数单独推断质量。

| File | LOC | Functions(AST) | Imports | Imported By(src) | Responsibilities | Cohesion Judgment | Risk | Evidence |
|---|---:|---:|---:|---:|---|---|---|---|
| `src/actions/importers.js` | 185 | 20 | 13 | 2 | 项目/Pattern验证、导入/新建、异步加载 | 有边界但UI索引/库请求漏保护 | HIGH | loadJSON/newPattern/loadLibraryPattern；MAINT-002/003 |
| `src/actions/singleJerseyCamProgram.js` | 268 | 34 | 5 | 3 | Cam和Feed目标mutation/normalization | 同一项目聚合内操作，未发现需要拆层的问题 | LOW | buildCamProgram/commitFeedYarnLength/setFeedYarns |
| `src/actions/zoomFit.js` | 115 | 7 | 3 | 12 | Canvas/view尺度和位置 | 显示变换聚合，非工艺规则 | NONE | fitChart/zoomSimulationAtPoint |
| `src/components/runSimulation.js` | 325 | 29 | 13 | 2 | 预览容器、调度、失效、结果发布 | 展示与生命周期协调；未复制Solver/Domain | MEDIUM | run/syncState/materialGeometryKey |
| `src/constants.js` | 82 | 0 | 1 | 17 | 默认值、符号、工具元数据 | 高fan-in合理；默认模型不可当实测 | LOW | DEFAULT_YARN_PLIES/SNAPSHOT_FIELDS |
| `src/i18n/index.js` | 58 | 7 | 2 | 22 | 语言选择/翻译接口 | 小接口高fan-in合理 | NONE | t/getInitialLanguage |
| `src/i18n/translations.js` | 973 | 0 | 0 | 1 | 四语言静态字典 | 最大文件是数据，没有混合求解/状态职责 | NONE | translations exported table |
| `src/index.js` | 140 | 6 | 29 | 0 | 应用组合/事件/订阅启动 | 29 imports符合composition root职责 | NONE | init/StateMonitor.register |
| `src/lib/bmp.js` | 402 | 11 | 0 | 1 | BMP编码库 | 算法/格式聚合；未因402行判坏，未做格式深度fuzz | LOW | bmp_lib |
| `src/simulation/ProcessModel.js` | 244 | 21 | 0 | 2 | 接触节点与针法过程 | 领域算法密集但职责集中 | LOW | ProcessModel |
| `src/simulation/yarnLengthSolver.js` | 247 | 18 | 1 | 3 | 有界标量数值求解与结果 | 局部逻辑清楚，测量契约外部依赖 | MEDIUM | solveFeedYarnLengths/resultFromCandidate |
| `src/simulation/YarnModel.js` | 301 | 12 | 0 | 2 | 节点追踪与yarn图 | 拓扑生成算法集中，无Renderer/State写入 | LOW | YarnModel/makeNice |
| `src/simulation/yarnPathGeometry.js` | 564 | 59 | 7 | 1 | 模板、坐标、测量窗、legacy/summary | 多种measure含义挤在一factory；先契约不是按行拆 | MEDIUM | build/createModelLengthEvaluator/buildYarnLengthMetrics |
| `src/simulation/yarnPathSampler.js` | 244 | 16 | 1 | 1 | 路径采样/累计弧长frame | 纯数学工具；旧同名sampler需说明用途 | LOW | samplePathData |
| `src/simulation/yarnSimulation.js` | 378 | 50 | 13 | 1 | profile、目标/缓存、求解应用、绘制生命周期 | 流水线复杂但有seam；没有一文件UI+State写入+Domain | MEDIUM | simulate |
| `src/simulation/yarnTextureBrush.js` | 281 | 26 | 3 | 4 | 材质适配、图片/染色cache、Canvas笔刷 | 适配/后端边界需补观察，非第二机器域 | MEDIUM | resolveFeedYarnPlies/prepareYarnTextureImages |
| `src/simulation/yarnUvWebglRenderer.js` | 424 | 18 | 1 | 2 | shader/GL资源/材质消费 | 参数语义分叉有case；GL封装本身合理 | MEDIUM | materialMaps/drawStrip/textureFromDataUrl |
| `src/state.js` | 214 | 15 | 6 | 46 | State容器、snapshot、revision、observer | 46入边是blast radius，不自动要求store重写 | MEDIUM | prepareAction/dispatch/StateMonitor |
| `src/utils.js` | 145 | 17 | 2 | 11 | 坐标、导出、图像、mobile检测等通用工具 | 杂项且有旧generateChart候选；目前不是第二活动生成器 | LOW | generateChart/buildImagePalette/posAtCoords |
| `src/views/singleJerseyCamProgramEditor.js` | 438 | 46 | 13 | 1 | Cam UI/目标草稿/batch选择 | UI复杂但mutation委托actions；未把业务写进模板 | LOW | commitYarnLength/batch selection |
| `src/views/view.js` | 93 | 2 | 19 | 1 | 页面组合 | 19 imports符合composition用途 | NONE | view |
| `src/views/yarnPlyPanel.js` | 458 | 33 | 8 | 1 | Legacy controls、hidden scan controls、调色 | 活动兼容与隐藏旧入口并存；需辨识，不直接删 | MEDIUM | yarnPlyPanel/yarnScanTextureControls |
| `src/yarnTexture/yarnScanTexture.js` | 447 | 31 | 1 | 8 | 规范化/导入/解码/scan处理 | 纯normalize与browser处理同module；有用途分界，无循环 | LOW | normalizeYarnPbr/importPbrFiles/processYarnScanDataUrl |

静态src ES module graph中未发现循环；这**不等于**Domain设计正确。动态pattern库由import.meta.glob提供，静态图不会展开它；无静态路径也不能直接判DEAD。

SUBJECTIVE / DESIGN OPINION：当前可维护，但测量/兼容与生命周期需局部收敛；没有全盘重构或新State/Renderer/Simulation框架的证据。PREDICTION：在增加同步消费者或新拓扑能力时，这些未写清的条件会增加修改风险；尚无风险概率或性能数字。
