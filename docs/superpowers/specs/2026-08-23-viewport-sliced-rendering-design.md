# KnitScape 大画布可视切片渲染设计

日期：2026-08-23

状态：方案 A 已由用户确认，待实施

## 1. 背景与问题

双循环单元编辑器已经满足 60×60 默认画布、8×4 黑色编辑单元、灰色平铺结果、16×16 初始视角、共享缩放平移和双固定色纱栏等需求。但完整画布允许输入到 500×500，现有渲染器仍按“完整位图尺寸 × 当前 scale”创建每一张 Canvas backing store。

在 500×500、`scale = 15` 时，一张完整 Canvas 已达到 7500×7500，约占 225 MB RGBA 内存；两个编辑器的完整符号、网格和交互层会放大到不可接受的资源规模。最大缩放下单边尺寸还会超过常见浏览器 Canvas 上限。与此同时，编辑三角座单元会同时重建 `camBitmap` 和 `needleBitmap`，导致排针编辑器与模拟器发生无意义刷新。

本设计保持用户已经确认的界面和数据模型不变，只把渲染成本从“完整画布面积”改为“当前可见面积”，并让派生通知只覆盖真正变化的一侧。

## 2. 已选方案与备选方案

用户选择方案 A：可视区域切片渲染。

- 方案 A（采用）：只为当前视口及一格 overscan 创建 Canvas backing store，平移跨越单元格边界时更新切片。优点是 500×500 和最大缩放下仍保持清晰、内存有确定上限；代价是渲染器需要管理切片原点。
- 方案 B（不采用）：限制 backing store 分辨率后用 CSS 放大。改动较小，但大尺寸或高倍缩放时符号和网格会模糊。
- 方案 C（不采用）：降低 500 的尺寸上限。实现最简单，但违反已经批准的输入范围。

## 3. 不变的产品行为

- 完整画布默认仍为 60×60，输入范围仍为 5–500。
- 两个源循环单元默认仍为 8×4；开始排针保持 8×4，应用 1/2/3/4 后排针单元变为 4×8。
- 黑色循环单元仍在完整画布世界坐标的左上角，灰色区域仍显示顶部对齐的派生平铺结果。
- 初始视角仍为 16×16；滚轮缩放和中键拖拽仍共享同一个 `scale` 与 `chartPan`。
- 色纱栏仍固定在灰色画布左侧，只共享纵向平移，两个编辑器编辑同一 `yarnSequence`。
- `camBitmap` 和 `needleBitmap` 仍是完整尺寸的派生数据，继续供模拟、JSON、BMP、SilverKnit、Kniterate 和打孔卡使用。

## 4. 可视单元窗口

在 `src/chartViewport.js` 增加纯函数 `visibleCellWindow()`。输入包括完整行列数、视口 CSS 宽高、`scale`、DPR、`chartPan` 和一格 overscan，输出：

```text
startColumn / endColumn
startDisplayRow / endDisplayRow
cssLeft / cssTop
cssWidth / cssHeight
pixelWidth / pixelHeight
```

列范围从 `-chartPan.x / cssCellSize` 推导，显示行范围从 `-chartPan.y / cssCellSize` 推导；开始位置向下取整、结束位置向上取整，再在完整画布范围内裁剪。overscan 在四边各增加一格，避免像素级拖动时露出空白。

该函数必须处理无效 DPR、零尺寸视口、画布完全移出视口和极端平移。零尺寸视口使用 16×16 的保守回退，不得退化为完整 500×500 backing store。

## 5. 针法编辑器渲染

### 5.1 世界层与切片层

`.pattern-canvas-stack` 保持完整画布的 CSS 世界尺寸，使共享 transform、裁剪和指针坐标继续以完整画布为基准。

- full symbol 与 full grid Canvas 改为绝对定位的可视切片；`left/top` 等于切片在完整世界中的 CSS 原点。
- 两张 unit Canvas 仍完整绘制小型源单元，并固定在世界坐标左上角。
- interaction Canvas 只作为完整世界的透明命中平面：backing store 固定为 1×1，但 CSS 宽高仍等于完整画布 CSS 尺寸。它不承担像素绘制，因此不会失真，也不会占用大内存。

### 5.2 局部绘制与方向

