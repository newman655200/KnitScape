/**
 * T1 state vector: node-major XYZ positions, followed by lattice components W/H/S.
 * Positions are indexed by their flattened scalar component number; lattice
 * components are indexed by name. No physical units or numerical scaling change.
 *
 * The periodic gradient/contact kernels still assume a final three-value lattice
 * block. Migrate those kernels before adding any further degree-of-freedom block.
 */
export function createDofLayout(cell) {
  const coordinatesPerNode = 3;
  const nodeCount = cell.positions.length;
  const positions = Object.freeze({ name: "positions", offset: 0, length: coordinatesPerNode * nodeCount });
  const lattice = Object.freeze({ name: "lattice", offset: positions.length, length: 3,
    components: Object.freeze(["W", "H", "S"]) });
  const blocks = Object.freeze([positions, lattice]);
  const size = blocks.reduce((total, block) => total + block.length, 0);
  if (blocks.length !== 2 || blocks.at(-1) !== lattice || positions.offset !== 0 ||
      lattice.offset !== positions.offset + positions.length || lattice.offset + lattice.length !== size ||
      lattice.length !== 3 || lattice.components.join(",") !== "W,H,S") {
    throw new Error("Periodic kernels require the final W/H/S lattice block immediately after positions");
  }

  /** Resolve a flattened position component or a named W/H/S component. */
  function index(blockName, component) {
    const block = blocks.find(item => item.name === blockName);
    if (!block) throw new RangeError(`Unknown degree-of-freedom block: ${blockName}`);
    const relative = block.components ? block.components.indexOf(component) : component;
    if (!Number.isInteger(relative) || relative < 0 || relative >= block.length) {
      throw new RangeError(`Unknown ${blockName} component: ${component}`);
    }
    return block.offset + relative;
  }

  return Object.freeze({ size, blocks, index,
    pack(state) {
      return Float64Array.from([...state.positions.flat(), ...lattice.components.map(component => state[component])]);
    },
    unpack(values, template) {
      return { ...template,
        positions: Array.from({ length: nodeCount }, (_, i) =>
          Array.from(values.slice(coordinatesPerNode * i, coordinatesPerNode * i + coordinatesPerNode))),
        W: values[index("lattice", "W")], H: values[index("lattice", "H")], S: values[index("lattice", "S")] };
    },
    /** Keep ascending vector order; translation is fixed by excluding the first node. */
    freeIndices({ fixTranslation = true, locked = [] } = {}) {
      const lockedIndices = new Set(locked.map(component => index("lattice", component)));
      const firstFree = fixTranslation ? coordinatesPerNode : positions.offset;
      return Array.from({ length: size - firstFree }, (_, i) => i + firstFree)
        .filter(i => !lockedIndices.has(i));
    },
  });
}
