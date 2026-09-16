import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

const actionPath = "src/actions/singleJerseyCamProgram.js";
const viewPath = "src/views/singleJerseyCamProgramEditor.js";
const toolbarPath = "src/views/chartEditorToolbar.js";

const EXPECTED_CREATED_TRACKS = [
  ["K", "K", "K", "K"],
  ["K", "K", "K", "K"],
  ["K", "K", "K", "K"],
  ["K", "K", "K", "K"],
];
const EXPECTED_EDITED_TRACKS = [
  ["K", "K", "K", "K"],
  ["T", "K", "K", "K"],
  ["M", "K", "K", "K"],
  ["K", "K", "K", "K"],
];
const EXPECTED_TWO_BY_THREE = [
  ["K", "T", "M"],
  ["T", "K", "M"],
];
const EXPECTED_FOUR_BY_FIVE = [
  ["K", "T", "M", "K", "K"],
  ["T", "K", "M", "K", "K"],
  ["K", "K", "K", "K", "K"],
  ["K", "K", "K", "K", "K"],
];
const EXPECTED_ONE_BY_TWO = [["K", "T"]];
const EXPECTED_THREE_BY_FOUR = [
  ["K", "K", "K", "K"],
  ["K", "K", "K", "K"],
  ["K", "K", "K", "K"],
];
const MISMATCH_ARRANGEMENT = [1, 2, 2, 3, 4, 4];
const MISMATCH_ERROR =
  "Needle Type 4 exceeds camProgram.tracks length 3.";

assert.ok(fs.existsSync(actionPath), "single jersey Cam Program actions must exist.");
assert.ok(fs.existsSync(viewPath), "single jersey Cam Program editor must exist.");

globalThis.Path2D ??= class Path2D {};

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

function snapshot(value) {
  return JSON.stringify(value);
}

