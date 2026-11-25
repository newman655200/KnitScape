import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { analyzeQ3 } from "./fabricFormR2Analysis.mjs";

const acceptedOriginalPoints = new Map([-0.005, 0.005, -0.01, 0.01].map(delta =>
  [`q3-2.84-${delta < 0 ? "minus" : "plus"}-${Math.abs(delta)}`, delta]));

function finite(value, label) {
  assert.ok(Number.isFinite(value), `${label} must be finite`);
  return value;
}

function baselineFor(baselines, l) {
  const baseline = Object.entries(baselines).find(([key]) => Number(key) === l)?.[1];
  assert.ok(baseline, `Missing baseline for l=${l}`);
  return baseline;
}

function monotonicity(points, key) {
  const steps = points.slice(1).map((point, i) => ({
    fromDelta: points[i].delta, toDelta: point.delta,
    fromValue: points[i][key], toValue: point[key], change: point[key] - points[i][key],
  }));
  const nondecreasing = steps.every(step => step.change >= 0);
  const nonincreasing = steps.every(step => step.change <= 0);
  return { nondecreasing, nonincreasing, monotonic: nondecreasing || nonincreasing, steps };
}

/** User continuation ruling: diagnostic guards only; Q3's primary analysis stays separate. */
export function checkQ3Continuation(rows, baselines, { acceptedRunIds = [] } = {}) {
  assert.ok(Array.isArray(acceptedRunIds) && acceptedRunIds.every(id => acceptedOriginalPoints.has(id)),
    "Point-guard exemptions are limited to the four accepted original Q3 run IDs");
  const accepted = new Set(acceptedRunIds);
  const stopReasons = [], checks = [];
  for (const l of [...new Set(rows.map(row => finite(row.l, "l")))].sort((a, b) => a - b)) {
    const baseline = baselineFor(baselines, l), current = rows.filter(row => row.l === l);
    assert.ok(current.every(row => finite(row.delta, "delta") !== 0), "Rows must exclude the reused delta=0 baseline");
    assert.equal(new Set(current.map(row => row.delta)).size, current.length, `Duplicate delta for l=${l}`);
    const baselineRatio = finite(baseline.minDistanceOverDe, "baseline min/d_e");
    const points = [{ ...baseline, l, delta: 0 }, ...current].sort((a, b) => a.delta - b.delta).map(row => {
      const id = row.id ?? `l=${l}, delta=${row.delta}`;
      const pointGuardExemption = accepted.has(id) ? "ARCHITECT_ACCEPTED_EXISTING_POINT" : null;
      if (pointGuardExemption) assert.ok(l === 2.84 && row.delta === acceptedOriginalPoints.get(id),
        `${id} must match its accepted original l and delta`);
      const minDistanceOverDe = finite(row.minDistanceOverDe, `${id} min/d_e`);
      const minDistanceOverDeChange = minDistanceOverDe - baselineRatio;
      if (!pointGuardExemption && Math.abs(minDistanceOverDeChange) > 0.02)
        stopReasons.push(`${id}: min/d_e=${minDistanceOverDe}, baseline=${baselineRatio}, change=${minDistanceOverDeChange}; |change| > 0.02`);
      const groups = Object.fromEntries(["waleSpacing", "courseSpacing", "diagonal"].map(name => {
        const activePairs = row.groups[name].activePairs, baselineActivePairs = baseline.groups[name].activePairs;
        assert.ok(Number.isInteger(activePairs) && activePairs >= 0 && Number.isInteger(baselineActivePairs) &&
          baselineActivePairs >= 0, `${id} ${name} activePairs must be nonnegative integers`);
        const absoluteChange = Math.abs(activePairs - baselineActivePairs);
        // A zero baseline has no finite relative change; retain null and the actual counts.
        const relativeChange = baselineActivePairs === 0 ? absoluteChange === 0 ? 0 : null : absoluteChange / baselineActivePairs;
        const usedForStop = name !== "waleSpacing" && !pointGuardExemption;
        const exceeds30Percent = baselineActivePairs === 0 ? absoluteChange > 0 : relativeChange > 0.3;
        if (usedForStop && exceeds30Percent)
          stopReasons.push(`${id}: ${name} activePairs=${activePairs}, baseline=${baselineActivePairs}, ` +
            `absoluteChange=${absoluteChange}, relativeChange=${relativeChange ?? "undefined (baseline=0)"}; exceeds 0.30`);
        return [name, { activePairs, baselineActivePairs, absoluteChange, relativeChange, usedForStop, exceeds30Percent }];
      }));
      return { id, l, delta: row.delta, baseline: row.delta === 0, pointGuardExemption,
        W: finite(row.W, `${id} W`), H: finite(row.H, `${id} H`), F_W: finite(row.F_W, `${id} F_W`),
        E_total: finite(row.energy.total, `${id} E_total`), minDistanceOverDe, minDistanceOverDeChange, groups };
    });
    const center = points.find(point => point.delta === 0);
    const energy = Object.fromEntries([["compression", -1], ["tension", 1]].map(([side, sign]) => {
      const outward = [center, ...points.filter(point => sign * point.delta > 0)
        .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))];
      const check = monotonicity(outward, "E_total");
      for (const step of check.steps.filter(step => step.change < 0))
        stopReasons.push(`l=${l}: ${side} E_total decreases outward: delta ${step.fromDelta} -> ${step.toDelta}, ` +
          `E ${step.fromValue} -> ${step.toValue} N*mm, change=${step.change}; required nondecreasing without tolerance`);
      return [side, check];
    }));
    const force = monotonicity(points, "F_W"), height = monotonicity(points, "H");
    for (const [key, check] of [["F_W", force], ["H", height]]) if (!check.monotonic)
      stopReasons.push(`l=${l}: ${key} is nonmonotonic in increasing delta: ` +
        points.map(point => `(${point.delta},${point[key]})`).join(", ") + "; no tolerance applied");
    checks.push({ l, points, energy, F_W: force, H: height });
  }
  return { stopReasons, checks };
}

