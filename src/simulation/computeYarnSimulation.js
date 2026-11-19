import { ProcessModel } from "./ProcessModel.js";
import { Pattern } from "./Pattern.js";
import { YarnModel } from "./YarnModel.js";
import { normalizeYarnSequence } from "../actions/yarnSequenceRows.js";
import { normalizeYarnPlies, resolveFeedYarnPlies } from "../domain/yarnMaterial.js";
import { courseToFeedIndex, DEFAULT_MACHINE_GAUGE, normalizeMachineGauge } from "./yarnLengthMetrics.js";
import { buildYarnPathGeometry, X_PADDING, Y_PADDING } from "./yarnPathGeometry.js";
import { solveFeedYarnLengths, ERROR } from "./yarnLengthSolver.js";
import { derivePreviewValidity } from "./previewValidity.js";
import { resolveYarnLengthInput } from "../domain/yarnLengthInput.js";
import { createSimulationSnapshot } from "./simulationSnapshot.js";

let solverResultCache = null;

// Numerical reference coordinates are explicit. This module never reads a
// viewport, renders, loads images, or interprets Machine Domain instructions.
export function computeYarnSimulation({
  pattern, yarnSequence, palette, yarnPlies, canvasWidth, canvasHeight,
  machineGauge = DEFAULT_MACHINE_GAUGE, feeds = null, yarnLibrary = null,
  scope = feeds === null ? "pattern" : "machine", inputSignature = null,
  projectGeneration = 0, feedYarnStructureRevision = 0,
}) {
  if (scope !== "pattern" && scope !== "machine") throw new TypeError("scope must be pattern or machine.");
  for (const [name, value] of Object.entries({ canvasWidth, canvasHeight })) {
    if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be an explicit non-negative number.`);
  }
  machineGauge = normalizeMachineGauge(machineGauge);
  const normalizedYarnSequence = normalizeYarnSequence(yarnSequence);
  const activeYarnPlies = normalizeYarnPlies(yarnPlies, palette);
  const pixels = Array.from(normalizedYarnSequence.pixels);
  const hasYarnSequenceMask = pixels.length > 0 && !pixels.every(pixel => Number(pixel) === 0);
  const primaryLengthScaleY = Math.min(
    1.1,
    Math.max(0.9, Number(yarnPlies?.[0]?.lengthScaleY) || 1)
  );
  const stitchPattern = new Pattern(pattern.pad(X_PADDING, Y_PADDING, 0));
  const allFeedYarnPlies = feeds === null ? new Map()
    : resolveFeedYarnPlies(feeds, yarnLibrary, activeYarnPlies[0]);
  const strandCount = Math.max(1, ...[...allFeedYarnPlies.values()].map(plies => plies.length));
  const diameterProfiles = Array.from({ length: strandCount }, (_, yarnIndex) =>
    Array.from(allFeedYarnPlies.values(), plies => (plies[yarnIndex] ?? plies[0]).diameter));
  const geometryOptions = {
    pattern,
    stitchPattern,
    canvasWidth,
    canvasHeight,
    primaryLengthScaleY,
    primaryYarnDiameter: diameterProfiles[0][0] ?? activeYarnPlies[0].diameter,
    machineGauge,
  };
  const geometryByProfile = new Map();
  let topologyGraph;
  const strandGeometries = diameterProfiles.map(profile => {
    const key = JSON.stringify(profile);
    if (!geometryByProfile.has(key)) {
      const yarnGraph = new YarnModel(new ProcessModel(stitchPattern).cn);
      topologyGraph ??= yarnGraph;
      geometryByProfile.set(key, buildYarnPathGeometry({
        ...geometryOptions,
        yarnDiameterForCourse: profile.length ? row => profile[courseToFeedIndex(row, profile.length)] : null,
        yarnGraph,
      }));
    }
    return geometryByProfile.get(key);
  });
  const geometry = strandGeometries[0];
  const lengthInputs = (Array.isArray(feeds) ? feeds : []).map(feed =>
    (Array.isArray(feed?.yarns) ? feed.yarns : []).map(resolveYarnLengthInput)
  );
  const solverLengths = lengthInputs.map(inputs => inputs.map(input => input.effectiveTargetLengthCmPer100Needles));
  const usedFeedIndices = new Set(geometry.yarnPathLinks.map(link =>
    courseToFeedIndex(link.row, feeds?.length || 1)));
  const hasEffectiveTargets = solverLengths.some((lengths, feedIndex) =>
    usedFeedIndices.has(feedIndex) && lengths.some(length => length !== null));
  // Incomplete slots keep mixed previews PARTIAL, but cannot create a solve requirement alone.
  const requiredTargets = hasEffectiveTargets ? solverLengths.flatMap((lengths, feedIndex) =>
    usedFeedIndices.has(feedIndex) ? lengths.flatMap((length, yarnIndex) =>
      length === null && lengthInputs[feedIndex][yarnIndex].lengthInputMode !== "relaxedWithDraft"
        ? [] : [{ feedIndex, yarnIndex, targetLengthCmPer100Needles: length }]
    ) : []
  ) : [];
  // One bounded entry; display size, zoom, color and textures do not affect solving.
  const solverInputKey = solverLengths.some((lengths) =>
    lengths.some((length) => length !== null)
  )
    ? JSON.stringify({
        width: pattern.width,
        height: pattern.height,
        pixels: Array.from(pattern.pixels),
        gauge: machineGauge,
        primaryLengthScaleY,
        primaryYarnDiameter: geometryOptions.primaryYarnDiameter,
        diameterProfiles,
        solverLengths,
        lengthInputs,
      })
    : null;
  const cacheHit =
    solverInputKey !== null && solverResultCache?.key === solverInputKey;
  const yarnLengthSolverResults = cacheHit
    ? structuredClone(solverResultCache.results)
    : [];
  const solverGeometryByHeight = new Map();
  const evaluators = new Map();
  (Array.isArray(feeds) ? feeds : []).forEach((feed, feedIndex) => {
    if (cacheHit) return;
    const yarnIndices = solverLengths[feedIndex].flatMap((length, index) =>
      length !== null ? [index] : []
    );
    const belongsToFeed = (course) =>
      courseToFeedIndex(course, feeds.length) === feedIndex;
    if (!yarnIndices.length || !usedFeedIndices.has(feedIndex)) {
      return;
    }
    const feedLinks = geometry.yarnPathLinks.filter((link) => belongsToFeed(link.row));
    // Equal targets share computation only with the same diameter profile.
    const uniqueTargets = new Map();
    const targetKey = index => JSON.stringify([solverLengths[feedIndex][index], diameterProfiles[index]]);
    yarnIndices.forEach(index => {
      const key = targetKey(index);
      if (!uniqueTargets.has(key)) uniqueTargets.set(key, index);
    });
    const uniqueIndices = [...uniqueTargets.values()];
    try {
      const groups = new Map();
      uniqueIndices.forEach(index => {
        const key = JSON.stringify(diameterProfiles[index]);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(index);
      });
      const resultsByLength = new Map();
      for (const indices of groups.values()) {
        const index = indices[0];
        const results = solveFeedYarnLengths({
          feeds: [{ yarns: indices.map(index => ({
            yarnLengthCmPer100Needles: solverLengths[feedIndex][index],
          })) }],
          gauge: machineGauge,
          buildGeometry: (loopHeight) => {
            const strandGeometry = strandGeometries[index];
            const key = JSON.stringify([diameterProfiles[index], loopHeight]);
            if (!solverGeometryByHeight.has(key)) {
              if (!evaluators.has(strandGeometry)) evaluators.set(strandGeometry, strandGeometry.createModelLengthEvaluator());
              solverGeometryByHeight.set(key, evaluators.get(strandGeometry)(loopHeight));
            }
            const candidate = solverGeometryByHeight.get(key);
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
        results.forEach((result, resultIndex) => resultsByLength.set(targetKey(indices[resultIndex]), result));
      }
      yarnIndices.forEach(yarnIndex => {
        const result = structuredClone(resultsByLength.get(targetKey(yarnIndex)));
        result.feedIndex = feedIndex;
        result.yarnIndex = yarnIndex;
        result.lengthInput = lengthInputs[feedIndex][yarnIndex];
        yarnLengthSolverResults.push(result);
      });
    } catch (error) {
      // Solver failures keep base paths and expose diagnostics for every slot.
      yarnIndices.forEach(yarnIndex => yarnLengthSolverResults.push({
        feedIndex, yarnIndex,
        lengthInput: lengthInputs[feedIndex][yarnIndex],
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
  const yarnStrands = Array.from({ length: strandCount }, (_, yarnIndex) => {
    const strandGeometry = strandGeometries[yarnIndex];
    const solvedModelPaths = new Map();
    yarnLengthSolverResults.forEach(result => {
      if (result.yarnIndex !== yarnIndex || !result.converged) return;
      result.solvedPathByLink.forEach((path, index) => solvedModelPaths.set(index, path));
    });
    const resolvedPathByLink = strandGeometry.resolveModelPathsForDisplay(solvedModelPaths);
    const modelPathByLink = new Map(strandGeometry.modelPathByLink);
    // A failed Yarn keeps its own base paths; other slots retain their solves.
    if (resolvedPathByLink !== strandGeometry.resolvedPathByLink) {
      solvedModelPaths.forEach((path, index) => modelPathByLink.set(index, path));
      yarnLengthSolverResults.forEach(result => {
        if (result.yarnIndex === yarnIndex && result.converged && result.solvedPathByLink.size) {
          result.appliedToSimulation = true;
        }
      });
    }
    return {
      yarnIndex,
      baseModelPathByLink: strandGeometry.modelPathByLink,
      baseDisplayPathByLink: strandGeometry.resolvedPathByLink,
      modelPathByLink,
      resolvedPathByLink,
    };
  });
  const feedYarnIds = new Map([...feedYarnPlies.keys()].map(feedIndex => [feedIndex,
    (feeds[feedIndex]?.yarns || []).map(yarn => yarn?.yarnId === null ||
      yarn?.yarnId === undefined || yarn.yarnId === "" ? null : String(yarn.yarnId)),
  ]));
  const drawnYarnIds = new Set();
  geometry.yarnPathLinks.forEach(link => {
    feedYarnIds.get(courseToFeedIndex(link.row, feeds?.length || 1))?.forEach((id, slot) => {
      if (id !== null && yarnStrands[slot]?.resolvedPathByLink.get(link.index)) drawnYarnIds.add(id);
    });
  });
  const yarnIds = [...drawnYarnIds];
  yarnLengthSolverResults.forEach(result => {
    if (result.converged && !result.appliedToSimulation) result.failureReason = "PATH_NOT_APPLIED";
  });
  // A contact can be visited repeatedly. Occurrence identity follows path order,
  // independently of the final contact index after tuck/miss displacement.
  const occurrences = topologyGraph.yarnPath.map(([i, j, row, cnType], index) => ({
    id: `occurrence:${index}`, index, cnIndex: j * topologyGraph.width + i,
    i, j, row, cnType,
  }));
  const yarnPathLinks = geometry.yarnPathLinks.map((link, index) => ({
    ...link,
    sourceOccurrenceId: occurrences[index].id,
    targetOccurrenceId: occurrences[index + 1].id,
  }));
  const assignments = [...feedYarnIds].flatMap(([feedIndex, ids]) => ids.map((yarnId, yarnIndex) => ({
    id: `feed:${feedIndex}:yarn:${yarnIndex}`, feedIndex, yarnIndex, yarnId,
  })));
  return createSimulationSnapshot({
    scope, inputSignature, projectGeneration, feedYarnStructureRevision,
    referenceViewport: { canvasWidth, canvasHeight }, canvasWidth, canvasHeight,
    machineGauge, primaryLengthScaleY,
    primaryYarnDiameter: geometryOptions.primaryYarnDiameter,
    stitchWidth: geometry.stitchWidth,
    pattern: { width: pattern.width, height: pattern.height, pixels: Array.from(pattern.pixels) },
    stitchPattern: { width: stitchPattern.width, height: stitchPattern.height, ops: stitchPattern.ops },
    topologyWidth: topologyGraph.width, topologyHeight: topologyGraph.height,
    xPadding: X_PADDING, yPadding: Y_PADDING,
    contacts: topologyGraph.contactNodes,
    occurrences, yarnPathLinks, assignments, yarnStrands,
    feeds, feedCount: feeds?.length || 0, yarnLibrary, yarnIds, feedYarnIds,
    activeYarnPlies, feedYarnPlies, palette, normalizedYarnSequence: {
      width: normalizedYarnSequence.width, height: normalizedYarnSequence.height, pixels,
    }, hasYarnSequenceMask,
    diameterProfiles,
    originalSolverResults: yarnLengthSolverResults,
    previewValidity: derivePreviewValidity(requiredTargets, yarnLengthSolverResults),
    yarnLengthMetrics: geometry.yarnLengthMetrics,
  });
}
