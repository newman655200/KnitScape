import fs from "node:fs/promises";
import path from "node:path";
import { bakeFabricTexture, bakeYarnStrip } from "../src/fabricTexture/fabricTexturePipeline.js";
import { createFabricFormParams } from "../src/fabricForm/fabricFormParams.js";
import { encodePng } from "../src/fabricTexture/png.js";
import { createReviewImage } from "../src/fabricTexture/review.js";
import { loadTextureMaterial, addYarnPreviewMetadata } from "./lib/fabric-texture-material-input.mjs";
import { assertNormalPng } from "./lib/fabric-texture-normal-checks.mjs";
import { textureGeneratorVersion } from "./lib/fabric-texture-provenance.mjs";

const flags = new Set(["--review", "--no-yarn-strip", "--yarn-strip-only", "--help"]);
const names = new Set(["--from-result", "--solve", "--out", "--prefix", "--px-per-mm", "--repeat", "--color",
  "--yarn-base-color", "--yarn-normal", "--yarn-roughness", "--yarn-ao", "--yarn-metallic", "--yarn-repeat-mm", "--yarn-normal-green",
  "--fuzz", "--fuzz-band", "--fuzz-strength", "--hairiness", "--hair-length-mm", "--hair-angle-deg", "--max-curvature",
  "--fiber-opacity", "--halo-strength", "--halo-width-r", "--seed", "--strip-length-mm", "--params"]);
const options = {};
try {
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (Object.hasOwn(options, arg)) throw new Error(`Duplicate option ${arg}`);
    if (flags.has(arg)) options[arg] = true;
    else if (names.has(arg) && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) options[arg] = process.argv[++i];
    else throw new Error(`Unknown option or missing value: ${arg}`);
  }
  if (options["--help"]) {
    console.log("bake:fabric-texture --from-result result.json | --solve input.json | --yarn-strip-only [--params params.json] --out directory\nOutput: --prefix fabric --px-per-mm 400 --repeat 1,1 --strip-length-mm 4 --no-yarn-strip --review\nYarn: --color --yarn-base-color --yarn-normal --yarn-roughness --yarn-ao --yarn-metallic --yarn-repeat-mm --yarn-normal-green +Y|-Y\nFuzz: --fuzz off|scan|generated|both --fuzz-band fullScan|vRange --fuzz-strength --hairiness --hair-length-mm --hair-angle-deg --max-curvature --fiber-opacity --halo-strength --halo-width-r --seed");
  } else {
    const stripOnly = Boolean(options["--yarn-strip-only"]);
    if (stripOnly ? (options["--from-result"] || options["--solve"] || options["--no-yarn-strip"])
      : (!!options["--from-result"] === !!options["--solve"])) {
      throw new Error("Choose one fabric input or --yarn-strip-only; --no-yarn-strip requires fabric mode.");
    }
    if (!stripOnly && options["--params"]) throw new Error("--params belongs to --yarn-strip-only.");
    if (!options["--out"]) throw new Error("--out is required.");
    const material = await loadTextureMaterial({ color: options["--color"], normalGreen: options["--yarn-normal-green"],
      fuzzBand: options["--fuzz-band"], fuzzStrength: options["--fuzz-strength"] === undefined ? undefined : Number(options["--fuzz-strength"]),
      physicalRepeatLengthMm: options["--yarn-repeat-mm"] === undefined ? undefined : Number(options["--yarn-repeat-mm"]),
      files: Object.fromEntries([["baseColor", "--yarn-base-color"], ["normal", "--yarn-normal"], ["roughness", "--yarn-roughness"],
        ["ambientOcclusion", "--yarn-ao"], ["metallic", "--yarn-metallic"]].filter(([, flag]) => options[flag]).map(([key, flag]) => [key, path.resolve(options[flag])])) });
    const fuzzOptions = Object.fromEntries([["fuzzStrength", "--fuzz-strength"], ["hairinessIndex", "--hairiness"], ["meanHairLengthMm", "--hair-length-mm"],
      ["hairAngleDeg", "--hair-angle-deg"], ["maxCurvaturePerMm", "--max-curvature"], ["fiberOpacity", "--fiber-opacity"],
      ["haloStrength", "--halo-strength"], ["haloWidthR", "--halo-width-r"], ["seed", "--seed"]]
      .filter(([, flag]) => options[flag] !== undefined).map(([key, flag]) => [key, Number(options[flag])]));
    const prefix = options["--prefix"] ?? "fabric";
    const common = { material, prefix, pxPerMm: Number(options["--px-per-mm"] ?? 400), fuzzSource: options["--fuzz"], fuzzOptions,
      generatorVersion: textureGeneratorVersion(), generatedAt: new Date().toISOString(), repositoryRoot: path.resolve(".") };
    const files = {}, timings = {}, report = {};
    let params = {};
    if (!stripOnly) {
      const file = options["--from-result"] ?? options["--solve"], input = JSON.parse(await fs.readFile(file, "utf8"));
      const generated = await bakeFabricTexture({ ...common, result: options["--from-result"] ? input : undefined,
        solveInput: options["--solve"] ? input : undefined, sourceResultFile: options["--from-result"] ? path.resolve(file) : null,
        repeat: options["--repeat"] ? options["--repeat"].split(",").map(Number) : [1, 1] });
      if (generated.result.status !== "CONVERGED") console.warn(`WARNING: solver status=${generated.result.status}; output is explicitly non-converged.`);
      Object.assign(files, generated.files);
      files[`${prefix}_metadata.json`] = JSON.stringify(generated.metadata, null, 2) + "\n";
      if (options["--review"]) for (const [face, value] of Object.entries(generated.composed)) {
        files[`${prefix}_${face}_review4x4.png`] = await encodePng(createReviewImage(value.unitMaps));
      }
      params = generated.result.params;
      Object.assign(report, { status: generated.result.status, optimizerStatus: generated.result.optimizerStatus,
        iterations: generated.result.iterations, W: generated.result.cell.W, H: generated.result.cell.H });
      timings.fabric = generated.timings;
    } else if (options["--params"]) params = createFabricFormParams(JSON.parse(await fs.readFile(options["--params"], "utf8")));
    if (!options["--no-yarn-strip"]) {
      const strip = await bakeYarnStrip({ ...common, params, stripLengthMm: Number(options["--strip-length-mm"] ?? 4) });
      await addYarnPreviewMetadata(strip.metadata, strip.maps.baseColor);
      Object.assign(files, strip.files);
      files[`${prefix}_yarn_metadata.json`] = JSON.stringify(strip.metadata, null, 2) + "\n";
      if (options["--review"]) files[`${prefix}_yarn_review.png`] = await encodePng(createReviewImage(strip.composed.unitMaps, [2, 1]));
      timings.yarn = strip.timings;
    }
    await fs.mkdir(options["--out"], { recursive: true });
    for (const [name, data] of Object.entries(files)) {
      if (name.endsWith("_normal.png")) assertNormalPng(data, `CLI ${name}`);
      await fs.writeFile(path.join(options["--out"], name), data);
    }
    console.log(JSON.stringify({ ...report, files: Object.keys(files), timings }, null, 2));
  }
} catch (error) { console.error(error.stack); process.exitCode = 1; }
