# 裸氨纶工艺数据合同实施

日期：2026-10-20，Asia/Shanghai。阶段：P0-C2。以下软件结果来自本轮实际执行；工艺事实来源于用户确认，未冒充本轮现场测量。

## 1. 实施结论

代码实施完成；所有自动验证通过。**最终验收状态 BLOCKED**：真实浏览器的“导出下载 → 关闭页面 → 重开下载文件”步骤被浏览器已保存权限/受管理策略阻止。用户两次明确授权后工具仍拒绝访问该地址；没有改用其他浏览器、端口、CDP、后台导出或其它绕过方式。此阻塞不等于序列化或应用求解失败。

| 本轮检查 | 开工 | 完成 |
|---|---|---|
| 分支 / HEAD | main / `7ababf264d495f6b96d4d66652c529424938ac4d` | 相同 |
| npm run validate | 40/40 PASS | **41/41 PASS** |
| npm run build | PASS | **PASS** |
| git diff --check | PASS | **PASS** |
| 新增正式 src 模块 / dependency / Store / Manager / Solver | — | 均 NO |
| SOP主纱 / 氨纶 | 原始主纱包 | 8/8 + 8/8 CONVERGED |
| 历史主纱及同目标氨纶 M1/M3 数值漂移 | 对照已保存 | **0** |
| 真实浏览器 | — | 20项输入/模式检查、真实SOP16个结果通过；下载后重开受阻 |

基线证据：[baseline.json](baseline.json)、[baseline-git.txt](baseline-git.txt)、[baseline-package.json](baseline-package.json)、[baseline-working-tree.diff](baseline-working-tree.diff)、`baseline-files/`。记录了开工全部172个tracked文件哈希及1131个非忽略untracked文件清单/哈希。工作区不是干净HEAD。

开工npm首次因沙箱Node启动时 `EPERM lstat C:\Users\liuchen` 失败；在已有任务授权范围内使用命令审批重跑，得到40/40与build通过。没有把环境启动错误隐藏成源码成功，也没有将历史验证冒充本轮验证。

**审计差异**：现存落位审计末尾仍是 `NEEDS_DECISION`，并非题设的 `READY_FOR_IMPLEMENTATION`。本轮用户合同已明确项目版本/能力保护，故采用其授权方案。Assignment实际为Cam `feeds[].yarns[]` 对象，没有独立 `feedYarnAssignment.js`；扩展真实现有文件。旧文档“仅Markdown”属于2026-10-17任务，本次明确授权功能实施，不回退既有源码。

## 2. 最终数据合同

| 字段 | directTarget | relaxedWithDraft |
|---|---|---|
| lengthInputMode | `directTarget`；旧项目缺字段等价于该模式 | 必须为 `relaxedWithDraft` |
| yarnLengthCmPer100Needles | 唯一直接模型目标；旧0/null/空值归一化行为保持 | 不保存 |
| relaxedLengthCmPer100Needles | 不保存 | 可选未设置；存在时必须有限正数；cm/100针 |
| draftRatio | 不保存 | 可选未设置；存在时必须有限正数；无量纲倍数 |
| tensionCN | 保留既有独立记录 | 同左；不参与派生 |
| placement / yarnId | 保留既有语义 | 保留既有语义 |

缺失字段用“属性不存在”表示新模式草稿。新字段存在但为0、空串、null、非法字符串、负数、NaN、Infinity时导入拒绝。合法非激活字段被唯一归一化入口清除，非法非激活新字段仍拒绝，避免悄悄吞掉坏数据。旧无模式Assignment缺少旧长度字段仍按既有规则拒绝；显式directTarget允许目标缺失以表达模式切换后的未设置状态。

## 3. Authority表

