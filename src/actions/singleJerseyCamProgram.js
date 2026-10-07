import { dispatch, GLOBAL_STATE } from "../state.js";
import { normalizeYarnLibrary } from "../domain/yarnLibrary.js";
import { validateYarnLengthInput } from "../domain/yarnLengthInput.js";
import { preflightYarnLengthBatch } from "../domain/yarnLengthBatch.js";
import { PREVIEW_VALIDITY } from "../simulation/previewValidity.js";

const DEFAULT_TRACK_COUNT = 4;
const DEFAULT_FEED_COUNT = 4;
const DEFAULT_OPERATION = "K";
const OPERATION_CYCLE = ["K", "T", "M"];
const DEFAULT_FEED_YARN = {
  yarnId: 0,
  yarnLengthCmPer100Needles: 0,
  tensionCN: null,
  placement: "parallel",
};

function validateDimension(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
}

function validateOperation(operation) {
  if (!OPERATION_CYCLE.includes(operation)) {
    throw new TypeError("operation must be K, T, or M.");
  }
}

function validateFeedYarnIndex(camProgram, feedIndex, yarnIndex) {
  if (
    !Number.isInteger(feedIndex) ||
    !Number.isInteger(yarnIndex) ||
    feedIndex < 0 ||
    yarnIndex < 0 ||
    feedIndex >= camProgram.feeds.length ||
    yarnIndex >= camProgram.feeds[feedIndex].yarns.length
  ) {
    throw new RangeError("feedIndex and yarnIndex must identify an existing Yarn.");
  }
}

function normalizeFeedYarn(yarn) {
  const rawYarnLength = yarn?.yarnLengthCmPer100Needles;
  const yarnLength = validateYarnLengthInput(rawYarnLength, { allowUnset: true });
  const tension = yarn?.tensionCN == null ? null : Number(yarn.tensionCN);

  if (yarn?.yarnId == null || yarn.yarnId === "") {
    throw new TypeError("yarnId is required.");
  }
  // Legacy unset values stay readable, but a missing project field was already invalid.
  if (rawYarnLength === undefined || !yarnLength.ok) {
    throw new TypeError("yarnLengthCmPer100Needles must be a non-negative number.");
  }
  if (tension !== null && (!Number.isFinite(tension) || tension < 0)) {
    throw new TypeError("tensionCN must be null or a non-negative number.");
  }

  return {
    yarnId: yarn.yarnId,
    yarnLengthCmPer100Needles: yarnLength.value,
    tensionCN: tension,
    placement: yarn.placement ?? "parallel",
  };
}

function normalizeFeed(feed) {
  if (!Array.isArray(feed?.yarns) || feed.yarns.length === 0) {
    return { yarns: [{ ...DEFAULT_FEED_YARN }] };
  }
  return { yarns: feed.yarns.map(normalizeFeedYarn) };
}

function currentCamProgram() {
  const camProgram = GLOBAL_STATE.singleJerseyCamProgram;
  if (camProgram === null) {
    throw new RangeError("singleJerseyCamProgram has not been created.");
  }
  return buildCamProgram(
    camProgram.tracks.length,
    camProgram.tracks[0]?.length ?? 0,
    camProgram
  );
}

function buildCamProgram(trackCount, feedCount, source = null) {
  validateDimension(trackCount, "tracks");
  validateDimension(feedCount, "feeds");

  return {
    tracks: Array.from({ length: trackCount }, (_, track) =>
      Array.from(
        { length: feedCount },
        (_, feed) => source?.tracks[track]?.[feed] ?? DEFAULT_OPERATION
      )
    ),
    feeds: Array.from({ length: feedCount }, (_, feed) =>
      normalizeFeed(source?.feeds?.[feed])
    ),
  };
}

export function normalizeSingleJerseyCamProgram(source) {
  if (source === null) return null;
  const tracks = source?.tracks;
  if (!Array.isArray(tracks) || !tracks.length || !Array.isArray(tracks[0]) || !tracks[0].length) {
    throw new TypeError("camProgram.tracks must be a non-empty rectangular array.");
  }
  tracks.forEach(track => {
    if (!Array.isArray(track) || track.length !== tracks[0].length) {
      throw new TypeError("camProgram.tracks must be rectangular.");
    }
    track.forEach(validateOperation);
  });
  return buildCamProgram(tracks.length, tracks[0].length, source);
}

export function createSingleJerseyCamProgram(
  trackCount = DEFAULT_TRACK_COUNT,
  feedCount = DEFAULT_FEED_COUNT
) {
  const singleJerseyCamProgram = buildCamProgram(trackCount, feedCount);
  dispatch({ singleJerseyCamProgram,
    yarnLibrary: normalizeYarnLibrary(GLOBAL_STATE.yarnLibrary, singleJerseyCamProgram.feeds) },
    { replaceFeedYarnStructure: true });
}

export function resizeSingleJerseyCamProgram(trackCount, feedCount) {
  const singleJerseyCamProgram = buildCamProgram(
    trackCount,
    feedCount,
    currentCamProgram()
  );
  dispatch({ singleJerseyCamProgram,
    yarnLibrary: normalizeYarnLibrary(GLOBAL_STATE.yarnLibrary, singleJerseyCamProgram.feeds) });
}

