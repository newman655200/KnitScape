import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

const statePath = "src/state.js";
const viewPath = "src/views/view.js";
const taskbarPath = "src/views/taskbar.js";
const leftBarPath = "src/views/leftBar.js";
const importersPath = "src/actions/importers.js";
const stylesPath = "styles.css";

globalThis.Path2D ??= class Path2D {};
globalThis.devicePixelRatio ??= 1;

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

globalThis.window ??= {
  btoa: (value) => Buffer.from(value, "binary").toString("base64"),
  clearTimeout,
  location: { search: "" },
  setTimeout,
};

function snapshotWorkspaceData(state) {
  return JSON.stringify({
    repeats: state.repeats.map(({ bitmap, pos, area }) => ({
      bitmap: bitmap.toJSON(),
      pos,
      area,
    })),
    chart: state.chart.toJSON(),
    editingRepeat: state.editingRepeat,
    singleJerseyCamProgram: state.singleJerseyCamProgram,
    needleArrangement: state.needleArrangement,
    needleArrangementInputs: state.needleArrangementInputs,
  });
}

try {
  const stateModule = await server.ssrLoadModule(`/${statePath}`);
  const camActions = await server.ssrLoadModule(
    "/src/actions/singleJerseyCamProgram.js"
  );
  const { loadJSON } = await server.ssrLoadModule(`/${importersPath}`);
  const { view } = await server.ssrLoadModule(`/${viewPath}`);
  const state = () => stateModule.GLOBAL_STATE;

  globalThis.document ??= {
    title: "",
    documentElement: { lang: "" },
    getElementById(id) {
      assert.equal(id, "desktop");
      return {
        getBoundingClientRect: () => ({ width: 600, height: 480 }),
      };
    },
  };

  assert.equal(
    state().workspaceMode,
    "pattern",
    "the application must start in Pattern workspace mode."
  );

  camActions.createSingleJerseyCamProgram(2, 3);
  stateModule.dispatch({
    editingRepeat: 0,
    needleArrangementInputs: ["1", "22", "3", "44"],
    needleArrangement: [1, 2, 2, 3, 4, 4],
  });

  const repeatsReference = state().repeats;
  const chartReference = state().chart;
  const camReference = state().singleJerseyCamProgram;
  const arrangementReference = state().needleArrangement;
  const arrangementInputsReference = state().needleArrangementInputs;
  const editingRepeat = state().editingRepeat;
  const beforeModeSwitch = snapshotWorkspaceData(state());

  stateModule.dispatch({ workspaceMode: "machine" });
  assert.equal(state().workspaceMode, "machine");
  view();
  assert.equal(
    snapshotWorkspaceData(state()),
    beforeModeSwitch,
    "rendering Machine mode must not change Pattern or Machine data."
  );

  stateModule.dispatch({ workspaceMode: "pattern" });
  assert.equal(state().workspaceMode, "pattern");
  view();
  assert.equal(state().repeats, repeatsReference);
  assert.equal(state().chart, chartReference);
  assert.equal(state().singleJerseyCamProgram, camReference);
  assert.equal(state().needleArrangement, arrangementReference);
  assert.equal(state().needleArrangementInputs, arrangementInputsReference);
  assert.equal(state().editingRepeat, editingRepeat);
  assert.equal(
    snapshotWorkspaceData(state()),
    beforeModeSwitch,
    "Pattern -> Machine -> Pattern must preserve all workspace data."
  );

  stateModule.dispatch({ workspaceMode: "machine" });
  const camBeforeLibraryLoad = state().singleJerseyCamProgram;
  const arrangementBeforeLibraryLoad = state().needleArrangement;
  const inputsBeforeLibraryLoad = state().needleArrangementInputs;
  const revisionBeforeLibraryLoad = state().feedYarnStructureRevision;

  loadJSON({
    width: 6,
    height: 4,
    yarnPalette: ["#112233"],
    yarnSequence: { width: 1, height: 4, pixels: [0, 0, 0, 0] },
    repeats: [
      {
        bitmap: { width: 2, height: 2, pixels: [0, 2, 3, 0] },
        pos: [0, 0],
        area: [6, 4],
      },
    ],
  });

  assert.equal(
    state().workspaceMode,
    "pattern",
    "loading a Fabric Pattern must return to Pattern mode."
  );
  assert.equal(state().editingRepeat, 0);
  assert.equal(state().singleJerseyCamProgram, camBeforeLibraryLoad);
  assert.equal(state().needleArrangement, arrangementBeforeLibraryLoad);
  assert.equal(state().needleArrangementInputs, inputsBeforeLibraryLoad);
  assert.equal(state().feedYarnStructureRevision, revisionBeforeLibraryLoad,
    "Legacy Pattern-only loading must retain assignment identity.");
  assert.equal(state().repeats.length, 1);
  assert.deepEqual(state().repeats[0].bitmap.toJSON(), {
    width: 2,
    height: 2,
    pixels: [0, 2, 3, 0],
  });

  const stateSource = fs.readFileSync(statePath, "utf8");
  const viewSource = fs.readFileSync(viewPath, "utf8");
  const taskbarSource = fs.readFileSync(taskbarPath, "utf8");
  const leftBarSource = fs.readFileSync(leftBarPath, "utf8");
  const importersSource = fs.readFileSync(importersPath, "utf8");
  const stylesSource = fs.readFileSync(stylesPath, "utf8");
  const translationsSource = fs.readFileSync(
    "src/i18n/translations.js",
    "utf8"
  );

  assert.match(stateSource, /workspaceMode:\s*"pattern"/);
  assert.doesNotMatch(stateSource, /workspaceMode:\s*"gallery"/);

  assert.match(
    taskbarSource,
    /dispatch\(\{\s*workspaceMode:\s*"pattern"\s*\}\)/s
  );
  assert.match(
    taskbarSource,
    /dispatch\(\{\s*workspaceMode:\s*"machine"\s*\}\)/s
  );
  assert.match(taskbarSource, /showLibrary:\s*!GLOBAL_STATE\.showLibrary/);
  assert.match(taskbarSource, /workspace\.pattern/);
  assert.match(taskbarSource, /workspace\.machine/);
  for (const forbidden of [
    "generateChart",
    "resolveSingleJerseyOperations",
    "createSingleJerseySimulationInput",
    "createSingleJerseyCamProgram",
    "deleteSingleJerseyCamProgram",
    "needleArrangement: []",
  ]) {
    assert.equal(
      taskbarSource.includes(forbidden),
      false,
      `workspace switching must not call ${forbidden}.`
    );
  }

  assert.match(viewSource, /id="pattern-workspace"/);
  assert.match(viewSource, /id="machine-workspace"/);
  assert.match(viewSource, /workspace-hidden/);
  assert.match(viewSource, /id="desktop"/);
  assert.match(viewSource, /repeatCanvas\(\)/);
  assert.match(viewSource, /id="yarn-color-canvas"/);
  assert.match(viewSource, /id="symbol-canvas"/);
  assert.match(viewSource, /id="grid"/);
  assert.doesNotMatch(
    viewSource,
    /when\(\s*GLOBAL_STATE\.workspaceMode/,
    "workspace mode must not conditionally create or destroy core DOM nodes."
  );
  assert.equal((viewSource.match(/id="desktop"/g) || []).length, 1);
  assert.equal((viewSource.match(/repeatCanvas\(\)/g) || []).length, 1);

  assert.match(
    leftBarSource,
    /const addRepeatClass\s*=\s*GLOBAL_STATE\.workspaceMode\s*===\s*"pattern"\s*\?\s*""\s*:\s*"workspace-hidden";/s,
    "Add Repeat must be visually hidden outside Pattern mode."
  );
  assert.match(
    leftBarSource,
    /class="btn solid add-repeat \$\{addRepeatClass\}"/,
    "the Add Repeat button must apply the mode visibility class."
  );
  assert.match(leftBarSource, /yarnPlyPanel\(\)/);
  assert.match(leftBarSource, /yarnPicker\(\)/);

  const loadJSONSource = importersSource.slice(
    importersSource.indexOf("export function loadJSON"),
    importersSource.indexOf("export function newPattern")
  );
  assert.match(loadJSONSource, /workspaceMode:\s*"pattern"/);
  assert.doesNotMatch(
    loadJSONSource,
    /singleJerseyCamProgram\s*:|needleArrangement\s*:/,
    "Fabric Pattern loading must not alter Machine-owned data."
  );

  assert.match(
    stylesSource,
    /\.workspace-hidden\s*\{[^}]*display:\s*none\s*!important;/s
  );
  assert.match(
    stylesSource,
    /\.workspace-panel\.workspace-hidden\s*\{[^}]*display:\s*flex\s*!important;[^}]*position:\s*absolute\s*!important;[^}]*visibility:\s*hidden;[^}]*pointer-events:\s*none;/s,
    "hidden workspace panels must stay measurable without occupying the active layout."
  );
  assert.match(stylesSource, /#pattern-workspace\s*\{/);
  assert.match(stylesSource, /#machine-workspace\s*\{/);

  for (const key of [
    "workspace.navigation",
    "workspace.pattern",
    "workspace.machine",
  ]) {
    assert.equal(
      (translationsSource.match(new RegExp(`"${key}"`, "g")) || []).length,
      4,
      `${key} must be translated for every supported language.`
    );
  }

  const packageJSON = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.equal(
    packageJSON.scripts["validate:workspace-mode"],
    "node --experimental-default-type=module scripts/validate-workspace-mode.mjs"
  );

  console.log(
    "PASS: Pattern and Machine workspaces switch visibility without changing data ownership or core DOM identity."
  );
} finally {
  await server.close();
}
