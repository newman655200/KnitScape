import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ZipReader, Uint8ArrayReader, TextWriter } from "@zip.js/zip.js";
import { createPlainJerseyTopology } from "../src/fabricForm/fabricFormTopology.js";
import { createFabricFormInitialGeometry } from "../src/fabricForm/fabricFormInitialGeometry.js";
import { resolveSingleJerseyOperations } from "../src/domain/singleJerseyMachine.js";
import { createPlainJerseyTopology as createLegacyPlainJerseyTopology } from "./lib/legacyPlainJerseyTopology.mjs";
import { compileKnitGraph } from "../src/fabricForm/topology/knitGraph.js";
import { discretizeKnitGraph } from "../src/fabricForm/topology/discretize.js";
import { stockinetteSabetta } from "../src/fabricForm/topology/stitchTemplates.js";

const singleLoopGraph = compileKnitGraph({ operations: [["K"]], m: 1, n: 1 });
assert.deepEqual(singleLoopGraph.loops[0].passesThrough,
  [{ itemId: 0, kind: "loop", p: 0, q: -1 }], "A one-feed loop references its previous periodic image.");
assert.throws(() => compileKnitGraph({ operations: [["K"]], m: 0, n: 1 }), RangeError);
assert.throws(() => compileKnitGraph({ operations: [["K"]], m: 1, n: 1.5 }), RangeError);
assert.throws(() => compileKnitGraph({ operations: [["K"], []], m: 1, n: 2 }), TypeError);
assert.throws(() => compileKnitGraph({ operations: [["P"]], m: 1, n: 1 }), TypeError);

function compareTopology(options, label) {
  assert.deepEqual(
    createPlainJerseyTopology(structuredClone(options)),
    createLegacyPlainJerseyTopology(structuredClone(options)),
    label,
  );
}

const dimensions = { m: [1, 2, 3, 4], n: [1, 2, 4, 8], nodesPerLoop: [16, 24, 32, 48, 64] };
let gridCases = 0;
for (const m of dimensions.m) {
  for (const n of dimensions.n) {
    for (const nodesPerLoop of dimensions.nodesPerLoop) {
      compareTopology({ m, n, nodesPerLoop }, `m=${m}, n=${n}, nodesPerLoop=${nodesPerLoop}`);
      gridCases++;
    }
  }
}
assert.equal(gridCases, 80, "The required topology grid contains 4 × 4 × 5 cases.");

const compatibleInputs = [
  ["default options", undefined],
  ["empty options", {}],
  ["explicit undefined defaults", { m: undefined, n: undefined, nodesPerLoop: undefined,
    loopLengthMm: undefined, camProgram: undefined, needleArrangement: undefined }],
  ["minimum node count", { nodesPerLoop: 3 }],
  ["non-default loop length", { m: 2, n: 3, loopLengthMm: 2.6 }],
  ["repeated Cam and needle arrangement", { m: 4, n: 8, nodesPerLoop: 24, loopLengthMm: 3.5,
    camProgram: { tracks: [["K", "K"], ["K", "K"], ["K", "K"]] },
    needleArrangement: [3, 1, 3, 2] }],
  ["single yarn feed metadata", { camProgram: { tracks: [["K"]], feeds: [{ yarns: ["main"] }] } }],
];
for (const [label, options] of compatibleInputs) compareTopology(options, label);

function errorResult(createTopology, options, label) {
  try {
    createTopology(structuredClone(options));
  } catch (error) {
    return { name: error.name, message: error.message, code: error.code };
  }
  assert.fail(`${label}: expected an error.`);
}

