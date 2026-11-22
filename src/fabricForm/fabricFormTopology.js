import { resolveSingleJerseyOperations } from "../domain/singleJerseyMachine.js";

function positiveInteger(value, name, minimum = 1) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be an integer >= ${minimum}.`);
  }
}

/** Adapt resolved machine actions; do not interpret Cam/Needle rules here. */
export function createPlainJerseyTopology({ m = 1, n = 1, nodesPerLoop = 32,
  loopLengthMm = 3, camProgram = { tracks: [["K"]] }, needleArrangement = [1] } = {}) {
  positiveInteger(m, "m");
  positiveInteger(n, "n");
  positiveInteger(nodesPerLoop, "nodesPerLoop", 3);
  if (!Number.isFinite(loopLengthMm) || loopLengthMm <= 0) {
    throw new RangeError("loopLengthMm must be positive and finite.");
  }
  const operations = resolveSingleJerseyOperations(camProgram, needleArrangement, m, n);
  for (let feed = 0; feed < n; feed++) {
    for (let needle = 0; needle < m; needle++) {
      if (operations[feed][needle] !== "K") {
        const error = new Error(`UNSUPPORTED_IN_STEP1: ${operations[feed][needle]} at feed ${feed}, needle ${needle}.`);
        error.code = "UNSUPPORTED_IN_STEP1";
        throw error;
      }
    }
  }
  if (camProgram.feeds?.some(feed => feed?.yarns?.length > 1)) {
    const error = new Error("UNSUPPORTED_IN_STEP1: multiple yarns per feed.");
    error.code = "UNSUPPORTED_IN_STEP1";
    throw error;
  }
  const rowNodes = m * nodesPerLoop;
  const nodeCount = rowNodes * n;
  const restLength = loopLengthMm / nodesPerLoop;
  const yarns = [], edges = [], bends = [], loops = [];
  for (let feed = 0; feed < n; feed++) {
    const rowStart = feed * rowNodes;
    const nodeIndices = Array.from({ length: rowNodes }, (_, order) => rowStart + order);
    yarns.push({ id: feed, feed, nodeIndices, edgeIndices: nodeIndices.slice(),
      materialLength: m * loopLengthMm });
    for (let order = 0; order < rowNodes; order++) {
      const node = rowStart + order;
      edges.push({ id: node, from: node, to: rowStart + (order + 1) % rowNodes,
        p: order === rowNodes - 1 ? 1 : 0, q: 0, yarnId: feed, order,
        restLength, materialStart: order * restLength });
      bends.push({ node, prevEdge: rowStart + (order + rowNodes - 1) % rowNodes, nextEdge: node });
    }
    for (let needle = 0; needle < m; needle++) {
      const loopNodes = nodeIndices.slice(needle * nodesPerLoop, (needle + 1) * nodesPerLoop);
      const previousFeed = (feed + n - 1) % n;
      const q = feed === 0 ? -1 : 0;
      // Actual directed XY crossing word of the published stockinette seed.
      // The fourth crossing belongs to the next needle's material interval:
      // the loop boundary lies on a sinker arc, not at a closed-loop seam.
      const crossings = [-1, -1, 1, 1].map((over, index) => {
        const targetNeedle = needle + (index === 3 ? 1 : 0);
        return { loopId: previousFeed * m + targetNeedle % m,
          p: Math.floor(targetNeedle / m), q, over, orientation: index % 2 === 0 ? -1 : 1 };
      });
      loops.push({ id: feed * m + needle, feed, needle, yarnId: feed,
        nodeIndices: loopNodes, edgeIndices: loopNodes.slice(),
        passesThrough: { loopId: previousFeed * m + needle, p: 0, q, crossings } });
    }
  }
  return { m, n, nodesPerLoop, loopLengthMm, nodeCount, operations, yarns, edges, bends, loops,
    crossingConvention: {
      projection: "XY", normal: "+Z", order: "increasing-material-order",
      over: "sign(z_self - z_target)",
      orientation: "sign((t_self cross t_target).z); both tangents follow increasing material order",
      source: "sabetta/stitch-by-stitch@0ed27f35dcf5c3bda874f214bbcab0455055edf0 stockinette initial geometry",
      scope: "Seed embedding signature, not a complete topological invariant of deformed curves",
    } };
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
