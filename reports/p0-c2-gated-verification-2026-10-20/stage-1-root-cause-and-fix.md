# 基础中心线—显示偏置—二维投影穿插根因与修复

## 2026-10-21 剩余验收续查（当前结论，状态修复之后）

**未设置纱长状态回归保持 PASS；指定 A/B/C 的历史来源已确认；穿插性质尚有局部证据缺口，阶段一 FAIL / BLOCKED。** 本节取代下方历史正文的当前状态表述；下方 A=INVALID、旧闸门失败日志属于修复前证据，保留不改写。状态修复及其正式红绿测试见 [状态回归报告](unset-length-preview-state-fix.md)。DESIGN_PREVIEW 只恢复状态表达，不证明几何正确。

### 开工状态与证据版本

当前分支 `main`，HEAD `7ababf264d495f6b96d4d66652c529424938ac4d`；暂存区为空，既有工作区修改保留。复用已有项目外旧 worktree，HEAD 同上，旧源码无修改，其唯一 tracked 差异仍为上一轮为统一字节而复制的 `package-lock.json`。本次没有重新创建环境、安装依赖或修改产品源码。

本次 [对照记录](effective-target-comparison.json) 保存 branch、HEAD、完整 short status、旧 HEAD、锁文件及 SOP SHA、151 个 src/scripts/package 文件 SHA。逐项核对状态修复收尾版本：148 个仍等于 `unset-length-baseline.json`，另 3 个等于状态修复最终 SHA；151 个均未在本次改变。相关三文件最终 SHA 为：

| 文件 | SHA-256 |
|---|---|
| `src/simulation/yarnSimulation.js` | `c904b0aaa6c31d47bdcd374007b4ad05dfa0422d79719991768cb6afe274cb32` |
| `scripts/validate-yarn-length-input-integration.mjs` | `adcbf02539cfada3ef2b742ff2e93f9909ac6b0f7391cbafac8d84e1493a589f` |
| `scripts/validate-multi-yarn-renderer.mjs` | `eeeea8fb1be5970f681614ad0d22528ed2270181cfa932cebff521365459c9ed` |

渲染验证器第 281 行同步的旧断言已再次只读核对：`allIncomplete` 只有一个 `relaxedWithDraft` Assignment，放松长度 8、缺倍率；有效机器 fixture、无其它目标，故 DESIGN_PREVIEW 正确。相邻主纱 23 加不完整氨纶的 PARTIAL 断言，以及独立不可达、机器错误检查均保留。没有重查或重修已闭环的状态根因。

### 补齐旧直接目标 24 与当前 8×3 的对照

扩展原 `root-cause-regression.mjs` 的可选 `--matched-effective-inputs` 分支，复用现有 Domain 的 `resolveYarnLengthInput` 和原观察/相交函数。转换仅用于报告中的旧版运行输入：删除新模式/放松长度/倍率字段，把有效目标写入旧直接长度字段；无目标用旧合同的 0 编码。没有复制目标派生公式，没有修改项目包。

| 场景（8 路均相同） | 当前事实 → 有效目标 | 旧版可比较事实 | 实际结果数；旧 / 当前状态 |
|---|---|---|---|
| A | 主纱未填；氨纶仅保留倍率 3 → null / null | 直接 0 / 0 | 0；DESIGN_PREVIEW / DESIGN_PREVIEW |
| B | 主纱 23；氨纶仅保留倍率 3 → 23 / null | 直接 23 / 0 | 8；VALIDATED / PARTIAL |
| C | 主纱 23；氨纶放松 8、倍率 3 → 23 / 24 | 直接 23 / 24 | 16；VALIDATED / VALIDATED |

8 的单位是 cm/100 针、来源为原 SOP 放松实测事实；3.0 为织造态长度÷放松长度的无量纲倍率；24 为运行时派生织造态长度，非新的实测值。固定原组织、30×40、G32、Cam、排针、Feed×Yarn、placement、材质、展示直径、画布和视角。原始输入 hash 因字段表达不同而不等，转换后的可比较输入 hash 相等。B 的状态差异按两种模式的既有合同保留，没有把它伪写为相同。

执行命令（exit0）及完整输出见 [对照日志](effective-target-comparison.log)：

```text
node reports/p0-c2-gated-verification-2026-10-20/root-cause-regression.mjs C:\Users\liuchen\.codex\worktrees\p0-c2-old-baseline\knitscape --matched-effective-inputs
```

