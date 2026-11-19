# KnitScape Real SOP Geometry Gap Audit

审计日期：2026-10-16（Asia/Shanghai）。本轮为诊断，未修改业务代码，未实施修复、Relaxation 或 P1 开发，未 commit/tag/reset/checkout/stash/clean。

证据标签：**FACT**＝源码/文件/实际实验直接证明；**INFERENCE**＝由事实推导、仍有适用边界；**HYPOTHESIS**＝待实验排除或确认的候选；**UNKNOWN**＝缺少判断所需信息。P0–P3是处理优先级，不替代证据等级。

## EXECUTIVE CONCLUSION

1. **最终等级：C — CURRENT SIMULATION HAS CORRECTNESS ISSUES。** 已证明 Feed 8 的有限预览顶边进入目标长度平均：32×40 完整循环窗口报告 **22.999580 cm/100针**，内部完整循环实际为 **23.701616 cm/100针**，相对23目标偏高 **3.05%**。应先处理这一求解验收口径问题，再讨论 Relaxation。它不能单独解释全部视觉差距。
2. **FACT：当前没有真正的三维纱线几何。** 实际为 XY 中心路径、二维 ribbon/stroke、front/mid/back 三层合成；WebGL 顶点 Z 固定为0。翻面是层序交换和水平镜像。
3. **FACT：8cm 没有应用到显示几何。** 真实4×8 Cam、32G、默认模型直径0.24下，8个 Feed 均 `UNREACHABLE_TARGET`；显示的是默认 loopHeight=0.6 路径。23+8 是 `PARTIAL`，不能称为完整 SOP 成功模拟。
4. **FACT：第二根纱没有通过张力拉紧主纱。** 加入第二根后，主纱112,906个模型采样坐标全部不变。第二纱目标8→23时，主纱259,140个绘制顶点也全部不变。加入第二根时主纱绘制位置会因固定并排偏移移动，不能把这种位移当成物理耦合。
5. **FACT：5/4cN 为 `DATA_ONLY`。** 项目包和导入规范化保留张力；改变张力不改变两根纱任何被比较的模型坐标或绘制顶点。弹性、力学接触、碰撞、摩擦、能量最小化和松弛均 **NOT IMPLEMENTED**。
6. **FACT：0.24是未标定的模型直径，不是真实纱径。** 在32G的一模型单位=一针距换算下名义等效0.1905mm。没有独立直径的20D Feed槽也回退到0.24；侧栏禁用 companion 的0.14不会自动成为20D纱径。改直径会同时改变中心线、求解高度和绘制宽度。
7. **FACT：22.987mm 的使用语义正确，仅标定沿纱线路径的 U。** 但 Albedo 每列 alpha>128 像素数中位数仅59/724=8.15%，全幅 V 映射显著压窄可见纱线。固定镜头浏览器对照复现了该问题；它是材质覆盖问题，不能被归因为缺少 Relaxation。
8. **FACT：保存项目的1234和4×8 Cam与工艺图逐格相符，Domain→Adapter未发现转置。** 32×40输出全部1280格独立核对通过；实际机台 A行/针踵基准、Feed行进方向仍需工艺人员确认。不能由软件内部一致性直接证明实机全部拓扑正确。
9. **INFERENCE：图1中央密带优先解释为不同纵向尺度的独立路径叠加及周期性相位重合。** 默认第二纱范围比23主纱高约23.3%；固定视图复现了疏密干涉。尚无证据把该密带解释为正确受力布面、Feed错位或相机透视。
10. **验证边界：当前37/37 validators与build通过，不等于物理验证。** 原始四图、来源项目、定量结果、完整diff、固定视图截图和源文件哈希均已记录；149个业务/验证/配置文件的保护核验见 `final-preservation.json`。

## A. FACTS

### A1. 当前代码与审计对象

- 分支：`main`；HEAD：`7ababf264d495f6b96d4d66652c529424938ac4d`。
- 标签 `baseline-trusted-yarn-length` 是 annotated tag：原始对象 `7d33fe763c779989f92014ca29479dbb7d61e252`，剥离后 commit 与HEAD相同。`initial-state.json` 中原始 `tagCommit` 字段实际保存的是未剥离的tag对象，不应误读为另一代码commit。
- **工作区不是 baseline 原样代码。** 开始已有13个tracked文件修改，合计142新增/61删除；还有未跟踪的 `src/domain/yarnMaterial.js`、`scripts/validate-yarn-material-authority.mjs` 等。完整tracked差异见 `baseline-working-tree.diff`，初始状态及源码SHA-256见 `initial-state.json`。
- 当前已有 Asset优先的颜色/直径解析、逐纱直径profile和Metallic通路。这些是审计前已存在的工作区修改，本审计没有实施或续做这些开发。
- 已阅读AGENTS、当前功能算法说明及NEXT_TASK。后二者仍描述更早基线；“机器设置未保存”已不符合当前export/import源码与项目包，不能据此诊断当前丢失Cam。

### A2. 原始证据

|证据|实际文件|尺寸|身份核验/用途|
|---|---|---|---|
|用户图1，23+8|`C:/Users/liuchen/Desktop/两根纱长.png`|616×432|SHA-256以`abc41e40…`开头；中央密带、周期V形可见|
|用户图2，23 only|`C:/Users/liuchen/Desktop/一根纱长.png`|471×292|SHA-256以`0aa851c4…`开头；与图1裁剪范围不同|
|用户图3，SOP|`C:/Users/liuchen/Desktop/工艺.jpg`|1920×1080|与既有 `source-process-sheet.jpg` SHA-256完全相同：`f6293d52…`|
|用户图4，布面|`C:/Users/liuchen/Desktop/knitscape/面料放大.jpg`|3235×3109|与旧报告img007参考的SHA-256完全相同：`f1b88a5b…`|
|可复算项目|`reports/sop-001/SOP-001-N6W6040-main-yarn-with-cam.knitscape`|30针×40行|SHA-256：`0d84dd7a3b7d408345015963279e5ea6548d501cbf84887d019a5f538b99eed8`|

完整路径、哈希、DPI和EXIF检查见 `image-metrics.json`。本轮以用户新提供四图为准，未把之前找到的相似UI截图替代这四图。

