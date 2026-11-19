# Yarn Length Measurement Semantics Audit

日期：2026-10-16（Asia/Shanghai）。范围：Measurement Semantics / Solver Correctness；仅诊断，未修改正式业务行为、Solver、Cam、diameter、PBR或UI，未增加物理层，未commit/tag/reset/checkout/stash/clean。

证据标签：**FACT**＝源码、文件或实验直接证明；**INFERENCE**＝基于事实的推导；**HYPOTHESIS**＝待验证解释；**UNKNOWN**＝信息不足。本报告中的“完整repeat复算”均指明确指定的**生成几何**，不把它冒称为实物测量。

## 1. EXECUTIVE CONCLUSION

1. **最终等级：E — MULTIPLE ISSUES。** 软件的周期平均与内部完整4针循环并非同一测量定义；当前固定路径/范围不能表达8cm；SOP的100针基准明确，但实际取样路径及测量参考状态未完整确认。
2. **FACT：23.7016已由独立积分器复现。** 32×40完整横向循环对照，Feed8内部100连续针生成路径为 **23.701615589cm**，Solver报告 **22.999580039cm/100针**。Solver平均包含顶边短路径，没有只看顶边。
3. **FACT：原始项目是30×40，存在第二项测量窗口差异。** 该项目Feed8内部完整4针循环复算约 **24.077278cm/100针**，不是上一轮引用的23.675983；后者仍是软件将30针截断窗周期化后的内部值。本报告明确纠正这一外推。
4. **FACT：Solver确实优化它自己报告的测量函数。** 对三份30针截断窗生成几何的中间30针，使用独立Bezier积分，复现了原始项目Feed8的 **22.999733873**。问题进入了目标函数的样本选择，不只是UI或求解后的验收显示错误。
5. **FACT：第二纱23/15均8路数值收敛；10/8均8路不可达。** 10与8的实际生成路径相同，均fallback至h=0.6；报告的约12.84–13.56是h=0.05最近候选，不是实际显示纱长。
6. **FACT：当前同Feed各纱共享拓扑生成器与测量函数，只独立求h。** 没有证据证明这个假设适用于真实20D LOW，也没有证据能仅凭8cm失败就判定20D必须使用不同拓扑。
7. **FACT：指定的保存项目只有主纱。** N6/W(6040)分配到软件Feed1–8；20D LOW资产及分配均未保存在该项目中。双纱A–G是明确标识的诊断fixture，不是已验证的实机assignment。
8. **INFERENCE：最有依据的工艺验收候选是“明确喂纱通道/纱线在连续100机针区间的全部对应耗纱，并明示测量参考状态”。** A“连续100针”和D“某Feed的耗纱”可同时成立，不能从SOP直接硬定为100个needle loops或软件当前的有限course平均。
9. **结论边界：不能把8cm失败归因于5/4cN。** 张力不参与当前计算；真实预牵伸或卸载测量仅为HYPOTHESIS / MISSING PHYSICS。
10. **下一步依赖：先D工艺确认，再A统一测量契约，再据证据选择模型表达或数值范围工作。** 不支持现在直接扩大范围或更换分母让8“收敛”。本轮四项针对性验证均exit0；业务文件保护核验见 `final-preservation.json`。

## 2. FACTS

### 2.1 当前真实代码

分支`main`，HEAD=`7ababf264d495f6b96d4d66652c529424938ac4d`；可信标签剥离后同commit。工作区保留既有13个tracked修改及未tracked材料解析模块等，本轮以工作区为准，没有回到baseline。记录：`initial-state.json`、`baseline-working-tree.diff`。

已核对AGENTS、当前功能算法说明、NEXT_TASK、上一轮完整报告、当前源码和指定项目。两份旧开发说明的持久化描述已过时，不能代替当前项目包事实。

### 2.2 来源与固定条件

|数据|来源|本轮单位/含义及使用|
|---|---|---|
|32G|SOP/项目|25.4/32=0.79375mm/模型针距，进入目标与测量换算|
|1234、真实4×8 K/T Cam|SOP/项目|调用现有Machine Domain，不重解释成全K|
|23、8|SOP实际纱长栏/用户|cm/织机100针；实际负载、卸载和取样程序未明确|
|5、4cN|SOP张力记录栏|本轮不用于解释数值失败；源码不消费为几何输入|
|3216针、32英寸|SOP|机器规模参照；不作为30针预览的归一化分母|
|30针×40行|指定保存项目|A–G全部保持这一尺寸；32×40和32×48只作测量边界对照|
|0.24模型单位|保存项目Legacy primary|固定不变；两资产无独立直径，解析后均此值；未改diameter|
|h默认0.6，求解区间[0.05,2]|源码|默认几何与有界参数搜索；不是织机/材料物理极限|

源项目：[SOP-001-N6W6040-main-yarn-with-cam.knitscape](C:/Users/liuchen/Desktop/knitscape/reports/sop-001/SOP-001-N6W6040-main-yarn-with-cam.knitscape)。SHA-256：`0d84dd7a3b7d408345015963279e5ea6548d501cbf84887d019a5f538b99eed8`。

