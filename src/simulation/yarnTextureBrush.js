import {
  createTintedTextureCanvas,
  loadImageFromDataUrl,
  normalizeYarnTexture,
  YARN_PBR_MAP_KEYS,
} from "../yarnTexture/yarnScanTexture";
import { yarnAssetRegistry } from "../yarnTexture/yarnAssetRegistry.js";
export { resolveFeedYarnPlies } from "../domain/yarnMaterial.js";

const imageCache = new Map();
const retainedImageKeys = new Set();
const tintedCache = new Map();
const imageOwners = new Map();
const legacyImageOwner = {};
const IMAGE_CACHE_LIMIT = 24;
const TINTED_CACHE_LIMIT = 24;

function cachedRecord(cache, key) {
  const record = cache.get(key);
  if (!record) return null;
  cache.delete(key);
  cache.set(key, record);
  return record;
}

function rememberCacheRecord(cache, key, record, limit) {
  cache.set(key, record);
  const capacity = cache === imageCache ? Math.max(limit, retainedImageKeys.size) : limit;
  while (cache.size > capacity) {
    cache.values().next().value.controller?.abort();
    cache.delete(cache.keys().next().value);
  }
}

function discardCacheRecord(cache, key) {
  const record = cache.get(key);
  if (!record) return;
  cache.delete(key);
  record.controller?.abort();
  record.image = null;
  if (record.canvas) record.canvas.width = record.canvas.height = 0;
  record.canvas = null;
}

export function getYarnPbrMapSource(map) {
  return map?.assetRef ? { assetRef: map.assetRef }
    : map?.processedDataUrl || map?.dataUrl || "";
}

export function getYarnTextureSourceKey(source) {
  return source?.assetRef ? `asset:${source.assetRef}` : String(source || "");
}

function queueImage(source) {
  const dataUrl = getYarnTextureSourceKey(source);
  if (!dataUrl) return null;

  const cached = cachedRecord(imageCache, dataUrl);
  if (cached) return cached;

  const record = { image: null, promise: null, controller: new AbortController() };
  record.promise = (source?.assetRef
    ? yarnAssetRegistry.getObjectUrl(source.assetRef)
    : Promise.resolve(source))
    .then(url => imageCache.get(dataUrl) === record && !record.controller.signal.aborted
      ? loadImageFromDataUrl(url, { signal: record.controller.signal }) : null)
    .then((image) => {
      if (imageCache.get(dataUrl) !== record || record.controller.signal.aborted) return null;
      record.image = image;
      return image;
    })
    .catch((error) => {
      if (imageCache.get(dataUrl) === record) imageCache.delete(dataUrl);
      throw error;
    });

  rememberCacheRecord(imageCache, dataUrl, record, IMAGE_CACHE_LIMIT);
  return record;
}

function queueTintedBrush(texture, color) {
  if (!texture?.processedDataUrl) return null;

  const key = `${texture.processedDataUrl}|${color}|${texture.textureStrength}`;
  const cached = cachedRecord(tintedCache, key);
  if (cached) return cached;

  const record = { canvas: null, promise: null, controller: new AbortController() };
  record.promise = createTintedTextureCanvas(
    texture.processedDataUrl,
    color,
    texture.textureStrength,
    { signal: record.controller.signal }
  )
    .then((canvas) => {
      if (tintedCache.get(key) !== record || record.controller.signal.aborted) {
        canvas.width = canvas.height = 0;
        return null;
      }
      record.canvas = canvas;
      return canvas;
    })
    .catch((error) => {
      if (tintedCache.get(key) === record) tintedCache.delete(key);
      throw error;
    });

  rememberCacheRecord(tintedCache, key, record, TINTED_CACHE_LIMIT);
  return record;
}

function getReadyBrush(texture, color) {
  const source = texture?.processedDataUrl || getYarnPbrMapSource(texture?.pbr?.baseColor);
  if (!source) return null;

  if (texture.useOriginalColor !== false) {
    return getReadyYarnTextureImage(source);
  }

  const key = `${texture.processedDataUrl}|${color}|${texture.textureStrength}`;
  return cachedRecord(tintedCache, key)?.canvas || null;
}

export function getReadyYarnTextureImage(source) {
  if (source?.assetRef && !yarnAssetRegistry.has(source.assetRef)) return null;
  return cachedRecord(imageCache, getYarnTextureSourceKey(source))?.image || null;
}

export function collectYarnTextureSources(texture) {
  if (!texture || texture.enabled === false) return [];
  return [
    texture?.pbr?.baseColor,
    texture?.pbr?.normal,
    texture?.pbr?.roughness,
    texture?.pbr?.height,
    texture?.pbr?.ambientOcclusion,
    texture?.pbr?.metallic,
  ]
    .map(getYarnPbrMapSource)
    .concat(texture.processedDataUrl || [])
    .filter(Boolean);
}

function updateRetainedImageKeys() {
  retainedImageKeys.clear();
  for (const owner of imageOwners.values()) for (const key of owner.images) {
    retainedImageKeys.add(key);
    cachedRecord(imageCache, key);
  }
}

