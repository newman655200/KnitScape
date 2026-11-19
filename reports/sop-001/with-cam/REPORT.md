# SOP-001 主纱验证版 — 真实工艺图续验报告

日期：2026-10-15（Asia/Shanghai）  
最终分级：**LEVEL 2 — STRUCTURAL MODEL**  
范围：**PARTIAL SOP REPRESENTATION**，只建模 N6/W(6040)，不含 20D LOW。

用户补充了工艺图位置后，已读取 `C:\Users\liuchen\Desktop\工艺.jpg`，从上一轮项目继续完成真实 4×8 Cam、8 Feed 主纱分配、每 Feed 23 cm / 100针目标和实际浏览器 Simulation。八项均 **CONVERGED / 已应用**，PreviewValidity 为 **VALIDATED**。四张真实 PBR 及 22.987 mm 进入现有渲染调用链；Metallic 不受支持，完整材质表达仍有缺口，因此保守评为 LEVEL 2。

本报告是本次续验的当前结论。上一轮 `reports/sop-001/REPORT.md` 的 LEVEL 1 是当时尚未获知工艺图位置的阶段结果，保留作操作历史。

## 1. Baseline 状态

- 分支 `main`；HEAD `7ababf264d495f6b96d4d66652c529424938ac4d`；精确标签 `baseline-trusted-yarn-length`。
- 续验开始和完成均复核上述信息。tracked / staged diff 均为空。
- 未执行 reset / checkout / stash / clean / commit / tag，未改业务源码，未开始 P1-1 开发或 UI 重构。
- 只新增审计报告、截图、导出项目和审计复算脚本。复算脚本采用现有验证脚本的 Vite SSR 入口；观察器只在测试进程内读取函数输入/输出，磁盘业务模块未修改。
- 初始未跟踪的 PBR、图片、docs、reports 等全部保留。
- 已阅读规定文档。文档仍描述较早基线；持久化能力以本次实际导出、重新导入和当前源码为准。

## 2. PBR 目录真实文件

目录：`C:\Users\liuchen\Desktop\knitscape\PBR\Yarn1`。上一轮已通过同一次真实 UI 文件选择器选择以下五张文件，本轮继续使用这些资产。

| 实际文件 | 字节数 | 实际进入 Yarn Asset | 识别/指定方式 |
|---|---:|---|---|
| Albedo.png | 578155 | baseColor | 自动识别 |
| AO.png | 700119 | ambientOcclusion | 自动识别 |
| Metallic.png | 137923 | 未进入 | 不支持，无手动槽位 |
| Normal.png | 656227 | normal | 自动识别 |
| Roughness.png | 759035 | roughness | 自动识别 |

无需手动指定的四张已进入最终项目包。Metallic 没有改名伪装进其他槽位。没有 Height 文件，height 为空；缺 Height 数据和 Metallic 不受支持分别记录。

## 3. PBR 真实尺寸与格式

五张全部是 **2172×724 px / PNG / 8 bit RGBA**，尺寸一致。文件解码及 IHDR 实际检查已记录在上层目录 `pbr-source-inventory.json`、`pbr-png-metadata.json`。

五张均无 PNG pHYs 物理分辨率块。System.Drawing 返回的 96 DPI 不能视为真实扫描 DPI。本次物理计算使用的是用户明确提供的 **2400 DPI 扫描信息**。

## 4. Physical Repeat Length 计算

```text
横向：2172 / 2400 × 25.4 = 22.987 mm ≈ 22.99 mm
纵向： 724 / 2400 × 25.4 = 7.662333333… mm
```

UI 和项目内部最终值均为 **22.987 mm**，保留更高精度。扫描物理高度 7.6623 mm 未作为纱线直径。

## 5. Machine 参数

工艺图可读：机台 K01，巨登单面，32英寸，32G，总针数3216；物料号 NB2D0106-AA01AC。

