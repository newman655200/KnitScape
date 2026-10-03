import * as d3 from "d3";
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

export function buildYarnPathGeometry({
  pattern,
  stitchPattern,
  yarnGraph,
  canvasWidth,
  canvasHeight,
  primaryLengthScaleY,
  primaryYarnDiameter,
  machineGauge,
  modelLoopHeight = null,
  includeSummaryMetrics = true,
  includeDisplayPaths = true,
}) {
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
    return {
      x: node.modelX + (primaryYarnDiameter / 2) * point.normal[0],
      y: node.modelY + (primaryYarnDiameter / 2) * point.normal[1],
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
    const gauge = normalizeMachineGauge(machineGauge);

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

  function buildModelLengthMeasurementsByCourse() {
    const measurements = new Map();
    yarnPathLinks.forEach((link) => {
      const pathData = modelPathByLink.get(link.index);
      if (!pathData || !linkInEffectiveNeedles(link)) return;
      const sourceNeedle = needlePosition(yarnPath[link.index]);
      const targetNeedle = needlePosition(yarnPath[link.index + 1]);
      const measurement = measurements.get(link.row) ?? {
        modelLength: 0,
        firstNeedle: Infinity,
        lastNeedle: -Infinity,
      };
      measurement.modelLength += pathDataLength(pathData);
      measurement.firstNeedle = Math.min(
        measurement.firstNeedle,
        sourceNeedle,
        targetNeedle
      );
      measurement.lastNeedle = Math.max(
        measurement.lastNeedle,
        sourceNeedle,
        targetNeedle
      );
      measurements.set(link.row, measurement);
    });

    const measuredNeedleCountByCourse = new Map();
    const measuredModelLengthPer100NeedlesByCourse = new Map();
    measurements.forEach((measurement, course) => {
      const measuredNeedleCount =
        measurement.lastNeedle - measurement.firstNeedle + 1;
      measuredNeedleCountByCourse.set(course, measuredNeedleCount);
      measuredModelLengthPer100NeedlesByCourse.set(
        course,
        normalizeModelLengthPer100Needles(
          measurement.modelLength,
          measuredNeedleCount
        )
      );
    });

    return {
      measuredNeedleCountByCourse,
      measuredModelLengthPer100NeedlesByCourse,
    };
  }

  function createModelLengthEvaluator() {
    // Solver working coordinates are isolated from the base/Renderer geometry.
    const modelState = {
      nodes: nodes.map((node) => ({ ...node })),
      yarnPath: yarnPath.map((point) => ({ ...point })),
      loopHeight,
    };
    const context = createPathLengthContext(MODEL_PATH_DIGITS);
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
    function measureRow(links, positions, rowCoefficients) {
      let modelLength = 0;
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
        let endpoints = { start: context.start, end: context.end };
        let length = context.totalLength;
        if (!context.valid) {
          const pathData = yarnCurve(link, rowCoefficients, IDENTITY_POINT, modelState);
          endpoints = pathData ? pathEndpoints(pathData) : null;
          length = pathData ? pathDataLength(pathData) : 0;
        }
        if (rowIndex > 0 && (!previous || !endpoints ||
          Math.hypot(previous.end.x - endpoints.start.x, previous.end.y - endpoints.start.y) > 1e-6)) {
          continuous = false;
        }
        previous = endpoints;
        if (linkInEffectiveNeedles(link)) modelLength += length;
      });
      return { modelLength, continuous };
    }
    return (height) => {
      prepare(height);
      const positions = positionsFor(coefficients);
      const measuredModelLengthPer100NeedlesByCourse = new Map();
      linksByRow.forEach((links, row) => {
        let measurement = measureRow(links, positions, coefficients);
        if (!measurement.continuous) {
          const rowCoefficients = new Map(coefficients);
          rowCoefficients.set(row, 1);
          measurement = measureRow(links, positionsFor(rowCoefficients), rowCoefficients);
        }
        const needleCount = modelLengthMeasurements.measuredNeedleCountByCourse.get(row);
        if (needleCount !== undefined) {
          measuredModelLengthPer100NeedlesByCourse.set(row,
            normalizeModelLengthPer100Needles(measurement.modelLength, needleCount));
        }
      });
      let modelPaths = null;
      return {
        yarnPathLinks,
        measuredModelLengthPer100NeedlesByCourse,
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
  const { modelPathByLink, resolvedPathByLink } = buildResolvedPathMaps();
  const yarnPathArcLength = includeSummaryMetrics ? buildYarnPathArcLength() : null;
  const modelArcLength = includeSummaryMetrics
    ? buildYarnPathArcLength(modelPathByLink)
    : null;
  const modelLengthMeasurements = buildModelLengthMeasurementsByCourse();

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
    modelPathArcLength: modelArcLength && {
      totalModelLength: modelArcLength.totalLength,
      cumulativeModelArcLength: modelArcLength.cumulativeArcLength,
    },
    ...modelLengthMeasurements,
    yarnPathLinks,
    resolvedPathByLink,
    yarnPathArcLength,
    yarnLengthMetrics: includeSummaryMetrics ? buildYarnLengthMetrics() : null,
  };
}
