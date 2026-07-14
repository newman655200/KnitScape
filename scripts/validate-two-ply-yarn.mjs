import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const readIfExists = (file) =>
  fs.existsSync(path.join(root, file)) ? read(file) : "";

const packageJSON = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(
  packageJSON.scripts["validate:two-ply-yarn"],
  "node scripts/validate-two-ply-yarn.mjs",
  "package.json must expose validate:two-ply-yarn."
);

const stateSource = fs.readFileSync("src/state.js", "utf8");
assert.match(stateSource, /yarnPlies/, "GLOBAL_STATE must include yarnPlies.");
assert.match(
  stateSource,
  /SNAPSHOT_FIELDS/,
  "state must continue to use SNAPSHOT_FIELDS."
);

const constantsSource = fs.readFileSync("src/constants.js", "utf8");
assert.match(
  constantsSource,
  /"yarnPlies"/,
  "SNAPSHOT_FIELDS must include yarnPlies for undo snapshots."
);
assert.match(
  constantsSource,
  /DEFAULT_YARN_PLIES/,
  "constants must define DEFAULT_YARN_PLIES."
);
assert.match(
  constantsSource,
  /TEXTURE_PERFORMANCE_MODES/,
  "constants must define texture preview performance modes."
);
assert.match(
  constantsSource,
  /YARN_TEXTURE_SIZES/,
  "constants must define yarn texture size presets."
);

const exporterSource = fs.readFileSync("src/actions/exporters.js", "utf8");
assert.match(exporterSource, /yarnPlies/, "JSON export must include yarnPlies.");

const importerSource = fs.readFileSync("src/actions/importers.js", "utf8");
assert.match(
  importerSource,
  /DEFAULT_YARN_PLIES/,
  "importer must fall back to DEFAULT_YARN_PLIES for older files."
);

const runSimulationSource = fs.readFileSync("src/components/runSimulation.js", "utf8");
assert.match(
  runSimulationSource,
  /GLOBAL_STATE\.yarnPlies/,
  "single-face simulation must receive yarnPlies."
);
assert.match(
  runSimulationSource,
  /"yarnPlies"/,
  "simulation must rerun when yarnPlies change."
);
assert.match(
  runSimulationSource,
  /texturePerformanceMode/,
  "simulation runner must pass texture performance mode to the preview."
);
assert.match(
  runSimulationSource,
  /texturePreviewInteractionActive/,
  "simulation runner must pass texture interaction state to the preview."
);

const simulationSource = fs.readFileSync("src/simulation/yarnSimulation.js", "utf8");
assert.match(
  simulationSource,
  /yarnPlies/,
  "yarn simulation must accept yarnPlies."
);
assert.match(
  simulationSource,
  /diameter/,
  "yarn simulation must use ply diameters."
);
assert.match(
  simulationSource,
  /enabled/,
  "yarn simulation must respect disabled plies."
);
assert.match(
  simulationSource,
  /sequenceMaskColor/,
  "yarn sequence colors must be carried as an overlay mask, not replace yarn ply colors."
);
assert.doesNotMatch(
  simulationSource,
  /color:\s*sequenceColor/,
  "yarn sequence colors must not replace the first/second yarn base colors."
);

const yarnTextureSource = readIfExists("src/yarnTexture/yarnScanTexture.js");
const yarnTextureBrushSource = readIfExists("src/simulation/yarnTextureBrush.js");

