import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const energyKeys = ["total", "bending", "contact", "barrier"];
const lengths = [2.77, 2.84, 2.9];

function classifyQ2(value) {
  return value >= 0.7 ? "与推测一致" : value <= 0.3 ? "推测不成立" : "不确定";
}

function classifyQ3(value) {
  if (value === null) return "不确定";
  return value >= 0.6 ? "横向刚度以接触为主，与推测一致" :
    value <= 0.4 ? "横向刚度以弯曲为主，与推测矛盾" : "不确定";
}

function finite(value, label) {
  assert.ok(Number.isFinite(value), `${label} must be finite`);
  return value;
}

function positive(value, label) {
  assert.ok(finite(value, label) > 0, `${label} must be positive`);
  return value;
}

function baselineFor(baselines, l) {
  const baseline = Object.entries(baselines).find(([key]) => Number(key) === l)?.[1];
  assert.ok(baseline, `Missing baseline for l=${l}`);
  return baseline;
}

/** Pure analysis of the four registered Q2 runs; B never changes the primary verdict. */
export function analyzeQ2(rows) {
  assert.equal(rows.length, 4, "Q2 requires exactly four registered runs");
  const variants = Object.fromEntries(["A", "B"].map(variant => {
    const pair = [0.95, 1.05].map(scale => {
      const matching = rows.filter(row => row.variant === variant && row.scale === scale && row.l === 2.84);
      assert.equal(matching.length, 1, `Q2 requires one ${variant}, s=${scale}, l=2.84 run`);
      return matching[0];
    });
    const elasticity = key => Math.log(positive(pair[1][key], key) / positive(pair[0][key], key)) /
      Math.log(1.05 / 0.95);
    const epsilonW = elasticity("W"), epsilonH = elasticity("H");
    return [variant, { epsilonW, epsilonH, primary: variant === "A",
      interpretation: variant === "A" ? classifyQ2(epsilonW) : "辅助，不参与判定" }];
  }));
  return { variants, primary: { variant: "A", ...variants.A }, interpretation: variants.A.interpretation };
}

/** Analyze complete pairs immediately, so the runner can stop before the next solve. */
export function analyzeQ3(rows, baselines) {
  const pairs = [], stopReasons = [];
  for (const l of lengths) for (const delta of l === 2.84 ? [0.005, 0.01, 0.02] : [0.01]) {
    const minus = rows.filter(row => row.l === l && row.delta === -delta);
    const plus = rows.filter(row => row.l === l && row.delta === delta);
    assert.ok(minus.length <= 1 && plus.length <= 1, `Duplicate Q3 pair l=${l}, delta=${delta}`);
    if (!minus.length || !plus.length) continue;
    const base = baselineFor(baselines, l), h = delta * positive(base.W, "baseline W");
    const k = Object.fromEntries(energyKeys.map(key => [key,
      (finite(plus[0].energy[key], `E+ ${key}`) - 2 * finite(base.energy[key], `E0 ${key}`) +
        finite(minus[0].energy[key], `E- ${key}`)) / h ** 2]));
    const stiffnessSumDifference = k.total - (k.bending + k.contact + k.barrier);
    const reactionStiffness = (finite(plus[0].F_W, "F_W+") - finite(minus[0].F_W, "F_W-")) / (2 * h);
    const relative = difference => k.total === 0 ? null : Math.abs(difference / k.total);
    const stiffnessSumRelativeDifference = relative(stiffnessSumDifference);
    const reactionStiffnessDifference = reactionStiffness - k.total;
    const reactionStiffnessRelativeDifference = relative(reactionStiffnessDifference);
    const s_c = k.total === 0 ? null : (k.contact + k.barrier) / k.total;
    const label = `l=${l} mm, |delta|=${delta}`;
    if (Math.abs(stiffnessSumDifference) > Math.abs(k.total) * 1e-6)
      stopReasons.push(`${label}: 能量刚度和差=${stiffnessSumDifference}, k_total=${k.total}, ` +
        `相对差=${stiffnessSumRelativeDifference}, 阈值=1e-6`);
    if (Math.abs(reactionStiffnessDifference) > Math.abs(k.total) * 0.2)
      stopReasons.push(`${label}: 反力差分刚度=${reactionStiffness}, k_total=${k.total}, ` +
        `相对差=${reactionStiffnessRelativeDifference}, 阈值=0.2`);
    pairs.push({ l, delta, WStar: base.W, displacementMm: h, k, s_c, stiffnessSumDifference,
      stiffnessSumRelativeDifference, reactionStiffness, reactionStiffnessDifference,
      reactionStiffnessRelativeDifference, interpretation: classifyQ3(s_c),
      energySumDifferences: Object.fromEntries([["minus", minus[0]], ["baseline", base], ["plus", plus[0]]]
        .map(([name, row]) => [name, row.energy.total - (row.energy.bending + row.energy.contact + row.energy.barrier)])) });
  }
  assert.ok(rows.every(row => lengths.includes(row.l) &&
    (row.l === 2.84 ? [0.005, 0.01, 0.02] : [0.01]).includes(Math.abs(row.delta))), "Unregistered Q3 point");
  const primary = pairs.find(row => row.l === 2.84 && row.delta === 0.01) ?? null;
  const primarySteps = pairs.filter(row => row.l === 2.84);
  const completePrimarySteps = primarySteps.length === 3;
  const stepSensitive = completePrimarySteps ? new Set(primarySteps.map(row => row.interpretation)).size > 1 : null;
  const interpretation = completePrimarySteps ? stepSensitive ? "不确定（步长敏感）" : primary.interpretation : null;
  return { pairs, primary, completePrimarySteps, stepSensitive, interpretation, stopReasons };
}

