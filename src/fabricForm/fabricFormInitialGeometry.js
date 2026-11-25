import { stockinetteSabetta } from "./topology/stitchTemplates.js";

/**
 * Initial geometry only, derived from stockinette.py/CrossOver5/ConnectingCurve5
 * and Init_stockinette.dat in https://github.com/sabetta/stitch-by-stitch
 * commit 0ed27f35dcf5c3bda874f214bbcab0455055edf0. No source energy or solver is used.
 * The eight quintic pieces follow reparam_curve_t (stockinette.py:496-541).
 *
 * MIT License
 *
 * Copyright (c) 2023 sabetta
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
const REFERENCE_WIDTH = 2.9;
const REFERENCE_HEIGHT = 2.034702252128072;
const REFERENCE_CURVES = [
  [
    [-0.7591022806387062,-0.6192249406363173,0.38837121001367747],
    [-0.46825853097957193,-0.45039228707992385,0.24396558578968788],
    [-0.30384346381849,-0.20080317295250763,0.03663431149484564],
    [-0.29275423789229077,0.07975039346582347,-0.1830548766006443],
    [-0.40898152904987223,0.3471245643836208,-0.3175150924747725],
    [-0.5162272081548941,0.5839582800720458,-0.3883829784359735],
  ],
  [
    [-0.5162272081548941,0.5839582800720458,-0.3883829784359735],
    [-0.5903962245130749,0.7477478507069808,-0.4373938237864776],
    [-0.6742794486122313,0.927869032621484,-0.4652472818500911],
    [-0.7757838656493903,1.1068309027695198,-0.46523592234065086],
    [-0.8596631369231172,1.2869523008749324,-0.4373719602966716],
    [-0.9338255009187268,1.4507421069083946,-0.38835183581303656],
  ],
  [
    [-0.9338255009187268,1.4507421069083946,-0.38835183581303656],
    [-1.0410615609513025,1.6875761629744614,-0.31747053256544033],
    [-1.1572709615453638,1.9549508073972408,-0.18299579564401267],
    [-1.148003075115549,2.240048945383834,0.04012372801328634],
    [-0.9759488054768061,2.488318522295779,0.2467041784589354],
    [-0.6908450102876728,2.6539290579120207,0.3883636042353326],
  ],
  [
    [-0.6908450102876728,2.6539290579120207,0.3883636042353326],
    [-0.4561768056359624,2.790242666219796,0.5049631152901977],
    [-0.15923873087250562,2.862237485285691,0.5704641541841025],
    [0.15923873087250562,2.862237485285691,0.5704641541841025],
    [0.4561768056359624,2.790242666219796,0.5049631152901977],
    [0.6908450102876728,2.6539290579120207,0.3883636042353326],
  ],
  [
    [0.6908450102876728,2.6539290579120207,0.3883636042353326],
    [0.9759488054768061,2.488318522295779,0.2467041784589354],
    [1.148003075115549,2.240048945383834,0.04012372801328634],
    [1.1572709615453638,1.9549508073972408,-0.18299579564401267],
    [1.0410615609513025,1.6875761629744614,-0.31747053256544033],
    [0.9338255009187268,1.4507421069083946,-0.38835183581303656],
  ],
  [
    [0.9338255009187268,1.4507421069083946,-0.38835183581303656],
    [0.8596631369231172,1.2869523008749324,-0.4373719602966716],
    [0.7757838656493903,1.1068309027695198,-0.46523592234065086],
    [0.6742794486122312,0.927869032621484,-0.4652472818500912],
    [0.5903962245130749,0.7477478507069808,-0.4373938237864776],
    [0.5162272081548941,0.5839582800720458,-0.3883829784359735],
  ],
  [
    [0.5162272081548941,0.5839582800720458,-0.3883829784359735],
    [0.40898152904987223,0.3471245643836208,-0.3175150924747725],
    [0.29275423789229077,0.07975039346582347,-0.1830548766006443],
    [0.30384346381849,-0.20080317295250763,0.03663431149484564],
    [0.46825853097957193,-0.45039228707992385,0.24396558578968788],
    [0.7591022806387062,-0.6192249406363173,0.38837121001367747],
  ],
  [
    [0.7591022806387062,-0.6192249406363173,0.38837121001367747],
    [0.9938304237191224,-0.7554828980690527,0.5049151070862165],
    [1.2907332304743782,-0.8274297175711384,0.5704562172613233],
    [1.609266769525622,-0.8274297175711384,0.5704562172613232],
    [1.9061695762808777,-0.7554828980690527,0.5049151070862165],
    [2.140897719361294,-0.6192249406363173,0.38837121001367747],
  ],
];

const REFERENCE_SEEDS = {
  [stockinetteSabetta.id]: { curves: REFERENCE_CURVES, width: REFERENCE_WIDTH, height: REFERENCE_HEIGHT },
};

function pointOnCurve(points, t) {
  const coefficients = [1, 5, 10, 10, 5, 1];
  const result = [0, 0, 0];
  for (let i = 0; i < 6; i++) {
    const weight = coefficients[i] * t ** i * (1 - t) ** (5 - i);
    for (let axis = 0; axis < 3; axis++) result[axis] += weight * points[i][axis];
  }
  return result;
}

function sampleReference(count, shapeScale, curves) {
  const dense = [], arc = [];
  const resolution = Math.max(256, count * 8);
  for (let curve = 0; curve < curves.length; curve++) {
    for (let step = 0; step < resolution; step++) {
      dense.push(pointOnCurve(curves[curve], step / resolution).map((value, axis) => value * shapeScale[axis]));
    }
  }
  dense.push(curves.at(-1).at(-1).map((value, axis) => value * shapeScale[axis]));
  arc.push(0);
  for (let i = 1; i < dense.length; i++) arc.push(arc[i - 1] + Math.hypot(...dense[i].map((value, axis) => value - dense[i - 1][axis])));
  const points = [];
  let interval = 1;
  for (let i = 0; i <= count; i++) {
    const target = arc.at(-1) * i / count;
    while (interval < arc.length - 1 && arc[interval] < target) interval++;
    const fraction = (target - arc[interval - 1]) / (arc[interval] - arc[interval - 1]);
    points.push(dense[interval - 1].map((value, axis) => value + fraction * (dense[interval][axis] - value)));
  }
  return points;
}

/** Geometry seed only: the caller must reject it if the contact/CCD checks fail. */
export function createFabricFormInitialGeometry(topology, params = {}, options = {}) {
  const { m, n, nodesPerLoop: count, loopLengthMm: target } = topology;
  if (![m, n, count].every(value => Number.isInteger(value) && value > 0) || count < 16 || !(target > 0) || !Number.isFinite(target)) {
    throw new RangeError("Initial stockinette geometry needs positive dimensions, >=16 nodes per loop, and a finite target length.");
  }
  if (params.loopLengthMm !== undefined && params.loopLengthMm !== target) {
    throw new RangeError("Initial geometry and topology must use the same loopLengthMm.");
  }
  const shapeScale = options.shapeScale ?? [1, 1, 1];
  if (shapeScale.length !== 3 || !shapeScale.every(value => Number.isFinite(value) && value > 0)) {
    throw new RangeError("shapeScale must contain three finite positive factors.");
  }
  const template = stockinetteSabetta;
  const reference = REFERENCE_SEEDS[template.id];
  const samples = sampleReference(count, shapeScale, reference.curves);
  const lengths = samples.slice(0, -1).map((point, i) => Math.hypot(...point.map((value, axis) => samples[i + 1][axis] - value)));
  const scale = target / lengths.reduce((sum, value) => sum + value, 0);
  const width = reference.width * shapeScale[0] * scale;
  const height = reference.height * shapeScale[1] * scale;
  const centroid = [0, 1, 2].map(axis => samples.slice(0, -1).reduce((sum, point) => sum + point[axis], 0) / count);
  const positions = [];
  for (let feed = 0; feed < n; feed++) {
    for (let needle = 0; needle < m; needle++) {
      for (let k = 0; k < count; k++) positions.push([
        (samples[k][0] - centroid[0]) * scale + needle * width,
        (samples[k][1] - centroid[1]) * scale + feed * height,
        (samples[k][2] - centroid[2]) * scale,
      ]);
    }
  }
  const materialTopology = structuredClone(topology);
  for (const yarn of materialTopology.yarns) {
    let materialStart = 0;
    for (const edgeIndex of yarn.edgeIndices) {
      const edge = materialTopology.edges[edgeIndex];
      edge.restLength = lengths[edge.order % count] * scale;
      edge.materialStart = materialStart;
      materialStart += edge.restLength;
    }
    yarn.materialLength = m * target;
  }
  return { positions, W: m * width, H: n * height, S: 0, topology: materialTopology,
    initialization: { source: template.seed.source, commit: template.seed.commit,
      method: "Periodic quintic stockinette seed, arclength resampling, exact polygonal material-length normalization",
      shapeScale: Array.from(shapeScale), contactFeasibility: "REQUIRES_CONTACT_CHECK" } };
}
