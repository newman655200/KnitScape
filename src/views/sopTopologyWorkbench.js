import { html, svg, render, nothing } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { createSopTopologyWorkbenchController } from '../components/sopTopologyWorkbenchController.js';
import { download } from '../utils.js';

const number = value => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 6 }) : '—';
const color = yarnIndex => yarnIndex === 0 ? '#ffb45b' : '#58d5ed';
const matches = (item, filter) => filter === 'all' || item.yarnId === filter;
const describe = link => `Feed ${link.feedIndex + 1} · Yarn ${link.yarnIndex + 1} (${link.yarnId}) · link ${link.index} · row ${link.row} · needle ${link.needle}\n` +
  `${link.source.originalCnIndex}→${link.source.finalCnIndex} / ${link.target.originalCnIndex}→${link.target.finalCnIndex}\n` +
  `${link.boundary} (${link.sourceBoundary}→${link.targetBoundary}) · ${link.pathOrigin}\n${link.sourceEvidence.path}`;

function downloadAudit(report) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  try { download(url, 'knitscape-geometry-audit.json'); }
  finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

function geometryAuditView(model, controller) {
  const report = model.auditReport, findings = report?.findings ?? [];
  const correction = model.correctionReport;
  const { localAudit: _localAudit, ...intersections } = correction?.intersections ?? {};
  const selected = findings.find(item => item.id === model.auditSelectedFindingId);
  const { findings: _findings, sources: _sources, ...summary } = report ?? {};
  const sourceLabel = id => {
    const source = report?.sources?.[id];
    return source ? `row ${source.row ?? '—'} / needle ${source.needle ?? '—'} / Feed ${source.feedIndex == null ? '—' : source.feedIndex + 1} / Yarn ${source.yarnId ?? '—'} / ${source.geometryRole ?? '—'}` : id;
  };
  return html`<details class="spatial-diagnostics" data-swatch-audit-panel open>
    <summary>Round 11.1 · 接头单案例与三维几何审计</summary>
    <p>按需异步检查完整生成窗口；纱线、坐标和证据视图筛选不缩小诊断范围。相机及 PBR 修改复用结果，几何变化使结果失效。</p>
    <p>分类仅针对当前视觉几何。CN_REFERENCE 不等于接触，视觉遮挡不等于管体穿透；未证明合法性的关系保留 UNKNOWN，不自动修正拓扑或几何。</p>
    <div class="spatial-view-controls">
      <button class="btn" data-swatch-audit ?disabled=${!model.derivedGeometry || model.auditRunning || model.correctionRunning || model.profileRunning}
        @click=${() => controller.auditSwatch()}>${model.auditRunning ? '正在审计完整样布…' : '检测完整样布几何'}</button>
      <button class="btn" data-swatch-audit-cancel ?disabled=${!model.auditRunning}
        @click=${() => controller.cancelGeometryAudit()}>取消检测</button>
      <button class="btn" data-swatch-audit-clear-selection ?disabled=${!model.auditPathIds}
        @click=${() => controller.clearAuditSelection()}>退出结果定位</button>
      <button class="btn" data-swatch-audit-export ?disabled=${!report}
        @click=${() => downloadAudit(controller.exportGeometryAudit())}>导出完整诊断 JSON</button>
      <button class="btn" data-swatch-joint-case ?disabled=${!model.derivedGeometry || model.correctionRunning}
        @click=${() => controller.selectRound11JointCase()}>选择 Round 11.1 单案例</button>
      <button class="btn" data-swatch-trim-diagnostic ?disabled=${model.auditRunning || model.correctionRunning || model.profileRunning ||
        model.comparisonState !== 'G0' || !model.jointTargetId || !report?.complete}
        @click=${() => controller.createTrimDiagnostic()}>生成 Gt 单接头失败对照</button>
      <button class="btn" data-swatch-audit-correct ?disabled=${model.auditRunning || model.correctionRunning || model.profileRunning ||
        model.comparisonState !== 'G0' || !model.jointTargetId || !report?.complete}
        @click=${() => controller.applyGeometryCorrection()}>${model.correctionRunning ? '正在检查单接头候选…' : '生成 Gn 单接头候选'}</button>
      <button class="btn" data-swatch-joint-cancel ?disabled=${!model.correctionRunning}
        @click=${() => controller.cancelGeometryCorrection()}>取消候选检查</button>
    </div>
    <div class="spatial-view-controls"><label>同条件几何对照<select data-swatch-comparison .value=${live(model.comparisonState)}
      @change=${event => controller.setComparisonState(event.currentTarget.value)}>
      <option value="G0" ?disabled=${!model.comparisonStates.G0}>G0 · 原始显示基线（仍有已知几何问题）</option>
      <option value="Gt" ?disabled=${!model.comparisonStates.Gt}>Gt · 截短失败对照（不推荐）</option>
      <option value="Gn" ?disabled=${!model.comparisonStates.Gn}>Gn · 单接头候选（尚未验收）</option></select></label></div>
    <p data-swatch-joint-target>单案例来源：${model.jointTargetId ?? '未选择'}。选择后保留完整邻域；只对已核验来源的 row 22 / needle 16 / yarnIndex 1 接头生成对照。</p>
    <p data-swatch-comparison-status>当前 ${model.comparisonState} · ${model.geometryVersion ?? '—'}。切换保留相机、PBR 和筛选；旧诊断与性能结果失效。Gn 保持候选，须通过同视角与全场景复审。</p>
    ${correction ? html`<pre data-swatch-correction-report>${JSON.stringify({ status: correction.status, reason: correction.reason,
      comparisonState: correction.comparisonState, recommendation: correction.recommendation, policy: correction.policy,
      applied: correction.applied, counts: correction.counts, pathId: correction.pathId,
      interfaces: correction.interfaces, meshIntegrity: correction.meshIntegrity, arcLengthMm: correction.arcLengthMm,
      deltaArcLengthMm: correction.deltaArcLengthMm, section: correction.section, intersections }, null, 2)}</pre>
      <p>显示过渡仍为 VISUAL_ASSUMPTION，物理关系保持 UNKNOWN；请在当前几何重新检测完整样布。</p>` : nothing}
    <p role="status" data-swatch-audit-status>${model.auditRunning ? 'RUNNING' : report?.status ?? model.auditProgress?.phase ?? 'NOT_RUN'}
      ${report ? report.complete === true ? ' · 完整诊断完成' : ' · 诊断未完成，不可据此判定无相交' : ''}</p>
    ${model.auditRunning ? html`<pre data-swatch-audit-progress>${JSON.stringify(model.auditProgress, null, 2)}</pre>` : nothing}
    ${report ? html`<pre data-swatch-audit-summary>${JSON.stringify(summary, null, 2)}</pre>
      <p>分类计数与导出包含全部结果；下表显示前 ${Math.min(100, findings.length)} / ${findings.length} 条。定位只显示原始来源段，可旋转检查；完整来源保留在 JSON 中。</p>
      <label>按诊断 ID 定位<input data-swatch-audit-id placeholder="从完整 JSON 复制结果 ID"
        @change=${event => controller.selectAuditFinding(event.currentTarget.value.trim())}></label>
      <div class="sop-table-scroll"><table class="sop-table" data-swatch-audit-findings>
        <thead><tr><th>结果与分类</th><th>关系 / 几何证据</th><th>原始几何来源</th></tr></thead>
        <tbody>${findings.slice(0, 100).map(item => html`<tr data-swatch-audit-finding=${item.id}>
          <td><button class="btn" @click=${() => controller.selectAuditFinding(item.id)}>${item.id}</button><br>${item.classification}</td>
          <td>${item.relation}<br>${item.geometryEvidence?.kind}<p>${item.reason}</p></td>
          <td>${item.sourcePathIds.map(id => html`<p>${sourceLabel(id)}<br>${id}</p>`)}</td>
        </tr>`)}</tbody>
      </table></div>` : nothing}
    ${selected ? html`<details open><summary>选中结果 · occurrence / link / Feed / Yarn / YarnChain / 几何来源</summary>
      <pre data-swatch-audit-selected>${JSON.stringify({ finding: selected,
        sources: selected.sourcePathIds.map(id => report.sources?.[id] ?? { id }) }, null, 2)}</pre></details>` : nothing}
  </details>`;
}