A/B/C 每一组的原始中心线、横列对齐路径、显示偏置 strip、拓扑 links、9038 条绘制命令/顺序、解析直径 hash **全部相等**；去除新版来源元数据 `lengthInput` 后，0/8/16 条完整求解结果分别严格相等。**来源结论：这三个指定样本的几何与显示路径为历史已有，本轮未引入或加重。** 不推广为所有项目或所有物理状态的证明。

本次是正式 `simulate/draw` 的 640×480、DPR1、scale1、正面 solid Canvas 存根命令捕获。反面 hash 按现有镜像/层交换规则从命令推导，不能当成本次真实反面像素；旧版直接进入 Machine adapter/simulate，不证明旧版可以导入 v3 包。真实后端证据继续引用第 11 节既有 16 组观察；没有新增旧 B/C 的真实像素对照。此命令的 PASS 是等效输入对照 PASS，分支提前退出，**不执行也不冒充 `--gate` 放行**。

### 首次出现层级与局部分类

| 局部事件 | Feed / Yarn / 链接 | 首次出现与证据 | 性质结论 |
|---|---|---|---|
| C-01、C-04 | 主纱 `yarn-1792072401481`，slot0，Feed1；row8 的 917/919，row16 的 1835/1837（row 为零基） | A/B/C 的 raw、resolved 均 0 交点；正式 −0.12 法线偏置后各 1 交点。C-04 A 坐标约 (9.618306063,15.261442448)，B/C 约 (9.629352145,14.384688205)，为显示坐标÷stitchWidth；旧/当前逐点相同。既有 27 组偏置/采样控制继续适用。 | **历史显示偏置导致的二维交叉**。来源和首次层级确定；是否为合法绕行的正常投影、或应调整遮挡的显示缺陷，仍缺局部上下关系，不能判为三维穿透。 |
| A-1891/1949 | 主纱 slot0，Feed1 row16 与 Feed2 row17；共享 CN1135，两段均 back | raw 已交于 (23.521413185,14.264357946)；resolved/placed 仍交；B/C 同一对均无交点。共享 CN 但数值端点相距约 0.2697 模型单位，非连续段公共端点。 | **历史原始 XY 交叉，性质证据不足**。正常圈柱交叠是可能解释，但当前记录不能确认前后关系；未证明原始几何错误或物理自穿。 |

CN1135 的两条实际通路分别为 row16 的 `1891(FHLH,back) → 1892(LHLL,front)`（LH）和 row17 的 `1949(LHFL,back) → 1950(FLFH,front)`（FL）。各自通路连续，不代表 1891 与 1949 相接。[ProcessModel](../../src/simulation/ProcessModel.js) 保存 ST/AV/MV；[YarnModel.calcLayer](../../src/simulation/YarnModel.js) 按 K/P 与 linkType 分 front/mid/back，没有额外记录该 LH/FL 局部事件谁在上。

补核“是否已被前层遮住”时，只复用冻结 A strip 和原 `minPointPolylineDistance`，结果追加在同一日志：

| A 正面偏置交点（显示坐标÷18） | 相邻 front 段 | 点到该段中心折线距离（模型针距） | 能证明的范围 |
|---|---|---|---|
| C-04 (9.618306063,15.261442448) | 1836，LHLL，row16 | 0.121623793919 | 大于实线半径 0.12、小于阴影半径 0.132，不能宣称交点被完全覆盖或必定可见 |
| 1891/1949 (25.699824166,15.314269930) | 1892，LHLL，row16 | 0.025002312521 | 在 Canvas 正面名义实线覆盖范围；反面 front 降为底层，此解释不再成立 |

0.24 直径来自既有 fallback 展示值；实线/阴影分别由 `yarnTextureBrush.js` 的线宽及 1.1 倍线宽得出。没有实测纱径或物理 z，不能据此给出纱体穿透结论。上述是二维 Canvas 名义覆盖，不是 WebGL 像素断言或物理上下证明。两对 back 内部均为后 link 后画，翻面不反转其内部顺序；WebGL 顶点 z=0，既有真实捕获 `depthTest=false`，不会补出缺失的局部深度关系。

### 阶段一裁决、最小缺口及独立复核

原要求第七节要求用“前后深度、绘制顺序、拓扑关系”判断；第十一节验收包含“内部中心线无错误自交”和“正常交叠前后关系可解释”。分支 A 还要求原始中心线正确，分支 E 则要求证据不足时停止。原规则没有“历史已有且无加重即可免除局部分类”的放行条款。

