# 未设置纱长的预览状态回归修复

日期：2026-10-21。范围仅为合法输入链中“没有有效纱长目标”的预览状态。历史穿插分类仍未解决，原几何审计总闸门保持 BLOCKED；本报告不替代氨纶数据合同最终验收。

## 1. 开工基线与修改范围

开工分支 `main`，HEAD `7ababf264d495f6b96d4d66652c529424938ac4d`，工作区已有大量未提交修改。开工 `git branch --show-current`、`git rev-parse HEAD`、`git status --short`、`git diff --check` 的记录及 151 个源码、验证器、依赖文件的 SHA-256，见 [开工快照](unset-length-baseline.json)。开工 diff-check exit0。151 个文件与上一轮快照逐项比较，没有后续变化。

本轮保留已有修改，未重新创建旧基线工作树，未 reset、checkout、stash、clean、commit、tag、安装依赖或全项目格式化。相对于本轮开工，产品及正式验证只修改三处：

| 文件 | 必要性 |
|---|---|
| `src/simulation/yarnSimulation.js` | 在唯一 `requiredTargets` 构造点增加参与 Feed 存在有效目标的前提 |
| `scripts/validate-yarn-length-input-integration.mjs` | 将实际 SOP 失败路径纳入正式 actions/state/runner 集成回归，补齐 A–L 与未使用 Feed 边界 |
| `scripts/validate-multi-yarn-renderer.mjs` | 仅同步原全不完整场景的旧INVALID断言为DESIGN_PREVIEW；保留全部原渲染、数值及mixed断言 |

该验证器原已由 `npm run validate` 执行，未改 `package.json`。没有新增源码模块、依赖、验证框架或独立正式验证器。本目录只新增本报告及必要基线、日志、浏览器记录和一张截图；旧报告、截图、路径数据保持原样。

关键开工 SHA-256：

| 文件 | SHA-256 |
|---|---|
| `src/simulation/yarnSimulation.js` | `90272553ec62fee654eb2933e94343c7ad6577764c148142ac4362b9eed3390b` |
| `scripts/validate-yarn-length-input-integration.mjs` | `b6c1b7b88832a0aa0d78fbd1ebf42a3dfc97fe5817b4e80126c48e04521ae45b` |
| `src/domain/yarnLengthInput.js` | `7ad706979eaecc7a004a741f168b07a32da7e1ae325f247e8810a0a2a44af1e7` |
| `src/simulation/previewValidity.js` | `f936e47e94c9470e4618eb8f654bd37a94090526b6d1b7d19cf9aa49b2722bdd` |
| `src/components/runSimulation.js` | `90902ffe5c07f7592763e030a9b39766348331a98cb1ee0907d701cd01532a2b` |

## 2. 原失败场景与独立错误排除

复用 [上一轮根因报告](stage-1-root-cause-and-fix.md)、`root-cause-regression.mjs` 的 A 场景、原 SOP 包及冻结 `root-cause-regression.json`。正式验证器读取同一 `SOP-001-N6W6040-bare-spandex.knitscape`，通过 `readProjectPackage → loadJSON → StateMonitor → runSimulation` 执行。

与原 A 完全相同的输入变更：删除每路主纱 `yarnLengthCmPer100Needles`，删除第二纱 `relaxedLengthCmPer100Needles`，保留两种显式模式及第二纱倍率 3。不是删除模式后换成另一场景。随后用正式 Clear 动作另外验证从成功输入撤销的路径；直接模式 Clear 按既有合同保存 0。

| 排除项 | 修复前实际证据 |
|---|---|
| 机器、Cam、排针 | 30×40、G32、4 Track×8 Feed、排针 `[1,2,3,4]`；正式 Machine Domain/adapter 正常返回，无机器错误 |
| Feed、纱线分配 | 8 路各 2 个 Assignment，所有 Yarn ID 均引用当前 Library；导入归一化成功 |
| 调色板、序列引用 | `loadJSON` 的正式原始序列引用校验通过，没有绕过导入 |
| 长度模式 | 主纱 `directTarget`，第二纱 `relaxedWithDraft`，均为合法模式；缺失字段允许保留未完成输入 |
| 真实异常 | 正式调用正常返回；机器错误元素为空且隐藏；没有 Solver ERROR |
| 旧结果残留 | 项目加载后结果集合为空；观察中 `solverInputKey=null`、`cacheHit=false` |
| 已设置但不可达目标 | 16 个有效目标均为 null；没有提交给 Solver 的有效目标 |

