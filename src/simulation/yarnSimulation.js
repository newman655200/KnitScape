import { TEXTURE_PERFORMANCE_MODES } from "../constants";
import { DEFAULT_MACHINE_GAUGE } from "./yarnLengthMetrics.js";
import { createPbrPreviewRenderer } from "./pbrPreviewRenderer.js";
import { computeYarnSimulation } from "./computeYarnSimulation.js";
import { copySolverResults } from "./simulationSnapshot.js";
import { resolveYarnRenderItems } from "./yarnRenderItems.js";
import { selectOperationPaths } from "./operationPreview.js";

export { yarnMaterialGeometryKey } from "../domain/yarnMaterial.js";

// Compatibility callers repeatedly simulate the same canvas set. Keep one
// renderer owner per set so stopSim can suspend without dropping warm resources.
const previewRenderers = new WeakMap();

export function simulate(
  pattern,
  yarnSequence,
  palette,
  scale,
  yarnPlies,
  {
    machineGauge = DEFAULT_MACHINE_GAUGE,
    texturePerformanceMode = TEXTURE_PERFORMANCE_MODES.AUTO,
    texturePreviewInteractionActive = false,
    target = {},
    feeds = null,
    yarnLibrary = null,
    visibleYarnId = null,
    structureLineTrial = false,
    scope = feeds === null ? "pattern" : "machine",
    inputSignature = null,
    projectGeneration = 0,
    feedYarnStructureRevision = 0,
  } = {}
) {
  let stopped = false;
  const dpi = devicePixelRatio;

  performance.clearMeasures();
  performance.mark("start");

  const containerId = target.containerId || "sim-container";
  const canvasIDs = target.canvasIDs || ["back", "mid", "front"];
  const bbox = document.getElementById(containerId).getBoundingClientRect();
  const width = bbox.width * scale;
  const height = bbox.height * scale;
  const canvasWidth = dpi * width;
  const canvasHeight = dpi * height;

  function getCanvases(canvasIDs) {
    return canvasIDs.map((canvasID) => {
      const canvas = document.getElementById(canvasID);
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.cssText = `width: ${width}px; height: ${height}px;`;
      return canvas;
    });
  }

  const [backCanvas, midCanvas, frontCanvas] = getCanvases(canvasIDs);
  const snapshot = computeYarnSimulation({
    pattern, yarnSequence, palette, yarnPlies, canvasWidth, canvasHeight,
    machineGauge, feeds, yarnLibrary, scope, inputSignature,
    projectGeneration, feedYarnStructureRevision,
  });
  machineGauge = snapshot.machineGauge;
  const { yarnIds, yarnPathLinks, yarnStrands, stitchWidth, stitchPattern, feedYarnIds } = snapshot;
  let entry = previewRenderers.get(frontCanvas);
  if (!entry || entry.renderer.status.phase === "disposed" ||
    entry.backCanvas !== backCanvas || entry.midCanvas !== midCanvas) {
    entry?.renderer.dispose();
    entry = { renderer: createPbrPreviewRenderer().mount({ backCanvas, midCanvas, frontCanvas }),
      backCanvas, midCanvas, owner: null };
    previewRenderers.set(frontCanvas, entry);
  }
  const owner = {};
  entry.owner = owner;
  const normalizeVisibleYarnId = id => id !== null && id !== undefined && yarnIds.includes(String(id))
    ? String(id) : null;
  visibleYarnId = normalizeVisibleYarnId(visibleYarnId);
  // Inspection colors belong to actual Yarn IDs, even if Feed/Assignment slots change.
  const trialColors = import.meta.env.DEV ? new Map([...yarnIds].sort().map((id, index) =>
    [id, ["#36c7ff", "#ff9854", "#bfa0ff", "#a8e063"][index % 4]])) : null;
  let structureLineStyle = import.meta.env.DEV && structureLineTrial
    ? { colors: trialColors, lineWidth: dpi } : null;
  function draw() {
    if (entry.owner !== owner) return;
    const renderItems = resolveYarnRenderItems({ snapshot, yarnStrands, visibleYarnId });
    return entry.renderer.update({ snapshot, renderItems, yarnPathLinks, yarnStrands,
      canvasWidth, canvasHeight, stitchWidth, machineGauge, structureLineStyle,
      texturePerformanceMode, texturePreviewInteractionActive });
  }

  function stopSim() {
    stopped = true;
    if (entry.owner === owner) entry.renderer.suspend();
  }

  draw();

  return {
    stopSim,
    yarnIds,
    // Read the same adapted execution and resolved display paths used by draw().
    getOperationPreview(row, needle) {
      if (stopped || !Number.isInteger(row) || row < 0 || row >= pattern.height ||
        !Number.isInteger(needle) || needle < 0 || needle >= pattern.width) return null;
      const operations = Array.from({ length: pattern.width }, (_, column) =>
        stitchPattern.ops[column + snapshot.xPadding + row * stitchPattern.width]);
      return { row, needle, width: pattern.width, height: pattern.height,
        operation: operations[needle], operations, canvasWidth, canvasHeight,
        displayWidth: width, displayHeight: height, structureLineStyle,
        paths: selectOperationPaths({ links: yarnPathLinks, strands: yarnStrands,
          paddedWidth: stitchPattern.width, xPadding: snapshot.xPadding, row, needle, feedCount: feeds?.length || 1,
          feedYarnIds, visibleYarnId }) };
    },
    get visibleYarnId() { return visibleYarnId; },
    setStructureLineTrial(enabled) {
      if (import.meta.env.DEV && !stopped) {
        structureLineStyle = enabled ? { colors: trialColors, lineWidth: dpi } : null;
        draw();
      }
      return structureLineStyle !== null;
    },
    setVisibleYarnId(id) {
      if (!stopped) {
        visibleYarnId = normalizeVisibleYarnId(id);
        draw();
      }
      return visibleYarnId;
    },
    snapshot,
    yarnLengthMetrics: snapshot.yarnLengthMetrics,
    yarnLengthSolverResults: copySolverResults(snapshot),
    previewValidity: snapshot.previewValidity,
  };
}
