# T1 支持 1×1 罗纹的改动范围评估

日期：2026-11-23（Asia/Shanghai）。性质：只读代码评估；本任务只新增本文，不实现罗纹、不修改求解器、不运行新的物理求解。

## 评估基线与结论

接手时分支为 `main`，HEAD 为 `64badcc780dc336daa4c3776976ebfefb229e5d3`，`git status --short` 无输出。本文代码位置以该提交为基线；第 7.2 节另纳入阅读期间完成并提交的第 3 步诊断 `57502bae9c058fda6e8b834ea871b1ffcab69534`，该节明确标出补充源码位置。已阅读 `AGENTS.md`、`docs/NEXT_TASK.md`、`docs/KnitScape_当前功能与算法.md`、`docs/ARCHITECTURE.md`、`docs/PROCESS_VALIDATION.md`、`docs/YARN_LENGTH_CONTRACT.md`，并核查 `src/fabricForm/` 全部模块及相关脚本。旧交接文档里的历史 HEAD、默认设置和“尚未实现”描述不覆盖当前源码。

**结论：可沿用 T1 的三维杆、二维周期晶格、动态接触与约束优化内核，但不能仅把周期改成 2×1 或翻转一半节点的 z 就宣称支持罗纹。** 必改集中在组织拓扑描述、正反线圈连接与初值、拓扑保真的复制/细化、指标计数和验证。主要重构点是现有只支持 1×1 纬平针的细化工具；最不确定的工作是取得并验证正确、可行的罗纹初始嵌入。求解器是否需要额外改动，须在可行罗纹工况出现后判断。

这里的“1×1 罗纹”是交替正反纵行的组织名称；候选计算周期是 **2 个总纵行 × 1 个横列**，不是现有 `m=1,n=1` 的单线圈计算单元。以下将代码事实、工程建议和未确定项分开。规模是静态阅读后的规划估计，不是已经完成的 diff 或工期承诺。

范围只到独立 T1 数值入口。`src/domain/singleJerseyMachine.js::resolveSingleJerseyOperations()` 仍属于单面机 K/T/M 领域；本文不把针型 ID 当正反面，也不要求为此改写 Pattern、Cam 或二维 Simulation。真实双针床机器执行规则及产品接入不在本次规模内。

## 1. 纱线中心线参数化

**当前表示。** `src/fabricForm/fabricFormTopology.js:10` 的 `createPlainJerseyTopology()` 为每个线圈分配 `nodesPerLoop=N` 个节点和 N 条材料边，总节点数为 `m*n*N`。每路纱有一条按材料次序排列、横向周期延续的开放纱线；`loops[].edgeIndices` 只是其中一个材料区间，不是独立闭合曲线。`edges` 记录 `from/to`、周期偏移 `p/q`、`yarnId`、`restLength`、`materialStart`，`bends` 记录相邻边。

优化变量是节点 XYZ 与 `W,H,S`，见 `src/fabricForm/solveFabricCell.js:7` 的 `packFabricCell()` / `unpackFabricCell()`。求解时中心线是分段直线杆；`src/fabricForm/rodBending.js:46` 的 `evaluateRodBending()` 用相邻三维边的叉积、点积和长度算弯曲能，**没有固定正面或 z 正负的分支**，也没有每线圈固定的朝向自由度。

**同面假设在生成层。** `src/fabricForm/fabricFormInitialGeometry.js:29–95` 的 `REFERENCE_CURVES` 是八段五次 Bézier 纬平针参考曲线；`pointOnCurve()`、`sampleReference()` 仅用于生成初值。`createFabricFormInitialGeometry()`（131 行）采样后对每个 needle/feed 平移同一份几何，z 不随针位变号（150–156 行）。`shapeScale` 三个分量必须为正，不能通过传负 z 比例选择反面（139–142 行）。这不是“所有点 z 都大于零”，而是所有线圈沿用同一种空间朝向。

`fabricFormTopology.js:56–72` 另固定了交叉字 `[-1,-1,1,1]`、XY 投影和 `normal: "+Z"`。`+Z` 是比较上下穿越的坐标约定，不能只改这个标签来翻面。

**建议改动。** 在拓扑输入和线圈记录中明确正/反面及其材料顺序，在初值构造中生成对应的线圈与连续连接段，并同步核验交叉目标、周期像、`over/orientation`。整体 z 镜像已有验证依据：`scripts/lib/fabricFormInitialChecks.mjs::runFabricFormInitialChecks()`（103–110 行）检查所有 `over` 反号；`scripts/lib/fabricFormAcceptanceChecks.mjs::runFixedGeometryAcceptance()`（130–149 行）检查镜像能量和梯度协变。两者验证的是**整体镜像**，不能证明逐个交替翻面之后连接仍正确。罗纹完整节点坐标及跨床连接的具体参数化：**未确定**。

## 2. 周期单元与边界条件

