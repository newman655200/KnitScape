import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const read = (file) => fs.readFileSync(file, "utf8");
const helperUrl = pathToFileURL("src/actions/yarnSequenceRows.js").href;
const paletteUrl = pathToFileURL("src/actions/yarnPaletteEditing.js").href;
const bimpUrl = pathToFileURL("src/lib/Bimp.js").href;
const helpers = await import(helperUrl);
const paletteHelpers = await import(paletteUrl);
const { Bimp } = await import(bimpUrl);

assert.equal(typeof helpers.normalizeYarnSequence, "function");
assert.equal(typeof helpers.resizeYarnSequenceToNeedleHeight, "function");
assert.equal(typeof helpers.yarnIndexForSequenceRow, "function");

const base = new Bimp(1, 2, [0, 1]);
const grown = helpers.resizeYarnSequenceToNeedleHeight(base, 5, 2);
assert.deepEqual([grown.width, grown.height], [1, 5]);
assert.deepEqual(Array.from(grown.pixels), [0, 1, 2, 2, 2]);

const reduced = helpers.resizeYarnSequenceToNeedleHeight(grown, 1, 0);
assert.deepEqual(Array.from(reduced.pixels), [0]);

const missing = helpers.normalizeYarnSequence(undefined, { height: 4 });
assert.deepEqual(Array.from(missing.pixels), [0, 0, 0, 0]);

const wide = helpers.normalizeYarnSequence(
  { width: 2, height: 3, pixels: [0, 9, 1, 9, 2, 9] },
  { height: 3 }
);
assert.deepEqual(Array.from(wide.pixels), [0, 1, 2]);

const yarnSequence = new Bimp(1, 4, [0, 0, 1, 0]);
const recolored = paletteHelpers.updateYarnPaletteColor({
  yarnPalette: ["old-first", "second"],
  yarnSequence,
  index: 0,
  color: "new-first",
});
assert.equal(recolored.yarnPalette[0], "new-first");
assert.equal(recolored.yarnPalette.includes("old-first"), true);
assert.deepEqual(Array.from(recolored.yarnSequence.pixels), [2, 2, 1, 2]);

const bitmapEditor = read("src/views/bitmapEditor.js");
const pointer = read("src/events/colorSequencePointerInteraction.js");
const touch = read("src/events/colorSequenceTouchInteraction.js");
const importers = read("src/actions/importers.js");
const exporters = read("src/actions/exporters.js");
const patternFile = read("src/patternFile.js");
const runSimulation = read("src/components/runSimulation.js");
const simulation = [
  "src/simulation/yarnSimulation.js",
  "src/simulation/yarnPathGeometry.js",
  "src/simulation/drawYarnSimulation.js",
].map(read).join("\n");

assert.match(bitmapEditor, /id="\$\{prefix\}-yarn-sequence-canvas"/);
assert.match(
  bitmapEditor,
  /export function bitmapEditor\(\{\s*fullField,\s*unitField,\s*prefix,/
);
assert.match(bitmapEditor, /symbolCanvasId = prefix === "needle"/);
assert.match(bitmapEditor, /gridCanvasId = prefix === "needle"/);
assert.match(bitmapEditor, /id=\$\{symbolCanvasId\}/);
assert.match(bitmapEditor, /id=\$\{gridCanvasId\}/);
assert.match(bitmapEditor, /id="\$\{prefix\}-interaction-canvas"/);
assert.match(bitmapEditor, /data-code-guide-key="\$\{prefix\}\.symbols"/);
assert.match(bitmapEditor, /data-code-guide-key="\$\{prefix\}\.grid"/);
assert.match(bitmapEditor, /class="yarn-sequence-gutter"/);
assert.match(bitmapEditor, /class="yarn-sequence-track"/);
assert.match(bitmapEditor, /class="pattern-grid-window"/);
assert.match(bitmapEditor, /class="pattern-canvas-transform"/);
assert.match(bitmapEditor, /id="yarn-color-canvas"/);
assert.match(bitmapEditor, /data-code-guide-key="needle\.yarn-sequence"/);
assert.match(bitmapEditor, /data-code-guide-key="needle\.yarn-color"/);
for (const source of [pointer, touch]) {
  assert.match(source, /beginTexturePreviewInteraction/);
  assert.match(source, /endTexturePreviewInteraction/);
}
assert.match(importers, /height:\s*pattern\.canvasHeight/);
assert.match(exporters, /serializePattern\(GLOBAL_STATE\)/);
assert.match(patternFile, /yarnSequence:\s*state\.yarnSequence\.toJSON\(\)/);
assert.match(runSimulation, /GLOBAL_STATE\.yarnSequence/);
for (const token of [
  "yarnIndexForSequenceRow",
  "link.row",
  "rowYarnPly",
  "palette[paletteIndex]",
]) {
  assert.match(simulation, new RegExp(token.replaceAll("[", "\\[").replaceAll("]", "\\]")));
}

console.log("PASS: yarn sequence editor stays aligned with needle rows.");
