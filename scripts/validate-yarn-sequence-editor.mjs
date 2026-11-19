import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "vite";

const root = process.cwd();
const failures = [];

function read(file) {
  return fs
    .readFileSync(path.join(root, file), "utf8")
    .replace(/\r\n/g, "\n");
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const helperPath = "src/actions/yarnSequenceRows.js";
const paletteEditingHelperPath = "src/actions/yarnPaletteEditing.js";
const leftBarSource = [
  read("src/views/leftBar.js"),
  read("src/views/yarnPicker.js"),
].join("\n");
const repeatDimensionsSource = read("src/actions/repeatDimensions.js");
const repeatPointerSource = read("src/events/repeatPointerInteraction.js");
const repeatTouchSource = read("src/events/repeatTouchInteraction.js");
const colorSequencePointerSource = read(
  "src/events/colorSequencePointerInteraction.js"
);
const colorSequenceTouchSource = read(
  "src/events/colorSequenceTouchInteraction.js"
);
const importersSource = read("src/actions/importers.js");
const stateSource = read("src/state.js");
const viewSource = read("src/views/view.js");
const yarnSequenceCanvasSource = read("src/components/yarnSequenceCanvas.js");
const runSimulationSource = read("src/components/runSimulation.js");
const yarnSimulationSource = [
  "src/simulation/yarnSimulation.js",
  "src/simulation/yarnPathGeometry.js",
  "src/simulation/drawYarnSimulation.js",
]
  .map(read)
  .join("\n");
const exportersSource = read("src/actions/exporters.js");
const translationsSource = read("src/i18n/translations.js");

expect(exists(helperPath), `${helperPath} must exist.`);
expect(
  exists(paletteEditingHelperPath),
  `${paletteEditingHelperPath} must exist.`
);

for (const snippet of [
  "function updateYarnSequenceRows",
  "function yarnSequenceControls",
  "resizeYarnSequenceRows",
  "yarn-sequence-add-row",
  "yarn-sequence-remove-row",
  "yarn-sequence-row-count",
]) {
  expect(
    !leftBarSource.includes(snippet),
    `leftBar must remove button-style yarn sequence controls: ${snippet}.`
  );
}

expect(
  viewSource.includes('id="yarn-sequence"') &&
    viewSource.includes('id="yarn-sequence-canvas"'),
  "main chart view must keep the editable yarn sequence canvas."
);

expect(
  !leftBarSource.includes('<button\n          class="btn solid color-select'),
  "color-select must not be a parent button wrapping the color edit button."
);

expect(
  leftBarSource.includes('<div\n          class="btn solid color-select') &&
    leftBarSource.includes('class="color-label-button"'),
  "yarn color row must be a container with a separate number/select button."
);

expect(
  !/class="btn solid color-select[\s\S]*?@click=\$\{\(\) => \{[\s\S]*?editColor\(index\);\s*\}\}>/.test(
    leftBarSource
  ),
  "clicking the yarn number/select button must select activeYarn without opening the color editor."
);

expect(
  leftBarSource.includes("@click=${() => dispatch({ activeYarn: index })}") ||
    leftBarSource.includes("@click=${() => {\n            dispatch({ activeYarn: index });\n          }}"),
  "color-select parent click must only select the active yarn."
);

expect(
  leftBarSource.includes("class=\"edit-color-btn\"") &&
    leftBarSource.includes("class=\"edit-color-icon\"") &&
    leftBarSource.includes("e.stopPropagation();\n                dispatch({ activeYarn: index });\n                editColor(index);"),
  "right-side yarn color swatch controls must still open the color editor."
);

expect(
  leftBarSource.includes("updateYarnPaletteColor") &&
    !leftBarSource.includes(
      "yarnPalette: newPalette,\n          yarnSequence: GLOBAL_STATE.yarnSequence"
    ),
  "editing a yarn color must preserve existing sequence cells instead of repainting them through the shared palette index."
);

expect(
  yarnSequenceCanvasSource.includes("drawYarnSequenceGrid") &&
    yarnSequenceCanvasSource.includes("ctx.moveTo") &&
    yarnSequenceCanvasSource.includes("ctx.lineTo") &&
    yarnSequenceCanvasSource.includes("y * scale"),
  "yarn sequence canvas must draw horizontal grid lines at one chart-row height."
);

expect(
  repeatDimensionsSource.includes("resizeYarnSequenceToChartHeight") &&
    repeatDimensionsSource.includes("yarnSequence:"),
  "resizeChartArea must synchronize yarnSequence to chart.height."
);

const chartResizeForRepeatSource =
  repeatDimensionsSource.match(
    /export function chartResizeForRepeat[\s\S]*?^}/m
  )?.[0] || "";

