// Full SOP fixture replay spans persistence, Machine adapter, simulation and the
// independent historical diagnostic; narrow input validators cover editing.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer } from "vite";
import { auditFinalYarnLength } from "../reports/yarn-length-semantics-audit-2026-10-16/independent-auditor.mjs";

const sourceFile = "reports/sop-001/SOP-001-N6W6040-main-yarn-with-cam.knitscape";
const historicalFile = "reports/spandex-length-semantics-2026-10-20/results.json";
const outputDirectory = process.argv.includes("--write-report")
  ? "reports/spandex-process-contract-implementation-2026-10-20" : null;
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
globalThis.devicePixelRatio = 1;
globalThis.Path2D = class {};
globalThis.window = { location: { search: "" }, setTimeout, clearTimeout };
const canvas = { style: {} };
globalThis.document = { createTreeWalker: () => ({}), getElementById: id =>
  ["back", "mid", "front"].includes(id) ? canvas :
    { getBoundingClientRect: () => ({ width: 640, height: 480 }) } };
const observation = globalThis.__processContractObservation = { geometries: [], draw: null };
const server = await createServer({ configFile: false, appType: "custom", logLevel: "silent",
  server: { middlewareMode: true }, plugins: [{ name: "process-contract-observer", enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/");
      if (file.endsWith("/src/simulation/drawYarnSimulation.js"))
        return "export function drawYarnSimulation(args) { globalThis.__processContractObservation.draw = args; }";
      if (file.endsWith("/src/simulation/yarnPathGeometry.js"))
        return source.replace("export function buildYarnPathGeometry(", "function originalBuild(") +
          "\nexport function buildYarnPathGeometry(args) { const g = originalBuild(args); globalThis.__processContractObservation.geometries.push({ args, g }); return g; }";
    },
  }] });

