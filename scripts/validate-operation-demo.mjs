import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const modulePath = "src/simulation/operationPreview.js";
assert.ok(fs.existsSync(modulePath), "Operation demo needs a read-only path selection helper");
const { selectOperationPaths } = await import(pathToFileURL(`${process.cwd()}/${modulePath}`));

// Padded width 6: CN columns 0 and 5 are padding, column 1 is visible needle 0.
const links = [
  { index: 0, row: 0, source: 0, target: 2 },
  { index: 1, row: 0, source: 2, target: 3 },
  { index: 2, row: 0, source: 3, target: 8 },
  { index: 3, row: 0, source: 8, target: 9 },
  { index: 4, row: 1, source: 14, target: 15 },
];
const strands = [0, 1].map(slot => ({ resolvedPathByLink: new Map(
  links.map(link => [link.index, `M ${slot} ${link.index} L 10 20`])) }));
const input = { links, strands, paddedWidth: 6, xPadding: 1, row: 0, needle: 0,
  feedCount: 2, feedYarnIds: new Map([[0, ["main", "spandex"]], [1, ["main"]]]), visibleYarnId: null };
const before = JSON.stringify({ links, strands: strands.map(s => [...s.resolvedPathByLink]) });
const all = selectOperationPaths(input);
assert.equal(all.length, 8);
assert.deepEqual(all.filter(p => p.selected).map(p => p.linkIndex), [0, 0, 1, 1, 2, 2]);
for (const p of all) assert.equal(p.pathData, strands[p.yarnIndex].resolvedPathByLink.get(p.linkIndex));
for (const id of ["main", "spandex"]) {
  const selected = selectOperationPaths({ ...input, visibleYarnId: id });
  assert.equal(selected.length, 4);
  assert.ok(selected.every(p => p.yarnId === id));
}
assert.equal(selectOperationPaths({ ...input, visibleYarnId: "missing" }).length, 0);
assert.equal(selectOperationPaths({ ...input, row: 1 }).length, 1, "Do not invent an unassigned second strand");
assert.equal(selectOperationPaths({ ...input, row: 2 }).length, 0);
assert.equal(selectOperationPaths({ ...input, needle: 1 }).filter(p => p.selected).length, 0,
  "A float crossing a needle is not evidence of an endpoint association");
assert.equal(JSON.stringify({ links, strands: strands.map(s => [...s.resolvedPathByLink]) }), before);
const { operationPreviewOverlay, machineOperationDemo } = await import("../src/views/machineOperationDemo.js");
for (const dpr of [1, 1.25, 2, 3]) {
  globalThis.devicePixelRatio = dpr;
  const overlay = operationPreviewOverlay({ canvasWidth: 800, canvasHeight: 600,
    displayWidth: 400, displayHeight: 300, paths: all });
  assert.deepEqual(overlay.values.slice(0, 2), [400, 300],
    "Overlay CSS dimensions must stay matched to the rendered Canvas after DPR changes");
}
function* templates(value) {
  if (Array.isArray(value)) { for (const item of value) yield* templates(item); }
  else if (value?.strings) { yield value; yield* templates(value.values); }
}
for (const paths of [[], [{ ...all[0], selected: true }]]) {
  const view = machineOperationDemo({ enabled: true,
    preview: { row: 0, needle: 0, width: 1, height: 1, operation: "M", operations: ["M"], paths },
    camProgram: { tracks: [["M"]] }, arrangement: [1], language: "zh-CN",
    onChange() {}, onFocus() {} });
  const controls = [...templates(view)].find(template => template.strings.some(s => s.includes('id="operation-focus"')));
  const binding = controls.strings.findIndex(s => s.includes('id="operation-focus"'));
  assert.equal(controls.values[binding], paths.length === 0,
    "No endpoint association must disable focus instead of panning to unrelated row paths");
}
const trialColors = new Map([["main", "#36c7ff"], ["spandex", "#ff9854"]]);
let normalOverlay;
for (const structureLineStyle of [null, { colors: trialColors, lineWidth: 1 }, null]) {
  const overlay = operationPreviewOverlay({ canvasWidth: 800, canvasHeight: 600,
    displayWidth: 400, displayHeight: 300, paths: all, structureLineStyle });
  if (structureLineStyle === null) {
    normalOverlay ??= JSON.stringify(overlay);
    assert.equal(JSON.stringify(overlay), normalOverlay,
      "Turning off the trial restores the exact original highlight template and CSS classes");
  }
  const paths = [...templates(overlay)].filter(template => template.strings.some(s => s.includes("<path")));
  assert.equal(paths.length, all.length);
  const ordered = [...all.filter(p => !p.selected), ...all.filter(p => p.selected)];
  paths.forEach((template, index) => {
    const path = ordered[index];
    assert.ok(template.values.includes(path.pathData), "Overlay must use the same exact selected paths");
    const style = template.strings.findIndex(s => s.trimEnd().endsWith("style="));
    if (structureLineStyle) {
      assert.ok(style >= 0, "Trial highlight must have a thin identity-colored display style");
      assert.ok(template.values[style].includes(trialColors.get(path.yarnId)));
      assert.ok(template.values[style].includes(`stroke-width: ${path.selected ? 1.5 : 0.6}`));
    } else if (style >= 0) assert.equal(template.values[style], "", "Default highlight retains CSS styles");
  });
}
console.log("PASS: operation preview selects existing paths without changing geometry or Assignment.");
