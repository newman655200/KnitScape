import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const allowed = ['src/actions/importers.js', 'src/actions/exporters.js',
  'src/actions/yarnSequenceRows.js', 'src/actions/repeatDimensions.js',
  'src/events/colorSequencePointerInteraction.js', 'src/events/colorSequenceTouchInteraction.js',
  'src/views/yarnPicker.js', 'scripts/validate-yarn-sequence-editor.mjs',
  'scripts/validate-project-load-lifecycle.mjs', 'src/codeGuide/generatedLines.json'];
const baseline = fs.readFileSync(new URL('baseline-diff.patch', import.meta.url), 'utf8');
const result = spawnSync('git', ['diff', '--binary'], { encoding: 'utf8' });
if (result.status) throw new Error(result.stderr);
function unrelated(text) {
  return text.replace(/\r\n/g, '\n').trim().split(/(?=^diff --git )/m)
    .filter(part => !allowed.some(file => part.startsWith(`diff --git a/${file} b/${file}\n`)))
    .join('').trim();
}
if (unrelated(baseline) !== unrelated(result.stdout)) throw new Error('Unrelated tracked changes differ from pre-turn snapshot');
const previousLines = JSON.parse(fs.readFileSync(`${process.env.TEMP}/knitscape-yarn-integrity-20261018/src__codeGuide__generatedLines.json`, 'utf8'));
const currentLines = JSON.parse(fs.readFileSync('src/codeGuide/generatedLines.json', 'utf8'));
for (const key of Object.keys(previousLines)) {
  const expected = previousLines[key] + (key.startsWith('palette.') ? 2 : 0);
  if (currentLines[key] !== expected) throw new Error(`Unexpected generated-line change: ${key}`);
}
console.log('PASS: only the seven palette guide locations moved by two lines; previous generated metadata retained.');
console.log('PASS: all unrelated tracked diffs match the pre-turn snapshot.');
console.log('Task allowlist: ' + allowed.join(', '));
