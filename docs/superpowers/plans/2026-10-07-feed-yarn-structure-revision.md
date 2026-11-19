# Feed Yarn Structure Revision Implementation Plan

**Goal:** Reject stale batch selections after any assignment identity change without changing valid results on rejection.

**Architecture:** `state.js` owns one runtime monotonic revision. Structural comparison catches count/ID changes; full replacement and import explicitly declare replacement intent at the same dispatch. Batch selections carry the captured revision and locators; preflight checks revision first. The editor marks stale selections immediately and clears them on rejected submission.

**Tech Stack:** Existing JavaScript, Vite SSR validators, lit-html, real CUA browser interaction.

User has specified and authorized this design and inline execution. Preserve all prior changes; no commits, tags, schema migration, or unrelated cleanup.

- [x] Add `scripts/validate-yarn-length-structure-integration.mjs` using real actions/state/runner/solver; reproduce ABA and same-ID shift before implementation. Run `node scripts/validate-yarn-length-structure-integration.mjs` and record the expected stale-rejection failure.
- [x] Add a structural comparator and runtime revision preparation in `src/state.js`; wrap dispatch/loadWorkspace atomically, ignoring incoming revision values. Declare full replacement in Cam creation, Feed replacement and validated project import. Existing slot assignment to the same asset is a no-op.
- [x] Require `{structureRevision, targets}` for the batch action; check revision before value/locator validation. Keep existing locator checks and all-or-nothing mutation.
- [x] Capture revision at first UI selection. Mark stale immediately; never check recreated/moved slots automatically. Reject and clear stale selection with “纱线配置已变化，请重新选择”. Add translations without layout changes.
- [x] Adapt existing batch API callers in validators; preserve all previous assertions and retain explicit Layer-2 stale-ID coverage. Add the new validator to `package.json`.
- [x] Run BLOCKER A–G, parameter/PBR/load/persistence/atomicity checks and P0-1–4 validators. Execute real browser ABA and same-ID shift plus original browser regressions; save DOM results and screenshots.
- [x] Run `npm run validate`, `npm run build`, `git diff --check`; review incremental patch against protected files. Save a 30-point report and stop without commit/tag.
