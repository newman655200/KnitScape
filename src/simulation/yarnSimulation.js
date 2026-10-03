import { ProcessModel } from "./ProcessModel";
import { Pattern } from "./Pattern";
import { YarnModel } from "./YarnModel";
import { prepareYarnTextureImages } from "./yarnTextureBrush";
import { normalizeYarnTexture } from "../yarnTexture/yarnScanTexture";
import { normalizeYarnSequence } from "../actions/yarnSequenceRows";
import { TEXTURE_PERFORMANCE_MODES } from "../constants";
import {
  courseToFeedIndex,
  DEFAULT_MACHINE_GAUGE,
  normalizeMachineGauge,
} from "./yarnLengthMetrics";
import {
  buildYarnPathGeometry,
  X_PADDING,
  Y_PADDING,
} from "./yarnPathGeometry.js";
import { drawYarnSimulation } from "./drawYarnSimulation.js";
import { solveFeedYarnLengths } from "./yarnLengthSolver.js";

const YARN_RATIO = 0.24;
const dpi = devicePixelRatio;
let solverResultCache = null;

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
    feeds = null,
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
  const geometryOptions = {
    pattern,
    stitchPattern,
    canvasWidth,
    canvasHeight,
    primaryLengthScaleY,
    primaryYarnDiameter: activeYarnPlies[0].diameter,
    machineGauge,
  };
  const buildGeometry = (modelLoopHeight = null) =>
    buildYarnPathGeometry({
      ...geometryOptions,
      yarnGraph: new YarnModel(new ProcessModel(stitchPattern).cn),
      modelLoopHeight,
      includeSummaryMetrics: modelLoopHeight === null,
      includeDisplayPaths: modelLoopHeight === null,
    });
  const geometry = buildGeometry();
  const solverLengths = (Array.isArray(feeds) ? feeds : []).map((feed) =>
    (Array.isArray(feed?.yarns) ? feed.yarns : []).map((yarn) => {
      const length = yarn?.yarnLengthCmPer100Needles;
      return (typeof length === "number" || typeof length === "string") &&
        Number.isFinite(Number(length)) && Number(length) > 0
        ? Number(length)
        : null;
    })
  );
  // One bounded entry; display size, zoom, color and textures do not affect solving.
  const solverInputKey = solverLengths.some((lengths) =>
    lengths.some((length) => length !== null)
  )
    ? JSON.stringify({
        width: pattern.width,
        height: pattern.height,
        pixels: Array.from(pattern.pixels),
        gauge: normalizeMachineGauge(machineGauge),
        primaryLengthScaleY,
        primaryYarnDiameter: activeYarnPlies[0].diameter,
        solverLengths,
      })
    : null;
  const cacheHit =
    solverInputKey !== null && solverResultCache?.key === solverInputKey;
  const yarnLengthSolverResults = cacheHit
    ? structuredClone(solverResultCache.results)
    : [];
  const solvedModelPaths = new Map();
  const solverGeometryByHeight = new Map();
  (Array.isArray(feeds) ? feeds : []).forEach((feed, feedIndex) => {
    if (cacheHit) return;
    const yarns = Array.isArray(feed?.yarns) ? feed.yarns : [];
    const yarnIndices = solverLengths[feedIndex].flatMap((length, index) =>
      length !== null ? [index] : []
    );
    const belongsToFeed = (course) =>
      courseToFeedIndex(course, feeds.length) === feedIndex;
    if (
      !yarnIndices.length ||
      ![...geometry.measuredNeedleCountByCourse.keys()].some(belongsToFeed)
    ) {
      return;
    }
    try {
      const results = solveFeedYarnLengths({
        feeds: [{ yarns: yarnIndices.map((index) => yarns[index]) }],
        gauge: machineGauge,
        buildGeometry: (loopHeight) => {
          if (!solverGeometryByHeight.has(loopHeight)) {
            solverGeometryByHeight.set(loopHeight, buildGeometry(loopHeight));
          }
          const candidate = solverGeometryByHeight.get(loopHeight);
          // A view of this Feed's courses; keep original rows and link indices.
          return {
            ...candidate,
            yarnPathLinks: candidate.yarnPathLinks.filter((link) =>
              belongsToFeed(link.row)
            ),
            measuredModelLengthPer100NeedlesByCourse: new Map(
              [...candidate.measuredModelLengthPer100NeedlesByCourse].filter(
                ([course]) => belongsToFeed(course)
              )
            ),
          };
        },
      });
      results.forEach((result) => {
        result.feedIndex = feedIndex;
        result.yarnIndex = yarnIndices[result.yarnIndex];
        yarnLengthSolverResults.push(result);
      });
    } catch (error) {
      // Unsupported/non-monotonic courses keep the original preview geometry.
      if (!(error instanceof RangeError)) throw error;
    }
  });
  solverGeometryByHeight.clear();
  if (solverInputKey !== null && !cacheHit) {
    solverResultCache = {
      key: solverInputKey,
      results: structuredClone(yarnLengthSolverResults),
    };
  }
  yarnLengthSolverResults.forEach((result) => {
    // V1 renders only the first Feed Yarn; keep other independent results.
    if (result.yarnIndex !== 0 || !result.converged) return;
    result.solvedPathByLink.forEach((pathData, linkIndex) => {
      solvedModelPaths.set(linkIndex, pathData);
    });
  });
  const resolvedPathByLink = geometry.resolveModelPathsForDisplay(solvedModelPaths);

  function draw() {
    drawYarnSimulation({
      canvases: { backCanvas, midCanvas, frontCanvas },
      canvasWidth,
      canvasHeight,
      yarnPathLinks: geometry.yarnPathLinks,
      resolvedPathByLink,
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

  return {
    stopSim,
    yarnLengthMetrics: geometry.yarnLengthMetrics,
    yarnLengthSolverResults,
  };
}
