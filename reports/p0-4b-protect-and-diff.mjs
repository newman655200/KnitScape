import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';

const root = resolve('.');
const before = 'C:/Users/liuchen/.codex/visualizations/2026/10/06/01a11150-f0b8-77f2-bc9f-aea30fbc8046/p0-4b-before';
const files = ['package.json', 'src/state.js', 'src/domain/feedYarnStructure.js', 'src/domain/yarnLengthBatch.js',
  'src/actions/importers.js', 'src/actions/singleJerseyCamProgram.js', 'src/actions/yarnLibrary.js',
  'src/views/singleJerseyCamProgramEditor.js', 'src/i18n/translations.js',
  'scripts/validate-yarn-length-structure-integration.mjs', 'scripts/browser-yarn-length-structure.mjs',
  'scripts/validate-yarn-length-batch-integration.mjs', 'scripts/validate-yarn-length-input-integration.mjs',
  'scripts/validate-single-jersey-cam-editor.mjs', 'scripts/validate-workspace-mode.mjs', 'scripts/browser-yarn-length-batch.mjs'];
const allowed = new Set(files);
const inventory = JSON.parse(readFileSync(join(before, 'inventory.json'), 'utf8').replace(/^\uFEFF/, ''));
const changed = []; const unexpected = []; let retained = 0;
for (const item of inventory) {
  const path = join(root, item.path);
  const hash = existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase() : null;
  if (hash === item.sha256) retained++;
  else { changed.push(item.path); if (!allowed.has(item.path)) unexpected.push(item.path); }
}
if (unexpected.length) throw new Error(`Unexpected changes: ${unexpected.join(', ')}`);
const stats = []; let insertions = 0; let deletions = 0;
for (const file of files) {
  let source = join(before, file);
  if (!existsSync(source)) {
    const original = spawnSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8' });
    source = join(before, 'original-for-diff.tmp');
    writeFileSync(source, original.status === 0 ? original.stdout : '');
  }
  const result = spawnSync('git', ['diff', '--no-index', '--numstat', '--', source, join(root, file)], { encoding: 'utf8' });
  if (result.status !== 0 && result.status !== 1) throw new Error(result.stderr);
  const counts = result.stdout.trim().split('\t');
  const added = Number(counts[0] || 0); const removed = Number(counts[1] || 0);
  stats.push({ file, insertions: added, deletions: removed }); insertions += added; deletions += removed;
}
const result = { protectedFiles: inventory.length, retainedByteForByte: retained,
  changedOnlyWithinScope: changed, unexpectedChanges: unexpected, sourceAndTestFiles: files.length, insertions, deletions, stats };
writeFileSync('reports/p0-4b-incremental-diff.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
