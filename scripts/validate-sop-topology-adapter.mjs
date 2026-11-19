import strictAssert from "node:assert/strict";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { withSopFixtureSnapshot } from "./helpers/sopFixtureSnapshot.mjs";

const moduleUrl = new URL("../src/simulation/sopTopologyAdapter.js", import.meta.url);
let assertions = 0;
const assert = new Proxy(strictAssert, { get(target, key) {
  return (...args) => { assertions++; return target[key](...args); };
} });
assert.ok(existsSync(moduleUrl), "SOP topology adapter must exist");
const json = value => JSON.stringify(value, (_, item) => item instanceof Map ? [...item] : item);
const checkout = fileURLToPath(new URL("../", import.meta.url));

// Deliberately tiny source snapshots exercise row turns that the real SOP's
// padding keeps outside the selectable needle ROI. No machine fact is inferred.
function continuityFixture({ rows = [0, 0, 0, 1, 1], feedCount = 2, yarnIds = ["material-A", "material-A"] } = {}) {
  const height = Math.max(...rows) + 1, width = 2;
  const occurrences = rows.map((row, index) => ({ id: `occurrence:${index}`, index,
    cnIndex: row * width + index % width, i: index % width, j: row, row, cnType: "FL" }));
  const yarnPathLinks = occurrences.slice(1).map((target, index) => ({ index, row: target.row, linkType: "FLFL",
    sourceOccurrenceId: occurrences[index].id, targetOccurrenceId: target.id }));
  const paths = new Map(yarnPathLinks.map(link => [link.index, `M ${link.index} 0 L ${link.index + 1} 0`]));
  return { scope: "machine", inputSignature: "TEST_ONLY_CONTINUITY", projectGeneration: 7, feedYarnStructureRevision: 2,
    pattern: { width: 1, height }, stitchPattern: { width: 1, height, ops: Array(height).fill("K") },
    topologyWidth: width, topologyHeight: height + 1, xPadding: 0, yPadding: 0, feedCount, machineGauge: 32,
    contacts: Array.from({ length: width * (height + 1) }, (_, index) => ({ index, st: "K", cn: "ACN", mv: [0, 0] })),
    occurrences, yarnPathLinks,
    assignments: Array.from({ length: feedCount }, (_, feedIndex) => ({ id: `feed:${feedIndex}:yarn:0`, feedIndex,
      yarnIndex: 0, yarnId: feedIndex < yarnIds.length ? yarnIds[feedIndex] : "material-A" })),
    yarnStrands: [{ modelPathByLink: paths, baseModelPathByLink: paths }],
  };
}

