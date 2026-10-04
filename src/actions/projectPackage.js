import { normalizeYarnLibrary } from "../domain/yarnLibrary.js";
import { YARN_PBR_MAP_KEYS } from "../yarnTexture/yarnScanTexture.js";
import { YarnAssetRegistry, yarnAssetRegistry } from "../yarnTexture/yarnAssetRegistry.js";

const MAX_PROJECT_ENTRIES = 20000;
const MAX_PROJECT_BYTES = 2 * 1024 ** 3;
const MAX_MAP_BYTES = 256 * 1024 ** 2;
const MAX_MANIFEST_BYTES = 16 * 1024 ** 2;
const PROJECT_FIELDS = ["width", "height", "repeats", "yarnPalette", "yarnSequence",
  "yarnPlies", "yarnLibrary", "singleJerseyCamProgram", "needleArrangement",
  "needleArrangementInputs", "machineGauge"];

function assetPath(id, slot) {
  const segment = encodeURIComponent(String(id)).replace(/\./g, "%2E");
  return `assets/yarn/${segment}/${slot}`;
}

function mapAssets(library, transform) {
  return normalizeYarnLibrary(library).map(asset => {
    if (!asset.pbr) return asset;
    const pbr = { ...asset.pbr };
    for (const slot of YARN_PBR_MAP_KEYS) {
      if (!pbr[slot]) continue;
      const { original, ...map } = pbr[slot];
      pbr[slot] = { ...transform(map, asset.id, slot),
        ...(original ? { original: transform(original, asset.id, slot + ".original") } : {}) };
    }
    return { ...asset, pbr };
  });
}

function embeddedImageBlob(dataUrl) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/i.exec(dataUrl);
  if (!match) throw new TypeError("Invalid legacy PBR image.");
  const binary = atob(match[2].replace(/\s/g, ""));
  const blob = new Blob([Uint8Array.from(binary, character => character.charCodeAt(0))],
    { type: match[1].toLowerCase() });
  if (!blob.size || blob.size > MAX_MAP_BYTES) throw new RangeError("Invalid PBR image size.");
  return blob;
}

function registerBlob(blob, registry) {
  return { assetRef: registry.register(blob), mimeType: blob.type, byteLength: blob.size };
}

export function migrateYarnLibraryAssets(library, registry) {
  return mapAssets(library, map => {
    if (map.assetRef) {
      if (!registry.has(map.assetRef)) throw new Error("Yarn PBR asset is missing.");
      return map;
    }
    const effective = map.processedDataUrl || map.dataUrl;
    return { fileName: map.fileName, ...registerBlob(embeddedImageBlob(effective), registry),
      // V1 duplicates collapse to one map. Preserve distinct legacy originals.
      ...(map.dataUrl !== effective
        ? { original: registerBlob(embeddedImageBlob(map.dataUrl), registry) } : {}) };
  });
}

function validateProjectFields(project) {
  for (const key of PROJECT_FIELDS) {
    if (!Object.hasOwn(project, key)) throw new TypeError(`Project is missing ${key}.`);
  }
}

