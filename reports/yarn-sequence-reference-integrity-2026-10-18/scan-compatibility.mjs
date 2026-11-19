import fs from 'node:fs';
import path from 'node:path';
import { ZipReader, Uint8ArrayReader, TextWriter } from '@zip.js/zip.js';

const results = [];
const errors = [];
let files = 0;
function inspect(value, source) {
  if (!value || typeof value !== 'object') return;
  if ('yarnSequence' in value && 'yarnPalette' in value) {
    const pixels = Array.isArray(value.yarnSequence) ? value.yarnSequence : value.yarnSequence?.pixels;
    if (Array.isArray(pixels) && Array.isArray(value.yarnPalette)) {
      const bad = [...new Set(pixels.filter(p => !Number.isInteger(p) || p < 0 || p >= value.yarnPalette.length))];
      results.push({ source, paletteLength: value.yarnPalette.length, pixelCount: pixels.length,
        shape: Array.isArray(value.yarnSequence) ? 'array' : `${value.yarnSequence.width}x${value.yarnSequence.height}`,
        bad });
    }
  }
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === 'object') inspect(child, `${source}#${key}`);
  }
}
async function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'yarn-sequence-reference-integrity-2026-10-18'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(json|knitscape)$/i.test(file)) {
      files++;
      try {
        if (file.endsWith('.json')) inspect(JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')), file);
        else {
          const reader = new ZipReader(new Uint8ArrayReader(fs.readFileSync(file)), { useWebWorkers: false });
          try {
            for (const entry of await reader.getEntries()) {
              if (entry.filename.endsWith('.json')) inspect(JSON.parse(await entry.getData(new TextWriter())), `${file}:${entry.filename}`);
            }
          } finally { await reader.close(); }
        }
      } catch (error) { errors.push({ file, error: error.message }); }
    }
  }
}
await walk('.');
console.log(JSON.stringify({ files, projectRecords: results.length, invalid: results.filter(r => r.bad.length), errors, results }, null, 2));
