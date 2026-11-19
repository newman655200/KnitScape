# P0 FINAL AUDIT：独立只读代码审查

审查者：`/root/p0_final_review`。审查时 HEAD 为 `29b7e4bcfaee6c9b7f3df070b24c200b7aa56103`，当前分支为 `main`。依据为用户 FINAL AUDIT 原文、AGENTS.md、当前功能说明、NEXT_TASK.md、累计 tracked diff 与新增源码。未修改源码或历史报告，未运行浏览器，未执行 commit/tag。本报告只给代码审查结论；最终 validate/build/browser 证据由根代理独立执行。

**代码审查结论：未发现当前真实用户消费链上的 P0 阻塞。存在明确非阻塞技术债，代码审查建议采用 CONDITIONAL PASS；最终验收必须结合本轮真实浏览器及测试结果。**

## 1. Project / Derived / UI 边界

- `src/actions/exporters.js:135–149` 的 `getProjectData()` 明确只输出 Pattern/repeats、Yarn palette/sequence/plies/library、Cam（包含 assignment 与 target）、Arrangement 与 Gauge。没有 SolverResult、PreviewValidity、batch selection、runtime revision 或临时反馈。
- `src/state.js:45–52` 的 SolverResult / PreviewValidity / generation 属于同一个运行时容器，但没有因共存而进入项目持久化。UI selection 和 captured generation 只存在于 `src/views/singleJerseyCamProgramEditor.js:100–112` 的模块局部变量。
- `src/actions/importers.js:36–64,85–125` 先规范化并校验项目事实，随后只 dispatch 已选择的事实/UI reset 字段，忽略导入数据中的 runtime revision 与派生结果；完整 Cam 项目替换明确声明 generation replacement。
- `src/actions/projectPackage.js:9–11` 的持久化字段集合与现有 export 保持一致。实际用户 export 输入来自 `getProjectData()`；包生成不从 GLOBAL_STATE 整体序列化。
- `src/constants.js:18–23` 的 Undo snapshot 不包含 Cam、revision、SolverResult 或 PreviewValidity，因此当前 Undo 不会绕过 generation 恢复 assignment 身份。
- 当前 Machine 执行入口仍为 `src/components/singleJerseyExecutionInput.js` → Machine Domain → adapter；新增长度求解与渲染逻辑没有复制 Cam/Arrangement 解析规则，也不回写 Pattern 或 Cam。

## 2. Revision 语义与真实 mutation 入口

唯一实际 revision 递增入口为 `src/state.js:177–185` 的 `prepareAction()`；先丢弃调用者传入的 revision，然后在同一 action 内写入新 generation。`dispatch()` 在 observer 看到状态前完成这次 mutation 与 revision 更新。

| 操作 | 现有入口与证据 | Revision |
|---|---|---|
| 创建/同值完整重建 Cam | `src/actions/singleJerseyCamProgram.js:118–125` | 强制 +1 |
| 完整 Feed assignments 替换、同 ID reorder | `src/actions/singleJerseyCamProgram.js:166–186` | 强制 +1 |
| 添加、删除、replace yarnId | `src/actions/yarnLibrary.js:109–129` → 上述 Feed replacement | +1 |
| 当前 slot 再选相同 asset | `src/actions/yarnLibrary.js:115` | no-op，不递增 |
| Feed 数量变化 | `src/actions/singleJerseyCamProgram.js:128–135` → `src/domain/feedYarnStructure.js:3–11` | +1 |
| 删除 Cam | `src/actions/singleJerseyCamProgram.js:266–267` → null 边界检测 | +1 |
| 完整 JSON/.knitscape 项目导入 | `src/actions/importers.js:122` | 同 locator 也强制 +1 |
| legacy `loadWorkspace` 完整 Cam 替换 | `src/state.js:119–124` | 强制 +1；当前 src 无实际调用者 |
| 单项长度、Clear、batch 长度 | `src/actions/singleJerseyCamProgram.js:206–252` | 不递增 |
| Cam 动作、Track resize、Gauge、Arrangement | 结构比较只看 Feed count / slot count / yarnId | 不递增 |
| tension、placement、颜色、PBR、metadata | `src/domain/feedYarnStructure.js:3–11` 不把参数视为身份 | 不递增 |
| SolverResult / PreviewValidity | 没有 Cam 结构字段 | 不递增 |

现有真实 mutation 都已覆盖。身份相同的完整重排不能只依赖 ID 比较，现有 `setSingleJerseyFeedYarns()` 已明确使用 replacement intent。未来新增 mutation 仍需沿用这一入口，这是维护约束而非当前缺陷。

## 3. Batch 防线与输入规则

- `src/domain/yarnLengthBatch.js:34–47` 按 generation → locator/yarnId/editability → value 的顺序 preflight。`src/actions/singleJerseyCamProgram.js:235–251` 只有 preflight 全部通过才构造新 feeds 并 dispatch；没有部分提交路径。
- `src/views/singleJerseyCamProgramEditor.js:143–151` 首次明确选择捕获 generation，结构变更后再次选择先清理旧 selection；`128–140,200–204` 取消旧 slot 自动勾选；`181–190` stale 拒绝并清 selection。没有自动重新定位同 ID yarn 的逻辑。
- `src/domain/yarnLengthInput.js:5–19` 是唯一编辑输入 validator，single / batch / UI draft / storage normalization 都调用它。普通编辑只接受有限正数；Clear 与兼容存储才开启 `allowUnset`。
- simulator 和 feedback 的“有限正数是已设 target”判断用于读取已规范化事实，不是第二个可提交 validator。`targetModelLengthPer100Needles()` 的非负检查是模型单位转换保护，不是另一个用户输入规则。
- 当前旧 Pattern-only JSON 的导入刻意保留现有 Machine / Yarn Library，不构成 assignment 身份替换；完整含 Cam 项目导入才重建 generation。这一现有兼容语义没有被 P0-4B 改写。

