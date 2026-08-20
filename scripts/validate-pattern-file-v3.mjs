import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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

for (const filename of ["hat mosaic.json", "sunset dots.json", "pseudoweave.json"]) {
  const example = JSON.parse(
    await readFile(new URL(`../examples/${filename}`, import.meta.url), "utf8")
  );
  const migrated = deserializePattern(example);
  assert.equal(migrated.camBitmap.width, example.width);
  assert.equal(migrated.camBitmap.height, example.height);
}

console.log("PASS: v3 pattern files and v2/legacy migrations are valid.");