try {
  const [pkg, simulation, execution, { Bimp }, cam, input, { loadJSON }, { getProjectData }, state] = await Promise.all([
    "/src/actions/projectPackage.js", "/src/simulation/yarnSimulation.js",
    "/src/components/singleJerseyExecutionInput.js", "/src/lib/Bimp.js",
    "/src/actions/singleJerseyCamProgram.js", "/src/domain/yarnLengthInput.js",
    "/src/actions/importers.js", "/src/actions/exporters.js", "/src/state.js",
  ].map(file => server.ssrLoadModule(file)));
  const originalBytes = await fs.readFile(sourceFile);
  const sourceHash = sha(originalBytes);
  const opened = await pkg.readProjectPackage(new Blob([originalBytes]));
  const project = opened.project;
  const historical = JSON.parse(await fs.readFile(historicalFile, "utf8"));
  assert.deepEqual([project.width, project.height, project.machineGauge], [30, 40, 32]);
  assert.deepEqual(project.singleJerseyCamProgram.tracks.map(row => row.join("")),
    ["KKKKKKTT", "KKKKTTKK", "KKTTKKKK", "TTKKKKKK"]);
  assert.deepEqual(project.needleArrangement, [1, 2, 3, 4]);
  const fixture = structuredClone(project);
  fixture.yarnLibrary.push({ id: "sop001-bare-spandex", name: "20D裸氨纶", category: "OTHER",
    createdAt: "2026-10-20T00:00:00.000Z", updatedAt: "2026-10-20T00:00:00.000Z" });
  fixture.singleJerseyCamProgram.feeds.forEach(feed => {
    feed.yarns[0] = { ...feed.yarns[0], lengthInputMode: "directTarget", tensionCN: 5 };
    feed.yarns.push({ yarnId: "sop001-bare-spandex", lengthInputMode: "relaxedWithDraft",
      relaxedLengthCmPer100Needles: 8, draftRatio: 3, tensionCN: 4, placement: "parallel" });
  });
  fixture.singleJerseyCamProgram = cam.normalizeSingleJerseyCamProgram(fixture.singleJerseyCamProgram);
  const diagnostics = p => {
    observation.geometries.length = 0;
    const pattern = execution.createSingleJerseyExecutionInput(p.singleJerseyCamProgram, p.needleArrangement, 30, 40);
    const result = simulation.simulate(pattern, Bimp.fromJSON(p.yarnSequence), p.yarnPalette, 1, p.yarnPlies,
      { feeds: p.singleJerseyCamProgram.feeds, yarnLibrary: p.yarnLibrary, machineGauge: 32, texturePerformanceMode: "solid" });
    result.stopSim();
    const base = observation.geometries.find(item => !item.args.measurementWindow);
    const points = base.args.yarnGraph.makeNice();
    const geometry = { gauge: 32, width: 30, height: 40, feedCount: 8, coordinateKind: "model", coordinateScale: 1,
      links: base.g.yarnPathLinks.map(link => ({ ...link,
        sourceNeedle: Math.floor(points[link.index].i / 2) - 1,
        targetNeedle: Math.floor(points[link.index + 1].i / 2) - 1 })),
      strands: observation.draw.yarnStrands.map(strand => ({ paths: [...strand.modelPathByLink] })) };
    return { previewValidity: result.previewValidity, rows: result.yarnLengthSolverResults.map(r => ({
      feed: r.feedIndex + 1, yarnIndex: r.yarnIndex, input: r.lengthInput,
      target: r.targetLengthCmPer100Needles, status: r.status, applied: r.appliedToSimulation,
      M1: r.solvedLengthCmPer100Needles, error: r.errorCmPer100Needles,
      loopHeight: r.solvedLoopHeight, tolerance: r.toleranceCmPer100Needles,
      M3: auditFinalYarnLength({ geometry, feedIndex: r.feedIndex, yarnIndex: r.yarnIndex }).normalizedCmPer100Needles,
    })) };
  };
  const directControl = diagnostics(project);
  const nominal = diagnostics(fixture);
  assert.equal(nominal.rows.length, 16);
  assert.equal(nominal.previewValidity, "VALIDATED");
  for (const row of nominal.rows) {
    assert.equal(row.status, "CONVERGED");
    assert.equal(row.applied, true);
    assert.equal(row.tolerance, 0.00079375, "SOP ±2% does not change Solver tolerance.");
    const old = historical.runs.find(run => run.id === "draft-3.0").diagnostics
      .find(d => d.feed === row.feed && d.yarnIndex === row.yarnIndex);
    assert.deepEqual([row.M1, row.M3, row.error, row.loopHeight, row.status],
      [old.M1, old.M3, old.error, old.loopHeight, old.status], "Historical M1/M3 drift must be exactly zero.");
    if (row.yarnIndex === 0) {
      const control = directControl.rows.find(d => d.feed === row.feed);
      assert.deepEqual([row.M1, row.M3, row.loopHeight], [control.M1, control.M3, control.loopHeight]);
    } else {
      assert.deepEqual([row.input.relaxedLengthCmPer100Needles, row.input.draftRatio, row.target], [8, 3, 24]);
    }
  }
  const varying = structuredClone(fixture);
  const expectedTargets = [22.4, 24, 25.6, 24, 24, 24, 24, 24];
  varying.singleJerseyCamProgram.feeds.forEach((feed, index) => {
    feed.yarns[1].relaxedLengthCmPer100Needles = [8, 8, 8, 10, 12, 6, 4, 3][index];
    feed.yarns[1].draftRatio = [2.8, 3, 3.2, 2.4, 2, 4, 6, 8][index];
    assert.equal(input.resolveYarnLengthInput(feed.yarns[1]).effectiveTargetLengthCmPer100Needles, expectedTargets[index]);
  });
  const perFeed = diagnostics(varying);
  assert.deepEqual(perFeed.rows.filter(row => row.yarnIndex === 1).map(row => row.target), expectedTargets);
  assert.ok(perFeed.rows.every(row => row.status === "CONVERGED"));
  const old8 = structuredClone(fixture);
  old8.singleJerseyCamProgram.feeds.forEach(feed => {
    feed.yarns[1] = { yarnId: "sop001-bare-spandex", yarnLengthCmPer100Needles: 8, tensionCN: 4, placement: "parallel" };
  });
  const oldDiagnostic = diagnostics(old8);
  assert.ok(oldDiagnostic.rows.filter(row => row.yarnIndex === 1).every(row => row.status === "UNREACHABLE_TARGET"));
  for (const row of oldDiagnostic.rows) {
    const old = historical.runs.find(run => run.id === "A-old8").diagnostics
      .find(d => d.feed === row.feed && d.yarnIndex === row.yarnIndex);
    assert.deepEqual([row.M1, row.M3, row.status], [old.M1, old.M3, old.status]);
  }
  // Serialization must choose the new format even when cloning a v2 project.
  const blob = await pkg.createProjectPackage(fixture, opened.registry);
  const roundTrip = await pkg.readProjectPackage(blob);
  assert.equal(roundTrip.project.version, 3);
  assert.deepEqual(roundTrip.project.requiredCapabilities, ["relaxed-yarn-length-with-draft-v1"]);
  const serialized = JSON.stringify(roundTrip.project);
  for (const key of ["effectiveTargetLength", "derivedKnittingLength", "yarnLengthSolverResults", "previewValidity", "feedYarnStructureRevision"])
    assert.ok(!serialized.includes(key), `Project must omit ${key}`);
  assert.ok(!/:24(?:[,}])/.test(serialized), "No derived 24 fact is persisted.");
  roundTrip.project.singleJerseyCamProgram.feeds.forEach(feed => {
    assert.equal(Object.hasOwn(feed.yarns[1], "yarnLengthCmPer100Needles"), false);
    assert.deepEqual([feed.yarns[1].relaxedLengthCmPer100Needles, feed.yarns[1].draftRatio], [8, 3]);
  });
  loadJSON(JSON.parse(serialized), roundTrip.registry);
  assert.deepEqual(getProjectData().singleJerseyCamProgram.feeds, fixture.singleJerseyCamProgram.feeds);
  assert.deepEqual(diagnostics(getProjectData()).rows, nominal.rows, "Reimported SOP results and metadata must match.");
  assert.equal(sha(await fs.readFile(sourceFile)), sourceHash, "Historical fixture is immutable.");
  if (outputDirectory) {
    await fs.writeFile(`${outputDirectory}/SOP-001-N6W6040-bare-spandex.knitscape`, new Uint8Array(await blob.arrayBuffer()));
    await fs.writeFile(`${outputDirectory}/SOP-001-project.manifest.json`, JSON.stringify(roundTrip.project, null, 2));
    await fs.writeFile(`${outputDirectory}/sop-results.json`, JSON.stringify({
      sourceFile, sourceSha256: sourceHash, historicalFile, directControl, nominal, perFeed, oldDiagnostic,
      numericDrift: 0, solverToleranceCmPer100Needles: 0.00079375,
      projectFormat: { version: 3, requiredCapabilities: roundTrip.project.requiredCapabilities },
      processMeasurementContract: "ESTABLISHED_FOR_SOP001", spandexPhysicalModel: "NOT_IMPLEMENTED",
      realMachineValidation: "PARTIAL",
    }, null, 2));
  }
  opened.registry.clear();
  console.log("PASS: SOP-001 8/8 main + 8/8 spandex CONVERGED; 8 × 3 = 24; per-Feed facts; v3 package/JSON reimport; zero M1/M3 drift; legacy direct 8 diagnostic unchanged.");
} finally {
  await server.close();
  delete globalThis.__processContractObservation;
}
