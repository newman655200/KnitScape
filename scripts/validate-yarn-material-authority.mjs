import assert from 'node:assert/strict';
import { createServer } from 'vite';

// Browser drawing surfaces are doubles; domain, actions, solver, geometry and
// renderer execute production code. Browser E2E is recorded separately.
globalThis.devicePixelRatio = 1;
globalThis.Path2D = class { constructor(data) { this.data = data; } };
const timers = new Map();
let timer = 0;
globalThis.window = { location: { search: '' },
  setTimeout(fn) { timers.set(++timer, fn); return timer; },
  clearTimeout(id) { timers.delete(id); } };
const flush = () => { const jobs = [...timers.values()]; timers.clear(); jobs.forEach(fn => fn()); };
const observation = globalThis.__materialAudit = { draws: [], jobs: [], solves: 0, shaders: [] };
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true },
  plugins: [{ name: 'material-observers', enforce: 'pre', transform(source, id) {
    const file = id.replaceAll('\\', '/');
    if (file.endsWith('/src/simulation/yarnUvWebglRenderer.js')) return source.replace(
      'drawStrip(strip, material = {}) {', 'drawStrip(strip, material = {}) { globalThis.__materialAudit.draws.push({ strip, material });');
    if (file.endsWith('/src/simulation/yarnTextureBrush.js')) return source.replace(
      'export function prepareYarnTextureImages(', 'function observedPrepare(') +
      '\nexport function prepareYarnTextureImages(...args) { const job=observedPrepare(...args); globalThis.__materialAudit.jobs.push(job); return job; }';
    if (file.endsWith('/src/simulation/yarnLengthSolver.js')) return source.replace(
      'export function solveFeedYarnLengths(', 'function observedSolve(') +
      '\nexport function solveFeedYarnLengths(...args) { globalThis.__materialAudit.solves++; return observedSolve(...args); }';
  } }] });
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
globalThis.Image = class { naturalWidth = 1; naturalHeight = 1;
  set src(url) { fetch(url).then(r => r.arrayBuffer()).then(() => this.onload()); } };
function canvas() {
  const context = { clearRect() {}, save() {}, restore() {}, stroke() {}, drawImage() {}, createPattern: () => ({}), globalAlpha: 1 };
  const c = { width: 320, height: 240, style: {}, toDataURL: () => 'data:image/png;base64,' + pixel.toString('base64'),
    getContext(type) {
      if (type === '2d') return context;
      return c.gl ??= new Proxy({ canvas: c, createShader: () => ({}), createProgram: () => ({}),
        shaderSource(_, source) { observation.shaders.push(source); },
        createTexture: () => ({}), createBuffer: () => ({}), getShaderParameter: () => true,
        getProgramParameter: () => true, getAttribLocation: () => 0, getUniformLocation: (_, name) => name },
      { get(t, key) { return key in t ? t[key] : /^[A-Z_0-9]+$/.test(key) ? 1 : () => {}; } });
    } };
  return c;
}
const canvases = new Map(['back', 'mid', 'front', 'back-arranged', 'mid-arranged', 'front-arranged'].map(id => [id, canvas()]));
let desktopMeasurements = 0;
globalThis.document = { createTreeWalker: () => ({}), createElement: canvas,
  getElementById(id) { return canvases.get(id) || (id === 'desktop' || id.includes('container')
    ? { getBoundingClientRect() {
      if (id === 'desktop') desktopMeasurements++;
      return { width: 320, height: 240 };
    } } : { hidden: true, textContent: '' }); } };

