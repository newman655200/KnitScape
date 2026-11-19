# P1-1 Material Authority Implementation Plan

Execution: inline, using executing-plans and TDD. User has specified the design, main-only baseline, no commits/tags and the A–J acceptance contract. No additional design approval is needed.

Goal: assigned YarnAsset fields own material and geometry, with explicit field-level compatibility fallbacks.

Architecture: one pure resolveYarnMaterial entry, adapted to existing plies; existing geometry accepts a course diameter lookup, one geometry per distinct strand diameter profile. Existing solver and machine domain remain the only execution paths. Optional fields extend existing assets, package version stays unchanged.

Tech stack: existing JavaScript/Vite/Canvas/WebGL and Node validation scripts.

- [x] Baseline: main, 7ababf264d495f6b96d4d66652c529424938ac4d, baseline-trusted-yarn-length. Tracked tree clean.
- [x] Trace real consumers and save reports/p1-1/authority-before.md before production edits.
- [ ] Write failing A–I resolver/domain/integration assertions in scripts/validate-yarn-material-authority.mjs; run with Node.
- [ ] Add src/domain/yarnMaterial.js: resolveYarnMaterial({ yarnAsset, legacyContext }) -> color, diameter, pbr, texture, source. source is per-field ASSET / LEGACY_FALLBACK / DEFAULT. Existing partial Asset PBR groups use neutral defaults for missing maps; no maps uses legacy texture. Asset Albedo has textureStrength=1 and original color.
- [ ] Extend normalizeYarnLibrary with optional valid color/positive diameter; preserve absent values for old files. Add metallic to normalization/import/registry/package-driven map enumeration and renderer sampler unit 5.
- [ ] Adapt resolveFeedYarnPlies; preserve no-field legacy compatibility. Suppress legacy second strand on explicitly assigned feeds. Do not suppress explicit slots via legacy toggle or palette mask.
- [ ] Route per-slot diameters through yarnPathGeometry and existing solver evaluator; cache key includes effective diameter profiles. Parallel offsets use individual widths.
- [ ] runSimulation invalidates only geometry-dependent changes; material-only edits redraw while keeping verified results/revision. Add real state/action regression assertions.
- [ ] Run A–I, existing geometry/multi-yarn/P0 validators. Correct failures from root causes; preserve old behavior for absent fields.
- [ ] Import actual five PNGs from PBR/Yarn1, inspect IHDR/alpha/data and importer mapping. SOP J uses existing true 4x8/8 feeds/23 cm/32G/1234/repeat22.987, diameter remains uncalibrated.
- [ ] Browser E2E: open previous SOP package, replace full PBR group with five real files, restore repeat22.987 using existing UI, verify8CONVERGED, save/reload/re-run, record screenshots and DOM. No artistic adjustment.
- [ ] npm run validate; npm run build; git diff --check; self-review diff and final report34 items, changes/stat/risks/LEVEL/P1-2 recommendation. Stop without commit/tag.

Decisions: no large material UI; color and diameter tested through fixtures. No target/tension/placement in Asset. Repeat belongs to existing asset.pbr, no duplicated top-level authority. Exact scan repeat is2172/2400*25.4=22.987mm;2400DPI is user provenance, not PNG metadata. Height remains an existing optional compatibility map in addition to required five.
