import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import os from "node:os";

export const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
export const fixtureDirectory = path.join(repositoryRoot, "scripts/fixtures/fabric-form-golden");
export const solveBaselineFile = path.join(fixtureDirectory, "solve-baseline.json");
export const evalBaselineFile = path.join(fixtureDirectory, "eval-baseline.json");
export const archiveRoot = "C:/Users/liuchen/Documents/KnitScape/archives/r1-refactor-2026-11-25";
const sourceDirectory = "docs/archive/t1-slope-closeout-2026-11-23";
export const goldenCases = [
  ...["2.6", "3", "3.5", "4"].map(value => ({
    id: `case-${value}-N48`,
    inputFile: `${sourceDirectory}/step4-case-${value}-N48-input.json`,
    historicalResultFile: `${sourceDirectory}/step4-case-${value}-N48.json`,
  })),
  ...["2.77", "2.84", "2.9"].map(value => ({
    id: `hossain-${value}`,
    inputFile: `${sourceDirectory}/step3-hossain-${value}-input.json`,
    historicalResultFile: `${sourceDirectory}/step3-hossain-${value}-after.json`,
  })),
];

export const readJson = filename => JSON.parse(fs.readFileSync(filename, "utf8"));
export const sha256 = value => createHash("sha256").update(value).digest("hex");
export const inputHash = scenario => sha256(fs.readFileSync(path.join(repositoryRoot, scenario.inputFile)));
export const readInput = scenario => readJson(path.join(repositoryRoot, scenario.inputFile)).input;
export const currentHead = () => execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
export const runtime = () => ({ node: process.version, platform: process.platform, arch: process.arch, endianness: os.endianness() });

/** Exact R1 comparison: retain key order and every field except these two exclusions. */
export function normalizedSolveJson(result) {
  const normalized = structuredClone(result);
  delete normalized.closeout;
  if (normalized.diagnostics) delete normalized.diagnostics.elapsedMs;
  return JSON.stringify(normalized);
}

export function writeJson(filename, value, { exclusive = false } = {}) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(value, null, 2) + "\n", { flag: exclusive ? "wx" : "w" });
}

export function assertCases(baseline) {
  assert.deepEqual(baseline.cases.map(row => row.id), goldenCases.map(row => row.id), "Golden case list changed");
  for (const [index, scenario] of goldenCases.entries()) {
    assert.equal(baseline.cases[index].inputSha256, inputHash(scenario), `${scenario.id}: input changed`);
  }
}

export function parseGoldenArguments(args, allowedFlags) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--archive-dir") {
      const value = args[++index];
      assert.ok(value && !value.startsWith("--"), "--archive-dir requires a directory");
      options.archiveDirectory = path.resolve(value);
    } else {
      assert.ok(allowedFlags.includes(argument), `Unknown argument: ${argument}`);
      options[argument] = true;
    }
  }
  return options;
}
