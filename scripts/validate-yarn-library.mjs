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
let savedJSON, savedUrl, savedName;
const documentFixture = {
  title: "", documentElement: { lang: "" },
  getElementById: () => ({ getBoundingClientRect: () => ({ width: 600, height: 480 }) }),
  createElement: () => ({ setAttribute(key, value) {
    if (key === "href") savedUrl = value;
    if (key === "download") savedName = value;
  }, click() {}, remove() {} }),
  body: { appendChild() {} },
};
try {
  const [{ normalizeYarnLibrary, queryYarnLibrary, YARN_CATEGORIES }, actions,
    cam, stateModule, exporters, importers, { view }, { translations },
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
  const { getProjectData, downloadProject } = exporters;
  const { loadJSON, loadProjectFile } = importers;
  assert.equal(typeof getProjectData, "function", "Project metadata serialization must exist.");
  const { yarnAssetRegistry } = await server.ssrLoadModule("/src/yarnTexture/yarnAssetRegistry.js");
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
  savedJSON = getProjectData();
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
  // PBR belongs to the Yarn Asset; runtime maps contain metadata and binary references.
  assert.equal(typeof actions.importYarnPbr, "function", "Yarn PBR group import must exist.");
  const scan = await server.ssrLoadModule("/src/yarnTexture/yarnScanTexture.js");
  const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  const pixelBytes = Buffer.from(pixel.split(",")[1], "base64");
  const file = name => new File([pixelBytes], name, { type: "image/png" });
  let imageLoads = 0, fileReads = 0, holdImages = false;
  const delayedImages = [];
  globalThis.FileReader = class {
    readAsDataURL(file) { fileReads++; this.result = file.dataUrl; queueMicrotask(() => this.onload()); }
  };
  globalThis.Image = class {
    naturalWidth = 64; naturalHeight = 32;
    set src(value) {
      imageLoads++;
      const complete = () => fetch(value).then(response => response.arrayBuffer()).then(data =>
        Buffer.from(data).equals(pixelBytes) ? this.onload() : this.onerror()).catch(() => this.onerror());
      if (holdImages) delayedImages.push(complete); else complete();
    }
  };
  const createElement = documentFixture.createElement;
  documentFixture.createElement = tag => tag === "canvas" ? {
    getContext: () => ({ drawImage() {} }), toDataURL: () => pixel,
  } : createElement();
  const fullFiles = ["Cotton_BASECOLOR.PNG", "Cotton_Normal.png", "Cotton_Roughness.png",
    "Cotton_DISPLACEMENT.png", "Cotton_AmbientOcclusion.png"].map(file);
  const keys = ["baseColor", "normal", "roughness", "height", "ambientOcclusion"];
  const synonyms = { "Albedo.png": "baseColor", "diffuse.PNG": "baseColor",
    "yarnBaseColor.png": "baseColor", "Normal_GL.png": "normal", "HEIGHT.png": "height",
    "Ambient_Occlusion.png": "ambientOcclusion", "AO.png": "ambientOcclusion" };
  for (const [name, key] of Object.entries(synonyms)) assert.equal(scan.identifyPbrMap(name), key);
  assert.equal(scan.identifyPbrMap("readme.txt"), null);
  const camBeforePbr = structuredClone(state().singleJerseyCamProgram);
  const pliesBeforePbr = structuredClone(state().yarnPlies);
  await actions.importYarnPbr(ids[0], fullFiles);
  await actions.importYarnPbr(ids[1], fullFiles.slice(0, 3));
  const pbrA = actions.getYarnPbr(ids[0]), pbrB = actions.getYarnPbr(ids[1]);
  assert.deepEqual(keys.filter(key => pbrA[key]), keys);
  assert.deepEqual(keys.filter(key => pbrB[key]), keys.slice(0, 3));
  assert.equal(actions.getYarnPbr(ids[2]), null);
  assert.ok(pbrA.previewDataUrl.startsWith("data:image/png;base64,"));
  for (const key of keys) {
    assert.equal(pbrA[key].dataUrl, undefined);
    assert.equal(pbrA[key].processedDataUrl, undefined);
    const blob = await yarnAssetRegistry.getBlob(pbrA[key].assetRef);
    assert.deepEqual(Buffer.from(await blob.arrayBuffer()), pixelBytes);
  }
  const loadsAfterImport = imageLoads, readsAfterImport = fileReads;
  // Listing 100 assets must not read/decode full PBR files, even when every asset owns maps.
  stateModule.dispatch({ yarnLibrary: state().yarnLibrary.map(asset => ({ ...asset, pbr: pbrA })) });
  queryYarnLibrary(state().yarnLibrary); view();
  assert.equal(imageLoads, loadsAfterImport);
  assert.equal(fileReads, readsAfterImport);
  for (let i = 0; i < 100; i++) assert.equal(actions.getYarnPbr(ids[0]), pbrA);
  assert.equal(imageLoads, loadsAfterImport, "PBR access reuses stored maps without decoding.");
  // Restore independent full/partial/absent assets for round-trip and lifecycle checks.
  stateModule.dispatch({ yarnLibrary: state().yarnLibrary.map(asset => {
    const { pbr, ...metadata } = asset;
    return asset.id === ids[0] ? { ...metadata, pbr: pbrA }
      : asset.id === ids[1] ? { ...metadata, pbr: pbrB } : metadata;
  }) });
  actions.updateYarnAsset(ids[0], "PBR yarn", "CD");
  assert.equal(actions.getYarnPbr(ids[0]), pbrA, "metadata editing must preserve material.");
  const pbrLibrary = structuredClone(state().yarnLibrary);
  savedJSON = getProjectData();
  stateModule.dispatch({ yarnLibrary: [] }); loadJSON(savedJSON);
  assert.deepEqual(state().yarnLibrary, pbrLibrary, "full, partial and absent PBR round-trip.");
  assert.deepEqual(state().singleJerseyCamProgram, camBeforePbr);
  assert.deepEqual(state().yarnPlies, pliesBeforePbr, "Asset PBR must not reach legacy Renderer inputs.");
  await actions.importYarnPbr(ids[0], [file("replacement_Albedo.png")]);
  const replacement = actions.getYarnPbr(ids[0]);
  assert.equal(replacement.baseColor.fileName, "replacement_Albedo.png");
  assert.equal(replacement.normal, null, "replace removes maps omitted from the new group.");
  await assert.rejects(actions.importYarnPbr(ids[0], [file("a_Normal.png"), file("b_Normal.png")]),
    error => error.code === "PBR_AMBIGUOUS_FILES");
  await assert.rejects(actions.importYarnPbr(ids[0], [file("unrecognized.png")]),
    error => error.code === "PBR_UNRECOGNIZED_FILES");
  await assert.rejects(actions.importYarnPbr(ids[0], [new File(["bad"], "Normal.png", { type: "image/png" })]));
  assert.equal(actions.getYarnPbr(ids[0]), replacement, "failed import must retain material.");
  actions.clearYarnPbr(ids[0]);
  assert.equal(actions.getYarnPbr(ids[0]), null);
  assert.ok(state().yarnLibrary.some(asset => asset.id === ids[0]));
  assert.equal(actions.deleteYarnAsset(ids[1]), false, "PBR must retain reference deletion protection.");
  await actions.importYarnPbr(ids[98], [file("AO.png")]);
  assert.equal(actions.deleteYarnAsset(ids[98]), true);
  assert.equal(actions.getYarnPbr(ids[98]), null);
  savedJSON = getProjectData();
  assert.equal(savedJSON.yarnLibrary.some(asset => asset.id === ids[98]), false);
  assert.deepEqual(state().singleJerseyCamProgram, camBeforePbr);
  assert.deepEqual(state().yarnPlies, pliesBeforePbr);
  assert.throws(() => normalizeYarnLibrary([{ ...pbrLibrary[1], pbr: {
    baseColor: { fileName: "absolute.png", dataUrl: "C:\\textures\\absolute.png" },
  } }]), TypeError, "absolute paths cannot be the persisted PBR payload.");
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
    assert.ok(language["yarnLibrary.pbrImport"]);
  }
  const legacyAssetProject = getProjectData();
  legacyAssetProject.yarnLibrary = legacyAssetProject.yarnLibrary.map(asset => asset.id === ids[97]
    ? { ...asset, pbr: { normal: { fileName: "legacy_Normal.png", dataUrl: pixel, processedDataUrl: pixel } } }
    : asset);
  const loadsBeforeLegacy = imageLoads;
  loadJSON(legacyAssetProject);
  assert.equal(imageLoads, loadsBeforeLegacy, "legacy migration does not decode images.");
  const legacyMap = actions.getYarnPbr(ids[97]).normal;
  assert.ok(legacyMap.assetRef);
  assert.doesNotMatch(JSON.stringify(state().yarnLibrary), /"dataUrl"|"processedDataUrl"/);
  const legacyUrl = await yarnAssetRegistry.getObjectUrl(legacyMap.assetRef);
  const libraryBeforePackage = structuredClone(state().yarnLibrary);
  stateModule.dispatch({ lastSnapshot: 0, yarnPalette: [...state().yarnPalette] });
  assert.ok(state().snapshots.length);
  assert.equal(await downloadProject(), true);
  assert.equal(state().projectExporting, false);
  assert.equal(savedName, "pattern.knitscape"); assert.match(savedUrl, /^blob:/);
  const exportedBlob = await (await fetch(savedUrl)).blob();
  assert.equal(await loadProjectFile(new File([exportedBlob], "roundtrip.knitscape")), true);
  assert.equal(state().snapshots.length, 0, "project replacement resets old history.");
  assert.equal(yarnAssetRegistry.has(legacyMap.assetRef), false);
  await assert.rejects(fetch(legacyUrl), "project replacement revokes old URLs.");
  assert.deepEqual(state().yarnLibrary.map(asset => asset.name), libraryBeforePackage.map(asset => asset.name));
  assert.equal(imageLoads, loadsBeforeLegacy, "package opening does not decode images.");
  for (const asset of state().yarnLibrary) for (const key of keys) if (asset.pbr?.[key]) {
    assert.deepEqual(Buffer.from(await (await yarnAssetRegistry.getBlob(asset.pbr[key].assetRef)).arrayBuffer()), pixelBytes);
  }
  const beforeFailedLoad = state();
  const currentRef = actions.getYarnPbr(ids[97]).normal.assetRef;
  const malformedProject = getProjectData();
  malformedProject.yarnLibrary[0].pbr = { normal: { fileName: "bad", assetRef: "missing", mimeType: "image/png", byteLength: 1 } };
  assert.throws(() => loadJSON(malformedProject), /missing/i);
  assert.equal(state(), beforeFailedLoad, "failed preparation leaves state/history unchanged.");
  assert.equal(yarnAssetRegistry.has(currentRef), true);
  await assert.rejects(loadProjectFile(new File(["invalid"], "broken.knitscape")));
  assert.equal(state(), beforeFailedLoad);
  holdImages = true;
  const oldImport = actions.importYarnPbr(ids[97], [file("old_Normal.png")]);
  assert.equal(delayedImages.length, 1);
  const nextProject = getProjectData();
  nextProject.yarnLibrary = nextProject.yarnLibrary.map(asset => {
    if (asset.id !== ids[97]) return asset;
    const { pbr, ...metadata } = asset; return { ...metadata, name: "New project yarn" };
  });
  loadJSON(nextProject);
  holdImages = false; delayedImages.shift()();
  assert.equal(await oldImport, false, "stale import must not write into a new project with the same id.");
  assert.equal(actions.getYarnPbr(ids[97]), null);
  holdImages = true;
  const firstImport = actions.importYarnPbr(ids[97], [file("first_Normal.png")]);
  const latestImport = actions.importYarnPbr(ids[97], [file("latest_AO.png")]);
  holdImages = false;
  delayedImages.pop()(); assert.equal(await latestImport, true);
  delayedImages.shift()(); assert.equal(await firstImport, false);
  assert.equal(actions.getYarnPbr(ids[97]).ambientOcclusion.fileName, "latest_AO.png");
  const clearRef = actions.getYarnPbr(ids[97]).ambientOcclusion.assetRef;
  const clearUrl = await yarnAssetRegistry.getObjectUrl(clearRef);
  actions.clearYarnPbr(ids[97]);
  assert.equal(yarnAssetRegistry.has(clearRef), false); await assert.rejects(fetch(clearUrl));
  // Real external legacy JSON contains embedded maps, never runtime-only refs.
  const externalProject = { ...getProjectData(), yarnLibrary: state().yarnLibrary.map(asset => {
    const { pbr, ...metadata } = asset; return metadata;
  }) };
  let releaseOldFile;
  const oldFileLoad = loadProjectFile({ name: "old.json", text: () => new Promise(resolve => { releaseOldFile = resolve; }) });
  const latestFileProject = structuredClone(externalProject); latestFileProject.yarnLibrary[0].name = "Latest project";
  assert.equal(await loadProjectFile(new File([JSON.stringify(latestFileProject)], "latest.json")), true);
  releaseOldFile(JSON.stringify(externalProject)); assert.equal(await oldFileLoad, false);
  assert.equal(state().yarnLibrary[0].name, "Latest project");
  const libraryBeforePattern = state().yarnLibrary;
  const patternOnly = getProjectData();
  for (const key of ["yarnLibrary", "singleJerseyCamProgram", "needleArrangement", "needleArrangementInputs", "machineGauge"]) delete patternOnly[key];
  loadJSON(patternOnly); assert.equal(state().yarnLibrary, libraryBeforePattern);
  assert.match(fs.readFileSync("src/actions/importers.js", "utf8"), /\.knitscape.*\.json/);
  assert.match(fs.readFileSync("src/views/downloadModal.js", "utf8"), /downloadProject/);
  for (const language of Object.values(translations)) {
    for (const key of ["download.projectPackage", "alerts.projectImportFailed", "alerts.projectExportFailed"]) assert.ok(language[key]);
  }
  console.log("PASS: Yarn Library supports 100 Assets, query, CRUD, N slots, safe references, binary PBR references, lazy access and project round-trip.");
} finally { await server.close(); }
