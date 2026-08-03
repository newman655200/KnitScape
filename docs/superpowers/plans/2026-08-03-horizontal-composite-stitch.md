# Horizontal Composite Stitch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reversible same-stitch horizontal pairing, a one-loop/two-anchor composite topology, and a rotatable local 3D yarn view that detects and resolves unintended tube penetration.

**Architecture:** Keep `chart` and repeat bitmaps unchanged and store pairing as a validated overlay in `pairGroups`. Compile the active group into DOM-free local topology and polyline geometry, resolve capsule-style collisions with pure functions, then render the result as depth-tested Three.js tubes while retaining the existing fabric preview.

**Tech Stack:** JavaScript ES modules, lit-html, Node `assert` validation scripts, Three.js 0.185.1, Vite 4.

---

## File map

- Create `src/actions/pairGroups.js`: pure candidate validation, toggle, pruning and state action.
- Create `src/views/pairGroupOverlay.js`: colored two-cell overlay using existing SVG assets.
- Create `src/simulation/mergedPairTopology.js`: one visible loop with two logical contact zones.
- Create `src/simulation/yarnCollision3d.js`: segment distance, collision classification and local projection.
- Create `src/simulation/mergedPairGeometry3d.js`: local templates and collision-solving orchestration.
- Create `src/components/mergedPair3dView.js`: Three.js lifecycle and DOM view fragment.
- Create `scripts/validate-pair-groups.mjs`, `scripts/validate-yarn-collision-3d.mjs`, `scripts/validate-merged-pair-geometry-3d.mjs`, `scripts/validate-composite-stitch-ui.mjs`: executable regression tests.
- Modify `src/state.js`, `src/constants.js`: persistent state and undo snapshot support.
- Modify `src/views/chartEditorToolbar.js`, `src/views/view.js`, `src/components/runSimulation.js`: controls and rendering integration.
- Modify `src/components/generateChart.js`, `src/actions/importers.js`, `src/actions/exporters.js`: pruning and JSON round-trip.
- Modify `src/events/simulationPointerInteraction.js`: defer pointer input to OrbitControls in 3D mode.
- Modify `src/i18n/translations.js`, `styles.css`, `package.json`, `package-lock.json`, `src/index.js`: labels, presentation, dependency and component registration.

### Task 1: Pair-group domain logic

**Files:**
- Create: `scripts/validate-pair-groups.mjs`
- Create: `src/actions/pairGroups.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing domain test**

Create a Node test using real `Bimp` values. It must assert `knit+knit` and `purl+purl` candidates succeed; mixed, slip, tuck, last-column, occupied and repeat-wrap candidates return their exact reason codes; toggle adds/removes a group without changing `chart`; normalization prunes a group after one underlying stitch changes.

```js
import assert from "node:assert/strict";
import { Bimp } from "../src/lib/Bimp.js";
import {
  getHorizontalPairCandidate,
  normalizePairGroups,
  toggleHorizontalPair,
} from "../src/actions/pairGroups.js";

function state(pixels, selectedChartCell = { x: 0, y: 0 }) {
  return {
    chart: new Bimp(4, 2, pixels),
    symbolMap: ["knit", "purl", "slip", "tuck"],
    repeats: [{ bitmap: new Bimp(4, 2, pixels), pos: [0, 0], area: [4, 2] }],
    selectedChartCell,
    pairGroups: [],
  };
}

const knit = state([0, 0, 0, 0, 0, 0, 0, 0]);
assert.equal(getHorizontalPairCandidate(knit).enabled, true);
const added = toggleHorizontalPair(knit, () => "pair-test");
assert.equal(added.pairGroups.length, 1);
assert.equal(added.simulationMode, "pair3d");
assert.equal(toggleHorizontalPair({ ...knit, ...added }).pairGroups.length, 0);
assert.equal(getHorizontalPairCandidate(state([0, 1, 0, 0, 0, 0, 0, 0])).reason, "DIFFERENT_STITCH");
assert.equal(getHorizontalPairCandidate(state([2, 2, 0, 0, 0, 0, 0, 0])).reason, "UNSUPPORTED_STITCH");
assert.equal(getHorizontalPairCandidate(state([0, 0, 0, 0, 0, 0, 0, 0], { x: 3, y: 0 })).reason, "LAST_COLUMN");