| 项目 | 工艺资料 | 软件实际状态 |
|---|---|---|
| Gauge | 32G | machineGauge=32，实际保存并用于 Solver / UV |
| 机台直径 | 32英寸 | 写入审计；项目无专门机器直径字段 |
| 总针数 | 3216 | 写入审计；项目无专门 totalNeedles 字段 |
| Needle Types | 4行 A–D | 4 Type Cam |
| Feed 组织循环 | 1–8 | 8 Feed Cam cycle |
| 生产口数 | 96 | 工艺单主/副纱行均写96口；本轮只表达用户指定8路循环 |
| 设计显示区域 | 非生产机针数 | 保留默认30×40局部区域，未冒充3216针完整圆筒 |

Machine Domain 可计算指定输出宽度，但没有完整32英寸圆筒和3216针机台几何。这不妨碍局部4针×8路循环求解，但不能称为整台机模拟。

## 6. Needle Arrangement

`needleArrangementInputs=["1234","","",""]`，`needleArrangement=[1,2,3,4]`，实际通过 UI 确认。工艺图排针栏也为1234。导出并重新导入后一致。Pattern 没有因排针被改写。

## 7. 最终 Cam 4×8 矩阵

来源：`C:\Users\liuchen\Desktop\工艺.jpg`，已原样复制为 `source-process-sheet.jpg`，SHA-256：

`F6293D52BD0F08E77F929CEAB916773D7D8ACA1893A9A013EB9A754A326E796B`

图中 A/B/C/D 自上而下映射本软件 Type1/2/3/4，Feed1–8 按图从左到右。∧ 对应 K（成圈）；方框/Π 对应 T（集圈，UI称“半针”）；— 对应 M（不编织，本循环没有）。该映射按表格行顺序转录，生产机针踵命名基准仍宜由工艺人员核对，未额外反向或错位处理。

| Needle Type / 工艺行 | F1 | F2 | F3 | F4 | F5 | F6 | F7 | F8 |
|---|---|---|---|---|---|---|---|---|
| Type1 / A | K | K | K | K | K | K | T | T |
| Type2 / B | K | K | K | K | T | T | K | K |
| Type3 / C | K | K | T | T | K | K | K | K |
| Type4 / D | T | T | K | K | K | K | K | K |

总计 **24 K、8 T、0 M**。每两路更换集圈针型：F1–2为Type4，F3–4为Type3，F5–6为Type2，F7–8为Type1。已在真实 UI 逐格录入，并在最终 manifest 再核对全部32格。

创建按钮会先生成软件固有4×4草稿；本次随后改为4×8并完整转录，最终结果没有采用全K fixture。

## 8. Yarn Asset 实际配置

- 名称 N6/W(6040)，ID `yarn-1792072401481`，分类 OTHER。
- 分类菜单只有 T / CD / N / OP / OTHER，未新建混纺分类。
- PBR四图和22.987 mm保留；没有手动覆盖基色。
- 默认 Yarn1（id0）保留在库中，但实际8个 Feed 都引用真实主纱ID。
- 默认 companion ply仍禁用；没有建立20D LOW资产。
- 工艺图原料比例为主纱91.20%、20D LOW 8.80%。本轮没有把主纱100%模拟解释为完整生产混合面料。

## 9. Color 来源

最终主纱颜色路径是 **YarnAsset.pbr.baseColor → Albedo.png**。

`resolveFeedYarnPlies()` 通过各 Feed 的真实 yarnId解析PBR，材质设 `textureStrength=1`；shader以真实Albedo采样代替底色。导出项目复算观察到四图齐备的渲染调用及textureStrength=1。截图中显示白/浅灰纤维，不是初始灰色实线预览。

Legacy primary ply仍有 `rgba(190,190,190,1)`，用于无贴图/不可用时的fallback及共享参数；本例有效PBR路径没有另选颜色覆盖。结果表里的“Yarn1”表示该Feed的第一个槽位，**不是默认库资产id0**。