### A3. 工艺数据来源、单位与落点

|数据|来源/物理含义|当前使用位置/公式|适用条件与边界|
|---|---|---|---|
|巨登单面、32英寸、3216针|工艺单及用户；机台身份/筒径/总针数|机台类型决定现有Single Jersey链；筒径和总针数无专门仿真字段|30×40是局部预览，不是3216针圆筒|
|32G|工艺单；每英寸针数|`gaugeToNeedlePitchMm()`：25.4/32=0.79375mm|这是机器针距标尺，不是实测松弛wale距|
|1234、4×8 Cam|工艺单排针与组织图|`resolveSingleJerseyOperations()`|A-D→Type1-4、列1-8按图顺序转录；实机基准需确认|
|23、8cm/100针|工艺单实际纱长栏；备注明确织机100针基准|Feed槽的`yarnLengthCmPer100Needles`；Solver几何长度约束|20D的测量负荷/伸长参考状态UNKNOWN；软件没有该状态变量|
|5、4cN|工艺单张力“记录”栏|Feed槽`tensionCN`可保存；无几何/材料消费|不能视为实际受力边界已施加；“实际”张力栏为空|
|91.20%、8.80%|工艺单原料比例|当前无质量比例求解/守恒消费|不能把比例当作两根纱直径比或屏幕面积比|
|N6/W(6040)、20D LOW|原料名称|资产名称/分类/分配|代码不解析名称推断纤维性质；不得仅凭LOW断言弹性本构|
|2172×724、2400DPI|像素来自源PNG；DPI由用户明确提供|横向2172/2400×25.4=**22.987mm**|原请求22.98725是近似计算偏差；公式精确值22.987，不影响本轮主结论|
|physicalRepeatLengthMm=22.987|保存项目/资产；沿纱线贴图横向长度|`buildYarnUvStrip()`的U换算|不决定直径、loop宽、布幅或圆周|
|0.24、0.14|Legacy默认模型参数|路径法线偏移/绘制宽度；详见H|不是实测纱径；0.14默认companion禁用|
|h默认0.6；界限0.05–2|源码模板及求解器|节点纵向网格和候选长度|未标定；不是织机调节范围或材料极限|
|SPREAD=0.88、STITCH_RATIO=5/3|源码造型/显示常数|法线位置、适配画布|未找到真实面料标定依据|

工艺单还可读到两种纱覆盖组织1–8，各96口，以及胚布幅宽56英寸、胚布码重264 G/Y。成品幅宽/码重/克重栏空白；软件没有消费这些数据。56英寸的开幅/折幅及工艺阶段定义不足，不能据此直接算成品wale/course密度。

## B. PREVIOUS WRONG ASSUMPTIONS

以下区分可被证据否定的推论与旧报告实际说过的话；不把假设强加给用户。

|待纠正前提/推论|依据|风险与替代解释|
|---|---|---|
|“23+8图已按两个目标完成求解”|8个8cm目标未收敛；默认路径仍绘出|会把失败fallback解释成真实20D状态；应称23已应用+第二纱设计预览|
|“第二根加入后变密，所以它拉紧主纱”|主纱模型坐标完全相同；8→23主纱顶点相同|是叠加/法线并排偏移；没有张力耦合证据|
|“只要有tensionCN就使用了张力”|仅规范化/持久化读取该字段，张力对照几何相同|混淆数据存在与物理实施|
|“直径只影响tube粗细”|`getBasePointPosition()`使用diameter；0.24→0.36改变全部被比较模型点及h|调粗会同时重求解结构，不是干净的材质增强实验|
|“23cm只做比例换算”|确实二分求解h并替换Feed路径|它是模板内的数值几何约束；但仍不是力学平衡|
|“每Feed报告23，就证明每个生产repeat为23”|Feed8内部23.7016、顶边20.1914，平均22.99958|有限边界可掩盖内部误差；应独立检查内部完整repeat|
|“Metallic当前仍完全不支持”|当前工作区有normalizer、sampler和highlight消费|这是旧快照事实，不是当前事实；即使接入也不会改变结构|
|“真实PBR会自动给出正确纱径/遮盖率”|U标尺与diameter分开；Albedo宽画布透明边界被压进V|可见宽度远小于名义宽度；需检查纹理前景宽度语义|
|“差异必然主要来自缺少Relaxation”|已有失败第二纱、边界平均误差、未标定diameter、alpha宽度损失|这些未隔离前不能给Relaxation归因比例|

旧SOP-001报告明确限定为**仅主纱、PARTIAL SOP REPRESENTATION**，也明确写了2D/2.5D和物理未验证。因此本轮不是否定它的全部事实；需要纠正的是把其LEVEL2或`VALIDATED`外推为完整物理正确，以及本轮新发现的Feed8平均口径问题。

## C. UNKNOWNS

|项目|状态/现有证据|
|---|---|
|图4正面还是反面|**UNKNOWN**。不能凭当前外观可靠定面|
|刚下机还是松弛后|**UNKNOWN**|
|染整、定型、压光、洗涤历史|**UNKNOWN**；成品栏空白|
|放大倍率、镜头/扫描设备、相机距离|**UNKNOWN**|
|实际视野毫米尺寸|**UNKNOWN（未标定）**。文件JFIF带4800×4800DPI；若该元数据真实且未缩放，候选视野约17.11854×16.45179mm，属于条件推算，不能直接作为验收标尺|
|灯光、曝光、白平衡/色彩管理|**UNKNOWN**；白色纤维高亮会影响可见孔隙判断|
|含湿状态、加载状态、成品wale/course密度|**UNKNOWN**|
|两种纱真实直径及可压缩截面|**UNKNOWN**；扫描光学前景宽度不等于机械直径|
|20D LOW确切成分、弹性模量、伸长/回复曲线|**UNKNOWN**；名称不够|
|8cm是卸载后的纱长还是负荷下的长度|**UNKNOWN**。100针基准已确定，纱线测量参考状态仍未确定|
|真实Feed两纱的喂入位置/plating关系|两纱都列在1–8，**各自空间位置UNKNOWN**；软件一律parallel|
|实机A-D针踵方向、第一针/Feed起点、实际编织方向|**UNKNOWN**；代码内部一致已验证|
|图1/图2生成时完整运行状态|**UNKNOWN**。没有与这两次截图一一对应的双纱项目导出/镜头参数；本轮用已保存真实Cam项目做受控重放|

