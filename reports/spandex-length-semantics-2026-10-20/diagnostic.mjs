// Report-only SOP replay. No production formulas, defaults, or project files are changed.
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { auditFinalYarnLength } from "../yarn-length-semantics-audit-2026-10-16/independent-auditor.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
process.chdir(root);
const directory = "reports/spandex-length-semantics-2026-10-20/";
const fixture = "reports/sop-001/SOP-001-N6W6040-main-yarn-with-cam.knitscape";
const historical = "reports/yarn-length-observability-2026-10-18/results.json";
const source = "User-provided production confirmation, 2026-10-20; task attachment df694446-3ebe-4997-b778-faac116ac107/已粘贴的文本.txt";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
async function snapshot() {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "utf8" }).split("\0").filter(p => p && !p.startsWith(directory));
  return Object.fromEntries(await Promise.all([...new Set(files)].sort().map(async p => [p, sha(await fs.readFile(p))])));
}
function datum(value, unit, evidenceClass, principle, state, confidence = "Production department confirmed for SOP-001") {
  return { value, unit, source, evidenceClass, measurementPrinciple: principle, confidence, applicableState: state };
}
const lengthUnit = "cm/100 machine needles";
const measured = value => datum(value, lengthUnit, "PROCESS_MEASURED",
  "Yarn extracted from the same fabric over a 100-needle span; measured relaxed, not taut", "Extracted, relaxed yarn");
const feeds = [1, 2, 3, 4, 5, 6, 7, 8];
const beforeFiles = await snapshot();
const baseline = { branch: git("branch", "--show-current"), head: git("rev-parse", "HEAD"),
  status: git("status", "--short"), log: git("log", "-1", "--oneline"),
  note: "Existing uncommitted work is part of this working-tree baseline; not a clean HEAD checkout" };
assert.equal(baseline.branch, "main");

// Match the established observability harness: replace only drawing, observe original geometry.
globalThis.devicePixelRatio = 1;
globalThis.Path2D = class {};
globalThis.window = { location: { search: "" } };
const canvas = { style: {} };
globalThis.document = { createTreeWalker: () => ({}), getElementById: id =>
  ["back", "mid", "front"].includes(id) ? canvas :
    { getBoundingClientRect: () => ({ width: 640, height: 480 }) } };
const observed = globalThis.__spandexObservation = { geometries: [], draw: null };
const server = await createServer({ configFile: false, appType: "custom", logLevel: "silent",
  server: { middlewareMode: true }, plugins: [{ name: "spandex-report-observer", enforce: "pre",
    transform(text, id) {
      const file = id.replaceAll("\\", "/");
      if (file.endsWith("/src/simulation/drawYarnSimulation.js"))
        return "export function drawYarnSimulation(args) { globalThis.__spandexObservation.draw = args; }";
      if (file.endsWith("/src/simulation/yarnPathGeometry.js")) {
        assert.equal(text.split("export function buildYarnPathGeometry(").length, 2);
        return text.replace("export function buildYarnPathGeometry(", "function originalBuild(") +
          "\nexport function buildYarnPathGeometry(args) { const g = originalBuild(args); globalThis.__spandexObservation.geometries.push({ args, g }); return g; }";
      }
    },
  }] });

