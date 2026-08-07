import * as d3 from "d3";
import {
  assertContinuousRowPaths,
  moveNeckPoint,
  pathDataLength,
} from "./rowLengthLoopModel";
import {
  cmPer100Loops,
  gaugeToNeedlePitchMm,
  normalizeMachineGauge,
} from "./yarnLengthMetrics";

export const X_PADDING = 1;
export const Y_PADDING = 0;

const STITCH_RATIO = 5 / 3;
const SPREAD = 0.88;

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
  let stitchWidth, yarnWidth, stitchHeight, halfStitch, offsetX;

  function layoutNodes(graph) {
    stitchWidth = Math.min(
      (canvasWidth * 0.9) / stitchPattern.width,
      ((canvasHeight * 0.9) / stitchPattern.height) * STITCH_RATIO
    );

    halfStitch = stitchWidth / 2;
    const baseStitchHeight = stitchWidth / STITCH_RATIO;
    stitchHeight = baseStitchHeight * primaryLengthScaleY;

    yarnWidth = stitchWidth * primaryYarnDiameter;

    offsetX = yarnWidth + (canvasWidth - stitchPattern.width * stitchWidth) / 2;
    const offsetY =
      -yarnWidth + (canvasHeight - stitchPattern.height * stitchHeight) / 2;

    graph.contactNodes.forEach((node, index) => {
      const i = index % graph.width;
      const j = (index - i) / graph.width;
      node.i = i;
      node.j = j;
      node.x = offsetX + i * halfStitch;
      node.y = offsetY + (graph.height - j) * stitchHeight;
    });

    return graph.contactNodes;
  }

  function unitNormal(prev, next, flip) {
    if (prev.index === next.index) return [0, 0];
    const x = prev.x - next.x;
    const y = prev.y - next.y;
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
    return {
      x: nodes[point.cnIndex].x + (yarnWidth / 2) * point.normal[0],
      y: nodes[point.cnIndex].y + (yarnWidth / 2) * point.normal[1],
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
    const centerI = Math.floor(point.i / 2) * 2 + 0.5;
    const centerX = offsetX + centerI * halfStitch;
    return moveNeckPoint(
      base,
      centerX,
      coefficientByRow.get(point.row) ?? 1,
      stitchHeight
    );
  }

  function yarnCurve(yarnLink, coefficientByRow) {
    const index = yarnLink.index;

    if (index == 0 || index > yarnPathLinks.length - 3) {
      const source = getSharedPointPosition(yarnPath[index], coefficientByRow);
      const target = getSharedPointPosition(
        yarnPath[index + 1],
        coefficientByRow
      );
      if (!source || !target) return "";
      return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
    }

    return openYarnCurve(
      getYarnLinkCurvePoints(yarnLink).map((point) =>
        getSharedPointPosition(point, coefficientByRow)
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

  function buildResolvedPathMap() {
    const linksByRow = new Map();
    yarnPathLinks.forEach((link) => {
      const links = linksByRow.get(link.row) || [];
      links.push(link);
      linksByRow.set(link.row, links);
    });
    const coefficients = buildRowCoefficients(linksByRow);
    const resolved = new Map();
    yarnPathLinks.forEach((link) =>
      resolved.set(link.index, yarnCurve(link, coefficients))
    );
    linksByRow.forEach((links, row) => {
      const paths = links.map((link) => resolved.get(link.index));
      if (assertContinuousRowPaths(paths, stitchWidth * 1e-6)) return;
      const rowCoefficients = new Map(coefficients);
      rowCoefficients.set(row, 1);
      links.forEach((link) =>
        resolved.set(link.index, yarnCurve(link, rowCoefficients))
      );
    });
    return resolved;
  }

  function pointInEffectiveNeedles(point) {
    const stitchColumn = Math.floor(point.i / 2);
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

  const nodes = layoutNodes(yarnGraph);
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
  const resolvedPathByLink = buildResolvedPathMap();

  return {
    stitchWidth,
    yarnPathLinks,
    resolvedPathByLink,
    yarnLengthMetrics: buildYarnLengthMetrics(),
  };
}
