import assert from "node:assert/strict";

import { Bimp } from "../src/lib/Bimp.js";
import {
  PATTERN_SCHEMA_VERSION,
  deserializePattern,
  serializePattern,
} from "../src/patternFile.js";

const legacyPattern = {
  width: 4,
  height: 4,
  repeats: [
    {
      bitmap: new Bimp(2, 2, [0, 1, 2, 3]).toJSON(),
      pos: [0, 0],
      area: [4, 4],
    },
  ],
  yarnPalette: ["#111111"],
  yarnSequence: new Bimp(1, 4, [0, 0, 0, 0]).toJSON(),
  yarnPlies: [],
};

const migrated = deserializePattern(legacyPattern);
assert.equal(migrated.schemaVersion, PATTERN_SCHEMA_VERSION);
assert.deepEqual(migrated.camBitmap.make2d(), [
  [2, 3, 2, 3],
  [0, 1, 0, 1],
  [2, 3, 2, 3],
  [0, 1, 0, 1],
]);
assert.deepEqual(migrated.needleBitmap.make2d(), migrated.camBitmap.make2d());
assert.notEqual(migrated.camBitmap, migrated.needleBitmap);
assert.notEqual(migrated.camBitmap.pixels, migrated.needleBitmap.pixels);
assert.deepEqual(migrated.needleInputs, ["1", "2", "3", "4"]);
assert.deepEqual(migrated.appliedNeedleInputs, ["1", "2", "3", "4"]);

const sourceState = {
  camBitmap: new Bimp(3, 2, [0, 1, 2, 3, 0, 1]),
  needleBitmap: new Bimp(2, 3, [3, 2, 1, 0, 2, 3]),
  needleInputs: ["1", "11", "2", "12"],
  appliedNeedleInputs: ["1", "2", "1", "2"],
  yarnPalette: ["#abcdef"],
  yarnSequence: new Bimp(1, 3, [0, 0, 0]),
  yarnPlies: [{ name: "main" }],
};

const serialized = serializePattern(sourceState);
assert.equal(serialized.schemaVersion, PATTERN_SCHEMA_VERSION);
assert.equal("repeats" in serialized, false);
assert.equal("chart" in serialized, false);

const roundTrip = deserializePattern(serialized);
assert.deepEqual(roundTrip.camBitmap.toJSON(), sourceState.camBitmap.toJSON());
assert.deepEqual(
  roundTrip.needleBitmap.toJSON(),
  sourceState.needleBitmap.toJSON()
);
assert.deepEqual(roundTrip.needleInputs, sourceState.needleInputs);
assert.deepEqual(roundTrip.appliedNeedleInputs, sourceState.appliedNeedleInputs);

assert.throws(
  () =>
    deserializePattern({
      schemaVersion: PATTERN_SCHEMA_VERSION,
      camBitmap: { width: 2, height: 2, pixels: [0] },
      needleBitmap: sourceState.needleBitmap.toJSON(),
      needleInputs: ["1", "2", "3", "4"],
    }),
  /camBitmap/
);

console.log("PASS: v2 pattern files and legacy migration are valid.");
