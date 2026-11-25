import { resolveSingleJerseyOperations } from "../domain/singleJerseyMachine.js";
import { compileKnitGraph } from "./topology/knitGraph.js";
import { discretizeKnitGraph } from "./topology/discretize.js";
import { stockinetteSabetta } from "./topology/stitchTemplates.js";

function positiveInteger(value, name, minimum = 1) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be an integer >= ${minimum}.`);
  }
}

/** Adapt resolved machine actions; do not interpret Cam/Needle rules here.
 * Production defaults to N48; N32 is preview only (density error can exceed 0.5%). */
export function createPlainJerseyTopology({ m = 1, n = 1, nodesPerLoop = 48,
  loopLengthMm = 3, camProgram = { tracks: [["K"]] }, needleArrangement = [1] } = {}) {
  positiveInteger(m, "m");
  positiveInteger(n, "n");
  positiveInteger(nodesPerLoop, "nodesPerLoop", 3);
  if (!Number.isFinite(loopLengthMm) || loopLengthMm <= 0) {
    throw new RangeError("loopLengthMm must be positive and finite.");
  }
  const operations = resolveSingleJerseyOperations(camProgram, needleArrangement, m, n);
  const graph = compileKnitGraph({ operations, m, n });
  return discretizeKnitGraph(graph, { nodesPerLoop, loopLengthMm,
    template: stockinetteSabetta, feedMetadata: camProgram.feeds });
}

/** q != 0 identifies another unfolded yarn, even when its local yarnId matches. */
export function unfoldedMaterialGap(topology, edgeA, edgeB, p = 0, q = 0) {
  if (!Number.isInteger(p) || !Number.isInteger(q)) {
    throw new TypeError("Periodic offsets p and q must be integers.");
  }
  if (edgeA.yarnId !== edgeB.yarnId || q !== 0) return Infinity;
  const yarn = topology.yarns.find(item => item.id === edgeA.yarnId);
  if (!yarn) throw new RangeError("Unknown yarnId in material gap.");
  const a = edgeA.materialStart;
  const b = edgeB.materialStart + p * yarn.materialLength;
  return Math.max(0, b - a - edgeA.restLength, a - b - edgeB.restLength);
}

export function isLocalMaterialPair(topology, edgeA, edgeB, p, q, exclusionLength) {
  if (!Number.isFinite(exclusionLength) || exclusionLength <= 0) {
    throw new RangeError("exclusionLength must be positive and finite.");
  }
  return unfoldedMaterialGap(topology, edgeA, edgeB, p, q) < exclusionLength;
}
