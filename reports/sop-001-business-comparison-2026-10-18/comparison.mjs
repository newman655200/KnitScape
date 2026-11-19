// Report-only orchestration. The existing probe owns every M1/M2/M3 calculation.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';

const root = fileURLToPath(new URL('../../', import.meta.url));
const outputArgument = process.argv.find(arg => arg.startsWith('--output-dir='));
const ownDirectory = outputArgument ? outputArgument.slice('--output-dir='.length).replace(/\/$/, '') + '/'
  : 'reports/sop-001-business-comparison-2026-10-18/';
assert.match(ownDirectory, /^reports\/[a-zA-Z0-9_-]+\/$/, 'Output must be a direct reports subdirectory');
const out = new URL('../../' + ownDirectory, import.meta.url);
const probePath = 'reports/yarn-length-observability-2026-10-18/diagnostic.mjs';
const probeOutput = 'reports/yarn-length-observability-2026-10-18/results.json';
const fixturePath = 'reports/sop-001/SOP-001-N6W6040-main-yarn-with-cam.knitscape';
const historicalPath = 'reports/sop-001/with-cam/results.json';
const processSheet = 'reports/sop-001/with-cam/source-process-sheet.jpg';
process.chdir(root);

// Isolate the probe's browser stubs and intercept its one report write in memory.
// No source rewriting, formula copying, or writes to historical reports.
if (process.argv.includes('--probe-worker')) {
  let captured;
  const logs = [];
  const originalWrite = fs.writeFile;
  const originalLog = console.log;
  fs.writeFile = async (destination, contents) => {
    const file = destination instanceof URL ? fileURLToPath(destination) : path.resolve(destination);
    assert.equal(file, path.resolve(probeOutput), 'Unexpected probe output; stop before writing');
    captured = JSON.parse(contents);
  };
  console.log = (...args) => logs.push(args.join(' '));
  try {
    await import(new URL('../yarn-length-observability-2026-10-18/diagnostic.mjs', import.meta.url));
    assert.ok(captured, 'The existing probe did not produce a result');
    process.stdout.write(JSON.stringify({ results: captured, logs }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: { name: error.name, message: error.message }, logs }));
    process.exitCode = 1;
  } finally {
    fs.writeFile = originalWrite;
    console.log = originalLog;
  }
} else {
  await main();
}

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
async function json(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
async function hash(file) { return digest(await fs.readFile(file)); }
async function snapshot() {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8' }).split('\0').filter(file => file && !file.startsWith(ownDirectory));
  return Object.fromEntries(await Promise.all([...new Set(files)].sort().map(async file => [file, await hash(file)])));
}
function changes(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(file => before[file] !== after[file]);
}
async function command(executable, args, label) {
  const started = Date.now();
  return new Promise(resolve => {
    const child = spawn(executable, args, { cwd: root, windowsHide: true,
      shell: executable === 'npm.cmd', stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', value => { stdout += value; });
    child.stderr.on('data', value => { stderr += value; });
    child.on('error', error => { stderr += error.message; });
    child.on('close', exitCode => resolve({ command: label, exitCode, stdout, stderr,
      elapsedMs: Date.now() - started, evidenceClass: 'FACT' }));
  });
}
function failures(check) {
  return (check.stdout + check.stderr).match(/Failed: ([^\r\n]+)/)?.[1].split(', ') ?? [];
}
function compare(field, sopValue, fixtureValue, evidence, success = 'MATCH') {
  return { field, sopValue, fixtureValue, evidence, evidenceClass: 'FACT',
    status: isDeepStrictEqual(sopValue, fixtureValue) ? success : 'MISMATCH' };
}
function recorded(value, unit, source) {
  return { value, unit, source: `User SOP-001 transcription, ${source}`, evidenceClass: 'SOP_RECORDED',
    measurementPrinciple: 'UNKNOWN; source transcription only',
    confidence: 'Recorded value; physical measurement and software equivalence unconfirmed', applicableState: 'UNKNOWN' };
}
function softwareValue(value, unit, source, principle) {
  return { value, unit, source, measurementPrinciple: principle, confidence: 'UNVALIDATED_MODEL_PARAMETER',
    applicableState: 'Software model only', evidenceClass: 'FACT', realPhysicalValue: 'UNKNOWN' };
}

async function main() {
  const verify = process.argv.includes('--verify');
  assert.ok(process.argv.slice(2).every(arg => arg === '--verify' || arg === outputArgument),
    'Only --verify and --output-dir=reports/<directory> are supported');
  await fs.mkdir(out, { recursive: true });
  const before = await snapshot();
  const branch = git('branch', '--show-current');
  const head = git('rev-parse', 'HEAD');
  assert.equal(branch, 'main', 'Only main is authorized');
  const result = { date: '2026-10-18', timezone: 'Asia/Shanghai', generatedAt: new Date().toISOString(),
    branch, head, initialGitStatus: git('status', '--short'), evidenceClass: 'FACT',
    harnessStatus: 'BLOCKED', canonicalFactoryMeasurement: 'PENDING_PROCESS_CONFIRMATION',
    realMachineValidation: 'NOT_YET_ESTABLISHED',
    labels: { evidenceClasses: ['FACT', 'SOFTWARE_DERIVED', 'SOP_RECORDED', 'INFERENCE', 'UNKNOWN', 'NOT_MODELED', 'NOT_COMPARABLE'],
      fieldStatuses: ['MATCH', 'INPUT_MATCH', 'MISMATCH', 'SOFTWARE_DERIVED', 'UNREACHABLE', 'NOT_MODELED', 'NOT_COMPARABLE', 'UNKNOWN', 'PENDING_PROCESS_CONFIRMATION'],
      scope: 'Harness PASS means reproducible comparison with explicit gaps, never complete SOP or factory acceptance' },
    verification: { mode: verify ? 'FULL' : 'NOT_RUN', knownHistoricalFailures: ['validate:row-length-loop-model'],
      historicalEvidence: 'reports/yarn-length-observability-2026-10-18/REPORT.md#12-verification', checks: {} } };
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  if (verify) {
    console.log('Running current working-tree baseline: npm run validate');
    result.verification.checks.baselineValidate = await command(npm, ['run', 'validate'], 'npm run validate (before replay)');
  }
  try {
    // Meaningful guards: a missing target is a mismatch; zero is never treated as missing.
    assert.equal(compare('target', 8, null, 'self-check').status, 'MISMATCH');
    assert.equal(compare('target', 0, 0, 'self-check').status, 'MATCH');
    assert.equal(compare('cam', ['K', 'T'], ['T', 'K'], 'self-check').status, 'MISMATCH');
    assert.deepEqual(changes({ a: 'old' }, { a: 'new', b: 'new' }), ['a', 'b']);
    await collectInputs(result);
    console.log('Replaying unchanged observability probe: four scenarios, all Feed/Yarn records');
    const replay = await command(process.execPath, [fileURLToPath(import.meta.url), '--probe-worker'], 'existing observability diagnostic.mjs (isolated output capture)');
    const payload = JSON.parse(replay.stdout);
    result.replay = { command: replay.command, exitCode: replay.exitCode, stderr: replay.stderr, logs: payload.logs };
    if (payload.error) {
      result.replay.error = payload.error;
      result.numericStatus = /historical fixture|Metadata-only/.test(payload.error.message) ? 'NUMERIC_DRIFT' : 'UNKNOWN';
      throw new Error('Existing probe rejected this working tree: ' + payload.error.message);
    }
    assert.equal(replay.exitCode, 0);
    await collectMeasurements(result, payload.results);
    result.harnessStatus = 'PASS';
  } catch (error) {
    result.blocker = { evidenceClass: 'FACT', message: error.message,
      nextAction: 'Inspect reported evidence; do not change Solver or update expected values to force agreement' };
  }
  if (verify) {
    console.log('Running targeted validators, full validate, build, and diff check');
    for (const name of ['validate:yarn-length-gauge', 'validate:yarn-length-solver', 'validate', 'build']) {
      result.verification.checks[name] = await command(npm, ['run', name], `npm run ${name}`);
      console.log(`${name}: exit ${result.verification.checks[name].exitCode}`);
    }
    result.verification.checks.diffCheck = await command('git', ['diff', '--check'], 'git diff --check');
    const baseline = result.verification.checks.baselineValidate;
    const final = result.verification.checks.validate;
    result.verification.baselineFailures = failures(baseline);
    result.verification.finalFailures = failures(final);
    result.verification.newFailures = failures(final).filter(name => !failures(baseline).includes(name));
    const allowed = result.verification.knownHistoricalFailures;
    const baselineUnderstood = failures(baseline).every(name => allowed.includes(name)) &&
      (baseline.exitCode === 0 || (baseline.exitCode === 1 && failures(baseline).length > 0));
    const suiteUnderstood = final.exitCode === 0 || (final.exitCode === 1 && failures(final).length > 0);
    const otherChecksPass = ['validate:yarn-length-gauge', 'validate:yarn-length-solver', 'build', 'diffCheck']
      .every(name => result.verification.checks[name].exitCode === 0);
    if (!baselineUnderstood || !suiteUnderstood || result.verification.newFailures.length || !otherChecksPass) {
      result.harnessStatus = 'BLOCKED';
      result.verification.status = 'UNEXPECTED_FAILURE';
    } else result.verification.status = 'PASS_WITH_KNOWN_BASELINE_FAILURE';
  }
  const after = await snapshot();
  const changed = changes(before, after);
  result.preservation = { evidenceClass: 'FACT', checkedFileCount: Object.keys(before).length,
    beforeSha256: digest(JSON.stringify(before)), afterSha256: digest(JSON.stringify(after)),
    changedOutsideReportDirectory: changed, srcChanged: changed.some(file => file.startsWith('src/')),
    packageJsonChanged: changed.includes('package.json'), packageLockChanged: changed.includes('package-lock.json'),
    originalFixtureChanged: changed.includes(fixturePath), projectFormatChanged: changed.includes('src/actions/projectPackage.js'),
    algorithmsChanged: changed.some(file => file.startsWith('src/')),
    headUnchanged: head === git('rev-parse', 'HEAD'), branchUnchanged: branch === git('branch', '--show-current'),
    scope: 'Git-listed tracked and nonignored untracked files, excluding this output directory; ignored build/dependency caches excluded' };
  if (changed.length || !result.preservation.headUnchanged || !result.preservation.branchUnchanged) result.harnessStatus = 'BLOCKED';
  await fs.writeFile(new URL('results.json', out), JSON.stringify(result, null, 2) + '\n');
  await fs.writeFile(new URL(outputArgument ? 'SOP-COMPARISON.md' : 'REPORT.md', out), report(result));
  console.log(`SOP001_COMPARISON_HARNESS = ${result.harnessStatus}; ${result.numericStatus ?? 'no current metrics'}`);
  if (result.harnessStatus !== 'PASS') process.exitCode = 1;
}

async function collectInputs(r) {
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: false, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  let p, operations, material, diagnosticDiameter;
  try {
    const [{ readProjectPackage }, { resolveSingleJerseyOperations }, { createSingleJerseyExecutionInput }, { resolveYarnMaterial }] =
      await Promise.all(['/src/actions/projectPackage.js', '/src/domain/singleJerseyMachine.js',
        '/src/components/singleJerseyExecutionInput.js', '/src/domain/yarnMaterial.js'].map(file => server.ssrLoadModule(file)));
    p = (await readProjectPackage(new Blob([await fs.readFile(fixturePath)]))).project;
    operations = resolveSingleJerseyOperations(p.singleJerseyCamProgram, p.needleArrangement, 4, 8);
    const adapted = createSingleJerseyExecutionInput(p.singleJerseyCamProgram, p.needleArrangement, 4, 8);
    const { createSingleJerseySimulationInput } = await server.ssrLoadModule('/src/adapters/singleJerseySimulationInput.js');
    assert.deepEqual(adapted, createSingleJerseySimulationInput(operations), 'Machine Domain / execution adapter mismatch');
    material = p.yarnLibrary.map(asset => ({ id: asset.id, name: asset.name, assetDiameter: asset.diameter ?? null,
      ...((m) => ({ diameter: m.diameter, source: m.source,
        diameterSource: m.diameterSource, diameterUnit: m.diameterUnit
      }))(resolveYarnMaterial({ yarnAsset: asset, legacyContext: p.yarnPlies[0] })) }));
    // The existing probe's audit-low Asset has no diameter; keep its calculation unchanged.
    diagnosticDiameter = resolveYarnMaterial({ legacyContext: p.yarnPlies[0] });
  } finally { await server.close(); }
  const historic = await json(historicalPath);
  const historicalCam = historic.actualProject.singleJerseyCamProgram.tracks;
  const sheetHashMatches = (await hash(processSheet)) === historic.sourceProcessSheet.sha256.toLowerCase();
  // Frozen transcription from with-cam/REPORT.md §7, not a newly interpreted image.
  const recordedCam = ['KKKKKKTT', 'KKKKTTKK', 'KKTTKKKK', 'TTKKKKKK'].map(row => [...row]);
  const expectedOperations = ['KKKT', 'KKKT', 'KKTK', 'KKTK', 'KTKK', 'KTKK', 'TKKK', 'TKKK'].map(row => [...row]);
  const camVerified = sheetHashMatches && isDeepStrictEqual(historicalCam, recordedCam) &&
    isDeepStrictEqual(p.singleJerseyCamProgram.tracks, recordedCam) && isDeepStrictEqual(operations, expectedOperations);
  const artifactPaths = [fixturePath, historicalPath, processSheet, probePath, probeOutput,
    'reports/yarn-length-observability-2026-10-18/baseline-results.json',
    'reports/yarn-length-semantics-audit-2026-10-16/independent-auditor.mjs',
    'reports/real-sop-geometry-gap-audit-2026-10-16/image-metrics.json',
    'reports/sop-001/with-cam/REPORT.md', 'reports/sop-001/with-cam/operation-log.md',
    'docs/PROCESS_VALIDATION.md', 'src/actions/projectPackage.js', 'src/domain/singleJerseyMachine.js',
    'src/domain/machineGauge.js', 'src/domain/yarnMaterial.js', 'src/simulation/yarnSimulation.js',
    'src/simulation/yarnPathGeometry.js', 'src/simulation/yarnLengthMetrics.js', 'src/simulation/yarnLengthSolver.js'];
  r.sources = { evidenceClass: 'FACT', sopTranscription: 'User pasted task in this conversation, 2026-10-18; complete values embedded in sop',
    pastedAttachment: 'C:/Users/liuchen/.codex/attachments/32fc5a85-20ea-43ee-b5b7-fd1cf407dd67/已粘贴的文本.txt',
    artifacts: await Promise.all(artifactPaths.map(async file => ({ path: file, sha256: await hash(file) }))) };
  const yarnSpecs = [
    { name: 'N6/W(6040)', ratio: 91.20, lot: 'Y38W9N60NW-Z', depth: 3, plate: 30, tension: 5, length: 23 },
    { name: '20D LOW', ratio: 8.80, lot: 'Z2704', depth: 5.6, plate: 124, tension: 4, length: 8 },
  ];
  r.sop = { evidenceClass: 'SOP_RECORDED', machine: { station: 'K01', type: '巨登，单面', materialNo: 'NB2D0106-AA01AC',
    cylinderDiameter: recorded(32, 'inch', 'Machine'), gauge: recorded(32, 'needles/inch', 'Machine'),
    totalNeedles: recorded(3216, 'needles', 'Machine'), arrangement: '1234' },
    yarns: yarnSpecs.map(y => ({ name: y.name, ratio: recorded(y.ratio, '%', `${y.name} ratio`), lot: y.lot,
      feedRecord: '1.2.3.4.5.6.7.8', mouthCount: recorded(96, 'mouths', `${y.name} setup`),
      feederDepth: recorded(y.depth, 'cm', `${y.name} setup`), plateScale: recorded(y.plate, 'SOP scale; physical unit UNKNOWN', `${y.name} setup`),
      gearCount: recorded(36, 'count', `${y.name} setup`), tension: recorded(y.tension, 'cN', `${y.name} tension record`),
      yarnLength: { ...recorded(y.length, 'cm / 100G (verbatim)', `${y.name} actual yarn length recorded`),
        note: 'SOP备注：纱长测试标准为织机100针长度', valueType: 'PENDING_PROCESS_CONFIRMATION' } })),
    fabric: { greigeWidth: recorded(56, 'inch', 'Fabric'), greigeWeight: recorded(264, 'G/Y', 'Fabric') },
    tolerance: { ...recorded(2, '% (±)', 'SOP note'), classification: 'SOP_RECORDED_TOLERANCE',
      softwareAcceptanceTolerance: false, derivedRanges: yarnSpecs.map(y => ({ name: y.name,
        range: [y.length * 0.98, y.length * 1.02], unit: 'cm / 100G (SOP note: 100 machine needles)',
        evidenceClass: 'INFERENCE', classification: 'DERIVED_FROM_SOP_RECORDED_TOLERANCE',
        source: 'SOP ±2% and recorded length', measurementPrinciple: 'recorded length × (1 ± 0.02)',
        confidence: 'Arithmetic only; no accepted factory contract', applicableState: 'UNKNOWN', usedForPassFail: false })) } };
  r.softwareInputs = { evidenceClass: 'FACT', width: p.width, height: p.height, machineGauge: p.machineGauge,
    needleArrangementInputs: p.needleArrangementInputs, needleArrangement: p.needleArrangement,
    tracks: p.singleJerseyCamProgram.tracks, feeds: p.singleJerseyCamProgram.feeds,
    yarnLibrary: p.yarnLibrary.map(asset => ({ id: asset.id, name: asset.name, category: asset.category,
      diameter: asset.diameter ?? null, color: asset.color ?? null,
      pbrMaps: Object.keys(asset.pbr ?? {}).filter(key => asset.pbr[key]?.assetRef),
      physicalRepeatLengthMm: asset.pbr?.physicalRepeatLengthMm ?? null })),
    materialResolution: material,
    diameter: softwareValue(p.yarnPlies[0].diameter, 'model needle pitch', 'fixture yarnPlies[0].diameter', 'Existing material fallback and curve offset'),
    primaryLengthScaleY: softwareValue(p.yarnPlies[0].lengthScaleY, 'ratio', 'fixture yarnPlies[0].lengthScaleY', 'Existing template height scale'),
    pbrRepeat: { ...softwareValue(p.yarnLibrary.find(y => y.name === 'N6/W(6040)')?.pbr?.physicalRepeatLengthMm,
      'mm', 'fixture asset PBR; reports/sop-001/with-cam/REPORT.md §4', 'Prior conditional derivation from scan width and user-reported DPI; not recomputed here'),
      confidence: 'Conditional scan calibration; original acquisition and no resampling assumptions unconfirmed',
      applicableState: 'Texture U repeat only; not yarn diameter; inactive in solid diagnostic rendering' } };
  const input = [compare('Gauge', 32, p.machineGauge, `${fixturePath}:machineGauge`),
    compare('Arrangement', [1, 2, 3, 4], p.needleArrangement, `${fixturePath}:needleArrangement`),
    compare('Cam tracks', recordedCam, p.singleJerseyCamProgram.tracks, `${historicalPath}:actualProject.singleJerseyCamProgram.tracks`),
    compare('Feed cycle count', 8, p.singleJerseyCamProgram.feeds.length, `${fixturePath}:singleJerseyCamProgram.feeds`)];
  r.yarns = yarnSpecs.map((spec, index) => {
    const asset = p.yarnLibrary.find(y => y.name === spec.name);
    const assignments = p.singleJerseyCamProgram.feeds.flatMap((feed, feedIndex) => feed.yarns
      .filter(y => asset && y.yarnId === asset.id).map(y => ({ feed: feedIndex + 1, ...y })));
    input.push(compare(`${spec.name} Feed mapping (recorded 1–8)`, [1, 2, 3, 4, 5, 6, 7, 8], assignments.map(y => y.feed), fixturePath, 'INPUT_MATCH'));
    for (let feed = 1; feed <= 8; feed++) {
      const slot = assignments.find(y => y.feed === feed);
      input.push(compare(`${spec.name} Feed${feed} target`, spec.length, slot?.yarnLengthCmPer100Needles ?? null, fixturePath, 'INPUT_MATCH'));
      input.push(compare(`${spec.name} Feed${feed} tension record`, spec.tension, slot?.tensionCN ?? null, fixturePath));
    }
    return { name: spec.name, sop: r.sop.yarns[index], software: { assetPresent: Boolean(asset), assetId: asset?.id ?? null,
      assignments, targetLength: assignments.map(y => y.yarnLengthCmPer100Needles),
      feedMappingStatus: index ? 'MISMATCH' : 'INPUT_MATCH', actualFactoryMapping: 'PENDING_PROCESS_CONFIRMATION',
      tension: { recorded: true, recordSource: 'SOP transcription', recordedInFixture: assignments.some(y => y.tensionCN !== null),
        valuesInFixture: assignments.map(y => y.tensionCN), activeInGeometry: false,
        evidence: 'tensionCN occurs only in data normalization/assignment in src/actions; geometry/solver do not read it' },
      material: { category: asset?.category ?? null, constitutivePhysics: 'NOT_MODELED', realMaterialIdentity: 'UNKNOWN' },
      diameter: { modelValue: material.find(m => m.id === asset?.id)?.diameter ?? null,
        diagnosticFallback: p.yarnPlies[0].diameter, unit: 'model needle pitch', physicalDiameter: 'UNKNOWN',
        effectiveDiameter: index ? diagnosticDiameter.diameter : material.find(m => m.id === asset?.id)?.diameter,
        diameterSource: index ? diagnosticDiameter.diameterSource : material.find(m => m.id === asset?.id)?.diameterSource,
        effectiveDiameterUnit: diagnosticDiameter.diameterUnit,
        measuredDiameter: null, measuredDiameterStatus: 'UNKNOWN', physicalValidation: 'NOT_ESTABLISHED',
        scope: index ? 'SYNTHETIC_DIAGNOSTIC_ONLY; absent from saved fixture' : 'SAVED_MAIN_YARN',
        evidence: 'resolveYarnMaterial; existing diagnostic inherits primary ply; never infer from yarn name' },
      placement: { fixture: assignments.map(y => y.placement), diagnostic: index ? 'parallel' : null,
        softwareBehavior: 'Parallel strand offset on shared K/T/M topology', realKnittingPath: 'UNKNOWN' },
      setupFieldsNotModeled: ['ratio', 'lot physics', '96-mouth machine mapping', 'feeder depth', 'plate scale', 'gear count'] },
      metrics: [], comparisonStatus: index ? 'UNREACHABLE' : 'SOFTWARE_DERIVED', factoryComparison: 'NOT_COMPARABLE' };
  });
  r.inputComparison = { fields: input, fixtureMismatches: input.filter(item => item.status === 'MISMATCH'),
    machine: { sopGauge: 32, softwareGauge: p.machineGauge, gaugeMatch: input[0].status,
      sopCylinderInch: 32, softwareCylinderInchOrNull: null, cylinderStatus: 'NOT_MODELED',
      sopNeedles: 3216, softwareNeedlesOrNull: null, needlesStatus: 'NOT_MODELED',
      arrangementSop: '1234', arrangementSoftware: p.needleArrangement.join(''), arrangementMatch: input[1].status,
      camStatus: camVerified ? 'MATCH' : 'UNVERIFIED' } };
  r.fixture = { path: fixturePath, sha256: await hash(fixturePath), status: input.some(i => i.status === 'MISMATCH') ? 'FIXTURE_MISMATCH' : 'MATCH',
    scope: 'PARTIAL SOP REPRESENTATION; saved main yarn only', originalModified: false, comparisonFixtureCreated: false,
    diagnosticAssignment: 'Reuse existing probe in memory: audit-low, target 8, parallel, all eight Feeds; SYNTHETIC_DIAGNOSTIC_ONLY',
    cam: { status: camVerified ? 'MATCH' : 'UNVERIFIED', evidenceClass: 'FACT', sheetHashMatches,
      sourceRepresentation: historic.sourceProcessSheet, recordedTracks: recordedCam, machineOperations: operations,
      evidence: 'with-cam REPORT §7 and historical actualProject -> current package parser -> resolveSingleJerseyOperations -> existing adapter',
      physicalNeedleHeelConvention: 'PENDING_PROCESS_CONFIRMATION', defaultCamUsed: false } };
  r.fabric = { greigeWidth: { sop: r.sop.fabric.greigeWidth, softwareValue: null, status: 'NOT_MODELED' },
    greigeWeight: { sop: r.sop.fabric.greigeWeight, softwareValue: null, status: 'NOT_MODELED', gsm: null,
      note: 'No validated fabric weight/GSM conversion or factory comparison' } };
  const photo = '面料放大.jpg';
  const photoEvidence = await json('reports/real-sop-geometry-gap-audit-2026-10-16/image-metrics.json');
  const expectedPhoto = photoEvidence.reference_images.find(image => image.path.endsWith(photo));
  const photoHash = await hash(photo).catch(() => null);
  const photoConfirmed = photoHash !== null && photoHash === expectedPhoto?.sha256;
  r.visualReference = { status: photoConfirmed ? 'REAL_FABRIC_VISUAL_REFERENCE' : 'UNKNOWN',
    evidenceClass: photoConfirmed ? 'FACT' : 'UNKNOWN', path: photoConfirmed ? photo : null, sha256: photoHash,
    evidence: ['reports/sop-001/with-cam/operation-log.md: user explicitly designated img007.jpg',
      'reports/real-sop-geometry-gap-audit-2026-10-16/REPORT.md: renamed photo byte-identical to img007',
      'reports/real-sop-geometry-gap-audit-2026-10-16/image-metrics.json: exact SHA-256'],
    observations: photoConfirmed ? [{ evidenceClass: 'FACT', kind: 'VISUAL_OBSERVATION',
      source: 'Photo visually inspected during harness creation; qualitative notes reused only while hash matches',
      notes: ['Visible knitted loop structure', 'Visible surface fuzz', 'Visible crossings and occlusion'] }] : [],
    calibratedParameters: [], forbiddenInferences: ['yarn diameter', 'wale/course spacing mm', 'stitch density', 'elastic recovery',
      'relaxation coefficient', 'friction', 'physical scale'], scaleStatus: 'UNKNOWN' };
  r.unknowns = [
    { id: 'Q1', question: '23的实际测量路径、步骤、起始针/结束针、连接段处理？', fields: ['23 measurement path', 'start needle', 'end needle'] },
    { id: 'Q2', question: '8的实际测量路径是什么，是否与23完全相同方法、边界、仪器及归一化？', fields: ['8 measurement path', 'same measurement method'] },
    { id: 'Q3', question: '两纱测量时loaded / unloaded / relaxed？是否回缩/静置？5/4cN是否测量负荷？', fields: ['load state', '20D LOW measured after recovery'] },
    { id: 'Q4', question: '20D LOW真实材料是什么，是否弹性、预牵伸、送纱倍率？', fields: ['material identity', 'pre-draft', 'elasticity', 'draft ratio'] },
    { id: 'Q5', question: '测量对应哪个Feed？两纱真实同口/独立口分配及1–8循环与96口关系？', fields: ['measured Feed', 'factory Feed mapping'] },
    { id: 'Q6', question: '两纱是否完全相同knitting path，还是plating/laid-in/covering/部分针路径？', fields: ['same knitting path'] },
    { id: 'Q7', question: '23/8各为setpoint / actual measured / QC target？容差适用阶段及业务合同？', fields: ['23 value type', '8 value type', 'acceptance contract'] },
  ].map(q => ({ ...q, evidenceClass: 'UNKNOWN', status: 'PENDING_PROCESS_CONFIRMATION',
    answers: Object.fromEntries(q.fields.map(field => [field, 'UNKNOWN'])), source: 'docs/PROCESS_VALIDATION.md#process-questions-pending' }));
  r.additionalUnknowns = ['physical yarn diameters', 'density', 'elasticity curve', 'friction', 'compression', 'relaxation', 'finish state'];
}

async function collectMeasurements(r, replay) {
  assert.equal(replay.sourceSha256, r.fixture.sha256, 'Replay must use the inspected fixture');
  assert.equal(replay.head, r.head);
  assert.equal(replay.runs.length, 4);
  assert.equal(replay.runs.reduce((sum, run) => sum + run.diagnostics.length, 0), 48);
  r.geometryInputs = replay.geometryInputs;
  for (const yarn of r.yarns) {
    assert.equal(yarn.software.diameter.effectiveDiameter, replay.geometryInputs.diameter.value);
    assert.equal(yarn.software.diameter.diameterSource, 'LEGACY_PRIMARY');
    assert.equal(yarn.software.diameter.effectiveDiameterUnit, 'MODEL_NEEDLE_PITCH');
    assert.equal(yarn.software.diameter.measuredDiameter, null);
  }
  r.runs = replay.runs;
  const expected = { 30: [22.999733873, 24.792732968, 24.077277996, 13.208565],
    32: [22.999580039, 24.805103333, 23.701615835, 13.320236] };
  r.numericChecks = [];
  for (const run of replay.runs) {
    for (const d of run.diagnostics) {
      d.evidenceClass = 'SOFTWARE_DERIVED';
      d.factoryComparison = 'NOT_COMPARABLE';
      d.candidateApplied = d.m1.appliedToSimulation;
      d.finalAppliedGeometry = { pathState: d.m3.pathState, m3: d.m3.value, unit: d.m3.unit };
      if (d.yarnIndex === 1) {
        assert.equal(d.m1.status, 'UNREACHABLE_TARGET');
        assert.equal(d.candidateApplied, false);
        d.candidateMinimum = d.m1.reachableRange.minLengthCmPer100Needles;
        assert.ok(Number.isFinite(d.candidateMinimum), 'Use the actual runtime reachable-range field');
        d.failedCandidate = { m1: d.m1.value, m3: d.m3.solverCandidateValue, loopHeight: d.m1.solvedLoopHeight, applied: false };
      } else {
        assert.equal(d.m1.status, 'CONVERGED');
        assert.equal(d.candidateApplied, true);
      }
      if (d.feedIndex !== 7) continue;
      const values = d.yarnIndex === 0 ? [d.m1.value, d.m2.value, d.m3.value] : [d.candidateMinimum];
      const wanted = d.yarnIndex === 0 ? expected[run.width].slice(0, 3) : expected[run.width].slice(3);
      values.forEach((value, i) => r.numericChecks.push({ run: run.id, yarnIndex: d.yarnIndex,
        metric: d.yarnIndex ? 'Feed8 candidateMinimum' : ['Feed8 M1', 'shared M2', 'Feed8 M3'][i],
        expected: wanted[i], actual: value, tolerance: d.yarnIndex ? 1e-6 : 1e-8,
        status: Math.abs(value - wanted[i]) <= (d.yarnIndex ? 1e-6 : 1e-8) ? 'MATCH' : 'NUMERIC_DRIFT',
        toleranceMeaning: 'Rounded historical numerical regression only; never SOP ±2% or business acceptance' }));
      r.yarns[d.yarnIndex].metrics.push({ run: run.id, width: run.width, height: run.height, feed: 8,
        assignment: run.secondYarnAssignment, evidenceClass: 'SOFTWARE_DERIVED', target: d.target,
        m1: d.m1, m2: d.m2, m3: d.m3, candidateMinimum: d.candidateMinimum ?? null,
        candidateApplied: d.candidateApplied, failedCandidate: d.failedCandidate ?? null,
        finalAppliedGeometry: d.finalAppliedGeometry, factoryComparison: 'NOT_COMPARABLE' });
    }
  }
  r.numericStatus = r.numericChecks.some(check => check.status === 'NUMERIC_DRIFT') ? 'NUMERIC_DRIFT' : 'MATCH';
  assert.equal(r.numericStatus, 'MATCH', 'NUMERIC_DRIFT: investigate source/input changes; expected values were not modified');
  r.confirmedSoftwareGaps = ['Saved fixture lacks 20D LOW asset and all target8 assignments',
    'Saved fixture tension null versus SOP 5/4 cN; tension not active in Geometry',
    'Existing diagnostic second-yarn target8 is unreachable on all Feeds; failed candidate unapplied',
    'Cylinder diameter, full machine needle count, greige width and weight not modeled',
    'M1/M2/M3 use different measurement scopes; factory contract unresolved'];
}

function report(r) {
  if (r.blocker) return `# SOP-001 Real Business Comparison\n\n**FACT — SOP001_COMPARISON_HARNESS = BLOCKED**\n\n${r.blocker.message}\n\nNumeric status: ${r.numericStatus ?? 'UNKNOWN'}. Expected values have not been updated. See [results.json](results.json) for input comparisons, errors and verification.\n\nCANONICAL_FACTORY_MEASUREMENT = PENDING_PROCESS_CONFIRMATION\n\nREAL_MACHINE_VALIDATION = NOT_YET_ESTABLISHED\n`;
  const n = value => Number(value).toFixed(9);
  const table = rows => rows.map(row => '| ' + row.join(' | ') + ' |').join('\n');
  const metricRows = r.yarns.flatMap(y => y.metrics.filter(m => y.name === '20D LOW' || m.assignment === 'ABSENT')
    .map(m => [y.name, `${m.width}×${m.height}/F8`, m.target.value, n(m.m1.value), n(m.m2.value), n(m.m3.value), m.m1.status,
      y.name === '20D LOW' ? 'UNREACHABLE / NOT_COMPARABLE' : 'SOFTWARE_DERIVED / NOT_COMPARABLE']));
  const checks = Object.values(r.verification.checks).map(c => [c.command, c.exitCode === 0 ? 'PASS' : `exit ${c.exitCode}`]);
  return `# SOP-001 Real Business Comparison

2026-10-18 · P0-C0 Correctness Preparation · FACT: main @ ${r.head}，已有未提交改动。

**SOP001_COMPARISON_HARNESS = ${r.harnessStatus}**，仅表示对比与证据记录完成；fixture仍为 **${r.fixture.status}**，业务对比 **NOT_COMPARABLE**。

## 1. Source Evidence

- SOP_RECORDED：用户本轮完整SOP转录；原始单位保留，详细六项来源字段在 [results.json](results.json) 的 sop 中。
- FACT：通过当前 readProjectPackage 读取 [真实with-cam项目](../sop-001/SOP-001-N6W6040-main-yarn-with-cam.knitscape)，SHA-256 ${r.fixture.sha256}。
- FACT：Cam沿用 [with-cam报告§7](../sop-001/with-cam/REPORT.md) 和其 results 的既有转录；工艺图字节校验 ${r.fixture.cam.sheetHashMatches}。本轮没有重新看图猜Cam。
- SOFTWARE_DERIVED：原样执行 [observability probe](../yarn-length-observability-2026-10-18/diagnostic.mjs)，保留所有原断言；M3调用既有 independent-auditor。仅在隔离子进程截获该probe写results的操作，历史结果文件不被覆盖。
- FACT：照片关联靠历史用户指定记录及SHA-256，不凭文件名。UNKNOWN：工厂测量契约、实际路径、负载、物性。
- FACT：results保存源文件指纹、48条Feed×Yarn当前计算记录、原probe日志和本轮验证输出。旧probe整对象基线比较也包含HEAD；未来HEAD/元数据变化会阻止运行，必须区分元数据差异与真实数值漂移，不能自动更新expected。

## 2. SOP Structured Data

以下均为 SOP_RECORDED，测量原理/适用状态 UNKNOWN，置信度为“资料转录，未经本轮实测”。

| Machine field | SOP value |
|---|---|
| Station / type | K01 / 巨登，单面 |
| Cylinder / Gauge / needles | 32 inch / 32G / 3216 |
| Material No / arrangement | NB2D0106-AA01AC / 1234 |

| Yarn field | N6/W(6040) | 20D LOW |
|---|---|---|
| Ratio / lot | 91.20% / Y38W9N60NW-Z | 8.80% / Z2704 |
| Feed record / mouths | 1.2.3.4.5.6.7.8 / 96 | 1.2.3.4.5.6.7.8 / 96 |
| Feeder depth | 3 cm | 5.6 cm |
| Plate scale / gear count | 30 / 36 | 124 / 36 |
| Tension record | 5 cN | 4 cN |
| Actual yarn length recorded | 23 cm / 100G | 8 cm / 100G |

SOP备注：纱长测试标准为织机100针长度；不等于已确认软件measurement contract。23/8的setpoint / actual measured / QC target角色均 PENDING_PROCESS_CONFIRMATION。

坯布幅宽56 inch，坯布克重264 G/Y。±2%仅为 **SOP_RECORDED_TOLERANCE**；23的22.54–23.46、8的7.84–8.16仅为 **INFERENCE / DERIVED_FROM_SOP_RECORDED_TOLERANCE**，未用于M1或任何软件PASS/FAIL。

## 3. Software Fixture

FACT：当前保存项目${r.softwareInputs.width}×${r.softwareInputs.height}，Gauge ${r.softwareInputs.machineGauge}，排针 ${r.softwareInputs.needleArrangement.join('')}；8个Feed仅分配N6/W，每项target23、tension=null、placement=parallel。默认Yarn1留在库内但未被Feed选用；默认companion禁用。没有20D LOW资产/target8。

模型diameter=${r.softwareInputs.diameter.value}（model needle pitch），来自Legacy primary fallback；lengthScaleY=${r.softwareInputs.primaryLengthScaleY.value}。均为FACT软件输入，真实直径UNKNOWN。N6/W四张PBR及22.987mm纹理U重复参数来自已有包，其条件性来源见results；solid诊断不渲染贴图。当前材质支持asset字段，不等于本包具有实测材料数据。

诊断复用原probe：30/32宽各跑saved-main-yarn及diagnostic-two-yarn，共4场景；第二纱仅为内存中的 **SYNTHETIC_DIAGNOSTIC_ONLY**（8 Feed、target8、parallel、未标定fallback）。未修改或另存comparison fixture，亦未宣称该分配为真实生产。

## 4. Input Match

| Field | SOP | Fixture | Status |
|---|---|---|---|
| Gauge | 32 | ${r.softwareInputs.machineGauge} | ${r.inputComparison.machine.gaugeMatch} |
| Arrangement | 1234 | ${r.inputComparison.machine.arrangementSoftware} | ${r.inputComparison.machine.arrangementMatch} |
| Cam | 历史真实4×8转录 | 逐格及Domain输出比对 | ${r.fixture.cam.status} |
| Feed cycle | 1–8 | 8 Feeds | MATCH |
| N6/W mapping / target | 1–8 / 23 | 1–8 / 23 | INPUT_MATCH |
| 20D mapping / target | 1–8 / 8 | absent / null | FIXTURE_MISMATCH |
| N6/W tension | 5 cN | null, F1–8 | FIXTURE_MISMATCH |
| 20D tension | 4 cN | absent, F1–8 | FIXTURE_MISMATCH |
| Cylinder / machine needles | 32 inch / 3216 | null / null | NOT_MODELED |

FACT：所有差异逐Feed保存在inputComparison.fixtureMismatches，每条含field、SOP value、Fixture value、evidence；共${r.inputComparison.fixtureMismatches.length}条。不把未建模字段填成MATCH，也不把主纱保存版的缺失称为已证明的录入错误。

FACT：Type1=KKKKKKTT、Type2=KKKKTTKK、Type3=KKTTKKKK、Type4=TTKKKKKK；24K/8T/0M。工艺来源 → 历史转录 → 当前包 → resolveSingleJerseyOperations → adapter比对；没有默认全K替换。实际针踵命名、方向及96口映射仍待工艺确认。

## 5. Yarn Length Comparison

下表全部为SOFTWARE_DERIVED；只摘Feed8，全部Feed与窗口/分母/单位在results.runs。M1为cm/100 needles；M2为历史cm/100 loops共享Pattern预览统计，**不是每纱读数**；M3为cm/100 needle passages最终路径诊断。

| Yarn | Window / Feed | SOP记录数值 | M1 | M2共享上下文 | M3最终路径 | Solver status | Comparison status |
|---|---|---:|---:|---:|---:|---|---|
${table(metricRows)}

FACT：Numeric regression=${r.numericStatus}。Expected来自用户给出的历史近似值，M1/M2/M3比较1e-8、第二纱minimum比较1e-6仅用于舍入后的软件回归；与SOP ±2%无关。所有原probe精确基线断言也保留。

## 6. 23cm Analysis

SOFTWARE_DERIVED：主纱所有Feed均CONVERGED并应用。30宽M1积分周期30，32宽周期4；M1平均同Feed所有有限course（F8含顶边row39），M3选择内部完整重复course。M2来自排针前基础Pattern且与Feed/Yarn无关。窗口、边界及分母不同使M1/M2/M3不同；23接近M1只说明当前软件objective收敛。不能认定M1为工厂canonical metric，不能由M3不同判M3错误。32宽结果不冒充原30宽fixture。

## 7. 8cm Analysis

SOFTWARE_DERIVED：原fixture没有第二纱；既有人工诊断的全部Feed为 **UNREACHABLE_TARGET**，8未应用到最终Geometry。

| Window | Target | F8 reachable minimum / failed M1 candidate | Candidate M3 | Candidate loopHeight | candidateApplied | Final geometry M3 |
|---|---:|---:|---:|---:|---|---:|
${table(r.yarns[1].metrics.map(m => [`${m.width}×${m.height}`, 8, n(m.candidateMinimum), n(m.m3.solverCandidateValue), m.m1.solvedLoopHeight, false, n(m.m3.value)]))}

candidateMinimum只是当前模型/参数/bounds下的M1可达最小值，不是实机最低值或最终软件纱长。失败candidate保留用于诊断，最终仍是base fallback path；M3最终路径与candidate M3分列。未应用target8不证明SOP错误，20D名称也不证明弹力或预牵伸。

## 8. Material / Tension Gap

FACT：tension记录在本报告的SOP中recorded=true，历史fixture recordedInFixture=false，activeInGeometry=false；源码tensionCN只在数据规范化/赋值出现，不进入Solver/Geometry。没有tensionMatch=PASS。

FACT：当前resolveYarnMaterial可解析asset颜色/直径/PBR；此fixture的asset无实测直径，实际走Legacy 0.24 fallback。第二纱诊断同样继承0.24，不是禁用companion的0.14。parallel是软件几何排列，不是已确认工艺路径。材料力学 NOT_MODELED，真实材料身份、diameter、density、elasticity、draft、friction、compression、relaxation均UNKNOWN。

| Yarn | Effective diameter | Source | Unit | Measured diameter | Scope |
|---|---:|---|---|---|---|
${table(r.yarns.map(y => [y.name, y.software.diameter.effectiveDiameter, y.software.diameter.diameterSource,
  y.software.diameter.effectiveDiameterUnit, y.software.diameter.measuredDiameterStatus, y.software.diameter.scope]))}

**SAME EFFECTIVE VALUE ≠ SAME REAL DIAMETER**。这些来源是派生软件元数据，不写入项目/Undo；Asset explicit也不自动等于实测。SECOND_YARN_DIAMETER_FALLBACK = NEEDS_CONTRACT；保留当前primary兼容行为。

SOP比例、批号、导纱深度、盘刻度、齿数和96口记录未成为经过验证的Geometry输入，不由比例推导几何或从照片校准。

## 9. Fabric-Level Data

SOP_RECORDED：56 inch、264 G/Y。当前布面幅宽模型、坯布重量模型均 **NOT_MODELED**，软件值null；未换算GSM。30×40/32×40 chart不是幅宽，也不是3216针整机圆筒。

## 10. Visual Reference

FACT：visualReference=${r.visualReference.status}；路径 [面料放大.jpg](../../面料放大.jpg)，SHA-256 ${r.visualReference.sha256}。历史用户明确指定img007.jpg；几何审计记录其与现文件字节一致，本轮核对哈希并目视检查。

FACT / VISUAL_OBSERVATION：可见编织线圈、表面毛羽、交叉和遮挡。只作视觉基准/后续入口；无尺度标定，不推导diameter、wale/course spacing mm、density、elastic recovery、relaxation coefficient、friction或physical scale，未生成替代图。

## 11. Confirmed Matches

FACT：32G、1234、既有Cam转录的32格及Machine Domain K/T/M、8 Feed cycle。N6/W名称/Feed记录及target23仅INPUT_MATCH。照片内容身份有哈希证据。任何上述匹配均不证明工厂测量契约。

## 12. Confirmed Software Gaps

${r.confirmedSoftwareGaps.map(gap => `- FACT：${gap}`).join('\n')}

## 13. Unknowns Blocking Factory Validation

${r.unknowns.map(q => `- **${q.id} — UNKNOWN / PENDING_PROCESS_CONFIRMATION**：${q.question}`).join('\n')}

另有真实直径、density、弹性曲线、摩擦、压缩、relaxation与finish后状态UNKNOWN。原始23/8栏名保留，不替工艺确认其value type。

## 14. Next Decision

需要工艺人员提供Q1–Q7可追溯答案（回答者、日期、SOP版本、取样示意/步骤、起止针、Feed、负载/回缩状态、数值角色及容差依据），才可选择下一步契约或模型工作。本轮停止，不修Solver、不开发第二纱模型或YarnTopology。

FACT：运行方式：

\`\`\`powershell
node reports/sop-001-business-comparison-2026-10-18/comparison.mjs --verify
\`\`\`

省略--verify仅重跑comparison，verification明确NOT_RUN，不沿用旧验证成功。失败会写BLOCKED并exit1；fixture不完整或UNKNOWN本身不会被隐藏，也不自动把成功的对比记录判作工厂失败。运行依赖现有工作区依赖和历史probe，其计算断言均未削弱。

可加 --output-dir=reports/<新目录> 保存新的 results.json 和 SOP-COMPARISON.md，保留原历史结果。本轮输出目录：${ownDirectory}。

| Current-run check | Result |
|---|---|
${table(checks)}

FACT：Known baseline failures=${(r.verification.baselineFailures ?? []).join(', ') || (r.verification.mode === 'NOT_RUN' ? 'NOT_RUN' : 'none')}；New failures=${r.verification.newFailures?.length ?? 'NOT_RUN'}。已知validate:row-length-loop-model为当前功能文档标题断言；未修标题迎合suite。完整stdout/stderr、exit code均在results.verification.checks。

FACT：${r.preservation.checkedFileCount}个既有文件前后SHA-256核对；目录外改变=${JSON.stringify(r.preservation.changedOutsideReportDirectory)}。src changed=${r.preservation.srcChanged}；package.json changed=${r.preservation.packageJsonChanged}；package-lock changed=${r.preservation.packageLockChanged}；Project format changed=${r.preservation.projectFormatChanged}；algorithms changed=${r.preservation.algorithmsChanged}。Solver/Geometry/M1/M2/M3业务源码及既有probe未改。无commit/tag；build正常生成的ignored产物不纳入源码保全断言。

**SOP001_COMPARISON_HARNESS = ${r.harnessStatus}**

**CANONICAL_FACTORY_MEASUREMENT = PENDING_PROCESS_CONFIRMATION**

**REAL_MACHINE_VALIDATION = NOT_YET_ESTABLISHED**
`;
}
