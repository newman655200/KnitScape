import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const resolve = (...parts) => path.join(root, ...parts);
const read = (file) => fs.readFileSync(resolve(file), "utf8");

const forbiddenPaths = [
  "src/doubleFace",
  "src/views/doubleFaceEditor.js",
  "src/components/doubleFacePreview3d.js",
  "scripts/validate-double-face-foundation.mjs",
  "KnitScape_双面布技术文档.md",
  "outputs",
];

for (const file of forbiddenPaths) {
  if (fs.existsSync(resolve(file))) failures.push(`remove obsolete path: ${file}`);
}

for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.isDirectory() && entry.name.startsWith(".tmp-chrome-step")) {
    failures.push(`remove obsolete browser profile: ${entry.name}`);
  }
}

const runtimeFiles = [
  "src/constants.js",
  "src/state.js",
  "src/views/view.js",
  "src/views/taskbar.js",
  "src/components/runSimulation.js",
  "src/actions/importers.js",
  "src/i18n/translations.js",
  "styles.css",
];
const runtimePattern =
  /doubleFace|double-face|FABRIC_MODES|fabricMode|renderDoubleFace|from\s+["']three["']/i;

for (const file of runtimeFiles) {
  if (runtimePattern.test(read(file))) {
    failures.push(`remove double-face runtime reference from ${file}`);
  }
}

const packageJson = JSON.parse(read("package.json"));
if (packageJson.dependencies?.three) failures.push("remove dependency: three");
if (packageJson.scripts?.["validate:double-face"]) {
  failures.push("remove npm script: validate:double-face");
}

for (const file of [
  "KnitScape_单面布技术文档.md",
  "docs/针织实验室_单面布功能需求文档.md",
]) {
  if (/双面布|空气层|Fraunhofer|Three\.js|double-face|fabricMode/i.test(read(file))) {
    failures.push(`remove obsolete double-face wording from ${file}`);
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}

console.log("PASS: repository contains only the single-face application.");
