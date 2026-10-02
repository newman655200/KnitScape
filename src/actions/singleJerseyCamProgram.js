import { dispatch, GLOBAL_STATE } from "../state.js";

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

function normalizeFeedYarn(yarn) {
  const yarnLength = Number(yarn?.yarnLengthCmPer100Needles);
  const tension = yarn?.tensionCN == null ? null : Number(yarn.tensionCN);

  if (yarn?.yarnId == null || yarn.yarnId === "") {
    throw new TypeError("yarnId is required.");
  }
  if (!Number.isFinite(yarnLength) || yarnLength < 0) {
    throw new TypeError("yarnLengthCmPer100Needles must be a non-negative number.");
  }
  if (tension !== null && (!Number.isFinite(tension) || tension < 0)) {
    throw new TypeError("tensionCN must be null or a non-negative number.");
  }

  return {
    yarnId: yarn.yarnId,
    yarnLengthCmPer100Needles: yarnLength,
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

export function createSingleJerseyCamProgram(
  trackCount = DEFAULT_TRACK_COUNT,
  feedCount = DEFAULT_FEED_COUNT
) {
  const singleJerseyCamProgram = buildCamProgram(trackCount, feedCount);
  dispatch({ singleJerseyCamProgram });
}

export function resizeSingleJerseyCamProgram(trackCount, feedCount) {
  const singleJerseyCamProgram = buildCamProgram(
    trackCount,
    feedCount,
    currentCamProgram()
  );
  dispatch({ singleJerseyCamProgram });
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
  dispatch({ singleJerseyCamProgram: { ...camProgram, feeds } });
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
