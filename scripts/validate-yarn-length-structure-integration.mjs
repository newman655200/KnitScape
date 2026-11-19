import assert from "node:assert/strict";
import { createServer } from "vite";

// Only drawing surfaces and timers are fixtures. Actions/state/runner/solver are real.
globalThis.devicePixelRatio = 1;
globalThis.Path2D = class { constructor(data = "") { this.data = data; } };
const timers = new Map(); let nextTimer = 0;
globalThis.window = { clearTimeout(id) { timers.delete(id); },
  setTimeout(callback) { timers.set(++nextTimer, callback); return nextTimer; } };
function flush() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); }
const canvases = new Map(["back", "mid", "front", "back-arranged", "mid-arranged", "front-arranged"].map(id => {
  const paths = [];
  const context = { clearRect() { paths.length = 0; }, save() {}, restore() {},
    stroke(path) { paths.push(path.data); }, createPattern() { return null; } };
  return [id, { width: 0, height: 0, style: {}, paths, getContext: () => context }];
}));
const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
globalThis.document = { createTreeWalker() { return {}; }, getElementById(id) {
  if (id === "machine-execution-error") return { hidden: true, textContent: "" };
  if (id.includes("container") || id === 'desktop') return { getBoundingClientRect: () => ({ width: 320, height: 240 }) };
  return canvases.get(id);
} };
try {
  const [state, actions, library, runner, { Bimp }, { getProjectData }, importer] = await Promise.all([
    server.ssrLoadModule('/src/state.js'), server.ssrLoadModule('/src/actions/singleJerseyCamProgram.js'),
    server.ssrLoadModule('/src/actions/yarnLibrary.js'), server.ssrLoadModule('/src/components/runSimulation.js'),
    server.ssrLoadModule('/src/lib/Bimp.js'), server.ssrLoadModule('/src/actions/exporters.js'),
    server.ssrLoadModule('/src/actions/importers.js'),
  ]);
  const current = () => state.GLOBAL_STATE;
  const revision = () => current().feedYarnStructureRevision;
  assert.equal(revision(), 0, 'App initialization starts at generation 0');
  const yarn = (yarnId, length) => ({ yarnId, yarnLengthCmPer100Needles: length, tensionCN: 12, placement: 'parallel' });
  const length = (feed = 0, slot = 0) => current().singleJerseyCamProgram.feeds[feed].yarns[slot].yarnLengthCmPer100Needles;
  const select = (...positions) => ({ structureRevision: revision(), targets: positions.map(([feedIndex, yarnIndex = 0]) =>
    ({ feedIndex, yarnIndex, yarnId: current().singleJerseyCamProgram.feeds[feedIndex].yarns[yarnIndex].yarnId })) });
  state.dispatch({ chart: Bimp.empty(48, 60, 0), machineGauge: 32, needleArrangement: [1, 2, 3, 4],
    yarnSequence: Bimp.empty(1, 60, 0), texturePerformanceMode: 'solid' });
  const commits = [];
  state.StateMonitor.register([() => ({ syncState(snapshot, changes) {
    if (changes.includes('singleJerseyCamProgram')) commits.push(snapshot);
  } }), runner.runSimulation()]);
  function prepare(pair = [yarn('A', 23), yarn('B', 18)]) {
    actions.createSingleJerseyCamProgram(4, 4);
    ['A', 'C', 'D', 'E'].forEach((id, feed) => actions.setSingleJerseyFeedYarns(feed, [yarn(id, 23)]));
    actions.setSingleJerseyFeedYarns(0, pair); flush();
    assert.equal(current().previewValidity, 'VALIDATED');
  }
  function reject(selection, value = 27, reason = 'STALE_ASSIGNMENT_STRUCTURE') {
    const before = current(); const pending = timers.size; const count = commits.length;
    const paths = [...canvases.values()].map(canvas => [...canvas.paths]);
    assert.deepEqual(actions.setSingleJerseyFeedYarnLengths(selection, value), { ok: false, reason, updatedCount: 0 });
    assert.equal(current(), before, 'Rejected batch must not dispatch or invalidate valid simulation');
    assert.equal(timers.size, pending); assert.equal(commits.length, count);
    assert.deepEqual([...canvases.values()].map(canvas => [...canvas.paths]), paths);
  }
  function success(selection) {
    const rev = revision();
    assert.equal(actions.setSingleJerseyFeedYarnLengths(selection, 27).ok, true);
    assert.equal(revision(), rev); flush(); assert.equal(current().previewValidity, 'VALIDATED');
  }
  const results = [];
  const record = testCase => results.push({ testCase, revision: revision(), targets: current().singleJerseyCamProgram.feeds.map(f =>
    f.yarns.map(y => y.yarnLengthCmPer100Needles)), previewValidity: current().previewValidity });

  prepare(); const a = select([0, 0]);
  library.removeFeedYarnSlot(0, 0);
  actions.setSingleJerseyFeedYarns(0, [yarn('A', 23), yarn('B', 18)]); flush();
  reject(a); assert.equal(length(), 23); record('BLOCKER A: delete/recreate same slot/id');

  prepare([yarn('A', 23), yarn('A', 18)]); const b = select([0, 1]);
  library.removeFeedYarnSlot(0, 0); flush(); reject(b); assert.equal(length(), 18); record('BLOCKER B: selected slot shifts');
  prepare([yarn('A', 23), yarn('A', 18)]); const bWrongTarget = select([0, 0]);
  library.removeFeedYarnSlot(0, 0); flush(); reject(bWrongTarget); assert.equal(length(), 18); record('BLOCKER B: unselected sibling occupies old slot');

  prepare(); const c = select([0, 0], [2, 0]);
  actions.setSingleJerseyFeedYarns(1, [yarn('C', 23), yarn('A', 18)]); flush();
  reject(c); assert.equal(length(0), 23); assert.equal(length(2), 23); record('BLOCKER C');

  prepare(); const d = select([0, 0]);
  actions.setSingleJerseyFeedYarnLength(0, 0, 24); flush(); assert.equal(revision(), d.structureRevision);
  success(d); assert.equal(length(), 27); record('BLOCKER D');

  prepare(); const e = select([0, 0]);
  library.updateYarnAsset('A', 'Updated name', 'OTHER');
  library.clearYarnPbr('A');
  const cam = current().singleJerseyCamProgram;
  state.dispatch({ singleJerseyCamProgram: { ...cam, feeds: cam.feeds.map((feed, i) => i ? feed : { ...feed,
    yarns: feed.yarns.map(y => ({ ...y, tensionCN: 20, placement: 'plating' })) }) } }); flush();
  assert.equal(revision(), e.structureRevision); success(e); record('BLOCKER E');

  prepare(); const f = select([0, 0]);
  library.assignYarnToFeed(0, 0, 'B'); flush(); reject(f); assert.equal(length(), 23); record('BLOCKER F');

  prepare();
  actions.setSingleJerseyFeedYarnLengthInputMode(0, 0, 'relaxedWithDraft');
  actions.setSingleJerseyFeedYarnLength(0, 0, 8);
  actions.setSingleJerseyFeedYarnDraftRatio(0, 0, 3);
  const relaxedReplacementRevision = revision();
  library.assignYarnToFeed(0, 0, 'B');
  const replaced = current().singleJerseyCamProgram.feeds[0].yarns[0];
  assert.equal(revision(), relaxedReplacementRevision + 1);
  assert.equal(replaced.lengthInputMode, 'relaxedWithDraft');
  assert.equal(Object.hasOwn(replaced, 'relaxedLengthCmPer100Needles'), false,
    'A replacement Yarn cannot inherit another Yarn measurement');
  assert.equal(Object.hasOwn(replaced, 'draftRatio'), false,
    'A replacement Yarn cannot inherit another Yarn draft ratio');
  assert.equal(Object.hasOwn(replaced, 'yarnLengthCmPer100Needles'), false);
  assert.deepEqual(current().yarnLengthSolverResults, []);

  prepare(); const g = select([0, 0]); const project = JSON.parse(JSON.stringify(getProjectData()));
  project.feedYarnStructureRevision = g.structureRevision; // Imported runtime data cannot restore the old generation.
  importer.loadJSON(project); flush(); reject(g); assert.equal(length(), 23); record('BLOCKER G');

  const checks = [];
  function changes(name, mutate, expected = 1) {
    const rev = revision(); mutate(); assert.equal(revision(), rev + expected, name); checks.push(name);
  }
  changes('same-ID complete replacement', () => actions.setSingleJerseyFeedYarns(0,
    current().singleJerseyCamProgram.feeds[0].yarns));
  changes('same-ID reorder', () => actions.setSingleJerseyFeedYarns(0, [yarn('A', 18), yarn('A', 23)]));
  changes('same-ID reorder reverse', () => actions.setSingleJerseyFeedYarns(0,
    [...current().singleJerseyCamProgram.feeds[0].yarns].reverse()));
  changes('Feed resize', () => actions.resizeSingleJerseyCamProgram(4, 5));
  changes('Track resize only', () => actions.resizeSingleJerseyCamProgram(5, 5), 0);
  changes('Cam operation', () => actions.setSingleJerseyCamOperation(0, 0, 'T'), 0);
  changes('Gauge/arrangement', () => state.dispatch({ machineGauge: 31, needleArrangement: [1, 2] }), 0);
  changes('explicit Clear length', () => actions.clearSingleJerseyFeedYarnLength(0, 0), 0);
  changes('switch relaxed input mode', () => actions.setSingleJerseyFeedYarnLengthInputMode(0, 0, 'relaxedWithDraft'), 0);
  changes('relaxed length edit', () => actions.setSingleJerseyFeedYarnLength(0, 0, 8), 0);
  changes('draft ratio edit', () => actions.setSingleJerseyFeedYarnDraftRatio(0, 0, 3), 0);
  changes('explicit Clear draft', () => actions.clearSingleJerseyFeedYarnDraftRatio(0, 0), 0);
  changes('switch direct input mode', () => actions.setSingleJerseyFeedYarnLengthInputMode(0, 0, 'directTarget'), 0);
  changes('solver/validity', () => state.dispatch({ yarnLengthSolverResults: [], previewValidity: 'DESIGN_PREVIEW' }), 0);
  changes('failed full replacement', () => assert.throws(() => actions.setSingleJerseyFeedYarns(0, [yarn('A', -1)])), 0);
  changes('runtime field cannot be overwritten', () => state.dispatch({ feedYarnStructureRevision: 0 }), 0);
  changes('legacy workspace load replacement', () => state.loadWorkspace({ singleJerseyCamProgram:
    structuredClone(current().singleJerseyCamProgram), feedYarnStructureRevision: 0 }));
  changes('delete Cam', () => actions.deleteSingleJerseyCamProgram());
  changes('create Cam', () => actions.createSingleJerseyCamProgram(4, 4));
  changes('recreate identical Cam', () => actions.createSingleJerseyCamProgram(4, 4));
  prepare();
  reject(select([0, 0]), -1, 'INVALID_YARN_LENGTH');
  reject({ targets: select([0, 0]).targets });
  reject(select([0, 0]).targets); // No implicit capture-at-submit bypass.
  const staleFirst = select([0, 0]); actions.setSingleJerseyFeedYarns(0, [yarn('A', 23)]); flush();
  reject(staleFirst, -1); // Revision guard runs before value or locators.
  for (let i = 1; i < commits.length; i++) assert.ok(commits[i].feedYarnStructureRevision >= commits[i - 1].feedYarnStructureRevision);
  const exported = JSON.stringify(getProjectData());
  assert.ok(!exported.includes('feedYarnStructureRevision')); assert.ok(!exported.includes('structureRevision'));
  const { createProjectPackage, readProjectPackage } = await server.ssrLoadModule('/src/actions/projectPackage.js');
  const packageBlob = await createProjectPackage(getProjectData());
  const { ZipReader, BlobReader, TextWriter } = await import('@zip.js/zip.js');
  const zip = new ZipReader(new BlobReader(packageBlob), { useWebWorkers: false });
  const manifest = await (await zip.getEntries()).find(entry => entry.filename === 'project.json').getData(new TextWriter());
  await zip.close();
  assert.ok(!manifest.includes('feedYarnStructureRevision')); assert.ok(!manifest.includes('structureRevision'));
  const beforePackageLoad = select([0, 0]);
  const opened = await readProjectPackage(packageBlob);
  importer.loadJSON(opened.project, opened.registry); flush(); reject(beforePackageLoad);
  checks.push('.knitscape manifest excludes runtime revisions; package import invalidates identical locators');
  results.forEach(result => console.log(JSON.stringify(result)));
  console.log(JSON.stringify({ checks }));
  runner.stopSimulation();
  console.log('PASS: P0-4B BLOCKER A–G; ABA/shift rejection, parameter validity, load boundary and runtime revision atomicity.');
} finally { await server.close(); }