`createPlainJerseyTopology()` 接受正整数 `m`（针位/纵行数）、`n`（Feed/横列数），并没有锁死 1×1。`src/fabricForm/periodicCell.js::edgeEndpoints()`（3 行）、`actualEdgeVector()`（12 行）定义：

```text
a = (W, 0, 0)
b = (S, H, 0)
周期像平移 = p*a + q*b
边向量 = position[to] - position[from] + edge.p*a + edge.q*b
```

W/H 为正，S 可变；这是平面内的二维周期晶格，z 是单元内部坐标，没有 z 周期。对于需要在单元内部容纳正反两面厚度的候选 2×1 表示，现有 XYZ 节点和该晶格足以存放坐标；具体罗纹构型是否满足此周期仍须由初值证明，不需要先假定新增第三周期向量。

**可以直接创建 2×1 纬平针。** 调用 `createPlainJerseyTopology({m:2,n:1,...})` 和现有初值函数会产生两个同向线圈、一条每周期材料长 `2*l` 的纱线。代码支持该尺寸，但已有尺寸检查主要列举 1×1、2×2、4×8：`scripts/lib/fabricFormTopologyChecks.mjs::runFabricFormTopologyChecks()`、`fabricFormInitialChecks.mjs::runFabricFormInitialChecks()`。本轮未运行新的 2×1 求解，不能写成“2×1 罗纹已通过”。

**跨单元连接。** `fabricFormTopology.js:41–45` 将每横列最后一条边连回该横列第一个节点，`p=1,q=0`；其他边包括两个线圈之间的边通常为 `p=q=0`。横列之间不是把同一根纱首尾相接，而是不同展开纱线的穿套关系；上一横列跨界通过 `passesThrough.q=-1` 表达（48–63 行）。`accumulateEndpointGradient()`（`periodicCell.js:23`）把节点与周期像的导数一起累加到 W/H/S。

**需要修改的辅助工具。** `replicatePeriodicCell()`（`periodicCell.js:36`）虽能复制任意 m/n 的坐标，45 行却重新调用 `createPlainJerseyTopology()`；自定义罗纹方向和穿套元数据不能直接保真复制。`scripts/lib/fabricFormRefinement.mjs::createRefinedFabricCell()`（92–99 行）明确拒绝非 1×1，并在 108、123 行重新建纬平针拓扑。这两处都必须先支持保留输入拓扑，才能形成罗纹的复制和细化验证链。

## 3. 拓扑与连接

**存储是图数据，当前生成规则是硬编码纬平针。** `fabricFormTopology.js::createPlainJerseyTopology()` 先调用唯一机器入口解析 K/T/M，再拒绝非 K 和每路多纱（17–30 行）；没有床位/正反面字段。每个线圈固定穿过上一横列同针位线圈，交叉字的第四个目标属于下一针位，可能跨横向周期（48–63 行）。所以不能把“结果存成对象”理解为已有任意组织的数据驱动生成器。

`solveFabricCell.js::evaluateFabricCell()` 只调用杆弯曲和接触，`solveFabricCell()` 的约束回调只调用段长约束。它们不消费 `passesThrough.crossings` 来施加穿套约束。当前穿套依赖正确初始嵌入及后续非局部间隙保护；`crossingConvention.scope` 已明确说 XY 交叉字不是变形曲线的完整拓扑不变量（`fabricFormTopology.js:72`）。

**跨两个针床的沉降弧：底层可存放，现成生成器不能生成或验证。** 任意节点可以有不同 z，`actualEdgeVector()` 和 `evaluateRodBending()` 能处理有 z 分量的连续边。同一路纱也已连接相邻线圈，因此不必仅因前后床而拆成两根纱。但当前没有床位语义、床间沉降弧描述或罗纹穿套模板；需要在同一条材料路径上定义正面线圈 → 反面线圈 → 下一周期正面线圈，并重新分配/核查连接段的材料区间和弯曲邻接。不能翻转部分节点后原样继承原段长与穿套字。

建议抽出共享的周期纱线图装配过程，由纬平针与罗纹组织描述提供数据，沿用同一能量、接触和求解链。具体罗纹交叉字、跨床连接曲线、材料区间切点，以及是否必须显式保存床位而非仅保存面向：**未确定**，须以可检验的纱线路径确定，不能照抄现有四次交叉。

## 4. 接触

**当前是物理软接触势能 + 数值势垒 + 轨迹安全步长，不是接触乘子的增广拉格朗日约束。**

