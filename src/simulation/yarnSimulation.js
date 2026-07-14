import { ProcessModel } from "./ProcessModel";
import { Pattern } from "./Pattern";
import { YarnModel } from "./YarnModel";
import {
  drawYarnSequenceMaskPath,
  drawYarnTexturePath,
  prepareYarnTextureImages,
} from "./yarnTextureBrush";
import { buildYarnUvStrip } from "./yarnPathUvStrip.js";
import { getWebglYarnRenderer } from "./yarnUvWebglRenderer.js";
import { normalizeYarnTexture } from "../yarnTexture/yarnScanTexture";
import {
  normalizeYarnSequence,
  yarnIndexForSequenceRow,
} from "../actions/yarnSequenceRows";
import {
  TEXTURE_PERFORMANCE_MODES,
  YARN_UV_MAX_POINTS_PER_PATH,
  YARN_UV_SAMPLE_SPACING,
  YARN_UV_TEXTURE_REPEAT_LENGTH,
} from "../constants";
import {
  assertContinuousRowPaths,
  moveNeckPoint,
  pathDataLength,
} from "./rowLengthLoopModel";
import {
  DEFAULT_MACHINE_GAUGE,
  cmPer100Loops,
  gaugeToNeedlePitchMm,
  normalizeMachineGauge,
} from "./yarnLengthMetrics";
import * as d3 from "d3";

// Number of stitches to add to the left and right of the pattern
// (need to do this because tuck / slip stitches can't be on the
// end of the row)
const X_PADDING = 1;

// Number of rows to add to the top and bottom of the pattern
// (will be drawn in a different transparent color)
const Y_PADDING = 0;

const STITCH_RATIO = 5 / 3; // Row height / stitch width
const YARN_RATIO = 0.24;

const SPREAD = 0.88;

// Sim constants
const dpi = devicePixelRatio;

function normalizeYarnPlies(yarnPlies, palette) {
  const fallbackColor = palette?.[0] || "rgba(190,190,190,1)";
  const source =
    Array.isArray(yarnPlies) && yarnPlies.length
      ? yarnPlies
      : [
          {
            color: fallbackColor,
            diameter: YARN_RATIO,
            enabled: true,
            texture: null,
          },
        ];

  const normalized = source
    .filter((ply) => ply?.enabled !== false)
    .map((ply) => ({
      color: ply.color || fallbackColor,
      diameter:
        Number.isFinite(Number(ply.diameter)) && Number(ply.diameter) > 0
          ? Number(ply.diameter)
          : YARN_RATIO,
      texture: normalizeYarnTexture(ply.texture),
    }));

  return normalized.length
    ? normalized
    : [
        {
          color: fallbackColor,
          diameter: YARN_RATIO,
          texture: null,
        },
      ];
}

function shouldRenderTextures({
  texturePerformanceMode = TEXTURE_PERFORMANCE_MODES.AUTO,
  texturePreviewInteractionActive = false,
} = {}) {
  if (texturePerformanceMode === TEXTURE_PERFORMANCE_MODES.SOLID) return false;
  if (texturePerformanceMode === TEXTURE_PERFORMANCE_MODES.AUTO) {
    return !texturePreviewInteractionActive;
  }
  return true;
}

function hasUvTextureMap(ply) {
  const texture = normalizeYarnTexture(ply.texture);
  if (!texture || texture.enabled === false) return false;

  return Boolean(
    texture.processedDataUrl ||
      texture.pbr?.baseColor?.processedDataUrl ||
      texture.pbr?.baseColor?.dataUrl
  );
}

function isNeutralYarnSequence(yarnSequence) {
  const pixels = Array.from(yarnSequence?.pixels || []);
  return !pixels.length || pixels.every((pixel) => Number(pixel) === 0);
}

