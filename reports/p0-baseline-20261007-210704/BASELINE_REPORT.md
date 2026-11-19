# KnitScape P0 Baseline 建立报告

项目：`C:/Users/liuchen/Desktop/knitscape`。分支：`main`。本次仅执行用户授权的 baseline 建立，未修改业务实现。

## 1. Baseline commit hash

`7ababf264d495f6b96d4d66652c529424938ac4d`

原 HEAD / 新 commit 的 parent：`29b7e4bcfaee6c9b7f3df070b24c200b7aa56103`。未 amend 历史 commit。

## 2. Commit message

`feat: establish trusted feed yarn length workflow`

## 3. Tag 名称

`baseline-trusted-yarn-length`，annotated tag。

注释：`Trusted feed yarn length workflow baseline`

## 4. Tag 指向 commit

`7ababf264d495f6b96d4d66652c529424938ac4d`

tag object：`7d33fe763c779989f92014ca29479dbb7d61e252`。
`git cat-file -t refs/tags/baseline-trusted-yarn-length` 返回 `tag`。
`git rev-parse baseline-trusted-yarn-length^{commit}` 与新 HEAD 完全一致。
[git show 的原始记录](C:/Users/liuchen/Desktop/knitscape/reports/p0-baseline-20261007-210704/tag-show.txt)。

## 5. 暂存并提交文件数量

**39 文件：23 修改，16 新增；2497 行新增、170 行删除。无删除、无二进制。**

与 [Final Audit 第 23 章最终清单](C:/Users/liuchen/Desktop/knitscape/reports/p0-final-audit/FINAL_REPORT.md) 精确匹配；没有额外纳入该章的可选文档/报告。
全部逐个按路径 stage，完整 staged diff 经主代理及独立只读 reviewer 审查。

审查后提交前补丁哈希保持不变：
`DBDA226BA5DB6368DCDEC6455DF2753ADDA02A1162AF42D059D6FC379498A9C3`。
[暂存统计](C:/Users/liuchen/Desktop/knitscape/reports/p0-baseline-20261007-210704/staged-stat.txt) · [暂存 name-status](C:/Users/liuchen/Desktop/knitscape/reports/p0-baseline-20261007-210704/staged-name-status.txt) · [完整已审补丁](C:/Users/liuchen/Desktop/knitscape/reports/p0-baseline-20261007-210704/staged.patch) · [独立审查](C:/Users/liuchen/Desktop/knitscape/reports/p0-baseline-20261007-210704/independent-staged-review.json)。

## 6. 完整提交文件列表

M = 修改，A = 新增。下列链接均为本项目绝对路径。列表来自最终确认清单，并与实际 commit 的 diff-tree 复核一致。

