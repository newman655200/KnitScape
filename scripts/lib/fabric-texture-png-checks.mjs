import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deflateSync, inflateSync } from 'node:zlib';
import { encodePng } from '../../src/fabricTexture/png.js';
import { decodePng } from './fabric-texture-png.mjs';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const FORMATS = [
  { channels: 1, bitDepth: 8, colorType: 0 },
  { channels: 2, bitDepth: 8, colorType: 4 },
  { channels: 3, bitDepth: 8, colorType: 2 },
  { channels: 4, bitDepth: 8, colorType: 6 },
  { channels: 1, bitDepth: 16, colorType: 0 },
];

// Deliberately independent of the encoder's table-based CRC implementation.
function referenceCrc(bytes) {
  let result = 0xffffffff;
  for (const byte of bytes) {
    result ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      result = result & 1 ? (result >>> 1) ^ 0xedb88320 : result >>> 1;
    }
  }
  return (result ^ 0xffffffff) >>> 0;
}

function inspectPng(bytes) {
  const buffer = Buffer.from(bytes);
  assert.deepEqual(buffer.subarray(0, 8), SIGNATURE, 'PNG signature');
  const chunks = [];
  let position = 8;
  while (position < buffer.length) {
    assert.ok(position + 12 <= buffer.length, 'complete PNG chunk header');
    const length = buffer.readUInt32BE(position);
    assert.ok(position + length + 12 <= buffer.length, 'complete PNG chunk body');
    const type = buffer.toString('ascii', position + 4, position + 8);
    const body = buffer.subarray(position + 8, position + 8 + length);
    assert.equal(buffer.readUInt32BE(position + 8 + length),
      referenceCrc(buffer.subarray(position + 4, position + 8 + length)), `${type} CRC`);
    chunks.push({ type, body });
    position += length + 12;
  }
  assert.equal(chunks[0].type, 'IHDR');
  assert.equal(chunks.at(-1).type, 'IEND');
  const header = chunks[0].body;
  return {
    chunks,
    width: header.readUInt32BE(0),
    height: header.readUInt32BE(4),
    bitDepth: header[8],
    colorType: header[9],
    raw: inflateSync(Buffer.concat(chunks.filter(({ type }) => type === 'IDAT').map(({ body }) => body))),
  };
}

function sampleInput(format) {
  const width = 7;
  const height = 5;
  const sampleCount = width * height * format.channels;
  const data = format.bitDepth === 16 ? new Uint16Array(sampleCount) : new Uint8Array(sampleCount);
  const boundaries = [0, 1, 255, 256, 32767, 32768, 65280, 65535];
  for (let index = 0; index < sampleCount; index += 1) {
    data[index] = format.bitDepth === 16 ? boundaries[index % boundaries.length] : (index * index * 37 + index * 17) & 255;
  }
  return { width, height, ...format, data };
}

function bigEndianPixelBytes(input) {
  if (input.bitDepth === 8) return Buffer.from(input.data);
  const bytes = Buffer.alloc(input.data.length * 2);
  for (let index = 0; index < input.data.length; index += 1) bytes.writeUInt16BE(input.data[index], index * 2);
  return bytes;
}

function fixtureChunk(type, body) {
  const bytes = Buffer.alloc(body.length + 12);
  bytes.writeUInt32BE(body.length, 0);
  bytes.write(type, 4, 'ascii');
  body.copy(bytes, 8);
  bytes.writeUInt32BE(referenceCrc(bytes.subarray(4, bytes.length - 4)), bytes.length - 4);
  return bytes;
}