try {
  const [pkg, simulation, execution, bimp, chartBuilder, material, machine] = await Promise.all([
    "/src/actions/projectPackage.js", "/src/simulation/yarnSimulation.js",
    "/src/components/singleJerseyExecutionInput.js", "/src/lib/Bimp.js",
    "/src/lib/buildChartFromRepeats.js", "/src/domain/yarnMaterial.js", "/src/domain/singleJerseyMachine.js",
  ].map(file => server.ssrLoadModule(file)));
  const bytes = await fs.readFile(fixture);
  const project = (await pkg.readProjectPackage(new Blob([bytes]))).project;
  const prior = JSON.parse(await fs.readFile(historical, "utf8"));
  assert.deepEqual([project.width, project.height, project.machineGauge], [30, 40, 32]);
  assert.deepEqual(project.needleArrangement, [1, 2, 3, 4]);
  assert.deepEqual(project.singleJerseyCamProgram.tracks.map(row => row.join("")),
    ["KKKKKKTT", "KKKKTTKK", "KKTTKKKK", "TTKKKKKK"]);
  assert.equal(project.singleJerseyCamProgram.feeds.length, 8);
  assert.ok(project.singleJerseyCamProgram.feeds.every(f => f.yarns.length === 1 && f.yarns[0].yarnLengthCmPer100Needles === 23));
  const effective = material.resolveYarnMaterial({ legacyContext: project.yarnPlies[0] });
  assert.equal(effective.diameter, 0.24);
  assert.equal(effective.diameterSource, "LEGACY_PRIMARY");
  assert.equal(effective.diameterUnit, "MODEL_NEEDLE_PITCH");
  const operations = machine.resolveSingleJerseyOperations(project.singleJerseyCamProgram, project.needleArrangement, 4, 8);
  const args = [bimp.Bimp.fromJSON(project.yarnSequence), project.yarnPalette, 1, project.yarnPlies];
  const options = { machineGauge: project.machineGauge, texturePerformanceMode: "solid" };
  const chart = chartBuilder.buildChartFromRepeats({ width: 30, height: 40, emptyColor: 0,
    repeats: project.repeats.map(r => ({ ...r, bitmap: bimp.Bimp.fromJSON(r.bitmap) })) });
  const preview = simulation.simulate(chart, ...args, options);
  preview.stopSim();
  const m2 = { value: preview.yarnLengthMetrics.cmPer100Loops, unit: "cm/100 loops (legacy label)",
    evidenceClass: "SOFTWARE_DERIVED", source: "simulate(Pattern).yarnLengthMetrics",
    measurementPrinciple: "Existing pre-arrangement finite preview metric",
    confidence: "Software diagnostic only", applicableState: "Whole Pattern preview, not per Feed or per Yarn",
    denominator: preview.yarnLengthMetrics.effectiveLoopCount };
  const specs = [
    { id: "C-main23", target: null, ratio: null, classification: "SAVED_MAIN_YARN_CONTROL" },
    { id: "A-old8", target: 8, ratio: null, classification: "OLD_SEMANTIC_DIAGNOSTIC" },
    ...[2.8, 3.0, 3.2, 3.6].map(ratio => ({ id: `draft-${ratio.toFixed(1)}`,
      target: 8 * ratio, ratio, classification: ratio === 3.6 ? "PRODUCTION_LIMIT_DIAGNOSTIC" : "NORMAL_PROCESS_RANGE_DIAGNOSTIC" })),
  ];
  const runs = [];
  for (const spec of specs) {
    const p = structuredClone(project);
    if (spec.target !== null) {
      p.yarnLibrary.push({ id: "audit-low", name: "20D bare spandex (diagnostic)", category: "OTHER", pbr: null });
      p.singleJerseyCamProgram.feeds.forEach(f => f.yarns.push({
        yarnId: "audit-low", yarnLengthCmPer100Needles: spec.target, tensionCN: null, placement: "parallel",
      }));
    }
    observed.geometries = [];
    const pattern = execution.createSingleJerseyExecutionInput(p.singleJerseyCamProgram, p.needleArrangement, 30, 40);
    const run = simulation.simulate(pattern, ...args, { ...options,
      feeds: p.singleJerseyCamProgram.feeds, yarnLibrary: p.yarnLibrary });
    run.stopSim();
    const base = observed.geometries.find(g => !g.args.measurementWindow);
    const periodic = observed.geometries.find(g => g.args.measurementWindow);
    assert.ok(base && periodic);
    assert.equal(periodic.args.measurementWindow.needleCount, 30);
    const points = base.args.yarnGraph.makeNice();
    const geometry = { gauge: 32, width: 30, height: 40, feedCount: 8, coordinateKind: "model", coordinateScale: 1,
      links: base.g.yarnPathLinks.map(link => ({ ...link,
        sourceNeedle: Math.floor(points[link.index].i / 2) - 1,
        targetNeedle: Math.floor(points[link.index + 1].i / 2) - 1 })),
      strands: observed.draw.yarnStrands.map(strand => ({ paths: [...strand.modelPathByLink] })) };
    const diagnostics = run.yarnLengthSolverResults.map(r => {
      const M3 = auditFinalYarnLength({ geometry, feedIndex: r.feedIndex, yarnIndex: r.yarnIndex });
      assert.equal(M3.measuredNeedleCount, 48);
      assert.ok(M3.pathLinkCount > 0);
      const candidateM3 = auditFinalYarnLength({ geometry: { ...geometry,
        strands: geometry.strands.map((strand, index) => index === r.yarnIndex ? { paths: [...r.solvedPathByLink] } : strand) },
        feedIndex: r.feedIndex, yarnIndex: r.yarnIndex });
      const actualPaths = new Map(geometry.strands[r.yarnIndex].paths);
      if (r.appliedToSimulation)
        for (const [key, value] of r.solvedPathByLink) assert.equal(actualPaths.get(key), value, "Applied candidate must be final drawn path");
      assert.equal(r.toleranceCmPer100Needles, 0.00079375);
      assert.deepEqual([r.reachableRange.minLoopHeight, r.reachableRange.maxLoopHeight], [0.05, 2]);
      return { feed: r.feedIndex + 1, yarnIndex: r.yarnIndex,
        yarnId: p.singleJerseyCamProgram.feeds[r.feedIndex].yarns[r.yarnIndex].yarnId,
        target: r.targetLengthCmPer100Needles, status: r.status, converged: r.converged,
        solvedLength: r.solvedLengthCmPer100Needles, error: r.errorCmPer100Needles,
        loopHeight: r.solvedLoopHeight, reachableRange: r.reachableRange,
        appliedCandidate: { applied: r.appliedToSimulation, pathCount: r.solvedPathByLink.size,
          finalPathEqualityChecked: r.appliedToSimulation, candidateM3: candidateM3.normalizedCmPer100Needles },
        M1: r.solvedLengthCmPer100Needles, M2: m2.value, M3: M3.normalizedCmPer100Needles,
        M3PathState: r.appliedToSimulation ? "APPLIED_SOLVED_PATH" : "BASE_FALLBACK_PATH",
        M3Window: M3.interval, M3Denominator: M3.measuredNeedleCount,
        tolerance: r.toleranceCmPer100Needles };
    });
    assert.equal(diagnostics.length, spec.target === null ? 8 : 16);
    for (const yarnIndex of spec.target === null ? [0] : [0, 1])
      assert.deepEqual(diagnostics.filter(d => d.yarnIndex === yarnIndex).map(d => d.feed), feeds);
    // Compare every historical 23/8 Feed, including failed candidate vs actual path.
    const oldRun = prior.runs.find(r => r.id === (spec.target === null ? "30x40-saved-main-yarn" : "30x40-diagnostic-two-yarn"));
    for (const d of diagnostics.filter(d => d.yarnIndex === 0 || spec.id === "A-old8")) {
      const old = oldRun.diagnostics.find(o => o.feedIndex === d.feed - 1 && o.yarnIndex === d.yarnIndex);
      assert.deepEqual([d.M1, d.M2, d.M3, d.error, d.loopHeight, d.status, d.converged,
        d.appliedCandidate.applied, d.appliedCandidate.candidateM3, d.reachableRange],
      [old.m1.value, old.m2.value, old.m3.value, old.m1.error, old.m1.solvedLoopHeight,
        old.m1.status, old.m1.converged, old.m1.appliedToSimulation, old.m3.solverCandidateValue, old.m1.reachableRange],
      `Historical numeric drift: ${spec.id}, Feed ${d.feed}, Yarn ${d.yarnIndex}`);
    }
    if (spec.id === "A-old8") assert.ok(diagnostics.filter(d => d.yarnIndex === 1)
      .every(d => d.status === "UNREACHABLE_TARGET" && !d.appliedCandidate.applied));
    runs.push({ ...spec, previewValidity: run.previewValidity, diagnostics });
    console.log(JSON.stringify({ scenario: spec.id, target: spec.target,
      feeds: diagnostics.filter(d => d.yarnIndex === (spec.target === null ? 0 : 1))
        .map(d => ({ feed: d.feed, status: d.status, M1: d.M1, M3: d.M3, loopHeight: d.loopHeight })) }));
  }
  const main = runs[0].diagnostics;
  const nominal = runs.find(r => r.ratio === 3).diagnostics.filter(d => d.yarnIndex === 1);
  const normalReachable = runs.filter(r => r.ratio !== null && r.ratio <= 3.2)
    .every(r => r.diagnostics.filter(d => d.yarnIndex === 1).every(d => d.status === "CONVERGED" && d.appliedCandidate.applied));
  const afterFiles = await snapshot();
  assert.deepEqual(afterFiles, beforeFiles, "No existing file may change during diagnostic replay");
  assert.equal(git("rev-parse", "HEAD"), baseline.head);
  const results = { date: "2026-10-20", timezone: "Asia/Shanghai", baseline,
    sources: { processConfirmation: source, fixture, fixtureSha256: sha(bytes), historical,
      softwareSha256: Object.fromEntries(Object.entries(beforeFiles).filter(([file]) =>
        file.startsWith("src/") || ["package.json", "package-lock.json"].includes(file))) },
    machine: { equipment: datum("润山单面大圆机", "machine identity", "PROCESS_FACT", "Production confirmation", "SOP-001"),
      cylinderDiameter: datum(32, "inch", "PROCESS_FACT", "Production confirmation", "Machine"),
      gauge: datum(32, "needles/inch", "PROCESS_FACT", "Production confirmation", "Machine"),
      totalNeedles: datum(3216, "needles", "PROCESS_FACT", "Production confirmation", "Machine"),
      feedCount: 96, camSeatCount: 96, yarnFeedingPositionCount: 96, oneToOneCorrespondence: true },
    processCycle: { processFeedCount: 8, machineFeedCount: 96, processRepeatCount: 12, minimumCompleteCycle: true,
      mainYarnFeeds: feeds, spandexFeeds: feeds, topologyContract: "Same Feed assignments share K/T/M actions; not necessarily coincident 3D centerlines",
      operationsByFeed: operations.map((ops, i) => ({ feed: i + 1, actions: ops.join("") })),
      source, evidenceClass: "PROCESS_FACT", note97: "PROCESS NOTE ONLY: 97 = 12*8+1; no software logic added" },
    mainYarn: { name: "N6/W(6040)", relaxedMeasuredLength: measured(23),
      tension: { ...datum(5, "cN", "PROCESS_MEASURED", "Production-confirmed tension measurement record", "Recorded measurement state; no force model"), activeInGeometry: false },
      solverDiagnostics: main },
    spandex: { name: "20D裸氨纶", relaxedMeasuredLength: measured(8),
      draftRatio: datum(3, "dimensionless ratio", "PROCESS_CONFIRMED_PARAMETER",
        "knitting-state length / relaxed length; production department definition", "Current SOP weaving use"),
      normalDraftRange: [2.8, 3.2], limitDraftRatio: 3.6, feeder: "专用弹力送纱装置",
      derivedKnittingLength: datum(24, lengthUnit, "PROCESS_DERIVED_VALUE", "8 * 3.0",
        "Knitting-state reference; not directly measured", "Arithmetic from confirmed definition; geometry equivalence not validated"),
      tension: { ...datum(4, "cN", "PROCESS_MEASURED", "Production-confirmed tension measurement record", "Recorded measurement state; no force model"), activeInGeometry: false },
      qcTolerance: 0.02, solverDiagnostics: nominal },
    qc: { evidenceClass: "PROCESS_FACT", source, relativeTolerance: 0.02, role: "Formal sampling acceptance",
      ranges: { mainRelaxed: [22.54, 23.46], spandexRelaxed: [7.84, 8.16], spandexKnittingAtFixedDraft3: [23.52, 24.48] },
      rangeEvidenceClass: "DERIVED_FROM_QC_RANGE", principle: "measured reference * (1 +/- 0.02), then * 3 for spandex knitting reference",
      unit: lengthUnit, usedAsSolverThreshold: false },
    softwareMeasurementContract: { evidenceClass: "SOFTWARE_DERIVED",
      source: "Existing simulate / yarnPathGeometry / yarnLengthSolver and independent-auditor.mjs",
      confidence: "Reproducible software diagnostics; not calibrated factory acceptance", applicableState: "30x40 SOP fixture geometry",
      M1: "Existing periodic 30-needle window, all same-Feed courses including top boundary, mean cm/100 needles",
      M2: m2, M3: "Independent integration of final paths: needles [4,20), 3 interior same-Feed courses, denominator 48 needle passages",
      loopHeightUnit: "model needle pitch", reachableRangeUnit: lengthUnit,
      loopHeightBounds: [0.05, 2], solverToleranceModel: 0.01, solverToleranceCm100: 0.00079375,
      diameter: { value: 0.24, unit: effective.diameterUnit, source: effective.diameterSource,
        measurementPrinciple: "Existing legacy primary model offset", confidence: "UNVALIDATED_MODEL_PARAMETER",
        applicableState: "Model geometry only", realDiameter: "UNKNOWN" } },
    fixtureContract: { width: 30, height: 40, sourceSavedAssignment: "Main yarn only; original tension=null",
      diagnosticAssignment: "Production-confirmed spandex presence on 1-8 added only to in-memory clone; current generic slot behavior",
      tensionHandling: "Confirmed 5/4 cN recorded here only; existing null simulation fields preserved",
      geometryPlacement: "Existing parallel compatibility value; no new physical placement assumption" },
    runs,
    comparison23vs24: nominal.map((d, i) => ({ feed: d.feed, deltaM1: d.M1 - main[i].M1,
      deltaM3: d.M3 - main[i].M3, deltaLoopHeight: d.loopHeight - main[i].loopHeight,
      relativeLoopHeightChange: d.loopHeight / main[i].loopHeight - 1 })),
    conclusions: { semanticMismatchSupported: nominal.every(d => d.status === "CONVERGED" && d.appliedCandidate.applied),
      normalRangeAllConverged: normalReachable, nextStageModel: normalReachable ? "PARTIALLY_SUPPORTED" : "NOT_SUPPORTED",
      reason: "Separate relaxed and knitting-state references; current M1/M3 window mismatch and uncalibrated physics remain",
      numericDrift: "NO: exact historical 23/8 per-Feed comparison; all main23 slots unchanged across scenarios",
      processMeasurementContract: "ESTABLISHED_FOR_SOP001", realMachineValidation: "PARTIAL",
      spandexPhysicalModel: "NOT_IMPLEMENTED", diagnostic: "PASS" },
    preservation: { checkedFiles: Object.keys(beforeFiles).length, beforeSha256: sha(JSON.stringify(beforeFiles)),
      afterSha256: sha(JSON.stringify(afterFiles)), changedOutsideDiagnosticDirectory: [],
      scope: "Tracked and nonignored files; excludes ignored build/cache files",
      srcChanged: false, solverChanged: false, geometryMathChanged: false, projectFormatChanged: false,
      dependencyChanged: false, packageJsonChanged: false },
    verification: { diagnostic: "PASS; six scenarios, 88 Feed/Yarn records; historical equality and applied-path assertions",
      fullSuite: "See REPORT.md for separately executed before/after checks" } };
  await fs.writeFile(new URL("results.json", import.meta.url), JSON.stringify(results, null, 2) + "\n");
  console.log("SPANDEx_LENGTH_SEMANTICS_DIAGNOSTIC = PASS");
} finally {
  await server.close();
}