const rejectedInputs = [
  ["zero m", { m: 0 }],
  ["fractional m", { m: 1.5 }],
  ["negative n", { n: -1 }],
  ["fractional n", { n: 1.5 }],
  ["too few nodes", { nodesPerLoop: 2 }],
  ["fractional nodes", { nodesPerLoop: 3.5 }],
  ["zero loop length", { loopLengthMm: 0 }],
  ["infinite loop length", { loopLengthMm: Infinity }],
  ["NaN loop length", { loopLengthMm: NaN }],
  ["missing Cam tracks", { camProgram: {} }],
  ["empty Cam tracks", { camProgram: { tracks: [] } }],
  ["empty Cam feeds", { camProgram: { tracks: [[]] } }],
  ["non-rectangular Cam", { camProgram: { tracks: [["K"], ["K", "K"]] } }],
  ["invalid operation", { camProgram: { tracks: [["P"]] } }],
  ["empty needle arrangement", { needleArrangement: [] }],
  ["invalid needle type", { needleArrangement: [0] }],
  ["missing needle track", { needleArrangement: [2] }],
  ["tuck with feed and needle location", { m: 2, n: 2,
    camProgram: { tracks: [["K", "K"], ["K", "T"]] }, needleArrangement: [1, 2] }],
  ["miss with feed and needle location", { m: 2, n: 2,
    camProgram: { tracks: [["K", "K"], ["K", "M"]] }, needleArrangement: [1, 2] }],
  ["multiple yarns per feed", { camProgram: { tracks: [["K"]], feeds: [{ yarns: ["main", "plating"] }] } }],
  ["operation error precedes multiple-yarn error", {
    camProgram: { tracks: [["T"]], feeds: [{ yarns: ["main", "plating"] }] } }],
  ["m error precedes n and node errors", { m: 0, n: 0, nodesPerLoop: 0 }],
  ["n error precedes node and length errors", { n: 0, nodesPerLoop: 0, loopLengthMm: 0 }],
  ["node error precedes length and Cam errors", { nodesPerLoop: 0, loopLengthMm: 0, camProgram: {} }],
  ["length error precedes Cam errors", { loopLengthMm: 0, camProgram: {} }],
  ["Cam error precedes needle errors", { camProgram: {}, needleArrangement: [] }],
  ["first unsupported action follows feed-major order", { m: 2, n: 2,
    camProgram: { tracks: [["K", "T"], ["M", "K"]] }, needleArrangement: [1, 2] }],
];
for (const [label, options] of rejectedInputs) {
  assert.deepEqual(
    errorResult(createPlainJerseyTopology, options, label),
    errorResult(createLegacyPlainJerseyTopology, options, label),
    `${label}: error name, message, and code must remain compatible.`,
  );
}

// SOP-001 must come from the actual project package and the Machine Domain.
// Assertions describe the fixture; they never replace it with a hand-written matrix.
const sopPath = new URL("./fixtures/SOP-001-N6W6040-main-yarn-with-cam.knitscape", import.meta.url);
const zip = new ZipReader(new Uint8ArrayReader(await readFile(sopPath)), { useWebWorkers: false });
let sopProject;
try {
  const projectEntry = (await zip.getEntries()).find(entry => entry.filename === "project.json");
  assert.ok(projectEntry, "SOP-001 fixture must contain project.json.");
  sopProject = JSON.parse(await projectEntry.getData(new TextWriter(), { checkSignature: true }));
} finally {
  await zip.close();
}
assert.deepEqual(sopProject.needleArrangement, [1, 2, 3, 4]);
assert.deepEqual(sopProject.singleJerseyCamProgram.tracks.map(track => track.join("")),
  ["KKKKKKTT", "KKKKTTKK", "KKTTKKKK", "TTKKKKKK"], "SOP-001 Cam must match the task's checked fixture.");
const sopOperations = resolveSingleJerseyOperations(
  sopProject.singleJerseyCamProgram, sopProject.needleArrangement, 4, 8);
const countOperation = (actions, operation) => actions.filter(value => value === operation).length;
assert.equal(countOperation(sopOperations.flat(), "K"), 24);
assert.equal(countOperation(sopOperations.flat(), "T"), 8);
for (const row of sopOperations) {
  assert.equal(countOperation(row, "K"), 3);
  assert.equal(countOperation(row, "T"), 1);
}
for (let needle = 0; needle < 4; needle++) {
  const column = sopOperations.map(row => row[needle]);
  assert.equal(countOperation(column, "K"), 6);
  assert.equal(countOperation(column, "T"), 2);
}
const sopBefore = structuredClone(sopOperations);
const sopGraph = compileKnitGraph({ operations: sopOperations, m: 4, n: 8 });
assert.deepEqual(sopOperations, sopBefore, "Compiling must not mutate the authoritative actions.");
assert.deepEqual(sopGraph, compileKnitGraph({ operations: sopOperations, m: 4, n: 8 }),
  "Graph compilation is deterministic.");
