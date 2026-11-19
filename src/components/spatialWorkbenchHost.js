// Keep this bridge free of static math, renderer, state and widget imports so a
// cold Classic session never starts the separate experiment.
export function createSpatialWorkbenchHost({ getContext,
  getContainer = () => document.getElementById("yarn-spatial-workbench-slot"),
  loadWorkbench = () => import("../views/yarnSpatialWorkbench.js") }) {
  let widget = null, container = null, generation = null, session = null, errorNode = null;
  let epoch = 0, pending = null, disposed = false, phase = "inactive";
  function showError(target, error) {
    errorNode?.remove();
    errorNode = target.ownerDocument.createElement("p");
    errorNode.className = "spatial-error"; errorNode.setAttribute("role", "alert");
    errorNode.textContent = `TEST_ONLY 三维实验加载失败：${error.message || error}`;
    target.appendChild(errorNode);
  }
  function release() {
    epoch++; pending = null;
    if (widget) { session = widget.exportSession(); widget.dispose(); }
    // The widget owns its Lit root marker. Remove only the host's error node.
    errorNode?.remove(); errorNode = null;
    widget = null; container = null; phase = "inactive";
  }
  const api = {
    sync() {
      if (disposed) return;
      const context = getContext(), nextContainer = getContainer();
      if (generation !== context.projectGeneration) {
        release(); session = null; generation = context.projectGeneration;
      }
      if (context.workbenchMode !== "pbr25d" || !nextContainer || nextContainer.isConnected === false) {
        release(); phase = "inactive"; return;
      }
      if (container && container !== nextContainer) release();
      container = nextContainer;
      if (widget) { widget.updateContext(context); return; }
      if (pending || phase === "error") return;
      const token = ++epoch, requestedGeneration = generation, requestedContainer = container;
      const isCurrent = () => {
        const live = getContext();
        return !disposed && token === epoch && live.workbenchMode === "pbr25d" &&
          live.projectGeneration === requestedGeneration && getContainer() === requestedContainer && requestedContainer.isConnected !== false;
      };
      phase = "loading";
      try {
        pending = Promise.resolve(loadWorkbench()).then(module => {
          // Read live state after import, even when the next app DOM frame has not run.
          if (!isCurrent()) return;
          widget = module.createYarnSpatialWorkbench({ container: requestedContainer, context: getContext(), session });
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
    dispose() { if (disposed) return; disposed = true; release(); session = null; phase = "disposed"; },
  };
  return api;
}
