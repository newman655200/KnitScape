import { html } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { GLOBAL_STATE, dispatch, StateMonitor } from "../state.js";
import { createFabricFormParams } from "../fabricForm/fabricFormParams.js";
import { resolveYarnMaterial, normalizeYarnPlies } from "../domain/yarnMaterial.js";
import { yarnAssetRegistry } from "../yarnTexture/yarnAssetRegistry.js";
import { loadImageFromDataUrl, YARN_PBR_MAP_KEYS } from "../yarnTexture/yarnScanTexture.js";
import { normalizeFuzzParameters } from "../fabricTexture/yarnFuzz.js";
import { FABRIC_TEXTURE_LIMITATIONS } from "../fabricTexture/metadata.js";
import { sourceImageHasAlpha } from "../fabricTexture/sourceImageAlpha.js";
import { createWorkbenchPreview } from "../fabricTexture/workbenchPreview.js";
import { createFabricTextureZip } from "../fabricTexture/textureExport.js";
import { download } from "../utils.js";
import { iconTile, glyph } from "../ui/iosIcons.js";

const PARAM_FIELDS = [
  ["tex", "线密度", "tex", "0.01"], ["densityGPerCm3", "纤维密度", "g/cm³", "0.01"],
  ["fiberDiameterMm", "单纤维直径", "mm", "0.001"], ["E_f", "纤维弹性模量", "N/mm²", "1"],
  ["K", "压缩系数 K", "", "0.001"], ["phi0", "初始填充率", "", "0.01"],
];
const FUZZ_FIELDS = [
  ["hairinessIndex", "毛羽指数 H", "", 0, undefined, 0.1],
  ["meanHairLengthMm", "平均毛长", "mm", 0.001, undefined, 0.01],
  ["hairAngleDeg", "毛羽倾角", "°", 0, 90, 1],
  ["maxCurvaturePerMm", "纤维卷曲", "/mm", 0, undefined, 0.1],
  ["fiberOpacity", "毛羽不透明度", "", 0, 1, 0.01],
  ["haloStrength", "绒感光晕强度", "", 0, 1, 0.01],
  ["haloWidthR", "绒感光晕宽度", "× 纱芯半径", 0.01, undefined, 0.01],
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
    result: null, geometry: null, fabric: null, strip: null, settings: null, stripSettings: null, geometryKey: null,
    worker: null, workerCancel: null, imageAbort: null, urls: new Set(), imageSequence: 0, jobSequence: 0, requestSequence: 0,
    phase: "idle", status: "设置参数后点‘计算面料’。", error: "", elapsedMs: 0,
    displayResult: null, fabricKey: null, fabricDirty: true, stripDirty: true,
    appearanceVersion: 0, fabricAppearanceVersion: -1, stripAppearanceVersion: -1, sourceVersion: 0,
    texUnit: "tex", timings: {}, calculating: false, stoppedComposition: false,
    changedField: null, showTechnical: false, showLimitations: false, sheetTriggers: new Map(),
    timer: null, composeTimer: null,
    revision: 0, canvas: null, paintKey: null };
}

function endTimer(c) { clearInterval(c.timer); c.timer = null; }
function startTimer(c, phase, message) {
  endTimer(c); c.phase = phase; c.status = message; c.startedAt = performance.now(); c.elapsedMs = 0;
  c.timer = setInterval(() => { c.elapsedMs = performance.now() - c.startedAt; refresh(c); }, 500);
}
function finish(c, message) {
  c.elapsedMs = 0; endTimer(c); c.phase = "idle"; c.calculating = false; c.status = message;
}
const latest = (c, sequence) => current(c) && sequence === c.jobSequence;
function stopWork(c, message) {
  // Reject the awaited job as well as terminating its Worker: no suspended chains.
  c.jobSequence++; c.workerCancel?.();
  clearTimeout(c.composeTimer); c.composeTimer = null;
  endTimer(c); c.phase = "idle"; c.elapsedMs = 0; c.status = message;
  c.calculating = false;
}
function cancel(c) {
  const appearance = !c.calculating && ["fabric", "yarn", "waiting"].includes(c.phase);
  stopWork(c, appearance ? "已停止合成。" : "已停止计算。");
  c.stoppedComposition = true; c.cancelledCalculation = !appearance;
  refresh(c);
}
function dispose(c) {
  stopWork(c, ""); c.imageSequence++; c.imageAbort?.abort();
  window.removeEventListener("resize", c.resizeHandler);
  for (const url of c.urls) URL.revokeObjectURL(url);
  c.urls.clear(); c.materialCache.clear();
  if (c.canvas) c.canvas.width = c.canvas.height = 1;
  c.canvas = c.geometry = c.result = c.fabric = c.strip = c.material = c.settings = c.stripSettings = null;
  controller = null;
}

const STAGES = { solve: "正在求解线圈形状…", geometry: "正在生成纱芯形状与阴影…",
  fabric: "正在合成两面贴图…", yarn: "正在生成单根纱线贴图…" };

