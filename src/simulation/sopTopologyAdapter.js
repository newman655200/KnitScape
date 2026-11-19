import { courseToFeedIndex } from "./yarnLengthMetrics.js";

const snapshotKeys = new WeakMap();
let snapshotSequence = 0;
const EVIDENCE = Object.freeze({
  occurrence: "computeYarnSimulation.occurrences; YarnModel.followTheYarn path order",
  originalCn: "DERIVED: no horizontal movement; original j = row + (head ? 1 : 0)",
  migration: "Current contacts.mv followed to final CN; not historical per-operation contact states",
  actualization: "YarnModel.contactNodes copies cn before followTheYarn may actualize UACN; snapshot cn is not the final mutable DS or physical contact evidence",
  adjacency: "YarnModel.yarnPathToLinks adjacent path occurrences; display adjacency only",
  path: "snapshot.yarnStrands[yarnIndex].modelPathByLink[link.index]",
});
const CONTINUITY_TYPES = Object.freeze(["MODEL_PATH_ADJACENCY", "SAME_FEED_COURSE_CANDIDATE",
  "SAME_FEED_NEXT_CYCLE_CANDIDATE", "PHYSICAL_YARN_CONTINUITY_CONFIRMED", "ROI_CLIPPED",
  "EXTERNAL_BOUNDARY", "DISCONTINUITY", "UNKNOWN", "REJECTED"]);
const CONTINUITY_EVIDENCE = Object.freeze(["CONFIRMED_FROM_SOURCE", "CANDIDATE_FROM_MODEL",
  "ASSUMPTION_TEST_ONLY", "UNKNOWN", "REJECTED"]);
const CONTINUITY_SOURCE = "YarnModel.yarnPathToLinks; computeYarnSimulation occurrence/link IDs; " +
  "yarnLengthMetrics.courseToFeedIndex(row, feedCount) = row % feedCount; " +
  "software facts only, no physical supply identity, machine rotation or threading evidence";
const KNITTING_REFERENCE = { title: "ACIMIT — Knitting",
  url: "https://www.acimit.it/wp-content/uploads/2022/06/Knitting_free.pdf" };
