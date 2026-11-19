# Legacy 与兼容来源地图

核对日期：2026-10-17。**FACT**：以当前工作区源码核对真实消费者；本轮不删代码、不修行为。**SUBJECTIVE / DESIGN DECISION**：LEGACY表示兼容来源或待迁移入口，不等于死代码。来源、单位、测量原理、置信度、适用状态遵守 [PROCESS_VALIDATION.md](PROCESS_VALIDATION.md)；软件fallback不得补成工艺事实。

## 当前使用与移除前提

| Legacy item | Current use | Authority? | Compatibility only? | Consumers / Evidence | Removal prerequisite |
|---|---|---|---|---|---|
| `yarnPlies[0]` primary color/diameter/texture | 无Asset字段、Pattern预览、旧项目fallback | 兼容材质/模型参数源；非真实物性authority | 否，仍有活动用途 | [resolver](../src/domain/yarnMaterial.js)、[Simulation](../src/simulation/yarnSimulation.js)、[材质适配](../src/simulation/yarnTextureBrush.js) | 逐字段迁移、旧包/无目标预览及缓存/几何/渲染行为有明确等价性证据；不能直接删除 |
| Legacy companion ply enabled/color/diameter | 兼容附加绘制；不等于Feed.yarns[1] | 旧预览配置authority；非20D身份 | 否，条件性仍画出 | [rowYarnPly](../src/simulation/drawYarnSimulation.js) | 先确认旧项目与显式assignment交互；当前当assigned任一项assetMaterial=true或槽位>1时抑制额外Legacy strand，不能沿用旧报告“永远叠加”的结论 |
| 默认diameter0.24、companion0.14 | 未标定模型/兼容宽度；0.14不自动绑定20D | 仅模型默认值 | 否，仍影响几何/绘制 | [constants](../src/constants.js)、[resolver](../src/domain/yarnMaterial.js) | 真实直径须另有测量；迁移时保留旧项目视觉/模型解释；不能以20D、PBR或肉眼造新默认 |
| Legacy scan / 旧texture.pbr | 无Asset有效map时保留旧整组纹理语义 | 兼容材质源 | 主要为兼容，仍被消费 | [resolver](../src/domain/yarnMaterial.js)、[brush](../src/simulation/yarnTextureBrush.js)、[WebGL](../src/simulation/yarnUvWebglRenderer.js) | Asset缺图/无图契约、Canvas/WebGL降级与资源生命周期回归完整；部分Asset PBR缺图不能私自混入Legacy图 |
| 缺physicalRepeat时48模型单位周期 | 旧UV尺度fallback | 软件显示默认；非物理repeat | 是，但活动渲染仍用 | [UV](../src/simulation/yarnPathUvStrip.js) | 明确旧包尺度策略；不能用22.987给所有未知资产补物理尺度 |
| 可选Height map | 兼容旧纹理简化relief | 材质资源，不是几何位移authority | 可选兼容，仍可消费 | [map keys](../src/yarnTexture/yarnScanTexture.js)、[shader](../src/simulation/yarnUvWebglRenderer.js) | 先查真实资产与shader消费者；本SOP无Height不构成全局删除理由 |
| `cmPer100Loops` 基础统计 | 左侧排针前有限路径统计 | DERIVED；非Feed目标 | 旧指标但仍可见 | [geometry](../src/simulation/yarnPathGeometry.js)、[readout](../src/views/yarnLengthReadout.js) | 测量契约与用户用途明确后单独决定保留/改名/迁移；不能与canonical metric并成一个无定义读数 |
| `buildFeedYarnLengthDiagnostics()` / lengthRatio | 当前仅Gauge validator调用 | 诊断，不是Solver/UI验收authority | 测试用途 | [定义](../src/simulation/yarnLengthMetrics.js)、[调用](../scripts/validate-yarn-length-gauge.mjs) | 确认无业务消费者、保留有价值断言后才能移除；本轮仅记录 |
| `loadWorkspace()` | 兼容状态加载，validator调用；src中未发现业务调用者 | 经State preparation处理；不是新持久化入口 | 当前业务入口未见，测试仍用 | [State](../src/state.js)、[structure test](../scripts/validate-yarn-length-structure-integration.mjs)、[sequence test](../scripts/validate-yarn-sequence-editor.mjs) | 查清外部/测试契约再迁移；不能假装完全无消费者 |
| `queueSim` | runner中声明和写false，未发现读取 | 否 | 无实际调度作用的候选冗余 | [runner](../src/components/runSimulation.js) | 单独维护性任务确认后最小清理；本轮不修改 |
| Pattern-only JSON / legacy unset0 | 旧设计导入保留Machine/Library；存储0为未设目标 | 既有兼容契约 | 是，仍是合法输入格式 | [import](../src/actions/importers.js)、[input](../src/domain/yarnLengthInput.js) | 明确迁移/退出规则及实际旧项目回归，不能静默清空状态或把普通非法输入转0 |
| 早期P0/P1/SOP报告与实施计划 | 保存当时事实/失败/建议 | 历史证据；不是当前路线authority | 文档历史 | [本轮冲突表](../reports/doc-alignment-2026-10-17/REPORT.md) | 不删除/篡改；当前入口链接新文档并标时间/条件 |

## 不能按“旧命名”误删的活动层 — FACT

`rowLengthLoopModel.js` 当前被geometry、sampler、draw及validators消费；`ProcessModel` / `YarnModel` 当前参与生成路径。它们不是仅兼容占位，也不因尚非真实3D就应删除。[geometry](../src/simulation/yarnPathGeometry.js)、[sampler](../src/simulation/yarnPathSampler.js)、[draw](../src/simulation/drawYarnSimulation.js)

`feedYarnStructureRevision`、SolverResult、PreviewValidity是当前活动保护与派生结果，不能归入Legacy后绕过；Machine Domain仍是唯一K/T/M规则入口。禁止恢复已撤销的旧机器执行方向；本图不为被删除方向建立运行时迁移路径。

## 当前尚未验证的边界

**UNKNOWN**：旧P1审计中的checkbox同页Load、PBR整组替换/repeat和UI状态体验问题，本轮没有重新做浏览器复现或修复，不能宣称已解决。当前源码的Asset优先、Metallic、逐纱diameter及Legacy抑制条件已有变化，旧审计消费者表也不能原样套用。

**SUBJECTIVE / DESIGN DECISION**：后续Maintainability Audit先列出活动调用、数据owner、重复公式、fallback及依赖，再判断可迁移/删除项；不创建第二套Renderer或全仓State框架。当前范围与先后顺序见 [ROADMAP.md](ROADMAP.md)。
