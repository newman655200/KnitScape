# Left Yarn Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the two-yarn color and diameter controls into a prominent area in the left sidebar.

**Architecture:** Reuse the existing `yarnPlies` state and dispatch flow. The left sidebar owns the visible controls; the settings modal keeps only general settings to avoid duplicate parameter locations.

**Tech Stack:** Vite, lit-html, plain CSS, existing validation scripts.

---

### Task 1: Validate Left-Side Yarn Parameter UI

**Files:**
- Modify: `scripts/validate-two-ply-yarn.mjs`

- [ ] **Step 1: Add failing static assertions**

Assert that `src/views/leftBar.js` contains `双纱参数`, `第一支纱线`, `第二支纱线`, `第一支纱线颜色`, `第二支纱线颜色`, `第一支纱线直径`, `第二支纱线直径`, `显示第二支纱线`, and `updateYarnPly`.

- [ ] **Step 2: Assert duplicate settings entry is removed**

Assert that `src/views/settingsModal.js` no longer contains the dual-yarn UI helper or `纱线设置`.

- [ ] **Step 3: Run red verification**

Run: `npm run validate:two-ply-yarn`
Expected: FAIL because the left sidebar does not yet contain the requested UI.

### Task 2: Implement Left-Side Controls

**Files:**
- Modify: `src/views/leftBar.js`
- Modify: `src/views/settingsModal.js`
- Modify: `styles.css`

- [ ] **Step 1: Move UI behavior into leftBar**

Add an immutable `updateYarnPly(index, patch)` helper and a `yarnPlyPanel()` section rendered directly after the add-repeat button.

- [ ] **Step 2: Remove duplicate settings UI**

Remove the dual-yarn controls from `settingsModal.js`, leaving only general settings.

- [ ] **Step 3: Add left sidebar styles**

Make the left sidebar wide enough for horizontal Chinese labels and style `.yarn-ply-panel`, `.yarn-ply-card`, fixed color swatches, sliders, values, and the second-yarn toggle.

- [ ] **Step 4: Run green verification**

Run: `npm run validate:two-ply-yarn`, `npm run validate:single-ui`, `npm run validate:repeat-dimensions`, and `npm run build`.

### Task 3: Browser Check, Review, And Docs

**Files:**
- Modify: `KnitScape_单面布技术文档.md`

- [ ] **Step 1: Browser smoke test**

Open the local app, confirm the left sidebar shows the dual-yarn panel and the settings modal no longer duplicates it.

- [ ] **Step 2: Independent validation**

Spawn a read-only validation agent to inspect the left UI move and command results.

- [ ] **Step 3: Update technical document**

Record the new left-sidebar placement and validation result in `KnitScape_单面布技术文档.md`.