工艺图：[工艺.jpg](C:/Users/liuchen/Desktop/工艺.jpg)。人工重新查看图中备注，可可靠读到：“**纱长测试标准为织机100针的长度**”。两纱行组织编号均为1.2.3.4.5.6.7.8，口数均96。这些文字未定义两根纱的空间路径、同口/分口关系或测量时伸长状态。

## 3. PREVIOUS WRONG ASSUMPTIONS

|前提/表述|本轮更正|
|---|---|
|“top-edge average就是只测top edge”|错误。`measuredLengthForFeed()`平均同Feed的所有被保留course；顶边是其中一个样本|
|“23.7016是原30×40项目的内部值”|不准确。23.7016属于32×40完整横向repeat对照；原30×40的实际内部4针循环为约24.0773|
|上一轮原30×40“内部23.675983”可代表真实4针周期|该值仍来自软件的30针周期化上下文；本轮独立最终路径积分得到24.077278，需要纠正外推|
|“Solver报告函数和优化函数不同”|本轮未发现。独立积分可复现其窗口平均；主要差异在测量区间与边界，不是报告替换了优化函数|
|“输入字段就叫targetLengthCmPer100Needles”|项目输入字段是`yarnLengthCmPer100Needles`；前者是SolverResult中复制的目标值|
|“两纱分配到全部Feed已由保存项目证明”|指定包没有20D。全部Feed双纱只是受控fixture，工艺等价性未确认|
|“8失败就是数值算法不够强/下界设高了”|8小于当前全部可解下限，代码在二分前直接拒绝；更低h的诊断探针也未出现8，不能以增加迭代修复|
|“8失败证明SOP错，或证明第二纱必须不同拓扑”|两者都超出证据；只能确定当前模型/测量假设下不能表达该目标|
|“VALIDATED等于工艺语义已确认”|它只检查当前SolverResult状态、应用标记和同一窗口平均的数值容差|

上一轮32×40的顶边诊断保持成立；本轮补上了原始30针截断窗与完整4针repeat之间的差异，不将两个窗口混用。

## 4. SOFTWARE DEFINITION OF CM/100 NEEDLES

### 4.1 输入、单位与结果字段

**FACT：**UI以cm/100针输入，`commitYarnLength()`调用`setSingleJerseyFeedYarnLength()`，后者经`commitFeedYarnLength()`写入：

```text
GLOBAL_STATE.singleJerseyCamProgram.feeds[f].yarns[y].yarnLengthCmPer100Needles
```

保存通过`getProjectData()`→`createProjectPackage()`；导入通过`readProjectPackage()`→`yarnProjectFields()`→Cam normalizer。`targetLengthCmPer100Needles`只出现在派生结果/必需目标列表中，不能与项目权威输入混为一谈。

### 4.2 精确换算

源码：`src/simulation/yarnLengthMetrics.js`。

```text
p = gaugeToNeedlePitchMm(G) = 25.4 / normalizeMachineGauge(G)
L_mm = modelLengthToMm(L_model,G) = L_model × p
L_cm = L_mm / 10
L100_model = normalizeModelLengthPer100Needles(L_model,N) = 100 × L_model / N
L100_cm = 100 × L_model × p / (10 × N)
target100_model = target_cm100 × 10 / p
```

32G：p=0.79375mm。23目标=289.763779527559模型单位/100针；8目标=100.787401574803模型单位/100针。100只是按输入单位进行归一化，并不意味着每次真正创建100针几何。

### 4.3 被测路径与分母

**FACT：**`buildYarnPathGeometry()`→`periodicMeasurementPattern()`查找**必须整除bitmap宽度**的横向精确周期P，将该bitmap周期复制3份；测量中间P针。32针输入的P=4；原30针输入的P=30。

`createModelLengthEvaluator().measureRow()`用路径点的`floor(i/2)`识别源针位，属于窗口的源点拥有**整条outgoing link**，包括跨repeat/跨窗口的连接，不因终点在窗外而丢弃。每course的分母是P个机针位置，**不是K针数、needle loop数、link数或Feed数**。

```text
对每course r：
  L_r(h) = 中间P针拥有的所有M/L/C link弧长之和
  M_r(h) = 100 × L_r(h) / P

对Feed f：
  R_f = {r | r % feedCount == f}
  F_f(h) = sum(M_r(h), r∈R_f) / |R_f|
```

`measuredLengthForFeed()`在`src/simulation/yarnLengthSolver.js:14`计算F。`simulate()`先按8路筛选course，再以一项Feed视图调用Solver；内部feedCount=1只用于该视图，不是把全8路加总或错误地除以8。

每course路径包含针编弧、沉降/连接段及T/M引起的相关路径；不是只测needle loop或只测sinker loop。一个Feed的多个course取平均，**不将8个Feed耗纱累加成一个目标值**。

对外`measuredNeedleCountByCourse`在外层记为原pattern.width（如30或32），用于表述等效窗口；内部归一化的实际P可能为4。两者是代理/内部窗口关系，不代表发生两次不同的100归一化。

### 4.4 边界、repeat与其他读数

