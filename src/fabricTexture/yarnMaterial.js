import { boxPrefilter } from "./boxPrefilter.js";

const MAP_KEYS = ["baseColor", "normal", "roughness", "ambientOcclusion", "metallic"];
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const wrap = (value, period) => ((value % period) + period) % period;

// CSS named colors are sRGB values; environment-dependent colors such as
// currentColor and system colors require a caller to resolve them first.
const NAMED_COLORS = Object.fromEntries(`
aliceblue:f0f8ff antiquewhite:faebd7 aqua:00ffff aquamarine:7fffd4 azure:f0ffff
beige:f5f5dc bisque:ffe4c4 black:000000 blanchedalmond:ffebcd blue:0000ff blueviolet:8a2be2 brown:a52a2a burlywood:deb887
cadetblue:5f9ea0 chartreuse:7fff00 chocolate:d2691e coral:ff7f50 cornflowerblue:6495ed cornsilk:fff8dc crimson:dc143c cyan:00ffff
darkblue:00008b darkcyan:008b8b darkgoldenrod:b8860b darkgray:a9a9a9 darkgrey:a9a9a9 darkgreen:006400 darkkhaki:bdb76b darkmagenta:8b008b darkolivegreen:556b2f darkorange:ff8c00 darkorchid:9932cc darkred:8b0000 darksalmon:e9967a darkseagreen:8fbc8f darkslateblue:483d8b darkslategray:2f4f4f darkslategrey:2f4f4f darkturquoise:00ced1 darkviolet:9400d3
deeppink:ff1493 deepskyblue:00bfff dimgray:696969 dimgrey:696969 dodgerblue:1e90ff
firebrick:b22222 floralwhite:fffaf0 forestgreen:228b22 fuchsia:ff00ff gainsboro:dcdcdc ghostwhite:f8f8ff gold:ffd700 goldenrod:daa520 gray:808080 grey:808080 green:008000 greenyellow:adff2f honeydew:f0fff0 hotpink:ff69b4 indianred:cd5c5c indigo:4b0082 ivory:fffff0 khaki:f0e68c lavender:e6e6fa lavenderblush:fff0f5 lawngreen:7cfc00 lemonchiffon:fffacd
lightblue:add8e6 lightcoral:f08080 lightcyan:e0ffff lightgoldenrodyellow:fafad2 lightgray:d3d3d3 lightgrey:d3d3d3 lightgreen:90ee90 lightpink:ffb6c1 lightsalmon:ffa07a lightseagreen:20b2aa lightskyblue:87cefa lightslategray:778899 lightslategrey:778899 lightsteelblue:b0c4de lightyellow:ffffe0
lime:00ff00 limegreen:32cd32 linen:faf0e6 magenta:ff00ff maroon:800000
mediumaquamarine:66cdaa mediumblue:0000cd mediumorchid:ba55d3 mediumpurple:9370db mediumseagreen:3cb371 mediumslateblue:7b68ee mediumspringgreen:00fa9a mediumturquoise:48d1cc mediumvioletred:c71585 midnightblue:191970 mintcream:f5fffa mistyrose:ffe4e1 moccasin:ffe4b5 navajowhite:ffdead navy:000080 oldlace:fdf5e6 olive:808000 olivedrab:6b8e23 orange:ffa500 orangered:ff4500 orchid:da70d6 palegoldenrod:eee8aa palegreen:98fb98 paleturquoise:afeeee palevioletred:db7093 papayawhip:ffefd5 peachpuff:ffdab9 peru:cd853f pink:ffc0cb plum:dda0dd powderblue:b0e0e6 purple:800080 rebeccapurple:663399 red:ff0000 rosybrown:bc8f8f royalblue:4169e1 saddlebrown:8b4513 salmon:fa8072 sandybrown:f4a460 seagreen:2e8b57 seashell:fff5ee sienna:a0522d silver:c0c0c0 skyblue:87ceeb slateblue:6a5acd slategray:708090 slategrey:708090 snow:fffafa springgreen:00ff7f steelblue:4682b4 tan:d2b48c teal:008080 thistle:d8bfd8 tomato:ff6347 turquoise:40e0d0 violet:ee82ee wheat:f5deb3 white:ffffff whitesmoke:f5f5f5 yellow:ffff00 yellowgreen:9acd32
`.trim().split(/\s+/).map(entry => entry.split(":")));

function cssNumber(token, scale = 1) {
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?%?$/i.test(token)) return NaN;
  return Number(token.replace(/%$/, "")) / (token.endsWith("%") ? 100 : scale);
}