function runWorker(c, sequence, type, options) {
  return new Promise((resolve, reject) => {
    if (!latest(c, sequence)) { reject(new DOMException("任务已取消", "AbortError")); return; }
    const requestId = ++c.requestSequence;
    const worker = new Worker(new URL("../fabricTexture/fabricTextureWorker.js", import.meta.url), { type: "module" });
    const release = () => {
      worker.terminate();
      if (c.worker === worker) { c.worker = null; c.workerCancel = null; }
    };
    c.worker = worker;
    c.workerCancel = () => { release(); reject(new DOMException("任务已取消", "AbortError")); };
    startTimer(c, type === "geometry" ? "solve" : type, STAGES[type === "geometry" ? "solve" : type]); refresh(c);
    worker.onmessage = ({ data }) => {
      if (!latest(c, sequence) || c.worker !== worker || data.requestId !== requestId) return;
      if (data.type === "stage") {
        c.phase = data.stage; c.status = STAGES[data.stage] ?? c.status; refresh(c);
      } else if (data.type === "result" && data.jobType === type) {
        release(); resolve(data);
      } else if (data.type === "error") {
        release(); const error = new Error(data.message); error.name = data.name || "Error"; reject(error);
      }
    };
    worker.onerror = event => { release(); reject(new Error(event.message || "Worker 执行失败。")); };
    worker.onmessageerror = () => { release(); reject(new Error("无法读取 Worker 的贴图结果。")); };
    // Copy inputs so the main thread's decoded-material and geometry caches survive.
    try { worker.postMessage({ type, requestId, ...options }); }
    catch (error) { release(); reject(error); }
  });
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
      queueMicrotask(() => { if (current(c)) loadMaterial(c, true); });
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

async function loadMaterial(c, changed = false) {
  if (!current(c)) return;
  if (changed) invalidateAppearance(c, "纱线已修改，正在读取贴图…");
  const sequence = ++c.imageSequence;
  c.imageAbort?.abort(); c.imageAbort = new AbortController();
  const signal = c.imageAbort.signal, { asset, resolved, pbr } = materialDescription(c), sourceVersion = c.sourceVersion;
  const cacheKey = c.yarnId;
  c.material = null; c.materialLoading = true; c.error = "";
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
    if (sourceVersion === c.sourceVersion) c.fuzzSource = material.baseColor?.channels === 4 ? "both" : "generated";
    else if (material.baseColor?.channels !== 4 && ["scan", "both"].includes(c.fuzzSource)) c.fuzzSource = "generated";
    c.materialLoading = false;
    if (c.phase === "loading") c.phase = "idle";
    if (changed && !c.geometry && !isGeometryTask(c) && !c.stoppedComposition) c.status = "纱线已修改，设置参数后点‘计算面料’。";
    scheduleComposition(c); refresh(c);
  } catch (error) {
    if (!current(c) || sequence !== c.imageSequence || signal.aborted) return;
    c.materialLoading = false;
    if (c.phase === "loading") finish(c, "纱线贴图读取失败。");
    c.error = `纱线贴图读取失败：${error.message}`; refresh(c);
  } finally { registry.clear(); }
}

function inputKey(c) {
  return JSON.stringify([c.input.loopLengthMm, c.input.nodesPerLoop, PARAM_FIELDS.map(([key]) => c.input.params[key]), c.pxPerMm]);
}
const isGeometryTask = c => c.phase === "solve" || c.phase === "geometry";
const geometryCurrent = c => c.geometry && c.geometryKey === inputKey(c);
const structureStale = c => Boolean(c.fabricKey && (c.fabricKey !== inputKey(c) || !geometryCurrent(c)));
const fabricCurrent = c => c.fabric && !c.fabricDirty && c.fabricKey === inputKey(c) && geometryCurrent(c);
const staleStatus = "面料结构已修改，预览和数值是修改前的结果。";
function updateGeometryInput(c, change, field) {
  const before = inputKey(c); change();
  if (before === inputKey(c)) return;
  // §6.4 keeps the in-flight solve; its input key prevents publishing it as the new structure.
  if (!isGeometryTask(c)) stopWork(c, c.fabric ? staleStatus : "面料结构已修改，点‘计算面料’开始。");
  c.fabricDirty = c.fabricKey !== inputKey(c) || c.fabricAppearanceVersion !== c.appearanceVersion;
  c.stripDirty = c.stripKey !== inputKey(c) || c.stripAppearanceVersion !== c.appearanceVersion || c.stripSettings?.stripLengthMm !== c.stripLengthMm;
  c.stoppedComposition = false;
  c.changedField = field; c.error = ""; refresh(c);
  if (fabricCurrent(c) && c.phase === "idle") { c.status = completedStatus(c); refresh(c); }
  scheduleComposition(c);
}
function invalidateAppearance(c, message) {
  if (!isGeometryTask(c) && c.phase !== "loading") stopWork(c, message);
  c.fabricDirty = c.stripDirty = true; c.stoppedComposition = false; delete c.timings.yarn;
  c.appearanceVersion++;
}
function updateAppearance(c, change) {
  invalidateAppearance(c, c.geometry ? "外观已修改，等待合成…" : "设置参数后点‘计算面料’。");
  change(); c.error = ""; scheduleComposition(c); refresh(c);
}
function completedStatus(c) {
  const parts = [c.displayResult?.status === "CONVERGED" ? "已收敛" : "求解未收敛"];
  for (const [key, label] of [["solve", "求解"], ["geometry", "纱芯与阴影"], ["fabric", "合成"], ["yarn", "单根纱线"]]) {
    if (Number.isFinite(c.timings[key])) parts.push(`${label} ${number(c.timings[key] / 1000, 1)} 秒`);
  }
  return parts.join(" · ");
}
function updateStripLength(c, value) {
  if (value === c.stripLengthMm) return;
  if (!isGeometryTask(c) && c.phase !== "loading") stopWork(c, "单根纱线长度已修改，将在查看或导出时生成。");
  c.stripLengthMm = value; c.stripDirty = true; c.stoppedComposition = false; delete c.timings.yarn; c.error = "";
  scheduleComposition(c); refresh(c);
}
function settingsSnapshot(c) {
  return { material: { ...c.material, normalGreen: c.normalGreen, fuzzBand: c.fuzzBand },
    fuzzSource: c.fuzzSource, fuzzOptions: { fuzzStrength: c.fuzzStrength, ...c.fuzzOverrides },
    pxPerMm: c.pxPerMm, stripLengthMm: c.stripLengthMm };
}
function scheduleComposition(c) {
  if (!current(c) || !geometryCurrent(c) || !c.material || c.materialLoading || c.worker || c.stoppedComposition || !["idle", "waiting"].includes(c.phase)) return;
  if (fabricCurrent(c) && (!c.stripDirty && c.strip || GLOBAL_STATE.fabricTextureView.face !== "yarn")) return;
  clearTimeout(c.composeTimer);
  const sequence = c.jobSequence;
  c.phase = "waiting"; c.status = "等待最新外观设置…";
  c.composeTimer = setTimeout(() => {
    c.composeTimer = null;
    if (latest(c, sequence)) compose(c, sequence);
  }, 120);
}

