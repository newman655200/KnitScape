import {
  createTintedTextureCanvas,
  loadImageFromDataUrl,
  normalizeYarnTexture,
  YARN_PBR_MAP_KEYS,
} from "../yarnTexture/yarnScanTexture";
import { yarnAssetRegistry } from "../yarnTexture/yarnAssetRegistry.js";
import { resolveYarnMaterial } from "../domain/yarnMaterial.js";

const imageCache = new Map();
const retainedImageKeys = new Set();
const tintedCache = new Map();
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
    cache.delete(cache.keys().next().value);
  }
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

  const record = { image: null, promise: null };
  record.promise = (source?.assetRef
    ? yarnAssetRegistry.getObjectUrl(source.assetRef)
    : Promise.resolve(source))
    .then(loadImageFromDataUrl)
    .then((image) => {
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

  const record = { canvas: null, promise: null };
  record.promise = createTintedTextureCanvas(
    texture.processedDataUrl,
    color,
    texture.textureStrength
  )
    .then((canvas) => {
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

// Runtime material views share asset references; each Feed slot owns its scale.
export function resolveFeedYarnPlies(feeds, yarnLibrary, primaryPly, usedFeedIndices = null) {
  const materials = new Map();
  const library = new Map((yarnLibrary || []).map(yarn => [String(yarn.id), yarn]));
  (feeds || []).forEach((feed, index) => {
    if (usedFeedIndices && !usedFeedIndices.has(index)) return;
    const yarns = Array.isArray(feed?.yarns) && feed.yarns.length ? feed.yarns : [null];
    materials.set(index, yarns.map(yarn => {
      const yarnId = yarn?.yarnId;
      const asset = yarnId === null || yarnId === undefined || yarnId === ""
        ? null : library.get(String(yarnId));
      const material = resolveYarnMaterial({ yarnAsset: asset, legacyContext: primaryPly });
      const hasAssetFields = Object.values(material.source).includes("ASSET");
      // Preserve the historical no-field adapter identity for old projects.
      return hasAssetFields ? { ...primaryPly, ...material, assetMaterial: true } : primaryPly;
    }));
  });
  return materials;
}

export function retainYarnAssetTextureImages(materials) {
  const retained = new Set(materials.flatMap(ply => collectYarnTextureSources(ply.texture))
    .map(getYarnTextureSourceKey));
  retainedImageKeys.clear();
  for (const key of retained) {
    retainedImageKeys.add(key);
    cachedRecord(imageCache, key);
  }
  for (const key of imageCache.keys()) {
    if (key.startsWith("asset:") && !retained.has(key)) imageCache.delete(key);
  }
  while (imageCache.size > Math.max(IMAGE_CACHE_LIMIT, retainedImageKeys.size)) {
    imageCache.delete(imageCache.keys().next().value);
  }
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
