# Yarn Texture Performance Controls Design

## Goal

Reduce lag after importing scanned yarn textures while keeping the imported image data available for later use.

## Design

1. Add a per-yarn `texture.enabled` flag.
   - On: render the scanned texture brush.
   - Off: keep the imported texture in JSON, but render the yarn as the original solid color stroke.
   - Old JSON without `enabled` normalizes to `true` so existing imported textures still show.

2. Add a per-yarn `texture.maxSize` setting with three options: 256, 512, 1024.
   - The scanner processor uses `maxSize` when creating `processedDataUrl`.
   - New imports default to 512 for better performance.
   - Changing the size reprocesses from the stored original `dataUrl`.

3. Add a global preview performance mode.
   - New state field: `texturePerformanceMode`, default `"auto"`.
   - `"auto"` renders solid-color yarn while the user is actively panning, zooming, or otherwise interacting with the preview, then restores texture rendering after a short idle delay.
   - `"quality"` always renders texture when `texture.enabled` is on.
   - `"solid"` always renders solid yarn and keeps imported textures stored.

## UI

Each yarn card keeps the current scan texture area and adds:

- `启用纹理` toggle.
- `纹理尺寸` select with 256 / 512 / 1024.

The yarn ply panel adds one shared select:

- `预览性能` with `自动`, `质量`, `纯色`.

## Rendering Contract

The right preview remains a 2D canvas. Texture rendering still flows through `drawYarnTexturePath`. The brush must fall back to solid color when:

- No texture exists.
- `texture.enabled === false`.
- Global performance mode is `"solid"`.
- Global performance mode is `"auto"` and preview interaction is active.

## Validation

Extend existing validation scripts to check the UI labels, state fields, JSON normalization, and rendering fallback hooks. Run:

- `npm run validate:single-ui`
- `npm run validate:two-ply-yarn`
- `npm run validate:repeat-dimensions`
- `npm run validate:intranet`
- `npm run build`
