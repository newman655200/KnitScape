/** Package shared-pipeline PNGs and metadata identically in Node and the browser. */
export async function createFabricTextureZip(files, metadata, metadataFilename) {
  const { ZipWriter, Uint8ArrayWriter, Uint8ArrayReader, TextReader } = await import("@zip.js/zip.js");
  const writer = new ZipWriter(new Uint8ArrayWriter(), { level: 0, useWebWorkers: false });
  for (const [name, bytes] of Object.entries(files)) await writer.add(name, new Uint8ArrayReader(bytes));
  await writer.add(metadataFilename, new TextReader(JSON.stringify(metadata, null, 2) + "\n"));
  return writer.close();
}