async function buildYarn(c, sequence) {
  if (c.strip && !c.stripDirty) return c.strip;
  const settings = settingsSnapshot(c);
  const started = performance.now();
  const strip = await runWorker(c, sequence, "yarn", { params: c.result.params, ...settings, prefix: "fabric" });
  if (!latest(c, sequence)) return null;
  const { findYarnTextureVRange } = await import("../simulation/yarnUvWebglRenderer.js");
  if (!latest(c, sequence)) return null;
  const range = findYarnTextureVRange(strip.maps.baseColor), usesFullImage = range[0] === 0 && range[1] === 1;
  strip.metadata.preview = { vRange: range, usesFullImage,
    note: usesFullImage ? "二维预览将使用整张贴图高度" : "二维预览按现有规则使用识别出的纱线带" };
  c.strip = strip; c.stripSettings = settings; c.stripDirty = false;
  c.stripKey = c.geometryKey; c.stripAppearanceVersion = c.appearanceVersion;
  c.timings.yarn = performance.now() - started; c.revision++;
  return strip;
}

async function compose(c, sequence = c.jobSequence) {
  if (!latest(c, sequence) || !geometryCurrent(c) || !c.material || c.materialLoading || c.worker) return;
  c.error = "";
  try {
    if (!fabricCurrent(c)) {
      const settings = settingsSnapshot(c);
      const started = performance.now(), result = c.result, key = c.geometryKey;
      const fabric = await runWorker(c, sequence, "fabric", { result: c.result, geometry: c.geometry, ...settings, prefix: "fabric" });
      if (!latest(c, sequence)) return;
      c.fabric = fabric; c.settings = settings; c.fabricDirty = false; c.fabricKey = key;
      c.fabricAppearanceVersion = c.appearanceVersion;
      c.displayResult = result; c.timings.fabric = performance.now() - started; c.revision++; refresh(c);
    }
    if (GLOBAL_STATE.fabricTextureView.face === "yarn" && (!c.strip || c.stripDirty)) await buildYarn(c, sequence);
    if (!latest(c, sequence)) return;
    finish(c, completedStatus(c)); refresh(c);
  } catch (error) {
    if (!latest(c, sequence)) return;
    finish(c, "生成失败。请核对输入后重试。"); c.error = error.message; refresh(c);
  }
}

async function calculate(c) {
  if (!current(c) || c.materialLoading || !c.material) return;
  stopWork(c, ""); c.fabricDirty = c.stripDirty = true; c.stoppedComposition = false; c.cancelledCalculation = false; c.error = "";
  c.calculating = true; c.calculationStarted = performance.now();
  const sequence = c.jobSequence;
  try {
    if (!(Number.isFinite(c.input.loopLengthMm) && c.input.loopLengthMm > 0)) throw new Error("纱长必须为正数（mm）。");
    createFabricFormParams(c.input.params);
    normalizeFuzzParameters(c.material, { ...c.fuzzOverrides, fuzzStrength: c.fuzzStrength, fuzzSource: c.fuzzSource });
    const key = inputKey(c);
    if (!c.geometry || c.geometryKey !== key) {
      const data = await runWorker(c, sequence, "geometry", { solveInput: c.input, pxPerMm: c.pxPerMm });
      if (!latest(c, sequence)) return;
      // Inputs can change without interrupting the solve. Never replace the active
      // cache with a late result for different inputs (exports also reuse this cache).
      if (key !== inputKey(c)) {
        finish(c, fabricCurrent(c) ? completedStatus(c) : c.fabric ? staleStatus : "面料结构已修改，点‘计算面料’重新计算。");
        scheduleComposition(c); refresh(c); return;
      }
      c.result = data.result; c.geometry = data.geometry; c.geometryKey = key; c.solveTimings = data.timings;
      c.timings = { solve: data.timings.solveMs,
        geometry: Object.entries(data.timings).filter(([name]) => name !== "solveMs").reduce((sum, [, value]) => sum + value, 0) };
    }
    if (!geometryCurrent(c)) { finish(c, c.fabric ? staleStatus : "面料结构已修改，点‘计算面料’重新计算。"); refresh(c); return; }
    if (c.materialLoading) { c.phase = "loading"; c.status = "正在读取纱线贴图，读取完成后合成…"; refresh(c); return; }
    if (!c.material) throw new Error("纱线贴图尚未读取成功，请重新读取。");
    await compose(c, sequence);
  } catch (error) {
    if (!latest(c, sequence)) return;
    c.error = error.message; finish(c, "计算失败。"); refresh(c);
  }
}

async function exportTexture(c, kind) {
  if (!fabricCurrent(c) || c.materialLoading || c.phase !== "idle") return;
  const sequence = ++c.jobSequence, repeat = [...GLOBAL_STATE.fabricTextureView.exportRepeat];
  try {
    let output = kind === "fabric" ? c.fabric : await buildYarn(c, sequence);
    if (!latest(c, sequence)) return;
    if (kind === "fabric" && repeat.some(value => value !== 1)) {
      output = await runWorker(c, sequence, "fabric", { result: c.result, geometry: c.geometry, ...c.settings, repeat, prefix: "fabric" });
    }
    if (!latest(c, sequence)) return;
    startTimer(c, "packing", "正在打包…"); refresh(c); await nextFrame();
    if (!latest(c, sequence)) return;
    const filename = kind === "fabric" ? "fabric_metadata.json" : "fabric_yarn_metadata.json";
    const bytes = await createFabricTextureZip(output.files, output.metadata, filename);
    if (!latest(c, sequence)) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" })); c.urls.add(url);
    download(url, kind === "fabric" ? "fabric-textures.zip" : "yarn-textures.zip");
    setTimeout(() => { URL.revokeObjectURL(url); c.urls.delete(url); }, 1000);
    finish(c, `已下载 ${kind === "fabric" ? "fabric-textures.zip" : "yarn-textures.zip"}（${Object.keys(output.files).length + 1} 个文件）。`);
    scheduleComposition(c); refresh(c);
  } catch (error) {
    if (!latest(c, sequence)) return;
    finish(c, "导出失败。"); c.error = error.message; refresh(c);
  }
}

