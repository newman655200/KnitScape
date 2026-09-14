/** @typedef {"K" | "T" | "M"} MachineOperation */
/** @typedef {{ tracks: MachineOperation[][] }} SingleJerseyCamProgram */

const MACHINE_OPERATIONS = new Set(["K", "T", "M"]);

function validateCamProgram(camProgram) {
  if (!camProgram || !Array.isArray(camProgram.tracks)) {
    throw new TypeError("camProgram.tracks must be an array.");
  }
  if (camProgram.tracks.length === 0) {
    throw new RangeError("camProgram.tracks must contain at least one track.");
  }

  const feedCount = camProgram.tracks[0]?.length;
  if (!Number.isInteger(feedCount) || feedCount < 1) {
    throw new RangeError(
      "camProgram.tracks[0] must contain at least one feed."
    );
  }

  camProgram.tracks.forEach((track, trackIndex) => {
    if (!Array.isArray(track) || track.length !== feedCount) {
      throw new TypeError(
        `camProgram.tracks[${trackIndex}] must contain ${feedCount} feeds.`
      );
    }
    track.forEach((operation, feedIndex) => {
      if (!MACHINE_OPERATIONS.has(operation)) {
        throw new TypeError(
          `camProgram.tracks[${trackIndex}][${feedIndex}] must be K, T, or M.`
        );
      }
    });
  });

  return feedCount;
}

function validateNeedleArrangement(needleArrangement, trackCount) {
  if (!Array.isArray(needleArrangement) || needleArrangement.length === 0) {
    throw new RangeError("needleArrangement must contain at least one type.");
  }

  for (const needleType of needleArrangement) {
    if (!Number.isInteger(needleType) || needleType <= 0) {
      throw new TypeError(
        "needleArrangement must contain only positive integer types."
      );
    }
    if (needleType > trackCount) {
      throw new RangeError(
        `Needle Type ${needleType} exceeds camProgram.tracks length ${trackCount}.`
      );
    }
  }
}

function validateOutputDimension(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
}

/**
 * @param {SingleJerseyCamProgram} camProgram
 * @param {number[]} needleArrangement
 * @param {number} width
 * @param {number} feeds
 * @returns {MachineOperation[][]}
 */
export function resolveSingleJerseyOperations(
  camProgram,
  needleArrangement,
  width,
  feeds
) {
  const camFeedCount = validateCamProgram(camProgram);
  validateNeedleArrangement(needleArrangement, camProgram.tracks.length);
  validateOutputDimension(width, "width");
  validateOutputDimension(feeds, "feeds");

  return Array.from({ length: feeds }, (_, feed) =>
    Array.from({ length: width }, (_, position) => {
      const needleType =
        needleArrangement[position % needleArrangement.length];
      return camProgram.tracks[needleType - 1][feed % camFeedCount];
    })
  );
}
