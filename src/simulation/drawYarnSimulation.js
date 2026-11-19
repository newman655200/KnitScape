import { buildYarnUvStrip } from "./yarnPathUvStrip.js";
import {
  getWebglYarnRenderer,
  materialMaps,
  retainWebglYarnTextures,
} from "./yarnUvWebglRenderer.js";
import { DEFAULT_MACHINE_GAUGE } from "./yarnLengthMetrics.js";
import { pathEndpoints } from "./rowLengthLoopModel.js";
import {
  drawYarnSequenceMaskPath,
  drawYarnTexturePath,
} from "./yarnTextureBrush.js";
import { resolveYarnRenderItems } from "./yarnRenderItems.js";
import {
  YARN_UV_MAX_POINTS_PER_PATH,
  YARN_UV_SAMPLE_SPACING,
  YARN_UV_TEXTURE_REPEAT_LENGTH,
} from "../constants";

export function drawYarnSimulation({
  renderItems = null,
  canvases,
  canvasWidth,
  canvasHeight,
  yarnPathLinks,
  yarnStrands,
  uvStripCache = new Map(),
  feedYarnPlies = new Map(),
  feedYarnIds = new Map(),
  visibleYarnId = null,
  structureLineStyle = null,
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

  const resolvedItems = renderItems || resolveYarnRenderItems({
    yarnPathLinks, yarnStrands, feedYarnPlies, feedYarnIds, visibleYarnId,
    feedCount, activeYarnPlies, normalizedYarnSequence, palette, hasYarnSequenceMask,
  });

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

  function buildYarnDrawCommand(item) {
    const { link, material: rowPly, yarnIndex, strand, pathData, normalOffsetModel } = item;

    const lineWidth = stitchWidth * rowPly.diameter;
    const repeatMm = rowPly.texture?.pbr?.physicalRepeatLengthMm;
    const physicalRepeatLengthMm = Number.isFinite(repeatMm) && repeatMm > 0 ? repeatMm : undefined;
    const uvScaleKey = physicalRepeatLengthMm === undefined ? "legacy" : `${machineGauge}|${physicalRepeatLengthMm}`;
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

  function drawSegmentsToLayerFallback(context, layerGroups) {
    if (!layerGroups.length) return;

    layerGroups.forEach(({ ply, yarnIndex, items }) => {
      const maskBatches = new Map();

      items.forEach((item) => {
        const { link, pathData, yarnId } = item;
        const rowPly = item.material;

        const path = new Path2D(pathData);
        if (import.meta.env.DEV && structureLineStyle) {
          context.save();
          try {
            context.lineWidth = structureLineStyle.lineWidth;
            context.strokeStyle = structureLineStyle.colors.get(yarnId) || rowPly.color;
            context.lineCap = "round";
            context.lineJoin = "round";
            context.globalAlpha = 1;
            context.shadowBlur = 0;
            context.shadowOffsetX = 0;
            context.shadowOffsetY = 0;
            context.stroke(path);
          } finally { context.restore(); }
          return;
        }
        drawYarnTexturePath(context, path, rowPly, stitchWidth, {
          renderTextures,
        });
        collectSequenceMaskPath(maskBatches, rowPly, pathData);
      });

      drawBatchedSequenceMasks(context, maskBatches);
    });
  }

  function drawSegmentsToLayerUv(renderer, fallbackContext, layerGroups) {
    if (!renderer) {
      drawSegmentsToLayerFallback(fallbackContext, layerGroups);
      return;
    }

    renderer.retainTextures(layerTextureSources(layerGroups));
    renderer.clear(canvasWidth, canvasHeight);

    layerGroups.forEach(({ ply, yarnIndex, items }) => {
      items.forEach(item => {
        const { link } = item;
        const command = buildYarnDrawCommand(item);
        if (!command?.strip?.indices.length) return;
        renderer.drawStrip(command.strip, command.ply);
      });
    });

    renderer.flush();
  }

  frontCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  midCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  backCtx.clearRect(0, 0, canvasWidth, canvasHeight);

  const layers = { back: [], front: [], mid: [] };
  resolvedItems.groups.forEach(group => layers[group.layer].push(group));
  function layerTextureSources(layerGroups) {
    return layerGroups.flatMap(group => group.items.flatMap(item => Object.values(materialMaps(item.material))));
  }
  for (const [layer, canvas] of Object.entries({ back: backCanvas, front: frontCanvas, mid: midCanvas })) {
    retainWebglYarnTextures(canvas, layerTextureSources(layers[layer]));
  }

  if (renderUvTextures && !(import.meta.env.DEV && structureLineStyle)) {
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
