const INPUTS = {
  tex: [20, "tex"],
  densityGPerCm3: [1.31, "g/cm^3"],
  fiberDiameterMm: [0.021, "mm"],
  E_f: [3000, "N/mm^2"],
  K: [0.01, "1"],
  phi0: [0.5, "1"],
};

/** Numerical reference material; defaults are assumptions, never measurements. */
export function createFabricFormParams(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("fabric form parameters must be an object.");
  }
  for (const key of Object.keys(input)) {
    if (!(key in INPUTS) && key !== "provenance") throw new TypeError(`Unknown parameter ${key}.`);
  }
  if (input.provenance !== undefined && (!input.provenance || typeof input.provenance !== "object" ||
      Array.isArray(input.provenance))) throw new TypeError("provenance must be an object.");
  const result = { provenance: {} };
  for (const [key, [defaultValue, unit]] of Object.entries(INPUTS)) {
    const value = key in input ? input[key] : defaultValue;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      throw new RangeError(`${key} must be a positive finite number in ${unit}.`);
    }
    if (key === "phi0" && value >= 1) throw new RangeError("phi0 must be strictly below 1.");
    const supplied = input.provenance?.[key] ?? {};
    if (supplied.confidence && supplied.confidence !== "ASSUMPTION" &&
        (!(key in input) || ["source", "principle", "applicableState"].some(field => !supplied[field]))) {
      throw new TypeError(`${key} provenance must explicitly identify the input, source, principle and applicableState.`);
    }
    if (supplied.unit !== undefined && supplied.unit !== unit) {
      throw new RangeError(`${key} provenance unit must be ${unit}.`);
    }
    result[key] = value;
    result.provenance[key] = {
      value,
      unit,
      source: key in input ? "Caller-supplied model parameter" : "docs/LAYER3_STEP1_TASK.md section 2",
      principle: "Model reference assumption; no material measurement asserted",
      confidence: "ASSUMPTION",
      applicableState: "Uncalibrated T1 model reference; physical specimen state unknown",
      ...supplied,
      value,
      unit,
    };
    for (const field of ["source", "principle", "confidence", "applicableState"]) {
      if (typeof result.provenance[key][field] !== "string" || !result.provenance[key][field].trim()) {
        throw new TypeError(`${key} provenance requires ${field}.`);
      }
    }
  }
  const { tex, densityGPerCm3: rho, fiberDiameterMm: df, E_f, phi0 } = result;
  const derived = [
    ["d_s", Math.sqrt(4 * tex / (Math.PI * rho * 1000)), "mm",
      ["tex", "densityGPerCm3"], "sqrt(4 * tex / (pi * densityGPerCm3 * 1000))"],
    ["fiberTex", rho * 1000 * Math.PI * df ** 2 / 4, "tex",
      ["densityGPerCm3", "fiberDiameterMm"], "densityGPerCm3 * 1000 * pi * fiberDiameterMm^2 / 4"],
  ];
  function addDerived(key, value, unit, dependencies, principle) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${key} is not finite and positive.`);
    result[key] = value;
    result.provenance[key] = {
      value, unit, source: `Derived from ${dependencies.join(", ")}`,
      principle, confidence: "DERIVED", applicableState: "Inherits the states and uncertainty of all dependencies",
      dependencies: dependencies.slice(),
    };
  }
  derived.forEach(values => addDerived(...values));
  addDerived("d_e", result.d_s / Math.sqrt(phi0), "mm", ["d_s", "phi0"], "d_s / sqrt(phi0)");
  addDerived("r_c", phi0 * result.d_e, "mm", ["phi0", "d_e"], "phi0 * d_e; uniaxial compaction model");
  addDerived("N_f", tex / result.fiberTex, "1", ["tex", "fiberTex"], "tex / fiberTex; continuum fiber count estimate");
  addDerived("B", result.N_f * E_f * Math.PI * df ** 4 / 64, "N*mm^2",
    ["N_f", "E_f", "fiberDiameterMm"], "N_f * E_f * pi * fiberDiameterMm^4 / 64; freely sliding fibers");
  return result;
}
