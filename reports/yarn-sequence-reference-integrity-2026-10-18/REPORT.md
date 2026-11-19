# Yarn Palette / Sequence Reference Integrity

Date: 2026-10-18 (Asia/Shanghai). Stage: P0-C0 Correctness Preparation.

## 1. Domain Invariant

Every project `yarnSequence` pixel must be an integer satisfying `0 <= pixel < yarnPalette.length`.
`activeYarn` is a runtime/UI selection, not Project Authority. It must select a current palette slot when used for writing. `yarnSequence` is project domain data; its indices retain their existing palette-slot meaning.

No new ID mapping, store, domain module, project schema, or physical parameter was introduced.

## 2. Confirmed Root Cause

Before modification, New and Load replaced palette/sequence without replacing `activeYarn`. Pointer, touch and resize copied this stale index into project data. The sequence normalizer coerced values but had no palette context. Neither import nor project serialization cross-validated references. Deletion already remapped sequence indices but omitted the runtime selection.

Starting commands, run on the existing working tree:

```text
git branch --show-current -> main
git rev-parse HEAD -> 7ababf264d495f6b96d4d66652c529424938ac4d
git log -1 --oneline -> 7ababf2 feat: establish trusted feed yarn length workflow
git status --short -> existing modified/untracked source, validators, documents and reports
```

This was not a clean baseline. See [starting status](baseline-status.txt) and [starting tracked diff](baseline-diff.patch). The importer and lifecycle validator already contained unrelated uncommitted work, retained in place. The explicit current repair request supersedes the dated 2026-10-17 documentation-only task restriction. No commit, tag, branch switch, reset or stash was performed.

Baseline `npm run validate`: **38/39**, with only `validate:row-length-loop-model` failing because the Markdown no longer matches `/## \d+\. 当前验证结果/`. The Markdown and its validator were not repaired. See [baseline log](baseline-validate.txt).

## 3. All Writers Audit

Global source and validator searches were completed before implementation. Evidence: [source references](writers-search.txt), [validator references](validators-search.txt).

| Entry | Writes / ownership | Finding / treatment |
|---|---|---|
| `src/state.js` initial state | activeYarn 0, singleton palette, zero sequence | Already valid; unchanged |
| `newPattern()` | Replaces palette/sequence/chart/repeats | Add activeYarn 0 to same action |
| `loadJSON()` | Replaces palette/sequence, including Pattern-only import | Validate raw references; reset activeYarn 0 |
| `loadProjectFile()`, `loadLibraryPattern()`, `uploadFile()` | File/package/example ingress through loadJSON | Covered by canonical load boundary; async transaction code unchanged |
| `yarnPicker()` number and edit controls | Select indices obtained from palette iteration | Valid current palette indices; unchanged |
| `yarnPicker()` add | Appends palette entry | Preserves existing slots; unchanged |
| `updateYarnPaletteColor()` | Edits palette, preserves old used color in another slot, remaps sequence, selects edited slot | Existing behavior retained and existing editor tests passed |
| `deleteColor()` | Removes one palette entry; sequence deleted index -> 0, larger indices -> index - 1 | Existing sequence policy retained; add corresponding selection rebind |
| `yarnPicker()` shuffle | Permutes palette values in existing slots | Length and references unchanged; intentional recoloring policy retained |
| `yarnPicker()` randomize | Replaces colors with same palette length | References unchanged; retained |
| `colorSequencePointerInteraction` | Initial brush and dragged line | Shared predicate before initial action and every move |
| `colorSequenceTouchInteraction` | Initial touch brush and dragged line | Same shared predicate at both boundaries |
| `chartResizeForRepeat()` / `resizeChartArea()` | Chart-height sequence changes | Pass actual palette length to checked helper |
| Pointer/touch repeat boundary resize | Calls chartResizeForRepeat | Same checked helper; no duplicated resize rule |
| `resizeYarnSequenceToChartHeight()` | Pure sequence resize result | Validate selection and all existing pixels before normalization/cropping |
| `resizeYarnSequenceRows()` | Compatibility wrapper, no current production caller | Forward required palette length; no unguarded alternate path |
| `normalizeYarnSequence()` | Pure shape normalization; also used by consumers | Import validates before calling; consumer behavior unchanged |
| `getProjectData()` / `downloadProject()` | Formal project serialization/download | Reject bad references before serialization; reuse download error handling |
| `projectPackage.js` | Existing project-field whitelist and package metadata | No activeYarn persisted; unchanged |
| BMP/Kniterate/debug outputs | Consume sequence/palette; do not mutate project references | Unchanged; formal project guard belongs in getProjectData |
| `dispatch()` / `loadWorkspace()` | Generic state plumbing; loadWorkspace has no production caller | Unchanged; test setup may deliberately inject damaged state |
| Snapshot/Undo | Restores existing palette/sequence snapshots, excludes activeYarn | Audited only; explicitly outside this task, unchanged |