/** Extra descriptive curvature on each side, never a replacement Q3 verdict. */
export function analyzeQ3OneSided(rows, baselines) {
  const l = 2.84, baseline = baselineFor(baselines, l);
  const WStar = finite(baseline.W, "baseline W");
  assert.ok(WStar > 0, "baseline W must be positive");
  const selected = new Map([-0.01, -0.005, 0.005, 0.01].map(delta => {
    const matches = rows.filter(row => row.l === l && row.delta === delta);
    assert.equal(matches.length, 1, `One-sided Q3 requires exactly one l=${l}, delta=${delta} point`);
    return [delta, matches[0]];
  }));
  const displacementMm = 0.005 * WStar;
  const method = "[E_X(outer delta) - 2 E_X(inner delta) + E_X(0)] / (0.005 W*)^2; descriptive only; excluded from Q3 primary and step-size verdicts";
  const sides = Object.fromEntries([["compression", -1], ["tension", 1]].map(([side, sign]) => {
    const outerDelta = sign * 0.01, innerDelta = sign * 0.005;
    const outer = selected.get(outerDelta), inner = selected.get(innerDelta);
    const k = Object.fromEntries(["total", "bending", "contact", "barrier"].map(key => [key,
      (finite(outer.energy[key], `${side} E_outer ${key}`) - 2 * finite(inner.energy[key], `${side} E_inner ${key}`) +
        finite(baseline.energy[key], `E0 ${key}`)) / displacementMm ** 2]));
    return [side, { outerDelta, innerDelta, baselineDelta: 0, k,
      s_c: k.total === 0 ? null : (k.contact + k.barrier) / k.total, descriptiveOnly: true }];
  }));
  return { l, WStar, displacementMm, units: { stiffness: "N/mm", contactShare: "1" },
    method, descriptiveOnly: true, ...sides };
}

