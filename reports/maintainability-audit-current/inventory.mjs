// Audit-only inventory. Writes exclusively beside this script; never imports app runtime.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../..');
assert.equal(path.relative(root, out).replaceAll('\\', '/'), 'reports/maintainability-audit-current');
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
const files = walk('src');
const js = files.filter(f => f.endsWith('.js'));
const scripts = walk('scripts');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const sources = new Map(js.map(f => [f, fs.readFileSync(path.join(root, f), 'utf8')]));
// Use Node's already bundled Acorn, not a newly installed dependency (Node v20 audit runtime).
const acornModule={exports:{}};
vm.runInNewContext(process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'],
  {module:acornModule,exports:acornModule.exports});
const countFunctions=s=>{let n=0;const walk=node=>{if(!node||typeof node!=='object')return;
  if(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(node.type))n++;
  for(const v of Object.values(node))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);};
  walk(acornModule.exports.parse(s,{ecmaVersion:'latest',sourceType:'module'}));return n;};
// esbuild parses/resolves each module's dependencies; no output is written.
const result = await build({ absWorkingDir: root, entryPoints: js, bundle: true, packages: 'external',
  write: false, metafile: true, outdir: path.join(out, 'not-written'), format: 'esm',
  platform: 'browser', loader: { '.svg': 'text', '.jpg': 'dataurl' }, logLevel: 'silent' });
const resolve = (file, spec) => {
  if (!spec.startsWith('.')) return null;
  const stem = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
  return [stem, stem + '.js', stem + '/index.js', stem + '.json'].find(f => fs.existsSync(path.join(root, f))) ?? null;
};
const imports = new Map(js.map(f => [f, (result.metafile.inputs[f]?.imports ?? []).map(i => ({
  specifier: i.original ?? i.path, kind: i.kind,
  resolved: js.includes(i.path) ? i.path : resolve(f, i.original ?? i.path) }))]));
const incoming = new Map(js.map(f => [f, []]));
for (const [from, edges] of imports) for (const edge of edges)
  if (incoming.has(edge.resolved)) incoming.get(edge.resolved).push(from);
const exportMap = new Map(Object.values(result.metafile.outputs).map(v =>
  [v.entryPoint, v.exports]));
const stats = js.map(file => {
  const s = sources.get(file);
  return { file, physicalLines: s.split(/\r?\n/).length - Number(s.endsWith('\n')),
    nonBlankLines: s.split(/\r?\n/).filter(x => x.trim()).length,
    functionCount: countFunctions(s),
    functionCountMeaning: 'Acorn AST FunctionDeclaration/FunctionExpression/ArrowFunctionExpression count, including nested callbacks and methods.',
    imports: imports.get(file), importCount: imports.get(file).length,
    importedBy: [...new Set(incoming.get(file))], importedByCount: new Set(incoming.get(file)).size,
    exports: exportMap.get(file) ?? [] };
});
const visited = new Set();
const visit = f => { if (visited.has(f) || !imports.has(f)) return; visited.add(f);
  imports.get(f).forEach(i => i.resolved && visit(i.resolved)); };
visit('src/index.js');
let nextIndex=0; const stack=[], onStack=new Set(), indexes=new Map(), lows=new Map(), components=[];
const scc = f => { indexes.set(f,nextIndex);lows.set(f,nextIndex++);stack.push(f);onStack.add(f);
  for(const e of imports.get(f)??[]){const t=e.resolved;if(!imports.has(t))continue;
    if(!indexes.has(t)){scc(t);lows.set(f,Math.min(lows.get(f),lows.get(t)));}
    else if(onStack.has(t))lows.set(f,Math.min(lows.get(f),indexes.get(t)));}
  if(lows.get(f)===indexes.get(f)){const c=[];let t;do{t=stack.pop();onStack.delete(t);c.push(t);}while(t!==f);components.push(c);}};
js.forEach(f=>{if(!indexes.has(f))scc(f);});
const external = {};
for(const [file,edges] of imports)for(const edge of edges)if(!edge.specifier.startsWith('.'))
  (external[edge.specifier]??=[]).push({file,kind:edge.kind});
const namedOccurrenceCandidates = stats.flatMap(st => st.exports.map(name => {
  const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'g');
  const otherSrc = [...sources].filter(([f,s])=>{re.lastIndex=0;return f!==st.file&&re.test(s);}).map(([f])=>f);
  return {file:st.file,name,otherSrc};
})).filter(x=>x.otherSrc.length===0);
const data={method:'esbuild parse of source imports/exports; relative paths resolved with extension/index fallback. Static reachability excludes import.meta.glob expansion, HTML/CSS links, external consumers and event-string dispatch. No runtime dead-code proof.',
  sourceFiles:files.length,jsFiles:js.length,scriptFiles:scripts.length,
  validatorFiles:scripts.filter(f=>/validate.*\.mjs$/.test(f)),
  registeredValidators:Object.entries(pkg.scripts).filter(([k])=>k.startsWith('validate:')),
  dependencies:pkg.dependencies,devDependencies:pkg.devDependencies,
  files:stats,externalImports:external,
  topByLines:[...stats].sort((a,b)=>b.physicalLines-a.physicalLines).slice(0,15),
  topByImports:[...stats].sort((a,b)=>b.importCount-a.importCount).slice(0,10),
  topByImportedBy:[...stats].sort((a,b)=>b.importedByCount-a.importedByCount).slice(0,10),
  topByFunctions:[...stats].sort((a,b)=>b.functionCount-a.functionCount).slice(0,10),
  cyclicComponents:components.filter(c=>c.length>1),staticUnreachable:js.filter(f=>!visited.has(f)),namedOccurrenceCandidates};
assert.equal(stats.length,js.length);assert(stats.some(s=>s.file==='src/domain/singleJerseyMachine.js'));
assert(stats.find(s=>s.file==='src/index.js').importCount>20,'Import graph must include known index imports');
assert(stats.find(s=>s.file==='src/state.js').importedByCount>10,'State fan-in must be detected');
fs.writeFileSync(path.join(out,'inventory.json'),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({src:files.length,js:js.length,scripts:scripts.length,registeredValidators:data.registeredValidators.length,
  topByLines:data.topByLines.map(({file,physicalLines,importCount,importedByCount,functionCount})=>({file,physicalLines,importCount,importedByCount,functionCount})),
  cyclicComponents:data.cyclicComponents,staticUnreachable:data.staticUnreachable},null,2));
