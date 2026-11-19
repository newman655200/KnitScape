# P0-4B 独立只读审查

Reviewer: `/root/p0_4b_review`。

审查依据：用户 P0-4B 需求、本次修改前文件快照、当前增量及全部现有 Cam/Feed/Yarn mutation 调用。未编辑或提交文件，未启动浏览器。

结论：未发现阻塞缺陷或需要修改的具体问题。

- state prepareAction 同步提交 revision 与结构 mutation，外部输入不能覆盖 runtime revision。
- 完整替换/create/import/loadWorkspace 强制递增，包括相同 ID；添加/删除/slot 替换/Feed resize/Cam 删除均覆盖。
- length/Cam/Track/PBR 等非结构参数不递增。
- preflight 先 revision 后 locator/value，拒绝在 dispatch 前返回，不修改结果或 validity。
- UI 首次捕获 revision，结构变化后取消 checkbox 勾选并立即 stale 提示；拒绝清空旧选择，不自动重映射。
- 导出白名单排除 revision 与选择快照；现有 Undo snapshot 不包含 Cam，没有结构恢复绕过入口。

最终测试与浏览器证据由根代理实际执行：36/36 validators、build、diff check、30 个浏览器检查点均 PASS。
