# T6a 任务书：面料纹理第一版（普通纬平针；纱线 PBR 贴图与纱线毛羽）

> **给 Codex 的指令**：先读 `AGENTS.md`（含 §8）、`docs/NEXT_TASK.md`、`docs/ARCHITECTURE.md` 的 “Layer 3：fabricForm” 一节、`docs/ALGORITHM_DESIGN.md` §3 与“第 3 → 4 层接口”一段、`docs/ROADMAP.md` 主路线表，以及本文件全文。然后从第 6 节 T6a-0 开始，按顺序逐步执行。每步完成后按第 9 节写提交信息，推送 `origin main`。**T6a-1、T6a-2、T6a-3 完成后都必须停下，等架构师审查通过并经用户转达后再继续**（第 6 节写明）。遇到第 8 节任一停止条件，立即停下回报。不要跳步，也不要合并步骤。

- 起草：架构师（Claude），2026-11-28
- 执行：Codex
- 授权：用户于 2026-11-28 确认：目标“输入工艺、纱线参数和纱长，得出面料纹理”；纹理“软件内预览和导出贴图两者都要”；“先用普通纬平针打通链路”；“顺带把 PBR 的纱线贴图也弄出来，跟着纹理一起做”；“是带着纱线毛羽的那种 PBR”“我要那种毛茸茸的”“是跟纱线相关的毛茸茸感觉”
- 基线：`main` @ R4 收尾补记提交（若用户尚未转交该补记，则为 `3215687`）。开工前核对 HEAD 与 `git status`；本任务书文件本身及其 §10 的改动不计入“工作区干净”检查
- 仓库位置：`docs/T6A_FABRIC_TEXTURE_TASK.md`（T6a-0 时由 Codex 原样放入，若用户尚未放入）
- **本任务书是架构师意见的唯一版本。** 后续裁定经用户转达后，由 Codex 原文追加到 §10，再按其执行。

---

## 0. 一句话目标

打通“纱线参数 + 纱长 → 第 3 层平衡解 → 面料纹理”这条链，交付三样东西：

1. **面料纹理**：从 T1 普通纬平针的周期平衡解生成可无缝平铺、带真实毫米尺寸的贴图（工艺正面、反面各一套）；
2. **纱线 PBR 贴图上身**：把纱线库里该纱线的 PBR 贴图（颜色、法线、粗糙度、AO、金属度）按纱线实际弧长贴到三维纱线上；
3. **纱线毛羽（毛茸茸）**：毛羽是纱线自己的属性，来源可以是纱线扫描图里自带的毛羽，也可以按纱线毛羽参数生成（纤维 + 绒光晕）。同一套毛羽既进面料纹理，也用来导出**单根纱线的带毛羽 PBR 贴图**（可直接导入纱线库）。

既能用命令行导出，也能在软件里新开的“面料纹理”工作台中计算、预览和导出。这对应 `docs/ROADMAP.md` 主路线第 5 项 Physical UV、第 6 项 PBR，以及第 9 项 Fuzz 的最简形式。

**本任务不改第 3 层（`src/fabricForm/`）的任何文件**，不改求解结果，不做精度改进。纹理层只读第 3 层结果。

## 1. 背景与架构师预先核对（只读）

### 1.1 现状

- 第 3 层 T1 求解器（`solveFabricCell`）输出周期单元 `cell = { positions, W, H, S, topology }` 与 `metrics`（含 `waleDensityPerCm`、`courseDensityPerCm`、`gsm`）。T1 是单纱、全成圈、无摩擦的普通纬平针，单元为 m = n = 1。材料参数 `createFabricFormParams` 含纤维直径 `fiberDiameterMm`（默认 0.021 mm）和派生的有效直径 `d_e`。
- `src/` 中除 `src/fabricForm/` 自身外，没有任何文件引用 `src/fabricForm`。界面和 build 产物里都没有第 3 层求解器。
- 现有外观功能（PBR + 2.5D 工作台、扫描纱线纹理、纱线 PBR 贴图字段、Canvas/WebGL UV ribbon）是二维路径可视化，形状是画出来的，与第 3 层无关。本任务**不修改**它们，但沿用它们的数据与约定。架构师核对的现有能力（2026-11-28）：
  - **PBR 渲染**：`yarnUvWebglRenderer.js` 的着色器沿二维纱线路径贴 baseColor、normal、roughness、height、AO、metallic。它**不是完整的光照模型**：normal 只取 G 通道、height 只取 R 通道合成一个“起伏”量，乘以 `(1 − roughness)` 得到高光，再乘 AO；源码注释写明 “no new lighting/BRDF model”，`docs/DOMAIN_AUTHORITY.md` 也记为“渲染消费非完整物理 BRDF”。
  - **毛羽**：纱线已有属性“毛羽强度” `fuzzStrength`（0～1，默认 0.45，纱线面板可调，`resolveYarnMaterial` 返回的 `texture.fuzzStrength`）。Canvas 路径把它画成一圈加宽 `1 + 0.45·f`、不透明度 `0.18·f` 的半透明描边；WebGL 路径用它柔化纱线边缘的透明度。没有纤维级毛羽。
  - **三维几何**：2026-11-21 已移除（`yarnSpatial*`、`yarnTubeGeometry`、三维渲染器与相机），目前没有任何三维纱线渲染、面料贴图烘焙或贴图导出。
  - 所以本任务新增的是：三维纱线（来自第 3 层）上的贴图烘焙、导出和纤维级毛羽；纱线材料、贴图识别、V 范围和毛羽强度都沿用现有定义。
- 依赖中已有 `@zip.js/zip.js`（界面导出 zip 用）。PNG 编解码不新增依赖。

### 1.2 几何烘焙原型（架构师 numpy 一次性脚本，不入仓库）

用 `docs/archive/t1-slope-closeout-2026-11-23/` 的平衡解做了“沿中心线扫掠 + 俯视取最高面”的烘焙原型：

1. **正反面方向**（hossain-2.84）：线圈腿节点平均 z = −0.093 mm，线圈顶部与沉降弧节点平均 z = +0.066 mm。所以**从 −z 方向看是工艺正面**（看到线圈腿），**从 +z 方向看是工艺反面**。俯视可见像素中属于“线圈腿节点”的比例：hossain-2.84 正面 0.651、反面 0.034；case-4-N48 正面 0.583、反面 0.212。
2. **无接缝**：按晶格周期卷绕后，4×4 平铺看不到接缝。
3. **样条长度**：向心 Catmull–Rom 插值后 hossain-2.84 样条全长 2.8426 mm，比纱长 2.84 mm 多 0.09%。
4. **剪切**：7 组平衡解的 |S| 都不超过 6.5×10⁻⁸ mm。
5. **覆盖率**：92.7%（hossain-2.84）、71.4%（case-4-N48）。
6. **原型的不足**：用离散球近似纱管时，轮廓边缘高度误差可达半径的约 4%；直接用球心指向像素的向量作法线会出现细条纹。正式做法见 §3.3 第 3、4 条（胶囊体解析求交；法线去掉沿纱切向分量）。胶囊体求交公式架构师已用 2000 组随机构型对暴力搜索核对，差值等于搜索步长 1e-5。

### 1.3 纱线 PBR 贴图现状（架构师核对）

