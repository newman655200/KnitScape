# Validator Coverage Semantics

2026-10-17。FACT：scripts共43文件，其中37个独立validate命令+validate.mjs聚合器，另有4个browser-yarn-length助手和1个guide生成器。文件数量不等于断言数量，也不等于端到端流程覆盖率。

| Validator（validate:前缀省略） | 分类 | 方法 | 保护内容 / 不证明什么 | 本轮 |
|---|---|---|---|---|
| yarn-material-authority | DOMAIN; RENDERER; PBR; LEGACY COMPATIBILITY | SSR真实resolver/geometry/state + fake canvas/GL | 材质优先级、独立直径profile、key失效；未测零strength/非零sequence的跨后端一致 | PASS |
| single-only | DOMAIN | 源文本/文件断言 | 单面能力范围；不是实机工艺验证 | PASS |
| code-guide | UI/STATE CONSISTENCY | 源文本+SSR/DOM夹具 | guide映射/链接/生命周期；硬编码旧根路径也被固定 | PASS |
| intranet | RENDERER/BUILD | 读取source/config及已有dist | 本地资源与相对URL；不是GPU画质 | PASS |
| single-ui | DOMAIN/UI | 源文本断言 | 标签/单面范围/默认值；不是织物语义 | PASS |
| i18n | UI | 词典/源码检查 | 语言键覆盖；不是业务定义 | PASS |
| repeat-dimensions | STATE CONSISTENCY; DOMAIN | SSR actions/bitmap + source | repeat/chart尺寸和序列同步；未覆盖stale activeYarn New/Load | PASS |
| two-ply-yarn | RENDERER; LEGACY COMPATIBILITY; PBR | SSR+Canvas/GL夹具+源文本 | 旧双纱/纹理/绘制行为；不证明真实双纱路径或张力 | PASS |
| sim-wheel-performance | STATE CONSISTENCY/RENDERER | 源文本/结构断言 | wheel交互调度结构；不是浏览器性能benchmark | PASS |
| no-yarn-length-simulation | LEGACY COMPATIBILITY | 源文本/结构断言 | 无目标预览路径仍保留；不是所有输入组合集成 | PASS |
| row-length-loop-model | SOLVER NUMERICS; LEGACY COMPATIBILITY | 直接数学assert+源码/文档regex | 弧长/连续性及旧helper；本轮失败于文档精确标题 | FAIL：标题正则 |
| yarn-length-gauge | DOMAIN; SOLVER NUMERICS | 纯函数+SSR geometry+源码 | 单位、周期/窗口、元数据；不等于生产取样已确认 | PASS |
| yarn-length-solver | SOLVER NUMERICS | SSR + dense参考积分 | 当前有界objective、monotonic、solved h复测；参考仍沿用当前窗口定义 | PASS |
| yarn-length-result-integration | STATE CONSISTENCY; SOLVER NUMERICS | 真实actions/state/runner/solver+绘制替身 | 结果发布、应用、变更失效；非实机/真GPU | PASS |
| yarn-length-failure-integration | STATE CONSISTENCY; SOLVER NUMERICS | 真实链路+部分故障注入 | 不可达/mixed/error/max iterations/path应用失败与恢复 | PASS |
| yarn-length-input-integration | INPUT SAFETY; STATE CONSISTENCY | 真实输入action/state/runner夹具 | 非法输入不破坏事实/结果、明确Clear | PASS |
| yarn-length-batch-integration | INPUT SAFETY; STATE CONSISTENCY | 真实actions+批量selection夹具 | 原子预检、多slot隔离、零目标/非法拒绝 | PASS |
| yarn-length-structure-integration | STATE CONSISTENCY; PERSISTENCE | 真实actions/state+package夹具 | ABA、同ID移动、完整替换/重载revision；非所有UI生命周期 | PASS |
| yarn-length-parameters | DOMAIN; LEGACY COMPATIBILITY | SSR/源文本 | Feed/Yarn参数规范化；张力可保存不等于产生力 | PASS |
| yarn-sequence-editor | STATE CONSISTENCY; LEGACY COMPATIBILITY | SSR actions/bitmap+source | 调色/序列/resize；无library延迟请求用例 | PASS |
| central-stitch-toolbar | UI/DOMAIN | 源文本/资产哈希检查 | 工具栏布局/符号；不是工艺动作真实性 | PASS |
| needle-arrangement | DOMAIN; STATE CONSISTENCY | 纯函数+SSR/source | 解析、循环Type、Pattern保持独立 | PASS |
| single-jersey-machine | DOMAIN | 纯函数与源码 | K/T/M、矩阵/尺寸/非法输入；不保证机台起点映射 | PASS |
| single-jersey-simulation-input | DOMAIN | 纯Adapter/bitmap断言 | 动作到0/2/3映射，非完整物理模拟 | PASS |
| single-jersey-cam-editor | DOMAIN; STATE CONSISTENCY | SSR actions/templates+source | Cam/Feed编辑、默认/resize/非法值；非浏览器全流程 | PASS |
| single-jersey-execution-integration | DOMAIN; STATE CONSISTENCY; RENDERER | SSR runner/geometry+画布替身 | 机域到实际模拟输入、结果/overlay；非GPU/机台 | PASS |
| workspace-mode | STATE CONSISTENCY; LEGACY COMPATIBILITY | SSR actions/templates+source | 切工作区/旧Pattern导入不错误替换Machine | PASS |
| yarn-library | DOMAIN; STATE CONSISTENCY; PBR | SSR actions/registry/image夹具 | 资产引用、CRUD、PBR异步安全；不是Pattern库加载generation | PASS |
| pbr-persistence | PERSISTENCE; PBR; LEGACY COMPATIBILITY | 真实ZIP codec/registry+图像夹具 | 原图/manifest/校验/旧数据兼容；不是工厂材料校准 | PASS |
| path-uv-yarn-texture | RENDERER; SOLVER NUMERICS; LEGACY COMPATIBILITY | 数学/SSR+source | 累计U、zoom不变量、跨link/layer连续；不是target业务authority | PASS |
| feed-yarn-pbr-renderer | RENDERER; PBR | SSR+fake image/Canvas/GL | Asset PBR按Feed使用、缓存/生命周期；Legacy scan fixture固定original=true | PASS |
| multi-yarn-renderer | RENDERER; STATE CONSISTENCY | SSR+fake Canvas/GL | 多个显式Yarn独立路径/材质，未认证实物topology | PASS |
| event-driven-render | STATE CONSISTENCY | 源码与fake RAF断言 | 合帧/无无限自刷新；不是性能实测 | PASS |
| texture-cache-lifecycle | RENDERER; PBR; LEGACY COMPATIBILITY | SSR+fake资源/GL | retain/release/eviction与失效；不验证所有参数对应的最终像素 | PASS |
| yarn-simulation-characterization | SOLVER NUMERICS; LEGACY COMPATIBILITY | SSR characterisation | 模板、目标、cache等当前行为不漂移；不证明业务定义正确 | PASS |
| yarn-simulation-modules | MAINTAINABILITY/STRUCTURE | 源文本/模块结构 | 既有分层形状；无循环也不等于好Domain | PASS |
| left-sidebar-modules | MAINTAINABILITY/STRUCTURE | 源文本/regex | owner和旧scan控件不渲染；代码存在不等于当前UI入口 | PASS |

