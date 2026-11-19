import { buildSpatialPath } from "./yarnSpatialPath.js";
import { buildParallelTransportFrames } from "./yarnParallelTransport.js";
import { buildYarnTubeGeometry } from "./yarnTubeGeometry.js";
import { createSimulationSnapshot } from "./simulationSnapshot.js";

export const SPATIAL_EXPERIMENT_RULE_VERSION = "artificial-xyz-tube-v1";
export const DEFAULT_SPATIAL_PARAMETERS = Object.freeze({ preset: "line", section: "circle",
  radiusA: .28, radiusB: .28, radialSegments: 32, sampleCount: 128 });

const PRESETS = {
  line: { type: "line", points: [[-6, 0, 0], [6, 0, 0]], unit: "mm" },
  "s-curve": { type: "catmull-rom", points: [[-6, -1, 0], [-3, 2, -1], [0, 0, 1], [3, -2, 0], [6, 1, 1]], unit: "mm" },
  helix: { type: "helix", radius: 3, turns: 2, pitch: 2, unit: "mm" },
  ring: { type: "circle", radius: 3, unit: "mm" },
};

/** Artificial XYZ fixtures only. No project paths, material assets, or solver
 * results enter this boundary. Working curve functions and typed buffers stay private. */
export function buildYarnSpatialExperiment(input = {}, context = {}) {
  const inputErrors = [];
  const reject = (field, expected) => {
    inputErrors.push({ code: "INVALID_EXPERIMENT_INPUT", field,
      message: `${field} must be ${expected}; invalid input was not used.` });
    return null;
  };
  const isRecord = value => value !== null && typeof value === "object" &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
  const validInput = isRecord(input), validContext = isRecord(context);
  if (!validInput) reject("input", "a plain parameter object");
  if (!validContext) reject("context", "a plain metadata object");
  const parameters = Object.fromEntries(Object.entries(DEFAULT_SPATIAL_PARAMETERS)
    .map(([key, defaultValue]) => {
      if (!validInput) return [key, null];
      const value = Object.hasOwn(input, key) ? input[key] : defaultValue;
      return [key, typeof value === typeof defaultValue ? value : reject(key, `a primitive ${typeof defaultValue}`)];
    }));
  const source = Object.fromEntries(["projectGeneration", "feedYarnStructureRevision"].map(key => {
    if (!validContext) return [key, null];
    const value = context[key];
    return [key, value === undefined || typeof value === "number" ? value : reject(key, "a primitive number when supplied")];
  }));
  const config = !inputErrors.length && Object.hasOwn(PRESETS, parameters.preset) ? PRESETS[parameters.preset] : null;
  const radiusB = parameters.section === "circle" ? parameters.radiusA : parameters.radiusB;
  const base = { inputSource: "TEST_ONLY", ruleVersion: SPATIAL_EXPERIMENT_RULE_VERSION,
    ...source,
    units: { length: "mm" }, geometryType: parameters.section === "ellipse" ? "Elliptical Tube" : "Tube", parameters,
    inputSignature: JSON.stringify({ ruleVersion: SPATIAL_EXPERIMENT_RULE_VERSION, parameters, config },
      (_key, value) => typeof value === "number" && !Number.isFinite(value) ? String(value) : value),
    provenance: { value: { parameters, centerline: config }, unit: "mm",
      source: "Artificial XYZ presets and local TEST_ONLY controls",
      derivationPrinciple: "XYZ derivative norm integration; parallel transport; supplied circular/elliptical radii",
      confidence: "TEST_ONLY_UNCALIBRATED", applicableState: "ARTIFICIAL_GEOMETRY_NO_PHYSICAL_LOAD" },
    selfContactStatus: "NOT_EVALUATED", physicsStatus: "NOT_IMPLEMENTED" };
  const finish = (status, details) => createSimulationSnapshot({ ...base, status, centerline: null,
    xyzLength: null, frames: null, mesh: null, testUVRepeatLengthMm: null, diagnostics: [], ...details });
  if (inputErrors.length) return finish("INVALID", { diagnostics: inputErrors });
  if (!config || !["circle", "ellipse"].includes(parameters.section) ||
    !Number.isFinite(parameters.radiusA) || parameters.radiusA <= 0 || !Number.isFinite(radiusB) || radiusB <= 0 ||
    !Number.isInteger(parameters.sampleCount) || parameters.sampleCount < 2 || parameters.sampleCount > 2048 ||
    !Number.isInteger(parameters.radialSegments) || parameters.radialSegments < 3 || parameters.radialSegments > 256) {
    return finish("INVALID", { diagnostics: [{ code: "INVALID_EXPERIMENT_INPUT",
      message: "选择有效样例与圆/椭圆截面；半径须为有限正数 (mm)，中心线采样须为 2–2048 整数，径向分段须为 3–256 整数。" }] });
  }
  const vertexCount = parameters.sampleCount * (parameters.radialSegments + 1) +
    (parameters.preset === "ring" ? 0 : 2 * (parameters.radialSegments + 2));
  if (vertexCount > 100000) return finish("INVALID", { diagnostics: [{ code: "EXPERIMENT_WORKLOAD_LIMIT",
    message: "本地实验最多 100000 顶点；请降低中心线点数或径向分段。输入未被自动缩减。" }] });
  const path = buildSpatialPath(config, { sampleCount: parameters.sampleCount });
  if (path.status !== "OK") return finish("INVALID", { diagnostics: path.diagnostics });
  const { curve: _privateCurve, lengthMeasurement, ...centerline } = path;
  const xyzLength = { value: lengthMeasurement.totalLength, unit: "mm", errorEstimate: lengthMeasurement.errorEstimate,
    segmentLengths: lengthMeasurement.segmentLengths, cumulativeLengths: lengthMeasurement.cumulativeLengths,
    method: lengthMeasurement.method, status: lengthMeasurement.status };
  const frames = buildParallelTransportFrames(path);
  if (frames.status !== "OK") return finish("INVALID", { centerline, xyzLength, frames, diagnostics: frames.diagnostics });
  // This test UV scale has no relationship to the scanned 2D material repeat.
  const testUVRepeatLengthMm = path.closed ? path.totalLength / 8 : 1.5;
  const mesh = buildYarnTubeGeometry({ path, frames, radiusA: parameters.radiusA, radiusB,
    radialSegments: parameters.radialSegments, capEnds: !path.closed, uvRepeatLength: testUVRepeatLengthMm });
  return finish(mesh.status === "OK" ? "OK" : "INVALID", { centerline, xyzLength, frames, mesh,
    testUVRepeatLengthMm, diagnostics: [...path.diagnostics, ...frames.diagnostics, ...mesh.diagnostics] });
}
