// A frozen Map alone still permits Map.prototype.set.call(map, ...). Keep its
// backing Map private, and expose only readers whose results are already frozen.
function readonlyMap(backing) {
  const reject = () => { throw new TypeError("Simulation snapshot maps are readonly."); };
  let view;
  const readers = {
    get: key => backing.get(key),
    has: key => backing.has(key),
    keys: () => backing.keys(),
    values: () => backing.values(),
    entries: () => backing.entries(),
    forEach: (callback, thisArg) => backing.forEach((value, key) =>
      callback.call(thisArg, value, key, view)),
    set: reject,
    delete: reject,
    clear: reject,
    [Symbol.iterator]: () => backing.entries(),
  };
  view = new Proxy(backing, {
    get(target, key, receiver) {
      if (key === "size") return target.size;
      if (Object.hasOwn(readers, key)) return readers[key];
      // Do not bind Object.prototype readers: valueOf must return the view.
      return Reflect.get(target, key, receiver);
    },
    set: reject,
    deleteProperty: reject,
    setPrototypeOf: reject,
  });
  return Object.freeze(view);
}

function copyData(value, readonly, seen = new Map()) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Map) {
    const backing = new Map();
    const copy = readonly ? readonlyMap(backing) : backing;
    seen.set(value, copy);
    for (const [key, item] of value) backing.set(copyData(key, readonly, seen), copyData(item, readonly, seen));
    return copy;
  }
  const copy = Array.isArray(value) || ArrayBuffer.isView(value) ? [] : {};
  seen.set(value, copy);
  for (const [key, item] of Object.entries(value)) copy[key] = copyData(item, readonly, seen);
  return readonly ? Object.freeze(copy) : copy;
}

// Snapshot construction owns the copy. Project inputs, working solver maps and
// material aliases can never be mutated through the published boundary.
export function createSimulationSnapshot(data) {
  return copyData(data, true);
}

// Legacy state consumers require real, mutable Maps. Never publish snapshot
// proxies to GLOBAL_STATE or hand back the solver cache's mutable working copy.
export function copySolverResults(snapshot) {
  return copyData(snapshot.originalSolverResults, false);
}
