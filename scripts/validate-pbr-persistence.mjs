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
  console.log("PASS: binary Registry reads lazily, deduplicates requests, retries and releases resources.");
} finally { await server.close(); }
