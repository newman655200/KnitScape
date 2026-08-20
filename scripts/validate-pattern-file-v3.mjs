import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { createServer } from "vite";

import { Bimp } from "../src/lib/Bimp.js";
import {
  PATTERN_SCHEMA_VERSION,
  deserializePattern,
  serializePattern,
} from "../src/patternFile.js";

const camUnitBitmap = new Bimp(8, 4, Array.from({ length: 32 }, (_, index) => index % 4));
const needleUnitBitmap = new Bimp(4, 8, Array.from({ length: 32 }, (_, index) => (index + 1) % 4));
const sourceState = {
  canvasWidth: 60,
  canvasHeight: 60,
  camUnitBitmap,
  needleUnitBitmap,
  needleInputs: ["1", "11", "2", "12"],
  appliedNeedleInputs: ["2", "12", "1", "11"],
  yarnPalette: ["#abcdef"],
  yarnSequence: new Bimp(1, 60, Array.from({ length: 60 }, (_, index) => index % 2)),
  yarnPlies: [{ name: "main" }],
  camBitmap: new Bimp(1, 1, [3]),
  needleBitmap: new Bimp(1, 1, [2]),
};

assert.equal(PATTERN_SCHEMA_VERSION, 3);

const serialized = serializePattern(sourceState);
assert.deepEqual(Object.keys(serialized).sort(), [
  "appliedNeedleInputs",
  "camUnitBitmap",
  "canvasHeight",
  "canvasWidth",
  "needleInputs",
  "needleUnitBitmap",
  "schemaVersion",
  "yarnPalette",
  "yarnPlies",
  "yarnSequence",
]);
assert.deepEqual(serialized.camUnitBitmap, camUnitBitmap.toJSON());
assert.deepEqual(serialized.needleUnitBitmap, needleUnitBitmap.toJSON());
assert.equal("camBitmap" in serialized, false);
assert.equal("needleBitmap" in serialized, false);
assert.equal("repeats" in serialized, false);
assert.equal("chart" in serialized, false);

const roundTrip = deserializePattern(serialized);
assert.equal(roundTrip.canvasWidth, 60);
assert.equal(roundTrip.canvasHeight, 60);
assert.deepEqual(roundTrip.camUnitBitmap.toJSON(), camUnitBitmap.toJSON());
assert.deepEqual(roundTrip.needleUnitBitmap.toJSON(), needleUnitBitmap.toJSON());
assert.deepEqual(roundTrip.needleInputs, sourceState.needleInputs);
assert.deepEqual(roundTrip.appliedNeedleInputs, sourceState.appliedNeedleInputs);
assert.deepEqual(roundTrip.yarnPalette, sourceState.yarnPalette);
assert.deepEqual(roundTrip.yarnSequence, serialized.yarnSequence);
assert.deepEqual(roundTrip.yarnPlies, sourceState.yarnPlies);
assert.deepEqual([roundTrip.camBitmap.width, roundTrip.camBitmap.height], [60, 60]);
assert.deepEqual([roundTrip.needleBitmap.width, roundTrip.needleBitmap.height], [60, 60]);

const v2CamBitmap = new Bimp(3, 2, [0, 1, 2, 3, 0, 1]);
const v2NeedleBitmap = new Bimp(2, 3, [3, 2, 1, 0, 2, 3]);
const v2 = deserializePattern({
  schemaVersion: 2,
  camBitmap: v2CamBitmap.toJSON(),
  needleBitmap: v2NeedleBitmap.toJSON(),
  needleInputs: ["1", "2", "3", "4"],
  yarnPalette: ["#123456"],
  yarnSequence: new Bimp(1, 2, [0, 1]).toJSON(),
  yarnPlies: [{ name: "legacy" }],
});
assert.equal(v2.canvasWidth, 60);
assert.equal(v2.canvasHeight, 60);
assert.deepEqual(v2.camUnitBitmap.toJSON(), v2CamBitmap.toJSON());
assert.deepEqual(v2.needleUnitBitmap.toJSON(), v2NeedleBitmap.toJSON());
assert.notEqual(v2.camUnitBitmap, v2.needleUnitBitmap);
assert.notEqual(v2.camUnitBitmap.pixels, v2.needleUnitBitmap.pixels);
assert.deepEqual([v2.camBitmap.width, v2.camBitmap.height], [60, 60]);
assert.deepEqual([v2.needleBitmap.width, v2.needleBitmap.height], [60, 60]);

const legacyUnitBitmap = new Bimp(2, 2, [0, 1, 2, 3]);
const legacy = deserializePattern({
  width: 7,
  height: 9,
  repeats: [
    { bitmap: legacyUnitBitmap.toJSON(), pos: [0, 0], area: [7, 9] },
    { bitmap: new Bimp(1, 1, [1]).toJSON(), pos: [0, 0], area: [7, 9] },
  ],
});
assert.equal(legacy.canvasWidth, 7);
assert.equal(legacy.canvasHeight, 9);
assert.deepEqual(legacy.camUnitBitmap.toJSON(), legacyUnitBitmap.toJSON());
assert.deepEqual(legacy.needleUnitBitmap.toJSON(), legacyUnitBitmap.toJSON());
assert.notEqual(legacy.camUnitBitmap, legacy.needleUnitBitmap);
assert.notEqual(legacy.camUnitBitmap.pixels, legacy.needleUnitBitmap.pixels);
assert.deepEqual([legacy.camBitmap.width, legacy.camBitmap.height], [7, 9]);
assert.deepEqual([legacy.needleBitmap.width, legacy.needleBitmap.height], [7, 9]);