因此阶段一为 **FAIL / BLOCKED（证据不充分，不是已经证明物理错误）**。当前最小缺失证据是同一 K/T 局部单元的两项明确约定，可由已有设计依据或经工艺确认的局部示意提供：

1. C-04 的 FHLH(1835) 与 LLFH(1837) 在平行双纱显示中的正确前后/遮盖关系，及中间 LHLL(1836) 的作用；用于判定现有偏置交叉是否属于可接受显示，或指导现有 Renderer 的最小修复。
2. CN1135 的 LH 与 FL 两次通路在原始交点处的正确前后和连接关系；用于判定该原始 XY 交叉是否为正常投影。

无需为补这两项先造碰撞系统或完整三维模型。仅凭两侧路径相同、共享 CN、正面部分遮盖或任意缩小偏置都不足以替代上述证据。

本次复用 A `/root/geometry_review`、B `/root/renderer_review`、C `/root/adversarial_review` 三个原会话做限定只读复核，没有新建智能体或重复七角色报告。A 复核两条 CN 通路与模型表达边界；B 复核图层及上述名义覆盖；C 独立核对旧有效输入转换、8 路非长度事实、0/8/16 条完整数值、旧断言及闸门规则。结论一致：归因证据通过，不能把归因通过写成穿插性质已验收。

### 数值、验证、浏览器及交付边界

SOP 16 条结果本次旧/当前严格相等，主纱 Feed1 `22.999920925128244`、氨纶 Feed1 `24.000753567866827`；漂移 0。M1/M3 继续引用同源码状态的 [正式专项日志](unset-length-related.log)，历史值漂移 0；M1 求解窗口与 M3 完整 repeat 的口径差异仍保留，未被认定为生产物理问题已经解决。±2% 仍仅用于原约定抽样验收，没有改 Solver 数值容差或自动测试。

| 验证 | 当前有效结果及来源 |
|---|---|
| 本次 A/B/C 有效输入对齐及数值/路径比较 | PASS，exit0；新增对照 JSON/log |
| 未设置长度正式 A–L 状态集成、相关长度/失败/renderer/SOP 专项 | 引用状态修复最后版本的 PASS；151 个受保护文件 SHA 一致 |
| `npm run validate` | 引用 [状态修复收尾全量](unset-length-validate.log) **41/41 PASS，exit0**；本次未重跑 |
| `npm run build` | 引用 [同源码构建](unset-length-build.log) **PASS，exit0**；本次未重跑 |
| `git diff --check` | 本次收尾重新执行 **PASS，exit0**，结果见 `effective-target-comparison.log`；另核对本次未跟踪报告文件无行尾空格 |
| 阶段一性质分类 | FAIL / BLOCKED；原始/偏置局部上下关系未证实 |
| 阶段二真实浏览器往返 | **本次未执行**：新模式保存重开、逐 Feed×Yarn 差异、旧项目兼容、模式/Clear/未完成状态跨保存恢复均尚未验收。前置闸门未开放，不是浏览器无法运行 |
| 阶段三最终集成、氨纶数据合同最终验收 | 尚未完成；既有自动包/JSON 往返与上一轮产品 UI 状态操作不能代替阶段二 |

本次实际修改：原观察脚本增加等效输入对照；本报告、`stage-1-crossing-audit.md`、`FINAL_REPORT.md` 更新当前裁决；只新增 `effective-target-comparison.json` 和 `.log` 两个必要证据文件。原冻结 `root-cause-regression.json`、旧路径/截图及修复前闸门数据均保留，防止破坏正式回归依赖。没有修改 Solver、Geometry、Renderer、模式合同、项目版本、结构 revision 或依赖。未 commit、未 tag；不建立 `baseline-spandex-process-contract`，不标记整体验收完成。

## 2026-10-21 根因初查（修复前历史正文，保留）

日期：2026-10-21（Asia/Shanghai）。本轮沿用原报告目录、SOP-001、检测函数与 A/B/C 审查角色，没有重新审计全仓。

**裁决：未填长度的指定 SOP 穿插是旧基线已有问题；C-01/C-04 的局部原因已确定为显示法线偏置。但原始跨横列交点的局部上下关系及安全修正规则未闭环，按用户分支 E 停止，不修改业务源码。整体根因与修复仍 UNRESOLVED，阶段一 BLOCKED。**

