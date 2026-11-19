# P0-C2 裸氨纶工艺数据合同实施计划

**Goal:** 在现有 Feed × Yarn 使用关系内支持直接目标和放松实测＋牵伸两种互斥输入；唯一派生数值目标，不改求解和几何数学。

**Architecture:** `yarnLengthInput.js` 统一归一化、校验与派生，Cam actions 原子提交并失效结果。Simulation、反馈、批量预检与项目格式复用既有入口。用户本轮33节实施合同是已授权设计，不新增设计审批，不提交Git。

**Tech Stack:** 现有 JavaScript / Vite / lit-html / Node validators。

## 已核对

- 分支 main，HEAD `7ababf264d495f6b96d4d66652c529424938ac4d`。
- 开工哈希、tracked源码/脚本副本、未跟踪文件清单、既有diff及package.json已保留。
- 开工 validate 40/40、build、diff-check通过。首次npm因沙箱Node启动EPERM失败，沙箱外重跑成功，不属于应用基线失败。
- 审计报告实际末尾仍为 NEEDS_DECISION，而用户本次说明为 READY_FOR_IMPLEMENTATION。本次合同已明确版本/能力决策，采用现有 knitscape 版本机制：直接模式v2，新模式v3及 requiredCapabilities。
- 现有 Assignment 是 Cam feeds[].yarns[] 普通对象，没有独立 feedYarnAssignment.js。扩展现有模块即可。

## 实施与验证

- [x] Domain/actions：在现有输入、批量、结构validator中先添加失败断言。扩展唯一 `normalizeYarnLengthFields` / `resolveYarnLengthInput`，新增模式与倍率action；模式切换清事实、结果与validity，参数不递增结构revision。验证无非法输入副作用、Clear、混选拒绝、过期选择拒绝。
- [x] Persistence：扩展既有PBR持久化和load lifecycle validator。旧JSON/包保持兼容；新模式输出v3与能力，未来未知版本/能力拒绝；导出只保留激活事实，拒绝非法输入。不得保存24或运行时字段。
- [x] UI/feedback：现有编辑区增加模式选择、放松长度、倍率、分别Clear、派生只读值与状态；反馈显示输入来源，匹配完整输入签名；所有新文案进i18n，扩展既有反馈和浏览器脚本。
- [x] Simulation：先在既有multi-yarn renderer validator断言8/3派生24、等积变更仍重新求解/来源更新、不完整输入阻止整体VALIDATED。以resolver输出创建临时纯数值Solver视图，并将来源写入运行时结果和缓存签名。
- [x] SOP：复制历史真实4×8 Cam主纱fixture为新完整双纱fixture，保留源文件哈希；主纱23与历史逐路比较，氨纶8/3派生24逐路收敛。工艺规格、来源六项与±2%记录在fixture说明，非新Project全局字段。
- [ ] 浏览器：实际UI验证旧直接输入、双向切换、8/3/24、八路结果、保存重载、非法输入、Clear、参数变化及控制台。
- [x] 审阅：逐文件检查scope、authority、无重复乘法、无新增src/dependency、禁止数学与Machine Domain文件哈希不变。
- [x] 终验：专项validators、全量validate41/41、build、diff-check；生成16节REPORT及用户要求29项最终结果。

浏览器已完成20项输入/模式检查与真实SOP16项CONVERGED；原生下载与关闭后重开被工具保存的权限设置/受管理策略拒绝。用户明确允许后仍未放行，未绕过。最后一项浏览器验收保留未勾选，最终BLOCKED仅指该验收关口。
