import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

const modulePath = "src/simulation/needleArrangementOverlay.js";
assert.ok(
  fs.existsSync(modulePath),
  "needle arrangement overlay module must exist."
);

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const [arrangement, { Bimp }] = await Promise.all([
    server.ssrLoadModule(`/${modulePath}`),
    server.ssrLoadModule("/src/lib/Bimp.js"),
  ]);

  const {
    normalizeNeedleArrangementInput,
    combineNeedleArrangementInputs,
    arrangeNeedleRepeatBitmap,
    applyNeedleArrangementOverlay,
  } = arrangement;

  assert.equal(normalizeNeedleArrangementInput("111"), "111");
  assert.equal(normalizeNeedleArrangementInput("11a510"), "111");
  assert.equal(normalizeNeedleArrangementInput("122"), "1");

  const cases = [
    [["1", "2", "3", "4"], "1234"],
    [["11", "22", "33", "44"], "11223344"],
    [["1", "22", "33", "4"], "122334"],
    [["1", "22", "3", "44"], "122344"],
  ];
  for (const [inputs, expected] of cases) {
    assert.equal(combineNeedleArrangementInputs(inputs), expected);
  }

  const repeatCases = [
    [[0, 1, 2, 3], "1234", [0, 1, 2, 3]],
    [[3, 2, 1, 0], "122334", [3, 2, 2, 1, 1, 0]],
    [[0, 3, 2, 1], "11223344", [0, 0, 3, 3, 2, 2, 1, 1]],
    [[1, 0, 3, 2], "122344", [1, 0, 0, 3, 2, 2]],
  ];
  for (const [sourcePixels, needleArrangement, expectedPixels] of repeatCases) {
    const sourceBitmap = new Bimp(4, 1, sourcePixels);
    const arrangedBitmap = arrangeNeedleRepeatBitmap(
      sourceBitmap,
      needleArrangement
    );

    assert.equal(arrangedBitmap.width, needleArrangement.length);
    assert.equal(arrangedBitmap.height, sourceBitmap.height);
    assert.deepEqual(Array.from(arrangedBitmap.pixels), expectedPixels);
    assert.deepEqual(Array.from(sourceBitmap.pixels), sourcePixels);
  }

  const sourcePixels = [
    0, 1, 2, 3,
    3, 2, 1, 0,
    1, 3, 0, 2,
  ];
  const sourceBitmap = new Bimp(4, 3, sourcePixels);
  const arrangedRepeatBitmap = arrangeNeedleRepeatBitmap(
    sourceBitmap,
    "122334"
  );
  assert.equal(arrangedRepeatBitmap.width, 6);
  assert.equal(arrangedRepeatBitmap.height, 3);
  assert.deepEqual(Array.from(arrangedRepeatBitmap.pixels), [
    0, 1, 1, 2, 2, 3,
    3, 2, 2, 1, 1, 0,
    1, 3, 3, 0, 0, 2,
  ]);
  assert.deepEqual(Array.from(sourceBitmap.pixels), sourcePixels);

  function buildFixtureChart(repeat, width, height) {
    const tiled = Bimp.fromTile(
      repeat.area[0],
      repeat.area[1],
      repeat.bitmap.vFlip()
    ).vFlip();
    return Bimp.empty(width, height, 1).overlay(tiled, repeat.pos);
  }

  const repeat = {
    bitmap: sourceBitmap,
    pos: [0, 0],
    area: [12, 6],
  };
  const baseChart = buildFixtureChart(repeat, 12, 6);
  const identityChart = applyNeedleArrangementOverlay(
    baseChart,
    [repeat],
    "1234",
    1
  );
  assert.notEqual(identityChart, baseChart);
  assert.equal(identityChart.width, baseChart.width);
  assert.equal(identityChart.height, baseChart.height);
  assert.deepEqual(Array.from(identityChart.pixels), Array.from(baseChart.pixels));

  const arrangedChart = applyNeedleArrangementOverlay(
    baseChart,
    [repeat],
    "122334",
    1
  );
  assert.equal(arrangedChart.width, baseChart.width);
  assert.equal(arrangedChart.height, baseChart.height);
  assert.deepEqual(Array.from(baseChart.pixels), Array.from(buildFixtureChart(repeat, 12, 6).pixels));

  assert.equal(
    applyNeedleArrangementOverlay(baseChart, [repeat], "", 1),
    baseChart
  );
  assert.equal(
    applyNeedleArrangementOverlay(
      baseChart,
      [{ ...repeat, bitmap: new Bimp(3, 1, [0, 1, 2]) }],
      "1234",
      1
    ),
    baseChart
  );
} finally {
  await server.close();
}

