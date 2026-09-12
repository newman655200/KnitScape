import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

const read = (file) => fs.readFileSync(file, "utf8");
const chartEditorToolbarSource = fs.readFileSync(
  "src/views/chartEditorToolbar.js",
  "utf8"
);
const repeatToolsSource = read("src/views/repeatTools.js");
const repeatEditingToolsSource = read("src/actions/repeatEditingTools.js");
const constantsSource = read("src/constants.js");
const translationsSource = read("src/i18n/translations.js");
const uiButtonSource = read("src/views/uiButton.js");

for (const retainedToken of [
  "repeat.width",
  "repeat.height",
  "repeatTools.brush",
  "repeat.exit",
]) {
  assert.match(
    repeatToolsSource,
    new RegExp(retainedToken.replace(".", "\\.")),
    `repeat toolbar must retain ${retainedToken}.`
  );
}
assert.equal(
  (repeatToolsSource.match(/<button/g) || []).length,
  2,
  "repeat toolbar must contain only brush and exit buttons."
);
for (const removedToken of [
  "repeat.delete",
  "repeatTools.delete",
  "repeatTools.flood",
  "repeatTools.line",
  "repeatTools.rect",
]) {
  assert.doesNotMatch(
    repeatToolsSource,
    new RegExp(removedToken.replace(".", "\\.")),
    `repeat toolbar must remove ${removedToken}.`
  );
  assert.doesNotMatch(
    translationsSource,
    new RegExp(`"${removedToken.replace("repeat.", "repeatTools\\.")}"`),
    `translations must remove ${removedToken}.`
  );
}
assert.doesNotMatch(repeatEditingToolsSource, /function (flood|line|rect)\b/);
assert.doesNotMatch(constantsSource, /\b(flood|line|rect):\s*\{/);
assert.doesNotMatch(uiButtonSource, /^\s*(trash|fill|line|rect):/m);

assert.match(
  chartEditorToolbarSource,
  /resizeChartArea/,
  "central Width/Height controls should resize the whole chart area."
);
assert.match(
  chartEditorToolbarSource,
  /resizeChartArea\(width,\s*GLOBAL_STATE\.chart\.height/,
  "central Width control should resize the whole chart area without changing the repeat unit."
);
assert.match(
  chartEditorToolbarSource,
  /resizeChartArea\(GLOBAL_STATE\.chart\.width,\s*height/,
  "central Height control should resize the whole chart area without changing the repeat unit."
);

globalThis.Path2D = class {
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  closePath() {}
  rect() {}
};

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const stateModule = await server.ssrLoadModule("/src/state.js");
  const { resizeChartArea, resizeRepeatBitmap } = await server.ssrLoadModule(
    "/src/actions/repeatDimensions.js"
  );
  const { repeatEditingTools } = await server.ssrLoadModule(
    "/src/actions/repeatEditingTools.js"
  );

  assert.deepEqual(
    Object.keys(repeatEditingTools),
    ["brush"],
    "brush must be the only repeat editing tool."
  );

  resizeChartArea(60, 80);

  const repeat = stateModule.GLOBAL_STATE.repeats[0];

  assert.equal(
    repeat.bitmap.width,
    4,
    "top Width input should not change the repeat unit width."
  );
  assert.equal(
    repeat.bitmap.height,
    4,
    "top Height input should not change the repeat unit height."
  );
  assert.deepEqual(
    repeat.area,
    [60, 80],
    "repeat control area should follow the top Width and Height inputs."
  );
  assert.equal(
    stateModule.GLOBAL_STATE.chart.width,
    60,
    "chart width should follow the repeat control area."
  );
  assert.equal(
    stateModule.GLOBAL_STATE.chart.height,
    80,
    "chart height should follow the repeat control area."
  );

  resizeRepeatBitmap(0, 6, 10);

  assert.equal(
    stateModule.GLOBAL_STATE.repeats[0].bitmap.width,
    6,
    "repeat unit Width input should change the repeat unit width."
  );
  assert.equal(
    stateModule.GLOBAL_STATE.repeats[0].bitmap.height,
    10,
    "repeat unit Height input should change the repeat unit height."
  );
  assert.deepEqual(
    stateModule.GLOBAL_STATE.repeats[0].area,
    [60, 80],
    "repeat unit resize should keep the whole chart area unchanged."
  );
  assert.equal(
    stateModule.GLOBAL_STATE.chart.width,
    60,
    "repeat unit resize should keep chart width unchanged."
  );
  assert.equal(
    stateModule.GLOBAL_STATE.chart.height,
    80,
    "repeat unit resize should keep chart height unchanged."
  );

  console.log("PASS: chart Width/Height and repeat unit dimensions stay separated.");
} finally {
  await server.close();
}
