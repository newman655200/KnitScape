import assert from "node:assert/strict";
import fs from "node:fs";
import { curveCatmullRomOpen, line, path, pathRound } from "d3";
import * as loopModel from "../src/simulation/rowLengthLoopModel.js";
import {
  assertContinuousRowPaths,
  moveNeckPoint,
  moveNeckPointX,
  pathDataArcLength,
  pathDataLength,
  pathEndpoints,
  polylineArcLength,
  samplePathData,
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
assert.equal(
  typeof loopModel.createPathLengthContext,
  "function",
  "length-only candidates need a streaming M/L/C context"
);
const lengthContext = loopModel.createPathLengthContext();
lengthContext.moveTo(0, 0);
lengthContext.bezierCurveTo(0, 1, 1, 1, 1, 0);
assert.ok(Math.abs(lengthContext.totalLength - 2) < 1e-9,
  "the cubic arch has exact arc length 2; 24-chord sampling is insufficient.");

function referencePathLength(pathData) {
  // Independent dense reference only in the validator; M starts a new subpath.
  return pathData.split(/(?=M)/).reduce((sum, part) => sum +
    loopModel.polylineLength(samplePathData(part, 32768)), 0);
}
function assertLengthContextMatchesPath(commands, roundCoordinates = true) {
  lengthContext.reset(roundCoordinates);
  const svg = roundCoordinates ? pathRound(6) : path();
  for (const [command, ...coordinates] of commands) {
    svg[command](...coordinates);
    lengthContext[command](...coordinates);
  }
  const pathData = String(svg);
  assert.equal(lengthContext.valid, true, `finite context must be valid: ${pathData}`);
  assert.ok(Math.abs(lengthContext.totalLength - referencePathLength(pathData)) < 1e-5,
    `direct cubic integration must agree with the independent dense reference: ${pathData}`);
  assert.deepEqual(
    { start: lengthContext.start, end: lengthContext.end },
    pathEndpoints(pathData),
    `streaming endpoints must preserve SVG rounding and t=1 arithmetic: ${pathData}`
  );
}
const contextCommands = [
  [["moveTo", -0, -0], ["lineTo", 3, 4]],
  [["moveTo", -0.0000005, 0.0000005], ["lineTo", 0.00000049, -0.00000049]],
  [["moveTo", 0.123456789, 128.123456789], ["lineTo", 3.987654321, 131.987654321]],
  [["moveTo", -0, -0], ["bezierCurveTo", -0, -0, -0, -0, -0, -0]],
  [["moveTo", 0, 0], ["bezierCurveTo", 0, 1, 1, 1, 1, 0]],
  [["moveTo", -0.0000005, 0.0000005], ["bezierCurveTo", 0.00000049, -0.00000049, 1.23456789, 2.34567891, 3.45678912, -0]],
  [["moveTo", 0, 120000000.123456789], ["bezierCurveTo", -1, 120000001.123456789, 2, 120000003.123456789, 3, 120000000.123456789]],
  [["moveTo", 1, 2], ["bezierCurveTo", 3, 4, 5, 6, 7, 8], ["bezierCurveTo", 9, 10, 11, 12, 13, 14]],
  [["moveTo", 1, 2], ["bezierCurveTo", 3, 4, 5, 6, 7, 8], ["lineTo", -0, 9], ["moveTo", 10, 11], ["bezierCurveTo", 12, 13, 14, 15, 16, 17]],
];
for (let index = 0; index < 96; index++) {
  const coordinate = (offset) => Math.sin(index * 7 + offset) * (index + 1);
  contextCommands.push([
    ["moveTo", coordinate(0), coordinate(1)],
    ["bezierCurveTo", ...Array.from({ length: 6 }, (_, offset) => coordinate(offset + 2))],
    ["bezierCurveTo", ...Array.from({ length: 6 }, (_, offset) => coordinate(offset + 8))],
  ]);
}
for (const commands of contextCommands) {
  assertLengthContextMatchesPath(commands);
  assertLengthContextMatchesPath(commands, false);
}
const openCurve = line().x((point) => point.x).y((point) => point.y)
  .curve(curveCatmullRomOpen).digits(6);
const contextCurve = line().x((point) => point.x).y((point) => point.y)
  .curve(curveCatmullRomOpen).context(lengthContext);
for (let index = 0; index < 48; index++) {
  const points = Array.from({ length: 4 }, (_, offset) => ({
    x: Math.sin(index + offset) * (index + 1),
    y: 120 + Math.cos(index + offset) * (index + 1),
  }));
  lengthContext.reset();
  contextCurve(points);
  const pathData = openCurve(points);
  assert.ok(Math.abs(lengthContext.totalLength - referencePathLength(pathData)) < 1e-5);
  assert.deepEqual(
    { start: lengthContext.start, end: lengthContext.end },
    pathEndpoints(pathData)
  );
}
lengthContext.reset();
assert.equal(lengthContext.totalLength, 0);
assert.equal(lengthContext.start, null);
assert.equal(lengthContext.end, null);
assert.equal(lengthContext.valid, true);
lengthContext.moveTo(0, 0);
lengthContext.bezierCurveTo(Infinity, 1, 2, 3, 4, 5);
assert.equal(lengthContext.valid, false, "non-finite samples must request the SVG fallback");
lengthContext.reset(false);
lengthContext.moveTo(NaN, 0);
assert.equal(lengthContext.valid, false, "non-finite M/L coordinates must request the SVG fallback");
const endpointPaths = [
  "M 0 0",
  "M 0 0 L 3 4",
  "M-1.25,2.5C0,1,3,4,5,6",
  "M 1e-3 -2E+2 C -3 4 5 -6 7 8 C 9 10 11 12 13 14",
  "M -0 -0 C -0 -0 -0 -0 -0 -0",
  "M 1 2 C 3 4 5 6 7 8 L -0 9 M 10 11 C 12 13 14 15 16 17",
  "",
  "M 0 0 C 1 2 3",
  "M 0 0 L 1e400 2",
  "M 0 0 C 1e400 2 3 4 5 6",
  "M 0 0 Q 1 2 3 4",
  "m 0 0 c 1 2 3 4 5 6",
  "M 0 0 C -1e308 1e308 1e308 -1e308 -0 0",
  "M 0 0 L 2 C 1 2 3 4 5 6",
  "C 1 2 3 4 5 6",
  "L 2 3",
];
for (let index = 0; index < 96; index++) {
  const coordinate = (offset) => Math.sin(index * 7 + offset) * (index + 1);
  endpointPaths.push(
    `M${coordinate(0)},${coordinate(1)}` +
      `C${Array.from({ length: 6 }, (_, offset) => coordinate(offset + 2)).join(",")}` +
      `C${Array.from({ length: 6 }, (_, offset) => coordinate(offset + 8)).join(",")}`
  );
}
for (const pathData of endpointPaths) {
  const points = samplePathData(pathData);
  assert.deepEqual(
    pathEndpoints(pathData),
    points.length ? { start: points[0], end: points.at(-1) } : null,
    `endpoints must preserve existing sampling semantics: ${pathData}`
  );
}

// Count work in an in-memory copy so the production API needs no instrumentation.
const endpointSource = fs.readFileSync("src/simulation/rowLengthLoopModel.js", "utf8");
const endpointModule = await import(
  `data:text/javascript;base64,${Buffer.from(
    "let sampleCalls = 0; let endpointCalls = 0; let powerCalls = 0;" +
      " export function sampleCallCount() { return sampleCalls; }" +
      " export function endpointCallCount() { return endpointCalls; }\n" +
      " export function powerCallCount() { return powerCalls; }\n" +
      endpointSource.replace(
        "export function samplePathData(pathData, samplesPerCurve = 24) {",
        "export function samplePathData(pathData, samplesPerCurve = 24) { sampleCalls++;"
      ).replace(
        "export function pathEndpoints(pathData) {",
        "export function pathEndpoints(pathData) { endpointCalls++;"
      ).replace(
        /\b(mt|t) \*\* ([23])/g,
        "(powerCalls++, $1 ** $2)"
      )
  ).toString("base64")}`
);
assert.equal(endpointModule.assertContinuousRowPaths([
  "M0,0C0,1,1,1,1,0",
  "M1,0C1,-1,2,-1,2,0",
  "M2,0C2,1,3,1,3,0",
]), true);
assert.equal(
  endpointModule.sampleCallCount(),
  0,
  "continuity endpoint checks must not sample valid M/L/C curves"
);
assert.equal(
  endpointModule.endpointCallCount(),
  3,
  "continuity checks must read each path's endpoints only once"
);
const cachedPowersContext = endpointModule.createPathLengthContext();
const powersAfterConstruction = endpointModule.powerCallCount();
for (let index = 0; index < 3; index++) {
  cachedPowersContext.reset();
  cachedPowersContext.moveTo(0, 0);
  cachedPowersContext.bezierCurveTo(0, 1, 1, 1, 1, 0);
}
assert.equal(
  endpointModule.powerCallCount(),
  powersAfterConstruction,
  "streaming integration must not use the display sampler's cubic powers"
);
endpointModule.samplePathData("M0,0C0,1,1,1,1,0");
assert.ok(
  endpointModule.powerCallCount() > powersAfterConstruction,
  "the existing SVG sampler must still calculate its own cubic powers"
);
assert.equal(assertContinuousRowPaths([]), true);
assert.equal(assertContinuousRowPaths([null]), true);
assert.equal(assertContinuousRowPaths(["", "M0,0L1,1", null]), false);
assert.equal(assertContinuousRowPaths(["M0,0L1,1", "M2,2L3,3", null]), false);
assert.equal(assertContinuousRowPaths(["M0,0L1,1", "M1.01,1L2,2"], 0.02), true);
assert.throws(() => assertContinuousRowPaths(["M0,0L1,1", null]), TypeError);
assert.throws(() => assertContinuousRowPaths(["", null]), TypeError);
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
  "当前明确未实现",
  "理论与使用边界",
]) {
  assert.match(technicalDoc, new RegExp(`## \\d+\\. ${heading}`));
}
// Section titles are prose; the software/process validation boundary is the contract.
function assertValidationBoundary(document) {
  assert.match(document, /P0-C0 Correctness Preparation/, "must identify the current preparation stage");
  const baselineSection = document.split(/^## .*$/m).find(
    (section) => section.includes("SolverResult") && section.includes("PreviewValidity")
  );
  assert.ok(baselineSection, "must document the P0 software baseline together");
  for (const protection of [
    "合法/非法输入保护", "明确Clear", "UNREACHABLE_TARGET",
    "Feed×Yarn独立目标", "批量目标原子预检", "feedYarnStructureRevision",
  ]) {
    assert.ok(baselineSection.includes(protection), `P0 baseline must document ${protection}`);
  }
  assert.match(baselineSection, /UNKNOWN\s*\/\s*PENDING PROCESS CONFIRMATION/);
  assert.match(baselineSection, /没有证明真实工厂23\/8与当前Solver测量定义一致/);
  assert.match(baselineSection, /没有完成真实机台精度标定/);
  assert.match(baselineSection, /当前VALIDATED仅是模型窗口数值目标成功并应用/);
  assert.match(baselineSection, /\]\(docs\/PROCESS_VALIDATION\.md\)/);
}
assertValidationBoundary(technicalDoc);
assertValidationBoundary(technicalDoc.replace(/^## 7\..*$/m, "## 软件验证说明"));
for (const contractText of [
  "P0-C0 Correctness Preparation", "SolverResult", "PreviewValidity",
  "合法/非法输入保护", "明确Clear", "UNREACHABLE_TARGET",
  "Feed×Yarn独立目标", "批量目标原子预检", "feedYarnStructureRevision",
  "UNKNOWN / PENDING PROCESS CONFIRMATION",
  "没有证明真实工厂23/8与当前Solver测量定义一致",
  "没有完成真实机台精度标定", "当前VALIDATED仅是模型窗口数值目标成功并应用",
  "docs/PROCESS_VALIDATION.md",
]) {
  assert.throws(() => assertValidationBoundary(technicalDoc.replaceAll(contractText, "")),
    assert.AssertionError, `removing ${contractText} must fail the document contract`);
}
assert.doesNotMatch(technicalDoc, /Step 16[A-E]|PBR 导出方向|yarnLengthSimulationRequestId/);

console.log("PASS: row-length loop model math and continuity helpers are valid.");