## D. CODE PATH

以下均为当前工作区真实文件，行号对应本轮哈希快照。

|阶段|函数与文件位置|行为|
|---|---|---|
|目标输入|`commitYarnLength()`，`src/views/singleJerseyCamProgramEditor.js:61`|读取Feed×Yarn输入，调用action|
|State|`setSingleJerseyFeedYarnLength()`→`commitFeedYarnLength()`，`src/actions/singleJerseyCamProgram.js:226`|规范化后写入Cam的feeds.yarns，不改Pattern|
|保存|`getProjectData()`，`src/actions/exporters.js:135`；`createProjectPackage()`，`src/actions/projectPackage.js:66`|保存完整Cam/feeds、排针、Gauge、资产|
|导入|`readProjectPackage()`，`src/actions/projectPackage.js:108`；`yarnProjectFields()`，`src/actions/importers.js:36`|恢复及校验；张力由Cam规范化保留|
|机器动作|`resolveSingleJerseyOperations()`，`src/domain/singleJerseyMachine.js:71`|Track×Feed结合排针产生K/T/M|
|适配|`createSingleJerseySimulationInput()`，`src/adapters/singleJerseySimulationInput.js:9`|K→0、M→2、T→3，生成Bimp|
|执行入口|`createSingleJerseyExecutionInput()`，`src/components/singleJerseyExecutionInput.js:4`；`run()`，`src/components/runSimulation.js:208`|传机器输入及feeds/library给排针后simulate|
|拓扑|`Pattern`→`ProcessModel`→`YarnModel`，`src/simulation/`同名文件|K/T/M转接触邻域、路径点、link层序|
|材质|`resolveFeedYarnPlies()`，`src/simulation/yarnTextureBrush.js:125`；`resolveYarnMaterial()`，`src/domain/yarnMaterial.js:10`|按资产ID解析；字段优先级Asset→Legacy→默认|
|几何|`buildYarnPathGeometry()`，`src/simulation/yarnPathGeometry.js:61`|XY节点、法线偏移、Catmull-Rom曲线、周期测量上下文|
|求解|`simulate()`，`src/simulation/yarnSimulation.js:102`；`solveFeedYarnLengths()`，`src/simulation/yarnLengthSolver.js:107`|按Feed×Yarn独立求h，缓存结果|
|应用|`resolveModelPathsForDisplay()`，`src/simulation/yarnPathGeometry.js:117`；`yarnSimulation.js:310`|收敛路径替换；逐course平移以接续；失败保留base|
|绘制|`drawYarnSimulation()`，`src/simulation/drawYarnSimulation.js:20`|按front/mid/back分层、逐纱宽度及parallel offset|
|WebGL几何|`buildYarnUvStrip()`，`src/simulation/yarnPathUvStrip.js:20`|中心线采样→左右边界→二维三角形与UV|
|GPU/合成|`YarnUvWebglRenderer.drawStrip()`，`src/simulation/yarnUvWebglRenderer.js:311`|vec2位置上传；gl_Position.z=0；随后合成到2D canvas|

源码导航：[机器Domain](C:/Users/liuchen/Desktop/knitscape/src/domain/singleJerseyMachine.js:71)、[Solver](C:/Users/liuchen/Desktop/knitscape/src/simulation/yarnLengthSolver.js:107)、[路径几何](C:/Users/liuchen/Desktop/knitscape/src/simulation/yarnPathGeometry.js:61)、[Simulation](C:/Users/liuchen/Desktop/knitscape/src/simulation/yarnSimulation.js:102)、[绘制](C:/Users/liuchen/Desktop/knitscape/src/simulation/drawYarnSimulation.js:20)、[WebGL](C:/Users/liuchen/Desktop/knitscape/src/simulation/yarnUvWebglRenderer.js:1)。

## E. 23CM MECHANISM

### E1. 存储、单位与目标函数

**FACT：**23保存在：

```js
singleJerseyCamProgram.feeds[feedIndex].yarns[yarnIndex]
  .yarnLengthCmPer100Needles
```

`simulate()`抽取正有限目标；按每根纱的diameter profile创建/复用几何，为每个Feed提供只含相应course的视图。Solver输入包括Feed目标、Gauge、几何回调、h边界/容差，不包括张力或材料本构。

```text
pitch_mm = 25.4 / Gauge = 0.79375
target_model_per100 = 23 × 10 / pitch_mm = 289.763779527559

每course：L100(h) = 该测量窗口全部归属link的弧长 × 100 / 窗口针数
每Feed：F(h) = 所有 row % feedCount == feedIndex 的 L100(h) 算术平均
目标：|F(h) - target_model_per100| <= 0.01 model unit/100针
对应32G容差：0.00079375 cm/100针
```

**不是按K针数、实际成圈数或可见V形数计100针。**K/T/M都占机器针位，测量窗口needleCount包含这些针位。`periodicMeasurementPattern()`查找横向整除的完整bitmap周期，重复三份，取中间一份，包含跨周期的outgoing link；`createModelLengthEvaluator()`积分Bezier速度，生成每course长度。对外`measuredNeedleCountByCourse`报告pattern.width，本例30；内部periodic窗口实际按其检测周期计数再归一。

先用9个h样本检查长度单调性，再最多48轮二分。`minLoopHeight=0.05`、`maxLoopHeight=2`。超出可解范围返回边界候选及`UNREACHABLE_TARGET`；该候选不会应用。

### E2. 求解变量与实际形状变化

**FACT：Solver当前唯一迭代自由度是h（loopHeight）。**不是改变每个控制点的优化器。候选生成会克隆节点，令`node.modelY=(graph.height-j)*h`，重算法线与曲线。因此“只调h”不等于“只有Y坐标变化”。