| 事实或结果 | 唯一Authority | 消费者 | 是否持久化 |
|---|---|---|---|
| 当前模式及每路长度事实、实际倍率 | `singleJerseyCamProgram.feeds[f].yarns[y]` | actions、Simulation准备、反馈、保存 | 是，仅激活分支 |
| 字段归一化 | `yarnLengthInput.normalizeYarnLengthFields` | Cam归一化、批量预检、项目格式边界 | 不存规则副本 |
| 有效目标及来源签名 | `yarnLengthInput.resolveYarnLengthInput` | Simulation、反馈、批量候选校验、validators | 否 |
| 数值求解结果 | 现有 `yarnLengthSolver` | Simulation最终路径及反馈 | 否 |
| Machine K/T/M | 现有 `resolveSingleJerseyOperations` | 既有adapter | 原规则不变 |
| 张力 | Assignment的 `tensionCN` | 独立记录 | 是，不参与长度或几何 |
| SOP抽样±2% | 本Fixture工艺说明 | 工艺检验说明 | 不进入通用Project/Solver |
| Yarn身份/外观及既有材质参数 | 现有YarnAsset/材质解析 | 既有renderer/geometry消费者 | 本轮未改Asset合同 |

物理数据六项来源表见 [SOP-001-process-contract.md](SOP-001-process-contract.md)。没有虚构实测直径、弹性参数或逐路独立原始测量日志。

## 4. 长度模式

`setSingleJerseyFeedYarnLengthInputMode()` 在一次dispatch内切换模式、移除旧分支长度事实、清空SolverResults并设置DESIGN_PREVIEW。原23不复制成放松长度；8/3的24不写入直接目标。未完成的新模式显示“长度输入未完成”。切换及参数修改不改变结构revision。

切换为相同模式返回UNCHANGED，不抹除现有合法值。现有长度setter/clear编辑当前模式的长度；倍率有独立setter/clear。将新模式槽位换成另一根Yarn时清除旧放松测量和倍率，防止旧纱实测事实被误挂到新身份；旧直接模式的换纱行为保持。

## 5. 有效目标派生

唯一实现位置：[src/domain/yarnLengthInput.js](../../src/domain/yarnLengthInput.js)，`resolveYarnLengthInput()`。

它只读取长度事实，返回模式、直接目标、放松长度、倍率、有效目标、READY/NOT_SET/INCOMPLETE及inputSignature。仅这里实现放松长度乘倍率；src检索只有这一处乘法。

directTarget返回有效原目标；relaxedWithDraft在两个事实都合法时派生有效目标；缺失或非法值不回退旧值、不猜倍率。两个有限正数相乘仍可能溢出或下溢，编辑/导入/批量预检会拒绝非有限或非正乘积。

函数不读state/Asset/纱名/第二槽，不调用Solver，不处理张力和UI。24只存在于运行时结果和诊断报告。

## 6. 旧项目兼容

未带模式的单纱、多纱、第二槽、旧JSON/v2包、空/0直接目标及旧Feed结构均继续按directTarget处理。旧JSON输出顶层字段结构不加无用模式声明；直接模式项目包仍用v2。已有PBR二进制包和资产加载保护保持。

专项及全量验证覆盖旧输入/求解、旧多纱renderer、PBR往返、旧null/空串/0、项目完整/部分加载、过期异步加载和结构保护。真实历史主纱包在浏览器成功导入并8/8收敛；历史包哈希保持不变。

带运行时PBR assetRef的内存JSON不是可独立移动的二进制包；可移植保存继续使用已有`.knitscape`。此限制是已有合同，本轮未创建新的资产格式。

## 7. 项目版本/能力保护

复用现有 `format: "knitscape"` / `version`。

- 直接模式包：version 2。
- 含relaxedWithDraft的JSON及项目包，包括未完成草稿：version 3，`requiredCapabilities: ["relaxed-yarn-length-with-draft-v1"]`。
- 当前读取器兼容旧JSON及v2，接受匹配能力的v3；未知模式、未知未来版本/能力、新模式缺少标记、非法事实均明确拒绝。
- `prepareProjectForSave()` 用同一项目/Assignment事实白名单供getProjectData和包写入调用；过滤SolverResult、PreviewValidity、runtime revision和派生长度。
- `.knitscape`扩展名不变。新模式文件只能由支持该能力的版本编辑。

