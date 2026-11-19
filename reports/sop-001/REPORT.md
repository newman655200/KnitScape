# SOP-001 主纱验证版 — 真实案例验证报告

执行日期：2026-10-15（Asia/Shanghai）  
结论：**LEVEL 1 — DATA ENTRY ONLY**  
范围：仅 N6/W(6040)；**PARTIAL SOP REPRESENTATION**。本报告不代表完整生产面料复现，也不代表生产验证。

已通过浏览器实际完成 Yarn Asset 建立、真实目录 PBR 导入、32G/1234 排针确认、物理重复长度提交、原生项目导出和重新导入。**缺少可可靠读取的 Cam 逐格符号，按任务要求停在 Cam 录入前。** 未生成真实 SOP 的机器模拟和 3D 成果。

## 1. Baseline 状态

- 分支：`main`。
- HEAD：`7ababf264d495f6b96d4d66652c529424938ac4d`。
- 精确标签：`baseline-trusted-yarn-length`。
- 开始和结束均已实际执行 git 状态、HEAD、标签、分支核对；`git diff --exit-code`、`git diff --cached --exit-code` 均为 0。
- 开始已有未跟踪项：`PBR/`、`ai-manufacturing-strategy-deck/`、`docs/`、`img007.jpg`、`img009.jpg`、`reports/`，均予以保留。
- 未执行 reset、checkout、stash、clean、commit、tag；未修改业务源码。
- 已阅读 AGENTS.md、KnitScape_当前功能与算法.md、NEXT_TASK.md。它们仍描述较早的 2a1efc1，且称机器字段尚未持久化；本次以用户最新指定的 7ababf2 及当前源码、实际导出/重新导入结果为准，未改这些文档。

## 2. PBR 目录真实文件

实际目录：`C:\Users\liuchen\Desktop\knitscape\PBR\Yarn1`。

| 实际文件名 | 字节数 | 当前导入器实际结果 | 手动指定 |
|---|---:|---|---|
| Albedo.png | 578155 | 自动进入 baseColor | 无 |
| AO.png | 700119 | 自动进入 ambientOcclusion | 无 |
| Metallic.png | 137923 | 未识别，未进入资产或项目包 | UI 没有该槽位 |
| Normal.png | 656227 | 自动进入 normal | 无 |
| Roughness.png | 759035 | 自动进入 roughness | 无 |

五个文件通过同一次 UI 多文件选择器选择。界面仅列出四个成功进入的槽位，没有给 Metallic 单独的忽略警告。Height 文件未提供，height 槽位为空；这与 Metallic 不受支持是不同问题。

## 3. PBR 真实尺寸与格式

五张均为 **2172 × 724 px、PNG、8 bit RGBA**，尺寸一致。已检查实际图片解码尺寸，并直接读取 PNG IHDR。

五张均没有 PNG `pHYs` 物理分辨率块。System.Drawing 解码器返回的 96 DPI 是其解码结果，不能当作实际扫描 DPI。**2400 DPI 的依据是本次用户提供的扫描信息，不是文件内嵌元数据。**

原始尺寸、格式、字节数、SHA-256 见 `pbr-source-inventory.json`；PNG 块信息见 `pbr-png-metadata.json`。

## 4. Physical Repeat Length 计算

```text
2172 / 2400 × 25.4 = 22.987 mm ≈ 22.99 mm
724  / 2400 × 25.4 = 7.662333333… mm
```

通过现有 UI 数值控件最终保存 **physicalRepeatLengthMm = 22.987**，保留高精度；两位小数为 22.99 mm。7.6623 mm 是扫描图的物理高度，**没有当作纱线直径**。

## 5. Machine 参数

| 参数 | SOP 已确认 | 本次软件实际保存/应用 |
|---|---|---|
| Gauge | 32G | machineGauge = 32；导出及重新导入均确认 |
| 机台直径 | 32 英寸 | 记录在审计结果；当前项目没有对应机器字段/输入入口 |
| 总针数 | 3216 | 记录在审计结果；没有独立 totalNeedles 机器字段 |
| Needle Type Count | 4 | 由排针 [1,2,3,4] 表达；Cam 行数未创建 |
| Feed Cycle | 8 | 记录在审计结果；未创建实际 8 Feed 对象 |

