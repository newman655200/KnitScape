import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createPlainJerseyTopology } from "../src/fabricForm/fabricFormTopology.js";
import { createFabricFormParams } from "../src/fabricForm/fabricFormParams.js";
import { createFabricFormInitialGeometry } from "../src/fabricForm/fabricFormInitialGeometry.js";
import { evaluateLengthConstraints, evaluateRodBending } from "../src/fabricForm/rodBending.js";
import { solveFabricCell } from "../src/fabricForm/solveFabricCell.js";

const helperUrl = new URL("./lib/fabricFormRefinement.mjs", import.meta.url);
assert.ok(existsSync(helperUrl), "A14 needs smooth periodic refinement with a protected continuation path");
const { createRefinedFabricCell, describeRefinementGeometry } = await import(helperUrl);

if (process.argv.includes("--self-check")) {
  const params = createFabricFormParams();
  const source = createFabricFormInitialGeometry(createPlainJerseyTopology({ nodesPerLoop: 24 }), params);
  const before = JSON.stringify(source);
  const refined = createRefinedFabricCell(source, 32, params);
  assert.equal(refined.positions.length, 32);
  assert.equal(JSON.stringify(source), before);
  const constraint = evaluateLengthConstraints(refined);
  assert.ok(constraint.maxStrain < 1e-12);
  const total = refined.topology.edges.reduce((sum, edge) => sum + edge.restLength, 0);
  assert.ok(Math.abs(total - 3) < 1e-12);
  assert.ok(refined.refinement.continuationComplete && refined.refinement.finalFeasible);
  const energyRatio = evaluateRodBending(refined, params.B).energy / evaluateRodBending(source, params.B).energy;
  assert.ok(energyRatio > 0.8 && energyRatio < 1.2, "smooth refinement should preserve the seed's bending scale");
  assert.deepEqual(refined.topology.loops[0].passesThrough, source.topology.loops[0].passesThrough);
  assert.equal(typeof describeRefinementGeometry, "function", "refinement reports require curvature diagnostics");
  const shape = describeRefinementGeometry(refined);
  const doubled = { ...refined, W: 2 * refined.W, H: 2 * refined.H, S: 2 * refined.S,
    positions: refined.positions.map(point => point.map(value => 2 * value)) };
  assert.ok(shape.maxDiscreteCurvaturePerMm > 0);
  assert.ok(Math.abs(describeRefinementGeometry(doubled).maxDiscreteCurvaturePerMm * 2 / shape.maxDiscreteCurvaturePerMm - 1) < 1e-12);
  console.log(JSON.stringify({ status: "PASS", energyRatio, totalLength: total, ...refined.refinement }, null, 2));
} else {
  const archive = "C:/Users/liuchen/Documents/KnitScape/archives/fabric-form-step1-2026-11-22";
  let previous = JSON.parse(await fs.readFile(path.join(archive, "reference.json"), "utf8"));
  assert.equal(previous.status, "CONVERGED", "start refinement from a solved reference");
  const resumeNodes = process.argv.includes("--resume-64") ? 64 : process.argv.includes("--resume-32") ? 32 : null;
  const summary = resumeNodes === 64
    ? JSON.parse(await fs.readFile(path.join(archive, "refinement-summary.json"), "utf8"))
    : { method: "Protected smooth periodic numerical continuation; fixed target material length",
    integrationEvidence: "fixed-acceptance.json; refinement-32-quadrature.json when available",
    convergenceEstablished: false, referenceGeometry: describeRefinementGeometry(previous.cell), levels: [] };
  if (resumeNodes === 64) {
    previous = JSON.parse(await fs.readFile(path.join(archive, "refinement-32.json"), "utf8"));
    assert.equal(previous.status, "CONVERGED");
    summary.levels = summary.levels.filter(level => level.nodes < 64);
  }
  for (const nodes of [32, 64, 128].filter(nodes => nodes >= (resumeNodes ?? 32))) {
    let initialCell;
    let priorAttempt;
    if (nodes === resumeNodes) {
      const priorFile = path.join(archive, `refinement-${nodes}.json`);
      await fs.copyFile(priorFile, path.join(archive, `refinement-${nodes}-before-resume.json`), 1);
      priorAttempt = JSON.parse(await fs.readFile(priorFile, "utf8"));
      initialCell = priorAttempt.cell;
    } else initialCell = createRefinedFabricCell(previous.cell, nodes, previous.params);
    const result = solveFabricCell({ topology: initialCell.topology, params: previous.params,
      initialCell, quadratureOrder: previous.settings.quadratureOrder,
      innerIterations: resumeNodes === 64 ? 1200 : 800, memorySize: resumeNodes === 64 ? 180 : 60 });
    if (priorAttempt) {
      result.diagnostics.priorAttemptElapsedMs = priorAttempt.diagnostics.cumulativeElapsedMs ?? priorAttempt.diagnostics.elapsedMs;
      result.diagnostics.cumulativeElapsedMs = result.diagnostics.priorAttemptElapsedMs + result.diagnostics.elapsedMs;
    }
    const change = {
      waleRelative: result.metrics.waleDensityPerCm / previous.metrics.waleDensityPerCm - 1,
      courseRelative: result.metrics.courseDensityPerCm / previous.metrics.courseDensityPerCm - 1,
    };
    const withinTolerance = Math.abs(change.waleRelative) <= 0.005 && Math.abs(change.courseRelative) <= 0.005;
    result.refinement = { ...initialCell.refinement, previousNodes: previous.cell.topology.nodesPerLoop,
      geometry: describeRefinementGeometry(result.cell), change, withinTolerance };
    await fs.writeFile(path.join(archive, `refinement-${nodes}.json`), JSON.stringify(result, null, 2) + "\n");
    summary.levels.push({ nodes, status: result.status, optimizerStatus: result.optimizerStatus,
      W: result.cell.W, H: result.cell.H, energy: result.energy.total,
      nodeRatio: result.equilibrium.nodeRatio, latticeRatios: result.equilibrium.latticeRatios,
      strain: result.constraints.maxSegmentStrain, elapsedMs: result.diagnostics.elapsedMs,
      geometry: result.refinement.geometry, minGap: result.clearance.minGap,
      cumulativeElapsedMs: result.diagnostics.cumulativeElapsedMs ?? result.diagnostics.elapsedMs,
      ...change, withinTolerance, comparisonEligible: result.status === "CONVERGED" });
    summary.convergenceEstablished = nodes >= 64 && result.status === "CONVERGED" && withinTolerance;
    if (summary.convergenceEstablished) {
      summary.productionCandidateNodes = previous.cell.topology.nodesPerLoop;
      summary.finerReferenceNodes = nodes;
    }
    await fs.writeFile(path.join(archive, "refinement-summary.json"), JSON.stringify(summary, null, 2) + "\n");
    console.log(JSON.stringify(summary.levels.at(-1)));
    if (result.status !== "CONVERGED") break;
    previous = result;
    if (nodes >= 64 && withinTolerance) break;
  }
}