| 序号 | 类型 | 文件 |
| --- | --- | --- |
| 1 | M | [package.json](C:/Users/liuchen/Desktop/knitscape/package.json) |
| 2 | M | [scripts/validate-feed-yarn-pbr-renderer.mjs](C:/Users/liuchen/Desktop/knitscape/scripts/validate-feed-yarn-pbr-renderer.mjs) |
| 3 | M | [scripts/validate-single-jersey-cam-editor.mjs](C:/Users/liuchen/Desktop/knitscape/scripts/validate-single-jersey-cam-editor.mjs) |
| 4 | M | [scripts/validate-single-jersey-execution-integration.mjs](C:/Users/liuchen/Desktop/knitscape/scripts/validate-single-jersey-execution-integration.mjs) |
| 5 | M | [scripts/validate-workspace-mode.mjs](C:/Users/liuchen/Desktop/knitscape/scripts/validate-workspace-mode.mjs) |
| 6 | M | [scripts/validate-yarn-length-solver.mjs](C:/Users/liuchen/Desktop/knitscape/scripts/validate-yarn-length-solver.mjs) |
| 7 | M | [scripts/validate-yarn-simulation-characterization.mjs](C:/Users/liuchen/Desktop/knitscape/scripts/validate-yarn-simulation-characterization.mjs) |
| 8 | M | [src/actions/importers.js](C:/Users/liuchen/Desktop/knitscape/src/actions/importers.js) |
| 9 | M | [src/actions/singleJerseyCamProgram.js](C:/Users/liuchen/Desktop/knitscape/src/actions/singleJerseyCamProgram.js) |
| 10 | M | [src/actions/yarnLibrary.js](C:/Users/liuchen/Desktop/knitscape/src/actions/yarnLibrary.js) |
| 11 | M | [src/codeGuide/generatedLines.json](C:/Users/liuchen/Desktop/knitscape/src/codeGuide/generatedLines.json) |
| 12 | M | [src/components/runSimulation.js](C:/Users/liuchen/Desktop/knitscape/src/components/runSimulation.js) |
| 13 | M | [src/events/simulationPointerInteraction.js](C:/Users/liuchen/Desktop/knitscape/src/events/simulationPointerInteraction.js) |
| 14 | M | [src/i18n/translations.js](C:/Users/liuchen/Desktop/knitscape/src/i18n/translations.js) |
| 15 | M | [src/simulation/drawYarnSimulation.js](C:/Users/liuchen/Desktop/knitscape/src/simulation/drawYarnSimulation.js) |
| 16 | M | [src/simulation/yarnLengthSolver.js](C:/Users/liuchen/Desktop/knitscape/src/simulation/yarnLengthSolver.js) |
| 17 | M | [src/simulation/yarnPathUvStrip.js](C:/Users/liuchen/Desktop/knitscape/src/simulation/yarnPathUvStrip.js) |
| 18 | M | [src/simulation/yarnSimulation.js](C:/Users/liuchen/Desktop/knitscape/src/simulation/yarnSimulation.js) |
| 19 | M | [src/simulation/yarnTextureBrush.js](C:/Users/liuchen/Desktop/knitscape/src/simulation/yarnTextureBrush.js) |
| 20 | M | [src/state.js](C:/Users/liuchen/Desktop/knitscape/src/state.js) |
| 21 | M | [src/views/singleJerseyCamProgramEditor.js](C:/Users/liuchen/Desktop/knitscape/src/views/singleJerseyCamProgramEditor.js) |
| 22 | M | [src/views/yarnLengthReadout.js](C:/Users/liuchen/Desktop/knitscape/src/views/yarnLengthReadout.js) |
| 23 | M | [styles.css](C:/Users/liuchen/Desktop/knitscape/styles.css) |
| 24 | A | [scripts/browser-yarn-length-batch.mjs](C:/Users/liuchen/Desktop/knitscape/scripts/browser-yarn-length-batch.mjs) |
| 25 | A | [scripts/browser-yarn-length-feedback.mjs](C:/Users/liuchen/Desktop/knitscape/scripts/browser-yarn-length-feedback.mjs) |
| 26 | A | [scripts/browser-yarn-length-input.mjs](C:/Users/liuchen/Desktop/knitscape/scripts/browser-yarn-length-input.mjs) |
| 27 | A | [scripts/browser-yarn-length-structure.mjs](C:/Users/liuchen/Desktop/knitscape/scripts/browser-yarn-length-structure.mjs) |
| 28 | A | [scripts/validate-multi-yarn-renderer.mjs](C:/Users/liuchen/Desktop/knitscape/scripts/validate-multi-yarn-renderer.mjs) |
| 29 | A | [scripts/validate-yarn-length-batch-integration.mjs](C:/Users/liuchen/Desktop/knitscape/scripts/validate-yarn-length-batch-integration.mjs) |
| 30 | A | [scripts/validate-yarn-length-failure-integration.mjs](C:/Users/liuchen/Desktop/knitscape/scripts/validate-yarn-length-failure-integration.mjs) |
| 31 | A | [scripts/validate-yarn-length-input-integration.mjs](C:/Users/liuchen/Desktop/knitscape/scripts/validate-yarn-length-input-integration.mjs) |
| 32 | A | [scripts/validate-yarn-length-result-integration.mjs](C:/Users/liuchen/Desktop/knitscape/scripts/validate-yarn-length-result-integration.mjs) |
| 33 | A | [scripts/validate-yarn-length-structure-integration.mjs](C:/Users/liuchen/Desktop/knitscape/scripts/validate-yarn-length-structure-integration.mjs) |
| 34 | A | [scripts/validate.mjs](C:/Users/liuchen/Desktop/knitscape/scripts/validate.mjs) |
| 35 | A | [src/domain/feedYarnStructure.js](C:/Users/liuchen/Desktop/knitscape/src/domain/feedYarnStructure.js) |
| 36 | A | [src/domain/yarnLengthBatch.js](C:/Users/liuchen/Desktop/knitscape/src/domain/yarnLengthBatch.js) |
| 37 | A | [src/domain/yarnLengthInput.js](C:/Users/liuchen/Desktop/knitscape/src/domain/yarnLengthInput.js) |
| 38 | A | [src/simulation/previewValidity.js](C:/Users/liuchen/Desktop/knitscape/src/simulation/previewValidity.js) |
| 39 | A | [src/views/yarnLengthSolverFeedback.js](C:/Users/liuchen/Desktop/knitscape/src/views/yarnLengthSolverFeedback.js) |