1. **数据**：纱线资产的 `pbr` 可含 `baseColor`、`normal`、`roughness`、`height`、`ambientOcclusion`、`metallic` 和 `physicalRepeatLengthMm`。统一入口是 `src/domain/yarnMaterial.js` 的 `resolveYarnMaterial`，图片资源在 `yarnAssetRegistry`。导入时按文件名识别贴图类型（`identifyPbrMap`：BaseColor/Albedo、Normal、Roughness、Height、AO/AmbientOcclusion、Metallic）。
2. **现有二维渲染器的贴图约定**（`yarnUvWebglRenderer.js`、`yarnPathUvStrip.js`）：图像横向（列）沿纱线方向（U），纵向（行）横跨纱线（V）。V 只用贴图中纱线所在的一段 `[vMin, vMax]`，由 `findYarnTextureVRange` 按 baseColor 的 alpha 找出（保留 99.9% 的 alpha 质量，再两侧各加 10%），没有 alpha 或找不到单一纱线带时为 `[0, 1]`。U = 弧长（mm）÷ `physicalRepeatLengthMm`。
3. **样例一**：`public/current-SOP.knitscape`（zip）里有 Yarn_A_Cotton_Blue、Yarn_B_Polyester_Orange 两种纱线，各有 baseColor（RGB）、normal（RGB）、roughness、height、ambientOcclusion（灰度）五张 512×512 PNG，都没有 `physicalRepeatLengthMm`。这两套是可平铺的斜向捻纹材质，法线逐行平均几乎一致（z ≈ 0.84），不含截面明暗；首尾行、首尾列法线明显偏斜（z ≈ 0.41～0.58），说明它们在边界处不连续。
4. **样例二（带毛羽的扫描）**：`public/materials/white-gray-yarn/` 有 `yarn_basecolor_alpha.png`（2172×724，RGBA，纱线横放，背景透明，上下有毛羽）和 `yarn_roughness.png`（2172×724，灰度）。按行平均 alpha：不低于最大值 50% 的行在 0.435～0.581（纱芯），不低于 1% 的行在 0.402～0.615，零星长毛羽伸得更远。两张图都用了 PNG 过滤类型 1～4。
5. **贴图上身原型**：把样例一贴到 hossain-2.84 的纱管上，纹理细节跟随三维纱线走向，方向正确。
6. **真实 SOP 纱线的记录**（`docs/DOMAIN_AUTHORITY.md`）：`PBR/Yarn1` 有 Albedo、Normal、Roughness、AO、Metallic 五张 2172×724 PNG；物理重复长度 22.987 mm 是按 2400 DPI 推算的，只在原图未重采样、DPI 为真实采集 DPI 时成立；“PBR 可见宽度 ≠ 纱线直径”。样例二的尺寸与它相同。按 22.987 mm 计，这类图的纱芯宽约 1.1 mm，而模型 d_e 约 0.2 mm，二者不一致。所以纱芯映射到 d_e 时，贴图在纱线上会被横向压缩，需要报告各向异性（§3.5.5），不能用贴图宽度去改纱线直径。

### 1.4 毛羽原型（架构师核对）

1. **扫描毛羽**：把样例二的纱芯行映射到纱管直径，纱芯以外的行映射到纱管两侧，按“像素到投影中心线的最近点”定位，画成位于纱线轴线高度的半透明层。用整张扫描的毛羽范围时，case-4-N48 正面有 5.6% 的像素出现可见毛羽。这张样例的毛羽本身稀疏，效果偏淡。曾按采样点切条带定位毛羽，弯曲处外侧会出现梳齿状漏缝，改用最近点后消失。
2. **生成毛羽**：按毛羽指数 H（毛羽总长 ÷ 纱线长度，含义同 Uster H）在一圈纱线上随机长出纤维：根部均匀分布在纱管表面，方向与纱线切向成约 30°，长度服从对数正态分布，带随机卷曲；纤维直径取材料参数 0.021 mm；另加纱管两侧随距离衰减、沿纱方向有条纹的绒光晕。H = 8～10、平均毛长 0.3 mm 时，线圈空隙里能看到柔软的绒光晕和细纤维，呈毛茸茸效果。
3. **两条教训**：
   - 每根纤维如果按点逐个叠加，同一根纤维会在自身重叠处累积透明度，出现虚线状条纹。正确做法是每根纤维先算出每个像素到整根纤维的最近距离，得到一个覆盖率，再整体合成一次。
   - 纤维不透明度过高（0.7）或平均毛长过长（0.6 mm）会像一根根面条；不透明度约 0.45、横截面柔化、平均毛长 0.3 mm 观感合适。
4. **实现注意**：毛羽伸出范围可能超过半个单元。原型用取模后的下标数组一次写入，重复下标互相覆盖、出了错。正式实现必须逐个周期像处理。

## 2. 范围

### 2.1 允许新增或修改

- 新目录 `src/fabricTexture/`：纹理层的全部计算、编码、元数据和 Worker。
- 新文件 `scripts/bake-fabric-texture.mjs`（命令行）；新检查脚本 `scripts/validate-fabric-texture.mjs` 及其 `scripts/lib/` 下的辅助模块（包括命令行用的 PNG 解码器，可以用 `node:zlib`）。
- `package.json`：只新增 `"validate:fabric-texture"` 和 `"bake:fabric-texture"` 两个脚本项。validate 项数由 50 变为 51。
- 只读调用现有纱线材料代码：界面可以调用 `resolveYarnMaterial`、`yarnAssetRegistry`、`loadImageFromDataUrl`、`findYarnTextureVRange`。命令行和检查脚本：
  - `identifyPbrMap`（`src/yarnTexture/yarnScanTexture.js`）可以直接导入（架构师已在纯 Node 中验证）；
  - `findYarnTextureVRange`（`src/simulation/yarnUvWebglRenderer.js`）**不能用纯 Node 直接导入**：它的依赖 `yarnTextureBrush.js` 里有一处不带 `.js` 扩展名的 import，只能经 Vite 解析。必须照 `scripts/validate-path-uv-yarn-texture.mjs` 的做法，用 Vite 的 `createServer` 加 `ssrLoadModule` 载入；**不得复制它的实现**，也不得修改原模块。
  - `src/fabricTexture/` 的共享模块不导入它们，所需数据（解码后的像素、V 范围）由调用方传入。
- 界面（仅 T6a-3）：新增 `src/views/fabricTextureWorkbench.js`；为新工作台模式在 `src/state.js`、`src/views/taskbar.js`、`src/views/view.js` 中做**最小增量**修改；可在 `styles.css` 末尾追加该工作台的样式。
- 新归档目录 `docs/archive/t6a-fabric-texture-2026-11-28/`（审查用图与汇总 JSON）。
- 文档（仅 T6a-0、T6a-4）：本任务书（含 §10）、`docs/NEXT_TASK.md`、`docs/ARCHITECTURE.md`（新增一节 “Layer 4：fabricTexture”）。

### 2.2 禁止

1. 不改 `src/fabricForm/` 下任何文件；不改金标准基线、`docs/archive/t1-slope-closeout-2026-11-23/`、R2/R3 研究脚本与 summary。纹理层只能调用第 3 层的公开函数（`solveFabricCell`、`createPlainJerseyTopology`、`createFabricFormParams`、`actualEdgeVector` 等），不得复制或改写其中的物理计算。
2. 不在渲染层移动 T1 节点：样条必须精确通过每个节点（§3.2）。
3. 不改二维仿真、PBR + 2.5D 工作台、纱线库、纱线材料与贴图代码（`yarnMaterial.js`、`yarnScanTexture.js`、`yarnAssetRegistry.js`、`yarnTextureBrush.js`、`yarnUvWebglRenderer.js`、`yarnPathUvStrip.js`）、项目 JSON 格式与持久化。纹理工作台的输入、毛羽参数和结果**不写入项目文件**，也不写入纱线库（存入纱线库是后续任务）。
4. 不新增依赖。
5. 不放宽、不删除任何现有检查断言。若现有界面检查因新增工作台模式而失败，只能在不改变原断言语义的前提下补充；必须修改原断言时，按 §8 #5 停止。
6. 不改 `docs/KnitScape_当前功能与算法.md`（validate 会检查它的章节标题），不在仓库根目录新增文件或目录。
7. 不做截面压扁、悬垂、三角网格导出、U3M 导出；不做集圈、氨纶、多纱；不做捻度条纹等纤维级几何（纱芯细节只来自纱线贴图）。

## 3. 设计（字段名可调整，语义必须齐全并写进 JSDoc）

