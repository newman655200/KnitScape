# 默认组织图全上针设计

## 目标

单面布项目打开后的中间组织图默认全部为上针。新增空白文件、生成空白 chart 背景、添加空白花型时，也使用同一默认上针值。

## 符号约定

`DEFAULT_SYMBOLS = ["knit", "purl", "slip", "tuck"]`，其中 `purl` 对应界面文案“上针”，内部编号为 `1`。

## 实现

新增：

```js
DEFAULT_STITCH_SYMBOL = "purl"
DEFAULT_STITCH_SYMBOL_INDEX = DEFAULT_SYMBOLS.indexOf(DEFAULT_STITCH_SYMBOL)
```

以下位置统一使用 `DEFAULT_STITCH_SYMBOL_INDEX`：

1. 初始 `GLOBAL_STATE.chart`
2. 初始默认 repeat bitmap
3. `newPattern()` 的空白 chart 和空白 repeat
4. `generateChart()` 中未被 repeat 覆盖的空白底色
5. 左侧“添加花型”的空白 repeat

## 验证

`npm run validate:single-ui` 检查默认组织值必须来自 `DEFAULT_STITCH_SYMBOL_INDEX`，并禁止继续把空白组织图默认写成编号 `0`。