- 横向：有三份周期上下文及outgoing连接计量；没有再人为加一条“首尾直线”。但P=30会周期化一个并非完整1234倍数的截断窗。
- 纵向：`Y_PADDING=0`；保留有限高度的初始/末端接点状态，不做垂直循环。所有同Feed的course仍进入平均，因此顶边可能污染目标。
- 几何弧长：Solver使用生成的二维Bezier路径长度，不是三维弧长、受力伸长或实物纤维长度。
- 侧栏`cmPer100Loops`是另一个口径：设计预览的基础有限路径、两端都在有效针范围内的link、分母width×height、采样折线长度。`runSimulation()`发布的是排针前base结果，**不是Feed目标验收值**。它与右侧SolverResult不能替代使用。

## 5. 23CM CODE PATH

|阶段|真实函数/文件|
|---|---|
|输入|`commitYarnLength()`，`src/views/singleJerseyCamProgramEditor.js:61`|
|状态|`setSingleJerseyFeedYarnLength()`→`commitFeedYarnLength()`，`src/actions/singleJerseyCamProgram.js:207`/`:226`|
|Machine/Adapter|`resolveSingleJerseyOperations()`→`createSingleJerseySimulationInput()`→`createSingleJerseyExecutionInput()`，domain/adapters/components同名文件|
|求解调度|`simulate()`，`src/simulation/yarnSimulation.js:102`，逐Feed/slot建立geometry视图|
|几何模板|`buildYarnPathGeometry()`与`createModelLengthEvaluator()`，`src/simulation/yarnPathGeometry.js:61`/`:372`|
|目标函数|`measuredLengthForFeed()`，`src/simulation/yarnLengthSolver.js:14`|
|数值搜索|`solveFeedYarnLengths()`，同文件`:107`；h∈[0.05,2]，9点单调性检查，最多48轮二分|
|派生结果|`resultFromCandidate()`，同文件`:71`；填solved/error/status/pathMap|
|最终应用|`yarnSimulation.js:310`起，仅收敛的pathMap替换对应slot；`resolveModelPathsForDisplay()`逐course平移接续|
|结果UI|`getYarnLengthFeedbackRows()`/`yarnLengthSolverFeedback()`，`src/views/yarnLengthSolverFeedback.js`；格式化结果到4位小数|

**FACT：23数值收敛，是因为它落在当前模板F_f(h)的区间内。**所有Feed用同一种测量算法，但K/T位置、course奇偶、横向截断及纵向顶边使各自F不同。这不证明真实取样过程与F相同。

**INFERENCE：**SOP更有依据的解释是指定纱在织机100针区间的耗纱；然而是否为同一Feed一次经过、从布中抽纱、喂入计量、带负荷/卸载后的长度仍UNKNOWN。当前23被解释为二维模板中心线的有限course平均，二者尚未确认等价。

源码导航：[Solver](C:/Users/liuchen/Desktop/knitscape/src/simulation/yarnLengthSolver.js:14)、[路径测量](C:/Users/liuchen/Desktop/knitscape/src/simulation/yarnPathGeometry.js:396)、[Simulation](C:/Users/liuchen/Desktop/knitscape/src/simulation/yarnSimulation.js:102)、[结果UI](C:/Users/liuchen/Desktop/knitscape/src/views/yarnLengthSolverFeedback.js:43)。

## 6. 23.7016 ROOT CAUSE

### 6.1 在完整横向repeat窗口中隔离顶边

条件：原SOP Cam/1234/G32/0.24不变；32×40诊断窗口；Feed8目标23，h=0.454425048828125。对最终生成中心线直接积分，按source needle拥有outgoing link。

|course（零基）|内部完整16针路径归一化cm/100针|
|---|---:|
|7|23.701611|
|15|23.701616|
|23|23.701616|
|31|23.701616|
|39，顶边|20.191442|
|五行均值（Solver/UI来源）|22.999580|

**FACT：**`YarnModel.finalLocation()`及`finalLocationRecursive()`遇顶部接触行直接返回；`ProcessModel`只有有限的N+1接触行，缺少该Tuck组之后的完整周期上下文。随后`measuredLengthForFeed()`没有排除末行，而是将它与4个内部样本等权平均。

```text
近似用六位小数表达：
(4 × 23.701616 + 20.191442) / 5 ≈ 22.999581
内部值 − 平均值 ≈ (23.701616 − 20.191442) / 5 ≈ 0.702035
```

直接生成108针同h几何，取物理针位4..103（零基），第23行连续100针全部对应路径，不含全局左右/上下边界，得到：raw=298.603031037模型单位，237.016155886mm=**23.701615589cm**，350个路径段。其中跨4针repeat边界的whole links为21.747399816模型单位，**已经包含在raw中**。

32×48对照仍报告22.999636，但内部变为约23.578556；改变高度改变顶边样本权重及最优h。不是单位或积分舍入造成。

### 6.2 原30×40项目还有横向定义差异

原项目Feed8 h=0.470611572265625：

|测量定义|cm/100针|
|---|---:|
|软件P=30三份截断窗的五course平均|22.999733873|
|同一个P=30上下文，内部course均值|约23.675983|
|最终生成几何内部16针×3course，完整4针周期|24.077277996|
|108针同h几何，中部连续100针、第23行|24.077280685|

分解（cm/100针）：约 **0.676249** 来自P=30上下文的纵向边界平均差异；约 **0.401295** 来自P=30上下文与实际内部完整4针周期之间的差异；合计约 **1.077544**。前者可独立用32×40控制；后者包含30针周期化造成的针型占比/拼接上下文改变，不全是“漏了一段连接”。