function hueDegrees(token) {
  const match = token.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(deg|rad|grad|turn)?$/);
  if (!match) return NaN;
  return Number(match[1]) * ({ deg: 1, rad: 180 / Math.PI, grad: 0.9, turn: 360 }[match[2] || "deg"]);
}

function hueRgb(hue) {
  const h = wrap(hue, 360) / 60;
  return [0, 4, 2].map(offset => clamp(Math.abs(wrap(h + offset, 6) - 3) - 1));
}

/** Parse portable CSS sRGB colors without a DOM. Alpha does not change core coverage. */
function parseColor(value) {
  let source = String(value).trim().toLowerCase();
  if (source === "transparent") return [0, 0, 0];
  if (NAMED_COLORS[source]) source = `#${NAMED_COLORS[source]}`;
  if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(source)) {
    let hex = source.slice(1);
    if (hex.length < 5) hex = [...hex].map(c => c + c).join("");
    return [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  }
  const match = source.match(/^(rgb|rgba|hsl|hsla|hwb)\(([^()]*)\)$/);
  if (match) {
    const tokens = match[2].trim().split(/[\s,/]+/);
    const alpha = tokens.length === 4 ? cssNumber(tokens[3]) : 1;
    if ((tokens.length === 3 || tokens.length === 4) && Number.isFinite(alpha)) {
      if (match[1].startsWith("rgb")) {
        const channels = tokens.slice(0, 3).map(token => cssNumber(token, 255));
        if (channels.every(Number.isFinite)) return channels.map(value => clamp(value));
      } else {
        const hue = hueDegrees(tokens[0]);
        const a = cssNumber(tokens[1]), b = cssNumber(tokens[2]);
        if (Number.isFinite(hue) && Number.isFinite(a) && Number.isFinite(b)
            && tokens[1].endsWith("%") && tokens[2].endsWith("%")) {
          const first = clamp(a), second = clamp(b), rgb = hueRgb(hue);
          if (match[1] === "hwb") {
            if (first + second >= 1) return [1, 1, 1].map(() => first / (first + second));
            return rgb.map(channel => channel * (1 - first - second) + first);
          }
          const chroma = (1 - Math.abs(2 * second - 1)) * first;
          return rgb.map(channel => channel * chroma + second - chroma / 2);
        }
      }
    }
  }
  throw new TypeError(`Unsupported yarn color ${JSON.stringify(value)}; use hex, a CSS named color, rgb(), hsl(), or hwb(). Resolve CSS Color 4 or context-dependent colors before baking.`);
}

function validateImage(image, key) {
  if (!image) return null;
  const { width, height, channels, data } = image;
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1
      || ![1, 2, 3, 4].includes(channels)
      || !(data instanceof Uint8Array || data instanceof Uint8ClampedArray)
      || data.length !== width * height * channels) {
    throw new TypeError(`${key} must contain width, height, channels and matching 8-bit pixels`);
  }
  if (key === "normal" && channels < 3) throw new TypeError("normal requires RGB or RGBA pixels");
  return image;
}

const hasAlpha = image => Boolean(image && (image.channels === 2 || image.channels === 4));
const pixelAlpha = (image, index) => hasAlpha(image) ? image.data[index + image.channels - 1] / 255 : 1;
const pixelColor = (image, index, channel) => image.data[index + (image.channels < 3 ? 0 : channel)] / 255;

function alphaBands(image) {
  if (!hasAlpha(image)) return { core: [0, 1], fullScan: [0, 1], empty: false };
  const rows = new Float64Array(image.height);
  let maximum = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) rows[y] += pixelAlpha(image, (y * image.width + x) * image.channels) / image.width;
    maximum = Math.max(maximum, rows[y]);
  }
  if (maximum === 0) return { core: [0, 1], fullScan: [0, 1], empty: true };
  const band = fraction => {
    let start = 0, end = image.height - 1;
    while (rows[start] < maximum * fraction) start++;
    while (rows[end] < maximum * fraction) end--;
    // Bounds are pixel edges, so a single opaque row retains a nonzero width.
    return [start / image.height, (end + 1) / image.height];
  };
  return { core: band(0.5), fullScan: band(0.001), empty: false };
}

function meanColor(image, core, fallback) {
  if (!image) return fallback.slice();
  const color = [0, 0, 0];
  let mass = 0;
  for (let y = 0; y < image.height; y++) {
    if ((y + 0.5) / image.height < core[0] || (y + 0.5) / image.height > core[1]) continue;
    for (let x = 0; x < image.width; x++) {
      const index = (y * image.width + x) * image.channels, alpha = pixelAlpha(image, index);
      mass += alpha;
      for (let channel = 0; channel < 3; channel++) color[channel] += alpha * pixelColor(image, index, channel);
    }
  }
  return mass > 0 ? color.map(value => value / mass) : fallback.slice();
}

