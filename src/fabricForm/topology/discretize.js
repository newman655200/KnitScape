import { stockinetteSabetta } from "./stitchTemplates.js";

function unsupported(message) {
  const error = new Error(`UNSUPPORTED_IN_STEP1: ${message}`);
  error.code = "UNSUPPORTED_IN_STEP1";
  throw error;
}

/**
 * Embed an all-K, single-yarn-per-feed graph in the legacy topology shape.
 * feedMetadata only preserves the existing Cam feed-yarn rejection; it does
 * not interpret machine actions or supply additional yarn geometry.
 */
export function discretizeKnitGraph(graph, { nodesPerLoop = 48, loopLengthMm = 3,
  template = stockinetteSabetta, feedMetadata } = {}) {
  if (!Number.isInteger(nodesPerLoop) || nodesPerLoop < 3) {
    throw new RangeError("nodesPerLoop must be an integer >= 3.");
  }
  if (!Number.isFinite(loopLengthMm) || loopLengthMm <= 0) {
    throw new RangeError("loopLengthMm must be positive and finite.");
  }
  const { m, n, operations } = graph;
  for (let feed = 0; feed < n; feed++) {
    for (let needle = 0; needle < m; needle++) {
      if (operations[feed][needle] !== "K") {
        unsupported(`${operations[feed][needle]} at feed ${feed}, needle ${needle}.`);
      }
    }
  }
  if (feedMetadata?.some(feed => feed?.yarns?.length > 1) ||
      new Set(graph.yarns.map(yarn => yarn.feed)).size !== graph.yarns.length) {
    unsupported("multiple yarns per feed.");
  }
  const rowNodes = m * nodesPerLoop;
  const nodeCount = rowNodes * n;
  const restLength = loopLengthMm / nodesPerLoop;
  const graphLoops = new Map(graph.loops.map(loop => [loop.id, loop]));
  const yarns = [], edges = [], bends = [], loops = [];
  for (const { yarnId, feed } of graph.yarns) {
    const rowStart = feed * rowNodes;
    const nodeIndices = Array.from({ length: rowNodes }, (_, order) => rowStart + order);
    yarns.push({ id: yarnId, feed, nodeIndices, edgeIndices: nodeIndices.slice(),
      materialLength: m * loopLengthMm });
    for (let order = 0; order < rowNodes; order++) {
      const node = rowStart + order;
      edges.push({ id: node, from: node, to: rowStart + (order + 1) % rowNodes,
        p: order === rowNodes - 1 ? 1 : 0, q: 0, yarnId, order,
        restLength, materialStart: order * restLength });
      bends.push({ node, prevEdge: rowStart + (order + rowNodes - 1) % rowNodes, nextEdge: node });
    }
    for (let needle = 0; needle < m; needle++) {
      const graphLoop = graphLoops.get(feed * m + needle);
      const reference = graphLoop.passesThrough[0];
      const loopNodes = nodeIndices.slice(needle * nodesPerLoop, (needle + 1) * nodesPerLoop);
      const crossings = template.crossings.map(({ over, orientation, targetNeedleOffset }) => {
        const targetNeedle = needle + targetNeedleOffset;
        const targetLoop = graphLoops.get(feed * m + ((targetNeedle % m) + m) % m);
        const target = targetLoop.passesThrough[0];
        return { loopId: target.itemId, p: target.p + Math.floor(targetNeedle / m),
          q: target.q, over, orientation };
      });
      loops.push({ id: graphLoop.id, feed, needle, yarnId,
        nodeIndices: loopNodes, edgeIndices: loopNodes.slice(),
        passesThrough: { loopId: reference.itemId, p: reference.p, q: reference.q, crossings } });
    }
  }
  return { m, n, nodesPerLoop, loopLengthMm, nodeCount, operations, yarns, edges, bends, loops,
    crossingConvention: { ...template.crossingConvention } };
}