“局部来源确认”不等于“全部穿插已分类”或“已找到正确修复”。本轮没有修复后 PASS、阶段二往返、阶段三裁决、提交或标签。

## 1. 回归归因

当前 `main` / HEAD 均为 `7ababf264d495f6b96d4d66652c529424938ac4d`；累计未提交改动保持。旧基线由原生 worktree 工具建立于项目之外：

`C:\Users\liuchen\.codex\worktrees\p0-c2-old-baseline\knitscape`

旧目录只作为只读源码对照。为满足依赖一致，复制当前锁文件到该隔离目录、通过 junction 共享当前 `node_modules`；没有安装依赖。旧目录锁文件的换行字节由当前文件统一，业务源码未修改。两边 Node **v20.17.0**，锁文件 SHA-256 同为 `517424793ae4e8b0bb913eeB77bb76f0fb0251c4e1a2aae70b36ce02d6f35f5f`（十六进制大小写无语义差异）。没有 reset、stash、clean 或 checkout 当前工作区。

共同来源为上一轮完整 SOP 包，SHA-256 `4082211c588918157944aa33182ef8f3c7db5004b219d80b0f3fd23c3ddfd677`。由当前 `readProjectPackage` 读出一次，然后将完全相同的运行时对象交给各版本的机器适配器和 `simulate`。**这是模拟管线回归对照，不是旧版成功导入 v3 包的证明。**

| 固定条件 | 值及边界 |
|---|---|
| Machine | Gauge32；排针1234；Cam四轨 `KKKKKKTT / KKKKTTKK / KKTTKKKK / TTKKKKKK`；8 Feed；30×40 |
| Assignment | 每Feed两纱、相同Yarn ID/placement/张力/材质；解析展示直径均0.24；legacy companion关闭 |
| A（主对照） | 两纱长度清空；保留原长度模式、原倍率3；无有效目标，无求解结果 |
| A-direct（反证控制） | 全部删除新模式/放松长度/倍率字段；旧长度字段用0表达未填；不是给目标补0长度 |
| Node观察 | 640×480、DPR1、scale1、同一实际draw函数，Canvas接口存根捕获命令；不冒充GPU |
| 浏览器观察 | 1280×720截图视口；预览640×480 CSS、800×600 bitmap、DPR1.25、scale1、pan0；正/反面分别匹配；真实Canvas/真实WebGL分别匹配 |

[回归工具](root-cause-regression.mjs)复用 `geometry-topology-crosscheck.mjs::intersections`，未另写检测库。其[结果](root-cause-regression.json)证明 A 与 A-direct 各自在旧/当前两侧：输入、原始中心线、横列对齐后路径、全部偏置 strip、拓扑链接、**9038条绘制命令及pathData**、解析直径的 SHA-256 全部相等。A 与 A-direct 的几何也相同。

结论选择用户 **A：本指定未填长度输入下穿插相同**。没有发现 B“新增几何交点”或 C“当前更严重”的证据；不能推广到所有材料和项目。当前 A=INVALID、旧 A=DESIGN_PREVIEW，是另一个状态差异，不是几何差异。

两侧五类导出已保留在 `root-cause-{old,current}-A-paths.json.gz`：`raw`、`resolved`、`strips`、`screen`/实际绘制坐标、`order`/`links`。同侧 A-direct 与当前 B/C 也保留。屏幕反面是现有CSS镜像和层级交换；图层是类别而非物理z。截图和浏览器 JSON 使用同一前缀，见第11节。

## 2. 原始中心线

生产入口仍为 `yarnSimulation → buildYarnPathGeometry → modelPathByLink`。求解后不同 Feed 使用各自 loopHeight 的模型工作坐标，再由现有 `resolveModelPathsForDisplay` 整横列平移连接；不能将未组装的 B/C 跨横列坐标当作最终布面。

[A续查](agents/geometry-topology-audit.md)和[关系复核](root-cause-relationship-review.json)先核对102个src文件及package/lock共104个哈希不变，再核对冻结证据与本轮捕获的9038条原始/对齐路径逐条相同。复用原扫描结果并新增一次**原始坐标**扫描，A/B/C分列；不是只检查同横列。

下表是离散采样候选交点，**不是物理错误计数**。合法连续端点已由原检测器排除；跨slot接触端点和完全重合曲线单独标记。近乎平行、切触、部分共线及采样间微小环没有解析证明。

