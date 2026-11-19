import { normalizeYarnPlies, resolveFeedYarnPlies } from "../domain/yarnMaterial.js";
import { normalizeYarnSequence, yarnIndexForSequenceRow } from "../actions/yarnSequenceRows.js";
import { courseToFeedIndex } from "./yarnLengthMetrics.js";

// Resolve appearance and assignment decisions once for every renderer. Optional
// current palette/ply/library/sequence inputs can refresh appearance while the
// exact base/applied paths remain owned by the computation snapshot.
export function resolveYarnRenderItems(options) {
  const input = { ...options.snapshot, ...options };
  const { yarnPathLinks, yarnStrands, feedCount = 0, feeds = null } = input;
  const palette = input.palette || [];
  const activeYarnPlies = Object.hasOwn(options, "yarnPlies")
    ? normalizeYarnPlies(options.yarnPlies, palette) : input.activeYarnPlies;
  const usedFeedIndices = new Set(yarnPathLinks.map(link => courseToFeedIndex(link.row, feedCount || 1)));
  const feedYarnPlies = Object.hasOwn(options, "yarnLibrary") || Object.hasOwn(options, "yarnPlies")
    ? resolveFeedYarnPlies(feeds, input.yarnLibrary, activeYarnPlies[0], usedFeedIndices)
    : input.feedYarnPlies || new Map();
  const feedYarnIds = input.feedYarnIds || new Map();
  const normalizedYarnSequence = Object.hasOwn(options, "yarnSequence")
    ? normalizeYarnSequence(options.yarnSequence) : input.normalizedYarnSequence;
  const hasYarnSequenceMask = Object.hasOwn(options, "yarnSequence")
    ? Array.from(normalizedYarnSequence.pixels).some(pixel => Number(pixel) !== 0)
    : input.hasYarnSequenceMask;
  // UV accumulation follows every active link for a strand, independently of
  // the visibility filter used below. Renderers consume this resolved domain.
  const strandLinks = yarnStrands.map((_, yarnIndex) => feedYarnPlies.size
    ? yarnPathLinks.filter(link => yarnIndex <
      (feedYarnPlies.get(courseToFeedIndex(link.row, feedCount || 1))?.length || 1))
    : yarnPathLinks);
  const drawnYarnIds = new Set();
  yarnPathLinks.forEach(link => {
    feedYarnIds.get(courseToFeedIndex(link.row, feedCount || 1))?.forEach((id, slot) => {
      if (id !== null && yarnStrands[slot]?.resolvedPathByLink.get(link.index)) drawnYarnIds.add(id);
    });
  });
  const visibleYarnId = input.visibleYarnId !== null && input.visibleYarnId !== undefined &&
    drawnYarnIds.has(String(input.visibleYarnId)) ? String(input.visibleYarnId) : null;

  function rowYarnPly(link, ply, yarnIndex) {
    if (visibleYarnId !== null && (ply !== activeYarnPlies[0] ||
      feedYarnIds.get(courseToFeedIndex(link.row, feedCount || 1))?.[yarnIndex] !== visibleYarnId)) return null;
    const assigned = feedYarnPlies.get(courseToFeedIndex(link.row, feedCount || 1));
    const explicitMaterial = assigned?.some(item => item.assetMaterial) || assigned?.length > 1;
    if (ply !== activeYarnPlies[0] && explicitMaterial) return null;
    if (ply === activeYarnPlies[0] && feedCount) {
      const plies = feedYarnPlies.get(courseToFeedIndex(link.row, feedCount));
      if (plies) ply = plies[yarnIndex];
      else if (yarnIndex > 0) return null;
      if (!ply) return null;
    }
    if (!hasYarnSequenceMask || ply.assetMaterial) return ply;
    const paletteIndex = yarnIndexForSequenceRow(normalizedYarnSequence, link.row);
    const sequenceMaskColor = palette[paletteIndex] || activeYarnPlies[paletteIndex]?.color;
    return sequenceMaskColor ? { ...ply, sequenceMaskColor } : ply;
  }

  const layers = { back: [], front: [], mid: [] };
  yarnPathLinks.forEach(link => layers[link.layer].push(link));
  const groups = [], items = [];
  for (const [layer, links] of Object.entries(layers)) {
    if (!links.length) continue;
    activeYarnPlies.forEach((ply, plyIndex) => {
      const count = ply === activeYarnPlies[0] ? yarnStrands.length : 1;
      for (let yarnIndex = 0; yarnIndex < count; yarnIndex++) {
        const strand = yarnStrands[yarnIndex];
        const group = { layer, plyIndex, yarnIndex, ply, items: [] };
        links.forEach(link => {
          const material = rowYarnPly(link, ply, yarnIndex);
          const pathData = strand.resolvedPathByLink.get(link.index);
          if (!material || !pathData) return;
          const feedIndex = courseToFeedIndex(link.row, feedCount || 1);
          const yarnId = feedYarnIds.get(feedIndex)?.[yarnIndex] ?? null;
          const item = {
            layer, link, plyIndex, yarnIndex, yarnId, feedIndex,
            assignmentId: plyIndex === 0 && feedYarnIds.has(feedIndex)
              ? `feed:${feedIndex}:yarn:${yarnIndex}` : null,
            legacyCompanion: ply !== activeYarnPlies[0],
            material, color: material.color, diameter: material.diameter,
            sequenceMaskColor: material.sequenceMaskColor,
            strand, pathData, modelPathData: strand.modelPathByLink.get(link.index),
            normalOffsetModel: 0,
          };
          group.items.push(item); items.push(item);
        });
        if (group.items.length) groups.push(group);
      }
    });
  }
  return { items, groups, strandLinks, yarnIds: [...drawnYarnIds], visibleYarnId, activeYarnPlies, feedYarnPlies };
}
