import { Bimp } from "./lib/Bimp.js";
import {
  SNAPSHOT_INTERVAL,
  DEFAULT_PATTERN_LIBRARY,
  DEFAULT_SYMBOLS,
  SNAPSHOT_FIELDS,
  DEFAULT_YARN_COLOR,
  DEFAULT_YARN_PLIES,
  DEFAULT_STITCH_SYMBOL_INDEX,
  TEXTURE_PERFORMANCE_MODES,
  DEFAULT_MACHINE_GAUGE,
} from "./constants.js";
import { getInitialLanguage } from "./i18n/index.js";
import { cloneBitmap } from "./needleArrangement/transform.js";
import {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_UNIT_HEIGHT,
  DEFAULT_UNIT_WIDTH,
  withDerivedPatternBitmaps,
} from "./patternDerivation.js";

const defaultCamUnitBitmap = Bimp.empty(
  DEFAULT_UNIT_WIDTH,
  DEFAULT_UNIT_HEIGHT,
  DEFAULT_STITCH_SYMBOL_INDEX
);
let GLOBAL_STATE = withDerivedPatternBitmaps({
  language: getInitialLanguage(),
  editingPalette: false,
  transforming: false,

  activeTool: null,
  activeSymbol: 0,

  canvasWidth: DEFAULT_CANVAS_WIDTH,
  canvasHeight: DEFAULT_CANVAS_HEIGHT,
  chartPan: { x: 0, y: 0 },
  camUnitBitmap: defaultCamUnitBitmap,
  needleUnitBitmap: cloneBitmap(defaultCamUnitBitmap),
  needleInputs: ["1", "2", "3", "4"],
  appliedNeedleInputs: ["1", "2", "3", "4"],
  needleInputErrors: [null, null, null, null],

  symbolPalette: {},
  symbolMap: DEFAULT_SYMBOLS,
  patternLibrary: DEFAULT_PATTERN_LIBRARY,

  scale: 15,

  simScale: 1,
  simPan: { x: 0, y: 0 },
  simPreviewScale: null,
  simPreviewPan: null,
  texturePerformanceMode: TEXTURE_PERFORMANCE_MODES.AUTO,
  texturePreviewInteractionActive: false,
  machineGauge: DEFAULT_MACHINE_GAUGE,
  yarnLengthMetrics: null,

  activeYarn: 0,
  yarnPalette: [DEFAULT_YARN_COLOR], // Colors of the yarns
  yarnSequence: new Bimp(1, 60, Array(60).fill(0)),
  yarnPlies: DEFAULT_YARN_PLIES.map((ply) => ({ ...ply })),

  reverseScroll: false,
  grid: true,
  symbolLineWidth: 3,
  flipped: false,

  // PUNCH CARD
  punchcardMode: false, // constrains pattern width to a punchcard-friendly width
  machine: "th860",
  punchVerticalRepeats: 5,
  numSides: 8, //number of punch sides

  // Various UI pane states
  showLibrary: false,
  showSettings: false,
  showDownload: false,
  debug: false,

  snapshots: [], // Array of snapshot history
  lastSnapshot: 0, // time of last snapshot
  heldKeys: new Set(), // Keys that are currently held down
});

function derivedBitmapFields(changes) {
  const dimensionsChanged =
    changes.includes("canvasWidth") || changes.includes("canvasHeight");
  const fields = [];
  if (dimensionsChanged || changes.includes("camUnitBitmap")) {
    fields.push("camBitmap");
  }
  if (dimensionsChanged || changes.includes("needleUnitBitmap")) {
    fields.push("needleBitmap");
  }
  return fields;
}

function changesWithDerivedBitmaps(changes) {
  return [
    ...changes,
    ...derivedBitmapFields(changes).filter((field) => !changes.includes(field)),
  ];
}

function updateDerivedBitmaps(state, changes) {
  const fields = derivedBitmapFields(changes);
  return fields.length ? withDerivedPatternBitmaps(state, fields) : state;
}

function loadWorkspace(workspace) {
  const workspaceChanges = Object.keys(workspace);
  const changes = changesWithDerivedBitmaps(workspaceChanges);
  const nextState = { ...GLOBAL_STATE, ...workspace };
  GLOBAL_STATE = updateDerivedBitmaps(nextState, workspaceChanges);
  GLOBAL_STATE.updateSim = true;
  StateMonitor.syncState(GLOBAL_STATE, changes);
}

function shouldSnapshot(action) {
  if (!(GLOBAL_STATE.lastSnapshot < Date.now() - SNAPSHOT_INTERVAL))
    return false;

  for (const field of SNAPSHOT_FIELDS) {
    if (field in action) return true;
  }

  return false;
}

function snapshotUpdate(action) {
  const nextState = {
    ...GLOBAL_STATE,
    ...action,
    snapshots: [
      Object.fromEntries(
        SNAPSHOT_FIELDS.map((field) => [field, GLOBAL_STATE[field]])
      ),
      ...GLOBAL_STATE.snapshots,
    ],
    lastSnapshot: Date.now(),
  };
  GLOBAL_STATE = updateDerivedBitmaps(nextState, Object.keys(action));

  return GLOBAL_STATE;
}

function normalUpdate(action) {
  const nextState = { ...GLOBAL_STATE, ...action };
  GLOBAL_STATE = updateDerivedBitmaps(nextState, Object.keys(action));
  return GLOBAL_STATE;
}

function updateState(action) {
  return shouldSnapshot(action) ? snapshotUpdate(action) : normalUpdate(action);
}

function undo() {
  if (GLOBAL_STATE.snapshots.length < 1) return;
  const changes = Object.keys(GLOBAL_STATE.snapshots[0]);

  GLOBAL_STATE = withDerivedPatternBitmaps({
    ...GLOBAL_STATE,
    ...GLOBAL_STATE.snapshots[0],
    lastSnapshot: 0,
    snapshots: GLOBAL_STATE.snapshots.slice(1),
  });

  StateMonitor.syncState(GLOBAL_STATE, changesWithDerivedBitmaps(changes));
}

function dispatch(action) {
  const changes = changesWithDerivedBitmaps(Object.keys(action));
  StateMonitor.syncState(updateState(action), changes);
}

const StateMonitor = (() => {
  const components = [];

  function syncState(state, changes) {
    components.forEach((component) => {
      component.syncState(state, changes);
    });
  }

  function register(componentArr) {
    componentArr.forEach((component) =>
      components.push(component({ state: GLOBAL_STATE, dispatch }))
    );
  }

  return {
    register,
    syncState,
  };
})();

export { GLOBAL_STATE, undo, dispatch, StateMonitor, loadWorkspace };
