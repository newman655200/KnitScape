// Audit only. Replays the UI-exported project through existing modules.
// Drawing surfaces are test doubles, as in validate-feed-yarn-pbr-renderer.mjs.
// No business source files are changed. This is not a browser GPU capture.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const root = new URL('../../../', import.meta.url);
const out = new URL('./', import.meta.url);
const packageFile = new URL('../SOP-001-N6W6040-main-yarn-with-cam.knitscape', out);
const browser = JSON.parse(await fs.readFile(new URL('browser-dom-results.json', out), 'utf8'));
const box = browser.containers.find(x => x.id === 'sim-after-container');
globalThis.devicePixelRatio = 1.25;
globalThis.Path2D = class { constructor(data = '') { this.data = data; } };
globalThis.window = { location: { search: '' }, setTimeout, clearTimeout };
globalThis.__sopAudit = { uv: [], jobs: [], draws: [], uploads: [], materialInputs: [] };
const audit = globalThis.__sopAudit;
const server = await createServer({ root: root.pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  appType: 'custom', logLevel: 'silent', server: { middlewareMode: true },
  plugins: [{ name: 'read-only-sop-observers', enforce: 'pre', transform(source, id) {
    const filename = id.replaceAll('\\', '/');
    if (filename.endsWith('/src/simulation/yarnPathUvStrip.js')) {
      return source.replace('export function buildYarnUvStrip(', 'function observedBuildYarnUvStrip(') + `
        export function buildYarnUvStrip(options) {
          const strip = observedBuildYarnUvStrip(options);
          globalThis.__sopAudit.uv.push({ repeatMm: options.physicalRepeatLengthMm,
            gauge: options.machineGauge, arcOffset: options.arcLengthOffset || 0,
            firstU: strip.uvs[0], lastU: strip.uvs.at(-2), modelLength: strip.totalModelLength });
          return strip;
        }`;
    }
    if (filename.endsWith('/src/simulation/yarnTextureBrush.js')) {
      return source.replace('export function prepareYarnTextureImages(', 'function observedPrepareYarnTextureImages(') + `
        export function prepareYarnTextureImages(...args) {
          const job = observedPrepareYarnTextureImages(...args);
          globalThis.__sopAudit.jobs.push(job);
          return job;
        }`;
    }
    if (filename.endsWith('/src/simulation/yarnUvWebglRenderer.js')) {
      return source.replace('drawStrip(strip, material = {}) {', `drawStrip(strip, material = {}) {
        globalThis.__sopAudit.materialInputs.push({ diameter: material.diameter,
          color: material.color, textureStrength: material.texture?.textureStrength,
          repeatMm: material.texture?.pbr?.physicalRepeatLengthMm });`);
    }
  } }],
});

const urlRefs = new Map();
globalThis.Image = class {
  set src(url) {
    this.source = url;
    fetch(url).then(x => x.arrayBuffer()).then(data => {
      const b = Buffer.from(data);
      assert.equal(b.toString('hex', 0, 8), '89504e470d0a1a0a');
      this.naturalWidth = b.readUInt32BE(16);
      this.naturalHeight = b.readUInt32BE(20);
      this.onload();
    }).catch(() => this.onerror());
  }
};
function fakeGl(canvas) {
  const bindings = new Map(), uniforms = new Map();
  let unit = 0, bound;
  const gl = new Proxy({ canvas,
    createShader: () => ({}), createProgram: () => ({}), createBuffer: () => ({}), createTexture: () => ({}),
    getShaderParameter: () => true, getProgramParameter: () => true,
    getAttribLocation: () => 0, getUniformLocation: (_, name) => name,
    activeTexture(value) { unit = value - gl.TEXTURE0; },
    bindTexture(_, value) { bound = value; bindings.set(unit, value); },
    uniform1i(name, value) { uniforms.set(name, value); },
    uniform1f(name, value) { uniforms.set(name, value); },
    texImage2D(...args) {
      const image = args.at(-1), original = image?.sourceImage || image;
      if (!original?.source) return;
      bound.ref = urlRefs.get(original.source);
      audit.uploads.push({ ref: bound.ref, width: image.width || image.naturalWidth,
        height: image.height || image.naturalHeight });
    },
    drawElements() {
      audit.draws.push({ maps: Object.fromEntries(['baseColor','normal','roughness','height','ambientOcclusion']
        .map((key,index) => [key, uniforms.get('u_has' + key[0].toUpperCase() + key.slice(1) + 'Map')
          ? bindings.get(index)?.ref ?? null : null])), textureStrength: uniforms.get('u_textureStrength') });
    },
  }, { get(target, name) {
    if (name in target) return target[name];
    return /^[A-Z_0-9]+$/.test(String(name)) ? 1 : () => {};
  } });
  return gl;
}
function canvas(id = '') {
  const c = { id, width: 0, height: 0, style: {},
    getContext(kind) { return kind === 'webgl' ? c.gl ??= fakeGl(c) : context; } };
  const context = { clearRect() {}, save() {}, restore() {}, stroke() {},
    drawImage(image) { c.sourceImage = image; }, createPattern() { return null; } };
  return c;
}
const canvases = new Map(['back-arranged','mid-arranged','front-arranged'].map(id => [id,canvas(id)]));
globalThis.document = { createElement: () => canvas(), createTreeWalker: () => ({}),
  getElementById(id) { return canvases.get(id) || { getBoundingClientRect: () => box }; } };

