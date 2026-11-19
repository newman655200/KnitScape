// Display only. The full published machine snapshot supplies the rows, head
// migrations and ordered chains, even when the preview covers only two repeats.
import { resolveYarnLengthInput } from '../domain/yarnLengthInput.js';
import { distance } from './yarnSpatialMath.js';
import { interlockLengthControls, interlockCurvatureMaximum, buildInterlockReleaseLayout, SOP_INTERLOCK_LAYOUT } from './sopInterlockCurve.js';
import { buildSpatialPath } from './yarnSpatialPath.js';
import { buildParallelTransportFrames } from './yarnParallelTransport.js';
import { buildYarnTubeGeometry } from './yarnTubeGeometry.js';
import { SOP_VISUAL_SWATCH_DEFAULTS } from './sopSpatialHypothesis.js';
import { formSopYarnTube, reverseLayPhaseFor, SOP_SWATCH_FORM } from './sopSwatchForm.js';

// 128 rings per cell resolve the retained-release turns: the same frozen
// safe cubic geometry crossed at 64, and passed the original strict mesh
// audit at both 128 and 256. The tube builder and circular section are unchanged.
export const SOP_INTERLOCK_DEFAULTS = Object.freeze({ ...SOP_VISUAL_SWATCH_DEFAULTS, sampleCount: 128, radialSegments: 16, uvRepeatLengthMm: 1 });

// The current SOP's confirmed knitting-state references, keyed by yarn asset.
// Feed edits and preview material swaps must never change these denominators.
const referenceCmPer100NeedlesByYarn = new Map([
  ['yarn-1793283489150', 23], // N6/W(6040)
  ['yarn-1793283489292', 24], // 20D bare spandex, 8 × 3
]);
// Derived display shape only: length edits reuse exactly the same deterministic
// base, and never make contact layout move another feed or yarn assignment.
let baseLayoutCache = null;

function requireSource(condition, message) {
  if (!condition) throw new Error(message);
}

// Feed identity in the machine snapshot is its zero-based feedIndex.
function feedYarnKey({ feedIndex, yarnId }) {
  return JSON.stringify([feedIndex, yarnId]);
}

function checked(result, label) {
  if (result.status !== 'OK') throw new Error(label + ': ' + JSON.stringify(result.diagnostics));
  return result;
}

function makeTube(cells, chain, parameters, direction, lengthRatio, commonLayout) {
  requireSource(direction !== 0, '无法从当前 YarnChain 的 CN 顺序判定行进方向');
  const { radiusMm, radialSegments, sampleCount } = parameters;
  const controls = [];
  // Length edits reuse the frozen base and move only this row/yarn.
  for (const [i, cell] of cells.entries()) {
    const base=commonLayout.get(cell.row + '/' + cell.needle);
    cell.controlRoles=base.roles;
    cell.entryReference={sourceRow:base.releaseReference.sourceRow,needle:base.releaseReference.needle,
      boundary:base.releaseReference.boundary,ghostControls:base.releaseReference.ghostControls??0,
      startSegment:base.releaseReference.startSegment??null,endSegment:base.releaseReference.endSegment??null,
      releaseStation:base.releaseStation};
    let local=interlockLengthControls(commonLayout,cell.row+'/'+cell.needle,chain.yarnIndex,lengthRatio,radiusMm);
    if (direction < 0) local.reverse();
    if (i > 0) {
      requireSource(cell.needle === cells[i - 1].needle + direction, 'Gap in source needle order');
      requireSource(distance(local[0], controls.at(-1)) < 1e-8, 'Adjacent cell guides disagree at the source join');
      local.shift();
    }
    controls.push(...local);
    cell.controlEnd = controls.length - 1;
  }
  // The existing tube API requires a metric unit tag. Its numeric coordinates
  // here are display units throughout; column spacing is a layout choice and
  // does not alter source needle identity. No gauge conversion occurs.
  const sampled = checked(buildSpatialPath({ type: 'catmull-rom', points: controls, closed: false, unit: 'mm' },
    { sampleCount: cells.length * sampleCount + 1 }), 'Source chain ' + chain.id);
  let ring = 0, previousControl = 0;
  const arc = sampled.lengthMeasurement.cumulativeLengths;
  for (const cell of cells) {
    // Integrate to the actual stitch boundary, which can fall between tube rings.
    cell.modelArcLength = arc[cell.controlEnd] - arc[previousControl];
    cell.controlStart = previousControl;
    previousControl = cell.controlEnd;
    cell.ringStart = ring;
    while (ring < sampled.parameters.length - 1 && sampled.parameters[ring] < cell.controlEnd / (controls.length - 1)) ring++;
    cell.ringEnd = ring;
  }
  const frames = checked(buildParallelTransportFrames(sampled), 'Transport');
  const mesh = checked(buildYarnTubeGeometry({ path: sampled, frames, radiusA: radiusMm,
    radialSegments, capEnds: false, uvRepeatLength: parameters.uvRepeatLengthMm }), 'Tube ' + chain.id);
  return { mesh, ringParameters: sampled.parameters, centerline: { status: 'OK', unit: 'MODEL_NEEDLE_PITCH', closed: false,
    points: sampled.points, tangents: sampled.tangents, controlPoints: controls, direction,
    continuity: sampled.continuity, evidenceStatus: 'VISUAL_ASSUMPTION' } };
}

