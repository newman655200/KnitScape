# Yarn Material / Feed × Yarn Callgraph

FACT：以下来自当前工作区；HEAD7ababf2没有当前dirty Asset color/diameter/Metallic全部通路，不能把历史HEAD限制冒充当前事实。源对象的来源不等于实测provenance；真实diameter/工艺七问仍UNKNOWN。

```text
Feed3/Yarn2（UI一基） = cam.feeds[2].yarns[1]
  yarnId ──────────────→ yarnLibrary.find(String(id))
  target / tension / placement（assignment使用参数，不放材质）
                                  ↓
resolveYarnMaterial({yarnAsset, legacyContext: normalizedPrimary})
                                  ↓
resolveFeedYarnPlies → runtime ply / assetMaterial flag
                    ├→ diameterProfiles[slot][feed] → geometry normals → Solver key
                    └→ color / pbr / repeat → drawYarnSimulation
                                              ├→ rowYarnPly / sequence mask / legacy suppression
                                              ├→ buildYarnUvStrip / parallel offset
                                              └→ WebGL materialMaps / Canvas brush fallback
```

## 唯一字段选择与实际显示的区别

| 字段 | 写入 / authority | 当前派生与消费者 | fallback / 冲突优先级 |
|---|---|---|---|
| Yarn身份 | assignment.yarnId；actions/yarnLibrary:109–129、Cam setFeeds | brush:125–138按String(id)查Asset | 不按名称、Yarn1/Yarn2标签匹配；具体运行时Feed3槽2未提供，实际ID为UNKNOWN |
| color | Asset可选字段；normalizer及项目导入；现UI主要编辑Asset名称/类别/PBR；Legacy颜色UI写yarnPlies | resolver:12–19 → row material → backend tint/texture | 有效Asset→normalized primary→灰默认；不是companion color；显示还受maps/mask/backend影响 |
| diameter | Asset可选正数；Legacy主纱滑条/包导入 | resolver→Simulation:153–175逐slot/course profile；geometry:211–217、ribbon:108–139、solver缓存 | Asset→primary→.24模型单位；第二显式slot不取companion .14；真实直径UNKNOWN |
| PBR | Asset.pbr，经importYarnPbr/clear/import；registry持原图 | resolver:20–28→brush→shader | 任一有效Asset map即用Asset整组，缺图中性；无map才继承Legacy整组，不按图混合旧源 |
| physicalRepeatLengthMm | Asset.pbr；setYarnPbrPhysicalRepeatLength | resolver:29–36→UV strip:42–63 | 正数Asset独立优先；仅无Asset maps才允许Legacy repeat；否则未设→/48模型单位 |
| source | resolver逐字段ASSET/LEGACY_FALLBACK/DEFAULT | adapter用它判断assetMaterial | 不能完整解释processed scan、最终显示色或实测置信度；无字段asset adapter直接返回primary，source视图不保留 |

因此字段选择函数是唯一的，不能继续写“所有Asset永远共享旧直径”。但“它最后显示什么颜色/几根纱”不能只凭Asset对象回答。

## Renderer内的隐式可见strand策略 — FACT

`yarnTextureBrush.js:135–138`任一ASSET source就标assetMaterial；`drawYarnSimulation.js:43–53`依据该标记或slot数量决定Legacy companion和mask：

| Feed条件 | 是否额外画enabled Legacy companion | sequence mask |
|---|---|---|
| 单slot，无任何Asset材质字段 | 是 | 活动Legacy plies使用 |
| 单slot，仅加Asset.color、diameter、repeat或任一map | 否 | 该Asset ply绕过 |
| 多slot、均无Asset字段 | 否；显式slots照画 | 无字段slots使用 |
| 多slot、混合有/无字段 | 否 | 仅无字段slots使用 |
| Pattern预览、不传Feed | toggle照常控制Legacy层 | 使用 |

**INFERENCE / MAINT-004（MEDIUM）**：兼容策略有意且文档已说明，但可见strand数量依赖材质provenance而非只依赖assignment，是未来改材料字段时的具体交叉风险。添加一个color/repeat也可能去掉Legacy附加纱。不是证明工厂真实纱数错误，不恢复另一套正式topology。

## 两个后端的实际差异

| 情况 | Canvas | WebGL | 归类 |
|---|---|---|---|
| Legacy textureStrength=0 | tint/brush处理保留0语义 | drawStrip:336–339用Number(v)||.75，发.75 | MAINT-005；本轮actual method+fake GL复现 |
| Legacy scan useOriginalColor=false | tintedCache取处理后纹理 | materialMaps只请求raw processedDataUrl/imageCache，不读开关/tintedCache | 冷缓存时无ready raw图；曾加载original后仍显示原图；source-confirmed兼容风险 |
| 非零yarnSequence mask，无贴图行 | base后再multiply/.38 mask | mask直接替换tint；任一别的材质有map可全局开启UV | 相同配置可因backend或其他Feed材质改变显示；不适用于绕过mask的Asset行 |
| physicalRepeat / Normal/Roughness/AO/Metallic | createPattern/描边，无等价物理UV及五图shader | UV strip + 简化shader | 能力降级本身合理；不能宣称相同物理尺度/视觉验收 |

旧scan控件`yarnScanTextureControls()`当前**不在主sidebar渲染**（`yarnPlyPanel.js:386–458`；`validate-left-sidebar-modules.mjs:47–51`），所以不声称用户当前能点该隐藏slider。上述参数可由合法Legacy项目携带，仍是活动兼容输入。

## PBR替换与repeat — FACT / UNKNOWN

`importPbrFiles()`返回maps+preview，不含repeat（yarnScanTexture:263–264）；`importYarnPbr()`整体替换pbr（actions/yarnLibrary:75–78）。已有22.987再换一张Normal，旧图组和repeat均消失；UV回退/48。本轮actual action+importer fixture复现repeat属性丢失，见 [probe-results.json](probe-results.json)。整组替换是既有行为，**UNKNOWN**是repeat应清除还是保留的产品策略；不应给新图无依据套旧标尺。MAINT-006记录的是标尺与资源替换耦合且缺明确验收。

## 健康 / 未核验

FACT：partial Asset maps不混Legacy图；显式Feed slots不会被Legacy companion toggle关闭；diameter profile进入geometry/solver key，color/maps/repeat不成为target solver参数。张力仅记录，placement保存但绘制仍parallel。Renderer未复制Cam规则，Normal/AO/Metallic不修改topology。

本轮没有真实GPU、浏览器截图或Legacy checkbox同页Load复验；缓存差异来自当前source/control flow，不伪装成像素测量。`material-probe.mjs`只观察实际drawStrip的uniform和实际PBR action边界，stub范围明确。测试源码大多固定sequence=0/useOriginalColor=true，不能因此覆盖所有分支。
