const EPSILON = 1e-9;

function cubicPoint(start, c1, c2, end, t, powers) {
  const mt = 1 - t;
  const mt3 = powers ? powers.mt3 : mt ** 3;
  const mt2 = powers ? powers.mt2 : mt ** 2;
  const t2 = powers ? powers.t2 : t ** 2;
  const t3 = powers ? powers.t3 : t ** 3;
  return {
    x: mt3 * start.x + 3 * mt2 * t * c1.x + 3 * mt * t2 * c2.x + t3 * end.x,
    y: mt3 * start.y + 3 * mt2 * t * c1.y + 3 * mt * t2 * c2.y + t3 * end.y,
  };
}

const GAUSS_NODES = [0.1834346424956498, 0.5255324099163290,
  0.7966664774136267, 0.9602898564975363];
const GAUSS_WEIGHTS = [0.3626837833783620, 0.3137066458778873,
  0.2223810344533745, 0.1012285362903763];

// Integrate |B'(t)| directly. The error budget is per cubic, in model units.
export function cubicArcLength(start, c1, c2, end, tolerance = 1e-9) {
  const dx0 = c1.x - start.x, dx1 = c2.x - c1.x, dx2 = end.x - c2.x;
  const dy0 = c1.y - start.y, dy1 = c2.y - c1.y, dy2 = end.y - c2.y;
  const ax = 3 * (dx2 - 2 * dx1 + dx0), bx = 6 * (dx1 - dx0), cx = 3 * dx0;
  const ay = 3 * (dy2 - 2 * dy1 + dy0), by = 6 * (dy1 - dy0), cy = 3 * dy0;
  const speed = (t) => Math.hypot((ax * t + bx) * t + cx, (ay * t + by) * t + cy);
  function integrate(a, b) {
    const mid = (a + b) / 2, half = (b - a) / 2;
    let sum = 0;
    for (let i = 0; i < GAUSS_NODES.length; i++) {
      const offset = half * GAUSS_NODES[i];
      sum += GAUSS_WEIGHTS[i] * (speed(mid - offset) + speed(mid + offset));
    }
    return half * sum;
  }
  function refine(a, b, whole, budget, depth) {
    const mid = (a + b) / 2;
    const left = integrate(a, mid), right = integrate(mid, b);
    if (Math.abs(left + right - whole) <= budget || depth === 20) return left + right;
    return refine(a, mid, left, budget / 2, depth + 1) +
      refine(mid, b, right, budget / 2, depth + 1);
  }
  return refine(0, 1, integrate(0, 1), tolerance, 0);
}

export function createPathLengthContext(digits = 6) {
  const digitCount = Math.floor(digits);
  if (!(digitCount >= 0)) throw new Error(`invalid digits: ${digits}`);
  const factor = 10 ** digitCount;
  let roundCoordinates = true;
  let current = null;
  const coordinate = (value) => {
    const number = +value;
    const rounded = roundCoordinates && digitCount <= 15
      ? Math.round(number * factor) / factor
      : number;
    // SVG stringification turns signed zero into "0" before the sampler reads it.
    return rounded === 0 ? 0 : rounded;
  };
  const point = (x, y) => ({ x: coordinate(x), y: coordinate(y) });
  function addPoint(value) {
    if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
      context.valid = false;
      return;
    }
    context.start ??= value;
    context.end = value;
  }
  const context = {
    reset(round = true) {
      roundCoordinates = round;
      current = null;
      context.totalLength = 0;
      context.start = context.end = null;
      context.valid = true;
      return context;
    },
    moveTo(x, y) {
      current = point(x, y);
      addPoint(current);
    },
    lineTo(x, y) {
      const end = point(x, y);
      if (current) context.totalLength += Math.hypot(end.x - current.x, end.y - current.y);
      current = end;
      addPoint(end);
    },
    bezierCurveTo(x1, y1, x2, y2, x, y) {
      const c1 = point(x1, y1);
      const c2 = point(x2, y2);
      const end = point(x, y);
      if (![current, c1, c2, end].every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))) {
        context.valid = false;
        return;
      }
      context.totalLength += cubicArcLength(current, c1, c2, end);
      addPoint(end);
      current = end;
    },
  };
  return context.reset();
}

