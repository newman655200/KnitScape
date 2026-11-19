// Read-only production replay, following the existing Gauge/SOP probes.
// Only the draw sink is replaced; geometry, Solver, acceptance and M2 are real.
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "vite";
import { auditFinalYarnLength } from "../yarn-length-semantics-audit-2026-10-16/independent-auditor.mjs";

const baseline = process.argv.includes("--baseline");
const out = new URL("./", import.meta.url);
globalThis.devicePixelRatio = 1;
globalThis.Path2D = class {};
globalThis.window = { location: { search: "" } };
const canvas = { style: {} };
globalThis.document = { createTreeWalker: () => ({}), getElementById: id =>
  ["back", "mid", "front"].includes(id) ? canvas :
    { getBoundingClientRect: () => ({ width: 640, height: 480 }) } };
const observed = globalThis.__lengthObservation = { geometries: [], draw: null };
const server = await createServer({ configFile: false, appType: "custom", logLevel: "silent",
  server: { middlewareMode: true }, plugins: [{ name: "observe-length", enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/");
      if (file.endsWith("/src/simulation/drawYarnSimulation.js")) {
        return "export function drawYarnSimulation(args) { globalThis.__lengthObservation.draw = args; }";
      }
      if (file.endsWith("/src/simulation/yarnPathGeometry.js")) return source.replace(
        "export function buildYarnPathGeometry(", "function originalBuild(") +
        "\nexport function buildYarnPathGeometry(args) { const g = originalBuild(args); globalThis.__lengthObservation.geometries.push({ args, g }); return g; }";
    },
  }] });
