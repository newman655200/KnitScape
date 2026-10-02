import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";
import {
  DEFAULT_MACHINE_GAUGE,
  cmPer100Loops,
  gaugeToNeedlePitchMm,
  modelLengthToMm,
  normalizeMachineGauge,
} from "../src/simulation/yarnLengthMetrics.js";

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
let geometryModule;
try {
  geometryModule = await server.ssrLoadModule(
    "/src/simulation/yarnPathGeometry.js"
  );
} finally {
  await server.close();
}
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

const smallCanvasFixture = buildGeometry(320, 240);
const largeCanvasFixture = buildGeometry(640, 480);
const otherGaugeFixture = buildGeometry(320, 240, 64);
const smallCanvasGeometry = smallCanvasFixture.geometry;
const largeCanvasGeometry = largeCanvasFixture.geometry;
const otherGaugeGeometry = otherGaugeFixture.geometry;
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
assert.doesNotMatch(simulationSource, /yarnLengthCmPer100Needles/);

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

console.log("PASS: yarn length gauge readout is configured.");
