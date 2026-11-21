# KnitScape 当前功能与算法

核对日期：2026-10-17（Asia/Shanghai）

当前 main HEAD：`7ababf264d495f6b96d4d66652c529424938ac4d`
当前主线：`main`

**FACT**：`2a1efc1`是历史主线起点，当前HEAD包含它；工作区另有已有未提交材料解析修改。以下当前行为以源码为准，历史实验另标报告来源。旧路线不属于当前主线。

**当前阶段（2026-11-20）**：10-20 SOP-001 工艺已确认，纱长已闭合（16 槽收敛）；当前关口是**三维算法重新设计**（2026-11-21 三维代码已全部移除，旧实现见 `fc56f2b`），见 [NEXT_TASK](NEXT_TASK.md)。旧的 `P0-C0` 阶段已过时。证据分类、物理数据来源六项原则和工艺七问见 [PROCESS_VALIDATION](PROCESS_VALIDATION.md)；当前路线以 [ROADMAP](ROADMAP.md) 为准。未知物性与测量方法不得猜默认值。

## 1. 项目当前定位

KnitScape 当前是一套面向 **单面纬编 / Single Jersey** 的浏览器端开发工具。

当前能力已经从单纯花型编辑扩展为：

```text
花型设计
→ 排针
→ 三角座 Cam Program
→ Needle Type × Feed 机器动作
→ K/T/M 执行结果
→ 排针后纱线路径预览
```

当前仍属于数字开发与机器逻辑模拟工具，不是 PLC 控制系统，也不是完整物理数字孪生。

## 2. 当前已实现功能

### 2.1 Pattern / Repeat 编辑

- 组织图与 Repeat 编辑；
- 默认主 Repeat 为 `4 × 4`；
- 默认 chart 为 `48 × 60`；
- 新建项目 chart 为 `30 × 40`；
- 支持组织格连续绘制、多个 Repeat、缩放、平移、适配视图；
- 内部针法仍包含 Knit / Purl / Miss / Tuck。

Pattern 与机器排针保持独立。

### 2.2 工作区

当前有两类主要工作区：

- `pattern`：花型编辑；
- `machine`：排针 + Single Jersey Cam Program。

切换工作区不会删除已存在的 Pattern、排针或 Cam 数据。

### 2.3 Needle Arrangement

运行时字段：

```text
needleArrangementInputs: [string, string, string, string]
needleArrangement: number[]
```

输入规则：

- 无逗号/空格时按单字符 Needle Type 解析，例如 `1234 -> [1,2,3,4]`；
- 含逗号/空格时按完整正整数解析，例如 `1,12,3 -> [1,12,3]`；
- 四个输入框分别解析后按顺序拼接；
- 只允许正整数 Needle Type；
- 应用后写入 `needleArrangement`；
- 撤回只清空已应用 arrangement，不改 Pattern。

针位取值使用循环：

```text
needleType = arrangement[position % arrangement.length]
```

### 2.4 Single Jersey Cam Program

运行时字段：

```text
singleJerseyCamProgram = {
  tracks: MachineOperation[][]
}
```

其中：

- 行 = Needle Type / Track；
- 列 = Feed；
- 单元格 = `K / T / M`；
- 第一次创建默认 `4 Track × 4 Feed`；
- 默认所有格为 `K`；
- Track、Feed 数量可动态调整；
- 点击格子循环切换操作。

Cam Program 允许任意正整数 Track/Feed 尺寸，不锁死 4×4。

### 2.5 Single Jersey Machine Domain

核心文件：

`src/domain/singleJerseyMachine.js`

核心函数：

```text
resolveSingleJerseyOperations(
  camProgram,
  needleArrangement,
  width,
  feeds
)
```

算法：

```text
for each feed
  for each needle position
    needleType = arrangement[position % arrangement.length]
    operation = camProgram.tracks[needleType - 1][feed % camFeedCount]
```

输出：

```text
MachineOperation[feed][position]
```

其中 MachineOperation 当前只允许：

```text
K / T / M
```

Domain 会拒绝：

- 空 Cam；
- 非矩形 Cam；
- 非 K/T/M；
- 空排针；
- 非正整数 Needle Type；
- Needle Type 超过 Track 数；
- 非法输出宽度或 Feed 数。

### 2.6 Machine → Simulation Adapter

`src/adapters/singleJerseySimulationInput.js` 将：

```text
K -> 0
M -> 2
T -> 3
```

转换为现有 `Bimp` simulation 输入。

当前机器执行结果不产生 Purl。

### 2.7 排针前 / 排针后双预览

`src/components/runSimulation.js` 当前同时维护：

**排针前**

```text
GLOBAL_STATE.chart
→ simulate()
```

**排针后**

