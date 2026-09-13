import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

globalThis.Path2D ??= class Path2D {};

const modulePath = "src/simulation/needleArrangementOverlay.js";
assert.ok(
  fs.existsSync(modulePath),
  "needle arrangement domain module must exist."
);

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const [arrangement, { Bimp }, { GLOBAL_STATE }] = await Promise.all([
    server.ssrLoadModule(`/${modulePath}`),
    server.ssrLoadModule("/src/lib/Bimp.js"),
    server.ssrLoadModule("/src/state.js"),
  ]);

  const {
    normalizeNeedleArrangementInput,
    combineNeedleArrangementInputs,
    parseNeedleArrangement,
    getNeedleTypeAtPosition,
    isValidNeedleArrangement,
  } = arrangement;

  assert.equal(GLOBAL_STATE.repeats.length, 1);
  assert.equal(GLOBAL_STATE.repeats[0].bitmap.width, 4);
  assert.equal(GLOBAL_STATE.repeats[0].bitmap.height, 4);
  assert.equal(GLOBAL_STATE.editingRepeat, 0);

  assert.equal(normalizeNeedleArrangementInput("111"), "111");
  assert.equal(normalizeNeedleArrangementInput("11a510"), "111");
  assert.equal(normalizeNeedleArrangementInput("122"), "1");

  const inputCases = [
    [["1", "2", "3", "4"], "1234"],
    [["11", "22", "33", "44"], "11223344"],
    [["1", "22", "33", "4"], "122334"],
    [["1", "22", "3", "44"], "122344"],
  ];
  for (const [inputs, expected] of inputCases) {
    assert.equal(combineNeedleArrangementInputs(inputs), expected);
  }

  assert.deepEqual(parseNeedleArrangement("1234"), [1, 2, 3, 4]);
  assert.deepEqual(parseNeedleArrangement("122334"), [1, 2, 2, 3, 3, 4]);
  assert.deepEqual(parseNeedleArrangement("11223344"), [
    1, 1, 2, 2, 3, 3, 4, 4,
  ]);
  assert.deepEqual(parseNeedleArrangement(""), []);
  assert.deepEqual(parseNeedleArrangement("1204"), []);

  const parsedArrangement = parseNeedleArrangement("122334");
  assert.deepEqual(
    Array.from({ length: 12 }, (_, position) =>
      getNeedleTypeAtPosition(parsedArrangement, position)
    ),
    [1, 2, 2, 3, 3, 4, 1, 2, 2, 3, 3, 4]
  );
  assert.equal(getNeedleTypeAtPosition([], 0), null);
  assert.equal(getNeedleTypeAtPosition(parsedArrangement, -1), null);

  for (const [width, height, value] of [
    [4, 4, "122334"],
    [8, 4, "122334"],
    [8, 8, "11223344"],
    [12, 6, "12123434"],
  ]) {
    const patternRepeat = Bimp.empty(width, height, 0);
    assert.equal(patternRepeat.width, width);
    assert.equal(patternRepeat.height, height);
    assert.equal(isValidNeedleArrangement(value), true);
    assert.deepEqual(parseNeedleArrangement(value), Array.from(value, Number));
  }

  for (const invalidValue of ["", "0", "5", "12a4", "1 2"]) {
    assert.equal(isValidNeedleArrangement(invalidValue), false);
  }
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

const barSource = fs.readFileSync("src/views/needleArrangementBar.js", "utf8");
const domainSource = fs.readFileSync(modulePath, "utf8");
const viewSource = fs.readFileSync("src/views/view.js", "utf8");
const stateSource = fs.readFileSync("src/state.js", "utf8");
const simulationSource = fs.readFileSync(
  "src/components/runSimulation.js",
  "utf8"
);
const importersSource = fs.readFileSync("src/actions/importers.js", "utf8");

assert.match(viewSource, /needleArrangementBar\(\)/);
assert.match(
  stateSource,
  /needleArrangementInputs:\s*\["",\s*"",\s*"",\s*""\]/
);
assert.match(stateSource, /needleArrangement:\s*""/);
assert.match(
  stateSource,
  /bitmap:\s*Bimp\.empty\(4,\s*4,\s*DEFAULT_STITCH_SYMBOL_INDEX\)/
);
assert.match(
  importersSource,
  /bitmap:\s*Bimp\.empty\(4,\s*4,\s*DEFAULT_STITCH_SYMBOL_INDEX\)/
);
assert.equal(
  (barSource.match(/class="needle-arrangement-input"/g) || []).length,
  1,
  "the four inputs must be rendered from one mapped template."
);
assert.match(barSource, /GLOBAL_STATE\.needleArrangementInputs\.map/);
assert.match(barSource, /readonly/);
assert.match(barSource, /isValidNeedleArrangement\(combinedArrangement\)/);
assert.match(barSource, /disabled=\$\{!canApplyArrangement\}/);
assert.match(
  barSource,
  /dispatch\(\{\s*needleArrangement:\s*combinedArrangement\s*\}\)/s
);
assert.match(
  barSource,
  /dispatch\(\{\s*needleArrangement:\s*""\s*\}\)/s
);
assert.doesNotMatch(barSource, /GLOBAL_STATE\.repeats/);
assert.doesNotMatch(barSource, /hasFourColumnNeedleSource/);
assert.doesNotMatch(barSource, /requiresFourColumns/);
assert.doesNotMatch(domainSource, /hasFourColumnNeedleSource/);
assert.doesNotMatch(domainSource, /arrangeNeedleRepeatBitmap/);
assert.doesNotMatch(domainSource, /applyNeedleArrangementOverlay/);
assert.doesNotMatch(domainSource, /buildChartFromRepeats/);
assert.match(simulationSource, /const baseSimulation = GLOBAL_STATE\.chart/);
assert.match(simulationSource, /const arrangedSimulation = baseSimulation/);
assert.doesNotMatch(simulationSource, /applyNeedleArrangementOverlay/);
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
assert.doesNotMatch(stylesSource, /\.needle-arrangement-message\s*\{/);
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
]) {
  assert.equal(
    (translationsSource.match(new RegExp(`"${key}"`, "g")) || []).length,
    4,
    `${key} must be translated for every existing language.`
  );
}
assert.doesNotMatch(translationsSource, /needleArrangement\.requiresFourColumns/);

const packageJSON = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(
  packageJSON.scripts["validate:needle-arrangement"],
  "node scripts/validate-needle-arrangement.mjs"
);

console.log(
  "PASS: needle arrangement domain is independent from pattern repeat dimensions."
);
