import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";
import {
  CONVERGED,
  UNREACHABLE_TARGET,
  solveFeedYarnLengths,
} from "../src/simulation/yarnLengthSolver.js";
import { modelLengthToMm, targetModelLengthPer100Needles } from "../src/simulation/yarnLengthMetrics.js";

const packageJSON = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(
  packageJSON.scripts["validate:yarn-length-solver"],
  "node --experimental-default-type=module scripts/validate-yarn-length-solver.mjs"
);

let modelPathBuilds = 0;
const iterationCounts = new Map();
globalThis.__countModelPathBuild = () => { modelPathBuilds += 1; };
globalThis.__countSolverIteration = (feed, yarn) => {
  const key = `${feed}:${yarn}`;
  iterationCounts.set(key, (iterationCounts.get(key) ?? 0) + 1);
};
const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
  plugins: [{
    name: "count-model-path-materialization",
    enforce: "pre",
    transform(source, id) {
      if (id.replaceAll("\\", "/").endsWith("/src/simulation/yarnLengthSolver.js")) {
        return source.replace("const midpoint = candidateAt(",
          "globalThis.__countSolverIteration(feedIndex, yarnIndex);\n        const midpoint = candidateAt(");
      }
      if (!id.replaceAll("\\", "/").endsWith("/src/simulation/yarnPathGeometry.js")) return;
      return source.replace("const coefficientByLink = new Map(",
        "globalThis.__countModelPathBuild();\n    const coefficientByLink = new Map(");
    },
  }],
});
let modules;
try {
  modules = await Promise.all([
    server.ssrLoadModule("/src/lib/Bimp.js"),
    server.ssrLoadModule("/src/simulation/Pattern.js"),
    server.ssrLoadModule("/src/simulation/ProcessModel.js"),
    server.ssrLoadModule("/src/simulation/YarnModel.js"),
    server.ssrLoadModule("/src/simulation/yarnPathGeometry.js"),
    server.ssrLoadModule("/src/simulation/rowLengthLoopModel.js"),
    server.ssrLoadModule("/src/simulation/yarnLengthSolver.js"),
  ]);
} finally {
  await server.close();
}
const [
  { Bimp },
  { Pattern },
  { ProcessModel },
  { YarnModel },
  { buildYarnPathGeometry },
  { polylineLength, samplePathData },
  { solveFeedYarnLengths: countedSolve },
] = modules;

function buildGeometry(pattern, modelLoopHeight, options = {}) {
  const stitchPattern = new Pattern(pattern.pad(1, 0, 0));
  const yarnGraph = new YarnModel(new ProcessModel(stitchPattern).cn);
  const geometry = buildYarnPathGeometry({
    pattern,
    stitchPattern,
    yarnGraph,
    canvasWidth: 640,
    canvasHeight: 480,
    primaryLengthScaleY: 1,
    primaryYarnDiameter: 0.24,
    machineGauge: 32,
    modelLoopHeight,
    ...options,
  });
  return { geometry, yarnGraph };
}

function topologySnapshot(links) {
  return links.map(({ source, target, linkType, row, index, layer }) => ({
    source,
    target,
    linkType,
    row,
    index,
    layer,
  }));
}

// Five full copies, independent of runtime repeat reduction. Read actual curves
// in the middle copy, including every outgoing wrap link, with a dense reference.
function referencePeriodicLengths(pattern, loopHeight) {
  const expanded = Bimp.fromTile(pattern.width * 5, pattern.height, pattern);
  const { geometry, yarnGraph } = buildGeometry(expanded, loopHeight,
    { includeSummaryMetrics: false });
  const points = yarnGraph.makeNice();
  const lengths = new Map();
  for (const link of geometry.yarnPathLinks) {
    const needle = Math.floor(points[link.index].i / 2);
    if (needle < 1 + 2 * pattern.width || needle >= 1 + 3 * pattern.width) continue;
    const length = polylineLength(samplePathData(geometry.modelPathByLink.get(link.index), 4096));
    lengths.set(link.row, (lengths.get(link.row) ?? 0) + length * 100 / pattern.width);
  }
  return lengths;
}

