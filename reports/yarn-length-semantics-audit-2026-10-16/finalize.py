from pathlib import Path
import json,hashlib,subprocess,re
root=Path.cwd();out=Path(__file__).resolve().parent
data=json.loads((out/'results.json').read_text(encoding='utf8'))
report=(out/'REPORT.md').read_text(encoding='utf8')
rows=['|目标|Feed|状态|Solver值|独立最终repeat|error（独立−目标）|Applied|几何变化vs8|','|---|---|---|---:|---:|---:|---|---|']
for name,target in [('D',23),('E',15),('F',10),('G',8)]:
    for e in data['cases'][name]['evaluations']:
        if e['yarnIndex']!=1:continue
        s=e['solver'];v=e['interior']['normalizedCmPer100Needles']
        changed=data['comparisons'][name][e['feedIndex']]['secondGeometryChangedVs8']
        rows.append(f"|{target}|{e['feedIndex']+1}|{s['status']}|{s['solvedLengthCmPer100Needles']:.6f}|{v:.6f}|{v-target:+.6f}|{'是'if s['appliedToSimulation']else'否'}|{'是'if changed else'否'}|")
raw=['|案例/纱/Feed|raw模型长度|mm|cm|N|归一化cm/100针|段数|boundary模型量|repeat模型量|','|---|---:|---:|---:|---:|---:|---:|---:|---:|']
for name,yarn in [('A',0),('B',0),('C',1),('D',1),('E',1),('F',1)]:
    m=next(e['interior']for e in data['cases'][name]['evaluations']if e['feedIndex']==7 and e['yarnIndex']==yarn)
    raw.append(f"|{name}/Y{yarn+1}/F8|{m['rawModelLength']:.9f}|{m['physicalMm']:.9f}|{m['physicalCm']:.9f}|{m['measuredNeedleCount']}|{m['normalizedCmPer100Needles']:.9f}|{m['pathSegmentCount']}|{m['boundaryContributionModel']:.9f}|{m['repeatContributionModel']:.9f}|")
report=report.replace('<!--SECOND_TABLE-->','\n'.join(rows)).replace('<!--RAW_TABLE-->','\n'.join(raw))
(out/'REPORT.md').write_text(report,encoding='utf8')
initial=json.loads((out/'initial-state.json').read_text(encoding='utf8'))
sha=lambda b:hashlib.sha256(b).hexdigest()
changed=[name for name,h in initial['protectedHashes'].items()if sha((root/name).read_bytes())!=h]
assert not changed,changed
def git(*args):return subprocess.check_output(['git',*args],encoding='utf8').strip()
assert git('rev-parse','HEAD')==initial['head']
assert git('branch','--show-current')=='main'
assert git('rev-parse','baseline-trusted-yarn-length^{commit}')==initial['head']
assert all(v==0 for v in json.loads((out/'validator-exits.json').read_text(encoding='utf-8-sig')).values())
assert abs(data['hundredNeedles']['physicalCm']-23.7016155885863)<1e-9
assert data['cases']['E']['previewValidity']=='VALIDATED'
assert all(not e['solver']['appliedToSimulation']for e in data['cases']['G']['evaluations']if e['yarnIndex']==1)
for n in range(1,19):assert re.search(rf'^## {n}\. ',report,re.M),n
assert '<!--'not in report
broken=[]
for target in re.findall(r'\]\((C:/[^)]+)\)',report):
    target=re.sub(r':\d+$','',target)
    if Path(target)==out/'final-preservation.json':continue
    if not Path(target).exists():broken.append(target)
assert not broken,broken
final=dict(protectedFiles=len(initial['protectedHashes']),changed=changed,head=git('rev-parse','HEAD'),branch='main',
    sourceProjectSha256=sha((root/data['sourceSnapshot']['file']).read_bytes()),
    sourceProjectMatches=data['sourceSnapshot']['sha256']==sha((root/data['sourceSnapshot']['file']).read_bytes()),
    resultsSha256=sha((out/'results.json').read_bytes()),reportSha256=sha((out/'REPORT.md').read_bytes()),
    validatorExits=json.loads((out/'validator-exits.json').read_text(encoding='utf-8-sig')),brokenLinks=broken)
assert final['sourceProjectMatches']
(out/'final-preservation.json').write_text(json.dumps(final,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(final,ensure_ascii=False,indent=2))
