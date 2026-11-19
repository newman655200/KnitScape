// Audit-only runner: logs go in this directory; npm build owns ignored dist/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const out=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(out,'../..');
const checks=[];
for(const [name,cmd,args] of [['validate','npm.cmd',['run','validate']],['build','npm.cmd',['run','build']],['diff-check','git',['diff','--check']]]){
  const start=Date.now();
  // cmd.exe is used only for npm's fixed command, never for file operations or computed paths.
  const r=cmd==='npm.cmd'?spawnSync('cmd.exe',['/d','/s','/c',`npm.cmd ${args.join(' ')}`],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024}):spawnSync(cmd,args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
  fs.writeFileSync(path.join(out,`${name}.log`),(r.stdout??'')+'\nSTDERR:\n'+(r.stderr??''));
  checks.push({name,command:cmd+' '+args.join(' '),exit:r.status,error:r.error?.message??null,elapsedMs:Date.now()-start});
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(checks,null,2)+'\n');
  console.log(JSON.stringify(checks.at(-1)));
}
if(checks.some(c=>c.exit!==0))process.exitCode=1;