let maxReferenceError = 0;
for (const inputPattern of [
  Bimp.empty(4, 3, 0),
  new Bimp(4, 3, [0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2]),
  new Bimp(4, 3, [2, 2, 0, 2, 2, 2, 0, 2, 2, 2, 0, 2]),
  new Bimp(4, 3, [0, 3, 0, 3, 0, 0, 0, 0, 0, 2, 0, 2]),
]) {
  for (const height of [0.05, 0.6, 2]) {
    const production = buildGeometry(inputPattern, height).geometry;
    const reference = referencePeriodicLengths(inputPattern, height);
    assert.deepEqual([...production.measuredModelLengthPer100NeedlesByCourse.keys()], [...reference.keys()]);
    reference.forEach((length, course) => {
      const error = Math.abs(length - production.measuredModelLengthPer100NeedlesByCourse.get(course));
      maxReferenceError = Math.max(maxReferenceError, error);
      assert.ok(error <= 0.001, `course ${course}, height ${height}: production/reference error ${error}`);
    });
    const finiteReference = production.yarnPathLinks.reduce((sum, link) =>
      sum + polylineLength(samplePathData(production.modelPathByLink.get(link.index), 4096)), 0);
    assert.ok(Math.abs(production.modelPathArcLength.totalModelLength - finiteReference) <= 0.001,
      "finite Model arc summary must also use direct high-precision integration.");
    assert.equal(production.modelPathArcLength.cumulativeModelArcLength[0], 0);
    assert.equal(production.modelPathArcLength.cumulativeModelArcLength.at(-1),
      production.modelPathArcLength.totalModelLength);
  }
}

function trackedGeometryFactory(pattern, expectedNeedleX, expectedTopology) {
  return (loopHeight) => {
    const { geometry, yarnGraph } = buildGeometry(pattern, loopHeight);
    assert.deepEqual(
      yarnGraph.contactNodes.map((node) => node.modelX),
      expectedNeedleX,
      "solving loopHeight must not move X needle positions."
    );
    assert.deepEqual(
      topologySnapshot(geometry.yarnPathLinks),
      expectedTopology,
      "solving loopHeight must not change Yarn Path topology."
    );
    return geometry;
  };
}

const gauge = 32;
const tolerance = 0.01;
const oneFeedPattern = Bimp.empty(12, 1, 0);
const { geometry: baseGeometry, yarnGraph: baseGraph } = buildGeometry(
  oneFeedPattern
);
const basePathSnapshot = structuredClone([...baseGeometry.modelPathByLink]);
const baseResolvedSnapshot = structuredClone([...baseGeometry.resolvedPathByLink]);
const baseNeedleX = baseGraph.contactNodes.map((node) => node.modelX);
const baseTopology = topologySnapshot(baseGeometry.yarnPathLinks);
const baseNodesSnapshot = structuredClone(baseGraph.contactNodes);
const evaluateModelLength = baseGeometry.createModelLengthEvaluator();
const candidateHeights = [0.05, 0.29375, 0.5375, 0.78125, 1.025, 1.26875, 1.5125, 1.75625, 2];
const buildsBeforeCandidates = modelPathBuilds;
const lightCandidates = candidateHeights.map(evaluateModelLength);
assert.equal(modelPathBuilds, buildsBeforeCandidates,
  "length-only candidate evaluations must not materialize full Model paths.");
for (let index = 0; index < candidateHeights.length; index++) {
  const full = buildGeometry(oneFeedPattern, candidateHeights[index]).geometry;
  const candidate = lightCandidates[index];
  assert.deepEqual(candidate.measuredModelLengthPer100NeedlesByCourse,
    full.measuredModelLengthPer100NeedlesByCourse,
    "lightweight candidates must preserve exact sampled/rounded Model lengths.");
  const buildsBeforeFinal = modelPathBuilds;
  assert.deepEqual(candidate.modelPathByLink, full.modelPathByLink,
    "lazy solved paths must capture their candidate height, independent of evaluation order.");
  assert.equal(candidate.modelPathByLink, candidate.modelPathByLink,
    "a final candidate must materialize its Model paths only once.");
  assert.deepEqual(candidate.yarnPathLinks, baseGeometry.yarnPathLinks);
  assert.equal(modelPathBuilds, buildsBeforeFinal + 1,
    "only the chosen final candidate materializes paths, exactly once.");
}
assert.deepEqual(baseGraph.contactNodes, baseNodesSnapshot,
  "candidate evaluation must not mutate base nodes or X needle positions.");
