import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createFabricFormInitialGeometry } from "../src/fabricForm/fabricFormInitialGeometry.js";
import { evaluateFabricCell } from "../src/fabricForm/solveFabricCell.js";
import { evaluateLengthConstraints } from "../src/fabricForm/rodBending.js";
import { safePeriodicStep, diagnosePeriodicContact } from "../src/fabricForm/periodicContact.js";
import { fabricFormMetrics } from "../src/fabricForm/fabricFormMetrics.js";
import { createT1PlainJerseyModel } from "../src/fabricForm/model/t1PlainJerseyModel.js";
import { assertDofBytes } from "./lib/fabricFormDofLayoutChecks.mjs";
import { assertCases, currentHead, evalBaselineFile, goldenCases, inputHash, normalizedSolveJson,
  parseGoldenArguments, readInput, readJson, runtime, sha256, solveBaselineFile, writeJson } from "./lib/fabricFormGolden.mjs";

/** Hash structure and all values; preserve IEEE-754 bytes, including signed zero.
 * Float64Array views are hashed as their original bytes, never JSON or rounded text. */
function hashValues(value) {
  const hash = createHash("sha256");
  const tag = (kind, detail = "") => hash.update(JSON.stringify([kind, detail]) + "\n");
  const visit = item => {
    if (item instanceof Float64Array) {
      tag("Float64Array", item.length);
      hash.update(Buffer.from(item.buffer, item.byteOffset, item.byteLength));
    } else if (typeof item === "number") {
      tag("number");
      const bytes = Buffer.allocUnsafe(8);
      bytes.writeDoubleLE(item);
      hash.update(bytes);
    } else if (Array.isArray(item)) {
      tag("array", item.length);
      item.forEach(visit);
    } else if (item !== null && typeof item === "object") {
      assert.equal(Object.getPrototypeOf(item), Object.prototype, "Unsupported output object in golden hash");
      const keys = Object.keys(item);
      tag("object", keys.length);
      for (const key of keys) { tag("key", key); visit(item[key]); }
    } else {
      assert.ok(item === null || ["string", "boolean", "undefined"].includes(typeof item), "Unsupported golden output value");
      tag(item === null ? "null" : typeof item, item);
    }
  };
  visit(value);
  return hash.digest("hex");
}

function evaluate(cell, params, quadratureOrder) {
  const evaluation = evaluateFabricCell(cell, params, quadratureOrder);
  const direction = Float64Array.from(evaluation.gradient, value => -value);
  const outputs = {
    evaluateFabricCell: evaluation,
    evaluateLengthConstraints: evaluateLengthConstraints(cell),
    safePeriodicStep: safePeriodicStep(cell, direction, params, 1),
    diagnosePeriodicContact: diagnosePeriodicContact(cell, params, { quadratureOrder }),
    fabricFormMetrics: fabricFormMetrics(cell, params),
  };
  // R4-1(e): compare all 14 model constraint/safety outputs without changing the golden payload.
  const model = createT1PlainJerseyModel(params, { quadratureOrder });
  const label = `STOP #3: R4-1(e) N${cell.topology.nodesPerLoop} l=${cell.topology.loopLengthMm} W=${cell.W} H=${cell.H} S=${cell.S}`;
  const constraints = model.constraintsAt(cell), direct = outputs.evaluateLengthConstraints;
  assert.deepEqual(Object.keys(constraints), Object.keys(direct), `${label}: constraints key order`);
  assertDofBytes(constraints.values, direct.values, `${label}: constraints.values`);
  assert.equal(constraints.jacobian.length, direct.jacobian.length, `${label}: jacobian row count`);
  for (let row = 0; row < direct.jacobian.length; row++) {
    assertDofBytes(constraints.jacobian[row], direct.jacobian[row], `${label}: constraints.jacobian[${row}]`);
  }
  assertDofBytes(Float64Array.of(constraints.maxStrain), Float64Array.of(direct.maxStrain), `${label}: constraints.maxStrain`);
  assertDofBytes(Float64Array.of(model.safeStep(cell, direction, 1)), Float64Array.of(outputs.safePeriodicStep), `${label}: safeStep`);
  return { sha256: hashValues(outputs),
    components: Object.fromEntries(Object.entries(outputs).map(([name, value]) => [name, hashValues(value)])) };
}

const options = parseGoldenArguments(process.argv.slice(2), ["--establish-baseline"]);
const establishing = Boolean(options["--establish-baseline"]);
if (establishing) assert.ok(!fs.existsSync(evalBaselineFile), "Refusing to overwrite the evaluation golden baseline");
const solveBaseline = readJson(solveBaselineFile);
assertCases(solveBaseline);
const expected = establishing ? null : readJson(evalBaselineFile);
if (expected) assertCases(expected);
const actualRuntime = runtime();
if (expected) assert.equal(actualRuntime.endianness, expected.runtime.endianness, "Byte-order differs from the evaluation baseline machine");
const report = { schemaVersion: 1, head: currentHead(), sourceHead: solveBaseline.sourceHead,
  runtime: actualRuntime, mode: establishing ? "ESTABLISH_BASELINE" : "COMPARE_GOLDEN",
  direction: "negative evaluateFabricCell gradient for each evaluated cell; safePeriodicStep limit=1",
  status: "RUNNING", cases: [] };
const reportFile = options.archiveDirectory ? path.join(options.archiveDirectory, "eval-report.json") : null;
const baselineArchive = process.env.FABRIC_FORM_GOLDEN_BASELINE_ARCHIVE ?? solveBaseline.archiveDirectory;
const started = performance.now();
try {
  for (const [index, scenario] of goldenCases.entries()) {
    const input = readInput(scenario);
    const result = readJson(path.join(baselineArchive, solveBaseline.cases[index].resultFile));
    assert.equal(sha256(normalizedSolveJson(result)), solveBaseline.cases[index].sha256,
      `${scenario.id}: original baseline result file was changed`);
    assert.deepEqual(result.params, input.params, `${scenario.id}: baseline parameters disagree with input`);
    let initial = input.initialCell ?? createFabricFormInitialGeometry(input.topology, input.params);
    if (input.lockedDimensions !== undefined) initial = { ...initial, W: input.lockedDimensions.W, H: input.lockedDimensions.H };
    const quadratureOrder = input.quadratureOrder ?? 12;
    const row = { id: scenario.id, inputSha256: inputHash(scenario),
      initial: evaluate(initial, input.params, quadratureOrder),
      final: evaluate(result.cell, input.params, quadratureOrder) };
    report.cases.push(row);
    if (expected) assert.deepEqual(row, expected.cases[index], `STOP #1: ${scenario.id}: evaluation golden mismatch; do not update the baseline`);
    console.log(`${establishing ? "RECORDED" : "MATCH"} ${scenario.id} initial+final (5 functions each)`);
  }
  report.elapsedMs = performance.now() - started;
  report.status = "PASS";
  if (establishing) writeJson(evalBaselineFile, report, { exclusive: true });
  if (reportFile) writeJson(reportFile, report);
  console.log(`${report.cases.length}/${goldenCases.length} evaluation goldens ${establishing ? "established" : "match"}; elapsedMs=${report.elapsedMs.toFixed(3)}`);
} catch (error) {
  report.elapsedMs = performance.now() - started;
  report.status = "FAIL";
  report.error = error.message;
  if (reportFile) writeJson(reportFile, report);
  throw error;
}
