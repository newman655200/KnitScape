// Run from the repository root: node reports/yarn-user-audit-2026-10-06/reproduce.mjs
// Records current behavior; no production source is changed.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createServer } from "vite";

globalThis.devicePixelRatio = 1;
globalThis.Path2D = class { constructor(data = "") { this.data = data; } };
globalThis.window = { btoa: value => Buffer.from(value, "binary").toString("base64"),
  clearTimeout, setTimeout, location: { search: "" } };
const context = { clearRect() {}, save() {}, restore() {}, stroke() {},
  createPattern() { return null; } };
const canvases = new Map(["back", "mid", "front"].map(id => [id,
  { id, width: 0, height: 0, style: {}, getContext: () => context }]));
const documentFixture = { title: "", documentElement: { lang: "" },
  getElementById: id => canvases.get(id) ?? {
    getBoundingClientRect: () => ({ width: 600, height: 480 }) },
  createElement: () => ({ setAttribute() {}, click() {}, remove() {} }),
  body: { appendChild() {} } };
const server = await createServer({ appType: "custom", logLevel: "silent",
  server: { middlewareMode: true } });
const outputDir = new URL("./", import.meta.url);
try {
  const [{ simulate }, { Bimp }, constants, state, cam, yarn, library,
    { getProjectData }, { createProjectPackage, readProjectPackage },
    { resolveFeedYarnPlies }] = await Promise.all([
    "/src/simulation/yarnSimulation.js", "/src/lib/Bimp.js", "/src/constants.js",
    "/src/state.js", "/src/actions/singleJerseyCamProgram.js",
    "/src/actions/yarnLibrary.js", "/src/domain/yarnLibrary.js",
    "/src/actions/exporters.js", "/src/actions/projectPackage.js",
    "/src/simulation/yarnTextureBrush.js",
  ].map(path => server.ssrLoadModule(path)));
  globalThis.document = documentFixture;
  const preview = (length, width = 48, height = 60) => {
    const result = simulate(Bimp.empty(width, height, 0), Bimp.empty(1, height, 0),
      ["#bebebe"], 1, constants.DEFAULT_YARN_PLIES,
      { machineGauge: 32, texturePerformanceMode: "solid", feeds:
        Array.from({ length: 4 }, () => ({ yarns: [{ yarnId: 0,
          yarnLengthCmPer100Needles: length, tensionCN: null, placement: "parallel" }] })) });
    result.stopSim();
    return { length, width, height, readoutCmPer100Loops: result.yarnLengthMetrics.cmPer100Loops,
      solver: result.yarnLengthSolverResults.map(item => ({ feed: item.feedIndex + 1,
        yarn: item.yarnIndex + 1, status: item.status, converged: item.converged,
        achievedCmPer100Needles: item.solvedModelLengthPer100Needles * 25.4 / 32 / 10,
        rangeCmPer100Needles: [item.reachableRange.minModelLengthPer100Needles,
          item.reachableRange.maxModelLengthPer100Needles].map(value => value * 25.4 / 32 / 10) })) };
  };
  const lengths = [23, 27, 100].map(length => preview(length));
  assert.ok(lengths.every(item => item.solver.length === 4));
  assert.ok(lengths[0].solver.every(item => item.converged));
  assert.ok(lengths[1].solver.every(item => item.converged));
  assert.ok(lengths[2].solver.every(item => item.status === "UNREACHABLE_TARGET"));
  const sampleSizes = [[4, 8], [12, 8], [48, 60]].map(([width, height]) => preview(23, width, height));

  cam.createSingleJerseyCamProgram(4, 4);
  state.dispatch({ needleArrangement: [1, 2, 3, 4],
    needleArrangementInputs: ["1234", "", "", ""], machineGauge: 32 });
  const cottonId = yarn.addYarnAsset("测试棉纱 32支 白色", "OTHER");
  const polyesterId = yarn.addYarnAsset("测试涤纶 75D 蓝色", "T");
  for (let feed = 0; feed < 4; feed++) yarn.assignYarnToFeed(feed, 0, cottonId);
  yarn.assignYarnToFeed(0, 1, polyesterId);
  cam.setSingleJerseyFeedYarnLengths([0, 1, 2, 3], 23);
  cam.setSingleJerseyFeedYarnLength(0, 1, 27);
  const intended = structuredClone(state.GLOBAL_STATE.singleJerseyCamProgram);
  const materialViews = resolveFeedYarnPlies(intended.feeds,
    state.GLOBAL_STATE.yarnLibrary, constants.DEFAULT_YARN_PLIES[0]).get(0);
  const protectedDelete = !yarn.deleteYarnAsset(cottonId);
  const asset = state.GLOBAL_STATE.yarnLibrary.find(item => item.id === cottonId);
  const normalizedExtraFields = library.normalizeYarnLibrary([
    { ...asset, color: "#ffffff", diameterMm: 0.2, yarnCount: "32 Ne", supplier: "test" }]);
  const previousLength = intended.feeds[0].yarns[0].yarnLengthCmPer100Needles;
  cam.setSingleJerseyFeedYarnLength(0, 0, -1);
  const negativeStored = state.GLOBAL_STATE.singleJerseyCamProgram.feeds[0].yarns[0].yarnLengthCmPer100Needles;
  cam.setSingleJerseyFeedYarnLength(0, 0, previousLength);
  state.dispatch({ snapshots: [], lastSnapshot: 0 });
  cam.setSingleJerseyFeedYarnLength(0, 0, 25);
  const snapshotsAfterLengthEdit = state.GLOBAL_STATE.snapshots.length;
  state.undo();
  const lengthAfterUndo = state.GLOBAL_STATE.singleJerseyCamProgram.feeds[0].yarns[0].yarnLengthCmPer100Needles;
  cam.setSingleJerseyFeedYarnLength(0, 0, previousLength);

  const project = getProjectData();
  const packaged = await createProjectPackage(project);
  await writeFile(new URL("test-project.knitscape", outputDir), Buffer.from(await packaged.arrayBuffer()));
  const reopened = await readProjectPackage(packaged);
  assert.deepEqual(reopened.project.singleJerseyCamProgram, project.singleJerseyCamProgram);
  assert.deepEqual(reopened.project.yarnLibrary, project.yarnLibrary);
  assert.deepEqual(reopened.project.needleArrangement, project.needleArrangement);
  assert.deepEqual(reopened.project.needleArrangementInputs, project.needleArrangementInputs);
  assert.equal(reopened.project.machineGauge, project.machineGauge);
  reopened.registry.clear();
  const result = { lengths, sampleSizes, protectedDelete, projectRoundTrip: true,
    assetFields: Object.keys(asset), normalizedExtraFields: Object.keys(normalizedExtraFields[0]),
    untexturedMaterials: materialViews.map(ply => ({ color: ply.color, diameter: ply.diameter })),
    negativeInput: { before: previousLength, entered: -1, stored: negativeStored },
    undo: { before: previousLength, entered: 25, snapshotsAfterLengthEdit, lengthAfterUndo },
    snapshotFields: constants.SNAPSHOT_FIELDS };
  await writeFile(new URL("algorithm-evidence.json", outputDir), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({
    lengths: lengths.map(({ length, readoutCmPer100Loops, solver }) => ({
      inputCmPer100Needles: length, readoutCmPer100Loops,
      statuses: solver.map(item => item.status),
      achievedCmPer100Needles: solver.map(item => item.achievedCmPer100Needles),
    })),
    sampleSizes: sampleSizes.map(({ width, height, readoutCmPer100Loops }) =>
      ({ width, height, readoutCmPer100Loops })),
    protectedDelete, projectRoundTrip: true, negativeInput: result.negativeInput,
    undo: result.undo, untexturedMaterials: result.untexturedMaterials,
  }, null, 2));
  console.log("Audit evidence recorded. Passing model/package assertions do not imply user acceptance.");
} finally { await server.close(); }
