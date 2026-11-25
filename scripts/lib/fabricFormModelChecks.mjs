import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createPlainJerseyTopology } from "../../src/fabricForm/fabricFormTopology.js";
import { createFabricFormParams } from "../../src/fabricForm/fabricFormParams.js";
import { createFabricFormInitialGeometry } from "../../src/fabricForm/fabricFormInitialGeometry.js";
import { evaluateRodBending, evaluateLengthConstraints } from "../../src/fabricForm/rodBending.js";
import { evaluatePeriodicContact, safePeriodicStep, diagnosePeriodicContact } from "../../src/fabricForm/periodicContact.js";
import { evaluateFabricCell, packFabricCell, solveFabricCell } from "../../src/fabricForm/solveFabricCell.js";

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

}
