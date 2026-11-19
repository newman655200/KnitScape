import { html, render, nothing } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { createYarnRelaxationWorkbenchController } from "../components/yarnRelaxationWorkbenchController.js";
import { buildYarnSpatialCamera } from "../simulation/yarnSpatialCamera.js";

const number = value => Number.isFinite(value) ? value.toLocaleString("en-US", { maximumFractionDigits: 9 }) : "—";
const small = value => Number.isFinite(value) ? value.toExponential(3) : "—";
const metric = (name, value) => html`<div><dt>${name}</dt><dd>${value ?? "—"}</dd></div>`;
const LIGHTS = { front: [.4, .7, 1], back: [-.4, .7, -1], side: [1, .2, .1] };

export function projectYarnRelaxationAnchors({ view, derivedGeometry }, width, height) {
  if (!view || !derivedGeometry?.mesh || !(width > 0 && height > 0)) return [];
  const camera = buildYarnSpatialCamera(view, width / height, derivedGeometry.mesh.bounds);
  if (camera.status !== "OK") return [];
  const multiply = (matrix, vector) => [0, 1, 2, 3].map(row =>
    vector.reduce((sum, value, column) => sum + matrix[column * 4 + row] * value, 0));
  return derivedGeometry.anchors.map((anchor, index) => {
    const clip = multiply(camera.projection, multiply(camera.view, [...anchor.position, 1]));
    const [x, y, z] = clip.map(value => value / clip[3]);
    return { label: `${index ? "B" : "A"} [${anchor.position.join(", ")}]`, left: (x + 1) * 50, top: (1 - y) * 50,
      visible: clip[3] > 0 && [x, y, z].every(value => Number.isFinite(value) && Math.abs(value) <= 1) };
  });
}

