import { createClassic2dRenderer } from "../simulation/classic2dRenderer.js";
import { resolveYarnRenderItems } from "../simulation/yarnRenderItems.js";
import { projectSimulationViewport } from "../simulation/simulationViewport.js";
import { simulationPointerInteraction, endSimulationPointerInteractions } from "../events/simulationPointerInteraction.js";
import { endSimulationTouchInteractions } from "../events/simulationTouchInteraction.js";
import { cancelTexturePreviewInteraction } from "../actions/texturePerformance.js";

const targets = {
  pattern: { container: "sim-before-container", ids: ["back", "mid", "front"] },
  machine: { container: "sim-after-container", ids: ["back-arranged", "mid-arranged", "front-arranged"] },
  pbr: { container: "pbr-preview-container", ids: ["pbr-back", "pbr-mid", "pbr-front"] },
};

export function createSimulationPreviewHost({ getState, getSnapshots, getClassicView, onViewportChange }) {
  let mode = null, generation = null, epoch = 0, dirty = false, disposed = false, transitioning = false;
  let frame = null, loading = null, pbrFactory = null, observer = null, interactionCleanup = null;
  const renderers = new Map(), projections = new Map();
  let status = Object.freeze({ phase: "unmounted", sceneScope: null, derivedGeometry: null });
  function setStatus(phase, sceneScope = null, snapshot = null) {
    // A future spatial engine may publish a separate readonly derivedGeometry
    // keyed by these source fields. It cannot replace original paths/results.
    status = Object.freeze({ phase, sceneScope, derivedGeometry: null,
      source: snapshot ? Object.freeze({ inputSignature: snapshot.inputSignature,
        projectGeneration: snapshot.projectGeneration, feedYarnStructureRevision: snapshot.feedYarnStructureRevision }) : null });
  }
  function clearTarget(name) {
    for (const id of targets[name].ids) {
      const canvas = document.getElementById(id);
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  function release(name) {
    const entry = renderers.get(name);
    renderers.delete(name); projections.delete(name);
    entry?.renderer.dispose();
    if (entry) observer?.unobserve?.(entry.container);
    if (name === "pbr") { const cleanup = interactionCleanup; interactionCleanup = null; cleanup?.(); }
    clearTarget(name);
  }
  function releaseAll() {
    transitioning = true;
    epoch++;
    for (const name of [...renderers.keys()]) release(name);
    observer?.disconnect(); observer = null;
    interactionCleanup?.(); interactionCleanup = null;
    endSimulationPointerInteractions(); endSimulationTouchInteractions(); cancelTexturePreviewInteraction();
    transitioning = false;
  }
  function request() {
    if (disposed) return;
    dirty = true;
    if (transitioning) return;
    if (!window.requestAnimationFrame) { flush(); return; }
    if (frame !== null) return;
    frame = window.requestAnimationFrame(() => { frame = null; flush(); });
  }
  function viewport(name, state) {
    const view = name === "pbr" ? state.pbrView : getClassicView();
    const container = document.getElementById(targets[name].container);
    const bbox = container?.getBoundingClientRect(), dpi = globalThis.devicePixelRatio || 1;
    const width = (bbox?.width ?? 0) * view.scale, height = (bbox?.height ?? 0) * view.scale;
    return { view, container, width, height, canvasWidth: width * dpi, canvasHeight: height * dpi };
  }
  function project(name, snapshot, canvasWidth, canvasHeight) {
    let projected = projections.get(name);
    if (!projected || projected.snapshot !== snapshot || projected.canvasWidth !== canvasWidth || projected.canvasHeight !== canvasHeight) {
      projected = { snapshot, ...projectSimulationViewport(snapshot, { canvasWidth, canvasHeight }) };
      projections.set(name, projected);
    }
    return projected;
  }
  function draw(name, snapshot, state) {
    if (!snapshot) { release(name); return; }
    const target = targets[name], container = document.getElementById(target.container);
    const canvasList = target.ids.map(id => document.getElementById(id));
    if (!container || canvasList.some(canvas => !canvas)) return;
    const canvases = Object.fromEntries(["backCanvas", "midCanvas", "frontCanvas"].map((key, i) => [key, canvasList[i]]));
    let entry = renderers.get(name);
    if (entry && (entry.scope !== snapshot.scope || canvasList.some((canvas, i) => entry.canvasList[i] !== canvas))) {
      release(name); entry = null;
    }
    if (!entry) {
      const renderer = (name === "pbr" ? pbrFactory : createClassic2dRenderer)().mount(canvases);
      entry = { renderer, canvasList, container, scope: snapshot.scope }; renderers.set(name, entry);
      if (typeof ResizeObserver !== "undefined") { observer ??= new ResizeObserver(resize); observer.observe(container); }
      if (name === "pbr" && container.addEventListener)
        interactionCleanup = simulationPointerInteraction(container, { viewKey: "pbrView" });
    }
    const { view, width, height, canvasWidth, canvasHeight } = viewport(name, state);
    if (canvasWidth <= 0 || canvasHeight <= 0) return;
    for (const canvas of canvasList) {
      if (canvas.width !== Math.trunc(canvasWidth)) canvas.width = canvasWidth;
      if (canvas.height !== Math.trunc(canvasHeight)) canvas.height = canvasHeight;
      canvas.style.cssText = `width: ${width}px; height: ${height}px;`;
    }
    const projected = project(name, snapshot, canvasWidth, canvasHeight);
    const renderItems = resolveYarnRenderItems({ snapshot, yarnStrands: projected.yarnStrands,
      palette: state.yarnPalette, yarnPlies: state.yarnPlies, yarnSequence: state.yarnSequence,
      yarnLibrary: snapshot.scope === "machine" ? state.yarnLibrary : null,
      feeds: snapshot.scope === "machine" ? state.singleJerseyCamProgram?.feeds : null,
      visibleYarnId: view.visibleYarnId });
    entry.renderer.update({ ...projected, renderItems, yarnPathLinks: snapshot.yarnPathLinks,
      machineGauge: snapshot.machineGauge, structureLineStyle: name === "machine" ? view.structureLineStyle : null,
      texturePerformanceMode: state.texturePerformanceMode,
      texturePreviewInteractionActive: state.texturePreviewInteractionActive,
      derivedGeometry: null });
  }
  function flush() {
    if (!dirty || disposed) return;
    dirty = false;
    const state = getState(), snapshots = getSnapshots();
    if (snapshots.pending) { setStatus("pending"); return; }
    if (mode === "pbr25d") {
      const snapshot = snapshots.machine ?? (snapshots.machineExecutionError ? null : snapshots.pattern);
      if (!snapshot) { release("pbr"); setStatus("invalid"); return; }
      if (!pbrFactory) {
        const currentEpoch = epoch;
        loading ??= import("../simulation/pbrPreviewRenderer.js").then(module => { pbrFactory = module.createPbrPreviewRenderer; });
        loading.then(() => { if (!disposed && currentEpoch === epoch && mode === "pbr25d") request(); });
        setStatus("loading", snapshot.scope, snapshot); return;
      }
      draw("pbr", snapshot, state); setStatus("ready", snapshot.scope, snapshot);
    } else {
      draw("pattern", snapshots.pattern, state); draw("machine", snapshots.machine, state);
      setStatus(snapshots.machineExecutionError ? "invalid" : "ready", snapshots.machine ? "machine" : "pattern",
        snapshots.machine ?? snapshots.pattern);
    }
  }
  const resize = () => { request(); if (!disposed) onViewportChange?.(); };
  window.addEventListener?.("resize", resize);
  return {
    request, flush,
    sync() {
      const state = getState(), nextMode = state.workbenchMode ?? "classic2d";
      if (mode !== nextMode || generation !== state.projectGeneration) {
        mode = nextMode; generation = state.projectGeneration;
        releaseAll();
      }
      for (const entry of renderers.values()) entry.renderer.suspend();
      request();
    },
    invalidate() {
      for (const [name, entry] of renderers) { entry.renderer.suspend(); clearTarget(name); }
      setStatus("pending");
    },
    projection(name) {
      const snapshot = getSnapshots()[name];
      if (!snapshot) return null;
      const { canvasWidth, canvasHeight } = viewport(name, getState());
      return project(name, snapshot, canvasWidth, canvasHeight);
    },
    get status() { return status; },
    async ready() { await loading; await Promise.all([...renderers.values()].map(entry => entry.renderer.ready)); return status; },
    dispose() {
      if (disposed) return;
      disposed = true; releaseAll();
      if (frame !== null) window.cancelAnimationFrame?.(frame);
      window.removeEventListener?.("resize", resize);
      dirty = false; setStatus("disposed");
    },
  };
}