### 3.1 模块划分（`src/fabricTexture/`）

| 模块 | 职责 |
|---|---|
| `centerline.js` | 由 `cell` 构造展开后的周期纱线中心线：节点链、向心 Catmull–Rom 样条、密采样点、切向、弧长；也能构造合成的直纱中心线（§3.7） |
| `bakeGeometry.js` | 对一个面做俯视烘焙：纱芯的高度、法线、覆盖、弧长、横向坐标和诊断量 |
| `yarnMaterial.js` | 规范化“已解码的纱线材料”，算纱芯带与毛羽带、去除截面轮廓后的法线细节表和 AO 比值表，提供双线性采样 |
| `yarnFuzz.js` | 毛羽：扫描毛羽层（§3.6.2）、生成纤维与绒光晕（§3.6.3），输出每像素的半透明片段 |
| `ambientOcclusion.js` | 在周期高度场上计算 AO |
| `composeMaps.js` | 纱芯与毛羽片段合成为各张贴图的像素数据 |
| `png.js` | 纯 JS 的 PNG 编码器（8 位灰度、RGB、RGBA，16 位灰度），压缩用 `CompressionStream("deflate")` |
| `metadata.js` | 生成 `metadata.json` |
| `fabricTexturePipeline.js` | 命令行与界面共用的入口：（可选）求解 → 两面烘焙 → 毛羽 → 合成 → 编码；以及单根纱线 PBR 贴图的生成（§3.7） |
| `fabricTextureWorker.js` | 界面用的模块 Worker（T6a-3） |

除 `fabricTextureWorker.js` 外，所有模块必须同时能在 Node 20 和浏览器中运行：不得导入 `node:` 模块，不得使用 DOM。文件读写、`node:zlib` 只能出现在 `scripts/` 下。所有随机数用带种子的确定性伪随机数（例如 mulberry32），不得使用 `Math.random`。

### 3.2 中心线

1. 节点链：从第一条边的起点出发，按 `topology.yarns[0].edgeIndices` 的材料顺序，用第 3 层导出的 `actualEdgeVector(cell, edge)` 逐段累加，展开成连续曲线；一圈结束后的整体平移量记为周期位移 `D`（T1 中为 `a1 = (W, 0, 0)`，在诊断中报告）。T1 只有一根纱；遇到多根纱或非 T1 拓扑时报错。
2. 插值：向心 Catmull–Rom（α = 0.5），首尾用周期位移补齐，样条**精确通过每个节点**。
3. 采样：每段按弦长均匀细分，相邻采样点距离不超过 `r / 12`，`r = d_e / 2`。
4. 报告：一圈样条全长 `L_s`、相对纱长的偏差、样条与节点折线之间的最大距离。只报告，不设门槛。

### 3.3 几何烘焙（胶囊体求交 + 俯视取最高面）

1. **面与视角**：
   - 工艺反面 `technicalBack`：从 +z 看，坐标不变；
   - 工艺正面 `technicalFace`：先把几何绕 y 轴转 180°（`(x, y, z) → (−x, y, −z)`），再从 +z 看。
   - 两面都保持 y 轴向上（横列方向向上），所以反面图与正面图左右互为镜像，这是“各自从该面看”的正确方向。
2. **像素网格**：给定 `pxPerMm`，`nx = round(W·pxPerMm)`，`ny = round(H·pxPerMm)`；像素尺寸 `dx = W/nx`、`dy = H/ny`；像素中心在 `((i+0.5)dx, (j+0.5)dy)`。图像第 0 行对应 y 最大处（+y 向上）。
3. **纱芯高度（精确求交）**：纱芯取“密采样折线每一段为轴、半径 `r = d_e/2` 的胶囊体”之并，截面为直径 d_e 的圆。对每个像素的竖直线 `P(z) = (x, y, z)` 解析求最高交点：
   - 圆柱部分：段起点 A、单位方向 t、段长 L，`w0 = (x − A_x, y − A_y, 0)`。解 `a·z′² + b·z′ + c = 0`，其中 `a = 1 − t_z²`，`b = −2·t_z·(w0·t)`，`c = |w0|² − (w0·t)² − r²`，`z′ = z − A_z`，取较大根；仅当投影参数 `τ = w0·t + z′·t_z` 在 `[0, L]` 内时有效。
   - 端部：每个采样点处的球 `z_c + sqrt(r² − Δx² − Δy²)`。
   - 取所有有效候选中的最大值。
   - **周期**：x 对 W、y 对 H 周期。影响范围（纱芯半径或 §3.6 的毛羽范围）可能超过半个单元，所以必须逐个列举与单元相交的周期像（平移 `i·W`、`j·H`）分别计算后取最大，不能用取模后的下标数组一次写入。
   - `|S| ≤ 1e-6·W` 时按 S = 0 处理（实际 S 写进元数据）；`|S| > 1e-6·W` 时不烘焙，按 §8 #4 停止。
4. **纱芯法线**：设 `v = P − Q`，Q 为获胜候选在轴上的最近点（圆柱部分为 A + τt，端部为球心）。切向 `t_s` 取该段两端样条切向按 τ/L 线性插值后归一化（端部取该采样点的样条切向）。几何法线 `N = normalize(v − (v·t_s)·t_s)`。**不要**直接用 `v/r`。
5. **记录**：每个像素记录是否有纱芯、高度（mm）、几何法线 N、切向 `t_s`、弧长 `s = 采样点弧长 + τ`（连续）、横向坐标 `w = (v·b)/r`（`b = normalize(t_s × e_z)`，在该面的视角坐标中计算，w ∈ [−1, 1]）、获胜位置所属节点号。
6. **诊断量**：覆盖率；“线圈腿占比”：按展开后节点链的 y 坐标，把每圈节点分为中段 50%（腿）和上下各 25%（顶部和沉降弧），统计纱芯像素中获胜节点属于“腿”的比例。

### 3.4 AO

在纱芯高度场上计算（周期卷绕）：16 个等分方向，每个方向按像素步长前进到 `2·d_e`，取最大仰角 α；`AO = 1 − (1/16)·Σ sin(max(0, α))`。没有纱芯的像素高度按 `heightMin − d_e` 参与遮挡计算，自身 AO 记为 0。只对一个单元计算，平铺时直接复制。毛羽不参与 AO 计算（§3.6.4 规定毛羽片段的 AO）。

### 3.5 纱线 PBR 贴图上身

#### 3.5.1 纱线材料输入

纹理层内的纱线材料是一个纯数据对象：颜色（CSS 颜色字符串或十六进制）、可选的各张贴图（已解码 `{ width, height, channels, data }`，8 位）、可选的 `physicalRepeatLengthMm`、法线绿通道约定 `normalGreen ∈ {"+Y", "-Y"}`（默认 `"+Y"`，即 OpenGL）。没有任何贴图时就是纯色纱线。

- 界面：从所选纱线资产经 `resolveYarnMaterial` 取得颜色和贴图来源，用现有的图片加载函数解码为 ImageData。
- 命令行：用 `--yarn-base-color`、`--yarn-normal`、`--yarn-roughness`、`--yarn-ao`、`--yarn-metallic` 分别给出 PNG 文件（任意子集）。只支持 8 位 PNG（灰度、灰度+alpha、RGB、RGBA，不隔行，过滤类型 0～4 都要支持），其他格式报错退出。

#### 3.5.2 纱芯带与毛羽带

- **纱芯带** `[cMin, cMax]`：baseColor 有 alpha 时，取按行平均 alpha 不低于其最大值 50% 的行范围；没有 baseColor 或没有 alpha 时为 `[0, 1]`。纱芯带映射到纱管直径。
- **毛羽带**（只有 baseColor 有 alpha 时存在）：
  - `vRange` 模式：与二维渲染器一致，取 `findYarnTextureVRange(baseColor)` 的结果（界面直接调用；命令行按 §2.1 经 Vite 载入）；
  - `fullScan` 模式（默认）：取按行平均 alpha 不低于其最大值 0.1% 的行范围，保留零星长毛羽。
  - 毛羽带半宽换算成纱管半径的倍数 `ρ = max(c − hMin, hMax − c) / h_c`，其中 `c = (cMin + cMax)/2`、`h_c = (cMax − cMin)/2`。ρ 上限为 8（超过时截断，写进元数据）。

