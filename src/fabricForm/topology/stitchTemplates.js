/** Initial embedding signature, separate from machine-action topology. */
export const stockinetteSabetta = Object.freeze({
  id: "stockinette-sabetta",
  // The fourth crossing lies in the next needle's material interval: the
  // published seed's loop boundary is on a sinker arc, not a closed-loop seam.
  crossings: Object.freeze([-1, -1, 1, 1].map((over, index) => Object.freeze({
    over, orientation: index % 2 === 0 ? -1 : 1, targetNeedleOffset: index === 3 ? 1 : 0,
  }))),
  crossingConvention: Object.freeze({
    projection: "XY", normal: "+Z", order: "increasing-material-order",
    over: "sign(z_self - z_target)",
    orientation: "sign((t_self cross t_target).z); both tangents follow increasing material order",
    source: "sabetta/stitch-by-stitch@0ed27f35dcf5c3bda874f214bbcab0455055edf0 stockinette initial geometry",
    scope: "Seed embedding signature, not a complete topological invariant of deformed curves",
  }),
  seed: Object.freeze({
    source: "sabetta/stitch-by-stitch", commit: "0ed27f35dcf5c3bda874f214bbcab0455055edf0",
  }),
});
