# 阶段二：未执行

阶段一阻塞，按用户条件闸门没有启动阶段二。此记录仅说明未执行，不是浏览器往返验收报告。

- 本轮没有点击阶段二的真实导出、没有下载验收用新包、没有执行新建后选择下载文件重开。
- 新模式浏览器往返：未执行。
- 旧项目浏览器兼容：未执行。
- 实际下载包哈希、重开状态、包字段和版本/能力独立检查：无本轮阶段二证据。
- 未执行不等于产品代码失败、往返失败、旧项目兼容失败或工具权限阻塞。
- 阶段一B已真实导入既有SOP、通过UI Clear形成对照；这不是导出—新建—重新选择下载文件的往返，不能替代本阶段。
- 阶段零的自动包/JSON验证通过也不能替代本阶段。

独立角色已实际创建：[D准备记录](agents/browser-roundtrip-audit.md)、[E准备记录](agents/package-compatibility-audit.md)。两人未共同形成结论，也未越过前置闸门执行验收。

没有因为阶段一受阻而请求用户手工选文件：本次并未触发阶段二的工具权限阻塞分支。不得进入阶段三。

---

# 2026-10-21 追加：真实浏览器项目文件往返验收

以上为历史阶段二未执行记录，原样保留。本次用户明确授权独立进行文件往返验收，历史显示偏置交叉、端点间隙和完整穿插分类不再作为本次文件验收的前置条件；这些问题仍未解决。本次结果不代表几何通过或生产物理模型通过。

## 1. 开工、角色与复用

- 分支 `main`，HEAD `7ababf264d495f6b96d4d66652c529424938ac4d`。工作区有大量已有修改，不能称为干净基线。
- [开工快照](stage-2-baseline-2026-10-21.json)完整记录 `git status --short`、暂存状态、1,630 个已有文件哈希，以及其中 154 个源码、正式验证器、浏览器脚本、依赖和配置文件哈希；另记录 28 个既有 dist 文件。
- 已读 P0-C2 实施报告、未设置纱长状态修复报告、当前功能与算法、NEXT_TASK、原阶段二准备报告、现有浏览器验收脚本、SOP-001 完整双纱项目及工艺说明、现有包检查脚本。
- 执行角色 `/root`；当前智能体树没有可复用旧子会话，因此只新建一个独立复核角色 `/root/roundtrip_reviewer`。该角色真实独立执行包检查并审阅浏览器证据，没有操作浏览器；没有将执行者自检称为独立复核。
- 浏览器复用现有 `scripts/browser-yarn-length-input.mjs` 的只读 `read()` 字段与输入提交方法。没有修改该脚本，也没有新建浏览器框架。旧包检查脚本的特定 4×4 fixture 断言不适用于 SOP 的 4×8；复核复用正式 `readProjectPackage()` 和原工具使用的 ZipReader 检查原始 manifest/资产，没有新写导入器或解包器。
- 使用现有 Vite 配置启动真实产品 `http://127.0.0.1:5188/`。没有观察页、源码转换、测试入口、GLOBAL_STATE 注入或直接调用 loadJSON 替代 UI 导入。正式验证器自己的内部测试与真实浏览器验收分开计证。

## 2. 导出前项目与事实

通过产品“导入”按钮、浏览器 filechooser、正常文件选择加载已有完整双纱副本：

`reports/spandex-process-contract-implementation-2026-10-20/SOP-001-N6W6040-bare-spandex.knitscape`

源文件 SHA-256：`4082211c588918157944aa33182ef8f3c7db5004b219d80b0f3fd23c3ddfd677`。没有覆盖历史主纱项目，没有补填缺失参数。该副本已经具备任务要求的所有八路输入，因此只核对，不重新创建项目或批量重写事实。

| 项目 | 导出前冻结值 |
|---|---|
| Gauge / 预览尺寸 | 32G / 30×40 |
| 排针 | 输入 1234；已应用 `[1,2,3,4]` |
| Cam Type 1–4 | `KKKKKKTT`、`KKKKTTKK`、`KKTTKKKK`、`TTKKKKKK` |
| 每路主纱 | `yarn-1792072401481`，N6/W(6040)，directTarget，23 cm/100针 |
| 每路氨纶 | `sop001-bare-spandex`，20D裸氨纶，relaxedWithDraft，8 cm/100针、倍率3 |
| 每路派生目标 | 只读 `8 × 3.0 = 24`，24 cm/100针 |
| 求解与应用 | 16/16 CONVERGED、已应用，整体 VALIDATED |
| 既有张力 | 主纱5 cN、氨纶4 cN；现有UI不展示张力，通过真实包及重导出逐路核对 |
| 既有 PBR | 主纱已设置4项资产引用；氨纶未设置，保持未设置 |

