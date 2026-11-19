import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

const actionPath = "src/actions/singleJerseyCamProgram.js";
const viewPath = "src/views/singleJerseyCamProgramEditor.js";
const toolbarPath = "src/views/chartEditorToolbar.js";
const stylesPath = "styles.css";

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
    getSingleJerseyFeedIndices,
    setSingleJerseyFeedYarnLength,
    setSingleJerseyFeedYarnLengths,
    clearSingleJerseyFeedYarnLength,
    setSingleJerseyFeedYarns,
    setSingleJerseyCamOperation,
  } = await server.ssrLoadModule(`/${actionPath}`);
  const { resolveSingleJerseyOperations } = await server.ssrLoadModule(
    "/src/domain/singleJerseyMachine.js"
  );
  const { singleJerseyCamProgramEditor } = await server.ssrLoadModule(
    `/${viewPath}`
  );
  const { translations } = await server.ssrLoadModule(
    "/src/i18n/translations.js"
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

  const yarnPaletteReference = state().yarnPalette;
  const yarnSequenceReference = state().yarnSequence;
  const yarnPliesReference = state().yarnPlies;
  setSingleJerseyFeedYarns(0, [
    {
      yarnId: "shared-yarn",
      yarnLengthCmPer100Needles: 24,
      tensionCN: null,
    },
  ]);
  const feedTwoYarns = [
    {
      yarnId: "shared-yarn",
      yarnLengthCmPer100Needles: 31,
      tensionCN: null,
    },
    {
      yarnId: "companion-yarn",
      yarnLengthCmPer100Needles: 18,
      tensionCN: 12,
      placement: "parallel",
    },
  ];
  setSingleJerseyFeedYarns(1, feedTwoYarns);
  feedTwoYarns[0].yarnLengthCmPer100Needles = 99;

  assert.deepEqual(state().singleJerseyCamProgram.feeds[0].yarns, [
    {
      yarnId: "shared-yarn",
      yarnLengthCmPer100Needles: 24,
      tensionCN: null,
      placement: "parallel",
    },
  ]);
  assert.deepEqual(state().singleJerseyCamProgram.feeds[1].yarns, [
    {
      yarnId: "shared-yarn",
      yarnLengthCmPer100Needles: 31,
      tensionCN: null,
      placement: "parallel",
    },
    {
      yarnId: "companion-yarn",
      yarnLengthCmPer100Needles: 18,
      tensionCN: 12,
      placement: "parallel",
    },
  ]);
  assert.equal(state().yarnPalette, yarnPaletteReference);
  assert.equal(state().yarnSequence, yarnSequenceReference);
  assert.equal(state().yarnPlies, yarnPliesReference);

  assert.deepEqual(getSingleJerseyFeedIndices("all", 4), [0, 1, 2, 3]);
  assert.deepEqual(getSingleJerseyFeedIndices("odd", 4), [0, 2]);
  assert.deepEqual(getSingleJerseyFeedIndices("even", 4), [1, 3]);
  assert.deepEqual(
    getSingleJerseyFeedIndices("selected", 4, [3, 1, 1, -1, 8]),
    [1, 3]
  );

  setSingleJerseyFeedYarnLength(1, 1, 8);
  assert.deepEqual(
    state().singleJerseyCamProgram.feeds[1].yarns.map(
      (yarn) => yarn.yarnLengthCmPer100Needles
    ),
    [31, 8],
    "editing Yarn 2 must not change Yarn 1 in the same Feed."
  );
  const commitBatch = (targets, value) => setSingleJerseyFeedYarnLengths({
    structureRevision: state().feedYarnStructureRevision, targets }, value);
  const targetLocator = (feedIndex, yarnIndex = 0) => ({ feedIndex, yarnIndex,
    yarnId: state().singleJerseyCamProgram.feeds[feedIndex].yarns[yarnIndex].yarnId });
  commitBatch([targetLocator(0), targetLocator(2)], 21);
  assert.deepEqual(
    state().singleJerseyCamProgram.feeds.map((feed) =>
      feed.yarns.map((yarn) => yarn.yarnLengthCmPer100Needles)
    ),
    [[21], [31, 8], [21], [0]],
    "odd Feed batch editing must only update Feed 1 and Feed 3."
  );
  commitBatch([targetLocator(1), targetLocator(3)], 27);
  assert.deepEqual(
    state().singleJerseyCamProgram.feeds.map((feed) =>
      feed.yarns.map((yarn) => yarn.yarnLengthCmPer100Needles)
    ),
    [[21], [27, 8], [21], [27]],
    "even Feed candidates must not implicitly select other Yarns."
  );
  commitBatch([targetLocator(0), targetLocator(3)], 23);
  assert.deepEqual(
    state().singleJerseyCamProgram.feeds.map((feed) =>
      feed.yarns.map((yarn) => yarn.yarnLengthCmPer100Needles)
    ),
    [[23], [27, 8], [21], [23]],
    "selected Feed batch editing must preserve unselected Feeds."
  );
  commitBatch(
    [targetLocator(0), targetLocator(1), targetLocator(1, 1), targetLocator(2), targetLocator(3)],
    25
  );
  assert.deepEqual(
    state().singleJerseyCamProgram.feeds.map((feed) =>
      feed.yarns.map((yarn) => yarn.yarnLengthCmPer100Needles)
    ),
    [[25], [25, 25], [25], [25]],
    "all Feed batch editing must update every Feed in one action."
  );
  setSingleJerseyFeedYarnLength(0, 0, 23);
  const beforeEmptyDraft = state();
  assert.equal(setSingleJerseyFeedYarnLength(0, 0, "").ok, false);
  assert.equal(setSingleJerseyFeedYarnLength(0, 0, 0).ok, false);
  assert.equal(state(), beforeEmptyDraft, "zero/empty drafts must not commit Clear.");
  clearSingleJerseyFeedYarnLength(0, 0);
  assert.equal(
    state().singleJerseyCamProgram.feeds[0].yarns[0].yarnLengthCmPer100Needles,
    0,
    "only explicit Clear edits to the legacy zero/fallback value."
  );
  setSingleJerseyFeedYarnLength(0, 0, 23);
  const validLengthState = state();
  assert.deepEqual(setSingleJerseyFeedYarnLength(0, 0, "invalid"), {
    ok: false, reason: "INVALID_YARN_LENGTH", previousValue: 23,
  });
  assert.equal(state(), validLengthState, "invalid input must not dispatch.");
  assert.equal(
    state().singleJerseyCamProgram.feeds[0].yarns[0].yarnLengthCmPer100Needles,
    23,
    "an invalid yarn length must retain the valid target."
  );

  const operationsWithoutFeedYarns = resolveSingleJerseyOperations(
    { tracks: state().singleJerseyCamProgram.tracks },
    [1, 2, 3, 4],
    8,
    4
  );
  assert.deepEqual(
    resolveSingleJerseyOperations(
      state().singleJerseyCamProgram,
      [1, 2, 3, 4],
      8,
      4
    ),
    operationsWithoutFeedYarns,
    "Feed Yarn metadata must not change machine operations."
  );

  stateModule.dispatch({
    singleJerseyCamProgram: { tracks: EXPECTED_CREATED_TRACKS },
  });
  resizeSingleJerseyCamProgram(4, 4);
  assert.equal(state().singleJerseyCamProgram.feeds.length, 4);
  assert.ok(
    state().singleJerseyCamProgram.feeds.every(
      (feed) =>
        snapshot(feed.yarns) ===
        snapshot([
          {
            yarnId: 0,
            yarnLengthCmPer100Needles: 0,
            tensionCN: null,
            placement: "parallel",
          },
        ])
    ),
    "legacy Cam state without feeds/yarns must receive the minimal default."
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

  const actualOperationCycle = [
    state().singleJerseyCamProgram.tracks[0][1],
  ];
  cycleSingleJerseyCamOperation(0, 1);
  actualOperationCycle.push(state().singleJerseyCamProgram.tracks[0][1]);
  assert.equal(state().singleJerseyCamProgram.tracks[0][0], "K");
  assert.equal(state().singleJerseyCamProgram.tracks[0][2], "K");
  cycleSingleJerseyCamOperation(0, 1);
  actualOperationCycle.push(state().singleJerseyCamProgram.tracks[0][1]);
  cycleSingleJerseyCamOperation(0, 1);
  actualOperationCycle.push(state().singleJerseyCamProgram.tracks[0][1]);
  assert.deepEqual(
    actualOperationCycle,
    ["K", "T", "M", "K"],
    "cell clicks must keep the K to T to M to K operation cycle."
  );

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
  const stylesSource = fs.readFileSync(stylesPath, "utf8");
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
  assert.equal(dispatchLines.length, 7);
  assert.ok(
    dispatchLines.every((line) => line.includes("singleJerseyCamProgram")),
    "every Cam action dispatch must update only singleJerseyCamProgram."
  );

  assert.match(
    viewSource,
    /camProgram\.tracks\.map\(\s*\(track,\s*trackIndex\)\s*=>\s*html`<tr>/s,
    "outer UI iteration must create Type rows from tracks."
  );
  assert.match(viewSource, /@change=\$\{commitYarnLength\}/);
  assert.match(viewSource, /event\.currentTarget\.blur\(\)/);
  assert.doesNotMatch(
    viewSource,
    /@input=\$\{[^}]*setSingleJerseyFeedYarnLength/,
    "typing a partial number must not run the Solver before blur or Enter."
  );
  assert.match(viewSource, /name="selected-feed"/);
  assert.match(viewSource, /camProgram\.batchAll/);
  assert.match(viewSource, /camProgram\.batchOdd/);
  assert.match(viewSource, /camProgram\.batchEven/);
  assert.match(viewSource, /camProgram\.batchSelected/);
  assert.match(viewSource, /name="yarnLength"/);
  assert.match(viewSource, /form\.elements\.yarnLength\.value/);
  assert.doesNotMatch(
    viewSource,
    /form\.elements\.length\.value/,
    "the batch input name must not collide with form.elements.length."
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
    /const OPERATION_ORDER = \["K", "M", "T"\];/,
    "the Cam legend must preserve the Pattern toolbar's remaining K/M/T visual order."
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
  assert.equal(
    translations["zh-CN"]["camProgram.empty"],
    "尚未创建 Cam Program。创建后得到可调整尺寸的 4×4 全成圈（下）草稿；4×4 不是固定机器标准。"
  );
  assert.equal(translations["zh-CN"]["camProgram.knit"], "成圈（下）");
  assert.equal(translations["zh-CN"]["camProgram.miss"], "平针");
  assert.equal(translations["zh-CN"]["camProgram.tuck"], "半针");
  assert.equal(
    translations["zh-CN"]["camProgram.cycleHint"],
    "点击格子循环 成圈（下） → 半针 → 平针"
  );
  assert.equal(
    translations["zh-TW"]["camProgram.empty"],
    "尚未建立 Cam Program。建立後得到可調整尺寸的 4×4 全成圈（下）草稿；4×4 不是固定機器標準。"
  );
  assert.equal(translations["zh-TW"]["camProgram.knit"], "成圈（下）");
  assert.equal(translations["zh-TW"]["camProgram.miss"], "平針");
  assert.equal(translations["zh-TW"]["camProgram.tuck"], "半針");
  assert.equal(
    translations["zh-TW"]["camProgram.cycleHint"],
    "點擊格子循環 成圈（下） → 半針 → 平針"
  );
  assert.equal(translations.en["camProgram.knit"], "Knit K");
  assert.equal(translations.en["camProgram.miss"], "Miss M");
  assert.equal(translations.en["camProgram.tuck"], "Tuck T");
  assert.equal(
    translations.en["camProgram.cycleHint"],
    "Click a cell to cycle K → T → M"
  );
  assert.equal(translations.vi["camProgram.knit"], "Knit K");
  assert.equal(translations.vi["camProgram.miss"], "Miss M");
  assert.equal(translations.vi["camProgram.tuck"], "Tuck T");
  assert.equal(
    translations.vi["camProgram.cycleHint"],
    "Nhấp ô để chuyển K → T → M"
  );
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
    "camProgram.yarnLength",
    "camProgram.yarnLengthUnit",
    "camProgram.yarn",
    "camProgram.batchYarnLength",
    "camProgram.batchAll",
    "camProgram.batchOdd",
    "camProgram.batchEven",
    "camProgram.batchSelected",
    "camProgram.batchApply",
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
  const coordinatorSource = fs.readFileSync("src/components/simulationCoordinator.js", "utf8");
  const hostSource = fs.readFileSync("src/components/simulationPreviewHost.js", "utf8");
  assert.match(
    runSimulationSource,
    /import\s+\{\s*createSimulationCoordinator\s*\}\s+from\s+"\.\/simulationCoordinator\.js"/,
    "the app must route simulation inputs through the shared coordinator."
  );
  assert.equal((runSimulationSource.match(/createSimulationCoordinator\(/g) || []).length, 1);
  assert.match(runSimulationSource, /ownedCoordinator\.compute\(GLOBAL_STATE,/,
    "the coordinator must receive current project inputs.");
  assert.match(
    coordinatorSource,
    /createSingleJerseyExecutionInput\(\s*state\.singleJerseyCamProgram,\s*state\.needleArrangement,\s*state\.chart\.width,\s*state\.chart\.height\s*\)/s,
    "Cam Program may reach only the approved post-arrangement execution path."
  );
  assert.equal((coordinatorSource.match(/createSingleJerseyExecutionInput\(/g) || []).length, 1);
  assert.doesNotMatch(coordinatorSource + runSimulationSource + hostSource,
    /resolveSingleJerseyOperations|createSingleJerseySimulationInput|tracks\s*\[/,
    "scheduling and rendering must not duplicate Cam operation resolution or the adapter.");
  assert.doesNotMatch(
    runSimulationSource,
    /createSingleJerseyCamProgram|resizeSingleJerseyCamProgram|setSingleJerseyCamOperation|cycleSingleJerseyCamOperation|deleteSingleJerseyCamProgram/,
    "simulation must not own or mutate Cam Program editing actions."
  );
  assert.doesNotMatch(coordinatorSource + hostSource,
    /createSingleJerseyCamProgram|resizeSingleJerseyCamProgram|setSingleJerseyCamOperation|cycleSingleJerseyCamOperation|deleteSingleJerseyCamProgram/,
    "the coordinator and renderer host must not own or mutate Cam Program editing actions.");

  const machineWorkspaceMatches = [
    ...stylesSource.matchAll(/#machine-workspace\s*\{([^}]*)\}/g),
  ];
  const machineWorkspaceStyles = machineWorkspaceMatches.at(-1)?.[1];
  const camEditorStyles = stylesSource.match(
    /#single-jersey-cam-editor\s*\{([^}]*)\}/
  )?.[1];
  const camGridScrollerStyles = stylesSource.match(
    /\.cam-program-grid-scroller\s*\{([^}]*)\}/
  )?.[1];
  const camLegendItemStyles = stylesSource.match(
    /\.cam-program-legend\s*>\s*span\s*\{([^}]*)\}/
  )?.[1];
  const camLegendIconStyles = stylesSource.match(
    /\.cam-program-legend\s+\.symbol-preview-image\s*\{([^}]*)\}/
  )?.[1];
  assert.ok(machineWorkspaceStyles, "Machine workspace styles must exist.");
  assert.ok(camEditorStyles, "Cam editor styles must exist.");
  assert.ok(camGridScrollerStyles, "Cam grid scroller styles must exist.");
  assert.ok(camLegendItemStyles, "Cam legend item styles must exist.");
  assert.ok(camLegendIconStyles, "Cam legend icon styles must exist.");
  assert.match(machineWorkspaceStyles, /display:\s*flex/);
  assert.match(machineWorkspaceStyles, /flex-direction:\s*column/);
  assert.match(machineWorkspaceStyles, /overflow:\s*hidden/);
  assert.match(camEditorStyles, /flex:\s*1 1 auto/);
  assert.match(camEditorStyles, /min-height:\s*0/);
  assert.match(camEditorStyles, /overflow:\s*hidden/);
  assert.doesNotMatch(
    camEditorStyles,
    /max-height/,
    "Cam editor must not keep the legacy fixed-height cap."
  );
  assert.match(camGridScrollerStyles, /flex:\s*1 1 auto/);
  assert.match(camGridScrollerStyles, /min-height:\s*0/);
  assert.match(camGridScrollerStyles, /overflow:\s*auto/);
  assert.match(camLegendItemStyles, /box-sizing:\s*border-box/);
  assert.match(camLegendItemStyles, /flex:\s*0 0 6\.25rem/);
  assert.match(camLegendItemStyles, /width:\s*6\.25rem/);
  assert.match(camLegendItemStyles, /height:\s*2rem/);
  assert.match(camLegendItemStyles, /justify-content:\s*flex-start/);
  assert.match(camLegendItemStyles, /align-items:\s*center/);
  assert.match(camLegendItemStyles, /gap:\s*0\.3rem/);
  assert.match(camLegendItemStyles, /padding:\s*0\.28rem 0\.42rem/);
  assert.match(camLegendItemStyles, /border:\s*1px solid/);
  assert.match(camLegendIconStyles, /display:\s*block/);
  assert.match(camLegendIconStyles, /flex:\s*0 0 1\.25rem/);
  assert.match(camLegendIconStyles, /width:\s*1\.25rem/);
  assert.match(camLegendIconStyles, /height:\s*1\.25rem/);
  assert.match(camLegendIconStyles, /padding:\s*0/);
  assert.match(camLegendIconStyles, /object-fit:\s*contain/);
  assert.doesNotMatch(
    camLegendIconStyles,
    /transform|scale/,
    "Cam legend icons must share one unscaled display rule."
  );

  console.log(
    "PASS: Single Jersey Cam Program editor owns explicit, dynamic K/T/M machine data."
  );
} finally {
  await server.close();
}