项目 chart 保留新建项目默认 **30 × 40**，仅为设计区域，不能解释为真实机台总针数或 Feed Cycle。Machine Domain 可接受指定输出 width，但目前没有独立的圆筒直径/总针数机器配置和圆筒几何；未把 chart 宽度擅自改为 3216 来冒充完整机器建模。

## 6. Needle Arrangement

实际 UI 输入和确认：`needleArrangementInputs = ["1234", "", "", ""]`；`needleArrangement = [1,2,3,4]`。导出并重新导入后保持一致。没有修改 Pattern 来实现排针。

## 7. 最终 Cam 4 × 8 矩阵

**未录入；singleJerseyCamProgram = null。** 下表的“未提供”是数据缺失标记，不是机器动作。

| Needle Type | Feed1 | Feed2 | Feed3 | Feed4 | Feed5 | Feed6 | Feed7 | Feed8 |
|---|---|---|---|---|---|---|---|---|
| 1 | 未提供 | 未提供 | 未提供 | 未提供 | 未提供 | 未提供 | 未提供 | 未提供 |
| 2 | 未提供 | 未提供 | 未提供 | 未提供 | 未提供 | 未提供 | 未提供 | 未提供 |
| 3 | 未提供 | 未提供 | 未提供 | 未提供 | 未提供 | 未提供 | 未提供 | 未提供 |
| 4 | 未提供 | 未提供 | 未提供 | 未提供 | 未提供 | 未提供 | 未提供 | 未提供 |

已检查当前项目中的候选工艺/图片文件，实际查看 `img007.jpg` 与 `img009.jpg`：分别为面料照片和单纱照片，均不是 Cam 工艺图。没有从旧测试报告或 Solver fixture 借用矩阵，也没有创建默认 4 × 4 全 K 草稿。已询问真实图纸路径；截至报告生成没有收到可用于录入的新数据。本次检索范围不代表整台电脑均不存在工艺图。

## 8. Yarn Asset 实际配置

- 名称：`N6/W(6040)`。
- 实际 ID：`yarn-1792072401481`。
- 分类：`OTHER`。现有分类只有 T / CD / N / OP / OTHER，没有准确的 N6/W 混纺类别，使用现有兜底分类，未创建新分类。
- PBR：baseColor、normal、roughness、ambientOcclusion 四个槽位。
- physicalRepeatLengthMm：22.987。
- Yarn Asset 本身没有独立 color、diameter 字段；没有伪造真实直径。
- 系统初始默认 `Yarn 1` 仍保留，没有绑定为主纱或改名冒充真实资产。默认 companion ply 仍禁用，未建立任何 20D LOW 资产。

## 9. Color 来源

**本次没有真实 SOP 最终织物颜色可供测量**：没有 Cam/Feed assignment，真实主纱 PBR 未进入机器模拟。

当前基础设计预览使用 Legacy Yarn1 / `yarnPlies[0].color = rgba(190,190,190,1)`；其 texture 为 null。最终机器面板为空，不应将这份默认颜色与真实面料比较。

源码追踪显示：有效 Feed assignment 会通过 yarnId 查找 YarnAsset.pbr，构造 `textureStrength: 1` 的材质视图；WebGL baseColor 存在时以 Albedo 采样决定基色，缺图或降级时可使用 primaryPly.color。本次没有另选颜色覆盖 Albedo，也没有验证该条件链在本 SOP 的实际运行结果。

依据：[yarnTextureBrush.js](C:/Users/liuchen/Desktop/knitscape/src/simulation/yarnTextureBrush.js:123)、[yarnUvWebglRenderer.js](C:/Users/liuchen/Desktop/knitscape/src/simulation/yarnUvWebglRenderer.js:40)。

## 10. Diameter 来源

保留系统 Legacy 主 ply 默认 **0.24 模型单位**，标记 **DIAMETER_NOT_CALIBRATED**。它不是实测 mm。默认第二 ply 的 0.14 也不是 20D LOW 参数，且仍被禁用。

当前渲染/几何使用 primaryPly 的 diameter，未从 YarnAsset 获取独立真实直径。未使用扫描高度 7.6623 mm。

## 11. PBR 来源与完整性

源为本次指定的 `PBR\Yarn1` 五张真实存在文件，实际进入项目四张。对导出包中四个贴图条目逐一计算 SHA-256，**4/4 与源文件完全一致**，没有改色、缩放或重采样源贴图。48 × 16 的小预览图仅用于资产 UI，不是替代渲染源贴图。

