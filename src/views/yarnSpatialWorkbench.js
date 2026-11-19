import { html, render, nothing } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { createYarnSpatialWorkbenchController } from "../components/yarnSpatialWorkbenchController.js";

const LIGHTS = { front: [.4, .7, 1], back: [-.4, .7, -1], side: [1, .2, .1] };
const number = value => Number.isFinite(value) ? value.toLocaleString("en-US", { maximumFractionDigits: 6 }) : "—";
const metric = (label, value) => html`<div><dt>${label}</dt><dd>${value ?? "—"}</dd></div>`;

function spatialWorkbenchView(model, controller, relaxation, sop) {
  const { parameters: p, material, derivedGeometry: geometry, rendererStatus, materialError, geometryApplyError } = model;
  const mesh = geometry?.mesh, length = geometry?.xyzLength;
  const numeric = (label, key, min, max, step = 1, disabled = false) => html`<label>${label}
    <input type="number" min=${min} max=${max} step=${step} .value=${live(String(p[key]))} ?disabled=${disabled}
      @change=${event => controller.setParameters({ [key]: event.currentTarget.valueAsNumber })} /></label>`;
  const materialNumber = (label, key, min, max, step) => html`<label>${label}
    <input type="number" min=${min} max=${max} step=${step} .value=${live(String(material[key]))}
      @change=${event => controller.setMaterial({ [key]: event.currentTarget.valueAsNumber })} /></label>`;
  const light = Object.keys(LIGHTS).find(key => LIGHTS[key].every((value, i) => value === material.lightDirection[i])) ?? "front";
  return html`<section class="yarn-spatial-workbench" aria-label="TEST_ONLY 独立三维几何实验">
    <header><h3>独立三维几何实验 · TEST_ONLY</h3>
      <p>人工 XYZ 几何 TEST_ONLY 原型。真实组织空间几何、真实截面尺寸未确认。</p></header>
    ${html`<div class="relaxation-entry"><button type="button" class="btn" data-relaxation-toggle
      aria-expanded=${String(relaxation.active)} @click=${() => relaxation.toggle()}>
      ${relaxation.active ? "关闭纱线空间形变实验" : "打开纱线空间形变实验 · TEST_ONLY"}</button>
      ${relaxation.phase === "loading" ? html`<p role="status">正在加载独立形变实验…</p>` : nothing}
      ${relaxation.error ? html`<p class="spatial-error" role="alert">形变实验加载失败：${relaxation.error}</p>` : nothing}</div>`}
    <div data-relaxation-slot ?hidden=${!relaxation.active}></div>
    <div class="sop-entry"><button type="button" class="btn" data-sop-toggle
      aria-expanded=${String(sop.active)} @click=${() => sop.toggle()}>
      ${sop.active ? "关闭真实 SOP 拓扑" : "打开真实 SOP 拓扑 / 2.5D 假设实验"}</button>
      ${sop.phase === "loading" ? html`<p role="status">正在加载只读 SOP 拓扑…</p>` : nothing}
      ${sop.error ? html`<p class="spatial-error" role="alert">SOP 加载失败：${sop.error}</p>` : nothing}</div>
    <div data-sop-slot ?hidden=${!sop.active}></div>
    <fieldset class="spatial-controls"><legend>几何参数 · TEST_ONLY · mm</legend>
      <label>人工中心线样例<select .value=${live(p.preset)} @change=${event => controller.setParameters({ preset: event.currentTarget.value })}>
        <option value="line">直线 · 12 mm</option><option value="s-curve">空间 S 曲线</option>
        <option value="helix">螺旋 · R3 / 2 圈 / 螺距 2 mm</option><option value="ring">闭合圆环 · R3 mm</option>
      </select></label>
      <label>截面<select .value=${live(p.section)} @change=${event => controller.setParameters({ section: event.currentTarget.value })}>
        <option value="circle">圆截面</option><option value="ellipse">椭圆截面</option></select></label>
      ${numeric(p.section === "circle" ? "半径 R (mm)" : "半轴 A (mm)", "radiusA", .001, nothing, .01)}
      ${numeric("半轴 B (mm)", "radiusB", .001, nothing, .01, p.section === "circle")}
      ${numeric("径向分段 (3–256)", "radialSegments", 3, 256)}
      ${numeric("中心线点数 (2–2048)", "sampleCount", 2, 2048)}
    </fieldset>
    <fieldset class="spatial-controls"><legend>测试材质与光照 · TEST_ONLY</legend>
      ${materialNumber("粗糙度", "roughness", .08, 1, .01)}
      ${materialNumber("各向异性", "anisotropy", -.85, .85, .05)}
      <label>光源方向<select .value=${live(light)} @change=${event => controller.setMaterial({ lightDirection: LIGHTS[event.currentTarget.value] })}>
        <option value="front">前上方</option><option value="back">后上方</option><option value="side">侧方</option></select></label>
      ${materialNumber("光源强度", "lightIntensity", 0, 10, .1)}
      ${materialNumber("环境光", "ambient", 0, 2, .05)}
      <label>表面显示<select .value=${live(material.mode)} @change=${event => controller.setMaterial({ mode: event.currentTarget.value })}>
        <option value="solid">测试纯色材质</option><option value="uv-reference">UV 参考格</option></select></label>
    </fieldset>
    <div class="spatial-view-controls" aria-label="TEST_ONLY 三维视图">
      <span>视图 · TEST_ONLY</span>
      <button type="button" class="btn" @click=${() => controller.setView({ yaw: 0, pitch: 0 })}>正面 +Z</button>
      <button type="button" class="btn" @click=${() => controller.setView({ yaw: Math.PI, pitch: 0 })}>背面 −Z</button>
      <button type="button" class="btn" @click=${() => controller.fit()}>适配</button>
      <button type="button" class="btn" ?disabled=${!!geometryApplyError || geometry?.status !== "OK" || geometry?.centerline?.closed}
        @click=${() => controller.closeup()}>末端截面特写</button>
    </div>
    <p class="spatial-help">拖动或方向键旋转；滚轮 / ＋ / − 缩放；Home 适配。开口路径含实体端盖，闭合圆环无端盖。实验上限 100000 顶点，超限输入会报 INVALID。</p>
    <div class="spatial-viewport" data-spatial-viewport></div>
    <p class="spatial-renderer-status" role="status">RendererStatus：${rendererStatus.status}${rendererStatus.diagnostic ? ` · ${rendererStatus.diagnostic}` : ""}</p>
    ${geometryApplyError ? html`<p class="spatial-error" role="alert">GeometryApplyStatus：${geometryApplyError.status} · ${geometryApplyError.diagnostic}</p>` : nothing}
    ${materialError ? html`<p class="spatial-error" role="alert">MaterialInputStatus：INVALID · ${materialError}</p>` : nothing}
    <dl class="spatial-metrics">
      ${metric("GeometryType", geometry?.geometryType)}
      ${metric("GeometryStatus", geometry?.status ?? "PENDING")}
      ${metric("CenterlinePoints", geometry?.centerline?.points.length)}
      ${metric("RadialSegments", mesh?.counts?.radialSegments)}
      ${metric("VertexCount", mesh?.counts?.vertices)}
      ${metric("TriangleCount", mesh?.counts?.triangles)}
      ${metric("XYZLength", length ? `${number(length.value)} mm` : "—")}
      ${metric("IntegrationError", length ? `${length.errorEstimate.toExponential(3)} mm` : "—")}
      ${metric("FrameStatus", geometry?.frames?.status ?? "NOT_BUILT")}
      ${metric("MeshStatus", mesh?.status ?? "NOT_BUILT")}
      ${metric("GeometrySource", "TEST_ONLY")}
      ${metric("TestUVRepeat", geometry?.testUVRepeatLengthMm ? `${number(geometry.testUVRepeatLengthMm)} mm` : "—")}
    </dl>
    ${geometry?.status !== "OK" ? html`<p class="spatial-error" role="alert">${geometry?.diagnostics?.map(item => `${item.code}：${item.message}`).join(" / ")}</p>` : nothing}
    <details class="spatial-diagnostics"><summary>长度分段、来源与诊断</summary>
      <p>Rule：${geometry?.ruleVersion} · ProjectGeneration：${geometry?.projectGeneration} · FeedYarnStructureRevision：${geometry?.feedYarnStructureRevision}</p>
      <p>积分方法：${length?.method ?? "—"}；分段长度 (mm)：${length?.segmentLengths.map(number).join(" / ") ?? "—"}</p>
      <p>来源为人工样例与本地输入；单位 mm；XYZ 导数范数积分与平行传输截面扫掠；未标定，仅适用于无物理载荷的几何实验。</p>
      <p>${geometry?.diagnostics?.map(item => `${item.code}：${item.message}`).join(" / ")}</p>
    </details>
    <p class="spatial-boundary">全局自接触：NOT_EVALUATED / 未验证；物理松弛：NOT_IMPLEMENTED / 未实现。
      本区使用测试材质，未接入原二维扫描 PBR 六贴图；测试 UV 重复长度独立于原 Physical UV。
      原二维 Feed × Yarn 的 VALIDATED 仅属于其软件结果，不适用于本实验。</p>
  </section>`;
}