export function setSingleJerseyCamOperation(
  trackIndex,
  feedIndex,
  operation
) {
  validateOperation(operation);
  const camProgram = currentCamProgram();
  const feedCount = camProgram.tracks[0]?.length ?? 0;

  if (
    !Number.isInteger(trackIndex) ||
    !Number.isInteger(feedIndex) ||
    trackIndex < 0 ||
    feedIndex < 0 ||
    trackIndex >= camProgram.tracks.length ||
    feedIndex >= feedCount
  ) {
    throw new RangeError("trackIndex and feedIndex must identify an existing cell.");
  }

  const tracks = camProgram.tracks.map((track, index) =>
    index === trackIndex
      ? track.map((cell, feed) => (feed === feedIndex ? operation : cell))
      : [...track]
  );
  dispatch({ singleJerseyCamProgram: { ...camProgram, tracks } });
}

export function setSingleJerseyFeedYarns(feedIndex, yarns) {
  const camProgram = currentCamProgram();
  if (
    !Number.isInteger(feedIndex) ||
    feedIndex < 0 ||
    feedIndex >= camProgram.feeds.length
  ) {
    throw new RangeError("feedIndex must identify an existing Feed.");
  }
  if (!Array.isArray(yarns) || yarns.length === 0) {
    throw new RangeError("yarns must contain at least one Yarn.");
  }

  const feeds = camProgram.feeds.map((feed, index) =>
    index === feedIndex
      ? { yarns: yarns.map(normalizeFeedYarn) }
      : { yarns: feed.yarns.map((yarn) => ({ ...yarn })) }
  );
  dispatch({ singleJerseyCamProgram: { ...camProgram, feeds },
    yarnLibrary: normalizeYarnLibrary(GLOBAL_STATE.yarnLibrary, feeds) },
    { replaceFeedYarnStructure: true });
}

export function getSingleJerseyFeedIndices(
  scope,
  feedCount,
  selectedFeedIndices = []
) {
  validateDimension(feedCount, "feeds");
  if (!["all", "odd", "even", "selected"].includes(scope)) {
    throw new TypeError("scope must be all, odd, even, or selected.");
  }
  const selected = new Set(selectedFeedIndices);
  return Array.from({ length: feedCount }, (_, index) => index).filter((index) =>
    scope === "all" ||
    (scope === "odd" && index % 2 === 0) ||
    (scope === "even" && index % 2 === 1) ||
    (scope === "selected" && selected.has(index))
  );
}

function commitFeedYarnLength(feedIndex, yarnIndex, validation) {
  const camProgram = currentCamProgram();
  validateFeedYarnIndex(camProgram, feedIndex, yarnIndex);
  const previousValue = camProgram.feeds[feedIndex].yarns[yarnIndex].yarnLengthCmPer100Needles;
  if (!validation.ok) return { ...validation, previousValue };
  const yarnLengthCmPer100Needles = validation.value;
  const feeds = camProgram.feeds.map((feed, currentFeedIndex) => ({
    yarns: feed.yarns.map((yarn, currentYarnIndex) => ({
      ...yarn,
      yarnLengthCmPer100Needles:
        currentFeedIndex === feedIndex && currentYarnIndex === yarnIndex
          ? yarnLengthCmPer100Needles
          : yarn.yarnLengthCmPer100Needles,
    })),
  }));
  dispatch({ singleJerseyCamProgram: { ...camProgram, feeds } });
  return { ...validation, previousValue };
}

export function setSingleJerseyFeedYarnLength(feedIndex, yarnIndex, value) {
  return commitFeedYarnLength(feedIndex, yarnIndex, validateYarnLengthInput(value));
}

export function clearSingleJerseyFeedYarnLength(feedIndex, yarnIndex) {
  return commitFeedYarnLength(feedIndex, yarnIndex, validateYarnLengthInput(0, { allowUnset: true }));
}

export function setSingleJerseyFeedYarnLengths(selection, value) {
  const camProgram = GLOBAL_STATE.singleJerseyCamProgram;
  const preflight = preflightYarnLengthBatch(camProgram, selection, value, GLOBAL_STATE.feedYarnStructureRevision);
  if (!preflight.ok) return preflight;
  const selected = new Map();
  preflight.targets.forEach(({ feedIndex, yarnIndex }) => {
    if (!selected.has(feedIndex)) selected.set(feedIndex, new Set());
    selected.get(feedIndex).add(yarnIndex);
  });
  const feeds = camProgram.feeds.map((feed, feedIndex) => !selected.has(feedIndex) ? feed : {
    ...feed,
    yarns: feed.yarns.map((yarn, yarnIndex) => !selected.get(feedIndex).has(yarnIndex) ? yarn : {
      ...yarn, yarnLengthCmPer100Needles: preflight.value,
    }),
  });
  // Clear derived validation in the same commit, including consumers before runner.
  dispatch({ singleJerseyCamProgram: { ...camProgram, feeds }, yarnLengthSolverResults: [],
    previewValidity: PREVIEW_VALIDITY.DESIGN_PREVIEW });
  return { ok: true, operation: "SET", value: preflight.value, updatedCount: preflight.targets.length };
}

export function cycleSingleJerseyCamOperation(trackIndex, feedIndex) {
  const camProgram = currentCamProgram();
  const operation = camProgram.tracks[trackIndex]?.[feedIndex];
  validateOperation(operation);
  const nextOperation =
    OPERATION_CYCLE[
      (OPERATION_CYCLE.indexOf(operation) + 1) % OPERATION_CYCLE.length
    ];
  setSingleJerseyCamOperation(trackIndex, feedIndex, nextOperation);
}

export function deleteSingleJerseyCamProgram() {
  dispatch({ singleJerseyCamProgram: null });
}
