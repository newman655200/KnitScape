import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";
import {
  CONVERGED,
  UNREACHABLE_TARGET,
  solveFeedYarnLengths,
} from "../src/simulation/yarnLengthSolver.js";

const packageJSON = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(
  packageJSON.scripts["validate:yarn-length-solver"],
  "node --experimental-default-type=module scripts/validate-yarn-length-solver.mjs"
);

let modelPathBuilds = 0;
globalThis.__countModelPathBuild = () => { modelPathBuilds += 1; };
const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
  plugins: [{
    name: "count-model-path-materialization",
    enforce: "pre",
    transform(source, id) {
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
const results = solveFeedYarnLengths({
  feeds: [oneFeed],
  gauge,
  buildGeometry: buildOneFeedGeometry,
  minLoopHeight: 0.05,
  maxLoopHeight: 2,
  tolerance,
});
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
    }))
  )
);
console.log("PASS: Yarn Length Solver V1 is deterministic and isolated.");
delete globalThis.__countModelPathBuild;
