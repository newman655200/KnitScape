import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

globalThis.Path2D ??= class Path2D {};

const modulePath = "src/simulation/needleArrangementOverlay.js";
const executionModulePath = "src/simulation/needleExecution.js";
assert.ok(
  fs.existsSync(modulePath),
  "needle arrangement input module must exist."
);
assert.ok(
  fs.existsSync(executionModulePath),
  "needle execution module must exist."
);

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const [arrangement, execution, { Bimp }, { GLOBAL_STATE }] =
    await Promise.all([
      server.ssrLoadModule(`/${modulePath}`),
      server.ssrLoadModule(`/${executionModulePath}`),
      server.ssrLoadModule("/src/lib/Bimp.js"),
      server.ssrLoadModule("/src/state.js"),
    ]);

  const {
    normalizeNeedleArrangementInput,
    combineNeedleArrangementInputs,
    formatNeedleArrangement,
    parseNeedleArrangement,
    parseNeedleArrangementInputs,
  } = arrangement;
  const { getNeedleTypeAtPosition, isNeedleArrangementValid } = execution;

  assert.equal(GLOBAL_STATE.repeats.length, 1);
  assert.equal(GLOBAL_STATE.repeats[0].bitmap.width, 4);
  assert.equal(GLOBAL_STATE.repeats[0].bitmap.height, 4);
  assert.equal(GLOBAL_STATE.editingRepeat, 0);
  assert.deepEqual(GLOBAL_STATE.needleArrangement, []);

  assert.equal(normalizeNeedleArrangementInput("111"), "111");
  assert.equal(normalizeNeedleArrangementInput("1a5-10"), "1510");
  assert.equal(normalizeNeedleArrangementInput("1, 2,10"), "1, 2,10");
  assert.equal(normalizeNeedleArrangementInput("122"), "122");

  const inputCases = [
    [["1", "2", "3", "4"], "1234", [1, 2, 3, 4]],
    [["11", "22", "33", "44"], "11223344", [1, 1, 2, 2, 3, 3, 4, 4]],
    [["1", "22", "33", "4"], "122334", [1, 2, 2, 3, 3, 4]],
    [["1", "22", "3", "44"], "122344", [1, 2, 2, 3, 4, 4]],
  ];
  for (const [inputs, expectedDisplay, expectedArrangement] of inputCases) {
    assert.equal(combineNeedleArrangementInputs(inputs), expectedDisplay);
    assert.deepEqual(
      parseNeedleArrangementInputs(inputs),
      expectedArrangement
    );
  }

  assert.deepEqual(parseNeedleArrangement("1234"), [1, 2, 3, 4]);
  assert.deepEqual(parseNeedleArrangement("122334"), [1, 2, 2, 3, 3, 4]);
  assert.deepEqual(parseNeedleArrangement("1,2,2,10,10,4"), [
    1, 2, 2, 10, 10, 4,
  ]);
  assert.deepEqual(parseNeedleArrangement("1 2 2 10 10 4"), [
    1, 2, 2, 10, 10, 4,
  ]);
  assert.deepEqual(parseNeedleArrangement(""), []);
  assert.equal(formatNeedleArrangement([1, 2, 2, 3, 3, 4]), "122334");
  assert.equal(
    formatNeedleArrangement([1, 2, 2, 10, 10, 4]),
    "1,2,2,10,10,4"
  );
  assert.equal(
    combineNeedleArrangementInputs(["1,2,2,10,10,4", "", "", ""]),
    "1,2,2,10,10,4"
  );

  const parsedArrangement = parseNeedleArrangement("122334");
  assert.deepEqual(
    Array.from({ length: 12 }, (_, position) =>
      getNeedleTypeAtPosition(parsedArrangement, position)
    ),
    [1, 2, 2, 3, 3, 4, 1, 2, 2, 3, 3, 4]
  );
  assert.equal(getNeedleTypeAtPosition([], 0), null);
  assert.equal(getNeedleTypeAtPosition(parsedArrangement, -1), null);

  for (const [width, height, value, expected] of [
    [4, 4, "122334", [1, 2, 2, 3, 3, 4]],
    [8, 4, "122334", [1, 2, 2, 3, 3, 4]],
    [8, 8, "11223344", [1, 1, 2, 2, 3, 3, 4, 4]],
    [12, 6, "12123434", [1, 2, 1, 2, 3, 4, 3, 4]],
  ]) {
    const camMatrix = Bimp.empty(width, height, 0);
    const parsed = parseNeedleArrangement(value);
    assert.equal(camMatrix.width, width);
    assert.equal(camMatrix.height, height);
    assert.equal(isNeedleArrangementValid(parsed, camMatrix.height), true);
    assert.deepEqual(parsed, expected);
  }

  assert.equal(isNeedleArrangementValid([], 4), false);
  assert.equal(isNeedleArrangementValid([0, 1], 4), false);
  assert.equal(isNeedleArrangementValid([1, 5], 4), false);
  assert.equal(isNeedleArrangementValid([1, 6], 6), true);
  assert.equal(isNeedleArrangementValid([1, 8], 8), true);
  assert.equal(isNeedleArrangementValid([1, 10], 10), true);
} finally {
  await server.close();
}

const requiredSources = [
  "src/views/needleArrangementBar.js",
  "src/views/view.js",
  "src/state.js",
  "src/components/runSimulation.js",
  executionModulePath,
];
for (const sourcePath of requiredSources) {
  assert.ok(fs.existsSync(sourcePath), `${sourcePath} must exist.`);
}

const barSource = fs.readFileSync("src/views/needleArrangementBar.js", "utf8");
const domainSource = fs.readFileSync(modulePath, "utf8");
const executionSource = fs.readFileSync(executionModulePath, "utf8");
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
assert.match(stateSource, /needleArrangement:\s*\[\]/);
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
assert.match(barSource, /parseNeedleArrangementInputs/);
assert.match(barSource, /GLOBAL_STATE\.repeats\[0\]\?\.bitmap\.height/);
assert.match(barSource, /isNeedleArrangementValid/);
assert.match(barSource, /disabled=\$\{!canApplyArrangement\}/);
assert.match(
  barSource,
  /dispatch\(\{\s*needleArrangement:\s*parsedArrangement\s*\}\)/s
);
assert.match(
  barSource,
  /dispatch\(\{\s*needleArrangement:\s*\[\]\s*\}\)/s
);
assert.match(barSource, /needleArrangement\.typeRange/);
assert.doesNotMatch(barSource, /bitmap\.width/);
assert.doesNotMatch(barSource, /hasFourColumnNeedleSource/);
assert.doesNotMatch(barSource, /requiresFourColumns/);
assert.doesNotMatch(domainSource, /type\s*<=\s*4/);
assert.doesNotMatch(domainSource, /\[1-4\]/);
assert.doesNotMatch(executionSource, /buildChartFromRepeats/);
assert.match(simulationSource, /const baseSimulation = GLOBAL_STATE\.chart/);
assert.match(simulationSource, /buildArrangedChart/);
assert.match(simulationSource, /isNeedleArrangementValid/);
assert.match(simulationSource, /GLOBAL_STATE\.repeats\[0\]\?\.bitmap/);
assert.doesNotMatch(simulationSource, /const arrangedSimulation = baseSimulation/);
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
assert.match(stylesSource, /\.needle-arrangement-message\s*\{/);
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
  "needleArrangement.typeRange",
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
assert.equal(
  packageJSON.scripts["validate:needle-execution"],
  "node scripts/validate-needle-execution.mjs"
);

console.log(
  "PASS: needle arrangement inputs support dynamic needle type identifiers."
);
