import { buildSpatialPath } from "./yarnSpatialPath.js";
import { measureSpatialLength } from "./yarnSpatialLength.js";
import { buildParallelTransportFrames } from "./yarnParallelTransport.js";
import { buildYarnTubeGeometry } from "./yarnTubeGeometry.js";
import { createSimulationSnapshot } from "./simulationSnapshot.js";
import { isAuditForGeometry, auditYarnGeometry } from "./yarnGeometryAudit.js";
import { add, subtract, scale, dot, cross, distance, normalize, rotate } from "./yarnSpatialMath.js";

export const SOP_SPATIAL_DEFAULTS = Object.freeze({ enabled: false, amplitudeMm: .3,
  radiusMm: .002, radialSegments: 12, sampleCount: 64 });
export const SOP_VISUAL_SWATCH_DEFAULTS = Object.freeze({ radiusMm: .035, radialSegments: 8, sampleCount: 32 });
const RULE = "source-cubic-xy-quartic-z-bump-v1";
const NUMBER = "[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?";
const TOKEN = new RegExp(`[MLC]|${NUMBER}`, "g");
const evaluate = (coefficients, u) => coefficients.reduceRight((sum, value) => sum * u + value, 0);
const derivativeCoefficients = values => values.slice(1).map((value, i) => value * (i + 1));

// Recursive monotone intervals isolate polynomial roots (including repeated roots)
// for cubic XY stationary points and degree-five squared-speed extrema.
function rootsInUnitInterval(input) {
  const coefficients = [...input];
  while (coefficients.length > 1 && coefficients.at(-1) === 0) coefficients.pop();
  const scale = Math.max(...coefficients.map(Math.abs));
  if (!scale || coefficients.length < 2) return [];
  const c = coefficients.map(value => value / scale);
  if (c.length === 2) { const root = -c[0] / c[1]; return root >= 0 && root <= 1 ? [root] : []; }
  const knots = [0, ...rootsInUnitInterval(derivativeCoefficients(c)), 1];
  const roots = knots.filter(u => Math.abs(evaluate(c, u)) < 64 * Number.EPSILON);
  for (let i = 1; i < knots.length; i++) {
    let lo = knots[i - 1], hi = knots[i], left = evaluate(c, lo), right = evaluate(c, hi);
    if (!left || !right || (left > 0) === (right > 0)) continue;
    for (let iteration = 0; iteration < 64; iteration++) {
      const middle = (lo + hi) / 2, value = evaluate(c, middle);
      if (middle === lo || middle === hi || value === 0) { lo = hi = middle; break; }
      if ((value > 0) === (left > 0)) { lo = middle; left = value; } else hi = middle;
    }
    roots.push((lo + hi) / 2);
  }
  return roots.sort((a, b) => a - b).filter((value, i, sorted) => !i || value - sorted[i - 1] > 1e-13);
}

function sourceControls(path, pitch) {
  if (typeof path !== "string" || path.replace(TOKEN, "").replace(/[\s,]/g, "")) {
    throw new Error("UNSUPPORTED_SOURCE_PATH: expected one absolute M followed by C or L; no inferred joins.");
  }
  const tokens = path.match(TOKEN) || [];
  const cubic = tokens[3] === "C" && tokens.length === 10;
  const line = tokens[3] === "L" && tokens.length === 6;
  if (tokens[0] !== "M" || (!cubic && !line)) throw new Error("UNSUPPORTED_SOURCE_PATH: one source link must contain one absolute cubic or line.");
  const values = [...tokens.slice(1, 3), ...tokens.slice(4)].map(Number);
  if (!values.every(Number.isFinite)) throw new Error("NONFINITE_SOURCE_PATH");
  const points = Array.from({ length: values.length / 2 }, (_, i) => [values[i * 2] * pitch, values[i * 2 + 1] * pitch]);
  if (!points.flat().every(value => Number.isFinite(value) && Math.abs(value) <= 1e8)) throw new Error("SOURCE_SCALE_OUT_OF_RANGE");
  if (line) {
    const [a, b] = points;
    return [a, a.map((v, i) => v + (b[i] - v) / 3), a.map((v, i) => v + 2 * (b[i] - v) / 3), b];
  }
  return points;
}

function sourceCurve(controls, amplitude) {
  const coefficients = [0, 1].map(axis => {
    const [p0, p1, p2, p3] = controls.map(point => point[axis]);
    return [p0, 3 * (p1 - p0), 3 * (p2 - 2 * p1 + p0), p3 - 3 * p2 + 3 * p1 - p0];
  });
  coefficients.push([0, 0, 16 * amplitude, -32 * amplitude, 16 * amplitude]);
  const derivatives = coefficients.map(derivativeCoefficients);
  const coefficientScale = Math.max(...derivatives.flat().map(Math.abs));
  const critical = derivatives.flatMap(rootsInUnitInterval);
  const stationary = [0, ...critical, 1].filter(u =>
    Math.hypot(...derivatives.map(c => evaluate(c, u))) <= coefficientScale * 1e-12);
  if (!coefficientScale || stationary.length) throw new Error("NONREGULAR_SOURCE_PATH: zero derivative has no unique frame.");
  const speedSquared = Array(7).fill(0);
  for (const d of derivatives) for (let i = 0; i < d.length; i++) for (let j = 0; j < d.length; j++) {
    speedSquared[i + j] += (d[i] / coefficientScale) * (d[j] / coefficientScale);
  }
  const integrationBreakpoints = [...critical, ...rootsInUnitInterval(derivativeCoefficients(speedSquared))]
    .filter(u => u > 0 && u < 1).sort((a, b) => a - b).filter((u, i, sorted) => !i || u - sorted[i - 1] > 1e-13);
  // Bernstein XY evaluation preserves the supplied cubic. Zero endpoint height
  // and slope avoid introducing artificial discontinuities at source link ends.
  const point = u => [0, 1].map(axis => (1 - u) ** 3 * controls[0][axis] +
    3 * (1 - u) ** 2 * u * controls[1][axis] + 3 * (1 - u) * u * u * controls[2][axis] + u ** 3 * controls[3][axis])
    .concat(16 * amplitude * u * u * (1 - u) ** 2);
  const derivative = u => [evaluate(derivatives[0], u), evaluate(derivatives[1], u),
    u === 0 || u === 1 || amplitude === 0 ? 0 : 32 * amplitude * u * (1 - u) * (1 - 2 * u)];
  return { type: RULE, unit: "mm", closed: false, regular: true, point, derivative,
    segments: [{ point, derivative, integrationBreakpoints, stationaryParameters: [] }], diagnostics: [],
    continuity: { positionContinuous: true, tangentContinuous: true, derivativeContinuous: true, regular: true,
      maxPositionGap: 0, maxDerivativeGap: 0, maxTangentAngleRadians: 0, scope: "WITHIN_THIS_SOURCE_LINK_ONLY" } };
}

function measurement(result, link, state) {
  return { status: result.status, value: result.totalLength, unit: result.unit, errorEstimate: result.errorEstimate,
    method: result.method, source: "yarnSpatialLength.measureSpatialLength", state,
    window: { linkId: link.id, sourceOccurrenceId: link.sourceOccurrenceId, targetOccurrenceId: link.targetOccurrenceId,
      boundary: link.boundary, scope: "ONE_WHOLE_APPLIED_SOURCE_LINK; NOT_NORMALIZED_PER_100_NEEDLES" } };
}

const vectorGap = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));
const check = (value, tolerance) => ({ status: value <= tolerance ? "PASS" : "FAIL", tolerance });

