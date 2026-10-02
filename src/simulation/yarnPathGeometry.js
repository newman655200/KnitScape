import * as d3 from "d3";
import {
  assertContinuousRowPaths,
  moveNeckPoint,
  pathDataArcLength,
  pathDataLength,
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
}) {
  const loopHeight =
    DEFAULT_YARN_MODEL_GEOMETRY.loopHeight * primaryLengthScaleY;
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

  function updateNormals() {
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
    .digits(6);

  function getBasePointPosition(point) {
    const node = nodes[point.cnIndex];
    return {
      x: node.modelX + (primaryYarnDiameter / 2) * point.normal[0],
      y: node.modelY + (primaryYarnDiameter / 2) * point.normal[1],
    };
  }

  function getYarnLinkCurvePoints(yarnLink) {
    const index = yarnLink.index;
    return [
      yarnPath[index - 1],
      yarnPath[index],
      yarnPath[index + 1],
      yarnPath[index + 2],
    ];
  }

  function getSharedPointPosition(point, coefficientByRow) {
    const base = getBasePointPosition(point);
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
      loopHeight
    );
  }

  function yarnCurve(
    yarnLink,
    coefficientByRow,
    transformPoint = IDENTITY_POINT
  ) {
    const index = yarnLink.index;

    if (index == 0 || index > yarnPathLinks.length - 3) {
      const source = transformPoint(
        getSharedPointPosition(yarnPath[index], coefficientByRow)
      );
      const target = transformPoint(
        getSharedPointPosition(yarnPath[index + 1], coefficientByRow)
      );
      if (!source || !target) return "";
      return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
    }

    return openYarnCurve(
      getYarnLinkCurvePoints(yarnLink).map((point) =>
        transformPoint(getSharedPointPosition(point, coefficientByRow))
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

  function buildResolvedPathMaps() {
    const linksByRow = new Map();
    yarnPathLinks.forEach((link) => {
      const links = linksByRow.get(link.row) || [];
      links.push(link);
      linksByRow.set(link.row, links);
    });
    const coefficients = buildRowCoefficients(linksByRow);
    const coefficientByLink = new Map(
      yarnPathLinks.map((link) => [link.index, coefficients])
    );
    linksByRow.forEach((links, row) => {
      const paths = links.map((link) => yarnCurve(link, coefficients));
      if (assertContinuousRowPaths(paths, 1e-6)) return;
      const rowCoefficients = new Map(coefficients);
      rowCoefficients.set(row, 1);
      links.forEach((link) => coefficientByLink.set(link.index, rowCoefficients));
    });

    const modelPathByLink = new Map();
    const resolvedPathByLink = new Map();
    yarnPathLinks.forEach((link) => {
      const linkCoefficients = coefficientByLink.get(link.index);
      modelPathByLink.set(link.index, yarnCurve(link, linkCoefficients));
      resolvedPathByLink.set(
        link.index,
        yarnCurve(link, linkCoefficients, modelToCanvasPoint)
      );
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

  updateNormals();
  const { modelPathByLink, resolvedPathByLink } = buildResolvedPathMaps();
  const yarnPathArcLength = buildYarnPathArcLength();
  const modelArcLength = buildYarnPathArcLength(modelPathByLink);
  const modelLengthMeasurements = buildModelLengthMeasurementsByCourse();

  return {
    stitchWidth,
    modelGeometry: {
      ...DEFAULT_YARN_MODEL_GEOMETRY,
      loopHeight,
    },
    modelPathByLink,
    modelPathArcLength: {
      totalModelLength: modelArcLength.totalLength,
      cumulativeModelArcLength: modelArcLength.cumulativeArcLength,
    },
    ...modelLengthMeasurements,
    yarnPathLinks,
    resolvedPathByLink,
    yarnPathArcLength,
    yarnLengthMetrics: buildYarnLengthMetrics(),
  };
}
