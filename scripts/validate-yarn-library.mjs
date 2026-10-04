import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

assert.ok(fs.existsSync("src/domain/yarnLibrary.js"), "Yarn Asset model must exist.");
globalThis.Path2D ??= class Path2D {};
globalThis.devicePixelRatio = 1;
const server = await createServer({ appType: "custom", logLevel: "silent",
  server: { middlewareMode: true } });
globalThis.window ??= { btoa: (value) => Buffer.from(value, "binary").toString("base64"),
  clearTimeout, setTimeout, location: { search: "" } };
let savedJSON;
const documentFixture = {
  title: "", documentElement: { lang: "" },
  getElementById: () => ({ getBoundingClientRect: () => ({ width: 600, height: 480 }) }),
  createElement: () => ({ setAttribute(key, value) {
    if (key === "href") savedJSON = JSON.parse(decodeURIComponent(value.split(",")[1]));
  }, click() {}, remove() {} }),
  body: { appendChild() {} },
};
try {
  const [{ normalizeYarnLibrary, queryYarnLibrary, YARN_CATEGORIES }, actions,
    cam, stateModule, { downloadJSON }, { loadJSON }, { view }, { translations },
    { resolveSingleJerseyOperations }] = await Promise.all([
    server.ssrLoadModule("/src/domain/yarnLibrary.js"),
    server.ssrLoadModule("/src/actions/yarnLibrary.js"),
    server.ssrLoadModule("/src/actions/singleJerseyCamProgram.js"),
    server.ssrLoadModule("/src/state.js"),
    server.ssrLoadModule("/src/actions/exporters.js"),
    server.ssrLoadModule("/src/actions/importers.js"),
    server.ssrLoadModule("/src/views/view.js"),
    server.ssrLoadModule("/src/i18n/translations.js"),
    server.ssrLoadModule("/src/domain/singleJerseyMachine.js"),
  ]);
  globalThis.document = documentFixture;
  const state = () => stateModule.GLOBAL_STATE;
  assert.deepEqual(YARN_CATEGORIES, ["T", "CD", "N", "OP", "OTHER"]);
  const ids = Array.from({ length: 100 }, (_, i) => actions.addYarnAsset(
    `Yarn ${String(i).padStart(3, "0")}`, YARN_CATEGORIES[i % 5]));
  assert.equal(new Set(ids).size, 100);
  const library = state().yarnLibrary;
  assert.equal(library.length, 101); // Includes the existing default yarnId 0.
  for (const asset of library) {
    assert.deepEqual(Object.keys(asset).sort(), ["category", "createdAt", "id", "name", "updatedAt"]);
    assert.ok(Number.isFinite(Date.parse(asset.createdAt)));
    assert.ok(Number.isFinite(Date.parse(asset.updatedAt)));
  }
  const snapshot = structuredClone(library);
  assert.equal(queryYarnLibrary(library, { category: "CD" }).length, 20);
  assert.equal(queryYarnLibrary(library, { search: "yarn 09" }).length, 10);
  assert.deepEqual(queryYarnLibrary(library, { search: "YARN 099", category: "OTHER" }).map(y => y.id), [ids[99]]);
  assert.deepEqual(queryYarnLibrary(library.filter(y => ids.includes(y.id)), { sort: "name" }).map(y => y.id), ids);
  const dated = [{ ...library[1], updatedAt: "2026-01-01T00:00:00.000Z" },
    { ...library[2], updatedAt: "2026-02-01T00:00:00.000Z" }];
  assert.equal(queryYarnLibrary(dated, { sort: "updated" })[0].id, dated[1].id);
  assert.deepEqual(library, snapshot, "search and sorting must not mutate Asset data.");
  assert.throws(() => actions.addYarnAsset(" ", "T"), TypeError);
  assert.throws(() => actions.addYarnAsset("bad", "UNKNOWN"), TypeError);
  const beforeEdit = { ...library[1] };
  actions.updateYarnAsset(ids[0], "Edited yarn", "OP");
  const edited = state().yarnLibrary.find(y => y.id === ids[0]);
  assert.equal(edited.createdAt, beforeEdit.createdAt);
  assert.equal(edited.name, "Edited yarn");
  assert.equal(edited.category, "OP");
  assert.ok(edited.updatedAt >= beforeEdit.updatedAt);

  cam.createSingleJerseyCamProgram(2, 4);
  cam.setSingleJerseyFeedYarns(0, [{ yarnId: 0, yarnLengthCmPer100Needles: 23,
    tensionCN: 12, placement: "parallel" }]);
  stateModule.dispatch({ needleArrangement: [1, 2], needleArrangementInputs: ["12", "", "", ""], machineGauge: 32 });
  const tracks = structuredClone(state().singleJerseyCamProgram.tracks);
  const pattern = state().chart;
  const execution = resolveSingleJerseyOperations(state().singleJerseyCamProgram, [1, 2], 8, 4);
  actions.selectYarnForAssignment(ids[0]);
  actions.assignYarnToFeed(0, 0);
  assert.deepEqual(state().singleJerseyCamProgram.feeds[0].yarns[0], {
    yarnId: ids[0], yarnLengthCmPer100Needles: 23, tensionCN: 12, placement: "parallel" });
  actions.assignYarnToFeed(1, 0);
  actions.selectYarnForAssignment(ids[1]);
  actions.assignYarnToFeed(0, 1);
  actions.selectYarnForAssignment(ids[2]);
  actions.assignYarnToFeed(0, 2);
  actions.assignYarnToFeed(0, 3);
  assert.deepEqual(state().singleJerseyCamProgram.feeds[0].yarns.map(y => y.yarnId), [ids[0], ids[1], ids[2], ids[2]]);
  assert.equal(state().singleJerseyCamProgram.feeds[1].yarns[0].yarnId, ids[0]);
  assert.equal(state().singleJerseyCamProgram.feeds[0].yarns[0].yarnLengthCmPer100Needles, 23);
  assert.equal(actions.deleteYarnAsset(ids[0]), false, "referenced Yarn deletion must be blocked.");
  assert.equal(actions.deleteYarnAsset(ids[99]), true);
  assert.equal(state().yarnLibrary.some(y => y.id === ids[99]), false);
  actions.removeFeedYarnSlot(0, 3);
  assert.equal(state().singleJerseyCamProgram.feeds[0].yarns.length, 3);
  assert.throws(() => actions.removeFeedYarnSlot(1, 0), RangeError);
  assert.deepEqual(state().singleJerseyCamProgram.tracks, tracks);
  assert.equal(state().chart, pattern);
  assert.deepEqual(resolveSingleJerseyOperations(state().singleJerseyCamProgram, [1, 2], 8, 4), execution);

  const projectState = structuredClone({ yarnLibrary: state().yarnLibrary,
    cam: state().singleJerseyCamProgram, arrangement: state().needleArrangement,
    inputs: state().needleArrangementInputs, gauge: state().machineGauge });
  downloadJSON();
  stateModule.dispatch({ yarnLibrary: [], singleJerseyCamProgram: null,
    needleArrangement: [], needleArrangementInputs: ["", "", "", ""], machineGauge: 7 });
  loadJSON(savedJSON);
  assert.deepEqual(state().yarnLibrary, projectState.yarnLibrary);
  assert.deepEqual(state().singleJerseyCamProgram, projectState.cam);
  assert.deepEqual(state().needleArrangement, projectState.arrangement);
  assert.deepEqual(state().needleArrangementInputs, projectState.inputs);
  assert.equal(state().machineGauge, projectState.gauge);
  assert.equal(state().pendingYarnId, null, "pending selection is not project data.");
  const legacyPattern = { ...savedJSON };
  for (const key of ["yarnLibrary", "singleJerseyCamProgram", "needleArrangement", "needleArrangementInputs", "machineGauge"]) delete legacyPattern[key];
  loadJSON(legacyPattern);
  assert.deepEqual(state().yarnLibrary, projectState.yarnLibrary);
  assert.deepEqual(state().singleJerseyCamProgram, projectState.cam);
  const migrated = normalizeYarnLibrary([], [{ yarns: [{ yarnId: "old-yarn" }] }]);
  assert.equal(migrated[0].id, "old-yarn");
  assert.equal(migrated[0].category, "OTHER");
  const camBeforeLegacyCheck = state().singleJerseyCamProgram;
  stateModule.dispatch({ singleJerseyCamProgram: { tracks: [["K"]] } });
  assert.equal(actions.deleteYarnAsset(0), false, "legacy implicit default slots also protect yarnId 0.");
  actions.selectYarnForAssignment(ids[0]);
  actions.assignYarnToFeed(0, 0);
  assert.equal(state().singleJerseyCamProgram.feeds[0].yarns[0].yarnId, ids[0]);
  stateModule.dispatch({ singleJerseyCamProgram: camBeforeLegacyCheck });
  const camReference = state().singleJerseyCamProgram;
  stateModule.dispatch({ workspaceMode: "yarns" });
  assert.ok(view());
  assert.equal(state().singleJerseyCamProgram, camReference);
  const viewSource = fs.readFileSync("src/views/view.js", "utf8");
  const taskbar = fs.readFileSync("src/views/taskbar.js", "utf8");
  const yarnView = fs.readFileSync("src/views/yarnLibrary.js", "utf8");
  assert.match(viewSource, /id="yarn-library-workspace"/);
  assert.match(taskbar, /workspaceMode:\s*"yarns"/);
  assert.match(yarnView, /queryYarnLibrary/);
  for (const language of Object.values(translations)) {
    assert.ok(language["workspace.yarns"]);
    assert.ok(language["yarnLibrary.inUse"]);
  }
  console.log("PASS: Yarn Library supports 100 Assets, query, CRUD, N slots, safe references and project round-trip.");
} finally { await server.close(); }
