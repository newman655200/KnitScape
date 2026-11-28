import { html } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { GLOBAL_STATE, dispatch, StateMonitor } from "../state.js";
import { createFabricFormParams } from "../fabricForm/fabricFormParams.js";
import { resolveYarnMaterial, normalizeYarnPlies } from "../domain/yarnMaterial.js";
import { yarnAssetRegistry } from "../yarnTexture/yarnAssetRegistry.js";
import { loadImageFromDataUrl, YARN_PBR_MAP_KEYS } from "../yarnTexture/yarnScanTexture.js";
import { bakeFabricTexture, bakeYarnStrip } from "../fabricTexture/fabricTexturePipeline.js";
import { normalizeFuzzParameters } from "../fabricTexture/yarnFuzz.js";
import { FABRIC_TEXTURE_LIMITATIONS } from "../fabricTexture/metadata.js";
import { sourceImageHasAlpha } from "../fabricTexture/sourceImageAlpha.js";
import { createReviewImage } from "../fabricTexture/review.js";
import { createFabricTextureZip } from "../fabricTexture/textureExport.js";
import { download } from "../utils.js";

const PARAM_FIELDS = [
  ["tex", "线密度", "tex", "0.01"], ["densityGPerCm3", "纤维密度", "g/cm³", "0.01"],
  ["fiberDiameterMm", "纤维直径", "mm", "0.001"], ["E_f", "纤维弹性模量", "N/mm²", "1"],
  ["K", "压缩系数 K", "1", "0.001"], ["phi0", "初始填充率", "1", "0.01"],
];
const FUZZ_FIELDS = [
  ["hairinessIndex", "毛羽指数 H", "1", 0, undefined, 0.1],
  ["meanHairLengthMm", "平均毛长", "mm", 0.001, undefined, 0.01],
  ["hairAngleDeg", "纤维夹角", "°", 0, 90, 1],
  ["maxCurvaturePerMm", "最大曲率", "1/mm", 0, undefined, 0.1],
  ["fiberOpacity", "纤维不透明度", "1", 0, 1, 0.01],
  ["haloStrength", "绒光晕强度", "1", 0, 1, 0.01],
  ["haloWidthR", "绒光晕宽度", "纱芯半径", 0.01, undefined, 0.01],
  ["seed", "随机种子", "整数", undefined, undefined, 1],
];
const MAP_LABELS = { baseColor: "颜色", normal: "法线", roughness: "粗糙度", height: "高度（未使用）",
  ambientOcclusion: "AO", metallic: "金属度" };
let controller = null, monitorRegistered = false;
const active = () => GLOBAL_STATE.workbenchMode === "fabricTexture";
const current = c => controller === c && active() && c.generation === GLOBAL_STATE.projectGeneration;
const refresh = c => { if (current(c)) dispatch({}); };
const nextFrame = () => new Promise(resolve => setTimeout(resolve, 0));
const number = (value, digits = 3) => Number.isFinite(value) ? value.toFixed(digits) : "—";
const hasMap = map => Boolean(map?.assetRef || map?.processedDataUrl || map?.dataUrl);

function createController() {
  const defaults = createFabricFormParams();
  return { generation: GLOBAL_STATE.projectGeneration,
    input: { loopLengthMm: 2.84, nodesPerLoop: 48,
      params: { ...Object.fromEntries(PARAM_FIELDS.map(([key]) => [key, defaults[key]])),
        provenance: Object.fromEntries(PARAM_FIELDS.map(([key]) => [key, defaults.provenance[key]])) } },
    pxPerMm: 200, stripLengthMm: 4, yarnId: String(GLOBAL_STATE.yarnLibrary[0]?.id ?? ""),
    normalGreen: "+Y", fuzzSource: "generated", fuzzBand: "fullScan", fuzzStrength: 0.45,
    fuzzOverrides: {}, material: null, materialLoading: false, materialCache: new Map(),
    result: null, geometry: null, fabric: null, strip: null, settings: null, geometryKey: null,
    worker: null, imageAbort: null, urls: new Set(), imageSequence: 0, jobSequence: 0,
    phase: "idle", status: "设置参数后点击“计算并生成”。", error: "", elapsedMs: 0,
    timer: null, composeTimer: null, composing: false, pendingComposition: false,
    revision: 0, canvas: null, paintKey: null };
}

