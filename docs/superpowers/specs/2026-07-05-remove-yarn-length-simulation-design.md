# Remove Yarn-Length Simulation Design

## Goal

Remove the current yarn-length geometry simulation and its right-preview button because the visual model does not meet the physical requirements. Preserve yarn-length input as inert project data for a future replacement model.

## Scope

The retained yarn-length parameter contract is:

- Keep both yarn-length sliders in the left yarn-ply panel.
- Keep `yarnPlies[index].lengthScaleY`, its default value of `1`, its `0.90` to `1.10` clamp, and JSON import/export compatibility.
- Changing `lengthScaleY` must no longer deform or otherwise change the right-side preview.

The removed simulation contract is:

- Remove the right-preview one-shot yarn-length simulation button and its translations.
- Remove `yarnLengthSimulationRequestId` from application state.
- Delete the yarn-length geometry snapshot controller and all snapshot capture/replay wiring.
- Remove yarn-length-specific options, target-length calculations, curve deformation, geometry capture, and replay behavior from `simulate()`.
- Restore ordinary relaxation behavior without yarn-length-specific blocking.

## Runtime Design

`runSimulation()` will call `simulate()` directly with the chart, yarn sequence, palette, scale, yarn plies, and texture-performance options. It will no longer consume a request, store geometry, or replay a prior yarn-length result.

`simulate()` will continue using yarn-ply color, diameter, enabled state, and texture. It may receive yarn objects that contain `lengthScaleY` for data compatibility, but rendering will ignore that field until a new physically grounded model is designed.

The right preview will retain Relax, Flip, Zoom Out, Zoom In, scale control, and Fit. Removing the yarn-length button must not alter these controls or the normal D3 relaxation pipeline.

## Validation Design

Use a test-first repository guard that initially fails while the old feature exists, then passes after removal. The guard will verify:

- the yarn-length sliders, defaults, normalization, and JSON persistence still exist;
- the preview button, request state, snapshot controller, snapshot options, and geometry-deformation identifiers are absent;
- obsolete yarn-length simulation scripts are no longer registered;
- the code-guide no longer exposes a yarn-length simulation button entry while retaining the yarn-length parameter entry.

Remove the old simulation-toggle and simulation-scaling validators because they assert behavior that is intentionally being deleted. Keep the parameter validator. Update shared validators only where their fixtures assume the removed simulation API.

Run all retained validators and the Vite production build after the change.

## Documentation

Update the current technical document to state that the former Step 16 yarn-length simulation was removed on 2026-07-05. Historical design and plan documents remain as records, but maintained runtime documentation and the current code guide must not describe the removed button or algorithm as available.

## Non-Goals

- Do not design or implement the replacement yarn-length model.
- Do not change the slider range, default, labels, or JSON shape.
- Do not change yarn diameter, two-ply rendering, scan textures, color sequence, stitch editing, or ordinary preview relaxation.
- Do not refactor unrelated simulation code.
