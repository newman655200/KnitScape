import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const out=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(out,'../..');
const records=[];
for(const name of ['length','state','material']){
  const args=[...(name==='state'?[]:['--experimental-vm-modules']),`reports/maintainability-audit-current/${name}-probe.mjs`];
  const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
  fs.writeFileSync(path.join(out,`${name}-probe.log`),(r.stdout??'')+'\nSTDERR:\n'+(r.stderr??''));
  records.push({name,command:'node '+args.join(' '),exit:r.status,
    results:(r.stdout??'').split(/\r?\n/).filter(s=>s.startsWith('{')).map(s=>JSON.parse(s))});
}
fs.writeFileSync(path.join(out,'probe-results.json'),JSON.stringify(records,null,2)+'\n');
console.log(JSON.stringify(records,null,2));if(records.some(r=>r.exit!==0))process.exitCode=1;
