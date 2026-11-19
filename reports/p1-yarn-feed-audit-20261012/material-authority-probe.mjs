/**
 * Read-only P1 material authority audit.
 * Run from the project root:
 *   node reports/p1-yarn-feed-audit-20261012/material-authority-probe.mjs
 * No browser, Vite, file writes, or GPU shader execution.
 * Canvas and Image are test fixtures; production exported functions run directly.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const baseline = "7ababf264d495f6b96d4d66652c529424938ac4d";
const rootMarker = "src/simulation/yarnTextureBrush.js";
const projectRoot = fs.existsSync(path.resolve(process.cwd(), rootMarker))
  ? process.cwd()
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const moduleUrls = new Map();

// Rewrite relative module specifiers only in memory. This avoids Vite cache files
// and avoids requiring package.json type=module or Node experimental flags.
function sourceModuleUrl(relativeFile) {
  const absolute = path.resolve(projectRoot, relativeFile);
  if (moduleUrls.has(absolute)) return moduleUrls.get(absolute);
  let source = fs.readFileSync(absolute, "utf8");
  if (relativeFile.replaceAll("\\", "/") === "src/constants.js") {
    // Pattern library lookup is unrelated to these material/draw probes.
    source = source.replace('import.meta.glob("../examples/*.json")', "({})");
  }
  source = source.replace(
    /(from\s+|import\s*)(["'])(\.{1,2}\/[^"']+)\2/g,
    (_, prefix, quote, specifier) => {
      const withExtension = path.extname(specifier)
        ? specifier
        : specifier + ".js";
      const dependency = path.resolve(path.dirname(absolute), withExtension);
      return (
        prefix +
        JSON.stringify(
          sourceModuleUrl(path.relative(projectRoot, dependency))
        )
      );
    }
  );
  const result =
    "data:text/javascript;base64," +
    Buffer.from(source).toString("base64");
  moduleUrls.set(absolute, result);
  return result;
}
const productionModule = (relativeFile) =>
  import(sourceModuleUrl(relativeFile));

async function main() {
  const git = (args) =>
    execFileSync("git", args, {
      cwd: projectRoot,
      encoding: "utf8",
    }).trim();
  const head = git(["rev-parse", "HEAD"]);
  const branch = git(["branch", "--show-current"]);
  assert.equal(head, baseline, "Audit must run on the trusted baseline.");
  assert.equal(branch, "main", "Audit must run on main.");

  // A fixture Path2D records commands; it does not rasterize browser pixels.
  globalThis.Path2D = class FixturePath2D {
    constructor(source = "") {
      this.source = source;
    }
  };
  const [brush, renderer, draw, domain, bimp] = await Promise.all([
    productionModule("src/simulation/yarnTextureBrush.js"),
    productionModule("src/simulation/yarnUvWebglRenderer.js"),
    productionModule("src/simulation/drawYarnSimulation.js"),
    productionModule("src/domain/yarnLibrary.js"),
    productionModule("src/lib/Bimp.js"),
  ]);

  const map = (assetRef, fileName) => ({
    assetRef,
    fileName,
    mimeType: "image/png",
    byteLength: 1,
  });
  const timestamp = "2026-10-12T00:00:00.000Z";
  const rawAssets = [
    {
      id: "A",
      name: "A",
      category: "OTHER",
      createdAt: timestamp,
      updatedAt: timestamp,
      color: "#00ff00",
      diameter: 0.5,
      pbr: {
        baseColor: map("fixture-own-A", "A_BaseColor.png"),
        physicalRepeatLengthMm: 8,
      },
    },
    {
      id: "B",
      name: "B",
      category: "OTHER",
      createdAt: timestamp,
      updatedAt: timestamp,
      color: "#00ffff",
      diameter: 0.4,
    },
    {
      id: "C",
      name: "C",
      category: "OTHER",
      createdAt: timestamp,
      updatedAt: timestamp,
      pbr: {
        normal: map("fixture-own-C-normal", "C_Normal.png"),
        physicalRepeatLengthMm: 15,
      },
    },
  ];
  const library = domain.normalizeYarnLibrary(rawAssets);
  assert.ok(
    library.every(
      (asset) =>
        !Object.hasOwn(asset, "color") &&
        !Object.hasOwn(asset, "diameter")
    )
  );
  const feeds = [
    {
      yarns: library.map((asset) => ({
        yarnId: asset.id,
        yarnLengthCmPer100Needles: 0,
        tensionCN: null,
        placement: "parallel",
      })),
    },
  ];
  const primary = {
    color: "#ff0000",
    diameter: 0.24,
    texture: {
      enabled: true,
      processedDataUrl: "fixture-legacy-scan",
      pbr: {
        baseColor: { dataUrl: "fixture-legacy-base" },
        physicalRepeatLengthMm: 12,
      },
    },
  };
  const materials = brush
    .resolveFeedYarnPlies(feeds, library, primary)
    .get(0);

  assert.equal(materials.length, 3);
  assert.ok(
    materials.every(
      (material) =>
        material.color === primary.color &&
        material.diameter === primary.diameter
    )
  );
  assert.equal(materials[1], primary);
  assert.equal(materials[0].texture.processedDataUrl, "");
  assert.equal(
    materials[0].texture.pbr.baseColor.assetRef,
    "fixture-own-A"
  );
  assert.equal(materials[2].texture.processedDataUrl, "");
  assert.equal(materials[2].texture.pbr.baseColor, null);
  assert.equal(
    materials[2].texture.pbr.normal.assetRef,
    "fixture-own-C-normal"
  );
  assert.deepEqual(
    materials.map(
      (material) => material.texture.pbr.physicalRepeatLengthMm
    ),
    [8, 12, 15]
  );

  const sourceSummary = (material) => {
    const maps = renderer.materialMaps(material);
    return {
      color: material.color,
      diameter: material.diameter,
      scanSource: material.texture?.processedDataUrl || "",
      physicalRepeatLengthMm:
        material.texture?.pbr?.physicalRepeatLengthMm,
      mapSources: Object.fromEntries(
        Object.entries(maps).map(([key, value]) => [
          key,
          value?.assetRef ? "asset:" + value.assetRef : value,
        ])
      ),
    };
  };
  const materialAuthority = {
    pass: true,
    inputAssetsHadDistinctColorAndDiameter: true,
    normalizedAssetHasColorOrDiameter: library.some(
      (asset) =>
        Object.hasOwn(asset, "color") ||
        Object.hasOwn(asset, "diameter")
    ),
    allAssignmentsUseLegacyPrimaryColorAndDiameter: true,
    noPbrReturnsPrimaryObject: materials[1] === primary,
    partialPbrReplacesWholeTextureRatherThanFillingLegacyMaps: true,
    materials: materials.map((material, index) => ({
      yarnId: library[index].id,
      ...sourceSummary(material),
    })),
  };

  // Actual drawYarnSimulation() executes with recorded Canvas stroke calls.
  // activeYarnPlies is its normal public input, not a full simulate() result.
  const strokes = [];
  const fixtureContext = () => ({
    globalAlpha: 1,
    clearRect() {},
    save() {},
    restore() {},
    stroke(fixturePath) {
      strokes.push({
        color: this.strokeStyle,
        width: this.lineWidth,
        path: fixturePath.source,
      });
    },
  });
  const fixtureCanvas = () => ({
    getContext: () => fixtureContext(),
  });
  const solidPrimary = {
    color: "#ff0000",
    diameter: 0.24,
    enabled: true,
    texture: null,
  };
  const legacySecond = {
    color: "#0000ff",
    diameter: 0.14,
    enabled: true,
    texture: null,
  };
  const solidMaterials = brush.resolveFeedYarnPlies(
    feeds,
    library,
    solidPrimary
  );
  const paths = new Map([[0, "M 0 0 L 10 0"]]);
  draw.drawYarnSimulation({
    canvases: {
      backCanvas: fixtureCanvas(),
      midCanvas: fixtureCanvas(),
      frontCanvas: fixtureCanvas(),
    },
    canvasWidth: 100,
    canvasHeight: 100,
    yarnPathLinks: [{ index: 0, row: 0, layer: "mid" }],
    yarnStrands: Array.from({ length: 3 }, () => ({
      modelPathByLink: paths,
      resolvedPathByLink: paths,
      uvOffsets: new Map([[0, 0]]),
    })),
    feedYarnPlies: solidMaterials,
    feedCount: 1,
    stitchWidth: 1,
    activeYarnPlies: [solidPrimary, legacySecond],
    normalizedYarnSequence: new bimp.Bimp(1, 1, [0]),
    palette: ["#ff0000"],
    hasYarnSequenceMask: false,
    renderTextures: false,
    renderUvTextures: false,
  });
  const solidStrokes = strokes.filter((stroke) =>
    ["#ff0000", "#0000ff"].includes(stroke.color)
  );
  assert.deepEqual(
    solidStrokes.map((stroke) => stroke.color),
    ["#ff0000", "#ff0000", "#ff0000", "#0000ff"]
  );
  assert.deepEqual(
    solidStrokes.map((stroke) => stroke.width),
    [0.24, 0.24, 0.24, 0.14]
  );
  const strandCount = {
    pass: true,
    assignmentCount: 3,
    enabledLegacySecondCount: 1,
    actualSolidStrandCount: solidStrokes.length,
    rawStrokeCountIncludingShadows: strokes.length,
    strands: solidStrokes.map(({ color, width }) => ({
      color,
      width,
    })),
  };

  // Image fixture marks a supplied source ready. It performs no network fetch,
  // browser image decoding, file decoding, rasterization, or WebGL upload.
  const fixtureImageSources = [];
  globalThis.Image = class FixtureImage {
    naturalWidth = 4;
    naturalHeight = 4;
    set src(source) {
      this.source = source;
      fixtureImageSources.push(source);
      queueMicrotask(() => this.onload());
    }
  };
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, "canvas");
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage() {},
          fillRect() {},
        }),
      };
    },
  };
  const canvasPatternSources = [];
  const textureContext = {
    save() {},
    restore() {},
    stroke() {},
    createPattern(image) {
      canvasPatternSources.push(image.source);
      return "fixture-pattern";
    },
  };
  await brush.prepareYarnTextureImages([primary]);
  brush.drawYarnTexturePath(
    textureContext,
    new Path2D("M 0 0 L 10 0"),
    primary,
    1
  );
  const webglBaseColor = renderer.materialMaps(primary).baseColor;
  assert.deepEqual(canvasPatternSources, ["fixture-legacy-scan"]);
  assert.equal(webglBaseColor, "fixture-legacy-base");
  const legacySourcePriority = {
    pass: true,
    canvasSelectedSource: canvasPatternSources[0],
    webglSelectedSource: webglBaseColor,
    prioritiesDiffer: true,
  };

  const tintedPly = {
    color: "#00ff00",
    diameter: 0.24,
    texture: {
      processedDataUrl: "fixture-cold-tint-scan",
      enabled: true,
      useOriginalColor: false,
    },
  };
  await brush.prepareYarnTextureImages([tintedPly]);
  const tintedPatterns = [];
  brush.drawYarnTexturePath(
    {
      ...textureContext,
      createPattern(image) {
        tintedPatterns.push(image);
        return "fixture-tinted-pattern";
      },
    },
    new Path2D("M 0 0 L 10 0"),
    tintedPly,
    1
  );
  const rawWebglImage = brush.getReadyYarnTextureImage(
    renderer.materialMaps(tintedPly).baseColor
  );
  assert.equal(tintedPatterns.length, 1);
  assert.equal(rawWebglImage, null);
  const legacyColdTint = {
    pass: true,
    useOriginalColor: false,
    canvasTintedPatternReady: true,
    webglRawImageReady: rawWebglImage !== null,
  };

  return {
    audit: "P1 Yarn/Feed material authority",
    status: "PASS",
    baseline: { branch, head },
    evidenceType: "node-test-fixture-calling-production-functions",
    limitations: {
      realBrowser: false,
      fullSimulationEntryExecuted: false,
      browserCanvasRasterization: false,
      realImageDecode: false,
      gpuUpload: false,
      webglShaderExecution: false,
      importMetaPatternLibraryStubbed: true,
    },
    productionFunctions: [
      "normalizeYarnLibrary",
      "resolveFeedYarnPlies",
      "drawYarnSimulation",
      "prepareYarnTextureImages",
      "drawYarnTexturePath",
      "materialMaps",
      "getReadyYarnTextureImage",
    ],
    probes: {
      materialAuthority,
      strandCount,
      legacySourcePriority,
      legacyColdTint,
    },
    fixtureImageSources,
  };
}

try {
  console.log(JSON.stringify(await main(), null, 2));
} catch (error) {
  console.error(
    JSON.stringify(
      {
        audit: "P1 Yarn/Feed material authority",
        status: "FAIL",
        evidenceType: "node-test-fixture-calling-production-functions",
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
}
