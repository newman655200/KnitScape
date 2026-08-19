import assert from "node:assert/strict";

import { Bimp } from "../src/lib/Bimp.js";
import {
  buildNeedleBitmap,
  cloneBitmap,
  concatNeedleInputs,
  validateNeedleInputs,
} from "../src/needleArrangement/transform.js";

assert.equal(
  concatNeedleInputs(["1", "11", "123", "1234"]),
  "1111231234"
);

assert.deepEqual(validateNeedleInputs(["1", "5", "", "2a"], 4), {
  valid: false,
  sequence: "15" + "" + "2a",
  errors: [null, "row", "empty", "characters"],
});

assert.deepEqual(validateNeedleInputs(["1", "11", "123", "1234"], 4), {
  valid: true,
  sequence: "1111231234",
  errors: [null, null, null, null],
});

const cam = new Bimp(8, 4, [
  0, 0, 0, 0, 0, 0, 2, 2,
  0, 0, 0, 0, 2, 2, 0, 0,
  0, 0, 2, 2, 0, 0, 0, 0,
  2, 2, 0, 0, 0, 0, 0, 0,
]);

const needle = buildNeedleBitmap(cam, "1234");
assert.equal(needle.width, 4);
assert.equal(needle.height, 8);
assert.deepEqual(needle.make2d(), [
  [0, 0, 0, 2],
  [0, 0, 0, 2],
  [0, 0, 2, 0],
  [0, 0, 2, 0],
  [0, 2, 0, 0],
  [0, 2, 0, 0],
  [2, 0, 0, 0],
  [2, 0, 0, 0],
]);

assert.deepEqual(buildNeedleBitmap(cam, "11").make2d()[0], [0, 0]);
assert.throws(() => buildNeedleBitmap(cam, ""), /non-empty/);
assert.throws(() => buildNeedleBitmap(cam, "5"), /row 5/);

const clone = cloneBitmap(cam);
assert.deepEqual(clone.toJSON(), cam.toJSON());
assert.notEqual(clone, cam);
assert.notEqual(clone.pixels, cam.pixels);

console.log("PASS: needle arrangement transforms are valid.");