Metallic 源文件保留在原目录，未伪装成其他槽位。导出包不含 Metallic，也没有运行时 Metallic sampler。

## 12. Feed Assignment

真实需要主纱的逐 Feed 对应关系未提供，8 Feed 实际对象也未建立。当前 Feed 数据隶属于 Cam Program；Cam 为 null 时 UI 不显示 assignment 编辑器。

| 计划 Feed | 实际 Yarn assignment | 实际 target | tension | solved / status / applied / error |
|---|---|---|---|---|
| 1 | 未录入 | 未录入 | 未录入 | 无结果 |
| 2 | 未录入 | 未录入 | 未录入 | 无结果 |
| 3 | 未录入 | 未录入 | 未录入 | 无结果 |
| 4 | 未录入 | 未录入 | 未录入 | 无结果 |
| 5 | 未录入 | 未录入 | 未录入 | 无结果 |
| 6 | 未录入 | 未录入 | 未录入 | 无结果 |
| 7 | 未录入 | 未录入 | 未录入 | 无结果 |
| 8 | 未录入 | 未录入 | 未录入 | 无结果 |

没有为了建立 Feed 创建不真实的 K/T/M 矩阵，也没有假设 8 Feed 均需要主纱 23 cm。20D LOW 完全未建模，范围始终是 **PARTIAL SOP REPRESENTATION**。

## 13. Yarn Length Target

已确认的主纱工艺目标是 **23 cm / 100 needles**，保存在审计 `results.json` 的 confirmedSop 中。由于缺少可靠逐 Feed 对应关系，该目标**尚未写入任何实际 Feed × Yarn**。

UI 的“当前纱长 24.79 cm / 100线圈”是新建默认 Pattern 的基础几何统计，界面标明“非目标求解值”。它不是主纱 23 cm 的 solved result。

## 14. Solved Result

本例 Solver 未运行，结果列表为空。无 CONVERGED、UNREACHABLE_TARGET、solved、error 或 appliedToSimulation 运行时记录；`results.json` 对未形成的各 Feed assignment 使用 null，而非捏造结果。

`validate.log` 内的 CONVERGED / VALIDATED / 数值结果属于仓库验证脚本自己的测试 fixture，**不是 SOP-001 结果**。

## 15. Tension 是否实际填写

**未填写。Tension awaiting confirmation。** 现有资料不能可靠确认 5 cN 对应 N6/W(6040)，没有猜测。

Domain 的 Feed Yarn 数据允许 `tensionCN` 为数值或 null，但当前 Feed 编辑器未显示张力输入控件；Simulation / Yarn Length Solver 也不读取 tensionCN 进行张力物理计算。前者为 UI 能力暴露问题，后者为模型能力边界；本次缺失的主因仍是张力对应资料未确认。

## 16. Physical UV 是否实际生效

分层结论：

| 环节 | 本次实际证据 |
|---|---|
| 原始 PBR | 2172 px / 用户提供 2400 DPI = 22.987 mm |
| YarnAsset | UI、最终项目 manifest、重新导入均显示 22.987 |
| Feed assignment | 未建立，链路停在这里 |
| renderer 的 SOP 材质 | 未产生 |
| renderer 最终真正使用的 repeat | **不可用 / null；不能宣称 22.987 已生效** |

只读源码确认当前软件已经有完整的条件数据路径：`YarnAsset.pbr → resolveFeedYarnPlies → drawYarnSimulation → buildYarnUvStrip`，在有效 physicalRepeatLengthMm 时计算：

```text
U = (arcLengthOffset + pathArcLengthInModelUnits)
    × (25.4 / machineGauge)
    / physicalRepeatLengthMm
```

该分支有独立验证脚本并通过本轮 validate。元数据无效或缺失时才使用旧 48 模型单位分支；Canvas 降级路径与 UV WebGL 路径不同，仍需在真实 SOP 模拟时确认实际渲染路径。本轮没有为得到视觉结果使用旧 48、随机比例或其他替代值。

依据：[drawYarnSimulation.js](C:/Users/liuchen/Desktop/knitscape/src/simulation/drawYarnSimulation.js:109)、[yarnPathUvStrip.js](C:/Users/liuchen/Desktop/knitscape/src/simulation/yarnPathUvStrip.js:43)。

