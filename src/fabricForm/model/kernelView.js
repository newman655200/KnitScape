/**
 * Map an ordered list of kernel-local blocks to a global layout by name.
 * Required blocks must exist and match the kernel's component order; omitted
 * entries in componentOrders require an unnamed (numerically indexed) block.
 * scatter/gather copy whole Float64Array block slices with set/subarray, preserving
 * signed zero and NaN payload bytes. Other global components start at positive zero.
 * @param {ReturnType<import("./dofLayout.js").createDofLayout>} layout Global layout.
 * @param {string[]} blockNames Required names in kernel-local order.
 * @param {Object<string, string[]>} [componentOrders={}] Expected named components.
 * @returns {{size: number, scatter: function(Float64Array): Float64Array, gather: function(Float64Array): Float64Array}}
 */
export function createKernelView(layout, blockNames, componentOrders = {}) {
  let size = 0;
  const blocks = blockNames.map(name => {
    const block = layout.blocks.find(item => item.name === name);
    if (!block) throw new RangeError(`Unknown degree-of-freedom block: ${name}`);
    const expected = componentOrders[name];
    if (expected ? !block.components || expected.length !== block.length || expected.some((value, i) => value !== block.components[i]) : block.components !== undefined) {
      throw new Error(`Kernel block ${name} component order does not match the layout`);
    }
    const mapping = { globalOffset: block.offset, localOffset: size, length: block.length };
    size += block.length;
    return mapping;
  });
  return Object.freeze({ size,
    scatter(local) {
      if (local.length !== size) throw new RangeError("Kernel vector length must match the kernel view");
      const global = new Float64Array(layout.size);
      for (const block of blocks) global.set(local.subarray(block.localOffset, block.localOffset + block.length), block.globalOffset);
      return global;
    },
    gather(global) {
      if (global.length !== layout.size) throw new RangeError("Global vector length must match layout.size");
      const local = new Float64Array(size);
      for (const block of blocks) local.set(global.subarray(block.globalOffset, block.globalOffset + block.length), block.localOffset);
      return local;
    },
  });
}