export function createYarnSpatialWorkbench({ container, context, session,
  loadRelaxationWorkbench = () => import("./yarnRelaxationWorkbench.js"),
  loadSopWorkbench = () => import("./sopTopologyWorkbench.js") }) {
  let controller, disposed = false, currentContext = context, child = null, pending = null, epoch = 0;
  let active = false, phase = "inactive", loadError = null, childSession = session?.relaxation?.session ?? null;
  let sopChild = null, sopPending = null, sopEpoch = 0, sopActive = false, sopPhase = "inactive", sopError = null;
  let sopSession = session?.sop?.session ?? null;
  const redraw = () => { if (!disposed) render(spatialWorkbenchView(controller.model, controller, relaxation, sop), container); };
  function releaseSop() {
    sopEpoch++; sopPending = null;
    if (sopChild) { sopSession = sopChild.exportSession(); sopChild.dispose(); sopChild = null; }
    sopPhase = "inactive";
  }
  function activateSop() {
    sopActive = true; sopPhase = "loading"; sopError = null; redraw();
    const token = ++sopEpoch, generation = currentContext.projectGeneration;
    const slot = container.querySelector("[data-sop-slot]");
    const current = () => !disposed && sopActive && token === sopEpoch &&
      currentContext.projectGeneration === generation && (!currentContext.workbenchMode || currentContext.workbenchMode === "pbr25d") &&
      slot?.isConnected !== false;
    sopPending = Promise.resolve().then(loadSopWorkbench).then(module => {
      if (!current()) return;
      sopChild = module.createSopTopologyWorkbench({ container: slot, context: currentContext, session: sopSession });
      sopPhase = "ready"; redraw();
    }).catch(error => {
      if (!current()) return;
      sopPhase = "error"; sopError = String(error.message || error); redraw();
    }).finally(() => { if (token === sopEpoch) sopPending = null; });
  }
  const sop = { get active() { return sopActive; }, get phase() { return sopPhase; }, get error() { return sopError; },
    toggle() { if (disposed) return;
      if (sopActive) { sopActive = false; releaseSop(); sopError = null; redraw(); } else activateSop(); } };
  function releaseChild() {
    epoch++; pending = null;
    if (child) { childSession = child.exportSession(); child.dispose(); child = null; }
    phase = "inactive";
  }
  function activateChild() {
    active = true; phase = "loading"; loadError = null; redraw();
    const token = ++epoch, generation = currentContext.projectGeneration, revision = currentContext.feedYarnStructureRevision;
    const slot = container.querySelector("[data-relaxation-slot]");
    const current = () => !disposed && active && token === epoch && currentContext.projectGeneration === generation &&
      currentContext.feedYarnStructureRevision === revision && (!currentContext.workbenchMode || currentContext.workbenchMode === "pbr25d") &&
      slot?.isConnected !== false;
    pending = Promise.resolve().then(loadRelaxationWorkbench).then(module => {
      if (!current()) return;
      child = module.createYarnRelaxationWorkbench({ container: slot, context: currentContext, session: childSession });
      phase = "ready"; redraw();
    }).catch(error => {
      if (!current()) return;
      phase = "error"; loadError = String(error.message || error); redraw();
    }).finally(() => { if (token === epoch) pending = null; });
  }
  const relaxation = { get active() { return active; }, get phase() { return phase; }, get error() { return loadError; },
    toggle() {
      if (disposed) return;
      if (active) { active = false; releaseChild(); loadError = null; redraw(); }
      else activateChild();
    } };
  controller = createYarnSpatialWorkbenchController({ context, session, onChange: redraw });
  try {
    redraw(); controller.mount(container.querySelector("[data-spatial-viewport]"));
    if (session?.relaxation?.active) activateChild();
    if (session?.sop?.active) activateSop();
  } catch (error) { disposed = true; controller.dispose(); render(nothing, container); throw error; }
  return {
    updateContext(next) {
      const newProject = next.projectGeneration !== currentContext.projectGeneration;
      const newRevision = next.feedYarnStructureRevision !== currentContext.feedYarnStructureRevision;
      currentContext = next;
      if (newProject || next.workbenchMode && next.workbenchMode !== "pbr25d") {
        releaseChild(); active = false; loadError = null;
        releaseSop(); sopActive = false; sopError = null;
        if (newProject) sopSession = null;
        if (newProject) childSession = null;
      } else if (newRevision && pending) { releaseChild(); if (active) activateChild(); }
      child?.updateContext(next); sopChild?.updateContext(next); controller.updateContext(next); redraw();
    },
    exportSession: () => Object.freeze({ ...controller.exportSession(), relaxation: Object.freeze({ active,
      session: child?.exportSession() ?? childSession }), sop: Object.freeze({ active: sopActive,
      session: sopChild?.exportSession() ?? sopSession }) }),
    async ready() { await Promise.all([pending, sopPending]); },
    get derivedGeometry() { return controller.model.derivedGeometry; },
    dispose() { if (disposed) return; disposed = true; releaseChild(); releaseSop(); controller.dispose(); render(nothing, container); },
  };
}
