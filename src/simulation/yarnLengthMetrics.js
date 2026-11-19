import { normalizeMachineGauge } from "../domain/machineGauge.js";
export {
  DEFAULT_MACHINE_GAUGE,
  MIN_MACHINE_GAUGE,
  MAX_MACHINE_GAUGE,
  normalizeMachineGauge,
} from "../domain/machineGauge.js";

export function gaugeToNeedlePitchMm(gauge) {
  return 25.4 / normalizeMachineGauge(gauge);
}

export function modelLengthToMm(modelLength, gauge) {
  const length = Number(modelLength);
  if (!Number.isFinite(length) || length < 0) {
    throw new TypeError("modelLength must be a non-negative number.");
  }
  return length * gaugeToNeedlePitchMm(gauge);
}

export function normalizeModelLengthPer100Needles(
  measuredModelLength,
  measuredNeedleCount
) {
  const modelLength = Number(measuredModelLength);
  const needleCount = Number(measuredNeedleCount);
  if (!Number.isFinite(modelLength) || modelLength < 0) {
    throw new TypeError("measuredModelLength must be a non-negative number.");
  }
  if (!Number.isFinite(needleCount) || needleCount <= 0) {
    throw new TypeError("measuredNeedleCount must be a positive number.");
  }
  return (modelLength * 100) / needleCount;
}

export function targetModelLengthPer100Needles(
  yarnLengthCmPer100Needles,
  gauge
) {
  const lengthCm = Number(yarnLengthCmPer100Needles);
  if (!Number.isFinite(lengthCm) || lengthCm < 0) {
    throw new TypeError(
      "yarnLengthCmPer100Needles must be a non-negative number."
    );
  }
  return (lengthCm * 10) / gaugeToNeedlePitchMm(gauge);
}

export function courseToFeedIndex(courseIndex, feedCount) {
  if (!Number.isInteger(courseIndex) || courseIndex < 0) {
    throw new RangeError("courseIndex must be a non-negative integer.");
  }
  if (!Number.isInteger(feedCount) || feedCount < 1) {
    throw new RangeError("feedCount must be a positive integer.");
  }
  return courseIndex % feedCount;
}

export function buildFeedYarnLengthDiagnostics({
  feed,
  measuredModelLengthPer100Needles,
  gauge,
}) {
  if (!Array.isArray(feed?.yarns)) {
    throw new TypeError("feed.yarns must be an array.");
  }
  const measuredLength = Number(measuredModelLengthPer100Needles);
  if (!Number.isFinite(measuredLength) || measuredLength <= 0) {
    throw new TypeError(
      "measuredModelLengthPer100Needles must be a positive number."
    );
  }

  return feed.yarns.map((yarn) => {
    const targetLength = targetModelLengthPer100Needles(
      yarn.yarnLengthCmPer100Needles,
      gauge
    );
    return {
      targetModelLengthPer100Needles: targetLength,
      measuredModelLengthPer100Needles: measuredLength,
      lengthRatio: targetLength / measuredLength,
    };
  });
}

export function cmPer100Loops({
  totalPathLengthStitchUnits,
  effectiveLoopCount,
  gauge,
}) {
  const loopCount = Math.max(1, Number(effectiveLoopCount) || 1);
  const averageLoopLengthStitchUnits =
    Math.max(0, Number(totalPathLengthStitchUnits) || 0) / loopCount;

  return (averageLoopLengthStitchUnits * gaugeToNeedlePitchMm(gauge) * 100) / 10;
}