当前旧v2包读取器的版本检查能拒绝v3包，但无法追溯保证所有已发布旧程序的原始JSON入口拒绝新文件。新模式不保存旧直接目标或24，避免出现错误而看似可运行的降级目标。未来unknown capability不能被当前新程序默默接受。

## 8. Simulation接入

既有 `simulate()` 的输入准备先解析每个Assignment，生成数值目标表、requiredTargets及缓存来源信息。Solver调用仅接收临时 `{yarnLengthCmPer100Needles: effectiveNumber}` 视图，没有模式、倍率、纱种或第二纱分支。

每个结果关联 `lengthInput` 运行时来源对象，包含8、3、24及inputSignature。相同目标和直径可保留既有内部求解共享优化，但各槽仍有独立结果来源。

不完整的新模式槽位保留在requiredTargets中，不能因为其他槽成功而使整体假VALIDATED：有其他成功目标时为PARTIAL；全部未完成时为INVALID，逐纱显示长度输入未完成。旧direct未设置目标的DESIGN_PREVIEW等行为保持。

`runSimulation`、Machine Domain、adapter、Solver数学、Geometry公式、M1/M2/M3定义均未修改。

## 9. 缓存与结果失效

现有单条有界Solver缓存key增加完整解析输入，包含模式、直接目标、放松长度和倍率。`8×3 → 10×2.4` 即使目标仍24也产生不同key；重新求解和发布新来源。

所有合法参数action在同一次dispatch清空旧结果及有效性，既有runner继续触发重算。非法输入不dispatch、不清结果、不污染旧合法值。缓存命中仍按原规则重新检查路径应用。

Geometry缓存和材质缓存公式未增加倍率解释。未新增缓存系统。

## 10. 批量设置

复用原selection、structureRevision预检、一次dispatch原子提交。

| 选择 | 行为 |
|---|---|
| 全部directTarget | 保持旧批量直接目标 |
| 全部relaxedWithDraft | 批量设置放松长度，保留各路独立倍率 |
| 混合模式 | 整批拒绝，显示“所选纱线的长度输入模式不一致” |
| 选择后切换模式 | 捕获的mode不一致，整批拒绝STALE_LENGTH_INPUT_MODE |
| Assignment/revision过期 | 保留原stale保护，整批拒绝 |
| 任一目标非法或乘积溢出/下溢 | 整批零提交，保留旧结果 |

倍率只逐路逐纱编辑。参数编辑不递增 `feedYarnStructureRevision`；换纱/删除等结构行为仍使用旧revision语义。

## 11. 用户界面

只扩展现有Feed Yarn编辑区：模式选择、当前模式字段、两个独立Clear、只读织造状态参考长度和当前求解状态。完整输入显示 `8 × 3.0 = 24`。反馈增加模式/放松实测/倍率列，仍显示有效目标、Solver值和状态；结果关联同时比较来源签名。

新文案进入现有四语言i18n。中文包括“直接模型目标”“放松实测长度”“牵伸倍率”“织造状态参考长度”“长度输入未完成”。只增加适配现有列宽的少量CSS，无新页面/向导。

真实浏览器证据：[browser-input-checks.json](browser-input-checks.json)，20项通过，另有对应PNG；[完整SOP保存前快照](browser-sop-before-save.json)、[截图](browser-sop-before-save.png)证实16项CONVERGED及8条8×3.0=24。

输入脚本首次用fill倍率后Enter未触发真实键盘提交；改成与旧脚本一致的清空后逐字键入并重跑，20项通过。这个修正仅在浏览器辅助脚本，不用测试方式差异修改生产代码。旧/新PBR项目加载时曾出现浏览器命令超时，但返回DOM已VALIDATED；切到原有纯色模式后完成数值检查，没有修改渲染器。