**FACT：**30%4≠0，周期检测器只允许整除width的候选，故P=30。将其重复相当于在30针处重启截断图，而不是继续1234的真实4针重复。source/needle分母在各自窗口里可自洽，却不代表相同工艺周期。

### 6.3 对A–I排查项的结论

|排查|结果|
|---|---|
|A 优化/独立函数一致吗|同窗口、同路径定义时独立积分复现Solver；换成内部完整4针周期后不同|
|B 只取top/edge/interior/部分link吗|每course测中间横向P针完整outgoing links；再平均该Feed全部course，含顶边|
|C 边界段被忽略吗|横向已用periodic上下文；有限预览边缘与周期上下文不同。直接原因不是把顶边丢弃，而是把其异常短路径纳入平均|
|D repeat连接没进Solver吗|源码和独立积分均计入跨周期outgoing links，没有证据支持“统一漏算首尾连接”|
|E count与路径针数一致吗|软件P针/独立16针、100针分别对应自身选区；不能把外层width标签误当内部P，更不能用link数量替代针数|
|F 不同分母吗|Solver每course用P，独立审计每course用明确选区N，再按针位经过次数合并；差异在窗口含义，不是发现一个隐藏的×8单位错误|
|G 针/loop/link/Feed混用吗|目标Solver未按link或K数作分母；Legacy侧栏的effectiveLoopCount命名与目标口径不同，不能替代|
|H 单位不同吗|两者均使用同一G32标尺；独立公式复现换算。最大model/display舍入差约8.41×10⁻⁶cm，解释不了0.7或1.08cm|
|I Solver interior、审计full-visible吗|不是本轮主对照。两者都测指定横向窗口；主对照差在纵向平均/顶边及30针周期化。全可见几何另列，不冒充目标分母|

## 7. 8CM CODE PATH

**FACT：**8和23进入同一个字段、单位换算、路径生成器、F_f(h)、范围检查与结果UI。8目标的模型值100.787401575小于每路h=0.05候选的模型长度，进入`target < lower.measured`分支，尚未开始二分就返回`UNREACHABLE_TARGET`。

`simulate()`仅应用`result.converged`的路径；失败slot保留base h=0.6。这解释为什么8-only、第二纱10和第二纱8的最终几何相同，尽管目标与error字段不同。

**FACT：`CURRENT MODEL CANNOT EXPRESS TARGET`**，限于本报告的同拓扑、G32、0.24、[0.05,2]及软件测量定义。不是“SOP错误”的证据，也不是张力导致当前算法失败。

|假设|审查结果|
|---|---|
|H1 超出当前几何可达范围|**FACT/CONFIRMED**：8低于8路全部下限，独立积分复现端点|
|H2 第二纱拓扑不同|**UNKNOWN/HYPOTHESIS**：代码复制同拓扑；未取得真实20D路径证据|
|H3 第二纱不是完整needle-loop路径|**UNKNOWN/HYPOTHESIS**：不可由名称或短长度自行判定|
|H4 只经过部分Feed/针|**UNKNOWN/HYPOTHESIS（工艺）**；本fixture两纱都走相同8路/针位|
|H5 Assignment错误复制到全部Feed|**UNKNOWN（真实工艺）**；指定包无20D，不能认定一个未保存的分配错误；诊断fixture明确人为设为全部8路|
|H6 8与23测量语义不同|**UNKNOWN/HYPOTHESIS**：同100针标题不证明同路径、同伸长参考状态|
|H7 placement语义错误|当前固定parallel是**FACT**；是否违反真实喂纱方式为**UNKNOWN**|
|H8 人为h范围限制|范围是人为参数为**FACT**；但不能据此认定扩大范围就能解8，见下一节的更低h探针|
|H9 模板不支持短纱路径|在当前设定内不能表达8为**FACT**；是否应改模板、路径或参考状态要由工艺确认|
|H10 单位/归一化理解错误|软件8的cm→model换算与23一致，未发现额外比例bug；工艺对应关系仍UNKNOWN|

## 8. 8CM REACHABILITY RANGE

固定：真实4×8 K/T Cam、1234、G32、d=0.24、30×40，Yarn B诊断slot。配置h∈[0.05,2]。下表单位均cm/100针。

“软件窗口”测三份30针截断图中间30针，平均该Feed五次course，**含顶边**；“内部4针周期”直接积分16针×3内部course，**不含全局边界，但包括outgoing repeat连接**。

|Feed|软件窗口[min,max]|内部完整4针周期端点[min,max]|
|---|---|---|
|1|[12.988409,50.963459]|[12.913750,51.262837]|
|2|[13.479989,58.880432]|[13.440442,59.745308]|
|3|[12.988409,50.963459]|[12.913750,51.262837]|
|4|[13.561702,60.995279]|[13.440442,59.745308]|
|5|[12.839089,51.562202]|[12.913750,51.262837]|
|6|[13.399321,60.558578]|[13.440442,59.745308]|
|7|[12.839089,51.562202]|[12.913750,51.262837]|
|8|[13.208565,55.658398]|[13.440442,59.745308]|

