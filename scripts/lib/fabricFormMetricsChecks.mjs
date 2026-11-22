import assert from "node:assert/strict";
import { createPlainJerseyTopology } from "../../src/fabricForm/fabricFormTopology.js";
import { createFabricFormParams } from "../../src/fabricForm/fabricFormParams.js";
import { replicatePeriodicCell } from "../../src/fabricForm/periodicCell.js";

export async function runMetricsChecks() {
  const {fabricFormMetrics}=await import("../../src/fabricForm/fabricFormMetrics.js");
  const topology=createPlainJerseyTopology({nodesPerLoop:4,loopLengthMm:2});
  const cell={positions:[[0,0,0],[.5,0,0],[1,0,0],[1.5,0,0]],W:2,H:.5,S:.1,topology};
  const params=createFabricFormParams({tex:10});
  for(const [a,b] of [[1,1],[2,2],[4,8]]) {
    const value=fabricFormMetrics(replicatePeriodicCell(cell,a,b),params);
    assert.equal(value.gsm,20);assert.equal(value.gsmFromDensities,20);
    assert.equal(value.waleDensityPerCm,5);assert.equal(value.courseDensityPerCm,20);
    assert.equal(value.relativeLengthError,0);
    assert.equal(value.provenance.parameters.tex.confidence,"ASSUMPTION");
  }
  return {massUnitsAndReplication:"PASS",sourceDependency:"PASS"};
}