// Audit the unmodified, independent Round6 endpoints. These are numerical
// compatibility checks, not a physical continuity classifier or a new engine.
function auditJoin(before, after) {
  const left = before.centerline, right = after.centerline;
  const gapMm = vectorGap(left.points.at(-1), right.points[0]);
  const angleRadians = 2 * Math.asin(Math.min(1, vectorGap(left.tangents.at(-1), right.tangents[0]) / 2));
  const velocity = (path, end) => {
    const p = path.provenance.sourceControlsMm;
    return [0, 1].map(axis => 3 * (p[end ? 3 : 1][axis] - p[end ? 2 : 0][axis])).concat(0);
  };
  const a = velocity(before, true), b = velocity(after, false);
  const derivativeGap = vectorGap(a, b), derivativeScaleRatio = Math.hypot(...b) / Math.hypot(...a);
  const c0 = { ...check(gapMm, 1e-9), gapMm, unit: "mm" };
  const g1 = { ...check(angleRadians, 1e-8), angleRadians, unit: "radian" };
  const c1 = { ...check(derivativeGap, Math.max(Math.hypot(...a), Math.hypot(...b)) * 1e-10),
    derivativeGap, derivativeScaleRatio, unit: "mm/local-u", parameterization: "EACH_ORIGINAL_LINK_LOCAL_u_IN_[0,1]; NO_RESCALE" };
  let frame = { status: "NOT_BUILT" }, seam = { status: "NOT_BUILT" }, caps = { status: "NOT_BUILT", internalCapCount: null };
  if (before.frames && after.frames) {
    const f = before.frames.frames.at(-1), g = after.frames.frames[0];
    const maxBasisGap = Math.max(...["tangent", "normal", "binormal"].map(axis => vectorGap(f[axis], g[axis])));
    frame = { ...check(maxBasisGap, 1e-8), maxBasisGap, scope: "INDEPENDENT_TRANSPORT_ENDPOINTS; NO_SHARED_FRAME_APPLIED" };
  }
  if (before.mesh && after.mesh) {
    const aMesh = before.mesh, bMesh = after.mesh, stride = aMesh.counts.radialSegments + 1;
    const maxRingGapMm = Math.max(...Array.from({ length: stride }, (_, i) => {
      const offset = ((aMesh.counts.rings - 1) * stride + i) * 3;
      return vectorGap(Array.from(aMesh.positions.slice(offset, offset + 3)), Array.from(bMesh.positions.slice(i * 3, i * 3 + 3)));
    }));
    seam = { ...check(maxRingGapMm, 1e-6), maxRingGapMm, unit: "mm", scope: "MATCHING_RADIAL_INDICES_OF_EXISTING_FLOAT32_RINGS",
      uvStatus: "LONGITUDINAL_U_RESTARTS_PER_LINK", joinedSeam: "NOT_BUILT" };
    // Round6 meshes have no caps anywhere, including prospective internal joins.
    const internalCapCount = aMesh.counts.caps + bMesh.counts.caps;
    caps = { status: internalCapCount === 0 ? "PASS" : "FAIL", internalCapCount, boundaryPolicy: "OPEN; NO_ROI_CLOSURE" };
  }
  const checks = [c0, g1, c1, frame, seam, caps];
  return { fromLinkId: before.linkId, toLinkId: after.linkId,
    status: checks.some(item => item.status === "FAIL") ? "DISCONTINUITY" :
      checks.some(item => item.status === "NOT_BUILT") ? "PARTIALLY_EVALUATED" : "NUMERICALLY_COMPATIBLE_ONLY",
    c0, g1, c1, frame, seam, caps, transitionLengthMm: 0 };
}

function chainLengths(paths, topology, boundary) {
  const sourceXYMm = paths.reduce((sum, path) => sum + path.sourceXYLength.value, 0);
  const xyzMm = paths.reduce((sum, path) => sum + path.xyzLength.value, 0);
  return { sourceXYMm, xyzMm, deltaMm: xyzMm - sourceXYMm, ratio: sourceXYMm > 0 ? xyzMm / sourceXYMm : null,
    sourceXYModelUnits: sourceXYMm / topology.scale.needlePitchMm, sourceUnit: "MODEL_NEEDLE_PITCH", unit: "mm",
    uniqueLinkCount: paths.length, transitionLengthMm: 0, normalizationDenominator: null,
    window: { roi: topology.roi, linkIds: paths.map(path => path.linkId), scope: "UNIQUE_WHOLE_SOURCE_LINKS_REFERENCED_BY_DERIVED_CHAINS" },
    boundary, interpretation: "SUM_OF_UNJOINED_UNIQUE_SOURCE_LINKS; NOT_A_CONTINUOUS_PHYSICAL_ARCLENGTH",
    source: "Existing Round6 sourceXYLength / xyzLength; yarnSpatialLength adaptive Gauss-Kronrod integral",
    derivationPrinciple: "Reuse each link integral once; no occurrence/CN multiplicity, no added transitions",
    confidence: "MODEL_GEOMETRY_ONLY; PHYSICAL_YARN_CONTINUITY_UNKNOWN", applicableState: "SOURCE_MODEL_OR_ASSUMPTION_TEST_ONLY; MATERIAL_LOAD_STATE_UNKNOWN",
    comparisonTo23And24: "NOT_COMPARABLE", comparisonToM1M3: "NOT_COMPARABLE",
    comparabilityReason: "Physical segment identity, material state, measurement window and per-100-needle denominator are not established" };
}

function auditChains(topology, paths) {
  const continuity = topology.continuity;
  const empty = (status, reason) => ({ status, reason, identity: topology.identity,
    physicalContinuity: "UNKNOWN", chains: [], totals: null,
    counts: { chains: 0, joins: 0, discontinuities: 0, joinedMeshes: 0 }, joinPolicy: "DIAGNOSTICS_ONLY; NO_WELDING_OR_TRANSITIONS" });
  if (!continuity) return empty("UNAVAILABLE", "CONTINUITY_CLASSIFICATION_MISSING");
  const sameRevision = item => item?.snapshotId === topology.identity?.key &&
    item.projectGeneration === topology.identity?.projectGeneration && item.revision === topology.identity?.feedYarnStructureRevision;
  if (continuity.status !== "CLASSIFIED" || !sameRevision(continuity) || !Array.isArray(continuity.chains)) {
    return empty("INVALID", "STALE_OR_INVALID_CONTINUITY_CLASSIFICATION");
  }
  const byId = new Map(paths.map(path => [path.linkId, path])), chainIds = new Set(), uniquePaths = new Map(), chains = [];
  for (const chain of continuity.chains) {
    if (!chain || typeof chain.id !== "string" || chainIds.has(chain.id) || !sameRevision(chain) || chain.closed !== false ||
      !["CONFIRMED_FROM_SOURCE", "CANDIDATE_FROM_MODEL", "ASSUMPTION_TEST_ONLY"].includes(chain.evidenceStatus) ||
      !Array.isArray(chain.linkIds) || !chain.linkIds.length || !chain.linkIds.every(id => byId.has(id))) {
      return empty("INVALID", "STALE_OR_INVALID_CHAIN_REFERENCE");
    }
    chainIds.add(chain.id);
    const referenced = [...new Set(chain.linkIds)].map(id => byId.get(id));
    if (referenced.some(path => path.feedIndex !== chain.feedIndex || path.yarnId !== chain.yarnId || path.yarnIndex !== chain.yarnIndex ||
      path.provenance.sourceLink.boundary !== "INTERNAL" || path.provenance.sourceLink.crossFeed || path.provenance.sourceLink.crossRow)) {
      return empty("INVALID", "CHAIN_CROSSES_FEED_YARN_OR_ROI_BOUNDARY");
    }
    const duplicateLinkIds = [...new Set(chain.linkIds.filter((id, i) => chain.linkIds.indexOf(id) !== i))];
    const ordered = referenced.every((path, i) => !i || referenced[i - 1].provenance.sourceLink.targetOccurrenceId === path.provenance.sourceLink.sourceOccurrenceId);
    const joins = duplicateLinkIds.length || !ordered ? [] : referenced.slice(1).map((path, i) => auditJoin(referenced[i], path));
    referenced.forEach(path => uniquePaths.set(path.linkId, path));
    const geometryStatus = duplicateLinkIds.length || !ordered ? "REJECTED" : joins.some(join => join.status === "DISCONTINUITY") ? "DISCONTINUITY" :
      chain.evidenceStatus === "CONFIRMED_FROM_SOURCE" ? "SOURCE_SOFTWARE_ONLY" : "CANDIDATE_ONLY";
    chains.push({ id: chain.id, linkIds: referenced.map(path => path.linkId), evidenceStatus: chain.evidenceStatus,
      evidenceSource: chain.evidenceSource, feedIndex: chain.feedIndex, yarnId: chain.yarnId, yarnIndex: chain.yarnIndex,
      snapshotId: chain.snapshotId, projectGeneration: chain.projectGeneration, revision: chain.revision,
      physicalContinuity: "UNKNOWN", physicalSupplyIdentity: "UNKNOWN", startBoundary: chain.startBoundary, endBoundary: chain.endBoundary,
      closed: false, mesh: null, geometryStatus, duplicateLinkIds, joins,
      lengths: chainLengths(referenced, topology, { start: chain.startBoundary, end: chain.endBoundary }),
      diagnostics: [{ code: geometryStatus, message: "Independent source segments retained; no smoothing, shared frame, welded seam, transition or physical continuity claim." }] });
  }
  const joins = chains.flatMap(chain => chain.joins);
  return { ...empty("OK", null), chains,
    totals: chainLengths([...uniquePaths.values()], topology, "UNION_OF_OPEN_CHAIN_WINDOWS; EACH_SOURCE_LINK_COUNTED_ONCE"),
    counts: { chains: chains.length, joins: joins.length, discontinuities: joins.filter(join => join.status === "DISCONTINUITY").length,
      joinedMeshes: 0, uniqueLinks: uniquePaths.size, unreferencedLinks: paths.length - uniquePaths.size } };
}

/** Readonly local geometry, never a Machine/CN/Solver or business-length owner.
 * Every source link remains independent; no shared CN, feed or yarn ID welds it.
 * Disabled mode has no tube or renderer scene. Enabled mode is an explicit test.
 */