#### 3.5.3 纱线贴图坐标（Physical UV）

与现有二维渲染器一致：图像列方向沿纱线（U），行方向横跨纱线（V），第 0 行在图像顶部。

- 纱芯上：`v_img = c + h_c·w`；毛羽上：`v_img = c + h_c·(δ/r)`（δ 见 §3.6.2，带符号）。
- `u = s / L_rep'`，s 为连续弧长，`L_rep' = L_s / max(1, round(L_s / L_rep))`。用 `L_s`（一圈样条全长）而不是纱长 l：两者差约 0.1%，用 l 会在线圈首尾相接处留下接缝。这样每个线圈首尾相接处贴图连续，整张面料贴图仍严格周期。
- `L_rep` 的来源：纱线有 `physicalRepeatLengthMm` 时用它（来源记为 `ASSET`）；没有时按贴图像素等比例推算 `L_rep = d_e · W_img / (H_img · (cMax − cMin))`，让纱芯部分的贴图像素在纱线上保持方形（来源记为 `DERIVED_FROM_ASPECT`）。
- 采样：双线性插值，U 方向循环，V 方向截断。
- baseColor 在纱芯上有 alpha 时：`颜色 = a·rgb + (1 − a)·纱芯平均色`。纱芯平均色指纱芯带内按 alpha 加权的平均 RGB；没有 baseColor 时用纱线颜色。

#### 3.5.4 法线和 AO 细节（去掉截面轮廓后叠加）

纱线贴图可能是俯视平放纱线拍出来的，自带圆柱截面的明暗；纱管几何已经有截面，直接叠加会重复计算。所以先去掉每一行的平均截面轮廓，只保留沿纱方向变化的细节（捻纹、纤维）：

- **法线细节**：解码 `n_tex = 2·rgb/255 − 1`（`normalGreen = "-Y"` 时 G 取反）。每一行求所有列的平均向量并归一化，得到该行轮廓 `p(v)`；用把 `p(v)` 转到 +z 的最小旋转 `R_v` 得到细节 `d = R_v · n_tex`。预先按行算好细节表。
- **叠加到纱芯**：T = `t_s`（弧长增加方向），N = 几何法线，`B_w` = 切平面内 w 增加的方向（`b` 去掉沿 N、T 的分量后归一化），图像“上”方向 `U_img = −B_w`。最终法线 `n = normalize(d.x·T + d.y·U_img + d.z·N)`。没有法线图时 n = N。
- **AO 细节**：`ao_d = clamp(ao_tex / 行平均(ao_tex), 0, 1)`，与几何 AO 相乘。没有 AO 图时为 1。
- **纱线 height 图第一版不用**：它没有物理尺度，ROADMAP 的 PBR 阶段也只列了 Albedo、Normal、Roughness、AO、Metallic。元数据里写明“未使用”。

#### 3.5.5 只报告的诊断

- 每张纱线贴图的边界连续性：首末两列像素差的平均值与内部相邻列像素差的平均值对比；行方向同样。
- 法线截面轮廓强度：各行平均法线与 +z 的最大夹角。
- 纱芯带、毛羽带、ρ。
- 贴图在纱线上的各向异性：`(L_rep'/W_img) ÷ (d_e/(H_img·(cMax − cMin)))`，即沿纱方向每像素毫米数与横向每像素毫米数之比。大于 2 或小于 0.5 时，界面显示提示“纱线贴图的物理尺度与模型纱线直径不一致”，元数据照实记录；不据此修改 d_e 或 `L_rep`。

### 3.6 纱线毛羽

#### 3.6.1 毛羽是纱线属性

毛羽参数作为“所选纱线的毛羽属性”，在命令行和界面中输入，随导出的元数据记录在纱线名下（第一版不写回纱线库）。`fuzzSource ∈ {"off", "scan", "generated", "both"}`：

- `scan`：只用扫描图自带的毛羽（§3.6.2），要求 baseColor 有 alpha，否则报错；
- `generated`：按参数生成纤维与绒光晕（§3.6.3），纱芯仍按 §3.5 贴纱线贴图；
- `both`：扫描毛羽与生成毛羽同时使用，要求 baseColor 有 alpha；
- `off`：无毛羽。
- 默认：baseColor 有 alpha 时为 `both`，否则为 `generated`。毛羽强度 f = 0 时生成部分自动没有纤维和光晕。

生成毛羽的参数（全部是外观假设，元数据标 `ASSUMPTION`；括号内为默认值）：

| 参数 | 含义 |
|---|---|
| `hairinessIndex`（8） | 毛羽指数 H：伸出纱芯的纤维总长 ÷ 纱线长度，含义同 Uster H |
| `meanHairLengthMm`（0.3） | 伸出部分的平均长度；长度服从对数正态分布，`σ = 0.5`，对数均值取 `ln(mean) − σ²/2` |
| `hairAngleDeg`（30） | 纤维与纱线切向的平均夹角；正态分布，标准差 12°，截断到 [5°, 80°] |
| `maxCurvaturePerMm`（6） | 卷曲曲率在 `[0, 最大值]` 内均匀分布，绕垂直于初始方向的随机轴等曲率弯曲 |
| `fiberOpacity`（0.45） | 单根纤维中心线处的不透明度 |
| `haloStrength`（0.6） | 绒光晕在纱芯表面处的不透明度 |
| `haloWidthR`（0.6） | 绒光晕的衰减长度，以纱芯半径 r 为单位 |
| `seed`（1） | 随机种子 |

纤维直径取材料参数 `fiberDiameterMm`（不另设参数）。

**与现有“毛羽强度”挂钩**：纱线已有的 `fuzzStrength`（f，0～1）是这根纱线毛茸茸程度的现有记录，生成毛羽的两项主参数默认由它决定：`hairinessIndex = 16·f`，`haloStrength = f`（f 默认 0.45 时 H = 7.2、光晕 0.45）；其余参数取上表默认值。用户在纹理工作台或命令行显式给出的参数优先，元数据分别记录“来自纱线毛羽强度”或“手动设定”。界面另给“低 / 中 / 高”三档快捷设置，对应 f = 0.25 / 0.5 / 1.0。纹理工作台里的调整不写回纱线（§2.2 #3）。

#### 3.6.2 扫描毛羽层

在该面的视角坐标中，把每一段中心线投影到 xy 平面。对每个像素求到每段投影线段的最近点（参数 τ 截断在 `[0, 1]`），得到投影距离 δ（带符号：与 `b` 同向为正）、弧长 s（段起点弧长 + τ·段长）、轴线高度 `z_axis`（按 τ 线性插值）。若 `r < |δ| ≤ ρ·r`，按 §3.5.3 采样 baseColor 得到毛羽颜色和 alpha（同样采样 roughness、metallic），alpha ≥ 1/255 时成为候选（z = `z_axis`）。同一段纱线的相邻小段会对同一像素给出几乎相同的候选，所以**每个像素只保留 z 最高的一个扫描毛羽片段**，否则 alpha 会重复累积。

#### 3.6.3 生成毛羽

在一圈纱线的材料坐标上生成，所以天然周期：

