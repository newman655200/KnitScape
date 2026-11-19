# P0-C2 阶段二：独立文件往返复核

日期：2026-10-21（Asia/Shanghai）。独立角色：`/root/roundtrip_reviewer`。执行角色：`/root`。

**结论：本次新模式文件往返通过；本次旧项目文件往返通过；未发现本任务范围内的阻断项。** 本结论限于输入事实、项目文件、正常导入后的当前求解反馈及最小输入保护，不覆盖历史穿插、几何正确性或生产物理模型。最终集成审计仍待执行。

## 1. 角色、方法与证据边界

本角色实际独立读取了下载目录中的三个浏览器下载包，核对了报告目录中的原样副本，并执行包结构、资产字节、逐路字段和浏览器记录断言；另目视检查独立页面重开、Clear及旧项目重开三张截图。浏览器操作由执行角色完成，本角色没有第二次操作浏览器，没有把执行者自检写成独立操作。

复用正式 `src/actions/projectPackage.js::readProjectPackage()`，以及既有 `inspect-browser-export.mjs` 使用的 `@zip.js/zip.js` 原始 manifest/条目读取方式；派生值调用现有 `resolveYarnLengthInput()`。没有调用 `createProjectPackage()` 拼装本次下载物，没有写导入器、解包器、测试框架或业务模块，没有调用浏览器 `loadJSON()` 或注入应用状态。

独立检查明细保存于[新模式包检查](stage-2-package-independent-check-2026-10-21.json)和[旧项目包检查](stage-2-legacy-independent-check-2026-10-21.json)。数值来源、单位、适用状态与置信度沿用[既有SOP工艺说明](../../spandex-process-contract-implementation-2026-10-20/SOP-001-process-contract.md)，没有将软件检查冒充本轮工厂测量。

历史阶段二未执行和实施阶段的工具权限阻塞记录仍保留。本轮用户已明确允许独立进行文件验收，历史几何问题不构成本次验收的前置条件。

## 2. 实际下载物及新模式正式合同

| 实际下载文件 | 字节数 | SHA-256 |
|---|---:|---|
| `C:\Users\liuchen\Downloads\pattern.knitscape` | 2,699,945 | `62798005216371f79f9043652147ab7b1de9995bfc2501403925fbec9f831c9a` |
| `C:\Users\liuchen\Downloads\pattern (1).knitscape` | 2,699,945 | `55b5e9f3cdab3de423073d72bb59d1b25d3d2fbeb45b2eac882b5ef89c2a856d` |
| `C:\Users\liuchen\Downloads\pattern (2).knitscape` | 2,698,256 | `0168b47aeaee098964ca60c262f4c7d5bc376635530ec1620952d79f8222a280` |

三个下载包均与各自报告副本逐字节一致。前两个为新模式首次导出及独立页面导入后的重导出；第三个为旧项目正常打开后的导出。正式读取器均接受。

首次新模式下载包的整个原始 manifest 与既有完整双纱SOP包严格相等，含 Pattern、Library、Gauge、排针、Cam 和16个Assignment。确认：

- `format: knitscape`、`version: 3`、`requiredCapabilities: [relaxed-yarn-length-with-draft-v1]`。
- Feed1–8的主纱均为 `yarn-1792072401481`，`lengthInputMode: directTarget`、直接目标23 cm/100针、原张力5 cN、`placement: parallel`。
- Feed1–8的氨纶均为 `sop001-bare-spandex`，`lengthInputMode: relaxedWithDraft`、`relaxedLengthCmPer100Needles: 8`、`draftRatio: 3`、原张力4 cN、`placement: parallel`。
- 氨纶Assignment与上述精确字段集合相等，不含旧直接目标、派生有效目标、SolverResult、PreviewValidity或运行时revision。检查按字段归属执行，没有用搜索整个包中的数字24替代结构验证。
- Gauge32、排针 `[1,2,3,4]`，Cam四行为 `KKKKKKTT`、`KKKKTTKK`、`KKTTKKKK`、`TTKKKKKK`，均与源SOP一致。
- 现有唯一长度解析器从8和3得到24。实际UI中该值位于 `<output data-derived-feed ...>`；16个长度输入保存主纱23和氨纶8，8个倍率输入保存3，没有独立可编辑的氨纶目标24。