export function samplePathData(pathData, samplesPerCurve = 24) {
  const tokens = pathData.match(/[MLC]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  const points = [];
  let current = null;
  for (let index = 0; index < tokens.length; ) {
    const command = tokens[index++].toUpperCase();
    if (command === "M" || command === "L") {
      current = { x: Number(tokens[index++]), y: Number(tokens[index++]) };
      points.push(current);
    } else if (command === "C" && current) {
      const c1 = { x: Number(tokens[index++]), y: Number(tokens[index++]) };
      const c2 = { x: Number(tokens[index++]), y: Number(tokens[index++]) };
      const end = { x: Number(tokens[index++]), y: Number(tokens[index++]) };
      const start = current;
      for (let sample = 1; sample <= samplesPerCurve; sample++) {
        points.push(cubicPoint(start, c1, c2, end, sample / samplesPerCurve));
      }
      current = end;
    }
  }
  return points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function polylineLength(points, unitScale = 1) {
  return polylineArcLength(points, unitScale).totalLength;
}

export function polylineArcLength(points, unitScale = 1) {
  const scale = Number(unitScale) > 0 ? Number(unitScale) : 1;
  let totalLength = 0;
  const cumulativeArcLength = points.map((point, index) => {
    if (index > 0) {
      const previous = points[index - 1];
      totalLength += Math.hypot(point.x - previous.x, point.y - previous.y) / scale;
    }
    return totalLength;
  });
  return { totalLength, cumulativeArcLength };
}

export function pathDataArcLength(pathData, unitScale = 1) {
  return polylineArcLength(samplePathData(pathData), unitScale);
}

export function pathDataLength(pathData, unitScale = 1) {
  return pathDataArcLength(pathData, unitScale).totalLength;
}

export function pathEndpoints(pathData) {
  // Generated paths use absolute M/L/C commands; continuity needs only their endpoints.
  if (/^[MLC\d\s.,eE+-]+$/.test(pathData)) {
    const tokens = pathData.match(/[MLC]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
    let start = null;
    let current = null;
    let end = null;
    let valid = tokens[0] === "M";
    for (let index = 0; valid && index < tokens.length; ) {
      const command = tokens[index++];
      const count = command === "C" ? 6 : command === "M" || command === "L" ? 2 : 0;
      const coordinates = tokens.slice(index, index + count).map(Number);
      if (!count || coordinates.length !== count || !coordinates.every(Number.isFinite)) {
        valid = false;
        break;
      }
      index += count;
      const point = { x: coordinates.at(-2), y: coordinates.at(-1) };
      // t=1 retains the sampler's exact endpoint arithmetic, including signed zero.
      end = command === "C"
        ? cubicPoint(current, { x: coordinates[0], y: coordinates[1] }, { x: coordinates[2], y: coordinates[3] }, point, 1)
        : point;
      start ??= point;
      current = point;
    }
    if (valid && start) return { start, end };
  }
  const points = samplePathData(pathData);
  return points.length ? { start: points[0], end: points.at(-1) } : null;
}

export function assertContinuousRowPaths(paths, tolerance = 1e-6) {
  let previous = paths.length > 1 ? pathEndpoints(paths[0]) : null;
  for (let index = 1; index < paths.length; index++) {
    const current = pathEndpoints(paths[index]);
    if (!previous || !current || Math.hypot(previous.end.x - current.start.x, previous.end.y - current.start.y) > tolerance) return false;
    previous = current;
  }
  return true;
}

export function moveNeckPointX(point, centerX, coefficient, movable = true) {
  return movable ? { ...point, x: centerX + coefficient * (point.x - centerX) } : { ...point };
}

export function lengthScaleToXCompensation(coefficient, strength = 0.2) {
  return 1 + (coefficient - 1) * strength;
}

export function moveNeckPoint(point, centerX, coefficient, verticalSpan = 0, movable = true) {
  if (!movable) return { ...point };
  return moveNeckPointX(
    point,
    centerX,
    lengthScaleToXCompensation(coefficient)
  );
}

export function solveSharedCoefficient({ targetLength, direction, measureLength, minCoefficient = 0.4, maxCoefficient = 1.8, scanSteps = 80, refinementSteps = 28, relativeTolerance = 0.001 }) {
  let low = direction === "tight" ? minCoefficient : 1;
  let high = direction === "tight" ? 1 : maxCoefficient;
  let best = { coefficient: 1, actualLength: measureLength(1), error: Infinity };
  const consider = (coefficient) => {
    const actualLength = measureLength(coefficient);
    const error = Math.abs(actualLength - targetLength);
    if (Number.isFinite(actualLength) && error < best.error) best = { coefficient, actualLength, error };
  };
  for (let i = 0; i <= scanSteps; i++) consider(low + ((high - low) * i) / scanSteps);
  let span = (high - low) / scanSteps;
  for (let i = 0; i < refinementSteps; i++) {
    const left = Math.max(low, best.coefficient - span);
    const right = Math.min(high, best.coefficient + span);
    consider(left); consider((left + right) / 2); consider(right);
    span /= 2;
  }
  const relativeError = best.error / Math.max(EPSILON, Math.abs(targetLength));
  return { coefficient: best.coefficient, actualLength: best.actualLength, targetLength, relativeError, limited: relativeError > relativeTolerance && (Math.abs(best.coefficient - low) < EPSILON || Math.abs(best.coefficient - high) < EPSILON) };
}