- `src/fabricForm/yarnContact.js::contactKernel()`（35 行）、`integrateSegmentContact()`（74 行）对距离小于有效直径 `d_e` 的线段进行双线积分，得到压缩接触能和梯度；距离不小于 `d_e` 时为零。
- `integrateSegmentBarrier()`（80 行）在 `r_c` 附近使用对数势垒，激活宽度为 `0.1*(d_e-r_c)`。`periodicContact.js::evaluatePeriodicContact()`（133–138 行）在非局部中心线距离 `<=r_c` 时直接返回不可行。
- `periodicContact.js::safePeriodicStep()`（165 行）结合扫掠 AABB 和相对端点速度给出保守步长，包含 W/H/S 移动周期像；`minimizeConstrained()` 在该范围内回溯。AL 等式约束是 `rodBending.js::evaluateLengthConstraints()`（94 行）的 `length/restLength-1=0`，输出的乘子是段长约束反力。

**接触对动态搜索。** `periodicContact.js::candidatePairs()`（62 行）每次从当前几何或完整试探轨迹构建三维 AABB/空间桶，根据包围盒、`d_e` 和最小 W/H、最大 |S| 计算 p/q 搜索界；不是固定接触列表，也不限于 ±1 周期像。`evaluatePeriodicContact()` 再用 `yarnContact.js::segmentDistance()` 求闭线段最短距。没有根据正反面/针床过滤。

因此，**只要罗纹采用现有二维周期连续纱线语义、材料身份正确且未落入局部排除区，新增的前后面接触对可由同一机制搜索**，不用手工增列固定接触对。不能据此宣布罗纹全覆盖已验证：`candidatePairs()`（107 行）跳过 `isLocalMaterialPair(...,2*d_e)`；`fabricFormTopology.js::unfoldedMaterialGap()`（77 行）对同 yarnId、q=0 按展开材料距离计算局部性。跨床折回时，几何上靠近的段可能仍在这个排除区，是否会漏掉必须阻止的接触：**未确定**。

已有独立穷举、远周期像、剪切和路径中间穿透检查可复用，见 `scripts/lib/fabricFormPeriodicContactChecks.mjs::bruteContact()`（24 行）、`runPeriodicContactChecks()`（57 行）。但其穷举也使用同样的 `2*d_e` 局部排除原则，因此只比较两者一致不足以验证该原则对罗纹折回的适用性。需增加独立的跨床非相邻段检查和实际罗纹夹具。

## 5. 初值生成及可行性

`fabricFormInitialGeometry.js::createFabricFormInitialGeometry()` 的过程是：采样八段参考五次曲线 → 近似等弧长重采样 → 以目标 l/折线总长统一缩放 → 去除单线圈质心 → 按 needle/feed 平移 → 按实际初始边长设置 `restLength/materialStart`（143–169 行）。这是几何种子，函数返回 `contactFeasibility: "REQUIRES_CONTACT_CHECK"`，并不保证接触可行。`solveFabricCell()`（52–65 行）会拒绝不可行种子，返回 `INFEASIBLE_INITIAL_GEOMETRY`，不会自动解开穿透。

**当前没有能保证罗纹初始可行的构造。** 所需初值至少要满足以下独立条件；这些是建议的验收条件，不是已经取得的罗纹结果：

1. 同一横列连续连接正/反两线圈，并正确跨过横向周期缝；相邻横列的穿套方向、材料次序、目标与周期像正确。参考 `createPlainJerseyTopology()` 的图字段和 `fabricFormInitialChecks.mjs::previousCourseCrossings()`（5 行），但该检查当前只扫描上一横列与 p∈[-1,1]，不能直接充当任意罗纹拓扑证明。
2. 每线圈材料区间含约定分配的沉降弧，长度为 l；2×1 每路总长为 2l。逐边初始长度与 `restLength` 一致，接缝处也必须计入。沿用 `evaluateLengthConstraints()` 与 `fabricFormMetrics()` 的长度检查。
3. 非局部中心线距离严格大于 `r_c`，并有可记录的正安全余量；审查被材料邻域排除的非相邻折回段。允许 `r_c<distance<d_e` 的压缩软接触，**不能把当前模型的可行等同于所有未压缩纱线外包络都不重叠**。如要求初始未压缩外包络也无重叠，应另检查非相邻段 `distance>=d_e`。
4. 所有边非零，弯曲处不出现数值不可解析的反平行切向，见 `rodBending.js::evaluatedEdges()`、`evaluateRodBending()`（64–72 行）。生成、归一化后重新检查，不先检查再缩放。
5. 后续扰动和细化同样保护整段变形轨迹；可复用 `safePeriodicStep()` 和 `createRefinedFabricCell()` 的连续延拓思想，不能只检查变形起终点。

建议先构造空间展开的两面线圈和连接段，再在目标长度下检查/寻找可行种子。初始前后层间距、横向错位、弧形参数的可行区间和有限安全余量的具体数值：**未确定**；现有代码和记录不足以给出保证。它们必须标为数值初值参数，不能把任意床间距当作真实放松织物厚度，也不能改变 l 或物性来掩盖不可行。

## 6. 输出口径：横密、纵密、kw、kc

