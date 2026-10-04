import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "silent",
  server: { middlewareMode: true } });
try {
  let registryModule;
  try { registryModule = await server.ssrLoadModule("/src/yarnTexture/yarnAssetRegistry.js"); }
  catch { assert.fail("Binary Yarn Asset Registry must exist."); }
  const { YarnAssetRegistry } = registryModule;
  const registry = new YarnAssetRegistry();
  const bytes = new Blob([Uint8Array.from([0, 1, 127, 128, 255])], { type: "image/png" });
  let reads = 0;
  const ref = registry.register(async () => { reads++; return bytes; });
  assert.equal(reads, 0, "registration must not read bytes.");
  assert.equal(registry.has(ref), true);
  const [first, second] = await Promise.all([registry.getBlob(ref), registry.getBlob(ref)]);
  assert.equal(first, bytes);
  assert.equal(second, first);
  assert.equal(reads, 1, "concurrent byte requests share one read.");
  assert.deepEqual(new Uint8Array(await first.arrayBuffer()), Uint8Array.from([0, 1, 127, 128, 255]));
  assert.equal(await registry.getBlob(ref), first);
  const snapshot = registry.fork();
  registry.release(ref);
  assert.equal(registry.has(ref), false);
  await assert.rejects(registry.getBlob(ref), /missing/i);
  assert.equal(await snapshot.getBlob(ref), bytes, "an export snapshot survives replacement.");
  let tries = 0;
  const retry = registry.register(() => { if (++tries === 1) throw new Error("read failed"); return bytes; });
  await assert.rejects(registry.getBlob(retry), /read failed/);
  assert.equal(await registry.getBlob(retry), bytes, "failed lazy reads can be retried.");
  let rejectForkRead;
  let forkTries = 0;
  const forkRetryRef = registry.register(() => {
    if (++forkTries === 1) return new Promise((resolve, reject) => { rejectForkRead = reject; });
    return bytes;
  });
  const parentRead = registry.getBlob(forkRetryRef);
  await Promise.resolve();
  const retrySnapshot = registry.fork();
  rejectForkRead(new Error("fork read failed"));
  await assert.rejects(parentRead, /fork read failed/);
  await assert.rejects(retrySnapshot.getBlob(forkRetryRef), /fork read failed/);
  assert.equal(await retrySnapshot.getBlob(forkRetryRef), bytes, "a failed snapshot read must be retryable.");
  retrySnapshot.clear();
  const bad = registry.register(() => "data:image/png;base64,AA==");
  await assert.rejects(registry.getBlob(bad), /Blob/);
  assert.throws(() => registry.register("data:image/png;base64,AA=="), /Blob/);
  const url = await registry.getObjectUrl(retry);
  assert.equal(await registry.getObjectUrl(retry), url);
  assert.equal((await fetch(url)).status, 200);
  registry.release(retry);
  await assert.rejects(fetch(url), "release must revoke object URLs.");
  let unblock;
  const pending = registry.register(() => new Promise(resolve => { unblock = resolve; }));
  const waitingUrl = registry.getObjectUrl(pending);
  await Promise.resolve(); await Promise.resolve();
  registry.release(pending);
  unblock(bytes);
  await assert.rejects(waitingUrl, /released/i, "release during a read must not leak an object URL.");
  const staged = new YarnAssetRegistry();
  const stagedRef = staged.register(bytes);
  const oldRef = registry.register(bytes);
  registry.replaceWith(staged);
  assert.equal(registry.has(oldRef), false);
  assert.equal(registry.has(stagedRef), true);
  assert.equal(staged.has(stagedRef), false, "project installation transfers ownership.");
  assert.equal(await registry.getBlob(stagedRef), bytes);
  registry.clear(); snapshot.clear();
  assert.equal(registry.has(stagedRef), false);
  let packageModule;
  try { packageModule = await server.ssrLoadModule("/src/actions/projectPackage.js"); }
  catch { assert.fail("Portable .knitscape project package codec must exist."); }
  const { createProjectPackage, readProjectPackage, migrateYarnLibraryAssets } = packageModule;
  const { ZipReader, ZipWriter, BlobReader, BlobWriter, TextReader, TextWriter } = await import("@zip.js/zip.js");
  const slots = ["baseColor", "normal", "roughness", "height", "ambientOcclusion"];
  const assetRegistry = new YarnAssetRegistry();
  const mapBytes = new Blob([new Uint8Array(128 * 1024).fill(117)], { type: "image/png" });
  const makeAsset = (id, count) => ({
    id, name: String(id), category: "T",
    createdAt: "2026-10-04T00:00:00.000Z", updatedAt: "2026-10-04T00:00:00.000Z",
    ...(count ? { pbr: Object.fromEntries(slots.slice(0, count).map(slot =>
      [slot, { assetRef: assetRegistry.register(mapBytes), fileName: slot + ".png",
        mimeType: "image/png", byteLength: mapBytes.size }])) } : {}),
  });
  const project = { width: 2, height: 2, repeats: [], yarnLibrary: [
    makeAsset("full/../纱线", 5), makeAsset("partial", 2), makeAsset("absent", 0)],
    yarnPalette: ["red"], yarnSequence: { width: 1, height: 2, pixels: [0, 0] }, yarnPlies: [],
    singleJerseyCamProgram: null, needleArrangement: [], needleArrangementInputs: ["", "", "", ""], machineGauge: 28 };
  const packed = await createProjectPackage(project, assetRegistry);
  assert.ok(packed instanceof Blob);
  const zip = new ZipReader(new BlobReader(packed), { useWebWorkers: false });
  const entries = await zip.getEntries();
  const manifestEntry = entries.find(entry => entry.filename === "project.json");
  const manifestText = await manifestEntry.getData(new TextWriter());
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.format, "knitscape");
  assert.equal(manifest.version, 2);
  assert.equal(entries.filter(entry => !entry.directory).length, 8);
  assert.doesNotMatch(manifestText, /dataUrl|processedDataUrl|blob:/);
  for (const slot of slots) {
    const map = manifest.yarnLibrary[0].pbr[slot];
    assert.equal(map.assetRef, "assets/yarn/full%2F%2E%2E%2F%E7%BA%B1%E7%BA%BF/" + slot);
    assert.ok(entries.some(entry => entry.filename === map.assetRef));
  }
  const ranges = [];
  class TrackedBlob extends Blob {
    async arrayBuffer() { assert.fail("Opening a project must not buffer the entire package."); }
    slice(start, end, type) {
      const part = super.slice(start, end, type);
      const read = part.arrayBuffer.bind(part);
      const stream = part.stream.bind(part);
      part.stream = () => { ranges.push([start, end, part.size]); return stream(); };
      part.arrayBuffer = async () => { ranges.push([start, end, part.size]); return read(); };
      return part;
    }
  }
  const tracked = new TrackedBlob([packed], { type: packed.type });
  const opened = await readProjectPackage(tracked);
  const openingBytes = ranges.reduce((total, range) => total + range[2], 0);
  assert.ok(openingBytes < packed.size / 4, "opening reads only directory and manifest, not image payloads.");
  assert.equal(opened.project.yarnLibrary[2].pbr, undefined);
  assert.equal(opened.project.yarnLibrary[1].pbr.height, null);
  const openedMap = opened.project.yarnLibrary[0].pbr.normal;
  const beforeRead = ranges.length;
  const resolved = await opened.registry.getBlob(openedMap.assetRef);
  assert.ok(ranges.length > beforeRead, "explicit map access reads its binary entry.");
  assert.deepEqual(new Uint8Array(await resolved.arrayBuffer()), new Uint8Array(await mapBytes.arrayBuffer()));
  const afterRead = ranges.length;
  assert.equal(await opened.registry.getBlob(openedMap.assetRef), resolved);
  assert.equal(ranges.length, afterRead);
  const repacked = await createProjectPackage(opened.project, opened.registry);
  const reopened = await readProjectPackage(repacked);
  assert.equal(reopened.project.yarnLibrary[0].pbr.normal.byteLength, mapBytes.size);
  const legacyOriginal = "data:image/png;base64,AAECAw==";
  const legacyProcessed = "data:image/png;base64,BAUGBw==";
  const migratedRegistry = new YarnAssetRegistry();
  const legacy = [{ ...makeAsset("legacy", 0), pbr: {
    baseColor: { fileName: "BaseColor.png", dataUrl: legacyOriginal, processedDataUrl: legacyProcessed },
    normal: { fileName: "Normal.png", dataUrl: legacyOriginal, processedDataUrl: legacyOriginal },
    previewDataUrl: legacyOriginal,
  } }];
  const migrated = migrateYarnLibraryAssets(legacy, migratedRegistry);
  assert.doesNotMatch(JSON.stringify(migrated), /processedDataUrl|"dataUrl"/);
  const migratedMap = migrated[0].pbr.baseColor;
  assert.deepEqual(new Uint8Array(await (await migratedRegistry.getBlob(migratedMap.assetRef)).arrayBuffer()), Uint8Array.from([4, 5, 6, 7]));
  assert.deepEqual(new Uint8Array(await (await migratedRegistry.getBlob(migratedMap.original.assetRef)).arrayBuffer()), Uint8Array.from([0, 1, 2, 3]));
  assert.equal(migrated[0].pbr.normal.original, undefined, "identical original/processed maps are stored once.");
  assert.equal(migrated[0].pbr.previewDataUrl, legacyOriginal);
  const migratedPackage = await createProjectPackage({ ...project, yarnLibrary: migrated }, migratedRegistry);
  const migratedOpen = await readProjectPackage(migratedPackage);
  assert.ok(migratedOpen.project.yarnLibrary[0].pbr.baseColor.original);
  const makeArchive = async (data, skip = "") => {
    const writer = new ZipWriter(new BlobWriter("application/zip"), { level: 0, useWebWorkers: false });
    await writer.add("project.json", new TextReader(JSON.stringify(data)));
    for (const entry of entries) if (entry.filename !== "project.json" && entry.filename !== skip) {
      await writer.add(entry.filename, new BlobReader(await entry.getData(new BlobWriter("image/png"))));
    }
    return writer.close();
  };
  const broken = structuredClone(manifest);
  broken.yarnLibrary[0].pbr.normal.assetRef = "../normal";
  await assert.rejects(readProjectPackage(await makeArchive(broken)), /reference/i);
  const missing = manifest.yarnLibrary[0].pbr.normal.assetRef;
  await assert.rejects(readProjectPackage(await makeArchive(manifest, missing)), /missing/i);
  await assert.rejects(readProjectPackage(await makeArchive({ ...manifest, version: 99 })), /version/i);
  const incomplete = { ...manifest }; delete incomplete.yarnLibrary;
  await assert.rejects(readProjectPackage(await makeArchive(incomplete)), /yarnLibrary/i);
  const wrongSize = structuredClone(manifest); wrongSize.yarnLibrary[0].pbr.normal.byteLength++;
  await assert.rejects(readProjectPackage(await makeArchive(wrongSize)), /size/i);
  const tinyRegistry = new YarnAssetRegistry();
  const tinyRef = tinyRegistry.register(new Blob(["x"], { type: "image/png" }));
  const excessiveLibrary = Array.from({ length: 4000 }, (_, index) => ({
    ...makeAsset("capacity-" + index, 0),
    pbr: Object.fromEntries(slots.map(slot => [slot, {
      assetRef: tinyRef, fileName: slot + ".png", mimeType: "image/png", byteLength: 1,
    }])),
  }));
  await assert.rejects(createProjectPackage({ ...project, yarnLibrary: excessiveLibrary }, tinyRegistry),
    /too many/i, "export must reject packages that its reader cannot open.");
  tinyRegistry.clear();
  const missingRegistry = new YarnAssetRegistry();
  await assert.rejects(createProjectPackage(project, missingRegistry), /missing/i);
  const corruptBytes = new Uint8Array(await packed.arrayBuffer());
  const normalEntry = entries.find(entry => entry.filename === missing);
  const offset = Number(normalEntry.offset);
  const corruptView = new DataView(corruptBytes.buffer);
  const payload = offset + 30 + corruptView.getUint16(offset + 26, true) + corruptView.getUint16(offset + 28, true);
  corruptBytes[payload + 100] ^= 255;
  const corruptOpen = await readProjectPackage(new Blob([corruptBytes]));
  await assert.rejects(corruptOpen.registry.getBlob(corruptOpen.project.yarnLibrary[0].pbr.normal.assetRef),
    /signature|CRC/i, "corrupt image binary is checked on demand.");
  corruptOpen.registry.clear();
  await zip.close(); opened.registry.clear(); reopened.registry.clear(); migratedRegistry.clear();
  migratedOpen.registry.clear(); assetRegistry.clear();
  if (process.argv.includes("--stress")) {
    const { deflateSync } = await import("node:zlib");
    const { createHash } = await import("node:crypto");
    const crcTable = Array.from({ length: 256 }, (_, index) => {
      let value = index;
      for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      return value >>> 0;
    });
    const crc = data => {
      let value = 0xffffffff;
      for (const byte of data) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
      return (value ^ 0xffffffff) >>> 0;
    };
    const chunk = (name, data) => {
      const type = Buffer.from(name);
      const output = Buffer.alloc(data.length + 12);
      output.writeUInt32BE(data.length); type.copy(output, 4); data.copy(output, 8);
      output.writeUInt32BE(crc(Buffer.concat([type, data])), output.length - 4);
      return output;
    };
    const raw = Buffer.alloc(1025 * 1024);
    let seed = 123456789;
    for (let y = 0; y < 1024; y++) for (let x = 1; x <= 1024; x++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      raw[y * 1025 + x] = seed & 255;
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(1024, 0); header.writeUInt32BE(1024, 4); header[8] = 8;
    const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 1 })), chunk("IEND", Buffer.alloc(0))]);
    const pngBlob = new Blob([png], { type: "image/png" });
    const stressRegistry = new YarnAssetRegistry();
    const stressLibrary = Array.from({ length: 100 }, (_, index) => ({
      ...makeAsset("stress-" + index, 0),
      pbr: Object.fromEntries(slots.map(slot => [slot, { fileName: slot + ".png",
        assetRef: stressRegistry.register(pngBlob), mimeType: "image/png", byteLength: pngBlob.size }])),
    }));
    const start = performance.now();
    const stressPackage = await createProjectPackage({ ...project, yarnLibrary: stressLibrary }, stressRegistry);
    ranges.length = 0;
    const stressOpened = await readProjectPackage(new TrackedBlob([stressPackage]));
    const metadataBytes = ranges.reduce((total, range) => total + range[2], 0);
    assert.equal(stressOpened.project.yarnLibrary.length, 100);
    assert.ok(metadataBytes < 1024 * 1024, "500 binary maps are not read when opening a project.");
    assert.ok(stressPackage.size < pngBlob.size * 500 * 1.01, "package has binary bytes without Base64 amplification.");
    const expectedHash = createHash("sha256").update(png).digest("hex");
    for (const index of [0, 99]) {
      const map = stressOpened.project.yarnLibrary[index].pbr.ambientOcclusion;
      const restored = await stressOpened.registry.getBlob(map.assetRef);
      assert.equal(createHash("sha256").update(new Uint8Array(await restored.arrayBuffer())).digest("hex"), expectedHash);
    }
    console.log(JSON.stringify({ stress: "100 Yarn x 5 real 1024x1024 PNG",
      mapBytes: pngBlob.size, packageBytes: stressPackage.size, openingBytes: metadataBytes,
      elapsedSeconds: Number(((performance.now() - start) / 1000).toFixed(3)), sha256: expectedHash }));
    stressRegistry.clear(); stressOpened.registry.clear();
  }
  console.log("PASS: .knitscape metadata/binary round-trip, range-based lazy reads, legacy migration and invalid-package checks.");
  console.log("PASS: binary Registry reads lazily, deduplicates requests, retries and releases resources.");
} finally { await server.close(); }
