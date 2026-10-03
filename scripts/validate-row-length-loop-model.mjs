import assert from "node:assert/strict";
import fs from "node:fs";
import {
  assertContinuousRowPaths,
  moveNeckPoint,
  moveNeckPointX,
  pathDataArcLength,
  pathDataLength,
  polylineArcLength,
  solveSharedCoefficient,
} from "../src/simulation/rowLengthLoopModel.js";

const packageJSON = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(
  packageJSON.scripts["validate:row-length-loop-model"],
  "node --experimental-default-type=module scripts/validate-row-length-loop-model.mjs"
);

assert.equal(moveNeckPointX({ x: -0.5, y: 0 }, 0, 0.8).x, -0.4);
assert.equal(moveNeckPointX({ x: -0.5, y: 0 }, 0, 1.2).x, -0.6);
assert.deepEqual(
  moveNeckPointX({ x: 0, y: -2 }, 0, 0.8, false),
  { x: 0, y: -2 }
);
assert.deepEqual(
  moveNeckPoint({ x: -0.5, y: 0 }, 0, 0.8, 2),
  { x: -0.48, y: 0 }
);

for (const [targetLength, direction] of [[90, "tight"], [110, "loose"]]) {
  const result = solveSharedCoefficient({
    targetLength,
    direction,
    measureLength: (coefficient) => 100 * coefficient,
  });
  assert.ok(direction === "tight" ? result.coefficient < 1 : result.coefficient > 1);
  assert.ok(result.relativeError <= 0.001);
}

assert.equal(pathDataLength("M 0 0 L 3 4"), 5);
assert.deepEqual(pathDataArcLength("M 0 0 L 3 4"), {
  totalLength: 5,
  cumulativeArcLength: [0, 5],
});

const polyline = [
  { x: 0, y: 0 },
  { x: 3, y: 4 },
  { x: 6, y: 4 },
];
const polylineSnapshot = structuredClone(polyline);
const firstMeasurement = polylineArcLength(polyline);
const secondMeasurement = polylineArcLength(polyline);
assert.deepEqual(firstMeasurement.cumulativeArcLength, [0, 5, 8]);
assert.ok(
  firstMeasurement.cumulativeArcLength.every(
    (length, index, lengths) => index === 0 || length >= lengths[index - 1]
  )
);
assert.equal(firstMeasurement.cumulativeArcLength[0], 0);
assert.ok(
  Math.abs(firstMeasurement.cumulativeArcLength.at(-1) - firstMeasurement.totalLength) <
    1e-9
);
assert.deepEqual(secondMeasurement, firstMeasurement);
assert.deepEqual(polyline, polylineSnapshot);
assert.equal(
  assertContinuousRowPaths(["M 0 0 L 1 1", "M 1 1 L 2 0"]),
  true
);
assert.equal(
  assertContinuousRowPaths(["M 0 0 L 1 1", "M 1.01 1 L 2 0"]),
  false
);

const simulationSource = [
  "src/simulation/yarnSimulation.js",
  "src/simulation/yarnPathGeometry.js",
  "src/simulation/drawYarnSimulation.js",
]
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
for (const token of [
  "primaryLengthScaleY",
  "rowSupportsLengthModel",
  "buildRowCoefficients",
  "getSharedPointPosition",
  "buildResolvedPathMap",
  "buildYarnPathArcLength",
  "assertContinuousRowPaths",
]) {
  assert.match(simulationSource, new RegExp(token), `runtime must include ${token}`);
}
assert.match(
  simulationSource,
  /const yarnPathArcLength\s*=\s*includeSummaryMetrics\s*\?\s*buildYarnPathArcLength\(\)/,
  "final Yarn Path geometry must expose its arc-length measurement."
);
assert.match(simulationSource, /yarnPathArcLength,/);
assert.doesNotMatch(
  fs.readFileSync("src/simulation/yarnPathGeometry.js", "utf8"),
  /yarnLengthCmPer100Needles/
);
assert.match(simulationSource, /yarnPlies\?\.\[0\]\?\.lengthScaleY/);
assert.doesNotMatch(simulationSource, /yarnLinkForce|forceSimulation|function relax/);
const runSimulationSource = fs.readFileSync("src/components/runSimulation.js", "utf8");
assert.doesNotMatch(runSimulationSource, /simulation\.relax/);
assert.match(
  runSimulationSource,
  /const debouncedRun = debounce\(run, 150\)/,
  "yarn-length preview must wait for a short drag pause before recomputing."
);
assert.equal(fs.existsSync("src/simulation/YarnForce.js"), false);

const technicalDoc = fs.readFileSync("KnitScape_当前功能与算法.md", "utf8");
for (const heading of [
  "项目当前定位",
  "当前已实现功能",
  "实际运行架构",
  "核心数据结构",
  "已实现算法",
  "技术栈与开发方式",
  "当前验证结果",
  "当前明确未实现",
  "理论与使用边界",
]) {
  assert.match(technicalDoc, new RegExp(`## \\d+\\. ${heading}`));
}
assert.doesNotMatch(technicalDoc, /Step 16[A-E]|PBR 导出方向|yarnLengthSimulationRequestId/);

console.log("PASS: row-length loop model math and continuity helpers are valid.");
