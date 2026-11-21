# KnitScape — 当前主线

本仓库从当前 **`main`** 继续开发。阶段核对日期：2026-11-20（Asia/Shanghai）。

## 当前阶段（2026-11-20 更新）

- **FACT — 工艺已确认（2026-10-20）**：SOP-001 的 23 / 8 cm/100机针 为拆纱放松实测长度，实际牵伸倍率 3.0（氨纶织造态参考 24 cm/100机针），张力 5/4 cN 仅记录。详见 [YARN_LENGTH_CONTRACT](docs/YARN_LENGTH_CONTRACT.md) 顶部“SOP-001 生产确认补充”。2026-10-17 写的“七问全部 PENDING、Gate 关闭”已过时，不再作为阻塞项。
- **FACT — 纱长线已闭合**：指定 SOP 包 8 路双纱共 16 槽纱长收敛，越界/清空/批量/revision 有回归保护（功能提交 `7ababf2`）。这一线不再继续打磨。
- **2026-11-21 决定 — 三维代码已全部移除**：三维样布、TEST_ONLY 三维实验、松弛工作台及其 validator 已删除（旧实现见提交 `fc56f2b`）。当前任务是重新讨论“纱线组织 → 面料形态”算法，见 [NEXT_TASK](docs/NEXT_TASK.md)。
- **DESIGN DECISION**：不重新讨论已确认的工艺语义。
- **仍为 UNKNOWN**：真实纱径及弹性、摩擦等物性；M1 与 M3 测量窗口差异仍在。这些不阻塞几何验收，但不得用默认值冒充实测。
- **FACT**：最后一次功能提交为 `7ababf2`；三维代码存档提交为 `fc56f2b`。

P0已建立可信目标输入、派生结果、失败状态、Feed×Yarn独立目标、批量及revision回归保护；纱长求解已按 10-20 工艺确认闭合，但不等于生产精度验收。当前Solver/UI窗口与完整repeat诊断定义不同。正式Simulation是二维分层路径预览；三维空间工作台与样布演示已于 2026-11-21 移除。

## 当前产品链路

```text
Pattern / Repeat
      ↓
原始组织 chart（排针前预览）

Needle Arrangement + Single Jersey Cam Program
      ↓
resolveSingleJerseyOperations()
      ↓
K / T / M 机器动作矩阵
      ↓
createSingleJerseySimulationInput()
      ↓
排针后预览
```

当前已经形成单面大圆机的基础机器执行链路：

- 花型/Repeat 编辑
- 排针输入与应用
- Single Jersey Cam Program（三角座）
- Needle Type × Feed → K/T/M
- 排针前 / 排针后双预览
- 色纱、双纱、扫描纱线纹理、WebGL UV 纹理预览
- 机号与二维路径纱长估算
- 项目包保存/恢复机器设置、Yarn Library/PBR及Feed×Yarn目标；SolverResult、PreviewValidity和runtime revision不保存

交接入口按用途阅读：

| 文档 | 解决的问题 |
|---|---|
| [当前功能与算法](docs/KnitScape_当前功能与算法.md) | 当前实现和能力边界 |
| [NEXT_TASK](docs/NEXT_TASK.md) / [ROADMAP](docs/ROADMAP.md) | 当前任务（三维算法重新设计）；ROADMAP 给出阶段图与之后的路线 |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Machine / Simulation / Geometry / Renderer边界 |
| [DOMAIN_AUTHORITY](docs/DOMAIN_AUTHORITY.md) | 输入权威、派生数据、兼容源和消费者 |
| [YARN_LENGTH_CONTRACT](docs/YARN_LENGTH_CONTRACT.md) | 当前各长度口径与未来契约骨架 |
| [PROCESS_VALIDATION](docs/PROCESS_VALIDATION.md) | 七个工艺问题、四类验证、物理数据来源六项原则 |
| [LEGACY_MAP](docs/LEGACY_MAP.md) | Legacy真实用途及移除前提 |
| [本轮审计](reports/doc-alignment-2026-10-17/REPORT.md) | 开工状态、文档冲突、核验与保留证据 |
| [docs/archive](docs/archive) | 2026-11-18 清理/架构/复用总结报告，以及一次性的 Codex 任务书 |

> 2026-11-20 起 `reports/` 不再随仓库保存（已加入 `.gitignore`），文档中指向 `reports/` 的链接为历史证据。需要时可恢复：`git checkout 23e71e7 -- reports`。验证脚本所需的测试数据已移到 `scripts/fixtures/`。

FACT / INFERENCE / PREDICTION / SUBJECTIVE / DESIGN DECISION / UNKNOWN 的统一含义以PROCESS_VALIDATION为准；任何影响物理结果的数据都需Value、Unit、Source、测量/推导原理、Confidence、Applicable state。未知不由软件默认值补成工艺事实。

## 本地运行

```bash
npm install
npm run dev
```

Windows 也可以使用：

```text
一键启动.bat
```

## 开发前必须确认

```bash
git branch --show-current
git log -1 --oneline
```

应看到 `main`，并且历史中包含 `2a1efc1`。

任何新开发都从当前 `main` 继续，不使用旧 V2、旧实验分支或 `v1.3.0-needle-execution` 的错误语义。
