import assert from "node:assert/strict";
import { createServer } from "vite";

const savedGlobals = new Map(
  ["window", "document", "Path2D"].map((name) => [
    name,
    {
      exists: Object.prototype.hasOwnProperty.call(globalThis, name),
      value: globalThis[name],
    },
  ])
);
const originalConsoleLog = console.log;
const clickedDownloads = [];
let appendedAnchors = 0;
let removedAnchors = 0;
let server;

function restoreGlobal(name) {
  const saved = savedGlobals.get(name);
  if (saved.exists) globalThis[name] = saved.value;
  else delete globalThis[name];
}

function textFromDataUrl(dataUrl) {
  assert.match(dataUrl, /^data:text\/plain;charset=utf-8,/);
  return decodeURIComponent(dataUrl.slice(dataUrl.indexOf(",") + 1));
}

function assertBmpUsesFullCanvas(dataUrl) {
  assert.match(dataUrl, /^data:image\/bmp;base64,/);
  const bitmap = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  assert.equal(bitmap.toString("ascii", 0, 2), "BM");
  assert.equal(
    bitmap.readInt32LE(18),
    5,
    "BMP must use the full derived width"
  );
  assert.equal(
    bitmap.readInt32LE(22),
    7,
    "BMP must use the full derived height"
  );
}

const expectedSilverRows = [
  "88888",
  "77777",
  "87878",
  "88888",
  "77777",
  "87878",
  "88888",
];
const expectedColorRows = [
  "66666",
  "55555",
  "44444",
  "33333",
  "22222",
  "11111",
  "00000",
];
const expectedStitchRows = [
  "-----",
  ".....",
  "-.-.-",
  "-----",
  ".....",
  "-.-.-",
  "-----",
];

function assertSilverUsesFullCanvas(text) {
  const lines = text.split("\n");
  assert.equal(lines[0], "SilverKnit");
  assert.equal(
    lines.length - 1,
    7,
    "SilverKnit must contain 7 full derived rows"
  );
  assert.deepEqual(lines.slice(1), expectedSilverRows);
  for (const row of lines.slice(1)) {
    assert.equal(row.length, 5, "SilverKnit rows must use the full width");
  }
}

function assertKniterateUsesFullCanvas(text) {
  const lines = text.split("\n");
  const yarnsIndex = lines.indexOf("YARNS");
  const paletteIndex = lines.indexOf("YARN PALETTE");
  const stitchesIndex = lines.indexOf("STITCH SYMBOLS");
  const endIndex = lines.indexOf("END");
  const colorRows = lines.slice(yarnsIndex + 1, paletteIndex);
  const stitchRows = lines.slice(stitchesIndex + 1, endIndex);

  assert.equal(lines[0], "FILE FORMAT : DAK");
  assert.ok(yarnsIndex >= 0 && paletteIndex > yarnsIndex);
  assert.ok(stitchesIndex > paletteIndex && endIndex > stitchesIndex);
  assert.equal(
    colorRows.length,
    7,
    "Kniterate colors must contain 7 full derived rows"
  );
  assert.equal(
    stitchRows.length,
    7,
    "Kniterate stitches must contain 7 full derived rows"
  );
  assert.deepEqual(colorRows, expectedColorRows);
  assert.deepEqual(stitchRows, expectedStitchRows);
  for (const row of [...colorRows, ...stitchRows]) {
    assert.equal(row.length, 5, "Kniterate rows must use the full width");
  }
}

try {
  server = await createServer({
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });

  globalThis.window = {};
  globalThis.Path2D = class {};
  globalThis.document = {
    body: {
      appendChild(node) {
        appendedAnchors += 1;
        return node;
      },
    },
    createElement(tagName) {
      const normalizedTag = String(tagName).toUpperCase();
      if (normalizedTag === "IMG") {
        return { tagName: "IMG", src: "" };
      }
      assert.equal(normalizedTag, "A");
      const attributes = new Map();
      return {
        tagName: "A",
        setAttribute(name, value) {
          attributes.set(name, value);
        },
        click() {
          clickedDownloads.push({
            href: attributes.get("href"),
            download: attributes.get("download"),
          });
        },
        remove() {
          removedAnchors += 1;
        },
      };
    },
  };
  console.log = () => {};
  const [state, { Bimp }, exporters] = await Promise.all([
    server.ssrLoadModule("/src/state.js"),
    server.ssrLoadModule("/src/lib/Bimp.js"),
    server.ssrLoadModule("/src/actions/exporters.js"),
  ]);

  const needleUnitBitmap = new Bimp(2, 3, [
    0, 0,
    2, 0,
    2, 2,
  ]);
  state.loadWorkspace({
    canvasWidth: 5,
    canvasHeight: 7,
    camUnitBitmap: Bimp.empty(2, 3, 0),
    needleUnitBitmap,
    yarnPalette: [
      "#000000",
      "#220000",
      "#440000",
      "#660000",
      "#880000",
      "#aa0000",
      "#cc0000",
    ],
    yarnSequence: new Bimp(1, 7, [0, 1, 2, 3, 4, 5, 6]),
  });

  assert.deepEqual(
    [state.GLOBAL_STATE.needleUnitBitmap.width, state.GLOBAL_STATE.needleUnitBitmap.height],
    [2, 3]
  );
  assert.deepEqual(
    [state.GLOBAL_STATE.needleBitmap.width, state.GLOBAL_STATE.needleBitmap.height],
    [5, 7]
  );
  assert.deepEqual(state.GLOBAL_STATE.needleBitmap.make2d(), [
    [2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0],
    [2, 0, 2, 0, 2],
    [2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0],
    [2, 0, 2, 0, 2],
    [2, 2, 2, 2, 2],
  ]);

  exporters.downloadBMP();
  exporters.downloadSilverKnitTxt();
  exporters.downloadKniterate();

  assert.equal(clickedDownloads.length, 3);
  assert.equal(appendedAnchors, 3);
  assert.equal(removedAnchors, 3);
  assert.equal(clickedDownloads[1].download, "pattern.txt");
  assert.equal(clickedDownloads[2].download, "pattern.txt");
  assertBmpUsesFullCanvas(clickedDownloads[0].href);
  assertSilverUsesFullCanvas(textFromDataUrl(clickedDownloads[1].href));
  assertKniterateUsesFullCanvas(textFromDataUrl(clickedDownloads[2].href));

  const mutatedBitmap = Buffer.from(
    clickedDownloads[0].href.slice(clickedDownloads[0].href.indexOf(",") + 1),
    "base64"
  );
  mutatedBitmap.writeInt32LE(2, 18);
  mutatedBitmap.writeInt32LE(3, 22);
  assert.throws(
    () =>
      assertBmpUsesFullCanvas(
        `data:image/bmp;base64,${mutatedBitmap.toString("base64")}`
      ),
    /full derived width/
  );
  assert.throws(
    () => assertSilverUsesFullCanvas("SilverKnit\n77\n87\n88"),
    /7 full derived rows/
  );
  assert.throws(
    () =>
      assertKniterateUsesFullCanvas(
        [
          "FILE FORMAT : DAK",
          "YARNS",
          "66",
          "55",
          "44",
          "YARN PALETTE",
          "STITCH SYMBOLS",
          "--",
          "..",
          "-.",
          "END",
        ].join("\n")
      ),
    /7 full derived rows/
  );
} finally {
  try {
    await server?.close();
  } finally {
    console.log = originalConsoleLog;
    restoreGlobal("Path2D");
    restoreGlobal("document");
    restoreGlobal("window");
  }
}

console.log(
  "PASS: BMP, SilverKnit, and Kniterate consume the full derived needle bitmap."
);