数值的 Value、Unit、Source、Measurement/derivation principle、Confidence、Applicable state 沿用[既有SOP工艺说明](../spandex-process-contract-implementation-2026-10-20/SOP-001-process-contract.md)：23/8及3来自用户确认记录，未在本轮重新实测；24只由现有唯一Domain乘积派生。张力是独立记录，不参与长度派生。未知真实直径、物性未补“实测”。

冻结证据：[逐路UI](stage-2-before-export-ui.json)、[机器及输入DOM](stage-2-before-export-dom.txt)、[截图](stage-2-before-export.png)。

## 3. 真实下载与重新打开顺序

1. 点击产品“导出”→“KnitScape 项目 (.knitscape)”，等待实际 download 事件完成。
2. 记录真实下载路径、字节数及SHA；证据副本为原样复制，未生成或重新打包。
3. 关闭导出浮层，点击“新建”；记录[新建后状态](stage-2-after-new-ui.json)。新建按现有合同保留机器、库及相关输入，仍有16行；**这不是这些内容已经清空的证据**。
4. 点击产品“导入”，用 filechooser 选择同一个 `C:\Users\liuchen\Downloads\pattern.knitscape`；等待正常导入和仿真完成。
5. 新建独立浏览器页面。其[导入前状态](stage-2-independent-before-import-ui.json)为 DESIGN_PREVIEW、0条结果，默认48×60，没有上页成功结果。
6. 在该独立页面通过产品“导入”按钮再次选择相同下载文件。16条结果正常生成，机器和输入恢复。
7. 为验证UI未展示的张力及资产，在独立页面正常重导出为 `pattern (1).knitscape`，交独立角色比对。

| 实际文件 | 字节数 | SHA-256 |
|---|---:|---|
| `C:\Users\liuchen\Downloads\pattern.knitscape` | 2,699,945 | `62798005216371f79f9043652147ab7b1de9995bfc2501403925fbec9f831c9a` |
| `C:\Users\liuchen\Downloads\pattern (1).knitscape` | 2,699,945 | `55b5e9f3cdab3de423073d72bb59d1b25d3d2fbeb45b2eac882b5ef89c2a856d` |
| `C:\Users\liuchen\Downloads\pattern (2).knitscape`（旧项目导出） | 2,698,256 | `0168b47aeaee098964ca60c262f4c7d5bc376635530ec1620952d79f8222a280` |

元信息：[首次下载](stage-2-download.json)、[独立页面重导出](stage-2-independent-reexport.json)、[旧项目下载](stage-2-legacy-download.json)。原样证据包：[新模式下载](stage-2-actual-download.knitscape)、[重导出](stage-2-independent-reexport.knitscape)、[旧项目下载](stage-2-legacy-download.knitscape)。

## 4. 逐路重开比较与重新计算

首次导出前、新建后导入、独立页面导入的整个只读UI记录严格相等，含16个模式、长度事实、8个倍率、8个只读派生公式、目标、求解状态和应用标记。逐路 yarnId 与源SOP一致；Gauge、排针与32个Cam动作一致。

| Feed | 主纱模式/输入 | 氨纶模式/事实/派生 | 主纱模型显示值（前=两次重开） | 氨纶模型显示值（前=两次重开） |
|---|---|---|---:|---:|
| 1 | directTarget / 23 | relaxedWithDraft / 8、3 / 24 | 22.9999 | 24.0008 |
| 2 | directTarget / 23 | relaxedWithDraft / 8、3 / 24 | 22.9999 | 23.9996 |
| 3 | directTarget / 23 | relaxedWithDraft / 8、3 / 24 | 22.9999 | 24.0008 |
| 4 | directTarget / 23 | relaxedWithDraft / 8、3 / 24 | 23.0003 | 24.0007 |
| 5 | directTarget / 23 | relaxedWithDraft / 8、3 / 24 | 22.9998 | 23.9999 |
| 6 | directTarget / 23 | relaxedWithDraft / 8、3 / 24 | 23.0000 | 23.9999 |
| 7 | directTarget / 23 | relaxedWithDraft / 8、3 / 24 | 22.9998 | 23.9999 |
| 8 | directTarget / 23 | relaxedWithDraft / 8、3 / 24 | 22.9997 | 24.0000 |