function fitLogDensity(rows, key) {
  const points = rows.map(row => ({ l: row.l, densityPerCm: row[key],
    x: Math.log(positive(row.l, "l")), y: Math.log(positive(row[key], key)) }));
  const meanX = points.reduce((sum, row) => sum + row.x, 0) / points.length;
  const meanY = points.reduce((sum, row) => sum + row.y, 0) / points.length;
  const slope = points.reduce((sum, row) => sum + (row.x - meanX) * (row.y - meanY), 0) /
    points.reduce((sum, row) => sum + (row.x - meanX) ** 2, 0);
  const intercept = meanY - slope * meanX;
  const residuals = points.map(row => ({ ...row, fittedLogDensity: intercept + slope * row.x,
    residual: row.y - (intercept + slope * row.x) }));
  return { intercept, slope, residuals, sse: residuals.reduce((sum, row) => sum + row.residual ** 2, 0),
    method: "ln(density)=intercept+slope*ln(l); equal weights; residual=observed-fitted in log space" };
}

/** Six successful target runs plus the three reused K=1 baselines; no extrapolation. */
export function analyzeQC(rows, baselines) {
  assert.equal(rows.length, 6, "QC requires six successful target runs");
  const fits = [0.5, 1, 2].map(KScale => {
    const data = lengths.map(l => {
      if (KScale === 1) return { ...baselineFor(baselines, l), l, KScale };
      const matching = rows.filter(row => row.KScale === KScale && row.l === l);
      assert.equal(matching.length, 1, `QC requires one l=${l}, KScale=${KScale} run`);
      return matching[0];
    });
    return { KScale, wale: fitLogDensity(data, "waleDensityPerCm"), course: fitLogDensity(data, "courseDensityPerCm") };
  });
  const left = (fits[1].wale.slope - fits[0].wale.slope) / Math.log(2);
  const right = (fits[2].wale.slope - fits[1].wale.slope) / Math.log(2);
  return { fits, dbWaleDlnK: (fits[2].wale.slope - fits[0].wale.slope) / Math.log(4),
    dbWaleDlnKIntervals: { fromHalfToOne: left, fromOneToTwo: right },
    monotonicWaleSlope: left >= 0 && right >= 0 || left <= 0 && right <= 0,
    interpretation: "仅报告数据，不设通过或失败，不作参数建议" };
}

function format(value) {
  return typeof value === "number" && Number.isFinite(value) ? String(Number(value.toPrecision(12))) : "UNKNOWN";
}

function table(headers, rows) {
  const escape = value => String(value ?? "UNKNOWN").replaceAll("|", "\\|").replaceAll("\n", " ");
  return [headers, headers.map(() => "---"), ...rows].map(row => `| ${row.map(escape).join(" | ")} |`).join("\n");
}

