import { subtract, dot, cross, magnitude, distance } from './yarnSpatialMath.js';

// Read-only queries on the existing sampled Tube Geometry. No path construction,
// CN interpretation, material physics, or rendering lives in this module.
const CLASSES = ['VALID_INTERLOCK', 'UNEXPECTED_INTERSECTION', 'VISUAL_OVERLAP', 'UNKNOWN_INTERSECTION'];
const completedInputs = new WeakMap();
// Existing swatch controller replaces derived geometry on every input change.
// Correction requires the exact in-memory report and exact derived object;
// serialized or fabricated reports deliberately carry no repair authority.
export const isAuditForGeometry = (report, swatch) => !!report && report.status === 'COMPLETE' && completedInputs.get(report) === swatch;
const vector = (a, i) => [a[3 * i], a[3 * i + 1], a[3 * i + 2]];
const clamp = x => Math.max(0, Math.min(1, x));
const pairKey = (a, b) => a < b ? `${a.length}:${a}${b.length}:${b}` : `${b.length}:${b}${a.length}:${a}`;
const overlaps = (a, b, dimensions, e) => {
  for (let k = 0; k < dimensions; k++) if (a.min[k] > b.max[k] + e || b.min[k] > a.max[k] + e) return false;
  return true;
};

// Same orientation predicate as the existing Tube Geometry validation, without
// allocating triangle objects for the complete mesh-integrity pass.
function triangleIsOutward(mesh, t) {
  const p = mesh.positions, n = mesh.normals, a = mesh.indices[t * 3] * 3, b = mesh.indices[t * 3 + 1] * 3, c = mesh.indices[t * 3 + 2] * 3;
  const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
  const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const orientation = nx * (n[a] + n[b] + n[c]) + ny * (n[a + 1] + n[b + 1] + n[c + 1]) + nz * (n[a + 2] + n[b + 2] + n[c + 2]);
  return Number.isFinite(orientation) && orientation > 0;
}

// Closest points of two closed segments, including degenerate/parallel cases.
// Geometric Tools distance-query formulation: minimize a convex quadratic on [0,1]^2.
export function segmentDistance(a, b, c, d) {
  const u = subtract(b, a), v = subtract(d, c), w = subtract(a, c);
  const aa = dot(u, u), bb = dot(u, v), cc = dot(v, v), dd = dot(u, w), ee = dot(v, w);
  let s = 0, t = 0, separationReliable = true;
  if (aa === 0) t = cc ? clamp(ee / cc) : 0;
  else if (cc === 0) s = clamp(-dd / aa);
  else {
    const denominator = aa * cc - bb * bb;
    // A parallel fallback is not a lower-bound certificate for almost-parallel
    // segments (long segments can cross in their interiors). Keep the numeric
    // witness, but force mesh testing rather than claim clearance in that case.
    separationReliable = denominator > aa * cc * 1e-14 || cross(u, v).every(value => value === 0);
    s = denominator > aa * cc * 1e-14 ? clamp((bb * ee - cc * dd) / denominator) : 0;
    t = (bb * s + ee) / cc;
    if (t < 0) { t = 0; s = clamp(-dd / aa); }
    else if (t > 1) { t = 1; s = clamp((bb - dd) / aa); }
  }
  const first = a.map((x, k) => x + s * u[k]), second = c.map((x, k) => x + t * v[k]);
  return { distance: distance(first, second), first, second, s, t, separationReliable };
}

function triangle(mesh, index) {
  const k = index * 3, points = [0, 1, 2].map(j => vector(mesh.positions, mesh.indices[k + j]));
  return triangleRecord(points);
}

function triangleRecord(points) {
  const edges = [subtract(points[1], points[0]), subtract(points[2], points[1]), subtract(points[0], points[2])];
  return { points, edges, normal: cross(edges[0], subtract(points[2], points[0])),
    min: [0, 1, 2].map(k => Math.min(...points.map(p => p[k]))), max: [0, 1, 2].map(k => Math.max(...points.map(p => p[k]))) };
}

// Standalone read-only narrowphase entry for numerical regression fixtures.
export const classifyTrianglePair = (pointsA, pointsB, epsilon = 1e-7) => triangleIntersection(triangleRecord(pointsA), triangleRecord(pointsB), epsilon);