export function buildSopSpatialHypothesis(topology, options = {}) {
  const parameters = { ...SOP_SPATIAL_DEFAULTS, ...options };
  const base = { identity: topology?.identity ?? null, ruleVersion: RULE, parameters,
    mode: parameters.enabled === true ? "SPATIAL_HYPOTHESIS_TEST_ONLY" : "SOURCE_TOPOLOGY_VIEW",
    units: { source: "MODEL_NEEDLE_PITCH", geometry: "mm", length: "mm" },
    spatialRelations: topology?.spatialRelations ?? [],
    relaxationEligibility: { status: "UNSUPPORTED_CONSTRAINTS", reason: "COMPLEX_SOP_LINKS_NOT_CERTIFIED_FOR_ROUND5_FIXED_ENDPOINT_UNIFORM_LONGITUDINAL_CONSTRAINTS",
      target: null, targetSource: "NONE; no 23/24 cm per 100 needle fitting" },
    scaleEvidence: { ...topology?.scale, value: topology?.scale?.needlePitchMm, unit: "mm/MODEL_NEEDLE_PITCH",
      source: "Published snapshot machineGauge", derivationPrinciple: "25.4 / gauge; machine needle pitch only",
      confidence: "DERIVED_MACHINE_PITCH_NOT_FABRIC_MEASUREMENT", applicableState: "MODEL_COORDINATES; fabric/load state UNKNOWN",
      physicalFabricScale: "UNKNOWN" },
    sectionEvidence: { value: parameters.radiusMm, unit: "mm", source: "Local user-visible experimental radius control",
      derivationPrinciple: "Supplied circular tube radius; not derived from denier, assets, fallback diameter or tension",
      confidence: "TEST_ONLY", applicableState: parameters.enabled ? "HYPOTHETICAL_GEOMETRY_ONLY" : "DISABLED_NO_SECTION" },
    sourceMetrics: topology?.metrics ?? null };
  const finish = (status, details = {}) => createSimulationSnapshot({ ...base, status, paths: [], scene: [], lengths: null,
    chainAudit: { status: "UNAVAILABLE", chains: [], totals: null, reason: "GEOMETRY_NOT_AVAILABLE" }, diagnostics: [], ...details });
  if (topology?.status !== "READY") return finish("UNAVAILABLE", { diagnostics: [{ code: topology?.reason || "NO_READY_TOPOLOGY" }] });
  if (!options || typeof options !== "object" || Array.isArray(options) || typeof parameters.enabled !== "boolean" ||
    !Number.isFinite(parameters.amplitudeMm) || parameters.amplitudeMm < 0 || parameters.amplitudeMm > 10 ||
    !Number.isFinite(parameters.radiusMm) || parameters.radiusMm <= 0 || parameters.radiusMm > 1 ||
    !Number.isInteger(parameters.sampleCount) || parameters.sampleCount < 2 || parameters.sampleCount > 512 ||
    !Number.isInteger(parameters.radialSegments) || parameters.radialSegments < 3 || parameters.radialSegments > 64 ||
    !Number.isFinite(base.scaleEvidence.needlePitchMm) || base.scaleEvidence.needlePitchMm <= 0 ||
    !Array.isArray(topology.links) || !topology.links.length || topology.links.length > 256 ||
    !topology.links.every(link => link && typeof link.id === "string" && link.id && link.units === "MODEL_NEEDLE_PITCH") ||
    topology.links.length * parameters.sampleCount * (parameters.radialSegments + 1) > 500000 ||
    new Set(topology.links.map(link => link.id)).size !== topology.links.length) {
    return finish("INVALID", { diagnostics: [{ code: "INVALID_SPATIAL_INPUT", message: "Finite TEST_ONLY parameters, positive gauge scale and distinct local source links are required." }] });
  }
  const paths = [], scene = [];
  try {
    for (const link of topology.links) {
      const controls = sourceControls(link.pathModel, base.scaleEvidence.needlePitchMm);
      const xyCurve = sourceCurve(controls, 0); // Reject source cusps before a lift could disguise them.
      const sourceXY = measureSpatialLength(xyCurve);
      const curve = parameters.enabled ? sourceCurve(controls, parameters.amplitudeMm) : xyCurve;
      const sampled = buildSpatialPath(curve, { sampleCount: parameters.sampleCount });
      if (sourceXY.status !== "OK" || sampled.status !== "OK") throw new Error(`SOURCE_INTEGRATION_FAILED:${link.id}:${JSON.stringify(sampled.diagnostics)}`);
      const { curve: _privateCurve, lengthMeasurement, ...centerline } = sampled;
      let frames = null, mesh = null;
      if (parameters.enabled) {
        frames = buildParallelTransportFrames(sampled);
        if (frames.status !== "OK") throw new Error(`TRANSPORT_FAILED:${link.id}:${JSON.stringify(frames.diagnostics)}`);
        mesh = buildYarnTubeGeometry({ path: sampled, frames, radiusA: parameters.radiusMm,
          radialSegments: parameters.radialSegments, capEnds: false, uvRepeatLength: 1 });
        if (mesh.status !== "OK") throw new Error(`TUBE_FAILED:${link.id}:${JSON.stringify(mesh.diagnostics)}`);
      }
      const heightRule = { value: parameters.enabled ? parameters.amplitudeMm : 0, unit: "mm",
        source: parameters.enabled ? "Explicit local experiment control; no layer/order/contact data" : "Source XY plane",
        derivationPrinciple: "z(u)=16*A*u^2*(1-u)^2; endpoints z=0 and dz/du=0; same rule for every yarn/link",
        confidence: parameters.enabled ? "ASSUMPTION_TEST_ONLY" : "SOURCE_MODEL_PLANE", applicableState: "NO_PHYSICAL_LOAD_OR_INTERLACING_PREDICTION" };
      const path = { id: link.id, linkId: link.id, linkIndex: link.index, strandId: link.strandId, feedIndex: link.feedIndex, yarnIndex: link.yarnIndex,
        yarnId: link.yarnId, sourceXYLength: measurement(sourceXY, link, "APPLIED_XY_SCALED_BY_MACHINE_PITCH"),
        xyzLength: measurement(lengthMeasurement, link, parameters.enabled ? "ASSUMPTION_TEST_ONLY" : "SOURCE_MODEL_PLANE"),
        deltaLengthMm: lengthMeasurement.totalLength - sourceXY.totalLength, centerline, frames, mesh,
        provenance: { identity: topology.identity, sourceLink: link, sourceControlsMm: controls, heightRule,
          joins: "NONE; source adjacency is recorded, independent link endpoints are never welded",
          section: base.sectionEvidence, uv: "TEST_ONLY 1 mm repeat; no original material UV overwritten" } };
      paths.push(path);
      if (mesh) scene.push({ id: path.id, geometry: mesh,
        material: { color: link.yarnIndex === 0 ? [.94, .46, .16] : [.12, .73, .86] } });
    }
  } catch (error) {
    return finish("INVALID", { diagnostics: [{ code: "SOP_SPATIAL_CONSTRUCTION_FAILED", message: String(error.message) }] });
  }
  const sourceXYMm = paths.reduce((sum, path) => sum + path.sourceXYLength.value, 0);
  const xyzMm = paths.reduce((sum, path) => sum + path.xyzLength.value, 0);
  return finish("OK", { paths, scene, chainAudit: auditChains(topology, paths), lengths: { sourceXYMm, xyzMm, deltaMm: xyzMm - sourceXYMm, unit: "mm",
    window: "SUM_OF_INDEPENDENT_WHOLE_SOURCE_LINKS_TOUCHING_ROI; ALL_SELECTED_FEED_YARNS",
    comparisonToM1M3: "NOT_COMPARABLE_DIFFERENT_WINDOW_AND_STATE; no physical residual or target fit" },
    diagnostics: [{ code: "PHYSICAL_RELATIONS_UNKNOWN", message: "No inter-yarn collision, contact or loop order evaluated. Tube endpoints remain open; no inferred joins." }] });
}

/** Readonly assembly of generic visual templates in the existing geometry flow.
 * Source links and Round7 chains are references, never joined or rewritten here.
 * Template dimensions are display assumptions, not measured fabric dimensions.
 */
