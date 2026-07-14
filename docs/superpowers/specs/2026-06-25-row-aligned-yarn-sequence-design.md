# Step 18：逐行等高色纱序列设计

## 背景

当前 Step 17 已经把色纱序列产品化为左侧控制区加左下角小画布的形式。但实际使用目标不是设置一个短循环行数，而是让中间织法图左侧出现一条与织法图等高的色纱栏。用户需要直接选中某一行，并给这一整行指定色纱。

## 目标

1. 删除左侧“色纱序列”的增加行 / 减少行按钮区。
2. 中间织法图左侧保留 `yarn-sequence-canvas`，并让它的高度始终等于中间织法图高度。
3. 色纱序列每一格对应中间织法图的一行，格子高度与中间织法图单元格高度一致。
4. 点击色纱序列某一行时，把该行设置为当前选中的色纱。
5. 拖动色纱序列时，可以连续刷多行。
6. 修改顶部 Height 或导入不同高度图案时，色纱序列自动同步到新的 chart.height。
7. 右侧预览按逐行色纱序列显示，不再把色纱序列理解为短循环高度控件。
8. JSON 导入导出继续保存 `yarnSequence`，旧文件或非法文件自动归一化。

## 非目标

1. 不恢复旧的拖动高度按钮。
2. 不保留左侧增加行 / 减少行按钮。
3. 不改变中间织法图的 Width / Height 输入框语义。
4. 不改变 repeat 最小针法单元的编辑逻辑。
5. 不新增复杂的多选行、框选、批量填充工具。

## 数据模型

`GLOBAL_STATE.yarnSequence` 继续使用 `Bimp`，但 Step 18 后应满足：

```text
yarnSequence.width = 1
yarnSequence.height = chart.height
yarnSequence.pixels.length = chart.height
```

每个像素值表示对应行使用的色纱索引。用户修改 Height 导致新增行时，新增行默认填充当前 `activeYarn`；导入旧 JSON 或缺失序列时，新增行默认补 0。如果当前色纱非法则回退为 0。

## 尺寸同步规则

当 `chart.height` 改变时，自动把 `yarnSequence.height` 调整为相同高度：

```text
新高度 > 旧高度：保留已有行，新行填充当前 activeYarn
新高度 < 旧高度：截断多余行
最小高度：跟随 chart.height，chart.height 本身应大于等于 1
```

该同步应发生在：

1. 顶部 Height 输入框修改整张画布高度时。
2. JSON 导入时。
3. 新建图案时。
4. 任何会替换 `chart` 的路径中。

## 交互设计

中间织法图左侧的色纱栏为主要入口：

```text
点击一行：该行写入当前 activeYarn
拖动经过多行：连续写入当前 activeYarn
切换当前色纱：只影响后续点击 / 拖动，不自动修改已有行
```

色纱栏不显示文字按钮，不承担缩放、拖动边界、repeat 调整或右侧预览操作。

## 视觉布局

`#yarn-sequence` 仍位于 `#canvas-transform-group` 左侧，贴近中间织法图左边缘。它的画布尺寸和缩放使用与主织法图相同的 `scale`：

```text
CSS 宽度 = 1 个单元格宽度
CSS 高度 = chart.height 个单元格高度
```

这样用户看到的每一格都和中间织法图一行严格对齐。

## 右侧预览

右侧单面布预览继续按 `link.row` 获取该行色纱。Step 18 后，`yarnSequence.height` 与 `chart.height` 相同，因此通常表现为逐行取色；如果导入旧文件只包含短序列，则导入阶段先归一化到 chart.height。

默认全 0 序列时，右侧预览保持现有双纱固定颜色兼容行为，避免破坏前面已经完成的双纱、纱长和纹理功能。

## 导入导出

导出 JSON 时继续保存完整 `yarnSequence`。

导入 JSON 时：

```text
缺少 yarnSequence：创建 1 x chart.height，全 0
yarnSequence.height 小于 chart.height：保留已有行，导入时新增行补 0
yarnSequence.height 大于 chart.height：截断到 chart.height
yarnSequence.width 非 1：只读取每行第一个像素并归一化为 width 1
```

## 验收标准

1. 左侧不再出现色纱序列增加行 / 减少行按钮区。
2. 页面默认打开时，色纱序列小画布高度与中间织法图高度一致。
3. 修改 Height 后，色纱序列高度同步变化。
4. 色纱序列每一格与中间织法图每一行对齐。
5. 点击某一行可以只改变该行色纱。
6. 拖动可以连续改变多行色纱。
7. 中间织法图色纱底色、右侧预览和 JSON 导出使用同一套逐行色纱序列。
8. 旧 JSON 导入不会报错，导入后色纱序列自动补齐到 chart.height。
9. 现有验证 `validate:yarn-length-scaling`、`validate:two-ply-yarn`、`validate:repeat-dimensions` 和 `build` 继续通过。

## 测试方案

新增或更新 `validate:yarn-sequence-editor`：

```text
检查左侧按钮区已删除
检查 yarnSequence.height 自动等于 chart.height
检查 resize / normalize helper 能按 chart.height 补齐或截断
检查导入旧 JSON 缺少 yarnSequence 时能得到 chart.height 行
检查 yarnSequenceCanvas 使用 chart.height 绘制
检查 pointer / touch 仍能按行刷 activeYarn
检查 runSimulation 继续按 link.row 应用序列
```

同时运行：

```text
npm run validate:yarn-sequence-editor
npm run validate:yarn-length-scaling
npm run validate:two-ply-yarn
npm run validate:repeat-dimensions
npm run validate:i18n
npm run validate:single-ui
npm run build
```
