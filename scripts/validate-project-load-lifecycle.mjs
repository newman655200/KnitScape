import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

// Exercise the real actions, StateMonitor, serialization and asset registry.
// Async source, browser layout/alert boundaries and the Undo clock are controlled.
globalThis.Path2D ??= class Path2D {};
globalThis.devicePixelRatio = 1;
let alerts = 0;
globalThis.window = { location: { search: "" }, alert() { alerts++; } };
const server = await createServer({ appType: "custom", logLevel: "silent",
  server: { middlewareMode: true } });
const failures = [];
let passed = 0;

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function project(name, width = 2, height = 3) {
  return { width, height,
    repeats: [{ bitmap: { width: 1, height: 1, pixels: [3] },
      pos: [0, 0], area: [width, height] }],
    yarnPalette: ["#123456"], yarnSequence: { width: 1, height, pixels: Array(height).fill(0) },
    yarnPlies: [], yarnLibrary: [{ id: "shared-yarn", name, category: "T",
      createdAt: "2026-10-17T00:00:00.000Z", updatedAt: "2026-10-17T00:00:00.000Z",
      pbr: { normal: { fileName: name + ".png", dataUrl: "data:image/png;base64,AAEC" } } }],
    singleJerseyCamProgram: null, needleArrangement: [],
    needleArrangementInputs: ["", "", "", ""], machineGauge: 32 };
}

async function check(name, run) {
  if (process.argv.includes("--new-undo-only") && !name.startsWith("new-undo:")) return;
  try { await run(); passed++; console.log("PASS: " + name); }
  catch (error) { failures.push(name); console.error("FAIL: " + name + "\n" + error.stack); }
}

