import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from 'vite';
import { ZipReader, BlobReader, TextWriter } from '@zip.js/zip.js';
const dir = new URL('./', import.meta.url);
globalThis.window = { localStorage: { getItem() { return null; } } };
globalThis.devicePixelRatio = 1;
globalThis.Path2D = class { constructor(data = '') { this.data = data; } };
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
globalThis.document = { createTreeWalker() { return {}; } };
try {
  const state = await server.ssrLoadModule('/src/state.js');
  const { Bimp } = await server.ssrLoadModule('/src/lib/Bimp.js');
  const { getProjectData } = await server.ssrLoadModule('/src/actions/exporters.js');
  const codec = await server.ssrLoadModule('/src/actions/projectPackage.js');
  const { yarnAssetRegistry } = await server.ssrLoadModule('/src/yarnTexture/yarnAssetRegistry.js');
  const before = JSON.parse(await fs.readFile(new URL('browser/before-reload.json', dir), 'utf8'));
  const bytes = await fs.readFile(new URL('basecolor.jpg', dir));
  const pbrBlob = new Blob([bytes], { type: 'image/jpeg' });
  const assetRef = yarnAssetRegistry.register(pbrBlob);
  const yarn = (id, length) => ({ yarnId: id === '0' ? 0 : id, yarnLengthCmPer100Needles: length,
    tensionCN: null, placement: 'parallel' });
  const feeds = Array.from({ length: 4 }, (_, f) => ({ yarns: before.choices.filter(c => c.feed === f).map(c =>
    yarn(c.id, Number(before.inputs.find(i => i.feed === f && i.yarn === c.yarn).value))) }));
  const secondId = before.choices.find(c => c.yarn === 1).id;
  const stamp = '2026-10-07T00:00:00.000Z';
  state.dispatch({ chart: Bimp.empty(48, 60, 0), yarnSequence: Bimp.empty(1, 60, 0),
    singleJerseyCamProgram: { tracks: Array.from({ length: 4 }, () => Array(4).fill('K')), feeds },
    needleArrangement: [1,2,3,4], needleArrangementInputs: ['1234','','',''], machineGauge: 32,
    yarnLibrary: [{ id: 0, name: 'Yarn 1', category: 'T', createdAt: stamp, updatedAt: stamp,
      pbr: { baseColor: { assetRef, fileName: 'basecolor.jpg', mimeType: pbrBlob.type, byteLength: bytes.length }, physicalRepeatLengthMm: 10 } },
      { id: secondId, name: 'Final B', category: 'OTHER', createdAt: stamp, updatedAt: stamp }],
    yarnLengthSolverResults: [{ status: 'CONVERGED', testOnly: true }], previewValidity: 'VALIDATED' });
  const facts = getProjectData();
  const forbidden = ['yarnLengthSolverResults','previewValidity','batchSelection','feedYarnStructureRevision','selectedStructureRevision'];
  forbidden.forEach(k => assert.ok(!Object.hasOwn(facts,k), k));
  const packed = await codec.createProjectPackage(facts);
  const zip = new ZipReader(new BlobReader(packed), { useWebWorkers: false });
  const entries = await zip.getEntries();
  const manifest = JSON.parse(await entries.find(e => e.filename === 'project.json').getData(new TextWriter()));
  forbidden.forEach(k => assert.ok(!Object.hasOwn(manifest,k), k));
  assert.equal(manifest.version,2); assert.equal(manifest.format,'knitscape');
  assert.deepEqual(manifest.singleJerseyCamProgram.feeds,feeds);
  assert.equal(manifest.yarnLibrary[0].pbr.physicalRepeatLengthMm,10);
  await zip.close();
  const opened = await codec.readProjectPackage(packed);
  const map = opened.project.yarnLibrary[0].pbr.baseColor;
  assert.deepEqual(Buffer.from(await (await opened.registry.getBlob(map.assetRef)).arrayBuffer()),bytes);
  await fs.writeFile(new URL('same-locators-pbr.knitscape',dir),Buffer.from(await packed.arrayBuffer()));
  const legacy = { width:48,height:60,repeats:facts.repeats,yarnPalette:facts.yarnPalette,yarnSequence:facts.yarnSequence,yarnPlies:facts.yarnPlies };
  await fs.writeFile(new URL('legacy-no-target.json',dir),JSON.stringify(legacy));
  const unset = structuredClone(opened.project);
  unset.singleJerseyCamProgram.feeds.forEach(f => f.yarns.forEach(y => y.yarnLengthCmPer100Needles = 0));
  // Browser legacy compatibility fixture uses embedded JPEG, then real importer migrates it.
  unset.yarnLibrary[0].pbr.baseColor = { fileName:'basecolor.jpg',dataUrl:'data:image/jpeg;base64,'+bytes.toString('base64') };
  delete unset.format; delete unset.version;
  await fs.writeFile(new URL('legacy-unset-pbr-multi.json',dir),JSON.stringify(unset));
  const result = { passed:true, scope:'Real getProjectData + package writer/reader; browser upload fixture reconstructed from visible assignment locators and targets; not a captured browser download.',
    factKeys:Object.keys(facts),forbiddenAbsent:forbidden,manifestKeys:Object.keys(manifest),format:manifest.format,version:manifest.version,
    entryNames:entries.map(e=>e.filename),feeds,pbrByteLength:bytes.length,pbrPhysicalRepeatLengthMm:10 };
  await fs.writeFile(new URL('persistence-probe.json',dir),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  opened.registry.clear(); yarnAssetRegistry.clear();
} finally { await server.close(); }
