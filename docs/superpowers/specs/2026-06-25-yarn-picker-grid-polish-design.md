# Yarn Picker And Sequence Grid Polish Design

## Goal

优化两个已存在交互：

1. 左侧色纱列表中，点击数字区域只选中该色纱，不弹出颜色编辑器；只有点击右侧色块区域才打开颜色编辑器。
2. 中间织法图左侧的色纱序列画布增加横向分隔线，让用户能看出每一行的小格子；小格高度继续等于中间织法图的每一行高度。

## Design

左侧色纱列表保留一个色纱按钮作为选择入口，父级 `color-select` 的点击行为只 dispatch `activeYarn`。右侧色块内部的 `edit-color-btn` 和 `edit-color-icon` 继续调用 `editColor(index)`，并继续 `stopPropagation()`，避免事件冒泡到父级。

色纱序列画布继续使用现有 `scale`、`yarnSequence.width`、`yarnSequence.height`。在每次绘制色块后追加 `drawYarnSequenceGrid(ctx)`，按 `y * scale` 画水平线。因为线的位置和高度都来自同一个 `scale`，所以色纱序列的小格高度与中间织法图每行一致；Height 或缩放变化后，现有 `sizeCanvasToBitmap` 和重绘流程会同步更新格线。

## Validation

更新 `scripts/validate-yarn-sequence-editor.mjs`：

- 检查 `color-select` 父级点击不再调用 `editColor(index)`。
- 检查 `edit-color-btn` / `edit-color-icon` 仍调用 `editColor(index)`。
- 检查 `yarnSequenceCanvas` 包含横向格线绘制函数，并使用 `scale` 绘制线条。

## Scope

不改色纱数据模型，不改逐行色纱序列高度同步，不改右侧单面布预览逻辑。
