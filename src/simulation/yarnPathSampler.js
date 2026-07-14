const TOKEN_RE = /[MLCQZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
const EPSILON = 1e-6;

function tokenizePathData(pathData) {
  return String(pathData || "").match(TOKEN_RE) || [];
}

function isCommand(token) {
  return /^[a-z]$/i.test(token);
}

function number(token) {
  const value = Number(token);
  return Number.isFinite(value) ? value : 0;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function cubicPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return {
    x:
      mt ** 3 * p0.x +
      3 * mt ** 2 * t * p1.x +
      3 * mt * t ** 2 * p2.x +
      t ** 3 * p3.x,
    y:
      mt ** 3 * p0.y +
      3 * mt ** 2 * t * p1.y +
      3 * mt * t ** 2 * p2.y +
      t ** 3 * p3.y,
  };
}

export function quadraticPoint(p0, p1, p2, t) {
  const mt = 1 - t;
  return {
    x: mt ** 2 * p0.x + 2 * mt * t * p1.x + t ** 2 * p2.x,
    y: mt ** 2 * p0.y + 2 * mt * t * p1.y + t ** 2 * p2.y,
  };
}

function pointDistance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pushPoint(points, point) {
  const previous = points.at(-1);
  if (previous && pointDistance(previous, point) <= EPSILON) return;
  points.push(point);
}

function segmentTangent(a, b) {
  const length = pointDistance(a, b);
  if (length <= EPSILON) return { tangentX: 1, tangentY: 0 };
  return {
    tangentX: (b.x - a.x) / length,
    tangentY: (b.y - a.y) / length,
  };
}

function withFrame(point, u, tangent) {
  const tangentX = tangent?.tangentX ?? 1;
  const tangentY = tangent?.tangentY ?? 0;
  return {
    x: point.x,
    y: point.y,
    u,
    tangentX,
    tangentY,
    normalX: -tangentY,
    normalY: tangentX,
  };
}

function readPoint(tokens, index, current, relative) {
  const x = number(tokens[index]);
  const y = number(tokens[index + 1]);
  return {
    point: {
      x: relative ? current.x + x : x,
      y: relative ? current.y + y : y,
    },
    nextIndex: index + 2,
  };
}

function flattenPathData(pathData, curveSteps = 24) {
  const tokens = tokenizePathData(pathData);
  const points = [];
  let index = 0;
  let command = null;
  let current = { x: 0, y: 0 };
  let subpathStart = null;

  while (index < tokens.length) {
    if (isCommand(tokens[index])) {
      command = tokens[index];
      index += 1;
    }

    if (!command) break;

    const upperCommand = command.toUpperCase();
    const relative = command !== upperCommand;

    if (upperCommand === "Z") {
      if (subpathStart) {
        pushPoint(points, { ...subpathStart });
        current = { ...subpathStart };
      }
      command = null;
      continue;
    }

    if (upperCommand === "M") {
      if (index + 1 >= tokens.length) break;
      const result = readPoint(tokens, index, current, relative);
      current = result.point;
      subpathStart = { ...current };
      pushPoint(points, { ...current });
      index = result.nextIndex;
      command = relative ? "l" : "L";
      continue;
    }

    if (upperCommand === "L") {
      if (index + 1 >= tokens.length || isCommand(tokens[index])) continue;
      const result = readPoint(tokens, index, current, relative);
      current = result.point;
      pushPoint(points, { ...current });
      index = result.nextIndex;
      continue;
    }

    if (upperCommand === "Q") {
      if (index + 3 >= tokens.length || isCommand(tokens[index])) continue;
      const control = readPoint(tokens, index, current, relative);
      const end = readPoint(tokens, control.nextIndex, current, relative);
      const start = current;
      for (let step = 1; step <= curveSteps; step += 1) {
        pushPoint(
          points,
          quadraticPoint(start, control.point, end.point, step / curveSteps)
        );
      }
      current = end.point;
      index = end.nextIndex;
      continue;
    }

    if (upperCommand === "C") {
      if (index + 5 >= tokens.length || isCommand(tokens[index])) continue;
      const controlA = readPoint(tokens, index, current, relative);
      const controlB = readPoint(tokens, controlA.nextIndex, current, relative);
      const end = readPoint(tokens, controlB.nextIndex, current, relative);
      const start = current;
      for (let step = 1; step <= curveSteps; step += 1) {
        pushPoint(
          points,
          cubicPoint(
            start,
            controlA.point,
            controlB.point,
            end.point,
            step / curveSteps
          )
        );
      }
      current = end.point;
      index = end.nextIndex;
      continue;
    }

    break;
  }

  return points;
}

export function samplePathData(
  pathData,
  { spacing = 3, curveSteps = 24 } = {}
) {
  const points = flattenPathData(pathData, curveSteps);
  if (!points.length) return [];
  if (points.length === 1) return [withFrame(points[0], 0)];

  const segmentLengths = [];
  const cumulative = [0];
  let totalLength = 0;
  for (let i = 1; i < points.length; i += 1) {
    const length = pointDistance(points[i - 1], points[i]);
    segmentLengths.push(length);
    totalLength += length;
    cumulative.push(totalLength);
  }

  if (totalLength <= EPSILON) return [withFrame(points[0], 0)];

  const safeSpacing = Math.max(EPSILON, Number(spacing) || 3);
  const distances = [0];
  for (let u = safeSpacing; u < totalLength - EPSILON; u += safeSpacing) {
    distances.push(u);
  }
  distances.push(totalLength);

  let segmentIndex = 0;
  return distances.map((u) => {
    while (
      segmentIndex < segmentLengths.length - 1 &&
      cumulative[segmentIndex + 1] < u
    ) {
      segmentIndex += 1;
    }

    const start = points[segmentIndex];
    const end = points[segmentIndex + 1];
    const segmentStartU = cumulative[segmentIndex];
    const segmentLength = segmentLengths[segmentIndex] || EPSILON;
    const t = Math.min(1, Math.max(0, (u - segmentStartU) / segmentLength));
    const point = {
      x: lerp(start.x, end.x, t),
      y: lerp(start.y, end.y, t),
    };

    return withFrame(point, u, segmentTangent(start, end));
  });
}
