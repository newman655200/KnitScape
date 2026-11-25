/**
 * Compile resolved [feed][needle] machine actions into material-order topology.
 * Action/item ids are feed * m + needle; M has no item. Each K produces a loop
 * with passesThrough references { itemId, kind, p, q }; T produces a tuckArc.
 * p/q locate periodic images, with the preceding feed cycle at q = -1.
 * There are no coordinates, discretization counts, or material lengths here.
 */
export function compileKnitGraph({ operations, m, n }) {
  for (const [name, value] of [["m", m], ["n", n]]) {
    if (!Number.isInteger(value) || value < 1) {
      throw new RangeError(`${name} must be an integer >= 1.`);
    }
  }
  if (!Array.isArray(operations) || operations.length !== n ||
      operations.some(row => !Array.isArray(row) || row.length !== m)) {
    throw new TypeError("operations must contain n feeds of m needle actions.");
  }
  const yarns = [], actions = [], loops = [], tuckArcs = [];
  const loopsById = new Map();
  for (let feed = 0; feed < n; feed++) {
    const materialOrder = [];
    for (let needle = 0; needle < m; needle++) {
      const operation = operations[feed][needle];
      if (!["K", "T", "M"].includes(operation)) {
        throw new TypeError(`operations[${feed}][${needle}] must be K, T, or M.`);
      }
      const id = feed * m + needle;
      materialOrder.push(id);
      actions.push({ id, feed, needle, yarnId: feed, order: needle,
        operation, itemId: operation === "M" ? null : id });
      if (operation === "K") {
        const loop = { id, feed, needle, yarnId: feed, passesThrough: [] };
        loops.push(loop);
        loopsById.set(id, loop);
      } else if (operation === "T") {
        tuckArcs.push({ id, feed, needle, yarnId: feed });
      }
    }
    yarns.push({ yarnId: feed, feed, materialOrder });
  }
  for (let needle = 0; needle < m; needle++) {
    let lastKnit = n - 1;
    while (lastKnit >= 0 && operations[lastKnit][needle] !== "K") lastKnit--;
    let holding = [];
    // Seed from the last K of the preceding cycle, then apply the same rule
    // through this cycle. A needle without any K has no loop references.
    const start = lastKnit < 0 ? 0 : lastKnit - n;
    for (let course = start; course < n; course++) {
      const feed = (course + n) % n;
      const action = actions[feed * m + needle];
      const reference = { itemId: action.id,
        kind: action.operation === "K" ? "loop" : "tuckArc", p: 0, q: Math.floor(course / n) };
      if (action.operation === "K") {
        if (course >= 0) loopsById.get(action.id).passesThrough = holding;
        holding = [reference];
      } else if (action.operation === "T") {
        holding.push(reference);
      }
      // M leaves the held loop and accumulated tuck arcs unchanged.
    }
  }
  return { m, n, operations: operations.map(row => row.slice()), yarns, actions, loops, tuckArcs };
}
