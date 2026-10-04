import { dispatch, GLOBAL_STATE } from "../state.js";
import { createYarnAsset, isYarnReferenced } from "../domain/yarnLibrary.js";
import { normalizeSingleJerseyCamProgram, setSingleJerseyFeedYarns } from "./singleJerseyCamProgram.js";
import { importPbrFiles } from "../yarnTexture/yarnScanTexture.js";

const pbrImports = new Map();

function assetById(id) {
  const asset = GLOBAL_STATE.yarnLibrary.find(yarn => String(yarn.id) === String(id));
  if (!asset) throw new RangeError("Yarn Asset does not exist.");
  return asset;
}

export function addYarnAsset(name, category) {
  const prefix = `yarn-${Date.now()}`;
  let id = prefix;
  for (let suffix = 1; GLOBAL_STATE.yarnLibrary.some(yarn => yarn.id === id); suffix++) {
    id = `${prefix}-${suffix}`;
  }
  const asset = createYarnAsset(id, name, category);
  dispatch({ yarnLibrary: [...GLOBAL_STATE.yarnLibrary, asset] });
  return id;
}

export function updateYarnAsset(id, name, category) {
  const current = assetById(id);
  const asset = { ...current, ...createYarnAsset(current.id, name, category), createdAt: current.createdAt };
  dispatch({ yarnLibrary: GLOBAL_STATE.yarnLibrary.map(yarn => yarn.id === current.id ? asset : yarn) });
}

export function deleteYarnAsset(id) {
  const asset = assetById(id);
  const feeds = GLOBAL_STATE.singleJerseyCamProgram === null ? []
    : normalizeSingleJerseyCamProgram(GLOBAL_STATE.singleJerseyCamProgram).feeds;
  if (isYarnReferenced(asset.id, feeds)) return false;
  pbrImports.delete(asset.id);
  dispatch({ yarnLibrary: GLOBAL_STATE.yarnLibrary.filter(yarn => yarn.id !== asset.id),
    ...(String(GLOBAL_STATE.pendingYarnId) === String(asset.id) ? { pendingYarnId: null } : {}) });
  return true;
}

export function getYarnPbr(id) {
  return GLOBAL_STATE.yarnLibrary.find(yarn => String(yarn.id) === String(id))?.pbr ?? null;
}

export async function importYarnPbr(id, files) {
  const asset = assetById(id);
  const request = {};
  pbrImports.set(asset.id, request);
  try {
    const pbr = await importPbrFiles(files);
    if (pbrImports.get(asset.id) !== request ||
      !GLOBAL_STATE.yarnLibrary.some(yarn => yarn.id === asset.id)) return false;
    dispatch({ yarnLibrary: GLOBAL_STATE.yarnLibrary.map(yarn => yarn.id === asset.id
      ? { ...yarn, pbr, updatedAt: new Date().toISOString() } : yarn), yarnLibraryError: null });
    return true;
  } finally {
    if (pbrImports.get(asset.id) === request) pbrImports.delete(asset.id);
  }
}

export function clearYarnPbr(id) {
  const asset = assetById(id);
  pbrImports.delete(asset.id);
  const { pbr, ...metadata } = asset;
  dispatch({ yarnLibrary: GLOBAL_STATE.yarnLibrary.map(yarn => yarn.id === asset.id
    ? { ...metadata, updatedAt: new Date().toISOString() } : yarn), yarnLibraryError: null });
}

export function selectYarnForAssignment(id) {
  dispatch({ pendingYarnId: assetById(id).id });
}

function feedYarns(feedIndex) {
  const cam = GLOBAL_STATE.singleJerseyCamProgram;
  if (!Number.isInteger(feedIndex) || feedIndex < 0 || !cam || feedIndex >= cam.tracks[0].length) {
    throw new RangeError("feedIndex must identify an existing Feed.");
  }
  return normalizeSingleJerseyCamProgram(cam).feeds[feedIndex].yarns;
}

export function assignYarnToFeed(feedIndex, yarnIndex, id = GLOBAL_STATE.pendingYarnId) {
  const asset = assetById(id);
  const yarns = feedYarns(feedIndex);
  if (!Number.isInteger(yarnIndex) || yarnIndex < 0 || yarnIndex > yarns.length) {
    throw new RangeError("yarnIndex must identify a slot or the next new slot.");
  }
  const next = yarns.map(yarn => ({ ...yarn }));
  next[yarnIndex] = { ...(next[yarnIndex] ?? {
    yarnLengthCmPer100Needles: 0, tensionCN: null, placement: "parallel",
  }), yarnId: asset.id };
  setSingleJerseyFeedYarns(feedIndex, next);
}

export function removeFeedYarnSlot(feedIndex, yarnIndex) {
  const yarns = feedYarns(feedIndex);
  if (yarns.length <= 1 || !Number.isInteger(yarnIndex) || yarnIndex < 0 || yarnIndex >= yarns.length) {
    throw new RangeError("Keep at least one Yarn slot per Feed.");
  }
  setSingleJerseyFeedYarns(feedIndex, yarns.filter((_, index) => index !== yarnIndex));
}
