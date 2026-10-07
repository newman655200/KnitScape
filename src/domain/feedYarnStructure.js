// Assignment parameters do not identify an assignment. Full replacement/reordering
// must also declare replacement intent at dispatch, including identical yarn IDs.
export function hasFeedYarnStructureChanged(previousCam, nextCam) {
  if ((previousCam === null) !== (nextCam === null)) return true;
  const previous = previousCam?.feeds ?? [];
  const next = nextCam?.feeds ?? [];
  return previous.length !== next.length || previous.some((feed, index) => {
    const yarns = feed?.yarns ?? [];
    const nextYarns = next[index]?.yarns ?? [];
    return yarns.length !== nextYarns.length || yarns.some((yarn, slot) => yarn.yarnId !== nextYarns[slot]?.yarnId);
  });
}