function meanScalar(image, fallback) {
  if (!image) return fallback;
  let sum = 0;
  for (let index = 0; index < image.data.length; index += image.channels) sum += image.data[index] / 255;
  return sum / (image.width * image.height);
}

function boundaries(image) {
  const { width, height, channels, data } = image;
  let edgeU = 0, innerU = 0, edgeV = 0, innerV = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let c = 0; c < channels; c++) {
    const i = (y * width + x) * channels + c;
    if (x === 0) edgeU += Math.abs(data[i] - data[i + (width - 1) * channels]);
    else innerU += Math.abs(data[i] - data[i - channels]);
    if (y === 0) edgeV += Math.abs(data[i] - data[i + (height - 1) * width * channels]);
    else innerV += Math.abs(data[i] - data[i - width * channels]);
  }
  return {
    unit: "8-bit channel value",
    firstLastColumnsMean: edgeU / (height * channels),
    adjacentColumnsMean: width > 1 ? innerU / ((width - 1) * height * channels) : 0,
    firstLastRowsMean: edgeV / (width * channels),
    adjacentRowsMean: height > 1 ? innerV / ((height - 1) * width * channels) : 0,
  };
}

function normalDetails(image, normalGreen) {
  if (!image) return { table: null, maxAngle: 0 };
  const { width, height, channels, data } = image;
  const table = { width, height, channels: 3, data: new Float64Array(width * height * 3) };
  const greenSign = normalGreen === "-Y" ? -1 : 1;
  let maxAngle = 0;
  for (let y = 0; y < height; y++) {
    const mean = [0, 0, 0];
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * channels;
      mean[0] += 2 * data[offset] / 255 - 1;
      mean[1] += greenSign * (2 * data[offset + 1] / 255 - 1);
      mean[2] += 2 * data[offset + 2] / 255 - 1;
    }
    const magnitude = Math.hypot(...mean);
    const p = magnitude > 1e-15 ? mean.map(value => value / magnitude) : [0, 0, 1];
    maxAngle = Math.max(maxAngle, Math.acos(clamp(p[2], -1, 1)));
    // Rodrigues' minimum rotation from p to +z. For antipodal p, choose +x.
    const axisLength = Math.hypot(p[0], p[1]);
    const axis = axisLength > 1e-15 ? [p[1] / axisLength, -p[0] / axisLength, 0] : [1, 0, 0];
    const cos = p[2], sin = axisLength;
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * channels;
      const n = [2 * data[offset] / 255 - 1, greenSign * (2 * data[offset + 1] / 255 - 1), 2 * data[offset + 2] / 255 - 1];
      const dot = axis[0] * n[0] + axis[1] * n[1];
      const cross = [axis[1] * n[2], -axis[0] * n[2], axis[0] * n[1] - axis[1] * n[0]];
      for (let c = 0; c < 3; c++) table.data[(y * width + x) * 3 + c] = n[c] * cos + cross[c] * sin + axis[c] * dot * (1 - cos);
    }
  }
  return { table, maxAngle };
}

function aoDetails(image) {
  if (!image) return null;
  const table = { width: image.width, height: image.height, channels: 1, data: new Float64Array(image.width * image.height) };
  for (let y = 0; y < image.height; y++) {
    let mean = 0;
    for (let x = 0; x < image.width; x++) mean += image.data[(y * image.width + x) * image.channels] / image.width;
    for (let x = 0; x < image.width; x++) {
      // An entirely black row has no along-yarn variation to preserve.
      table.data[y * image.width + x] = mean > 0 ? clamp(image.data[(y * image.width + x) * image.channels] / mean) : 1;
    }
  }
  return table;
}

/** Bilinear sampling at texel centers: horizontal periodicity, vertical clamping. */
function sample(image, u, v, channel, scale = 1) {
  const x = wrap(u, 1) * image.width - 0.5;
  const y = clamp(v) * image.height - 0.5;
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
  const read = (dx, dy) => image.data[(clamp(iy + dy, 0, image.height - 1) * image.width + wrap(ix + dx, image.width)) * image.channels + channel] / scale;
  return (read(0, 0) * (1 - tx) + read(1, 0) * tx) * (1 - ty)
    + (read(0, 1) * (1 - tx) + read(1, 1) * tx) * ty;
}