try {
  const [{ readProjectPackage }, { yarnAssetRegistry }, { createSingleJerseyExecutionInput },
    { simulate }, { Bimp }] = await Promise.all([
    server.ssrLoadModule('/src/actions/projectPackage.js'),
    server.ssrLoadModule('/src/yarnTexture/yarnAssetRegistry.js'),
    server.ssrLoadModule('/src/components/singleJerseyExecutionInput.js'),
    server.ssrLoadModule('/src/simulation/yarnSimulation.js'),
    server.ssrLoadModule('/src/lib/Bimp.js'),
  ]);
  const opened = await readProjectPackage(new Blob([await fs.readFile(packageFile)]));
  yarnAssetRegistry.replaceWith(opened.registry);
  const originalUrl = yarnAssetRegistry.getObjectUrl.bind(yarnAssetRegistry);
  yarnAssetRegistry.getObjectUrl = async ref => { const url = await originalUrl(ref); urlRefs.set(url,ref); return url; };
  const p = opened.project;
  const input = createSingleJerseyExecutionInput(p.singleJerseyCamProgram,p.needleArrangement,p.width,p.height);
  const result = simulate(input, Bimp.fromJSON(p.yarnSequence), p.yarnPalette, 1, p.yarnPlies, {
    machineGauge: p.machineGauge, texturePerformanceMode: 'auto',
    target: { containerId: 'sim-after-container', canvasIDs: ['back-arranged','mid-arranged','front-arranged'] },
    feeds: p.singleJerseyCamProgram.feeds, yarnLibrary: p.yarnLibrary,
  });
  while (audit.jobs.length) await Promise.all(audit.jobs.splice(0));
  const yarn = p.yarnLibrary.find(x => x.name === 'N6/W(6040)');
  const expected = Object.fromEntries(['baseColor','normal','roughness','ambientOcclusion'].map(key => [key,yarn.pbr[key].assetRef]));
  assert.equal(result.previewValidity,'VALIDATED');
  assert.equal(result.yarnLengthSolverResults.length,8);
  for (const row of result.yarnLengthSolverResults) {
    assert(row.converged && row.appliedToSimulation);
    assert.equal(row.solvedLengthCmPer100Needles.toFixed(4),browser.solverRows[row.feedIndex].cells[2]);
  }
  assert(audit.uv.length > 0);
  assert(audit.uv.every(x => x.repeatMm === 22.987 && x.gauge === 32));
  const maxUvError = Math.max(...audit.uv.map(x => Math.abs(x.lastU -
    (x.arcOffset + x.modelLength) * (25.4/32) / 22.987)));
  assert(maxUvError < 0.0001);
  const textured = audit.draws.filter(x => Object.entries(expected).every(([key,ref]) => x.maps[key] === ref));
  assert(textured.length > 0);
  assert(textured.every(x => x.textureStrength === 1));
  const integrity = [];
  for (const [slot,ref] of Object.entries(expected)) {
    const b = Buffer.from(await (await yarnAssetRegistry.getBlob(ref)).arrayBuffer());
    const original = await fs.readFile(new URL('PBR/Yarn1/' + yarn.pbr[slot].fileName,root));
    assert(b.equals(original));
    integrity.push({slot,fileName:yarn.pbr[slot].fileName,sha256:crypto.createHash('sha256').update(b).digest('hex')});
  }
  const output = { method: 'UI-exported project replay through unchanged domain, adapter, simulate and renderer modules; fake drawing surfaces; not browser GPU instrumentation',
    project: String(packageFile), previewValidity:result.previewValidity,
    solverResults:result.yarnLengthSolverResults.map(({solvedPathByLink,...rest}) => ({...rest,solvedPathCount:solvedPathByLink.size})),
    physicalUv:{calls:audit.uv.length,repeatMm:22.987,gauge:32,maxFloat32UvError:maxUvError,samples:audit.uv.slice(0,4)},
    materialInputs:[...new Map(audit.materialInputs.map(x => [JSON.stringify(x),x])).values()],
    render:{totalDraws:audit.draws.length,drawsWithAllFourRealMaps:textured.length,
      gpuUploadSizes:[...new Map(audit.uploads.map(x => [JSON.stringify(x),x])).values()]},
    sourceIntegrity:integrity };
  await fs.writeFile(new URL('replay-audit-results.json',out),JSON.stringify(output,null,2));
  console.log(JSON.stringify({previewValidity:output.previewValidity,solverRows:output.solverResults.length,
    repeatMm:output.physicalUv.repeatMm,uvCalls:output.physicalUv.calls,texturedDraws:textured.length,maxUvError}));
  result.stopSim();
  yarnAssetRegistry.clear();
} finally { await server.close(); }
