import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

const browserGlobals = [
  "window",
  "document",
  "Document",
  "Node",
  "HTMLElement",
  "customElements",
  "devicePixelRatio",
  "Path2D",
];
const previousGlobals = new Map(
  browserGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
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
  assert.equal(interaction.dataset.fullField, `${prefix}Bitmap`);
  assert.equal(interaction.dataset.unitField, `${prefix}UnitBitmap`);
  assert.equal(interaction.dataset.patternField, undefined);
  assert.equal(stack.querySelector("#yarn-color-canvas"), null);
}

function cssRules(source) {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].split(",").map((selector) => selector.trim()),
    declarations: match[2],
  }));
}

function declarationBlocksFor(source, selector) {
  const blocks = cssRules(source)
    .filter((candidate) => candidate.selectors.includes(selector))
    .map((candidate) => candidate.declarations);
  assert.ok(blocks.length > 0, `CSS rule for ${selector} exists`);
  return blocks;
}

function assertDeclaration(source, selector, declaration) {
  assert.ok(
    declarationBlocksFor(source, selector).some((block) => declaration.test(block)),
    `${selector} owns ${declaration}`
  );
}

function assertLayoutCss(source) {
  assertDeclaration(source, ".pattern-editor-viewport", /overflow:\s*hidden\b/);
  assertDeclaration(source, ".pattern-editor-stage", /display:\s*grid\b/);
  assertDeclaration(
    source,
    ".pattern-editor-stage",
    /grid-template-columns:\s*var\(--chart-cell-size\)\s+minmax\(0,\s*1fr\)/
  );
  assertDeclaration(source, ".yarn-sequence-gutter", /overflow:\s*hidden\b/);
  assertDeclaration(
    source,
    ".yarn-sequence-gutter",
    /width:\s*var\(--chart-cell-size\)/
  );
  assertDeclaration(source, ".yarn-sequence-gutter", /border-right:\s*[^;]+;/);
  assertDeclaration(source, ".yarn-sequence-gutter", /z-index:\s*\d+/);
  assertDeclaration(source, ".pattern-grid-window", /overflow:\s*hidden\b/);
  assertDeclaration(source, ".pattern-grid-window", /position:\s*relative\b/);
  assertDeclaration(source, ".yarn-sequence-track", /position:\s*absolute\b/);
  assertDeclaration(source, ".yarn-sequence-track", /will-change:\s*transform\b/);
  assertDeclaration(source, ".pattern-canvas-transform", /position:\s*absolute\b/);
  assertDeclaration(
    source,
    ".pattern-canvas-transform",
    /will-change:\s*transform\b/
  );
  assertDeclaration(source, ".pattern-canvas-stack", /position:\s*relative\b/);
  assertDeclaration(source, ".pattern-symbol-canvas", /z-index:\s*1\b/);
  assertDeclaration(source, ".pattern-symbol-canvas", /pointer-events:\s*none\b/);
  assertDeclaration(source, ".pattern-grid-canvas", /z-index:\s*2\b/);
  assertDeclaration(source, ".pattern-grid-canvas", /pointer-events:\s*none\b/);
  assertDeclaration(source, ".pattern-unit-symbol-canvas", /z-index:\s*3\b/);
  assertDeclaration(source, ".pattern-unit-symbol-canvas", /pointer-events:\s*none\b/);
  assertDeclaration(source, ".pattern-unit-grid-canvas", /z-index:\s*4\b/);
  assertDeclaration(source, ".pattern-unit-grid-canvas", /pointer-events:\s*none\b/);
  assertDeclaration(source, ".pattern-interaction-canvas", /z-index:\s*[4-9]/);
  assertDeclaration(source, ".pattern-interaction-canvas", /touch-action:\s*none\b/);
  assert.doesNotMatch(source, /\.pattern-canvas-row\s*\{/);
  assert.doesNotMatch(source, /#needle-yarn-sequence\s*\{/);
}

function withoutDeclaration(source, selector, property) {
  let removed = false;
  const result = source.replace(/([^{}]+)\{([^{}]*)\}/g, (rule, selectors, declarations) => {
    if (!selectors.split(",").map((item) => item.trim()).includes(selector)) {
      return rule;
    }
    const nextDeclarations = declarations.replace(
      new RegExp(`\\s*${property}\\s*:\\s*[^;]+;`),
      ""
    );
    removed ||= nextDeclarations !== declarations;
    return `${selectors}{${nextDeclarations}}`;
  });
  assert.ok(removed, `removed ${property} from ${selector}`);
  return result;
}

let server;
let dom;
try {
  server = await createServer({
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  dom = new JSDOM("<!doctype html><html><body></body></html>");
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
  const ids = [...host.querySelectorAll("[id]")].map((element) => element.id);
  assert.equal(new Set(ids).size, ids.length, "editor IDs are globally unique");
} finally {
  try {
    if (server) await server.close();
  } finally {
    try {
      if (dom) dom.window.close();
    } finally {
      for (const [name, descriptor] of previousGlobals) {
        if (descriptor) {
          Object.defineProperty(globalThis, name, descriptor);
        } else {
          delete globalThis[name];
        }
      }
    }
  }
}

const styles = fs.readFileSync("styles.css", "utf8");
const viewSource = fs.readFileSync("src/views/view.js", "utf8");
assertLayoutCss(styles);
assert.doesNotMatch(viewSource, /showYarn:\s*true/);
assert.doesNotMatch(
  declarationBlocksFor(styles, ".pattern-canvas-stack").join("\n"),
  /flex:\s*none\b/
);

const stylesWithoutGutterZIndex = withoutDeclaration(
  styles,
  ".yarn-sequence-gutter",
  "z-index"
);
assert.match(
  stylesWithoutGutterZIndex,
  /\.yarn-sequence-gutter\s*\{[\s\S]*?border-right:[\s\S]*?z-index:/,
  "the prior cross-rule regex would have accepted z-index from a later rule"
);
assert.throws(
  () => assertLayoutCss(stylesWithoutGutterZIndex),
  /\.yarn-sequence-gutter owns \/z-index/
);
assert.throws(
  () =>
    assertLayoutCss(
      withoutDeclaration(styles, ".yarn-sequence-gutter", "overflow")
    ),
  /\.yarn-sequence-gutter owns \/overflow/
);

console.log("PASS: repeat editor uses a clipped grid stage with an independent yarn gutter.");