## 17. PreviewValidity

实际 UI 为 **DESIGN_PREVIEW**，重新导入后仍如此。不是 VALIDATED。

当前入口在 Cam 为 null 时返回 null，机器模拟不执行：[singleJerseyExecutionInput.js](C:/Users/liuchen/Desktop/knitscape/src/components/singleJerseyExecutionInput.js:10)。即便未来得到 VALIDATED，也只代表当前 KnitScape 几何模型中的目标求解及应用，不代表真实生产通过。

## 18. 截图与 3D 状态

已保存真实 UI 截图和 DOM 操作证据；没有制作或替代生成面料结果。

| 要求截图 | 证据或无法完成原因 |
|---|---|
| Machine / Cam 设置 | 04-machine-needle-final.jpg；Cam 未创建 |
| Needle Arrangement | 05-reimport-machine.jpg；1234 已恢复 |
| Feed / Yarn 配置 | Cam 缺失，未产生该 UI；见机器截图与本报告第12项 |
| YarnAsset / PBR | 06-reimport-yarn-pbr.jpg |
| Yarn Length Result | 05-reimport-machine.jpg 显示 DESIGN_PREVIEW，未生成结果表 |
| 3D 正面 | 未生成 SOP 结构，无法截图 |
| 3D 近距离 | 未生成 SOP 结构，无法截图 |
| 侧面 / 背面 | 未生成 SOP 结构；现有界面有翻面，但没有真实 3D 旋转/侧视能力 |

现有 renderer 是分层 2D/2.5D UV ribbon，顶点 shader 的 z 为 0；不能把它宣称为真实三维受力/碰撞织物模型。没有在空面板上执行缩放/翻面来制造结果截图。

![机器参数、排针和未创建的 Cam](C:/Users/liuchen/Desktop/knitscape/reports/sop-001/05-reimport-machine.jpg)

![重新导入后保留的真实 PBR 与 22.987 mm](C:/Users/liuchen/Desktop/knitscape/reports/sop-001/06-reimport-yarn-pbr.jpg)

## 19. 与真实面料照片对比

已实际查看 `img007.jpg`（面料）和 `img009.jpg`（单纱）。面料照片可观察到乳白/浅米色、明显纤维毛羽、起伏和不完全规则的表面纹理；单纱照片可观察到纤维环状卷曲及沿长度的局部粗细差异。照片未提供与本次视图一致的光照/色彩/比例尺标定。

本例没有形成 SOP 模拟图，以下各项均**无法比较或评分**：

- 结构层：循环、浮线/线圈、Needle Type 错位、Feed 循环；不从照片反推 Cam。
- 路径层：23 cm 的实际应用、路径连续性、异常拉伸/穿模/跳线。
- 材质层：四张图已进入资产；Normal、Roughness、AO 在本例是否实际参与渲染尚未验证；Metallic 不支持，无法验证其非金属表现；PBR 沿纱线连续性未验证。
- 尺度层：22.987 已保存，未进入本例 renderer，无法判断过密/过疏。
- 真实视觉：结构相似度、纱线质感、毛羽、蓬松度、表面粗糙度、颜色、尺度感均不作相似判断。没有“高度一致”的结论。

## 20. TYPE A — SOP 数据或标定缺失

1. **关键阻塞：32 个可靠 Cam 单元格缺失**，以及符号图例、Feed/Needle Type 的方向和顺序未提供。
2. 各 Feed 主纱对应及是否均为 23 cm 未确认。
3. 5 cN 是否对应主纱未确认。
4. 真实主纱直径未知：DIAMETER_NOT_CALIBRATED。
5. 20D LOW 按本轮范围主动不建模；不能因此宣称软件无法表示第二根纱。
6. 缺少实机视觉、比例尺、光照和颜色标定数据，不具备 LEVEL 4 条件。

## 21. TYPE B — 已有能力，但 UI / 操作不便

