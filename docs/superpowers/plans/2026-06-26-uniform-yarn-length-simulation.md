# Uniform Yarn Length Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make yarn-length simulation deterministic and visually uniform for identical stitch structures under the same yarn length.

**Architecture:** Keep the existing row/course length-control model, but replace local safety-weight distribution with base-length proportional distribution so identical links receive identical relative target length. Use a deterministic normal direction for length deformation instead of selecting the side that locally maximizes length.

**Tech Stack:** Vite, canvas renderer, Node validation scripts.

---

### Task 1: Failing Uniformity Validation

**Files:**
- Modify: `scripts/validate-yarn-length-scaling.mjs`

- [x] **Step 1: Add a uniformity assertion**

Add a runtime assertion for a uniform stitch sample at `lengthScaleY = 1.05`. The assertion groups cubic paths by comparable local geometry and checks that repeated groups do not have random spread in normalized deformation length.

- [x] **Step 2: Run red test**

Run: `npm run validate:yarn-length-scaling`

Expected: FAIL before production changes, showing the current local-flexibility model is not uniform enough.

### Task 2: Deterministic Length Allocation

**Files:**
- Modify: `src/simulation/yarnSimulation.js`

- [x] **Step 1: Change row unit distribution**

Replace flexibility-share distribution with base-length-share distribution:

```js
const linkShare = linkStats.baseLength / Math.max(0.001, unit.baseLength);
```

This keeps the row/course total-length target while giving every segment the same relative length scale.

- [x] **Step 2: Remove normal side maximization**

For `lengthScaleY > 1`, stop sorting between both normals by max candidate length. Use the deterministic normal from `chooseLengthShapeNormal()` so equal topology stays periodic.

- [x] **Step 3: Keep safety as a hard cap only**

Use safety data to cap impossible deformation, but do not let normal repeated stitches receive different length allocations during normal `1.03` / `1.05` operation.

### Task 3: Regression Verification And Docs

**Files:**
- Modify: `KnitScape_单面布技术文档.md`

- [x] **Step 1: Run focused and regression checks**

Run:
- `npm run validate:yarn-length-scaling`
- `npm run validate:yarn-length-toggle`
- `npm run validate:two-ply-yarn`
- `npm run validate:sim-wheel-performance`
- `npm run build`

Expected: All exit `0`; Vite chunk-size warning is acceptable if build succeeds.

- [x] **Step 2: Update Step 16D documentation**

Record the new rule: identical stitch structures under the same yarn length use deterministic, uniform template deformation; local avoidance is not allowed to create random-looking variation in ordinary repeat areas.
