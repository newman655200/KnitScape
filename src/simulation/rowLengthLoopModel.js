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

export function createPathLengthContext(digits = 6) {
  const digitCount = Math.floor(digits);
  if (!(digitCount >= 0)) throw new Error(`invalid digits: ${digits}`);
  const factor = 10 ** digitCount;
  const samplePowers = Array.from({ length: 24 }, (_, index) => {
    const t = (index + 1) / 24;
    const mt = 1 - t;
    return { mt3: mt ** 3, mt2: mt ** 2, t2: t ** 2, t3: t ** 3 };
  });
  let roundCoordinates = true;
  let current = null;
  let previous = null;
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
    if (previous) {
      context.totalLength += Math.hypot(value.x - previous.x, value.y - previous.y);
    }
    previous = value;
  }
  const context = {
    reset(round = true) {
      roundCoordinates = round;
      current = previous = null;
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
      current = point(x, y);
      addPoint(current);
    },
    bezierCurveTo(x1, y1, x2, y2, x, y) {
      const c1 = point(x1, y1);
      const c2 = point(x2, y2);
      const end = point(x, y);
      if (current) {
        const start = current;
        for (let sample = 1; sample <= 24; sample++) {
          addPoint(cubicPoint(start, c1, c2, end, sample / 24, samplePowers[sample - 1]));
        }
      }
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
