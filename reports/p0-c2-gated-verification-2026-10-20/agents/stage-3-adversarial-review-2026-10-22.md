# P0-C2 最终集成独立反方复核

2026-10-22，Asia/Shanghai。复核角色：`/root/roundtrip_reviewer`；执行/主审角色：`/root`。复用阶段二独立角色，没有另派角色。分支 `main`，HEAD `7ababf264d495f6b96d4d66652c529424938ac4d`。

**判定：允许进入氨纶数据合同基线提交步骤。** 未发现需要阻止该数据合同及当前候选范围的真实产品缺陷。本判定是提交范围确认；本轮未暂存、提交或创建标签。历史显示偏置交叉、端点间隙、完整穿插分类仍未解决；材料兼容显示合同及生产物理模型未因此通过。

## 1. 独立性与方法

先独立读取 HEAD 至当前工作区的关键累计源码差异、调用方和正式验证器，再接收主审候选及结论。未把主审说明当作独立源码发现；没有再次操作浏览器、修改业务实现或正式验证器。此角色本轮仅新增本报告。

审阅覆盖长度 Domain、Assignment actions、批量、结构 revision、反馈、Simulation/cache、结果应用完整性、PreviewValidity、保存加载，以及未设置回归和失败保护。另核对既有等价目标冻结数据、对应源码哈希、阶段二真实下载包结论及当前候选依赖。统一命令由执行角色运行；本角色读取其本轮日志和退出码，没有声称自己重复执行全量测试。

## 2. 数据合同与失效保护

| 核对点 | 独立结论及依据 |
|---|---|
| 单一派生入口 | `src/domain/yarnLengthInput.js:25` 的 `resolveYarnLengthInput()` 统一产生有效目标与来源签名；`8 × 3 = 24` 的乘法只存在于该 Domain 入口。Solver 消费适配后的数值目标，不解释倍率、材料名称或张力。 |
| 模式互斥 | `normalizeYarnLengthFields()` 只保留活动模式事实。缺少模式的旧 Assignment 仍为 directTarget；新模式不会由 yarnId、名称或数值推断。模式切换清除前一模式事实，不把 23 或派生 24 偷换成新模式实测值。 |
| 输入与 Clear | 非有限值、负值、溢出/下溢等被原子拒绝；明确 Clear 产生未设置事实。新模式只有 8 或只有倍率时不伪造另一个参数。对应 actions 在改动时同步清空旧结果。 |
| 等积来源变更 | `8 × 3` 改为 `10 × 2.4` 虽然仍为 24，来源签名与缓存输入均改变；当前反馈拒绝旧来源结果。模式、有效目标和来源事实均进入既有缓存键。 |
| 结构与批量 | 普通参数编辑不伪造结构 revision；换纱清除旧测量事实，结构替换使旧定位失效。同模式批量先检查全部槽位再提交，混合模式、过期模式及最后一项溢出不能造成半提交。 |
| 求解成功条件 | `src/simulation/yarnSimulation.js` 每次重新评估实际路径应用；缓存命中也先清除旧 applied 标记。`previewValidity.js` 仍要求 CONVERGED、applied、有限数值及误差合同；ERROR、MAX_ITERATIONS、不可达目标、未应用路径与非法机器输入不被降格为成功。 |
| 未设置回归 | 无有效目标时为 DESIGN_PREVIEW、结果为空；主纱有目标而新模式事实未齐时为 PARTIAL；事实齐全后才有 16 条结果。真实机器错误仍为 INVALID。实际 SOP 经 importer/actions/runner 的正式回归覆盖这些分支。 |
| 持久化 | `prepareProjectForSave()` 供 JSON 与包导出共用。新模式为 v3，声明 `relaxed-yarn-length-with-draft-v1`；Assignment 保存模式、8、3，不保存有效目标、旧直接目标或 SolverResult/PreviewValidity/revision。兼容检查在提交加载状态之前执行。旧直接模式包保持 v2 兼容；不据此宣称旧程序能安全编辑 v3。 |

Machine 纯函数、执行 adapter、执行输入模块及 PreviewValidity 核心判定相对 HEAD 没有修改。累计 Solver 差异是既有 Gauge 接线，并未加入牵伸力学。累计几何/渲染差异包含早期材料直径和显示适配，不能统称本轮 P0-C2 修改，也不能说 HEAD 以来从未改变这些文件。

## 3. 等价输入与浏览器证据

独立核对 [effective-target-comparison.json](../effective-target-comparison.json) 的场景 C：旧输入是主纱 direct 23、第二纱 direct 24；当前输入是主纱 direct 23、第二纱 relaxed 8 / draft 3。16 条结果的全部既有数值、状态与应用字段严格相等；新增 `lengthInput` 元信息另行核对为正确模式、8、3、派生 24，不能将旧结果缺少该新元信息误报成数值漂移。raw、resolved、strips、topology、order、resolvedDiameters 及投影命令哈希均相等。冻结证据的 151 项源码/脚本哈希与当前一致。

这不是旧 direct 8 与新有效 24 的错误对照；也不是完整穿插分类或 GPU 像素正确性的证明。场景 B 的旧 VALIDATED / 新 PARTIAL 是新增未齐事实合同的预期状态差别。

