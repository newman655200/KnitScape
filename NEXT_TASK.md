# KnitScape 下一任务：Correctness Preparation

核对日期：2026-10-17（Asia/Shanghai）。**FACT**：当前分支main，HEAD为7ababf264d495f6b96d4d66652c529424938ac4d；保留开工前已有未提交源码、脚本、素材及报告。不得为对齐旧文档回退代码。

**SUBJECTIVE / DESIGN DECISION**：当前交接阶段为 **P0-C0 Correctness Preparation**。本轮仅文档收敛，完成后停止；本文给后续单独任务使用，不表示已授权或实施源码修改。

## 接手先读

1. [当前功能与算法](KnitScape_当前功能与算法.md) 与 [ARCHITECTURE](docs/ARCHITECTURE.md)：当前真实能力、Machine Domain边界。
2. [DOMAIN_AUTHORITY](docs/DOMAIN_AUTHORITY.md) 与 [LEGACY_MAP](docs/LEGACY_MAP.md)：owner、消费者、兼容源，不直接删Legacy。
3. [YARN_LENGTH_CONTRACT](docs/YARN_LENGTH_CONTRACT.md)：当前窗口函数、完整repeat诊断、预览统计的区别。
4. [PROCESS_VALIDATION](docs/PROCESS_VALIDATION.md)：七问、四类验证、物理数据来源六项原则。
5. [ROADMAP](docs/ROADMAP.md)：确认前允许项/禁令，确认后分支与关口；[本轮审计](reports/doc-alignment-2026-10-17/REPORT.md)记录文档冲突。

## 先确认已完成的软件基线 — FACT

P0已有SolverResult、PreviewValidity、合法/非法输入保护、明确Clear、UNREACHABLE_TARGET、Feed×Yarn独立目标、批量原子预检、feedYarnStructureRevision与regression validators。Final Audit是CONDITIONAL PASS，**不是生产纱长验证**。

原NEXT_TASK的“优先补机器设置持久化”已过时：当前getProjectData/package/import链已保存恢复排针、Cam、Gauge、Library与Feed targets。不要重复开发一套schema/持久化路径。SolverResult、PreviewValidity、runtime revision仍为派生/运行时数据，不保存为项目事实。

当前另有未提交Material Authority实现；保留并记录其来源，不以旧报告回滚，也不凭字段已存在宣称已完成验收。

## 当前阻塞的是工艺语义 — UNKNOWN / PENDING PROCESS CONFIRMATION

七问全部待工艺人员回答，唯一清单位于 [PROCESS QUESTIONS PENDING](docs/PROCESS_VALIDATION.md#process-questions-pending)。23/8的测量路径、100针边界、负载/静置、第二纱身份与预牵伸、Feed对应、数值类型都不能在MD里代答。

真实diameter、弹性曲线、摩擦、压缩、relaxation、finish后状态和PBR视觉参数另需来源，七问不会自动提供。工艺确认前Business Validation只能PENDING/UNKNOWN。

## 确认前可做的准备 — SUBJECTIVE / DESIGN DECISION

- Maintainability Audit：Domain authority、重复公式、Legacy、State owner、renderer fallback、依赖/死代码；不改行为。
- 维护Domain Authority Map；六项读数分别可观察：User Target、Current Solver Metric、Full Repeat Diagnostic、Preview Window Metric、Solver Status、Business Validation Status。目标是定位差异，不是修Solver。
- Fixture Freeze：合成fixture验证软件，真实SOP-001保存已知工艺；measurementSemantics、secondYarnPathSemantics、loadState允许UNKNOWN。原项目无20D，不把人工双纱fixture当作真实分配。
- Measurement Contract Skeleton：明确basis/needleSpan/yarnId/feedScope/pathScope/loadState/startBoundary/endBoundary/normalization/valueType/source/unit/evidence，不改现有schema。
- YarnTopology Spike：只验证MachineDomain→K/T/M→StitchTemplate→YarnSegment→YarnPath边界，不替换Simulation/正式Renderer，不拿23/8强校3D。

完整范围及DO NOT DO YET见 [ROADMAP](docs/ROADMAP.md)。禁止降低bound逼8收敛、把5/4cN直接变geometry force、做production relaxation calibration、假设20D是弹性纱、从denier/图高/透明区/肉眼猜直径、用PBR掩盖centerline、把full-repeat定为工厂authority、把MODEL_CONVERGED写成PROCESS_VALIDATED、新建第二Renderer或全面重构。

## 工艺确认后顺序 — SUBJECTIVE / DESIGN DECISION

先形成正式YarnLengthMeasurementContract，实施P0-C1 Canonical Yarn Length，使User Target→Canonical Measurement→Solver Objective→Independent Verification→UI Acceptance同义。

再按证据选择：同路径/测量/状态仍8不可达则先判断当前第二纱模型可能不足；不同路径则独立Second-Yarn Path/Placement；存在预牵伸/回缩则分Feed、Loaded、Relaxed Length。不得现在代选分支或把失败归咎SOP。

重新跑SOP-001，核对canonical length、独立复算、Feed×Yarn、失败状态、来源与repeat边界。Correctness Gate后依次做Architecture Consolidation、Material Authority、YarnTopology/YarnPath、xyz Centerline、Yarn Mesh、Physical UV/PBR、Real Fabric Calibration、必要时Relaxation/Contact，最后Fuzz/High Fidelity。路线不承诺结果或完成日期。

每次功能任务仍遵守AGENTS：从当前main核对开始，新增纯函数/针对性验证，保持Machine Domain唯一，并运行相关npm validate及build。本轮文档任务不继续实现上述任何阶段。