1. **纤维数**：`n_f = round(H · L_s / meanHairLengthMm)`。
2. **每根纤维**：根部弧长 s₀ 在 `[0, L_s)` 均匀分布；绕纱线的方位角 θ 在 `[0, 2π)` 均匀分布；根部点 = 样条点 + r·径向单位向量（径向由切向和任意固定参考向量构成的正交框架给出，在合成坐标中计算，不依赖视角）；初始方向 = `cos φ·(±t) + sin φ·径向`，φ 按上表分布，正负号各半；长度按上表分布；沿长度每步前进纤维半径 `r_f = fiberDiameterMm/2`，方向按曲率 κ 绕随机轴旋转。
3. **渲染**：每根纤维变换到该面视角后，**整根一次计算**：每个像素到整根纤维投影折线的最近距离 d、最近点处纤维的 z 与切向；覆盖率 `α = fiberOpacity · exp(−½·(d / (0.8·r_f))²)`，只在 `d ≤ 3·r_f` 的像素生成片段。**同一根纤维对同一像素只产生一个片段**，不得逐点累加。
4. **绒光晕**：与扫描毛羽层同样求最近点和 δ；在 `r < |δ| < r·(1 + 4·haloWidthR)` 内，`α = haloStrength · exp(−(|δ| − r)/(haloWidthR·r)) · (0.4 + 0.6·ν)`。ν 是由种子决定的确定性值噪声，沿弧长方向的条纹宽度约为一个纤维直径，横向随 δ 缓慢变化。每个像素只保留 z 最高的一个光晕片段。
5. **颜色与材质**：纤维和光晕的颜色 = 纱芯平均色 × 每根纤维的亮度系数（[0.85, 1.15] 均匀分布；光晕取 1）；粗糙度取纱线 roughness 图的平均值（没有时 0.8）；金属度取 metallic 图的平均值（没有时 0）。

#### 3.6.4 片段合成

- 每个像素收集 z 高于该像素纱芯表面的毛羽片段（没有纱芯时收集全部），按 z 从高到低最多保留 8 个，再从低到高用 “over” 合成到纱芯（或空白）之上。
- 各通道合成规则：
  - baseColor：按 over 合成片段颜色（不含光照）；
  - opacity：有纱芯为 1；否则 `1 − Π(1 − α_i)`。只有毛羽的像素，baseColor 写毛羽合成颜色（不预乘）；
  - normal：纤维片段法线 = `normalize(e_z − (e_z·t_f)·t_f)`（t_f 为纤维切向；该向量长度小于 1e-6 时取 e_z），光晕和扫描毛羽片段法线 = e_z；与纱芯法线按 α 加权后归一化；
  - roughness、metallic：按 α 加权；
  - AO：毛羽片段的 AO 取 1，与下层按 α 混合；
  - height：**只来自纱芯**，毛羽不改变高度图。
- 毛羽的影响范围（纤维长度、ρ·r、光晕宽度）可能超过半个单元，必须按 §3.3 第 3 条逐个周期像处理。

### 3.7 单根纱线 PBR 贴图（带毛羽）

用同一套纱线材料和毛羽参数，烘焙一段**直纱**，导出成纱线库能直接导入的 PBR 贴图：

- 合成中心线：沿 +x 的直线，z = 0，长度 `L_strip`（默认 4 mm，可调）。U 方向周期（纱芯与毛羽都按 x 周期 `L_strip` 生成和渲染；纤维数按 `round(H · L_strip / meanHairLengthMm)`），V 方向不周期。
- 视角：从 +z 看。图像宽 `round(L_strip·pxPerMm)`。内容高度 = `d_e + 2·伸出范围`，伸出范围取扫描毛羽 `ρ·r`、光晕 `r·(1 + 4·haloWidthR)` 与生成纤维实际最远伸出量三者中的最大值，再加 2 个像素。**图像总高取内容高度的 3 倍，内容居中，上下全透明**。原因：现有 `findYarnTextureVRange` 在纱线带占图高一半以上或贴到图边时会退回 `[0, 1]`；架构师用该函数测过，上下不留或只留少量透明边时都退回 `[0, 1]`，总高取 3 倍时能找到正常的纱线带。
- `L_rep'` 取 `L_strip / max(1, round(L_strip / L_rep))`，保证纱线贴图在 U 方向无缝。
- 输出（文件名必须能被 `identifyPbrMap` 识别）：`<prefix>_yarn_baseColor.png`（RGBA，alpha 为 §3.6.4 的 opacity）、`<prefix>_yarn_normal.png`、`<prefix>_yarn_roughness.png`、`<prefix>_yarn_height.png`（8 位灰度，纱芯高度归一化，毛羽处为 0）、`<prefix>_yarn_ambientOcclusion.png`，纱线有 metallic 图时加 `<prefix>_yarn_metallic.png`；以及 `<prefix>_yarn_metadata.json`。元数据里写明 `physicalRepeatLengthMm = L_strip`，并用一句话说明：导入纱线库后，在该纱线的“物理重复长度”里填这个值。
- 这样导出的纱线贴图，在默认和中档毛羽下，按现有规则 `findYarnTextureVRange` 能找到单一纱线带，二维预览可以直接使用；长纤维很多时可能退回 `[0, 1]`，处理方式见 §4.1 (r)。

### 3.8 面料贴图输出

| 贴图 | 格式 | 内容 |
|---|---|---|
| `baseColor` | RGB 8 位，sRGB | 纱芯按 §3.5 采样，再按 §3.6.4 合成毛羽；完全空白处为黑色 |
| `opacity` | 灰度 8 位 | §3.6.4；第一版纱芯边缘不做抗锯齿 |
| `normal` | RGB 8 位 | 切线空间，OpenGL 约定（+Y 为图像向上），`RGB = round((0.5·n + 0.5)·255)`；完全空白处为 (128, 128, 255) |
| `height` | 灰度 16 位 | `0 → heightMinMm`，`65535 → heightMaxMm`（纱芯像素的最小、最大高度）；只来自纱芯；没有纱芯处为 0 |
| `ambientOcclusion` | 灰度 8 位 | 几何 AO × 纱线 AO 细节，再按 §3.6.4 合成毛羽；完全空白处为 0 |
| `roughness` | 灰度 8 位 | 采样纱线 roughness（没有时 0.8，ASSUMPTION），再合成毛羽；完全空白处为 255 |
| `metallic` | 灰度 8 位 | **仅当纱线有 metallic 图时输出** |

平铺导出：可选 `repeat = [kx, ky]`（正整数，默认 [1, 1]），把单元贴图整数次复制成更大的图，物理尺寸为 `kx·W × ky·H`。

文件名：`<prefix>_<face>_<map>.png`，`face ∈ {technicalFace, technicalBack}`；元数据为 `<prefix>_metadata.json`。

### 3.9 PNG 编码

纯 JS 实现：IHDR、IDAT、IEND，CRC32，过滤类型统一为 0；压缩用 `CompressionStream("deflate")`（zlib 格式，Node 20 与浏览器都内置）。支持 8 位灰度、RGB、RGBA 和 16 位灰度（大端）。同一输入两次编码字节完全相同。

### 3.10 元数据（面料与纱线各一份，至少包含）

- `schemaVersion`、生成器名与版本（命令行写 git HEAD；界面写应用版本或 `"app"`）、生成时间；
- 结构：`plainJersey`，m、n（纱线贴图写 `straightYarnStrip` 和 `L_strip`）；
- 输入：纱长、每圈节点数、六项材料参数及其 provenance（原样取自 `createFabricFormParams`）；
- 求解：`status`、`optimizerStatus`、迭代数、W、H、S、`waleDensityPerCm`、`courseDensityPerCm`、`gsm`（原样取自结果）；来自已有结果文件时写明文件名；
- 贴图：单元数 `[kx, ky]`、物理尺寸（mm）、像素数、x/y 实际 px/mm；
- 约定：两面的视角定义、法线约定、图像方向、高度编码与 `heightMinMm`/`heightMaxMm`；
- 纱线材料：纱线名称与 id（界面）或文件路径（命令行）、颜色、用了哪几张纱线贴图（及“height 未使用”）、各贴图像素尺寸、纱芯带、毛羽带模式与范围、ρ、`L_rep` 及其来源、`L_rep'`、`normalGreen`、粗糙度来源、§3.5.5 的诊断；
- 毛羽：`fuzzSource`、全部生成参数与种子、纤维数、纤维直径、毛羽像素占比；
- 渲染模型：圆截面直径 d_e、中心线插值方式、采样间距、样条与折线最大距离、AO 参数；
- 诊断：两面的覆盖率与线圈腿占比；
- `limitations`（固定文字，界面同样显示）：
  1. 仅普通纬平针、单纱、全成圈（T1），无集圈、无氨纶；
  2. 线圈尺寸是未标定预测：与 Hossain 2025 对照，横密偏高约 6%–14%、纵密偏高约 10%–12%；纱长变化时尺寸变化偏小；
  3. 纱芯截面按直径 d_e 的圆处理，相邻纱线在模型里有轻微重叠，贴图按俯视最高面合并；
  4. 纱线 PBR 贴图沿纱长的重复长度略作调整，使每个线圈恰好重复整数次；纱线 height 图未使用；
  5. 毛羽是外观模型：生成毛羽的参数是假设值，不是实测；毛羽不改变高度图，也不参与受力；
  6. 材料参数默认值是假设值，不是实测。

