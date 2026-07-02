# KnitScape Single-Face-Only Cleanup Design

## Goal

Turn the current working tree into a single-face-only application by removing every double-face, spacer-air-layer, and Three.js preview implementation and artifact while preserving all existing single-face behavior and in-progress single-face changes.

## Scope

The cleanup removes:

- `src/doubleFace/`
- `src/views/doubleFaceEditor.js`
- `src/components/doubleFacePreview3d.js`
- double-face state, mode constants, rendering branches, imports, and CSS
- the `three` dependency and double-face validation command
- `scripts/validate-double-face-foundation.mjs`
- `KnitScape_双面布技术文档.md`
- double-face Step screenshots and raw files under `outputs/`
- `.tmp-chrome-step*` browser profiles
- stale double-face architecture language in single-face documentation

The cleanup does not rewrite Git history, reset the branch, or discard unrelated existing modifications.

## Application Architecture After Cleanup

The application has one unconditional path:

```text
repeat editor
-> generated single-face chart
-> D3/Canvas yarn simulation
-> back/mid/front preview canvases
```

`GLOBAL_STATE` no longer contains `fabricMode` or `doubleFaceState`. The main view always renders the single-face canvas editor. The simulation runner always invokes the existing single-face `simulate()` pipeline. Importing or creating a project initializes only single-face data.

The taskbar keeps the single-face product title but removes the redundant fabric-mode control. Its translation keys and double-face-only styles are removed.

## Dependency and Artifact Cleanup

Because no retained source imports Three.js, `three` is removed from `package.json` and `package-lock.json`. The double-face npm validation command is removed.

The double-face technical document, generated preview screenshots/raw files, and temporary Chrome profiles are deleted rather than archived. Single-face documentation is edited only where it describes the removed dual-project architecture or obsolete double-face constraints; unrelated single-face guidance remains intact.

## Regression Protection

A new `validate:single-only` command checks the maintained application surface for:

- absence of removed double-face source paths
- absence of `fabricMode`, `doubleFaceState`, and Three.js imports in runtime source
- absence of the `three` dependency and double-face npm command
- absence of double-face runtime CSS selectors

The validation intentionally does not reject historical wording inside this cleanup design record.

## Verification

Implementation follows a red-green sequence:

1. Add the single-only validator and run it against the current tree; it must fail because double-face files and references still exist.
2. Remove the double-face implementation and artifacts, then run the validator again; it must pass.
3. Run every retained `validate:*` npm command.
4. Run `npm run build`.
5. Search maintained source, package files, styles, and user-facing single-face documentation for orphaned double-face or Three.js references.

Success means the production build and all retained single-face validations pass, the application contains no double-face execution path, and existing single-face functionality remains intact.
