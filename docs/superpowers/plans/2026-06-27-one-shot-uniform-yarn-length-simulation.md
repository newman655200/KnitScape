# 单次均匀纱长模拟实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将右侧“模拟”改为单次静态求解，并保证 60×80 重复线圈在纱长 1.03 和 1.05 下具有稳定、均匀、可复现的形状。

**Architecture:** 全局状态只保存递增的模拟请求序号，不保存持续开启开关。`runSimulation` 内部控制器消费新请求并缓存当时的组织图及归一化形变描述符；普通重绘复用缓存，只有下一个请求才重新求解。`yarnSimulation` 先按稳定线圈签名统一组内弧高比例，再绘制所有线圈，安全距离只提供组级最大上限。

**Tech Stack:** JavaScript ES modules、lit-html、D3 Path、Canvas 2D、Vite SSR 测试、Node `assert`

---

## 文件结构

- Create: `src/actions/yarnLengthSimulationSnapshot.js`：管理一次性请求消费、组织图快照和几何描述符快照。
- Modify: `src/state.js`：用请求序号替换持续模式布尔值。
- Modify: `src/components/runSimulation.js`：按钮发出单次请求，预览控制器捕获或复用几何快照。
- Modify: `src/simulation/yarnSimulation.js`：生成、统一、返回并复用归一化形变描述符。
- Modify: `scripts/validate-yarn-length-simulation-toggle.mjs`：验证一次请求只求解一次，普通编辑不产生新请求。
- Modify: `scripts/validate-yarn-length-scaling.mjs`：验证 1.03/1.05 均匀性、确定性和快照复用。
- Modify: `KnitScape_单面布技术文档.md`：记录 Step 16E 的最终行为和验证证据。

## Task 1: 一次性请求控制器

**Files:**
- Create: `src/actions/yarnLengthSimulationSnapshot.js`
- Test: `scripts/validate-yarn-length-simulation-toggle.mjs`

- [ ] **Step 1: 先写控制器失败测试**

在 `scripts/validate-yarn-length-simulation-toggle.mjs` 的 Vite 测试段加载新模块，并加入真实状态转换断言：

```js
const { createYarnLengthSimulationSnapshotController } =
  await server.ssrLoadModule(
    "/src/actions/yarnLengthSimulationSnapshot.js"
  );

const controller = createYarnLengthSimulationSnapshotController(0);
assert.equal(controller.consume(0).capture, false);
assert.equal(controller.consume(1).capture, true);

const snapshot = {
  pattern: { width: 4, height: 8, pixels: [1] },
  geometry: new Map([["0:1", { apply: true, sagittaRatio: 0.25 }]]),
};
controller.store(snapshot);

assert.equal(controller.consume(1).capture, false);
assert.equal(controller.consume(1).snapshot, snapshot);
assert.equal(controller.consume(2).capture, true);
```

- [ ] **Step 2: 运行测试并确认按预期失败**

Run: `npm run validate:yarn-length-toggle`

Expected: FAIL，错误指向 `/src/actions/yarnLengthSimulationSnapshot.js` 不存在。

- [ ] **Step 3: 实现最小控制器**

创建 `src/actions/yarnLengthSimulationSnapshot.js`：

```js
export function createYarnLengthSimulationSnapshotController(
  initialRequestId = 0
) {
  let handledRequestId = initialRequestId;
  let snapshot = null;

  function consume(requestId) {
    const capture = requestId !== handledRequestId;
    if (capture) handledRequestId = requestId;
    return { capture, snapshot: capture ? null : snapshot };
  }

  function store(nextSnapshot) {
    snapshot = nextSnapshot;
  }

  return {
    consume,
    store,
    hasSnapshot: () => snapshot !== null,
  };
}
```

- [ ] **Step 4: 运行专项测试**

Run: `npm run validate:yarn-length-toggle`

Expected: 控制器断言通过；旧持续开关断言可能继续失败，并留到 Task 3 按新语义更新。

- [ ] **Step 5: 创建提交检查点**

Run: `git add src/actions/yarnLengthSimulationSnapshot.js scripts/validate-yarn-length-simulation-toggle.mjs && git commit -m "test: define one-shot yarn simulation requests"`

Expected: 若本机仍未配置 Git identity，只记录该阻塞，不修改全局或仓库身份配置，继续保留工作区改动。

## Task 2: 均匀、可复用的几何描述符

**Files:**
- Modify: `src/simulation/yarnSimulation.js`
- Test: `scripts/validate-yarn-length-scaling.mjs`