[实际 commit name-status](C:/Users/liuchen/Desktop/knitscape/reports/p0-baseline-20261007-210704/committed-name-status.txt) · [绝对路径纯文本完整清单](C:/Users/liuchen/Desktop/knitscape/reports/p0-baseline-20261007-210704/committed-files-absolute.txt)。

## 7. 刻意排除的 report / 截图 / 本地文件

所有 `reports/` 内容均排除，包括 Final Audit 报告、code-review、各阶段报告与日志、保护哈希、浏览器证据截图、临时算法探针、测试项目、PBR 测试素材和本次 baseline 操作日志。

浏览器/审计证据目录具体包括：
`reports/p0-2-browser/`、
`reports/p0-3-browser/`、
`reports/p0-3-explicit-clear-browser/`、
`reports/p0-4-browser/`、
`reports/p0-4b-browser/`、
`reports/p0-overall-browser/`、
`reports/p0-final-audit/`、
`reports/yarn-user-audit-2026-10-06/`。

同样排除可选规划文档：
`docs/superpowers/plans/2026-10-07-feed-yarn-structure-revision.md`。

[排除文件逐项记录](C:/Users/liuchen/Desktop/knitscape/reports/p0-baseline-20261007-210704/excluded-untracked-files.txt) 保留全部路径；这份记录在后续报告文件生成前采集，因此未列出之后新建的 baseline 日志/报告，这些也没有提交。

唯一纳入的 generated 路径是最终清单明确指定的 `src/codeGuide/generatedLines.json` 文本行号映射；没有自动纳入 generated/binary 临时资产。

## 8. npm run validate 结果

**提交前 PASS，36/36，exit 0。提交后 PASS，36/36，exit 0。**

[提交前完整日志](C:/Users/liuchen/Desktop/knitscape/reports/p0-baseline-20261007-210704/validate-before.log) · [提交后完整日志](C:/Users/liuchen/Desktop/knitscape/reports/p0-baseline-20261007-210704/validate-after.log)。

本次没有重新执行真实浏览器验收；浏览器结论沿用 Final Audit 已保留的证据。browser 脚本是重放助手，不由 npm validate 自动执行；集成验证中的绘图/定时器使用测试夹具。此限定不改变本次两轮完整 validate 的实际结果。

## 9. npm run build 结果

**提交前 PASS，exit 0，746 modules，1.94s。提交后 PASS，exit 0，746 modules，1.96s。**