1. Feed assignment、Feed 数和纱长编辑入口依赖先创建 Cam。已有 4 × 8 / Feed / Solver 能力，但在“不猜 Cam”的本例不能先独立保存 8 Feed 待办配置。
2. 物理重复长度已有 UI 和 Domain 支持。首次自动化 fill 后显示 22.987，却未触发 change 提交，首个导出包不含该字段。使用原生数值键后最终成功提交，导出/重新导入均确认。保留首轮包作证据。该观察是自动化提交路径差异，**不足以断言人工操作同样有保存 bug**。
3. 混合导入中 Metallic 被忽略，界面没有逐文件忽略提示，容易把“PBR 已设置”误读成五图齐全。
4. tensionCN 可存储，但 UI 未提供张力输入入口；本次仍缺对应工艺数据，没有通过开发入口写入 5。
5. 当前内嵌浏览器较窄，表格与工具栏有横向溢出；fullPage 截图和 DOM 文本共同保留证据。未为截图修改应用布局或 UI。

## 22. TYPE C — 当前 Domain / Simulation 能力边界

1. **Metallic 不受支持**：PBR 规范化、识别器和 shader 均无 metallic 槽位，无法仅靠手工指定解决。
2. 当前项目无专门的 32英寸机台直径 / 3216 总针数机器参数持久化和圆筒几何。指定输出 width 不等同于完整机台建模。
3. YarnAsset 未定义独立真实直径；当前几何继承 Legacy 主 ply 的模型 diameter。
4. tensionCN 当前是元数据，不驱动张力力学/路径求解。
5. 当前是分层 UV ribbon 外观模型：Normal 绿色通道参与简化 relief，Roughness 调节高光，AO 乘入颜色；不等同于完整的物理 PBR BRDF、三维毛羽/蓬松度及受力碰撞模拟。未做运行时效果主张。
6. Cam 单元格只接受 K/T/M，没有“未知”执行动作；不能用未知占位构造可运行的真实 Cam。**4 × 8 Cam、主纱23目标、Physical UV 本身不是能力缺口。**

本轮没有发现需要更改源码才能继续录入已知资产的新增阻塞 bug。缺少 Cam 仍属于 TYPE A；Metallic 则由源码明确证明属于 TYPE C，二者分开记录。

## 23. 保存项目与审计路径

最终项目（数据录入版，非可执行 SOP 样本）：

`C:\Users\liuchen\Desktop\knitscape\reports\sop-001\SOP-001-N6W6040-main-yarn.knitscape`

通过原生 UI 导出后复制至新文件，未覆盖现有项目。文件 2,697,166 bytes，含 project.json 与四个完整原始 PNG 条目。真实 UI 已重新导入并确认 32G / 1234 / 四图 / 22.987 恢复。

同目录保存：`results.json`、`project-export.manifest.json`、`pbr-source-inventory.json`、`pbr-png-metadata.json`、`export-asset-integrity.json`、`operation-log.md`、各截图/DOM、验证/构建日志、初始/最终 git 状态和 baseline-final.json。

`first-export-repeat-uncommitted.knitscape` / 同名 manifest 是首次输入未提交的诊断证据，**不可用作最终项目**。

## 24. Validate / Build

已实际完成：

- `npm run validate`：**36 / 36 validators passed**，退出码 0。
- `npm run build`：**成功**，退出码 0。
- 运行后 tracked / staged git diff 均为空，HEAD/标签/分支未变。

日志：`validate.log`、`validate-exit.txt`、`build.log`、`build-exit.txt`。覆盖现有机器 Domain、Simulation adapter、排针/Cam、Yarn Library、PBR 持久化、Physical UV、Feed PBR renderer、多纱及 Yarn Length Solver。它们是软件回归检查，不是本 SOP 的真实生产验证。

## 25. 最终分级

**LEVEL 1 — DATA ENTRY ONLY。**

原因：可可靠读取的真实 Cam 逐格符号缺失，真实 SOP 尚未形成机器 Simulation。不能给 LEVEL 2/3；本轮禁止 LEVEL 4。

## 26. 下一步最重要的三件事

1. 提供可清晰读取且含方向/顺序图例的 4 Needle Types × 8 Feed 工艺图，并确认逐 Feed 主纱分配、23 cm 对应范围及 5 cN 的归属。
2. 用该工艺图继续本次已保存项目，通过现有 UI 完成 Cam/Feed/目标录入并运行；逐项核对 solved、error、appliedToSimulation、PreviewValidity 及 renderer 实际 Physical UV。
3. 补主纱直径和有比例尺的实物参考，并在后续独立开发任务中决定 Metallic、每资产直径及张力/真实3D边界的处理；本轮不开发、不补20D LOW。
