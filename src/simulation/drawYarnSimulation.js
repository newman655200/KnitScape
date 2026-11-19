import { buildYarnUvStrip } from "./yarnPathUvStrip.js";
import {
  getWebglYarnRenderer,
  materialMaps,
  retainWebglYarnTextures,
} from "./yarnUvWebglRenderer.js";
import { courseToFeedIndex, DEFAULT_MACHINE_GAUGE } from "./yarnLengthMetrics.js";
import { pathEndpoints } from "./rowLengthLoopModel.js";
import {
  drawYarnSequenceMaskPath,
  drawYarnTexturePath,
} from "./yarnTextureBrush.js";
import { yarnIndexForSequenceRow } from "../actions/yarnSequenceRows";
import {
  YARN_UV_MAX_POINTS_PER_PATH,
  YARN_UV_SAMPLE_SPACING,
  YARN_UV_TEXTURE_REPEAT_LENGTH,
} from "../constants";

export function drawYarnSimulation({
  canvases,
  canvasWidth,
  canvasHeight,
  yarnPathLinks,
  yarnStrands,
  uvStripCache = new Map(),
  feedYarnPlies = new Map(),
  feedCount = 0,
  machineGauge = DEFAULT_MACHINE_GAUGE,
  stitchWidth,
  activeYarnPlies,
  normalizedYarnSequence,
  palette,
  hasYarnSequenceMask,
  renderTextures,
  renderUvTextures,
}) {
  const { backCanvas, midCanvas, frontCanvas } = canvases;
  const backCtx = backCanvas.getContext("2d");
  const midCtx = midCanvas.getContext("2d");
  const frontCtx = frontCanvas.getContext("2d");

  function rowYarnPly(link, ply, yarnIndex = 0) {
    const assigned = feedYarnPlies.get(courseToFeedIndex(link.row, feedCount || 1));
    const explicitMaterial = assigned?.some(item => item.assetMaterial) || assigned?.length > 1;
    if (ply !== activeYarnPlies[0] && explicitMaterial) return null;
    if (ply === activeYarnPlies[0] && feedCount) {
      const plies = feedYarnPlies.get(courseToFeedIndex(link.row, feedCount));
      if (plies) ply = plies[yarnIndex];
      else if (yarnIndex > 0) return null;
      if (!ply) return null;
    }
    if (!hasYarnSequenceMask || ply.assetMaterial) return ply;

    const paletteIndex = yarnIndexForSequenceRow(
      normalizedYarnSequence,
      link.row
    );
    const sequenceMaskColor =
      palette[paletteIndex] || activeYarnPlies[paletteIndex]?.color;

    if (!sequenceMaskColor) return ply;
    return { ...ply, sequenceMaskColor };
  }

  function forEachStrand(ply, drawStrand) {
    const count = ply === activeYarnPlies[0] ? yarnStrands.length : 1;
    for (let yarnIndex = 0; yarnIndex < count; yarnIndex++) drawStrand(yarnIndex);
  }

  function parallelOffset(link, ply, yarnIndex) {
    if (ply !== activeYarnPlies[0] || !feedCount) return 0;
    const plies = feedYarnPlies.get(courseToFeedIndex(link.row, feedCount));
    if (!plies) return 0;
    const total = plies.reduce((sum, item) => sum + item.diameter, 0);
    return plies.slice(0, yarnIndex).reduce((sum, item) => sum + item.diameter, 0)
      + plies[yarnIndex].diameter / 2 - total / 2;
  }

  function collectSequenceMaskPath(maskBatches, ply, pathData) {
    if (!ply.sequenceMaskColor || !pathData) return;

    const lineWidth = stitchWidth * ply.diameter;
    const key = `${lineWidth}|${ply.sequenceMaskColor}`;
    const batch = maskBatches.get(key) || {
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

  function buildYarnDrawCommand(link, ply, yarnIndex) {
    const rowPly = rowYarnPly(link, ply, yarnIndex);
    const strand = yarnStrands[yarnIndex];
    const pathData = strand.resolvedPathByLink.get(link.index);
    if (!rowPly || !pathData) return null;

    const lineWidth = stitchWidth * rowPly.diameter;
    const repeatMm = rowPly.texture?.pbr?.physicalRepeatLengthMm;
    const physicalRepeatLengthMm = Number.isFinite(repeatMm) && repeatMm > 0 ? repeatMm : undefined;
    const uvScaleKey = physicalRepeatLengthMm === undefined ? "legacy" : `${machineGauge}|${physicalRepeatLengthMm}`;
    const normalOffsetModel = parallelOffset(link, ply, yarnIndex);
    const key = `${yarnIndex}|${link.index}|${lineWidth}|${normalOffsetModel}|${uvScaleKey}`;
    if (!uvStripCache.has(key)) {
      const modelPathData = strand.modelPathByLink.get(link.index);
      const modelStart = pathEndpoints(modelPathData)?.start;
      const displayStart = pathEndpoints(pathData)?.start;
      if (!modelStart || !displayStart) return null;
      uvStripCache.set(key, buildYarnUvStrip({
        modelPathData,
        modelToCanvasPoint: point => ({
          x: displayStart.x + (point.x - modelStart.x) * stitchWidth,
          y: displayStart.y + (point.y - modelStart.y) * stitchWidth,
        }),
        arcLengthOffset: strand.uvOffsets?.get(link.index),
        normalOffsetModel,
        yarnWidth: lineWidth,
        textureRepeatLength: YARN_UV_TEXTURE_REPEAT_LENGTH,
        physicalRepeatLengthMm,
        machineGauge,
        sampleSpacing: YARN_UV_SAMPLE_SPACING,
        maxPoints: YARN_UV_MAX_POINTS_PER_PATH,
      }));
    }
    return {
      link,
      ply: rowPly,
      pathData,
      lineWidth,
      strip: uvStripCache.get(key),
    };
  }

  function drawSegmentsToLayerFallback(context, layerLinks) {
    if (!layerLinks.length) return;

    activeYarnPlies.forEach(ply => forEachStrand(ply, yarnIndex => {
      const maskBatches = new Map();

      layerLinks.forEach((link) => {
        const rowPly = rowYarnPly(link, ply, yarnIndex);
        let pathData = yarnStrands[yarnIndex].resolvedPathByLink.get(link.index);
        if (!rowPly || !pathData) return;
        if (parallelOffset(link, ply, yarnIndex) !== 0) {
          const positions = buildYarnDrawCommand(link, ply, yarnIndex)?.strip.positions;
          if (!positions) return;
          const points = [];
          for (let i = 0; i < positions.length; i += 4) {
            points.push(`${i === 0 ? "M" : "L"} ${(positions[i] + positions[i + 2]) / 2} ${(positions[i + 1] + positions[i + 3]) / 2}`);
          }
          pathData = points.join(" ");
        }

        const path = new Path2D(pathData);
        drawYarnTexturePath(context, path, rowPly, stitchWidth, {
          renderTextures,
        });
        collectSequenceMaskPath(maskBatches, rowPly, pathData);
      });

      drawBatchedSequenceMasks(context, maskBatches);
    }));
  }

  function drawSegmentsToLayerUv(renderer, fallbackContext, layerLinks) {
    if (!renderer) {
      drawSegmentsToLayerFallback(fallbackContext, layerLinks);
      return;
    }

    renderer.retainTextures(layerTextureSources(layerLinks));
    renderer.clear(canvasWidth, canvasHeight);

    activeYarnPlies.forEach(ply => forEachStrand(ply, yarnIndex => {
      layerLinks.forEach((link) => {
        const command = buildYarnDrawCommand(link, ply, yarnIndex);
        if (!command?.strip?.indices.length) return;
        renderer.drawStrip(command.strip, command.ply);
      });
    }));

    renderer.flush();
  }

  frontCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  midCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  backCtx.clearRect(0, 0, canvasWidth, canvasHeight);

  const layers = { front: [], back: [], mid: [] };
  yarnPathLinks.forEach((link) => {
    layers[link.layer].push(link);
  });
  function layerTextureSources(layerLinks) {
    const sources = [];
    layerLinks.forEach(link => activeYarnPlies.forEach(ply => forEachStrand(ply, yarnIndex => {
      const material = rowYarnPly(link, ply, yarnIndex);
      if (material) sources.push(...Object.values(materialMaps(material)));
    })));
    return sources;
  }
  for (const [layer, canvas] of Object.entries({ back: backCanvas, front: frontCanvas, mid: midCanvas })) {
    retainWebglYarnTextures(canvas, layerTextureSources(layers[layer]));
  }

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
    drawSegmentsToLayerUv(
      getWebglYarnRenderer(midCanvas),
      midCtx,
      layers.mid
    );
    return;
  }

  drawSegmentsToLayerFallback(backCtx, layers.back);
  drawSegmentsToLayerFallback(frontCtx, layers.front);
  drawSegmentsToLayerFallback(midCtx, layers.mid);
}
