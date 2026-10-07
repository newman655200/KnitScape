import assert from "node:assert/strict";
import { createServer } from "vite";

globalThis.devicePixelRatio = 1;

const pathData = [];
globalThis.Path2D = class Path2D {
  constructor(data = "") {
    this.data = data;
    pathData.push(data);
  }
};

function createContext() {
  return {
    clearRect() {},
    save() {},
    restore() {},
    stroke() {},
    createPattern() {
      return null;
    },
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    lineCap: "round",
    lineJoin: "round",
    lineWidth: 1,
    strokeStyle: "#000",
  };
}

const canvases = new Map(
  ["back", "mid", "front"].map((id) => [
    id,
    {
      id,
      width: 0,
      height: 0,
      style: {},
      getContext: () => createContext(),
    },
  ])
);

const viewport = { width: 320, height: 240 };
const documentFixture = {
  getElementById(id) {
    if (id === "sim-container") {
      return { getBoundingClientRect: () => ({ ...viewport }) };
    }
    return canvases.get(id);
  },
};

let solverCalls = 0;
let geometryCalls = 0;
globalThis.__countYarnLengthSolverCall = () => { solverCalls += 1; };
globalThis.__countYarnLengthGeometryCall = () => { geometryCalls += 1; };
const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
  plugins: [{
    name: "count-real-yarn-length-solver",
    enforce: "pre",
    transform(source, id) {
      if (id.replaceAll("\\", "/").endsWith("/src/simulation/yarnPathGeometry.js")) {
        return source.replace("export function buildYarnPathGeometry(", "function measuredBuildYarnPathGeometry(") +
          `\nexport function buildYarnPathGeometry(options) {
            if (!options.measurementWindow) globalThis.__countYarnLengthGeometryCall();
            return measuredBuildYarnPathGeometry(options);
          }\n`;
      }
      if (!id.replaceAll("\\", "/").endsWith("/src/simulation/yarnLengthSolver.js")) return;
      return source.replace(
        "export function solveFeedYarnLengths(",
        "function measuredSolveFeedYarnLengths("
      ) + `\nexport function solveFeedYarnLengths(options) {
        globalThis.__countYarnLengthSolverCall();
        return measuredSolveFeedYarnLengths(options);
      }\n`;
    },
  }],
});
globalThis.document = documentFixture;

