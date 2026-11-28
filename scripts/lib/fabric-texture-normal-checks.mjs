import assert from "node:assert/strict";
import { decodePng } from "./fabric-texture-png.mjs";

/** Fixed T6a (g): inspect every output pixel, including uncovered pixels. */
export function assertNormalMap(map, label) {
  const { width, height, channels, bitDepth, data } = map;
  assert.ok(Number.isSafeInteger(width) && width > 0 && Number.isSafeInteger(height) && height > 0,
    `${label}: normal map dimensions`);
  assert.equal(bitDepth, 8, `${label}: normal map bit depth`);
  assert.ok(channels === 3 || channels === 4, `${label}: normal map requires RGB or RGBA`);
  assert.ok(data instanceof Uint8Array || data instanceof Uint8ClampedArray, `${label}: normal map pixels must be bytes`);
  assert.equal(data.length, width * height * channels, `${label}: normal map pixel count`);
  let minZ = Infinity, maxLengthError = 0;
  const pixels = width * height;
  for (let i = 0; i < pixels; i++) {
    const offset = i * channels;
    const x = 2 * data[offset] / 255 - 1;
    const y = 2 * data[offset + 1] / 255 - 1;
    const z = 2 * data[offset + 2] / 255 - 1;
    const lengthError = Math.abs(Math.hypot(x, y, z) - 1);
    assert.ok(lengthError <= 2 / 255, `${label}: pixel=${i}, length error=${lengthError}, limit=${2 / 255}`);
    assert.ok(z >= 0, `${label}: pixel=${i}, z=${z}`);
    minZ = Math.min(minZ, z);
    maxLengthError = Math.max(maxLengthError, lengthError);
  }
  return { minZ, maxLengthError, pixels };
}

export function assertNormalPng(bytes, label) {
  return assertNormalMap(decodePng(bytes), label);
}