## 4. 派生结果、状态与应用

- `src/components/runSimulation.js:288–308` 在相关事实变化时停旧 simulation、同步清结果/可信状态，然后才安排 150ms 重算。因此 dispatch 返回后不会保留新事实配旧 VALIDATED 的全局状态。
- 正常结果唯一聚合权威为 `src/simulation/previewValidity.js:12–28`。只有 slot 与 target 一致、CONVERGED、converged、实际 applied、有限数值、误差与容差全部满足才能进入 VALIDATED。初始化/失效时 DESIGN_PREVIEW 和机器配置失败 INVALID 是生命周期状态，不是另一套聚合算法。
- CONVERGED / UNREACHABLE_TARGET 决策只在 `src/simulation/yarnLengthSolver.js:176–243`。simulator 捕获 ERROR、重新判断 display application，UI 只展示结果，没有把不可达目标转成成功。
- `src/simulation/yarnSimulation.js:264–301` 每次 cache hit 仍先取消 applied 标记，再逐 strand 检查模型路径是否实际获得 display resolution；fallback 不会沿用旧 applied=true。相同目标共享计算，但逐 slot clone result，未共享可变 assignment 结果。
- `src/simulation/yarnPathGeometry.js:116–138` 对路径应用失败整体返回基础 Map；因此 simulator 的引用比较确实反映成功应用或基础 fallback。
- `src/views/yarnLengthSolverFeedback.js:8–27` 按当前 slot 与 target 取结果，没有同 Feed 的兄弟结果继承。明确显示 target、candidate solved、status、applied 和模型范围。
- `src/i18n/translations.js:72–78` 与对应其他语言文案明确表示模型几何、未经实机验证、未应用值只是候选；没有生产工艺或实机保证。

## 5. 重复规则、死代码与消费者

未发现第二套编辑 validator、第二套可提交 unset 规则、第二套 PreviewValidity 聚合、第二套 solver 成败转换或第二套 batch 提交 stale 决策。UI 的 `batchStructureCurrent()` 是同一 generation 等式的展示条件，实际提交仍调用 domain preflight。

新增的 `feedYarnStructure`、`yarnLengthInput`、`yarnLengthBatch`、`previewValidity`、`yarnLengthSolverFeedback` 均存在真实 src 运行消费者。新增 Solver 的 `NOT_SET`、`ERROR` 和默认 tolerance 也有实际消费者。无未被调用的新增 P0 核心逻辑。

`queueSim` 和 `buildFeedYarnLengthDiagnostics()` 的无业务消费者情况在 HEAD 中已存在，不是累计 P0 新引入的临时逻辑。

## 6. 已知技术债评级

| 项 | 评级 | 当前实际影响与证据 | 阻塞 baseline |
|---|---|---|---|
| A 全局保守 revision | LOW | 另一 Feed 结构变更也拒绝旧 selection，用户需要重选；避免跨 Feed 部分提交。`src/state.js:177–185` / `yarnLengthBatch.js:34–41` | 否 |
| B 同步 observer 旧快照 | MEDIUM | 普通 single/Cam/Gauge mutation 的最初 snapshot 仍可能含旧 derived，直到 runner 的嵌套 dispatch 清理。当前注册 UI renderer 只排 RAF，随后从 GLOBAL_STATE 读取；其余同步组件不消费 solver/validity。`src/state.js:187–199`、`src/index.js:43–45,120–132`、`src/components/renderApp.js:11–19`、`runSimulation.js:304–308`。这是后续添加同步 derived 消费者时需要统一的边界，没有当前 False Success 路径 | 否 |
| C debug 快捷键 d | LOW | window keydown 没有 editable-target 排除，输入名称里的 d 也会切 debug pane；仅改变 debug UI，不写 project target/assignment 或结果。`src/events/keypressEvents.js:31–35,43–56` / `src/views/view.js:90` | 否 |
| D queueSim 无读取 | LOW | `src/components/runSimulation.js:205,208` 仅声明/写 false；debounce 正常由 timeout 管理，未因变量未读取丢失模拟调度。HEAD 已存在 | 否 |
| E 旧诊断仅 validator | LOW | `src/simulation/yarnLengthMetrics.js:69–95` 只被 `scripts/validate-yarn-length-gauge.mjs:6,320,325` 调用；实际求解与 UI 不消费 lengthRatio，不能成为目标成功依据 | 否 |
| F 旧基础纱长统计口径 | MEDIUM | 仍是基础 Pattern 的 cm/100 loops 汇总，读数标题仍“当前纱长”；与目标 cm/100 needles 不可直接比较。不过实际 readout 加明确“基础预览统计，非目标求解值”，可信反馈另列 target/solved。`src/components/runSimulation.js:226–239`、`src/views/yarnLengthReadout.js:13–44`、`src/i18n/translations.js:56,78–79`。旧统计算法未修改 | 否 |

## 7. 阻塞与后续处理

本次只读代码审查没有可行动 P0 blocker，不建议为本次验收修改或重构业务代码。B/F 应作为后续技术债明确保留，不应在 baseline 文案中夸大成实机或实际耗纱保证。新增同步 solver 消费者时应先解决 B 的原子失效边界；旧统计文案可在独立任务中统一。

根代理的本轮 browser / 全部验证一旦出现误改、错误 assignment、状态污染或可信结果误导，应优先采用其可复现证据决定 FAIL，而不是以此静态审查替代真实验收。