// Descriptive references only; no snapshot field can promote these to machine evidence.
const MECHANISM_EVIDENCE = freezeData({
  mode: "GENERAL_REFERENCE_ONLY",
  evidenceLevels: ["SOURCE_CONFIRMED", "MACHINE_DOCUMENT_CONFIRMED", "OBSERVED_ON_MACHINE",
    "LITERATURE_REFERENCE_ONLY", "INFERRED", "UNKNOWN", "NOT_APPLICABLE"],
  machineModelApplicability: { status: "UNKNOWN",
    unknownReason: "未提供与当前 SOP 匹配的具体型号、针结构、沉降片、选针配置、三角曲线、导纱位置或机上观察。Needle Type 仅为软件 Track ID，不能识别实际针结构。" },
  operations: [
    { operation: "K",
      software: { evidenceStatus: "SOURCE_CONFIRMED",
        definition: "下层 ST=K，MV 保持；PCN 且 Δi=0 时转 ACN。UACN 分支检查前行相邻 ACN 和同列 PCN。上层 MV=[0,0]；下层 ACN 时为 PCN，否则为 UACN；下层仍为 UACN 时另向前行查找 PCN 并实际化。CN 是软件状态，快照不是逐动作历史。",
        evidenceSource: ["src/simulation/ProcessModel.js:87-157 handleKPLower / handleKPUpper",
          "src/simulation/YarnModel.js:240-250 contactNodes copied before followTheYarn",
          "src/domain/singleJerseyMachine.js:71-89 resolveSingleJerseyOperations"] },
      generalReference: { evidenceStatus: "LITERATURE_REFERENCE_ONLY", label: "GENERAL_REFERENCE_ONLY",
        description: "教材单针床圆机示例中，旧圈受保持；针上升清圈，喂纱后下降，旧圈使针舌闭合并脱圈，新圈留在针钩。",
        condition: "仅说明教材所示舌针与沉降片在正常持圈、供纱条件下的成圈过程；不涵盖起针、空针或异常。本机针型和条件未确认。",
        evidenceSource: [{ ...KNITTING_REFERENCE, locator: "印刷 pp.82–83 / PDF pp.81–82; Stitch Formation Cycle on Single-bed Knitting Machines, Picture 107" }] },
      machineSpecific: { evidenceStatus: "UNKNOWN", unknownReason: "没有匹配本机的针型、沉降片和三角时序证据，不能由 K 或 ACN 确认本机已闭舌、脱圈。" },
      spatialImpact: "通用成圈说明不确定本机纱线空间顺序、接触点或 Z；这些关系仍为 UNKNOWN，不修改既有几何。" },
    { operation: "T",
      software: { evidenceStatus: "SOURCE_CONFIRMED",
        definition: "下层 PCN/UACN 的 Δj 设为 1；若下层为 ECN，向前行查找正 Δj 并加 1。上层设 UACN、MV=[0,0]。这些迁移规则不编码针舌、沉降片动作或针上真实圈数。",
        evidenceSource: ["src/simulation/ProcessModel.js:159-194 handleTuckMissUpper / handleTuckMissLower",
          "src/simulation/ProcessModel.js:196-215 handleOp"] },
      generalReference: { evidenceStatus: "LITERATURE_REFERENCE_ONLY", label: "GENERAL_REFERENCE_ONLY",
        description: "通用集圈概念：旧圈保留并接收新纱，本次不将旧圈脱下；后续是否脱圈取决于后续动作与实际机况。",
        condition: "定义来自手动横机章节，仅借用通用动作概念；不将其机头行程或 Cam 构型用于本机。圆机选针章节仅作选择动作参考，本机针结构和行程未确认。",
        evidenceSource: [{ ...KNITTING_REFERENCE, locator: "印刷 p.28 / PDF p.27, The Manual Flat Knitting Machine → The Cam-locks, TUCK STITCH 定义; 印刷 p.72 / PDF p.71, Selection Systems → Selection by means of Needles with Multilevel Butts（圆机选择）" }] },
      machineSpecific: { evidenceStatus: "UNKNOWN", unknownReason: "未确认实际集圈高度、持圈条件、累积圈数、沉降片配置或后续成圈时序。" },
      spatialImpact: "保留/接收新纱的通用概念不决定同一逻辑 CN 中纱线的包覆或前后顺序；空间关系仍为 UNKNOWN。" },
    { operation: "M",
      software: { evidenceStatus: "SOURCE_CONFIRMED",
        definition: "下层沿用 T/M 迁移：PCN/UACN 的 Δj=1；ECN 分支向前行查找正 Δj 并加 1。上层设 ECN、MV=[0,-1]。该软件状态不提供实际浮线空间轨迹。",
        evidenceSource: ["src/simulation/ProcessModel.js:159-194 handleTuckMissUpper / handleTuckMissLower",
          "src/simulation/ProcessModel.js:196-215 handleOp"] },
      generalReference: { evidenceStatus: "LITERATURE_REFERENCE_ONLY", label: "GENERAL_REFERENCE_ONLY",
        description: "通用浮线概念：该针本次不参与成圈并保留原圈，纱跨过未参与成圈的针位。",
        condition: "定义来自手动横机章节，仅借用通用动作概念，前提是原圈存在；不移植机头行程或 Cam 构型。圆机选择参考不能证实本机未起针高度、供纱方向或浮线走向。",
        evidenceSource: [{ ...KNITTING_REFERENCE, locator: "印刷 p.28 / PDF p.27, The Manual Flat Knitting Machine → The Cam-locks, MISS (or FLOAT) STITCH 定义; 印刷 p.72 / PDF p.71, Selection Systems → Selection by means of Needles with Multilevel Butts（圆机选择）" }] },
      machineSpecific: { evidenceStatus: "UNKNOWN", unknownReason: "未确认实际不编织位置、针上原圈状态、供纱路径或浮线在织物中的前后位置。" },
      spatialImpact: "软件 ECN 与浮线概念不提供实际浮线高度、前后顺序或接触关系；这些关系仍为 UNKNOWN。" },
  ],
});

function freezeData(value, seen = new Map()) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  const copy = Array.isArray(value) ? [] : {};
  seen.set(value, copy);
  for (const [key, item] of Object.entries(value)) copy[key] = freezeData(item, seen);
  return Object.freeze(copy);
}