function swatchView(model, controller) {
  const { topology: t, derivedGeometry: g, selectionFilter: filter, materialAssets: assets } = model;
  const yarns = [...new Map((t?.strands ?? []).map(item => [item.yarnId, item])).values()];
  const paths = (g?.paths ?? []).filter(item => (!model.auditPathIds || model.auditPathIds.includes(item.id)) && matches(item, model.yarnFilter) &&
    Object.entries(filter).every(([key, value]) => value === null || value === '' ||
      (key === 'occurrenceId' ? Object.entries(item.provenance ?? {}).some(([field, ids]) =>
        /(?:^occurrenceIds$|OccurrenceIds$)/.test(field) && Array.isArray(ids) && ids.includes(value)) : item[key] === value)));
  const selected = g?.paths.find(item => item.id === model.selectedLinkId);
  const coordinate = (label, key) => html`<label>${label}<input type="number" min="0" step="1" data-swatch-filter=${key}
    .value=${live(filter[key] == null ? '' : String(filter[key]))} placeholder="全部"
    @change=${event => controller.setSelectionFilter({ [key]: event.currentTarget.value === '' ? null : event.currentTarget.valueAsNumber })}></label>`;
  return html`<section class="sop-topology-workbench sop-swatch" aria-label="完整三维视觉样布">
    <h3>SOP → 三维视觉样布</h3>
    <p>当前设计窗口 · SOURCE_DERIVED 组织来源 / VISUAL_ASSUMPTION 线圈形状与空间关系。TEST_ONLY，非实物纱线连续性或尺寸预测。</p>
    <div class="spatial-controls">
      <label>显示视图<select data-swatch-evidence .value=${live(model.evidenceView ? 'evidence' : 'visual')}
        @change=${event => controller.setEvidenceView(event.currentTarget.value === 'evidence')}>
        <option value="visual">完整视觉样布 · 含独立假设过渡</option><option value="evidence">证据分段视图 · 隐去假设过渡</option></select></label>
      <label>接头诊断显示<select data-swatch-debug .value=${live(model.debugMode)}
        @change=${event => controller.setDebugMode(event.currentTarget.value)}>
        <option value="pbr">PBR</option><option value="unlit">无贴图纯色 / 无光照</option>
        <option value="normals">几何法线</option><option value="wireframe">线框 / 边界</option></select></label>
      <label>显示纱线<select data-swatch-yarn .value=${live(model.yarnFilter)} @change=${event => controller.setYarnFilter(event.currentTarget.value)}>
        <option value="all">全部纱线</option>${yarns.map(item => html`<option value=${item.yarnId}>${item.yarnIndex === 0 ? '主纱' : '氨纶 / 第二纱'} · ${item.name}</option>`)}</select></label>
      ${coordinate('Feed 索引（0 起）', 'feedIndex')}${coordinate('row 索引（0 起）', 'row')}${coordinate('needle 索引（0 起）', 'needle')}
      <label>源 occurrence ID<input data-swatch-occurrence .value=${live(filter.occurrenceId ?? '')} placeholder="全部"
        @change=${event => controller.setSelectionFilter({ occurrenceId: event.currentTarget.value.trim() })}></label>
    </div>
    <fieldset class="spatial-controls"><legend>现有 PBR 资产分配 · 仅本次三维视图</legend>
      ${yarns.map(item => html`<label>${item.name}<select data-swatch-material=${item.yarnId}
        .value=${live(String(model.materialBindings[item.yarnId] ?? item.yarnId))}
        @change=${event => controller.setMaterialBinding(item.yarnId, event.currentTarget.value)}>
        ${assets.map(asset => html`<option value=${String(asset.id)}>${asset.name}${asset.pbr ? ' · PBR' : ' · 无贴图'}</option>`)}</select></label>`)}
      <label>扫描纱线方向 · VISUAL_ASSUMPTION<select data-swatch-axis .value=${live(model.scanAxis)} @change=${event => controller.setScanAxis(event.currentTarget.value)}>
        <option value="x">图像 X → 沿纱线 U</option><option value="y">图像 Y → 沿纱线 U</option></select></label>
      <label>视觉半径 (mm) · TEST_ONLY<input data-swatch-radius type="number" min="0.001" step="0.005"
        .value=${live(String(model.options.radiusMm))} @change=${event => controller.setOptions({ radiusMm: event.currentTarget.valueAsNumber })}></label>
    </fieldset>
    <p>没有贴图时，可在「纱线库」中给已有纱线导入 PBR，再回到本视图选择。UV 沿中心线 / 截面周向；扫描方向与尺度待校准。</p>
    <div class="spatial-view-controls">
      <button class="btn" data-swatch-front @click=${() => controller.setView({ yaw: 0, pitch: 0 })}>样布正面</button>
      <button class="btn" data-swatch-back @click=${() => controller.setView({ yaw: Math.PI, pitch: 0 })}>样布反面</button>
      <button class="btn" @click=${() => controller.setView({ yaw: .8, pitch: .4 })}>样布斜视</button>
      <button class="btn" @click=${() => controller.setView({ yaw: Math.PI / 2, pitch: 0 })}>样布边缘</button>
      <button class="btn" @click=${() => controller.fit()}>适配完整样布</button>
      <button class="btn" ?disabled=${!g} @click=${() => controller.focusSelected()}>局部放大</button>
      <button class="btn" @click=${() => controller.generateSwatch()}>重新生成</button>
      <button class="btn" @click=${() => controller.setHypothesisEnabled(false)}>局部来源检查</button>
    </div>
    <p>同一模型旋转正反面；拖动 / 方向键旋转 360°，滚轮 / ＋ / − 缩放。开放边界，不自动铺贴或闭合。</p>
    <div class="spatial-viewport" data-sop-viewport></div>
    <p role="status" data-swatch-status>${model.error ? `样布已清除：${model.error}` : g ? '样布生成完成' : `等待当前有效快照或正在生成：${t?.reason ?? t?.status}`} · Renderer ${model.rendererStatus.status}</p>
    <div class="sop-evidence-banner">形状、Z、视觉半径、旧圈保持形状及独立过渡均为 VISUAL_ASSUMPTION。过渡不进入 YarnChain 长度统计或物理接触求解。MACHINE_CONFIRMED：无新增；PHYSICALLY_VALIDATED：未使用。</div>
    <details class="spatial-diagnostics" open><summary>窗口覆盖 / 边界 / 未生成单元</summary><pre data-swatch-coverage>${JSON.stringify(g?.coverage ?? null, null, 2)}</pre></details>
    <button class="btn" data-swatch-profile ?disabled=${!g || model.profileRunning || model.auditRunning || model.correctionRunning}
      @click=${() => controller.profileSwatch()}>${model.profileRunning ? '正在测量旋转性能…' : '测量当前样布旋转性能'}</button>
    <p>按当前画面自动旋转一周后恢复视角；记录 120 帧 CPU 提交与可用的 GPU 计时。测量期间请保持页面前台。</p>
    ${model.profileReport ? html`<pre data-swatch-profile-report>${JSON.stringify(model.profileReport, null, 2)}</pre>` : nothing}
    ${geometryAuditView(model, controller)}
    <details class="spatial-diagnostics" open><summary>PBR 各通道与渲染资源</summary><pre data-swatch-render-diagnostics>${JSON.stringify(model.renderDiagnostics, null, 2)}</pre></details>
    <label>选择几何段（当前筛选前 60 条）<select data-swatch-select .value=${live(model.selectedLinkId ?? '')}
      @change=${event => controller.selectLink(event.currentTarget.value)}><option value="">选择后查看来源</option>
      ${paths.slice(0, 60).map(path => html`<option value=${path.id}>row ${path.row} / needle ${path.needle} / Feed ${path.feedIndex + 1} / ${path.geometryRole ?? 'VISUAL_ASSUMPTION'}</option>`)}</select></label>
    <details class="spatial-diagnostics" ?open=${!!selected}><summary>occurrence / link / CN / YarnChain 来源与假设</summary>
      <pre>${selected ? JSON.stringify({ id: selected.id, evidenceStatus: selected.evidenceStatus, geometryRole: selected.geometryRole, provenance: selected.provenance }, null, 2) : '按 Feed、纱线、row、needle 或 occurrence 筛选，再选择几何段。'}</pre></details>
  </section>`;
}