全部为CONVERGED/已应用。证据：[新建后导入](stage-2-after-new-import-ui.json)、[独立页面导入](stage-2-independent-after-import-ui.json)、[独立页面DOM](stage-2-independent-after-import-dom.txt)、[逐路ID](stage-2-independent-assignments.json)、[比较结果](stage-2-browser-comparison.json)。

24在产品UI为 `<output>` 的只读派生值，没有独立可编辑24事实。包中不存在氨纶旧直接目标或派生目标；独立复核用现有 `resolveYarnLengthInput()` 从保存的8/3重新得到24，未复制派生公式。独立页面在导入前无结果，下载包不含SolverResult，导入后生成当前输入对应结果，支持“重新计算而非从文件恢复上次成功结果”的结论。

**精度边界**：浏览器求解值按现有 `toFixed(4)` 显示；本轮浏览器前后比较证明显示精度内没有漂移，不声称取得了未舍入Solver浮点数。持久化事实及资产是严格内容相等；未舍入数值保护另由现有正式SOP验证器覆盖，不能将其冒充浏览器采样。

![独立页面重新导入后的机器、输入与结果](stage-2-independent-after-import.png)

## 5. 最小输入保护

在独立页面的新模式项目重开后，通过真实键入、Enter提交执行：

| 动作 | 即时/稳定观察 |
|---|---|
| Feed1氨纶倍率3→3.2 | 即时DESIGN_PREVIEW，目标25.6000，旧值变“—”，状态“尚无当前结果”，未应用 |
| 等待重算 | VALIDATED，目标25.6000，模型25.5997，CONVERGED/已应用 |
| 点击明确“清除第1路第2根纱线的牵伸倍率” | PARTIAL，长度8保留，倍率空、目标和求解值“—”，长度输入未完成/未应用，反馈“牵伸倍率已清除” |
| 重新键入3.0 | 再次即时失效并重算；16条结果恢复到导出前相同显示值 |

证据：[立即失效](stage-2-ratio-immediate-ui.json)、[重算](stage-2-ratio-recomputed-ui.json)、[Clear](stage-2-clear-settled-ui.json)、[Clear截图](stage-2-clear.png)、[恢复](stage-2-newmode-restored-ui.json)。没有重新穷举全部安全输入；其他保护由正式验证覆盖。

## 6. 真实包独立检查

独立角色核验原下载路径与证据副本SHA一致，并复用正式包读取器及既有ZipReader检查方法。详见[包检查JSON](agents/stage-2-package-independent-check-2026-10-21.json)。

- `format=knitscape`、`version=3`、`requiredCapabilities=["relaxed-yarn-length-with-draft-v1"]` 正确。
- 8条氨纶Assignment保存 `lengthInputMode`、`relaxedLengthCmPer100Needles=8`、`draftRatio=3`，保留yarnId/placement/tensionCN=4；没有旧 `yarnLengthCmPer100Needles`、派生有效目标、SolverResult、PreviewValidity或运行时revision。
- 主纱8条directTarget23/tensionCN=5正确，Machine/Pattern/Library项目事实与原SOP相等。
- 四个既有PBR引用均有对应包条目，二进制SHA与源SOP相同。氨纶原本没有PBR，未补填。
- 独立页面重导出与初次下载的 `project.json` 及四张资产解压字节完全一致。ZIP整体仅20字节不同，来自条目修改时间及扩展时间戳；非时间戳元信息相同。不是项目数值漂移。
- “24不持久化”按氨纶Assignment字段归属判断；没有把整个文件中的合法数字24作为失败证据。

## 7. 旧项目真实兼容

通过同一真实产品“导入”选择历史主纱项目：`reports/sop-001/SOP-001-N6W6040-main-yarn-with-cam.knitscape`。源包2,698,240字节，SHA-256 `0d84dd7a3b7d408345015963279e5ea6548d501cbf84887d019a5f538b99eed8`。

源包8条Assignment缺少模式，按直接目标23显示，无倍率输入，不被自动认定为氨纶，8/8 CONVERGED/已应用。随后真实导出得到 `pattern (2).knitscape`，点击新建，再用产品导入选择这一下载文件。前后完整UI记录相等，原长度、分配、机器、Gauge和PBR保留。

