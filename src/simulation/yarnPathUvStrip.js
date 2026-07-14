import { samplePathData } from "./yarnPathSampler.js";

const DEFAULT_TEXTURE_REPEAT_LENGTH = 48;
const DEFAULT_SAMPLE_SPACING = 3;
const DEFAULT_MAX_POINTS_PER_PATH = 1200;

export function buildYarnUvStrip({
  pathData,
  yarnWidth,
  textureRepeatLength = DEFAULT_TEXTURE_REPEAT_LENGTH,
  sampleSpacing = DEFAULT_SAMPLE_SPACING,
  maxPoints = DEFAULT_MAX_POINTS_PER_PATH,
}) {
  const sampled = samplePathData(pathData, {
    spacing: sampleSpacing,
  }).slice(0, maxPoints);

  const positions = [];
  const uvs = [];
  const indices = [];
  const halfWidth = Math.max(0, Number(yarnWidth) || 0) / 2;
  const repeat = Math.max(1, Number(textureRepeatLength) || 1);

  sampled.forEach((point) => {
    const leftX = point.x - point.normalX * halfWidth;
    const leftY = point.y - point.normalY * halfWidth;
    const rightX = point.x + point.normalX * halfWidth;
    const rightY = point.y + point.normalY * halfWidth;
    const u = point.u / repeat;

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
  };
}
