import assert from "node:assert/strict";
import fs from "node:fs";

const packageJSON = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(
  packageJSON.scripts["validate:sim-wheel-performance"],
  "node scripts/validate-simulation-wheel-performance.mjs",
  "package.json must expose validate:sim-wheel-performance."
);

const pointerSource = fs.readFileSync(
  "src/events/simulationPointerInteraction.js",
  "utf8"
);
const simulationViewSource = fs.readFileSync(
  "src/components/runSimulation.js",
  "utf8"
);
const cssSource = fs.readFileSync("styles.css", "utf8");

assert.doesNotMatch(
  pointerSource,
  /zoomSimulationAtPoint\(/,
  "mouse-wheel zoom must not dispatch immediate simulation redraws."
);
assert.match(
  pointerSource,
  /SIM_WHEEL_IDLE_MS/,
  "mouse-wheel zoom must debounce the expensive redraw until wheel idle."
);
assert.match(
  pointerSource,
  /applyWheelPreviewTransform/,
  "mouse-wheel zoom must apply a lightweight CSS preview transform."
);
assert.match(
  pointerSource,
  /commitWheelPreviewZoom/,
  "mouse-wheel zoom must commit the final scale and pan after wheel idle."
);
assert.match(
  pointerSource,
  /e\.preventDefault\(\)/,
  "mouse-wheel zoom must prevent page-level scroll while previewing zoom."
);
assert.match(
  simulationViewSource,
  /id="sim-transform-group"/,
  "simulation preview canvases must be wrapped in a stable transform group."
);
assert.match(
  cssSource,
  /#sim-transform-group/,
  "simulation transform group must have CSS transform rules."
);
assert.match(
  cssSource,
  /transform-origin:\s*0 0/,
  "simulation preview transform must anchor at the top-left canvas origin."
);

console.log("PASS: simulation wheel zoom avoids immediate redraws.");