try {
  const [{ readProjectPackage }, { simulate }, { createSingleJerseyExecutionInput },
    { Bimp }, { buildChartFromRepeats }, { modelLengthToMm }] = await Promise.all([
    "/src/actions/projectPackage.js", "/src/simulation/yarnSimulation.js",
    "/src/components/singleJerseyExecutionInput.js", "/src/lib/Bimp.js",
    "/src/lib/buildChartFromRepeats.js", "/src/simulation/yarnLengthMetrics.js",
  ].map(file => server.ssrLoadModule(file)));
  const source = "reports/sop-001/SOP-001-N6W6040-main-yarn-with-cam.knitscape";
  const bytes = await fs.readFile(source);
  const project = (await readProjectPackage(new Blob([bytes]))).project;
  assert.equal(project.machineGauge, 32);
  assert.deepEqual(project.needleArrangement, [1, 2, 3, 4]);
  assert.equal(project.singleJerseyCamProgram.tracks.length, 4);
  assert.ok(project.singleJerseyCamProgram.tracks.every(row => row.length === 8));
  const runs = [];
  for (const width of [30, 32]) {
    for (const secondYarn of [false, true]) {
      const p = structuredClone(project);
      p.width = width;
      if (secondYarn) {
        // Same explicit diagnostic assignment as the existing geometry-gap audit.
        p.yarnLibrary.push({ id: "audit-low", name: "20D LOW (diagnostic assignment)", category: "OTHER", pbr: null });
        p.singleJerseyCamProgram.feeds.forEach(feed => feed.yarns.push({
          yarnId: "audit-low", yarnLengthCmPer100Needles: 8, tensionCN: null, placement: "parallel",
        }));
      }
      const simulationArgs = [Bimp.fromJSON(p.yarnSequence), p.yarnPalette, 1, p.yarnPlies];
      const options = { machineGauge: p.machineGauge, texturePerformanceMode: "solid" };
      const chart = buildChartFromRepeats({ width, height: p.height, emptyColor: 0,
        repeats: p.repeats.map(repeat => ({ ...repeat, bitmap: Bimp.fromJSON(repeat.bitmap) })) });
      const before = simulate(chart, ...simulationArgs, options);
      before.stopSim();
      observed.geometries = [];
      const pattern = createSingleJerseyExecutionInput(p.singleJerseyCamProgram, p.needleArrangement, width, p.height);
      const after = simulate(pattern, ...simulationArgs, { ...options,
        feeds: p.singleJerseyCamProgram.feeds, yarnLibrary: p.yarnLibrary });
      after.stopSim();
      const base = observed.geometries.find(item => !item.args.measurementWindow);
      const periodic = observed.geometries.find(item => item.args.measurementWindow);
      assert.ok(base && periodic);
      const span = periodic.args.measurementWindow.needleCount;
      assert.equal(span, width === 32 ? 4 : 30);
      if (!baseline) {
        assert.equal(base.g.integrationNeedleCount, span);
        assert.equal(base.g.windowNeedleCountByCourse.get(7), width);
        assert.ok(!("measuredNeedleCountByCourse" in base.g));
      }
      const points = base.args.yarnGraph.makeNice();
      const auditGeometry = {
        gauge: p.machineGauge, width, height: p.height, feedCount: 8,
        coordinateKind: "model", coordinateScale: 1,
        links: base.g.yarnPathLinks.map(link => ({ ...link,
          sourceNeedle: Math.floor(points[link.index].i / 2) - 1,
          targetNeedle: Math.floor(points[link.index + 1].i / 2) - 1,
        })),
        strands: observed.draw.yarnStrands.map(strand => ({ paths: [...strand.modelPathByLink] })),
      };
      const evaluate = base.g.createModelLengthEvaluator();
      const m2 = { measurementId: "M2", value: before.yarnLengthMetrics.cmPer100Loops,
        unit: "cm/100 loops (legacy label)", feedIndex: null, yarnIndex: null, yarnId: null,
        scope: "Whole pre-arrangement Pattern preview; shared context, not a Feed/Yarn measurement",
        sourceFunction: "buildYarnPathGeometry/buildYarnLengthMetrics -> cmPer100Loops",
        window: { width, height: p.height, bothEndpointsInside: true },
        denominator: before.yarnLengthMetrics.effectiveLoopCount, denominatorUnit: "chart cells (width*height)",
        normalizationBasis: 100, totalPathLengthStitchUnits: before.yarnLengthMetrics.totalPathLengthStitchUnits,
        gauge: before.yarnLengthMetrics.gauge, samplesPerCubic: 24, usedByUI: true,
        machinePreview: { value: after.yarnLengthMetrics.cmPer100Loops,
          totalPathLengthStitchUnits: after.yarnLengthMetrics.totalPathLengthStitchUnits,
          denominator: after.yarnLengthMetrics.effectiveLoopCount,
          scope: "Post-arrangement base geometry, first strand, before Solver; not the UI readout", usedByUI: false },
      };
      const diagnostics = after.yarnLengthSolverResults.map(result => {
        const { feedIndex, yarnIndex } = result;
        const yarnId = p.singleJerseyCamProgram.feeds[feedIndex].yarns[yarnIndex].yarnId;
        const candidate = evaluate(result.solvedLoopHeight);
        const courses = [...candidate.measuredModelLengthPer100NeedlesByCourse]
          .filter(([row]) => row % 8 === feedIndex)
          .map(([row, value]) => ({ row, modelLengthPer100Needles: value, cmPer100Needles: modelLengthToMm(value, p.machineGauge) / 10 }));
        // Verifies observed courses describe the actual Solver result, not another metric.
        assert.ok(Math.abs(courses.reduce((sum, c) => sum + c.cmPer100Needles, 0) / courses.length - result.solvedLengthCmPer100Needles) < 1e-12);
        const m3 = auditFinalYarnLength({ geometry: auditGeometry, feedIndex, yarnIndex });
        assert.equal(m3.measuredNeedleCount, 48);
        assert.ok(m3.pathLinkCount > 0);
        // Failed Solver candidates are not applied; expose candidate M3 separately.
        const candidateGeometry = { ...auditGeometry,
          strands: auditGeometry.strands.map((strand, index) => index === yarnIndex
            ? { paths: [...result.solvedPathByLink] } : strand) };
        const candidateM3 = auditFinalYarnLength({ geometry: candidateGeometry, feedIndex, yarnIndex });
        return { feedIndex, yarnIndex, yarnId, yarnName: p.yarnLibrary.find(yarn => yarn.id === yarnId)?.name ?? null,
          target: { value: result.targetLengthCmPer100Needles, unit: "cm/100 needles",
            source: yarnIndex ? "SOP 8; assignment copied from prior diagnostic probe, not saved SOP project" : source,
            measurementPrinciple: "PENDING_PROCESS_CONFIRMATION", confidence: "Transcribed target; process equivalence unconfirmed", applicableState: "UNKNOWN" },
          m1: { measurementId: "M1", value: result.solvedLengthCmPer100Needles, unit: "cm/100 needles",
            sourceFunction: "createModelLengthEvaluator -> solveFeedYarnLengths/measuredLengthForFeed -> resultFromCandidate",
            window: { chartWidth: width, chartHeight: p.height, periodicGeometryWidth: periodic.args.pattern.width,
              firstNeedlePadded: periodic.args.measurementWindow.firstNeedle, sourceOwnership: "whole outgoing link" },
            windowNeedleCount: width, integrationNeedleCount: span, normalizationBasis: 100,
            denominatorUnit: "needle positions per course", aggregation: "arithmetic mean of all measured courses of this Feed",
            courses, status: result.status, converged: result.converged, appliedToSimulation: result.appliedToSimulation,
            solvedLoopHeight: result.solvedLoopHeight, reachableRange: result.reachableRange,
            error: result.errorCmPer100Needles, tolerance: result.toleranceCmPer100Needles },
          m2,
          m3: { measurementId: "M3", value: m3.normalizedCmPer100Needles, unit: "cm/100 needle passages",
            sourceFunction: "reports/yarn-length-semantics-audit-2026-10-16/independent-auditor.mjs:auditFinalYarnLength",
            pathState: result.appliedToSimulation ? "applied solved path" : "base fallback path (failed candidate not applied)",
            window: m3.interval, integrationNeedleCount: m3.interval.needleCount,
            denominator: m3.measuredNeedleCount, normalizationBasis: 100,
            rawModelLength: m3.rawModelLength, physicalMm: m3.physicalMm, pathLinkCount: m3.pathLinkCount,
            perCourse: m3.perCourse,
            solverCandidateValue: candidateM3.normalizedCmPer100Needles,
            solverCandidateApplied: result.appliedToSimulation },
          processValidation: "PENDING", productionValidated: false,
        };
      });
      const feed8 = diagnostics.find(d => d.feedIndex === 7 && d.yarnIndex === 0);
      const expected = width === 30 ? [22.999733873, 24.077277996] : [22.999580039, 23.701615835];
      assert.ok(Math.abs(feed8.m1.value - expected[0]) < 1e-8, "M1 historical fixture changed: stop and investigate");
      assert.ok(Math.abs(feed8.m3.value - expected[1]) < 1e-8, "M3 historical fixture changed: stop and investigate");
      if (secondYarn) assert.ok(diagnostics.filter(d => d.yarnIndex === 1).every(d =>
        d.m1.status === "UNREACHABLE_TARGET" && !d.m1.appliedToSimulation));
      runs.push({ id: `${width}x40-${secondYarn ? "diagnostic-two-yarn" : "saved-main-yarn"}`,
        width, height: p.height, secondYarnAssignment: secondYarn ? "SYNTHETIC_DIAGNOSTIC_ONLY" : "ABSENT",
        gauge: p.machineGauge, previewValidity: after.previewValidity, diagnostics });
      console.log(JSON.stringify({ run: runs.at(-1).id, feed8: diagnostics.filter(d => d.feedIndex === 7)
        .map(d => ({ yarn: d.yarnName, m1: d.m1.value, m2: d.m2.value, m2Machine: d.m2.machinePreview.value,
          m3: d.m3.value, candidateM3: d.m3.solverCandidateValue, status: d.m1.status, range: d.m1.reachableRange })) }));
    }
  }
  const results = { measurementContractVersion: 1, date: "2026-10-18", timezone: "Asia/Shanghai",
    branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
    head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    source, sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    geometryInputs: { gauge: { value: 32, unit: "needles/inch", source, principle: "25.4/G mm per model needle pitch", confidence: "SOP transcription", applicableState: "machine pitch, not relaxed fabric" },
      diameter: { value: 0.24, unit: "model needle pitch", source: "saved yarnPlies[0].diameter; runtime fallback for both diagnostic yarns", principle: "existing model curve offset", confidence: "UNVALIDATED_MODEL_PARAMETER", applicableState: "model only; physical yarn diameter UNKNOWN" },
      primaryLengthScaleY: { value: 1, unit: "ratio", source, principle: "existing template height scale", confidence: "SOFTWARE_INPUT", applicableState: "model only" } },
    canonicalFactoryMeasurement: "PENDING_PROCESS_CONFIRMATION", runs };
  if (!baseline) {
    const prior = JSON.parse(await fs.readFile(new URL("baseline-results.json", out), "utf8"));
    assert.deepEqual(results, prior, "Metadata-only change must leave every diagnostic value, status and course unchanged");
  }
  await fs.writeFile(new URL(baseline ? "baseline-results.json" : "results.json", out), JSON.stringify(results, null, 2) + "\n");
  console.log(`PASS: ${runs.length} scenarios; 48 Feed/Yarn records; ${baseline ? "baseline captured" : "exact baseline equality"}.`);
} finally { await server.close(); }
