import { createYarnSpatialPreviewRenderer } from "../simulation/yarnSpatialPreviewRenderer.js";
import { fitYarnSpatialView, resolveYarnSpatialView } from "../simulation/yarnSpatialCamera.js";
import { createSimulationSnapshot } from "../simulation/simulationSnapshot.js";

const DEFAULT_MATERIAL = { color: [.72, .31, .12], roughness: .42, anisotropy: .55,
  ambient: .22, lightIntensity: 3, lightDirection: [.4, .7, 1], mode: "solid" };
const workerFactory = () => new Worker(new URL("../simulation/yarnRelaxationWorker.js", import.meta.url), { type: "module" });
const metadata = context => ({ projectGeneration: context.projectGeneration, feedYarnStructureRevision: context.feedYarnStructureRevision });

export function createYarnRelaxationWorkbenchController({ context, session = null, onChange = () => {},
  createWorker = workerFactory, createRenderer = createYarnSpatialPreviewRenderer }) {
  let source = metadata(context);
  const saved = session?.projectGeneration === source.projectGeneration ? session : null;
  let targetLengthMm = saved?.targetLengthMm ?? 14, displayMode = saved?.displayMode === "initial" ? "initial" : "solved";
  let material = createSimulationSnapshot({ ...DEFAULT_MATERIAL, ...saved?.material });
  let view = saved?.view ? createSimulationSnapshot(saved.view) : null;
  let result = null, initial = null, referenceCases = Object.freeze([]), derivedGeometry = null, commonBounds = null;
  let renderer = null, container = null, worker = null, requestId = 0, disposed = false, clearing = false;
  let phase = "IDLE", error = null, geometryApplyError = null, materialError = null;
  let rendererStatus = Object.freeze({ status: "UNMOUNTED", diagnostic: null });
  const notify = () => { if (!disposed) onChange(); };
  const aspect = () => container?.clientWidth > 0 && container?.clientHeight > 0 ? container.clientWidth / container.clientHeight : 1;
  function cancel() { requestId++; worker?.terminate(); worker = null; }
  function clearScene() {
    derivedGeometry = null;
    if (!renderer || clearing) return;
    clearing = true;
    try { renderer.update({ geometry: null }); }
    catch (caught) { geometryApplyError = createSimulationSnapshot({ status: "ERROR", diagnostic: String(caught.message || caught) }); }
    finally { clearing = false; }
  }
  function renderingFailed(status) {
    geometryApplyError = createSimulationSnapshot(status); clearScene(); notify();
  }
  function send(operation) {
    if (!renderer || disposed) return null;
    try { return operation(); }
    catch (caught) {
      const failed = { status: "ERROR", diagnostic: String(caught.message || caught) };
      renderingFailed(failed); return failed;
    }
  }
  function applyScene(retry = false) {
    if (phase !== "CONVERGED" || !renderer || geometryApplyError && !retry) return;
    const geometry = displayMode === "initial" ? initial : result;
    if (!geometry?.mesh) return;
    const applied = send(() => renderer.update({ geometry: geometry.mesh, ...(view ? { view } : {}) }));
    if (!applied || ["INVALID", "ERROR", "UNAVAILABLE", "CONTEXT_LOST"].includes(applied.status)) {
      if (applied) renderingFailed(applied);
      return;
    }
    geometryApplyError = null; derivedGeometry = geometry;
  }
  function publish(next) {
    result = createSimulationSnapshot(next); phase = result.status;
    error = phase === "CONVERGED" ? null : Object.freeze({ code: result.reason || phase,
      message: result.reason || "形状生成失败；未显示旧结果。" });
    applyScene(true); notify();
  }
  function jobFailed(message) {
    cancel(); phase = "ERROR"; result = null; clearScene();
    error = Object.freeze({ code: "WORKER_FAILED", message: String(message) }); notify();
  }
  function request(target) {
    if (disposed) return;
    cancel(); targetLengthMm = target; result = null; error = null; phase = "PENDING"; clearScene(); notify();
    if (!Number.isFinite(target) || target <= 0) {
      phase = "INVALID"; error = Object.freeze({ code: "INVALID_TARGET_LENGTH", message: "目标长度 target 必须为有限正数 (mm)，空值不会沿用旧目标。" });
      notify(); return;
    }
    const cached = referenceCases.find(item => item.targetLengthMm === target);
    if (cached) { publish(cached); return; }
    const token = requestId, captured = { ...source };
    const current = () => !disposed && requestId === token && source.projectGeneration === captured.projectGeneration &&
      source.feedYarnStructureRevision === captured.feedYarnStructureRevision && targetLengthMm === target;
    try {
      const active = createWorker(); worker = active;
      active.onmessage = ({ data }) => {
        if (!current() || data.requestId !== token || data.projectGeneration !== captured.projectGeneration ||
          data.feedYarnStructureRevision !== captured.feedYarnStructureRevision || data.targetLengthMm !== target) return;
        active.terminate(); worker = null; requestId++;
        if (data.error) { jobFailed(data.error); return; }
        try {
          const answer = createSimulationSnapshot(data);
          if (answer.initial && answer.referenceCases) {
            initial = answer.initial; referenceCases = answer.referenceCases;
            const bounds = [initial, ...referenceCases].filter(item => item.mesh).map(item => item.mesh.bounds);
            if (bounds.length) commonBounds = createSimulationSnapshot({
              min: [0, 1, 2].map(axis => Math.min(...bounds.map(item => item.min[axis]))),
              max: [0, 1, 2].map(axis => Math.max(...bounds.map(item => item.max[axis]))) });
          }
          if (!view && commonBounds) view = createSimulationSnapshot(fitYarnSpatialView(resolveYarnSpatialView().view, commonBounds, aspect()).view);
          publish(answer.result);
        } catch (caught) { jobFailed(caught.message || caught); }
      };
      active.onerror = event => { event.preventDefault?.(); if (current()) jobFailed(event.message || "Worker execution failed."); };
      active.onmessageerror = () => { if (current()) jobFailed("Worker message could not be decoded."); };
      active.postMessage({ requestId: token, ...captured, targetLengthMm: target, includeReferences: !initial });
    } catch (caught) { jobFailed(caught.message || caught); }
  }
  const api = {
    get model() { return Object.freeze({ targetLengthMm, displayMode, material, view, phase, result, initial, referenceCases,
      derivedGeometry, commonBounds, error, geometryApplyError, materialError, rendererStatus }); },
    mount(target) {
      if (disposed || container) return;
      container = target;
      try {
        renderer = createRenderer({ onViewChange(next) { view = createSimulationSnapshot(next); notify(); },
          onStatusChange(next) {
            rendererStatus = createSimulationSnapshot(next);
            if (!clearing && ["UNAVAILABLE", "ERROR", "CONTEXT_LOST"].includes(next.status)) renderingFailed(next);
            notify();
          } });
        const mounted = renderer.mount(container);
        if (["INVALID", "UNAVAILABLE", "ERROR"].includes(mounted?.status)) renderingFailed(mounted);
        api.setMaterial({});
      } catch (caught) {
        renderer?.dispose(); renderer = null;
        renderingFailed({ status: "ERROR", diagnostic: String(caught.message || caught) });
      }
      request(targetLengthMm);
    },
    setTargetLength: request,
    setDisplayMode(mode) {
      if (disposed || !["initial", "solved"].includes(mode)) return;
      displayMode = mode; applyScene(); notify();
    },
    setMaterial(patch) {
      if (disposed) return;
      material = createSimulationSnapshot({ ...material, ...patch });
      const applied = send(() => renderer.update({ material }));
      materialError = applied?.status === "INVALID" ? applied.diagnostic : null; notify();
    },
    setView(patch) { send(() => renderer.setView(patch)); notify(); },
    fit() {
      const bounds = commonBounds ?? derivedGeometry?.mesh?.bounds;
      if (!bounds || geometryApplyError) return;
      const fitted = fitYarnSpatialView(view ?? resolveYarnSpatialView().view, bounds, aspect());
      if (fitted.status === "OK") api.setView(fitted.view);
    },
    closeup() {
      if (!derivedGeometry || geometryApplyError) return;
      const tangent = derivedGeometry.centerline.tangents.at(-1);
      api.setView({ target: [6, 0, 0], yaw: Math.atan2(tangent[0], tangent[2]), pitch: Math.asin(tangent[1]),
        distance: 5 * derivedGeometry.geometryParameters.radiusMm });
    },
    updateContext(next) {
      if (disposed) return;
      if (next.workbenchMode && next.workbenchMode !== "pbr25d") { api.dispose(); return; }
      if (next.projectGeneration === source.projectGeneration && next.feedYarnStructureRevision === source.feedYarnStructureRevision) return;
      const newProject = next.projectGeneration !== source.projectGeneration;
      source = metadata(next); initial = null; referenceCases = Object.freeze([]); commonBounds = null;
      if (newProject) {
        targetLengthMm = 14; displayMode = "solved"; view = null;
        material = createSimulationSnapshot(DEFAULT_MATERIAL); api.setMaterial({});
      }
      request(targetLengthMm);
    },
    exportSession() { return createSimulationSnapshot({ projectGeneration: source.projectGeneration, targetLengthMm, displayMode, material, view }); },
    dispose() {
      if (disposed) return;
      cancel(); disposed = true; result = null; initial = null; referenceCases = Object.freeze([]); derivedGeometry = null;
      renderer?.dispose(); renderer = null; phase = "DISPOSED";
    },
  };
  return api;
}
