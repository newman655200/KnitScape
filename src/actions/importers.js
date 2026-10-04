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

function yarnProjectFields(project) {
  // Legacy Pattern-only imports retain the current Machine and Yarn Library.
  const hasCam = Object.hasOwn(project, "singleJerseyCamProgram");
  if (!hasCam && !Object.hasOwn(project, "yarnLibrary")) return {};
  const cam = hasCam ? normalizeSingleJerseyCamProgram(project.singleJerseyCamProgram)
    : GLOBAL_STATE.singleJerseyCamProgram;
  const fields = { yarnLibrary: normalizeYarnLibrary(
    project.yarnLibrary ?? GLOBAL_STATE.yarnLibrary, cam?.feeds), pendingYarnId: null, yarnLibraryError: null };
  if (hasCam) {
    fields.singleJerseyCamProgram = cam;
    for (const key of ["needleArrangement", "needleArrangementInputs", "machineGauge"]) {
      if (Object.hasOwn(project, key)) fields[key] = structuredClone(project[key]);
    }
    const arrangement = fields.needleArrangement ?? GLOBAL_STATE.needleArrangement;
    if (cam && arrangement.length) resolveSingleJerseyOperations(cam, arrangement, 1, 1);
  }
  return fields;
}

export function loadJSON(patternJSON) {
  let { yarnSequence, yarnPalette, yarnPlies, repeats, width, height } =
    patternJSON;
  const chart = Bimp.empty(width, height, DEFAULT_STITCH_SYMBOL_INDEX);

  dispatch({
    ...yarnProjectFields(patternJSON),
    workspaceMode: "pattern",
    yarnPalette: Array.isArray(yarnPalette) && yarnPalette.length
      ? yarnPalette
      : [DEFAULT_YARN_COLOR],
    yarnPlies: cloneYarnPlies(yarnPlies),
    width,
    height,
    yarnSequence: normalizeYarnSequence(yarnSequence, {
      height: chart.height,
      fillYarn: 0,
    }),
    chart,
    repeats: repeats.map(({ bitmap, pos, area }) => {
      return {
        bitmap: Bimp.fromJSON(bitmap),
        pos,
        area,
      };
    }),
    editingRepeat: 0,
    selectedChartCell: null,
    selectedRepeatCell: null,
  });

  fitChart();
}

export function newPattern() {
  const chart = Bimp.empty(30, 40, DEFAULT_STITCH_SYMBOL_INDEX);

  dispatch({
    yarnSequence: normalizeYarnSequence(undefined, {
      height: chart.height,
      fillYarn: 0,
    }),
    yarnPalette: [DEFAULT_YARN_COLOR],
    yarnPlies: cloneYarnPlies(),
    chart,
    repeats: [
      {
        bitmap: Bimp.empty(4, 4, DEFAULT_STITCH_SYMBOL_INDEX),
        area: [30, 40],
        pos: [0, 0],
      },
    ],
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
  let fileInputElement = document.createElement("input");

  fileInputElement.setAttribute("type", "file");
  fileInputElement.style.display = "none";

  document.body.appendChild(fileInputElement);
  fileInputElement.click();
  fileInputElement.onchange = (e) => {
    let file = e.target.files[0];
    const fileReader = new FileReader();
    fileReader.readAsText(file);
    fileReader.onload = () => {
      loadJSON(JSON.parse(fileReader.result));
    };
  };
  document.body.removeChild(fileInputElement);
}