function checkContinuity(result) {
  const c = result.continuity;
  assert.ok(c, "The adapter must publish an auditable continuity classification");
  assert.equal(c.status, "CLASSIFIED");
  assert.equal(c.physicalContinuity, "UNKNOWN");
  assert.equal(c.counts.byEdgeType.PHYSICAL_YARN_CONTINUITY_CONFIRMED, 0);
  const links = new Map(result.links.map(item => [item.id, item]));
  const edges = new Map(c.edges.map(item => [item.id, item]));
  assert.equal(edges.size, c.edges.length);
  assert.equal(c.edges.filter(item => item.edgeType === "MODEL_PATH_ADJACENCY").length, result.links.length);
  for (const item of [...c.edges, ...c.chains]) {
    assert.equal(item.snapshotId, result.identity.key);
    assert.equal(item.projectGeneration, result.identity.projectGeneration);
    assert.equal(item.revision, result.identity.feedYarnStructureRevision);
    assert.ok(item.evidenceSource);
    assert.equal(item.physicalContinuity, "UNKNOWN");
    assert.ok(Object.isFrozen(item));
  }
  for (const edge of c.edges) {
    const link = links.get(edge.linkId);
    assert.ok(link, "Every relation refers to an existing source link");
    assert.equal(edge.sourceOccurrenceId, link.sourceOccurrenceId);
    assert.equal(edge.targetOccurrenceId, link.targetOccurrenceId);
    assert.equal(edge.direction.physical, "UNKNOWN");
    if (edge.edgeType === "MODEL_PATH_ADJACENCY") {
      assert.equal(edge.evidenceStatus, "CONFIRMED_FROM_SOURCE");
      assert.equal(edge.chainEligible, false, "Software adjacency alone cannot authorize a chain");
    }
    if (edge.chainEligible) {
      assert.equal(edge.edgeType, "SAME_FEED_COURSE_CANDIDATE");
      assert.equal(edge.evidenceStatus, "CANDIDATE_FROM_MODEL");
      assert.equal(link.crossRow, false);
      assert.equal(link.crossFeed, false);
      assert.equal(link.boundary, "INTERNAL");
      assert.equal(link.source.yarnId, link.target.yarnId);
    }
  }
  const counted = new Set();
  for (const chain of c.chains) {
    assert.equal(chain.evidenceStatus, "CANDIDATE_FROM_MODEL");
    assert.equal(chain.physicalSupplyIdentity, "UNKNOWN");
    assert.equal(chain.closed, false);
    assert.equal(chain.occurrenceIds.length, chain.linkIds.length + 1);
    assert.equal(chain.edgeIds.length, chain.linkIds.length);
    assert.equal(chain.startBoundary.occurrenceId, chain.occurrenceIds[0]);
    assert.equal(chain.endBoundary.occurrenceId, chain.occurrenceIds.at(-1));
    chain.linkIds.forEach((id, index) => {
      const link = links.get(id);
      assert.ok(!counted.has(id), "A source segment must appear in at most one derived chain");
      counted.add(id);
      assert.equal(link.sourceOccurrenceId, chain.occurrenceIds[index]);
      assert.equal(link.targetOccurrenceId, chain.occurrenceIds[index + 1]);
      assert.equal(edges.get(chain.edgeIds[index]).linkId, id);
      assert.equal(edges.get(chain.edgeIds[index]).chainEligible, true);
      assert.equal(link.feedIndex, chain.feedIndex);
      assert.equal(link.yarnId, chain.yarnId);
    });
  }
  assert.equal(counted.size, c.edges.filter(item => item.chainEligible).length);
}

function checkMechanismEvidence(result) {
  const evidence = result.mechanismEvidence;
  assert.ok(evidence, "Ready topology must expose descriptive mechanism evidence");
  assert.equal(evidence.mode, "GENERAL_REFERENCE_ONLY");
  assert.deepEqual(evidence.evidenceLevels, ["SOURCE_CONFIRMED", "MACHINE_DOCUMENT_CONFIRMED",
    "OBSERVED_ON_MACHINE", "LITERATURE_REFERENCE_ONLY", "INFERRED", "UNKNOWN", "NOT_APPLICABLE"]);
  assert.equal(evidence.machineModelApplicability.status, "UNKNOWN");
  assert.ok(evidence.machineModelApplicability.unknownReason);
  assert.deepEqual(evidence.operations.map(item => item.operation), ["K", "T", "M"]);
  for (const item of evidence.operations) {
    assert.equal(item.software.evidenceStatus, "SOURCE_CONFIRMED");
    assert.ok(item.software.definition);
    assert.ok(item.software.evidenceSource.some(source => source.includes("ProcessModel.js")));
    assert.equal(item.generalReference.evidenceStatus, "LITERATURE_REFERENCE_ONLY");
    assert.equal(item.generalReference.label, "GENERAL_REFERENCE_ONLY");
    assert.ok(item.generalReference.description && item.generalReference.condition);
    assert.ok(item.generalReference.evidenceSource.length);
    for (const source of item.generalReference.evidenceSource) {
      assert.ok(source.title && source.locator && new URL(source.url).protocol === "https:");
    }
    assert.equal(item.machineSpecific.evidenceStatus, "UNKNOWN");
    assert.ok(item.machineSpecific.unknownReason);
    assert.ok(item.spatialImpact.includes("UNKNOWN"));
    assert.ok(Object.isFrozen(item) && Object.isFrozen(item.generalReference.evidenceSource[0]));
    assert.throws(() => { item.machineSpecific.evidenceStatus = "OBSERVED_ON_MACHINE"; }, TypeError);
  }
  assert.ok(Object.isFrozen(evidence) && Object.isFrozen(evidence.evidenceLevels));
  for (const field of ["events", "phaseReferences", "eventGraph", "coordinates", "timing"]) {
    assert.equal(Object.hasOwn(evidence, field), false, "Descriptive evidence cannot add machine execution or geometry");
  }
}

