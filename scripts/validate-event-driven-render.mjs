import assert from "node:assert/strict";
import fs from "node:fs";

const indexSource = fs.readFileSync("src/index.js", "utf8");
assert.doesNotMatch(
  indexSource,
  /requestAnimationFrame\(r\)/,
  "index.js must not keep a permanent render loop."
);
assert.match(
  indexSource,
  /createAppRenderer\(\{/,
  "index.js must create the state-driven application renderer."
);

const { createAppRenderer } = await import(
  "../src/components/renderApp.js"
);
const queuedFrames = [];
let renderCount = 0;
const renderer = createAppRenderer({
  renderView: () => {
    renderCount += 1;
  },
  requestFrame: (callback) => {
    queuedFrames.push(callback);
    return queuedFrames.length;
  },
});

renderer.renderInitial();
assert.equal(renderCount, 1, "startup must render synchronously once.");

renderer.syncState({}, ["chart"]);
renderer.syncState({}, ["yarnPalette"]);
assert.equal(queuedFrames.length, 1, "state bursts must share one frame.");
assert.equal(renderCount, 1, "queued rendering must not run synchronously.");

queuedFrames.shift()();
assert.equal(renderCount, 2, "the queued frame must render once.");

renderer.syncState({}, ["language"]);
assert.equal(queuedFrames.length, 1, "a later change must queue a new frame.");

console.log("PASS: root rendering is state-driven and frame-coalesced.");
