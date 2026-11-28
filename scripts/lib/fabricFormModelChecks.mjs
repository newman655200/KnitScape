import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { createPlainJerseyTopology } from "../../src/fabricForm/fabricFormTopology.js";
import { createFabricFormParams } from "../../src/fabricForm/fabricFormParams.js";
import { createFabricFormInitialGeometry } from "../../src/fabricForm/fabricFormInitialGeometry.js";
import { evaluateRodBending, evaluateLengthConstraints } from "../../src/fabricForm/rodBending.js";
import { evaluatePeriodicContact, safePeriodicStep, diagnosePeriodicContact } from "../../src/fabricForm/periodicContact.js";
import { evaluateFabricCell, packFabricCell, solveFabricCell } from "../../src/fabricForm/solveFabricCell.js";
import { assertDofBytes } from "./fabricFormDofLayoutChecks.mjs";

const bytes = values => Buffer.from(values.buffer, values.byteOffset, values.byteLength);
const scalarBytes = value => bytes(Float64Array.of(value));
const withoutElapsed = result => {
  const copy = structuredClone(result);
  delete copy.diagnostics.elapsedMs;
  return copy;
};

export async function runFabricFormModelChecks() {
  const modelUrl = new URL("../../src/fabricForm/model/fabricModel.js", import.meta.url);
  assert.ok(existsSync(modelUrl), "R1-2 requires the ordered fabric model composition module");
  const { createFabricModel } = await import(modelUrl);
  const { createT1PlainJerseyModel } = await import("../../src/fabricForm/model/t1PlainJerseyModel.js");
  const topology = createPlainJerseyTopology({ nodesPerLoop: 24 });
  const params = createFabricFormParams();
  const cell = createFabricFormInitialGeometry(topology, params);
  const quadratureOrder = 4;
  const model = createT1PlainJerseyModel(params, { quadratureOrder });
  assert.equal(model.id, "T1_PLAIN_JERSEY");
  assert.deepEqual(model.terms.map(term => term.id), ["bending", "contact"]);
  assert.deepEqual(model.constraints.map(constraint => constraint.id), ["segmentLength"]);

  const bending = evaluateRodBending(cell, params.B);
  const contact = evaluatePeriodicContact(cell, params, { quadratureOrder });
  const legacy = { energy: bending.energy + contact.energy,
    gradient: Float64Array.from(bending.gradient, (value, i) => value + contact.gradient[i]),
    bendingEnergy: bending.energy, contact };
  const wrapper = evaluateFabricCell(cell, params, quadratureOrder);
  assert.deepEqual(Object.keys(wrapper), ["energy", "gradient", "bendingEnergy", "contact"]);
  assert.deepEqual(wrapper, legacy, "The compatibility evaluator retains all original values and fields");
  assert.deepEqual(bytes(wrapper.gradient), bytes(legacy.gradient));
  const base = model.evaluate(cell);
  assert.deepEqual(scalarBytes(base.energy), scalarBytes(legacy.energy));
  assert.deepEqual(bytes(base.gradient), bytes(legacy.gradient));
  assert.deepEqual(base.details.bending, bending);
  assert.deepEqual(base.details.contact, contact);
  assert.equal(base.feasible, true);
  assert.deepEqual(model.constraintsAt(cell), evaluateLengthConstraints(cell));
  const direction = Float64Array.from(base.gradient, value => -value);
  assert.equal(model.safeStep(cell, direction, .75), safePeriodicStep(cell, direction, params, .75));
  assert.deepEqual(model.diagnose(cell), { contact: diagnosePeriodicContact(cell, params, { quadratureOrder }) });
  assert.deepEqual(createT1PlainJerseyModel(params).evaluate(cell).details.contact,
    evaluatePeriodicContact(cell, params), "The model preserves the public Q12 default");

  let zeroCalls = 0;
  const zero = { id: "zero", evaluate(actualCell, { layout }) {
    zeroCalls++;
    assert.equal(actualCell, cell);
    assert.equal(layout.size, base.gradient.length);
    return { energy: 0, gradient: new Float64Array(layout.size), details: { visited: true } };
  } };
  model.terms.push(zero);
  const withZero = model.evaluate(cell);
  assert.equal(zeroCalls, 1, "Appending a registered term must actually evaluate it");
  assert.deepEqual(scalarBytes(withZero.energy), scalarBytes(base.energy), "A zero term preserves energy bytes");
  assert.deepEqual(bytes(withZero.gradient), bytes(base.gradient), "A zero term preserves every gradient byte");
  assert.deepEqual(withZero.details.zero, { visited: true });

  const simpleCell = { positions: [[0, 0, 0]], W: 1, H: 1, S: 0 };
  const order = [];
  const term = (id, value, feasible) => ({ id, evaluate(_cell, { layout }) {
    order.push(id);
    return { energy: value, gradient: new Float64Array(layout.size).fill(value), feasible, details: { id } };
  } });
  const ordered = createFabricModel({ id: "ordered", terms: [term("a", 1e16), term("b", -1e16), term("c", 1)], constraints: [] });
  const orderedValue = ordered.evaluate(simpleCell);
  assert.deepEqual(order, ["a", "b", "c"]);
  assert.equal(orderedValue.energy, 1, "Energy sums must preserve registration order and floating-point association");
  assert.deepEqual(Array.from(orderedValue.gradient), Array(6).fill(1));
  assert.equal(orderedValue.feasible, true, "Omitted feasible defaults to true");
  const signed = createFabricModel({ id: "signed-zero", terms: [term("negativeZero", -0)], constraints: [] }).evaluate(simpleCell);
  assert.deepEqual(scalarBytes(signed.energy), scalarBytes(-0), "The first term is not added to a synthetic positive zero");
  assert.deepEqual(bytes(signed.gradient), bytes(new Float64Array(6).fill(-0)));
  const rejected = createFabricModel({ id: "rejected", terms: [term("reject", 1, false), term("after", 2, true)], constraints: [] });
  order.length = 0;
  const rejectedValue = rejected.evaluate(simpleCell);
  assert.equal(rejectedValue.feasible, false);
  assert.deepEqual(order, ["reject", "after"], "Feasibility aggregation must not skip later energy evaluations");
  assert.equal(rejectedValue.energy, 3);
  assert.throws(() => createFabricModel({ id: "wrong-gradient", terms: [
    { id: "wrong", evaluate: () => ({ energy: 0, gradient: new Float64Array(5) }) },
  ], constraints: [] }).evaluate(simpleCell), "Each term must return layout.size gradient components");

  const firstConstraint = { values: Float64Array.of(-0, .25),
    jacobian: [Float64Array.of(1, 0, 0, 0, 0, 0), Float64Array.of(0, 1, 0, 0, 0, 0)], maxStrain: .25 };
  const secondConstraint = { values: Float64Array.of(-.5),
    jacobian: [Float64Array.of(0, 0, 1, 0, 0, 0)], maxStrain: .5 };
  const constraintCalls = [];
  const combined = createFabricModel({ id: "constraints", terms: [], constraints: [
    { id: "first", evaluate(actualCell) { assert.equal(actualCell, simpleCell); constraintCalls.push("first"); return firstConstraint; } },
  ] });
  combined.constraints.push({ id: "second", evaluate() { constraintCalls.push("second"); return secondConstraint; } });
  const constraints = combined.constraintsAt(simpleCell);
  assert.deepEqual(constraintCalls, ["first", "second"]);
  assert.deepEqual(bytes(constraints.values), bytes(Float64Array.of(-0, .25, -.5)));
  assert.deepEqual(constraints.jacobian, [...firstConstraint.jacobian, ...secondConstraint.jacobian]);
  assert.equal(constraints.maxStrain, .5);
  const empty = createFabricModel({ id: "empty", terms: [], constraints: [] });
  assert.deepEqual(empty.constraintsAt(simpleCell), { values: new Float64Array(0), jacobian: [], maxStrain: 0 });
  const emptyValue = empty.evaluate(simpleCell);
  assert.equal(emptyValue.energy, 0);
  assert.deepEqual(bytes(emptyValue.gradient), bytes(new Float64Array(6)));
  assert.equal(emptyValue.feasible, true);

  const safeCalls = [], diagnoseCalls = [], simpleDirection = new Float64Array(6).fill(1);
  const guarded = createFabricModel({ id: "guarded", terms: [term("unrestricted", 0)], constraints: [] });
  assert.equal(guarded.safeStep(simpleCell, simpleDirection, .9), .9);
  assert.deepEqual(guarded.diagnose(simpleCell), {});
  for (const [id, bound] of [["first", .6], ["second", .2], ["third", .4]]) {
    guarded.terms.push({ ...term(id, 0), safeStep(actualCell, actualDirection, limit) {
      assert.equal(actualCell, simpleCell); assert.equal(actualDirection, simpleDirection);
      safeCalls.push([id, limit]); return bound;
    }, diagnose(actualCell) { assert.equal(actualCell, simpleCell); diagnoseCalls.push(id); return { bound }; } });
  }
  assert.equal(guarded.safeStep(simpleCell, simpleDirection, .9), .2, "No registered term may enlarge an earlier safety bound");
  assert.deepEqual(safeCalls, [["first", .9], ["second", .6], ["third", .2]]);
  assert.deepEqual(guarded.diagnose(simpleCell), { first: { bound: .6 }, second: { bound: .2 }, third: { bound: .4 } });
  assert.deepEqual(diagnoseCalls, ["first", "second", "third"]);

  const solverInput = { topology, params, initialCell: cell, quadratureOrder, maxIterations: 1 };
  const defaultResult = solveFabricCell(solverInput);
  const explicitModel = createT1PlainJerseyModel(params, { quadratureOrder });
  const registeredCalls = { evaluate: 0, constraint: 0, safeStep: 0, diagnose: 0 };
  explicitModel.terms.push({ id: "registeredZero", evaluate(_cell, { layout }) {
    registeredCalls.evaluate++;
    return { energy: 0, gradient: new Float64Array(layout.size), details: {} };
  }, safeStep(_cell, _direction, limit) { registeredCalls.safeStep++; return limit; },
  diagnose() { registeredCalls.diagnose++; return {}; } });
  explicitModel.constraints.push({ id: "registeredEmpty", evaluate() {
    registeredCalls.constraint++;
    return { values: new Float64Array(0), jacobian: [], maxStrain: 0 };
  } });
  const explicitResult = solveFabricCell({ ...solverInput, model: explicitModel });
  assert.notEqual(defaultResult.status, "INFEASIBLE_INITIAL_GEOMETRY", "Compatibility comparison must exercise optimization");
  assert.ok(Object.values(registeredCalls).every(count => count > 0),
    "The solver must invoke added energy, constraint, safety and diagnostic registrations");
  assert.deepEqual(withoutElapsed(explicitResult), withoutElapsed(defaultResult));
  assert.equal(JSON.stringify(withoutElapsed(explicitResult)), JSON.stringify(withoutElapsed(defaultResult)),
    "Explicit and default models preserve the complete legacy return object and key order");
  const rejectedModel = createT1PlainJerseyModel(params, { quadratureOrder });
  rejectedModel.terms.push({ id: "rejectInitial", evaluate(_cell, { layout }) {
    return { energy: 0, gradient: new Float64Array(layout.size), feasible: false,
      details: { diagnostics: [{ code: "TEST_INITIAL_REJECTION" }] } };
  } });
  const rejectedInitial = solveFabricCell({ ...solverInput, model: rejectedModel });
  assert.equal(rejectedInitial.status, "INFEASIBLE_INITIAL_GEOMETRY");
  assert.equal(rejectedInitial.iterations, 0);
  assert.ok(rejectedInitial.diagnostics.reasons.some(reason => reason.code === "TEST_INITIAL_REJECTION"),
    "The non-contact term supplies the reason for rejecting the initial geometry");

  const initialCoordinates = packFabricCell(cell);
  const displacement = actualCell => Math.max(...Array.from(packFabricCell(actualCell),
    (value, i) => Math.abs(value - initialCoordinates[i])));
  const admissibleDisplacement = 1e-12 * topology.loopLengthMm;
  assert.ok(displacement(defaultResult.cell) > admissibleDisplacement,
    "The comparison solve must actually leave the small admissible neighborhood");
  const trialModel = createT1PlainJerseyModel(params, { quadratureOrder });
  const trialFeasibility = [];
  trialModel.terms.push({ id: "rejectDisplacedTrials", evaluate(actualCell, { layout }) {
    const feasible = displacement(actualCell) <= admissibleDisplacement;
    trialFeasibility.push(feasible);
    return { energy: 0, gradient: new Float64Array(layout.size), feasible, details: {} };
  } });
  const protectedResult = solveFabricCell({ ...solverInput, model: trialModel });
  assert.deepEqual(trialFeasibility.slice(0, 2), [true, true],
    "Both the original cell and the scaled optimizer initial state must remain feasible");
  assert.ok(trialFeasibility.includes(false), "At least one real trial must hit the additional feasibility boundary");
  assert.ok(displacement(protectedResult.cell) <= admissibleDisplacement,
    "A finite-energy trial rejected by a registered term must not become the accepted final cell");

  await runProbeModelChecks();
  await runDecoupledSolverChecks();
}

