import assert from "node:assert/strict";
import { createServer } from "vite";

globalThis.devicePixelRatio = 1;
globalThis.Path2D ??= class Path2D {};
globalThis.window = { location: { search: "" } };
const server = await createServer({ appType: "custom", logLevel: "silent",
  server: { middlewareMode: true } });
let passed = 0;
const failures = [];
async function check(name, run) {
  try { await run(); passed++; console.log(`PASS: ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL: ${name}\n${error.stack}`); }
}
function near(actual, expected, epsilon = 1e-8) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < epsilon,
    `${actual} != ${expected}`);
}

try {
  const state = await server.ssrLoadModule("/src/state.js");
  const { loadJSON, loadProjectFile } = await server.ssrLoadModule("/src/actions/importers.js");
  const { getProjectData } = await server.ssrLoadModule("/src/actions/exporters.js");
  const { createProjectPackage, readProjectPackage } = await server.ssrLoadModule("/src/actions/projectPackage.js");
  const { yarnAssetRegistry } = await server.ssrLoadModule("/src/yarnTexture/yarnAssetRegistry.js");
  const { yarnLengthReadout } = await server.ssrLoadModule("/src/views/yarnLengthReadout.js");
  const metrics = await server.ssrLoadModule("/src/simulation/yarnLengthMetrics.js");
  const { buildYarnPathGeometry } = await server.ssrLoadModule("/src/simulation/yarnPathGeometry.js");
  const { solveFeedYarnLengths } = await server.ssrLoadModule("/src/simulation/yarnLengthSolver.js");
  const { buildYarnUvStrip } = await server.ssrLoadModule("/src/simulation/yarnPathUvStrip.js");
  const { Bimp } = await server.ssrLoadModule("/src/lib/Bimp.js");
  const { Pattern } = await server.ssrLoadModule("/src/simulation/Pattern.js");
  const { ProcessModel } = await server.ssrLoadModule("/src/simulation/ProcessModel.js");
  const { YarnModel } = await server.ssrLoadModule("/src/simulation/YarnModel.js");
  globalThis.document = { getElementById: () => ({
    getBoundingClientRect: () => ({ width: 640, height: 480 }),
  }) };
  const project = gauge => ({ width: 4, height: 4,
    repeats: [{ bitmap: { width: 1, height: 1, pixels: [0] }, pos: [0, 0], area: [4, 4] }],
    singleJerseyCamProgram: null, needleArrangement: [], machineGauge: gauge });
  function geometry(gauge, modelLoopHeight = 0.6, includeSummaryMetrics = true) {
    const pattern = Bimp.empty(4, 4, 0);
    const stitchPattern = new Pattern(pattern.pad(1, 0, 0));
    return buildYarnPathGeometry({ pattern, stitchPattern,
      yarnGraph: new YarnModel(new ProcessModel(stitchPattern).cn),
      canvasWidth: 640, canvasHeight: 480, primaryLengthScaleY: 1,
      primaryYarnDiameter: 0.24, machineGauge: gauge, modelLoopHeight, includeSummaryMetrics });
  }
  function templateValue(template, marker) {
    const index = template.strings.findIndex(text => text.endsWith(marker));
    assert.notEqual(index, -1, `Template binding ${marker}`);
    return template.values[index];
  }
  function uiGauge() { return Number(templateValue(yarnLengthReadout(), ".value=")); }
  if (process.argv.includes("--reproduce")) {
    for (const input of [32, 120, 121, 240, 0.5]) {
      loadJSON(project(input));
      const result = { input, state: state.GLOBAL_STATE.machineGauge,
        exported: getProjectData().machineGauge, ui: uiGauge(),
        effective: metrics.normalizeMachineGauge(input),
        geometry: geometry(input).yarnLengthMetrics.gauge,
        pitchMm: metrics.gaugeToNeedlePitchMm(input) };
      console.log(JSON.stringify(result));
      assert.equal(result.state, input);
      assert.equal(result.exported, input);
      assert.equal(result.effective, Math.max(1, Math.min(120, input)));
    }
  } else {
    for (const gauge of [1, 32, 32.5, 120]) {
      await check(`${gauge}: import -> State -> UI -> geometry -> Solver -> UV -> export`, async () => {
        loadJSON(project(gauge));
        assert.equal(state.GLOBAL_STATE.machineGauge, gauge);
        assert.equal(uiGauge(), gauge);
        assert.equal(getProjectData().machineGauge, gauge);
        const built = geometry(gauge);
        assert.equal(built.yarnLengthMetrics.gauge, gauge);
        near(built.yarnLengthMetrics.needlePitchMm, 25.4 / gauge);
        assert.ok(built.yarnLengthMetrics.cmPer100Loops > 0);
        const modelLengths = [...built.measuredModelLengthPer100NeedlesByCourse.values()];
        const measured = modelLengths.reduce((a, b) => a + b) / modelLengths.length;
        const targetCm = measured * 25.4 / gauge / 10;
        const [solved] = solveFeedYarnLengths({ gauge,
          feeds: [{ yarns: [{ yarnLengthCmPer100Needles: targetCm }] }],
          buildGeometry: height => geometry(gauge, height, false) });
        assert.equal(solved.status, "CONVERGED");
        near(solved.targetModelLengthPer100Needles, measured);
        near(solved.solvedLengthCmPer100Needles, solved.solvedModelLengthPer100Needles * 25.4 / gauge / 10);
        const uv = buildYarnUvStrip({ pathData: "M 0 0 L 10 0", yarnWidth: 0.2,
          physicalRepeatLengthMm: 10, machineGauge: gauge });
        near(uv.uvs.at(-2), 25.4 / gauge, 1e-6);
        assert.ok([...uv.positions, ...uv.uvs].every(Number.isFinite));
        const packed = await createProjectPackage(getProjectData());
        const opened = await readProjectPackage(packed);
        assert.equal(opened.project.machineGauge, gauge);
        loadJSON(opened.project, opened.registry);
        assert.equal(state.GLOBAL_STATE.machineGauge, gauge);
        await loadProjectFile(new File([JSON.stringify(project(gauge))], "gauge.json"));
        assert.equal(state.GLOBAL_STATE.machineGauge, gauge);
      });
    }
    for (const gauge of [121, 240, 0.5, 0, -1, NaN, Infinity, "32", null, undefined]) {
      await check(`reject explicit ${typeof gauge}:${String(gauge)} atomically at import/dispatch/workspace`, async () => {
        loadJSON(project(32));
        for (const write of [() => loadJSON(project(gauge)),
          () => state.dispatch({ machineGauge: gauge, width: 999 }),
          () => state.loadWorkspace({ machineGauge: gauge, width: 999 })]) {
          const before = state.GLOBAL_STATE;
          assert.throws(write, /Gauge/i);
          assert.equal(state.GLOBAL_STATE, before);
          assert.equal(getProjectData().machineGauge, 32);
        }
      });
    }
    for (const gauge of [121, 240]) {
      await check(`${gauge}: JSON/package rejection preserves current state and binary registry`, async () => {
        loadJSON(project(32));
        const blob = new Blob(["existing asset"], { type: "image/png" });
        const ref = yarnAssetRegistry.register(blob);
        const input = { ...getProjectData(), machineGauge: gauge, yarnLibrary: [] };
        const packed = await createProjectPackage(input);
        for (const file of [new File([JSON.stringify(input)], "invalid.json"),
          new File([packed], "invalid.knitscape")]) {
          const before = state.GLOBAL_STATE;
          await assert.rejects(loadProjectFile(file), /Gauge/i);
          assert.equal(state.GLOBAL_STATE, before);
          assert.equal(await yarnAssetRegistry.getBlob(ref), blob);
        }
        yarnAssetRegistry.release(ref);
      });
    }
    await check("explicit Gauge is validated/applied independent of Cam; omission retains Gauge", () => {
      for (const cam of [null, { tracks: [["K"]] }, undefined]) {
        const input = project(32);
        if (cam === undefined) delete input.singleJerseyCamProgram;
        else input.singleJerseyCamProgram = cam;
        loadJSON(input);
        assert.throws(() => loadJSON({ ...input, machineGauge: 240 }), /Gauge/i);
        loadJSON({ ...input, machineGauge: 64 });
        assert.equal(state.GLOBAL_STATE.machineGauge, 64);
        delete input.machineGauge;
        loadJSON(input);
        assert.equal(state.GLOBAL_STATE.machineGauge, 64);
      }
    });
    await check("normalization never clamps or substitutes explicit invalid Gauge", () => {
      assert.equal(metrics.normalizeMachineGauge(), 32);
      assert.equal(metrics.normalizeMachineGauge("32"), 32);
      for (const gauge of [121, 240, 0.5, 0, -1, NaN, Infinity, "bad", "", null, true]) {
        assert.throws(() => metrics.normalizeMachineGauge(gauge), /Gauge/i);
        assert.throws(() => metrics.gaugeToNeedlePitchMm(gauge), /Gauge/i);
        assert.throws(() => geometry(gauge, 0.6, false), /Gauge/i);
        assert.throws(() => solveFeedYarnLengths({ gauge, feeds: [{ yarns: [] }],
          buildGeometry: () => { throw new Error("must reject Gauge before geometry"); } }), /Gauge/i);
      }
    });
    await check("UI rejects 240 visibly, keeps canonical 32, accepts correction and decimals", () => {
      loadJSON(project(32));
      const input = { value: "240", message: "", reports: 0,
        setCustomValidity(message) { this.message = message; },
        reportValidity() { this.reports++; } };
      const change = templateValue(yarnLengthReadout(), "@change=");
      change({ target: input });
      assert.equal(state.GLOBAL_STATE.machineGauge, 32);
      assert.match(input.message, /Gauge/i);
      assert.equal(input.reports, 1);
      input.value = "32.5";
      change({ target: input });
      assert.equal(input.message, "");
      assert.equal(state.GLOBAL_STATE.machineGauge, 32.5);
      assert.equal(uiGauge(), 32.5);
    });
    await check("UI pitch follows current canonical Gauge even with stale preview metrics", () => {
      state.dispatch({ machineGauge: 32, yarnLengthMetrics: { needlePitchMm: 25.4 / 64 } });
      assert.ok(yarnLengthReadout().values.includes("0.794"));
    });
    console.log(`${passed}/${passed + failures.length} Gauge authority cases passed.`);
    if (failures.length) process.exitCode = 1;
  }
} finally { await server.close(); }