assert.throws(
  () =>
    deserializePattern({
      ...serialized,
      camUnitBitmap: { width: 2, height: 2, pixels: [0] },
    }),
  /camUnitBitmap/
);
assert.throws(
  () => deserializePattern({ ...serialized, canvasWidth: 4 }),
  /canvasWidth/
);
assert.throws(
  () => deserializePattern({ ...serialized, canvasHeight: 501 }),
  /canvasHeight/
);
assert.throws(
  () => deserializePattern({ ...serialized, canvasWidth: "60" }),
  /canvasWidth/
);
assert.throws(
  () =>
    deserializePattern({
      ...serialized,
      camUnitBitmap: { ...serialized.camUnitBitmap, width: "8" },
    }),
  /camUnitBitmap\.width/
);
assert.throws(
  () => deserializePattern({ ...serialized, needleInputs: ["1", "2", "3"] }),
  /needleInputs/
);
assert.throws(
  () => deserializePattern({ ...serialized, needleInputs: undefined }),
  /needleInputs/
);
assert.throws(
  () =>
    deserializePattern({
      ...serialized,
      needleInputs: ["1", 2, "3", "4"],
    }),
  /needleInputs/
);
assert.throws(
  () => deserializePattern({ ...serialized, appliedNeedleInputs: undefined }),
  /appliedNeedleInputs/
);

const exampleDirectory = new URL("../examples/", import.meta.url);
for (const filename of (await readdir(exampleDirectory))
  .filter((name) => name.endsWith(".json"))
  .sort()) {
  const example = JSON.parse(
    await readFile(new URL(filename, exampleDirectory), "utf8")
  );
  const migrated = deserializePattern(example);
  assert.equal(migrated.camBitmap.width, example.width);
  assert.equal(migrated.camBitmap.height, example.height);
}

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  globalThis.Path2D = class {};
  globalThis.window = {};
  globalThis.document = {
    querySelector() {
      return null;
    },
  };
  const [importers, state, { Bimp: SsrBimp }] = await Promise.all([
    server.ssrLoadModule("/src/actions/importers.js"),
    server.ssrLoadModule("/src/state.js"),
    server.ssrLoadModule("/src/lib/Bimp.js"),
  ]);
  const sourcePalette = ["#112233", "#445566"];
  const importedV2 = {
    schemaVersion: 2,
    camBitmap: new SsrBimp(3, 2, [0, 1, 2, 3, 0, 1]).toJSON(),
    needleBitmap: new SsrBimp(2, 3, [3, 2, 1, 0, 2, 3]).toJSON(),
    yarnPalette: sourcePalette,
    yarnSequence: new SsrBimp(1, 2, [0, 1]).toJSON(),
  };

  importers.loadJSON(importedV2);
  const loaded = state.GLOBAL_STATE;
  assert.deepEqual([loaded.canvasWidth, loaded.canvasHeight], [60, 60]);
  assert.deepEqual(loaded.camUnitBitmap.toJSON(), importedV2.camBitmap);
  assert.deepEqual(loaded.needleUnitBitmap.toJSON(), importedV2.needleBitmap);
  assert.notEqual(loaded.camUnitBitmap, loaded.needleUnitBitmap);
  assert.notEqual(loaded.camUnitBitmap.pixels, loaded.needleUnitBitmap.pixels);
  assert.notEqual(loaded.camBitmap, loaded.camUnitBitmap);
  assert.notEqual(loaded.needleBitmap, loaded.needleUnitBitmap);
  assert.notEqual(loaded.camBitmap, loaded.needleBitmap);
  assert.notEqual(loaded.camBitmap.pixels, loaded.needleBitmap.pixels);
  assert.deepEqual(
    [loaded.camBitmap.width, loaded.camBitmap.height],
    [loaded.canvasWidth, loaded.canvasHeight]
  );
  assert.deepEqual(
    [loaded.needleBitmap.width, loaded.needleBitmap.height],
    [loaded.canvasWidth, loaded.canvasHeight]
  );
  assert.equal(loaded.yarnSequence.height, loaded.canvasHeight);
  assert.notEqual(loaded.yarnPalette, sourcePalette);
  loaded.yarnPalette.reverse();
  assert.deepEqual(sourcePalette, ["#112233", "#445566"]);

  importers.newPattern();
  const fresh = state.GLOBAL_STATE;
  assert.deepEqual([fresh.canvasWidth, fresh.canvasHeight], [60, 60]);
  assert.deepEqual([fresh.camUnitBitmap.width, fresh.camUnitBitmap.height], [8, 4]);
  assert.deepEqual([fresh.needleUnitBitmap.width, fresh.needleUnitBitmap.height], [8, 4]);
  assert.notEqual(fresh.camUnitBitmap, fresh.needleUnitBitmap);
  assert.notEqual(fresh.camUnitBitmap.pixels, fresh.needleUnitBitmap.pixels);
  assert.notEqual(fresh.camBitmap, fresh.needleBitmap);
  assert.notEqual(fresh.camBitmap.pixels, fresh.needleBitmap.pixels);
  assert.deepEqual([fresh.camBitmap.width, fresh.camBitmap.height], [60, 60]);
  assert.deepEqual([fresh.needleBitmap.width, fresh.needleBitmap.height], [60, 60]);
  assert.equal(fresh.yarnSequence.height, 60);
  assert.deepEqual(fresh.needleInputs, ["1", "2", "3", "4"]);
  assert.deepEqual(fresh.appliedNeedleInputs, ["1", "2", "3", "4"]);
  assert.deepEqual(fresh.needleInputErrors, [null, null, null, null]);
} finally {
  await server.close();
}

console.log("PASS: v3 pattern files and v2/legacy migrations are valid.");
