import { Bimp } from "../lib/Bimp";
import { GLOBAL_STATE, dispatch } from "../state";
import { fitChart } from "./zoomFit";
import {
  DEFAULT_YARN_COLOR,
  DEFAULT_YARN_PLIES,
  DEFAULT_STITCH_SYMBOL_INDEX,
} from "../constants";
import { normalizeYarnPly } from "../yarnTexture/yarnScanTexture";
import { normalizeYarnSequence } from "./yarnSequenceRows";
import { normalizeYarnLibrary } from "../domain/yarnLibrary.js";
import { normalizeSingleJerseyCamProgram } from "./singleJerseyCamProgram.js";
import { resolveSingleJerseyOperations } from "../domain/singleJerseyMachine.js";
import { YarnAssetRegistry, yarnAssetRegistry, getYarnPbrAssetRefs } from "../yarnTexture/yarnAssetRegistry.js";
import { migrateYarnLibraryAssets, readProjectPackage } from "./projectPackage.js";
import { cancelYarnPbrImports } from "./yarnLibrary.js";
import { t } from "../i18n/index.js";

let projectLoadRequest = 0;

function cloneYarnPlies(plies = DEFAULT_YARN_PLIES) {
  const source = Array.isArray(plies) && plies.length ? plies : DEFAULT_YARN_PLIES;
  return source.map((ply, index) => {
    const normalized = normalizeYarnPly(
      ply,
      DEFAULT_YARN_PLIES[index] || DEFAULT_YARN_PLIES[0]
    );
    return { ...normalized, texture: normalized.texture };
  });
}

function hasProjectAssets(project) {
  return Object.hasOwn(project, "yarnLibrary") || Object.hasOwn(project, "singleJerseyCamProgram");
}

function yarnProjectFields(project) {
  // Legacy Pattern-only imports retain the current Machine and Yarn Library.
  const hasCam = Object.hasOwn(project, "singleJerseyCamProgram");
  const hasLibrary = Object.hasOwn(project, "yarnLibrary");
  if (!hasCam && !hasLibrary) return {};
  const cam = hasCam ? normalizeSingleJerseyCamProgram(project.singleJerseyCamProgram)
    : GLOBAL_STATE.singleJerseyCamProgram;
  const fields = { yarnLibrary: normalizeYarnLibrary(
    hasLibrary ? project.yarnLibrary : GLOBAL_STATE.yarnLibrary, cam?.feeds),
    pendingYarnId: null, yarnLibraryError: null };
  if (hasCam) {
    fields.singleJerseyCamProgram = cam;
    for (const key of ["needleArrangement", "needleArrangementInputs", "machineGauge"]) {
      if (Object.hasOwn(project, key)) fields[key] = structuredClone(project[key]);
    }
    const arrangement = fields.needleArrangement ?? GLOBAL_STATE.needleArrangement;
    if (!Array.isArray(arrangement) || arrangement.some(type => !Number.isInteger(type) || type <= 0)) {
      throw new TypeError("Invalid needle arrangement.");
    }
    if (fields.needleArrangementInputs !== undefined &&
      (!Array.isArray(fields.needleArrangementInputs) || fields.needleArrangementInputs.length !== 4 ||
        fields.needleArrangementInputs.some(value => typeof value !== "string"))) {
      throw new TypeError("Invalid needle arrangement inputs.");
    }
    if (fields.machineGauge !== undefined &&
      (!Number.isFinite(fields.machineGauge) || fields.machineGauge <= 0)) {
      throw new TypeError("Invalid machine Gauge.");
    }
    if (cam && arrangement.length) resolveSingleJerseyOperations(cam, arrangement, 1, 1);
  }
  return fields;
}

function validatePattern(project) {
  for (const size of [project.width, project.height]) {
    if (!Number.isSafeInteger(size) || size <= 0) throw new TypeError("Invalid Pattern dimensions.");
  }
  if (!Array.isArray(project.repeats)) throw new TypeError("Invalid Pattern repeats.");
  for (const repeat of project.repeats) {
    const bitmap = repeat?.bitmap;
    if (!bitmap || !Number.isSafeInteger(bitmap.width) || bitmap.width <= 0 ||
      !Number.isSafeInteger(bitmap.height) || bitmap.height <= 0 ||
      !Array.isArray(bitmap.pixels) || bitmap.pixels.length !== bitmap.width * bitmap.height ||
      bitmap.pixels.some(pixel => !Number.isInteger(pixel) || pixel < 0 || pixel > 3) ||
      !Array.isArray(repeat.pos) || repeat.pos.length !== 2 || repeat.pos.some(value => !Number.isInteger(value)) ||
      !Array.isArray(repeat.area) || repeat.area.length !== 2 || repeat.area.some(value => !Number.isInteger(value) || value <= 0)) {
      throw new TypeError("Invalid Pattern repeat.");
    }
  }
}

