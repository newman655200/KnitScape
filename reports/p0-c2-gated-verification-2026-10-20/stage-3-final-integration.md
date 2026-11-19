# 阶段三：未执行

阶段一阻塞，阶段二未执行，因此阶段三最终集成审计没有启动。本文件是闸门未执行记录，不能引用为集成通过证据。

- 从HEAD以来的累计业务修改范围、重复逻辑、所有旧项目兼容矩阵、模式互斥和缓存失效的最终集成验收：未完成本阶段独立审计，不作PASS判断。
- 阶段零运行本轮全部41个validate脚本与build均通过；这些是开工工作区的软件回归证据，不是阶段三已执行。
- 本次阶段一仅新增报告内分析脚本、数据和截图；所有1,520个既有文件的保护比较见[preservation-check.json](preservation-check.json)。本轮未新增src模块或依赖，不等于对HEAD以来全部累计修改已经作出范围批准。
- F角色已经实际创建，只形成[独立准备记录](agents/final-scope-audit.md)，没有提前执行本阶段。
- 没有生成提交候选清单，没有暂存、提交或标签；未进入YarnTopology或三维。

G对是否允许建立基线的正式裁决见[裁决报告](agents/final-baseline-verdict.md)。


---

## 2026-10-22 数据合同最终集成审计

**裁决 A：允许进入数据合同基线提交步骤。此项资格不授权本轮提交。** 范围为长度输入语义、唯一有效目标派生、输入/结果状态、持久化及兼容性。依据本轮用户明确分离的数据合同验收范围，原阶段一几何总闸门仍为 **FAIL / BLOCKED**；上方历史未执行记录保留，不改写成从未失败。

本轮由主审 /root 和复用的独立反方 /root/roundtrip_reviewer 两个真实角色执行。独立角色先检查关键源码与累计差异，再收到候选清单和主审验证结果；没有重建七个角色。独立结论见 [本轮反方报告](agents/stage-3-adversarial-review-2026-10-22.md)。

### 1. 工作区与累计范围

开工分支 main，HEAD为 7ababf264d495f6b96d4d66652c529424938ac4d；暂存区为空。52个tracked文件修改、1497个untracked文件，工作区不是干净基线。开工diff为1448行增加/350行删除，diff-check exit0。[开工完整记录](stage-3-baseline-2026-10-22.json)保存branch、HEAD、status、stat、staged、全部路径和1669个既有文件SHA；没有只看git diff遗漏未跟踪实现。

[逐文件清单](candidate-commit-files.txt)为85个候选：A业务32、B验证/配置/正式文档36、C固定测试数据4、D精选文字证据13。每项列出tracked状态、批准任务、纳入理由、必要依赖和生成内容。[全量归属台账](stage-3-file-inventory.json)逐项覆盖开工52+1497路径及28个dist产物；无需归属的用户资料未混入候选。

| 累计任务 | 主要归属与依赖 | 本次裁定 |
|---|---|---|
| P1-1材料权威 | yarnMaterial、Asset可选color/diameter、Metallic、逐槽直径/材质、对应验证；依据已有2026-10-15计划及p1-1记录 | 已批准的累计前置实现，进入同一工作区基线；不称为本次长度模式新增 |
| P0-C0 Gauge | machineGauge Domain、State/import/metrics/solver/geometry接线、专项 | 必须一起纳入；Solver自HEAD以来确有Gauge验证接线，非算法或容差改写 |
| P0-C0加载和引用完整性 | import异步意图、真实错误传播、New的Undo历史边界、palette/sequence校验、lifecycle回归 | 保留已有修复，未扩展加载事务系统 |
| P0-C0可观察性与文档 | 窗口/积分计数、readout、Code Guide根路径与生成行号、相关文档断言 | 数值和生产边界必须保留；generatedLines是必要生成配置，不是dist |
| P0-C2长度数据合同 | Domain/actions/batch、Simulation目标适配、来源缓存、UI反馈、v3持久化及兼容回归 | 本阶段主体 |
| P0-C2未设置长度修复 | 原requiredTargets构造点、既有input与multi-yarn验证器 | 保留批准修复及真实错误保护 |