assert.deepEqual(sopGraph.operations, sopOperations);
assert.equal(sopGraph.actions.length, 32);
assert.equal(sopGraph.loops.length, 24);
assert.equal(sopGraph.tuckArcs.length, 8);
assert.equal(sopGraph.yarns.length, 8);
for (let feed = 0; feed < 8; feed++) {
  const yarn = sopGraph.yarns[feed];
  assert.equal(yarn.yarnId, feed);
  assert.equal(yarn.feed, feed);
  assert.deepEqual(yarn.materialOrder, [0, 1, 2, 3].map(needle => feed * 4 + needle));
  for (let needle = 0; needle < 4; needle++) {
    const id = feed * 4 + needle;
    assert.deepEqual(sopGraph.actions[id], { id, feed, needle, yarnId: feed,
      order: needle, operation: sopOperations[feed][needle], itemId: id });
  }
}

const afterDoubleTuck = [
  { needle: 0, feed: 0, held: [[5, -1], [6, -1], [7, -1]] },
  { needle: 1, feed: 6, held: [[3, 0], [4, 0], [5, 0]] },
  { needle: 2, feed: 4, held: [[1, 0], [2, 0], [3, 0]] },
  { needle: 3, feed: 2, held: [[7, -1], [0, 0], [1, 0]] },
];
for (const { needle, feed, held } of afterDoubleTuck) {
  const loop = sopGraph.loops.find(item => item.feed === feed && item.needle === needle);
  assert.ok(loop);
  assert.deepEqual(loop.passesThrough, held.map(([heldFeed, q], index) => ({
    itemId: heldFeed * 4 + needle, kind: index === 0 ? "loop" : "tuckArc", p: 0, q,
  })), `SOP needle ${needle}, feed ${feed} must pass through the old loop and both tuck arcs.`);
}
const graphItems = new Map([
  ...sopGraph.loops.map(item => [item.id, { item, kind: "loop" }]),
  ...sopGraph.tuckArcs.map(item => [item.id, { item, kind: "tuckArc" }]),
]);
assert.equal(graphItems.size, 32, "Loop and tuck-arc IDs must be unique.");
for (const loop of sopGraph.loops) {
  const isAfterDoubleTuck = afterDoubleTuck.some(item => item.needle === loop.needle && item.feed === loop.feed);
  if (!isAfterDoubleTuck) {
    assert.deepEqual(loop.passesThrough, [{ itemId: ((loop.feed + 7) % 8) * 4 + loop.needle,
      kind: "loop", p: 0, q: loop.feed === 0 ? -1 : 0 }], "Every other K passes through exactly the previous loop.");
  }
  for (const reference of loop.passesThrough) {
    const target = graphItems.get(reference.itemId);
    assert.ok(target, "Every periodic reference resolves to an item in the graph.");
    assert.equal(reference.kind, target.kind);
    assert.equal(target.item.needle, loop.needle);
    assert.equal(reference.p, 0);
    assert.ok(Number.isInteger(reference.q));
    assert.ok(target.item.feed + reference.q * 8 < loop.feed, "A held item precedes its consuming K.");
  }
}

const geometryFields = new Set(["positions", "coordinates", "nodeCount", "nodesPerLoop", "nodeIndices",
  "edgeIndices", "edges", "bends", "length", "loopLengthMm", "restLength", "materialLength", "materialStart",
  "crossingConvention", "crossings", "orientation", "over", "W", "H", "S", "x", "y", "z"]);
function assertPureTopology(value) {
  if (Array.isArray(value)) return value.forEach(assertPureTopology);
  if (value === null || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    assert.ok(!geometryFields.has(key), `Pure KnitGraph must not contain geometry field ${key}.`);
    assertPureTopology(item);
  }
}
assertPureTopology(sopGraph);

