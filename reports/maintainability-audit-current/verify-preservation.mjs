import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync,execFileSync } from 'node:child_process';
const out=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(out,'../..');
const before=JSON.parse(fs.readFileSync(path.join(out,'initial-state.json'),'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});
const changed=before.files.filter(x=>!fs.existsSync(path.join(root,x.file))||hash(fs.readFileSync(path.join(root,x.file)))!==x.sha256).map(x=>x.file);
const originals=new Set(before.files.map(x=>x.file));
const all=[...new Set(git(['ls-files','-z','--cached','--others','--exclude-standard']).split('\0').filter(Boolean))];
const added=all.filter(x=>!originals.has(x));
const unexpected=added.filter(x=>!x.startsWith('reports/maintainability-audit-current/'));
const check=spawnSync('git',['diff','--check'],{cwd:root,encoding:'utf8'});
const data={protectedCount:before.files.length,changedExisting:changed,addedOutsideAuditDirectory:unexpected,
  branch:git(['branch','--show-current']).trim(),headUnchanged:git(['rev-parse','HEAD']).trim()===before.head,
  indexUnchanged:hash(git(['ls-files','--stage','-z']))===before.indexHash,
  refsUnchanged:hash(git(['show-ref']))===before.refsHash,
  trackedDiffUnchanged:hash(git(['diff','--binary']))===before.trackedDiffHash,
  diffCheckExit:check.status,diffCheckStdout:check.stdout,
  status:git(['-c','core.quotepath=false','status','--short']),
  buildException:'npm run build regenerated ignored dist/, explicitly allowed by this audit; ignored node_modules/dist/.git are not in protected Git-visible file list.'};
data.passed=!changed.length&&!unexpected.length&&data.branch===before.branch&&data.headUnchanged&&data.indexUnchanged&&data.refsUnchanged&&data.trackedDiffUnchanged&&check.status===0;
fs.writeFileSync(path.join(out,'preservation.json'),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify(data,null,2));if(!data.passed)process.exitCode=1;
