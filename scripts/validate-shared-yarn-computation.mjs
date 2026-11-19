import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "vite";

// No project Vite config, listener, or workspace cache is needed for these probes.
const cacheDir = process.env.KNITSCAPE_TEST_CACHE_DIR || path.join(os.homedir(), "Documents", "KnitScape",
  "archives", "validation-cache", "shared-yarn-computation-vite");
for (const name of ["computeYarnSimulation", "simulationSnapshot", "yarnRenderItems"]) {
  assert.ok(fs.existsSync(`src/simulation/${name}.js`), `${name} must provide the shared headless boundary`);
}
globalThis.__sharedSnapshotDropApplication = false;
const server = await createServer({ configFile: false, cacheDir, appType: "custom", logLevel: "silent",
  server: { middlewareMode: true, hmr: { server: createHttpServer() } },
  plugins: [{ name: "observe-snapshot-application", enforce: "pre", transform(source, id) {
    if (!id.replaceAll("\\", "/").endsWith("/src/simulation/yarnPathGeometry.js")) return;
    const seam = "function resolveModelPathsForDisplay(solvedPathByLink) {";
    assert.equal(source.split(seam).length, 2);
    return source.replace(seam, `${seam}\n    if (globalThis.__sharedSnapshotDropApplication) return resolvedPathByLink;`);
  } }],
});
try {
  for (const key of ["document", "window", "devicePixelRatio", "Image", "WebGLRenderingContext"]) {
    assert.equal(key in globalThis, false, `${key} must not be needed by headless computation`);
  }
  const [{ computeYarnSimulation }, { createSimulationSnapshot, copySolverResults },
    { resolveYarnRenderItems }, { normalizeYarnPlies, resolveFeedYarnPlies }, { Bimp }] = await Promise.all([
    "/src/simulation/computeYarnSimulation.js", "/src/simulation/simulationSnapshot.js",
    "/src/simulation/yarnRenderItems.js", "/src/domain/yarnMaterial.js", "/src/lib/Bimp.js",
  ].map(file => server.ssrLoadModule(file)));

  const original = { value: 3, nested: [4] };
  const mutableMap = new Map([["value", original]]);
  const immutable = createSimulationSnapshot({ map: mutableMap, original });
  assert.ok(Object.isFrozen(immutable));
  assert.ok(Object.isFrozen(immutable.map));
  assert.equal(immutable.map.get("value"), immutable.original, "snapshot cloning preserves internal identity");
  for (const mutate of [
    () => immutable.map.set("new", 1), () => immutable.map.delete("value"), () => immutable.map.clear(),
    () => Map.prototype.set.call(immutable.map, "new", 1),
    () => { immutable.map.get("value").nested[0] = 9; },
    () => { immutable.map.values().next().value.value = 9; },
    () => { immutable.map.entries().next().value[1].value = 9; },
    () => immutable.map.forEach((value, key, map) => map.set(key, 9)),
    () => Map.prototype.set.call(immutable.map.valueOf(), "new", 1),
  ]) assert.throws(mutate, TypeError, "no read API may leak a mutable map or nested value");
  immutable.map.forEach((value, key, map) => {
    assert.equal(map, immutable.map); assert.equal(value, immutable.original); assert.equal(key, "value");
  });
  original.nested[0] = 40; mutableMap.set("extra", 10);
  assert.deepEqual(immutable.original.nested, [4]); assert.equal(immutable.map.size, 1);

  const primary = { color: "#888888", diameter: 0.24, texture: null };
  const plies = normalizeYarnPlies([primary, { ...primary, color: "#ff0000" }], ["#888888"]);
  const feeds = [{ yarns: [{ yarnId: "A", yarnLengthCmPer100Needles: 23 },
    { yarnId: "B", yarnLengthCmPer100Needles: 8 }] }];
  assert.equal(resolveFeedYarnPlies(feeds, [], plies[0]).get(0)[0], plies[0],
    "legacy no-field resolution keeps the exact primary ply identity");
  const metadataOnlyAsset = [{ id: "A", pbr: { physicalRepeatLengthMm: 12 } }];
  const metadataMaterial = resolveFeedYarnPlies([{ yarns: [{ yarnId: "A" }] }], metadataOnlyAsset, plies[0]).get(0)[0];
  assert.equal(metadataMaterial.assetMaterial, true, "any ASSET source, including metadata-only PBR, suppresses legacy companions/masks");

  const pattern = Bimp.empty(12, 4, 0);
  const options = { pattern, yarnSequence: [0, 1], palette: ["#888888", "#0066ff"], yarnPlies: plies,
    canvasWidth: 640, canvasHeight: 480, machineGauge: 32, feeds, yarnLibrary: [],
    scope: "machine", inputSignature: "fixture-1", projectGeneration: 7, feedYarnStructureRevision: 9 };
  const snapshot = computeYarnSimulation(options);
  assert.equal(snapshot.scope, "machine"); assert.equal(snapshot.inputSignature, "fixture-1");
  assert.equal(snapshot.projectGeneration, 7); assert.equal(snapshot.feedYarnStructureRevision, 9);
  assert.deepEqual(snapshot.referenceViewport, { canvasWidth: 640, canvasHeight: 480 });
  assert.equal(snapshot.contacts.length, (pattern.width + 2) * 2 * (pattern.height + 1));
  assert.ok(snapshot.contacts.every(contact => "st" in contact && "cn" in contact && Array.isArray(contact.mv)));
  assert.equal(snapshot.occurrences.length, snapshot.yarnPathLinks.length + 1);
  assert.equal(new Set(snapshot.occurrences.map(point => point.id)).size, snapshot.occurrences.length);
  assert.ok(new Set(snapshot.occurrences.map(point => point.cnIndex)).size < snapshot.occurrences.length,
    "multiple path occurrences at a final CN must remain distinct");
  snapshot.yarnPathLinks.forEach((link, index) => {
    assert.equal(link.sourceOccurrenceId, snapshot.occurrences[index].id);
    assert.equal(link.targetOccurrenceId, snapshot.occurrences[index + 1].id);
  });
  assert.deepEqual(snapshot.assignments.map(({ feedIndex, yarnIndex, yarnId }) => [feedIndex, yarnIndex, yarnId]),
    [[0, 0, "A"], [0, 1, "B"]]);
  assert.equal(snapshot.yarnStrands.length, 2);
  const solved = snapshot.originalSolverResults.find(result => result.yarnIndex === 0);
  const failed = snapshot.originalSolverResults.find(result => result.yarnIndex === 1);
  assert.equal(solved.converged, true); assert.equal(solved.appliedToSimulation, true);
  assert.equal(failed.status, "UNREACHABLE_TARGET"); assert.equal(failed.appliedToSimulation, false);
  assert.equal(snapshot.previewValidity, "PARTIAL");
  for (const strand of snapshot.yarnStrands) {
    assert.ok(strand.baseModelPathByLink.size > 0); assert.ok(strand.baseDisplayPathByLink.size > 0);
    assert.ok(strand.modelPathByLink.size > 0); assert.ok(strand.resolvedPathByLink.size > 0);
    assert.throws(() => strand.modelPathByLink.set(0, "broken"), TypeError);
  }
  assert.deepEqual([...snapshot.yarnStrands[1].modelPathByLink], [...snapshot.yarnStrands[1].baseModelPathByLink]);
  assert.notDeepEqual([...snapshot.yarnStrands[0].modelPathByLink], [...snapshot.yarnStrands[0].baseModelPathByLink]);
  const published = copySolverResults(snapshot);
  assert.ok(published[0].solvedPathByLink instanceof Map);
  const savedPath = snapshot.originalSolverResults[0].solvedPathByLink.values().next().value;
  published[0].solvedPathByLink.clear(); published[0].lengthInput.inputSignature = "mutated";
  assert.equal(snapshot.originalSolverResults[0].solvedPathByLink.values().next().value, savedPath);
  assert.notEqual(snapshot.originalSolverResults[0].lengthInput.inputSignature, "mutated");
  pattern.pixels[0] = 2; feeds[0].yarns[0].yarnId = "changed"; plies[0].color = "changed";
  assert.equal(snapshot.pattern.pixels[0], 0); assert.equal(snapshot.assignments[0].yarnId, "A");
  assert.equal(snapshot.activeYarnPlies[0].color, "#888888");
  assert.equal(snapshot.feedYarnPlies.get(0)[0], snapshot.activeYarnPlies[0]);

  const applicationOptions = { ...options, pattern: Bimp.empty(4, 2, 0), yarnPlies: [primary],
    feeds: [{ yarns: [{ yarnId: "A", yarnLengthCmPer100Needles: 23 }] }] };
  globalThis.__sharedSnapshotDropApplication = true;
  const unapplied = computeYarnSimulation(applicationOptions);
  assert.equal(unapplied.originalSolverResults[0].converged, true);
  assert.equal(unapplied.originalSolverResults[0].appliedToSimulation, false);
  assert.equal(unapplied.originalSolverResults[0].failureReason, "PATH_NOT_APPLIED",
    "the immutable result is published only after application validity is finalized");
  globalThis.__sharedSnapshotDropApplication = false;
  const appliedAgain = computeYarnSimulation(applicationOptions);
  assert.equal(appliedAgain.originalSolverResults[0].appliedToSimulation, true);
  assert.notEqual(appliedAgain.originalSolverResults[0].failureReason, "PATH_NOT_APPLIED",
    "a cache hit must re-evaluate application and never reuse a stale finalized failure");

  const render = resolveYarnRenderItems({ snapshot });
  assert.equal(render.activeYarnPlies, snapshot.activeYarnPlies);
  assert.equal(render.feedYarnPlies, snapshot.feedYarnPlies);
  assert.deepEqual(render.yarnIds, ["A", "B"]);
  assert.equal(render.items.length, snapshot.yarnPathLinks.length * 2,
    "multiple explicit assignments suppress legacy companion plies");
  assert.deepEqual([...new Set(render.groups.map(group => group.layer))], ["back", "front", "mid"]);
  assert.ok(render.items.every(item => item.plyIndex === 0 && item.normalOffsetModel === 0));
  for (const item of render.items) {
    assert.equal(item.pathData, snapshot.yarnStrands[item.yarnIndex].resolvedPathByLink.get(item.link.index));
    assert.equal(item.modelPathData, snapshot.yarnStrands[item.yarnIndex].modelPathByLink.get(item.link.index));
    assert.equal(item.yarnId, ["A", "B"][item.yarnIndex]);
  }
  const selected = resolveYarnRenderItems({ snapshot, visibleYarnId: "B" });
  assert.ok(selected.items.every(item => item.yarnId === "B"));
  assert.equal(selected.items.length, snapshot.yarnPathLinks.length);
  const recolored = resolveYarnRenderItems({ snapshot, yarnLibrary: [{ id: "A", color: "#abcdef" }] });
  assert.equal(recolored.feedYarnPlies.get(0)[0].color, "#abcdef",
    "resource owners receive exactly the latest resolved materials consumed by the items");
  assert.ok(recolored.items.filter(item => item.yarnId === "A").every(item => item.material.color === "#abcdef"));
  assert.equal(recolored.items[0].pathData, render.items[0].pathData, "appearance updates reuse exact snapshot geometry");

  const legacy = computeYarnSimulation({ ...options, pattern: Bimp.empty(4, 8, 0), yarnPlies: [primary,
    { ...primary, color: "#ff0000" }], feeds: null, machineGauge: 7, scope: "pattern", canvasWidth: 320, canvasHeight: 240 });
  assert.equal(legacy.previewValidity, "DESIGN_PREVIEW"); assert.deepEqual(legacy.originalSolverResults, []);
  assert.ok(Math.abs(legacy.yarnLengthMetrics.totalPathLengthStitchUnits - 94.76508273180484) < 1e-9);
  assert.ok(Math.abs(legacy.yarnLengthMetrics.cmPer100Loops - 107.45683488338587) < 1e-9);
  const legacyItems = resolveYarnRenderItems({ snapshot: legacy });
  assert.equal(legacyItems.items.length, legacy.yarnPathLinks.length * 2);
  assert.ok(legacyItems.items.some(item => item.plyIndex === 1));
  assert.ok(legacyItems.items.some(item => item.material.sequenceMaskColor === "#0066ff"));
  const metadataItems = resolveYarnRenderItems({ snapshot: computeYarnSimulation({ ...options,
    pattern: Bimp.empty(4, 8, 0), yarnPlies: [primary, primary],
    feeds: [{ yarns: [{ yarnId: "A" }] }], yarnLibrary: metadataOnlyAsset }) });
  assert.equal(metadataItems.items.length, legacy.yarnPathLinks.length);
  assert.ok(metadataItems.items.every(item => item.plyIndex === 0 && !item.material.sequenceMaskColor));
  const groups = legacyItems.groups;
  for (const group of groups) assert.ok(group.items.every(item => item.layer === group.layer &&
    item.plyIndex === group.plyIndex && item.yarnIndex === group.yarnIndex));

  assert.throws(() => computeYarnSimulation({ ...options, scope: "unknown" }), /scope/);
  assert.throws(() => computeYarnSimulation({ ...options, canvasWidth: undefined }), /canvasWidth/);
  console.log("PASS: headless shared computation, detached readonly snapshot/maps, canonical occurrences, finalized solver results, shared assignment/material/visibility/mask/layer items, exact legacy metrics.");
} finally {
  await server.close();
  delete globalThis.__sharedSnapshotDropApplication;
}