- [ ] **Step 1: 先增加 1.03、1.05 和确定性失败测试**

把现有 60×80 全上针样本扩展为两档，并要求相同输入两次输出完全一致：

```js
const uniformPurlPattern = Bimp.empty(60, 80, 1);
const uniformBaselinePaths = capturePaths(
  uniformPurlPattern,
  [{ ...uniformBasePly, lengthScaleY: 1 }],
  mainColor
);

for (const lengthScaleY of [1.03, 1.05]) {
  const first = captureSimulation(
    uniformPurlPattern,
    [{ ...uniformBasePly, lengthScaleY }],
    mainColor,
    { captureYarnLengthGeometry: true }
  );
  const second = captureSimulation(
    uniformPurlPattern,
    [{ ...uniformBasePly, lengthScaleY }],
    mainColor,
    { captureYarnLengthGeometry: true }
  );

  assertUniformRepeatedPathResponse(
    uniformBaselinePaths,
    first.paths,
    `60x80 purl uniform yarn length ${lengthScaleY.toFixed(2)}`
  );
  assert.deepEqual(first.paths, second.paths);
  assert.deepEqual(
    Array.from(first.geometry.entries()),
    Array.from(second.geometry.entries())
  );
}
```

`captureSimulation()` 必须返回 `simulate()` 的几何快照：

```js
function captureSimulation(patternFixture, yarnPlies, color, options = {}) {
  const harness = createCanvasHarness();
  const result = simulate(
    patternFixture,
    [0],
    ["rgba(250,250,250,1)"],
    1,
    yarnPlies,
    options
  );
  result.stopSim();
  return {
    paths: getCubicStrokePaths(harness.operations, color),
    geometry: result.yarnLengthGeometrySnapshot,
  };
}
```

- [ ] **Step 2: 增加快照复用失败测试**

同一测试中把第一次求解的描述符传回模拟器，验证重放路径一致，并在源代码静态检查中禁止重放分支调用 `solveSagittaForTargetLength()`：

```js
const captured = captureSimulation(
  uniformPurlPattern,
  [{ ...uniformBasePly, lengthScaleY: 1.05 }],
  mainColor,
  { captureYarnLengthGeometry: true }
);
const replayed = captureSimulation(
  uniformPurlPattern,
  [{ ...uniformBasePly, lengthScaleY: 1.05 }],
  mainColor,
  { yarnLengthGeometrySnapshot: captured.geometry }
);
assert.deepEqual(replayed.paths, captured.paths);
```

- [ ] **Step 3: 运行测试并确认失败原因**

Run: `npm run validate:yarn-length-scaling`

Expected: FAIL，因为 `simulate()` 尚未返回 `yarnLengthGeometrySnapshot`，也不接受捕获/重放选项。

- [ ] **Step 4: 在模拟器中建立稳定签名和描述符接口**

在 `simulate()` options 中加入：

```js
captureYarnLengthGeometry = false,
yarnLengthGeometrySnapshot = null,
```

形变描述符键和稳定组键采用确定性数据，不包含颜色、运行顺序或随机值：

```js
function getLengthGeometryKey(plyIndex, yarnLink) {
  return `${plyIndex}:${yarnLink.index}`;
}

function getUniformLengthShapeKey(yarnLink, points, positions) {
  const dx = Math.abs(positions[2].x - positions[1].x) / stitchWidth;
  const dy = Math.abs(positions[2].y - positions[1].y) / stitchHeight;
  return [
    yarnLink.linkType,
    points[1]?.cnType || "",
    points[2]?.cnType || "",
    Math.round(dx * 1000),
    Math.round(dy * 1000),
  ].join("|");
}
```

每个描述符只保存缩放无关参数：

```js
{
  apply: true,
  groupKey,
  normalX,
  normalY,
  sagittaRatio: solvedSagitta / stitchHeight,
  maxSagittaRatio: maxSagitta / stitchHeight,
}
```

- [ ] **Step 5: 先求解再做组级统一**

新增 `createLengthGeometrySnapshot()`：先为每根启用纱线和每条可绘制 link 计算候选描述符，再按 `plyIndex + groupKey` 分组。每组选取候选 `sagittaRatio` 的中位数，并限制在组内最小 `maxSagittaRatio` 内，最后把相同组级比例写回每条 link：

