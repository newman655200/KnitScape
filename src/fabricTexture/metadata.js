/** Fixed T6a limitations: model predictions and appearance assumptions are not measurements. */
export const FABRIC_TEXTURE_LIMITATIONS = [
  "仅普通纬平针、单纱、全成圈（T1），无集圈、无氨纶；",
  "线圈尺寸是未标定预测：与 Hossain 2025 对照，横密偏高约 6%–14%、纵密偏高约 10%–12%；纱长变化时尺寸变化偏小；",
  "纱芯截面按直径 d_e 的圆处理，相邻纱线在模型里有轻微重叠，贴图按俯视最高面合并；",
  "纱线 PBR 贴图沿纱长的重复长度略作调整，使每个线圈恰好重复整数次；纱线 height 图未使用；",
  "毛羽是外观模型：生成毛羽的参数是假设值，不是实测；毛羽不改变高度图，也不参与受力；",
  "材料参数默认值是假设值，不是实测。",
];

/** Portable provenance: repository paths are relative; external paths are basenames.
 * repositoryRoot is supplied by the host, so this shared module performs no I/O.
 */
export function metadataPath(value, repositoryRoot) {
  if (value == null) return value;
  const name = String(value).replace(/\\/g, "/");
  if (!/^(?:[a-z]:\/|\/)/i.test(name)) return name.replace(/^\.\//, "");
  const root = repositoryRoot?.replace(/\\/g, "/").replace(/\/$/, "");
  if (root && name.toLowerCase().startsWith(root.toLowerCase() + "/")) return name.slice(root.length + 1);
  return name.split("/").filter(Boolean).at(-1);
}

function describeYarn(material, sourceMaterial, fiberDiameterMm, fuzzParameters, fuzz, repositoryRoot) {
  const maps = ["baseColor", "normal", "roughness", "ambientOcclusion", "metallic"];
  return { name: sourceMaterial.name ?? null, id: sourceMaterial.id ?? null,
    color: sourceMaterial.color ?? "#C08A5A",
    files: Object.fromEntries(Object.entries(sourceMaterial.files ?? {}).map(([key, file]) => [key, metadataPath(file, repositoryRoot)])),
    usedMaps: maps.filter(key => sourceMaterial[key]), height: "未使用",
    imageSizes: Object.fromEntries(maps.filter(key => sourceMaterial[key]).map(key =>
      [key, [sourceMaterial[key].width, sourceMaterial[key].height]])),
    coreBand: [...material.diagnostics.coreBand], fuzzBand: [...material.diagnostics.hairBand],
    fuzzBandMode: material.diagnostics.hairBandMode, rho: material.rho, repeatLengthMm: material.repeatLengthMm,
    repeatSource: material.repeatSource, adjustedRepeatLengthMm: material.adjustedRepeatLengthMm,
    normalGreen: material.normalGreen, roughnessSource: material.roughnessSource, diagnostics: material.diagnostics,
    fuzz: { ...fuzzParameters, fiberDiameterMm,
      faces: Object.fromEntries(Object.entries(fuzz ?? {}).map(([face, value]) => [face, value.diagnostics])) } };
}

/** Describe physical units, source result, map conventions and material diagnostics.
 * Timings are returned by the pipeline separately, never in deterministic metadata.
 */
export function createTextureMetadata({ result, geometry, composed, material, sourceMaterial, repeat,
  generatorVersion, generatedAt, sourceResultFile, fuzzParameters, fuzz, repositoryRoot }) {
  const { cell, params } = result, keys = ["tex", "densityGPerCm3", "fiberDiameterMm", "E_f", "K", "phi0"];
  const first = geometry.faces.technicalFace;
  return {
    schemaVersion: 1, generator: { name: "KnitScape fabricTexture", version: generatorVersion }, generatedAt,
    structure: { type: "plainJersey", m: cell.topology.m, n: cell.topology.n },
    input: { loopLengthMm: cell.topology.loopLengthMm, nodesPerLoop: cell.topology.nodesPerLoop,
      params: Object.fromEntries(keys.map(key => [key, params[key]])),
      provenance: Object.fromEntries(keys.map(key => [key, params.provenance[key]])) },
    solver: { status: result.status, optimizerStatus: result.optimizerStatus, iterations: result.iterations,
      W: cell.W, H: cell.H, S: cell.S, waleDensityPerCm: result.metrics.waleDensityPerCm,
      courseDensityPerCm: result.metrics.courseDensityPerCm, gsm: result.metrics.gsm,
      sourceResultFile: metadataPath(sourceResultFile, repositoryRoot) },
    texture: { repeat: [...repeat], physicalSizeMm: [repeat[0] * cell.W, repeat[1] * cell.H],
      pixelSize: [repeat[0] * first.width, repeat[1] * first.height],
      pixelsPerMm: [first.width / cell.W, first.height / cell.H] },
    conventions: { technicalFace: "Rotate (x,y,z) to (-x,y,-z), view from +z",
      technicalBack: "Unchanged coordinates, view from +z", image: "Row 0 is maximum y; +y points up",
      normal: "OpenGL +Y up; final visible hemisphere floor z=2/255; RGB=round((0.5*n+0.5)*255)",
      height: "16-bit grayscale big-endian; 0=heightMinMm, 65535=heightMaxMm; empty pixels=0; yarn core only" },
    yarn: describeYarn(material, sourceMaterial, params.fiberDiameterMm, fuzzParameters, fuzz, repositoryRoot),
    rendering: { crossSection: "circle", diameterMm: params.d_e, diameterProvenance: params.provenance.d_e,
      centerline: "centripetal Catmull-Rom alpha=0.5; interpolates every solver node",
      maximumSampleSpacingMm: params.d_e / 24, centerlineDiagnostics: geometry.centerline.diagnostics,
      ao: { directions: 16, radiusMm: 2 * params.d_e, emptyHeight: "heightMinMm - diameterMm" } },
    faces: Object.fromEntries(Object.entries(geometry.faces).map(([face, value]) => [face, {
      heightMinMm: value.heightMinMm, heightMaxMm: value.heightMaxMm, ...value.diagnostics,
      visibleHemisphere: { ...composed[face].diagnostics.visibleHemisphere },
      fuzz: fuzz?.[face]?.diagnostics,
    }])), limitations: [...FABRIC_TEXTURE_LIMITATIONS],
  };
}

/** Straight-yarn export uses a synthetic cylinder, without a physical solve. */
export function createYarnStripMetadata({ params, geometry, composed, material, sourceMaterial,
  fuzzParameters, fuzz, stripLengthMm, contentHeightMm, generatorVersion, generatedAt, repositoryRoot }) {
  const keys = ["tex", "densityGPerCm3", "fiberDiameterMm", "E_f", "K", "phi0"];
  return {
    schemaVersion: 1, generator: { name: "KnitScape fabricTexture", version: generatorVersion }, generatedAt,
    structure: { type: "straightYarnStrip", L_strip: stripLengthMm },
    input: { params: Object.fromEntries(keys.map(key => [key, params[key]])),
      provenance: Object.fromEntries(keys.map(key => [key, params.provenance[key]])) },
    physicalRepeatLengthMm: stripLengthMm,
    importInstruction: `导入纱线库后，在该纱线的“物理重复长度”里填 ${stripLengthMm} mm。`,
    texture: { physicalSizeMm: [geometry.W, geometry.H], pixelSize: [geometry.width, geometry.height],
      pixelsPerMm: [geometry.width / geometry.W, geometry.height / geometry.H], contentHeightMm,
      periodic: [true, false], transparentPadding: "content centered in 3x content height" },
    conventions: { view: "+z; yarn along +x; row 0 is maximum y", normal: "OpenGL +Y; visible hemisphere floor z=2/255",
      height: "8-bit core-only height; 0=heightMinMm, 255=heightMaxMm; empty and fuzz-only pixels=0",
      heightMinMm: composed.heightMinMm, heightMaxMm: composed.heightMaxMm },
    yarn: describeYarn(material, sourceMaterial, params.fiberDiameterMm, fuzzParameters, { yarn: fuzz }, repositoryRoot),
    rendering: { crossSection: "circle", diameterMm: params.d_e, diameterProvenance: params.provenance.d_e,
      centerline: "straight +x", ao: { directions: 16, radiusMm: 2 * params.d_e } },
    diagnostics: { ...geometry.diagnostics, visibleHemisphere: composed.diagnostics.visibleHemisphere, fuzz: fuzz.diagnostics },
    limitations: [...FABRIC_TEXTURE_LIMITATIONS],
  };
}
