const PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const COLOR_TYPES = { 1: 0, 2: 4, 3: 2, 4: 6 };
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return crc >>> 0;
});

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}

function joinBytes(parts) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function chunk(type, data) {
  const result = new Uint8Array(data.length + 12);
  const view = new DataView(result.buffer);
  view.setUint32(0, data.length, false);
  for (let index = 0; index < 4; index += 1) result[index + 4] = type.charCodeAt(index);
  result.set(data, 8);
  view.setUint32(data.length + 8, crc32(result.subarray(4, data.length + 8)), false);
  return result;
}

async function deflate(bytes) {
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const reader = source.pipeThrough(new CompressionStream('deflate')).getReader();
  const parts = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return joinBytes(parts);
}

/** Encode non-interlaced PNG; 16-bit grayscale input contains numeric Uint16 values. */
export async function encodePng({ width, height, channels, bitDepth = 8, data }) {
  if (![width, height].every((value) => Number.isInteger(value) && value > 0 && value <= 0x7fffffff)) {
    throw new RangeError('PNG width and height must be positive 31-bit integers.');
  }
  if (![1, 2, 3, 4].includes(channels)) {
    throw new RangeError('PNG channels must be 1 (gray), 2 (gray-alpha), 3 (RGB), or 4 (RGBA).');
  }
  if (bitDepth !== 8 && !(bitDepth === 16 && channels === 1)) {
    throw new RangeError('PNG supports 8-bit gray/gray-alpha/RGB/RGBA or 16-bit grayscale.');
  }
  const correctType = bitDepth === 16
    ? data instanceof Uint16Array
    : data instanceof Uint8Array || data instanceof Uint8ClampedArray;
  if (!correctType) throw new TypeError(`PNG ${bitDepth}-bit data must use the corresponding unsigned typed array.`);
  const sampleCount = width * height * channels;
  const rowBytes = width * channels * (bitDepth / 8);
  const rawLength = height * (rowBytes + 1);
  if (!Number.isSafeInteger(rawLength) || data.length !== sampleCount) {
    throw new RangeError('PNG pixel data length does not match its dimensions and channels.');
  }

  // Each scanline starts with filter 0. Write 16-bit samples explicitly in network byte order.
  const raw = new Uint8Array(rawLength);
  for (let y = 0; y < height; y += 1) {
    const destination = y * (rowBytes + 1) + 1;
    if (bitDepth === 8) {
      raw.set(data.subarray(y * rowBytes, (y + 1) * rowBytes), destination);
    } else {
      for (let x = 0; x < width; x += 1) {
        const value = data[y * width + x];
        raw[destination + x * 2] = value >>> 8;
        raw[destination + x * 2 + 1] = value & 255;
      }
    }
  }

  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width, false);
  headerView.setUint32(4, height, false);
  header[8] = bitDepth;
  header[9] = COLOR_TYPES[channels];
  return joinBytes([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', await deflate(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}