## 业务语义边界

FACT：多数集成validator用Vite SSR加载真实actions/state/solver/geometry，同时用Canvas/Image/计时器/GL夹具捕获调用；这比只检查源码更强，但不是浏览器真实GPU或工厂测量。单独browser助手没有注册进npm validate，本轮未执行。

没有发现任何validator能证明工厂23/8的取样、Feed/路径/负载状态与当前数学函数等价。BUSINESS SEMANTICS / REAL MACHINE VALIDATION当前仍PENDING PROCESS CONFIRMATION；当前窗口参考积分是数学验证，不应归为已通过真实业务语义。

Characterization测试有正当价值：锁住无目标/兼容行为；其PASS仅说明未偏离所固定定义。相反，不应把含顶边窗口、width metadata或精确helper表达式的旧预期当成不可改的业务真值。

## 本轮验证与归因

npm run validate：36/37，exit1，只有row-length-loop-model失败。该测试在scripts/validate-row-length-loop-model.mjs:298–312要求`## 数字. 当前验证结果`，现有文档为`## 7. 软件基线与验证边界`。HEAD文档能匹配，当前文档不能；测试相对HEAD未改；本轮初始hash已含该文档改动，因此不是本轮审计造成，也不是已证明数学算法失败。上一轮文档收敛触发此既有断言。本轮没有修测试/文档。

validate.log还保留Vite/esbuild预构建退出阶段的build canceled/on-resolve stderr；聚合器仅把上述标题断言列入failures。本轮build独立成功，不把这些日志删掉或冒充所有stderr为空；未据此诊断另一个未复现的业务错误。

npm run build：exit0，747 modules；git diff --check：exit0。日志和耗时见checks.json。报告只包含审计输出；最终还有hash/index/refs保护核验。

TEST PASS ≠ PHYSICAL CORRECTNESS；SOLVER CONVERGED ≠ PROCESS VALIDATED；NO CYCLIC IMPORT ≠ GOOD DOMAIN DESIGN；SMALL FILE ≠ MAINTAINABLE；LARGE FILE ≠ UNMAINTAINABLE；LEGACY ≠ DEAD CODE；MULTIPLE FUNCTIONS ≠ DUPLICATE AUTHORITY。