/** Render only Q2; caller owns file creation/appending and result overwrite protection. */
export function q2Report(summary) {
  const analysis = summary.analysis ?? analyzeQ2(summary.runs);
  const baseline = baselineFor(summary.baselines, 2.84);
  const rows = [{ ...baseline, id: "基准 after.json（复用）", variant: "基准", scale: 1 }, ...summary.runs];
  const provenance = summary.provenance ?? {};
  const materials = summary.materialParameters?.["2.84"]?.provenance ?? {};
  const provenanceRows = Object.entries(materials).map(([key, item]) =>
    [key, item.value, item.unit, item.source, item.principle, item.confidence, item.applicableState]);
  for (const row of summary.runs) for (const [key, item] of Object.entries(row.manifest?.overrideProvenance ?? {}))
    provenanceRows.push([`${row.id} ${key}`, item.value, item.unit, item.source, item.principle, item.confidence, item.applicableState]);
  return ["## Q2：接触长度尺度敏感性", "",
    "固定 l=2.84 mm，A 同时缩放 d_e 与 r_c，B 仅缩放 d_e，s∈{0.95,1.05}；K、E_f、B、tex 保持原输入。初值均为对应 after.json 的终态，s=1 直接复用该文件。",
    "数值设置沿用原输入：N64、q=12、maxIterations=24000、innerIterations=800、memorySize=180；模型参数覆盖仅用于本诊断。", "",
    table(["运行", "变体", "s", "状态", "迭代", "耗时/s", "W/mm", "H/mm", "S/mm", "横密/cm⁻¹", "纵密/cm⁻¹"],
      rows.map(row => [row.id, row.variant, row.scale, row.status, row.iterations,
        row.variant === "基准" ? "复用，未重算" : format(row.elapsedMs / 1000),
        format(row.W), format(row.H), format(row.S), format(row.waleDensityPerCm), format(row.courseDensityPerCm)])), "",
    table(["运行", "E_total/N·mm", "E_bending/N·mm", "E_contact/N·mm", "E_barrier/N·mm", "min/d_e", "总激活段对", "纵行间激活段对", "横列间激活段对"],
      rows.map(row => [row.id, ...energyKeys.map(key => format(row.energy?.[key])), format(row.minDistanceOverDe),
        row.activePairs, row.groups?.waleSpacing?.activePairs, row.groups?.courseSpacing?.activePairs])), "",
    "ε_W = ln(W₊/W₋) / ln(1.05/0.95)，ε_H 同理。仅 A 为主判据；B 只作辅助解读。", "",
    table(["变体", "ε_W", "ε_H", "用途 / 判读"], Object.entries(analysis.variants).map(([variant, value]) =>
      [variant, format(value.epsilonW), format(value.epsilonH), value.interpretation])), "",
    "预登记阈值：A 的 ε_W ≥ 0.7 → 与推测一致；ε_W ≤ 0.3 → 推测不成立；0.3 < ε_W < 0.7 → 不确定。阈值含边界，不按显示舍入值判定。",
    `本项判读：**${analysis.interpretation}**。`, "",
    "局限：能量占比小不等于刚度占比小；本项只检验接触长度尺度与 W 的响应，不能替代 Q3 横向刚度测量。B 独立保持 r_c，刻意偏离常规派生关系，属于诊断覆盖。四次求解同属 T1 无摩擦模型的分支延续，不证明因果、真实干放松状态或未知实物纱径；不得据此选择或推荐任何材料参数。Q2 不适用仅为 Q3 登记的接触状态跳变停止阈值。", "",
    "### Q2 数据来源与复现", "",
    table(["字段", "记录"], [
      ["Value", "上表及 q2-summary.json 的 runs/baselines 完整精度标量；表中数字显示为至多 12 位有效数字"],
      ["Unit", JSON.stringify(provenance.units ?? { l: "mm", W: "mm", H: "mm", S: "mm", density: "1/cm", energy: "N*mm", elasticity: "1" })],
      ["Source", provenance.source ?? "R2 task §5.1–§5.2；step3-hossain-2.84-input.json / after.json；每次运行 manifest"],
      ["Measurement / derivation principle", "W/H/S、能量和接触统计来自求解终态；横密=10m/W，纵密=10n/H，本组 m=n=1；ε 按上式中心对数差分；并非实物测量"],
      ["Confidence", provenance.confidence ?? "MODEL_DERIVED_DIAGNOSTIC; not physical measurement or causal verification"],
      ["Applicable state", provenance.applicableState ?? "T1 N64 frictionless plain-jersey branch; no material calibration"],
    ]), "",
    `HEAD：${summary.head ?? "UNKNOWN"}。完整结果归档：${summary.archiveRoot ?? "UNKNOWN"}。输入哈希、初值哈希、运行环境和开始/结束时间见各 manifest；汇总包含脚本哈希。`, "",
    table(["运行", "初值来源", "输入 SHA-256", "manifest", "完整结果（相对归档根）"], rows.map(row =>
      [row.id, row.source?.file ?? row.manifest?.initialCellSourceFile,
        row.source?.inputSha256 ?? row.manifest?.inputSha256, row.manifest?.file ?? "基准复用，无新运行 manifest",
        row.resultFile ?? row.source?.file])), "",
    "物性沿用原输入标签；真实纱径与其他未知物性仍为 UNKNOWN，诊断覆盖不升级为实测。下表保留参数及覆盖的六项来源：", "",
    table(["参数 / 运行", "Value", "Unit", "Source", "Measurement / derivation principle", "Confidence", "Applicable state"], provenanceRows), "",
  ].join("\n");
}