|问题|代码证明的答案|
|---|---|
|X变不变|节点基准X=(i/2)×1不变；法线依赖h，`diameter/2*normalX`使中心线X和曲线控制点可以改变；不是X整体缩放|
|Y变不变|改变；节点纵向网格、法线偏移、曲线都改变；显示应用还逐course平移接续|
|Z变不变|没有Z自由度；WebGL Z始终0|
|sinker loop|连接段由同一图和曲线重算，随h/法线变化；没有独立沉降弧力学或长度优化|
|needle loop|腿/头路径随候选节点和法线变化；没有独立针编弧优化|
|course spacing|有效纵向间距随各Feed的h和逐行接续变化；不是测得的成品横密|
|wale spacing|基准模型针距固定1；细节轮廓X可改变；无独立wale收缩自由度|
|局部还是整体|候选模板在整个图上按单一h构造，但只取当前Feed的courses；最终拼装各Feed的不同h路径。不是整个织物统一缩放，也不是局部力传播|
|求解后替换什么|`solvedPathByLink`中的M/L/C路径写入对应strand的modelPathByLink，再转显示路径/UV ribbon；ProcessModel拓扑及Pattern不因目标值重建规则|
|23是约束还是比例|先物理单位换算，再做模板路径弧长约束；不是只乘比例，也不是完整物理约束|

本例30×40、0.24下Feed1–8的h分别为：

```text
0.5313110352  0.4270507813  0.5313110352  0.4082458496
0.5377380371  0.4218734741  0.5377380371  0.4706115723
```

模板行距的名义毫米值为h×0.79375，范围0.32405–0.42683mm；8行内部显示重复纵距约3.86588模型单位，即名义3.06854mm，平均每行约0.38357mm。**这些不是实测线圈高度/成品course密度。**单个needle-loop实际轮廓还包括弧线和跨行Tuck，不应直接把h当作其包围盒高度。

### E3. 已确认：有限顶边污染长度验收

`Y_PADDING=0`，`YarnModel.finalLocation()`在顶部接触行直接停止追踪。Feed8的最后一行因此不同于内部同Feed，`measuredLengthForFeed()`仍将它纳入等权平均。

在完整横向repeat的32×40窗口，求得Feed8 h=0.454425048828125：

|course（零基）|换算cm/100针|
|---|---:|
|7|23.701611|
|15|23.701616|
|23|23.701616|
|31|23.701616|
|39，顶边|20.191442|
|Solver平均/报告|**22.999580**|

独立取第23行中部16针（4个完整1234循环），对实际M/L/C路径按outgoing-link归属精确积分，再归一100针，得到 **23.701615588574**，与内部周期测量一致。不是仅凭图像判断。

32×48时Feed8 h变为0.449128723144531，内部约23.578556，平均仍22.999636。原始30×40项目也存在同类问题：内部23.675983、报告22.999734。

**FACT：`VALIDATED`保证的是当前有限窗口平均目标，不保证每个内部生产repeat。INFERENCE：将它作为该循环工艺的23cm真实验收存在正确性缺口，优先于物理层开发。**这不证明积分器或二分本身错误；新实验定位到测量样本/边界条件，而非舍入误差。

## F. 8CM SECOND-YARN MECHANISM

### F1. A/B/C/D/E分类

|类别|结论|
|---|---|
|A 独立第二条geometry|**是**：每slot有独立strand路径Map、独立长度求解和绘制；同直径profile可复用基础几何以节省计算|
|B 第二纱改变第一纱geometry|模型中心线**否**；加入纱线会因parallel offset改变第一纱绘制位置，属于排布，不是受力变形|
|C 共享参数|**是**：同Cam拓扑、Gauge、primaryLengthScaleY、显示标尺；缺Asset直径时同Legacy直径；相同目标/profile可共享求解计算|
|D constraint/tension coupling|**否，NOT IMPLEMENTED**|
|E 其他|收敛纱线用独立候选；失败纱线用base模板；绘制时按直径总和安排法线offset|

`parallelOffset()`公式：前面各纱直径之和 + 本纱直径/2 − 全部直径/2。两根均0.24时第一根为−0.12、第二根+0.12模型单位。`buildYarnUvStrip()`只移动显示位置，不改变Solver中心线或其U长度。

### F2. 8cm实际执行结果

默认0.24下，各Feed最小可解长度为：

```text
12.988409 13.479989 12.988409 13.561702
12.839089 13.399321 12.839089 13.208565 cm/100针
```

8cm比所有下限都短。Solver给出的h=0.05只是失败时最近候选；**实际显示未采用0.05，而是base h=0.6**。将第二纱诊断直径单独设为0.14后，下限仍约11.07396–11.69167，8个目标仍失败，不能以“调成0.14即可解决”替代验证。

**FACT：图1中第二根的存在影响绘图，但不能说8cm约束已经塑造了它。**8-only与目标未设置的base路径哈希完全相同。23+23对照中第二根能收敛，且与主纱共享相同中心线形状，再由正负法线偏移并排绘制。

### F3. 物理能力清单

|能力|当前执行链状态|
|---|---|
|yarn-yarn物理接触、接触反力|**NOT IMPLEMENTED**|
|collision / nonpenetration|**NOT IMPLEMENTED**|
|elasticity / rest-length / strain|**NOT IMPLEMENTED**|
|tension force / force balance|**NOT IMPLEMENTED**|
|energy minimization / bending stiffness|**NOT IMPLEMENTED**|
|fabric/loop relaxation|**NOT IMPLEMENTED**|
|compression / friction|**NOT IMPLEMENTED**|
|物理deformation / constraint propagation|**NOT IMPLEMENTED**|
|K/T/M对接触邻域的拓扑传播|**已实现**；不是力学约束传播|
|h参数导致的确定性曲线变形|**已实现**；不是物理deformation模型|

`ContactNeighborhood`中的contact指组织拓扑接点及实际化状态。源码没有把它转为距离约束、接触法向力、摩擦或碰撞求解。

## G. TENSION

最终状态：**DATA_ONLY**。

|环节|事实|
|---|---|
|Project State|`singleJerseyCamProgram.feeds[].yarns[].tensionCN`；支持null或非负数|
|Save/Reload|实际ZIP codec往返5/4cN成功；Cam action normalizer再次核验通过|
|UI|未发现张力编辑控件；不是UI_ONLY|
|进入Simulation|整个feeds对象作为参数携带它，但Simulation无字段读取/计算；不能据此称为有效SIMULATION_INPUT|
|进入Solver|未读取，不进入目标、缓存key或求解回调的力学计算|
|Geometry/Material|未读取；5/4cN与null/null的模型哈希和两纱全部顶点相同|