function endTimer(c) { clearInterval(c.timer); c.timer = null; }
function startTimer(c, phase, message) {
  endTimer(c); c.phase = phase; c.status = message; c.startedAt = performance.now(); c.elapsedMs = 0;
  c.timer = setInterval(() => { c.elapsedMs = performance.now() - c.startedAt; refresh(c); }, 500);
}
function finish(c, message) {
  c.elapsedMs = performance.now() - c.startedAt; endTimer(c); c.phase = "idle"; c.status = message;
}
function cancel(c, message = "已取消。可重新计算或修改参数。") {
  c.jobSequence++; c.worker?.terminate(); c.worker = null;
  c.imageSequence++; c.imageAbort?.abort(); c.materialLoading = false;
  c.pendingComposition = false;
  clearTimeout(c.composeTimer); c.composeTimer = null;
  endTimer(c); c.phase = "idle"; c.status = message; refresh(c);
}
function dispose(c) {
  c.jobSequence++; c.imageSequence++; c.worker?.terminate(); c.imageAbort?.abort();
  endTimer(c); clearTimeout(c.composeTimer);
  for (const url of c.urls) URL.revokeObjectURL(url);
  c.urls.clear(); c.materialCache.clear();
  if (c.canvas) c.canvas.width = c.canvas.height = 1;
  c.canvas = c.geometry = c.result = c.fabric = c.strip = c.material = c.settings = null;
  controller = null;
}
function observeState() {
  if (monitorRegistered) return;
  monitorRegistered = true;
  StateMonitor.register([() => ({ syncState(state, changes) {
    const c = controller;
    if (!c) return;
    if (state.workbenchMode !== "fabricTexture" || state.projectGeneration !== c.generation) { dispose(c); return; }
    if (changes.some(key => ["yarnLibrary", "yarnPalette", "yarnPlies"].includes(key))) {
      c.materialCache.clear();
      if (!state.yarnLibrary.some(yarn => String(yarn.id) === c.yarnId)) c.yarnId = String(state.yarnLibrary[0]?.id ?? "");
      queueMicrotask(() => { if (current(c)) loadMaterial(c); });
    }
  } })]);
}

function materialDescription(c) {
  const asset = GLOBAL_STATE.yarnLibrary.find(yarn => String(yarn.id) === c.yarnId);
  const legacy = normalizeYarnPlies(GLOBAL_STATE.yarnPlies, GLOBAL_STATE.yarnPalette)[0];
  const resolved = resolveYarnMaterial({ yarnAsset: asset, legacyContext: legacy });
  const pbr = { ...resolved.pbr };
  if (!hasMap(pbr.baseColor) && hasMap(resolved.texture)) pbr.baseColor = resolved.texture;
  return { asset, resolved, pbr };
}

async function decodeMap(c, map, registry, signal) {
  const blob = map.assetRef ? await registry.getBlob(map.assetRef)
    : await (await fetch(map.processedDataUrl || map.dataUrl, { signal })).blob();
  if (signal.aborted || !current(c)) throw new DOMException("已取消图片读取", "AbortError");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (signal.aborted || !current(c)) throw new DOMException("已取消图片读取", "AbortError");
  const originalAlpha = sourceImageHasAlpha(bytes);
  const url = URL.createObjectURL(blob); c.urls.add(url);
  let canvas;
  try {
    const image = await loadImageFromDataUrl(url, { signal });
    if (signal.aborted || !current(c)) throw new DOMException("已取消图片读取", "AbortError");
    canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("当前浏览器无法读取图片像素。");
    context.drawImage(image, 0, 0);
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height);
    const hasAlpha = originalAlpha ?? rgba.data.some((value, index) => index % 4 === 3 && value < 255);
    let data = rgba.data, channels = 4;
    if (!hasAlpha) {
      channels = 3; data = new Uint8Array(canvas.width * canvas.height * 3);
      for (let i = 0; i < canvas.width * canvas.height; i++) data.set(rgba.data.subarray(i * 4, i * 4 + 3), i * 3);
    }
    return { width: canvas.width, height: canvas.height, channels, data };
  } finally {
    if (canvas) canvas.width = canvas.height = 1;
    URL.revokeObjectURL(url); c.urls.delete(url);
  }
}

