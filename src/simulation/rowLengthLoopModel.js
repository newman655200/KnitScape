const EPSILON = 1e-9;

function cubicPoint(start, c1, c2, end, t) {
  const mt = 1 - t;
  return {
    x: mt ** 3 * start.x + 3 * mt ** 2 * t * c1.x + 3 * mt * t ** 2 * c2.x + t ** 3 * end.x,
    y: mt ** 3 * start.y + 3 * mt ** 2 * t * c1.y + 3 * mt * t ** 2 * c2.y + t ** 3 * end.y,
  };
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
  const scale = Number(unitScale) > 0 ? Number(unitScale) : 1;
  return points.slice(1).reduce(
    (total, point, index) => total + Math.hypot(point.x - points[index].x, point.y - points[index].y) / scale,
    0
  );
}

export function pathDataLength(pathData, unitScale = 1) {
  return polylineLength(samplePathData(pathData), unitScale);
}

export function pathEndpoints(pathData) {
  const points = samplePathData(pathData);
  return points.length ? { start: points[0], end: points.at(-1) } : null;
}

export function assertContinuousRowPaths(paths, tolerance = 1e-6) {
  for (let index = 1; index < paths.length; index++) {
    const previous = pathEndpoints(paths[index - 1]);
    const current = pathEndpoints(paths[index]);
    if (!previous || !current || Math.hypot(previous.end.x - current.start.x, previous.end.y - current.start.y) > tolerance) return false;
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
