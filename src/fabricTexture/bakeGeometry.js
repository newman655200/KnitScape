/** Apply the face's proper rotation: both views retain +y as image up. */
function facePoint(point, sign) {
  return [sign * point[0], point[1], sign * point[2]];
}

/**
 * Enumerate every lattice image whose projected capsule box overlaps the cell.
 * Image zero is not special, and support may exceed any number of cell widths.
 */
function visitImagePixels(a, b, radius, grid, visit) {
  const { W, H, width, height, dx, dy } = grid;
  const minX = Math.min(a[0], b[0]) - radius, maxX = Math.max(a[0], b[0]) + radius;
  const minY = Math.min(a[1], b[1]) - radius, maxY = Math.max(a[1], b[1]) + radius;
  const firstP = Math.ceil(-maxX / W), lastP = Math.floor((W - minX) / W);
  const firstQ = Math.ceil(-maxY / H), lastQ = Math.floor((H - minY) / H);
  for (let q = firstQ; q <= lastQ; q++) {
    for (let p = firstP; p <= lastP; p++) {
      const ox = p * W, oy = q * H;
      const i0 = Math.max(0, Math.ceil((minX + ox) / dx - 0.5));
      const i1 = Math.min(width - 1, Math.floor((maxX + ox) / dx - 0.5));
      const j0 = Math.max(0, Math.ceil((minY + oy) / dy - 0.5));
      const j1 = Math.min(height - 1, Math.floor((maxY + oy) / dy - 0.5));
      for (let j = j0; j <= j1; j++) {
        const y = (j + 0.5) * dy - oy;
        const row = height - 1 - j;
        for (let i = i0; i <= i1; i++) visit(row * width + i, (i + 0.5) * dx - ox, y);
      }
    }
  }
}

/**
 * Bake the union of exact circular capsules around the dense centerline segments.
 * Output uses top-down image rows, +y upward, mm heights, unit normals/tangents,
 * material arc length in mm, and signed projected transverse coordinate in [-1,1].
 * Empty heights are -Infinity, node IDs -1, all other empty arrays zero.
 * Actual S is retained; |S|<=1e-6 W is baked on a rectangular lattice.
 */
