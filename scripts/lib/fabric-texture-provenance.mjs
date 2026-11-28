import { execFileSync } from "node:child_process";
import path from "node:path";
import { metadataPath } from "../../src/fabricTexture/metadata.js";

/** Version describes the tree at generation time, including untracked changes. */
export function textureGeneratorVersion() {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
  return head + (dirty ? "-dirty" : "");
}

/** Remove machine-specific absolute paths from newly written or historical JSON. */
export function portableTextureRecord(value, repositoryRoot = path.resolve(".")) {
  if (Array.isArray(value)) return value.map(item => portableTextureRecord(item, repositoryRoot));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .map(([key, item]) => [key, portableTextureRecord(item, repositoryRoot)]));
  if (typeof value === "string" && /^(?:[a-z]:[\\/]|\/)/i.test(value)) return metadataPath(value, repositoryRoot);
  return value;
}