try {
  const stateModule = await server.ssrLoadModule("/src/state.js");
  const { loadJSON, loadProjectFile, loadLibraryPattern, newPattern, uploadFile } =
    await server.ssrLoadModule("/src/actions/importers.js");
  const { getProjectData, downloadProject } = await server.ssrLoadModule("/src/actions/exporters.js");
  const { createProjectPackage, readProjectPackage } =
    await server.ssrLoadModule("/src/actions/projectPackage.js");
  const { YarnAssetRegistry, yarnAssetRegistry } = await server.ssrLoadModule("/src/yarnTexture/yarnAssetRegistry.js");
  const { updateYarnAsset } = await server.ssrLoadModule("/src/actions/yarnLibrary.js");
  globalThis.document = { getElementById: () => ({
    getBoundingClientRect: () => ({ width: 600, height: 480 }),
  }) };
  const state = () => stateModule.GLOBAL_STATE;
  let writes = 0;
  stateModule.StateMonitor.register([() => ({ syncState() { writes++; } })]);

  function start(kind) {
    const source = deferred();
    let starts = 0;
    let result;
    if (kind === "library") {
      stateModule.dispatch({ patternLibrary: { controlled: () => { starts++; return source.promise; } } });
      result = loadLibraryPattern("controlled");
    } else {
      result = loadProjectFile({ name: "controlled.json", text: () => { starts++; return source.promise; } });
    }
    assert.equal(starts, 1, "the request must start before the lifecycle action");
    return { result, reject: source.reject,
      resolve: value => source.resolve(kind === "library" ? value : JSON.stringify(value)) };
  }

  async function capture() {
    const ref = state().yarnLibrary[0].pbr.normal.assetRef;
    return { current: state(), data: getProjectData(), ref,
      blob: await yarnAssetRegistry.getBlob(ref), writes, alerts };
  }

  async function unchanged(before) {
    if (writes !== before.writes) console.error(JSON.stringify({
      before: { chart: [before.current.chart.width, before.current.chart.height],
        asset: before.current.yarnLibrary[0].name },
      after: { chart: [state().chart.width, state().chart.height], asset: state().yarnLibrary[0].name },
      staleWrites: writes - before.writes,
    }));
    assert.equal(writes, before.writes, "stale completion must perform zero state writes");
    assert.equal(state(), before.current, "the new lifecycle state identity must survive");
    assert.deepEqual(getProjectData(), before.data, "project fields must not be polluted");
    assert.equal(yarnAssetRegistry.has(before.ref), true, "current binary source must survive");
    assert.equal(await yarnAssetRegistry.getBlob(before.ref), before.blob);
    assert.equal(alerts, before.alerts, "stale completion must not alert");
  }

  for (const kind of ["library", "file"]) {
    for (const boundary of ["New", "Load JSON", "Load file"]) {
      await check(`${kind}: old request -> ${boundary} -> old resolve`, async () => {
        loadJSON(project("Project A"));
        const old = start(kind);
        if (boundary === "New") {
          const library = state().yarnLibrary;
          const cam = state().singleJerseyCamProgram;
          newPattern();
          assert.deepEqual([state().chart.width, state().chart.height], [30, 40]);
          assert.equal(state().yarnLibrary, library, "New preserves the current library");
          assert.equal(state().singleJerseyCamProgram, cam);
        } else if (boundary === "Load JSON") loadJSON(project("Project B", 7, 9));
        else await loadProjectFile(new File([JSON.stringify(project("Project B", 7, 9))], "B.json"));
        const before = await capture();
        old.resolve(project("Stale result", 2, 2));
        const applied = await old.result;
        await unchanged(before);
        assert.equal(applied, false);
      });
    }
  }

  await check("library: same lifecycle applies normally and retains legacy library policy", async () => {
    loadJSON(project("Retained asset"));
    const library = state().yarnLibrary;
    const request = start("library");
    // An ordinary material edit must not invalidate a Pattern load.
    updateYarnAsset("shared-yarn", "Edited asset", "T");
    const retained = state().yarnLibrary;
    const pattern = { width: 5, height: 6, repeats: [], yarnPalette: ["#abcdef"] };
    request.resolve(pattern);
    await request.result;
    assert.deepEqual([state().chart.width, state().chart.height], [5, 6]);
    assert.equal(state().yarnLibrary, retained);
    assert.equal(state().yarnLibrary[0].name, "Edited asset");
    assert.notEqual(retained, library);
  });

  for (const older of ["library", "file"]) {
    for (const newer of ["library", "file"]) {
      await check(`${older} -> pending ${newer}: latest request wins before either completes`, async () => {
        loadJSON(project("Project A"));
        const old = start(older);
        const latest = start(newer);
        const before = await capture();
        old.resolve(project("Stale result"));
        const applied = await old.result;
        await unchanged(before);
        assert.equal(applied, false);
        latest.resolve(project("Latest project", 7, 9));
        assert.equal(await latest.result, true);
        assert.equal(state().yarnLibrary[0].name, "Latest project");
        assert.deepEqual([state().chart.width, state().chart.height], [7, 9]);
      });
    }
  }

  // Observe real staging ownership without replacing the codec or registry behavior.
  async function observeStaging(run, registrationError = null) {
    const records = new Map();
    const { register, clear } = YarnAssetRegistry.prototype;
    YarnAssetRegistry.prototype.register = function(source) {
      const ref = register.call(this, source);
      if (this !== yarnAssetRegistry) {
        if (!records.has(this)) records.set(this, { refs: [], clears: 0 });
        records.get(this).refs.push(ref);
        if (registrationError) throw registrationError;
      }
      return ref;
    };
    YarnAssetRegistry.prototype.clear = function() {
      if (records.has(this)) records.get(this).clears++;
      return clear.call(this);
    };
    try { await run(records); }
    finally { Object.assign(YarnAssetRegistry.prototype, { register, clear }); }
  }

  function releasedOnce(records) {
    assert.equal(records.size, 1, "one staged registry owns the source assets");
    for (const [registry, { refs, clears }] of records) {
      assert.equal(clears, 1, "the owning stage clears exactly once");
      for (const ref of refs) {
        assert.equal(registry.has(ref), false);
        assert.equal(yarnAssetRegistry.has(ref), false, "discarded assets never enter the current registry");
      }
    }
  }

  for (const boundary of ["New", "Load JSON", "Load file"]) {
    await check(`file: stale source rejection after ${boundary} is silent`, async () => {
      loadJSON(project("Project A"));
      const old = start("file");
      if (boundary === "New") newPattern();
      else if (boundary === "Load JSON") loadJSON(project("Project B"));
      else await loadProjectFile(new File([JSON.stringify(project("Project B"))], "B.json"));
      const before = await capture();
      old.reject(new Error("obsolete file failure"));
      assert.equal(await old.result, false);
      await unchanged(before);
    });
  }

  await check("file: current text error preserves the original error and state", async () => {
    loadJSON(project("Project A"));
    const current = start("file");
    const before = await capture();
    const expected = new Error("current file source failure");
    current.reject(expected);
    await assert.rejects(current.result, error => error === expected);
    await unchanged(before);
  });

  await check("file: current JSON parse error throws without state changes", async () => {
    loadJSON(project("Project A"));
    const before = await capture();
    await assert.rejects(loadProjectFile(new File(["{"], "broken.json")), SyntaxError);
    await unchanged(before);
  });

  for (const format of ["json", "knitscape"]) {
    const file = async data => new File([format === "json" ? JSON.stringify(data)
      : await createProjectPackage(data)], `controlled.${format}`);

    await check(`file ${format}: successful current load returns true and transfers assets`, async () => {
      loadJSON(project("Project A"));
      const input = await file(project("Current project", 7, 9));
      assert.equal(await loadProjectFile(input), true);
      assert.deepEqual([state().chart.width, state().chart.height], [7, 9]);
      assert.equal(state().yarnLibrary[0].name, "Current project");
      assert.deepEqual([...new Uint8Array(await (await yarnAssetRegistry.getBlob(
        state().yarnLibrary[0].pbr.normal.assetRef)).arrayBuffer())], [0, 1, 2]);
    });

    await check(`file ${format}: pre-commit validation failure clears staging exactly once`, async () => {
      loadJSON(project("Project A"));
      const input = await file({ ...project("Invalid"), width: -1 });
      const before = await capture();
      await observeStaging(async records => {
        await assert.rejects(loadProjectFile(input), /Invalid Pattern dimensions/);
        await unchanged(before);
        releasedOnce(records);
      });
    });

    await check(`file ${format}: post-commit fitChart error propagates with committed state and assets`, async () => {
      loadJSON(project("Project A"));
      const input = await file(project("Committed before layout failure", 7, 9));
      const oldRef = state().yarnLibrary[0].pbr.normal.assetRef;
      const oldScale = state().scale;
      const getElementById = document.getElementById;
      const expected = new Error("current file layout failure");
      document.getElementById = () => { throw expected; };
      try {
        await observeStaging(async records => {
          const outcome = await loadProjectFile(input).then(result => ({ result }), error => ({ error }));
          assert.deepEqual([state().chart.width, state().chart.height], [7, 9]);
          assert.equal(state().yarnLibrary[0].name, "Committed before layout failure");
          assert.equal(state().scale, oldScale, "view update has not completed");
          assert.equal(yarnAssetRegistry.has(oldRef), false);
          const ref = state().yarnLibrary[0].pbr.normal.assetRef;
          assert.equal((await yarnAssetRegistry.getBlob(ref)).size, 3);
          console.log(`OBSERVED ${format}: projectCommitted=true, errorPropagated=${outcome.error === expected}`);
          assert.equal(outcome.error, expected, "current post-commit error must reach the caller unchanged");
          assert.equal(records.size, 1);
          for (const [registry, record] of records) {
            assert.equal(registry.has(ref), false, "asset ownership transferred to the live registry");
            assert.equal(record.clears, 0, "the source catch must not clear committed staging");
          }
        });
      } finally { document.getElementById = getElementById; }
    });
  }

  await check("file package: source staging error releases assets and propagates unchanged", async () => {
    const input = new File([await createProjectPackage(project("Package"))], "source.knitscape");
    loadJSON(project("Project A"));
    const before = await capture();
    const expected = new Error("package registration failure");
    await observeStaging(async records => {
      await assert.rejects(loadProjectFile(input), error => error === expected);
      await unchanged(before);
      releasedOnce(records);
    }, expected);
  });

  await check("file package: stale source completion releases staged assets without committing", async () => {
    const input = new File([await createProjectPackage(project("Stale package"))], "stale.knitscape");
    loadJSON(project("Project A"));
    await observeStaging(async records => {
      const old = loadProjectFile(input);
      // Package reading awaits its import/codec; New deterministically supersedes it.
      newPattern();
      const before = await capture();
      assert.equal(await old, false);
      await unchanged(before);
      releasedOnce(records);
    });
  });

  for (const scenario of ["source error", "post-commit error", "stale resolve", "stale reject"]) {
    await check(`uploadFile: ${scenario} uses the existing alert boundary`, async () => {
      loadJSON(project("Project A"));
      const originalDocument = document;
      const originalAlert = window.alert;
      const messages = [];
      let removed = 0;
      const input = { style: {}, click() {}, remove() { removed++; } };
      globalThis.document = { ...originalDocument, createElement: () => input,
        body: { appendChild(element) { assert.equal(element, input); } } };
      window.alert = message => { alerts++; messages.push(message); };
      const source = deferred();
      const expected = new Error(`upload ${scenario}`);
      try {
        uploadFile();
        const completion = input.onchange({ target: { files: [{ name: "upload.json", text: () => source.promise }] } });
        if (scenario.startsWith("stale")) newPattern();
        const before = await capture();
        if (scenario === "post-commit error") document.getElementById = () => { throw expected; };
        if (scenario.endsWith("reject") || scenario === "source error") source.reject(expected);
        else source.resolve(JSON.stringify(project("Uploaded")));
        await completion;
        assert.equal(removed, 1, "file input is removed on every completion");
        if (scenario.startsWith("stale")) {
          assert.deepEqual(messages, []);
          await unchanged(before);
        } else {
          assert.equal(messages.length, 1);
          assert.ok(messages[0].endsWith("\n" + expected.message));
          if (scenario === "post-commit error") assert.equal(state().yarnLibrary[0].name, "Uploaded");
          else assert.equal(state(), before.current);
        }
      } finally { globalThis.document = originalDocument; window.alert = originalAlert; }
    });
  }

  // Error cases also require a returned promise, so callers can observe real errors.
  // On the pre-fix implementation the main race cases above fail first.
  await check("library: stale rejection is silent; current rejection remains observable", async () => {
    loadJSON(project("Project A"));
    const old = start("library");
    if (!old.result?.then) {
      old.resolve({ width: 2, height: 2, repeats: [] });
      await Promise.resolve();
      assert.fail("library load must expose its async completion");
    }
    newPattern();
    const before = await capture();
    old.reject(new Error("obsolete library failure"));
    assert.equal(await old.result, false);
    await unchanged(before);
    const current = start("library");
    const expected = new Error("current library failure");
    current.reject(expected);
    await assert.rejects(current.result, error => error === expected);
  });

  await check("library: stale malformed result is ignored before validation", async () => {
    loadJSON(project("Project A"));
    const old = start("library");
    if (!old.result?.then) {
      old.resolve({ width: 2, height: 2, repeats: [] });
      await Promise.resolve();
      assert.fail("library load must expose its async completion");
    }
    newPattern();
    const before = await capture();
    old.resolve({ width: -1 });
    assert.equal(await old.result, false);
    await unchanged(before);
  });

  await check("library: current commit errors are not mistaken for stale source failures", async () => {
    loadJSON(project("Project A"));
    const current = start("library");
    const getElementById = document.getElementById;
    const expected = new Error("current layout failure");
    document.getElementById = () => { throw expected; };
    try {
      current.resolve(project("Current project"));
      await assert.rejects(current.result, error => error === expected);
    } finally { document.getElementById = getElementById; }
  });

  await check("formal export and package retain the existing schema without lifecycle state", async () => {
    loadJSON(project("Round trip"));
    newPattern();
    const data = getProjectData();
    assert.deepEqual(Object.keys(data).sort(), ["width", "height", "repeats", "yarnPalette",
      "yarnSequence", "yarnPlies", "yarnLibrary", "singleJerseyCamProgram",
      "needleArrangement", "needleArrangementInputs", "machineGauge"].sort());
    const opened = await readProjectPackage(await createProjectPackage(data));
    try {
      assert.deepEqual(Object.keys(opened.project).sort(), [...Object.keys(data), "format", "version"].sort());
      assert.equal(opened.project.version, 2);
      assert.deepEqual([opened.project.width, opened.project.height], [30, 40]);
      assert.equal(opened.project.yarnLibrary[0].name, "Round trip");
    } finally { opened.registry.clear(); }
  });
  const lengthCapability = "relaxed-yarn-length-with-draft-v1";
  function lengthProject(mode = "relaxedWithDraft") {
    const data = project("Length mode");
    data.singleJerseyCamProgram = { tracks: [["K"]], feeds: [{ yarns: [
      { yarnId: "shared-yarn", lengthInputMode: "directTarget",
        yarnLengthCmPer100Needles: 23, tensionCN: 5, placement: "parallel" },
      { yarnId: "shared-yarn", lengthInputMode: mode,
        ...(mode === "relaxedWithDraft" ? { relaxedLengthCmPer100Needles: 8, draftRatio: 3 }
          : { yarnLengthCmPer100Needles: 8 }), tensionCN: 4, placement: "parallel" },
    ] }] };
    if (mode === "relaxedWithDraft") Object.assign(data, { format: "knitscape", version: 3,
      requiredCapabilities: [lengthCapability] });
    return data;
  }
  for (const format of ["json", "knitscape"]) {
    await check(`length contract ${format}: active facts survive save/load without derived 24`, async () => {
      const initial = lengthProject();
      if (format === "json") delete initial.yarnLibrary[0].pbr;
      loadJSON(initial);
      stateModule.dispatch({ yarnLengthSolverResults: [{ targetCmPer100Needles: 24 }],
        previewValidity: "VALIDATED" });
      const saved = getProjectData();
      assert.equal(saved.version, 3);
      assert.equal(saved.format, "knitscape");
      assert.deepEqual(saved.requiredCapabilities, [lengthCapability]);
      assert.deepEqual(saved.singleJerseyCamProgram, initial.singleJerseyCamProgram);
      for (const key of ["yarnLengthSolverResults", "previewValidity", "feedYarnStructureRevision"]) {
        assert.equal(Object.hasOwn(saved, key), false);
      }
      const file = new File([format === "json" ? JSON.stringify(saved) : await createProjectPackage(saved)],
        `length-mode.${format}`);
      loadJSON(project("Replace before reopen"));
      assert.equal(await loadProjectFile(file), true);
      assert.deepEqual(state().singleJerseyCamProgram, initial.singleJerseyCamProgram);
      assert.deepEqual(getProjectData().requiredCapabilities, [lengthCapability]);
    });
  }
  for (const mode of ["directTarget", "relaxedWithDraft"]) {
    await check(`length contract: incomplete ${mode} facts round-trip without invented targets`, async () => {
      const initial = lengthProject(mode);
      const yarn = initial.singleJerseyCamProgram.feeds[0].yarns[1];
      for (const field of ["yarnLengthCmPer100Needles", "relaxedLengthCmPer100Needles", "draftRatio"]) delete yarn[field];
      loadJSON(initial);
      const saved = getProjectData();
      const reopened = await readProjectPackage(await createProjectPackage(saved));
      try {
        loadJSON(reopened.project, reopened.registry);
        assert.deepEqual(state().singleJerseyCamProgram, initial.singleJerseyCamProgram);
      } finally { reopened.registry.clear(); }
    });
  }
  await check("length contract: legacy single and multiple yarn slots retain direct values and v2 package", async () => {
    for (const values of [[23], [23, 8], [23, 0], [null, ""]]) {
      const data = lengthProject("directTarget");
      data.singleJerseyCamProgram.feeds[0].yarns = values.map(value => ({
        yarnId: "shared-yarn", yarnLengthCmPer100Needles: value, tensionCN: 4, placement: "parallel",
      }));
      loadJSON(data);
      assert.deepEqual(state().singleJerseyCamProgram.feeds[0].yarns.map(yarn => yarn.yarnLengthCmPer100Needles),
        values.map(value => Number(value)));
      const saved = getProjectData();
      assert.equal(Object.hasOwn(saved, "version"), false);
      assert.equal(Object.hasOwn(saved, "requiredCapabilities"), false);
      assert.equal(saved.singleJerseyCamProgram.feeds[0].yarns.some(yarn => Object.hasOwn(yarn, "lengthInputMode")), false);
      const opened = await readProjectPackage(await createProjectPackage(saved));
      try {
        assert.equal(opened.project.version, 2);
        assert.deepEqual(opened.project.singleJerseyCamProgram, saved.singleJerseyCamProgram);
      } finally { opened.registry.clear(); }
    }
  });
  const invalidLengthProjects = [
    ["future version", data => { data.version = 999; }],
    ["future capability", data => { data.requiredCapabilities = ["future-v2"]; }],
    ["missing capability", data => { delete data.requiredCapabilities; }],
    ["missing format markers", data => { delete data.format; delete data.version; delete data.requiredCapabilities; }],
    ["v2 new mode", data => { data.version = 2; }],
    ["unknown mode", data => { data.singleJerseyCamProgram.feeds[0].yarns[1].lengthInputMode = "future"; }],
  ];
  for (const field of ["relaxedLengthCmPer100Needles", "draftRatio"]) {
    for (const value of [0, -1, "", null, "invalid", NaN, Infinity]) {
      invalidLengthProjects.push([`${field}=${String(value)}`, data => {
        data.singleJerseyCamProgram.feeds[0].yarns[1][field] = value;
      }]);
    }
  }
  for (const [name, modify] of invalidLengthProjects) {
    await check(`length contract: ${name} rejects atomically before state or assets change`, async () => {
      loadJSON(project("Preserve on rejection"));
      const before = await capture();
      const invalid = lengthProject();
      modify(invalid);
      assert.throws(() => loadJSON(invalid), /version|capabilit|format|mode|length|draft|positive/i);
      await unchanged(before);
    });
  }
  // Palette/sequence integrity: run the real lifecycle, event listeners and resize actions.
  const { Bimp } = await server.ssrLoadModule("/src/lib/Bimp.js");
  const { chartResizeForRepeat } = await server.ssrLoadModule("/src/actions/repeatDimensions.js");
  const { colorSequencePointerInteraction } = await server.ssrLoadModule("/src/events/colorSequencePointerInteraction.js");
  const { colorSequenceTouchInteraction } = await server.ssrLoadModule("/src/events/colorSequenceTouchInteraction.js");
  window.clearTimeout = clearTimeout;
  window.setTimeout = setTimeout;
  const palette = ["#112233", "#445566", "#778899"];
  const validSequence = () => assert.ok(Array.from(state().yarnSequence.pixels)
    .every(p => Number.isInteger(p) && p >= 0 && p < state().yarnPalette.length));
  function oldSelection() {
    loadJSON(project("Old palette"));
    stateModule.dispatch({ yarnPalette: palette, activeYarn: 2 });
  }
  function gesture(kind) {
    const listeners = new Map();
    const canvas = { getBoundingClientRect: () => ({ x: 0, y: 0 }),
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: name => listeners.delete(name) };
    const touch = kind === "touch";
    (touch ? colorSequenceTouchInteraction : colorSequencePointerInteraction)(canvas);
    const event = row => {
      const coords = { clientX: 1, clientY: (state().yarnSequence.height - row - 0.5) * state().scale };
      return touch ? { touches: [coords] } : coords;
    };
    return { start: row => listeners.get(touch ? "touchstart" : "pointerdown")(event(row)),
      move: row => listeners.get(touch ? "touchmove" : "pointermove")?.(event(row)),
      end: () => listeners.get(touch ? "touchend" : "pointerup")?.() };
  }
  for (const boundary of ["New", "Full Load", "Pattern-only Load"]) {
    await check(`integrity: ${boundary} resets selection before paint and resize`, () => {
      oldSelection();
      if (boundary === "New") newPattern();
      else if (boundary === "Full Load") loadJSON(project("New palette"));
      else loadJSON({ width: 2, height: 3, repeats: [], yarnPalette: ["#abcdef"] });
      assert.equal(state().activeYarn, 0);
      const paint = gesture("pointer");
      paint.start(0); paint.move(2); paint.end();
      validSequence();
      const height = state().chart.height;
      stateModule.dispatch(chartResizeForRepeat(0, [state().chart.width, height + 2]));
      validSequence();
      assert.deepEqual(Array.from(state().yarnSequence.pixels).slice(height), [0, 0]);
    });
  }
  for (const kind of ["pointer", "touch"]) {
    await check(`integrity: ${kind} valid brush and line preserve slot 2`, () => {
      oldSelection();
      const paint = gesture(kind);
      paint.start(0); paint.move(2); paint.end();
      assert.deepEqual(Array.from(state().yarnSequence.pixels), [2, 2, 2]);
    });
    for (const bad of [2, -1, 0.5, NaN, Infinity, "0"]) {
      await check(`integrity: ${kind} rejects selection ${String(bad)}`, () => {
        loadJSON(project("One color"));
        stateModule.dispatch({ activeYarn: bad });
        const before = state().yarnSequence;
        const paint = gesture(kind);
        paint.start(0); paint.move(2); paint.end();
        assert.equal(state().yarnSequence, before, "invalid selection must perform no sequence write");
        assert.equal(state().transforming, false);
      });
    }
    await check(`integrity: ${kind} rechecks selection during drag`, () => {
      oldSelection();
      const paint = gesture(kind);
      paint.start(0);
      stateModule.dispatch({ yarnPalette: [palette[0]], activeYarn: 2, yarnSequence: Bimp.empty(1, 3, 0) });
      const before = state().yarnSequence;
      paint.move(2); paint.end();
      assert.equal(state().yarnSequence, before);
    });
  }
  await check("integrity: resize rejects stale selection and damaged existing rows", () => {
    loadJSON(project("Resize"));
    stateModule.dispatch({ activeYarn: 2 });
    assert.throws(() => chartResizeForRepeat(0, [2, 5]), /palette index.*2.*1/i);
    stateModule.dispatch({ activeYarn: 0, yarnSequence: new Bimp(1, 3, [0, 0, 2]) });
    assert.throws(() => chartResizeForRepeat(0, [2, 1]), /palette index.*2.*1/i);
  });
  for (const bad of [2, -1, 0.5, NaN, Infinity, "0", null]) {
    await check(`integrity: importer rejects raw reference ${String(bad)} before normalization`, () => {
      loadJSON(project("Valid"));
      const before = state();
      const damaged = project("Invalid");
      damaged.yarnSequence.pixels[0] = bad;
      assert.throws(() => loadJSON(damaged), /Yarn sequence references invalid palette index.*palette length 1/);
      assert.equal(state(), before);
    });
  }
  await check("integrity: import rejects bad references even in cropped rows/columns", () => {
    for (const yarnSequence of [{ width: 1, height: 4, pixels: [0, 0, 0, 2] },
      { width: 2, height: 3, pixels: [0, 2, 0, 0, 0, 0] }, [0, 2]]) {
      assert.throws(() => loadJSON({ ...project("Invalid"), yarnSequence }), /invalid palette index.*2.*1/);
    }
  });
  await check("integrity: exporter rejects invalid references and never serializes selection", () => {
    loadJSON(project("Export"));
    stateModule.dispatch({ yarnSequence: new Bimp(1, 3, [0, 2, 0]) });
    assert.throws(() => getProjectData(), /Yarn sequence references invalid palette index.*2.*1/);
    stateModule.dispatch({ yarnSequence: Bimp.empty(1, 3, 0), activeYarn: 2 });
    assert.equal(Object.hasOwn(getProjectData(), "activeYarn"), false);
  });
  await check("integrity: failed download uses existing error handling and preserves state", async () => {
    loadJSON(project("Invalid export"));
    stateModule.dispatch({ yarnSequence: new Bimp(1, 3, [0, 2, 0]) });
    const before = state().yarnSequence;
    const beforeAlerts = alerts;
    assert.equal(await downloadProject(), false);
    assert.equal(alerts, beforeAlerts + 1);
    assert.equal(state().projectExporting, false);
    assert.equal(state().yarnSequence, before);
  });
  await check("integrity: same-size palette load also resets old selection", () => {
    oldSelection();
    loadJSON({ ...project("Different slots"), yarnPalette: [...palette].reverse() });
    assert.equal(state().activeYarn, 0);
  });
  await check("integrity: legacy missing, array, short and wide sequences retain valid normalization", () => {
    for (const [yarnSequence, expected] of [
      [undefined, [0, 0, 0]], [[2, 1], [2, 1, 0]],
      [{ width: 1, height: 1, pixels: [2] }, [2, 0, 0]],
      [{ width: 2, height: 3, pixels: [0, 2, 1, 2, 2, 1] }, [0, 1, 2]],
    ]) {
      loadJSON({ width: 2, height: 3, repeats: [], yarnPalette: palette, yarnSequence });
      assert.deepEqual(Array.from(state().yarnSequence.pixels), expected);
      assert.equal(state().activeYarn, 0);
      validSequence();
    }
  });
  // Execute the unchanged UI action body with real state/Bimp; avoid loading the browser color-picker library.
  const deleteBody = readFileSync("src/views/yarnPicker.js", "utf8")
    .match(/function deleteColor\(index\) \{[\s\S]*?\n\}/)[0];
  const deleteColor = index => new Function("GLOBAL_STATE", "dispatch", "Bimp", "alert", "t",
    `${deleteBody}; deleteColor(${index});`)(state(), stateModule.dispatch, Bimp, () => {}, () => "");
  for (const [deleted, selected, nextSelected, expected] of [
    [1, 2, 1, [0, 1, 1, 0]], [2, 2, 0, [0, 0, 0, 1]],
    [2, 1, 1, [0, 0, 0, 1]], [0, 2, 1, [0, 1, 1, 0]],
  ]) {
    await check(`integrity: delete slot ${deleted} rebinds selection ${selected}`, () => {
      oldSelection();
      stateModule.dispatch({ activeYarn: selected, yarnSequence: new Bimp(1, 4, [0, 2, 2, 1]) });
      deleteColor(deleted);
      assert.deepEqual(Array.from(state().yarnSequence.pixels), expected);
      assert.equal(state().activeYarn, nextSelected);
      validSequence();
    });
  }
  await check("integrity: cannot delete the final palette slot", () => {
    loadJSON(project("Last slot"));
    const before = state();
    deleteColor(0);
    assert.equal(state(), before);
  });
  // Real chart subscriber: regenerated pixels still use GLOBAL_STATE.chart dimensions.
  const { generateChart } = await server.ssrLoadModule("/src/components/generateChart.js");
  stateModule.StateMonitor.register([generateChart()]);
  const { SNAPSHOT_FIELDS } = await server.ssrLoadModule("/src/constants.js");
  const patternTransitions = [];
  stateModule.StateMonitor.register([() => ({ syncState(next, changes) {
    if (changes.includes("repeats") && changes.includes("yarnSequence")) {
      patternTransitions.push({ state: next, changes });
    }
  } })]);
  const patternSnapshot = () => Object.fromEntries(
    SNAPSHOT_FIELDS.map(field => [field, state()[field]])
  );
  const dimensions = () => ({ chart: [state().chart.width, state().chart.height],
    area: state().repeats[0].area, sequence: state().yarnSequence.height });
  function consistentPattern() {
    assert.deepEqual(dimensions(), { chart: state().repeats[0].area,
      area: state().repeats[0].area, sequence: state().chart.height },
    "INV-1/2/3/4: single-origin fixture must have one coherent Pattern extent");
    const bitmap = state().repeats[0].bitmap;
    assert.equal(bitmap.pixels.length, bitmap.width * bitmap.height);
    assert.equal(state().yarnSequence.width, 1);
    validSequence();
  }
  function undoFixture() {
    const data = project("Retained New asset", 7, 9);
    data.yarnPalette = [...palette];
    data.yarnSequence.pixels = Array(9).fill(2);
    data.singleJerseyCamProgram = { tracks: [["K", "T"], ["M", "K"]],
      feeds: [0, 1].map(() => ({ yarns: [{ yarnId: "shared-yarn",
        yarnLengthCmPer100Needles: 0, tensionCN: null, placement: "parallel" }] })) };
    data.needleArrangement = [1, 2];
    data.needleArrangementInputs = ["12", "", "", ""];
    data.machineGauge = 28;
    loadJSON(data);
    stateModule.dispatch({ activeYarn: 2, selectedChartCell: [3, 4],
      selectedRepeatCell: [0, 0], snapshots: [], lastSnapshot: 0 });
    consistentPattern();
    assert.deepEqual(dimensions(), { chart: [7, 9], area: [7, 9], sequence: 9 });
  }
  function controlledClock(run) {
    const originalNow = Date.now;
    let now = 100000;
    Date.now = () => now;
    try { run(() => { now += 2000; }); }
    finally { Date.now = originalNow; }
  }

  for (const timing of ["elapsed", "within snapshot interval"]) {
    await check(`new-undo: 7x9 -> New -> Undo (${timing}) stays coherent`, () => controlledClock(advance => {
      undoFixture();
      stateModule.dispatch({ yarnPalette: ["#abcdef", ...palette.slice(1)] });
      assert.equal(state().snapshots.length, 1, "known old-Pattern history");
      if (timing === "elapsed") advance();
      patternTransitions.length = 0;
      newPattern();
      assert.equal(patternTransitions.length, 1, "one Pattern transition establishes the boundary");
      const boundary = patternTransitions[0];
      assert.ok(boundary.changes.includes("snapshots") && boundary.changes.includes("lastSnapshot"));
      assert.deepEqual(boundary.state.snapshots, []);
      assert.equal(boundary.state.lastSnapshot, 0);
      assert.deepEqual(state().snapshots, []);
      assert.equal(state().lastSnapshot, 0);
      consistentPattern();
      assert.deepEqual(dimensions(), { chart: [30, 40], area: [30, 40], sequence: 40 });
      const fresh = state();
      stateModule.undo();
      console.log(`OBSERVED ${timing}: ${JSON.stringify(dimensions())}`);
      assert.equal(state(), fresh, "Undo without a new-lifecycle edit is a no-op");
      consistentPattern();
    }));
  }

  for (const field of ["yarnSequence", "repeats", "yarnPalette", "yarnPlies"]) {
    await check(`new-undo: ordinary same-Pattern ${field} edit restores content`, () => controlledClock(() => {
      undoFixture();
      const before = patternSnapshot();
      const chartBefore = state().chart.toJSON();
      const edit = {
        yarnSequence: Bimp.empty(1, 9, 1),
        repeats: [{ ...state().repeats[0], bitmap: Bimp.empty(1, 1, 0) }],
        yarnPalette: ["#abcdef", ...palette.slice(1)],
        yarnPlies: state().yarnPlies.map((ply, index) => index ? ply : { ...ply, color: "#abcdef" }),
      }[field];
      stateModule.dispatch({ [field]: edit });
      assert.notDeepEqual(state()[field], before[field]);
      assert.equal(state().snapshots.length, 1);
      stateModule.undo();
      assert.deepEqual(patternSnapshot(), before);
      assert.deepEqual(state().chart.toJSON(), chartBefore);
      assert.equal(state().snapshots.length, 0);
      consistentPattern();
    }));
  }

  for (const field of ["repeat", "sequence"]) {
    for (const timing of ["elapsed", "within snapshot interval"]) {
      await check(`new-undo: New -> ${field} edit -> Undo (${timing}) stays coherent`, () => controlledClock(advance => {
        undoFixture();
        stateModule.dispatch({ yarnPalette: ["#abcdef", ...palette.slice(1)] });
        assert.equal(state().lastSnapshot, Date.now(), "old snapshot timing must not suppress the first new edit");
        newPattern();
        assert.deepEqual(state().snapshots, []);
        assert.equal(state().lastSnapshot, 0);
        const before = patternSnapshot();
        const chartBefore = state().chart.toJSON();
        if (timing === "elapsed") advance();
        // Add the sequence's new palette slot in the same edit so all references remain valid.
        const edit = field === "repeat"
          ? { repeats: [{ ...state().repeats[0], bitmap: Bimp.empty(4, 4, 3) }] }
          : { yarnPalette: [...state().yarnPalette, "#abcdef"], yarnSequence: Bimp.empty(1, 40, 1) };
        stateModule.dispatch(edit);
        assert.notDeepEqual(patternSnapshot(), before);
        assert.equal(state().snapshots.length, 1);
        consistentPattern();
        stateModule.undo();
        console.log(`OBSERVED post-New ${field} edit ${timing}: ${JSON.stringify(dimensions())}`);
        consistentPattern();
        assert.deepEqual(patternSnapshot(), before);
        assert.deepEqual(state().chart.toJSON(), chartBefore);
        assert.deepEqual(state().snapshots, []);
        const restored = state();
        stateModule.undo();
        assert.equal(state(), restored, "a second Undo cannot cross New");
      }));
    }
  }

  await check("new-undo: Machine/Library/Gauge and valid palette selection survive New and Undo", () => controlledClock(() => {
    undoFixture();
    const fields = ["machine", "singleJerseyCamProgram", "needleArrangement", "needleArrangementInputs",
      "machineGauge", "yarnLibrary", "feedYarnStructureRevision"];
    const before = Object.fromEntries(fields.map(field => [field, state()[field]]));
    const contents = structuredClone(before);
    newPattern();
    assert.equal(state().activeYarn, 0);
    assert.equal(state().editingRepeat, 0);
    assert.equal(state().selectedChartCell, null);
    assert.equal(state().selectedRepeatCell, null);
    assert.equal(state().yarnPalette.length, 1);
    validSequence();
    for (const phase of ["New", "Undo"]) {
      if (phase === "Undo") stateModule.undo();
      for (const field of fields) {
        assert.equal(state()[field], before[field], `${phase} preserves ${field} identity/value`);
        assert.deepEqual(state()[field], contents[field], `${phase} preserves ${field} contents`);
      }
      validSequence();
      assert.ok(state().activeYarn >= 0 && state().activeYarn < state().yarnPalette.length);
    }
  }));
  yarnAssetRegistry.clear();
} finally { await server.close(); }

console.log(`${passed}/${passed + failures.length} project load lifecycle cases passed.`);
if (failures.length) process.exitCode = 1;