function selfCheck() {
  const near = (actual, expected, tolerance = 1e-10) =>
    assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
  const q2Rows = ["A", "B"].flatMap(variant => [0.95, 1.05].map(scale =>
    ({ variant, scale, l: 2.84, W: 2 * scale ** (variant === "A" ? 1 : 0), H: 3 * scale ** -2 })));
  const q2 = analyzeQ2(q2Rows);
  near(q2.variants.A.epsilonW, 1);
  near(q2.variants.A.epsilonH, -2);
  near(q2.variants.B.epsilonW, 0);
  assert.equal(q2.interpretation, "与推测一致");
  assert.equal(classifyQ2(0.7), "与推测一致");
  assert.equal(classifyQ2(0.3), "推测不成立");
  assert.equal(classifyQ2(0.5), "不确定");
  assert.equal(classifyQ3(0.6), "横向刚度以接触为主，与推测一致");
  assert.equal(classifyQ3(0.4), "横向刚度以弯曲为主，与推测矛盾");
  assert.equal(classifyQ3(0.5), "不确定");
  assert.throws(() => analyzeQ2(q2Rows.slice(1)), /Q2/);

  const baselines = Object.fromEntries([2.77, 2.84, 2.9].map(l => [l, { l, W: 2,
    energy: { total: 0, bending: 0, contact: 0, barrier: 0 },
    waleDensityPerCm: 10 * l ** -0.4, courseDensityPerCm: 20 * l ** -1.5 }]));
  const pair = (l, delta, share = 0.8) => [-1, 1].map(sign => {
    const x = sign * delta * baselines[l].W, total = 5 * x ** 2;
    return { l, delta: sign * delta, W: baselines[l].W + x, H: 1, S: 0, F_W: 10 * x,
      energy: { total, bending: total * (1 - share), contact: total * share, barrier: 0 } };
  });
  const q3Rows = [0.005, 0.01, 0.02].flatMap(delta => pair(2.84, delta));
  const q3 = analyzeQ3(q3Rows, baselines);
  for (const row of q3.pairs) {
    near(row.k.total, 10); near(row.s_c, 0.8); near(row.reactionStiffness, 10);
    near(row.stiffnessSumDifference, 0); near(row.reactionStiffnessRelativeDifference, 0);
  }
  assert.deepEqual(q3.stopReasons, []);
  assert.equal(q3.stepSensitive, false);
  assert.equal(q3.interpretation, classifyQ3(0.8));
  const partial = analyzeQ3(pair(2.84, 0.01), baselines);
  assert.equal(partial.pairs.length, 1);
  assert.equal(partial.interpretation, null);
  assert.equal(analyzeQ3(pair(2.84, 0.01).slice(0, 1), baselines).pairs.length, 0);
  const sensitive = analyzeQ3([...pair(2.84, 0.005, 0.2), ...pair(2.84, 0.01), ...pair(2.84, 0.02)], baselines);
  assert.equal(sensitive.interpretation, "不确定（步长敏感）");
  const badEnergy = pair(2.84, 0.01);
  badEnergy[0].energy.total *= 2;
  assert.ok(analyzeQ3(badEnergy, baselines).stopReasons.some(reason => /能量/.test(reason)));
  const badReaction = pair(2.84, 0.01);
  badReaction.forEach(row => { row.F_W *= 1.21; });
  assert.ok(analyzeQ3(badReaction, baselines).stopReasons.some(reason => /反力/.test(reason)));

  const qcRows = [0.5, 2].flatMap(KScale => [2.77, 2.84, 2.9].map(l => ({ KScale, l,
    waleDensityPerCm: 10 * l ** (-0.4 + 0.25 * Math.log(KScale)),
    courseDensityPerCm: 20 * l ** (-1.5 - 0.1 * Math.log(KScale)) })));
  const qc = analyzeQC(qcRows, baselines);
  near(qc.dbWaleDlnK, 0.25);
  near(qc.fits[1].wale.slope, -0.4);
  near(qc.fits[1].course.slope, -1.5);
  near(qc.fits[1].wale.intercept, Math.log(10));
  qc.fits.forEach(row => near(row.wale.sse, 0));
  assert.equal(qc.monotonicWaleSlope, true);
  const perturbed = structuredClone(qcRows);
  perturbed[1].waleDensityPerCm *= 1.01;
  assert.ok(analyzeQC(perturbed, baselines).fits[0].wale.sse > 0);
  const report = q2Report({ runs: q2Rows, baselines, analysis: q2 });
  for (const text of ["ε_W", "能量占比", "Confidence", "Applicable state", "0.7", "0.3"])
    assert.ok(report.includes(text), `Missing report text: ${text}`);
  console.log("R2 analysis self-check PASS: Q2 thresholds; Q3 curvature, reaction, partial pairs and step sensitivity; QC log OLS; report provenance.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) selfCheck();
