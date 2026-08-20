// 作者：FEDZ_SuZhou_Liuchen
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

const read = (file) => fs.readFileSync(file, "utf8");
const expectedIconHashes = {
  "src/assets/symbols/knit.svg":
    "9d4a80404ac5dc4c664cef37484116afdba383707c63fa5b0f5e57a771c147df",
  "src/assets/symbols/purl.svg":
    "6e5c9b8fb3d12d9083ff64c2599c55409c30313c8c239c3254b9121aaf3ceae6",
  "src/assets/symbols/slip.svg":
    "a4eaf85021f58ec6c666f8f523c3df786b78611fe2708379b3372f501adde769",
  "src/assets/symbols/tuck.svg":
    "d60a8e834c7a42f8534b25c55fc859269f36e4777a48963878357cdc418618ca",
};

for (const [file, expectedHash] of Object.entries(expectedIconHashes)) {
  const normalized = read(file).replace(/\r\n/g, "\n");
  const actualHash = crypto
    .createHash("sha256")
    .update(normalized, "utf8")
    .digest("hex");
  assert.equal(actualHash, expectedHash, `${file} must remain unchanged.`);
}

const toolbar = read("src/views/chartEditorToolbar.js");
const actions = read("src/actions/patternEditing.js");
const view = read("src/views/view.js");
const leftBar = read("src/views/leftBar.js");
const styles = read("styles.css");

