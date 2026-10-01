# KnitScape 开发约束

本文件给后续 Codex / Agent / 人工开发者使用。

## 1. 唯一主线

当前有效代码基线：

`2a1efc16d94cdab548b0ea96e9c64c462cd7c3f5`

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

适配链：

`resolveSingleJerseyOperations()`
→ `src/adapters/singleJerseySimulationInput.js`
→ `src/components/singleJerseyExecutionInput.js`
→ `src/components/runSimulation.js`

不要复制第二套机器执行逻辑到 UI、exporter 或 simulation 内。

## 4. 当前明确缺口

项目 JSON 尚未保存：

- `needleArrangementInputs`
- `needleArrangement`
- `singleJerseyCamProgram`

下一阶段应先完成持久化和兼容验证，详见 `NEXT_TASK.md`。

## 5. 修改要求

每次功能开发：

1. 先确认当前 `main`；
2. 先读 `KnitScape_当前功能与算法.md` 与 `NEXT_TASK.md`；
3. 尽量新增纯函数并补验证脚本；
4. 不把业务规则复制进多个组件；
5. 不建立“旧版/新版”并行运行路径；
6. 不因 UI 需求破坏 Machine Domain；
7. 完成后运行相关 `npm run validate:*` 和 `npm run build`。