依据：[yarnTextureBrush.js](C:/Users/liuchen/Desktop/knitscape/src/simulation/yarnTextureBrush.js:123)、[yarnUvWebglRenderer.js](C:/Users/liuchen/Desktop/knitscape/src/simulation/yarnUvWebglRenderer.js:40)。

## 10. Diameter 来源

实际几何仍继承Legacy主ply默认 `diameter=0.24`，是**模型单位**。标记 **DIAMETER_NOT_CALIBRATED**，没有称为实测mm或用7.6623mm代替。

YarnAsset本身没有独立真实直径字段。真实直径数据缺失属于TYPE A；当前只能继承主ply参数是另一项模型边界。未改默认直径以改善外观。

## 11. PBR 来源与材质实际状态

最终包的四张PNG逐一读出，与原始文件比对字节及SHA-256，4/4完全一致。详见 `replay-audit-results.json/sourceIntegrity`。

既有WebGL1渲染器为支持repeat，将2172×724源图在GPU上传准备中重采样至4096×1024；本次复算也观察到该尺寸。**源文件与项目包内PNG未重采样**，UV仍采用归一化坐标和22.987mm，不把4096px重新解释成新的物理长度。

Metallic始终没有进入Domain或shader。Normal只以绿色通道参与简化relief；Roughness调节高光项，AO乘入颜色。不能把该分层外观shader称为完整物理PBR BRDF。

## 12. Feed / Yarn Assignment

工艺图主纱行明确覆盖组织编号 `1.2.3.4.5.6.7.8`，实际纱长栏23。因此本次8个Feed均设置同一真实主纱、同一23目标有工艺依据。

每个Feed只有1个Yarn槽位，`placement=parallel`，实际yarnId均为 `yarn-1792072401481`。没有补入副纱。

## 13. Yarn Length Target

8项实际保存值均为 **23 cm / 100 needles**。经真实UI输入提交、导出核对和重新导入复算确认。

左侧24.79 cm / 100线圈仍是基础设计预览统计，界面已标“非目标求解值”；不能把它当作当前机器主纱目标或实际应用结果。机器结果以右侧逐Feed目标求解表为准。

## 14. Solved Result

浏览器可见结果均为 CONVERGED、已应用。浏览器仅显示4位小数；以下高精度数值来自**真实导出项目在当前未改业务模块中的独立复算**，逐项与浏览器显示的小数核对一致，不冒充直接读取浏览器内部状态。误差列单位均为cm/100针。

| Feed × 主纱槽位 | target | solved | absolute error | status | applied |
|---|---:|---:|---:|---|---|
| 1×1 | 23 | 22.999920925128 | 0.000079074872 | CONVERGED | true |
| 2×1 | 23 | 22.999922023879 | 0.000077976121 | CONVERGED | true |
| 3×1 | 23 | 22.999921149748 | 0.000078850252 | CONVERGED | true |
| 4×1 | 23 | 23.000296542216 | 0.000296542216 | CONVERGED | true |
| 5×1 | 23 | 22.999808586695 | 0.000191413305 | CONVERGED | true |
| 6×1 | 23 | 22.999987339167 | 0.000012660833 | CONVERGED | true |
| 7×1 | 23 | 22.999808732605 | 0.000191267395 | CONVERGED | true |
| 8×1 | 23 | 22.999733873072 | 0.000266126928 | CONVERGED | true |

模型容差0.00079375 cm/100针，最大误差0.000296542216，全部在容差内。不存在本例UNREACHABLE记录。高精度只描述当前算法数值收敛，不代表真实生产计量精度。

## 15. Tension 是否填写

工艺图主纱行：**张力(CN)“记录”=5，“实际”为空**。现在可以确认5对应主纱，已不再标“Tension awaiting confirmation”。不能说实测张力已确认为5。

当前UI没有张力输入控件，因此最终项目8个 `tensionCN` 仍为 **null，未实际填写5**。没有用脚本写项目或改业务代码补入口。Domain本身支持存储tensionCN；Simulation/Solver不消费它进行张力力学计算。分别归类为TYPE B入口缺失、TYPE C物理模型未接入。

