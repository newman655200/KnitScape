import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";
import {
  DEFAULT_MACHINE_GAUGE,
  buildFeedYarnLengthDiagnostics,
  cmPer100Loops,
  courseToFeedIndex,
  gaugeToNeedlePitchMm,
  modelLengthToMm,
  normalizeModelLengthPer100Needles,
  normalizeMachineGauge,
  targetModelLengthPer100Needles,
} from "../src/simulation/yarnLengthMetrics.js";

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
let loadedModules;
try {
  loadedModules = await Promise.all([
    server.ssrLoadModule("/src/simulation/yarnPathGeometry.js"),
    server.ssrLoadModule("/src/lib/Bimp.js"),
    server.ssrLoadModule("/src/simulation/Pattern.js"),
    server.ssrLoadModule("/src/simulation/ProcessModel.js"),
    server.ssrLoadModule("/src/simulation/YarnModel.js"),
    server.ssrLoadModule("/src/lib/buildChartFromRepeats.js"),
    server.ssrLoadModule("/src/components/singleJerseyExecutionInput.js"),
  ]);
} finally {
  await server.close();
}
const [
  geometryModule,
  { Bimp },
  { Pattern },
  { ProcessModel },
  { YarnModel },
  { buildChartFromRepeats },
  { createSingleJerseyExecutionInput },
] = loadedModules;
const { buildYarnPathGeometry, DEFAULT_YARN_MODEL_GEOMETRY } = geometryModule;

const read = (file) => fs.readFileSync(file, "utf8");
const packageJSON = JSON.parse(read("package.json"));

assert.equal(
  packageJSON.scripts["validate:yarn-length-gauge"],
  "node --experimental-default-type=module scripts/validate-yarn-length-gauge.mjs"
);

assert.equal(DEFAULT_MACHINE_GAUGE, 32);
assert.equal(normalizeMachineGauge(64), 64);
assert.equal(normalizeMachineGauge("bad"), 32);
assert.ok(Math.abs(gaugeToNeedlePitchMm(32) - 0.79375) < 1e-6);
assert.ok(Math.abs(gaugeToNeedlePitchMm(64) - 0.396875) < 1e-6);
assert.ok(Math.abs(modelLengthToMm(10, 32) - 7.9375) < 1e-9);
assert.ok(Math.abs(modelLengthToMm(10, 64) - 3.96875) < 1e-9);
assert.ok(
  Math.abs(targetModelLengthPer100Needles(23, 32) - 289.7637795275591) <
    1e-9
);
assert.ok(
  Math.abs(targetModelLengthPer100Needles(8, 32) - 100.78740157480316) <
    1e-9
);
assert.ok(
  Math.abs(
    targetModelLengthPer100Needles(23, 64) -
      targetModelLengthPer100Needles(23, 32) * 2
  ) < 1e-9
);
let maxRoundTripError = 0;
for (const cm of [19, 21, 23, 25, 27]) {
  const target = targetModelLengthPer100Needles(cm, 32);
  assert.ok(Math.abs(target - cm * 10 * 32 / 25.4) < 1e-12);
  const error = Math.abs(modelLengthToMm(target, 32) / 10 - cm);
  maxRoundTripError = Math.max(maxRoundTripError, error);
  assert.ok(error < 1e-12);
}
for (const gauge of [28, 32, 36]) {
  const target = targetModelLengthPer100Needles(23, gauge);
  assert.ok(Math.abs(modelLengthToMm(target, gauge) - 230) < 1e-12);
  assert.ok(Math.abs(target / targetModelLengthPer100Needles(23, 32) - gauge / 32) < 1e-12);
}
assert.equal(courseToFeedIndex(0, 2), 0);
assert.equal(courseToFeedIndex(1, 2), 1);
assert.equal(courseToFeedIndex(2, 2), 0);
assert.equal(normalizeModelLengthPer100Needles(12, 4), 300);
assert.equal(normalizeModelLengthPer100Needles(24, 8), 300);
const geometryNeedleSpacing = 8;
const mmPerXUnit = gaugeToNeedlePitchMm(32) / geometryNeedleSpacing;
assert.ok(
  Math.abs(geometryNeedleSpacing * mmPerXUnit - gaugeToNeedlePitchMm(32)) <
    1e-9
);