assert.deepEqual([...baseGeometry.modelPathByLink], basePathSnapshot);
assert.deepEqual([...baseGeometry.resolvedPathByLink], baseResolvedSnapshot);
for (const inputPattern of [
  new Bimp(4, 2, [0, 0, 0, 0, 1, 1, 1, 1]),
  new Bimp(8, 3, Array.from({ length: 24 }, (_, index) => index === 11 ? 3 : 0)),
  new Bimp(8, 3, Array.from({ length: 24 }, (_, index) => index === 11 ? 2 : 0)),
]) {
  for (const primaryLengthScaleY of [0.9, 1, 1.1]) {
    const options = { primaryLengthScaleY, primaryYarnDiameter: 0.3 };
    const { geometry: original, yarnGraph } = buildGeometry(inputPattern, undefined, options);
    const originalNodes = structuredClone(yarnGraph.contactNodes);
    const originalPaths = structuredClone([...original.modelPathByLink]);
    const evaluate = original.createModelLengthEvaluator();
    for (const height of [0.05, 0.48691711425781253, 2]) {
      const light = evaluate(height);
      const full = buildGeometry(inputPattern, height, options).geometry;
      assert.deepEqual(light.measuredModelLengthPer100NeedlesByCourse,
        full.measuredModelLengthPer100NeedlesByCourse,
        "mixed K/P/T/M, multiple courses and row coefficients must preserve exact lengths.");
      assert.deepEqual(light.modelPathByLink, full.modelPathByLink);
      assert.deepEqual(light.yarnPathLinks, original.yarnPathLinks);
    }
    assert.deepEqual(yarnGraph.contactNodes, originalNodes);
    assert.deepEqual([...original.modelPathByLink], originalPaths);
  }
}
const buildOneFeedGeometry = trackedGeometryFactory(
  oneFeedPattern,
  baseNeedleX,
  baseTopology
);

const loopHeightSamples = [0.2, 0.4, 0.6, 0.8, 1].map((loopHeight) => ({
  loopHeight,
  measured: buildOneFeedGeometry(
    loopHeight
  ).measuredModelLengthPer100NeedlesByCourse.get(0),
}));
for (let index = 1; index < loopHeightSamples.length; index += 1) {
  assert.ok(
    loopHeightSamples[index].measured > loopHeightSamples[index - 1].measured,
    "measured model length must increase monotonically with loopHeight."
  );
}

const requestedLengths = [19, 21, 23, 25, 27];
const oneFeed = {
  yarns: requestedLengths.map((length, yarnIndex) => ({
    yarnId: `yarn-${yarnIndex}`,
    yarnLengthCmPer100Needles: length,
    tensionCN: null,
    placement: "parallel",
  })),
};
iterationCounts.clear();
const results = countedSolve({
  feeds: [oneFeed],
  gauge,
  buildGeometry: buildOneFeedGeometry,
  minLoopHeight: 0.05,
  maxLoopHeight: 2,
  tolerance,
});
const recordedIterations = new Map(iterationCounts);
assert.equal(results.length, requestedLengths.length);
assert.deepEqual(
  results.map((result) => result.feedIndex),
  requestedLengths.map(() => 0)
);
assert.deepEqual(
  results.map((result) => result.yarnIndex),
  requestedLengths.map((_, index) => index)
);
assert.ok(
  results.every(
    (result) =>
      result.status === CONVERGED &&
      result.converged === true &&
      result.error <= tolerance
  )
);
for (let index = 0; index < results.length; index++) {
  const result = results[index];
  const reference = referencePeriodicLengths(oneFeedPattern, result.solvedLoopHeight).get(0);
  const error = Math.abs(reference - result.solvedModelLengthPer100Needles);
  maxReferenceError = Math.max(maxReferenceError, error);
  assert.ok(error <= 0.001);
  assert.ok(Math.abs(reference - result.targetModelLengthPer100Needles) <= tolerance,
    "independent high-precision solved length must meet Solver tolerance.");
  assert.ok(Math.abs(modelLengthToMm(reference, gauge) / 10 - requestedLengths[index]) <=
    tolerance * 25.4 / gauge / 10);
  assert.ok(Math.abs(targetModelLengthPer100Needles(requestedLengths[index], gauge) -
    requestedLengths[index] * 10 * gauge / 25.4) < 1e-12);
}
for (let index = 1; index < results.length; index += 1) {
  assert.ok(
    results[index].targetModelLengthPer100Needles >
      results[index - 1].targetModelLengthPer100Needles
  );
  assert.ok(
    results[index].solvedModelLengthPer100Needles >
      results[index - 1].solvedModelLengthPer100Needles
  );
  assert.ok(
    results[index].solvedLoopHeight > results[index - 1].solvedLoopHeight
  );
  assert.notEqual(
    results[index].solvedPathByLink,
    results[index - 1].solvedPathByLink
  );
}
const baseLinkIndices = baseGeometry.yarnPathLinks.map((link) => link.index);
for (const result of results) {
  assert.deepEqual([...result.solvedPathByLink.keys()], baseLinkIndices);
}
assert.deepEqual([...baseGeometry.modelPathByLink], basePathSnapshot);
assert.deepEqual([...baseGeometry.resolvedPathByLink], baseResolvedSnapshot);