export function buildSopVisualSwatch(topology, options = {}) {
  const parameters = { ...SOP_VISUAL_SWATCH_DEFAULTS, ...options };
  const sectionEvidence = { value: parameters.radiusMm, unit: 'mm', source: 'Explicit Round9 visual radius control',
    derivationPrinciple: 'Circular display section, independent of YarnAsset and denier',
    confidence: 'TEST_ONLY', evidenceStatus: 'VISUAL_ASSUMPTION', applicableState: 'VISUAL_SWATCH_ONLY; MATERIAL_STATE_UNKNOWN' };
  const templateEvidence = { evidenceStatus: 'VISUAL_ASSUMPTION', source: 'Round9 generic single jersey display templates',
    principle: 'K open head/legs; T distinct new tuck plus separately identified held-loop depiction; M nonzero float',
    applicability: 'Published single jersey K/T/M design window; no machine motion, contact or physical supply prediction',
    dimensions: { unit: 'NOMINAL_NEEDLE_PITCH', source: 'Round9 display constants; nominal pitch scales controls only',
      value: { cellWidth: 1, courseSpacing: .85, separateYarnZOffset: .10 },
      derivationPrinciple: 'Artist-selected layout with visible loops, not a measured or fitted fabric scale',
      confidence: 'TEST_ONLY', applicableState: 'DISPLAY_ONLY; RELAXED_AND_LOADED_FABRIC_UNKNOWN', physicalFabricScale: 'UNKNOWN' },
    spatialOrder: 'UNKNOWN; DISPLAY_Z_IS_VISUAL_ASSUMPTION', machineSpecific: 'UNKNOWN', physicalValidation: 'NONE' };
  const finish = (status, extra = {}) => Object.freeze({ status, identity: topology?.identity ?? null, parameters,
    mode: 'FULL_WINDOW_VISUAL_SWATCH_TEST_ONLY', sectionEvidence, templateEvidence, paths: [], scene: [], evidenceScene: [],
    lengths: null, coverage: null, counts: null, diagnostics: [], ...extra });
  const invalid = reason => finish('INVALID', { diagnostics: [{ code: reason }] });
  const continuity = topology?.continuity, identity = topology?.identity;
  if (topology?.status !== 'READY' || topology.roi?.window !== 'full' || !Array.isArray(topology.operations) ||
    !topology.operations.length || topology.operations.length > 20000 || !Array.isArray(topology.links) ||
    !Array.isArray(topology.strands) || !Array.isArray(continuity?.chains) || continuity.status !== 'CLASSIFIED' ||
    continuity.snapshotId !== identity?.key || continuity.projectGeneration !== identity?.projectGeneration ||
    continuity.revision !== identity?.feedYarnStructureRevision) return invalid('CURRENT_FULL_WINDOW_TOPOLOGY_REQUIRED');
  if (!options || typeof options !== 'object' || Array.isArray(options) ||
    !Number.isFinite(parameters.radiusMm) || parameters.radiusMm <= 0 || parameters.radiusMm > .1 ||
    !Number.isInteger(parameters.sampleCount) || parameters.sampleCount < 16 || parameters.sampleCount > 128 ||
    !Number.isInteger(parameters.radialSegments) || parameters.radialSegments < 6 || parameters.radialSegments > 24 ||
    !Number.isFinite(topology.scale?.needlePitchMm) || topology.scale.needlePitchMm <= 0) return invalid('INVALID_VISUAL_PARAMETERS');
  const pitch = topology.scale.needlePitchMm;
  const cells = new Map(), chainByLink = new Map(), linkByCell = new Map();
  const sourceLinkById = new Map(topology.links.map(link => [link.id, link]));
  if (sourceLinkById.size !== topology.links.length) return invalid('DUPLICATE_SOURCE_LINK');
  const key = (row, needle, yarnIndex) => `${row}:${needle}:${yarnIndex}`;
  for (const chain of continuity.chains) {
    if (chain.snapshotId !== identity.key || chain.projectGeneration !== identity.projectGeneration ||
      chain.revision !== identity.feedYarnStructureRevision || chain.closed !== false ||
      !Array.isArray(chain.linkIds) || !chain.linkIds.length) return invalid('STALE_CHAIN_REFERENCE');
    for (const id of chain.linkIds) {
      const link = sourceLinkById.get(id);
      if (!link || chainByLink.has(id) || link.crossRow || link.crossFeed || link.boundary !== 'INTERNAL' ||
        link.yarnId !== chain.yarnId || link.yarnIndex !== chain.yarnIndex || link.feedIndex !== chain.feedIndex) {
        return invalid('INVALID_CHAIN_SOURCE_REFERENCE');
      }
      chainByLink.set(id, chain.id);
    }
  }
  for (const link of topology.links) {
    const endpoints = [link.source, link.target];
    const targets = link.crossRow ? endpoints.map(item => [item.row, item.needle]) :
      Array.from({ length: Math.abs(endpoints[1].needle - endpoints[0].needle) + 1 }, (_, i) =>
        [link.row, Math.min(...endpoints.map(item => item.needle)) + i]);
    for (const [row, needle] of targets) {
      const id = key(row, needle, link.yarnIndex);
      if (!linkByCell.has(id)) linkByCell.set(id, []);
      linkByCell.get(id).push(link);
    }
  }
  const coverage = { validCells: 0, generatedCells: 0, expectedAssignments: 0, generatedAssignments: 0,
    ungeneratedCells: [], operations: { K: 0, T: 0, M: 0 }, tiling: 'NONE', boundary: 'OPEN_DESIGN_WINDOW',
    width: topology.roi.needleEnd + 1, height: topology.roi.rowEnd + 1,
    clippedSourceLinks: topology.links.filter(item => item.boundary === 'CLIPPED').length,
    outsideConnections: 'NOT_GENERATED; OPEN_ENDS; NOT_MACHINE_CIRCUMFERENCE' };
  for (const operation of topology.operations) {
    if (!['K', 'T', 'M'].includes(operation.operation)) return invalid('UNSUPPORTED_VISUAL_OPERATION');
    const assignments = topology.strands.filter(item => item.feedIndex === operation.feedIndex);
    coverage.validCells++; coverage.operations[operation.operation]++;
    coverage.expectedAssignments += assignments.length;
    if (!assignments.length) return invalid('VISUAL_CELL_ASSIGNMENT_MISSING');
    for (const strand of assignments) {
      const id = key(operation.row, operation.needle, strand.yarnIndex);
      const sourceLinks = (linkByCell.get(id) || []).filter(link => link.assignmentId === strand.assignmentId);
      if (!sourceLinks.length || cells.has(id)) return invalid('VISUAL_CELL_SOURCE_LINK_MISSING_OR_DUPLICATE');
      const occurrences = [...new Map(sourceLinks.flatMap(link => [link.source, link.target]).map(item => [item.id, item])).values()];
      cells.set(id, { operation, strand, sourceLinks, provenance: { identity, sourceStatus: 'SOURCE_DERIVED',
        operationSource: operation.sourceEvidence, occurrenceIds: occurrences.map(item => item.id),
        linkIds: sourceLinks.map(item => item.id), chainIds: [...new Set(sourceLinks.map(item => chainByLink.get(item.id)).filter(Boolean))],
        cnIndices: [...new Set(occurrences.flatMap(item => [item.originalCnIndex, item.finalCnIndex]))],
        chainInterpretation: 'ROUND7_SOURCE_CANDIDATES_ONLY; NOT_PHYSICAL_CONTINUITY',
        sourceBoundary: sourceLinks.some(item => item.boundary === 'CLIPPED') ? 'CLIPPED' : 'INTERNAL' } });
    }
  }
  if (coverage.expectedAssignments * 3 > 20000 ||
    coverage.expectedAssignments * parameters.sampleCount * (parameters.radialSegments + 1) > 4000000) {
    return invalid('VISUAL_WINDOW_RESOURCE_LIMIT');
  }
  // Prototype paths use the existing Round4 sampler, transport and tube checks.
  // Repeating these immutable display shapes is geometry reuse, not repeat tiling.
  const controls = {
    K: [[-.4, 0, 0], [-.22, .08, -.10], [-.18, .38, -.10], [-.30, .73, .06],
      [-.23, 1, .15], [0, 1.09, .17], [.23, 1, .15], [.30, .73, .06], [.18, .38, -.10], [.22, .08, -.10], [.4, 0, 0]],
    T: [[-.4, 0, 0], [-.25, .16, .10], [-.15, .57, .13], [0, .72, .06], [.15, .57, -.04], [.25, .16, -.08], [.4, 0, 0]],
    M: [[-.4, 0, 0], [-.2, -.05, -.08], [0, -.07, -.10], [.2, -.05, -.08], [.4, 0, 0]],
    HELD: [[-.30, .12, -.16], [-.36, .53, -.14], [-.23, 1.02, -.10], [0, 1.13, -.08],
      [.23, 1.02, -.10], [.36, .53, -.14], [.30, .12, -.16]],
    TRANSITION: [[.4, 0, 0], [.6, 0, 0]],
  };
  templateEvidence.controlPoints = { value: controls, unit: 'NOMINAL_NEEDLE_PITCH',
    source: 'Round9 generic visual template control points', derivationPrinciple: 'Existing Round4 Catmull-Rom interpolation',
    confidence: 'TEST_ONLY', applicableState: 'VISUAL_ONLY; NO_MACHINE_MOTION_OR_CONTACT_ORDER' };
  const prototypes = new Map(), paths = [], scene = [], evidenceScene = [];
  try {
    for (const [name, points] of Object.entries(controls)) {
      const sampled = buildSpatialPath({ type: name === 'TRANSITION' ? 'line' : 'catmull-rom',
        points: points.map(point => point.map(value => value * pitch)), unit: 'mm', closed: false },
      { sampleCount: name === 'TRANSITION' ? 4 : parameters.sampleCount });
      if (sampled.status !== 'OK') throw new Error(`TEMPLATE_PATH_${name}:${JSON.stringify(sampled.diagnostics)}`);
      const frames = buildParallelTransportFrames(sampled);
      const mesh = buildYarnTubeGeometry({ path: sampled, frames, radiusA: parameters.radiusMm,
        radialSegments: parameters.radialSegments, capEnds: false, uvRepeatLength: 1 });
      if (frames.status !== 'OK' || mesh.status !== 'OK') throw new Error(`TEMPLATE_TUBE_${name}:${JSON.stringify(mesh.diagnostics)}`);
      // Freeze small shared attributes once, avoiding a full snapshot copy for each cell.
      for (const field of ['normals', 'tangents', 'uv', 'indices']) mesh[field] = Object.freeze(Array.from(mesh[field]));
      prototypes.set(name, { sampled, mesh });
    }
    const append = (cell, name, geometryRole, extraProvenance = {}) => {
      const { operation: op, strand } = cell, prototype = prototypes.get(name);
      const offset = [op.needle * pitch, op.row * .85 * pitch, strand.yarnIndex * .10 * pitch];
      const translate = point => point.map((value, axis) => value + offset[axis]);
      const positions = Object.freeze(Array.from(prototype.mesh.positions, (value, i) => value + offset[i % 3]));
      const geometry = Object.freeze({ ...prototype.mesh, positions, bounds: {
        min: translate(prototype.mesh.bounds.min), max: translate(prototype.mesh.bounds.max) } });
      const id = `${identity.key}/visual:${key(op.row, op.needle, strand.yarnIndex)}:${name}`;
      const centerline = Object.freeze({ status: 'OK', unit: 'mm', closed: false,
        points: Object.freeze(prototype.sampled.points.map(point => Object.freeze(translate(point)))),
        tangents: prototype.sampled.tangents, evidenceStatus: 'VISUAL_ASSUMPTION' });
      const path = Object.freeze({ id, linkId: cell.sourceLinks[0].id, yarnId: strand.yarnId, yarnIndex: strand.yarnIndex,
        feedIndex: op.feedIndex, row: op.row, needle: op.needle, operation: op.operation,
        template: name === 'T' ? 'TUCK_WITH_HELD_LOOP' : name === 'M' ? 'MISS_FLOAT_NONZERO' : name,
        geometryRole, evidenceStatus: 'VISUAL_ASSUMPTION', physicalContinuity: 'UNKNOWN', physicalLengthEligible: false,
        contactSolverEligible: false, centerline, provenance: { ...cell.provenance, ...extraProvenance,
          section: sectionEvidence, template: templateEvidence, weldPolicy: 'NONE; INDEPENDENT_OCCURRENCE_REFERENCES' } });
      const item = Object.freeze({ id, geometry, geometryRole, evidenceStatus: 'VISUAL_ASSUMPTION',
        material: { color: geometryRole === 'VISUAL_TRANSITION' ? [.82, .40, .12] :
          strand.yarnIndex === 0 ? [.87, .57, .28] : [.27, .66, .80] } });
      paths.push(path); scene.push(item);
      if (geometryRole === 'STITCH_VISUAL_TEMPLATE') evidenceScene.push(item);
    };
    for (const cell of cells.values()) {
      const op = cell.operation;
      append(cell, op.operation, 'STITCH_VISUAL_TEMPLATE');
      if (op.operation === 'T') {
        // Held-loop existence/shape is explicit display evidence, never an extra
        // physical yarn segment. At the lower boundary its origin remains unknown.
        let heldFrom = null;
        for (let row = op.row - 1; row >= 0 && !heldFrom; row--) {
          const previous = cells.get(key(row, op.needle, cell.strand.yarnIndex));
          if (previous?.operation.operation === 'K') heldFrom = previous;
        }
        append(cell, 'HELD', 'HELD_LOOP_VISUAL', { heldFromOccurrenceIds: heldFrom?.provenance.occurrenceIds ?? [],
          heldOrigin: heldFrom ? 'EARLIER_SOFTWARE_K; HOLD_SHAPE_UNCONFIRMED' : 'OUTSIDE_WINDOW_UNKNOWN' });
      }
      const next = cells.get(key(op.row, op.needle + 1, cell.strand.yarnIndex));
      if (next && next.strand.assignmentId === cell.strand.assignmentId) append(cell, 'TRANSITION', 'VISUAL_TRANSITION', {
        transitionToOccurrenceIds: next.provenance.occurrenceIds, transitionToLinkIds: next.provenance.linkIds,
        transitionReason: 'DISPLAY_GAP_ONLY; NOT_A_JOINED_YARNCHAIN; EXCLUDED_FROM_LENGTH_AND_CONTACT' });
      coverage.generatedAssignments++;
    }
  } catch (error) { return invalid(`VISUAL_GEOMETRY_FAILED:${error.message}`); }
  coverage.generatedCells = coverage.validCells;
  return finish('OK', { paths: Object.freeze(paths), scene: Object.freeze(scene), evidenceScene: Object.freeze(evidenceScene), coverage,
    counts: { meshes: scene.length, templates: evidenceScene.length,
      transitions: paths.filter(item => item.geometryRole === 'VISUAL_TRANSITION').length,
      heldVisuals: paths.filter(item => item.geometryRole === 'HELD_LOOP_VISUAL').length,
      triangles: scene.reduce((sum, item) => sum + item.geometry.counts.triangles, 0),
      physicalConfirmedChains: continuity.counts.byEdgeType.PHYSICAL_YARN_CONTINUITY_CONFIRMED },
    diagnostics: [{ code: 'VISUAL_ASSUMPTIONS_ONLY', message: 'No physical length, collision, supply continuity, contact order or fabric scale is established. Independent open templates and transitions; no CN welding or tiling.' }] });
}