// Triangle SAT: face normals, edge cross-products, and in-plane edge normals
// for coplanar triangles. Strict two-sided plane crossings distinguish actual
// transverse surface intersection from tangency / shared rims / coplanarity.
// Reference: Eberly, DynamicCollisionDetection.pdf, section 4 (Geometric Tools).
function triangleIntersection(a, b, epsilon) {
  if (!overlaps(a, b, 3, epsilon)) return null;
  const lengthA = magnitude(a.normal), lengthB = magnitude(b.normal);
  if (!lengthA || !lengthB) return 'DEGENERATE';
  const na = a.normal.map(v => v / lengthA), nb = b.normal.map(v => v / lengthB);
  const da = a.points.map(p => dot(subtract(p, b.points[0]), nb));
  const db = b.points.map(p => dot(subtract(p, a.points[0]), na));
  if ([da, db].some(values => Math.min(...values) > epsilon || Math.max(...values) < -epsilon)) return null;
  const axes = [...a.edges.flatMap(e => b.edges.map(f => cross(e, f))), ...a.edges.map(e => cross(na, e)), ...b.edges.map(e => cross(nb, e))];
  for (const axis of axes) {
    const len = magnitude(axis); if (len < 1e-16) continue;
    const ap = a.points.map(p => dot(p, axis)), bp = b.points.map(p => dot(p, axis));
    if (Math.min(...ap) > Math.max(...bp) + epsilon * len || Math.min(...bp) > Math.max(...ap) + epsilon * len) return null;
  }
  if (![da, db].every(values => Math.min(...values) < -epsilon && Math.max(...values) > epsilon)) return 'TOUCH_OR_COPLANAR';
  // Plane straddling alone still admits a single shared corner: require positive
  // overlap along the intersection line of the two planes, not a point touch.
  const line = cross(na, nb), length = magnitude(line);
  if (!length) return 'TOUCH_OR_COPLANAR';
  const direction = line.map(v => v / length), origin = a.points[0];
  const interval = (points, signed) => {
    const values = [];
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      if (Math.abs(signed[i]) <= epsilon) values.push(dot(subtract(points[i], origin), direction));
      if (signed[i] * signed[j] < 0) {
        const t = signed[i] / (signed[i] - signed[j]);
        const p = points[i].map((v, k) => v + t * (points[j][k] - v));
        values.push(dot(subtract(p, origin), direction));
      }
    }
    return [Math.min(...values), Math.max(...values)];
  };
  const ia = interval(a.points, da), ib = interval(b.points, db);
  return Math.min(ia[1], ib[1]) - Math.max(ia[0], ib[0]) > epsilon ? 'SURFACE_CROSSING' : 'TOUCH_OR_COPLANAR';
}