`src/fabricForm/fabricFormMetrics.js::fabricFormMetrics()`（4–23 行）直接使用 `m,n,l,W,H`：

| 量 | 当前公式 | 代码语义 / 单位 |
|---|---|---|
| 横密 | `10*m/W` | 单元所有针位/纵行，纵行/cm；无正反面筛选 |
| 纵密 | `10*n/H` | 横列/cm，按 y 方向高度 H，不是斜向周期向量的模长 |
| 平均针位节距 | `W/m` | mm |
| 平均横列节距 | `H/n` | mm |
| kw | `waleDensityPerCm*l/10 = m*l/W` | 无量纲 |
| kc | `courseDensityPerCm*l/10 = n*l/H` | 无量纲 |
| ks、kc/kw | `m*n*l²/(W*H)`、`(n/H)/(m/W)` | 随横密计数口径变化 |
| GSM | `m*n*l*tex/(W*H)` | g/m²；材料质量/晶格面积，面积为 W*H |

W/H/S 与 l 用 mm；l 是每针位每横列的材料长度，包含按材料区间分配的连接段。`fabricFormMetrics()` 的 provenance 明确它是给定材料长度，没有通过密度拟合，也不宣称与真实放松状态等同。

对一正一反的 **m=2,n=1** 单元，按现有计算规则派生：

| 指标 | 两面总纵行口径 | 仅指定正面纵行口径 |
|---|---:|---:|
| 横密 | `20/W` | `10/W` |
| kw | `2*l/W` | `l/W` |
| 纵密 | `10/H` | `10/H`，不因两面而把横列重复计数 |
| kc | `l/H` | `l/H` |

**当前默认是总纵行口径**；在纬平针全部同面时，两种口径恰好重合。建议明确输出总纵行、指定面的纵行及对应 kw，保留计数说明，不无标记地改掉既有字段含义。实际样品的正面可见纵行计数与伸展/放松测量状态：**未确定**。

GSM 必须继续使用全部材料。若用仅正面横密代入当前 `gsmFromDensities` 公式，会少一半；应改为总纵行密度计算，或显式记录本例两面计数因子。`scripts/lib/fabricFormMetricsChecks.mjs::runMetricsChecks()`（6 行）目前验证质量单位和复制不变性，没有正反计数用例。

`scripts/validate-fabric-form-plain-jersey.mjs::checkPlainJerseyCases()`（6 行）的 kw/kc/比值区间只针对当前纬平针参考工况，不能沿用为罗纹合格区间；`scripts/lib/fabricFormReport.mjs::writeT1Report()` 与 `fabricFormPlots.mjs::writeFabricFormPlots()` 也含纬平针标题和固定报告口径，后续需标注组织和计数方式。

## 7. 求解器风险，以及第 1、3 步证据边界

### 7.1 已核实的第 1 步

`src/fabricForm/constrainedOptimizer.js::minimizeConstrained()`（294–315 行）已加入 `stagnationWindow=3`：仅当 `INNER_LIMIT` 段的末端梯度 L2 不小于起点时累计；连续 K 段后强制走既有 AL 乘子/罚系数更新。改善或正常更新重置计数，总迭代预算退出优先。未完成且有改善的内层工作段保留目标、乘子和 L-BFGS 历史。**这不是接触乘子限幅，也不限制乘子的正负。**

已有证据 `docs/archive/t1-slope-closeout-2026-11-23/step1-comparison.json:1–8`：4.0 mm/N64 修复前后均 3067 次，`forcedMultiplierUpdate=0`，cell/metrics 逐位相同。`scripts/lib/fabricFormOptimizerChecks.mjs::runOptimizerChecks()`（33–53 行）包含不可满足固定坐标约束的停滞反例、窗口为 2、总预算优先、改善重置。它证明保护分支被测试，**不证明真实罗纹会触发、会获益或必然收敛**。这些是已有记录，本轮未重跑。

另外，`evaluateConstraintReaction()`（46–131 行）已有 Gram 条件估计、超过 `1e6` 或不可靠时回退 SVD、从原 Jacobian 重算残差。这保护段长反力拟合，不等于处理了能量 Hessian 的软模态；`multiplierConditionEstimate` 不能直接当作罗纹横向刚度的条件数。

### 7.2 第 3 步诊断：补充证据及其限度

接手 HEAD 的 `periodicContact.js::evaluatePeriodicContact()` 只返回总能量/梯度、最小候选间距、active/barrier 数量与不可行对诊断（118–161 行）；`solveFabricCell.js::solveFabricCell()` 末尾只记录耗时与强制更新次数（141 行）。没有已提交的逐接触对方向表或横向切线刚度结果。