**尚未通过的浏览器步骤**：原生导出下载及关闭页面后重新导入实际下载文件。工具首次拒绝下载，随后两次恢复页面也被拒绝，最后原文原因是“saved user permission setting / managed policy denies access”。用户已明确允许，但工具权限状态未放行。没有声称生成的自动Fixture等价于此次原生浏览器下载。此前读取的控制台error列表为空；权限封锁后的最终控制台无法再检查。

## 12. SOP-001结果

完整副本：[SOP-001-N6W6040-bare-spandex.knitscape](SOP-001-N6W6040-bare-spandex.knitscape)。附属规格和物理数据来源：[SOP-001-process-contract.md](SOP-001-process-contract.md)。原历史主纱Fixture未覆盖。

机器润山单面32英寸/32G/3216针/96口，8路循环重复12次，1234排针、真实4×8 Cam。现有预览尺寸30×40保持。每路主纱directTarget23、张力5cN；氨纶relaxed8/draft3、张力4cN。同Feed共享K/T/M。

| Feed | 主纱M1 | 氨纶M1 | 氨纶M3独立诊断 | 主纱/氨纶状态 |
|---|---:|---:|---:|---|
| 1 | 22.999920925128244 | 24.000753567866827 | 23.94798529180066 | CONVERGED / CONVERGED |
| 2 | 22.999922023878796 | 23.999598555905525 | 24.081417359063632 | CONVERGED / CONVERGED |
| 3 | 22.999921149748275 | 24.000755007335762 | 23.947987616300423 | CONVERGED / CONVERGED |
| 4 | 23.00029654221584 | 24.000680854420885 | 23.602061084127 | CONVERGED / CONVERGED |
| 5 | 22.99980858669455 | 23.999916116492383 | 24.051664192275073 | CONVERGED / CONVERGED |
| 6 | 22.99998733916666 | 23.9999440391594 | 23.92956157069609 | CONVERGED / CONVERGED |
| 7 | 22.999808732605086 | 23.9999151482471 | 24.051665451013104 | CONVERGED / CONVERGED |
| 8 | 22.999733873071612 | 24.00000471206136 | 25.16408312477409 | CONVERGED / CONVERGED |

单位均cm/100针；M1与M3窗口定义不同，M3不是已确认生产authority。所有应用结果满足原Solver内部数值容差 `0.00079375 cm/100针`；没有写入SOP±2%。与历史同目标M1/M3逐项精确相等，主纱对照也精确相等。

另验逐路不同放松长度/倍率、2.8/3/3.2、超出经验范围但数学合法的4/6/8，均按各自事实派生。旧直接8仍8/8 UNREACHABLE_TARGET，历史诊断数值保持。详细结果见 [sop-results.json](sop-results.json)。

## 13. 文件修改说明

以开工工作区为基准，修改21个现有文件，新增1个集成validator；报告/日志/Fixture/截图另计。下表每项均有本轮必要职责，未将长度派生复制到消费者。