const VISUAL_TRIM_POLICY = 'DISPLAY_ATTACHMENT_SURFACE_NONINTERSECTION; VISUAL_ASSUMPTION_ONLY';
const sameSourceIds = (a, b) => Array.isArray(a) && Array.isArray(b) &&
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const visualCellKey = p => `${p.row}:${p.needle}:${p.yarnIndex}:${p.feedIndex}:${p.yarnId}`;

/** Plan only against the complete audit of this exact immutable swatch. A
 * display attachment contract does not resolve its physical spatial relation.
 * Unrelated UNKNOWN findings veto any change to that decorative transition.
 */
export function planAuditedVisualTransitionTrims(swatch, audit) {
  const plan = { status: 'REJECTED', policy: VISUAL_TRIM_POLICY, physicalRelation: 'UNKNOWN',
    eligible: [], skipped: [], eligibleCount: 0, skippedCount: 0 };
  if (!isAuditForGeometry(audit, swatch) || swatch?.status !== 'OK' ||
    swatch.mode !== 'FULL_WINDOW_VISUAL_SWATCH_TEST_ONLY') return { ...plan, reason: 'COMPLETE_CURRENT_GEOMETRY_AUDIT_REQUIRED' };
  const templates = new Map(swatch.paths.filter(p => p.geometryRole === 'STITCH_VISUAL_TEMPLATE').map(p => [visualCellKey(p), p]));
  const findingsByPath = new Map();
  for (const finding of audit.findings) for (const id of new Set(finding.sourcePathIds)) {
    if (!findingsByPath.has(id)) findingsByPath.set(id, []);
    findingsByPath.get(id).push(finding);
  }
  for (const path of swatch.paths.filter(p => p.geometryRole === 'VISUAL_TRANSITION')) {
    const left = templates.get(visualCellKey(path)), right = templates.get(visualCellKey({ ...path, needle: path.needle + 1 }));
    let reason = null;
    if (path.visualCorrection) reason = 'ALREADY_DISPLAY_TRIMMED';
    else if (!left || !right || path.evidenceStatus !== 'VISUAL_ASSUMPTION' || path.physicalContinuity !== 'UNKNOWN' ||
      path.physicalLengthEligible !== false || path.contactSolverEligible !== false ||
      path.provenance?.transitionReason !== 'DISPLAY_GAP_ONLY; NOT_A_JOINED_YARNCHAIN; EXCLUDED_FROM_LENGTH_AND_CONTACT' ||
      !sameSourceIds(path.provenance.occurrenceIds, left.provenance.occurrenceIds) ||
      !sameSourceIds(path.provenance.linkIds, left.provenance.linkIds) ||
      !sameSourceIds(path.provenance.transitionToOccurrenceIds, right.provenance.occurrenceIds) ||
      !sameSourceIds(path.provenance.transitionToLinkIds, right.provenance.linkIds)) reason = 'UNPROVEN_DISPLAY_ENDPOINT_REFERENCES';
    const findings = findingsByPath.get(path.id) ?? [];
    const endpoints = new Set([left?.id, right?.id]);
    const unrelated = findings.filter(f => f.sourcePathIds.length !== 2 ||
      !f.sourcePathIds.some(id => id !== path.id && endpoints.has(id)));
    if (!reason && unrelated.some(f => f.classification === 'VALID_INTERLOCK')) reason = 'PROTECTED_INTERLOCK_RELATION';
    if (!reason && unrelated.some(f => f.classification === 'UNKNOWN_INTERSECTION')) reason = 'UNRELATED_UNKNOWN_RELATION';
    if (!reason && unrelated.some(f => f.classification !== 'VISUAL_OVERLAP')) reason = 'UNRELATED_PROTECTED_GEOMETRY_RELATION';
    const evidence = [left, right].map(endpoint => findings.find(f =>
      f.geometryEvidence.kind === 'SURFACE_CROSSING' && f.sourcePathIds.includes(endpoint?.id)));
    if (!reason && evidence.some(f => !f)) reason = 'STRICT_ENDPOINT_SURFACE_CROSSING_REQUIRED';
    if (reason) plan.skipped.push({ pathId: path.id, reason });
    else plan.eligible.push({ pathId: path.id, leftPathId: left.id, rightPathId: right.id,
      evidenceFindingIds: evidence.map(f => f.id) });
  }
  plan.eligibleCount = plan.eligible.length; plan.skippedCount = plan.skipped.length;
  plan.status = plan.eligibleCount ? 'READY' : 'NO_CHANGE';
  plan.counts = { transitions: plan.eligibleCount + plan.skippedCount, eligible: plan.eligibleCount, skipped: plan.skippedCount };
  return plan;
}