function buildGeometry(canvasWidth, canvasHeight, machineGauge = 32) {
  const yarnGraph = {
    width: 6,
    height: 1,
    contactNodes: Array.from({ length: 6 }, (_, index) => ({
      index,
      st: "K",
    })),
    makeNice() {
      return Array.from({ length: 6 }, (_, index) => ({
        cnIndex: index,
        i: index,
        j: 0,
        row: 0,
        cnType: "FH",
        normal: [0, 0],
      }));
    },
    yarnPathToLinks() {
      return Array.from({ length: 5 }, (_, index) => ({
        source: index,
        target: index + 1,
        linkType: "FHFH",
        row: 0,
        index,
        layer: "front",
      }));
    },
  };

  const geometry = buildYarnPathGeometry({
    pattern: { width: 3, height: 1 },
    stitchPattern: { width: 3, height: 1, op: () => "K" },
    yarnGraph,
    canvasWidth,
    canvasHeight,
    primaryLengthScaleY: 1,
    primaryYarnDiameter: 0.24,
    machineGauge,
  });

  return { geometry, yarnGraph };
}

function buildProductionGeometry(pattern) {
  const stitchPattern = new Pattern(pattern.pad(1, 0, 0));
  const yarnGraph = new YarnModel(new ProcessModel(stitchPattern).cn);
  return buildYarnPathGeometry({
    pattern,
    stitchPattern,
    yarnGraph,
    canvasWidth: 640,
    canvasHeight: 480,
    primaryLengthScaleY: 1,
    primaryYarnDiameter: 0.24,
    machineGauge: 32,
  });
}

const smallCanvasFixture = buildGeometry(320, 240);
const largeCanvasFixture = buildGeometry(640, 480);
const otherGaugeFixture = buildGeometry(320, 240, 64);
const smallCanvasGeometry = smallCanvasFixture.geometry;
const largeCanvasGeometry = largeCanvasFixture.geometry;
const otherGaugeGeometry = otherGaugeFixture.geometry;
const modelPathSnapshot = structuredClone([
  ...smallCanvasGeometry.modelPathByLink.entries(),
]);
const resolvedPathSnapshot = structuredClone([
  ...smallCanvasGeometry.resolvedPathByLink.entries(),
]);
assert.deepEqual(DEFAULT_YARN_MODEL_GEOMETRY, {
  needlePitch: 1,
  loopHeight: 3 / 5,
  calibrated: false,
});
assert.equal(
  smallCanvasFixture.yarnGraph.contactNodes[2].modelX -
    smallCanvasFixture.yarnGraph.contactNodes[0].modelX,
  1
);
assert.deepEqual(
  smallCanvasGeometry.modelPathArcLength,
  largeCanvasGeometry.modelPathArcLength
);
assert.deepEqual(
  [...smallCanvasGeometry.modelPathByLink.entries()],
  [...largeCanvasGeometry.modelPathByLink.entries()]
);
assert.notDeepEqual(
  [...smallCanvasGeometry.resolvedPathByLink.entries()],
  [...largeCanvasGeometry.resolvedPathByLink.entries()]
);
assert.deepEqual(
  smallCanvasGeometry.modelPathArcLength,
  otherGaugeGeometry.modelPathArcLength
);
assert.equal(smallCanvasGeometry.modelGeometry.needlePitch, 1);
assert.equal(smallCanvasGeometry.modelGeometry.loopHeight, 3 / 5);
assert.equal(smallCanvasGeometry.modelGeometry.calibrated, false);
assert.ok(
  smallCanvasGeometry.measuredModelLengthPer100NeedlesByCourse.get(0) > 0
);
assert.deepEqual(
  smallCanvasGeometry.measuredModelLengthPer100NeedlesByCourse,
  largeCanvasGeometry.measuredModelLengthPer100NeedlesByCourse
);
assert.deepEqual(
  smallCanvasGeometry.measuredModelLengthPer100NeedlesByCourse,
  otherGaugeGeometry.measuredModelLengthPer100NeedlesByCourse
);

const fourNeedleGeometry = buildProductionGeometry(Bimp.empty(4, 1, 0));
const eightNeedleGeometry = buildProductionGeometry(Bimp.empty(8, 1, 0));
assert.equal(fourNeedleGeometry.measuredNeedleCountByCourse.get(0), 4);
assert.equal(eightNeedleGeometry.measuredNeedleCountByCourse.get(0), 8);

