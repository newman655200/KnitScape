import assert from "node:assert/strict";
import { defaultMemorySize } from "../../src/fabricForm/solveFabricCell.js";

export function resolveCloseoutMemorySize(input, checkpoint = {}) {
  const memorySize = input.memorySize === undefined ? defaultMemorySize(input.topology.nodesPerLoop) : input.memorySize;
  assert.ok(Number.isInteger(memorySize) && memorySize > 0, "memorySize must be a positive integer");
  for (const recorded of [checkpoint.memorySize, checkpoint.settings?.memorySize]) {
    if (recorded !== undefined) assert.equal(memorySize, recorded, "memorySize disagrees with checkpoint");
  }
  return memorySize;
}