function selfCheck() {
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
  const baseline = { l: 2.84, delta: 0, W: 2, H: 1, F_W: 0,
    energy: { total: 0, bending: 0, contact: 0, barrier: 0 }, minDistanceOverDe: 0,
    groups: Object.fromEntries(["waleSpacing", "courseSpacing", "diagonal"].map(name => [name, { activePairs: 10 }])) };
  const baselines = { "2.84": baseline };
  const sample = delta => {
    const x = 2 * delta;
    return { ...structuredClone(baseline), id: `synthetic-${delta}`, delta, W: 2 + x, H: 1 - x, F_W: 10 * x,
      energy: { total: 5 * x ** 2, bending: x ** 2, contact: 4 * x ** 2, barrier: 0 } };
  };
  const rows = [-0.01, -0.005, 0.005, 0.01].map(sample);
  const failure = (change, expected) => {
    const altered = structuredClone(rows);
    change(altered);
    assert.ok(checkQ3Continuation(altered, baselines).stopReasons.some(reason => reason.includes(expected)), expected);
  };
  failure(data => { data[0].energy.total = 0; }, "compression E_total");
  failure(data => { data[3].energy.total = 0; }, "tension E_total");
  failure(data => { data[2].energy.total = -1; }, "tension E_total");
  failure(data => { data[1].F_W = 1; }, "F_W");
  failure(data => { data[1].H = 2; }, "H");
  failure(data => { data[0].groups.courseSpacing.activePairs = 14; }, "courseSpacing");
  failure(data => { data[0].groups.diagonal.activePairs = 6; }, "diagonal");
  failure(data => { data[0].minDistanceOverDe = 0.020000000000000004; }, "min/d_e");
  failure(data => { data[0].minDistanceOverDe = -0.020000000000000004; }, "min/d_e");
  assert.deepEqual(checkQ3Continuation(rows, baselines).stopReasons, []);
  const accepted = structuredClone(rows);
  accepted[0].groups.waleSpacing.activePairs = 0;
  accepted[0].groups.courseSpacing.activePairs = 13;
  accepted[0].groups.diagonal.activePairs = 7;
  accepted[0].minDistanceOverDe = 0.02;
  const acceptedCheck = checkQ3Continuation(accepted, baselines);
  assert.deepEqual(acceptedCheck.stopReasons, []);
  const recorded = acceptedCheck.checks[0].points.find(row => row.delta === -0.01);
  assert.equal(recorded.groups.waleSpacing.relativeChange, 1);
  assert.equal(recorded.groups.waleSpacing.usedForStop, false);
  const reversed = rows.map(row => ({ ...row, F_W: -row.F_W, H: 2 - row.H }));
  assert.deepEqual(checkQ3Continuation(reversed, baselines).stopReasons, []);
  const flat = rows.map(row => ({ ...row, F_W: 0, H: 1, energy: { ...row.energy, total: 0 } }));
  assert.deepEqual(checkQ3Continuation(flat, baselines).stopReasons, []);
  assert.deepEqual(checkQ3Continuation(rows.toReversed(), baselines), checkQ3Continuation(rows, baselines));
  assert.deepEqual(checkQ3Continuation([], baselines), { stopReasons: [], checks: [] });
  assert.throws(() => checkQ3Continuation(rows, { "2.84": { ...baseline, F_W: null } }), /F_W/);

  const existing = structuredClone(rows);
  existing[0].id = "q3-2.84-minus-0.01";
  existing[0].groups.courseSpacing.activePairs = 14;
  existing[0].groups.diagonal.activePairs = 4;
  existing[0].minDistanceOverDe = 0.03;
  const acceptance = { acceptedRunIds: [existing[0].id] };
  const existingCheck = checkQ3Continuation(existing, baselines, acceptance);
  assert.deepEqual(existingCheck.stopReasons, []);
  const exemptPoint = existingCheck.checks[0].points.find(point => point.id === existing[0].id);
  assert.equal(exemptPoint.pointGuardExemption, "ARCHITECT_ACCEPTED_EXISTING_POINT");
  assert.equal(exemptPoint.groups.diagonal.activePairs, 4);
  assert.equal(exemptPoint.groups.diagonal.relativeChange, 0.6);
  assert.equal(exemptPoint.groups.diagonal.exceeds30Percent, true);
  assert.equal(exemptPoint.minDistanceOverDeChange, 0.03);
  const newPoint = { ...structuredClone(existing[0]), id: "q3-2.84-minus-0.02", delta: -0.02,
    W: 1.96, H: 1.04, F_W: -0.4, energy: sample(-0.02).energy };
  const guarded = checkQ3Continuation([...rows, newPoint], baselines, acceptance);
  for (const marker of ["courseSpacing", "diagonal", "min/d_e"])
    assert.ok(guarded.stopReasons.some(reason => reason.includes(newPoint.id) && reason.includes(marker)));
  assert.throws(() => checkQ3Continuation([...rows, newPoint], baselines, { acceptedRunIds: [newPoint.id] }), /accepted original/);
  for (const [change, marker] of [
    [row => { row.energy.total = 0; }, "compression E_total"],
    [row => { row.F_W = 1; }, "F_W"],
    [row => { row.H = 0.5; }, "H"],
  ]) {
    const altered = structuredClone(existing);
    change(altered[0]);
    assert.ok(checkQ3Continuation(altered, baselines, acceptance).stopReasons.some(reason => reason.includes(marker)), marker);
  }

  const asymmetric = rows.map(row => {
    const cubic = 100 * (2 * row.delta) ** 3;
    return { ...row, energy: { ...row.energy, total: row.energy.total + cubic, contact: row.energy.contact + cubic } };
  });
  const sides = analyzeQ3OneSided(asymmetric, baselines);
  near(sides.compression.k.total, 4); near(sides.compression.k.bending, 2);
  near(sides.compression.k.contact, 2); near(sides.compression.k.barrier, 0); near(sides.compression.s_c, 0.5);
  near(sides.tension.k.total, 16); near(sides.tension.k.bending, 2);
  near(sides.tension.k.contact, 14); near(sides.tension.s_c, 0.875);
  assert.equal(sides.descriptiveOnly, true); assert.equal("interpretation" in sides, false);
  assert.throws(() => analyzeQ3OneSided(rows.slice(1), baselines), /requires/);
  assert.throws(() => analyzeQ3OneSided([...rows, rows[0]], baselines), /requires/);
  const fullRows = [...rows, sample(-0.02), sample(0.02)];
  const frozenInput = JSON.stringify({ rows: fullRows, baselines });
  const primaryBefore = analyzeQ3(fullRows, baselines);
  checkQ3Continuation(fullRows, baselines);
  analyzeQ3OneSided(fullRows, baselines);
  assert.equal(JSON.stringify({ rows: fullRows, baselines }), frozenInput);
  assert.deepEqual(analyzeQ3(fullRows, baselines), primaryBefore);
  console.log("R2 continuation self-check PASS: each stop rule, exact boundaries, recorded-only wale counts, monotonic directions, one-sided differences, unchanged primary analysis.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) selfCheck();
