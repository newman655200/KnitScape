const STITCH_RATIO = 5 / 3;

// This is the original display layout formula, shared with path construction.
export function simulationViewportLayout({ canvasWidth, canvasHeight, stitchPattern,
  primaryLengthScaleY, primaryYarnDiameter }) {
  const stitchWidth = Math.min((canvasWidth * 0.9) / stitchPattern.width,
    ((canvasHeight * 0.9) / stitchPattern.height) * STITCH_RATIO);
  const baseStitchHeight = stitchWidth / STITCH_RATIO;
  const stitchHeight = baseStitchHeight * primaryLengthScaleY;
  const yarnWidth = stitchWidth * primaryYarnDiameter;
  return { stitchWidth,
    offsetX: yarnWidth + (canvasWidth - stitchPattern.width * stitchWidth) / 2,
    offsetY: -yarnWidth + (canvasHeight - stitchPattern.height * stitchHeight) / 2 };
}

// Display-only affine projection. The reference paths (including their original
// rounding) and every base/applied model path remain untouched.
export function projectSimulationViewport(snapshot, { canvasWidth, canvasHeight }) {
  const source = simulationViewportLayout({ ...snapshot, ...snapshot.referenceViewport });
  const target = simulationViewportLayout({ ...snapshot, canvasWidth, canvasHeight });
  if (canvasWidth === snapshot.canvasWidth && canvasHeight === snapshot.canvasHeight)
    return { canvasWidth, canvasHeight, stitchWidth: snapshot.stitchWidth, yarnStrands: snapshot.yarnStrands };
  const ratio = source.stitchWidth ? target.stitchWidth / source.stitchWidth : 1;
  function project(path) {
    let coordinate = 0;
    return path.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, value => {
      const axis = coordinate++ % 2 === 0 ? "offsetX" : "offsetY";
      return String(target[axis] + (Number(value) - source[axis]) * ratio);
    });
  }
  return { canvasWidth, canvasHeight, stitchWidth: target.stitchWidth,
    yarnStrands: snapshot.yarnStrands.map(strand => ({ ...strand,
      resolvedPathByLink: new Map([...strand.resolvedPathByLink].map(([id, data]) => [id, project(data)])),
    })) };
}
