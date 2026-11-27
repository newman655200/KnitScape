/**
 * @typedef {Object} DofBlockSpec
 * @property {string} name Unique block name.
 * @property {function(object): number} length Positive integer scalar count for a cell.
 * @property {string[]} [components] Component names in block order; otherwise use numeric indices.
 * @property {function(object): (number[]|Float64Array)} read Read scalar values in block order.
 * @property {function(object, (number[]|Float64Array)): void} write Write values into a shallow-copied cell.
 * @property {"length"|"dimensionless"} scaleKind Divide length coordinates by loop length; dimensionless coordinates use 1.
 * @property {number[]} [translation] Block-relative indices excluded when fixing translation.
 * @property {{kind: "maxAbs"}|{kind: "conjugateLength", conjugates: Object<string, string>}} equilibrium
 *   Residual criterion: maximum absolute residual, or component residual times its named conjugate length.
 */

/** Default T1 declarations; kernels keep local [positions(3N), W, H, S] vectors.
 * Model wrappers map that local order through a kernel view, independently of global block order.
 * @type {ReadonlyArray<DofBlockSpec>}
 */
export const T1_DOF_BLOCKS = Object.freeze([
  Object.freeze({ name: "positions", length(cell) {
    // Keep the existing T1 evaluation error when the new positive-length guard runs first.
    if (cell.positions.length === 0) throw new TypeError("Invalid rod positions: expected finite 3D points");
    return 3 * cell.positions.length;
  },
    read: cell => Float64Array.from(cell.positions.flat()),
    write(target, values) {
      target.positions = Array.from({ length: values.length / 3 }, (_, i) => Array.from(values.slice(3 * i, 3 * i + 3)));
    },
    scaleKind: "length", translation: Object.freeze([0, 1, 2]), equilibrium: Object.freeze({ kind: "maxAbs" }) }),
  Object.freeze({ name: "lattice", length: () => 3, components: Object.freeze(["W", "H", "S"]),
    read: cell => Float64Array.of(cell.W, cell.H, cell.S),
    write(target, values) { target.W = values[0]; target.H = values[1]; target.S = values[2]; },
    scaleKind: "length", equilibrium: Object.freeze({ kind: "conjugateLength", conjugates: Object.freeze({ W: "W", H: "H", S: "W" }) }) }),
]);

/**
 * Build immutable, contiguous blocks in declaration order. Every block declares
 * its scaling and equilibrium criterion so additional coordinates cannot silently
 * escape convergence checks. The single-argument form retains the T1 order.
 * @param {object} cell Cell used to determine block lengths.
 * @param {ReadonlyArray<DofBlockSpec>} [blockSpecs=T1_DOF_BLOCKS] Ordered declarations.
 */
export function createDofLayout(cell, blockSpecs = T1_DOF_BLOCKS) {
  let size = 0;
  const names = new Set();
  const blocks = Object.freeze(blockSpecs.map(spec => {
    if (names.has(spec.name)) throw new Error(`Duplicate degree-of-freedom block: ${spec.name}`);
    names.add(spec.name);
    const length = spec.length(cell);
    if (!Number.isInteger(length) || length <= 0) throw new RangeError(`Block ${spec.name} length must be a positive integer`);
    if (!["length", "dimensionless"].includes(spec.scaleKind)) throw new Error(`Block ${spec.name} must declare a valid scaleKind`);
    if (!["maxAbs", "conjugateLength"].includes(spec.equilibrium?.kind)) throw new Error(`Block ${spec.name} must declare an equilibrium criterion`);
    if (spec.components && (spec.components.length !== length || new Set(spec.components).size !== length)) {
      throw new Error(`Block ${spec.name} components must name each component exactly once`);
    }
    const block = { ...spec, offset: size, length,
      equilibrium: Object.freeze({ ...spec.equilibrium,
        ...(spec.equilibrium.conjugates ? { conjugates: Object.freeze({ ...spec.equilibrium.conjugates }) } : {}) }) };
    if (spec.components) block.components = Object.freeze([...spec.components]);
    if (spec.translation) block.translation = Object.freeze([...spec.translation]);
    size += length;
    return Object.freeze(block);
  }));

  /** Resolve a numeric block-relative index or a declared component name. */
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
      const values = new Float64Array(size);
      for (const block of blocks) values.set(block.read(state), block.offset);
      return values;
    },
    /** Preserve template key order and accept both legacy arrays and Float64Array vectors. */
    unpack(values, template) {
      const target = { ...template };
      for (const block of blocks) block.write(target, values.slice(block.offset, block.offset + block.length));
      return target;
    },
    /** Ascending global indices; translation exclusions are block-relative.
     * The existing locked option names lattice components.
     */
    freeIndices({ fixTranslation = true, locked = [] } = {}) {
      const lockedIndices = new Set(locked.map(component => index("lattice", component)));
      if (fixTranslation) for (const block of blocks) {
        for (const relative of block.translation ?? []) lockedIndices.add(block.offset + relative);
      }
      return Array.from({ length: size }, (_, i) => i).filter(i => !lockedIndices.has(i));
    },
  });
}