## 3. 独立页面重导出的张力与PBR保存

初次下载与独立页面重导出，五个条目的解压内容逐字节相同：`project.json` 及主纱的 baseColor、normal、roughness、ambientOcclusion。张力等UI未展示字段由两次真实导出包的完整manifest相等确认，未只依赖页面文字。

| 既有PBR槽 | 字节数 | SHA-256 |
|---|---:|---|
| baseColor | 578,155 | `e7edd170d0e181905c1b1e27aabc2062ec5621d48ab28afc1ee1c49284aadd55` |
| normal | 656,227 | `0e0040be7030aa28f340905c6ba12c18820d5489e72f10e2756f3de6e20021c2` |
| roughness | 759,035 | `bbbfc014d3bf0684c94166eacbfad8ddac626b9cb28d64d67c0d72b55aa04c0c` |
| ambientOcclusion | 700,119 | `918a016d9cb4d65cd9d19c0bf561a51d1dd94c3ae44d8f0e625a44ef6b1a216b` |

引用、文件名、MIME、尺寸和内容均保持；主纱现有 `physicalRepeatLengthMm: 22.987` 也在完整manifest相等范围内。氨纶原本没有PBR，重开后仍未设置，没有补填资产。

两个新模式包整体SHA不同，但仅20个封装字节不同；所有文件内容及非时间戳条目元信息相等。ZIP条目修改时间和扩展时间戳 `0x5455` 从 `2026-10-21T14:37:59Z` 改为 `2026-10-21T14:39:48Z`，解释了整体哈希差异，不是项目内容或数值漂移。

## 4. 真实重开与求解证据

本角色独立读取并断言[导出前记录](../stage-2-before-export-ui.json)、[新建后记录](../stage-2-after-new-ui.json)、[新建后导入](../stage-2-after-new-import-ui.json)、[独立页导入前](../stage-2-independent-before-import-ui.json)、[独立页导入后](../stage-2-independent-after-import-ui.json)和[逐路yarnId](../stage-2-independent-assignments.json)：

- 新建后机器和纱线库相关输入保留，符合当前合同；不把新建视为这些内容已经清空的证据。
- 独立页面导入前为 DESIGN_PREVIEW，模式、长度输入、倍率、派生输出和结果行均为空，结果行数为0。
- 两次正常文件导入后的全部UI记录与导出前严格相等：16个Assignment模式/长度输入、8个倍率、8条 `8 × 3.0 = 24`、16条CONVERGED/已应用及对应当前目标。
- 16条yarnId全部与源SOP及下载manifest匹配。截图和DOM与机器、模式及当前结果证据一致。
- 下载包不含求解结果；独立页面由0结果到导入后16条当前结果。结合参数修改的即时撤销与重算证据，支持结果由当前输入重新生成，不是恢复文件中的上一次成功状态。

**精度边界：** UI使用现有 `toFixed(4)` 展示目标和求解值。浏览器前后相等仅证明四位小数显示精度内无漂移；不声称浏览器未舍入浮点结果逐位相等。持久化事实和PBR内容为严格相等；未舍入M1/M3保护来自本轮实际运行的既有正式SOP验证器，证据种类分别陈述。

## 5. 最小保护及工具事件

独立核对[倍率立即变化](../stage-2-ratio-immediate-ui.json)、[倍率重算](../stage-2-ratio-recomputed-ui.json)、[Clear稳定状态](../stage-2-clear-settled-ui.json)及[恢复原输入](../stage-2-newmode-restored-ui.json)：

1. Feed1第二纱倍率3改为3.2后，立即DESIGN_PREVIEW，16行旧求解值均为“—”、尚无当前结果、未应用；新派生目标为25.6000。
2. 重算后VALIDATED，该槽求解显示25.5997、CONVERGED/已应用，其他15行与原记录相等。
3. 明确Clear倍率后，放松长度8保留，倍率为空，目标/求解值为“—”、长度输入未完成、未应用，整体PARTIAL；其他15行仍与原记录相等。与最新未设置纱长状态合同一致。
4. 恢复3后全部记录回到导出前状态。

已独立读取[控制台记录](../stage-2-console-errors.json)，两页error列表均为空。本角色未另外采集控制台，结论限于执行角色保存的实际采集范围。