assert.match(
  yarnTextureSource,
  /processYarnScanFile/,
  "scan texture module must expose processYarnScanFile."
);
assert.match(
  yarnTextureSource,
  /normalizeYarnTexture/,
  "scan texture module must expose normalizeYarnTexture."
);
assert.match(
  yarnTextureSource,
  /processedDataUrl/,
  "scan texture module must produce processedDataUrl for JSON persistence."
);
assert.match(
  yarnTextureSource,
  /enabled/,
  "scan texture module must normalize a per-yarn texture enabled flag."
);
assert.match(
  yarnTextureSource,
  /maxSize/,
  "scan texture module must normalize and apply a processed texture maxSize."
);
for (const token of [
  "readFileAsDataUrl",
  "loadImageFromDataUrl",
  "processYarnScanDataUrl",
  "findContentBounds",
  "createTintedTextureCanvas",
]) {
  assert.match(
    yarnTextureSource,
    new RegExp(token),
    `scan texture module must include ${token}.`
  );
}
assert.match(
  yarnTextureBrushSource,
  /drawYarnTexturePath/,
  "texture brush module must expose drawYarnTexturePath."
);
assert.match(
  yarnTextureBrushSource,
  /renderTextures/,
  "texture brush must allow solid-color fallback while keeping texture data."
);
assert.match(
  yarnTextureBrushSource,
  /textureStrength/,
  "texture brush must honor textureStrength."
);
assert.match(
  yarnTextureBrushSource,
  /fuzzStrength/,
  "texture brush must honor fuzzStrength."
);
assert.match(
  yarnTextureBrushSource,
  /sequenceMaskColor/,
  "texture brush must draw yarn sequence colors as a mask above the base yarn color."
);
assert.match(
  yarnTextureBrushSource,
  /drawYarnSequenceMaskPath/,
  "texture brush must expose a reusable path-level sequence mask renderer."
);
assert.match(
  simulationSource,
  /drawBatchedSequenceMasks/,
  "yarn simulation must batch sequence mask paths by layer, ply, and color."
);
assert.match(
  simulationSource,
  /drawYarnTexturePath/,
  "yarn simulation must render yarn plies through the texture brush."
);
assert.match(
  simulationSource,
  /prepareYarnTextureImages/,
  "yarn simulation must preload scanned yarn textures."
);
assert.match(
  simulationSource,
  /texturePerformanceMode/,
  "yarn simulation must receive the current texture performance mode."
);
assert.match(
  simulationSource,
  /texturePreviewInteractionActive/,
  "yarn simulation must receive the auto-mode interaction flag."
);
assert.match(
  fs.readFileSync("src/events/simulationPointerInteraction.js", "utf8"),
  /beginTexturePreviewInteraction|endTexturePreviewInteraction/,
  "simulation pointer interactions must trigger auto texture preview fallback."
);
assert.match(
  fs.readFileSync("src/events/simulationTouchInteraction.js", "utf8"),
  /beginTexturePreviewInteraction|endTexturePreviewInteraction/,
  "simulation touch interactions must trigger auto texture preview fallback."
);
assert.match(
  importerSource,
  /normalizeYarnPly/,
  "JSON import must normalize yarn ply scan texture fields."
);
assert.match(
  importerSource,
  /texture/,
  "JSON import must preserve yarn ply scan texture fields."
);
assert.match(
  exporterSource,
  /yarnPlies:\s*GLOBAL_STATE\.yarnPlies/,
  "JSON export must continue persisting yarnPlies including scan textures."
);

