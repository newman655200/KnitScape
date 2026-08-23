import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

function cssBlock(source, selector) {
  const blocks = [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => match[1].split(",").map((item) => item.trim()).includes(selector))
    .map((match) => match[2]);
  assert.ok(blocks.length, `missing CSS rule: ${selector}`);
  return blocks.join("\n");
}

function assertEditor(editor, prefix, fullCanvasId, gridCanvasId) {
  const viewport = editor.querySelector(".pattern-editor-viewport");
  const stage = viewport.querySelector(":scope > .pattern-editor-stage");
  const [gutter, gridWindow] = stage.children;
  assert.equal(stage.children.length, 2);
  assert.ok(gutter.matches(".yarn-sequence-gutter"));
  assert.ok(gridWindow.matches(".pattern-grid-window"));
  assert.equal(gridWindow.contains(gutter), false);

  const yarnTrack = gutter.querySelector(":scope > .yarn-sequence-track");
  const transform = gridWindow.querySelector(":scope > .pattern-canvas-transform");
  const stack = transform.querySelector(":scope > .pattern-canvas-stack");
  assert.ok(yarnTrack.querySelector(`#${prefix}-yarn-sequence-canvas`));
  assert.equal(gridWindow.contains(yarnTrack), false);

  for (const id of [
    fullCanvasId,
    gridCanvasId,
    `${prefix}-unit-symbol-canvas`,
    `${prefix}-unit-grid`,
    `${prefix}-interaction-canvas`,
  ]) {
    assert.ok(stack.querySelector(`#${id}`), `${prefix} contains #${id}`);
  }
  const interaction = stack.querySelector(`#${prefix}-interaction-canvas`);
  assert.equal(interaction.dataset.fullField, `${prefix}Bitmap`);
  assert.equal(interaction.dataset.unitField, `${prefix}UnitBitmap`);
}

const globals = ["window", "document", "Document", "Node", "HTMLElement", "customElements", "Path2D"];
const previous = new Map(
  globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
);
const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
let dom;

try {
  dom = new JSDOM("<!doctype html><body></body>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Document: dom.window.Document,
    Node: dom.window.Node,
    HTMLElement: dom.window.HTMLElement,
    customElements: dom.window.customElements,
    Path2D: class {},
  });
  const { render } = await server.ssrLoadModule("/node_modules/lit-html/lit-html.js");
  const { bitmapEditor } = await server.ssrLoadModule("/src/views/bitmapEditor.js");
  const host = document.createElement("main");
  document.body.append(host);
  render(
    [
      bitmapEditor({ fullField: "camBitmap", unitField: "camUnitBitmap", prefix: "cam", titleKey: "cam.title" }),
      bitmapEditor({ fullField: "needleBitmap", unitField: "needleUnitBitmap", prefix: "needle", titleKey: "needle.title", showNeedleControls: true }),
    ],
    host
  );

  assertEditor(host.querySelector("#cam-editor-pane"), "cam", "cam-symbol-canvas", "cam-grid");
  assertEditor(host.querySelector("#needle-editor-pane"), "needle", "symbol-canvas", "grid");
  const ids = [...host.querySelectorAll("[id]")].map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length, "editor IDs stay unique");
} finally {
  await server.close();
  dom?.window.close();
  for (const [name, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}

const styles = fs.readFileSync("styles.css", "utf8");
assert.match(cssBlock(styles, ".pattern-editor-viewport"), /overflow:\s*hidden/);
assert.match(cssBlock(styles, ".pattern-editor-stage"), /grid-template-columns:\s*var\(--chart-cell-size\)\s+minmax\(0,\s*1fr\)/);
assert.match(cssBlock(styles, ".yarn-sequence-gutter"), /overflow:\s*hidden/);
assert.match(cssBlock(styles, ".yarn-sequence-gutter"), /z-index:\s*\d+/);
assert.match(cssBlock(styles, ".pattern-grid-window"), /overflow:\s*hidden/);
assert.match(cssBlock(styles, ".pattern-unit-symbol-canvas"), /z-index:\s*3/);
assert.match(cssBlock(styles, ".pattern-interaction-canvas"), /z-index:\s*[4-9]/);

console.log("PASS: each repeat editor keeps a fixed gutter beside a clipped canvas.");