## 16. Physical UV 是否生效

本例链路与证据：

| 环节 | 结论 |
|---|---|
| PBR源图 | 2172px，用户扫描参数2400DPI |
| YarnAsset | pbr.physicalRepeatLengthMm=22.987 |
| assignment | 8 Feed全部指向该真实资产 |
| 材质解析 | 四个真实assetRef，textureStrength=1 |
| 最终UV函数 | 导出项目复算中4519个strip构建调用，全部收到32G和22.987 |
| 数值验证 | UV与物理公式最大Float32差约0.000003813053 |
| 旧48比例 | 本例复算的UV函数没有走缺少物理参数的48分支 |
| 浏览器GPU | 未进行GPU命令捕获；浏览器证据为实际显示、保存状态及相同输入的复算一致性 |

公式：`U=(arcLengthOffset+pathArcLength)×(25.4/32)/22.987`。

复算采用当前既有Domain→adapter→simulate→renderer模块，绘图表面为测试替身，观察真实PBR字节和参数进入调用；4519次绘制中均有该主纱的四张图。**这不是4519次浏览器GPU draw的测量。**

[drawYarnSimulation.js](C:/Users/liuchen/Desktop/knitscape/src/simulation/drawYarnSimulation.js:109)、[yarnPathUvStrip.js](C:/Users/liuchen/Desktop/knitscape/src/simulation/yarnPathUvStrip.js:43)。横向物理重复链已接通；直径、贴图V轴前景宽度和实物尺度仍未标定，不能据此声称真实整体尺度一致。

## 17. PreviewValidity

真实浏览器为 **VALIDATED**。刷新、重新导入带Cam项目后，8个目标再次 CONVERGED / 已应用，并恢复VALIDATED。

其含义仅为：当前KnitScape几何模型内，本次已录入的8项目标成功求解并应用。缺失20D LOW、张力未填、直径未标定、Metallic未支持，不会自动让这个数值状态失效；因此它不能代替完整生产验证。

## 18. 预览截图与3D能力

实际保存了机器/Cam、排针、Feed配置、PBR、纱长结果分段、正面、近景和翻面截图。当前软件是**分层2D/2.5D UV ribbon预览**，没有真正的3D侧面摄像机，不能将翻面称为完整三维观察。

| 要求 | 截图证据 |
|---|---|
| Machine / Cam | 01-machine-cam-current.jpg；17-reimport-machine-results.jpg |
| Needle Arrangement | 15-needle-arrangement.jpg；17重新导入图 |
| Feed / Yarn | 13-feed1-and-cam.jpg；14-feed8-and-cam.jpg；完整DOM覆盖8项 |
| YarnAsset / PBR | 16-yarn-asset-pbr.jpg；18-reimport-yarn-pbr.jpg |
| Yarn Length Result | 10-yarn-length-first.jpg；11-middle；12-last |
| 第一次客观正面 | 02-front-default.jpg；19-front-reimport-default.jpg |
| 正面近景 | 09-front-close-settled.jpg |
| 背面近景 | 08-back-close-settled.jpg；05-back-default.jpg |
| 侧面 | 软件无此真实3D能力，未虚构 |

只使用显示缩放、平移、翻面观察；Cam、纱长、颜色、直径、PBR物理比例未为视觉效果调整。最大6倍缩放的最初两张采集为空画面，保留03/04作诊断；恢复适配、适度放大后可见。未修复源码。

![浏览器重新导入后的真实机器配置](C:/Users/liuchen/Desktop/knitscape/reports/sop-001/with-cam/17-reimport-machine-results.jpg)

![正面近景的实际外观](C:/Users/liuchen/Desktop/knitscape/reports/sop-001/with-cam/09-front-close-settled.jpg)

## 19. 与真实面料比较

实物面料参考由用户明确指定为 `img007.jpg`，`img009.jpg`另作单纱参考。面料照片可见成组小线圈、短连接段、卷曲毛羽和高覆盖度；未见当前模拟画面那样大量背景露出。缺少相同照明、放大倍率及比例尺，不给相似百分比。