export function simulate(
  pattern,
  yarnSequence,
  palette,
  scale,
  yarnPlies,
  {
    machineGauge = DEFAULT_MACHINE_GAUGE,
    texturePerformanceMode = TEXTURE_PERFORMANCE_MODES.AUTO,
    texturePreviewInteractionActive = false,
  } = {}
) {
  let stopped = false;
  let stitchWidth, yarnWidth, stitchHeight, halfStitch, offsetX;
  const normalizedYarnSequence = normalizeYarnSequence(yarnSequence);
  const activeYarnPlies = normalizeYarnPlies(yarnPlies, palette);
  const hasYarnSequenceMask = !isNeutralYarnSequence(normalizedYarnSequence);
  const primaryLengthScaleY = Math.min(
    1.1,
    Math.max(0.9, Number(yarnPlies?.[0]?.lengthScaleY) || 1)
  );
  const renderTextures = shouldRenderTextures({
    texturePerformanceMode,
    texturePreviewInteractionActive,
  });
  const renderUvTextures =
    renderTextures && activeYarnPlies.some((ply) => hasUvTextureMap(ply));

  performance.clearMeasures();
  performance.mark("start");

  ///////////////////////
  // INITIALIZE NODES
  ///////////////////////

  function layoutNodes(yarnGraph) {
    // calculates the x,y values for the i,j

    stitchWidth = Math.min(
      (canvasWidth * 0.9) / stitchPattern.width,
      ((canvasHeight * 0.9) / stitchPattern.height) * STITCH_RATIO
    );

    halfStitch = stitchWidth / 2;
    const baseStitchHeight = stitchWidth / STITCH_RATIO;
    stitchHeight = baseStitchHeight * primaryLengthScaleY;

    yarnWidth = stitchWidth * activeYarnPlies[0].diameter;

    offsetX = yarnWidth + (canvasWidth - stitchPattern.width * stitchWidth) / 2;
    const offsetY =
      -yarnWidth + (canvasHeight - stitchPattern.height * stitchHeight) / 2;

    yarnGraph.contactNodes.forEach((node, index) => {
      const i = index % yarnGraph.width;
      const j = (index - i) / yarnGraph.width;
      node.i = i;
      node.j = j;
      node.x = offsetX + i * halfStitch;
      node.y = offsetY + (yarnGraph.height - j) * stitchHeight;
    });

    return yarnGraph.contactNodes;
  }

  function unitNormal(prev, next, flip) {
    if (prev.index === next.index) return [0, 0];
    const x = prev.x - next.x;
    const y = prev.y - next.y;

    const mag = SPREAD * Math.sqrt(x ** 2 + y ** 2);

    if (flip) {
      return [-y / mag, x / mag];
    } else {
      return [y / mag, -x / mag];
    }
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
        // headnode
        if (yarnPath[index].row % 2 == 0) {
          // moving right
          flip = true;
        } else {
          // moving left
          flip = false;
        }
      } else {
        // legnode
        if (yarnPath[index].row % 2 == 0) {
          // moving right
          flip = false;
        } else {
          // moving left
          flip = true;
        }
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

  let rowBoundaryIndices;

  function getSharedPointPosition(point, coefficientByRow) {
    const base = getBasePointPosition(point);
    const bounds = rowBoundaryIndices.get(point.row);
    const isBoundary = point.pathIndex === bounds?.first || point.pathIndex === bounds?.last;
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
      const target = getSharedPointPosition(yarnPath[index + 1], coefficientByRow);
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
    yarnPathLinks.forEach((link) => resolved.set(link.index, yarnCurve(link, coefficients)));
    linksByRow.forEach((links, row) => {
      const paths = links.map((link) => resolved.get(link.index));
      if (assertContinuousRowPaths(paths, stitchWidth * 1e-6)) return;
      const fallback = new Map(coefficients);
      fallback.set(row, 1);
      links.forEach((link) => resolved.set(link.index, yarnCurve(link, fallback)));
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

  function sortSegments() {
    const sortedSegments = {
      front: [],
      back: [],
      mid: [],
    };

    return sortedSegments;
  }

  ///////////////////////
  // DRAW
  ///////////////////////
  function rowYarnPly(link, ply) {
    if (!hasYarnSequenceMask) return ply;

    const paletteIndex = yarnIndexForSequenceRow(
      normalizedYarnSequence,
      link.row
    );
    const sequenceMaskColor =
      palette[paletteIndex] || activeYarnPlies[paletteIndex]?.color;

    if (!sequenceMaskColor) return ply;

    return {
      ...ply,
      sequenceMaskColor,
    };
  }

  function collectSequenceMaskPath(maskBatches, ply, pathData) {
    if (!ply.sequenceMaskColor || !pathData) return;

    const lineWidth = stitchWidth * ply.diameter;
    const key = `${lineWidth}|${ply.sequenceMaskColor}`;
    const batch =
      maskBatches.get(key) ||
      {
        lineWidth,
        sequenceMaskColor: ply.sequenceMaskColor,
        pathParts: [],
      };

    batch.pathParts.push(pathData);
    maskBatches.set(key, batch);
  }

  function drawBatchedSequenceMasks(context, maskBatches) {
    maskBatches.forEach((batch) => {
      if (!batch.pathParts.length) return;

      drawYarnSequenceMaskPath(
        context,
        new Path2D(batch.pathParts.join(" ")),
        batch.lineWidth,
        batch.sequenceMaskColor
      );
    });
  }

  let resolvedPathByLink;

  function buildYarnDrawCommand(link, ply) {
    const rowPly = rowYarnPly(link, ply);
    const pathData = resolvedPathByLink.get(link.index);
    if (!pathData) return null;

    const lineWidth = stitchWidth * rowPly.diameter;
    return {
      link,
      ply: rowPly,
      pathData,
      lineWidth,
      strip: buildYarnUvStrip({
        pathData,
        yarnWidth: lineWidth,
        textureRepeatLength: YARN_UV_TEXTURE_REPEAT_LENGTH,
        sampleSpacing: YARN_UV_SAMPLE_SPACING,
        maxPoints: YARN_UV_MAX_POINTS_PER_PATH,
      }),
    };
  }

  function drawSegmentsToLayerFallback(context, layerLinks) {
    if (!layerLinks.length) return;

    activeYarnPlies.forEach((ply) => {
      const maskBatches = new Map();

      layerLinks.forEach((link) => {
        const rowPly = rowYarnPly(link, ply);
        const pathData = resolvedPathByLink.get(link.index);
        if (!pathData) return;

        const path = new Path2D(pathData);
        drawYarnTexturePath(context, path, rowPly, stitchWidth, {
          renderTextures,
        });
        collectSequenceMaskPath(maskBatches, rowPly, pathData);
      });

      drawBatchedSequenceMasks(context, maskBatches);
    });
  }

  function drawSegmentsToLayerUv(renderer, fallbackContext, layerLinks) {
    if (!renderer) {
      drawSegmentsToLayerFallback(fallbackContext, layerLinks);
      return;
    }

    renderer.clear(canvasWidth, canvasHeight);

    activeYarnPlies.forEach((ply) => {
      layerLinks.forEach((link) => {
        const command = buildYarnDrawCommand(link, ply);
        if (!command?.strip?.indices.length) return;
        renderer.drawStrip(command.strip, command.ply);
      });
    });

    renderer.flush();
  }

  function draw() {
    frontCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    midCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    backCtx.clearRect(0, 0, canvasWidth, canvasHeight);

    updateNormals();
    resolvedPathByLink ||= buildResolvedPathMap();

    const layers = sortSegments();

    yarnPathLinks.forEach((link) => {
      layers[link.layer].push(link);
    });

    if (renderUvTextures) {
      drawSegmentsToLayerUv(
        getWebglYarnRenderer(backCanvas),
        backCtx,
        layers.back
      );
      drawSegmentsToLayerUv(
        getWebglYarnRenderer(frontCanvas),
        frontCtx,
        layers.front
      );
      drawSegmentsToLayerUv(getWebglYarnRenderer(midCanvas), midCtx, layers.mid);
      return;
    }

    drawSegmentsToLayerFallback(backCtx, layers.back);
    drawSegmentsToLayerFallback(frontCtx, layers.front);
    drawSegmentsToLayerFallback(midCtx, layers.mid);
  }

  function stopSim() {
    stopped = true;
  }

  ///////////////////////
  // INIT PATTERN
  ///////////////////////

  const stitchPattern = new Pattern(pattern.pad(X_PADDING, Y_PADDING, 0));

  ///////////////////////
  // INIT CANVASES
  ///////////////////////

  const bbox = document.getElementById("sim-container").getBoundingClientRect();

  const width = bbox.width * scale;
  const height = bbox.height * scale;
  const canvasWidth = dpi * width;
  const canvasHeight = dpi * height;

  function getCanvases(canvasIDs) {
    return canvasIDs.map((canvasID) => {
      let canvas = document.getElementById(canvasID);
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.cssText = `width: ${width}px; height: ${height}px;`;
      return canvas;
    });
  }

  let [backCanvas, midCanvas, frontCanvas] = getCanvases([
    "back",
    "mid",
    "front",
  ]);

  const backCtx = backCanvas.getContext("2d");
  const midCtx = midCanvas.getContext("2d");
  const frontCtx = frontCanvas.getContext("2d");

  ///////////////////////
  // BUILD SIMULATION DATA
  ///////////////////////

  const testModel = new ProcessModel(stitchPattern);

  const yarnGraph = new YarnModel(testModel.cn);

  const nodes = layoutNodes(yarnGraph);

  const yarnPath = yarnGraph.makeNice();
  rowBoundaryIndices = new Map();
  yarnPath.forEach((point, pathIndex) => {
    point.pathIndex = pathIndex;
    const bounds = rowBoundaryIndices.get(point.row) || { first: pathIndex, last: pathIndex };
    bounds.last = pathIndex;
    rowBoundaryIndices.set(point.row, bounds);
  });

  const yarnPathLinks = yarnGraph.yarnPathToLinks();
  draw();
  const yarnLengthMetrics = buildYarnLengthMetrics();
  if (renderTextures) {
    prepareYarnTextureImages(activeYarnPlies).then(() => {
      if (!stopped) draw();
    });
  }

  return { stopSim, yarnLengthMetrics };
}
