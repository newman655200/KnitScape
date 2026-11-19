function stroke(context, path, lineWidth, color, alpha = 1) {
  context.lineWidth = lineWidth;
  context.strokeStyle = color;
  context.globalAlpha = alpha;
  context.stroke(path);
}

function drawSolidPath(context, path, item, lineWidth, structureLineStyle) {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  try {
    if (structureLineStyle) {
      context.shadowBlur = 0;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 0;
      stroke(context, path, structureLineStyle.lineWidth,
        structureLineStyle.colors.get(item.yarnId) || item.color);
    } else {
      stroke(context, path, lineWidth * 1.1, "rgba(0, 0, 0, 0.16)");
      stroke(context, path, lineWidth, item.color);
    }
  } finally {
    context.globalAlpha = 1;
    context.restore();
  }
}

function drawSequenceMask(context, batch) {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  const previousComposite = context.globalCompositeOperation;
  try {
    context.globalCompositeOperation = "multiply";
    stroke(context, new Path2D(batch.paths.join(" ")), batch.lineWidth * 1.02, batch.color, .38);
    context.globalCompositeOperation = previousComposite || "source-over";
  } finally {
    context.globalAlpha = 1;
    context.restore();
  }
}

// The host owns dimensions, CSS and front/back Canvas mapping. Groups already
// contain every assignment, material, visibility, mask and logical 2D layer
// decision. This renderer only paints their resolved display paths.
export function createClassic2dRenderer() {
  let canvases = null, disposed = false;
  let status = Object.freeze({ phase: "unmounted", failedTextureCount: 0 });
  let ready = Promise.resolve(status);
  const setStatus = phase => {
    status = Object.freeze({ phase, failedTextureCount: 0 });
    return status;
  };

  const api = {
    mount(nextCanvases) {
      if (disposed) throw new Error("A disposed Classic renderer cannot be mounted again.");
      if (canvases && Object.keys(canvases).some(key => canvases[key] !== nextCanvases[key])) {
        throw new Error("Dispose a Classic renderer before mounting different canvases.");
      }
      canvases = nextCanvases;
      setStatus("mounted");
      return api;
    },
    update(scene) {
      if (disposed) return ready;
      if (!canvases) throw new Error("Mount Classic canvases before updating the scene.");
      if (!scene?.renderItems?.groups) throw new TypeError("Classic requires resolved renderItems.groups.");
      const { renderItems, canvasWidth, canvasHeight, stitchWidth } = scene;
      const structureLineStyle = import.meta.env.DEV ? scene.structureLineStyle : null;
      const contexts = {
        back: canvases.backCanvas.getContext("2d"),
        mid: canvases.midCanvas.getContext("2d"),
        front: canvases.frontCanvas.getContext("2d"),
      };
      for (const layer of ["front", "mid", "back"]) {
        contexts[layer].clearRect(0, 0, canvasWidth, canvasHeight);
      }
      for (const group of renderItems.groups) {
        const context = contexts[group.layer], masks = new Map();
        for (const item of group.items) {
          const lineWidth = stitchWidth * item.diameter;
          drawSolidPath(context, new Path2D(item.pathData), item, lineWidth, structureLineStyle);
          if (structureLineStyle || !item.sequenceMaskColor) continue;
          const key = `${lineWidth}|${item.sequenceMaskColor}`;
          const batch = masks.get(key) || { lineWidth, color: item.sequenceMaskColor, paths: [] };
          batch.paths.push(item.pathData);
          masks.set(key, batch);
        }
        for (const batch of masks.values()) drawSequenceMask(context, batch);
      }
      ready = Promise.resolve(setStatus("ready"));
      return ready;
    },
    suspend() {
      if (disposed) return;
      ready = Promise.resolve(setStatus("suspended"));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (canvases) {
        for (const canvas of Object.values(canvases)) {
          canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      canvases = null;
      ready = Promise.resolve(setStatus("disposed"));
    },
    get ready() { return ready; },
    get status() { return status; },
  };
  return api;
}
