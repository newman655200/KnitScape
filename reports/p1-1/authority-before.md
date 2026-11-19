# P1-1 修改前权威审查

Baseline: main / 7ababf264d495f6b96d4d66652c529424938ac4d / baseline-trusted-yarn-length. Tracked clean. Existing untracked PBR/, docs/, reports/, deck and reference JPGs retained.

|字段/入口|真实消费路径与修改前来源|
|---|---|
|color|yarnSimulation.normalizeYarnPlies 从 Legacy ply.color（缺失取 palette[0]/灰）读取；resolveFeedYarnPlies 整份展开 primaryPly。drawYarnSimulation 非中性 yarnSequence 还可加 sequenceMaskColor；WebGL tint 取 mask 或 ply.color。Asset 无独立字段。|
|diameter|同上 Legacy primary。yarnPathGeometry.getBasePointPosition 的法线偏移与 display offset 使用 primaryYarnDiameter；drawYarnSimulation ribbon 宽使用 rowPly.diameter。Solver 的候选路径也使用该几何直径。|
|Albedo|有任一 Asset assetRef map 时 resolveFeedYarnPlies 选择 Asset PBR 并 textureStrength=1；否则整份 Legacy ply。WebGL BaseColor 优先 pbr.baseColor，再旧 processedDataUrl。|
|Normal|同一个 Asset PBR 组；缺失中性 relief；shader采样G通道。|
|Roughness|同组；缺失0.55；仅调节现有简化 highlight。|
|AO|同组 ambientOcclusion；缺失1；乘RGB。|
|Metallic|Importer无别名、normalizer无slot、renderer无sampler，因此丢弃。|
|physicalRepeatLengthMm|Asset PBR组存在时取asset.pbr；否则Legacy texture.pbr；drawYarnSimulation传给buildYarnUvStrip，缺失走旧48模型单位。真实SOP已为22.987。|
|同Feed多Yarn|每槽独立Asset PBR/repeat；但所有槽继承同一个primaryPly颜色和直径，共用同直径中心路径。|
|Legacy第一根|默认材质、基础几何直径、lengthScaleY；pattern预览依赖；Feed新Asset也仍依赖color/diameter。|
|Legacy第二根|normalizeYarnPlies按enabled过滤后，drawYarnSimulation额外画一层Legacy strand；其color/diameter/texture参与绘制，中心路径仍第一根。|
|第二根toggle|控制Legacy第二层是否画出，不控制Feed显式槽；当前有可能额外叠加到显式assignment上。未重做UI。|
|缺失Asset字段|PBR整组选择；color/diameter永远Legacy。normalizeYarnLibrary不保留新字段。|
|更新与P0|runSimulation.syncState把yarnLibrary任何变化视作输入失效，立即清空SolverResult/PreviewValidity；solver缓存本身已排除color/PBR/repeat，但包含Legacy直径。structure revision由Cam结构变化唯一维护。|

证据源：src/domain/yarnLibrary.js、src/simulation/yarnTextureBrush.js、yarnSimulation.js、yarnPathGeometry.js、drawYarnSimulation.js、yarnUvWebglRenderer.js、src/yarnTexture/yarnScanTexture.js、src/components/runSimulation.js、src/state.js、src/views/yarnPlyPanel.js。已逐函数读取，未以变量名推测。

范围：兼容适配，不更改机器Domain，不迁移Feed使用参数，不做视觉标定。SOP主纱真实直径未知；默认0.24是模型单位，保持DIAMETER_NOT_CALIBRATED。
