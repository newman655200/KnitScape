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

  const basePixels = [
    3, 2, 1, 0, 3, 2, 1, 0,
    0, 1, 2, 3, 0, 1, 2, 3,
  ];
  const baseSimulation = new Bimp(8, 2, basePixels);
  const arrangedSimulation = applyNeedleArrangementOverlay(
    baseSimulation,
    "122334"
  );

  assert.notEqual(arrangedSimulation, baseSimulation);
  assert.deepEqual(Array.from(baseSimulation.pixels), basePixels);
  assert.deepEqual(Array.from(arrangedSimulation.pixels), [
    0, 1, 1, 2, 2, 3, 0, 1,
    0, 1, 1, 2, 2, 3, 0, 1,
  ]);
  assert.equal(applyNeedleArrangementOverlay(baseSimulation, ""), baseSimulation);

  const reappliedSimulation = applyNeedleArrangementOverlay(
    baseSimulation,
    "11223344"
  );
  assert.deepEqual(Array.from(reappliedSimulation.pixels), [
    0, 0, 1, 1, 2, 2, 3, 3,
    0, 0, 1, 1, 2, 2, 3, 3,
  ]);
  assert.deepEqual(Array.from(baseSimulation.pixels), basePixels);
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
assert.match(barSource, /disabled=\$\{!combinedArrangement\}/);
assert.match(barSource, /dispatch\(\{\s*needleArrangement:\s*combinedArrangement\s*\}\)/s);
assert.match(barSource, /dispatch\(\{\s*needleArrangement:\s*""\s*\}\)/s);
assert.match(simulationSource, /const baseSimulation = GLOBAL_STATE\.chart/);
assert.match(
  simulationSource,
  /const arrangedSimulation = applyNeedleArrangementOverlay\(\s*baseSimulation,\s*GLOBAL_STATE\.needleArrangement\s*\)/s
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
