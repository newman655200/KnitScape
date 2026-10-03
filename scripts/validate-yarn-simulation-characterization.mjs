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

const documentFixture = {
  getElementById(id) {
    if (id === "sim-container") {
      return { getBoundingClientRect: () => ({ width: 320, height: 240 }) };
    }
    return canvases.get(id);
  },
};

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
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
  function preview(feeds, inputPattern = pattern) {
    const snapshot = structuredClone(feeds);
    const pixels = Array.from(inputPattern.pixels);
    const start = pathData.length;
    const output = simulate(
      inputPattern,
      Bimp.empty(1, inputPattern.height, 0),
      ["#cc3366"],
      1,
      constants.DEFAULT_YARN_PLIES,
      {
        machineGauge: 32,
        texturePerformanceMode: constants.TEXTURE_PERFORMANCE_MODES.SOLID,
        ...(feeds === undefined ? {} : { feeds }),
      }
    );
    output.stopSim();
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
  for (let index = 1; index < solved.length; index++) {
    assert.ok(solved[index].solvedLoopHeight > solved[index - 1].solvedLoopHeight);
    assert.ok(
      solved[index].solvedModelLengthPer100Needles >
        solved[index - 1].solvedModelLengthPer100Needles
    );
    assert.notDeepEqual(finalPreviews[index].paths, finalPreviews[index - 1].paths);
  }
  for (const invalid of [undefined, null, 0, -1, "invalid", Infinity]) {
    const fallback = preview(feed(invalid));
    assert.deepEqual(fallback.paths, design.paths);
    assert.deepEqual(fallback.yarnLengthSolverResults, []);
  }
  const unreachable = preview(feed(100));
  assert.equal(unreachable.yarnLengthSolverResults[0].status, "UNREACHABLE_TARGET");
  assert.deepEqual(unreachable.paths, design.paths);
  const multipleYarns = preview(feed(23, 21));
  assert.deepEqual(multipleYarns.paths, finalPreviews[1].paths);
  assert.deepEqual(multipleYarns.yarnLengthSolverResults.map((item) => item.yarnIndex), [0, 1]);
  assert.ok(multipleYarns.yarnLengthSolverResults.every((item) => item.converged));
  const secondaryOnly = preview(feed(null, 23));
  assert.deepEqual(secondaryOnly.paths, design.paths, "second Yarn must not replace the main Yarn.");
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
}

console.log("PASS: yarn simulation preserves the original fixture and renders solved main Yarn paths.");