```text
singleJerseyCamProgram
+ needleArrangement
→ createSingleJerseyExecutionInput()
→ resolveSingleJerseyOperations()
→ createSingleJerseySimulationInput()
→ simulate()
```

如果 Cam 或排针尚未设置，排针后预览为空。
如果机器配置非法，界面显示 machine configuration error，而不是静默计算错误结果。

## 3. 实际运行架构

当前核心数据流：

```text
repeats → generateChart() → GLOBAL_STATE.chart → 排针前 Simulation

needleArrangement + singleJerseyCamProgram
→ resolveSingleJerseyOperations()
→ K/T/M matrix
→ createSingleJerseySimulationInput()
→ 排针后 Simulation
```

Machine Domain 与 Simulation 之间通过 adapter 连接；Simulation 不自行解释 Cam / Needle 规则。

## 4. 核心数据结构

```text
needleArrangementInputs: [string, string, string, string]
needleArrangement: number[]

singleJerseyCamProgram = {
  tracks: MachineOperation[][]
}
```

Pattern/Repeat 数据继续保存在 `chart` 与 `repeats`；机器配置不改写 Pattern。

## 5. 已实现算法

- Needle Arrangement：按针位循环取 Needle Type；
- Cam Program：按 Feed 循环取对应 Cam 动作；
- Machine Domain：`Needle Type × Feed → K/T/M`；
- Adapter：`K -> 0`、`M -> 2`、`T -> 3`，转换成现有 Bimp simulation 输入；
- 原有 Repeat 平铺、纱线路径、UV ribbon、纹理与二维纱长估算算法继续保留。

## 6. 技术栈与开发方式

- 浏览器端 JavaScript；
- Vite；
- lit-html；
- D3；
- Canvas / WebGL；
- Node 脚本做结构、领域和回归验证。

开发必须从 `main` 继续，并遵守 `AGENTS.md`。

## 7. 软件基线与验证边界

**FACT**：P0已建立SolverResult、PreviewValidity、合法/非法输入保护、明确Clear、UNREACHABLE_TARGET、Feed×Yarn独立目标、批量目标原子预检及feedYarnStructureRevision保护。当前仓库有相应regression validators。

历史 [P0 Final Audit](../reports/p0-final-audit/FINAL_REPORT.md) 为CONDITIONAL PASS，[baseline报告](../reports/p0-baseline-20261007-210704/BASELINE_REPORT.md) 指向当前HEAD，记录36/36；后续 [geometry gap审计](../reports/real-sop-geometry-gap-audit-2026-10-16/REPORT.md) 记录37/37及build通过。本轮文档工作没有重跑npm或浏览器，不把历史结果称为本轮PASS。

**UNKNOWN / PENDING PROCESS CONFIRMATION**：这些软件验证没有证明真实工厂23/8与当前Solver测量定义一致，没有完成真实机台精度标定。当前VALIDATED仅是模型窗口数值目标成功并应用。[四类验证](PROCESS_VALIDATION.md)

## 8. 当前明确未实现

- 双面机 / 罗纹 / 双罗纹机器 Domain；
- PLC 或设备控制；
- 真实三维材料力学、碰撞和织造动力学；
- 经过实物标定的生产级送纱量模型。

**FACT**：机器配置持久化已有实现，不能继续列为未开发。当前优先缺口是测量契约与工艺确认；当前模型内部窗口与完整repeat存在差异，不能跳到生产级校准。

## 9. 理论与使用边界

当前机器执行层是离散 K/T/M 逻辑模型；当前外观模拟仍主要是 2D/2.5D 纱线路径可视化。

因此：

- 可以用于验证排针与 Cam Program 的逻辑关系；
- 可以用于比较排针前后组织结果；
- 不能把当前预览当作真实机台动力学结果；
- 当前纱长读数属于几何估算，未经实物标定不能直接用于生产设定。

## 10. 外观与纱线模拟

当前仍保留原有纱线路径和外观功能，包括：

- Yarn palette / 逐行用纱；
- 双纱参数；
- 扫描纱线纹理；
- Base Color / Normal / Roughness / Height / AO 图片字段；
- Canvas 与 WebGL UV ribbon 渲染；
- 自动 / 质量 / 纯色性能模式；
- 正反面切换；
- 缩放、平移、适配；
- 机号 Gauge；
- 二维路径纱长估算。

当前预览仍属于 2D/2.5D 路径可视化，不代表真实三维受力、碰撞或织造动力学。

## 11. 当前数据主线

```text
repeats
  ↓
generateChart()
  ↓
GLOBAL_STATE.chart
  ├──────────────→ 排针前 Simulation
  │
  └─ Pattern 设计数据（不被排针改写）

needleArrangement ─┐
                   ├→ resolveSingleJerseyOperations()
singleJerseyCamProgram ┘
                           ↓
                    K/T/M matrix
                           ↓
              createSingleJerseySimulationInput()
                           ↓
                    排针后 Simulation
```

