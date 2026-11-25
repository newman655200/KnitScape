import assert from "node:assert/strict";
import { createPlainJerseyTopology } from "../src/fabricForm/fabricFormTopology.js";
import { createPlainJerseyTopology as createLegacyPlainJerseyTopology } from "./lib/legacyPlainJerseyTopology.mjs";

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
];
for (const [label, options] of rejectedInputs) {
  assert.deepEqual(
    errorResult(createPlainJerseyTopology, options, label),
    errorResult(createLegacyPlainJerseyTopology, options, label),
    `${label}: error name, message, and code must remain compatible.`,
  );
}

console.log(`fabric-form topology equivalence: PASS (${gridCases} grid cases, ` +
  `${compatibleInputs.length} compatible inputs, ${rejectedInputs.length} compatible errors)`);
