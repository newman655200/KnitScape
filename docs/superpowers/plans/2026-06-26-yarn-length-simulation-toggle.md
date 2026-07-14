# Yarn Length Simulation Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-preview "Simulate" switch so yarn-length deformation is disabled by default and only runs when explicitly enabled.

**Architecture:** Store the switch in global UI state, render it in the right preview controls, and pass the state into the yarn renderer. The renderer short-circuits yarn-length unit statistics and curve deformation while the switch is off, so normal preview updates still work without the extra length-simulation cost.

**Tech Stack:** Vite, lit-html, canvas renderer, Node validation scripts.

---

### Task 1: Validation Coverage

**Files:**
- Create: `scripts/validate-yarn-length-simulation-toggle.mjs`
- Modify: `package.json`

- [x] **Step 1: Write the failing test**

Create a validation script that asserts:
- `package.json` exposes `validate:yarn-length-toggle`.
- `GLOBAL_STATE.yarnLengthSimulationEnabled` defaults to `false`.
- `runSimulation.js` renders a `yarn-length-sim-toggle` button and passes `yarnLengthSimulationEnabled` into `simulate`.
- `simulate(..., { yarnLengthSimulationEnabled: false })` preserves baseline paths even when yarn plies contain non-default `lengthScaleY`.
- `simulate(..., { yarnLengthSimulationEnabled: true })` applies the existing yarn-length path deformation.

- [x] **Step 2: Run the test to verify it fails**

Run: `npm run validate:yarn-length-toggle`

Expected: FAIL because the package script and production switch do not exist yet.

### Task 2: Simulation Switch Implementation

**Files:**
- Modify: `src/state.js`
- Modify: `src/components/runSimulation.js`
- Modify: `src/simulation/yarnSimulation.js`
- Modify: `src/i18n/translations.js`
- Modify: `styles.css`

- [x] **Step 1: Add default state**

Add `yarnLengthSimulationEnabled: false` next to the simulation preview state.

- [x] **Step 2: Add right-preview control**

Render a text button in `#sim-controls` named by `t("simulation.yarnLength", language)`. Clicking it toggles `GLOBAL_STATE.yarnLengthSimulationEnabled`.

- [x] **Step 3: Pass and honor the flag**

Pass `yarnLengthSimulationEnabled` into `simulate`. Inside the renderer, skip `createLengthUnitStats()` and return original curve points when the flag is false.

- [x] **Step 4: Run focused validation**

Run: `npm run validate:yarn-length-toggle`

Expected: PASS.

### Task 3: Regression Verification And Docs

**Files:**
- Modify: `KnitScape_单面布技术文档.md`

- [x] **Step 1: Run existing yarn preview checks**

Run:
- `npm run validate:yarn-length-scaling`
- `npm run validate:yarn-length-parameters`
- `npm run validate:two-ply-yarn`
- `npm run validate:sim-wheel-performance`
- `npm run build`

Expected: All exit `0`; Vite chunk-size warning is acceptable if build succeeds.

- [x] **Step 2: Update the MD document**

Record that yarn-length simulation is now opt-in through the right-preview "模拟" control, default off for performance.

- [x] **Step 3: Independent review**

Ask an independent code-review agent to inspect the diff for requirement coverage and regressions before reporting completion.