const periodicResults = [];
for (const [name, tile] of [["K", [0]], ["K-M", [0, 2]],
  ["M-K", [2, 0]], ["K-M-M-M", [0, 2, 2, 2]], ["K-T", [0, 3]]]) {
  const windows = [4, 8, 16, 32].map((width) => {
    const pattern = new Bimp(width, 1,
      Array.from({ length: width }, (_, index) => tile[index % tile.length]));
    const geometry = buildProductionGeometry(pattern);
    assert.equal(geometry.measuredNeedleCountByCourse.get(0), width,
      `${name} must measure all machine-needle advances, including terminal Miss.`);
    return { width, per100: geometry.measuredModelLengthPer100NeedlesByCourse.get(0) };
  });
  for (const window of windows) {
    assert.ok(Math.abs(window.per100 - windows[0].per100) < 1e-8,
      `${name}: a complete periodic window must be independent of its width.`);
  }
  periodicResults.push({ name, windows });
}

const arrangement = [1, 2, 3];
const arrangedPattern = createSingleJerseyExecutionInput(
  { tracks: [["K"], ["K"], ["K"]] },
  arrangement,
  8,
  1
);
const arrangedGeometry = buildProductionGeometry(arrangedPattern);
assert.equal(arrangedPattern.width, 8);
assert.equal(arrangement.length, 3);
assert.equal(arrangedGeometry.measuredNeedleCountByCourse.get(0), 8);

const fourWideRepeatChart = buildChartFromRepeats({
  repeats: [
    { bitmap: Bimp.empty(4, 1, 0), pos: [0, 0], area: [8, 1] },
  ],
  width: 8,
  height: 1,
  emptyColor: 0,
});
const eightWideRepeatChart = buildChartFromRepeats({
  repeats: [
    { bitmap: Bimp.empty(8, 1, 0), pos: [0, 0], area: [8, 1] },
  ],
  width: 8,
  height: 1,
  emptyColor: 0,
});
const fourWideRepeatGeometry = buildProductionGeometry(fourWideRepeatChart);
const eightWideRepeatGeometry = buildProductionGeometry(eightWideRepeatChart);
assert.equal(fourWideRepeatGeometry.measuredNeedleCountByCourse.get(0), 8);
assert.equal(eightWideRepeatGeometry.measuredNeedleCountByCourse.get(0), 8);
assert.equal(
  fourWideRepeatGeometry.measuredModelLengthPer100NeedlesByCourse.get(0),
  eightWideRepeatGeometry.measuredModelLengthPer100NeedlesByCourse.get(0)
);

const boundaryMissGeometry = buildProductionGeometry(
  new Bimp(4, 1, [0, 2, 0, 2])
);
assert.equal(boundaryMissGeometry.measuredNeedleCountByCourse.get(0), 4);
assert.ok(
  Math.abs(
    modelLengthToMm(
      smallCanvasGeometry.modelPathArcLength.totalModelLength,
      64
    ) -
      modelLengthToMm(
        smallCanvasGeometry.modelPathArcLength.totalModelLength,
        32
      ) /
        2
  ) < 1e-9
);