原SOP项目张力字段实际是null。诊断fixture填入5/4只在内存和新报告数据中使用，没有改写原项目。结果见 `tension-roundtrip.json`、`deep-probes.json`和`results.json → comparisons.tension`。

## H. DIAMETER

**FACT：当前没有tube radius。**实际宽度为二维stroke/ribbon的`lineWidth=stitchWidth*diameter`；ribbon左右边界各占半宽。

消费链：`yarnPlyPanel.updateYarnPly()`→`GLOBAL_STATE.yarnPlies`→`normalizeYarnPlies()`→`resolveFeedYarnPlies()`/`resolveYarnMaterial()`→逐纱diameter profile→`getBasePointPosition()`与Solver→`drawYarnSimulation()`→`buildYarnUvStrip()`。

- 源项目主纱Asset无diameter，回退启用的Legacy primary=**0.24模型单位**。
- 诊断第二资产无diameter，也回退到primary=0.24。`companion=0.14, enabled=false`是另一Legacy绘制入口，不是按名称绑定到20D的参数。
- 当前支持Asset自有diameter优先，但资产编辑UI主要提供名称、类别、PBR及repeat；不能从“已有字段支持”推出真实材料已经校准。
- 32G名义换算d=0.24×0.79375=**0.1905mm**；半宽0.09525mm仅为二维半宽的等效换算。不是本轮测得的真实机械纱径。
- 没有由PBR、20D名称、混纺比例或Gauge自动推断真实diameter的过程。Gauge仅参与模型单位到mm的解释。

**TEST5 FACT：**把Legacy primary从0.24改成0.36、保持SOP和目标23不变，112,906个中心线采样点全部改变；Feed1 h从0.531311降为0.382359。名义ribbon宽从0.1905变为0.28575mm。原因是diameter同时参与中心线的法线偏移，长度重求解又反向影响h。

因此：centerline会变；二维半宽会变；collision无影响，因为未实现；模型投影遮盖率会变，但不存在独立的物理cover-factor求解。不能把“只改diameter”解释成只改外观。

## I. GAUGE / PHYSICAL SCALE

|对象|32G实际作用|
|---|---|
|needle pitch|**是**：`gaugeToNeedlePitchMm()`=0.79375mm|
|wale spacing|基准X网格一模型针距对应该mm；**没有松弛后wale距求解**|
|physical yarn path|**部分**：XY路径模型弧长乘针距换算mm；没有Z弧长/受力伸长|
|UV|**是**：物理repeat时U=(累计模型弧长×针距)/repeatMm|
|length solver|**是**：物理目标除针距，间接改变h和几何|
|geometry scale|不把整个像素画面直接设为毫米尺寸；无目标时固定模型路径不因Gauge改变，物理解释改变；有目标则间接重求解|
|camera scale|**否**：没有三维camera；stitchWidth由canvas、pattern宽高、5/3比例和simScale计算|

`modelToCanvasPoint()`在X/Y都乘同一stitchWidth。相同输入的simScale 1→1.5测试模型路径哈希完全相同；Gauge32→28则目标模型长度变化，h变化。两者不能混为尺度标定。

横向30针不是机台全部3216针。32英寸/3216不会自动生成圆筒曲率。工艺针距只能提供织机状态参照；它不决定下机、松弛或定型后的布面针距。

## J. CAM / TOPOLOGY

工艺图逐格读取结果，与保存项目一致：

|针型/工艺行|F1|F2|F3|F4|F5|F6|F7|F8|
|---|---|---|---|---|---|---|---|---|
|Type1/A|K|K|K|K|K|K|T|T|
|Type2/B|K|K|K|K|T|T|K|K|
|Type3/C|K|K|T|T|K|K|K|K|
|Type4/D|T|T|K|K|K|K|K|K|

**FACT：**24K、8T、0M。代码按`arrangement[position%4]`选择Type，按`tracks[type-1][feed%8]`选择操作。输出的第一个4针×8路为：`KKKT, KKKT, KKTK, KKTK, KTKK, KTKK, TKKK, TKKK`。

Adapter保留输出行列，K/M/T映射0/2/3，`Pattern.pixToOp=[K,P,M,T]`反映射一致；本Cam不会生成P。实际检查32×40全部1280个像素，没有软件内部转置/Feed错位。活动入口不依赖旧`arrangedChart`；没有恢复或引用被撤销的执行语义。

`ProcessModel`的Tuck累积/移位影响后续接点；`YarnModel`追踪这些点并用link类型决定层序。图中V形不能反向证明这一拓扑与实物已逐线圈吻合。尤其物理上两根纱的位置关系、实机Feed行进方向和顶部/底部接点需要独立验收。

前后预览：`runSimulation.js`交换front/back的top/bottom class，`styles.css:278`水平镜像canvas；bottom还有brightness(0.7)。内部`modelY=(height-j)*h`使较小course索引位于画面下方。不是旋转一个三维网格或对Cam矩阵转置。

**预览窗口注意：**30不整除4；`periodicMeasurementPattern()`仅寻找整除宽度的精确周期，本例会把30针截断窗当30针周期再复制，而不是继续原1234周期。28×40与32×40的对应h一致；30×40部分Feed不同。这里既有截断窗针型占比差异，也有wrap上下文差异，不能把两者未隔离的差值全部归为Feed bug。已确认的独立顶边误差见E3。

## K. PBR / RENDERER

### K1. 当前shader真正做什么

|输入|当前具体消费|不能产生的结果|
|---|---|---|
|Albedo|`mix(tint, texture2D(baseColor), textureStrength)`，包括alpha|不改变中心线或三角形范围；可通过透明度减少可见覆盖|
|Normal|只采样G−0.5加入relief|没有RGB法线向量、TBN、真实曲面受光、位移或接触|
|Roughness|控制`max(0,relief*(1-roughness))`的高光量|不改变外轮廓、纱径、间距或孔洞几何|
|AO|乘在最终RGB上|没有根据现有几何重新算接触遮蔽或填孔|
|Metallic|当前工作区控制高光颜色在白与base.rgb间插值|没有新增BRDF/金属能量模型；不改几何|
|Height|若存在，仅R−0.5加入relief；本源文件没有Height图|不是顶点位移|
|physicalRepeatLengthMm|只用于沿中心线累计弧长的U|不控制横截面、针距、布幅|
|fuzzStrength|WebGL只在现有V边缘乘alpha；2D fallback有额外半透明描边|不是三维毛羽；不能新增空间纤维接触或蓬松体积|