[提交前日志](C:/Users/liuchen/Desktop/knitscape/reports/p0-baseline-20261007-210704/build-before.log) · [提交后日志](C:/Users/liuchen/Desktop/knitscape/reports/p0-baseline-20261007-210704/build-after.log)。
构建产物保持忽略，不纳入 commit。

## 10. git diff --check 提交前结果

**PASS，exit 0。** 暂存后另执行 `git diff --cached --check` 亦 PASS，exit 0。

[提交前检查](C:/Users/liuchen/Desktop/knitscape/reports/p0-baseline-20261007-210704/diff-check-before.log) · [exit code](C:/Users/liuchen/Desktop/knitscape/reports/p0-baseline-20261007-210704/diff-check-before-exit.txt) · [暂存检查](C:/Users/liuchen/Desktop/knitscape/reports/p0-baseline-20261007-210704/staged-check.log)。
Git 的 LF/CRLF 提示不属于检查失败。

## 11. Commit 后 git status

提交后再次 validate/build 后执行 `git status --short`：

```text
?? docs/
?? reports/
```

[最终 status 原始记录](C:/Users/liuchen/Desktop/knitscape/reports/p0-baseline-20261007-210704/status-final.txt)。
暂存区为空，没有剩余 tracked 修改。

## 12. 剩余未提交文件 / 修改的归属

`docs/` 为既有可选规划文档。
`reports/` 为此前阶段/Final Audit 的审计报告、截图、日志、探针、测试项目等本地证据，以及本次新建的 baseline 操作记录。

全部保留，未删除、stash 或为了清空工作区追加提交。
本次建立 baseline 前记录的 **564 个受保护文件，提交前后 SHA-256 均无变化**。
[最终保护复核](C:/Users/liuchen/Desktop/knitscape/reports/p0-baseline-20261007-210704/protection-after.json)。

## 13. 没有使用宽范围 stage / commit

确认没有使用 `git add -A`、`git add .` 或 `git commit -a`。
39 个文件均按最终名单逐个执行 `git add -- <具体路径>`。
[逐文件 stage 记录](C:/Users/liuchen/Desktop/knitscape/reports/p0-baseline-20261007-210704/stage.log)。

## 14. 没有提交无关用户修改

确认 commit 文件清单与审查清单精确一致；完整 patch 审查没有发现无关 hunk。
所有可选文档、报告与其他本地证据保留在工作区。
本次没有更改任何既有文件内容；没有 reset、checkout、stash、clean 或覆盖用户修改。

## 15. 没有修改项目 Schema

确认本次 baseline 操作没有修改项目 Schema，暂存 P0 patch 也没有非预期 Schema 迁移。
项目持久化权威仍为既有 Project facts；持久化字段白名单未改变。

## 16. 没有持久化派生状态 / revision

确认 SolverResult、PreviewValidity 和 `feedYarnStructureRevision` 没有写入项目持久化。
revision 仍为 runtime-only；SolverResult 和 PreviewValidity 由当前事实和计算结果推导，UI 选择状态未变成业务主数据。

`VALIDATED` 只表示当前软件模型内的几何求解与应用成功，不代表实机验证。

## 17. Baseline commit 和 tag 是否成功

**均成功。** commit 创建成功后才创建 annotated tag；tag 已确认指向新 commit；提交后 validate/build 均通过。

Final Audit 的 **CONDITIONAL PASS** 边界保持不变，既有非阻断技术债仍保留：
A 全局保守 revision（LOW）、B 同步 observer 旧 Derived snapshot（MEDIUM）、C debug 快捷键 d（LOW）、D queueSim 无读取（LOW）、E 旧诊断仅 validator（LOW）、F 旧基础统计口径（MEDIUM）。
本次没有扩大改动来处理这些债务。

本次到此停止。未开始第二阶段，未 push。