No other production sequence writer or palette-shrinking/reordering action was found. Library/Feed Yarn actions concern a separate identity system and were not changed.

## 4. New Lifecycle

New creates the existing singleton default palette and zero sequence and explicitly sets `activeYarn = 0` in the same dispatch. Regression starts with palette length 3 and selection 2, then executes New, real pointer listeners and chart expansion. All new rows and painted rows reference slot 0.

## 5. Load Lifecycle

Full Load always selects slot 0, including when the incoming palette has the same length as the old one. Old/new slot numbers have no stable cross-project identity.

Pattern-only import already replaces palette/sequence; it also selects slot 0. Its existing policy of retaining Cam and Yarn Library is unchanged. Missing/empty palettes continue the existing default-palette policy. Missing sequences continue to generate slot-0 rows. Runtime selection is not read from or written to project files.

## 6. Same-project Palette Mutation

Deletion already implemented the product's sequence remap: deleted entry -> slot 0, later entries -> preceding slot. This explicit user-requested deletion policy is retained, not repurposed as a corrupt-data repair.

Selection now follows the same identity change: deleting the selected entry selects slot 0; deleting an earlier entry decrements the selected slot; deleting a later entry preserves the selection. Last-entry deletion remains blocked. Tests cover deleting B/C/A from `[A,B,C]` with sequence `[0,2,2,1]`, both selected and unselected entries.

Append, color edit/preserve, shuffle and randomize do not introduce out-of-bounds references from valid inputs. Their semantics were not redesigned.

## 7. Write Boundary

`yarnSequenceRows.js` owns the small shared palette-index predicate and assertions. Pointer/touch start and line moves ignore an invalid active selection before writing. The move-time check also catches a selection/palette change during a gesture. End listeners retain their existing cleanup.

Resize receives palette length explicitly and rejects invalid selection or existing references. It checks existing pixels before trimming rows, so shrinking cannot hide damaged data. Valid selection 2 still fills new rows with 2. Consumers and Canvas were not modified to mask invalid colors.

## 8. Import Validation

`loadJSON()` validates raw sequence pixels against the resolved incoming palette before `normalizeYarnSequence()` or Bimp construction. This prevents negative/fractional/nonfinite/string/null references from being coerced to valid-looking indices. Out-of-range references in rows/columns that would otherwise be cropped are also rejected.

Error example: `Yarn sequence references invalid palette index 2 (palette length 1).`

The check lives in the existing staged validation block; rejection leaves project state unchanged. No general File Load transaction behavior was changed. No silent clamp, slot-0 substitution for existing bad pixels, or new migration was added.

## 9. Export Validation

`getProjectData()` validates every current sequence reference before cloning/serializing. Invalid internal state therefore cannot normally generate a `.knitscape` project through the formal export path.

`downloadProject()` retains its existing catch/alert/finally behavior: invalid export returns false, alerts once, clears `projectExporting`, and leaves the damaged sequence untouched for diagnosis. A test also confirms that a stale runtime selection alone is not serialized or treated as project authority.

## 10. Legacy Compatibility

[Compatibility scanner](scan-compatibility.mjs) inspected **351 JSON/package files** across the repository, including examples, reports, saved `.knitscape` manifests, fixtures and compatibility material; **48 palette+sequence records**, **0 invalid references**, **0 read/parse failures**. All 15 examples are included. Full inventory: [compatibility.json](compatibility.json).

No legitimate historical format requiring an out-of-bounds reference migration was found. Canonical Load therefore rejects invalid references. Existing valid missing/array/short/wide sequence normalization remains covered; wide input retains its first-column interpretation. A wide sequence containing a bad reference in a discarded column is now rejected rather than silently discarded. Such an invalid historical file was not found in the scan.

## 11. Fix

Implementation order followed the supplied design: audit and baseline; extend the existing lifecycle regression and observe failures; add the shared checks and lifecycle/deletion changes; run targeted checks; run full validation/build and inspect scope. No separate architecture or parallel runtime path was needed.

Only these business-source files changed in this task:

