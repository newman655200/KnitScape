import assert from "node:assert/strict";
import { fitLogDensity } from "./fabricFormR2Analysis.mjs";

export const lengths = Object.freeze([2.77, 2.84, 2.9]);
export const contactGroups = Object.freeze(["waleSpacing", "courseSpacing", "diagonal", "sameLoop"]);
export const forwardDenominators = Object.freeze([4, 8, 16, 24, 32, 44, 64]);
export const thresholds = Object.freeze({ platformStable: 0.15, platformUnstable: 0.30,
  sameEquilibrium: 1e-4, hysteresisW: 1e-2, shearBranch: 1e-4, energySum: 1e-6, maxSolves: 45 });

export function contactSignature(groups) {
  for (const group of contactGroups)
    assert.ok(Number.isInteger(groups?.[group]?.activePairs) && groups[group].activePairs >= 0,
      `Missing/invalid activePairs for ${group}`);
  return contactGroups.filter(group => groups[group].activePairs > 0);
}

function one(rows, l, KScale, direction) {
  const matching = rows.filter(row => row.l === l && row.KScale === KScale && row.direction === direction);
  assert.equal(matching.length, 1, `Expected one ${direction} l=${l} K=${KScale}`);
  assert.equal(matching[0].status, "CONVERGED");
  return matching[0];
}

export function analyzeLevel(rows, denominator, direction) {
  const KScale = 1 / denominator, data = lengths.map(l => one(rows, l, KScale, direction));
  const signatures = data.map(row => ({ l: row.l, signature: contactSignature(row.groups) }));
  const stateConsistent = signatures.every(row => JSON.stringify(row.signature) === JSON.stringify(signatures[0].signature));
  const containsShear = data.some(row => row.shearBranch);
  const middle = data[1];
  return { denominator, KScale, direction, runIds: data.map(row => row.id),
    wale: fitLogDensity(data, "waleDensityPerCm"), course: fitLogDensity(data, "courseDensityPerCm"),
    stateConsistent, state: stateConsistent ? "状态一致" : "状态混合", signatures,
    signature: stateConsistent ? signatures[0].signature : null, containsShear,
    descriptiveOnly: !stateConsistent || containsShear,
    slopeUse: !stateConsistent || containsShear ? "斜率只作描述，不参与判读" : "可按预登记规则参与判读",
    dryRelaxedDeviation: { l: 2.84, state: "参照为干放松态", referenceWaleDensityPerCm: 30.8 / 2.54,
      referenceCourseDensityPerCm: 45.9 / 2.54, waleDensityPerCm: middle.waleDensityPerCm,
      courseDensityPerCm: middle.courseDensityPerCm,
      walePercent: 100 * (middle.waleDensityPerCm / (30.8 / 2.54) - 1),
      coursePercent: 100 * (middle.courseDensityPerCm / (45.9 / 2.54) - 1),
      formula: "100*(model / dry-relaxed observation - 1)" } };
}

export function classifyPlatform(deltaB, eligible = true) {
  if (!eligible) return "不确定（状态混合）";
  assert.ok(Number.isFinite(deltaB) && deltaB >= 0);
  return deltaB <= thresholds.platformStable ? "脱开后存在稳定平台" :
    deltaB >= thresholds.platformUnstable ? "脱开后无稳定平台" : "不确定";
}

export function analyzePlatform(fits) {
  const selected = [32, 44, 64].map(denominator => {
    const matching = fits.filter(fit => fit.direction === "forward" && fit.denominator === denominator);
    assert.equal(matching.length, 1);
    return matching[0];
  });
  const eligible = selected.every(fit => fit.stateConsistent && !fit.containsShear && !fit.signature.includes("waleSpacing"));
  const values = selected.map(fit => fit.wale.slope);
  const descriptiveDeltaB = Math.max(...values) - Math.min(...values);
  const interpretation = classifyPlatform(descriptiveDeltaB, eligible);
  return { denominators: [32, 44, 64], eligible, descriptiveDeltaB, deltaB: eligible ? descriptiveDeltaB : null,
    interpretation, platformValue: eligible && descriptiveDeltaB <= thresholds.platformStable ?
      values.reduce((sum, value) => sum + value, 0) / 3 : null,
    platformValueUse: "仅描述，不标定或推荐参数",
    guards: selected.map(fit => ({ denominator: fit.denominator, stateConsistent: fit.stateConsistent,
      containsShear: fit.containsShear, signature: fit.signature })) };
}