async function loadMaterial(c) {
  if (!current(c)) return;
  // A source change may arrive from project state while an async encoder is pending.
  // Keep a running geometry Worker: its inputs do not include yarn appearance.
  if (!c.worker) { c.jobSequence++; endTimer(c); c.phase = c.composing ? "compose" : "idle"; }
  c.pendingComposition = false;
  clearTimeout(c.composeTimer); c.composeTimer = null;
  const sequence = ++c.imageSequence;
  c.imageAbort?.abort(); c.imageAbort = new AbortController();
  const signal = c.imageAbort.signal, { asset, resolved, pbr } = materialDescription(c);
  const cacheKey = c.yarnId;
  c.material = null; c.materialLoading = true; c.error = "";
  clearResults(c);
  c.fuzzStrength = resolved.texture?.fuzzStrength ?? 0.45; c.fuzzOverrides = {};
  refresh(c);
  const registry = yarnAssetRegistry.fork();
  try {
    let material = c.materialCache.get(cacheKey);
    if (!material) {
      material = { name: asset?.name ?? "纯色纱线", id: asset?.id ?? null, color: resolved.color,
        fuzzStrength: c.fuzzStrength, files: {}, vRange: [0, 1],
        ...(pbr.physicalRepeatLengthMm ? { physicalRepeatLengthMm: pbr.physicalRepeatLengthMm } : {}) };
      for (const key of YARN_PBR_MAP_KEYS) if (hasMap(pbr[key])) {
        material.files[key] = pbr[key].fileName || `${key}（纱线库）`;
        if (key !== "height") material[key] = await decodeMap(c, pbr[key], registry, signal);
      }
      if (material.baseColor?.channels === 4) {
        const { findYarnTextureVRange } = await import("../simulation/yarnUvWebglRenderer.js");
        material.vRange = findYarnTextureVRange(material.baseColor);
      }
    }
    if (!current(c) || sequence !== c.imageSequence || signal.aborted) return;
    c.materialCache.set(cacheKey, material); c.material = material;
    c.fuzzSource = material.baseColor?.channels === 4 ? "both" : "generated";
    c.materialLoading = false; scheduleComposition(c); refresh(c);
  } catch (error) {
    if (!current(c) || sequence !== c.imageSequence || signal.aborted) return;
    c.materialLoading = false;
    if (!c.worker) { endTimer(c); c.phase = "idle"; }
    c.error = `纱线贴图读取失败：${error.message}`; refresh(c);
  } finally { registry.clear(); }
}

function inputKey(c) { return JSON.stringify([c.input, c.pxPerMm]); }
function clearResults(c) {
  c.fabric = c.strip = c.settings = null; c.revision++;
  if (c.canvas) c.canvas.width = c.canvas.height = 1;
  c.canvas = null; c.paintKey = null;
}
function updateGeometryInput(c, change) {
  change(); cancel(c, "面料输入已修改，请重新计算。");
  c.result = c.geometry = c.geometryKey = null; clearResults(c); c.error = ""; refresh(c);
}
function updateAppearance(c, change) {
  if (!c.worker) c.jobSequence++;
  change(); c.error = ""; clearResults(c); scheduleComposition(c); refresh(c);
}
function settingsSnapshot(c) {
  return { material: { ...c.material, normalGreen: c.normalGreen, fuzzBand: c.fuzzBand },
    fuzzSource: c.fuzzSource, fuzzOptions: { fuzzStrength: c.fuzzStrength, ...c.fuzzOverrides },
    pxPerMm: c.pxPerMm, stripLengthMm: c.stripLengthMm };
}
function scheduleComposition(c) {
  if (!current(c) || !c.geometry || !c.material || c.worker) return;
  c.pendingComposition = true;
  clearTimeout(c.composeTimer);
  c.composeTimer = setTimeout(() => {
    c.composeTimer = null;
    if (!c.composing) compose(c);
  }, 120);
}

