/** Inspect source format transparency before a browser expands all pixels to RGBA.
 * No decoding, image allocation or host APIs; null means an unknown source format.
 */
export function sourceImageHasAlpha(bytes) {
  const tag = offset => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (bytes.length >= 26 && bytes[0] === 137 && tag(1) === "PNG\r") {
    if (bytes[25] === 4 || bytes[25] === 6) return true;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const size = view.getUint32(offset);
      if (size > bytes.length - offset - 12) break;
      if (tag(offset + 4) === "tRNS") return true;
      offset += size + 12;
    }
    return false;
  }
  if (bytes[0] === 255 && bytes[1] === 216) return false;
  if (bytes.length >= 20 && tag(0) === "RIFF" && tag(8) === "WEBP") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const size = view.getUint32(offset + 4, true), kind = tag(offset), start = offset + 8;
      if (size > bytes.length - start) break;
      if (kind === "VP8X" && size >= 1) return Boolean(bytes[start] & 16);
      if (kind === "ALPH") return true;
      if (kind === "VP8L" && size >= 5) return Boolean(bytes[start + 4] & 16);
      offset = start + size + (size & 1);
    }
    return false;
  }
  return null;
}
