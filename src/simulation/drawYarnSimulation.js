import { buildYarnUvStrip } from "./yarnPathUvStrip.js";
import { getWebglYarnRenderer } from "./yarnUvWebglRenderer.js";
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
  resolvedPathByLink,
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

  function rowYarnPly(link, ply) {
    if (!hasYarnSequenceMask) return ply;

    const paletteIndex = yarnIndexForSequenceRow(
      normalizedYarnSequence,
      link.row
    );
    const sequenceMaskColor =
      palette[paletteIndex] || activeYarnPlies[paletteIndex]?.color;

    if (!sequenceMaskColor) return ply;
    return { ...ply, sequenceMaskColor };
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

  frontCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  midCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  backCtx.clearRect(0, 0, canvasWidth, canvasHeight);

  const layers = { front: [], back: [], mid: [] };
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