const missGraph = compileKnitGraph({ operations: [["K"], ["T"], ["M"], ["K"], ["M"]], m: 1, n: 5 });
assert.deepEqual(missGraph.loops.find(loop => loop.feed === 3).passesThrough,
  [{ itemId: 0, kind: "loop", p: 0, q: 0 }, { itemId: 1, kind: "tuckArc", p: 0, q: 0 }],
  "M preserves the loop and tuck already held by the needle.");
assert.deepEqual(missGraph.loops[0].passesThrough, [{ itemId: 3, kind: "loop", p: 0, q: -1 }],
  "K resets holding; a following M preserves only that new loop across the boundary.");
assert.equal(missGraph.actions[2].itemId, null);
assert.equal(missGraph.actions[4].itemId, null);
assert.equal(missGraph.tuckArcs.length, 1);
const boundaryMissGraph = compileKnitGraph({ operations: [["M"], ["T"], ["M"], ["K"], ["T"], ["M"]], m: 1, n: 6 });
assert.deepEqual(boundaryMissGraph.loops[0].passesThrough, [
  { itemId: 3, kind: "loop", p: 0, q: -1 },
  { itemId: 4, kind: "tuckArc", p: 0, q: -1 },
  { itemId: 1, kind: "tuckArc", p: 0, q: 0 },
], "M preserves holding while tuck arcs accumulate on both sides of the period boundary.");
const noKnitGraph = compileKnitGraph({ operations: [["T"], ["M"], ["T"]], m: 1, n: 3 });
assert.equal(noKnitGraph.loops.length, 0);
assert.deepEqual(noKnitGraph.tuckArcs.map(item => item.id), [0, 2]);
assertPureTopology(missGraph);
assertPureTopology(boundaryMissGraph);
assertPureTopology(noKnitGraph);

for (const operation of ["T", "M"]) {
  const graph = compileKnitGraph({ operations: [[operation]], m: 1, n: 1 });
  assert.throws(() => discretizeKnitGraph(graph, { nodesPerLoop: 16, loopLengthMm: 3,
    template: stockinetteSabetta, feedMetadata: [{ yarns: ["main", "plating"] }] }),
  { code: "UNSUPPORTED_IN_STEP1", message: `UNSUPPORTED_IN_STEP1: ${operation} at feed 0, needle 0.` },
  "Graph support for T/M must not enable their discretization, and action rejection precedes yarn rejection.");
}
assert.throws(() => discretizeKnitGraph(singleLoopGraph, { nodesPerLoop: 16, loopLengthMm: 3,
  template: stockinetteSabetta, feedMetadata: [{ yarns: ["main", "plating"] }] }),
{ code: "UNSUPPORTED_IN_STEP1", message: "UNSUPPORTED_IN_STEP1: multiple yarns per feed." });
const multipleYarnGraph = structuredClone(singleLoopGraph);
multipleYarnGraph.yarns.push({ ...multipleYarnGraph.yarns[0], yarnId: 1 });
assert.throws(() => discretizeKnitGraph(multipleYarnGraph, { nodesPerLoop: 16, loopLengthMm: 3,
  template: stockinetteSabetta }),
{ code: "UNSUPPORTED_IN_STEP1", message: "UNSUPPORTED_IN_STEP1: multiple yarns per feed." },
"The graph's own yarn records must reject multiple yarns in a feed without adapter metadata.");
const multipleTuckYarnGraph = compileKnitGraph({ operations: [["T"]], m: 1, n: 1 });
multipleTuckYarnGraph.yarns.push({ ...multipleTuckYarnGraph.yarns[0], yarnId: 1 });
assert.throws(() => discretizeKnitGraph(multipleTuckYarnGraph, {}),
{ code: "UNSUPPORTED_IN_STEP1", message: "UNSUPPORTED_IN_STEP1: T at feed 0, needle 0." },
"Action rejection also precedes rejection of multiple yarns recorded directly in the graph.");
assert.deepEqual(discretizeKnitGraph(singleLoopGraph, {}), createPlainJerseyTopology(),
  "The direct graph/discretization path retains the old defaults and complete output.");

