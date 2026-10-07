import {
  courseToFeedIndex,
  modelLengthToMm,
  targetModelLengthPer100Needles,
} from "./yarnLengthMetrics.js";

export const CONVERGED = "CONVERGED";
export const UNREACHABLE_TARGET = "UNREACHABLE_TARGET";
export const MAX_ITERATIONS = "MAX_ITERATIONS";
export const NOT_SET = "NOT_SET";
export const ERROR = "ERROR";
export const DEFAULT_SOLVER_TOLERANCE = 0.01;

function measuredLengthForFeed(geometry, feedIndex, feedCount) {
  const lengths = [
    ...geometry.measuredModelLengthPer100NeedlesByCourse.entries(),
  ]
    .filter(
      ([course]) => courseToFeedIndex(course, feedCount) === feedIndex
    )
    .map(([, length]) => length);
  if (!lengths.length) {
    throw new RangeError(`Feed ${feedIndex} has no measured Model Path.`);
  }
  return lengths.reduce((total, length) => total + length, 0) / lengths.length;
}

function pathMapForFeed(geometry, feedIndex, feedCount) {
  return new Map(
    geometry.yarnPathLinks
      .filter(
        (link) => courseToFeedIndex(link.row, feedCount) === feedIndex
      )
      .map((link) => [link.index, geometry.modelPathByLink.get(link.index)])
      .filter(([, pathData]) => pathData !== undefined)
  );
}

function validateInputs({
  feeds,
  buildGeometry,
  minLoopHeight,
  maxLoopHeight,
  tolerance,
  maxIterations,
  monotonicSamples,
}) {
  if (!Array.isArray(feeds) || feeds.length === 0) {
    throw new RangeError("feeds must contain at least one Feed.");
  }
  if (feeds.some((feed) => !Array.isArray(feed?.yarns))) {
    throw new TypeError("Each Feed must contain a yarns array.");
  }
  if (typeof buildGeometry !== "function") {
    throw new TypeError("buildGeometry must be a function.");
  }
  if (!(minLoopHeight > 0) || !(maxLoopHeight > minLoopHeight)) {
    throw new RangeError("loopHeight bounds must be positive and increasing.");
  }
  if (!(tolerance > 0)) {
    throw new RangeError("tolerance must be positive.");
  }
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new RangeError("maxIterations must be a positive integer.");
  }
  if (!Number.isInteger(monotonicSamples) || monotonicSamples < 2) {
    throw new RangeError("monotonicSamples must be an integer of at least 2.");
  }
}

function resultFromCandidate({
  candidate,
  feedIndex,
  yarnIndex,
  target,
  targetLengthCmPer100Needles,
  gauge,
  status,
  reachableRange,
  tolerance,
  feedCount,
}) {
  const error = Math.abs(candidate.measured - target);
  return {
    feedIndex,
    yarnIndex,
    targetLengthCmPer100Needles,
    solvedLengthCmPer100Needles: modelLengthToMm(candidate.measured, gauge) / 10,
    errorCmPer100Needles: modelLengthToMm(error, gauge) / 10,
    toleranceCmPer100Needles: modelLengthToMm(tolerance, gauge) / 10,
    targetModelLengthPer100Needles: target,
    solvedModelLengthPer100Needles: candidate.measured,
    solvedLoopHeight: candidate.loopHeight,
    error,
    converged: status === CONVERGED && error <= tolerance,
    status,
    failureReason: status === CONVERGED ? null : status,
    reachableRange,
    solvedPathByLink: pathMapForFeed(
      candidate.geometry,
      feedIndex,
      feedCount
    ),
  };
}

export function solveFeedYarnLengths({
  feeds,
  gauge,
  buildGeometry,
  minLoopHeight = 0.05,
  maxLoopHeight = 2,
  tolerance = DEFAULT_SOLVER_TOLERANCE,
  maxIterations = 48,
  monotonicSamples = 8,
}) {
  validateInputs({
    feeds,
    buildGeometry,
    minLoopHeight,
    maxLoopHeight,
    tolerance,
    maxIterations,
    monotonicSamples,
  });

  const feedCount = feeds.length;
  const geometryCache = new Map();
  const geometryAt = (loopHeight) => {
    if (!geometryCache.has(loopHeight)) {
      geometryCache.set(loopHeight, buildGeometry(loopHeight));
    }
    return geometryCache.get(loopHeight);
  };
  const candidateAt = (loopHeight, feedIndex) => {
    const geometry = geometryAt(loopHeight);
    return {
      loopHeight,
      measured: measuredLengthForFeed(geometry, feedIndex, feedCount),
      geometry,
    };
  };
  const sampleHeights = Array.from(
    { length: monotonicSamples + 1 },
    (_, index) =>
      minLoopHeight +
      ((maxLoopHeight - minLoopHeight) * index) / monotonicSamples
  );
  const results = [];

  feeds.forEach((feed, feedIndex) => {
    const samples = sampleHeights.map((loopHeight) =>
      candidateAt(loopHeight, feedIndex)
    );
    for (let index = 1; index < samples.length; index += 1) {
      if (samples[index].measured + 1e-9 < samples[index - 1].measured) {
        throw new RangeError(
          `Feed ${feedIndex} Model Path length is not monotonic in loopHeight.`
        );
      }
    }

    const lower = samples[0];
    const upper = samples.at(-1);
    const reachableRange = {
      minLoopHeight: lower.loopHeight,
      maxLoopHeight: upper.loopHeight,
      minModelLengthPer100Needles: lower.measured,
      maxModelLengthPer100Needles: upper.measured,
      // Bounds of this geometry model and solver settings, not machine/process limits.
      minLengthCmPer100Needles: modelLengthToMm(lower.measured, gauge) / 10,
      maxLengthCmPer100Needles: modelLengthToMm(upper.measured, gauge) / 10,
    };

    feed.yarns.forEach((yarn, yarnIndex) => {
      const target = targetModelLengthPer100Needles(
        yarn.yarnLengthCmPer100Needles,
        gauge
      );
      if (target < lower.measured || target > upper.measured) {
        const closest =
          Math.abs(lower.measured - target) <=
          Math.abs(upper.measured - target)
            ? lower
            : upper;
        results.push(
          resultFromCandidate({
            candidate: closest,
            feedIndex,
            yarnIndex,
            target,
            targetLengthCmPer100Needles: Number(yarn.yarnLengthCmPer100Needles),
            gauge,
            status: UNREACHABLE_TARGET,
            reachableRange,
            tolerance,
            feedCount,
          })
        );
        return;
      }

      let low = lower;
      let high = upper;
      let best =
        Math.abs(low.measured - target) <= Math.abs(high.measured - target)
          ? low
          : high;
      for (let iteration = 0; iteration < maxIterations; iteration += 1) {
        const midpoint = candidateAt(
          (low.loopHeight + high.loopHeight) / 2,
          feedIndex
        );
        if (
          Math.abs(midpoint.measured - target) <
          Math.abs(best.measured - target)
        ) {
          best = midpoint;
        }
        if (Math.abs(best.measured - target) <= tolerance) break;
        if (midpoint.measured < target) low = midpoint;
        else high = midpoint;
      }

      const status =
        Math.abs(best.measured - target) <= tolerance
          ? CONVERGED
          : MAX_ITERATIONS;
      results.push(
        resultFromCandidate({
          candidate: best,
          feedIndex,
          yarnIndex,
          target,
          targetLengthCmPer100Needles: Number(yarn.yarnLengthCmPer100Needles),
          gauge,
          status,
          reachableRange,
          tolerance,
          feedCount,
        })
      );
    });
  });

  return results;
}
