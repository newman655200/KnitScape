import fs from "node:fs/promises";
import path from "node:path";
import { bakeFabricGeometry, bakeFabricTexture, bakeYarnStrip } from "../../src/fabricTexture/fabricTexturePipeline.js";
import { encodePng } from "../../src/fabricTexture/png.js";
import { createReviewImage } from "../../src/fabricTexture/review.js";
import { loadTextureMaterial, addYarnPreviewMetadata } from "./fabric-texture-material-input.mjs";
import { assertNormalPng } from "./fabric-texture-normal-checks.mjs";
import { textureGeneratorVersion, portableTextureRecord } from "./fabric-texture-provenance.mjs";

// T6a-3 part 0 adds four comparison images; earlier review images stay intact.
const archive = process.argv[2];
if (!archive) throw new Error("Supply the T6a-3 part 0 external archive directory.");
const out = path.resolve("docs/archive/t6a-fabric-texture-2026-11-28");
const summaryFile = path.join(out, "summary.json");
const summary = JSON.parse(await fs.readFile(summaryFile, "utf8"));
const validationLog = await fs.readFile(path.join(archive, "validate.stdout.log"), "utf8");
const checkLine = validationLog.split(/\r?\n/).find(line => line.startsWith("T6A3_PART0_CHECKS_JSON "));
if (!checkLine) throw new Error("Completed (t)/(u) validation results are required before generating review images.");
const generatorVersion = textureGeneratorVersion();
const common = { pxPerMm: 200, generatorVersion, repositoryRoot: path.resolve(".") };
const step = summary.t6a3Part0 = { step: "T6a-3 part 0", generatorVersion, pxPerMm: 200,
  aoMethod: "horizonRelativeToTangent", validation: JSON.parse(checkLine.slice("T6A3_PART0_CHECKS_JSON ".length)),
  cases: [], yarnStrips: [], comparisonFiles: [] };
const scanMaterial = await loadTextureMaterial({ files: {
  baseColor: "public/materials/white-gray-yarn/yarn_basecolor_alpha.png",
  roughness: "public/materials/white-gray-yarn/yarn_roughness.png",
} });
scanMaterial.name = "white-gray-yarn";
const results = {}, geometries = {};
for (const [name, file] of [["hossain-2.84", "step3-hossain-2.84-after"],
  ["case-3-N48", "step4-case-3-N48"], ["case-4-N48", "step4-case-4-N48"]]) {
  const source = `docs/archive/t1-slope-closeout-2026-11-23/${file}.json`;
  const result = JSON.parse(await fs.readFile(source, "utf8"));
  results[name] = { result, source };
  geometries[name] = bakeFabricGeometry(result, common);
}
function normalChecks(value) {
  return Object.fromEntries(Object.entries(value.files).filter(([name]) => name.endsWith("_normal.png"))
    .map(([name, bytes]) => [name, assertNormalPng(bytes, `T6a-3 part 0 review ${name}`)]));
}
async function writeReview(name, map) {
  await fs.writeFile(path.join(out, name), await encodePng(map));
  step.comparisonFiles.push(name);
}
for (const name of Object.keys(results)) {
  const { result, source } = results[name], prefix = `${name}_scan-both-medium`;
  const value = await bakeFabricTexture({ ...common, result, geometry: geometries[name], material: scanMaterial,
    fuzzSource: "both", fuzzOptions: { fuzzStrength: 0.5 }, prefix, sourceResultFile: source });
  const record = { name, material: "white-gray-yarn", fuzzSource: "both", fuzzStrength: 0.5,
    faces: value.metadata.faces, normalChecks: normalChecks(value), timings: value.timings };
  step.cases.push(record);
  if (name === "case-3-N48") await writeReview(`${prefix}_technicalFace_review4x4_t6a3.png`,
    createReviewImage(value.composed.technicalFace.unitMaps));
  console.log(JSON.stringify(record));
}
{
  const { result, source } = results["hossain-2.84"], prefix = "hossain-2.84_solid";
  const value = await bakeFabricTexture({ ...common, result, geometry: geometries["hossain-2.84"],
    material: {}, fuzzSource: "off", prefix, sourceResultFile: source });
  step.cases.push({ name: "hossain-2.84", material: "solid", fuzzSource: "off", faces: value.metadata.faces,
    normalChecks: normalChecks(value), timings: value.timings });
  await writeReview(`${prefix}_technicalFace_review4x4_t6a3.png`, createReviewImage(value.composed.technicalFace.unitMaps));
}
function stripReview(maps) {
  const source = createReviewImage(maps, [2, 1]);
  if (source.width <= 1600) return source;
  const width = 1600, height = Math.max(1, Math.round(source.height * width / source.width));
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (Math.floor(y * source.height / height) * source.width + Math.floor(x * source.width / width)) * 3;
    data.set(source.data.subarray(offset, offset + 3), (y * width + x) * 3);
  }
  return { width, height, channels: 3, bitDepth: 8, data };
}
for (const [material, fuzzSource, strength, suffix] of [[scanMaterial, "both", 0.5, "scan-both-medium"],
  [{}, "generated", 1, "solid-generated-high"]]) {
  const prefix = `strip_${suffix}`;
  const value = await bakeYarnStrip({ ...common, params: results["hossain-2.84"].result.params, material,
    fuzzSource, fuzzOptions: { fuzzStrength: strength }, prefix });
  await addYarnPreviewMetadata(value.metadata, value.maps.baseColor);
  const record = { prefix, fuzzSource, fuzzStrength: strength, diagnostics: value.metadata.diagnostics,
    fuzz: value.fuzz.diagnostics, preview: value.metadata.preview, normalChecks: normalChecks(value), timings: value.timings };
  step.yarnStrips.push(record);
  await writeReview(`${prefix}_yarn_review_t6a3.png`, stripReview(value.composed.unitMaps));
  console.log(JSON.stringify(record));
}
await fs.writeFile(summaryFile, JSON.stringify(portableTextureRecord(summary), null, 2) + "\n");
const sizes = await Promise.all((await fs.readdir(out)).map(async name => ({ name, bytes: (await fs.stat(path.join(out, name))).size })));
const bytes = sizes.reduce((sum, file) => sum + file.bytes, 0);
if (sizes.some(file => file.bytes > 1500000) || bytes > 15000000) throw new Error(`Review archive exceeds task limits: ${JSON.stringify(sizes)}`);
console.log(JSON.stringify({ reviewDirectory: "docs/archive/t6a-fabric-texture-2026-11-28", files: sizes.length, bytes,
  comparisonFiles: step.comparisonFiles }));