/**
 * Prepare 8-bit yarn maps for physical-arc-length sampling without DOM or I/O.
 * diameterMm is the model core diameter; lengthMm is the sampled spline length.
 * Neither is inferred from the image. Metadata labels the aspect-based repeat
 * as derived, and the untextured roughness 0.8 as an appearance assumption.
 * Optional pxPerMm sets the output sampling footprint. Original pixels still
 * determine bands, mean material values and repeat length; only sampling tables
 * are box-filtered. Omitting it, or using 1 x 1 windows, preserves old sampling.
 */
export function normalizeYarnMaterial(input = {}, { diameterMm, lengthMm, pxPerMm } = {}) {
  if (!(Number.isFinite(diameterMm) && diameterMm > 0 && Number.isFinite(lengthMm) && lengthMm > 0)) {
    throw new RangeError("diameterMm and lengthMm must be finite positive millimeter lengths");
  }
  if (pxPerMm !== undefined && !(Number.isFinite(pxPerMm) && pxPerMm > 0)) {
    throw new RangeError("pxPerMm must be finite and positive when provided");
  }
  const normalGreen = input.normalGreen ?? "+Y";
  if (!["+Y", "-Y"].includes(normalGreen)) throw new RangeError("normalGreen must be +Y or -Y");
  const color = input.color ?? "#C08A5A", fallbackColor = parseColor(color);
  const images = Object.fromEntries(MAP_KEYS.map(key => [key, validateImage(input[key], key)]));
  const bands = alphaBands(images.baseColor), [cMin, cMax] = bands.core;
  const hairBandMode = input.fuzzBand ?? "fullScan";
  if (!["vRange", "fullScan"].includes(hairBandMode)) throw new RangeError("fuzzBand must be vRange or fullScan");
  const band = hairBandMode === "vRange" ? (input.vRange ?? [0, 1]) : bands.fullScan;
  if (!Array.isArray(band) || band.length !== 2 || !band.every(Number.isFinite) || band[0] < 0 || band[1] > 1 || band[0] >= band[1]) {
    throw new RangeError("vRange must contain increasing values in [0, 1]");
  }
  const center = (cMin + cMax) / 2, halfCore = (cMax - cMin) / 2;
  const rawRho = Math.max(center - band[0], band[1] - center) / halfCore;
  const rho = Math.min(8, rawRho), hMin = Math.max(band[0], center - rho * halfCore), hMax = Math.min(band[1], center + rho * halfCore);
  const aspectMap = MAP_KEYS.find(key => images[key]) ?? null;
  const reference = images[aspectMap];
  const suppliedRepeat = input.physicalRepeatLengthMm;
  if (suppliedRepeat !== undefined && !(Number.isFinite(suppliedRepeat) && suppliedRepeat > 0)) {
    throw new RangeError("physicalRepeatLengthMm must be a finite positive millimeter length");
  }
  const repeatSource = suppliedRepeat !== undefined ? "ASSET" : reference ? "DERIVED_FROM_ASPECT" : "NOT_APPLICABLE";
  const repeatLengthMm = suppliedRepeat ?? (reference ? diameterMm * reference.width / (reference.height * (cMax - cMin)) : lengthMm);
  const repeatCount = Math.max(1, Math.round(lengthMm / repeatLengthMm));
  const adjustedRepeatLengthMm = lengthMm / repeatCount;
  const averageColor = meanColor(images.baseColor, bands.core, fallbackColor);
  const normal = normalDetails(images.normal, normalGreen);
  const ao = aoDetails(images.ambientOcclusion);
  const samplingImages = { ...images }, filterMaps = {};
  for (const key of MAP_KEYS) if (images[key]) {
    const image = images[key];
    const k_U = pxPerMm === undefined ? 1 : image.width / (adjustedRepeatLengthMm * pxPerMm);
    const k_V = pxPerMm === undefined ? 1 : image.height * (cMax - cMin) / (diameterMm * pxPerMm);
    const f_U = Math.max(1, Math.round(k_U)), f_V = Math.max(1, Math.round(k_V));
    if (![f_U, f_V].every(value => Number.isSafeInteger(value) && value >= 1)) {
      throw new RangeError("Output resolution produces an unsupported box filter window");
    }
    filterMaps[key] = { k_U, k_V, f_U, f_V };
    // Normal and AO are filtered after removing their row profiles below.
    if (key !== "normal" && key !== "ambientOcclusion") samplingImages[key] = boxPrefilter(image, f_U, f_V);
  }
  const filterDetail = (table, key) => table
    ? boxPrefilter(table, filterMaps[key].f_U, filterMaps[key].f_V) : null;
  const prefilter = { method: "boxPrefilter", enabled: pxPerMm !== undefined,
    ...(filterMaps[aspectMap] ?? { k_U: 1, k_V: 1, f_U: 1, f_V: 1 }), maps: filterMaps };
  const imageSizes = {}, mapBoundaries = {}, mapAnisotropy = {};
  for (const key of MAP_KEYS) if (images[key]) {
    const { width, height, channels } = images[key];
    imageSizes[key] = { width, height, channels };
    mapBoundaries[key] = boundaries(images[key]);
    mapAnisotropy[key] = (adjustedRepeatLengthMm / width) / (diameterMm / (height * (cMax - cMin)));
  }
  const anisotropy = aspectMap ? mapAnisotropy[aspectMap] : null;
  const roughnessSource = images.roughness ? "ASSET" : "ASSUMPTION";
  const diagnostics = {
    color, usedMaps: MAP_KEYS.filter(key => images[key]), imageSizes, mapBoundaries,
    coreBand: [cMin, cMax], hairBandMode, hairBand: [hMin, hMax], rawHairBand: [...band],
    hasAlpha: hasAlpha(images.baseColor), emptyAlpha: bands.empty, rho, rawRho, rhoTruncated: rawRho > 8,
    repeatLengthMm, adjustedRepeatLengthMm, repeatCount, repeatSource, aspectMap,
    normalGreen, normalProfileMaxAngleDeg: normal.maxAngle * 180 / Math.PI,
    anisotropy, mapAnisotropy, anisotropyWarning: anisotropy !== null && (anisotropy > 2 || anisotropy < 0.5),
    roughnessSource, height: "NOT_USED", averageColor, prefilter,
  };
  return {
    color, fallbackColor, images, samplingImages, cMin, cMax, hMin, hMax, rho, diameterMm, lengthMm,
    repeatLengthMm, adjustedRepeatLengthMm, repeatSource, repeatCount, normalGreen,
    normalDetail: filterDetail(normal.table, "normal"), aoDetail: filterDetail(ao, "ambientOcclusion"),
    averageColor, averageRoughness: meanScalar(images.roughness, 0.8), averageMetallic: meanScalar(images.metallic, 0),
    roughnessSource, hasMetallic: Boolean(images.metallic), diagnostics,
  };
}