软件窗口端点已使用**独立积分器**对显式三份30针几何复算，和生产reachableRange在1×10⁻⁷cm以内一致。内部列为同h端点的独立生成路径数值，不能将它改名为材料极限；未给出h任意正数范围的解析全局最小值证明。

**FACT：**对只读生成器额外探测h=0.025、0.01、0.001、0.000001，未改Solver范围。到h=10⁻⁶，软件窗口读数仍约11.7628–11.8855，内部完整周期约11.8242cm/100针，均大于8。原始探针见`results.json → ranges`。

**INFERENCE：**单纯把0.05下界略微降低，不足以支持“8会收敛”；增加上界对低于下限的目标无帮助，增加二分迭代也不触及直接拒绝分支。上述有限探针不构成对所有h>0的全局不可达定理，更不能替代真实工艺语义。

## 9. YARN A VS YARN B TOPOLOGY

### CURRENT MODEL ASSUMPTION

**“所有同Feed yarn消费相同的机器K/T/M拓扑；各slot通过同一几何模板、独立loopHeight来表达不同目标长度。”**

依据：`yarnSimulation.js`的`strandGeometries`均使用同一`stitchPattern`，调用`new YarnModel(new ProcessModel(stitchPattern).cn)`；profile主要由解析后的diameter区分。`solveFeedYarnLengths()`和测量回调相同。没有第二纱专用的针位参与mask、组织操作、参考长度或路径规则。

**FACT：**本轮两纱diameter保持相同，几何模板可共享；每纱有独立最终路径Map。内部每Feed每slot都覆盖相同的16针×3course，48次针位经过、168个M/L/C路径段。不同目标改变坐标及弧长，不改变这些拓扑计数。

在本fixture中，不存在“第二纱仅走部分link/针，仍错误强制用主纱分母”的已观察事实；两纱计数实际相同。**真实工艺是否同样参与这些路径，UNKNOWN。**若未来证明确实走不同针位/通道，分母应来自明确的工艺取样区间，不能自动等于其link数或简单复制主纱统计。

## 10. FEED ASSIGNMENT SEMANTICS

|对象|实际证据|
|---|---|
|指定SOP保存包|库中默认Yarn1与N6/W(6040)；Feed1–8各只有一项主纱，目标23，tension=null，placement=parallel|
|另核对`reports/p1-1/SOP-001-P1-1.knitscape`|同样各Feed仅一项主纱；不作为未保存双纱状态的证据|
|真实20D assignment|指定包中没有20D资产/槽位；当前未保存交互状态UNKNOWN|
|A–G双纱fixture|B/D/E/F/G中的第二资产由诊断脚本创建，明确逐Feed放入相应槽位；仅内存使用，不改原项目|
|SOP文字|两纱均列组织编号1–8、96口；它证明表格关联，不完整证明两纱与软件8个Feed角色等价|

软件Feed是Cam列与`row%8`的循环角色，不是已建模的96个实体喂纱站。SOP“组织编号1..8”与“口数96”的工艺解释、两纱是否同口同时喂入、plating/垫纱/部分针路径，均需确认。

`placement`目前保存为字符串；活动绘制路径按直径固定parallel排布，没有根据该字符串选择不同Loop topology。**不能凭保存了parallel就称真实喂纱位置已经建模。**

## 11. SOLVER MEASUREMENT VS FULL-REPEAT MEASUREMENT

|测量|路径/区间|分母|边界/repeat|
|---|---|---|---|
|Solver F_f|每course中间P针的周期化模型，再平均同Feed全部course|每course P针；course平均|横向包括跨wrap；纵向有限顶边在内|
|独立内部完整repeat|最终生成display中心线，物理针4..19，row∈[8,H−8)且row%8=f|每course16针；合并是16×course数次针位经过|无全局边界；包含每个源针拥有的完整outgoing连接|
|独立连续100针控制|同h生成108针，物理针4..103、第23行|恰好100针|不含全局边界；包含25个4针repeat对应全部路径|
|有效有限窗口|最终几何物理针0..W−1，同Feed所有course|W×course数次针位经过|含上下边界和来自源针的出界连接；与周期上下文仍不同|
|全可见路径总长|同Feed全部生成link，包括padding/转行|**不给一个伪造的100针分母**|边界/padding均在内；normalized字段=null|
|Legacy侧栏|基础设计预览路径；两端均在有效针范围内|width×height名义格数|不是目标Solver的测量函数|

**FACT：**在同窗口定义下，独立数值积分支持当前积分器/单位实现；当选择内部完整repeat时，差异真实存在。当前的生产物理验收目标若应代表稳定重复耗纱，就不能只验含边界的平均值。工艺是否确实要求该稳定重复口径，需要下一节工艺确认，而非本轮私自定规范。

## 12. INDEPENDENT AUDITOR RESULTS

### 12.1 独立性与接口

脚本：[independent-auditor.mjs](C:/Users/liuchen/Desktop/knitscape/reports/yarn-length-semantics-audit-2026-10-16/independent-auditor.mjs)。

