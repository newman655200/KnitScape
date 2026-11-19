# P0-3 补充：只有明确 Clear 才编辑为 unset

此报告覆盖用户对普通输入 0 / 删除为空的最新明确要求。先前 P0-3 报告中“普通 setter 的 0/empty/nullish 兼容清除”已经被本次规则替代；项目存储与读取的 legacy unset=0 格式继续兼容。

开工/完成仍为 main，HEAD `29b7e4bcfaee6c9b7f3df070b24c200b7aa56103`；没有提交。112 个既有未提交文件在改动前保留副本及 SHA256。此次仅修改下列 7 个源/测试文件，其余 105 个内容完全不变。

## 修改前真实浏览器结果

已有四路目标 23、CONVERGED/VALIDATED，单项键入 0 失焦后变为空，反馈变成 NOT_SET；原目标被隐式清除。重新设 23 后，以真实 Backspace 删除两字符再失焦，也变成 NOT_SET。见 `p0-3-explicit-clear-browser/before-zero.json` 与 `before-empty.json`。新增集成回归在修复前失败：typed-zero 的实际目标为 0，而应保留 23。

## 最终规则

普通 UI 草稿与单项/既有批量 setter 的默认 validator 只接受有限正数。0、空串、纯空白、null、undefined 全部返回 INVALID_YARN_LENGTH；不 dispatch、不清旧 Solver、不触发模拟。界面提交时恢复原显示值并提示“未保存”。共享 validator 的 `allowUnset` 默认关闭。

显式 `clearSingleJerseyFeedYarnLength()` 才在编辑流程中明确允许 0，经过同一个私有 commit 入口提交。项目/Feed 归一化明确启用 legacy unset 读取，数字/数字字符串/0/empty/null 的既有导入兼容保持；缺失字段和非法类型的拒绝规则不变。没有修改项目 schema、Machine Domain、Pattern 或 UI 视觉/布局。

## 实测

| 操作（原目标 23） | 最终保存目标 | 求解及预览 |
|---|---:|---|
| 键入 0，失焦 | 23 | 原 CONVERGED/已应用/VALIDATED 保留，未保存提示 |
| 键入 0，Enter | 23 | 同上 |
| Backspace 删除为空，失焦 | 23 | 同上 |
| Backspace 删除为空，Enter | 23 | 同上 |
| 删除为空但尚未提交/点击 Clear | 23 | 原反馈仍 23 / CONVERGED / VALIDATED |
| 明确 Clear 一个目标 | 0 | 此项 NOT_SET，重新计算其余目标；其余成功时 VALIDATED |
| 明确 Clear 全部目标 | 全部 0 | SolverResults=[]，DESIGN_PREVIEW |

真实浏览器 7 个提交后读数、1 个 pending empty 读数及截图保存于 `p0-3-explicit-clear-browser/`，summary.json 为通过结果；浏览器错误日志为空。没有浏览器 app state 注入。

集成额外证明：0/empty/whitespace/nullish 拒绝后 GLOBAL_STATE 及 SolverResults 引用完全相同、无新 timer、Canvas 路径不变；明确 Clear 成功；27 提交、同 Feed 双 Yarn 隔离、23/100/混合/无目标及旧格式真实导入回归通过。

## 修改文件与验证

| 文件 | 改动 |
|---|---|
| src/domain/yarnLengthInput.js | 默认拒绝 unset 草稿；仅明确 allowUnset 才接受存储 unset |
| src/actions/singleJerseyCamProgram.js | 区分普通 Set 与明确 Clear，共用私有提交入口；读取 legacy unset |
| scripts/validate-yarn-length-input-integration.mjs | 0/空/空白/nullish 原子拒绝、明确 Clear 和导入兼容 |
| scripts/browser-yarn-length-input.mjs | 真实 Backspace 空草稿与 Enter 断言 |
| scripts/validate-single-jersey-cam-editor.mjs | 普通 0/empty 不清除，明确 Clear 保存 0 |
| scripts/validate-yarn-length-result-integration.mjs | 无目标 fixture 改为明确 Clear |
| scripts/validate-yarn-length-failure-integration.mjs | 无目标 fixture 改为明确 Clear |

`npm run validate`：退出码 0，34/34 通过；`npm run build`：退出码 0，741 modules transformed，2.20s；`git diff --check`：退出码 0，只有已有 LF→CRLF 提示。日志以 `p0-3-explicit-clear-` 命名；保留性结果为 `p0-3-explicit-clear-preservation.json`。

独立只读复核及 integration 重跑通过，无 Critical/Important/Minor 遗留项。此次增量 7 文件 +57/-27（不含报告/证据）；完整 tracked 工作区（含此前修改，排除 untracked）为 20 文件 +421/-117。

未处理 P0-4、批量工作流重构、Undo、Yarn Library、Legacy 删除、生产计算或 PBR 新能力。此次输入边界已完成，停止等待下一条指令。
