import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';

// Characterization, not a proposed companion/mask policy. Run real simulation,
// resolver and draw code; observe draw calls without comparing GPU pixels.
globalThis.devicePixelRatio = 1;
globalThis.Path2D = class { constructor(data) { this.data = data; } };
globalThis.window = { location: { search: '' }, setTimeout, clearTimeout };
const observed = globalThis.__rendererBoundary = { draws: [], masks: [] };
function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, `Observer seam changed: ${before}`);
  return source.replace(before, after);
}
const server = await createServer({ appType: 'custom', logLevel: 'silent',
  server: { middlewareMode: true }, plugins: [{ name: 'renderer-boundary-observer', enforce: 'pre',
    transform(source, id) {
      if (!id.replaceAll('\\', '/').endsWith('/src/simulation/drawYarnSimulation.js')) return;
      source = replaceOnce(source, 'export function drawYarnSimulation(', 'function observedDraw(');
      source = replaceOnce(source, 'drawYarnTexturePath(context, path, rowPly, stitchWidth, {',
        `globalThis.__rendererBoundary.draws.push({ link: link.index, row: link.row, yarnIndex,
          companion: ply !== activeYarnPlies[0], material: rowPly });
        drawYarnTexturePath(context, path, rowPly, stitchWidth, {`);
      source = replaceOnce(source, 'renderer.drawStrip(command.strip, command.ply);',
        `globalThis.__rendererBoundary.draws.push({ link: link.index, row: link.row, yarnIndex,
          companion: ply !== activeYarnPlies[0], material: command.ply });
        renderer.drawStrip(command.strip, command.ply);`);
      return source + '\nexport function drawYarnSimulation(args) { globalThis.__rendererBoundary.args = args; return observedDraw(args); }';
    },
  }] });

function canvas() {
  const context = { clearRect() {}, save() {}, restore() {}, drawImage() {},
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    stroke(path) {
      if (this.globalCompositeOperation === 'multiply') observed.masks.push({
        path: path.data, color: this.strokeStyle, alpha: this.globalAlpha,
      });
    } };
  const element = { width: 320, height: 240, style: {}, getContext(type) {
    if (type === '2d') return context;
    return element.gl ??= new Proxy({ canvas: element,
      createShader: () => ({}), createProgram: () => ({}), createTexture: () => ({}), createBuffer: () => ({}),
      getShaderParameter: () => true, getProgramParameter: () => true,
      getAttribLocation: () => 0, getUniformLocation: (_, name) => name,
    }, { get(target, key) { return key in target ? target[key] : /^[A-Z_0-9]+$/.test(key) ? 1 : () => {}; } });
  } };
  return element;
}
const canvases = new Map(['back', 'mid', 'front'].map(name => [name, canvas()]));
globalThis.document = { createElement: canvas, getElementById(id) {
  return canvases.get(id) ?? { getBoundingClientRect: () => ({ width: 320, height: 240 }) };
} };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

