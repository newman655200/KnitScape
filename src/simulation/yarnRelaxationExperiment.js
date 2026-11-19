import { relaxYarnSpatialPath } from "./yarnSpatialRelaxation.js";
import { buildSpatialPath } from "./yarnSpatialPath.js";
import { buildParallelTransportFrames } from "./yarnParallelTransport.js";
import { buildYarnTubeGeometry } from "./yarnTubeGeometry.js";
import { createSimulationSnapshot } from "./simulationSnapshot.js";

export const RELAXATION_RULE_VERSION = "artificial-fixed-seed-length-shape-v1";
export const RELAXATION_TARGETS = Object.freeze([12.5, 14, 16]);
export const RELAXATION_GEOMETRY = Object.freeze({ radiusMm: .18, radialSegments: 32, sampleCount: 128, uvRepeatLengthMm: 1.5 });
export const RELAXATION_INPUT = createSimulationSnapshot({ unit: "mm",
  initialPoints: Array.from({ length: 9 }, (_, i) => i === 0 ? [-6, 0, 0] : i === 8 ? [6, 0, 0] :
    [-6 + 12 * i / 8, 1.2 * Math.sin(Math.PI * i / 8), .7 * Math.sin(2 * Math.PI * i / 8)]),
  anchors: [{ index: 0, position: [-6, 0, 0] }, { index: 8, position: [6, 0, 0] }],
  constraints: { maxControlDisplacementMm: 5 }, solver: {} });

/** Fixed artificial input only. The worker owns numerical work; the public
 * snapshot contains no curve closures, typed buffers or project state aliases. */
export function buildYarnRelaxationExperiment({ targetLengthMm, initial = false } = {}, context = {}) {
  const solverResult = initial ? null : relaxYarnSpatialPath({ ...RELAXATION_INPUT, targetLengthMm });
  const base = { inputSource: "ARTIFICIAL_FIXED_SEED", ruleVersion: RELAXATION_RULE_VERSION,
    validationClass: "TEST_ONLY", projectGeneration: context.projectGeneration,
    feedYarnStructureRevision: context.feedYarnStructureRevision, units: { length: "mm", curvature: "1/mm" },
    targetLengthMm: initial ? null : Number.isFinite(targetLengthMm) ? targetLengthMm : null,
    geometryParameters: RELAXATION_GEOMETRY, anchors: RELAXATION_INPUT.anchors, solverResult,
    selfContactStatus: "NOT_EVALUATED", physicsStatus: "UNCALIBRATED_NUMERICAL_SHAPE_ONLY",
    provenance: { value: { input: RELAXATION_INPUT, geometry: RELAXATION_GEOMETRY,
      targetLengthMm: Number.isFinite(targetLengthMm) ? targetLengthMm : null }, unit: "mm",
      source: "Artificial formula: x=-6+12i/8, y=1.2 sin(pi i/8), z=0.7 sin(2pi i/8); exact endpoint anchors",
      derivationPrinciple: "Round4 XYZ speed integral; dimensionless bending/proximity optimization; parallel transport circular tube",
      confidence: "TEST_ONLY_UNCALIBRATED", applicableState: "ARTIFICIAL_GEOMETRY_NO_PHYSICAL_LOAD" } };
  const finish = (status, details = {}) => createSimulationSnapshot({ ...base, status, reason: null,
    centerline: null, xyzLength: null, frames: null, mesh: null, diagnostics: [], ...details });
  if (solverResult && solverResult.status !== "CONVERGED") return finish(solverResult.status,
    { reason: solverResult.reason, diagnostics: [{ code: solverResult.reason, message: "未得到可显示的收敛形状。" }] });
  const curveConfig = initial ? { type: "catmull-rom", unit: "mm", closed: false, points: RELAXATION_INPUT.initialPoints } : solverResult.curveConfig;
  const path = buildSpatialPath(curveConfig, { sampleCount: RELAXATION_GEOMETRY.sampleCount,
    absoluteTolerance: 1e-10, relativeTolerance: 1e-11, maxDepth: 20 });
  if (path.status !== "OK") return finish("ERROR", { reason: "PATH_BUILD_FAILED", diagnostics: path.diagnostics });
  const { curve: _privateCurve, lengthMeasurement, ...centerline } = path;
  const xyzLength = { value: lengthMeasurement.totalLength, unit: "mm", errorEstimate: lengthMeasurement.errorEstimate,
    segmentLengths: lengthMeasurement.segmentLengths, cumulativeLengths: lengthMeasurement.cumulativeLengths,
    method: lengthMeasurement.method, status: lengthMeasurement.status, authority: "yarnSpatialLength.measureSpatialLength" };
  const frames = buildParallelTransportFrames(path);
  if (frames.status !== "OK") return finish("ERROR", { reason: "FRAME_BUILD_FAILED", diagnostics: frames.diagnostics });
  const mesh = buildYarnTubeGeometry({ path, frames, radiusA: RELAXATION_GEOMETRY.radiusMm, radiusB: RELAXATION_GEOMETRY.radiusMm,
    radialSegments: RELAXATION_GEOMETRY.radialSegments, uvRepeatLength: RELAXATION_GEOMETRY.uvRepeatLengthMm, capEnds: true });
  if (mesh.status !== "OK") return finish("ERROR", { reason: "TUBE_BUILD_FAILED", diagnostics: mesh.diagnostics });
  return finish(initial ? "INITIAL" : "CONVERGED", { centerline, xyzLength, frames, mesh,
    diagnostics: [...path.diagnostics, ...frames.diagnostics, ...mesh.diagnostics] });
}