| 关系 | 原始A / B / C | 横列对齐后A / B / C（偏置前） |
|---|---|---|
| 所有候选XY交点 | 28586 / 20877 / 21018 | 28584 / 21666 / 22133 |
| 同slot、同横列非相邻段 | 0 / 0 / 0 | 0 / 0 / 0 |
| 同slot、相邻横列 | 7484 / 4419 / 1354 | 7484 / 7784 / 8084 |
| 同slot、相隔至少8横列 | 0 / 287 / 481 | 0 / 0 / 0 |
| 同slot、跨8路分组边界（含跨多行） | 1536 / 2897 / 4192 | 1536 / 1632 / 1560 |
| 同slot、紧邻周期接缝7/8等 | 784 / 590 / 396 | 784 / 784 / 784 |
| 同slot、同Feed | 0 / 0 / 0 | 0 / 0 / 0 |
| 不同Feed、同资产Yarn ID | 9776 / 9544 / 9238 | 9776 / 9942 / 9940 |
| 同Feed、不同Yarn ID | 8956 / 1437 / 1748 | 8954 / 1517 / 1307 |

A原始与对齐总数差2：顶部course39、link4516/4517的跨slot近端点接触，原始端点误差约4.65e-7模型单位；不能把这个数值边界差异写成新增内部错误。A两slot另有4519对完全重合参考曲线，不纳入上述交点总数。

中部course16–23/针4–23、顶部37–39、底部0–2、第一完整周期0–7、7/8、15/16、23/24、31/32接缝均有单独矩阵。B/C原始跨8行候选是尚未横列组装的模型坐标现象，不能直接判为物理跨周期相撞。模型是有限开放蛇形链，无末端接首端的物理闭合合同；没有虚构周期闭合通过。

**关键反例 A-1891/1949：** 原始XY已有相交 `(23.521413185,14.264357946)`；显示偏置前后仍交。共CN1135、同back、不同Feed/相邻横列，但不是数值共享端点，两段关联端点距离约0.2697模型单位。共享CN支持接触邻域解释，不自动证明该交点合法。B/C同一对在三层均未交，不能以求解消失倒推A必错。

原始/对齐路径的模型空间只有XY。相交处XY最近距离为0；没有真实z/三维最近距离。C-04原始最小XY距离约A=0.092824、B/C=0.106695（细采样近似，非解析极值）。实际同根纱身份、物理线圈事件ID仍不能由slot/资产ID自动推导。

## 3. 显示偏置

沿用现有authority，完整区分：

1. `yarnPathGeometry` 在模板节点处使用展示直径和法向展开基础中心线。这是原始模型的一部分，不冒充本轮新增显示修复。
2. `modelPathToCanvas` 的全局正比例缩放与平移；有求解路径时，`resolveModelPathsForDisplay` 按横列平移接续。不改变各横列长度。
3. `drawYarnSimulation.parallelOffset` 按同Feed各slot展示直径堆叠；Feed只决定用哪组Assignment，没有独立额外Feed平移。
4. `buildYarnUvStrip` 将采样点沿自身法线移到 `p + offset*n`；Canvas在有偏置时使用同一strip左右顶点平均的折线，WebGL使用该strip。
5. legacy companion是额外绘制的兼容ply；本SOP关闭，当前显式材料分支还会抑制它。不是本例交叉的新增来源。
6. front/mid/back是图层和绘制次序，不是沿z平移。没有额外3D相机或实体深度偏置。

两根0.24展示直径，旧式等距偏移与当前累计直径偏移都等于 **slot0 −0.12 / slot1 +0.12**。旧/当前实际strip哈希也相同，故不是只凭公式相似推定。

| Value | Unit | Source | Principle | Confidence | Applicable state |
|---|---|---|---|---|---|
| 0.24 | 模型针距比例 | 既有fallback展示直径 | 软件模板/线宽输入 | 软件值确定；实物纱径UNKNOWN | 本SOP两slot未配置实测直径 |
| ±0.12 | 模型针距 | 现有parallelOffset | 两等宽纱的中心位于总宽中心两侧半径处 | 软件推导确定；物理placement未标定 | 本SOP等宽两slot |
| 1e-5 | 模型针距 | 报告内端点诊断阈值 | 排除Float32/路径舍入噪声 | 诊断阈值；非允许实物间隙 | 所列捕获及连续性检查 |

