import { inflateSync } from 'node:zlib';
import { crc32 } from '../../src/fabricTexture/png.js';

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

function paeth(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const dl = Math.abs(prediction - left);
  const da = Math.abs(prediction - above);
  const du = Math.abs(prediction - upperLeft);
  return dl <= da && dl <= du ? left : da <= du ? above : upperLeft;
}

/** Decode the PNG formats used by the texture pipeline, preserving channels and bit depth. */
export function decodePng(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('PNG input must be a Uint8Array.');
  if (bytes.length < 8 || !PNG_SIGNATURE.every((value, index) => bytes[index] === value)) {
    throw new Error('Invalid PNG signature.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let header;
  let ended = false;
  let idatEnded = false;
  let paletteSeen = false;
  const compressed = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error('Truncated PNG chunk.');
    const length = view.getUint32(offset, false);
    const end = offset + 12 + length;
    if (length > 0x7fffffff || end > bytes.length) throw new Error('Invalid PNG chunk length.');
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type)) throw new Error('Invalid PNG chunk type.');
    const body = bytes.subarray(offset + 8, end - 4);
    const expectedCrc = view.getUint32(end - 4, false);
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== expectedCrc) {
      throw new Error(`PNG ${type} CRC mismatch.`);
    }
    if (!header && type !== 'IHDR') throw new Error('PNG IHDR must be the first chunk.');
    if (compressed.length && type !== 'IDAT') idatEnded = true;

    if (type === 'IHDR') {
      if (header || length !== 13) throw new Error('Invalid or duplicate PNG IHDR.');
      const width = view.getUint32(offset + 8, false);
      const height = view.getUint32(offset + 12, false);
      const bitDepth = body[8];
      const colorType = body[9];
      const channels = CHANNELS[colorType];
      if (width === 0 || height === 0 || width > 0x7fffffff || height > 0x7fffffff) {
        throw new Error('Invalid PNG dimensions.');
      }
      if (!channels || !(bitDepth === 8 || bitDepth === 16 && colorType === 0)) {
        throw new Error(`Unsupported PNG format: color type ${colorType}, bit depth ${bitDepth}.`);
      }
      if (body[10] !== 0 || body[11] !== 0 || body[12] !== 0) {
        throw new Error('Unsupported PNG compression, filter method, or interlacing.');
      }
      header = { width, height, channels, bitDepth, colorType };
    } else if (type === 'IDAT') {
      if (idatEnded) throw new Error('PNG IDAT chunks must be consecutive.');
      compressed.push(body);
    } else if (type === 'IEND') {
      if (length !== 0 || !compressed.length || end !== bytes.length) throw new Error('Invalid PNG IEND or trailing data.');
      ended = true;
    } else if (type === 'PLTE') {
      if (paletteSeen || compressed.length || header.colorType === 0 || header.colorType === 4
        || length === 0 || length > 768 || length % 3 !== 0) throw new Error('Invalid PNG PLTE.');
      paletteSeen = true;
    } else if (type === 'tRNS') {
      throw new Error('PNG tRNS transparency is unsupported; use gray-alpha or RGBA.');
    } else if (type[0] === type[0].toUpperCase()) {
      throw new Error(`Unsupported PNG critical chunk: ${type}.`);
    }
    offset = end;
  }
  if (!header || !ended) throw new Error('PNG is missing IHDR, IDAT, or IEND.');

  const { width, height, channels, bitDepth } = header;
  const bytesPerPixel = channels * bitDepth / 8;
  const rowBytes = width * bytesPerPixel;
  const rawLength = height * (rowBytes + 1);
  if (!Number.isSafeInteger(rawLength) || rawLength > 0x7fffffff) throw new Error('PNG dimensions exceed decoder capacity.');
  const raw = inflateSync(Buffer.concat(compressed), { maxOutputLength: rawLength });
  if (raw.length !== rawLength) throw new Error('PNG decompressed data length does not match IHDR.');
  const pixels = new Uint8Array(height * rowBytes);
  for (let y = 0; y < height; y += 1) {
    const scanStart = y * (rowBytes + 1);
    const filter = raw[scanStart];
    if (filter > 4) throw new Error(`Unsupported PNG row filter: ${filter}.`);
    for (let x = 0; x < rowBytes; x += 1) {
      const pixelOffset = y * rowBytes + x;
      const left = x >= bytesPerPixel ? pixels[pixelOffset - bytesPerPixel] : 0;
      const above = y > 0 ? pixels[pixelOffset - rowBytes] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel ? pixels[pixelOffset - rowBytes - bytesPerPixel] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? above
            : filter === 3 ? Math.floor((left + above) / 2)
              : paeth(left, above, upperLeft);
      pixels[pixelOffset] = (raw[scanStart + 1 + x] + predictor) & 255;
    }
  }
  let data = pixels;
  if (bitDepth === 16) {
    data = new Uint16Array(width * height);
    for (let index = 0; index < data.length; index += 1) data[index] = pixels[index * 2] * 256 + pixels[index * 2 + 1];
  }
  return { width, height, channels, bitDepth, data };
}
