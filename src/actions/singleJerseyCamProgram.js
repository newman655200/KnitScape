import { dispatch, GLOBAL_STATE } from "../state.js";

const DEFAULT_TRACK_COUNT = 4;
const DEFAULT_FEED_COUNT = 4;
const DEFAULT_OPERATION = "K";
const OPERATION_CYCLE = ["K", "T", "M"];

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

function currentCamProgram() {
  const camProgram = GLOBAL_STATE.singleJerseyCamProgram;
  if (camProgram === null) {
    throw new RangeError("singleJerseyCamProgram has not been created.");
  }
  return camProgram;
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
  dispatch({ singleJerseyCamProgram: { tracks } });
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