## 12. JSON 当前边界

**FACT**：当前实际导出为 `getProjectData()` → `createProjectPackage()` → `.knitscape` 项目包，支持读取包或JSON。导出白名单保存：

```text
width
height
repeats
yarnPalette
yarnSequence
yarnPlies
yarnLibrary
singleJerseyCamProgram
needleArrangement
needleArrangementInputs
machineGauge
```

不保存运行时派生/交互数据：

```text
yarnLengthSolverResults
previewValidity
feedYarnStructureRevision
batch selection / pending / draft
```

源码证据：[exporters](../src/actions/exporters.js)、[package](../src/actions/projectPackage.js)、[importers](../src/actions/importers.js)。SOP with-cam报告已有真实保存/重导入证据；旧Pattern-only JSON会保留当前Machine/Library，不能把旧兼容入口误读成完整项目替换。

## 13. 当前明确不采用的旧方向

以下方向已废弃，不允许重新引入：

- 用排针直接改 Pattern；
- 旧 `Needle Execution` / `arrangedChart` 并行层；
- 将 Needle Type 当作针法；
- 将 Repeat 尺寸绑定为排针长度；
- 在 Simulation 内重新实现 Cam / Needle 业务规则；
- KnitScape V2 的 L0–L6 另一套主线。

## 14. 核心源码位置

| 文件 | 当前职责 |
|---|---|
| `src/state.js` | 全局运行时状态 |
| `src/views/needleArrangementBar.js` | 四框排针 UI |
| `src/simulation/needleArrangementOverlay.js` | 排针解析/格式化/循环取值 |
| `src/actions/singleJerseyCamProgram.js` | Cam 创建、尺寸、编辑、删除 |
| `src/views/singleJerseyCamProgramEditor.js` | Cam UI |
| `src/domain/singleJerseyMachine.js` | Cam + Needle → K/T/M 纯领域逻辑 |
| `src/components/singleJerseyExecutionInput.js` | 机器 Domain 调用入口 |
| `src/adapters/singleJerseySimulationInput.js` | K/T/M → Bimp |
| `src/components/runSimulation.js` | 排针前/后两套预览调度 |
| `src/actions/exporters.js` | 当前项目导出 |
| `src/actions/importers.js` | 当前项目导入 |

## 15. 后续顺序

**SUBJECTIVE / DESIGN DECISION**：替代旧“持久化P0→差异P1→机器参数P2”顺序，当前统一路线：

```text
P0软件基线 ✓ → PROCESS CONFIRMATION GATE ✓（10-20）→ P0-C1 纱长 ✓（16 槽收敛）
→ 三维几何（xyz Centerline / Yarn Mesh；2026-11-21 代码已移除，算法重新设计中）
→ Physical UV/PBR → Real Fabric Calibration
→ Conditional Relaxation/Contact → Fuzz/High Fidelity
```

详细允许项、禁令及答案分支见 [NEXT_TASK](NEXT_TASK.md) / [ROADMAP](ROADMAP.md)。本轮不进入下一阶段开发。

## 16. 当前纱长、材质与真实SOP

**FACT**：SOP资料为Single Jersey、32英寸、32G、3216针、1234、4×8 Cam、N6/W(6040)23cm/100针、20D LOW 8cm/100针、张力记录5/4cN。保存项目是30×40主纱版，没有20D assignment，张力仍null；张力字段可记录但不作用于geometry。[SOP证据与七问](PROCESS_VALIDATION.md)

**FACT**：当前Solver测量横向周期化窗口、平均同Feed全部有限course，含顶边。原30×40主纱Feed8软件值22.999733873，内部完整4针循环独立诊断约24.077277996cm/100针；23.7016属于32×40 comparison。二者不是同一数学口径，full-repeat也不是已确认生产authority。[完整定义](YARN_LENGTH_CONTRACT.md)

**FACT**：当前工作区有Asset可选color/diameter、统一resolveYarnMaterial、逐纱diameter profile及Metallic通路；旧报告“Asset没有字段/Metallic不支持”描述的是较早快照。本轮不续做或验收该未提交功能。[ownership](DOMAIN_AUTHORITY.md)、[Legacy条件](LEGACY_MAP.md)

**FACT / UNKNOWN**：PBR原图有五张2172×724 PNG，无内嵌pHYs；2400DPI来自用户扫描说明。仅在原图未重采样且DPI为真实采集DPI时，横向纹理physicalRepeat=2172/2400×25.4=22.987mm。真实yarn diameter仍UNKNOWN，不能由图高、透明区域、20D或肉眼推出。
