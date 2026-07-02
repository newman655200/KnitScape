# KnitScape Code Map Page Design

## Goal

Create a standalone static HTML page that faithfully matches `C:/Users/liuchen/Desktop/目标.png` and teaches the user where each visible KnitScape control is implemented. The page is documentation, not a working knitting editor.

## Deliverable

The user-facing file is:

```text
C:/Users/liuchen/Documents/Codex/2026-07-02/d/outputs/knitscape-code-map.html
```

Supporting visual assets may live next to the HTML in an `outputs/knitscape-code-map-assets/` directory. The existing KnitScape source tree is read-only input for this deliverable and must not be modified.

## Visual Target

At a 1536 x 1024 viewport, the page reproduces the supplied reference:

- white top taskbar with FEDZ branding, title, dimensions, language, and export control
- left scrollable yarn parameter cards and stitch buttons
- central white chart editor with toolbar and fine grid
- right single-face preview card with preview controls
- light gray application background, subtle borders, small radii, restrained shadows, and teal accents

The supplied screenshot is the source of truth. The page does not redesign colors, spacing, typography, card structure, icons, or panel proportions.

## Interaction Model

Every visible control or editable region is a code-map hotspot. Clicking it:

1. opens an in-page detail drawer
2. identifies the source file, function or state field, and current line
3. explains what changing that location affects
4. provides a copyable absolute path
5. provides an `Open in VS Code` link targeting the file and line

The detail drawer is the only application interaction. Width, height, yarn parameters, drawing tools, undo/redo, delete, zoom, language, export, and preview controls do not perform their original business behavior.

Controls represented in the reference but absent from the current source are labeled `当前未实现`. Their drawer points to the closest existing module and gives a concrete suggested file/function for future implementation instead of pretending the feature exists.

## Code Mapping Source

Mappings are derived from the current files under:

```text
C:/Users/liuchen/Desktop/GitHub/knitscape
```

Primary mapping areas:

- `src/views/taskbar.js`: branding, dimensions, language, export
- `src/views/leftBar.js`: yarn cards, colors, diameters, yarn length, texture imports, stitch picker
- `src/views/repeatTools.js`: chart editing toolbar
- `src/actions/repeatEditingTools.js`: brush, fill, line, rectangle operations
- `src/state.js`: undo and shared state
- `src/components/runSimulation.js`: preview controls and preview rendering entry
- `src/events/simulationPointerInteraction.js`: preview panning
- `src/events/wheelInteraction.js`: preview zoom gestures
- `src/actions/zoomFit.js`: fit and scale behavior
- `src/actions/exporters.js` and `src/views/downloadModal.js`: export behavior
- `src/i18n/`: language strings and persistence

Line numbers are captured from the current working tree during implementation. Each mapping also stores a function or identifier so the explanation remains useful if nearby lines later move.

## Implementation Shape

The deliverable uses one self-contained HTML document with embedded CSS and JavaScript. It has no package installation, server, build step, or dependency on the KnitScape runtime.

Icons are copied from the installed Font Awesome Free package into the deliverable asset directory. No handcrafted icon approximations or KnitScape business logic are copied into the page.

The preview area uses the supplied visual reference as its source asset and preserves the reference crop and aspect ratio.

## Failure Handling

- If VS Code protocol links are blocked or VS Code is not installed, the drawer still exposes the full path, line, identifier, and copy action.
- Copy feedback is shown inline and does not dismiss the drawer.
- Missing mappings never produce dead links; they use the `当前未实现` state.
- The page remains usable from a local `file:///` URL without a web server.

## Verification

- render at 1536 x 1024 and compare against `目标.png`
- verify panel proportions, spacing, borders, typography, radii, and reference preview crop
- enumerate every hotspot and confirm it opens the correct mapping drawer
- confirm every existing mapping points to a real file and valid line
- confirm missing features are explicitly labeled
- confirm copy-path works from a local file
- confirm the VS Code URI is correctly formed
- confirm the page does not mutate the KnitScape project or run knitting behavior
