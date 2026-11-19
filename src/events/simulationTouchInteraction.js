import { GLOBAL_STATE, dispatch } from "../state";
import {
  beginTexturePreviewInteraction,
  endTexturePreviewInteraction,
} from "../actions/texturePerformance";
const interactions = new Set();
export function endSimulationTouchInteractions() { for (const end of [...interactions]) end(); }

function pan(e, sim) {
  const startPos = { x: e.clientX, y: e.clientY };
  const startPan = GLOBAL_STATE.simPan;
  beginTexturePreviewInteraction();

  function move(e) {
    if (!e.touches.length) {
      end();
      return;
    }

    const dx = startPos.x - e.touches[0].clientX;
    const dy = startPos.y - e.touches[0].clientY;

    dispatch({ simPan: { x: startPan.x - dx, y: startPan.y - dy } });
  }

  function end() {
    sim.removeEventListener("touchmove", move);
    sim.removeEventListener("touchcancel", end);
    sim.removeEventListener("touchend", end);
    endTexturePreviewInteraction();
    interactions.delete(end);
  }

  sim.addEventListener("touchmove", move);
  interactions.add(end);
  sim.addEventListener("touchcancel", end);
  sim.addEventListener("touchend", end);
}

export function simulationTouchInteraction(simContainer) {
  const start = (e) => {
    pan(e.touches[0], simContainer);
  };
  simContainer.addEventListener("touchstart", start);
  return () => { endSimulationTouchInteractions(); simContainer.removeEventListener("touchstart", start); };
}