await assert.rejects(withSopFixtureSnapshot(() => {}, { archiveDir: checkout }), /outside the checkout/);
await assert.rejects(withSopFixtureSnapshot(() => {}, { archiveDir: path.join(checkout, "..test-output") }), /outside the checkout/);
await withSopFixtureSnapshot(async ({ snapshot, project, fixtureSha256, archiveDir, server }) => {
  const { buildSopTopology } = await server.ssrLoadModule("/src/simulation/sopTopologyAdapter.js");
  const before = json(snapshot), projectBefore = json(project);
  const result = buildSopTopology(snapshot);
  assert.equal(result.status, "READY", result.reason);
  checkMechanismEvidence(result);
  const { mechanismEvidence, ...priorTopology } = result;
  // Frozen real SOP / Round7 output, before the descriptive Round8 field was added.
  assert.equal(createHash("sha256").update(json(priorTopology)).digest("hex"),
    "ce5401a14cdb2185e10391175b143f3b618427c1549a7dc77ff58ef345921177",
    "Every pre-existing topology field must remain exactly unchanged");
  const claimedMachine = buildSopTopology({ ...snapshot, needleType: "latch", machineModel: "CLAIM_ONLY",
    needleStructure: "latch", sinkerType: "CLAIM_ONLY", machineEvidence: { status: "OBSERVED_ON_MACHINE" } });
  assert.deepEqual(claimedMachine.mechanismEvidence, mechanismEvidence,
    "Unverified snapshot fields cannot promote generic literature into machine confirmation");
  const missFixture = continuityFixture({ rows: [0, 0, 1, 1] });
  missFixture.stitchPattern.ops[1] = "M";
  const missResult = buildSopTopology(missFixture, { needleIndex: 0, rowStart: 0, rowEnd: 1 });
  checkMechanismEvidence(missResult);
  assert.equal(missResult.operations[1].operation, "M", "Synthetic M remains the source operation, without adapter reinterpretation");
  assert.deepEqual(missResult.mechanismEvidence, mechanismEvidence);
  checkContinuity(result);
  assert.equal(result.continuity.counts.byEdgeType.MODEL_PATH_ADJACENCY, 32);
  assert.equal(result.continuity.counts.byEdgeType.SAME_FEED_COURSE_CANDIDATE, 16);
  assert.equal(result.continuity.counts.byEdgeType.ROI_CLIPPED, 16);
  assert.equal(result.continuity.chains.length, 8, "KTTK stays four independent Feed rows for each material");
  assert.deepEqual(result.continuity.chains.map(item => item.linkIds.length).sort(), [1, 1, 1, 1, 3, 3, 3, 3]);
  assert.ok(result.continuity.chains.every(item => item.startBoundary.state === "ROI_CLIPPED" && item.endBoundary.state === "ROI_CLIPPED"));
  const synthetic = continuityFixture();
  const syntheticResult = buildSopTopology(synthetic, { needleIndex: 0, rowStart: 0, rowEnd: 1 });
  checkContinuity(syntheticResult);
  assert.deepEqual(syntheticResult.continuity.chains.map(item => item.linkIds.length), [2, 1]);
  assert.ok(syntheticResult.continuity.edges.some(item => item.edgeType === "DISCONTINUITY" && item.reason === "CROSS_FEED"));
  assert.equal(syntheticResult.occurrences[0].finalCnIndex, syntheticResult.occurrences[2].finalCnIndex);
  assert.notEqual(syntheticResult.continuity.chains[0].occurrenceIds[0], syntheticResult.continuity.chains[0].occurrenceIds[2],
    "Repeated CN visits retain ordered occurrence identities and never close the chain");
  const sameFeed = buildSopTopology(continuityFixture({ feedCount: 1 }), { needleIndex: 0, rowStart: 0, rowEnd: 1 });
  checkContinuity(sameFeed);
  assert.deepEqual(sameFeed.continuity.chains.map(item => item.linkIds.length), [2, 1]);
  assert.ok(sameFeed.continuity.edges.some(item => item.edgeType === "DISCONTINUITY" && item.reason === "SERPENTINE_ROW_TRANSITION"));
  const differentYarns = buildSopTopology(continuityFixture({ yarnIds: ["material-A", "material-B"] }),
    { needleIndex: 0, rowStart: 0, rowEnd: 1 });
  checkContinuity(differentYarns);
  assert.ok(differentYarns.continuity.edges.some(item => item.edgeType === "DISCONTINUITY" && item.reason === "CROSS_YARN_ID"));
  const nextCycle = buildSopTopology(continuityFixture({ rows: [0, 0, 2, 2], feedCount: 2 }),
    { needleIndex: 0, rowStart: 0, rowEnd: 2 });
  checkContinuity(nextCycle);
  assert.deepEqual(nextCycle.continuity.chains.map(item => item.linkIds.length), [1, 1]);
  assert.ok(nextCycle.continuity.edges.filter(item => item.edgeType === "SAME_FEED_NEXT_CYCLE_CANDIDATE")
    .every(item => !item.chainEligible), "Modulo Feed mapping cannot authorize cross-row chains");
  assert.equal(nextCycle.continuity.counts.byEdgeType.SAME_FEED_NEXT_CYCLE_CANDIDATE, 1,
    "Only the existing source row-jump link receives a software cycle mapping candidate");
  assert.equal(result.continuity.counts.byEdgeType.SAME_FEED_NEXT_CYCLE_CANDIDATE, 0,
    "A repeated Feed in distant rows must not fabricate a missing source link");
  const unknownYarn = buildSopTopology(continuityFixture({ rows: [0, 0, 0], yarnIds: [null] }),
    { needleIndex: 0, rowStart: 0, rowEnd: 0 });
  checkContinuity(unknownYarn);
  assert.equal(unknownYarn.continuity.chains.length, 0, "A missing material identity cannot authorize even a candidate chain");
  assert.equal(unknownYarn.continuity.counts.byEdgeType.UNKNOWN, 2);
  const outOfOrder = continuityFixture({ rows: [0, 0, 0] });
  outOfOrder.yarnPathLinks[0].targetOccurrenceId = "occurrence:2";
  const invalidOrder = buildSopTopology(outOfOrder, { needleIndex: 0, rowStart: 0, rowEnd: 0 });
  assert.ok(invalidOrder.continuity.edges.some(item => item.reason === "SOURCE_PATH_ORDER_INCONSISTENT" && item.evidenceStatus === "UNKNOWN"));
  assert.ok(invalidOrder.continuity.edges.filter(item => item.linkId.endsWith("/link:0"))
    .every(item => item.direction.model === "UNKNOWN"), "Inconsistent ordering must not advertise a confirmed traversal direction");
  assert.ok(invalidOrder.continuity.chains.every(item => !item.linkIds.some(id => id.endsWith("/link:0"))),
    "Malformed source path adjacency stays outside chains");
  const widerRows = buildSopTopology(snapshot, { needleIndex: 16, rowStart: 21, rowEnd: 32 });
  checkContinuity(widerRows);
  assert.equal(widerRows.continuity.counts.byEdgeType.SAME_FEED_NEXT_CYCLE_CANDIDATE, 0,
    "Rows that repeat a Feed do not create cycle links where YarnModel has none");
  assert.deepEqual(result.operations.map(item => [item.row, item.feedIndex, item.operation]),
    [[21, 5, "K"], [22, 6, "T"], [23, 7, "T"], [24, 0, "K"]]);
  assert.equal(snapshot.occurrences.length, 10560);
  assert.equal(snapshot.yarnPathLinks.length, 10559);
  assert.equal(snapshot.originalSolverResults.length, 16);
  assert.equal(result.occurrences.length, 24);
  const yarnIds = [...new Set(result.occurrences.map(item => item.yarnId))];
  assert.equal(yarnIds.length, 2);
  for (const yarnId of yarnIds) {
    const items = result.occurrences.filter(item => item.yarnId === yarnId);
    assert.equal(items.length, 12);
    assert.deepEqual([21, 22, 23, 24].map(row => items.filter(item => item.row === row).length), [4, 2, 2, 4]);
    assert.deepEqual(items.filter(item => item.row === 21 && item.cnType.endsWith("H"))
      .map(item => item.originalCnIndex).sort((a,b) => a-b), [2234, 2235]);
    assert.deepEqual(items.filter(item => item.row === 22).map(item => item.originalCnIndex).sort((a,b) => a-b), [2334, 2335]);
    assert.ok(items.filter(item => item.row <= 23 && item.cnType.endsWith("H"))
      .every(item => [2434, 2435].includes(item.finalCnIndex)));
    assert.deepEqual(items.filter(item => item.row === 24 && item.cnType.endsWith("H"))
      .map(item => item.finalCnIndex).sort((a,b) => a-b), [2534, 2535]);
  }
  assert.equal(new Set(result.occurrences.map(item => item.id)).size, 24);
  for (const item of [...result.occurrences, ...result.links, ...result.strands,
    ...result.cnReferences, ...result.spatialRelations]) {
    assert.equal(item.inputSignature, snapshot.inputSignature, "Every element retains its input signature");
    assert.equal(item.projectGeneration, snapshot.projectGeneration);
    assert.equal(item.feedYarnStructureRevision, snapshot.feedYarnStructureRevision);
    assert.equal(item.scope, "machine");
  }
  for (const item of result.occurrences) {
    assert.ok(item.sourceEvidence.originalCn.includes("no horizontal movement"));
    assert.equal(item.migrationChain[0].cnIndex, item.originalCnIndex);
    assert.equal(item.migrationChain.at(-1).cnIndex, item.finalCnIndex);
    for (const contact of item.migrationChain) {
      assert.equal(contact.cn, snapshot.contacts[contact.cnIndex].cn);
      assert.equal(contact.actualizationEvidence, "STATIC_PRE_FOLLOW_THE_YARN_COPY; NOT_OPERATION_HISTORY_OR_PHYSICAL_CONTACT");
    }
    assert.ok(!Object.hasOwn(item, "z"), "Source topology never assigns spatial Z");
  }
  assert.deepEqual(result.occurrences.filter(item => item.yarnIndex === 0 && item.cnType.endsWith("H") && item.i % 2 === 0)
    .map(item => item.migrationChain.map(contact => contact.cnIndex)), [[2234, 2334, 2434], [2334, 2434], [2434], [2534]]);
  assert.ok(result.cnReferences.some(item => item.occurrenceIds.length >= 6));
  assert.ok(result.spatialRelations.every(item => item.state === "UNKNOWN"));
  assert.ok(result.links.some(item => item.boundary === "CLIPPED"));
  assert.ok(result.links.some(item => item.boundary === "INTERNAL"));
  for (const link of result.links) {
    assert.equal(link.pathModel, snapshot.yarnStrands[link.yarnIndex].modelPathByLink.get(link.index));
    assert.equal(link.baseModelPath, snapshot.yarnStrands[link.yarnIndex].baseModelPathByLink.get(link.index));
    assert.equal(link.physicalContinuity, "UNKNOWN");
    assert.equal(link.units, "MODEL_NEEDLE_PITCH");
  }
  assert.equal(result.strands.length, 8);
  assert.ok(result.strands.every(item => item.materialState && item.linkIds.length));
  assert.ok(result.strands.every(strand => result.links.filter(link => link.strandId === strand.id).length === strand.linkIds.length));
  assert.equal(result.scale.machineGauge, 32);
  assert.equal(result.scale.needlePitchMm, 25.4 / 32);
  assert.equal(result.scale.physicalFabricScale, "UNKNOWN");
  assert.equal(result.metrics.M1.length, 8);
  assert.equal(result.metrics.M3.status, "NOT_AVAILABLE_IN_SNAPSHOT");
  assert.equal(result.metrics.M3.value, null);
  assert.ok(result.metrics.M1.every(item => item.window.includes("NOT_THIS_ROI")));
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.occurrences[0]));
  assert.throws(() => { result.occurrences[0].finalCnIndex = 0; }, TypeError);
  assert.equal(json(snapshot), before);
  assert.equal(json(project), projectBefore);
  assert.equal(buildSopTopology(null).status, "UNAVAILABLE");
  assert.equal(buildSopTopology({ ...snapshot, scope: "pattern" }).status, "UNSUPPORTED");
  assert.equal(buildSopTopology(snapshot, { needleIndex: -1 }).status, "UNSUPPORTED");
  assert.equal(buildSopTopology(snapshot, { rowStart: 59, rowEnd: 60 }).status, "UNSUPPORTED");
  assert.equal(buildSopTopology({ ...snapshot, contacts: [] }).status, "UNAVAILABLE");
  assert.equal(buildSopTopology({ ...snapshot, machineGauge: 0 }).status, "UNAVAILABLE");
  const missingPaths = snapshot.yarnStrands.map(item => ({ ...item, modelPathByLink: new Map() }));
  assert.equal(buildSopTopology({ ...snapshot, yarnStrands: missingPaths }).status, "UNAVAILABLE");
  const transferred = snapshot.contacts.map(item => ({ ...item, mv: [...item.mv] }));
  transferred[2234].mv[0] = 1;
  assert.equal(buildSopTopology({ ...snapshot, contacts: transferred }).status, "UNSUPPORTED");
  const changed = buildSopTopology({ ...snapshot, projectGeneration: 7 });
  assert.notEqual(changed.identity.key, result.identity.key);
  assert.notEqual(changed.occurrences[0].id, result.occurrences[0].id);
  assert.notEqual(changed.continuity.chains[0].id, result.continuity.chains[0].id);
  const revisited = buildSopTopology({ ...snapshot, feedYarnStructureRevision: 2 });
  assert.notEqual(revisited.identity.key, result.identity.key);
  assert.notEqual(revisited.continuity.chains[0].id, result.continuity.chains[0].id);
  for (const failure of [buildSopTopology(null), buildSopTopology({ ...snapshot, yarnStrands: missingPaths })]) {
    assert.equal(failure.mechanismEvidence, null, "Unavailable snapshot cannot retain a prior mechanism panel");
    assert.equal(failure.continuity.status, "UNAVAILABLE");
    assert.deepEqual(failure.continuity.chains, [], "Failure exposes no previous chain candidates");
    assert.deepEqual(failure.continuity.edges, []);
  }
  assert.equal(buildSopTopology(snapshot).identity.key, result.identity.key);
  assert.equal(buildSopTopology({ ...snapshot, scope: "pattern" }).mechanismEvidence, null);
  for (const needleIndex of [0, snapshot.pattern.width - 1]) {
    const edge = buildSopTopology(snapshot, { needleIndex, rowStart: 21, rowEnd: 24 });
    assert.equal(edge.status, "READY", edge.reason);
    assert.ok(edge.links.some(item => item.source.boundary === "EXTERNAL" || item.target.boundary === "EXTERNAL"));
    const transitions = edge.links.filter(item => item.crossRow);
    // The real snapshot has one padding needle: its row turns are outside the selectable fabric ROI.
    assert.equal(transitions.length, 0);
    for (const link of transitions) {
      assert.equal(link.physicalContinuity, "UNKNOWN");
      assert.equal(link.displayContinuity, "SERPENTINE_ROW_TRANSITION");
      assert.notEqual(link.source.strandId, link.target.strandId);
    }
  }
  const report = { validator: "sop-topology-adapter", status: "PASS", fixtureSha256,
    assertions,
    sourceCounts: { occurrences: snapshot.occurrences.length, links: snapshot.yarnPathLinks.length,
      solverResults: snapshot.originalSolverResults.length }, result };
  await fs.writeFile(path.join(archiveDir, "result.json"), JSON.stringify(report, null, 2));
  const columns = ["yarnIndex", "yarnId", "feedIndex", "row", "needle", "pathIndex", "cnType", "originalCnIndex", "finalCnIndex", "migrationChain", "id"];
  const cells = result.occurrences.map(item => columns.map(key => {
    const value = key === "migrationChain" ? item.migrationChain.map(contact => contact.cnIndex).join(" -> ") : item[key];
    return `"${String(value).replaceAll('"', '""')}"`;
  }).join(","));
  await fs.writeFile(path.join(archiveDir, "occurrences.csv"), [columns.join(","), ...cells].join("\n"));
  console.log(JSON.stringify({ validator: report.validator, status: report.status, fixtureSha256,
    assertions,
    sourceCounts: report.sourceCounts, operations: result.operations, localOccurrences: result.occurrences.length,
    localLinks: result.links.length, strands: result.strands.length, continuityCounts: result.continuity.counts,
    output: path.join(archiveDir, "result.json") }));
});