上述前置任务的批准/范围依据沿用原报告：lifecycle-stale-async-fix、file-load-error-boundary、new-undo-consistency、yarn-sequence-reference-integrity、gauge-authority-fix、material-diameter-contract、material-validator-dom-stub-fix、renderer-material-boundary、yarn-length-observability、code-guide-doc-validator-cleanup、doc-alignment各目录的REPORT.md，以及docs/superpowers/plans/2026-10-15-p1-1-material-authority.md。文件多不自动等于过度设计，未把同一混合文件的前置职责误称全部属于P0-C2。

### 2. 长度事实、唯一派生及消费链

核对链路为 Assignment → src/domain/yarnLengthInput.js::resolveYarnLengthInput → Simulation.lengthInputs/solverLengths → 数值Solver输入 → 带lengthInput来源的逐槽结果 → requiredTargets/PreviewValidity → getYarnLengthFeedbackRows与编辑器 → prepareProjectForSave/normalizer → 正常加载。

- directTarget以Assignment.yarnLengthCmPer100Needles为激活事实；relaxedWithDraft以同一路Assignment的relaxedLengthCmPer100Needles、draftRatio为事实。
- 生产乘积派生唯一位于现有长度Domain。编辑动作、批量预检、Simulation和反馈复用它，没有根据纱线名称猜模式，没有把每路倍率放入YarnAsset。测试中的预期计算及独立路径积分只属验证，不是第二套生产公式。
- Solver只消费数值目标，不识别纱种或模式。其旧字段读取来自Simulation构造的数值视图，不是遗漏读取Assignment旧直接目标；metrics同样是数值适配边界。
- 模式切换删除三种旧长度事实，不互相复制；新模式归一化与保存不残留直接目标。派生24在UI为output，只读；不作为独立项目事实持久化。
- 输入、模式、倍率改变通过现有dispatch立即清空旧结果/状态来源；缓存键包含lengthInputs来源签名，8×3改成10×2.4也更新来源。反馈拒绝仅目标相等但来源不同的结果。参数变化不递增结构revision；换纱/结构替换仍按既有身份合同处理。
- 张力是独立记录，不参与长度推导。±2%是SOP抽样QC，不进入Solver容差；默认仍为0.01模型单位，32G下0.00079375 cm/100针。

没有发现遗漏的正式消费者把新模式当旧直接长度，也没有发现新建平行状态、求解器、缓存或持久化系统。累计新增两个业务Domain模块machineGauge和yarnMaterial属于已批准前置任务；P0-C2复用已有长度Domain。未发现产品调试注入、临时按钮或测试后门。Node验证器的DOM替身、Vite观察transform局限于脚本，不作为真实浏览器验收替代。

### 3. 未设置状态与旧断言审查

复用正式validate-yarn-length-input-integration及failure/multi-yarn等回归。本轮未修改任何断言。

| 情况 | 当前批准合同及本轮结果 |
|---|---|
| 全部无有效目标；新模式两项均空或只填一项 | DESIGN_PREVIEW、无SolverResult；逐槽保留NOT_SET/INCOMPLETE反馈 |
| 主纱成功且新模式未完成 | PARTIAL；只有真实主纱结果 |
| 直接模式空槽与其他成功目标 | 沿用直接模式空槽不形成要求的旧合同 |
| 合法但不可达目标0.5 | UNREACHABLE_TARGET、INVALID、未应用 |
| 无目标但排针Type4超过3针道 | INVALID且明确机器错误，不被无目标逻辑屏蔽 |
| 非法编辑或导入 | 拒绝并保留旧合法输入/状态；不启动新增求解 |
| 模式切换、Clear、重载、补齐；未使用Feed48有目标 | 旧来源失效；重算和有效参与Feed边界正确 |