- 输入：geometry、Feed、Yarn、Gauge、明确针/行区间；不接收SolverResult，也不读取`solvedLength`。
- 直接解析最终生成的M/L/C坐标，用**独立自适应Simpson积分**计算Bezier速度，不调用生产Gauss弧长、`modelLengthToMm()`或生产归一化函数。
- geometry取自最终传给draw模块的`resolvedPathByLink`，扣除stitchWidth回到模型单位；这是**并排placement之前的纱线中心线**，不是ribbon边缘或纹理长度。
- 用另一套modelPath直接复算交叉检查；最大display/model归一化差约8.41×10⁻⁶cm，主要来自默认display与model坐标的不同六位舍入尺度。
- 输出raw model、mm、cm、测量针位经过次数、归一化值、link/segment计数、boundary/repeat贡献及逐course值。
- 自校验覆盖直线、解析可算的抛物线Bezier、平移、多个M子路径不误加间隙。

重放脚本只在Vite内存中观察/截取生成路径，并以空绘制接收器采集参数，不改磁盘src或生产目标函数。SSR不用于宣称浏览器GPU行为；本轮不研究PBR。

### 12.2 raw数据例

所有下表量均来自最终geometry；主表统一内部16针×3course，N=48次针位经过，无全局边界，计入repeat outgoing连接。cm/100针=raw×0.79375/10×100/48。

|案例/纱/Feed|raw模型长度|mm|cm|N|归一化cm/100针|段数|boundary模型量|repeat模型量|
|---|---:|---:|---:|---:|---:|---:|---:|---:|
|A/Y1/F8|145.601177173|115.570934381|11.557093438|48|24.077277996|168|0.000000000|10.559276069|
|B/Y1/F8|163.672965043|129.915416003|12.991541600|48|27.065711667|168|0.000000000|11.576199775|
|C/Y2/F8|163.672965043|129.915416003|12.991541600|48|27.065711667|168|0.000000000|11.576199775|
|D/Y2/F8|145.601177173|115.570934381|11.557093438|48|24.077277996|168|0.000000000|10.559276069|
|E/Y2/F8|93.222250988|73.995161722|7.399516172|48|15.415658692|168|0.000000000|8.037749468|
|F/Y2/F8|163.672965043|129.915416003|12.991541600|48|27.065711667|168|0.000000000|11.576199775|

“boundary contribution”字段采用明确的**首/末8行guard band或针范围外link**分类，并非声称其中每段都是额外边界耗纱。“repeat contribution”是跨period边界的整条link长度，不是额外新增闭合线；两分类可以交叠，均已包含在raw，不再相加到总长。

对于32×40连续100针控制，N=100、350段、boundary=0，详见`results.json → hundredNeedles`。对于原始30针参数的同h连续100针复算，见`hundredNeedlesSource30`。

## 13. TEST A-G RESULTS

条件全部固定原项目30×40、真实Cam/1234、G32、直径与lengthScale不变。双纱使用诊断资产并按软件Feed1–8全部分配，这是模型假设检验，不是工艺确认。实验E/F只改变第二纱目标，不改第一纱23。

|Test|目标|整体PreviewValidity|实际结果|
|---|---|---|---|
|A|23 only|VALIDATED|8个目标均收敛；完整repeat仍有测量偏差|
|B|8 only|INVALID|8个目标均失败，显示默认几何|
|C|23+8|PARTIAL|主纱成功，第二纱失败|
|D|23+23|VALIDATED|16个目标数值成功；两纱同样存在测量定义差异|
|E|23+15|VALIDATED|16个目标数值成功；15的内部repeat亦非所有Feed准确15|
|F|23+10|PARTIAL|第二纱8路全失败，实际几何与C的第二纱相同|
|G|23+8|PARTIAL|重复C，几何哈希完全一致|

以下每个目标逐Feed输出第二纱结果。D=23、E=15、F=10、G=8；单位cm/100针。独立值来自最终生成中心线的内部完整repeat。`error`=独立值−target；“变化”相对8cm fallback。**失败行的Solver值是最近候选，不是当前几何值。**

