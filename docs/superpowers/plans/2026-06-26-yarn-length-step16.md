# Step 16 Yarn Length Shape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current single-point yarn length visual deformation with a safer target-path-length approximation for the right-side preview.

**Architecture:** Keep the existing yarn topology, link ordering, layer calculation, and cross-row endpoints unchanged. Only change how each yarn link receives additional internal visual control points before `d3.curveCatmullRomOpen` generates the final path. The model remains a visual engineering approximation, not a full physical yarn simulation.

**Tech Stack:** Vite, JavaScript modules, Canvas 2D, D3 line generator, existing Node validation scripts.

---

### Task 1: Add Failing Step 16 Validation

**Files:**
- Modify: `scripts/validate-yarn-length-scaling.mjs`

- [x] **Step 1: Add path-analysis helpers**

Add helper functions inside the validation script to extract numeric coordinates from generated SVG path strings, estimate polyline length, count curve points, and compare path endpoints.

- [x] **Step 2: Add stricter Step 16 assertions**

The validation must fail against the old single-point implementation by checking that:

- Default `lengthScaleY = 1.00` keeps the baseline path exactly the same.
- `lengthScaleY = 1.10` creates a longer path than baseline.
- `lengthScaleY = 0.90` creates a shorter path than baseline.
- The first and last rendered path coordinates stay close to baseline, proving cross-row link endpoints remain locked.
- The changed path contains more distributed curve coordinates than the old single-point insert can provide.

- [x] **Step 3: Run the failing test**

Run: `npm run validate:yarn-length-scaling`

Expected: fail with an assertion that the length change is not sufficiently target-length driven or not sufficiently distributed.

### Task 2: Implement Distributed Target-Length Approximation

**Files:**
- Modify: `src/simulation/yarnSimulation.js`

- [x] **Step 1: Replace single midpoint deformation**

Replace the current `createLengthShapePoint()` / `deformYarnCurveForLength()` single inserted point model with helpers that build several internal visual points between the same locked endpoints.

- [x] **Step 2: Preserve endpoints and layer logic**

Keep `yarnCurve()` returning the same baseline path when `lengthScaleY` is 1.00. For non-default length values, keep points 0 and 3 anchored to the original yarn link endpoints and only move inserted internal points.

- [x] **Step 3: Distribute length delta**

For longer yarn, add smooth outward bulge across the middle of the segment. For shorter yarn, reduce curvature by moving internal points toward the chord between endpoints. Clamp offsets using the existing stitch-height and local-span safety limits.

- [x] **Step 4: Keep two-yarn behavior independent**

Use each `ply.lengthScaleY` independently, while sharing the same yarn graph nodes, link rows, and link layers.

### Task 3: Verify And Document

**Files:**
- Modify: `KnitScape_单面布技术文档.md`

- [x] **Step 1: Run Step 16 validation**

Run: `npm run validate:yarn-length-scaling`

Expected: pass.

- [x] **Step 2: Run related regressions**

Run:

```bash
npm run validate:yarn-length-parameters
npm run validate:two-ply-yarn
npm run build
```

Expected: all commands exit 0.

- [x] **Step 3: Update the MD**

Add a Step 16 test result note explaining the first-version target-path-length approximation, the commands run, and the remaining limitation: it is still a visual approximation, not a full physical yarn simulation.

### Task 4: Upgrade To Unit Total-Length Model

**Files:**
- Modify: `scripts/validate-yarn-length-scaling.mjs`
- Modify: `src/simulation/yarnSimulation.js`
- Modify: `KnitScape_单面布技术文档.md`

- [x] **Step 1: Rewrite validation around unit total length**

Change the Step 16 validation so it no longer requires every individual cubic stroke segment to become longer or shorter. The validation must check the corrected theory: the total rendered path length for the tested yarn unit increases when `lengthScaleY > 1.00`, decreases when `lengthScaleY < 1.00`, keeps endpoints locked, and still avoids canvas-level transforms.

- [x] **Step 2: Verify the new validation fails before implementation**

Run: `npm run validate:yarn-length-scaling`

Expected: fail because the renderer still solves each link independently and does not expose a row/course-level length unit model.

- [x] **Step 3: Implement row/course length unit stats**

Add a length-unit map in `src/simulation/yarnSimulation.js` that groups drawable yarn links by continuous course row. For each unit, compute the default total rendered path length and per-link flexibility weights before applying a yarn length scale.

- [x] **Step 4: Distribute unit delta across flexible links**

For each yarn ply, compute `unitTarget = unitBaseLength * lengthScaleY`. Distribute the unit delta across links using each link's flexibility weight. Keep endpoints and yarn topology unchanged.

- [x] **Step 5: Run validation and update MD**

Run:

```bash
npm run validate:yarn-length-scaling
npm run validate:yarn-length-parameters
npm run validate:two-ply-yarn
npm run build
```

Expected: all commands exit 0. Update the MD to say Step 16B uses row/course unit total length as the validation target.