const sameFeedYarnA = results.find(
  (result) => oneFeed.yarns[result.yarnIndex].yarnLengthCmPer100Needles === 23
);
const sameFeedYarnB = results.find(
  (result) => oneFeed.yarns[result.yarnIndex].yarnLengthCmPer100Needles === 21
);
assert.notEqual(sameFeedYarnA.solvedLoopHeight, sameFeedYarnB.solvedLoopHeight);
assert.notEqual(sameFeedYarnA.solvedPathByLink, sameFeedYarnB.solvedPathByLink);

const twoFeedPattern = Bimp.empty(12, 2, 0);
const { geometry: twoFeedBase, yarnGraph: twoFeedGraph } = buildGeometry(
  twoFeedPattern
);
const twoFeedResults = solveFeedYarnLengths({
  feeds: [
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
          yarnLengthCmPer100Needles: 25,
          tensionCN: null,
          placement: "parallel",
        },
      ],
    },
  ],
  gauge,
  buildGeometry: trackedGeometryFactory(
    twoFeedPattern,
    twoFeedGraph.contactNodes.map((node) => node.modelX),
    topologySnapshot(twoFeedBase.yarnPathLinks)
  ),
  minLoopHeight: 0.05,
  maxLoopHeight: 2,
  tolerance,
});
assert.deepEqual(
  twoFeedResults.map(({ feedIndex, yarnIndex }) => ({ feedIndex, yarnIndex })),
  [
    { feedIndex: 0, yarnIndex: 0 },
    { feedIndex: 1, yarnIndex: 0 },
  ]
);
assert.ok(
  twoFeedResults.every(
    (result) =>
      result.status === CONVERGED &&
      result.converged === true &&
      result.error <= tolerance
  )
);
for (const result of twoFeedResults) {
  const expectedLinkIndices = twoFeedBase.yarnPathLinks
    .filter((link) => link.row % 2 === result.feedIndex)
    .map((link) => link.index);
  assert.deepEqual([...result.solvedPathByLink.keys()], expectedLinkIndices);
}
assert.notEqual(
  twoFeedResults[0].solvedLoopHeight,
  twoFeedResults[1].solvedLoopHeight
);
assert.notEqual(
  twoFeedResults[0].solvedPathByLink,
  twoFeedResults[1].solvedPathByLink
);