function fixturePng(input, overrides = {}) {
  const { width, height, channels, bitDepth, colorType } = input;
  const pixelBytes = bigEndianPixelBytes(input);
  const bpp = channels * bitDepth / 8;
  const stride = width * bpp;
  const filtered = Buffer.alloc(height * (stride + 1));
  for (let row = 0; row < height; row += 1) {
    const filter = row % 5;
    filtered[row * (stride + 1)] = filter;
    for (let col = 0; col < stride; col += 1) {
      const here = row * stride + col;
      const left = col >= bpp ? pixelBytes[here - bpp] : 0;
      const above = row > 0 ? pixelBytes[here - stride] : 0;
      const corner = row > 0 && col >= bpp ? pixelBytes[here - stride - bpp] : 0;
      let predictor = [0, left, above, Math.floor((left + above) / 2)][filter];
      if (filter === 4) {
        const target = left + above - corner;
        // Stable sorting preserves the PNG tie preference: left, above, then corner.
        predictor = [left, above, corner].sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
      }
      filtered[row * (stride + 1) + 1 + col] = (pixelBytes[here] - predictor) & 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(overrides.width ?? width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = overrides.bitDepth ?? bitDepth;
  header[9] = overrides.colorType ?? colorType;
  header[12] = overrides.interlace ?? 0;
  return Buffer.concat([
    SIGNATURE, fixtureChunk('IHDR', header),
    fixtureChunk('IDAT', deflateSync(overrides.raw ?? filtered)),
    fixtureChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Formal T6a checks (e) and (n); callers decide when to run acceptance. */
export async function validatePngCodec() {
  let check = '(e) PNG encoding';
  try {
    const encoded = [];
    for (const format of FORMATS) {
      const input = sampleInput(format);
      const bytes = await encodePng(input);
      const inspected = inspectPng(bytes);
      assert.deepEqual(inspected.chunks.map(({ type }) => type), ['IHDR', 'IDAT', 'IEND']);
      assert.equal(inspected.width, input.width);
      assert.equal(inspected.height, input.height);
      assert.equal(inspected.bitDepth, input.bitDepth);
      assert.equal(inspected.colorType, input.colorType);
      const pixelBytes = bigEndianPixelBytes(input);
      const stride = input.width * input.channels * input.bitDepth / 8;
      assert.equal(inspected.raw.length, input.height * (stride + 1));
      for (let row = 0; row < input.height; row += 1) {
        assert.equal(inspected.raw[row * (stride + 1)], 0, 'encoder uses filter 0');
        assert.deepEqual(inspected.raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1)),
          pixelBytes.subarray(row * stride, (row + 1) * stride), 'pixel bytes, including 16-bit big endian');
      }
      encoded.push({ input, bytes });
    }

    check = '(n) PNG decoding';
    for (const { input, bytes } of encoded) {
      for (const png of [bytes, fixturePng(input)]) {
        const decoded = decodePng(png);
        assert.equal(decoded.width, input.width);
        assert.equal(decoded.height, input.height);
        assert.equal(decoded.channels, input.channels);
        assert.equal(decoded.bitDepth, input.bitDepth);
        assert.deepEqual(decoded.data, input.data, 'decoded samples equal original values');
      }
    }

    const fixtures = [];
    for (const [name, channels] of [['yarn_basecolor_alpha.png', 4], ['yarn_roughness.png', 1]]) {
      const bytes = await readFile(new URL(`../../public/materials/white-gray-yarn/${name}`, import.meta.url));
      const inspected = inspectPng(bytes);
      const decoded = decodePng(bytes);
      assert.equal(decoded.width, inspected.width, `${name} width matches IHDR`);
      assert.equal(decoded.height, inspected.height, `${name} height matches IHDR`);
      assert.equal(decoded.channels, channels, `${name} channels`);
      assert.equal(decoded.bitDepth, 8);
      assert.equal(decoded.data.length, decoded.width * decoded.height * channels);
      const stride = decoded.width * channels;
      const filters = [...new Set(Array.from({ length: decoded.height }, (_, row) => inspected.raw[row * (stride + 1)]))].sort();
      fixtures.push({ name, width: decoded.width, height: decoded.height, channels, bitDepth: 8, filters });
    }

    const sample = sampleInput(FORMATS[0]);
    const corrupted = fixturePng(sample);
    corrupted[corrupted.length - 1] ^= 1;
    assert.throws(() => decodePng(corrupted), /CRC mismatch/, 'CRC corruption is rejected');
    assert.throws(() => decodePng(fixturePng(sample, { width: 0 })), /dimensions/);
    assert.throws(() => decodePng(fixturePng(sample, { bitDepth: 4 })), /Unsupported PNG format/);
    assert.throws(() => decodePng(fixturePng(sample, { colorType: 3 })), /Unsupported PNG format/);
    assert.throws(() => decodePng(fixturePng(sample, { interlace: 1 })), /interlacing/);
    assert.throws(() => decodePng(fixturePng(sample, { raw: Buffer.alloc(2) })), /data length/);
    assert.throws(() => decodePng(fixturePng(sample, { raw: Buffer.alloc(sample.height * (sample.width + 1), 5) })), /row filter/);

    return {
      e: { formats: FORMATS, crc: 'independent bitwise reference', filter: 0, sixteenBitOrder: 'big endian' },
      n: { formats: FORMATS, filters: [0, 1, 2, 3, 4], fixtures, invalidInputsRejected: 7 },
    };
  } catch (error) {
    error.message = `${check}: ${error.message}`;
    throw error;
  }
}
