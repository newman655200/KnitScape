import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { bakeFabricTexture, bakeYarnStrip } from "../../src/fabricTexture/fabricTexturePipeline.js";
import { runFabricComposeJob, runYarnStripJob } from "../../src/fabricTexture/fabricTextureJobs.js";
import { loadTextureMaterial } from "./fabric-texture-material-input.mjs";
import { assertNormalMap, assertNormalPng } from "./fabric-texture-normal-checks.mjs";

function compareOutputs(job, direct, label) {
  const names = Object.keys(direct.files).sort();
  assert.ok(names.length > 0, `(v) ${label}: contains PNG files`);
  assert.deepEqual(Object.keys(job.files).sort(), names, `(v) ${label}: identical complete PNG file list`);
  let pngBytes = 0;
  for (const name of names) {
    assert.match(name, /\.png$/, `(v) ${label}: export is a PNG`);
    assert.deepEqual(job.files[name], direct.files[name], `(v) ${label}: ${name} byte for byte`);
    pngBytes += direct.files[name].byteLength;
  }
  const jobMetadata = Buffer.from(JSON.stringify(job.metadata, null, 2), "utf8");
  const directMetadata = Buffer.from(JSON.stringify(direct.metadata, null, 2), "utf8");
  assert.deepEqual(jobMetadata, directMetadata, `(v) ${label}: complete metadata JSON UTF-8 bytes`);
  return { pngCount: names.length, pngBytes, metadataBytes: directMetadata.byteLength,
    pngByteIdentical: true, metadataByteIdentical: true, files: names };
}

/** Inspect every normal map retained by the compact job or direct pipeline,
 * including the tiled/export variants and all encoded normal PNG pixels.
 */
function checkNormals(output, kind, label) {
  const maps = {};
  const checkComposed = (composed, key) => {
    maps[`${key}.unit`] = assertNormalMap(composed.unitMaps.normal, `(g) (v) ${label} ${key} unit`);
    if (composed.maps) maps[`${key}.tiled`] = assertNormalMap(composed.maps.normal, `(g) (v) ${label} ${key} tiled`);
  };
  if (kind === "fabric") {
    for (const face of ["technicalFace", "technicalBack"]) checkComposed(output.composed[face], face);
  } else {
    checkComposed(output.composed, "yarn");
    if (output.maps.normal) maps.exported = assertNormalMap(output.maps.normal, `(g) (v) ${label} export`);
  }
  const pngs = Object.fromEntries(Object.entries(output.files).filter(([name]) => /_normal\.png$/.test(name))
    .map(([name, bytes]) => [name, assertNormalPng(bytes, `(g) (v) ${label} ${name}`)]));
  assert.equal(Object.keys(pngs).length, kind === "fabric" ? 2 : 1, `(g) (v) ${label}: all exported normal PNGs`);
  return { maps, pngs };
}

/** T6a-3b (v): use the existing Hossain equilibrium and already baked geometry;
 * never invoke a solver. Both paths receive exactly the same flat options.
 */
export async function validateFabricTextureJobs({ hossain }) {
  assert.ok(hossain?.result && hossain.pipelineGeometry, "(v) existing Hossain result and geometry are required");
  const material = await loadTextureMaterial({ files: {
    baseColor: fileURLToPath(new URL("../../public/materials/white-gray-yarn/yarn_basecolor_alpha.png", import.meta.url)),
    roughness: fileURLToPath(new URL("../../public/materials/white-gray-yarn/yarn_roughness.png", import.meta.url)),
  } });
  const common = { material, pxPerMm: 200, fuzzSource: "both", fuzzOptions: { fuzzStrength: 0.5 },
    prefix: "job-check", generatorVersion: "validation", generatedAt: "2026-11-28T00:00:00.000Z" };
  const fabricOptions = { ...common, result: hossain.result, geometry: hossain.pipelineGeometry };
  const fabricJob = await runFabricComposeJob(fabricOptions);
  const fabricDirect = await bakeFabricTexture(fabricOptions);
  const fabric = { ...compareOutputs(fabricJob, fabricDirect, "fabric"), normalChecks: {
    job: checkNormals(fabricJob, "fabric", "fabric job"),
    direct: checkNormals(fabricDirect, "fabric", "fabric direct"),
  } };
  const yarnOptions = { ...common, params: hossain.result.params, stripLengthMm: 4 };
  const yarnJob = await runYarnStripJob(yarnOptions);
  const yarnDirect = await bakeYarnStrip(yarnOptions);
  const yarn = { ...compareOutputs(yarnJob, yarnDirect, "yarn"), normalChecks: {
    job: checkNormals(yarnJob, "yarn", "yarn job"),
    direct: checkNormals(yarnDirect, "yarn", "yarn direct"),
  } };
  const result = { case: "hossain-2.84", material: "white-gray-yarn", pxPerMm: 200,
    fuzzSource: "both", fuzzStrength: 0.5, stripLengthMm: 4, generatedAt: common.generatedAt,
    pngCount: fabric.pngCount + yarn.pngCount, metadataCount: 2,
    pngByteIdentical: true, metadataByteIdentical: true, fabric, yarn };
  console.log(JSON.stringify({ item: "v", status: "PASS", ...result }));
  return result;
}
