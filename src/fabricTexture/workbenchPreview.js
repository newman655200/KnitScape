import { createReviewImage } from "./review.js";

/** Display-only nearest-neighbor reduction. Shade one unit using the shared
 * review function, then copy its pixels for tiling. Export maps stay untouched.
 */
export function createWorkbenchPreview(maps, copies, { maxWidth = 1024, maxHeight = 768 } = {}) {
  const sourceWidth = maps.baseColor.width, sourceHeight = maps.baseColor.height;
  const scale = Math.min(1, maxWidth / (sourceWidth * copies[0]), maxHeight / (sourceHeight * copies[1]));
  const unitWidth = Math.max(1, Math.floor(sourceWidth * scale));
  const unitHeight = Math.max(1, Math.floor(sourceHeight * scale));
  let displayMaps = maps;
  if (unitWidth !== sourceWidth || unitHeight !== sourceHeight) {
    displayMaps = {};
    for (const key of ["baseColor", "normal", "roughness", "metallic", "ambientOcclusion", "opacity"]) {
      const map = maps[key];
      if (!map) continue;
      const data = new map.data.constructor(unitWidth * unitHeight * map.channels);
      for (let y = 0; y < unitHeight; y++) for (let x = 0; x < unitWidth; x++) {
        const sourceX = Math.min(sourceWidth - 1, Math.floor((x + 0.5) * sourceWidth / unitWidth));
        const sourceY = Math.min(sourceHeight - 1, Math.floor((y + 0.5) * sourceHeight / unitHeight));
        const from = (sourceY * sourceWidth + sourceX) * map.channels;
        data.set(map.data.subarray(from, from + map.channels), (y * unitWidth + x) * map.channels);
      }
      displayMaps[key] = { ...map, width: unitWidth, height: unitHeight, data };
    }
  }
  const unit = createReviewImage(displayMaps, [1, 1]);
  const width = unitWidth * copies[0], height = unitHeight * copies[1];
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const row = unit.data.subarray((y % unitHeight) * unitWidth * 3, (y % unitHeight + 1) * unitWidth * 3);
    for (let x = 0; x < copies[0]; x++) data.set(row, (y * width + x * unitWidth) * 3);
  }
  return { width, height, channels: 3, bitDepth: 8, data };
}