async function runProbeModelChecks() {
  const { createFabricModel } = await import("../../src/fabricForm/model/fabricModel.js");
  const { createT1PlainJerseyModel, createT1Terms, createT1Constraints, T1_DOF_BLOCKS } = await import("../../src/fabricForm/model/t1PlainJerseyModel.js");
  const { createKernelView } = await import("../../src/fabricForm/model/kernelView.js");
  const topology = createPlainJerseyTopology({ nodesPerLoop: 24 });
  const params = createFabricFormParams(), quadratureOrder = 4;
  const cell = { ...createFabricFormInitialGeometry(topology, params), probe: [.25, -.5] };
  const model = createT1PlainJerseyModel(params, { quadratureOrder });
  const baseline = model.evaluate(cell), constraints = model.constraintsAt(cell), diagnostics = model.diagnose(cell);
  assert.throws(() => evaluateFabricCell({ ...cell, positions: [] }, params, quadratureOrder),
    { name: "TypeError", message: "Invalid rod positions: expected finite 3D points" },
    "The new block-length guard preserves the existing empty-position evaluation error");
  for (const positions of [null, undefined, []]) {
    assert.throws(() => model.constraintsAt({ ...cell, positions }),
      { name: "TypeError", message: "Invalid rod positions: expected finite 3D points" },
      "T1 constraints retain the original rod-position error before layout validation");
  }
  const direction = Float64Array.from(baseline.gradient, value => -value);
  const safeStep = model.safeStep(cell, direction, 1);
  assertDofBytes(Float64Array.of(model.safeStep(cell, Array.from(direction), 1)), Float64Array.of(safeStep),
    "T1 safeStep retains ordinary numeric Array directions");
  const errorShape = action => {
    let error;
    try { action(); } catch (caught) { error = caught; }
    assert.ok(error, "The error compatibility fixture must actually reject its input");
    return { name: error.name, message: error.message };
  };
  const assertSafeError = (actualCell, actualParams, actualDirection, limit, label) => {
    const expected = errorShape(() => safePeriodicStep(actualCell, actualDirection, actualParams, limit));
    const actual = errorShape(() => createT1PlainJerseyModel(actualParams, { quadratureOrder }).safeStep(actualCell, actualDirection, limit));
    assert.deepEqual(actual, expected, label);
  };
  for (const invalid of [new Float64Array(direction.length - 1), new Float64Array(direction.length + 1), null]) {
    assertSafeError(cell, params, invalid, 1, "T1 safeStep retains invalid-direction error type and text");
  }
  for (const invalid of [null, "0", 0n, NaN, Infinity]) {
    const invalidDirection = Array.from(direction);
    invalidDirection[0] = invalid;
    assertSafeError(cell, params, invalidDirection, 1, `T1 safeStep must not coerce a ${typeof invalid} direction component`);
  }
  for (const limit of [-1, NaN, Infinity]) assertSafeError(cell, params, direction, limit, "T1 safeStep retains invalid-limit errors");
  const invalidParams = { ...params, K: 0 };
  const invalidCells = [{ ...cell, W: 0 }, { ...cell, positions: [] }, { ...cell, positions: null }];
  for (const actualCell of invalidCells) {
    for (const invalidDirection of [[], null, direction]) {
      assertSafeError(actualCell, params, invalidDirection, -1, "T1 safeStep retains cell-validation priority");
    }
    assert.deepEqual(errorShape(() => model.diagnose(actualCell)),
      errorShape(() => diagnosePeriodicContact(actualCell, params, { quadratureOrder })),
      "T1 diagnose retains cell-validation error type and text before layout construction");
  }
  for (const invalidDirection of [[], null, direction]) {
    assertSafeError(cell, invalidParams, invalidDirection, -1, "T1 safeStep retains parameter-validation priority");
  }
  assert.deepEqual(errorShape(() => createT1PlainJerseyModel(invalidParams, { quadratureOrder }).diagnose({ ...cell, positions: [] })),
    errorShape(() => diagnosePeriodicContact({ ...cell, positions: [] }, invalidParams, { quadratureOrder })),
    "T1 diagnose retains parameter validation before empty-position layout validation");
  const probe = { name: "probe", length: () => 2, scaleKind: "dimensionless", equilibrium: { kind: "maxAbs" },
    read: state => state.probe, write: (target, values) => { target.probe = Array.from(values); } };
  for (const insertion of [0, 1, 2]) {
    const blocks = [...T1_DOF_BLOCKS];
    blocks.splice(insertion, 0, probe);
    const extended = createFabricModel({ id: `probe-${insertion}`, terms: createT1Terms(params, { quadratureOrder }), constraints: createT1Constraints(), blocks });
    const layout = extended.createLayout(cell);
    const view = createKernelView(layout, ["positions", "lattice"], { lattice: ["W", "H", "S"] });
    const label = `STOP #3: R4-1(c) probe insertion ${insertion}`;
    const evaluation = extended.evaluate(cell);
    assertDofBytes(Float64Array.of(evaluation.energy), Float64Array.of(baseline.energy), `${label}: energy`);
    assertDofBytes(view.gather(evaluation.gradient), baseline.gradient, `${label}: gradient`);
    assertDofBytes(evaluation.gradient.subarray(layout.index("probe", 0), layout.index("probe", 0) + 2), new Float64Array(2), `${label}: probe gradient positive zero`);
    assert.deepEqual(evaluation.details, baseline.details, `${label}: kernel-local details`);
    const actualConstraints = extended.constraintsAt(cell);
    assertDofBytes(actualConstraints.values, constraints.values, `${label}: constraint values`);
    assert.equal(actualConstraints.jacobian.length, constraints.jacobian.length, `${label}: jacobian row count`);
    for (const [row, values] of actualConstraints.jacobian.entries()) {
      assertDofBytes(view.gather(values), constraints.jacobian[row], `${label}: jacobian row ${row}`);
      for (const i of [0, 1]) assert.ok(values[layout.index("probe", i)] === 0, `${label}: jacobian row ${row} probe ${i}`);
    }
    assertDofBytes(Float64Array.of(actualConstraints.maxStrain), Float64Array.of(constraints.maxStrain), `${label}: maxStrain`);
    const globalDirection = view.scatter(direction);
    globalDirection[layout.index("probe", 0)] = 1e3;
    globalDirection[layout.index("probe", 1)] = -1e3;
    assert.equal(extended.safeStep(cell, globalDirection, 1), safeStep, `${label}: safeStep`);
    assert.equal(extended.safeStep(cell, Array.from(globalDirection), 1), safeStep, `${label}: ordinary Array safeStep`);
    assert.throws(() => extended.safeStep(cell, direction, 1),
      { name: "RangeError", message: "Invalid finite step direction or maxStep." },
      "A T1-sized direction cannot bypass a larger global layout's length guard");
    assert.deepEqual(extended.diagnose(cell), diagnostics, `${label}: diagnose`);
  }

  const contexts = [];
  const expectedDirection = new Float64Array(model.createLayout(cell).size);
  const passthrough = { values: new Float64Array(0), jacobian: [], maxStrain: -0 };
  const contextual = createFabricModel({ id: "context-check", terms: [{ id: "context", evaluate(actualCell, ctx) {
    assert.equal(actualCell, cell); contexts.push(ctx);
    return { energy: 0, gradient: new Float64Array(ctx.layout.size), details: {} };
  }, safeStep(actualCell, actualDirection, limit, ctx) {
    assert.equal(actualCell, cell); assert.equal(actualDirection, expectedDirection); contexts.push(ctx); return limit;
  }, diagnose(actualCell, ctx) { assert.equal(actualCell, cell); contexts.push(ctx); return {}; } }], constraints: [{
    id: "context", evaluate(actualCell, ctx) { assert.equal(actualCell, cell); contexts.push(ctx); return passthrough; },
  }] });
  contextual.evaluate(cell);
  assert.equal(contextual.constraintsAt(cell), passthrough, "A single constraint retains the original result object and key order");
  contextual.safeStep(cell, expectedDirection, 1);
  contextual.diagnose(cell);
  assert.equal(contexts.length, 4);
  for (const ctx of contexts) assert.deepEqual(ctx.layout.blocks, contextual.createLayout(cell).blocks);
  assert.throws(() => createFabricModel({ id: "wrong-jacobian", terms: [], constraints: [{ id: "wrong", evaluate() {
    return { values: Float64Array.of(0), jacobian: [new Float64Array(1)], maxStrain: 0 };
  } }] }).constraintsAt(cell), /jacobian.*layout.size/, "Each constraint row must have layout.size components");
}

