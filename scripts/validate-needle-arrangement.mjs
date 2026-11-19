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
assert.equal(
  fs.existsSync(executionModulePath),
  false,
  "the rejected needle execution module must be removed."
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
    formatNeedleArrangement,
    getNeedleTypeAtPosition,
    isValidNeedleArrangement,
    parseNeedleArrangement,
    parseNeedleArrangementInputs,
  } = arrangement;

  assert.equal(GLOBAL_STATE.repeats.length, 1);
  assert.equal(GLOBAL_STATE.repeats[0].bitmap.width, 4);
  assert.equal(GLOBAL_STATE.repeats[0].bitmap.height, 4);
  assert.equal(GLOBAL_STATE.editingRepeat, 0);
  assert.deepEqual(GLOBAL_STATE.needleArrangement, []);
  assert.equal(GLOBAL_STATE.showDesignComparison, false);

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

  for (const [width, height, arrangementValue] of [
    [4, 4, [1, 5]],
    [8, 4, [1, 10]],
    [8, 8, [20, 3]],
    [12, 6, [100, 2]],
  ]) {
    const patternRepeat = Bimp.empty(width, height, 0);
    assert.equal(patternRepeat.width, width);
    assert.equal(patternRepeat.height, height);
    assert.equal(isValidNeedleArrangement(arrangementValue), true);
  }

  assert.equal(isValidNeedleArrangement([]), false);
  assert.equal(isValidNeedleArrangement([0, 1]), false);
  assert.equal(isValidNeedleArrangement([1, 2.5]), false);
  assert.equal(isValidNeedleArrangement([1, 5]), true);
  assert.equal(isValidNeedleArrangement([1, 10]), true);
} finally {
  await server.close();
}