|目标|Feed|状态|Solver值|独立最终repeat|error（独立−目标）|Applied|几何变化vs8|
|---|---|---|---:|---:|---:|---|---|
|23|1|CONVERGED|22.999921|22.937378|-0.062622|是|是|
|23|2|CONVERGED|22.999922|23.064754|+0.064754|是|是|
|23|3|CONVERGED|22.999921|22.937378|-0.062622|是|是|
|23|4|CONVERGED|23.000297|22.625946|-0.374054|是|是|
|23|5|CONVERGED|22.999809|23.061232|+0.061232|是|是|
|23|6|CONVERGED|22.999987|22.944063|-0.055937|是|是|
|23|7|CONVERGED|22.999809|23.061229|+0.061229|是|是|
|23|8|CONVERGED|22.999734|24.077278|+1.077278|是|是|
|15|1|CONVERGED|15.000679|14.911460|-0.088540|是|是|
|15|2|CONVERGED|15.000266|14.977377|-0.022623|是|是|
|15|3|CONVERGED|15.000678|14.911461|-0.088539|是|是|
|15|4|CONVERGED|15.000072|14.832214|-0.167786|是|是|
|15|5|CONVERGED|15.000301|15.090306|+0.090306|是|是|
|15|6|CONVERGED|15.000518|15.024918|+0.024918|是|是|
|15|7|CONVERGED|15.000302|15.090304|+0.090304|是|是|
|15|8|CONVERGED|15.000671|15.415659|+0.415659|是|是|
|10|1|UNREACHABLE_TARGET|12.988409|24.255731|+14.255731|否|否|
|10|2|UNREACHABLE_TARGET|13.479989|27.065712|+17.065712|否|否|
|10|3|UNREACHABLE_TARGET|12.988409|24.255731|+14.255731|否|否|
|10|4|UNREACHABLE_TARGET|13.561702|27.065712|+17.065712|否|否|
|10|5|UNREACHABLE_TARGET|12.839089|24.255731|+14.255731|否|否|
|10|6|UNREACHABLE_TARGET|13.399321|27.065712|+17.065712|否|否|
|10|7|UNREACHABLE_TARGET|12.839089|24.255731|+14.255731|否|否|
|10|8|UNREACHABLE_TARGET|13.208565|27.065712|+17.065712|否|否|
|8|1|UNREACHABLE_TARGET|12.988409|24.255731|+16.255731|否|否|
|8|2|UNREACHABLE_TARGET|13.479989|27.065712|+19.065712|否|否|
|8|3|UNREACHABLE_TARGET|12.988409|24.255731|+16.255731|否|否|
|8|4|UNREACHABLE_TARGET|13.561702|27.065712|+19.065712|否|否|
|8|5|UNREACHABLE_TARGET|12.839089|24.255731|+16.255731|否|否|
|8|6|UNREACHABLE_TARGET|13.399321|27.065712|+19.065712|否|否|
|8|7|UNREACHABLE_TARGET|12.839089|24.255731|+16.255731|否|否|
|8|8|UNREACHABLE_TARGET|13.208565|27.065712|+19.065712|否|否|

**FACT：**23/15相对默认第二纱路径均改变；10/8完全不变。所有第二纱目标变化均不改变主纱路径哈希。因而同时存在“配置下限附近的可达性分界”和“可达目标的测量窗口偏差”，不是二选一解释。

## 14. PREVIEWVALIDITY RISK

`derivePreviewValidity()`读取requiredTargets和SolverResults，只验证：Feed/slot/target匹配，status=CONVERGED，converged=true，appliedToSimulation=true，结果与error有限且在容差内。它不重新积分最终geometry，不排除顶边，不检查内部repeat，不验证SOP负载/喂纱语义。

**FACT：A、D、E均可VALIDATED，而内部完整repeat不满足同一target。**例如A的Feed8约24.077278、D第二纱同值，E第二纱Feed8约15.415659，而容差仅0.00079375。

因此存在明确correctness风险：如果VALIDATED被用于宣称目标repeat已满足，它会给出过大的保证。它目前严格只意味着“有界Solver的当前窗口平均数值目标已收敛并标记应用”。UI已有模型限定文案，不能据此扩张成工艺语义确认；也不能用文案消除上述内部repeat差异。

## 15. SOP MEASUREMENT UNKNOWNs

### 最有依据的验收口径候选

|候选|证据判断|
|---|---|
|A 连续100枚机针对应的全部实际纱线路径|**INFERENCE：强候选**，与明确100针备注最接近，但取样状态及通道仍未知|
|B 100个needle loops|**无证据支持作为替代分母**。本Cam每4针含3K/1T，100机针不等于100个成圈动作|
|C 100个needle pitch的周期长度|**歧义**。若指直线针床跨距，32G下仅79.375mm，显然不是同一个曲线路径量；若指100个针距区间对应的全部纱路，可与A/D兼容|
|D 某Feed下100针耗纱|**INFERENCE：强候选**，但SOP组织编号/96口与软件Feed角色的映射未确认；与A并不互斥|
|E 其他：喂纱器计量或抽纱后规定负载长度|**HYPOTHESIS**，需工艺人员给程序；不能自行选择|

**UNKNOWN — NEED PROCESS CONFIRMATION：**唯一生产验收函数尚不能正式定为软件F_f，也不能直接宣称23与8应使用同一二维中心线测量函数。

已知/未知边界：同100机针标题为FACT；同一个取样针区间、同一Feed经过、同样针位参与、是否抽出后测量、负载/卸载/预牵伸状态、20D LOW材料性质和路径，均UNKNOWN。资料和当前代码历史没有补齐这些定义。

代码历史中`3c1304a`引入精确周期测量并扩展K/M/T窗口测试；`7ababf2`建立当前可信纱长工作流。测试明确检查“完整周期窗口宽度不变性”“包括terminal Miss的机针经过”“保持拓扑不变”。**INFERENCE：**实现意图是每机针周期耗纱，而非按link计量；这些commit/测试并非工厂实际取样程序的证据。现有独立参考也保持有限高度，不能自动证明垂直生产周期验收。

## 16. PROCESS QUESTIONS REQUIRED

**PROCESS CONFIRMATION REQUIRED。**最少需要工艺人员回答四组问题，不在此代答：