try {
  const [{ simulate }, { Bimp }, constants] = await Promise.all([
    server.ssrLoadModule("/src/simulation/yarnSimulation.js"),
    server.ssrLoadModule("/src/lib/Bimp.js"),
    server.ssrLoadModule("/src/constants.js"),
  ]);

  const result = simulate(
    Bimp.empty(4, 8, 0),
    new Bimp(1, 8, Array(8).fill(0)),
    ["#cc3366"],
    1,
    constants.DEFAULT_YARN_PLIES,
    {
      machineGauge: 7,
      texturePerformanceMode: constants.TEXTURE_PERFORMANCE_MODES.SOLID,
    }
  );
  result.stopSim();

  assert.equal(result.yarnLengthMetrics.gauge, 7);
  assert.equal(
    result.yarnLengthMetrics.needlePitchMm,
    3.6285714285714286
  );
  assert.ok(
    Math.abs(
      result.yarnLengthMetrics.totalPathLengthStitchUnits -
        94.76508273180484
    ) < 1e-9
  );
  assert.equal(result.yarnLengthMetrics.effectiveLoopCount, 32);
  assert.ok(
    Math.abs(result.yarnLengthMetrics.cmPer100Loops - 107.45683488338587) <
      1e-9
  );
  assert.equal(pathData.length, 195);
  assert.equal(new Set(pathData.filter(Boolean)).size, 195);
  for (const canvas of canvases.values()) {
    assert.deepEqual([canvas.width, canvas.height], [320, 240]);
  }

  const [
    { Pattern },
    { ProcessModel },
    { YarnModel },
    { buildYarnPathGeometry },
    { pathEndpoints },
  ] = await Promise.all([
    server.ssrLoadModule("/src/simulation/Pattern.js"),
    server.ssrLoadModule("/src/simulation/ProcessModel.js"),
    server.ssrLoadModule("/src/simulation/YarnModel.js"),
    server.ssrLoadModule("/src/simulation/yarnPathGeometry.js"),
    server.ssrLoadModule("/src/simulation/rowLengthLoopModel.js"),
  ]);
  const pattern = Bimp.empty(12, 1, 0);
  const patternSnapshot = Array.from(pattern.pixels);
  const feed = (...lengths) => [{
    yarns: lengths.map((length, index) => ({
      yarnId: `yarn-${index}`,
      yarnLengthCmPer100Needles: length,
      tensionCN: null,
      placement: "parallel",
    })),
  }];
  function preview(feeds, inputPattern = pattern, {
    scale = 1,
    palette = ["#cc3366"],
    yarnPlies = constants.DEFAULT_YARN_PLIES,
    ...options
  } = {}) {
    const snapshot = structuredClone(feeds);
    const pixels = Array.from(inputPattern.pixels);
    const start = pathData.length;
    const geometryCallsBefore = geometryCalls;
    const output = simulate(
      inputPattern,
      Bimp.empty(1, inputPattern.height, 0),
      palette,
      scale,
      yarnPlies,
      {
        machineGauge: 32,
        texturePerformanceMode: constants.TEXTURE_PERFORMANCE_MODES.SOLID,
        ...(feeds === undefined ? {} : { feeds }),
        ...options,
      }
    );
    output.stopSim();
    assert.equal(geometryCalls, geometryCallsBefore + 1,
      "Solver candidates must not rebuild full Geometry; only the original preview builds it.");
    assert.deepEqual(feeds, snapshot, "preview must not mutate Feed Yarn data.");
    assert.deepEqual(Array.from(inputPattern.pixels), pixels);
    assert.deepEqual(Array.from(pattern.pixels), patternSnapshot);
    return { ...output, paths: pathData.slice(start) };
  }
  function geometryAt(modelLoopHeight = null, inputPattern = pattern) {
    const stitchPattern = new Pattern(inputPattern.pad(1, 0, 0));
    const graph = new YarnModel(new ProcessModel(stitchPattern).cn);
    const geometry = buildYarnPathGeometry({
      pattern: inputPattern,
      stitchPattern,
      yarnGraph: graph,
      canvasWidth: 320,
      canvasHeight: 240,
      primaryLengthScaleY: 1,
      primaryYarnDiameter: 0.24,
      machineGauge: 32,
      modelLoopHeight,
    });
    return { geometry, needleX: graph.contactNodes.map((node) => node.x) };
  }
  const design = preview();
  const base = geometryAt();
  const modelSnapshot = [...base.geometry.modelPathByLink];
  const canvasSnapshot = [...base.geometry.resolvedPathByLink];
  const lengths = [21, 23, 27];
  const finalPreviews = lengths.map((length) => preview(feed(length)));
  const solvedCalls = solverCalls;
  assert.ok(solvedCalls >= 3, "initial valid lengths must invoke the real Solver.");
  const rebuilt = preview(structuredClone(feed(27)), new Bimp(12, 1, [...pattern.pixels]));
  assert.deepEqual(rebuilt.yarnLengthSolverResults, finalPreviews[2].yarnLengthSolverResults);
  assert.equal(solverCalls, solvedCalls, "identical structural inputs must reuse the Solver result.");
  preview(feed(27), pattern, { scale: 2 });
  assert.equal(solverCalls, solvedCalls, "display scale must not rerun the Solver.");
  const solved = finalPreviews.map((output) => {
    assert.equal(output.yarnLengthSolverResults.length, 1);
    const [result] = output.yarnLengthSolverResults;
    assert.equal(result.converged, true);
    assert.ok(result.error <= 0.01);
    const candidate = geometryAt(result.solvedLoopHeight);
    assert.deepEqual(candidate.needleX, base.needleX, "X needle positions stay fixed.");
    assert.deepEqual(candidate.geometry.yarnPathLinks, base.geometry.yarnPathLinks);
    const canvasPaths = new Map(base.geometry.resolvedPathByLink);
    result.solvedPathByLink.forEach((modelPath, linkIndex) => {
      assert.equal(modelPath, candidate.geometry.modelPathByLink.get(linkIndex),
        "optimized Solver paths must exactly match the original full geometry builder.");
      canvasPaths.set(linkIndex, base.geometry.modelPathToCanvas(modelPath));
    });
    const expectedPaths = ["back", "front", "mid"].flatMap((layer) =>
      base.geometry.yarnPathLinks
        .filter((link) => link.layer === layer)
        .map((link) => canvasPaths.get(link.index))
        .filter(Boolean)
    );
    assert.deepEqual(output.paths, expectedPaths, "draw must consume solved Canvas paths.");
    assert.notDeepEqual(output.paths, design.paths);
    assert.deepEqual(preview().paths, design.paths, "design original must stay unchanged.");
    return result;
  });
  // Corrected periodic, high-precision scalar baselines.
  assert.deepEqual(solved.map((result) => [
    result.solvedLoopHeight,
    result.solvedModelLengthPer100Needles,
    result.error,
  ]), [
    [0.3667083740234376, 264.55848407606294, 0.008445057795370303],
    [0.47929992675781247, 289.7620645905616, 0.0017149369974731599],
    [0.7258468627929688, 340.1574557820884, 0.000024532872259896976],
  ]);
  for (let index = 0; index < lengths.length; index++) {
    const originalResult = preview(feed(lengths[index]));
    const callCount = solverCalls;
    preview();
    const repeated = preview(structuredClone(feed(lengths[index])));
    assert.equal(solverCalls, callCount, "design original must not evict final preview cache.");
    assert.deepEqual(originalResult.yarnLengthSolverResults, finalPreviews[index].yarnLengthSolverResults);
    assert.deepEqual(repeated.yarnLengthSolverResults, finalPreviews[index].yarnLengthSolverResults);
    assert.deepEqual(repeated.paths, finalPreviews[index].paths);
  }

  const stableResult = preview(feed(27));
  const stableSnapshot = structuredClone(stableResult.yarnLengthSolverResults);
  const stableCalls = solverCalls;
  stableResult.yarnLengthSolverResults[0].solvedPathByLink.clear();
  stableResult.yarnLengthSolverResults[0].reachableRange.minLoopHeight = 100;
  stableResult.yarnLengthSolverResults[0].solvedLoopHeight = 100;
  stableResult.yarnLengthSolverResults.push({ corrupted: true });
  assert.deepEqual(preview(feed(27)).yarnLengthSolverResults, stableSnapshot,
    "mutating returned diagnostic objects/Maps must not pollute cached results.");
  assert.equal(solverCalls, stableCalls);

  for (const displayOptions of [
    { scale: 0.6 },
    { texturePerformanceMode: constants.TEXTURE_PERFORMANCE_MODES.AUTO, texturePreviewInteractionActive: true },
    { palette: ["#224466"] },
    { yarnPlies: constants.DEFAULT_YARN_PLIES.map((ply) => ({
      ...ply, color: "#224466", texture: { enabled: false, textureSize: 512 },
    })) },
  ]) {
    assert.deepEqual(preview(feed(27), pattern, displayOptions).yarnLengthSolverResults, stableSnapshot);
    assert.equal(solverCalls, stableCalls, "display/material changes must not rerun the Solver.");
  }
  Object.assign(viewport, { width: 640, height: 480 });
  const resized = preview(feed(27));
  assert.deepEqual(resized.yarnLengthSolverResults, stableSnapshot);
  assert.notDeepEqual(resized.paths, finalPreviews[2].paths, "Canvas resize must still redraw display geometry.");
  assert.equal(solverCalls, stableCalls, "Canvas resize must not rerun the Solver.");
  Object.assign(viewport, { width: 320, height: 240 });

  function expectRecompute(nextFeeds, nextPattern = pattern, options = {}) {
    const callCount = solverCalls;
    const result = preview(nextFeeds, nextPattern, options);
    assert.ok(solverCalls > callCount, "a real Solver input change must invalidate the result cache.");
    return result;
  }
  expectRecompute(feed(27), pattern, { machineGauge: 30 });
  expectRecompute(feed(27));
  const gaugeCalls = solverCalls;
  assert.deepEqual(preview(feed("27"), pattern, { machineGauge: "32" }).yarnLengthSolverResults, stableSnapshot);
  assert.equal(solverCalls, gaugeCalls, "equivalent normalized Gauge/length values must reuse results.");
  expectRecompute(feed(27), Bimp.empty(14, 1, 0));
  expectRecompute(feed(27), Bimp.empty(12, 2, 0));
  expectRecompute(feed(27));
  const tuckPattern = new Bimp(12, 1, [...pattern.pixels].map((pixel, index) => index === 3 ? 3 : pixel));
  expectRecompute(feed(27), tuckPattern);
  expectRecompute(feed(27));
  expectRecompute(feed(23));
  expectRecompute([...feed(23), ...feed(21)]);
  expectRecompute(feed(23, 21));
  const reordered = expectRecompute(feed(21, 23));
  assert.equal(reordered.yarnLengthSolverResults[0].targetModelLengthPer100Needles,
    finalPreviews[0].yarnLengthSolverResults[0].targetModelLengthPer100Needles);
  const indexed = expectRecompute(feed(null, 23));
  assert.equal(indexed.yarnLengthSolverResults[0].yarnIndex, 1);
  expectRecompute(feed(27));
  expectRecompute(feed(27), pattern, {
    yarnPlies: constants.DEFAULT_YARN_PLIES.map((ply, index) => index === 0 ? { ...ply, diameter: 0.3 } : ply),
  });
  expectRecompute(feed(27), pattern, {
    yarnPlies: constants.DEFAULT_YARN_PLIES.map((ply, index) => index === 0 ? { ...ply, lengthScaleY: 1.05 } : ply),
  });
  expectRecompute(feed(27));
  for (let index = 1; index < solved.length; index++) {
    assert.ok(solved[index].solvedLoopHeight > solved[index - 1].solvedLoopHeight);
    assert.ok(
      solved[index].solvedModelLengthPer100Needles >
        solved[index - 1].solvedModelLengthPer100Needles
    );
    assert.notDeepEqual(finalPreviews[index].paths, finalPreviews[index - 1].paths);
  }
  const validCalls = solverCalls;
  for (const invalid of [undefined, null, "", 0, -1, NaN, "invalid", Infinity]) {
    const fallback = preview(feed(invalid));
    assert.deepEqual(fallback.paths, design.paths);
    assert.deepEqual(fallback.yarnLengthSolverResults, []);
  }
  assert.equal(solverCalls, validCalls, "missing/invalid yarn length must not call the Solver.");
  const unreachable = preview(feed(100));
  assert.equal(unreachable.yarnLengthSolverResults[0].status, "UNREACHABLE_TARGET");
  assert.deepEqual(unreachable.paths, design.paths);
  const unreachableCalls = solverCalls;
  assert.deepEqual(preview(feed(100)).yarnLengthSolverResults, unreachable.yarnLengthSolverResults);
  assert.equal(solverCalls, unreachableCalls, "UNREACHABLE_TARGET diagnostics must be reusable with original paths.");
  const multipleYarns = preview(feed(23, 21));
  assert.equal(multipleYarns.paths.length, finalPreviews[1].paths.length * 2,
    "both Feed Yarn geometries must be drawn while single-Yarn baselines remain unchanged.");
  assert.deepEqual(multipleYarns.yarnLengthSolverResults.map((item) => item.yarnIndex), [0, 1]);
  assert.ok(multipleYarns.yarnLengthSolverResults.every((item) => item.converged));
  const secondaryOnly = preview(feed(null, 23));
  assert.equal(secondaryOnly.paths.length, design.paths.length * 2,
    "the first Yarn keeps its base path while the second Yarn renders its own solved path.");
  assert.equal(secondaryOnly.yarnLengthSolverResults[0].yarnIndex, 1);
  assert.equal(secondaryOnly.yarnLengthSolverResults[0].converged, true);
  const extraFeed = preview([...feed(23), ...feed(21)]);
  assert.deepEqual(extraFeed.paths, finalPreviews[1].paths, "uncovered Feed must not disable valid covered Feed.");
  assert.deepEqual(extraFeed.yarnLengthSolverResults.map((item) => item.feedIndex), [0]);
  const multiCoursePattern = Bimp.empty(12, 8, 0);
  const multiCourse = geometryAt(null, multiCoursePattern).geometry;
  const mixedFeeds = preview([...feed(21), ...feed(27)], multiCoursePattern);
  assert.equal(mixedFeeds.yarnLengthSolverResults.length, 2);
  assert.ok(mixedFeeds.yarnLengthSolverResults.every((item) => item.converged));
  const multiCourseCalls = solverCalls;
  assert.deepEqual(preview([...feed(21), ...feed(27)], Bimp.empty(12, 8, 0)).yarnLengthSolverResults,
    mixedFeeds.yarnLengthSolverResults);
  assert.equal(solverCalls, multiCourseCalls, "all Feed course results must be reused for equivalent topology.");
  const drawOrder = ["back", "front", "mid"].flatMap((layer) =>
    multiCourse.yarnPathLinks.filter((link) => link.layer === layer)
  );
  assert.equal(mixedFeeds.paths.length, drawOrder.length);
  const drawnPaths = new Map(drawOrder.map((link, index) => [link.index, mixedFeeds.paths[index]]));
  // Model C curves have six decimal places; convert their existing 1e-6 continuity tolerance.
  const endpointTolerance = multiCourse.stitchWidth * 1e-6;
  for (let index = 1; index < multiCourse.yarnPathLinks.length; index++) {
    const previous = multiCourse.yarnPathLinks[index - 1];
    const current = multiCourse.yarnPathLinks[index];
    const baselineEnd = pathEndpoints(multiCourse.resolvedPathByLink.get(previous.index)).end;
    const baselineStart = pathEndpoints(multiCourse.resolvedPathByLink.get(current.index)).start;
    if (Math.hypot(baselineEnd.x - baselineStart.x, baselineEnd.y - baselineStart.y) > endpointTolerance) continue;
    const end = pathEndpoints(drawnPaths.get(previous.index)).end;
    const start = pathEndpoints(drawnPaths.get(current.index)).start;
    assert.ok(
      Math.hypot(end.x - start.x, end.y - start.y) <= endpointTolerance,
      `shared endpoint ${previous.index}/${current.index} (courses ${previous.row}/${current.row}): ` +
        `Canvas dx=${end.x - start.x}, dy=${end.y - start.y}; ` +
        `Model dx=${(end.x - start.x) / multiCourse.stitchWidth}, dy=${(end.y - start.y) / multiCourse.stitchWidth}.`
    );
  }

  const distinctTopology = new Bimp(12, 2,
    Array.from({ length: 24 }, (_, index) => index === 15 ? 3 : 0));
  const distinctCalls = solverCalls;
  const distinctFeeds = preview([...feed(23), ...feed(23)], distinctTopology);
  assert.equal(solverCalls, distinctCalls + 2, "different Feed course topologies must be solved independently.");
  assert.equal(distinctFeeds.yarnLengthSolverResults.length, 2);
  for (const result of distinctFeeds.yarnLengthSolverResults) {
    assert.equal(result.converged, true);
    const candidate = geometryAt(result.solvedLoopHeight, distinctTopology).geometry;
    const expected = new Map(candidate.yarnPathLinks
      .filter((link) => link.row % 2 === result.feedIndex)
      .map((link) => [link.index, candidate.modelPathByLink.get(link.index)]));
    assert.deepEqual(result.solvedPathByLink, expected,
      "each Feed result must contain its own course paths from the unchanged full geometry builder.");
    assert.ok(Math.abs(result.solvedModelLengthPer100Needles -
      candidate.measuredModelLengthPer100NeedlesByCourse.get(result.feedIndex)) < 1e-9);
  }
  assert.notEqual(distinctFeeds.yarnLengthSolverResults[0].solvedLoopHeight,
    distinctFeeds.yarnLengthSolverResults[1].solvedLoopHeight,
    "equal target lengths with different course topology must not share a solved height.");
  assert.deepEqual([...base.geometry.modelPathByLink], modelSnapshot);
  assert.deepEqual([...base.geometry.resolvedPathByLink], canvasSnapshot);
  console.log(JSON.stringify(solved.map((item, index) => ({
    cmPer100Needles: lengths[index],
    loopHeight: item.solvedLoopHeight,
    measuredModelLengthPer100Needles: item.solvedModelLengthPer100Needles,
    error: item.error,
  }))));
} finally {
  await server.close();
  delete globalThis.__countYarnLengthSolverCall;
  delete globalThis.__countYarnLengthGeometryCall;
}

console.log("PASS: yarn simulation preserves the original fixture and renders independent Feed Yarn paths.");