```js
function uniformSagittaRatio(descriptors) {
  const sorted = descriptors
    .map((descriptor) => descriptor.sagittaRatio)
    .sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  const groupMaximum = Math.min(
    ...descriptors.map((descriptor) => descriptor.maxSagittaRatio)
  );
  return Math.min(median, groupMaximum);
}
```

绘制阶段只读取最终描述符；存在传入快照时直接重放，不创建长度统计，也不调用目标长度求解器：

```js
function deformYarnCurveForLength(points, ply, yarnLink, plyIndex) {
  const descriptor = activeLengthGeometrySnapshot?.get(
    getLengthGeometryKey(plyIndex, yarnLink)
  );
  if (!descriptor?.apply) return points;

  const positions = points.map(getYarnCurvePointPosition);
  return createLengthShapeCurvePoints(
    points,
    positions[1],
    positions[2],
    { x: descriptor.normalX, y: descriptor.normalY },
    descriptor.sagittaRatio * stitchHeight
  );
}
```

- [ ] **Step 6: 返回快照并验证均匀性**

`simulate()` 返回值改为：

```js
return {
  relax,
  stopSim,
  yarnLengthGeometrySnapshot: activeLengthGeometrySnapshot,
};
```

Run: `npm run validate:yarn-length-scaling`

Expected: PASS；60×80 的 1.03 和 1.05 组内 spread 均不大于 0.003，连续两次输出完全一致，快照重放与首次路径一致。

- [ ] **Step 7: 运行相关回归测试**

Run: `npm run validate:two-ply-yarn`

Expected: PASS，双纱仍能使用不同纱长，且路径附着关系未被破坏。

## Task 3: 把“模拟”按钮接成单次快照命令

**Files:**
- Modify: `src/state.js`
- Modify: `src/components/runSimulation.js`
- Test: `scripts/validate-yarn-length-simulation-toggle.mjs`

- [ ] **Step 1: 先把静态断言改为新语义**

删除对 `yarnLengthSimulationEnabled: false`、selected toggle class 和持续开关传参的期待，改为：

```js
assert.match(stateSource, /yarnLengthSimulationRequestId:\s*0/);
assert.doesNotMatch(stateSource, /yarnLengthSimulationEnabled/);
assert.match(runSimulationSource, /yarn-length-sim-action/);
assert.match(
  runSimulationSource,
  /yarnLengthSimulationRequestId:\s*GLOBAL_STATE\.yarnLengthSimulationRequestId\s*\+\s*1/
);
assert.match(
  runSimulationSource,
  /createYarnLengthSimulationSnapshotController/
);
assert.doesNotMatch(
  runSimulationSource,
  /!GLOBAL_STATE\.yarnLengthSimulationEnabled/
);
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm run validate:yarn-length-toggle`

Expected: FAIL，因为生产代码仍是持续布尔开关。

- [ ] **Step 3: 修改状态和按钮**

`src/state.js`：

```js
yarnLengthSimulationRequestId: 0,
```

`src/components/runSimulation.js` 的按钮不再显示 selected 状态，每次点击只递增请求序号：

```js
<button
  class="btn solid yarn-length-sim-action"
  @click=${() =>
    dispatch({
      yarnLengthSimulationRequestId:
        GLOBAL_STATE.yarnLengthSimulationRequestId + 1,
    })}>
  ${t("simulation.yarnLength", language)}
</button>
```

- [ ] **Step 4: 在 `runSimulation` 中捕获和重放**

初始化控制器：

```js
const yarnLengthSnapshotController =
  createYarnLengthSimulationSnapshotController(
    GLOBAL_STATE.yarnLengthSimulationRequestId
  );
```

新请求运行当前组织并捕获描述符；普通重绘使用 `Bimp.fromJSON(snapshot.pattern)` 和缓存描述符：

```js
const decision = yarnLengthSnapshotController.consume(
  GLOBAL_STATE.yarnLengthSimulationRequestId
);
const storedSnapshot = decision.snapshot;
const simulationPattern = storedSnapshot
  ? Bimp.fromJSON(storedSnapshot.pattern)
  : GLOBAL_STATE.chart;

const result = simulate(
  simulationPattern,
  GLOBAL_STATE.yarnSequence,
  GLOBAL_STATE.yarnPalette,
  GLOBAL_STATE.simScale,
  GLOBAL_STATE.yarnPlies,
  {
    texturePerformanceMode: GLOBAL_STATE.texturePerformanceMode,
    texturePreviewInteractionActive:
      GLOBAL_STATE.texturePreviewInteractionActive,
    yarnLengthSimulationEnabled:
      decision.capture || Boolean(storedSnapshot),
    captureYarnLengthGeometry: decision.capture,
    yarnLengthGeometrySnapshot: storedSnapshot?.geometry || null,
  }
);

if (decision.capture) {
  yarnLengthSnapshotController.store({
    pattern: GLOBAL_STATE.chart.toJSON(),
    geometry: result.yarnLengthGeometrySnapshot,
  });
}
({ stopSim, relax } = result);
```