const independentFeeds = [21, 23, 25, 27].map((length) => ({ yarns: [{
  yarnId: "shared-yarn", yarnLengthCmPer100Needles: length,
  tensionCN: null, placement: "parallel",
}] }));
const independentSnapshot = structuredClone(independentFeeds);
const fourCourseGeometry = buildGeometry(Bimp.empty(12, 8, 0)).geometry;
const independentResults = solveFeedYarnLengths({
  feeds: independentFeeds, gauge, buildGeometry: fourCourseGeometry.createModelLengthEvaluator(),
});
assert.equal(independentResults.length, 4);
independentResults.forEach((result, index) => {
  assert.equal(result.feedIndex, index);
  assert.equal(result.yarnIndex, 0);
  assert.equal(result.targetModelLengthPer100Needles,
    targetModelLengthPer100Needles([21, 23, 25, 27][index], gauge));
  assert.equal(result.converged, true);
  assert.deepEqual([...result.solvedPathByLink.keys()],
    fourCourseGeometry.yarnPathLinks.filter((link) => link.row % 4 === index).map((link) => link.index));
});
assert.deepEqual(independentFeeds, independentSnapshot);
const pairedFeeds = [{ yarns: [23, 8].map((length) => ({
  yarnId: "shared-yarn", yarnLengthCmPer100Needles: length,
  tensionCN: null, placement: "parallel",
})) }];
const pair = solveFeedYarnLengths({
  feeds: pairedFeeds, gauge, buildGeometry: baseGeometry.createModelLengthEvaluator(),
});
assert.equal(pair.length, 2);
assert.equal(pair[0].converged, true);
assert.equal(pair[1].status, UNREACHABLE_TARGET);
assert.equal(pair[1].targetModelLengthPer100Needles, targetModelLengthPer100Needles(8, gauge));
assert.notEqual(pair[0].solvedPathByLink, pair[1].solvedPathByLink);
assert.deepEqual(pairedFeeds[0].yarns.map((yarn) => yarn.yarnLengthCmPer100Needles), [23, 8]);

const unreachable = solveFeedYarnLengths({
  feeds: [
    {
      yarns: [
        {
          yarnId: "too-long",
          yarnLengthCmPer100Needles: 100,
          tensionCN: null,
          placement: "parallel",
        },
      ],
    },
  ],
  gauge,
  buildGeometry: buildOneFeedGeometry,
  minLoopHeight: 0.05,
  maxLoopHeight: 2,
  tolerance,
})[0];
assert.equal(unreachable.status, UNREACHABLE_TARGET);
assert.equal(unreachable.converged, false);
assert.ok(
  unreachable.targetModelLengthPer100Needles >
    unreachable.reachableRange.maxModelLengthPer100Needles
);

// Domain validation is distinct from the Simulation layer's safe fallback.
for (const invalid of [undefined, -1, NaN]) {
  assert.throws(() => solveFeedYarnLengths({
    feeds: [{ yarns: [{ yarnLengthCmPer100Needles: invalid }] }],
    gauge, buildGeometry: baseGeometry.createModelLengthEvaluator(),
  }), TypeError);
}
for (const outOfRange of [null, "", 0, 0.000001, 100]) {
  const [result] = solveFeedYarnLengths({
    feeds: [{ yarns: [{ yarnLengthCmPer100Needles: outOfRange }] }],
    gauge, buildGeometry: baseGeometry.createModelLengthEvaluator(),
  });
  assert.equal(result.status, UNREACHABLE_TARGET);
  assert.equal(result.converged, false);
}

const runtimeSources = [
  "src/simulation/drawYarnSimulation.js",
  "src/components/runSimulation.js",
].map((file) => fs.readFileSync(file, "utf8"));
for (const source of runtimeSources) {
  assert.doesNotMatch(source, /yarnLengthSolver|solveFeedYarnLengths/);
}

console.log(
  JSON.stringify(
    results.map((result, index) => ({
      cmPer100Needles: requestedLengths[index],
      target: result.targetModelLengthPer100Needles,
      solved: result.solvedModelLengthPer100Needles,
      loopHeight: result.solvedLoopHeight,
      error: result.error,
      solvedCmPer100Needles: modelLengthToMm(result.solvedModelLengthPer100Needles, gauge) / 10,
      cmError: Math.abs(modelLengthToMm(result.solvedModelLengthPer100Needles, gauge) / 10 - requestedLengths[index]),
      iterations: recordedIterations.get(`0:${index}`),
    }))
  )
);
console.log(`Production vs independent 4096-sample reference: max error ${maxReferenceError} model units/100 needles.`);
console.log("PASS: Yarn Length Solver V1 is deterministic and isolated.");
delete globalThis.__countModelPathBuild;
delete globalThis.__countSolverIteration;