assert.match(view, /chartEditorToolbar\(\)/);
assert.equal((toolbar.match(/data-code-guide-key="stitch\.symbol"/g) || []).length, 1);
assert.match(toolbar, /selectPatternSymbol\(index\)/);
assert.match(
  actions,
  /export function selectPatternSymbol[\s\S]*?activeSymbol:\s*symbolIndex,[\s\S]*?activeTool:\s*"brush"/
);
for (const asset of ["knit.svg", "purl.svg", "slip.svg", "tuck.svg"]) {
  assert.match(toolbar, new RegExp(asset.replace(".", "\\.")));
}
assert.match(toolbar, /import\s*\{[\s\S]*?resizePatternCanvas[\s\S]*?\}\s*from\s*["']\.\.\/actions\/patternEditing\.js["']/);
assert.match(toolbar, /export function commitDimension\s*\(\s*field\s*,\s*input\s*\)\s*\{[\s\S]*?resizePatternCanvas\([\s\S]*?input\.value[\s\S]*?input\.value\s*=\s*String\(GLOBAL_STATE\[/);
assert.match(toolbar, /class="chart-size-controls"/);
assert.equal((toolbar.match(/class="input pattern-dimension-input"/g) || []).length, 2);
for (const [field, label] of [
  ["width", "taskbar.width"],
  ["height", "taskbar.height"],
]) {
  assert.match(toolbar, new RegExp(`data-code-guide-key="canvas\\.${field}"`));
  assert.match(toolbar, new RegExp(`t\\("${label}", language\\)`));
  assert.match(
    toolbar,
    new RegExp(`commitDimension\\("${field}", event\\.currentTarget\\)`)
  );
}
assert.equal((toolbar.match(/type="number"/g) || []).length, 2);
assert.equal((toolbar.match(/min="5"/g) || []).length, 2);
assert.equal((toolbar.match(/max="500"/g) || []).length, 2);
assert.equal((toolbar.match(/step="1"/g) || []).length, 2);
assert.match(toolbar, /\.value=\$\{String\(GLOBAL_STATE\.canvasWidth\)\}/);
assert.match(toolbar, /\.value=\$\{String\(GLOBAL_STATE\.canvasHeight\)\}/);
assert.match(toolbar, /export function handleDimensionKeydown[\s\S]*?event\.key\s*===\s*["']Enter["'][\s\S]*?blur\(\)/);
assert.equal((toolbar.match(/@keydown=\$\{handleDimensionKeydown\}/g) || []).length, 2);
const stitchButtonsEnd = toolbar.indexOf(
  "</div>",
  toolbar.indexOf("GLOBAL_STATE.symbolMap.map")
);
const sizeControlsStart = toolbar.indexOf('class="chart-size-controls"');
assert.ok(sizeControlsStart > toolbar.indexOf('class="chart-stitch-buttons"'));
assert.ok(sizeControlsStart > stitchButtonsEnd, "size controls must follow all stitch buttons");
assert.doesNotMatch(leftBar, /symbolPicker|SYMBOL_ICON_URLS|left\.addRepeat/);
assert.match(styles, /--preview-background:\s*#4a5055/);
assert.match(styles, /--accent:\s*#a96882/);
assert.match(styles, /\.chart-size-controls\s*\{[\s\S]*?display:\s*flex/);
assert.match(styles, /\.pattern-dimension-input\s*\{[\s\S]*?color:\s*#111/);
assert.match(styles, /\.pattern-dimension-input:focus[\s\S]*?color:\s*#111/);
assert.match(styles, /\.pattern-dimension-input:active[\s\S]*?color:\s*#111/);
assert.match(styles, /\.pattern-dimension-input:invalid[\s\S]*?color:\s*#111/);
assert.match(styles, /\.pattern-dimension-input::selection\s*\{[\s\S]*?color:\s*(?:#111|black)/);
assert.match(styles, /\.pattern-dimension-input\[type="number"\]\s*\{[\s\S]*?(?:-webkit-appearance:\s*auto|appearance:\s*auto)/);
assert.match(styles, /\.pattern-dimension-input\[type="number"\]::\-webkit-inner-spin-button,[\s\S]*?\.pattern-dimension-input\[type="number"\]::\-webkit-outer-spin-button\s*\{[\s\S]*?-webkit-appearance:\s*auto[\s\S]*?opacity:\s*1/);
assert.doesNotMatch(styles, /\.needle-inputs\s*\{[\s\S]*?order:\s*3/);
assert.match(styles, /@media\s*\(max-width:\s*1080px\)[\s\S]*?\.needle-inputs\s*\{[\s\S]*?grid-template-columns:\s*1fr/);

globalThis.Path2D = class {};
const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
let previousDomGlobals = new Map();

try {
  const { window } = new JSDOM(
    "<!doctype html><html><body><div id=\"toolbar-root\"></div></body></html>"
  );
  const domGlobals = [
    "window",
    "document",
    "Node",
    "Element",
    "HTMLElement",
    "Event",
    "CustomEvent",
  ];
  previousDomGlobals = new Map(
    domGlobals.map((name) => [name, globalThis[name]])
  );
  for (const name of domGlobals) globalThis[name] = window[name];
  const state = await server.ssrLoadModule("/src/state.js");
  const { chartEditorToolbar, commitDimension, handleDimensionKeydown } =
    await server.ssrLoadModule("/src/views/chartEditorToolbar.js");
  const { render } = await server.ssrLoadModule(
    "/node_modules/lit-html/lit-html.js"
  );
  let stateSynchronizations = 0;
  state.StateMonitor.register([
    () => ({
      syncState() {
        stateSynchronizations += 1;
      },
    }),
  ]);

  state.loadWorkspace({ canvasWidth: 60, canvasHeight: 60 });
  const toolbarRoot = document.querySelector("#toolbar-root");
  render(chartEditorToolbar(), toolbarRoot);
  const widthInput = toolbarRoot.querySelector(
    'input[data-code-guide-key="canvas.width"]'
  );
  assert.ok(widthInput, "toolbar must render a real width input");
  widthInput.value = "60.9";
  state.dispatch({ grid: !state.GLOBAL_STATE.grid });
  render(chartEditorToolbar(), toolbarRoot);
  assert.equal(
    toolbarRoot.querySelector('input[data-code-guide-key="canvas.width"]'),
    widthInput,
    "unrelated renders must preserve the width input element"
  );
  assert.equal(widthInput.value, "60.9");

  const dispatchDimensionChange = (input) => {
    const event = new window.Event("change", { bubbles: true });
    input.dispatchEvent(event);
  };
  let observedCurrentTarget = null;
  widthInput.addEventListener("change", (event) => {
    observedCurrentTarget = event.currentTarget;
  });
  dispatchDimensionChange(widthInput);
  assert.equal(observedCurrentTarget, widthInput);
  assert.equal(state.GLOBAL_STATE.canvasWidth, 60);
  assert.equal(widthInput.value, "60");
  widthInput.value = "999";
  dispatchDimensionChange(widthInput);
  assert.equal(state.GLOBAL_STATE.canvasWidth, 500);
  assert.equal(widthInput.value, "500");

  for (const { field, value, expected } of [
    { field: "width", value: "60.8", expected: 60 },
    { field: "height", value: "", expected: 5 },
    { field: "width", value: "4", expected: 5 },
    { field: "height", value: "501", expected: 500 },
  ]) {
    const input = { value };
    commitDimension(field, input);
    const stateField = field === "width" ? "canvasWidth" : "canvasHeight";
    assert.equal(state.GLOBAL_STATE[stateField], expected);
    assert.equal(input.value, String(expected));
  }

  state.loadWorkspace({ canvasWidth: 60, canvasHeight: 60 });
  stateSynchronizations = 0;
  let blurCount = 0;
  const enterInput = {
    value: "77",
    blur() {
      blurCount += 1;
      commitDimension("width", this);
    },
  };
  handleDimensionKeydown({ key: "Enter", currentTarget: enterInput });
  assert.equal(blurCount, 1);
  assert.equal(stateSynchronizations, 1);
  assert.equal(state.GLOBAL_STATE.canvasWidth, 77);
  assert.equal(enterInput.value, "77");

  handleDimensionKeydown({
    key: "x",
    currentTarget: { blur: () => assert.fail("non-Enter must not blur") },
  });

} finally {
  await server.close();
  for (const [name, value] of previousDomGlobals) {
    if (value === undefined) delete globalThis[name];
    else globalThis[name] = value;
  }
}

console.log("PASS: the shared stitch toolbar and original icons are protected.");