const leftBarSource = fs.readFileSync("src/views/leftBar.js", "utf8");
const translationsSource = fs.readFileSync("src/i18n/translations.js", "utf8");
for (const [key, label, message] of [
  ["left.yarnPlyPanel", "双纱参数", "left sidebar must show a prominent two-yarn parameter panel."],
  ["yarnPly.firstTitle", "第一支纱线", "left sidebar must expose the first yarn controls."],
  ["yarnPly.secondTitle", "第二支纱线", "left sidebar must expose the second yarn controls."],
  ["yarnPly.firstColor", "第一支纱线颜色", "left sidebar must expose the first yarn fixed color."],
  ["yarnPly.secondColor", "第二支纱线颜色", "left sidebar must expose the second yarn fixed color."],
  ["yarnPly.firstDiameter", "第一支纱线直径", "left sidebar must expose the first yarn diameter."],
  ["yarnPly.secondDiameter", "第二支纱线直径", "left sidebar must expose the second yarn diameter."],
  ["yarnPly.showSecond", "显示第二支纱线", "left sidebar must expose the second yarn toggle."],
]) {
  assert.match(leftBarSource, new RegExp(key), `${message} Source must use ${key}.`);
  assert.match(translationsSource, new RegExp(label), `${message} Translation must include ${label}.`);
}
assert.match(
  leftBarSource,
  /updateYarnPly/,
  "left sidebar must update yarnPlies immutably."
);
assert.match(
  leftBarSource,
  /editYarnPlyColor/,
  "left sidebar must allow editing yarn ply colors."
);
assert.match(
  leftBarSource,
  /class="yarn-ply-color-button"/,
  "left sidebar yarn ply colors must be clickable buttons."
);
assert.match(
  leftBarSource,
  /updateYarnPly\(index,\s*\{\s*color:/,
  "yarn ply color picker must update the selected yarnPlies color."
);
assert.match(
  leftBarSource,
  /function defaultYarnTextureOptions\(\)/,
  "left sidebar must define default texture checkbox states."
);
assert.doesNotMatch(
  leftBarSource,
  /enabledByDefault|index !== 0/,
  "both yarn scan texture and scan color checkboxes must be unchecked by default."
);
assert.match(leftBarSource, /enabled: false/, "scan texture must default disabled.");
assert.match(
  leftBarSource,
  /useOriginalColor: false/,
  "scan texture scan-color mode must default disabled."
);
assert.match(
  leftBarSource,
  /currentTexture\?\.enabled \?\? defaultTextureOptions\.enabled/,
  "scan texture import must keep the unchecked enabled default."
);
assert.match(
  leftBarSource,
  /currentTexture\?\.useOriginalColor \?\?\s+defaultTextureOptions\.useOriginalColor/,
  "scan texture import must keep the unchecked scan-color default."
);

const settingsSource = fs.readFileSync("src/views/settingsModal.js", "utf8");
assert.doesNotMatch(
  settingsSource,
  /yarnPlyControls|纱线设置|主纱颜色|副纱颜色|主纱直径|副纱直径|显示副纱/,
  "settings modal must not duplicate the two-yarn parameter controls."
);

globalThis.Path2D = class {
  constructor(path = "") {
    this.path = path;
  }

  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  closePath() {}
  rect() {}
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertClonedYarnPlies(actual, expected, messagePrefix) {
  assert.deepEqual(actual, expected, `${messagePrefix}: values should match.`);
  assert.notStrictEqual(
    actual,
    expected,
    `${messagePrefix}: array should be cloned, not shared.`
  );
  assert.notStrictEqual(
    actual[0],
    expected[0],
    `${messagePrefix}: first yarn object should be cloned, not shared.`
  );
  assert.notStrictEqual(
    actual[1],
    expected[1],
    `${messagePrefix}: second yarn object should be cloned, not shared.`
  );
}

function patternFixture(yarnPlies) {
  const fixture = {
    width: 8,
    height: 10,
    yarnPalette: ["rgba(190,190,190,1)"],
    yarnSequence: { width: 1, height: 1, pixels: [0] },
    repeats: [
      {
        bitmap: { width: 2, height: 2, pixels: [0, 0, 0, 0] },
        pos: [0, 0],
        area: [8, 10],
      },
    ],
  };

  if (yarnPlies) fixture.yarnPlies = yarnPlies;
  return fixture;
}

function createCanvasHarness() {
  const operations = [];
  const canvases = new Map();

  function createContext(layer) {
    return {
      _lineWidth: 0,
      _strokeStyle: "",
      set lineWidth(value) {
        this._lineWidth = value;
      },
      get lineWidth() {
        return this._lineWidth;
      },
      set strokeStyle(value) {
        this._strokeStyle = value;
      },
      get strokeStyle() {
        return this._strokeStyle;
      },
      clearRect() {
        operations.push({ type: "clear", layer });
      },
      stroke(path) {
        operations.push({
          type: "stroke",
          layer,
          lineWidth: this._lineWidth,
          strokeStyle: this._strokeStyle,
          path: path?.path || "",
        });
      },
    };
  }

  function createCanvas(id) {
    const canvas = {
      id,
      width: 0,
      height: 0,
      style: {},
      context: createContext(id),
      getContext(type) {
        assert.equal(type, "2d");
        return this.context;
      },
    };
    canvases.set(id, canvas);
    return canvas;
  }

  globalThis.document = {
    getElementById(id) {
      if (id == "sim-container") {
        return {
          getBoundingClientRect() {
            return { width: 900, height: 600 };
          },
        };
      }

      if (!canvases.has(id)) return createCanvas(id);
      return canvases.get(id);
    },
  };

  return { operations };
}

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  globalThis.devicePixelRatio = 1;

  const constants = await server.ssrLoadModule("/src/constants.js");
  const state = await server.ssrLoadModule("/src/state.js");
  globalThis.window = {};
  const importers = await server.ssrLoadModule("/src/actions/importers.js");
  const { Bimp } = await server.ssrLoadModule("/src/lib/Bimp.js");
  const { simulate } = await server.ssrLoadModule(
    "/src/simulation/yarnSimulation.js"
  );
  const { pathDataLength, samplePathData } = await server.ssrLoadModule(
    "/src/simulation/rowLengthLoopModel.js"
  );

  globalThis.document = {
    getElementById() {
      return {
        getBoundingClientRect() {
          return { width: 1200, height: 800 };
        },
      };
    },
  };

  assertClonedYarnPlies(
    state.GLOBAL_STATE.yarnPlies,
    constants.DEFAULT_YARN_PLIES,
    "initial GLOBAL_STATE.yarnPlies"
  );
  assert.equal(state.GLOBAL_STATE.yarnPlies.length, 2);
  assert.equal(state.GLOBAL_STATE.yarnPlies[0].enabled, true);
  assert.equal(state.GLOBAL_STATE.yarnPlies[1].enabled, false);
  assert.equal(typeof state.GLOBAL_STATE.yarnPlies[0].color, "string");
  assert.equal(typeof state.GLOBAL_STATE.yarnPlies[1].color, "string");
  assert.equal(typeof state.GLOBAL_STATE.yarnPlies[0].diameter, "number");
  assert.equal(typeof state.GLOBAL_STATE.yarnPlies[1].diameter, "number");
  assert.ok(state.GLOBAL_STATE.yarnPlies[0].diameter > 0);
  assert.ok(state.GLOBAL_STATE.yarnPlies[1].diameter > 0);

  importers.loadJSON(patternFixture());
  assertClonedYarnPlies(
    state.GLOBAL_STATE.yarnPlies,
    constants.DEFAULT_YARN_PLIES,
    "old JSON import fallback yarnPlies"
  );

  const customPlies = [
    {
      name: "main",
      color: "rgba(10,20,30,1)",
      diameter: 0.31,
      lengthScaleY: 1.05,
      enabled: true,
      texture: null,
    },
    {
      name: "companion",
      color: "rgba(200,210,220,1)",
      diameter: 0.11,
      lengthScaleY: 0.96,
      enabled: false,
      texture: null,
    },
  ];
  importers.loadJSON(patternFixture(clone(customPlies)));
  assertClonedYarnPlies(
    state.GLOBAL_STATE.yarnPlies,
    customPlies,
    "new JSON import yarnPlies"
  );

  const sampleTexture = {
    sourceType: "scan",
    fileName: "fixture-yarn.png",
    dataUrl: "data:image/png;base64,fixture",
    processedDataUrl: "data:image/png;base64,processed",
    useOriginalColor: false,
    backgroundThreshold: 0.9,
    textureStrength: 0.8,
    fuzzStrength: 0.4,
    enabled: false,
    maxSize: 512,
    pbr: {
      baseColor: null,
      normal: null,
      roughness: null,
      height: null,
      ambientOcclusion: null,
    },
  };
  const texturedPlies = [
    { ...customPlies[0], texture: sampleTexture },
    {
      ...customPlies[1],
      texture: {
        ...sampleTexture,
        fileName: "fixture-yarn-2.png",
        enabled: true,
        maxSize: 1024,
        useOriginalColor: true,
      },
    },
  ];
  importers.loadJSON(patternFixture(clone(texturedPlies)));
  assertClonedYarnPlies(
    state.GLOBAL_STATE.yarnPlies,
    texturedPlies,
    "new JSON import scanned texture yarnPlies"
  );

  importers.newPattern();
  assertClonedYarnPlies(
    state.GLOBAL_STATE.yarnPlies,
    constants.DEFAULT_YARN_PLIES,
    "newPattern yarnPlies reset"
  );

  const renderPlies = [
    {
      name: "main",
      color: "rgba(11,22,33,1)",
      diameter: 0.31,
      lengthScaleY: 1,
      enabled: true,
    },
    {
      name: "companion",
      color: "rgba(44,55,66,1)",
      diameter: 0.12,
      lengthScaleY: 1,
      enabled: true,
    },
  ];
  const renderHarness = createCanvasHarness();
  simulate(
    Bimp.empty(4, 8, 0),
    [0],
    ["rgba(250,250,250,1)"],
    1,
    renderPlies
  ).stopSim();

  const strokes = renderHarness.operations.filter((op) => op.type == "stroke");
  assert.ok(
    strokes.some((op) => op.strokeStyle == renderPlies[0].color),
    "single-face preview must draw the main fixed-color yarn."
  );
  assert.ok(
    strokes.some((op) => op.strokeStyle == renderPlies[1].color),
    "single-face preview must draw the attached second fixed-color yarn."
  );
  assert.deepEqual(
    strokes.filter((op) => op.strokeStyle == renderPlies[1].color).map((op) => op.path),
    strokes.filter((op) => op.strokeStyle == renderPlies[0].color).map((op) => op.path),
    "additional yarns must reuse Yarn 1 solved center paths."
  );
  assert.ok(
    strokes.some(
      (op) => op.strokeStyle == renderPlies[0].color && op.lineWidth > 0
    ),
    "main yarn must use a positive diameter-derived line width."
  );
  assert.ok(
    strokes.some(
      (op) =>
        op.strokeStyle == renderPlies[1].color &&
        op.lineWidth > 0 &&
        op.lineWidth <
          strokes.find((stroke) => stroke.strokeStyle == renderPlies[0].color)
            .lineWidth
    ),
    "second yarn must use its own smaller diameter-derived line width."
  );

  function renderMainPaths(lengthScaleY) {
    const harness = createCanvasHarness();
    simulate(
      Bimp.empty(4, 8, 0),
      [0],
      ["rgba(250,250,250,1)"],
      1,
      [
        { ...renderPlies[0], lengthScaleY },
        { ...renderPlies[1], lengthScaleY: 0.9 },
      ]
    ).stopSim();
    return harness.operations
      .filter(
        (op) => op.type == "stroke" && op.strokeStyle == renderPlies[0].color
      )
      .map((op) => op.path);
  }

  const tightPaths = renderMainPaths(0.9);
  const baselinePaths = renderMainPaths(1);
  const loosePaths = renderMainPaths(1.1);
  assert.notDeepEqual(
    tightPaths,
    baselinePaths,
    "0.90 yarn length must generate a visibly tighter center-path geometry."
  );
  assert.notDeepEqual(
    loosePaths,
    baselinePaths,
    "1.10 yarn length must generate a visibly looser center-path geometry."
  );
  assert.notDeepEqual(
    tightPaths,
    loosePaths,
    "tight and loose yarn lengths must not resolve to the same path geometry."
  );
  const totalPathLength = (paths) =>
    paths.reduce((total, pathData) => total + pathDataLength(pathData), 0);
  const pathBounds = (paths) => {
    const points = paths.flatMap((pathData) => samplePathData(pathData));
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  };
  const baselinePathLength = totalPathLength(baselinePaths);
  const tightLengthRatio = totalPathLength(tightPaths) / baselinePathLength;
  const looseLengthRatio = totalPathLength(loosePaths) / baselinePathLength;
  const baselineBounds = pathBounds(baselinePaths);
  const tightBounds = pathBounds(tightPaths);
  const looseBounds = pathBounds(loosePaths);
  const tightHeightRatio = tightBounds.height / baselineBounds.height;
  const looseHeightRatio = looseBounds.height / baselineBounds.height;
  const tightWidthRatio = tightBounds.width / baselineBounds.width;
  const looseWidthRatio = looseBounds.width / baselineBounds.width;

  assert.ok(
    tightLengthRatio < 1,
    `0.90 yarn length must shorten the center path; got ratio ${tightLengthRatio}.`
  );
  assert.ok(
    looseLengthRatio > 1,
    `1.10 yarn length must lengthen the center path; got ratio ${looseLengthRatio}.`
  );
  assert.ok(
    tightHeightRatio < 1,
    `0.90 yarn length must make loops/fabric shorter on Y; got height ratio ${tightHeightRatio}.`
  );
  assert.ok(
    looseHeightRatio > 1,
    `1.10 yarn length must make loops/fabric taller on Y; got height ratio ${looseHeightRatio}.`
  );
  assert.ok(
    Math.abs(tightWidthRatio - 1) < Math.abs(tightHeightRatio - 1),
    `0.90 yarn length should change X less than Y; got width ${tightWidthRatio}, height ${tightHeightRatio}.`
  );
  assert.ok(
    Math.abs(looseWidthRatio - 1) < Math.abs(looseHeightRatio - 1),
    `1.10 yarn length should change X less than Y; got width ${looseWidthRatio}, height ${looseHeightRatio}.`
  );

  const largePatternHarness = createCanvasHarness();
  const largePatternStartedAt = performance.now();
  simulate(
    Bimp.empty(48, 60, 0),
    [0],
    ["rgba(250,250,250,1)"],
    1,
    [{ ...renderPlies[0], lengthScaleY: 0.9 }]
  ).stopSim();
  const largePatternDuration = performance.now() - largePatternStartedAt;
  assert.ok(
    largePatternDuration < 2000,
    `48x60 yarn-length solve must finish below 2000ms; got ${largePatternDuration.toFixed(1)}ms.`
  );
  assert.ok(
    largePatternHarness.operations.some((op) => op.type == "stroke"),
    "large-pattern performance validation must render real yarn paths."
  );
  const repeatPatternHarness = createCanvasHarness();
  const repeatPatternStartedAt = performance.now();
  simulate(
    Bimp.empty(48, 60, 0),
    [0],
    ["rgba(250,250,250,1)"],
    1,
    [{ ...renderPlies[0], lengthScaleY: 0.9 }]
  ).stopSim();
  const repeatPatternDuration = performance.now() - repeatPatternStartedAt;
  assert.ok(
    repeatPatternDuration < 2000,
    `repeated 48x60 yarn-length render must finish below 2000ms; got ${repeatPatternDuration.toFixed(1)}ms.`
  );
  assert.ok(
    repeatPatternHarness.operations.some((op) => op.type == "stroke"),
    "repeated large-pattern validation must still render real yarn paths."
  );

  const sequenceMaskColor = "rgba(255,0,0,1)";
  const sequenceMaskHarness = createCanvasHarness();
  simulate(
    Bimp.empty(4, 8, 0),
    [1],
    ["rgba(250,250,250,1)", sequenceMaskColor],
    1,
    renderPlies
  ).stopSim();
  const sequenceMaskStrokes = sequenceMaskHarness.operations.filter(
    (op) => op.type == "stroke"
  );
  assert.ok(
    sequenceMaskStrokes.some((op) => op.strokeStyle == renderPlies[0].color),
    "sequence mask preview must keep drawing the main yarn base color."
  );
  assert.ok(
    sequenceMaskStrokes.some((op) => op.strokeStyle == renderPlies[1].color),
    "sequence mask preview must keep drawing the second yarn base color."
  );
  assert.ok(
    sequenceMaskStrokes.some((op) => op.strokeStyle == sequenceMaskColor),
    "sequence mask preview must draw the selected row color as an overlay."
  );
  assert.ok(
    sequenceMaskStrokes.filter((op) => op.strokeStyle == sequenceMaskColor)
      .length <= 6,
    "sequence mask preview must batch mask strokes instead of drawing one overlay per yarn segment."
  );

  const disabledHarness = createCanvasHarness();
  simulate(
    Bimp.empty(4, 8, 0),
    [0],
    ["rgba(250,250,250,1)"],
    1,
    [{ ...renderPlies[0] }, { ...renderPlies[1], enabled: false }]
  ).stopSim();
  assert.ok(
    disabledHarness.operations
      .filter((op) => op.type == "stroke")
      .every((op) => op.strokeStyle != renderPlies[1].color),
    "disabled second yarn must not be drawn."
  );

  console.log(
    "PASS: two-ply yarn state, settings, JSON, and preview rendering are configured."
  );
} finally {
  await server.close();
}