阶段二浏览器与真实包检查沿用本角色已完成的 [独立复核](stage-2-roundtrip-independent-review-2026-10-21.md)：新建后导入、独立页面导入、新模式事实及 16 槽分配、旧包真实往返均已通过；实际导出文件、资产及张力检查有独立包证据。独立页面导入前没有结果，导入后重新计算。新模式目标 24 为只读 output，非独立编辑事实。

浏览器数值相等只到界面四位显示精度，不能扩张为浏览器隐藏浮点位逐位相等；原始数值严格比较由上述冻结对照和正式回归提供。旧包 `metallic` 缺失规范化为 null 是既有空贴图合同，不是丢失已有贴图。独立页面重导出 ZIP 的整体哈希变化来自封装时间元信息，五个实际条目字节均相同。

正式 spandex 验证器另有整段 JSON 搜索数值 24 的窄 fixture 断言；它不构成“24 不持久化”的通用结构证明。本结论依据 Assignment 精确白名单断言、生产保存入口及真实包结构检查，不以全文件搜索数字代替字段语义。未修改该既有验证器。

## 4. 候选范围与依赖

已独立复核 [candidate-commit-files.txt](../candidate-commit-files.txt) 与 [stage-3-file-inventory.json](../stage-3-file-inventory.json)：85 个路径唯一，包含 52 个 tracked 累计修改、7 个 untracked src/scripts、8 个正式文档、5 项正式验证 report 依赖及 13 项精选文字证据。最终分类为 **A32 / B36 / C4 / D13**；两个 Code Guide JSON 按配置/生成数据归 B，路径没有变化。

累计来源包括已开展的 P1 材料、Gauge、加载生命周期、sequence 引用、可观察性/文档及 P0-C2。本轮没有通过重命名范围掩盖此前实现。实际候选源码/脚本的 134 个相对引用经既有扩展名/index 解析，由 HEAD 或候选文件满足；验证器内三个用于源码断言的 import 字符串按测试资料识别，未误当运行依赖。未发现漏选修改源码或新增模块。

五项必须随正式验证器保留的资料均已纳入：

- `reports/yarn-length-semantics-audit-2026-10-16/independent-auditor.mjs`：既有独立路径积分工具，属于测试，不是第二套生产派生。
- `reports/sop-001/SOP-001-N6W6040-main-yarn-with-cam.knitscape` 与 `reports/spandex-process-contract-implementation-2026-10-20/SOP-001-N6W6040-bare-spandex.knitscape`：两个固定 SOP 回归包。
- `reports/spandex-length-semantics-2026-10-20/results.json` 与 `reports/p0-c2-gated-verification-2026-10-20/root-cause-regression.json`：正式回归读取的冻结期望。

两个固定 SOP 包不能与应排除的浏览器实际下载证据混淆。dist、大图/截图、临时日志、实际下载包及用户参考图保持本地，未被删除。此次为静态依赖闭合审查，**未执行干净检出运行**；精选报告仍引用本地保留的完整历史附件，不宣称全部证据链接可移植。

## 5. 材料与历史闸门

独立重读 Renderer / Material Boundary 报告后，未把历史 BLOCKED 直接套用为本轮阻断。待澄清事项是单槽 Asset 字段出现时 legacy companion 与 sequence mask 的显示取舍；既有 48 例保留 explicit assignment 数量，并记录同有效直径几何不变。新长度模式不参与材料 presence 判定，未发现由它引起的身份、目标或保存加载破坏。

候选可保留这些明确归属的前置实现，但 `LEGACY_COMPANION_CONTRACT` 与 `SEQUENCE_MASK_CONTRACT` 仍为 NEEDS_CLARIFICATION。数据合同提交资格不批准这些未定显示合同。历史显示偏置交叉、端点间隙及完整穿插分类仍未解决；真实物性、张力力学、生产纱长 authority 及三维均未验收。

## 6. 本轮验证与最终裁决

本角色读取 [stage-3-validation-results.json](../stage-3-validation-results.json) 和对应原始日志：spandex、input、result、batch、structure、failure、PBR persistence、project load lifecycle 八项专项均 exit 0；[全量日志](../stage-3-validate.log) 第 459 行为 **41/41 validators passed**、exit 0；build exit 0；diff check exit 0，仅既有 LF/CRLF 提示。没有把历史通过冒充本轮执行。

复核时 HEAD/main 保持上述值，暂存区为空。此角色未修改业务、依赖、正式验证器或冻结数据。本轮源码及构建产物的开工/结束保全由主审统一快照记录；本报告不将工作区原有累计修改称为干净 HEAD。

**最终独立结论：允许进入氨纶数据合同基线提交步骤；数据合同及候选运行依赖无确认阻断项。** 本轮停止于审计和范围确认，不执行暂存、提交、标签，不关闭历史几何/材料合同/生产模型问题。

收尾复核：已核对主审 `stage-3-final-integration.md`、`FINAL_REPORT.md` 的最新追加结论与 `stage-3-preservation.json`，范围、85 项候选及保留限制均与本独立结论一致；154 项保护文件未变、开工 1669 项仅两份主报告追加、28 项 dist 内容未变、HEAD/main/空暂存区保持的记录相符，无新增分歧。
