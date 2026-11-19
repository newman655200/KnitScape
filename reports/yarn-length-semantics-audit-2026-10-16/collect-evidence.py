from pathlib import Path
import json,hashlib,zipfile,subprocess
root=Path.cwd();out=Path(__file__).resolve().parent
projects=[]
for p in [root/'reports/sop-001/SOP-001-N6W6040-main-yarn-with-cam.knitscape',root/'reports/p1-1/SOP-001-P1-1.knitscape']:
    with zipfile.ZipFile(p) as z:j=json.loads(z.read('project.json'))
    projects.append(dict(path=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),assets=[{k:y.get(k) for k in ['id','name','diameter']}for y in j['yarnLibrary']],feeds=j['singleJerseyCamProgram']['feeds']))
sheet=Path(r'C:\Users\liuchen\Desktop\工艺.jpg')
evidence=dict(projects=projects,processSheet=dict(path=str(sheet),sha256=hashlib.sha256(sheet.read_bytes()).hexdigest(),
    humanReadNote='纱长测试标准为织机100针的长度',bothYarnRowsOrganizationNumbers='1.2.3.4.5.6.7.8',bothYarnRowsMouthCount=96,
    interpretation='The note establishes a 100 machine-needle basis; it does not specify load, unloading, yarn route, or feed equivalence.'),
    history=subprocess.check_output(['git','log','-5','--format=%h %s','--','src/simulation/yarnLengthSolver.js','src/simulation/yarnPathGeometry.js'],encoding='utf8'),
    historyScope='Read-only current-line measurement commits; not an interpretation of factory measurement procedure.')
(out/'document-evidence.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'projects':[(p['path'],len(p['assets']),[len(f['yarns'])for f in p['feeds']])for p in projects]},ensure_ascii=False))
