import fs from "node:fs/promises";
import { createServer } from "vite";
import { decodePng } from "./fabric-texture-png.mjs";

/** Decode material files and delegate legacy V-band detection through Vite SSR.
 * The shared texture layer receives only pixels and the existing detector's result.
 */
export async function loadTextureMaterial({ color = "#C08A5A", normalGreen = "+Y", physicalRepeatLengthMm, files = {}, fuzzBand = "fullScan", fuzzStrength }) {
  const material = { color, normalGreen, physicalRepeatLengthMm, files, fuzzBand, fuzzStrength };
  for (const [key, file] of Object.entries(files)) {
    const decoded = decodePng(await fs.readFile(file));
    if (decoded.bitDepth !== 8) throw new RangeError(`Yarn map ${file}: only 8-bit PNG inputs are supported.`);
    material[key] = decoded;
  }
  if ([2, 4].includes(material.baseColor?.channels)) material.vRange = await findTextureVRange(material.baseColor);
  return material;
}

/** Delegate to the existing detector, including for exported straight-yarn maps. */
export async function findTextureVRange(base) {
  if (![2, 4].includes(base?.channels)) return [0, 1];
    const data = new Uint8Array(base.width * base.height * 4);
    for (let i = 0; i < base.width * base.height; i++) {
      const offset = i * base.channels;
      data.set(base.channels === 4 ? base.data.subarray(offset, offset + 4) :
        [base.data[offset], base.data[offset], base.data[offset], base.data[offset + 1]], i * 4);
    }
    const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
    try {
      const { findYarnTextureVRange } = await server.ssrLoadModule("/src/simulation/yarnUvWebglRenderer.js");
      return findYarnTextureVRange({ width: base.width, height: base.height, data });
    } finally { await server.close(); }
}

export async function addYarnPreviewMetadata(metadata, baseColor) {
  const vRange = await findTextureVRange(baseColor);
  const usesFullImage = vRange[0] === 0 && vRange[1] === 1;
  metadata.preview = { vRange, usesFullImage,
    note: usesFullImage ? "二维预览将使用整张贴图高度" : "二维预览按现有规则使用识别出的纱线带" };
  return metadata;
}