/** Finite display-only subtraction from a proven straight transition. The
 * existing sampler / transport / tube builder remains the sole constructor.
 * K/T/M/HELD, occurrence/link/chain IDs and original sources remain unchanged.
 */
export function applyAuditedVisualTransitionTrims(swatch, audit, options = {}) {
  const plan = planAuditedVisualTransitionTrims(swatch, audit);
  const report = { ...plan, applied: 0, corrections: [], skipped: [...plan.skipped] };
  if (plan.status !== 'READY') return { status: plan.status === 'REJECTED' ? 'REJECTED' : 'NO_CHANGE', swatch, report };
  const pathsById = new Map(swatch.paths.map(p => [p.id, p]));
  const sceneById = new Map(swatch.scene.map(item => [item.id, item]));
  const changedPaths = new Map(), changedItems = new Map();
  const xBoundsByMesh = new Map();
  const xBounds = mesh => {
    if (!xBoundsByMesh.has(mesh)) {
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < mesh.positions.length; i += 3) { min = Math.min(min, mesh.positions[i]); max = Math.max(max, mesh.positions[i]); }
      xBoundsByMesh.set(mesh, { min, max });
    }
    return xBoundsByMesh.get(mesh);
  };
  const separationMm = .00001; // Numerical display separation, not a physical measurement.
  for (const candidate of plan.eligible) {
    if (Array.isArray(options.pathIds) && !options.pathIds.includes(candidate.pathId)) continue;
    const path = pathsById.get(candidate.pathId), item = sceneById.get(path.id), original = item.geometry;
    const left = sceneById.get(candidate.leftPathId)?.geometry, right = sceneById.get(candidate.rightPathId)?.geometry;
    const points = path.centerline.points, origin = points[0], last = points.at(-1), radius = path.provenance.section?.value;
    const fail = reason => report.skipped.push({ pathId: path.id, reason });
    if (!left || !right || path.centerline.closed || points.length !== original.counts.rings || original.counts.caps ||
      !Number.isFinite(radius) || radius !== swatch.parameters.radiusMm || last[0] <= origin[0] ||
      points.some((p, i) => p[1] !== origin[1] || p[2] !== origin[2] || i && p[0] <= points[i - 1][0])) {
      fail('STRAIGHT_OPEN_UNCHANGED_SECTION_REQUIRED'); continue;
    }
    const stride = original.counts.radialSegments + 1;
    if (Array.from(original.positions).some((v, i) => i % 3 ? v !== original.positions[i % (stride * 3)] :
      v !== original.positions[Math.floor(i / (stride * 3)) * stride * 3])) {
      fail('ORIGINAL_STRAIGHT_PRISM_SECTION_REQUIRED'); continue;
    }
    const leftX = xBounds(left), rightX = xBounds(right), originalX = xBounds(original);
    const startX = leftX.max + separationMm, endX = rightX.min - separationMm;
    if (!(startX > origin[0] && endX < last[0] && endX > startX)) { fail('NO_PROVEN_RETAINED_SUBINTERVAL'); continue; }
    const startDelta = startX - origin[0];
    const sampled = buildSpatialPath({ type: 'line', points: [[startDelta, 0, 0], [endX - origin[0], 0, 0]], unit: 'mm', closed: false },
      { sampleCount: points.length });
    const frames = buildParallelTransportFrames(sampled);
    const rebuilt = buildYarnTubeGeometry({ path: sampled, frames, radiusA: radius,
      radialSegments: original.counts.radialSegments, capEnds: false, uvRepeatLength: 1 });
    if (sampled.status !== 'OK' || frames.status !== 'OK' || rebuilt.status !== 'OK' ||
      rebuilt.positions.length !== original.positions.length || rebuilt.indices.some((v, i) => v !== original.indices[i]) ||
      rebuilt.normals.some((v, i) => v !== original.normals[i]) || rebuilt.tangents.some((v, i) => v !== original.tangents[i])) {
      fail('EXISTING_TUBE_OR_SECTION_INVARIANT_FAILED'); continue;
    }
    // Keep exact old cross-section coordinates. Rebuilt X lies strictly within
    // the old prism, with identical radial phase: retained surface is a subset.
    const positions = Object.freeze(Array.from(rebuilt.positions, (v, i) => i % 3 ? original.positions[i] : v + origin[0]));
    const minX = Math.min(...positions.filter((_, i) => i % 3 === 0)), maxX = Math.max(...positions.filter((_, i) => i % 3 === 0));
    if (!(minX > leftX.max && maxX < rightX.min && minX >= originalX.min && maxX <= originalX.max)) {
      fail('EXACT_MESH_SEPARATION_OR_SUBSET_FAILED'); continue;
    }
    const centerline = Object.freeze({ ...path.centerline,
      points: Object.freeze(sampled.points.map(p => Object.freeze(p.map((v, axis) => v + origin[axis])))) });
    const originalXYZArcMm = last[0] - origin[0], correctedXYZArcMm = sampled.totalLength;
    const proof = { method: 'EXACT_X_BOUNDS_SEPARATION_AND_ORIGINAL_STRAIGHT_SURFACE_SUBSET',
      leftClearanceMm: minX - leftX.max, rightClearanceMm: rightX.min - maxX,
      unchangedSectionAndRadialPhase: true, newSurfaceSubsetOfOriginal: true,
      uvPolicy: 'ORIGINAL_ALONG_YARN_ORIGIN_RETAINED; CIRCUMFERENTIAL_V_UNCHANGED',
      numericSeparation: { value: separationMm, unit: 'mm', source: 'Round11 finite display trim tolerance',
        derivationPrinciple: 'Positive numerical separation of sampled display meshes, not physical spacing',
        confidence: 'TEST_ONLY', applicableState: 'VISUAL_ASSUMPTION_ONLY' } };
    const correction = Object.freeze({ ...candidate, policy: VISUAL_TRIM_POLICY,
      classification: 'UNEXPECTED_INTERSECTION', evidenceScope: 'VISUAL_ASSUMPTION_ENDPOINT_ATTACHMENT_ONLY', physicalRelation: 'UNKNOWN',
      originalCenterline: path.centerline, originalGeometry: original, correctedCenterline: centerline,
      originalXYZArcMm, correctedXYZArcMm, deltaXYZArcMm: correctedXYZArcMm - originalXYZArcMm,
      originalPolylineMm: originalXYZArcMm, correctedPolylineMm: correctedXYZArcMm,
      lengthMeaning: 'Exact straight XYZ display arc only; not Solver, M1/M3 or physical yarn length',
      section: path.provenance.section, proof });
    const geometry = Object.freeze({ ...rebuilt, positions, normals: original.normals, tangents: original.tangents, indices: original.indices,
      uv: Object.freeze(Array.from(rebuilt.uv, (v, i) => i % 2 ? original.uv[i] : v + startDelta)),
      bounds: { min: [minX, original.bounds.min[1], original.bounds.min[2]], max: [maxX, original.bounds.max[1], original.bounds.max[2]] } });
    changedPaths.set(path.id, Object.freeze({ ...path, centerline, visualCorrection: correction }));
    changedItems.set(path.id, Object.freeze({ ...item, geometry }));
    report.corrections.push(correction);
  }
  report.applied = report.corrections.length; report.skippedCount = report.skipped.length;
  if (!report.applied) return { status: 'NO_CHANGE', swatch, report };
  const corrected = Object.freeze({ ...swatch,
    paths: Object.freeze(swatch.paths.map(path => changedPaths.get(path.id) ?? path)),
    scene: Object.freeze(swatch.scene.map(item => changedItems.get(item.id) ?? item)),
    visualCorrectionReport: report });
  return { status: 'APPLIED', swatch: corrected, report };
}

