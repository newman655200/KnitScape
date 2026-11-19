import * as d3 from "d3";
import { Bimp } from "../lib/Bimp.js";
import { Pattern } from "./Pattern.js";
import { ProcessModel } from "./ProcessModel.js";
import { YarnModel } from "./YarnModel.js";
import {
  assertContinuousRowPaths,
  createPathLengthContext,
  moveNeckPoint,
  pathDataArcLength,
  pathDataLength,
  pathEndpoints,
} from "./rowLengthLoopModel";
import {
  cmPer100Loops,
  gaugeToNeedlePitchMm,
  normalizeModelLengthPer100Needles,
  normalizeMachineGauge,
} from "./yarnLengthMetrics";

export const X_PADDING = 1;
export const Y_PADDING = 0;

const STITCH_RATIO = 5 / 3;
const SPREAD = 0.88;
const MODEL_PATH_DIGITS = 6;
const IDENTITY_POINT = (point) => point;

// Display-matching model template; it has not been calibrated to measured fabric.
export const DEFAULT_YARN_MODEL_GEOMETRY = Object.freeze({
  needlePitch: 1,
  loopHeight: 3 / 5,
  calibrated: false,
});

function periodicMeasurementPattern(pattern, stitchPattern) {
  // Find an exact horizontal repeat across every course, never a visual width.
  let period = pattern.width;
  for (let candidate = 1; candidate <= pattern.width; candidate++) {
    if (pattern.width % candidate !== 0) continue;
    let matches = true;
    for (let row = 0; matches && row < pattern.height; row++) {
      for (let needle = candidate; needle < pattern.width; needle++) {
        if (stitchPattern.op(needle + X_PADDING, row) !==
          stitchPattern.op(needle % candidate + X_PADDING, row)) {
          matches = false;
          break;
        }
      }
    }
    if (matches) { period = candidate; break; }
  }
  const operations = ["K", "P", "M", "T"];
  const bitmap = new Bimp(3 * period, pattern.height,
    Array.from({ length: 3 * period * pattern.height }, (_, index) =>
      operations.indexOf(stitchPattern.op(index % (3 * period) % period + X_PADDING,
        Math.floor(index / (3 * period))))));
  return { bitmap, period };
}

