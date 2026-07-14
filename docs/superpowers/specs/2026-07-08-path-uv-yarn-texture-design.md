# Path UV Yarn Texture Preview Design

Date: 2026-07-08

## Goal

Add a first-stage path-UV yarn texture preview for the right-side single-jersey preview. Imported yarn scan/PBR maps should follow the yarn centerline direction instead of repeating in screen space.

This is a 2.5D preview upgrade, not a true 3D tube or full material-physics simulation.

## Current State

The right preview is built from three stacked Canvas layers:

```text
back canvas
mid canvas
front canvas
```

`src/simulation/yarnSimulation.js` computes yarn path data, then `src/simulation/yarnTextureBrush.js` draws each path with Canvas 2D `stroke(Path2D)`. Imported scan textures are currently rendered with `context.createPattern(brush, "repeat")`, so the texture repeats in canvas/screen space. It does not rotate or stretch along the yarn path.

The data model already reserves PBR fields:

```js
texture.pbr = {
  baseColor: null,
  normal: null,
  roughness: null,
  height: null,
  ambientOcclusion: null,
};
```

These fields are normalized but not exposed in the UI and not used by the renderer yet.

## Chosen Approach

Use a hybrid renderer:

```text
existing path generation
-> sample each path into centerline points
-> generate a UV ribbon strip per yarn segment
-> render textured strips with WebGL
-> fall back to existing Canvas 2D stroke when WebGL/texture mode is unavailable
```

Each sampled point stores:

```text
x, y      screen/canvas coordinate
u         cumulative distance along the yarn path
normal    2D perpendicular to the local tangent
```

Each pair of neighboring sampled points becomes a quad:

```text
left  = center - normal * yarnWidth / 2
right = center + normal * yarnWidth / 2
```

UV mapping:

```text
u = cumulative path length / textureRepeatLength
v = 0 at one yarn edge, 1 at the other yarn edge
```

This makes the texture travel along the yarn path. Curves, bends and stitch loops keep a consistent fiber direction.

## First-Version PBR Behavior

The first implementation uses PBR maps as visual approximations:

- `baseColor`: primary yarn color/scan image.
- `normal` or `height`: local lighting perturbation for fiber relief.
- `roughness`: reduces or increases highlight strength.
- `ambientOcclusion`: darkens crossed or dense-looking regions.
- `fuzz`: continues to use the existing `fuzzStrength` control, with an expanded translucent ribbon pass.

Because the preview remains 2.5D, there is no true cylindrical UV unwrap, physical self-shadowing, collision, or real BRDF. The purpose is to make imported yarn material maps follow the knitted yarn path convincingly.

## UI and Data Model

The existing yarn texture panel remains the entry point. It should expand from one scan-image import to map-specific imports:

```text
Base Color / Scan
Normal
Roughness
Height
Ambient Occlusion
```

The JSON shape stays backward-compatible:

```js
texture: {
  sourceType: "scan",
  fileName: "...",
  dataUrl: "...",
  processedDataUrl: "...",
  enabled: true,
  maxSize: 512,
  useOriginalColor: true,
  textureStrength: 0.75,
  fuzzStrength: 0.45,
  pbr: {
    baseColor: { fileName, dataUrl, processedDataUrl },
    normal: { fileName, dataUrl, processedDataUrl },
    roughness: { fileName, dataUrl, processedDataUrl },
    height: { fileName, dataUrl, processedDataUrl },
    ambientOcclusion: { fileName, dataUrl, processedDataUrl }
  }
}
```

Older JSON files with `texture.pbr.baseColor === null` remain valid. If only the old `processedDataUrl` exists, it is treated as the base color map.

## Performance Model

The feature must preserve the existing performance modes:

```text
Solid: existing fast Canvas/solid path.
Auto: solid preview during pan/zoom/drag/continuous input; UV texture preview after interaction settles.
Quality: always use UV texture preview when WebGL is available.
```

Geometry is regenerated only when these inputs change:

```text
chart
repeats
yarnSequence
yarnPlies diameter or lengthScaleY
simScale
```

Geometry is not regenerated for:

```text
simPan
preview pan/zoom transform
flipped front/back display
```

Texture uploads are cached by map data URL and maximum size. The default map size remains 512 px; low-end or large-chart use can drop to 256 px.

## Existing Functionality Impact

The change should not alter the central chart editor, repeat editing, yarn sequence editing, import/export formats other than preserving new texture map fields, library loading, language switching, settings, or the current solid preview behavior.

The right preview internals will change. Risk areas:

- Large charts may need automatic downshift to solid mode during interaction.
- JSON project files can become larger when PBR map data URLs are embedded.
- Color-sequence masking must be reimplemented in the WebGL shader so row colors still affect the preview.
- WebGL context loss or unsupported browsers must fall back to current Canvas 2D drawing.

## Acceptance Criteria

- Importing a base color/scan map makes the texture follow yarn loops instead of staying screen-aligned.
- Panning and zooming the right preview does not regenerate UV geometry.
- Auto mode switches to fast solid preview during interaction and restores UV texture after interaction settles.
- Solid mode remains visually and behaviorally equivalent to the current preview.
- Existing JSON without PBR maps still imports and exports successfully.
- `npm run build` succeeds.
- New validators cover path sampling, UV monotonicity, fallback wiring, and PBR map normalization.

## Non-Goals

- No true 3D tube mesh in this phase.
- No physically exact PBR shading.
- No yarn collision or self-shadow simulation.
- No export of PBR zip files in this phase.
- No server upload of texture images.
