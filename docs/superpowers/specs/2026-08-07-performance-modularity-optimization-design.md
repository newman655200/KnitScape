# KnitScape Performance and Modularity Optimization Design

Date: 2026-08-07

## Goal

Reduce idle CPU use and long-session memory growth, then split the two files that currently mix unrelated responsibilities. The visible interface, shortcuts, saved-project format, simulation result, and editing behavior must remain unchanged.

This is a focused refactor of the current vanilla ES-module application. It is not a framework rewrite.

## Constraints

- Do not preserve obsolete APIs or add compatibility layers, migrations, or new fallback paths.
- Do not add configuration layers or abstractions for hypothetical future needs.
- Keep modules aligned with concrete product responsibilities.
- Use the dependencies already present before writing replacement infrastructure.
- Preserve the current interface and user-visible behavior.
- Do not limit undo history in this change because that would alter editing behavior.

## Current State

The application already has the tools needed for this work:

- `lit-html` renders the UI and supports small template components.
- The existing `StateMonitor` distributes state changes to rendering and simulation components.
- `d3`, `Pattern`, `ProcessModel`, and `YarnModel` already provide the simulation primitives.
- Vite and the repository's validation scripts provide build and regression checks.

No new runtime dependency is required.

The main problems are:

1. `src/index.js` calls `render(view(), document.body)` on every animation frame, including while the application is idle.
2. `src/views/leftBar.js` combines yarn material import, texture controls, yarn-length display, and yarn palette editing in one file. It also contains an unused `motifLibrary()` function that is not rendered.
3. `src/simulation/yarnSimulation.js` combines orchestration, node/topology construction, geometry preparation, and canvas drawing in one function.
4. Canvas image/tint caches and the WebGL texture cache can retain resources for the lifetime of the page.

The removed `codex/horizontal-composite-stitch` worktree and branch are outside this design and will not be recreated.

## Chosen Approach

Use a staged, behavior-preserving refactor:

```text
state dispatch
  -> existing StateMonitor
  -> one queued application render when state changes
  -> affected canvas/simulation components only

yarn simulation request
  -> prepare pattern and yarn inputs
  -> use existing models to build yarn topology
  -> resolve yarn path geometry
  -> draw the three canvas layers
  -> publish yarn-length metrics
```

The existing state and simulation contracts remain the boundaries. No event bus, service container, component base class, or generalized pipeline is added.

## Rendering Lifecycle

Replace the permanent recursive animation-frame loop in `src/index.js` with a small application-render component registered with `StateMonitor`.

Behavior:

- Render synchronously once during initialization so the DOM exists before listeners and canvases are queried.
- On subsequent state changes, queue at most one `requestAnimationFrame` render.
- If several actions occur before the next frame, they share that render.
- When no state changes occur, no application render is scheduled.

This retains frame-coalescing during pointer activity without consuming CPU while idle. The code belongs in a concrete `src/components/renderApp.js` module rather than a generic scheduler utility.

## Left Sidebar Modules

`src/views/leftBar.js` remains the composition point and keeps only sidebar layout plus calls to focused view functions.

Extract these existing responsibilities:

- `src/views/yarnPlyPanel.js`: ply color, diameter, scan texture, PBR-map import, texture processing, and texture performance controls.
- `src/views/yarnLengthReadout.js`: yarn-length and machine-gauge readout.
- `src/views/yarnPicker.js`: yarn palette add, edit, delete, shuffle, and picker markup.

Delete the unused private `motifLibrary()` function. It has no current call site or visible behavior, so keeping or extracting it would preserve obsolete code.

The extracted modules call the existing action functions directly. They do not introduce controller objects, registries, schemas, or shared configuration.

## Simulation Modules

`src/simulation/yarnSimulation.js` remains the public `simulate(...)` entry point and owns orchestration only.

Reuse the existing `Pattern`, `ProcessModel`, and `YarnModel` topology classes. Extract only the responsibilities they do not already own:

- `src/simulation/yarnPathGeometry.js`: lay out contact nodes, calculate normals, resolve curve paths, and calculate length metrics.
- `src/simulation/drawYarnSimulation.js`: draw prepared paths and materials to the back, middle, and front canvases.

Constants and calculations used by only one phase stay beside that phase. Shared inputs are passed explicitly as ordinary objects; there is no new configuration class or generic simulation framework.

The returned `stopSim` and `yarnLengthMetrics` contract remains unchanged.

## Cache Lifecycle

Keep the current cache implementations local to their renderers.

- Canvas image and tinted-texture maps receive fixed, local entry limits. Insertion beyond the limit removes the oldest entry.
- WebGL texture entries record recent use. Entries not needed after the local limit is reached are deleted with `gl.deleteTexture` before removal.
- Renderer disposal continues to delete all remaining WebGL resources.
- Cache eviction may cause a later image or texture to be rebuilt, but must not change rendered output.

The limits are implementation constants in the owning modules. They are not exposed as application settings or routed through a configuration layer.

## State and Data Compatibility

This change does not alter application state fields or the JSON workspace format, so no migration or compatibility parsing is needed.

The unbounded snapshot list is intentionally unchanged in this pass. Bounding it would change how far the user can undo and would conflict with the approved behavior-preservation requirement.

## Error Handling

No new fallback implementation is added. Existing rendering modes and existing error behavior remain in place. Extracted functions allow normal exceptions to surface through the same call paths as before.

## Verification

Implementation follows test-driven development using the repository's existing Node validation style.

Add focused validations for:

- a state change schedules one coalesced application render rather than a permanent idle loop;
- bounded Canvas caches evict their oldest records;
- WebGL cache eviction calls `deleteTexture`;
- extracted sidebar modules remain wired into `leftBar`;
- characterization fixtures preserve path counts, resolved geometry, yarn-length metrics, and the public `simulate(...)` return contract across the extraction.

Then run:

- all existing `validate:*` scripts;
- the new focused validation scripts;
- `npm run build`.

## Acceptance Criteria

- The application performs no recurring root UI render while idle.
- Bursts of state changes produce at most one queued root render per frame.
- Yarn texture caches cannot grow without limit and evicted GPU textures are released.
- `leftBar.js` is a small composition module with the three concrete responsibilities extracted and the unused motif function deleted.
- `yarnSimulation.js` is an orchestrator that reuses the existing topology models and delegates path geometry and drawing.
- Existing interface, shortcuts, workspace format, editing behavior, and simulation output remain unchanged.
- No new dependency, compatibility layer, migration, generic configuration system, or speculative abstraction is added.
- All validation scripts and the production build pass.

## Non-Goals

- No visual redesign.
- No visible feature removal beyond the already deleted composite-stitch experiment.
- No change to yarn-length mathematics.
- No undo-history limit.
- No state-management rewrite.
- No WebGL architecture rewrite.
- No framework migration.
