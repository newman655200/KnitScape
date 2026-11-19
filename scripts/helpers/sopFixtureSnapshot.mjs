import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createServer as httpServer } from "node:http";
import { createServer } from "vite";

export const SOP_FIXTURE_SHA256 = "5ff940f1c643618609974a4f8b1d97323b9dce39edee812e3bb312f74fb40b4d";
export const SOP_FIXTURE_PATH = path.join(os.homedir(), "Documents/KnitScape/archives/knitscape-sop-retest-2026-10-29/browser-continuation/SOP-restored-23-8x3-retest.knitscape");

// Compute current production Machine scope exactly once from the actual package.
// All Vite cache artifacts stay outside the checkout; no browser/state/renderer is used.
export async function withSopFixtureSnapshot(callback, options = {}) {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const fixturePath = options.fixturePath || process.env.KNITSCAPE_SOP_FIXTURE || SOP_FIXTURE_PATH;
  const archiveDir = options.archiveDir || process.env.KNITSCAPE_TEST_OUTPUT_DIR ||
    path.join(os.homedir(), "Documents/KnitScape/archives/knitscape-round6-20261103/sop-topology-adapter");
  const relative = path.relative(root, archiveDir);
  if (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
    throw new Error("Test artifacts must be outside the checkout.");
  }
  await fs.mkdir(archiveDir, { recursive: true });
  const bytes = await fs.readFile(fixturePath);
  const fixtureSha256 = createHash("sha256").update(bytes).digest("hex");
  if (fixtureSha256 !== SOP_FIXTURE_SHA256) throw new Error(`Unexpected SOP fixture SHA-256: ${fixtureSha256}`);
  const server = await createServer({ root, configFile: false, appType: "custom", logLevel: "silent",
    cacheDir: path.join(archiveDir, "vite-cache"),
    server: { middlewareMode: true, hmr: { server: httpServer() } } });
  try {
    const [{ readProjectPackage }, { createSingleJerseyExecutionInput }, { computeYarnSimulation }] =
      await Promise.all(["/src/actions/projectPackage.js", "/src/components/singleJerseyExecutionInput.js",
        "/src/simulation/computeYarnSimulation.js"].map(file => server.ssrLoadModule(file)));
    const opened = await readProjectPackage(new Blob([bytes]));
    const project = opened.project;
    const machineInput = createSingleJerseyExecutionInput(project.singleJerseyCamProgram,
      project.needleArrangement, project.width, project.height);
    const snapshot = computeYarnSimulation({ pattern: machineInput, yarnSequence: project.yarnSequence,
      palette: project.yarnPalette, yarnPlies: project.yarnPlies, machineGauge: project.machineGauge,
      feeds: project.singleJerseyCamProgram.feeds, yarnLibrary: project.yarnLibrary,
      canvasWidth: 640, canvasHeight: 480, scope: "machine", inputSignature: `fixture:${fixtureSha256}`,
      projectGeneration: 6, feedYarnStructureRevision: 1 });
    return await callback({ snapshot, project, fixturePath, fixtureSha256, archiveDir, server });
  } finally {
    await server.close();
  }
}
