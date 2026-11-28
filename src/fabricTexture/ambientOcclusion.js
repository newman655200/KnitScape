const wrap = (index, size) => ((index % size) + size) % size;

/**
 * Periodic height-field AO: 16 equally spaced physical xy directions, sampled
 * every min(dx,dy) mm up to 2*diameterMm, with nearest pixel height samples.
 * Horizon angles are relative to the yarn-core geometric tangent plane.
 * Empty neighbors use heightMinMm-diameterMm; empty origins return zero.
 * Returns one [0,1] Float64 AO value per top-down image pixel, without mutation.
 */
export function computeAmbientOcclusion(geometry, diameterMm) {
  if (!(Number.isFinite(diameterMm) && diameterMm > 0)) throw new RangeError("AO needs a positive diameter in mm.");
  const { width, height, dx, dy, heights, normals, coverage, heightMinMm } = geometry;
  const ao = new Float64Array(width * height);
  const step = Math.min(dx, dy), reach = 2 * diameterMm;
  const background = heightMinMm - diameterMm;
  const rays = Array.from({ length: 16 }, (_, direction) => {
    const angle = 2 * Math.PI * direction / 16;
    const c = Math.cos(angle), s = Math.sin(angle);
    const samples = [];
    let previousX = 0, previousY = 0;
    for (let distance = step; distance <= reach; distance += step) {
      const ox = Math.round(distance * c / dx);
      // Image row increases downward while physical y increases upward.
      const oy = -Math.round(distance * s / dy);
      if ((ox === 0 && oy === 0) || (ox === previousX && oy === previousY)) continue;
      previousX = ox;
      previousY = oy;
      samples.push([ox, oy, Math.hypot(ox * dx, oy * dy)]);
    }
    return { c, s, samples };
  });
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const origin = row * width + column;
      if (!coverage[origin]) continue;
      let occlusion = 0;
      for (const { c, s, samples } of rays) {
        const a = normals[3 * origin] * c + normals[3 * origin + 1] * s;
        const tangentLength = Math.hypot(normals[3 * origin + 2], a);
        const sinT = tangentLength < 1e-12 ? 0 : -a / tangentLength;
        let maxSlope = -Infinity;
        for (const [ox, oy, distance] of samples) {
          const inVerticalRange = geometry.periodicY !== false || (row + oy >= 0 && row + oy < height);
          const neighbor = wrap(row + oy, height) * width + wrap(column + ox, width);
          const z = inVerticalRange && coverage[neighbor] ? heights[neighbor] : background;
          maxSlope = Math.max(maxSlope, (z - heights[origin]) / distance);
        }
        // The sampled horizon may be below horizontal. An empty ray cannot
        // occlude the tangent plane, so its limiting horizon sine is -1.
        const sinS = maxSlope === -Infinity ? -1 : maxSlope / Math.hypot(1, maxSlope);
        const sinH = Math.max(sinT, sinS);
        occlusion += sinH - sinT;
      }
      ao[origin] = Math.max(0, Math.min(1, 1 - occlusion / 16));
    }
  }
  return ao;
}