本轮文件选择、下载和独立页面导入未被权限阻塞。执行报告保留了字符串动态代码生成被工具拒绝，以及Clear后一次 `Page.getFrameTree` 超时；后者没有重复点击，后续只读观察确认Clear稳定结果。未取得即时Clear采样，未将其写成已采样；要求中的“修改倍率后立即失效”已有独立的实际记录。上述事件没有被隐藏，也没有用产品修改绕过。

## 6. 旧项目兼容与已解释差异

历史输入为 `reports/sop-001/SOP-001-N6W6040-main-yarn-with-cam.knitscape`，原包SHA-256为 `0d84dd7a3b7d408345015963279e5ea6548d501cbf84887d019a5f538b99eed8`，2,698,240字节。

本角色检查该原包和实际 `pattern (2).knitscape`，并断言[旧项目前](../stage-2-legacy-before-export-ui.json)与[旧项目重开后](../stage-2-legacy-after-reopen-ui.json)整个UI记录严格相等。8条Assignment缺模式时由现有解析器沿用directTarget23，无倍率字段或输入，不自动认定为氨纶；8条CONVERGED/已应用，显示结果也与新模式项目的8条主纱相等。原张力 `null` 保留，没有补5。

导出继续为version2，无 `requiredCapabilities`、新模式或倍率字段；原长度、分配、Cam、排针、Gauge及4张PBR资产保留。

唯一manifest差异为 `yarnLibrary[1].pbr.metallic` 从属性缺省变为 `null`，增加16字节。已核对现有 `normalizeYarnPbr()` 遍历全部 `YARN_PBR_MAP_KEYS` 并在 `source == null` 时输出 `[key, null]`。这是空PBR槽的现有规范化，没有新增资产、物理值或数值漂移；其余事实严格相等。本结论不反向保证旧程序能安全编辑version3新模式文件。

## 7. 验证、文件保护及主报告复核

本角色实际阅读本轮[命令退出码](../stage-2-validation-results.json)及日志，未将历史41/41当作本轮结果：

| 检查 | 本轮证据 |
|---|---|
| 现有项目持久化专项 | pbr-persistence、project-load-lifecycle、spandex-process-contract均exit0；load lifecycle为105/105 |
| `npm run validate` | 本轮日志第457行 `41/41 validators passed.`，exit0 |
| `npm run build` | 748模块构建成功，exit0 |
| `git diff --check` | exit0；既有LF/CRLF提示不是差异错误 |

上述验证由执行角色运行，本角色审阅实际日志与退出码，没有声称独立重跑全部验证。独立包/UI断言由本角色另行实际执行，均通过；本角色也实际执行过 `git diff --check`，exit0。

本角色再次逐个计算[开工快照](../stage-2-baseline-2026-10-21.json)中154个受保护文件SHA，全部不变，包含业务源码、正式脚本、浏览器脚本、依赖、配置、样式及index.html。对28个开工dist文件另算SHA，全部相等。审阅[完整保护记录](../stage-2-preservation.json)确认已有文件仅本阶段报告追加改变，没有报告目录外新增项目文件；构建确实执行，但dist内容无变化。工作区原有未提交修改仍在，HEAD保持 `7ababf264d495f6b96d4d66652c529424938ac4d`，分支main，暂存为空。

主报告关于只读24、旧metallic空槽规范化、四位显示精度、历史阻塞、工具超时及几何/物理边界的表述与本角色核查一致。未发现需停止本轮文件验收的产品缺陷。

## 8. 最终状态

| 项目 | 独立复核结论 |
|---|---|
| 新模式文件往返 | **通过**：真实下载、新建后重开、独立页重开、包与重导出检查完成 |
| 旧项目文件往返 | **通过**：真实打开、导出、新建后导入同一下载文件完成 |
| 自动化权限阻塞 | 本轮无文件流程阻塞；工具事件及采样边界已记录 |
| 历史显示偏置交叉、端点间隙、完整穿插分类 | **仍未解决** |
| 生产物理模型 | 未由本轮验收 |
| 最终集成审计 | **待执行** |
| 提交及标签 | **未执行** |

本角色到此停止，不进入提交、标签、几何修复或三维。