function projectedCrossing(a, b, epsilon) {
  const [p, q, r, s] = [a.a, a.b, b.a, b.b];
  const ux = q[0] - p[0], uy = q[1] - p[1], vx = s[0] - r[0], vy = s[1] - r[1];
  const denominator = ux * vy - uy * vx;
  if (Math.abs(denominator) < epsilon * epsilon) return false;
  const dx = r[0] - p[0], dy = r[1] - p[1];
  const t = (dx * vy - dy * vx) / denominator, u = (dx * uy - dy * ux) / denominator;
  // Include sampled endpoints: a transverse projected crossing may fall exactly
  // on a centerline sample. Actual 3D clearance is established by the caller.
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function localAdjacency(a, b, source) {
  if (a.mesh !== b.mesh) return false;
  if (Math.abs(a.segment - b.segment) <= 1) return true;
  return source.centerline.closed && Math.abs(a.segment - b.segment) === source.centerline.points.length - 2;
}

/** Diagnostic-only full traversal. The hash operates on existing tube ring-band
 * bounds; only neighbouring bands receive triangle SAT tests. Results aggregate
 * by source pair and evidence kind, preserving witness counts and source IDs.
 * evidence is a caller-supplied TEST_ONLY relation contract, never inferred CN.
 * Default +Z projection is explicit and is not the user's live camera.
 */
export async function auditYarnGeometry(swatch, options = {}) {
  const clock = () => globalThis.performance?.now() ?? Date.now(), started = clock();
  const epsilon = options.epsilon ?? 1e-7, cellSize = options.cellSize ?? .25;
  const yieldControl = options.yieldControl ?? (() => new Promise(resolve => setTimeout(resolve, 0)));
  const statistics = { durationMs: 0, bands: 0, broadphaseCandidates: 0, narrowphaseTests: 0, spatialCells: 0,
    memberships: 0, yields: 0, maxChunkMs: 0, estimatedIndexBytes: 0, skippedLocalAdjacency: 0, examinedMeshTriangles: 0 };
  const heapBefore = globalThis.performance?.memory?.usedJSHeapSize ?? null;
  const sources = {}, findings = new Map(), bands = [], grid = new Map(), pairStates = new Map();
  // A bounded cache of read-only query records avoids reconstructing the same
  // 16 local triangles for each pair test. No translated/prototype equivalence
  // is assumed: cache identity is the actual source band object.
  const triangleCache = new Map();
  const bandTriangles = band => {
    let triangles = triangleCache.get(band);
    if (!triangles) {
      triangles = Array.from({ length: band.end - band.start }, (_, i) => triangle(meshes[band.mesh], band.start + i));
      triangleCache.set(band, triangles);
      if (triangleCache.size > 128) triangleCache.delete(triangleCache.keys().next().value);
    }
    return triangles;
  };
  const relations = new Map((options.evidence ?? []).filter(e => Array.isArray(e?.sourcePathIds) && e.sourcePathIds.length === 2 &&
    e.sourcePathIds.every(id => typeof id === 'string') && e.applicable === 'THIS_GEOMETRY' &&
    typeof e.source === 'string' && e.source.trim()).map(e => [pairKey(...e.sourcePathIds), e]));
  let cancelled = false, invalidInput = false, limited = false, chunkStart = started, work = 0;
  const finish = async status => {
    statistics.spatialCells = grid.size; statistics.bands = bands.length;
    statistics.estimatedIndexBytes = bands.length * (7 * 8 + 4 * 4) + statistics.memberships * 4;
    const result = [...findings.values()], byClassification = Object.fromEntries(CLASSES.map(k => [k, 0])), byRelation = {};
    for (const f of result) {
      byClassification[f.classification]++; byRelation[f.relation] = (byRelation[f.relation] ?? 0) + 1;
      // Freeze only owned diagnostic records. Never freeze source provenance or
      // input mesh arrays as a side effect of a read-only audit.
      if (status === 'COMPLETE') {
        for (const value of Object.values(f.geometryEvidence)) if (Array.isArray(value)) {
          for (const item of value) if (Array.isArray(item)) Object.freeze(item);
          Object.freeze(value);
        }
        Object.freeze(f.geometryEvidence); Object.freeze(f.sourcePathIds); Object.freeze(f);
      }
      if (needsYield()) { await checkpoint('FINALIZE'); if (cancelled) status = 'CANCELLED'; }
    }
    statistics.durationMs = clock() - started;
    statistics.maxChunkMs = Math.max(statistics.maxChunkMs, clock() - chunkStart);
    const report = { status, complete: status === 'COMPLETE', findings: result, sources,
      counts: { findings: result.length, byClassification, byRelation, sourcePaths: Object.keys(sources).length }, statistics,
      memory: { heapBefore, heapAfter: globalThis.performance?.memory?.usedJSHeapSize ?? null,
        meaning: 'Optional browser heap sample is process-wide, not retained audit allocation. Index estimate counts numeric payload only; excludes JS object/string/Map overhead and input mesh.' },
      identity: swatch?.identity ?? null, projection: 'ORTHOGRAPHIC_PLUS_Z_XY; NOT_LIVE_CAMERA',
      limitations: ['Read-only sampled mesh audit; no physical contact or process legality authority.',
        'Open tubes certify surface crossings only, not watertight volume penetration. Close envelopes without crossings remain UNKNOWN, including possible containment.',
        'Touching/coplanar overlaps are UNKNOWN, not automatically errors. Same-mesh adjacent ring bands and the closed seam are excluded as local mesh adjacency.',
        'Findings aggregate by source pair and evidence kind; occurrenceCount counts candidate-band witnesses, not independent physical collisions.',
        'No result upgrades CN_REFERENCE or an unconfirmed YarnChain to contact or legal interlock.'] };
    if (status === 'COMPLETE') { Object.freeze(result); Object.freeze(report); completedInputs.set(report, swatch); }
    return report;
  };
  const needsYield = () => ++work % 32 === 0 && clock() - chunkStart >= 8;
  const checkpoint = async phase => {
    statistics.maxChunkMs = Math.max(statistics.maxChunkMs, clock() - chunkStart);
    options.onProgress?.({ phase, bands: bands.length, candidates: statistics.broadphaseCandidates, findings: findings.size });
    await yieldControl(); statistics.yields++; chunkStart = clock();
    if (options.isCancelled?.()) cancelled = true;
  };
  function addFinding(i, j, kind, witness, classification = null, reason = '') {
    const a = swatch.paths[i], b = swatch.paths[j], pair = pairKey(a.id, b.id), evidence = relations.get(pair);
    const relation = i === j ? 'SELF_NONADJACENT' : a.geometryRole === 'VISUAL_TRANSITION' || b.geometryRole === 'VISUAL_TRANSITION' ? 'VISUAL_TRANSITION' :
      a.yarnId !== b.yarnId ? 'INTER_YARN' : 'NEIGHBOUR_OR_OTHER_PATH';
    if (!classification) classification = kind === 'VISUAL_OVERLAP' ? 'VISUAL_OVERLAP' : kind === 'SURFACE_CROSSING' &&
      (i === j || evidence?.relation === 'NONCONTACT') ? 'UNEXPECTED_INTERSECTION' : 'UNKNOWN_INTERSECTION';
    const id = `${pair}/${kind}`, existing = findings.get(id);
    if (existing) { existing.occurrenceCount++; return; }
    findings.set(id, { id, classification, relation, sourcePathIds: [a.id, b.id], occurrenceCount: 1,
      reason: reason || (classification === 'UNEXPECTED_INTERSECTION' ? 'Proven transverse crossing violates a self/noncontact or independent visual-transition contract; no physical topology conclusion.' :
        classification === 'VISUAL_OVERLAP' ? 'XY projected centerlines cross while 3D swept-radius envelopes are separated.' : 'Geometric evidence does not establish intended physical spatial order.'),
      geometryEvidence: { kind, ...witness }, physicalRelation: 'UNKNOWN', evidenceScope: 'SAMPLED_RENDER_GEOMETRY',
      evidenceSource: evidence?.source ?? 'Existing sampled XYZ path and Tube Geometry; no CN-derived contact' });
  }
  if (swatch?.status !== 'OK' || !Array.isArray(swatch.paths) || !Array.isArray(swatch.scene) || !Number.isFinite(epsilon) || epsilon <= 0 ||
    !Number.isFinite(cellSize) || cellSize <= 0 || swatch.paths.length > 20000) return finish('INVALID');
  if (swatch.paths.some(p => !p || typeof p.id !== 'string') || new Set(swatch.paths.map(p => p.id)).size !== swatch.paths.length ||
    swatch.scene.length !== swatch.paths.length || swatch.scene.some(p => !p || typeof p.id !== 'string') ||
    new Set(swatch.scene.map(p => p.id)).size !== swatch.scene.length) return finish('INVALID');
  const meshById = new Map(swatch.scene.map(item => [item.id, item.geometry])), meshes = [];
  for (let m = 0; m < swatch.paths.length; m++) {
    const path = swatch.paths[m], mesh = meshById.get(path.id), pts = path.centerline?.points, provenance = path.provenance ?? {};
    const validPoints = Array.isArray(pts) && pts.every(p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite));
    sources[path.id] = { id: path.id, occurrenceIds: provenance.occurrenceIds ?? [], linkIds: provenance.linkIds ?? (path.linkId ? [path.linkId] : []),
      chainIds: provenance.chainIds ?? [], feedIndex: path.feedIndex ?? null, yarnId: path.yarnId ?? null, yarnIndex: path.yarnIndex ?? null,
      chainAssociation: provenance.chainIds?.length ? 'SOURCE_CANDIDATE_IDS_NOT_PHYSICAL_CONTINUITY' : 'UNKNOWN_EMPTY', provenance,
      row: path.row ?? null, needle: path.needle ?? null, geometryRole: path.geometryRole ?? 'UNKNOWN',
      geometrySource: path.evidenceStatus ?? 'UNKNOWN', sourceStatus: provenance.sourceStatus ?? 'UNKNOWN', section: provenance.section ?? null,
      centerlinePolylineLength: validPoints ? pts.slice(1).reduce((sum, p, k) => sum + distance(p, pts[k]), 0) : null,
      lengthMeaning: 'Sampled polyline diagnostic in geometry unit, not XYZ curve integral or M1/M3', unit: mesh?.unit ?? null };
    meshes[m] = mesh;
    let issue = null;
    if (!mesh || !validPoints || mesh.unit !== 'mm' || mesh.counts?.rings !== pts.length || !Number.isInteger(mesh.counts?.radialSegments) ||
      mesh.counts.radialSegments < 3 || mesh.counts.radialSegments > 256 || mesh.counts.vertices > 2000000 ||
      !mesh.positions || !mesh.indices || !mesh.normals || pts.length < 2 ||
      mesh.positions.length !== mesh.counts.vertices * 3 || mesh.normals.length !== mesh.positions.length ||
      mesh.indices.length !== mesh.counts.triangles * 3 || ![0, 2].includes(mesh.counts.caps) ||
      mesh.counts.vertices !== pts.length * (mesh.counts.radialSegments + 1) + mesh.counts.caps * (mesh.counts.radialSegments + 2) ||
      mesh.counts.triangles !== (pts.length - 1) * mesh.counts.radialSegments * 2 + mesh.counts.caps * mesh.counts.radialSegments) issue = 'INVALID_TUBE_LAYOUT';
    if (!issue) {
      for (const p of pts) if (p.length !== 3 || !p.every(Number.isFinite)) { issue = 'NONFINITE_CENTERLINE'; break; }
      for (let i = 0; i < mesh.positions.length; i++) {
        if (!Number.isFinite(mesh.positions[i]) || !Number.isFinite(mesh.normals[i])) { issue = 'NONFINITE_MESH_OR_NORMAL'; break; }
        if (i % 1024 === 0 && needsYield()) { await checkpoint('PREPARE'); if (cancelled) return finish('CANCELLED'); }
      }
      if (!issue) for (let i = 0; i < mesh.indices.length; i++) {
        const v = mesh.indices[i];
        if (!Number.isInteger(v) || v < 0 || v >= mesh.counts.vertices) { issue = 'INVALID_INDEX'; break; }
        const radial = mesh.counts.radialSegments, stride = radial + 1, t = Math.floor(i / 3), side = (pts.length - 1) * radial * 2;
        const band = Math.floor(t / (radial * 2));
        const base = t < side ? band * stride : pts.length * stride + Math.floor((t - side) / radial) * (stride + 1);
        const count = t < side ? stride * 2 : stride + 1;
        if (v < base || v >= base + count) { issue = 'INDEX_OUTSIDE_ASSIGNED_RING_BAND'; break; }
        if (i % 1024 === 0 && needsYield()) { await checkpoint('PREPARE'); if (cancelled) return finish('CANCELLED'); }
      }
      if (!issue) for (let t = 0; t < mesh.counts.triangles; t++) {
        statistics.examinedMeshTriangles++;
        if (!triangleIsOutward(mesh, t)) { issue = 'DEGENERATE_OR_INVERTED_TRIANGLE'; break; }
        if (needsYield()) { await checkpoint('PREPARE'); if (cancelled) return finish('CANCELLED'); }
      }
    }
    if (issue) {
      invalidInput = true; const id = `${path.id}/ABNORMAL_GEOMETRY`;
      findings.set(id, { id, classification: 'UNEXPECTED_INTERSECTION', relation: 'ABNORMAL_GEOMETRY', sourcePathIds: [path.id],
        occurrenceCount: 1, reason: issue, geometryEvidence: { kind: issue }, physicalRelation: 'UNKNOWN',
        evidenceScope: 'SAMPLED_RENDER_GEOMETRY', evidenceSource: 'Existing Tube Geometry arrays and outward-normal orientation' });
    } else {
      const radial = mesh.counts.radialSegments, stride = radial + 1;
      for (let s = 0; s < pts.length - 1; s++) {
        const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; let radius = 0;
        for (const ring of [s, s + 1]) for (let j = 0; j < stride; j++) {
          const v = vector(mesh.positions, ring * stride + j); radius = Math.max(radius, distance(v, pts[ring]));
          for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); }
        }
        bands.push({ mesh: m, segment: s, a: pts[s], b: pts[s + 1], min, max, radius,
          start: s * radial * 2, end: (s + 1) * radial * 2 });
        if (needsYield()) { await checkpoint('PREPARE'); if (cancelled) return finish('CANCELLED'); }
      }
      if (mesh.counts.caps) {
        // Caps are included as zero-length terminal bands in the same hash.
        const ends = [bands[bands.length - (pts.length - 1)], bands[bands.length - 1]];
        for (let e = 0; e < 2; e++) {
          const band = ends[e];
          bands.push({ ...band, segment: e ? pts.length - 1 : -1, a: e ? pts.at(-1) : pts[0], b: e ? pts.at(-1) : pts[0],
            start: (pts.length - 1) * radial * 2 + e * radial, end: (pts.length - 1) * radial * 2 + (e + 1) * radial });
        }
      }
    }
    if (m % 32 === 0 || needsYield()) { await checkpoint('PREPARE'); if (cancelled) return finish('CANCELLED'); }
  }
  for (let index = 0; index < bands.length; index++) {
    const a = bands[index], seen = new Set();
    const x0 = Math.floor((a.min[0] - epsilon) / cellSize), x1 = Math.floor((a.max[0] + epsilon) / cellSize);
    const y0 = Math.floor((a.min[1] - epsilon) / cellSize), y1 = Math.floor((a.max[1] + epsilon) / cellSize);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 10000 || grid.size > 2000000 || statistics.broadphaseCandidates > 20000000) { limited = true; break; }
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const key = `${x}:${y}`, bucket = grid.get(key) ?? [];
      for (const other of bucket) {
        if (needsYield()) { await checkpoint('CANDIDATES'); if (cancelled) return finish('CANCELLED'); }
        if (seen.has(other)) continue; seen.add(other);
        const b = bands[other];
        if (localAdjacency(a, b, swatch.paths[a.mesh])) { statistics.skippedLocalAdjacency++; continue; }
        if (!overlaps(a, b, 2, epsilon)) continue;
        statistics.broadphaseCandidates++;
        const pair = pairKey(swatch.paths[a.mesh].id, swatch.paths[b.mesh].id);
        const state = pairStates.get(pair) ?? { crossing: false, uncertain: false }; pairStates.set(pair, state);
        const closest = segmentDistance(a.a, a.b, b.a, b.b), envelopeGap = closest.distance - a.radius - b.radius;
        const witness = { segmentIndices: [a.segment, b.segment], distance: closest.distance, envelopeGap,
          distanceStatus: closest.separationReliable ? 'SEGMENT_MINIMUM' : 'NEAR_PARALLEL_UNCERTAIN_NOT_A_SEPARATION_CERTIFICATE',
          closestPoints: [closest.first, closest.second], unit: 'mm' };
        if (closest.separationReliable && envelopeGap > epsilon) {
          if (projectedCrossing(a, b, epsilon)) addFinding(a.mesh, b.mesh, 'VISUAL_OVERLAP', witness);
        } else if (overlaps(a, b, 3, epsilon)) {
          let kind = null, triWitness = null;
          const firstTriangles = bandTriangles(a), secondTriangles = bandTriangles(b);
          outer: for (let ta = a.start; ta < a.end; ta++) {
            const first = firstTriangles[ta - a.start];
            for (let tb = b.start; tb < b.end; tb++) {
              const second = secondTriangles[tb - b.start]; statistics.narrowphaseTests++;
              if (needsYield()) { await checkpoint('NARROWPHASE'); if (cancelled) return finish('CANCELLED'); }
              const hit = triangleIntersection(first, second, epsilon);
              if (hit) { kind = hit; triWitness = [ta, tb]; }
              if (hit === 'SURFACE_CROSSING') break outer;
            }
          }
          kind ??= 'CLOSE_ENVELOPES_NO_SURFACE_CROSSING';
          if (kind === 'SURFACE_CROSSING') state.crossing = true; else state.uncertain = true;
          addFinding(a.mesh, b.mesh, kind, { ...witness, triangleIndices: triWitness });
        }
        if (needsYield()) { await checkpoint('INTERSECTIONS'); if (cancelled) return finish('CANCELLED'); }
      }
      bucket.push(index); grid.set(key, bucket); statistics.memberships++;
    }
    if (needsYield()) { await checkpoint('INDEX'); if (cancelled) return finish('CANCELLED'); }
  }
  if (!limited && !invalidInput) for (const evidence of relations.values()) {
    if (evidence.relation !== 'INTERLOCK' || evidence.applicable !== 'THIS_GEOMETRY' || !evidence.source) continue;
    const [a, b] = evidence.sourcePathIds, state = pairStates.get(pairKey(a, b));
    const i = swatch.paths.findIndex(p => p.id === a), j = swatch.paths.findIndex(p => p.id === b);
    if (i < 0 || j < 0 || state?.crossing || state?.uncertain) continue;
    addFinding(i, j, 'EVIDENCED_DISJOINT_INTERLOCK', { contract: evidence.source }, 'VALID_INTERLOCK',
      'Explicit geometry-scoped interlock evidence plus no ambiguous/penetrating envelope candidates; not inferred from CN or projection.');
  }
  statistics.maxChunkMs = Math.max(statistics.maxChunkMs, clock() - chunkStart);
  return finish(limited ? 'LIMIT_REACHED' : invalidInput ? 'INVALID' : 'COMPLETE');
}