function discardUnownedImages(previous) {
  for (const key of previous?.images || []) {
    if (!retainedImageKeys.has(key)) discardCacheRecord(imageCache, key);
  }
  for (const key of previous?.tinted || []) {
    if (![...imageOwners.values()].some(owner => owner.tinted.has(key))) discardCacheRecord(tintedCache, key);
  }
}

// Owners retain preview resources only. Registry binaries and object URLs
// remain project-owned and are never released by a renderer mode change.
export function retainYarnAssetTextureImages(materials, owner = legacyImageOwner) {
  const previous = imageOwners.get(owner);
  imageOwners.set(owner, {
    images: new Set(materials.flatMap(ply => collectYarnTextureSources(ply.texture)).map(getYarnTextureSourceKey)),
    tinted: new Set(materials.flatMap(ply => {
      const texture = normalizeYarnTexture(ply.texture);
      return texture?.enabled !== false && texture?.processedDataUrl && texture.useOriginalColor === false
        ? [`${texture.processedDataUrl}|${ply.color}|${texture.textureStrength}`] : [];
    })),
  });
  updateRetainedImageKeys();
  discardUnownedImages(previous);
  for (const key of imageCache.keys()) {
    if (key.startsWith("asset:") && !retainedImageKeys.has(key)) discardCacheRecord(imageCache, key);
  }
  while (imageCache.size > Math.max(IMAGE_CACHE_LIMIT, retainedImageKeys.size)) {
    discardCacheRecord(imageCache, imageCache.keys().next().value);
  }
}

export function releaseYarnTextureImages(owner) {
  const previous = imageOwners.get(owner);
  imageOwners.delete(owner);
  updateRetainedImageKeys();
  discardUnownedImages(previous);
}

export function prepareYarnTextureImages(yarnPlies) {
  const jobs = [];

  yarnPlies.forEach((ply) => {
    const texture = normalizeYarnTexture(ply.texture);
    if (!texture || texture.enabled === false) return;

    YARN_PBR_MAP_KEYS.map(key => getYarnPbrMapSource(texture.pbr?.[key]))
      .filter(Boolean).forEach((source) => {
      const record = queueImage(source);
      if (record?.promise) jobs.push(record.promise);
    });

    if (!texture.processedDataUrl) return;

    if (texture.useOriginalColor !== false) {
      const record = queueImage(texture.processedDataUrl);
      if (record?.promise) jobs.push(record.promise);
      return;
    }

    const record = queueTintedBrush(texture, ply.color);
    if (record?.promise) jobs.push(record.promise);
  });

  return Promise.allSettled(jobs);
}

function strokePath(context, path, lineWidth, strokeStyle, alpha = 1) {
  context.lineWidth = lineWidth;
  context.strokeStyle = strokeStyle;
  context.globalAlpha = alpha;
  context.stroke(path);
}

export function drawYarnSequenceMaskPath(
  context,
  path,
  lineWidth,
  sequenceMaskColor
) {
  if (!sequenceMaskColor) return;

  context.save?.();
  context.lineCap = "round";
  context.lineJoin = "round";

  const previousComposite = context.globalCompositeOperation;
  try {
    context.globalCompositeOperation = "multiply";
    strokePath(context, path, lineWidth * 1.02, sequenceMaskColor, 0.38);
    context.globalCompositeOperation = previousComposite || "source-over";
  } finally {
    context.globalAlpha = 1;
    context.restore?.();
  }
}

export function drawYarnTexturePath(
  context,
  path,
  ply,
  stitchWidth,
  { renderTextures = true } = {}
) {
  const texture = normalizeYarnTexture(ply.texture);
  const lineWidth = stitchWidth * ply.diameter;

  context.save?.();
  context.lineCap = "round";
  context.lineJoin = "round";

  try {
    strokePath(context, path, lineWidth * 1.1, "rgba(0, 0, 0, 0.16)");

    if (
      !renderTextures ||
      !(texture?.processedDataUrl || getYarnPbrMapSource(texture?.pbr?.baseColor)) ||
      texture.enabled === false
    ) {
      strokePath(context, path, lineWidth, ply.color);
      return;
    }

    const brush = getReadyBrush(texture, ply.color);
    const pattern =
      brush && context.createPattern
        ? context.createPattern(brush, "repeat")
        : null;
    const textureStrength = texture.textureStrength;
    const fuzzStrength = texture.fuzzStrength;

    if (fuzzStrength > 0) {
      strokePath(
        context,
        path,
        lineWidth * (1 + fuzzStrength * 0.45),
        pattern || ply.color,
        0.18 * fuzzStrength
      );
    }

    strokePath(
      context,
      path,
      lineWidth,
      pattern || ply.color,
      Math.max(0.15, textureStrength)
    );

    strokePath(
      context,
      path,
      lineWidth * 0.34,
      "rgba(255, 255, 255, 0.65)",
      0.18
    );
  } finally {
    context.globalAlpha = 1;
    context.restore?.();
  }
}