**A 结构层**：离散Cam矩阵与工艺图32格一致；1234循环与8路循环已保存并实际生成结构。每对Feed的T按Type4→3→2→1移动。该数据层匹配可验证；稀疏的当前材质显示不足以从图像可靠逐一检查集圈形态、针型错位和所有路径遮挡。实物照片也不能反推全部Cam动作。

**B 路径层**：8项23目标实际求解并应用。UV使用沿路径弧长offset，数据层没有人为随机缩放。截图出现很多断续细白纹，不能直接判为几何断线；材质透明区也会造成可见路径断续。没有完成三维碰撞/穿模检查，不能称无穿模。

**C 材质层**：Albedo确实作为主纱基色进入调用。Normal/Roughness/AO在复算中加载并被shader使用，但没有单图开关对照或浏览器GPU捕获，不能分别评价它们的实物逼真度。Metallic不支持，无法验证完整非金属PBR行为。贴图沿纱线的细节连续性在当前可见分辨率下不足以逐段确认。

**D 尺度层**：22.987mm纵向重复参数进入UV函数；显示缩放不替代物理比例。Albedo上下存在大面积透明边界，中央才是纱线；中心列采样y=0/100/250/450/600/723的alpha=0，而y=362为251。渲染器V从0到1覆盖整张图，配合未标定0.24默认直径，可能使可见纱线显得过细。这是有证据的影响因素推断，未认定唯一根因。没有裁剪贴图、改V比例或调粗直径“修图”。

**E 可观察视觉差异**：

| 维度 | 实物照片 | 当前客观预览 |
|---|---|---|
| 结构相似度 | 有明显起伏且覆盖饱满 | 可见规则循环细纹，但难从纹理图像确认全部结构细节，不给相似结论 |
| 纱线质感 | 可见卷曲、局部粗细与蓬松纤维 | 更像稀疏的细白色纤维线段，整体实体感明显偏弱 |
| 毛羽 | 大量游离、卷曲毛羽 | 未表现同等毛羽体积；shader透明边缘不等于真实三维毛羽 |
| 蓬松度 | 面料饱满、柔软、表面有厚度感 | 平面感强、背景透出很多，明显不饱满 |
| 表面粗糙度 | 局部不规则、起伏明显 | 细碎纹理可见，但缺少实物尺度的起伏体积 |
| 颜色 | 乳白/浅米色，受拍摄光照影响 | 白/浅灰细纹；没有色卡校准，不能定量比较色差 |
| 尺度感 | 无可靠同倍率比例尺 | U参数有物理依据，直径/V前景宽度和整体厚度未标定 |

![用户指定的实物面料参考](C:/Users/liuchen/Desktop/knitscape/img007.jpg)

结论是**差异明显**，没有“高度一致”或“看起来不错”的评价。

## 20. TYPE A — 数据及范围缺失

- 真实主纱直径、比例尺和光照/色彩标定数据缺失；DIAMETER_NOT_CALIBRATED。
- 工艺单张力“实际”列为空，5是记录值，不是本轮实测值。
- A–D与机台物理针踵编号的现场命名、8路循环与96口生产配置的映射仍宜现场复核。
- 20D LOW按本轮范围不建模；工艺单明确存在它，所以本轮始终PARTIAL SOP REPRESENTATION。这不是软件不能容纳第二根纱。
- Height源图未提供；未用其他图伪造。
- **Cam逐格符号、8 Feed主纱分配、23目标已由新工艺图补齐，不再列为缺失。**

## 21. TYPE B — UI及操作问题

