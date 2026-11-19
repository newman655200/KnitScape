# SOP-001 操作记录

所有页面录入通过本地 http://127.0.0.1:5173/ 的实际浏览器 UI 完成。未用隐藏状态写入、dispatch 或修改源码代替 UI。

1. 读取用户粘贴任务；执行 git status --short、git rev-parse HEAD、git describe --tags --exact-match HEAD；确认 main / 7ababf2 / baseline-trusted-yarn-length。
2. 读取 AGENTS.md、KnitScape_当前功能与算法.md、NEXT_TASK.md、package.json。保留开始已存在的未跟踪文件。
3. 枚举 PBR/Yarn1 实际文件，逐张解码读取尺寸、格式和 hash。额外检查 PNG IHDR/pHYs，五张均没有嵌入 DPI。
4. 检索当前项目候选 SOP、工艺图和图像；实际打开 img007.jpg / img009.jpg。它们是面料/单纱照片，未发现可读取的 Cam 图。向用户询问图纸路径，未据此猜测矩阵。
5. 启动现有 Vite dev 服务；打开浏览器；点击“新建”。保留默认 Pattern 30×40，不解释为实际3216针机器。
6. 进入“三角座 / 排针”；确认默认 Gauge 为32；输入“1234”并点击“确认排针”。Cam 保持未创建。保存01截图。
7. 进入“纱线库”；通过名称/分类/新增按钮创建 N6/W(6040)，分类 OTHER。默认 Yarn1 保留，没有伪装成真实主纱。
8. 打开该资产编辑面板；通过“导入 PBR”的原生多文件选择器选择真实五张PNG。
9. 界面显示自动进入 baseColor / normal / roughness / ambientOcclusion。Metallic 没有进入；只读源码确认没有该槽位。没有手工错配。
10. 首次自动化 fill“22.987”并 Tab 后，UI显示数值，但原生导出包未包含 physicalRepeatLengthMm。保留 first-export-repeat-uncommitted 包及 manifest，不作为最终项目。
11. 检查输入change事件、setter、规范化与包导出路径。采用实际键盘尝试时曾发生数字段插入造成的瞬时错误显示；未运行模拟或导出为最终结果。随后重新填入精确22.987，并用数值控件 ArrowUp/ArrowDown 返回22.987，点击其他输入移出焦点，资产更新时间改变。没有以视觉为依据调整比例。
12. 从“导出 → KnitScape 项目 (.knitscape)”真实下载最终包；复制为新的 SOP-001-N6W6040-main-yarn.knitscape，不覆盖已有项目。解包只读检查证实 physicalRepeatLengthMm=22.987，Cam=null，Gauge32，排针[1,2,3,4]。
13. 对最终包四个PNG条目与原始源文件逐项比较SHA-256，4/4完全相同。
14. 刷新页面，通过原生“导入”文件选择器导入最终包；核实32G、1234、Cam未创建、四张贴图与22.987恢复。保存05/06截图和DOM。
15. 机器工作区实际 PreviewValidity=DESIGN_PREVIEW，结果列表不存在，机器结果区域为空。因缺Cam，没有建立Feed、输入逐Feed23或5cN、运行真实SOP模拟或制造3D截图。
16. 执行 npm run validate：36/36、exit0；随后 npm run build：exit0。完整输出保存日志。验证脚本中测试fixture的CONVERGED不得当成本例结果。
17. 执行git tracked/staged diff与HEAD/精确标签/分支复核，源码无修改。保存results.json、报告和审计证据。

截图说明：01/02记录早期操作；03记录精确重复长度已提交；04记录最终导出前机器状态；05/06记录刷新后真实重新导入。02截图中的数字仅代表当时输入框显示，最终持久化证据以最终manifest及06为准。

浏览器控制中的个别定位器未命中（原生AX checkbox与DOM button差异、PBR按钮实际名为“更换PBR”），在重新读取当前DOM后继续；未修改应用规避。
