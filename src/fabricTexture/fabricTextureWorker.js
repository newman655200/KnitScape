import { solveFabricTextureGeometry } from "./fabricTexturePipeline.js";
import { runFabricComposeJob, runYarnStripJob } from "./fabricTextureJobs.js";

function transferBuffers(payload) {
  const buffers = new Set(), visited = new Set();
  function collect(value) {
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if (ArrayBuffer.isView(value)) {
      if (value.buffer instanceof ArrayBuffer) buffers.add(value.buffer);
    } else if (value instanceof ArrayBuffer) buffers.add(value);
    else for (const child of Object.values(value)) collect(child);
  }
  collect(payload);
  return [...buffers];
}

// The host cancels a calculation by terminating this dedicated Worker.
self.addEventListener("message", async ({ data }) => {
  const { type, requestId, solveInput, pxPerMm } = data;
  const onStage = stage => self.postMessage({ type: "stage", requestId, stage });
  try {
    let output;
    if (type === "geometry") output = solveFabricTextureGeometry(solveInput, { pxPerMm, onStage });
    else if (type === "fabric") { onStage("fabric"); output = await runFabricComposeJob(data); }
    else if (type === "yarn") { onStage("yarn"); output = await runYarnStripJob(data); }
    else throw new RangeError(`Unknown fabric texture job type: ${type}`);
    const payload = { type: "result", requestId, jobType: type, ...output };
    self.postMessage(payload, transferBuffers(payload));
  } catch (error) {
    self.postMessage({ type: "error", requestId,
      message: error.message, name: error.name });
  }
});
