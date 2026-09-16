import { createSingleJerseySimulationInput } from "../adapters/singleJerseySimulationInput.js";
import { resolveSingleJerseyOperations } from "../domain/singleJerseyMachine.js";

export function createSingleJerseyExecutionInput(
  camProgram,
  needleArrangement,
  outputWidth,
  outputFeeds
) {
  if (camProgram === null || needleArrangement.length === 0) return null;

  const machineOperations = resolveSingleJerseyOperations(
    camProgram,
    needleArrangement,
    outputWidth,
    outputFeeds
  );
  return createSingleJerseySimulationInput(machineOperations);
}
