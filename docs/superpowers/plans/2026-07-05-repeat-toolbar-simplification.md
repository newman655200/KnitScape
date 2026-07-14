# Repeat Toolbar Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the repeat editor toolbar to width, height, brush, and exit while preserving manual stitch drawing.

**Architecture:** Keep the existing repeat dimension and brush paths. Remove repeat deletion and the flood/line/rectangle tool chain from the UI, keyboard tool registry, translations, icons, and code guide; pointer and touch editing fall back to brush if stale runtime state names a removed tool.

**Tech Stack:** JavaScript, Lit HTML, Canvas pointer/touch events, Node validation scripts.

---

### Task 1: Add a failing toolbar contract test

**Files:**
- Modify: `scripts/validate-repeat-dimension-sync.mjs`

- [ ] Read `repeatTools.js`, `repeatEditingTools.js`, `constants.js`, `translations.js`, and `uiButton.js` in the validator.
- [ ] Assert the toolbar retains `repeat.width`, `repeat.height`, `repeatTools.brush`, and `repeat.exit`.
- [ ] Assert deleted repeat keys and the flood/line/rect implementations are absent, and `Object.keys(repeatEditingTools)` equals `["brush"]` after SSR loading.
- [ ] Run `npm run validate:repeat-dimensions`; expect failure because the old buttons and functions still exist.

### Task 2: Remove the obsolete repeat editing actions and UI

**Files:**
- Modify: `src/views/repeatTools.js`
- Modify: `src/actions/repeatEditingTools.js`
- Modify: `src/constants.js`
- Modify: `src/events/repeatPointerInteraction.js`
- Modify: `src/events/repeatTouchInteraction.js`

- [ ] Delete the repeat delete button and its array-splice dispatch.
- [ ] Reduce `repeatToolButtons` and `repeatEditingTools` to brush only.
- [ ] Reduce `toolData` to the brush hotkey only.
- [ ] In pointer and touch editing, resolve `repeatEditingTools[activeTool] || repeatEditingTools.brush` so stale state remains editable.
- [ ] Run `npm run validate:repeat-dimensions`; expect the action/UI assertions to pass or report only metadata remnants.

### Task 3: Remove obsolete metadata and regenerate the code guide

**Files:**
- Modify: `src/i18n/translations.js`
- Modify: `src/views/uiButton.js`
- Modify: `src/codeGuide/codeGuideDefinitions.json`
- Modify: `src/codeGuide/generatedLines.json`
- Modify: `scripts/validate-code-guide.mjs`
- Modify: `scripts/validate-language-switching.mjs`

- [ ] Remove repeat delete/flood/line/rect translations in all four languages while keeping brush and exit.
- [ ] Remove the unused trash/fill/line/rect SVG entries.
- [ ] Remove `repeat.delete` from the code-guide contract and redefine `repeat.tool` as the brush-only control.
- [ ] Run `npm run generate:code-guide-lines`.
- [ ] Run the repeat, code-guide, and i18n validators; expect all three to pass.

### Task 4: Browser and full verification

**Files:**
- Modify: `KnitScape_单面布技术文档.md`

- [ ] Document the simplified repeat toolbar.
- [ ] Start Vite and verify the toolbar shows two number inputs, brush, and exit only.
- [ ] Verify brush and exit remain interactive and browser logs contain no errors.
- [ ] Run every `validate:*` script, `npm run build`, and `git diff --check`.