async function compose(c) {
  if (!current(c) || !c.geometry || !c.material || c.worker) return;
  if (c.composing) { c.pendingComposition = true; return; }
  c.composing = true; c.pendingComposition = false;
  const sequence = ++c.jobSequence, settings = settingsSnapshot(c), result = c.result, geometry = c.geometry;
  startTimer(c, "compose", "正在合成纱线材质、毛羽与两面贴图…"); c.error = ""; refresh(c);
  try {
    normalizeFuzzParameters(settings.material, { ...settings.fuzzOptions, fuzzSource: settings.fuzzSource });
    await nextFrame();
    if (!current(c) || sequence !== c.jobSequence) return;
    const fabric = await bakeFabricTexture({ result, geometry, ...settings, prefix: "fabric" });
    if (!current(c) || sequence !== c.jobSequence) return;
    c.status = "正在生成单根纱线贴图…"; refresh(c); await nextFrame();
    if (!current(c) || sequence !== c.jobSequence) return;
    const strip = await bakeYarnStrip({ params: result.params, ...settings, prefix: "fabric" });
    if (!current(c) || sequence !== c.jobSequence) return;
    const { findYarnTextureVRange } = await import("../simulation/yarnUvWebglRenderer.js");
    if (!current(c) || sequence !== c.jobSequence) return;
    const range = findYarnTextureVRange(strip.maps.baseColor);
    const usesFullImage = range[0] === 0 && range[1] === 1;
    strip.metadata.preview = { vRange: range, usesFullImage,
      note: usesFullImage ? "二维预览将使用整张贴图高度" : "二维预览按现有规则使用识别出的纱线带" };
    c.fabric = fabric; c.strip = strip; c.settings = settings; c.revision++;
    finish(c, "已生成两面面料贴图和单根纱线贴图。"); refresh(c);
  } catch (error) {
    if (!current(c) || sequence !== c.jobSequence) return;
    finish(c, "生成失败。请核对输入后重试。"); c.error = error.message; refresh(c);
  } finally {
    c.composing = false;
    if (current(c) && c.pendingComposition) scheduleComposition(c);
  }
}

function calculate(c) {
  if (!current(c) || c.materialLoading || !c.material) return;
  cancel(c); clearResults(c); c.error = "";
  if (c.geometry && c.geometryKey === inputKey(c)) { compose(c); return; }
  try {
    if (!(Number.isFinite(c.input.loopLengthMm) && c.input.loopLengthMm > 0)) throw new Error("纱长必须为正数（mm）。");
    createFabricFormParams(c.input.params);
    normalizeFuzzParameters(c.material, { ...c.fuzzOverrides, fuzzStrength: c.fuzzStrength, fuzzSource: c.fuzzSource });
    const requestId = ++c.jobSequence, key = inputKey(c);
    const worker = new Worker(new URL("../fabricTexture/fabricTextureWorker.js", import.meta.url), { type: "module" });
    c.worker = worker; startTimer(c, "solve", "正在求解普通纬平针周期单元…"); refresh(c);
    worker.onmessage = event => {
      if (!current(c) || c.worker !== worker || event.data.requestId !== requestId || requestId !== c.jobSequence) return;
      const data = event.data;
      if (data.type === "stage") {
        c.phase = data.stage; c.status = data.stage === "solve" ? "正在求解普通纬平针周期单元…" : "正在烘焙两面纱芯与 AO…"; refresh(c);
      } else {
        worker.terminate(); c.worker = null;
        if (data.type === "error") { finish(c, "计算失败。"); c.error = data.message; refresh(c); return; }
        if (data.type !== "result") return;
        c.result = data.result; c.geometry = data.geometry; c.geometryKey = key; c.solveTimings = data.timings;
        finish(c, "求解与几何烘焙完成。"); refresh(c); compose(c);
      }
    };
    worker.onerror = event => {
      if (!current(c) || c.worker !== worker) return;
      worker.terminate(); c.worker = null; finish(c, "计算失败。"); c.error = event.message || "Worker 执行失败。"; refresh(c);
    };
    worker.postMessage({ requestId, solveInput: c.input, pxPerMm: c.pxPerMm });
  } catch (error) { c.error = error.message; c.worker?.terminate(); c.worker = null; endTimer(c); c.phase = "idle"; refresh(c); }
}

