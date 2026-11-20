import { color as parseColor } from 'd3';
import { buildSopTopology } from '../simulation/sopTopologyAdapter.js';
import { buildSopSpatialHypothesis, SOP_SPATIAL_DEFAULTS, buildSopVisualSwatch, SOP_VISUAL_SWATCH_DEFAULTS } from '../simulation/sopSpatialHypothesis.js';
import { buildSopInterlockSwatch, SOP_INTERLOCK_DEFAULTS } from '../simulation/sopInterlockSwatch.js';
import { createYarnSpatialPreviewRenderer } from '../simulation/yarnSpatialPreviewRenderer.js';
import { createSimulationSnapshot } from '../simulation/simulationSnapshot.js';

const DEFAULT_ROI = { needleIndex: 16, rowStart: 21, rowEnd: 24 };
const { enabled: _defaultEnabled, ...DEFAULT_OPTIONS } = SOP_SPATIAL_DEFAULTS;
// Leave the automatic inspection and whole-sheet tessellation to the swatch builder.
// An explicit setOptions({ radialSegments }) then persists across size changes.
const { radialSegments: _automaticSegments, ...SWATCH_OPTION_DEFAULTS } = SOP_INTERLOCK_DEFAULTS;
const sourceKey = context => JSON.stringify([context.projectGeneration, context.feedYarnStructureRevision,
  context.machineSnapshot?.inputSignature, context.machineSnapshotPending, context.machineSnapshotError]);
const badRenderer = status => ['INVALID', 'ERROR', 'UNAVAILABLE', 'CONTEXT_LOST'].includes(status?.status);
export const swatchYarnKey = yarn => JSON.stringify([yarn.yarnIndex, String(yarn.yarnId)]);
const linearChannel = byte => {
  const channel = byte / 255;
  return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
};

