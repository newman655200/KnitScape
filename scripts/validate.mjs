import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const { scripts } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const validators = Object.entries(scripts).filter(([name]) => name.startsWith("validate:"));
const failures = [];
for (const [name, command] of validators) {
  console.log(`\n${name}`);
  const [executable, ...args] = command.split(/\s+/);
  if (executable !== "node") throw new Error(`Unsupported validator command: ${command}`);
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) {
    failures.push(name);
    if (result.error) console.error(result.error);
  }
}
console.log(`\n${validators.length - failures.length}/${validators.length} validators passed.`);
if (failures.length) {
  console.error(`Failed: ${failures.join(", ")}`);
  process.exitCode = 1;
}