新增正式断言在 **flushTimers 后** 失败，实际 `INVALID`、预期 `DESIGN_PREVIEW`，exit1。详见 [修复前正式测试](unset-length-before.log)。未把提交动作瞬间的临时失效状态当成仿真最终结果。

## 3. 唯一真实调用链和错误首次出现位置

`Assignment事实 → resolveYarnLengthInput → simulate.lengthInputs / solverLengths → requiredTargets → solveFeedYarnLengths调用条件 → SolverResult → derivePreviewValidity → runSimulation发布 → yarnLengthSolverFeedback`

除正式集成测试外，复用上一轮只读观察方法，对开工源码快照和修复后源码各运行一次相同 A 输入，记录局部变量及真实 Solver 调用次数，未改写产品文件或公式。见 [前后调用链记录](unset-length-trace.log)。

| 环节 | 修复前 | 修复后 |
|---|---|---|
| Assignment 事实 | 8 个 direct 无长度；8 个 relaxed 无放松长度、倍率 3 | 相同 |
| 长度输入 Domain | 8×NOT_SET、8×INCOMPLETE，16×有效目标 null | 相同 |
| Simulation 输入 | `solverLengths=[[null,null],…]` 共8路 | 相同 |
| 实际参与 Feed | `[0,1,2,3,4,5,6,7]` | 相同 |
| `requiredTargets` | 8 个 `{feedIndex:0…7,yarnIndex:1,targetLengthCmPer100Needles:null}` | `[]` |
| Solver 调用次数 | 0 | 0 |
| 返回结果集合 | `[]` | `[]` |
| 缓存 key / 命中 | null / false | 相同 |
| `derivePreviewValidity` | 8 项要求、0 项满足 → INVALID | 无求解要求 → DESIGN_PREVIEW |
| 发布及界面 | INVALID，同时逐纱显示未完成 | DESIGN_PREVIEW，同时逐纱保留未完成 |

**错误首次出现于 `simulate()` 中 `requiredTargets` 的构造。** 原条件按 `relaxedWithDraft` 模式无条件保留 null 目标，本意是维持混合输入的 PARTIAL，却同时把全无有效目标的场景变成了“存在未满足的求解要求”。Domain 的 null 本身符合合同；Solver 未执行，也没有制造失败 SolverResult。错误是把合法缺失加入当前场景的验证要求，随后状态推导按该集合正确地得出了错误场景状态。

## 4. 最小修改及语义边界

在原目标收集点，以已派生的 `solverLengths` 和已有 `usedFeedIndices` 判断是否存在实际参与仿真的有效目标。若没有，`requiredTargets=[]`；若存在，继续使用原集合构造逻辑。

没有复制有效目标计算，未改 `resolveYarnLengthInput`、`normalizeYarnLengthFields`、`derivePreviewValidity`、Solver/cache、结果发布或界面。没有在 UI 隐藏 INVALID，也没有在全局状态尾部强行覆盖状态。

保留三类输入区别：

| 输入事实 | 处理 |
|---|---|
| 未设置 | direct 的 NOT_SET；新模式两字段缺失仍沿用 INCOMPLETE 表示。没有其他有效目标时为 DESIGN_PREVIEW，无结果 |
| 输入未完成 | 只有放松长度8或只有倍率3：INCOMPLETE、有效目标null，逐纱显示“长度输入未完成”，不伪造目标/结果 |
| 已提交但非法 | 编辑 action 拒绝；项目 import/normalizer 抛错并原子拒绝，保留旧合法值和结果。负数、非有限值、未知模式未被放宽 |

`resolveYarnLengthInput` 是派生器，不是全部原始非法数据的拒绝边界；本修复适用于通过正式输入链的合法事实，不声称任意绕过 action 的非法对象都会被它识别为 INVALID。

