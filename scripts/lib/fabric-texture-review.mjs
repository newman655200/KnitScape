import fs from "node:fs/promises";
import path from "node:path";
import { textureGeneratorVersion, portableTextureRecord } from "./fabric-texture-provenance.mjs";
import { ZipReader, Uint8ArrayReader, Uint8ArrayWriter, TextWriter } from "@zip.js/zip.js";
import { bakeFabricTexture, bakeFabricGeometry, bakeYarnStrip } from "../../src/fabricTexture/fabricTexturePipeline.js";
import { encodePng } from "../../src/fabricTexture/png.js";
import { createReviewImage } from "../../src/fabricTexture/review.js";
import { loadTextureMaterial, addYarnPreviewMetadata } from "./fabric-texture-material-input.mjs";
import { assertNormalPng } from "./fabric-texture-normal-checks.mjs";

// T6a-2 review additions; preserve T6a-1 images for side-by-side comparison.
const archive = process.argv[2];
if (!archive) throw new Error("Supply the T6a-2 external archive directory.");
const out = path.resolve("docs/archive/t6a-fabric-texture-2026-11-28");
await fs.mkdir(out, { recursive: true });
const sourceDir = path.join(archive, "source-maps");
await fs.mkdir(sourceDir, { recursive: true });
const zip = new ZipReader(new Uint8ArrayReader(await fs.readFile("public/current-SOP.knitscape")));
const entries = await zip.getEntries();
const project = JSON.parse(await entries.find(e => e.filename === "project.json").getData(new TextWriter()));
const yarns = {};
try {
  for (const [key, token] of [["yarn-a", "Yarn_A_"], ["yarn-b", "Yarn_B_"]]) {
    const asset = project.yarnLibrary.find(yarn => yarn.pbr?.baseColor?.fileName?.startsWith(token));
    if (!asset) throw new Error(`Missing ${token} in SOP project`);
    const files = {};
    for (const map of ["baseColor", "normal", "roughness", "ambientOcclusion", "metallic"]) {
      if (!asset.pbr[map]) continue;
      const record = asset.pbr[map], entry = entries.find(e => e.filename === record.assetRef);
      if (!entry) throw new Error(`Missing SOP asset ${record.assetRef}`);
      files[map] = path.join(sourceDir, record.fileName);
      await fs.writeFile(files[map], await entry.getData(new Uint8ArrayWriter()));
    }
    yarns[key] = await loadTextureMaterial({ files });
    yarns[key].name = token === "Yarn_A_" ? "Yarn_A_Cotton_Blue" : "Yarn_B_Polyester_Orange";
  }
} finally { await zip.close(); }
yarns.scan = await loadTextureMaterial({ files: {
  baseColor: path.resolve("public/materials/white-gray-yarn/yarn_basecolor_alpha.png"),
  roughness: path.resolve("public/materials/white-gray-yarn/yarn_roughness.png"),
} });
yarns.scan.name = "white-gray-yarn";
const generatorVersion = textureGeneratorVersion();
const common = { pxPerMm: 200, generatorVersion, repositoryRoot: path.resolve(".") };
const summaryFile = path.join(out, "summary.json");
const summary = portableTextureRecord(JSON.parse(await fs.readFile(summaryFile, "utf8")));
// Historical T6a-1 images were generated from an uncommitted working tree too.
if (!summary.generatorVersion.endsWith("-dirty")) summary.generatorVersion += "-dirty";
const previousMetadataFile = path.join(out, "hossain-2.84_yarn-a_metadata.json");
const previousMetadata = portableTextureRecord(JSON.parse(await fs.readFile(previousMetadataFile, "utf8")));
if (!previousMetadata.generator.version.endsWith("-dirty")) previousMetadata.generator.version += "-dirty";
await fs.writeFile(previousMetadataFile, JSON.stringify(previousMetadata, null, 2) + "\n");
const step = summary.t6a2 = { step: "T6a-2", generatorVersion, pxPerMm: 200, cases: [], yarnStrips: [] };
const results = {}, geometries = {};
for (const [name, file] of [["hossain-2.84", "step3-hossain-2.84-after"],
  ["case-3-N48", "step4-case-3-N48"], ["case-4-N48", "step4-case-4-N48"]]) {
  const source = `docs/archive/t1-slope-closeout-2026-11-23/${file}.json`;
  results[name] = { result: JSON.parse(await fs.readFile(source, "utf8")), source };
  geometries[name] = bakeFabricGeometry(results[name].result, common);
}
async function reviewFabric(name, yarn, suffix, fuzzSource, strength, faces, fullFace = false) {
  const { result, source } = results[name], prefix = `${name}_${suffix}`;
  const value = await bakeFabricTexture({ ...common, result, geometry: geometries[name],
    material: yarns[yarn] ?? {}, fuzzOptions: { fuzzStrength: strength }, prefix, fuzzSource, sourceResultFile: source });
  const normalChecks = Object.fromEntries(Object.entries(value.files).filter(([file]) => file.endsWith("_normal.png"))
    .map(([file, bytes]) => [file, assertNormalPng(bytes, `review ${file}`)]));
  for (const face of faces) await fs.writeFile(path.join(out, `${prefix}_${face}_review4x4.png`),
    await encodePng(createReviewImage(value.composed[face].unitMaps)));
  if (fullFace) {
    for (const [file, bytes] of Object.entries(value.files)) if (file.includes("_technicalFace_")) await fs.writeFile(path.join(out, file), bytes);
    await fs.writeFile(path.join(out, `${prefix}_metadata.json`), JSON.stringify(value.metadata, null, 2) + "\n");
  }
  const record = { name, yarn, prefix, fuzzSource, fuzzStrength: strength, status: result.status, W: result.cell.W, H: result.cell.H,
    waleDensityPerCm: result.metrics.waleDensityPerCm, courseDensityPerCm: result.metrics.courseDensityPerCm,
    faces: value.metadata.faces, centerline: value.geometry.centerline.diagnostics,
    yarnDiagnostics: value.material.diagnostics, fuzzParameters: value.fuzzParameters, normalChecks, timings: value.timings };
  step.cases.push(record);
  console.log(JSON.stringify(record));
}
const front = ["technicalFace"], both = ["technicalFace", "technicalBack"];
await reviewFabric("hossain-2.84", "scan", "scan-fuzz", "scan", 0.5, front);
await reviewFabric("case-4-N48", "scan", "scan-fuzz", "scan", 0.5, front);
for (const [level, strength] of [["low", 0.25], ["medium", 0.5], ["high", 1]]) {
  await reviewFabric("case-3-N48", "scan", `scan-both-${level}`, "both", strength, front);
}
await reviewFabric("case-3-N48", "yarn-a", "yarn-a-generated-medium", "generated", 0.5, both);
await reviewFabric("hossain-2.84", "scan", "scan-both-medium", "both", 0.5, front, true);
for (const yarn of ["yarn-a", "yarn-b"]) await reviewFabric("hossain-2.84", yarn, `${yarn}-prefiltered`, "off", 0.5, both);

