import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ZipReader, Uint8ArrayReader, Uint8ArrayWriter, TextWriter } from "@zip.js/zip.js";
import { bakeFabricTexture, bakeFabricGeometry } from "../../src/fabricTexture/fabricTexturePipeline.js";
import { encodePng } from "../../src/fabricTexture/png.js";
import { createReviewImage } from "../../src/fabricTexture/review.js";
import { loadTextureMaterial } from "./fabric-texture-material-input.mjs";
import { assertNormalPng } from "./fabric-texture-normal-checks.mjs";

// Standard T6a-1 review set; extracted source maps remain outside the repository.
const archive = process.argv[2];
if (!archive) throw new Error("Supply the T6a-1 external archive directory.");
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
const generatorVersion = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const summary = { step: "T6a-1", generatorVersion, pxPerMm: 200, fuzzSource: "off", cases: [] };
for (const [name, file] of [["hossain-2.84", "step3-hossain-2.84-after"],
  ["case-3-N48", "step4-case-3-N48"], ["case-4-N48", "step4-case-4-N48"]]) {
  const resultPath = path.resolve(`docs/archive/t1-slope-closeout-2026-11-23/${file}.json`);
  const result = JSON.parse(await fs.readFile(resultPath, "utf8"));
  const geometry = bakeFabricGeometry(result, { pxPerMm: 200 });
  for (const [yarnName, material] of name === "hossain-2.84" ? [["solid", {}], ...Object.entries(yarns)] : [["solid", {}]]) {
    const prefix = `${name}_${yarnName}`;
    const value = await bakeFabricTexture({ result, geometry, material, prefix, pxPerMm: 200, sourceResultFile: resultPath, generatorVersion });
    const normalChecks = Object.fromEntries(Object.entries(value.files)
      .filter(([filename]) => filename.endsWith("_normal.png"))
      .map(([filename, bytes]) => [filename, assertNormalPng(bytes, `review ${filename}`)]));
    for (const [face, composed] of Object.entries(value.composed)) {
      await fs.writeFile(path.join(out, `${prefix}_${face}_review4x4.png`), await encodePng(createReviewImage(composed.maps)));
    }
    if (yarnName === "yarn-a") {
      for (const [filename, bytes] of Object.entries(value.files)) if (filename.includes("_technicalFace_")) await fs.writeFile(path.join(out, filename), bytes);
      await fs.writeFile(path.join(out, `${prefix}_metadata.json`), JSON.stringify(value.metadata, null, 2) + "\n");
    }
    summary.cases.push({ name, yarn: yarnName, status: result.status, W: result.cell.W, H: result.cell.H,
      waleDensityPerCm: result.metrics.waleDensityPerCm, courseDensityPerCm: result.metrics.courseDensityPerCm,
      faces: value.metadata.faces, centerline: geometry.centerline.diagnostics,
      yarnDiagnostics: value.material.diagnostics, normalChecks, timings: value.timings });
    console.log(JSON.stringify(summary.cases.at(-1)));
  }
}
await fs.writeFile(path.join(out, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
const sizes = await Promise.all((await fs.readdir(out)).map(async name => ({ name, bytes: (await fs.stat(path.join(out, name))).size })));
const bytes = sizes.reduce((sum, file) => sum + file.bytes, 0);
if (sizes.some(file => file.bytes > 1500000) || bytes > 15000000) throw new Error(`Review archive exceeds task limits: ${JSON.stringify(sizes)}`);
console.log(JSON.stringify({ reviewDirectory: out, files: sizes.length, bytes }));