阅读期间，其他工作完成了三组正式 before/after 与比较文件，本任务在交付前重新读取。以下为 **2026-11-23 第 3 步提交 `57502ba` 的补充证据**，不属于上述接手 HEAD，也不是本任务运行结果：`docs/archive/t1-slope-closeout-2026-11-23/STEP3_DIAGNOSTICS.md`（3–23 行）、同目录 `step3-comparison.json` 的 `rows[].diagnostics.contact` 及三份 `step3-hossain-*-after.json`。`scripts/run-t1-slope-diagnostics.mjs` 的 `compare-hossain` 分支核对相同输入 before/after；三组状态均为 CONVERGED，横/纵密相对差均为 0，cell 逐位相同。

新函数 `src/fabricForm/periodicContact.js::diagnosePeriodicContact()`（补充源码读取时 164–242 行）按线圈材料归属分类：`deltaWale≠0,deltaCourse=0` 为纵行间；反之为横列间（206–209 行）。这里的“纵行间”关联横密节距，“横列间”关联纵密节距；**不是按接触法向的 x/y 分量分类**。每对接触力是刚性平移段 A 的能量梯度合力模，再统计模长之和/最大值（224–232 行），不是总向量合力、横向分力、应力或接触乘子；`multiplierSum/Max=null`。激活采用 `distance-d_e<=1e-9 mm` 的诊断容差，不扩大能量支持域；计数依赖段划分和周期大小（176–196 行）。

| l（mm） | 纵行间最小距/d_e | 激活段对 | 纵行间接触力模之和（N） | 横列间最小距/d_e | 激活段对 | 横列间接触力模之和（N） |
|---:|---:|---:|---:|---:|---:|---:|
| 2.77 | 0.925389 | 14 | 0.01284005 | 0.953550 | 123 | 0.1264074 |
| 2.84 | 0.936970 | 14 | 0.009828010 | 0.958682 | 109 | 0.1078225 |
| 2.90 | 0.946033 | 13 | 0.007674978 | 0.961488 | 94 | 0.09193436 |

表内 Value/Unit 如列示；Source 为上述正式 after JSON；Principle 为 `segmentDistance()/d_e` 与 `norm(gradient[0]+gradient[1])` 的分组统计；Confidence 为模型数值诊断，不是物理实测；Applicable state 为同一材料假设下的 N64 无摩擦纬平针终态。输入 l 为用户提供的给纱设定值，tex=19.78，其他材料输入沿用原假设；`d_e/d_s/r_c` 是固定派生参数，不是独立求解或新测出的直径，其完整六字段来源保留在 `diagnostics.contact.diameterParameters`。

**能支持的结论：**这三点纬平针纵行间接触均存在，随 l 增加，其最小距/d_e 增大、接触力模统计减小；横列间也始终有接触。不能把它说成“横向没有接触”，也不能用两组模长总和的比例推出横向/纵向刚度比。新诊断只记录有限搜索域内的最小值/域外下界，空组不是无限距离证明（`diagnosePeriodicContact():178–190`）。

“罗纹横向几乎不受阻力”仍作为用户给定的待验证风险前提；**当前罗纹实算证据未确定**。第 3 步与第 1 步结合后说明：现有代码能观测接触结构，也有内层停滞保护，但它们都未测量罗纹约束切空间的低刚度方向。平衡反力接近零、某方向接触力少、能量二阶变化小，是三件不同的事。后述为条件性数值风险分析，不能反写成已发生的罗纹失败。

### 7.3 低横向刚度下的具体风险