try {
  const {
    createSingleJerseyCamProgram,
    cycleSingleJerseyCamOperation,
    deleteSingleJerseyCamProgram,
    resizeSingleJerseyCamProgram,
    setSingleJerseyCamOperation,
  } = await server.ssrLoadModule(`/${actionPath}`);
  const { resolveSingleJerseyOperations } = await server.ssrLoadModule(
    "/src/domain/singleJerseyMachine.js"
  );
  const { singleJerseyCamProgramEditor } = await server.ssrLoadModule(
    `/${viewPath}`
  );
  const stateModule = await server.ssrLoadModule("/src/state.js");
  const state = () => stateModule.GLOBAL_STATE;

  assert.equal(
    state().singleJerseyCamProgram,
    null,
    "the application must start without a Cam Program."
  );

  const initialRenderResult = singleJerseyCamProgramEditor();
  assert.ok(initialRenderResult, "the null Cam state must render an editor result.");
  assert.equal(
    state().singleJerseyCamProgram,
    null,
    "rendering the null state must not create a Cam Program."
  );

  createSingleJerseyCamProgram();
  assert.deepEqual(
    state().singleJerseyCamProgram.tracks,
    EXPECTED_CREATED_TRACKS,
    "explicit creation must produce the fixed 4 tracks x 4 feeds all-K draft."
  );

  const beforeEditProgram = state().singleJerseyCamProgram;
  const beforeEditTracks = beforeEditProgram.tracks;
  const beforeEditRows = [...beforeEditTracks];
  const beforeEditSnapshot = snapshot(beforeEditProgram);

  setSingleJerseyCamOperation(1, 0, "T");
  const afterEditProgram = state().singleJerseyCamProgram;

  assert.notEqual(afterEditProgram, beforeEditProgram);
  assert.notEqual(afterEditProgram.tracks, beforeEditTracks);
  for (let trackIndex = 0; trackIndex < beforeEditRows.length; trackIndex += 1) {
    assert.notEqual(
      afterEditProgram.tracks[trackIndex],
      beforeEditRows[trackIndex],
      `edit must create a new row at track ${trackIndex}.`
    );
  }
  assert.equal(
    snapshot(beforeEditProgram),
    beforeEditSnapshot,
    "cell editing must not change the old Cam Program contents."
  );
  assert.deepEqual(beforeEditProgram.tracks, EXPECTED_CREATED_TRACKS);

  setSingleJerseyCamOperation(2, 0, "M");
  setSingleJerseyCamOperation(3, 0, "K");
  assert.deepEqual(
    state().singleJerseyCamProgram.tracks,
    EXPECTED_EDITED_TRACKS,
    "Type rows must map to tracks without transposition."
  );
  assert.deepEqual(
    [...new Set(state().singleJerseyCamProgram.tracks.flat())],
    ["K", "T", "M"],
    "Cam cells must retain the K/T/M string domain behind icon rendering."
  );
  assert.ok(
    state().singleJerseyCamProgram.tracks
      .flat()
      .every((operation) => typeof operation === "string"),
    "Cam icon rendering must not replace operations with numeric Pattern symbols."
  );

  cycleSingleJerseyCamOperation(0, 1);
  assert.equal(state().singleJerseyCamProgram.tracks[0][1], "T");
  assert.equal(state().singleJerseyCamProgram.tracks[0][0], "K");
  assert.equal(state().singleJerseyCamProgram.tracks[0][2], "K");
  cycleSingleJerseyCamOperation(0, 1);
  assert.equal(state().singleJerseyCamProgram.tracks[0][1], "M");
  cycleSingleJerseyCamOperation(0, 1);
  assert.equal(state().singleJerseyCamProgram.tracks[0][1], "K");

  createSingleJerseyCamProgram(2, 3);
  setSingleJerseyCamOperation(0, 1, "T");
  setSingleJerseyCamOperation(0, 2, "M");
  setSingleJerseyCamOperation(1, 0, "T");
  setSingleJerseyCamOperation(1, 2, "M");
  assert.deepEqual(
    state().singleJerseyCamProgram.tracks,
    EXPECTED_TWO_BY_THREE,
    "the resize fixture must start from the fixed 2 x 3 matrix."
  );

  const sourceTwoByThree = state().singleJerseyCamProgram;
  const sourceTwoByThreeTracks = sourceTwoByThree.tracks;
  const sourceTwoByThreeRows = [...sourceTwoByThreeTracks];
  const sourceTwoByThreeSnapshot = snapshot(sourceTwoByThree);

  resizeSingleJerseyCamProgram(4, 5);
  const expandedFourByFive = state().singleJerseyCamProgram;

  assert.notEqual(expandedFourByFive, sourceTwoByThree);
  assert.notEqual(expandedFourByFive.tracks, sourceTwoByThreeTracks);
  assert.equal(snapshot(sourceTwoByThree), sourceTwoByThreeSnapshot);
  assert.deepEqual(sourceTwoByThree.tracks, EXPECTED_TWO_BY_THREE);
  for (let trackIndex = 0; trackIndex < sourceTwoByThreeRows.length; trackIndex += 1) {
    assert.notEqual(
      expandedFourByFive.tracks[trackIndex],
      sourceTwoByThreeRows[trackIndex],
      `expand must create a new row at track ${trackIndex}.`
    );
  }
  assert.deepEqual(
    expandedFourByFive.tracks,
    EXPECTED_FOUR_BY_FIVE,
    "2 x 3 must expand to the fixed 4 x 5 matrix."
  );

  const sourceFourByFive = expandedFourByFive;
  const sourceFourByFiveTracks = sourceFourByFive.tracks;
  const sourceFourByFiveRows = [...sourceFourByFiveTracks];
  const sourceFourByFiveSnapshot = snapshot(sourceFourByFive);

  resizeSingleJerseyCamProgram(1, 2);
  const shrunkOneByTwo = state().singleJerseyCamProgram;

  assert.notEqual(shrunkOneByTwo, sourceFourByFive);
  assert.notEqual(shrunkOneByTwo.tracks, sourceFourByFiveTracks);
  assert.notEqual(shrunkOneByTwo.tracks[0], sourceFourByFiveRows[0]);
  assert.equal(snapshot(sourceFourByFive), sourceFourByFiveSnapshot);
  assert.deepEqual(sourceFourByFive.tracks, EXPECTED_FOUR_BY_FIVE);
  assert.deepEqual(
    shrunkOneByTwo.tracks,
    EXPECTED_ONE_BY_TWO,
    "4 x 5 must shrink to the fixed 1 x 2 matrix."
  );

  const beforeInvalidDimensions = snapshot(state().singleJerseyCamProgram);
  for (const [tracks, feeds] of [
    [0, 4],
    [-1, 4],
    [4, 0],
    [4, -1],
    [1.5, 4],
    [4, 1.5],
  ]) {
    assert.throws(
      () => resizeSingleJerseyCamProgram(tracks, feeds),
      /tracks|feeds/,
      `invalid dimensions ${tracks} x ${feeds} must be rejected.`
    );
    assert.equal(
      snapshot(state().singleJerseyCamProgram),
      beforeInvalidDimensions
    );
  }

  const beforeInvalidOperations = snapshot(state().singleJerseyCamProgram);
  for (const operation of ["P", "X", "", null, 0]) {
    assert.throws(
      () => setSingleJerseyCamOperation(0, 0, operation),
      /K, T, or M/,
      `invalid operation ${String(operation)} must be rejected.`
    );
    assert.equal(
      snapshot(state().singleJerseyCamProgram),
      beforeInvalidOperations
    );
  }

  deleteSingleJerseyCamProgram();
  assert.equal(
    state().singleJerseyCamProgram,
    null,
    "deleting the Cam Program must restore the explicit unconfigured state."
  );
  singleJerseyCamProgramEditor();
  assert.equal(
    state().singleJerseyCamProgram,
    null,
    "rendering after delete must not recreate the Cam Program."
  );

  for (const [tracks, feeds] of [
    [0, 4],
    [-1, 4],
    [4, 0],
    [4, -1],
    [1.5, 4],
    [4, 1.5],
  ]) {
    assert.throws(
      () => createSingleJerseyCamProgram(tracks, feeds),
      /tracks|feeds/,
      `creation must reject invalid dimensions ${tracks} x ${feeds}.`
    );
    assert.equal(state().singleJerseyCamProgram, null);
  }

  const arrangement = [...MISMATCH_ARRANGEMENT];
  stateModule.dispatch({ needleArrangement: arrangement });
  const arrangementReference = state().needleArrangement;
  const arrangementSnapshot = snapshot(arrangementReference);

  createSingleJerseyCamProgram(3, 4);
  assert.equal(state().singleJerseyCamProgram.tracks.length, 3);
  assert.deepEqual(
    state().singleJerseyCamProgram.tracks,
    EXPECTED_THREE_BY_FOUR
  );
  assert.equal(state().needleArrangement, arrangementReference);
  assert.equal(snapshot(state().needleArrangement), arrangementSnapshot);
  assert.deepEqual(state().needleArrangement, MISMATCH_ARRANGEMENT);
  assert.throws(
    () =>
      resolveSingleJerseyOperations(
        state().singleJerseyCamProgram,
        state().needleArrangement,
        6,
        1
      ),
    {
      name: "RangeError",
      message: MISMATCH_ERROR,
    }
  );
  assert.equal(state().singleJerseyCamProgram.tracks.length, 3);
  assert.equal(state().needleArrangement, arrangementReference);
  assert.equal(snapshot(state().needleArrangement), arrangementSnapshot);

  deleteSingleJerseyCamProgram();
  assert.equal(state().singleJerseyCamProgram, null);
  assert.equal(state().needleArrangement, arrangementReference);

  const stateSource = fs.readFileSync("src/state.js", "utf8");
  assert.match(
    stateSource,
    /singleJerseyCamProgram:\s*null/,
    "startup state must remain null."
  );

  const actionSource = fs.readFileSync(actionPath, "utf8");
  const viewSource = fs.readFileSync(viewPath, "utf8");
  const toolbarSource = fs.readFileSync(toolbarPath, "utf8");
  const editorSource = `${actionSource}\n${viewSource}`;
  for (const forbidden of [
    "repeats",
    "repeat.bitmap",
    "GLOBAL_STATE.chart",
    "Pattern",
    "generateChart",
    "buildChartFromRepeats",
    "runSimulation",
    "arrangedChart",
    "needleExecution",
    "Three.js",
    "resolveSingleJerseyOperations",
    "singleJerseySimulationInput",
    "needleArrangement",
  ]) {
    assert.equal(
      editorSource.includes(forbidden),
      false,
      `Cam editor/actions must not reference ${forbidden}.`
    );
  }

  const dispatchLines = actionSource
    .split(/\r?\n/)
    .filter((line) => line.includes("dispatch("));
  assert.equal(dispatchLines.length, 4);
  assert.ok(
    dispatchLines.every((line) => line.includes("singleJerseyCamProgram")),
    "every Cam action dispatch must update only singleJerseyCamProgram."
  );

  assert.match(
    viewSource,
    /camProgram\.tracks\.map\(\s*\(track,\s*trackIndex\)\s*=>\s*html`<tr>/s,
    "outer UI iteration must create Type rows from tracks."
  );
  assert.match(
    viewSource,
    /track\.map\(\s*\(operation,\s*feedIndex\)\s*=>\s*html`<td>/s,
    "inner UI iteration must create Feed cells from each track."
  );
  assert.match(
    viewSource,
    /cycleSingleJerseyCamOperation\(trackIndex,\s*feedIndex\)/s,
    "cell clicks must preserve the tracks[typeIndex][feedIndex] order."
  );

  for (const [operation, iconVariable, assetName] of [
    ["K", "knitIconUrl", "knit"],
    ["T", "tuckIconUrl", "tuck"],
    ["M", "slipIconUrl", "slip"],
  ]) {
    const importPattern = new RegExp(
      `import ${iconVariable} from "\\.\\.\\/assets\\/symbols\\/${assetName}\\.svg";`
    );
    assert.match(
      toolbarSource,
      importPattern,
      `the top stitch toolbar must continue to own the existing ${assetName} icon.`
    );
    assert.match(
      viewSource,
      importPattern,
      `Cam ${operation} must reuse the toolbar's existing ${assetName} SVG.`
    );
  }

  const operationIconMap = viewSource.match(
    /const OPERATION_ICON_URLS\s*=\s*\{([\s\S]*?)\};/
  );
  assert.ok(operationIconMap, "the Cam view must define a display-only icon map.");
  assert.match(operationIconMap[1], /K:\s*knitIconUrl/);
  assert.match(operationIconMap[1], /T:\s*tuckIconUrl/);
  assert.match(operationIconMap[1], /M:\s*slipIconUrl/);
  assert.doesNotMatch(
    operationIconMap[1],
    /\bP\s*:|purl/i,
    "P and its purl icon must not be selectable Cam operations."
  );
  assert.doesNotMatch(viewSource, /purlIconUrl|symbols\/purl\.svg/);
  assert.match(
    viewSource,
    /const OPERATION_ORDER = \["K", "T", "M"\];/,
    "the Cam legend must expose only the K/T/M display order."
  );
  assert.match(
    viewSource,
    /function operationLegend[\s\S]*?OPERATION_ORDER\.map[\s\S]*?src=\$\{OPERATION_ICON_URLS\[operation\]\}/,
    "the Cam legend must show the same mapped SVGs as the cells."
  );
  assert.match(
    viewSource,
    /class="symbol-preview-image"[\s\S]*?src=\$\{OPERATION_ICON_URLS\[operation\]\}/,
    "each Cam cell must render the mapped toolbar symbol image."
  );
  assert.doesNotMatch(
    viewSource,
    /\$\{operation\}\s*<\/button>/,
    "Cam cells must show the mapped icon instead of the raw K/T/M letter."
  );
  assert.match(
    viewSource,
    /camProgram\.type[\s\S]*?number:\s*trackIndex\s*\+\s*1/,
    "Type labels must display the zero-based track index plus one."
  );
  assert.match(
    viewSource,
    /camProgram\.feed[\s\S]*?number:\s*feed\s*\+\s*1/,
    "Feed labels must display the zero-based feed index plus one."
  );

  const nullBranchStart = viewSource.indexOf("if (camProgram === null)");
  const nullBranchEnd = viewSource.indexOf("const trackCount", nullBranchStart);
  assert.ok(nullBranchStart >= 0 && nullBranchEnd > nullBranchStart);
  const nullBranchSource = viewSource.slice(nullBranchStart, nullBranchEnd);
  assert.match(nullBranchSource, /createSingleJerseyCamProgram\(\)/);
  assert.doesNotMatch(
    nullBranchSource,
    /resizeSingleJerseyCamProgram|cycleSingleJerseyCamOperation|deleteSingleJerseyCamProgram/
  );
  assert.match(
    actionSource,
    /deleteSingleJerseyCamProgram\(\)[\s\S]*?dispatch\(\{\s*singleJerseyCamProgram:\s*null\s*\}\)/,
    "delete must only publish the null Cam owner state."
  );
  assert.doesNotMatch(
    viewSource,
    /addEventListener/,
    "the Lit view must not accumulate manual event listeners."
  );

  for (const forbiddenLabel of ["Repeat", "Pattern", "Course", "Wale"]) {
    assert.equal(
      viewSource.includes(forbiddenLabel),
      false,
      `Cam Program UI must not display ${forbiddenLabel} semantics.`
    );
  }

  const translationsSource = fs.readFileSync("src/i18n/translations.js", "utf8");
  for (const key of [
    "camProgram.create",
    "camProgram.tracks",
    "camProgram.feeds",
    "camProgram.type",
    "camProgram.feed",
    "camProgram.knit",
    "camProgram.tuck",
    "camProgram.miss",
    "camProgram.delete",
  ]) {
    assert.equal(
      translationsSource.split(`\"${key}\"`).length - 1,
      4,
      `${key} must be defined for every supported language.`
    );
  }

  const viewRootSource = fs.readFileSync("src/views/view.js", "utf8");
  assert.match(
    viewRootSource,
    /singleJerseyCamProgramEditor\(\)/,
    "the independent Cam Program editor must be mounted in the main view."
  );

  const runSimulationSource = fs.readFileSync(
    "src/components/runSimulation.js",
    "utf8"
  );
  assert.match(
    runSimulationSource,
    /createSingleJerseyExecutionInput\(\s*GLOBAL_STATE\.singleJerseyCamProgram,\s*GLOBAL_STATE\.needleArrangement,\s*baseSimulation\.width,\s*baseSimulation\.height\s*\)/s,
    "Cam Program may reach only the approved post-arrangement execution path."
  );
  assert.doesNotMatch(
    runSimulationSource,
    /createSingleJerseyCamProgram|resizeSingleJerseyCamProgram|setSingleJerseyCamOperation|cycleSingleJerseyCamOperation|deleteSingleJerseyCamProgram/,
    "simulation must not own or mutate Cam Program editing actions."
  );

  console.log(
    "PASS: Single Jersey Cam Program editor owns explicit, dynamic K/T/M machine data."
  );
} finally {
  await server.close();
}
