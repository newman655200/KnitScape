# KnitScape 开发约束

本文件给后续 Codex / Agent / 人工开发者使用。

## 1. 唯一主线

历史主线起点：`2a1efc16d94cdab548b0ea96e9c64c462cd7c3f5`。

2026-10-17 核对的当前 `main` HEAD：

`7ababf264d495f6b96d4d66652c529424938ac4d`

FACT：该 main 包含历史起点；P0 软件行为基线报告指向当前 HEAD。工作区另有已有未提交材料解析改动，不能将其误称为干净 baseline，也不得回滚覆盖。每次接手须重新核对实际 HEAD / status，以上不是要求固定在旧 commit。

当前只允许从 `main` 继续开发。

不要恢复或引用：

- KnitScape V2 / L0–L6 路线；
- 已删除的 V2 文档和 `v2.*` 标签；
- 旧 `needleExecution.js` / `arrangedChart` 语义；
- `v1.3.0-needle-execution` 中已经被 `9b80ef8` 撤销的实现方向。

## 2. 领域边界

必须保持以下概念独立：

- Pattern / Repeat：设计组织数据；
- Needle Arrangement：针位对应的 Needle Type ID 循环；
- Single Jersey Cam Program：每个 Needle Type × Feed 的 K/T/M 动作；
- Machine Execution：由 Cam + Needle 纯计算产生；
- Simulation：消费组织/机器结果，不自行解释 Cam 或排针规则。

排针不得改变 Pattern 本体。
Cam Program 不得直接写入 Pattern。

## 3. 当前机器执行入口

核心纯函数：

`src/domain/singleJerseyMachine.js -> resolveSingleJerseyOperations()`

调用/适配链：

`src/components/runSimulation.js`
→ `src/components/singleJerseyExecutionInput.js`
→ `resolveSingleJerseyOperations()`
→ `src/adapters/singleJerseySimulationInput.js`
→ Simulation

不要复制第二套机器执行逻辑到 UI、exporter 或 simulation 内。

## 4. 当前明确缺口

FACT：当前项目导出/包白名单及导入链已包含 `needleArrangementInputs`、`needleArrangement`、`singleJerseyCamProgram`、Gauge、Library/Feed targets；“机器字段尚未保存”是旧说明，不能再作为下一任务。

当前交接阶段（SUBJECTIVE / DESIGN DECISION）：`P0-C0 Correctness Preparation`。P0 已建立软件输入/状态/失败/Feed×Yarn/批量/revision保护，但不证明真实生产纱长。Solver窗口与完整repeat诊断口径有差异；full-repeat也不能未经工艺确认成为生产authority。

UNKNOWN / PENDING PROCESS CONFIRMATION：七个工艺问题、真实直径及其他物性。以 [NEXT_TASK.md](NEXT_TASK.md)、[当前架构](docs/ARCHITECTURE.md)、[工艺问题与数据来源](docs/PROCESS_VALIDATION.md)、[路线](docs/ROADMAP.md) 为当前交接入口；具体冲突见 [审计报告](reports/doc-alignment-2026-10-17/REPORT.md)。

## 5. 修改要求

每次功能开发：

1. 先确认当前 `main`；
2. 先读 `KnitScape_当前功能与算法.md` 与 `NEXT_TASK.md`；
3. 尽量新增纯函数并补验证脚本；
4. 不把业务规则复制进多个组件；
5. 不建立“旧版/新版”并行运行路径；
6. 不因 UI 需求破坏 Machine Domain；
7. 完成后运行相关 `npm run validate:*` 和 `npm run build`。

文档任务不属于功能开发；2026-10-17本轮只允许Markdown，不运行会生成构建产物的功能流程，不把历史npm通过写成本轮验证。任何影响物理结果的数据须说明Value、Unit、Source、Measurement/derivation principle、Confidence、Applicable state；未知不补默认“实测”。完整规则见 [PROCESS_VALIDATION.md](docs/PROCESS_VALIDATION.md)。
