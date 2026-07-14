export const DEFAULT_MACHINE_GAUGE = 32;
export const MIN_MACHINE_GAUGE = 1;
export const MAX_MACHINE_GAUGE = 120;

export function normalizeMachineGauge(
  value,
  fallback = DEFAULT_MACHINE_GAUGE
) {
  const numeric = Number(value);
  const fallbackGauge = Number.isFinite(Number(fallback))
    ? Number(fallback)
    : DEFAULT_MACHINE_GAUGE;

  if (!Number.isFinite(numeric) || numeric <= 0) return fallbackGauge;

  return Math.max(MIN_MACHINE_GAUGE, Math.min(MAX_MACHINE_GAUGE, numeric));
}

export function gaugeToNeedlePitchMm(gauge) {
  return 25.4 / normalizeMachineGauge(gauge);
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