**C-04 link1835/1837，row16、slot0、Feed1、同back、无共享CN**：原始和横列对齐路径不交，偏置后正式strip交一次。负偏置把1835向右上、1837向左上移动，原来分离的两条非相邻段相遇。固定法线位移不保证全局一一对应，现有实现未在此保持该关系。

[B数值证据](renderer-offset-root-cause.json)用现有sampler和原交叉函数细化：curveSteps24/96/384、spacing0.001时，offset0均0交点，−0.12均1，+0.12均0；覆盖A/B/C共27组。后两种控制只是归因实验，**没有把0或+0.12改进产品**。采样加密不能消除该交点。

## 4. 二维投影与绘制顺序

本管线没有空间视图矩阵产生的透视交叉；模型XY经缩放/平移成为画布XY。WebGL顶点shader把XY变换到clip坐标，z恒0。实际浏览器 `DEPTH_TEST=false`，有alpha blending及back/mid/front层；不能说“完全没有遮挡”。

同层按active ply→slot→link顺序绘制。C-04中1837后绘制覆盖1835，但该顺序未提供两段应当谁在上方的局部针织依据。翻面通过CSS镜像x、交换front/back z-index，**不反转同back内部的link顺序**。

Canvas与WebGL均消费已经相交的偏置路径；单纯调shader、抗锯齿、深度排序、线宽或截断下层线不能证明修正了错误。两后端存在线帽、三角条带及着色方面的已知实现差异，本轮没有对像素差异逐个归因；不能要求它们每个像素相同，也不能把像素差异当作新增中心线回归。

## 5. 穿插点分类

| 疑点/关系 | 最早可确认层 | 可确认事实 | 最终分类 |
|---|---|---|---|
| C-01 917/919、C-04 1835/1837 | 显示法线placement | 同slot/Feed/course非相邻段内部交叉；旧/当前相同 | 已有显示偏置缺陷候选，局部来源CONFIRMED；安全修正规则仍类型七 |
| A-1891/1949 | 原始XY | 不同Feed、相邻横列、同slot及CN，非数值共享端点 | 正常接触邻域或错误局部关系尚未区分；类型七 |
| 主纱/氨纶同link的重合与接触 | 原始/对齐参考路径 | 两slot共用成圈参考，显示后才分离 | 不能自动判物理碰撞；端点/同事件单列 |
| B/C不同Feed求解路径的远距离原始交点 | 未横列组装的模型工作坐标 | 对齐后相隔≥8行同slot扫描为0 | 不能用未组装坐标直接判物理跨周期错误 |
| 顶部/底部候选 | 基础路径或显示层 | 已单列采样和截图，边界初始化/截断不同 | 不能因位于边界自动放行；不能解释C-04 |

没有把正常圈柱、沉降弧、横列覆盖、共同成圈自动判错；也没有把“共享CN”当作所有交点合法的证书。没有发现连接索引/行顺序异常，但不能据此证明无拓扑错误。

## 6. 根因

**局部已确认：** 既有显示法线placement在C-01/C-04把不相交的参考路径变成二维自交。旧基线存在；当前指定SOP无几何回归。不是P0-C2放松长度×倍率派生、未填目标默认值、GPU或仅低精度采样导致。

**整体未确认：** 原始跨横列交点的预期局部上下关系、物理供纱连续身份、所有显示交点的正常/异常分类未建立。原始中心线完全正确、全部只是遮挡、已有偏移可通过一个常量修好，三者均未获证明。

## 7. 替代解释

- **新模式造成默认23/24：排除本例。** A/A-direct目标均为空，0求解结果且几何相同；倍率3是原包保留事实，不是默认补值。
- **新材料/companion改变几何：排除本fixture。** 两侧实际直径和所有坐标相同、companion关闭；不推广到其他资产。
- **旧求解缓存残留：本次独立simulate及已有生命周期validator不支持。** 本轮没有把新建simulate冒充真实UI C→Clear测试，沿用上一轮UI证据。
- **低采样/GPU精度独自造成：排除C-04。** 加密控制及两真实后端均保留；坐标误差不能解释有/无交点差异。
- **只在上下边界：排除。** C-04在中央完整周期。
- **所有共享CN交点都是合法连接端点：不成立。** 1891/1949不是数值共享端点。
- **偏置前连续所以偏置后连续：不成立。** 见第10节；不能再用原先未偏置的连续性检查代替实际strip检查。

## 8. 最小修复

**本轮业务修复为零，执行分支E停止规则。** 未做未经证据支持的参数/层级改动，也不把文案调整当作穿插修复。