### 3.11 命令行 `npm run bake:fabric-texture -- ...`

- 面料输入二选一：
  - `--from-result <求解结果 JSON>`：直接用已有平衡解，不求解；
  - `--solve <输入 JSON>`：求解后烘焙。输入 JSON 接受简写 `{ loopLengthMm, nodesPerLoop, params }`（拓扑用 `createPlainJerseyTopology`，参数用 `createFabricFormParams`，求解设置用求解器默认值），或金标准输入文件的写法 `{ input: {...} }`（把 `input` 原样传给 `solveFabricCell`）。
- `--yarn-strip-only`：只导出单根纱线 PBR 贴图。此时 d_e 和纤维直径由 `--params <材料参数 JSON>` 经 `createFabricFormParams` 得到，缺省用其默认值。
- 纱线材料：`--color`（默认 `#C08A5A`）、`--yarn-base-color`、`--yarn-normal`、`--yarn-roughness`、`--yarn-ao`、`--yarn-metallic`、`--yarn-repeat-mm`、`--yarn-normal-green +Y|-Y`。
- 毛羽：`--fuzz off|scan|generated|both`（缺省按 §3.6.1 的默认规则）、`--fuzz-band vRange|fullScan`、`--fuzz-strength`（相当于纱线的 `fuzzStrength`，默认 0.45）、`--hairiness`、`--hair-length-mm`、`--hair-angle-deg`、`--max-curvature`、`--fiber-opacity`、`--halo-strength`、`--halo-width-r`、`--seed`。
- 输出：`--out <目录>`、`--prefix`、`--px-per-mm`（默认 400）、`--repeat kx,ky`、`--strip-length-mm`（默认 4）、`--no-yarn-strip`（面料模式下默认同时导出纱线贴图，此项关闭）、`--review`（额外输出审查用的平铺着色图：面料 `<prefix>_<face>_review4x4.png`，纱线 `<prefix>_yarn_review.png` 为纱线贴图横向平铺 2 次、放在深灰背景上，着色方法同 §3.12）。
- 求解状态不是 `CONVERGED` 时仍然输出，但在终端和元数据里明确标出。

### 3.12 界面（T6a-3）

- **入口**：任务栏新增工作台模式按钮“面料纹理（实验）”（新的 `workbenchMode` 值 `fabricTexture`）。切换离开时终止 Worker、释放资源。
- **面料输入**：纱长 l（mm，默认 2.84）、每圈节点数（24 / 48 / 64，默认 48）、六项材料参数（默认值取 `createFabricFormParams()`，标注“假设值”）、分辨率（100 / 200 / 400 px/mm，默认 200）。
- **纱线**：从纱线库选一个（默认第一个），显示它有哪几张 PBR 贴图、有没有透明通道（扫描毛羽）、有没有 `physicalRepeatLengthMm`、§3.5.5 的各向异性提示；法线绿通道约定（+Y / −Y）。
- **说明预览与二维预览的关系**：工作台里写一句“这里的预览按三维纱线烘焙，与 PBR + 2.5D 页的二维路径预览不是同一种渲染；导出的贴图供 CLO3D 等软件使用”。
- **毛羽（标题写“纱线毛羽”，说明这是所选纱线的属性）**：来源（关 / 扫描 / 生成 / 扫描 + 生成，默认按 §3.6.1）；“毛羽强度”滑杆，初值取所选纱线现有的 `fuzzStrength`，旁注“临时调整，不写回纱线”；低 / 中 / 高快捷设置；展开后可调 §3.6.1 的全部参数、随机种子、毛羽带模式。
- **计算**：“计算并生成”按钮。Worker 中做拓扑、求解、两面纱芯烘焙和 AO；主线程做纱线采样、毛羽、合成与显示。显示已用时间，可取消（终止 Worker）。说明：每圈 48 节点时一次求解约需 0.5～3 分钟。更换纱线、毛羽参数或法线约定时不重新求解，只重新合成。
- **预览**：正面 / 反面 / 纱线贴图三个视图；面料平铺 2～8 个单元（默认 4）；Canvas 2D 着色：`color · AO · (0.25 + 0.75·max(0, n·L)) + spec`，`spec = 0.15·(1 − roughness)·max(0, n·h)^(8 + 120·(1 − roughness))`，高光颜色为 `mix(白, color, metallic)`；L 为左上方来光，`h = normalize(L + (0, 0, 1))`；按 opacity 叠在深灰背景上；显示毫米比例尺。
- **结果信息**：求解状态（非 `CONVERGED` 时用醒目的警告样式）、W×H（mm）、横密、纵密（根/cm）、克重（g/m²）、纤维数与毛羽像素占比、§3.10 的局限说明全文。
- **导出**：“导出面料贴图”和“导出纱线贴图”两个按钮，分别用 `@zip.js/zip.js` 打成 zip：面料 zip 含两面各张 PNG 和面料元数据；纱线 zip 含纱线各张 PNG 和纱线元数据。可选平铺数 `[kx, ky]`。合成与编码必须调用与命令行相同的 `src/fabricTexture/` 函数。
- 文字沿用 PBR + 2.5D 工作台的写法（中文直写）；不新增 i18n 键，除非现有检查要求。

## 4. 验证

### 4.1 新检查 `validate:fabric-texture`

用仓库内的 `docs/archive/t1-slope-closeout-2026-11-23/step3-hossain-2.84-after.json` 和 `step4-case-4-N48.json`（`--from-result` 方式，不求解），`pxPerMm = 200`，除非另有说明。合成的测试贴图一律在检查脚本里生成，不入仓库。

“合成直纱工况”统一为：单元 W = H = 1 mm，S = 0；纱线中心线沿 +x，位于 y = 0.5 mm、z = 0，等分 48 个节点，最后一条边 p = 1；材料参数用 `createFabricFormParams()` 默认值；反面视角（坐标不变）。

**T6a-1 加入（几何与纱线贴图）：**

