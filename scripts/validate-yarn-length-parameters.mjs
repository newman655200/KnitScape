import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const packageJSON = JSON.parse(read("package.json"));
assert.equal(
  packageJSON.scripts["validate:yarn-length-parameters"],
  "node scripts/validate-yarn-length-parameters.mjs",
  "package.json must expose validate:yarn-length-parameters."
);

const constantsSource = read("src/constants.js");
assert.match(
  constantsSource,
  /DEFAULT_YARN_PLIES[\s\S]*lengthScaleY:\s*1[\s\S]*lengthScaleY:\s*1/,
  "default yarn plies must start with lengthScaleY 1.00."
);
assert.match(
  constantsSource,
  /"yarnPlies"/,
  "undo snapshots must include yarnPlies."
);
assert.match(
  constantsSource,
  /DEFAULT_MACHINE_GAUGE/,
  "machine gauge defaults must be exported for yarn length readout."
);

const leftBarSource = read("src/views/leftBar.js");
assert.match(
  leftBarSource,
  /machine\.gauge[\s\S]*yarnLength\.current/,
  "left panel must render machine gauge and current yarn length readout."
);
assert.match(
  leftBarSource,
  /yarn-ply-length-control/,
  "left panel must render yarn length controls."
);
assert.match(
  leftBarSource,
  /name="yarn-ply-length-0"/,
  "only Yarn 1 must expose an editable yarn length input."
);
assert.match(
  leftBarSource,
  /min="0\.90"[\s\S]*max="1\.10"[\s\S]*step="0\.01"/,
  "yarn length inputs must use the Step 15 range 0.90-1.10 with step 0.01."
);
assert.match(
  leftBarSource,
  /updateYarnPly\(0,\s*\{\s*lengthScaleY:\s*Number\(e\.target\.value\)/,
  "the yarn length input must update Yarn 1."
);
assert.match(
  leftBarSource,
  /yarnPly\.followsFirst/,
  "additional yarns must show inherited geometry text."
);

const translationsSource = read("src/i18n/translations.js");
for (const key of ["yarnPly.firstLength", "yarnPly.followsFirst"]) {
  assert.match(
    translationsSource,
    new RegExp(`"${key}"`),
    `translations must include ${key}.`
  );
}

const textureSource = read("src/yarnTexture/yarnScanTexture.js");
assert.match(
  textureSource,
  /MIN_YARN_LENGTH_SCALE_Y\s*=\s*0\.9/,
  "normalization must keep the lower yarn length bound at 0.90."
);
assert.match(
  textureSource,
  /MAX_YARN_LENGTH_SCALE_Y\s*=\s*1\.1/,
  "normalization must keep the upper yarn length bound at 1.10."
);
assert.match(
  textureSource,
  /lengthScaleY:\s*clampYarnLengthScaleY/,
  "yarn ply normalization must preserve and clamp lengthScaleY."
);

const importerSource = read("src/actions/importers.js");
assert.match(
  importerSource,
  /normalizeYarnPly/,
  "JSON import must normalize yarnPlies and lengthScaleY."
);
assert.match(
  importerSource,
  /DEFAULT_YARN_PLIES/,
  "JSON import must fall back to DEFAULT_YARN_PLIES for older files."
);

const exporterSource = read("src/actions/exporters.js");
assert.match(
  exporterSource,
  /yarnPlies:\s*GLOBAL_STATE\.yarnPlies/,
  "JSON export must persist yarnPlies, including lengthScaleY."
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function patternFixture(yarnPlies) {
  const fixture = {
    width: 8,
    height: 10,
    yarnPalette: ["rgba(190,190,190,1)"],
    yarnSequence: { width: 1, height: 1, pixels: [0] },
    repeats: [
      {
        bitmap: { width: 2, height: 2, pixels: [0, 0, 0, 0] },
        pos: [0, 0],
        area: [8, 10],
      },
    ],
  };

  if (yarnPlies) fixture.yarnPlies = yarnPlies;
  return fixture;
}

function assertYarnLengthValues(actual, expected, messagePrefix) {
  assert.equal(actual.length, 2, `${messagePrefix}: two yarn plies expected.`);
  for (let index = 0; index < 2; index++) {
    assert.equal(
      actual[index].lengthScaleY,
      expected[index],
      `${messagePrefix}: yarn ${index + 1} lengthScaleY should match.`
    );
  }
}

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  globalThis.devicePixelRatio = 1;
  globalThis.Path2D = class {
    moveTo() {}
    lineTo() {}
    quadraticCurveTo() {}
    closePath() {}
    rect() {}
  };
  globalThis.window = {};
  globalThis.document = {
    getElementById() {
      return {
        getBoundingClientRect() {
          return { width: 1200, height: 800 };
        },
      };
    },
  };

  const constants = await server.ssrLoadModule("/src/constants.js");
  const state = await server.ssrLoadModule("/src/state.js");
  const importers = await server.ssrLoadModule("/src/actions/importers.js");
  const { normalizeYarnPly } = await server.ssrLoadModule(
    "/src/yarnTexture/yarnScanTexture.js"
  );

  assertYarnLengthValues(
    constants.DEFAULT_YARN_PLIES,
    [1, 1],
    "DEFAULT_YARN_PLIES"
  );
  assertYarnLengthValues(
    state.GLOBAL_STATE.yarnPlies,
    [1, 1],
    "initial GLOBAL_STATE.yarnPlies"
  );

  importers.loadJSON(patternFixture());
  assertYarnLengthValues(
    state.GLOBAL_STATE.yarnPlies,
    [1, 1],
    "old JSON without yarnPlies fallback"
  );

  const customPlies = clone(constants.DEFAULT_YARN_PLIES);
  customPlies[0].lengthScaleY = 1.08;
  customPlies[1].lengthScaleY = 0.94;
  importers.loadJSON(patternFixture(customPlies));
  assertYarnLengthValues(
    state.GLOBAL_STATE.yarnPlies,
    [1.08, 0.94],
    "new JSON custom lengthScaleY"
  );

  const clampedLow = normalizeYarnPly(
    { ...constants.DEFAULT_YARN_PLIES[0], lengthScaleY: 0.2 },
    constants.DEFAULT_YARN_PLIES[0]
  );
  const clampedHigh = normalizeYarnPly(
    { ...constants.DEFAULT_YARN_PLIES[1], lengthScaleY: 2 },
    constants.DEFAULT_YARN_PLIES[1]
  );
  assert.equal(clampedLow.lengthScaleY, 0.9, "lengthScaleY must clamp low.");
  assert.equal(clampedHigh.lengthScaleY, 1.1, "lengthScaleY must clamp high.");

  importers.newPattern();
  assertYarnLengthValues(
    state.GLOBAL_STATE.yarnPlies,
    [1, 1],
    "newPattern reset"
  );
} finally {
  await server.close();
}

console.log("PASS: Step 15 yarn length parameter chain is valid.");
