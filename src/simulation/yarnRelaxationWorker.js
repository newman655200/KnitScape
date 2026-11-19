import { buildYarnRelaxationExperiment, RELAXATION_TARGETS } from "./yarnRelaxationExperiment.js";
import { createSimulationSnapshot } from "./simulationSnapshot.js";

export function processYarnRelaxationRequest(request) {
  const { requestId, projectGeneration, feedYarnStructureRevision, targetLengthMm, includeReferences } = request;
  const context = { projectGeneration, feedYarnStructureRevision };
  const initial = includeReferences ? buildYarnRelaxationExperiment({ initial: true }, context) : null;
  const referenceCases = includeReferences ? RELAXATION_TARGETS.map(target =>
    buildYarnRelaxationExperiment({ targetLengthMm: target }, context)) : null;
  const result = referenceCases?.find(item => item.targetLengthMm === targetLengthMm) ??
    buildYarnRelaxationExperiment({ targetLengthMm }, context);
  return createSimulationSnapshot({ requestId, ...context, targetLengthMm, initial, referenceCases, result });
}

// This entry is imported as a module worker only after explicit UI activation.
if (typeof self !== "undefined" && typeof self.postMessage === "function" && typeof document === "undefined") {
  self.onmessage = ({ data }) => {
    try { self.postMessage(processYarnRelaxationRequest(data)); }
    catch (error) { self.postMessage({ requestId: data.requestId, projectGeneration: data.projectGeneration,
      feedYarnStructureRevision: data.feedYarnStructureRevision, targetLengthMm: data.targetLengthMm,
      error: String(error.message || error) }); }
  };
}