| 风险（条件性判断） | 当前代码中的作用点 | 对罗纹的含义与应检查事项 |
|---|---|---|
| 等长可行方向很软，长度法向很硬，尺度差变大 | `minimizeConstrained()` 的 `augmented()`（205–216 行）：`E/energyScale + λg + ρg²/2`；`solveFabricCell()`（72–73 行）固定初始罚系数 100 | 若某方向满足 `J*d≈0`，提高 ρ 主要加强约束法向，不能凭空建立该方向的真实材料刚度；可能加剧数值尺度差。是否存在这种罗纹方向未确定。 |
| 曲率信息过小或不可靠 | `lbfgsDirection()`（134–153 行）采用 `s·y/y·y` 初始缩放；`rememberStep()`（156–163 行）在曲率条件不足时清空全部记忆 | 软方向可能产生很小的 y、敏感缩放或反复退回负梯度；现有保护只检查有限性和下降方向，没有方向性预条件或曲率下限模型。需记录历史重置与有效步长，不能先认定必须换算法。 |
| 微小改进长期不触发停滞保护，或强制更新后再次丢历史 | `minimizeConstrained()`（297–313 行）用 L2 “不下降”判据，不含相对进展阈值；更新时清空 memory，必要时 penalty×10，上限 `1e12` | 低刚度造成的微小但严格下降会持续重置窗口；另一种情况下，强制更新可能增加约束刚性但仍解决不了横向平坦。可能到 `MAX_ITERATIONS` / `PENALTY_LIMIT`。不能把 K=3 看成软模态解法。 |
| 安全步长很小或回溯失败 | `safePeriodicStep()`（170–193 行）限制 W/H、最大物理位移及 `0.8*(distance-r_c)/speed`；回溯最多 60 次且 step>`1e-16`（`minimizeConstrained():249–280`） | 相对软的整体运动若夹带前后面近接触，会被最小间隙限制。`NO_SAFE_STEP` 可直接终止；`innerStatus=LINE_SEARCH_FAILED` 则写入 history 后继续 AL 外层，最终可能预算耗尽或触及罚系数上限（281、300–318 行）。需同时检查 history 和最终状态，不得绕过防穿透。 |
| 一阶残差小，但横密不稳定或解不唯一 | `solveFabricCell()`（74–81、100–106 行）检查节点反力和 W/H/S 一阶残差，未检验约束 Hessian、最小特征值或宽度稳定性 | 接近平坦的可行方向可有不同 W 却都满足一阶门槛；需要宽度扰动后重新松弛、分支/网格比较，而非只看 CONVERGED。 |
| 横向周期缩小时搜索代价上升 | `candidatePairs()`（71–75 行）pMax 随 `1/minW` 增长；大扫掠盒转直接检查，覆盖不截断（82、101 行） | W 变小可能增加周期像与候选数，实际耗时未确定；不能沿用单线圈耗时推算。 |
| 单元翻倍但默认曲率记忆不变 | `solveFabricCell.js::defaultMemorySize()`（22 行）只看 N：60/180/384；未知数实际为 `3*m*n*N+3` | 例如 N64 的 1×1 和 2×1 都默认 180，不能假定此设置对加倍自由度同样合适。显式参数优先规则和 checkpoint 一致性应保留（`scripts/lib/fabricFormCloseoutSettings.mjs::resolveCloseoutMemorySize()`）。 |

建议先保持能量、物性和容差不变，在已证明可行的罗纹初值上测量，再决定预算、记忆、尺度处理是否需要改动。需要区分总能量/弯曲/接触/势垒的宽度响应与约束反力，并跟踪 W/H/S、间隙、候选对、内层状态、强制更新次数。当前 `lockedDimensions` 同时锁 W/H（`solveFabricCell():41–50`）；若要固定 W 而让 H/S/节点充分松弛来测横向有效响应，需补按维度锁定或等价的诊断路径，不能把固定全部节点的偏导当松弛刚度。

## 8. 对称性与自由度减少

**能量的整体镜像对称有验证，罗纹的镜像约束没有实现。** `fabricFormAcceptanceChecks.mjs::runFixedGeometryAcceptance()` 的 A9（130–150 行）验证 z→−z 时 W/H/S 不变、能量不变、z 梯度反号；代码特意说明 z 镜像不要求 S=0。`solveFabricCell()` 的 `freeIndices`（49 行）只固定首节点 XYZ 以去掉平移，可选固定 W/H。`constrainedOptimizer.js::checkedFreeIndices()` 能冻结坐标；通用 AL 接口能接收等式约束，但当前物理入口只传段长约束，没有节点镜像配对或变量消元映射。

**建议有条件利用。** 在确认罗纹的完整材料映射后，可令一半节点由另一半经镜像、半周期平移及必要的材料序号重排生成。必须同时证明跨床连接、周期缝、穿套关系、段长与物性在该映射下保持一致。单独使用 `[x,y,z]→[x,y,-z]` 的整体测试不足以证明这种组合映射；正确映射和可减少的精确自由度数：**未确定**。

推荐先完成自由 2×1 模型，再把对称消元作为可选计算方式，仍调用同一能量与接触内核。若采用映射 `x=T(u,W,H,S)`，要把节点梯度、长度 Jacobian、晶格导数通过链式法则回传，并将降维方向展开后调用现有轨迹安全检查；仅缩短 `freeIndices` 不能施加耦合镜像关系。若改为新增对称等式约束，能表达对称但不会减少变量数，还可能引入冗余约束。

验收需比较对称解展开后的全空间残差，并取消对称、加入可行微扰重新松弛，检查是否存在能量更低的非对称分支。`scripts/run-fabric-form-plain-jersey.mjs` 的 `cell-size-branches` 分支（83–105 行）已有破坏复制对称的扰动思路，但不是罗纹证明。是否存在对称破缺及对称降维能否稳定提速：**未确定**。

## 需要修改或新增的模块与规模

小：<50 行；中：50–300 行；大：>300 行或需要结构重构。下表“行”估计为新增/实质修改的逻辑与验证行量级，不把机械格式变化计入；文件名建议不代表本轮已创建。

