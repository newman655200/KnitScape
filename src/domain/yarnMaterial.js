import { normalizeYarnTexture, YARN_PBR_MAP_KEYS } from "../yarnTexture/yarnScanTexture.js";

const hasColor = value => typeof value === "string" && value.trim().length > 0;
const hasDiameter = value => Number.isFinite(value) && value > 0;
const hasMap = map => Boolean(map?.assetRef || map?.processedDataUrl || map?.dataUrl);

// Asset identity owns material; Feed length/tension/placement never enter it.
// A partial Asset PBR group uses neutral defaults for missing maps. With no
// Asset maps, retain the legacy scan/PBR behavior, independently of color/width.
export function resolveYarnMaterial({ yarnAsset, legacyContext = {} } = {}) {
  const source = {};
  function field(key, valid, fallback) {
    source[key] = valid(yarnAsset?.[key]) ? "ASSET"
      : valid(legacyContext[key]) ? "LEGACY_FALLBACK" : "DEFAULT";
    return source[key] === "ASSET" ? yarnAsset[key]
      : source[key] === "LEGACY_FALLBACK" ? legacyContext[key] : fallback;
  }
  const color = field("color", hasColor, "rgba(190,190,190,1)");
  const diameter = field("diameter", hasDiameter, 0.24);
  // Callers supply the legacy primary (first active ply). This identifies the
  // immediate software source, not its measurement history or physical validity.
  const diameterSource = source.diameter === "ASSET" ? "ASSET_EXPLICIT"
    : source.diameter === "LEGACY_FALLBACK" ? "LEGACY_PRIMARY" : "DEFAULT_COMPATIBILITY";
  // Geometry uses needlePitch=1 and offsets by diameter/2; never a raw mm value.
  const diameterUnit = "MODEL_NEEDLE_PITCH";
  const assetMaps = YARN_PBR_MAP_KEYS.some(key => hasMap(yarnAsset?.pbr?.[key]));
  let texture = normalizeYarnTexture(assetMaps
    ? { pbr: yarnAsset.pbr, textureStrength: 1, useOriginalColor: true }
    : legacyContext.texture);
  const pbr = Object.fromEntries(YARN_PBR_MAP_KEYS.map(key => {
    const map = texture?.pbr?.[key] ?? null;
    source[key] = hasMap(map) ? (assetMaps ? "ASSET" : "LEGACY_FALLBACK") : "DEFAULT";
    return [key, map];
  }));
  const assetRepeat = yarnAsset?.pbr?.physicalRepeatLengthMm;
  const legacyRepeat = texture?.pbr?.physicalRepeatLengthMm;
  const repeat = hasDiameter(assetRepeat) ? assetRepeat : !assetMaps && hasDiameter(legacyRepeat) ? legacyRepeat : undefined;
  source.physicalRepeatLengthMm = hasDiameter(assetRepeat) ? "ASSET"
    : repeat !== undefined ? "LEGACY_FALLBACK" : "DEFAULT";
  if (repeat !== undefined) {
    pbr.physicalRepeatLengthMm = repeat;
    texture = texture ? { ...texture, pbr } : normalizeYarnTexture({ pbr });
  }
  return { color, diameter, diameterSource, diameterUnit, pbr, texture, source };
}