export function classifyHysteresis(pairs) {
  assert.equal(pairs.length, 6, "Hysteresis requires all six pairs");
  assert.ok(pairs.every(pair => [pair.relativeW, pair.relativeH].every(value => Number.isFinite(value) && value >= 0)));
  if (pairs.every(pair => pair.relativeW <= thresholds.sameEquilibrium && pair.relativeH <= thresholds.sameEquilibrium && pair.sameSignature))
    return "无迟滞（同一平衡）";
  if (pairs.some(pair => pair.relativeW >= thresholds.hysteresisW || !pair.sameSignature)) return "存在迟滞或多解";
  return "不确定";
}

export function analyzeHysteresis(rows) {
  const pairs = [24, 16].flatMap(denominator => lengths.map(l => {
    const forward = one(rows, l, 1 / denominator, "forward"), reverse = one(rows, l, 1 / denominator, "reverse");
    assert.ok(forward.W > 0 && forward.H > 0);
    const forwardSignature = contactSignature(forward.groups), reverseSignature = contactSignature(reverse.groups);
    const sameSignature = JSON.stringify(forwardSignature) === JSON.stringify(reverseSignature);
    const relativeW = Math.abs(reverse.W - forward.W) / forward.W;
    const relativeH = Math.abs(reverse.H - forward.H) / forward.H;
    const different = forward.W !== reverse.W || forward.H !== reverse.H || forward.S !== reverse.S || !sameSignature;
    const difference = reverse.energy.total - forward.energy.total;
    return { l, denominator, KScale: 1 / denominator, forwardId: forward.id, reverseId: reverse.id,
      forward: { W: forward.W, H: forward.H, S: forward.S, shearBranch: forward.shearBranch, signature: forwardSignature },
      reverse: { W: reverse.W, H: reverse.H, S: reverse.S, shearBranch: reverse.shearBranch, signature: reverseSignature },
      relativeW, relativeH, sameSignature, scalarDifferent: different,
      energy: { forwardTotal: forward.energy.total, reverseTotal: reverse.energy.total,
        reverseMinusForward: difference, lower: difference < 0 ? "reverse" : difference > 0 ? "forward" : "equal",
        purpose: "仅描述，不剔除或替换点" } };
  }));
  return { pairs, interpretation: classifyHysteresis(pairs),
    rule: "Six geometry/signature pairs; no slope enters this judgment. H>=1e-2 alone is not a hysteresis criterion." };
}

function transition(rows, l, direction, denominators, reappearance = false) {
  const available = denominators.map(denominator => {
    const row = rows.find(item => item.l === l && item.KScale === 1 / denominator && item.direction === direction);
    return row ? { denominator, activePairs: row.groups.waleSpacing.activePairs, id: row.id } : null;
  });
  for (let i = 0; i < available.length; i++) {
    const point = available[i];
    if (!point || !(reappearance ? point.activePairs > 0 : point.activePairs === 0)) continue;
    return { l, direction, from: i > 0 ? available[i - 1] : null, to: point,
      interval: i > 0 && available[i - 1] ? `1/${available[i - 1].denominator} 到 1/${point.denominator} 之间` :
        `首个已观测点 1/${point.denominator} 已${reappearance ? "接触" : "脱开"}` };
  }
  return { l, direction, from: null, to: null, interval: "所列档位未观察到" };
}

export function analyzeStudy(rows, includeReverse = false) {
  const fits = forwardDenominators.map(denominator => analyzeLevel(rows, denominator, "forward"));
  if (includeReverse) fits.push(...[24, 16].map(denominator => analyzeLevel(rows, denominator, "reverse")));
  const hysteresis = includeReverse ? analyzeHysteresis(rows) : null;
  const reverseWithStart = [...rows, ...rows.filter(row => row.direction === "forward" && row.KScale === 1 / 44)
    .map(row => ({ ...row, direction: "reverse" }))];
  return { fits, platform: analyzePlatform(fits), hysteresis,
    transitions: { forward: lengths.map(l => transition(rows, l, "forward", forwardDenominators)),
      reverse: hysteresis?.interpretation === "存在迟滞或多解" ?
        lengths.map(l => transition(reverseWithStart, l, "reverse", [44, 24, 16], true)) : [] } };
}
