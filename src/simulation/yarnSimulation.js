import { ProcessModel } from "./ProcessModel";
import { Pattern } from "./Pattern";
import { YarnModel } from "./YarnModel";
import { prepareYarnTextureImages } from "./yarnTextureBrush";
import { normalizeYarnTexture } from "../yarnTexture/yarnScanTexture";
import { normalizeYarnSequence } from "../actions/yarnSequenceRows";
import { TEXTURE_PERFORMANCE_MODES } from "../constants";
import { DEFAULT_MACHINE_GAUGE } from "./yarnLengthMetrics";
import {
  buildYarnPathGeometry,
  X_PADDING,
  Y_PADDING,
} from "./yarnPathGeometry.js";
import { drawYarnSimulation } from "./drawYarnSimulation.js";

const YARN_RATIO = 0.24;
const dpi = devicePixelRatio;

function normalizeYarnPlies(yarnPlies, palette) {
  const fallbackColor = palette?.[0] || "rgba(190,190,190,1)";
  const source =
    Array.isArray(yarnPlies) && yarnPlies.length
      ? yarnPlies
      : [
          {
            color: fallbackColor,
            diameter: YARN_RATIO,
            enabled: true,
            texture: null,
          },
        ];

  const normalized = source
    .filter((ply) => ply?.enabled !== false)
    .map((ply) => ({
      color: ply.color || fallbackColor,
      diameter:
        Number.isFinite(Number(ply.diameter)) && Number(ply.diameter) > 0
          ? Number(ply.diameter)
          : YARN_RATIO,
      texture: normalizeYarnTexture(ply.texture),
    }));

  return normalized.length
    ? normalized
    : [
        {
          color: fallbackColor,
          diameter: YARN_RATIO,
          texture: null,
        },
      ];
}

function shouldRenderTextures({
  texturePerformanceMode = TEXTURE_PERFORMANCE_MODES.AUTO,
  texturePreviewInteractionActive = false,
} = {}) {
  if (texturePerformanceMode === TEXTURE_PERFORMANCE_MODES.SOLID) return false;
  if (texturePerformanceMode === TEXTURE_PERFORMANCE_MODES.AUTO) {
    return !texturePreviewInteractionActive;
  }
  return true;
}

function hasUvTextureMap(ply) {
  const texture = normalizeYarnTexture(ply.texture);
  if (!texture || texture.enabled === false) return false;

  return Boolean(
    texture.processedDataUrl ||
      texture.pbr?.baseColor?.processedDataUrl ||
      texture.pbr?.baseColor?.dataUrl
  );
}

function isNeutralYarnSequence(yarnSequence) {
  const pixels = Array.from(yarnSequence?.pixels || []);
  return !pixels.length || pixels.every((pixel) => Number(pixel) === 0);
}

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
  } = {}
) {
  let stopped = false;
  const normalizedYarnSequence = normalizeYarnSequence(yarnSequence);
  const activeYarnPlies = normalizeYarnPlies(yarnPlies, palette);
  const hasYarnSequenceMask = !isNeutralYarnSequence(normalizedYarnSequence);
  const primaryLengthScaleY = Math.min(
    1.1,
    Math.max(0.9, Number(yarnPlies?.[0]?.lengthScaleY) || 1)
  );
  const renderTextures = shouldRenderTextures({
    texturePerformanceMode,
    texturePreviewInteractionActive,
  });
  const renderUvTextures =
    renderTextures && activeYarnPlies.some((ply) => hasUvTextureMap(ply));

  performance.clearMeasures();
  performance.mark("start");

  const stitchPattern = new Pattern(pattern.pad(X_PADDING, Y_PADDING, 0));
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
  const processModel = new ProcessModel(stitchPattern);
  const yarnGraph = new YarnModel(processModel.cn);
  const geometry = buildYarnPathGeometry({
    pattern,
    stitchPattern,
    yarnGraph,
    canvasWidth,
    canvasHeight,
    primaryLengthScaleY,
    primaryYarnDiameter: activeYarnPlies[0].diameter,
    machineGauge,
  });

  function draw() {
    drawYarnSimulation({
      canvases: { backCanvas, midCanvas, frontCanvas },
      canvasWidth,
      canvasHeight,
      yarnPathLinks: geometry.yarnPathLinks,
      resolvedPathByLink: geometry.resolvedPathByLink,
      stitchWidth: geometry.stitchWidth,
      activeYarnPlies,
      normalizedYarnSequence,
      palette,
      hasYarnSequenceMask,
      renderTextures,
      renderUvTextures,
    });
  }

  function stopSim() {
    stopped = true;
  }

  draw();
  if (renderTextures) {
    prepareYarnTextureImages(activeYarnPlies).then(() => {
      if (!stopped) draw();
    });
  }

  return { stopSim, yarnLengthMetrics: geometry.yarnLengthMetrics };
}
