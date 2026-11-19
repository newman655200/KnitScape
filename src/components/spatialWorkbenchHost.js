// Load a 3D view only when its workspace is visible.
export function createSpatialWorkbenchHost({ getContext,
  getContainer = mode => document.getElementById(mode === "sop3d" ? "sop-swatch-workbench-slot" : "yarn-spatial-workbench-slot"),
  loadWorkbench = () => import("../views/yarnSpatialWorkbench.js"),
  loadSwatch = () => import("../views/sopTopologyWorkbench.js") }) {
  const sessions = new Map();
  let widget = null, container = null, generation = null, mode = null, errorNode = null;
  let epoch = 0, pending = null, disposed = false, phase = "inactive";
  function showError(target, error) {
    errorNode?.remove();
    errorNode = target.ownerDocument.createElement("p");
    errorNode.className = "spatial-error"; errorNode.setAttribute("role", "alert");
    const title = mode === "sop3d" ? "三维样布" : "TEST_ONLY 三维实验";
    errorNode.textContent = `${title}加载失败：${error?.message || error}`;
    target.appendChild(errorNode);
  }
  function release() {
    epoch++; pending = null;
    if (widget) { sessions.set(mode, widget.exportSession()); widget.dispose(); }
    // The widget owns its Lit root marker. Remove only the host's error node.
    errorNode?.remove(); errorNode = null;
    widget = null; container = null; mode = null; phase = "inactive";
  }
  const api = {
    sync() {
      if (disposed) return;
      const context = getContext(), nextMode = context.workbenchMode, nextContainer = getContainer(nextMode);
      if (generation !== context.projectGeneration) {
        if (!(widget && mode === "sop3d" && mode === nextMode && container === nextContainer)) release();
        sessions.clear(); generation = context.projectGeneration;
      }
      if ((nextMode !== "pbr25d" && nextMode !== "sop3d") || !nextContainer || nextContainer.isConnected === false) {
        release(); return;
      }
      if (container && (container !== nextContainer || mode !== nextMode)) release();
      container = nextContainer; mode = nextMode;
      if (widget) { widget.updateContext(context); return; }
      if (pending || phase === "error") return;
      const token = ++epoch, requestedGeneration = generation, requestedContainer = container;
      const isCurrent = () => {
        const live = getContext();
        return !disposed && token === epoch && live.workbenchMode === nextMode &&
          live.projectGeneration === requestedGeneration && getContainer(nextMode) === requestedContainer && requestedContainer.isConnected !== false;
      };
      phase = "loading";
      try {
        const swatch = nextMode === "sop3d";
        pending = Promise.resolve(swatch ? loadSwatch() : loadWorkbench()).then(module => {
          // Read live state after import, even when the next app DOM frame has not run.
          if (!isCurrent()) return;
          const args = { container: requestedContainer, context: getContext(), session: sessions.get(nextMode) ?? null };
          widget = swatch ? module.createSopTopologyWorkbench({ ...args, startInSwatch: true }) : module.createYarnSpatialWorkbench(args);
          phase = "ready";
        }).catch(error => {
          if (!isCurrent()) return;
          phase = "error";
          showError(requestedContainer, error);
        }).finally(() => { if (token === epoch) pending = null; });
      } catch (error) {
        phase = "error"; showError(requestedContainer, error);
      }
    },
    get status() { return Object.freeze({ phase, derivedGeometry: widget?.derivedGeometry ?? null }); },
    async ready() { await pending; return api.status; },
    dispose() { if (disposed) return; disposed = true; release(); sessions.clear(); phase = "disposed"; },
  };
  return api;
}