原旧包张力本来是null，本轮仍为null，没有补5。旧包导出保持version2、无requiredCapabilities、无输入模式或倍率字段。独立角色发现并解释唯一规范化变化：原 `yarnLibrary[1].pbr.metallic` 缺省，现有归一化器输出 `metallic:null`，因此manifest增加16字节；未新增资产或物理参数。其余项目事实及4张PBR资产完全一致。

证据：[旧项目前](stage-2-legacy-before-export-ui.json)、[旧项目重开](stage-2-legacy-after-reopen-ui.json)、[截图](stage-2-legacy-after-reopen.png)、[独立检查](agents/stage-2-legacy-independent-check-2026-10-21.json)。这只证明新程序兼容此次旧包，不反向宣称旧程序能安全编辑新模式文件。

## 8. 控制台与工具限制

两页最终控制台error列表均为空，见[控制台记录](stage-2-console-errors.json)。没有发现本轮范围内需要停止并修复的产品缺陷。

本轮真实上传、文件选择、下载及独立页面访问均获得工具执行，没有权限阻塞，没有请用户代选文件，没有换浏览器/端口/CDP客户端绕过权限。保留两项工具事件：

1. 尝试从现有脚本字符串构造只读采集函数时，工具拒绝 `Code generation from strings disallowed for this context`；未重试动态代码生成，改为直接使用现有read()函数体的普通只读DOM调用。未触及应用状态或源码。
2. 倍率重算后执行Clear的同次工具调用出现一次 `Page.getFrameTree` 超时。没有重复点击或修改产品；下一次只读观察确认Clear实际完成、字段与反馈正确。即时Clear采样未取得，稳定Clear结果已验收；倍率修改的即时失效采样已取得。

2026-10-20的权限阻塞和上一轮阶段二未执行历史保持有效记录，不能改写为从未失败。本轮使用当前可用权限完成真实流程。

## 9. 本轮验证与文件保护

以下均为本轮新执行结果，未引用历史通过替代：

| 命令 | 本轮结果 | 日志 |
|---|---|---|
| `npm run validate:pbr-persistence` | PASS，exit0 | [相关专项](stage-2-related.log) |
| `npm run validate:project-load-lifecycle` | 105/105，exit0 | 同上 |
| `npm run validate:spandex-process-contract` | PASS，exit0；既有M1/M3精确数值保护通过 | 同上 |
| `npm run validate` | **41/41 PASS，exit0** | [全量](stage-2-validate.log) |
| `npm run build` | PASS，exit0 | [构建](stage-2-build.log) |
| `git diff --check` | PASS，exit0；既有LF/CRLF提示，无差异错误 | [差异检查](stage-2-diff-check.log) |

[执行汇总](stage-2-validation-results.json)记录命令、退出码和用时。[文件保护核对](stage-2-preservation.json)确认154个受保护文件SHA全部不变，未新增业务源码/模块/验证器/依赖；1,630个开工已有文件只有本报告追加改变，所有其他已有修改和证据保留。新增文件均在指定报告目录。仍为main及同一HEAD，暂存区为空。

**构建产物单独说明**：build确实重新运行；dist前后均28个文件，文件内容哈希全部相同，没有内容更新。它与“业务源码未变化”分别核对，没有把构建输出误报为业务源码修改。

两个本轮临时浏览器页面及5188开发服务已经关闭。用户下载包、历史项目、浏览器资料和本地资产未删除。没有提交或创建标签。

## 10. 独立复核及停止边界

独立角色已实际检查两个新模式真实下载包、旧项目真实下载包和浏览器证据，另独立计算154个保护文件和28个dist文件SHA、检查三张关键截图并审阅本轮命令日志。结论：**新模式与旧项目文件往返均通过，无本轮阻断项**。详见[独立复核报告](agents/stage-2-roundtrip-independent-review-2026-10-21.md)。本次独立复核不等同于最终集成审计。

| 最终分类 | 结果 |
|---|---|
| 新模式文件往返 | **通过** |
| 旧项目文件往返 | **通过** |
| 历史穿插问题 | **仍未解决** |
| 最终集成审计 | **待执行** |
| 提交及标签 | **未执行** |

历史显示偏置交叉、端点间隙以及完整穿插分类：**仍未解决**。生产物理模型：未由本轮验收。最终集成审计：**待执行**。提交及标签：**未执行**。不进入几何修复或三维。
