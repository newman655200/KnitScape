import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { defaultMemorySize } from "../src/fabricForm/solveFabricCell.js";

const output = path.resolve("docs/archive/t1-slope-closeout-2026-11-23");
const previous = "C:/Users/liuchen/Documents/KnitScape/archives/t1-convergence-2026-11-23";
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, value) => fs.writeFileSync(path.join(output, file), JSON.stringify(value, null, 2) + "\n");
const [mode, length, version = "after"] = process.argv.slice(2);

if (mode === "prepare-hossain") {
  const sourceFile = path.join(previous, "case-3-N64.json"), source = read(sourceFile);
  assert.equal(source.status, "CONVERGED");
  for (const l of [2.77, 2.84, 2.90]) {
    const archivedInput = read(path.join(previous, `hossain-${l}-input.json`));
    const cell = structuredClone(source.cell), factor = l / cell.topology.loopLengthMm;
    cell.positions = cell.positions.map(point => point.map(x => x * factor));
    for (const key of ["W", "H", "S"]) cell[key] *= factor;
    cell.topology.loopLengthMm = l;
    for (const key of ["lengthSource", "lengthConfidence"]) cell.topology[key] = archivedInput.input.topology[key];
    for (const edge of cell.topology.edges) { edge.restLength *= factor; edge.materialStart *= factor; }
    for (const yarn of cell.topology.yarns) yarn.materialLength *= factor;
    delete cell.refinement;
    write(`step3-hossain-${l}-input.json`, { input: { ...archivedInput.input,
      topology: cell.topology, initialCell: cell, memorySize: defaultMemorySize(64) },
      origin: { sourceFile, archivedParameterInput: `hossain-${l}-input.json`,
        method: "Same normalized converged branch scaled to reported length, N64 instead of N128; independent material parameters copied exactly from archived Hossain input" } });
  }
} else if (mode === "hossain") {
  const { solveFabricCell } = await import(version === "before"
    ? "../docs/archive/t1-slope-closeout-2026-11-23/baseline-solveFabricCell.mjs"
    : "../src/fabricForm/solveFabricCell.js");
  const inputFile = `step3-hossain-${length}-input.json`, prepared = read(path.join(output, inputFile));
  const result = solveFabricCell(prepared.input);
  write(`step3-hossain-${length}-${version}.json`, result);
  console.log(JSON.stringify({ length, version, status: result.status, iterations: result.iterations,
    metrics: result.metrics, diagnostics: result.diagnostics }));
} else if (mode === "compare-hossain") {
  const rows = [2.77, 2.84, 2.9].map(l => {
    const before = read(path.join(output, `step3-hossain-${l}-before.json`));
    const after = read(path.join(output, `step3-hossain-${l}-after.json`));
    assert.equal(before.status, "CONVERGED"); assert.equal(after.status, "CONVERGED");
    const densityRelativeDifference = Object.fromEntries(["waleDensityPerCm", "courseDensityPerCm"].map(key =>
      [key, after.metrics[key] / before.metrics[key] - 1]));
    assert.ok(Object.values(densityRelativeDifference).every(value => Math.abs(value) < 1e-9));
    return { lengthMm: l, densityRelativeDifference, cellBitwiseEqual: JSON.stringify(before.cell) === JSON.stringify(after.cell),
      iterations: after.iterations, metrics: after.metrics, diagnostics: after.diagnostics };
  });
  write("step3-comparison.json", { status: "PASS", rows });
  const format = value => value.toFixed(6);
  const pairForce = group => `${group.contactForceSumN.toExponential(6)} / ${group.contactForceMaxN.toExponential(6)}`;
  const table = ["| l/mm | 纵行间 min/d_e | 激活段对 | 接触力总和/最大 N | 横列间 min/d_e | 激活段对 | 接触力总和/最大 N | 横密 /cm | 纵密 /cm |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|---:|"];
  for (const row of rows) {
    const { waleSpacing: w, courseSpacing: c } = row.diagnostics.contact.groups;
    table.push(`| ${row.lengthMm} | ${format(w.minDistanceOverDe)} | ${w.activePairs} | ${pairForce(w)} | ${format(c.minDistanceOverDe)} | ${c.activePairs} | ${pairForce(c)} | ${format(row.metrics.waleDensityPerCm)} | ${format(row.metrics.courseDensityPerCm)} |`);
  }
  fs.writeFileSync(path.join(output, "STEP3_DIAGNOSTICS.md"), [
    "# T1 N64 接触方向诊断", "", "日期：2026-11-23。材料参数逐项复制原 Hossain 输入，tex=19.78；纱长为用户提供的给纱设定值，不是放松后复测。其他物性沿用原假设，未调参。", "",
    "纵行间按结构邻接分类（deltaWale≠0、deltaCourse=0），周期 W/m 对应横密；横列间反之，周期 H/n 对应纵密。分类依据为线圈材料归属，不是接触法向。斜向与同一线圈内的非局部接触另见 JSON。", "",
    "激活判据：最短轴距−d_e≤1e−9 mm。该容差仅用于输出统计；每对由原势能梯度计算刚性平移段 A 的合力模，统计其总和与最大值，单位 N。接触使用软势能和势垒，没有接触约束乘子，所有 multiplierSum/multiplierMax 为 null（不适用）；这些力不能称作乘子，也不是总向量合力。", "",
    ...table, "",
    "事实：三个 l 的纵行间最小间距/d_e 都小于 1，均有激活接触。随 l 增加，该比值从 0.925389 升至 0.946033；激活段对为 14/14/13，接触力总和和最大值均下降。横列间也始终有激活接触，其比值升高、激活数和接触力均下降。这里只陈述该分组下的输出变化，不据此判定横密斜率的因果机制，不改模型。", "",
    "最小值对应的段号、段内 s/t、最近点、周期像 p/q、方向偏移、周期长度和 d_e/d_s/r_c 六字段来源均保存在各 after.json 的 diagnostics.contact 中。d_e/d_s/r_c 为固定参数；模型没有独立求解的可变截面或有效直径。", "",
    `三个相同输入的诊断前后密度相对差：${rows.map(row => `${row.lengthMm} mm: ${JSON.stringify(row.densityRelativeDifference)}`).join("；")}。几何逐位一致：${rows.every(row => row.cellBitwiseEqual)}。`, "",
    "preliminary-* 保留首次基线运行：物理输入相同，但缺少给纱设定值来源标签；正式 before/after 使用补全标签后的同一输入。", "",
    "diagnostics.elapsedMs 记录求解时间，不包含随后只读诊断的开销。", "",
  ].join("\n"));
  console.log(JSON.stringify(rows));
} else throw new Error("Use prepare-hossain | hossain <length> before|after | compare-hossain");