try {
  const [{ simulate }, { drawYarnSimulation }, { resolveYarnMaterial }, { Bimp },
    { resolveSingleJerseyOperations }, { createSingleJerseySimulationInput }, { YARN_PBR_MAP_KEYS }] =
    await Promise.all(['/src/simulation/yarnSimulation.js', '/src/simulation/drawYarnSimulation.js',
      '/src/domain/yarnMaterial.js', '/src/lib/Bimp.js', '/src/domain/singleJerseyMachine.js',
      '/src/adapters/singleJerseySimulationInput.js', '/src/yarnTexture/yarnScanTexture.js']
      .map(file => server.ssrLoadModule(file)));
  const machine = { tracks: [['K']] }, arrangement = [1];
  const chart = createSingleJerseySimulationInput(resolveSingleJerseyOperations(machine, arrangement, 4, 4));
  const palette = ['#cc0000', '#00cc00'];
  const primary = { color: '#123456', diameter: .24, enabled: true, texture: null };
  const companion = { color: '#654321', diameter: .14, enabled: true, texture: null };
  // Synthetic software fixtures: .24/.14 model needle pitch; repeat 12 mm is
  // arbitrary test input, not a scan-derived or measured physical property.
  const map = { dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=' };
  const variants = {
    A_metadata: {}, B_color: { color: '#abcdef' }, C_diameter: { diameter: .24 },
    D_map: { pbr: { normal: map } }, E_repeat: { pbr: { physicalRepeatLengthMm: 12 } },
    F_full: { color: '#abcdef', diameter: .24,
      pbr: { ...Object.fromEntries(YARN_PBR_MAP_KEYS.map(key => [key, map])), physicalRepeatLengthMm: 12 } },
  };
  const rows = [];
  function run(label, kinds, { enabled = true, neutral = false, legacy = false } = {}) {
    const assets = kinds.map((kind, index) => ({ id: String(index), name: `fixture-${index}`, ...variants[kind] }));
    const feeds = legacy ? null : [{ yarns: assets.map(asset => ({ yarnId: asset.id,
      yarnLengthCmPer100Needles: 0, tensionCN: null, placement: 'parallel' })) }];
    const sequence = Bimp.empty(1, 4, neutral ? 0 : 1);
    const plies = [primary, { ...companion, enabled }];
    const input = () => JSON.stringify({ machine, arrangement, chart, sequence, palette, feeds, assets, plies });
    const before = input();
    observed.draws = []; observed.masks = [];
    const result = simulate(chart, sequence, palette, 1, plies,
      { machineGauge: 32, feeds, yarnLibrary: assets, texturePerformanceMode: 'solid' });
    result.stopSim();
    const args = observed.args, canvasDraws = observed.draws.slice(), maskCalls = observed.masks.length;
    assert.ok(args.yarnPathLinks.length && canvasDraws.length, 'Non-empty test scene');
    const identityCount = feeds?.[0].yarns.length ?? 0;
    const resolved = args.feedYarnPlies.get(0) ?? [];
    assert.equal(resolved.length, identityCount);
    assert.equal(args.yarnStrands.length, Math.max(1, identityCount));
    for (const link of args.yarnPathLinks) {
      assert.deepEqual(canvasDraws.filter(draw => draw.link === link.index && !draw.companion)
        .map(draw => draw.yarnIndex), Array.from({ length: Math.max(1, identityCount) }, (_, i) => i),
      'Every explicit slot must draw, independently of material metadata');
    }
    // Force the existing UV draw branch on identical input, including no-map
    // cases. This tests its decisions, not automatic GPU selection or pixels.
    observed.draws = []; observed.masks = [];
    drawYarnSimulation({ ...args, renderTextures: true, renderUvTextures: true });
    const uvDraws = observed.draws;
    const signature = draws => draws.map(d => [d.link, d.yarnIndex, d.companion, d.material.sequenceMaskColor ?? null]);
    assert.deepEqual(signature(uvDraws), signature(canvasDraws), 'Canvas/UV draw decisions agree');
    assert.equal(maskCalls > 0, canvasDraws.some(d => Boolean(d.material.sequenceMaskColor)));
    assert.equal(input(), before, 'Material/render processing must not mutate project inputs');
    const oneLink = canvasDraws.filter(d => d.link === args.yarnPathLinks[0].index);
    const row = { label, kinds, assignmentCount: identityCount, yarnIds: assets.map(a => a.id),
      resolvedYarnCount: resolved.length, geometryStrandCount: args.yarnStrands.length,
      renderedPassesPerLink: oneLink.length,
      legacyCompanionVisible: oneLink.some(d => d.companion),
      sequenceMaskApplied: oneLink.map(d => Boolean(d.material.sequenceMaskColor)),
      assetMaterial: resolved.map(ply => Boolean(ply.assetMaterial)),
      materialSource: assets.map(yarnAsset => resolveYarnMaterial({ yarnAsset, legacyContext: primary }).source),
      canvasDrawCalls: canvasDraws.length, uvDrawCalls: uvDraws.length, canvasMaskBatchCalls: maskCalls,
      topologyHash: hash(args.yarnPathLinks.map(link => [link.index, link.row, link.layer])),
      geometryHash: hash(args.yarnStrands.map(strand => [...strand.modelPathByLink])),
      previewMetric: result.yarnLengthMetrics, solverResults: result.yarnLengthSolverResults };
    rows.push(row);
    return row;
  }
  for (const kind of Object.keys(variants)) run(`single-${kind}`, [kind]);
  for (const first of Object.keys(variants)) for (const second of Object.keys(variants))
    run(`double-${first}-${second}`, [first, second]);
  run('legacy-only-active', [], { legacy: true });
  run('legacy-only-neutral', [], { legacy: true, neutral: true });
  run('single-no-companion', ['A_metadata'], { enabled: false });
  run('double-no-companion', ['A_metadata', 'F_full'], { enabled: false });
  run('single-neutral-metadata', ['A_metadata'], { neutral: true });
  run('single-neutral-full', ['F_full'], { neutral: true });
  const singles = rows.slice(0, 6), doubles = rows.slice(6, 42);
  for (const row of rows) assert.equal(row.topologyHash, singles[0].topologyHash);
  for (const row of singles) {
    assert.equal(row.geometryHash, singles[0].geometryHash, 'Same effective diameter preserves geometry');
    assert.deepEqual(row.previewMetric, singles[0].previewMetric);
  }
  for (const row of doubles) {
    assert.equal(row.geometryHash, doubles[0].geometryHash);
    assert.deepEqual(row.previewMetric, doubles[0].previewMetric);
  }
  const output = { testType: 'CHARACTERIZATION_NOT_MIGRATION_POLICY',
    gpuPixelsTested: false, realSecondYarnProven: false,
    fixture: { width: 4, height: 4, machine, arrangement, palette, primary, companion,
      diameter: { value: .24, unit: 'MODEL_NEEDLE_PITCH', source: 'synthetic test fixture',
        principle: 'Hold effective diameter constant to isolate material presence',
        confidence: 'software-only', applicableState: '4x4 uncalibrated model' } }, rows };
  const destination = process.argv.find(arg => arg.startsWith('--output='))?.slice('--output='.length);
  if (destination) writeFileSync(destination, JSON.stringify(output, null, 2) + '\n');
  console.log(`PASS: ${rows.length} cases; all explicit slots draw; Canvas/UV decisions agree; same-diameter geometry unchanged.`);
  console.log('Observed single-assignment metadata matrix (not a normative expectation):');
  console.table(singles.map(row => ({ case: row.label, assignments: row.assignmentCount,
    resolved: row.resolvedYarnCount, geometry: row.geometryStrandCount,
    drawsPerLink: row.renderedPassesPerLink, companion: row.legacyCompanionVisible,
    mask: row.sequenceMaskApplied.join(',') })));
} finally {
  await server.close();
  delete globalThis.__rendererBoundary;
}