const requiredSources = [
  "src/views/needleArrangementBar.js",
  "src/views/view.js",
  "src/state.js",
  "src/components/runSimulation.js",
  "src/components/simulationCoordinator.js",
  "src/components/simulationPreviewHost.js",
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
const executionIntegrationSource = fs.readFileSync(
  "src/components/singleJerseyExecutionInput.js",
  "utf8"
);
const coordinatorSource = fs.readFileSync("src/components/simulationCoordinator.js", "utf8");
const hostSource = fs.readFileSync("src/components/simulationPreviewHost.js", "utf8");
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
assert.match(barSource, /isValidNeedleArrangement\(parsedArrangement\)/);
assert.match(barSource, /disabled=\$\{!canApplyArrangement\}/);
assert.match(
  barSource,
  /dispatch\(\{\s*needleArrangement:\s*parsedArrangement\s*\}\)/s
);
assert.match(
  barSource,
  /dispatch\(\{\s*needleArrangement:\s*\[\]\s*\}\)/s
);
assert.doesNotMatch(barSource, /needleArrangement\.typeRange/);
assert.doesNotMatch(barSource, /GLOBAL_STATE\.repeats/);
assert.doesNotMatch(barSource, /camMatrix/i);
assert.doesNotMatch(barSource, /hasFourColumnNeedleSource/);
assert.doesNotMatch(barSource, /requiresFourColumns/);
assert.doesNotMatch(domainSource, /type\s*<=\s*4/);
assert.doesNotMatch(domainSource, /\[1-4\]/);
assert.doesNotMatch(domainSource, /needleTypeCount|matrixHeight|camMatrix/);
assert.match(simulationSource,
  /import\s+\{\s*createSimulationCoordinator\s*\}\s+from\s+"\.\/simulationCoordinator\.js"/);
assert.equal((simulationSource.match(/createSimulationCoordinator\(/g) || []).length, 1);
assert.match(simulationSource, /ownedCoordinator\.compute\(GLOBAL_STATE,/);
assert.equal(
  (coordinatorSource.match(/computeYarnSimulation\(\{\s*\.\.\.common,\s*pattern:\s*state\.chart,\s*scope:\s*"pattern"/g) || []).length,
  1,
  "the before preview must continue to compute the base Pattern exactly once per actual input."
);
assert.equal(
  (coordinatorSource.match(/computeYarnSimulation\(\{\s*\.\.\.common,\s*pattern:\s*machineInput,/g) || [])
    .length,
  1,
  "only the Machine scope may compute machine-derived input."
);
assert.match(
  coordinatorSource,
  /createSingleJerseyExecutionInput\(\s*state\.singleJerseyCamProgram,\s*state\.needleArrangement,\s*state\.chart\.width,\s*state\.chart\.height\s*\)/s
);
assert.equal((coordinatorSource.match(/createSingleJerseyExecutionInput\(/g) || []).length, 1);
assert.doesNotMatch(coordinatorSource + hostSource,
  /resolveSingleJerseyOperations|createSingleJerseySimulationInput|tracks\s*\[/,
  "the coordinator and renderer host must not duplicate the approved Domain/adapter logic.");
assert.match(hostSource, /pattern:\s*\{\s*container:\s*"sim-before-container",\s*ids:\s*\["back",\s*"mid",\s*"front"\]/);
assert.match(hostSource, /machine:\s*\{\s*container:\s*"sim-after-container",\s*ids:\s*\["back-arranged",\s*"mid-arranged",\s*"front-arranged"\]/);
assert.match(hostSource, /draw\("pattern",\s*snapshots\.pattern,\s*state\);\s*draw\("machine",\s*snapshots\.machine,\s*state\)/,
  "Classic before/after canvases must consume only their matching Pattern/Machine snapshots.");
assert.doesNotMatch(simulationSource + hostSource, /\b(?:simulate|computeYarnSimulation)\s*\(/,
  "runner and renderer host may not create independent calculations.");
assert.match(
  executionIntegrationSource,
  /resolveSingleJerseyOperations/
);
assert.match(
  executionIntegrationSource,
  /createSingleJerseySimulationInput/
);
assert.doesNotMatch(
  simulationSource,
  /resolveSingleJerseyOperations|createSingleJerseySimulationInput/,
  "runSimulation must use the approved execution helper instead of bypassing domain boundaries."
);
for (const rejectedTerm of [
  "needleExecution",
  "buildArrangedChart",
  "arrangedChart",
  "arrangedSimulation",
  "needleTypeToMatrixRow",
  "resolveNeedleSymbol",
]) {
  assert.equal(
    (simulationSource + coordinatorSource + hostSource).includes(rejectedTerm),
    false,
    `runner, coordinator and host must not contain ${rejectedTerm}.`
  );
}
assert.equal(
  (simulationSource.match(/GLOBAL_STATE\.needleArrangement/g) || []).length,
  1,
  "outside the coordinator, only the read-only operation display may read needleArrangement."
);
const operationViewSource = fs.readFileSync("src/views/machineOperationDemo.js", "utf8");
assert.match(operationViewSource, /getNeedleTypeAtPosition/);
assert.doesNotMatch(operationViewSource, /resolveSingleJerseyOperations|createSingleJerseySimulationInput|buildYarnPathGeometry|simulate\(/,
  "The operation display must consume execution results, never create another execution or path authority.");
assert.match(simulationSource, /id="sim-before-container"/);
assert.match(simulationSource, /id="sim-after-container"/);
assert.match(simulationSource, /GLOBAL_STATE\.showDesignComparison/);
assert.match(
  simulationSource,
  /dispatch\(\{\s*showDesignComparison:\s*e\.target\.checked\s*\}\)/s
);
assert.match(simulationSource, /simulation\.compareDesign/);
assert.equal(
  (simulationSource.match(/GLOBAL_STATE\.flipped \? "mirrored" : ""/g) || [])
    .length,
  2,
  "both previews must read the same flipped state."
);
assert.match(
  simulationSource,
  /outputs\.yarnLengthMetrics\s*=\s*result\.pattern\.yarnLengthMetrics/,
  "the legacy yarnLengthMetrics output must remain owned by the Pattern snapshot."
);

const stylesSource = fs.readFileSync("styles.css", "utf8");
assert.match(stylesSource, /#needle-arrangement-bar\s*\{/);
assert.doesNotMatch(stylesSource, /\.needle-arrangement-message\s*\{/);
assert.match(
  stylesSource,
  /\.simulation-preview-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s
);
assert.match(
  stylesSource,
  /\.simulation-preview-grid\.comparison-active\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s
);
assert.match(
  stylesSource,
  /\.simulation-preview-panel\.comparison-hidden\s*\{[^}]*position:\s*absolute;[^}]*visibility:\s*hidden;[^}]*pointer-events:\s*none;/s
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
  "simulation.compareDesign",
]) {
  assert.equal(
    (translationsSource.match(new RegExp(`"${key}"`, "g")) || []).length,
    4,
    `${key} must be translated for every existing language.`
  );
}
assert.match(translationsSource, /"needleArrangement\.before":\s*"设计原稿"/);
assert.match(translationsSource, /"needleArrangement\.after":\s*"最终织物"/);
assert.match(translationsSource, /"simulation\.compareDesign":\s*"对比设计原稿"/);
assert.doesNotMatch(translationsSource, /needleArrangement\.typeRange/);
assert.doesNotMatch(translationsSource, /needleArrangement\.requiresFourColumns/);

const packageJSON = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(
  packageJSON.scripts["validate:needle-arrangement"],
  "node scripts/validate-needle-arrangement.mjs"
);
assert.equal(
  packageJSON.scripts["validate:needle-execution"],
  undefined
);

console.log(
  "PASS: needle arrangement affects only the approved post-arrangement machine preview path."
);