export function bakeGeometry(centerline, { face = "technicalBack", pxPerMm = 200 } = {}) {
  if (face !== "technicalBack" && face !== "technicalFace") throw new RangeError("Unknown fabric face.");
  const { W, H, S, radiusMm: radius } = centerline;
  if (![W, H, radius, pxPerMm].every(value => Number.isFinite(value) && value > 0) || !Number.isFinite(S)) {
    throw new RangeError("Geometry requires positive finite dimensions, radius and resolution.");
  }
  if (Math.abs(S) > 1e-6 * W) {
    const error = new RangeError(`T6a stop #4: unsupported shear S=${S} mm; limit=${1e-6 * W} mm.`);
    error.code = "UNSUPPORTED_SHEAR";
    throw error;
  }
  const width = Math.round(W * pxPerMm), height = Math.round(H * pxPerMm);
  if (width < 1 || height < 1) throw new RangeError("Resolution gives an empty pixel grid.");
  const count = width * height, dx = W / width, dy = H / height;
  const coverage = new Uint8Array(count), heights = new Float64Array(count).fill(-Infinity);
  const normals = new Float64Array(3 * count), tangents = new Float64Array(3 * count);
  const arcLengths = new Float64Array(count), transverse = new Float64Array(count);
  const nodeIndices = new Int32Array(count).fill(-1);
  const grid = { W, H, width, height, dx, dy };
  const sign = face === "technicalFace" ? -1 : 1;
  const points = centerline.points.map(point => facePoint(point, sign));
  const sampleTangents = centerline.tangents.map(tangent => facePoint(tangent, sign));
  const radius2 = radius * radius;

  function write(index, z, vx, vy, vz, tx, ty, tz, s, nodeIndex) {
    if (z <= heights[index]) return;
    const tangentLength = Math.hypot(tx, ty, tz);
    tx /= tangentLength;
    ty /= tangentLength;
    tz /= tangentLength;
    const along = vx * tx + vy * ty + vz * tz;
    const nx = vx - along * tx, ny = vy - along * ty, nz = vz - along * tz;
    const normalLength = Math.hypot(nx, ny, nz);
    if (!(normalLength > 0)) return;
    const projectedLength = Math.hypot(tx, ty);
    coverage[index] = 1;
    heights[index] = z;
    normals[3 * index] = nx / normalLength;
    normals[3 * index + 1] = ny / normalLength;
    normals[3 * index + 2] = nz / normalLength;
    tangents[3 * index] = tx;
    tangents[3 * index + 1] = ty;
    tangents[3 * index + 2] = tz;
    arcLengths[index] = s;
    // b = normalize(t_s cross e_z) = (ty, -tx, 0)/projectedLength.
    transverse[index] = projectedLength > 1e-15
      ? Math.max(-1, Math.min(1, (vx * ty - vy * tx) / (projectedLength * radius))) : 0;
    nodeIndices[index] = nodeIndex;
  }

  // Each endpoint sphere is computed once; adjacent cylinders meet these spheres.
  for (let i = 0; i < points.length; i++) {
    const a = points[i], tangent = sampleTangents[i];
    visitImagePixels(a, a, radius, grid, (index, x, y) => {
      const vx = x - a[0], vy = y - a[1], cap2 = radius2 - vx * vx - vy * vy;
      if (cap2 < 0) return;
      const vz = Math.sqrt(cap2);
      write(index, a[2] + vz, vx, vy, vz, ...tangent,
        centerline.arcLengths[i], centerline.nodeIndices[i]);
    });
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (!(length > 0)) continue;
    const tx = (b[0] - a[0]) / length, ty = (b[1] - a[1]) / length, tz = (b[2] - a[2]) / length;
    // tx²+ty² avoids cancellation in 1-tz² for nearly vertical segments.
    const coefficientA = tx * tx + ty * ty;
    if (coefficientA === 0) continue; // Vertical sides have no higher hit than the endpoint sphere.
    const t0 = sampleTangents[i], t1 = sampleTangents[i + 1];
    visitImagePixels(a, b, radius, grid, (index, x, y) => {
      const wx = x - a[0], wy = y - a[1], dot = wx * tx + wy * ty;
      const coefficientB = -2 * tz * dot;
      const coefficientC = wx * wx + wy * wy - dot * dot - radius2;
      const discriminant = coefficientB * coefficientB - 4 * coefficientA * coefficientC;
      if (discriminant < 0) return;
      const zp = (-coefficientB + Math.sqrt(discriminant)) / (2 * coefficientA);
      const tau = dot + zp * tz;
      if (tau < 0 || tau > length) return;
      const u = tau / length;
      write(index, a[2] + zp, wx - tau * tx, wy - tau * ty, zp - tau * tz,
        t0[0] + u * (t1[0] - t0[0]), t0[1] + u * (t1[1] - t0[1]), t0[2] + u * (t1[2] - t0[2]),
        centerline.arcLengths[i] + tau, centerline.nodeIndices[u <= 0.5 ? i : i + 1]);
    });
  }
  let covered = 0, legs = 0, heightMinMm = Infinity, heightMaxMm = -Infinity;
  for (let i = 0; i < count; i++) {
    if (!coverage[i]) continue;
    covered++;
    legs += Number(Boolean(centerline.legNodes?.[nodeIndices[i]]));
    heightMinMm = Math.min(heightMinMm, heights[i]);
    heightMaxMm = Math.max(heightMaxMm, heights[i]);
  }
  if (!covered) heightMinMm = heightMaxMm = 0;
  return { face, width, height, W, H, S, dx, dy, coverage, heights, normals, tangents,
    arcLengths, transverse, nodeIndices, heightMinMm, heightMaxMm,
    diagnostics: { coverageFraction: covered / count, legFraction: covered ? legs / covered : 0 } };
}