function topologyView(model, controller) {
  if (model.mode === 'VISUAL_SWATCH_TEST_ONLY') return swatchView(model, controller);
  const { topology: t, roi, options, derivedGeometry: g, yarnFilter } = model;
  const enabled = model.mode === 'SPATIAL_HYPOTHESIS_TEST_ONLY';
  const links = (t?.links ?? []).filter(item => matches(item, yarnFilter));
  const occurrences = (t?.occurrences ?? []).filter(item => matches(item, yarnFilter));
  const yarns = [...new Map((t?.strands ?? []).map(item => [item.yarnId, item])).values()];
  const selected = links.find(item => item.id === model.selectedLinkId);
  const continuity = t?.continuity;
  const edges = (continuity?.edges ?? []).filter(item => matches(item, yarnFilter));
  const chains = (continuity?.chains ?? []).filter(item => matches(item, yarnFilter));
  const linksById = new Map(links.map(link => [link.id, link]));
  const input = (label, key) => html`<label>${label}<input type="number" min="0" step="1" data-sop-roi=${key}
    .value=${live(String(roi[key]))} @input=${event => controller.setROI({ [key]: event.currentTarget.valueAsNumber })}></label>`;
  return html`<section class="sop-topology-workbench" aria-label="真实 SOP 拓扑与空间假设">
    <h3>真实 SOP 拓扑 / 2.5D 假设实验</h3>
    <button class="btn" data-swatch-generate @click=${() => controller.generateSwatch()}>生成完整三维视觉样布 · Round9</button>
    <p>本轮指定 SOP 已确认设备：润山单面大圆机。型号、针筒直径、总 Feed 与软件模板映射：UNKNOWN；视图读取当前 Machine 快照，不自动辨认机型。</p>
    <p class="sop-evidence-banner">${model.mode} · 软件路径与逻辑引用可追溯；物理上下 SPATIAL_ORDER / 接触 CONTACT：UNKNOWN。</p>
    <fieldset class="spatial-controls"><legend>局部 ROI · 0-based 索引</legend>
      ${input('针位 needleIndex（16 = 第17针）', 'needleIndex')}${input('起始 rowIndex', 'rowStart')}${input('结束 rowIndex', 'rowEnd')}
      <label>独立 Yarn 筛选<select data-sop-yarn .value=${live(yarnFilter)} @change=${event => controller.setYarnFilter(event.currentTarget.value)}>
        <option value="all">全部纱线 · 各 Feed 独立</option>${yarns.map(item => html`<option value=${item.yarnId}>${item.yarnIndex === 0 ? '主纱' : '第二纱'} · ${item.name}</option>`)}
      </select></label>
    </fieldset>
    <p role="status">Topology：${t?.status} ${t?.reason ?? ''} · scope=${t?.identity?.scope ?? 'machine required'} ·
      projectGeneration=${t?.identity?.projectGeneration ?? '—'} · revision=${t?.identity?.feedYarnStructureRevision ?? '—'}</p>
    <p>${t?.operations.map(item => `row ${item.row}（第${item.row + 1}横列）/ Feed ${item.feedIndex + 1} / ${item.operation}`).join(' → ')}</p>
    ${t?.mechanismEvidence ? html`<details class="spatial-diagnostics" data-sop-mechanism>
      <summary>Round 8 · K/T/M 机器机制证据</summary>
      <p>本机适用性：${t.mechanismEvidence.machineModelApplicability.status}。
        ${t.mechanismEvidence.machineModelApplicability.unknownReason}</p>
      <p>通用原理均为 GENERAL_REFERENCE_ONLY；下表是证据说明，不生成本机事件、时序、运动轨迹或真实空间约束。</p>
      <style>
        [data-sop-mechanism] .sop-table { table-layout: fixed; min-width: 660px; }
        [data-sop-mechanism] th, [data-sop-mechanism] td { white-space: normal; overflow-wrap: anywhere; vertical-align: top; }
      </style>
      <div style="overflow-x: auto"><table class="sop-table"><caption>软件动作 / 通用参考 / 润山本机证据</caption>
        <thead><tr><th>操作与软件定义</th><th>通用机器机制参考</th><th>润山本机确认状态</th><th>后续空间建模</th></tr></thead>
        <tbody>${t.mechanismEvidence.operations.map(item => html`<tr data-sop-mechanism-operation=${item.operation}>
          <td><strong>${item.operation} · ${item.software.evidenceStatus}</strong><p>${item.software.definition}</p>
            <details><summary>源码依据</summary><ul>${item.software.evidenceSource.map(source => html`<li>${source}</li>`)}</ul></details></td>
          <td><strong>${item.generalReference.label}</strong><br>${item.generalReference.evidenceStatus}
            <p>${item.generalReference.description}</p><p>适用条件：${item.generalReference.condition}</p>
            <ul>${item.generalReference.evidenceSource.map(source => html`<li><a href=${source.url} target="_blank" rel="noopener noreferrer">${source.title}</a> · ${source.locator}</li>`)}</ul></td>
          <td data-machine-evidence=${item.machineSpecific.evidenceStatus}><strong>${item.machineSpecific.evidenceStatus}</strong>
            <p>未知原因：${item.machineSpecific.unknownReason}</p></td>
          <td>空间建模影响：${item.spatialImpact}</td>
        </tr>`)}</tbody>
      </table></div>
    </details>` : nothing}
    <p>来源 XY · MODEL_NEEDLE_PITCH；不加入 Z。橙=主纱，青=第二纱；虚线=CLIPPED 外部端点。重叠保持原坐标，可用筛选分别检查。</p>
    <svg class="sop-source-svg" data-sop-source role="img" aria-label="真实 SOP 已应用 XY 路径" viewBox="0 0 10 10">
      <g data-sop-paths>${links.map(link => svg`<path d=${link.pathModel} fill="none" stroke=${color(link.yarnIndex)}
        stroke-width=${link.id === model.selectedLinkId ? '4' : '2'} vector-effect="non-scaling-stroke"
        stroke-dasharray=${link.boundary === 'CLIPPED' ? '6 3' : 'none'} tabindex="0" role="button"
        aria-label=${describe(link)} data-sop-link=${link.id}
        @click=${() => controller.selectLink(link.id)} @focus=${() => controller.selectLink(link.id)}
        @keydown=${event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); controller.selectLink(link.id); } }}>
        <title>${describe(link)}</title></path>`)}</g>
    </svg>
    <h4>Round 7 · 连续性证据</h4>
    <p>上图记录软件拓扑与 CN 引用；下图只为现有 link 标注连续性证据。KTTK 是同针跨 Feed 操作序列，不能拼成一根实物纱。</p>
    <p data-sop-continuity-status>物理连续性：UNKNOWN · 供纱身份 / 实物路径方向：UNKNOWN。源事实 CONFIRMED_FROM_SOURCE 只确认软件邻接；
      候选 CANDIDATE_FROM_MODEL 只限同软件 Feed/course，不能据此确认真实供纱。</p>
    <p>绿色实线：MODEL_PATH_ADJACENCY 软件事实；紫色虚线：SAME_FEED_COURSE_CANDIDATE；灰色点线：ROI_CLIPPED；红色点线：拒绝连接。
      关系数允许同一 link 同时有软件事实和候选分类，不代表增加纱段。</p>
    <svg class="sop-source-svg" data-sop-continuity role="img" aria-label="纱线连续性证据候选图" viewBox="0 0 10 10">
      <g>${edges.map(edge => {
        const link = linksById.get(edge.linkId);
        if (!link) return nothing;
        const candidate = edge.evidenceStatus === 'CANDIDATE_FROM_MODEL';
        const software = edge.edgeType === 'MODEL_PATH_ADJACENCY';
        return svg`<path d=${link.pathModel} data-sop-continuity-edge=${edge.id} data-evidence-status=${edge.evidenceStatus}
          fill="none" stroke=${candidate ? '#d5a0ff' : software ? '#64b8a5' : edge.evidenceStatus === 'REJECTED' ? '#ff6b72' : '#929ba6'}
          stroke-width=${software ? '4' : '2'} stroke-dasharray=${candidate ? '7 4' : software ? 'none' : '2 4'}
          vector-effect="non-scaling-stroke" tabindex="0" role="button" aria-label=${`${edge.edgeType} · ${edge.evidenceStatus} · link ${link.index}`}
          @click=${() => controller.selectLink(link.id)} @focus=${() => controller.selectLink(link.id)}
          @keydown=${event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); controller.selectLink(link.id); } }}>
          <title>${edge.edgeType} · ${edge.evidenceStatus}\n${edge.evidenceSource}\n物理连续性：UNKNOWN</title></path>`;
      })}</g>
    </svg>
    <details class="spatial-diagnostics"><summary>连续性分类计数 / 方向 / 边界 / 来源</summary>
      <pre>${JSON.stringify({ counts: continuity?.counts, edges: selected ? edges.filter(edge => edge.linkId === selected.id) : edges }, null, 2)}</pre>
    </details>
    <div class="sop-table-scroll"><table class="sop-table"><caption>YarnChain 派生候选 · 当前筛选 ${chains.length} 条 · 不复制 CN/link · 不自动闭合</caption>
      <thead><tr><th>Feed / Yarn</th><th>证据</th><th>引用 link</th><th>首尾边界</th></tr></thead>
      <tbody>${chains.map(chain => html`<tr data-sop-chain=${chain.id}><td>${chain.feedIndex + 1} / ${chain.yarnIndex + 1}</td>
        <td>${chain.evidenceStatus}<br>物理：${chain.physicalContinuity}</td>
        <td><button class="btn" @click=${() => controller.selectLink(chain.linkIds[0])}>${chain.linkIds.map(id => linksById.get(id)?.index ?? id).join(' → ')}</button></td>
        <td>${chain.startBoundary.state} → ${chain.endBoundary.state}</td></tr>`)}</tbody>
    </table></div>
    <p>链长与 23/24 cm/100针：NOT_COMPARABLE。当前候选不具备同一物理纱段、材料状态、窗口和归一化分母的证据。</p>
    <details class="spatial-diagnostics" ?open=${!!selected}><summary>点击路径查看完整 provenance / 邻接与边界</summary>
      <pre class="sop-provenance">${selected ? JSON.stringify(selected, null, 2) : '悬停显示来源；点击或键盘 Enter 选择单独链接。'}</pre>
    </details>
    <div class="sop-table-scroll"><table class="sop-table"><caption>独立 occurrence · 当前筛选 ${occurrences.length} 个；共享 CN 不合并身份</caption>
      <thead><tr><th>row / Feed</th><th>Yarn</th><th>path / 类型</th><th>原 CN → 终 CN</th><th>迁移链</th></tr></thead>
      <tbody>${occurrences.map(item => html`<tr data-sop-occurrence=${item.id}><td>${item.row} / ${item.feedIndex + 1}</td>
        <td>${item.yarnIndex + 1} · ${item.yarnId}</td><td>${item.pathIndex} / ${item.cnType}</td>
        <td>${item.originalCnIndex} → ${item.finalCnIndex}</td><td>${item.migrationChain.map(step => step.cnIndex).join(' → ')}</td></tr>`)}</tbody>
    </table></div>
    <label class="sop-enable"><input type="checkbox" data-sop-enable .checked=${enabled}
      @change=${event => controller.setHypothesisEnabled(event.currentTarget.checked)}>显式启用 SPATIAL_HYPOTHESIS_TEST_ONLY</label>
    <p class="sop-evidence-banner">假设空间几何 / 未验证穿套 / 非物理预测。关闭开关即清除候选。假设参数只在本次视图会话中保留。</p>
    <fieldset class="spatial-controls" ?disabled=${!enabled}><legend>ASSUMPTION_TEST_ONLY · 人工几何参数</legend>
      <label>高度幅值 (mm)<input data-sop-amplitude type="number" min="0" step="0.05" .value=${live(String(options.amplitudeMm))}
        @input=${event => controller.setOptions({ amplitudeMm: event.currentTarget.valueAsNumber })}></label>
      <label>截面半径 (mm) · TEST_ONLY<input data-sop-radius type="number" min="0.0001" step="0.001" .value=${live(String(options.radiusMm))}
        @input=${event => controller.setOptions({ radiusMm: event.currentTarget.valueAsNumber })}></label>
    </fieldset>
    <div class="spatial-view-controls" ?hidden=${!enabled}>
      <button class="btn" @click=${() => controller.setView({ yaw: 0, pitch: 0 })}>正面</button>
      <button class="btn" @click=${() => controller.setView({ yaw: 1.1, pitch: .45 })}>斜视深度</button>
      <button class="btn" @click=${() => controller.fit()}>适配 SOP 几何</button>
      <button class="btn" data-sop-closeup ?disabled=${!g} @click=${() => controller.focusSelected()}>选中链接细管特写</button>
      <span>拖动 / 方向键旋转；滚轮 / ＋ / − 缩放；Home 适配。</span>
    </div>
    <div class="spatial-viewport" data-sop-viewport ?hidden=${!enabled}></div>
    ${enabled ? html`<p role="status">Renderer：${model.rendererStatus.status} · Round5 资格：${g?.relaxationEligibility.status ?? 'NOT_BUILT'}</p>` : nothing}
    ${model.error ? html`<p role="alert" class="spatial-error">候选已清除：${model.error}</p>` : nothing}
    <p>Round5 形变资格：UNSUPPORTED_CONSTRAINTS。复杂 SOP 路径未满足固定双端点与均匀纵向位置的适用条件；不进行目标拟合。</p>
    <p>模型针距换算：25.4 / ${t?.scale?.machineGauge ?? '—'} = ${number(t?.scale?.needlePitchMm)} mm；仅机针节距模型，布面真实圈距/松弛尺寸 UNKNOWN。
      截面半径由人工输入；默认 0.002 mm 为通过局部曲率保护的细管测试值，非实测纱径，适用无物理载荷的假设几何。</p>
    ${g ? html`<div class="sop-table-scroll"><table class="sop-table"><caption>同一局部完整链接窗口 · 模型针距换算 mm · 独立 Round4 积分</caption>
      <thead><tr><th>Feed / Yarn / link</th><th>源 XY (mm)</th><th>假设 XYZ (mm)</th><th>XYZ − XY (mm)</th></tr></thead>
      <tbody>${g.paths.filter(item => matches(item, yarnFilter)).map(item => html`<tr><td>${item.feedIndex + 1} / ${item.yarnIndex + 1} / ${item.provenance.sourceLink.index}</td>
        <td>${number(item.sourceXYLength.value)}</td><td>${number(item.xyzLength.value)}</td><td>${number(item.deltaLengthMm)}</td></tr>`)}</tbody>
      </table></div>` : nothing}
    ${g?.chainAudit ? html`<div class="sop-table-scroll"><table class="sop-table" data-sop-chain-lengths>
      <caption>YarnChain XYZ 弧长审计 · 唯一 link 各计一次 · 不新增 transition，不焊接 · ${g.chainAudit.status}</caption>
      <thead><tr><th>Feed / Yarn</th><th>连接检查</th><th>源 XY (mm)</th><th>XYZ (mm)</th><th>差值 / 比例</th></tr></thead>
      <tbody>${g.chainAudit.chains.filter(item => matches(item, yarnFilter)).map(chain => html`<tr>
        <td>${chain.feedIndex + 1} / ${chain.yarnIndex + 1}</td><td>${chain.geometryStatus}</td>
        <td>${number(chain.lengths.sourceXYMm)}</td><td>${number(chain.lengths.xyzMm)}</td>
        <td>${number(chain.lengths.deltaMm)} mm / ${number(chain.lengths.ratio)}</td></tr>`)}</tbody>
      </table></div>
      <details class="spatial-diagnostics"><summary>C0 / G1 / C1 / frame / tube seam / 端盖检查</summary>
        <p>逐段假设几何不等于已连接管体。端点、切线或 frame 不满足连接条件时保留 DISCONTINUITY；不以平滑遮掩 kink。ROI 边界保持开放。</p>
        <pre>${JSON.stringify(g.chainAudit, null, 2)}</pre>
      </details>` : nothing}
    <details class="spatial-diagnostics"><summary>M1 / M3 与路径来源（不同窗口不能直接相减）</summary>
      <p>M1：原 Solver 窗口，cm/100 machine needles。M3：NOT_AVAILABLE_IN_SNAPSHOT；不在视图补算。局部 XY/XYZ 是 ROI 完整链接含 EXTERNAL 端点，不能对齐 23/24 目标。</p>
      <pre>${JSON.stringify({ metrics: t?.metrics, scale: t?.scale, localLengths: g?.lengths, sectionEvidence: g?.sectionEvidence,
        scaleEvidence: g?.scaleEvidence, heightRule: g?.paths[0]?.provenance.heightRule }, null, 2)}</pre>
    </details>
    <details class="spatial-diagnostics"><summary>快照身份 / Feed×Yarn material state / 四类边</summary>
      <p>YARN_ADJACENCY：软件沿纱路径邻接；CN_REFERENCE：逻辑引用；SPATIAL_ORDER / CONTACT：UNKNOWN。跨 row 显示连接的机台物理连续性 UNKNOWN。</p>
      <pre>${JSON.stringify({ identity: t?.identity, strands: t?.strands, cnReferences: t?.cnReferences, spatialRelations: t?.spatialRelations }, null, 2)}</pre>
    </details>
  </section>`;
}