full renderer 只遍历切片内的世界列和显示行。显示行转换为 Bimp 坐标时继续使用：

```text
bitmapY = bitmap.height - displayRow - 1
```

Canvas 内部坐标减去切片起点，从 `(0, 0)` 开始绘制。网格也只绘制局部范围，但切片定位必须让网格线与完整世界单元边界严格对齐。

`chartPan` 发生像素级变化但仍位于同一单元窗口时，不调整 backing store、不重画像素；只有跨格导致窗口范围变化时才更新切片。缩放、DPR、位图、符号样式或网格开关变化仍会触发相应局部重绘。

## 6. 色纱栏切片

色纱 Canvas 同样只创建当前可见显示行加 overscan 的 backing store，并通过 `top` 放回完整色纱世界坐标。色纱 track 保留完整序列的 CSS 高度和共享的 `translateY(chartPan.y)`。

交互坐标不能再假设 Canvas 顶端就是完整序列顶端。renderer 将 `startDisplayRow` 写入 Canvas 的 dataset；`colorSequencePosAtCoords()` 先计算 Canvas 内局部显示行，再加切片起始行，最后转换为 Bimp 的自底向上行号并裁剪到有效范围。

任一色纱条编辑后，两边都使用同一 `yarnSequence` 重绘各自当前切片；现有全局笔画互斥、Pointer Capture 失败回退和触摸 ID 规则保持不变。

## 7. 选择性派生与通知

状态层根据实际源字段决定派生内容：

- `canvasWidth` 或 `canvasHeight` 改变：重建并通知 `camBitmap` 与 `needleBitmap`。
- 仅 `camUnitBitmap` 改变：只重建并通知 `camBitmap`，保持 `needleBitmap` 引用稳定。
- 仅 `needleUnitBitmap` 改变：只重建并通知 `needleBitmap`，保持 `camBitmap` 引用稳定。
- 同一 action 同时改变两个 unit：分别重建两边。

初始化、文件载入和撤销仍通过同一选择性派生入口维持状态不变量。三角座绘制不再伪造 `needleBitmap` 变化，因此排针 renderer 和 `runSimulation()` 不应刷新。

无生产消费者的 `patternEdit` 辅助状态将删除，相应验证改为观察真实 unit、派生引用和通知字段。

## 8. 文案与状态修正

- 简体中文顶部标签从“纵向行数”改为用户指定的“纵向针数”；其他语言只在现有翻译确有对应错误时修改。
- 原双循环单元设计文档状态改为已实施，并引用本性能加固设计。
- 当前实施计划增加本加固任务及最终复审状态，验证数量以实际脚本为准。

## 9. 验证策略

新增大画布切片验证，至少覆盖：

1. 500×500、最大 scale 时，full symbol/full grid 的任一 backing store 边长不超过“可见格数 + 两格 overscan”乘 scale；interaction 固定为 1×1。
2. 色纱高度 500、最大 scale 时 backing store 只包含可见行，不超过浏览器常见单边限制。
3. 平移到右下区域后，切片 `left/top`、世界格内容、Bimp 纵向方向和网格线仍正确。
4. 同一格内的像素平移不重绘；跨格平移只重绘新的局部窗口。
5. 三角座 unit 编辑保持 `needleBitmap` 引用和通知不变，且不触发排针 renderer/模拟；排针 unit 编辑反向同理。
6. 画布尺寸改变仍同时派生两张完整 bitmap，模拟和各导出消费者继续得到完整尺寸结果。
7. 现有 16×16、黑灰配色、灰区只读、同步缩放、中键拖拽、双色纱、JSON v3 和导出验证全部继续通过。

测试不使用脆弱的整文件正则代替行为断言；Canvas double 记录实际 backing store、切片位置、世界格读取次数和绘制坐标。大画布性能以有界工作量断言为主，不设置容易受机器速度影响的毫秒阈值。

## 10. 完成标准

- 500×500 与最大缩放下不存在完整尺寸 Canvas backing store。
- 单次局部绘制工作量与可见格数相关，而与 500×500 总面积无关。
- 三角座编辑不会重建排针派生图或触发模拟，反之亦然。
- 默认 60×60 页面视觉与已验收版本一致。
- 所有验证、生产构建、浏览器 60×60 与 500×500 验收及全分支复审通过，工作树干净。
