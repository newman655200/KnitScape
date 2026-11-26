import assert from "node:assert/strict";
import { contactGroups, forwardDenominators } from "./fabricFormR3bAnalysis.mjs";

const number = value => Number.isFinite(value) ? String(Number(value.toPrecision(12))) : "UNKNOWN";
const signature = value => Array.isArray(value) ? value.length ? value.join(" + ") : "∅" : "UNKNOWN";
const table = (headers, rows) => [headers, headers.map(() => "---"), ...rows]
  .map(row => `| ${row.map(value => String(value ?? "UNKNOWN").replaceAll("|", "\\|").replaceAll("\n", " ")).join(" | ")} |`).join("\n");
const scale = row => row.denominator ? `1/${row.denominator}` : number(row.KScale);
const fitRows = fits => fits.map(fit => [fit.direction, scale(fit), number(fit.wale.slope), number(fit.course.slope),
  fit.state, fit.containsShear, fit.slopeUse]);
const fitHeaders = ["方向", "K倍数", "b_wale", "b_course", "接触状态", "含剪切点", "斜率用途"];

function detailTables(rows) {
  if (!rows.length) return "尚未执行。";
  return [
    table(["运行", "方向", "K倍数", "l/mm", "状态", "迭代", "耗时/s", "W/mm", "H/mm", "S/mm", "shearBranch", "签名"],
      rows.map(row => [row.id, row.direction, scale(row), row.l, row.status, row.iterations,
        row.newSolve === false ? `复用（原 ${number(row.elapsedMs / 1000)}）` : row.elapsedMs == null ? "UNKNOWN" : number(row.elapsedMs / 1000),
        number(row.W), number(row.H), number(row.S), row.shearBranch, signature(row.contactSignature)])), "",
    table(["运行", "横密/cm⁻¹", "纵密/cm⁻¹", "kw", "kc", "E_total/N·mm", "E_bending", "E_contact", "E_barrier", "barrierFraction", "能量和相对差"],
      rows.map(row => [row.id, number(row.waleDensityPerCm), number(row.courseDensityPerCm), number(row.kw), number(row.kc),
        ...["total", "bending", "contact", "barrier", "barrierFraction"].map(key => number(row.energy?.[key])),
        number(row.energyConsistency?.relativeDifference)])), "",
    table(["运行", "总体 min/d_e", ...contactGroups.map(group => `${group}（对数；min/d_e）`), "势垒支撑区", "初值来源", "完整结果"],
      rows.map(row => [row.id, number(row.minDistanceOverDe), ...contactGroups.map(group =>
        `${row.groups?.[group]?.activePairs ?? "UNKNOWN"}; ${number(row.groups?.[group]?.minDistanceOverDe)}`),
      row.barrierSupport, row.initialCellSourceFile ?? row.manifest?.initialCellSourceFile, row.source?.file ?? row.resultFile])), "",
  ].join("\n");
}

function fitsTable(fits) {
  return [table(fitHeaders, fitRows(fits)), "",
    table(["方向", "K倍数", "横密 ln残差（l=2.77/2.84/2.90）", "横密 SSE", "纵密 ln残差（同序）", "纵密 SSE", "2.84 横密偏差/%", "2.84 纵密偏差/%"],
      fits.map(fit => [fit.direction, scale(fit), fit.wale.residuals.map(row => number(row.residual)).join(" / "), number(fit.wale.sse),
        fit.course.residuals.map(row => number(row.residual)).join(" / "), number(fit.course.sse),
        number(fit.dryRelaxedDeviation.walePercent), number(fit.dryRelaxedDeviation.coursePercent)])), "",
    "拟合为三个 l 上含截距、等权 ln(密度) 对 ln(l) OLS；残差=观测 ln 密度−拟合 ln 密度。显示至多12位有效数字，判读使用未舍入值。l=2.84 偏差按100×(模型/干放松参照−1)，参照横密30.8/2.54 cm⁻¹、纵密45.9/2.54 cm⁻¹。", ""].join("\n");
}

