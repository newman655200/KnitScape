import { yarnAssetRegistry } from "./yarnAssetRegistry.js";

export const DEFAULT_YARN_SCAN_TEXTURE = Object.freeze({
  sourceType: "scan",
  fileName: "",
  dataUrl: "",
  processedDataUrl: "",
  enabled: true,
  maxSize: 512,
  useOriginalColor: true,
  backgroundThreshold: 0.92,
  textureStrength: 0.75,
  fuzzStrength: 0.45,
  pbr: Object.freeze({
    baseColor: null,
    normal: null,
    roughness: null,
    height: null,
    ambientOcclusion: null,
  }),
});

export const YARN_PBR_MAP_KEYS = Object.freeze(Object.keys(DEFAULT_YARN_SCAN_TEXTURE.pbr));

const YARN_TEXTURE_SIZE_PRESETS = [256, 512, 1024];
const DEFAULT_YARN_LENGTH_SCALE_Y = 1;
const MIN_YARN_LENGTH_SCALE_Y = 0.9;
const MAX_YARN_LENGTH_SCALE_Y = 1.1;

const EMPTY_PBR_TEXTURE_MAP = Object.freeze({
  fileName: "",
  dataUrl: "",
  processedDataUrl: "",
});

export const clamp01 = (value, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1, Math.max(0, number));
};

function clampYarnLengthScaleY(value, fallback = DEFAULT_YARN_LENGTH_SCALE_Y) {
  const number = Number(value);
  const fallbackNumber = Number(fallback);
  const safeFallback = Number.isFinite(fallbackNumber)
    ? fallbackNumber
    : DEFAULT_YARN_LENGTH_SCALE_Y;

  if (!Number.isFinite(number)) {
    return Math.min(
      MAX_YARN_LENGTH_SCALE_Y,
      Math.max(MIN_YARN_LENGTH_SCALE_Y, safeFallback)
    );
  }

  return Math.min(
    MAX_YARN_LENGTH_SCALE_Y,
    Math.max(MIN_YARN_LENGTH_SCALE_Y, number)
  );
}

export function normalizeTextureMaxSize(value) {
  const number = Number(value);
  if (YARN_TEXTURE_SIZE_PRESETS.includes(number)) return number;
  return DEFAULT_YARN_SCAN_TEXTURE.maxSize;
}

export function normalizePbrTextureMap(map = null) {
  if (!map || typeof map !== "object") return null;

  return {
    ...EMPTY_PBR_TEXTURE_MAP,
    fileName: String(map.fileName || ""),
    dataUrl: String(map.dataUrl || ""),
    processedDataUrl: String(map.processedDataUrl || map.dataUrl || ""),
  };
}

export function normalizePbrTextureMaps(pbr = {}) {
  const source = pbr && typeof pbr === "object" ? pbr : {};

  return {
    baseColor: normalizePbrTextureMap(source.baseColor),
    normal: normalizePbrTextureMap(source.normal),
    roughness: normalizePbrTextureMap(source.roughness),
    height: normalizePbrTextureMap(source.height),
    ambientOcclusion: normalizePbrTextureMap(source.ambientOcclusion),
  };
}

export function normalizeYarnTexture(texture = null) {
  if (!texture || typeof texture !== "object") return null;

  return {
    sourceType: "scan",
    fileName: String(texture.fileName || ""),
    dataUrl: String(texture.dataUrl || ""),
    processedDataUrl: String(texture.processedDataUrl || texture.dataUrl || ""),
    enabled: texture.enabled !== false,
    maxSize: normalizeTextureMaxSize(texture.maxSize),
    useOriginalColor: texture.useOriginalColor !== false,
    backgroundThreshold: clamp01(
      texture.backgroundThreshold,
      DEFAULT_YARN_SCAN_TEXTURE.backgroundThreshold
    ),
    textureStrength: clamp01(
      texture.textureStrength,
      DEFAULT_YARN_SCAN_TEXTURE.textureStrength
    ),
    fuzzStrength: clamp01(
      texture.fuzzStrength,
      DEFAULT_YARN_SCAN_TEXTURE.fuzzStrength
    ),
    pbr: normalizePbrTextureMaps(texture.pbr),
  };
}