async function exportTexture(c, kind) {
  if (!c.fabric || !c.strip || c.phase !== "idle") return;
  const sequence = ++c.jobSequence, repeat = [...GLOBAL_STATE.fabricTextureView.exportRepeat];
  startTimer(c, "export", "正在打包贴图…"); refresh(c);
  try {
    await nextFrame();
    if (!current(c) || sequence !== c.jobSequence) return;
    let output = kind === "fabric" ? c.fabric : c.strip;
    if (kind === "fabric" && repeat.some(value => value !== 1)) {
      output = await bakeFabricTexture({ result: c.result, geometry: c.geometry, ...c.settings, repeat, prefix: "fabric" });
    }
    if (!current(c) || sequence !== c.jobSequence) return;
    const filename = kind === "fabric" ? "fabric_metadata.json" : "fabric_yarn_metadata.json";
    const bytes = await createFabricTextureZip(output.files, output.metadata, filename);
    if (!current(c) || sequence !== c.jobSequence) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" })); c.urls.add(url);
    download(url, kind === "fabric" ? "fabric-textures.zip" : "yarn-textures.zip");
    setTimeout(() => { URL.revokeObjectURL(url); c.urls.delete(url); }, 1000);
    finish(c, kind === "fabric" ? "面料贴图已打包下载（含两面 PNG 和元数据）。" : "纱线贴图已打包下载（含 PNG 和元数据）。"); refresh(c);
  } catch (error) {
    if (!current(c) || sequence !== c.jobSequence) return;
    finish(c, "导出失败。"); c.error = error.message; refresh(c);
  }
}

function updateView(c, patch) { if (current(c)) dispatch({ fabricTextureView: { ...GLOBAL_STATE.fabricTextureView, ...patch } }); }
function paintPreview(c) {
  if (!current(c)) return;
  const canvas = document.getElementById("ft-preview-canvas");
  if (!canvas) return;
  const view = GLOBAL_STATE.fabricTextureView, key = `${c.revision}:${view.face}:${view.tileCount}`;
  if (c.canvas === canvas && c.paintKey === key) return;
  c.canvas = canvas; c.paintKey = key;
  const yarn = view.face === "yarn", product = yarn ? c.strip : c.fabric;
  if (!product) { canvas.width = canvas.height = 1; return; }
  const maps = yarn ? product.composed.unitMaps : product.composed[view.face].unitMaps;
  const copies = yarn ? [2, 1] : [view.tileCount, view.tileCount];
  const review = createReviewImage(maps, copies);
  const widthMm = yarn ? c.settings.stripLengthMm * 2 : c.result.cell.W * view.tileCount;
  const context = canvas.getContext("2d");
  if (!context) { c.error = "当前浏览器无法创建 Canvas 2D 预览。"; return; }
  const rulerScale = Math.max(1, review.width / 600), rulerHeight = Math.ceil(56 * rulerScale), left = 16 * rulerScale;
  canvas.width = review.width; canvas.height = review.height + rulerHeight;
  const pixels = context.createImageData(review.width, review.height);
  for (let i = 0; i < review.width * review.height; i++) {
    pixels.data.set(review.data.subarray(i * 3, i * 3 + 3), i * 4); pixels.data[i * 4 + 3] = 255;
  }
  context.putImageData(pixels, 0, 0); context.fillStyle = "#242424"; context.fillRect(0, review.height, canvas.width, rulerHeight);
  const scaleMm = Math.min(1, widthMm / 3), scalePixels = scaleMm * review.width / widthMm;
  context.strokeStyle = "#fff"; context.lineWidth = 2 * rulerScale; context.beginPath();
  context.moveTo(left, review.height + 15 * rulerScale); context.lineTo(left + scalePixels, review.height + 15 * rulerScale);
  context.moveTo(left, review.height + 10 * rulerScale); context.lineTo(left, review.height + 20 * rulerScale);
  context.moveTo(left + scalePixels, review.height + 10 * rulerScale); context.lineTo(left + scalePixels, review.height + 20 * rulerScale); context.stroke();
  context.fillStyle = "#fff"; context.font = `${14 * rulerScale}px sans-serif`;
  context.fillText(`${number(scaleMm)} mm`, left, review.height + 42 * rulerScale);
}

function numericField(label, value, change, { min = 0.000001, max, integer = false, id, note } = {}) {
  return html`<label class="ft-field">${label}<input id=${id ?? ""} type="number" min=${min ?? ""} max=${max ?? ""} step=${integer ? "1" : "any"}
    .value=${live(String(value))} @change=${event => {
      const input = event.currentTarget;
      if (!input.value.trim() || !input.checkValidity() || !Number.isFinite(input.valueAsNumber)) { input.reportValidity(); input.value = String(value); return; }
      change(input.valueAsNumber);
    }} />${note ? html`<small>${note}</small>` : null}</label>`;
}

