import { courseToFeedIndex } from "./yarnLengthMetrics.js";

// A CN endpoint association is not an exclusive per-needle physical yarn path.
export function selectOperationPaths({ links, strands, paddedWidth, xPadding, row, needle,
  feedCount, feedYarnIds, visibleYarnId }) {
  const assignments = feedYarnIds.get(courseToFeedIndex(row, feedCount)) || [];
  const column = endpoint => Math.floor((endpoint % (paddedWidth * 2)) / 2) - xPadding;
  return links.filter(link => link.row === row).flatMap(link =>
    assignments.flatMap((yarnId, yarnIndex) => {
      if (visibleYarnId !== null && yarnId !== visibleYarnId) return [];
      const pathData = strands[yarnIndex]?.resolvedPathByLink.get(link.index);
      return pathData ? [{ linkIndex: link.index, yarnIndex, yarnId, pathData,
        selected: column(link.source) === needle || column(link.target) === needle }] : [];
    }));
}
