import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { ZipReader, Uint8ArrayReader } from "@zip.js/zip.js";
import { createFabricFormParams } from "../../src/fabricForm/fabricFormParams.js";
import { solveFabricTextureGeometry, bakeFabricTexture, bakeYarnStrip } from "../../src/fabricTexture/fabricTexturePipeline.js";
import { createFabricTextureZip } from "../../src/fabricTexture/textureExport.js";
import { addYarnPreviewMetadata } from "./fabric-texture-material-input.mjs";
import { assertNormalPng } from "./fabric-texture-normal-checks.mjs";
import { textureGeneratorVersion } from "./fabric-texture-provenance.mjs";

// One complete T6a-3 default-input trial. Do not add a second solve or a benchmark.
async function main() {
  if (process.argv.length !== 3) throw new Error("Supply the external T6a-3 archive directory.");
  const archive = path.resolve(process.argv[2]), repositoryRoot = path.resolve(".");
  const relative = path.relative(repositoryRoot, archive);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) {
    throw new Error("The trial archive must be outside the repository.");
  }
  await fs.mkdir(archive, { recursive: true });
  const started = performance.now(), generatedAt = new Date().toISOString();
  const defaults = createFabricFormParams();
  const keys = ["tex", "densityGPerCm3", "fiberDiameterMm", "E_f", "K", "phi0"];
  const params = { ...Object.fromEntries(keys.map(key => [key, defaults[key]])),
    provenance: Object.fromEntries(keys.map(key => [key, defaults.provenance[key]])) };
  const solveInput = { loopLengthMm: 2.84, nodesPerLoop: 48, params };
  const common = { material: {}, pxPerMm: 200, prefix: "fabric", fuzzSource: "generated",
    fuzzOptions: { fuzzStrength: 0.5 }, generatorVersion: textureGeneratorVersion(), generatedAt, repositoryRoot };
  const stages = [];
  const solved = solveFabricTextureGeometry(solveInput, { pxPerMm: common.pxPerMm,
    onStage: stage => { stages.push(stage); console.log(`WORKBENCH_TRIAL_STAGE ${stage}`); } });
  const { result, geometry } = solved;
  await fs.writeFile(path.join(archive, "result.json"), JSON.stringify(result, null, 2) + "\n");
  if (result.status !== "CONVERGED") console.warn(`WARNING: solver status=${result.status}; exports remain explicitly non-converged.`);
  console.log("WORKBENCH_TRIAL_STAGE fabric");
  const fabric = await bakeFabricTexture({ ...common, result, geometry, repeat: [1, 1], sourceResultFile: "result.json" });
  console.log("WORKBENCH_TRIAL_STAGE yarn");
  const yarn = await bakeYarnStrip({ ...common, params: result.params, stripLengthMm: 4 });
  const previewStarted = performance.now();
  await addYarnPreviewMetadata(yarn.metadata, yarn.maps.baseColor);
  const yarnPreviewMetadataMs = performance.now() - previewStarted;
  const normalStarted = performance.now(), normalChecks = {};
  for (const value of [fabric, yarn]) for (const [name, bytes] of Object.entries(value.files)) {
    if (name.endsWith("_normal.png")) normalChecks[name] = assertNormalPng(bytes, `T6a-3 trial ${name}`);
  }
  const normalChecksMs = performance.now() - normalStarted;
  console.log("WORKBENCH_TRIAL_STAGE zip");
  const archives = [], zipTimings = {};
  for (const [name, value, metadataFilename] of [
    ["fabric-textures.zip", fabric, "fabric_metadata.json"],
    ["yarn-textures.zip", yarn, "fabric_yarn_metadata.json"],
  ]) {
    const zipStarted = performance.now();
    const bytes = await createFabricTextureZip(value.files, value.metadata, metadataFilename);
    zipTimings[name] = performance.now() - zipStarted;
    await fs.writeFile(path.join(archive, name), bytes);
    const reader = new ZipReader(new Uint8ArrayReader(bytes), { useWebWorkers: false });
    try {
      const entries = await reader.getEntries(), filenames = entries.map(entry => entry.filename);
      assert.deepEqual(filenames, [...Object.keys(value.files), metadataFilename], `${name}: exported file list`);
      archives.push({ filename: name, bytes: bytes.length, files: filenames });
    } finally { await reader.close(); }
  }
  const summary = {
    step: "T6a-3 workbench default-input trial", generatedAt, generatorVersion: common.generatorVersion,
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    input: { ...solveInput, pxPerMm: common.pxPerMm, material: {}, fuzzSource: common.fuzzSource,
      fuzzOptions: common.fuzzOptions, repeat: [1, 1], stripLengthMm: 4 },
    pipeline: "solveFabricTextureGeometry (shared with Worker), bakeFabricTexture, bakeYarnStrip, createFabricTextureZip",
    stages, solver: { status: result.status, optimizerStatus: result.optimizerStatus, iterations: result.iterations,
      W: result.cell.W, H: result.cell.H, S: result.cell.S, metrics: result.metrics },
    timings: { solveAndGeometry: solved.timings,
      fabric: Object.fromEntries(Object.entries(fabric.timings).filter(([key]) => !Object.hasOwn(geometry.timings, key))),
      yarn: yarn.timings, yarnPreviewMetadataMs, normalChecksMs, zip: zipTimings, totalMs: performance.now() - started },
    timingNote: "One actual Node run; stage timings are not a browser performance benchmark. Cached geometry timings appear only under solveAndGeometry.",
    normalChecks, archives, limitations: fabric.metadata.limitations,
  };
  await fs.writeFile(path.join(archive, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log(`WORKBENCH_TRIAL_JSON ${JSON.stringify(summary)}`);
}

main().catch(error => { console.error(error.stack); process.exitCode = 1; });