// Round11.1 is a single explicit visual-connection experiment. These tolerances
// precede the candidate: Float32 tube positions, mm coordinates, and the existing
// tube frame tolerance. They are not physical manufacturing tolerances.
const JOINT_POSITION_MM = 1e-5;
const JOINT_ANGLE_DEGREES = .001;
const jointVector = (array, i) => Array.from(array.slice(i * 3, i * 3 + 3));
const jointAngle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(normalize(a), normalize(b))))) * 180 / Math.PI;
const jointRingStart = (mesh, end) => (end ? mesh.counts.rings - 1 : 0) * (mesh.counts.radialSegments + 1);

function jointInterface(a, endA, b, endB, tangentA, tangentB) {
  const count = a.counts.radialSegments + 1, ai = jointRingStart(a, endA), bi = jointRingStart(b, endB);
  const maximum = field => Math.max(...Array.from({ length: count }, (_, k) =>
    distance(jointVector(a[field], ai + k), jointVector(b[field], bi + k))));
  return { mapping: 'pi(k)=k; duplicated circumferential UV vertices map to k=0',
    maxRingErrorMm: maximum('positions'), tangentAngleDegrees: jointAngle(tangentA, tangentB),
    maxNormalError: maximum('normals'), maxMaterialTangentError: maximum('tangents'),
    uv: { policy: 'Independent metric material charts; geometric equivalence does not assert identical U phase',
      uBefore: a.uv[ai * 2], uAfter: b.uv[bi * 2],
      maxVError: Math.max(...Array.from({ length: count }, (_, k) => Math.abs(a.uv[(ai + k) * 2 + 1] - b.uv[(bi + k) * 2 + 1]))) } };
}