function identityFor(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  if (!snapshotKeys.has(snapshot)) snapshotKeys.set(snapshot, `sop-snapshot:${++snapshotSequence}`);
  return { key: snapshotKeys.get(snapshot), scope: snapshot.scope,
    inputSignature: snapshot.inputSignature ?? null, projectGeneration: snapshot.projectGeneration,
    feedYarnStructureRevision: snapshot.feedYarnStructureRevision,
    lifetime: "THIS_SNAPSHOT_ONLY; IDs are not persistent across versions or sessions" };
}

function unavailable(status, reason, identity, roi) {
  return freezeData({ status, reason, identity, roi, operations: [], occurrences: [], links: [],
    strands: [], cnReferences: [], spatialRelations: [], metrics: null, scale: null,
    continuity: continuityView([], identity, roi, null, "UNAVAILABLE"), mechanismEvidence: null });
}

// Derived relation views contain references only. Software path facts and
// physical-continuity candidates remain separate even when they cite one link.
function continuityView(links, identity, roi, feedCount, status = "CLASSIFIED") {
  const provenance = { snapshotId: identity?.key ?? null, projectGeneration: identity?.projectGeneration ?? null,
    revision: identity?.feedYarnStructureRevision ?? null, physicalContinuity: "UNKNOWN" };
  const edges = [];
  const add = (link, edgeType, evidenceStatus, reason, chainEligible = false) => {
    const edge = { ...provenance, id: `${link.id}/continuity:${edgeType}`, linkId: link.id,
      sourceOccurrenceId: link.sourceOccurrenceId, targetOccurrenceId: link.targetOccurrenceId,
      edgeType, evidenceStatus, evidenceSource: CONTINUITY_SOURCE, reason, chainEligible,
      feedIndex: link.feedIndex, yarnIndex: link.yarnIndex, yarnId: link.yarnId,
      direction: { model: link.source.pathIndex === link.index && link.target.pathIndex === link.index + 1 ?
        "INCREASING_PATH_INDEX" : "UNKNOWN", physical: "UNKNOWN" },
      boundary: { state: link.boundary === "CLIPPED" ? "ROI_CLIPPED" : "INTERNAL",
        source: link.sourceBoundary === "IN_ROI" ? "IN_ROI" : "EXTERNAL_BOUNDARY",
        target: link.targetBoundary === "IN_ROI" ? "IN_ROI" : "EXTERNAL_BOUNDARY" } };
    edges.push(edge);
    return edge;
  };
  for (const link of links) {
    const { source, target } = link;
    const adjacent = target.pathIndex === source.pathIndex + 1 && source.pathIndex === link.index;
    add(link, "MODEL_PATH_ADJACENCY", adjacent ? "CONFIRMED_FROM_SOURCE" : "UNKNOWN",
      adjacent ? "SOURCE_LINK_AND_ORDERED_OCCURRENCES" : "SOURCE_PATH_ORDER_INCONSISTENT");
    if (link.boundary === "CLIPPED") add(link, "ROI_CLIPPED", "CONFIRMED_FROM_SOURCE", "OPEN_ROI_BOUNDARY");
    const knownYarn = source.yarnId !== null && source.yarnId !== undefined && source.yarnId !== "" &&
      target.yarnId !== null && target.yarnId !== undefined && target.yarnId !== "";
    const sameYarn = source.yarnId === target.yarnId && source.yarnIndex === target.yarnIndex;
    if (knownYarn && !sameYarn) {
      add(link, "DISCONTINUITY", "REJECTED", "CROSS_YARN_ID");
      continue;
    }
    if (link.crossFeed) {
      add(link, "DISCONTINUITY", "REJECTED", "CROSS_FEED");
      continue;
    }
    const mapped = source.feedIndex === courseToFeedIndex(source.row, feedCount) &&
      target.feedIndex === courseToFeedIndex(target.row, feedCount) &&
      link.feedIndex === courseToFeedIndex(link.row, feedCount) && link.row === target.row;
    if (!adjacent || !mapped || !knownYarn) {
      add(link, "UNKNOWN", "UNKNOWN", !adjacent ? "SOURCE_PATH_ORDER_INCONSISTENT" :
        !mapped ? "SOFTWARE_FEED_MAPPING_INCONSISTENT" : "YARN_ASSET_ID_UNKNOWN");
      continue;
    }
    if (link.crossRow) {
      // A real, existing row-jump link may match the software repeat mapping.
      // That does not authorize following the model's serpentine row turn.
      if (target.row - source.row === feedCount) add(link, "SAME_FEED_NEXT_CYCLE_CANDIDATE",
        "CANDIDATE_FROM_MODEL", "SOFTWARE_CYCLE_MAPPING_ONLY; PHYSICAL_NEXT_CYCLE_UNKNOWN");
      add(link, "DISCONTINUITY", "REJECTED", "SERPENTINE_ROW_TRANSITION");
      continue;
    }
    if (link.boundary === "INTERNAL") add(link, "SAME_FEED_COURSE_CANDIDATE", "CANDIDATE_FROM_MODEL",
      "SAME_SOFTWARE_ROW_FEED_AND_YARN_ASSET; PHYSICAL_SUPPLY_UNKNOWN", true);
  }

  const eligible = edges.filter(edge => edge.chainEligible);
  const bySource = new Map(eligible.map(edge => [edge.sourceOccurrenceId, edge]));
  const byTarget = new Map(eligible.map(edge => [edge.targetOccurrenceId, edge]));
  const sourceLinks = new Map(links.map(link => [link.id, link]));
  const boundaryFor = (occurrenceId, side) => {
    const related = edges.filter(edge => !edge.chainEligible && edge.edgeType !== "MODEL_PATH_ADJACENCY" &&
      edge[side === "start" ? "targetOccurrenceId" : "sourceOccurrenceId"] === occurrenceId);
    const state = related.some(edge => edge.edgeType === "ROI_CLIPPED") ? "ROI_CLIPPED" :
      related.some(edge => edge.edgeType === "DISCONTINUITY") ? "DISCONTINUITY" :
        related.length ? "UNKNOWN" : "EXTERNAL_BOUNDARY";
    return { state, occurrenceId, relatedEdgeIds: related.map(edge => edge.id) };
  };
  const chains = [], visited = new Set();
  for (const first of eligible) {
    if (byTarget.has(first.sourceOccurrenceId)) continue;
    const edgeIds = [], linkIds = [], occurrenceIds = [first.sourceOccurrenceId];
    let edge = first;
    while (edge && !visited.has(edge.id) && edge.feedIndex === first.feedIndex &&
      edge.yarnId === first.yarnId && edge.yarnIndex === first.yarnIndex) {
      visited.add(edge.id);
      edgeIds.push(edge.id); linkIds.push(edge.linkId); occurrenceIds.push(edge.targetOccurrenceId);
      edge = bySource.get(edge.targetOccurrenceId);
    }
    const start = sourceLinks.get(linkIds[0]), end = sourceLinks.get(linkIds.at(-1));
    chains.push({ ...provenance,
      id: `${identity.key}/chain:${roi.needleIndex}:${roi.rowStart}-${roi.rowEnd}/${start.assignmentId}/${start.index}-${end.index}`,
      occurrenceIds, linkIds, edgeIds, feedIndex: first.feedIndex, yarnId: first.yarnId, yarnIndex: first.yarnIndex,
      evidenceStatus: "CANDIDATE_FROM_MODEL", evidenceSource: CONTINUITY_SOURCE,
      interpretation: "SOFTWARE_COURSE_CANDIDATE; NOT_PHYSICALLY_CONFIRMED",
      physicalSupplyIdentity: "UNKNOWN", closed: false,
      startBoundary: boundaryFor(occurrenceIds[0], "start"), endBoundary: boundaryFor(occurrenceIds.at(-1), "end") });
  }
  const countsFor = (items, field, vocabulary) => Object.fromEntries(vocabulary.map(key =>
    [key, items.filter(item => item[field] === key).length]));
  return { ...provenance, status, edges, chains, evidenceSource: CONTINUITY_SOURCE,
    vocabulary: { edgeTypes: CONTINUITY_TYPES, evidenceStatuses: CONTINUITY_EVIDENCE },
    counts: { edges: edges.length, chains: chains.length,
      byEdgeType: countsFor(edges, "edgeType", CONTINUITY_TYPES),
      byEvidenceStatus: countsFor(edges, "evidenceStatus", CONTINUITY_EVIDENCE),
      byChainEvidenceStatus: countsFor(chains, "evidenceStatus", CONTINUITY_EVIDENCE) },
    measurementPolicy: "Count each referenced source link once; relation edges are not additional yarn segments",
    boundaryPolicy: "ROI_CLIPPED and EXTERNAL_BOUNDARY remain open; no CN or XY endpoint welding",
    physicalEvidence: { supplyIdentity: "UNKNOWN", machineRotation: "UNKNOWN", threading: "UNKNOWN" } };
}