export async function createProjectPackage(project, registry = yarnAssetRegistry) {
  const snapshot = registry.fork();
  const captured = structuredClone(project);
  let writer;
  try {
    validateProjectFields(captured);
    const pending = [];
    captured.yarnLibrary = mapAssets(migrateYarnLibraryAssets(captured.yarnLibrary, snapshot),
      (map, id, slot) => {
        if (map.byteLength > MAX_MAP_BYTES) throw new RangeError("Invalid PBR image size.");
        const path = assetPath(id, slot);
        pending.push({ path, map });
        return { ...map, assetRef: path };
      });
    if (pending.length + 1 > MAX_PROJECT_ENTRIES) throw new RangeError("Too many project assets.");
    const manifest = JSON.stringify({ ...captured, format: "knitscape", version: 2 });
    const manifestBlob = new Blob([manifest], { type: "application/json" });
    if (manifestBlob.size > MAX_MANIFEST_BYTES ||
      pending.reduce((size, item) => size + item.map.byteLength, manifestBlob.size) > MAX_PROJECT_BYTES) {
      throw new RangeError("Project package is too large.");
    }
    const { ZipWriter, BlobWriter, BlobReader } = await import("@zip.js/zip.js");
    // PNG/JPEG/WebP are already compressed; STORE avoids extra copies and work.
    writer = new ZipWriter(new BlobWriter("application/zip"), { level: 0, useWebWorkers: false });
    await writer.add("project.json", new BlobReader(manifestBlob));
    for (const { path, map } of pending) {
      const blob = await snapshot.getBlob(map.assetRef);
      if (blob.size !== map.byteLength) throw new Error("Yarn PBR asset size mismatch.");
      await writer.add(path, new BlobReader(blob));
    }
    const output = await writer.close();
    writer = null;
    if (output.size > MAX_PROJECT_BYTES) throw new RangeError("Project package is too large.");
    return output;
  } catch (error) {
    if (writer) await writer.close().catch(() => {});
    throw error;
  } finally {
    snapshot.clear();
  }
}

export async function readProjectPackage(blob) {
  if (!(blob instanceof Blob) || blob.size > MAX_PROJECT_BYTES) {
    throw new TypeError("Invalid project package size.");
  }
  const { ZipReader, BlobReader, BlobWriter, TextWriter } = await import("@zip.js/zip.js");
  const reader = new ZipReader(new BlobReader(blob), {
    strictness: "strict", checkSignature: true, useWebWorkers: false,
  });
  const registry = new YarnAssetRegistry();
  try {
    const entries = await reader.getEntries();
    if (entries.length > MAX_PROJECT_ENTRIES) throw new RangeError("Too many project assets.");
    const files = new Map();
    let totalSize = 0;
    const mapPath = new RegExp(`^assets/yarn/[^/]+/(${YARN_PBR_MAP_KEYS.join("|")})(\\.original)?$`);
    for (const entry of entries) {
      if (entry.directory) continue;
      if (entry.encrypted || files.has(entry.filename) ||
        (entry.filename !== "project.json" && !mapPath.test(entry.filename))) {
        throw new TypeError("Invalid project asset entry.");
      }
      totalSize += entry.uncompressedSize;
      if (!Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize <= 0 ||
        entry.uncompressedSize > (entry.filename === "project.json" ? MAX_MANIFEST_BYTES : MAX_MAP_BYTES) ||
        totalSize > MAX_PROJECT_BYTES) throw new RangeError("Invalid project asset size.");
      files.set(entry.filename, entry);
    }
    const manifest = files.get("project.json");
    if (!manifest) throw new TypeError("Project is missing project.json.");
    const project = JSON.parse(await manifest.getData(new TextWriter(), { checkSignature: true }));
    if (project.format !== "knitscape" || project.version !== 2) {
      throw new TypeError("Unsupported project package version.");
    }
    validateProjectFields(project);
    project.yarnLibrary = mapAssets(project.yarnLibrary, (map, id, slot) => {
      if (!map.assetRef || map.assetRef !== assetPath(id, slot)) {
        throw new TypeError("Invalid project asset reference.");
      }
      const entry = files.get(map.assetRef);
      if (!entry) throw new TypeError("Project asset is missing.");
      if (entry.uncompressedSize !== map.byteLength) throw new TypeError("Project asset size mismatch.");
      return { ...map, assetRef: registry.register(async () => {
        const data = await entry.getData(new BlobWriter(map.mimeType), {
          checkSignature: true, useWebWorkers: false,
        });
        if (data.size !== map.byteLength) throw new TypeError("Project asset size mismatch.");
        return data;
      }) };
    });
    return { project, registry };
  } catch (error) {
    registry.clear();
    throw error;
  } finally {
    // zip.js entries retain their Blob reader and remain readable after close().
    await reader.close();
  }
}