function reviewAtMost1600(maps) {
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
for (const [yarn, source, strength, suffix, full] of [["scan", "both", 0.5, "scan-both-medium", true],
  ["yarn-a", "generated", 0.5, "yarn-a-generated-medium", false], ["solid", "generated", 1, "solid-generated-high", false]]) {
  const prefix = `strip_${suffix}`;
  const value = await bakeYarnStrip({ ...common, params: results["hossain-2.84"].result.params,
    material: yarns[yarn] ?? {}, fuzzOptions: { fuzzStrength: strength }, fuzzSource: source, prefix });
  await addYarnPreviewMetadata(value.metadata, value.maps.baseColor);
  const normalChecks = Object.fromEntries(Object.entries(value.files).filter(([file]) => file.endsWith("_normal.png"))
    .map(([file, bytes]) => [file, assertNormalPng(bytes, `review ${file}`)]));
  if (full) for (const [file, bytes] of Object.entries(value.files)) await fs.writeFile(path.join(out, file), bytes);
  await fs.writeFile(path.join(out, `${prefix}_yarn_metadata.json`), JSON.stringify(value.metadata, null, 2) + "\n");
  await fs.writeFile(path.join(out, `${prefix}_yarn_review.png`), await encodePng(reviewAtMost1600(value.composed.unitMaps)));
  const record = { yarn, prefix, fuzzSource: source, fuzzStrength: strength, yarnDiagnostics: value.material.diagnostics,
    fuzzParameters: value.fuzzParameters, diagnostics: value.metadata.diagnostics, preview: value.metadata.preview,
    texture: value.metadata.texture, normalChecks, timings: value.timings };
  step.yarnStrips.push(record);
  console.log(JSON.stringify(record));
}
await fs.writeFile(summaryFile, JSON.stringify(portableTextureRecord(summary), null, 2) + "\n");
const sizes = await Promise.all((await fs.readdir(out)).map(async name => ({ name, bytes: (await fs.stat(path.join(out, name))).size })));
const bytes = sizes.reduce((sum, file) => sum + file.bytes, 0);
if (sizes.some(file => file.bytes > 1500000) || bytes > 15000000) throw new Error(`Review archive exceeds task limits: ${JSON.stringify(sizes)}`);
console.log(JSON.stringify({ reviewDirectory: "docs/archive/t6a-fabric-texture-2026-11-28", files: sizes.length, bytes }));
