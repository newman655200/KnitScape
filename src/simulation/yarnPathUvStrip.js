import { samplePathData } from "./yarnPathSampler.js";
import { DEFAULT_MACHINE_GAUGE, gaugeToNeedlePitchMm } from "./yarnLengthMetrics.js";

const DEFAULT_TEXTURE_REPEAT_LENGTH = 48;
const DEFAULT_SAMPLE_SPACING = 3;
const DEFAULT_MAX_POINTS_PER_PATH = 1200;

export function buildYarnUvPathOffsets(yarnPathLinks, modelPathByLink) {
  const offsets = new Map();
  let totalLength = 0;
  for (const link of yarnPathLinks) {
    const pathData = modelPathByLink.get(link.index);
    offsets.set(link.index, totalLength);
    if (pathData) totalLength += samplePathData(pathData,
      { spacing: Infinity, curveSteps: 1 }).at(-1)?.u || 0;
  }
  return offsets;
}

export function buildYarnUvStrip({
  pathData,
  modelPathData = pathData,
  modelToCanvasPoint = point => point,
  arcLengthOffset = 0,
  normalOffsetModel = 0,
  yarnWidth,
  textureRepeatLength = DEFAULT_TEXTURE_REPEAT_LENGTH,
  physicalRepeatLengthMm,
  machineGauge = DEFAULT_MACHINE_GAUGE,
  sampleSpacing = DEFAULT_SAMPLE_SPACING,
  maxPoints = DEFAULT_MAX_POINTS_PER_PATH,
}) {
  const sampled = samplePathData(modelPathData, {
    spacing: sampleSpacing,
    maxPoints,
  });

  const positions = [];
  const uvs = [];
  const indices = [];
  const halfWidth = Math.max(0, Number(yarnWidth) || 0) / 2;
  const repeat = Math.max(1, Number(textureRepeatLength) || 1);
  const physicalRepeat = Number.isFinite(physicalRepeatLengthMm) && physicalRepeatLengthMm > 0;
  const needlePitchMm = physicalRepeat ? gaugeToNeedlePitchMm(machineGauge) : null;
  const offset = Number.isFinite(normalOffsetModel) ? normalOffsetModel : 0;

  sampled.forEach((point) => {
    // Placement affects only displayed positions, never the Solver centerline or U.
    const placed = offset === 0 ? point : { ...point,
      x: point.x + point.normalX * offset, y: point.y + point.normalY * offset };
    const center = modelToCanvasPoint(placed);
    const normalEnd = modelToCanvasPoint({ ...placed,
      x: placed.x + point.normalX, y: placed.y + point.normalY });
    const normalLength = Math.hypot(normalEnd.x - center.x, normalEnd.y - center.y) || 1;
    const normalX = (normalEnd.x - center.x) / normalLength;
    const normalY = (normalEnd.y - center.y) / normalLength;
    const leftX = center.x - normalX * halfWidth;
    const leftY = center.y - normalY * halfWidth;
    const rightX = center.x + normalX * halfWidth;
    const rightY = center.y + normalY * halfWidth;
    const u = physicalRepeat
      ? (arcLengthOffset + point.u) * needlePitchMm / physicalRepeatLengthMm
      : (arcLengthOffset + point.u) / repeat;

    positions.push(leftX, leftY, rightX, rightY);
    uvs.push(u, 0, u, 1);
  });

  for (let i = 0; i < sampled.length - 1; i += 1) {
    const base = i * 2;
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
    pointCount: sampled.length,
    totalModelLength: sampled.at(-1)?.u || 0,
  };
}
