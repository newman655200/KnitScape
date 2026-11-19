# Dependency Health — Current Local Evidence

FACT：package有7个dependencies、1个devDependency；未修改package/lock，未安装、升级、删除依赖。仅审计当前import、scripts和本轮build，不是CVE/版本安全扫描；未从包体积推断应该删除。

| Dependency | Classification | 实际import / build用途 | runtime / 替代判断与自写复杂度 |
|---|---|---|---|
| `@eastdesire/jscolor ^2.5.1` | REQUIRED | `src/views/yarnPicker.js:3`、`yarnPlyPanel.js:7`，调色器 | 活动UI有真实消费者；原生color input不能直接替代既有RGBA/alpha体验，先定义行为才可替换；无证据应自写 |
| `@fortawesome/fontawesome-free ^7.2.0` | REQUIRED | `src/index.js:1`本地CSS；views/button使用fa类；intranet validator要求无外部kit | 离线图标来源；字体/CSS输出大不等于过度依赖。裁剪有单独成本，未测瓶颈，不列删除项 |
| `@zip.js/zip.js 2.23.0` | REQUIRED | `projectPackage.js:87,112`动态import；ZIP项目/原图、尺寸/CRC检查、lazy registry | 浏览器没有等价完整原生ZIP读写API；自写容器/兼容/完整性检查成本高。没有重复ZIP库 |
| `d3 ^7.8.5` | REQUIRED | `yarnPathGeometry.js:1,380–383` line/CatmullRomOpen；row model测试还使用path/pathRound | 承担路径曲线生成；namespace import经构建可分析，不能假定整个d3都执行。重写曲线会影响测量/几何，当前不建议替换 |
| `lit-html ^2.7.5` | REQUIRED | 主view与各模板import、live/ref/repeat/map/when directives | 活动UI/事件/DOM更新；换框架或手写DOM是大行为迁移，没有维护性收益证据 |
| `split.js ^1.6.5` | REQUIRED | `src/index.js:108–113`分栏resize | 活动交互；原生resize并非相同布局约束/行为。实现可被替换但不是已确认冗余依赖 |
| `vite ^4.4.7` | DEV_ONLY（配置位置可归类MISPLACED） | dev/host/build/preview、vite.config.js及多数SSR validators | 部署静态dist不需要Vite；当前放dependencies对本地build/test可工作，没有当前故障。移动分组属未来发布策略选择，不是本轮操作 |
| `gh-pages ^5.0.0` | DEV_ONLY | package deploy=`vite build ... gh-pages -d dist` | 仅发布命令，位置合理；本轮没有deploy/push。未被src import不等于UNUSED |

未发现重复前端框架、重复图形引擎、两套ZIP库或已证明UNUSED的直接依赖。Three.js当前没有安装/使用，不能把项目当作已有Three.js系统来重构。

## 构建与加载 — FACT

入口 `index.html:12–15 → src/index.js`；Vite config只设`base:"./"`。package的`main:"index.js"`是旧包元数据，浏览器构建不使用它，不构成当前应用入口冲突。

本轮build exit0，Vite4.4.7，747 modules；输出主JS约318.30kB(gzip101.10kB)、动态JS约219.42kB(gzip91.88kB)、CSS111.15kB(gzip34.53kB)，还有字体/图像/小型动态pattern chunks。这里只报构建输出，不把整个chunk归因给单一dependency，也没有做下载/运行时性能benchmark。[build.log](build.log)

生产负载假设为单人在浏览器编辑局部Pattern/机器循环；未测试整机3216针大窗口、设备矩阵或多用户服务。没有证据用模块数量或依赖体积推出D/E架构等级。

## 可复核分析

`inventory.mjs`使用已有transitive esbuild做内存解析（write:false），Node20内置Acorn计算AST函数数，输出只在本报告目录；不新增正式依赖。数据见 [inventory.json](inventory.json)，外部import与src graph均可查。Node内部Acorn接口只用于这次审计，不建议变成正式应用依赖。