已核对上一轮[状态修复记录](unset-length-preview-state-fix.md)与当前差异。被同步的旧断言只涉及全不完整场景原INVALID期望，它与批准的无有效目标DESIGN_PREVIEW冲突；混合PARTIAL、不可达、真实机器错误、非法输入保护仍在。本轮没有借“无目标”屏蔽其他错误。

### 4. 等价输入与证据精度

复用effective-target-comparison.json的C场景：旧主纱direct23+第二纱direct24，对照当前主纱direct23+第二纱relaxed8/draft3。Cam、1234排针、32G、30×40、Feed/Yarn、有效材料直径、窗口与边界一致，comparableInputHash相同。本轮重新计算该证据所列151个源码/脚本SHA，全部与当前一致。

逐项比较16条结果的全部既有字段严格相等；只将预期新增的lengthInput工艺来源另行核对，没有把整个对象新增元数据误判为数值漂移。raw、resolved、strips、topology、order、resolvedDiameters及投影命令hash相等。详见[本轮冻结证据复核](stage-3-evidence-review.json)。这不是把直接8与派生24比较，也不证明所有几何物理正确。

证据层级分别为：保存事实/项目manifest及资产严格内容相等；真实浏览器结果为toFixed(4)显示一致；既有冻结C结果为上述字段严格相等；正式SOP验证另保留M1/M3各自零漂移。M1与M3彼此仍不一致，不因两者各自无漂移而称统一。真实浏览器没有采集未舍入浮点数，不能从四位显示推广到逐位相同。

### 5. 文件往返与兼容复核

已读取[最新真实浏览器报告](stage-2-browser-roundtrip.md)、[对应独立复核](agents/stage-2-roundtrip-independent-review-2026-10-21.md)、实际包检查及逐路UI记录。本轮只补核当前下载哈希，未重复制造浏览器材料。

C:/Users/liuchen/Downloads/pattern.knitscape 当前仍存在。本轮实际读取大小2,699,945字节，SHA-256为 **62798005216371f79f9043652147ab7b1de9995bfc2501403925fbec9f831c9a**，与既有真实下载证据一致。

真实流程已覆盖导出 → 新建 → 产品导入选择同一下载文件，以及独立页面正常文件导入并重新求解。独立页面导入前0结果、DESIGN_PREVIEW，包中无SolverResult，之后16条当前输入结果；New保留机器/库的合同没有被误当清空证据。主纱23、新模式8/3及只读派生24、8路双纱yarnId、4×8 Cam、排针、Gauge、原张力5/4及4项PBR均保留。两页console error为空，倍率变化即时失效、Clear稳定反馈完成；历史工具阻塞和一次Clear后读取超时仍在原报告，不抹去。

新模式包version3与requiredCapabilities=[relaxed-yarn-length-with-draft-v1]正确；氨纶Assignment只存活动事实及原yarnId/tension/placement，无派生目标、旧直接目标、结果、PreviewValidity或revision。判断按字段归属，不按全文件数字24搜索。正式SOP脚本另有固定fixture的全局24附加断言，它不能证明一般格式语义，本次不以它替代结构验证，也未修改它。

旧项目实际导入、导出和同一下载文件重开已通过；缺模式沿用direct23，不猜氨纶、不要求倍率，导出仍v2。旧张力原null仍null。仅yarnLibrary[1].pbr.metallic由缺省归一化为null，manifest多16字节；独立复核已逐项排除其他事实/四个PBR资产变化，没有以该解释放过其他差异。

兼容结论限于：**当前新程序兼容已验旧文件，并拒绝不支持的版本或能力。** 未实测所有旧客户端，不声称所有旧程序必定拒绝或安全编辑新模式文件。

### 6. 候选依赖、排除项与维护性

5项reports运行依赖全部进入候选，不能删除或被通用reports排除规则漏掉：