function resultInformation(c) {
  if (!c.result) return null;
  const { result } = c, face = GLOBAL_STATE.fabricTextureView.face;
  const fuzz = face === "yarn" ? c.strip?.fuzz.diagnostics : c.fabric?.fuzz[face]?.diagnostics;
  const diagnostic = c.fabric?.material.diagnostics;
  return html`<section class="ft-results"><h3>结果信息</h3>
    <p class=${result.status === "CONVERGED" ? "ft-status" : "ft-warning"} role="status">
      ${result.status === "CONVERGED" ? "求解收敛" : "警告：求解未收敛，以下仅为当前迭代结果"} · ${result.status} · ${result.iterations} 次迭代</p>
    <dl class="ft-metrics"><div><dt>单元 W × H</dt><dd>${number(result.cell.W)} × ${number(result.cell.H)} mm</dd></div>
      <div><dt>横密 / 纵密</dt><dd>${number(result.metrics.waleDensityPerCm)} / ${number(result.metrics.courseDensityPerCm)} 根/cm</dd></div>
      <div><dt>克重</dt><dd>${number(result.metrics.gsm)} g/m²</dd></div>
      <div><dt>生成纤维 / 毛羽像素</dt><dd>${fuzz?.fiberCount ?? "—"} 根 / ${number(fuzz?.fuzzPixelFraction * 100, 2)}%</dd></div>
      <div><dt>模型有效直径 d_e</dt><dd>${number(result.params.d_e, 4)} mm（派生）</dd></div></dl>
    ${diagnostic ? html`<p class=${diagnostic.anisotropyWarning ? "ft-warning" : "ft-note"}>贴图各向异性：${number(diagnostic.anisotropy)}。
      ${diagnostic.anisotropyWarning ? "沿纱长与横向缩放差异超过 2 倍，扫描图横向可能压缩或拉伸。" : "未触发超过 2 倍的缩放提示。"}
      贴图可见宽度不能作为纱线直径。</p>
      <p class="ft-note">贴图重复长度 ${number(diagnostic.repeatLengthMm)} mm（${diagnostic.repeatSource}），周期调整后 ${number(diagnostic.adjustedRepeatLengthMm)} mm；毛羽范围 ρ = ${number(diagnostic.rho)}。</p>` : null}
    ${c.strip ? html`<p class="ft-note">${c.strip.metadata.importInstruction} ${c.strip.metadata.preview.note}</p>` : null}
  </section>`;
}

