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
import { cloneBitmap } from "../needleArrangement/transform.js";
import {
  DEFAULT_NEEDLE_INPUTS,
  deserializePattern,
} from "../patternFile.js";

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

export function loadJSON(patternJSON) {
  const pattern = deserializePattern(patternJSON);

  dispatch({
    camBitmap: pattern.camBitmap,
    needleBitmap: pattern.needleBitmap,
    needleInputs: pattern.needleInputs,
    appliedNeedleInputs: pattern.appliedNeedleInputs,
    needleInputErrors: [null, null, null, null],
    yarnPalette: Array.isArray(pattern.yarnPalette) && pattern.yarnPalette.length
      ? pattern.yarnPalette
      : [DEFAULT_YARN_COLOR],
    yarnPlies: cloneYarnPlies(pattern.yarnPlies),
    yarnSequence: normalizeYarnSequence(pattern.yarnSequence, {
      height: pattern.needleBitmap.height,
      fillYarn: 0,
    }),
  });

  fitChart();
}

export function newPattern() {
  const camBitmap = Bimp.empty(30, 40, DEFAULT_STITCH_SYMBOL_INDEX);
  const needleBitmap = cloneBitmap(camBitmap);

  dispatch({
    yarnSequence: normalizeYarnSequence(undefined, {
      height: needleBitmap.height,
      fillYarn: 0,
    }),
    yarnPalette: [DEFAULT_YARN_COLOR],
    yarnPlies: cloneYarnPlies(),
    camBitmap,
    needleBitmap,
    needleInputs: [...DEFAULT_NEEDLE_INPUTS],
    appliedNeedleInputs: [...DEFAULT_NEEDLE_INPUTS],
    needleInputErrors: [null, null, null, null],
  });
  fitChart();
}

export function loadLibraryPattern(path) {
  dispatch({ showLibrary: false });
  GLOBAL_STATE.patternLibrary[path]().then((mod) => loadJSON(mod.default || mod));
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