- tensionCN能在Domain存储，但没有UI输入入口，实际保留null。
- 窄内嵌窗口下，按钮点击及自动化fill有时未提交/未激活；主纱分配使用键盘Enter成功，纱长使用清空后原生连续输入23再Enter成功。以实际结果表、manifest及重新导入为准；未用代码注入状态。
- Metadata输入的物理重复长度也需真实change提交；上一阶段已解决并持久化，非Domain不支持。
- 多文件导入对Metallic忽略没有逐文件警告，PBR“已设置”不代表五图完整。
- 8列表格和求解表需横/纵向滚动；保存完整DOM、分段截图和结果JSON弥补可读性。
- 左侧基础设计纱长与右侧机器目标结果并存，容易误读；本轮已明确区分。
- 最大放大时曾采集到空画面，恢复适配/适度缩放可见；只记录，没有据此实施代码修复。

## 22. TYPE C — Domain / Simulation边界

- Metallic无Domain槽位、导入识别或shader sampler，真实五图PBR未完整接入。
- 当前为简化分层2D/2.5D材质，非完整物理PBR、三维纤维毛羽、体积/碰撞模型；无真实侧面摄像机。
- tensionCN不驱动张力力学或路径计算；不能把保存数值解释为张力物理作用。
- YarnAsset无独立直径属性，几何继承Legacy主ply；贴图透明前景宽度没有独立物理映射语义，不能自动把扫描图高度当直径。
- 无32英寸、3216针、96口的完整机台几何与专门持久化字段。局部Cam/排针/8路循环能力已有。
- **4×8 Cam、8 Feed主纱目标、四图PBR加载和纵向Physical UV已经实际通路，不再误报为能力缺失。**

## 23. 保存项目路径与兼容性

最终续验项目为新文件，未覆盖上一阶段数据录入版：

`C:\Users\liuchen\Desktop\knitscape\reports\sop-001\SOP-001-N6W6040-main-yarn-with-cam.knitscape`

大小2,698,240字节。通过真实UI导出，刷新后再通过真实UI重新导入；4×8矩阵、8项主纱ID/23目标、32G、1234、四张PBR、22.987均恢复，8项再次收敛并应用。

当前审计目录：`C:\Users\liuchen\Desktop\knitscape\reports\sop-001\with-cam\`，保存本报告、结果JSON、工艺图副本、全部截图/DOM、project-export.manifest.json、replay-audit.mjs及输出、检查日志。复算结果与浏览器结果明确区分来源。

原项目 `SOP-001-N6W6040-main-yarn.knitscape` 和原LEVEL1报告完整保留，不作为本次最终项目。

## 24. Validate / Build 是否正常

续验完成后重新实际运行：

- `npm run validate`：**36/36 validators passed，exit 0**。
- `npm run build`：**成功，exit 0**。
- 本案例 `node reports/sop-001/with-cam/replay-audit.mjs`：**通过，exit 0**；8项与浏览器小数一致、4519次UV构建均22.987、四图源字节一致。
- 最终tracked / staged diff为空，HEAD、main、标签未变。

所有日志在当前审计目录。仓库验证脚本自己的fixture结果没有冒充本案例；第14项只使用本案例导出参数复算及浏览器实际表格。

## 25. 最终LEVEL

**LEVEL 2 — STRUCTURAL MODEL。**

真实Machine/Cam/Yarn和8项23目标已形成可保存、可重新打开的结构；真实四图和纵向物理重复链也已进入现有Simulation调用。但请求的Metallic贴图没有进入Domain/renderer，完整材质表达不完整，当前外观与实物差异明显。因此不将“四图部分成功”提升为完整PBR的LEVEL3，也不使用数值VALIDATED代替真实生产验证。

本轮不授予LEVEL4。

## 26. 下一步只推荐三件事

1. 由工艺人员核对A–D与实际针型编号、8路循环与96口的映射；确认5cN是计划/记录值还是应补的实测值。
2. 测量真实主纱直径，并用带比例尺的单纱/面料参考标定贴图前景宽度、可见粗细及颜色；禁止使用7.6623mm扫描高度作为直径。
3. 在另行授权的开发任务中补全Metallic/材质映射与张力UI边界，再用本项目复验完整PBR及视觉差异；本轮不开发、不补20D LOW、不重构UI。