/** Sample a core point: s is arc length in mm, w is signed transverse radius. */
export function sampleYarnMaterial(material, s, w) {
  const u = s / material.adjustedRepeatLengthMm;
  const v = (material.cMin + material.cMax) / 2 + (material.cMax - material.cMin) * w / 2;
  const images = material.samplingImages ?? material.images;
  let color = material.fallbackColor.slice();
  if (images.baseColor) {
    const image = images.baseColor;
    const alpha = hasAlpha(image) ? sample(image, u, v, image.channels - 1, 255) : 1;
    color = [0, 1, 2].map(c => alpha * sample(image, u, v, image.channels < 3 ? 0 : c, 255) + (1 - alpha) * material.averageColor[c]);
  }
  return {
    color,
    normalDetail: material.normalDetail ? [0, 1, 2].map(c => sample(material.normalDetail, u, v, c)) : [0, 0, 1],
    roughness: images.roughness ? sample(images.roughness, u, v, 0, 255) : 0.8,
    ambientOcclusion: material.aoDetail ? sample(material.aoDetail, u, v, 0) : 1,
    metallic: images.metallic ? sample(images.metallic, u, v, 0, 255) : 0,
  };
}

/**
 * Sample scan-fuzz texels at s (mm) and signed transverse distance delta/r.
 * Unlike core color, scan RGB remains unpremultiplied and is not filled with
 * the core mean when alpha is low. Uses the same filtered tables and UVs.
 */
export function sampleYarnFuzzMaterial(material, s, transverse) {
  const u = s / material.adjustedRepeatLengthMm;
  const v = (material.cMin + material.cMax) / 2 + (material.cMax - material.cMin) * transverse / 2;
  const images = material.samplingImages ?? material.images;
  const image = images.baseColor;
  return {
    color: image ? [0, 1, 2].map(c => sample(image, u, v, image.channels < 3 ? 0 : c, 255)) : material.fallbackColor.slice(),
    alpha: hasAlpha(image) ? sample(image, u, v, image.channels - 1, 255) : 1,
    roughness: images.roughness ? sample(images.roughness, u, v, 0, 255) : 0.8,
    metallic: images.metallic ? sample(images.metallic, u, v, 0, 255) : 0,
  };
}
