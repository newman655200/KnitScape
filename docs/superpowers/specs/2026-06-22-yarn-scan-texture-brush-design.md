# 扫描纱线纹理笔刷设计

日期：2026-06-22

## 目标

为单面布项目增加“扫描纱线图片 + 2D 纱线纹理笔刷”能力。用户可以为纱线 1 和纱线 2 分别导入一张单根纱线扫描图，系统自动去白底、裁掉上下白边、压缩为可保存的纹理，并在右侧单面布预览中用该纹理表现更接近真实纱线的主体纹理和边缘毛羽。

第一版仍基于当前 2D canvas 预览，不声称完成真实 3D 或真实 PBR 光照。数据结构会预留 PBR 字段，方便后续接入 baseColor、normal、roughness、height、ambientOcclusion 导出或 3D tube 材质。

## 输入假设

第一版面向以下图片条件：

- 图片内容是单根纱线。
- 纱线整体横向或纵向比较直。
- 背景是白底或浅色纯背景。
- 纱线位于图片中间，上下有白边。
- 图片来源可以是扫描仪、显微拍照或手机拍照后的裁切图。

如果图片是整块面料、纱团、复杂背景、明显弯曲纱线，第一版不保证自动处理效果。

## 非目标

第一版不做以下内容：

- 不做完整 3D 纱线模型。
- 不解决 3D 穿插、穿模和 tube UV。
- 不把 2D canvas 效果称为真实 PBR。
- 不从整块面料图中自动提取单根纱线。
- 不做复杂手动裁切编辑器。

## 用户体验

在左侧“双纱参数”区域中，纱线 1 和纱线 2 各自增加扫描纹理区域。

每根纱线包含：

- 导入扫描纱线图片按钮。
- 处理后纹理缩略图。
- 文件名或“未导入”状态。
- 开关：使用扫描原色 / 使用当前纱线颜色染色。
- 去背景强度滑块。
- 纹理强度滑块。
- 毛羽强度滑块。
- 清除扫描纹理按钮。

导入图片后，右侧单面布预览自动重新渲染。用户修改纱线颜色、直径、原色/染色开关、纹理强度或毛羽强度后，也触发右侧预览重新渲染。

## 数据结构

在 `yarnPlies[index]` 中新增 `texture` 字段：

```js
{
  color: "rgba(...)",
  diameter: 0.24,
  enabled: true,
  texture: {
    sourceType: "scan",
    fileName: "sample-yarn.png",
    dataUrl: "data:image/...",
    processedDataUrl: "data:image/...",
    useOriginalColor: true,
    backgroundThreshold: 0.92,
    textureStrength: 0.75,
    fuzzStrength: 0.45,
    pbr: {
      baseColor: null,
      normal: null,
      roughness: null,
      height: null,
      ambientOcclusion: null
    }
  }
}
```

说明：

- `dataUrl` 保存原始导入图，可用于重新处理。
- `processedDataUrl` 保存压缩后的纹理图，用于渲染和 JSON 恢复。
- `backgroundThreshold` 控制白底识别强度。
- `textureStrength` 控制主体纹理混合强度。
- `fuzzStrength` 控制边缘毛羽强度。
- `pbr` 暂时只是预留字段，不在第一版渲染中声明为真实 PBR。

## JSON 导入导出

`downloadJSON()` 继续保存 `yarnPlies`，其中包含 `texture` 数据。为了控制文件大小，导入图片时需要先压缩处理：

- 第一版建议将处理后纹理限制在最长边 1024 像素以内。
- 如果原图过大，原始 `dataUrl` 可以选择保存压缩后的原图，而不是全尺寸原图。
- 旧 JSON 没有 `texture` 字段时，按无扫描纹理处理。

`newPattern()` 会恢复默认纱线配置，不保留扫描纹理。

## 图片处理流程

导入流程：

```text
用户选择图片
-> FileReader 读取为 dataUrl
-> 创建 Image
-> 绘制到离屏 canvas
-> 识别白底 / 浅色背景
-> 裁掉上下白边
-> 生成 alpha mask，保留主体和边缘毛羽
-> 压缩成长条纹理
-> 生成 processedDataUrl
-> 写入 yarnPlies[index].texture
-> 触发右侧预览重新渲染
```

白底识别第一版采用阈值法：

- 将像素转换为亮度和饱和度。
- 高亮度、低饱和度区域判定为背景。
- 背景 alpha 设为 0 或低透明。
- 纱线主体保留原 alpha。
- 边缘区域保留半透明，形成毛羽。