当前源码 `gl_Position=vec4(clip*vec2(1,-1),0,1)`，属性`vec2 a_position`。没有3D管体法线、体积、深度形变、实体碰撞或透视相机。layer顺序与同层纱线绘制顺序可以改变可见遮挡，但不是深度接触计算。

### K2. 物理U正确，但V前景宽度损失明确

**FACT：**2172/2400×25.4=22.987mm。路径U公式正确。独立复算4799条strip，末端U与 `(arcOffset+length)*0.79375/22.987`的最大Float32误差 **7.61×10⁻⁶**。非2次幂图上传前变为4096×1024，归一UV语义不变；这不是diameter来源。

源SOP包实际包含Albedo/Normal/Roughness/AO四张原图，Metallic为空；当前支持Metallic不代表旧包自动补入第五张。`final-preservation.json`逐字节比对了包内四图与当前PBR目录原图，全部一致。

**FACT：**Albedo alpha统计：

- 非零alpha占图像14.557%；alpha>128占8.0155%。
- 每列alpha>128像素数中位数 **59px**，P10=40、P90=74；占724高的中位比例 **8.149%**。
- `buildYarnUvStrip()`为两侧赋V=0、1，整个724像素画布被映射到名义diameter。没有识别/裁切前景宽度的Asset PBR步骤。
- `textureStrength=1`时，基色及alpha直接来自Albedo。名义0.1905mm宽的ribbon，其超过半透明阈值的像素带宽按源图中位比例约0.01552mm；这是**投影/采样意义的估计**，不是机械纱径，GPU插值/重采样还会影响结果。

真实浏览器固定900×900 CSS画布、DPR1.25，生产模块quality与solid对照显示：打开真实PBR后，线条显著退化为很细的纤维痕迹。截图见 `browser-23-quality.jpg` 与 `browser-23-solid.jpg`；本轮没有修改贴图。

**PBR可改善：**色彩、沿纱线细节、简化高光/暗部、现有ribbon内的可见前景覆盖；前景宽度契约的校准可以修正该特定“看起来过细”问题。

**当前PBR解决不了：**错误Cam/Feed、失败的8cm约束、Feed8边界平均误差、中心线大孔、wale/course收缩、Z起伏、两纱受力接触、压缩截面、真实纤维体积。Normal和Roughness不能移动三角形边界去填几何空洞。

## L. IMAGE COMPARISON

### L1. 对用户原图的证据审查

**FACT（图像观察）：**图1在中央有横向密集带，其他区域可见规则V形、三角开口和周期性；图2有明显规则连接及露底；图4呈乳白纤维、卷曲毛羽和较高覆盖。两张软件图无状态栏且裁剪尺寸不同，图4无已确认比例尺；不提供视觉相似百分比或实物孔隙率。

按当前证据解释图1，排序如下：

|候选|证据与等级|
|---|---|
|E 第二纱叠加 + F 独立solver/default几何|**最高：FACT机制、INFERENCE解释原图。**主纱h约0.408–0.538，第二纱失败后h=0.6；高度不同、周期路径局部相位重合。受控浏览器重放出现疏密叠加|
|B repeat/预览边界|**FACT有限边界影响。**顶部/底部接点不同、纵向范围不同；30针不是4的整倍数。对原图中央密带贡献量仍UNKNOWN|
|G Renderer遮挡|**FACT机制。**层序、并排offset、同层绘制先后和alpha影响所见密度。没有单独测得其占比|
|A 正确组织特征|**HYPOTHESIS / P2候选。**真实K/T周期会产生周期性；但不能把失败第二纱的密带认证为真实组织最终形态|
|C Feed indexing / D Needle Type mapping|当前保存项目内部核对通过，**没有支持其为首要根因的证据**；实机基准UNKNOWN|
|H 相机/视图|裁剪/zoom影响感受；**无三维透视相机**。固定画布仍有叠加疏密，故不能仅归因于相机|
|物理拉紧/收缩|代码和坐标对照否定该解释：**NOT IMPLEMENTED**|

### L2. 固定视图证据

浏览器生产链重放使用相同30×40输入、900×900 CSS画布、scale=1、DPR1.25、相同front/mid/back层序。图1原始裁剪没有对应项目，故这是机制复现，不是声称逐像素复原用户截图。

![固定视图的生产浏览器四组对照](C:/Users/liuchen/Desktop/knitscape/reports/real-sop-geometry-gap-audit-2026-10-16/browser-fixed-comparison.jpg)

另有 `fixed-view-comparison.png`：直接栅格化生产strip三角形、第二纱着蓝色，供分辨路径；不含实际shader/阴影/alpha，不作为材质真实度评价。

## M. ROOT CAUSE RANKING

优先级针对“可信解释和预测该SOP”的障碍；不声称能给每项分配视觉差距百分比。