// Use a repeat-aligned interior patch with source context on all four sides.
function windowStart(total, extent) {
  return Math.floor((total - extent) / (2 * extent)) * extent;
}

export async function buildSopInterlockSwatch(topology, options = {}, afterChain) {
  // The small inspection mesh resolves each circle with sixteen sides. The full
  // sheet keeps the established eight-side display budget. Both levels sweep
  // the same source centerline at the same radius. An explicit option wins.
  // Twelve sides keep the shallow, enclosed openings stable in the full swatch.
  // The magnified sample uses sixteen; callers may select their own refinement.
  const radialSegments = options.fullSize ? 12 : SOP_INTERLOCK_DEFAULTS.radialSegments;
  const parameters = { ...SOP_INTERLOCK_DEFAULTS, radialSegments, ...options };
  const { repeatWidth, repeatHeight, fullSize = false } = parameters;
  const identity = topology?.identity;
  try {
    requireSource(topology?.status === 'READY' && topology.roi.window === 'full',
      'A current full machine topology is required');
    const continuity = topology.continuity;
    const current = item => item.snapshotId === identity.key && item.projectGeneration === identity.projectGeneration &&
      item.revision === identity.feedYarnStructureRevision;
    requireSource(continuity.status === 'CLASSIFIED' && current(continuity), 'Stale source continuity');
    const sourceWidth = topology.roi.needleEnd + 1, sourceHeight = topology.roi.rowEnd + 1;
    const hasRepeat = [repeatWidth, repeatHeight].every(n => Number.isSafeInteger(n) && n > 0);
    const fitsRepeat = hasRepeat && repeatWidth * 2 <= sourceWidth && repeatHeight * 2 <= sourceHeight;
    const useRepeat = fitsRepeat && !fullSize;
    const width = useRepeat ? repeatWidth * 2 : sourceWidth;
    const height = useRepeat ? repeatHeight * 2 : sourceHeight;
    requireSource(width * height <= 20000, '所选显示窗口超过 20000 个针位，请缩小设计窗口');
    const needleStart = windowStart(sourceWidth, width), rowStart = windowStart(sourceHeight, height);
    const coverage = { width, height, needleStart, rowStart, sourceWidth, sourceHeight,
      repeatWidth: hasRepeat ? repeatWidth : null, repeatHeight: hasRepeat ? repeatHeight : null,
      windowMode: useRepeat ? 'repeat' : 'design',
      canToggleSize: fitsRepeat && (repeatWidth * 2 !== sourceWidth || repeatHeight * 2 !== sourceHeight),
      operations: { K: 0, T: 0 },
      generatedCells: 0, generatedAssignments: 0, boundary: 'OPEN_SOURCE_WINDOW' };
    requireSource(Number.isFinite(parameters.radiusMm) && parameters.radiusMm > 0 &&
      parameters.radiusMm <= 0.1 && Number.isInteger(parameters.sampleCount) && parameters.sampleCount >= 16 &&
      parameters.sampleCount <= 128 && Number.isInteger(parameters.radialSegments) && parameters.radialSegments >= 6 &&
      parameters.radialSegments <= 24, 'Invalid tube parameters');
    const inRowWindow = row => row >= rowStart && row < rowStart + height;
    const inNeedleWindow = needle => needle >= needleStart && needle < needleStart + width;
    const operations = new Map(topology.operations.map(op => [op.row * sourceWidth + op.needle, op]));
    const assignmentsByFeed = new Map(), supplies = new Map();
    coverage.feedYarnLengths = [];
    for (const strand of topology.strands) {
      const { feedIndex, yarnIndex } = strand;
      requireSource(yarnIndex === 0 || yarnIndex === 1, '第 ' + (feedIndex + 1) + ' 路有超过两根纱，当前三维圈形只支持单纱或双纱');
      if (!assignmentsByFeed.has(feedIndex)) assignmentsByFeed.set(feedIndex, new Map());
      const feed = assignmentsByFeed.get(feedIndex);
      requireSource(!feed.has(yarnIndex), '第 ' + (feedIndex + 1) + ' 路同一纱位存在重复分配');
      feed.set(yarnIndex, strand);
      const key = feedYarnKey(strand);
      if (!supplies.has(key)) supplies.set(key, []);
      const input = resolveYarnLengthInput(strand.materialState?.lengthInput);
      const referenceCmPer100Needles = referenceCmPer100NeedlesByYarn.get(strand.yarnId) ?? null;
      const settingCmPer100Needles = input.effectiveTargetLengthCmPer100Needles;
      const lengthRatio = referenceCmPer100Needles !== null && settingCmPer100Needles !== null
        ? settingCmPer100Needles / referenceCmPer100Needles : null;
      const summary = { sourceFeed: feedIndex, yarnId: strand.yarnId, yarnIndex,
        referenceCmPer100Needles, settingCmPer100Needles, lengthRatio, eventCount: 0, modelArcLength: 0 };
      supplies.get(key)[yarnIndex] = { input, summary };
      coverage.feedYarnLengths.push(summary);
      if (referenceCmPer100Needles === null || input.status !== 'READY') {
        const fields = [];
        if (referenceCmPer100Needles === null) fields.push('referenceCmPer100Needles');
        if (input.status !== 'READY') fields.push(...(input.lengthInputMode === 'relaxedWithDraft'
          ? ['relaxedLengthCmPer100Needles', 'draftRatio'].filter(field => input[field] === null)
          : ['yarnLengthCmPer100Needles']));
        (coverage.lengthInputWarnings ??= []).push({ feed: strand.feedIndex + 1, yarn: strand.name,
          status: referenceCmPer100Needles === null ? 'NO_YARN_REFERENCE' : input.status, fields, display: '保留该纱位原有分槽圈形' });
      }
    }
    let expectedAssignments = 0;
    const priorK = Array(sourceWidth).fill(null), cellsByKey = new Map();
    for (let row = 0; row < rowStart + height; row++) {
      for (let needle = needleStart; needle < needleStart + width; needle++) {
        const op = operations.get(row * sourceWidth + needle);
        requireSource(op, '第 ' + (row + 1) + ' 行第 ' + (needle + 1) + ' 针缺少组织结果');
        requireSource(['K', 'T'].includes(op.operation), '第 ' + (row + 1) + ' 行第 ' + (needle + 1) +
          ' 针为 ' + op.operation + '，当前三维圈形支持成圈 K 和集圈 T');
        if (op.operation === 'K') priorK[needle] = row;
        if (!inRowWindow(row)) continue;
        requireSource(!hasRepeat || row < repeatHeight || op.operation === operations.get((row - repeatHeight) * sourceWidth + needle)?.operation,
          'Source operations disagree with the supplied course repeat');
        requireSource(!hasRepeat || needle < repeatWidth || op.operation === operations.get(row * sourceWidth + needle - repeatWidth)?.operation,
          'Source operations disagree with the supplied needle repeat');
        cellsByKey.set(row * sourceWidth + needle, { ...op, heldFromRow: priorK[needle] });
        const feedAssignments = assignmentsByFeed.get(op.feedIndex);
        requireSource(feedAssignments?.size, '第 ' + (op.feedIndex + 1) + ' 路缺少当前纱线分配');
        expectedAssignments += feedAssignments.size;
        coverage.operations[op.operation]++;
      }
    }
    const byId = new Map(topology.occurrences.map(item => [item.id, item]));
    // A shared final CN is a source relation for a held head or releasing leg.
    // It never authorizes joining the separate feed paths at that coordinate.
    const occurrencesByCn = new Map();
    for (const occ of topology.occurrences) {
      if (!inNeedleWindow(occ.needle)) continue;
      const key = occ.finalCnIndex + '/' + occ.yarnIndex;
      if (!occurrencesByCn.has(key)) occurrencesByCn.set(key, []);
      occurrencesByCn.get(key).push(occ);
    }
    const links = new Map(topology.links.map(link => [link.id, link]));
    // Reuse the releasing K's real migrated heads to locate its rising leg.
    const headReleaseByCell = new Map(topology.occurrences.filter(o => o.cnType.endsWith('H'))
      .map(o => [[o.row, o.needle, o.yarnIndex].join('/'), o.j]));
    // Membership comes from migrated head CNs, including source rows outside
    // the display crop. The same ordered group is shared by both yarn slots.
    const releaseGroups = new Map();
    for (const head of topology.occurrences.filter(o => o.cnType.endsWith('H'))) {
      const key = [head.needle, head.j, head.yarnIndex].join('/');
      if (!releaseGroups.has(key)) releaseGroups.set(key, new Map());
      releaseGroups.get(key).set(head.row, { row: head.row,
        operation: operations.get(head.row * sourceWidth + head.needle)?.operation });
    }
    for (const [key, members] of releaseGroups)
      releaseGroups.set(key, [...members.values()].sort((a, b) => a.row - b.row));
    // A shared row connection must not change when the display crop changes.
    // Read this depth-layout context from all source CN groups, without
    // generating tubes outside the requested preview.
    const incomingRowMemberCounts = new Map(), outgoingRowMemberCounts = new Map();
    for (const [key, members] of releaseGroups) {
      const releaseRow = Number(key.split('/')[1]);
      incomingRowMemberCounts.set(releaseRow, Math.max(incomingRowMemberCounts.get(releaseRow) ?? 1, members.length));
      for (const member of members)
        outgoingRowMemberCounts.set(member.row, Math.max(outgoingRowMemberCounts.get(member.row) ?? 1, members.length));
    }
    // Build one ownership map before emitting either yarn. Include full CN
    // members and the following K, plus neighbouring source rows/needles. The
    // display crop never replaces the actual migration or hold duration.
    // Close every real forward release dependency, including outside the crop.
    const contextEnd = sourceHeight - 1;
    const layoutCells = [], contextPriorK = Array(sourceWidth).fill(null);
    for (let row = 0; row <= contextEnd; row++) {
      for (let needle = Math.max(0, needleStart - 1); needle < Math.min(sourceWidth, needleStart + width + 1); needle++) {
        const op = operations.get(row * sourceWidth + needle);
        requireSource(op && ['K','T'].includes(op.operation), 'Missing K/T release context');
        if (op.operation === 'K') contextPriorK[needle] = row;
        const releaseRow = headReleaseByCell.get([row, needle, 0].join('/'));
        requireSource(Number.isInteger(releaseRow) && releaseRow > row, 'Missing migrated context head');
        layoutCells.push({ row, needle, releaseBoundary: releaseRow >= sourceHeight ? 'OPEN_UPPER_SOURCE_EDGE' : null, operation: op.operation, heldFromRow: contextPriorK[needle], releaseRow,
          releasingReleaseRow: headReleaseByCell.get([releaseRow, needle, 0].join('/')) ?? null,
          releaseGroup: releaseGroups.get([needle, releaseRow, 0].join('/')),
          incomingGroup: releaseGroups.get([needle, row, 0].join('/')) ?? [],
          incomingRowMemberCount: incomingRowMemberCounts.get(row) ?? 1,
          outgoingRowMemberCount: outgoingRowMemberCounts.get(row) ?? 1,
          stackIndex: op.operation === 'T' && contextPriorK[needle] === null ? row + 1 : undefined });
      }
    }
    const layoutKey = JSON.stringify([parameters.radiusMm, parameters.sampleCount, parameters.radialSegments,
      rowStart, height, needleStart, width, layoutCells]);
    if (baseLayoutCache?.key !== layoutKey) {
      const acceptsTubeLayout = layout => {
        try {
          for(let row=rowStart;row<rowStart+height;row++) for(const yarnIndex of [0,1]) {
            const cells=layoutCells.filter(c=>c.row===row&&inNeedleWindow(c.needle)).map(c=>({...c}));
            const {centerline}=makeTube(cells,{id:'release-layout-check/'+row+'/'+yarnIndex,yarnIndex},parameters,1,null,layout);
            // Arc-length sample rings can skip a narrow one-sided cubic
            // curvature peak. Check the actual cubic extrema as well.
            const bend=interlockCurvatureMaximum(centerline.controlPoints);
            if(!(bend.curvature*parameters.radiusMm<1))throw new Error('Tube actual cubic curvature: '+JSON.stringify({row,yarnIndex,...bend}));
          }
          return true;
        } catch(error) {
          if(!error.message.startsWith('Tube ') && !error.message.startsWith('Transport:') && !error.message.startsWith('Source chain ')) throw error;
          acceptsTubeLayout.lastFailure=error.message;
          return false;
        }
      };
      baseLayoutCache = { key: layoutKey, value: buildInterlockReleaseLayout(layoutCells, parameters.radiusMm, acceptsTubeLayout) };
    }
    const commonLayout = baseLayoutCache.value;
    coverage.releaseLayout = commonLayout.diagnostics;
    const paths = [], scene = [], generated = new Set();
    const layPhase = reverseLayPhaseFor(operations, sourceWidth, sourceHeight, repeatWidth, repeatHeight);
    coverage.displayForm = { ...SOP_SWATCH_FORM,
      courseStep: layPhase === null ? SOP_INTERLOCK_LAYOUT.courseStep : SOP_SWATCH_FORM.courseStep,
      reverseLayApplied: layPhase !== null, reverseLayPhaseRadians: layPhase };
    const section = { value: parameters.radiusMm, unit: 'DISPLAY_UNIT', source: 'Reference radius of the source display tube',
      derivationPrinciple: 'Reference circular display radius before the slot-specific circular sweep',
      confidence: 'VISUAL_ASSUMPTION', applicableState: 'REFERENCE_DISPLAY_SECTION_ONLY' };
    const radiiBySlot = [];
    for (const chain of continuity.chains) {
      const first = byId.get(chain.occurrenceIds[0]);
      requireSource(first, '当前 YarnChain 缺少起点 CN');
      if (!inRowWindow(first.row)) continue;
      const assignment = assignmentsByFeed.get(chain.feedIndex)?.get(chain.yarnIndex);
      requireSource(assignment && assignment.yarnId === chain.yarnId, '当前 YarnChain 与该路纱线分配不符');
      requireSource(current(chain) && chain.closed === false && chain.linkIds.length + 1 === chain.occurrenceIds.length,
        'Invalid source chain');
      const groups = [], linkIds = [];
      for (let i = 0; i < chain.occurrenceIds.length; i++) {
        const occ = byId.get(chain.occurrenceIds[i]);
        requireSource(occ && occ.row === first.row && occ.assignmentId === assignment.assignmentId &&
          occ.yarnIndex === chain.yarnIndex && occ.feedIndex === chain.feedIndex && occ.yarnId === chain.yarnId,
          'Source chain changes course or yarn');
        if (i) {
          const link = links.get(chain.linkIds[i - 1]);
          requireSource(link && !link.crossRow && !link.crossFeed && link.boundary === 'INTERNAL' &&
            link.sourceOccurrenceId === chain.occurrenceIds[i - 1] && link.targetOccurrenceId === occ.id &&
            link.feedIndex === chain.feedIndex && link.yarnId === chain.yarnId && link.yarnIndex === chain.yarnIndex,
            'Invalid occurrence adjacency in source chain');
          if (inNeedleWindow(occ.needle) || inNeedleWindow(byId.get(link.sourceOccurrenceId).needle)) linkIds.push(link.id);
        }
        if (!inNeedleWindow(occ.needle)) continue;
        if (groups.at(-1)?.needle !== occ.needle) groups.push({ needle: occ.needle, occurrences: [] });
        groups.at(-1).occurrences.push(occ);
      }
      if (!groups.length) continue;
      const sourceFeed = assignment.feedIndex;
      const cells = groups.map(({ needle, occurrences }) => {
        const key = first.row * sourceWidth + needle, op = cellsByKey.get(key);
        const heads = occurrences.filter(occ => occ.cnType.endsWith('H'));
        requireSource(heads.length === 2 && heads[0].j === heads[1].j && heads[0].j > first.row &&
          op?.feedIndex === chain.feedIndex, 'Missing or incompatible migrated head pair');
        const assignmentKey = key + '/' + chain.yarnIndex;
        requireSource(!generated.has(assignmentKey), 'Ambiguous source chain at needle');
        generated.add(assignmentKey);
        const hasRelease = heads[0].j < sourceHeight;
        requireSource(!hasRelease || operations.get(heads[0].j * sourceWidth + needle)?.operation === 'K',
          'Migrated head has no releasing knit in this course');
        const sameContacts = heads.flatMap(head => occurrencesByCn.get(head.finalCnIndex + '/' + chain.yarnIndex));
        const heldHeadIds = sameContacts.filter(o => op.operation === 'T' && o.row === op.heldFromRow &&
          o.needle === needle && o.cnType.endsWith('H')).map(o => o.id);
        const releasingLegIds = sameContacts.filter(o => hasRelease && o.row === heads[0].j &&
          o.needle === needle && o.cnType.endsWith('L')).map(o => o.id);
        requireSource(op.operation !== 'T' || op.heldFromRow === null || heldHeadIds.length === 2,
          'Tuck and held knit heads do not share both migrated CNs');
        requireSource(!hasRelease || releasingLegIds.length === 2, 'Releasing legs do not match migrated head CNs');
        // Only a source-confirmed immediate K release gets the shared display joint.
        const incomingKHeads = occurrences.filter(o => o.cnType.endsWith('L')).flatMap(leg =>
          occurrencesByCn.get(leg.finalCnIndex + '/' + chain.yarnIndex) ?? []).filter(o =>
          o.row === first.row - 1 && o.j === first.row && o.needle === needle && o.cnType.endsWith('H') &&
          operations.get(o.row * sourceWidth + needle)?.operation === 'K');
        requireSource(!incomingKHeads.length || (incomingKHeads.length === 2 &&
          new Set(incomingKHeads.map(o => o.finalCnIndex)).size === 2), 'Ordinary K entry must match two distinct head CNs');
        const knitEntryRow = op.operation === 'K' && incomingKHeads.length === 2 ? first.row - 1 : null;
        const knitExitRow = op.operation === 'K' && hasRelease && heads[0].j === first.row + 1 ? heads[0].j : null;
        const releasingReleaseRow = hasRelease
          ? headReleaseByCell.get([heads[0].j, needle, chain.yarnIndex].join('/')) : null;
        requireSource(!hasRelease || (Number.isInteger(releasingReleaseRow) && releasingReleaseRow > heads[0].j),
          'Releasing K is missing its own migrated head');
        const releaseGroup = releaseGroups.get([needle, heads[0].j, chain.yarnIndex].join('/'));
        requireSource(releaseGroup?.some(member => member.row === first.row), 'Missing shared release membership');
        return { row: first.row, needle, sourceFeed, operation: op.operation, heldFromRow: op.heldFromRow, heldHeadIds, releasingLegIds,
          knitEntryRow, knitExitRow, releasingReleaseRow, releaseGroup,
          stackIndex: op.operation === 'T' && op.heldFromRow === null ? first.row + 1 : undefined,
          oldLoopBoundary: op.heldFromRow === null ? 'OPEN_LOWER_SOURCE_EDGE' : null,
          releaseBoundary: hasRelease ? null : 'OPEN_UPPER_SOURCE_EDGE',
          releaseRow: heads[0].j, occurrenceIds: occurrences.map(occ => occ.id), cnIndices: heads.map(occ => occ.finalCnIndex) };
      });
      const direction = Math.sign(groups.at(-1).occurrences.at(-1).i - groups[0].occurrences[0].i);
      const supply = supplies.get(feedYarnKey(chain))?.[chain.yarnIndex];
      requireSource(supply, '当前 YarnChain 缺少对应来源路、纱线和纱位的输入记录');
      const { input: lengthInput, summary } = supply;
      const referenceTube = makeTube(cells, chain, parameters, direction, summary.lengthRatio, commonLayout.cells);
      const { mesh, centerline, radius } = formSopYarnTube(referenceTube, cells, parameters.uvRepeatLengthMm, layPhase, chain.yarnIndex, parameters.radiusMm, sourceHeight);
      radiiBySlot[chain.yarnIndex] = radius;
      const formedSection = { value: radius, unit: 'DISPLAY_UNIT', quantity: 'CIRCULAR_RADIUS',
        source: 'Slot-specific radius passed to the final parallel-transport tube sweep',
        derivationPrinciple: 'Neutral display radius times this SOP display form’s yarn-slot factor',
        confidence: 'VISUAL_ASSUMPTION', applicableState: 'DISPLAY_ONLY_UNCALIBRATED' };
      summary.eventCount += cells.length;
      summary.modelArcLength += cells.reduce((sum, cell) => sum + cell.modelArcLength, 0);
      const id = chain.id + '/swatch:' + needleStart + '+' + width;
      const path = { id, yarnId: chain.yarnId, yarnIndex: chain.yarnIndex, feedIndex: sourceFeed, sourceFeed, row: first.row,
        cells, centerline, geometryRole: 'CONTINUOUS_STITCH_CHAIN', evidenceStatus: 'VISUAL_ASSUMPTION',
        physicalContinuity: 'UNKNOWN', physicalLengthEligible: false, contactSolverEligible: false,
        provenance: { chainIds: [chain.id], occurrenceIds: cells.flatMap(cell => cell.occurrenceIds),
          linkIds, section: formedSection, lengthInput, lengthRatio: summary.lengthRatio, sourceStatus: 'SOURCE_DERIVED', interpretation: chain.interpretation } };
      paths.push(path);
      scene.push({ id, sourceFeed, yarnId: path.yarnId, geometry: mesh, geometryRole: path.geometryRole, evidenceStatus: path.evidenceStatus,
        material: { color: chain.yarnIndex === 0 ? [0.25, 0.52, 0.67] : [0.90, 0.53, 0.22] } });
      if (afterChain && !(await afterChain(paths.length, chain.id, referenceTube.centerline.controlPoints, referenceTube.ringParameters))) {
        return { status: 'CANCELLED', paths: [], scene: [] };
      }
    }
    coverage.generatedCells = cellsByKey.size;
    coverage.generatedAssignments = generated.size;
    requireSource(generated.size === expectedAssignments,
      '三维样布只找到了 ' + generated.size + ' / ' + expectedAssignments + ' 个针位纱线分配');
    return { status: 'OK', identity, parameters, paths, scene, evidenceScene: scene, coverage, lengths: null,
      sectionEvidence: { ...section, formedRadiiBySlot: radiiBySlot }, mode: 'SOP_INTERLOCK_SWATCH',
      counts: { meshes: paths.length, triangles: scene.reduce((n, item) => n + item.geometry.counts.triangles, 0) },
      diagnostics: [{ code: 'VISUAL_ASSUMPTION', message: 'Loop placement and yarn radius are display assumptions.' }] };
  } catch (error) {
    return { status: 'INVALID', identity, parameters, paths: [], scene: [], diagnostics: [{ code: 'SOP_INTERLOCK', message: error.message }] };
  }
}