export function createSopTopologyWorkbench({ container, context, session, createRenderer, buildHypothesis }) {
  let controller, disposed = false;
  const redraw = () => {
    if (disposed) return;
    render(topologyView(controller.model, controller), container);
    controller.mount(container.querySelector('[data-sop-viewport]'));
    // Browser bounds use the exact applied SVG curves; no second path approximation.
    const paths = container.querySelector('[data-sop-paths]'), source = container.querySelector('[data-sop-source]');
    if (paths?.getBBox && controller.model.topology?.links.length) {
      const box = paths.getBBox(), pad = Math.max(box.width, box.height, .1) * .08;
      source.setAttribute('viewBox', `${box.x - pad} ${box.y - pad} ${box.width + 2 * pad} ${box.height + 2 * pad}`);
      container.querySelector('[data-sop-continuity]')?.setAttribute('viewBox', source.getAttribute('viewBox'));
    }
  };
  controller = createSopTopologyWorkbenchController({ context, session, createRenderer, buildHypothesis, onChange: redraw });
  redraw(); controller.mount(container.querySelector('[data-sop-viewport]'));
  return { updateContext: next => controller.updateContext(next), exportSession: () => controller.exportSession(),
    ready: () => controller.ready(), get derivedGeometry() { return controller.model.derivedGeometry; },
    dispose() { if (disposed) return; disposed = true; controller.dispose(); render(nothing, container); } };
}