export function normalizeYarnPly(ply, fallback = {}) {
  const source = ply && typeof ply === "object" ? ply : {};
  const fallbackSource =
    fallback && typeof fallback === "object" ? fallback : {};
  const diameter = Number(source.diameter);
  const fallbackDiameter = Number(fallbackSource.diameter);
  const lengthScaleY = Number(source.lengthScaleY);
  const fallbackLengthScaleY = Number(fallbackSource.lengthScaleY);

  return {
    ...fallbackSource,
    ...source,
    color: source.color || fallbackSource.color,
    diameter:
      Number.isFinite(diameter) && diameter > 0
        ? diameter
        : Number.isFinite(fallbackDiameter) && fallbackDiameter > 0
          ? fallbackDiameter
          : 0.24,
    lengthScaleY: clampYarnLengthScaleY(
      lengthScaleY,
      Number.isFinite(fallbackLengthScaleY)
        ? fallbackLengthScaleY
        : DEFAULT_YARN_LENGTH_SCALE_Y
    ),
    enabled: source.enabled !== false,
    texture: normalizeYarnTexture(source.texture),
  };
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load yarn scan image."));
    image.src = dataUrl;
  });
}

export function identifyPbrMap(fileName) {
  if (!/\.(png|jpe?g|webp)$/i.test(fileName)) return null;
  const name = fileName.replace(/\.[^.]+$/, "")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2").toLowerCase();
  const aliases = {
    baseColor: "base[ _-]*color|albedo|diffuse",
    normal: "normal",
    roughness: "roughness",
    height: "height|displacement",
    ambientOcclusion: "ao|ambient[ _-]*occlusion",
  };
  return Object.keys(aliases).find(key =>
    new RegExp(`(^|[^a-z])(${aliases[key]})([^a-z]|$)`).test(name)) ?? null;
}

// Yarn Asset maps use references at runtime; embedded images are accepted only
// so legacy JSON can be migrated at the project import boundary.
function normalizeAssetReference(map) {
  if (typeof map.assetRef !== "string" || !map.assetRef ||
    !["image/png", "image/jpeg", "image/webp"].includes(map.mimeType) ||
    !Number.isSafeInteger(map.byteLength) || map.byteLength <= 0 ||
    map.dataUrl || map.processedDataUrl) {
    throw new TypeError("Invalid Yarn PBR asset reference.");
  }
  return { assetRef: map.assetRef, mimeType: map.mimeType, byteLength: map.byteLength };
}

export function normalizeYarnPbr(pbr) {
  if (pbr == null) return null;
  const isImageDataUrl = value => /^data:image\/(png|jpeg|webp);base64,[a-z\d+/=\s]+$/i.test(value);
  const maps = Object.fromEntries(YARN_PBR_MAP_KEYS.map(key => {
    const source = pbr[key];
    if (source == null) return [key, null];
    if (source.assetRef !== undefined) {
      return [key, { ...normalizeAssetReference(source), fileName: String(source.fileName || ""),
        ...(source.original ? { original: normalizeAssetReference(source.original) } : {}) }];
    }
    const map = normalizePbrTextureMap(source);
    if (!map || !isImageDataUrl(map.dataUrl) || !isImageDataUrl(map.processedDataUrl)) {
      throw new TypeError("Yarn PBR maps require image references or embedded legacy images.");
    }
    return [key, map];
  }));
  if (!Object.values(maps).some(Boolean)) return null;
  const previewDataUrl = pbr.previewDataUrl || "";
  if (previewDataUrl && !isImageDataUrl(previewDataUrl)) throw new TypeError("Invalid PBR preview.");
  return { ...maps, previewDataUrl };
}

export async function importPbrFiles(files, registry = yarnAssetRegistry) {
  const selected = new Map();
  for (const file of files) {
    const key = identifyPbrMap(file.name);
    if (!key) continue;
    if (selected.has(key)) throw Object.assign(new Error(`Multiple PBR files for ${key}.`),
      { code: "PBR_AMBIGUOUS_FILES" });
    selected.set(key, file);
  }
  if (!selected.size) throw Object.assign(new Error("No recognized PBR images."),
    { code: "PBR_UNRECOGNIZED_FILES" });
  const validated = [];
  let previewDataUrl = "";
  for (const [key, file] of selected) {
    if (!(file instanceof Blob) || !file.size || file.size > 256 * 1024 ** 2) {
      throw new TypeError("Invalid PBR image file.");
    }
    const mimeType = file.type || (/\.png$/i.test(file.name) ? "image/png"
      : /\.webp$/i.test(file.name) ? "image/webp" : "image/jpeg");
    if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
      throw new TypeError("Invalid PBR image type.");
    }
    const blob = file.type === mimeType ? file : file.slice(0, file.size, mimeType);
    const url = URL.createObjectURL(blob);
    try {
      const image = await loadImageFromDataUrl(url);
      if (key === "baseColor") {
        const scale = Math.min(1, 48 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = makeCanvas(image.naturalWidth * scale, image.naturalHeight * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        previewDataUrl = canvas.toDataURL("image/png");
      }
    } finally { URL.revokeObjectURL(url); }
    validated.push({ key, fileName: file.name, blob });
  }
  // Only a completely validated group enters the Registry. Full maps never
  // become Data URLs; the small BaseColor preview is the only embedded image.
  return normalizeYarnPbr({ previewDataUrl, ...Object.fromEntries(validated.map(({ key, fileName, blob }) =>
    [key, { fileName, assetRef: registry.register(blob), mimeType: blob.type, byteLength: blob.size }])) });
}

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));
  return canvas;
}

