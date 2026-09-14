import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

globalThis.Path2D ??= class Path2D {};

const modulePath = "src/simulation/needleExecution.js";
assert.ok(fs.existsSync(modulePath), "needle execution module must exist.");

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const [execution, { Bimp }] = await Promise.all([
    server.ssrLoadModule(`/${modulePath}`),
    server.ssrLoadModule("/src/lib/Bimp.js"),
  ]);

  const {
    buildArrangedChart,
    getNeedleTypeAtPosition,
    isNeedleArrangementValid,
    needleTypeToMatrixRow,
    resolveNeedleSymbol,
  } = execution;

  const camMatrix = new Bimp(4, 4, [
    0, 1, 2, 3,
    1, 1, 2, 0,
    2, 3, 0, 1,
    3, 0, 1, 2,
  ]);
  const arrangement = [1, 2, 2, 3, 3, 4];
  const baseChart = new Bimp(12, 5, Array.from({ length: 60 }, (_, i) => i % 4));
  const basePixelsBefore = Array.from(baseChart.pixels);
  const camPixelsBefore = Array.from(camMatrix.pixels);

  assert.equal(needleTypeToMatrixRow(1, 4), 0);
  assert.equal(needleTypeToMatrixRow(2, 4), 1);
  assert.equal(needleTypeToMatrixRow(4, 4), 3);
  assert.equal(needleTypeToMatrixRow(0, 4), null);
  assert.equal(needleTypeToMatrixRow(5, 4), null);

  assert.deepEqual(
    Array.from({ length: 12 }, (_, x) =>
      getNeedleTypeAtPosition(arrangement, x)
    ),
    [1, 2, 2, 3, 3, 4, 1, 2, 2, 3, 3, 4]
  );

  assert.equal(resolveNeedleSymbol(camMatrix, 1, 0), 0);
  assert.equal(resolveNeedleSymbol(camMatrix, 1, 1), 1);
  assert.equal(resolveNeedleSymbol(camMatrix, 1, 4), 0);
  assert.equal(resolveNeedleSymbol(camMatrix, 4, 0), 3);
  assert.equal(resolveNeedleSymbol(camMatrix, 4, 3), 2);

  const arrangedChart = buildArrangedChart({
    camMatrix,
    needleArrangement: arrangement,
    outputWidth: baseChart.width,
    outputHeight: baseChart.height,
  });
  assert.ok(arrangedChart instanceof Bimp);
  assert.equal(arrangedChart.width, baseChart.width);
  assert.equal(arrangedChart.height, baseChart.height);
  assert.deepEqual(arrangedChart.make2d(), [
    [0, 1, 1, 2, 2, 3, 0, 1, 1, 2, 2, 3],
    [1, 1, 1, 3, 3, 0, 1, 1, 1, 3, 3, 0],
    [2, 2, 2, 0, 0, 1, 2, 2, 2, 0, 0, 1],
    [3, 0, 0, 1, 1, 2, 3, 0, 0, 1, 1, 2],
    [0, 1, 1, 2, 2, 3, 0, 1, 1, 2, 2, 3],
  ]);
  assert.deepEqual(Array.from(baseChart.pixels), basePixelsBefore);
  assert.deepEqual(Array.from(camMatrix.pixels), camPixelsBefore);

  const eightColumnCamMatrix = new Bimp(8, 4, [
    0, 1, 2, 3, 3, 2, 1, 0,
    1, 1, 2, 0, 0, 2, 1, 3,
    2, 3, 0, 1, 1, 0, 3, 2,
    3, 0, 1, 2, 2, 1, 0, 3,
  ]);
  const eightColumnResult = buildArrangedChart({
    camMatrix: eightColumnCamMatrix,
    needleArrangement: arrangement,
    outputWidth: 6,
    outputHeight: 9,
  });
  assert.deepEqual(eightColumnResult.make2d(), [
    [0, 1, 1, 2, 2, 3],
    [1, 1, 1, 3, 3, 0],
    [2, 2, 2, 0, 0, 1],
    [3, 0, 0, 1, 1, 2],
    [3, 0, 0, 1, 1, 2],
    [2, 2, 2, 0, 0, 1],
    [1, 1, 1, 3, 3, 0],
    [0, 3, 3, 2, 2, 3],
    [0, 1, 1, 2, 2, 3],
  ]);

  function assertArbitraryMatrix(width, height, needleArrangement) {
    const matrix = new Bimp(
      width,
      height,
      Array.from({ length: width * height }, (_, i) => i % 4)
    );
    const result = buildArrangedChart({
      camMatrix: matrix,
      needleArrangement,
      outputWidth: 17,
      outputHeight: 13,
    });
    assert.ok(result instanceof Bimp);
    assert.equal(result.width, 17);
    assert.equal(result.height, 13);
    assert.equal(isNeedleArrangementValid(needleArrangement, height), true);
  }

  assertArbitraryMatrix(8, 4, [1, 2, 2, 3, 3, 4]);
  assertArbitraryMatrix(8, 6, [1, 2, 6, 6, 5, 5]);
  assertArbitraryMatrix(12, 8, [1, 8, 3, 3, 4, 4, 2, 7]);
  assertArbitraryMatrix(6, 5, [1, 5, 5, 2, 3, 4]);

  const tenRowMatrix = new Bimp(
    3,
    10,
    Array.from({ length: 30 }, (_, i) => i % 4)
  );
  const typeTenArrangement = [1, 2, 2, 3, 10, 10, 4];
  assert.equal(isNeedleArrangementValid(typeTenArrangement, 10), true);
  assert.equal(needleTypeToMatrixRow(10, 10), 9);
  assert.ok(
    buildArrangedChart({
      camMatrix: tenRowMatrix,
      needleArrangement: typeTenArrangement,
      outputWidth: 14,
      outputHeight: 7,
    }) instanceof Bimp
  );

  for (const invalidArrangement of [[], [0, 1], [1, 5], [1, 2.5]]) {
    assert.equal(isNeedleArrangementValid(invalidArrangement, 4), false);
    assert.equal(
      buildArrangedChart({
        camMatrix,
        needleArrangement: invalidArrangement,
        outputWidth: 12,
        outputHeight: 5,
      }),
      null
    );
  }
} finally {
  await server.close();
}

const runSimulationSource = fs.readFileSync(
  "src/components/runSimulation.js",
  "utf8"
);
const drawRepeatsSource = fs.readFileSync(
  "src/components/drawRepeats.js",
  "utf8"
);
assert.match(drawRepeatsSource, /ctx\.translate\(x \* scale, y \* scale\)/);
assert.doesNotMatch(drawRepeatsSource, /repeat\.height\s*-\s*y/);
assert.match(runSimulationSource, /buildArrangedChart/);
assert.match(runSimulationSource, /isNeedleArrangementValid/);
assert.match(runSimulationSource, /GLOBAL_STATE\.repeats\[0\]\?\.bitmap/);
assert.match(runSimulationSource, /GLOBAL_STATE\.chart\.width/);
assert.match(runSimulationSource, /GLOBAL_STATE\.chart\.height/);
assert.match(
  runSimulationSource,
  /yarnLengthMetrics:\s*baseSimulationResult\.yarnLengthMetrics/
);
assert.doesNotMatch(runSimulationSource, /y\s*%\s*2/);

console.log(
  "PASS: needle execution maps needle type rows and cam cycle columns without mutating source data."
);
