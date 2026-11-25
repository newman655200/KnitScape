import { runFabricFormTopologyChecks } from "./lib/fabricFormTopologyChecks.mjs";
import { runRodChecks } from "./lib/fabricFormRodChecks.mjs";
import { runContactChecks } from "./lib/fabricFormContactChecks.mjs";
import { runPeriodicContactChecks } from "./lib/fabricFormPeriodicContactChecks.mjs";
import { runFabricFormInitialChecks } from "./lib/fabricFormInitialChecks.mjs";
import { runOptimizerChecks } from "./lib/fabricFormOptimizerChecks.mjs";
import { runMetricsChecks } from "./lib/fabricFormMetricsChecks.mjs";
import { runDofLayoutChecks } from "./lib/fabricFormDofLayoutChecks.mjs";
import { runFabricFormModelChecks } from "./lib/fabricFormModelChecks.mjs";

const start = performance.now();
for (const [name, check] of Object.entries({ dofLayout: runDofLayoutChecks, model: runFabricFormModelChecks, topology: runFabricFormTopologyChecks,
  bending: runRodChecks, contact: runContactChecks, periodic: runPeriodicContactChecks,
  initialization: runFabricFormInitialChecks, optimizer: runOptimizerChecks, metrics: runMetricsChecks })) {
  await check();
  console.log(`PASS fabric form ${name}`);
}
console.log(`Fabric form math completed in ${((performance.now()-start)/1000).toFixed(2)} s; full equilibrium/branches are a separate run.`);