function updateView(c, patch) {
  if (!current(c)) return;
  dispatch({ fabricTextureView: { ...GLOBAL_STATE.fabricTextureView, ...patch } });
  if (patch.face && patch.face !== "yarn" && c.fabric && c.phase === "waiting") {
    if (fabricCurrent(c)) { stopWork(c, completedStatus(c)); refresh(c); }
  }
  if (patch.face === "yarn" && (!c.strip || c.stripDirty)) {
    // An explicit new view request may retry a cancelled strip; image-load
    // completion alone must keep respecting the cancellation gate.
    c.stoppedComposition = false; scheduleComposition(c); refresh(c);
  }
}
function paintPreview(c) {
  if (!current(c)) return;
  const canvas = document.getElementById("ft-preview-canvas");
  if (!canvas) return;
  const maxWidth = Math.min(1024, Math.max(128, (canvas.parentElement?.clientWidth || 1058) - 34));
  const maxHeight = Math.min(768, Math.max(128, (canvas.parentElement?.clientHeight || Math.floor(window.innerHeight * 0.65)) - 32));
  const view = GLOBAL_STATE.fabricTextureView, key = `${c.revision}:${view.face}:${view.tileCount}:${maxWidth}:${maxHeight}`;
  if (c.canvas === canvas && c.paintKey === key) return;
  c.canvas = canvas; c.paintKey = key;
  const yarn = view.face === "yarn", product = yarn ? c.strip : c.fabric;
  if (!product) { canvas.width = canvas.height = 1; return; }
  const maps = yarn ? product.composed.unitMaps : product.composed[view.face].unitMaps;
  const copies = yarn ? [2, 1] : [view.tileCount, view.tileCount];
  const review = createWorkbenchPreview(maps, copies, { maxWidth, maxHeight });
  const widthMm = yarn ? c.stripSettings.stripLengthMm * 2 : c.displayResult.cell.W * view.tileCount;
  const context = canvas.getContext("2d");
  if (!context) { c.error = "当前浏览器无法创建 Canvas 2D 预览。"; return; }
  const rulerScale = Math.max(1, review.width / 600), left = 26 * rulerScale;
  canvas.width = review.width; canvas.height = review.height;
  const pixels = context.createImageData(review.width, review.height);
  for (let i = 0; i < review.width * review.height; i++) {
    pixels.data.set(review.data.subarray(i * 3, i * 3 + 3), i * 4); pixels.data[i * 4 + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const scaleMm = Math.min(1, widthMm / 3), scalePixels = scaleMm * review.width / widthMm;
  const top = review.height - 58 * rulerScale;
  context.fillStyle = "rgba(0,0,0,0.55)"; context.beginPath();
  context.roundRect(left - 10 * rulerScale, top, scalePixels + 20 * rulerScale, 46 * rulerScale, 10 * rulerScale); context.fill();
  context.strokeStyle = "#fff"; context.lineWidth = 2 * rulerScale; context.beginPath();
  context.moveTo(left, top + 12 * rulerScale); context.lineTo(left + scalePixels, top + 12 * rulerScale);
  context.moveTo(left, top + 9 * rulerScale); context.lineTo(left, top + 15 * rulerScale);
  context.moveTo(left + scalePixels, top + 9 * rulerScale); context.lineTo(left + scalePixels, top + 15 * rulerScale); context.stroke();
  context.fillStyle = "#fff"; context.font = `${14 * rulerScale}px sans-serif`;
  context.fillText(`${Number(number(scaleMm))} mm`, left, top + 34 * rulerScale);
}

function numericInput(label, value, change, { min = 0.000001, max, integer = false, id } = {}) {
  return html`<input class="ios-input" id=${id ?? ""} aria-label=${label} type="number" min=${min ?? ""} max=${max ?? ""} step=${integer ? "1" : "any"}
    .value=${String(value)} @change=${event => {
      const input = event.currentTarget;
      if (!input.value.trim() || !input.checkValidity() || !Number.isFinite(input.valueAsNumber)) {
        input.reportValidity(); input.value = String(value); return;
      }
      // Display rounding (notably tex / D / Ne) must not become an input edit.
      if (input.valueAsNumber !== Number(value)) change(input.valueAsNumber);
    }} />`;
}
function stepper(label, value, change, { min = 1, max = Infinity, step = 1, disabled = false } = {}) {
  const move = direction => change(Number(Math.min(max, Math.max(min, value + direction * step)).toFixed(8)));
  return html`<span class="ios-stepper"><button type="button" aria-label=${`减少${label}`} ?disabled=${disabled || value <= min} @click=${() => move(-1)}>−</button>
    <button type="button" aria-label=${`增加${label}`} ?disabled=${disabled || value >= max} @click=${() => move(1)}>+</button></span>`;
}
function segment(label, value, options, change, id) {
  return html`<div class="ios-seg" id=${id ?? ""} role="radiogroup" aria-label=${label} @keydown=${event => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...event.currentTarget.querySelectorAll('[role="radio"]')];
    const index = Math.max(0, buttons.indexOf(document.activeElement));
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
      : (index + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
    change(options[next][0]); buttons[next].focus();
  }}>${options.map(([key, text, icon], index) => html`<button type="button" role="radio" aria-checked=${value === key ? "true" : "false"}
      tabindex=${value === key || !options.some(([option]) => value === option) && index === 0 ? "0" : "-1"}
      @click=${() => change(key)}>${icon ? glyph(icon) : null}${text}</button>`)}</div>`;
}
function rowLabel(icon, label) { return html`<span class="ios-row-label">${iconTile(icon)}<span>${label}</span></span>`; }
function sectionHeader(title, category, tag) {
  return html`<div class="ios-section-header"><h2>${title}</h2>${tag ? html`<span class=${`ios-tag ${category}`}>${tag}</span>` : null}</div>`;
}
function numericRow(icon, label, unit, value, change, options = {}, withStepper = false) {
  return html`<div class="ios-row">${rowLabel(icon, label)}<span class="ios-row-value">${numericInput(label, value, change, options)}
    ${unit ? html`<span class="ios-unit">${unit}</span>` : null}${withStepper ? stepper(label, value, change, options) : null}</span></div>`;
}
function openSheet(c, id, event) {
  const sheet = document.getElementById(id);
  c.sheetTriggers.set(id, event.currentTarget); sheet?.showModal();
}
function sheet(c, id, title, category, tag, content) {
  return html`<dialog id=${id} class="ios-sheet" aria-labelledby=${`${id}-title`}
    @close=${() => { const trigger = c.sheetTriggers.get(id); if (trigger?.isConnected) trigger.focus({ preventScroll: true }); }}
    @click=${event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close();
    }}><header class="ios-sheet-header"><h2 id=${`${id}-title`}>${title}</h2>
      <button type="button" class="ios-link" @click=${event => event.currentTarget.closest("dialog").close()}>完成</button></header>
    <div class="ios-sheet-body"><div class="ios-sheet-tag"><span class=${`ios-tag ${category}`}>${tag}</span></div>${content}</div></dialog>`;
}
function moreParameters(c) {
  const paramIcon = { densityGPerCm3: "o_density", fiberDiameterMm: "o_diameter", E_f: "o_modulus", K: "o_compress", phi0: "o_packing" };
  const fields = keys => PARAM_FIELDS.filter(([key]) => keys.includes(key)).map(([key, label, unit]) =>
    numericRow(paramIcon[key], label, unit, c.input.params[key], value => updateGeometryInput(c, () => {
      c.input.params[key] = value; delete c.input.params.provenance[key];
    }), { id: `ft-param-${key}`, ...(key === "phi0" ? { max: 0.999999 } : {}) }));
  return sheet(c, "ft-parameters-sheet", "更多参数", "recompute", "改了要重新计算", html`
    <section>${sectionHeader("计算")}<div class="ios-group">
      <div class="ios-row ios-row-stack"><div class="ios-row-head">${rowLabel("o_prec", "计算精度")}</div>
        ${segment("计算精度", c.input.nodesPerLoop, [[24, "快速"], [48, "标准"], [64, "精细"]], value => updateGeometryInput(c, () => c.input.nodesPerLoop = value), "ft-nodes")}</div>
      <div class="ios-row ios-row-stack"><div class="ios-row-head">${rowLabel("o_res", "贴图精度")}<span class="ios-row-value">像素/mm</span></div>
        ${segment("贴图精度", c.pxPerMm, [[100, "100"], [200, "200"], [400, "400"]], value => updateGeometryInput(c, () => c.pxPerMm = value), "ft-resolution")}</div>
    </div><p class="ios-section-footer">越精细越慢；标准精度约半分钟到一分钟${c.pxPerMm === 400 ? html`<br />每次改外观约需半分钟。` : null}</p></section>
    <section>${sectionHeader("纱线材料")}<div class="ios-group">${fields(["densityGPerCm3", "fiberDiameterMm"])}</div></section>
    <section>${sectionHeader("模型参数")}<div class="ios-group">${fields(["E_f", "K", "phi0"])}</div>
      <p class="ios-section-footer">以上均为假设值，未经实测标定。</p></section>`);
}
function moreAppearance(c, pbr, defaults) {
  const icons = ["b_hairiness", "b_hairlen", "b_angle", "b_curl", "b_opacity", "b_halo", "b_halowidth"];
  return sheet(c, "ft-appearance-sheet", "更多外观设置", "quick", "不重新计算 · 通常几秒", html`
    <section>${sectionHeader("纱线贴图")}<div class="ios-group">
      ${hasMap(pbr.normal) ? html`<div class="ios-row ios-row-stack"><div class="ios-row-head">${rowLabel("b_normal", "法线贴图格式")}</div>
        ${segment("法线贴图格式", c.normalGreen, [["+Y", "OpenGL（+Y）"], ["-Y", "DirectX（−Y）"]], value => updateAppearance(c, () => c.normalGreen = value), "ft-normal-green")}</div>` : null}
      <div class="ios-row ios-row-stack"><div class="ios-row-head">${rowLabel("b_band", "扫描毛羽范围")}</div>
        ${segment("扫描毛羽范围", c.fuzzBand, [["fullScan", "整张图"], ["vRange", "纱线主体"]], value => updateAppearance(c, () => c.fuzzBand = value), "ft-fuzz-band")}</div>
    </div></section><section>${sectionHeader("毛羽细节")}<div class="ios-group">
      ${FUZZ_FIELDS.filter(([key]) => key !== "seed").map(([key, label, unit, min, max], index) => numericRow(icons[index], label, unit,
        c.fuzzOverrides[key] ?? defaults[key], value => updateAppearance(c, () => c.fuzzOverrides[key] = value), { id: `ft-fuzz-${key}`, min, max }))}
      <button type="button" id="ft-reset-fuzz" class="ios-row ios-reset" @click=${() => updateAppearance(c, () => c.fuzzOverrides = {})}>${rowLabel("r_reset", "恢复默认")}</button>
    </div><p class="ios-section-footer">没改过的项会跟着毛羽强度一起变（H = 16 × 毛羽强度）。</p></section>`);
}
function exportSettings(c, view) {
  return sheet(c, "ft-export-sheet", "导出设置", "file", "生成文件时使用", html`
    <section>${sectionHeader("面料贴图")}<div class="ios-group">${[0, 1].map(index => numericRow("e_repeat", index === 0 ? "横向重复" : "纵向重复", "", view.exportRepeat[index], value => {
      const repeat = [...view.exportRepeat]; repeat[index] = value; updateView(c, { exportRepeat: repeat });
    }, { id: `ft-export-repeat-${index}`, min: 1, integer: true }, true))}</div>
      <p class="ios-section-footer">平铺只是复制同一个单元，毛羽也会重复。</p></section>
    <section>${sectionHeader("纱线贴图")}<div class="ios-group">${numericRow("e_len", "纱线贴图长度", "mm", c.stripLengthMm,
      value => updateStripLength(c, value), { id: "ft-strip-length", min: 0.01, step: 0.5 }, true)}</div>
      <p class="ios-section-footer">改长度后，下次导出或查看单根纱线时要几秒重新生成。</p></section>
    <p class="ios-section-footer">ZIP 内含 PNG 贴图和说明文件；法线统一为 OpenGL 格式（+Y）。</p>`);
}
function technicalInformation(c, pbr, hasAlpha) {
  const result = c.displayResult, face = GLOBAL_STATE.fabricTextureView.face;
  const fuzz = face === "yarn" ? c.strip?.fuzz.diagnostics : c.fabric?.fuzz[face]?.diagnostics;
  const diagnostic = c.fabric?.material.diagnostics;
  return html`<div id="ft-technical-details" class="ios-details" ?hidden=${!c.showTechnical}>
    <p>这里的预览按三维纱线烘焙，与 PBR + 2.5D 页的二维路径预览不是同一种渲染；导出的贴图供 CLO3D 等软件使用。</p>
    <p>PBR：${YARN_PBR_MAP_KEYS.filter(key => hasMap(pbr[key])).map(key => MAP_LABELS[key]).join("、") || "无（使用纯色）"}。
      ${c.materialLoading ? "正在读取贴图…" : !c.material ? "颜色图透明通道：尚未读取。" : `颜色图透明通道：${hasAlpha ? "有，可使用扫描毛羽" : "无"}。`}
      物理重复长度：${pbr.physicalRepeatLengthMm ? `${number(pbr.physicalRepeatLengthMm)} mm（纱线库记录）` : "未设置，由贴图比例派生"}。</p>
    <p>毛羽是所选纱线的外观属性。此页为临时调整，不写回纱线；所有生成参数是假设值。
      材料参数来源：模型参考 / 手动假设，未经实测，物理状态未知。</p>
    ${result ? html`<dl><div><dt>求解状态与迭代次数</dt><dd>${result.status === "CONVERGED" ? "求解收敛" : "求解未收敛"} · ${result.status} · ${result.iterations} 次迭代</dd></div>
      <div><dt>单元 W × H（精确值）</dt><dd>${result.cell.W} × ${result.cell.H} mm</dd></div>
      <div><dt>模型有效直径 d_e</dt><dd>${number(result.params.d_e, 4)} mm（派生）</dd></div>
      <div><dt>生成纤维 / 毛羽像素</dt><dd>${fuzz?.fiberCount ?? "—"} 根 / ${number(fuzz?.fuzzPixelFraction * 100, 2)}%</dd></div></dl>` : null}
    ${diagnostic ? html`<p>贴图各向异性：${number(diagnostic.anisotropy)}。
      ${diagnostic.anisotropyWarning ? "沿纱长与横向缩放差异超过 2 倍，扫描图横向可能压缩或拉伸。" : "未触发超过 2 倍的缩放提示。"}贴图可见宽度不能作为纱线直径。</p>
      <p>贴图重复长度 ${number(diagnostic.repeatLengthMm)} mm（${diagnostic.repeatSource}），周期调整后 ${number(diagnostic.adjustedRepeatLengthMm)} mm；毛羽范围 ρ = ${number(diagnostic.rho)}。</p>` : null}
    ${c.strip ? html`<p>${c.strip.metadata.importInstruction} ${c.strip.metadata.preview.note}</p>` : null}
  </div>`;
}
function progressCard(c) {
  const yarn = c.phase === "yarn", stage = c.phase === "solve" ? 0 : ["geometry", "loading"].includes(c.phase) ? 1 : 2;
  const steps = yarn ? ["生成单根纱线贴图"] : ["求解线圈形状", "生成纱芯形状与阴影", "合成两面贴图"];
  const currentStep = yarn ? 0 : stage;
  const elapsed = !yarn && c.calculating ? Math.max(0, performance.now() - c.calculationStarted) : c.elapsedMs;
  return html`<div class="ios-progress" aria-label=${yarn ? "正在生成单根纱线贴图" : "正在计算面料"}>
    <h3>${yarn ? "正在生成单根纱线贴图" : "正在计算面料"} <span>· 已用 ${number(elapsed / 1000, 0)} 秒</span></h3>
    <div class="ios-progress-track" aria-hidden="true">${steps.map((_, index) => html`<span class=${index < currentStep ? "complete" : index === currentStep ? "current" : ""}></span>`)}</div>
    <ol>${steps.map((label, index) => html`<li class=${`ios-progress-step ${index < currentStep ? "complete" : index === currentStep ? "current" : ""}`}>
      <span aria-hidden="true">${index < currentStep ? glyph("check") : index === currentStep ? glyph("spinner") : "○"}</span>${label}</li>`)}</ol>
    <p>${yarn ? "生成后可预览或导出纱线贴图。" : "计算时可以继续调外观，完成后按最新设置出图。"}</p>
  </div>`;
}
function previewNotice(c, hasPreview, stale) {
  if (!hasPreview || !stale) return null;
  if (structureStale(c)) return html`<div class="ios-notice"><span class="ios-dot warning"></span>
    ${c.changedField === "loopLengthMm" ? `纱长已改为 ${number(c.input.loopLengthMm, 2)} mm，点‘重新计算’更新` : "面料结构已修改，点‘重新计算’更新"}</div>`;
  if (c.stoppedComposition) return html`<div class="ios-notice"><span class="ios-dot stopped"></span>
    ${c.cancelledCalculation ? "已停止计算，下方为修改前的预览。" : "已停止合成，下方为修改前的预览。"}
    <button type="button" class="ios-link" id="ft-recompose" @click=${() => {
      c.stoppedComposition = false; scheduleComposition(c); refresh(c);
    }}>重新合成</button></div>`;
  if (c.error) return html`<div class="ios-notice"><span class="ios-dot error"></span>下方为修改前的预览。</div>`;
  return html`<div class="ios-notice"><span class="ios-dot busy"></span>正在按新设置更新…（下方为修改前的预览）</div>`;
}
export function fabricTextureWorkbench() {
  if (!active()) { if (controller) dispose(controller); return null; }
  if (controller && controller.generation !== GLOBAL_STATE.projectGeneration) dispose(controller);
  if (!controller) {
    controller = createController(); observeState();
    const initial = controller;
    initial.resizeHandler = () => paintPreview(initial);
    window.addEventListener("resize", initial.resizeHandler);
    queueMicrotask(() => { if (current(initial)) loadMaterial(initial); });
  }
  const c = controller, view = GLOBAL_STATE.fabricTextureView, busy = c.phase !== "idle";
  const { pbr, resolved } = materialDescription(c), hasAlpha = c.material?.baseColor?.channels === 4;
  const hasPreview = Boolean(view.face === "yarn" ? c.strip : c.fabric), defaults = normalizeFuzzParameters({}, { fuzzStrength: c.fuzzStrength });
  const result = c.displayResult, stale = Boolean(hasPreview && (!fabricCurrent(c) || view.face === "yarn" && c.stripDirty));
  const structureChanged = structureStale(c), computed = Boolean(fabricCurrent(c));
  const calculationUnchanged = Boolean(c.fabricKey && c.fabricKey === inputKey(c) && geometryCurrent(c));
  const presets = [[0.25, "少", "fuzzLow"], [0.5, "中", "fuzzMedium"], [1, "多", "fuzzHigh"]];
  const preset = presets.find(([value]) => value === c.fuzzStrength), seed = c.fuzzOverrides.seed ?? defaults.seed;
  const unitValue = c.texUnit === "D" ? c.input.params.tex * 9 : c.texUnit === "Ne" ? 590.54 / c.input.params.tex : c.input.params.tex;
  const texDisplay = Number(unitValue.toFixed(c.texUnit === "tex" ? 2 : 1));
  const setTex = value => {
    const tex = c.texUnit === "D" ? value / 9 : c.texUnit === "Ne" ? 590.54 / value : value;
    if (Math.abs(tex - c.input.params.tex) / Math.max(Math.abs(c.input.params.tex), Number.MIN_VALUE) <= 1e-9) return;
    updateGeometryInput(c, () => { c.input.params.tex = tex; delete c.input.params.provenance.tex; });
  };
  const changeLoop = value => updateGeometryInput(c, () => c.input.loopLengthMm = value, "loopLengthMm");
  const showProgress = busy && c.phase !== "packing" && (c.calculating || isGeometryTask(c) || c.phase === "yarn" || !hasPreview);
  const status = c.error || (structureChanged && !busy && !c.status.startsWith("已停止") ? staleStatus : c.status);
  const statusKind = c.error ? "error" : busy ? "busy" : c.status.startsWith("已停止") ? "stopped" : structureChanged ? "warning" : computed ? "success" : "stopped";
  queueMicrotask(() => paintPreview(c));
  return html`<section id="fabric-texture-workbench" class="ios-workbench" data-ui="ios"
    @keydown=${event => event.stopPropagation()} @keyup=${event => event.stopPropagation()}>
    <aside class="ios-sidebar"><header><h1 class="ios-title">面料纹理 <span class="ios-tag recompute">实验</span></h1>
      <p class="ios-subtitle">由纱线和纱长算出线圈形状，生成按毫米定尺寸、可平铺的面料贴图。</p></header>
      <section>${sectionHeader("面料结构", "recompute", "改了要重新计算")}<div class="ios-group">
        <div class="ios-row">${rowLabel("o_struct", "组织")}<span class="ios-row-value">纬平针（单面）</span></div>
        <div class="ios-row">${rowLabel("o_tex", "线密度")}<span class="ios-row-value">
          ${numericInput("线密度", texDisplay, setTex, { id: "ft-param-tex" })}
          <select class="ios-select ios-unit" id="ft-tex-unit" aria-label="线密度单位" .value=${live(c.texUnit)} @change=${event => { c.texUnit = event.currentTarget.value; refresh(c); }}>
            <option value="tex">tex</option><option value="D">D</option><option value="Ne">英支</option></select>${glyph("menu")}</span></div>
        ${numericRow("o_loop", "纱长", "mm/圈", c.input.loopLengthMm, changeLoop, { id: "ft-loop-length", min: 0.01, step: 0.01 }, true)}
        <button id="ft-more-parameters" type="button" class="ios-row" @click=${event => openSheet(c, "ft-parameters-sheet", event)}>
          ${rowLabel("o_more", "更多参数")}<span class="ios-row-value">精度 · 材料 · 假设值${glyph("chevron")}</span></button>
      </div><p class="ios-section-footer">纱线库目前只管外观，计算用的线密度在这里填。</p></section>
      <div><button id="ft-calculate" type="button" class=${`ios-btn-primary ${busy ? "ios-stop" : ""}`}
        ?disabled=${!busy && (c.materialLoading || !c.material || calculationUnchanged && !c.cancelledCalculation)}
        @click=${() => busy ? cancel(c) : calculate(c)}>${glyph(busy ? "stop" : structureChanged ? "recalculate" : "calculate", 18)}
        ${busy ? "停止计算" : structureChanged ? "重新计算" : "计算面料"}</button>
        <p class="ios-action-note">${busy ? "可随时停止" : calculationUnchanged && !c.cancelledCalculation ? "面料结构未改动，不用重新计算"
          : c.input.nodesPerLoop === 64 ? "约 1～3 分钟" : c.input.nodesPerLoop === 24 ? "比标准快" : "约半分钟到一分钟"}</p></div>
      <section>${sectionHeader("外观", "quick", "不重新计算 · 通常几秒")}<div class="ios-group">
        <label class="ios-row">${rowLabel("b_yarn", "纱线外观")}<span class="ios-row-value"><span class="ios-swatch" style=${`background:${resolved.color}`}></span>
          <select class="ios-select" id="ft-yarn" aria-label="纱线外观" .value=${live(c.yarnId)} @change=${event => { c.yarnId = event.currentTarget.value; loadMaterial(c, true); }}>
            ${GLOBAL_STATE.yarnLibrary.length ? GLOBAL_STATE.yarnLibrary.map(yarn => html`<option value=${String(yarn.id)} ?selected=${String(yarn.id) === c.yarnId}>${yarn.name}</option>`) : html`<option value="">纯色纱线</option>`}</select>${glyph("chevron")}</span></label>
        <div class="ios-row ios-row-stack"><div class="ios-row-head">${rowLabel("b_fuzz", "毛羽")}<span class="ios-row-value">${preset ? `${preset[1]} · ` : ""}${number(c.fuzzStrength, 2)}</span></div>
          ${segment("毛羽强度预设", c.fuzzStrength, presets, value => updateAppearance(c, () => c.fuzzStrength = value), "ft-fuzz-presets")}
          <input id="ft-fuzz-strength" aria-label="毛羽强度" type="range" min="0" max="1" step="0.01" .value=${live(String(c.fuzzStrength))}
            @input=${event => updateAppearance(c, () => c.fuzzStrength = Number(event.currentTarget.value))} /></div>
        <label class="ios-row">${rowLabel("b_src", "毛羽来源")}<span class="ios-row-value"><select id="ft-fuzz-source" class="ios-select" aria-label="毛羽来源" .value=${live(c.fuzzSource)}
          @change=${event => updateAppearance(c, () => { c.fuzzSource = event.currentTarget.value; c.sourceVersion++; })}>
          <option value="generated">生成</option><option value="scan" ?disabled=${!hasAlpha}>扫描</option><option value="both" ?disabled=${!hasAlpha}>扫描 + 生成</option><option value="off">无</option></select>${glyph("menu")}</span></label>
        <div class="ios-row"><button type="button" id="ft-next-seed" class="ios-link" @click=${() => updateAppearance(c, () => c.fuzzOverrides.seed = seed + 1)}>${rowLabel("b_dice", "换一组纤维")}</button>
          <span class="ios-row-value">第 ${numericInput("随机种子", seed, value => updateAppearance(c, () => c.fuzzOverrides.seed = value),
            { id: "ft-fuzz-seed", min: -Number.MAX_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER, integer: true })} 组</span></div>
        <button id="ft-more-appearance" type="button" class="ios-row" @click=${event => openSheet(c, "ft-appearance-sheet", event)}>
          ${rowLabel("b_more", "更多外观设置")}<span class="ios-row-value">毛长 · 光晕 · 法线${glyph("chevron")}</span></button>
      </div><p class="ios-section-footer">${c.materialLoading ? "正在读取纱线贴图…" : !hasAlpha ? "所选纱线的贴图没有透明通道，‘扫描’毛羽不可用。" : ""}
        ${c.pxPerMm === 400 ? "当前贴图精度 400，每次更新约需半分钟。" : ""}</p>
        ${!c.material && !c.materialLoading ? html`<button type="button" class="ios-link" @click=${() => loadMaterial(c, true)}>重新读取纱线</button>` : null}
      </section>
    </aside>
    <div class="ios-detail"><div class="ios-toolbar">
      ${segment("预览视图", view.face, [["technicalFace", "工艺正面", "face"], ["technicalBack", "工艺反面", "back"], ["yarn", "单根纱线", "strand"]], value => updateView(c, { face: value }), "ft-face")}
      <div class="ios-repeat">${glyph("tile", 17)}<span>平铺 <span class="ios-row-value">${view.tileCount} × ${view.tileCount}</span></span>
        ${stepper("平铺", view.tileCount, value => updateView(c, { tileCount: value }), { min: 2, max: 8, disabled: view.face === "yarn" })}</div>
      <span class="ios-section-footer">切换视图和平铺只换显示，不计算</span></div>
      <div class="ios-well" aria-label="面料纹理预览">
        ${hasPreview ? html`<canvas id="ft-preview-canvas" class=${`ios-canvas ${stale ? "ios-stale" : ""}`} aria-label="带毫米比例尺的纹理预览"></canvas>`
          : html`<div class="ios-empty">${glyph("empty", 52)}<h2>还没有面料预览</h2><p>在左侧选纱线、填纱长，然后点‘计算面料’。这里会显示可平铺的面料纹理和毫米比例尺。</p></div>`}
        ${showProgress ? progressCard(c) : previewNotice(c, hasPreview, stale)}
      </div>
      ${result && result.status !== "CONVERGED" ? html`<p class="ios-warning">求解未收敛，以下数值仅供参考</p>` : null}
      <section class="ios-results" aria-label="计算结果"><dl class=${`ios-stats ${result && (!computed || stale) ? "ios-stale" : ""}`}>
        <div class="ios-stat"><dt>横密</dt><dd>${number(result?.metrics.waleDensityPerCm, 2)} <small>纵行/cm</small></dd></div>
        <div class="ios-stat"><dt>纵密</dt><dd>${number(result?.metrics.courseDensityPerCm, 2)} <small>横列/cm</small></dd></div>
        <div class="ios-stat"><dt>克重</dt><dd>${number(result?.metrics.gsm, 1)} <small>g/m²</small></dd></div>
        <div class="ios-stat"><dt>线圈 宽 × 高（mm）</dt><dd>${number(result?.cell.W)}×${number(result?.cell.H)}</dd></div>
      </dl><div class="ios-exports"><button id="ft-export-fabric" type="button" class="ios-btn-capsule file" ?disabled=${busy || !computed || stale || c.materialLoading}
          @click=${() => exportTexture(c, "fabric")}>${glyph("fabric", 16)}导出面料贴图</button>
        <button id="ft-export-yarn" type="button" class="ios-btn-capsule file" ?disabled=${busy || !computed || stale || c.materialLoading}
          @click=${() => exportTexture(c, "yarn")}>${glyph("yarn", 16)}导出纱线贴图</button>
        <button id="ft-more-export" type="button" class="ios-btn-capsule file ios-icon-button" aria-label="导出设置：平铺次数、纱线贴图长度"
          @click=${event => openSheet(c, "ft-export-sheet", event)}>${glyph("more", 16)}</button></div></section>
      <p class="ios-calibration"><span class="ios-tag recompute">未标定预测</span> 与文献相比，横密偏高约 6%～14%，纵密偏高约 10%～12%，克重偏高约 17%～28%。</p>
      <div class="ios-status"><span class="ios-status-main" role=${c.error ? "alert" : "status"}><span class=${`ios-dot ${statusKind}`}></span>
          <span class=${c.error ? "ios-error" : ""}>${status}${c.phase === "fabric" && !c.calculating ? ` 已用 ${number(c.elapsedMs / 1000, 1)} 秒` : ""}</span></span>
        <div class="ios-links"><button id="ft-technical-toggle" type="button" class="ios-link" aria-expanded=${String(c.showTechnical)} aria-controls="ft-technical-details"
          @click=${() => { c.showTechnical = !c.showTechnical; refresh(c); }}>${glyph("info")}技术详情</button>
          <button id="ft-limitations-toggle" type="button" class="ios-link" aria-expanded=${String(c.showLimitations)} aria-controls="ft-limitations"
            @click=${() => { c.showLimitations = !c.showLimitations; refresh(c); }}>${glyph("warn")}使用范围与局限（${FABRIC_TEXTURE_LIMITATIONS.length} 条）</button></div></div>
      ${technicalInformation(c, pbr, hasAlpha)}
      <div id="ft-limitations" class="ios-details" ?hidden=${!c.showLimitations}><ol>${FABRIC_TEXTURE_LIMITATIONS.map(text => html`<li>${text}</li>`)}</ol></div>
    </div>${moreParameters(c)}${moreAppearance(c, pbr, defaults)}${exportSettings(c, view)}
  </section>`;
}
