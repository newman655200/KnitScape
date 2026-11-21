import { html } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { GLOBAL_STATE, dispatch } from "../state.js";
import { MIN_SIM_SCALE, MAX_SIM_SCALE } from "../constants.js";
import { getCurrentSimulationSnapshots } from "../components/runSimulation.js";
import { yarnAppearanceEditor } from "./yarnLibrary.js";
import { texturePerformanceControls } from "./yarnPlyPanel.js";
import { yarnLengthSolverFeedback, getYarnLengthFeedbackRows } from "./yarnLengthSolverFeedback.js";

function updateView(patch) { dispatch({ pbrView: { ...GLOBAL_STATE.pbrView, ...patch } }); }
function zoom(scale) {
  if (scale < MIN_SIM_SCALE || scale > MAX_SIM_SCALE) return;
  const bounds = document.getElementById("pbr-preview-container").getBoundingClientRect();
  const view = GLOBAL_STATE.pbrView, x = bounds.width / 2, y = bounds.height / 2;
  updateView({ scale, pan: { x: x - (x - view.pan.x) / view.scale * scale,
    y: y - (y - view.pan.y) / view.scale * scale } });
}

export function pbrWorkbench() {
  const active = GLOBAL_STATE.workbenchMode === "pbr25d";
  const view = GLOBAL_STATE.pbrView, snapshots = getCurrentSimulationSnapshots();
  const snapshot = snapshots.machine ?? (snapshots.machineExecutionError ? null : snapshots.pattern);
  const yarnIds = snapshot?.yarnIds ?? [], names = new Map(GLOBAL_STATE.yarnLibrary.map(yarn => [String(yarn.id), yarn.name]));
  const selected = yarnIds.includes(view.visibleYarnId) ? view.visibleYarnId : "";
  const rows = getYarnLengthFeedbackRows(GLOBAL_STATE);
  const pan = view.previewPan ?? view.pan, ratio = (view.previewScale ?? view.scale) / view.scale;
  return html`<section id="pbr-workbench" class=${active ? "" : "workspace-hidden"} aria-hidden=${!active}
    @keydown=${event => event.stopPropagation()} @keyup=${event => event.stopPropagation()}>
    <div class="pbr-preview-main">
      <header class="pbr-workbench-heading">
        <h2>PBR + 2.5D</h2><span>三维空间几何：已移除，算法重新设计中</span>
        <p>二维路径材质预览。</p>
      </header>
      <div class="pbr-preview-toolbar">
        <label>Feed × Yarn <select id="pbr-yarn-select" .value=${live(selected)} ?disabled=${!yarnIds.length}
          @change=${event => updateView({ visibleYarnId: event.currentTarget.value || null })}>
          <option value="" ?selected=${!selected}>全部纱线</option>
          ${yarnIds.map(id => html`<option value=${id} ?selected=${selected === id}>${names.get(id) ?? id}</option>`)}
        </select></label>
        <button type="button" class="btn" @click=${() => updateView({ flipped: !view.flipped })}>${view.flipped ? "反面" : "正面"} · 翻面</button>
        <button type="button" class="btn" aria-label="缩小 PBR 预览" @click=${() => zoom(view.scale * .9)}>−</button>
        <input type="range" min=${MIN_SIM_SCALE} max=${MAX_SIM_SCALE} step="0.1" aria-label="PBR 缩放"
          .value=${String(view.scale)} @input=${event => zoom(Number(event.currentTarget.value))} />
        <button type="button" class="btn" aria-label="放大 PBR 预览" @click=${() => zoom(view.scale * 1.1)}>+</button>
        <button type="button" class="btn" @click=${() => updateView({ scale: 1, pan: { x: 0, y: 0 } })}>适配</button>
      </div>
      <p class="pbr-source-status" role="status">${snapshots.pending ? "计算输入已更新，等待当前结果…"
        : snapshots.machineExecutionError ? `机器配置错误：${snapshots.machineExecutionError}`
        : snapshot?.scope === "machine" ? `Machine · ${GLOBAL_STATE.previewValidity}`
        : "Pattern · DESIGN_PREVIEW（尚无机器执行结果）"}</p>
      <div id="pbr-preview-container" class="simulation-preview-canvas">
        <div class="sim-transform-group ${view.flipped ? "mirrored" : ""}"
          style="transform:translate(${pan.x}px,${pan.y}px) scale(${ratio})">
          <canvas id="pbr-back" class=${view.flipped ? "top" : "bottom"}></canvas>
          <canvas id="pbr-mid" class="mid"></canvas>
          <canvas id="pbr-front" class=${view.flipped ? "bottom" : "top"}></canvas>
        </div>
      </div>
    </div>
    <aside class="pbr-workbench-sidebar">
      <div class="pbr-development-status"><strong>空间功能状态</strong>
        <p>三维纱线几何 / 样布：已移除（2026-11-21），从纱线组织到面料形态的算法重新设计中</p>
      </div>
      <details class="pbr-length-summary"><summary>原二维 Feed × Yarn 长度摘要 · ${rows.length} 项 · ${GLOBAL_STATE.previewValidity}</summary>
        ${active ? yarnLengthSolverFeedback() : null}
      </details>
      ${active ? texturePerformanceControls() : null}
      ${active ? yarnAppearanceEditor() : null}
      <p class="pbr-input-location">Gauge、纱线直径和纱长目标在 Classic 2D 原编辑流程中修改。</p>
    </aside>
  </section>`;
}
