import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { ZipReader, Uint8ArrayReader, Uint8ArrayWriter, TextWriter } from "@zip.js/zip.js";
const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const hash = value => createHash("sha256").update(value).digest("hex");
const slots = ["baseColor", "normal", "roughness", "height", "ambientOcclusion"];
const uiBefore = JSON.parse(await fs.readFile(path.join(dir, "before-save-ui.json"), "utf8"));
const uiAfter = JSON.parse(await fs.readFile(path.join(dir, "after-reload-ui.json"), "utf8"));
assert.deepEqual(uiAfter.feeds, uiBefore.feeds);
assert.equal(uiAfter.checkedAssignments, 0);
assert.equal(uiAfter.pendingNotice, false);
assert.equal(uiAfter.validity, "VALIDATED");
const packages = [];
for (const name of ["user-save.knitscape", "user-reexport.knitscape"]) {
  const bytes = await fs.readFile(path.join(dir, name));
  const reader = new ZipReader(new Uint8ArrayReader(bytes), { useWebWorkers: false });
  try {
    const entries = await reader.getEntries();
    const byName = new Map(entries.map(entry => [entry.filename, entry]));
    const manifest = JSON.parse(await byName.get("project.json").getData(new TextWriter(), { checkSignature: true }));
    for (const key of ["yarnLengthSolverResults", "previewValidity", "feedYarnStructureRevision", "pendingYarnId",
      "yarnLibraryQuery", "selectedBatchTargets", "selectedStructureRevision", "workspaceMode"]) {
      assert.equal(Object.hasOwn(manifest, key), false, "Runtime/UI persisted: " + key);
    }
    assert.equal(manifest.machineGauge, 32);
    assert.deepEqual(manifest.needleArrangement, [1,2,3,4]);
    assert.ok(manifest.singleJerseyCamProgram.tracks.flat().every(operation => operation === "K"));
    const feedTargets = manifest.singleJerseyCamProgram.feeds.map(feed => feed.yarns.map(yarn => yarn.yarnLengthCmPer100Needles));
    assert.deepEqual(feedTargets, [[23,27],[21],[23],[23]]);
    assert.deepEqual(manifest.singleJerseyCamProgram.feeds.map(feed => feed.yarns.map(yarn => String(yarn.yarnId))),
      uiBefore.feeds.map(feed => feed.map(yarn => yarn.yarnId)));
    const assets = [];
    for (const [assetName, set, repeat] of [["T-001","A",10],["N-003","B",12]]) {
      const asset = manifest.yarnLibrary.find(asset => asset.name === assetName);
      assert.ok(asset);
      assert.equal(asset.pbr.physicalRepeatLengthMm, repeat);
      const images = [];
      for (const slot of slots) {
        const map = asset.pbr[slot];
        assert.ok(map?.assetRef);
        const image = await byName.get(map.assetRef).getData(new Uint8ArrayWriter(), { checkSignature: true, useWebWorkers: false });
        const original = await fs.readFile(path.join(dir, "fixtures", set, map.fileName));
        assert.deepEqual(Buffer.from(image), original);
        images.push({ slot, filename: map.fileName, bytes: image.length, sha256: hash(image), exactOriginalBytes: true });
      }
      assets.push({ id: asset.id, name: assetName, category: asset.category, physicalRepeatLengthMm: repeat, images });
    }
    assert.equal(entries.filter(entry => !entry.directory).length, 11);
    packages.push({ file: name, bytes: bytes.length, manifest, entryNames: entries.map(entry => entry.filename), feedTargets, assets });
    await fs.writeFile(path.join(dir, name.replace(".knitscape", "-manifest.json")), JSON.stringify(manifest,null,2));
  } finally { await reader.close(); }
}
const manifestEqual = JSON.stringify(packages[0].manifest) === JSON.stringify(packages[1].manifest);
const differingFactKeys = Object.keys(packages[0].manifest).filter(key =>
  JSON.stringify(packages[0].manifest[key]) !== JSON.stringify(packages[1].manifest[key]));
const report = { status: differingFactKeys.length ? "FACT_DIFFERENCE" : "PASS", evidenceType:"actual-browser-download-and-reexport",
  browserUIFeedsEqual:true, batchSelectionClearedAfterPageRestart:true, pendingCleared:true, runtimeFieldsExcluded:true,
  originalPbrMapsVerified:20, manifestEqual, differingFactKeys,
  packages: packages.map(({manifest,...other}) => ({...other,legacyPlies:manifest.yarnPlies})) };
console.log(JSON.stringify(report,null,2));
assert.deepEqual(differingFactKeys, [], "Saved facts changed after real Load/Re-export");