| 文件 | 当前职责及本轮改动原因 | 修改可否避免 / 重复逻辑 |
|---|---|---|
| `src/domain/yarnLengthInput.js` | 长度校验；增加唯一互斥归一化、派生、来源签名 | 不可避免；唯一乘法Authority |
| `src/actions/singleJerseyCamProgram.js` | Cam/Assignment编辑；归一化保留新字段，模式/倍率/active长度原子提交 | 不可避免；调用Domain |
| `src/domain/yarnLengthBatch.js` | 原子预检；同模式、mode快照和各目标候选合法性 | 不可避免；调用Domain，无新批量系统 |
| `src/actions/yarnLibrary.js` | 赋纱；换纱时清除旧新模式测量事实 | 避免实测证据跨身份误用；不改Asset schema |
| `src/simulation/yarnSimulation.js` | Simulation准备/求解调用；统一目标、requiredTargets、来源和cachekey | 不可避免；不增加数学 |
| `src/views/singleJerseyCamProgramEditor.js` | 原逐路/批量UI；模式、字段、Clear、派生只读、状态 | 不可避免；复用actions |
| `src/views/yarnLengthSolverFeedback.js` | 当前事实与结果关联；展示来源并拒绝stale来源 | 不可避免；调用resolver |
| `src/i18n/translations.js` | 既有四语言文案 | 不可避免；没有硬编码新中文逻辑 |
| `styles.css` | 既有页面样式；模式选择/公式换行适配 | 为现有列宽所需；无新布局系统 |
| `src/actions/projectPackage.js` | 包和资产迁移；共享序列化白名单、v2/v3与能力guard | 不可避免；复用版本，不建第二格式 |
| `src/actions/importers.js` | 原子项目加载；提交前调用guard | 不可避免；无第二导入链 |
| `src/actions/exporters.js` | 项目快照/下载；JSON也使用共享序列化 | 审计原称原则上不用改；为原始JSON能力声明及唯一白名单必须改 |
| `scripts/validate-yarn-length-input-integration.mjs` | 输入/状态链；新增新模式、合法/非法、Clear、等积真实结果测试 | 必要；扩展原validator |
| `scripts/validate-yarn-length-batch-integration.mjs` | 批量原子性；新模式及最后目标失败 | 必要；扩展原validator |
| `scripts/validate-yarn-length-structure-integration.mjs` | 结构revision；参数不增、赋纱清事实 | 必要；扩展原validator |
| `scripts/validate-yarn-length-result-integration.mjs` | 结果反馈；来源匹配与未完成状态 | 必要；扩展原validator |
| `scripts/validate-multi-yarn-renderer.mjs` | 多纱运行链；目标传递、缓存和来源、不完整门控 | 必要；只观察既有Solver/renderer |
| `scripts/validate-pbr-persistence.mjs` | 项目包/PBR；v2/v3、非法导入、互斥事实 | 必要；扩展原validator |
| `scripts/validate-project-load-lifecycle.mjs` | 加载生命周期；JSON版本能力与无副作用拒绝 | 必要；此文件开工已untracked，原96项扩为105项 |
| `scripts/browser-yarn-length-input.mjs` | 可见UI回归；模式、新字段、Clear、等积、拒绝 | 必要；没有浏览器内写state |
| `scripts/validate-spandex-process-contract.mjs`（新增） | 真实SOP完整包、Machine→Simulation、历史M1/M3、双纱Fixture往返 | 唯一新增validator；原专项分别关注输入、批量或renderer，均不承担真实SOP包/历史独立积分跨链验收 |
| `package.json` | 新集成validator加入现有validate遍历 | 仅一条script；dependency不变 |

报告目录新增PLAN、本REPORT、SOP说明、项目副本、manifest、sop-results、基线副本、保护清单、红绿/终验日志和浏览器证据。保护证据见 [file-protection.json](file-protection.json)。唯一被修改的开工untracked文件为上述已授权扩展的load lifecycle validator；所有其他原untracked文件哈希不变。

Solver、Geometry、Metrics、Machine Domain、adapter、YarnAsset Domain、材质Domain、state、结构Domain、constants、package-lock与开工哈希一致。已有material/PBR等用户改动保留。未执行reset/checkout/stash/clean/commit/tag。

## 14. 测试矩阵

