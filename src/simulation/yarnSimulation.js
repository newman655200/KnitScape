import { ProcessModel } from "./ProcessModel";
import { Pattern } from "./Pattern";
import { YarnModel } from "./YarnModel";
import {
  prepareYarnTextureImages,
  collectYarnTextureSources,
  resolveFeedYarnPlies,
  retainYarnAssetTextureImages,
} from "./yarnTextureBrush";
import { buildYarnUvPathOffsets } from "./yarnPathUvStrip.js";
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
import { solveFeedYarnLengths, ERROR } from "./yarnLengthSolver.js";
import { derivePreviewValidity } from "./previewValidity.js";

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

  return collectYarnTextureSources(texture).length > 0;
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
    yarnLibrary = null,
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
  const geometry = buildYarnPathGeometry({
    ...geometryOptions,
    yarnGraph: new YarnModel(new ProcessModel(stitchPattern).cn),
  });
  const solverLengths = (Array.isArray(feeds) ? feeds : []).map((feed) =>
    (Array.isArray(feed?.yarns) ? feed.yarns : []).map((yarn) => {
      const length = yarn?.yarnLengthCmPer100Needles;
      return (typeof length === "number" || typeof length === "string") &&
        Number.isFinite(Number(length)) && Number(length) > 0
        ? Number(length)
        : null;
    })
  );
  const usedFeedIndices = new Set(geometry.yarnPathLinks.map(link =>
    courseToFeedIndex(link.row, feeds?.length || 1)));
  const requiredTargets = solverLengths.flatMap((lengths, feedIndex) =>
    usedFeedIndices.has(feedIndex) ? lengths.flatMap((length, yarnIndex) =>
      length === null ? [] : [{ feedIndex, yarnIndex, targetLengthCmPer100Needles: length }]
    ) : []
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
  const solverGeometryByHeight = new Map();
  let evaluateModelLength = null;
  (Array.isArray(feeds) ? feeds : []).forEach((feed, feedIndex) => {
    if (cacheHit) return;
    const yarns = Array.isArray(feed?.yarns) ? feed.yarns : [];
    const yarnIndices = solverLengths[feedIndex].flatMap((length, index) =>
      length !== null ? [index] : []
    );
    const belongsToFeed = (course) =>
      courseToFeedIndex(course, feeds.length) === feedIndex;
    if (!yarnIndices.length || !usedFeedIndices.has(feedIndex)) {
      return;
    }
    const feedLinks = geometry.yarnPathLinks.filter((link) => belongsToFeed(link.row));
    // Equal targets on the same course topology share computation, not slot state.
    const uniqueTargets = new Map();
    yarnIndices.forEach(index => {
      const length = solverLengths[feedIndex][index];
      if (!uniqueTargets.has(length)) uniqueTargets.set(length, index);
    });
    const uniqueIndices = [...uniqueTargets.values()];
    try {
      const results = solveFeedYarnLengths({
        feeds: [{ yarns: uniqueIndices.map((index) => yarns[index]) }],
        gauge: machineGauge,
        buildGeometry: (loopHeight) => {
          if (!solverGeometryByHeight.has(loopHeight)) {
            evaluateModelLength ??= geometry.createModelLengthEvaluator();
            solverGeometryByHeight.set(loopHeight, evaluateModelLength(loopHeight));
          }
          const candidate = solverGeometryByHeight.get(loopHeight);
          // A view of this Feed's courses; keep original rows and link indices.
          return {
            yarnPathLinks: feedLinks,
            get modelPathByLink() { return candidate.modelPathByLink; },
            measuredModelLengthPer100NeedlesByCourse: new Map(
              [...candidate.measuredModelLengthPer100NeedlesByCourse].filter(
                ([course]) => belongsToFeed(course)
              )
            ),
          };
        },
      });
      const resultsByLength = new Map(results.map(result =>
        [solverLengths[feedIndex][uniqueIndices[result.yarnIndex]], result]));
      yarnIndices.forEach(yarnIndex => {
        const result = structuredClone(resultsByLength.get(solverLengths[feedIndex][yarnIndex]));
        result.feedIndex = feedIndex;
        result.yarnIndex = yarnIndex;
        yarnLengthSolverResults.push(result);
      });
    } catch (error) {
      // Solver failures keep base paths and expose diagnostics for every slot.
      yarnIndices.forEach(yarnIndex => yarnLengthSolverResults.push({
        feedIndex, yarnIndex,
        targetLengthCmPer100Needles: solverLengths[feedIndex][yarnIndex],
        solvedLengthCmPer100Needles: null,
        errorCmPer100Needles: null,
        status: ERROR,
        failureReason: ERROR,
        converged: false,
        reachableRange: null,
        solvedPathByLink: new Map(),
        errorMessage: error instanceof Error ? error.message : String(error),
      }));
    }
  });
  solverGeometryByHeight.clear();
  if (solverInputKey !== null && !cacheHit) {
    solverResultCache = {
      key: solverInputKey,
      results: structuredClone(yarnLengthSolverResults),
    };
  }
  // Re-evaluate application on every preview, including a Solver cache hit.
  yarnLengthSolverResults.forEach(result => { result.appliedToSimulation = false; });
  const feedYarnPlies = feeds === null ? new Map()
    : resolveFeedYarnPlies(feeds, yarnLibrary, activeYarnPlies[0], usedFeedIndices);
  const textureMaterials = [...new Set([
    ...activeYarnPlies.slice(1),
    ...(feedYarnPlies.size ? [...feedYarnPlies.values()].flat() : [activeYarnPlies[0]]),
  ])];
  if (yarnLibrary !== null) retainYarnAssetTextureImages([...textureMaterials, ...activeYarnPlies]);
  const renderUvTextures = renderTextures && textureMaterials.some(hasUvTextureMap);
  const strandCount = Math.max(1, ...[...feedYarnPlies.values()].map(plies => plies.length));
  const yarnStrands = Array.from({ length: strandCount }, (_, yarnIndex) => {
    const solvedModelPaths = new Map();
    yarnLengthSolverResults.forEach(result => {
      if (result.yarnIndex !== yarnIndex || !result.converged) return;
      result.solvedPathByLink.forEach((path, index) => solvedModelPaths.set(index, path));
    });
    const resolvedPathByLink = geometry.resolveModelPathsForDisplay(solvedModelPaths);
    const modelPathByLink = new Map(geometry.modelPathByLink);
    // A failed Yarn keeps its own base paths; other slots retain their solves.
    if (resolvedPathByLink !== geometry.resolvedPathByLink) {
      solvedModelPaths.forEach((path, index) => modelPathByLink.set(index, path));
      yarnLengthSolverResults.forEach(result => {
        if (result.yarnIndex === yarnIndex && result.converged && result.solvedPathByLink.size) {
          result.appliedToSimulation = true;
        }
      });
    }
    const strandLinks = feedYarnPlies.size ? geometry.yarnPathLinks.filter(link =>
      yarnIndex < (feedYarnPlies.get(courseToFeedIndex(link.row, feeds.length))?.length || 1)
    ) : geometry.yarnPathLinks;
    return { modelPathByLink, resolvedPathByLink,
      uvOffsets: renderUvTextures || strandCount > 1
        ? buildYarnUvPathOffsets(strandLinks, modelPathByLink) : null };
  });
  const uvStripCache = new Map();
  yarnLengthSolverResults.forEach(result => {
    if (result.converged && !result.appliedToSimulation) result.failureReason = "PATH_NOT_APPLIED";
  });

  function draw() {
    drawYarnSimulation({
      canvases: { backCanvas, midCanvas, frontCanvas },
      canvasWidth,
      canvasHeight,
      yarnPathLinks: geometry.yarnPathLinks,
      yarnStrands,
      uvStripCache,
      feedYarnPlies,
      feedCount: feeds?.length || 0,
      machineGauge,
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
    prepareYarnTextureImages(textureMaterials).then(() => {
      if (!stopped) draw();
    });
  }

  return {
    stopSim,
    yarnLengthMetrics: geometry.yarnLengthMetrics,
    yarnLengthSolverResults,
    previewValidity: derivePreviewValidity(requiredTargets, yarnLengthSolverResults),
  };
}
