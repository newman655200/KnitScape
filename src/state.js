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

const defaultCamBitmap = Bimp.empty(
  48,
  60,
  DEFAULT_STITCH_SYMBOL_INDEX
);

let GLOBAL_STATE = {
  language: getInitialLanguage(),
  editingPalette: false,
  transforming: false,

  activeTool: null,
  activeSymbol: 0,

  camBitmap: defaultCamBitmap,
  needleBitmap: cloneBitmap(defaultCamBitmap),
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
};

function loadWorkspace(workspace) {
  GLOBAL_STATE = { ...GLOBAL_STATE, ...workspace };
  GLOBAL_STATE.updateSim = true;
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
  GLOBAL_STATE = {
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

  return GLOBAL_STATE;
}

function normalUpdate(action) {
  GLOBAL_STATE = { ...GLOBAL_STATE, ...action };
  return GLOBAL_STATE;
}

function updateState(action) {
  return shouldSnapshot(action) ? snapshotUpdate(action) : normalUpdate(action);
}

function undo() {
  if (GLOBAL_STATE.snapshots.length < 1) return;
  const changes = Object.keys(GLOBAL_STATE.snapshots[0]);

  GLOBAL_STATE = {
    ...GLOBAL_STATE,
    ...GLOBAL_STATE.snapshots[0],
    lastSnapshot: 0,
    snapshots: GLOBAL_STATE.snapshots.slice(1),
  };

  StateMonitor.syncState(GLOBAL_STATE, changes);
}

function dispatch(action) {
  const changes = Object.keys(action);
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