| # | 要求 | 证据与结果 |
|---|---|---|
| 1 | 旧直接目标行为 | 既有输入/结果/多纱专项、SOP主纱对照 PASS |
| 2 | 8×3=24 | 输入、运行链、SOP、浏览器 PASS |
| 3 | 八路独立 | SOP perFeed、批量专项 PASS |
| 4 | 各路不同倍率 | SOP perFeed PASS |
| 5 | 各路不同放松长度 | SOP perFeed PASS |
| 6 | 2.8/3/3.2派生 | SOP expectedTargets22.4/24/25.6 PASS |
| 7 | 非法倍率 | 输入/导入/真实浏览器六类非法值 PASS |
| 8 | 非法长度 | 同上 PASS |
| 9 | 明确Clear | Domain/action、浏览器独立Clear PASS |
| 10 | 双向模式切换 | 输入专项、持久化、浏览器 PASS |
| 11 | 保存加载 | 自动JSON/包/真实SOP往返 PASS；浏览器下载后重开BLOCKED |
| 12 | JSON导入 | load lifecycle 105/105 PASS |
| 13 | 项目包导入 | PBR持久化、SOP、真实浏览器导入 PASS |
| 14 | 同模式批量 | 直接/放松批量专项 PASS |
| 15 | 混合模式拒绝 | 批量专项 PASS |
| 16 | stale assignment | 既有结构revision＋新mode快照专项 PASS |
| 17 | 参数失效 | 输入真实结果、multi-yarn缓存、浏览器等积来源 PASS |
| 18 | 结构revision不变 | 输入/结构专项 PASS |
| 19 | 缓存签名 | 8×3→10×2.4实际Solver调用＋来源签名 PASS |
| 20 | 24不持久化 | JSON/包树检查与SOPmanifest PASS |
| 21 | 普通纱23无漂移 | 八路M1/M3、loopHeight、status精确比较 PASS |
| 22 | 氨纶24八路收敛 | SOP及浏览器16项反馈 PASS |
| 23 | 旧直接8诊断保留 | 八路UNREACHABLE_TARGET及历史M1/M3精确比较 PASS |
| 24 | 张力不参与派生 | Domain无张力输入、SOP有5/4且与历史无张力几何精确相等 PASS |
| 25 | ±2%不进入Solver | Solver哈希不变，SOP断言原0.00079375数值容差 PASS |

红绿日志证明新增核心行为在实现前失败：Simulation缺少24、包仍v2、缺少版本guard、旧换纱继承测量、混合模式未正确拒绝；完成实现后专项通过。浏览器脚本额外修正见第11节。

全量终验日志：[final-validate.log](final-validate.log)、[final-build.log](final-build.log)、[final-diff-check.log](final-diff-check.log)。另有专项日志及 [sop-replay.log](sop-replay.log)。使用verification-before-completion核对本轮输出，未以代理自报替代验证。

## 15. 明确未实现内容

不实现氨纶物理模型、弹性/张力/Relaxation、真实直径、双纱三维空间关系、幅宽/克重/耗纱、不改变M1/M2/M3、Machine Domain/Cam执行、Renderer/PBR边界、Undo范围、结构revision语义。未进入YarnTopology或三维。

倍率批量编辑未实现，按合同只支持逐槽倍率和同模式批量长度。无新增依赖、新Store、新Manager、新Solver或新正式src模块。

## 16. 剩余风险

1. **浏览器权限阻塞**：工具的保存设置/受管理策略持续拒绝本地地址访问和下载；实际浏览器导出文件重开尚未验收。自动包/JSON往返已通过，不能替代这项手动流程证据。因用户要求完整浏览器验收，最终标BLOCKED。
2. **模型≠实机**：M1收敛仅为现有模型窗口数值目标成功应用；Feed8氨纶M3仍为25.16408312477409，并未把它隐藏或改成24。需要后续测量与物理验证。
3. **数据来源范围**：当前SOP确认8/3及主纱23，但没有本轮新增逐路原始测量日志、静置时长/端部/仪器校准/真实直径。工艺合同建立不等于完整实机标定。
4. **旧客户端限制**：旧程序原始JSON入口可能忽略新字段；文件只能用支持新能力的版本编辑。本轮不实现有损向旧版导出。
5. **既有Undo边界**：Cam/Feed不在原Undo快照中，本轮不扩大。

```text
SPANDEx_PROCESS_CONTRACT_IMPLEMENTATION = BLOCKED
PROCESS_MEASUREMENT_CONTRACT = ESTABLISHED_FOR_SOP001
SPANDEx_PHYSICAL_MODEL = NOT_IMPLEMENTED
REAL_MACHINE_VALIDATION = PARTIAL
```