最小缺失证据集中在现有局部事件，不要求新三维系统：

1. C-04在现有成圈事件内，两段属于该slot的哪条连续纱路、预期如何通过、谁在上方；必须能决定一个具体修正规则。
2. A-1891/1949共享CN接触邻域在原始XY相交时应有的上下关系，及其随B/C求解消失是否符合预期。
3. 候选修正同时保持slot身份、邻接段端点连接和合法共同成圈关系，并通过同样的A/B/C、内部/边界、正反面、双后端反例；不能只让C-04截图消失。

将偏置置零会令A双纱参考线重合；缩小或翻转偏置缺物理/拓扑依据；按后画顺序断线会把未知关系固化。上述选择均不能现在作为最小正确修复。未来若局部关系证据充分，修改应落在已有偏置/绘制authority，除非另有原始模板规则错误的直接证据。

## 9. 为什么没有新增模块

复用原 `yarnPathGeometry`、`yarnSimulation`、`drawYarnSimulation`、`yarnTextureBrush`、UV strip、sampler、端点函数和原交叉检测。新增内容仅是原报告目录内薄观察/汇总工具和证据。

新增正式src模块=NO；dependency=NO；Solver/M1/M2/M3=未改；Geometry formula=未改；Renderer=未改；Project format=未改；P0-C2数据合同与revision=未改；没有碰撞/松弛/新Store/新路径格式/第二套生成器或测试后门。

## 10. 修复前后证据

没有应用业务修复，因此只报告稳定失败复现和旧/当前对照，**没有修复后证据**。

| 固定link对 | A 原始/对齐/偏置 | B 原始/对齐/偏置 | C 原始/对齐/偏置 |
|---|---|---|---|
| 917/919 | 0 / 0 / 1 | 0 / 0 / 1 | 0 / 0 / 1 |
| 1835/1837 | 0 / 0 / 1 | 0 / 0 / 1 | 0 / 0 / 1 |
| 1891/1949 | 1 / 1 / 1 | 0 / 0 / 0 | 0 / 0 / 0 |

数值为现有检测器对精采样/正式strip的交点数。C-04正式A交点约 `(9.618306063,15.261442448)`（显示坐标/stitchWidth）；高精控制约`(9.618214873,15.260705115)`。旧/当前一致。

[C端点复核](root-cause-placement-continuity.json)：每slot4518个连续link配对中，正式偏置中心端点的4479个同横列和39个跨横列连接均超过1e-5诊断阈值；A最大约0.1957909模型单位，旧/当前完全一致。未偏置显示路径最大仅约1.64e-8。逐link法向不一致导致端点偏移不同；0.24线宽与圆端帽可能遮住间隙，故**不直接宣称物理断纱或可见空洞**。重新接上这些端点也不自动修复非相邻段C-04。

本轮阶段一复核命令为 `node reports/p0-c2-gated-verification-2026-10-20/root-cause-regression.mjs <外部旧worktree> --gate`，实际exit1；未填长度应为DESIGN_PREVIEW的断言实际得到INVALID，形成稳定失败用例。[闸门数据](root-cause-stage-1-gate.json)与[日志](root-cause-stage-1-gate.log)另外记录仍待独立分类的交点，不自动把交点判为物理错误，也不以零交点自动放行。它是报告内复核工具，不是产品后门。

## 11. Canvas/WebGL一致性

[浏览器观察服务](root-cause-browser-server.mjs)只在reports中，调用各版本正式simulate/draw，插入只读参数/调用计数观察；没有改src或拦截产品文件权限。真实浏览器驱动通过Cua执行，未用Node存根冒充浏览器。

旧/当前A × Canvas/WebGL × 正/反面共8组，以及当前B/C × 两后端 × 正/反面共8组，保存各自JSON及截图。每次Canvas实际9038次、GL为0；每次WebGL实际9038次、Canvas fallback为0，版本为`WebGL 1.0 (OpenGL ES 2.0 Chromium)`、三层`getError()`均0、depth test关闭。

同场景Canvas/WebGL的strip及绘制次序相同。旧/当前A在**相同后端、相同面**的三个图层像素哈希完全一致。两后端之间像素不相同，报告不声称像素级跨后端等价或正确物理遮挡。

