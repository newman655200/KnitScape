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

const browserGlobals = [
  "window",
  "document",
  "Node",
  "Element",
  "HTMLElement",
  "Event",
  "CustomEvent",
  "Path2D",
];
const previousGlobals = new Map(
  browserGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
);
const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
let dom;

try {
  dom = new JSDOM("<!doctype html><body><main id='toolbar-root'></main>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Node: dom.window.Node,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    Path2D: class {},
  });

  const state = await server.ssrLoadModule("/src/state.js");
  const { chartEditorToolbar, commitDimension, handleDimensionKeydown } =
    await server.ssrLoadModule("/src/views/chartEditorToolbar.js");
  const { render } = await server.ssrLoadModule(
    "/node_modules/lit-html/lit-html.js"
  );

  state.loadWorkspace({ canvasWidth: 60, canvasHeight: 60 });
  const root = document.querySelector("#toolbar-root");
  render(chartEditorToolbar(), root);
  const buttons = [...root.querySelectorAll(".chart-stitch-button")];
  const controls = root.querySelector(".chart-size-controls");
  const width = root.querySelector('[data-code-guide-key="canvas.width"]');
  const height = root.querySelector('[data-code-guide-key="canvas.height"]');

  assert.equal(buttons.length, 4);
  assert.ok(buttons.at(-1).compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING);
  assert.deepEqual([width.value, height.value], ["60", "60"]);
  assert.deepEqual([width.min, width.max, width.step], ["5", "500", "1"]);
  assert.deepEqual([height.min, height.max, height.step], ["5", "500", "1"]);
  assert.deepEqual(
    [...controls.querySelectorAll("label span")].map((span) => span.textContent),
    ["横向针数", "纵向行数"]
  );

  width.value = "60.9";
  state.dispatch({ grid: !state.GLOBAL_STATE.grid });
  render(chartEditorToolbar(), root);
  assert.equal(root.querySelector('[data-code-guide-key="canvas.width"]'), width);
  assert.equal(width.value, "60.9", "typing survives unrelated rerenders");

  const change = () => width.dispatchEvent(new Event("change", { bubbles: true }));
  change();
  assert.deepEqual([state.GLOBAL_STATE.canvasWidth, width.value], [60, "60"]);
  width.stepUp();
  change();
  assert.deepEqual([state.GLOBAL_STATE.canvasWidth, width.value], [61, "61"]);
  width.value = "999";
  change();
  assert.deepEqual([state.GLOBAL_STATE.canvasWidth, width.value], [500, "500"]);

  const emptyHeight = { value: "" };
  commitDimension("height", emptyHeight);
  assert.deepEqual([state.GLOBAL_STATE.canvasHeight, emptyHeight.value], [5, "5"]);
  let blurred = 0;
  handleDimensionKeydown({ key: "Enter", currentTarget: { blur: () => blurred++ } });
  handleDimensionKeydown({ key: "x", currentTarget: { blur: () => blurred++ } });
  assert.equal(blurred, 1);

  const styles = fs.readFileSync("styles.css", "utf8");
  for (const selector of [
    ".pattern-dimension-input",
    ".pattern-dimension-input:focus",
    ".pattern-dimension-input:active",
    ".pattern-dimension-input:invalid",
  ]) {
    assert.match(cssBlock(styles, selector), /color:\s*#111/);
  }
  assert.match(cssBlock(styles, '.pattern-dimension-input[type="number"]'), /appearance:\s*auto/);
} finally {
  await server.close();
  dom?.window.close();
  for (const [name, descriptor] of previousGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}

console.log("PASS: stitch controls and black dimension inputs share the top toolbar.");
