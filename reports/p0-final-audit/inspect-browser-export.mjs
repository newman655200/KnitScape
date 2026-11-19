import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { ZipReader, BlobReader, TextWriter, BlobWriter } from '@zip.js/zip.js';
const dir = new URL('./',import.meta.url);
const fileName = process.argv[2] || 'actual-browser-export.knitscape';
const outputPrefix = fileName.replace('-export.knitscape','');
const bytes = await fs.readFile(new URL(fileName,dir));
const zip = new ZipReader(new BlobReader(new Blob([bytes])), { useWebWorkers:false });
try {
  const entries = await zip.getEntries();
  const manifest = JSON.parse(await entries.find(e=>e.filename==='project.json').getData(new TextWriter()));
  const forbidden = ['yarnLengthSolverResults','previewValidity','feedYarnStructureRevision','selectedStructureRevision','batchSelection'];
  forbidden.forEach(k=>assert.ok(!Object.hasOwn(manifest,k),k));
  assert.equal(manifest.machineGauge,32);
  assert.deepEqual(manifest.needleArrangement,[1,2,3,4]);
  assert.deepEqual(manifest.singleJerseyCamProgram.tracks,Array.from({length:4},()=>Array(4).fill('K')));
  assert.deepEqual(manifest.singleJerseyCamProgram.feeds.map(f=>f.yarns.map(y=>y.yarnLengthCmPer100Needles)),[[23],[23,18],[23],[23]]);
  // Replacing the PBR group starts fresh metadata (existing HEAD behavior).
  // Loaded metadata and explicitly entered 10 mm must persist exactly.
  const expectedRepeat = fileName === 'direct-PBR-browser-export.knitscape' ? undefined : 10;
  assert.equal(manifest.yarnLibrary[0].pbr.physicalRepeatLengthMm,expectedRepeat);
  const map=manifest.yarnLibrary[0].pbr.baseColor;
  assert.deepEqual(Buffer.from(await (await entries.find(e=>e.filename===map.assetRef).getData(new BlobWriter())).arrayBuffer()),
    await fs.readFile(new URL('basecolor.jpg',dir)));
  const report={passed:true,scope:'Actual production browser download: copied from Downloads; no SSR reconstruction of this package.',
    byteLength:bytes.length,manifestKeys:Object.keys(manifest),forbiddenAbsent:forbidden,entryNames:entries.map(e=>e.filename),
    feeds:manifest.singleJerseyCamProgram.feeds,physicalRepeatLengthMm:manifest.yarnLibrary[0].pbr.physicalRepeatLengthMm ?? null};
  await fs.writeFile(new URL(outputPrefix+'-manifest.json',dir),JSON.stringify(manifest,null,2));
  await fs.writeFile(new URL(outputPrefix+'-export-check.json',dir),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {await zip.close();}