为隔离几何和后端，真实浏览器报告页使用相同solid着色条件，显式调用既有GL分支；它证明真实浏览器WebGL管线可复现，未证明底层使用物理GPU而非软件实现，也不代替完整产品UI/PBR自动路由验收。上一轮产品UI截图继续作为原证据，不改名成GPU证明。

![旧基线 A Canvas 正面](root-cause-old-A-canvas-front.jpg)

![当前 A Canvas 正面](root-cause-current-A-canvas-front.jpg)

![当前 A WebGL 反面](root-cause-current-A-webgl-back.jpg)

截图初采的裁切/错标由C独立发现并重采；最终以文件内可见label/scene/backend/face及浏览器JSON核对。最终统计见 [浏览器汇总](root-cause-browser-summary.json)。

## 12. 未填纱长产品状态

实际结果：A=**INVALID**、A-direct=**DESIGN_PREVIEW**、B=**PARTIAL**、C=**VALIDATED**。最后一个仅现有模型窗口求解验证，绝非实机验证。

当前 `yarnSimulation.js` 将无有效值但仍处于`relaxedWithDraft`的slot放入requiredTargets，导致A从旧版DESIGN_PREVIEW变为INVALID。状态差异已定位，且不影响该场景几何。现有UI有未应用目标/基础预览及仅模型几何未经实机验证提示，但尚未完整达到本轮要求的“基础组织预览／尚未完成长度求解／几何未验证”和A=DESIGN_PREVIEW。

该产品要求明确记录为**未完成**。遵守整体证据不足时“不修改业务源码”的停止规则，本轮未调整状态选择或文案，未新增枚举，未默认填23/24/倍率，未把未填长度标为VALIDATED。

## 13. 数值回归

[本轮数值对照](root-cause-numeric-comparison.json)将当前B的8条、C的16条结果与上一轮冻结输出逐项严格相等比较：target、solved length、error、loopHeight、status、applied共24行均相同。C Feed1主纱目标23，结果`22.999920925128244`；第二纱8×3派生24，结果`24.000753567866827`，均与冻结值相等。完整8路结果无漂移。

23/8单位cm/100针、倍率3无量纲，来源既有SOP，24为现有Domain运行时派生，非新实测。适用状态、工艺测量限制沿用[SOP工艺合同](../spandex-process-contract-implementation-2026-10-20/SOP-001-process-contract.md)。本轮不改物性值或测量口径。

| 本轮命令 | 结果 |
|---|---|
| `npm run validate` | **41/41 PASS，exit0**；含原SOP/P0-C2、package、生命周期和长度回归 |
| `npm run build` | **PASS，exit0** |
| `git diff --check` | **PASS，exit0** |
| 原关系检查与新增raw-scope复算 | PASS（只表示观察/数据核对成功） |
| 偏置端点复核 | PASS（只表示复核成功，不代表连接几何通过） |
| 阶段一针对性闸门 | **BLOCKED，exit1** |

日志：[validate](root-cause-validate.log)、[build](root-cause-build.log)、[diff](root-cause-diff-check.log)。[保护检查](root-cause-preservation.json)记录1520个既有文件保持、102个src文件不变、无新增src/依赖、暂存区空。项目保存字段及原SOP包未改；没有把自动包验证当成阶段二真实往返。

## 14. 阶段一闸门结论

原A/B/C报告均保留初稿，只追加2026-10-21复核：[A几何](agents/geometry-topology-audit.md)、[B渲染](agents/renderer-layer-audit.md)、[C反方](agents/adversarial-review.md)。三者各自检查后均指出相同证据缺口，不用多数票替代证明。

回归归因已经得到明确答案；C-04偏置来源已经得到明确答案；所有交点的正确分类和可验证最小修复尚无充分依据。**按用户分支E停止。** 未进入阶段二；阶段二不是文件权限阻塞，未请求用户选文件。未进入阶段三，无最终放行，不commit/tag，不进入YarnTopology或三维。

```text
CROSSING_ROOT_CAUSE = UNRESOLVED
STAGE_1_CROSSING_GATE = BLOCKED
P0_C2_GATED_VERIFICATION = BLOCKED
BASELINE_SPANDEx_PROCESS_CONTRACT = NOT_CREATED
```

本轮停止在可复核的局部证据缺口，不以源头部分确认冒充修复完成。临时浏览器标签及5187/5188观察服务已关闭，浏览器临时视口覆盖已恢复；外部旧基线worktree留存用于复核。当前main/HEAD未变、暂存区为空，没有创建`baseline-spandex-process-contract`标签。