export function fabricTextureWorkbench() {
  if (!active()) { if (controller) dispose(controller); return null; }
  if (controller && controller.generation !== GLOBAL_STATE.projectGeneration) dispose(controller);
  if (!controller) {
    controller = createController(); observeState();
    const initial = controller; queueMicrotask(() => { if (current(initial)) loadMaterial(initial); });
  }
  const c = controller, view = GLOBAL_STATE.fabricTextureView, busy = c.phase !== "idle";
  const appearanceLocked = Boolean(c.worker) || c.phase === "export";
  const { pbr } = materialDescription(c), hasAlpha = c.material?.baseColor?.channels === 4;
  const hasOutput = Boolean(c.fabric && c.strip), defaults = normalizeFuzzParameters({}, { fuzzStrength: c.fuzzStrength });
  queueMicrotask(() => paintPreview(c));
  return html`<section id="fabric-texture-workbench" @keydown=${event => event.stopPropagation()} @keyup=${event => event.stopPropagation()}>
    <div class="ft-main"><header class="ft-header"><h2>面料纹理 <small>实验</small></h2>
      <p>这里的预览按三维纱线烘焙，与 PBR + 2.5D 页的二维路径预览不是同一种渲染；导出的贴图供 CLO3D 等软件使用。</p></header>
      <div class="ft-toolbar"><label>预览视图 <select id="ft-face" .value=${live(view.face)} @change=${event => updateView(c, { face: event.currentTarget.value })}>
        <option value="technicalFace">工艺正面</option><option value="technicalBack">工艺反面</option><option value="yarn">纱线贴图</option></select></label>
        <label>面料平铺 <input id="ft-tile-count" type="range" min="2" max="8" step="1" .value=${String(view.tileCount)}
          ?disabled=${view.face === "yarn"} @input=${event => updateView(c, { tileCount: Number(event.currentTarget.value) })} /> ${view.tileCount} × ${view.tileCount}</label></div>
      <div class="ft-preview" aria-label="面料纹理预览">
        ${hasOutput ? html`<canvas id="ft-preview-canvas" class="ft-canvas" aria-label="带毫米比例尺的纹理预览"></canvas>`
          : html`<div class="ft-preview-empty">${busy ? "正在生成预览…" : "计算后显示带毫米比例尺的纹理预览"}</div>`}
      </div>
      <p class="ft-status" role="status">${c.status} ${c.elapsedMs > 0 ? `已用 ${number(c.elapsedMs / 1000, 1)} 秒` : ""}</p>
      ${c.error ? html`<p class="ft-error" role="alert">${c.error}</p>` : null}
      ${resultInformation(c)}
      <section class="ft-limitations"><h3>模型与使用范围</h3><ol>${FABRIC_TEXTURE_LIMITATIONS.map(text => html`<li>${text}</li>`)}</ol></section>
    </div>
    <aside class="ft-sidebar"><section class="ft-controls"><h3>面料输入</h3>
      <fieldset ?disabled=${busy}><div class="ft-grid">
        ${numericField("纱长 l（mm）", c.input.loopLengthMm, value => updateGeometryInput(c, () => c.input.loopLengthMm = value), { id: "ft-loop-length", step: 0.01 })}
        <label class="ft-field">每圈节点数<select id="ft-nodes" .value=${String(c.input.nodesPerLoop)} @change=${event => updateGeometryInput(c, () => c.input.nodesPerLoop = Number(event.currentTarget.value))}>
          ${[24, 48, 64].map(value => html`<option value=${value} ?selected=${c.input.nodesPerLoop === value}>${value}</option>`)}</select></label>
        <label class="ft-field">分辨率（px/mm）<select id="ft-resolution" .value=${String(c.pxPerMm)} @change=${event => updateGeometryInput(c, () => c.pxPerMm = Number(event.currentTarget.value))}>
          ${[100, 200, 400].map(value => html`<option value=${value} ?selected=${c.pxPerMm === value}>${value}</option>`)}</select></label></div>
        <details class="ft-advanced"><summary>六项材料参数 · 假设值</summary><p class="ft-note">当前值用于未标定 T1 模型。手动调整仍记为假设值，不代表材料实测；物理状态未知。</p>
          <div class="ft-grid">${PARAM_FIELDS.map(([key, label, unit, step]) => numericField(`${label}（${unit}）`, c.input.params[key], value => updateGeometryInput(c, () => {
            c.input.params[key] = value; delete c.input.params.provenance[key];
          }),
            { id: `ft-param-${key}`, step, ...(key === "phi0" ? { max: 0.999999 } : {}), note: "来源：模型参考 / 手动假设" }))}</div></details>
      </fieldset></section>
      <section class="ft-controls"><h3>纱线</h3><fieldset ?disabled=${appearanceLocked}>
        <label class="ft-field">纱线库<select id="ft-yarn" .value=${live(c.yarnId)} @change=${event => { c.yarnId = event.currentTarget.value; loadMaterial(c); }}>
          ${GLOBAL_STATE.yarnLibrary.length ? GLOBAL_STATE.yarnLibrary.map(yarn => html`<option value=${String(yarn.id)} ?selected=${String(yarn.id) === c.yarnId}>${yarn.name}</option>`) : html`<option value="">纯色纱线</option>`}</select></label>
        <p class="ft-map-list">PBR：${YARN_PBR_MAP_KEYS.filter(key => hasMap(pbr[key])).map(key => MAP_LABELS[key]).join("、") || "无（使用纯色）"}</p>
        <p class="ft-note">${c.materialLoading ? "正在读取贴图…" : !c.material ? "颜色图透明通道：尚未读取" : `颜色图透明通道：${hasAlpha ? "有，可使用扫描毛羽" : "无"}`}<br />
          物理重复长度：${pbr.physicalRepeatLengthMm ? `${number(pbr.physicalRepeatLengthMm)} mm（纱线库记录）` : "未设置，由贴图比例派生"}</p>
        ${!c.material && !c.materialLoading ? html`<button type="button" class="btn" @click=${() => loadMaterial(c)}>重新读取纱线</button>` : null}
        <label class="ft-field">源法线绿通道<select id="ft-normal-green" .value=${live(c.normalGreen)} @change=${event => updateAppearance(c, () => c.normalGreen = event.currentTarget.value)}>
          <option value="+Y">+Y · OpenGL</option><option value="-Y">−Y · DirectX</option></select></label>
      </fieldset></section>
      <section class="ft-controls"><h3>纱线毛羽</h3><p class="ft-note">毛羽是所选纱线的外观属性。以下为临时调整，不写回纱线；所有生成参数是假设值。</p>
        <fieldset ?disabled=${appearanceLocked || c.materialLoading}><label class="ft-field">来源<select id="ft-fuzz-source" .value=${live(c.fuzzSource)} @change=${event => updateAppearance(c, () => c.fuzzSource = event.currentTarget.value)}>
          <option value="off">关</option><option value="scan" ?disabled=${!hasAlpha}>扫描</option><option value="generated">生成</option><option value="both" ?disabled=${!hasAlpha}>扫描 + 生成</option></select></label>
        <label class="ft-field">毛羽强度 ${number(c.fuzzStrength, 2)}<input id="ft-fuzz-strength" type="range" min="0" max="1" step="0.01" .value=${String(c.fuzzStrength)}
          @input=${event => updateAppearance(c, () => c.fuzzStrength = Number(event.currentTarget.value))} /></label>
        <div class="ft-presets">${[["低", 0.25], ["中", 0.5], ["高", 1]].map(([label, value]) => html`<button type="button" class="btn" @click=${() => updateAppearance(c, () => c.fuzzStrength = value)}>${label} · ${value}</button>`)}</div>
        <details class="ft-advanced"><summary>毛羽高级参数</summary><p class="ft-note">H 默认 = 16 × 毛羽强度，光晕强度默认 = 毛羽强度；手动修改后使用指定值。</p><div class="ft-grid">
          ${FUZZ_FIELDS.map(([key, label, unit, min, max, step]) => numericField(`${label}（${unit}）`, c.fuzzOverrides[key] ?? defaults[key],
            value => updateAppearance(c, () => c.fuzzOverrides[key] = value), { id: `ft-fuzz-${key}`, min: min ?? -Number.MAX_SAFE_INTEGER, max,
              integer: key === "seed" }))}</div>
          <label class="ft-field">毛羽带模式<select id="ft-fuzz-band" .value=${live(c.fuzzBand)} @change=${event => updateAppearance(c, () => c.fuzzBand = event.currentTarget.value)}>
            <option value="fullScan">完整扫描带 fullScan</option><option value="vRange">既有 V 范围 vRange</option></select></label>
          <button type="button" class="btn" @click=${() => updateAppearance(c, () => c.fuzzOverrides = {})}>重置高级参数</button></details>
        </fieldset></section>
      <section class="ft-controls"><p class="ft-note">每圈 48 节点时一次求解约需 0.5～3 分钟。更换纱线、毛羽或法线约定只重新合成。</p>
        <div class="ft-actions"><button id="ft-calculate" type="button" class="btn" ?disabled=${busy || c.materialLoading || !c.material} @click=${() => calculate(c)}>计算并生成</button>
          <button id="ft-cancel" type="button" class="btn" ?disabled=${!busy} @click=${() => cancel(c)}>取消</button></div>
      </section>
      <section class="ft-controls"><h3>导出</h3><fieldset ?disabled=${busy}><div class="ft-grid">
        ${[0, 1].map(index => numericField(`面料平铺 ${index === 0 ? "横向 kx" : "纵向 ky"}`, view.exportRepeat[index], value => {
          const repeat = [...view.exportRepeat]; repeat[index] = value; updateView(c, { exportRepeat: repeat });
        }, { id: `ft-export-repeat-${index}`, min: 1, integer: true }))}
        ${numericField("单根纱线长度（mm）", c.stripLengthMm, value => updateAppearance(c, () => c.stripLengthMm = value), { id: "ft-strip-length", step: 0.1 })}</div>
        <div class="ft-actions"><button id="ft-export-fabric" type="button" class="btn" ?disabled=${!hasOutput} @click=${() => exportTexture(c, "fabric")}>导出面料贴图</button>
          <button id="ft-export-yarn" type="button" class="btn" ?disabled=${!hasOutput} @click=${() => exportTexture(c, "yarn")}>导出纱线贴图</button></div>
        <p class="ft-note">分别导出 ZIP，包含 PNG 与元数据。面料含正反两面；法线输出统一为 +Y。平铺复制同一单元，毛羽会重复。</p>
      </fieldset></section>
    </aside></section>`;
}
