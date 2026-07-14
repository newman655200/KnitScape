import {
  createTintedTextureCanvas,
  loadImageFromDataUrl,
  normalizeYarnTexture,
} from "../yarnTexture/yarnScanTexture";

const imageCache = new Map();
const tintedCache = new Map();

function queueImage(dataUrl) {
  if (!dataUrl) return null;

  const cached = imageCache.get(dataUrl);
  if (cached) return cached;

  const record = { image: null, promise: null };
  record.promise = loadImageFromDataUrl(dataUrl)
    .then((image) => {
      record.image = image;
      return image;
    })
    .catch((error) => {
      imageCache.delete(dataUrl);
      throw error;
    });

  imageCache.set(dataUrl, record);
  return record;
}

function queueTintedBrush(texture, color) {
  if (!texture?.processedDataUrl) return null;

  const key = `${texture.processedDataUrl}|${color}|${texture.textureStrength}`;
  const cached = tintedCache.get(key);
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
      tintedCache.delete(key);
      throw error;
    });

  tintedCache.set(key, record);
  return record;
}

function getReadyBrush(texture, color) {
  if (!texture?.processedDataUrl) return null;

  if (texture.useOriginalColor !== false) {
    return queueImage(texture.processedDataUrl)?.image || null;
  }

  return queueTintedBrush(texture, color)?.canvas || null;
}

export function getReadyYarnTextureImage(dataUrl) {
  return queueImage(dataUrl)?.image || null;
}

function collectPbrMapDataUrls(texture) {
  return [
    texture?.pbr?.baseColor,
    texture?.pbr?.normal,
    texture?.pbr?.roughness,
    texture?.pbr?.height,
    texture?.pbr?.ambientOcclusion,
  ]
    .map((map) => map?.processedDataUrl || map?.dataUrl || "")
    .filter(Boolean);
}

export function prepareYarnTextureImages(yarnPlies) {
  const jobs = [];

  yarnPlies.forEach((ply) => {
    const texture = normalizeYarnTexture(ply.texture);
    if (!texture || texture.enabled === false) return;

    collectPbrMapDataUrls(texture).forEach((dataUrl) => {
      const record = queueImage(dataUrl);
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
      !texture?.processedDataUrl ||
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
