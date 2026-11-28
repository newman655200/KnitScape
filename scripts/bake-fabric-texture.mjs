import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { bakeFabricTexture } from "../src/fabricTexture/fabricTexturePipeline.js";
import { encodePng } from "../src/fabricTexture/png.js";
import { createReviewImage } from "../src/fabricTexture/review.js";
import { loadTextureMaterial } from "./lib/fabric-texture-material-input.mjs";
import { assertNormalPng } from "./lib/fabric-texture-normal-checks.mjs";

const flags = new Set(["--review", "--no-yarn-strip", "--help"]);
const names = new Set(["--from-result", "--solve", "--out", "--prefix", "--px-per-mm", "--repeat", "--color",
  "--yarn-base-color", "--yarn-normal", "--yarn-roughness", "--yarn-ao", "--yarn-metallic", "--yarn-repeat-mm", "--yarn-normal-green", "--fuzz"]);
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
    console.log("bake:fabric-texture --from-result result.json | --solve input.json --out directory [--prefix fabric] [--px-per-mm 400] [--repeat 1,1] [--review]\nYarn: --color, --yarn-base-color, --yarn-normal, --yarn-roughness, --yarn-ao, --yarn-metallic, --yarn-repeat-mm, --yarn-normal-green +Y|-Y\nT6a-1: --fuzz off only; yarn-strip export is introduced in T6a-2.");
  } else {
    if (!!options["--from-result"] === !!options["--solve"]) throw new Error("Exactly one of --from-result and --solve is required.");
    if (!options["--out"]) throw new Error("--out is required.");
    const file = options["--from-result"] ?? options["--solve"], input = JSON.parse(await fs.readFile(file, "utf8"));
    const material = await loadTextureMaterial({ color: options["--color"], normalGreen: options["--yarn-normal-green"],
      physicalRepeatLengthMm: options["--yarn-repeat-mm"] === undefined ? undefined : Number(options["--yarn-repeat-mm"]),
      files: Object.fromEntries([["baseColor", "--yarn-base-color"], ["normal", "--yarn-normal"], ["roughness", "--yarn-roughness"],
        ["ambientOcclusion", "--yarn-ao"], ["metallic", "--yarn-metallic"]].filter(([, flag]) => options[flag]).map(([key, flag]) => [key, path.resolve(options[flag])])) });
    const prefix = options["--prefix"] ?? "fabric";
    const generated = await bakeFabricTexture({ result: options["--from-result"] ? input : undefined,
      solveInput: options["--solve"] ? input : undefined, material, prefix, fuzzSource: options["--fuzz"] ?? "off",
      pxPerMm: Number(options["--px-per-mm"] ?? 400), repeat: options["--repeat"] ? options["--repeat"].split(",").map(Number) : [1, 1],
      sourceResultFile: options["--from-result"] ? path.resolve(file) : null,
      generatorVersion: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() });
    if (generated.result.status !== "CONVERGED") console.warn(`WARNING: solver status=${generated.result.status}; output is explicitly non-converged.`);
    if (options["--review"]) for (const [face, value] of Object.entries(generated.composed)) {
      generated.files[`${prefix}_${face}_review4x4.png`] = await encodePng(createReviewImage(value.unitMaps));
    }
    await fs.mkdir(options["--out"], { recursive: true });
    for (const [name, data] of Object.entries(generated.files)) {
      if (name.endsWith("_normal.png")) assertNormalPng(data, `CLI ${name}`);
      await fs.writeFile(path.join(options["--out"], name), data);
    }
    await fs.writeFile(path.join(options["--out"], `${prefix}_metadata.json`), JSON.stringify(generated.metadata, null, 2) + "\n");
    console.log(JSON.stringify({ status: generated.result.status, optimizerStatus: generated.result.optimizerStatus,
      iterations: generated.result.iterations, W: generated.result.cell.W, H: generated.result.cell.H,
      files: [...Object.keys(generated.files), `${prefix}_metadata.json`], timings: generated.timings }, null, 2));
  }
} catch (error) { console.error(error.stack); process.exitCode = 1; }
