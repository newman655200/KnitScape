import { solveFabricTextureGeometry } from "./fabricTexturePipeline.js";

// The host cancels a calculation by terminating this dedicated Worker.
self.addEventListener("message", ({ data }) => {
  const { requestId, solveInput, pxPerMm } = data;
  try {
    const output = solveFabricTextureGeometry(solveInput, { pxPerMm,
      onStage: stage => self.postMessage({ type: "stage", requestId, stage }) });
    self.postMessage({ type: "result", requestId, ...output });
  } catch (error) {
    self.postMessage({ type: "error", requestId,
      message: error.message, name: error.name });
  }
});
