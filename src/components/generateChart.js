import { GLOBAL_STATE, dispatch } from "../state";
import { DEFAULT_STITCH_SYMBOL_INDEX } from "../constants";
import { buildChartFromRepeats } from "../lib/buildChartFromRepeats.js";
export function generateChart() {
  return ({ state }) => {
    let repeats = state.repeats;
    function regen() {
      const chart = buildChartFromRepeats({
        repeats,
        width: GLOBAL_STATE.chart.width,
        height: GLOBAL_STATE.chart.height,
        emptyColor: DEFAULT_STITCH_SYMBOL_INDEX,
      });
      dispatch({ chart });
    }
    regen();
    return {
      syncState(state) {
        if (repeats != state.repeats) {
          repeats = state.repeats;
          regen();
        }
      },
    };
  };
}