1. **实际取样操作是什么？**23和8分别如何取到“100针纱长”：同一段连续100针、同一口一次经过，还是按组织组/计量器/抽纱测量？提供起止点和实际步骤即可。
2. **测量参考状态是什么？**两纱测量时是否带规定负荷、解除张力或预牵伸；5/4cN是织造记录还是测量负荷；20D LOW是否有弹性/预牵伸，8指哪一状态的长度？
3. **两种纱真实怎样经过针与口？**组织编号1–8及96口分别怎样映射；两纱是否同口同时进入；20D是否每针随主纱成圈/集圈，还是只经过部分针、垫入或不同路径？
4. **100针验收如何避开起止段？**标准针对稳定重复组织还是含开停机/边缘取样；有无明确的连接段归属、重复取样和允许误差规则？

同一100针分母不必意味着同一拓扑；同一拓扑也不必意味着同一负载下的中心线长度。需要把这两层分别确认。

## 17. CORRECTNESS VERDICT

最终选择：**E — MULTIPLE ISSUES**。

- **B类事实：**测量窗口定义不等价；软件Solver与自身报告一致，但原30针周期化平均、完整4针内部周期、Legacy侧栏和全可见总长必须区分。VALIDATED没有独立最终repeat检验。
- **C类限定事实：**当前软件路径/参数域不能表达8，已独立复算；这不等于证明真实20D必须使用专用拓扑或已经确定物理模型方案。
- **D类事实：**100针基准明确，完整取样/负载/路线语义仍UNKNOWN，不能安全地按猜测修改业务模型。

|核心问题|结论|
|---|---|
|Q1 正确问题但验收错，还是目标函数可能错？|**后者也存在。**顶边和30针周期化进入优化F本身；不只是求解完后验收函数错。工艺真正目标尚未完整确认|
|Q2 23.7016直接代码原因？|有限顶部Tuck接点路径较短，被`measuredLengthForFeed()`与内部course一起平均；32×40控制隔离出该因素。30×40另有横向截断周期化差异|
|Q3 8不可达属于什么？|在当前有界模型中是路径参数化/目标范围不包含8，未证明是数值精度不足；SOP语义不同或真实路径不同仍UNKNOWN|
|Q4 23与8应同一数学函数吗？|同单位/100机针标题已知；相同路径、参考状态和course平均规则没有证据。不能由同单位推出同F|
|Q5 强行让8收敛最大风险？|通过改分母、删link、缩放路径或改范围制造数值成功，掩盖实际取样语义和路径错误，并让VALIDATED更误导；还可能破坏23的原有定义|
|Q6 下一步排序？|**D→A→证据分支**。先确认工艺语义，再统一测量与验收契约；若确认路径/参考状态不同再评估C；只有证明正确目标被现有参数域无端排除才评估B。当前不支持直接做B|

张力不进入上述数值原因。真实张力可能影响生产取样状态，仅作为**HYPOTHESIS / MISSING PHYSICS**，不是当前代码失败的已证原因。

## 18. RECOMMENDED NEXT STEP

1. 先审核本报告的更正：23.7016的32针窗口条件，以及原30针项目24.0773的内部生成路径值；不继续用23.6760代表完整4针repeat。
2. 将第16节四组问题交工艺人员确认。保留SOP原值23/8，不通过改diameter、张力、单位或目标让结果好看。
3. 根据确认后的取样路径、针区间、状态、Feed含义制定**一个权威验收函数**；让求解目标、最终几何独立复算和PreviewValidity对该函数具有同一契约。当前只提出依赖，不实施修改。
4. 再判断应该修边界/周期测量、调整有依据的参数域，还是表达第二纱不同路径或长度参考状态。不要同时启动专用path、范围扩张和物理层。

本轮执行与保护：

- A–G、32×40/32×48控制、真实100针复算、独立范围复算和独立积分器自校验已执行。
- 本轮重新运行`validate:yarn-length-gauge`、`validate:yarn-length-solver`、`validate:yarn-length-result-integration`、`validate:yarn-length-failure-integration`，均exit0，日志及`validator-exits.json`在本目录。它们通过不等于本轮新反例不存在。
- 本轮未重新进行PBR/浏览器视觉实验，也未重复全量build；没有正式源码修改。保留既有报告，不改写上一轮结论文件，在本报告中明确纠正。
- 149个受保护源码/脚本/配置/约束文件及指定项目SHA-256保持；最终状态见`final-preservation.json`。

复算命令（项目根目录运行）：

```powershell
node reports/yarn-length-semantics-audit-2026-10-16/replay.mjs
node reports/yarn-length-semantics-audit-2026-10-16/independent-auditor.mjs reports/yarn-length-semantics-audit-2026-10-16/geometry-C.json.gz 8 2
```

第二条命令只读已生成geometry文件，独立测Feed8/Yarn2内部完整repeat，不加载Solver。

关键数据：[summary.json](C:/Users/liuchen/Desktop/knitscape/reports/yarn-length-semantics-audit-2026-10-16/summary.json)；完整逐course/raw/边界数据：[results.json](C:/Users/liuchen/Desktop/knitscape/reports/yarn-length-semantics-audit-2026-10-16/results.json)；SOP/assignment证据：[document-evidence.json](C:/Users/liuchen/Desktop/knitscape/reports/yarn-length-semantics-audit-2026-10-16/document-evidence.json)；源文件保护：[final-preservation.json](C:/Users/liuchen/Desktop/knitscape/reports/yarn-length-semantics-audit-2026-10-16/final-preservation.json)。

审计到此停止。没有修复、commit/tag或进入Relaxation/PBR/UI工作。