- (a) **中心线**：样条在每个节点处与节点坐标的差不超过 `1e-12 mm`；相邻采样点距离不超过 `r/12`；周期位移 `D` 等于某个整数组合 `p·a1 + q·a2`（误差不超过 `1e-12 mm`）。
- (b) **解析圆管**：沿 x 方向的直线周期“纱”（合成 cell，z = 0），横向距离 `|d| ≤ 0.999·r` 的像素，烘焙高度与 `sqrt(r² − d²)` 相差不超过 `1e-9·r`，法线向量与解析法线之差的长度不超过 `1e-9`；`|d| > r` 的像素没有纱芯。
- (c) **周期不变性（无接缝）**：把中心线整体平移 `(W, 0, 0)`、再单独平移 `(0, H, 0)` 后重新烘焙，纱芯的高度、法线、覆盖与原结果逐像素一致（高度差不超过 `1e-9 mm`，法线差不超过 `1e-9`，覆盖完全相同）。
- (d) **正反面**：两个工况都满足“正面线圈腿占比 > 反面线圈腿占比 + 0.2”，报告实际数值。
- (e) **PNG 编码往返**：用 `node:zlib` 解压编码结果，像素字节与输入完全相同；所有块 CRC 正确；16 位为大端。
- (f) **确定性**：同一输入两次运行，所有 PNG 与元数据（去掉生成时间）字节相同。
- (g) **法线编码**：解码后向量长度与 1 相差不超过 `2/255`，且 z 分量 ≥ 0。
- (h) **高度编码**：`heightMinMm`、`heightMaxMm` 与烘焙结果一致；解码 16 位值换算回 mm，与原高度相差不超过 `(heightMaxMm − heightMinMm)/65535`。
- (i) **纱线贴图周期**：`L_s / L_rep'` 与最近整数相差不超过 `1e-9`；对一个以 u 为参数的测试图案，线圈首尾相接处（s = 0 与 s = L_s 两侧）采样值连续；`L_rep` 来源规则正确（有 `physicalRepeatLengthMm` 用它，没有按 §3.5.3 公式）。
- (j) **元数据一致**：`waleDensityPerCm` 与 `10·m/W`、`courseDensityPerCm` 与 `10·n/H` 相对差不超过 `1e-12`；贴图物理尺寸等于 `kx·W × ky·H`。
- (l) **纱线法线方向**：直纱沿 +x、反面视角，用 256×64 的测试法线图 `n_tex(u) = (sin(0.3·cos 2πu), 0, cos(0.3·cos 2πu))`（每行相同），在 u = 0 处纱芯顶部（w = 0）的烘焙法线与 `(sin 0.3, 0, cos 0.3)` 之差的长度不超过 0.02；把扰动放在 G 通道时，期望为 `(0, sin 0.3, cos 0.3)`。
- (m) **截面轮廓去除**：测试法线图每行为纯截面轮廓 `(0, sin φ(v), cos φ(v))`、沿 u 不变，测试 AO 图每行常数。烘焙结果的法线和 AO 与不用纱线法线图、AO 图时相差不超过 `1e-6`。
- (n) **PNG 解码器**：对本任务编码器输出的灰度、RGB、RGBA、16 位灰度 PNG 解码后与原像素相同；解码 `public/materials/white-gray-yarn/` 下两张图，尺寸与 IHDR 一致，RGBA 图通道数为 4。

**T6a-2 加入（毛羽与纱线贴图导出）：**

- (o) **扫描毛羽**：测试 baseColor（RGBA）行 0.4～0.6 为不透明白色，行 0.2～0.4 和 0.6～0.8 为 alpha = 0.4 的灰色，其余 alpha = 0。合成直纱工况、`fuzzSource = scan`、`fullScan` 模式：纱芯像素 opacity = 255；`r < |d| ≤ 3r` 的像素 opacity 与 `round(0.4·255)` 相差不超过 1；`|d| > 3r + 一个像素` 的像素 opacity = 0。
- (p) **毛羽不改高度**：同一工况开、关毛羽（scan、generated、both 各一次），height 图字节完全相同。
- (q) **生成毛羽**：
  - 纤维数等于 `round(H · L_s / meanHairLengthMm)`；
  - 未显式给出 H 和光晕强度时，`H = 16·f`、`haloStrength = f`（f 为毛羽强度，测 f = 0、0.45、1 三个值；f = 0 时无纤维、无光晕）；
  - 同一种子两次结果字节相同，换种子结果不同；
  - 周期不变性：中心线整体平移 `(W, 0, 0)` 后重新生成并烘焙，各 8 位通道逐像素相差不超过 1，且有差异的像素不超过 0.1%（允许浮点取模带来的个别取整差）；
  - 单根纤维不自我叠加：只放一根直纤维（关闭光晕）在空白背景上，所有像素的 opacity 不超过 `round(fiberOpacity·255)`，纤维中心线经过的像素等于该值（±1）。
- (r) **纱线贴图导出**：
  - 每个导出文件名经 `identifyPbrMap` 识别为对应的贴图类型；
  - baseColor 为 RGBA；对 white-gray-yarn（`both`）和纯色（`generated` 中档）两种导出，`findYarnTextureVRange` 返回的都不是 `[0, 1]`，且包含全部纱芯行。纯色高档只报告返回值：长纤维可能在远处形成第二条“纱线带”，使现有函数退回 `[0, 1]`，这是现有函数的规则，不在本任务修改；退回时在纱线元数据里注明“二维预览将使用整张贴图高度”。
  - 左右两列像素连续（与内部相邻列的差同量级，报告数值）；中心线平移 `L_strip` 后结果满足 (q) 同样的容差。

**T6a-3 加入（界面）：**

- (k) **界面复用**：源码静态检查，规则固定如下：
  - `src/views/fabricTextureWorkbench.js` 和 `src/fabricTexture/fabricTextureWorker.js` 都必须包含从 `fabricTexturePipeline.js` 导入的语句（正则 `/from\s+["'][./]*(fabricTexture\/)?fabricTexturePipeline\.js["']/`）；
  - 这两个文件都不得匹配 `/IHDR|CompressionStream|crc32|Math\.atan2?\(|mulberry/i`（PNG 编码、AO、随机数只能在共享模块里）。

除 (k) 外，任一项不通过，按 §8 #3 停止，报告第一个不通过的项与数值，**不得调整门槛**。

### 4.2 范围检查（每个改代码的步骤）

`git diff --stat <本任务基线>..HEAD -- src/fabricForm scripts/fixtures docs/archive/t1-slope-closeout-2026-11-23 docs/KnitScape_当前功能与算法.md src/domain/yarnMaterial.js src/yarnTexture src/simulation` 必须为空。

### 4.3 审查用产物（提交进仓库）

放在 `docs/archive/t6a-fabric-texture-2026-11-28/`，全部 200 px/mm：

**T6a-1：**
1. hossain-2.84、case-3-N48、case-4-N48 三个工况，纯色、两面各一张 `review4x4.png`；
2. hossain-2.84 两面，分别用样例一的 Yarn A、Yarn B（从 `public/current-SOP.knitscape` 中取出，取出的贴图不入仓库），以及样例二 white-gray-yarn 的纱芯（`fuzzSource = off`）各一张 `review4x4.png`；
3. hossain-2.84 正面、Yarn A 的完整面料贴图与元数据；
4. `summary.json`：每个工况的 W、H、横密、纵密、覆盖率、线圈腿占比、样条长度偏差、样条与折线最大距离、高度范围、各阶段耗时、纱线贴图诊断；
5. 用 `--solve` 方式、以金标准输入写法读入 `step4-case-3-N48-input.json`，求解一次再烘焙，报告求解状态、迭代数、耗时，以及 W、H 与仓库内 `step4-case-3-N48.json` 的相对差。这是金标准工况，相对差应为 0；不为 0 时只记录，不停止。

**T6a-2：**
1. hossain-2.84、case-4-N48 正面，white-gray-yarn 只用扫描毛羽（`scan`）各一张 `review4x4.png`；
2. case-3-N48 正面，white-gray-yarn 纱芯 + `both`，毛羽强度低 / 中 / 高三档各一张；Yarn A + `generated` 中档，正反面各一张；
3. 单根纱线贴图：white-gray-yarn（`both`，中档）导出完整一套（各张 PNG + 元数据 + `yarn_review.png`）；Yarn A（`generated` 中档）和纯色（`generated` 高档）只提交 `yarn_review.png` 与元数据。`yarn_review.png` 按最近邻缩小到宽不超过 1600 像素；
4. hossain-2.84 正面、white-gray-yarn + `both` 中档的完整面料贴图与元数据；
5. 更新 `summary.json`：纤维数、毛羽像素占比、ρ、各向异性、纱线贴图的 V 范围、各阶段耗时。