|级别|条目|证据等级、风险与处理边界|
|---|---|---|
|**P0 已确认错误**|Feed8把有限顶边与生产内部repeat平均后作为23cm验收|FACT数值；完整4针循环内部偏差3.05%，远大于solver数值容差。应先修测量/边界验收契约，不能靠Relaxation遮盖|
|**P0 已确认无效比较前提**|把23+8当成两目标均应用的完整SOP|FACT：8项失败、显示fallback。需要先明确20D纱长参考状态/适用几何；不是声称报错机制本身是bug|
|**P1 高概率主因**|默认且未标定的diameter，第二纱回退到同一0.24|FACT配置，INFERENCE导致与真实轮廓/覆盖不同；真实正确数值UNKNOWN|
|**P1 高概率主因（PBR模式）**|全幅V包含大量透明背景，压窄可见纱宽|FACT alpha及固定视图对照；解释PBR模式过细。原图是否开启PBR UNKNOWN，不能包揽所有图像差异|
|**P1 高概率主因**|不同h的独立路径叠加、固定并排偏移、有限预览边界|FACT路径与包围盒，INFERENCE解释密带/强规则性|
|**P1 模型能力缺失**|无张力/弹性/接触/松弛，固定XY模板及无Z|NOT IMPLEMENTED为FACT；对真实差距的大小、必要的具体本构为UNKNOWN，暂不直接启动开发|
|**P2 合理候选**|30针截断wrap、上下边界、实机Feed/Type起点、正反面|边界行为为FACT；其余对原图的根因贡献为HYPOTHESIS，需独立实验避免混因|
|**P2 合理候选**|20D真实空间位置/弹性参考长度/喂纱状态，成品/胚布差异|HYPOTHESIS；缺少资料，不得用材料名称猜参数|
|**P2 条件性候选**|Gauge标尺与下机wale/course间距不同|HYPOTHESIS；机器针距换算正确，但成品密度UNKNOWN；没有证据说25.4/G公式错误|
|**P3 视觉增强**|更完整光照、Roughness/Normal/Metallic外观、毛羽细节|可改善观感；不能修复目标未应用、平均口径或受力结构|

**优先顺序不是“先加毛羽再看”。**先确保目标与内部repeat验收一致、明确8cm语义；再用真实直径和纹理前景契约隔离材质；最后判断剩余差距对物理层的要求。

## N. MINIMUM EXPERIMENT RESULTS

### N1. 方法与可重现性

`audit.mjs`用Vite SSR加载当前生产Domain、Adapter、Simulation、几何及绘制模块。观察器只改内存中的模块包装，磁盘src未动；绘图表面为测试替身。模型路径直接取真实调用参数；最终ribbon用生产`buildYarnUvStrip()`重建，使用生产0.03模型采样间距。它不是GPU捕获。

`browser-replay.html`另在真实浏览器调用同一生产链，记录四组solid及两组quality截图，以补足实际渲染观察。`deep-probes.mjs`独立积分内部完整循环，复核测量偏差、U和张力规范化。`image_metrics.py`只读源图统计alpha，并栅格化诊断三角形。所有fixture变化仅在内存，不改原SOP项目。

### N2. 用户指定TEST1–6

|实验|结果|
|---|---|
|TEST1：23 only|8/8 CONVERGED并应用，preview=`VALIDATED`；但Feed8的内部repeat并非报告平均值，见E3|
|TEST2：8 only|8/8 UNREACHABLE，preview=`INVALID`；模型路径与未设置目标的base完全相同|
|TEST3：23+8|8个主纱成功、8个第二纱失败，preview=`PARTIAL`；主纱模型及显示路径哈希与TEST1相同|
|TEST4：23+23|16/16成功；两纱中心线形状相同，再并排偏移。主纱绘制顶点与TEST3完全相同|
|TEST5：diameter 0.24→0.36|保持Cam/Gauge/目标/其他SOP不变；中心线改变，h下降，ribbon变宽；不是只有外观变粗|
|TEST6：固定view/preview/repeat|四组真实浏览器同画布/scale/层序/DPR对照已执行；额外模型simScale1→1.5不改模型路径。没有拿不同zoom截图算物理密度|

补充实验：第二纱Asset直径0.14仍8/8失败；tension null→5/4不改几何；32×40与28×40对应h一致，30×40有截断窗影响；32×48暴露纵向边界平均偏差；quality与solid路径哈希相同但可见宽度不同。全部结果见 `results.json`。

### N3. 坐标比较

|比较|数量|变化|
|---|---:|---|
|主纱：23 only→23+8，模型采样|112,906点|**0点改变**，maxΔ=0|
|主纱：23 only→23+8，重建ribbon顶点|259,140点|全部改变；最大约3.03758px，来自−0.12模型单位的parallel offset（本900×900/DPR1诊断下）|
|主纱：第二纱8→23，ribbon顶点|259,140点|**0点改变**，maxΔ=0|
|张力：null/null→5/4，主纱ribbon|259,140点|**0点改变**|
|张力：null/null→5/4，第二纱ribbon|286,510点|**0点改变**|
|直径0.24→0.36，主纱模型采样|112,906点|全部改变；maxΔX约0.06889模型单位；maxΔY含模板锚点变化，不能当作物理应变|

**FACT：没有第二纱长度/张力到主纱模型的耦合。**反过来，“最终顶点改变”也不充分证明物理耦合，必须扣除已明确存在的并排位置规则。

### N4. 定量几何范围

以下来自900×900、DPR1、scale1的受控SSR数据。包围盒为实际显示中心线采样，单位px；包括有限窗口/padding，不等于裁掉边界的成品尺寸。

|case/strand|X范围|Y范围|宽×高|
|---|---|---|---|
|23 only 主纱|47.623–851.681|195.605–696.107|804.058×500.501|
|8 only 默认路径|47.623–851.863|150.413–767.306|804.240×616.893|
|23+8 主纱|同23 only|同23 only|804.058×500.501|
|23+8 第二纱|同8 only|同8 only|804.240×616.893|
|23+23 两纱（偏移前）|同23 only|同23 only|均804.058×500.501|

加入8后整体中心线包围盒由第二纱决定：高度616.893/500.501≈**1.23255倍**，主纱自身scale并未变化。X宽变化约0.023%，不是组织横向收紧；Z不存在。加入并排偏移后，23 only ribbon bbox约810.128×506.562px；23+8两纱的合并ribbon bbox约816.199×629.028px。

整幅中心线近似长度：主纱3690.74097模型单位；默认第二纱4100.61548；23+8分别保持这两个值。**包含padding/转行和有限边界，且为采样折线和，不是每100针验收量，也不是实机完整纱长。**精确内部repeat积分见E3。

基准wale/needle网格为1模型单位=0.79375mm；主纱h平均0.483235，名义course网格平均0.383568mm；默认第二纱0.6→0.47625mm。真实成品wale/course距、真实loop宽高均UNKNOWN；不能把模板参数当作这些测量值。

