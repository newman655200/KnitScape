# KnitScape — 当前主线

本仓库从当前 **`main`** 继续开发。核对日期：2026-10-17（Asia/Shanghai）。

- **FACT**：当前HEAD为 `7ababf264d495f6b96d4d66652c529424938ac4d`，包含历史起点 `2a1efc1`。P0 baseline是软件工作流基线。
- **FACT**：当前有开工前已有未提交的材料解析、逐纱直径及Metallic等改动；不能把当前工作区称为干净baseline，不能覆盖已有修改。
- **SUBJECTIVE / DESIGN DECISION**：当前交接阶段为 **P0-C0 Correctness Preparation**，先完成工艺确认和测量契约，再进入后续开发。
- **UNKNOWN / PENDING PROCESS CONFIRMATION**：23/8的测量程序、第二纱路径、Feed/负载关系及数值类型；真实纱径与其他物性仍缺数据。

P0已建立可信目标输入、派生结果、失败状态、Feed×Yarn独立目标、批量及revision回归保护，**不等于已证明真实生产23cm/100针正确**。当前Solver/UI窗口与完整repeat诊断定义不同；后者也不能自动升级为工厂authority。当前Simulation是二维分层路径预览，尚非真实3D物理织物模型。

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
| [当前功能与算法](KnitScape_当前功能与算法.md) | 当前实现和能力边界 |
| [NEXT_TASK](NEXT_TASK.md) / [ROADMAP](docs/ROADMAP.md) | 确认前可做项、禁令、确认后分支与关口 |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Machine / Simulation / Geometry / Renderer边界 |
| [DOMAIN_AUTHORITY](docs/DOMAIN_AUTHORITY.md) | 输入权威、派生数据、兼容源和消费者 |
| [YARN_LENGTH_CONTRACT](docs/YARN_LENGTH_CONTRACT.md) | 当前各长度口径与未来契约骨架 |
| [PROCESS_VALIDATION](docs/PROCESS_VALIDATION.md) | 七个工艺问题、四类验证、物理数据来源六项原则 |
| [LEGACY_MAP](docs/LEGACY_MAP.md) | Legacy真实用途及移除前提 |
| [本轮审计](reports/doc-alignment-2026-10-17/REPORT.md) | 开工状态、文档冲突、核验与保留证据 |

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
