# Yarn Length Solver Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the browser from becoming unresponsive while adjusting yarn length on the default 48 × 60 chart.

**Architecture:** Solve one dimensionless coefficient from a representative supported row while applying each candidate to every supported row, then reuse that coefficient across the chart. Cache the coefficient by chart topology, primary yarn diameter, and requested length; keep per-row path generation and continuity fallback unchanged.

**Tech Stack:** JavaScript, Vite SSR validation harness, D3 Catmull–Rom paths, Canvas 2D.

---

### Task 1: Add the large-chart regression test

**Files:**
- Modify: `scripts/validate-two-ply-yarn.mjs`

- [ ] Add a `48 × 60` knit render with `lengthScaleY: 0.9`, measure `performance.now()` around the real `simulate()` call, and assert completion below `2000ms`.
- [ ] Run `npm run validate:two-ply-yarn` and verify it fails with the performance assertion after reproducing the previous roughly 56-second solve.

### Task 2: Replace per-row repeated solving with one shared coefficient

**Files:**
- Modify: `src/simulation/yarnSimulation.js`

- [ ] Build the supported-row list once and choose a representative row, preferring an interior row whose neighbors are also supported.
- [ ] During candidate measurement, assign the candidate coefficient to every supported row so cross-row Catmull–Rom context matches final rendering.
- [ ] Call `solveSharedCoefficient()` once, then fill every supported row with the returned coefficient; unsupported rows remain at `1`.
- [ ] Keep final path generation and per-row `assertContinuousRowPaths()` fallback unchanged.
- [ ] Run `npm run validate:two-ply-yarn` and verify the large chart finishes below `2000ms` while 0.90/1.10 length-ratio and multi-yarn path-equality checks still pass.

### Task 3: Cache repeated coefficient requests

**Files:**
- Modify: `src/simulation/yarnSimulation.js`
- Modify: `scripts/validate-two-ply-yarn.mjs`

- [ ] Add a module-level bounded cache with at most 32 entries, keyed by chart dimensions and pixels, first-yarn diameter, and requested length scale.
- [ ] On a cache hit, populate the supported rows without calling the numerical solver; on insert, evict the oldest key when the cache is full.
- [ ] Extend the runtime test with a second identical large-chart render and assert it is no slower than the first render.

### Task 4: Avoid recomputing between drag events

**Files:**
- Modify: `src/components/runSimulation.js`
- Modify: `scripts/validate-row-length-loop-model.mjs`

- [ ] Change the existing preview recomputation debounce from `30ms` to `150ms`; state and displayed slider value remain immediate, only Canvas recomputation is delayed.
- [ ] Add a source assertion that the yarn preview uses the `150ms` debounce.

### Task 5: Verify the complete application

**Files:**
- Modify: `KnitScape_单面布技术文档.md`

- [ ] Document that one shared coefficient is solved and cached for all supported rows.
- [ ] Run every `validate:*` package script, `npm run build`, and `git diff --check`.
- [ ] Start the local Vite app, drag the yarn-length slider repeatedly, confirm the page remains responsive, and check browser logs for errors.
