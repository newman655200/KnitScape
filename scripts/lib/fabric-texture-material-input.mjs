import fs from "node:fs/promises";
import { createServer } from "vite";
import { decodePng } from "./fabric-texture-png.mjs";

/** Decode material files and delegate legacy V-band detection through Vite SSR.
 * The shared texture layer receives only pixels and the existing detector's result.
 */
export async function loadTextureMaterial({ color = "#C08A5A", normalGreen = "+Y", physicalRepeatLengthMm, files = {} }) {
  const material = { color, normalGreen, physicalRepeatLengthMm, files };
  for (const [key, file] of Object.entries(files)) {
    const decoded = decodePng(await fs.readFile(file));
    if (decoded.bitDepth !== 8) throw new RangeError(`Yarn map ${file}: only 8-bit PNG inputs are supported.`);
    material[key] = decoded;
  }
  if ([2, 4].includes(material.baseColor?.channels)) {
    const base = material.baseColor, data = new Uint8Array(base.width * base.height * 4);
    for (let i = 0; i < base.width * base.height; i++) {
      const offset = i * base.channels;
      data.set(base.channels === 4 ? base.data.subarray(offset, offset + 4) :
        [base.data[offset], base.data[offset], base.data[offset], base.data[offset + 1]], i * 4);
    }
    const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
    try {
      const { findYarnTextureVRange } = await server.ssrLoadModule("/src/simulation/yarnUvWebglRenderer.js");
      material.vRange = findYarnTextureVRange({ width: base.width, height: base.height, data });
    } finally { await server.close(); }
  }
  return material;
}