| 依赖 | 分类 / 消费者 |
|---|---|
| yarn-length-semantics-audit-2026-10-16/independent-auditor.mjs | B，正式spandex验证导入现有独立积分器 |
| sop-001/SOP-001-N6W6040-main-yarn-with-cam.knitscape | C，spandex验证原SOP输入与不可变性核对 |
| spandex-length-semantics-2026-10-20/results.json | C，旧direct8诊断冻结期望 |
| spandex-process-contract-implementation-2026-10-20/SOP-001-N6W6040-bare-spandex.knitscape | C，input集成回归完整双纱输入 |
| p0-c2-gated-verification-2026-10-20/root-cause-regression.json | C，input集成回归current/C冻结数值 |

7个未跟踪src/scripts文件、8个docs、上述5项全部纳入。没有新依赖，package-lock未变。现有模块职责检查和正式验证已运行；另通过rg、Git路径清单、直接相对import与report读取关系核对，候选运行引用缺项0。独立角色另核对134条相对引用。没有专用候选打包工具，因此没有新建打包框架；**未执行干净目录运行验证**。

明确排除E类dist28文件、三个真实浏览器下载包及副本、大图/截图/临时日志、路径快照和其他历史证据。两份C类SOP固定包虽含资产且较大，仍是正式测试依赖，明确例外。F类38项为面料放大.jpg及两组既有可视化资料，保留不提交。其他证据保留本地，不删除覆盖。尚无法归属的业务源码/验证器/配置为0。

D类只选13份合同/阶段/独立审查文字记录与清单；完整历史附件不全部进入候选。候选报告中的部分历史附件链接仍指向本地证据档案，**不宣称候选是可移植的完整历史证据归档**。这不影响上述正式测试运行依赖闭合。

### 7. 本轮实际验证及保护

主审统一执行一次，各命令exit0；未为凑41改注册项或测试。8项专项为spandex-process-contract、yarn-length-input-integration、yarn-length-result-integration、yarn-length-batch-integration、yarn-length-structure-integration、yarn-length-failure-integration、pbr-persistence、project-load-lifecycle（105/105）。全量 **npm run validate：41/41**，**npm run build：PASS**，**git diff --check：PASS**。详情见[执行汇总](stage-3-validation-results.json)、[专项](stage-3-related.log)、[全量](stage-3-validate.log)、[构建](stage-3-build.log)、[差异检查](stage-3-diff-check.log)。

本轮测试失败0；新增实现失败0；环境阻断0；未查清测试失败0。Lit开发模式提示及既有LF/CRLF提示不是失败。历史几何分类/材料显示合同待定是已知范围限制，未通过修改断言消除。

[收尾保护核对](stage-3-preservation.json)分别记录业务源码、正式验证器/依赖/配置和构建产物哈希。业务源码及验证断言未改；HEAD、branch、暂存区保持；新增/更新仅原报告目录。构建实际重跑，28个dist内容哈希均与开工相同。已有工作区修改和用户文件保留，没有reset/checkout/stash/clean/暂存/commit/tag/push。

### 8. 独立验收裁决及保留限制

主审与独立反方均未发现本阶段产品、累计归属或运行依赖阻断。既有材料显示的LEGACY_COMPANION_CONTRACT、SEQUENCE_MASK_CONTRACT仍NEEDS_CLARIFICATION；真实直径未标定。它们不由长度模式决定，不作为本次明确分离的数据合同新失败，也没有被标为已解决。

**A：允许进入数据合同基线提交步骤。** 仅授予下一条明确提交指令前的资格。本轮到此停止。

| 最终项目 | 裁决 |
|---|---|
| 氨纶数据合同最终集成审计 | **通过** |
| 数据合同基线提交资格 | **具备** |
| 历史穿插与几何分类 | **未解决**；原阶段一闸门FAIL / BLOCKED不变 |
| 完整生产物理验证 | **未建立**；双纱三维、M1/M3统一、氨纶回缩及生产预测精度不在通过范围 |
| 本轮提交及标签 | **未执行** |
