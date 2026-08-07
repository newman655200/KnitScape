import assert from "node:assert/strict";
import { createServer } from "vite";

globalThis.devicePixelRatio = 1;

const pathData = [];
globalThis.Path2D = class Path2D {
  constructor(data = "") {
    this.data = data;
    pathData.push(data);
  }
};

function createContext() {
  return {
    clearRect() {},
    save() {},
    restore() {},
    stroke() {},
    createPattern() {
      return null;
    },
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    lineCap: "round",
    lineJoin: "round",
    lineWidth: 1,
    strokeStyle: "#000",
  };
}

const canvases = new Map(
  ["back", "mid", "front"].map((id) => [
    id,
    {
      id,
      width: 0,
      height: 0,
      style: {},
      getContext: () => createContext(),
    },
  ])
);

const documentFixture = {
  getElementById(id) {
    if (id === "sim-container") {
      return { getBoundingClientRect: () => ({ width: 320, height: 240 }) };
    }
    return canvases.get(id);
  },
};

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
globalThis.document = documentFixture;

try {
  const [{ simulate }, { Bimp }, constants] = await Promise.all([
    server.ssrLoadModule("/src/simulation/yarnSimulation.js"),
    server.ssrLoadModule("/src/lib/Bimp.js"),
    server.ssrLoadModule("/src/constants.js"),
  ]);

  const result = simulate(
    Bimp.empty(4, 8, 0),
    new Bimp(1, 8, Array(8).fill(0)),
    ["#cc3366"],
    1,
    constants.DEFAULT_YARN_PLIES,
    {
      machineGauge: 7,
      texturePerformanceMode: constants.TEXTURE_PERFORMANCE_MODES.SOLID,
    }
  );
  result.stopSim();

  assert.equal(result.yarnLengthMetrics.gauge, 7);
  assert.equal(
    result.yarnLengthMetrics.needlePitchMm,
    3.6285714285714286
  );
  assert.ok(
    Math.abs(
      result.yarnLengthMetrics.totalPathLengthStitchUnits -
        94.76508273180484
    ) < 1e-9
  );
  assert.equal(result.yarnLengthMetrics.effectiveLoopCount, 32);
  assert.ok(
    Math.abs(result.yarnLengthMetrics.cmPer100Loops - 107.45683488338587) <
      1e-9
  );
  assert.equal(pathData.length, 195);
  assert.equal(new Set(pathData.filter(Boolean)).size, 195);
  for (const canvas of canvases.values()) {
    assert.deepEqual([canvas.width, canvas.height], [320, 240]);
  }
} finally {
  await server.close();
}

console.log("PASS: yarn simulation matches the pre-refactor fixture.");
