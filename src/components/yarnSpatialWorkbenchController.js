import { buildYarnSpatialExperiment, DEFAULT_SPATIAL_PARAMETERS, SPATIAL_EXPERIMENT_RULE_VERSION } from "../simulation/yarnSpatialExperiment.js";
import { createYarnSpatialPreviewRenderer } from "../simulation/yarnSpatialPreviewRenderer.js";
import { createSimulationSnapshot } from "../simulation/simulationSnapshot.js";

const DEFAULT_MATERIAL = { color: [.55, .17, .09], roughness: .42, anisotropy: .55,
  ambient: .22, lightIntensity: 3, lightDirection: [.4, .7, 1], mode: "solid" };

export function createYarnSpatialWorkbenchController({ context, session = null, onChange = () => {},
  createRenderer = createYarnSpatialPreviewRenderer, buildExperiment = buildYarnSpatialExperiment }) {
  let source = { projectGeneration: context.projectGeneration, feedYarnStructureRevision: context.feedYarnStructureRevision };
  let parameters = createSimulationSnapshot({ ...DEFAULT_SPATIAL_PARAMETERS, ...session?.parameters });
  let material = createSimulationSnapshot({ ...DEFAULT_MATERIAL, ...session?.material }), view = session?.view ?? null;
  let derivedGeometry = null, renderer = null, disposed = false, materialError = null, geometryApplyError = null;
  let rendererStatus = Object.freeze({ status: "UNMOUNTED", diagnostic: null });
  const notify = () => { if (!disposed) onChange(); };
  const failed = error => { rendererStatus = Object.freeze({ status: "ERROR", diagnostic: String(error.message || error) }); notify(); };
  function send(operation) {
    if (!renderer || disposed) return;
    let result;
    try { result = operation(); rendererStatus = renderer.status ?? rendererStatus; }
    catch (error) { failed(error); result = rendererStatus; }
    notify();
    return result;
  }
  function applyMaterial() {
    const result = send(() => renderer.update({ material }));
    materialError = result?.status === "INVALID" ? result.diagnostic : null;
    notify();
  }
  function rebuild(fit = false) {
    try { derivedGeometry = buildExperiment(parameters, source); }
    catch (error) {
      derivedGeometry = createSimulationSnapshot({ ...source, inputSource: "TEST_ONLY", ruleVersion: SPATIAL_EXPERIMENT_RULE_VERSION,
        units: { length: "mm" }, status: "ERROR", geometryType: parameters.section === "ellipse" ? "Elliptical Tube" : "Tube",
        inputSignature: JSON.stringify(parameters), selfContactStatus: "NOT_EVALUATED", physicsStatus: "NOT_IMPLEMENTED",
        diagnostics: [{ code: "EXPERIMENT_BUILD_FAILED", message: String(error.message || error) }] });
    }
    // Geometry must apply even when an unrelated material input is invalid;
    // the renderer rejects combined updates atomically.
    const result = send(() => renderer.update({ geometry: derivedGeometry.status === "OK" ? derivedGeometry.mesh : null,
      ...(view ? { view } : {}), fit }));
    if (result?.status === "INVALID" || result?.status === "ERROR") {
      geometryApplyError = createSimulationSnapshot(result);
      // Invalid updates retain the old renderer scene atomically. Clear it in a
      // separate update so rejected view/material inputs cannot prevent clearing.
      send(() => renderer.update({ geometry: null }));
    } else if (result && derivedGeometry.status === "OK") geometryApplyError = null;
    applyMaterial();
    notify();
  }
  const api = {
    get model() { return Object.freeze({ parameters, material, view, derivedGeometry, rendererStatus, materialError, geometryApplyError }); },
    mount(container) {
      if (disposed || renderer) return;
      try {
        renderer = createRenderer({ onViewChange(next) { view = createSimulationSnapshot(next); notify(); },
          onStatusChange(next) { rendererStatus = createSimulationSnapshot(next); notify(); } });
        renderer.mount(container);
      } catch (error) { renderer?.dispose(); renderer = null; failed(error); }
      rebuild(!view);
    },
    setParameters(patch) {
      if (disposed) return;
      parameters = createSimulationSnapshot({ ...parameters, ...patch }); rebuild(true);
    },
    setMaterial(patch) {
      if (disposed) return;
      material = createSimulationSnapshot({ ...material, ...patch }); applyMaterial();
    },
    setView(patch) { send(() => renderer.setView(patch)); },
    fit() { send(() => renderer.fit()); },
    closeup() {
      if (geometryApplyError || derivedGeometry?.status !== "OK" || derivedGeometry.centerline.closed) return;
      const tangent = derivedGeometry.centerline.tangents.at(-1), target = derivedGeometry.centerline.points.at(-1);
      api.setView({ target, yaw: Math.atan2(tangent[0], tangent[2]), pitch: Math.asin(tangent[1]),
        distance: 5 * Math.max(parameters.radiusA, parameters.section === "circle" ? parameters.radiusA : parameters.radiusB) });
    },
    updateContext(next) {
      if (disposed || next.projectGeneration === source.projectGeneration && next.feedYarnStructureRevision === source.feedYarnStructureRevision) return;
      source = { projectGeneration: next.projectGeneration, feedYarnStructureRevision: next.feedYarnStructureRevision };
      if (derivedGeometry) derivedGeometry = Object.freeze({ ...derivedGeometry, ...source });
      notify();
    },
    exportSession() { return createSimulationSnapshot({ parameters, material, view }); },
    dispose() { if (disposed) return; disposed = true; renderer?.dispose(); renderer = null; },
  };
  return api;
}