const requiredSources = [
  "src/views/needleArrangementBar.js",
  "src/views/view.js",
  "src/state.js",
  "src/components/runSimulation.js",
];
for (const sourcePath of requiredSources) {
  assert.ok(fs.existsSync(sourcePath), `${sourcePath} must exist.`);
}

const barSource = fs.readFileSync(
  "src/views/needleArrangementBar.js",
  "utf8"
);
const viewSource = fs.readFileSync("src/views/view.js", "utf8");
const stateSource = fs.readFileSync("src/state.js", "utf8");
const simulationSource = fs.readFileSync(
  "src/components/runSimulation.js",
  "utf8"
);

assert.match(viewSource, /needleArrangementBar\(\)/);
assert.match(stateSource, /needleArrangementInputs:\s*\["",\s*"",\s*"",\s*""\]/);
assert.match(stateSource, /needleArrangement:\s*""/);
assert.equal(
  (barSource.match(/class="needle-arrangement-input"/g) || []).length,
  1,
  "the four inputs must be rendered from one mapped template."
);
assert.match(barSource, /GLOBAL_STATE\.needleArrangementInputs\.map/);
assert.match(barSource, /readonly/);
assert.match(barSource, /hasFourColumnNeedleSource\(GLOBAL_STATE\.repeats\)/);
assert.match(barSource, /disabled=\$\{!canApplyArrangement\}/);
assert.match(barSource, /needleArrangement\.requiresFourColumns/);
assert.match(barSource, /dispatch\(\{\s*needleArrangement:\s*combinedArrangement\s*\}\)/s);
assert.match(barSource, /dispatch\(\{\s*needleArrangement:\s*""\s*\}\)/s);
assert.match(simulationSource, /const baseSimulation = GLOBAL_STATE\.chart/);
assert.match(
  simulationSource,
  /const arrangedSimulation = applyNeedleArrangementOverlay\(\s*baseSimulation,\s*GLOBAL_STATE\.repeats,\s*GLOBAL_STATE\.needleArrangement,/s
);
assert.match(simulationSource, /id="sim-before-container"/);
assert.match(simulationSource, /id="sim-after-container"/);
assert.equal(
  (simulationSource.match(/GLOBAL_STATE\.flipped \? "mirrored" : ""/g) || [])
    .length,
  2,
  "both previews must read the same flipped state."
);
assert.match(
  simulationSource,
  /yarnLengthMetrics:\s*baseSimulationResult\.yarnLengthMetrics/
);

const stylesSource = fs.readFileSync("styles.css", "utf8");
assert.match(stylesSource, /#needle-arrangement-bar\s*\{/);
assert.match(
  stylesSource,
  /\.simulation-preview-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s
);

const translationsSource = fs.readFileSync(
  "src/i18n/translations.js",
  "utf8"
);
for (const key of [
  "needleArrangement.title",
  "needleArrangement.input",
  "needleArrangement.combined",
  "needleArrangement.apply",
  "needleArrangement.withdraw",
  "needleArrangement.before",
  "needleArrangement.after",
  "needleArrangement.requiresFourColumns",
]) {
  assert.equal(
    (translationsSource.match(new RegExp(`"${key}"`, "g")) || []).length,
    4,
    `${key} must be translated for every existing language.`
  );
}

const packageJSON = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(
  packageJSON.scripts["validate:needle-arrangement"],
  "node scripts/validate-needle-arrangement.mjs"
);

console.log("PASS: needle arrangement inputs and overlay behavior are protected.");