另直接量化一个针编弧的**模型轮廓**：32×40完整循环fixture，第16行/第12针（零基）、Feed1/Type1，取该针内部的FLFH、FHLH、LHLL三段，不含outgoing sinker连接；每cubic采样24点，中心线XY包围盒宽约**0.759287**、高约**0.807692**模型单位，名义等效**0.602684×0.641106mm**。这只是指定位置的生成几何量，不是真实线圈尺寸，也不能用h=0.534525替代该轮廓高度。见 `deep-probes.json → exampleNeedleLoop`。

### N5. 投影开口率：仅作为同条件几何指标

用生产ribbon的三角形索引，在同一DPR1的XY视图内栅格化其不透明并集，固定ROI=(120,300)–(780,480)，位于所有case主纱内部。结果：

|case|投影几何开口率|
|---|---:|
|23 only|12.08%|
|8 only（实际base）|17.85%|
|23+8|2.40%|
|23+23|1.97%|
|23 only、d=0.36|2.96%|

**这不是实物孔隙率，也不是PBR截图的背景比例。**计算排除了纹理alpha、滤波、阴影和光学纤维；PIL为像素并集，存在栅格分辨率误差。两组双纱都显著填充投影空隙，而主纱未变形，直接说明“看起来更密”不需要物理耦合。

### N6. 回归与保护

- `npm run validate`：**37/37 validators passed，exit 0**；日志 `validate.log`。
- `npm run build`：**PASS，exit 0**；日志 `build.log`。
- 新诊断脚本 `audit.mjs`、`deep-probes.mjs` 和图像指标脚本均成功执行。
- 新发现的边界用例在现有37项回归之外，说明“全绿”不覆盖物理重复组织的全部验收条件。
- 源码/配置保护：检查tracked与已有未tracked的src、scripts、package、约束文档等149个文件SHA-256；最终核验见 `final-preservation.json`。只新增本报告目录的诊断文件；build输出在原有忽略的dist下。

## O. ARCHITECTURE VERDICT

### Q1. 能否继续演进到明显接近真实布？

**INFERENCE：可以保留Machine Domain、Adapter、项目资产/Feed数据和拓扑图作为基础；有可用的边界，不需要因照片差距就全盘重写。**本轮确认了这些层的内部通路和独立性，但没有证明它们已完全满足实机拓扑验证。

对于单一样本的观感，直径与前景覆盖标定可显著改变结果；目前不能保证只靠它们达到目标相似度。对于跨工况的真实布面预测，当前模型的自由度与约束不足。

### Q2. 需要新Simulation/Relaxation层，还是校准？

**当前顺序：先修正确性/验收口径，再校准并隔离输入；尚不能直接批准Relaxation开发。**8cm参考状态未明确，真实直径/密度未测，不能跳过这些因素。

数学限制很具体：当前对每个Feed×Yarn仅解一个标量h，固定基准X针距，Z=0；没有rest length、材料能量、接触距离、不穿透、张力平衡或纱线间变量共享约束。第二根的目标与张力改变，主纱解保持不变。因此：

- 单靠现有参数校准，**不能产生因第二纱张力/伸长变化而发生的主纱接触变形**。
- 不能产生独立的wale/course收缩、Z方向起伏、受接触压扁的截面或真实蓬松体积。
- 如果经校准后的验收目标确实要求这些物理响应，就需要新的耦合几何形成/力学计算能力及相应渲染表示。它应消费现有机器拓扑和明确材料数据，不能在UI或Renderer复制Cam规则。

这是能力边界推论，不是已证明某个特定“Fabric Relaxation Layer”方案足够，也不是证明照片的全部差异来自松弛。

### Q3. 是否必须推倒重做？

**FACT：未发现要求废弃整个项目或Machine Domain的证据。**已定位的Feed8问题属于测量/边界契约；8cm失败体现当前几何模型及纱长语义的适用边界；真实3D形成需要超出现有二维模板的表示。后者可能要求几何/渲染模块较大扩展，但不等价于整个系统重写。

**最终选择C，而不是A/B/D：**已有可重复的现有Simulation验收正确性问题，故不能选A；尚未完成实机拓扑及输入校准，不能直接选B宣称“拓扑已可靠、只缺松弛”；证据足以定位具体问题，故不以D回避。C不意味着所有模块或所有纱长结果均错误。

## P. RECOMMENDED NEXT STEP

1. 先审核本报告和Feed8证据，明确“每Feed每100针”的验收应针对内部完整生产repeat，而不是含截断顶边的预览平均。下一轮若授权修复，应先建立该反例及窗口高度不变性验收；本轮没有修改实现。
2. 确认20D LOW的原料身份、8cm测量负荷/伸长参考状态、两纱喂入位置、实机A-D/Feed起点。禁止为获得收敛把8擅自改成更大值。
3. 收集两纱真实直径/截面、带已确认物理比例尺的布面与单纱图、成品或指定阶段的wale/course密度、后整理状态；核实图4的4800DPI是否代表原始采集。
4. 在固定Cam、完整repeat、相同view下分别检查：默认/真实直径，纯色/真实PBR前景宽度，23-only/8-only/23+8/23+23。不要同时调多个外观参数来掩盖结构问题。
5. 以上因素隔离后，以“第二纱变化是否应引起主纱坐标与密度变化”为明确验收，再决定耦合几何/物理形成层的最小范围。需要时也要评估现有二维ribbon是否满足展示目标，不能只添加一个层名就称为3D。

审计到此停止。未修复业务代码，未开始Fabric Relaxation或P1开发，未创建commit或tag。

证据目录：[全部诊断结果](C:/Users/liuchen/Desktop/knitscape/reports/real-sop-geometry-gap-audit-2026-10-16/results.json)、[内部repeat独立复算](C:/Users/liuchen/Desktop/knitscape/reports/real-sop-geometry-gap-audit-2026-10-16/deep-probes.json)、[原图与alpha指标](C:/Users/liuchen/Desktop/knitscape/reports/real-sop-geometry-gap-audit-2026-10-16/image-metrics.json)、[初始状态](C:/Users/liuchen/Desktop/knitscape/reports/real-sop-geometry-gap-audit-2026-10-16/initial-state.json)、[最终保护核验](C:/Users/liuchen/Desktop/knitscape/reports/real-sop-geometry-gap-audit-2026-10-16/final-preservation.json)。