单个文件不超过 1.5 MB；整个目录（T6a-1 与 T6a-2 合计）不超过 15 MB。

## 5. 验证口径（固定写法）

- 改代码的步骤（T6a-1、T6a-2、T6a-3）：跑全量 `npm run validate`（51 项，含 `validate:fabric-texture` 和 golden-eval）和 `npm run build`。
- **纯文档步骤（T6a-0、T6a-4）不跑 validate 和 build**：validate 读取的文档只有 `docs/KnitScape_当前功能与算法.md` 和 `docs/archive/t1-slope-closeout-2026-11-23/`，本任务的文档步骤不碰它们，也不在根目录新增路径（架构师已核对全部 validate 脚本）。
- 不跑 `golden:fabric-form-solve`：本任务不改第 3 层，§4.2 的范围检查代替。
- 不做额外文件哈希、同机双跑或性能测量；§4.3 只报告标准运行里顺带得到的耗时。
- 中断条款：`--solve` 求解或任何长时运行如果发生外部进程中断（无终态、无退出码），不算失败；保留原记录，换新的输出目录完整重跑；以不依赖工具连接的后台进程运行并写退出码；同一步累计第 3 次中断时停止回报。

## 6. 执行步骤（每步单独提交并推送）

**T6a-0：立项（纯文档）**

1. 核对 HEAD 与 `git status`；若用户尚未放入，把本文件原样放到 `docs/T6A_FABRIC_TEXTURE_TASK.md`。
2. `docs/NEXT_TASK.md` 追加一行：“T6a 立项：面料纹理第一版（普通纬平针；纱线 PBR 贴图上身；纱线毛羽与单根纱线 PBR 贴图导出；命令行与界面），见 T6A_FABRIC_TEXTURE_TASK。”
3. 不跑 validate/build（§5）。

**T6a-1：几何烘焙、纱线 PBR 贴图上身与命令行（不含毛羽）**

1. 实现 §3.2–§3.5、§3.8–§3.11 中与毛羽无关的部分（`fuzzSource` 暂时只支持 `off`），以及 PNG 编解码与命令行。
2. 加入 §4.1 (a)–(j)、(l)–(n) 和 `validate:fabric-texture`。
3. 生成 §4.3 中 T6a-1 的审查用产物并提交。
4. 验收：§5 的 validate、build 通过；§4.2 范围检查为空。
5. **提交推送后停下，等架构师看图审查。**审查意见经用户转达后原文追加到 §10，再开始 T6a-2。

**T6a-2：纱线毛羽与单根纱线 PBR 贴图**

1. 实现 §3.6、§3.7，补齐 §3.8–§3.11 中与毛羽相关的部分。
2. 加入 §4.1 (o)–(r)。
3. 生成 §4.3 中 T6a-2 的审查用产物并提交。
4. 验收：§5 的 validate、build 通过；§4.2 范围检查为空。
5. **提交推送后停下，等架构师和用户看图审查**（毛茸茸的程度由用户确认，默认参数可能按审查意见调整）。审查意见经用户转达后原文追加到 §10，再开始 T6a-3。

**T6a-3：界面工作台**

1. 按 §3.12 实现 Worker、工作台视图和最小的状态、任务栏、视图接入。
2. 加入 §4.1 (k)。
3. 验收：§5 的 validate、build 通过；§4.2 范围检查为空。另用界面的默认输入（纱长 2.84、每圈 48 节点、默认材料参数、200 px/mm、纯色纱线、生成毛羽中档），在 Node 中调用与 Worker 相同的流水线函数完整试算一次（求解 + 两面烘焙 + 毛羽 + 合成 + 编码 + 两个 zip），在提交信息里写明求解状态、迭代数、各阶段耗时和 zip 内文件清单。
4. **提交推送后停下，等界面验收**：界面操作（计算、取消、换纱线、调毛羽、正反面与纱线视图、平铺、两个导出）由用户或架构师在用户电脑上实际打开并截图检查。验收意见经用户转达后原文追加到 §10，再开始 T6a-4。

**T6a-4：文档与交接（纯文档）**

1. `docs/ARCHITECTURE.md` 新增一节 “Layer 4：fabricTexture”：数据流（第 3 层结果 → 中心线 → 两面纱芯烘焙 → AO → 纱线贴图上身 → 毛羽 → 合成 → PNG/元数据 → 命令行与界面；以及单根纱线贴图），模块职责表，§3.3 的视角与面定义，§3.5–§3.8 的贴图约定，§3.10 的局限说明，以及与 `ALGORITHM_DESIGN` “第 3 → 4 层接口”的关系：第一版没有构造截面、没有交付三角网格，所以网格相交检查不适用；相邻纱线的轻微重叠在俯视高度场里合并；毛羽是外观层，不进入第 3 层。
2. `docs/NEXT_TASK.md` 追加 T6a 完成记录。
3. 不改其他文档；不跑 validate/build（§5）。

## 7. 完成定义

- [ ] T6a-0 到 T6a-4 共 5 个提交，均已推送；T6a-1、T6a-2、T6a-3 之后各有一次审查记录追加在 §10
- [ ] 每个改代码的步骤 validate 51/51、build 退出 0；提交信息里写实际数字
- [ ] §4.1 (a)–(r) 全部通过，现有检查无删减、无放宽
- [ ] §4.2 的范围检查为空
- [ ] 命令行能从已有平衡解或新求解生成两面面料贴图（含纱线贴图上身与毛羽）、单根纱线贴图与元数据；界面能计算、预览、导出同样的文件（以 T6a-3 之后的界面验收为准）
- [ ] §4.3 的审查用产物已在仓库中

## 8. 停止条件

1. 需要修改 `src/fabricForm/` 或其他 §2.2 禁止的内容才能完成。
2. 正反面检查 (d) 不通过（说明面定义与 §1.2 的判断不符）。
3. §4.1 中除 (k) 外任一项不通过：报告第一个不通过的项与数值，不调整门槛。
4. 要烘焙的平衡解 `|S| > 1e-6·W`（第一版不支持剪切单元）。
5. 现有检查因新增工作台而失败，且只有修改原断言才能通过。
6. 需要新增依赖。
7. validate 或 build 出现与本步改动无关的失败（在基线提交上同样失败）：只记录，不修。
8. 发现现有代码有疑似缺陷：只记录，不修。

以下情况**只记录、不停止**：`--solve` 求解未收敛（照常输出并标注）；§4.3 中 T6a-1 第 5 项的 W、H 与已有结果不一致；样例纱线贴图边界不连续（§3.5.5 诊断）。

## 9. 回报格式（写进提交信息正文，并推送）

```text
docs(fabric-texture): T6a-0 <内容>         ← T6a-0、T6a-4 用 docs
feat(fabric-texture): T6a-x <内容>         ← T6a-1、T6a-2、T6a-3 用 feat

状态：完成 / 停止（停止条件 #n）
基线：<上一步提交号>
validate：51/51（含 golden-eval 7/7、fabric-texture），build：退出 0   ← 纯文档步骤写“未运行（纯文档）”
范围检查（§4.2）：为空 / 非空（列出文件）
新增检查：<本步加入的各项：通过 / 不通过（首个差异）>
审查产物：<T6a-1、T6a-2 填目录、文件数与合计大小；其余写“无”>
默认输入试算：<T6a-3 填求解状态、迭代数、各阶段耗时、两个 zip 的文件清单；其余写“无”>
公开接口变化：<新增或改动的函数及签名；没有就写“无”>
偏离任务书：<没有就写“无”>
发现未处理的问题：<没有就写“无”>
本地归档：C:\Users\liuchen\Documents\KnitScape\archives\t6a-fabric-texture-2026-11-28\T6a-x\
```

触发停止条件、但没有可提交的代码时，把停止记录写进本文件 §10，单独提交并推送。

## 10. 执行记录（Codex 填写；架构师后续裁定和审查意见也原文追加在此）

（暂无）
