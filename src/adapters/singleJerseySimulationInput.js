import { Bimp } from "../lib/Bimp.js";

const OPERATION_PIXELS = new Map([
  ["K", 0],
  ["M", 2],
  ["T", 3],
]);

export function createSingleJerseySimulationInput(machineOperations) {
  if (!Array.isArray(machineOperations)) {
    throw new TypeError("machineOperations must be an array.");
  }
  if (machineOperations.length === 0) {
    throw new RangeError("machineOperations must contain at least one feed.");
  }

  const width = machineOperations[0]?.length;
  if (!Number.isInteger(width) || width <= 0) {
    throw new RangeError(
      "machineOperations[0] must contain at least one position."
    );
  }

  const pixels = [];
  machineOperations.forEach((feedOperations, feed) => {
    if (!Array.isArray(feedOperations) || feedOperations.length !== width) {
      throw new TypeError(
        `machineOperations[${feed}] must contain ${width} positions.`
      );
    }

    feedOperations.forEach((operation, position) => {
      if (!OPERATION_PIXELS.has(operation)) {
        throw new TypeError(
          `machineOperations[${feed}][${position}] must be K, T, or M.`
        );
      }
      pixels.push(OPERATION_PIXELS.get(operation));
    });
  });

  return new Bimp(width, machineOperations.length, pixels);
}