| 模块 | 必要工作与已有入口 | 规模估计 | 必需性 |
|---|---|---|---|
| `src/fabricForm/fabricFormTopology.js` | `createPlainJerseyTopology()` 中提取共享图装配；增加正反组织描述、穿套与材料区间契约，保留唯一机器规则来源 | 中，约 120–250 行 | 必须 |
| `src/fabricForm/fabricFormInitialGeometry.js`，必要时新增同目录罗纹初值模块 | 按正反循环生成连续两面线圈与连接段；长度归一、可行性失败输出；共用现有物理内核 | 中，约 180–300 行；若需独立可行性搜索，规模未确定，可能大 | 必须，最大不确定项 |
| `src/fabricForm/periodicCell.js` | `replicatePeriodicCell()` 保留并重映射输入拓扑、面向、穿套目标和材料身份；底层向量与梯度公式复用 | 中，约 70–160 行 | 必须用于复制验收 |
| `scripts/lib/fabricFormRefinement.mjs` | `createRefinedFabricCell()` 去除单线圈限定；按纱线/线圈材料区间细化，保留罗纹拓扑与受保护延拓 | 大（结构重构），初步约 180–300 行 | 网格收敛验收必须 |
| `src/fabricForm/fabricFormMetrics.js` | 明确总/正面横密及 kw、ks、比值口径，保持总材料 GSM，补计数来源 | 中，约 50–120 行 | 必须 |
| `src/fabricForm/solveFabricCell.js` | 初值/输入拓扑一致性含结构身份，结果保留组织/计数信息；必要的尺寸诊断接口 | 中，约 50–150 行 | 必须；首轮仍用自由完整变量 |
| `scripts/lib/fabricFormTopologyChecks.mjs`、`fabricFormInitialChecks.mjs`、`fabricFormPeriodicContactChecks.mjs`、`fabricFormMetricsChecks.mjs`、`fabricFormAcceptanceChecks.mjs`；细化与罗纹用例 | 2×1 纬平针等价、罗纹缝/长度/穿套/跨床接触、计数与质量、复制/细化、梯度/方向风险；复用现有检查入口 | 大，合计约 300–650 行 | 必须；不是各文件都大 |
| 现有运行/报告入口：`scripts/run-fabric-form-plain-jersey.mjs`、`scripts/run-fabric-form-a14-closeout.mjs`、`scripts/lib/fabricFormReport.mjs`、`scripts/lib/fabricFormPlots.mjs`，或共用入口下增加罗纹工况 | 输入组织、保存实际设置和初值、绘图标注正反面/计数，分开纬平针经验比较与罗纹验证；不建第二套 solver | 中，合计约 100–220 行 | 必须；图标题本身是小改 |
| `src/fabricForm/periodicContact.js` / `fabricFormTopology.js::isLocalMaterialPair()` | 若折回夹具证明局部排除或现有诊断不足，再扩展策略/诊断；搜索内核先复用。第 3 步新诊断按 `floor(edge.order/N)` 认线圈，泛化后须核对该编号前提并增加面向分组，不能当法向分力 | 首轮预计无需物理公式改动；诊断标签为小；排除策略若需变更为条件性中，约 50–200 行 | 先验证再决定，未确定 |
| `src/fabricForm/constrainedOptimizer.js`、`solveFabricCell.js::defaultMemorySize()` | 仅在真实罗纹停滞/尺度问题复现后调整；参数试验不等于必须改代码 | 首轮可零改；条件性中，约 50–200 行；若换优化法则大且未确定 | 条件项，不预先重写 |
| 可选的对称映射模块及 `solveFabricCell.js` 接入 | 独立变量展开、梯度/Jacobian 回传、晶格依赖、安全步长、全空间复核 | 大（变量映射重构）；粗估 150–300 行核心，另需验证 | 后置，不计入最低可用范围 |
| `rodBending.js`、`yarnContact.js`、`fabricFormParams.js` | 现有三维杆、径向接触、材料来源契约复用；现无必须改公式的代码证据 | 0 行预期；若仅补元数据为小 | 不因组织名先改物理模型 |

**规划总量：**前八项最低完整数值链约 **1,000–2,200 行**（含验证和脚本），属于多个模块的中等改动，加细化工具重构；不是几十行的组织开关。该区间由表内估计合并取整，不包含可行性搜索升级、求解器更换、可选对称降维、双床 Machine Domain、UI/项目格式接入。总工期与实际 diff：**未确定**。初值路线若验证失败，应先重新评估，不能用该估计承诺交付。

## 建议实现顺序与可独立验收的检查点

下表是后续实施建议，本轮不执行。每步完成并由实现者验收后再开始下一步。

