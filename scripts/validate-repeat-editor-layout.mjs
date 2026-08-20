import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
const dom = new JSDOM("<!doctype html><html><body></body></html>");
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  Document: dom.window.Document,
  Node: dom.window.Node,
  HTMLElement: dom.window.HTMLElement,
  customElements: dom.window.customElements,
  devicePixelRatio: 2,
  Path2D: class {},
});

const { render } = await server.ssrLoadModule(
  "/node_modules/lit-html/lit-html.js"
);

function assertEditor(editor, { prefix, fullCanvasId, gridCanvasId }) {
  const viewport = editor.querySelector(".pattern-editor-viewport");
  const stage = viewport?.querySelector(":scope > .pattern-editor-stage");
  assert.ok(viewport, `${prefix} editor has a clipped viewport`);
  assert.ok(stage, `${prefix} viewport has a stage`);
  assert.equal(stage.style.getPropertyValue("--chart-cell-size"), "7.5px");

  const columns = [...stage.children];
  assert.equal(columns.length, 2, `${prefix} stage has exactly two columns`);
  const [gutter, gridWindow] = columns;
  assert.ok(gutter.matches(".yarn-sequence-gutter"), "gutter is first");
  assert.ok(gridWindow.matches(".pattern-grid-window"), "grid window is second");
  assert.equal(gutter.parentElement, stage);
  assert.equal(gridWindow.parentElement, stage);
  assert.equal(gridWindow.contains(gutter), false, "gutter stays outside grid window");

  const yarnTrack = gutter.querySelector(":scope > .yarn-sequence-track");
  const canvasTransform = gridWindow.querySelector(":scope > .pattern-canvas-transform");
  const stack = canvasTransform?.querySelector(":scope > .pattern-canvas-stack");
  assert.ok(yarnTrack, "gutter owns an independent yarn track");
  assert.ok(canvasTransform, "grid window owns a canvas transform");
  assert.ok(stack, "canvas transform owns a stack");
  assert.equal(gridWindow.contains(yarnTrack), false, "yarn track never pans with grid window");
  assert.ok(yarnTrack.querySelector(`#${prefix}-yarn-sequence-canvas`));

  for (const id of [
    fullCanvasId,
    gridCanvasId,
    `${prefix}-unit-symbol-canvas`,
    `${prefix}-unit-grid`,
    `${prefix}-interaction-canvas`,
  ]) {
    assert.ok(stack.querySelector(`#${id}`), `${prefix} stack includes #${id}`);
  }

  const interaction = stack.querySelector(`#${prefix}-interaction-canvas`);
  assert.equal(interaction.dataset.patternField, `${prefix}Bitmap`);
  assert.equal(interaction.dataset.fullField, `${prefix}Bitmap`);
  assert.equal(interaction.dataset.unitField, `${prefix}UnitBitmap`);

  if (prefix === "needle") {
    assert.ok(stack.querySelector("#yarn-color-canvas"));
  } else {
    assert.equal(stack.querySelector("#yarn-color-canvas"), null);
  }
}

try {
  const { bitmapEditor } = await server.ssrLoadModule("/src/views/bitmapEditor.js");
  const host = document.createElement("main");
  document.body.append(host);
  render(
    [
      bitmapEditor({
        fullField: "camBitmap",
        unitField: "camUnitBitmap",
        prefix: "cam",
        titleKey: "cam.title",
      }),
      bitmapEditor({
        fullField: "needleBitmap",
        unitField: "needleUnitBitmap",
        prefix: "needle",
        titleKey: "needle.title",
        showNeedleControls: true,
      }),
    ],
    host
  );

  assertEditor(host.querySelector("#cam-editor-pane"), {
    prefix: "cam",
    fullCanvasId: "cam-symbol-canvas",
    gridCanvasId: "cam-grid",
  });
  assertEditor(host.querySelector("#needle-editor-pane"), {
    prefix: "needle",
    fullCanvasId: "symbol-canvas",
    gridCanvasId: "grid",
  });
} finally {
  await server.close();
  dom.window.close();
}

const styles = fs.readFileSync("styles.css", "utf8");
assert.match(styles, /\.pattern-editor-viewport\s*\{[\s\S]*?overflow:\s*hidden/);
assert.match(styles, /\.pattern-editor-stage\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-columns:\s*var\(--chart-cell-size\)\s+minmax\(0,\s*1fr\)/);
assert.match(styles, /\.yarn-sequence-gutter\s*\{[\s\S]*?width:\s*var\(--chart-cell-size\)[\s\S]*?border-right:[\s\S]*?z-index:/);
assert.match(styles, /\.pattern-grid-window\s*\{[\s\S]*?overflow:\s*hidden/);
assert.match(styles, /\.yarn-sequence-track\s*\{[\s\S]*?position:\s*absolute[\s\S]*?will-change:\s*transform/);
assert.match(styles, /\.pattern-canvas-transform\s*\{[\s\S]*?position:\s*absolute[\s\S]*?will-change:\s*transform/);
assert.match(styles, /\.pattern-interaction-canvas\s*\{[\s\S]*?z-index:\s*[4-9][\s\S]*?touch-action:\s*none/);
assert.doesNotMatch(styles, /\.pattern-canvas-row\s*\{/);
assert.doesNotMatch(styles, /#needle-yarn-sequence\s*\{/);

console.log("PASS: repeat editor uses a clipped grid stage with an independent yarn gutter.");
