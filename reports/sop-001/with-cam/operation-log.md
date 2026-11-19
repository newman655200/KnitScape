# 工艺图补充后的续验操作

1. 用户指定桌面名为“工艺”的图片，实际找到 C:\Users\liuchen\Desktop\工艺.jpg；读取原图并记录SHA-256。
2. 复核main/HEAD/精确标签，未修改源码。读取工艺图：32英寸、32G、3216针、1234，8列循环；主纱组织编号1–8，纱长23，张力记录5/实际空白；生产口数96；副纱20D LOW本轮仍不建模。
3. 继续上一轮已导入的真实主纱与PBR，使用既有UI创建Cam并最终录入4×8：KKKKKKTT / KKKKTTKK / KKTTKKKK / TTKKKKKK。没有以默认全K草稿作为最终结果。
4. 选择N6/W(6040)待分配。窄窗口下定位器click未改变分配，单步复查后用按钮原生Enter成功；随后8个Feed均引用真实yarnId。未通过dispatch/脚本写入浏览器隐藏状态。
5. 各Feed输入23。自动化fill的显示值不一定产生change，使用清空后原生pressSequentially("23")、Enter提交，逐项在结果表核对目标存在。
6. 8项均CONVERGED/已应用，浏览器PreviewValidity=VALIDATED。保存完整DOM和只读可见DOM结果JSON。
7. 原生UI导出新项目 SOP-001-N6W6040-main-yarn-with-cam.knitscape，保留上一轮项目不覆盖。读取导出manifest核对32格、8个yarnId、8项23、tension=null、22.987和四图。
8. 通过既有缩放、平移、翻面观察；不改变Cam、纱长、直径、颜色或PBR物理比例。最大6倍视图最初采集为空，保留诊断；适配和约2.1倍近景可见，保存正反面。部分早期截图落在异步重新求解期间，最终证据使用settled/reimport截图和VALIDATED结果。
9. 对真实UI导出包运行审计复算脚本。复用现有验证脚本的Vite SSR模式，只有绘图表面为替身；业务文件未编辑。高精度8项与浏览器4位小数逐项一致；4519个UV构建参数均32G/22.987；四图进入渲染调用，原始字节一致。明确不将其当成浏览器GPU命令捕获。
10. 刷新并通过真实文件选择器重新导入最终项目，8项再次全部收敛且应用；核对32格、8个真实资产ID、8项23及PBR/22.987恢复。
11. 用户明确指定img007.jpg为实物面料参考，报告采用该图描述实际可观察差异，没有据此调参或生成替代图。
12. 重新npm run validate=36/36、exit0；npm run build=exit0；本例replay-audit=exit0。最终git tracked/staged diff为空，main/HEAD/标签不变。

实际保存5cN的UI入口不存在，所以项目仍tensionCN=null；只在审计中记录工艺主纱“记录5”。Metallic不受支持，最终LEVEL2。未commit/tag、未开发功能、未补20D LOW。
