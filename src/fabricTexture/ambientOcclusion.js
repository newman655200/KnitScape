const wrap = (index, size) => ((index % size) + size) % size;

/**
 * Periodic height-field AO: 16 equally spaced physical xy directions, sampled
 * every min(dx,dy) mm up to 2*diameterMm, with nearest pixel height samples.
 * Empty neighbors use heightMinMm-diameterMm; empty origins return zero.
 * Returns one [0,1] Float64 AO value per top-down image pixel, without mutation.
 */
export function computeAmbientOcclusion(geometry, diameterMm) {
  if (!(Number.isFinite(diameterMm) && diameterMm > 0)) throw new RangeError("AO needs a positive diameter in mm.");
  const { width, height, dx, dy, heights, coverage, heightMinMm } = geometry;
  const ao = new Float64Array(width * height);
  const step = Math.min(dx, dy), reach = 2 * diameterMm;
  const background = heightMinMm - diameterMm;
  const rays = Array.from({ length: 16 }, (_, direction) => {
    const angle = 2 * Math.PI * direction / 16;
    const samples = [];
    let previousX = 0, previousY = 0;
    for (let distance = step; distance <= reach; distance += step) {
      const ox = Math.round(distance * Math.cos(angle) / dx);
      // Image row increases downward while physical y increases upward.
      const oy = -Math.round(distance * Math.sin(angle) / dy);
      if ((ox === 0 && oy === 0) || (ox === previousX && oy === previousY)) continue;
      previousX = ox;
      previousY = oy;
      samples.push([ox, oy, Math.hypot(ox * dx, oy * dy)]);
    }
    return samples;
  });
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const origin = row * width + column;
      if (!coverage[origin]) continue;
      let occlusion = 0;
      for (const ray of rays) {
        let maxSlope = 0;
        for (const [ox, oy, distance] of ray) {
          const neighbor = wrap(row + oy, height) * width + wrap(column + ox, width);
          const z = coverage[neighbor] ? heights[neighbor] : background;
          maxSlope = Math.max(maxSlope, (z - heights[origin]) / distance);
        }
        // sin(atan(maxSlope)), without a trigonometric call per pixel/sample.
        occlusion += maxSlope / Math.hypot(1, maxSlope);
      }
      ao[origin] = 1 - occlusion / 16;
    }
  }
  return ao;
}