const changed = { ...knit, chart: knit.chart.draw([{ x: 1, y: 1, color: 1 }]) };
assert.deepEqual(normalizePairGroups(changed, added.pairGroups), []);
console.log("PASS: horizontal pair-group domain rules are valid.");
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --experimental-default-type=module scripts/validate-pair-groups.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/actions/pairGroups.js`.

- [ ] **Step 3: Implement the minimal pure domain module**

Export these stable APIs and reason codes:

```js
export const PAIR_REASON = Object.freeze({
  NO_SELECTION: "NO_SELECTION",
  OUT_OF_BOUNDS: "OUT_OF_BOUNDS",
  LAST_COLUMN: "LAST_COLUMN",
  DIFFERENT_STITCH: "DIFFERENT_STITCH",
  UNSUPPORTED_STITCH: "UNSUPPORTED_STITCH",
  ALREADY_GROUPED: "ALREADY_GROUPED",
  CROSSES_REPEAT_BOUNDARY: "CROSSES_REPEAT_BOUNDARY",
});

export function getHorizontalPairCandidate(state, selected = state.selectedChartCell) {}
export function findPairGroupAt(pairGroups, cell) {}
export function normalizePairGroups(state, pairGroups = state.pairGroups) {}
export function toggleHorizontalPair(state, idFactory = defaultIdFactory) {}
export function toggleSelectedHorizontalPair() {}
```

Use top-origin interaction coordinates, convert with `bitmapY = chart.height - y - 1`, require `left.x + 1 === right.x`, require both repeat lookups to have the same repeat index and consecutive local X coordinates, and choose a color deterministically from a fixed accessible palette.

- [ ] **Step 4: Run the domain test and verify GREEN**

Run: `node --experimental-default-type=module scripts/validate-pair-groups.mjs`

Expected: `PASS: horizontal pair-group domain rules are valid.`

- [ ] **Step 5: Add `validate:pair-groups` to package scripts**

```json
"validate:pair-groups": "node --experimental-default-type=module scripts/validate-pair-groups.mjs"
```

### Task 2: State, toolbar, overlay and persistence

**Files:**
- Create: `scripts/validate-composite-stitch-ui.mjs`
- Create: `src/views/pairGroupOverlay.js`
- Modify: `src/state.js`
- Modify: `src/constants.js`
- Modify: `src/views/chartEditorToolbar.js`
- Modify: `src/views/view.js`
- Modify: `src/components/generateChart.js`
- Modify: `src/actions/importers.js`
- Modify: `src/actions/exporters.js`
- Modify: `src/i18n/translations.js`
- Modify: `styles.css`
- Modify: `package.json`

- [ ] **Step 1: Write the failing integration validation**

The script must inspect source files and fail unless it finds all three state keys, `pairGroups` in snapshots and JSON import/export, `toggleSelectedHorizontalPair` wired to a disabled-aware toolbar button, `pairGroupOverlay()` placed after existing chart canvases, all four languages, and pointer-events disabled on the overlay.

```js
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (path) => fs.readFileSync(path, "utf8");
assert.match(read("src/state.js"), /pairGroups:\s*\[\]/);
assert.match(read("src/constants.js"), /SNAPSHOT_FIELDS[\s\S]*["']pairGroups["']/);
assert.match(read("src/views/chartEditorToolbar.js"), /toggleSelectedHorizontalPair/);
assert.match(read("src/views/view.js"), /pairGroupOverlay\(\)/);
assert.match(read("src/actions/exporters.js"), /pairGroups:\s*GLOBAL_STATE\.pairGroups/);
assert.match(read("src/actions/importers.js"), /normalizePairGroups/);
assert.match(read("styles.css"), /#pair-group-overlay[\s\S]*pointer-events:\s*none/);
console.log("PASS: composite stitch UI and persistence are wired.");
```

- [ ] **Step 2: Run the integration validation and verify RED**

Run: `node scripts/validate-composite-stitch-ui.mjs`

Expected: FAIL because `pairGroups` is absent from state.

- [ ] **Step 3: Add state and undo support**

Initialize:

```js
pairGroups: [],
activePairGroupId: null,
simulationMode: "fabric",
pairCollisionStatus: null,
```

Add `pairGroups`, `activePairGroupId` and `simulationMode` to `SNAPSHOT_FIELDS` so undo restores a coherent view state. New pattern resets all four fields. Import accepts only arrays, passes them through the domain normalizer after chart/repeats are constructed, and defaults old files to no groups. Export includes `pairGroups` only as plain JSON data.

- [ ] **Step 4: Add the toolbar action and translated failure titles**

Compute `const pairCandidate = getHorizontalPairCandidate(GLOBAL_STATE)` on render. Render one button with `?disabled=${!pairCandidate.enabled && pairCandidate.action !== "unmerge"}`, translated label `pair.merge`/`pair.unmerge`, and translated `PAIR_REASON` title. Clicking calls `toggleSelectedHorizontalPair()`.

- [ ] **Step 5: Add the non-destructive chart overlay**

Render each group as a two-cell absolute element sized from `GLOBAL_STATE.scale / devicePixelRatio`. Use the existing SVG URL as a CSS mask twice so both original symbols remain recognizable in the same group color. Set the entire overlay to `pointer-events: none` and position it inside `#canvas-transform-group` after the repeat layer and before the selection outline.

- [ ] **Step 6: Prune stale groups when chart generation changes stitches**

In `generateChart.regen()`, normalize against the new chart before dispatching and clear `activePairGroupId`/return to `fabric` only when the active group no longer exists.

- [ ] **Step 7: Run validations and build**

Run:

```text
npm run validate:pair-groups
node scripts/validate-composite-stitch-ui.mjs
npm run validate:i18n
npm run build
```

Expected: all validation scripts print PASS and Vite exits 0.

### Task 3: Collision mathematics

**Files:**
- Create: `scripts/validate-yarn-collision-3d.mjs`
- Create: `src/simulation/yarnCollision3d.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing numerical tests**

Test crossing, parallel, endpoint and degenerate segments; exclusion of adjacent self-segments; a deliberate penetration; and projection to the requested radius/clearance.

```js
import assert from "node:assert/strict";
import {
  closestPointsOnSegments,
  detectPolylineCollisions,
  solvePolylineCollisions,
} from "../src/simulation/yarnCollision3d.js";

const crossing = closestPointsOnSegments(
  { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
  { x: 0, y: -1, z: 0 }, { x: 0, y: 1, z: 0 }
);
assert.ok(crossing.distance < 1e-9);
const paths = [
  { id: "a", radius: 0.1, points: [{ x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }] },
  { id: "b", radius: 0.1, points: [{ x: 0, y: -1, z: 0 }, { x: 0, y: 1, z: 0 }] },
];
assert.equal(detectPolylineCollisions(paths, { clearance: 0.02 }).length, 1);
const solved = solvePolylineCollisions(paths, { clearance: 0.02, maxIterations: 24 });
assert.equal(solved.collisions.length, 0);
console.log("PASS: 3D yarn collision math is valid.");
```

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-default-type=module scripts/validate-yarn-collision-3d.mjs`

Expected: missing-module failure.

- [ ] **Step 3: Implement segment distance and collision classification**

`closestPointsOnSegments(a0, a1, b0, b1)` returns `{ pointA, pointB, s, t, distance }` with clamped parameters and an epsilon-safe degenerate case. `detectPolylineCollisions()` creates segment records, uses a uniform spatial hash, skips same-path segments with index distance at most one, recognizes declared expected-contact segment pairs, and returns penetration depth plus closest-point parameters.

- [ ] **Step 4: Implement local projection**

`solvePolylineCollisions()` deep-clones input points, records rest segment lengths, projects unintended collisions across non-pinned endpoints according to `s`/`t`, applies declared Z-order constraints for expected contacts, restores segment lengths, applies a small Laplacian smoothing weight, and stops after 24 rounds or `0.001` stitch units of penetration. It returns `{ paths, collisions, iterations, resolved }`.

- [ ] **Step 5: Run and verify GREEN**

Run: `node --experimental-default-type=module scripts/validate-yarn-collision-3d.mjs`

Expected: `PASS: 3D yarn collision math is valid.`

### Task 4: Composite topology and local geometry

**Files:**
- Create: `scripts/validate-merged-pair-geometry-3d.mjs`
- Create: `src/simulation/mergedPairTopology.js`
- Create: `src/simulation/mergedPairGeometry3d.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing topology/geometry test**

Assert one composite visual loop, two contact zones, six boundary ports, no middle legs, opposite knit/purl depth signs, finite coordinates, an effective two-cell width, and a collision report.

```js
import assert from "node:assert/strict";
import { buildMergedPairTopology } from "../src/simulation/mergedPairTopology.js";
import { buildMergedPairGeometry3d } from "../src/simulation/mergedPairGeometry3d.js";
const pair = { id: "p", left: { x: 4, y: 3 }, right: { x: 5, y: 3 }, stitchType: "knit" };
const topology = buildMergedPairTopology(pair);
assert.equal(topology.visibleLoops.length, 1);
assert.equal(topology.contactZones.length, 2);
assert.equal(topology.visibleLoops[0].legs.length, 2);
const geometry = buildMergedPairGeometry3d({ pair, yarnDiameter: 0.24 });
assert.ok(geometry.paths.every((path) => path.points.every((p) => Number.isFinite(p.x + p.y + p.z))));
assert.ok(geometry.bounds.width > 1.7);
assert.equal(typeof geometry.collisionReport.resolved, "boolean");
const purl = buildMergedPairGeometry3d({ pair: { ...pair, stitchType: "purl" }, yarnDiameter: 0.24 });
assert.equal(Math.sign(geometry.depthSign), -Math.sign(purl.depthSign));
console.log("PASS: merged-pair topology and local 3D geometry are valid.");
```

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-default-type=module scripts/validate-merged-pair-geometry-3d.mjs`

Expected: missing-module failure.

- [ ] **Step 3: Implement topology ports and contact zones**

Return a DOM-free structure containing `courseIn`, `courseOut`, `lowerLeft`, `lowerRight`, `upperLeft`, `upperRight`; one visible loop with `head` and two outer legs; and two logical contact zones. Throw a typed error for non-adjacent, mixed or unsupported pairs.

- [ ] **Step 4: Implement parameterized local templates**

Generate a four-column by three-row local window. Normal loops use width `0.82` stitch units; the composite loop uses width `1.82`. Sample each Catmull-Rom template into 25 finite `Vec3` points, pin window-edge endpoints, reverse the depth sign for purl, declare expected contacts, and pass all paths through `solvePolylineCollisions()`.

- [ ] **Step 5: Run and verify GREEN**

Run: `node --experimental-default-type=module scripts/validate-merged-pair-geometry-3d.mjs`

Expected: `PASS: merged-pair topology and local 3D geometry are valid.`

### Task 5: Three.js validation view

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/mergedPair3dView.js`
- Modify: `src/components/runSimulation.js`
- Modify: `src/events/simulationPointerInteraction.js`
- Modify: `src/index.js`
- Modify: `src/i18n/translations.js`
- Modify: `styles.css`
- Modify: `scripts/validate-composite-stitch-ui.mjs`

- [ ] **Step 1: Extend the failing UI validation**

Require a `merged-pair-3d-canvas`, `TubeGeometry`, `OrbitControls`, depth-test material, a collision badge, mode-switch buttons, and `simulationPointerInteraction` returning early in `pair3d` mode.

- [ ] **Step 2: Run and verify RED**

Run: `node scripts/validate-composite-stitch-ui.mjs`

Expected: FAIL because the 3D component does not exist.

- [ ] **Step 3: Install the pinned renderer dependency**

Run: `npm install three@0.185.1`

Expected: `three` appears in dependencies and the lockfile records version `0.185.1`.

- [ ] **Step 4: Add the view fragment and mode controls**

Keep the existing three simulation canvases mounted. Add a sibling 3D canvas and status badge; toggle visibility from `GLOBAL_STATE.simulationMode`. Add “面料预览” and “3D 验证” buttons; disable 3D when no valid active group exists.

- [ ] **Step 5: Implement Three.js lifecycle**

Create `WebGLRenderer({ canvas, antialias: true, alpha: true })`, a perspective camera, ambient and directional lights, `OrbitControls`, and a resize observer. On relevant state changes, dispose the prior group and create one `TubeGeometry` per solved centerline using the active yarn color/radius. Use `MeshStandardMaterial({ depthTest: true, depthWrite: true })`. Dispatch only a compact collision status when it actually changes.

- [ ] **Step 6: Route input and handle WebGL failure**

Existing pan/zoom handlers return immediately when `simulationMode === "pair3d"`. OrbitControls owns pointer input in that mode. If renderer creation throws, keep the fabric preview available and set the translated 3D-unavailable status.

- [ ] **Step 7: Run UI validation and build**

Run:

```text
node scripts/validate-composite-stitch-ui.mjs
npm run build
```

Expected: PASS and Vite exit 0.

### Task 6: Full regression and browser acceptance

**Files:**
- Modify only files required by failures found in this task.

- [ ] **Step 1: Run every package validation script**

Run all `validate:*` entries from `package.json` sequentially. Expected: every command exits 0 and prints PASS where applicable.

- [ ] **Step 2: Run a production build**

Run: `npm run build`

Expected: Vite exits 0 with assets written to `dist` and no unresolved imports.

- [ ] **Step 3: Start the development server and perform browser acceptance**

Verify in the actual UI:

1. Select a knit cell with knit on its right; click “左右合并”.
2. Confirm both chart icons remain, share a group color and have one connecting frame.
3. Confirm the right pane switches to 3D and shows one wide loop, not two heads.
4. Rotate to a side view and confirm tubes have real depth and no hidden flat-layer trick.
5. Confirm the collision badge is visible and reports either clear or an explicit conflict.
6. Cancel the group and confirm the chart and original preview restore.
7. Verify mixed stitches, slip/tuck, last-column and repeat-wrap cases cannot merge.

- [ ] **Step 4: Inspect final diff and preserve pre-existing work**

Run `git status --short`, `git diff --check`, and a scoped diff review. Do not stage or rewrite the pre-existing modifications in `scripts/validate-central-stitch-toolbar.mjs`, `src/actions/selectedCell.js`, `src/codeGuide/codeGuideDefinitions.json`, or unrelated `styles.css` hunks.
