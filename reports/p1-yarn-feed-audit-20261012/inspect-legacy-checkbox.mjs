import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZipReader, Uint8ArrayReader, TextWriter } from "@zip.js/zip.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const facts = [];
for (const filename of ["user-save.knitscape", "legacy-native-commit.knitscape", "legacy-after-restore-check.knitscape"]) {
  const reader = new ZipReader(new Uint8ArrayReader(await fs.readFile(path.join(dir, filename))), { useWebWorkers: false });
  try {
    const entry = (await reader.getEntries()).find(entry => entry.filename === "project.json");
    const project = JSON.parse(await entry.getData(new TextWriter(), { checkSignature: true }));
    facts.push({ filename, primaryDiameter: project.yarnPlies[0].diameter, secondaryEnabled: project.yarnPlies[1].enabled,
      targets: project.singleJerseyCamProgram.feeds.map(feed => feed.yarns.map(yarn => yarn.yarnLengthCmPer100Needles)) });
  } finally { await reader.close(); }
}
const dom = JSON.parse(await fs.readFile(path.join(dir, "legacy-checkbox-after-load-dom.json"), "utf8"));
assert.equal(facts[0].secondaryEnabled, false);
assert.equal(facts[1].secondaryEnabled, true);
assert.equal(facts[1].primaryDiameter, 0.29);
assert.equal(facts[2].secondaryEnabled, false);
assert.equal(facts[2].primaryDiameter, 0.24);
assert.deepEqual(facts[2].targets, facts[0].targets);
assert.equal(dom.checked, true);
assert.equal(dom.checkedAttribute, null);
const source = await fs.readFile(path.join(dir, "../../src/views/yarnPlyPanel.js"), "utf8");
assert.ok(source.includes("?checked=${ply.enabled}"));
const result = { check: "PASS: browser evidence demonstrates a persisted-fact / checkbox-display mismatch", evidenceType: "actual-browser-downloads-and-read-only-DOM",
  businessCodeChanged: false, facts, dom, issue: "Legacy secondary-enabled checkbox remains checked after same-page Load restores false" };
await fs.writeFile(path.join(dir, "legacy-checkbox-mismatch-check.json"), JSON.stringify(result, null, 2) + "\n");
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