裁切第一版只做自动裁上下白边和左右空白，不提供完整手动裁切框。

## 2D 纱线纹理笔刷

当前右侧预览在 `src/simulation/yarnSimulation.js` 中通过 `Path2D` 和 `context.stroke(path)` 绘制纯色线条。第一版会将每根纱线绘制拆成多层：

```text
阴影层
-> 主体纹理层
-> 染色/原色混合层
-> 高光层
-> 边缘毛羽层
```

基础规则：

- 没有扫描纹理时，保持当前纯色 stroke 效果。
- 有扫描纹理时，使用 `processedDataUrl` 生成 canvas pattern 或离屏笔刷。
- `useOriginalColor = true` 时，主体纹理保留扫描图原色。
- `useOriginalColor = false` 时，用当前纱线颜色对纹理做染色，但保留明暗和纤维细节。
- 纱线直径仍由现有直径滑块控制。
- 纱线 1 和纱线 2 各自使用自己的纹理、颜色、直径和毛羽参数。

为了避免性能过重，第一版可以先采用“纹理主体 + 轻量毛羽”的实现，不做逐像素沿曲线重采样。若 canvas pattern 在曲线拐弯处方向感不够自然，后续再升级为沿路径采样的专用 brush。

## 性能策略

右侧预览可能很大，且 yarnSimulation 会在 relax tick 中重复绘制。需要控制开销：

- 扫描图片处理只在导入或参数变化时运行。
- 处理后的纹理缓存为 `ImageBitmap`、`HTMLImageElement` 或离屏 canvas。
- 渲染时复用缓存，不重复解码 dataUrl。
- 大画布或 relax 动画期间可以先使用简化纹理，停止后再绘制高质量毛羽。
- 第一版毛羽数量按线宽和画布尺寸限流，避免大尺寸画布卡顿。

## 文件边界

预计会涉及：

- `src/views/leftBar.js`：新增每根纱线的扫描纹理 UI。
- `src/state.js` / `src/constants.js`：默认 texture 结构。
- `src/actions/exporters.js`：JSON 导出保留纹理数据。
- `src/actions/importers.js`：JSON 导入兼容旧数据和恢复纹理。
- `src/simulation/yarnSimulation.js`：将纯色 stroke 升级为纹理笔刷渲染。
- 新增 `src/simulation/yarnTexture.js` 或 `src/yarnTexture/`：图片处理、压缩、染色和纹理缓存。
- `scripts/validate-two-ply-yarn.mjs`：增加纱线纹理数据和渲染行为校验。
- `scripts/validate-single-face-ui-labels.mjs`：检查 UI 入口和文档约定。
- `KnitScape_单面布技术文档.md`：记录功能边界和验收结果。

## 风险

主要风险：

- 白底阈值不适配所有扫描仪光照。
- pattern 贴图在曲线方向上可能不完全沿纱线走向。
- 毛羽效果过强会污染针法边界。
- JSON 内嵌图片会增大文件体积。
- relax 动画期间高质量纹理绘制可能影响性能。

缓解：

- 提供去背景强度、纹理强度、毛羽强度三个简单调节。
- 自动压缩纹理图。
- 没有纹理或纹理处理失败时回退纯色 stroke。
- 文档明确第一版是 2D 近似质感，不是完整 PBR。

## 验收标准

第一版完成后应满足：

- 纱线 1 可以导入单根纱线扫描图并显示缩略图。
- 纱线 2 可以导入单根纱线扫描图并显示缩略图。
- 导入后右侧预览能看到扫描纹理或纤维质感。
- 每根纱线可以独立切换扫描原色 / 当前颜色染色。
- 每根纱线可以独立调整去背景强度、纹理强度、毛羽强度。
- 清除扫描纹理后回到纯色纱线显示。
- JSON 导出后重新导入，扫描纹理和参数仍能恢复。
- 旧 JSON 导入不报错。
- `npm run validate:single-ui` 通过。
- `npm run validate:two-ply-yarn` 通过。
- `npm run validate:repeat-dimensions` 通过。
- `npm run validate:intranet` 通过。
- `npm run build` 通过。

## 后续升级

后续可以继续做：

- 手动裁切框。
- 沿路径方向重采样纹理。
- 从扫描图估计 roughness / height。
- 生成 PBR maps：baseColor、normal、height、roughness、AO。
- 接入 3D tube 纱线模型后，将扫描纹理作为真正材质贴图使用。
