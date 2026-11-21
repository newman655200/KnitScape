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

当前阶段（2026-11-20 更新）：

- FACT：2026-10-20 已收到生产确认——23 / 8 cm/100机针为拆纱放松实测，牵伸倍率 3.0（氨纶织造态参考 24），见 [YARN_LENGTH_CONTRACT.md](docs/YARN_LENGTH_CONTRACT.md) 顶部。旧的 `P0-C0 Correctness Preparation` 及“七问全部 PENDING”是 10-17 快照，已过时，不得再作为阻塞或下一任务。
- FACT：纱长线已闭合——指定 SOP 包 16 槽收敛，回归保护齐全。不再继续打磨求解器。
- 2026-11-21：三维几何代码（样布、TEST_ONLY 三维实验、松弛工作台）已全部移除，旧实现见 `fc56f2b`。当前任务是与用户讨论“纱线组织 → 面料形态”新算法，方案确认前不写三维代码。见 [NEXT_TASK.md](docs/NEXT_TASK.md)。
- UNKNOWN：真实纱径及其他物性；不得用默认值冒充实测。

以 [NEXT_TASK.md](docs/NEXT_TASK.md)、[当前架构](docs/ARCHITECTURE.md)、[纱长契约](docs/YARN_LENGTH_CONTRACT.md) 为当前交接入口。

## 5. 修改要求

每次功能开发：

1. 先确认当前 `main`；
2. 先读 `docs/KnitScape_当前功能与算法.md` 与 `docs/NEXT_TASK.md`；
3. 尽量新增纯函数并补验证脚本；
4. 不把业务规则复制进多个组件；
5. 不建立“旧版/新版”并行运行路径；
6. 不因 UI 需求破坏 Machine Domain；
7. 完成后运行相关 `npm run validate:*` 和 `npm run build`。

文档任务不属于功能开发；不把历史npm通过写成本轮验证。任何影响物理结果的数据须说明Value、Unit、Source、Measurement/derivation principle、Confidence、Applicable state；未知不补默认“实测”。完整规则见 [PROCESS_VALIDATION.md](docs/PROCESS_VALIDATION.md)。

## 6. 文件归档位置（2026-10-31 用户要求）

不要在用户桌面新建本项目的报告、截图、备份、测试包或构建输出目录。

- 主项目继续位于 `C:\Users\liuchen\Desktop\knitscape`。
- 项目外证据统一放在 `C:\Users\liuchen\Documents\KnitScape\archives`，按任务/日期建子目录。
- 已有桌面辅助目录迁移映射见 `C:\Users\liuchen\Documents\KnitScape\path-map.json`；历史报告中的旧路径保留为当时记录，查找文件时按映射定位。
- 当前指定 SOP 包的新路径为 `C:\Users\liuchen\Documents\KnitScape\archives\knitscape-sop-retest-2026-10-29\browser-continuation\SOP-restored-23-8x3-retest.knitscape`。
- 当前临时细线试验及截图目录位于 `C:\Users\liuchen\Documents\KnitScape\archives\knitscape-structure-trial-20261031-191950`。

## 7. 实现与验收（2026-11-18 用户要求）

以实现用户可用的功能为主。按优先级一次处理一个问题，先从实际入口复核问题，优先复用已有实现和验证。只为已经出现的问题或明确的工艺约束写代码。每项由实现者亲自验收，达成该项预期效果后再开始下一项。
