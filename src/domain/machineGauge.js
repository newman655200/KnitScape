export const DEFAULT_MACHINE_GAUGE = 32;
// Existing software/UI bounds, not validated physical machine limits.
export const MIN_MACHINE_GAUGE = 1;
export const MAX_MACHINE_GAUGE = 120;

export function validateMachineGauge(value) {
  if (!Number.isFinite(value) || value < MIN_MACHINE_GAUGE || value > MAX_MACHINE_GAUGE) {
    throw new RangeError(
      `Machine Gauge must be a finite number from ${MIN_MACHINE_GAUGE} to ${MAX_MACHINE_GAUGE} needles/inch (current software range).`
    );
  }
  return value;
}

// Compatibility for calculation callers: numeric text and an omitted software default.
// Explicit invalid values must never silently become a different Gauge.
export function normalizeMachineGauge(value = DEFAULT_MACHINE_GAUGE) {
  return validateMachineGauge(typeof value === "string" ? Number(value) : value);
}