混合状态沿用既有规则：direct 未设置槽不参与要求，其他目标全成功仍 VALIDATED；relaxed 不完整槽与成功目标并存仍 PARTIAL；有效目标全不可达或真实求解错误仍 INVALID。仅未使用 Feed 有正目标时，不能让当前参与 Feed 的全空输入成为失败。

## 5. 正式回归覆盖与红绿结果

新增回归场景集中在原输入集成验证器，另一验证器仅同步一条冲突旧期望。使用实际导入、长度动作、Cam尺寸动作、state、Machine Domain、Simulation、Solver及结果反馈行；Node 测试仅模拟浏览器表面和可控 timer。没有直接设置预期 previewValidity，没有删除旧断言、skip、吞异常或引入产品测试后门。

| 场景 | 仿真后的断言结果 |
|---|---|
| A 旧直接模式全部明确未设置 | DESIGN_PREVIEW，结果为空 |
| B 新模式必要字段全未设置 | DESIGN_PREVIEW，结果为空 |
| C 只有放松长度8 | DESIGN_PREVIEW、INCOMPLETE，无目标/结果 |
| D 只有倍率3 | DESIGN_PREVIEW、INCOMPLETE，无目标/结果；含原失败场景 |
| E 成功23 / 8×3后正式Clear | 结果立即撤销，重算后仍为空；反馈不复用旧来源；保留未Clear的倍率事实 |
| F 主纱23、新模式不完整 | 仅主纱8条CONVERGED，PARTIAL；覆盖两字段空、只有8、只有3 |
| G 主纱23、第二纱8×3 | 16条结果全部成功，VALIDATED，冻结数值精确相等 |
| H 合法直接目标0.5 | UNREACHABLE_TARGET，INVALID，未应用；Clear后恢复基础预览 |
| I 空目标且3针道配排针1234 | INVALID，`Needle Type 4 exceeds camProgram.tracks length 3.` |
| J 非法编辑及导入 | 拒绝并保持旧state、合法值、结果；无新增求解timer |
| K 无目标后补齐输入 | 进入真实求解；只补齐第二纱时8条成功，完整SOP时16条成功 |
| L 模式切换、项目重载 | 撤销旧来源/结果，错误状态可恢复；成功项目与未完成项目互相加载不残留 |
| 额外：仅未使用的Feed48有23目标 | 当前40横列仍DESIGN_PREVIEW、结果为空 |

同一原失败断言：修复前 exit1，修复后 exit0。见 [红测](unset-length-before.log)、[绿测](unset-length-after.log)。现有输入集成测试漏掉的点是只断言模式切换/Clear的即时失效状态，然后在运行仿真前补齐了输入；本次在未完成期间执行runner并断言最终状态。

首次全量验证为40/41：`validate-multi-yarn-renderer.mjs:281`原先明确期待全部新模式未完成时INVALID，反映了造成回归的旧状态规则。其fixture仅有缺少倍率的放松长度8，没有有效目标或独立错误。按本轮批准合同只将该期望同步为DESIGN_PREVIEW，没有删断言、skip或吞异常；其PARTIAL、真实失败、绘制与数值断言不变。同步后的专项已通过；前后全量输出均保留在同一日志。

## 6. 数值、算法与绘制保护

正式集成回放将 SOP 的16条结果与上一轮冻结 C 逐项严格相等比较：目标、求解长度、误差、loopHeight、status、applied。主纱目标23结果 `22.999920925128244`，第二纱8×3派生24结果 `24.000753567866827`（Feed1），漂移为0。

现有 `validate:spandex-process-contract` 同时通过历史 M1/M3 精确比较及各Feed事实检查。没有更改 M1/M2/M3定义、求解器算法、几何公式、显示偏置、Canvas/WebGL绘制、项目版本、长度字段合同或结构revision语义。新增正式断言另确认长度参数修改不改变结构revision。

本轮23与8的单位为cm/100针，倍率3无量纲；来源为既有SOP，24由现有Domain乘积派生。数值比较证明软件回归稳定，不增加实测置信度；适用状态和工艺依据沿用 [SOP合同](../spandex-process-contract-implementation-2026-10-20/SOP-001-process-contract.md)。没有补默认23、3或24。