const feeds = [
  {
    yarns: [
      {
        yarnId: "shared-yarn",
        yarnLengthCmPer100Needles: 23,
        tensionCN: null,
        placement: "parallel",
      },
    ],
  },
  {
    yarns: [
      {
        yarnId: "shared-yarn",
        yarnLengthCmPer100Needles: 8,
        tensionCN: null,
        placement: "parallel",
      },
      {
        yarnId: "companion-yarn",
        yarnLengthCmPer100Needles: 23,
        tensionCN: null,
        placement: "parallel",
      },
    ],
  },
];
const feedsSnapshot = structuredClone(feeds);
const measuredModelLengthPer100Needles = 80;
const feedOneDiagnostics = buildFeedYarnLengthDiagnostics({
  feed: feeds[courseToFeedIndex(0, feeds.length)],
  measuredModelLengthPer100Needles,
  gauge: 32,
});
const feedTwoDiagnostics = buildFeedYarnLengthDiagnostics({
  feed: feeds[courseToFeedIndex(1, feeds.length)],
  measuredModelLengthPer100Needles,
  gauge: 32,
});
assert.equal(feedOneDiagnostics.length, 1);
assert.equal(feedTwoDiagnostics.length, 2);
assert.equal(
  feedOneDiagnostics[0].targetModelLengthPer100Needles,
  targetModelLengthPer100Needles(23, 32)
);
assert.equal(
  feedOneDiagnostics[0].targetModelLengthPer100Needles,
  feedTwoDiagnostics[1].targetModelLengthPer100Needles
);
assert.equal(
  feedTwoDiagnostics[0].targetModelLengthPer100Needles,
  targetModelLengthPer100Needles(8, 32)
);
for (const diagnostic of [...feedOneDiagnostics, ...feedTwoDiagnostics]) {
  assert.equal(
    diagnostic.measuredModelLengthPer100Needles,
    measuredModelLengthPer100Needles
  );
  assert.equal(
    diagnostic.lengthRatio,
    diagnostic.targetModelLengthPer100Needles /
      diagnostic.measuredModelLengthPer100Needles
  );
}
assert.deepEqual(feeds, feedsSnapshot);
assert.deepEqual(
  [...smallCanvasGeometry.modelPathByLink.entries()],
  modelPathSnapshot
);
assert.deepEqual(
  [...smallCanvasGeometry.resolvedPathByLink.entries()],
  resolvedPathSnapshot
);
assert.ok(
  Math.abs(
    cmPer100Loops({
      totalPathLengthStitchUnits: 420,
      effectiveLoopCount: 84,
      gauge: 32,
    }) - 39.6875
  ) < 1e-6
);

const stateSource = read("src/state.js");
assert.match(stateSource, /machineGauge:\s*DEFAULT_MACHINE_GAUGE/);
assert.match(stateSource, /yarnLengthMetrics:\s*null/);
const metricsSource = read("src/simulation/yarnLengthMetrics.js");
assert.doesNotMatch(metricsSource, /geometryArcLengthToPhysical/);

const simulationSource = [
  "src/simulation/yarnSimulation.js",
  "src/simulation/yarnPathGeometry.js",
  "src/simulation/drawYarnSimulation.js",
]
  .map(read)
  .join("\n");
assert.match(simulationSource, /machineGauge/);
assert.match(
  simulationSource,
  /effectiveLoopCount:\s*pattern\.width\s*\*\s*pattern\.height/
);
assert.match(simulationSource, /X_PADDING/);
assert.match(simulationSource, /pointInEffectiveNeedles/);
assert.match(
  simulationSource,
  /stitchHeight\s*=\s*baseStitchHeight\s*\*\s*primaryLengthScaleY/
);
assert.match(simulationSource, /const STITCH_RATIO\s*=\s*5\s*\/\s*3/);
assert.match(simulationSource, /Math\.floor\(point\.i\s*\/\s*2\)/);
assert.match(simulationSource, /node\.modelX\s*=\s*\(i\s*\/\s*2\)/);
assert.match(simulationSource, /function modelToCanvasPoint/);
assert.match(simulationSource, /x:\s*offsetX\s*\+\s*point\.x\s*\*\s*stitchWidth/);
assert.match(simulationSource, /y:\s*offsetY\s*\+\s*point\.y\s*\*\s*stitchWidth/);
assert.doesNotMatch(simulationSource, /yarnPathPhysicalArcLength/);
for (const file of [
  "src/simulation/yarnPathGeometry.js",
  "src/simulation/drawYarnSimulation.js",
]) {
  assert.doesNotMatch(read(file), /yarnLengthCmPer100Needles/);
}

const runSimulationSource = read("src/components/runSimulation.js");
assert.match(runSimulationSource, /yarnLengthMetrics/);
assert.match(runSimulationSource, /machineGauge:\s*GLOBAL_STATE\.machineGauge/);

const leftBarSource = read("src/views/yarnLengthReadout.js");
for (const token of [
  "machine.gauge",
  "machine.needlePitch",
  "yarnLength.current",
  "yarnLength.cmPer100",
]) {
  assert.match(leftBarSource, new RegExp(token));
}

const translationsSource = read("src/i18n/translations.js");
for (const token of [
  "machine.gauge",
  "machine.needlePitch",
  "yarnLength.current",
  "yarnLength.cmPer100",
]) {
  assert.match(translationsSource, new RegExp(`"${token}"`));
}

console.log(JSON.stringify(periodicResults));
console.log(`Maximum unit round-trip error: ${maxRoundTripError} cm/100 needles.`);
console.log("PASS: yarn length units and complete periodic needle windows are valid.");