expect(
  chartResizeForRepeatSource.includes("resizeYarnSequenceToChartHeight") &&
    chartResizeForRepeatSource.includes("yarnSequence:"),
  "repeat boundary resize must synchronize yarnSequence through chartResizeForRepeat."
);

expect(
  repeatPointerSource.includes("chartResizeForRepeat") &&
    repeatTouchSource.includes("chartResizeForRepeat"),
  "pointer and touch repeat boundary resizing must use chartResizeForRepeat."
);

for (const [sourceName, source] of [
  ["pointer", colorSequencePointerSource],
  ["touch", colorSequenceTouchSource],
]) {
  expect(
    source.includes("beginTexturePreviewInteraction") &&
      source.includes("endTexturePreviewInteraction"),
    `color sequence ${sourceName} editing must use fast texture preview while dragging.`
  );
}

expect(
  importersSource.includes("normalizeYarnSequence") &&
    importersSource.includes("height: chart.height"),
  "JSON import must normalize yarnSequence to the imported chart.height."
);

expect(
  /yarnSequence:\s*new Bimp\(1,\s*60/.test(stateSource) ||
    /yarnSequence:\s*Bimp\.empty\(1,\s*60/.test(stateSource),
  "default yarnSequence height must match the default chart height of 60."
);

expect(
  runSimulationSource.includes("GLOBAL_STATE.yarnSequence,"),
  "right preview must pass the full yarnSequence object, not only pixels."
);

for (const snippet of [
  "yarnIndexForSequenceRow",
  "link.row",
  "rowYarnPly",
  "palette[paletteIndex]",
]) {
  expect(
    yarnSimulationSource.includes(snippet),
    `right preview must apply yarnSequence per row: missing ${snippet}.`
  );
}

expect(
  exportersSource.includes("yarnSequence: GLOBAL_STATE.yarnSequence.toJSON()"),
  "JSON export must include yarnSequence."
);

for (const code of ["zh-CN", "zh-TW", "en", "vi"]) {
  expect(
    new RegExp(`["']?${code}["']?\\s*:`).test(translationsSource),
    `translations must include ${code}.`
  );
}

if (exists(helperPath)) {
  const helpers = await import(pathToFileURL(path.join(root, helperPath)).href);
  const { Bimp } = await import(
    pathToFileURL(path.join(root, "src/lib/Bimp.js")).href
  );

  expect(
    typeof helpers.normalizeYarnSequence === "function",
    "normalizeYarnSequence must be exported."
  );
  expect(
    typeof helpers.resizeYarnSequenceToChartHeight === "function",
    "resizeYarnSequenceToChartHeight must be exported."
  );
  expect(
    typeof helpers.yarnIndexForSequenceRow === "function",
    "yarnIndexForSequenceRow must be exported."
  );

  if (
    typeof helpers.normalizeYarnSequence === "function" &&
    typeof helpers.resizeYarnSequenceToChartHeight === "function"
  ) {
    const base = new Bimp(1, 2, [0, 1]);
    const grown = helpers.resizeYarnSequenceToChartHeight(base, 5, 2, 3);
    expect(grown.width === 1, "sequence width must remain one yarn selector column.");
    expect(grown.height === 5, "sequence height must grow to chart.height.");
    expect(
      Array.from(grown.pixels).join(",") === "0,1,2,2,2",
      "added chart-height rows must be filled with the current active yarn."
    );

    const reduced = helpers.resizeYarnSequenceToChartHeight(grown, 1, 0, 3);
    expect(reduced.height === 1, "sequence height must shrink to chart.height.");
    expect(
      Array.from(reduced.pixels).join(",") === "0",
      "shrinking must preserve the first existing sequence row."
    );

    const missing = helpers.normalizeYarnSequence(undefined, { height: 4 });
    expect(
      missing.width === 1 &&
        missing.height === 4 &&
        Array.from(missing.pixels).join(",") === "0,0,0,0",
      "missing imported yarnSequence must normalize to chart.height rows of yarn 0."
    );

    const wide = helpers.normalizeYarnSequence(
      {
        width: 2,
        height: 3,
        pixels: [0, 9, 1, 9, 2, 9],
      },
      { height: 3 }
    );
    expect(
      wide.width === 1 &&
        wide.height === 3 &&
        Array.from(wide.pixels).join(",") === "0,1,2",
      "wide imported yarnSequence must keep only the first column for each row."
    );
  }
}

if (exists(paletteEditingHelperPath)) {
  const paletteHelpers = await import(
    pathToFileURL(path.join(root, paletteEditingHelperPath)).href
  );
  const { Bimp } = await import(
    pathToFileURL(path.join(root, "src/lib/Bimp.js")).href
  );

  expect(
    typeof paletteHelpers.updateYarnPaletteColor === "function",
    "updateYarnPaletteColor must be exported."
  );

  if (typeof paletteHelpers.updateYarnPaletteColor === "function") {
    const yarnSequence = new Bimp(1, 4, [0, 0, 1, 0]);
    const updatedFirst = paletteHelpers.updateYarnPaletteColor({
      yarnPalette: ["old-first", "second"],
      yarnSequence,
      index: 0,
      color: "new-first",
    });

    expect(
      updatedFirst.yarnPalette[0] === "new-first",
      "editing the first yarn color must update the first swatch for future painting."
    );
    expect(
      updatedFirst.yarnPalette.includes("old-first"),
      "editing a used yarn color must keep the old color available for existing sequence cells."
    );
    expect(
      Array.from(updatedFirst.yarnSequence.pixels).join(",") === "2,2,1,2",
      "editing the first yarn color must remap existing first-color cells to the preserved old color."
    );
    expect(
      updatedFirst.activeYarn === 0,
      "editing the first yarn color must keep future painting on the edited swatch."
    );

    const unusedEdit = paletteHelpers.updateYarnPaletteColor({
      yarnPalette: ["first", "second", "unused"],
      yarnSequence: new Bimp(1, 3, [0, 1, 0]),
      index: 2,
      color: "new-unused",
    });
    expect(
      Array.from(unusedEdit.yarnSequence.pixels).join(",") === "0,1,0",
      "editing an unused yarn color must not change the yarn sequence."
    );
    expect(
      unusedEdit.yarnPalette.join(",") === "first,second,new-unused",
      "editing an unused yarn color must not add a preserved legacy color."
    );
  }
}

globalThis.Path2D =
  globalThis.Path2D ||
  class {
    moveTo() {}
    lineTo() {}
    quadraticCurveTo() {}
    bezierCurveTo() {}
    closePath() {}
    rect() {}
  };

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const stateModule = await server.ssrLoadModule("/src/state.js");
  const { chartResizeForRepeat } = await server.ssrLoadModule(
    "/src/actions/repeatDimensions.js"
  );
  const { Bimp } = await server.ssrLoadModule("/src/lib/Bimp.js");

  stateModule.loadWorkspace({
    activeYarn: 2,
    yarnPalette: ["first", "second", "third"],
    chart: Bimp.empty(48, 60, 0),
    yarnSequence: new Bimp(1, 60, Array(60).fill(0)),
    repeats: [
      {
        bitmap: Bimp.empty(4, 8, 0),
        area: [48, 60],
        pos: [0, 0],
      },
    ],
  });

  const boundaryGrow = chartResizeForRepeat(0, [60, 80]);
  expect(
    boundaryGrow.chart?.height === 80,
    "chartResizeForRepeat must return a chart resized to the boundary height."
  );
  expect(
    boundaryGrow.yarnSequence?.width === 1 &&
      boundaryGrow.yarnSequence?.height === 80,
    "chartResizeForRepeat must grow yarnSequence to the boundary height."
  );
  expect(
    Array.from(boundaryGrow.yarnSequence?.pixels || []).slice(60).every((pixel) => pixel === 2),
    "boundary-grown yarnSequence rows must be filled with the current active yarn."
  );

  stateModule.loadWorkspace({
    activeYarn: 1,
    chart: Bimp.empty(48, 80, 0),
    yarnSequence: new Bimp(1, 80, Array.from({ length: 80 }, (_, index) => index % 2)),
    repeats: [
      {
        bitmap: Bimp.empty(4, 8, 0),
        area: [48, 80],
        pos: [0, 0],
      },
    ],
  });

  const boundaryShrink = chartResizeForRepeat(0, [48, 40]);
  expect(
    boundaryShrink.yarnSequence?.height === 40,
    "chartResizeForRepeat must shrink yarnSequence to the boundary height."
  );
  expect(
    Array.from(boundaryShrink.yarnSequence?.pixels || []).join(",") ===
      Array.from({ length: 40 }, (_, index) => index % 2).join(","),
    "boundary-shrunk yarnSequence must preserve the leading rows."
  );

  const nonPrimaryBoundary = chartResizeForRepeat(1, [48, 90]);
  expect(
    !("chart" in nonPrimaryBoundary) && !("yarnSequence" in nonPrimaryBoundary),
    "non-primary repeat boundary changes must not resize chart or yarnSequence."
  );
} finally {
  await server.close();
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}

console.log("PASS: yarn sequence editor is row-aligned with the chart.");