export function buildYarnPathGeometry({
  pattern,
  stitchPattern,
  yarnGraph,
  canvasWidth,
  canvasHeight,
  primaryLengthScaleY,
  primaryYarnDiameter,
  yarnDiameterForCourse = null,
  machineGauge,
  modelLoopHeight = null,
  includeSummaryMetrics = true,
  includeDisplayPaths = true,
  measurementWindow = null,
}) {
  machineGauge = normalizeMachineGauge(machineGauge);
  const defaultLoopHeight =
    DEFAULT_YARN_MODEL_GEOMETRY.loopHeight * primaryLengthScaleY;
  const loopHeight =
    modelLoopHeight === null ? defaultLoopHeight : Number(modelLoopHeight);
  if (!Number.isFinite(loopHeight) || loopHeight <= 0) {
    throw new RangeError("modelLoopHeight must be a positive number.");
  }
  let stitchWidth, offsetX, offsetY;

  function layoutNodes(graph) {
    graph.contactNodes.forEach((node, index) => {
      const i = index % graph.width;
      const j = (index - i) / graph.width;
      node.i = i;
      node.j = j;
      node.modelX = (i / 2) * DEFAULT_YARN_MODEL_GEOMETRY.needlePitch;
      node.modelY = (graph.height - j) * loopHeight;
    });

    return graph.contactNodes;
  }

  function modelToCanvasPoint(point) {
    return {
      x: offsetX + point.x * stitchWidth,
      y: offsetY + point.y * stitchWidth,
    };
  }

  // Model paths contain absolute M/L/C coordinate pairs, including controls.
  function modelPathToCanvas(pathData, modelOffsetY = 0) {
    let coordinateIndex = 0;
    return pathData.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (coordinate) => {
      const offset =
        coordinateIndex++ % 2 === 0
          ? offsetX
          : offsetY + modelOffsetY * stitchWidth;
      return String(offset + Number(coordinate) * stitchWidth);
    });
  }

  function resolveModelPathsForDisplay(solvedPathByLink) {
    if (!solvedPathByLink.size) return resolvedPathByLink;
    const paths = new Map();
    let course = null;
    let modelOffsetY = 0;
    let previousEnd = null;
    for (const link of yarnPathLinks) {
      const pathData =
        solvedPathByLink.get(link.index) ?? modelPathByLink.get(link.index);
      const endpoints = pathEndpoints(pathData);
      if (!endpoints) return resolvedPathByLink;
      if (link.row !== course) {
        // Translate each course as a whole: preserve solved length and X positions.
        if (previousEnd && Math.abs(previousEnd.x - endpoints.start.x) > 1e-6) {
          return resolvedPathByLink;
        }
        modelOffsetY = previousEnd ? previousEnd.y - endpoints.start.y : 0;
        course = link.row;
      }
      paths.set(link.index, modelPathToCanvas(pathData, modelOffsetY));
      previousEnd = { x: endpoints.end.x, y: endpoints.end.y + modelOffsetY };
    }
    return paths;
  }

  function layoutDisplayNodes(graph) {
    stitchWidth = Math.min(
      (canvasWidth * 0.9) / stitchPattern.width,
      ((canvasHeight * 0.9) / stitchPattern.height) * STITCH_RATIO
    );

    const baseStitchHeight = stitchWidth / STITCH_RATIO;
    const stitchHeight = baseStitchHeight * primaryLengthScaleY;
    const yarnWidth = stitchWidth * primaryYarnDiameter;

    offsetX = yarnWidth + (canvasWidth - stitchPattern.width * stitchWidth) / 2;
    offsetY =
      -yarnWidth + (canvasHeight - stitchPattern.height * stitchHeight) / 2;

    graph.contactNodes.forEach((node) => {
      const displayPoint = modelToCanvasPoint({
        x: node.modelX,
        y: node.modelY,
      });
      node.x = displayPoint.x;
      node.y = displayPoint.y;
    });
  }

  function unitNormal(prev, next, flip) {
    if (prev.index === next.index) return [0, 0];
    const x = prev.modelX - next.modelX;
    const y = prev.modelY - next.modelY;
    const mag = SPREAD * Math.sqrt(x ** 2 + y ** 2);

    return flip ? [-y / mag, x / mag] : [y / mag, -x / mag];
  }

  function updateNormals({ nodes, yarnPath } = baseModelState) {
    yarnPath[0].normal = unitNormal(
      nodes[yarnPath[0].cnIndex],
      nodes[yarnPath[1].cnIndex],
      true
    );

    for (let index = 1; index < yarnPath.length - 1; index++) {
      let flip;
      if (yarnPath[index].cnType == "FH" || yarnPath[index].cnType == "LH") {
        flip = yarnPath[index].row % 2 == 0;
      } else {
        flip = yarnPath[index].row % 2 != 0;
      }

      yarnPath[index].normal = unitNormal(
        nodes[yarnPath[index - 1].cnIndex],
        nodes[yarnPath[index + 1].cnIndex],
        flip
      );
    }

    yarnPath.at(-1).normal = unitNormal(
      nodes[yarnPath.at(-2).cnIndex],
      nodes[yarnPath.at(-1).cnIndex],
      true
    );
  }

  const openYarnCurve = d3
    .line()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(d3.curveCatmullRomOpen)
    .digits(MODEL_PATH_DIGITS);

  function getBasePointPosition(point, modelNodes = nodes) {
    const node = modelNodes[point.cnIndex];
    const diameter = yarnDiameterForCourse?.(point.row) ?? primaryYarnDiameter;
    return {
      x: node.modelX + (diameter / 2) * point.normal[0],
      y: node.modelY + (diameter / 2) * point.normal[1],
    };
  }

  function getYarnLinkCurvePoints(yarnLink, modelYarnPath = yarnPath) {
    const index = yarnLink.index;
    return [
      modelYarnPath[index - 1],
      modelYarnPath[index],
      modelYarnPath[index + 1],
      modelYarnPath[index + 2],
    ];
  }

  function getSharedPointPosition(point, coefficientByRow, modelState = baseModelState) {
    const base = getBasePointPosition(point, modelState.nodes);
    const bounds = rowBoundaryIndices.get(point.row);
    const isBoundary =
      point.pathIndex === bounds?.first || point.pathIndex === bounds?.last;
    const isNeck = point.cnType?.endsWith("L");
    if (!isNeck || isBoundary) return base;
    const centerX =
      (Math.floor(point.i / 2) + 0.25) *
      DEFAULT_YARN_MODEL_GEOMETRY.needlePitch;
    return moveNeckPoint(
      base,
      centerX,
      coefficientByRow.get(point.row) ?? 1,
      modelState.loopHeight
    );
  }

  function yarnCurve(
    yarnLink,
    coefficientByRow,
    transformPoint = IDENTITY_POINT,
    modelState = baseModelState
  ) {
    const index = yarnLink.index;

    if (index == 0 || index > yarnPathLinks.length - 3) {
      const source = transformPoint(
        getSharedPointPosition(modelState.yarnPath[index], coefficientByRow, modelState)
      );
      const target = transformPoint(
        getSharedPointPosition(modelState.yarnPath[index + 1], coefficientByRow, modelState)
      );
      if (!source || !target) return "";
      return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
    }

    return openYarnCurve(
      getYarnLinkCurvePoints(yarnLink, modelState.yarnPath).map((point) =>
        transformPoint(getSharedPointPosition(point, coefficientByRow, modelState))
      )
    );
  }

  function rowSupportsLengthModel(row) {
    for (let x = 0; x < stitchPattern.width; x++) {
      const operation = stitchPattern.op(x, row);
      if (operation !== "K" && operation !== "P") return false;
    }
    return true;
  }

  function buildRowCoefficients(linksByRow) {
    const coefficients = new Map([...linksByRow.keys()].map((row) => [row, 1]));
    if (Math.abs(primaryLengthScaleY - 1) < 0.0001) return coefficients;
    const supportedRows = [...linksByRow.keys()].filter(rowSupportsLengthModel);
    if (!supportedRows.length) return coefficients;
    supportedRows.forEach((row) => coefficients.set(row, primaryLengthScaleY));
    return coefficients;
  }

  function buildResolvedPathMaps(modelState = baseModelState, displayPaths = includeDisplayPaths) {
    const coefficientByLink = new Map(
      yarnPathLinks.map((link) => [link.index, coefficients])
    );
    const modelPathByLink = new Map();
    linksByRow.forEach((links, row) => {
      const paths = links.map((link) => yarnCurve(link, coefficients, IDENTITY_POINT, modelState));
      if (assertContinuousRowPaths(paths, 1e-6)) {
        links.forEach((link, index) => modelPathByLink.set(link.index, paths[index]));
        return;
      }
      const rowCoefficients = new Map(coefficients);
      rowCoefficients.set(row, 1);
      links.forEach((link) => {
        coefficientByLink.set(link.index, rowCoefficients);
        modelPathByLink.set(link.index, yarnCurve(link, rowCoefficients, IDENTITY_POINT, modelState));
      });
    });

    const resolvedPathByLink = new Map();
    yarnPathLinks.forEach((link) => {
      const linkCoefficients = coefficientByLink.get(link.index);
      if (displayPaths) {
        resolvedPathByLink.set(
          link.index,
          yarnCurve(link, linkCoefficients, modelToCanvasPoint, modelState)
        );
      }
    });
    return { modelPathByLink, resolvedPathByLink };
  }

  function needlePosition(point) {
    return Math.floor(point.i / 2);
  }

  function pointInEffectiveNeedles(point) {
    const stitchColumn = needlePosition(point);
    return (
      stitchColumn >= X_PADDING &&
      stitchColumn < X_PADDING + pattern.width
    );
  }

  function linkInEffectiveNeedles(link) {
    return (
      pointInEffectiveNeedles(yarnPath[link.index]) &&
      pointInEffectiveNeedles(yarnPath[link.index + 1])
    );
  }

  function buildYarnLengthMetrics() {
    const totalPathLengthStitchUnits = yarnPathLinks.reduce((total, link) => {
      const pathData = resolvedPathByLink.get(link.index);
      if (!pathData || !linkInEffectiveNeedles(link)) return total;
      return total + pathDataLength(pathData, stitchWidth);
    }, 0);
    const effectiveLoopCount = pattern.width * pattern.height;
    const gauge = machineGauge;

    return {
      gauge,
      needlePitchMm: gaugeToNeedlePitchMm(gauge),
      totalPathLengthStitchUnits,
      effectiveLoopCount: pattern.width * pattern.height,
      cmPer100Loops: cmPer100Loops({
        totalPathLengthStitchUnits,
        effectiveLoopCount,
        gauge,
      }),
    };
  }

  function buildYarnPathArcLength(pathByLink = resolvedPathByLink) {
    const pathData = yarnPathLinks
      .map((link) => pathByLink.get(link.index))
      .filter(Boolean)
      .join(" ");
    return pathDataArcLength(pathData);
  }

  function createModelLengthEvaluator() {
    // Solver working coordinates are isolated from the base/Renderer geometry.
    const modelState = {
      nodes: nodes.map((node) => ({ ...node })),
      yarnPath: yarnPath.map((point) => ({ ...point })),
      loopHeight,
    };
    const context = createPathLengthContext(MODEL_PATH_DIGITS);
    const evaluatePeriodic = periodicGeometry?.createModelLengthEvaluator();
    const lengthCurve = d3.line().x((point) => point.x).y((point) => point.y)
      .curve(d3.curveCatmullRomOpen).context(context);
    const prepare = (height) => {
      if (!Number.isFinite(height) || height <= 0) {
        throw new RangeError("modelLoopHeight must be a positive number.");
      }
      modelState.loopHeight = height;
      modelState.nodes.forEach((node) => {
        node.modelY = (yarnGraph.height - node.j) * height;
      });
      updateNormals(modelState);
    };
    const positionsFor = (rowCoefficients) => modelState.yarnPath.map((point) =>
      getSharedPointPosition(point, rowCoefficients, modelState)
    );
    function measureRow(links, positions, collectLengths = false) {
      let modelLength = 0;
      let measuredLinks = 0;
      const segmentLengths = collectLengths ? [] : null;
      let previous = null;
      let continuous = true;
      links.forEach((link, rowIndex) => {
        const index = link.index;
        const isLine = index === 0 || index > yarnPathLinks.length - 3;
        context.reset(!isLine);
        if (isLine) {
          context.moveTo(positions[index].x, positions[index].y);
          context.lineTo(positions[index + 1].x, positions[index + 1].y);
        } else {
          lengthCurve([positions[index - 1], positions[index], positions[index + 1], positions[index + 2]]);
        }
        const endpoints = { start: context.start, end: context.end };
        const length = context.totalLength;
        if (!context.valid) {
          throw new RangeError("Model Path contains non-finite curve coordinates.");
        }
        segmentLengths?.push(length);
        if (rowIndex > 0 && (!previous || !endpoints ||
          Math.hypot(previous.end.x - endpoints.start.x, previous.end.y - endpoints.start.y) > 1e-6)) {
          continuous = false;
        }
        previous = endpoints;
        // Own the whole outgoing link, including a float that crosses the wrap.
        // For a complete period, incoming/outgoing floats are cyclic equivalents.
        const needle = needlePosition(modelState.yarnPath[index]);
        if (measurementWindow && needle >= measurementWindow.firstNeedle &&
          needle < measurementWindow.firstNeedle + measurementWindow.needleCount) {
          modelLength += length;
          measuredLinks++;
        }
      });
      return { modelLength, measuredLinks, continuous, segmentLengths };
    }
    return (height) => {
      const windowNeedleCountByCourse = new Map();
      const measuredModelLengthPer100NeedlesByCourse = new Map();
      if (evaluatePeriodic) {
        const periodic = evaluatePeriodic(height);
        periodic.measuredModelLengthPer100NeedlesByCourse.forEach((length, row) => {
          windowNeedleCountByCourse.set(row, pattern.width);
          measuredModelLengthPer100NeedlesByCourse.set(row, length);
        });
      } else {
        prepare(height);
        const positions = positionsFor(coefficients);
        linksByRow.forEach((links, row) => {
          let measurement = measureRow(links, positions);
          if (!measurement.continuous) {
            const rowCoefficients = new Map(coefficients);
            rowCoefficients.set(row, 1);
            measurement = measureRow(links, positionsFor(rowCoefficients));
          }
          if (!measurement.measuredLinks) return;
          const count = measurementWindow.needleCount;
          windowNeedleCountByCourse.set(row, count);
          measuredModelLengthPer100NeedlesByCourse.set(row,
            normalizeModelLengthPer100Needles(measurement.modelLength, count));
        });
      }
      let modelPaths = null;
      let modelArcLength = null;
      return {
        yarnPathLinks,
        // Window width and the actual per-course integration denominator differ.
        windowNeedleCountByCourse,
        integrationNeedleCount: measurementWindow?.needleCount ?? periodic.period,
        measuredModelLengthPer100NeedlesByCourse,
        get modelPathArcLength() {
          if (modelArcLength === null) {
            prepare(height);
            const positions = positionsFor(coefficients);
            const cumulative = [0];
            linksByRow.forEach((links, row) => {
              let measurement = measureRow(links, positions, true);
              if (!measurement.continuous) {
                const rowCoefficients = new Map(coefficients);
                rowCoefficients.set(row, 1);
                measurement = measureRow(links, positionsFor(rowCoefficients), true);
              }
              measurement.segmentLengths.forEach((length) => cumulative.push(cumulative.at(-1) + length));
            });
            // Direct integration accumulates at each link endpoint, without display samples.
            modelArcLength = { totalModelLength: cumulative.at(-1), cumulativeModelArcLength: cumulative };
          }
          return modelArcLength;
        },
        // Only resultFromCandidate reads paths, after the final height is chosen.
        get modelPathByLink() {
          if (modelPaths === null) {
            prepare(height);
            modelPaths = buildResolvedPathMaps(modelState, false).modelPathByLink;
          }
          return modelPaths;
        },
      };
    };
  }

  const nodes = layoutNodes(yarnGraph);
  layoutDisplayNodes(yarnGraph);
  const yarnPath = yarnGraph.makeNice();
  const rowBoundaryIndices = new Map();
  yarnPath.forEach((point, pathIndex) => {
    point.pathIndex = pathIndex;
    const bounds = rowBoundaryIndices.get(point.row) || {
      first: pathIndex,
      last: pathIndex,
    };
    bounds.last = pathIndex;
    rowBoundaryIndices.set(point.row, bounds);
  });
  const yarnPathLinks = yarnGraph.yarnPathToLinks();
  const baseModelState = { nodes, yarnPath, loopHeight };
  const linksByRow = new Map();
  yarnPathLinks.forEach((link) => {
    const links = linksByRow.get(link.row) || [];
    links.push(link);
    linksByRow.set(link.row, links);
  });
  const coefficients = buildRowCoefficients(linksByRow);

  updateNormals();
  const periodic = measurementWindow ? null : periodicMeasurementPattern(pattern, stitchPattern);
  const periodicStitches = periodic && new Pattern(periodic.bitmap.pad(X_PADDING, Y_PADDING, 0));
  // Reuse the same topology/curve generator in a measurement-only wrap context.
  // Three copies provide both Catmull-Rom neighbours and a complete outgoing float.
  const periodicGeometry = periodic && buildYarnPathGeometry({
    pattern: periodic.bitmap,
    stitchPattern: periodicStitches,
    yarnGraph: new YarnModel(new ProcessModel(periodicStitches).cn),
    canvasWidth, canvasHeight, primaryLengthScaleY, primaryYarnDiameter,
    yarnDiameterForCourse,
    machineGauge, modelLoopHeight: loopHeight,
    includeSummaryMetrics: false,
    includeDisplayPaths: false,
    measurementWindow: { firstNeedle: X_PADDING + periodic.period, needleCount: periodic.period },
  });
  const { modelPathByLink, resolvedPathByLink } = measurementWindow
    ? { modelPathByLink: new Map(), resolvedPathByLink: new Map() }
    : buildResolvedPathMaps();
  const yarnPathArcLength = includeSummaryMetrics ? buildYarnPathArcLength() : null;
  const initialMeasurement = createModelLengthEvaluator()(loopHeight);
  const modelLengthMeasurements = {
    windowNeedleCountByCourse: initialMeasurement.windowNeedleCountByCourse,
    integrationNeedleCount: initialMeasurement.integrationNeedleCount,
    measuredModelLengthPer100NeedlesByCourse: initialMeasurement.measuredModelLengthPer100NeedlesByCourse,
  };
  const modelArcLength = includeSummaryMetrics ? initialMeasurement.modelPathArcLength : null;

  return {
    stitchWidth,
    modelGeometry: {
      ...DEFAULT_YARN_MODEL_GEOMETRY,
      loopHeight,
    },
    modelPathByLink,
    createModelLengthEvaluator,
    modelPathToCanvas,
    resolveModelPathsForDisplay,
    modelPathArcLength: modelArcLength,
    ...modelLengthMeasurements,
    yarnPathLinks,
    resolvedPathByLink,
    yarnPathArcLength,
    yarnLengthMetrics: includeSummaryMetrics ? buildYarnLengthMetrics() : null,
  };
}
