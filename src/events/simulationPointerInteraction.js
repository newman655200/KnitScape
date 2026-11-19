import { GLOBAL_STATE, dispatch } from "../state";
import { MIN_SIM_SCALE, MAX_SIM_SCALE } from "../constants";
import { beginTexturePreviewInteraction, endTexturePreviewInteraction } from "../actions/texturePerformance";

const SIM_WHEEL_IDLE_MS = 120;
const interactions = new Set();
export function endSimulationPointerInteractions() { for (const end of interactions) end(); }

export function simulationPointerInteraction(simContainer, { viewKey = null } = {}) {
  let wheelPreviewTimer = null, wheelPreview = null, endPan = null;
  const view = () => viewKey ? GLOBAL_STATE[viewKey] : { scale: GLOBAL_STATE.simScale, pan: GLOBAL_STATE.simPan };
  const update = patch => viewKey
    ? dispatch({ [viewKey]: { ...GLOBAL_STATE[viewKey], ...patch } })
    : dispatch({ ...(patch.scale === undefined ? {} : { simScale: patch.scale }),
      ...(patch.pan === undefined ? {} : { simPan: patch.pan }) });
  function applyWheelPreviewTransform(preview) {
    if (viewKey) dispatch({ [viewKey]: { ...GLOBAL_STATE[viewKey], previewScale: preview.scale, previewPan: preview.pan } });
    else dispatch({ simPreviewScale: preview.scale, simPreviewPan: preview.pan });
  }
  function commitWheelPreviewZoom() {
    window.clearTimeout(wheelPreviewTimer);
    if (!wheelPreview) return;
    const { scale, pan } = wheelPreview;
    wheelPreview = null;
    if (viewKey) dispatch({ [viewKey]: { ...GLOBAL_STATE[viewKey], scale, pan, previewScale: null, previewPan: null } });
    else dispatch({ simScale: scale, simPan: pan, simPreviewScale: null, simPreviewPan: null });
    endTexturePreviewInteraction();
  }
  function finish() { commitWheelPreviewZoom(); endPan?.(); }
  function wheel(e) {
    e.preventDefault();
    beginTexturePreviewInteraction();
    const bounds = simContainer.getBoundingClientRect();
    const base = wheelPreview || view();
    const zoomIn = Math.sign(e.deltaY) < 0;
    const scale = base.scale * (zoomIn !== GLOBAL_STATE.reverseScroll ? 1.1 : .9);
    if (scale < MIN_SIM_SCALE || scale > MAX_SIM_SCALE) { endTexturePreviewInteraction(); return; }
    // Retain the original Classic pointer anchor.
    const divisor = viewKey ? 1 : 2;
    const pt = { x: (e.clientX - bounds.left) / divisor, y: (e.clientY - bounds.top) / divisor };
    wheelPreview = { scale, pan: {
      x: pt.x - (pt.x - base.pan.x) / base.scale * scale,
      y: pt.y - (pt.y - base.pan.y) / base.scale * scale,
    } };
    applyWheelPreviewTransform(wheelPreview);
    window.clearTimeout(wheelPreviewTimer);
    wheelPreviewTimer = window.setTimeout(commitWheelPreviewZoom, SIM_WHEEL_IDLE_MS);
  }
  function pointerdown(e) {
    if (e.target.closest?.(".yarn-solver-feedback")) return;
    if (!viewKey) dispatch({ editingRepeat: -1 });
    if (e.button !== 0) return;
    e.preventDefault();
    finish();
    const start = { x: e.clientX, y: e.clientY }, pan = view().pan;
    beginTexturePreviewInteraction();
    simContainer.setPointerCapture?.(e.pointerId);
    function move(event) {
      if (event.buttons === 0) { end(); return; }
      update({ pan: { x: pan.x + event.clientX - start.x, y: pan.y + event.clientY - start.y } });
    }
    function end() {
      simContainer.removeEventListener("pointermove", move);
      for (const name of ["pointerup", "pointercancel", "pointerleave"]) simContainer.removeEventListener(name, end);
      if (!simContainer.hasPointerCapture || simContainer.hasPointerCapture(e.pointerId))
        simContainer.releasePointerCapture?.(e.pointerId);
      endPan = null;
      endTexturePreviewInteraction();
    }
    endPan = end;
    simContainer.addEventListener("pointermove", move);
    for (const name of ["pointerup", "pointercancel", "pointerleave"]) simContainer.addEventListener(name, end);
  }
  interactions.add(finish);
  simContainer.addEventListener("wheel", wheel, { passive: false });
  simContainer.addEventListener("pointerdown", pointerdown);
  return () => {
    finish(); interactions.delete(finish);
    simContainer.removeEventListener("wheel", wheel);
    simContainer.removeEventListener("pointerdown", pointerdown);
  };
}
