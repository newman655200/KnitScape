import { bakeFabricTexture, bakeYarnStrip } from "./fabricTexturePipeline.js";

/** Compose cached fabric geometry without solving or rebaking it.
 * message is the flat bakeFabricTexture options object, with result and geometry
 * required. Return only export files, metadata, preview maps and diagnostics;
 * the host retains its original result/geometry cache. Metadata is unchanged.
 */
export async function runFabricComposeJob(message) {
  if (!message?.result || !message.geometry || message.solveInput !== undefined) {
    throw new TypeError("A fabric composition job requires result and geometry, without solveInput.");
  }
  const output = await bakeFabricTexture(message);
  const composed = {}, fuzz = {};
  for (const face of ["technicalFace", "technicalBack"]) {
    composed[face] = { unitMaps: output.composed[face].unitMaps };
    fuzz[face] = { diagnostics: output.fuzz[face].diagnostics };
  }
  return { files: output.files, metadata: output.metadata, composed,
    material: { diagnostics: output.material.diagnostics }, fuzz, timings: output.timings };
}

/** Build a straight-yarn export on demand using flat bakeYarnStrip options.
 * Keep unit maps for preview and the exported RGBA baseColor for the host's
 * existing V-range metadata rule; omit intermediate geometry and fiber fields.
 */
export async function runYarnStripJob(message = {}) {
  const output = await bakeYarnStrip(message);
  return { files: output.files, metadata: output.metadata,
    composed: { unitMaps: output.composed.unitMaps }, maps: { baseColor: output.maps.baseColor },
    material: { diagnostics: output.material.diagnostics },
    fuzz: { diagnostics: output.fuzz.diagnostics }, timings: output.timings };
}