| 顺序 | 工作 | 独立检查点 / 停止条件 |
|---|---|---|
| 1 | 固定结构与计数契约，先让 2×1 纬平针复现现有单元 | 从已收敛 1×1 精确复制为 2×1；逐边向量/材料长度一致，W 翻倍、H 不变，单位线圈能量、回传梯度、总横纵密、kw/kc/GSM 一致。再进入同一 solver 复核平衡。固定几何等价与独立寻优分开记录。参考 `runFixedGeometryAcceptance()` 的 A5。 |
| 2 | 抽出组织描述并使复制保留输入拓扑 | 所有纬平针旧检查通过；新描述的正反标签、材料顺序、穿套目标、周期像在复制前后可追溯，跨缝邻接不丢失；不引入第二套机器动作解释。 |
| 3 | 生成一个 2×1 罗纹种子，先验初值而不求平衡 | 逐边/逐线圈长度、闭合和弯曲合法；前/侧/端视图辅助人工检查；穿套关系有可复查证据；独立穷举非局部间隙及被排除折回段。不可行立即返回明确原因，不自动用错误拓扑凑解。 |
| 4 | 验证接触和完整变量自由求解 | 新增跨床、周期缝、远像和步中穿透反例；能量/梯度有限差分、q 加密检查；完整自由 2×1 的节点与晶格反力、长度、间隙全部通过，保留失败与停滞记录。不得只报告 optimizerStatus。 |
| 5 | 核对输出并诊断横向软方向 | 两套横密/kw 与 GSM 计数一致；对 W 做受保护扰动/锁定宽度后松弛，区分一阶反力与有效刚度；检查不同可行初值、微扰、记忆设置下 W/H 是否稳定。数值不稳定则先处理本项，不能进入物理预测。 |
| 6 | 泛化细化并检验分支和网格收敛 | 先用 2×1 纬平针验证新细化与旧单线圈链的一致性，再测罗纹 N→2N；延拓全过程安全，材料区间/组织身份不变；双方向密度及每线圈能量随网格稳定。另将罗纹保真复制到 4×1、2×2 等扩大单元，加入安全且打破复制对称的微扰后自由松弛，比较每线圈能量、密度、形态和残差；未验证时仅宣称 2×1 周期内的分支。参考 `run-fabric-form-plain-jersey.mjs` 的 `cell-size-branches`。阈值须提前约定，不能用纬平针 B 类区间替代。 |
| 7 | 可选对称降维 | 同一映射下能量、节点/晶格梯度、Jacobian 和轨迹步长一致；展开解全空间残差通过；取消对称后扰动不暴露更低能量分支，或明确记录仅为受限对称分支。提速需实测。 |
| 8 | 再讨论真实数据与产品接入 | 取得匹配状态、口径的罗纹实物数据再做比较；双床机器规则单独设计，不把 T1 数值组织标签塞进 Single Jersey Cam。 |

后续功能开发的回归入口可复用 `npm run validate:fabric-form-solver-math`，补充对应工况后运行相关 `npm run validate:*`、全量 `npm run validate` 和 `npm run build`。这些是未来检查点；本轮文档评估没有运行它们，也不把已有日志写成本轮 PASS。

## 风险、未确定项与本轮核对

1. **拓扑风险最高。** 可存任意 XYZ 不等于能自动生成正确罗纹；固定 XY 交叉字也不是完整拓扑不变量。缺少经确认的罗纹材料路径、跨床沉降弧和初值。
2. **可行性语义有限。** 现有 `distance>r_c` 保证范围是受检查的非局部段，允许有效外包络压缩，局部排除区需另审。不能宣称所有圆管几何或所有局部折回都无穿透。
3. **数值稳定性未确定。** 尚无可引用的罗纹平衡、横向切线刚度、唯一性、网格误差或耗时；乘子保护与纬平针成功记录不能替代这些结果。
4. **物理输入未确定。** 罗纹真实纱径、材料力学、前后面长度是否相同、摩擦与松弛/后整理状态均未由本次代码阅读确认。`fabricFormParams.js::createFabricFormParams()`（11–82 行）的默认值为 `ASSUMPTION`，派生值为 `DERIVED`；不得转录为实测。后续任何影响物理结果的值，包括若引入的层间距，需保留 Value、Unit、Source、Measurement/derivation principle、Confidence、Applicable state；初值参数与物性分开记录。
5. **证据并发变化。** 第 3 步工作在本轮阅读时由其他任务写入，不能把整个工作区称为本任务的干净基线，也不能提交/回滚其文件。除第 7.2 节明确注明的补充源码外，代码行号固定到接手 HEAD；新增证据单独标明来源和数值适用范围。

本轮验收：八个问题和代码依据齐全；规模区分必需/条件项；81 处可解析文件引用的路径检查通过，直接附带的行号未越界；文档无待填写占位；文档差异检查无空白错误，并经两份独立只读复核。没有写实现代码，没有执行新的罗纹/纬平针求解，没有运行 npm 验证或构建。

交付前第 3 步证据核对：2026-11-23 已读取正式三组 before/after、`step3-comparison.json` 与 `STEP3_DIAGNOSTICS.md`，并对照新增 `diagnosePeriodicContact()` 定义；已纳入第 7.2 节。未将 preliminary 文件当正式结果，未把外部任务的测试/构建当成本轮验证，也未将这些证据纳入本任务文档以外的文件提交。
