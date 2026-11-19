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

const YARN_RATIO = 0.24;

export function normalizeYarnPlies(yarnPlies, palette) {
  const fallbackColor = palette?.[0] || "rgba(190,190,190,1)";
  const source =
    Array.isArray(yarnPlies) && yarnPlies.length
      ? yarnPlies
      : [
          {
            color: fallbackColor,
            diameter: YARN_RATIO,
            enabled: true,
            texture: null,
          },
        ];

  const normalized = source
    .filter((ply) => ply?.enabled !== false)
    .map((ply) => ({
      color: ply.color || fallbackColor,
      diameter:
        Number.isFinite(Number(ply.diameter)) && Number(ply.diameter) > 0
          ? Number(ply.diameter)
          : YARN_RATIO,
      texture: normalizeYarnTexture(ply.texture),
    }));

  return normalized.length
    ? normalized
    : [
        {
          color: fallbackColor,
          diameter: YARN_RATIO,
          texture: null,
        },
      ];
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

// Numerical material dependencies only. Appearance and asset identity remain
// available to the shared drawing resolver without invalidating solved paths.
export function yarnMaterialGeometryKey({ yarnPlies, yarnPalette, yarnLibrary, singleJerseyCamProgram }) {
  const primary = normalizeYarnPlies(yarnPlies, yarnPalette)[0];
  const materials = resolveFeedYarnPlies(singleJerseyCamProgram?.feeds, yarnLibrary, primary);
  return JSON.stringify({
    lengthScaleY: Math.min(1.1, Math.max(0.9, Number(yarnPlies?.[0]?.lengthScaleY) || 1)),
    diameters: materials.size ? [...materials.values()].map(plies => plies.map(ply => ply.diameter)) : [primary.diameter],
  });
}