export function loadJSON(patternJSON, assetRegistry = null) {
  if (!patternJSON || typeof patternJSON !== "object") throw new TypeError("Invalid project JSON.");
  const replaceAssets = Object.hasOwn(patternJSON, "yarnLibrary");
  const staged = replaceAssets ? assetRegistry ?? yarnAssetRegistry.fork() : null;
  let action;
  try {
    const project = replaceAssets ? { ...patternJSON,
      yarnLibrary: migrateYarnLibraryAssets(patternJSON.yarnLibrary, staged) } : patternJSON;
    validatePattern(project);
    const { yarnSequence, yarnPalette, yarnPlies, repeats, width, height } = project;
    const chart = Bimp.empty(width, height, DEFAULT_STITCH_SYMBOL_INDEX);
    action = {
      ...yarnProjectFields(project),
      workspaceMode: "pattern",
      yarnPalette: Array.isArray(yarnPalette) && yarnPalette.length
        ? yarnPalette : [DEFAULT_YARN_COLOR],
      yarnPlies: cloneYarnPlies(yarnPlies),
      width, height,
      yarnSequence: normalizeYarnSequence(yarnSequence, { height: chart.height, fillYarn: 0 }),
      chart,
      repeats: repeats.map(({ bitmap, pos, area }) => ({ bitmap: Bimp.fromJSON(bitmap), pos, area })),
      editingRepeat: 0,
      selectedChartCell: null,
      selectedRepeatCell: null,
      ...(hasProjectAssets(project) ? { snapshots: [], lastSnapshot: 0 } : {}),
    };
    if (staged) staged.retain(action.yarnLibrary.flatMap(asset => getYarnPbrAssetRefs(asset.pbr)));
  } catch (error) {
    staged?.clear();
    throw error;
  }
  // Only validated state and binary sources cross the project boundary.
  projectLoadRequest++;
  if (hasProjectAssets(patternJSON)) cancelYarnPbrImports();
  if (staged) yarnAssetRegistry.replaceWith(staged);
  dispatch(action);
  fitChart();
  return true;
}

export async function loadProjectFile(file) {
  const request = ++projectLoadRequest;
  let staged = null;
  try {
    let project;
    if (/\.knitscape$/i.test(file.name) || file.type === "application/zip") {
      const opened = await readProjectPackage(file);
      project = opened.project; staged = opened.registry;
    } else {
      project = JSON.parse(await file.text());
      if (Object.hasOwn(project, "yarnLibrary")) staged = new YarnAssetRegistry();
    }
    if (request !== projectLoadRequest) { staged?.clear(); return false; }
    return loadJSON(project, staged);
  } catch (error) {
    staged?.clear();
    if (request !== projectLoadRequest) return false;
    throw error;
  }
}

export function newPattern() {
  projectLoadRequest++;
  const chart = Bimp.empty(30, 40, DEFAULT_STITCH_SYMBOL_INDEX);
  dispatch({
    yarnSequence: normalizeYarnSequence(undefined, { height: chart.height, fillYarn: 0 }),
    yarnPalette: [DEFAULT_YARN_COLOR],
    yarnPlies: cloneYarnPlies(),
    chart,
    repeats: [{ bitmap: Bimp.empty(4, 4, DEFAULT_STITCH_SYMBOL_INDEX), area: [30, 40], pos: [0, 0] }],
    editingRepeat: 0,
    selectedChartCell: null,
    selectedRepeatCell: null,
  });
  fitChart();
}

export function loadLibraryPattern(path) {
  dispatch({ showLibrary: false });
  GLOBAL_STATE.patternLibrary[path]().then((mod) => loadJSON(mod));
}

export function uploadFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".knitscape,.json,application/zip,application/json";
  input.style.display = "none";
  input.onchange = async event => {
    const file = event.target.files?.[0];
    try {
      if (file) await loadProjectFile(file);
    } catch (error) {
      window.alert(t("alerts.projectImportFailed", GLOBAL_STATE.language) + "\n" + error.message);
    } finally { input.remove(); }
  };
  input.oncancel = () => input.remove();
  document.body.appendChild(input);
  input.click();
}
