import { normalizeYarnPbr } from "../yarnTexture/yarnScanTexture.js";

export const YARN_CATEGORIES = Object.freeze(["T", "CD", "N", "OP", "OTHER"]);

export function createYarnAsset(id, name, category = "OTHER", timestamp = new Date().toISOString()) {
  if (!((typeof id === "string" && id.trim()) ||
    (Number.isInteger(id) && id >= 0))) throw new TypeError("Yarn id is required.");
  if (typeof name !== "string" || !name.trim()) throw new TypeError("Yarn name is required.");
  if (!YARN_CATEGORIES.includes(category)) throw new TypeError("Invalid Yarn category.");
  return { id, name: name.trim(), category, createdAt: timestamp, updatedAt: timestamp };
}

export function normalizeYarnLibrary(assets = [], feeds = []) {
  if (!Array.isArray(assets)) throw new TypeError("yarnLibrary must be an array.");
  const ids = new Set();
  const library = assets.map((asset) => {
    const normalized = createYarnAsset(asset?.id, asset?.name, asset?.category);
    normalized.createdAt = asset.createdAt ?? normalized.createdAt;
    normalized.updatedAt = asset.updatedAt ?? normalized.createdAt;
    if (asset.color != null) {
      if (typeof asset.color !== "string" || !asset.color.trim()) throw new TypeError("Yarn color must be a nonempty string.");
      normalized.color = asset.color.trim();
    }
    if (asset.diameter != null) {
      if (!Number.isFinite(asset.diameter) || asset.diameter <= 0) throw new TypeError("Yarn diameter must be positive.");
      normalized.diameter = asset.diameter;
    }
    const pbr = normalizeYarnPbr(asset.pbr);
    if (pbr) normalized.pbr = pbr;
    if (![normalized.createdAt, normalized.updatedAt].every(value =>
      typeof value === "string" && Number.isFinite(Date.parse(value)))) {
      throw new TypeError("Yarn timestamps must be valid date strings.");
    }
    if (ids.has(String(normalized.id))) throw new TypeError("Yarn ids must be unique.");
    ids.add(String(normalized.id));
    return normalized;
  });
  // Preserve legacy Feed ids without guessing material properties from names.
  for (const feed of feeds) {
    for (const yarn of feed.yarns ?? []) {
      if (ids.has(String(yarn.yarnId))) continue;
      const name = `Yarn ${typeof yarn.yarnId === "number" ? yarn.yarnId + 1 : yarn.yarnId}`;
      library.push(createYarnAsset(yarn.yarnId, name));
      ids.add(String(yarn.yarnId));
    }
  }
  return library;
}

export function isYarnReferenced(id, feeds = []) {
  return feeds.some(feed => feed.yarns?.some(yarn => String(yarn.yarnId) === String(id)));
}

export function queryYarnLibrary(library, { search = "", category = "ALL", sort = "name" } = {}) {
  const text = search.trim().toLowerCase();
  const compareName = (a, b) => a.name.localeCompare(b.name, undefined,
    { numeric: true, sensitivity: "base" }) || String(a.id).localeCompare(String(b.id));
  return library.filter(yarn => yarn.name.toLowerCase().includes(text) &&
    (category === "ALL" || yarn.category === category)).sort((a, b) =>
    (sort === "updated" ? Date.parse(b.updatedAt) - Date.parse(a.updatedAt) : 0) || compareName(a, b));
}
