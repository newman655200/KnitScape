const normalize = v => { const n = Math.hypot(...v); return v.map(x => x / n); };
const light = normalize([-0.5, 0.6, 1]);
const half = normalize([light[0], light[1], light[2] + 1]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

/** The task's fixed diffuse/specular preview, composited over dark gray.
 * Only display shading; exported baseColor remains unlit. Nearest-neighbor tiling.
 */
export function createReviewImage(maps, copies = [4, 4]) {
  const sourceWidth = maps.baseColor.width, sourceHeight = maps.baseColor.height;
  const width = sourceWidth * copies[0], height = sourceHeight * copies[1];
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y % sourceHeight) * sourceWidth + x % sourceWidth;
    const color = Array.from(maps.baseColor.data.subarray(3 * i, 3 * i + 3), v => v / 255);
    const n = normalize(Array.from(maps.normal.data.subarray(3 * i, 3 * i + 3), v => 2 * v / 255 - 1));
    const rough = maps.roughness.data[i] / 255, metal = (maps.metallic?.data[i] ?? 0) / 255;
    const diffuse = maps.ambientOcclusion.data[i] / 255 * (0.25 + 0.75 * Math.max(0, dot(n, light)));
    const spec = 0.15 * (1 - rough) * Math.max(0, dot(n, half)) ** (8 + 120 * (1 - rough));
    const alpha = maps.opacity.data[i] / 255;
    for (let c = 0; c < 3; c++) {
      const shaded = color[c] * diffuse + spec * ((1 - metal) + color[c] * metal);
      data[(y * width + x) * 3 + c] = Math.round(255 * Math.min(1, Math.max(0, alpha * shaded + (1 - alpha) * 0.12)));
    }
  }
  return { width, height, channels: 3, bitDepth: 8, data };
}