try {
  const [library, brush, texture, { yarnAssetRegistry }, { simulate }, { Bimp }, state, actions, runner, codec, exporters, importers] = await Promise.all([
    '/src/domain/yarnLibrary.js', '/src/simulation/yarnTextureBrush.js', '/src/yarnTexture/yarnScanTexture.js',
    '/src/yarnTexture/yarnAssetRegistry.js', '/src/simulation/yarnSimulation.js', '/src/lib/Bimp.js',
    '/src/state.js', '/src/actions/yarnLibrary.js', '/src/components/runSimulation.js',
    '/src/actions/projectPackage.js', '/src/actions/exporters.js', '/src/actions/importers.js',
  ].map(path => server.ssrLoadModule(path)));
  const map = () => ({ assetRef: yarnAssetRegistry.register(new Blob([pixel], { type: 'image/png' })),
    mimeType: 'image/png', byteLength: pixel.length, fileName: 'fixture.png' });
  const asset = (id, color, diameter, repeat) => ({ ...library.createYarnAsset(id, id), color, diameter,
    pbr: { baseColor: map(), normal: map(), roughness: map(), ambientOcclusion: map(), metallic: map(), physicalRepeatLengthMm: repeat } });
  const A = asset('A', '#0000ff', 0.20, 42), B = asset('B', '#ff8800', 0.32, 65);
  const legacy = { color: '#ff0000', diameter: 0.40, enabled: true, lengthScaleY: 1, texture: null };
  const feed = (...ids) => ({ yarns: ids.map(yarnId => ({ yarnId, yarnLengthCmPer100Needles: 23, tensionCN: null, placement: 'parallel' })) });
  const plies = brush.resolveFeedYarnPlies([feed('A'), feed('B'), feed('A', 'B')], [A, B], legacy);
  assert.equal(plies.get(0)[0].color, A.color, 'CASE A: Asset color must override red Legacy');
  assert.equal(plies.get(0)[0].diameter, .20);
  assert.equal(plies.get(1)[0].color, B.color, 'CASE B');
  assert.equal(plies.get(1)[0].diameter, .32);
  for (const [index, item] of [A, B].entries()) {
    const ply = plies.get(2)[index];
    assert.equal(ply.color, item.color, 'CASE C: independent slot color');
    assert.equal(ply.diameter, item.diameter);
    assert.equal(ply.texture.pbr.baseColor.assetRef, item.pbr.baseColor.assetRef);
    assert.equal(ply.texture.pbr.metallic.assetRef, item.pbr.metallic.assetRef);
    assert.equal(ply.texture.pbr.physicalRepeatLengthMm, item.pbr.physicalRepeatLengthMm);
  }
  const { resolveYarnMaterial } = await server.ssrLoadModule('/src/domain/yarnMaterial.js');
  assert.equal(resolveYarnMaterial({ yarnAsset: A, legacyContext: legacy }).source.color, 'ASSET');
  assert.equal(resolveYarnMaterial({}).source.diameter, 'DEFAULT');
  const old = library.createYarnAsset('old', 'old');
  const fallback = resolveYarnMaterial({ yarnAsset: old, legacyContext: legacy });
  assert.equal(fallback.color, legacy.color, 'CASE D'); assert.equal(fallback.diameter, legacy.diameter);
  assert.equal(fallback.source.color, 'LEGACY_FALLBACK');
  // Diameter contract: source is software provenance, never evidence of measurement.
  const explicit = resolveYarnMaterial({ yarnAsset: A, legacyContext: legacy });
  assert.equal(explicit.diameterSource, 'ASSET_EXPLICIT');
  assert.equal(explicit.diameterUnit, 'MODEL_NEEDLE_PITCH');
  assert.equal(fallback.diameterSource, 'LEGACY_PRIMARY');
  const defaultMaterial = resolveYarnMaterial({ yarnAsset: old });
  assert.equal(defaultMaterial.diameter, .24);
  assert.equal(defaultMaterial.diameterSource, 'DEFAULT_COMPATIBILITY');
  for (const diameter of [.28, .36]) {
    const primary = { ...legacy, diameter };
    assert.equal(resolveYarnMaterial({ yarnAsset: old, legacyContext: primary }).diameter, diameter);
    assert.equal(resolveYarnMaterial({ yarnAsset: A, legacyContext: primary }).diameter, A.diameter);
    const pair = brush.resolveFeedYarnPlies([feed('A', 'old')], [A, old], primary).get(0);
    assert.deepEqual(pair.map(ply => ply.diameter), [A.diameter, diameter],
      'Current compatibility: second missing Asset diameter uses primary, not first Asset or companion');
    assert.equal(pair[1], primary, 'Preserve historical no-field adapter identity');
  }
  for (const diameter of [0, -1, NaN, Infinity, -Infinity, '0.2']) {
    assert.throws(() => library.normalizeYarnLibrary([{ ...old, diameter }]), /diameter/);
    const resolved = resolveYarnMaterial({ yarnAsset: { ...old, diameter }, legacyContext: legacy });
    assert.equal(resolved.diameter, legacy.diameter);
    assert.equal(resolved.diameterSource, 'LEGACY_PRIMARY');
    assert.equal(resolveYarnMaterial({ legacyContext: { diameter } }).diameter, .24);
  }
  for (const diameter of [null, undefined]) {
    assert.equal(Object.hasOwn(library.normalizeYarnLibrary([{ ...old, diameter }])[0], 'diameter'), false);
  }
  const legacyPbr = { ...legacy, texture: { pbr: { baseColor: map(), normal: map(), physicalRepeatLengthMm: 90 } } };
  const colorOnly = resolveYarnMaterial({ yarnAsset: { ...old, color: '#123456' }, legacyContext: legacyPbr });
  assert.equal(colorOnly.color, '#123456', 'CASE E');
  assert.equal(colorOnly.pbr.baseColor.assetRef, legacyPbr.texture.pbr.baseColor.assetRef);
  const partial = resolveYarnMaterial({ yarnAsset: { ...A, pbr: { normal: A.pbr.normal, physicalRepeatLengthMm: 42 } }, legacyContext: legacyPbr });
  assert.equal(partial.color, A.color);
  assert.equal(partial.pbr.normal.assetRef, A.pbr.normal.assetRef);
  assert.equal(partial.pbr.metallic, null, 'missing map uses neutral default without discarding other Asset fields');
  assert.equal(partial.pbr.baseColor, null);
  const full = resolveYarnMaterial({ yarnAsset: A, legacyContext: legacyPbr });
  assert.equal(full.pbr.baseColor.assetRef, A.pbr.baseColor.assetRef, 'CASE F');
  assert.equal(full.texture.textureStrength, 1, 'Asset Albedo replaces fallback color without accidental tint');
  assert.equal(texture.identifyPbrMap('Metallic.png'), 'metallic');
  const normalized = library.normalizeYarnLibrary([A, B]);
  assert.equal(normalized[0].color, A.color); assert.equal(normalized[1].diameter, B.diameter);
  assert.throws(() => library.normalizeYarnLibrary([{ ...A, diameter: -1 }]), /diameter/);
  assert.throws(() => library.normalizeYarnLibrary([{ ...A, color: {} }]), /color/);
  const repeatOnly = library.normalizeYarnLibrary([{ ...old, pbr: { physicalRepeatLengthMm: 42 } }])[0];
  assert.equal(repeatOnly.pbr?.physicalRepeatLengthMm, 42, 'Asset repeat is independent of map presence');
  assert.equal(resolveYarnMaterial({ yarnAsset: repeatOnly, legacyContext: legacyPbr }).texture.pbr.physicalRepeatLengthMm, 42);

  const chart = Bimp.empty(4, 8, 0), sequence = Bimp.empty(1, 8, 0);
  async function render(feeds, assets = [A, B], second = false, primary = legacy) {
    observation.draws.length = 0;
    const result = simulate(chart, sequence, [legacy.color], 1,
      [primary, { ...legacy, diameter: .14, color: '#00ff00', enabled: second }],
      { machineGauge: 32, feeds, yarnLibrary: assets, texturePerformanceMode: 'quality' });
    await Promise.all(observation.jobs.splice(0));
    result.stopSim();
    return result;
  }
  const separate = await render([feed('A'), feed('B')]);
  assert.equal(separate.previewValidity, 'VALIDATED', 'CASE A/B distinct Feed diameter profiles converge');
  assert.ok(observation.draws.some(d => d.material.color === A.color && d.material.diameter === .20));
  assert.ok(observation.draws.some(d => d.material.color === B.color && d.material.diameter === .32));
  const mixed = await render([feed('A', 'B')]);
  assert.equal(mixed.previewValidity, 'VALIDATED');
  const frame = observation.draws.slice(-observation.draws.length / 2);
  for (const item of [A, B]) {
    const draws = frame.filter(d => d.material.color === item.color);
    assert.ok(draws.length);
    assert.ok(draws.every(d => d.material.diameter === item.diameter));
    const width = d => Math.hypot(d.strip.positions[0] - d.strip.positions[2], d.strip.positions[1] - d.strip.positions[3]);
    assert.ok(width(draws[0]) > 0);
  }
  assert.notDeepEqual([...mixed.yarnLengthSolverResults[0].solvedPathByLink], [...mixed.yarnLengthSolverResults[1].solvedPathByLink],
    'different diameters must affect centerline geometry, not only ribbon width');
  const aWidth = frame.find(d => d.material.color === A.color), bWidth = frame.find(d => d.material.color === B.color);
  const width = d => Math.hypot(d.strip.positions[0] - d.strip.positions[2], d.strip.positions[1] - d.strip.positions[3]);
  assert.ok(Math.abs(width(aWidth) / width(bWidth) - .20 / .32) < 1e-5);
  const noSecondCount = observation.draws.length;
  await render([feed('A', 'B')], [A, B], true);
  assert.equal(observation.draws.length, noSecondCount, 'Legacy toggle cannot add/disable explicit assignment slots');
  assert.ok(observation.draws.every(d => [A.color, B.color].includes(d.material.color)));
  const lastSolves = observation.solves;
  await render([feed('A', 'B')], [{ ...A, color: '#112233', pbr: { ...A.pbr, physicalRepeatLengthMm: 55 } }, B]);
  assert.equal(observation.solves, lastSolves, 'color/repeat do not rerun solver');
  await render([feed('A', 'B')], [{ ...A, diameter: .22 }, B]);
  assert.ok(observation.solves > lastSolves, 'diameter invalidates geometry cache');
  const changedDiameter = await render([feed('A', 'B')], [{ ...A, diameter: .22 }, B]);
  assert.notDeepEqual([...changedDiameter.yarnLengthSolverResults[0].solvedPathByLink],
    [...mixed.yarnLengthSolverResults[0].solvedPathByLink], 'Changed diameter must produce new geometry');
  const missingB = { ...B }; delete missingB.diameter;
  const missingResult = await render([feed('A', 'B')], [A, missingB], true);
  assert.ok(observation.draws.some(d => d.material.color === B.color && d.material.diameter === legacy.diameter));
  const beforePrimaryChange = observation.solves;
  const changedPrimary = await render([feed('A', 'B')], [A, missingB], true, { ...legacy, diameter: .30 });
  assert.ok(observation.solves > beforePrimaryChange, 'Fallback primary diameter invalidates Solver cache');
  assert.deepEqual([...changedPrimary.yarnLengthSolverResults[0].solvedPathByLink],
    [...missingResult.yarnLengthSolverResults[0].solvedPathByLink], 'Explicit Asset geometry is independent of primary');
  assert.notDeepEqual([...changedPrimary.yarnLengthSolverResults[1].solvedPathByLink],
    [...missingResult.yarnLengthSolverResults[1].solvedPathByLink], 'Missing second diameter follows primary geometry');
  // Same effective value with a different source reuses numerical work.
  const beforeSourceChange = observation.solves;
  const explicitSameValue = await render([feed('A', 'B')], [A, { ...B, diameter: .30 }]);
  assert.equal(observation.solves, beforeSourceChange);
  assert.deepEqual(explicitSameValue.yarnLengthSolverResults, changedPrimary.yarnLengthSolverResults);
  const invalidFallback = await render([feed('A', 'B')], [A, { ...B, diameter: Infinity }], false,
    { ...legacy, diameter: -1 });
  const defaultEquivalent = await render([feed('A', 'B')], [A, { ...B, diameter: .24 }]);
  assert.deepEqual(invalidFallback.yarnLengthSolverResults, defaultEquivalent.yarnLengthSolverResults,
    'Bypassed invalid Asset/primary inputs still use the existing finite compatibility geometry');
  for (const result of invalidFallback.yarnLengthSolverResults) {
    assert.equal(result.status, 'CONVERGED');
    assert.ok(Number.isFinite(result.solvedLengthCmPer100Needles) && result.solvedLengthCmPer100Needles > 0);
    for (const data of result.solvedPathByLink.values()) assert.doesNotMatch(data, /NaN|Infinity/);
  }
  assert.ok(observation.shaders.some(s => /texture2D\(u_metallicMap, v_uv\)/.test(s)), 'Metallic must actually be sampled');

  state.dispatch({ chart, width: 4, height: 8, machineGauge: 32, yarnSequence: sequence, yarnPlies: [legacy],
    yarnLibrary: [A, B], needleArrangement: [1], singleJerseyCamProgram: { tracks: [['K']], feeds: [feed('A')] },
    texturePerformanceMode: 'solid' });
  state.StateMonitor.register([runner.runSimulation()]);
  assert.equal(state.GLOBAL_STATE.previewValidity, 'VALIDATED');
  const revision = state.GLOBAL_STATE.feedYarnStructureRevision;
  actions.assignYarnToFeed(0, 0, 'B');
  assert.equal(state.GLOBAL_STATE.feedYarnStructureRevision, revision + 1, 'CASE G P0 structure revision');
  assert.equal(state.GLOBAL_STATE.previewValidity, 'DESIGN_PREVIEW'); flush();
  assert.equal(state.GLOBAL_STATE.previewValidity, 'VALIDATED');
  const stableResults = state.GLOBAL_STATE.yarnLengthSolverResults;
  state.dispatch({ yarnLibrary: [A, { ...B, color: '#abcdef', pbr: { ...B.pbr, physicalRepeatLengthMm: 66 } }] });
  assert.equal(state.GLOBAL_STATE.yarnLengthSolverResults, stableResults, 'material edit preserves validated results during debounce');
  assert.equal(state.GLOBAL_STATE.previewValidity, 'VALIDATED'); flush();
  state.dispatch({ yarnLibrary: [A, { ...B, diameter: .30 }] });
  assert.equal(state.GLOBAL_STATE.previewValidity, 'DESIGN_PREVIEW'); flush();
  assert.equal(state.GLOBAL_STATE.previewValidity, 'VALIDATED');
  state.dispatch({ yarnLibrary: [A, B] }); flush();
  const blob = await codec.createProjectPackage(exporters.getProjectData());
  const saved = (await codec.readProjectPackage(blob)).project;
  assert.doesNotMatch(JSON.stringify(saved), /diameterSource|diameterUnit/,
    'Derived diameter provenance must not enter the project package');
  assert.doesNotMatch(JSON.stringify(state.GLOBAL_STATE.yarnPlies), /diameterSource|diameterUnit/,
    'Resolver views must not mutate persisted/Undo ply inputs');
  const measurementsBeforeLoad = desktopMeasurements;
  assert.equal(await importers.loadProjectFile(new File([blob], 'authority.knitscape')), true); flush();
  assert.equal(desktopMeasurements, measurementsBeforeLoad + 1, 'CASE H: package load must execute real fitChart desktop measurement');
  const restored = state.GLOBAL_STATE.yarnLibrary.find(a => a.id === 'B');
  assert.equal(restored.color, B.color, 'CASE H'); assert.equal(restored.diameter, B.diameter);
  assert.ok(restored.pbr.metallic.assetRef);
  assert.equal(restored.pbr.physicalRepeatLengthMm, 65);
  const restoredPly = brush.resolveFeedYarnPlies(state.GLOBAL_STATE.singleJerseyCamProgram.feeds, state.GLOBAL_STATE.yarnLibrary, legacy).get(0)[0];
  assert.equal(restoredPly.color, B.color); assert.equal(restoredPly.diameter, B.diameter);
  const beforePbr = state.GLOBAL_STATE.yarnLengthSolverResults;
  await actions.importYarnPbr('B', [new File([pixel], 'Albedo.png', { type: 'image/png' })]);
  assert.equal(state.GLOBAL_STATE.yarnLengthSolverResults, beforePbr,
    'real PBR import action also writes yarnLibraryError; this UI field must not invalidate length');
  flush();
  const oldNormalized = library.normalizeYarnLibrary([old]);
  assert.equal(Object.hasOwn(oldNormalized[0], 'color'), false, 'CASE I absence survives normalize');
  assert.equal(Object.hasOwn(oldNormalized[0], 'diameter'), false);
  assert.equal(brush.resolveFeedYarnPlies([feed('old')], oldNormalized, legacy).get(0)[0].color, legacy.color);
  runner.stopSimulation(); timers.clear();
  console.log('PASS: material authority CASE A–I and diameter contract; explicit/fallback provenance, units, invalid inputs, primary/second-yarn geometry, cache reuse/invalidation and package exclusion.');
} finally { await server.close(); delete globalThis.__materialAudit; }