/** Pure rendering only. Caller owns writing REPORT.md and recording actual step verification. */
export function renderR3bReport(summary, { includeJudgments = false, includeOverview = false, overviewLines = [] } = {}) {
  assert.ok(overviewLines.length <= 10, "R3b-3 overview is limited to ten lines");
  const allFits = summary.analysis?.fits ?? [];
  const orderedFits = forwardDenominators.flatMap(denominator => allFits.filter(fit => fit.denominator === denominator));
  const forwardRows = [...summary.reusedR3aReferences, ...summary.runs.filter(row => row.direction === "forward")];
  const reverseRows = summary.runs.filter(row => row.direction === "reverse");
  const lines = ["# R3-b：纵行间接触脱开的平台与迟滞检查", "",
    "本研究是固定无摩擦模型的诊断，不是材料标定。任何结果均不用于选择、调整或推荐 K、B 或其他参数。", ""];
  if (includeOverview) {
    assert.ok(includeJudgments && summary.status === "COMPLETE", "Final overview requires the completed forward/reverse study");
    lines.push(table(fitHeaders, fitRows(orderedFits)), "",
      table(["问题", "按预登记规则判读", "数值"], [
        ["Q-平台", summary.analysis.platform.interpretation,
          `Δb=${number(summary.analysis.platform.deltaB)}；平台值=${number(summary.analysis.platform.platformValue)}（仅描述）`],
        ["Q-迟滞", summary.analysis.hysteresis.interpretation,
          `最大 |ΔW|/W=${number(Math.max(...summary.analysis.hysteresis.pairs.map(pair => pair.relativeW)))}`],
      ]), "",
      table(["方向", "l/mm", "转变区间"], [...summary.analysis.transitions.forward, ...summary.analysis.transitions.reverse]
        .map(row => [row.direction, row.l, row.interval])), "", ...overviewLines, "");
  }
  lines.push("## 1. 正向链", "",
    "每个 l 的固定延续路径为：R3-a 1/16→1/24→1/32，以及 R3-a 1/44→1/64。另复用 R3-a 1/4、1/8 作为已登记描述点；所有原结果按原文件复用，无新求解。", "",
    detailTables(forwardRows), fitsTable(allFits.filter(fit => fit.direction === "forward")),
    "签名为 waleSpacing、courseSpacing、diagonal、sameLoop 中 activePairs>0 的组集合。同方向同K档三个l签名相同才是状态一致。状态混合或含剪切点（|S|/W>1e-4）的档，其斜率只作描述。", "",
    "## 2. 反向链与迟滞对照", "",
    "固定路径为每个 l 的 R3-a 1/44→反向1/24→反向1/16，反向运行编号以-reverse结尾。", "",
    detailTables(reverseRows));
  if (summary.analysis?.hysteresis) {
    lines.push("正向对应档与反向档并列：", "", fitsTable(orderedFits.filter(fit => [16, 24].includes(fit.denominator))),
      table(["l/mm", "K倍数", "正向运行", "反向运行", "|ΔW|/W正", "|ΔH|/H正", "签名相同", "正向签名", "反向签名", "E正/N·mm", "E反/N·mm", "E反−E正", "较低总能量"],
        summary.analysis.hysteresis.pairs.map(pair => [pair.l, scale(pair), pair.forwardId, pair.reverseId,
          number(pair.relativeW), number(pair.relativeH), pair.sameSignature, signature(pair.forward.signature), signature(pair.reverse.signature),
          number(pair.energy.forwardTotal), number(pair.energy.reverseTotal), number(pair.energy.reverseMinusForward), pair.energy.lower])), "",
      "全部六对均保留；总能量和差值只作描述，不据此剔除或替换点。迟滞比较不使用斜率，不额外删去混合档或剪切档的几何/签名配对。", "");
  } else lines.push("反向研究尚未完成，六对比较与迟滞判读尚不可用。", "");
  lines.push("## 3. 判读", "",
    "Q-平台：正向1/32、1/44、1/64三档均须状态一致、无剪切点，且签名均不含waleSpacing；不满足时按任务书记“不确定（状态混合）”。前提满足时Δb=max(b_wale)−min(b_wale)：≤0.15为稳定平台，≥0.30为无稳定平台，中间为不确定。稳定平台值取三档平均，仅描述。", "",
    "Q-迟滞：六对全部 |ΔW|/W≤1e-4、|ΔH|/H≤1e-4且签名相同，为无迟滞；任一对 |ΔW|/W≥1e-2或签名不同，为存在迟滞或多解；其他为不确定。H的较大差异本身不是登记的迟滞阳性判据。", "");
  if (includeJudgments) {
    assert.ok(summary.analysis);
    const platform = summary.analysis.platform;
    lines.push(`Q-平台：**${platform.interpretation}**。判读用Δb=${number(platform.deltaB)}；描述性极差=${number(platform.descriptiveDeltaB)}；平台值=${number(platform.platformValue)}。`, "",
      `Q-迟滞：**${summary.analysis.hysteresis?.interpretation ?? "尚未完成"}**。`, "",
      table(["方向", "l/mm", "转变区间", "区间起点对数", "区间终点对数"],
        [...summary.analysis.transitions.forward, ...summary.analysis.transitions.reverse]
          .map(row => [row.direction, row.l, row.interval, row.from?.activePairs, row.to?.activePairs])), "");
  } else lines.push("本阶段保留逐点结果及描述性拟合；完整判读在R3b-3交接时呈现。", "");
  lines.push("## 4. 局限与来源", "",
    "本结果仅适用于登记的T1 N64无摩擦普通纬平针模型与延续初值，不证明真实面料充分放松或干放松的形态。真实纱径及其他未知物性仍为UNKNOWN；诊断覆盖不升级为材料实测。只检查指定的正反向路径，不能排除未探索分支。", "",
    "原输入数值设置原样沿用：N64、q=12（原输入未显式填写时保持其缺省）、maxIterations=24000、innerIterations=800、memorySize=180；不锁W/H/S。仅覆盖K，B及其余参数、容差和设置不变。", "",
    table(["字段", "记录"], [
      ["Value", "上表及r3b-summary.json的完整精度标量与分析；物性及诊断覆盖详见下表"],
      ["Unit", JSON.stringify(summary.provenance.unit)],
      ["Source", summary.provenance.source],
      ["Measurement / derivation principle", `${summary.provenance.principle}；密度=10m/W、10n/H，本组m=n=1；kw/kc=对应密度×l/10；非实物测量`],
      ["Confidence", summary.provenance.confidence],
      ["Applicable state", summary.provenance.applicableState],
    ]), "",
    table(["参数", "Value", "Unit", "Source", "Measurement / derivation principle", "Confidence", "Applicable state"],
      Object.entries(summary.materialParameters).flatMap(([l, params]) => Object.entries(params.provenance)
        .map(([key, value]) => [`原参数 l=${l} ${key}`, value.value, value.unit, value.source, value.principle, value.confidence, value.applicableState]))), "",
    table(["运行覆盖", "Value", "Unit", "Source", "Measurement / derivation principle", "Confidence", "Applicable state"],
      summary.runs.map(row => [row.id, ...["value", "unit", "source", "principle", "confidence", "applicableState"]
        .map(key => row.manifest?.overrideProvenance?.K?.[key])])), "",
    `研究状态：${summary.status}；累计计预算求解${summary.totalSolveCount}/45，实际调用${summary.totalInvocationCount}，中断恢复记录${summary.recovery.length}条。已完成点不重算，单目标仅允许直接失败后几何中点+一次目标重试；中断无终态调用不计入45次。`, "",
    `完整结果、原输入、manifest及日志根目录：${summary.archiveRoot}。逐次manifest记录HEAD、运行环境、时间、输入SHA-256、初值来源及K覆盖六字段。仅对新输入做登记的SHA-256；没有额外文件哈希、结果双跑或性能测量。`, "",
    "本报告渲染不运行验证或求解。各步实际validate/build数字及证据由执行者在相应提交正文记录，不把既有历史通过记录当成本步验收。", "");
  if (summary.recovery.length) lines.push(table(["中断运行", "恢复运行", "原输入", "原manifest", "快照目录", "处理"],
    summary.recovery.map(row => [row.interruptedAttemptId, row.resumedAttemptId, row.originalInputFile,
      row.originalManifestFile, row.snapshotDirectory, row.note])), "");
  return lines.join("\n");
}