function pixelBackgroundScore(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const brightness = max / 255;
  const saturation = max === 0 ? 0 : (max - min) / max;
  return brightness * (1 - saturation * 0.55);
}

export function findContentBounds(imageData, threshold = 0.92) {
  const { width, height, data } = imageData;
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const score = pixelBackgroundScore(
        data[offset],
        data[offset + 1],
        data[offset + 2]
      );
      const isVisible = data[offset + 3] > 0;

      if (isVisible && score < threshold) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (right < left || bottom < top) {
    return { left: 0, top: 0, width, height };
  }

  const padding = Math.max(2, Math.round(Math.min(width, height) * 0.04));
  const paddedLeft = Math.max(0, left - padding);
  const paddedTop = Math.max(0, top - padding);
  const paddedRight = Math.min(width - 1, right + padding);
  const paddedBottom = Math.min(height - 1, bottom + padding);

  return {
    left: paddedLeft,
    top: paddedTop,
    width: paddedRight - paddedLeft + 1,
    height: paddedBottom - paddedTop + 1,
  };
}

function applyBackgroundMask(imageData, threshold) {
  const { data } = imageData;
  const softness = 0.08;

  for (let offset = 0; offset < data.length; offset += 4) {
    const score = pixelBackgroundScore(
      data[offset],
      data[offset + 1],
      data[offset + 2]
    );

    if (score >= threshold) {
      data[offset + 3] = 0;
    } else if (score > threshold - softness) {
      const alphaScale = (threshold - score) / softness;
      data[offset + 3] = Math.round(data[offset + 3] * alphaScale);
    }
  }

  return imageData;
}

export async function processYarnScanDataUrl(dataUrl, options = {}) {
  const threshold = clamp01(
    options.backgroundThreshold,
    DEFAULT_YARN_SCAN_TEXTURE.backgroundThreshold
  );
  const maxSize = normalizeTextureMaxSize(options.maxSize);
  const image = await loadImageFromDataUrl(dataUrl);
  const sourceCanvas = makeCanvas(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height
  );
  const sourceContext = sourceCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  sourceContext.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);

  const sourceData = sourceContext.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height
  );
  const bounds = findContentBounds(sourceData, threshold);
  const cropCanvas = makeCanvas(bounds.width, bounds.height);
  const cropContext = cropCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  cropContext.drawImage(
    sourceCanvas,
    bounds.left,
    bounds.top,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height
  );

  const cropData = cropContext.getImageData(
    0,
    0,
    cropCanvas.width,
    cropCanvas.height
  );
  cropContext.putImageData(applyBackgroundMask(cropData, threshold), 0, 0);

  const scale = Math.min(
    1,
    maxSize / Math.max(cropCanvas.width, cropCanvas.height)
  );
  const outputCanvas = makeCanvas(
    cropCanvas.width * scale,
    cropCanvas.height * scale
  );

  outputCanvas
    .getContext("2d")
    .drawImage(cropCanvas, 0, 0, outputCanvas.width, outputCanvas.height);

  return outputCanvas.toDataURL("image/png");
}

export async function processYarnScanFile(file, options = {}) {
  const dataUrl = await readFileAsDataUrl(file);
  const processedDataUrl = await processYarnScanDataUrl(dataUrl, options);

  return normalizeYarnTexture({
    ...DEFAULT_YARN_SCAN_TEXTURE,
    ...options,
    fileName: file?.name || "scan-yarn.png",
    dataUrl,
    processedDataUrl,
  });
}

export async function createTintedTextureCanvas(
  dataUrl,
  color,
  strength = DEFAULT_YARN_SCAN_TEXTURE.textureStrength
) {
  const image = await loadImageFromDataUrl(dataUrl);
  const canvas = makeCanvas(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height
  );
  const context = canvas.getContext("2d");

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = "source-atop";
  context.globalAlpha = clamp01(strength, 0.75) * 0.82;
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";

  return canvas;
}