// This is an inspection adapter, not a Machine/CN/Solver computation owner.
// Only published, applied model paths are consumed. No physical z/order/contact is inferred.
export function buildSopTopology(snapshot, { needleIndex = 16, rowStart = 21, rowEnd = 24, window = 'local' } = {}) {
  const fullWindow = window === 'full';
  if (fullWindow) { needleIndex = 0; rowStart = 0; rowEnd = (snapshot?.pattern?.height ?? 0) - 1; }
  const identity = identityFor(snapshot), roi = fullWindow ?
    { needleIndex, needleStart: 0, needleEnd: (snapshot?.pattern?.width ?? 0) - 1, rowStart, rowEnd, window: 'full' } :
    { needleIndex, rowStart, rowEnd };
  const fail = (status, reason) => unavailable(status, reason, identity, roi);
  if (!snapshot) return fail("UNAVAILABLE", "MACHINE_SNAPSHOT_MISSING");
  if (!['local', 'full'].includes(window)) return fail('UNSUPPORTED', 'WINDOW_MODE_INVALID');
  if (snapshot.scope !== "machine") return fail("UNSUPPORTED", "MACHINE_SCOPE_REQUIRED");
  const { pattern, stitchPattern, topologyWidth, topologyHeight, xPadding, yPadding, feedCount } = snapshot;
  if (!pattern || !stitchPattern || !Array.isArray(snapshot.occurrences) ||
      !Array.isArray(snapshot.contacts) || !snapshot.contacts.length || !Array.isArray(snapshot.yarnPathLinks) ||
      !Array.isArray(snapshot.assignments) || !Array.isArray(snapshot.yarnStrands) ||
      !Number.isInteger(topologyWidth) || topologyWidth <= 0 || !Number.isInteger(topologyHeight) ||
      !Number.isInteger(feedCount) || feedCount < 1 || !Number.isInteger(xPadding)) {
    return fail("UNAVAILABLE", "SNAPSHOT_TOPOLOGY_INCOMPLETE");
  }
  if (yPadding !== 0) return fail("UNSUPPORTED", "VERTICAL_PADDING_PROVENANCE_UNSUPPORTED");
  if (!Number.isFinite(snapshot.machineGauge) || snapshot.machineGauge <= 0) return fail("UNAVAILABLE", "MACHINE_GAUGE_MISSING_OR_INVALID");
  if (![needleIndex, rowStart, rowEnd].every(Number.isInteger) || needleIndex < 0 || needleIndex >= pattern.width ||
      rowStart < 0 || rowEnd < rowStart || rowEnd >= pattern.height) return fail("UNSUPPORTED", "ROI_OUT_OF_RANGE");
  if (snapshot.contacts.length !== topologyWidth * topologyHeight ||
      snapshot.contacts.some(contact => !Array.isArray(contact?.mv) || contact.mv.length !== 2)) {
    return fail("UNAVAILABLE", "CONTACT_DATA_INCOMPLETE");
  }
  // Without an original-coordinate trace a horizontal transfer cannot safely be inverted.
  if (snapshot.contacts.some(contact => contact.mv[0] !== null && contact.mv[0] !== 0)) {
    return fail("UNSUPPORTED", "HORIZONTAL_TRANSFER_PROVENANCE_UNAVAILABLE");
  }
  const baseById = new Map(snapshot.occurrences.map(item => [item.id, item]));
  const linksByIndex = new Map(snapshot.yarnPathLinks.map(item => [item.index, item]));
  const assignments = new Map(snapshot.assignments.map(item => [`${item.feedIndex}:${item.yarnIndex}`, item]));
  const paddedNeedle = needleIndex + xPadding;
  const localBases = snapshot.occurrences.filter(item => item.row >= rowStart && item.row <= rowEnd &&
    (fullWindow ? Math.floor(item.i / 2) >= xPadding && Math.floor(item.i / 2) < pattern.width + xPadding :
      Math.floor(item.i / 2) === paddedNeedle));
  if (!localBases.length) return fail("UNAVAILABLE", "ROI_HAS_NO_OCCURRENCES");
  const localBaseIds = new Set(localBases.map(item => item.id));
  const provenance = { snapshotKey: identity.key, inputSignature: identity.inputSignature, scope: identity.scope,
    projectGeneration: identity.projectGeneration, feedYarnStructureRevision: identity.feedYarnStructureRevision };
  const strandId = assignment => `${identity.key}/${assignment.id}`;
  const occurrenceId = (base, assignment) => `${strandId(assignment)}/${base.id}`;
  const linkId = (link, assignment) => `${strandId(assignment)}/link:${link.index}`;
  const assignmentAt = (row, yarnIndex) => assignments.get(`${courseToFeedIndex(row, feedCount)}:${yarnIndex}`);
  let invalidReason = null;

  function migrationFor(base) {
    const isHead = base.cnType?.endsWith("H"), originalJ = base.row + (isHead ? 1 : 0);
    const originalCnIndex = originalJ * topologyWidth + base.i;
    const finalCnIndex = base.cnIndex, chain = [], seen = new Set();
    let current = originalCnIndex;
    while (!seen.has(current)) {
      const contact = snapshot.contacts[current];
      if (!contact) { invalidReason = "MIGRATION_CONTACT_MISSING"; break; }
      seen.add(current);
      chain.push({ cnIndex: current, st: contact.st, cn: contact.cn, movement: [...contact.mv],
        actualizationEvidence: "STATIC_PRE_FOLLOW_THE_YARN_COPY; NOT_OPERATION_HISTORY_OR_PHYSICAL_CONTACT" });
      if (current === finalCnIndex) break;
      if (!isHead || !Number.isInteger(contact.mv[1]) || contact.mv[1] === 0) {
        invalidReason = "MIGRATION_TRACE_DOES_NOT_REACH_FINAL_CN"; break;
      }
      current += contact.mv[1] * topologyWidth;
    }
    if (chain.at(-1)?.cnIndex !== finalCnIndex) invalidReason ||= "MIGRATION_CYCLE_OR_MISSING_TRACE";
    return { originalCnIndex, finalCnIndex, migrationChain: chain };
  }

  function occurrenceRecord(base, assignment, boundary = "IN_ROI") {
    const previous = linksByIndex.get(base.index - 1), next = linksByIndex.get(base.index);
    const previousAssignment = previous && assignmentAt(previous.row, assignment.yarnIndex);
    const nextAssignment = next && assignmentAt(next.row, assignment.yarnIndex);
    return { ...provenance, id: occurrenceId(base, assignment), baseOccurrenceId: base.id,
      pathIndex: base.index, cnType: base.cnType, i: base.i, j: base.j,
      row: base.row, needle: Math.floor(base.i / 2) - xPadding,
      feedIndex: assignment.feedIndex, yarnIndex: assignment.yarnIndex, yarnId: assignment.yarnId,
      assignmentId: assignment.id, strandId: strandId(assignment), boundary,
      ...migrationFor(base), prevLinkId: previousAssignment ? linkId(previous, previousAssignment) : null,
      nextLinkId: nextAssignment ? linkId(next, nextAssignment) : null,
      pathOrigin: "PUBLISHED_MACHINE_SNAPSHOT", sourceEvidence: EVIDENCE };
  }

  const operations = Array.from({ length: rowEnd - rowStart + 1 }, (_, offset) => {
    const row = rowStart + offset;
    return Array.from({ length: fullWindow ? pattern.width : 1 }, (_, needleOffset) => {
      const needle = needleIndex + needleOffset;
      return { ...provenance, row, needle, feedIndex: courseToFeedIndex(row, feedCount),
        operation: stitchPattern.ops[needle + xPadding + row * stitchPattern.width],
        sourceEvidence: "snapshot.stitchPattern.ops (adapted Machine execution); not recomputed Cam rules" };
    });
  }).flat();
  const occurrences = [];
  for (const base of localBases) {
    const feedIndex = courseToFeedIndex(base.row, feedCount);
    const feedAssignments = snapshot.assignments.filter(item => item.feedIndex === feedIndex);
    if (!feedAssignments.length) return fail("UNAVAILABLE", "ROI_FEED_ASSIGNMENT_MISSING");
    for (const assignment of feedAssignments) occurrences.push(occurrenceRecord(base, assignment));
  }
  const links = [];
  for (const link of snapshot.yarnPathLinks) {
    if (!localBaseIds.has(link.sourceOccurrenceId) && !localBaseIds.has(link.targetOccurrenceId)) continue;
    const source = baseById.get(link.sourceOccurrenceId), target = baseById.get(link.targetOccurrenceId);
    if (!source || !target) return fail("UNAVAILABLE", "LINK_OCCURRENCE_MISSING");
    const feedIndex = courseToFeedIndex(link.row, feedCount);
    for (const assignment of snapshot.assignments.filter(item => item.feedIndex === feedIndex)) {
      const strand = snapshot.yarnStrands[assignment.yarnIndex];
      const pathModel = strand?.modelPathByLink?.get(link.index);
      const baseModelPath = strand?.baseModelPathByLink?.get(link.index);
      if (typeof pathModel !== "string" || !pathModel || typeof baseModelPath !== "string" || !baseModelPath) {
        return fail("UNAVAILABLE", "APPLIED_MODEL_PATH_MISSING");
      }
      const sourceAssignment = assignmentAt(source.row, assignment.yarnIndex);
      const targetAssignment = assignmentAt(target.row, assignment.yarnIndex);
      if (!sourceAssignment || !targetAssignment) return fail("UNAVAILABLE", "LINK_ENDPOINT_ASSIGNMENT_MISSING");
      const sourceBoundary = localBaseIds.has(source.id) ? "IN_ROI" : "EXTERNAL";
      const targetBoundary = localBaseIds.has(target.id) ? "IN_ROI" : "EXTERNAL";
      links.push({ ...provenance, id: linkId(link, assignment), index: link.index,
        type: "YARN_ADJACENCY", evidenceState: "SOFTWARE_PATH_ADJACENCY", strandId: strandId(assignment),
        assignmentId: assignment.id, feedIndex, yarnIndex: assignment.yarnIndex, yarnId: assignment.yarnId,
        row: link.row, needle: fullWindow ? Math.floor(target.i / 2) - xPadding : needleIndex, linkType: link.linkType,
        sourceOccurrenceId: occurrenceId(source, sourceAssignment), targetOccurrenceId: occurrenceId(target, targetAssignment),
        source: occurrenceRecord(source, sourceAssignment, sourceBoundary),
        target: occurrenceRecord(target, targetAssignment, targetBoundary), sourceBoundary, targetBoundary,
        boundary: sourceBoundary === "IN_ROI" && targetBoundary === "IN_ROI" ? "INTERNAL" : "CLIPPED",
        crossRow: source.row !== target.row, crossFeed: sourceAssignment.feedIndex !== targetAssignment.feedIndex,
        displayContinuity: source.row !== target.row ? "SERPENTINE_ROW_TRANSITION" : "WITHIN_ROW_PATH",
        physicalContinuity: "UNKNOWN", pathModel, baseModelPath,
        pathOrigin: pathModel === baseModelPath ? "BASE_MODEL_PATH" : "APPLIED_MODEL_PATH",
        units: "MODEL_NEEDLE_PITCH", sourceEvidence: EVIDENCE });
    }
  }
  if (invalidReason) return fail("UNSUPPORTED", invalidReason);
  if (!links.length) return fail("UNAVAILABLE", "ROI_HAS_NO_APPLIED_LINKS");
  const usedAssignments = new Set(occurrences.map(item => item.assignmentId));
  const strands = snapshot.assignments.filter(item => usedAssignments.has(item.id)).map(assignment => {
    const material = snapshot.feedYarnPlies?.get(assignment.feedIndex)?.[assignment.yarnIndex];
    const asset = snapshot.yarnLibrary?.find(item => String(item.id) === String(assignment.yarnId));
    const input = snapshot.feeds?.[assignment.feedIndex]?.yarns?.[assignment.yarnIndex];
    return { ...provenance, ...assignment, id: strandId(assignment), assignmentId: assignment.id,
      // Asset identity is intentionally separate from this feed's supply identity.
      name: asset?.name || String(assignment.yarnId ?? "UNKNOWN"), physicalSupplyIdentity: "UNKNOWN",
      materialState: { source: "snapshot.feedYarnPlies; snapshot.feeds assignment", color: material?.color ?? null,
        effectiveModelDiameter: material?.diameter ?? null, diameterUnit: "MODEL_NEEDLE_PITCH",
        measuredDiameterMm: "UNKNOWN", placement: input?.placement ?? "UNKNOWN",
        lengthInputMode: input?.lengthInputMode ?? "directTarget", tensionCN: input?.tensionCN ?? null,
        tensionActiveInGeometry: false, lengthInput: input ? { ...input } : null },
      occurrenceIds: occurrences.filter(item => item.assignmentId === assignment.id).map(item => item.id),
      linkIds: links.filter(item => item.assignmentId === assignment.id).map(item => item.id),
      sourceEvidence: "snapshot.assignments, feeds, yarnLibrary, feedYarnPlies; no new material resolution" };
  });
  // Keep group IDs apart from occurrences: sharing a logical CN never welds fibers.
  const references = new Map();
  occurrences.forEach(item => {
    if (!references.has(item.finalCnIndex)) references.set(item.finalCnIndex, []);
    references.get(item.finalCnIndex).push(item.id);
  });
  const cnReferences = [...references].map(([finalCnIndex, occurrenceIds]) => ({ ...provenance,
    id: `${identity.key}/cn-reference:${finalCnIndex}`, type: "CN_REFERENCE", finalCnIndex, occurrenceIds,
    evidenceState: "LOGICAL_REFERENCE_ONLY", sourceEvidence: "occurrence.finalCnIndex; no physical contact inference" }));
  const spatialRelations = cnReferences.flatMap(reference => ["SPATIAL_ORDER", "CONTACT"].map(type => ({
    ...provenance, id: `${reference.id}/${type}`, type, finalCnIndex: reference.finalCnIndex,
    occurrenceIds: reference.occurrenceIds, state: "UNKNOWN", sourceEvidence: "No physical order/contact evidence in snapshot" })));
  const M1 = (snapshot.originalSolverResults || []).filter(item => usedAssignments.has(`feed:${item.feedIndex}:yarn:${item.yarnIndex}`))
    .map(item => ({ feedIndex: item.feedIndex, yarnIndex: item.yarnIndex,
      assignmentId: `feed:${item.feedIndex}:yarn:${item.yarnIndex}`, value: item.solvedLengthCmPer100Needles,
      target: item.targetLengthCmPer100Needles, status: item.status, appliedToSimulation: item.appliedToSimulation,
      unit: "cm/100 machine needles", window: "ORIGINAL_SOLVER_PERIODIC_X_FINITE_COURSES; NOT_THIS_ROI",
      source: "snapshot.originalSolverResults", interpretation: "MODEL_METRIC; not production validation" }));
  return freezeData({ status: "READY", reason: null, identity, roi, operations, occurrences, links, strands,
    cnReferences, spatialRelations, continuity: continuityView(links, identity, roi, feedCount),
    mechanismEvidence: MECHANISM_EVIDENCE,
    scale: { machineGauge: snapshot.machineGauge, modelUnits: "MODEL_NEEDLE_PITCH",
      needlePitchMm: 25.4 / snapshot.machineGauge, physicalFabricScale: "UNKNOWN",
      source: "Gauge needle pitch conversion only; not relaxed-fabric loop spacing or measured yarn diameter" },
    metrics: { M1, M3: { status: "NOT_AVAILABLE_IN_SNAPSHOT", value: null, window: "UNKNOWN", unit: "cm/100 machine needles" },
      localXY: { status: "NOT_INTEGRATED_BY_TOPOLOGY_ADAPTER", unit: "MODEL_NEEDLE_PITCH",
        window: { ...roi, linkIds: links.map(item => item.id) }, boundary: "Whole source links touching ROI, including explicit EXTERNAL endpoints" },
      sourceCounts: { occurrences: snapshot.occurrences.length, links: snapshot.yarnPathLinks.length,
        solverResults: snapshot.originalSolverResults?.length ?? 0 } } });
}
