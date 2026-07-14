import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const definitionsPath = path.join(
  root,
  "src/codeGuide/codeGuideDefinitions.json"
);
const outputPath = path.join(root, "src/codeGuide/generatedLines.json");
const definitions = JSON.parse(fs.readFileSync(definitionsPath, "utf8"));
const generatedLines = {};

for (const [key, entry] of Object.entries(definitions)) {
  const sourcePath = path.join(root, entry.file);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source file for ${key}: ${entry.file}`);
  }

  const sourceLines = fs.readFileSync(sourcePath, "utf8").split(/\r?\n/);
  const line = sourceLines.findIndex((sourceLine) =>
    sourceLine.includes(entry.anchor)
  );
  if (line === -1) {
    throw new Error(
      `Missing anchor for ${key} in ${entry.file}: ${entry.anchor}`
    );
  }

  generatedLines[key] = line + 1;
}

fs.writeFileSync(
  outputPath,
  `${JSON.stringify(generatedLines, null, 2)}\n`,
  "utf8"
);
console.log(
  `Generated ${Object.keys(generatedLines).length} code guide line numbers.`
);
