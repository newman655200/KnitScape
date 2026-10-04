let nextAssetId = 0;

// Keep binary sources outside GLOBAL_STATE. Package entries are registered as
// loaders; neither registration nor metadata access reads their image bytes.
export class YarnAssetRegistry {
  #entries = new Map();

  register(source) {
    if (!(source instanceof Blob) && typeof source !== "function") {
      throw new TypeError("Asset source must be a Blob or a lazy Blob loader.");
    }
    const ref = `yarn-pbr-${++nextAssetId}`;
    this.#entries.set(ref, { source, blobPromise: null, url: null, urlPromise: null });
    return ref;
  }

  has(ref) {
    return this.#entries.has(ref);
  }

  async getBlob(ref) {
    const entry = this.#entries.get(ref);
    if (!entry) throw new Error("Yarn PBR asset is missing.");
    if (!entry.blobPromise) {
      entry.blobPromise = Promise.resolve().then(() =>
        typeof entry.source === "function" ? entry.source() : entry.source
      ).then(blob => {
        if (!(blob instanceof Blob)) throw new TypeError("Asset loader must return a Blob.");
        return blob;
      });
    }
    const pending = entry.blobPromise;
    try { return await pending; }
    catch (error) {
      if (entry.blobPromise === pending) entry.blobPromise = null;
      throw error;
    }
  }

  async getObjectUrl(ref) {
    const entry = this.#entries.get(ref);
    if (!entry) throw new Error("Yarn PBR asset is missing.");
    if (!entry.urlPromise) {
      entry.urlPromise = this.getBlob(ref).then(blob => {
        if (this.#entries.get(ref) !== entry) throw new Error("Yarn PBR asset was released.");
        entry.url = URL.createObjectURL(blob);
        return entry.url;
      }).catch(error => {
        entry.urlPromise = null;
        throw error;
      });
    }
    return entry.urlPromise;
  }

  release(ref) {
    const entry = this.#entries.get(ref);
    if (entry?.url) URL.revokeObjectURL(entry.url);
    this.#entries.delete(ref);
  }

  clear() {
    for (const ref of this.#entries.keys()) this.release(ref);
  }

  // An in-progress export must retain the sources captured before editing or
  // switching projects. Blobs are immutable; this copies metadata, not bytes.
  fork() {
    const registry = new YarnAssetRegistry();
    for (const [ref, entry] of this.#entries) {
      registry.#entries.set(ref, { ...entry, url: null, urlPromise: null });
    }
    return registry;
  }

  replaceWith(registry) {
    if (registry === this) return;
    this.clear();
    this.#entries = registry.#entries;
    registry.#entries = new Map();
  }
}

export const yarnAssetRegistry = new YarnAssetRegistry();