// This controller consumes the coordinator's already computed machine snapshot only.
export function createSopTopologyWorkbenchController({ context, session = null, startInSwatch = false, onChange = () => {},
  createRenderer = createYarnSpatialPreviewRenderer, buildHypothesis = buildSopSpatialHypothesis, buildSwatch = buildSopInterlockSwatch,
  auditGeometry = async (input, settings) => (await import('../simulation/yarnGeometryAudit.js')).auditYarnGeometry(input, settings),
  planVisualCorrection = async (input, report) => (await import('../simulation/sopSpatialHypothesis.js')).planAuditedVisualTransitionTrims(input, report),
  applyVisualCorrection = null,
  buildJointCandidate = applyVisualCorrection ?? (async (input, report, settings) => (await import('../simulation/sopSpatialHypothesis.js')).buildAuditedVisualJointCandidate(input, report, settings)),
  applyTrimDiagnostic = async (input, report, settings) => (await import('../simulation/sopSpatialHypothesis.js')).applyAuditedVisualTransitionTrims(input, report, settings) }) {
  let current = context, key = sourceKey(context), disposed = false, epoch = 0, pending = null;
  const saved = session?.projectGeneration === context.projectGeneration ? session : null;
  let roi = createSimulationSnapshot({ ...DEFAULT_ROI, ...saved?.roi });
  let options = createSimulationSnapshot(startInSwatch ? { ...SWATCH_OPTION_DEFAULTS, fullSize: false } : { ...DEFAULT_OPTIONS, ...saved?.options });
  let enabled = startInSwatch, view = startInSwatch ? null : saved?.view ?? null, yarnFilter = startInSwatch ? 'all' : saved?.yarnFilter ?? 'all';
  let swatch = startInSwatch, evidenceView = false, selectionFilter = {}, materialBindings = saved?.materialBindings ?? {}, scanAxis = 'x';
  let generatedChains = 0;
  let topology = null, derivedGeometry = null, selectedLinkId = null, error = null;
  let renderer = null, viewport = null, clearing = false, rendererStatus = Object.freeze({ status: 'UNMOUNTED' });
  let sceneEpoch = 0, profileRunning = false, profileReport = null;
  let auditEpoch = 0, auditRunning = false, auditProgress = null, auditReport = null;
  let auditPathIds = null, auditSelectedFindingId = null;
  let correctionPlan = null, correctionReport = null, correctionRunning = false;
  let comparisonState = 'G0', comparisonStates = Object.freeze({ G0: null, Gt: null, Gn: null });
  let jointTargetId = null, debugMode = 'pbr', geometrySerial = 0;
  const geometryVersions = new WeakMap();
  const auditCache = new WeakMap();
  const notify = () => { if (!disposed) onChange(); };
  function clearScene() {
    sceneEpoch++; profileRunning = false; profileReport = null;
    auditEpoch++; auditRunning = false; auditProgress = auditReport = auditPathIds = auditSelectedFindingId = null;
    correctionPlan = correctionReport = null; correctionRunning = false;
    comparisonState = 'G0'; comparisonStates = Object.freeze({ G0: null, Gt: null, Gn: null }); jointTargetId = null;
    generatedChains = 0; derivedGeometry = null;
    if (renderer && !clearing) {
      clearing = true;
      try { renderer.update({ scene: [] }); } catch { /* Disposing also releases a failed scene. */ }
      finally { clearing = false; }
    }
  }
  function release() {
    epoch++; pending = null; clearScene();
    renderer?.dispose(); renderer = null; rendererStatus = Object.freeze({ status: 'UNMOUNTED' });
  }
  function fail(caught) {
    epoch++; pending = null;
    error = String(caught?.diagnostic || caught?.message || caught); clearScene(); notify();
  }
  function readSource() {
    if (current.machineSnapshotPending || current.machineSnapshotError || !current.machineSnapshot ||
      current.machineSnapshot.projectGeneration !== current.projectGeneration ||
      current.machineSnapshot.feedYarnStructureRevision !== current.feedYarnStructureRevision) {
      return createSimulationSnapshot({ status: 'UNAVAILABLE', reason: current.machineSnapshotPending ? 'MACHINE_SNAPSHOT_PENDING' :
        current.machineSnapshotError || (!current.singleJerseyCamProgram?.tracks?.length ? 'SOP_CAM_REQUIRED' :
          !current.needleArrangement?.length ? 'SOP_NEEDLE_ARRANGEMENT_REQUIRED' : 'CURRENT_MACHINE_SNAPSHOT_REQUIRED'),
        roi, operations: [], occurrences: [], links: [], strands: [], cnReferences: [], spatialRelations: [] });
    }
    try { return buildSopTopology(current.machineSnapshot, swatch ? { window: 'full' } : roi); }
    catch (caught) { return createSimulationSnapshot({ status: 'UNAVAILABLE', reason: String(caught.message || caught),
      roi, operations: [], occurrences: [], links: [], strands: [], cnReferences: [], spatialRelations: [] }); }
  }
  function filteredScene(result) {
    const paths = new Map(result.paths.map(path => [path.id, path]));
    const source = evidenceView && swatch ? result.evidenceScene : result.scene;
    return source.filter(item => {
      const path = paths.get(item.id);
      return path && (!auditPathIds || auditPathIds.includes(path.id)) && (yarnFilter === 'all' ||
        String(path.yarnId) === String(yarnFilter) || swatchYarnKey(path) === yarnFilter) &&
        Object.entries(selectionFilter).every(([key, value]) => value === null || value === '' ||
          (key === 'occurrenceId' ? Object.entries(path.provenance ?? {}).some(([field, ids]) =>
            /(?:^occurrenceIds$|OccurrenceIds$)/.test(field) && Array.isArray(ids) && ids.includes(value)) : path[key] === value));
    }).map(item => {
      if (!swatch) return item;
      const path = paths.get(item.id), assetId = materialBindings[swatchYarnKey(path)] ?? materialBindings[path.yarnId] ?? path.yarnId;
      const asset = current.yarnLibrary?.find(asset => String(asset.id) === String(assetId));
      // Scan alpha blends onto the yarn asset color, including with a BaseColor map.
      const rgb = debugMode === 'pbr' && asset?.color
        ? parseColor(asset.color)?.rgb().clamp() : null;
      return { ...item, material: { ...item.material, color: rgb ? [rgb.r, rgb.g, rgb.b].map(linearChannel) : item.material.color,
        pbr: asset?.pbr ?? null, ambient: .35, lightIntensity: 5.6, lightDirection: [-.60, .70, .71], scanAxis } };
    });
  }
  function applyScene() {
    const sceneToken = ++sceneEpoch; profileReport = null; profileRunning = false;
    if (!renderer || !derivedGeometry) { notify(); return; }
    const target = renderer, token = epoch;
    const currentScene = () => token === epoch && sceneToken === sceneEpoch && target === renderer && !disposed;
    try {
      const applied = target.update({ scene: filteredScene(derivedGeometry), batchOrder: swatch ? 'material' : 'source', debugMode });
      if (badRenderer(applied)) { fail(applied); return; }
      pending = Promise.resolve(target.ready?.()).then(() => {
        if (!currentScene()) return;
        if (badRenderer(target.status)) fail(target.status);
        notify();
      }).catch(caught => { if (currentScene()) fail(caught); });
    } catch (caught) { fail(caught); }
    notify();
  }
  function scheduleGeometry() {
    if (!enabled || topology?.status !== 'READY' || disposed || !viewport || pending) return;
    const token = ++epoch, captured = topology;
    const isCurrent = () => !disposed && enabled && token === epoch && topology === captured;
    pending = Promise.resolve().then(async () => {
      if (!isCurrent()) return;
      const result = swatch ? await buildSwatch(captured, { ...options,
        repeatWidth: current.needleArrangement?.length, repeatHeight: current.singleJerseyCamProgram?.tracks?.[0]?.length },
        options.fullSize ? async count => {
          if (!isCurrent()) return false;
          generatedChains = count;
          notify();
          await new Promise(resolve => setTimeout(resolve, 0));
          return isCurrent();
        } : undefined) : buildHypothesis(captured, { ...options, enabled: true });
      if (!isCurrent()) return;
      if (result.status !== 'OK') { fail(result.reason || result.diagnostics?.map(item => item.message || item.code).join('; ') || result.status); return; }
      renderer = createRenderer({
        swatchLighting: swatch,
        scanHalfWidth: result.mode === 'SOP_INTERLOCK_SWATCH'
          ? Math.PI * result.parameters.radiusMm / result.parameters.uvRepeatLengthMm : 1,
        onViewChange(next) { if (isCurrent()) { view = createSimulationSnapshot(next); notify(); } },
        onStatusChange(next) {
          if (!isCurrent()) return;
          rendererStatus = createSimulationSnapshot(next);
          if (!clearing && badRenderer(next)) fail(next);
          notify();
        },
      });
      const mounted = renderer.mount(viewport);
      if (!isCurrent()) { release(); return; }
      if (badRenderer(mounted)) { fail(mounted); return; }
      let applied, appliedSceneEpoch;
      do {
        appliedSceneEpoch = sceneEpoch;
        applied = renderer.update({ scene: filteredScene(result), batchOrder: swatch ? 'material' : 'source', debugMode, ...(view ? { view } : swatch ? { view: { yaw: 0, pitch: 0 } } : {}), fit: !view });
        if (badRenderer(applied)) { fail(applied); return; }
        await renderer.ready?.();
        if (!isCurrent()) return;
        if (badRenderer(renderer.status)) { fail(renderer.status); return; }
      } while (appliedSceneEpoch !== sceneEpoch);
      derivedGeometry = result;
      if (swatch) {
        comparisonStates = Object.freeze({ G0: result, Gt: null, Gn: null }); comparisonState = 'G0';
        geometryVersions.set(result, `${result.identity?.key ?? 'swatch'}/display:${++geometrySerial}`);
      }
      error = null; rendererStatus = renderer.status ?? applied ?? rendererStatus; notify();
    }).catch(caught => { if (isCurrent()) fail(caught); })
      .finally(() => { if (token === epoch) pending = null; });
  }
  function rebuild() {
    release(); selectedLinkId = null; error = null; topology = readSource(); notify(); scheduleGeometry();
  }
  function activateComparison(state) {
    const next = comparisonStates[state];
    if (!next) return false;
    comparisonState = state; derivedGeometry = next;
    if (!geometryVersions.has(next)) geometryVersions.set(next, `${next.identity?.key ?? 'swatch'}/display:${++geometrySerial}`);
    auditEpoch++; auditRunning = correctionRunning = false;
    auditReport = auditProgress = correctionPlan = auditPathIds = auditSelectedFindingId = null;
    applyScene(); return true;
  }
  async function createComparisonCandidate(state) {
    if (disposed || auditRunning || correctionRunning || profileRunning || comparisonState !== 'G0' ||
      !jointTargetId || !derivedGeometry || auditReport?.complete !== true) return;
    const captured = derivedGeometry, sourceReport = auditReport, targetId = jointTargetId, token = auditEpoch;
    const isCurrent = () => !disposed && token === auditEpoch && captured === derivedGeometry &&
      sourceReport === auditReport && jointTargetId === targetId;
    correctionRunning = true; correctionReport = null;
    comparisonStates = Object.freeze({ ...comparisonStates, [state]: null }); notify();
    try {
      const result = state === 'Gt' ? await applyTrimDiagnostic(captured, sourceReport, { pathIds: [targetId] }) :
        await buildJointCandidate(captured, sourceReport, { pathId: targetId, isCancelled: () => !isCurrent(),
          yieldControl: () => new Promise(resolve => setTimeout(resolve, 0)) });
      if (!isCurrent()) return;
      correctionReport = { ...result.report, status: result.status, reason: result.reason ?? result.report?.reason,
        comparisonState: state, recommendation: state === 'Gt' ? 'KNOWN_FAILED_DIAGNOSTIC_ONLY' : 'CANDIDATE_NOT_ACCEPTED' };
      if (result.status === 'APPLIED' && result.swatch?.status === 'OK' && result.swatch !== captured) {
        comparisonStates = Object.freeze({ ...comparisonStates, [state]: result.swatch });
        activateComparison(state);
      }
      return result;
    } catch (caught) {
      if (isCurrent()) correctionReport = { status: 'FAILED', reason: String(caught.message || caught), comparisonState: state };
    } finally {
      if (isCurrent()) { correctionRunning = false; notify(); }
    }
  }
  const api = {
    get model() { return Object.freeze({ mode: swatch ? 'VISUAL_SWATCH_TEST_ONLY' : enabled ? 'SPATIAL_HYPOTHESIS_TEST_ONLY' : 'SOURCE_TOPOLOGY_VIEW',
      roi, options, topology, derivedGeometry, generatedChains, yarnFilter, selectedLinkId, view, error, rendererStatus,
      needsGeneration: swatch && !enabled, sourcePending: !!current.machineSnapshotPending,
      machineError: current.machineSnapshotError,
      evidenceView, selectionFilter, materialBindings, scanAxis, materialAssets: current.yarnLibrary ?? [],
      profileRunning, profileReport, auditRunning, auditProgress, auditReport, auditPathIds, auditSelectedFindingId,
      correctionPlan, correctionReport, correctionRunning, comparisonState, comparisonStates, jointTargetId, debugMode,
      geometryVersion: derivedGeometry ? geometryVersions.get(derivedGeometry) ?? null : null,
      renderDiagnostics: renderer?.getDiagnostics?.() ?? null }); },
    mount(container) { if (disposed || viewport === container) return; release(); viewport = container; scheduleGeometry(); },
    setROI(patch) { if (disposed) return; roi = createSimulationSnapshot({ ...roi, ...patch }); rebuild(); },
    setHypothesisEnabled(next) {
      if (disposed) return;
      if (swatch) { swatch = false; options = createSimulationSnapshot(DEFAULT_OPTIONS); yarnFilter = 'all'; }
      enabled = next === true; rebuild();
    },
    generateSwatch(fullSize = false) {
      if (disposed) return;
      if (swatch && enabled && topology?.status === 'READY') {
        view = null;
        api.setOptions({ fullSize });
        return;
      }
      swatch = enabled = true; evidenceView = false; selectionFilter = {}; view = null; yarnFilter = 'all';
      options = createSimulationSnapshot({ ...SWATCH_OPTION_DEFAULTS, fullSize }); rebuild();
    },
    setEvidenceView(next) { if (!disposed) { evidenceView = next === true; applyScene(); } },
    setSelectionFilter(patch) { if (!disposed) { auditPathIds = auditSelectedFindingId = null;
      selectionFilter = { ...selectionFilter, ...patch }; applyScene(); } },
    setMaterialBinding(yarnId, assetId, yarnIndex) {
      if (disposed) return;
      const key = yarnIndex == null ? yarnId : swatchYarnKey({ yarnId, yarnIndex });
      materialBindings = { ...materialBindings, [key]: assetId }; applyScene();
    },
    setScanAxis(next) { if (!disposed && ['x', 'y'].includes(next)) { scanAxis = next; applyScene(); } },
    setDebugMode(next) { if (!disposed && ['pbr', 'unlit', 'normals', 'wireframe'].includes(next)) { debugMode = next; applyScene(); } },
    setComparisonState(next) { if (!disposed && ['G0', 'Gt', 'Gn'].includes(next) && next !== comparisonState) activateComparison(next); },
    selectRound11JointCase() {
      if (disposed || !swatch || !comparisonStates.G0 || correctionRunning) return { status: 'REJECTED', reason: 'CURRENT_G0_REQUIRED' };
      const source = comparisonStates.G0;
      const targets = source.paths.filter(p => p.row === 22 && p.needle === 16 && p.yarnIndex === 1 && p.geometryRole === 'VISUAL_TRANSITION');
      const target = targets.length === 1 ? targets[0] : null;
      const adjacent = needle => source.paths.find(p => p.row === 22 && p.needle === needle && p.yarnIndex === 1 &&
        p.geometryRole === 'STITCH_VISUAL_TEMPLATE' && p.yarnId === target?.yarnId && p.feedIndex === target?.feedIndex);
      const left = adjacent(16), right = adjacent(17), refs = target?.provenance;
      const sameIds = (a, b) => Array.isArray(a) && a.length > 0 && Array.isArray(b) &&
        JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
      const occurrences = new Set(topology.occurrences.map(item => item.id)), links = new Set(topology.links.map(item => item.id));
      const validRefs = refs && [refs.occurrenceIds, refs.transitionToOccurrenceIds].every(ids => Array.isArray(ids) && ids.length && ids.every(id => occurrences.has(id))) &&
        [refs.linkIds, refs.transitionToLinkIds].every(ids => Array.isArray(ids) && ids.length && ids.every(id => links.has(id)));
      if (!target || left?.operation !== 'T' || right?.operation !== 'K' || !validRefs ||
        !sameIds(refs.occurrenceIds, left.provenance?.occurrenceIds) || !sameIds(refs.linkIds, left.provenance?.linkIds) ||
        !sameIds(refs.transitionToOccurrenceIds, right.provenance?.occurrenceIds) || !sameIds(refs.transitionToLinkIds, right.provenance?.linkIds) ||
        !refs.transitionReason || ![target, left, right].every(p => source.scene.some(item => item.id === p.id))) {
        jointTargetId = null; correctionReport = { status: 'REJECTED', reason: 'SINGLE_CASE_VISUAL_CONNECTION_INTENT_MISSING' }; notify();
        return correctionReport;
      }
      jointTargetId = target.id; selectedLinkId = target.id;
      auditPathIds = auditSelectedFindingId = null; yarnFilter = 'all'; selectionFilter = {}; evidenceView = false;
      applyScene(); api.focusSelected();
      return { status: 'READY', pathId: target.id, leftPathId: left.id, rightPathId: right.id };
    },
    createTrimDiagnostic() { return createComparisonCandidate('Gt'); },
    cancelGeometryCorrection() {
      if (disposed || !correctionRunning) return;
      auditEpoch++; correctionRunning = false; comparisonStates = Object.freeze({ ...comparisonStates, Gn: null });
      correctionReport = { status: 'CANCELLED', recommendation: 'ORIGINAL_GEOMETRY_RETAINED' }; notify();
    },
    setOptions(patch) { if (disposed) return; options = createSimulationSnapshot({ ...options, ...patch }); release(); error = null; notify(); scheduleGeometry(); },
    setYarnFilter(value) {
      if (disposed) return; yarnFilter = value; selectedLinkId = null;
      auditPathIds = auditSelectedFindingId = null;
      applyScene();
    },
    selectLink(id) { if (!disposed) { selectedLinkId = id; notify(); } },
    setView(patch) { if (!disposed && renderer) { try { renderer.setView(patch); } catch (caught) { fail(caught); } } },
    async profileSwatch() {
      if (disposed || auditRunning || correctionRunning || profileRunning || !derivedGeometry || !renderer?.profileOrbit) return;
      const target = renderer, token = epoch, sceneToken = sceneEpoch;
      profileRunning = true; profileReport = null; notify();
      try {
        const report = await target.profileOrbit({ frames: 120 });
        if (!disposed && target === renderer && token === epoch && sceneToken === sceneEpoch) profileReport = report;
      } catch (caught) {
        if (!disposed && target === renderer && token === epoch && sceneToken === sceneEpoch)
          profileReport = { status: 'FAILED', reason: String(caught.message || caught) };
      } finally {
        if (!disposed && target === renderer && token === epoch && sceneToken === sceneEpoch) { profileRunning = false; notify(); }
      }
    },
    async auditSwatch() {
      if (disposed || !swatch || !derivedGeometry || auditRunning || correctionRunning || profileRunning) return;
      const captured = derivedGeometry, token = ++auditEpoch;
      const currentAudit = () => !disposed && token === auditEpoch && captured === derivedGeometry;
      const cached = auditCache.get(captured);
      if (cached) { auditReport = cached.report; correctionPlan = cached.plan; auditProgress = { phase: 'CACHED' }; notify(); return; }
      auditRunning = true; auditReport = correctionPlan = null; auditProgress = { phase: 'STARTING' }; notify();
      let lastProgressAt = -Infinity;
      try {
        const report = await auditGeometry(captured, {
          isCancelled: () => !currentAudit(),
          yieldControl: () => new Promise(resolve => setTimeout(resolve, 0)),
          onProgress(progress) {
            if (!currentAudit()) return;
            auditProgress = progress;
            const now = performance.now();
            if (now - lastProgressAt >= 100) { lastProgressAt = now; notify(); }
          },
        });
        if (!currentAudit()) return;
        let plan = null;
        if (report?.status === 'COMPLETE' && report.complete === true) {
          try { if (captured.mode !== 'SOP_INTERLOCK_SWATCH') plan = await planVisualCorrection(captured, report); }
          catch (caught) { plan = { status: 'REJECTED', reason: String(caught.message || caught) }; }
          if (!currentAudit()) return;
          auditCache.set(captured, { report, plan });
        }
        auditReport = report; correctionPlan = plan;
      } catch (caught) {
        if (currentAudit()) auditReport = { status: 'FAILED', complete: false, reason: String(caught.message || caught) };
      } finally {
        if (currentAudit()) { auditRunning = false; notify(); }
      }
    },
    cancelGeometryAudit() {
      if (disposed || !auditRunning) return;
      auditEpoch++; auditRunning = false; auditReport = null; auditProgress = { phase: 'CANCELLED' }; notify();
    },
    applyGeometryCorrection() { return createComparisonCandidate('Gn'); },
    selectAuditFinding(id) {
      if (disposed || !derivedGeometry || !auditReport) return;
      const finding = auditReport.findings?.find(item => item.id === id);
      const sourceIds = finding?.sourcePathIds?.filter(pathId => derivedGeometry.paths.some(path => path.id === pathId));
      if (!sourceIds?.length) return;
      auditSelectedFindingId = id; auditPathIds = Object.freeze([...new Set(sourceIds)]);
      yarnFilter = 'all'; selectionFilter = {}; evidenceView = false; selectedLinkId = auditPathIds[0];
      applyScene();
      const witnesses = finding.geometryEvidence?.closestPoints;
      if (Array.isArray(witnesses) && witnesses.length && witnesses.every(point => Array.isArray(point) &&
        point.length === 3 && point.every(Number.isFinite))) {
        api.setView({ target: [0, 1, 2].map(axis => witnesses.reduce((sum, point) => sum + point[axis], 0) / witnesses.length),
          distance: Math.max(.01, options.radiusMm * 30), yaw: .9, pitch: .4 });
      } else api.focusSelected();
    },
    clearAuditSelection() {
      if (disposed || !auditPathIds) return;
      auditPathIds = auditSelectedFindingId = selectedLinkId = null; applyScene();
    },
    fit() { if (!disposed && renderer) { try { renderer.fit(); } catch (caught) { fail(caught); } } },
    focusSelected() {
      if (disposed || !renderer || !derivedGeometry) return;
      const visible = new Set(filteredScene(derivedGeometry).map(item => item.id));
      const path = derivedGeometry.paths.find(item => item.id === selectedLinkId && visible.has(item.id)) ??
        derivedGeometry.paths.find(item => visible.has(item.id));
      if (!path) return;
      api.setView({ target: path.centerline.points[Math.floor(path.centerline.points.length / 2)],
        distance: Math.max(.01, options.radiusMm * 30), yaw: .9, pitch: .4 });
    },
    updateContext(next) {
      if (disposed) return;
      if (next.workbenchMode && !['pbr25d', 'sop3d'].includes(next.workbenchMode)) { api.dispose(); return; }
      const nextKey = sourceKey(next), newProject = next.projectGeneration !== current.projectGeneration;
      const replacedSnapshot = next.machineSnapshot !== current.machineSnapshot;
      const replacedMaterials = next.yarnLibrary !== current.yarnLibrary;
      const awaitingPublishedInput = swatch && enabled && current.machineSnapshotPending && !newProject &&
        current.feedYarnStructureRevision === next.feedYarnStructureRevision &&
        current.chart === next.chart && current.singleJerseyCamProgram === next.singleJerseyCamProgram &&
        current.needleArrangement === next.needleArrangement;
      if (newProject) { roi = createSimulationSnapshot(DEFAULT_ROI);
        options = createSimulationSnapshot(swatch ? { ...SWATCH_OPTION_DEFAULTS, fullSize: false } : DEFAULT_OPTIONS);
        enabled = evidenceView = false; view = null; yarnFilter = 'all'; materialBindings = {}; selectionFilter = {}; }
      current = next;
      if (replacedMaterials) {
        const validIds = new Set((next.yarnLibrary ?? []).map(asset => String(asset.id)));
        materialBindings = Object.fromEntries(Object.entries(materialBindings).filter(([, id]) => validIds.has(String(id))));
      }
      if (nextKey !== key || replacedSnapshot) {
        key = nextKey;
        if (swatch && !awaitingPublishedInput) {
          enabled = false; release(); topology = null; error = selectedLinkId = null;
          yarnFilter = 'all'; selectionFilter = {}; notify();
        } else rebuild();
      } else if (swatch && replacedMaterials) applyScene();
    },
    exportSession() { return createSimulationSnapshot({ projectGeneration: current.projectGeneration, roi, options, view, yarnFilter, materialBindings }); },
    exportGeometryAudit() {
      if (!auditReport) return null;
      return { ...auditReport, comparison: { state: comparisonState, geometryVersion: geometryVersions.get(derivedGeometry) ?? null,
        geometryVersionMeaning: 'SESSION_LOCAL_IMMUTABLE_GEOMETRY_REFERENCE', jointTargetId, debugMode, view,
        radiusMm: options.radiusMm, jointReport: derivedGeometry.visualJointReport ?? derivedGeometry.visualCorrectionReport ?? null,
        recommendation: comparisonState === 'Gt' ? 'KNOWN_FAILED_DIAGNOSTIC_ONLY' :
          comparisonState === 'Gn' ? 'CANDIDATE_NOT_ACCEPTED' : 'BASELINE_WITH_KNOWN_GEOMETRY_ISSUES' } };
    },
    async ready() { await pending; },
    dispose() { if (disposed) return; release(); disposed = true; topology = null; viewport = null; },
  };
  topology = readSource();
  return api;
}