assert.equal(stockinetteSabetta.id, "stockinette-sabetta");
assert.deepEqual(stockinetteSabetta.crossings, [
  { over: -1, orientation: -1, targetNeedleOffset: 0 },
  { over: -1, orientation: 1, targetNeedleOffset: 0 },
  { over: 1, orientation: -1, targetNeedleOffset: 0 },
  { over: 1, orientation: 1, targetNeedleOffset: 1 },
]);
assert.deepEqual(stockinetteSabetta.crossingConvention, createLegacyPlainJerseyTopology().crossingConvention);
assert.deepEqual(stockinetteSabetta.seed, {
  source: "sabetta/stitch-by-stitch", commit: "0ed27f35dcf5c3bda874f214bbcab0455055edf0",
});
const initialGeometry = createFabricFormInitialGeometry(createPlainJerseyTopology({ nodesPerLoop: 16 }));
assert.equal(initialGeometry.initialization.source, stockinetteSabetta.seed.source);
assert.equal(initialGeometry.initialization.commit, stockinetteSabetta.seed.commit);
assert.ok(!("templateId" in initialGeometry.initialization));
assert.ok(!("templateId" in initialGeometry.topology));

// References are deliberately changed so recomputing "previous feed" here cannot pass.
const graphReferences = compileKnitGraph({ operations: [["K", "K"], ["K", "K"], ["K", "K"]], m: 2, n: 3 });
graphReferences.loops[4].passesThrough = [{ itemId: 1, kind: "loop", p: 2, q: -3 }];
graphReferences.loops[5].passesThrough = [{ itemId: 0, kind: "loop", p: -2, q: 4 }];
const referencedTopology = discretizeKnitGraph(graphReferences, { nodesPerLoop: 16, loopLengthMm: 3, template: stockinetteSabetta });
assert.deepEqual(referencedTopology.loops[4].passesThrough, { loopId: 1, p: 2, q: -3, crossings: [
  { loopId: 1, p: 2, q: -3, over: -1, orientation: -1 },
  { loopId: 1, p: 2, q: -3, over: -1, orientation: 1 },
  { loopId: 1, p: 2, q: -3, over: 1, orientation: -1 },
  { loopId: 0, p: -2, q: 4, over: 1, orientation: 1 },
] });
assert.deepEqual(referencedTopology.loops[5].passesThrough.crossings[3],
  { loopId: 1, p: 3, q: -3, over: 1, orientation: 1 },
  "The template's adjacent material interval adds its horizontal periodic image offset.");
const customTemplate = structuredClone(stockinetteSabetta);
customTemplate.crossings[0].over = 1;
customTemplate.crossings[0].orientation = 1;
customTemplate.crossings[3].targetNeedleOffset = 0;
customTemplate.crossingConvention.source = "validator template";
const customTopology = discretizeKnitGraph(graphReferences, { nodesPerLoop: 16, loopLengthMm: 3, template: customTemplate });
assert.equal(customTopology.loops[4].passesThrough.crossings[0].over, 1);
assert.equal(customTopology.loops[4].passesThrough.crossings[0].orientation, 1);
assert.deepEqual(customTopology.loops[4].passesThrough.crossings[3],
  { loopId: 1, p: 2, q: -3, over: 1, orientation: 1 });
assert.equal(customTopology.crossingConvention.source, "validator template");
const mutableTopology = createPlainJerseyTopology();
mutableTopology.crossingConvention.source = "caller mutation";
mutableTopology.loops[0].passesThrough.crossings[0].over = 99;
mutableTopology.operations[0][0] = "T";
assert.deepEqual(createPlainJerseyTopology(), createLegacyPlainJerseyTopology(),
  "Template data must produce fresh independently mutable legacy topology objects.");

console.log(`fabric-form topology equivalence: PASS (${gridCases} grid cases, ` +
  `${compatibleInputs.length} compatible inputs, ${rejectedInputs.length} compatible errors; ` +
  "SOP-001 24K/8T, periodic holding, M, pure graph, graph-driven discretization and template checks)");