| File | Why necessary |
|---|---|
| `src/actions/yarnSequenceRows.js` | One shared predicate/assertion; checked resize and wrapper |
| `src/actions/importers.js` | New/Load selection reset; pre-normalization reference validation |
| `src/actions/exporters.js` | Final formal project serialization guard |
| `src/actions/repeatDimensions.js` | Supply current palette length at the actual resize caller |
| `src/events/colorSequencePointerInteraction.js` | Protect mouse brush and line writes |
| `src/events/colorSequenceTouchInteraction.js` | Protect real touch brush and line writes |
| `src/views/yarnPicker.js` | Rebind selection alongside existing deletion remap |

Validator changes: `scripts/validate-project-load-lifecycle.mjs` extends the existing harness; `scripts/validate-yarn-sequence-editor.mjs` supplies palette context and corrects the old fixture that selected slot 2 without establishing a three-entry palette. No new validator command or source module was added. Report/evidence files are confined to this new report directory.

Generated metadata: `src/codeGuide/generatedLines.json` updates only seven `palette.*` locations by +2 lines, because the deletion selection rebind moved their source anchors. The first aggregate run reported this stale generated metadata; `npm run generate:code-guide-lines` regenerated it and `npm run validate:code-guide` passed. Previous unrelated line-map edits are retained. This is the eighth touched file under `src`, not a new source module or business logic file.

The existing importer changes are preserved. [Task-only patch](task-only.patch) compares the ten touched source/metadata/validator files with pre-turn copies (including the already-untracked lifecycle validator), instead of attributing all dirty work to this task. [Scope checker](check-scope.mjs) compares all unrelated tracked diffs against the pre-turn diff snapshot; [result](scope-check.txt). Solver, Geometry, Yarn Length, Gauge, Material, PBR, Machine Domain, Canvas/Renderer, project package format and Undo received no task edits.

## 12. Regression

| Verification | Result / evidence |
|---|---|
| Pre-fix extended lifecycle regression | **19/49 PASS; 30 expected FAIL**, [red log](regression-red.txt) |
| Same 49 cases after repair | **49/49 PASS**, [green log](regression-green.txt) |
| Added compatibility/download/same-size-load checks | **52/52 PASS** in final aggregate run |
| `npm run validate:yarn-sequence-editor` | PASS |
| Baseline `npm run validate` | **38/39**, only known Markdown title failure |
| Final `npm run validate` | **38/39**, exit 1; only the same known Markdown title failure; **new failure count = 0**; [final log](final-validate.txt) |
| `npm run build` | **PASS**, [build log](build.txt) |
| `git diff --check` | **PASS**, exit 0; only existing LF/CRLF notices |
| Unrelated tracked diff preservation | PASS via scope checker |

A focused read-only reviewer compared all seven business-source files and both validators with pre-turn copies and traced resize callers, lifecycle dispatch, painting, deletion and serialization. No actionable correctness issue was found. The review did not run the full suite or a browser interaction. The intermediate generated-line failure is preserved in [validate-before-line-regeneration.txt](validate-before-line-regeneration.txt); it was corrected without changing business behavior or the known Markdown failure.

The harness executes real actions, real StateMonitor, Bimp operations and registered pointer/touch listeners with controlled event coordinates. Deletion runs the actual `deleteColor` source body with real state/Bimp to avoid loading the browser-only color-picker dependency. No physical browser mouse/touch gesture was performed. This is software regression evidence, not manufacturing/physical validation.

## 13. Project Format

**NO CHANGE.** Same persisted field whitelist; `.knitscape` remains version 2; sequence remains Bimp palette-slot data. No sequenceVersion, paletteId, UUID map or persisted activeYarn. Existing package round-trip/schema assertions pass.

## 14. Remaining Risks

- Undo remains outside scope: snapshots do not own activeYarn, so restoring a smaller palette can still leave a stale runtime selection. Checked pointer/touch writes block it, checked resize rejects it, and a user can select a valid current slot. No Undo change was attempted.
- Compatibility conclusions cover repository material scanned, not every external project ever created. Previously damaged files are deliberately rejected with an index/length error.
- The known Markdown title assertion still prevents an all-green aggregate `npm run validate`; it was not introduced or repaired here.
- Bimp storage and consumer normalization remain the existing implementation; this task does not expand its storage capacity or redesign project shape validation.

Final acceptance: **YARN_SEQUENCE_REFERENCE_INTEGRITY = PASS**. All twelve task acceptance conditions are satisfied within the explicitly bounded scope. The aggregate validation baseline exception remains visible. Work stopped after report completion; no File Load transaction repair, Undo repair, P1 work, commit or tag followed.