// Only declared tube UV duplicates and the two measured interfaces are mapped.
// No nearest-vertex/global welding and no source/CN/YarnChain merging occurs.
function jointBoundaryAudit(left, bridge, right) {
  const meshes = [left, bridge, right], n = bridge.counts.radialSegments, edges = new Map();
  let degenerateTriangles = 0, inwardTriangles = 0;
  const canonical = (part, vertex) => {
    const ring = Math.floor(vertex / (n + 1)), radial = vertex % (n + 1) % n;
    if (part === 0 && ring === left.counts.rings - 1 || part === 1 && ring === 0) return `L:${radial}`;
    if (part === 1 && ring === bridge.counts.rings - 1 || part === 2 && ring === 0) return `R:${radial}`;
    return `${part}:${ring}:${radial}`;
  };
  meshes.forEach((mesh, part) => {
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const indices = Array.from(mesh.indices.slice(i, i + 3));
      const [a, b, c] = indices.map(index => jointVector(mesh.positions, index));
      const normal = cross(subtract(b, a), subtract(c, a));
      if (dot(normal, normal) === 0) degenerateTriangles++;
      if (dot(normal, indices.map(index => jointVector(mesh.normals, index)).reduce(add, [0, 0, 0])) <= 0) inwardTriangles++;
      const names = indices.map(index => canonical(part, index));
      for (let k = 0; k < 3; k++) {
        const key = [names[k], names[(k + 1) % 3]].sort().join('|');
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
  });
  const boundary = [...edges].filter(([, count]) => count === 1).map(([key]) => key);
  const outer = new Set();
  for (const [part, ring] of [[0, 0], [2, right.counts.rings - 1]]) for (let k = 0; k < n; k++) {
    outer.add([`${part}:${ring}:${k}`, `${part}:${ring}:${(k + 1) % n}`].sort().join('|'));
  }
  return { boundaryEdges: boundary.length, expectedOpenOuterBoundaryEdges: 2 * n,
    unexplainedBoundaryEdges: boundary.filter(key => !outer.has(key)).length,
    nonManifoldEdges: [...edges.values()].filter(count => count > 2).length,
    internalCaps: meshes.reduce((sum, mesh) => sum + mesh.counts.caps, 0), degenerateTriangles, inwardTriangles,
    equivalence: 'Only each tube UV seam and the two exact pi(k)=k interfaces; true outer open ends retained' };
}

/** One opt-in display joint, using the existing sampler, transport, tube and audit.
 * No default/batch repair, no authoritative curve or physical relation change.
 * A complete report for this exact G0 and explicit source connection are required.
 */
export async function buildAuditedVisualJointCandidate(swatch, audit, options = {}) {
  const report = { status: 'REJECTED', scope: 'ROUND11_1_SINGLE_TK_VISUAL_JOINT', targetPathId: options.pathId,
    evidenceStatus: 'VISUAL_ASSUMPTION', physicalRelation: 'UNKNOWN', physicalLengthEligible: false,
    positionToleranceMm: JOINT_POSITION_MM, angleToleranceDegrees: JOINT_ANGLE_DEGREES,
    toleranceBasis: 'Existing Float32 tube storage and frame checks; fixed before this case', targeted: 1, passed: 0, skipped: 0 };
  const reject = (reason, status = 'REJECTED') => ({ status, swatch, report: { ...report, status, reason } });
  if (options.isCancelled?.()) return reject('CANCELLED', 'CANCELLED');
  if (!isAuditForGeometry(audit, swatch) || swatch?.mode !== 'FULL_WINDOW_VISUAL_SWATCH_TEST_ONLY') return reject('COMPLETE_CURRENT_G0_AUDIT_REQUIRED');
  const path = swatch.paths.find(p => p.id === options.pathId);
  const templates = new Map(swatch.paths.filter(p => p.geometryRole === 'STITCH_VISUAL_TEMPLATE').map(p => [visualCellKey(p), p]));
  const left = path && templates.get(visualCellKey(path)), right = path && templates.get(visualCellKey({ ...path, needle: path.needle + 1 }));
  // The first measured failure is the only eligible rollout target in this round.
  if (!path || path.row !== 22 || path.needle !== 16 || path.yarnIndex !== 1 ||
    path.geometryRole !== 'VISUAL_TRANSITION' || left?.operation !== 'T' || right?.operation !== 'K') return reject('OUTSIDE_SINGLE_MEASURED_TK_CASE');
  if (path.visualCorrection || path.visualJoint || swatch.visualJointReport || path.evidenceStatus !== 'VISUAL_ASSUMPTION' ||
    path.physicalContinuity !== 'UNKNOWN' || path.physicalLengthEligible !== false || path.contactSolverEligible !== false ||
    path.provenance?.transitionReason !== 'DISPLAY_GAP_ONLY; NOT_A_JOINED_YARNCHAIN; EXCLUDED_FROM_LENGTH_AND_CONTACT' ||
    !sameSourceIds(path.provenance.occurrenceIds, left.provenance.occurrenceIds) ||
    !sameSourceIds(path.provenance.linkIds, left.provenance.linkIds) ||
    !sameSourceIds(path.provenance.transitionToOccurrenceIds, right.provenance.occurrenceIds) ||
    !sameSourceIds(path.provenance.transitionToLinkIds, right.provenance.linkIds)) return reject('UNPROVEN_OR_ALREADY_CHANGED_VISUAL_CONNECTION');
  const byId = new Map(swatch.scene.map(item => [item.id, item]));
  const original = byId.get(path.id)?.geometry, aMesh = byId.get(left.id)?.geometry, bMesh = byId.get(right.id)?.geometry;
  const radius = path.provenance.section?.value, n = original?.counts.radialSegments;
  if (![original, aMesh, bMesh].every(m => m?.status === 'OK' && m.counts.caps === 0 && m.counts.radialSegments === n) ||
    ![path, left, right].every(p => !p.centerline.closed && p.provenance.section?.value === radius) ||
    radius !== swatch.parameters.radiusMm || !Number.isFinite(radius) || radius <= 0) return reject('OPEN_EQUAL_SECTION_INTERFACES_REQUIRED');
  const p0 = left.centerline.points.at(-1), p1 = right.centerline.points[0];
  const t0 = normalize(left.centerline.tangents.at(-1)), t1 = normalize(right.centerline.tangents[0]);
  if (distance(p0, path.centerline.points[0]) > JOINT_POSITION_MM || distance(p1, path.centerline.points.at(-1)) > JOINT_POSITION_MM) return reject('ORIGINAL_TRUE_ENDPOINT_CONNECTION_REQUIRED');
  report.originalInterfaces = { left: jointInterface(aMesh, true, original, false, t0, path.centerline.tangents[0]),
    right: jointInterface(original, true, bMesh, false, path.centerline.tangents.at(-1), t1) };
  report.source = { leftPathId: left.id, rightPathId: right.id, occurrenceIds: path.provenance.occurrenceIds,
    linkIds: path.provenance.linkIds, toOccurrenceIds: path.provenance.transitionToOccurrenceIds,
    toLinkIds: path.provenance.transitionToLinkIds, chainIds: path.provenance.chainIds, feedIndex: path.feedIndex, yarnId: path.yarnId,
    cnIndices: path.provenance.cnIndices, operationSource: path.provenance.operationSource,
    left: { chainIds: left.provenance.chainIds, cnIndices: left.provenance.cnIndices, operationSource: left.provenance.operationSource },
    right: { chainIds: right.provenance.chainIds, cnIndices: right.provenance.cnIndices, operationSource: right.provenance.operationSource } };
  const chord = subtract(p1, p0), length = distance(p0, p1), forward = normalize(chord);
  if (!Number.isFinite(length) || length <= 2 * radius || dot(t0, forward) <= 0 || dot(t1, forward) <= 0) return reject('FIXED_RADIUS_ENDPOINT_CONDITION_INFEASIBLE');
  // The existing cubic implementation checks stationary parameters and supplies
  // the same integration / resampling used for other spatial paths.
  const m0 = scale(t0, length), m1 = scale(t1, length);
  const sampled = buildSpatialPath({ type: 'hermite', unit: 'mm', closed: false, points: [p0, p1],
    tangents: [m0, m1] }, { sampleCount: swatch.parameters.sampleCount });
  if (sampled.status !== 'OK') return reject('EXISTING_PATH_BUILDER_REJECTED');
  const transported = buildParallelTransportFrames(sampled);
  if (transported.status !== 'OK') return reject('EXISTING_FRAME_BUILDER_REJECTED');
  const ringNormal = (mesh, end, center, tangent) => {
    const v = subtract(jointVector(mesh.positions, jointRingStart(mesh, end)), center);
    return normalize(subtract(v, scale(tangent, dot(v, tangent))));
  };
  const targetNormals = [ringNormal(aMesh, true, p0, t0), ringNormal(bMesh, false, p1, t1)];
  const phase = (a, b, t) => Math.atan2(dot(t, cross(a, b)), dot(a, b));
  const startPhase = phase(transported.frames[0].normal, targetNormals[0], t0);
  const anchored = transported.frames.map(f => ({ ...f, normal: rotate(f.normal, f.tangent, startPhase) }));
  const residualPhase = phase(anchored.at(-1).normal, targetNormals[1], t1);
  const frames = anchored.map((f, i) => {
    const normal = normalize(rotate(f.normal, f.tangent, residualPhase * sampled.cumulativeLengths[i] / sampled.totalLength));
    return { ...f, normal, binormal: normalize(cross(f.tangent, normal)) };
  });
  const built = buildYarnTubeGeometry({ path: sampled, frames, radiusA: radius, radialSegments: n, capEnds: false, uvRepeatLength: 1 });
  if (built.status !== 'OK') { report.geometryDiagnostics = built.diagnostics; return reject('FIXED_RADIUS_LOCAL_TUBE_REJECTED'); }
  const positions = Array.from(built.positions), normals = Array.from(built.normals), tangents = Array.from(built.tangents);
  let maximumEndpointQuantizationMm = 0;
  for (const [end, source, sourceEnd] of [[false, aMesh, true], [true, bMesh, false]]) {
    const dest = jointRingStart(built, end), from = jointRingStart(source, sourceEnd);
    for (let k = 0; k <= n; k++) {
      maximumEndpointQuantizationMm = Math.max(maximumEndpointQuantizationMm,
        distance(jointVector(positions, dest + k), jointVector(source.positions, from + k)));
      for (let axis = 0; axis < 3; axis++) {
        positions[(dest + k) * 3 + axis] = source.positions[(from + k) * 3 + axis];
        normals[(dest + k) * 3 + axis] = source.normals[(from + k) * 3 + axis];
        tangents[(dest + k) * 3 + axis] = source.tangents[(from + k) * 3 + axis];
      }
    }
  }
  if (maximumEndpointQuantizationMm > JOINT_POSITION_MM) return reject('END_RING_PHASE_OR_SECTION_INCOMPATIBLE');
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  positions.forEach((v, i) => { bounds.min[i % 3] = Math.min(bounds.min[i % 3], v); bounds.max[i % 3] = Math.max(bounds.max[i % 3], v); });
  const mesh = Object.freeze({ ...built, positions: Object.freeze(positions), normals: Object.freeze(normals),
    tangents: Object.freeze(tangents), uv: Object.freeze(Array.from(built.uv)), indices: Object.freeze(Array.from(built.indices)), bounds });
  report.interfaces = { left: jointInterface(aMesh, true, mesh, false, t0, sampled.tangents[0]),
    right: jointInterface(mesh, true, bMesh, false, sampled.tangents.at(-1), t1) };
  report.frame = { method: 'Existing parallel transport; start ring phase anchored; residual twist distributed by integrated arc',
    startPhaseRadians: startPhase, residualPhaseRadians: residualPhase, maximumEndpointQuantizationMm, frames };
  report.meshIntegrity = jointBoundaryAudit(aMesh, mesh, bMesh);
  if (Object.values(report.interfaces).some(i => i.maxRingErrorMm > JOINT_POSITION_MM || i.tangentAngleDegrees > JOINT_ANGLE_DEGREES) ||
    ['unexplainedBoundaryEdges', 'nonManifoldEdges', 'internalCaps', 'degenerateTriangles', 'inwardTriangles'].some(key => report.meshIntegrity[key])) return reject('INTERFACE_OR_MESH_INTEGRITY_FAILED');
  report.section = path.provenance.section;
  report.arcLengthMm = sampled.totalLength; report.originalArcLengthMm = length;
  report.deltaArcLengthMm = sampled.totalLength - length;
  report.lengthMeaning = 'Derived visual bridge integrated XYZ arc; excluded from Solver/M1/M3/physical YarnChain';
  report.controls = { leftEndpoint: p0, rightEndpoint: p1, leftDerivative: m0, rightDerivative: m1, unit: 'mm', source: 'Existing visual endpoint positions and tangent directions', confidence: 'TEST_ONLY', applicableState: 'VISUAL_ASSUMPTION_ONLY' };
  const centerline = Object.freeze({ ...path.centerline, points: Object.freeze(sampled.points.map(p => Object.freeze(p))),
    tangents: Object.freeze(sampled.tangents.map(t => Object.freeze(t))), cumulativeLengths: Object.freeze(sampled.cumulativeLengths), totalLength: sampled.totalLength });
  const joint = Object.freeze({ evidenceStatus: 'VISUAL_ASSUMPTION', physicalRelation: 'UNKNOWN', leftPathId: left.id, rightPathId: right.id,
    originalCenterline: path.centerline, originalGeometry: original, arcLengthMm: sampled.totalLength,
    interfaces: report.interfaces, framePolicy: report.frame.method });
  const changedPath = Object.freeze({ ...path, centerline, visualJoint: joint });
  const changedItem = Object.freeze({ ...byId.get(path.id), geometry: mesh });
  const candidate = { ...swatch, paths: Object.freeze(swatch.paths.map(p => p.id === path.id ? changedPath : p)),
    scene: Object.freeze(swatch.scene.map(item => item.id === path.id ? changedItem : item)),
    counts: { ...swatch.counts, triangles: swatch.counts.triangles + mesh.counts.triangles - original.counts.triangles } };
  // Exhaustive AABB selection from the ENTIRE visible scene, including both yarns
  // and held loops. This limits only the review workload, never renderer geometry.
  const localIds = new Set([path.id, left.id, right.id]);
  for (const item of candidate.scene) if ([0, 1, 2].every(k => item.geometry.bounds.min[k] <= bounds.max[k] + 2 * radius &&
    item.geometry.bounds.max[k] >= bounds.min[k] - 2 * radius)) localIds.add(item.id);
  const local = { ...candidate, paths: candidate.paths.filter(p => localIds.has(p.id)), scene: candidate.scene.filter(p => localIds.has(p.id)) };
  const checked = await auditYarnGeometry(local, { isCancelled: options.isCancelled, yieldControl: options.yieldControl });
  if (options.isCancelled?.() || checked.status === 'CANCELLED') return reject('CANCELLED', 'CANCELLED');
  if (checked.status !== 'COMPLETE') return reject('LOCAL_AUDIT_INCOMPLETE');
  const strict = records => records.filter(f => f.geometryEvidence.kind === 'SURFACE_CROSSING' && f.sourcePathIds.includes(path.id));
  const before = strict(audit.findings), after = strict(checked.findings);
  const key = f => JSON.stringify([...f.sourcePathIds].sort()), previous = new Set(before.map(key));
  report.intersections = { beforeTargetStrictCrossings: before.length, afterTargetStrictCrossings: after.length,
    newRelatedStrictCrossings: after.filter(f => !previous.has(key(f))).length, removedTargetStrictCrossings: before.filter(f => !after.some(g => key(g) === key(f))).length,
    localSourceIds: [...localIds], localAudit: checked, exclusions: 'NONE; shared interface touches retain existing geometric classification',
    limitation: 'Open surfaces; no closed volume containment or physical interlock claim' };
  if (after.length) return reject('TARGET_SURFACE_CROSSING_REMAINS');
  report.status = 'APPLIED'; report.passed = 1;
  return { status: 'APPLIED', swatch: Object.freeze({ ...candidate, visualJointReport: report }), report };
}