## 7. 真实浏览器核验

使用真实产品页面 `http://127.0.0.1:5188/`，通过可见控件、真实键入、失焦和明确Clear操作；观察只读DOM，没有注入状态或用观察页代替产品UI。浏览器fixture为界面创建的4×4全K、48×60、G32、排针1234；它用于UI状态核验，原SOP的精确8路场景由上述正式集成测试覆盖。

实测无目标、两字段空、只填8、8与3.0补齐、Clear后只剩倍率、混合成功/未完成、0.5不可达、负数编辑拒绝、空目标真实机器错误及恢复。状态和提示均符合预期。记录见 [浏览器状态日志](unset-length-browser.json)。非法编辑显示“未保存…原值保持不变”，原8×3求解结果保持；机器错误显示具体针型越界。

![Clear后仅保留倍率，基础预览与未完成提示同时可见](unset-length-browser.png)

未执行项目导出／新建／重新打开的原阶段二往返；未将几何外观作为本任务通过条件。

## 8. 验证结果

| 命令 | 本轮结果 |
|---|---|
| `npm run validate:yarn-length-input-integration` 修复前 | 预期失败，exit1，原A实际INVALID |
| 同一专项修复后 | PASS，exit0，包含A–L和未使用Feed边界 |
| `npm run validate:yarn-length-result-integration` | PASS，exit0 |
| `npm run validate:yarn-length-failure-integration` | PASS，exit0；既有Vite观察器注入异常，经真实runner验证ERROR、迭代上限、路径未应用及恢复保护 |
| `npm run validate:no-yarn-length-simulation` | PASS，exit0 |
| `npm run validate:spandex-process-contract` | PASS，exit0，历史M1/M3零漂移 |
| `npm run validate:multi-yarn-renderer` | 同步旧状态期望后PASS，exit0；渲染及数值断言保持 |
| `npm run validate` | 首次40/41（旧状态断言冲突）；同步后复跑41/41 PASS，exit0 |
| `npm run build` | PASS，exit0 |
| `git diff --check` | PASS，exit0 |

日志：[相关专项](unset-length-related.log)、[全量](unset-length-validate.log)、[构建](unset-length-build.log)、[差异检查](unset-length-diff-check.log)。最终151个受保护文件中148个SHA保持不变，另3个变化均为第一节列出的授权改动；没有新增源码文件。当前仍为main及相同HEAD，暂存区为空。

## 9. 独立复核

只使用root执行角色和复用的 `/root/adversarial_review` 独立复核角色，没有新增其他智能体。复核只读对比开工快照、实际补丁、正式红绿日志及SOP断言，未自行操作浏览器或声称独立重跑。

独立结论：通过，无阻断项。151个开工SHA中仅上述三个文件改变；修复位于首次错误层，没有重复目标派生，没有改UI掩盖状态、放宽非法输入或真实失败，没有破坏mixed规则。正式测试执行实际runner，覆盖原失败路径及A–L，SOP16条数值与冻结记录严格一致。正式回归依赖既有SOP包及冻结JSON，必须保留这两个已有证据文件。

同一角色增量复核第三个文件：确认allIncomplete只有缺倍率的单个Assignment，确实无有效目标，改为DESIGN_PREVIEW符合本轮合同；将这一行在内存中替换回旧断言后SHA与开工记录精确一致，证明没有其它改动；mixed的PARTIAL断言保持，专项PASS。此增量复核也通过。

## 10. 停止边界

本轮只恢复未设置目标的正确状态表达。INVALID不证明几何物理错误，DESIGN_PREVIEW也不证明穿插正确；VALIDATED仍仅代表现有模型求解状态。

未设置纱长状态回归：**已修复**。

历史穿插分类：**仍未解决**，原总闸门未解除。

氨纶数据合同最终验收：**待浏览器往返及集成复核**。

本轮提交及标签：**未执行**。不进入原阶段二、阶段三、几何修复、YarnTopology或三维。

本轮临时浏览器标签及5188验证服务均已关闭。本轮完成后停止。
