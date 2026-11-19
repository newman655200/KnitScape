import { cubicArcLength } from "./rowLengthLoopModel.js";

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

function partialCubicLength(p0, p1, p2, t, end) {
  const q0 = { x: lerp(p0.x, p1.x, t), y: lerp(p0.y, p1.y, t) };
  const q1 = { x: lerp(p1.x, p2.x, t), y: lerp(p1.y, p2.y, t) };
  const control = { x: lerp(q0.x, q1.x, t), y: lerp(q0.y, q1.y, t) };
  return cubicArcLength(p0, q0, control, end);
}

function pointDistance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pushPoint(points, point) {
  const previous = points.at(-1);
  if (previous && pointDistance(previous, point) <= EPSILON &&
    Math.abs(previous.u - point.u) <= EPSILON) return;
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

function flattenPathData(pathData, curveSteps = 24, endpointFrames) {
  const tokens = tokenizePathData(pathData);
  const points = [];
  let index = 0;
  let command = null;
  let current = { x: 0, y: 0 };
  let subpathStart = null;
  let totalLength = 0;

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
        totalLength += pointDistance(current, subpathStart);
        pushPoint(points, { ...subpathStart, u: totalLength });
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
      pushPoint(points, { ...current, u: totalLength });
      index = result.nextIndex;
      command = relative ? "l" : "L";
      continue;
    }

    if (upperCommand === "L") {
      if (index + 1 >= tokens.length || isCommand(tokens[index])) continue;
      const result = readPoint(tokens, index, current, relative);
      totalLength += pointDistance(current, result.point);
      current = result.point;
      pushPoint(points, { ...current, u: totalLength });
      index = result.nextIndex;
      continue;
    }

    if (upperCommand === "Q") {
      if (index + 3 >= tokens.length || isCommand(tokens[index])) continue;
      const control = readPoint(tokens, index, current, relative);
      const end = readPoint(tokens, control.nextIndex, current, relative);
      const start = current;
      const c1 = { x: lerp(start.x, control.point.x, 2 / 3),
        y: lerp(start.y, control.point.y, 2 / 3) };
      const c2 = { x: lerp(end.point.x, control.point.x, 2 / 3),
        y: lerp(end.point.y, control.point.y, 2 / 3) };
      const length = cubicArcLength(start, c1, c2, end.point);
      for (let step = 1; step <= curveSteps; step += 1) {
        const t = step / curveSteps;
        const point = quadraticPoint(start, control.point, end.point, t);
        pushPoint(points, { ...point, u: totalLength + (step === curveSteps
          ? length : partialCubicLength(start, c1, c2, t, point)) });
      }
      totalLength += length;
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
      const length = cubicArcLength(start, controlA.point, controlB.point, end.point);
      for (let step = 1; step <= curveSteps; step += 1) {
        const t = step / curveSteps;
        const point = cubicPoint(start, controlA.point, controlB.point, end.point, t);
        const edgeIndex = points.length - 1;
        const previous = points.at(-1);
        pushPoint(points, { ...point, u: totalLength + (step === curveSteps
          ? length : partialCubicLength(start, controlA.point, controlB.point, t, point)) });
        // Attach directions to retained edges, never across an M jump or a
        // deduplicated endpoint. The sampler still selects its original edge.
        if (endpointFrames && previous && points.length === edgeIndex + 2) {
          const frames = {};
          if (previous.x === start.x && previous.y === start.y && previous.u === totalLength) {
            const control = [controlA.point, controlB.point, end.point]
              .find(candidate => pointDistance(start, candidate) > EPSILON);
            if (control) frames.start = segmentTangent(start, control);
          }
          if (step === curveSteps) {
            const control = [controlB.point, controlA.point, start]
              .find(candidate => pointDistance(candidate, end.point) > EPSILON);
            if (control) frames.end = segmentTangent(control, end.point);
          }
          if (frames.start || frames.end) endpointFrames.set(edgeIndex, frames);
        }
      }
      totalLength += length;
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
  { spacing = 3, curveSteps = 24, maxPoints = Infinity } = {}
) {
  const endpointFrames = new Map();
  const points = flattenPathData(pathData, curveSteps, endpointFrames);
  if (!points.length) return [];
  if (points.length === 1) return [withFrame(points[0], 0)];

  const segmentLengths = [];
  const cumulative = [0];
  for (let i = 1; i < points.length; i += 1) {
    const length = points[i].u - points[i - 1].u;
    segmentLengths.push(length);
    cumulative.push(points[i].u);
  }
  const totalLength = cumulative.at(-1);

  if (totalLength <= EPSILON) return [withFrame(points[0], 0)];

  const safeSpacing = Math.max(EPSILON, Number(spacing) || 3);
  const pointLimit = Number.isFinite(maxPoints) ? Math.max(2, Math.floor(maxPoints)) : Infinity;
  const steps = Math.min(Math.max(1, Math.ceil(totalLength / safeSpacing)), pointLimit - 1);
  const distances = Array.from({ length: steps + 1 }, (_, index) =>
    index === steps ? totalLength : index * totalLength / steps);

  let segmentIndex = 0;
  return distances.map((u, index) => {
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

    const frames = endpointFrames.get(segmentIndex);
    const endpointTangent = index === 0 && t === 0 ? frames?.start
      : index === distances.length - 1 && t === 1 ? frames?.end : null;
    return withFrame(point, u, endpointTangent || segmentTangent(start, end));
  });
}