function relaxationView(model, controller, viewport) {
  const { result, initial, derivedGeometry, referenceCases, material, geometryApplyError, error } = model;
  const solved = result?.solverResult, residuals = solved?.residuals, numerical = solved?.numerical;
  const anchors = projectYarnRelaxationAnchors(model, viewport?.clientWidth ?? 0, viewport?.clientHeight ?? 0);
  const light = Object.keys(LIGHTS).find(key => LIGHTS[key].every((value, i) => value === material.lightDirection[i])) ?? "front";
  return html`<section class="yarn-relaxation-workbench" aria-label="纱线空间形变实验 TEST_ONLY">
    <h3>纱线空间形变实验 · TEST_ONLY</h3>
    <p>固定人工九点中心线，端点锚定 A [-6, 0, 0] / B [6, 0, 0] mm；只改变目标长度。
      初始种子、数值参数、控制点位移上限 B = 5 mm、圆管半径 R = 0.18 mm 均相同。</p>
    <fieldset class="spatial-controls"><legend>长度约束 · mm · TEST_ONLY</legend>
      <label>目标长度 (mm)<input data-relaxation-target type="number" min="0" step="0.1"
        .value=${live(Number.isFinite(model.targetLengthMm) ? String(model.targetLengthMm) : "")}
        @input=${event => controller.setTargetLength(event.currentTarget.valueAsNumber)} /></label>
      <div class="relaxation-presets" aria-label="固定目标样例">
        <button type="button" class="btn" @click=${() => controller.setTargetLength(12.5)}>短 · 12.5 mm</button>
        <button type="button" class="btn" @click=${() => controller.setTargetLength(14)}>基准 · 14 mm</button>
        <button type="button" class="btn" @click=${() => controller.setTargetLength(16)}>长 · 16 mm</button>
      </div>
      <label>显示形状<select .value=${live(model.displayMode)} @change=${event => controller.setDisplayMode(event.currentTarget.value)}>
        <option value="initial">初始形状</option><option value="solved">求解形状</option></select></label>
      <label>测试光源<select .value=${live(light)} @change=${event => controller.setMaterial({ lightDirection: LIGHTS[event.currentTarget.value] })}>
        <option value="front">前上方</option><option value="back">后上方</option><option value="side">侧方</option></select></label>
      <label>测试粗糙度<input type="number" min=".08" max="1" step=".01" .value=${live(String(material.roughness))}
        @input=${event => controller.setMaterial({ roughness: event.currentTarget.valueAsNumber })} /></label>
    </fieldset>
    <div class="spatial-view-controls">
      <button type="button" class="btn" @click=${() => controller.setView({ yaw: 0, pitch: 0 })}>正面 +Z</button>
      <button type="button" class="btn" @click=${() => controller.setView({ yaw: Math.PI, pitch: 0 })}>背面 −Z</button>
      <button type="button" class="btn" @click=${() => controller.fit()}>适配共同边界</button>
      <button type="button" class="btn" ?disabled=${!derivedGeometry || !!geometryApplyError} @click=${() => controller.closeup()}>末端截面特写</button>
    </div>
    <p>初始形状与三个参考解共用相机，切换目标不会自动缩放。拖动 / 方向键旋转，滚轮 / ＋ / − 缩放；“适配共同边界”恢复比较视图。</p>
    <div class="relaxation-scene">
      <div class="spatial-viewport" data-relaxation-viewport></div>
      <div class="relaxation-anchor-overlay" aria-hidden="true">${anchors.filter(anchor => anchor.visible).map(anchor =>
        html`<span class="relaxation-anchor" style=${`left:${anchor.left}%;top:${anchor.top}%`}>${anchor.label}</span>`)}</div>
    </div>
    <p role="status" data-relaxation-status>状态：${model.phase} · Renderer：${model.rendererStatus.status}
      ${model.phase === "PENDING" ? " · 计算中；旧结果已清空。" : ""}
      ${derivedGeometry ? ` · 当前显示：${model.displayMode === "initial" ? "初始形状" : "求解形状"}` : " · 当前无可显示形状"}</p>
    ${error ? html`<p class="spatial-error" role="alert">${error.code}：${error.message}</p>` : nothing}
    ${geometryApplyError ? html`<p class="spatial-error" role="alert">GeometryApplyStatus：${geometryApplyError.status} · ${geometryApplyError.diagnostic}</p>` : nothing}
    ${model.materialError ? html`<p class="spatial-error" role="alert">MaterialInputStatus：INVALID · ${model.materialError}</p>` : nothing}
    <dl class="spatial-metrics">
      ${metric("初始 XYZ 积分 (mm)", number(initial?.xyzLength?.value))}
      ${metric("求解目标 (mm)", number(model.targetLengthMm))}
      ${metric("求解 XYZ 积分 (mm)", number(result?.xyzLength?.value))}
      ${metric("求解长度误差 (mm)", small(solved?.signedLengthResidualMm))}
      ${metric("求解相对误差", small(solved?.relativeLengthResidual))}
      ${metric("当前显示 XYZ 积分 (mm)", number(derivedGeometry?.xyzLength?.value))}
      ${metric("求解采样最大 Z (mm)", number(numerical?.maxZMm))}
      ${metric("求解采样 Z 范围 (mm)", number(numerical?.zRangeMm))}
      ${metric("求解采样最大曲率 (1/mm)", number(numerical?.maxSampledCurvaturePerMm))}
      ${metric("求解锚点偏移 (mm)", small(residuals?.maxAnchorDisplacementMm))}
      ${metric("求解一阶驻点残差", residuals?.stationarityApplicable === false ? "不适用：弦长边界" : small(residuals?.stationarity))}
      ${metric("求解迭代 / 评估", solved ? `${solved.iterations} / ${solved.evaluations}` : "—")}
    </dl>
    <div class="relaxation-table-wrap"><table class="relaxation-results">
      <caption>共同边界参考结果 · 固定种子 / 同参数 / 缓存数据，仅用于 TEST_ONLY 比较</caption>
      <thead><tr><th>目标 mm</th><th>实际 mm</th><th>误差 mm</th><th>采样最大 Z mm</th><th>采样 Z 范围 mm</th>
        <th>采样最大曲率 1/mm</th><th>锚点偏移 mm</th><th>状态</th></tr></thead>
      <tbody>${referenceCases.map(item => html`<tr><td>${number(item.targetLengthMm)}</td><td>${number(item.xyzLength?.value)}</td>
        <td>${small(item.solverResult?.signedLengthResidualMm)}</td><td>${number(item.solverResult?.numerical?.maxZMm)}</td>
        <td>${number(item.solverResult?.numerical?.zRangeMm)}</td><td>${number(item.solverResult?.numerical?.maxSampledCurvaturePerMm)}</td>
        <td>${small(item.solverResult?.residuals?.maxAnchorDisplacementMm)}</td><td>${item.status}${item.reason ? ` / ${item.reason}` : ""}</td></tr>`)}</tbody>
    </table></div>
    <details class="spatial-diagnostics"><summary>当前求解残差、数值设置与来源</summary>
      <p>Rule：${result?.ruleVersion ?? initial?.ruleVersion ?? "—"} · ProjectGeneration：${result?.projectGeneration ?? initial?.projectGeneration ?? "—"}
        · FeedYarnStructureRevision：${result?.feedYarnStructureRevision ?? initial?.feedYarnStructureRevision ?? "—"}</p>
      <p>初始与求解长度均由 Round4 XYZ 导数范数积分得到。初始积分不表示满足当前目标；上方求解误差只对应当前求解结果。</p>
      <p>求解诊断 — 采样最小 Z：${number(numerical?.minZMm)} mm；最大控制点位移：${number(residuals?.maxControlDisplacementMm)} mm；
        位移超限：${small(residuals?.maxDisplacementViolationMm)} mm；积分误差估计：${small(result?.xyzLength?.errorEstimate)} mm。</p>
      <p>数值参数是未标定的 dimensionless bending/proximity 权重，非材料刚度或真实张力。管面 128 环 × 32 径向分段，测试 UV 重复长度 1.5 mm。</p>
      <pre>${JSON.stringify(solved ?? { status: model.phase, reason: error?.code }, null, 2)}</pre>
      <p>Value：九点人工公式、目标长度、B = 5、R = 0.18；Unit：mm；Source：固定合成样例；
        Principle：长度等式约束优化、Round4 积分与平行传输；Confidence：TEST_ONLY_UNCALIBRATED；Applicable state：无物理载荷的人工几何。</p>
      <p>${result?.diagnostics?.map(item => `${item.code}：${item.message}`).join(" / ")}</p>
    </details>
    <p class="spatial-boundary">Z 极值与曲率均为每段 65 点采样估计，不是认证边界。有限半径接触：NOT_EVALUATED / 未验证。
      本实验未进行真实材料力学或生产松弛标定，不从 SOP、CN、旧二维 Solver 或 PBR 反推形状，不写入项目事实。</p>
  </section>`;
}

export function createYarnRelaxationWorkbench({ container, context, session, createWorker, createRenderer }) {
  let controller, viewport = null, observer = null, disposed = false;
  const redraw = () => { if (!disposed) render(relaxationView(controller.model, controller, viewport), container); };
  controller = createYarnRelaxationWorkbenchController({ context, session, createWorker, createRenderer, onChange: redraw });
  try {
    redraw(); viewport = container.querySelector("[data-relaxation-viewport]"); controller.mount(viewport);
    const ResizeObserver = viewport.ownerDocument.defaultView.ResizeObserver;
    if (ResizeObserver) { observer = new ResizeObserver(redraw); observer.observe(viewport); }
  } catch (error) { disposed = true; observer?.disconnect(); controller.dispose(); render(nothing, container); throw error; }
  return {
    updateContext(next) { controller.updateContext(next); },
    exportSession: () => controller.exportSession(),
    get derivedGeometry() { return controller.model.derivedGeometry; },
    dispose() { if (disposed) return; disposed = true; observer?.disconnect(); controller.dispose(); render(nothing, container); },
  };
}
