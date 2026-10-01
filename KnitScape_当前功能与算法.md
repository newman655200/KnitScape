# KnitScape 当前功能与算法

更新时间：2026-10-01  
当前代码基线：`2a1efc16d94cdab548b0ea96e9c64c462cd7c3f5`  
当前主线：`main`

> 本文只描述 `2a1efc1` 当前源码。旧 V2 / L0–L6 路线不属于本项目当前主线。

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

## 7. 当前验证结果

当前仓库包含针对 Single Jersey Machine、Simulation Input、Workspace、排针、Cam Editor、纹理与纱长等验证脚本。

清理时已确认：

- `validate:single-jersey-machine`：PASS；
- `validate:single-jersey-simulation-input`：PASS；
- 多项无需第三方依赖的静态/领域验证可直接运行。

完整 Vite 构建仍应在安装依赖后运行 `npm run build`。

## 8. 当前明确未实现

- 机器设置完整 JSON 持久化；
- 双面机 / 罗纹 / 双罗纹机器 Domain；
- PLC 或设备控制；
- 真实三维材料力学、碰撞和织造动力学；
- 经过实物标定的生产级送纱量模型。

当前最优先缺口是 JSON 未保存 `needleArrangementInputs`、`needleArrangement` 与 `singleJerseyCamProgram`。

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

当前 `downloadJSON()` 只保存：

```text
width
height
repeats
yarnPalette
yarnSequence
yarnPlies
```

当前尚未保存：

```text
needleArrangementInputs
needleArrangement
singleJerseyCamProgram
```

因此“导出 → 关闭 → 再导入”后，机器设置不能完整恢复。

这是当前最优先的功能缺口。

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

当前建议顺序：

```text
P0 机器设置 JSON 持久化
→ P1 设计结果 / 机器结果差异检查
→ P2 Feed / Needle / Cam 更完整的机器参数
→ P3 工艺参数、送纱与校准
→ P4 设备接口 / PLC（最后）
```

详细 P0 规格见 `NEXT_TASK.md`。