/** Retain the exact JSON comparison while reporting only its first differing field or key. */
function assertSameSolverJson(actual, expected, label) {
  const actualJson = JSON.stringify(actual), expectedJson = JSON.stringify(expected);
  if (actualJson === expectedJson) return;
  const firstDifference = (a, b, path) => {
    if (a === null || b === null || typeof a !== "object" || typeof b !== "object" ||
        Array.isArray(a) !== Array.isArray(b)) return path;
    const actualKeys = Object.keys(a), expectedKeys = Object.keys(b);
    for (let i = 0; i < Math.max(actualKeys.length, expectedKeys.length); i++) {
      if (actualKeys[i] !== expectedKeys[i]) {
        return `${path} key[${i}] (actual ${JSON.stringify(actualKeys[i])}, expected ${JSON.stringify(expectedKeys[i])})`;
      }
      const key = actualKeys[i];
      if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
        return firstDifference(a[key], b[key], Array.isArray(a) ? `${path}[${key}]` : `${path}.${key}`);
      }
    }
    return path;
  };
  const path = actualJson === undefined || expectedJson === undefined ? "$" :
    firstDifference(JSON.parse(actualJson), JSON.parse(expectedJson), "$");
  assert.fail(`${label}: first JSON difference at ${path}`);
}

async function runDecoupledSolverChecks() {
  const coreUrl = new URL("../../src/fabricForm/solve/solveFabricModel.js", import.meta.url);
  assert.ok(existsSync(coreUrl), "R4-2(f): the generic solve module must exist");
  const source = readFileSync(coreUrl, "utf8");
  for (const forbidden of [/\b(bending|contact|barrier|details|params|topology|r_c|d_e)\b/,
    /["'\x60](W|H|S)["'\x60]/, /\.(W|H|S)\b/]) {
    const match = forbidden.exec(source);
    assert.ok(match === null, `R4-2(f): forbidden source name ${match?.[0]} at character ${match?.index}`);
  }

  const { createFabricModel } = await import("../../src/fabricForm/model/fabricModel.js");
  const { createT1Terms, createT1Constraints, T1_DOF_BLOCKS } = await import("../../src/fabricForm/model/t1PlainJerseyModel.js");
  const { createT1Reporting } = await import("../../src/fabricForm/model/t1Reporting.js");
  const topology = createPlainJerseyTopology({ nodesPerLoop: 24 });
  const params = createFabricFormParams(), quadratureOrder = 4;
  const initialCell = { ...createFabricFormInitialGeometry(topology, params), probe: [.25, -.5] };
  const input = { topology, params, initialCell, quadratureOrder, maxIterations: 200 };
  const baseline = solveFabricCell(input);
  assert.ok(baseline.iterations >= 20, "R4-2(g): the default comparison solve must execute at least 20 iterations");
  const renamed = createFabricModel({ id: "T1_RENAMED",
    terms: createT1Terms(params, { quadratureOrder }).map(term => ({ ...term,
      id: term.id === "bending" ? "bendingRenamed" : "contactRenamed" })),
    constraints: createT1Constraints() });
  renamed.reporting = createT1Reporting({ bendingTermId: "bendingRenamed", contactTermId: "contactRenamed" });
  const renamedResult = solveFabricCell({ ...input, model: renamed });
  assertSameSolverJson(withoutElapsed(renamedResult), withoutElapsed(baseline), "STOP #3: R4-2(g) renamed terms");

  const probe = { name: "probe", length: () => 2, scaleKind: "dimensionless", equilibrium: { kind: "maxAbs" },
    read: cell => cell.probe, write: (target, values) => { target.probe = Array.from(values); } };
  for (const insertion of [1, 2]) {
    const blocks = [...T1_DOF_BLOCKS];
    blocks.splice(insertion, 0, probe);
    const model = createFabricModel({ id: `T1_SOLVE_PROBE_${insertion}`, blocks,
      terms: createT1Terms(params, { quadratureOrder }), constraints: createT1Constraints() });
    assert.equal(model.reporting, undefined, "R4-2(h): custom models exercise the default reporting fallback");
    const actual = solveFabricCell({ ...input, model });
    const label = `STOP #3: R4-2(h) probe insertion ${insertion}`;
    for (const field of ["status", "optimizerStatus", "iterations", "evaluations", "history", "energy", "constraints",
      "clearance", "barrier", "trajectory", "settings"]) {
      assertSameSolverJson(actual[field], baseline[field], `${label}: ${field}`);
    }
    assertDofBytes(Float64Array.from(actual.cell.positions.flat()), Float64Array.from(baseline.cell.positions.flat()),
      `${label}: cell.positions`);
    for (const component of ["W", "H", "S"]) {
      assertDofBytes(Float64Array.of(actual.cell[component]), Float64Array.of(baseline.cell[component]), `${label}: cell.${component}`);
    }
    assertDofBytes(Float64Array.from(actual.cell.probe), Float64Array.from(initialCell.probe), `${label}: cell.probe`);
    const { freeResidual: actualFree, ...actualEquilibrium } = actual.equilibrium;
    const { freeResidual: baselineFree, ...baselineEquilibrium } = baseline.equilibrium;
    assertSameSolverJson(actualEquilibrium, baselineEquilibrium, `${label}: equilibrium excluding freeResidual`);
    const layout = model.createLayout(initialCell), freeIndices = layout.freeIndices();
    const probeIndices = new Set([layout.index("probe", 0), layout.index("probe", 1)]);
    assert.equal(actualFree.length, freeIndices.length, `${label}: equilibrium.freeResidual length`);
    const withoutProbe = actualFree.filter((value, i) => {
      if (!probeIndices.has(freeIndices[i])) return true;
      assert.ok(value === 0, `${label}: equilibrium.freeResidual[${i}] for probe must be zero`);
      return false;
    });
    assertSameSolverJson(withoutProbe, baselineFree, `${label}: equilibrium.freeResidual excluding probe`);
  }
}
