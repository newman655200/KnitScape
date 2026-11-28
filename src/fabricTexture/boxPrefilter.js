const wrap = (value, period) => ((value % period) + period) % period;
const clampIndex = (value, size) => Math.max(0, Math.min(size - 1, value));

/**
 * Box average on the original texel grid, preserving stored channel units.
 * Offsets are -floor(f/2)..f-1-floor(f/2), with periodic columns and clamped
 * rows. Floating-point detail tables are averaged without normalization.
 * A 1 x 1 window returns the original table, preserving bitwise sampling.
 */
export function boxPrefilter(image, f_U, f_V) {
  if (!image || (f_U === 1 && f_V === 1)) return image;
  if (![f_U, f_V].every(value => Number.isSafeInteger(value) && value >= 1)) {
    throw new RangeError("Box filter windows must be positive safe integers");
  }
  const { width, height, channels } = image;
  let data = image.data;
  if (f_U > 1) {
    const filtered = new Float64Array(data.length), left = Math.floor(f_U / 2);
    const cycles = Math.floor(f_U / width), remainder = f_U % width;
    for (let y = 0; y < height; y++) for (let c = 0; c < channels; c++) {
      const read = x => data[(y * width + wrap(x, width)) * channels + c];
      let sum = 0;
      if (cycles) {
        for (let x = 0; x < width; x++) sum += read(x);
        sum *= cycles;
      }
      for (let i = 0; i < remainder; i++) sum += read(-left + i);
      for (let x = 0; x < width; x++) {
        filtered[(y * width + x) * channels + c] = sum / f_U;
        sum += read(x + f_U - left) - read(x - left);
      }
    }
    data = filtered;
  }
  if (f_V > 1) {
    const filtered = new Float64Array(data.length), above = Math.floor(f_V / 2);
    const bottom = f_V - 1 - above;
    for (let x = 0; x < width; x++) for (let c = 0; c < channels; c++) {
      const read = y => data[(clampIndex(y, height) * width + x) * channels + c];
      // Count repeated boundary rows explicitly, so windows larger than the
      // source image retain the same clamping rule without a long padding loop.
      let sum = above * read(0) + Math.max(0, bottom - height + 1) * read(height - 1);
      for (let y = 0; y <= Math.min(bottom, height - 1); y++) sum += read(y);
      for (let y = 0; y < height; y++) {
        filtered[(y * width + x) * channels + c] = sum / f_V;
        sum += read(y + f_V - above) - read(y - above);
      }
    }
    data = filtered;
  }
  return { ...image, data };
}