`syncState()` 对请求序号立即执行一次捕获；其他现有变更只进入普通防抖重绘：

```js
if (changes.includes("yarnLengthSimulationRequestId")) {
  run();
  return;
}
```

- [ ] **Step 5: 保持静态结果**

“松弛”按钮在已有模拟请求后禁用；模拟器底层在捕获或重放快照时继续拒绝启动 D3 force tick。不得新增 `requestAnimationFrame`、interval 或重复求解定时器。

- [ ] **Step 6: 运行一次性行为测试**

Run: `npm run validate:yarn-length-toggle`

Expected: PASS；同一请求序号的普通编辑只返回已有快照，只有序号递增才返回 `capture: true`。

- [ ] **Step 7: 运行缩放性能测试**

Run: `npm run validate:sim-wheel-performance`

Expected: PASS；滚轮过程继续只做 CSS 预览，停止滚轮后可以重绘缓存描述符，但不重新执行目标长度求解。

## Task 4: 文档与全量验证

**Files:**
- Modify: `KnitScape_单面布技术文档.md`

- [ ] **Step 1: 更新 Step 16E**

追加以下事实，不改写已完成的历史记录：

```md
Step 16E 单次快照与组级均匀性修正（2026-06-27）：右侧“模拟”已由持续布尔模式改为一次性请求。每次点击只对当时的组织图和纱长参数执行一次目标长度求解，并保存组织图快照及缩放无关的线圈形变描述符；普通颜色、直径、纹理、色纱序列和缩放重绘只复用该描述符，不再次运行目标长度求解。重复线圈按组织类型、接触点类型和归一化基础几何形成稳定组，同组统一使用相同弧高比例，组内最严格安全上限只负责限制整组最大形变。

Step 16E 验证记录（2026-06-27）：60×80 全上针样本分别验证纱长 1.03 和 1.05；重复路径组归一化长度响应 spread 不大于 0.003；相同输入连续两次路径和描述符完全一致；缓存重放路径与首次求解一致。模拟完成后不启动 D3 force tick，也不新增持续 requestAnimationFrame。
```

- [ ] **Step 2: 运行全部专项验证**

Run:

```powershell
npm run validate:yarn-length-toggle
npm run validate:yarn-length-scaling
npm run validate:yarn-length-parameters
npm run validate:two-ply-yarn
npm run validate:sim-wheel-performance
npm run validate:i18n
npm run build
git diff --check
```

Expected: 所有命令退出码为 0；构建允许保留现有 Vite chunk-size warning，但不得出现新错误。

- [ ] **Step 3: 浏览器验收**

在 `http://127.0.0.1:5173/` 使用 60×80 全上针：

1. 纱长 1.03，点击一次“模拟”，等待结果固定。
2. 观察多个重复区域，线圈形状应周期一致，无随机忽大忽小。
3. 修改颜色和缩放，确认静态形状不漂移、不重新渐变。
4. 把纱长改为 1.05，确认旧结果保持；再次点击“模拟”后才更新。
5. 确认最左边上下边界无缺口，跨行连接无断线、尖角和明显穿插。

- [ ] **Step 4: 独立只读验收**

派出只读审查智能体，检查：一次性请求状态流、快照是否真正绕过求解、60×80 均匀性测试是否能捕获回归、技术文档是否与代码一致。主智能体随后复查差异并重新运行关键测试，不直接相信智能体结论。

- [ ] **Step 5: 创建最终提交检查点**

Run: `git add src/state.js src/components/runSimulation.js src/simulation/yarnSimulation.js src/actions/yarnLengthSimulationSnapshot.js scripts/validate-yarn-length-simulation-toggle.mjs scripts/validate-yarn-length-scaling.mjs "KnitScape_单面布技术文档.md" docs/superpowers/plans/2026-06-27-one-shot-uniform-yarn-length-simulation.md && git commit -m "feat: make yarn length simulation one-shot and uniform"`

Expected: 若 Git identity 未配置，报告未提交，不擅自设置身份；代码、测试和文档仍保留在工作区。
